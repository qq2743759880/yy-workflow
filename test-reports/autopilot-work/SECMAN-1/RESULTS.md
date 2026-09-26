# SECMAN-1 RESULTS — Security Manifest Semantic Freshness（Batch 3 Wave 1）

- **任务**：`handoffs/v3/SECMAN-1-dispatch.md`（L1 独立执行，全新上下文）
- **依据**：`plans/T0-ground-truth-20260926.md` §2 ACCEPT-3（stale 实锤）+ §6 Wave 1 SECMAN-1 行
- **执行者**：SECMAN-1-L1-exec；**禁 git**（全程未执行任何 git 命令）
- **不自称 DONE**：本单为 CONTRACT 类，Owner 签收位 PENDING（见 §6）。

## 一、change 单类别与理由

- **记录**：`contracts/discrepancies/cr-20260926T153000Z-335b9fd6.json`（changeRecordId 格式 `cr-<YYYYMMDDTHHMMSSZ>-<8hex>`，change.mjs CHANGE_ID_RE 合规）
- **类别**：**CONTRACT**（主动声明，非 DOC_ONLY 逃逸）
- **理由（change.mjs 机检口径）**：`scripts/lib/change.mjs:283-288` `isFrozenContractPath` 判定
  `contracts/` 下除 `drafts/`、`discrepancies/` 均为**冻结契约面**；本单 touchedFiles 含
  `contracts/manifest-sources/security.yaml` → `resolveImpactClass`（同文件 :301-313）
  按 OQ-R7-4=A 最严类规则**必然归 CONTRACT**，owner approval receipt 成为必要条件（§5.1）。
  `security.yaml` 的 `when_not_to_use` 是 **被 activation.mjs 消费的规范性判定内容**
  （`scripts/lib/activation.mjs:349` 读 `row.when_not_to_use` 做负向剔除），不是纯文档措辞
  → 从严归 CONTRACT（F-034 教训：`contracts/` 冻结正文任何规范性内容改动均在冻结面内，
  「只改文案」不构成降类理由——已被 F-034 voidReason 明文确认）。
- **fail-closed 探针**（`change-category-probe.log`）：声明 CONTRACT 且不提供 receipt →
  `ok:false code:CHANGE_OWNER_REQUIRED`，未落盘、不解锁任何节点——最严类规则生效。

## 二、sidecar diff（`sidecar.diff` / `sidecar-before.txt` / `sidecar-after.txt`）

`contracts/manifest-sources/security.yaml` `when_not_to_use` 末条：

```
- 非 Python 目标（…能力收缩登记，扩规前 adapter 以 SCOPE_LANGUAGE_UNSUPPORTED 拒绝）——F-011 后守门为文件级：显式非 Python 文件目标拒绝，目录目标放行（目录内 .py 生效；0 findings 属真实扫描结果如实记录，REMEDIATION-1）
+ 非 Python 目标（…能力收缩登记）——F-019 后守门为文件级 + 目录能力发现：显式非 Python 文件目标拒绝（SCOPE_LANGUAGE_UNSUPPORTED）；纯非 Python 源码目录拒绝（SCOPE_LANGUAGE_UNSUPPORTED，Python-only ruleset 无可检对象）；混合目录照扫但 pass=false 且 uncovered_languages 显式列出未覆盖语言——"真的扫了"≠"能力覆盖了目标"，不能认证 ≠ 通过
```

其余字段（when_to_use/verification/source/drop_* 等）**零改动**。
sidecar sha256：`2fc5b6210ce3761cf97eb68d0247052150534d19d3abd5e954234ea0a315537d`

## 三、manifest 重建（before → after hash）

- 构建器：`node scripts/manifest-build.mjs`（唯一构建器，**禁手改产物**——本单未手改 JSON）
- **before**：`c30fee6b4d1a8130af8536df9b45342c78667eaebaad172d0dac767e471f25d1`（`manifest-hash-before.txt`）
- **after** ：`188eb01ae0d88d1cdf2750d5bbfa24165ac8b8d84deac45ab61fb39fa031f1c9`（`manifest-hash-after.txt`）
- 构建器打印 hash == 落盘重算 sha256 一致（`build-after.log`）；9 行结构不变。
- 重建后 security 行 `when_not_to_use` 末条已含 F-019 语义（纯非 Python 目录拒绝 / 混合 pass=false）。

## 四、consumers 验证

