# VERIFY-2.9.0 独立实证验收报告

- 被测提交：`21ae3d0`（TT 2.9.0，repo `~/.ai-hub/skills/tt`）
- 验收类型：独立实证（不采信 IMP1/IMP2-3 报告；逐项亲自构造输入跑通并核对）
- 验收时间：2026-09-05
- 环境：win32 / node v24.18.0 / 全部测试产物在系统 TEMP（`<TEMP>/opencode/tt-verify-2.9.0/`）；验收前后 repo `git status` 干净；零依赖；未提交未 push

## 结论总览

| 项 | 结果 | 一句话 |
|---|---|---|
| A1 自动断点收尾写 state-summary | PASS | 字段齐全且与 `.tt-state/state.json` 逐项核对一致（含失败路径也写） |
| A2 summary-read 三模式 + 空目录 | PASS | --latest/--all/列表均正确；空目录不崩溃、提示清晰 |
| A3 语法 node --check | PASS | 6 个脚本 exit 0 |
| B1 contract-reverse 反推 | PASS | Express+Flask 路由抽出正确、draft:true、out 可 JSON 解析；附 2 处次要启发式缺陷 |
| B2 orchestrator --contract-draft | PASS（部分） | 互斥/缺文件 exit2、日志、contracts contractSource、前端草案放行均验过；be-validator「不跑真校验」仅日志/标记层生效，adapter 层未守（见问题 #3） |
| B3 contract-discrepancy | PASS | 变更单含 ok+missing、exit 0 |
| B4 regression-all | PASS | 独立重跑 8 PASS / 0 FAIL（S4/S5 行为未变） |
| C1 exec-host-probe | PASS | opencode/claude/codex available=true + version 非空；宿主配置 hash/mtime 前后一致 |
| C2 exec-host-generic | PASS | 参数解析不崩；codex 真实调用 6s 如实 TIMEOUT exit1，无未捕获异常 |
| C3 只读红线 | PASS | 全程 ~/.claude/settings.json、~/.codex/config.toml 零改动；repo 无残留 |

---

## A. 自动断点

### A1 — orchestrator 收尾写 `artifacts/<planId>/state-summary.json` — **PASS**

实测命令（workspace = TEMP）：
```
node scripts/orchestrator.mjs --task "backend login module" --workspace <TEMP>/A1 --backend prompt
```
- exit 0；收尾日志 `... | execution-feedback: ... | state-summary: artifacts/plan-mtoaz9vh/state-summary.json`
- 生成文件存在，字段核对：
  - `schema:"tt/state-summary@1"`、`planId/task/cluster/status:"done"/degraded:true/generatedAt/modes{...}` 均在
  - `summary.total:8`、`done:1`、`failed:0`、`skipped:7`、`assetConsumed:0`、`depPrecondition:7`、`blockedSubtasks:[implementation,be-provider,be-resilience,sdlc,security,review,be-validator]`、`contractFrozen:"contracts/plan-mtoaz9vh.json"`
  - `critiqueBacklog:{open:3,nextItems:[...]}`（本机 tracker 可读，非 null）
  - `files:{state,memorySnapshot,executionFeedback,report}` 四字段；md 摘要产物确实存在（非指向空）
- **与 `.tt-state/state.json` 逐项交叉核对（非只看字段存在）**：state.json 8 个 subtask = 1 done（be-architect）+ 7 skipped（error 均为 `DEP_PRECONDITION`）；blockedSubtasks 的 7 个资产 = 这 7 个 skipped subtask 的资产集合（一致）；modes 一致；contracts/plan-mtoaz9vh.json 真实存在（contractFrozen 非虚报）。**正确性通过。**
- 附加：失败路径同样留断点——无契约的失败计划（见 B2-4 用例 A，exit 5）也写了 `state-summary.json`，`status:"failed"`、`summary.total:5 / done:1 / skipped:4`、blocked 齐全。

### A2 — summary-read --latest / --all / 空目录 — **PASS**

