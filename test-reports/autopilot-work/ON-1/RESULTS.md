# ON-1 RESULTS — 接入向导问题清单 + 决策卡格式（批 0，重派）

- 日期：2026-09-23
- 执行：autopilot 管线 L1 独立执行 agent（全新上下文，ON-1 重派——上一 agent 因 provider 错误中断零产出）
- 派单：`handoffs/v3/ON-1-dispatch.md`；上下文：`plans/execution-plan-v3-20260923.md` §四 ON-1
- 状态：**交付完成，待 L2 编排者复核**（不自称 DONE）

---

## 1. 改动文件清单（白名单内，无越界）

| 文件 | 改动性质 | 内容 |
|---|---|---|
| `scripts/executor-setup.mjs` | 最小增量（叠加在 EX-1 能力握手改动之上） | ① `--configure` 改为布尔模式旗标（原实现要求取值，`--configure` 单独用会 exit 2）；② 新增六组 CLI 覆盖 flag：`--subagentSource/--delegationMode/--critiqueSources/--reportStyle/--blindwalk/--mcpTools`（camelCase 与 kebab-case 双形态都收）；③ `coerceFieldValue` 值校验 fail-closed（枚举外 exit 2 + 合法值指引，不猜）；④ `readExistingConfigYaml`/`parseYamlScalar`/`writeConfig`：既有 orchestrator.config.yaml 读取 + **只补缺不覆盖**（既有六字段值保留，向导回答与 flag 都不落已占字段；向导不认识的键原样保留在文件头之后，已实测 PyYAML 可解析）；⑤ 预览函数升级：逐字段标注来源（既有保留 / 本次新填）；⑥ `serializeConfig` 修为合法 YAML：非空数组落标准块序列（`key:`+`  - item`），注释统一挂键行；`blindwalk.enabled` 落盘为**布尔**（回答字符串 `true/false` 归一为 boolean，既有文件值读取时同样归一）；⑦ `--help` 与文件头用法注释补 `--configure` 段 |
| `templates/decision-card.md` | 新建 | 决策卡模板：§一 六段固定结构（大白话标题 / 为什么现在决定 2 句禁术语 / 架构影响 / 选项对照表 / 默认建议+一句理由 / AskUserQuestion 映射）；§二 mermaid 生成纪律（agent 生成不手写、`classDef highlight` 高亮改动点、节点 ≤8）；§三 ASCII 回落规范（≤76 列、与 mermaid 语义一致）；§四 完整样例卡（含 mermaid 源码 + ASCII 回落 + 选项对照 + 默认建议）；§五 AskUserQuestion option/preview 字段映射表 |
| `templates/handoff-prompt.md` | 新建 | 交接 Prompt 模板：§一 六段固定结构（provenance 头：生成者/时间/依据/配置快照/交接链；去授权声明；任务与范围+白名单；逐值来源表（值×内容×来源，来源只认派单/Owner 指令/上游产物/向导默认四类）；验收标准固化（机验命令+退出码，交接后不口头放宽）；完成后回填约定）；§二 填写纪律（含与 `--handoff` brief 骨架 tt/handoff-brief@1 的分工说明）；§三 完整样例 |
| `test-reports/autopilot-work/ON-1/` | 新建（自测证据） | run-probes.mjs（10 探针）+ out-* 证据文件 + 本 RESULTS.md |

**EX-1 领地保护**：`CAPABILITY_ENUM`/`DEFAULT_CAPABILITIES`/`EXECUTOR_VERSION` 三导出、`readExecutorConfig`/`saveExecutorConfig` 能力落盘逻辑**一字未动**（orchestrator.mjs 动态 import 这三导出，回归全绿佐证未破坏）。EX-1 报告的 D-EX1-2（main() 结构破损归位）实测现状已健康：`node --check` 通过，`main()` 结构完整（configure 分支在 help 之后、probe 之前），无需再修。

**禁改面确认**：orchestrator.mjs / SKILL.md / commands/ / webview/ / contracts/ / reference/ / plans/ / 其他 scripts 全部未动；零 git 操作；config 落盘全部走 os.tmpdir() 沙箱（仓库根零 config.yaml 残留，已实测确认）。

