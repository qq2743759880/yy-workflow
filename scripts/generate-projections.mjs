#!/usr/bin/env node
/**
 * generate-projections.mjs — capability/cluster 投影唯一生成器（B-P0-03-REWORK1，可复现、确定性）。
 *
 * 双模式（Compatibility Contract 冻结方向：V3 canonical → generators → old consumers）：
 *
 *   --mode baseline（默认，当前纪元）
 *     投影 = 冻结兼容基线：直接 import scripts/lib/activation.mjs CAPABILITY_MAP +
 *     scripts/lib/matrix.mjs CLUSTERS（单一 taxonomy 事实源，禁复制第二份），
 *     逐字节 exact-parity 落盘。生命周期 = GENERATED /
 *     EXACT_PARITY_COMPATIBILITY_BASELINE——它是兼容性 parity 权威产物，但绝不宣称
 *     语义内容已由已接受的 V3 真相生成（当前无任何 ACCEPTED+CANONICAL 契约）。
 *     同时机扫 contracts/v3 生命周期态入账（gate 状态消费），任一契约字节变化都会
 *     改变投影 digest（A 契约变化确定性地改变 B 投影）。
 *
 *   --mode v3（未来纪元）
 *     投影从 contracts/v3/*.contract-v3.yaml 推导。fail-closed 门：
 *       V3_AUTHORITY_NOT_READY  任一契约 lifecycle != ACCEPTED+CANONICAL
 *       CAPABILITY_KEY_UNREGISTERED      契约宣称的 key 不在 CAPABILITY_MAP 受控词表
 *       CAPABILITY_OWNERSHIP_CONFLICT    同一 key 被多个契约宣称（排他性）
 *       ASSET_CONTRACT_DRIFT             V3 推导结果与冻结基线不一致（需 signed
 *                                        routing semantic change 才允许演化，
 *                                        当前无签署通道 → 一律 fail-closed）
 *
 * 确定性纪律：产物无时间戳等易变字段；同输入同字节同 digest（sha256，canonical JSON）。
 *   node scripts/generate-projections.mjs [--mode baseline|v3] [--out <file>|-] [--check]
 *   --check：内存重生成并与已落盘产物逐字节比对，不一致 → PROJECTION_DRIFT（exit 3）。
 * 退出码：0 成功；2 生成失败（parity/门检查）；3 投影漂移。
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { CAPABILITY_MAP } from './lib/activation.mjs';
import { CLUSTERS } from './lib/matrix.mjs';
import { loadAllContractsV3, isV3Authoritative } from './lib/contract-v3.mjs';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const DEFAULT_CONTRACTS = path.join(ROOT, 'contracts', 'v3');
const DEFAULT_OUT = path.join(ROOT, 'contracts', 'generated', 'capability-map-projection.json');

function sha256(data) {
  return crypto.createHash('sha256').update(data).digest('hex');
}

function fail(code, message) {
  console.error(`GENERATE_FAIL ${code}: ${message}`);
  process.exit(2);
}

/** 基线结构断言（exact-parity 回归内建：10 keys / 5 clusters）。 */
function baselineShape(map, clusters) {
  const keys = Object.keys(map);
  if (keys.length !== 10) fail('CAPABILITY_MAP_SHAPE', `CAPABILITY_MAP 必须恰好 10 键，实际 ${keys.length}`);
  if (clusters.length !== 5) fail('CLUSTERS_SHAPE', `CLUSTERS 必须恰好 5 簇，实际 ${clusters.length}`);
  const assets = new Set(clusters.flatMap((c) => c.candidates));
  for (const [key, asset] of Object.entries(map)) {
    if (!assets.has(asset)) fail('CAPABILITY_MAP_SHAPE', `CAPABILITY_MAP['${key}']='${asset}' 不在任何簇 candidates 内`);
  }
}

