# T17 调研报告：多阶段工作流上下文注入膨胀的竞品机制

> 生成日期：2026-09-07 · 方法：GitHub API（repos 端点实时数据）+ raw.githubusercontent.com + 官方文档站抓取
> 目的：为 TT「阶段化 Prompt 概要注入 + 状态外置」方案提供竞品借鉴，只借设计、不引依赖（TT 零依赖 Node）
> 数据核验说明：所有 stars/license/pushed_at 均来自 2026-09-07 当日 GitHub API 实时返回，非凭记忆。

---

## 0. 痛点 → 机制映射

| TT 痛点 | 需要的机制 | 对应竞品 |
|---|---|---|
| 每阶段手动复制粘贴固定 Prompt | 斜杠命令/阶段化 prompt 注入 | SuperClaude、anthropics/skills |
| 会话长了不知到哪个阶段、跳阶段 | 会话状态外置 + 人工 gate 显式化 | BMAD-METHOD、claude-flow(ruflo) |
| 全量注入 SKILL.md/指南浪费上下文 | 渐进披露（三级加载） | agentskills.io 规范（anthropics/skills） |
| 多会话/多 agent 交接丢上下文 | 上下文持久化进文件随代码走 | BMAD、ruflo（轻量借鉴） |

---

## 1. 竞品对比表（2026-09-07 实时核验）

| 竞品 | URL | Stars（实时） | License | 核心机制 | TT 可借鉴点 |
|---|---|---|---|---|---|
| **anthropics/skills**（Agent Skills 标准实现） | https://github.com/anthropics/skills | 174,878（forks 20,708） | 多数 Apache-2.0；docx/pdf/pptx/xlsx 子目录为 source-available（API license 字段为空，混合许可） | **渐进披露三级加载**（agentskills.io/specification 原文）：① 元数据 ~100 token，启动时全部加载（name+description）；② SKILL.md 正文激活时加载，**建议 <5000 token / <500 行**；③ `references/`、`scripts/`、`assets/` **按需才加载**。规范明文："Keep individual reference files focused. Agents load these on demand, so smaller files mean less use of context." | TT 的阶段摘要注入直接套此三级模型：`/tt <阶段>` 注入的就是"第②级"（几百 token），详细规则留在第③级文件给路径。**这是业界已验证的标准，不是自造轮子** |
| **SuperClaude-Org/SuperClaude_Framework** | https://github.com/SuperClaude-Org/SuperClaude_Framework | 23,871（forks 2.0k） | MIT | ① **30 个 `/sc:*` 斜杠命令**覆盖完整生命周期（brainstorm→implement→test→pm），每个命令 = 行为化指令注入；② **状态外置三文件**：PLANNING.md/TASK.md/KNOWLEDGE.md，"Claude Code reads these files at session start"；③ `/save` `/load` 会话管理（Save & restore state）；④ 7 种行为模式按上下文自适应 | ① 斜杠命令作为"阶段 prompt 注入"的载体形态（TT 的 `/tt <阶段>` 与 `/sc:implement` 同构）；② 会话开始读外置状态文件的惯例；③ **反面教训**：SuperClaude v5.0 的 TS 插件系统跳票（README 明示 "not yet available, no ETA"）——纯 markdown/命令文件形态的迁移成本远低于构建安装器 |
| **bmad-code-org/BMAD-METHOD** | https://github.com/bmad-code-org/BMAD-METHOD | 52,733（forks 5,980） | MIT（README badge；GitHub API license 字段 NOASSERTION，因其 LICENSE 含自定义声明） | ① **"Durable context" 哲学**（README 原文）："Carry product and technical decisions forward instead of re-explaining them in every chat"；② **上下文块标记外置**：`bmad-project-context` 把最小化已验证上下文写入 AGENTS.md 的 `<!-- bmad:context -->`...`<!-- /bmad:context -->` 标记之间，后续运行只碰标记内内容，块外不动；③ **只装"贵的"**（What Earns a Line）："Repo overviews, directory trees, and tech-stack lists never enter: agents read code better than prose about code"——只存重新发现代价高的事；④ **人工 gate 显式化**：plan 先给用户 approve 才执行；⑤ 块要"smaller or equal, never larger"（audit 纪律） | ① TT 状态文件的最小化纪律：只记"阶段+gate 通过+产物路径"，不复述文档内容；② **标记块机制**可直接抄：TT state 写在 `.tt/state.md` 固定标记间，agent 每阶段结束自查更新；③ 跳阶段防线 = BMAD 式"先 approve 再执行"（对应 TT 已有的概念版签收/契约审阅 gate，用 state 文件显式化） |
| **ruvnet/claude-flow（现名 ruflo，GitHub 301 重定向）** | https://github.com/ruvnet/claude-flow → https://github.com/ruvnet/ruflo | 71,020（forks 8,438；重定向后 star 计数归属 ruflo） | MIT | ① **记忆外置 + 命名空间**：`memory_store`/`memory_search` MCP 工具，AgentDB/HNSW 向量记忆（~1.9x 快于暴力检索 @20k）；② hooks 自动路由：`init` 后"不需要学 314 个 MCP 工具，hooks 系统自动路由任务、从成功模式学习"；③ swarm 拓扑 + GOAP A* 状态空间规划（goal.ruv.io）；④ 双安装路径：Claude Code 插件（零文件）vs CLI 全家桶（写 `.claude-flow/` 等） | ① **命名空间化记忆**思想可借：TT state 按项目分文件（`.tt/<project>/state.json`），agent 只读当前项目命名空间；② hooks 自动注入可作 TT 远期方向（opencode 有 hook 机制）——但**向量记忆/swarm 明确不借**（TT 零依赖 Node，文件态足够，ruflo 自己 README 都承认 314 工具是学习负担） |
| Significant-Gravitas/AutoGPT | https://github.com/Significant-Gravitas/AutoGPT | 187,178 | NOASSERTION（API 字段） | agent state 持久化（本轮只核验仓库元数据，机制细节未深挖） | 本轮未深挖其 state 机制，**诚实标注：不作为借鉴依据**。其 state 思路已被 BMAD/ruflo 两条线覆盖 |

