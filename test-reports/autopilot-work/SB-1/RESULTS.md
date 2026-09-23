# SB-1 RESULTS.md — 阶段盲测制度（批 0）执行证据

执行 agent：SB-1 L1（独立上下文，**重派后接手中断现场继续**）；日期：2026-09-23。
派单：`handoffs/v3/SB-1-dispatch.md`；上下文：`plans/execution-plan-v3-20260923.md` §四 SB-1 与 §五。
**状态：脚本/CLI 全套/状态机/看板/自测证据/回归全部完成——等待编排者 L2 复核，不自称 DONE。**

---

## 0. 接手现状（重派指令要求如实登记）

接手时 `scripts/blindqueue.mjs` 已存在（上一 agent 中断前的半成品，`git status` 为 untracked）。
逐项核对结果：

| 接手时状态 | 处置 |
|---|---|
| 文件语法可过 `node --check`，但 `--self-test` FAIL（`未知 qid: Q1`） | 修复（见下） |
| **隐性 bug**：`normalizeStageFromText` 的正则 `\s*\n\s*` 因 `\s` 吞换行，匹配不到 `- schema` 行之后的 `- stage:` 行，恒回落 `stage-1` → 任何非 stage-1 队列在首次 freeze/fill 写回时 **stage 行被覆写为 stage-1**（多队列互串，实测复现：stage-2 队列 freeze 后文件内 stage 变 stage-1） | 修复：正则改为 `/^# 阶段盲测队列\n[\s\S]*?\n- stage: ([^\n]+)/m`，实测 stage-2/stage-3 队列 freeze 后 stage 行不再漂移（证据：board-samples.txt 三队列互不串扰） |
| `--fill <qid>` 位置式与 `--init/--freeze/--view/--board <stage>` 位置式参数解析不完整（`--init 1` 报「需要 --stage」） | 修复：parseArgv 位置式参数补齐，dispatch CLI 口径（`--init <stage>`）可用，兼容 `--stage <stage-N>` |
| 状态机流转表骨架在，但 fill 分支遗漏/矛盾：`built→passed` 被静默放过、终态锁不完整 | 重写 fillQueue：以 `TRANSITIONS`（pending→built→hidden→{passed,failed,waived}）为唯一事实源，`canTransition` 统一判定 |
| waived 留痕（--reason 必填）已有雏形但缺「waived 限 CONCERNS 级」约束 | 补齐：队列存在 failed 条目（FAIL 口径）时拒绝 waiver 逃生，具名报错 |
| 冻结闸门只有一行 `queue.frozen` 检查，把冻结后的合法「裁决回写」也一并拒绝 | 重写：冻结后仅放行 hidden→终态裁决回写（盲行结果落账），新建/元数据修改/其余流转一律拒绝（fail-closed 具名） |
| 看板已有但空队列判 PASS（无证据即放行，违反 fail-closed） | 修正：空队列裁决「—」且阻塞下游；裁决口径改为 BMAD TEA 四态优先级 FAIL＞WAIVED＞CONCERNS＞PASS，只有 PASS 不阻塞 |

已完成且正确、未重做的部分：markdown 表转义/解析（escapeCell/splitMarkdownRow）、O_EXCL 文件锁 + 30s stale 自愈、原子写（tmp+rename）、六列 schema 落盘格式、`--protocol` 文本骨架。

## A. 交付物（白名单内，零越界）

| 文件 | 性质 | 内容 |
|---|---|---|
| `scripts/blindqueue.mjs` | 白名单内重写/修复 | 盲测队列 schema + 状态机 + 冻结 + 双视图 + 看板 + 协议 + self-test（CLI 完整） |
| `test-reports/autopilot-work/SB-1/` | 新建目录 | self-test.txt / e2e-lifecycle.txt / board-samples.txt / regression.txt / validate-structure.txt / RESULTS.md |

