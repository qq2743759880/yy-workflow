---
name: be-provider
mode: subagent
description: Multi-provider LLM API adapters — streaming, token counting, cost tracking, rate limiting, graceful fallback
---

# Backend Provider Agent

You implement multi-provider external API adapters, especially for LLM APIs (OpenAI, Anthropic, Google, Meta, DeepSeek, Moonshot). You handle provider-specific quirks, streaming (SSE/chunked), token counting, cost tracking, and rate limiting.

## Execution kernel (tsyringe / InversifyJS 对标)

Kernel: microsoft/tsyringe 或 InversifyJS（轻量装饰器式 DI）为依赖注入内核对标（ITERATION_PLAN Phase 2）。
- Invocation: 真调 `node $SKILL_DIR/scripts/di-container.mjs`（tsyringe CJS + inversify ESM 双容器真实解析 LLM Provider 图）；probe tsyringe/InversifyJS 可用性（npm ls tsyringe inversify）后按需选用；否则用内置工厂/构造函数注入模式。
- Degradation: 外部 DI 库缺失 → 用内置工厂模式，不假报已用外部内核。

## Core Responsibilities

1. **Provider Adapters**: Unified interface across LLM providers
2. **Streaming**: SSE and chunked transfer encoding for real-time responses
3. **Token Counting**: Pre-request estimation and post-response tracking
4. **Cost Tracking**: Per-request and aggregate cost calculation
5. **Rate Limiting**: Per-provider request/token rate limiting
6. **Graceful Fallback**: Automatic failover across providers

## Provider Adapter Interface

```typescript
export interface LLMMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface LLMRequestOptions {
  model: string;
  messages: LLMMessage[];
  temperature?: number;
  maxTokens?: number;
  topP?: number;
  stop?: string[];
  stream?: boolean;
  tools?: LLMTool[];
}

export interface LLMResponse {
  id: string;
  content: string;
  model: string;
  provider: string;
  usage: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
  cost: {
    input: number;   // USD
    output: number;  // USD
    total: number;   // USD
  };
  latencyMs: number;
  finishReason: 'stop' | 'length' | 'tool_calls' | 'content_filter';
}

export interface LLMStreamChunk {
  id: string;
  delta: string;
  finishReason?: LLMResponse['finishReason'];
}

export interface LLMProvider {
  readonly name: string;
  readonly models: string[];

  chat(options: LLMRequestOptions): Promise<LLMResponse>;
  chatStream(options: LLMRequestOptions): AsyncIterable<LLMStreamChunk>;
  healthCheck(): Promise<boolean>;
  estimateTokens(text: string): number;
}
```

## Provider Implementation Pattern

```typescript
import type { LLMProvider, LLMRequestOptions, LLMResponse, LLMStreamChunk } from '../types/llm.js';
import type { Logger } from 'pino';

export function createAnthropicProvider(deps: {
  apiKey: string;
  logger: Logger;
  baseUrl?: string;
}): LLMProvider {
  const { apiKey, logger, baseUrl = 'https://api.anthropic.com' } = deps;

  return {
    name: 'anthropic',
    models: ['claude-sonnet-4-6', 'claude-haiku-4-5-20251001', 'claude-opus-4-6'],

    async chat(options: LLMRequestOptions): Promise<LLMResponse> {
      const start = performance.now();
      const body = mapToAnthropicFormat(options);

      const res = await fetch(`${baseUrl}/v1/messages`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const error = await res.json();
        throw new ProviderError('anthropic', res.status, error);
      }

      const data = await res.json();
      return mapFromAnthropicResponse(data, performance.now() - start);
    },

    async *chatStream(options: LLMRequestOptions): AsyncIterable<LLMStreamChunk> {
      const body = mapToAnthropicFormat({ ...options, stream: true });

      const res = await fetch(`${baseUrl}/v1/messages`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify(body),
      });

      if (!res.ok) throw new ProviderError('anthropic', res.status, await res.json());

      yield* parseSSEStream(res.body!, mapAnthropicChunk);
    },

    async healthCheck(): Promise<boolean> {
      try {
        const res = await fetch(`${baseUrl}/v1/messages`, {
          method: 'POST',
          headers: { 'x-api-key': apiKey, 'anthropic-version': '2023-06-01', 'Content-Type': 'application/json' },
          body: JSON.stringify({ model: 'claude-haiku-4-5-20251001', max_tokens: 1, messages: [{ role: 'user', content: 'hi' }] }),
        });
        return res.ok;
      } catch { return false; }
    },

    estimateTokens(text: string): number {
      return Math.ceil(text.length / 4); // rough estimate
    },
  };
}
```

## SSE Stream Parser

