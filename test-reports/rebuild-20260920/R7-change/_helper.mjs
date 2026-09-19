/**
 * _helper.mjs — R7 探针共享夹具：G2.2 §2 规范 edge 表（幸存实物 record-change.mjs 同源逐字）、
 * 沙箱 workspace 构造、Owner 指令文件物化（逐字节复现实物 b70bcd4c… 哈希）、断言计数器。
 */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

/** G2.2 §2 normative edge table（rows 1-21，逐字；同 test-reports/change-record-r5ui-host-plugin-20260917/record-change.mjs） */
export const EDGES = [
  ['G2.2', 'R1'], ['R1', 'R2'], ['R2', 'R3'], ['R3', 'R4'], ['R4', 'R5a'],
  ['R5a', 'UI-GA'], ['UI-GA', 'R5b'], ['R4', 'R7'], ['R4', 'R8'],
  ['R2', 'R9'], ['R3', 'R9'], ['R4', 'R9'], ['R5b', 'R9'],
  ['R3', 'R10'], ['R4', 'R10'], ['R8', 'R10'],
  ['R5b', 'R6'], ['R7', 'R6'], ['R8', 'R6'], ['R9', 'R6'], ['R10', 'R6'],
].map(([from, to]) => ({ from, to }));

/** 幸存实物 Owner 指令全文（逐字；写出后 sha256 = b70bcd4c…，无尾随换行——实物哈希已复现验证） */
export const GOLDEN_INSTRUCTION = `# Owner Instruction — R5b UI form direction change

Source: Owner chat message, 2026-09-17 (Asia/Shanghai).

Verbatim:

> 要做成宿主插件页而非独立静态页

> 改方向再走 C-R7 变更流程

Context note (orchestrator): instruction followed the delivery of
\`docs/preview/journey-control-room-preview-20260917.html\` (independent static preview page)
and an observed in-app browser crash when opening that static page.
This file materializes the Owner instruction so it can be hash-pinned as
approvalEvidence / sourceEvidence for a C-R7 change.record call.`;

export const GOLDEN_INSTRUCTION_SHA = 'b70bcd4c1cce3b15abfbf8d95db75fd2757cd87613fded9004801584b8569610';

/** 幸存实物 change.record 输入的幂等键（REPORT.md §1 逐字；OQ-R7-6=A canonical 口径的 golden 值） */
export const GOLDEN_IDEMPOTENCY_KEY = '3b244b29528d18641e8e20b50e750b0fcc1520c4d8599e102f0c9e081afd2292';

export const GOLDEN_REASON = 'Owner direction change (2026-09-17): R5b UI form changes from independent static page to host plugin page (verbatim: "要做成宿主插件页而非独立静态页；改方向再走 C-R7 变更流程"). Touches frozen contract C-R5-ui normative content (U-A=b data-channel decision; R5b non-goals excluding host/Bridge integration) and G2.2 R5b node non-goals; judged CONTRACT per OQ-R7-4=A (strictest class when both contract and graph/docs are touched).';

export const GOLDEN_BASE_PLAN = 'contracts/C-R5-ui.md';
export const GOLDEN_BASE_VERSION = '421ecfc4bfc2861d4187be76ecd67ec184f55d9aa1d239cdb04acb8e82dafa1a';

/** 沙箱 workspace：指令文件物化在 workspace 根（receipt approvalEvidence 可验），返回句柄与哈希 */
export function mkWorkspace(sandbox, instructionBody = GOLDEN_INSTRUCTION, instrName = 'owner-instruction.md') {
  fs.mkdirSync(sandbox, { recursive: true });
  const instrPath = path.join(sandbox, instrName);
  fs.writeFileSync(instrPath, instructionBody, 'utf8');
  const instrSha = crypto.createHash('sha256').update(fs.readFileSync(instrPath)).digest('hex');
  return { workspace: sandbox, instrFile: instrName, instrSha };
}

/** C-R4 §5.2 形 owner approval receipt（消费 schema 八字段——含 reason，即实物驱动"修正后成功"形态；
 * scopeId 绑定 plan@version:class）。overrides 可覆盖任意字段（含置 undefined 以构造缺字段形态）。 */
export function buildReceipt({ instrFile, instrSha, basePlan, baseVersion, impactClass, approvedAt, overrides = {} }) {
  return {
    approvalId: 'apr-20260917T035212Z-5ecf4e46',
    target: { scope: 'change', scopeId: `${basePlan}@${baseVersion}:${impactClass}` },
    reason: 'Owner 批准（C-R4 §5.2 schema；实物 REPORT.md §1：首跑缺 reason fail-closed，补齐后成功）',
    approvedBy: 'owner',
    approvedAt,
    approvalEvidence: `${instrFile}#${instrSha}`,
    expiresAt: null,
    relatedReceipts: [],
    ...overrides,
  };
}

/** 断言收集器：t.ok(cond, name) 计数；done(summary) 汇总 */
export function makeT() {
  const out = { pass: 0, fail: 0, failures: [] };
  out.ok = (cond, name) => {
    if (cond) out.pass += 1;
    else { out.fail += 1; out.failures.push(name); }
    return Boolean(cond);
  };
  out.eq = (actual, expected, name) => out.ok(JSON.stringify(actual) === JSON.stringify(expected), `${name} (actual=${JSON.stringify(actual)} expected=${JSON.stringify(expected)})`);
  return out;
}

/** 探针侧独立重算幂等键（与模块实现互为对照：固定键序字面 JSON 的 sha256） */
export function canonicalKeyOf(basePlan, baseVersion, reason, impactClass, owner) {
  return crypto.createHash('sha256').update(Buffer.from(JSON.stringify({ basePlan, baseVersion, reason, impactClass, owner }), 'utf8')).digest('hex');
}

export function finish(t, summary) {
  const ok = t.fail === 0;
  return { ok, summary: `${summary} | ${t.pass}/${t.pass + t.fail} 断言通过${t.fail ? '；失败: ' + t.failures.join('; ') : ''}` };
}
