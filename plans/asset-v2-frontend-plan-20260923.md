# Asset Manifest v2 + 前端接线 + 16 资产评估 方案（2026-09-23，v1 待 Owner 拍板）

> 输入：Owner 三需求（journey 输入入口 / 资产卡内容补全 / 16 资产效果评估+竞品替代）+ 外部迭代方案的采纳裁定
> （Asset Manifest v2 三字段采纳、lessons.md 工作区级半采纳；Brain/事件总线/全局记忆已拒）。
> 前置实测事实（编排者 2026-09-23 亲测）：
> - 16 资产 = CLUSTERS 5 簇 candidates 去重：be-architect / implementation / be-validator / be-provider / sdlc / be-resilience / security / review / frontend-design / frontend-visual-validation / agent-vision-toolkit / colorize / planning / agent-research / dev-planner / skill-sentinel
> - `webview/journey/content.js` 资产卡现状：仅 name + 截断英文 description（有截半词）+ cluster + `stages: []` 全空——用法/Prompt 从未填充（Owner 需求 2 的实测根因）
> - `scripts/lib/matrix.mjs` 路由靠关键词（T3-04 A6 词汇缺口在册）；`scripts/lib/activation.mjs` / `asset-call-rate.mjs` / `asset-io-report.mjs` 已存在
> - S8 断言 = 锚点+内核词双断言（`regression-all.mjs`），正向 exec 全 consumed / 负向仅锚点判 false
> - 4 个 BW 工作区（project-run-0922*）是现成的真实消费数据集；BW-3 模糊 prompt 场景可复测
> - host-bridge 现状：`tt-journey --read/--project` 注入 + servePage 静态回注，**无写通道**；页面 nextPrompt 复制是唯一"动作桥"

## 一、任务总览（四个工作流，依赖关系标明）

| id | 任务 | 写面 | 依赖 | 验收要点 |
|---|---|---|---|---|
| **AV-1** | change.record：Asset Manifest v2 schema（when_to_use / when_not_to_use / verification 三字段） | contracts/change 单 + `scripts/build-guide-content.mjs`（提取） | Owner 拍板本方案 | 契约走冻结流程，change 单含 schema 定义与迁移说明 |
| **AV-2** | Manifest 生成器：从 16 资产源文档头部结构化区提取三字段 → `contracts/asset-manifest-v2.json` + content.js 卡片字段 | `scripts/build-guide-content.mjs`、`scripts/lib/asset.mjs`（消费端） | AV-1 | 16 行全字段齐备，缺字段 fail-closed（CANDIDATE_INVALID 口径），16/16 fixture |
| **AV-3** | 激活接线：activation/matrix 消费 when_to_use/when_not_to_use（负向匹配跳过 + 正向加权）+ 选择日志留痕 | `scripts/lib/activation.mjs`、`scripts/lib/matrix.mjs` | AV-2 | 模糊任务能给出 manifest 依据的资产建议；负向清单命中则不推该资产 |
| **AV-4** | fixtures + S8b 断言：manifest 完整性 16/16、负向守卫、BW-3 模糊场景回放；S8 旁挂 S8b（manifest 消费证据） | `test-reports/av2-fixtures/`、`scripts/regression-all.mjs` | AV-3 | 回归 13→14 段全绿；fixtures 全 PASS；探针确定性 |
| **AV-5** | BW-3 复测盲行：同款模糊 prompt 新工作区，对比资产调用率 | 盲行批（外部 agent） | AV-4 | asset-call-rate 前后对比：模糊场景资产建议命中 >0 且有 manifest 依据留痕 |
| **LS-1** | lessons.md（工作区级半采纳）：`.tt-state/lessons.md` schema + 批判阶段（step 8）gate 写入 + journey 生命周期管理 | `scripts/lib/gate.mjs` 或 tt-journey（step 8 落账处） | 无（独立） | 只有批判 gate PASS 的条目可写入（无批判产物 → 拒写）；--session 隔离；破坏性探针 |
| **FE-5** | 资产卡内容补全：卡片渲染 manifest 的 when_to_use/when_not_to_use/verification + 用法 Prompt（数据源=AV-2，非手写） | `webview/journey/render-core.mjs`、`index.html`、`build-guide-content` | AV-2 | 16 卡 stages/description 不再空/截断；每卡有可复制用法 Prompt（真剪贴板验证） |
| **FE-6** | Action Bridge（journey 输入入口，方案 §三）：servePage 加 POST /action 白名单命令 + 页面 gate 卡推进/回跳按钮 + --session 切换器 | `webview/journey/host-bridge.mjs`、`index.html` | FE-5（同写面顺延） | 白名单外命令 403；每次动作回注新 payload；无宿主环境回落 C2 复制卡 |
| **EA-1** | 16 资产基线测量（需求 3 第一步）：对 4 个 BW 工作区跑 asset-call-rate/asset-io-report → 每资产调用/never-called/consumed=false 率 | 只读分析，产出 `test-reports/asset-eval-20260923/` | 无 | 基线表 16 行（实测，非推断） |
| **EA-2** | 竞品调研（需求 3 第二步）：按簇对标开源替代（见 §五清单），产出 keep/replace/merge 建议 | 纯调研 agents 并行 | 无 | 每资产：≥2 竞品 + 覆盖度对比 + 集成成本 + 许可证 |
| **EA-3** | 评级矩阵：5 维 rubric（触发可靠性/产出质量/机验友好/维护成本/替代差距）→ P0-P3 分级 | 综合 EA-1 实测 + EA-2 调研 | EA-1、EA-2、AV-2（评级挂 v2 schema） | 16 行评级表 + P3 资产的替代方案，交 Owner 裁决 |

