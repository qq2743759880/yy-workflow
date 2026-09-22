# BFX-C RESULTS（BW 盲行批次动态修复槽 · 文档面）

日期：2026-09-22　执行：L1 独立 agent（autopilot 管线）　工作区：`D:\.ai-hub\skills\yy`

## 1. 交付范围（白名单内：SKILL.md + reference/ 既有文件，零新建）

### BFX-3（P1）owner 缺席纪律落档
- `reference/dispatch-and-acceptance.md`：新增 **§5.7 Owner 缺席代推进纪律（escape hatch）**，四条与四盲行者实测收敛口径逐条对齐：
  1. 决策点问一次（不复述等待）；无响应 → 取保守推荐默认值推进。
  2. 代签决策标注 `[待确认 owner]`；gate 记「代推进」，不冒充 owner 签收（不写 APPROVED）。
  3. 白话版补审页（概念/前提 plain 版）留给 owner，恢复在场后补审。
  4. 冻结契约变更不走代签，登记变更单待 Owner 批；唯一例外：向后兼容且不违约的数据正确性修复可先行并留痕待追认。
- `SKILL.md` L23 注入纪律段尾追加指针：**Owner 缺席**：按代推进纪律执行（见 `reference/dispatch-and-acceptance.md` §5.7）。悬空引用已闭环。

### BFX-4（首跑鸡生蛋）文档侧
- `SKILL.md` L23 同段追加：**首跑**：journey 未初始化不阻塞——`--prereq-check` 自动初始化基线（AUTO-INIT，幂等），直接按索引跑即可。

### P2（顺手）无 UI 项目 gate 口径
- `reference/frontend-gate.md`：新增 **§6.7 无 UI 项目：gate 词汇替代口径**——可运行产物 + 实跑证据替代 gate-a-approved，journey 照常落账（gate 字段如实命名，不冒用 `HTML_APPROVED`），双 gate 退化为一层客观机验。

## 2. D-xxx 偏差登记

- **D-1（任务简报与现状偏差）**：简报称"SKILL.md 现有'owner 缺席时按既定纪律处理'悬空引用"。实测 grep（`缺席|既定纪律`）当前 SKILL.md 与 reference/ 均**无**该短语——处置：不删（无物可删），按悬空引用的修复意图直接补建指针行 + 落点条文，语义等价达成"提及缺席纪律处必有落点指向"。
- **D-2（脚本行为确认，非偏差）**：落笔前实测 `tt-journey.mjs --prereq-check --step 1`（临时空 workspace）：journey 缺失 → `AUTO-INIT: 已自动创建基线（等价 --update --step 0）`、exit 0；二跑幂等（无重复 AUTO-INIT、仍 exit 0）。与约定的 AUTO-INIT 口径**一致**，文档按此措辞（并行的脚本 agent 已先落地）。
- **D-3（H6c 预算挤压，等义压缩既有行）**：`dispatch-and-acceptance.md` 原文已 1987/2000 tok（H6c 上限），§5.7 无法原样容纳。等义压缩 4 处既有行腾预算：①§5.6 第 4 条去冗词（"强制拉取"→"拉取"、删「⬜」「任务关键词」→"关键词"等）②"资产调用硬约束（2026-09-02 加强）"删日期标记 ③宿主 CLI 认证教训删 `~/.claude/settings.json` 具体路径（保留教训本体"曾误改致 claude Not logged in"）④"8 段回归"→"全量回归"（顺带修正过期计数：当前回归实际 13 段）。最终 **2000/2000 tok** 压线达标（frontend-gate.md 含 §6.7 后 1962 tok 同达标）。
- **D-4（S7 首跑偶发）**：regression 首跑 S7 review-gate self-test ✗（网络型 URL 三态子检偶发）；单跑 `review-gate.mjs --self-test` 两次全 PASS，regression 复跑 13/13 全绿。判定环境偶发，非本次改动引入（本次未触碰 scripts/）。

## 3. 自测证据（本目录）

| 自测项 | 结果 | 证据 |
|---|---|---|
| validate-structure | 18/18 PASS，0 警告（H1~H9 全过：H1a 59 行/1005 tok、H6a-1 零孤儿、H6c 全达标、H9 59 行/809 tok、可移植性零泄露、编码零损坏） | `out-validate-structure.txt` |
| regression-all | **13/13 PASS**（含 S10 token gate：改动后 +7.9% < 10% 阈值 PASS） | `out-regression-all.txt` |
| 悬空"既定纪律"引用 grep | SKILL.md 中"Owner 缺席"唯一提及处带落点 `reference/dispatch-and-acceptance.md` §5.7；"既定纪律"字样全仓 0 命中 | 第 1 节引文 |
| SKILL.md token 前后 | 前 **750 tok / 59 行** → 后 **809 tok / 59 行**（token-audit 口径 CJK×0.75+其余÷4；+59 tok = +7.9%，H1a/H9/S10 三重预算内） | `out-token-audit.txt` |

## 4. 未覆盖 / 边界

- 未改 scripts/（BFX-4 脚本侧由并行 agent 负责，其 AUTO-INIT 已在场并经 D-2 实测确认）。
- token-audit 快照 `docs/history/token-audit-snapshot.json` 已在改动前跑基线、改动后刷新（S10 于刷新前快照下 PASS 后才刷新）。
- 未读 test-reports/acceptance-*/；未做 git 操作；未跑 make-release。
