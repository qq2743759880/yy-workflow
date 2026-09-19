/**
 * p07 — JOURNEY_INVALID fail-closed（§5.1/§5.3 + §3.3）。
 * 可机验行为：journey.json JSON 畸形 / journey 形状畸形（steps 非数组）/ session id 非法
 * （白名单 [A-Za-z0-9_-]+，消费 [R4冻结] §2.1）/ mode 非枚举 / workspace 缺失 ⇒
 * ok=false + JOURNEY_INVALID，fail-closed 不渲染成功；两操作同规则。
 */
import fs from 'node:fs';
import path from 'node:path';

export async function run({ sandbox }) {
  const m = await import(new URL('../../../../scripts/lib/journey.mjs', import.meta.url).href);
  const tt = path.join(sandbox, '.tt-state');
  fs.mkdirSync(tt, { recursive: true });

  // (1) journey.json JSON 畸形 → read fail-closed INVALID
  fs.writeFileSync(path.join(tt, 'journey.json'), '{broken json');
  const r1 = m.journey.read({ workspace: sandbox });
  const badJson = r1.ok === false && r1.code === 'JOURNEY_INVALID' && (r1.data.reason || '').includes('journey.json');

  // (2) journey 形状畸形（steps 非数组）→ INVALID
  fs.writeFileSync(path.join(tt, 'journey.json'), JSON.stringify({ schema: 'yy/journey@1', steps: 'nine' }));
  const r2 = m.journey.read({ workspace: sandbox });
  const badShape = r2.ok === false && r2.code === 'JOURNEY_INVALID';

  // (3) session 非法（路径穿越尝试）→ 两操作均 INVALID
  fs.writeFileSync(path.join(tt, 'journey.json'), JSON.stringify({ schema: 'yy/journey@1', steps: [] }));
  const r3 = m.journey.read({ workspace: sandbox, session: '../evil' });
  const p3 = m.journey.project({ workspace: sandbox, session: '..\\win' });
  const sessionBad = r3.code === 'JOURNEY_INVALID' && p3.code === 'JOURNEY_INVALID'
    && (r3.data.reason || '').includes('[A-Za-z0-9_-]+');
  // 且未在沙箱外落任何路径（fail-closed 先于一切 IO 写）
  const noEscape = !fs.existsSync(path.join(sandbox, '.tt-state', 'evil'));

  // (4) mode 非枚举 → INVALID（OQ-R5-4=A）
  const r4 = m.journey.read({ workspace: sandbox, mode: 'everything' });
  const modeBad = r4.code === 'JOURNEY_INVALID' && (r4.data.reason || '').includes('summary|full');

  // (5) workspace 缺失 → INVALID
  const r5 = m.journey.read({});
  const wsBad = r5.code === 'JOURNEY_INVALID';

  // 合法 journey.json 在场时 read 正常（上面写入的 steps:[] 空记录可读）
  const r6 = m.journey.read({ workspace: sandbox });
  const validStillReads = r6.ok === true || r6.code === 'JOURNEY_STALE';

  const ok = badJson && badShape && sessionBad && noEscape && modeBad && wsBad && validStillReads;
  return { ok, summary: `INVALID: json=${badJson} shape=${badShape} session=${sessionBad}(无逃逸=${noEscape}) mode=${modeBad} ws=${wsBad} 合法仍可读=${validStillReads}` };
}
