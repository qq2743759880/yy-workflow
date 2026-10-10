# Project Handoff — YY 当前身份与验收边界

SOURCE_CANONICAL：当前检出的 YY 源码根目录。安装的 `yy` skill 指向该源码；当前架构见 `../README.md`，Decision 接法见 `../reference/decision-interface.md`。

旧集成工作树是 M1 的固定兼容来源，不是当前 canonical 或部署同步权威。日期化实施步骤、旧 blocker 与根入口原文已冷备份至 `<private-backup-root>/20261004-portability/originals/.agent-archive/project-bath/20261004-context-registration/`；历史证据路径仍保留原位。

## 当前文件身份

由现有生成器从实际组件读取。此身份只说明当前字节；先前验收不会因 digest 刷新而自动继承。CURRENT block 不手工编写。

<!-- YY_AUTHORITY_LEDGER_CURRENT:BEGIN -->
### CURRENT canonical manifest identity

These values are projected from the committed manifests in this checkout. They identify current bytes; historical acceptance and fresh runtime acceptance are recorded separately.

| Identity | Schema | Digest | Components | Source of truth |
|---|---|---|---:|---|
| decision_authority | `yy/decision-authority@1` | `1903a41af8f83759e64176426e5626d8671cd24ac635a2922926a5484ccdb745` | 40 | `contracts/generated/decision-authority-components.json` |
| transport | `yy/decision-transport@1` | `fca16a68d50827b9e25e6b08e9592c26bf2a4fd20d09d6efbd82518de88387f7` | 8 | `contracts/generated/decision-transport-manifest.json` |

Refresh with `node scripts/refresh-authority-ledger.mjs` after the owner regenerates the manifests. This block does not close a work item or prove a live deployment.
<!-- YY_AUTHORITY_LEDGER_CURRENT:END -->

## 当前架构与已知状态

| 项目 | 状态与范围 |
|---|---|
| C1 | FROZEN v1.0.1；`contracts/decision-contract-v1.yaml` 是冻结语义契约 |
| C2 / C3 | HISTORICAL_ACCEPTED；接受的身份在下方，当前组件身份另列 |
| C4 | PASS_WITH_CORE_AND_V2，2026-10-04 原验收范围：38 frozen intents、Core/V2 等价、stage→brief→展示→许可、bypass 失败；新版本以新检查为界 |
| M1 | LEGACY_COMPATIBILITY，exact-six、只读；固定旧 worktree/pin，不能授予当前阶段准入 |
| V2 | `/mcp-v2` exact-three；实际阶段与 task 决策由 Core 实现 |
| host_consumption | LEGACY_V1_ONLY；执行观察与 task_behavior checker 是辅助证据 |
| C5 | DEFERRED；未交付 methodology_applied writer，Receipt v2 APPLIED / VERIFIED 未成立 |
| SM01–SM08 | Wave 1 deterministic 修复已交付；不意味着强模型效果提升已证明 |

## 验收记录与当前维护边界

- 2026-10-04 P1 reconciliation：canonical 21/21 checks、Python 167/167；local host 17/17、legacy receipt 20/20、ledger 7/7。Core 43/43、frozen intent 6/6 在隔离 stage 运行；live local/ngrok 两端各 12 次调用通过。对应交付 `yy-vnext-p1-reconciliation-report.md`、`yy-vnext-p1-acceptance.json`、`yy-vnext-p1-evidence.zip` 保持原证据范围。
- Wave 1：五组 112 checks，canonical 28/28 commands、Python 167/167；legacy CI 39 PASS / 1 FAIL / 1 SKIP。唯一失败为已有 S10 token snapshot：SKILL +13.8%、research command +20.5%；未通过改写 snapshot 隐藏。原交付为 `yy-strong-model-wave1-*`。
- 清理前的 authority check 已失败：frontend-design、planning、review、sdlc 四份 V3 契约相对已登记清单有新字节。本次不改这些契约，按原 builder 刷新身份；旧接受的 digest 保留为历史。身份刷新不认证这些资产的新方法论效果。
- 曾有 legacy S18 auto backend 在 RED 运行中尝试已配置的 DeepSeek 并收到权限拒绝，请求总数未完整观察，输出未用于验收。该路径已停止；后续本地检查使用拒绝模型宿主的 shims。受控模型比较仅允许 gpt-6.1-sol / medium。
- 保留用户改动、资产正文、C1–C4 契约和实现边界；不接 Skill Design Vault、不开始 C5。真实 ChatGPT Web OAuth / production binding 验收不能由本地合成 access 推定；已有记录以其日期化证据为准。

