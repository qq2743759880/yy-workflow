/**
 * p04 — 作用域防护 + JSONL 滚动：
 *   A) 子进程 cwd 在仓库外 → 即便 --import 钩子，也不记录任何 JSONL（防 NODE_OPTIONS 泄漏）。
 *   B) YY_IO_AUDIT_MAX_BYTES 压到很小 → 多次写入后应滚动出一个 .1 副本。
 */
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { spawnSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, '..', '..', '..', '..');
const HOOK = pathToFileURL(path.join(REPO, 'scripts', 'lib', 'io-audit-hook.mjs')).href;

export async function run({ sandbox }) {
  // A) 仓库外 cwd
  const outsideDir = path.join(sandbox, 'outside-audit');
  fs.mkdirSync(outsideDir, { recursive: true });
  const outChild = path.join(sandbox, 'outside-reader.mjs');
  fs.writeFileSync(outChild, `
    import fs from 'node:fs';
    fs.readFileSync(${JSON.stringify(path.join(REPO, 'vendor', 'implementation', 'implementation.md'))}, 'utf8');
    console.log('done');
  `, 'utf8');
  const envA = { ...process.env, YY_IO_AUDIT_DIR: outsideDir };
  const ra = spawnSync(process.execPath, ['--import', HOOK, outChild], {
    cwd: os.tmpdir(), env: envA, encoding: 'utf8',
  });
  const jsonlA = path.join(outsideDir, 'io-audit.jsonl');
  const outsideBlocked = ra.status === 0 && !fs.existsSync(jsonlA);

  // B) 滚动：阈值压到很小
  const rotateDir = path.join(sandbox, 'rotate-audit');
  const rotChild = path.join(sandbox, 'rotate-reader.mjs');
  fs.writeFileSync(rotChild, `
    import fs from 'node:fs';
    // 反复读，足够多条记录超过阈值
    for (let i = 0; i < 40; i++) {
      fs.readFileSync('vendor/implementation/implementation.md', 'utf8');
    }
    console.log('done');
  `, 'utf8');
  const envB = { ...process.env, YY_IO_AUDIT_DIR: rotateDir, YY_IO_AUDIT_MAX_BYTES: '256' };
  const rb = spawnSync(process.execPath, ['--import', HOOK, rotChild], {
    cwd: REPO, env: envB, encoding: 'utf8',
  });
  if (rb.status !== 0) return { ok: false, summary: '滚动子进程退出 ' + rb.status + ': ' + rb.stderr };
  const oneFile = path.join(rotateDir, 'io-audit.jsonl.1');
  const rotated = fs.existsSync(oneFile);

  const ok = outsideBlocked && rotated;
  return {
    ok,
    summary: `仓库外不记录=${outsideBlocked}；滚动 .1 存在=${rotated}（.1 字节=${rotated ? fs.statSync(oneFile).size : 0}）`,
  };
}
