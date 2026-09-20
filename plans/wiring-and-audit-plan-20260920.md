# 施工方案：IO 调用率审计（P1）+ 接线任务（P3，含阶段 A 模块）+ executor 向导批判（P2）

日期：2026-09-20。状态：待 Owner 批准后开工。前置：7 模块重建完成（探针 80/80），
regression 12/12 绿。本文档回应 Owner 三项要求：① 阶段 B 并入阶段 A 模块接线；
② P1/P3 完整施工方案各带 10 条遗留问题；③ P2（executor-setup 向导）自我批判 10 条。

---

# P1. IO 口径调用率审计（fs hook + transcript 双采集）

## 目标

把"16 资产是否真被读"从不可测变成可测：脚本侧用 fs hook 抓真实 IO，agent 侧用
transcript 挖掘抓 Read 工具调用；两者都区分 routing（矩阵/清单扫描）与 consumption
（面向使用的读取）。修正 2026-09-20 会话中"grep 路径出现次数"的方法论错误。

## 交付物

1. `scripts/lib/io-audit-hook.mjs` — Node `--import` 预载 hook：
   - `module.registerHooks`/`register()` 包装 `fs.readFileSync` / `fs.promises.readFile` /
     `fs.createReadStream` / `fs.readdir`
   - 路径规范化（`path.resolve` + win32 大小写不敏感 + 反斜杠统一）后匹配 `<repo>/vendor/` 前缀
   - caller 归类：调用栈含 `matrix.mjs|asset-call-rate|ci.mjs|io-audit` → tag=routing；其余 tag=consumption
   - 追加写 JSONL：`{ts, pid, cwd, op, path, tag}`；>5MB 滚动一个 .1 副本
   - 仅 pid 的 cwd 位于 yy 仓库内才记录（防全局 NODE_OPTIONS 泄漏到无关进程）
2. `scripts/asset-io-report.mjs` — 聚合 JSONL：每资产计数（routing/consumption 分列）、
   与 `.tt-state/journey.json` 时间线对齐出"每阶段每资产"矩阵、零调用资产清单、
   输出 `test-reports/io-audit-<label>/REPORT.md`
3. `scripts/asset-io-transcript.mjs` — agent 侧采集：扫 ZCode db `part` 表（Read 工具调用
   的 file_path）+ codex sessions jsonl（Read/shell 读取输出块），仅统计"读取动作目标在
   vendor/ 下"，排除 manifest 扫描输出；输出同格式 JSONL 供 report 聚合
4. 基线协议：固定 6 条阶段 prompt（fixtures/io-audit-prompts.json）；沙箱项目
   `tmp/io-audit-sandbox/`；`NODE_OPTIONS=--import .../io-audit-hook.mjs` 注入；
   每阶段跑 N=3 取中位；产出 `test-reports/io-audit-baseline-20260920/`
5. 验收三问（报告必须能回答）：每阶段每资产 IO 次数？routing vs consumption 比？
   16 资产零调用清单？

## 施工顺序

A. hook + report（纯新增）→ B. transcript 工具 → C. 基线跑（在 P3-B5 之前完成）→
D. P3 接线后同协议复跑出对照报告。

## P1 遗留问题（10 条，承认未检测）

1. agent 的 Read 工具跑在宿主进程，Node hook 抓不到；agent 侧依赖 transcript 留存，
   而会话记录会被清理（本项目 2026-09-19 刚经历过）——审计链天然脆弱
