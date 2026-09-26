// E2E-v3 evidence runner（只读投影消费者，非 dispatch 探针）：
// 经生产 scripts/lib/journey.mjs journeyRead 读取 workspace 真实 state.json 的投影行，
// 导出 subtasks 行三字段（D.7），供 RESULTS.md 断言。零写面（除本目录 dump 输出）。
import { journeyProject } from '../../../scripts/lib/journey.mjs';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const wsArg = process.argv[2];
const outArg = process.argv[3];
const workspace = path.isAbsolute(wsArg) ? wsArg : path.join(here, wsArg);
const res = journeyProject({ kind: 'journey.project', workspace, mode: 'full' });const dump = {
  workspace: workspace.split(path.sep).join('/'),
  ok: res.ok, code: res.code || null,
  subtaskRows: [],
  planRows: [],
};
const proj = (res.data && (res.data.projection || res.data.journey)) || {};
const plans = proj.plans || [];
dump.subtaskRows = (proj.subtasks || []).map((st) => ({
  subtaskId: st.subtaskId, asset: st.asset ?? null, status: st.status ?? null,
  capability: st.capability ?? null, capabilitySource: st.capabilitySource ?? null, selectedAsset: st.selectedAsset ?? null,
}));
for (const p of plans) {
  dump.planRows.push({ planId: p.planId, cluster: p.cluster ?? null, status: p.status ?? null, provenance: p.provenance ?? null, inferred: p.inferred ?? null });
}
const out = path.join(here, outArg);
fs.writeFileSync(out, JSON.stringify(dump, null, 2));
console.log('wrote', outArg, 'ok=' + res.ok, (res.code || ''), 'subtaskRows=' + dump.subtaskRows.length);
for (const r of dump.subtaskRows) console.log(JSON.stringify(r));
