/** _helpers.mjs — R8 remediation.mjs 重建探针共用夹具（确定性注入 now/rand，全部写入限沙箱）。 */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import remediation from '../../../scripts/lib/remediation.mjs';

export const NOW = new Date('2026-09-20T01:23:45Z'); // 固定时点（findingId 日期段 = 20260920，探针可复现）
export const NOW_ISO = NOW.toISOString();

/** 逐调用独立的 6 位 hex rand（同批多 register 不碰撞 findingId） */
export function randFor(k) {
  return crypto.createHash('sha256').update(String(k)).digest('hex').slice(0, 6);
}

export function opts(sandbox, randKey = 0, over = {}) {
  return { repoRoot: sandbox, now: NOW, rand: randFor(randKey), ...over };
}

export function sha256(buf) {
  return crypto.createHash('sha256').update(buf).digest('hex');
}

/** 写沙箱文件并返回 {path, sha256}（路径相对沙箱根 = 仓库相对路径） */
export function writeFile(sandbox, rel, content) {
  const abs = path.join(sandbox, rel);
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  fs.writeFileSync(abs, content, 'utf8');
  return { path: rel.replace(/\\/g, '/'), sha256: sha256(Buffer.from(content, 'utf8')) };
}

export function readBytes(sandbox, rel) {
  return fs.readFileSync(path.join(sandbox, rel));
}

/** 锚点目标文件（类别 A file:line）：11 行样例，锚定第 3 行 */
export function seedAnchorFile(sandbox, rel = 'docs/sample-module.md') {
  const lines = Array.from({ length: 11 }, (_, i) => `// line ${i + 1}: sample module content`);
  writeFile(sandbox, rel, lines.join('\n') + '\n');
  return rel;
}

export function anchorFixture(rel = 'docs/sample-module.md', line = 3) {
  return { kind: 'file:line', path: rel, line, sha256: null }; // sha256 由 caller 以 seedAnchorFile 回填
}

export function anchorWithSha(sandbox, rel = 'docs/sample-module.md', line = 3) {
  const bytes = readBytes(sandbox, rel);
  return { kind: 'file:line', path: rel, line, sha256: sha256(bytes) };
}

export function probeAnchorWithSha(sandbox, rel = 'probes/p-x.mjs') {
  const bytes = readBytes(sandbox, rel);
  return { kind: 'probe', path: rel, sha256: sha256(bytes) };
}

/** 来源批判文件（幂等键分量，字节哈希可机验） */
export function critiqueFixture(sandbox, name = 'critique-a.md', marker = 'A') {
  return writeFile(sandbox, `critiques/${name}`, `# 批判 ${marker}\n\n- silent fallback swallows errors（fixture ${marker}）\n- date: 2026-09-18\n`);
}

/** 完整五要素 finding（清单 R8-01 exact input 形）；over.omit = 需删除的字段名数组（构造缺失分支） */
export function validFinding(sandbox, over = {}) {
  const anchorRel = over.anchorRel ?? 'docs/sample-module.md';
  const f = {
    title: over.title ?? 'sample critique: silent fallback swallows write errors',
    sourceAnchor: over.sourceAnchor ?? anchorWithSha(sandbox, anchorRel, 3),
    reproCommand: over.reproCommand ?? 'node scripts/probe-silent-fallback.mjs --expect fail-closed',
    externalSource: over.externalSource ?? {
      kind: 'competitor',
      url: 'https://example.com/competitor-a/changelog',
      date: '2026-09-01',
      citedAs: 'Competitor A fails loudly with named error codes on malformed input',
    },
    impact: over.impact ?? 'errors are silently swallowed and the agent believes the write succeeded',
    proposedVerification: over.proposedVerification ?? 'after fix, malformed input exits non-zero with named error',
    critiqueFile: over.critiqueFile ?? critiqueFixture(sandbox),
    g21Verdict: over.g21Verdict ?? null,
    r3ReceiptRefs: over.r3ReceiptRefs ?? [],
  };
  for (const k of over.omit ?? []) delete f[k];
  return f;
}

