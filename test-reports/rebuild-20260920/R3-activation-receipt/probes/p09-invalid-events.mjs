/**
 * p09 — 契约 §7.2/§7.3/§3.4/§7.6：receipt 事件违约面（防伪）。
 * 枚举外 transition / 跳步跃迁 / 必需 evidence 缺失 / eventSeq 断裂 / 手改事件或 result 缓存
 * （canonicalHash 防手改）/ 必含不变量缺失 / T5 产物白名单 / subtaskId 路径穿越 ⇒ 全部拒收且文件不变。
 */
import fs from 'node:fs';
import path from 'node:path';
import { copyAsset, prepare, deliverBrief, makeEvent, append, createChecks, finish, sha256Text } from './_helper.mjs';
import { receiptAppend } from '../../../../scripts/lib/receipt.mjs';

export async function run({ sandbox }) {
  const checks = createChecks();
  const vendorDir = path.join(sandbox, 'vendor');
  copyAsset(vendorDir, 'colorize');

  const p = await prepare({ asset: 'colorize', activationLevel: 'body', subtask: { id: 'r3-09-st' }, opts: { vendorDir } });
  const pkg = p.data.activationPackage;
  const H = pkg.record.sourceHash;
  const ev = (transition, evidence, key, over = {}) => ({ ...makeEvent(pkg, 'r3-09-st', transition, evidence, key), ...over });
  const file = path.join(sandbox, 'artifacts', 'r3-09-st', 'receipt.json');
  const snapshot = () => (fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : '');

  // (1) transition 枚举外
  let r = append(ev('teleported', { x: 1 }, 'k1'), { workspace: sandbox, vendorDir });
  checks.check('(1) transition 枚举外 ⇒ RECEIPT_INVALID（文件不变）', r.ok === false && r.code === 'RECEIPT_INVALID' && snapshot() === '');

  // (2) 必含不变量缺失（session / idempotencyKey / sourceHash 形状）
  r = append(ev('discovered', { catalogCacheIdentity: 'c', sourceHash: H }, 'k2', { session: '' }), { workspace: sandbox, vendorDir });
  checks.check('(2a) session 缺失 ⇒ RECEIPT_INVALID', r.ok === false && r.code === 'RECEIPT_INVALID');
  r = append(ev('discovered', { catalogCacheIdentity: 'c', sourceHash: H }, 'k2', { idempotencyKey: '' }), { workspace: sandbox, vendorDir });
  checks.check('(2b) idempotencyKey 缺失 ⇒ RECEIPT_INVALID', r.ok === false && r.code === 'RECEIPT_INVALID');
  r = append(ev('discovered', { catalogCacheIdentity: 'c', sourceHash: H }, 'k2', { sourceHash: 'deadbeef' }), { workspace: sandbox, vendorDir });
  checks.check('(2c) sourceHash 非 sha256 hex ⇒ RECEIPT_INVALID', r.ok === false && r.code === 'RECEIPT_INVALID');

  // (3) 必需 evidence 缺失（§7.3 discovered 需 catalogCacheIdentity+sourceHash）
  r = append(ev('discovered', { sourceHash: H }, 'k3'), { workspace: sandbox, vendorDir });
  checks.check('(3) evidence 缺 catalogCacheIdentity ⇒ RECEIPT_INCOMPLETE', r.ok === false && r.code === 'RECEIPT_INCOMPLETE');

  // T1 正常落定，作为后续跃迁基底
  r = append(ev('discovered', { catalogCacheIdentity: 'cid', sourceHash: H }, 'k4'), { workspace: sandbox, vendorDir });
  checks.check('(4) T1 正常追加', r.ok === true);
  const afterT1 = snapshot();

  // (5) 跳步：discovered → selected（§7.2 禁止跳步）
  r = append(ev('selected', { planId: 'pl', subtaskId: 'r3-09-st', sourceHash: H }, 'k5'), { workspace: sandbox, vendorDir });
  checks.check('(5) 跳步 discovered→selected ⇒ RECEIPT_INVALID（文件不变）', r.ok === false && r.code === 'RECEIPT_INVALID' && snapshot() === afterT1);

  // (6) T2 evidence.eligible=false ⇒ 拒绝登记 eligible 事件
  r = append(ev('eligible', { phaseEligibility: { eligible: false, reason: 'not yet', phase: 0 } }, 'k6'), { workspace: sandbox, vendorDir });
  checks.check('(6) eligible:false ⇒ RECEIPT_INCOMPLETE（不得登记 eligible）', r.ok === false && r.code === 'RECEIPT_INCOMPLETE');

  // (7) T5 产物白名单（后缀/排除项/空文件/hash 不一致）——先推进到 selected+T4
  append(ev('eligible', { phaseEligibility: { eligible: true, reason: 'ok', phase: 0 } }, 'k7'), { workspace: sandbox, vendorDir });
  append(ev('selected', { planId: 'pl', subtaskId: 'r3-09-st', sourceHash: H }, 'k8'), { workspace: sandbox, vendorDir });
  deliverBrief(sandbox, 'r3-09-st', pkg);
  const t4ev = { activationLevel: 'body', payloadSha256: pkg.payload.payloadSha256, briefPath: 'brief.md', sourceHashEcho: H, budgetResult: { action: 'block' } };
  r = append(ev('instructions_delivered', { ...t4ev, sourceHashEcho: 'f'.repeat(64) }, 'k9'), { workspace: sandbox, vendorDir });
  checks.check('(7a) T4 sourceHashEcho ≠ T1 ⇒ RECEIPT_HASH_MISMATCH（§7.3 T4 谓词 (a)）', r.ok === false && r.code === 'RECEIPT_HASH_MISMATCH');
  r = append(ev('instructions_delivered', { ...t4ev, payloadSha256: sha256Text('其他字节') }, 'k9b'), { workspace: sandbox, vendorDir });
  checks.check('(7b) T4 payloadSha256 ≠ brief 段内 payload ⇒ RECEIPT_INCOMPLETE（谓词 (b)）', r.ok === false && r.code === 'RECEIPT_INCOMPLETE');
  r = append(ev('instructions_delivered', t4ev, 'k9c'), { workspace: sandbox, vendorDir });
  checks.check('(7c) T4 正常追加', r.ok === true);

  r = append(ev('execution_observed', { artifactPath: 'junk.tmp', artifactSha256: sha256Text('x'), executed: true }, 'k10'), { workspace: sandbox, vendorDir });
  checks.check('(7d) T5 产物后缀白名单外 ⇒ RECEIPT_INCOMPLETE', r.ok === false && r.code === 'RECEIPT_INCOMPLETE');
  r = append(ev('execution_observed', { artifactPath: 'result.txt', artifactSha256: sha256Text('x'), executed: true }, 'k11'), { workspace: sandbox, vendorDir });
  checks.check('(7e) T5 产物 = result.txt（现状排除项）⇒ RECEIPT_INCOMPLETE', r.ok === false && r.code === 'RECEIPT_INCOMPLETE');
  r = append(ev('execution_observed', { artifactPath: 'brief.md', artifactSha256: sha256Text('x'), executed: true }, 'k12'), { workspace: sandbox, vendorDir });
  checks.check('(7f) T5 产物 = brief.md（现状排除项）⇒ RECEIPT_INCOMPLETE', r.ok === false && r.code === 'RECEIPT_INCOMPLETE');
  fs.writeFileSync(path.join(sandbox, 'artifacts', 'r3-09-st', 'out.md'), '');
  r = append(ev('execution_observed', { artifactPath: 'out.md', artifactSha256: sha256Text(''), executed: true }, 'k13'), { workspace: sandbox, vendorDir });
  checks.check('(7g) T5 产物空文件 ⇒ RECEIPT_INCOMPLETE', r.ok === false && r.code === 'RECEIPT_INCOMPLETE');
  fs.writeFileSync(path.join(sandbox, 'artifacts', 'r3-09-st', 'out.md'), 'real content ' + 'z'.repeat(40));
  r = append(ev('execution_observed', { artifactPath: 'out.md', artifactSha256: sha256Text('different'), executed: true }, 'k14'), { workspace: sandbox, vendorDir });
  checks.check('(7h) T5 artifactSha256 不符 ⇒ RECEIPT_INCOMPLETE', r.ok === false && r.code === 'RECEIPT_INCOMPLETE');
  r = append(ev('execution_observed', { artifactPath: 'out.md', artifactSha256: sha256Text('real content ' + 'z'.repeat(40)), executed: 'yes' }, 'k15'), { workspace: sandbox, vendorDir });
  checks.check('(7i) executed !== true ⇒ RECEIPT_INCOMPLETE（宿主失败不得记 T5）', r.ok === false && r.code === 'RECEIPT_INCOMPLETE');

  // (8) subtaskId 路径穿越
  r = receiptAppend({ event: { transition: 'discovered', subtaskId: '../escape', assetId: 'colorize', sourceHash: H, session: 's', idempotencyKey: 'k16', evidence: { catalogCacheIdentity: 'c', sourceHash: H } }, opts: { workspace: sandbox, vendorDir } });
  checks.check('(8) subtaskId 路径穿越 ⇒ RECEIPT_INVALID', r.ok === false && r.code === 'RECEIPT_INVALID');
  checks.check('(8b) 未在沙箱外产生文件', !fs.existsSync(path.join(sandbox, 'artifacts', 'escape')));

  // (9) 手改 receipt.json（result 缓存 / 事件证据 / eventSeq 断裂）⇒ canonicalHash/重放防伪
  append(ev('execution_observed', { artifactPath: 'out.md', artifactSha256: sha256Text('real content ' + 'z'.repeat(40)), executed: true }, 'k17'), { workspace: sandbox, vendorDir });
  const good = JSON.parse(fs.readFileSync(file, 'utf8'));
  const tampered1 = JSON.parse(JSON.stringify(good));
  tampered1.result = { result: 'VERIFIED' };
  fs.writeFileSync(file, JSON.stringify(tampered1, null, 2));
  r = append(ev('eligible', { phaseEligibility: { eligible: true, reason: 'x', phase: 0 } }, 'k18'), { workspace: sandbox, vendorDir });
  checks.check('(9a) 手改 result 缓存 ⇒ RECEIPT_INVALID（canonicalHash 防手改 + 重放不一致）', r.ok === false && r.code === 'RECEIPT_INVALID');
  const tampered2 = JSON.parse(JSON.stringify(good));
  tampered2.events[0].evidence.catalogCacheIdentity = 'hand-edited';
  fs.writeFileSync(file, JSON.stringify(tampered2, null, 2));
  r = append(ev('eligible', { phaseEligibility: { eligible: true, reason: 'x', phase: 0 } }, 'k19'), { workspace: sandbox, vendorDir });
  checks.check('(9b) 手改事件 evidence ⇒ RECEIPT_INVALID（canonicalHash 不一致）', r.ok === false && r.code === 'RECEIPT_INVALID');
  const tampered3 = JSON.parse(JSON.stringify(good));
  tampered3.events[0].eventSeq = 7; // 断裂
  delete tampered3.canonicalHash;
  fs.writeFileSync(file, JSON.stringify(tampered3, null, 2));
  r = append(ev('eligible', { phaseEligibility: { eligible: true, reason: 'x', phase: 0 } }, 'k20'), { workspace: sandbox, vendorDir });
  checks.check('(9c) eventSeq 断裂 ⇒ RECEIPT_INVALID（§7.6 连续性是完整性校验的一部分）', r.ok === false && r.code === 'RECEIPT_INVALID');

  return finish(checks, 'p09 事件违约面：枚举/跳步/证据/白名单/穿越/手改 receipt 全部拒收');
}
