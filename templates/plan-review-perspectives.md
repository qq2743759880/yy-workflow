# plan-review-perspectives（规划自审 · 视角提示词库）

> 供 dev-planner「规划自审」区块复用，也供测试 agent / 批判者 / 子 agent 在规划阶段调用。
> 对标 gstack `plan-ceo-review`（9 Prime Directives + 4 scope mode）/ `plan-eng-review`（Confidence Calibration + pre-emit verification gate）/ `plan-design-review`（7 passes + AI Slop）/ `plan-devex-review`（TTHW，可选）。
> 顺序强制：CEO → Eng → Design（Design 收尾，作为 ship gate）。

## CEO 范围视角

**姿态**（选一后忠实执行，不漂移）：
- SCOPE EXPANSION：找 10 倍机会，可推荐扩范围——但每个扩项是用户决策，AskUserQuestion 呈现
- SELECTIVE EXPANSION：守住当前范围做扎实，另列可 cherry-pick 的扩项
- HOLD SCOPE：范围已定，只找失败模式/边界/可观测
- SCOPE REDUCTION：找最小可达成核心结果版本，敢砍

**检查项（6 条精简版 Prime Directives）**：
1. Zero silent failures——每个失败模式可见
2. Every error has a name——不写"处理错误"，写具体异常类 + 触发 + 用户所见
3. Data flows have shadow paths——happy path + nil + 空 + 上游错误 四条
4. Interactions have edge cases——双击/中途离开/慢连接/陈旧状态/返回键
5. Observability is scope——日志/指标/告警是一等交付物
6. Permission to say "scrap it"——有更优方案就直说

**输出格式**：Scope Mode 判定 + 不做清单复核 + 每项 deferred 理由 + ≥1 finding + 处置。

## Eng 架构视角

**检查项**：
1. 架构边界（分层/依赖方向）
2. 数据流 shadow path（nil/空/上游错误）
3. 测试覆盖缺口
4. 性能与 N+1 / 无界增长

**Finding 格式（必须引用具体代码/模板行）**：
```
[P1|P2] (confidence: N/10) file:line — desc
```
- Pre-emit verification gate：每条 finding 必须能引用触发它的具体行；引不出 → 强制降置信度。
- REGRESSION RULE：受影响的回归测试必加，不可跳过。

**输出格式**：≥1 finding（含 confidence + 引用行）+ 处置。

## Design 体验视角

**交互状态表**（每页面/组件必查）：
| State | 表现 |
|---|---|
| LOADING | 占位/骨架，非空白闪烁 |
| EMPTY | 空态是功能不是 afterthought，给引导 |
| ERROR | 可读错误 + 可恢复路径 |
| SUCCESS | 明确成功反馈 |
| PARTIAL | 部分失败时的部分成功呈现 |

**检查项**：
- AI slop 风险（黑名单：深色底霓虹/紫蓝渐变/玻璃拟态滥用/千篇一律卡片网格/通用字体/纯黑白灰）
- 无障碍：对比度 ≥4.5:1（文本）/3:1（UI），命中区 ≥44px，不单靠颜色传达
- Subtraction default：每个 UI 元素不挣像素就砍

**输出格式**：交互状态表填充 + AI slop 检查 + 无障碍检查 + ≥1 finding + 处置。

## DX 视角（可选，TT 资产本身是开发者工具时启用）

- Time to Hello World（TTHW）：<2min 为 champion 基准
- 7 characteristics：Usable / Credible / Findable / Useful / Valuable / Accessible / Desirable
- 检查：文档可发现、错误可行动、配置默认合理、可覆盖

**输出格式**：TTHW 估算 + 每 characteristic 一句 + finding + 处置。
