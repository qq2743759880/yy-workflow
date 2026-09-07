# Task: FE-04 资产簇化：实现簇（2 → 1）

## 概述
把 `dev-backend`（后端代码生成 agent）与 `be-implementer`（后端实现 agent）合并为一个 `implementation` 簇（agent 型），为后续接入 opencode（BE-07）提供单一挂载点。

## 所属与定位
- **阶段**：MVP / Phase 1（簇化）
- **层级**：Frontend（资产层）
- **上游依赖**：无
- **下游被依赖**：**BE-07（opencode 适配器必须挂在 `implementation` 上）**、FE-06（条目更新）、FE-07（文档改写）

## 目标与非目标
**目标**
- 建立 `vendor/implementation/`（**agent 型**：`vendor/implementation/implementation.md`，无 `SKILL.md`）。
- 合并两个 agent 的职责：需求→代码生成（dev-backend）与实现落地（be-implementer）。
- 为 BE-07 的 opencode 接入预留明确的「执行内核」章节。

**非目标**
- 本任务不接入 opencode（BE-07 做接入，FE-07 做文档改写）；本任务只重组并留好接口位。
- 不改变 agent 型判定（无 frontmatter，仍归 `AGENT_ENTRIES`）。

## 前置条件
- 已阅读 `vendor/dev-backend/dev-backend.md` 与 `vendor/be-implementer/be-implementer.md`。
- 注意：两者均为 agent 型（目录下是 `<name>.md`，无 `SKILL.md`）。

## 输入
- `vendor/dev-backend/`、`vendor/be-implementer/`

## 需要创建 / 修改的文件

| 文件 / 目录 | 动作 | 说明 |
|---|---|---|
| `vendor/implementation/implementation.md` | 创建 | 合并后的 agent 定义 |
| `vendor/implementation/reference/dev-backend.md` | 创建（迁入） | 原 `dev-backend.md` 全文 |
| `vendor/implementation/reference/be-implementer.md` | 创建（迁入） | 原 `be-implementer.md` 全文 |
| `vendor/{dev-backend,be-implementer}/` | 删除 | 合并后移除 |

## 实现步骤
1. 通读两个 agent 定义，列出各自职责与约束（dev-backend 偏「从需求产出后端代码」，be-implementer 偏「实现落地与集成」）。
2. 创建 `vendor/implementation/`，把两份原文**完整**迁入 `reference/`（先不删减，保证不丢内容）。
3. 编写 `vendor/implementation/implementation.md`（agent 型，无 YAML frontmatter）：
   - 首段：职责总述（统一实现 agent：从需求/设计产出可运行后端代码并完成落地）。
   - 章节：①职责 ②输入（需求/契约/上下文） ③输出（代码与产物路径） ④约束（遵守契约冻结、不臆造接口、路径相对化） ⑤失败处理 ⑥**执行内核（预留：opencode）**。
   - 第⑥节明确写出：MVP 的执行内核为 `opencode`（见 BE-07 适配器），并在接入前标注「预留，未接入」。
4. 删除两个旧目录；暂不提交，等 FE-06。
5. **重要**：`AGENT_ENTRIES` 需把 `dev-backend`、`be-implementer` 两项替换为 `implementation`（由 FE-06 完成）。

## 关键契约 / 数据结构

```
vendor/implementation/          # agent 型：无 SKILL.md，靠 implementation.md 定义
  implementation.md             # 簇入口（无 YAML frontmatter）
  reference/
    dev-backend.md              # ← 原文保留
    be-implementer.md           # ← 原文保留
```

```markdown
<!-- vendor/implementation/implementation.md 建议结构 -->
# implementation
职责：从需求与契约产出可运行后端代码并落地...
## 输入 / 输出 / 约束 / 失败处理
## 执行内核
MVP 执行内核：opencode（BE-07 适配器接入）。状态：预留，未接入。
```

## 验收标准（Given / When / Then）
- Given 合并完成，When 检查 `vendor/`，Then `dev-backend` 与 `be-implementer` 目录不存在，`implementation` 存在。
- Given `vendor/implementation/`，When 检查是否存在 `SKILL.md`，Then **不存在**（保持 agent 型判定，否则 validate 会把它当 skill 校验 frontmatter）。
- Given 迁入的 reference 文件，When 与 git 历史版本对比，Then `reference/dev-backend.md` 与原始 `dev-backend.md` 内容一致（diff 无差异）。
- Given `implementation.md`，When 检查「执行内核」章节，Then 明确提及 opencode 且标注当前状态（预留/已接入）。
- Given BE-07 完成后，When 检查适配器注册表，Then `implementation`、`dev-backend`、`be-implementer` 三个键均指向 opencode（兼容簇化前后）。

## 验证命令
```bash
cd D:/.ai-hub/skills/tt
ls vendor | grep -E "dev-backend|be-implementer|implementation"   # 期望只有 implementation
diff <(git show HEAD:vendor/dev-backend/dev-backend.md) vendor/implementation/reference/dev-backend.md && echo "一致"
test -f vendor/implementation/SKILL.md && echo "错误：不应有 SKILL.md" || echo "OK：无 SKILL.md（agent 型）"
grep -n "opencode" vendor/implementation/implementation.md
```

## 失败与回滚
- 失败：误建 `SKILL.md` 导致类型判定错误 → 删除它，确保目录内只有 `implementation.md` + `reference/`。
- 回滚：`git checkout -- vendor/`（未提交前提下）。

## 风险与注意
- **类型是关键**：本簇必须是 agent 型（无 `SKILL.md`）。若建了 `SKILL.md`，`validate-structure.mjs` 的 `SKILL_ENTRIES` 校验会要求 frontmatter 的 name/description/version，导致报错。
- BE-07 依赖本任务：opencode 适配器要挂在 `implementation` 上，请确保 FE-04 先于 BE-07 完成。
- 两个原 agent 的约束（如「遵守契约冻结」「路径相对化」）必须在新 `implementation.md` 中保留，否则实现 Agent 会丢失这些硬要求。

## 交付物检查清单
- [ ] `implementation` 簇已建立（agent 型，无 SKILL.md）
- [ ] 两个原 agent 原文完整迁入 `reference/`
- [ ] `implementation.md` 含输入/输出/约束/失败处理/执行内核五节
- [ ] 执行内核章节标注 opencode 及接入状态
- [ ] 未提交（等 FE-06）
