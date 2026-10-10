# 任务 × Agent × Skill × Workflow × MCP 调度矩阵

> 五类任务的资产候选与职责参考。具体派单来自当前批准任务与 Decision，不要求创建同名子代理或执行整条角色链。
> 内置方法统一走 `$SKILL_DIR/vendor/<name>/...` 的固定声明；`$AIHUB_ROOT` 只作外部资料位置，不自动替换同名资产 authority。
> 本表为 9 资产簇化版（v2.3.0 drop 7 收缩，与 `scripts/lib/matrix.mjs` 的 CLUSTERS 保持一致）：原 be-implementer/dev-backend 并入 implementation；harden/be-security 并入 security；be-tester 并入 review；ui-ux-pro-max/taste-skill/pick-ui-library/prototype 并入 frontend-design；prd-writer/vibe-coding-prd 并入 planning；7 个低频资产已 drop（上游设计 agent 由「契约产物先行冻结」替代，回收清单见 change.record cr-20260925T102900Z-as1-drop7）。

## 五类任务总览

| 任务类 | 含义 | 资产候选（非强制执行链） | 关键 skill / 资产 |
| --- | --- | --- | --- |
| **T1 数据库** | schema / 迁移 / 查询优化 | `implementation`、`be-validator`、显式 Heavy Profile 的 `sdlc` | `implementation`、`be-validator` |
| **T2 后端** | API / 服务 / 业务逻辑 | `implementation`、`security`、`review`、`be-validator`、显式 Heavy Profile 的 `sdlc` | 实施、安全、独立检查与契约核验 |
| **T3 AI-RAG-MCP** | 检索增强 / MCP 接入 | `implementation` → `be-validator`/`dev-planner` | `be-validator`(契约校验)、`dev-planner`(任务拆解) |
| **T4 前端** | HTML→React 页面 | `frontend-design` → `planning` → `review`/`security` | `planning`、`review`(critique/polish)、`security`(audit) |
| **T5 运维** | 部署 / 监控 / 故障 | `security`/`skill-sentinel` → `be-validator`/`review` | `security`(harden+be-security)、`review`、日志/告警 MCP（按注册） |

## T2 后端 —— 详细调度链（示例）

```
需求(GWT) ──> 契约先行冻结      产 contract.md / contracts/<planId>.json（按当前批准项目）
        │
        ├─> implementation  按契约实施与单测
        │        └─ 根编排安排 Standards / Spec review（明确独立性与证据）
        ├─> security        安全审查（鉴权/注入/越权/harden 加固）
        ├─> review          批准范围的集成检查与规格/标准评审
        └─> be-validator    契约冻结核验（L1/CDC 机械校验，portman/contracteer）
```

- **契约先行**：动手前必须先产/消费 `contract.md`（见 `templates/contract.md`），未冻结不实现。编排内核（`scripts/orchestrator.mjs`）会把 plan 契约机器冻结为 `contracts/<planId>.json` 并在执行前后做 hash 比对（BE-13），篡改 → exit 4。
- **独立验收**：需要独立证据的职责由当前批准任务安排；required 未满足时不能接受。review 逻辑义务、角色名称或 Promise 并行不自动创建执行主体，也不授予 redelegation。
- **执行后端**：普通任务默认 DIRECT_HOST/HOST_NATIVE，实际 execute 绑定决定是否可执行；implementation 使用 portable prompt/host 路径。opencode/cline 仅是明确批准的 optional external provider；be-validator 等确定性工具保留真实 adapter。manual 先于旧 command/provider/hosts，禁止自动派发；最终文本 budget、quota 与 C4 校验不能降级绕过。完整人工流程与旧模式迁移见 [manual-handoff](../reference/manual-handoff.md)。

## 资产路径速查（9 资产簇化版）

| 资产 | 类型 | 引用路径 |
| --- | --- | --- |
| implementation | agent（be-implementer + dev-backend 合并） | `$SKILL_DIR/vendor/implementation/implementation.md` |
| be-validator | agent | `$SKILL_DIR/vendor/be-validator/be-validator.md` |
| dev-planner | agent | `$SKILL_DIR/vendor/dev-planner/dev-planner.md` |
| sdlc | skill（仅明确 Heavy Profile；provider 可选） | `$SKILL_DIR/vendor/sdlc/SKILL.md` |
| security | skill（audit + harden + be-security 合并） | `$SKILL_DIR/vendor/security/SKILL.md` |
| review | skill（critique + be-tester + polish 合并） | `$SKILL_DIR/vendor/review/SKILL.md` |
| planning | skill（formal-prd + vibe-prd 合并） | `$SKILL_DIR/vendor/planning/SKILL.md` |
| frontend-design | skill（五合一前端设计簇） | `$SKILL_DIR/vendor/frontend-design/SKILL.md` |
| skill-sentinel | skill | `$SKILL_DIR/vendor/skill-sentinel/SKILL.md` |

> MCP（context7 / playwright / mysql 等）以实际注册为准，引用前先 `detect-platforms.mjs` 确认存在。
