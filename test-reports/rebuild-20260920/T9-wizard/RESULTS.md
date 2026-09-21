# T9 executor-setup 向导批执行结果 — rebuild-20260920 / T9-wizard

> 派单：`handoffs/T9-executor-wizard-20260920.md`。工作区：`D:\.ai-hub\skills\yy`（Windows，Node v24.13.0，零 npm 依赖）。
> 基线快照 `65375ac`（T9 派单提交）。**未做任何 git 操作**（无 commit / 无 checkout / 无 reset / 无 push）。
> 本批为 **P2 重设计施工批**：逐条吸收 `plans/wiring-and-audit-plan-20260920.md` P2 节 10 条批判，
> 规格 = `plans/next-phase-plan-20260920.md` T9 节 10 条设计决定。

## 0. 施工项总览

| # | 施工项 | 状态 | 关键产物 | P2 批判吸收点 |
|---|---|---|---|---|
| ① | 向导 CLI `scripts/executor-setup.mjs` | ✅ | 新文件（约 480 行） | 批判 1（A 降为警示项，B 默认高亮）/ 2（--non-interactive）/ 10（withLock） |
| ② | 探测两档分立 | ✅ | `--probe presence` / `--probe roundtrip` | 批判 3（存在性≠可用性，分档呈现）+ roundtrip 未指名目标 exit 2（配额防误烧） |
| ③ | 配置方法论指引三份 | ✅ | `docs/executor-setup/{claude,codex,通用}.md` | 批判 4（头部"生成日期 + 针对 CLI 版本"实测回填）/ 5（绝不读/写凭据，红线成文） |
| ④ | 持久化 executor.json | ✅ | `<workspace>/.tt-state/executor.json`（withLock 写） | 批判 6（项目级不落全局）/ 10（并发锁 fail-closed） |
| ⑤ | 交接模式 schema 化 | ✅ | `--handoff`（schema tt/handoff-brief@1） | 批判 7（brief 骨架 + 回填路径约定 + 机器校验） |
| ⑥ | summary-read 仅追加校验模式 | ✅ | `--validate-handoff <dir>`（缺字段 FAIL 不猜） | 批判 7（schema 强校验拒收） |
| ⑦ | 自测 13 探针 | ✅ | `run-probes.mjs` + `out-probe-results.json` + `.sandbox/` | — |

**白名单遵守**：写入仅落在 `scripts/executor-setup.mjs`（新）、`docs/executor-setup/`（新目录，3 文件）、
`scripts/summary-read.mjs`（仅追加）、`test-reports/rebuild-20260920/T9-wizard/`（新目录）。
**未触碰**：`scripts/exec-host-*.mjs`、`scripts/lib/**`（只读 import）、`scripts/orchestrator.mjs`、
`adapters/**`、`contracts/**`、`vendor/**`、`plans/**`（只读参照）、`handoffs/**`。**禁止 git 操作已遵守**。

---

## 1. ① executor-setup.mjs 设计要点（对应 T9 十条设计决定）

1. **选项 A 更名警示**（决定 1）：交互菜单 B 本机 CLI 子代理【默认高亮，回车即 B】/ A 编排者直执行
   （⚠ 违反 C-01 独立验收纪律，仅限非验收类任务；二次确认输入 YES 才落盘）/ C 手动交接。
2. **--non-interactive**（决定 2 + 5）：读取顺序 `--executor` 显式 > `<workspace>/.tt-state/executor.json` >
   缺信息 exit 2 + 三条指引（不猜）。损坏的 executor.json 也 exit 2（不猜损坏文件内容）。
3. **探测两档**（决定 3）：presence = PATH 定位（Windows `where`）+ 非交互形态登记（只登记仓库
   exec-host-*.mjs 编码过的形态：claude stdin `-p` / codex stdin `exec -` / openclaw message-file /
   cursor+trae no-noninteractive-cli / **opencode 仓库未编码 → 如实标 unknown，不编造**）；
   roundtrip = 真实喂良性"回复 OK"brief（stdin 或沙箱内 message-file），60s 超时（`--timeout` 覆盖），
   沙箱 cwd = `os.tmpdir()/yy-roundtrip-*`。两档独立字段独立呈现，roundtrip 输出显式注明
   "ROUNDTRIP_OK 不证明认证状态/配额余量/模型质量"。
