# IMP2+IMP3 报告 — 棕地契约模式 + 多宿主探测稳定接入

- 日期: 2026-09-05 · 执行: 子 agent 通道不稳定（TLS 断开/平台繁忙多次重试失败）→ 按 C-01 降级条款由编排者接续实现 + 独立验收 + 登记
- 基线: TT 2.8.0

## IMP2 棕地契约模式（B1/B2/B3）

| 能力 | 实现 | 实测 |
|---|---|---|
| B1 契约反推 | scripts/contract-reverse.mjs：启发式抽路由（Flask/FastAPI/Express/Hono/Spring/Go + 前端 fetch 可选）→ OpenAPI 3 草案 draft:true | Express 3 路由全抽出（/api/login、/api/users、/api/users/{id}）；修复组索引 bug（express verbGroup:1/pathGroup:2） |
| B2 棕地冻结 | orchestrator --contract-draft：与 --contract 互斥、文件校验 exit 2、be-validator 不跑真校验 degraded、前端凭草案开工、freezeContract 记 contractSource | --contract-draft 实测 brownfield 路径 + contracts 含 contractSource + exit 0 |
| B3 变更单 | scripts/contract-discrepancy.mjs：reported 期望接口 vs 契约 → handoffs/contract-change-<planId>.md | 2 一致 + 1 missing → 变更单 exit 0；修复 const 数组 += bug |

SKILL §5.4 加棕地说明。

## IMP3 多宿主探测稳定接入（H1/H2/H3，只读不写宿主配置）

| 能力 | 实现 | 实测 |
|---|---|---|
| H1 统一探测 | scripts/exec-host-probe.mjs：只读 --version 探测 7 CLI | opencode 1.18.25 / claude 2.1.261 / codex 0.151.0 / cursor 3.12.30 / trae 1.107.1 / openclaw 2026.7.1-2 / a6api 全 available=true |
| H2 通用宿主 | scripts/exec-host-generic.mjs --cli claude\|codex 等：非交互（brief stdin 喂入防 argv 超长 + spawn stdio 接管防挂起）→ plan.md 含锚点内核词 | 语法 OK；claude/codex 非交互实测待真机（codex 若挂起如实 TIMEOUT） |
| H3 文档 | README 加「多宿主统一探测 + 通用宿主」段 + 红线（绝不写宿主配置）；config.example 已有 hosts | — |

**红线遵守**：只读探测 + CLI 参数接入，未修改任何 ~/.claude / ~/.codex / cc-switch 配置（时间戳无本次触发写入）。

## 回归
- regression-all 8/8 PASS；validate 0 泄露；ci PASS
- handoffs/ 运行时产物 gitignore（contract-change-*.md 不入库）

## 诚实局限
- B1 反推是启发式正则，非 AST——复杂路由（动态 import/中间件嵌套前缀）覆盖有限
- B2 棕地草案的"待确认"语义靠人工确认，无自动后端确认流程
- H2 claude/codex 真机非交互执行未经完整端到端（子 agent 通道中断期间未及实跑），下次派单实跑验证