> 勘误：TT 仓库 `COMPETITORS.md` 记 claude-flow ~61k stars，2026-09-07 实测重定向后 ruflo 为 71,020；`SuperClaude-OSS/SuperClaude` 已 404，现名 `SuperClaude-Org/SuperClaude_Framework`（23,871）。

---

## 2. 结论：TT 该借什么（3 个机制，全部纯 markdown/文件形态）

### 机制 A：渐进披露三级模型（借自 agentskills.io 规范，已被 anthropics/skills 验证）

**这是本次调研最强的"不重复造轮子"锚点**：TT 拟定的"先摘要后按需读详情"不是新发明，而是 Agent Skills 官方规范的明文要求，且给出了可用的量化预算：

- 第①级：`/tt` 命令本身的一行 description（~100 token，常驻）
- 第②级：`/tt <阶段>` 注入的**阶段摘要**，预算对齐规范"<5000 token"的收紧版 → **300-500 token**（含：该阶段目标、人工 gate 清单、纪律钥匙词、产物路径）
- 第③级：`docs/TT-USER-PROMPT-GUIDE.md` 对应章节 + SKILL.md 相关节，**只给相对路径让 agent 按需 Read**（规范原文："smaller files mean less use of context"）

### 机制 B：阶段命令文件（借自 SuperClaude 的 /sc:* 形态）

落地形态（零依赖，纯 markdown）：

```
commands/
  tt-0-init.md        # /tt 0-立项：注入阶段 0 摘要 + gate 清单
  tt-1-requirement.md # /tt 1-需求挖掘
  tt-2-planning.md    # /tt 2-拆任务
  tt-3-contract.md    # /tt 3-契约冻结
  tt-4-execute.md     # /tt 4-派单执行
  tt-5-critique.md    # /tt 5-验收批判
```

