# 下一阶段规划：T9 executor 向导 / T10 R5b 核对补缺 / T11 R6 重启 — 2026-09-20

规划人：编排者。事实基础全部实测（标注 实测/推断）。建议顺序 **T9 → T10 → T11**：
T9 加固派单链路（T10/T11 的验收执行都要走它）；T10 解锁 T11；T11 是发布闸门且前置最多。

---

## 关键事实更新（本轮规划实测，修正先前认知）

1. **R5b 在删除前已完整实施**（9-17 20:16-20:30，Owner 授权直执行）。恢复的
   `test-reports/R5b-implementation-20260917/REPORT.md` 载明六项交付物 sha256。
   **实测比对**：4/6 已字节级恢复在手——README `17166fd7` ✓、host-bridge.mjs `b02cfd65` ✓、
   render-core.mjs `93a7652b` ✓、journey.css `4b79c59c` ✓（=报告所列 styles.css，同哈希异名）。
   缺：`webview/journey/index.html`（`3af78072`）+ `fixtures/f-01…f-10` 十件。
2. **OQ-U-17…20 并非未决**：Owner 9-17 已裁决 `owner-oq-rulings.md`（sha `1085de55`，
   "全部按你推荐的来"）。裁决正文未恢复（推断），但效果可从 fixtures 语义反推（实测）：
   U-17=宿主调 CLI+桥接注入（f-01）、U-18=手动刷新+host push（f-09 禁 setInterval）、
   U-19=a 会话切换整页重载（f-10）、U-20=a 降级遮罩（f-02）。
3. **REG-01 已消**：原 R5b 报告登记"脏树 regression 7/5"——我方重建线（提交内核+增量 lib）
   实测 12/12（T7/T8 总门多次复核）。该遗留在我方线不存在。
4. **R6 也已实施过一轮**（9-18）：四个 probe（compat/rollback/e2e/asset-matrix）+ obs-status
   全部恢复在手；当时 e2e **4/6**（activation/receipt 参数契约 INPUT_INVALID/RECEIPT_INVALID，
   诚实记录）；冻结版 C-R6 契约（`a49b769c`）文本缺失，DRAFT 在手；3 项 Owner 追认 + C2
   追认 pending。
5. **R9**：REPORT.md 在手，但 `integration-receipt.json`（`9b339ade`，R6 完成依赖）未恢复。

---

## T9. executor-setup 向导（P2 重设计施工）

**目标**：把"执行 agent 怎么选、怎么配、怎么交接"做成机验向导，替代口头约定。

**设计决定（逐条吸收 T7 前 10 条批判）**：
1. 选项 A 更名「编排者直执行（⚠ 违反 C-01 独立验收纪律，仅限非验收类任务）」，默认高亮
   选项 = B（本机 CLI 子代理）
2. `--non-interactive`：从 flags 或 `<workspace>/.tt-state/executor.json` 读取，缺省交互
3. 探测分两档：`--probe presence`（在 PATH+非交互形态）与 `--probe roundtrip`
   （真实喂"回复 OK"brief，60s 超时，沙箱 cwd）——报告两档分别标注，禁止把存在性说成"可用"
4. 配置方法论 = 生成 `docs/executor-setup/<cli>.md` 指引 + 自检命令清单；**绝不读/写凭据**
   （mimosa 红线）；文档头部带"生成日期 + 针对 CLI 版本"字段（腐烂防护）
5. 配置持久化 = 项目级 `<workspace>/.tt-state/executor.json`（withLock 写），全局不落；
   读取顺序 项目 > 显式 `--executor` > 交互询问
6. 交接模式（原 C）schema 化：brief 落 `artifacts/<planId>/briefs/<taskId>.md`，
   回填报告约定路径 `artifacts/<planId>/reports/<taskId>/REPORT.md`，`summary-read.mjs`
   增加回填校验模式（缺字段=FAIL，不猜）
7. 触发点提前到 `/yy-2` 规划 gate（执行器假设在拆任务时即定型），`/yy-4` 只消费
8. Windows：PATH 探测（where/which），不做 mklink/管理员操作；中文/空格路径进自测
9. 并发：executor.json 写入走 B2 `withLock`；双会话首跑不互踩
10. 隔离钩子预留：`--isolate` 字段落 config（P3 另批施工，本期只留字段+文档）

**交付**：`scripts/executor-setup.mjs` + `docs/executor-setup/*.md`（3 份 CLI 指引）+
`summary-read.mjs` 的校验模式（白名单内改动）+ `test-reports/rebuild-20260920/T9-wizard/`。
**总门**：探针（presence/roundtrip/交互降级/交接 schema/并发锁）全 PASS + regression 12/12
+ validate 0。**STOP**：roundtrip 探测需要写任何宿主配置文件。

