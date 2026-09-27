# task05｜验收 oracle 与配对评测预注册（M0）

状态：只读宿主配对评测尚未开始；A/B/C/D 结论为 `NOT_ESTABLISHED`。依据：PRD §19、§22；AT-46 前置。证据状态见 `docs/yy-web/RELEASE-EVIDENCE-20260927.json`。

## 交付与关联

- 交付 FR-01–11、AT-01–48 的 `requirement → production caller → 原始证据 → 判定` 清单、基线任务集、四组 A/B/C/D 对照方法和质量/成本/安全阈值候选。未有 Owner 决策的数字只标目标值。
- 前置：task01 基线；后置：task11/20/21/22。选型：对同一模型、权限、源版本和任务做配对，先固化判定规则再跑结果。
- 调用面：复用现有 YY evidence/test-report 口径；不写生产 W。具体评测脚本、样本与预算在阶段 5 冻结。

## GWT 验收

1. Given 48 个 AT，When 建 oracle，Then 每项都有可运行调用、原始证据位置、PASS/FAIL/ENVIRONMENT_UNAVAILABLE 判定，不能以人工总结代替证据。
2. Given 四种入口/方法 profile，When 预注册实验，Then任务顺序、模型、工具权限、原始源和统计口径固定，质量与 token/延迟分开汇报。
3. Given 网页宿主或样本不可用，When 评估，Then 相应结论是 `NOT_ESTABLISHED`，不以本地模拟推断网页效果。

停止条件：oracle 未固定前不宣称方法 profile 优于基线。