/** 从 V3 契约推导投影（v3 模式）；任何偏差 fail-closed。 */
function deriveFromV3(contracts, baseline) {
  const unready = contracts.filter((c) => !isV3Authoritative(c.doc));
  if (unready.length) {
    fail('V3_AUTHORITY_NOT_READY', '以下契约不具备 ACCEPTED+CANONICAL 生命周期，不得生成生产 V3 投影: '
      + unready.map((c) => `${c.id}(${c.doc.lifecycle ? c.doc.lifecycle.status : 'NO_LIFECYCLE'}/${c.doc.lifecycle ? c.doc.lifecycle.authority : 'NO_AUTHORITY'})`).join(', '));
  }
  const owner = {};
  const claimClusters = {};
  for (const c of contracts) {
    const routing = c.doc.routing || {};
    for (const key of routing.capability_keys || []) {
      if (!(key in baseline.map)) fail('CAPABILITY_KEY_UNREGISTERED', `${c.id} 宣称未注册 capability key '${key}'（受控词表=CAPABILITY_MAP，新增须追加登记）`);
      if (owner[key]) fail('CAPABILITY_OWNERSHIP_CONFLICT', `capability '${key}' 被 ${owner[key]} 与 ${c.id} 同时宣称（排他性所有权）`);
      owner[key] = c.id;
    }
    claimClusters[c.id] = routing.clusters || [];
  }
  const map = {};
  for (const [key, asset] of Object.entries(baseline.map)) {
    if (owner[key] && owner[key] !== asset) fail('ASSET_CONTRACT_DRIFT', `capability '${key}' V3 属主=${owner[key]}，基线属主=${asset}（routing 语义变更需 signed change，当前无签署通道）`);
    map[key] = asset;
  }
  const clusters = {};
  for (const cluster of baseline.clusters) {
    const derived = cluster.candidates.filter((asset) => (claimClusters[asset] || []).includes(cluster.id));
    const missing = cluster.candidates.filter((asset) => !derived.includes(asset));
    if (derived.length !== cluster.candidates.length) {
      fail('ASSET_CONTRACT_DRIFT', `cluster '${cluster.id}' V3 派生 candidates [${derived.join(',')}] ≠ 基线 [${cluster.candidates.join(',')}]（缺员: ${missing.join(',')}）——routing 语义变更需 signed change`);
    }
    clusters[cluster.id] = { candidates: derived };
  }
  return { map, clusters };
}

