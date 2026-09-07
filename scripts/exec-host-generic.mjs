#!/usr/bin/env node
/**
 * TT skill — 通用宿主（claude/codex 等，零依赖，node >= 18）。
 * 读 brief（prompt 后端的子任务执行指令包）→ 组装该 CLI 的**非交互调用**（brief 内容经 stdin 喂入，
 * 防 argv 超长；spawn stdio 显式接管、结束后关闭 stdin，防 stdin 继承挂起）→ 捕获 stdout/stderr
 * → 把输出写 plan.md 到 brief 同目录（含资产锚点 + 内核词提取，仿 exec-host-openclaw/a6api）→
 * 超时/失败诚实报错 exit 1。只读 CLI 参数接入，绝不写任何宿主配置文件。
 *
 * 用法: node exec-host-generic.mjs --cli claude|codex|cursor|trae --brief <brief.md>
 *           [--model <id>] [--timeout <ms>]  [或直接把 brief 绝对路径作为最后一个位置参数]
 *
 * 非交互调用形态（只读 CLI 参数，不改配置）：
 *   claude : claude -p        （stdin 喂 brief；用用户现有 env 认证，不写 settings.json）
 *   codex  : codex exec -     （stdin 喂 brief；仅当 CLI 存在时真跑，挂起则诚实报 TIMEOUT）
 *   cursor/trae: 无干净非交互模式 → 诚实报 no-noninteractive-cli（不强接）
 *
 * 产物 plan.md 含方法论标题锚点（第一行）与资产名，供编排器 assetConsumed=true 校验；
 * kernel 资产（brief 含 Execution kernel 段）须锚点 AND ≥1 内核词，缺失时如实标注缺内核词。
 */
import { spawn } from 'node:child_process';
import fs from 'node:fs/promises';
import path from 'node:path';
import { resolveCommandShim } from './lib/adapters/util.mjs';

const DEFAULT_TIMEOUT = 300000;
const KNOWN = ['claude', 'codex', 'cursor', 'trae'];
// 无干净非交互的 GUI 平台类 CLI（探测报告同理标注 no-noninteractive-cli，不强接）
const NO_NONINTERACTIVE = ['cursor', 'trae'];

async function fail(code, msg) {
  console.error('[exec-host-generic] ' + msg);
  await new Promise((r) => setTimeout(r, 50));
  process.exit(code);
}

// argv 解析：--cli/--brief/--model/--timeout 为标志值对；brief 也接受位置参数（编排器追加在最后）。
const args = process.argv.slice(2);
let cli = null;
let briefPath = null;
let model = null;
let timeoutMs = DEFAULT_TIMEOUT;
for (let i = 0; i < args.length; i += 1) {
  const a = args[i];
  if (a === '--help' || a === '-h') {
    console.log('用法: node exec-host-generic.mjs --cli claude|codex|cursor|trae --brief <brief.md> [--model <id>] [--timeout <ms>]');
    console.log('brief 也可作为最后一个位置参数传入（编排器 --exec 追加形态）。');
    process.exit(0);
  } else if (a === '--cli') { const v = args[i + 1]; if (!v || v.startsWith('--')) await fail(2, '--cli 需要宿主名'); cli = v; i += 1; }
  else if (a === '--brief') { const v = args[i + 1]; if (!v || v.startsWith('--')) await fail(2, '--brief 需要 brief 路径'); briefPath = v; i += 1; }
  else if (a === '--model') { const v = args[i + 1]; if (!v || v.startsWith('--')) await fail(2, '--model 需要模型 id'); model = v; i += 1; }
  else if (a === '--timeout') { const v = Number(args[i + 1]); if (!Number.isNaN(v) && v > 0) timeoutMs = v; i += 1; }
  else if (!a.startsWith('--')) briefPath = a;
}
if (!cli) await fail(2, '缺少 --cli（claude|codex|cursor|trae）');
if (!KNOWN.includes(cli)) await fail(2, '未知宿主 ' + cli + '（支持 ' + KNOWN.join('/') + '）');
if (!briefPath) await fail(2, '缺少 brief 路径');
if (NO_NONINTERACTIVE.includes(cli)) {
  await fail(1, cli + ' 无干净非交互模式（no-noninteractive-cli）：只读探测已如实标注，不强接。换用 claude/codex 或 a6api/openclaw 宿主。');
}

let brief;
try { brief = await fs.readFile(briefPath, 'utf8'); }
catch (e) { await fail(2, '读取 brief 失败: ' + e.message); }

