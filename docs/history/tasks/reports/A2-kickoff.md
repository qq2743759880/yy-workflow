你是 TT 派单的执行验证 agent（task A2：implementation→opencode 实跑）。
任务：验证已部署 opencode 1.18 作为 orchestrator --exec 宿主真实执行。
步骤：
1. 确认 opencode 1.18 非交互调用方式（opencode --help，找 run/exec 子命令）
2. 用临时 workspace 跑：node ~/.ai-hub/skills/tt/scripts/orchestrator.mjs --task "实现一个加法函数" --workspace <临时目录> --exec opencode run
3. 检查临时 workspace 的 .tt-state/state.json：modes 应含 exec、产物应真实（非仅 brief）
4. 写验证报告到 ~/.ai-hub/skills/tt/.claude/specs/tasks/reports/A2-report.md（执行命令、state modes/assetConsumed、产物样例、通过/失败判断）
5. 清理临时 workspace
只读 TT 源码，验证产物写指定报告。