/** R4 canonical task state 活跃 R-task 只读投影（§2.1 候选集；R8 不读不写 R4 state.json） */
export function candidatesFor(rel = 'docs/sample-module.md', lineStart = 1, lineEnd = 11, taskIds = ['R2-catalog-acceptance']) {
  return taskIds.map((taskId) => ({ taskId, acceptanceFiles: [{ path: rel, lineStart, lineEnd }] }));
}

/** create-draft 五要素（GWT-R8-03 原文逐项） */
export function draftComplete(over = {}) {
  return {
    scope: over.scope ?? 'fix silent fallback in scripts/lib/sample write path (sandbox scope)',
    nonGoals: over.nonGoals ?? ['no refactor of unrelated adapters', 'no contract renames'],
    dependencies: over.dependencies ?? ['R4-phase'],
    gwts: over.gwts ?? ['Given malformed input, when the write path runs, then it exits non-zero with a named error'],
    contractImpact: over.contractImpact ?? ['contracts/C-R8-remediation.md（无错误码语义变更，仅行为面修复）'],
    ...over,
  };
}

/** tracker 沙箱 fixture（验证"只追加不迁移"的既有字节保留） */
export const TRACKER_FIXTURE = [
  '# critique-backlog-tracker（sandbox fixture）',
  '',
  '> 沙箱 fixture：仅供 R8 探针验证 GWT-R8-02 承接语义"只追加不迁移"。',
  '',
  '## M1 批判（fixture）',
  '| # | 批判（行中源） | 级别 | 修复 | 落点 | 验收指标 | 状态 |',
  '|---|---|---|---|---|---|---|',
  '| C-16 | fixture 批判行 A | P0 | 修复 A | 落点 A | 指标 A | ✅ |',
  '| C-17 | fixture 批判行 B | P1 | 修复 B | 落点 B | 指标 B | ⬜ |',
  '',
].join('\n');

export function seedTracker(sandbox) {
  writeFile(sandbox, 'plans/critique-backlog-tracker.md', TRACKER_FIXTURE);
  return TRACKER_FIXTURE;
}

export function trackerBytes(sandbox) {
  return readBytes(sandbox, 'plans/critique-backlog-tracker.md').toString('utf8');
}

/** findings ledger 行读取 */
export function ledgerLines(sandbox) {
  const file = path.join(sandbox, 'plans', 'active', 'remediation', 'findings.jsonl');
  if (!fs.existsSync(file)) return [];
  return fs.readFileSync(file, 'utf8').split('\n').filter((l) => l.trim() !== '').map((l) => JSON.parse(l));
}

export function ledgerText(sandbox) {
  const file = path.join(sandbox, 'plans', 'active', 'remediation', 'findings.jsonl');
  return fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : '';
}

export function draftFiles(sandbox) {
  const dir = path.join(sandbox, 'plans', 'active', 'remediation', 'drafts');
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir);
}

/** 响应壳断言：data 恒三键、evidence 恒五键（§6/dev-plan:309 壳形） */
export function dataKeys(sh) { return Object.keys(sh.data).sort(); }
export function evidenceKeys(sh) { return Object.keys(sh.evidence).sort(); }
export const EXPECT_DATA_KEYS = ['findingId', 'status', 'taskRef'];
export const EXPECT_EVIDENCE_KEYS = ['critiqueFileEcho', 'findingHashEcho', 'matchedTaskEcho', 'registeredAt', 'snapshot'];

export function shellOk(sh) {
  return dataKeys(sh).join(',') === EXPECT_DATA_KEYS.join(',')
    && evidenceKeys(sh).join(',') === EXPECT_EVIDENCE_KEYS.join(',')
    && Array.isArray(sh.warnings)
    && typeof sh.ok === 'boolean'
    && (sh.code === null || typeof sh.code === 'string');
}

/** 断言登记并返回 verdict */
export function verdict(checks, label) {
  const pass = checks.filter((c) => c.pass).length;
  return { ok: pass === checks.length, summary: `${label} ${pass}/${checks.length}` };
}

export function c(name, pass, detail = '') {
  return { name, pass: Boolean(pass), detail };
}

export { remediation };

/** Owner 通道违规码（重建推断，非契约三码面；见模块头注释） */
export const OWNER_CHANNEL_CODE = remediation.OWNER_CHANNEL_CODE;
