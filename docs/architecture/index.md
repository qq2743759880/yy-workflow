# 架构编辑资料

README 的两张核心图分别说明用户工作流程与模块职责。它们把九项方法资产按用途分组，避免将方法文件画成部署服务。图中 C4 是 YY 宿主接入能力的名称；下面的 C4 Context / Container 是另一套架构建模记法。

| 可选资料 | 原生交互文件 | 编辑源 | 静态图 |
|---|---|---|---|
| [系统边界](c4-context.md) | [HTML](c4-context.html) | [JSON](c4-context.json)、[C4 Mermaid](c4-context.mmd) | [原生 PNG](c4-context.png)、[SVG](c4-context.svg)、[Mermaid SVG](c4-context-mermaid.svg) |
| [运行边界](c4-containers.md) | [HTML](c4-containers.html) | [JSON](c4-containers.json)、[C4 Mermaid](c4-containers.mmd) | [原生 PNG](c4-containers.png)、[SVG](c4-containers.svg)、[Mermaid SVG](c4-containers-mermaid.svg) |

HTML 是可下载的独立查看器，GitHub 文件页不会直接运行它。原生交互文件保留 Archify 导出菜单、主题与节点查找。窄屏只提供容纳与查看控制；流程较宽时需要平移或放大，不承诺手机上的完整小字阅读。

## 阅读版与原生输出

[工作流程阅读版](../../assets/yy-workflow.svg)和[模块架构阅读版](../../assets/yy-architecture.svg)为 GitHub 960 像素宽阅读重新排版，主体文字至少 18 像素，PNG 由真实 Chrome 栅格化。它们是忠实的阅读派生版，不冒充 Archify 原生 canonical 导出。对应的[流程 HTML](../../assets/yy-workflow.html)、[JSON](../../assets/yy-workflow.json)及[架构 HTML](../../assets/yy-architecture.html)、[JSON](../../assets/yy-architecture.json)保留原生图的编辑与交互能力。原生 canonical 导出与完整执行、视觉检查记录保留在私有构建证据中。

## 能力边界

Decision Core 是阶段、资格与路由的唯一决策来源，宿主入口展示并复核其原包。方法包按实际任务与条件装配；没有 task brief 的原生工作仍须先复核。返工与恢复重新消费准入，旧进度记录不能授权执行。

V2 MCP 的三个工具调用同一 Decision 语义。M1 的六工具保持旧读取兼容，不构成当前准入权威。MCP 是外围只读接口，不替宿主写执行记录或产物。

默认执行来自当前宿主的真实回调绑定。外部 Provider 须显式选择，人工交接使用有界任务与确定性 checker。元数据中出现工具名字不等于已有执行绑定。

产物与 checker 证明本次任务行为；它们不证明九项方法论已应用或已完成 V2 认证。C5 方法论写入仍未交付，不能把 legacy 任务证据升级为方法论 APPLIED / VERIFIED。

Archify：MIT；内嵌字体再分发许可按发行包中的 OFL 文本保留。C4 源使用固定 Mermaid CLI 11.17.0 渲染。
