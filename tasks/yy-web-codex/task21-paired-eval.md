# task21｜M1 四组配对评测基线与 profile 选择

状态：完整 `A/B/C/D NOT_ESTABLISHED`；已通过本地最小 YY navigation smoke（M1 六工具合成链及关闭 M1 后旧只读 summary-read 仍 exit 0），没有固定任务质量配对数据。按 Owner 新严重度策略，多任务、统计/置信区间、token/latency 和模型版本长测记入 P2 backlog；写面扩展后另跑扩展评测。依据：PRD §19；AT-46。证据：`docs/yy-web/RELEASE-EVIDENCE-20260927.json`、`docs/yy-web/P2-P3-BACKLOG-20260927.md`。

## 交付与关联

- 交付 A/B/C/D 四组同条件任务结果、质量/安全/覆盖和 token/延迟/工具调用分报、失败案例与宿主 profile 选择建议。证据不足用 `NOT_ESTABLISHED`。
- 前置：task05 预注册 oracle、task11 M1 真实调用。写面扩展评测另需 task20，属于后续阶段。后置：task22/23 的 M1 只读收口。选型：用配对而非跨模型印象比较，方法复杂度由实际非劣和成本数据决定。
- 调用面：真实网页和本地宿主读取相同固定源/权限/任务，原始调用与判分分开保存；具体测试集在阶段 5 冻结。

## GWT 验收

1. Given 相同模型、源版本、任务与工具权限，When 分别跑 A/B/C/D，Then每组有原始证据、失败原因和配对差值，质量与成本不混成单分。
2. Given 方案省 token 但丢 critical 约束或安全隔离失败，When 判决，Then不能仅凭成本降低推荐该 profile。
3. Given 样本量不足或某宿主不可用，When 总结，Then相关效果记 `NOT_ESTABLISHED`，推荐只限于已证实条件；不得以模拟调用宣称宿主兼容。

停止条件：评测数据不支持替换现有方法时，保持最小可证实 profile。