4. **配置方法论 = 文档 + 自检命令**（决定 4）：见 2/③。选 B 的交互尾输出对应指引路径 + 两条自检命令。
5. **持久化**（决定 5 + 9）：schema `tt/executor-config@1`，字段 `mode/cli/model/isolate/savedAt`；
   **isolate 为 P3 预留字段**（决定 10，本期只留字段+文档）；写入走 `lib/store.mjs withLock`
   （fail-closed 锁，重试耗尽抛 LockBusyError）。
6. **交接 schema**（决定 6）：brief 落 `artifacts/<planId>/briefs/<taskId>.md`；回填报告约定
   `artifacts/<planId>/reports/<taskId>/REPORT.md`，必填字段 taskId/taskVerdict/evidencePaths；
   brief 拒绝覆盖（--force 才可重建）；planId/taskId 拒绝路径分隔符与 `..`（防目录穿越）。
7. **触发点**（决定 7）：`/yy-2` 消费方式属编排面（本批白名单外），本批交付消费原语
   （--non-interactive 读 / executor.json 供读），接线由后续批施工。
8. **Windows**（决定 8）：PATH 探测用 `where`，无 mklink/管理员操作；中文/空格路径进自测（p10）。

## 2. 自测输出原样（`node run-probes.mjs`，13/13 PASS）

```
== T9-wizard 自测 == repo=D:\.ai-hub\skills\yy
sandbox=D:\.ai-hub\skills\yy\test-reports\rebuild-20260920\T9-wizard\.sandbox\run-20260921014322-37908

[PASS] p01 presence 分档输出结构与两档标注  · claude=PRESENCE_YES codex=PRESENCE_YES
[PASS] p02 presence 诚实性：不存在的 CLI 只给 PRESENCE_NO，不涉可用性档  · {"tier":"PRESENCE_NO","located":null}
[PASS] p03 roundtrip 成功路径：mock CLI stdin 往返 → ROUNDTRIP_OK，两档分开标注  · {"presence":"PRESENCE_YES","roundtrip":"ROUNDTRIP_OK","ms":238}
[PASS] p04 roundtrip 超时路径：挂起 mock → ROUNDTRIP_TIMEOUT（1.5s 超时诚实报，exit 1）  · {"presence":"PRESENCE_YES","roundtrip":"ROUNDTRIP_TIMEOUT","ms":1589}
[PASS] p04b roundtrip 对无干净非交互形态的 CLI 诚实 SKIP（cursor no-noninteractive-cli）  · "no-noninteractive-cli（无干净非交互模式，不强接）"
[PASS] p05 non-interactive 缺信息 fail-closed：exit 2 + 指引不猜  · exit=2 stderr 头=[executor-setup] 缺信息，fail-closed 不猜。
[PASS] p06 --executor 显式 > executor.json 读取顺序 + --save withLock 落盘（含 isolate 预留字段）  · save=codex explicit=claude stored=codex
[PASS] p07 executor.json withLock 并发写：3 进程并发 save 全成功且文件完好（不互踩不损坏）  · exit codes=[0,0,0] final cli=openclaw
[PASS] p08 交接 schema：brief 骨架生成（含回填字段约定）+ 重复生成拒绝覆盖（exit 2）  · brief=608B regen exit=2
[PASS] p09 validate-handoff：缺字段 FAIL(1) / 齐字段 PASS(0) / 目录缺失 FAIL(1) 不猜  · bad=1 good=0 missing-dir=1
[PASS] p10 中文/空格路径：workspace/planId/taskId 含中文空格全流程成功  · save exit=0 handoff exit=0
[PASS] p11 配置指引文档头部字段（生成日期 + 针对 CLI 版本）+ 凭据红线声明  · claude.md(1143B) codex.md(1210B) 通用.md(1939B)
[PASS] p12 summary-read 既有模式回归：--help/空 workspace/列表行为不变  · help=0 empty=0 list=0

== 汇总: 13/13 PASS ==
```

说明：p03/p04 用 mock CLI（`TT_EXECSETUP_<NAME>` 注入，吞 stdin 回 OK / 静默挂起），**零真实 API 配额**；
p02 用指向不存在命令的 env 覆盖验证 PRESENCE_NO 诚实性（env 显式指定也必须可定位才算存在）。
机读结果：`out-probe-results.json`；沙箱原样留证于 `.sandbox/run-*`（修剪保留最近 5 个）。

## 3. 总门复核（repo 级）

