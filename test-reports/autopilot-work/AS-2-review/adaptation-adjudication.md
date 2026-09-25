# AS-2-review — adapt（而非 replace）裁定材料

> 提交对象：编排者 / Owner（裁定权不在 L1）｜日期：2026-09-25
> 依据：handoffs/v3/AS-2-review-dispatch.md §⚠（NO INSTALL 预声明分支）+ plans/asset-migration-playbook.md §四 Failure Rule 3 + contracts/asset-migration.md §一
> 配套证据：step2-no-install-record.md（探测全录）+ migration-record.json（机读记录）

## 一、裁定问题

review 资产是否由 review(prompt-backend) replace 为 review(bugbot-engine) 或 review(coderabbit)？

## 二、探测结论（两候选均 NO INSTALL，Failure Rule 3）

| 候选 | official_source | install_channel | runtime_test | 裁定 |
|---|---|---|---|---|
| review-bugbot（宿主技能） | 缺（本地技能文件，非安装资产） | 缺（宿主托管） | **不可行**——目录仅 SKILL.md 一个文件，零可执行入口；引擎本体=宿主子代理（subagent_type: bugbot），非进程 | NO INSTALL |
| CodeRabbit CLI | 在（github:coderabbitai/* org 实证） | **缺**——`@coderabbitai/cli` registry E404 未发布；仅第三方个人 wrapper（npm 假包教训禁用） | 不可行（未安装；SaaS auth 门为第二独立阻断） | NO INSTALL |

## 三、为何不能"凑"replace

1. **无引擎即无影子跑**：SHADOW 前置 = 影子跑夹具就位（契约 §一 ACTIVE→SHADOW），影子跑需要新引擎对同 fixture 真实执行。两候选无可执行入口 → 转移条件结构性不满足，非流程性缺失。
2. **自研 wrapper = 假接入**：把 SKILL.md 指令或 prompt 逻辑包装成"引擎输出"违反派单明令（"禁止为凑 replace 而自研 wrapper 假装接入"）与 Failure Rule 3 精神（package name ≠ capability 的技能版）。
3. **旧路径无回滚面变化**：review 从未有专用 adapter（baseline: adapter=prompt，PROMPT_ADAPTER 回落），本单零生产写面 → 不存在"回滚演练/EXPLICIT_COMPAT_MODE 门/Gate-1/2"的适用对象。

## 四、现状盘点（adapt 后的事实基线）

- review 保留 prompt-backend：CLUSTERS T2_BACKEND/T4_FRONTEND/T5_OPS、S8 链内消费、BW 提及——与 Gate-0 baseline（asset-baseline-before.json#review，snapshot 2026-09-24T08:45:39Z）逐面一致，零漂移。
- vendor/review/SKILL.md 头部已声明执行内核（qodo-ai/pr-agent + continuedev/continue）与**降级语义**（"外部内核缺失 → 用 reference/critique.md + agents/be-tester.md 内置流程，不假报已用外部内核"）——review 的方法论面本就内建了"无外部引擎时诚实降级"的契约，adapt 与 vendor 既有语义一致。
- 代价（Owner 应知悉，如实登记）：管线维持**无机器可验 review 引擎**状态，review 停留 EA-1"提及"级；本次两候选的差距属**生态面缺失**（宿主子代理不可 spawn / 官方 CLI 未发布），非我方可安装修复。

## 五、供裁定选项

- **选项 1（本材料推荐，派单口径）**：review 保留 prompt-backend（adapt 终局），本单以 ADAPT 裁定关账；无需后续动作。
- **选项 2（可与选项 1 叠加）**：采纳下方附录 A 宿主技能绑定文档化草案——将"review 的交互宿主侧增强路径 = /review-bugbot 技能"记录为正式文档（落 docs/ 或其他永久位需 Owner 另行授权，不在本单白名单内）。
- **选项 3（未来再评估触发器，非现在动作）**：出现下列任一事实时，可发新派单重走 NO INSTALL 探测（Step 1 起全 wizard）：
  - 宿主侧为 bugbot 子代理提供可 spawn 的 CLI 入口（`<cli> --version` 形态）；或
  - `@coderabbitai/cli` 在 npm registry 发布，且 SaaS auth 已由 AS-0 级流程确认可用；或
  - 出现其他官方、可安装、可运行时验证的 review 引擎候选。
  届时按 supersede-not-delete 以新 change 单取代本记录，本单证据仍可回查。

## 六、L1 已做 / 未做边界（收口自证）

- 已做：Gate-0 baseline 行四面核对；preflight 8/0/0；两候选三件套探测全录（3 份原始输出留档）；migration-record.json（ACTIVE 态 + NO INSTALL verdict）；本裁定材料；收口回归三件零漂移留档。
- 未做（按令）：**未**创建 scripts/lib/adapters/review-bugbot.mjs 或 review-coderabbit.mjs（无引擎可驱动，创建即假接入）；**未**动 index.mjs / review.yaml / asset-manifest-v2.json（hash 现值 d9f0d738… 不变）；**未**创建 change.record（CONTRACT 类归 L2/编排者——若 Owner 采纳选项 1/2，由 L2 按需补立）；**未**自研任何 wrapper。

## 附录 A：宿主技能绑定文档化草案（选项 2 素材）

> 草案位（本单证据目录）；正式化落位与措辞定稿归 Owner。

**review 资产的宿主技能绑定（草案 v1，2026-09-25）**

- 绑定对象：宿主技能 `review-bugbot`（`C:\Users\Administrator\.agents\skills\review-bugbot\SKILL.md`，frontmatter: name=review-bugbot）。
- 触发形态：交互宿主会话中用户请求 `/review-bugbot`；技能指示宿主启动唯一 `bugbot` 子代理（run_in_background=false），按固定 prompt 形态（Full Repository Path / Diff / 可选 Base Branch / Change Description / Custom Instructions）执行分支或未提交变更评审，产出按 Severity 排序的 findings 表（Severity / Location file:line / Finding）。
- 适用面：**交互宿主侧**（有人在场、git 仓库、宿主具备 bugbot 子代理类型时）。属 review 资产的人工增强路径，不进入管线 adapter 注册表。
- 非适用面（显式边界）：管线自动执行（orchestrator dispatch / regression / S8 链）**不消费**该技能——管线 adapter 契约要求可 spawn 进程 + exit code + 机器可读输出，宿主子代理机制不满足；review 在管线内继续走 prompt-backend 内置流程（reference/critique.md + agents/be-tester.md），按 vendor 头部降级语义诚实标注，不假报已用 bugbot。
- 维护口径：该绑定为文档事实（非注册事实）——若宿主侧 bugbot 入口形态变化或技能文件变更，由文档维护流程同步；本草案基于 2026-08-24 版 SKILL.md（4902B）实测读取。
