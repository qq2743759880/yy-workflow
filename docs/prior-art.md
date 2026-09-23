# prior-art.md — 研究门前置工件（RG-1，2026-09-23）

> 本文档为「研究门」机验对象。机验脚本：`node scripts/research-gate.mjs --workspace <dir>`，
> 只认本文件中的 ```json block（固定 schema），prose 部分仅供人读。
> 检索执行环境说明：本环境 WebSearch 工具不可用（实测），检索兜底源 =
> api.github.com（search/repositories + repos/.../commits）+ registry.npmjs.org（search + 包元数据），均实测可达；
> 全部检索于 2026-09-23 执行，证据行（查询串 → 命中摘要）保留在下方 JSON 中。

## 调研对象

yy skill 的「研究门」能力：在进入施工前，对候选引入资产（kernel）做 prior-art 检索
（现有实现/星标/活跃度/license/重叠度），机验 fail-closed——防止跳过调研直接造轮子。
本单（RG-1）先引入 dzhng/deep-research 作为研究门内核，并验证该门本身不与现有开源方案重复。

## 检索记录（人读摘要；结构化证据见 JSON）

1. `deep-research user:dzhng`（github-api）→ dzhng/deep-research 19717★ MIT，HEAD `1f8f3e28`（2026-04-11）——已 vendor（见 vendor/deep-research/VENDORED.md）。
2. `gpt-researcher`（github-api）→ assafelovic/gpt-researcher 29580★ Apache-2.0，last commit 2026-08-23——按 execution-plan §四裁定不引入（重）。
3. `STORM`（github-api，仓库 stanford-oval/storm）→ 31485★ MIT，last commit 2025-09-30——裁定不引入（超重）。
4. `langchain-ai/open_deep_research`（github-api）→ 12683★ MIT，last commit 2026-08-10——同形（迭代式 deep research agent），重叠度高，adapt 其「规划循环」思路而非引入代码。
5. npm `deep-research`（npm-registry）→ 0.1.4 Apache-2.0（JigsawStack，174★）——TS 库形态同形，reject。
6. npm `deep research agent`（npm-registry search）→ @multimodal/deep-research-agent 0.2.10 等均为运行时服务/CLI，无「编排流程内置研究门」形态。
7. `"prior art" "research gate"`（github-api，仓库+issue 双查）→ 仓库 0 命中；issue 4723 命中但均为各自项目内部的流程术语（如 DinevDecor/discovery-lab#62「Add mandatory Existing Solutions / Prior Art Gate before product solut…」、Elmdin/borromeanRings#148「feat: prior-art gate — look before building, on the record」），无可用作通用编排 gate 的独立开源实现。
8. `research gate prior-art agent workflow` / `fail-closed prior art research gate CI`（github-api）→ 均 0 命中。

## 固定 JSON block（机验读取区）

```json
{
  "search_queries": [
    "deep-research user:dzhng (github-api search/repositories)",
    "gpt-researcher (github-api search/repositories)",
    "stanford-oval/storm (github-api repos/get + commits)",
    "deep research language:TypeScript (github-api search/repositories, 1606 hits)",
    "\"prior art\" \"research gate\" (github-api search/repositories + search/issues)",
    "research gate prior-art agent workflow / fail-closed prior art research gate CI (github-api search/repositories)",
    "npm: deep-research (registry.npmjs.org package metadata)",
    "npm: deep research agent (registry.npmjs.org -/v1/search)"
  ],
  "sources_used": ["github-api", "npm-registry"],
  "candidates": [
    {
      "repo_url": "https://github.com/dzhng/deep-research",
      "stars": 19717,
      "last_commit": "2026-04-11",
      "license": "MIT",
      "overlap": 0.5,
      "differentiation": "迭代式 SERP 搜索+learnings 提炼循环（研究门检索内核），非编排 gate；作为内核全量 vendor（RG-1 任务 A），不构成重复造轮",
      "verdict": "adopt"
    },
    {
      "repo_url": "https://github.com/assafelovic/gpt-researcher",
      "stars": 29580,
      "last_commit": "2026-08-23",
      "license": "Apache-2.0",
      "overlap": 0.6,
      "differentiation": "全功能自主研究 agent（多源+报告生成），体量重；execution-plan §四裁定不引入，仅作竞品对标",
      "verdict": "reject"
    },
    {
      "repo_url": "https://github.com/stanford-oval/storm",
      "stars": 31485,
      "last_commit": "2025-09-30",
      "license": "MIT",
      "overlap": 0.5,
      "differentiation": "知识策展/长文报告系统（超重）；裁定不引入，仅作竞品对标",
      "verdict": "reject"
    },
    {
      "repo_url": "https://github.com/langchain-ai/open_deep_research",
      "stars": 12683,
      "last_commit": "2026-08-10",
      "license": "MIT",
      "overlap": 0.55,
      "differentiation": "同形迭代研究 agent（LangGraph 形态）；不引入，其『先规划后检索再收敛』循环思想已被 dzhng 内核覆盖",
      "verdict": "reject"
    },
    {
      "repo_url": "https://registry.npmjs.org/deep-research",
      "stars": 174,
      "last_commit": "2025-12-04",
      "license": "Apache-2.0",
      "overlap": 0.45,
      "differentiation": "JigsawStack TS 库（0.1.4）：检索+引用生成库，无编排 gate 形态；拒绝引入，registry 元数据留作检索证据",
      "verdict": "reject"
    }
  ],
  "wheel_status": "partial",
  "novelty_evidence": [],
  "notes": "wheel_status=partial：检索/研究循环内核（dzhng/deep-research）已有开源实现→vendor 引入不重造；但『编排流程内置的 fail-closed 研究门（prior-art+market 双文档机验+prereq 挂点）』这一组合形态未检索到现成实现——github-api 精确短语检索 0 命中（见 search_queries 第 5/6 条），故 gate 编排层为本项目组装（vendor 内核 + ≤150 行胶水 + 机验），非声称算法层 novel。"
}
```

## 机验出口

- 本文件由 `scripts/research-gate.mjs --workspace .` 校验；机验结果回填至
  `test-reports/autopilot-work/RG-1/RESULTS.md`（阶段机验字段）。
- fail-closed 语义：`wheel_status: novel` 且 `novelty_evidence` 为空 → gate FAIL（防未检索就宣称全新）。
