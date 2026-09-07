# T10 Report — 根目录/开发目录历史日志归档到 docs/history/

- 日期：2026-09-01
- 执行方：TT 工作流独立实现子 agent
- 目标：把仓库根部与 `.claude/specs/tasks/` 下的开发期日志文档（验收报告/测试 Prompt/交接 DAG/PRD/迭代计划/竞品部署等）移入 `docs/history/`，保持开源发布包根部干净。

## 移动清单（src → dst）

### 1. 根目录 → `docs/history/`（11 个 md，全部 git mv，保留历史）

| src（仓库根） | dst（docs/history/） |
|---|---|
| ACCEPTANCE-REPORT.md | ACCEPTANCE-REPORT.md |
| ACCEPTANCE-REPORT-P0-P3.md | ACCEPTANCE-REPORT-P0-P3.md |
| ACCEPTANCE-REPORT-PHASE2.md | ACCEPTANCE-REPORT-PHASE2.md |
| CRITICAL-TEST-PROMPT.md | CRITICAL-TEST-PROMPT.md |
| HANDOFF-P1-PARALLEL-DAG.md | HANDOFF-P1-PARALLEL-DAG.md |
| TEST-HANDOFF-PROMPT.md | TEST-HANDOFF-PROMPT.md |
| tt-together-agent-vibe-coding-prd.md | tt-together-agent-vibe-coding-prd.md |
| ITERATION_PLAN.md | ITERATION_PLAN.md |
| OPTIMIZATION.md | OPTIMIZATION.md |
| RELEASE.md | RELEASE.md |
| COMPETITOR-DEPLOYMENT.md | COMPETITOR-DEPLOYMENT.md |

### 2. `.claude/specs/tasks/` → `docs/history/tasks/`（56 个文件）

- 平铺任务/spec 文件：41 个 → `docs/history/tasks/`
- 报告子目录：15 个 → `docs/history/tasks/reports/`（保留 reports 子目录结构）
- 其中 **52 个 git 跟踪文件**用 `git mv`（`git mv .claude/specs/tasks docs/history/tasks`，全部识别为 rename），**4 个未跟踪报告**（T6/T6FIX/T7/T8-report.md）为纯文件系统移动（本就未跟踪，无历史可保留）。

**与派单背景的数量偏差（诚实声明）**：派单称「59 个 git 跟踪文件」，实测 `.claude/specs/tasks/` 下共 **56 个文件**（52 跟踪 + 4 未跟踪）。56 + 移动后留在 `.claude/specs/` 的 7 个顶层 spec = 63，非 59；以磁盘实查为准，无文件丢失。

### 3. 移动后 `.claude/` 状态

- `.claude/specs/` 仅剩 7 个顶层 spec（dev-*.md / HANDOFF-PROMPT.md / muse-tt-fusion-plan.md / thirdparty-replacement-plan.md），按任务要求保留。
- 重建 `.claude/specs/tasks/reports/` 作为后续报告工作目录（本报告即落于此）。

## 引用更新点（README/SKILL/ONBOARDING 全文 grep 后仅以下 3 处为路径引用）

| 文件 | 行 | 原文 | 更新后 |
|---|---|---|---|
| README.md | 61 | `COMPETITOR-DEPLOYMENT.md` | `docs/history/COMPETITOR-DEPLOYMENT.md` |
| README.md | 目录结构节 | 根树含 `OPTIMIZATION.md`；`docs/` 无子项 | 移除根 `OPTIMIZATION.md`；`docs/` 下新增 `└── history/`（历史日志文档，非开源必需） |
| SKILL.md | 92 | `$SKILL_DIR/COMPETITOR-DEPLOYMENT.md` | `$SKILL_DIR/docs/history/COMPETITOR-DEPLOYMENT.md` |

- **ONBOARDING.md**：grep 无对已移动文件的任何引用，未改。
- **COMPETITORS.md**：grep 无「COMPETITOR-DEPLOYMENT」出现（既非概念提及也非路径），未改。
- **保持不动**：CHANGELOG.md 中 COMPETITOR-DEPLOYMENT.md 的历史事实性提及（变更记录，改写即篡改历史）；`.claude/specs/*.md`、`vendor/*.md`、`templates/*.md` 中的 ITERATION_PLAN / OPTIMIZATION / PRD 提及均为内容性/历史性描述，非可执行路径；docs/history/ 内部文档的互相引用（如 TEST-HANDOFF-PROMPT.md → ACCEPTANCE-REPORT-PHASE2.md）同目录相对引用依然有效。

## validate 结果

```
node scripts/validate-structure.mjs --verbose
[TT] validate .../SKILL.md
  frontmatter: OK
  章节数: 30, 闭环关键节 10 项检查中警告 0 项
  变量使用: 6 个 (AIHUB_ROOT, MEMORY_ROOT, PLATFORMS, PROJECT_ROOT, SKILL_DIR, VAR)
  未声明变量: 无
  随包 vendor 资产: 16/16 存在
  接口漂移(vendor frontmatter): 无
  可移植性泄露: 无
  编码损坏(U+FFFD): 无
[OK] 结构校验通过 (0 项警告, exit 0)
```

注：validate 扫描面为 SKILL/README/ONBOARDING/scripts/*.mjs/templates/*.md，已确认其中无对已移动文件的悬空相对引用；含本机绝对路径的 COMPETITOR-DEPLOYMENT.md 移入 docs/history/ 后退出扫描面，不再触发可移植性告警。

## 归档后仓库根部（开源发布面）

```
SKILL.md / README.md / CHANGELOG.md / LICENSE / install.ps1 / install.sh /
config.example.json / ONBOARDING.md / COMPETITORS.md  +  目录（.ai-hub/assets/docs/plans/scripts/templates/vendor/artifacts）
```

`docs/history/` = 11 个根级日志 md + `tasks/` 41 个平铺文件 + `tasks/reports/` 15 个报告，共 67 个历史文档。

## 验收结果

```
git status → 11 个根文件 + 52 个任务文件全部识别为 R（rename），无删除丢失；4 个未跟踪报告随目录移动
根目录仅剩开源必需文件（SKILL/README/CHANGELOG/LICENSE/install×2/config.example/ONBOARDING/COMPETITORS）
docs/history/ 含 11 md + tasks/ 41 + tasks/reports/ 15（合计 67）
node scripts/validate-structure.mjs → [OK] 结构校验通过（0 项警告，exit 0）
README 目录结构节已更新（加入 docs/history/，移除根 OPTIMIZATION.md）
```
