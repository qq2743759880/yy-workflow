#!/usr/bin/env node
/**
 * F1 asset-call-rate — 资产调用率统计 + 阈值触发自动动作（MUSE SkillRefiner 模式融合）。
 * 跑 orchestrator 任务后读 state.json，统计每资产路由/正文/消费证据调用率，
 * 低于阈值（50% 消费率）的资产触发三级自动动作：
 *   ① 低调用率自动标记 → .tt-state/auto-actions.json（资产/调用率/动作建议/触发时间）
 *   ② 建议降级：auto-actions.json 历史跨 ≥2 次触发 → 「建议降级为 optional」（不自动改 SKILL，留人审）
 *   ③ 自动登记：--apply 时登记进 plans/critique-backlog-tracker.md（新 C-xx 行，来源标注 asset-call-rate，
 *      幂等按 资产名+触发日期 查重；缺省 dry-run 只打印待登记）
 * C-27 域声明机验（FR-5 GWT）：增读 state.json subtasks 的 domainDeclared 字段——
 *   false → 报告头部 `- domainDeclared: N missing` + 每条 `DOMAIN_DECL_MISSING` warning（含 subtask id/asset 名）；
 *   true → `- domainDeclared: ok`；全部条目无该字段（旧数据）→ `- domainDeclared: N/A（旧数据无字段，不判定）`。
 *   仅增报告行，不改 exit code 语义（exit 1 = 有需审查资产，维持不变）。
 * 用法：node scripts/asset-call-rate.mjs --state <state.json> | --task <任务文本> [--apply]
 */
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { execFileSync } from 'node:child_process';

const ROOT = path.resolve(import.meta.dirname, '..');
const TRACKER = path.join(ROOT, 'plans', 'critique-backlog-tracker.md');
const ACTIONS_NAME = 'auto-actions.json';

function today() { return new Date().toISOString().slice(0, 10); }

function loadActions(file) {
  try {
    if (!fs.existsSync(file)) return null;
    const data = JSON.parse(fs.readFileSync(file, 'utf8'));
    if (!data || !Array.isArray(data.actions)) return null;
    return data;
  } catch { return null; }
}

function saveActions(file, data) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(data, null, 2));
}

/** 三级动作②：按 auto-actions.json 历史累计触发次数，≥2 次升级为「建议降级为 optional」。 */
function buildActions(flagged, existing, apply) {
  const prev = new Map();
  if (existing) for (const a of existing.actions) prev.set(a.asset, a);
  return flagged.map((f) => {
    const p = prev.get(f.asset);
    const triggers = (p && p.triggers ? p.triggers : 0) + 1;
    const escalated = triggers >= 2;
    return {
      asset: f.asset,
      consumptionRate: f.rate,
      lastTriggerDate: f.date,
      triggers,
      escalated,
      suggestion: escalated ? '建议降级为 optional' : '建议重建（消费链审查）',
      applied: apply,
      registered: apply ? true : (p ? !!p.registered : false),
    };
  });
}

/** ③ tracker 登记（幂等：资产名+触发日期 查重）。apply 才写文件，dry-run 只返回待登记行。 */
function registerTracker(actions, apply, date) {
  let content = '';
  if (fs.existsSync(TRACKER)) content = fs.readFileSync(TRACKER, 'utf8');
  else content = '# critique-backlog-tracker（批判滞后任务闭环）\n\n';
  const title = '## asset-call-rate 监控登记（MUSE 自进化）';
  const header = '| # | 来源（asset-call-rate · 资产 · 日期） | 资产 | 调用率 | 动作建议 | 触发日期 | 状态 |';
  const sep = '|---|---|---|---|---|---|---|';
  let no = 0;
  const re = /\| C-(\d+) \|/g;
  let m;
  while ((m = re.exec(content))) { const n = Number(m[1]); if (n > no) no = n; }
  no += 1;
  const rows = [];
  for (const a of actions) {
    const marker = 'asset-call-rate · ' + a.asset + ' · ' + date;
    if (content.includes(marker)) continue;
    rows.push({ no: no, asset: a.asset, rate: a.consumptionRate, suggestion: a.suggestion, marker });
    no += 1;
  }
  if (!rows.length) return { apply, changed: false, rows, content: null };
  if (!apply) return { apply, changed: false, rows, content: null };
  if (!content.includes(title)) {
    if (!content.endsWith('\n')) content += '\n';
    content += '\n' + title + '\n' + header + '\n' + sep + '\n';
  }
  for (const r of rows) content += '| C-' + r.no + ' | ' + r.marker + ' | ' + r.asset + ' | ' + r.rate + '% | ' + r.suggestion + ' | ' + date + ' | ⬜ |\n';
  return { apply, changed: true, rows, content };
}

function buildAutoActionLines(actions, tracker, apply, date) {
  const lines = ['', '## 自动动作清单（阈值触发 · 消费率 < ' + '50%）'];
  if (!actions.length) { lines.push('无低调用率资产触发（全部达标）。'); return lines; }
  lines.push('| 资产 | 消费率 | 动作建议 | 连续触发 | 触发日期 | tracker |');
  lines.push('|---|---|---|---|---|---|');
  const byAsset = new Map();
  for (const r of tracker.rows) byAsset.set(r.asset, 'C-' + r.no);
  for (const a of actions) {
    const status = apply
      ? (byAsset.has(a.asset) ? '✅ 已登记 ' + byAsset.get(a.asset) : '✅ 已登记（历史行）')
      : '⬜ 待登记（--apply 生效）';
    lines.push('| ' + a.asset + ' | ' + a.consumptionRate + '% | ' + a.suggestion + ' | ' + a.triggers + ' | ' + date + ' | ' + status + ' |');
  }
  lines.push(apply
    ? '（--apply：auto-actions.json 已写回 + tracker 已登记）'
    : '（缺省 dry-run：auto-actions.json 已生成（作触发历史），tracker 仅打印待登记）');
  return lines;
}

