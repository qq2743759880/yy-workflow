/** 自测辅助：安全阀负向测试。基于真实 make-release.mjs 生成副本，仅改写 INSTALL 指向
 * valve-test/<target>（junction fake-install → 含 .git 的 fake-target；plain-dir 为真实目录）。
 * 不动真实安装面 junction。用法：node make-valve-patch.mjs <fake-install|plain-dir> */
import fs from 'node:fs';
import path from 'node:path';

const base = path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1'));
const target = process.argv[2];
if (!target) { console.error('usage: node make-valve-patch.mjs <fake-install|plain-dir>'); process.exit(9); }
const src = path.join(base, '..', '..', '..', 'scripts', 'make-release.mjs');
const text = fs.readFileSync(src, 'utf8');
const marker = "const INSTALL = 'C:\\\\Users\\\\' + USER_NAME + '\\\\.agents\\\\skills\\\\yy';";
if (!text.includes(marker)) {
  console.error('MARKER NOT FOUND — aborting, will not run an unpatched copy');
  process.exit(9);
}
const patched = text.replace(
  marker,
  "const INSTALL = 'D:\\\\.ai-hub\\\\skills\\\\yy\\\\test-reports\\\\autopilot-work\\\\HARD-2\\\\valve-test\\\\" + target + "';"
);
// git-sentinel 模式额外把 REPO 指向 valve-test/fake-repo（仓库外假仓），使 .git 哨兵成为首个触发的阀
let out = patched;
let outName = target === 'fake-install' ? 'make-release-valve-git.mjs' : 'make-release-valve-plain.mjs';
if (target === 'fake-install') {
  const repoLine = "const REPO = fs.realpathSync(path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\\/([A-Za-z]:)/, '$1')), '..'));";
  if (!patched.includes(repoLine)) { console.error('REPO MARKER NOT FOUND'); process.exit(9); }
  out = patched.replace(
    repoLine,
    "const REPO = fs.realpathSync('D:\\\\.ai-hub\\\\skills\\\\yy\\\\test-reports\\\\autopilot-work\\\\HARD-2\\\\valve-test\\\\fake-repo');"
  );
  outName = 'make-release-valve-git.mjs';
}
fs.writeFileSync(path.join(base, 'valve-test', outName), out, 'utf8');
console.log('patched copy written:', outName);
console.log(out.split('\n').find((l) => l.includes('const INSTALL')));
