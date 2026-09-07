import readline from 'node:readline';
import { validateDraft, ESTIMATES } from './deconstruct.mjs';

/**
 * 终端逐 task 审批（FR-2）：对拆解草案逐 task y/n/e/a。
 *  - 首屏摘要（批判 C3 回灌）：phase 数/总 task 数/并行 lane/估算汇总，先审结构再审细节。
 *  - y=批准 / n=拒绝（记录原因，回「回拆解/保持现状/手动修正」三选一）/ e=编辑（asset/desc/estimate/dependsOn/phase）/ a=剩余全批准。
 *  - 任一 n 且选择回拆解 → 不产生正式 plan、不写 contracts、返回审批中止（退出码由编排器映射）。
 *  - 非 TTY 降级：stdin 非交互时打印草案与摘要并提示，不崩溃。
 *  - 零依赖：原生 node:readline。
 */

function truncate(text, max) {
  const s = String(text || '');
  return s.length > max ? s.slice(0, max - 1) + '…' : s;
}

export function summarizeDraft(draft) {
  const phases = draft.phases.length;
  const tasks = draft.phases.reduce((n, p) => n + p.tasks.length, 0);
  const lanes = [...new Set(draft.phases.flatMap((p) => p.tasks.map((t) => t.lane)))];
  const est = { S: 0, M: 0, L: 0 };
  for (const p of draft.phases) {
    for (const t of p.tasks) {
      const key = String(t.estimate || '').toUpperCase();
      if (ESTIMATES.includes(key)) est[key] += 1;
    }
  }
  return { phases, tasks, lanes, est };
}

export function printApprovalSummary(draft) {
  const s = summarizeDraft(draft);
  return '=== 拆解草案审批摘要 ===\n'
    + 'phases: ' + s.phases + ' | tasks: ' + s.tasks + ' | lanes: ' + s.lanes.length + ' (' + s.lanes.join(',') + ')'
    + ' | estimate: S=' + s.est.S + ' M=' + s.est.M + ' L=' + s.est.L;
}

export function printDraft(draft) {
  return JSON.stringify(draft, null, 2);
}

function pseudoManifest(names) {
  return { entries: (names || []).map((n) => ({ name: n })) };
}

async function editTask(t, draft, ask, whitelist) {
  for (;;) {
    console.log('编辑 task ' + t.id + '（直接回车 = 保持当前值；输入 q 取消本次编辑）');
    const asset = (await ask('  asset [' + t.asset + ']: ')).trim();
    if (asset === 'q') return 'cancel';
    if (asset) {
      if (!whitelist.has(asset)) { console.error('asset 不在白名单: ' + asset + '（可用: ' + [...whitelist].sort().join(', ') + '）'); continue; }
      t.asset = asset;
    }
    const desc = (await ask('  desc [' + truncate(t.desc, 40) + ']: ')).trim();
    if (desc === 'q') return 'cancel';
    if (desc) t.desc = desc;
    const estimate = (await ask('  estimate [' + t.estimate + '] (S/M/L): ')).trim().toUpperCase();
    if (estimate === 'Q') return 'cancel';
    if (estimate) {
      if (!ESTIMATES.includes(estimate)) { console.error('estimate 必须为 S/M/L'); continue; }
      t.estimate = estimate;
    }
    const curPhase = draft.phases.find((p) => p.tasks.includes(t));
    const phaseName = (await ask('  phase [' + (curPhase ? curPhase.name : '?') + ']: ')).trim();
    if (phaseName === 'q') return 'cancel';
    if (phaseName) {
      const target = draft.phases.find((p) => p.name === phaseName);
      if (!target) { console.error('phase 不存在: ' + phaseName + '（现有: ' + draft.phases.map((p) => p.name).join(', ') + '）'); continue; }
      if (curPhase && target !== curPhase) {
        curPhase.tasks = curPhase.tasks.filter((x) => x !== t);
        target.tasks.push(t);
      }
    }
    const depsRaw = (await ask('  dependsOn（逗号/空格分隔的 task id，空 = 保持，- = 清空）: ')).trim();
    if (depsRaw === 'q') return 'cancel';
    if (depsRaw === '-') t.dependsOn = [];
    else if (depsRaw) t.dependsOn = depsRaw.split(/[,，\s]+/).filter(Boolean);
    return 'ok';
  }
}

/**
 * 逐 task 审批。
 * options: { logger?, forceNonInteractive?, assetNames? }
 *  - forceNonInteractive: 草案已从 stdin 读入（stdin 已 EOF），强制降级，避免对已关闭流提问挂起。
 *  - TT_APPROVE_FORCE_TTY=1：强制走交互逻辑（即使 stdin 是管道）——供脚本化 stdin 验证。
 * 返回 { approved: true, draft } 或 { approved: false, reason: 're-decompose'|'non-interactive'|'abort'|'invalid', taskId? }。
 */
