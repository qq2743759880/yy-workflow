/** p03 — GWT-R4-03 session isolation（清单 R4-03）：双会话 state/审计各归各 namespace 不串写；跨会话写入禁止；非法 session ⇒ SESSION_INVALID；legacy 无 session 路径迁移窗口内保持可读。 */
import fs from 'node:fs';
import path from 'node:path';
import phase from '../../../scripts/lib/phase.mjs';
import { NOW, stateFixture, seedState, shellOk, verdict } from './_helpers.mjs';

export async function run({ sandbox }) {
  const checks = [];
  const c = (name, pass) => checks.push({ name, pass });
  const env = { YY_SESSION_MODE: 'namespaced' };
  const ws = path.join(sandbox, 'ws-ns');
  fs.mkdirSync(ws, { recursive: true });

  // 双会话各写各的 namespace（A: idle→planning；B: idle→failed 负向合法，内容可区分）
  const trA = await phase.transitionPhase({ workspace: ws, from: 'idle', to: 'planning', session: 'A', opts: { now: NOW, env } });
  const trB = await phase.transitionPhase({ workspace: ws, from: 'idle', to: 'failed', session: 'B', opts: { now: NOW, env } });
  c('A.ok', trA.ok === true && trA.data.sessionId === 'A');
  c('B.ok', trB.ok === true && trB.data.sessionId === 'B');
  const stA = JSON.parse(fs.readFileSync(path.join(ws, '.tt-state', 'A', 'state.json'), 'utf8'));
  const stB = JSON.parse(fs.readFileSync(path.join(ws, '.tt-state', 'B', 'state.json'), 'utf8'));
  c('A.status', stA.status === 'planning');
  c('B.status', stB.status === 'failed');
  c('noRootState', !fs.existsSync(path.join(ws, '.tt-state', 'state.json')));
  c('auditNamespaced', fs.existsSync(path.join(ws, '.tt-state', 'A', 'transitions.jsonl')) && fs.existsSync(path.join(ws, '.tt-state', 'B', 'transitions.jsonl')) && !fs.existsSync(path.join(ws, '.tt-state', 'transitions.jsonl')));
  c('onlyAandBDirs', JSON.stringify(fs.readdirSync(path.join(ws, '.tt-state')).sort()) === JSON.stringify(['A', 'B']));

  // 跨 session 只读对账允许（check 按 session namespace 读），写入禁止（B 状态未被 A 触碰——上面已验 status 区分）
  const chkB = await phase.checkPhase({ workspace: ws, from: 'planning', to: 'executing', session: 'B', opts: { now: NOW, env } });
  c('crossReadNamespaced', chkB.ok === true && chkB.evidence.sessionEcho === 'B' && chkB.evidence.snapshot !== null);

  // 非法 session id ⇒ SESSION_INVALID fail-closed（防路径穿越白名单）
  const bad = await phase.transitionPhase({ workspace: ws, from: 'idle', to: 'planning', session: '../evil', opts: { now: NOW, env } });
  c('badSession.transition', bad.ok === false && bad.code === 'SESSION_INVALID' && shellOk(bad));
  const bad2 = await phase.checkPhase({ workspace: ws, target: 5, session: 'a b', opts: { now: NOW, env } });
  c('badSession.check', bad2.ok === false && bad2.code === 'SESSION_INVALID');

  // legacy 无 session 路径迁移窗口内保持可读（.tt-state/ 根路径现状语义）
  const wsLegacy = path.join(sandbox, 'ws-legacy');
  seedState(wsLegacy, stateFixture({ status: 'planning' }));
  const chkL = await phase.checkPhase({ workspace: wsLegacy, from: 'planning', to: 'executing', opts: { now: NOW } });
  c('legacyReadable', chkL.ok === true && chkL.evidence.sessionEcho === null && chkL.evidence.stateVersionEcho === 0);

  return verdict(checks, 'gwt-r4-03');
}
