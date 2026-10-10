---
name: frontend-design
version: 3.1.0
description: 分级前端设计资产（L0-L3）。有界面产物时按复杂度加载：小修只过机检门，标准页面走 Design Read+三拨盘+按主题查设计数据，全设计任务才进完整 taste 工作流与原型。纯后端与数据密集仪表盘不触发。
---

# Frontend Design（分级前端设计资产）

> 消费形态：frontmatter 由 manifest 扫描（扁平字段）；正文按 activation body 级投递；
> reference/ 按需资源级。当前运行时尚未强制 L0–L3 分级策略；对应 Core 缺口见
> [资产运行时边界](../../reference/asset-runtime-boundary.md)。未接入前由派单方人工声明级别。
> 分级与继承的 taste 工作流的优先关系：**分级先于继承条款**——本表决定加载多少
> vendor v2.0.0 工作流；超出级别的继承步骤（Pre-Flight 全量、原型、taste-blocks 全集）
> 不在该级加载，仅 L3 进完整工作流。

## 0. 分级入口（先定级，再加载）

| 级别 | 判据 | 本资产加载什么 | 禁止 |
|---|---|---|---|
| L0 | 无界面产物（纯后端/脚本/文档） | 什么都不加载 | 任何加载 |
| L1 | 既有样式页面的微调（文案/小修） | 只跑机检门（§3） | 加载 taste 工作流/数据查询 |
| L2 | 标准页面或组件开发 | §1 两步必做 + 按主题引用 reference ≤3 篇（§2）+ 相关域查询 | 原型流程；全量 reference |
| L3 | 全设计任务（landing/portfolio/redesign/显式请求原型） | 完整工作流 + 多域查询 + taste-blocks + §5 原型 | 跳过 Pre-Flight |

未声明级别且有界面产物 → 默认 L2。分级错配是缺陷（L0/L1 加载正文 = 上下文浪费）。

## 1. 两步必做（L2+，load-bearing）

1. **Design Read 先行**：生成前一行声明——`Reading this as: <页面类型> for <受众>, with <vibe>, leaning toward <体系或风格族>`。依据简报六信号：页面类型/vibe 词/参考信号/受众/既有品牌资产/静默约束（无障碍优先、监管行业等**覆盖审美偏好**）。
2. **三拨盘**：DESIGN_VARIANCE / MOTION_INTENSITY / VISUAL_DENSITY，基线 8/6/4，按简报推断并记录取值理由（抄默认值不写理由 = 未推断）。

## 2. 设计数据查询（L2+，选型必须查证）

风格/配色/字体/图标/栈选型前真实查询，禁止手挥目录可答的值：

```
python -B $SKILL_DIR/vendor/frontend-design/reference/design-data/scripts/search.py "<query>" --domain <ux|style|color|typography|gsap|chart>
```

- 域目录：ux=119 准则；style=79 风格；color=192 配色；typography=74 字体对；gsap=动效；chart=图表；栈目录在 data/stacks/。
- 产物留痕：查询行（域+词）与命中的返回行（真名真值）记入交付说明。
- 诚实降级：python 缺失 → 直读 `reference/design-data/data/*.csv`，或显式声明跳过。**禁伪造查询结果**。
- 引用纪律：reference 七篇领域文（color/interaction/motion/responsive/spatial/typography/ux-writing）是按需件——L2 每篇仅当主题命中才读（≤3 篇），禁止全量拼接进上下文。

## 3. 机检门（L1+ 全级别）

`node $SKILL_DIR/scripts/frontend-quality-gate.mjs <目标目录>`（exit 0 过 / 1 有警告 / 2 参数错）。

**机检门证明什么**：hardcoded-hex、通用字体、纯黑白底、弹性缓动、layout 属性动画、AI Slop 红线残留——代码静态可查项。
**机检门不证明什么**：审美质量、真实交互行为、可访问性全量合规、响应式实际表现。这四类分别需要：审美=Design Read+拨盘+人工评审；交互=联调材料（见 reference/integration-checklist.md）；可访问性=专项工具或人工核查清单；响应式=多视口实测。**机检通过不等于审美或业务联调通过。**
主观项在 gate 输出中如实 N/A——**N/A 不算失败也不算通过**（如实未评估，不得计 PASS）。gate FAIL → 返工后重跑，警告例外须有简报依据。

## 4. 反默认红线（L2+）

禁无简报依据默认采用：AI 紫渐变 / 居中 hero 压暗网格 / 三等宽特性卡 / 满屏玻璃拟态 / Inter+slate-900 组合。红线为简报让位：用户明确要的默认风照做，但记录例外理由。

## 5. 原型（仅 L3 且显式请求）

PICKER 变体流程：同件 UI 做多个真正不同的变体 → 视觉挑选器翻牌 → 晋级赢家。PICKER.md 标记照抄（harness chrome 非设计决策）。探索期禁触生产代码；赢家晋级后清理。

## Execution kernel（本地件指针）

- 组件底座：shadcn-ui/ui（probe npm 可用性后按规范产出）
- 原型生成：stackblitz-labs/bolt.new（L3 原型相位）
- 机检门：scripts/frontend-quality-gate.mjs（本仓库件）
- 数据面：vendor/frontend-design/reference/design-data（本仓库件，带出处）
- 降级：外部底座缺失 → design-data + taste-blocks 内置流程，不假报已用外部内核。

## 方法应用证据（交付时必附）

Design Read 行；三拨盘取值+理由；数据查询行（或降级声明）；机检门 exit code+警告清单；（L3）变体与晋级记录。缺任一 = 方法未应用，不得宣称完成。

## 按需资源接线

以下路径以本资产目录为基准；只读取命中条件的资源，不全量加载。
- L2+ 执行继承的设计步骤时读取 [taste 工作流](reference/taste-skill.md)，分级边界仍优先。
- L2+ 主题命中时选择领域文（每任务合计 ≤3 篇）：[色彩](reference/color-and-contrast.md)、[交互](reference/interaction-design.md)、[动效](reference/motion-design.md)、[响应式](reference/responsive-design.md)、[空间](reference/spatial-design.md)、[字体](reference/typography.md)、[文案](reference/ux-writing.md)。
- L2/L3 组件库选型时读取 [选择矩阵](reference/component-selection.md)；用户既有依赖优先，不据参考表擅自更换依赖。
- L2/L3 交付留痕时使用 [Design Read 模板](templates/design-read-template.md)。
- L3 且显式请求原型时读取 [原型流程](reference/prototyping.md) 与 [Picker 标准件](reference/PICKER.md)。
- 页面块命中时只读取 reference/taste-blocks/ 下对应资源：reference/taste-blocks/cta/centered-cta.md、reference/taste-blocks/feature/bento-grid.md、reference/taste-blocks/footer/multi-column-footer.md、reference/taste-blocks/hero/asymmetric-split.md、reference/taste-blocks/navigation/sticky-nav.md、reference/taste-blocks/portfolio/project-gallery.md、reference/taste-blocks/pricing/tiered-pricing.md、reference/taste-blocks/social-proof/testimonial-wall.md、reference/taste-blocks/transition/sticky-scroll-stack.md。
- 设计资料查询或目录维护时读取 [数据使用说明](reference/design-data/usage.md)。


方法论组合与条件资源的声明真源为 [METHODOLOGY.json](METHODOLOGY.json)；执行准备按显式 frontend_level/topics/prototype 上下文展开，未声明分级沿用 L2。