每个文件 = YAML frontmatter（name/description 一行）+ 300-500 token 阶段摘要 + 详情路径指针。SuperClaude 用 30 个命令验证了"斜杠命令 = 行为注入单元"的可行性；TT 只需 6 个，且不需要 SuperClaude 的 pipx 安装器（其 TS 插件跳票即是教训——纯文件形态免安装链路风险）。

### 机制 C：状态外置 + 标记块 + 最小化纪律（借自 BMAD）

落地形态（state 文件 schema，`.tt/state.json` 或项目根 `.tt/state.md`）：

```json
{
  "project": "<项目名>",
  "updated_at": "2026-09-07T12:00:00Z",
  "current_phase": "contract",
  "phases": {
    "init":        { "status": "done",   "gates_passed": ["concept-signed"],          "artifacts": ["docs/PRD.md"] },
    "requirement": { "status": "done",   "gates_passed": ["forcing-questions-closed"], "artifacts": ["docs/REQ.md"] },
    "planning":    { "status": "done",   "gates_passed": ["precondition-confirmed", "review-gate-plan"], "artifacts": ["docs/tasks/"] },
    "contract":    { "status": "in_progress", "gates_passed": [], "artifacts": [] },
    "execute":     { "status": "pending", "gates_passed": [], "artifacts": [] },
    "critique":    { "status": "pending", "gates_passed": [], "artifacts": [] }
  }
}
```

三条纪律（全部有 BMAD 原文背书）：
1. **最小化**：只记阶段/gate/产物路径，禁止复述文档内容（"agents read code better than prose about code"——TT 对应"agent 自己会读 artifacts"）
2. **只增不减不膨胀**：audit 时"smaller or equal, never larger"
3. **读在会话开始、写在 gate 通过后**：`/tt <阶段>` 注入时先读 state——若前置阶段 `status != done`，注入警告（"阶段 3 契约未冻结，前端不得开工"），**这就是跳阶段问题的机器可校验防线**，比 prompt 里反复叮嘱可靠

### 明确不借（防过度设计）

- ❌ ruflo 的向量记忆/AgentDB/HNSW/swarm——TT 零依赖 Node，JSON/MD 文件态足够；ruflo 自己都承认 314 个 MCP 工具是用户负担
- ❌ SuperClaude 的 pipx 安装器 + MCP 集成——TT 保持零依赖，安装器是它跳票的重灾区
- ❌ AutoGPT 的自治循环——与 TT"人守 gate"哲学相反
- ❌ BMAD 的 uv/Python 依赖链——TT 的 `npx`/零依赖是优势，别丢

### 与 TT 既有资产的衔接

- `docs/history/handoffs/`（会话交接）→ state 文件是 handoff 的机器可读版，两者互补不冲突
- `SKILL.md` → 按 agentskills.io 规范自查行数（<500 行），超了把阶段详情拆到 `references/`
- TT-USER-PROMPT-GUIDE.md 的 6 个阶段 Prompt 原文 → 改写为 6 个 command 文件的正文（内容已有，只做压缩+加路径指针，无新写作量）

## 3. 诚实声明

- 4 个核心竞品的 stars/license/pushed 均为 GitHub API 2026-09-07 实时返回；BMAD 的 license 在 API 中为 NOASSERTION（自定义 LICENSE 文件），README badge 标 MIT，两处均已如实标注
- AutoGPT 仅核验仓库元数据（187,178 stars），其 agent state 机制细节未深挖，不作借鉴依据
- SuperClaude README 经 webfetch 多次超时/404，最终通过 GitHub HTML 页面抓取核验（stars 23.9k 与 API 23,871 互证）；其分支 `master` 存在（README.md 位于 master），`main` 不存在
- agentskills.io 渐进披露的 token 数字（~100/<5000/按需）与 500 行上限均为规范原文，非推测