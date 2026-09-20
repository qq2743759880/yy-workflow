# C-R2-catalog — Owner 场景审查清单（DRAFT）

> 文档状态：`DRAFT / OWNER-SCENARIO-REVIEW-REQUIRED / NOT-FROZEN`
>
> 配套契约草案：`contracts/drafts/C-R2-catalog.draft.md`。Owner 逐行走查；「期望」列只在 R1 baseline 已测定处预填（标注 `[R1实测]`），其余留空待 Owner 场景审查决断（对应草案 OQ 编号）。快照：`240f3fbdb4ee757dffc4d5ab80407d1b2c84863c`。
>
> 判定规则：**contract defect** = 冻结后的实现行为与本表「期望」列（Owner 确认后的版本）不符，或出现本表禁止的行为（静默首胜、无诊断丢弃、block-scalar 标记入库等）。判定前本清单本身不是验收标准。

## A. 路由场景

| # | scenario | exact input | expected route decision state | expected error code | defect if | Owner 确认 |
|---|---|---|---|---|---|---|
| A1 | plain positive，单簇明确胜出（多证据） | `build backend login API` | `MATCHED` `T2_BACKEND`，margin 3/1（R1 实测 P2） `[R1实测]` | 无 | 状态/簇/margin 与实测不符；或 `data` 类子串使分数偏离 3/1 | ✅ 确认（margin 3:1 健康区分度，T2 正确归口） |
| A2 | plain positive，单证据胜出 | `design responsive page` | `MATCHED` `T4_FRONTEND`，margin 2/0（R1 实测 P2） `[R1实测]` | 无 | 同上 | ✅ 确认（前端设计意图明确，T4 唯一命中） |
| A3 | two-cluster legitimate tie —— 必须 `AMBIGUOUS`，不得静默首胜 | `database frontend` | `AMBIGUOUS`（词边界计分下 T1/T4 各 1 分平局）；并列簇清单返回 `[草案， 依赖 OQ-2/OQ-3]` | `ROUTE_AMBIGUOUS`（shell 失败语义，OQ-7/OQ-9 定 ok/code 取值） | 返回任一首胜（现状实测：`MATCHED T1_DATABASE` margin 2/1，子串膨胀 —— 该现状行为在 bounded 模式下即 defect）；或平局却不返回并列信息 | ✅ 确认 AMBIGUOUS（真实任务中数据库+前端可能同时需要两个域，停下来问比走错方向再回滚便宜；R2 上线后如 AMBIGUOUS 过于频繁可在 R3 调 margin 阈值，但状态必须存在） |
| A4 | near-miss / typo 不得命中 | `quantum crochet patterns` | `NO_MATCH` `[R1实测]`（P5） | `ROUTE_NO_MATCH`（legacy 模式保留抛 `NoMatchError`，OQ-9） | 抛出以外的任何选择；或 shell 模式下 `ok:true` 且 state≠`NO_MATCH` | ✅ 确认（完全无关输入弃权是正确行为） |
| A5 | typo 仍是实词残骸，且被现有关键词子串误吞 —— 必须弃权 | `databse` | `NO_MATCH` `[草案， 待 Owner 确认：现状实测 MATCHED T1_DATABASE 1/0，因 `data` ⊂ `databse`（`planner.mjs:25` 子串计分）；本轮独立探针复测一致]` | `ROUTE_NO_MATCH` | 任何 MATCHED；AMBIGUOUS 也不成立（另一簇 0 分，非平局） | ✅ 确认 NO_MATCH，补充：NO_MATCH 输出应附带 suggestion 提示（如 "database"），不自动路由只提示——静默纠正拼写是危险的，但弃权输出应让 Owner 看到可能想打的是什么 |
| A6 | 关键词作为更长无关 token 的子串 —— 禁止 false positive | 输入含 `database`（不应为 `data` 加分）；对照输入 `special pricing page`（现状实测 `ci` ⊂ `special` 使 T5_OPS 捡 1 分、与 T4 1/1 后插入序首胜 T4） | 词边界语义下：`database` 只给 T1 计 1（`data` 不计）；`special pricing page` → `MATCHED` `T4_FRONTEND` 1/0（T5 不得得分）或按 OQ-3 决断 | —（A6a 正常 MATCHED；A6b 若 Owner 判定单分 1/0 平局也应 AMBIGUOUS，则与 OQ-2 τ 联动） | `data` 在 `database` 内得分；`ci` 在 `special` 内得分；分数与 OQ-3 决断后的语义不符 | ✅ 确认（子串误命中是当前代码的真实 bug，词边界必须引入，无歧义） |
| A7 | C3 误路由三例（回归红线） | `campaign` / `email` / `painting` | R2 修复后不得路由 `T3_AI_RAG_MCP` `[R1实测 现状=全部误路由 T3 1/0；机制推演：三者均含 T3 关键词 `ai`（`matrix.mjs:4`），子串计分下命中，GWT-R2-L2 以 baseline 对比验收]` | —（期望修复后的具体状态由 Owner 定：NO_MATCH / AMBIGUOUS / 其他） | 修复后仍 MATCHED `T3_AI_RAG_MCP`；或验收时未与 R1 baseline 对比而编造新数值 | ✅ 确认 → NO_MATCH（三词与 T3 无实质关联，修触发词不如修词边界；如要处理 "AI 绘画"/"AI 营销" 应用更明确关键词如 "AI image generation"，宁缺毋滥） |
| A8 | eligible positive（phase 维度） | `review security findings` + phase=review 阶段 | 现状 R1 实测 `NO_MATCH`（0/0）。Owner 需决断：是否引入 `review`/`security`/`findings` 触发词使其 MATCHED `T2_BACKEND`/`T5_OPS`，还是保持弃权 `[OQ-3/OQ-4 + 场景决断]` | 由 Owner 决断 | 触发词改动未先经本清单确认即改变行为 | ✅ 引入触发词 → MATCHED T5_OPS（security 资产）；约束：只在 review/verification 阶段触发，不在 requirements/planning 阶段触发（防早期误命中）；词边界必须命中 |
| A9 | explicit assets 直通 | `explicitAssets=['planning']`，task 文本任意 | `MATCHED`（显式 > 簇路由，dev-plan 选型表）；跳过关键词计分 | — | 显式指定仍被关键词推翻；或显式未知 id 未返回 `ASSET_NOT_FOUND` | ✅ 确认（显式选择优先级最高，关键词不得推翻） |

