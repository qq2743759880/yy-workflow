#!/usr/bin/env node
// R-2 诊断脚本：解析 npm prune 日志（E:\npm-cache\_logs），列出被移除的顶层包名
// 日志为 Windows 文本：路径带字面双反斜杠（'D:\\.ai-hub\\...\\node_modules\\ajv-errors'）+ CRLF
import fs from 'node:fs';
const logPath = 'E:/npm-cache/_logs/2026-09-26T07_25_10_958Z-debug-0.log';
const log = fs.readFileSync(logPath, 'utf8');
const removed = new Set();
for (const line of log.split('\n')) {
  if (!line.includes('silly reify')) continue;
  // 匹配 node_modules\\<name> 或 node_modules\\<@scope>\\<name>（字面双反斜杠）
  const re = /node_modules\\\\(@[^\\\\]+\\\\[^\\']+|[^\\'@][^\\']*)/g;
  let m;
  while ((m = re.exec(line)) !== null) {
    const raw = m[1];
    if (raw.startsWith('.bin')) continue;
    const parts = raw.split('\\\\');
    const name = parts[0].startsWith('@') ? parts.slice(0, 2).join('/') : parts[0];
    if (name && !name.startsWith('.')) removed.add(name);
  }
}
const names = [...removed].sort();
console.log('unique top-level names removed:', names.length);
console.log(names.join('\n'));
