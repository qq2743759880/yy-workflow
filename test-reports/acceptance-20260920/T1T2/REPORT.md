# T1/T2 编排者独立验收报告（2026-09-20）

验收人：编排者（本会话）。基线快照 `57b5668`。方法：写入范围核对 → 自报复核 → 盲测探针
（`blind-probes.mjs`，验收时刻编写，执行者不可见）→ 回归全量 → 规格溯源抽查。

## 判定

| 任务 | 判定 | 附条件 |
|---|---|---|
| T1（IO 审计工具） | **ACCEPTED** | P2-1、P2-2 登记，P2-1 须在 B8 基线复跑前修复（或 Owner 书面接受偏差） |
| T2（A0/A1/A2 抽取） | **ACCEPTED** | P2-3 须在 B0/B7 CLI 壳施工时处理 |

## 验收证据

1. **写入范围**：`git diff 57b5668` 为空（零既有文件改动）；新增 6 文件 + 4 自测目录，
   与两份派单白名单逐一比对无越界
2. **复跑**：执行者探针全过（T1 6/6、A1 22/22、A2 16/16、A0 CLI exit 0）
3. **盲测探针 13/13 PASS**，含反走捷径假设检验：
   - H1 全新子进程 promises.readFile 捕获 ✅（tag/op 字段真实）
   - H2 伪造 `callermatrix.mjs` 文件名 → **复现误判 routing**（P2-1）
   - H3 畸形 JSONL fail-closed ✅（exit 2）
   - H4 manifest 罗列块排除、真读取恰计 1 条 ✅
   - H5 全新输入差分（合法 + 跨 lane 错误路径）退出码与 stdout 逐字节一致 ✅
   - 合成数据聚合：frontend-design consumption=2、零调用清单恰 14 条 ✅
   - 作用域防护：仓库外进程零记录 ✅
4. **回归面**：regression-all 12/12；validate-structure 0 警告；既有 80 探针全 PASS
5. **规格溯源抽查（≥5）**：① A1 S5 门忠实于 ci.mjs 源（仅检 ⬜，L85 对照一致）；
   ② A2 lib 无 process.exit/console（仅注释提及）；③ A0 冲突边 runtime.mjs:4→adapters/index.mjs
   属实（亲自 grep）；④ report 聚合用 lib/evolution.mjs 的 ASSET_WHITELIST（16 资产单一事实源）；
   ⑤ 滚动阈值 5MB 与规格一致（YY_IO_AUDIT_MAX_BYTES 仅自测用）

## 发现登记（P0=0，P1=0，P2=4）

- **P2-1（T1）**：routing 归类按调用栈**子串**匹配（`matrix.mjs|asset-call-rate|ci.mjs|io-audit`），
  `callermatrix.mjs` / `official-ci.mjs` 类路径会被误判 routing，污染 routing/consumption 比值。
  修法：按路径段边界匹配（如 `/[\\\\\/]matrix\.mjs$/` 或 basename 精确比对）。B8 基线前必须修。
- **P2-2（T1）**：JSONL 存储的 path 做了大小写折叠（`SKILL.md`→`skill.md`），非原文。
  溯源时需注意；建议存原文 + 匹配时折叠。
- **P2-3（T2-A2）**：lib stdout 比真实 CLI 少一个尾随换行（802B vs 801B，trim 后一致）。
  B0/B7 组装 CLI 壳时必须补齐，否则差分验收会假失败。
- **P2-4（上游既存，非本任务引入）**：ci.mjs 的 S5 只检 `⬜`，orchestrator 的 backlogIsPending
  检 `⬜◐`——两处口径不一致。接线后若共享 lib 需 Owner 裁决统一口径。

## 方案修正（A0 的价值交付）

A0 发现接线序冲突：`lib/runtime.mjs` 直接 import `lib/adapters/index.mjs`，与"B5 在 B6 前"矛盾。
**采纳其缓解建议**：B5 施工时对 adapter resolver 做依赖注入（不把 B6 提前，保持 state/store 先行的
兼容层序）。已写入施工方案的执行注意事项。

## 执行者自报诚实度

T1 报告主动申报 9 条偏差（Node v22 实测、matrix.mjs 实际在 lib/ 下、readdirSync 增量覆盖、
自帧剔除等）——抽查全部属实，按"如实申报从宽"原则认可。A1/A2 的"未抽取部分"清单与
实际代码位置核对一致。
