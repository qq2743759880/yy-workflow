#!/usr/bin/env node
/**
 * security-scan — 实际调用已部署的 semgrep (SAST) + gitleaks (密钥) 扫描项目。
 * 让 security 资产从"声明内核"升级为"真实执行"（第三方面部署，不重复造轮子）。
 * 用法：node scripts/security-scan.mjs <目标目录> [--semgrep-only|--gitleaks-only]
 * 依赖：semgrep (pip) + gitleaks (go install) 在 PATH；缺工具时诚实降级（标注"未执行"）。
 */
import { spawnSync } from 'node:child_process';
import path from 'node:path';

function main() {
  const args = process.argv.slice(2);
  const dir = args.find((a) => !a.startsWith('--')) || '.';
  const target = path.resolve(dir);
  const onlyGitleaks = args.includes('--gitleaks-only');
  const onlySemgrep = args.includes('--semgrep-only');

  let found = 0;

  if (!onlySemgrep) {
    console.log('== 密钥扫描 (gitleaks) ==');
    const gl = spawnSync('gitleaks', ['git', '--no-banner', '-v'], { cwd: target, encoding: 'utf8', timeout: 60000 });
    if (gl.error && gl.error.code === 'ENOENT') console.log('[降级] gitleaks 未安装（go install github.com/zricethezav/gitleaks/v8）——密钥扫描未执行');
    else {
      const out = (gl.stdout || '') + (gl.stderr || '');
      const leakLines = out.split('\n').filter((l) => /leak|finding/i.test(l) && !l.includes('no leaks'));
      if (leakLines.length) { for (const l of leakLines.slice(0, 10)) console.log('  ' + l.trim()); found += leakLines.length; }
      else console.log('  无密钥泄露');
    }
  }

  if (!onlyGitleaks) {
    console.log('== SAST (semgrep) ==');
    const sg = spawnSync('semgrep', ['scan', '--quiet', '--json', target], { cwd: process.cwd(), encoding: 'utf8', timeout: 180000, maxBuffer: 16 * 1024 * 1024 });
    if (sg.error && sg.error.code === 'ENOENT') console.log('[降级] semgrep 未安装（pip install semgrep）——SAST 未执行');
    else {
      try {
        const j = JSON.parse(sg.stdout);
        const results = j.results || [];
        console.log('  发现 ' + results.length + ' 条');
        for (const r of results.slice(0, 15)) console.log('  [' + r.check_id + '] ' + r.path.replace(target + path.sep, '') + ':' + r.start.line + (r.extra && r.extra.message ? ' — ' + r.extra.message.slice(0, 60) : ''));
        found += results.length;
      } catch (e) { console.log('  ' + (sg.stdout || sg.stderr || 'semgrep 无输出').trim()); }
    }
  }

  console.log(found ? '\n[FAIL] 发现 ' + found + ' 项（见上，需修复）' : '\n[OK] 未发现安全问题（gitleaks + semgrep）');
  return found ? 1 : 0;
}

process.exitCode = main();
