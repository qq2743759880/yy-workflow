# T7 编排者独立验收报告（2026-09-20）

验收人：编排者。基线快照 `52ed690`。方法：写入范围核对 → 自报复核 → 执行者自测复跑 →
盲测探针（`blind-probes.mjs`，15 项）→ 独立定性验证 → 回归全量。

## 判定

**T7 = ACCEPTED（附 P1-2 条件 + P2×3）**。接线三部曲（恢复→重建→接线）就此收口。

## 验收证据

1. **写入范围**：6 个白名单产品脚本 + 白名单测试目录 + change record（`plans/active/`+
   `contracts/discrepancies/cr-20260920T112945Z-a6244b0c.json`，CONTRACT，approvalId
   `apr-20260920T104626Z-b3dc0c82`，invalidatedNodes=["S5"]，含 grandfathering）。
   白名单外：`.workbuddy/`（执行者平台工作日志，未申报，P2）、2 个重跑噪声文件、
   `io-audit/out-probe-results.json`（p02 陈旧预期失败，见 P2-2）。
2. **复跑**：S5 自测 19/19、evolve 证明 EXIT=0、io-three-tag 22/22、R3 连跑 16/16×2、
   回归 12/12、validate 0、R10 12/12、其余模块探针全过。
3. **盲测 15/15**：
   - H1 classifyOpenP0 四态（⬜→pending；◐ 无证据→unbacked；◐+落点→inProgress；✅→0）
     ——语义与裁决完全一致
   - H2 OPEN_P0 单点：ci.mjs 薄壳零内联、lib/orchestrator 引用常量（第三次分叉已杜绝）
   - H3 change record 三要素在场（CONTRACT / grandfathering / invalidatedNodes）
   - H4 hook 三分类：buildManifest 23 条全 `system-load`、普通脚本 `consumption`
   - H5 evolve 证明 EXIT=0、仓库根零污染
   - H6 薄壳化确认（4175B）

## 发现登记（P0=0，P1=1，P2=4）

- **P1-2（T7 ②）**：B0 翻默认存在**未申报的错误路径输出形状差异**——legacy 对子进程崩溃
  用 stdio inherit（原始 Node 栈进输出），lib runGate 捕获后输出干净 `[FAIL]`。G2/G3 的
  b0-diff 依赖崩溃栈逐字节相等（含 Node 内部帧行号），执行者 9/9 是同 Node 构建下的
  数字巧合；异构环境必挂（编排者复跑 7/9 复现）。**这正是 A1 验收时登记的"字节一致 ≠
  错误路径一致"应验。** 处置（已裁决）：lib 的干净错误路径**优于** legacy，批准为新声明
  行为——change record 追加 corrigendum；b0-diff 归一化升级为崩溃栈结构性归一
  （node 内部帧 + 栈形状），纳入 T8。
- **P2-1**：`.workbuddy/` 执行者平台工作日志写入仓库根（白名单外、未申报）。T8 移交
  gitignore 或删除。
- **P2-2**：`io-audit/p02` 陈旧预期（子串口径）确认失败——T3 时已预登记的预期行为变更，
  T8 统一到 p07 口径。
- **P2-3**：R5a p16 时间戳脆弱性（执行者已根因定位：夹具紧邻写 state/receipt 跨刻度 →
  computeStale 判 STALE → 不落盘，失败率 ≈40%）——T8 去时间戳加固。

## 执行者自报诚实度

对本批最亮眼的是 **15/16 波动的诚实撤回**（"取证方式 tail 截断 + 结果被覆盖，不做
已确证消除的断言"）并补建只追加历史通道（out-probe-history.jsonl）——完全符合 C-01
"不采信报告"精神。R5a p16 根因链（机验到 journey.mjs:512/:44 双行号 + 20 次样本复现器）
质量极高。

## 交由编排者裁决的 4 项 — 已裁决

1. **R5a p16 / R3 时间依赖统一加固**：✅ 批准，纳入 T8（授权写 R5a 目录）
2. **io-audit/p02**：✅ 统一到 p07 口径（p02 是陈旧预期），纳入 T8
3. **runner cwd 统一**：✅ 统一为模块 URL 定位（import.meta.url），纳入 T8
4. **CI 检查点纪律升格**：✅ 已由编排者成文 `plans/ci-checkpoint-discipline-20260920.md`
