# 附 A10：YY 与 TT 的差异段 + TTHP 关系（来源：SKILL.md 附 B + 附 C，自包含可读）

> 本文件是 YY fork 差异登记与外部协议关系的权威说明（原 SKILL.md 附 B/附 C 迁移至此）。校验协议边界或对照上游 TT 时读取。

## 与 TTHP 协议包的关系（附 B）

- 本 skill 的契约冻结/handoff 概念引用 `open-source/handoff-protocol`（TTHP，MIT）——可选增强。
- 无 TTHP 时：契约冻结退化为"契约文件 + 人工核对"，状态机纪律不变。
- 版本各自独立演进：skill 版本（SKILL.md frontmatter version）与 TTHP 协议版本互不绑定。

## YY 与 TT 的差异段（附 C，YY 专有，TT 上游无）

> 本段是 YY fork 的差异登记处：上游 TT 2.9.1 之外的全部 YY 意图。内核（0b~9 步闭环 + scripts + vendor 16 资产）与 TT 2.9.1 相同。

| FR | 名称 | YY 差异（相对 TT 2.9.1） | 落点 |
|----|------|------------------------|------|
| F1 阶段导航/进度 | owner 随时知道编排到哪个阶段、禁跳阶段 | `.tt-state/journey.json` 与 state-summary 同源派生；命令注入前先读 journey，前置未 done 即警告 | 规划中（PRD §2.2/2.3） |
| F2 Prompt 注入 | 阶段化 Prompt 以命令文件注入 300-500 token 摘要 | `commands/yy-*.md` 为内容母本（压缩自 `docs/TT-USER-PROMPT-GUIDE.md`） | 规划中 |
| F3 报告白话化 | 术语报告附 owner 可读白话版 | 复用 completion-report 资产消费证据段，补白话视图 | 规划中 |
| F4 多分支 | task 多线自动升级编排 + `--session <id>` 隔离 | 目录命名空间前缀，非新状态机；汇总复用 summary-read.mjs | 规划中 |
| F5 资产透明化 | 指定资产/域的可见性（candidates + preconditions 具名注入） | 数据源 `scripts/lib/matrix.mjs` CLUSTERS；泛化 kickoff-prompt T4 模式至 T1-T5 | 规划中 |

约束（PRD §范围外）：不引 npm 依赖实现 F1-F5（渐进披露 + 原生 Node）；不自动派发子会话（只建议+隔离+汇总）；向量记忆/swarm 不做。依赖缺口盘点见 `docs/DEPENDENCY-AUDIT.md`。