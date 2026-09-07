# task C-08 · portman.mjs 真调 CLI

> 执行者：子 agent A。验收者：独立测试 agent。承接批判 C-08。

## 目标
portman adapter 从"仅 hash 记录（pass:null+degraded）"升级为**调用已部署 portman 1.35 真实契约校验**，产出 pass/diff。

## 改动
`scripts/lib/adapters/portman.mjs`：
- probe `portman --version` 可用 + 契约是 OpenAPI JSON 文件路径时：
  - 跑 `portman --local <openapi-file>`（lint/collection 生成，真实校验）
  - 若可行，追加 `--runNewman --baseUrl <mock>`（本地 mock）做真实请求校验
  - 解析输出 → `contract-result.json` 带真实 pass/diff（非仅 hash 记录）
- 描述文本契约 → 保持 pass:null+degraded（诚实）
- portman 不可用 → CONTRACT_TOOL_NOT_AVAILABLE（不变）

## GWT
- Given OpenAPI 契约文件 + portman 已装；When adapter run；Then 跑真实 portman 校验、contract-result.json 含 pass/diff、mode 不再 planned-only（真实执行）
- Given 描述文本契约；Then pass:null+degraded（诚实，不变）
- Given `node scripts/regression-all.mjs`；Then 8/8 不破（S4 契约 tamper 仍 exit 4）

## 纪律
- 只改 `scripts/lib/adapters/portman.mjs`；自测 3 GWT（用临时 OpenAPI 文件）；不 commit。
