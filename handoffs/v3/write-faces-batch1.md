# 批 1 写面声明表（v3.2 纪律：task × 文件唯一 owner，同文件双写禁止）

| 文件 | 唯一 owner | 备注 |
|---|---|---|
| scripts/preflight.mjs（新建） | B1-GATE | 含 buildManifest 单源检查 + DROP_ALLOWED 断言 |
| scripts/change-lock.mjs（新建） | B1-GATE | plans/change-lock.json 为锁面 |
| scripts/regression-all.mjs（新段 S14 preflight / S15 占位） | B1-GATE | **批 1 内唯一可改 regression 的单** |
| contracts/asset-migration.md（新建）+ change.record | B1-GATE | 冻结面新文件走 AV-1 同款流程 |
| scripts/manifest-build.mjs（新建） | AV-2 | manifest 唯一构建器（buildManifest 单源由此确立） |
| contracts/asset-manifest-v2.json（新建，构建产物） | AV-2 | |
| contracts/manifest-sources/*.yaml（新建 sidecar） | AV-2 | vendor 文件不可改——数据源在 sidecar，引用 vendor 路径 |
| test-reports/asset-eval-20260923/asset-baseline-before.json | B1-GATE0 | |
| test-reports/asset-eval-20260923/LICENSES.md | AS-0 | 纯只读调研 |
| scripts/lib/activation.mjs、scripts/lib/matrix.mjs | AV-3（第二波，未派） | 依赖 manifest 产物 |
| scripts/lib/adapters/portman.mjs、vendor/be-validator/rulesets/ | AS-2-first（第二波，未派） | 首个 replace=be-validator 引擎换 Spectral |

禁改（全批共享冻结面）：SKILL.md、commands/、webview/、既有 contracts 冻结件、plans/ 既有文件、vendor/ 内任何已入库文件。
