# M1 技术批判报告（yy journey 阶段导航 + commands 注入）

- 日期：2026-09-07 · 执行者：YY 派出毒舌技术批判子 agent（TT §7 硬闸门）
- 闸门结果：**PASS（exit 0）**——`node scripts/review-gate.mjs --dir yy/plans/tasks --id M1 --verify-urls`：有效批判 9/9、优化方案存在、tracker 已登记、竞品 URL 真验 9/9 可达（「URL 真验 网络可用」模式，非 SKIP）。
- 基线确认：批判期间未改任何被批判代码；`tt-journey.mjs --self-test` 5/5 PASS（exit 0），代码与批判前一致。

## 批判摘要（9 条，P0×2 / P1×4 / P2×3）

| # | 一句话 | 级别 | 关键证据 |
|---|---|---|---|
| C1 | 防跳阶段是装饰品：`--prereq-check` 全仓库 0 处调用，`--update` 无前置校验直接标 done | **P0** | E1 实测：step5 未 done 时 `--update --step 7 --gate gate-a-approved` exit 0 落盘；Claude Code 任务系统为平台强制工具（tools-reference.md，2026-09-07） |
| C2 | journey.json 并发读-改-写无锁无版本号，双写入点后写覆盖先写 | **P0** | 机制实证 tt-journey.mjs:111-132 无同步原语；对标 proper-lockfile（周下载 22,358,923，npm API 2026-09-07） |
| C3 | Windows GBK 控制台进度图全乱码，目标用户主场景不可读 | P1 | E2 实测 chcp 936 乱码、UTF-8 字节本身干净 |
| C4 | 位置判定错乱：回跳层 pending 时主干 7/8 已 done 仍显示「重执行1（待推进）/下一阶段：无」 | P1 | E6 实测 |
| C5 | 推断层吞 BOM/损坏数据源 → 把有历史谎报成无历史 | P1 | E3 实测（PS5.1 `Set-Content -Encoding UTF8` 必产 BOM） |
| C6 | token 宣称不诚实：「344-449」实测 o200k 378-479（下界虚报 34）；「显著降低」未计 journey 渲染叠加（真实 ~600-800 tok/注入 vs guide 2482） | P1 | E5 实测 js-tiktoken o200k_base：sum6=2581、avg=430、guide=2482 |
| C7 | 「渐进披露」名不副实：死文本命令，无 agentskills L1 自动触发层 | P2 | agentskills.io 规范 L1 ~100 tok 启动加载（2026-09-07） |
| C8 | journey/state 双事实源无交叉核对，PRD 承诺未兑现 | P2 | orchestrator.mjs:171-195 单向写、无对照逻辑 |
| C9 | 生态位差距未承认：SuperClaude pm agent 常驻自动恢复上下文（23,871★）vs YY 被动文件；anthropics/skills 174,939★ | P2 | GitHub API 当日实测 |

**「必然不及格」级问题**：C1——PRD §FR-1 把「机器防跳阶段」写进验收并自称「BMAD 先 approve 再执行的代码级等价物」，但唯一的写路径 `--update` 连一行前置判断都没有；防跳强度=agent 自觉。按 PRD 自身标准不及格。

## 竞品对标（全部 2026-09-07 真实访问，review-gate 真验 9/9）

- Claude Code 工具参考（TaskCreate/TaskUpdate/Skill 机制）：https://code.claude.com/docs/en/tools-reference.md
- Claude Code changelog（task list / 无 Unicode 终端修复）：https://raw.githubusercontent.com/anthropics/claude-code/main/CHANGELOG.md
- proper-lockfile（registry API，v4.1.2）：https://registry.npmjs.org/proper-lockfile/latest + 周下载 https://api.npmjs.org/downloads/point/last-week/proper-lockfile
- BMAD 跟踪机制（sprint-status.yaml 单一事实源）：https://docs.bmad-method.org/plan/break-work-into-stories-and-track-it/
- agentskills.io 渐进披露规范（L1/L2/L3 分层）：https://agentskills.io/specification
- SuperClaude Framework（CLAUDE.md v4.3.0：30 commands/20 agents/7 modes；stars=23,871）：https://github.com/SuperClaude-Org/SuperClaude_Framework/blob/master/CLAUDE.md
- anthropics/skills（stars=174,939）与 skill-creator（渐进披露三级口径）：https://api.github.com/repos/anthropics/skills 、 https://github.com/anthropics/skills/blob/main/skills/skill-creator/SKILL.md
- Node fs 文档（BOM/Buffer 责任边界）：https://nodejs.org/api/fs.html

## 落地产出

1. `yy/plans/tasks/M1-技术批判.md` —— 9 条批判（表格：批判点/竞品对标 URL+日期+结论/差距/优化方案/最小验证/收益成本/实证/级别），含 6 组真机实验（E1-E6）。
2. `yy/plans/tasks/M1-优化修改方案.md` —— C1-C9 逐条修改+量化指标+测试方案（GWT6-GWT13）+风险+四批次排期。
3. tracker 登记：主 tracker（仓库根 `plans/critique-backlog-tracker.md`）追加 C-16~C-24；并在 `yy/plans/critique-backlog-tracker.md` 建 yy 域镜像（review-gate ROOT=yy/ 的读取域），格式对齐 C-xx 表，序号延续主表（现有最大 C-15 → 起 C-16）。
4. 闸门自验 PASS（exit 0，--verify-urls 全真验非 SKIP）。

## 诚实声明

- **批判基于真实搜索**：9/9 URL 通过 review-gate 真验（HTTP 200），无编造；GitHub stars/registry 版本/下载量数字均来自 2026-09-07 当日 API 响应。
- **E4 并发实验诚实披露**：15 进程并发未实际观察到更新丢失（done 9/9、gates 4/4）——C2 定级 P0 的依据是**代码机制**（无锁 read-modify-write + 双写入点），非已复现事故；报告与 tracker 措辞已如实标注「未复现丢失属时序运气」。
- 首轮并发实验因我方 PowerShell 管道编码问题读 JSON 失败，已重跑修正；首跑数据未用于任何结论。
- token 测量编码器为 js-tiktoken `gpt-4o`（o200k_base）；dev-plan 原文未标注编码器，这本身就是批判点 C6 的一部分。r50k_base 口径（guide=5578、avg=859）作为对照亦已实测。
- SuperClaude 原仓库 `SuperClaude-OSS/...` 已 404（改名 SuperClaude-Org，GitHub search API 当日实证）；Claude Code docs 的 task-lists/tasks 页 404，对标源改用 tools-reference.md + CHANGELOG.md（均真实可达）。
- 被批判代码零改动（批判角色红线）；所有实验在 %TEMP% 隔离目录完成，实验后已清理。

## 遗留（非本次范围）

- 修复实施归编排者派单（C-16~C-24 已入 tracker 待排期）；本报告不代做修复。
- `yy/plans/critique-backlog-tracker.md` 为 review-gate 读取域所需镜像；若后续统一 tracker 读取域，应改 review-gate 的 TRACKER_PATH 解析而非维护双文件。