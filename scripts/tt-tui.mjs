#!/usr/bin/env node
/**
 * TT 独立 TUI 复盘（FR-5）：轮询 .tt-state/state.json 渲染 DAG，供已跑任务事后复盘。
 * 与 orchestrator --tui 共享 scripts/lib/tui.mjs 渲染器（同一 createTui/renderStatic）。
 *
 * 用法: node scripts/tt-tui.mjs [--workspace PATH] [--poll N]
 *  - state.json 缺失 → 报错 exit 1（先用 orchestrator 跑一轮生成 state）。
 *  - 非 TTY → 一次性静态 DAG 文本输出，exit 0（不崩溃）。
 *  - 已完成/失败 → 渲染最终 DAG + 汇总，exit 0。
 *  - 执行中 → 按 --poll（默认 500ms）低频轮询实时渲染，完成后退出。
 *  - TT_TUI=off 或 --no-tui → 完全不渲染，exit 0（逃生舱）。
 * 零依赖：仅 node:fs/promises + node:path + lib/tui.mjs。
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import fsSync from 'node:fs';
import { fileURLToPath } from 'node:url';
import { createTui, renderStatic } from './lib/tui.mjs';

function parseArgs(args) {
  const out = { workspace: '.', poll: 500, noTui: false, help: false };
  for (let i = 0; i < args.length; i += 1) {
    const a = args[i];
    if (a === '--workspace') { out.workspace = args[i + 1] || '.'; i += 1; }
    else if (a === '--poll') { out.poll = Number(args[i + 1]) || 500; i += 1; }
    else if (a === '--no-tui') out.noTui = true;
    else if (a === '--help' || a === '-h') out.help = true;
  }
  return out;
}

function stateFile(workspace) {
  return path.join(workspace, '.tt-state', 'state.json');
}

async function readState(workspace) {
  return JSON.parse(await fs.readFile(stateFile(workspace), 'utf8'));
}

function isComplete(plan) {
  if (!plan) return false;
  if (plan.status === 'done' || plan.status === 'failed') {
    if (!Array.isArray(plan.subtasks)) return true;
    return !plan.subtasks.some((s) => s.status === 'running');
  }
  return false;
}

export async function main() {
  const opts = parseArgs(process.argv.slice(2));
  if (opts.help) { console.log('usage: node scripts/tt-tui.mjs [--workspace PATH] [--poll N]'); return 0; }
  // 逃生舱：完全不渲染（批判 C5 回灌）
  if (opts.noTui || process.env.TT_TUI === 'off') return 0;
  let plan;
  try {
    plan = await readState(opts.workspace);
  } catch (error) {
    console.error('[tt-tui] 无法读取 ' + stateFile(opts.workspace) + ': ' + error.message + '（请先用 orchestrator.mjs 跑一轮生成 state.json）');
    return 1;
  }
  if (!plan || !Array.isArray(plan.subtasks)) { console.error('[tt-tui] state.json 无 subtasks，无法渲染'); return 1; }
  const reportPath = 'artifacts/report-' + plan.id + '.md';
  if (!process.stdout.isTTY) {
    // 非 TTY 降级：一次性静态 DAG 文本 + 退出码 0
    console.log(renderStatic(plan));
    console.log('final: ' + (plan.status || 'done') + ' | report: ' + reportPath);
    return 0;
  }
  const tui = createTui(plan, { stream: process.stdout });
  tui.start();
  if (isComplete(plan)) { tui.finish({ status: plan.status, reportPath }); return 0; }
  // 执行中：低频轮询 state.json，完成后收尾退出（轮询定时器保持活跃——unref 会让事件循环提前排空）
  return new Promise((resolve) => {
    const timer = setInterval(async () => {
      try {
        const fresh = await readState(opts.workspace);
        if (fresh && Array.isArray(fresh.subtasks)) {
          tui.replace(fresh);
          if (isComplete(fresh)) {
            clearInterval(timer);
            tui.finish({ status: fresh.status, reportPath });
            resolve(0);
          }
        }
      } catch (error) { /* state 暂不可读（写中间态），等下一轮 */ }
    }, opts.poll);
  });
}

// 仅作为 CLI 入口时执行主流程；被 import 时暴露 main 供复用/测试。
/* realpath 归一的主模块判定：junction（mklink）/大小写/短名安装形态下
 * import.meta.url 会被解析到真实路径而 argv[1] 保持安装路径，直等比较会静默跳过 main()
 * （2026-09-21 盲测发现：junction 部署的 yy 全部 CLI 静默 exit 0）。两侧 realpath 后比较。 */
function isMainFileMatch() {
  try {
    const self = fsSync.realpathSync(fileURLToPath(import.meta.url));
    let entry = process.argv[1];
    if (!entry) return false;
    try { entry = fsSync.realpathSync(path.resolve(entry)); } catch { entry = path.resolve(entry); }
    return self === entry;
  } catch { return false; }
}
const isMain = process.argv[1] && isMainFileMatch();
if (isMain) {
  main().then(function (code) { process.exitCode = code; }).catch(function (error) { console.error('[tt-tui] ' + error.message); process.exitCode = 1; });
}
