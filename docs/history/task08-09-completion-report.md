# task08+09 完工报告

> owner 审核指引：templates/owner-review/acceptance-report.md

- 任务: task08（开工 prompt 全簇资产清单 + 域声明）+ task09（完工报告按域展示）· 执行者: opencode/assistant · 日期: 2026-09-07

## 资产消费证据（硬约束，必填）
| 资产文件（具名路径） | 实际调用证据 | 锚点+内核词 |
|----------------------|-------------|------------|
| `docs/yy-dev-plan.md`（task08 L180-191 / task09 L192-202 规格） | 按 spec 逐条实现 | 锚点=spec 段落编号 |
| `scripts/lib/matrix.mjs`（CLUSTERS L1-6 数据源，只读不改） | candidates/preconditions 逐字对齐注入 | 锚点=CLUSTERS 逐字一致 |

> 未消费外部 skill 资产；本任务是模板编辑，仅消费仓库内规格与数据源文件。

### 按域展示（F5 展示层）
> 域标签与开工声明一致。本任务为仓库模板编辑，不落入 T1-T5 产品域。

| 域 | 资产具名路径 | 调用证据 |
|----|-------------|---------|
| 未调用 | 无（未调用） | 无（未调用，无产品域资产） |

## 完工前自检（critique 三视角）
| 检查视角 | 发现 | 处置 |
|---------|------|------|
| 交互态（正常/空/错误/边界） | 无发现：各簇 candidates/preconditions 与 matrix.mjs 逐条核对一致，未缩水未杜撰 | 无需修 |
| 边界（输入/输出/权限/超时） | T4 通用段与 T4 深化层并存，注入关系以「另需加载下方 T4 专用」衔接，不冲突 | 无需修 |
| 错误反馈（用户/下游可见的错误提示） | completion-report 既有硬约束行零改动，按域展示为纯追加小节，diff 只增不改 | 无需修 |

> 自检无发现需返工项。

## GWT 逐条自查
### task08
| 验收项 | 结果 | 证据 |
|--------|------|------|
| T4 路由开工 prompt 含 T1-T5 具名路径 + preconditions，与现 T4 专用段一致不缩水 | ✅ | `git diff templates/kickoff-prompt.md` 新增「按簇注入」段；T4 candidates/preconditions 与 matrix.mjs L5 逐字一致 |
| T1/T2/T3/T5 路由同样注入对应簇 candidates 具名路径 + preconditions | ✅ | diff 中 T1/T2/T3/T5 各段与 matrix.mjs L2/L3/L4/L6 逐字一致 |
| 执行 agent 开工首行域声明 + 必用资产清单；未声明记 warning 抽查 | ✅ | 「域声明要求」段含首行声明格式 + asset-call-rate 抽查记 warning 规则 |
| owner 指定资产可用具名路径被开工 prompt 承接 | ✅ | 域声明要求段注明「本 task 必须消费 <具名资产路径> 类指令可被本清单承接」 |
| T4 专用段保留为深化层 | ✅ | T4 专用段原 L31-71 内容零改动，通用段在其上 |

### task09
| 验收项 | 结果 | 证据 |
|--------|------|------|
| 完工报告先按域分组再平铺明细，域标签与开工声明一致 | ✅ | completion-report.md 新增「按域展示」小节（T1 数据库/T2 后端/T3 AI-RAG-MCP/T4 前端/T5 运维/bugfix） |
| 「资产消费证据（硬约束，必填）」既有行零改动，按域为追加小节 | ✅ | `git diff templates/completion-report.md` 纯追加，既有 L7-13 零改动 |
| 未调用资产如实写「无（未调用）」不伪造 | ✅ | 小节含「未调用 | 无（未调用）」行 + 表头说明 |

## 实际调用证据（skill/子 agent 强制）
| 资产 | 调用证据 |
|------|---------|
| `docs/yy-dev-plan.md` | 读取 L175-209 按 spec 实现 |
| `scripts/lib/matrix.mjs` | 读取 L1-7 CLUSTERS 逐字对齐 |
| `templates/kickoff-prompt.md` / `templates/completion-report.md` | 读取全文后 edit，diff 纯追加 |

## 契约承接核对（如有）
无新契约冻结（task08/09 契约冻结顺序均为「—」，数据源为既有 CLUSTERS）。

## 批判承接核对（§5.6，硬约束，必填）
| C-xx | 待优化执行项（落点） | 完成证据 |
|------|---------------------|---------|
| 无承接项 | HIT_NONE | 本任务无落点与待落地批判重叠 |

## 遗留问题 / 待确认
无。两个模板改动均为纯追加；candidates/preconditions 与 matrix.mjs CLUSTERS 逐字对齐，未缩水未杜撰。
