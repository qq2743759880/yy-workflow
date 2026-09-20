/**
 * p01 — hook 捕获验证：经 --import 预载后，四种读取面命中 vendor 被记录；非 vendor 不记。
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
  const auditDir = path.join(sandbox, 'audit');
  // 子进程脚本：读四种 vendor 面 + 一个非 vendor 文件
  const child = path.join(sandbox, 'child.mjs');
  fs.writeFileSync(child, `
    import fs from 'node:fs';
    import fsp from 'node:fs/promises';
    // 1) readFileSync（vendor）
    fs.readFileSync('vendor/implementation/implementation.md', 'utf8');
    // 2) promises.readFile（vendor）
    await fsp.readFile('vendor/planning/SKILL.md', 'utf8');
    // 3) createReadStream（vendor）——打开并消费
    await new Promise((res) => {
      const s = fs.createReadStream('vendor/review/SKILL.md');
      s.on('data', () => {}); s.on('end', res); s.on('error', res);
    });
    // 4) readdir（vendor 目录）
    fs.readdirSync('vendor');
    // 5) 非 vendor 文件——不应被记录
    fs.readFileSync('package.json', 'utf8');
    console.log('child done');
  `, 'utf8');

  const env = {
    ...process.env,
    YY_IO_AUDIT_DIR: auditDir,
    YY_IO_AUDIT_MAX_BYTES: String(5 * 1024 * 1024),
  };
  const r = spawnSync(process.execPath, ['--import', HOOK, child], {
    cwd: REPO, env, encoding: 'utf8',
  });
  if (r.status !== 0) return { ok: false, summary: 'child 退出码 ' + r.status + ' stderr: ' + r.stderr };

  const jsonl = path.join(auditDir, 'io-audit.jsonl');
  if (!fs.existsSync(jsonl)) return { ok: false, summary: '未产出 JSONL: ' + jsonl };
  const recs = fs.readFileSync(jsonl, 'utf8').trim().split('\n').filter(Boolean).map((l) => JSON.parse(l));
  const ops = recs.map((x) => x.op).sort();
  const paths = recs.map((x) => x.path);
  const allVendor = paths.every((p) => p.includes('/vendor/') || p.endsWith('/vendor'));
  const hasImpl = paths.some((p) => p.includes('/implementation/'));
  const hasPlanning = paths.some((p) => p.includes('/planning/'));
  const hasReview = paths.some((p) => p.includes('/review/'));
  const hasReaddir = ops.includes('readdir');
  const hasReadFile = ops.includes('readFile');
  const hasReadSync = ops.includes('readFileSync');
  const hasStream = ops.includes('createReadStream');
  const noPackage = !paths.some((p) => p.endsWith('/package.json'));

  const ok = allVendor && hasImpl && hasPlanning && hasReview && hasReaddir &&
    hasReadFile && hasReadSync && hasStream && noPackage;
  return {
    ok,
    summary: `记录 ${recs.length} 条; ops=[${ops.join(',')}]; 全 vendor=${allVendor} 四面齐=${hasReadSync && hasReadFile && hasStream && hasReaddir} 非vendor已滤=${noPackage}`,
  };
}
