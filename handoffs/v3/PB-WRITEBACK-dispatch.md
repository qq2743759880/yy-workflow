# PB-WRITEBACK 派单 — Playbook §七 使用后回写（三单实战经验沉淀，与 HARDEN-1 并行）

你是 autopilot 管线 L1 独立执行 agent（全新上下文）。工作区：`D:\.ai-hub\skills\yy`。先读 `plans/asset-migration-playbook.md`（§七 使用后回写）与三份使用记录：`test-reports/autopilot-work/AS-2-security/RESULTS.md`、`AS-2-sentinel/RESULTS.md`、`AS-2-review/RESULTS.md`。完成后交付证据，不自称 DONE。

## 任务：三单实战经验回写 Playbook（v1 → v1.1，附修订记录）
沉淀四条实战经验（全部有单据出处）：
1. **Provider identity 的同名撞车检查**：PyPI `skill-scanner`(0.3.3 MIT) ≠ 官方 cisco-ai-skill-scanner（AS-2-sentinel D-2）——npm semgrep 假包的 pip 版实例；三件套增补"包名 ≠ 官方项目名时必查官方 repo 的 install 通道"。
2. **NO INSTALL 分支产出物清单**（AS-2-review 实战）：两候选不通时合法产出=①NO INSTALL 裁定记录 ②状态保持 ACTIVE（不得 SHADOW——无夹具无影子对象）③adapt 裁定材料（选项+再评估触发器）④零生产写面——写进 §四 Failure Rules 的 NO INSTALL 条目扩充。
3. **漏洞夹具归档标准动作**（AS-2-security D-7）：tar 归档入库+README 记 --lang python 重放。
4. **benign_false_positive**：安全扫描器的良性包误报是 forbidden 第 四 类之外的高频类目（AS-2-sentinel 双夹具实战）——双夹具影子跑（恶意+良性）升为标准动作。
写法纪律：只增补与修正实战验证过的条目；每条注明出处单据；版本号 v1→v1.1 + §七 修订记录追加；**不新增状态机**（契约唯一权威）。

## 自测（证据落 `test-reports/autopilot-work/PB-WRITEBACK/`）
1. 四条经验逐条在 Playbook 正文落位且引用出处；
2. 三份使用单 RESULTS 的关键教训与 Playbook 增补无遗漏交叉核对（矩阵表）；
3. 回归三件（regression 20 项/preflight 8/validate 0）全绿（文档改动不触门，实测证明）。

## 白名单
plans/asset-migration-playbook.md、test-reports/autopilot-work/PB-WRITEBACK/。

## 禁止
改 contracts/、scripts/、webview/、SKILL.md、commands/、governance-skills/、其他 plans/ 文件（HARDEN-1 正在写 audit-index 与 FINAL-E2E 文档——避开）；禁 git。

## 验收要点
四条经验落位+出处、修订记录、交叉核对矩阵、回归三件全绿。