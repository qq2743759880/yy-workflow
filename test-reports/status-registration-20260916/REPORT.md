# Status Registration Report — 2026-09-16 (UI-GA=APPROVED Journey + C5 postfix PASS alignment)

```yaml
task: status-only registration — UI-GA approval + carry-2 completion (C5 postfix PASS) + carry-1 closure
snapshot: 240f3fbdb4ee757dffc4d5ab80407d1b2c84863c
executedBy: orchestrator
ownerAuthority:
  UI-GA: APPROVED 2026-09-16 (Owner), selectedDirection=Journey, reason = 与 R5a 后端只读投影同源衔接
  D8 authorization: 挂账 2 完整台账对齐
evidence:
  C5 postfix: test-reports/C5-postfix-reprobe-20260915/REPORT.md (verdict PASS, probeHash 61b1b437…394e)
changedFiles:
  - plans/tasks/G2.2-task-graph-20260911.md (5 edits: header C5 clause + UI-GA approval, current block C5 line, current block UI-GA line, §5 C5 row tail, §6 UI-GA block)
  - plans/tasks/PRD0-contract-revision-v3.md (4 edits: doc-state, §1.2 UI-GA, §1.2 G2.1 C5 clause, §5.5 UI-GA)
beforeAfterHashes:
  G2.2: {before: a08206e1ee1be5750f0746e88cce63bade934a424a347592d7f2f51d11fc666b, after: 3ca090e15678f170ef3561ff48824cc0e2eb735201cf79b344265cce6af4ec60}
  PRD0: {before: cb8310999306d293191d3ff85de770517850db4b4227c9aa0a24f5357b98a50a, after: 64472c0309cf09f31d4e217eb6f5370be73a9245b165838e0e463baca1643af5}
result: |
  UI-GA = APPROVED (Journey) — Gate A lifted; R5b READY formula now satisfiable (R5a DONE ✓ + UI-GA APPROVED ✓) pending C-R5-ui contract freeze
  C5 = RESOLVED, postfix original-probe regression PASS (挂账 1 closed) — gate-skip no longer silently completes as done
  G2.2 top block / current block / §5 C5 row now consistent (no stale "unfixed / repair subject / 挂账 1 完成前" phrasing)
openItems:
  - C-R10-evolution: draft ACCEPTED, OQ-R10-1…6 = A authorized → freeze dispatch next
  - R5b: needs C-R5-ui contract freeze (UI-GA now APPROVED)
  - R9/R6: still inherit C2 UNRESOLVED
  - carry-3/4: commit timing + third-party acceptance package before R6 gate (per Owner instruction, R6 release gate runs third-party package)
route41Rerun: {required: false}