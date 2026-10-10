# 资产运行时边界

本页登记生产资产要求与当前 Core 强制行为之间的缺口，随 core/mcp 发行包提供。
V3 生命周期以各资产契约为准；随包不自动授予 ACCEPTED / CANONICAL 状态。

## Frontend Design：L0–L3 分级加载

- 资产要求：按任务是否有界面产物与复杂度选择 L0–L3；具体加载内容见
  [Frontend Design](../vendor/frontend-design/SKILL.md) 与
  [frontend-design V3 契约](../contracts/v3/frontend-design.contract-v3.yaml) 的 `application.activation_policy`。
- 当前运行时尚未强制该策略。Core 的
  [activation](../scripts/lib/activation.mjs) 消费 `metadata/body/resource` 加载级别，
  没有将 L0–L3 任务分级映射到正文裁剪、资源限量和机检门的消费点。
- 当前交接：由派单方人工声明分级；有界面产物且未声明时沿用资产规定的 L2 缺省。
  该声明不能证明 Core 已自动按分级控制投递；实际加载和 gate 执行仍须单独留痕。
- Core 缺口：消费任务分级并按资产策略控制投递范围；本次文档修复不实现该策略。

## SDLC：LEGACY_HEAVY_PROFILE

当前声明真源为 vendor/sdlc/METHODOLOGY.json 的 optional_profile。治理 manifest 与发现清单只是其投影，构建器读取同一声明；reuse gate 拒绝投影分叉。planner 和 eligibility 复用 profileAllowed，普通计划排除该资产。
启用必须同时提供 owner_intent.explicit_assets 中的 sdlc、非空 authorization_ref，以及 methodology.governance_scope 为 release-governance / large-migration / multi-stage-governance。resolver 在执行前再检查；授权不等于阶段完成。
正常开发方法由固定 Matt implement/tdd/code-review/codebase-design 承担。Heavy Profile 的额外价值是发布或迁移的阶段记录、角色放行与回滚治理，保留为 legacy opt-in，不作为开发默认。
宿主执行默认 HOST_NATIVE，缺执行器 BRIEF_ONLY；Cline 仅为 OPTIONAL_EXTERNAL_PROVIDER。单次 Cline 输出不证明四阶段执行或多 Agent 独立性，phase_execution=UNVERIFIED。角色和模板按声明条件加载。
