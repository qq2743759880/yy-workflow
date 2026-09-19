/** p06 — state-version（清单 R4-06ab + §2.2，OQ-R4-2=A）：v0 双读合法；新写初始值=1；高版本 STATE_VERSION_UNSUPPORTED 且禁静默降级覆写。 */
import fs from 'node:fs';
import path from 'node:path';
import phase from '../../../scripts/lib/phase.mjs';
import { NOW, stateFixture, seedState, stateFileOf, shellOk, verdict } from './_helpers.mjs';

export async function run({ sandbox }) {
  const checks = [];
  const c = (name, pass) => checks.push({ name, pass });

  // (a) 旧 state.json（无 stateVersion 字段）MW0 双读成功；transition 新写写入初始 stateVersion=1
  const wsV0 = path.join(sandbox, 'ws-v0');
  seedState(wsV0, stateFixture({ status: 'idle' })); // 无 stateVersion = legacy v0 形
  const chk = await phase.checkPhase({ workspace: wsV0, from: 'idle', to: 'planning', opts: { now: NOW } });
  c('v0.dualRead', chk.ok === true && chk.evidence.stateVersionEcho === 0);
  const tr = await phase.transitionPhase({ workspace: wsV0, from: 'idle', to: 'planning', opts: { now: NOW } });
  c('v0.transitionOk', tr.ok === true && shellOk(tr) && tr.data.stateVersionWritten === 1);
  const onDisk = JSON.parse(fs.readFileSync(stateFileOf(wsV0), 'utf8'));
  c('v0.writtenV1', onDisk.stateVersion === 1 && onDisk.status === 'planning');

  // (b) 高 stateVersion 文件被新 reader 读取 ⇒ fail-closed STATE_VERSION_UNSUPPORTED（独立新码，不复用 SESSION_INVALID）
  const wsHi = path.join(sandbox, 'ws-hi');
  seedState(wsHi, stateFixture({ status: 'idle', stateVersion: 2 }));
  const hiFile = stateFileOf(wsHi);
  const beforeHi = fs.readFileSync(hiFile, 'utf8');
  const chkHi = await phase.checkPhase({ workspace: wsHi, from: 'idle', to: 'planning', opts: { now: NOW } });
  c('hi.check', chkHi.ok === false && chkHi.code === 'STATE_VERSION_UNSUPPORTED' && chkHi.data.foundVersion === 2);
  const trHi = await phase.transitionPhase({ workspace: wsHi, from: 'idle', to: 'planning', opts: { now: NOW } });
  c('hi.transition', trHi.ok === false && trHi.code === 'STATE_VERSION_UNSUPPORTED');
  c('hi.noOverwrite', fs.readFileSync(hiFile, 'utf8') === beforeHi); // 禁止静默降级读取后覆写

  // (c) 陌生版本值（字符串 '1'）同样 fail-closed（不认识的版本一律不支持）
  const wsStr = path.join(sandbox, 'ws-str');
  seedState(wsStr, stateFixture({ status: 'idle', stateVersion: '1' }));
  const trStr = await phase.transitionPhase({ workspace: wsStr, from: 'idle', to: 'planning', opts: { now: NOW } });
  c('strVersion.unsupported', trStr.ok === false && trStr.code === 'STATE_VERSION_UNSUPPORTED' && JSON.stringify(trStr.data.foundVersion) === '"1"');

  // (d) state.json 损坏 ⇒ 显式失败，绝不覆写
  const wsBad = path.join(sandbox, 'ws-bad');
  seedState(wsBad, stateFixture({ status: 'idle' }));
  const badFile = stateFileOf(wsBad);
  fs.writeFileSync(badFile, '{not-json');
  const beforeBad = fs.readFileSync(badFile, 'utf8');
  const trBad = await phase.transitionPhase({ workspace: wsBad, from: 'idle', to: 'planning', opts: { now: NOW } });
  c('corrupt.explicitFail', trBad.ok === false && trBad.code === 'INVALID_TRANSITION' && trBad.data.reason.includes('不可解析'));
  c('corrupt.noOverwrite', fs.readFileSync(badFile, 'utf8') === beforeBad);

  return verdict(checks, 'state-version');
}
