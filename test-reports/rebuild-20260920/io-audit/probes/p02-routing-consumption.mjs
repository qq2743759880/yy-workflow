/**
 * p02 — routing vs consumption 归类验证（**basename 边界口径**）。
 *
 * T8 加固批②（编排者 P2-2 / T7 D-3 裁决）：本探针原期望是「调用栈帧含 `matrix.mjs` 子串
 * ⇒ routing」，并以 `fake-matrix.mjs` 作为 routing 子脚本。该期望与 P2-1 确立的
 * **basename 精确匹配**口径自相矛盾（`fake-matrix.mjs` 的 basename 是 `fake-matrix.mjs`，
 * 不在 ROUTING_BASENAMES 集合内），属**陈旧预期**，故长期 FAIL。
 *
 * 对齐 p07（P2-1 权威口径）后的期望矩阵：
 *   - `matrix.mjs`（真路由脚本 basename）      → routing
 *   - `fake-matrix.mjs`（仅含 matrix.mjs 子串）→ consumption（边界口径下不误命中）
 *   - `plain-reader.mjs`（普通读脚本）          → consumption
 *
 * 断言口径不变：routing 组记录全 routing、consumption 组记录全 consumption，且两组都非空。
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
  // basename 边界口径：真 matrix.mjs → routing；fake-matrix.mjs（仅子串）→ consumption
  const routingDir = path.join(sandbox, 'routing');
  const fakeDir = path.join(sandbox, 'fake-boundary');
  const consDir = path.join(sandbox, 'consumption');
  fs.mkdirSync(routingDir, { recursive: true });
  fs.mkdirSync(fakeDir, { recursive: true });
  fs.mkdirSync(consDir, { recursive: true });

  const routingRecs = runChild('matrix.mjs', routingDir);
  const fakeRecs = runChild('fake-matrix.mjs', fakeDir);
  const consRecs = runChild('plain-reader.mjs', consDir);

  const routingTag = routingRecs.map((x) => x.tag);
  const fakeTag = fakeRecs.map((x) => x.tag);
  const consTag = consRecs.map((x) => x.tag);

  const routingOk = routingRecs.length > 0 && routingTag.every((t) => t === 'routing');
  const fakeOk = fakeRecs.length > 0 && fakeTag.every((t) => t === 'consumption');
  const consOk = consRecs.length > 0 && consTag.every((t) => t === 'consumption');
  const ok = routingOk && fakeOk && consOk;

  return {
    ok,
    summary: `basename 边界口径：matrix.mjs=${routingTag.join('/') || '(none)'}（期望 routing）`
      + ` fake-matrix.mjs=${fakeTag.join('/') || '(none)'}（期望 consumption）`
      + ` plain-reader.mjs=${consTag.join('/') || '(none)'}（期望 consumption）`,
  };
}