维护顺序：组件有新字节时运行 `decision:authority` / `decision:transport`，再运行 `decision:ledger`；随后分别运行三项 `:check` 与对应行为验收。当前导出入口为 `scripts/export-package.mjs --out <新目录> --profile core|mcp`，含当前 contracts 和校验清单；旧 make-release 已停用。源码目录职责与独立迁移说明见 `docs/directory-map.md`。

## HISTORICAL_ACCEPTED — MCP-FIRST C1/C2/C3 evidence (2026-10-02)

The following digests and verdicts are the accepted historical C2/C3 record. They are not the current canonical manifest identity and are not reopened by this reconciliation. C4 integration READY was the handoff state at that time; current C4 acceptance is governed by the P1 ledger above.

- **Sole C1 authority**: `contracts/decision-contract-v1.yaml` **v1.0.1**
  SHA-256: `ece303847db592c46a49ab9497c940a607f63abbdbcd994818027cb18b9243bf`
  (v1.0.1 erratum, 2026-10-02 C2-R1: added existing receipt codes RECEIPT_INVALID / RECEIPT_HASH_MISMATCH
  to the V2 allowlist — the C2 executable surface exposed existing receipt error codes omitted from the
  C1 V2 allowlist. V2 delta now 14 total / 14 unique / 13 reuse / 1 new. Prior v1.0.0 SHA-256
  `3579bbf6fa1d0ff458a803f6921b49a80c23fb434536c1a78d3ad1efbd605c93` is superseded.)
- Freeze chain: C1 Ground Truth → R1 six corrections → R2 five residuals closed → materialized (v1.0.0)
  → C2-R1-5 bounded erratum (v1.0.1).
  The contract file is the only semantic truth for the Decision API (authority model, Journey-vs-Phase
  split, MCP input boundary, 7 routing buckets, packet schema, 3 external tool signatures, 14-entry
  error allowlist with exactly one new code, decision_authority_digest algorithm, M1/V2 boundary,
  no-write guarantee, compatibility epoch, C2 requirements). No second prose truth exists.
- Verdicts: **C1 = FROZEN v1.0.1 · C2 = CLOSED · C3 = CLOSED (R2) · C4.1 = CLOSED · C4 integration = READY**
  - decision_authority_digest: `3716ca2ad4ae5406a35b1a0b591a9a98984c2b737e9b7c0d38dc8f7fdbcacf9e` (27 components)
  - transport_digest: `46bad1a58d3c5e7a7d30415d135f84450ee2ab3cf6dd85fe1d98c4c55988f27c` (4 components; deterministic transport drift/integrity manifest within the SOURCE_CANONICAL trust boundary)
  - C3 evidence: `artifacts/c3-mcp-v2-evidence/` (spike → CLOSURE-C3 → CLOSURE-C3-R1 → CLOSURE-C3-R2)
- Materialization boundary respected at C1 freeze time (2026-10-02, before C2): M1 exact-six
  tools/tests untouched, and at that point no Decision Core / MCP V2 server / Codex command changes
  existed yet. C2 has since delivered the Decision Core (closed) and C3 has since delivered the
  same-process dual-mount V2 surface (`/mcp` exact-six unchanged + `/mcp-v2` exact-three; evidence
  `artifacts/c3-mcp-v2-evidence/`). Codex command changes were not started at this historical handoff; current C4 implementation and acceptance are recorded above.
