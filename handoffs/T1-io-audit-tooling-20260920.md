# T1 派单 — IO 口径调用率审计工具（P1-A+B）

你是本任务的独立执行 agent。工作区：`D:\.ai-hub\skills\yy`（Windows，Node v24，零 npm 依赖）。
编排者不参与实现；完工后由独立编排者按盲测协议验收——**验收探针你不可见，自测 PASS 不构成验收依据**。

## 必读规格（唯一事实源，先读再动工）

1. `plans/wiring-and-audit-plan-20260920.md` 的 P1 节（交付物定义）
2. `scripts/lib/evolution.mjs`（代码风格基准：ESM、node 内置、中文注释、fail-closed、`[待补充]` 不编造）
3. `scripts/matrix.mjs`（routing 侧调用方，理解 caller 归类对象）
4. `SKILL.md`（vendor/ 16 资产结构）

## 交付物（三个新文件 + 自测目录）

1. `scripts/lib/io-audit-hook.mjs` — Node `--import` 预载审计钩子：
   - 包装 `fs.readFileSync` / `fs.promises.readFile` / `fs.createReadStream` / `fs.readdir`（含 promises 版）
   - 路径规范化：`path.resolve` + win32 大小写不敏感 + 正反斜杠统一，再匹配 `<repo>/vendor/` 前缀
   - caller 归类：调用栈含 `matrix.mjs|asset-call-rate|ci.mjs|io-audit` → `tag=routing`，其余 `tag=consumption`
   - 记录追加 JSONL：`{ts, pid, cwd, op, path, tag}`；单文件 >5MB 滚动保留一个 `.1` 副本
   - 作用域防护：仅当进程 cwd 位于 yy 仓库内才记录（防 NODE_OPTIONS 泄漏到无关进程）
   - 输出目录默认 `.tt-state/io-audit/`，可用环境变量 `YY_IO_AUDIT_DIR` 覆盖
   - Node 兼容：优先 `module.registerHooks()`；不可用回退 `module.register()`；两者皆无 → 按 STOP 处理
2. `scripts/asset-io-report.mjs` — 聚合 CLI：输入一个或多个 JSONL → 输出
   每资产计数（routing/consumption 分列）、"阶段×资产"矩阵（读 `.tt-state/journey.json` 时间线对齐，
   journey 不存在时整表标 `stage=unknown` 并以 warning 声明，不猜）、16 资产零调用清单；
   报告写 `test-reports/<label>/REPORT.md`（label 为必填参数）
3. `scripts/asset-io-transcript.mjs` — agent 侧采集：输入 ZCode db 路径或 codex sessions 目录，
   挖掘**读取动作**（Read 工具调用 / shell 读命令的目标路径），仅统计目标在 `vendor/` 下的，
   **排除 manifest 扫描输出**（一屏罗列全部资产路径的输出不算读取），输出与 hook 同格式 JSONL
4. 自测目录 `test-reports/rebuild-20260920/io-audit/`：自测脚本（子进程 spawn 注入 hook 演示
   vendor 读取被捕获且 routing/consumption 归类正确；report 对合成 JSONL 出正确矩阵；
   transcript 工具对你自造的 fixture 转录文件出正确结果）+ `RESULTS.md`（自测输出原样 + 偏差声明）。
   沙箱写入限本目录 `.sandbox/`

## 允许写入（白名单，多一个即违规）

上述 4 项新文件/目录。**禁止**修改任何既有文件；禁止 `git add/commit/push`；禁止读
`test-reports/acceptance-*/`；禁止在仓库外写任何文件。

## 纪律

零 npm 依赖；ESM；中文注释；fail-closed（输入缺失/畸形即报错退出，不静默）；`[待补充]` 保持；
不编造阈值；Windows 路径含中文/空格必须实测可用（自测覆盖一条中文路径）。

## STOP 条件

Node v24 无任何可用 hook API；或需要 npm 依赖才能实现；或必须修改既有文件才能工作。
触发即停，REPORT.md 写明原因与已探明的事实。