## B. eligibility / 资产状态场景

| # | scenario | exact input | expected | expected error code | defect if | Owner 确认 |
|---|---|---|---|---|---|---|
| B1 | present but ineligible（FR-3 缺冻结契约） | cluster `T4_FRONTEND` 命中后请求 `implementation`（`FRONTEND_IMPL_ASSETS`，`planner.mjs:4`），无冻结契约 | `INELIGIBLE`（不派单），诊断指名资产与缺失前置 `[草案， OQ-6 定 INELIGIBLE 语义]` | `ASSET_NOT_ELIGIBLE`（dev-plan `:301` 原码） | 静默派单；或返回 `NO_MATCH`/`ROUTE_AMBIGUOUS`（语义错位）；或现状 `CONTRACT_NOT_FROZEN skip`（`matrix.mjs:5`）在 bounded 模式下无 INELIGIBLE 表达 | ✅ 确认（契约未冻结不能派单，核心纪律） |
| B2 | malformed description 资产被选中时的诊断 | 选中/读取 `agent-research`（description=`\|`）或 `agent-vision-toolkit`（description=`>-`） | entry 可读但 `description=null` + `META_DESCRIPTION_BLOCK_SCALAR` warning；标记字面量不得作为 description 出现在任何输出字段 `[草案 §9.3，输出不变量不被 C2 阻塞]` | 无失败码（诊断走 warnings） | `"\|"` 或 `">-"` 出现为 description；或无诊断的静默原样透传；或以此为据宣称 parser 语义验收完成（C2 UNRESOLVED 期间禁止，GWT-R2-L3） | ✅ 确认 null + warning，补充：description=null 的资产可以显式选中但自动路由对它禁用——description 是路由输入，没有 description 则 keywords 退化、自动路由不可靠，但 Owner 手动选是合理的 |
| B3 | missing version 资产的诊断 | `catalog.read` 全量（含 6 个 agent 型缺 version 资产） | 每资产 1 条 `META_VERSION_MISSING` warning（数量=6，可机验） `[R1实测 缺失集合]`；severity 归类见 OQ-8 | 无失败码 | 缺 version 被静默；或 warning 数≠实测缺失数 | ✅ 确认（每条缺 version 独立诊断，不汇总去重） |
| B4 | 未知资产 id | `assetScope=['no-such-asset']` 或 `explicitAssets=['no-such-asset']` | `ASSET_SCOPE_INVALID`（scope 通道，dev-plan `:300`）或 `ASSET_NOT_FOUND`（explicit 通道，§6.2 草案码 —— 两通道映射由 Owner 确认） | 对应码 | 未知 id 被静默忽略并入正常响应 | ✅ 确认分开（scope 语义 = 限定的范围内有问题，explicit 语义 = 指定的东西不存在，修复动作不同，不该合并） |
| B5 | body 文件缺失（现状：整 entry 丢弃 + 1 条 warning） | 拷贝 `vendor/colorize` 去掉 `SKILL.md` 后 `catalog.read`（探针内，不动真库） | 现状 `[R1实测 P5]`：warnings 含 unrecognized 文案、entry 消失、exit 0；契约要求拆分为 `ASSET_BODY_MISSING` blocking 诊断且 blocking 级不得进入 selected（OQ-8 定级） | blocking 走 warnings 数组或失败码 —— 由 Owner 定（shell 同构性 OQ-7） | 拷贝路径下 entry 静默消失且诊断不能区分 B5/B6；或 blocking 诊断资产仍被 selected | ✅ 确认拆开（body missing = 资产存在但内容缺失/配置 bug；unrecognized = 资产不被识别/分类问题，修复动作不同，诊断码必须不同） |
| B6 | 目录两者皆无（unrecognized） | 同 B5 探针，但目录为空 | `ASSET_UNRECOGNIZED` blocking 诊断（与 B5 区分 —— 现状两者共用一条文案 `manifest.mjs:44-45`） | 同 B5 | 与 B5 不可区分 | ✅ 确认拆开（同 B5） |
| B7 | 重复 id（防回归探针，现状 0 例） | 构造两个同名 id 的 fixture 目录 | `META_DUPLICATE_ID` blocking；P6 fail rule 触发 | 无失败码（诊断） | 重复 id 静默合并/覆盖 | ✅ 确认（重复 id 静默覆盖是数据损坏级别的隐患） |
| B8 | 伪 frontmatter 键（现状实测存在） | `catalog.read` 含 `agent-vision-toolkit`（伪键 `Local vision CLIs`）、`colorize`（伪键 `user-invokable`/`args`/`- name`/`required`） | `META_FRONTMATTER_UNPARSED` info 诊断，`unparsedFrontmatterKeys` 列出键名；description 字段语义不受伪键污染 `[R1实测描述完整性 + 本轮 survey]` | 无失败码 | 伪键静默吞并相邻行（现状机制 `manifest.mjs:7-9` 的必然行为）且无诊断 | ✅ 确认 诊断 + 不改 vendor；补充：R2 范围内不修 vendor frontmatter（扩大范围到资产维护），但必须在 R2 completion report 里登记为"独立后续 task" |

