/** p05 — GWT-R8-05 / 清单 R8-05：证据门 fail-closed——四分支全部 INVALID_EVIDENCE、零写入、
 * 不降级为"待补证据"；类别 B 三分类任取一（authoritative 单独即满足，§1.4）。 */
import fs from 'node:fs';
import path from 'node:path';
import {
  remediation, verdict, c, opts, sha256,
  validFinding, seedAnchorFile, critiqueFixture, seedTracker,
  ledgerLines, draftFiles,
} from './_helpers.mjs';

export async function run({ sandbox }) {
  const checks = [];
  const add = (name, pass) => checks.push(c(name, pass));
  seedAnchorFile(sandbox);
  seedTracker(sandbox);
  const trackerBefore = fs.readFileSync(path.join(sandbox, 'plans', 'critique-backlog-tracker.md'), 'utf8');
  const anchorSha = sha256(fs.readFileSync(path.join(sandbox, 'docs/sample-module.md')));

  const attempt = (over, key) => remediation.remediationRegister({
    finding: validFinding(sandbox, over),
    mapMode: 'create-draft',
    draft: { scope: 's', nonGoals: ['n'], dependencies: ['d'], gwts: ['g'], contractImpact: ['c'] },
    registeredBy: 'agent-builder-01',
    opts: opts(sandbox, key),
  });

  // (a) 缺 externalSource ⇒ INVALID_EVIDENCE
  const ra = attempt({ title: 'gate-a: missing externalSource', omit: ['externalSource'] }, 41);
  // (b1) url 为空；(b2) date 非法 ISO
  const rb1 = attempt({ title: 'gate-b1: empty url', externalSource: { kind: 'competitor', url: '', date: '2026-09-01', citedAs: 'x' } }, 42);
  const rb2 = attempt({ title: 'gate-b2: invalid date', externalSource: { kind: 'authoritative', url: 'https://a.example.com', date: '2026-13-45', citedAs: 'x' } }, 43);
  // (c1) 锚点路径不存在；(c2) 锚点 sha256 不符
  const rc1 = attempt({ title: 'gate-c1: anchor missing', sourceAnchor: { kind: 'file:line', path: 'docs/nonexistent.md', line: 1, sha256: anchorSha } }, 44);
  const rc2 = attempt({ title: 'gate-c2: sha mismatch', sourceAnchor: { kind: 'file:line', path: 'docs/sample-module.md', line: 3, sha256: '0'.repeat(64) } }, 45);
  // (d) 有竞品来源但无 reproCommand / 无锚点
  const rd1 = attempt({ title: 'gate-d1: no reproCommand', reproCommand: '' }, 46);
  const rd2 = attempt({ title: 'gate-d2: no anchor', omit: ['sourceAnchor'] }, 47);
  const branches = [['a-missingExternalSource', ra], ['b1-emptyUrl', rb1], ['b2-invalidDate', rb2],
    ['c1-anchorMissing', rc1], ['c2-shaMismatch', rc2], ['d1-noReproCommand', rd1], ['d2-noAnchor', rd2]];
  for (const [name, r] of branches) {
    add(`${name}.code`, r.ok === false && r.code === 'INVALID_EVIDENCE');
    add(`${name}.status`, r.data.status === 'INVALID_EVIDENCE' && r.data.findingId === null);
  }

  // fail-closed：全部零写入（ledger/tracker/draft/evidence 计数不变）
  add('gate.zeroLedgerWrite', ledgerLines(sandbox).length === 0);
  add('gate.zeroDrafts', draftFiles(sandbox).length === 0);
  add('gate.trackerUnchanged', fs.readFileSync(path.join(sandbox, 'plans', 'critique-backlog-tracker.md'), 'utf8') === trackerBefore);
  add('gate.noEvidenceDir', !fs.existsSync(path.join(sandbox, 'evidence', 'critique')));
  add('gate.noDegradedStatus', branches.every(([, r]) => r.data.status !== 'REGISTERED')); // 禁"待补证据"半放行
  add('gate.reasonsInWarnings', ra.warnings.some((w) => w.includes('externalSource')) && rc2.warnings.some((w) => w.includes('sha256 不符')));

  // 类别 B kind 枚举外 ⇒ 拒（三分类枚举外不可充当外部来源）
  const rkind = attempt({ title: 'gate-kind: blog not in enum', externalSource: { kind: 'blog', url: 'https://b.example.com', date: '2026-09-01', citedAs: 'x' } }, 48);
  add('gate.kindEnumRejected', rkind.code === 'INVALID_EVIDENCE');

  // 类别 C citedAs 空 ⇒ 拒
  const rcited = attempt({ title: 'gate-citedAs: empty', externalSource: { kind: 'competitor', url: 'https://c.example.com', date: '2026-09-01', citedAs: '' } }, 49);
  add('gate.citedAsRejected', rcited.code === 'INVALID_EVIDENCE');

  // 行号越界 ⇒ 拒（file:line 行号须落在文件行范围内，§1.4 类别 A）
  const rline = attempt({ title: 'gate-line: out of range', sourceAnchor: { kind: 'file:line', path: 'docs/sample-module.md', line: 99, sha256: anchorSha } }, 50);
  add('gate.lineRangeRejected', rline.code === 'INVALID_EVIDENCE');

  // 来源批判文件字节哈希不符 ⇒ 拒（幂等键可信度地板）
  const rcrit = attempt({ title: 'gate-critique: sha mismatch', critiqueFile: { path: 'critiques/critique-a.md', sha256: '1'.repeat(64) } }, 51);
  add('gate.critiqueShaRejected', rcrit.code === 'INVALID_EVIDENCE');

  // 权威来源单独即满足类别 B（三类枚举内任取一，§1.4；GWT-R8-05 "缺少竞品或权威来源"——有其一即不缺）
  const rauth = attempt({
    title: 'authoritative-only source passes category B',
    externalSource: { kind: 'authoritative', url: 'https://standards.example.com/iso-fail-closed', date: '2026-08-15', citedAs: 'ISO-style guidance: fail closed on unverifiable evidence' },
    critiqueFile: critiqueFixture(sandbox, 'critique-h.md', 'H'),
  }, 52);
  add('authoritativeOnly.passes', rauth.ok === true && rauth.data.status === 'DRAFT_PROPOSED');
  add('authoritativeOnly.registered', ledgerLines(sandbox).length === 1);

  return verdict(checks, 'gwt-r8-05');
}