export async function approveDraft(draft, options = {}) {
  const { forceNonInteractive = false, assetNames = [] } = options;
  const forceInteractive = process.env.TT_APPROVE_FORCE_TTY === '1';
  const nonInteractive = !forceInteractive && (forceNonInteractive === true || !process.stdin.isTTY || !process.stdout.isTTY);
  if (nonInteractive) {
    console.log(printApprovalSummary(draft));
    console.log('--- 拆解草案 ---');
    console.log(printDraft(draft));
    console.log('--- 非交互环境（stdin 非 TTY），未执行逐 task 审批。请在 TTY 终端运行交互审批，或用 --plan --draft <file> 后在同一终端审批。 ---');
    return { approved: false, reason: 'non-interactive' };
  }
  const whitelist = new Set(assetNames);
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  // 不用 rl.question（批量到达 stdin 时，无挂起 question 的行会被 readline 以 'line' 事件丢给零监听者而丢失）。
  // 改为自维护行缓冲队列：'line' 事件一律入队或喂给挂起的等待者，ask() 只从队列取，不丢行。
  let lineBuffer = [];
  let pendingAsk = null;
  rl.on('line', (line) => {
    if (pendingAsk) { const p = pendingAsk; pendingAsk = null; p(line); }
    else lineBuffer.push(line);
  });
  rl.on('close', () => {
    if (pendingAsk) { const p = pendingAsk; pendingAsk = null; p(null); }
  });
  const ask = (q) => new Promise((resolve) => {
    process.stdout.write(q);
    if (lineBuffer.length) { const v = lineBuffer.shift(); resolve(v === null ? '' : v); return; }
    pendingAsk = (v) => resolve(v === null ? '' : v);
  });
  console.log(printApprovalSummary(draft));
  const flat = [];
  draft.phases.forEach((phase) => { phase.tasks.forEach((t) => flat.push(t)); });
  const toValidate = () => validateDraft(draft, pseudoManifest(assetNames));
  try {
    for (const t of flat) {
      if (t.approved === true) continue;
      let decided = false;
      while (!decided) {
        const deps = (t.dependsOn || []).join(', ') || '—';
        const answer = (await ask('[' + t.id + '] ' + t.asset + ' ' + truncate(t.desc, 60) + ' [' + t.estimate + '] (dependsOn: ' + deps + ') y/n/e/a> ')).trim().toLowerCase();
        if (answer === 'a') {
          for (const x of flat) x.approved = true;
          console.log('剩余全部批准（' + flat.filter((x) => x.approved === true).length + '/' + flat.length + '）');
          decided = true;
        } else if (answer === 'y') {
          t.approved = true;
          decided = true;
        } else if (answer === 'e') {
          const edited = await editTask(t, draft, ask, whitelist);
          if (edited === 'cancel') { continue; }
          const v = toValidate();
          if (!v.ok) { console.error('编辑后校验失败（不会进入冻结）: ' + v.errors.join(' | ')); continue; }
          t.approved = true;
          decided = true;
        } else if (answer === 'n') {
          const reason = (await ask('拒绝原因（可选，直接回车跳过）: ')).trim();
          t.note = reason ? 'rejected: ' + reason : 'rejected';
          console.log('拒绝已记录。选择处置：1) 回拆解（中止审批） 2) 保持现状（保留该 task 原样继续） 3) 手动修正（进入编辑）');
          const choice = (await ask('> ')).trim();
          if (choice === '1' || choice === '回拆解') return { approved: false, reason: 're-decompose', taskId: t.id };
          if (choice === '3' || choice === '手动修正') {
            const edited = await editTask(t, draft, ask, whitelist);
            if (edited === 'cancel') { continue; }
            const v = toValidate();
            if (!v.ok) { console.error('编辑后校验失败: ' + v.errors.join(' | ')); continue; }
            t.approved = true;
            decided = true;
          } else {
            t.approved = true;
            decided = true;
          }
        } else if (answer === '') {
          console.error('输入中断（stdin 已结束）——审批中止，未产生正式 plan');
          return { approved: false, reason: 'abort' };
        } else {
          console.log('输入 y(批准) / n(拒绝) / e(编辑) / a(剩余全批准)');
        }
      }
    }
  } finally {
    rl.close();
  }
  const v = toValidate();
  if (!v.ok) {
    console.error('审批后终校验失败（不会进入冻结）: ' + v.errors.join(' | '));
    return { approved: false, reason: 'invalid' };
  }
  draft.approved = true;
  draft.approvedAt = new Date().toISOString();
  return { approved: true, draft };
}
