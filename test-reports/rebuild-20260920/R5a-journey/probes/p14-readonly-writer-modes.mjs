/**
 * p14 — 只读保证 + 唯一 projection writer（R5A-09 / §4.3 / OQ-R5-10=A / PRD0 §7 / D-7）。
 * 可机验行为：journey.read/journey.project 不写 state/receipt/override、不推进 step/gate；
 * journey.project 仅在 projection writer 模式（YY_JOURNEY_WRITER 未设 = MW0 双写窗口，或
 * =projection）且展示态健康（AUTHORIZED/OBSERVED）时落盘 journey.json；legacy 模式不落盘；
 * INFERRED 永不落盘；落盘文件与既有 tt-journey.mjs（yy/journey@1）兼容读取（字节往返），
 * B 面 gates_passed 置位记录保留。
 */
import fs from 'node:fs';
import path from 'node:path';

export async function run({ sandbox }) {
  const m = await import(new URL('../../../../scripts/lib/journey.mjs', import.meta.url).href);
  const ws = path.join(sandbox, 'ws');
  const tt = path.join(ws, '.tt-state');
  const art = path.join(ws, 'artifacts');
  fs.mkdirSync(tt, { recursive: true });
  fs.mkdirSync(path.join(art, 'p1'), { recursive: true });
  fs.mkdirSync(path.join(art, 's1'), { recursive: true });
  const stateFile = path.join(tt, 'state.json');
  const receiptFile = path.join(art, 's1', 'receipt.json');
  const summaryFile = path.join(art, 'p1', 'state-summary.json');
  fs.writeFileSync(stateFile, JSON.stringify({ schema: 'aa-plan/v1', id: 'p1', status: 'done', subtasks: [{ id: 's1', asset: 'sdlc', status: 'done' }] }));
  fs.writeFileSync(receiptFile, JSON.stringify({ subtaskId: 's1', assetId: 'sdlc', events: [{ transition: 'behavior_verified' }], result: 'VERIFIED' }));
  fs.writeFileSync(summaryFile, JSON.stringify({ schema: 'tt/state-summary@1', planId: 'p1', cluster: 'T1', status: 'done' }));
  // 固定权威源时点 = 记录时点（全对齐 ⇒ 无任何一方落后，非 STALE，可健康落盘）
  const SRC_T = new Date('2026-01-02T00:00:00.000Z');
  for (const f of [stateFile, receiptFile, summaryFile]) fs.utimesSync(f, SRC_T, SRC_T);
  const bytes = (f) => fs.readFileSync(f).toString('utf8');
  const before = { state: bytes(stateFile), receipt: bytes(receiptFile), summary: bytes(summaryFile) };

  // B 面置位记录预置：step5 done + contract-frozen gate（tt-journey --update 时代的既有记录形态）；
  // 记录时点晚于权威源（2026-01-02 > 2026-01-01），确保非 STALE、可健康落盘
  const names = ['资产整合', '文档化', '重执行1', '拆任务', '重执行1,2', '规划+契约', '重执行1,2,3', '并行派单', '批判反哺'];
  const recSteps = names.map((n, i) => ({ step: i, name: n, status: i === 5 ? 'done' : 'pending', gates_passed: i === 5 ? ['contract-frozen'] : [], artifacts: i === 5 ? ['contracts/p1.json'] : [], updated_at: '2026-01-02T00:00:00.000Z' }));
  fs.writeFileSync(path.join(tt, 'journey.json'), JSON.stringify({ schema: 'yy/journey@1', steps: recSteps, plans: [{ planId: '__manual__', status: 'prereq-bypassed', updatedAt: '2026-01-02T00:00:00.000Z', reason: 'seed' }], updated_at: '2026-01-02T00:00:00.000Z' }));

  // (1) read 只读：不写任何盘
  const r0 = m.journey.read({ workspace: ws });
  const readNoWrite = fs.existsSync(path.join(tt, 'journey.json')); // 已存在（预置），不被改写
  const readUnchanged = bytes(path.join(tt, 'journey.json')) === JSON.stringify({ schema: 'yy/journey@1', steps: recSteps, plans: [{ planId: '__manual__', status: 'prereq-bypassed', updatedAt: '2026-01-02T00:00:00.000Z', reason: 'seed' }], updated_at: '2026-01-02T00:00:00.000Z' });

  // (2) project（projection writer，未设 env = MW0 窗口）：落盘 journey.json，源文件字节不动
  delete process.env.YY_JOURNEY_WRITER;
  const p1 = m.journey.project({ workspace: ws });
  const persisted = p1.data.persistedTo !== null && fs.existsSync(path.join(tt, 'journey.json'));
  const sourcesUntouched = bytes(stateFile) === before.state && bytes(receiptFile) === before.receipt && bytes(summaryFile) === before.summary;

  // (3) 落盘文件与 tt-journey.mjs 兼容读取（字节往返）；gates_passed / __manual__ 留痕保留
  const tj = await import(new URL('../../../../scripts/tt-journey.mjs', import.meta.url).href);
  const jr = await tj.readJourney(ws, undefined);
  const ensured = tj.ensureSteps(jr);
  const rendered = tj.renderJourney(jr);
  const roundtrip = jr && jr.schema === 'yy/journey@1' && ensured.length === 9 && rendered.includes('并行派单');
  const gatesKept = jr.steps[5].gates_passed.includes('contract-frozen') && jr.steps[5].artifacts.includes('contracts/p1.json');
  const manualKept = Array.isArray(jr.plans) && jr.plans.some((p) => p.planId === '__manual__' && p.status === 'prereq-bypassed');
  const additive = jr.displayStatus === 'AUTHORIZED' && jr.nextPrompt && jr.projectionHash; // additive 投影字段在场

  // (4) legacy writer 模式：journey.project 不落盘（现状写路径所有）
  fs.rmSync(path.join(tt, 'journey.json'), { force: true });
  const p2 = m.journey.project({ workspace: ws, opts: { writerMode: 'legacy' } });
  const legacyNoWrite = !fs.existsSync(path.join(tt, 'journey.json'))
    && p2.warnings.some((w) => w.includes('legacy') && w.includes('不落盘'));

  // (5) INFERRED 永不落盘（仅旁证场景）
  const ws2 = path.join(sandbox, 'ws2');
  fs.mkdirSync(path.join(ws2, 'artifacts', 'p9'), { recursive: true });
  fs.writeFileSync(path.join(ws2, 'artifacts', 'p9', 'state-summary.json'), JSON.stringify({ schema: 'tt/state-summary@1', planId: 'p9', status: 'done' }));
  const p3 = m.journey.project({ workspace: ws2 });
  const inferredNoWrite = p3.data.projection.displayStatus === 'INFERRED' && !fs.existsSync(path.join(ws2, '.tt-state', 'journey.json'));

  const ok = readNoWrite && readUnchanged && persisted && sourcesUntouched && roundtrip && gatesKept && manualKept && additive && legacyNoWrite && inferredNoWrite;
  return { ok, summary: `只读+writer: read不改写=${readUnchanged} project落盘=${persisted} 源字节不动=${sourcesUntouched} tt-journey兼容读取+9节点=${roundtrip} gates/留痕保留=${gatesKept}/${manualKept} additive=${additive} legacy不落盘=${legacyNoWrite} INFERRED不落盘=${inferredNoWrite}` };
}
