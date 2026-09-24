# AS-2-first 派单 — be-validator→Spectral 迁移范例实现（批 1 第二波 Step 2-5，批 1 最重单）

你是 autopilot 管线 L1 独立执行 agent（全新上下文）。工作区：`D:\.ai-hub\skills\yy`。先读 `plans/execution-plan-v3-20260923.md` §二/v3.3-v3.6、`handoffs/v3/write-faces-batch1.md`、`contracts/asset-migration.md`（六态状态机+五元组+三硬门的权威定义）。完成后交付证据，不自称 DONE。

## 防超时纪律
本单按 v3.5 七步切 8 个小步，每步 ≤10 分钟必须落盘；migration-record.json 边跑边写（它就是交付物之一）。

## 背景：你是 Migration Reference Implementation
首个 replace 的价值不是替换本身，而是**生成可复制的迁移范例**。be-validator→Spectral 被选中因为：输入输出稳定（OpenAPI 文档→violations）、夹具可确定性构造、Spectral 已在本机实测安装成功（Apache-2.0，AS-0 确认）。

## 执行步骤（严格串行）

### Step 2a：迁移夹具
`test-reports/autopilot-work/AS-2-first/fixtures/` 下：
- `bad-openapi.yaml`：构造含确定性违规的 OpenAPI 文档（如缺 summary/components 无 schema/response 无 4xx 等——用 Spectral 默认规则集 oas 一定能抓的）；
- `expected-findings.json`：旧引擎（portman 路径的 be-validator 现行为）对该 fixture 的输出记录 + **accepted_difference 规则**（允许：rule_name_changed/severity_mapping_changed/message_changed）+ **forbidden_difference 规则**（禁止：missing_detection/crash/invalid_exit_code——第七轮审计裁定：这些无论新旧引擎一律判失败）；
- accepted/forbidden 差异表在影子跑**前**定稿并在 RESULTS.md 里说明依据。

### Step 2b：新引擎准备
- `npm install --no-save @stoplight/spectral-cli`（本机仓库根，node_modules 不入库；AS-0 已实测 6.16.3 可用）；
- ruleset 落 `test-reports/autopilot-work/AS-2-first/rulesets/`（临时影子跑用；正式 ruleset 在晋升后随 adapter 固化）；
- npm semgrep 假包教训引以为戒：装完必跑 `spectral --version` 核实真实能力。

### Step 2c：Shadow Run（状态机 ACTIVE→SHADOW）
同一 fixture 分别喂旧路径（现 portman adapter）与新路径（spectral 直调），输出对照记录（finding 数/severity 分布/exit code/逐条差异分类：accepted|forbidden|新增|消失）。

### Step 2d：Rollback Drill（Failure Injection，v3.6 三场景）
1. **正常路径**：spectral 对 fixture 报出 expected-findings 内的问题；
2. **binary missing**：临时改 PATH/env 令 spectral 不可达 → runtime/adapter 检测 → **回滚到旧 portman 路径可用** → receipt 留痕；
3. **输出格式异常**：喂损坏输入令 spectral 输出非法 → adapter 诚实报错（receipt failure 路径），不静默吞；
4. `migration-record.json` 显式含 `rollback_adapter:"be-validator(portman)"`，回滚路径在影子跑前验证存在。

### Step 2e：Promotion（SHADOW→MIGRATING→PRIMARY）
影子跑+回滚演练双 PASS 且零 forbidden_difference → 改造 `scripts/lib/adapters/portman.mjs` 为 spectral 驱动（保留契约冻结外壳；≤150 行胶水纪律；旧 portman 逻辑保留在 `--compat` 显式旗标后=EXPLICIT_COMPAT_MODE，禁静默并存）→ 正式 ruleset 固化 `vendor/be-validator/rulesets/` → 更新 `contracts/manifest-sources/be-validator.yaml` 的 verification 字段（`spectral lint` + expected exit_code——provider identity verification 三件套）→ 重跑 manifest-build（新 hash 记录）→ runtime binding 验证：`node scripts/eligible.mjs --asset be-validator` 仍 eligible 且 dispatch 日志 manifest_sha256 为新 hash。

### Step 2f：五元组落账
migration-record.json 收口：`{old_asset:"be-validator(portman)", new_asset:"be-validator(spectral)", shadow_result:"pass", promotion_receipt:"<change.record 单号>", runtime_binding:"<hash+探针引用>"}`——缺任一 = 不得进入复制阶段。

## 白名单
scripts/lib/adapters/portman.mjs、test-reports/autopilot-work/AS-2-first/（fixtures/rulesets/migration-record.json/RESULTS.md 全在此）、vendor/be-validator/rulesets/（新建）、contracts/manifest-sources/be-validator.yaml（verification 字段更新）、node_modules（--no-save 安装）。

## 禁止
改 contracts/asset-migration.md、asset-manifest-v2.json（产物由构建器再生）、manifest-sources 其他 15 份、scripts/manifest-build.mjs、runtime.mjs、eligible.mjs、matrix.mjs、regression-all.mjs、SKILL.md、commands/、webview/、plans/、vendor/ 其他文件；禁 git；禁删旧 portman 逻辑（--compat 旗标后保留）。

## 回归（每步晋升前后各跑一次）
regression 14 段（S7 的 review-gate self-test 必须绿——它不依赖 portman，但防误伤）+ preflight 7 项 + validate 0。**若 S8（be-validator 在 T2 链内）因引擎切换 FAIL：如实登记，按 accepted/forbidden 差异表裁定，不粉饰。**

## 验收要点（编排者 L2 将复核）
影子跑证据对照表 + 回滚三场景 + 五元组齐 + EXPLICIT_COMPAT_MODE 门实测 + manifest 新 hash 绑定 + 回归全绿或差异已裁定。