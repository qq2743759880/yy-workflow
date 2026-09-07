#!/usr/bin/env node
/**
 * visual-diff-pages — git diff 驱动的前端页面清单（VLM 语义抽样范围）。
 * 分层执行策略：像素 diff 全量回归用 toHaveScreenshot（零 token），VLM 语义审查只抽 diff 影响的页面（token 受控）。
 * 用法：node scripts/visual-diff-pages.mjs [--base <git-base>] [--dir <repo>]
 */
import { execFileSync } from 'node:child_process';
import path from 'node:path';

const EXT_RE = /\.(tsx|jsx|vue|html)$/i;

function main() {
  const args = process.argv.slice(2);
  let base = 'HEAD';
  const bi = args.indexOf('--base'); if (bi !== -1 && args[bi + 1]) base = args[bi + 1];
  let cwd = '.';
  const di = args.indexOf('--dir'); if (di !== -1 && args[di + 1]) cwd = path.resolve(args[di + 1]);

  let files = [];
  for (const candidate of [base, 'HEAD']) {
    try { files = execFileSync('git', ['diff', '--name-only', candidate], { cwd, encoding: 'utf8' }).split('\n').filter(Boolean); break; }
    catch (e) { /* try next */ }
  }
  // 并入 untracked（未提交）文件：当前任务新建页面恰是最该 L1 语义审查的，diff 看不到必须补
  try {
    const untracked = execFileSync('git', ['ls-files', '--others', '--exclude-standard'], { cwd, encoding: 'utf8' }).split('\n').filter(Boolean);
    files = files.concat(untracked);
  } catch (e) { /* 非 git 或失败，忽略 */ }
  if (!files.length) { console.log('NO_DIFF_PAGES（无 diff 或非 git 仓库）——VLM 语义抽样为空，可全量像素回归'); return 0; }
  const pages = files.filter((f) => EXT_RE.test(f));
  if (!pages.length) { console.log('NO_DIFF_PAGES 变更不含前端页面文件（' + files.length + ' 文件）'); return 0; }
  console.log('DIFF_PAGES(' + pages.length + '):');
  for (const p of pages) console.log('  ' + p);
  return 0;
}

process.exitCode = main();
