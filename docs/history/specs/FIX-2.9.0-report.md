# FIX-2.9.0 报告 — 独立验收 3 缺陷修复

- 日期: 2026-09-05 · 执行: 修复子 agent（通道不稳定 TLS 断前已落盘）+ 编排者独立复测
- 依据: VERIFY-2.9.0-report.md（独立测试 agent 发现）

## 缺陷与修复

| # | 缺陷 | 修复 | 复测结果 |
|---|---|---|---|
| 1 | contract-reverse Flask `<int:item_id>` 归一化残缺 → `/api/items/<int{item_id}>` | normalizePath 增加剥 `<type:name>` → `{name}`（置于 :param 归一前） | ✅ Flask 路由 → `/api/items/{item_id}`，无尖括号残留 |
| 2 | prefixesDetected 虚报（Flask @app.route 误命中 Express 前缀正则） | 前缀提取跳过 @ 装饰器行 | ✅ Flask 文件 prefixesDetected=0；Express `app.use('/api', api)` 仍检出 prefixesDetected=1（未误伤） |
| 3 | be-validator adapter 不认 draft:true/brownfieldDraft → 对未确认草案照样跑 portman | portman.mjs 增 draftDegrade：subtask.brownfieldDraft===true 或 doc.draft===true → degraded（不调 CLI） | ✅ brownfieldDraft degraded=true；doc.draft=true degraded=true；真 OpenAPI 无 draft → tool:portman mode:exec（不回归） |

## 回归
- regression-all 8 PASS / 0 FAIL（S4/S5/S7/S8 不破）
- validate-structure 0 泄露；ci PASS

## 诚实备注
- 三个修复文件改动由修复子 agent 在 TLS 断开前落盘；编排者逐项独立复测（上表）确认生效。
- 缺陷 #3 使棕地模式真正达成"草案不真校验"（原仅标记层生效）。