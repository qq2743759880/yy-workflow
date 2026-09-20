# T8 派单 — 测试资产加固批（R5a p16 去时间戳 / io-audit p02 对齐 / runner cwd 统一 / b0-diff 崩溃栈归一 / corrigendum）

你是本任务的独立执行 agent。工作区：`D:\.ai-hub\skills\yy`。这是编排者批准的测试资产
加固批（含 T7 验收的 P1-2 处置落地）。**验收探针你不可见。**

## 必读

1. `test-reports/acceptance-20260920/T7/REPORT.md`（P1-2 处置裁决 + P2 登记）
2. `test-reports/rebuild-20260920/T7-closeout/RESULTS.md`（R5a p16 根因链与复现器位置）
3. `plans/ci-checkpoint-discipline-20260920.md`（纪律成文，只读参照）

## 施工项

1. **R5a p16 去时间戳加固**（授权写 `test-reports/rebuild-20260920/R5a-journey/`）：
   夹具的 state.json/receipt.json 写入用固定 `--now`/mtime 注入消除紧邻写跨刻度问题
   （沿 R3 加固模式：固定 now + 双层沙箱）；修后 10 连跑全 16/16 作证据
2. **io-audit p02 对齐**（授权写 `test-reports/rebuild-20260920/io-audit/probes/p02-*.mjs`）：
   p02 的 fake-matrix 期望从"子串→routing"改为 basename 边界口径（对齐 p07：
   `fake-matrix.mjs`→consumption；真 `matrix.mjs`→routing）；全套 p01-p08 + run-p07p08 重跑全绿
3. **runner cwd 统一**：`T6-wiring-b4b8/run-probes.mjs`（及扫描发现的其他 cwd 依赖 runner）
   改模块 URL 定位（`fileURLToPath(new URL(...))`），从任意目录可跑
4. **b0-diff 崩溃栈结构归一**（P1-2 处置，授权写 `test-reports/rebuild-20260920/T4-wiring-b0b3/b0-diff.mjs`
   与 `snapshots/`）：normalize 升级——Node 内部帧（`node:*:\d+`、`cjs/loader:\d+`）与崩溃栈
   形状（有无栈段）结构化归一；G2/G3 在异构 Node 构建下可复现 PASS；DECLARED_DELTAS
   保留并补记 S1/S3 崩溃路径"干净捕获为新声明行为"
5. **change record corrigendum**：`contracts/discrepancies/cr-20260920T112945Z-a6244b0c.json`
   **追加**（不改动既有字段）corrigendum 条目：登记 P1-2 处置（S1/S3 错误路径干净捕获批准为
   新声明行为）；若格式只许 JSON 字段追加，用 `corrigenda: []` 数组追加
6. **.workbuddy/ 清理**：删除（执行者平台日志不入库；平台如需留存自行移出仓库）

## 允许写入（白名单）

`test-reports/rebuild-20260920/{R5a-journey,io-audit,T6-wiring-b4b8,T4-wiring-b0b3,T7-closeout(仅 corrigendum 涉及的 contracts/discrepancies 下文件另计)}/`、
`contracts/discrepancies/cr-20260920T112945Z-a6244b0c.json`（仅追加 corrigenda）、`.workbuddy/`（删除）。
新增自测目录 `test-reports/rebuild-20260920/T8-hardening/`。**其余一律禁止**（含所有产品脚本）。禁止 git 操作。

## 总门

全仓库测试资产一次全绿：regression 12/12 + validate 0 + R10 12/12 + 六模块探针
（R3 16/16、R5a 16/16×10、R4/R7/R8、T6 21/21 从非仓库根目录跑）+ io-audit p01-p08 全绿 +
b0-diff 9/9。RESULTS.md：每项加固前后对比 + 偏差申报。

## STOP 条件

R5a p16 加固需要改 journey.mjs 产品代码；b0-diff 结构归一后仍无法在异构环境稳定 PASS
（说明存在未申报的真实行为差异）。触发即停，报告事实。
