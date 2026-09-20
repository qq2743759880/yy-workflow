# T5/T6 编排者独立验收报告（2026-09-20）

验收人：编排者。基线快照 `912fd4a`。方法：写入范围核对 → 自报复核 → 盲测探针
（`blind-probes.mjs` v2，16 项）→ 回归全量 → 规格溯源。

## 判定

| 任务 | 判定 | 附条件 |
|---|---|---|
| T5（IO 基线跑） | **ACCEPTED** | 结论按"测量口径"解读（见 P2-1） |
| T6（接线 B4-B8） | **ACCEPTED** | **P1-1：`--evolve` 死路径须修复**（可并入 T7） |

## 验收证据

1. **写入范围**：4 个白名单文件（gate/runtime/prompt/orchestrator）+ T6 目录 + io-baseline
   目录 + 2 个已知重跑噪声文件。零越界。
2. **复跑**：T6 21/21、B0 双跑 5/5、回归 12/12、validate 0、R10 12/12、R4/R7/R8/R5a 全过、
   R3 16/16（出现 1 次 15/16 未复现 → P2-3 探针加固项）
3. **盲测 16/16**：B4 DRY 零写盘/落盘/命名空间索引/幂等（镜像执行者形状+我自己的值）；
   B5 DI 可注入可还原、`YY_ACTIVATION=lib` 与 legacy 输出一致；B6 legacy brief 与 912fd4a
   版**行为级逐字一致**；B7 无旗标行为与 T6 前基线一致；T5 的 18 份 JSONL 独立复算吻合。
4. **盲测抓到的缺陷**：
   - **P1-1**：`--evolve` 是死路径——hook 传给 `evolutionPropose` 的 candidate 不含十项不变量
     字段、baseline 五键全 null → 恒 `CANDIDATE_INVALID`（我用 hook 的精确形状复现）。
     修复：映射 doneSubs 字段进候选 schema，或打印明确拒绝原因。
5. **规格溯源抽查**：B4 幂等码按源码用 `REMEDIATION_DUPLICATE`（执行者纠正了派单摘要的
   `DUPLICATE_IDEMPOTENT`，如实申报）；B5 未改 adapters/index.mjs（DI 达成）；B7 旗标纯无值
   扫描不进 lib parseArgs；evidence/evolution 落 workspace 沙箱不污染仓库根。

## 发现登记

- **P2-1（T5，方法论级发现）**：io-audit 的 routing/consumption 二分类**不够用**——实测显示
  orchestrator 的 buildManifest/loadAssets 把 16 资产 SKILL.md **全量装载**（每阶段 36 条记录、
  16/16 资产 consumption>0），这是系统性 plumbing 不是 agent 消费；而 routing=0（调用方
  manifest.mjs/asset.mjs 不在 routing 集合）。且 **agent 自己的 Read 不经过 Node hook**
  （P1 遗留 #1 实锤）。结论：接线前基线的正确解读 = "机器层恒全量装载（无差别），agent 层
  消费未测且疑似≈0（Owner 观察成立）"。**行动**：hook 增加第三类 tag `system-load`
  （caller ∈ manifest.mjs/asset.mjs/matrix.mjs 装载栈）；agent 层消费改由 R3 receipt 链
  （已接线）+ transcript 工具承载。
- **P2-2（T5，声明口径缺陷）**：`asset-call-rate --task` 对 6 条阶段指令全部 0 命中——阶段
  指令是元指令不点名开发域。声明口径的路由模拟对"阶段级"指令无效，只对任务级有效。
- **P2-3（T6）**：R3 探针套件 1 次未复现的 15/16 波动（后 3 连跑全 16/16）——需执行者加固
  （探针独立沙箱、去时钟依赖）。
- **P2-4（协议）**：T3 轮已纠正的"写验收报告"未再犯 ✅；本轮 2 个重跑噪声文件同前。

## S5 口径裁决

见 `plans/decision-s5-p0-semantics-20260920.md`（Owner 授权编排者裁决）：**统一严格口径
（⬜◐ 都算未清零）**，经 change.record 落地，配套 5 道防护。