const assetMatch = brief.match(/-\s*asset:\s*([^\s]+)/);
const asset = assetMatch ? assetMatch[1].trim() : '(unknown)';
const methodMatch = brief.match(/##\s*方法论正文[\s\S]*?\n(#{1,6}\s+[^\n]+)/);
const anchor = (methodMatch && methodMatch[1].replace(/^#{1,6}\s*/, '').trim()) || asset;
const taskMatch = brief.match(/##\s*本子任务[\s\S]*?-\s*说明:\s*([^\n]+)/);
const task = taskMatch ? taskMatch[1].trim() : '(brief 中未提取到任务)';

// 内核词（与编排器 assetConsumed 校验一致）：kernel 资产须锚点 AND ≥1 内核词
const VIRTUAL = /^(via|the|and|for|of|to|in|is|or|not|with|as|at|by|hub|uses|layer)$/i;
const kernelLine = (brief.match(/## Execution kernel[\s\S]*?Kernel:\s*([^\n]+)/) || [])[1] || '';
const kernelTokens = [...new Set((kernelLine.match(/`([A-Za-z][A-Za-z0-9._/-]{2,})`|([A-Za-z][A-Za-z0-9._/-]{2,})/g) || [])
  .map((t) => t.replace(/`/g, '').toLowerCase())
  .filter((t) => t.length >= 3 && !VIRTUAL.test(t)))];

// 宿主注入指令：让真机模型显式产出锚点/内核词，供 assetConsumed 机器校验识别
const message = brief + "\n\n---\n\n## 执行指令（宿主注入，" + cli + " 非交互执行宿主）\n\n" +
  "- 严格以上述 brief 中「## 方法论正文（资产全文）」为方法论指导，针对「## 本子任务」产出可直接执行的方案（Markdown）。\n" +
  "- 回复第一行必须写方法论标题锚点（即「方法论正文」段之后首个标题的标题文字，预期为：" + anchor + "）。\n" +
  (kernelTokens.length ? "- 回复正文须包含方法论内核标识（brief 中 `Kernel:` 行 token）中的至少一个，如：" + kernelTokens.slice(0, 6).join('、') + "。\n" : "") +
  "- 回复正文须标明消费了哪个资产的方法论；不要用 ``` 代码围栏包裹整篇回复；不要调用任何工具改动文件，只输出方案文本。";

// 组装非交互调用（只读 CLI 参数 + stdin 输入，spawn 进程 env 继承用户现有认证，绝不写宿主配置文件）
function buildInvocation() {
  if (cli === 'claude') {
    const a = ['-p', '--output-format', 'text'];
    if (model) a.push('--model', model);
    return { args: a };
  }
  // codex
  const a = ['exec', '-', '--color', 'never', '--skip-git-repo-check'];
  if (model) a.push('-m', model);
  return { args: a };
}

const entry = resolveCommandShim(cli);
const inv = buildInvocation();

function runHost() {
  return new Promise((resolve) => {
    let stdout = '';
    let stderr = '';
    let done = false;
    const child = spawn(entry.command, entry.prefix.concat(inv.args), {
      stdio: ['pipe', 'pipe', 'pipe'],  // stdin 显式接管：喂完立即 end，防继承交互 stdin 挂起（C-10）
      env: process.env,
    });
    const timer = setTimeout(() => {
      child.kill();
      finish({ ok: false, timeout: true, code: null, stdout, stderr });
    }, timeoutMs);
    if (timer.unref) timer.unref();
    child.stdin.on('error', () => {});
    child.stdin.write(message, () => { try { child.stdin.end(); } catch (e) { /* stdin 已关 */ } });
    child.stdout.on('data', (c) => { stdout += c; });
    child.stderr.on('data', (c) => { stderr += c; });
    child.on('error', (e) => {
      finish({ ok: false, timeout: false, code: null, stdout, stderr, err: e.code === 'ENOENT' ? cli + ' 未在 PATH 中找到（本机未安装/未接入）' : String(e.message || e) });
    });
    child.on('close', (code) => { finish({ ok: code === 0, timeout: false, code, stdout, stderr }); });
    function finish(r) { if (done) return; done = true; clearTimeout(timer); resolve(r); }
  });
}

let run;
try { run = await runHost(); }
catch (e) { await fail(1, cli + ' 调用异常: ' + String(e && e.message || e)); }

if (run.timeout) {
  const detail = run.stderr ? ' stderr: ' + run.stderr.slice(0, 300) : '';
  await fail(1, cli + ' 执行超时（TIMEOUT ' + Math.round(timeoutMs / 1000) + 's）' + detail);
}
if (!run.ok) {
  const detail = run.err ? run.err : ('exit ' + run.code + (run.stderr ? ' stderr: ' + run.stderr.slice(0, 400) : ''));
  await fail(1, cli + ' 执行失败（' + detail + '）');
}

let content = (run.stdout || '').trim();
// stdout 中若出现注入指令段的回显（模型不回显，但个别 CLI 会回显输入），剥离到 brief 尾部之后
const injMark = content.indexOf('\n---\n\n## 执行指令');
if (injMark > 0) content = content.slice(0, injMark).trim();
if (!content) await fail(1, cli + ' 空回复（无 stdout 输出）——brief-only，不假报执行');

const planPath = path.join(path.dirname(briefPath), 'plan.md');
const plan = [
  '# ' + anchor,
  '',
  '> 资产: `' + asset + '` · 执行宿主: ' + cli + ' 通用宿主' + (model ? '（model `' + model + '`）' : '（沿用本机配置认证）'),
  '',
  content,
  '',
].join('\n');
await fs.writeFile(planPath, plan, 'utf8');

const hasAnchor = content.toLowerCase().includes(String(anchor).toLowerCase()) || anchor.toLowerCase().includes('unknown');
const kernelHit = kernelTokens.length ? kernelTokens.some((k) => content.toLowerCase().includes(k)) : true;
console.log(
  '[exec-host-generic] ok cli=' + cli +
  ' asset=' + asset +
  ' anchor="' + anchor + '"' +
  ' plan=' + path.relative(process.cwd(), planPath) +
  ' task=' + task +
  ' ' + (hasAnchor ? '含锚点' : (cli + ' 输出缺锚点(assetConsumed=false 风险)')) +
  (kernelTokens.length ? (kernelHit ? ' 内核词命中' : ' 缺内核词(assetConsumed=false 风险)') : '')
);