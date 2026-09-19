
| R5B-21 | 无框架、无外部运行时依赖（v2 收窄） | 检查页面产物依赖 | 无 React/Vue/构建链；无外部脚本/样式/CDN 运行时请求；Gate A 前只改 HTML 原型（`[计划输入 dev-plan:194]`）。**v2 例外**`[Owner 决断 2026-09-17: host=YY webview]`：最小 YY 宿主 webview 桥接（数据注入 + 生命周期）允许（§I R5B-43）；React/通用新 Bridge 仍禁 pre-gate | 引入框架或 CDN 运行时；Gate A 前已建 scaffold；桥接层超出数据注入/生命周期范围（篡改 JSON、触发落盘、调用新操作） | |
