# A0 自测报告 — 静态 import 依赖图测绘

## 运行环境

- 仓库: `D:\.ai-hub\skills\yy`
- 命令: `node scripts/lib/import-graph.mjs --out graph.json`
- 日期: 2026-09-20

## 结果摘要

| 指标 | 值 |
|---|---|
| 模块数（.mjs） | 69 |
| 依赖边数（去重后） | 46 |
| 环 | 0（DAG） |
| 未解析说明符 | 0 |
| 动态 import 引用 | 2（1 个真实 lib/asset.mjs→manifest.mjs，1 个注释误报） |
| 接线序冲突边 | 1 |

## B1→B7 接线序校验结论

**期望序**: B1(state) → B2(store) → B3(tt-journey) → B4(gate) → B5(runtime) → B6(adapters/prompt) → B7(orchestrator)

**冲突边（1 条）**:

1. **`lib/runtime.mjs` → `lib/adapters/index.mjs`**：B5(runtime) 应先于 B6(adapters) 接线，但 runtime 直接 import 了 adapters 桶。
   - **含义**：B5 接线时 adapters/index.mjs 必须已存在（或 runtime 通过依赖注入解耦）。当前设计中 runtime 直接调用 `resolveAdapter`，与"B6 在 B5 之后"的序假设冲突。
   - **缓解建议**：B5 施工时将 adapters/index.mjs 的引用改为依赖注入（runtime 接收 adapter resolver 作为参数），或将 B6 提前到 B5 之前。

**无冲突的层级关系**：
- B1(state) 无出边到任何更高层（叶子模块）✓
- B2(store) 无出边到任何更高层 ✓
- B3(tt-journey) 无被更高层反向依赖（orchestrator→tt-journey 是正向 B7→B3，符合序）✓
- B4(gate) 无被 B1-B3 反向依赖 ✓
- B7(orchestrator) 依赖所有下层（正向，符合序）✓

## 口径与已知盲区

1. 正则解析非 AST：注释中的 `import('...')` 样例会被误抓（见 graph.md 中 import-graph.mjs 自身的 `"..."` 条目）。
2. 动态 `import()` 调用仅记录说明符，不解析为图边。
3. node: 内置模块与裸说明符（本项目零依赖，不存在第三方包）不计入。
4. 字符串拼接的模块说明符不解析。
5. 同一文件多条 import 同一模块去重为单边。

## 自测探针

- `graph.json`：机器可读完整图（69 节点 / 46 边 / 0 环 / 1 冲突）
- `graph.md`：人类可读邻接表 + 冲突分析