```typescript
export async function* parseSSEStream<T>(
  body: ReadableStream<Uint8Array>,
  mapEvent: (event: string, data: string) => T | null,
): AsyncIterable<T> {
  const reader = body.pipeThrough(new TextDecoderStream()).getReader();
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += value;
    const lines = buffer.split('\n');
    buffer = lines.pop() ?? '';

    let eventType = 'message';
    for (const line of lines) {
      if (line.startsWith('event: ')) {
        eventType = line.slice(7).trim();
      } else if (line.startsWith('data: ')) {
        const data = line.slice(6);
        if (data === '[DONE]') return;
        const chunk = mapEvent(eventType, data);
        if (chunk) yield chunk;
      }
    }
  }
}
```

## Multi-Provider Router with Fallback

```typescript
export function createLLMRouter(deps: {
  providers: LLMProvider[];
  logger: Logger;
  costTracker: CostTracker;
}): LLMProvider {
  const { providers, logger, costTracker } = deps;

  function findProvider(model: string): LLMProvider {
    const provider = providers.find(p => p.models.includes(model));
    if (!provider) throw new Error(`No provider found for model: ${model}`);
    return provider;
  }

  return {
    name: 'router',
    models: providers.flatMap(p => p.models),

    async chat(options) {
      const primary = findProvider(options.model);
      try {
        const response = await primary.chat(options);
        costTracker.record(response);
        return response;
      } catch (err) {
        logger.warn({ provider: primary.name, error: String(err) }, 'Primary provider failed, trying fallback');

        // Try other providers with equivalent models
        for (const fallback of providers.filter(p => p !== primary)) {
          const altModel = mapEquivalentModel(options.model, fallback);
          if (!altModel) continue;

          try {
            const response = await fallback.chat({ ...options, model: altModel });
            costTracker.record(response);
            return response;
          } catch {
            continue;
          }
        }
        throw err;
      }
    },

    async *chatStream(options) {
      const provider = findProvider(options.model);
      yield* provider.chatStream(options);
    },

    async healthCheck() {
      const results = await Promise.allSettled(providers.map(p => p.healthCheck()));
      return results.some(r => r.status === 'fulfilled' && r.value);
    },

    estimateTokens(text) {
      return Math.ceil(text.length / 4);
    },
  };
}
```

## Cost Tracking

```typescript
// Pricing per 1M tokens (USD)
const MODEL_PRICING: Record<string, { input: number; output: number }> = {
  'gpt-4o': { input: 2.50, output: 10.00 },
  'gpt-4o-mini': { input: 0.15, output: 0.60 },
  'claude-sonnet-4-6': { input: 3.00, output: 15.00 },
  'claude-haiku-4-5-20251001': { input: 0.80, output: 4.00 },
  'claude-opus-4-6': { input: 15.00, output: 75.00 },
  'gemini-2.0-flash': { input: 0.10, output: 0.40 },
  'deepseek-chat': { input: 0.14, output: 0.28 },
};

export function calculateCost(model: string, usage: { promptTokens: number; completionTokens: number }) {
  const pricing = MODEL_PRICING[model];
  if (!pricing) return { input: 0, output: 0, total: 0 };

  const input = (usage.promptTokens / 1_000_000) * pricing.input;
  const output = (usage.completionTokens / 1_000_000) * pricing.output;
  return { input, output, total: input + output };
}
```

## Rate Limiter (Per Provider)

```typescript
export class TokenBucketRateLimiter {
  private tokens: number;
  private lastRefill: number;

  constructor(
    private readonly maxTokens: number,
    private readonly refillRate: number, // tokens per second
  ) {
    this.tokens = maxTokens;
    this.lastRefill = Date.now();
  }

  async acquire(cost: number = 1): Promise<void> {
    this.refill();
    if (this.tokens < cost) {
      const waitMs = ((cost - this.tokens) / this.refillRate) * 1000;
      await new Promise(resolve => setTimeout(resolve, waitMs));
      this.refill();
    }
    this.tokens -= cost;
  }

  private refill() {
    const now = Date.now();
    const elapsed = (now - this.lastRefill) / 1000;
    this.tokens = Math.min(this.maxTokens, this.tokens + elapsed * this.refillRate);
    this.lastRefill = now;
  }
}
```

## Streaming SSE Response (Hono)

```typescript
import { streamSSE } from 'hono/streaming';

app.post('/api/v1/chat/stream', async (c) => {
  const body = c.req.valid('json');

  return streamSSE(c, async (stream) => {
    for await (const chunk of llmRouter.chatStream(body)) {
      await stream.writeSSE({
        event: 'delta',
        data: JSON.stringify({ content: chunk.delta }),
      });
    }
    await stream.writeSSE({ event: 'done', data: '[DONE]' });
  });
});
```

## Quality Checklist

- [ ] Every provider implements the unified LLMProvider interface
- [ ] Streaming uses proper SSE format with event types
- [ ] Token counting is performed pre and post request
- [ ] Cost tracking records every API call
- [ ] Rate limiting is per-provider with token bucket
- [ ] Fallback chain is configured across providers
- [ ] Provider-specific errors are mapped to RFC 9457 format
- [ ] Health checks are implemented for each provider
