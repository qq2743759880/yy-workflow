# fixtures f01–f12 — 恢复的语义规格（RECOVERED SEMANTICS, not verbatim code）

> 原始 12 个 fixture 文件与 `run-fixtures.mjs` 本体未能逐字恢复（实现者会话丢失；无任何存活会话 cat 过这些文件，
> 编排者仅顶层列出 `fixtures/` 目录名，未递归）。以下语义由四个独立来源交叉重建，可信度高：
>
> 1. 编排者亲自复跑输出（jsonl line#2137 OUT，逐行 `[PASS] f01 | …` 原文）；
> 2. 幸存实物 `D:/.ai-hub/skills/test-reports/R10-implementation-20260917/out/fixture-results.json`（逐 fixture summary 原文）；
> 3. R10 REPORT.md fixture 表恢复行（f08/f09/f11/f12 的"给定/期望"列）；
> 4. 编排者验收报告 12/12 行（每 fixture 一句话语义）。

## 通用行为

- 运行方式：`node test-reports/R10-implementation-20260917/run-fixtures.mjs`（仓库根执行）；exit 0 = 全 PASS。
- 输出格式（逐 fixture 一行）：`[PASS] fNN | <一句话摘要>`，结尾 `TOTAL: 12/12 PASS` + `EXIT=0`。
- 沙箱：所有候选/证据写入限制在报告目录内（不创建仓库根 `evidence/evolution/`）。
- 每个 fixture 捕获 evolution.mjs 的 JSON 响应壳 `{ok, code, data, evidence, warnings}` 并断言 ok/code/verdict 等字段。

## 逐 fixture 规格

| fixture | 操作 | 给定（Given） | 期望（Then） | 复跑实测摘要（原文） |
|---|---|---|---|---|
| f01 | evolution.propose | 合法候选：16 资产白名单内、十项不变量字段齐备（含 trigger）、baseline 五键齐备 | ok=true, code=null，candidateId 形如 `cnd-20260917T025555Z-e0755918`，候选落盘 stored=true | `propose ok=true code=null candidateId=cnd-20260917T025555Z-e0755918 stored=true` |
| f02 | evolution.propose | 候选缺少十项不变量中的 trigger 字段 | ok=false, code=CANDIDATE_INVALID，reason 指明缺失字段与 §2.1 fail-closed | `propose expected INVALID got ok=false code=CANDIDATE_INVALID reason=候选缺少十项不变量字段: trigger（§2.1 fail-closed）` |
| f03 | evolution.propose | 候选 assetId 不在 16 资产白名单内 | ok=false, code=CANDIDATE_INVALID | `propose expected INVALID(whitelist) got ok=false code=CANDIDATE_INVALID` |
| f04 | evolution.propose | baseline 缺任一五键（结构/manifest/receipt 终态/CI 段/rollback 目标） | ok=false, code=BASELINE_MISSING（fail-closed，不臆断补全） | `propose expected BASELINE_MISSING got ok=false code=BASELINE_MISSING` |
| f05 | evolution.propose | 同 assetId 已存在未终态候选（sourceVersion 冲突） | ok=false, code=ASSET_VERSION_CONFLICT | `propose expected VERSION_CONFLICT got ok=false code=ASSET_VERSION_CONFLICT` |
| f06 | evolution.propose ×2 | 同一 idempotencyKey 重复 propose | 两次返回同一 candidateId（`cnd-20260917T025555Z-d5b2d6cf`），第二次附 DUPLICATE_REPLAY warning（幂等） | `idem r1=cnd-20260917T025555Z-d5b2d6cf r2=cnd-20260917T025555Z-d5b2d6cf warnings=DUPLICATE_REPLAY: evolution.propose 已存在同 idempotencyKey 候选，返回原 candidateId cnd-20260917T025555Z-d5b2d6cf` |
| f07 | evolution.accept | 验收方身份 == proposedBy（producer 自验，§6.1 禁止） | ok=false, code=INDEPENDENT_VERIFICATION_REQUIRED，候选保持 CANDIDATE/PROVISIONAL | `accept expected self-verify fail got ok=false code=INDEPENDENT_VERIFICATION_REQUIRED reason=验收方身份与 proposedBy 相同（producer 自验，§6.1 禁止）` |
| f08 | evolution.accept | promotionDecision 三维字段缺失（如 tokenResult.ok 缺失）；阈值数值 [待补充] 未给 | ok=false, code=PROMOTION_NOT_ALLOWED, verdict=UNRESOLVED，warnings 含"等 Owner 给数"（fail-closed，不编造） | `accept expected NOT_ALLOWED got ok=false code=PROMOTION_NOT_ALLOWED verdict=UNRESOLVED unresolved=` |
| f09 | evolution.accept | compatibilityResult.ok=false（结构/CI 回归） | ok=false, code=EVOLUTION_REGRESSION, verdict=REJECTED；catalog 停留 last accepted，失败证据轨迹保留 | `accept expected REGRESSION got ok=false code=EVOLUTION_REGRESSION verdict=REJECTED` |
| f10 | evolution.accept | 三维全 ok=true + 独立验收 exit 0 + rollbackRehearsalPassed=true（PROVISIONAL 升格证据齐备，OQ-R10-5=A） | ok=true, code=null, verdict=PROMOTED；签发 promotion receipt（含 canonicalHash）+ rollback rehearsal 通过 | `accept ok=true code=null verdict=PROMOTED receipt=true rollback=true` |
| f11 | evolution.accept | PROVISIONAL 候选缺 rollbackRehearsalPassed | ok=false, code=PROMOTION_NOT_ALLOWED, verdict=UNRESOLVED（PROVISIONAL 不得越过排练直达 PROMOTED） | `accept expected PROVISIONAL→UNRESOLVED got ok=false code=PROMOTION_NOT_ALLOWED verdict=UNRESOLVED` |
| f12 | summarizeAssetStates | 16 资产闭环投影：每行显式状态 | rows=16，聚合 `{"UNCHANGED":14,"REJECTED":1,"PROMOTED":1}`；无缺失行（hasGap=false） | `rows=16 aggregate={"UNCHANGED":14,"REJECTED":1,"PROMOTED":1}` |

## R10 REPORT.md fixture 表中恢复的行（fixture 命名法）

- f08 = `accept-PROMOTION_NOT_ALLOWED-unresolved`
- f09 = `accept-EVOLUTION_REGRESSION`
- f11 = `accept-PROVISIONAL-no-rollback`
- f12 = `summarizeAssetStates-16-closure`
- （可推断：f01≈propose-ok、f02/f03≈propose-CANDIDATE_INVALID(-whitelist)、f04≈propose-BASELINE_MISSING、
  f05≈propose-ASSET_VERSION_CONFLICT、f06≈propose-DUPLICATE_REPLAY-idempotent、f07≈accept-INDEPENDENT_VERIFICATION_REQUIRED-self-verify、
  f10≈accept-PROMOTED-happy-path——确切文件名未留存）

## 缺口（NOT RECOVERED）

- `run-fixtures.mjs` 本体（逐字）——未在任何存活转录中出现。
- 12 个 fixture 文件本体（文件名与 JSON 内容）——同上。fixture-results.json 的 `results[].summary` 是唯一逐 fixture 实测记录。
- `REPORT.yaml` 内容——从未被任何存活会话读取/打印（仅目录列表与交付物清单提到其存在）。
