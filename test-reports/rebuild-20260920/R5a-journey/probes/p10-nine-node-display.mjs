/**
 * p10 — 9 节点显示 + 当前/下一步 + evidence refs（R5A-04 / dev-plan R5a GWT1 / OQ-R5-4=A / OQ-R5-6=A）。
 * 可机验行为：journey.read（full）返回 9 个节点（step 0-8，不是旧 8 phase）、当前状态、
 * 下一步、evidence refs；summary（缺省）模式连 phase/progress/next 都给；step 状态词表
 * 沿用 pending/in_progress/done；nextPrompt 由当前数据派生（无 SAMPLE）。
 */
import fs from 'node:fs';
import path from 'node:path';

export async function run({ sandbox }) {
  const m = await import(new URL('../../../../scripts/lib/journey.mjs', import.meta.url).href);
  const tt = path.join(sandbox, '.tt-state');
  fs.mkdirSync(tt, { recursive: true });
  const names = ['资产整合', '文档化', '重执行1', '拆任务', '重执行1,2', '规划+契约', '重执行1,2,3', '并行派单', '批判反哺'];
  const steps = names.map((n, i) => ({
    step: i, name: n, status: i <= 3 ? 'done' : (i === 5 ? 'in_progress' : 'pending'),
    gates_passed: i === 1 ? ['concept-signed'] : [], artifacts: [], updated_at: '2026-01-01T00:00:00.000Z',
  }));
  fs.writeFileSync(path.join(tt, 'journey.json'), JSON.stringify({ schema: 'yy/journey@1', steps, plans: [], updated_at: '2026-01-01T00:00:00.000Z' }));

  const full = m.journey.read({ workspace: sandbox, mode: 'full' });
  const j = full.data.journey;
  const nineNodes = j.steps.length === 9 && j.steps.map((s) => s.step).join(',') === '0,1,2,3,4,5,6,7,8';
  const notOldEight = j.steps[7].name === '并行派单' && j.steps[8].name === '批判反哺'; // 0-8 非 1-8 旧相
  const currentOk = j.current && j.current.step === 5 && j.phase && j.phase.step === 5;
  const nextOk = j.next && j.next.step === 7; // 正向主干 5 → 7
  const evidenceRefs = Array.isArray(j.evidence) && j.evidence.length > 0
    && j.evidence.every((e) => e.sourceKind && e.path !== undefined && 'sha256' in e && 'updatedAt' in e && 'sessionId' in e);
  const gatesEcho = j.gates.passed.includes('concept-signed') && j.gates.pending.includes('gate-a-approved');
  const npReal = j.nextPrompt && j.nextPrompt.targetNode && j.nextPrompt.targetNode.step === 7
    && !JSON.stringify(full).includes('SAMPLE');
  const statusVocab = j.steps.every((s) => ['pending', 'in_progress', 'done'].includes(s.status));

  // 缺省 summary 模式：phase/progress/next 必给（R5A-04 defect：summary 连 phase/progress/next 都不给）
  const sum = m.journey.read({ workspace: sandbox }); // 缺省 summary（OQ-R5-4=A）
  const sj = sum.data.journey;
  const summaryCore = sj.phase && sj.progress && sj.next && sj.progress.stepsTotal === 9 && sj.current.step === 5;

  const ok = nineNodes && notOldEight && currentOk && nextOk && evidenceRefs && gatesEcho && npReal && statusVocab && summaryCore;
  return { ok, summary: `9节点: nodes=${j.steps.length} current=${j.current.step} next=${j.next.step} evidence=${j.evidence.length} gates passed=${j.gates.passed.length}/pending=${j.gates.pending.length} summaryPhase/progress/next=${summaryCore} npTarget=${j.nextPrompt.targetNode.step}` };
}