---

## 2. 六字段落盘口径（与派单表逐项对应）

| 字段 | 选项 | 默认 | 落盘形态 |
|---|---|---|---|
| `orchestrator.subagentSource` | session / claude-cli / codex-cli | session | 带引号字符串 |
| `orchestrator.delegationMode` | self-dispatch / handoff-prompt | self-dispatch | 带引号字符串 |
| `critique.sources` | 知识库路径 / 搜索工具 / 标准文档 / none | none | 带引号字符串（CR-1 落地后扩列表） |
| `report.style` | plain / technical / both | plain | 带引号字符串 |
| `blindwalk.enabled` | true / false | true | **布尔**（非字符串，PyYAML 实测解析为 boolean） |
| `mcp.tools` | MCP server 列表 | [] | 流式 `[]` 或标准块序列（PyYAML 实测解析为 list） |

每行行尾注释含 `默认 <值> · <理由>`（可后改说明在预览与模板注释中），满足"每项带默认值+理由+可后改"派单要求。

优先级语义（写进代码注释与 --help）：CLI flag > 向导回答 > 既有文件值 > 默认值；但"不覆盖既有字段"硬约束优先——字段在既有文件已有值时，flag/向导值不落（flag 要改既有值须手工编辑文件，这是有意为之的保守口径，见 D-ON1-1）。

---

## 3. 自测逐项证据（10/10 PASS，全文见 `out-on1-probes.txt`）

| 探针 | 断言 | 结果 |
|---|---|---|
| N1 | `--configure --dry-run`：打印"你将写入这些字段"大白话预览（六键+理由句在场）+ 拟落盘全文，workspace 零落盘 | PASS |
| N2 | `--configure --apply`（临时目录）：六键齐全且值与派单默认表一致（sha16=d14113ddee93c4f1） | PASS |
| N3 | 幂等：同输入连续两次落盘**逐字节一致**（sha16 相同） | PASS |
| N4 | 已有 config（预置 subagentSource=claude-cli / report.style=both / 自定义键 custom.extra）：既有值保留 + 自定义键原样保留 + 缺项四字段补齐 | PASS |
| N5 | CLI flag 覆盖生效：`--subagentSource codex-cli --blindwalk false --mcpTools chrome-devtools-mcp,context7` → 落盘值=flag 值（列表落块序列） | PASS |
| N5b | 单字段 flag（`--reportStyle both`）覆盖 + 其余字段取默认（优先级 flag > 默认） | PASS |
| N6 | CLI flag 非法值 fail-closed：exit 2 + "不是合法值"指引 + 不落盘 | PASS |
| N7 | templates/decision-card.md 字段齐全 9/9（标题/为什么现在决定/架构影响/mermaid+classDef/ASCII 回落/选项对照表/默认建议/AskUserQuestion 映射/样例） | PASS |
| N8 | templates/handoff-prompt.md 字段齐全 9/9（provenance/生成者时间依据/配置快照/去授权声明/任务范围白名单/逐值来源表/验收固化/回填约定/样例） | PASS |
| N9 | 落盘 YAML PyYAML 实测可解析 + blindwalk=boolean / mcp.tools=list 类型正确 | PASS |

样例落盘（默认值态）见 `out-sample-config.yaml`；apply 全输出见 `out-sample-apply.txt`。

决策卡样例可读性自评（派单自测 3）：样例卡标题"编排时子代理从哪里来"无需背景可懂；"为什么要现在决定"写的是不决定的代价（每步停下来问，流程走不动）；选项对照每格 ≤30 字；mermaid 3 个高亮节点 + ASCII 回落同图两画；默认建议带一句理由。落在 templates/decision-card.md §四。

---

## 4. 回归硬门（全部实跑，证据落 ON-1 目录）

