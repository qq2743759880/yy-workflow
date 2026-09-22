# T5 Report — 三个「已装未接」竞品库真调脚本 + 内核接线

- 日期：2026-09-01
- 执行方：TT 工作流独立实现子 agent
- 版本：TT 2.2.8（工作树干净）
- 目标：把 be-provider / be-resilience / colorize 三个资产从「声明内核」升级为「真调用库」，接线 Execution kernel（S3 漂移门不破）。

## 环境事实（已核实）

- 第三方库已装于 `~/.ai-hub/thirdparty/node_modules`，脚本一律经 `AIHUB_ROOT` env（默认 `~/.ai-hub`）定位，不写死盘符。
- 模块形态（实测）：
  - `tsyringe` 4.10.0 → CJS（`dist/cjs/index.js`），require 时强校验 reflect-metadata 反射 polyfill。
  - `inversify` 8.2.3 → ESM（`lib/index.js`，`type: module`），re-export 自 `@inversifyjs/*`。
  - `cockatiel` 4.0.0 → ESM（`dist/index.js`，`type: module`）。
  - `polly-js` 1.8.3 → CJS（`src/polly.js`，UMD）。
  - `chroma-js` 3.2.0 → ESM 入口 `index.js` + CJS bundle `dist/chroma.cjs`（package.json exports 的 require 入口）。

## 1. scripts/di-container.mjs（be-provider → tsyringe / InversifyJS）

**调用链**：`req('reflect-metadata')`（CJS createRequire 前置反射元数据）→ `req('tsyringe')`（CJS）构造 `container`；`await import(pathToFileURL(inversify/lib/index.js))`（ESM）构造 `Container`。

**图**：`makeGraph()` 每内核独立生成 `AnthropicProvider / OpenAIProvider / Router`（避免两库装饰器元数据互污染）。注册 token `Anthropic` / `OpenAI` → `Router` 构造注入两个 provider，解析后调用 `route()` / `healthCheck()` / `estimateTokens()`。

**关键点（诚实记录踩坑）**：tsyringe 在 `@injectable()` 时抓取构造参数元数据（`typeInfo`），**必须先挂 `@inject` 参数装饰器再挂 `@injectable()`**，否则报 `TypeInfo not known for "Router"`（probe 阶段实测发现并修复）。

**实测输出摘要**（exit 0）：
```
[tsyringe] 容器解析成功 → primary=anthropic · fallback=openai
[tsyringe] Router.route(gpt-4o) → openai:gpt-4o(hi)
[tsyringe] provider 可调：anthropic(...) · healthCheck=true · estimateTokens(3)
[inversify] 容器解析成功 → primary=anthropic · fallback=openai
[inversify] Router.route(claude-haiku-4-5-20251001) → anthropic:...（真实解析）
- 状态：tsyringe + inversify 真调成功
```

## 2. scripts/resilience-check.mjs（be-resilience → cockatiel / polly-js）

**调用链**：cockatiel 走 `pathToFileURL` 动态 import（ESM）；polly-js 走 `createRequire`（CJS）。

- **cockatiel retry**：`retry(handleAll, { maxAttempts: 4, backoff: new ExponentialBackoff({ initialDelay: 2, maxDelay: 8 }) })` 包裹「前 2 次抛 HTTP 503、第 3 次成功」的模拟 fetch；`onRetry` 事件逐次打印 attempt。指数退避真实生效但初始延迟仅 2ms，总等待可忽略。
- **cockatiel circuit breaker**：`circuitBreaker(handleAll, { halfOpenAfter: 1000, breaker: new ConsecutiveBreaker(2) })`，`onBreak/onStateChange` 打印状态，连续 2 次失败后熔断打开，后续调用抛 `BrokenCircuitError`（未触达上游）。
- **polly-js**：`.handle(匹配 flaky).waitAndRetry([1,2]).executeForPromise(...)` 前 2 次失败后成功。注意 polly-js `waitAndRetry` 只暴露 `executeForPromise/executeForNode`（无 `.execute`），以实际 API 为准。

**实测输出摘要**（exit 0）：
```
[cockatiel] retry 成功：attempts=3 → status=200 body=ok-after-3
[cockatiel·breaker] OPENED（熔断打开）→ call#3/#4 → BrokenCircuitError
[cockatiel] 熔断：初始 state=Closed → 触发=true
[polly-js] retry 成功：attempts=3 → polly-ok-after-3
- 状态：cockatiel + polly-js 真调成功
```

## 3. scripts/color-mix.mjs（colorize → chroma-js）

**调用链**：`createRequire` 直接加载 `chroma-js/dist/chroma.cjs`（package.json 的 require 入口），CLI 接收 base-hex。