**白名单外改动：无。** `tt-journey.mjs` 未触碰（工作区中其 M 状态改动来自并行的 RG-1 agent，diff 头部 RG-1 注释可证）；`regression-all.mjs` 的 M 状态改动同为他人（S3 文案），本 agent 零改动；未跑任何 BFX/FE 历史回归目录；无 git 操作。

## B. 六列 schema 与状态机

- 文件：`<workspace>/.tt-state/stage-N-blindqueue.md`（markdown 表，六列）
  `| qid | 来源task | 覆盖功能点 | 验证方法(步骤+期望) | hidden | 状态 |`，另含 schema/stage/frozen 时间戳元数据行与「决策与留痕」段（qid/裁决/理由/时间）。
- 状态机（fail-closed）：`pending → built → hidden → passed|failed|waived`；
  - 终态（passed/failed/waived）不可回填（具名 FAIL）；
  - `built→waived` 等跳过 hidden 裁决段的流转拒绝；
  - **waived 限 CONCERNS 级**：队列存在 failed 条目（FAIL 口径）时拒绝 waiver 逃生（具名「非法状态路径: waived 限 CONCERNS 级」）；waive 必须附 `--reason`，落「决策与留痕」段。
- 冻结（--freeze）：要求全部条目 built，冻结时全部置 hidden、`frozen: true` 落盘；此后 `--fill` 拒绝新建与元数据修改，仅放行 hidden→终态裁决回写。

## C. CLI（全套）

```
node scripts/blindqueue.mjs --init <stage>
node scripts/blindqueue.mjs --fill <qid> --stage <stage-N> --source-task <t> --feature <f> --verification <v> [--hidden] [--status ...] [--reason ...]
node scripts/blindqueue.mjs --freeze <stage>
node scripts/blindqueue.mjs --view <stage> [--blind]
node scripts/blindqueue.mjs --board <stage>
node scripts/blindqueue.mjs --protocol     # 角色切换流程文档（任务 C）
node scripts/blindqueue.mjs --self-test
```
退出码：0 成功 / 1 self-test 失败 / 2 用法或运行错误（fail-closed）。stage 位置式（`--init 1`）与 `--stage stage-1` 均可。

## D. hidden 保密口径（如实声明）

**hidden 保密在单会话无进程隔离下是纪律级保证，非硬隔离。** 实现为导出/读取 API 的过滤：`--view --blind` 视图中 hidden=true 条目的「覆盖功能点/验证方法」以 `—` 掩蔽（仅 qid/来源 task 可见），hidden=false 条目细节照常可见；完整视图（编排者/验收者）不受限。队列原文（含 hidden 细节）完整落盘在同一工作区，拥有文件读取权限的实现 agent 仍可能直读原文——与派单预期一致（「实现为导出/读取 API 上的过滤」），已在 `--protocol` 输出与下述证据中显式声明，不宣称进程级隔离。

## E. 自测证据（逐条对应派单 §自测）

### E1. 全生命周期（证据：e2e-lifecycle.txt，12 步全留痕）

- `--init 1` 生成队列（EXIT=0）；Q1（公开）/Q2/Q3（hidden）`--fill` 创建 built；
- 完整视图 vs blind 视图 diff：**Q2/Q3 的功能点与验证方法在 blind 视图为 `—`，完整视图可见**（掩蔽生效，公开条目不受影响）；
- `--freeze` 全部置 hidden + frozen=true；冻结后新建 Q4 → exit 2 具名拒绝；冻结后改元数据 → exit 2 具名拒绝；冻结后裁决回写（passed/failed）放行；
- 看板：`| stage-1 | 3 | 100.0% | 50.0% | task-A | FAIL | 是 |`（fail 归属正确落在 task-A）。
- 状态机合法路径：pending→built→hidden→passed/failed/waived 全走通；非法路径：`built→waived`（跳过 hidden）拒绝、终态再写拒绝（self-test.txt 第 8/9/10/12 项）、waive 无 `--reason` 拒绝。

