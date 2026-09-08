# REWRITE 报告：validate-structure 硬性协议校验器 + SKILL.md 真渐进披露

> 独立重构子 agent · 2026-09-08 · 基线 HEAD `f17565f`（M2-R2 批判提交）。
> 任务：按 M2-R2 批判 C30-C35 执行两项根因修复——①重写 validate-structure.mjs 为硬性协议校验器（不可绕过）②重构 SKILL.md 为真正渐进披露（≤60 行）。

## 一、validate-structure.mjs 新断言清单（13 条硬性断言，全硬编码，无配置跳过，无 --verbose 绕过）

在既有 9 类检查（frontmatter / 章节警告 / $VAR 声明 / vendor 存在 / 可移植性 / vendor frontmatter 接口 / U+FFFD 编码 / --prereq-check 调用行）基础上新增：

| # | 断言 | 拦截对象 | 判定逻辑（grep/实测源码级） | 基线结果 |
|---|------|---------|---------------------------|---------|
| H1a | SKILL.md ≤60 行 且 ≤1200 token | C-30 复发（渐进披露回退） | CJK 加权字符级实测：non-CJK/2 + CJK×0.6，逐字符 codePoint 判定（CJK 统一表意+扩展A+CJK标点+全角）；行数为 wc -l 口径 | **PASS 60 行 / 881 tok** |
| H1b | commands/*.md 每文件 ≤500 token | C-30（阶段命令膨胀） | 同口径，6 文件逐个实测 | PASS 6/6 达标 |
| H2 | 交叉引用完整性（三项合一） | C-25/C-33 复发（悬空引用） | ① owner-review 字面引用 → Test-Path；② 「XX 段」引用 → 目标模板（contract/completion-report/dev-plan+自身）中 `#` 标题含该段名；③ tab 损坏模式 `[\t\\] ?emplates\/` 与 `\templates\/` 正则扫描 | PASS 零悬空 |
| H3a | commands/*.md 含 `--prereq-check` 字面量 | C-31（祈使句未接线） | 沿用⑨扫描，升级为硬断言 | PASS 6/6 |
| H3b | tt-journey.mjs 含 `--update` 分支 | C-31（闸门被拆） | grep `has('update')` | PASS |
| H3c | tt-journey.mjs --update 路径含 `prereqCheck` 调用 | C-31 | grep 源码 `prereqCheck(`（:101 定义 :132/:492 调用） | PASS |
| H3d | orchestrator.mjs 含 `syncJourney` | C-31 | grep 源码 | PASS |
| H3e | syncJourney 路径含 journey 写入 | C-31 | 提取 syncJourney 函数体 4000 字符窗口，grep `journey.steps=` / `writeFile(...journey` / `updateJourney(` | PASS |
| H4 | kickoff-prompt 资产清单与 matrix.mjs CLUSTERS 逐字对齐 | C-26 复发（清单漂移） | 动态 import CLUSTERS（零依赖），5 簇 30 个 candidates 逐个 grep `vendor/<asset>/` | PASS 30/30 |
| H5 | 附 A 变量声明完整（6 核心变量）+ 正文 $VAR 全部已声明 | 双源漂移 | 锁定 CORE_VARS 集合（SKILL_DIR/AIHUB_ROOT/PROJECT_ROOT/MEMORY_ROOT/PLATFORMS/TT_HTTP_PROXY）缺一 FAIL；复用③扫描 | PASS 6/6 + 零未声明 |
| H6a | reference/ 10 文件齐备 | C-30 拆分回退 | Test-Path 逐文件 | PASS 10/10 |
| H6b | SKILL.md 指针表覆盖全部 reference/ 文件 | 删指针行漂移 | 逐文件 grep `reference/<name>` 在 SKILL.md | PASS 10/10 |
| H6c | reference/ 单文件 ≤2000 token | 拆分后文件仍臃肿 | 同 H1 口径 | PASS（最大 dispatch 1917 tok） |

输出格式：每条 `[PASS/FAIL] <断言名> — <详情>`，FAIL 具名文件+缺失项；任何 FAIL 汇入 errors → exit 1，`--verbose` 只控制旧警告显示，**不影响硬断言判定**。

**负向测试（证明不可绕过，6/6 触发 exit 1）**：

| 植入故障 | 触发断言 | 结果 |
|---------|---------|------|
| 命令文件引用 ghost-review.md（不存在） | H2 悬空 1 处具名 | exit 1 ✅ |
| 回植 `\t emplates/` tab 损坏引用 | H2 tab 损坏具名 | exit 1 ✅ |
| 删 yy-4 的 --prereq-check | H3a 5/6 命中 | exit 1 ✅ |
| kickoff 删 sdlc 行 | H4 漂移 4/30 具名（be-architect/sdlc×2 簇） | exit 1 ✅ |
| SKILL.md 注入 3 行膨胀至 64 行 | H1a 实测 64 行超限 | exit 1 ✅ |
| 附 A 删 `$TT_HTTP_PROXY` 声明 | H5 附 A 缺 TT_HTTP_PROXY 具名 | exit 1 ✅ |

（另有删 reference/frontend-gate.md → H6a 具名 FAIL，同样 exit 1，测试后已还原。）

## 二、SKILL.md 前后对比（修复二）

| 指标 | 前（HEAD f17565f） | 后 | 变化 |
|------|------------------|-----|------|
| 行数（wc -l） | 339 | **60** | -82% |
| 字符数 | 21,140 | 1,899 | -91% |
| token（CJK 加权 non/2+CJK×0.6） | ≈9,300 | **995**（H1a 实测 881 为去 frontmatter 正文口径，全文 995） | -89% |
| token（现实口径 non/4+CJK×1.0 参考） | — | 815 | — |
| version | 0.2.0 | 0.3.0 | bump |

### 保留在 SKILL.md（60 行预算内）
- frontmatter（name / description 精简触发词 / version 0.3.0）
- §0a 阶段命令索引（7 行触发映射表 + 注入纪律 1 行——owner 最常用路径常驻）
- §0b 闭环全景（10 行 ASCII 核心心智模型）
- 三条红线（契约先冻结 / APPROVED before code / 独立实证验收，各 1 行）
- 分层协议指针表（10 行，每行「何时需要 → reference/ 文件」）
- 附 A 变量声明清单（validate H5 扫描所需，**保留在 SKILL.md 内**）
- 附 B TTHP 一行（详情指向 reference/yy-tt-diff.md）

### reference/ 拆分清单（10 文件，原 §0~§9 + 附B/C 全量迁移，每文件头部 3 行注明来源章节+读取时机）

| 文件 | 承接原章节 | 行数 | token |
|------|-----------|------|-------|
| variables-and-config.md | §0 变量表+初始化+自包含说明 | 21 | 585 |
| asset-integration.md | §1+§1c vendor 清单+竞品直用策略 | 37 | 1467 |
| documentation.md | §2+§2.1+§2.2 | 23 | 749 |
| task-decomposition.md | §3 | 10 | 541 |
| planning.md | §4 | 12 | 915 |
| dispatch-and-acceptance.md | §5.0~§5.6（瘦身至 1917 tok，≤2000 断言内） | 65 | 1917 |
| frontend-gate.md | §6.0~§6.6 | 68 | 1833 |
| critique-protocol.md | §7 | 14 | 644 |
| memory-and-sync.md | §8+§9 | 26 | 644 |
| yy-tt-diff.md | 附B（TTHP）+附C（YY/TT 差异表） | 23 | 667 |

注：任务书要求 9 个文件，实际拆 10 个——原附 B/附 C 无法合理塞进 memory-and-sync.md（会把该文件推超预算），独立为 yy-tt-diff.md，SKILL.md 附 B 指针指向它。超出部分如实登记。

### 配套调整
- validate ②「闭环关键节」警告检查同步更新：§1~§9 章节已迁移，改为检查 SKILL.md 残留节（0a/0b/红线/分层协议）+ reference/ 文件头部来源章节号（防「搬迁丢纪律」），0 警告。
- 4 处 `\t emplates/` 损坏引用（C-33 现行犯，yy-1/yy-2/yy-3/yy-5 各 :20 行）修复为 `templates/`——这是 H2 断言的前置条件，不修则 validate 必 FAIL。

## 三、回归结果（全绿）

| 验收项 | 命令 | 结果 |
|-------|------|------|
| 1. validate 含新断言 | `node scripts/validate-structure.mjs` | **exit 0**，13/13 硬断言 PASS，0 警告 |
| 2. 一键回归 | `node scripts/regression-all.mjs` | **8 PASS / 0 FAIL**（S1~S8 全绿） |
| 3. CI | `node scripts/ci.mjs` | **CI PASS**（exit 0） |
| 4. SKILL.md 预算 | 实测 | **60 行 / 995 tok**（≤60 行 / ≤1200 tok ✅） |
| 5. reference/ 齐备 | 实测 | 10/10 文件（任务书 9 个 + 附B/C 独立 1 个） |
| 6. 交叉引用零悬空 | H2 断言 | PASS |
| 7. CLUSTERS-kickoff 一致 | H4 断言 | PASS 30/30 |

## 四、诚实披露（偏差与限制）

1. **分支偏差**：任务书写明分支 `feature-yy-owner-ux`，但仓库实际仅有 `master` 分支（HEAD f17565f 与任务书给的 HEAD 一致，即同一提交线）。改动落在 `master` 工作区，未建新分支——分支名与实际不符，未擅自建分支，交由 owner 决定提交策略。
2. **未提交 commit**：任务未授权提交，全部改动停在工作区（git status 可见 6 modified + reference/ 新目录），等待验收后指示。
3. **token 口径**：任务书口径（non-CJK/2 + CJK×0.6）字符级实测；该口径对 ASCII 偏重（3 个 ASCII 字符≈1.5 tok，现实 tokenizer≈0.75），故同时给出现实口径参考值（815 tok）。两口径均远低于 1200 上限，结论不敏感于口径选择。
4. **reference/ 为 10 个而非 9 个**：附 B+附 C 合并迁移超出 memory-and-sync.md 承载（会超 2000 tok 断言），独立成 yy-tt-diff.md。H6a 断言按 10 文件清单硬编码。
5. **「XX 段」断言当前 0 命中**：六份命令文件现行无「XX 段」句式引用（C-25 批判语境中的悬空段引用未在当前文本出现），H2-2 逻辑为防御性预埋——已用「四段结构」句式验证正则可命中（contract-review 等四段结构模板在场），未来命令文件引入该句式即受保护。
6. **tab 损坏正则修正过一次**：首版 `[\t\\]emplates\/` 未覆盖「tab+空格+emplates」（C-33 实际形态是 `\t emplates/` 含空格），负向测试暴露后改为 `[\t\\] ?emplates\/|\\templates\/`，负向测试复验 TRIPPED。这恰好证明负向测试的必要性。
7. **任务书预期的「先写断言 SKILL 必 FAIL」中间态**：实际执行顺序为 reference/ 先行 → SKILL 瘦身 → 断言落位，未经历 FAIL 中间态；中间态的 FAIL 行为由负向测试 T5（注入 3 行膨胀 → H1a TRIPPED）等价覆盖。

## 五、改动文件清单

```
M  SKILL.md                        339→60 行重写（v0.3.0）
M  commands/yy-1-requirement.md    :20 tab 引用修复（1 行）
M  commands/yy-2-planning.md       :20 tab 引用修复（1 行）
M  commands/yy-3-contract.md       :20 tab 引用修复（1 行）
M  commands/yy-5-critique.md       :20 tab 引用修复（1 行）
M  scripts/validate-structure.mjs  +182 行硬性断言（H1~H6）
A  reference/                      10 个 .md（§0~§9+附B/C 全量迁移）
A  docs/history/REWRITE-report.md  本报告
```