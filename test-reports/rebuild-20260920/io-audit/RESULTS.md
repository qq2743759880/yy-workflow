# T1 IO 口径调用率审计工具 — 自测结果（rebuild-20260920 / io-audit）

交付物（本目录之外的三个新文件）：

1. `scripts/lib/io-audit-hook.mjs` — Node `--import` 预载 fs 审计钩子
2. `scripts/asset-io-report.mjs` — JSONL 聚合 CLI
3. `scripts/asset-io-transcript.mjs` — agent 侧转录采集

自测：`node test-reports/rebuild-20260920/io-audit/run-probes.mjs`（沙箱写入限本目录 `.sandbox/`，已 gitignore）。

## 自测输出（原样）

```
[PASS] p01 | 记录 4 条; ops=[createReadStream,readFile,readFileSync,readdir]; 全 vendor=true 四面齐=true 非vendor已滤=true
[PASS] p02 | routing 子(1 条 tag=routing) consumption 子(1 条 tag=consumption)
[PASS] p03 | {"中文":{"name":"中文","under":true,"asset":"implementation"},"空格":{"name":"空格","under":true,"asset":"planning"},"混合斜杠":{"name":"混合斜杠","under":true,"asset":"sdlc"},"大小写":{"name":"大小写","under":true,"asset":"review"},"非vendor":{"name":"非vendor","under":false,"asset":null}}
[PASS] p04 | 仓库外不记录=true；滚动 .1 存在=true（.1 字节=184）
[PASS] p05 | 计数(routing=1, impl=1, sec=1) 零调用=13 阶段=[step0 资产整合|step1 文档化|step5 规划+契约] journey缺失全unknown=true 畸形抛错=true 渲染=true
[PASS] p06 | 采集 3 条 assets=[implementation,planning,security] ops=[read-tool,shell-read,read-tool] 全consumption=true
TOTAL: 6/6 PASS
EXIT=0
```

另跑了真实 CLI 端到端冒烟（transcript → report）：transcript 输出 3 条同构 JSONL；report 写出 REPORT.md，journey.json 不存在时表头显式 `⚠ 整表 stage=unknown（不猜）`，每资产 routing/consumption 分列正确。

## 探针覆盖对照

| 探针 | 验证点 |
|---|---|
| p01 | 四种读取面（readFileSync / promises.readFile / createReadStream / readdir[+readdirSync]）命中 vendor 被记录；非 vendor（package.json）不记 |
| p02 | 调用栈含 `matrix.mjs` → routing；普通脚本 → consumption（自帧剔除后判定） |
| p03 | 中文文件名 / 空格 / 正反斜杠混合 / 大小写不敏感路径规范化正确；cwd 在仓库外时 import 不安装包装 |
| p04 | 作用域防护：cwd 在仓库外的进程即便 `--import` 也不写 JSONL；压小阈值后滚动出一个 `.1` |
| p05 | 每资产计数、阶段×资产按 updated_at bucketing、13 个零调用资产、journey 缺失→全 unknown+warning、JSONL 畸形行 fail-closed |
| p06 | Read 工具读 / shell cat 读计入；`ls vendor/` 列目录与"罗列 16 资产"的 manifest 扫描块排除；非 vendor 不计 |

## 偏差与事实声明（如实，非隐藏）

1. **Node 版本**：派单写 Node v24，实测为 **v22.23.2**。`module.registerHooks` / `module.register` 均存在，STOP 条件未触发，无需 npm。
2. **matrix.mjs 位置**：派单指 `scripts/matrix.mjs`，实际在 `scripts/lib/matrix.mjs`，已读正确文件。
3. **readdirSync**：规格列 `fs.readdir（含 promises 版）`，实现额外包了 `fs.readdirSync`（同步列目录）——增量覆盖，不删任何规格点。
4. **调用栈自帧剔除**：路由特征串含 `io-audit`，而钩子包装帧本身路径就含 `io-audit-hook.mjs`，若不剔除会把一切读误判成 routing。实现先剔除 `io-audit-hook.mjs` 帧再匹配（p02 实证）。
5. **transcript 的 ZCode 路径**：用 `node:sqlite`（v22 实验性，会向 stderr 打 ExperimentalWarning，不污染 stdout JSONL）打开 db 读 `part` 表；表/列名不符预期即报错退出，**不猜列名**。真实 ZCode db schema 未对着活库核验，采集正确性按派单要求用自造 fixture NDJSON 验证。
6. **transcript 记录字段**：历史转录无活动进程，`pid=0`、`cwd` 填仓库根；`tag` 恒为 `consumption`（agent 读=面向使用）。
7. **阶段 bucketing 算法**：记录归到 `updated_at <= 记录时刻` 的最近一个 journey step；早于首 step 的记录落 `unknown`。journey.json 缺失/畸形/无 updated_at → 整表 `unknown` 并 warning，不猜。
8. **额外环境旋钮**：`YY_IO_AUDIT_MAX_BYTES`（默认 5MB）供自测压小阈值；正式阈值仍 5MB，与规格一致。
9. **存储路径大小写**：Windows 上记录的 `path` 做了大小写折叠 + 正斜杠统一（win32 不敏感），用于确定性前缀匹配。

## 已知边界（继承施工方案 P1 遗留，未假装解决）

- shell `cat`/`type` 子进程读文件绕过本钩子（钩子只包本进程 Node fs）——这正是 transcript 工具存在的理由。
- Junction/8.3 短名访问 vendor 可能绕前缀匹配（遗留 #7）。
- 多进程并发写同一 JSONL 可能行交错（遗留 #6）；滚动策略只保留一个 `.1`。
- "读了"不等于"用了"，本工具只测读取动作，不测有效消费（遗留 #8）。

## 白名单合规

- 新增仅限：上述 3 个脚本 + 本目录（含 `probes/`、`run-probes.mjs`、`out-probe-results.json`、`.sandbox/`）。
- 未修改任何既有文件；未 `git add/commit/push`；未读 `test-reports/acceptance-*/`；未在仓库外写文件。
- `git status` 中出现的 `scripts/lib/ci.mjs`、`scripts/lib/orchestrator.mjs`、`scripts/lib/import-graph.mjs` 及 `A0-/A1-/A2-` 目录属并行 P3 工作，非本任务产物，未触碰。
