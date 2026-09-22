# HARD-2 + HARD-3 派单 — make-release.mjs 一键发布（含 purge 纪律固化）

你是 autopilot 管线 L1 独立执行 agent（全新上下文）。工作区：`D:\.ai-hub\skills\yy`。HARD-2 与 HARD-3 同写面（`scripts/make-release.mjs`），由你一个 agent 串行完成。完成后交付证据，不自称 DONE。

## 背景（编排者实测教训，设计输入）
- 发布 = 把仓库发布面刷新到安装目录 `C:\Users\Administrator\.agents\skills\yy`（junction 形态；先 `cmd //c dir C:\Users\Administrator\.agents\skills` 亲自确认安装面现状与 junction 指向）。
- 历史事故：FE-4/FIX-1 并行期 robocopy 撞窗口（D-FE4-6）；memory 层删除后发布面残留旧文件，靠**手工删除**清理（HARD-3 要固化的正是这条教训）——**发布必须先 purge 再复制**，否则删除型变更永远不生效。
- 泄露审计：`scripts/validate-structure.mjs` 已有"可移植性泄露/U+FFFD/编码损坏"检查可参考口径；发布审计关注绝对路径、机器名、用户名、临时目录等本机信息外泄。

## 任务 A（HARD-2）：新建 `scripts/make-release.mjs`
一条龙：① robocopy 按发布规则刷新（等价手工 robocopy /MIR 的语义，排除 .git/.tmp-*/test-reports/ 等非发布面——排除清单你从现状安装面实际内容反推并显式列在脚本头注释）→ ② **purge**（目标目录里"发布面之外/已从源删除"的文件先清除，见任务 B）→ ③ 泄露 grep 审计（对产物目录跑泄露模式清单，零命中才 exit 0）→ ④ 可选 `--mklink`（junction 缺失时创建，已存在时报幂等成功而非报错）。
CLI：`node scripts/make-release.mjs [--mklink] [--dry-run]`；`--dry-run` 只打印将做的动作不落盘。

## 任务 B（HARD-3）：purge 纪律固化
- purge 规则显式化：目标目录中不属于本次发布清单的文件/目录 → 删除（等价 /MIR 语义），并打印逐项 PURGED 清单留证。
- 用 memory 残留做验收样本：若安装面存在已从源删除的文件（如 memory-and-sync.md、sync.mjs），purge 后必须消失。
- **安全阀**：purge 只允许作用于脚本解析出的安装目录内；目标路径解析必须校验（含 realpath 归一，防 junction 误判——仓库 9-21 曾有 realpath 不匹配导致 isMain 失败的教训，见 scripts/orchestrator.mjs 相关注释）；检测到目标含 .git 即中止（防止把仓库根当发布面误 /MIR）。

## 自测（必须，证据落 `test-reports/autopilot-work/HARD-2/`）
1. `--dry-run` 全流程打印且零落盘（前后目录 mtime/清单对比）。
2. 真实发布：产出目录过泄露审计零命中；重跑一遍幂等（第二次 diff 为空/PURGED 空）。
3. purge 验证：在安装面放一个假残留文件（命名明显如 zz-purge-selftest.tmp）→ 重跑 → 文件消失且打印在 PURGED 清单。
4. 事后核对 junction 形态仍健康：`node test-reports/fix-20260921/junction-smoke.mjs` 全 PASS。
5. RESULTS.md：逐项证据 + D-xxx 偏差。

## 禁止
改 SKILL.md、commands/、webview/、contracts/、plans/、其他 scripts/；读 test-reports/acceptance-*/；git 操作；删除或重建已存在的 junction（已存在则保持原样）。若安装面与预期严重不符（比如根本不是 junction），停下来在 RESULTS.md 如实登记并按现状保守处理，不臆断。

## 验收要点（编排者 L2 将复核）
产出目录过审计零命中；重跑幂等；从干净 release 重生成无残留旧文件。
