# TK-1 派单 — task 模板 v2 七字段 + 机验（批 0）

你是 autopilot 管线 L1 独立执行 agent（全新上下文）。工作区：`D:\.ai-hub\skills\yy`。先读 `plans/execution-plan-v3-20260923.md` §三 TK-1，严格按其执行。完成后交付证据，不自称 DONE。

## 任务：task 模板 v2 七字段（在既有 GWT + 前后置 + 选型依据之上加）
| 字段 | 内容 | 机验方式 |
|---|---|---|
| `implementation_steps[]` | 1-7 步，每步 `{target 文件路径, action, rationale}`（BMAD "文件--动作--理由"） | 脚本校验步数 ∈[1,7] 且 target 路径存在 |
| `executor_acceptance[]` | 每条 AC 附 `verify_command`（CLI+期望退出码/输出） | 阶段 4 直接执行，exit 0 = 完工 |
| `trajectory_checkpoints[]` | 每步对应可观测中间产物（文件存在/单测过/命令输出片段） | checkpoint 须覆盖全部 steps，逐项机器核对 |
| `complexity_score` + `must_split` | 涉及文件数+依赖深度，超阈值强制拆 subtasks | 字段必填 + 拆解规则断言（**reject 逐任务 LLM 评分**——成本） |
| `boundaries` | Always/Never 各 ≤3 条 + 边缘用例矩阵，批准后冻结只可追加 | 提交后 diff 只允许 append |
| `dev_record` | 执行者回填：实际改动文件清单+完成备注+偏离原因 | 完工时字段非空且文件存在 |
| `spec_budget` | 任务描述 token 上限（~1200），超限即拆 | 字符数上限断言 |

## 落点
- 模板文件：`templates/task-v2.md`（新建，**注意 validate H6a-1 孤儿断言会 FAIL 未登记新文件——须同步在 SKILL.md 指针表登记该模板，但 SKILL.md 禁改**→ 因此模板改为落在 `reference/task-v2-template.md` 并在 `reference/` 内登记，或落 `scripts/` 面；我建议 `reference/` 并在 RESULTS.md 里如实登记 D-偏差说明为何未进 SKILL 指针表，由编排者后续补）
- 机验：`scripts/validate-structure.mjs` 增加 task 模板字段断言（白名单内）
- fixtures：`test-reports/autopilot-work/TK-1/` 下放合规样本 + 违规样本（缺 implementation_steps / verify_command 空 / complexity 未填 / boundaries 超限 / spec_budget 超限 / dev_record 缺）各一条，逐条验证判定

## 自测（必须）
1. 合规样本 → 断言全过 exit 0；
2. 6 个违规样本逐个 → 各自触发对应 FAIL 且 detail 指名字段；
3. `node scripts/regression-all.mjs` 13/13 + `node scripts/validate-structure.mjs` 0 警告；
4. RESULTS.md：逐项证据 + D-xxx 偏差（含模板落点选择的理由）。

## 禁止
改 SKILL.md、commands/、webview/、contracts/、plans/、handoffs/、其他 scripts/；读 test-reports/acceptance-*/；git 操作。

## 验收要点（编排者 L2 将复核）
七字段机验可判；6 违规样本全抓；回归全绿。