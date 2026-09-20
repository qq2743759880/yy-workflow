/**
 * p05 — report 聚合验证：每资产计数、阶段×资产 bucketing、零调用清单、
 *   journey 缺失→全 unknown、JSONL 畸形 fail-closed。
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadRecords, loadJourneyTimeline, aggregate, renderReport } from '../../../../scripts/asset-io-report.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, '..', '..', '..', '..');

export async function run({ sandbox }) {
  // 合成 JSONL
  const jsonl = path.join(sandbox, 'records.jsonl');
  fs.writeFileSync(jsonl, [
    JSON.stringify({ ts: '2026-09-20T00:30:00.000Z', pid: 1, cwd: 'x', op: 'readFileSync', path: '/repo/vendor/agent-research/alg.md', tag: 'routing' }),
    JSON.stringify({ ts: '2026-09-20T01:30:00.000Z', pid: 1, cwd: 'x', op: 'readFile', path: '/repo/vendor/implementation/impl.md', tag: 'consumption' }),
    JSON.stringify({ ts: '2026-09-20T02:30:00.000Z', pid: 1, cwd: 'x', op: 'readFileSync', path: '/repo/vendor/security/sec.md', tag: 'consumption' }),
  ].join('\n') + '\n', 'utf8');

  // 合成 journey.json（三个阶段时点）
  const ws = path.join(sandbox, 'ws');
  fs.mkdirSync(path.join(ws, '.tt-state'), { recursive: true });
  fs.writeFileSync(path.join(ws, '.tt-state', 'journey.json'), JSON.stringify({
    schema: 'yy/journey@1',
    steps: [
      { step: 0, name: '资产整合', status: 'done', updated_at: '2026-09-20T00:00:00.000Z' },
      { step: 1, name: '文档化', status: 'done', updated_at: '2026-09-20T01:00:00.000Z' },
      { step: 5, name: '规划+契约', status: 'done', updated_at: '2026-09-20T02:00:00.000Z' },
    ],
  }), 'utf8');

  const records = loadRecords([jsonl]);
  const timeline = loadJourneyTimeline(ws);
  const agg = aggregate(records, timeline);

  const ar = agg.perAsset.get('agent-research');
  const im = agg.perAsset.get('implementation');
  const se = agg.perAsset.get('security');

  // 阶段 bucketing：逐条落到对应阶段
  const stageOf = (asset) => {
    for (const st of agg.stageRows) {
      const row = agg.stageSet.get(st);
      const c = row.get(asset);
      if (c && (c.routing + c.consumption) > 0) return st;
    }
    return null;
  };
  const stageAR = stageOf('agent-research');
  const stageIM = stageOf('implementation');
  const stageSE = stageOf('security');

  const ok1 = ar.routing === 1 && im.consumption === 1 && se.consumption === 1;
  const ok2 = agg.zeroCall.length === 13; // 16 - 3 被读
  const ok3 = String(stageAR).includes('step0') && String(stageIM).includes('step1') && String(stageSE).includes('step5');

  // journey 缺失 → 全 unknown + warning
  const emptyWs = path.join(sandbox, 'empty-ws');
  fs.mkdirSync(emptyWs, { recursive: true });
  const noJourney = loadJourneyTimeline(emptyWs);
  const aggNo = aggregate(loadRecords([jsonl]), noJourney);
  const ok4 = noJourney.present === false && typeof noJourney.warning === 'string' &&
    aggNo.stageRows.length === 1 && aggNo.stageRows[0] === 'unknown';

  // fail-closed：畸形 JSONL 行
  const bad = path.join(sandbox, 'bad.jsonl');
  fs.writeFileSync(bad, '{"ok":true}\n{broken json\n', 'utf8');
  let threw = false;
  try { loadRecords([bad]); } catch { threw = true; }
  const ok5 = threw;

  // 渲染冒烟（写进 sandbox，不外泄）
  const md = renderReport('p05-sample', [jsonl], records, timeline, agg);
  const ok6 = md.includes('每资产计数') && md.includes('零调用');

  const ok = ok1 && ok2 && ok3 && ok4 && ok5 && ok6;
  return {
    ok,
    summary: `计数(routing=${ar.routing}, impl=${im.consumption}, sec=${se.consumption}) 零调用=${agg.zeroCall.length} 阶段=[${stageAR}|${stageIM}|${stageSE}] journey缺失全unknown=${ok4} 畸形抛错=${threw} 渲染=${ok6}`,
  };
}
