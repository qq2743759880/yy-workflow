# AS-0 派单 — 许可证核查 + superpowers 选品清单（批 1 第一单，网络只读）

你是 autopilot 管线 L1 独立调研 agent（全新上下文）。工作区：`D:\.ai-hub\skills\yy`。先读 `plans/execution-plan-v3-20260923.md` §二/§四 与 `handoffs/v3/write-faces-batch1.md`。完成后交付证据，不自称 DONE。

## 防超时纪律
小步快走，每步 ≤10 分钟必须有工具调用与落盘；证据边跑边写 `test-reports/asset-eval-20260923/LICENSES.md`。

## 任务 A：五个引入源的许可证核查（网络走 api.github.com / registry.npmjs.org / raw.githubusercontent.com，WebSearch 不可用）
| 源 | 引入方式 | 待核结论 |
|---|---|---|
| claude-task-master（npm task-master-ai） | 仅 vendor templates/ | R3 实测 npm 标注 NOASSERTION（MIT+Commons-Clause）——拆包读 LICENSE 原文，给出：templates 目录是否受 Commons-Clause 约束、能否安全 vendor |
| github/spec-kit | 仅 vendor 模板文件 | LICENSE 实文（是否 MIT）+ 模板目录清单 |
| cisco-ai-defense/skill-scanner | 全仓 vendor | LICENSE + Windows 可用性（bin 入口） |
| semgrep | npm/pip 依赖非 vendor | LGPL-2.1 独立进程调用无传染的结论复核 + Windows 安装路径（pip?） |
| Spectral（@stoplight/spectral-cli）+ Schemathesis | npm 依赖 | Apache/MIT 确认 + Windows npm 安装实测 |

## 任务 B：superpowers skills 全清单（供 Owner 圈选，编排者不代签）
`git clone --depth 1 https://github.com/obra/superpowers` 到**系统临时目录**（不入仓库），列出其 skills/ 完整清单（skill 名 + 一句话功能），按 16 槽位需求给**推荐短名单（3-5 个，含理由）**，但决策留给 Owner。clone 完后保留临时目录路径在报告里（后续 vendor 用），并记录 commit hash。

## 任务 C：结论汇总
LICENSES.md 逐源：许可证实文摘要 / 引入方式是否合法 / 风险 / 结论（可引入|有条件|禁止）。每个结论标 实测/推断。

## 白名单
只读网络与仓库 + 新建 `test-reports/asset-eval-20260923/LICENSES.md`。零仓库源文件改动、零 git 写操作（clone 只进临时目录）。

## 验收要点
五源结论齐 + superpowers 清单+推荐短名单；所有"可引入"结论有 LICENSE 原文引用。