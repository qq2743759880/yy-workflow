---
name: yy-3-contract
description: 阶段 5 规划+契约冻结。触发词「/yy 3」「注入阶段 3 prompt」「契约冻结」「冻结契约」。
journey-step: 5
prereq-gates: [step3]
---

> 首行指令：先跑 `node scripts/tt-journey.mjs --workspace "$PROJECT_ROOT" --prereq-check --step 5` 机验前置（`--workspace` 必带——坑#2：cd 技能目录执行时缺它误读技能目录 journey，绕开用户工作区）。前置 step 3 未 done 时 exit 1 阻断注入，先回阶段 3。

## 阶段 5 · 规划 + 契约冻结

**目标**：任务×agent×skill×workflow×MCP 矩阵 + 执行排序 + 契约冻结时序 + 开工 prompt；契约冻结前列接口清单/schema/错误码/响应壳，逐条审完才冻结。

**人工 gate 清单**：契约审阅（用真实业务场景逐条审接口/错误码）——你业务知识最值钱的地方。

**纪律钥匙词**：`契约先冻结`、`冻结后执行期禁止改契约`、`要改走变更单 + 重验收`、`前端缺契约就停下不要臆造接口`。

**产物路径**：`contracts/<planId>.json`（冻结契约）；审完跑 `--update --step 5 --gate contract-frozen`（带 --workspace，坑#2）。

**owner 审阅**：产出 gate 产物后，读取 templates/owner-review/contract-review.md，按其四段结构向 owner 呈现审阅要点（审什么/看哪几字段/PASS-FAIL/常见坑）——owner 不懂术语也能做判断。

**棕地补充**：老系统无 OpenAPI 用 contract-reverse 反推草案 → 后端确认 → 冻结；前端可凭草案先开工（--contract-draft）。

**回跳指针**：改需求（guide 阶段 6）只跑影响层 + 变更单，已实施产物不回退。

**指针**：`docs/TT-USER-PROMPT-GUIDE.md` §4 阶段 3（L77）+ §7 阶段 6（L127）；`SKILL.md` §4 规划 / §5.4 契约冻结 gate。
