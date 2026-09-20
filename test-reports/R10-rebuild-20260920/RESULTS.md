# R10 rebuild fixture results — 2026-09-20T10:36:16.941Z

对照标准：`../R10-implementation-20260917/fixtures/README-recovered-semantics.md` + 幸存 `fixture-results.json` 摘要列。

| fixture | exit | ok | summary |
|---|---|---|---|
| f01 | 0 | true | propose ok=true code=null candidateId=cnd-20260917T025555Z-e0755918 stored=true |
| f02 | 0 | true | propose expected INVALID got ok=false code=CANDIDATE_INVALID reason=候选缺少十项不变量字段: trigger（§2.1 fail-closed） |
| f03 | 0 | true | propose expected INVALID(whitelist) got ok=false code=CANDIDATE_INVALID |
| f04 | 0 | true | propose expected BASELINE_MISSING got ok=false code=BASELINE_MISSING |
| f05 | 0 | true | propose expected VERSION_CONFLICT got ok=false code=ASSET_VERSION_CONFLICT |
| f06 | 0 | true | idem r1=cnd-20260917T025555Z-d5b2d6cf r2=cnd-20260917T025555Z-d5b2d6cf warnings=DUPLICATE_REPLAY: evolution.propose 已存在同 idempotencyKey 候选，返回原 candidateId cnd-20260917T025555Z-d5b2d6cf |
| f07 | 0 | true | accept expected self-verify fail got ok=false code=INDEPENDENT_VERIFICATION_REQUIRED reason=验收方身份与 proposedBy 相同（producer 自验，§6.1 禁止） |
| f08 | 0 | true | accept expected NOT_ALLOWED got ok=false code=PROMOTION_NOT_ALLOWED verdict=UNRESOLVED unresolved= |
| f09 | 0 | true | accept expected REGRESSION got ok=false code=EVOLUTION_REGRESSION verdict=REJECTED |
| f10 | 0 | true | accept ok=true code=null verdict=PROMOTED receipt=true rollback=true |
| f11 | 0 | true | accept expected PROVISIONAL→UNRESOLVED got ok=false code=PROMOTION_NOT_ALLOWED verdict=UNRESOLVED |
| f12 | 0 | true | rows=16 aggregate={"UNCHANGED":14,"REJECTED":1,"PROMOTED":1} |

TOTAL: 12/12 PASS; EXIT=0