| 面 | 命令 | 结果 |
|---|---|---|
| eligible（正向） | `node scripts/eligible.mjs --asset security` | `eligible=true`（未退化）`eligible-security.json` |
| eligible（负向命中） | `--constraints lang=js` / `constraints c=gitleaks` / `c=多语言` | 均 `eligible=false` + `INELIGIBLE_WHEN_NOT_TO_USE` 引新条目（负向剔除仍活）`eligible-negative-probe.json` |
| S15-A5（真实执行≠能力覆盖） | regression S15-A5 段 + 独立探针 | PASS：混合目录 0 findings 仍 `pass=false` + `UNCOVERED_LANGUAGES=["js"]`；纯非 Python 目录 `SCOPE_LANGUAGE_UNSUPPORTED`；js 文件 `SCOPE_LANGUAGE_UNSUPPORTED`（`s15a5-probe.log`） |
| preflight P6（drop 旗标） | `node scripts/preflight.mjs` | P6 PASS：扫描 9 行无 drop-pending（`preflight.log`，8 PASS/0 FAIL/0 SKIP） |
| canonical signoff 读取 | `signoff-canonical.mjs canonicalSignoff(record)` | `PENDING_OWNER_RECEIPT` / authority=`ownerApprovalReceipt.status`（`canonical-signoff-probe.log`） |

## 五、audit-index 更新 + selftest

- 更新行：`plans/audit-index-20260925.md` **B-6**（manifest hash 登记期望值
  `c30fee6b…` → `188eb01a…`；新增 SECMAN-1 现值登记指针）。其余行未动。
- `plans/audit-index-selftest.mjs`：**单独复跑 68 PASS / 0 FAIL**（`audit-index-selftest-after2.log`）
  - B-6 三面全 PASS（evidence/sha256/command）；S14b 在 regression 内 PASS。

## 六、Owner 签收位

- `ownerApprovalReceipt.status = PENDING_OWNER_RECEIPT`（CONTRACT 类，L1 不代签——AS-1 drop7 / AS-2-first D-3 先例）。
- 签发后回填 `approvalId / approvedBy=owner / approvedAt / approvalEvidence=<路径>#<SHA256>`，status → SIGNED。

## 七、回归三件（SECMAN-1 目录内原始日志）

| 件 | 命令 | 结果 |
|---|---|---|
| regression | `node scripts/regression-all.mjs` | **24 PASS / 0 FAIL**（`regression.log`，含 S14b 68 PASS、S15-A5 PASS） |
| preflight | `node scripts/preflight.mjs` | **8 PASS / 0 FAIL / 0 SKIP**（`preflight.log`） |
| validate | `node scripts/validate-structure.mjs` | **[OK] 0 项警告**（`validate.log`） |
| audit-index selftest | `node plans/audit-index-selftest.mjs` | **68 PASS / 0 FAIL**（`audit-index-selftest-after2.log`） |

## 八、负向探针（fail-closed 未退化）

- sidecar 缺 `when_not_to_use`（临时副本，不动真产物）→ `buildManifestRows` 返回
  `rows=null` + `CANDIDATE_INVALID` 具名（`sidecar security.yaml: 必填字段缺失或为空 "when_not_to_use"`）
  + 产物不落盘（`negative-probe.log`）。

## 九、偏差登记（D-xxx）

- **D-1**：change record 本体落入 `contracts/discrepancies/`（change.mjs §5.2 规定落点）——
  派单 allowed write face 未逐字列该路径，但派单 step 1 明令「建 change.record」，且
  `contracts/discrepancies/` 属 change record 证据层（`isFrozenContractPath` 显式排除），非冻结契约面。
  登记待 L2 核销。
- **D-2**：未 append `plans/active/changes/index.jsonl`（该路径不在派单白名单）。现存 10 张 change
  record 仅 1 张（`cr-20260920T112945Z-a6244b0c`）在索引内，本单沿现行多数形态；索引登记移交 L2/编排者。
- **D-3**：audit-index-selftest 单独运行 68 PASS/0 FAIL 复绿；但 B-9 复验命令
  （`final-e2e-assert.mjs --backend auto`）在 selftest 内联执行时受 `spawnSync timeout=60000` 影响
  （实测该命令耗时 38~122s 波动）→ 偶发 `exit=null`。单独复跑 B-9 命中 PASS，且该命令在
  regression 内无此超时面。**非本单引入**（既有耗时特性），如实登记为观察项，不掩饰。
- **D-4**：change-lock 三写面 acquire/release 已执行（`plans/change-lock.json` 非派单白名单，
  但为该锁机制的登记面且派单 old 先例（AS-1）同法；仅登记 SECMAN-1 三写面，收口后 release）。

## 十、证据路径

`test-reports/autopilot-work/SECMAN-1/`：`sidecar.diff` / `sidecar-before.txt` / `sidecar-after.txt` /
`sidecar-hash-after.txt` / `manifest-hash-before.txt` / `manifest-hash-after.txt` /
`build-baseline.log` / `build-after.log` / `build-negative.log` / `negative-probe.log` /
`s15a5-probe.log` / `eligible-security.json` / `eligible-negative-probe.json` /
`change-category-probe.mjs` / `change-category-probe.log` / `canonical-signoff-probe.log` /
`preflight.log` / `regression.log` / `validate.log` /
`audit-index-selftest-before.log` / `audit-index-selftest-after.log` / `audit-index-selftest-after2.log`。