**T9 的 10 条遗留**：① roundtrip 探测消耗真实 API 配额；② CLI 升级致指引腐烂（带版本字段缓解，
非根治）；③ workspace 迁移后 executor.json 不随迁；④ 非 TTY 环境交互降级的 UX 未设计；
⑤ 交接模式的报告回填依赖外部平台 agent 自觉，schema 校验只能拒收不能强制；⑥ probe 超时
误杀慢 CLI（60s 值未标定）；⑦ 多 CLI 并存时的优先级策略未定义（首选项失败是否自动 fallback
到次选）；⑧ executor.json 含模型偏好时的敏感度边界未审；⑨ 向导本身无法被独立验收
（它是交互流程）——只能机验非交互面；⑩ 与未来 --isolate 字段的语义衔接未定。

---

## T10. R5b 核对 + 补缺 + 独立验收（2026-09-20 修订：index.html 改 Owner 主导重设计）

**Owner 2026-09-20 决定：index.html 不按原样重建，由 Owner 重规划功能/接口/交互/风格。**
实测依据：render-core.mjs（132 行，字节恢复 93a7652b）是**纯视图模型**——六态
（AUTHORIZED/OBSERVED/INFERRED/STALE/PARTIAL/ERROR）+ 三负态、最坏态卷滚、冲突视图、
nextPrompt 视图的全部语义都在其中并可机验；丢失的 index.html 只是消费
`deriveJourneyView()` 输出的视觉/交互层。host-bridge 面（OQ-U-17=a 注入契约
`window.__YY_JOURNEY__ = {injectedAt, sessionId, read, project}`，buildInjectionPayload /
injectionScriptTag / buildPageHtml / servePage）字节恢复，建议**接口层保持不变**
（改接口=重写 sha 锚定的恢复证据）。journey.css（51 行）可被 Owner 新风格整体取代。

**T10a（Owner 设计裁决）**——裁决菜单（每轴 2-4 选项 + 编排者建议）：
- 轴 1 视图范围：①阶段环+九节点 ②gate 清单卡 ③nextPrompt 卡（含快照引用）④计划/子任务表
  ⑤evidence 链接区 ⑥冲突/降级告警条 —— 全选或子集（建议：①③④⑥ 首版，②⑤ 二期）
- 轴 2 数据接口：保持注入契约不变（建议：保持——render-core/bridge 是恢复证据，
  改接口即作废 93a7652b/b02cfd65 两个 sha 锚）
- 轴 3 交互：刷新（已裁：手动+host push）/ 会话切换（已裁：整页重载）/ 新增写操作按钮？
  （建议：首版纯只读，写操作走 CLI——UI 写操作会触碰 phase 权限面）
- 轴 4 风格：布局（单列仪表盘 / 九节点环图 / 时间线）、明暗主题、密度、设计 token
  （建议：单列仪表盘 + 暗色 + 状态色即语义色）
- 轴 5 CSS：整体取代 journey.css（51 行旧基线作废）还是叠加

**T10b（施工，菜单裁决后派单）**：按裁决实现 index.html + 新 CSS + f-01…f-10 fixtures；
fixture 语义仍锚 REPORT §4 与 render-core 可机验语义。

---

## T10.（原案存档）R5b 核对 + 补缺 + 独立验收

**目标**：把"已恢复 4/6"补成"6/6 + 全 fixture 绿 + 独立验收 ACCEPTED"。

**施工**：
1. 复核四文件 sha256（T10 验收时编排者重算，预期 `17166fd7/b02cfd65/93a7652b/4b79c59c`）
2. `styles.css` 命名对齐：报告口径为 styles.css，现名 journey.css——补一份 `styles.css`
   （同字节）或申报沿用新名（二选一，REPORT 申报）
3. **重建 `webview/journey/index.html`**（规格=render-core.mjs 消费面 + host-bridge 注入面 +
   `prototypes/yy-workflow-panel/coverage-matrix.md` + `docs/preview/journey-control-room-preview-20260917.html`
   布局参照 + f-02 降级遮罩标记）——原版 `3af78072` 不可复原，重建版如实标注
4. **重建 fixtures f-01…f-10**（语义表=REPORT §4，逐条 GWT；全部 exit 0）
5. 外派执行者施工 + 编排者盲测验收（独立性优于原轮"直执行"）
6. journey.read/project 消费对表：fixtures 覆盖的错误码/投影字段与重建 journey.mjs 逐一对表

**总门**：10 fixture 全绿 + 四恢复文件 sha 复验 MATCH + regression 12/12 + validate 0 +
盲测探针（注入面/降级面/七态映射/最坏态/冲突/NotFound/nextPrompt/无轮询/会话隔离）。
**Owner 动作**：无（OQ 已有裁决记录）。

