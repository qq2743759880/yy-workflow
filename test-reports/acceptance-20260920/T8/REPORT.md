# T8 编排者独立验收报告（2026-09-20）— 三部曲收口

验收人：编排者。基线快照 `7f1614f`。方法：写入范围核对 → 自报复核 → 全套件复跑 →
盲检（corrigendum append-only / p04 保留 / cwd 独立性）→ 回归全量。

## 判定

**T8 = ACCEPTED。** 恢复→重建→接线三部曲全部收口。

## 验收证据

1. **写入范围**：全部落在白名单（R5a/io-audit/T6/T4 测试目录、cr json 仅追加、
   `.workbuddy/` 删除）+ T8-hardening 目录 + 2 个重跑噪声文件。**产品脚本零改动**。
2. **复跑（编排者亲测）**：R5a 16/16 ×3（加固后）；io-audit 6/6（p02 已对齐）；R3 16/16；
   **b0-diff 9/9**（结构归一后）；**T6 21/21 从 /tmp 运行**（cwd 独立性实证）；
   regression 12/12；validate 0。
3. **盲检**：
   - corrigendum `cor-20260920T165601Z-p1-2-b0-error-path` 追加在场（append-only 声明与
     文件内容核对一致）
   - p04 的故意错时 `utimesSync` 保留（加固未抹平被测行为）✓
   - R5a 根因量化：加固前失败率 65%（20 样本）→ 加固后 0%
4. **六施工项**：① p16 去时间戳（writeFixed/utimesSync，p04 语义性错时保留）✓
   ② p02 对齐 basename 口径 ✓ ③ T6 runner cwd 独立 ✓ ④ b0-diff 结构归一（P1-2 落地，
   7 类异构变异自测 26/26）✓ ⑤ corrigendum 追加 ✓ ⑥ .workbuddy 清理（内容隔离保存）✓

## 编排者自身流程的 P0（本批发现并当场修复）

**`contracts/` 自 fork 基线起被 .gitignore 静默排除**——TT 2.9.1 遗留行导致全部冻结契约、
草案、变更记录**从未真正进入 git/GitHub**（`git ls-files contracts/` = 0）。编排者在
T1-T7 验收中的"契约已入库已推送"结论为错误陈述（`git add -A` 被 ignore 静默跳过）。
修复：commit `cc83439` 移除 ignore 行 + 补录 25 个契约文件 + 远端验证
（`git show origin/main:contracts/C-R3-activation.md` ✓）+ `.workbuddy/` 加入 ignore。
**教训入册**：写时序验收不能只看 `git status/diff`——必须对"声称已入库"的核心资产做
`git ls-files` 存在性断言；备份验证必须以远端对象为准，不以本地 commit 为准。

## 三部曲终态

| 阶段 | 结果 |
|---|---|
| 恢复（9-19~9-20） | 真仓找回（17 commits）+ 幸存副本回填 + 转录挖掘层 |
| 重建（9-20 凌晨） | 7 运行时模块行为级重建，探针 80/80 |
| 接线（9-20） | B0-B8 全部接线 + S5 严格口径统一 + B0 翻默认 + IO 审计三分类 |

**遗留（全部登记在案，均为可选后续）**：executor-setup 向导（P2 重设计方案已备）、
`--isolate-codex`（10 条遗留清单已备）、R5b/R9/R6 未实施（原路线图未完成项，R6 仍被
Owner 级 C2 决断阻塞）、io-baseline 正式对照（P1-D，需新 taxonomy 下重跑基线）。
