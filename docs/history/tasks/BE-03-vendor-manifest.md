# Task: BE-03 VendorManifest 扫描器

## 概述
扫描 `vendor/` 目录，生成结构化的资产清单 `VendorManifest`（每项含 name / type(skill|agent) / path / 关键词），供 planner 路由使用。这是让内核「知道自己有什么武器」的前提。

## 所属与定位
- **阶段**：MVP / Phase 0
- **层级**：Backend（运行时）
- **上游依赖**：BE-01（脚手架）
- **下游被依赖**：BE-04（planner 路由依赖清单）、FE-06（簇化后清单需同步）、BE-12（回归校验）

## 目标与非目标
**目标**
- 扫描 `vendor/<name>/`，识别 skill 型（含 `SKILL.md`）与 agent 型（含 `<name>.md`）。
- 解析每个 `SKILL.md` 的 frontmatter（name / description / version），缺失则记录警告。
- 输出 `VendorManifest` 并可缓存到 `.tt-state/manifest.json`。

**非目标**
- 不做路由决策（BE-04）、不修改任何 vendor 文件。

## 前置条件
- BE-01 完成；`vendor/` 存在 26 个资产目录（MVP 簇化后为 16）。
- 注意：`validate-structure.mjs` 已有 `SKILL_ENTRIES` / `AGENT_ENTRIES` 常量，本任务应**复用其判定规则**保持一致性（读取或对齐，不重复造轮子）。

## 输入
- `vendor/` 目录树；`SKILL.md`（如需读取矩阵定义，本任务只读不解析）。

## 需要创建 / 修改的文件

| 文件 | 动作 | 说明 |
|---|---|---|
| `scripts/lib/manifest.mjs` | 改写 | 实现 `scanVendor()` / `buildManifest()` / `loadManifest()` |
| `.tt-state/manifest.json` | 运行时生成 | 缓存清单（已被 `.gitignore` 覆盖） |

## 实现步骤
1. 用 `node:fs/promises` 读取 `vendor/` 下所有一级子目录。
2. 对每个子目录判定类型：
   - 存在 `SKILL.md` → `type: 'skill'`，解析其 YAML frontmatter（`---` 包裹）取 `name` / `description` / `version`。
   - 否则若存在 `<dirname>.md` → `type: 'agent'`，无 frontmatter，`version` 记为 `null`。
   - 两者皆无 → 记录到 `warnings[]`，不计入 manifest。
3. 提取关键词：从 `name` + `description` 中切词（空格/斜杠/下划线），用于 BE-04 的关键词匹配。
4. 实现 `buildManifest({ vendorDir })` 返回 `{ generatedAt, entries: VendorEntry[], warnings: string[] }`。
5. 实现 `loadManifest({ vendorDir, refresh })`：优先读缓存 `.tt-state/manifest.json`，`refresh=true` 或缓存不存在时重新扫描并写缓存。
6. 对所有路径使用 `path.relative`，禁止输出绝对路径（可移植性硬要求）。

## 关键契约 / 数据结构

```js
/**
 * @typedef {Object} VendorEntry
 * @property {string} name        // 目录名
 * @property {'skill'|'agent'} type
 * @property {string} path        // 相对路径，如 'vendor/be-tester'
 * @property {string|null} version
 * @property {string} description
 * @property {string[]} keywords
 */
/**
 * @typedef {Object} VendorManifest
 * @property {string} generatedAt
 * @property {VendorEntry[]} entries
 * @property {string[]} warnings
 */
export async function buildManifest({ vendorDir }) { /* ... */ }
export async function loadManifest({ vendorDir, refresh = false }) { /* ... */ }
```

## 验收标准（Given / When / Then）
- Given `vendor/` 含 26 个资产（簇化前），When 执行 `buildManifest`，Then 返回 `entries.length === 26` 且每个 entry 含 name/type/path 三个非空字段。
- Given 某个 skill 型资产（如 `vendor/be-tester` 含 `SKILL.md`），When 扫描，Then 其 `type === 'skill'` 且 `version` 取自 frontmatter。
- Given 某个 agent 型资产（如 `vendor/dev-planner` 含 `dev-planner.md`），When 扫描，Then 其 `type === 'agent'` 且 `version === null`。
- Given 一个既无 `SKILL.md` 又无同名 `.md` 的空目录，When 扫描，Then 该目录出现在 `warnings[]` 且不进入 `entries`。
- Given 生成的 manifest，When 检查任意 entry.path，Then 该路径为相对路径（不以盘符或 `/` 开头）。
- Given 首次执行生成缓存后，When 再次调用 `loadManifest()`（不 refresh），Then 从 `.tt-state/manifest.json` 读取而非重新扫描（可用 mtime 或日志验证）。

## 验证命令
```bash
cd D:/.ai-hub/skills/tt
node -e "import('./scripts/lib/manifest.mjs').then(async m=>{const mf=await m.buildManifest({vendorDir:'vendor'});console.log(mf.entries.length, mf.warnings.length)})"
node -e "import('./scripts/lib/manifest.mjs').then(async m=>{const mf=await m.buildManifest({vendorDir:'vendor'});console.log(JSON.stringify(mf.entries.filter(e=>e.type==='agent').map(e=>e.name)))})"
```

## 失败与回滚
- 失败：`vendor/` 不存在 → 返回空 entries + 一条 warning，不抛错（保证内核可启动）。
- 回滚：恢复 `manifest.mjs` 为占位实现；删除 `.tt-state/manifest.json`。

## 风险与注意
- frontmatter 解析要容忍 CRLF（`\r\n`），TT 仓库中曾出现 CRLF 导致的解析问题。
- 扫描结果必须与 `validate-structure.mjs` 的 26/26（簇化后 16/16）一致，否则说明判定规则漂移——应在 BE-12 中对账。

## 交付物检查清单
- [ ] `buildManifest` 正确区分 skill / agent
- [ ] `warnings` 收录异常目录
- [ ] `loadManifest` 缓存生效
- [ ] 所有路径为相对路径、无绝对路径泄露