**T10 的 10 条遗留**：① index.html 重建版与原版布局必有偏差（原版不可复原）——PARITY 类
验收只能对照 coverage-matrix 不能对照像素；② owner-oq-rulings 正文缺失，裁决引用只能到
"效果级"不能到"逐字级"；③ webview 真宿主（ZCode/codex Desktop 容器）行为与 fixture 的
模拟注入不等价——真宿主联调不在本批；④ render-core 对 index.html 的 DOM 结构有隐式
契约（getElementById 面），重建需先逆向该契约；⑤ f-09"无 setInterval"是静态扫描断言，
动态轮询注入检测不到；⑥ fixtures 沙箱与真 .tt-state 的隔离边界要复测；⑦ 会话隔离 f-10
依赖重建 journey.mjs 的 session 命名空间（与原 fe9bb851 行为有重建差异）；⑧ host-bridge
调 CLI 的 stdout 解析对中文/长输出未压测；⑨ 原报告 reportSha256 自指值未恢复，验收链
只能锚到各交付物 sha；⑩ styles.css 双名并存期可能有消费方引用旧名（需全仓 grep 确认）。

---

## T11. R6 重启（迁移/回滚/E2E/16 资产矩阵/第三方包/发布判定）

**目标**：完成 R6 = 唯一发布闸门，产出 release 判定。

**前置链（实测现状）**：R5b（T10）→ R9 核查收尾（REPORT 在手，`integration-receipt.json`
`9b339ade` 缺 → 重建或申报缺失+重出证）→ C-R6 DRAFT→FROZEN（Owner 审查冻结）→ R6 四探针
重跑 → 遗留闭环 → 第三方包重跑 → release 判定。

**施工**：
1. **R9 收尾核查**：integration-receipt 重建（消费 R9 REPORT 的交付清单重出证）；R9 的
   3 项 Owner 追认打包（supersededBy 回填 / OQ-R9-6 语义 / CDC NOT_FOUND 白名单）
2. **C-R6 冻结**：DRAFT（在手）→ Owner 场景审查 → 冻结记录 + `contracts/C-R6-migration.md`
   （沿 C-R8/C-R10 迁移纪律：drafts 保 FROZEN-SOURCE）
3. **四探针重跑（对重建后运行时）**：compat-probe / rollback-rehearsal / e2e-bounded /
   asset-matrix——原 2 个 e2e 失败（activation `INPUT_INVALID` / receipt `RECEIPT_INVALID`）
   现在对接的是**重建版** activation/receipt，参数契约可能直接 PASS 或暴露真差异（逐一修参）；
   asset-matrix 16/16 重出
4. **C2 追认包**：C2-republication REPORT（probe `188356a8`、双净快照 exit 0）+ T5/T6 时代
   的第三方 verdicts → Owner 追认 C2 关闭
5. **第三方 packet 重跑**：`test-reports/R6-migration-20260917/third-party-packet/handoff.md`
   （在手）按新运行时重执行 C1-C7，出独立 verdicts
6. **release 判定**：R6 doc 五步走完 → Owner 拍板

**总门**：compat 5/5 + rollback verified + e2e 6/6（原 4/6 的 2 失败闭环）+ asset-matrix
16/16 无聚合替代行 + 第三方 packet 独立复现 + regression 12/12 + S5 检查点全绿。
**Owner 动作包**：C-R6 冻结批准、C2 追认、R9 三项追认、release 判定。

**T11 的 10 条遗留**：① C-R6 冻结版（`a49b769c`）正文缺失——DRAFT→FROZEN 的"最小迁移"
锚点不足，本次冻结实际是"以 DRAFT 为新冻结源"，与 a49b769c 的差异不可考证；② e2e 的
2 个历史失败对接重建版 activation/receipt，可能"参数试对即 PASS"掩盖真语义差异；③ 四个
probe 脚本是原运行时产物，对重建模块的适配性未验证；④ integration-receipt 重建是"重出证"
非"原证"，R6 完成依赖的严格解读下需要 Owner 认可；⑤ 第三方 packet 的六探针含 C5（frozen
anchor 的 ESM 路径陷阱前科）——重跑前需先修锚或申报；⑥ rollback rehearsal 的备份哈希钉
基于旧 runtime 文件集，新增 9 个 lib 文件后备份范围未重定义；⑦ 16-asset matrix 的
activation/receipt 列 diagnostic 依赖重建模块的参数面，列语义需复核；⑧ MW0-MW4 迁移窗口
在 PRD0 终版（`0cc3cae7`，未恢复）中定义——窗口语义只能从 R6 doc 反推；⑨ release 判定
依赖的"全部前置 DONE"中 R5b/R9 是"重建+补收尾"版 DONE，与原实施 DONE 的证据强度不同；
⑩ 第三方执行平台的独立性与本编排链的隔离度未形式化（同机不同会话）。

---

## 排期与依赖图

```
T9 向导(1-2 批) ──┐
                  ├→ T10 R5b(1-2 批) ─→ T11 R6(3-4 批) ─→ release 判定
R9 核查收尾 ──────┘
```

**Owner 决断包汇总**（都不阻塞开工，阻塞对应闸门）：
- T11 前置：C-R6 冻结批准、C2 追认、R9 三项追认、（最终）release 判定
- T9/T10：无 Owner 阻塞项
