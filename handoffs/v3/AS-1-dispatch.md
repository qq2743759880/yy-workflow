# AS-1 派单 — drop 7 + S15 迁移不变量（批 1 第三波，最大联动面单）

你是 autopilot 管线 L1 独立执行 agent（全新上下文）。工作区：`D:\.ai-hub\skills\yy`。先读 `plans/asset-migration-playbook.md` §六 + `plans/execution-plan-v3-20260923.md` v3.2/v3.3（S14/S15 定义）+ `test-reports/autopilot-work/AS-2-security/RESULTS.md`（复制范例）。本单获 **SKILL.md 写权限**（drop 需改资产指针表——批 1 放行覆盖，其余禁改面不变）。完成后交付证据，不自称 DONE。

## 任务：drop 7（be-architect、be-resilience、be-provider、colorize、frontend-visual-validation、agent-vision-toolkit、agent-research）

### 联动面 6 处（逐处实测定位后改）
1. `SKILL.md` 资产指针表：删 7 行（token 预算只会变松，S10 门应更绿）；
2. `scripts/lib/matrix.mjs` CLUSTERS：candidates 删 7 项，keywords 保留（路由词汇无害），**禁止留空引用**（T1 candidates 剩 implementation/be-validator/sdlc；T2 剩 implementation/be-validator/sdlc/security/review；T3 剩 be-validator/dev-planner——按实存核对）；PRIORITY 数组核对；
3. `scripts/validate-structure.mjs`：16 资产断言收缩至 9（H6/H 系列相关）；
4. `webview/journey/content.js`：`node scripts/build-guide-content.mjs` 重建（9 资产）；
5. `config.example.json` 资产清单核对；
6. `scripts/lib/adapters/index.mjs`：无这 7 个的注册（核对即可）。
7. `git rm -r vendor/<name>/` ×7（vendor/be-architect、be-resilience、be-provider、colorize、frontend-visual-validation、agent-vision-toolkit、agent-research）。

### 顺序纪律
先确认 AS-2 系列已完成（be-validator/security/skill-sentinel 引擎已换且不在 drop 清单）→ 逐资产 drop（每资产一张 change.record CONTRACT 单 Owner PENDING，格式参照 cr-20260925T150000Z）→ 每资产 drop 后跑 preflight 确认零越权 → 全部完成后回归三件。

### S15 迁移不变量段（regression-all.mjs 新增，继 S14 后）
四条机验断言（v3.2 定义 + 第十二审计两模式）：
1. drop 资产引用 0 命中（全仓 grep 7 个名字，排除 test-reports/docs/history 等历史证据面）；
2. replace 资产真实消费探针（be-validator/spectral、security/semgrep、skill-sentinel/skill-scanner 各跑一次真实扫描）；
3. manifest 驱动路由断言（eligible.mjs 对 9 资产全 eligible 且 Gate-2 hash == build hash）；
4. **legacy loader 不可达**（asset.mjs loadAssets 旧路径：drop 资产不出现在 loader 输出；EXPLICIT_COMPAT_MODE 未开启时旧路径不可达）。
另两条审计模式断言：真实执行≠能力覆盖（目录混合场景 UNCOVERED_LANGUAGES 必现）、correction≠作废（voided transition 不可再入状态机）。

### 自测
1. 逐资产 drop 后 preflight 全绿（CLUSTERS↔磁盘一致）；
2. 回归三件（14 段+S15→15 段）全绿；
3. S15 四断言各自注入反例（临时造孤儿引用等）→ FAIL 具名；
4. 9 资产 manifest 重建 + eligible 全 true；
5. RESULTS.md：6 处联动逐处 diff 摘要 + S15 断言清单 + 偏差。

## 白名单
SKILL.md（仅指针表 7 行删除）、scripts/lib/matrix.mjs、scripts/validate-structure.mjs（16→9 收缩）、scripts/regression-all.mjs（S15 段）、webview/journey/content.js（构建产物）、config.example.json、scripts/lib/adapters/index.mjs（核对）、vendor/ 7 目录删除、contracts/manifest-sources/ 7 份删除 + 9 份保留核对、contracts/asset-manifest-v2.json（构建器再生）、contracts/discrepancies/（7 张 drop 单）、plans/asset-migration-playbook.md（§六 勾选回写）。

## 禁止
改 commands/、webview/ 其他文件、governance-skills/、vendor/ 保留资产、runtime.mjs、eligible.mjs、manifest-build.mjs、plans/ 既有文件（playbook §六 勾选除外）；禁 git 操作（vendor 删除用文件系统删除，git 由编排者收口）。

## 验收要点
preflight 全绿（CLUSTERS↔磁盘 9/9）+ 回归 15 段全绿 + S15 四断言注入反例全抓 + 9 资产 eligible 全 true。