/** 自测辅助：valve-test 装置。用 node 创建测试 junction（不动真实安装面 junction）。 */
import fs from 'node:fs';
import path from 'node:path';

const base = path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1'));
const targetDir = path.join(base, 'valve-test', 'fake-target');
const installLink = path.join(base, 'valve-test', 'fake-install');
fs.mkdirSync(path.join(targetDir, '.git'), { recursive: true });
fs.writeFileSync(path.join(targetDir, 'dummy.txt'), 'valve test\n');
try { fs.rmSync(installLink, { force: true }); } catch {}
fs.symlinkSync(targetDir, installLink, 'junction');
console.log('junction created:', installLink);
console.log('realpath =', fs.realpathSync(installLink));
console.log('.git present =', fs.existsSync(path.join(targetDir, '.git')));
