#!/usr/bin/env node
/**
 * TT 机器可读 state 摘要读取器（IMP-1）。
 * orchestrator 收尾自动生成 artifacts/<planId>/state-summary.json（schema tt/state-summary@1），
 * 新会话用本脚本「程序化拉取断点」（完成/阻塞/契约/批判 backlog），不靠人粘贴 memory-snapshot.md。
 *
 * 用法：
 *   node scripts/summary-read.mjs --workspace <dir>          列出该 workspace 所有摘要（按时间倒序）
 *   node scripts/summary-read.mjs --workspace <dir> --latest 打印最新一个摘要全文（JSON，供恢复断点）
 *   node scripts/summary-read.mjs --workspace <dir> --all    合并全部摘要为精简清单（JSON 数组）
 *
 * T9 仅追加 — 回填报告校验模式（executor-setup 交接 schema 配套，既有功能零改动）：
 *   node scripts/summary-read.mjs --validate-handoff artifacts/<planId>/reports/<taskId>
 *     校验该目录 REPORT.md 的必填回填字段（taskId / taskVerdict / evidencePaths）；
 *     缺任一字段 FAIL（exit 1），缺字段不猜不推断；无 --workspace 交互。
 *   FIX-4 加固：键行白名单化——仅 taskId/taskVerdict/evidencePaths 三名建立字段（区分大小写，`taskid` 不算）；
 *     正文冒号行/冒号列表项（`说明: xxx`、`foo: bar`）不再误判为 key、不并入必填字段值、不劫持多行收集。
 *     三必填判定语义零变化：齐→PASS / 缺→FAIL(1) / 目录缺失→FAIL(1)。
 *
 * 零外部依赖（node: 内建）。critiqueBacklog 缺省/为 null 时尝试从本机 plans/critique-backlog-tracker.md
 * 补算；读不到 tracker（如 workspace ≠ SKILL_DIR 且本机 tracker 缺失）→ 保持 null + note，不报错。
 * C-27 透传：summary.domainDeclaredMissing（缺域声明条数）与计算出的三态状态（missing/ok/N/A 旧数据无字段）
 * 随 --all 输出透传；旧摘要无该字段 → domainDeclared 为 'N/A（旧数据无字段，不判定）'，不误伤。
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {createHash} from 'node:crypto';
import {createStore} from './lib/store.mjs';
import {projectDelegationViews} from './lib/delegation-summary.mjs';

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const SKILL_DIR = path.resolve(SCRIPT_DIR, '..');

// 批判 backlog tracker 解析（critique-backlog-next.mjs 同源语义：列对齐 + 待落地判定），内联避免 import 顶层副作用。
const BL_COLS = { '#': 'serial', '批判': 'title', '级别': 'level', '修复': 'fix', '落点': 'ctx', '验收': 'accept', '状态': 'status' };
const BL_PENDING_RE = /^[⬜◐]|(?:待落地|待复验|待[\u4e00-\u9fa5]*)/;
function parseBacklogRows(text) {
  const blocks = [];
  let block = null;
  const flush = function() { if (block) { blocks.push(block); block = null; } };
  for (const raw of String(text || '').replace(/\r\n/g, '\n').split('\n')) {
    const t = raw.trim();
    if (/^\|\s*#/.test(t) && (t.includes('批判') || t.includes('落点'))) {
      flush();
      const cells = t.split('|').map(function(c) { return c.trim(); });
      const col = {};
      for (let i = 0; i < cells.length; i += 1) {
        for (const [name, key] of Object.entries(BL_COLS)) {
          if (cells[i] === name || (name !== '#' && name !== '状态' && cells[i].includes(name))) { if (!(key in col)) col[key] = i; }
          else if (cells[i].includes('状态')) col.status = i;
        }
      }
      block = { col, rows: [] };
      continue;
    }
    if (block && /^\|/.test(t) && !/^\|[\s:-]+\|$/.test(t)) {
      const cells = t.split('|').map(function(c) { return c.trim(); });
      const get = function(k) { return cells[block.col[k]]; };
      const serialRaw = get('serial') ?? cells[0];
      const m = String(serialRaw || '').match(/C-(\d+)/);
      if (m) block.rows.push({
        serial: 'C-' + String(parseInt(m[1], 10)).padStart(2, '0'),
        title: (get('title') ?? '').replace(/（来源：.+?）/, '').trim(),
        fix: (get('fix') ?? '').trim(),
        status: (get('status') ?? '').trim(),
        raw: t,
      });
      continue;
    }
    if (/^#/.test(t) && !/^\|/.test(t)) flush();
  }
  flush();
  const out = [];
  for (const b of blocks) out.push(...b.rows);
  return out;
}
function backlogIsPending(r) {
  if (!r.status) return BL_PENDING_RE.test(r.raw);
  if (/^✅/.test(r.status) || /^❌/.test(r.status)) return false;
  if (/^[⬜◐]/.test(r.status)) return true;
  return BL_PENDING_RE.test(r.status);
}
function readCritiqueBacklog() {
  try {
    const text = fs.readFileSync(path.join(SKILL_DIR, 'plans', 'critique-backlog-tracker.md'), 'utf8');
    const pending = parseBacklogRows(text).filter(backlogIsPending);
    return { open: pending.length, nextItems: pending.map(function(r) { return r.serial + ' ' + String(r.fix || r.title || '').replace(/\s+/g, ' ').trim(); }) };
  } catch (error) { return null; }
}
/** 摘要自包含优先；critiqueBacklog 为 null 时才尝试用本机 tracker 补算（workspace ≠ SKILL_DIR 且读不到 → 保持 null + note）。 */
function ensureBacklog(data) {
  if (data && (data.critiqueBacklog === null || typeof data.critiqueBacklog === 'undefined')) {
    const b = readCritiqueBacklog();
    if (b) { data.critiqueBacklog = b; delete data.critiqueBacklogNote; }
    else if (!data.critiqueBacklogNote) data.critiqueBacklogNote = 'critique backlog tracker 不可读（plans/critique-backlog-tracker.md 缺失），critiqueBacklog 置 null';
  }
  return data;
}
function parseArgs(args) {
  const out = { workspace: '.', latest: false, all: false, help: false, validateHandoff: null, delegation:false, session:null, unknown:[] };
  for (let i = 0; i < args.length; i += 1) {
    const a = args[i];
    if (a === '--workspace') { const v = args[i + 1]; if (v !== undefined && !v.startsWith('--')) { out.workspace = v; i += 1; } else out.help = true; }
    else if (a === '--latest') out.latest = true;
    else if (a === '--all') out.all = true;
    else if (a === '--delegation') out.delegation = true;
    else if (a === '--session') {const v=args[i+1];if(v!==undefined&&!v.startsWith('--')){out.session=v;i++;}else out.help=true;}
    else if (a === '--validate-handoff') { const v = args[i + 1]; if (v !== undefined && !v.startsWith('--')) { out.validateHandoff = v; i += 1; } else out.help = true; }
    else if (a === '--help' || a === '-h') out.help = true;
    else out.unknown.push(a);
  }
  return out;
}

