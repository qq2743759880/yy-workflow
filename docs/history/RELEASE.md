# TT（Together Agent）v2.1.1 · 发布说明（Release Notes）

> 多 Agent 平台编排闭环方法论（开源通用版）。一个编排者调度多个 AI 平台并行完成大项目，并在每次执行后把经验回写本 skill 自进化。
> 本版本为**自包含（self-contained）**版，所有增强资产随包内置，离线即可使用。

- 仓库：`tt`
- 版本：`2.1.1`（2026-08-28）
- 许可：MIT（随包 `vendor/` 资产遵循各自原有许可）

---

## ✨ 亮点

- **自包含**：16 个增强资产随包内置在 `vendor/`（需求挖掘 / 设计系统 / 前端链 / 调研 / 视觉质检 / 安全扫描），**无需任何外部 AI-Hub**，离线即用。
- **可移植**：所有资产引用走 `$SKILL_DIR`（= SKILL.md 所在目录），**0 处机器专属路径泄露**（无 `D:\` / `/Users/` / `Administrator`），任意用户把本目录整体拷贝即可直接运行。
- **SkillOps 优化**：两轮维护扫描（17 节点技能图），**0 冗余簇**，备选关系（prd-writer↔vibe-coding-prd、audit↔critique）正确保留；补 16 条 `frontmatter_version_present` 校验器 + 1 条 `frontend-design→frontend-visual-validation` 适配边。
- **机器可校验**：`scripts/validate-structure.mjs` 覆盖 frontmatter / 8 步闭环 / 变量声明 / vendor 资产 / 接口漂移 / 可移植性 六项检查。

---

## 📦 随包内置资产（16 个，位于 `vendor/`）

| 类别 | 资产 |
|------|------|
| 核心规划 | dev-planner（只读规划 agent） |
| 需求挖掘 | prd-writer、vibe-coding-prd |
| 设计系统 | ui-ux-pro-max、taste-skill |
| 前端链 | frontend-design、prototype、colorize、polish、audit、critique、pick-ui-library、frontend-visual-validation |
| 调研 | agent-research（29 子技能 hub） |
| 视觉质检 | agent-vision-toolkit |
| 安全扫描 | skill-sentinel |

---

## 🚀 安装

**方式 A · 手动**：把 `tt` 目录整体放到你客户端的 skills 目录：

```text
WorkBuddy : ~/.workbuddy/skills/tt          (Windows: %USERPROFILE%\.workbuddy\skills\tt)
Claude Code: ~/.claude/skills/tt            (或 项目/.claude/skills/tt)
Codex      : ~/.codex/skills/tt
Cursor/Roo : 参照各自 skills 目录约定
```

**方式 B · 安装脚本**（推荐）：

```bash
# Linux / macOS
./install.sh                 # 默认装到 ~/.workbuddy/skills/tt
./install.sh --client claude # 装到 ~/.claude/skills/tt
./install.sh /path/to/skills/tt

# Windows (PowerShell)
.\install.ps1                       # 默认装到 $env:USERPROFILE\.workbuddy\skills\tt
.\install.ps1 -Client claude
.\install.ps1 "C:\path\to\skills\tt"
```

安装脚本会拷贝整个 `tt` 目录并自动跑一次 `validate-structure.mjs` 自检。

**校验**：

```bash
node scripts/validate-structure.mjs --verbose
```

详见 [`README.md`](./README.md) 与 [`OPTIMIZATION.md`](./OPTIMIZATION.md)。

---

## 🔧 自 v2.0.0 以来的主要变更

- **v2.1.0 · 自包含化 + SkillOps 首轮优化**
  - 16 个资产随包内置 `vendor/`；新增 `$SKILL_DIR` 变量，`$AIHUB_ROOT` 降级为可选外部覆盖。
  - 去硬编码：agent-research 内 `/Users/lingzhi/...` → `<USER_HOME>`；tt 自身经可移植性校验零泄露。
  - 脚本独立化：缺 `$AIHUB_ROOT` 时从脚本自身位置解析，离线可用。
- **v2.1.1 · 接口一致性 + 可移植性收尾（SkillOps 2nd-iteration）**
  - 为 14 个标准 `SKILL.md` 资产补 `version: 1.0.0`；`agent-research` 新增索引 `SKILL.md`（原无顶层 SKILL.md）。
  - `skill-sentinel` 品牌硬编码 "Tgent 插件市场" → "插件市场"（去上下文耦合）。
  - `validate-structure.mjs` 新增 **⑥ vendor frontmatter 一致性** + **⑦ vendor 可移植性** 两项检查（落实 SkillOps `add_validator` 动作），并修复 CRLF 容错。

---

## 📄 许可证

本 skill（TT）以 **MIT** 许可分发。`vendor/` 内各随包资产遵循其**原有许可证**，详见各资产目录内的 `LICENSE` / `NOTICE` 文件；分发时请保留各自版权与许可声明。