| 用例 | 实测 | exit |
|---|---|---|
| `--workspace <A1> --latest` | 输出完整 JSON（含 schema/critiqueBacklog/files 全文），与文件一致 | 0 |
| `--workspace <A1> --all` | JSON 数组（含 modes/total/done/skipped/blockedSubtasks/contractFrozen/critiqueBacklogOpen） | 0 |
| 默认（无 --latest/--all） | 行式清单：`plan-mtoaz9vh \| backend login module \| done (degraded) \| 0.0% \| blocked: ... \| artifacts/...` | 0 |
| 空目录 `--latest` | stderr 清晰提示「无 state-summary.json（workspace=...）——先跑 orchestrator…」，不崩溃 | 1 |
| 空目录默认列表 | 「无 state-summary.json（workspace=...）」不崩溃 | 0 |
| 空目录 `--all` | 输出 `[]` 不崩溃 | 0 |

与报告声称的差异（轻微措辞）：声称「空目录 exit 非 0」，实测仅 `--latest` 是 exit 1；默认列表/`--all` 对空目录是 exit 0（带提示/空数组）——属合理语义，非缺陷。

### A3 — `node --check` — **PASS**
orchestrator / summary-read / contract-reverse / contract-discrepancy / exec-host-probe / exec-host-generic 全部 exit 0，无语法错误。

---

## B. 棕地契约

### B1 — contract-reverse（代码反推 OpenAPI 草案）— **PASS**（附 2 处次要缺陷）

自建后端样例（TEMP/B1-backend）：
- `src/server.js`（Express）：`POST /api/login`、`GET /api/users`、`GET /api/users/:id`、`DELETE /api/users/:id`、`GET /healthz`
- `src/app.py`（Flask）：`GET /api/items`、`POST /api/items`、`GET /api/items/<int:item_id>`

实测：`node scripts/contract-reverse.mjs --source <TEMP>/B1-backend/src --out <TEMP>/B1-draft.json`
- exit 0；`extracted 6 paths / 8 operations (draft:true) from 2 files`
- out 文件可 `JSON.parse`；`draft:true` 存在；`openapi:"3.0.3"`
- 抽出核对：Express `POST /api/login`、`GET /api/users`、`GET|DELETE /api/users/{id}`（`:id`→`{id}` 归一正确）、`GET /healthz` 全对；Flask `GET|POST /api/items` 对（methods=[...] peek 生效）；source 标注正确。

发现（真实、次要，不阻断 PASS）：
1. **Flask 路径转换器 `@app.route('/api/items/<int:item_id>')` 归一化出错** → 输出路径 `/api/items/<int{item_id}>`（`:item_id`→`{item_id}` 但 `int:` 前缀残留，尖括号在 OpenAPI path template 里非法）。期望：`/api/items/{item_id}`（剥掉转换器）。复现：任意含 `<int:...>`/`<string:...>` 的 Flask 路由。
2. **`prefixesDetected` 虚报**：Flask 装饰器行 `@app.route('/api/items', methods=['GET'])` 被 Express 前缀映射正则 `app.route('<path>', <var>)` 命中，把 `methods` 当成子路由变量（本例虚报 1；`prefixes` 收集后未参与输出合并，故仅污染该统计字段，不影响 paths）。

### B2 — orchestrator --contract-draft（棕地降级模式）— **PASS（部分，见问题 #3）**

| 用例 | 实测 | exit |
|---|---|---|
| `--contract <B1-draft> --contract-draft <B1-draft>` 同传 | `--contract 与 --contract-draft 互斥：真 OpenAPI 走真校验，棕地草案走降级确认` | 2 |
| `--contract-draft <不存在.json>` | `--contract-draft 文件不存在或非 JSON: ...（ENOENT: ...）` | 2 |
| 正常棕地跑（TEMP/B2/brownfield，--backend prompt） | 规划日志 `contract brownfield (--contract-draft): <draft> — be-validator 不跑真校验，前端可凭草案开工…` | 0 |

棕地跑状态核对（state.json）：
- `plan.brownfield:true`、`plan.contractMode:"brownfield-draft"`、`plan.contractSource:<draft绝对路径>`
- `contracts/<planId>.json` 含 `contractSource:<draft绝对路径>`（freezeContract 落盘确认）
- be-validator subtask：`brownfieldDraft:true` 且 `contract` 指向草案文件（本环境无 exec 宿主，be-validator 同绿地一样因上游 DEP_PRECONDITION skip——该跳过行为棕/绿无差别，非观测点）