// ---------------------------------------------------------------------------
// T9 仅追加：回填报告校验（executor-setup 交接 schema tt/handoff-brief@1 配套）。
// 必填字段 taskId / taskVerdict / evidencePaths；缺任一 FAIL（exit 1），缺字段不猜不推断。
// 解析约定（与 executor-setup.mjs 生成骨架同构）：
//   - 键行：行首（允许 "- "/列表/加粗前缀）ASCII 标识符 + 半/全角冒号 + 值
//   - evidencePaths：单行逗号/空白分隔，或空值后跟缩进 "- " 列表直到下一个键行
// FIX-4 加固（正文冒号列表项不再干扰三必填判定，语义零变化）：
//   - 字段键白名单化：仅 HANDOFF_REQUIRED_FIELDS 三名建立字段（区分大小写，`taskid:` 不算 taskId）；
//     其余冒号行（`说明: xxx`、`foo: bar`）不建立字段——不再把收集区抢走，也不触发必填键行的
//     "重复键跳过"分支。根因：原解析对任意键建字段，`说明:` 会把 taskId 收集区占位为
//     `说明`，随后真正的 `taskId:` 被当重复键整行丢弃 → 误判缺字段。
//   - 多行收集严格限列表项：空值必填字段后仅接收 `- ` / `* ` 列表行；空行不打断，
//     非列表行（`## 标题`、`foo: bar` 正文、普通句子）一律打断收集且绝不并入字段值。
//     （原实现对收集区内任意非空行盲目并入，`## 标题`/正文句会污染 evidencePaths。）
// 既有功能零改动：validateHandoff 分支在 main 最早返回，不触碰 collectSummaries 以下任何路径。
// ---------------------------------------------------------------------------

