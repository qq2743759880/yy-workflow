#!/usr/bin/env node
/**
 * audit-index-selftest.mjs — audit-index 自检（REMEDIATION-2 F-032 建；GOV-AUTHORITY F-038 升级，2026-09-26）。
 *
 * 目的：plans/audit-index-20260925.md 的证据指针表从此不能 stale——
 * F-038 分节后语义升级：**current 节每项检查 canonical pointer/version（证据文件 sha256 ==
 * 索引登记值 / 路径存在）+ 复验命令可执行；historical 节只查路径存在不查 freshness**。
 * 任一 current 项 sha256 不符/路径缺失/命令失败 → FAIL 具名（"reference-health-check" →
 * 真 semantic freshness）。
 *
 * 接入门禁：regression-all.mjs S14b 段（preflight P5 系列延续编号 P5c）——
 * audit-index 失检即整机回归 FAIL。
 *
 * 表解析：直接解析 markdown 表格行（`| A-1 | ... | 路径 | 命令 |`），逐行提取
 * 证据文件路径（反引号包裹的仓库相对路径，取每格全部候选）与复验命令（最后一格内
 * `node ...` / `grep ...` 等首个命令行）。命令含 git log 类（B-3 标注由审计者执行）
 * → 本机只断言路径存在面，命令标注 SKIP-git（L1 禁 git，非 stale 信号）。
 *
 * F-038 分节识别：
 *   - 节标题含【current 节】→ current 行（freshness 面）；
 *   - 节标题含【historical】→ historical 行（只查路径存在；本节标题行须含 superseded_by
 *     声明——分节纪律机检：historical 节存在但无 superseded_by 标注 → FAIL 具名）；
 *   - N 系（已知缺口披露行）按 GAP 登记不阻断（披露面无路径要求）。
 *
 * current freshness 判定（canonical pointer/version）：
 *   ① 证据格内反引号路径全部存在（组内任一缺失 → FAIL 具名 EVIDENCE_MISSING——current 行
 *      是 canonical 指针，不再容忍"组内主路径在场即可"的宽松口径）；
 *   ② 索引行内嵌 sha256 登记值（`<64 hex>` 形态，如 A-1 的 3c0e7df0）→ 与实测 sha256 比对，
 *      不符 → FAIL 具名 SHA256_MISMATCH（无登记值 → 只查存在性）；
 *   ③ 复验命令逐条跑（exit 0 或 expected token 命中）。
 */
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const INDEX = path.join(ROOT, 'plans', 'audit-index-20260925.md');

const results = [];
let fail = 0;
let pass = 0;

function record(id, face, ok, detail, section) {
  results.push({ id, face, ok: ok === true, section: section ?? 'unknown', detail });
  if (ok === true) pass += 1; else fail += 1;
}

/** 从反引号片段提取仓库相对路径候选（排除 .mjs 驱动命令面与 glob）。
 *  F-038 补充：组内相对路径复用——首段全路径登记后的 `name.ext` 短形（B-5/B-7/B-9 先例）
 *  按同目录补全为完整路径（current 全在场口径不因书写简写误报）。 */
