/**
 * decision-plain.mjs — C2.2 确定性白话投影（契约 plain_language 权威的唯一实现）
 *
 * 纪律（C1 冻结 + C2-R1-4 收紧）：
 *   - 文案唯一来源 = contracts/generated/decision-plain-projection.json（decision-authority 组件）；
 *     闸名中文映射（gate_names）、任务级回退文案均在该表，本文件零自有 zh-CN 句子；
 *   - JS 只持有：码、结构化动作、槽位名；模板 {slot} 插值仅限白名单槽位（未知槽位原样保留，可审计）；
 *   - 禁 LLM、禁自由改写：同 packet ⇒ 字节等价 owner 段（机验）；
 *   - Owner 五问固定序：在哪一步 / 为何能或不能 / YY 做了什么 / 选了什么为什么 / 只需决定什么。
 */
import fs from 'node:fs';
import path from 'node:path';
import { DECISION_REPO_ROOT } from './decision-authority.mjs';

export const PLAIN_TABLE_REL = 'contracts/generated/decision-plain-projection.json';

let cachedTable = null;

export function loadPlainTable(repoRoot = DECISION_REPO_ROOT) {
  if (cachedTable && cachedTable.__root === repoRoot) return cachedTable;
  const raw = JSON.parse(fs.readFileSync(path.join(repoRoot, PLAIN_TABLE_REL), 'utf8'));
  if (!raw || raw.schema !== 'yy/decision-plain-projection@1' || typeof raw.templates !== 'object' || typeof raw.gate_names !== 'object') {
    throw new Error('plain projection table 无效: ' + PLAIN_TABLE_REL);
  }
  cachedTable = Object.assign({ __root: repoRoot }, raw);
  return cachedTable;
}

/** 槽位插值：仅替换表中登记的槽位键；未提供的槽位原样保留（确定性，无猜测）。 */
export function fill(template, slots) {
  let out = String(template);
  const allowed = loadPlainTable().slots;
  for (const key of allowed) {
    if (Object.prototype.hasOwnProperty.call(slots, key) && slots[key] !== undefined && slots[key] !== null) {
      out = out.split('{' + key + '}').join(String(slots[key]));
    }
  }
  return out;
}

function t(key) {
  const table = loadPlainTable();
  if (!(key in table.templates)) throw new Error('plain projection 模板缺失: ' + key);
  return table.templates[key];
}

function gateName(gate) {
  const names = loadPlainTable().gate_names;
  return names[gate] || gate;
}

/**
 * renderOwnerActions(structured) — 结构化动作 → 表模板渲染的 owner 动作串。
 * structured 项：{type:'init'} | {type:'gate', gate} | {type:'step', step, name}。
 * decision-core 据此构造 stage.required_owner_action（packet 字段），零 JS 自有文案。
 */
export function renderOwnerActions(structured) {
  const out = [];
  for (const a of Array.isArray(structured) ? structured : []) {
    if (a && a.type === 'init') out.push(t('owner.q5.init'));
    else if (a && a.type === 'gate' && a.gate) out.push(fill(t('owner.q5.gate'), { gate_name: gateName(a.gate) }));
    else if (a && a.type === 'step' && a.step !== undefined) out.push(fill(t('owner.q5.step'), { dep_step: a.step, dep_name: a.name || String(a.step) }));
  }
  return out;
}

/**
 * projectOwnerView(packet) — 从结构化 packet 投影 owner 段（纯函数，零 IO 除表加载）。
 * packet = decision-core 产出的 Decision Packet（stage / task / validation 皆可）。
 */
