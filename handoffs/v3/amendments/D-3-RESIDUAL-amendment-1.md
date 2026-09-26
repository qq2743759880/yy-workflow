# Amendment D-3-RESIDUAL-amendment-1 — D-3 写面越界正式追认单（REMEDIATION-2 第十四审计 F-029 处置）

> 单据类型：amendment（写面越界追认）｜签发方：**编排者（本单由编排者签发）**｜签发日期：2026-09-26
> 触发审计项：第十四审计 F-029（REMEDIATION-2 派单任务二）
> 生效面：仅覆盖 D-3-RESIDUAL 对 `scripts/regression-all.mjs` 的越界改动——**不覆盖 HARDEN-1 的 S16 段**（S16 系 HARDEN-1 派单白名单内合法写面，无需追认）。

## 一、越界事实

| 项 | 内容 |
|---|---|
| 任务单 | `handoffs/v3/D-3-RESIDUAL-dispatch.md`（drop 7 残留面 17 文件分类清理） |
| 越界文件 | `scripts/regression-all.mjs` |
| 越界认定依据 | D-3 派单白名单未列 regression-all.mjs，且其「禁止」条款明列 **HARDEN-1 写面（regression-all/audit-index/FINAL-E2E 文档）零触碰**——D-3 改动该文件构成写面越界；agent 在其 RESULTS.md 偏差 R-1 的自解释（"名单收缩是处置项本身"）不构成授权 |
| 入库 commit | 815da11（编排者 dispatch 引用；L1 禁 git，git 收口归编排者核对） |
| 执行方自登记 | `test-reports/autopilot-work/D-3-RESIDUAL/RESULTS.md` 偏差 R-1（"登记待 L2"）+ R-4（扫描计数 169→164 系 5 孤儿脚本删除后扫描面自然缩小，非排除面变化） |

## 二、越界改动 diff 摘要（仅两处，断言逻辑零变化）

1. **S15-A1 登记残留面名单收缩**：`A1_REGISTERED_RESIDUALS` 由 D-3 前的 17 文件登记收缩为类 C 豁免两项（`contracts/asset-manifest-v2.md`、`contracts/C-R3-review-checklist.md`）；
2. **S15-A1 猎手名单自命中显式豁免**：S15 断言自身持有 `DROPPED_ASSETS` 常量（猎手名单），自命中不再计入违规，输出具名"猎手名单≠资产引用"；同段落头注去除 drop 名单重抄，指向权威 change.record（cr-20260925T102900Z-as1-drop7）。

断言本体（A1 全仓扫描逻辑、S15-A2..A6、S1-S14、S16 零改动——S16 当时尚不存在，属 HARDEN-1 后续合法新增）。

## 三、追认理由（编排者裁定）

1. **处置项自身必需**：D-3 的处置对象就是 S15-A1 登记的 17 文件残留面；清理完成后若名单不收缩，S15-A1 将把"已正确清理"误报为残留——名单收缩是该处置项成立的必要组成，漏列 regression-all.mjs 属 D-3 派单白名单自身的疏漏（17 文件清单本身含该文件，见偏差 R-1）。
2. **断言逻辑零变化**：改动仅限豁免名单常量与头注两处；S15-A1 扫描与判定逻辑、其余各段零触碰。D-3 后复跑 S15-A1 缩短且 PASS（RESULTS.md §二），机器可复核。
3. **编排者已亲验**：追认前编排者 L2 层面复跑整机回归 **22 PASS / 0 FAIL**（含 S15-A1、S16-1/S16-2），preflight 8 PASS、validate 0 警告；diff 归属核查确认 regression-all.mjs 改动不超出本单 §二所列两处。
4. 追认而非回滚：回滚名单将使 S15-A1 重新误报已清理文件，制造假 FAIL——不符合任何一方的判定基准。

## 四、今后同类情况的程序纪律（自本单签发起生效）

任何 L1 执行 agent 认定"派单白名单遗漏了处置项自身必需的写面"时，**必须先停止对该文件的改动，向编排者申请 amendment（写明文件+必要性+最小 diff 预估），获编排者签发后再动刀**；agent 自解释、RESULTS 偏差登记、"处置项必需"推断均不构成授权。越界既成事实的，编排者按本单格式补立追认或责令回滚，两者必居其一，不得默认放行。

## 五、关联单据

- 触发处置：`handoffs/v3/REMEDIATION-2-dispatch.md` 任务 F-029
- 越界证据：`test-reports/autopilot-work/D-3-RESIDUAL/RESULTS.md`（偏差 R-1/R-4 + §一逐文件表第 17 行）
- 权威名单：`contracts/discrepancies/cr-20260925T102900Z-as1-drop7.json`（drop 逐资产清单）
- 同文件合法写面（本单不涉及）：HARDEN-1 S16 段（`handoffs/v3/HARDEN-1-dispatch.md` 白名单内）；REMEDIATION-2 S16 重做段（`handoffs/v3/REMEDIATION-2-dispatch.md` 白名单内）

—— 编排者签发（autopilot 管线编排者，2026-09-26）
