# AS-2-security 派单 — security→semgrep replace（批 1 第三波，Playbook 首个复制单）

你是 autopilot 管线 L1 独立执行 agent（全新上下文）。工作区：`D:\.ai-hub\skills\yy`。先读 **`plans/asset-migration-playbook.md`（你的操作手册，严格照 §六 wizard 清单执行）** + `contracts/asset-migration.md`（状态机权威）+ `test-reports/autopilot-work/AS-2-first/RESULTS.md`（范例参照）。完成后交付证据，不自称 DONE。

## 防超时纪律
按 playbook wizard 逐项小步走，每步 ≤10 分钟落盘；migration-record.json 边跑边写。

## 迁移对象（Migration Object）
- old_asset: security(prompt-backend)——现无专用 adapter，EA-1 基线=S8 链内、BW 零现
- new_asset: security(semgrep-engine)——semgrep 官方源 github:semgrep/semgrep，**pip 安装（npm semgrep 是 ISC 假包，禁 npm install semgrep——AS-0 实测）**，runtime_test `semgrep --version`
- 特殊性：旧引擎是 LLM-prompt 路径（非确定性输出格式），新引擎是确定性静态分析——**差异表设计必须适配这一本质差异**（比 be-validator 引擎互换更不对称）

## 按 Playbook 执行的关键步骤
1. **Gate-0**：migration-record.json 记 old 侧基线（security 现 adapter=prompt、routes=T2/T4/T5、消费=S8 链内、vendor 38K）
2. **NO INSTALL 门**：pip install semgrep → `semgrep --version` 核实真实能力（provider identity 三件套）；装不上 = NO INSTALL，如实登记不硬推
3. **规则集许可**：优先**自研本地 ruleset**（我们对 fixture 漏洞类目自写规则，零许可风险）；若用官方 registry ruleset 必须先核其许可（AS-0 未覆盖项，强制补核）
4. **夹具**：含已知漏洞的样本文件（硬编码密钥/SQL 拼接/弱哈希等确定性可检类目）+ expected-findings.json + accepted/forbidden 差异表**先于影子跑定稿**（forbidden 必含 missing_detection/crash/invalid_exit_code）
5. **影子跑**：旧路径=orchestrator prompt dispatch 携 security 资产对夹具产出（LLM 输出，记录形态）vs 新路径=semgrep --json。LLM 侧不确定性如实处理（多次运行取并集/记录波动），证据对照按 playbook §二
6. **新 adapter**：`scripts/lib/adapters/security-semgrep.mjs`（spawn semgrep --json → 解析 findings → 资产消费证据锚点；≤150 行）+ `scripts/lib/adapters/index.mjs` 注册 `ADAPTERS.set('security', ...)`
7. **回滚演练三场景**：正常/binary missing（PATH 注入）→ 回滚 prompt-backend 旧路径可用（EXPLICIT_COMPAT_MODE 留痕）/输出格式异常 → receipt failure
8. **晋升**：ruleset 固化 `vendor/security/rulesets/`（自研）、manifest-sources/security.yaml verification 更新（provider identity 三件套）→ manifest-build 重跑新 hash → eligible + dispatch Gate-2 日志新 hash 绑定
9. **五元组 + change.record**（CONTRACT 类，Owner 签收位 PENDING——格式参照 cr-20260924T120000Z-as2f1rst-promotion.json）
10. **回归三件**晋升前后各一次：regression 14 段 + preflight 8 项 + validate 0

## 白名单
scripts/lib/adapters/security-semgrep.mjs（新建）、scripts/lib/adapters/index.mjs（仅 security 注册行）、vendor/security/rulesets/（新建自研 ruleset）、contracts/manifest-sources/security.yaml（verification 更新）、test-reports/autopilot-work/AS-2-security/（fixtures/migration-record/RESULTS）、node_modules/pip 包（--no-save/用户级安装）。

## 禁止
改 contracts/asset-migration.md、asset-manifest-v2.json（构建器再生）、manifest-sources 其他 15 份、manifest-build.mjs、runtime.mjs、eligible.mjs、matrix.mjs、regression-all.mjs、preflight.mjs、SKILL.md、commands/、webview/、plans/、governance-skills/、vendor/ 其他文件（含 vendor/security/security.md 本体——旧方法论文档保留，只是路由换引擎）；禁 git。

## 验收要点（编排者 L2 将复核）
Playbook wizard 逐项勾选对照 + NO INSTALL 门真实执行 + 差异表先定稿 + 回滚三场景 + 五元组 + 新 hash 绑定 + 回归三件全绿或差异已裁定。