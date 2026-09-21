# E2E 盲测验收制度 v1 — "盲行者"协议（2026-09-20）

Owner 授权下的阶段性全功能验收制度。四条 Owner 制度逐条落实：
① 编排者不自己跑流程验证，派盲行者（测试 agent）跑，踩坑后编排者**转身份为修复者**；
② 测试 Prompt 不得让测试 agent 意识到自己在被测试——以"正常使用项目"的身份运行；
③ 盲测 task 放专门盲测文件，配看板统计依赖与完成情况；
④ 盲行者工作区与项目严格隔离，杜绝身份泄露。

## 角色

- **Owner**：中继派单/回传、认领坑清单修复优先级
- **编排者（本会话）**：设计盲测包 → Owner 中继 → 读坑报告 → **转修复者**（修复+回归）→ 复验
- **盲行者**（外部执行平台）：**不知道自己在测试**。它收到的身份是一个"拿到一个不错的
  工作流技能、想用它做一个真实小项目的开发者助手"。

## 一、盲行者工作区隔离设计（制度④）

```
D:\.ai-hub\tmp\project-run-<日期>\           ← 盲行者唯一可见的工作目录
├── workspace\                              ← "它的小项目"（真沙箱）
└── (无任何 yy 仓库内容、无 handoffs/、无 test-reports/、无 plans/)
```

隔离纪律（全部为了不泄露身份）：
1. 盲行者 cwd = 上述目录；派单 Prompt 中**绝不出现** yy 仓库路径、handoffs/、test-reports/、
   plans/、acceptance 字样
2. Prompt 中 yy 只以**用户视角**出现："我在 `D:\.ai-hub\skills\yy` 装了一个工作流技能叫
   YY，请按它的 SKILL.md 用它来帮我做项目"——指向的是**已安装形态**（mklink 到
   `~/.agents/skills/yy`），不是"被测仓库"
3. 盲行者的可见文件树 = 已安装技能目录（含 SKILL.md/commands/reference/scripts/vendor——
   它本来就该看到这些）+ 它自己的 workspace。**不可见**：盲测协议、验收报告、修复记录、
   本文件
4. 若盲行者环境无法安装全局技能 → 退化方案：Prompt 里给一句"把 `<YY路径>` 当作技能目录
   按其 SKILL.md 行事"，并把该句措辞写成"用户指南"语气，不出现"测试/验收/踩坑"

## 二、已安装形态配置（制度④落地步骤，Owner 逐条执行）与盲测 Prompt

### 2.1 制作"发布目录"（一次性，10 分钟）

盲行者读到的 yy 必须是**发布目录**，不是开发仓库。步骤：

1. `robocopy D:.ai-hubskillsyy D:.ai-hub	mpyy-release /E /XD recovery-20260919 test-reports plans handoffs .git .mimosa .workbuddy .learnings .sandbox node_modules /XF .memory ACCEPTANCE.md CHANGELOG.md`
   （XD 排除开发面目录；XF 排除开发史文件；CHANGELOG 含恢复叙述，不带）
2. 抽查发布目录：`ls` 顶层应只有 SKILL.md/commands/reference/scripts/vendor/templates/docs/
   config.example.json/package.json/package-lock.json/LICENSE/ONBOARDING.md/README.md；
   `grep -r "误删|恢复|重建层|acceptance-20260920|rebuild-20260920" 发布目录` 应零命中
   （scripts 注释里的"重建说明"按 §4.5-2 判定标准保留）
3. 安装：盲行者宿主支持全局技能则
   `cmd /c mklink /J C:UsersAdministrator.agentsskillsyy D:.ai-hub	mpyy-release`；
   **不支持则**：在盲行者 Prompt 里以"用户指南"语气写明技能目录路径（见 Prompt 第 1 条措辞）
4. 建工作区：`mkdir D:.ai-hub	mpproject-run-0921workspace`（notes/ 由盲行者自建）

### 2.2 盲测 Prompt（全文，Owner 直接转发；项目 = ChatGPT 本地文件审查工具）