执行顺序建议：**第一批并行** EA-1 + EA-2 + AV-1 + LS-1（写面互不相交）→ **第二批** AV-2 → AV-3 → AV-4 + FE-5 → **第三批** FE-6 + AV-5 → **收口** EA-3 评级矩阵交 Owner。

## 二、Asset Manifest v2 具体设计（AV-1..AV-5）

### schema（contracts/asset-manifest-v2.json 每行）

```json
{
  "id": "be-validator",
  "name": "后端契约校验",
  "role": "验收簇：结构/契约回归",
  "capability": "Zod schemas, OpenAPI generation, RFC 9457 errors, input sanitization",
  "cluster": ["T1_DATABASE", "T2_BACKEND", "T3_AI_RAG_MCP", "T5_OPS"],
  "when_to_use": ["接口契约先行冻结后的验收子任务", "OpenAPI/错误码规范校验"],
  "when_not_to_use": ["无冻结契约时（CONTRACT_NOT_FROZEN）", "前端视觉验收（走 agent-vision-toolkit）"],
  "verification": "产物含 OpenAPI 3.1 文档 + RFC 9457 错误样例；S8 锚点+内核词机验",
  "source": "vendor/be-validator/be-validator.md#L12-L48"
}
```

纪律要点：
- 提取源 = 每资产源文档头部既有结构化区（缺则手工补齐源文档，**不允许生成器编造**——坑#教训：缺字段 fail-closed 报 CANDIDATE_INVALID，与 evolution.propose 同口径）
- `when_not_to_use` 是新增能力：activation 负向匹配命中 → 该资产从本任务 candidates 剔除并在 debug 面留痕（可解释、可探针）
- change.record 单注明：16 行 v2 数据本身是内容不是代码，走冻结确认后进 manifest；后续增改走 evolution.propose

### fixtures（AV-4，确定性探针，复用 R10 fixtures 风格）

| fixture | 给定 | 期望 |
|---|---|---|
| m01 | 生成 manifest | 16 行 × 三字段非空，source 行号有效 |
| m02 | 源文档删掉 when_to_use 区 | 生成器 fail-closed 报缺字段，拒绝产出 |
| m03 | 模糊任务「整理一堆文件」（BW-3 原题） | activation 建议 file 类资产且留 manifest 依据；不误推 be-validator |
| m04 | 任务含 when_not_to_use 负向条件 | 该资产被剔除 + debug 面留痕 |
| m05 | S8b：orchestrator 派单带 manifest | 子任务 assetConsumed 证据含 manifest 版本 hash |

## 三、前端与 journey 的接线设计（Owner 需求 1）

**现状关系（实测）**：页面 = journey 的只读投影。数据链 = `tt-journey --read/--project`（壳 JSON）→ host-bridge 在页面首脚本前注入 `window.__YY_JOURNEY__` → render-core 渲染九节点/手册/资产卡。**页面没有写通道**——推进 journey 只能靠 agent 跑 `tt-journey --update`；nextPrompt 复制按钮是唯一动作桥（复制命令给 agent 执行）。

**接入设计（两层，FE-6）**：

1. **C1 Action Bridge（dev server 形态，推荐）**：`host-bridge.mjs` 的 servePage 增加 `POST /action`，白名单仅允许：`--prereq-check --step N`、`--update --step N --gate <gate>`、`--session <id>` 切换。页面 gate 卡上出现「推进/回跳/代签查看」按钮 → host 执行 → **重新注入新 payload**（刷新即投影，OQ-U-18=a 口径不变）。安全阀：命令白名单硬编码、无 shell 拼接、每次动作写入 journey 的 plans[] 留痕（与 --force bypass 同款审计）、L0 Owner-gate 的代签动作必须二次确认弹层。
2. **C2 命令卡（零风险回落，全环境可用）**：VS Code webview 等无 exec 宿主里，每个 gate 卡渲染"下一步精确命令"复制按钮（nextPrompt 扩展为逐 gate 卡粒度）。用户复制给 agent 即完成输入——这与 autopilot 五层的"L0 人是门控"哲学一致：**页面提供的是受控的动作请求，不是绕过 agent 的直写**。
3. 明确不做：页面直改 journey.json / 绕过 prereq-check 的推进（破坏 C-01 链）。

**--session 切换器**：BW-2 实测多线隔离后，页面加 session 下拉（数据源 = `.tt-state/*/journey.json` 枚举），切换 = host 重注入（OQ-U-19=a）。