前端子任务可开工（对照实验，T1 路由但任务文本含 frontend 触发 FR-3 门）：
- **用例 A 无契约**：`node scripts/orchestrator.mjs --task "frontend database schema page" ...` → 日志 `FR-3 contract gate applied: 1 个前端实现子任务按契约前置（无真实契约，缺契约将 CONTRACT_NOT_FROZEN skip...）`；implementation subtask `skipped (CONTRACT_NOT_FROZEN，contracts/<plan>.frontend-missing.json)`；计划 failed **exit 5**
- **用例 B `--contract-draft <B1-draft.json>`**：日志 `FR-3 contract gate applied: 1 个前端实现子任务按契约前置（棕地草案=...（可开工，待确认后升级））`；implementation subtask `status:done`、`contract:<draft绝对路径>`、`brownfieldDraft:true`、计划 done **exit 0**
- ⇒ 棕地草案确实放行前端实现开工（与绿地缺契约 CONTRACT_NOT_FROZEN skip 形成清晰对照）。

### B3 — contract-discrepancy（差异→handoffs/contract-change-*.md）— **PASS**

自建 reported（TEMP/B3/reported.md）：`GET /api/users`（契约已有）、`GET /api/profile`（契约无）、`POST /api/login`（契约已有）、字段级 `/api/login → {token, expiresIn}`。契约 = B1-draft.json；`--out` 指到 TEMP（不污染 repo handoffs/）。

实测：
```
[contract-discrepancy] 差异 2 条 / 一致 2 条
  [ok] GET /api/users — 契约已存在（一致）
  [missing] GET /api/profile — 契约中不存在此接口（...）
  [ok] POST /api/login — 契约已存在（一致）
  [field] /api/login — 前端期望字段，契约待后端确认
[contract-discrepancy] 变更单: <TEMP>/B3/handoffs/contract-change-verify-b3.md
```
- exit 0；变更单文件可读，含表头 + ok/missing/field 行 + 处置建议 + draft 标注。
- 注：`差异 N` 的口径 = 非 ok（missing+field）计数（2），与「/ 一致 2」相加 = 总 4 条，口径自洽。

### B4 — regression-all 独立重跑 — **PASS**
`node scripts/regression-all.mjs` → **8 PASS / 0 FAIL**：
S1 validate-structure ✓ / S2 test-retry ✓ / S3 Phase2 替换清单全绿 ✓ / S4 契约工作流（冻结+resume+篡改→exit4）✓ / S5 宿主执行 smoke（stdout→exec、写文件→exec、空输出→prompt）✓ / S6 资产缓存 ✓ / S7 review-gate ✓ / S8 资产消费证据（exec=8、仅锚点→false）✓。
与自称一致；S4/S5 参数行为未受 2.9.0 改动影响。

---

## C. 多宿主探测

### C1 — exec-host-probe（只读探测）— **PASS**
`node scripts/exec-host-probe.mjs --json --timeout 8000`：
```
opencode  available:true  version:"1.18.25"
claude    available:true  version:"2.1.261 (Claude Code)"
codex     available:true  version:"codex-cli 0.151.0"
cursor    available:true  version:"3.12.30"
trae      available:true  version:"1.107.1"
openclaw  available:true  version:"OpenClaw 2026.7.1-2 (0790d9f)"
a6api     available:true  (HTTP 200 端点可达)
```
- exit 0；**opencode/claude/codex 3 项 available=true 且 version 非空** ✓
- 只读核对：探测前/后 `~/.claude/settings.json`、`~/.codex/config.toml` 的 SHA256 hash + LastWriteTimeUtc **完全一致**（A4287F6D…F7AF92 / 99817ED0…FAC1B0E8，mtime tick 639241879308176209 / 639241892259280910）→ 零改动。

### C2 — exec-host-generic（通用非交互宿主）— **PASS**
- `--help` → 用法输出，exit 0
- `--cli bogus --brief ...` → `未知宿主 bogus（支持 claude/codex/cursor/trae）`，exit 2
- 缺 `--cli` → `缺少 --cli（claude|codex|cursor|trae）`，exit 2
- 最小真实调用：`node scripts/exec-host-generic.mjs --cli codex --brief <TEMP>/C2-brief.md --timeout 6000` → 6 秒被按时 kill，输出 `[exec-host-generic] codex 执行超时（TIMEOUT 6s）... stderr: OpenAI Codex v0.151.0 ...`，**exit 1，无未捕获异常**（codex 会话横幅显示 sandbox: read-only）。如实 TIMEOUT，符合「codex 真实执行可挂起、脚本本身不得抛未捕获异常」的验收口径。

