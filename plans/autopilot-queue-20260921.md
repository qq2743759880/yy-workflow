# 自动驾驶队列 — v2 严格串行（2026-09-21 重排）

> Owner 2026-09-21 裁定：① 前端任务（FE×5，见 plans/frontend-plan-20260921.md）排最前优先执行；
> W1-W2 修复批与 W3 加固化批顺延其后；② BW 盲行任务只入队**不执行**，排最后；
> ③ L3 登记员 = 脚本 scripts/autopilot-registrar.mjs（已产出+自测过）；
> ④ 复核分级：白名单含产品面（scripts/*.mjs 产品脚本/webview 冻结锚）走 L2 全量重执行，
> 纯测试资产/文档 task 只重跑自测+范围审计（裁定 1=B）。

> 协议：`plans/autopilot-protocol-20260921.md`。状态由编排者在波门更新；执行者禁写本文件。
> 状态值：⏳待派 / 🔄执行中 / 🔬验收中 / ✅已收 / 🔁返工(n) / 🚫blocked / ➖坍缩

## FE 前端批（优先执行；详见 plans/frontend-plan-20260921.md）

| id | task | 状态 |
|---|---|---|
| FE-0 | build-guide-content.mjs 构建期内容提取 | ✅已收（L2 PASS，P2×1） |
| FE-1 | 页面骨架+新 styles.css（A 现状导航；taste Design Read + ui-ux-pro-max 铁律） | ✅已收（L2 PASS，P2×2） |
| FE-2 | B 阶段手册 + C 资产手册（消费 content.js；复制按钮） | ✅已收（L2 PASS，P2×2） |
| FE-3 | web-gui-tester 全 GUI 盲测（黑盒+截图+只读 DOM 交叉验证；修复分离） | ⏳ |
| FE-4 | 交付收口（README/release 刷新/部署验证） | ⏳ |

## W1 修复批 A（工匠 agent ×1，顺延至 FE 后）

| id | task | 白名单 | 状态 | 验收要点 |
|---|---|---|---|---|
| FIX-1 | 坑#2：六个命令文件前置机验补 `--workspace "$PROJECT_ROOT"` 语义（或等价 env 兜底，择一申报）；SKILL.md 注入纪律行同步 | commands/yy-*.md、SKILL.md、（如走 env）scripts/tt-journey.mjs | ⏳ | 盲行沙箱复现：非 yy cwd 下 prereq-check 读到项目工作区 journey |
| FIX-2 | executor.json↔orchestrator 接线：orchestrator 读 `<ws>/.tt-state/executor.json` 的 cli/模型偏好，映射到 --exec/config 段（presence≠可用，禁自动 roundtrip） | scripts/orchestrator.mjs、scripts/executor-setup.mjs | ⏳ | 向导选 claude→dry-run 派单命令确实变化；两文件隔离互不越权 |

## W2 修复批 B（工匠 agent ×1）

| id | task | 白名单 | 状态 | 验收要点 |
|---|---|---|---|---|
| FIX-3 | 坑#7：validate-structure 的 expectedRefs 硬编码解耦（从 SKILL.md 指针表派生或独立清单文件单一事实源） | scripts/validate-structure.mjs | ⏳ | 删一个 reference 文件不再需要改断言（用临时文件实测） |
| FIX-4 | T9 遗留：--validate-handoff 冒号列表 key 误判边缘加固 | scripts/summary-read.mjs | ⏳ | 构造冒号列表正文样本，三必填字段判定不变 |
| FIX-5 | T9 遗留：runner 沙箱修剪策略统一（保留数入常量） | test-reports/rebuild-20260920/T9-wizard/ | ⏳ | 连跑 3 轮沙箱目录数不增 |

## W3 加固化批（工匠 agent ×1）

| id | task | 白名单 | 状态 | 验收要点 |
|---|---|---|---|---|
| HARD-1 | junction-smoke 并入回归入口（无 junction 时 SKIP 语义） | scripts/regression-all.mjs、test-reports/fix-20260921/ | ⏳ | 本机全绿；删 junction 后整套仍 12/12+1skip |
| HARD-2 | 发布目录一键脚本 `scripts/make-release.mjs`（robocopy 规则+泄露 grep 审计+purge+可选 mklink 一条龙） | scripts/make-release.mjs | ⏳ | 产出目录过审计零命中；重跑幂等 |
| HARD-3 | 发布面 purge 纪律固化进脚本（含本轮手工删 memory 残留的教训） | 同上 | ⏳ | 从干净 release 重生成，无残留旧文件 |

## W4 盲行 1（盲行者 agent ×1，**只入队不执行**——排最后）

| id | task | 状态 |
|---|---|---|
| BW-1 | 全流程盲行（ChatGPT 本地项目审查助手；prompt 见 blindwalk 协议 §2.2） | ⏳ |

验收 = session-notes 坑清单 + workspace/journey 取证 + db 日志复现；坑登记看板。

## W5 动态修复槽（工匠 agent ×1）

| id | task | 状态 |
|---|---|---|
| BFX-1 | （BW-1 坑#1 修复——波门填写 brief） | ⏳占位 |
| BFX-2 | （BW-1 坑#2 修复） | ⏳占位 |
| BFX-3 | （视坑数增删，≤4 个） | ⏳占位 |

## W6-W8 盲行 2-4（**只入队不执行**）

| id | task | 状态 |
|---|---|---|
| BW-2 | 多分支 --session 盲行（第二小项目） | ⏳ |
| BW-3 | 资产零调用纠正场景（模糊 prompt，看盲行者/owner 依手册自救） | ⏳ |
| BW-4 | 断点重入（中途杀会话再恢复） | ⏳ |

## W9 动态修复槽（工匠 agent ×1）

| id | task | 状态 |
|---|---|---|
| BFX-4..6 | （BW-2/3/4 的坑，波门填写） | ⏳占位 |

## W10 终验收口（工匠 agent ×1 + 编排者）

| id | task | 状态 |
|---|---|---|
| ACC-1 | 全量回归 + junction 冒烟 + 发布目录重生成终验 | ⏳ |
| DOC-1 | 看板/队列收口报告 + 记忆更新 + Owner 复核包 | ⏳ |

## 进度线

- [ ] W1　- [ ] W2　- [ ] W3　- [ ] W4　- [ ] W5　- [ ] W6-W8　- [ ] W9　- [ ] W10
