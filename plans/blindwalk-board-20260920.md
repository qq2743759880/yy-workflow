# 盲测看板 — blindwalk 20260920（制度③）

> 协议：`plans/blindwalk-protocol-20260920.md`。Owner 中继更新状态；编排者只读坑清单+修复。

| task | 依赖 | 状态 | 盲行者 | 坑数 | 修复 task | 复验 |
|---|---|---|---|---|---|---|
| BW-1 全流程直跑（阶段 0→5 完整闭环，真项目：ChatGPT 本地文件审查助手） | 无 | ⏳ 派单就绪 | 执行平台 A | - | - | - |
| BW-2 多分支 --session 第二小项目 | BW-1 | ⏸ blocked | 执行平台 A | - | - | - |
| BW-3 资产零调用纠正场景（模糊 Prompt + Owner 依手册催办） | BW-1 | ⏸ blocked | 执行平台 B | - | - | - |
| BW-4 中途断点重入（BW-1 中途杀会话再恢复） | BW-1 | ⏸ blocked | 执行平台 B | - | - | - |

坑登记（来自 issues.md，编排者复现后分类）：

| # | 来源 | 坑（摘要） | 编排者复现 | 分级 | 修复 | 复验 |
|---|---|---|---|---|---|---|
| 1 | 预跑（ZCode 实跑截图+日志 sess_268a7a12） | junction 部署全 CLI 静默失效（exit 0 零输出；isMain 直等比较 vs import.meta.url realpath） | ✅ 复现 | P0 | ✅ 4 脚本 isMainFileMatch realpath 归一（fix-20260921/） | ✅ junction-smoke 4/4 |
| 2 | 预跑（截图） | 命令文件首行缺 --workspace → prereq-check 读技能目录 .tt-state（阶段 1+ 死锁风险） | ✅ 复现（tt-journey.mjs:501 workspace='.'） | P0 | ⏳ 待修（--workspace "$PROJECT_ROOT" 或 YY_WORKSPACE env） | - |
| 3 | 预跑 | 每命令权限确认摩擦（ZCode 权限门 × 每阶段 3-6 次 node） | 目测 | P2 | 待议（README 部署节建议选"始终允许"） | - |
| 4 | 预跑 | 盲行者烧完配额未写 session-notes（坑收集机制依赖自觉，无兜底） | ✅（日志取证替代） | P2 | 协议补丁：Owner 收报告须收集会话总结；编排者可从 db 自取 | - |
| 5 | Owner 实跑投诉 | memory 层臃肿：$MEMORY_ROOT/config.memoryRoot/memory-and-sync.md/sync.mjs 把 agent 引去探索 D:.ai-hubmemory（423KB） | ✅（session parts 取证：memory 相关读取 10 处） | P1 | ✅ 全层切除（SKILL.md/variables/config.example/validate-structure H 断言/4 处 reference 引用）；sync.mjs 删除 | ✅ 回归 12/12 + validate 0 |
