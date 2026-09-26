// SECMAN-1 change.record 类别判定 + fail-closed 探针（不落盘越权面）
import { recordChange } from '../../../scripts/lib/change.mjs';
const WS = 'D:/.ai-hub/skills/yy';
const touched = ['contracts/manifest-sources/security.yaml'];
// ① 声明 CONTRACT 且无 Owner receipt → 期望 CHANGE_OWNER_REQUIRED（fail-closed，不落盘）
const r1 = await recordChange({
  basePlan: 'contracts/asset-manifest-v2.md',
  baseVersion: 'c30fee6b4d1a8130af8536df9b45342c78667eaebaad172d0dac767e471f25d1',
  reason: 'SECMAN-1: security sidecar when_not_to_use 由 F-011 旧口径修为 F-019 真实语义',
  impactClass: 'CONTRACT',
  owner: 'Owner',
  sourceEvidence: ['handoffs/v3/SECMAN-1-dispatch.md', 'contracts/manifest-sources/security.yaml#' + require_hash()],
  touchedFiles: touched,
}, { workspace: WS, recordedBy: 'SECMAN-1-L1-exec', primaryNodes: ['security-sidecar-when_not_to_use'] });
console.log('① CONTRACT no-receipt →', r1.ok, r1.code);
console.log('   reason:', (r1.data && r1.data.reason) || '');
function require_hash() { return 'sha256-of-sidecar-after'; }
