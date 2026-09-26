// E2E-v3 S4 legacy 对照断言器（只读，消费 E2E 真实 CLI 产物 + W2-1 基线快照）。
// 断言：
//   A1 双跑 state.json 挥发字段归一后字节级全等（字段集稳定性——无任何 capability 字样漏入）；
//   A2 legacy 子任务键集 ⊆ 冻结 16 字段 ∪ 既有 runtime 执行态键（mode/adapter/eligibility/error/recovery/
//      assetConsumed/missingCaps/scanTarget——全部为 W2 之前既有行为，含 AV-3 name-based eligibility）；
//   A3 S4(legacy) 与 S1c(capability) 子任务键集差 == 契约追加字段集 {capability, capabilitySource, selectedAsset}；
//   A4 当前 buildPlan(legacy 任务) 与 W2-1 基线 planner（改造前逐字快照）输出归一后字节级全等。
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const VOLATILE = [
  [/plan-[a-z0-9]+/g, 'plan-<ts>'],
  [/"createdAt":\s*"[^"]*"/g, '"createdAt":"<ts>"'],
  [/"frozenAt":\s*"[^"]*"/g, '"frozenAt":"<ts>"'],
  [/"checkedAt":\s*"[^"]*"/g, '"checkedAt":"<ts>"'],
  [/"request_id":\s*"[^"]*"/g, '"request_id":"<rid>"'],
];

function normalize(text) { for (const [re, to] of VOLATILE) text = text.replace(re, to); return text; }

const s1 = fs.readFileSync(path.join(here, 's4-run1-state.json'), 'utf8');
const s2 = fs.readFileSync(path.join(here, 's4-run2-state.json'), 'utf8');
const n1 = normalize(s1); const n2 = normalize(s2);
console.log('A1 double-run normalized byte-equal:', n1 === n2);
if (n1 !== n2) {
  const l1 = n1.split('\n'); const l2 = n2.split('\n');
  for (let i = 0; i < Math.max(l1.length, l2.length); i += 1) if (l1[i] !== l2[i]) { console.log('first diff line', i, '\n<', l1[i], '\n>', l2[i]); break; }
}

const FROZEN_16 = ['id', 'planId', 'asset', 'contract', 'status', 'artifactPath', 'attempts', 'phase', 'dependsOn', 'desc', 'estimate', 'lane', 'approved', 'preconditions', 'task', 'contractMode'];
const PREEXISTING_RUNTIME_KEYS = ['mode', 'adapter', 'error', 'recovery', 'eligibility', 'assetConsumed', 'missingCaps', 'scanTarget', 'assetConsumedEvidence'];
const doc = JSON.parse(s1);
const legacyKeySets = new Set(doc.subtasks.map((st) => Object.keys(st).sort().join(',')));
const legacyUnion = new Set([...legacyKeySets].flatMap((ks) => ks.split(',')));
const foreign = [...legacyUnion].filter((k) => !FROZEN_16.includes(k) && !PREEXISTING_RUNTIME_KEYS.includes(k));
console.log('A2 legacy subtask observed key sets:');
for (const ks of legacyKeySets) console.log('   ', ks);
console.log('A2 declared-but-undefined (JSON 丢弃):', JSON.stringify(FROZEN_16.filter((k) => !legacyUnion.has(k))));
console.log('A2 foreign keys (既非冻结16也非既有runtime键):', JSON.stringify(foreign));

const cap = JSON.parse(fs.readFileSync(path.join(here, '../s1b-derived-chain/s1c-state.json'), 'utf8'));
const capKeys = new Set(cap.subtasks.flatMap((st) => Object.keys(st)));
const added = [...capKeys].filter((k) => !legacyUnion.has(k));
const removed = [...legacyUnion].filter((k) => !capKeys.has(k));
console.log('A3 capability-added keys:', JSON.stringify(added.sort()), '| removed keys:', JSON.stringify(removed.sort()));

const { buildPlan } = await import(pathToFileURL(path.resolve(here, '../../../../scripts/lib/planner.mjs')).href);
const baselineModule = await import(pathToFileURL(path.resolve(here, '../../W2-1/baseline-planner.snapshot.mjs')).href);
const manifest = { entries: ['implementation', 'be-validator', 'sdlc', 'security', 'review', 'frontend-design', 'planning', 'dev-planner', 'skill-sentinel'].map((name) => ({ name })) };
const tasks = ['前端页面重构', '数据库 schema 迁移', '运维部署监控', '知识库模型接入'];
let a4All = true;
for (const t of tasks) {
  const a = JSON.parse(JSON.stringify(buildPlan(t, manifest)));
  const b = JSON.parse(JSON.stringify(baselineModule.buildPlan(t, manifest)));
  const na = normalize(JSON.stringify(a)); const nb = normalize(JSON.stringify(b));
  const eq = na === nb;
  a4All = a4All && eq;
  console.log('A4 buildPlan normalized byte-equal vs baseline:', eq, '|', t);
  if (!eq) { console.log('  cur:', na.slice(0, 400)); console.log('  base:', nb.slice(0, 400)); }
}
console.log('A4 all tasks byte-equal:', a4All);
