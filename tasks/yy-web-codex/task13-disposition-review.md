# task13｜Codex disposition 与结构化 review（M2）

状态：后续分门，未获实施授权。依据：PRD FR-08；AT-17、40–41。

## 交付与关联

- 交付 `yy_submit_review` 的 findings、coverage、verdict、证据引用和接受/修订/拒绝 disposition；保留原 proposal 与审阅者独立性标签。
- 前置：task12 的可追溯 proposal；后置：task14/15。选型：沿用 YY 既有 review 语义与原始证据，不为了填配额虚构 finding。
- 候选 seam：YY 当前 review/record 写入口及生产 M；写面受 task02 ADR 和版本冲突保护，精确 schema 在阶段 5 冻结。

## GWT 验收

1. Given Codex 不同意网页建议，When 提交拒绝或修订，Then原提案不被改写，理由、版本、责任主体与证据可追溯。
2. Given 有效审计没有 finding，When 提交 review，Then零 finding 被接受，coverage/verdict 仍完整，不凭空凑问题。
3. Given 当前任务只有 self-review，When 保存/展示，Then独立性明确为自审，不能包装成外部独立验收；过期版本提交冲突。

停止条件：review 若可直接代表 Owner 批准或业务签收，禁止开放。
