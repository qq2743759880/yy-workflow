
- **页面容器与交付形态（v2）**：页面交付为 **YY 宿主适配 webview 插件页**（宿主 = YY webview 容器），不是独立静态页 `[Owner 决断 2026-09-17: host=YY webview]`；打开模型 = 宿主在 webview 内加载页面并注入投影数据（§3.2；注入机制 `[OQ-U-17]`）；骨架/视口/详情层行为不变（web 标准 CSS；webview 容器特有行为 `[OQ-U-19]`）。