| 门 | 命令 | 结果 | 证据 |
|---|---|---|---|
| validate-structure | `node scripts/validate-structure.mjs` | **[OK] 0 项警告，exit 0** | `out-validate.txt` |
| regression-all | `node scripts/regression-all.mjs` | **13 PASS / 0 FAIL，exit 0** | `out-regression-all.txt` |
| FIX-2 探针 | `node test-reports/autopilot-work/FIX-2/run-probes.mjs` | **12/12 PASS，exit 0**（executor-setup 是它的断言面，E5 同源） | `out-fix2-probes.txt` |
| EX-1 探针（加测） | `node test-reports/autopilot-work/EX-1/run-probes.mjs` | **8/8 PASS，exit 0**（能力握手导出未被破坏的直接证明） | `out-ex1-probes.txt` |
| 既有模式 sanity | `--probe presence` / `--non-interactive` | 输出正常，未受 --configure 扩展影响 | `out-presence-sanity.txt` / `out-noninteractive-sanity.txt` |

validate H6a-1 孤儿断言只扫 reference/（读源码确认 + 实跑 0 警告佐证），templates/ 新增两文件不受影响；templates/ 相关门（H2-3 owner 审核指引引用、可移植性泄露、U+FFFD）实测全绿。

---

## 5. D-偏差登记

| id | 级别 | 内容 | 处置 |
|---|---|---|---|
| D-ON1-1 | 设计口径，请 L2 知悉 | "CLI flag 可覆盖"与"不覆盖既有字段"两约束在**已有值的字段**上互斥。取舍：保守优先——既有文件的值永不被 flag/向导静默改写（flag 只对空缺字段生效；要改既有值须手工编辑文件，文件头注释已写明可后改）。理由：静默改写 Owner 手改过的配置违背"不覆盖既有字段"的字面硬约束；如 L2 需要 flag 强制改写语义，可加 `--force-field` 类显式旗标（未实现，避免扩权） | 按保守口径交付，请 L2 复核裁定 |
| D-ON1-2 | 修复项（上一重派遗留），如实登记 | 接手时 `--configure` 既有实现存在三处问题（非 EX-1 所述 main() 结构破损——该问题实测已被 EX-1 归位修复；这三处是功能语义问题）：① `--configure` 被解析为取值旗标，派单要求的裸 `--configure` 用法会 exit 2；② 序列化器产出非法 YAML（`[\n  - x\n]` 流式开头+块式条目混用，PyYAML ParserError 实测复现）；③ `blindwalk.enabled` 落盘为字符串 `"true"` 非布尔。均已修复并以 N2/N9 探针固化 | 已修复留证 |
| D-ON1-3 | 语义注记 | `critique.sources` 本期落单值为 `none`（派单选项表里是四类来源）；知识库路径/搜索工具/标准文档多值清单留待 CR-1 落地后扩展（向导 note 已写明"可追加多项"） | 留存设计 |
| D-ON1-4 | 范围注记 | 派单任务 B 允许"写进 executor-setup.mjs 或新建 scripts/decision-card.mjs"；实际选择落 `templates/decision-card.md`（编排者 L2 派单更新中明确两模板路径），决策卡是格式约定面无需脚本，机验走 N7 字段齐全探针 | 无偏差，口径来源 L2 派单更新 |

---

## 6. 证据文件清单（本目录）

| 文件 | 内容 |
|---|---|
| `run-probes.mjs` | ON-1 自测探针（10 探针，exit 0=全过；沙箱全走 os.tmpdir()） |
| `out-on1-probes.txt` | ON-1 探针实跑输出（10/10 PASS） |
| `out-validate.txt` | validate-structure [OK] 0 警告输出 |
| `out-regression-all.txt` | regression-all 13 PASS / 0 FAIL 输出 |
| `out-fix2-probes.txt` | FIX-2 探针 12/12 PASS 输出 |
| `out-ex1-probes.txt` | EX-1 探针 8/8 PASS 输出（加测） |
| `out-sample-apply.txt` | `--configure --apply` 全输出样例（含大白话预览） |
| `out-sample-config.yaml` | 默认值态落盘样例 |
| `out-presence-sanity.txt` / `out-noninteractive-sanity.txt` | 既有模式未受影响的 sanity 证据 |
| `RESULTS.md` | 本文件 |