## 四、lessons.md 半采纳设计（LS-1）

- 位置：`<workspace>/.tt-state/lessons.md`，随 journey 生命周期（init 创建 / 归档随 journey 终态），**不是全局记忆**——Owner 切除记忆层的理由（跨项目误导探索）不复发。
- 写入纪律：**只有阶段 8 批判 gate PASS 的条目**可落盘，格式强制：`L-<n> | 日期 | 来源批判条目 id | 条件（何时适用） | 教训 | 验证状态`。无批判产物调用写入 → 拒绝（fail-closed，防"顺手写经验"）。
- 消费点：阶段 0/3 prereq-check 输出提示"本工作区有 N 条已验证教训"（只提示不注入正文，避免 prompt 膨胀）。
- 探针：批判产物在 → 写入成功；伪造写入（无批判 id）→ 拒绝；--session a 写的 lessons 不出现在 b。

## 五、16 资产评估与竞品替代（Owner 需求 3）

**回答**：是——Manifest v2 的 `verification` 字段是效果评级的载体，但"功能效果未验证"本身要先测基线再评级，评估完成前不接入工作流主链（评级结果作为 evolution.propose 的 evidence，这正是资产进化机制的既定入口）。

- **EA-1 基线（实测优先）**：~~4 个 BW 工作区跑 asset-call-rate~~ **实测修正（2026-09-23）**：BW 四工作区走 N=1 手动模式，只有 journey.json 无 state.json，asset-call-rate（--state 口径）无法直接计量。EA-1 改为两条腿：①用现有 S8 探针/回归产物里的 state.json 计量（机验链路内的消费证据）；②BW 消费证据从 session-notes/工作区残留人工取证（dev-planner 前提挑战、frontend-design 等）。**16 资产里大概率有一批从未被真实调用**——这就是评级的最硬输入。
- **EA-2 竞品对标（按簇并行调研）**：
  - 实现簇：implementation ↔ BMAD-METHOD / claude-flow / SuperClaude
  - 流程簇：sdlc / dev-planner ↔ claude-taskmaster / BMAD phases
  - 契约簇：be-validator ↔ spectral / portman / contracteer
  - 前端簇：frontend-design ↔ taste-skill / ui-ux-pro-max（本机已有，对比自研成本）
  - 安全/运维簇：security / be-resilience / skill-sentinel ↔ mimosa / semgrep OSS 规则集
  - 调研簇：agent-research ↔ deep-research 类开源实现
  - 每项产出：能力覆盖度 / 集成成本（换适配器 vs 换内核）/ 维护活跃度 / 许可证 → keep / replace / merge 建议
- **EA-3 评级 rubric（挂 v2 verification 字段）**：触发可靠性（路由命中率，实测）/ 产出质量（盲行 consumed 证据抽验）/ 机验友好（能否被 S8 类断言卡住）/ 维护成本（vendor 体积+漂移频率）/ 替代差距 → P0(核心保留) P1(需补强) P2(边缘观察) P3(建议替代)。P3 资产的替代走 evolution.propose 单资产替换（不许一次性大换血——外部方案风险控制第 1 条，采信）。

## 六、风险与纪律（本方案自带的 10 条残留登记）

1. 【推断】manifest 提取依赖源文档头部结构化质量，16 个源文档预计需逐个手工补齐头部区——工作量集中在 AV-2，可能超单 agent 批次（预案：拆两批）
2. 【推断】activation 负向匹配若做过头会误杀（关键词重叠时）——m04 fixture 必须含正反双例
3. 【实测】regression 将从 13 段变 14+ 段，S8b 涉及 orchestrator 派单路径，须复用 FIX-2 探针的确定性纪律（禁 modes.exec 类断言）
4. 【推断】FE-6 Action Bridge 的 host exec 是新增攻击面——白名单+审计+二次确认三重阀，且 dev server 仅绑定 127.0.0.1
5. 【实测】SKILL.md 809 tok / reference 2000 tok 顶——lessons.md 与 manifest 均不进 SKILL 正文，走 reference 增量或纯 scripts 面
6. 【推断】EA-2 竞品调研的结论质量依赖真实 repo 数据（星标/活跃度），WebSearch 若不可用降级为 npm/api.github.com 口径（BW 实测可行）
7. 【推断】BW-3 复测存在"盲行者已见过类似流程"的学习效应——换全新选题（文件整理 → 日志分析工具）保持盲性
8. 【实测】content.js 现有截断 description 说明 build-guide-content 提取正则有 bug（截半词），AV-2 顺手修复
9. 【推断】评级矩阵若把 P3 资产全替换会动摇冻结面——替换必须逐资产走 change 单，禁止批量
10. 【实测】lessons.md 若被 agent 当作"免批判的经验通道"就复活了被切除的 memory 层——fail-closed 写入纪律是本设计的生死线，LS-1 探针必须测伪造拒绝

—— 编排者 2026-09-23 · 待 Owner 拍板后按批次派发（L0 门控）
