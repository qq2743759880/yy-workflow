# critique-backlog-tracker（yy 域镜像 · M1 批判段）

> 本文件为 review-gate（ROOT=yy/）读取域；**主 tracker 唯一事实源在仓库根 `plans/critique-backlog-tracker.md`**（C-01 起全量历史）。本镜像只承载 yy 专属批判段，行格式对齐主表 C-xx；两侧以序号同步，禁止在此改历史行。

## M1 journey/commands 技术批判（2026-09-07，YY M1 毒舌批判，详见 yy/plans/tasks/M1-技术批判.md）
| # | 批判（行中源） | 级别 | 修复 | 验收指标 | 状态 |
|---|---|---|---|---|---|
| C-16 | 防跳阶段旁路：唯一机验入口 --prereq-check 仓库 0 处调用，--update 写路径无前置校验直接标 done（E1 实测 exit 0） | P0 | tt-journey --update 内联 prereqCheck（--force 越过留痕）+ orchestrator syncJourney 写前校验 | 未满足前置非法更新 0%；GWT6/7 过；回归 8/8 | ✅ |
| C-17 | journey.json 并发读-改-写无锁（两个收尾写入点，后写覆盖先写；E4 未复现丢失属时序运气） | P0 | withJourneyLock（O_EXCL + 400ms×5 重试 + 30s stale 自愈），零依赖自研 | 20 轮 2 进程并发 syncJourney plans[] 双条目存活 100% | ✅ |
| C-18 | Windows GBK（chcp 936）下 ASCII 进度图中文/符号全乱码（E2 实测）——目标用户主场景不可读 | P1 | renderJourney ASCII 降级模式（win32 非 WT_SESSION 自动，--ascii 强制） | chcp 936 输出 GBK 解码乱码字节 0；GWT9 | ✅ |
| C-19 | 位置判定错乱：回跳节点 2/4/6 pending 时主干 7/8 已 done 仍显示「重执行1（待推进）/下一阶段：无」（E6 实测） | P1 | currentAndNext 只认 FORWARD_LINE，回跳层改附注行 | GWT10：主干全 done 输出「全部主干节点已完成」 | ✅ |
| C-20 | 推断层静默吞损坏数据源：UTF-8 BOM 的 state-summary 被 JSON.parse 丢弃 → 谎称「无历史可推断」（E3 实测，Windows PS5.1 Set-Content 必产 BOM） | P1 | readJsonLoose 剥 BOM + parse 失败 stderr WARN 不静默 | 带 BOM summary 推断成功率 100%；GWT11/12 | ✅ |
| C-21 | token 宣称不诚实：dev-plan 写「各 344-449 token」实测 o200k_base 378-479（下界虚报 34）；「显著降低」未计 journey 渲染叠加（真实 ~600-800 tok/注入） | P1 | scripts/token-audit.mjs 机验宣称 vs 实测（偏差>10% FAIL）+ dev-plan/PRD 口径改注编码器与叠加成本 | 宣称实测偏差 ≤10%；快照入 docs/history | ✅ |
| C-22 | 「渐进披露」名不副实：6 命令文件为死文本，无 agentskills L1 元数据自动触发层（规范原文 ~100 tok 启动加载），SuperClaude 30 命令走原生装载 | P2 | SKILL.md 顶部加 ≤120 tok 阶段命令索引（L1 层）+ description 触发词统一 | L1 段 ≤120 tok 实测；validate 断言 | ✅ |
| C-23 | 双事实源无交叉核对：PRD 承诺「两口径可交叉核对」，仓库无任何对照逻辑（state failed vs journey step7 done 矛盾无人发现） | P2 | tt-journey --consistency-check [--strict]（MISMATCH/WARN 三态） | GWT13 三态用例全过 | ✅ |
| C-24 | 生态位差距未承认：SuperClaude pm agent 常驻自动恢复上下文（v4.3.0，23,871★，2026-09-07 API 实测）vs YY 被动文件；anthropics/skills 174,939★ | P2 | COMPETITORS.md 增「F1/F2 vs SuperClaude pm agent」节（3 带日期 URL），不承诺 stars 追平 | 文档 1 节 ≤40 行；URL 过 review-gate --verify-urls | ✅ |

- [x] 2026-09-07 M1 批判登记 9 条（C-16~C-24，竞品 URL 均当日真实访问，P0×2/P1×4/P2×3，修改方案见 yy/plans/tasks/M1-优化修改方案.md；主 tracker 同步于仓库根 plans/critique-backlog-tracker.md）