## C. legacy / migration 场景

| # | scenario | exact input | expected | expected error code | defect if | Owner 确认 |
|---|---|---|---|---|---|---|
| C1 | legacy-mode read of a pre-contract manifest | `YY_CATALOG_MODE=legacy`（或 `mode=legacy`）读取现状 16 manifest + 现状 `.tt-state/manifest.json` 缓存 | 行为与冻结快照逐字一致：现有字段形状、`NoMatchError` 抛出、CLI exit code；无任何新字段被要求 `[草案 §8， OQ-9]` | `ROUTE_NO_MATCH` 场景仍以抛 `NoMatchError` 表达（legacy 语义） | legacy 模式出现新必填字段、行为漂移、或 CLI 依赖的抛出语义消失 | ✅ 确认（legacy 就是照旧跑，不引入新依赖、不引入新必填字段） |
| C2r | dual-mode 并行输出 | 同上，`mode=dual` | bounded shell + legacy 形状并存于 evidence；两路结果均可对账 `[草案 §8.1]` | — | dual 模式只出一路却宣称 dual；或两路互相污染 | ✅ 确认，补充：dual 模式的两路结果必须落一份可机读的对账文件（如 artifacts/<planId>/dual-catalog-report.json），供 CI 或 Owner 检查漂移；否则 dual 只是打两份日志，无法对账 |
| C3r | mode 非法值 | `mode=strict`（不在 legacy\|bounded\|dual） | `CATALOG_MODE_UNSUPPORTED` | `CATALOG_MODE_UNSUPPORTED` | 静默回落 legacy（禁止 silent fallback，dev-plan R6 GWT 2 同源原则） | ✅ 确认（打错了就报错，不静默回落） |
| C4 | 缓存失效（changed-content） | 修改任一 manifest 字节后 `catalog.read`（refresh=false） | sourceHash 变 → cacheIdentity 变 → 重建（cold 读次数语义：每 entry 1 文件，`manifest.mjs:36`） `[草案 §7.2 + R1 STRUCTURAL]` | — | 内容已变但仍返回旧缓存且无诊断（现状 `loadManifest` 无失效校验，`manifest.mjs:56-61`） | ✅ 确认自动重建；优化：冷启动全量 hash，热启动先 stat 比较（mtime+size），stat 变化再 hash——只依赖 refresh=true 会导致"缓存无签名"问题，Owner 忘了加 flag 就用旧缓存 |
| C5r | warm 读不触碰 vendor | 预写缓存后 `catalog.read`（refresh=false） | 总计 1 个缓存文件读取（`manifest.mjs:60`，R1 STRUCTURAL）；不产生 `vendor/**` 任何写入 | — | warm 路径逐文件重读；或缓存写入越界到 `vendor/` | ✅ 确认（缓存生效时不要再去读源文件，这是缓存的意义） |
| C6r | token/latency 断言纪律 | 任何验收陈述 | 只允许引用 R1 实测值（cold 10.195 ms / warm 0.927 ms / 字节代理）；无实测处必须 `[待补充]` | — | 出现任何编造 token 数、转化率或新延迟值 | ✅ 确认（不准编数，C-21 教训） |
<!-- 2026-09-12 rework: warm latency corrected from 0.662 (R1 REPORT.md:102 misattribution to run1; actual source = CRLF-contaminated worktree) to 0.927 (normalized-baseline.json run1.probes.cost.warmCatalogLatencyMs.median). -->

## 使用说明

1. A1/A2/A4/A7 的现状值与 B3/B5 的现状行为是 R1 baseline 实测（`test-reports/R1-baseline-20260911/`），Owner 审查的是「冻结后的期望」而非现状描述本身。
2. A3/A5/A6/A8/B1 的期望列含 `[草案]` 内容，必须由 Owner 在场景审查时填写最终期望后，本清单才可作为冻结输入。
3. 每个 Owner 确认框落笔（含改写期望）即构成对草案对应 OQ 的决断记录；全部落笔后由 Owner 显式宣布 freeze，草案才升级为 frozen（新 hash）。
4. 本清单与草案均为 DRAFT：`contracts/drafts/` 不解锁 R2（G2.2 图 §8）。