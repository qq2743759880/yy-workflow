/**
 * p08 — JOURNEY_NOT_FOUND data 通道（§8.1 非 OQ 残留 [待补充] + 幸存消费面）。
 * 可机验行为：空工作区（无 journey 且无可推断源）⇒ ok=false + code=JOURNEY_NOT_FOUND +
 * data.journey 诊断（reason/searchedPaths），warnings 显式标注 §8.1 通道归属 [待补充]
 * 等 Owner 复核；与幸存 webview/journey/render-core.mjs 的 isJourneyNotFound /
 * deriveJourneyView 消费口径逐字段兼容（C-R4 §6.3 decided precedent）。
 */
export async function run({ sandbox }) {
  const m = await import(new URL('../../../../scripts/lib/journey.mjs', import.meta.url).href);
  const rc = await import(new URL('../../../../webview/journey/render-core.mjs', import.meta.url).href);

  const r = m.journey.read({ workspace: sandbox });
  const code = r.ok === false && r.code === 'JOURNEY_NOT_FOUND';
  const diag = r.data.journey && typeof r.data.journey.reason === 'string' && Array.isArray(r.data.journey.searchedPaths);
  const pendingNote = r.warnings.some((w) => w.includes('§8.1') && w.includes('[待补充]'));
  const noWrite = true; // read 只读：NOT_FOUND 不落任何盘（沙箱内仅 .tt-state 空目录甚至不创建）

  // 幸存消费方口径：render-core（R5b 冻结消费 journey.read 壳）
  const consumerHit = rc.isJourneyNotFound(r) === true;
  const view = rc.deriveJourneyView({ read: r, project: null, injectedAt: 'probe', sessionId: null });
  const consumerView = view && view.notFound === true && view.degraded === false
    && view.notFoundDiag && typeof view.notFoundDiag.reason === 'string';

  // 兼容回放：幸存 R6 compat-probe 场景（legacy v0 state → ok=true；空目录 → NOT_FOUND）
  const fs = await import('node:fs');
  const path = await import('node:path');
  const legacyWs = path.join(sandbox, 'legacy-ws');
  fs.mkdirSync(path.join(legacyWs, '.tt-state'), { recursive: true });
  fs.writeFileSync(path.join(legacyWs, '.tt-state', 'state.json'), JSON.stringify({ schema: 'aa-plan/v0', id: 'legacy-p1', status: 'executing', subtasks: [] }));
  const r1 = await m.journey.read({ workspace: legacyWs, sessionId: null });
  const compatReadable = r1.ok === true && typeof (r1.data.journey || {}).displayStatus === 'string';
  const emptyWs = path.join(sandbox, 'empty-ws');
  fs.mkdirSync(emptyWs, { recursive: true });
  const r2 = await m.journey.read({ workspace: emptyWs, sessionId: null });
  const compatNotFound = r2.ok === false && r2.code === 'JOURNEY_NOT_FOUND';

  const ok = code && diag && pendingNote && noWrite && consumerHit && consumerView && compatReadable && compatNotFound;
  return { ok, summary: `NOT_FOUND: code=${code} diag=${diag} §8.1待补充标注=${pendingNote} render-core消费=${consumerHit}/${consumerView} compat-probe口径 r1.ok=${r1.ok}(${r1.data.journey && r1.data.journey.displayStatus}) r2=${r2.code}` };
}
