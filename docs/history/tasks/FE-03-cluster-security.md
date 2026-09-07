# Task: FE-03 资产簇化：安全簇（3 → 1）

## 概述
把 `audit`（审计）、`harden`（加固）、`be-security`（后端安全 agent）合并为一个 `security` 簇，统一 SAST 内核说明（`semgrep`），并保留三者各自的阶段职责：审计发现问题 → 加固修复 → 后端安全专项检查。

## 所属与定位
- **阶段**：MVP / Phase 1（簇化）
- **层级**：Frontend（资产层）
- **上游依赖**：无
- **下游被依赖**：FE-06（资产表更新）、BE-04（候选资产名同步）

## 目标与非目标
**目标**
- 建立 `vendor/security/`（skill 型，含 `SKILL.md`）。
- 三阶段职责分明：audit（发现） → harden（加固） → be-security（后端专项验证）。
- 统一工具内核说明为 `semgrep` + `gitleaks`（依据 `COMPETITORS.md`）。

**非目标**
- 本任务只做重组与口径统一，**不实际接入** semgrep/gitleaks（属 Next 阶段）。
- 不删除各来源资产的许可与溯源信息。

## 前置条件
- 已阅读 `vendor/audit/SKILL.md`、`vendor/harden/SKILL.md`、`vendor/be-security/be-security.md`。
- FE-01/FE-02 可并行，互不重叠。

## 输入
- `vendor/audit/`、`vendor/harden/`、`vendor/be-security/`

## 需要创建 / 修改的文件

| 文件 / 目录 | 动作 | 说明 |
|---|---|---|
| `vendor/security/SKILL.md` | 创建 | 簇入口：三阶段流程与索引 |
| `vendor/security/reference/audit.md` | 创建（迁入） | 原 `audit/SKILL.md` |
| `vendor/security/reference/harden.md` | 创建（迁入） | 原 `harden/SKILL.md` |
| `vendor/security/agents/be-security.md` | 创建（迁入） | 原 `be-security/be-security.md`（嵌套 agent，不再是顶层 AGENT_ENTRIES） |
| `vendor/security/LICENSES.md` | 创建 | 登记来源许可 |
| `vendor/{audit,harden,be-security}/` | 删除 | 合并后移除 |

## 实现步骤
1. 列出三者独有内容清单（audit 的审计维度、harden 的加固手段、be-security 的后端安全检查项）。
2. 创建 `vendor/security/`，按上表迁入。
3. 编写 `vendor/security/SKILL.md`：
   - frontmatter：`name: security`，`version: 1.0.0`，description 涵盖审计/加固/后端安全三阶段。
   - 正文定义三阶段流程：
     - **阶段 A 审计（audit）**：识别问题，输出问题清单与严重级别。
     - **阶段 B 加固（harden）**：针对问题做加固，输出加固方案与验证方式。
     - **阶段 C 后端专项（be-security）**：面向后端接口/依赖/密钥的专项检查。
   - 新增「统一工具内核」段：`semgrep`（多语言 SAST，规则可版本化）+ `gitleaks`（密钥泄露扫描），并注明这是 `COMPETITORS.md` 的结论、**当前为说明性引用，未实际接入**。
4. 保留 `.openclaw/source-origin.json` 溯源信息（若存在，迁入簇内）。
5. 删除三个旧目录；暂不提交，等 FE-06。
6. **重要**：`be-security` 从顶层 agent 变为簇内嵌套 agent，需在 FE-06 中从 `AGENT_ENTRIES` 移除。

## 关键契约 / 数据结构

```yaml
# vendor/security/SKILL.md frontmatter
---
name: security
description: 统一安全簇：审计发现 → 加固修复 → 后端安全专项验证
version: 1.0.0
---
```

```
vendor/security/
  SKILL.md
  LICENSES.md
  reference/
    audit.md        # ← audit
    harden.md       # ← harden
  agents/
    be-security.md  # ← be-security（嵌套，非顶层条目）
```

## 验收标准（Given / When / Then）
- Given 合并完成，When 检查 `vendor/`，Then `audit`、`harden`、`be-security` 三个目录不存在，`security` 存在且含 `SKILL.md`。
- Given `vendor/security/SKILL.md`，When 检查 frontmatter，Then `name=security`、`version=1.0.0`。
- Given 需要审计的用户，When 阅读簇文档，Then 能找到审计阶段（原 audit）的完整方法与指向 `reference/audit.md` 的路径。
- Given 需要后端安全专项检查，When 阅读簇文档，Then 能找到指向 `agents/be-security.md` 的路径，且该文件保留原 `be-security.md` 的检查项。
- Given 簇文档，When 检查「统一工具内核」段，Then 明确写出 semgrep 与 gitleaks，且**标注为说明性引用、未接入**（不误导后续 Agent 以为已实现）。
- Given 合并后，When 在 FE-06 中检查 `AGENT_ENTRIES`，Then `be-security` 已被移除（不再是顶层条目）。

## 验证命令
```bash
cd D:/.ai-hub/skills/tt
ls vendor | grep -E "audit|harden|be-security|security"   # 期望只有 security
ls vendor/security/reference vendor/security/agents
diff <(git show HEAD:vendor/be-security/be-security.md) vendor/security/agents/be-security.md && echo "内容一致"
```

## 失败与回滚
- 失败：be-security 检查项丢失 → 用 `git show HEAD:vendor/be-security/be-security.md` 对比恢复。
- 回滚：`git checkout -- vendor/`（未提交前提下）。

## 风险与注意
- `be-security` 由顶层 agent 降级为嵌套 agent，是**类型变化**，必须与 FE-06 的 `AGENT_ENTRIES` 更新同步，否则 `validate-structure.mjs` 会报条目不匹配。
- 「统一工具内核」段落容易被后续 Agent 误读为「已集成」——务必写明状态。
- 三者都涉及安全，合并时不要把 audit 的「发现问题」与 harden 的「修复问题」混成一段，阶段要可区分。

## 交付物检查清单
- [ ] `security` 簇已建立，三个旧目录已删除
- [ ] 三阶段流程清晰可区分
- [ ] `be-security` 已嵌套为 `agents/be-security.md` 且内容一致
- [ ] semgrep/gitleaks 说明已标注未接入
- [ ] `LICENSES.md` 已登记
- [ ] 未提交（等 FE-06）
