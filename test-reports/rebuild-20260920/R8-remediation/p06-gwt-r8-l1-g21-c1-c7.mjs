/** p06 — GWT-R8-L1 / 清单 R8-L1：G2.1 ledger C1-C7 批量注册投影——REPRODUCED 组映射到验收条目、
 * C2/C5 UNRESOLVED 注册形态不解锁依赖、C5 不写成已闭环、永不删除、整批 fail-closed。 */
import fs from 'node:fs';
import path from 'node:path';
import {
  remediation, verdict, c, opts, sha256,
  seedAnchorFile, critiqueFixture, ledgerLines, trackerBytes, seedTracker,
} from './_helpers.mjs';

export async function run({ sandbox }) {
  const checks = [];
  const add = (name, pass) => checks.push(c(name, pass));
  seedAnchorFile(sandbox);
  seedTracker(sandbox);
  const anchorSha = sha256(fs.readFileSync(path.join(sandbox, 'docs/sample-module.md')));

  const entry = (serial, title, verdictValue, extraCritique) => ({
    serial,
    finding: {
      title,
      sourceAnchor: { kind: 'file:line', path: 'docs/sample-module.md', line: 3, sha256: anchorSha },
      reproCommand: `node scripts/probe-${serial.toLowerCase()}.mjs --expect ledger-verdict`,
      externalSource: {
        kind: 'official_project',
        url: `https://example.com/g21-ledger/${serial.toLowerCase()}`,
        date: '2026-09-11',
        citedAs: `G2.1 ledger ${serial} verification entry`,
      },
      impact: `${serial} impact statement (fixture)`,
      proposedVerification: `${serial} proposed verification (fixture)`,
      critiqueFile: extraCritique,
      g21Verdict: verdictValue,
      r3ReceiptRefs: [],
    },
  });

  const entries = [
    entry('C1', 'C1 skill/manifest 计数不变量', 'REPRODUCED', critiqueFixture(sandbox, 'crit-c1.md', 'C1')),
    entry('C2', 'C2 punctuationKeywordCount 9 vs 16', 'UNRESOLVED', critiqueFixture(sandbox, 'crit-c2.md', 'C2')),
    entry('C3', 'C3 七条路由观测全中', 'REPRODUCED', critiqueFixture(sandbox, 'crit-c3.md', 'C3')),
    entry('C4', 'C4 ledger item without per-item policy row', 'COUNTEREVIDENCE_CONFIRMED', critiqueFixture(sandbox, 'crit-c4.md', 'C4')),
    entry('C5', 'C5 gate-skip 证据阻塞清除', 'UNRESOLVED', critiqueFixture(sandbox, 'crit-c5.md', 'C5')),
    entry('C6', 'C6 assetConsumed 口令', 'REPRODUCED', critiqueFixture(sandbox, 'crit-c6.md', 'C6')),
    entry('C7', 'C7 CI 真实性', 'REPRODUCED', critiqueFixture(sandbox, 'crit-c7.md', 'C7')),
  ];

  const r = remediation.registerG21L1({ entries, registeredBy: 'agent-builder-01', opts: opts(sandbox, 61) });
  add('l1.ok', r.ok === true && r.code === null);
  const bySerial = Object.fromEntries((r.data.registered ?? []).map((x) => [x.serial, x]));
  add('l1.sevenRegistered', (r.data.registered ?? []).length === 7);

  // (a) REPRODUCED 组映射到验收条目（OQ-R8-7=A 正式表去向；taskRef = 主承接面，l1.taskRefs 全表）
  add('l1.C1.mapped', bySerial.C1?.status === 'MAPPED_EXISTING' && bySerial.C1?.taskRef === 'R1-baseline-16-asset');
  add('l1.C3.mapped', bySerial.C3?.status === 'MAPPED_EXISTING' && bySerial.C3?.taskRef === 'R2-routing-admission');
  add('l1.C6.mapped', bySerial.C6?.status === 'MAPPED_EXISTING' && bySerial.C6?.taskRef === 'C-R3-receipt-contract');
  add('l1.C7.mapped', bySerial.C7?.status === 'MAPPED_EXISTING' && bySerial.C7?.taskRef === 'R4-ci-classification-matrix-exit-propagation');

  // (b) C2/C5 UNRESOLVED 注册形态：REGISTERED、不映射、不 create-draft、不得解锁其依赖
  add('l1.C2.registeredNoUnlock', bySerial.C2?.status === 'REGISTERED' && bySerial.C2?.taskRef === null);
  add('l1.C5.registeredNoUnlock', bySerial.C5?.status === 'REGISTERED' && bySerial.C5?.taskRef === null);
  add('l1.C4.registerOnly', bySerial.C4?.status === 'REGISTERED' && bySerial.C4?.taskRef === null); // 正式表无 C4 行：注册面收口

  // C5 如实标注：原始探针回归 [待确认/未执行]，不得写成已闭环；C6 底层行为缺陷不宣称已修
  const ledger = ledgerLines(sandbox);
  const bySerialRec = Object.fromEntries(ledger.map((x) => [x.l1?.serial, x]));
  add('l1.C5.probeRegression', bySerialRec.C5?.l1?.probeRegression === '[待确认/未执行]' && bySerialRec.C5?.l1?.closureClaimed === false);
  add('l1.C6.notClaimedFixed', bySerialRec.C6?.l1?.closureClaimed === false && bySerialRec.C6?.l1?.note.includes('不宣称已修'));
  add('l1.C1C3C7.closed', ['C1', 'C3', 'C7'].every((s) => bySerialRec[s]?.l1?.closureClaimed === true));
  add('l1.C2.blockingNote', bySerialRec.C2?.l1?.note.includes('阻断 R9/R6') && bySerialRec.C2?.l1?.note.includes('诊断变体不可替代冻结命令'));

  // (b) cannotUnlock（R10/下游消费面）：C2/C5（UNRESOLVED）与 C4（COUNTEREVIDENCE_CONFIRMED）不得解锁依赖
  add('l1.cannotUnlock', ['C2', 'C5', 'C4'].every((s) => bySerialRec[s] && remediation.cannotUnlock(bySerialRec[s])));
  add('l1.mappedCanUnlock', ['C1', 'C3', 'C6', 'C7'].every((s) => bySerialRec[s] && !remediation.cannotUnlock(bySerialRec[s])));

  // (c) 永不删除：ledger 恰 7 行；无 draft 产生
  add('l1.neverDropped', ledger.length === 7);
  const draftsDir = path.join(sandbox, 'plans', 'active', 'remediation', 'drafts');
  add('l1.noDrafts', !fs.existsSync(draftsDir) || fs.readdirSync(draftsDir).length === 0);

  // 承接项追加（mapped 组：2+2+2+1 = 7 行承接记录）
  const tracker = trackerBytes(sandbox);
  add('l1.trackerRows', (tracker.match(/^\| fnd-20260920-/gm) ?? []).length === 7);

  // 整批 fail-closed：任一条证据门不过 ⇒ 零写入（禁止部分注册造成 drop）
  const sandbox2 = path.join(path.dirname(sandbox), `${path.basename(sandbox)}-fail`);
  fs.rmSync(sandbox2, { recursive: true, force: true });
  fs.mkdirSync(sandbox2, { recursive: true });
  seedAnchorFile(sandbox2);
  const badEntries = entries.map((e) => (e.serial === 'C5'
    ? { serial: 'C5', finding: { ...e.finding, impact: '' } } // 五要素缺 impact
    : { serial: e.serial, finding: { ...e.finding, critiqueFile: critiqueFixture(sandbox2, `crit-${e.serial.toLowerCase()}.md`, e.serial) } }));
  const rbad = remediation.registerG21L1({ entries: badEntries, registeredBy: 'agent-builder-01', opts: opts(sandbox2, 61) });
  add('l1.batchFailClosed', rbad.ok === false && rbad.code === 'INVALID_EVIDENCE');
  add('l1.batchZeroWrite', ledgerLines(sandbox2).length === 0);
  fs.rmSync(sandbox2, { recursive: true, force: true });

  // 批量形状违约：缺 serial / 重复 serial / 投影失真 ⇒ 整批拒绝
  const r6 = remediation.registerG21L1({ entries: entries.slice(0, 6), registeredBy: 'agent-builder-01', opts: opts(sandbox, 62) });
  add('l1.missingSerialRejected', r6.ok === false && r6.code === 'INVALID_EVIDENCE');
  const entriesAfter = entries.map((e) => ({
    serial: e.serial,
    finding: { ...e.finding, critiqueFile: critiqueFixture(sandbox, `crit2-${e.serial.toLowerCase()}.md`, e.serial + 'x') },
  }));
  const rdup = remediation.registerG21L1({ entries: [...entriesAfter.slice(0, 6), entriesAfter[0]], registeredBy: 'agent-builder-01', opts: opts(sandbox, 63) });
  add('l1.dupSerialRejected', rdup.ok === false && rdup.code === 'INVALID_EVIDENCE');
  const entriesWrongVerdict = entries.map((e) => (e.serial === 'C2'
    ? { serial: 'C2', finding: { ...e.finding, critiqueFile: critiqueFixture(sandbox, 'crit3-c2.md', 'C2y'), g21Verdict: 'REPRODUCED' } }
    : { serial: e.serial, finding: { ...e.finding, critiqueFile: critiqueFixture(sandbox, `crit3-${e.serial.toLowerCase()}.md`, e.serial + 'z') } }));
  const rverdict = remediation.registerG21L1({ entries: entriesWrongVerdict, registeredBy: 'agent-builder-01', opts: opts(sandbox, 64) });
  add('l1.verdictProjectionRejected', rverdict.ok === false && rverdict.code === 'INVALID_EVIDENCE');
  add('l1.failPathsZeroWrite', ledgerLines(sandbox).length === 7); // 三次失败路径均零写入

  return verdict(checks, 'gwt-r8-l1');
}