2. shell `cat`/`type`/spawn 子进程读文件绕过 hook（只 hook 本进程 Node fs）
3. caller 归类靠调用栈启发式，会误判；栈格式随 Node 版本/打包方式漂移
4. hook 每读写一行 JSONL，延迟敏感探针（S8 类）时间断言可能漂移
5. 滚动策略丢旧数据：审计完整性 vs 磁盘占用的取舍没有 Owner 拍板
6. B1（state 命名空间）之前多会话并发写同一审计文件 → 行交错损坏
7. Windows 路径坑：junction/8.3 短名/大小写绕过前缀匹配（vendor 经 junction 访问即漏记）
8. 只测"读了"测不了"用了"：agent 可读了不消化；call-rate ≠ 有效消费，指标可能虚高
9. 前后对照可比性：agent 非确定性 + prompt 微调都会动数字；N=3 无功效分析，delta 可能是噪声
10. NODE_OPTIONS 作用域泄漏风险：按 pid+cwd 过滤规则本身是新 bug 面，过滤器写宽了
    会把非 vendor 路径记进审计（隐私 + 噪声）

---

# P3. 接线任务（修订版：阶段 B 并入阶段 A 模块）

## 阶段 A（建模块，零既有文件改动）

- A1 `scripts/lib/ci.mjs`：从 `scripts/ci.mjs` 抽 `GATE_TOPOLOGY` 常量 + `runGate(name, ctx)`
  + `classifyFailure()` 纯函数。自验 = 差分探针：同输入下 lib 与顶层脚本 12 门输出一致
- A2 `scripts/lib/orchestrator.mjs`：从 `scripts/orchestrator.mjs` 抽 plan/dispatch/aggregate
  纯逻辑。自验 = `--plan --dry-run` 差分：重构前后草案逐字节一致
- A0（新增第 0 步）静态 import 图测绘：对 scripts/ 全目录生成 import 依赖图 + 环检测，
  验证 B1→B7 依赖序假设（不留到施工中途发现错序）

## 阶段 B（接线 9 步，每步：pre 门 → commit → post 门，单步可 revert）

pre/post 门统一 = regression-all 12/12 + validate-structure 0 + 相关模块探针复跑 + 差分测试。

| 步 | 文件 | 改动（函数级） | 风险与防护 |
|---|---|---|---|
| B0 | `scripts/ci.mjs` | 切换为 import `lib/ci.mjs` 的薄 CLI 壳 | 鸡生蛋：先加 `--lib` 双跑对比模式跑一个完整周期（新旧 12 门逐项对比），一致后才翻默认 |
| B1 | `scripts/lib/state.mjs` | 纯 additive：`readNamespace(ns)` / `appendNamespace(ns, rec)`（receipt/finding/change/journey 四命名空间）；不动既有 schema 与 STATE_VERSION | 老状态文件兼容：新字段带默认值注入，遇老版本不 fail（与 phase 门协商版本策略） |
| B2 | `scripts/lib/store.mjs` | 导出既有锁原语 `withLock(path, fn)` | 纯导出，零行为变化 |
| B3 | `scripts/tt-journey.mjs` | 新增 `--read` / `--project` 子命令 → 调 `journey.mjs`；老 `--update` 不动 | **单写者纪律**：CLI 写者唯一 = tt-journey；journey.mjs 的 projection-writer 模式在 CLI 语境下禁用（代码级互斥 + 探针断言） |
| B4 | `scripts/lib/gate.mjs` | review-gate 批判输出段 → `remediation.register()`；幂等键 = (文件 sha256, 归一化标题) | 污染防护：`--register-findings` 显式开启才落盘，默认只打印；tracker 写入走 B1 命名空间 |
| B5 | `scripts/lib/runtime.mjs` | 激活入口 → `activation.prepare()` 三级激活；双读单写开关 `YY_ACTIVATION=lib\|legacy`，默认 legacy 跑一个周期后翻默认 | 预算门 fail-closed 对老流程的可用性回归：无预算字段时降级 legacy 并 warning（不 BLOCK） |
| B6 | `scripts/lib/adapters/prompt.mjs` | 注入模板 = journey `copyNextPrompt` + activation 产物组装 | 输出对比探针：新旧注入文本的字段覆盖矩阵 |
| B7 | `scripts/orchestrator.mjs` | 核心循环 import `lib/orchestrator.mjs`；插 `phase.transition` 权限门（owner override 走 `--allow-out-of-order` 显式旗标）；契约改动强制 `change.record`；任务完成生成 `evolution.propose` 候选（仅显式 `--evolve` 时） | dry-run 差分保底；evolution 不自动刷 evidence/ |
| B8 | 端到端冒烟 | 沙箱项目 `/yy-0→5` 全流程 + P1 IO 审计钩子，出对照基线 | 全流程验收清单（阶段推进/门禁阻断/报告白话/资产 IO>0） |

