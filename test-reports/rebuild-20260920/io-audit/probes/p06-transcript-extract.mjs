/**
 * p06 — transcript 采集验证：
 *   计入：Read 工具读 vendor、shell cat 读 vendor、read_file 读 vendor；
 *   排除：ls 列目录、manifest 扫描块（罗列 16 资产）、非 vendor 路径。
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildRecords } from '../../../../scripts/asset-io-transcript.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, '..', '..', '..', '..');

export async function run({ sandbox }) {
  const fixture = path.join(sandbox, 'fixture.jsonl');
  const manifestBlock = 'vendor/agent-research/ vendor/agent-vision-toolkit/ vendor/be-architect/ vendor/be-provider/ vendor/be-resilience/ vendor/be-validator/ vendor/colorize/ vendor/dev-planner/ vendor/frontend-design/ vendor/frontend-visual-validation/ vendor/implementation/ vendor/planning/ vendor/review/ vendor/sdlc/ vendor/security/ vendor/skill-sentinel/';
  const entries = [
    { ts: '2026-09-20T00:00:01Z', kind: 'tool_call', tool: 'Read', arguments: { file_path: '$SKILL_DIR/vendor/implementation/implementation.md' } },
    { ts: '2026-09-20T00:00:02Z', kind: 'shell', command: 'cat vendor/planning/planning.md' },
    { ts: '2026-09-20T00:00:03Z', kind: 'shell', command: 'ls vendor/' }, // 列目录 → 排除
    { ts: '2026-09-20T00:00:04Z', kind: 'tool_result', content: '资产清单: ' + manifestBlock }, // manifest 扫描 → 排除
    { ts: '2026-09-20T00:00:05Z', kind: 'tool_call', tool: 'read_file', arguments: { path: 'vendor/security/security.md' } },
    { ts: '2026-09-20T00:00:06Z', kind: 'tool_call', tool: 'Read', arguments: { file_path: 'package.json' } }, // 非 vendor → 不计
  ];
  fs.writeFileSync(fixture, entries.map((e) => JSON.stringify(e)).join('\n') + '\n', 'utf8');

  const recs = buildRecords(entries, REPO);
  const assets = recs.map((r) => r.path.split('/vendor/')[1].split('/')[0]).sort();
  const ops = recs.map((r) => r.op);
  const allConsumption = recs.every((r) => r.tag === 'consumption');

  const ok = recs.length === 3 &&
    JSON.stringify(assets) === JSON.stringify(['implementation', 'planning', 'security']) &&
    allConsumption &&
    !recs.some((r) => r.path.endsWith('/package.json'));

  return {
    ok,
    summary: `采集 ${recs.length} 条 assets=[${assets.join(',')}] ops=[${ops.join(',')}] 全consumption=${allConsumption}`,
  };
}