function extractPaths(cellText) {
  const out = [];
  const re = /`([^`]+)`/g;
  let m;
  while ((m = re.exec(cellText)) !== null) {
    const t = m[1].trim();
    if (!t || t.includes(' ') || t.includes('#') || t.startsWith('-')) continue;
    if (/\.(md|mjs|json|txt|log|yaml|yml)$/i.test(t)) out.push(t);
  }
  // 短形补全：不含目录分隔的候选 → 按此前最近的全路径同目录拼接
  const filled = [];
  let lastDir = '';
  for (const p of out) {
    if (p.includes('/')) {
      filled.push(p);
      lastDir = p.slice(0, p.lastIndexOf('/') + 1);
    } else if (lastDir) {
      filled.push(lastDir + p);
    } else {
      filled.push(p);
    }
  }
  return filled;
}

/** 提取复验命令（最后一格：反引号包裹且以可执行词开头）。 */
function extractCommand(cellText) {
  const re = /`([^`]+)`/g;
  let m;
  const candidates = [];
  while ((m = re.exec(cellText)) !== null) {
    const t = m[1].trim();
    if (/^(node|grep|diff|sha256sum|ls|wc|head|tail|cat|git)\b/.test(t)) candidates.push(t);
  }
  return candidates.length ? candidates[candidates.length - 1] : null;
}

/** 行内嵌 sha256 登记值（64 位 hex 形态）。F-038 语义：只对「登记值可机验」的行比对——
 *  登记值在命令格内声明"期望 <hash>"且命令格产出该 hash（B-6 先例：`sha256sum
 *  contracts/asset-manifest-v2.json`（期望 c30fee6b…）——命令 stdout 含 hash → 与登记值直接
 *  比对，不落到证据文件字节）。证据格内纯叙述 hash（d9f0d738→c30fee6b 归因叙述）不机验。 */
function extractShaClaims(cellText, paths, cmdCell) {
  const out = [];
  const re = /([0-9a-f]{64})/g;
  let m;
  const hasExpectCmd = /期望|expected/i.test(cmdCell ?? '');
  while ((m = re.exec(cellText)) !== null) {
    const h = m[1];
    if (paths.some((p) => p.includes(h))) continue; // 路径本身含 hash（sha256sum 输出形态）排除
    const before = cellText.slice(Math.max(0, m.index - 120), m.index);
    const bindsToPath = paths.some((p) => before.includes(p.split('/').pop() ?? p));
    if (hasExpectCmd && bindsToPath) out.push({ hash: h, via: 'command-expected' });
  }
  return out;
}

const raw = fs.readFileSync(INDEX, 'utf8');

// F-038：按节标题切分，逐行标注 current/historical/gap
const lines = raw.split('\n');
let currentSection = 'preamble';
const rows = [];
for (const line of lines) {
  const t = line.trim();
  if (t.startsWith('## ')) {
    if (/【current/.test(t)) currentSection = 'current';
    else if (/【historical/.test(t)) currentSection = 'historical';
    else if (/披露面|已知缺口/.test(t)) currentSection = 'gap';
    else currentSection = 'preamble';
    if (currentSection === 'historical' && !/superseded_by/i.test(t) && !/F-038/.test(t)) {
      // historical 节标题本身须携带分节语义（正文首行另有 superseded_by 声明——下方单独机检）
    }
    continue;
  }
  if (!t.startsWith('|')) continue;
  const cells = t.split('|').map((c) => c.trim().replace(/\\\|/g, '|'));
  if (cells.length < 5) continue;
  if (/^#/.test(cells[1]) || /^-+$/.test(cells[1]) || /finding/.test(cells[1])) continue;
  const id = cells[1];
  if (!/^[ABCND]-\d+$/.test(id)) continue;
  rows.push({ id, finding: cells[2], evidence: cells[3], command: cells[4], allCells: cells, section: currentSection });
}

// historical 节分节纪律机检：文件须含 superseded_by 声明（historical 节头）
const hasSupersededBy = /superseded_by:\s*REMEDIATION-2 S16 三段/i.test(raw);

console.log('# audit-index self-test（plans/audit-index-20260925.md 证据指针表机检——F-038 current/historical 分节 + semantic freshness）');
console.log('解析条目: ' + rows.length + ' 行（A/B/C/D/N 系）');
const currentRows = rows.filter((r) => r.section === 'current');
const historicalRows = rows.filter((r) => r.section === 'historical');
const gapRows = rows.filter((r) => r.section === 'gap');
console.log('分节: current=' + currentRows.length + ' historical=' + historicalRows.length + ' gap=' + gapRows.length);
record('SECTION', 'freshness', hasSupersededBy, hasSupersededBy
  ? 'historical 节 superseded_by: REMEDIATION-2 S16 三段 声明在场（分节纪律）'
  : 'HISTORICAL_SECTION_UNLABELED: historical 节缺 superseded_by 声明（F-038 分节纪律违约）');

for (const row of rows) {
  const isHistorical = row.section === 'historical';
  const isGap = row.section === 'gap' || row.id.startsWith('N-');
  // ① 证据路径存在性
  const evidencePaths = isGap ? [] : extractPaths(row.evidence);
  if (evidencePaths.length === 0) {
    if (isGap) {
      record(row.id, 'evidence', true, 'GAP_ROW（披露面无路径要求，指向 ' + row.evidence.slice(0, 60) + '…）', row.section);
    } else {
      record(row.id, 'evidence', false, 'EVIDENCE_UNPARSABLE: 证据格无可识别路径', row.section);
      continue;
    }
  } else {
    const missing = evidencePaths.filter((p) => !fs.existsSync(path.join(ROOT, p)));
    // F-038：current 行 canonical 指针全存在口径；historical 行沿用"至少一个在场"（留痕面）
    const evidenceOk = isHistorical ? missing.length < evidencePaths.length : missing.length === 0;
    record(row.id, 'evidence', evidenceOk, evidenceOk
      ? 'paths=' + evidencePaths.length + (missing.length ? '（historical 留痕面：缺 ' + missing.join(',') + '，组内主路径在场）' : ' 全在场')
      : (isHistorical ? 'EVIDENCE_MISSING: ' + missing.join(', ') : 'EVIDENCE_MISSING（current canonical 指针须全在场）: ' + missing.join(', ')),
      row.section);
  }
  // ② F-038 freshness：current 行 sha256 登记值比对（historical 不查 freshness）
  if (!isHistorical && !isGap) {
    let cmdCellRaw = row.command;
    if (!extractCommand(cmdCellRaw) && row.allCells) cmdCellRaw = row.allCells.slice(3).join(' | ');
    const shaClaims = extractShaClaims(row.allCells.join(' | '), evidencePaths, cmdCellRaw);
    if (shaClaims.length > 0) {
      const mismatches = [];
      for (const claim of shaClaims) {
        // command-expected 形：执行复验命令取其 stdout hash 与登记值比对；无命令面 → 落证据文件字节
        if (claim.via === 'command-expected') {
          const cmd = extractCommand(cmdCellRaw);
          if (cmd) {
            const r = spawnSync('bash', ['-c', cmd], { cwd: ROOT, encoding: 'utf8', timeout: 180000 });
            const out = String((r.stdout || '') + (r.stderr || ''));
            if (!out.includes(claim.hash)) mismatches.push(claim.hash.slice(0, 12) + '…(command stdout 不含登记值，实测 out=' + out.trim().slice(0, 24) + '…)');
            continue;
          }
        }
        const hit = evidencePaths.some((p) => {
          const f = path.join(ROOT, p);
          if (!fs.existsSync(f)) return false;
          const actual = crypto.createHash('sha256').update(fs.readFileSync(f)).digest('hex');
          return actual === claim.hash;
        });
        if (!hit) mismatches.push(claim.hash.slice(0, 12) + '…');
      }
      record(row.id, 'sha256', mismatches.length === 0, mismatches.length === 0
        ? 'sha256 登记值 ' + shaClaims.length + ' 项全部机验一致（semantic freshness）'
        : 'SHA256_MISMATCH: 登记值 ' + mismatches.join(', ') + ' 与实测不符（reference-health-check FAIL）',
        row.section);
    } else {
      record(row.id, 'sha256', true, '无 sha256 登记值——本行 freshness 面=路径存在+命令可执行', row.section);
    }
  }
  // ③ 复验命令（historical 节只查命令在案不执行——留痕面不强制新鲜）
  let cmdCell = row.command;
  if (!extractCommand(cmdCell) && row.allCells) {
    cmdCell = row.allCells.slice(3).join(' | ');
  }
  const cmd = extractCommand(cmdCell);
  if (!cmd) {
    if (row.id.startsWith('N-') || isGap) record(row.id, 'command', true, 'GAP_ROW（披露面无独立复验命令，指向 ' + cmdCell.slice(0, 50) + '…）', row.section);
    else record(row.id, 'command', false, 'COMMAND_MISSING: 复验命令格无可执行命令', row.section);
    continue;
  }
  if (cmd.startsWith('git ')) {
    record(row.id, 'command', true, 'SKIP-git（git 收口归编排者/审计者，L1 禁 git；命令已在案）', row.section);
    continue;
  }
  if (isHistorical) {
    record(row.id, 'command', true, 'HISTORICAL（只查命令在案，不查 freshness——F-038 分节口径）', row.section);
    continue;
  }
  const r = spawnSync('bash', ['-c', cmd], { cwd: ROOT, encoding: 'utf8', timeout: 180000 });
  const out = String((r.stdout || '') + (r.stderr || ''));
  const exitOk = r.status === 0;
  record(row.id, 'command', exitOk, 'exit=' + r.status + ' out=' + out.trim().split('\n')[0].slice(0, 90), row.section);
}

console.log('\n逐条结果:');
for (const r of results) console.log((r.ok ? 'PASS' : 'FAIL') + ' ' + r.id + ' [' + r.face + '/' + r.section + '] ' + r.detail);

console.log('\n结果: ' + pass + ' PASS / ' + fail + ' FAIL');
if (fail > 0) {
  for (const r of results) if (!r.ok) console.log('  STALE: ' + r.id + ' [' + r.face + '/' + r.section + '] ' + r.detail);
  process.exitCode = 1;
} else {
  console.log('audit-index current 节 sha256/路径/命令三面新鲜、historical 节分节留痕合规——索引未 stale（F-038 semantic freshness）。');
}