## M2 owner-review/资产透明化 技术批判（2026-09-07，YY M2 毒舌批判，详见 yy/plans/tasks/M2-技术批判.md）
| # | 批判（行中源） | 级别 | 修复 | 验收指标 | 状态 |
|---|---|---|---|---|---|
| C-25 | owner-review 五份指引段落名引用为裸字符串，悬空引用 0 机验（validate-structure.mjs:95 仅查文件存在）；PRD FR-3 GWT3「无悬空引用」承诺无执行者，模板段落改名五份指引静默全悬空 | P1 | 新增 scripts/owner-review-linkcheck.mjs（解析引用段落名→grep 目标模板→悬空 FAIL exit 1），挂进 regression-all S9 | 悬空检出率 100%、误报 0；植入假引用 FAIL/还原 PASS；regression 8/8 | ✅ 2026-09-08 独立验收 PASS（owner-review-linkcheck.mjs：正向 33 文件/7 refs PASS；我亲手 fixture 反向 DANGLING+TAB-CORRUPT 双具名 FAIL exit 1；真实场景临时改删 concept-signoff.md → yy-1:20 悬空具名 FAIL、还原 PASS；regression 11/11 含 S11） |
| C-26 | kickoff-prompt.md 五簇 30 资产清单是 matrix.mjs CLUSTERS 手抄第二事实源，regression S3 漂移门只覆盖 Phase 2 替换清单不覆盖 kickoff；CLUSTERS 增删资产 kickoff 静默漂移 | P1 | matrix.mjs 导出 renderKickoffClusters() + scripts/kickoff-drift-check.mjs 比对（diff 非空 FAIL），五簇段标「生成物勿手改」 | 基线 diff=0；加假资产 FAIL 具名；还原 PASS | ✅ 2026-09-08 独立验收 PASS（kickoff-drift-check.mjs 集合比对：基线 PASS；我亲手双向探针——kickoff 塞合法形态假资产→DRIFT 多出具名 FAIL、CLUSTERS 增 ghost-extra→DRIFT 缺失具名 FAIL、各还原 PASS 零残留；kickoff 加勿手改标记；regression 12/12 含 S12） |
| C-27 | 「域声明缺失记 warning」由谁执行空白：asset-call-rate.mjs:136-137 只读 assetConsumed 等四字段无域声明逻辑，state.json 不落域声明，FR-5 GWT 0 机验路径，透明化退化口号 | P0 | state-summary 增 domainDeclared 字段（kickoff 模板要求落盘）；asset-call-rate.mjs 缺声明输出 DOMAIN_DECL_MISSING warning；summary-read 透传 | 缺声明检出率 100%；旧数据 N/A 不误伤；regression 8/8 | ✅ 2026-09-08 独立验收 PASS（我亲手构造 3 fixture 实测：false→DOMAIN_DECL_MISSING [st1/be-security] 具名、true→ok、无字段→N/A；orchestrator domainDeclaredMissing 落盘 grep 实证；summary-read 透传 missing(1) 实测；regression 9/9 含新 S9；validate EXIT=0） |
| C-28 | 白话化没有「测」：五份指引零可读性度量、零 owner 试读留痕，违反 plainlanguage.gov「Test for understanding」基本纪律；术语解释项自己含未解释黑话（冻结/变更单） | P2 | 每份指引加「30 秒自测三问」（答案指针化防双源）；1 次 owner 试读留痕 docs/history/owner-review-trial.md；readability-baseline.mjs 句长/术语密度基线回归 | 三问覆盖 5/5；试读留痕 ≥5 条；基线落盘回归可跑 | ⬜ |
| C-29 | 五份指引无 L1 元数据层，触发靠 SKILL.md 0a 手动表 + 模型自觉（M1 C-22 教训未承接）；无 SuperClaude 式自列入口命令，「有哪些审核指引」不可枚举 | P2 | SKILL.md 0a 升级对齐 agentskills 规范 L1 元数据块（≤120 token）；validate-structure 断言目录扫描覆盖 5/5，缺行 FAIL | 断言 5/5 PASS；删行 FAIL 具名；token 实测入 docs/history | ⬜ |

- [x] 2026-09-07 M2 批判登记 5 条（C-25~C-29，竞品 URL 均当日真实抓取核验，P0×1/P1×2/P2×2，修改方案见 yy/plans/tasks/M2-优化修改方案.md）

