# R5b Implementation Report — Journey Control Room webview plugin page

Date: 2026-09-17 (20:16–20:30 CST). Executor: orchestrator (direct implementation under Owner authorization 2026-09-17 20:16 "不派子agent,你自己全自动完成遗留项" — API outage made independent-agent dispatch impossible; same acceptance standards applied).

## 1. Authority

- Frozen contract: contracts/C-R5-ui.md v2 = fe3a83e6296ee87c87312a509d3fabf3a04e69898d944f9d982f60c9b54ffafd
- Owner OQ rulings: owner-oq-rulings.md = 1085de55b86d08c81f317fd60186142ddbd2469bd630abddd5e1ffcebb8c10ca ("全部按你推荐的来")
- READY basis: G2.2 eb79eb3a… L15 = {R5b}

## 2. Deliverables (after sha256)

| file | sha256 |
|---|---|
| webview/journey/index.html | 3af780729834621a6c1cb5f6a04293e9fae12ed2233303452781ff64598bf3bd |
| webview/journey/styles.css | 4b79c59cf42a635341df85d6587ed5e0830f12996de6166ea60b83cd25dbbab7 |
| webview/journey/render-core.mjs | 93a7652b3b4360bc1a75a3caa3a576bf395097478811ff9648b04d19f2b3d332 |
| webview/journey/host-bridge.mjs | b02cfd6551529b840b355f2ebf711a33ba8381a95a6ed23c704a8f84f51b06c3 |
| webview/journey/README.md | 17166fd7a3cd6221bfa9b8392e88f0689e39380c064937108c2ab51f788a2890 |
| fixtures/f-01…f-10 (10 files) | see fixtures/ (all individually hashed, listed in §4) |

## 3. Frozen inputs before==after (13 items, ALL unchanged)

C-R5-ui fe3a83e6…; C-R5-journey 48b7c379…; C-R4 19055ff7…; G2.2 eb79eb3a…; PRD0 886d5eb8…; tt-journey.mjs 0d5a42c6…; journey.mjs fe9bb851…; phase.mjs 59b19bd2…; receipt.mjs 9f3b5c46…; store.mjs 94ce8d01…; state.mjs 3da5734e…; gate.mjs e63b97dc…; owner-oq-rulings 1085de55….

## 4. Fixtures (all exit 0, rerun by executor)

| fixture | covers |
|---|---|
| f-01-bridge-payload | real CLI happy path (both shells parse, injectedAt echo) |
| f-02-degraded | OQ-U-20=a bridge absent/malformed => degraded overlay (index.html markup asserted) |
| f-03-malformed-shell | read shell without ok:boolean => degraded |
| f-04-state-matrix | 7-state display mapping; FAILED/SKIPPED/UNRESOLVED never success |
| f-05-worst-state | group worst-state rollup never upgrades |
| f-06-conflict | PROJECTION_CONFLICT node-level both-evidence surfaced |
| f-07-not-found | JOURNEY_NOT_FOUND data channel (§8.1) |
| f-08-nextprompt | structured nextPrompt + snapshot-hash echo, recompute=false |
| f-09-no-polling | no setInterval anywhere; manual refresh + host push only |
| f-10-session-isolation | OQ-U-19=a session reload fully replaces payload |

## 5. Verification

- node scripts/tt-journey.mjs --self-test: 8/8 PASS, exit 0
- table-check: REPORT tables consistent (probe reused)
- git status: scripts/ changes are ALL pre-existing R3–R10 era; today's R5b added ONLY webview/journey/** + this report dir (zero scripts/contract/plans/vendor/prototypes touches)

## 6. FINDING (honest, requires Owner visibility): regression-all failures pre-existing, NOT from R5b

- Current dirty tree regression-all: 7 PASS / 5 FAIL (S3 替换清单, S4 契约工作流 smoke, S5 宿主执行 smoke, S6 资产缓存 smoke, S8 资产消费证据)
- HEAD frozen baseline (git worktree at 240f3fbd, temp dir, removed after test): **12 PASS / 0 FAIL, exit 0**
- Conclusion: the 5 failures were introduced by the working-tree changes from the R3–R10 implementation era (scripts/ modifications + new lib files), NOT by R5b (R5b is purely additive; zero scripts/contract touches; last recorded full regression pass was R4-era 2026-09-15 "12/0")
- Action: registered as REG-01 in G2.2/PRD0 status block (see §7); must be resolved before R6 release (R6 requires full regression); investigation owner: orchestrator + Owner disposition

## 7. Declarations

route41Rerun.required=false (zero routing change); acceptancePerformedByExecutor=true for fixtures/self-test/baseline (Owner authorized direct execution; independent re-acceptance of the whole R5b closure still available on request); no commits; reportSha256 self-reference per project convention (field-value normalization to 64 zeros, raw disk hash recorded below).

Raw disk sha256 of this file: (computed after write, see REPORT.yaml)