import fs from 'node:fs';
const FILE = 'plans/audit-index-20260925.md';
let s = fs.readFileSync(FILE, 'utf8');
const nl = s.includes('\r\n') ? '\r\n' : '\n';
const lines = s.split(nl);
const idx1 = lines.findIndex((l) => l.startsWith('| C-1 |'));
const idx2 = lines.findIndex((l) => l.startsWith('| C-2 |'));
if (idx1 < 0 || idx2 < 0) { console.error('C-1/C-2 rows not found'); process.exit(1); }
const c1 = lines[idx1];
const c2 = lines[idx2];
lines.splice(Math.max(idx1, idx2), 1);
lines.splice(Math.min(idx1, idx2), 1);
s = lines.join(nl);

const D1 = '| D-1 | REMEDIATION-2 S16 三段重做（废除 HARDEN-1 旧 S16 文本身份匹配——三段真实拒绝路径探针：Runtime plane 真实状态机 / Migration plane 三失败形态生产 authority / Cross-plane receipt 终态门） | `test-reports/autopilot-work/REMEDIATION-2/s16-1-runtime-plane.json`；`test-reports/autopilot-work/REMEDIATION-2/s16-2-migration-plane.json`；`test-reports/autopilot-work/REMEDIATION-2/s16-3-cross-plane.json`；`test-reports/autopilot-work/REMEDIATION-2/RESULTS.md`（§二 F-028） | `grep -o "all_terminal_rejections[^,]*" test-reports/autopilot-work/REMEDIATION-2/s16-1-runtime-plane.json && grep -o "three_shapes_detected[^,]*" test-reports/autopilot-work/REMEDIATION-2/s16-2-migration-plane.json && grep -o "failed_unresolved_invalid_blocked[^,}]*" test-reports/autopilot-work/REMEDIATION-2/s16-3-cross-plane.json` |';
const D2 = '| D-2 | migration.mjs 生产 migration authority（GOV-AUTHORITY 任务一：五合法转移+三失败形态硬拒绝+promotion evidence 校验内化；S16-2/3 test oracle 删除改调用生产模块；AS-2 三张已 PRIMARY migration-record 回放放行） | `scripts/lib/migration.mjs`；`test-reports/autopilot-work/GOV-AUTHORITY/selftest-migration.json`（自测证据） | `node --input-type=module -e "const m=await import(\'./scripts/lib/migration.mjs\');console.log(\'legal_edges=\'+Object.keys(m.LEGAL_TRANSITIONS).length,\'shapes=\'+m.FAILURE_SHAPES.join(\'/\'))"` |';
const D3 = '| D-3 | before_final_receipt 生产发射点（GOV-AUTHORITY 任务二 F-035：review 类子任务 brief 注入 verification-before-completion，生产 orchestrator 路径可达；implementation 类仍注 TDD 不受影响） | `scripts/orchestrator.mjs`（before_final_receipt 注入点）；`test-reports/autopilot-work/GOV-AUTHORITY/probe-before-final-receipt-result.json`（all_pass） | `node -e "const j=require(\'./test-reports/autopilot-work/GOV-AUTHORITY/probe-before-final-receipt-result.json\');console.log(\'all_pass=\'+j.all_pass, \'verification_assets=\'+JSON.stringify(j.checks.verification_assets_with_verification_body))"` |';
const D4 = '| D-4 | canonical 签收字段统一（GOV-AUTHORITY 任务三 F-033/F-034：canonical=ownerApprovalReceipt.status 单点；六张 SIGNED 单 ownerSignOff 删除；g0v3cons1 voided + r2 CONTRACT+PENDING_OWNER_RECEIPT） | `scripts/lib/signoff-canonical.mjs`；`contracts/discrepancies/cr-20260926T010000Z-g0v3cons1-r2.json`；`test-reports/autopilot-work/GOV-AUTHORITY/selftest-canonical.json` | `node -e "const r2=require(\'./contracts/discrepancies/cr-20260926T010000Z-g0v3cons1-r2.json\');const v=require(\'./contracts/discrepancies/cr-20260926T000000Z-g0v3cons1.json\');console.log(\'r2=\'+r2.impactClass+\'/\'+r2.ownerApprovalReceipt.status, \'voided=\'+v.voided)"` |';

const tail = [
  '',
  '## 六、current 新增行（第十五审计 GOV-AUTHORITY 登记，2026-09-26）【current 节】',
  '',
  '| # | finding | 证据文件路径 | 复验命令一行 |',
  '|---|---|---|---|',
  D1,
  D2,
  D3,
  D4,
  '',
  '## 七、historical 节（旧版 S16 证据——F-038 分节，2026-09-26）【historical——current=false，selftest 只查路径存在不查 freshness】',
  '',
  '> **superseded_by: REMEDIATION-2 S16 三段**（`test-reports/autopilot-work/REMEDIATION-2/s16-1-runtime-plane.json` + `s16-2-migration-plane.json` + `s16-3-cross-plane.json`，见 §六 D-1）。旧版 S16（HARDEN-1 文本身份匹配两断言）已被 REMEDIATION-2 F-028 整段废除（`scripts/regression-all.mjs` 头注废除声明在案）——下列两行证据仅为当时执行留痕，不再是当前 S16 语义的权威指针（current=false）。selftest 对本节只断言证据路径存在（不查 sha256/命令 freshness——历史留痕面不强制新鲜）。'.replace(/`test-reports/g, '`test-reports'),
  '',
  '| # | finding | 证据文件路径 | 复验命令一行 |',
  '|---|---|---|---|',
  c1,
  c2,
  '',
].join(nl);
fs.writeFileSync(FILE, s + tail);
console.log('C-1/C-2 moved to historical section 7; current D rows added');