const HANDOFF_REQUIRED_FIELDS = Object.freeze(['taskId', 'taskVerdict', 'evidencePaths']);
const HANDOFF_KEY_RE = /^\s*(?:[-*]\s*)?(?:\*\*)?([A-Za-z][A-Za-z0-9_-]*)(?:\*\*)?\s*[:：]\s*(.*)$/;

/** 解析回填报告为 {字段: 字符串值}。键行白名单（三必填，区分大小写）；空值字段支持多行 - 列表（实践即 evidencePaths）。 */
function parseHandoffReport(text) {
  const fields = {};
  const lines = String(text || '').replace(/\r\n/g, '\n').split('\n');
  let collecting = null; // 正在收集多行值的必填字段名（值为空的必填字段可续列表项）
  for (const line of lines) {
    const m = line.match(HANDOFF_KEY_RE);
    if (m) {
      const isRequired = HANDOFF_REQUIRED_FIELDS.includes(m[1]);
      if (!isRequired) continue; // 白名单外冒号行（正文键样行）：不建立字段、不打断 evidencePaths 收集
      collecting = m[1];
      if (!fields[collecting]) fields[collecting] = m[2].trim();
      else if (m[2].trim()) fields[collecting] += ',' + m[2].trim(); // 白名单内重复键行：追加（保持宽容原语义）
      continue;
    }
    if (collecting && fields[collecting] !== undefined) {
      if (line.trim() === '') continue; // 空行不打断列表收集
      if (!/^\s*(?:[-*]\s+)/.test(line)) { collecting = null; continue; } // 标题/正文行打断收集，绝不并入字段值
      const item = line.trim().replace(/^[-*]\s*/, '').trim();
      if (item) fields[collecting] += (fields[collecting] ? ',' : '') + item;
    }
  }
  return fields;
}