## 与 P1 的顺序耦合

P1-C（基线）必须先于 B5；B8 复跑 P1 协议出 delta。

## P3 遗留问题（10 条，承认未检测）

1. 内核隐藏耦合未测绘：A0 的 import 图是静态的，运行时动态耦合（事件序、缓存）仍可能错序
2. B0 差分只覆盖现有 12 门输入：未覆盖的输入分支在切换后分叉无感知（差分盲区）
3. orchestrator 抽取的隐性全局态（process.exit/未捕获 rejection/直接 console）抽不干净——
   字节一致 ≠ 错误路径一致
4. journey.json 双写者冲突若互斥设计有漏（比如用户手动跑 node journey.mjs），C-R5 单写纪律破
5. state additive 字段遇老 state：版本策略选错 = 老项目全锁死或静默行为漂移（最可能翻车点）
6. gate→remediation 自动登记历史上有"零污染"验收先例——自动登记与该先例的精神冲突；
   幂等键跨 plan 碰撞未验证
7. activation fail-closed 降级 legacy 的 warning 可能被淹没，静默回退无人察觉（fail-open 化）
8. phase 门挡住合法乱序：CLI 语境无交互通道，owner override 旗标可能被滥用成常开
9. 9 步跨多天施工：主分支漂移 + 用户中途自查改文件 → 单步 revert 变 rebase 地狱
10. Windows CRLF/BOM：state/JSON 落盘的既有容忍度未知，additive 写入可能混行尾让老解析器崩

---

# P2. executor-setup 向导 — 自我批判（10 条，承认未检测）

1. **设计级自相矛盾**：选项 A"本会话直接执行"违反 yy-4 自己的红线"独立子 agent、不得
   自写自验"（C-01）——把它设为默认项等于默认违反工作流核心纪律
2. 交互式向导在非交互场景（编排/CI/--dry-run/子代理链）卡死；没有 --non-interactive 降级设计
3. exec-host-probe 只测存在性+非交互模式，不测认证/配额/模型可用——"可用"是过度声明
   （codex"存在但 API 挂"的前科就在眼前）
4. 各 CLI 配置方法论文档会腐烂（codex 0.153→config schema 变更先例），无版本钉住机制
5. "帮用户跑配置自检"边界：验证认证可能把凭据片段打进日志——脱敏设计容易做错（红线）
6. config.json 持久化：多项目用户切 workspace 拿到错误 executor；项目级/全局级优先级未定义
7. 选项 C 手动交接：报告回填的格式/路径无 schema 强校验，外部平台 agent 不会自觉遵守，
   summary-read.mjs 回读会解析失败
8. 向导在 /yy-4 首跑才触发：阶段 0-3 的矩阵/规划已隐含执行器假设，晚绑定可能推翻已批 plan
9. Windows 现实：mklink 需开发者模式/管理员；路径含中文/空格时 spawn 引号 bug 高发
10. 并发 /yy-4 双会话同时首跑向导 → config.json 写竞态（该层无锁）；且 probe 本身跑 CLI
    可能挂起（codex probe 挂起前科），无超时+沙箱设计

---

# 开工顺序（待 Owner 批准）

P1-A/B（纯新增）∥ P3-A0/A1/A2（纯新增）→ P1-C 基线 → P3-B0..B8（每步过门）→
P1-D 对照报告 → P2 重设计（吸收上述批判：去默认自执行、加非交互降级、回填 schema 化）。
