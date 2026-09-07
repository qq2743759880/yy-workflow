# Task: FE-10 README、索引文档同步与最终自检

## 概述
MVP 全部改动完成后，同步所有对外文档：README 使用说明与 `tt run` 示例、`ITERATION_PLAN.md` 与 PRD 的数量口径、`COMPETITORS.md` 的簇化标注，并做一次最终自检与提交。

## 所属与定位
- **阶段**：MVP（收尾）
- **层级**：Frontend（资产层 / 文档）
- **上游依赖**：**FE-01~FE-09、BE-01~BE-12 全部完成**
- **下游被依赖**：无（MVP 交付收口）

## 目标与非目标
**目标**
- README 含可复制的 `tt run` 示例与预期输出。
- 全仓文档口径一致（16 个资产、簇化说明、三个替换已接入）。
- 最终自检通过并提交。

**非目标**
- 不写商业价值/愿景类内容（vibe-coding-prd 硬性规则：删除不影响实现的信息）。
- 不新增功能。

## 前置条件
- FE-06 已确定最终资产数量（预期 16），BE-12 回归通过（16/16、0 警告、0 漂移、0 泄露）。
- BE-01 的 CLI（`node scripts/orchestrator.mjs`）可运行。

## 输入
- `README.md`、`ITERATION_PLAN.md`、`tt-together-agent-vibe-coding-prd.md`、`COMPETITORS.md`、`SKILL.md`。

## 需要创建 / 修改的文件

| 文件 | 动作 | 说明 |
|---|---|---|
| `README.md` | 修改 | 资产清单改为 16；新增「编排内核用法」段（`tt run` 示例与预期输出） |
| `ITERATION_PLAN.md` | 修改 | 若实际数量非 16，修正「26→16」表述；标注 MVP 已完成项 |
| `tt-together-agent-vibe-coding-prd.md` | 修改 | 同步数量口径；把已完成的 MVP 条目标注状态 |
| `COMPETITORS.md` | 修改 | 在附录 A「合并评估建议」中标注各簇**已合并**（原为建议） |
| `.claude/specs/dev-tt-optimization.md` | 修改 | 更新为 22 个任务的索引 |
| `ONBOARDING.md` / `OPTIMIZATION.md` | 按需修改 | 若含「26 个资产」表述，同步修正 |

## 实现步骤
1. **README 新增「编排内核用法」**：
   ```bash
   node scripts/orchestrator.mjs --task "实现后端登录模块"
   node scripts/orchestrator.mjs --task "实现后端登录模块" --dry-run --verbose
   node scripts/orchestrator.mjs --task "实现后端登录模块" --validate
   ```
   并给出预期输出示例（状态机日志 + 报告路径 + 退出码说明 0/2/3/4/5）。
2. README 资产清单：改为簇化后的 16 项（10 skill + 6 agent），并标注各簇来源（如 `frontend-design ← 原 5 合 1`）。
3. 修正数量口径：全仓搜索 `26 个` / `26 vendor` / `16 个` 等表述，统一为 FE-06 确认的实际值（预计 16）。
4. `COMPETITORS.md` 附录 A：把「建议合并」改为「已合并（MVP）」，并保留原建议内容作为历史依据。
5. 更新 `.claude/specs/dev-tt-optimization.md`：改为 22 个任务的索引表（任务号 / 标题 / 文件链接 / 依赖），替换原有的 14 项粗拆分。
6. 最终自检（逐项打勾）：
   - [ ] `node scripts/validate-structure.mjs` → 16/16、0 警告、0 漂移、0 泄露
   - [ ] `node scripts/orchestrator.mjs --help` → 用法输出，exit 0
   - [ ] `node scripts/orchestrator.mjs --task "实现后端登录模块" --dry-run --verbose` → 打印计划，无副作用
   - [ ] `node scripts/orchestrator.mjs --task "实现后端登录模块" --validate` → 回归通过
   - [ ] 三个适配器（opencode / bmad-cline / portman）均已注册且可被调用（或明确降级）
   - [ ] 全仓无 `26 个资产` 的旧表述残留
7. 提交：`git add -A && git commit -m "MVP: 编排内核 + 簇化 26→16 + 三个高杠杆替换"`，并（可选）推送到私密仓库。

## 关键契约 / 数据结构

```bash
# README 最小示例（必须可复制即运行）
node scripts/orchestrator.mjs --task "实现后端登录模块"

# 预期输出（示意）
[tt] idle → planning
[tt] cluster=T2_BACKEND, subtasks=3
[tt] planning → executing
[tt] [dry-run] 将执行 implementation        # 仅 --dry-run 时
[tt] executing → reviewing
[tt] reviewing → done
[tt] 报告: artifacts/report-<planId>.md
```

## 验收标准（Given / When / Then）
- Given README 已更新，When 复制其中的 `tt run` 示例到终端执行，Then 命令可运行并输出与文档示意一致的状态日志。
- Given 全仓文档，When 搜索 `26 个`，Then 除历史记录（CHANGELOG）外无残留的当前状态描述。
- Given `COMPETITORS.md` 附录 A，When 阅读，Then 五簇均标注为已合并（而非「建议」）。
- Given `.claude/specs/dev-tt-optimization.md`，When 阅读，Then 含 22 个任务的索引表且每项有文件链接。
- Given 最终自检清单，When 逐项执行，Then 全部通过且 `validate-structure.mjs` 输出 16/16。
- Given 提交完成，When `git log --oneline -1`，Then 提交信息含「MVP」与「26→16」。

## 验证命令
```bash
cd D:/.ai-hub/skills/tt
grep -rn "26 个" --include="*.md" . | grep -v CHANGELOG || echo "无残留"
node scripts/validate-structure.mjs
node scripts/orchestrator.mjs --help
node scripts/orchestrator.mjs --task "实现后端登录模块" --dry-run --verbose
node scripts/orchestrator.mjs --task "实现后端登录模块" --validate
git status
```

## 失败与回滚
- 失败：README 示例与实际输出不符 → 以实际运行输出为准修正文档（文档服从实现）。
- 失败：仍有 `26 个` 残留 → 用 `grep -rn` 定位后逐个修正。
- 回滚：`git checkout -- README.md ITERATION_PLAN.md COMPETITORS.md` 等文档（代码改动不受影响）。

## 风险与注意
- 文档口径不一致是本项目最容易退化的问题（PRD 说 16、README 说 26），必须全仓搜索确认。
- README 示例必须**真实可运行**，不能写示意性伪命令——后续 Agent 会直接复制。
- 本任务完成后 MVP 才算交付；在此之前所有任务都不算真正收口。

## 交付物检查清单
- [ ] README 含 `tt run` 真实示例与预期输出
- [ ] 资产清单改为 16 并标注簇来源
- [ ] 全仓数量口径一致（无 26 残留）
- [ ] COMPETITORS.md 五簇标注已合并
- [ ] 索引文档更新为 22 任务
- [ ] 最终自检全通过（16/16、CLI 可用、三适配器就绪）
- [ ] 已提交（提交信息含 MVP 与 26→16）
