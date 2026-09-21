# FE-1 探针记录（PROBES）

执行方式：`node test-reports/autopilot-work/FE-1/probe.js`（零依赖，L2 可直接重跑）。汇总输出见 probe-output.txt（57 passed, 0 failed）。

## PROBE1 视图模型消费面（render-core 只消费不改）
- 输入：mock payload `{read:{ok:true,data:{journey:{displayStatus:'OBSERVED',phase:'并行派单',nextPrompt:{...},steps:[9 行]}}},project:{ok:true},injectedAt,sessionId}`
- 断言：degraded=false；steps.length=9（mapStep 归一化）；nextPrompt.actionHint/snapshotHash 透传；conflict=null（健康时告警条应隐藏）→ PASS

## PROBE2 mapStep / 负态不变量
- `mapStep({status:'in_progress'})` → OBSERVED，negative=false → PASS
- `mapStep(null)` → display=ERROR（畸形行不伪造成功）→ PASS
- `isNegativeDisplay('FAILED','failed')=true`；NEGATIVE_STATES=['FAILED','SKIPPED','UNRESOLVED'] 永不渲染为成功 → PASS
- DISPLAY_STATES 六态词表一致 → PASS

## PROBE3 冲突 / 降级 / NOT_FOUND 通道
- `project={ok:false,code:'PROJECTION_CONFLICT',data:{projection:{displayReason},conflicts:[2 条]}}` → conflictView 返回两侧证据 + displayReason → PASS
- `deriveJourneyView(null)` → degraded=true + bridgeReason → PASS；`{read:{}}`（缺 ok 布尔）→ degraded（非统一壳）→ PASS
- `read={ok:false,code:'JOURNEY_NOT_FOUND'}` → notFound=true 且 degraded=false（data 通道非 overlay，C-R5-journey §8.1）→ PASS

## PROBE4 index.html 结构断言
- 动态 `import('./render-core.mjs')`；消费 `window.__YY_JOURNEY__` 与 deriveJourneyView/mapStep/nextPromptView/conflictView → PASS
- 告警条：`id="alert-banner" role="alert" hidden`（初始隐藏，健康时不显示）→ PASS
- NODE_META 九节点 0-8 全在；徽章 `state-' + s.display` 六态消费 → PASS
- gate 卡三要素：`gate: <名>`（或「gate: 无（回跳层）」）/ 看：… / 说：… → PASS
- 复制按钮占位（clipboard API + 失败反馈文案，role=status aria-live=polite）→ PASS
- 零运行时依赖：无 `<script src>`、无 CDN URL → PASS；stylesheet 仅 `./styles.css` → PASS
- 无 emoji 字符；无 em-dash（—/–）→ PASS
- 状态语义不靠颜色单独传义：徽章文案 = 中文名 + 状态码（如「失败 · FAILED」）→ PASS

## PROBE5 styles.css 铁律断言
- 语义色 token：全部 hex 收敛于 `:root` token 定义区（含 dark 覆写块），组件选择器零裸 hex → PASS
- `@media (prefers-color-scheme: dark)` 双主题 → PASS
- `@media (prefers-reduced-motion: reduce)` 全局兜底 → PASS
- `.copy-button` min-height/min-width 44px → PASS
- 显式 grid 轨道：`repeat(auto-fill, var(--grid-track))` + `--grid-track: minmax(220px,1fr)` → PASS
- `:focus-visible` 焦点环保留，无 `outline: none` → PASS
- 零装饰：无 box-shadow / gradient / @keyframes / transition 堆砌 → PASS
- 直角系统：唯一 `border-radius: 0`，无圆角堆砌 → PASS
- 字阶对比：display 2.25rem vs micro 0.75rem（3 级差，>=2 级要求）→ PASS
- 无 CDN `@import` → PASS

## PROBE6 对比度机验（WCAG 相对亮度公式，20 对全量）
- 浅色：fg/bg 17.40、muted/bg 7.00、authorized 6.39、observed 6.85、inferred 6.02、stale 6.49、partial 8.11、error 6.68、accent/bg 6.39、alert 17.40 → 全 >=4.5 PASS
- 深色：fg/bg 16.87、muted/bg 7.94、authorized 6.66、observed 7.82、inferred 9.91、stale 8.27、partial 9.54、error 8.79、accent/bg 8.96、alert 16.87 → 全 >=4.5 PASS

## PROBE7 host-bridge 组合面（只消费不改）
- `buildPageHtml({workspace})` 真实跑 tt-journey CLI：注入标签 `<script>window.__YY_JOURNEY__…` 位于页面脚本之前（OQ-U-17=a 排序保证）→ PASS
- 载荷四键 read/project/injectedAt/sessionId 齐全 → PASS
- 当前 workspace 真实数据为 JOURNEY_NOT_FOUND（data 通道），页面 notFound 分支可消费其 reason/initGuidance → PASS
- 冻结锚复核：render-core.mjs = 93a7652b…、host-bridge.mjs = b02cfd65…（逐字节未动）

## 未覆盖（如实登记）
- 浏览器截图：本环境 browser-use 在 subagent 不可用（"Browser is not available in subagent"）、无 jsdom。以 DOM 消费面静态断言 + host-bridge 组合探针替代；真实渲染截图归 FE-3 web-gui-tester 盲测。
- 双主题截图路径：无（理由同上）；主题正确性以 prefers-color-scheme 媒体查询与双主题 20 对对比度机验为证据。
