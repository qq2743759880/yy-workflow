# AS-2-review 派单 — review→bugbot replace（批 1 第三波，Playbook 复制单 #3，最后一个）

你是 autopilot 管线 L1 独立执行 agent（全新上下文）。工作区：`D:\.ai-hub\skills\yy`。先读 **`plans/asset-migration-playbook.md`**（照 §六 wizard 执行）+ `contracts/asset-migration.md` + 参照 `test-reports/autopilot-work/AS-2-security/RESULTS.md` 与 `AS-2-sentinel/RESULTS.md`（两单复制范例）+ AS-2-sentinel-promotion-dispatch 的 adapter 形态参照。完成后交付证据，不自称 DONE。

## 迁移对象
- old_asset: review(prompt-backend)——EA-1 基线"提及"级，无专用 adapter
- new_asset 候选：review(bugbot-engine)——宿主侧技能 `C:\Users\Administrator\.agents\skills\review-bugbot`（本机已装）或 CodeRabbit CLI（SaaS 需 auth，AS-0 未确认可用）

## ⚠️ 本单预声明风险（与其他两单不同）
review-bugbot 是**宿主侧技能**（SKILL.md 形态，非 CLI）——可能**无可执行入口**可 spawn。按 playbook **NO INSTALL 门**执行：先探测两条候选路径（bugbot 技能目录有无 CLI/脚本入口；CodeRabbit CLI `npx @coderabbitai/cli` 是否免 auth 可用），**两条都不通 = NO INSTALL 如实登记，迁移停在 SHADOW 之前，不硬推**——此时合法产出=迁移结论"review 保留 prompt-backend + 宿主技能绑定文档化"（adapt 而非 replace 的裁定材料），交编排者/Owner 裁定。**禁止**为凑 replace 而自研 wrapper 假装接入。

## 若可安装/可执行，按 Playbook wizard 全项
1. Gate-0 基线行（review：adapter=prompt/routes T2,T4,T5/S8 链内/BW 提及）
2. NO INSTALL 探测（两候选路径）
3. 夹具：含已知缺陷的代码样本（冒号列表键行缺字段/错误退出码语义/漏 catch——对照 AS-2-first 派单先例）+ expected-findings + accepted/forbidden 差异表先定稿
4. 影子跑：旧 prompt 路径（LLM 多次取并集记波动）vs 新引擎
5. 新 adapter（≤150 行）+ index.mjs 注册 + 回滚三场景（binary missing/输出异常/正常）
6. 晋升链：manifest verification 更新（provider identity 三件套）→ manifest-build 新 hash → eligible + Gate-2 绑定 → 五元组 → change.record（Owner PENDING，参照 cr-20260925T130000Z-r2 格式）
7. 晋升前快照（v3.6 新规：regression 14/preflight 8/validate 0 **晋升前先存**）+ 晋升后三件
8. 能力差异显式登记（bugbot 的审查范围 vs 旧 review 三合一能力——收窄/扩张都登记）

## 白名单
scripts/lib/adapters/review-bugbot.mjs 或 review-coderabbit.mjs（新建，按探测结果）、scripts/lib/adapters/index.mjs（仅 review 注册行）、contracts/manifest-sources/review.yaml（verification 更新）、test-reports/autopilot-work/AS-2-review/、node_modules/pip（--no-save/用户级）。

## 禁止
改 contracts/asset-migration.md、asset-manifest-v2.json（构建器再生）、manifest-sources 其他 15 份、manifest-build.mjs、runtime.mjs、eligible.mjs、matrix.mjs、regression-all.mjs、preflight.mjs、其他 adapters、SKILL.md、commands/、webview/、plans/、governance-skills/、vendor/ 其他文件（vendor/review/ 本体不动）；禁 git。
**夹具注意**：缺陷样本含危险模式文本——照 AS-2-security D-7 先例 tar 归档入库。

完成后报告：NO INSTALL 探测结果（两候选路径）→ 按 result 分支（完整 wizard 或 adapt 裁定材料）+ 五元组（若晋升）+ 回归三件 + 偏差。不自称 DONE。