#!/usr/bin/env node
/**
 * di-container — 实际调用已部署的 tsyringe (CJS) + InversifyJS (ESM) 构造依赖注入容器：
 * ProviderRegistry → Anthropic/OpenAI 两个 LLM provider 实现 → Router（模拟 LLMProvider 接口），
 * 真实解析依赖并调用服务方法。让 be-provider 资产从"声明内核"升级为"真调用 DI 内核"（第三方部署，不重复造轮子）。
 * 用法：node scripts/di-container.mjs
 * 依赖：AI-Hub thirdparty 库（`$AIHUB_ROOT/thirdparty/node_modules`，默认 `~/.ai-hub`）。
 */
import path from 'node:path';
import os from 'node:os';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';

const aihubRoot = process.env.AIHUB_ROOT || path.join(os.homedir(), '.ai-hub');
const tp = path.join(aihubRoot, 'thirdparty', 'node_modules');
// CJS 库经 createRequire 定位（tsyringe/reflect-metadata 为 CJS）
const req = createRequire(path.join(tp, 'di-container.js'));
// tsyringe 与 InversifyJS 均依赖反射设计时元数据（装饰器注入需要），前置加载
req('reflect-metadata');

/** 每个内核各自构造一份独立类图，避免两个库的装饰器元数据互相污染。 */
function makeGraph() {
  class AnthropicProvider {
    constructor() {
      this.name = 'anthropic';
      this.models = ['claude-sonnet-4-6', 'claude-haiku-4-5-20251001'];
    }
    chat(opts) { return `anthropic:${opts.model}(${opts.prompt})`; }
    healthCheck() { return true; }
    estimateTokens(t) { return Math.ceil(t.length / 4); }
  }
  class OpenAIProvider {
    constructor() {
      this.name = 'openai';
      this.models = ['gpt-4o', 'gpt-4o-mini'];
    }
    chat(opts) { return `openai:${opts.model}(${opts.prompt})`; }
    healthCheck() { return true; }
    estimateTokens(t) { return Math.ceil(t.length / 4); }
  }
  class Router {
    constructor(primary, fallback) { this.primary = primary; this.fallback = fallback; }
    route(model, prompt) {
      const p = [this.primary, this.fallback].find((x) => x.models.includes(model));
      if (!p) throw new Error(`No provider for model: ${model}`);
      return p.chat({ model, prompt });
    }
  }
  return { AnthropicProvider, OpenAIProvider, Router };
}

function runTsyringe() {
  const { injectable, inject, container, Lifecycle } = req('tsyringe');
  const { AnthropicProvider, OpenAIProvider, Router } = makeGraph();
  // tsyringe 在 @injectable() 时抓取参数元数据（typeInfo），故先挂 @inject 参数装饰器再挂 @injectable()
  injectable()(AnthropicProvider);
  injectable()(OpenAIProvider);
  inject('Anthropic')(Router, undefined, 0);
  inject('OpenAI')(Router, undefined, 1);
  injectable()(Router);
  container.register('Anthropic', { useClass: AnthropicProvider }, { lifecycle: Lifecycle.Singleton });
  container.register('OpenAI', { useClass: OpenAIProvider }, { lifecycle: Lifecycle.Singleton });
  const router = container.resolve(Router);
  console.log('  [tsyringe] 容器解析成功 → primary=' + router.primary.name + ' · fallback=' + router.fallback.name);
  console.log('  [tsyringe] Router.route(gpt-4o) → ' + router.route('gpt-4o', 'hi'));
  console.log('  [tsyringe] provider 可调：' + router.primary.name + '(' + router.primary.models.join('/') + ') · healthCheck=' + router.primary.healthCheck() + ' · estimateTokens(' + router.primary.estimateTokens('hello world') + ')');
}

async function runInversify() {
  const { Container, injectable, inject } = await import(pathToFileURL(path.join(tp, 'inversify', 'lib', 'index.js')).href);
  const { AnthropicProvider, OpenAIProvider, Router } = makeGraph();
  injectable()(AnthropicProvider);
  injectable()(OpenAIProvider);
  inject('Anthropic')(Router, undefined, 0);
  inject('OpenAI')(Router, undefined, 1);
  injectable()(Router);
  const c2 = new Container();
  c2.bind('Anthropic').to(AnthropicProvider);
  c2.bind('OpenAI').to(OpenAIProvider);
  c2.bind('Router').to(Router);
  const router = c2.get('Router');
  console.log('  [inversify] 容器解析成功 → primary=' + router.primary.name + ' · fallback=' + router.fallback.name);
  console.log('  [inversify] Router.route(claude-haiku-4-5-20251001) → ' + router.route('claude-haiku-4-5-20251001', 'hello'));
  console.log('  [inversify] provider 可调：' + router.fallback.name + '(' + router.fallback.models.join('/') + ') · healthCheck=' + router.fallback.healthCheck() + ' · estimateTokens(' + router.fallback.estimateTokens('hello world') + ')');
}

async function main() {
  console.log('# di-container (tsyringe + inversify · AI-Hub thirdparty)');
  console.log('- thirdparty: ' + tp);
  const ok = [];
  try { runTsyringe(); ok.push('tsyringe'); }
  catch (e) { console.log('- tsyringe: FAIL（' + e.message + '）——继续尝试 inversify'); }
  try { await runInversify(); ok.push('inversify'); }
  catch (e) { console.log('- inversify: FAIL（' + e.message + '）'); }
  if (!ok.length) throw new Error('tsyringe 与 inversify 均不可用，无真实 DI 输出');
  console.log('- 状态：' + ok.join(' + ') + ' 真调成功');
}

try { await main(); }
catch (e) {
  console.error('[FAIL] di-container: ' + e.message);
  console.error('  需 AI-Hub thirdparty 库：npm install --prefix <AIHUB_ROOT>/thirdparty tsyringe inversify reflect-metadata tslib');
  process.exitCode = 1;
}
