/** p09 — session 模式与 flag 纪律（§2.1/§8.1，OQ-R4-4/7=A）：strict 缺省自动生成 UUIDv4 + 元数据三字段同源可查；YY_ 优先/TT_ 回退双读；flag 非法 fail-closed 禁 silent fallback；namespaced 写入生效。 */
import fs from 'node:fs';
import path from 'node:path';
import phase from '../../../scripts/lib/phase.mjs';
import { NOW, stateFixture, seedState, shellOk, verdict } from './_helpers.mjs';

const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

export async function run({ sandbox }) {
  const checks = [];
  const c = (name, pass) => checks.push({ name, pass });

  // (1) strict 缺省自动生成 UUIDv4（OQ-R4-4=B）+ 生成时间/生成方/算法版本写入 state 元数据
  const wsStrict = path.join(sandbox, 'ws-strict');
  seedState(wsStrict, stateFixture({ status: 'idle' }));
  const tr = await phase.transitionPhase({ workspace: wsStrict, from: 'idle', to: 'planning', opts: { now: NOW, env: { YY_GATE_MODE: 'strict' } } });
  c('strict.autoSession', tr.ok === true && UUID_V4.test(tr.data.sessionId));
  const st = JSON.parse(fs.readFileSync(path.join(wsStrict, '.tt-state', 'state.json'), 'utf8'));
  c('strict.metaFields', !!st.sessionMeta && st.sessionMeta.algorithmVersion === 'uuidv4' && typeof st.sessionMeta.generatedAt === 'string' && st.sessionMeta.generatedBy === 'phase.transition');
  c('strict.metaSameSource', st.sessionMeta.sessionId === tr.data.sessionId); // 与 receipt session 字段同源可查

  // (2) YY_ 优先 / TT_ 兼容回退（MW0 双读，OQ-R4-7=A）
  const r1 = phase.resolveGateMode({ YY_GATE_MODE: 'strict', TT_GATE_MODE: 'warn' });
  c('dual.yyPriority', r1.ok === true && r1.mode === 'strict' && r1.source === 'YY_GATE_MODE');
  const r2 = phase.resolveGateMode({ TT_GATE_MODE: 'warn' });
  c('dual.ttFallback', r2.ok === true && r2.mode === 'legacy-warn');
  const r3 = phase.resolveGateMode({});
  c('dual.default', r3.ok === true && r3.mode === 'legacy-warn' && r3.source === 'default');

  // (3) flag 非法 ⇒ fail-closed 禁 silent fallback（§8.1；码名 GATE_MODE_UNSUPPORTED 为重建推断，见偏差表）
  const wsFlag = path.join(sandbox, 'ws-flag');
  seedState(wsFlag, stateFixture({ status: 'idle' }));
  const f1 = await phase.transitionPhase({ workspace: wsFlag, from: 'idle', to: 'planning', opts: { now: NOW, env: { YY_GATE_MODE: 'bogus' } } });
  c('flag.yyBogus', f1.ok === false && f1.code === 'GATE_MODE_UNSUPPORTED' && shellOk(f1));
  const f2 = await phase.transitionPhase({ workspace: wsFlag, from: 'idle', to: 'planning', opts: { now: NOW, env: { TT_GATE_MODE: 'bogus' } } });
  c('flag.ttBogus', f2.ok === false && f2.code === 'GATE_MODE_UNSUPPORTED');
  const f3 = await phase.transitionPhase({ workspace: wsFlag, from: 'idle', to: 'planning', opts: { now: NOW, env: { YY_SESSION_MODE: 'bogus' } } });
  c('flag.sessionBogus', f3.ok === false && f3.code === 'GATE_MODE_UNSUPPORTED');
  const f4 = await phase.checkPhase({ workspace: wsFlag, target: 1, opts: { now: NOW, env: { YY_GATE_MODE: 'nope' } } });
  c('flag.checkAlsoFails', f4.ok === false && f4.code === 'GATE_MODE_UNSUPPORTED');

  // (4) TT_ = warn 下 legacy 通道写根路径（MW0 兼容行为不变）
  const wsWarn = path.join(sandbox, 'ws-warn');
  seedState(wsWarn, stateFixture({ status: 'idle' }));
  const trWarn = await phase.transitionPhase({ workspace: wsWarn, from: 'idle', to: 'planning', opts: { now: NOW, env: { TT_GATE_MODE: 'warn' } } });
  c('warn.rootPath', trWarn.ok === true && fs.existsSync(path.join(wsWarn, '.tt-state', 'state.json')));

  // (5) namespaced 写入（§2.1 namespaced 模式）：session 写入归 ns1 namespace，legacy 根文件不被串写
  const wsNs = path.join(sandbox, 'ws-ns');
  seedState(wsNs, stateFixture({ status: 'idle' })); // legacy 根文件在场（v0 形），namespaced 写入不得触碰它
  const rootBefore = fs.readFileSync(path.join(wsNs, '.tt-state', 'state.json'), 'utf8');
  const trNs = await phase.transitionPhase({ workspace: wsNs, from: 'idle', to: 'planning', session: 'ns1', opts: { now: NOW, env: { YY_SESSION_MODE: 'namespaced' } } });
  const nsState = JSON.parse(fs.readFileSync(path.join(wsNs, '.tt-state', 'ns1', 'state.json'), 'utf8'));
  c('namespaced.write', trNs.ok === true && nsState.status === 'planning' && trNs.data.sessionId === 'ns1', `code=${trNs.code}`);
  c('namespaced.rootUntouched', fs.readFileSync(path.join(wsNs, '.tt-state', 'state.json'), 'utf8') === rootBefore);

  return verdict(checks, 'session-modes-flags');
}
