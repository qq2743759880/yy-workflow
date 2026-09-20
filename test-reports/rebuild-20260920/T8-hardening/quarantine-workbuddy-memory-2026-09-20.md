# 2026-09-20 工作日志（yy 技能仓）

## T7 收尾批（rebuild-20260920 / T7-closeout）—— 全部施工项闭环

派单 `handoffs/T7-closeout-20260920.md`；权威判据 `plans/decision-s5-p0-semantics-20260920.md`（Owner 裁决 = 统一严格口径 ⬜+◐）。未做任何 git 操作。

### 落地
- **① S5 严格口径单点化**：`scripts/lib/ci.mjs` 新增 `OPEN_P0_MARKERS/OPEN_P0_MARKER_RE/OPEN_P0_PATTERN/EVIDENCE_REF_PATTERN/hasEvidenceRef/classifyOpenP0`；`countOpenP0` 改用之；`ci.mjs` 走 lib；`lib/orchestrator.mjs` 的 `backlogIsPending` 改引用 `OPEN_P0_MARKER_RE`（行为零变化，30 例等价）。◐ 证据卫生规则：无落点/收据引用 → 归类 `unbacked`（计数不变，分类进 warnings/inProgress）。
  语义变更已登记：`cr-20260920T112945Z-a6244b0c`（impactClass=CONTRACT，approvalId=`apr-20260920T104626Z-b3dc0c82`，invalidatedNodes=["S5"]，reason 含 grandfathering 声明）。
- **② B0 翻默认**：`scripts/ci.mjs` 重写为薄壳、**删除** legacy 内联（未留 `--legacy`）；`--lib` 改**静默**兼容 no-op（打印会破坏逐字节一致）。等价性用「翻默认前冻结快照 + 已申报差异 allowlist」证明：`b0-diff.mjs` 9/9，差异仅 2 处已申报 S5 文案（G1 S5-PASS-STRICT×1、G4 S5-FAIL-STRICT×1），G5 `--lib` 与默认逐字节一致。
- **③ `--evolve` 死路径修复（P1-1）**：`scripts/orchestrator.mjs` 五键 baseline 全部运行实测（validate 实跑 / buildManifest / receipt 链 / review-gate+S5 进程内 / 只读 .git HEAD），候选十项不变量取真实产物；缺键 → `ok:false BASELINE_MISSING` 且**不落盘**。**注意：`--dry-run` 在 B7 钩子前 early-return（orchestrator.mjs:640-644），只能以真实 resume 编排取证。** 证明 19/19（ok:true 落盘 + fail-closed 反向对照）。
- **④ hook 第三分类 `system-load`（P2-1）**：tag 取值集 `{routing, system-load, consumption}`（破坏性变更，文件头注释 + `asset-io-report.mjs` 三列同步）；routing=4 项、system-load=manifest.mjs/asset.mjs；basename 精确匹配（`fake-matrix.mjs` 不命中）。自测 22/22。
- **⑤ R3 探针加固**：双层沙箱（运行级 `run-<stamp>-<pid>/` + 探针级 `<pNN>/`）、固定 now 注入、rmRetry、**结果历史只追加**（`out-probe-history.jsonl`）、旧沙箱修剪、瞬态 FS 错误重试（仅瞬态、全留痕）。5 连跑 16/16 EXIT=0。

### 总门
regression 12 PASS/0 FAIL｜validate 0 警告｜R10 12/12｜R3 16/16×5｜R4 12/12｜**R5a 15/16 或 16/16（p16 间歇）**｜R7 12/12｜R8 12/12｜**T6 21/21（须从仓库根跑）**｜S5 自测 19/19｜A1 26/0｜b0-diff 9/9｜evolve 19/19｜io-three-tag 22/22。

### 本批发现的真实问题（已申报，未越界修）
1. **R5a p16 时间戳脆弱性（40% 失败率）**：夹具紧邻写 `state.json` 与 `receipt.json`，`journey.mjs:512 computeStale()`（相对判据）据此判 STALE，而 `journey.mjs:44` 规定非 AUTHORIZED/OBSERVED 不落盘 ⇒ `健康=STALE` 与 `落点同ns=false` 同时失败。非产品缺陷；复现器 `T7-closeout/evidence/r5a-p16-flake/repro.mjs`（mtime 同→AUTHORIZED→落盘；mtime 差 0.4–1.4ms→STALE→不落盘）。
2. **`io-audit/p02` 与 P2-1 精确匹配口径自相矛盾**（p02 用 `fake-matrix.mjs` 期望 routing），越界未修。
3. **套件 runner cwd 依赖不一致**：T6 必须从仓库根启动，R3/R4/R5a/R7/R8 cwd 无关。

### 经验（可复用）
- 取证必须**只追加**：一次失败后被成功运行覆盖 JSON，导致失败探针名永久丢失（本批吃过这个亏）。
- Windows 上探针"写后立即读"会被 AV/索引器句柄竞争打到 EPERM/EBUSY；file-handle 重试要与断言失败严格区分（仅对瞬态错误码重试，且必须留痕）。
- 自测沙箱放 `test-reports/**/.sandbox/` 下（`.gitignore` 只忽略这一条），否则留下未忽略产物。
- 断言读嵌套字段时先看真实落盘形状：R10 候选是包装记录（`{candidateId,…,candidate:{十项}}`），按顶层读会全部"缺失"。
