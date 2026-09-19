
# C-R5-ui 契约修订 v2 执行报告（C-R7 change record `cr-20260917T035212Z-c2026fdf`）

日期：2026-09-17（Asia/Shanghai）。执行者：C-R5-ui revision agent（dispatch v2 — host plugin page form）。模式：DRAFT 修订，**不冻结、不解锁、不验收**。

```yaml
changeRecordId: cr-20260917T035212Z-c2026fdf   # impactClass=CONTRACT, status=active
snapshot/HEAD: 240f3fbdb4ee757dffc4d5ab80407d1b2c84863c   # git HEAD（工作树 pre-existing dirty，未触碰）
ownerRulingsAbsorbed: 2     # ① 形态=宿主插件页而非独立静态页 ② host=YY 宿主适配 webview
route41Rerun:
  required: false           # 零路由改动（未触碰 scripts/ 路由/匹配/矩阵/编排）
acceptancePerformedByExecutor: false   # 本修订不做验收，执行器不自验
newOperations: 0            # 仍只消费 journey.read / journey.project
newErrorCodes: 0            # 仍只消费既有五码
tableCheck: "draft tables=15 mismatched_rows=0; checklist tables=9 mismatched_rows=0; exit 0"
reportSha256: 303a929df27521bba142783b8d214212ce16771364118b165682c15aaad33a20
```

> reportSha256 自指惯例（本次采用，显式声明）：`reportSha256 := 将本文件中 reportSha256 字段值归一化为 64 个 0 后的全文 sha256`。验证方式：把字段值替换回 64 个 0 再哈希比对。（不沿用 v1 报告"写前预算值 + corrigendum"惯例；本惯例可确定性复验。）

## 1. 冻结输入哈希表（修订前 → 修订后，全部未变）

| file | before (2026-09-17 12:10 重算) | after | 状态 |
|---|---|---|---|
| contracts/C-R5-ui.md (FROZEN, superseded-pending-revision) | 421ecfc4bfc2861d4187be76ecd67ec184f55d9aa1d239cdb04acb8e82dafa1a | 同左 | OK 未变 |
| contracts/C-R5-ui-review-checklist.md (FROZEN) | 5ddc4cde5a26483100b3e223e86378e1720d58585ac3d580394b58d78821d831 | 同左 | OK 未变 |
| contracts/C-R5-journey.md (FROZEN) | 48b7c37982f71aea8e372e216a309798af724aa8cb08e2d26402ad76430d769a | 同左 | OK 未变 |
| contracts/C-R4-control.md (FROZEN) | 19055ff7a5c881ef4daab4d323e8710467ae5f0ffd2a4db2d1ba21c34cb1a666 | 同左 | OK 未变 |
| contracts/C-R7-change-loop.md (FROZEN) | ea84b4e5358a2458fec0b95b43517c949a070e726be0f81a86d4eaa32c0752cf | 同左 | OK 未变 |
| plans/tasks/G2.2-task-graph-20260911.md | 50687f20d780bd1787e870b2089175901f375b3ef62dc8cb438029e4877a6d88 | 同左 | OK 未变 |
| plans/tasks/PRD0-contract-revision-v3.md | bb81b4e2990390cefada2c8ae603c98eddbc63b09be0f8e6f4600cf95892d4ab | 同左 | OK 未变 |
| prototypes/yy-workflow-panel/design-spec.md | 2d1285666470074d5e8c8928b41106e27530d1a49c54ba13469b7fefd74bc3b4 | 同左 | OK 未变 |
| prototypes/yy-workflow-panel/index.html | d09fe6ffc5b2cb0818ead37dc0d90d6f22d779cb5742dc5eff928661f3219ee1 | 同左 | OK 未变 |
| prototypes/yy-workflow-panel/coverage-matrix.md | 23cafcb3e818b65164b9f0dcd8c758c31045cad979b50ae2b9a89a7bad23a1d7 | 同左 | OK 未变 |
| scripts/tt-journey.mjs（只读锚点） | 0d5a42c61940a362f36b970ecd76bc621921e39511ec7466e311c4dc41291ded | 同左 | OK 未变 |
| scripts/lib/journey.mjs（只读锚点） | fe9bb851f8a363593a9a0fa882b98db398a4bfa203574cc7d873dd4d8c801076 | 同左 | OK 未变 |
| test-reports/change-record-r5ui-host-plugin-20260917/owner-instruction.md | b70bcd4c1cce3b15abfbf8d95db75fd2757cd87613fded9004801584b8569610 | 同左 | OK 未变 |
| contracts/discrepancies/cr-20260917T035212Z-c2026fdf.json | 9fecdfcf7dc84ef91b527134ef247c59493c0c7af9fc78f6b1a70639a3968bba（实测，见 D-14） | 同左 | OK 未变（引用值有笔误，非文件变动） |

补充只读锚点（草案 §0 引用，未变）：docs/yy-dev-plan-skill-loading-v3.md=d2e8e5b4…、docs/tasks/yy-skill-loading-v3/R5-journey-control-room.md=cfae5c96…、reference/frontend-gate.md=89e05e72…（全值见草案 §0 表，本次逐一重算匹配）。

