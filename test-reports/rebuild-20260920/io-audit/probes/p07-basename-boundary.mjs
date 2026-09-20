/**
 * p07 — P2-1 修复验证：routing 归类用路径段边界精确比对 basename。
 *   - 子脚本命名 callermatrix.mjs  → 不应误判 routing（含 "matrix.mjs" 子串但非路由脚本）
 *   - 子脚本命名 official-ci.mjs    → 不应误判 routing（含 "ci.mjs" 子串但非路由脚本）
 *   - 子脚本命名 matrix.mjs        → 应判 routing（basename 精确匹配路由脚本集合）
 *
 * 子脚本放 os.tmpdir()，cwd 设为 REPO 以过作用域防护。
 */
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { spawnSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, '..', '..', '..', '..');
const HOOK = pathToFileURL(path.join(REPO, 'scripts', 'lib', 'io-audit-hook.mjs')).href;

function runChild(name, auditDir) {
  const child = path.join(os.tmpdir(), name);
  fs.writeFileSync(child, `
    import fs from 'node:fs';
    fs.readFileSync('vendor/colorize/SKILL.md', 'utf8');
    console.log('done');
  `, 'utf8');
  const env = { ...process.env, YY_IO_AUDIT_DIR: auditDir, YY_IO_AUDIT_MAX_BYTES: String(5 * 1024 * 1024) };
  const r = spawnSync(process.execPath, ['--import', HOOK, child], { cwd: REPO, env, encoding: 'utf8' });
  if (r.status !== 0) throw new Error(name + ' 退出码 ' + r.status + ': ' + r.stderr);
  const jsonl = path.join(auditDir, 'io-audit.jsonl');
  const recs = fs.existsSync(jsonl)
    ? fs.readFileSync(jsonl, 'utf8').trim().split('\n').filter(Boolean).map((l) => JSON.parse(l))
    : [];
  return recs;
}

export async function run({ sandbox }) {
  const cmDir = path.join(sandbox, 'callermatrix');
  const ocDir = path.join(sandbox, 'official-ci');
  const mDir = path.join(sandbox, 'matrix');
  fs.mkdirSync(cmDir, { recursive: true });
  fs.mkdirSync(ocDir, { recursive: true });
  fs.mkdirSync(mDir, { recursive: true });

  const cmRecs = runChild('callermatrix.mjs', cmDir);
  const ocRecs = runChild('official-ci.mjs', ocDir);
  const mRecs = runChild('matrix.mjs', mDir);

  const cmTag = cmRecs.length ? cmRecs[0].tag : '(none)';
  const ocTag = ocRecs.length ? ocRecs[0].tag : '(none)';
  const mTag = mRecs.length ? mRecs[0].tag : '(none)';

  // callermatrix.mjs → consumption（子串不再误判）
  // official-ci.mjs → consumption（子串不再误判）
  // matrix.mjs      → routing（basename 精确匹配）
  const ok = cmTag === 'consumption' && ocTag === 'consumption' && mTag === 'routing';

  return {
    ok,
    summary: `callermatrix.mjs=${cmTag} official-ci.mjs=${ocTag} matrix.mjs=${mTag}（期望 consumption/consumption/routing）`,
  };
}
