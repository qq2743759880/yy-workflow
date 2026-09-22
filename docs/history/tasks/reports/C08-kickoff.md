你是独立执行 agent（TT 派单 task C-08）。为 TT 仓库改造 ~/.ai-hub/skills/tt/scripts/lib/adapters/portman.mjs：从"仅 hash 记录"升级为调用已部署 portman 1.35 真实契约校验。
先读 spec：~/.ai-hub/skills/tt/.claude/specs/tasks/task-C08-portman.md。
实现（只改 portman.mjs）：probe portman --version 可用 + subtask.contract 是 OpenAPI JSON 文件路径时，跑真实 portman 校验（portman --local <file> 做 lint/collection，可加 --runNewman），解析输出 → contract-result.json 带真实 pass/diff，成功路径不设 degraded（mode 归 exec）；描述文本契约保持 pass:null+degraded；portman 不可用保持 CONTRACT_TOOL_NOT_AVAILABLE。Windows npm .cmd shim 需用 cmd /c 或 Node spawn 处理。
自测：临时 OpenAPI 文件跑 adapter 验证 contract-result.json 含真实 pass/diff；node scripts/regression-all.mjs 8/8 不破。不 commit。
