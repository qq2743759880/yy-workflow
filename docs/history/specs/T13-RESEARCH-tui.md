# T13-RESEARCH · 终端 TUI 任务进度/DAG 可视化调研

> 调研子 agent 输出 · 2026-09-02 · 供 TT「终端 TUI 视图（实时 DAG + 瓶颈高亮）」参考
> 数据来源：GitHub API（stargazers_count 为抓取当日值，PowerShell `Invoke-RestMethod` / webfetch，API 曾触发 403 限流，已用 webfetch 兜底核实）

## 0. TT 需求收敛

| 维度 | 需求 |
|---|---|
| 形态 | 终端 TUI 辅助视图（非主交互入口） |
| 数据 | plan（子任务 DAG：phase 分组 + dependsOn）+ state（status/mode/assetConsumed） |
| 渲染 | 每任务状态色：待执行/执行中/完成/失败/跳过 + 当前瓶颈高亮 |
| 环境 | Node（TT 脚本，零依赖原则，需可复制可审计） |

## 1. 精选项目对比（3 个）

### ① vercel/turborepo（crates/turborepo-ui）—— 最贴合的任务 DAG 进度 TUI 参考实现

- **地址**：https://github.com/vercel/turborepo （`crates/turborepo-ui` 已核实存在，另有 `turborepo-task-executor` 配合）
- **stars**：31,042（抓取日）｜ 语言：Rust ｜ 许可证：MIT
- **能力**：
  - 运行 `turbo run` 时在终端实时渲染任务树：按依赖图分层，每任务一个 spinner/状态标记
  - 状态色覆盖 TT 需要的全部：缓存命中/已完成（绿）、执行中（蓝/spinner）、等待依赖（灰）、失败（红）、跳过
  - 实时刷新（任务状态变更即时重绘），支持非 TTY 时降级纯文本
- **TT 适配方式**：**参考实现思路，不引入**（Rust 无法在 Node 直接调用）。看它如何用「逐行 ANSI + 状态符号映射 + 差异重绘」画任务树；turbo 自己用的也是 console crate 手绘任务树而非通用 TUI 框架——即「任务树自绘」是业界标准做法。

### ② vadimdemedes/ink —— Node 生态 TUI 首选库（引入库的唯一候选）

- **地址**：https://github.com/vadimdemedes/ink
- **stars**：39,767 ｜ 语言：TypeScript ｜ 许可证：MIT
- **能力**：
  - React-for-CLIs：组件化渲染、状态色（props 绑定 status→color）、`useState` 状态变更触发**diff 重绘**（只重绘变化行）、键盘交互、非 TTY 优雅降级
  - 底层依赖 react + react-reconciler + yoga（原生布局 binding）
- **TT 适配方式**：若决定引入库，只有 ink 值得。每任务一个 `<Task status=...>` 组件，瓶颈用加粗/反色；plan 的 phase 分组直接映射成 FlexBox 列。
- **代价**：依赖链 ~数 MB + 原生 binding（yoga），与 TT「零依赖可审计」原则冲突，属重方案。

### ③ dagrejs/dagre —— JS DAG 布局引擎（补充项）

- **地址**：https://github.com/dagrejs/dagre
- **stars**：5,779 ｜ 语言：TypeScript ｜ 许可证：MIT
- **能力**：Directed graph layout for JavaScript——把任意 DAG 计算成分层坐标，专用于图/画布渲染。
- **TT 适配方式**：仅当 TT 要画「真正的图形 DAG」（非文本行）才有价值。但 TT 的 plan **已有 phase 分组 = 天然行/层结构**，dependsOn 依赖边只需在行尾标箭头，无需 dagre 的分层算法。结论：**TT 不需要**。

## 2. 考察过但未入选（诚实说明）

| 项目 | stars | 许可证 | 未入选原因 |
|---|---|---|---|
| yaronn/blessed-contrib | 15,767 | MIT | dashboard 类 TUI（gauges/line），但项目约 2015 年停更、依赖重（blessed+term.js），无 DAG 专长，对轻量需求过重 |
| chjj/blessed | 11,883 | MIT | 底层终端库，同 blessed-contrib，停更、重依赖 |
| vitest-dev/vitest | 17,030 | MIT | 终端 reporter 有任务进度/状态色，可借鉴配色设计，但它是测试框架而非通用 TUI 库，引入不划算 |
| react/yoga | 18,899 | MIT | flexbox 布局引擎，是 ink 的底层；TT 的 DAG 是「行结构」无需布局引擎 |

> 候选方向里「专门 DAG 可视化 TUI」一项未找到活跃的纯 DAG 终端可视化库（多为画布/web 形态，如 mermaid/d3），如实说明：**该方向空缺**，终端内画通用 DAG 本就是小众需求。

## 3. 结论：TT 用哪个库 or 自绘？

### 明确结论：**自绘（纯 ANSI escape，零依赖）**，参考 turborepo-ui 的实现思路。

理由（按优先级）：

1. **零依赖原则 > 功能**：ink 能完美满足需求，但要拖入 react/react-reconciler/yoga 原生 binding（数 MB、安装时编译、审计面变大），TT 是编排脚本而非产品级应用，不值得。
2. **TT 的 DAG 是「行结构」，不是「图形」**：plan 的 phase 分组天然提供层序，dependsOn 只需行内箭头标注。自绘约几十行：`状态符号 + ANSI 色码 + 任务名`。
3. **实时刷新极简单**：`process.stdout.write('\x1b[H' + frame)`（整体重绘）或 `\x1b[<N>A` 逐行覆盖，纯 Node 即可，无任何库依赖。
4. **瓶颈高亮 = 关键路径计算 + 反色/加粗**：plan DAG 已有，算 longest path/当前阻塞集合，用 `\x1b[1m\x1b[7m`（加粗+反色）即可，无需库。
5. **业界印证**：turbo（Rust）就是自绘任务树（console crate 逐行 ANSI），没有为任务进度引入通用 TUI 框架。

### 建议技术卡片（供后续实现）

```
状态色映射：待执行 dim/gray · 执行中 cyan+spinner · 完成 green · 失败 red · 跳过 yellow
瓶颈高亮：\x1b[1;7m（加粗反色）+ 行尾 "(BLOCKING)" 标注
刷新策略：非 TTY 检测（!process.stdout.isTTY）→ 降级为一次性静态输出
重绘：\x1b[H 光标归位 + 整帧覆写；或仅对变化行 \x1b[<n>A + 覆写
布局：每 phase 一行标题，子任务缩进行，dependsOn 用 └─/├─ 树符 + → 箭头
```

### 升级路径（未来交互需求出现时）

若未来需要键盘导航/折叠/滚动等真正交互式 TUI，再引入 **ink**（唯一候选，MIT，社区活跃）；dagre 仅在需要导出图形化 DAG（如输出为 mermaid/图像）时考虑。**当下不重复造轮子也不引库——自绘即最小且正确。**

## 4. 附：数据核实备注

- GitHub API 直接调用触发 403 限流；stars/许可证经 `Invoke-RestMethod` + webfetch 双重核实。
- turborepo `crates/turborepo-ui` 存在性经 GitHub contents API 核实（webfetch）。
- 本报告未验证「TT 是否已有 plan/state JSON 结构与字段名」，仅基于任务描述；实现时以 TT 实际 plan schema 为准。
