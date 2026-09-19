
### 3.2 取数通道（v2 重裁：YY 宿主调用既有 CLI 并桥接 JSON 入 webview `[Owner 决断 2026-09-17: host=YY webview]`）

> **决断原文（Owner，2026-09-17）**：①"要做成宿主插件页而非独立静态页；改方向再走 C-R7 变更流程"（变更记录 `cr-20260917T035212Z-c2026fdf`）；② 宿主 = YY 宿主适配 webview（Owner 选定选项 (b)）。**本重裁取代 v1.1 的 U-A=b**（fetch 预生成投影产物文件）；v1.1 §3.2.1 的产物文件布局随之作废，不再作为正式通道（历史留痕见 §3.2.4，不静默改写）。

#### 3.2.1 正式通道：YY 宿主调用既有 CLI + 桥接 JSON 入 webview

- **调用面**：YY 宿主调用既有 CLI（只读锚点 `scripts/tt-journey.mjs:497-506`）：

```bash
node scripts/tt-journey.mjs --read    --workspace <ws> --session <id> [--mode summary|full]
node scripts/tt-journey.mjs --project --workspace <ws> --session <id> [--mode summary|full]
```

- 宿主读取 CLI **stdout 统一壳 JSON**（`{ ok, code, data, evidence, warnings }`；exit code `ok?0:1`），并将该 JSON **桥接注入** webview 页面。键名 `journey`（read）/ `projection`（project）保持 `[契约冻结 C-R5]` §5.1/§5.2 原文；`mode` 缺省 `summary` per OQ-R5-4。**取数逻辑不因通道改变而改变**：页面解析同一壳结构（§3.3 映射表不变）。
- **概念区分**：本节的 webview 数据桥接（宿主 → 页面的投影数据注入）**不是**顶栏 Bridge 状态所指的后端执行通道（探测信号 `[OQ-U-14]`；`Bridge disconnected` 叠加态见 §6 判据 2），两者独立。
- **桥接机制未定，不发明取值**：host-injected global / postMessage / file-watch refresh 等注入方式 `[OQ-U-17]`；刷新/轮询策略 `[OQ-U-18]`；webview 容器生命周期 `[OQ-U-19]`；宿主桥接缺席时的降级 `[OQ-U-20]`。
- **硬约束（逐字保持）**：
  - **不新增后端操作**：宿主与页面只消费 `journey.read` / `journey.project` 两个已冻结操作（`[契约冻结 C-R5]` §5）。
  - **不新增错误码**：只呈现既有五码（§6 映射表）。
  - **前端不得**调用 `phase.transition`、不得写 receipt、不得写 state、不得触发任何落盘写入（`[R4冻结]` §3.3 单一 transition 入口）。CLI 调用与 stdout 捕获是**宿主侧行为**；页面本身不得发起 CLI 调用、不得写盘。

#### 3.2.2 开发期 fallback：CLI stdout 直读

> Gate A 阶段"原型 + 无宿主桥接"场景下的**临时手段**：开发/评审环境直接以 CLI stdout JSON 为数据源（命令同 §3.2.1）；exit code 非 0 或 JSON 解析失败 = 取数失败，页面应转 error 态并给出命令提示。任何准生产/验收环境必须走 §3.2.1 宿主桥接通道。

#### 3.2.3 additive 声明（关键）

- CLI 只读投影是 R5a 的 **additive 输出**，**不新增任何状态权威**；`.tt-state/` 目录结构的**权威布局定义仍归 `contracts/C-R4-control.md` FROZEN §3.3**（单一 transition 入口）。
- **桥接层（宿主侧）只做数据搬运 + 生命周期**：不得增删改 JSON 内容、不得以缓存冒充最新投影（缓存/刷新语义 `[OQ-U-18]`）。
- **不新增后端操作 / 错误码 / 状态名**（§3.1 硬约束）；CLI 的宿主侧调用编排（调用时机、并发、重试）属宿主实现细节，本契约只约束页面消费面。

#### 3.2.4 OQ-U-12 重裁记录

- **原 OQ-U-12**：取数通道未定 → v1.1 已决（U-A=b：fetch 预生成投影产物文件；CLI stdout 为开发期 fallback）→ **v2 重裁**`[Owner 决断 2026-09-17: host=YY webview]`：正式通道 = YY 宿主调用既有 CLI 并桥接 JSON 入 webview；CLI stdout 保留为开发期 fallback；U-A=b 产物文件通道作废。历史留痕，不静默关闭。

