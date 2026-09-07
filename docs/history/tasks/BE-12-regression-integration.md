# Task: BE-12 回归校验集成（validate + sweep）

## 概述
把已有的 `validate-structure.mjs` 与 SkillOps `sweep()` 接入编排流程与日常使用：每次资产替换/簇化后自动跑回归，确保 `16/16 vendor、0 漂移、0 泄露`，并在 CI/本地提供一条命令即可验证。

## 所属与定位
- **阶段**：MVP / Phase 0（收尾）
- **层级**：Backend（运行时 / 质量保障）
- **上游依赖**：BE-01（脚手架）、FE-06（资产表与校验条目更新）、FE-01~05（簇化）
- **下游被依赖**：无（本任务是 MVP 的验收关卡）

## 目标与非目标
**目标**
- 提供 `npm run validate`（或 `node scripts/validate-structure.mjs`）一键回归，并通过子进程集成到 orchestrator 的 `--validate` 开关。
- 校验四项：vendor 资产数、frontmatter 一致性、接口漂移、可移植性泄露。
- 与 SkillOps `sweep()` 对账：簇化后 26→16 不产生新孤儿/冗余。

**非目标**
- 不重写 `validate-structure.mjs` 的核心逻辑（只接入与扩展条目，条目更新在 FE-06）。
- 不搭建远程 CI（离线约束；本地命令即可）。

## 前置条件
- FE-01~FE-06 已完成（vendor 已簇化为 16 个顶层簇，`SKILL_ENTRIES`/`AGENT_ENTRIES` 已更新）。
- `scripts/validate-structure.mjs` 存在且可运行。
- SkillOps 已 vendored 于 `C:/Users/Administrator/.workbuddy/skills/skillops`（本机），仓库内不强制包含。

## 输入
- `scripts/validate-structure.mjs` 输出；`SKILL.md`；`vendor/`。

## 需要创建 / 修改的文件

| 文件 | 动作 | 说明 |
|---|---|---|
| `scripts/lib/regression.mjs` | 创建 | 调用 `validate-structure.mjs` 并解析结果为结构化对象 |
| `scripts/orchestrator.mjs` | 修改 | 新增 `--validate` 开关，执行后跑回归并打印结论 |
| `package.json` | 创建（可选） | 提供 `npm run validate` 脚本 |

## 实现步骤
1. `regression.mjs`：
   - `runValidate({ cwd })`：用 `spawn`（复用 BE-07 的 `exec.mjs`）执行 `node scripts/validate-structure.mjs`。
   - 解析 stdout，提取四项指标：`vendorCount`（形如 `16/16 vendor`）、`frontmatter`（OK/警告数）、`interfaceDrift`（无/N 处）、`portabilityLeak`（无/N 处）。
   - 返回 `{ ok, vendorCount, warnings, drift, leak, raw }`；`ok` = vendorCount 达标 且 drift/leak 为「无」且 warnings 为 0。
2. `orchestrator.mjs`：
   - 新增 `--validate` 参数；任务执行结束后调用 `runValidate`。
   - 校验不通过时在 stderr 打印具体项并以退出码 5 结束（报告仍写出，见 BE-11）。
3. `package.json`（可选但推荐）：
   - `{ "scripts": { "validate": "node scripts/validate-structure.mjs", "orch": "node scripts/orchestrator.mjs" } }`，`private: true`，不引入依赖。
4. 与 SkillOps 对账（人工步骤，写入文档）：
   - 在簇化后运行 SkillOps `sweep()`，确认 16 个资产无冗余簇、无孤儿依赖。
   - 结果记录在 `OPTIMIZATION.md`（FE-10 负责文档同步）。

## 关键契约 / 数据结构

```js
/**
 * @typedef {Object} RegressionResult
 * @property {boolean} ok
 * @property {{actual:number, expected:number}} vendorCount
 * @property {number} warnings
 * @property {string} drift      // '无' | 'N 处'
 * @property {string} leak       // '无' | 'N 处'
 * @property {string} raw
 */
export async function runValidate({ cwd = process.cwd() } = {}) { /* -> RegressionResult */ }
```

## 验收标准（Given / When / Then）
- Given 仓库处于簇化后状态（16 个顶层簇），When 执行 `npm run validate`，Then 输出 `16/16 vendor`、`0 警告`、`接口漂移 无`、`可移植性泄露 无`。
- Given 执行 `node scripts/orchestrator.mjs --task "..." --validate`，When 任务结束，Then 自动跑回归并打印四项指标；全部通过时退出码 0。
- Given 人为在 `SKILL.md` 中删掉一个已簇化资产条目，When 跑回归，Then `runValidate` 返回 `ok:false` 且 `vendorCount.actual < expected`。
- Given 人为在任一 vendor 文件写入 `D:\` 绝对路径，When 跑回归，Then `leak` 非「无」，`ok:false`（可移植性检查生效）。
- Given 回归不通过且使用 `--validate`，When orchestrator 结束，Then 退出码为 5 且 stderr 指出未通过的具体项。

## 验证命令
```bash
cd D:/.ai-hub/skills/tt
node scripts/validate-structure.mjs
node -e "import('./scripts/lib/regression.mjs').then(async r=>console.log(await r.runValidate()))"
node scripts/orchestrator.mjs --task "实现后端登录模块" --validate --dry-run
```

## 失败与回滚
- 失败：`validate-structure.mjs` 输出格式变化导致解析失败 → 解析失败时返回 `ok:false` 并附 `raw`，**不要静默当作通过**。
- 回滚：删除 `regression.mjs`；还原 `orchestrator.mjs`；删除 `package.json`（若为本任务新增）。

## 风险与注意
- 解析校验器输出是脆弱耦合：优先让 `validate-structure.mjs` 输出稳定的关键行（如 `16/16 vendor`），如格式有变需同步更新解析正则。
- 簇化后期望值从 26 变为 16，**必须同步更新本任务的 `expected` 常量**（由 FE-06 提供准确值）。
- 回归必须在每次资产替换后运行（PRD §10 第 9 步），这是防退化的唯一关卡。

## 交付物检查清单
- [ ] `runValidate` 解析四项指标正确
- [ ] `--validate` 开关接入 orchestrator
- [ ] 16/16、0 警告、0 漂移、0 泄露
- [ ] `package.json` 提供 `npm run validate`
- [ ] SkillOps `sweep()` 对账结果已记录
