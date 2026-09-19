/** p01 — GWT-R8-01 / 清单 R8-01：五要素齐备的 finding 注册——稳定 ID、REGISTERED、壳三键五键、ledger/evidence 落盘。 */
import fs from 'node:fs';
import path from 'node:path';
import {
  remediation, verdict, c, opts, NOW_ISO,
  validFinding, seedAnchorFile, critiqueFixture, writeFile, sha256,
  ledgerLines, trackerBytes, seedTracker,
  dataKeys, evidenceKeys, EXPECT_DATA_KEYS, EXPECT_EVIDENCE_KEYS,
} from './_helpers.mjs';

export async function run({ sandbox }) {
  const checks = [];
  const add = (name, pass) => checks.push(c(name, pass));
  seedAnchorFile(sandbox);
  seedTracker(sandbox);
  const trackerBefore = trackerBytes(sandbox);

  // (a)(b)(c) 证据门通过 → 稳定 findingId + REGISTERED + 响应壳
  const r1 = remediation.remediationRegister({
    finding: validFinding(sandbox),
    mapMode: 'map-to-existing',
    candidates: [],
    registeredBy: 'agent-builder-01',
    opts: opts(sandbox, 1),
  });
  add('shell.okTrueCodeNull', r1.ok === true && r1.code === null);
  add('shell.dataThreeKeys', dataKeys(r1).join(',') === EXPECT_DATA_KEYS.join(','));
  add('shell.evidenceFiveKeys', evidenceKeys(r1).join(',') === EXPECT_EVIDENCE_KEYS.join(','));
  add('shell.statusRegistered', r1.data.status === 'REGISTERED' && r1.data.taskRef === null);
  add('id.format', /^fnd-20260920-[0-9a-f]{6}$/.test(r1.data.findingId));
  add('evidence.snapshotEcho', r1.evidence.snapshot === remediation.SNAPSHOT);
  add('evidence.registeredAtIso', r1.evidence.registeredAt === NOW_ISO);
  add('evidence.critiqueFileEcho', r1.evidence.critiqueFileEcho?.path === 'critiques/critique-a.md' && /^[0-9a-f]{64}$/.test(r1.evidence.critiqueFileEcho.sha256));
  add('evidence.findingHashEcho', /^[0-9a-f]{64}$/.test(r1.evidence.findingHashEcho));
  add('evidence.matchedTaskNull', r1.evidence.matchedTaskEcho === null);

  // ledger：一行一条 §1.3 记录（字段集逐字）
  const lines = ledgerLines(sandbox);
  add('ledger.oneLine', lines.length === 1);
  const rec = lines[0] ?? {};
  add('ledger.schemaFields', ['findingId', 'title', 'sourceAnchor', 'reproCommand', 'externalSource', 'impact',
    'proposedVerification', 'critiqueFile', 'g21Verdict', 'r3ReceiptRefs', 'status', 'taskRef',
    'registeredAt', 'registeredBy'].every((k) => k in rec));
  add('ledger.status', rec.status === 'REGISTERED' && rec.taskRef === null);
  add('ledger.anchor', rec.sourceAnchor?.kind === 'file:line' && rec.sourceAnchor?.line === 3 && rec.sourceAnchor?.path === 'docs/sample-module.md');
  add('ledger.externalSource', rec.externalSource?.kind === 'competitor' && rec.externalSource?.url?.length > 0 && rec.externalSource?.date === '2026-09-01');
  add('ledger.registeredBy', rec.registeredBy === 'agent-builder-01' && rec.registeredAt === NOW_ISO);
  add('ledger.findingIdEcho', rec.findingId === r1.data.findingId);

  // evidence/critique/<sha>/ 原件索引：write-once 原件 + append-only 登记行
  const critSha = rec.critiqueFile?.sha256;
  const origFile = path.join(sandbox, 'evidence', 'critique', critSha, 'original.md');
  const regFile = path.join(sandbox, 'evidence', 'critique', critSha, 'registrations.jsonl');
  add('evidenceDir.originalWritten', fs.existsSync(origFile));
  add('evidenceDir.originalBytes', fs.existsSync(origFile)
    && fs.readFileSync(origFile, 'utf8') === fs.readFileSync(path.join(sandbox, 'critiques', 'critique-a.md'), 'utf8'));
  add('evidenceDir.registrationLine', fs.existsSync(regFile) && fs.readFileSync(regFile, 'utf8').includes(r1.data.findingId));

  // tracker 零写（REGISTERED 不触发承接项追加，§6.3 tracker 只按 GWT-R8-02 语义追加）
  add('tracker.untouched', trackerBytes(sandbox) === trackerBefore);

  // ID 稳定性：同输入（确定性注入）重放 → 同 ID（清单 R8-01 defect "重复注册换 ID"的确定性面）
  const sandbox2 = path.join(path.dirname(sandbox), `${path.basename(sandbox)}-replay`);
  fs.rmSync(sandbox2, { recursive: true, force: true });
  fs.mkdirSync(sandbox2, { recursive: true });
  seedAnchorFile(sandbox2);
  critiqueFixture(sandbox2);
  const r2 = remediation.remediationRegister({
    finding: validFinding(sandbox2),
    mapMode: 'map-to-existing',
    candidates: [],
    registeredBy: 'agent-builder-01',
    opts: opts(sandbox2, 1),
  });
  add('id.deterministic', r2.data.findingId === r1.data.findingId);
  fs.rmSync(sandbox2, { recursive: true, force: true });

  // probe 形态锚点（类别 A kind='probe'）同样过闸
  const probeRel = 'probes/p-obs.mjs';
  writeFile(sandbox, probeRel, "console.log('observation: exit 3 on malformed input');\n");
  const r3 = remediation.remediationRegister({
    finding: validFinding(sandbox, {
      title: 'probe-anchored critique variant',
      sourceAnchor: { kind: 'probe', path: probeRel, sha256: sha256(fs.readFileSync(path.join(sandbox, probeRel))) },
      critiqueFile: critiqueFixture(sandbox, 'critique-b.md', 'B'),
    }),
    mapMode: 'map-to-existing',
    candidates: [],
    registeredBy: 'agent-builder-01',
    opts: opts(sandbox, 2),
  });
  add('probeAnchor.gatePass', r3.ok === true && r3.data.status === 'REGISTERED');
  add('probeAnchor.newId', r3.data.findingId !== r1.data.findingId && /^fnd-20260920-[0-9a-f]{6}$/.test(r3.data.findingId));

  return verdict(checks, 'gwt-r8-01');
}
