/**
 * p13 — real nextPrompt（R5A-07 / dev-plan R5a GWT4 / OQ-R5-5=A / D-4）。
 * 可机验行为：nextPrompt = 结构化对象 {actionHint, targetNode, requiredInputs[]} + 生成时
 * projection 快照哈希回声；由当前投影数据派生（数据变 → nextPrompt 变），不返回固定 SAMPLE；
 * 复制 = 快照引用不重算（copyNextPrompt 纯函数，snapshotRef.recompute=false）。
 */
import fs from 'node:fs';
import path from 'node:path';

export async function run({ sandbox }) {
  const m = await import(new URL('../../../../scripts/lib/journey.mjs', import.meta.url).href);
  const NOW = new Date('2026-01-01T00:00:00.000Z');
  const opts = { now: NOW };

  // 场景 A：空旅程 → 下一节点 step1（需 gate: concept-signed）
  const a = m.journey.project({
    workspace: sandbox, mode: 'full',
    state: { id: 'p1', status: 'idle', subtasks: [] }, receipts: [], logs: [],
    opts,
  });
  const npA = a.data.projection.nextPrompt;
  const aOk = npA && npA.targetNode && npA.targetNode.step === 1 && npA.targetNode.name === '文档化';
  const aInputs = npA.requiredInputs.some((x) => x.startsWith('gate:concept-signed'))
    && npA.requiredInputs.some((x) => x.startsWith('step:0'));

  // 场景 B：记录推进到 step5 in_progress → 下一节点 step7（同一 workspace、不同数据）
  const tt = path.join(sandbox, '.tt-state');
  const names = ['资产整合', '文档化', '重执行1', '拆任务', '重执行1,2', '规划+契约', '重执行1,2,3', '并行派单', '批判反哺'];
  const steps = names.map((n, i) => ({ step: i, name: n, status: [0, 1, 3].includes(i) ? 'done' : (i === 5 ? 'in_progress' : 'pending'), gates_passed: i === 5 ? ['contract-frozen'] : [], artifacts: [], updated_at: NOW.toISOString() }));
  fs.mkdirSync(tt, { recursive: true });
  fs.writeFileSync(path.join(tt, 'journey.json'), JSON.stringify({ schema: 'yy/journey@1', steps, plans: [], updated_at: NOW.toISOString() }));
  const b = m.journey.project({
    workspace: sandbox, mode: 'full',
    state: { id: 'p1', status: 'executing', subtasks: [] }, receipts: [], logs: [],
    opts,
  });
  const npB = b.data.projection.nextPrompt;
  const bOk = npB && npB.targetNode && npB.targetNode.step === 7;

  const derived = aOk && bOk && npA.targetNode.step !== npB.targetNode.step; // 随当前数据派生，非固定值
  const hashEcho = /^[0-9a-f]{64}$/.test(npA.snapshotHash || '') && /^[0-9a-f]{64}$/.test(npB.snapshotHash || '');
  const noSample = !JSON.stringify([a, b]).includes('SAMPLE');
  const structured = Array.isArray(npB.requiredInputs) && typeof npB.actionHint === 'string' && npB.actionHint.length > 0;

  // 复制 = 快照引用，不重算：copyNextPrompt 纯函数，两次复制一致，recompute=false
  const copy1 = m.copyNextPrompt(b);
  const copy2 = m.copyNextPrompt(b.data.projection);
  const copyOk = copy1 && copy2
    && copy1.snapshotRef.recompute === false && copy2.snapshotRef.recompute === false
    && copy1.snapshotRef.snapshotHash === npB.snapshotHash
    && copy2.snapshotRef.snapshotHash === npB.snapshotHash
    && copy1.actionHint === npB.actionHint
    && copy1.requiredInputs.join('|') === npB.requiredInputs.join('|');

  const ok = derived && hashEcho && noSample && structured && aInputs && copyOk;
  return { ok, summary: `nextPrompt: A.target=${npA.targetNode.step} B.target=${npB.targetNode.step} 派生=${derived} hashEcho=${hashEcho} 结构化=${structured} gate/step前置=${aInputs} copy=快照引用不重算=${copyOk}` };
}