## 2. 交付物 sha256（写后重算）

| file | sha256 | 说明 |
|---|---|---|
| contracts/drafts/C-R5-ui.draft.md | 5520768ffff58281a55e970f443034e7dd385d599a505acd7dd2e227d7371ae3 | v1.1（38fcbfa8900f04ef2cde7fe379bb21e9dfadccbae4c6cc9ee82127a2ba61c182）→ v2，就地修订 |
| contracts/drafts/C-R5-ui-review-checklist.md | ebc286fe6e199afb9f2c99d2a578c77986c1d29473c4d9136d99812e73ecc7bc | v1（6c3af54410937772a813d9795693a565cda5aea5aa50e14b664779fceab62d54）→ v2，就地修订 |
| test-reports/C-R5-ui-revision2-20260917/apply-revision2.mjs | （修订脚本，file-based，无 node -e） | 锚点断言式编辑，每处替换唯一性校验 |
| test-reports/C-R5-ui-revision2-20260917/frag/*.md | （18 个片段文件） | 修订内容片段，脚本读入拼接 |

## 3. 修订清单（按 section 锚点）

契约草案 `contracts/drafts/C-R5-ui.draft.md`：

| # | 锚点 | 修订内容 |
|---|---|---|
| R-01 | 头部 L3/L5 | 文档状态行追加 v2 标记；新增 v2 修订块：引用 `cr-20260917T035212Z-c2026fdf`，声明 re-freeze 后取代冻结件 `421ecfc4…`（superseded-pending-revision），保留"drafts 不解锁任务" |
| R-02 | §0 L19-20 | G2.2 / PRD0 哈希更新为 status-only 注册后现值（50687f20…/ bb81b4e2…），重算确认 |
| R-03 | §0 L38-39 | 补充锚点表新增两行：变更记录 JSON（实测哈希，见 D-14）与 owner-instruction.md |
| R-04 | §0.1 item 3（L47） | "无外部运行时依赖"v2 收窄：允许最小 YY 宿主 webview 桥接（数据注入 + 生命周期）；React/通用新 Bridge 仍禁 pre-gate `[Owner 决断 2026-09-17: host=YY webview]` |
| R-05 | §0.1 item 6（L50，新增） | 交付形态 = YY 宿主适配 webview 插件页；预览/打开模型 = 宿主内嵌 webview 加载并注入数据 `[Owner 决断 2026-09-17: 形态=宿主插件页而非独立静态页]` |
| R-06 | §1.1（L59，新增 bullet） | 页面容器与交付形态：宿主插件页，非独立静态页 |
| R-07 | §3.2（L118-157，整节重写） | U-A 重裁：正式通道 = YY 宿主调用既有 CLI（`tt-journey.mjs --read`/`--project`，stdout 统一壳 JSON）并桥接注入 webview；CLI stdout 保留为开发期 fallback；v1.1 U-A=b 产物文件通道作废（§3.2.4 留痕）；硬约束逐字保持（不新增后端操作/错误码；前端不调 phase.transition、不写 receipt/state、不触发落盘）；webview 数据桥接 ≠ 顶栏 Bridge 执行通道的概念区分 |
| R-08 | §5.1（L264） | **携带修复**：组件表 `` `card.accent\|warn\|danger` `` 未转义竖线已转义（C-R5-ui L264 登记 change-order 项；修复前 draft 同位置 mismatched_rows=1，修复后=0） |
| R-09 | §5.2 item 3（L282） | "无框架"v2 收窄：最小 webview 桥接例外；规范对齐需求登记 D-11/D-12/D-13 |
| R-10 | §7（L328，新增 bullet） | 变更记录吸收声明；re-freeze 取代冻结件；invalidatedNodes R5b/R6/R9 不解锁 |
| R-11 | §8.3 OQ-U-12（L363） | 状态改为 v2 重裁（留痕，不静默改写历史） |
| R-12 | §8.4（L369-377，新增）+ 合计注（L379） | 新增 OQ-U-17…U-20；合计 16→20 项 |
| R-13 | 页脚（L382） | v2 标记 + supersession；保留 route41Rerun.required=false / acceptancePerformedByExecutor=false / drafts 不解锁 |

审查清单 `contracts/drafts/C-R5-ui-review-checklist.md`：

| # | 锚点 | 修订内容 |
|---|---|---|
| C-01 | 头部 L5 | v2 块：变更记录引用、受影响行声明、Owner 确认列留空 |
| C-02 | R5B-18（L49） | GWT-R5B-03 原文保留；追加 v2 注：Gate A 评审对象仍为静态原型，"React/Bridge 任务"按变更记录收窄（最小 webview 桥接例外） |
| C-03 | R5B-21（L52） | 无框架行 v2 收窄 + defect if 追加桥接层越界情形 |
| C-04 | R5B-40（L91） | 追加 v2 supersession 声明 |
| C-05 | §I（L94-102，新增） | R5B-42（webview 插件页形态）/ R5B-43（宿主调用 CLI + 桥接取数通道）/ R5B-44（桥接缺席降级）；可 grounding 的列已填 exact input/expected/defect，不可 grounding 处标 `[待补充]` + OQ 编号；Owner 确认列留空 |
| C-06 | 使用说明 3/5（L106/L108） | OQ 计数 16→20；文档日期 v2 标记 |

## 4. 新增 OQ（沿草案序号延续）

| 编号 | 落点 | 待决内容 | 状态 |
|---|---|---|---|
| OQ-U-17 | §3.2.1 | 桥接注入机制（host-injected global / postMessage / file-watch refresh 等）——现有代码无可 grounding 取值，不发明 | `[待补充]` |
| OQ-U-18 | §3.2.1/§3.2.3 | 刷新/轮询策略与缓存语义 | `[待补充]` |
| OQ-U-19 | §0.1-6/§1.1 | webview 容器生命周期（创建/销毁/session 切换/多实例） | `[待补充]` |
| OQ-U-20 | §3.2.1/§6 | 宿主桥接缺席时的降级形态与文案 | `[待补充]` |

既有裁决全部保留：U-B=a（16 资产目录缺口，OQ-U-06/07）、U-C=a（step 级 blocker，OQ-U-11 挂起）、D-01/D-03/D-04/D-06/D-07 修复均未被新形态否定，原样保留。

## 5. Discrepancy 登记（D 项，沿 v1 修订报告 D-01…D-10 续号）

| 编号 | 性质 | file:line 锚点 | 内容 |
|---|---|---|---|
| D-11 | 规范对齐需求（不改文件） | plans/tasks/G2.2-task-graph-20260911.md:158 | R5b 节点 non-goals "Non-goals: React/Bridge, second page, …" 为 pre-gate 冻结措辞；与 v2「最小 YY 宿主 webview 桥接 + 宿主插件页形态」需对齐。G2.2 为计划件，本任务无权修改，走 C-R7 后续流程 |
| D-12 | 规范对齐需求（不改文件） | docs/yy-dev-plan-skill-loading-v3.md:23、:194 | dev-plan:23 "不进入 React/新 Bridge"、:194 "不写 React/新 Bridge" 同上需收窄为「React/通用新 Bridge；最小 webview 桥接例外」 |
| D-13 | 规范对齐需求（不改文件） | docs/tasks/yy-skill-loading-v3/R5-journey-control-room.md:9（及 :57 GWT-R5B-03 措辞） | R5 doc:9 "Non-goals: React/Bridge implementation, a second page, …"；清单 R5B-18 保留 GWT 原文并加 v2 收窄注，未改原文 |
| D-14 | 引用值笔误（非文件变动） | dispatch §1 及 test-reports/change-record-r5ui-host-plugin-20260917/REPORT.md §3 | 变更记录 JSON 的 sha256 被引为 `9fcedfcf…`；实测（Get-FileHash 与 certutil 双工具一致）= `9fecdfcf7dc84ef91b527134ef247c59493c0c7af9fc78f6b1a70639a3968bba`（第 3-4 字符 "fc/ec" 转置）。文件本体未变：CreationTime=LastWriteTime=2026-09-17 11:52:12 CST = recordedAt 03:52:12Z。草案 §0 钉实测值 |

## 6. 验证结果

- **table-check 自跑**：`table-check.py` 两交付物 → draft tables=15 mismatched_rows=0；checklist tables=9 mismatched_rows=0；exit 0（携带修复 R-08 生效）。
- **冻结输入**：§1 表全部 before==after（Get-FileHash SHA256 逐一重算）。
- **编辑器断言**：apply-revision2.mjs 全部锚点唯一性断言通过（23 处操作日志，0 失败）。
- **禁令自查**：无 commit；未改 contracts/ 冻结件、plans/、scripts/、vendor/、prototypes/、docs/；无新操作名/错误码；无臆造阈值（不可 grounding 一律 `[待补充]`）；无 route41 相关改动；无 emoji；表格竖线已转义；契约文档仅仓库相对路径。

## 7. 限制与剩余风险

- OQ-U-17…U-20 阻塞 webview 桥接落地实现；Owner 裁决前 R5b 不可 READY（本就如此，drafts 不解锁）。
- D-11/D-12/D-13 的规范对齐需后续 C-R7 流程修订 G2.2/dev-plan/R5 doc，否则冻结时存在措辞冲突。
- D-14 引用笔误建议编排者 corrigendum 订正（本 agent 无权改 test-reports/change-record-…/REPORT.md）。

> 本报告 = `test-reports/C-R5-ui-revision2-20260917/REPORT.md`。交付物 = `contracts/drafts/C-R5-ui.draft.md` + `contracts/drafts/C-R5-ui-review-checklist.md`（均为 DRAFT v2，2026-09-17）。快照 `240f3fbdb4ee757dffc4d5ab80407d1b2c84863c`。`route41Rerun.required=false`；`acceptancePerformedByExecutor=false`；冻结由独立 agent 在 Owner 批准后执行。