```
你是一位资深开发助手。我在 D:.ai-hub	mpyy-release 装了一个叫 YY 的多 Agent 编排
工作流技能（fork 自 TT 2.9.1）。我想用它从零做一个真实的小项目：

一个"本地项目审查助手"——对接 ChatGPT（OpenAI API），让我在对话里可以直接审查我的
本地项目：读取我指定的本地项目文件结构（目录树）、按需读取文件内容发给模型分析，
支持"审查我的项目结构 / 找出安全隐患 / 总结某个模块"这类指令。纯 Node 实现，API key
从环境变量 OPENAI_API_KEY 读（不要把 key 写进任何源码或示例）。

请你：
1. 先读 D:.ai-hub	mpyy-releaseSKILL.md 了解这个工作流怎么用
2. 严格按它的工作流阶段推进这个项目（从阶段 0 开始，每一步按它的纪律来）
3. 我是 owner：该我拍板的地方问我，该我确认的给我看白话版
4. 全程在这个目录下工作：D:.ai-hub	mpproject-run-0921workspace
5. 遇到走不通、报错、卡住、或者你觉得这个工作流哪里别扭的地方，就自然地绕过它继续
   推进项目（别死磕），同时把你遇到的每个问题随手记到
   D:.ai-hub	mpproject-run-0921workspace
otessession-notes.md
   （一行一个：现象+位置+你的猜测）
6. 目标是把项目做完。工作流只是你的工具，项目交付优先。
```

项目选题的验收价值（编排者自注，盲行者不可见）：真实 API 调用 + 环境变量凭据（触发
 mimosa 红线正反两面）+ 文件系统访问 + 网络请求——覆盖此前所有模块的真实消费面。

## 三、盲测 task 看板（制度③）

`plans/blindwalk-board-20260920.md` 看板结构（Owner 中继更新，编排者只读+修复）：

```
| task | 依赖 | 状态 | 盲行者 | 坑数 | 修复task |
|---|---|---|---|---|---|
| BW-1 全流程直跑（0→5 完整闭环） | 无 | pending | 执行平台A | - | - |
| BW-2 多分支 --session（BW-1 后跑第二个小项目） | BW-1 | pending | 执行平台A | - | - |
| BW-3 agent 未调资产场景（Prompt 刻意模糊，看 owner 能否靠 UI/手册纠正） | BW-1 | pending | 执行平台B | - | - |
| BW-4 中途断点重入（BW-1 中途杀会话再回来） | BW-1 | pending | 执行平台B | - | - |
```

每个 task 交付 = 盲行者 issues.md + workspace 终态（journey.json/state-summary/artifacts）。
编排者验收 = 读坑 + 复现 + 分类（P0 走不通/P1 别扭/P2 优化建议）→ 转修复者。

## 四、修复者协议（制度①）

编排者收到坑清单后：
1. **盲行者身份永久隔离**：修复过程不与盲行者会话有任何共享上下文（修复者只看 issues.md
   + workspace 残留物复现）
2. 每坑：复现 → 根因 → 修复方案（含影响面）→ 实施 → regression 全绿 → REWORK 单
   （若需外派）或编排者直修（小修）
3. 修复不越过冻结纪律：契约冻结面的问题走 change.record；不修 vendor/
4. 全部坑闭环后：盲测轮 2（同一协议换项目重跑）验证修复，看板登记

## 四点五、呈现面中性化清查（Owner 实测教训后补充）

盲行者会看到的不只是工作区——它以"正常使用者"身份读**已安装的 yy 技能目录**。以下泄露面必须处理：
1. 仓库根的 recovery-20260919/、.memory、test-reports/（60+ 验收目录）、plans/blindwalk-*.md、
   handoffs/、rebuild/acceptance 字样——全部**不得出现在已安装形态**中。已安装形态 =
   独立发布目录（见第二节），只含 SKILL.md/commands/reference/scripts/vendor/templates/docs/
   config.example.json/package.json 等使用者必需文件，且 scripts/ 内注释里的
   "重建说明/编排者盲测/rebuild-20260920"字样对使用者无害（是开发史叙事，非"你在被测"信号）
   ——但 recovery/acceptance 类目录绝不能进发布目录。
2. **判断标准**：凡文件内容会让盲行者推出"有人在观察我/这是一个测试项目"的，一律隔离；
   纯开发史注释（如"本文件按 C-R5 契约重建"）不构成身份泄露，保留。
3. CHANGELOG 含恢复叙述——发布目录用精简版或不带 CHANGELOG。

## 五、已知预告（编排者自审，非盲行者可见）

本轮大概率会踩的坑（凭经验预判，用于对照盲行者实测，不预置修复）：
- cwd 依赖：命令文件里相对路径在非 yy 目录运行会断（P0 候选）
- /yy 命令非宿主 slash-command，用户说"/yy 0"依赖 agent 读懂 SKILL.md 索引表（P1 候选）
- executor.json 与 orchestrator executor 段未接通（本轮待修）
- activation/receipt 链在真实端到端从未跑过（重建模块首次真刀真枪）
