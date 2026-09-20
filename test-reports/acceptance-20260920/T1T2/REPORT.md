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

## 本轮修了什么（2026-09-20，T3 返工 P2-1/P2-2）

**改动文件**：仅 `scripts/lib/io-audit-hook.mjs`（T1 三脚本之一）。新增自测探针两个。

### P2-1：routing 子串误判 → 路径段边界精确匹配

- **旧**：`ROUTING_RE = /(matrix\.mjs|asset-call-rate|ci\.mjs|io-audit)/` 子串匹配，
  `callermatrix.mjs`（含 `matrix.mjs` 子串）、`official-ci.mjs`（含 `ci.mjs` 子串）被误判 routing。
- **新**：改为 `ROUTING_BASENAMES = Set{matrix.mjs, asset-call-rate.mjs, ci.mjs, io-audit-hook.mjs}`。
  `classifyTag()` 逐行扫描调用栈，先剔除本钩子自身帧（`io-audit-hook.mjs`），再用正则
  `FILE_REF_RE` 提取每行中的文件路径引用，去掉 `:line:col` 和 `file://` 前缀后取 basename
  （按 `/` `\` 切分取最后一段），与 Set 做精确比对。自帧剔除逻辑保留不变。
- **效果**：`callermatrix.mjs` / `official-ci.mjs` → consumption；真 `matrix.mjs` / `ci.mjs` /
  `asset-call-rate.mjs` → routing。盲测 H2 复现场景（bp3）不再误判。

### P2-2：JSONL path 存原文（不折叠大小写）

- **旧**：`record()` 调 `normalizePath(p)`（含 `.toLowerCase()`）后存入 `path` 字段，
  `SKILL.md` 落盘成 `skill.md`。
- **新**：`record()` 现在 `path.resolve(p).replace(/\\/g,'/')` 得到 `resolved`（保留原始大小写），
  另算 `norm = resolved.toLowerCase()` 仅传给 `isUnderVendor(norm)` 做 vendor 前缀判定。
  落盘 `path` 字段存 `resolved`（原文大小写）。`normalizePath()` 导出函数本身不变（仍折叠），
  供 `isUnderVendor` / `extractAsset` / `cwdInRepo` 内部前缀匹配使用。
- **效果**：`SKILL.md` 大写保留；即使 caller 传入大写 `VENDOR/` 路径，折叠后仍正确判定在 vendor 下，
  落盘保留 caller 原始大小写。report 侧 `assetOf()` 按 `/vendor/` 段取第一段资产 id，
  不受文件名大小写影响（实际 vendor 目录名均为小写）。

### 新增自测探针（test-reports/rebuild-20260920/io-audit/probes/）

- `p07-basename-boundary.mjs`：分别以 `callermatrix.mjs` / `official-ci.mjs` / `matrix.mjs`
  为子脚本名读 vendor 文件，验证 tag = consumption / consumption / routing。**PASS**。
- `p08-path-original-case.mjs`：读 `vendor/colorize/SKILL.md` 验证落盘 path 含大写 `SKILL.md`；
  另传大写 `VENDOR/` 绝对路径验证前缀折叠仍记录、落盘保留 `VENDOR` 大写。**PASS**。
- 运行器：`run-p07p08.mjs`（TOTAL 2/2 PASS）。既有 p01（hook 捕获）、p03（路径规范化纯函数）
  复跑仍 PASS。旧 p02 探针未改（其 `fake-matrix.mjs` 依赖子串匹配行为，现已正确归 consumption——
  这是 P2-1 修复的预期行为变更，非回归）。
