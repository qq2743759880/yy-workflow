
## I. webview 插件页形态与取数通道（v2 新增，`cr-20260917T035212Z-c2026fdf`）

| # | scenario | exact input | expected outcome | defect if | Owner 确认 |
|---|---|---|---|---|---|
| R5B-42 | 宿主插件页形态 | 在 YY 宿主适配 webview 容器中加载 Journey Control Room 页面 | 页面作为**宿主插件页**在 YY 宿主 webview 内渲染运行 `[Owner 决断 2026-09-17: host=YY webview]`；**不是**独立静态页交付形态；容器生命周期细节 `[OQ-U-19]` `[待补充]` | 以独立静态页/外部浏览器直接打开为正式交付形态；页面静默依赖未声明的宿主全局对象 | |
| R5B-43 | 取数通道 = 宿主调用 CLI + 桥接注入 | YY 宿主调用 `node scripts/tt-journey.mjs --read` / `--project --workspace <ws> --session <id>`，捕获 stdout 统一壳 JSON 并桥接注入 webview | 页面数据全部来自该 JSON（`journey` / `projection` 键）；**页面自身不调用 CLI、不触发落盘**；不新增后端操作（`journey.read` / `journey.project` only）；不新增错误码（五码 only）；桥接机制 `[OQ-U-17]`、刷新策略 `[OQ-U-18]` 均 `[待补充]` | 页面直接执行 CLI 或写盘；出现新操作名/新错误码；桥接层增删改 JSON 内容或以缓存冒充最新投影 | |
| R5B-44 | 宿主桥接缺席降级 | 在无宿主桥接环境加载页面（且未走开发期 CLI stdout fallback） | 进入明确降级/错误态并说明数据未注入，**不得伪造数据冒充真实投影**；具体降级形态与文案 `[OQ-U-20]` `[待补充]`；开发期 fallback 仅限开发/评审环境 | 静默渲染空态冒充 empty；示例数据无角标冒充真实；无任何降级/错误提示 | |

