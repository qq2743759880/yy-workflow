# M1 authority boundary

M1 `/mcp` is `LEGACY_COMPATIBILITY`: a read-only projection from the existing
pinned development worktree. This reconciliation retains its execution engine
and pin; it does not certify equivalence to current Core/V2 stage decisions.

Every M1 adapter success and failure carries additive top-level metadata:

```json
{
  "authority": {
    "classification": "LEGACY_COMPATIBILITY",
    "canonical_stage_authority": false,
    "stage_decision_authority": "Core/V2",
    "read_only": true
  }
}
```

The adapter assigns these fields; the legacy child cannot promote itself to a
canonical authority. Classification on an error is transport metadata, not
evidence that its pin was verified. Error `data` and `evidence` remain empty.

## Identity and admission

M1 selects only its source location via trusted `YY_M1_AUTHORITY_ROOT`, then
`runtime/m1-source.local.json`, then package-relative `compatibility/m1-source/`.
It verifies the unchanged fixed commit, tree and blob manifest before
and after a call. Successful results retain that identity in
`evidence.authority_revision`; drift still fails with
`AUTHORITY_REVISION_MISMATCH`. Updating the installed Skill does not repin M1.

Current Core/V2 decisions use the selected current source and its verified
Decision authority digest. V2 `/mcp-v2` selects that source through
`YY_DECISION_ROOT` (default: the adapter's own release root); this identity is distinct from M1's legacy commit pin.

C4 and Skill must use current Core/V2 for stage admission. M1 snapshots,
`phase_check`, command guidance and asset reads cannot authorize entry. Legacy
`CANONICAL_STEP_*` labels name the old projection only; they cannot override
`canonical_stage_authority=false`. See [Decision interface](decision-interface.md).

## Preserved ABI and acceptance

M1 retains exactly six tools: `yy_open_workflow`, `yy_get_snapshot`,
`yy_get_stage`, `yy_list_assets`, `yy_read_asset`, `yy_read_evidence`. Their full
input shapes, defaults and constraints are unchanged, checked against
`tests/fixtures/m1-frozen-input-schemas.json`. All retain `readOnlyHint=true`
and `openWorldHint=false`. The five required envelope fields remain `ok`,
`code`, `data`, `evidence`, `warnings`; M1 additionally describes `authority`.
The shared V2 envelope schema and legacy payload are unchanged.

From `integrations/yy-web-mcp`, use the existing Python/FastMCP environment:

```powershell
python -B -m unittest discover -s tests -p test_m1_authority_boundary.py -v
python -B -m unittest discover -s tests -p test_bridge_client_candidate.py -v
python -B -m unittest discover -s tests -p test_mcp_envelope.py -v
```

These local tests cover classification, attempted canonical promotion, pin
drift, exact tool/input ABI and unchanged synthetic workspace fingerprints.
They do not certify a live mounted process or canonical M1 equivalence.
Detailed run logs, hashes and publication evidence belong to the coordinator's
reconciliation report.

Portable source checkout instructions and folder roles: `../docs/directory-map.md`. Missing or invalid M1 location fails closed; it never falls back to current Core as legacy semantics.
