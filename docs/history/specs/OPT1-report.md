# OPT1 报告：批判竞品对标真实化 + 批判结果列入后续任务待优化执行项

- 版本：tt 2.7.0 → 2.8.0
- 日期：2026-09-03
- 执行：独立实现子 agent（opencode）
- 回归基线：2.7.0 8/8 PASS、validate 0 泄露

## 一、交付变更

| 文件 | 变更 | 说明 |
|------|------|------|
| `scripts/review-gate.mjs` | 改 | E1：`--verify-urls` URL 真实可达性机验 + `--self-test` 并入 URL 三态自测 |
| `scripts/critique-backlog-next.mjs` | 新增 | E2：读取 tracker「⬜/待落地」C-xx + `docs/history/tasks/critique-<Cxx>-task.md`，输出待优化执行项清单 + 承接命中判定 |
| `templates/kickoff-prompt.md` | 改 | E2：必读「批判追踪」由"如有承接项"改为开工前强制运行 `critique-backlog-next.mjs` 拉取待落地 C-xx |
| `templates/completion-report.md` | 改 | E2：新增硬约束「批判承接核对」段（HIT C-xx 列证据，未完成 ❌ 不予 DONE；HIT_NONE 写"无承接项"） |
| `templates/critique.md` | 改 | E3：竞品对标列强调真实可达 URL + `--verify-urls` 提交前自验 + 禁止编造 |
| `SKILL.md` | 改 | §5.6 加第 4 条（开工前强制拉取 backlog）；§7 加 URL 真实化机验说明；附 A 变量清单加 `$TT_HTTP_PROXY`；version → 2.8.0 |

### E1 URL 真实性校验（机器验证）

- 入口 `--verify-urls`（可与 `--dir/--id` 或 `--auto-register` 组合）。不带该参数行为与 2.7.0 完全一致（回归不破，已实测）。
- 探测：Node `http/https` 直连 GET，默认 8s 超时、跟随 301/302/303/307/308（最多 4 跳）。判定：2xx/3xx 无 Location → `PASS`；404/403/5xx/超时/网络错误 → `FAIL`（标注 `URL_UNVERIFIED`）；**全部** URL 均网络层失败（DNS/拒绝/超时）→ 整网不可用 → 每行诚实标 `VERIFY_SKIPPED`，不误杀也不假装验证过。
- 同 URL 去重只探一次，但按条目计数（reachable/unreachable 以条目为准）。
- 逐 URL 输出状态 + 实际状态码；汇总 `有效 N 条：真实对标可达 X / 无效 Y`。有效批判中存在 FAIL → 该条批判不计有效，`--verify-urls` 常规路径 exit 1（拦截引假 URL）；`--auto-register` 路径只登记不阻断（登记动作本身已成功）。
- 代理：`TT_HTTP_PROXY` 优先，缺省回退 `HTTPS_PROXY`/`HTTP_PROXY`。HTTP 目标走代理转发；HTTPS 目标走 CONNECT 隧道 + `tls.connect` 再在已加密 socket 上发 GET（实测本机经 `127.0.0.1:7897`：example.com/api.github.com 均 200）。
- `effectiveProxy/probeUrl/verifyUrls/verifyCritiqueUrls/summarizeVerification/selfTestUrlVerify` 均 export，可 import 复用（顶层 `main()` 仅在 CLI 直跑时执行；CLI 直跑显式 `process.exit` 规避 Windows 上死端口探测遗留 libuv 幽灵 socket 导致的事件循环不退出）。

### E2 批判反哺 → 后续任务待优化执行项

- `critique-backlog-next.mjs` 读取 tracker 全部表块（按表头列名对齐，兼容现状多张「子表」风格）：
  - 默认只列待落地（状态以 ⬜/◐ 开头或含"待落地/待复验"；✅/❌ 开头视为闭环）——实测 14 行 tracker 只列 C-10/C-11/C-12。
  - 每行带：C-xx 序号、级别、状态、落点列内容、`docs/history/tasks/critique-<Cxx>-task.md` 任务文档路径（缺失时如实标注"critique-<Cxx>-task.md 缺失——未生成或未同步，先跑 review-gate --auto-register"）。
  - `--task "<关键词>"`/`--task-doc <taskNN.md>` 传入时做落点重叠判定 → `承接判定: HIT C-xx`（完工报告须列证据）或 `HIT_NONE`（写"无承接项"）；不传时输出全量清单供开工 prompt 比对。
  - 中文匹配按 2-4 字窗口 token + 停用词过滤；C-12「今后所有实现都必须先试派单（task/claude/codex/openclaw）…」这类记叙型落点仅按括号内实体（task/claude/codex/openclaw）精确命中，避免"实现/派单/降级"万能承接。
