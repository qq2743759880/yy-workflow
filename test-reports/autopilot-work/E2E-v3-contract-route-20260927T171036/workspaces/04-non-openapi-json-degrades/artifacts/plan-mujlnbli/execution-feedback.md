# execution-feedback plan-mujlnbli

## 逐子任务执行结果
### be-validator
- mode: planned-only | consumed: false | adapter: be-validator | 建议: 需装 CLI 工具（当前 planned-only 降级）
### sdlc
- mode: skipped | consumed: false | adapter: ? | 建议: 需装执行工具（当前 skipped）
### be-validator
- mode: planned-only | consumed: false | adapter: be-validator | 建议: 需装 CLI 工具（当前 planned-only 降级）
### review
- mode: skipped | consumed: false | adapter: ? | 建议: 需装执行工具（当前 skipped）
### be-validator
- mode: skipped | consumed: false | adapter: ? | 建议: 需装执行工具（当前 skipped）

## 汇总
- 真实执行: 0/5 (0.0%)
- 改进方向: 3 个子任务因上游未满足资产消费前置被跳过（DEP_PRECONDITION）——上游须真实执行并产出资产消费证据后再 --resume 续跑下游; 2 个子任务为 planned-only 降级（外部 CLI 缺失）