# 附 A2：资产整合与平台探测（来源：SKILL.md §1 + §1c，自包含可读）

> 本文件是 YY 资产整合阶段的权威说明（原 SKILL.md §1/§1c 迁移至此）。阶段 0（立项/资产整合）或组装 kickoff prompt 时读取。

手动调度、竞品直用或方法论降级仍须先消费 `decision-interface.md` 的 Core/V2 Decision Packet；不能以本说明或工具可用性替代阶段准入。缺失必需资源按当前 blocker 处理。

## 资产整合红线（第 0 步，前置）

- **资产清单以实际部署为准**：引用任何 skill/mcp 前先确认存在（`scripts/detect-platforms.mjs` 或 `Test-Path`），**不引用不存在的资产**。
- **平台能力差异必须先探明**：无 `Workflow()` API/某 MCP → 手动阶段调度 + CLI/Python 校验；沙箱拦 git commit/受保护路径 → 编排者沙箱外补；先验证渲染产物非过时，缺失先注入再开工。
- **角色分配算法**（替代固定平台角色）：探测到 N 个平台 → 编排者 = 用户指定或首个平台；其余按能力启发式分域（前端/后端/调研/审查），结果可手工覆写；N=1 → 单平台模式。
- **资产分级**（核心/增强/外部三级明细见 `reference/frontend-gate.md` §6.6）：核心 = dev-planner + templates（必须有，validate 校验）；增强 = 随包 vendor 资产（下表），缺失走内置通用步骤；外部 = TTHP（可选）。

## 随包内置资产清单（vendor/，自包含核心）

下列资产已随本 skill 分发于 `$SKILL_DIR/vendor/<name>/`，任何拿到本 skill 的用户都能直接用，不依赖外部 AI-Hub：

| 类别 | 资产 | 路径 |
|------|------|------|
| 核心规划 | dev-planner（只读规划 agent） | `$SKILL_DIR/vendor/dev-planner/dev-planner.md` |
| 需求挖掘簇 | planning（formal-prd + vibe-prd，原 prd-writer + vibe-coding-prd 合并） | `$SKILL_DIR/vendor/planning/SKILL.md` |
| 前端设计簇 | frontend-design（生成/品味/设计数据/组件选型/原型五合一） | `$SKILL_DIR/vendor/frontend-design/SKILL.md` |
| 评审簇 | review（critique + be-tester + polish 三合一） | `$SKILL_DIR/vendor/review/SKILL.md` |
| 安全簇 | security（audit + harden + be-security 三合一） | `$SKILL_DIR/vendor/security/SKILL.md` |
| 安全扫描 | skill-sentinel | `$SKILL_DIR/vendor/skill-sentinel/SKILL.md` |
| 后端工程 | sdlc（BMAD-METHOD 四阶段 + cline 执行） | `$SKILL_DIR/vendor/sdlc/SKILL.md` |
| 后端 agent | be-validator（提示词，无 SKILL.md） | `$SKILL_DIR/vendor/be-validator/be-validator.md` |
| 实现簇 | implementation（Matt implement 薄包装，默认 HOST_NATIVE；外部 provider 显式选用） | `$SKILL_DIR/vendor/implementation/implementation.md` |

## 竞品整合与直用策略

> 引用任何增强资产前先确认存在；增强资产均随包内置，故默认存在。编排器固定读取随包 vendor；`$AIHUB_ROOT` 仅可作外部资料目录，不能自动覆盖资产。后端任务链（T1/T2/T5）的 agent×skill 调度见 `templates/task-agent-matrix.md` 与 `templates/orchestration-frontend-backend.md`。
>
> **方法论与 provider 分离**：YY 持有 Decision、路由、激活、依赖解析和证据，宿主持有执行。工具依赖属于具体 capability，不构成宿主平台要求。implementation 的正常可用性不依赖外部 CLI。
>
> **执行选择**：默认由当前宿主使用原生模型/工具消费方法论包。外部 provider 只有在用户或部署配置显式选用时调用；已安装不等于应自动选择。无自动执行能力时交付 BRIEF_ONLY、executed=false。接入约定见 [平台中立执行](host-execution.md)；历史部署 inventory 不作为当前选择权威。