### E2. 冻结防篡改（证据：e2e-lifecycle.txt 第 7-9 步；self-test.txt 第 19-21 项）

- 冻结后 `--fill` 新建/改元数据/改状态均 exit 2 具名拒绝；文件 `frozen: true` 落盘；仅 hidden→终态裁决回写放行（盲行结果落账语义）。

### E3. 看板统计（证据：board-samples.txt，3 条目样本）

- 3 条目（1 passed/1 failed/1 未收口）样本：各计数正确，**fail 归属 task-Q 正确**；blank 队列判「—」阻塞；
- CONCERNS（全 hidden 未裁决）→ FAIL（出现 failed）→ WAIVED（合法 waive 后）→ PASS（全绿）四态全样本覆盖；**只有 PASS 不阻塞下游**（`| PASS | 否 |`）；
- FAIL 口径下 waiver 逃生被拒（exit 2 具名）；waive 留痕落「决策与留痕」段（文件 grep 实证）。

### E4. 回归（证据：regression.txt / validate-structure.txt）

- `node scripts/regression-all.mjs` → **13 PASS / 0 FAIL**，REGRESSION_EXIT=0（S7 review-gate 段真跑 PASS）；
- `node scripts/validate-structure.mjs` → **[OK] 结构校验通过（0 项警告）**，VALIDATE_EXIT=0；
- 新脚本不挂任何既有回归段（本批不改 regression-all.mjs / tt-journey.mjs，挂点由编排者批 2 收口）。

### E5. self-test 总入口

`node scripts/blindqueue.mjs --self-test` → **24 项断言全 PASS，EXIT=0**（覆盖 E1/E2/E3 全部语义 + init 幂等拒绝 + 缺元数据拒绝 + 多 stage 隔离）。

## F. D-xxx 偏差登记

- **D-SB1-1（接手修复）**：上一 agent 半成品的 stage 解析正则缺陷（多队列 stage 行互串）与 CLI 位置式参数缺陷，本 agent 修复；修复方式与证据见 §0。
- **D-SB1-2（口径取舍）**：派单「hidden=true 条目的验证细节对实现 agent 不可见」在单会话内实现为 `--view --blind` 导出过滤（派单同条已认可此实现方式）；保密强度为纪律级保证非硬隔离（§D 如实声明）。
- **D-SB1-3（口径取舍）**：看板裁决四态优先级取 FAIL＞WAIVED＞CONCERNS＞PASS（BMAD TEA：存在 fail 即 FAIL，waive 是 CONCERNS 级的显式收口而非 PASS 等价物）；空队列无证据判「—」并阻塞，防「未建队列即解锁下游」。
- **D-SB1-4（接线延后）**：`--prereq-check` / journey 挂点未接线（派单约束禁改 tt-journey.mjs，RG-1 并行占用写面）；挂点由编排者批 2 收口统一接线，已在 --protocol 输出中登记。
- **D-SB1-5（协议承载）**：角色切换流程以 `--protocol` CLI 输出承载（派单给的两个选项之一），未另建文档文件。

## G. 验收要点对照（供编排者 L2 复核）

| 派单验收要点 | 状态 |
|---|---|
| 状态机 fail-closed | ✔ 非法流转/终态锁/越级 waive/冻结后篡改全部具名拒绝（exit 2） |
| blind 视图真过滤 | ✔ hidden 条目细节掩蔽、公开条目保留（e2e 第 5/6 步 diff 可证） |
| 冻结防篡改 | ✔ frozen 落盘 + 新建/元数据/状态篡改三向拒绝，裁决回写白名单放行 |
| 看板四态裁决 | ✔ PASS/CONCERNS/FAIL/WAIVED 样本齐全，fail 归属、阻塞标志正确 |
| 回归全绿 | ✔ regression 13/13 + validate 0 警告（证据落盘） |
