# 任务 × Agent × Skill × Workflow × MCP 调度矩阵

> tt 的派单核心表。每类任务给出「具名子 agent + 调用 skill + 可选 workflow/MCP」。
> 引用内置资产一律走 `$SKILL_DIR/vendor/<name>/...`，保证离线可用；设 `$AIHUB_ROOT` 时可改用外部同名资产。
> 本表为 16 资产簇化版（v2.2.0+）：原 be-implementer/dev-backend 并入 implementation；harden/be-security 并入 security；be-tester 并入 review；ui-ux-pro-max/taste-skill/pick-ui-library/prototype 并入 frontend-design；prd-writer/vibe-coding-prd 并入 planning。与 `scripts/lib/matrix.mjs` 的 CLUSTERS 保持一致。

## 五类任务总览

| 任务类 | 含义 | 主干 agent | 关键 skill / 资产 |
| --- | --- | --- | --- |
| **T1 数据库** | schema / 迁移 / 查询优化 | `be-architect` → `implementation` | `sdlc`(plan/develop)、`be-provider`(连接/迁移)、`be-validator` |
| **T2 后端** | API / 服务 / 业务逻辑 | `be-architect` → `implementation` → `review`(be-tester) | `sdlc`(develop/review)、`security`(harden+be-security)、`be-resilience`、`be-validator` |
| **T3 AI-RAG-MCP** | 检索增强 / MCP 接入 | `be-provider` → `implementation` | `agent-research`(调研)、`be-validator`(契约校验)、`dev-planner`(任务拆解) |
| **T4 前端** | HTML→React 页面 | `frontend-design`（五合一前端链） | `frontend-visual-validation`、`colorize`、`planning`、`review`(critique/polish)、`security`(audit) |
| **T5 运维** | 部署 / 监控 / 故障 | `be-resilience` → `be-validator` | `security`(harden+be-security)、`review`、日志/告警 MCP（按注册） |

## T2 后端 —— 详细调度链（示例）

```
需求(GWT) ──> be-architect     设计领域模型/接口契约(产出 contract.md)
        │
        ├─> implementation  按契约实现（sdlc/develop）；同步写单测
        │        └─ sdlc/review 对照契约评审（BMAD plan/develop/review/summarize 四阶段）
        ├─> security        安全审查（鉴权/注入/越权/harden 加固）
        ├─> be-resilience   容错/限流/降级设计
        ├─> review          集成+契约测试（be-tester 嵌套 agent，tsc/eslint/test 全绿）
        └─> be-validator    契约冻结核验（L1/CDC 机械校验，portman/contracteer）
```

- **契约先行**：后端 agent 在动手前必须先产/消费 `contract.md`（见 `templates/contract.md`），未冻结不实现。编排内核（`scripts/orchestrator.mjs`）会把 plan 契约机器冻结为 `contracts/<planId>.json` 并在执行前后做 hash 比对（BE-13），篡改 → exit 4。
- **独立验收**：`review`(be-tester) 与 `be-validator` 独立于实现者，结论二值化（PASS / 待重验），禁止自验自过。
- **执行后端**：`implementation` 接 opencode、`sdlc` 接 cline、`be-validator` 接 portman/contracteer（见 `scripts/lib/adapters/`）。工具不可用时子任务标记 skipped / planned-only，绝不假报成功。宿主执行（`--exec`）把 brief 作为最后参数投喂宿主，stdout 捕获为 `result.txt`，空输出/超时/失败诚实降级（BE-14）。

## 资产路径速查（16 资产簇化版）

| 资产 | 类型 | 引用路径 |
| --- | --- | --- |
| be-architect | agent | `$SKILL_DIR/vendor/be-architect/be-architect.md` |
| implementation | agent（be-implementer + dev-backend 合并） | `$SKILL_DIR/vendor/implementation/implementation.md` |
| be-provider | agent | `$SKILL_DIR/vendor/be-provider/be-provider.md` |
| be-resilience | agent | `$SKILL_DIR/vendor/be-resilience/be-resilience.md` |
| be-validator | agent | `$SKILL_DIR/vendor/be-validator/be-validator.md` |
| dev-planner | agent | `$SKILL_DIR/vendor/dev-planner/dev-planner.md` |
| sdlc | skill（BMAD 四阶段 + cline） | `$SKILL_DIR/vendor/sdlc/SKILL.md` |
| security | skill（audit + harden + be-security 合并） | `$SKILL_DIR/vendor/security/SKILL.md` |
| review | skill（critique + be-tester + polish 合并） | `$SKILL_DIR/vendor/review/SKILL.md` |
| planning | skill（formal-prd + vibe-prd 合并） | `$SKILL_DIR/vendor/planning/SKILL.md` |
| frontend-design | skill（五合一前端设计簇） | `$SKILL_DIR/vendor/frontend-design/SKILL.md` |
| frontend-visual-validation | skill | `$SKILL_DIR/vendor/frontend-visual-validation/SKILL.md` |
| colorize | skill | `$SKILL_DIR/vendor/colorize/SKILL.md` |
| agent-research | skill | `$SKILL_DIR/vendor/agent-research/SKILL.md` |
| agent-vision-toolkit | skill | `$SKILL_DIR/vendor/agent-vision-toolkit/SKILL.md` |
| skill-sentinel | skill | `$SKILL_DIR/vendor/skill-sentinel/SKILL.md` |

> 其它前端/设计/调研资产见 `SKILL.md` §1c。MCP（context7 / playwright / mysql 等）以实际注册为准，引用前先 `detect-platforms.mjs` 确认存在。
