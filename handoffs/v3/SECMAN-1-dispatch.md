# SECMAN-1 派单 — Security Manifest Semantic Freshness（Batch 3 Wave 1）

- **current revision**: `c599f7b`（派发时）；working tree clean（除两份未入库交接文档）。
- **Evidence Boundary**: 以下事实全部由编排者在当前 revision 亲自核验——sidecar 内容（直读 `contracts/manifest-sources/security.yaml`）、adapter 真实语义（直读 `scripts/lib/adapters/security-semgrep.mjs:69-110`）。交接文档降级为 ADVISORY。
- **目标**: 把 security sidecar 的 `when_not_to_use` 从 F-011 旧口径（目录目标放行 / 0 findings 如实记录）修正为 F-019 真实语义（纯非 Python 目录拒绝 / 混合目录 pass=false + UNCOVERED_LANGUAGES），并从 source 重建 manifest（禁手改生成物），重跑 hash→consumers→回归→audit-index。
- **非目标**: 不改 adapter 行为（F-019 语义是正确基准，sidecar 向它对齐）；不改 ruleset（Python-only 现状是既定能力收缩）；不扩多语言/gitleaks（backlog）。
- **dependency**: 无（sidecar 是权威 source）。
- **allowed write face**: `contracts/manifest-sources/security.yaml`、`contracts/asset-manifest-v2.json`（**仅由 `node scripts/manifest-build.mjs` 重建**）、`plans/audit-index-20260925.md`（**仅 hash 登记行**）、`test-reports/autopilot-work/SECMAN-1/`。
- **forbidden write face**: `scripts/lib/adapters/security-semgrep.mjs`、`vendor/security/rulesets/*`、`scripts/manifest-build.mjs`、`scripts/regression-all.mjs`、其他 8 份 sidecar、`contracts/asset-migration.md`、`contracts/asset-manifest-v2.md`、`governance-skills/`、`webview/`、`SKILL.md`、`commands/`、`plans/` 其他文件、`vendor/` 其他。
- **frozen-contract impact**: 触碰 `contracts/` 面 → 按 `scripts/lib/change.mjs` `isFrozenContractPath` **最严类规则自检**：若 touchedFiles 含冻结契约规范性内容，须主动声明 CONTRACT 并挂 Owner receipt（**禁 DOC_ONLY 逃逸——F-034 教训**）。sidecar 是否属冻结契约规范性内容：**先读 change.mjs 判定并如实声明**，不确定则按 CONTRACT 从严。
- **production caller**: `scripts/manifest-build.mjs`（sidecar → 产物）→ `scripts/lib/asset.mjs readManifest`（消费）→ `scripts/lib/activation.mjs`（资格判定读 when_not_to_use）。
- **production authority**: `scripts/manifest-build.mjs`（唯一 manifest 构建器，preflight P5 断言单源）。
- **positive probe**: 重建后 manifest 的 security 行 `when_not_to_use` 含 F-019 语义（纯非 Python 目录拒绝 / 混合 pass=false）；`node scripts/eligible.mjs --asset security` 仍 eligible=true；S15-A5 复跑 PASS（混合目录 pass=false + UNCOVERED_LANGUAGES）。
- **negative probe**: 构造 sidecar 缺 when_not_to_use → 构建器 CANDIDATE_INVALID 具名（fail-closed 未退化）。
- **counterexample**: 若认为「sidecar 旧口径与 adapter 不冲突」——请给出两段文字如何同时为真的论证；若论证不成立则本单目标成立。
- **failure semantics**: 构建失败 → CANDIDATE_INVALID 具名且产物不落盘（fail-closed）；hash 不一致 → 具名。
- **rollback/compat**: sidecar 单文件可回滚（git 层面）；manifest 由构建器再生无手工残留。
- **regression**: regression 24 项 + preflight 8 项（P5/P5b/P6）+ validate 0 + audit-index selftest（hash 行更新后须复绿）。
- **evidence path**: `test-reports/autopilot-work/SECMAN-1/`（sidecar diff、构建前后 hash、consumers 验证、回归日志、change.record 声明）。
- **stop condition**: 任一门禁 FAIL 或忘了从 source 修（直接改产物）→ 立即停止并登记。

## 执行步骤
1. 读 `scripts/lib/change.mjs` 判定 sidecar 改动类别并**主动声明**（从严 CONTRACT 优先），建 change.record（Owner PENDING）；
2. 修 `contracts/manifest-sources/security.yaml` 的 when_not_to_use 末条 → F-019 真实语义（措辞精确：纯非 Python 源码目录 → SCOPE_LANGUAGE_UNSUPPORTED 拒绝；混合目录 → 照扫但 pass=false + uncovered_languages 显式列；不能认证 ≠ 通过）；
3. `node scripts/manifest-build.mjs` 重建 → 记新 hash（before/after）；
4. consumers 验证：`eligible.mjs --asset security`、S15-A5 复跑、preflight P6（drop 旗标）；
5. 更新 `plans/audit-index-20260925.md` 中登记 manifest hash 的行（如 B-6 期望值）→ `node plans/audit-index-selftest.mjs` 复绿；
6. 回归三件；RESULTS.md（含 D-xxx 偏差）。

禁 git；探针输出存文件。