```
node scripts/regression-all.mjs
...
PASS S1..S12 全列
结果: 12 PASS / 0 FAIL
回归基线通过。        ← 含 S1 validate-structure（validate 0）
```

**STOP 条件核查**：roundtrip 探测未写任何宿主配置文件、未读任何凭据（brief 只经 stdin/沙箱内
message-file 传递；沙箱在 os.tmpdir，跑完清理）→ 未触发。summary-read 校验模式为纯追加
（validate 分支在 main 最早返回；p12 回归证明既有功能零改动）→ 未触发。

## 4. 补充实测（真实配额消耗 1 次，非自测必需项）

对真机 claude 跑了一次真实 roundtrip（良性"回复 OK"，消耗一次真实 API 配额，实测）：

```
claude    presence=PRESENCE_YES  roundtrip=ROUNDTRIP_OK
          stdout: OK
          耗时 16830ms / 超时 60000ms
```

另实测（fail-closed 面原样）：非 TTY 交互 → exit 2 + 指引；roundtrip 未指名目标 → exit 2（配额防误烧）；
`--probe bogus` → exit 2。

## 5. 偏差申报

1. **mock 注入通道与 exec-host-probe 不同名**：本脚本用 `TT_EXECSETUP_<NAME>`（exec-host-probe 用
   `TT_PROBE_<NAME>`）——语义差异：本通道允许"命令 + 固定前缀参数"整串（供 mock/特殊安装），
   且 env 指定命令也必须可定位才判 PRESENCE_YES（比 exec-host-probe 的 env 直通更严格）。
2. **roundtrip exit 1 当全部目标非 OK**（含 SKIP/FAIL/TIMEOUT）——派单未规定 roundtrip 退出码，
   取"有 OK 即 0"便于编排消费；SKIP 不是失败但也不是 OK，如实分档。
3. **非交互形态表按仓库编码现状登记**，opencode 标 unknown（仓库无 exec-host 编码，不编造其形态）；
   若后续批为 opencode 加宿主编码，表与文档需同步（见遗留②）。
4. **交互模式的 presence 快速探测会跑 6 次 where**（每次 ≤10s 超时）——TTY 首跑有秒级延迟，未做缓存。
5. **测试修复记录**：自测首轮 0/13（runner REPO 上溯层级错误）→ 次轮 8/13（暴露产品侧真 bug：
   `--cli` 未进 parseArgs；env 覆盖直通判 YES 的诚实性问题；runner 严格 JSON 解析被人读表头阻断）→
   修复后 13/13。两处产品侧修复（--cli 参数、env 覆盖需定位）均在本批白名单文件内。

## 6. 遗留问题（承接 T9 规划 10 条，本批实测补充）

1. roundtrip 真实探测消耗 API 配额（已用"未指名目标 exit 2"缓解误烧，未根治）【实测】
2. CLI 升级致三份指引腐烂：头部版本字段是缓解不是根治（codex 0.153 schema 变更前科）【实测前科】
3. workspace 迁移后 executor.json 不随迁（项目级设计使然，读取顺序无全局层兜底）【推断】
4. 非 TTY 交互降级只做 exit 2 + 指引，降级 UX（如首轮引导）未设计【实测现状】
5. 回填报告依赖外部平台 agent 自觉；schema 校验只能拒收不能强制【设计边界】
6. roundtrip 60s 超时值未标定（真机 claude 实测 16.8s，余量 3.5x；慢 CLI 可能误杀）【实测单点，未标定】
7. 多 CLI 并存优先级策略未定义（首选项 roundtrip FAIL 是否自动 fallback 次选——未实现）【设计空缺】
8. executor.json 含 model 偏好的敏感度边界未审（model id 本身低敏，但字段未来可扩展）【推断】
9. 向导交互面无法独立验收（本批只机验非交互面 13 探针；交互 B/A/C 全流程仅人工路径推演）【实测边界】
10. --isolate 只留字段无语义（P3 施工时 schema 可能升 tt/executor-config@2）【预留】
11. （本批新增）runner 沙箱 `.sandbox/` 会累积磁盘（已修剪保留 5 个 run-*，长期可改 tmpdir）【实测】
12. （本批新增）validate-handoff 的 key 行解析对"正文含冒号的列表项"会把首词误当 key——
    只影响可选字段展示，三必填字段的 FAIL/PASS 判定不受影响（p09 覆盖）【实测】
