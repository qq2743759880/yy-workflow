# LEAK-1 派单 — 发布面历史本机痕迹清零（D-H2-1，Owner 2026-09-22 开单）

你是 autopilot 管线 L1 独立执行 agent（全新上下文）。工作区：`D:\.ai-hub\skills\yy`。完成后交付证据，不自称 DONE。

## 背景
`scripts/make-release.mjs` 的泄露审计（STEP 3）在 2026-09-22 首次全量审计时发现发布面 31 文件 67 处历史本机路径/用户名痕迹（绝对路径、用户名 Administrator、主机名等），因当时这些文件在白名单外不可修，做了 `GRANDFATHER_BASELINE` 基线冻结（约 174-180 行，含 31 文件清单与逐文件计数）。**Owner 已开单清零**：本任务把痕迹 scrub 干净并把基线复位为零。

## 任务
1. 从 `scripts/make-release.mjs` 的 `GRANDFATHER_BASELINE` 提取 31 文件清单（仓库源路径 = 发布面相对路径映射）。
2. 逐文件定位 67 处命中（审计模式清单在 make-release.mjs `AUDIT_TEXT_RE` + U+FFFD 检查；可参考 `test-reports/autopilot-work/HARD-2/count-leaks.mjs` 的计数逻辑），按语义 scrub：
   - 机器绝对路径 → 仓库相对路径或 `<workspace>` 占位符（按上下文选不误导读者的写法）
   - 用户名/主机名 → 通用形式（如 `~`、`<user>`）
   - 改动以最小 diff 为原则，不改文件的结构性语义（标题/表格/代码语义保持）
3. **冻结例外**：若某文件含显式冻结标记（contract freeze / FROZEN / 契约冻结面），不 scrub，如实登记 D-偏差并保留该文件的基线条目；其余文件的基线条目删除。
4. `GRANDFATHER_BASELINE` 复位：清理成功的文件从常量中移除；若全部清理成功则常量置空对象（保留注释说明基线机制仍在生效：新增命中即 FAIL）。
5. 验证链：
   - `node scripts/make-release.mjs --dry-run` → 审计段 GRANDFATHERED=0（或仅剩冻结例外）、新增 0
   - 真实 `node scripts/make-release.mjs` → exit 0，GRANDFATHERED=0/冻结例外数，PURGED 与幂等符合 HARD-2 语义
   - `node scripts/regression-all.mjs` 全绿（13/13）+ `node scripts/validate-structure.mjs` 0 警告
   - scrub 未引入新泄露：审计本身即验证

## 白名单
`GRANDFATHER_BASELINE` 清单内的 31 个源文件（冻结文件除外）、`scripts/make-release.mjs`（仅 GRANDFATHER_BASELINE 常量区）、证据目录 `test-reports/autopilot-work/LEAK-1/`。

## 禁止
改其他 scripts/、SKILL.md、commands/、webview/、contracts/、plans/、handoffs/、队列/看板；读 test-reports/acceptance-*/；git 操作；删除/重建 junction。

## 交付
`test-reports/autopilot-work/LEAK-1/RESULTS.md`：逐文件改动计数（前→后命中数）、冻结例外登记、验证链命令输出原文、D-xxx 偏差。

## 验收要点（编排者 L2 将复核）
make-release 审计 GRANDFATHERED=0 且新增 0；regression/validate 全绿；diff 最小化抽查。
