# R-2 派单 — package.json 名义依赖清理（批 2 第一波，与 PC-1 并行写面不相交）

你是 autopilot 管线 L1 独立执行 agent（全新上下文）。工作区：`D:\.ai-hub\skills\yy`。先读 `test-reports/autopilot-work/AS-1/RESULTS.md` R-2 项（culori/chroma-js/poline/tsyringe/inversify/cockatiel/polly-js 七项孤儿依赖移交）与 `plans/batch2-dispatch-plan-20260926.md`。完成后交付证据，不自称 DONE。

## 任务
1. **活引用核实**：七项依赖逐个全仓 grep（排除 node_modules/test-reports/docs/history）——确认删除后零 import/require 引用（AS-1 已删 5 孤儿脚本，理论零引用，须实测）；
2. package.json 删除七项 dependencies/devDependencies；
3. `npm install --package-lock-only`（或等效）重生成 lock；node_modules 同步清理（`npm prune` 或重装）；
4. **回归三件**：regression 24 项 + preflight 8 项 + validate 0 全绿（证明七项真无消费——若某项真被引用，该项**保留**并登记 D-偏差"核实有误"）；
5. manifest hash 零变化验证。

## 白名单
package.json、package-lock.json、test-reports/autopilot-work/R-2/。node_modules 变化不入库。

## 禁止
改其他任何文件；禁 git。

## 自测（证据落 R-2 目录）
1. 七项逐个 grep 证据（零活引用/或发现引用保留）；
2. lock 重生成 diff 摘要；
3. 回归三件全绿；
4. RESULTS.md：逐项结论 + D-偏差。