**操作**：归一化（rgb/hsl）、`darken/brighten(0.5)`、`set('hsl.h')` 色相偏移、`mix(50% red)`、`chroma.contrast(base,#fff)` WCAG 对比度、`scale().colors(5)` 色板、`luminance()`。

**关键点（诚实记录踩坑）**：chroma-js v3 的 `valid()` 是**静态方法** `chroma.valid(color)` 而非实例属性；`contrast()` 同为静态 `chroma.contrast(a,b)`。probe 实测后按实际 API 修正。

**实测输出摘要**（`node scripts/color-mix.mjs #3b82f6`，exit 0）：
```
- 归一化: #3b82f6 · rgb=(59,130,246) · hsl=(217.22,0.91,0.60,1.00)
- 调暗 darken(0.5): #006cdc  调亮 brighten(0.5): #5e99ff
- 色相偏移 +40°: #713bf6  混色 mix(50% red): #ae68b4
- 对比度 on-white: 3.68:1  ⚠ <4.5:1（WCAG AA 文本需 ≥4.5）
- 色板 scale(blue→red 5 档): #3b82f6 #6873ca #95639d #c25471 #ef4444
```

## 4. 内核接线 diff

三个资产 Execution kernel 段仅改「Invocation」行（colorize 的「实际执行」行一并补 chroma-js）；**段标题、Kernel 行、Degradation 行逐字不变**。

| 资产 | Invocation 变更 | 真调路径 |
|------|----------------|---------|
| vendor/be-provider/be-provider.md | 行首加「真调 `node $SKILL_DIR/scripts/di-container.mjs`（tsyringe CJS + inversify ESM 双容器真实解析 LLM Provider 图）」 | `node scripts/di-container.mjs` |
| vendor/be-resilience/be-resilience.md | 行首加「真调 `node $SKILL_DIR/scripts/resilience-check.mjs`（cockatiel 退避重试 + 熔断、polly-js 等待重试真实执行）」 | `node scripts/resilience-check.mjs` |
| vendor/colorize/SKILL.md | 「实际执行」行补 `node $SKILL_DIR/scripts/color-mix.mjs <base-hex>`（chroma-js）+ 部署清单补 `chroma-js`；Invocation 行加「色彩操作真调 color-mix.mjs」 | `node scripts/color-mix.mjs <base-hex>` |

内核 marker（S3 漂移门词）保持：`tsyringe/InversifyJS`、`cockatiel/Polly`、`culori/chroma-js/poline` 均在非否定 + ACTIVE 行；`probe` 动作词保留。

## 5. COMPETITOR-DEPLOYMENT.md 更新

- 第 2 节库竞品表：chroma-js / tsyringe+@inversifyjs / inversify+reflect-metadata+tslib / cockatiel+polly-js 四行由「⚠️ 已装未接」→「✅ 真调（实测 exit 0）」并标注脚本。
- 第 5 节矩阵：be-provider、be-resilience →「真整合」；colorize 标注 `color-palette.mjs + color-mix.mjs 真算`。
- 第 6 节结论：「可直接顶替」清单补 chroma-js/tsyringe/inversify/cockatiel/polly-js；「已装待接脚本」清空为「无」。

## 6. 回归结果

```
node scripts/validate-structure.mjs → 0 警告，exit 0
node scripts/regression-all.mjs     → 8 PASS / 0 FAIL
  S1 validate-structure        PASS
  S2 test-retry                PASS
  S3 Phase 2 替换清单（漂移门） PASS（be-provider/be-resilience/colorize 均 [vendor OK][kernel 段][probe][marker OK]）
  S4-S8                        PASS
三脚本单测：di-container / resilience-check / color-mix 均 exit 0 且有真实输出。
```

## 7. 诚实声明（不夸大）

- 三个脚本都做了**真实计算/解析**：tsyringe+inversify 双容器真实 resolve 并调用方法；cockatiel 真跑退避重试与熔断事件、polly-js 真跑等待重试；chroma-js 真做全部色彩操作。
- 时间控制：`ExponentialBackoff(initialDelay=2ms)` 与 `waitAndRetry([1,2])` 让指数退避真实生效但总等待为毫秒级，避免脚本秒级空等——重试逻辑本身完全真实。
- 未改动任何第三方库、未装新包；脚本零外部依赖（仅 AI-Hub thirdparty）。
- 已知边界：DI 脚本若两内核均不可用会 exit 1 并打印安装提示（当前实测均可用）；chroma-js 色板对比基于 WCAG 相对亮度（chroma-js 官方口径）。