async function main() {
  const args = process.argv.slice(2);
  const mode = args.includes('--mode') ? args[args.indexOf('--mode') + 1] : 'baseline';
  if (mode !== 'baseline' && mode !== 'v3') fail('BAD_ARGS', '--mode 只支持 baseline|v3');
  const outArg = args.includes('--out') ? args[args.indexOf('--out') + 1] : DEFAULT_OUT;
  const check = args.includes('--check');
  const contractsDir = args.includes('--contracts-dir') ? args[args.indexOf('--contracts-dir') + 1] : DEFAULT_CONTRACTS;

  // 消费 V3 生命周期态（gate 状态入账；字节 hash 使契约变化确定性传导进投影 digest）
  let contracts = [];
  try {
    contracts = await loadAllContractsV3(contractsDir);
  } catch (error) {
    fail('CONTRACT_READ', error.message);
  }
  const v3Inputs = {};
  for (const c of contracts) {
    v3Inputs[c.id] = { file: 'contracts/v3/' + path.basename(c.file), sha256: sha256(await fs.readFile(c.file, 'utf8')), lifecycle_status: c.doc.lifecycle ? c.doc.lifecycle.status : 'MISSING' };
  }

  const baseline = {
    map: { ...CAPABILITY_MAP },
    clusters: CLUSTERS.map((c) => ({ id: c.id, candidates: [...c.candidates] })),
  };
  baselineShape(baseline.map, baseline.clusters);

  let projection;
  if (mode === 'baseline') {
    projection = {
      schema: 'yy/capability-map-projection@1',
      mode: 'EXACT_PARITY_COMPATIBILITY_BASELINE',
      generated_from: {
        capability_map: 'scripts/lib/activation.mjs CAPABILITY_MAP（受控映射，逐字精确保留）',
        clusters: 'scripts/lib/matrix.mjs CLUSTERS（簇成员与序，逐字精确保留）',
      },
      exact_parity_note: '本投影是兼容性 parity 权威产物：CAPABILITY_MAP 10 键 + CLUSTERS 5 簇逐字节等值。当前不存在 ACCEPTED+CANONICAL V3 契约，故语义内容不宣称来自已接受的 V3 真相；V3 契约字节/生命周期变化仅作为 gate 状态入账并传导 digest。',
      inputs: {
        module_hashes: {
          'scripts/lib/activation.mjs': sha256(await fs.readFile(path.join(ROOT, 'scripts', 'lib', 'activation.mjs'), 'utf8')),
          'scripts/lib/matrix.mjs': sha256(await fs.readFile(path.join(ROOT, 'scripts', 'lib', 'matrix.mjs'), 'utf8')),
        },
        v3_lifecycle_state: v3Inputs,
      },
      map: baseline.map,
      clusters: Object.fromEntries(baseline.clusters.map((c) => [c.id, { candidates: c.candidates }])),
      lifecycle: {
        status: 'GENERATED',
        authority: 'CANONICAL_PARITY_ARTIFACT',
        completeness: 'EXACT_PARITY_COMPATIBILITY_BASELINE',
        note: '兼容基线纪元产物；v3 权威模式需全部契约 ACCEPTED+CANONICAL 且与基线零漂移（generate-projections.mjs --mode v3）。',
      },
    };
  } else {
    const derived = deriveFromV3(contracts, baseline);
    projection = {
      schema: 'yy/capability-map-projection@1',
      mode: 'V3_AUTHORITATIVE',
      generated_from: { contracts: 'contracts/v3/*.contract-v3.yaml（全部 ACCEPTED+CANONICAL，与冻结基线零漂移）' },
      exact_parity_note: 'V3 推导结果与冻结兼容基线逐键等值（ASSET_CONTRACT_DRIFT 门通过）；此后基线演化必须经 signed routing semantic change。',
      inputs: { v3_contracts: v3Inputs },
      map: derived.map,
      clusters: derived.clusters,
      lifecycle: {
        status: 'GENERATED',
        authority: 'CANONICAL_PROJECTION',
        completeness: 'V3_AUTHORITATIVE_ZERO_DRIFT',
        note: 'V3 权威纪元产物；每次契约变更后必须重新生成并过 --check。',
      },
    };
  }

  // 自引用防环：digest 覆盖除 projection_digest 外的全部内容（canonical 序列化）
  const digestInput = JSON.stringify(projection, (key, value) => (key === 'projection_digest' ? undefined : value));
  const digest = sha256(digestInput);
  const finalProjection = { ...projection, projection_digest: digest };
  const outBytes = JSON.stringify(finalProjection, null, 2) + '\n';

  if (check) {
    let existing = null;
    try {
      existing = await fs.readFile(outArg, 'utf8');
    } catch (error) {
      console.error(`PROJECTION_DRIFT: 产物不存在或不可读: ${outArg}`);
      process.exit(3);
    }
    if (existing !== outBytes) {
      console.error(`PROJECTION_DRIFT: 重新生成字节与已落盘产物不一致（expected digest ${digest}）——契约/基线变化后未重新生成，运行 generate-projections.mjs 落盘`);
      process.exit(3);
    }
    console.log(`PROJECTION_CHECK_OK ${digest} mode=${mode}`);
    return;
  }

  if (outArg === '-') {
    process.stdout.write(outBytes);
  } else {
    await fs.mkdir(path.dirname(outArg), { recursive: true });
    await fs.writeFile(outArg, outBytes);
    console.log(`PROJECTION_WRITTEN ${outArg} digest=${digest} mode=${mode} map_keys=${Object.keys(baseline.map).length} clusters=${baseline.clusters.length}`);
  }
}

main().catch((error) => fail('UNEXPECTED', error && error.stack ? error.stack : String(error)));