### C3 — 只读红线 — **PASS**
- 验收全程（A/B/C + regression）未写任何宿主配置；C1 前后 + 全部结束后两次复验均 hash/mtime 一致。
- repo `git status --porcelain` 全程干净（regression S7 自建的 `.tt-state/s7-plan-sample.md` 由脚本自行清理；contract-discrepancy 一律 `--out` 到 TEMP）。

---

## 发现的真实问题

### 问题 #1（B1，次要·启发式）contract-reverse 对 Flask `<type:name>` 转换器归一化残缺
- 复现：含 `@app.route('/api/items/<int:item_id>', methods=['GET'])` 的 Flask 文件 → `node scripts/contract-reverse.mjs --source <dir>`
- 期望：path 归一为 `/api/items/{item_id}`；实际：`/api/items/<int{item_id}>`（`int:` 前缀残留、尖括号未剥，OpenAPI path template 非法字符）
- 影响：该路径无法直接作为真契约 path；下游若按此 draft 开发会有脏 path。修法方向：`normalizePath` 前先对 `<[^:>]+:([^>]+)>` 剥成 `{$1}`。

### 问题 #2（B1，装饰性）`prefixesDetected` 虚报
- 复现：同 #1 的 Flask 文件（无任何 `app.use/app.route(prefix, router)` 调用）
- 期望：`prefixesDetected:0`；实际：`1`——`@app.route('/api/items', methods=['GET'])` 命中 Express 前缀正则 `app\.(?:use|route)\(\s*['"]([^'"]+)['"],\s*([A-Za-z_$][\w$]*)`，把 `methods` 误判为路由变量。`prefixes` 未参与路径合并，故仅该统计字段虚高（本样例 1），不影响 paths 输出。

### 问题 #3（B2，部分验证）「be-validator 不跑真校验」只在 orchestrator 标记层生效，adapter 层未守
- 代码级事实：棕地路径仅设置 `subtask.brownfieldDraft=true` 并把 `subtask.contract` 指向草案文件；而 be-validator 专用 adapter（`lib/adapters/portman.mjs`）**不读 draft:true / brownfieldDraft**，只判 `isOpenApiSpec`（有无 `openapi/swagger` 字段）。contract-reverse 产出的草案**就是** OpenAPI 3（`openapi:"3.0.3"` + `draft:true`），因此一旦 be-validator 子任务在 auto 后端到达派单且本机装了 portman（**本机 portman CLI 确实存在**），会照样 `portman --local` 对未确认草案做真校验——与声称的「待 --contract 升级，不跑真校验」冲突。
- 复现（未全量执行，原因见下）：T2 棕地计划 + auto 后端 + 能让上游全部 done&assetConsumed 的 exec 宿主 → be-validator 派单即触发。
- 期望：草案（draft:true）即使 OpenAPI 形状也应走降级「recorded but not validated」；实际（代码路径推断）：被当作真 OpenAPI 跑 portman。
- 验证范围声明（诚实）：本报告在 --backend prompt 机制模式下观察到此模式 = 通过 prompt adapter 执行、portman 根本不介入，模式/标记均正确；adapter 层的冲突是**代码级确认 + 环境事实（portman 已装）**，未做全量 auto 后端 8 子任务级联实测（auto 后端会触发真实 opencode/bmad/portman 执行，超出本次只读零副作用验收边界）。**该项标为「部分」而非完整 PASS 依据即在此。**

## 与报告声称的差异汇总
1. 「回归 8/8、validate 0」→ 独立重跑 8/8 ✓（validate-structure 即 S1，PASS）。
2. 「棕地 be-validator 不跑真校验」→ 标记/日志层属实；但 adapter 层无 draft 护栏（问题 #3），本环境 portman 已装使其成为真实风险。
3. 「summary-read 空目录 exit 非 0」→ 仅 `--latest` 形态为 exit 1；默认列表/`--all` 对空目录为 exit 0（均有清晰提示/空输出，不崩溃）。
4. 声称外额外发现：B1 Flask 转换器归一缺陷（问题 #1）与 prefixes 虚报（问题 #2）。
5. 未验项（诚实）：未在 auto 后端做含 be-validator 真实派单的全级联棕地端到端；未对 claude/codex 宿主做成功路径真实产出（仅验证参数解析 + TIMEOUT 护栏）。
