#!/usr/bin/env node
/**
 * S15 注入反例测试（AS-1 自测 3，handoffs/v3/AS-1-dispatch.md）：
 * 六断言各自注入反例（临时造孤儿引用 / 引擎缺席 / 孤儿 sidecar / drop 资产复活 / 记录篡改）
 * → 期望对应 S15-Ax 段 FAIL 具名 → 还原现场 → 复验还原（现场还原=true）。
 *
 * 注入面全部为临时文件 / 临时改名 / 临时内容翻转（os 层面），每个注入跑完后立即还原并机验还原；
 * 复验手段：文件 sha256 前后一致 / 存在性翻转回原态。本脚本自身不修改任何仓库活面文件（临时注入除外）。
 *
 * 用法：node test-reports/autopilot-work/AS-1/s15-injection-test.mjs
 * 退出码：0 = 全部注入按预期 FAIL 且现场还原；1 = 有注入未按预期（假绿风险，阻断）。
 */
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const results = [];
function record(id, ok, detail) { results.push({ id, ok, detail }); console.log((ok ? 'PASS ' : 'FAIL ') + id + '  ' + detail); }
const sha256 = (f) => crypto.createHash('sha256').update(fs.readFileSync(f)).digest('hex');

/** 跑一轮全量回归，返回合并输出。 */
function runRegression(envOverride) {
  const env = envOverride ? Object.assign({}, process.env, envOverride) : process.env;
  const r = spawnSync(process.execPath, ['scripts/regression-all.mjs'], { cwd: ROOT, encoding: 'utf8', timeout: 600000, env });
  return ((r.stdout || '') + '\n' + (r.stderr || ''));
}
const findLine = (out, prefix) => out.split('\n').find((l) => l.startsWith(prefix)) || '';

// ─────────────────────────────────────────────────────────────
// INJ-1 → S15-A1：治理活面造孤儿引用（scripts/ 临时 .md 含 drop 资产名）
// 期望：S15-A1 FAIL，具名 DROP_REF_HIT 且含注入文件名
// ─────────────────────────────────────────────────────────────
{
  const probe = path.join(ROOT, 'scripts', 's15-orphan-ref-probe.tmp.md');
  fs.writeFileSync(probe, 'orphan reference probe: be-architect\n');
  const out = runRegression();
  const failLine = findLine(out, 'FAIL S15-A1');
  const named = failLine.includes('DROP_REF_HIT') && failLine.includes('s15-orphan-ref-probe.tmp.md') && failLine.includes('be-architect');
  fs.rmSync(probe, { force: true });
  const restored = !fs.existsSync(probe);
  record('INJ-1 A1 孤儿引用', Boolean(named) && restored,
    (named ? 'A1 FAIL 具名: ' + failLine.trim().slice(0, 120) + '…' : '未捕获具名 FAIL: ' + (failLine.trim() || out.slice(0, 120))) + ' | 现场还原=' + restored);
}

// ─────────────────────────────────────────────────────────────
// INJ-2 → S15-A2 + S15-A5：三引擎全部缺席（PATH 剥离 + spectral 本地 shim 临时改名）
// 期望：S15-A2 FAIL（三探针全 FAIL 具名）；S15-A5 FAIL（semgrep 缺席）
// ─────────────────────────────────────────────────────────────
{
  const spectralCmd = path.join(ROOT, 'node_modules', '.bin', 'spectral.cmd');
  const spectralBak = spectralCmd + '.s15inj-bak';
  const hadSpectral = fs.existsSync(spectralCmd);
  if (hadSpectral) fs.renameSync(spectralCmd, spectralBak);
  try {
    const out = runRegression({ PATH: path.join(process.env.SystemRoot || 'C:\\Windows', 'System32') });
    const a2 = findLine(out, 'FAIL S15-A2');
    const a2Named = a2.includes('be-validator/spectral: FAIL') && a2.includes('security/semgrep: FAIL') && a2.includes('skill-sentinel/skill-scanner: FAIL');
    const a5 = findLine(out, 'FAIL S15-A5');
    const a5Named = a5.includes('FAIL');
    record('INJ-2 A2+A5 引擎缺席', Boolean(a2Named) && Boolean(a5Named),
      (a2Named ? 'A2 FAIL 具名（三探针）' : 'A2 未捕获: ' + (a2.trim() || '无') ) + ' | ' + (a5Named ? 'A5 FAIL 具名' : 'A5 未捕获: ' + (a5.trim() || '无')));
  } finally {
    if (hadSpectral && fs.existsSync(spectralBak)) fs.renameSync(spectralBak, spectralCmd);
  }
  const restored = hadSpectral ? fs.existsSync(spectralCmd) && !fs.existsSync(spectralBak) : true;
  record('INJ-2 现场还原（spectral shim）', restored, restored ? 'spectral.cmd 复原在位' : 'spectral.cmd 未复原——必须人工修复');
}

