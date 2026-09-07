# prd-writer

> 一个封装了产品经理核心思维的 skill，帮助非产品经理用户写出高质量的产品需求文档（PRD）。
> A skill that encodes core product management thinking to help non-PM users write high-quality Product Requirement Documents.

---

## 简介 / Introduction

**中文**

`prd-writer` 把产品经理的核心思维封装进了 skill，让有产品想法但不懂写 PRD 的用户，也能系统地把想法变成可执行的需求文档。

适合场景：
- Vibe coding 场景中的独立开发者
- 想做产品但没有 PM 背景的创业者
- 需要把模糊想法结构化的任何人

**English**

`prd-writer` encodes core product management thinking into a skill, helping users who have product ideas but lack PRD experience to systematically turn their ideas into actionable requirement documents.

Best for:
- Solo developers in vibe coding workflows
- Entrepreneurs without a PM background
- Anyone who needs to structure a fuzzy product idea

---

## 核心功能 / Features

**三种工作模式 / Three modes:**

| 模式 | 触发条件 | Mode | Trigger |
|------|---------|------|---------|
| **模式 A：从零生成** | 有想法，还没有文档 | **Mode A: From Scratch** | Have an idea, no doc yet |
| **模式 B：评估改进** | 已有文档，想检查或优化 | **Mode B: Review & Improve** | Have a doc, want feedback |
| **模式 C：增量更新** | 已有文档，想追加新需求 | **Mode C: Incremental Update** | Have a doc, want to add features |

**分两阶段交付 / Two-phase delivery:**
1. **概念版**（方向对齐）→ 先确认方向再展开细节
   **Concept doc** (direction alignment) → Confirm direction before detailing
2. **落地版**（完整细节）→ 可直接交给 AI 或开发者实现
   **Implementation doc** (full detail) → Ready to hand off to AI or developers

**自动补全小白盲区 / Auto-fills non-PM blind spots:**
- 交互细节（操作反馈、空状态、失败引导）
- 状态机（每个 UI 元素的所有状态）
- 数据规范（字段类型、长度、校验规则）
- 双受众文案规范（开发侧 vs 终端用户侧）
- 关键页面 ASCII 线框图

---

## 安装 / Installation

### 方式一：Claude Cowork（自动触发）

将本仓库克隆到你的 `.claude/skills/` 目录下，重启 Cowork 即可自动触发：

Clone this repository into your `.claude/skills/` directory and restart Cowork:

```bash
cd /path/to/your/cowork-folder/.claude/skills
git clone https://github.com/chituai/prd-writer.git
```

安装后，在 Cowork 中提到「PRD」「需求文档」「我想做个产品」等关键词时，skill 会自动激活。

After installation, the skill auto-activates in Cowork when you mention keywords like "PRD", "requirements doc", or "I want to build a product".

### 方式二：任意 AI（手动粘贴）

查看 [PROMPT.md](./PROMPT.md)，将其中的 System Prompt 复制粘贴到任意 AI 对话框的 system prompt 位置即可使用。

See [PROMPT.md](./PROMPT.md) — copy the system prompt inside and paste it into the system prompt field of any AI interface.

### 方式三：Claude Code / Open Claw 等支持读取文件的工具

在对话开始时，让 AI 读取 `SKILL.md` 并将内容带入上下文：

For tools like Claude Code or Open Claw that can read local files, load the skill at the start of your conversation:

```
# Claude Code
请读取 ./prd-writer/SKILL.md，并按照其中的指令帮我写一份 PRD。

# Open Claw 或其他支持文件读取的工具
Read prd-writer/SKILL.md and follow its instructions to help me write a PRD.
```

或者在项目的 `CLAUDE.md` / 系统配置中引用，让 AI 每次自动加载：

Or reference it in your project's `CLAUDE.md` / system config so it loads automatically:

```
@./prd-writer/SKILL.md
```

---

## 使用方法 / Usage

直接在 Claude Cowork 中用自然语言描述你的想法即可触发本 skill：

Just describe your idea in natural language in Claude Cowork — the skill will activate automatically:

> "我想做一个帮自由职业者记录工作时间的工具"
> "I want to build a tool that helps freelancers track their work hours"

> "帮我检查一下这份需求文档有没有问题"
> "Can you review this PRD for me?"

> "帮我在现有文档里加一个通知功能的需求"
> "Add a notifications feature to my existing PRD"

**触发关键词 / Trigger keywords:**
需求文档、PRD、产品需求、功能文档、我想做一个产品/App/工具、帮我整理需求、帮我补充需求

---

## 工作流程 / Workflow

```
用户描述想法
     ↓
三视角诊断（用户需求 / 商业可行 / 技术落地）
     ↓
输出【概念版】→ 用户确认方向
     ↓
输出【落地版】→ 可直接用于开发
```

```
User describes idea
     ↓
3-lens diagnosis (User needs / Business viability / Technical feasibility)
     ↓
Output [Concept Doc] → User confirms direction
     ↓
Output [Implementation Doc] → Ready for development
```

---

## 文件结构 / File Structure

```
prd-writer/
├── SKILL.md      # Claude Cowork 专用指令 / Cowork-specific skill instructions
├── PROMPT.md     # 通用 System Prompt，适用于任意 AI / Universal system prompt for any AI
├── README.md
├── LICENSE
└── .gitignore
```

---

## 许可证 / License

MIT License — see [LICENSE](./LICENSE) for details.

---

## 作者 / Author

Made by [Chitu](https://github.com/chituai)
