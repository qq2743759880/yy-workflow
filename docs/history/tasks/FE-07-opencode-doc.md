# Task: FE-07 实现簇文档改写（指向 opencode）

## 概述
把 `vendor/implementation/` 的文档改写为「以 opencode 为执行内核」的版本：明确调用方式、输入输出契约、降级策略与验收方式。BE-07 实现适配器，本任务负责**文档口径**，两者必须一致。

## 所属与定位
- **阶段**：MVP / Phase 2（高杠杆替换）
- **层级**：Frontend（资产层）
- **上游依赖**：FE-04（实现簇已建立）
- **下游被依赖**：BE-07（适配器按本文档的契约实现）、FE-10（README 引用）

## 目标与非目标
**目标**
- `implementation.md` 的「执行内核」章节从「预留」改为「opencode」并写清接入方式。
- 明确：可用时如何调用、不可用时如何降级、产物落在哪里、如何验收。

**非目标**
- 不写具体代码实现（BE-07 负责）。
- 不 vendored opencode 源码（风险 R1：仅调用 CLI）。

## 前置条件
- FE-04 完成，`vendor/implementation/implementation.md` 已存在且含「执行内核（预留）」章节。
- 已确认本机/目标环境 opencode CLI 的调用方式（执行 `opencode --help` 或 `--version` 核实，**禁止臆造参数**）。

## 输入
- `vendor/implementation/implementation.md`；opencode 的实际 CLI 用法。

## 需要创建 / 修改的文件

| 文件 | 动作 | 说明 |
|---|---|---|
| `vendor/implementation/implementation.md` | 修改 | 执行内核章节改为 opencode |
| `vendor/implementation/reference/opencode-usage.md` | 创建 | opencode 调用说明（命令、参数、产物、降级） |

## 实现步骤
1. 先核实 opencode CLI：执行 `opencode --version` 与 `opencode --help`，记录真实的子命令与参数（若未安装，在文档中注明「需安装 opencode，调用方式以官方 --help 为准」并留占位）。
2. 改写 `implementation.md` 的「执行内核」章节：
   - 执行内核：`opencode`（终端内 AI 软件工程师，见 `COMPETITORS.md`）。
   - 状态：MVP 已接入（BE-07 适配器 `scripts/lib/adapters/opencode.mjs`）。
   - 调用入口：由编排内核派单，适配器负责调用，**不要在文档中让人手工复制命令作为主路径**（主路径是内核派单）。
3. 新建 `reference/opencode-usage.md`，写清：
   - **前置**：安装与版本核验命令。
   - **调用**：适配器使用的命令形态（用实际 `--help` 结果填写；不确定的参数标注「待核实」，不要编造）。
   - **输入**：任务描述 + 契约（来自 `SubTask.contract`）。
   - **产物**：落在 `artifacts/<subtaskId>/`，路径相对化。
   - **降级**：CLI 不可用 → 返回 `OPENCODE_NOT_AVAILABLE`，子任务标记 `skipped` 并给出安装提示，不静默失败。
   - **超时**：默认 10 分钟，可配置；超时终止子进程并返回 `TIMEOUT`。
   - **安全**：使用 `spawn` + 参数数组，禁止拼接 shell 字符串。
4. 在 `implementation.md` 中补一句约束：产物路径一律相对路径，不得写入绝对路径（可移植性）。
5. 与 BE-07 对齐：本文档的降级码（`OPENCODE_NOT_AVAILABLE` / `TIMEOUT`）必须与适配器实现一致。

## 关键契约 / 数据结构

```markdown
## 执行内核
- 内核：opencode（BE-07 适配器 `scripts/lib/adapters/opencode.mjs`）
- 状态：已接入
- 调用：由编排内核派单，本资产不直接被手工调用
- 降级码：OPENCODE_NOT_AVAILABLE（CLI 缺失）、TIMEOUT（超时）
- 产物：artifacts/<subtaskId>/（相对路径）
- 详细用法：见 reference/opencode-usage.md
```

## 验收标准（Given / When / Then）
- Given 文档改写完成，When 阅读 `implementation.md`，Then 「执行内核」章节明确写出 opencode 且状态为「已接入」，不再显示「预留」。
- Given `reference/opencode-usage.md`，When 检查命令示例，Then 所有参数均来自实际 `--help` 输出或明确标注「待核实」，**无凭空编造的参数**。
- Given CLI 未安装的环境，When 阅读降级说明，Then 能找到「标记 skipped + 安装提示」的处理方式，且降级码与 BE-07 实现一致。
- Given 文档，When 检查路径相关说明，Then 明确要求产物为相对路径、不得出现绝对路径。
- Given BE-07 已实现，When 对照适配器代码，Then 文档中的降级码与超时默认值与代码一致。

## 验证命令
```bash
cd D:/.ai-hub/skills/tt
grep -n "opencode" vendor/implementation/implementation.md
grep -n "OPENCODE_NOT_AVAILABLE\|TIMEOUT" vendor/implementation/reference/opencode-usage.md
grep -n "OPENCODE_NOT_AVAILABLE" scripts/lib/adapters/opencode.mjs   # 与 BE-07 对齐
opencode --help | head -20
```

## 失败与回滚
- 失败：opencode CLI 参数与文档不符 → 重新 `--help` 核实并修正文档（文档必须服从真实 CLI）。
- 回滚：`git checkout -- vendor/implementation/`；删除 `reference/opencode-usage.md`。

## 风险与注意
- **R1 许可**：文档要明确「仅调用 CLI，不复制 opencode 源码进仓库」。
- 绝不能凭印象写 CLI 参数——错误的命令会让后续 Agent 反复失败。
- 本文档与 BE-07 是**双向对齐**关系：任一侧改动需同步另一侧。

## 交付物检查清单
- [ ] 执行内核章节已改为 opencode 且状态准确
- [ ] `reference/opencode-usage.md` 已建立，参数真实或标注待核实
- [ ] 降级码与 BE-07 一致
- [ ] 产物相对路径约束已写明
- [ ] 已注明「不复制源码」的许可约束
