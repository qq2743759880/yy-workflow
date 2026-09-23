#!/usr/bin/env node
/**
 * SB-1（execution-plan-v3 §四/§五）：阶段盲测队列 + 状态机 + 看板。
 *
 * 队列文件：<workspace>/.tt-state/stage-N-blindqueue.md（markdown 表，六列 schema）。
 * 字段：| qid | 来源task | 覆盖功能点 | 验证方法(步骤+期望) | hidden | 状态 |
 * 状态机（fail-closed）：pending → built → hidden → passed|failed|waived。
 *   - waived 限 CONCERNS 级：队列存在 failed 条目（FAIL 口径）时拒绝 waiver 逃生；waive 必须留痕理由（--reason 必填，落「决策与留痕」段）。
 *   - 终态（passed/failed/waived）不可再回填。
 *   - 冻结（--freeze）后 --fill 一律拒绝（防篡改盲测包）；freeze 要求全部条目已 built，冻结时全部置 hidden。
 * hidden 保密：hidden=true 条目的「覆盖功能点/验证方法」在 --view --blind 导出视图中以 — 掩蔽；
 *   完整视图（编排者/验收者）不受限。同文件全量落盘，保密是导出 API 纪律级过滤而非进程硬隔离。
 * CLI：
 *   node scripts/blindqueue.mjs --init <stage>            （或 --init --stage <stage-N>）
 *   node scripts/blindqueue.mjs --fill <qid> --stage <stage-N> --source-task <t> --feature <f> --verification <v>
 *                                         [--hidden] [--status ...] [--decision PASS|FAIL|WAIVED] [--reason <r>]
 *   node scripts/blindqueue.mjs --freeze <stage>
 *   node scripts/blindqueue.mjs --view <stage> [--blind]
 *   node scripts/blindqueue.mjs --board <stage>
 *   node scripts/blindqueue.mjs --protocol                （角色切换流程文档，无需 --stage）
 *   node scripts/blindqueue.mjs --self-test
 * 退出码：0 成功 / 1 self-test 失败 / 2 用法或运行错误（fail-closed）。
 * 纪律：本批不改 tt-journey.mjs（RG-1 并行占用写面）；挂点由编排者批 2 收口统一接线。
 */
import fs from 'node:fs';
import fsPromises from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';

const SCHEMA = 'yy/blindqueue@1';
const VALID_STATUSES = ['pending', 'built', 'hidden', 'passed', 'failed', 'waived'];
const FINAL_STATUSES = new Set(['passed', 'failed', 'waived']);
/* 状态机唯一事实源：pending→built→hidden→{passed,failed,waived}。同态幂等由 fill 逻辑另行处理。 */
const TRANSITIONS = {
  pending: new Set(['built']),
  built: new Set(['hidden']),
  hidden: new Set(['passed', 'failed', 'waived']),
};
const STAGE_RE = /^stage-\d+$/;
const QUEUE_HEADERS = ['qid', '来源task', '覆盖功能点', '验证方法(步骤+期望)', 'hidden', '状态'];
const LEDGER_HEADERS = ['qid', '裁决', '理由', '时间'];
const EMPTY = '—';

function nowIso() {
  return new Date().toISOString();
}

function normalizeStage(stage) {
  if (typeof stage !== 'string' || !stage.trim()) throw new Error('需要 stage（--init/--freeze/--view/--board <stage> 或 --stage <stage-N>）');
  const value = stage.trim();
  const normalized = /^\d+$/.test(value) ? `stage-${value}` : value;
  if (!STAGE_RE.test(normalized)) throw new Error('--stage 必须是 stage-N，N 为非负整数');
  return normalized;
}

function workspaceRoot(workspace) {
  return path.resolve(workspace || process.cwd());
}

function queueFile(workspace, stage) {
  return path.join(workspaceRoot(workspace), '.tt-state', `${normalizeStage(stage)}-blindqueue.md`);
}

function blankQueue(stage) {
  const normalized = normalizeStage(stage);
  return {
    schema: SCHEMA,
    stage: normalized,
    createdAt: nowIso(),
    updatedAt: nowIso(),
    frozen: false,
    entries: [],
    decisions: [],
  };
}

function escapeCell(value) {
  return String(value ?? '')
    .replace(/\\/g, '\\\\')
    .replace(/\|/g, '\\|')
    .replace(/\r?\n/g, '<br>');
}

function unescapeCell(value) {
  return String(value ?? '').replace(/\\\|/g, '|');
}

function splitMarkdownRow(line) {
  const trimmed = line.trim();
  if (!trimmed.startsWith('|') || !trimmed.endsWith('|')) return [];
  const body = trimmed.slice(1, -1);
  const cells = [];
  let current = '';
  let escaped = false;
  for (const char of body) {
    if (escaped) {
      current += char;
      escaped = false;
    } else if (char === '\\') {
      escaped = true;
    } else if (char === '|') {
      cells.push(current);
      current = '';
    } else {
      current += char;
    }
  }
  if (escaped) current += '\\';
  cells.push(current);
  return cells.map((cell) => unescapeCell(cell.trim()));
}