function main() {
  const args = process.argv.slice(2);
  const si = args.indexOf('--state');
  let statePath = si !== -1 ? args[si + 1] : null;
  const ti = args.indexOf('--task');
  const taskText = ti !== -1 ? args[ti + 1] : null;
  const apply = args.includes('--apply');
  if (!statePath && !taskText) { console.error('用法: --state <state.json> 或 --task <任务文本> [--apply]'); return 2; }

  let workspace = null;
  if (taskText && !statePath) {
    workspace = path.join(os.tmpdir(), 'tt-rate-' + Date.now());
    execFileSync(process.execPath, ['scripts/orchestrator.mjs', '--task', taskText, '--workspace', workspace], { cwd: ROOT, stdio: 'pipe', timeout: 120000 });
    statePath = path.join(workspace, '.tt-state', 'state.json');
  } else if (statePath) {
    workspace = path.dirname(path.dirname(statePath));
  }
  if (!fs.existsSync(statePath)) { console.error('state.json 不存在: ' + statePath); return 2; }

  const state = JSON.parse(fs.readFileSync(statePath, 'utf8'));
  const subs = state.subtasks || [];
  const total = subs.length;
  // C-27 域声明机验三态：domainDeclared===false 计缺失（检出 100%）；字段不存在（旧数据）不误伤 → N/A；true → ok。
  const declMissing = subs.filter(function (s) { return s.domainDeclared === false; });
  const declKnown = subs.filter(function (s) { return s.domainDeclared === true || s.domainDeclared === false; });
  const domainLine = declMissing.length
    ? '- domainDeclared: ' + declMissing.length + ' missing'
    : (declKnown.length ? '- domainDeclared: ok' : '- domainDeclared: N/A（旧数据无字段，不判定）');
  const domainWarnLines = declMissing.map(function (s) {
    return '  ⚠ DOMAIN_DECL_MISSING [' + s.id + '/' + (s.asset || '-') + '] warning——subtask 未做域声明（domainDeclared=false）';
  });
  let routed = 0, briefBody = 0, consumed = 0;
  const rows = [];
  for (const s of subs) {
    const brief = path.join(workspace, 'artifacts', s.id, 'brief.md');
    const hasBody = fs.existsSync(brief) && fs.readFileSync(brief, 'utf8').includes('方法论正文');
    if (s.asset) routed++;
    if (hasBody) briefBody++;
    if (s.assetConsumed === true) consumed++;
    rows.push({ asset: s.asset, mode: s.mode, routed: !!s.asset, briefBody: hasBody, consumed: s.assetConsumed === true });
  }
  const rate = (n) => total > 0 ? (n / total * 100).toFixed(1) + '%' : '0%';
  const lines = ['# asset-call-rate report', domainLine].concat(domainWarnLines, ['', '- plan: ' + state.id + ' · cluster: ' + state.cluster + ' · subtasks: ' + total, '- 路由率: ' + rate(routed) + ' | 正文进上下文: ' + rate(briefBody) + ' | 消费证据: ' + rate(consumed), '', '## 逐资产']);
  const needReview = [];
  for (const r of rows) {
    const callRate = ((r.routed ? 1 : 0) + (r.briefBody ? 1 : 0) + (r.consumed ? 1 : 0) / 3 * 100).toFixed(0);
    const st = r.consumed ? '✓' : (r.mode === 'planned-only' || r.mode === 'skipped' ? '⚠' : '✗');
    lines.push('  ' + st + ' ' + r.asset + ': mode=' + r.mode + ' routed=' + r.routed + ' brief=' + r.briefBody + ' consumed=' + r.consumed + ' (' + callRate + '%)');
    if (!r.consumed && r.mode !== 'skipped') needReview.push({ asset: r.asset, rate: r.consumed ? 100 : 0 });
  }
  if (needReview.length) { lines.push('', '## 需审查（消费率 < 50%）: ' + needReview.map(function (r) { return r.asset; }).join(', ')); lines.push('  → 建议登记 tracker 审查/替换'); }
  else lines.push('', '## 全部资产消费证据达标（无需审查）');

  // 阈值触发自动动作（三级：标记 / 建议降级 / 登记）
  const date = today();
  const actionsFile = path.join(workspace, '.tt-state', ACTIONS_NAME);
  const existing = loadActions(actionsFile);
  const flagged = needReview.map(function (r) { return { asset: r.asset, rate: r.rate, date }; });
  const actions = buildActions(flagged, existing, apply);
  const tracker = registerTracker(actions, apply, date);
  if (tracker.changed) { fs.writeFileSync(TRACKER, tracker.content); }

  const autoLines = buildAutoActionLines(actions, tracker, apply, date);
  const report = lines.concat(autoLines).join('\n');
  console.log(report);

  if (actions.length) {
    const payload = { schema: 'asset-call-rate/auto-actions@1', updatedAt: new Date().toISOString(), lastRun: { plan: state.id, cluster: state.cluster, subtasks: total, apply, at: new Date().toISOString() }, actions };
    try { saveActions(actionsFile, payload); } catch (e) { /* 只读 workspace 忽略 */ }
  }

  const reportPath = path.join(workspace, 'artifacts', 'asset-call-rate-report.md');
  try { fs.mkdirSync(path.dirname(reportPath), { recursive: true }); fs.writeFileSync(reportPath, report); } catch (e) { /* 只读 workspace 忽略 */ }
  return needReview.length ? 1 : 0;
}

process.exitCode = main();
