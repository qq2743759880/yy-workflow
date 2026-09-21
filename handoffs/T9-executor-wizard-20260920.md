# T9 派单 — executor-setup 向导（P2 重设计施工）

你是本任务的独立执行 agent。工作区：`D:\.ai-hub\skills\yy`（Windows，Node v24，零 npm 依赖）。
按 `plans/next-phase-plan-20260920.md` T9 节施工。**验收探针你不可见。**

## 必读

1. `plans/next-phase-plan-20260920.md` T9 节（10 条设计决定 = 你的施工规格）
2. `plans/wiring-and-audit-plan-20260920.md` P2 节（10 条批判——本批就是吸收它们）
3. `scripts/exec-host-probe.mjs`（探测底座，只读参考/可调用）
4. `scripts/summary-read.mjs`（回填校验模式的落点，只读参考）
5. `scripts/lib/store.mjs` 的 `withLock`（config 写锁）
6. `scripts/lib/evolution.mjs`（风格基准：ESM/中文注释/fail-closed）

## 交付物

1. `scripts/executor-setup.mjs` — 向导 CLI：
   - `--probe presence`：探测 opencode/claude/codex/cursor/trae/openclaw 的存在性 + 非交互
     形态（PATH 探测，Windows 用 where，不做任何管理员/特权操作）
   - `--probe roundtrip`：对候选 CLI 真实喂"回复 OK"brief（沿 exec-host-generic 的 stdin
     形态，60s 超时，沙箱 cwd），presence 与 roundtrip **分档标注**，禁止把存在性说成可用
   - `--non-interactive`：从 flags 或 `<workspace>/.tt-state/executor.json` 读取选择；
     缺信息时 exit 2 + 指引（不猜）
   - 交互模式：三选一（B 本机 CLI 子代理【默认高亮】/ A 编排者直执行【标注"违反 C-01
     独立验收纪律，仅限非验收任务"】/ C 手动交接）；选 B 时输出该 CLI 的配置方法论
     指引（见 2）+ 自检命令；选 C 时按 schema 生成 brief 骨架
   - 选择持久化：`<workspace>/.tt-state/executor.json`（withLock 写；含 cli/模型偏好/
     isolate 预留字段）；读取顺序：`--executor` 显式 > executor.json > 交互询问
   - 交接模式 schema：brief 落 `artifacts/<planId>/briefs/<taskId>.md`，回填报告约定
     `artifacts/<planId>/reports/<taskId>/REPORT.md`
2. `docs/executor-setup/claude.md`、`codex.md`、`通用.md` — 配置方法论指引：头部带
   "生成日期 + 针对 CLI 版本"字段；只给步骤与自检命令，**绝不读取/写入任何凭据文件**
3. `scripts/summary-read.mjs` — **仅追加**一个回填校验模式（如 `--validate-handoff <dir>`）：
   校验回填报告的必需字段（taskId/taskVerdict/evidencePaths），缺字段 FAIL 不猜；
   既有功能零改动
4. 自测目录 `test-reports/rebuild-20260920/T9-wizard/`：探针覆盖——presence 分档、
   roundtrip 超时与成功路径（mock CLI 脚本）、non-interactive 缺信息 fail-closed、
   executor.json withLock 并发写、交接 schema 校验（缺字段拒绝）、中文/空格路径、
   配置指引文档的版本字段存在性。RESULTS.md：自测输出原样 + 偏差申报

## 允许写入（白名单）

`scripts/executor-setup.mjs`、`docs/executor-setup/`（新目录）、`scripts/summary-read.mjs`
（仅追加校验模式）、`test-reports/rebuild-20260920/T9-wizard/`。**其余一律禁止**
（含 exec-host-*.mjs、adapters/、orchestrator.mjs）。禁止 git 操作。

## 纪律

零 npm；ESM；中文注释；fail-closed；不编造探测结论（存在性≠可用性分档呈现）；
roundtrip 探测的 brief 内容必须是良性的"回复 OK"，禁止探测时执行任何仓库代码。

## STOP 条件

roundtrip 探测无法在不写宿主配置文件/不读凭据的前提下实现；summary-read 无法只追加
校验模式。触发即停，报告事实。
