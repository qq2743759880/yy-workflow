# MUSE-Autoskill × TT 融合方案

> 部署：`D:\.ai-hub\thirdparty\muse-autoskill`（Akshay2695/muse_autoskill，完整源码 + 文档 + 测试）
> 论文：arxiv 2605.27366 "Self-Evolving Agents via Skill Creation, Memory, Management, and Evaluation"

## 一、MUSE 自进化闭环（5 件套）

| 组件 | MUSE 实现 | 自进化作用 |
|---|---|---|
| SkillCreator | `skill_creator.py` (16KB) | 执行中发现可复用能力 → 自动创建 skill |
| SkillBank | `skill_bank.py` (15KB) | skill 仓库：注册/索引/检索/版本管理 |
| SkillManager | `skill_manager.py` (11KB) | 生命周期：新增/弃用/合并/替换 |
| SkillRefiner | `skill_refiner.py` (10KB) | 执行反馈 → 自动改进 skill 质量 |
| MemoryManager | `memory_manager.py` (9.8KB) | 长期记忆 + 经验自动提取 |

架构：MUSEAgent(ReAct: PLAN→ACTION→OBSERVE) + AgentContext(DAG) + ToolDispatcher + ContextCompressor(L1/L2 压缩)

## 二、TT 对应现状（自进化调用率，真实数据 2026-08-31）

| MUSE 件 | TT 对应 | 真实调用率 | 差距 |
|---|---|---|---|
| SkillCreator | 资产新增（手动） | 0%（无自动创建） | **最大差距**：TT 资产全靠人工/S3 门，无"执行中发现可复用能力自动创建" |
| SkillBank | vendor/ 16 资产 + S3 漂移门 | S3 校验 14/14（100% 路由可达） | 有仓库但无自动注册/索引/版本管理 |
| SkillManager | tracker + skillops sweep | tracker 11 条/10 闭环（91%） | 有批判管理但无自动弃用/合并 |
| SkillRefiner | tracker→修复→验收 | 10/11 闭环（91%） | 有修复闭环但无"执行反馈自动改进 skill 正文" |
| MemoryManager | memory_write/read | 13 条（35% 轮次） | 有记忆但非每轮 + 无自动经验提取 |

## 三、融合点（TT × MUSE，可落地）

### F1: 资产调用率监控 → 自动审查/替换（SkillRefiner 模式）
- **现状**：资产调用率 75%（消费证据），低调用率资产无自动审查
- **融合**：每次执行后统计资产调用率 → 低于阈值（如 50%）的资产自动触发"审查→优化/替换"（MUSE SkillRefiner 模式）
- **落点**：`scripts/asset-call-rate.mjs`（统计 + 阈值 + 触发审查 task）

### F2: 执行反馈 → 资产正文自动改进（SkillRefiner 模式）
- **现状**：批判→修复→验收（手动）
- **融合**：执行结果（assetConsumed/失败原因）自动反馈到资产正文（MUSE SkillRefiner）→ 资产方法论迭代
- **落点**：runtime 执行后反馈 → asset body 迭代提示

### F3: 长期记忆 + 自动经验提取（MemoryManager 模式）
- **现状**：memory_write 35%（手动）
- **融合**：每次执行自动提取经验（成功/失败/改进点）写入 memory（MUSE MemoryManager）
- **落点**：runtime 尾部自动 memory_write（无需人工触发）

### F4: skill 质量评估自动化（MUSE 评估）
- **现状**：regression-all + 独立测试 agent（已自动化）
- **融合**：资产调用率 + S3 漂移门 + regression → 自动 skill 质量评分（MUSE 评估）
- **落点**：ci.mjs 增"资产质量评分"段

### F5: 自动 skill 创建（SkillCreator 模式，最高杠杆）
- **现状**：0%（全手动）
- **融合**：执行中发现"反复需要但无资产"的能力 → 自动创建新 skill（MUSE SkillCreator）
- **落点**：长期目标（需 LLM + 沙箱，MUSE 有 sandbox.py）

## 四、执行优先级

1. **F1 资产调用率监控**（已有数据：路由 100%、消费 75%、正文 5/5 prompt 后端）→ 脚本统计 + 阈值触发
2. **F3 自动经验提取**（memory_write 自动化，低改造成本）
3. **F4 资产质量评分**（ci.mjs 扩展）
4. **F2 执行反馈改进**（runtime 反馈到 asset body）
5. **F5 自动 skill 创建**（最高杠杆但需沙箱+LLM，长期）

## 五、部署状态

- MUSE 源码：`D:\.ai-hub\thirdparty\muse-autoskill`（agent.py/skill_creator/skill_bank/skill_manager/skill_refiner/memory_manager + 测试 + Docker）
- 完整跑 MUSE 需 Docker + OpenAI API（requirements: openai/pyyaml/pytest/docker）
- 融合方式：借鉴 MUSE 模式写入 TT（非直接 import MUSE——TT 是 Node 零依赖，MUSE 是 Python+Docker）

## 六、自进化调用率 100% 目标差距

| 机制 | 当前率 | 达 100% 需补 |
|---|---|---|
| CHANGELOG 追加 | 94.6% | 少量早期未记录 |
| version bump | 62% | 改 SKILL.md 才 bump（合理） |
| 批判 tracker 登记 | 91% | C-10/C-11 待修 |
| memory 写回 | 35% | **F3 自动化** |
| 外部对比自批判 | 非每轮 | §9.2 定期执行（未制度化） |
| 资产调用率监控 | 0% | **F1 脚本** |
| 自动 skill 创建 | 0% | **F5 长期** |
