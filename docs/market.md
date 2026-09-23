# market.md — 研究门前置工件（RG-1，2026-09-23）

> 本文档为「研究门」机验对象。机验脚本：`node scripts/research-gate.mjs --workspace <dir>`，
> 只认本文件中的 ```json block。检索环境与 prior-art.md 相同：WebSearch 不可用（实测），
> 兜底源 = api.github.com + registry.npmjs.org（实测可达，检索日期 2026-09-23）。
> pain_evidence 的 url+quote+date 全部来自上述兜底源的真实 issue 页面（2026-09-23 抓取）。

## 调研对象（人读）

「AI 研究/调研流程不先查已有方案就开写」的痛点是否真实存在、现有玩家覆盖到什么程度，
以及 yy 的编排工作流是否值得内置一个 fail-closed 研究门（verdict: build / pivot / drop）。

- 痛点面：GitHub 上头部研究 agent 仓库的 issue 区可直接观察到用户对
  「来源可信度/引用缺失/幻觉来源/无质量评分」的持续抱怨——与“研究不实、引用造假”直接相关。
- 成本面：dzhng/deep-research#66 指出 Firecrawl 搜索后端无按量付费（订阅制），
  自托管又有 /search 端点歧义（#42）——检索基础设施成本是真实门槛。
- 流程面：gpt-researcher#1572（报告幻觉来源）、#1727（要求质量评分与来源可靠性排名）、
  dzhng#20（发现互相矛盾的 finding 需要交叉确认循环）、#81（缺正文内引用）——
  证明“生成型研究”需要外部化的校验结构，而非单纯堆模型能力。

## 固定 JSON block（机验读取区）

```json
{
  "pain_evidence": [
    {
      "url": "https://github.com/assafelovic/gpt-researcher/issues/1572",
      "quote": "when not relevant context is found (self.context = []) inside the write_report method the final report just makes up some sources and content which looks for the moment very real",
      "date": "2025-12-08"
    },
    {
      "url": "https://github.com/dzhng/deep-research/issues/81",
      "quote": "The biggest thing limiting the usability for this right now seems to be the lack of in-text source referencing by default",
      "date": "2025-02-12"
    },
    {
      "url": "https://github.com/assafelovic/gpt-researcher/issues/1727",
      "quote": "Add automatic quality scoring for research outputs and reliability ranking for sources used in the research process",
      "date": "2026-04-05"
    },
    {
      "url": "https://github.com/dzhng/deep-research/issues/20",
      "quote": "Whenever a new finding is discovered, a simple loop can ask the LLM \"Does this finding contradict this other finding\" for all previous findings",
      "date": "2025-02-07"
    },
    {
      "url": "https://github.com/dzhng/deep-research/issues/66",
      "quote": "The problem is that you dont get any Firecrawl API Key without paying a subscription, as there is no pay as you go plan.",
      "date": "2025-02-11"
    }
  ],
  "competitors": [
    {
      "name": "dzhng/deep-research",
      "pricing": "free/open-source (MIT)；运行成本依赖 OpenAI/Firecrawl 订阅",
      "gap": "纯 CLI 研究循环，无编排闸门/机验/文档化出口——报告可信度问题见其 issue #81/#20"
    },
    {
      "name": "assafelovic/gpt-researcher",
      "pricing": "free/open-source (Apache-2.0)；云端版收费",
      "gap": "自主研究 agent 全家桶，但无 fail-closed 的前置研究门（其自身仍出幻觉来源，见 issue #1572）"
    },
    {
      "name": "stanford-oval/storm",
      "pricing": "free/open-source (MIT)",
      "gap": "知识策展/长文生成系统，面向论文写作而非工程编排流程；无 prior-art/market 双 gate 机验"
    },
    {
      "name": "langchain-ai/open_deep_research",
      "pricing": "free/open-source (MIT)",
      "gap": "LangGraph 形态的研究 agent，需自配模型/搜索基础设施；不提供编排层 prereq 语义与文档模板"
    }
  ],
  "verdict": "build",
  "confidence": "medium"
}
```

## verdict 论证（人读）

- **build**：痛点真实（5 条带外链证据）、头部玩家均为“研究执行器”而非“流程闸门”，
  组装成本可控（vendor 内核 + ≤150 行胶水 + 双文档机验），与 yy 既有 9 节点闭环的 gate 体系同构。
- **confidence: medium 的理由**：竞品“gate 形态缺失”的判断基于兜底源检索（github-api/npm-registry）
  而非全网检索（WebSearch 不可用，实测）——不排除存在未索引到的小众方案；机验链路本身 fail-closed，
  后续季更（VENDORED.md 升级纪律）时按同款检索流程复查。

## 机验出口

- 本文件由 `scripts/research-gate.mjs --workspace .` 校验；机验结果回填至
  `test-reports/autopilot-work/RG-1/RESULTS.md`（阶段机验字段）。
- fail-closed 语义：pain_evidence<3、competitors<3、verdict/confidence 非枚举 → gate FAIL。
