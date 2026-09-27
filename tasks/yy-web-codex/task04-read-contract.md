# task04｜快照、证据、分页与预算合同草案（M0）

状态：本地候选合同与六工具实现已形成；尚未完成 Owner/API 冻结签收。15 项本地 fixture/integration 测试通过，含 stdio 握手、有界输入输出、来源根句柄校验、游标边界、只读副作用及通过 M1 reader 读取 RF1 历史/后继报告副本；并发快照、真实 W 与宿主引用过期语义未建立。依据：PRD §11–12；AT-10–15、48 前置。证据：`docs/yy-web/M0-M1-READONLY-CONTRACT.md`、`docs/yy-web/RELEASE-EVIDENCE-20260927.json`。

## 交付与关联

- 交付 Snapshot、Stage、Catalog、EvidenceRef、游标、source/payload digest、完整性、错误分类与 token 预算的候选合同；固定同源版本的读取规则和 critical 不可静默截断规则。
- 前置：task01/03；后置：task06/09/11。选型：在 YY Core 读取结果之上做薄投影，分页带稳定来源版本，不把截断摘要当完整证据。
- 调用面：复用现有状态、资产和 evidence 读取；候选边界在 MCP read-only 工具层，具体 schema 于阶段 5 冻结。

## GWT 验收

1. Given critical 内容超过预算，When 构造首屏，Then 返回完整核心与后续引用，或具名拒绝；没有半段约束被标为完整。
2. Given UTF-8 中文、超长行和翻页中源变，When 分页读取，Then 可按固定版本无损拼接且摘要一致；无法固定则 `SOURCE_CHANGED`，不混版。
3. Given 文件不存在、无权读取、预算不足或引用过期，When 取证，Then 四类结果可辨，顶层完整性不假绿。

停止条件：无法证明 source digest 与页内容一致时不得开放证据消费。
