# T6 修复回归报告（S4/S5/S8 隔离）

## 根因（一句话）
T6 修复后 opencode adapter 真调 `opencode run <msg>`，S4/S5/S8 的 orchestrator 调用仍用 auto 后端 → implementation 子任务走 opencode CLI 真调本机不可用模型（gpt-5.6-luna 上游不可用）→ subtask failed → S4a.ok/S5a.ok/S8.ok = false → 回归 5/8。

## Diff
`git diff scripts/regression-all.mjs`（仅 --backend prompt 参数与注释，逻辑零改动）：

```diff
-  // S4 契约工作流 smoke（BE-13）：冻结生成 + resume 复用 + 执行期篡改 → exit 4（json gate 真实生效）
-  const s4a = await run(process.execPath, ['scripts/orchestrator.mjs', '--task', 'backend login module', '--workspace', tmpWs]);
+  // S4 契约工作流 smoke（BE-13）：冻结生成 + resume 复用 + 执行期篡改 → exit 4（json gate 真实生效）。
+  // 显式 --backend prompt：机制测试须隔离外部 CLI/模型依赖，prompt 后端下所有子任务走内置 prompt
+  // adapter + --exec 宿主，不触发 opencode CLI 真调（T6 修复后 auto 后端会真调 opencode run）。
+  const s4a = await run(process.execPath, ['scripts/orchestrator.mjs', '--backend', 'prompt', '--task', 'backend login module', '--workspace', tmpWs]);
   const s4contracts = fs.existsSync(path.join(tmpWs, 'contracts')) && fs.readdirSync(path.join(tmpWs, 'contracts')).some(function (f) { return f.endsWith('.json'); });
-  const s4resume = await run(process.execPath, ['scripts/orchestrator.mjs', '--resume', '--workspace', tmpWs]);
+  const s4resume = await run(process.execPath, ['scripts/orchestrator.mjs', '--backend', 'prompt', '--resume', '--workspace', tmpWs]);
@@
-  const s4tamper = await run(process.execPath, ['scripts/orchestrator.mjs', '--task', 'backend login module', '--workspace', tmpWs, '--exec', ...]);
+  const s4tamper = await run(process.execPath, ['scripts/orchestrator.mjs', '--backend', 'prompt', '--task', 'backend login module', '--workspace', tmpWs, '--exec', ...]);
-  // S5 宿主执行 smoke（BE-14）：stdout 输出 → mode=exec；写产物文件(无 stdout) → mode=exec；空输出 → mode=prompt 降级
-  const s5a = await run(process.execPath, ['scripts/orchestrator.mjs', '--task', 'backend login module', '--workspace', tmpWs, '--exec', ...]);
+  // S5 宿主执行 smoke（BE-14）：stdout 输出 → mode=exec；写产物文件(无 stdout) → mode=exec；空输出 → mode=prompt 降级。
+  // 显式 --backend prompt：机制测试须隔离外部 CLI/模型依赖，不依赖 opencode 真调。
+  const s5a = await run(process.execPath, ['scripts/orchestrator.mjs', '--backend', 'prompt', '--task', 'backend login module', '--workspace', tmpWs, '--exec', ...]);
-  const s5c = await run(process.execPath, ['scripts/orchestrator.mjs', '--task', 'backend login module', '--workspace', tmpWs, '--exec', ...]);
+  const s5c = await run(process.execPath, ['scripts/orchestrator.mjs', '--backend', 'prompt', '--task', 'backend login module', '--workspace', tmpWs, '--exec', ...]);
@@
   // S8 资产消费证据（D-1 强化）：宿主从 brief 提取方法论标题锚点 + Execution kernel 内核词写产物
-  //（kernel 资产须锚点 AND ≥1 内核词，仅锚点会被判 assetConsumed=false）→ 正向：exec 全 true
+  //（kernel 资产须锚点 AND ≥1 内核词，仅锚点会被判 assetConsumed=false）→ 正向：exec 全 true。
+  // 显式 --backend prompt：机制测试须隔离外部 CLI/模型依赖，不依赖 opencode 真调。
-  const s8 = await run(process.execPath, ['scripts/orchestrator.mjs', '--task', 'backend login module', '--workspace', s8ws, '--exec', ...]);
+  const s8 = await run(process.execPath, ['scripts/orchestrator.mjs', '--backend', 'prompt', '--task', 'backend login module', '--workspace', s8ws, '--exec', ...]);
-  const s8n = await run(process.execPath, ['scripts/orchestrator.mjs', '--task', 'backend login module', '--workspace', s8ws, '--exec', ...]);
+  const s8n = await run(process.execPath, ['scripts/orchestrator.mjs', '--backend', 'prompt', '--task', 'backend login module', '--workspace', s8ws, '--exec', ...]);
```

未改动：opencode.mjs / runtime.mjs / prompt.mjs / orchestrator.mjs / 其他回归段逻辑；s5b 原有 `--backend prompt` 保持不动。

## 回归结果
- `node scripts/regression-all.mjs` → **8 PASS / 0 FAIL**，exit 0（S4 篡改→exit4 ✓；S5 stdout→exec / 写文件→exec / 空输出→prompt 降级 ✓；S8 exec=8 false(正)=0 false(负)=>7 ✓）
- `node scripts/validate-structure.mjs` → **0 警告**

诚实备注：工作树另有 T6 既有未提交改动（opencode.mjs / orchestrator.mjs / README.md / CHANGELOG.md），非本次任务改动。
