# FE-4 派单 — 交付收口（README + release 刷新 + 部署验证）

你是本任务的独立执行 agent（autopilot 管线 L1，写面区 A）。工作区：`D:\.ai-hub\skills\yy`。
完成后交付证据，不自称 DONE。

## 前置事实
- webview/journey/ 终态：index.html=ce2056ed（REWORK-1 修复后）、styles.css=a0bb1f67、render-core.mjs=93a7652b、host-bridge.mjs=b02cfd65、content.js=6ee80007
- FE-3 复测进行中（另一 agent 只读）；你只改 README，不碰 index.html

## 交付物（白名单，仅 2 处）
1. `webview/journey/README.md` 更新：新页面架构（三区块 A/B/C + loadGuideContent 动态装载 + 注入契约说明 + 瑞士风格设计语言一段 + 复制按钮语义）+ 与旧版 README 的差异段
2. 发布目录刷新与验证（**不做 mklink、不动 git**）：
   - `robocopy D:\.ai-hub\skills\yy D:\.ai-hub\tmp\yy-release /E /XD recovery-20260919 test-reports plans handoffs .git .mimosa .workbuddy .learnings .sandbox node_modules /XF .memory ACCEPTANCE.md CHANGELOG.md`
   - 删除发布目录内 `reference/memory-and-sync.md`、`scripts/sync.mjs`、`contracts/`、`docs/history/`（purge 纪律）
   - 泄露审计：`rg -l "盲测|盲行|blindwalk|acceptance-20260920|rebuild-20260920|恢复层|误删"` 发布目录 → 必须零命中（CI 注释类 rebuild 字样按协议豁免，其余命中即列出）
   - junction 冒烟：`node C:/Users/Administrator/.agents/skills/yy/scripts/tt-journey.mjs --workspace . ` 输出非空
3. 自测 `test-reports/autopilot-work/FE-4/RESULTS.md`：每步输出原样 + D-xxx 偏差

## 禁止
改 index.html/styles.css/render-core/host-bridge/content.js、contracts/、plans/、队列/看板；
读 test-reports/acceptance-*/；git add/commit/push；mklink/管理员操作。

