#!/usr/bin/env node
/**
 * resilience-check — 实际调用已部署的 cockatiel (ESM) + polly-js (CJS) 韧性原语：
 * 用 retry（指数退避）+ circuit breaker（ConsecutiveBreaker）包裹一个"会失败 N 次后成功"的
 * 模拟 fetch，真实演示退避重试成功 + 熔断触发（BrokenCircuitError）。
 * 让 be-resilience 资产从"声明内核"升级为"真调用韧性内核"（第三方部署，不重复造轮子）。
 * 用法：node scripts/resilience-check.mjs
 * 依赖：AI-Hub thirdparty 库（`$AIHUB_ROOT/thirdparty/node_modules`，默认 `~/.ai-hub`）。
 * 时间控制：指数退避初始延迟 2ms、polly 等待间隔数组 [1,2]ms——模拟 fetch 直接抛错，不真等秒级延迟。
 */
import path from 'node:path';
import os from 'node:os';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';

const aihubRoot = process.env.AIHUB_ROOT || path.join(os.homedir(), '.ai-hub');
const tp = path.join(aihubRoot, 'thirdparty', 'node_modules');
// polly-js 为 CJS，经 createRequire 引入
const req = createRequire(path.join(tp, 'resilience-check.js'));

/** 演示 1：cockatiel retry + 指数退避 —— 模拟 fetch 前 2 次抛 503，第 3 次成功。 */
async function demoRetry(ck) {
  const { retry, handleAll, ExponentialBackoff } = ck;
  let attempts = 0;
  const flakyFetch = async (url) => {
    attempts += 1;
    if (attempts < 3) throw new Error('HTTP 503 (flaky) attempt=' + attempts + ' url=' + url);
    return { status: 200, body: 'ok-after-' + attempts };
  };
  // initialDelay 2ms / maxDelay 8ms：指数退避真实生效但总等待仅几毫秒
  const policy = retry(handleAll, { maxAttempts: 4, backoff: new ExponentialBackoff({ initialDelay: 2, maxDelay: 8 }) });
  policy.onRetry((e) => console.log('    [cockatiel·retry] attempt=' + e.attempt + ' → ' + (e.error && e.error.message)));
  const res = await policy.execute(() => flakyFetch('/api/v1/chat'));
  console.log('  [cockatiel] retry 成功：attempts=' + attempts + ' → status=' + res.status + ' body=' + res.body);
}

/** 演示 2：cockatiel circuit breaker —— ConsecutiveBreaker(2)，连续 2 次失败后熔断打开。 */
async function demoBreaker(ck) {
  const { circuitBreaker, handleAll, wrap, ConsecutiveBreaker, CircuitState } = ck;
  const breaker = circuitBreaker(handleAll, { halfOpenAfter: 1000, breaker: new ConsecutiveBreaker(2) });
  breaker.onBreak(() => console.log('    [cockatiel·breaker] OPENED（熔断打开，后续调用被拒）'));
  breaker.onReset(() => console.log('    [cockatiel·breaker] RESET（熔断恢复）'));
  breaker.onStateChange((s) => console.log('    [cockatiel·breaker] state → ' + CircuitState[s]));
  const fetchWithBreaker = wrap(breaker);
  const before = breaker.state;
  let openSeen = false;
  for (let i = 1; i <= 4; i += 1) {
    try {
      await fetchWithBreaker.execute(() => { throw new Error('upstream down'); });
    } catch (e) {
      if (e.constructor.name === 'BrokenCircuitError') openSeen = true;
      console.log('    call#' + i + ' → ' + e.constructor.name + (e.constructor.name === 'BrokenCircuitError' ? '（熔断生效，未触达上游）' : '（失败计入熔断统计）'));
    }
  }
  console.log('  [cockatiel] 熔断：初始 state=' + CircuitState[before] + ' → 触发=' + openSeen + '（BrokenCircuitError）');
}

/** 演示 3：polly-js retry —— handle 匹配 flaky 错误，等待重试后成功。 */
async function demoPolly() {
  const polly = req('polly-js');
  let attempts = 0;
  const res = await polly()
    .handle((e) => /flaky/.test(e.message))
    .waitAndRetry([1, 2]) // 等待间隔 1ms/2ms，真实等待但总时长可忽略
    .executeForPromise(async () => {
      attempts += 1;
      if (attempts < 3) throw new Error('flaky-' + attempts);
      return 'polly-ok-after-' + attempts;
    });
  console.log('  [polly-js] retry 成功：attempts=' + attempts + ' → ' + res);
}

async function main() {
  console.log('# resilience-check (cockatiel + polly-js · AI-Hub thirdparty)');
  console.log('- thirdparty: ' + tp);
  const ok = [];
  try {
    const ck = await import(pathToFileURL(path.join(tp, 'cockatiel', 'dist', 'index.js')).href);
    console.log('- [cockatiel]（ESM 动态 import）');
    await demoRetry(ck);
    await demoBreaker(ck);
    ok.push('cockatiel');
  } catch (e) { console.log('- cockatiel: FAIL（' + e.message + '）——继续尝试 polly-js'); }
  try {
    console.log('- [polly-js]（CJS createRequire）');
    await demoPolly();
    ok.push('polly-js');
  } catch (e) { console.log('- polly-js: FAIL（' + e.message + '）'); }
  if (!ok.length) throw new Error('cockatiel 与 polly-js 均不可用，无真实韧性输出');
  console.log('- 状态：' + ok.join(' + ') + ' 真调成功');
}

try { await main(); }
catch (e) {
  console.error('[FAIL] resilience-check: ' + e.message);
  console.error('  需 AI-Hub thirdparty 库：npm install --prefix <AIHUB_ROOT>/thirdparty cockatiel polly-js');
  process.exitCode = 1;
}
