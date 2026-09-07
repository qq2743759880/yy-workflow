# T7 Report — --contract 提供 OpenAPI 契约源，be-validator 真跑 portman

- 日期：2026-09-01
- 执行方：TT 工作流独立实现子 agent
- 版本：TT 2.2.6（工作树含本次改动 + 并发 T8 未提交改动，见 §5 诚实声明）
- 目标：orchestrator 支持 `--contract <openapi.json>`，plan 中 be-validator 子任务契约指向该 OpenAPI 文件，使 portman.mjs 走真校验路径（不再对描述字符串/冻结文件诚实降级）。

## 1. 改动 diff（最小改动）

### 1.1 `scripts/orchestrator.mjs`（+23 −6）

| 位置 | 改动 |
|------|------|
| `parseArgs` 初值 | `out` 增 `contract: null` |
| `parseArgs` 分支 | 新增 `--contract <path>` 取值分支（无值/下一项是 `--` 时报 `--contract 需要一个值`） |
| `--exec` 透传 KNOWN 集 | 加入 `--contract`，保证 `--exec ... --contract x` 正确结束透传段、不被吞进宿主参数 |
| `usage()` | Usage 行加 `[--contract OPENAPI.json]` |
| `freezeContract` | 增第三参 `contractSource`；冻结文件 `contracts/<planId>.json` 增 `contractSource: <openapi路径>` 字段（仅当提供 --contract 时） |
| `main()`（workspace 解析后） | `--contract` 文件必须存在：相对路径按 workspace 解析，缺失 → `--contract 文件不存在: <path>（已解析为 <abs>）` 并 `exit 2`，不静默降级 |
| `main()`（buildPlan 后） | `--contract` 时把 `asset === 'be-validator'` 子任务的 `contract` 改写为该 OpenAPI 路径，其他子任务保持 `cluster.contract` 描述不变；命中时 `logger.info('contract override (--contract): <id> -> <path>')` |
| `main()`（冻结循环后） | 非 dry-run 冻结后**重写 be-validator**：`contract` 指向 OpenAPI 文件（冻结文件仍写入含 `contractSource`；gate json hash 比对该 OpenAPI 本体，防执行期篡改，行为与既有 json gate 语义一致） |

> 设计说明（诚实记录一个取舍）：任务书要求「gate hash 比对的仍是冻结文件本体」且「be-validator 契约指向 OpenAPI 文件」。二者在现状实现里不可兼得——gate 读取的就是 `subtask.contract` 指向的文件。本实现选择：**be-validator 的 gate hash 比对 OpenAPI 本体**（比描述字符串/冻结文件更强的篡改防护），冻结文件仍写入（含 `contractSource` 溯源），其他子任务契约不变、gate 行为逐字节不变。详见 §5。

### 1.2 `README.md`（+1）

编排器用法段 `--exec` 行旁新增：

```bash
node scripts/orchestrator.mjs --task "..." --contract ./openapi.json            # 提供 OpenAPI 契约：be-validator 真跑 portman 校验（契约本体以该文件为准，冻结文件记录 contractSource）
```

### 1.3 未改动文件（验收确认）

`scripts/lib/gate.mjs`、`scripts/lib/adapters/portman.mjs`、`scripts/lib/planner.mjs`、`config.example.json` 均未改动（git status 为空）。

## 2. OpenAPI 样例

`docs/examples/openapi-login.sample.json`（最小 OpenAPI 3.0.3：`openapi` 字段 + `info` + 1 个 path `POST /auth/login` + `components.schemas` LoginRequest/LoginResponse）。同时作为回归样例永久保留在仓库 `docs/examples/`。

## 3. 实测输出

### 3.1 验收①：dry-run 下 be-validator 契约指向样例（exit 0）

```
node scripts/orchestrator.mjs --task "实现后端登录模块" --contract docs/examples/openapi-login.sample.json --dry-run --verbose
[tt] contract override (--contract): plan-mtinlbtx-7 -> docs/examples/openapi-login.sample.json
[tt] plan plan-mtinlbtx cluster=T2_BACKEND subtasks=8
[dry-run] 将执行 be-validator
[tt] dry-run complete
```

### 3.2 验收②：缺 --contract 行为不变（exit 0）

```
[tt] plan plan-mtinliwk cluster=T2_BACKEND subtasks=8   ← 无 contract override 行
```

be-validator 仍为描述字符串 `backend interface and error contract` → portman.mjs 诚实降级（既有路径，未改）。

### 3.3 验收③：--contract 指向不存在文件 → exit 2

```
--contract 文件不存在: docs/examples/nope.json（已解析为 D:\.ai-hub\skills\tt\docs\examples\nope.json）
EXIT=2
```

### 3.4 验收⑤：真跑 portman（本机 1.35.0），be-validator mode=exec、pass=true

```
node scripts/orchestrator.mjs --task "ops deploy monitor contract" --workspace <tmp> --contract <abs样例> --backend cli
[tt] contract override (--contract): plan-mtinmgyv-3 -> D:\.ai-hub\skills\tt\docs\examples\openapi-login.sample.json
[tt] plan plan-mtinmgyv cluster=T5_OPS subtasks=5
[tt] state: done        ← EXIT=0
```

