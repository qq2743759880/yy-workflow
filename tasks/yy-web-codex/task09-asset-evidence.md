# task09｜资产正文与证据固定版本分页（M1）

状态：本地有界读取/UTF-8 分页/源版本拒绝通过 fixture 用例；新 M1 reader 已读取两份真实 RF1 报告内容的本地 synthetic W 副本，验证旧 F-E2E-3 与后继 CLOSED/supersedes、OpenAPI pass、non-OpenAPI/contract-draft degraded/pass=null 文本可见。授权生产 W、真实宿主解释和 AT-30–36/48 生产读面仍 `NOT_ESTABLISHED`。依据：PRD FR-05、FR-06；AT-10–15、34–36、48 的读面。证据：`docs/yy-web/RELEASE-EVIDENCE-20260927.json`。

## 交付与关联

- 交付 `yy_read_asset` / `yy_read_evidence` 的授权 section 读取、原始证据引用、固定版本分页、digest 和完整性标记；旧 F-E2E-3 与新 RF1 证据展示 supersedes 关系。
- 前置：task06 绑定、task04 C2 合同；后置：task11/18/20/22。选型：复用现有资产/证据文件作为源，MCP 只负责范围过滤与有界传输。
- 候选 seam：YY 现有 artifact/evidence 读取及生产 M 的只读工具；实现路径与缓存策略待阶段 5。

## GWT 验收

1. Given critical 超预算与含中文的长行，When 读取及翻页，Then约束完整或具名拒绝，字节/字符无丢失，拼接 digest 匹配。
2. Given 翻页途中源变、单文件被截断或 batch 未耗尽，When 继续，Then固定旧源或 `SOURCE_CHANGED`，相应文件与顶层均不假报完整。
3. Given 缺失、不可见、过期或与摘要冲突的证据，When 读取，Then错误各自可辨，原始 failed 不被摘要 passed 覆盖，已签回执引用可验证或明确过期。

停止条件：证据不完整时，任何下游验收不得用该摘要判 PASS。
