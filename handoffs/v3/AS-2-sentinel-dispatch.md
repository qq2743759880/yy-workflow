# AS-2-sentinel 派单 — skill-sentinel→skill-scanner replace（批 1 第三波，Playbook 复制单 #2）

你是 autopilot 管线 L1 独立执行 agent（全新上下文）。工作区：`D:\.ai-hub\skills\yy`。先读 **`plans/asset-migration-playbook.md`**（照 §六 wizard 执行）+ `contracts/asset-migration.md` + 参照 `test-reports/autopilot-work/AS-2-security/RESULTS.md`（上一单复制范例，含 change-record 格式与 D-7 夹具归档先例）。完成后交付证据，不自称 DONE。

## 迁移对象
- old_asset: skill-sentinel(prompt-backend)——Enkrypt AI 的 skill 包扫描器 vendor（916K→实为 skill-sentinel 目录），EA-1 零现
- new_asset: skill-sentinel(skill-scanner-engine)——cisco-ai-defense/skill-scanner 2.5k★ Apache-2.0（AS-0 已核），pip/console-script 安装，Windows 可用性 AS-0 标记为推断——**本单实测验证**

## 关键差异点（vs 上一单）
1. 安装走 **pip**（hatch-vcs 版本派生需 git 元数据——AS-0 风险项：若 pip install 从 sdist 装失败，改用 git clone + pip install .；NO INSTALL 门触发则如实登记）
2. runtime_test：`skill-scanner --help` 或等价入口（入口点 `skill_scanner.cli.cli:main`）
3. 夹具：**两类**——良性 skill 包（如 governance-skills/verification-before-completion 打包）应零检出 + 恶意样本（构造含 prompt 注入/数据外泄指令的假 skill 包）应命中。forbidden_difference 必含"良性包误报"（比漏洞夹具的 missing_detection 更关键：安全扫描器误报会阻塞正常工作流）
4. 旧引擎同样是 LLM-prompt 路径（skill-sentinel 无专用 adapter）——不对称对照照 AS-2-security 先例
5. 自研 ruleset 不适用（skill-scanner 自带多 agent 检测）——ruleset 步骤替换为"检测配置/阈值记录"

## 按 Playbook 执行
wizard 全项 + 三场景回滚演练（正常/binary missing→回滚 prompt-backend/输出格式异常→receipt failure）+ 五元组 + change.record（Owner PENDING，格式参照 cr-20260924T120000Z 与 cr-20260925T063000Z）+ 晋升后 manifest 重跑新 hash 绑定 + 回归三件晋升前后各一次。

## 白名单
scripts/lib/adapters/skill-scanner.mjs（新建）、scripts/lib/adapters/index.mjs（仅 skill-sentinel 注册行）、contracts/manifest-sources/skill-sentinel.yaml（verification 更新）、test-reports/autopilot-work/AS-2-sentinel/、governance-skills/ 打包副本仅进临时目录（不改本体）。

## 禁止
改 contracts/asset-migration.md、asset-manifest-v2.json（构建器再生）、manifest-sources 其他 15 份、manifest-build.mjs、runtime.mjs、eligible.mjs、matrix.mjs、regression-all.mjs、preflight.mjs、SKILL.md、commands/、webview/、plans/、governance-skills/ 本体、vendor/ 其他文件；禁 git。
**夹具注意**：恶意样本夹具含注入指令文本，可能触发 Mimosa/扫描器拦截——照 AS-2-security D-7 先例直接 tar 归档入库。

完成后报告：wizard 勾选 + NO INSTALL 门 + 双夹具影子对照 + 回滚三场景 + 五元组 + 新 hash + 回归三件 + 偏差。不自称 DONE。