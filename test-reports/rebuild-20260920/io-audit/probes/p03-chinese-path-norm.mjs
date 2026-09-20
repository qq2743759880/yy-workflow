/**
 * p03 — 路径规范化：中文文件名 / 空格 / 正反斜杠混合 / 大小写不敏感。
 *   子进程 cwd 设为仓库外（os.tmpdir()）：既验证"作用域防护下 import 不安装"，
 *   又能调用导出的纯函数测路径逻辑（normalizePath/isUnderVendor/extractAsset）。
 */
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { spawnSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, '..', '..', '..', '..');
const HOOK = path.join(REPO, 'scripts', 'lib', 'io-audit-hook.mjs');

export async function run({ sandbox }) {
  const child = path.join(sandbox, 'tester.mjs');
  fs.writeFileSync(child, `
    import path from 'node:path';
    const hook = await import(${JSON.stringify(pathToFileURL(HOOK).href)});
    const R = hook.REPO_ROOT;
    const cases = [
      ['中文', path.join(R, 'vendor', 'implementation', '实现说明.md')],
      ['空格', path.join(R, 'vendor', 'planning', 'planning notes v2.md')],
      ['混合斜杠', path.join(R, 'vendor', 'sdlc', 'README.md').replace(/\\\\/g, '/')],
      ['大小写', path.join(R.toUpperCase(), 'vendor', 'review', 'REVIEW.md')],
      ['非vendor', path.join(R, 'package.json')],
    ];
    const out = cases.map(([name, p]) => {
      const n = hook.normalizePath(p);
      return { name, under: hook.isUnderVendor(n), asset: hook.extractAsset(n) };
    });
    console.log('RESULT_JSON:' + JSON.stringify(out));
  `, 'utf8');

  const r = spawnSync(process.execPath, [child], {
    cwd: os.tmpdir(), env: process.env, encoding: 'utf8',
  });
  if (r.status !== 0) return { ok: false, summary: '子进程退出 ' + r.status + ': ' + r.stderr };
  const m = (r.stdout || '').match(/RESULT_JSON:(.*)/);
  if (!m) return { ok: false, summary: '未取到结果: ' + r.stdout };
  const out = JSON.parse(m[1]);

  const by = Object.fromEntries(out.map((x) => [x.name, x]));
  const ok =
    by['中文'].under === true && by['中文'].asset === 'implementation' &&
    by['空格'].under === true && by['空格'].asset === 'planning' &&
    by['混合斜杠'].under === true && by['混合斜杠'].asset === 'sdlc' &&
    by['大小写'].under === true && by['大小写'].asset === 'review' &&
    by['非vendor'].under === false;

  return { ok, summary: JSON.stringify(by) };
}
