/**
 * _helper.mjs — R3 重建探针共用工具（行为探针，非产品代码）。
 *
 * 沙箱纪律：一切写入限制在 run-probes.mjs 分配的 .sandbox/<pNN>/ 下；
 * 仓库真实 vendor/ 仅只读（copyAsset 只读源字节）；断言失败收集后由 run() 返回。
 */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { activationPrepare, renderBrief } from '../../../../scripts/lib/activation.mjs';
import { receiptAppend } from '../../../../scripts/lib/receipt.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
/** 仓库真实 vendor（只读引用；probes/ → R3 → rebuild → test-reports → 仓库根） */
export const REPO_VENDOR = path.resolve(HERE, '..', '..', '..', '..', 'vendor');

export function sha256File(file) {
  return crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
}

export function sha256Text(text) {
  return crypto.createHash('sha256').update(String(text), 'utf8').digest('hex');
}

/** 递归目录指纹（vendor 零写入断言用：相对路径 + 字节 sha256）。 */
export function dirFingerprint(dir) {
  const out = [];
  const walk = (d, rel) => {
    for (const e of fs.readdirSync(d, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
      const abs = path.join(d, e.name);
      const relName = (rel ? rel + '/' : '') + e.name;
      if (e.isDirectory()) walk(abs, relName);
      else out.push(relName + ':' + sha256File(abs));
    }
  };
  if (fs.existsSync(dir)) walk(dir, '');
  return out.join('|');
}

/** 断言收集器。 */
export function createChecks() {
  const checks = [];
  return {
    check(name, cond, detail) {
      checks.push({ name, ok: Boolean(cond), detail: detail ?? '' });
      return Boolean(cond);
    },
    all() { return checks; },
    passed() { return checks.every((c) => c.ok); },
  };
}

/** 从仓库真实 vendor 只读拷贝一个资产到沙箱 vendor（skill 取 SKILL.md，agent 取 <id>.md）。 */
export function copyAsset(sandboxVendor, assetId, opts = {}) {
  const dir = path.join(sandboxVendor, assetId);
  fs.mkdirSync(dir, { recursive: true });
  const skill = path.join(REPO_VENDOR, assetId, 'SKILL.md');
  const agent = path.join(REPO_VENDOR, assetId, assetId + '.md');
  if (fs.existsSync(skill)) fs.copyFileSync(skill, path.join(dir, 'SKILL.md'));
  else if (fs.existsSync(agent)) fs.copyFileSync(agent, path.join(dir, assetId + '.md'));
  else throw new Error('repo vendor missing asset: ' + assetId);
  if (opts.withReference) {
    const refDir = path.join(REPO_VENDOR, assetId, 'reference');
    if (fs.existsSync(refDir)) fs.cpSync(refDir, path.join(dir, 'reference'), { recursive: true });
  }
  return dir;
}

/**
 * 固定时钟（T7 收尾批⑤ 去时钟依赖加固）。
 *
 * 背景：T5T6 独立验收记录过 1 次未复现的 15/16 波动（P2-3）。本批把探针内一切
 * prepare/append 调用的 `now` 固定注入为同一常量，时间敏感断言不再依赖真实时钟
 * （跨秒/跨天边界、机器时间漂移、时区差异都无法再改变探针结果）。
 * 显式传入 opts.now 的探针（如 p15）保持自己的注入值——本包装仅在 `now === undefined` 时填充。
 */
let FIXED_NOW = new Date('2026-09-20T00:00:00.000Z');
export function setFixedNow(d) { FIXED_NOW = (d instanceof Date) ? d : new Date(d); return FIXED_NOW; }
export function fixedNow() { return FIXED_NOW; }

/** activation.prepare 快捷封装（固定时钟注入）。 */
export function prepare(input) {
  const opts = Object.assign({}, input && input.opts);
  if (opts.now === undefined) opts.now = FIXED_NOW;
  return activationPrepare(Object.assign({}, input, { opts }));
}

/** 渲染 brief 并写出（模拟适配器投递步骤——T4 触发条件，§7.2）；返回 {briefPath, briefText}。 */
export function deliverBrief(sandbox, subtaskId, activationPackage) {
  const dir = path.join(sandbox, 'artifacts', subtaskId);
  fs.mkdirSync(dir, { recursive: true });
  const briefText = renderBrief(activationPackage.briefFrame);
  fs.writeFileSync(path.join(dir, 'brief.md'), briefText);
  return { briefPath: 'brief.md', briefText, dir };
}

/**
 * 组一条正向事件（T1-T5）。sourceHash 取自 activationPackage.record。
 * 行为验证（behavior_verified）不在此列——由探针显式构造（谓词组输入）。
 */
export function makeEvent(activationPackage, subtaskId, transition, evidence, idempotencyKey) {
  return {
    transition,
    subtaskId,
    assetId: activationPackage.record.assetId,
    sourceHash: activationPackage.record.sourceHash,
    session: 'probe-session',
    idempotencyKey,
    evidence,
  };
}

/** receipt.append 快捷封装（固定时钟注入；T1-T6 事件 recordedAt 不再随真实时钟漂移）。 */
export function append(event, opts) {
  const o = Object.assign({}, opts);
  if (o.now === undefined) o.now = FIXED_NOW;
  return receiptAppend({ event, opts: o });
}

/**
 * 全链 T1-T5 快捷路径（正向到 execution_observed）。
 * artifactText: T5 产物内容；artifactName: 产物文件名（默认 output.md）。
 * extraT4: 追加到 T4 evidence 的 additive 键（如 deliveryStatus/anchor/kernelTokens）。
 * 返回 {responses, package: activationPackage, artifactRel}。
 */
export function runForwardChain(sandbox, vendorDir, activationPackage, subtaskId, artifactText, opts = {}) {
  const pkg = activationPackage;
  const { briefPath } = deliverBrief(sandbox, subtaskId, pkg);
  const artifactName = opts.artifactName ?? 'output.md';
  const artifactRel = artifactName;
  const dir = path.join(sandbox, 'artifacts', subtaskId);
  fs.writeFileSync(path.join(dir, artifactName), artifactText);
  const T4Evidence = {
    activationLevel: pkg.record.activationLevel,
    payloadSha256: pkg.payload.payloadSha256,
    briefPath,
    sourceHashEcho: pkg.record.sourceHash,
    budgetResult: { action: 'block', exceeded: false },
    ...opts.extraT4,
  };
  const events = [
    makeEvent(pkg, subtaskId, 'discovered', { catalogCacheIdentity: 'probe-catalog-identity', sourceHash: pkg.record.sourceHash }, subtaskId + '-t1'),
    makeEvent(pkg, subtaskId, 'eligible', { phaseEligibility: { eligible: true, reason: 'probe projection', phase: 0 } }, subtaskId + '-t2'),
    makeEvent(pkg, subtaskId, 'selected', { planId: 'probe-plan', subtaskId, sourceHash: pkg.record.sourceHash }, subtaskId + '-t3'),
    makeEvent(pkg, subtaskId, 'instructions_delivered', T4Evidence, subtaskId + '-t4'),
    makeEvent(pkg, subtaskId, 'execution_observed', {
      artifactPath: artifactRel,
      artifactSha256: sha256Text(artifactText),
      executed: true,
    }, subtaskId + '-t5'),
  ];
  const responses = [];
  for (const ev of events) responses.push(append(ev, { workspace: sandbox, vendorDir }));
  return { responses, pkg, artifactRel, artifactText, briefPath };
}

/** 典型 genuine 产物（正向控制）：anchor + 首个内核词 + 随机 nonce 实质新内容（保证 P4 剩余非空）。 */
export function genuineArtifact(pkg, subtaskId) {
  const nonce = crypto.randomBytes(8).toString('hex');
  const anchor = pkg.record.anchor;
  const kernel = (pkg.record.kernelTokens ?? [])[0] ?? '';
  return [
    '# ' + anchor + ' — applied',
    '',
    kernel ? 'Kernel anchor used: ' + kernel : '',
    '',
    'Task deliverable decision ' + nonce + ': adopt bounded scope for ' + subtaskId + '; verification notes recorded ' + crypto.randomBytes(6).toString('hex') + '.',
    'This paragraph is fresh analysis written for this subtask only; it quotes no methodology sentence verbatim ' + crypto.randomBytes(4).toString('hex') + '.',
  ].filter((l) => l !== '').join('\n');
}

/** 标准探针 run 包装：收集 checks → {ok, summary}。 */
export function finish(checks, summaryPrefix) {
  const failed = checks.all().filter((c) => !c.ok);
  const summary = summaryPrefix + (failed.length
    ? ' | FAILED: ' + failed.map((f) => f.name + (f.detail ? '(' + f.detail + ')' : '')).join('; ').slice(0, 400)
    : ' | ' + checks.all().length + ' checks PASS');
  return { ok: failed.length === 0, summary };
}