// ─────────────────────────────────────────────────────────────
// INJ-3 → S15-A3：孤儿 sidecar（不在 CLUSTERS 权威清单）→ manifest-build fail-closed 拒产
// 期望：S15-A3 FAIL（manifest-build FAIL）；manifest 产物保持原 sha256（拒绝半成品不落盘）
// ─────────────────────────────────────────────────────────────
{
  const manifestPath = path.join(ROOT, 'contracts', 'asset-manifest-v2.json');
  const before = sha256(manifestPath);
  const orphan = path.join(ROOT, 'contracts', 'manifest-sources', '__s15-orphan-probe.yaml');
  fs.writeFileSync(orphan, 'id: __s15-orphan-probe\nwhen_to_use:\n  - injection probe\nwhen_not_to_use:\n  - injection probe\nverification: probe\nsource: vendor/implementation/implementation.md#L1-L2\ndrop_pending: false\ndrop_allowed: false\n');
  const out = runRegression();
  const a3 = findLine(out, 'FAIL S15-A3');
  const named = a3.includes('FAIL') && (out.includes('CANDIDATE_INVALID') || out.includes('manifest-build'));
  fs.rmSync(orphan, { force: true });
  const after = sha256(manifestPath);
  const intact = before === after;
  record('INJ-3 A3 孤儿 sidecar', Boolean(named) && intact,
    (named ? 'A3 FAIL 具名（manifest-build fail-closed）' : '未捕获: ' + (a3.trim() || '无')) + ' | manifest 产物 sha256 未被污染=' + intact);
}

// ─────────────────────────────────────────────────────────────
// INJ-4 → S15-A4：drop 资产复活（重建 vendor/be-architect/be-architect.md）
// 期望：S15-A4 FAIL，具名 leak=be-architect（旧 loader 输出含复活资产）
// ─────────────────────────────────────────────────────────────
{
  const dir = path.join(ROOT, 'vendor', 'be-architect');
  const file = path.join(dir, 'be-architect.md');
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(file, '# be-architect（S15 注入探针：模拟 drop 资产复活）\n');
  const out = runRegression();
  const a4 = findLine(out, 'FAIL S15-A4');
  const named = a4.includes('leak=be-architect');
  fs.rmSync(dir, { recursive: true, force: true });
  const restored = !fs.existsSync(dir);
  record('INJ-4 A4 drop 资产复活', Boolean(named) && restored,
    (named ? 'A4 FAIL 具名: ' + a4.trim().slice(0, 130) + '…' : '未捕获: ' + (a4.trim() || '无')) + ' | 现场还原=' + restored);
}

// ─────────────────────────────────────────────────────────────
// INJ-5 → S15-A6：迁移记录篡改（current_state PRIMARY→TAMPERED）
// 期望：S15-A6 FAIL 具名（回放终态 ≠ 记录终态）；还原后 sha256 与原值一致
// ─────────────────────────────────────────────────────────────
{
  const recPath = path.join(ROOT, 'test-reports', 'autopilot-work', 'AS-2-sentinel', 'migration-record.json');
  const before = sha256(recPath);
  const raw = fs.readFileSync(recPath, 'utf8');
  fs.writeFileSync(recPath, raw.replace('"current_state": "PRIMARY"', '"current_state": "PRIMARY-TAMPERED"'));
  const out = runRegression();
  const a6 = findLine(out, 'FAIL S15-A6');
  const named = a6.includes('回放终态 FAIL') || a6.includes('FAIL');
  fs.writeFileSync(recPath, raw);
  const after = sha256(recPath);
  const restored = before === after;
  record('INJ-5 A6 记录篡改', Boolean(named) && restored,
    (named ? 'A6 FAIL 具名: ' + a6.trim().slice(0, 130) + '…' : '未捕获: ' + (a6.trim() || '无')) + ' | 记录还原 sha256 一致=' + restored);
}

console.log('\n结果: ' + results.filter((r) => r.ok).length + ' PASS / ' + results.filter((r) => !r.ok).length + ' FAIL');
if (results.some((r) => !r.ok)) process.exit(1);
console.log('S15 注入反例全部按预期 FAIL 具名，现场全部还原。');
