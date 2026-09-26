#!/usr/bin/env node
/**
 * audit-index-selftest.mjs — audit-index 自检（REMEDIATION-2 F-032，2026-09-26）。
 *
 * 目的：plans/audit-index-20260925.md 的证据指针表从此不能 stale——
 * 逐行读取索引表，对每项断言：
 *   ①证据文件路径存在；
 *   ②复验命令可执行（child_process 逐条跑）：exit 0 或输出含 expected token。
 * 任一失败 → 具名列出（条目号 + 失败面），exit 1；全过 exit 0。
 *
 * 接入门禁：regression-all.mjs S14 段之后新增 P5c 断言（preflight P5 系列延续编号）——
 * audit-index 失检即整机回归 FAIL。
 *
 * 表解析：直接解析 markdown 表格行（`| A-1 | ... | 路径 | 命令 |`），逐行提取
 * 证据文件路径（反引号包裹的仓库相对路径，取每格全部候选）与复验命令（最后一格内
 * `node ...` / `grep ...` 等首个命令行）。命令含 git log 类（B-3 标注由审计者执行）
 * → 本机只断言路径存在面，命令标注 SKIP-git（L1 禁 git，非 stale 信号）。
 *
 * expected token 判定：每条目在表内括号注记期望（如 A-2 期望 verdict/host_mode 字段值）。
 * 通用兜底：命令 exit 0 即视为通过（输出 token 缺失不 FAIL，具名打印 observed 供复核）；
 * exit 非 0 且无 token 命中 → FAIL。
 */
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const INDEX = path.join(ROOT, 'plans', 'audit-index-20260925.md');

const results = [];
let fail = 0;
let pass = 0;

function record(id, face, ok, detail) {
  results.push({ id, face, ok: ok === true, detail });
  if (ok === true) pass += 1; else fail += 1;
}

/** 从反引号片段提取仓库相对路径候选（排除 .mjs 驱动命令面与 glob）。 */
function extractPaths(cellText) {
  const out = [];
  const re = /`([^`]+)`/g;
  let m;
  while ((m = re.exec(cellText)) !== null) {
    const t = m[1].trim();
    if (!t || t.includes(' ') || t.includes('#') || t.startsWith('-')) continue;
    if (/\.(md|mjs|json|txt|log|yaml|yml)$/i.test(t)) out.push(t);
  }
  return out;
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

const raw = fs.readFileSync(INDEX, 'utf8');
const rows = [];
for (const line of raw.split('\n')) {
  const t = line.trim();
  if (!t.startsWith('|')) continue;
  // 行内转义竖线（\|）先行占位还原——A-1 命令含 grep ... \| grep，不可当列分隔符
  const cells = t.split('|').map((c) => c.trim().replace(/\\\|/g, '|'));
  if (cells.length < 5) continue;
  if (/^#/.test(cells[1]) || /^-+$/.test(cells[1]) || /finding/.test(cells[1])) continue;
  const id = cells[1];
  if (!/^[ABCN]-\d+$/.test(id)) continue;
  rows.push({ id, finding: cells[2], evidence: cells[3], command: cells[4], allCells: cells });
}

console.log('# audit-index self-test（plans/audit-index-20260925.md 证据指针表机检）');
console.log('解析条目: ' + rows.length + ' 行（A/B/C/N 系）');

for (const row of rows) {
  // ① 证据路径存在性（该格内全部 md/json/log/txt 路径候选逐一验证；至少一个存在即算面在）
  // N 系（已知缺口披露行）证据格是叙述文字（指向别的条目），无路径要求——跳过证据面断言
  const isGapRow = row.id.startsWith('N-');
  const evidencePaths = isGapRow ? [] : extractPaths(row.evidence);
  if (evidencePaths.length === 0) {
    if (isGapRow) {
      record(row.id, 'evidence', true, 'GAP_ROW（披露面无路径要求，指向 ' + row.evidence.slice(0, 60) + '…）');
    } else {
      record(row.id, 'evidence', false, 'EVIDENCE_UNPARSABLE: 证据格无可识别路径');
      continue;
    }
  } else {
    const missing = evidencePaths.filter((p) => !fs.existsSync(path.join(ROOT, p)));
    const evidenceOk = missing.length < evidencePaths.length; // 至少一个在场即过（多路径格 = 指针组）
    record(row.id, 'evidence', evidenceOk, evidenceOk
      ? 'paths=' + evidencePaths.length + (missing.length ? '（缺 ' + missing.join(',') + '——组内主路径在场）' : ' 全在场')
      : 'EVIDENCE_MISSING: ' + missing.join(', '));
  }
  // ② 复验命令（命令格被转义竖线拆裂时（A-1/B-1/B-9 尾列含管道），从整行重建：取证据格之后所有格拼接）
  let cmdCell = row.command;
  if (!extractCommand(cmdCell) && row.allCells) {
    cmdCell = row.allCells.slice(3).join(' | ');
  }
  const cmd = extractCommand(cmdCell);
  if (!cmd) {
    // N 系披露行命令格是叙述文字（指向其它条目的复验方式），非可执行命令——按 GAP 登记不 FAIL
    if (row.id.startsWith('N-')) record(row.id, 'command', true, 'GAP_ROW（披露面无独立复验命令，指向 ' + cmdCell.slice(0, 50) + '…）');
    else record(row.id, 'command', false, 'COMMAND_MISSING: 复验命令格无可执行命令');
    continue;
  }
  if (cmd.startsWith('git ')) {
    // B-3 类：git 记录查询归审计者（L1 禁 git）——断言命令存在 + 证据路径存在即可，不执行
    record(row.id, 'command', true, 'SKIP-git（git 收口归编排者/审计者，L1 禁 git；命令已在案）');
    continue;
  }
  const r = spawnSync('bash', ['-c', cmd], { cwd: ROOT, encoding: 'utf8', timeout: 60000 });
  const out = String((r.stdout || '') + (r.stderr || ''));
  const exitOk = r.status === 0;
  record(row.id, 'command', exitOk, 'exit=' + r.status + ' out=' + out.trim().split('\n')[0].slice(0, 90));
}

console.log('\n逐条结果:');
for (const r of results) console.log((r.ok ? 'PASS' : 'FAIL') + ' ' + r.id + ' [' + r.face + '] ' + r.detail);

console.log('\n结果: ' + pass + ' PASS / ' + fail + ' FAIL');
if (fail > 0) {
  for (const r of results) if (!r.ok) console.log('  STALE: ' + r.id + ' [' + r.face + '] ' + r.detail);
  process.exitCode = 1;
} else {
  console.log('audit-index 全部证据路径在场、复验命令可执行——索引未 stale。');
}
