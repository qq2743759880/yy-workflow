/**
 * p08 — P2-2 修复验证：JSONL 的 path 字段存原文路径，不做大小写折叠。
 *   子脚本读 vendor/colorize/SKILL.md（SKILL.md 大写），验证落盘 path 中
 *   文件名部分保留原始大小写（SKILL.md），而非折叠成 skill.md。
 *
 * 同时验证：大小写折叠仍用于 vendor 前缀判定——即使传入大写 VENDOR 路径，
 * 只要实际在 vendor 下就仍被记录（前缀判定不丢）。
 */
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { spawnSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, '..', '..', '..', '..');
const HOOK = pathToFileURL(path.join(REPO, 'scripts', 'lib', 'io-audit-hook.mjs')).href;

function runChild(childScriptContent, auditDir, childName) {
  const child = path.join(os.tmpdir(), childName);
  fs.writeFileSync(child, childScriptContent, 'utf8');
  const env = { ...process.env, YY_IO_AUDIT_DIR: auditDir, YY_IO_AUDIT_MAX_BYTES: String(5 * 1024 * 1024) };
  const r = spawnSync(process.execPath, ['--import', HOOK, child], { cwd: REPO, env, encoding: 'utf8' });
  if (r.status !== 0) throw new Error(childName + ' 退出码 ' + r.status + ': ' + r.stderr);
  const jsonl = path.join(auditDir, 'io-audit.jsonl');
  const recs = fs.existsSync(jsonl)
    ? fs.readFileSync(jsonl, 'utf8').trim().split('\n').filter(Boolean).map((l) => JSON.parse(l))
    : [];
  return recs;
}

export async function run({ sandbox }) {
  const dir1 = path.join(sandbox, 'orig-case');
  const dir2 = path.join(sandbox, 'upper-vendor');
  fs.mkdirSync(dir1, { recursive: true });
  fs.mkdirSync(dir2, { recursive: true });

  // 1) 正常大小写路径：SKILL.md 大写保留
  const recs1 = runChild(`
    import fs from 'node:fs';
    fs.readFileSync('vendor/colorize/SKILL.md', 'utf8');
    console.log('done');
  `, dir1, 'case-check-reader.mjs');

  // 2) 大写 VENDOR 路径仍被记录（前缀判定折叠），但 path 落盘保留原文大小写
  const vendorUpper = path.join(REPO, 'VENDOR', 'colorize', 'SKILL.md');
  const recs2 = runChild(`
    import fs from 'node:fs';
    import path from 'node:path';
    // 用 resolve 构造大写 VENDOR 前缀路径——win32 大小写不敏感，文件确实存在
    fs.readFileSync(path.resolve(${JSON.stringify(vendorUpper)}), 'utf8');
    console.log('done');
  `, dir2, 'upper-vendor-reader.mjs');

  const r1 = recs1.length ? recs1[0].path : '(none)';
  const r2 = recs2.length ? recs2[0].path : '(none)';

  // 验证 1：path 中含大写 SKILL.md（不是 skill.md）
  const keepsCase = /SKILL\.md$/.test(r1);
  const notLowered = !/skill\.md$/.test(r1);

  // 验证 2：大写 VENDOR 路径仍被记录（前缀折叠生效），且落盘保留 VENDOR 大写
  const upperVendorRecorded = recs2.length > 0;
  const upperVendorKept = upperVendorRecorded && /\/VENDOR\//.test(r2);

  const ok = keepsCase && notLowered && upperVendorRecorded && upperVendorKept;

  return {
    ok,
    summary: `path="${r1}" SKILL大写保留=${keepsCase} 未折叠=${notLowered}; 大写VENDOR仍记录=${upperVendorRecorded} 落盘保留VENDOR大写=${upperVendorKept}`,
  };
}
