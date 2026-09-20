/**
 * p15 — evidence links 形状（OQ-R5-6=A / §4.1）。
 * 可机验行为：data.journey.evidence 为数组，每条 {sourceKind: state|receipts|logs|gates,
 * path, sha256, updatedAt, sessionId}（与 R8 sourceAnchor 同构）；磁盘源的 sha256 与文件
 * 字节一致；logs 证据必标 inferred；shell.evidence.sources 与 body evidence 同源同构；
 * summary 模式不带全量 evidence 数组（OQ-R5-4=A：full = 节点+资产+evidence 全量）。
 */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

import { writeJsonFixed } from './_helper.mjs';

export async function run({ sandbox }) {
  const m = await import(new URL('../../../../scripts/lib/journey.mjs', import.meta.url).href);
  const tt = path.join(sandbox, '.tt-state', 's-evid');
  const art = path.join(tt, 'artifacts');
  fs.mkdirSync(path.join(art, 's1'), { recursive: true });
  fs.mkdirSync(path.join(art, 'p1'), { recursive: true });
  const stateFile = path.join(tt, 'state.json');
  const receiptFile = path.join(art, 's1', 'receipt.json');
  const summaryFile = path.join(art, 'p1', 'state-summary.json');
  // T8 加固①：mtime 统一固定（state/receipts 同刻 ⇒ 相对 STALE 判据不可能由夹具诱发）
  writeJsonFixed(stateFile, { schema: 'aa-plan/v1', id: 'p1', status: 'done', subtasks: [{ id: 's1', asset: 'sdlc', status: 'done' }] });
  writeJsonFixed(receiptFile, { subtaskId: 's1', assetId: 'sdlc', events: [{ transition: 'behavior_verified' }], result: 'VERIFIED' });
  writeJsonFixed(summaryFile, { schema: 'tt/state-summary@1', planId: 'p1', cluster: 'T1', status: 'done' });
  const sha = (f) => crypto.createHash('sha256').update(fs.readFileSync(f)).digest('hex');

  const r = m.journey.project({ workspace: sandbox, session: 's-evid', mode: 'full' });
  const j = r.data.projection;
  const links = j.evidence;
  const isArray = Array.isArray(links) && links.length >= 3;
  const BASE_KEYS = ['sourceKind', 'path', 'sha256', 'updatedAt', 'sessionId'].sort().join(',');
  const FULL_KEYS = ['sourceKind', 'path', 'sha256', 'updatedAt', 'sessionId', 'inferred'].sort().join(',');
  const shapeOk = links.every((e) => {
    const keys = Object.keys(e).sort().join(',');
    return keys === BASE_KEYS || keys === FULL_KEYS;
  });
  const kindsOk = links.every((e) => ['state', 'receipts', 'logs', 'gates'].includes(e.sourceKind));
  const stateLink = links.find((e) => e.sourceKind === 'state');
  const receiptLink = links.find((e) => e.sourceKind === 'receipts');
  const logLink = links.find((e) => e.sourceKind === 'logs');
  const shaOk = stateLink && stateLink.sha256 === sha(stateFile)
    && receiptLink && receiptLink.sha256 === sha(receiptFile)
    && logLink && logLink.sha256 === sha(summaryFile);
  const logInferred = logLink && logLink.inferred === true
    && links.filter((e) => e.sourceKind !== 'logs').every((e) => e.inferred === undefined);
  const sessionEcho = links.every((e) => e.sessionId === 's-evid');
  const pathNs = links.every((e) => typeof e.path === 'string' && e.path.includes('.tt-state/s-evid/'));
  const shellSame = JSON.stringify(r.evidence.sources) === JSON.stringify(links);
  const countEcho = j.evidenceCount === links.length;

  // summary 模式：不带全量 evidence 数组（全量归 full，OQ-R5-4=A）
  const sum = m.journey.read({ workspace: sandbox, session: 's-evid' }); // 缺省 summary
  const summaryNoFullEvidence = sum.data.journey.evidence === undefined && sum.data.journey.assets === undefined;

  const ok = isArray && shapeOk && kindsOk && shaOk && logInferred && sessionEcho && pathNs && shellSame && countEcho && summaryNoFullEvidence;
  return { ok, summary: `evidence: n=${links.length} shape=${shapeOk} kinds=${kindsOk} sha256字节一致=${shaOk} logs标inferred=${logInferred} session回声=${sessionEcho} ns路径=${pathNs} shell同构=${shellSame} count=${countEcho} summary无全量=${summaryNoFullEvidence}` };
}