`artifacts/<id>/contract-result.json`：

```json
{
  "pass": true,
  "diff": null,
  "checkedAt": "2026-09-01T12:39:33.650Z",
  "tool": "portman",
  "version": "1.35.0",
  "mode": "exec",
  "scope": "real portman 1.35.0 --local lint/collection against D:\\.ai-hub\\skills\\tt\\docs\\examples\\openapi-login.sample.json"
}
```

`collection.json` 真实生成（Postman collection，item `用户登录`）；`result.txt` 为 portman `--local` stdout（`Collection written to ...`）。

冻结文件（含 `contractSource`，gate 可溯源）：

```json
{
  "planId": "plan-mtinls5g",
  "cluster": "T2_BACKEND",
  "contract": "backend interface and error contract",
  "task": "backend login module",
  "frozenAt": "2026-09-01T12:38:56.453Z",
  "contractSource": "D:\\.ai-hub\\skills\\tt\\docs\\examples\\openapi-login.sample.json"
}
```

### 3.5 降级对照：真实运行缺 --contract（be-validator 对冻结文件诚实降级）

`contract-result.json`：`pass: null, degraded: true, diff: "contract file is JSON but not an OpenAPI spec (missing openapi/swagger field, e.g. a freeze file); ..."`；冻结文件无 `contractSource` 字段。行为与改动前一致。

> 注意：3.4 用 `--task "ops deploy monitor contract"`（T5_OPS 簇）绕开了 opencode 专用 adapter——T2 簇的 `implementation` 子任务会真跑 opencode CLI（见 §5 环境故障），故真跑 portman 用不涉 opencode 的簇验证。

## 4. 回归结果

```
node scripts/validate-structure.mjs → [OK] 结构校验通过 (0 项警告), exit 0
node scripts/regression-all.mjs     → 5 PASS / 3 FAIL (exit 1)
  PASS S1 validate-structure
  PASS S2 test-retry
  PASS S3 Phase 2 替换清单（be-validator [adapter 已接线][kernel 段][probe][marker OK]）
  FAIL S4 契约工作流 smoke   ← 见 §5
  FAIL S5 宿主执行 smoke     ← 见 §5
  PASS S6 资产缓存 smoke
  PASS S7 review-gate
  FAIL S8 资产消费证据       ← 见 §5
```

## 5. 诚实声明（不夸大，含共享工作区冲突）

1. **回归 8/8 未达成，且已证明与本次改动无关**：S4/S5/S8 全部走 `--task "backend login module"`（T2 簇默认 auto 后端），其 `implementation` 子任务命中 opencode 专用 adapter。**并发子 agent（T8）未提交地修改了 `scripts/lib/adapters/opencode.mjs`**（裸 `opencode <msg>` → `opencode run <msg>`，会真调模型），而 opencode 的模型上游（gpt-5.6-luna 代理）当前持续返回 `上游服务暂时不可用`（第三方故障，多次重试均失败，request_id 逐次不同）。该子任务硬失败 → plan failed → exit 5 → S4/S5/S8 断言失败。
   - **决定性证据**：`git stash push scripts/orchestrator.mjs README.md` 后（工作树回到无本次改动的状态，仅剩 T8 的 opencode.mjs 改动）重跑 `regression-all.mjs`，结果**逐字节相同**：`5 PASS / 3 FAIL`（S4/S5/S8）。即失败完全由并发 T8 改动 + 第三方上游故障引起，本次改动对其零影响。
   - 待 opencode 上游恢复（或 T8 收敛其 adapter 改动）后，回归预期回 8/8；本改动不触碰 opencode/runtime/gate/portman 任何执行路径。
2. **gate hash 目标的设计取舍**（见 §1.1）：任务书原文「gate hash 比对的仍是冻结文件本体」与「be-validator 契约指向 OpenAPI 文件」在现状 gate 实现（读 `subtask.contract`）下不可同时成立。本实现让 be-validator 的 gate 比对 **OpenAPI 本体**——若执行期该文件被篡改/删除 → exit 4（防篡改能力比描述字符串/冻结文件更强）；其余子任务契约与 gate 行为逐字节不变。若编排者更希望 gate 一律比对冻结文件，可改为主流程把 be-validator 的 `contract` 指向 OpenAPI、另存一份 contractSource 供 portman 读取——这需要改 portman.mjs（任务书明确要求不改），故未采用。
3. 干跑/真跑/错误路径三类验收均在本机实测通过（§3）；portman 1.35.0 真实执行并产出 Postman collection，非 mock。
4. 共享工作区并发注意：本任务期间工作树两次被并发进程回滚/覆盖（orchestrator.mjs 曾被还原到 HEAD），已重新应用并二次核验；`CHANGELOG.md` 的 -131 行与 `opencode.mjs` 改动均为 T8 并发改动，非本任务产物，未提交。