- `kickoff-prompt.md`「批判追踪」改为强制：开工前 `node $SKILL_DIR/scripts/critique-backlog-next.mjs --task "<本任务关键词>"`（或 `--task-doc`）；HIT = 承接项，报告列证据；HIT_NONE = 无承接项。
- `completion-report.md` 新增硬约束「批判承接核对」段：HIT C-xx 逐条列完成证据、未完成标 ❌ → 不予 DONE；HIT_NONE/NO_ITEMS 如实写"无承接项"，禁止略过。

### E3 批判文档模板真实对标引导

- `templates/critique.md` 表头列与引导注明：URL 必须是**真实可达**的竞品仓库/文档/论文/官网；提交前跑 `node scripts/review-gate.mjs --dir <产物目录> --id <taskNN> --verify-urls` 机验；禁止编造不存在的 URL；代理示例 `$env:TT_HTTP_PROXY`。

## 二、实测

### URL 三态实测（临时 HTTP server + 死端口）
```
TRUE-URL  total=2 reachable=2 unreachable=0 networkOk=true  allPass=true   → PASS(200)
FAKE-URL  total=2 reachable=0 unreachable=2 networkOk=true  allPass=false  → FAIL(HTTP 404) URL_UNVERIFIED
OFFLINE   total=2 reachable=0 networkOk=false allPass=false → VERIFY_SKIPPED(网络不可用: refused/ECONNREFUSED)
```
（以上为 real-run 直接调用 `verifyCritiqueUrls` 的输出；`--self-test` 内嵌同构三态断言。）

### 真网端到端
- 3 条批判（github.com/anomalyco/opencode、opencode.ai/docs 均真 + opencode.ai 下不存在路径）→ `--verify-urls`：
```
PASS https://github.com/anomalyco/opencode (200)
PASS https://opencode.ai/docs (200)
FAIL https://opencode.ai/this-does-not-exist-xyz (notfound/HTTP 404) → URL_UNVERIFIED
[FAIL] … 存在不可达竞品 URL（URL_UNVERIFIED）… exit 1
```
- 换成全真 URL 重跑 → `[OK] …竞品 URL 全部真实可达（PASS 3/3）exit 0`。

### backlog-next 实测
- 真实仓库 tracker（14 行）：默认 `⬜ 待落地` 只列 C-10/C-11/C-12；`--task "codex CLI 宿主"` → `HIT C-10`；`--task "sdk 依赖 metagpt"` → `HIT C-11`；`--task "login 后端"` → `HIT_NONE`。
- 临时 tracker 含 `C-01 ⬜ 待落地`（落点=review-gate url 校验）+ 对应 `docs/history/tasks/critique-C-01-task.md` → 输出含该 C-01 且任务文档路径正确、承接命中。✓

### 回归
- `node scripts/review-gate.mjs --self-test` → PASS（核心断言 + URL 三态）
- `node scripts/regression-all.mjs` → **8/8 PASS**（S7 review-gate self-test 含新 URL 三态子项）
- `node scripts/validate-structure.mjs` → [OK] 0 项错误（含可移植性、U+FFFD）
- `node scripts/ci.mjs` → CI PASS（S5 资产质量评分 exit 1 为既有信息项，不阻断）
- 不带 `--verify-urls` 的 review-gate 路径行为与 2.7.0 一致（格式闸门 + tracker 校验，实测仍拦截/放行正确）。

## 三、诚实标注（局限）

1. URL 真验是"可达性"验证，非"内容真实性/是否真为该竞品"语义验证——引一个可达但不相关的 URL 仍会 PASS。模板 + SKILL §7 已要求批判者为真实对标负责；`--verify-urls` 负责挡住"编造不可达 URL"这一半。
2. 探测为 GET 全量拉取后即断（非 HEAD），对少数拒绝 GET 的站点会误 FAIL；已跟随重定向 + 将 2xx/3xx 视为可达以缓释。URL 含尾随标点（。，) 等）会先清洗再探。
3. `--auto-register` 与 `--verify-urls` 组合时，URL FAIL 不阻断登记（登记本身成功）；需阻断时用常规路径 `--dir --id --verify-urls`。
4. Windows 上对死端口的探测会遗留 libuv 幽灵 socket 句柄（Node 已知行为），CLI 已用显式 `process.exit` 规避；结果与退出码不受影响。
5. 本机默认有 HTTP(S)_PROXY 指向 127.0.0.1:7897。review-gate 会回退读该代理走 CONNECT 隧道（实测正确）；如某环境不希望走代理，设 `TT_HTTP_PROXY=` 置空即可忽略回退（探测强制直连由 `proxy:null` 调用方保证，self-test 内已强制直连不依赖环境）。
