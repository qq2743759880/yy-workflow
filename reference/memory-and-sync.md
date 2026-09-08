# 附 A9：记忆与同步 + 迭代优化机制（来源：SKILL.md §8 + §9，自包含可读）

> 本文件是 YY 收尾/记忆/自进化（闭环第 8 步之后）的权威说明（原 SKILL.md §8/§9 迁移至此）。任务收尾、跨会话恢复或修改本 skill 时读取。

## 记忆与同步（§8）

- 记忆分区按执行者（`<平台>-projects\`），与业务域正交；跨工具状态 → `project-handoff.md`；编排记录 → `$PROJECT_ROOT/.ai-hub/session-memory.md`。
- 分层记忆（按执行者分区，平台无关）：
```
$MEMORY_ROOT/
├── project-handoff.md            ← 主 agent 维护（全局看板）
├── <平台>-projects\<proj>\project_memory.md  ← 执行者=<平台> 的项目记忆
├── agent-memory\<agent>\*.md     ← 各子 agent 私有记忆
└── *.md                          ← 根级记忆专题（如 tt-project-memory.md 唯一事实源）
```
- 分区按**执行者**划分，与业务域正交；新平台接入 = 建 `<平台>-projects\` 目录 + 归集源接入。
- 各角色加载子集：主 agent=全局 plan+集成状态+契约清单（小）；测试 agent=域契约+验收准则+域记忆（中）；开发=仅本 task GWT+相关文件（最小）。
- 同步：每 task 完成后运行 `node $SKILL_DIR/scripts/sync.mjs`（或平台对应同步）；**同步方向先确认**（平台侧=事实源时先改平台侧再 gather，改 Hub 侧会被回滚）。
- 记忆检索：先索引/摘要（≤1000 token）→ 按需读取，禁止全量；可用 memory-mcp（`memory_index/search/read/write`）。
- 定期压缩记忆写断点，作为新会话恢复上下文的断点。

## 迭代优化机制（本 skill 自进化，必做，§9）

1. 每次执行结束，追加一条到 `CHANGELOG.md`：日期 / 项目 / 版本 / 问题 / 处置 / 修改点。
2. 定期做"外部对比自批判"：检索最新 MAS 编排/自进化研究（如 Skill-MAS），用真实数据对比本 skill 的 8 步闭环 vs 论文三段式；取可迁移原则（证据回写/脚手架保护），弃不适配项（K 多轨迹、ground-truth 依赖）。
3. 修改 skill 时必须 bump `version` 并更新 frontmatter 触发词。