/** 校验回填报告。返回 {ok, missing, empty, fields}；不猜：缺字段原样列出，不推断。 */
function validateHandoffReport(dir) {
  const reportPath = path.join(path.resolve(dir), 'REPORT.md');
  let text;
  try { text = fs.readFileSync(reportPath, 'utf8'); }
  catch (e) {
    return { ok: false, missing: HANDOFF_REQUIRED_FIELDS, empty: [], fields: {}, fatal: 'REPORT.md 不可读: ' + reportPath + '（' + e.code + '）' };
  }
  const fields = parseHandoffReport(text);
  const missing = HANDOFF_REQUIRED_FIELDS.filter((k) => !(k in fields));
  const empty = HANDOFF_REQUIRED_FIELDS.filter((k) => (k in fields) && !String(fields[k]).trim());
  return { ok: missing.length === 0 && empty.length === 0, missing, empty, fields, reportPath };
}
/** 扫描 workspace/artifacts/<planId>/state-summary.json，按 mtime 倒序。解析失败跳过（stderr 提示，不中断）。 */
function collectSummaries(workspace) {
  const out = [];
  const artifacts = path.join(workspace, 'artifacts');
  let entries;
  try { entries = fs.readdirSync(artifacts, { withFileTypes: true }); } catch (error) { return out; }
  for (const e of entries) {
    if (!e.isDirectory()) continue;
    const file = path.join(artifacts, e.name, 'state-summary.json');
    let text = null;
    try { text = fs.readFileSync(file, 'utf8'); } catch (error) { continue; }
    let data = null;
    try { data = JSON.parse(text); } catch (error) { process.stderr.write('WARN 摘要解析失败（跳过）: ' + file + '\n'); continue; }
    out.push({ file, rel: path.relative(workspace, file).split(path.sep).join('/'), mtimeMs: fs.statSync(file).mtimeMs, data });
  }
  out.sort(function(a, b) { return b.mtimeMs - a.mtimeMs; });
  return out;
}
/** C-27 域声明三态（由 summary.domainDeclaredMissing 计算）：>0=missing；=0=ok；字段缺失（旧摘要）=N/A 不判定。 */
function domainDeclaredStatus(sm) {
  const n = sm.domainDeclaredMissing;
  if (typeof n !== 'number') return 'N/A（旧数据无字段，不判定）';
  return n > 0 ? 'missing(' + n + ')' : 'ok';
}
function blockOf(data) {
  const blocked = Array.isArray(data.summary && data.summary.blockedSubtasks) ? data.summary.blockedSubtasks : [];
  return blocked.length ? blocked.join(',') : '无';
}
function listRow(it) {
  const d = it.data;
  const sm = d.summary || {};
  return [
    d.planId || '?',
    '|', d.task || '?',
    '|', d.status || '?', d.degraded === true ? '(degraded)' : '',
    '|', sm.assetCallRate || '?',
    '|', 'domainDeclared:', domainDeclaredStatus(sm),
    '|', 'blocked:', blockOf(d),
    '|', it.rel,
  ].filter(function(s) { return s !== ''; }).join(' ');
}
function latestOf(its) {
  return its.length ? its[0] : null;
}
function usage() {
  console.log('用法: node scripts/summary-read.mjs --workspace <dir> [--latest|--all]');
  console.log('  --workspace <dir>  产物目录（含 artifacts/<planId>/state-summary.json）');
  console.log('  --latest           打印最新一个摘要全文（JSON，供新会话恢复断点）');
  console.log('  --all              合并所有摘要为精简清单（JSON 数组）');
  console.log('  --validate-handoff <dir>  校验 <dir>/REPORT.md 回填必填字段（T9 追加；缺字段 FAIL exit 1）');
  console.log('  --delegation [--session <id>]  从当前 Store 只读投影人工交接 TaskView（单 JSON envelope）');
  console.log('  默认: 列出该 workspace 所有摘要（按时间倒序），一行一项');
}
/** T9 仅追加：--validate-handoff 入口。返回进程退出码，不触碰既有摘要读取路径。 */
function runValidateHandoff(dir) {
  const r = validateHandoffReport(dir);
  if (r.fatal) {
    process.stderr.write('FAIL ' + r.fatal + '（缺字段不猜：目录/文件不存在即 FAIL，不推断）\n');
    return 1;
  }
  const problems = r.missing.map((k) => '缺字段: ' + k).concat(r.empty.map((k) => '字段存在但值为空: ' + k));
  if (problems.length) {
    process.stderr.write('FAIL 回填报告校验未通过: ' + r.reportPath + '\n  ' + problems.join('\n  ') + '\n  缺字段不猜——请按 executor-setup 交接 schema 补齐 taskId/taskVerdict/evidencePaths 后重跑。\n');
    return 1;
  }
  console.log('PASS 回填报告校验通过: ' + r.reportPath);
  console.log(JSON.stringify({ taskId: r.fields.taskId, taskVerdict: r.fields.taskVerdict, evidencePaths: r.fields.evidencePaths }, null, 2));
  return 0;
}
/** Pure read producer for host injection; no refresh, transition or acceptance. */
export async function readDelegationSummary(workspace,session=null) {
 try {
  if(session!==null&&!/^[A-Za-z0-9_-]+$/.test(session))throw Object.assign(new Error('session invalid'),{code:'INPUT_INVALID'});
  const root=path.resolve(workspace),control=path.join(root,'.tt-state'),file=path.join(control,session||'','state.json');
  for(const entry of [control,...(session?[path.dirname(file)]:[]),file]){try{if(fs.lstatSync(entry).isSymbolicLink())throw Object.assign(new Error('state link refused'),{code:'SOURCE_NOT_AUTHORIZED'});}catch(error){if(error.code!=='ENOENT')throw error;}}
  let plan;
  if(session){try{plan=JSON.parse(await fs.promises.readFile(file,'utf8'));}catch(error){if(error.code!=='ENOENT')throw error;plan=null;}}
  else plan=await createStore(root).load();
  if(plan?.stateVersion!=null&&plan.stateVersion!==1)throw Object.assign(new Error('STATE_VERSION_UNSUPPORTED'),{code:'STATE_VERSION_UNSUPPORTED'});
  const observedAt=new Date().toISOString(),identityRef='state:'+createHash('sha256').update(JSON.stringify(plan)).digest('hex');
  const tasks=projectDelegationViews(plan,{observedAt,identityRef});
  return {ok:true,code:null,data:{tasks},evidence:{identity_ref:identityRef,observed_at:observedAt},warnings:[]};
 } catch(error){return {ok:false,code:error.code||'INPUT_INVALID',data:{tasks:[],reason:/^(?:PROJECTION_STATE_INVALID|DELEGATION_CONTRACT_INVALID|STATE_VERSION_UNSUPPORTED)/.test(error.message)?error.message:'人工交接视图读取失败'},evidence:{},warnings:[]};}
}
export function main(args = process.argv.slice(2)) {
  const opts = parseArgs(args);
  if(opts.delegation){
    if(opts.help||opts.latest||opts.all||opts.validateHandoff||opts.unknown.length){console.log(JSON.stringify({ok:false,code:'INPUT_INVALID',data:{tasks:[],reason:'delegation 仅接受 workspace/session 只读参数'},evidence:{},warnings:[]}));return 1;}
    return readDelegationSummary(opts.workspace,opts.session).then(result=>{console.log(JSON.stringify(result));return result.ok?0:1;});
  }
  if (opts.help) { usage(); return 0; }
  if (opts.validateHandoff) return runValidateHandoff(opts.validateHandoff); // T9 仅追加分支
  const workspace = path.resolve(opts.workspace);
  const its = collectSummaries(workspace);
  if (opts.latest) {
    const l = latestOf(its);
    if (!l) { process.stderr.write('无 state-summary.json（workspace=' + workspace + '）——先跑 orchestrator 执行后再读断点\n'); return 1; }
    console.log(JSON.stringify(ensureBacklog(l.data), null, 2));
    return 0;
  }
  if (opts.all) {
    const merged = its.map(function(it) {
      const d = ensureBacklog(it.data);
      const sm = d.summary || {};
      return {
        planId: d.planId,
        task: d.task,
        cluster: d.cluster,
        status: d.status,
        degraded: d.degraded === true,
        generatedAt: d.generatedAt,
        modes: d.modes || {},
        total: sm.total,
        done: sm.done,
        failed: sm.failed,
        skipped: sm.skipped,
        assetConsumed: sm.assetConsumed,
        assetCallRate: sm.assetCallRate,
        requireExecViolation: sm.requireExecViolation,
        depPrecondition: sm.depPrecondition,
        domainDeclaredMissing: sm.domainDeclaredMissing,
        domainDeclared: domainDeclaredStatus(sm),
        blockedSubtasks: sm.blockedSubtasks || [],
        contractFrozen: sm.contractFrozen,
        recovery: sm.recovery || [],
        critiqueBacklogOpen: d.critiqueBacklog ? d.critiqueBacklog.open : null,
      };
    });
    console.log(JSON.stringify(merged, null, 2));
    return 0;
  }
  if (!its.length) {
    console.log('无 state-summary.json（workspace=' + workspace + '）');
    return 0;
  }
  console.log('state-summary 清单（时间倒序，共 ' + its.length + ' 个）：');
  for (const it of its) console.log(listRow(it));
  return 0;
}
process.exitCode = await main();