## M2-R2 第二轮技术批判（2026-09-08，用户实测反馈 + 遗留验证，详见 yy/plans/tasks/M2-R2-技术批判.md）
| # | 批判（行中源） | 级别 | 修复 | 验收指标 | 状态 |
|---|---|---|---|---|---|
| C-30 | 渐进披露是假的：SKILL.md 339 行/21,140 字符（CJK 加权 ≈9.3k token）每次触发全文进上下文，用户实测单次交互 6-8k token；§0a「≤500 token 摘要」被本体吞回 18 倍；agentskills 规范（2026-09-08 抓取）body <5000 tok 推荐/<500 行 + 互斥上下文拆文件，YY 超推荐值 86% 且互斥内容（§6 前端 gate 等）不拆分每阶段付全价 | P0 | SKILL.md 瘦身 ≤60 行：§0a 压缩 L1 索引 + 0b 全景 + 指针表；其余移 references/（setup/asset-inventory/phase-docs/phase-planning/phase-execute/frontend-gate/critique-rule/protocol-and-appendix，拆分清单见 M2-R2-优化修改方案.md §1）；validate 断言 ≤60 行 + 指针表覆盖 | SKILL.md ≤60 行/≤1.5k tok；单阶段交互实测 ≤2.5k token；validate 断言 PASS + 删指针 FAIL | ✅ 2026-09-08 独立验收 PASS（SKILL.md 60 行/701 tok 实测达标；validate H9 硬断言在场且 PASS；反向用例塞 120 行 gate FAIL +201.6% 具名后还原 PASS——我亲手操作） |
| C-31 | 阶段纪律纯 prompt 级：「先跑 prereq-check」是祈使句，注入路径零闸门（机器闸门仅 --update exit 3 写路径）；gate 产物模板无「阶段机验」字段，跑没跑无痕可查，防跳阶段靠 agent 自觉；validate-structure 机验的恰是「祈使句在场」（validate-structure.mjs:158-166 只查 --prereq-check 字符串） | P1 | 6 个 gate 模板（owner-review×5 + completion-report）加「阶段机验」字段（注入前实跑回填）；validate-structure 断言字段存在；review-gate 验收核对字段已回填 | 删字段 validate FAIL 具名；空字段验收核对 FAIL；回填 PASS；regression 8/8 | ⬜ |
| C-32 | C-25~C-29 修复 0/5 落地（实测 HEAD b74d40d，2026-09-08 复测：无 linkcheck/drift-check/readability-baseline/token-audit 脚本、matrix 无 renderKickoffClusters、全仓 domainDeclared 零命中、无 trial 留痕），批判滞后闭环机制对自己失灵 | P1 | 修复批次 B0(止血+量尺)→B1(C-27 P0)→B2(C-25 linkcheck)→B3(C-26 drift-check)→B4(C-30 瘦身+C-29 L1+C-34 断言)→B5(C-31 模板字段)→B6(C-28)，排期与验收见 M2-R2-优化修改方案.md §3 | B0~B3 每批独立 commit+回归用例；tracker 翻 ✅ 附 hash；regression S9 全绿 | ⬜ |
| C-33 | 现行犯：commands/yy-1/2/3/5 四文件 :20 行指针引用损坏（`\t emplates/` 应为 `templates/`，$SKILL_DIR/t 被吞成 tab），agent 照指针执行 Read 失败 → F3 白话化审阅静默缺失；悬空引用正在真实发生且 validate-structure/CI 全绿放行 | P1 | 修复 4 处损坏引用（B0-①）；linkcheck 增补 tab 前缀损坏模式用例（B2） | 全仓 grep `emplates/` 零命中；注入坏引用 linkcheck FAIL 具名；regression 8/8 | ⬜ |
| C-34 | validate-structure 是假闸门：188 行源码通读实测只断言可移植性泄露/vendor frontmatter/commands 含 --prereq-check 字符串三样，四项核心断言全缺——SKILL.md 行数体积（C-30 超标 86% 无人发现）、references 指针存在性（C-33 断链全绿放行）、gate 模板必填字段（C-31 无痕）、引用路径有效性 | P1 | 随 B4 批次落地四断言：SKILL.md ≤60 行、指针表覆盖 6/6、六模板「阶段机验」字段、templates//vendor/ 字面引用 Test-Path 全通过（缺一 FAIL 具名） | 瘦身前旧 validate 全绿（证明假闸门）；落断言后删指针行 FAIL 具名；regression 8/8 | ⬜ |
| C-35 | 验收指标无机验量尺：token-audit.mjs 不存在，M1 批判 C-21（P1）修复同样 0 落地，本轮 token 验收指标（≤1.5k/≤2.5k）只能第三方工具手测；批判产出的「修复动作」系统性 0 落地连量尺都停尸 | P2 | B0-② 落地 scripts/token-audit.mjs（CJK 加权估算+近似口径注明+快照 JSON 落 docs/history+regression 断言不回退） | 脚本输出各文件估算值与快照；删快照 regression FAIL；瘦身后快照对比入报告 | ✅ 2026-09-08 独立验收 PASS（token-audit.mjs CJK 加权量尺落地：默认快照 12 文件落盘 docs/history、--gate 回退≥10% FAIL 实测、regression S10 全绿） |

- [x] 2026-09-08 M2-R2 批判登记 6 条（C-30~C-35，竞品 URL 均当日真实抓取且结论回填，P0×1/P1×4/P2×1，修改方案见 yy/plans/tasks/M2-R2-优化修改方案.md；C-25~C-29 遗留经实测确认 0/5 落地，修复批次 B0~B6 已排期）