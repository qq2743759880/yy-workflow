---
name: agent-research
description: |
  Agent 科研技能集（hub）——聚合 29 个科研子技能：文献检索/综述、论文各章节写作、
  实验代码、数据分析、图表生成、引用管理、 novelty 评估、答辩 rebuttal 等。
  供编排者（主 agent）在"调研 / 论文 / 实验"类任务中按需调用其子技能。
version: 1.0.0
---

# agent-research（科研技能集 · hub）

> 本目录是随包内置的科研能力集合，包含 29 个独立子技能。调用时请指向具体子技能目录：
> `$SKILL_DIR/vendor/agent-research/<sub-skill>/SKILL.md`

## 子技能清单（按用途分组）

**文献与综述**
- `literature-search` — 学术文献检索（Semantic Scholar / arXiv / OpenAlex）
- `literature-review` — 多视角对话式文献综述
- `related-work-writing` — Related Work 章节写作
- `survey-generation` — 综述论文生成

**选题与规划**
- `idea-generation` — 研究方向创意生成与新颖性评估
- `novelty-assessment` — 新颖性判定（多轮检索-评估）
- `research-planning` — 研究计划与论文架构

**论文写作（各章节）**
- `paper-writing-section` — 单章节写作（Abstract/Intro/Methods/…）
- `paper-revision` — 按审稿意见修改
- `rebuttal-writing` — 点对点 rebuttal
- `self-review` — 自评（NeurIPS 评审表）

**实验与代码**
- `experiment-design` — 实验设计（分阶段）
- `experiment-code` — ML 实验代码（迭代改进）
- `code-debugging` — 结构化错误分析调试
- `paper-to-code` — 论文→可运行代码仓库
- `data-analysis` — 统计分析（4 轮审查）

**数学与推导**
- `math-reasoning` — 形式化数学推理
- `algorithm-design` — 算法设计（LaTeX 伪代码 + UML）
- `atomic-decomposition` — 研究想法原子化分解
- `backward-traceability` — 数字可溯源到代码行

**产出物**
- `figure-generation` — 出版级科学图表
- `latex-formatting` — LaTeX 格式化与模板
- `citation-management` — BibTeX 引用管理
- `paper-assembly` — 全流程论文拼装
- `paper-compilation` — LaTeX→PDF 编译校验
- `slide-generation` — 论文→演示 slides
- `excalidraw-skill` — Excalidraw 图示
- `github-research` — GitHub 仓库调研

## Execution kernel (gpt-researcher 对标)

Kernel: 本 hub 默认以 deep-research / literature-search 子技能为调研执行内核；单点替代对标 assafelovic/gpt-researcher（自主 deep-research）。
- Invocation: 需端到端自主调研时可 probe `gpt-researcher --version`，可用则作单点内核；否则用内置子技能流程。
- Degradation: 外部工具缺失 → 用内置子技能，不假报"联网调研已执行"。

## 使用约定

- 引用具体子技能时写全路径：`$SKILL_DIR/vendor/agent-research/<sub-skill>/SKILL.md`
- 子技能各自维护 frontmatter（name/description/version）与独立工作流
- 本 hub 仅作索引，不替代子技能的具体加载
