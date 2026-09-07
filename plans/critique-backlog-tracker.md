# critique-backlog-tracker（yy 域镜像 · M1 批判段）

> 本文件为 review-gate（ROOT=yy/）读取域；**主 tracker 唯一事实源在仓库根 `plans/critique-backlog-tracker.md`**（C-01 起全量历史）。本镜像只承载 yy 专属批判段，行格式对齐主表 C-xx；两侧以序号同步，禁止在此改历史行。

## M1 journey/commands 技术批判（2026-09-07，YY M1 毒舌批判，详见 yy/plans/tasks/M1-技术批判.md）
| # | 批判（行中源） | 级别 | 修复 | 验收指标 | 状态 |
|---|---|---|---|---|---|
| C-16 | 防跳阶段旁路：唯一机验入口 --prereq-check 仓库 0 处调用，--update 写路径无前置校验直接标 done（E1 实测 exit 0） | P0 | tt-journey --update 内联 prereqCheck（--force 越过留痕）+ orchestrator syncJourney 写前校验 | 未满足前置非法更新 0%；GWT6/7 过；回归 8/8 | ⬜ |
| C-17 | journey.json 并发读-改-写无锁（两个收尾写入点，后写覆盖先写；E4 未复现丢失属时序运气） | P0 | withJourneyLock（O_EXCL + 400ms×5 重试 + 30s stale 自愈），零依赖自研 | 20 轮 2 进程并发 syncJourney plans[] 双条目存活 100% | ⬜ |
| C-18 | Windows GBK（chcp 936）下 ASCII 进度图中文/符号全乱码（E2 实测）——目标用户主场景不可读 | P1 | renderJourney ASCII 降级模式（win32 非 WT_SESSION 自动，--ascii 强制） | chcp 936 输出 GBK 解码乱码字节 0；GWT9 | ⬜ |
| C-19 | 位置判定错乱：回跳节点 2/4/6 pending 时主干 7/8 已 done 仍显示「重执行1（待推进）/下一阶段：无」（E6 实测） | P1 | currentAndNext 只认 FORWARD_LINE，回跳层改附注行 | GWT10：主干全 done 输出「全部主干节点已完成」 | ⬜ |
| C-20 | 推断层静默吞损坏数据源：UTF-8 BOM 的 state-summary 被 JSON.parse 丢弃 → 谎称「无历史可推断」（E3 实测，Windows PS5.1 Set-Content 必产 BOM） | P1 | readJsonLoose 剥 BOM + parse 失败 stderr WARN 不静默 | 带 BOM summary 推断成功率 100%；GWT11/12 | ⬜ |
| C-21 | token 宣称不诚实：dev-plan 写「各 344-449 token」实测 o200k_base 378-479（下界虚报 34）；「显著降低」未计 journey 渲染叠加（真实 ~600-800 tok/注入） | P1 | scripts/token-audit.mjs 机验宣称 vs 实测（偏差>10% FAIL）+ dev-plan/PRD 口径改注编码器与叠加成本 | 宣称实测偏差 ≤10%；快照入 docs/history | ⬜ |
| C-22 | 「渐进披露」名不副实：6 命令文件为死文本，无 agentskills L1 元数据自动触发层（规范原文 ~100 tok 启动加载），SuperClaude 30 命令走原生装载 | P2 | SKILL.md 顶部加 ≤120 tok 阶段命令索引（L1 层）+ description 触发词统一 | L1 段 ≤120 tok 实测；validate 断言 | ⬜ |
| C-23 | 双事实源无交叉核对：PRD 承诺「两口径可交叉核对」，仓库无任何对照逻辑（state failed vs journey step7 done 矛盾无人发现） | P2 | tt-journey --consistency-check [--strict]（MISMATCH/WARN 三态） | GWT13 三态用例全过 | ⬜ |
| C-24 | 生态位差距未承认：SuperClaude pm agent 常驻自动恢复上下文（v4.3.0，23,871★，2026-09-07 API 实测）vs YY 被动文件；anthropics/skills 174,939★ | P2 | COMPETITORS.md 增「F1/F2 vs SuperClaude pm agent」节（3 带日期 URL），不承诺 stars 追平 | 文档 1 节 ≤40 行；URL 过 review-gate --verify-urls | ⬜ |

- [x] 2026-09-07 M1 批判登记 9 条（C-16~C-24，竞品 URL 均当日真实访问，P0×2/P1×4/P2×3，修改方案见 yy/plans/tasks/M1-优化修改方案.md；主 tracker 同步于仓库根 plans/critique-backlog-tracker.md）