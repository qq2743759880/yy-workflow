# Task: FE-09 be-validator 资产改写（portman / contracteer）

## 概述
把 `vendor/be-validator/` 从自定义契约校验改写为以 **portman / contracteer（OpenAPI → 契约测试）** 为内核的版本，并作为契约 gate（BE-06）的实际校验实现。与 BE-09 适配器双向对齐。

## 所属与定位
- **阶段**：MVP / Phase 2（高杠杆替换）
- **层级**：Frontend（资产层）
- **上游依赖**：无（be-validator 保留为独立 agent）
- **下游被依赖**：**BE-09（适配器按本文档契约实现）**、BE-06（gate 注入本校验器）

## 目标与非目标
**目标**
- `vendor/be-validator/be-validator.md` 改写为「以 OpenAPI 契约为输入、跑契约测试」的定义。
- 明确：工具可用时如何校验、不可用时如何回退本地快照比对、结果如何回写 gate。

**非目标**
- 不实现 portman/contracteer 本身；不引入联网安装步骤（离线约束）。
- 不改变 be-validator 的 agent 型判定（保持无 `SKILL.md`）。

## 前置条件
- 已阅读 `vendor/be-validator/be-validator.md`。
- 已确认本机是否有 `portman` / `contracteer`（执行 `--version`；两者通常需 npm 安装，MVP 允许不可用即降级）。
- BE-06（gate）与 BE-09（适配器）的契约已知。

## 输入
- `vendor/be-validator/be-validator.md`；`contracts/*.json`（OpenAPI 契约）。

## 需要创建 / 修改的文件

| 文件 | 动作 | 说明 |
|---|---|---|
| `vendor/be-validator/be-validator.md` | 改写 | 改为 OpenAPI → 契约测试的定义 |
| `vendor/be-validator/reference/contract-testing.md` | 创建 | portman/contracteer 用法、结果格式、降级策略 |

## 实现步骤
1. 核实工具可用性：执行 `portman --version` 与 `contracteer --version`；记录实际可用的那一个（或两者都不可用 → 文档中走「降级」路径并说明安装方式）。
2. 改写 `be-validator.md`（agent 型，无 frontmatter）：
   - 职责：以 OpenAPI 契约为输入运行契约测试，输出 pass/fail 与差异，供契约 gate 使用。
   - 输入：`SubTask.contract`（OpenAPI JSON 路径）、工作区契约目录 `contracts/`。
   - 输出：`artifacts/<subtaskId>/contract-result.json`，含 `{ pass, diff, checkedAt, tool }`。
   - 内核：portman（OpenAPI→Postman 契约测试）或 contracteer；任一可用即可。
   - 降级：工具不可用 → 回退 BE-06 的本地快照比对（hash 比对），gate 功能不中断。
   - 约束：路径相对化；报告落 `artifacts/`。
3. 新建 `reference/contract-testing.md`：
   - 工具安装与版本核验命令。
   - 实际调用命令（**以 `--help` 为准，不确定处标注「待核实」**）。
   - 结果格式约定与回写 gate 的方式（gate 通过 `setValidator()` 注入）。
   - 降级流程说明（含降级码 `CONTRACT_TOOL_NOT_AVAILABLE`）。
4. 与 BE-09 对齐降级码与结果格式，与 BE-06 对齐 `setValidator` 注入方式。

## 关键契约 / 数据结构

```json
// artifacts/<subtaskId>/contract-result.json
{
  "pass": true,
  "diff": null,
  "checkedAt": "2026-08-29T00:00:00.000Z",
  "tool": "portman"
}
```

```markdown
<!-- be-validator.md 建议结构 -->
# be-validator
职责：以 OpenAPI 契约为输入运行契约测试...
## 输入 / 输出 / 内核（portman | contracteer）
## 降级：CONTRACT_TOOL_NOT_AVAILABLE → 回退 gate 本地快照比对
## 详细：见 reference/contract-testing.md
```

## 验收标准（Given / When / Then）
- Given 改写完成，When 检查 `vendor/be-validator/`，Then 仍为 agent 型（**无 `SKILL.md`**），且 `be-validator.md` 已含契约测试定义。
- Given `be-validator.md`，When 检查内核说明，Then 明确写出 portman / contracteer，并说明「任一可用即可」。
- Given `reference/contract-testing.md`，When 检查命令示例，Then 参数来自实际 `--help` 或标注「待核实」，无编造参数。
- Given 工具不可用的环境，When 阅读降级说明，Then 能找到「回退本地快照比对、gate 不中断」的处理，且降级码与 BE-09 实现一致。
- Given BE-09 已实现，When 对照适配器代码，Then 文档中的结果格式（pass/diff/checkedAt/tool）与代码产出一致。
- Given 改写后，When 运行 `node scripts/validate-structure.mjs`，Then be-validator 仍作为 16 项之一通过校验（类型未变）。

## 验证命令
```bash
cd D:/.ai-hub/skills/tt
portman --version || contracteer --version || echo "工具不可用（走降级路径，符合预期）"
grep -n "portman\|contracteer" vendor/be-validator/be-validator.md
grep -n "CONTRACT_TOOL_NOT_AVAILABLE" scripts/lib/adapters/portman.mjs   # 与 BE-09 对齐
test -f vendor/be-validator/SKILL.md && echo "错误：不应有 SKILL.md" || echo "OK：agent 型"
node scripts/validate-structure.mjs
```

## 失败与回滚
- 失败：误建 `SKILL.md` 导致类型判定变化 → 删除，保持 agent 型。
- 失败：CLI 参数与文档不符 → `--help` 核实后修正。
- 回滚：`git checkout -- vendor/be-validator/`；删除 `reference/contract-testing.md`。

## 风险与注意
- 离线约束下工具可能不可用，**降级路径是本任务的重点**，必须写清楚，不能只写「用 portman 跑」。
- be-validator 必须保持 agent 型（无 `SKILL.md`），否则 FE-06 的条目分类会失效。
- 与 BE-09、BE-06 三向对齐（降级码、结果格式、注入方式）。

## 交付物检查清单
- [ ] `be-validator.md` 已改写为契约测试定义
- [ ] 保持 agent 型（无 SKILL.md）
- [ ] `reference/contract-testing.md` 含真实用法与降级说明
- [ ] 降级码与 BE-09 一致，结果格式与代码一致
- [ ] 校验器仍通过（be-validator 在 16 项内）
