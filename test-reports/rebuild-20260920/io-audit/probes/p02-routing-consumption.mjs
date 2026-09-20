/**
 * p02 — routing vs consumption 归类验证：
 *   调用栈帧含 "matrix.mjs"（子脚本命名为 fake-matrix.mjs）→ routing；
 *   普通子脚本（plain-reader.mjs）→ consumption。
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
  // 子脚本放 os.tmpdir()：避免其路径落在仓库 test-reports/rebuild-.../io-audit/ 下，
  // 否则路径里的 "io-audit" 字样会误命中路由特征串。cwd 仍设为 REPO 以过作用域防护。
  const child = path.join(os.tmpdir(), name);
  fs.writeFileSync(child, `
    import fs from 'node:fs';
    fs.readFileSync('vendor/implementation/implementation.md', 'utf8');
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
  const routingDir = path.join(sandbox, 'routing');
  const consDir = path.join(sandbox, 'consumption');
  fs.mkdirSync(routingDir, { recursive: true });
  fs.mkdirSync(consDir, { recursive: true });

  const routingRecs = runChild('fake-matrix.mjs', routingDir);
  const consRecs = runChild('plain-reader.mjs', consDir);

  const routingTag = routingRecs.map((x) => x.tag);
  const consTag = consRecs.map((x) => x.tag);
  const ok = routingRecs.length > 0 && routingTag.every((t) => t === 'routing') &&
    consRecs.length > 0 && consTag.every((t) => t === 'consumption');

  return {
    ok,
    summary: `routing 子(${routingRecs.length} 条 tag=${routingTag.join('/')}) consumption 子(${consRecs.length} 条 tag=${consTag.join('/')})`,
  };
}