export function projectOwnerView(packet) {
  const lines = [];
  const stage = packet.stage || null;
  const routing = packet.routing || null;
  const validation = packet.validation || null;

  // Q1 现在在哪一步
  if (stage) {
    lines.push(fill(t('owner.q1'), { step: stage.current_step, step_name: stage.current_name }));
  } else {
    lines.push(t('owner.q1.task_fallback'));
  }

  // Q2 为什么能/不能继续
  if (validation) {
    lines.push(validation.bypass_flag ? t('validation.bypass') : t('validation.proof'));
  } else if (stage) {
    if (stage.allowed) {
      const def = stage.requested_step !== undefined && stage.requested_step !== null;
      lines.push(fill(t('owner.q2.allowed'), {
        requested_step: def ? stage.requested_step : stage.current_step,
        requested_name: def ? stage.requested_name || String(stage.requested_step) : stage.current_name,
      }));
    } else if (packet.workflow && packet.workflow.journey_status === 'NOT_INITIALIZED') {
      lines.push(stage.requested_step === 0 ? t('owner.q2.not_initialized') : fill(t('owner.q2.not_initialized_other'), { requested_step: stage.requested_step }));
    } else {
      const gateMissing = (stage.prerequisites || []).find((p) => !p.satisfied && p.unmet_reason === 'PREREQ_GATE_MISSING' && p.gate);
      const depBlocker = (stage.prerequisites || []).find((p) => !p.satisfied && p.unmet_reason === 'PREREQ_STEP_UNDONE');
      if (gateMissing) {
        lines.push(fill(t('owner.q2.gate_missing'), { requested_step: stage.requested_step, gate_name: gateName(gateMissing.gate) }));
      } else if (depBlocker) {
        lines.push(fill(t('owner.q2.prereq_step'), { requested_step: stage.requested_step, dep_step: depBlocker.step, dep_name: depBlocker.name || String(depBlocker.step) }));
      } else {
        const b0 = (stage.blockers && stage.blockers[0] && stage.blockers[0].reason) || '';
        lines.push(String(b0));
      }
    }
  } else if (routing && routing.selection_blocked) {
    const sb = routing.selection_blocked;
    const short = (sb.reasons && sb.reasons.length) ? String(sb.reasons[sb.reasons.length - 1]).slice(0, 120) : '资格判定未通过';
    lines.push(fill(t('owner.q2.owner_ineligible'), { capability: routing.capability || '-', asset: sb.asset || '-', reason: short }));
  } else if (routing) {
    if (routing.capability_source) {
      lines.push(fill(t('owner.q3.task_select'), { cluster: routing.cluster, capability: routing.capability || '-', capability_source: routing.capability_source }));
    } else {
      lines.push(fill(t('owner.q3.task_select_auto'), { cluster: routing.cluster }));
    }
  }

  // Supplemental execution verdict stays separate from journey admission and owner business decisions.
  if (stage && Object.hasOwn(stage, 'execution_phase')) {
    const phase = stage.execution_phase;
    if (phase?.allowed === true) lines.push(t('phase.allowed'));
    else {
      const blockers = Array.isArray(phase?.blockers) ? phase.blockers : [];
      lines.push(fill(t('phase.blocked'), { count: blockers.length }));
      for (const blocker of blockers) lines.push(fill(t('phase.blocker'), { reason: blocker.reason || blocker.code }));
      const missing = [...new Set(blockers.flatMap(b => Array.isArray(b.missing) ? b.missing : []))];
      lines.push(fill(t('phase.next'), { evidence: missing.length ? missing.join('、') : t('phase.next_evidence') }));
    }
  }

  // Q3 YY 刚才做了什么
  if (stage && !validation) lines.push(fill(t('owner.q3.stage'), { requested_step: stage.requested_step }));
  if (packet.brief && packet.brief.text) {
    const loaded = (packet.assets && packet.assets[0] && packet.assets[0].loaded_sections) || [];
    lines.push(fill(t('owner.q3.task_brief'), { asset: packet.assets[0].id }));
    lines.push(fill(t('owner.q4.loaded'), { asset: packet.assets[0].id, reason: String(loaded.length) }));
  }

  // Q4 选了哪些资产，为什么
  if (routing) {
    const primary = routing.primary_assets || [];
    if (primary.length) {
      lines.push(fill(t('owner.q4.primary'), { asset: primary.join('、') }));
    } else {
      lines.push(t('owner.q4.none'));
    }
    const supporting = routing.supporting_assets || [];
    if (supporting.length) lines.push(fill(t('owner.q4.supporting'), { assets: supporting.join('、') }));
    for (const ns of routing.not_selected_assets || []) {
      const short = (ns.reasons && ns.reasons.length) ? String(ns.reasons[ns.reasons.length - 1]).slice(0, 80) : '不适用';
      lines.push(fill(t('owner.q4.not_selected'), { asset: ns.asset, reason: short }));
    }
  }

  // Q5 现在只需要决定什么（decisions = Q5 动作清单，与 plain_summary 同源确定性）
  const q5 = [];
  const acts = (stage && stage.required_owner_action) || [];
  if (acts.length) q5.push(...acts);
  else if (validation) { /* 已由 Q2 覆盖 */ }
  else if (routing && routing.selection_blocked) q5.push(t('owner.q5.owner_ineligible'));
  else if (packet.brief && packet.brief.text) q5.push(t('owner.q5.confirm_premise'));
  else if (routing && !routing.capability_source) q5.push(t('owner.q5.capability_hint'));
  else q5.push(t('owner.q5.none'));
  lines.push(...q5);

  return { plain_summary: lines.join('\n'), owner_decisions: q5 };
}