function normalizeStageFromText(text) {
  /* 头部字段块为空行分隔的逐行元数据（- schema / - stage / - frozen / ...）；
   * 旧正则 `\s*\n\s*` 因 \s 吞换行，匹配不到「- schema」行后的「- stage」行，
   * 一律回落 stage-1 → 冻结/回填把多 stage 队列文件的 stage 行覆写为 stage-1（已修：惰性跨行到首个 - stage:）。 */
  const match = text.match(/^# 阶段盲测队列\n[\s\S]*?\n- stage: ([^\n]+)/m);
  return match ? normalizeStage(match[1]) : 'stage-1';
}

function validateEntry(entry) {
  if (!entry || typeof entry.qid !== 'string' || !entry.qid.trim()) throw new Error('qid 必须是非空字符串');
  if (!VALID_STATUSES.includes(entry.status)) throw new Error(`未知状态: ${entry.status}`);
  if (typeof entry.hidden !== 'boolean') throw new Error(`hidden 必须是布尔值: ${entry.hidden}`);
}

function validateQueue(queue) {
  if (!queue || queue.schema !== SCHEMA) throw new Error('队列 schema 不匹配');
  const stage = normalizeStage(queue.stage);
  const seen = new Set();
  for (const entry of queue.entries) {
    validateEntry(entry);
    if (seen.has(entry.qid)) throw new Error(`重复 qid: ${entry.qid}`);
    seen.add(entry.qid);
  }
  return { ...queue, stage, entries: queue.entries.map((entry) => ({ ...entry })), decisions: queue.decisions.map((decision) => ({ ...decision })) };
}

function findEntry(queue, qid) {
  const entry = queue.entries.find((item) => item.qid === qid);
  if (!entry) throw new Error(`未知 qid: ${qid}`);
  return entry;
}

function canTransition(from, to) {
  return from === to || Boolean(TRANSITIONS[from]?.has(to));
}

function defaultDecision(status) {
  return status === 'passed' ? 'PASS' : status === 'failed' ? 'FAIL' : status === 'waived' ? 'WAIVED' : null;
}

function renderCell(value) {
  return escapeCell(value ?? '');
}

function renderTable(headers, rows) {
  const lines = [
    `| ${headers.map(renderCell).join(' | ')} |`,
    `| ${headers.map(() => '---').join(' | ')} |`,
  ];
  for (const row of rows) lines.push(`| ${row.map(renderCell).join(' | ')} |`);
  return lines.join('\n');
}

function renderLedger(decisions) {
  const rows = decisions.map((decision) => [decision.qid, decision.decision, decision.reason || '', decision.timestamp || '']);
  return ['## 决策与留痕', '', renderTable(LEDGER_HEADERS, rows), ''].join('\n');
}

function renderQueueFile(queue) {
  const rows = queue.entries.map((entry) => [entry.qid, entry.sourceTask, entry.feature, entry.verification, String(entry.hidden), entry.status]);
  const lines = [
    '# 阶段盲测队列',
    '',
    `- schema: ${SCHEMA}`,
    `- stage: ${queue.stage}`,
    `- frozen: ${String(Boolean(queue.frozen))}`,
    `- created_at: ${queue.createdAt}`,
    `- updated_at: ${queue.updatedAt}`,
    '',
    '## 盲测条目',
    '',
    renderTable(QUEUE_HEADERS, rows),
    '',
  ];
  if (queue.decisions.length) lines.push(renderLedger(queue.decisions));
  return `${lines.join('\n')}\n`;
}

function renderFullView(queue) {
  const rows = queue.entries.map((entry) => [entry.qid, entry.sourceTask, entry.feature, entry.verification, String(entry.hidden), entry.status]);
  const lines = [
    `# 完整盲测视图：${queue.stage}${queue.frozen ? '（已冻结）' : ''}`,
    '',
    renderTable(QUEUE_HEADERS, rows),
  ];
  if (queue.decisions.length) lines.push('', renderLedger(queue.decisions));
  return `${lines.join('\n')}\n`;
}

/** blind 导出视图（--view --blind）：hidden=true 条目「覆盖功能点/验证方法」以 — 掩蔽（防盲测用例泄露）；
 *  hidden=false 条目细节照常可见（dispatch：blind 视图=不含 hidden 细节，非全表抹除）。 */
function renderBlindView(queue) {
  const rows = queue.entries.map((entry) => {
    const masked = entry.hidden;
    return [entry.qid, entry.sourceTask, masked ? EMPTY : entry.feature, masked ? EMPTY : entry.verification, String(entry.hidden), entry.status];
  });
  const lines = [
    `# 盲测包视图（blind，hidden 细节掩蔽）：${queue.stage}`,
    '',
    renderTable(QUEUE_HEADERS, rows),
  ];
  return `${lines.join('\n')}\n`;
}

function renderBoard(queue) {
  const stage = normalizeStage(queue.stage);
  const total = queue.entries.length;
  const builtOrLater = queue.entries.filter((entry) => entry.status !== 'pending').length;
  const hidden = queue.entries.filter((entry) => entry.hidden);
  const blindPassed = hidden.filter((entry) => entry.status === 'passed').length;
  const failed = queue.entries.filter((entry) => entry.status === 'failed');
  const waived = queue.entries.filter((entry) => entry.status === 'waived');
  const failTasks = [...new Set(failed.map((entry) => entry.sourceTask).filter(Boolean))];
  /* BMAD TEA 四态裁决：FAIL（有 failed）＞ WAIVED（有 waived）＞ CONCERNS（有未收口条目）＞ PASS（全绿）。
   * 空队列无证据 → 「—」且阻塞（fail-closed：无证据不解锁）。只有 PASS 不阻塞下游（全绿解锁）。 */
  let decision;
  let blocked;
  if (total === 0) { decision = EMPTY; blocked = true; }
  else if (failed.length) { decision = 'FAIL'; blocked = true; }
  else if (waived.length) { decision = 'WAIVED'; blocked = true; }
  else if (queue.entries.some((entry) => entry.status !== 'passed')) { decision = 'CONCERNS'; blocked = true; }
  else { decision = 'PASS'; blocked = false; }
  const builtRate = total ? `${(builtOrLater / total * 100).toFixed(1)}%` : '0.0%';
  const blindPassRate = hidden.length ? `${(blindPassed / hidden.length * 100).toFixed(1)}%` : '0.0%';
  const rows = [[
    stage,
    String(total),
    builtRate,
    blindPassRate,
    failTasks.length ? failTasks.join(', ') : EMPTY,
    decision,
    blocked ? '是' : '否',
  ]];
  return [
    `# 盲测看板：${stage}`,
    '',
    '口径：built 率=已构建（built 及后续状态）/总数；blind-pass 率=hidden 且 passed / hidden 总数；',
    '裁决（BMAD TEA 四态）：FAIL＞WAIVED＞CONCERNS＞PASS；空队列无证据判「—」；只有 PASS 不阻塞下游（全绿解锁）。',
    '',
    renderTable(['阶段名', '条目数', 'built 率', 'blind-pass 率', 'fail 归属 task', '裁决', '阻塞下游阶段'], rows),
    '',
  ].join('\n');
}

function parseMarkdownQueue(file) {
  const text = fs.readFileSync(file, 'utf8');
  const lines = text.split(/\r?\n/);
  const headerIndex = lines.findIndex((line) => splitMarkdownRow(line).join('|') === QUEUE_HEADERS.join('|'));
  if (headerIndex < 0) throw new Error('队列文件缺少标准表头');
  const entries = [];
  for (let i = headerIndex + 2; i < lines.length; i += 1) {
    const line = lines[i];
    if (!line.trim()) continue;
    if (line.trim().startsWith('#')) break;
    const cells = splitMarkdownRow(line);
    if (cells.length !== QUEUE_HEADERS.length) throw new Error(`队列第 ${i + 1} 行不是 ${QUEUE_HEADERS.length} 列`);
    entries.push({
      qid: cells[0],
      sourceTask: cells[1],
      feature: cells[2],
      verification: cells[3],
      hidden: cells[4] === 'true',
      status: cells[5],
    });
  }
  let decisions = [];
  const ledgerIndex = lines.findIndex((line) => line.trim() === '## 决策与留痕');
  if (ledgerIndex >= 0) {
    const ledgerLines = lines.slice(ledgerIndex + 1);
    const ledgerHeader = ledgerLines.findIndex((line) => splitMarkdownRow(line).join('|') === LEDGER_HEADERS.join('|'));
    if (ledgerHeader >= 0) {
      for (let i = ledgerHeader + 2; i < ledgerLines.length; i += 1) {
        const line = ledgerLines[i];
        if (!line.trim() || line.trim().startsWith('#')) continue;
        const cells = splitMarkdownRow(line);
        if (cells.length === LEDGER_HEADERS.length) decisions.push({ qid: cells[0], decision: cells[1], reason: cells[2], timestamp: cells[3] });
      }
    }
  }
  const stage = normalizeStageFromText(text);
  const frozen = /- frozen: true/.test(text);
  return validateQueue({ schema: SCHEMA, stage, frozen, entries, decisions, createdAt: '', updatedAt: nowIso() });
}

async function lockQueue(file) {
  const lockFile = `${file}.lock`;
  const dir = path.dirname(file);
  await fsPromises.mkdir(dir, { recursive: true });
  for (let attempt = 0; attempt <= 5; attempt += 1) {
    if (attempt) await new Promise((resolve) => setTimeout(resolve, 400));
    try {
      const handle = await fsPromises.open(lockFile, 'wx');
      await handle.close();
      return async () => fsPromises.unlink(lockFile).catch(() => {});
    } catch (error) {
      if (error.code !== 'EEXIST') throw error;
      try {
        const stat = await fsPromises.stat(lockFile);
        if (Date.now() - stat.mtimeMs > 30000) await fsPromises.unlink(lockFile).catch(() => {});
      } catch (_) { /* 锁已被其他进程释放 */ }
    }
  }
  throw new Error(`队列锁仍被占用: ${lockFile}`);
}

async function writeQueueFile(file, queue) {
  await fsPromises.mkdir(path.dirname(file), { recursive: true });
  const temp = `${file}.${process.pid}.tmp`;
  await fsPromises.writeFile(temp, renderQueueFile(queue), 'utf8');
  await fsPromises.rename(temp, file);
}

async function loadQueue({ workspace, stage }) {
  const file = queueFile(workspace, stage);
  try {
    return parseMarkdownQueue(file);
  } catch (error) {
    if (error.code === 'ENOENT') throw new Error(`队列不存在，请先执行 --init ${normalizeStage(stage)}`);
    throw error;
  }
}

async function mutateQueue({ workspace, stage, mutator }) {
  const file = queueFile(workspace, stage);
  const release = await lockQueue(file);
  try {
    const queue = await loadQueue({ workspace, stage });
    const result = await mutator(queue);
    queue.updatedAt = nowIso();
    await writeQueueFile(file, queue);
    return result;
  } finally {
    await release();
  }
}

function fillOptions(options) {
  if (options.status && !VALID_STATUSES.includes(options.status)) throw new Error(`未知 --status: ${options.status}`);
  if (options.status === 'waived' && !options.reason) throw new Error('--status waived 必须提供 --reason（waived 须留痕理由）');
  if (options.decision && !['PASS', 'FAIL', 'WAIVED'].includes(options.decision)) throw new Error('--decision 仅允许 PASS|FAIL|WAIVED');
  if (options.hidden !== undefined && typeof options.hidden !== 'boolean') throw new Error('--hidden 必须是 true 或 false');
}

async function initQueue({ workspace, stage }) {
  const normalized = normalizeStage(stage);
  const file = queueFile(workspace, normalized);
  try {
    await fsPromises.access(file);
    throw new Error(`队列已存在，拒绝覆盖: ${file}`);
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }
  const queue = blankQueue(normalized);
  await writeQueueFile(file, queue);
  return `已初始化 ${normalized}：${file}`;
}

async function fillQueue({ workspace, stage, qid, options }) {
  if (!qid || !String(qid).trim()) throw new Error('--fill 需要 <qid>');
  fillOptions(options);
  const normalized = normalizeStage(stage);
  const result = await mutateQueue({ workspace, stage: normalized, async mutator(queue) {
    const existing = queue.entries.find((item) => item.qid === qid);
    /* 新建条目：只能进 built，且须带全元数据（来源 task/功能点/验证方法）。冻结后一律拒绝（防篡改盲测包）。 */
    if (!existing) {
      if (queue.frozen) throw new Error('队列已冻结，拒绝 --fill 新建条目（防止篡改盲测包）');
      if (options.status && options.status !== 'built') throw new Error(`新建条目只能进入 built，当前请求状态: ${options.status}`);
      if (options.decision) throw new Error('新建 built 条目不能同时指定 --decision');
      if (options.reason) throw new Error('新建 built 条目不能同时指定 --reason');
      if (!options.sourceTask || !options.feature || !options.verification) {
        throw new Error('新建条目必须同时提供 --source-task、--feature、--verification');
      }
      const entry = {
        qid,
        sourceTask: options.sourceTask,
        feature: options.feature,
        verification: options.verification,
        hidden: options.hidden === undefined ? false : options.hidden,
        status: 'built',
      };
      queue.entries.push(entry);
      queue.decisions = queue.decisions.filter((decision) => decision.qid !== qid);
      return { action: 'created', entry, queue, decision: null };
    }

    const previous = existing.status;
    if (FINAL_STATUSES.has(previous)) throw new Error(`条目 ${qid} 已是终态 ${previous}，不能回填`);
    /* 未显式给 --status 时：pending 默认进 built，其余为同态幂等回填（补元数据）。 */
    const nextStatus = options.status || (previous === 'pending' ? 'built' : previous);
    if (!canTransition(previous, nextStatus)) {
      throw new Error(`非法状态路径: ${previous} -> ${nextStatus}（状态机只允许 pending→built→hidden→passed|failed|waived）`);
    }
    /* 冻结闸门（防篡改盲测包）：只放行 hidden→终态的裁决回写（盲行结果经编排者落账）；
     * 新建/元数据修改/其余流转一律拒绝。 */
    const isVerdict = FINAL_STATUSES.has(nextStatus) && nextStatus !== previous;
    if (queue.frozen && !isVerdict) {
      throw new Error('队列已冻结，拒绝 --fill（防止篡改盲测包；冻结后仅允许 hidden→passed|failed|waived 裁决回写）');
    }
    if (queue.frozen && (options.sourceTask !== undefined || options.feature !== undefined || options.verification !== undefined || options.hidden !== undefined)) {
      throw new Error('队列已冻结，拒绝修改条目元数据（防止篡改盲测包）');
    }
    /* waived 限 CONCERNS 级：队列存在 failed 条目（整体 FAIL 口径）时，不得用 waiver 逃生；
     * waiver 只适用于 CONCERNS 级收尾，且必须留痕理由（fillOptions 已强制 --reason）。 */
    if (nextStatus === 'waived' && nextStatus !== previous) {
      const othersFailed = queue.entries.some((item) => item.qid !== qid && item.status === 'failed');
      if (othersFailed) throw new Error('非法状态路径: waived 限 CONCERNS 级——队列存在 failed 条目（FAIL 口径），拒绝 waiver 逃生');
    }
    existing.status = nextStatus;
    if (options.sourceTask !== undefined) existing.sourceTask = options.sourceTask;
    if (options.feature !== undefined) existing.feature = options.feature;
    if (options.verification !== undefined) existing.verification = options.verification;
    if (options.hidden !== undefined) existing.hidden = options.hidden;
    const decision = options.decision || defaultDecision(existing.status);
    if (decision) {
      queue.decisions = queue.decisions.filter((item) => item.qid !== qid);
      queue.decisions.push({ qid, decision, reason: options.reason || '', timestamp: nowIso() });
    }
    return { action: 'updated', entry: existing, queue, decision: decision || null };
  } });
  return result;
}

async function freezeQueue({ workspace, stage }) {
  const normalized = normalizeStage(stage);
  const result = await mutateQueue({ workspace, stage: normalized, mutator(queue) {
    if (queue.frozen) throw new Error('队列已冻结，拒绝重复冻结');
    if (!queue.entries.length) throw new Error('队列为空，不能冻结');
    const notBuilt = queue.entries.filter((entry) => entry.status !== 'built');
    if (notBuilt.length) throw new Error(`队列未全部 built，不能冻结；未完成: ${notBuilt.map((entry) => `${entry.qid}=${entry.status}`).join(', ')}`);
    for (const entry of queue.entries) entry.status = 'hidden';
    queue.frozen = true;
    return { action: 'frozen', queue };
  } });
  return result;
}

function parseArgv(argv) {
  const nextValue = (name) => {
    const index = argv.indexOf(`--${name}`);
    if (index < 0) return undefined;
    const value = argv[index + 1];
    return value === undefined || value.startsWith('--') ? undefined : value;
  };
  const has = (name) => argv.includes(`--${name}`);
  const action = ['init', 'fill', 'freeze', 'view', 'board', 'protocol', 'help', 'self-test'].find((name) => has(name));
  /* dispatch CLI 口径：--init/--freeze/--view/--board 后可直接跟 <stage>（位置式），亦可 --stage <stage-N>。 */
  const stage = (action && ['init', 'freeze', 'view', 'board'].includes(action) ? nextValue(action) : undefined) || nextValue('stage');
  return {
    action,
    stage,
    qid: action === 'fill' ? nextValue('fill') : undefined,
    blind: has('blind'),
    sourceTask: nextValue('source-task'),
    feature: nextValue('feature'),
    verification: nextValue('verification'),
    hidden: has('hidden') ? true : has('no-hidden') ? false : undefined,
    status: nextValue('status'),
    decision: nextValue('decision'),
    reason: nextValue('reason'),
    workspace: nextValue('workspace'),
  };
}

function printProtocol() {
  console.log([
    '# 阶段盲测角色切换协议（SB-1，复用 E2E 盲行纪律：身份隔离 + 独立工作区 + session-notes）',
    '',
    '1. 编排者（建队列）：task 派单时 `node scripts/blindqueue.mjs --init <stage>` 生成队列文件',
    '   （<workspace>/.tt-state/stage-N-blindqueue.md）。',
    '2. 执行者（完成回填）：`node scripts/blindqueue.mjs --fill <qid> --stage <stage-N> --source-task <t>',
    '   --feature <f> --verification <步骤+期望> [--hidden]`——新建条目进 built；hidden=true 表示盲测保密条目。',
    '3. 冻结：全部条目 built 后编排者 `--freeze <stage>`——全部条目置 hidden 且冻结；此后 --fill 一律拒绝（防篡改盲测包）。',
    '4. 独立盲行 agent：只消费 `--view <stage> --blind`（hidden=true 条目只见 qid/来源 task，验证细节以 — 掩蔽）；',
    '   盲行结果经编排者 `--fill <qid> --status passed|failed|waived` 回写（waived 必须附 --reason 留痕）。',
    '5. 编排者转修复者：只按 fail 条目（--board 的 fail 归属 task）开修复 task；不得改盲测包（队列已冻结）。',
    '6. 全绿解锁：看板裁决四态（PASS/CONCERNS/FAIL/WAIVED，BMAD TEA 口径）；只有 PASS 不阻塞下游，',
    '   CONCERNS/FAIL/WAIVED/空队列均阻塞——修复完成重跑盲测后再收口。',
    '',
    '纪律边界（如实声明）：hidden 保密是导出/读取 API 上的过滤（--view --blind），队列原文完整落盘在同一工作区；',
    '单会话无进程隔离下，拥有文件读取权限的实现 agent 仍可能直读原文——保密是纪律级保证，非硬隔离。',
    '',
    '接线说明：本批只新增 scripts/blindqueue.mjs；不改 tt-journey.mjs（RG-1 并行占用写面），',
    'prereq-check 挂点由编排者批 2 收口时统一接线。',
    '',
  ].join('\n'));
}

function usage() {
  console.log([
    '用法：',
    '  node scripts/blindqueue.mjs --init <stage>',
    '  node scripts/blindqueue.mjs --fill <qid> --stage <stage-N> --source-task <t> --feature <f> --verification <步骤+期望> [--hidden] [--status built|hidden|passed|failed|waived] [--decision PASS|FAIL|WAIVED] [--reason <理由>]',
    '  node scripts/blindqueue.mjs --freeze <stage>',
    '  node scripts/blindqueue.mjs --view <stage> [--blind]',
    '  node scripts/blindqueue.mjs --board <stage>',
    '  node scripts/blindqueue.mjs --protocol',
    '  node scripts/blindqueue.mjs --self-test',
    '',
    '所有命令可加 --workspace <目录>；stage 可写 1 或 stage-1，落盘为 <workspace>/.tt-state/stage-1-blindqueue.md。',
  ].join('\n'));
}

function assertArgs(options) {
  if (!options.action) throw new Error('缺少命令：init|fill|freeze|view|board|protocol|help|self-test');
  if (options.action === 'protocol' || options.action === 'help' || options.action === 'self-test') return;
  if (!options.stage) throw new Error(`--${options.action} 需要 <stage>（位置式）或 --stage <stage-N>`);
  if (options.action === 'fill' && !options.qid) throw new Error('--fill 需要 <qid>（位置式，且不能以 -- 开头）');
}

async function runSelfTest(stage) {
  const root = await fsPromises.mkdtemp(path.join(os.tmpdir(), 'blindqueue-selftest-'));
  const steps = [];
  const pass = (name, ok, detail) => steps.push({ name, ok, detail });
  const tryFail = async (fn, re) => {
    try { await fn(); return null; } catch (error) { return re.test(error.message) ? error.message : `错误不符: ${error.message}`; }
  };
  try {
    await initQueue({ workspace: root, stage });
    pass('--init 生成标准队列', fs.existsSync(queueFile(root, stage)), queueFile(root, stage));
    let again = null;
    try { await initQueue({ workspace: root, stage }); } catch (error) { again = error.message; }
    pass('--init 重复初始化拒绝覆盖', /拒绝覆盖/.test(again || ''), again || '未拒绝');

    const q1 = await fillQueue({ workspace: root, stage, qid: 'Q1', options: { sourceTask: 'task-A', feature: '功能点A', verification: '步骤1 后期望 A（公开条目）', hidden: false } });
    const q2 = await fillQueue({ workspace: root, stage, qid: 'Q2', options: { sourceTask: 'task-B', feature: '功能点B', verification: '步骤2 后期望 B（保密条目）', hidden: true } });
    const q3 = await fillQueue({ workspace: root, stage, qid: 'Q3', options: { sourceTask: 'task-C', feature: '功能点C', verification: '步骤3 后期望 C（保密条目）', hidden: true } });
    pass('合法 pending -> built（新建条目）', q1.action === 'created' && q2.action === 'created' && q3.action === 'created', 'Q1/Q2/Q3 built');

    const missingMeta = await tryFail(
      () => fillQueue({ workspace: root, stage, qid: 'Q9', options: { sourceTask: 'task-X' } }),
      /--source-task、--feature、--verification/,
    );
    pass('新建缺元数据拒绝', !!missingMeta, missingMeta || '未拒绝');

    await fillQueue({ workspace: root, stage, qid: 'Q1', options: { status: 'hidden' } });
    await fillQueue({ workspace: root, stage, qid: 'Q2', options: { status: 'hidden' } });
    await fillQueue({ workspace: root, stage, qid: 'Q3', options: { status: 'hidden' } });
    const statuses = (await loadQueue({ workspace: root, stage })).entries.map((e) => `${e.qid}=${e.status}`).join(',');
    pass('合法 built -> hidden', statuses === 'Q1=hidden,Q2=hidden,Q3=hidden', statuses);

    await fillQueue({ workspace: root, stage, qid: 'Q1', options: { status: 'passed' } });
    await fillQueue({ workspace: root, stage, qid: 'Q2', options: { status: 'failed' } });
    const statuses2 = (await loadQueue({ workspace: root, stage })).entries.map((e) => `${e.qid}=${e.status}`).join(',');
    pass('合法 hidden -> passed/failed', statuses2 === 'Q1=passed,Q2=failed,Q3=hidden', statuses2);

    // 合法流转：Q3 hidden -> passed（Q2 的 failed 不影响其他条目正常裁决）
    await fillQueue({ workspace: root, stage, qid: 'Q3', options: { status: 'passed' } });
    const statuses3 = (await loadQueue({ workspace: root, stage })).entries.map((e) => `${e.qid}=${e.status}`).join(',');
    pass('合法 hidden -> passed（Q3）', statuses3 === 'Q1=passed,Q2=failed,Q3=passed', statuses3);
    const q3Final = await tryFail(
      () => fillQueue({ workspace: root, stage, qid: 'Q3', options: { status: 'waived', reason: '终态后豁免' } }),
      /已是终态 passed/,
    );
    pass('终态不可回填（passed→waived 拒绝）', !!q3Final, q3Final || '未拒绝');

    // 非法路径：新建独立队列测 built→waived（跳过 hidden 裁决段）必须被拒
    await initQueue({ workspace: root, stage: 'stage-9' });
    await fillQueue({ workspace: root, stage: 'stage-9', qid: 'B1', options: { sourceTask: 'task-Z', feature: 'Z', verification: 'VZ', hidden: false } });
    const skipHidden = await tryFail(
      () => fillQueue({ workspace: root, stage: 'stage-9', qid: 'B1', options: { status: 'waived', reason: '跳过 hidden' } }),
      /非法状态路径: built -> waived/,
    );
    pass('非法跳转（built 直接 waived，跳过 hidden）拒绝', !!skipHidden, skipHidden || '未拒绝');

    // FAIL 口径下 waiver 逃生拒绝：stage-9 追加 B2 失败条目，B1 已终态 passed，B2 hidden 时申请 waive → 拒
    await fillQueue({ workspace: root, stage: 'stage-9', qid: 'B1', options: { status: 'hidden' } });
    await fillQueue({ workspace: root, stage: 'stage-9', qid: 'B1', options: { status: 'passed' } });
    await fillQueue({ workspace: root, stage: 'stage-9', qid: 'B2', options: { sourceTask: 'task-Y', feature: 'Y', verification: 'VY', hidden: true } });
    await fillQueue({ workspace: root, stage: 'stage-9', qid: 'B2', options: { status: 'hidden' } });
    await fillQueue({ workspace: root, stage: 'stage-9', qid: 'B2', options: { status: 'failed' } });
    // B2 已终态；同态幂等回填（无 --status）允许但元数据修改被拒是冻结后行为，此处仅验证终态锁：
    const b2Final = await tryFail(
      () => fillQueue({ workspace: root, stage: 'stage-9', qid: 'B2', options: { status: 'passed' } }),
      /已是终态 failed/,
    );
    pass('终态不可回填（stage-9 B2 failed→passed 拒绝）', !!b2Final, b2Final || '未拒绝');
    await initQueue({ workspace: root, stage: 'stage-8' });
    await fillQueue({ workspace: root, stage: 'stage-8', qid: 'F1', options: { sourceTask: 'task-W', feature: 'W', verification: 'VW', hidden: true } });
    await fillQueue({ workspace: root, stage: 'stage-8', qid: 'F1', options: { status: 'built' } });
    await fillQueue({ workspace: root, stage: 'stage-8', qid: 'F2', options: { sourceTask: 'task-V', feature: 'V', verification: 'VV', hidden: false } });
    await fillQueue({ workspace: root, stage: 'stage-8', qid: 'F2', options: { status: 'built' } });
    await fillQueue({ workspace: root, stage: 'stage-8', qid: 'F1', options: { status: 'hidden' } });
    await fillQueue({ workspace: root, stage: 'stage-8', qid: 'F2', options: { status: 'hidden' } });
    await fillQueue({ workspace: root, stage: 'stage-8', qid: 'F1', options: { status: 'failed' } });
    const waiveInFail = await tryFail(
      () => fillQueue({ workspace: root, stage: 'stage-8', qid: 'F2', options: { status: 'waived', reason: '试图在 FAIL 口径下豁免' } }),
      /waived 限 CONCERNS 级/,
    );
    pass('waived 限 CONCERNS（FAIL 口径下拒绝 waiver 逃生）', !!waiveInFail, waiveInFail || '未拒绝');

    // --freeze 要求全部条目已 built；存在终态条目 → 拒绝冻结（stage-1 此刻 Q1/Q2/Q3 均终态/非 built）
    const freezeWithFinal = await tryFail(
      () => freezeQueue({ workspace: root, stage }),
      /队列未全部 built/,
    );
    pass('freeze 存在终态条目拒绝（须全部 built）', !!freezeWithFinal, freezeWithFinal || '未拒绝');

    const finalAgain = await tryFail(
      () => fillQueue({ workspace: root, stage, qid: 'Q2', options: { status: 'passed' } }),
      /已是终态 failed/,
    );
    pass('终态不可回填', !!finalAgain, finalAgain || '未拒绝');

    // CONCERNS 口径下的合法 waive：用独立 stage 验证「无 failed 条目时 hidden→waived 合法」。
    await initQueue({ workspace: root, stage: 'stage-2' });
    await fillQueue({ workspace: root, stage: 'stage-2', qid: 'W1', options: { sourceTask: 'task-E', feature: 'E', verification: 'V1', hidden: true } });
    await fillQueue({ workspace: root, stage: 'stage-2', qid: 'W1', options: { status: 'built' } });
    // 冻结（freeze 要求全部 built；冻结后 hidden→终态裁决回写放行，元数据修改拒绝）
    await freezeQueue({ workspace: root, stage: 'stage-2' });
    await fillQueue({ workspace: root, stage: 'stage-2', qid: 'W1', options: { status: 'waived', reason: '低风险残留，Owner 口头接受（CONCERNS 级）' } });
    const w1After = (await loadQueue({ workspace: root, stage: 'stage-2' })).entries.find((e) => e.qid === 'W1');
    pass('冻结后裁决回写放行（hidden→waived）', w1After && w1After.status === 'waived', w1After ? w1After.status : '缺条目');
    const stage2Ledger = (await loadQueue({ workspace: root, stage: 'stage-2' })).decisions;
    pass('waive 留痕落「决策与留痕」', stage2Ledger.some((d) => d.qid === 'W1' && d.decision === 'WAIVED' && d.reason.includes('CONCERNS')), JSON.stringify(stage2Ledger));
    const metaTamper = await tryFail(
      () => fillQueue({ workspace: root, stage: 'stage-2', qid: 'W1', options: { verification: '篡改验证方法' } }),
      /已是终态|拒绝修改条目元数据/,
    );
    pass('冻结后改元数据拒绝（防篡改）', !!metaTamper, metaTamper || '未拒绝');

    // 双视图：blind 视图掩蔽 hidden 条目细节，公开条目照常可见
    const full = renderFullView(await loadQueue({ workspace: root, stage }));
    const blind = renderBlindView(await loadQueue({ workspace: root, stage }));
    pass('blind 视图掩蔽 hidden 条目细节', !blind.includes('期望 B（保密条目）') && !blind.includes('功能点B') && blind.includes('Q2') && blind.includes('task-B'), 'hidden 条目仅 qid/来源task 可见');
    pass('blind 视图保留公开条目细节', blind.includes('功能点A') && blind.includes('期望 A（公开条目）'), 'hidden=false 细节可见');
    pass('完整视图不受限', full.includes('期望 B（保密条目）') && full.includes('功能点B'), '编排者全量可见');

    await fillQueue({ workspace: root, stage: 'stage-8', qid: 'F2', options: { status: 'passed' } });
    // 全绿队列冻结：stage-8 F1=failed 为终态不能冻结——改用全新 stage-7（两条全部 built）验证 freeze 全 hidden
    await initQueue({ workspace: root, stage: 'stage-7' });
    await fillQueue({ workspace: root, stage: 'stage-7', qid: 'Z1', options: { sourceTask: 'task-U', feature: 'U', verification: 'VU（保密条目）', hidden: true } });
    await fillQueue({ workspace: root, stage: 'stage-7', qid: 'Z2', options: { sourceTask: 'task-T', feature: 'T', verification: 'VT（公开条目）', hidden: false } });
    await fillQueue({ workspace: root, stage: 'stage-7', qid: 'Z1', options: { status: 'built' } });
    await fillQueue({ workspace: root, stage: 'stage-7', qid: 'Z2', options: { status: 'built' } });
    await freezeQueue({ workspace: root, stage: 'stage-7' });
    const frozenQueue = await loadQueue({ workspace: root, stage: 'stage-7' });
    pass('freeze 全部 built -> hidden + frozen=true', frozenQueue.frozen && frozenQueue.entries.every((e) => e.status === 'hidden'), 'stage-7 frozen=true');

    // 冻结防篡改（stage-7 已冻结）：新建/改元数据均拒绝
    let rejected = null;
    try { await fillQueue({ workspace: root, stage: 'stage-7', qid: 'Z3', options: { sourceTask: 'tamper', feature: 'tamper', verification: 'tamper', hidden: false } }); } catch (error) { rejected = error.message; }
    pass('冻结后 --fill（新建）拒绝', /已冻结/.test(rejected || ''), rejected || '未拒绝');
    rejected = null;
    try { await fillQueue({ workspace: root, stage: 'stage-7', qid: 'Z2', options: { status: 'passed', verification: '篡改' } }); } catch (error) { rejected = error.message; }
    pass('冻结后 --fill（裁决+改元数据）拒绝', /已冻结|已是终态/.test(rejected || ''), rejected || '未拒绝');
    const verdictZ1 = await fillQueue({ workspace: root, stage: 'stage-7', qid: 'Z1', options: { status: 'passed' } });
    pass('冻结后纯裁决回写放行（hidden→passed）', (await loadQueue({ workspace: root, stage: 'stage-7' })).entries.find((e) => e.qid === 'Z1').status === 'passed', verdictZ1.entry.status);

    // 看板统计：stage-1 = 1 passed + 1 failed + 1 hidden→waived 场景不成立，此处 Q3 保持 hidden → FAIL 裁决
    const board = renderBoard(await loadQueue({ workspace: root, stage }));
    pass('看板统计（1 passed/1 failed/1 hidden → FAIL，fail 归属 task-B，阻塞）',
      board.includes('| stage-1 | 3 | 100.0% | 50.0% | task-B | FAIL | 是 |'),
      board.split('\n').find((line) => line.startsWith('| stage-1')) || '无数据行');

    const board2 = renderBoard(await loadQueue({ workspace: root, stage: 'stage-2' }));
    pass('看板 WAIVED 裁决阻塞下游（fail 归属 —）', board2.includes('| stage-2 | 1 | 100.0% | 0.0% | — | WAIVED | 是 |'),
      board2.split('\n').find((line) => line.startsWith('| stage-2')) || '无数据行');

    // 全绿解锁：stage-3 单条 passed → PASS 裁决、不阻塞下游
    await initQueue({ workspace: root, stage: 'stage-3' });
    await fillQueue({ workspace: root, stage: 'stage-3', qid: 'P1', options: { sourceTask: 'task-F', feature: 'F', verification: 'VF', hidden: true } });
    await fillQueue({ workspace: root, stage: 'stage-3', qid: 'P1', options: { status: 'built' } });
    await freezeQueue({ workspace: root, stage: 'stage-3' });
    await fillQueue({ workspace: root, stage: 'stage-3', qid: 'P1', options: { status: 'passed' } });
    const board3 = renderBoard(await loadQueue({ workspace: root, stage: 'stage-3' }));
    pass('看板 PASS 裁决不阻塞（全绿解锁）', board3.includes('| stage-3 | 1 | 100.0% | 100.0% | — | PASS | 否 |'),
      board3.split('\n').find((line) => line.startsWith('| stage-3')) || '无数据行');
  } catch (error) {
    pass('self-test 运行', false, error.message);
  } finally {
    await fsPromises.rm(root, { recursive: true, force: true });
  }
  const failed = steps.filter((step) => !step.ok);
  for (const step of steps) console.log(`${step.ok ? 'PASS' : 'FAIL'} ${step.name} [${step.detail}]`);
  console.log(`blindqueue self-test: ${failed.length ? `${failed.length} 项失败` : '全部通过'}`);
  return failed.length === 0;
}

async function main() {
  const options = parseArgv(process.argv.slice(2));
  if (options.action === 'self-test') {
    process.exitCode = await runSelfTest(options.stage || 'stage-1') ? 0 : 1;
    return;
  }
  if (options.action === 'help') {
    usage();
    return;
  }
  if (options.action === 'protocol') {
    printProtocol();
    return;
  }
  assertArgs(options);
  const workspace = workspaceRoot(options.workspace);
  if (options.action === 'init') {
    console.log(await initQueue({ workspace, stage: options.stage }));
  } else if (options.action === 'fill') {
    const result = await fillQueue({ workspace, stage: options.stage, qid: options.qid, options });
    console.log(`已${result.action === 'created' ? '创建' : '更新'} ${options.qid}：${result.entry.qid} | ${result.entry.sourceTask} | ${result.entry.status}`);
    if (result.decision) console.log(`裁决留痕：${result.decision}${result.entry.status === 'waived' && options.reason ? ` | ${options.reason}` : ''}`);
  } else if (options.action === 'freeze') {
    const result = await freezeQueue({ workspace, stage: options.stage });
    console.log(`已冻结 ${result.queue.stage}：${result.queue.entries.length} 条目全部 hidden`);
  } else if (options.action === 'view') {
    const queue = await loadQueue({ workspace, stage: options.stage });
    process.stdout.write(options.blind ? renderBlindView(queue) : renderFullView(queue));
  } else if (options.action === 'board') {
    const queue = await loadQueue({ workspace, stage: options.stage });
    process.stdout.write(renderBoard(queue));
  } else {
    usage();
    process.exitCode = 2;
  }
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  main().catch((error) => {
    console.error(`[blindqueue] ${error.message}`);
    process.exitCode = 2;
  });
}

export {
  SCHEMA,
  VALID_STATUSES,
  blankQueue,
  blindEntry,
  blindQueue,
  canTransition,
  fillQueue,
  findEntry,
  freezeQueue,
  initQueue,
  loadQueue,
  normalizeStage,
  parseMarkdownQueue,
  queueFile,
  renderBoard,
  renderBlindView,
  renderFullView,
  renderQueueFile,
  validateQueue,
};

/** blind 条目投影（导出 API 消费方用）：hidden 条目仅暴露 qid/来源task。 */
function blindEntry(entry) {
  return { qid: entry.qid, sourceTask: entry.sourceTask };
}

function blindQueue(queue) {
  return { schema: SCHEMA, stage: queue.stage, entries: queue.entries.map(blindEntry) };
}
