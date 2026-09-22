# T3 报告：frontend-design 从薄入口升级为可执行设计工作流

## 结论
完成。frontend-design 顶层 SKILL.md 已从 34 行薄入口升级为带显式可执行调用路径的设计工作流，解决"执行 agent 不主动读参考库"的根因。改动集中在 `vendor/frontend-design/SKILL.md`，reference/ 与 scripts/ 未动。

## 改动文件
- `~/.ai-hub/skills/tt/vendor/frontend-design/SKILL.md`（唯一改动文件，34 行 → 51 行）

## 改动点
1. **新增强制两步前置声明**（文件顶部引言）：所有设计任务产码前必做 ①taste-skill 工作流 ②search.py 数据检索，堵住"跳过即交付"。
2. **Anti-template taste 节改为可执行工作流**：明确命令式步骤——§0.B 出 Design Read 一行 → §1.A 三 dials 取值 → 交付前跑 §14 Pre-Flight Check（50+ 项矩阵，任一不过则返工，含 em-dash 禁令）→ 复用 9 个现成块并逐条列出 `reference/taste-blocks/<category>/<name>.md` 完整路径。
3. **Design data and search 节给出可执行命令**：`python <frontend-design>/reference/design-data/scripts/search.py "<query>" --domain <ux|style|color|typography|gsap|chart>`，列明各 domain 对应 CSV 及数据量（119 UX 指南/79 风格/192 色板/74 字体），要求用返回真实数据决策。缺失 Python 时诚实降级（直读 CSV 或标注未检索），不假报。
4. **可移植性修正**：初版命令中写死的机器绝对路径触发 validate-structure 可移植性校验 2 项错误，改用 TT 变量 `$SKILL_DIR/vendor/frontend-design`（执行时可解析，且通过校验）。

## 未改动（验收约束遵守）
- **frontmatter**：name/description/version 原样保留。
- **Execution kernel 段**（标题 + Kernel 行 + Invocation/Degradation）逐字未动，S3 漂移门不破。
- **reference/** 全部文件（taste-skill.md 1202 行、taste-blocks 9 块、design-data data/scripts/tests）零改动。
- **scripts/**（validate-structure.mjs 等编排内核）零改动。

## 验证结果
- `C:\Python314\python.exe ...\scripts\search.py "error summary validation" --domain ux` → 正常返回 3 条真实 UX 指南（Source: ux-guidelines.csv），命令可用。
- `node ~/.ai-hub/skills/tt/scripts/validate-structure.mjs` → **[OK] 结构校验通过 (0 项警告)**；接口漂移/可移植性泄露/编码损坏均为"无"，随包资产 16/16。
- `git status` 确认 vendor/frontend-design 下仅 `SKILL.md` 一处修改。

## 诚实说明
- 无法在本环境实证"执行 agent 一定会按新流程走"（属行为层面，非静态可测）；本改动消除的是静态层面根因——此前仅提及路径无命令，现在给出可直接执行的命令与强制步骤。
- validate-structure 初次运行曾报 2 项错误，系本次新增命令中绝对路径所致，已修（见改动点 4），非前置历史问题。
