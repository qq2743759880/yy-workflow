// C-R7 change.record driver — R5b UI form direction change (host plugin page).
// File-based probe (no node -e inline), per project discipline.
import { recordChange } from '../../../scripts/lib/change.mjs';
import crypto from 'node:crypto';

const WS = 'D:/.ai-hub/skills/yy';

// G2.2 §2 normative edge table (rows 1-21, verbatim)
const edges = [
  ['G2.2', 'R1'], ['R1', 'R2'], ['R2', 'R3'], ['R3', 'R4'], ['R4', 'R5a'],
  ['R5a', 'UI-GA'], ['UI-GA', 'R5b'], ['R4', 'R7'], ['R4', 'R8'],
  ['R2', 'R9'], ['R3', 'R9'], ['R4', 'R9'], ['R5b', 'R9'],
  ['R3', 'R10'], ['R4', 'R10'], ['R8', 'R10'],
  ['R5b', 'R6'], ['R7', 'R6'], ['R8', 'R6'], ['R9', 'R6'], ['R10', 'R6'],
].map(([from, to]) => ({ from, to }));

const basePlan = 'contracts/C-R5-ui.md';
const baseVersion = '421ecfc4bfc2861d4187be76ecd67ec184f55d9aa1d239cdb04acb8e82dafa1a';
const instrFile = 'test-reports/change-record-r5ui-host-plugin-20260917/owner-instruction.md';
const instrSha = 'b70bcd4c1cce3b15abfbf8d95db75fd2757cd87613fded9004801584b8569610';
const g22Sha = '91b5d72939bcb5c64d377282c04cf16b15c47ca3631df2eaac0938d71ad4ca21';

const receipt = {
  approvalId: 'apr-' + new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z') + '-' + crypto.randomBytes(4).toString('hex'),
  target: { scope: 'change', scopeId: basePlan + '@' + baseVersion + ':CONTRACT' },
  approvedBy: 'owner',
  approvedAt: new Date().toISOString(),
  approvalEvidence: instrFile + '#' + instrSha,
  expiresAt: null,
  relatedReceipts: [],
};

const input = {
  basePlan,
  baseVersion,
  reason: 'Owner direction change (2026-09-17): R5b UI form changes from independent static page to host plugin page (verbatim: "要做成宿主插件页而非独立静态页；改方向再走 C-R7 变更流程"). Touches frozen contract C-R5-ui normative content (U-A=b data-channel decision; R5b non-goals excluding host/Bridge integration) and G2.2 R5b node non-goals; judged CONTRACT per OQ-R7-4=A (strictest class when both contract and graph/docs are touched).',
  impactClass: 'CONTRACT',
  owner: 'Owner',
  sourceEvidence: [
    instrFile + '#' + instrSha,
    basePlan + '#' + baseVersion,
    'plans/tasks/G2.2-task-graph-20260911.md#' + g22Sha + ' (R5b node non-goals: no React/new Bridge pre-gate)',
    'ambient observation 2026-09-17 (non-authoritative): in-app browser crashed loading docs/preview/journey-control-room-preview-20260917.html',
  ],
  ownerApprovalReceipt: receipt,
};

const res = await recordChange(input, {
  workspace: WS,
  sessionId: null,
  recordedBy: 'orchestrator',
  dependencies: edges,
  readyBefore: ['R5b'],
  primaryNodes: ['R5b'],
});

console.log(JSON.stringify(res, null, 2));
if (!res.ok) process.exitCode = 1;