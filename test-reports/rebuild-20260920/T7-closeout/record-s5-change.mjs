#!/usr/bin/env node
/**
 * record-s5-change.mjs — T7 收尾批① 的 change.record 驱动（file-based，无 node -e 内联）。
 *
 * 登记对象：S5「P0 未清零」口径由 ⬜-only 改为严格口径（⬜ 与 ◐ 都算未清零）——
 * 依据 `plans/decision-s5-p0-semantics-20260920.md`（Owner 2026-09-20 授权编排者裁决）。
 *
 * 语义变更而非缺陷修复：S5 行为被多份验收报告引用过，改行为必须走 C-R7 正规流程
 * （裁决文档「违反自家变更纪律」条）。impactClass=CONTRACT（C-R4-control 定义了 CI 段序与
 * truth 分类，本次改动正落在其规范性内容上；"统一 CONTRACT 类"由派单 ① 指定）。
 *
 * grandfathering：历史 ACCEPTED 报告（M1-M3 / R6 / 12-12 PASS 等）按**取得时口径**（⬜-only）
 * 有效，不因新口径追溯作废——声明写入记录的 reason 正文（记录 schema 无独立正文栏位）。
 *
 * owner approval receipt 口径（如实申报，见 T7-closeout/RESULTS.md 偏差表）：
 *   - approvedBy='owner'（[R4冻结] §5.2 schema 唯一合法值）；
 *   - approvalEvidence = 裁决文档路径#SHA256（Owner 授权记录的唯一可抵赖载体，字节可验）；
 *   - approvedAt = 该裁决文档落盘时刻（文档落盘时间戳，非事后编造）；
 *   - 本驱动只做"把 Owner 授权记录物化为 receipt"的机械动作，不新增任何批准意图。
 */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { recordChange } from '../../../scripts/lib/change.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const WS = path.resolve(HERE, '..', '..', '..');

const sha256 = (rel) => crypto.createHash('sha256').update(fs.readFileSync(path.join(WS, rel))).digest('hex');

const DECISION = 'plans/decision-s5-p0-semantics-20260920.md';
const BASE_PLAN = 'contracts/C-R4-control.md';       // 定义 CI 段序/truth 分类的冻结契约
const decisionSha = sha256(DECISION);
const baseVersion = sha256(BASE_PLAN);
const approvedAt = fs.statSync(path.join(WS, DECISION)).mtime.toISOString(); // 裁决文档落盘时刻（真实）

const receipt = {
  approvalId: 'apr-' + approvedAt.replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z') + '-' + crypto.randomBytes(4).toString('hex'),
  target: { scope: 'change', scopeId: BASE_PLAN + '@' + baseVersion + ':CONTRACT' },
  reason: 'Owner 2026-09-20 授权编排者裁决 S5 P0 未清零口径；裁决文档实施项 1-2 明确走 change.record 登记本语义变更（含 grandfathering 声明）',
  approvedBy: 'owner',
  approvedAt,
  approvalEvidence: DECISION + '#' + decisionSha,
  expiresAt: null,
  relatedReceipts: [],
};

const input = {
  basePlan: BASE_PLAN,
  baseVersion,
  reason: [
    'S5「P0 未清零」口径语义变更（⬜-only → 严格口径 ⬜+◐），依据 ' + DECISION + '（Owner 2026-09-20 授权编排者裁决，选择 2 统一严格口径）。',
    '动机：S5 与 orchestrator.backlogIsPending 两处 open-P0 口径不一致，同一 tracker 下 ci 报 PASS、orchestrator 报 pending，证据链出现裂缝；且 ◐ 永久漏洞使"修一半弃坑"与"修完"在记录上不可区分。',
    '落地：OPEN_P0_PATTERN 常量化（lib/ci.mjs 单点定义，ci.mjs / orchestrator 共同引用，杜绝第三次分叉）+ ◐ 证据卫生规则（无落点/收据引用按 ⬜ 处理，计数不变、分类进 warnings）。',
    'GRANDFATHERING 声明：历史 ACCEPTED 报告（M1-M3、R6、12/12 PASS 等）按取得时口径（⬜-only）有效，不因本口径追溯作废；本记录登记语义变更，非缺陷修复。',
    'CI 检查点纪律：CI 在验收/发布检查点运行，非持续灯——严格口径下进行中的 P0 会让 S5 常红，故该纪律成文化。',
  ].join(' '),
  impactClass: 'CONTRACT',
  owner: 'Owner',
  sourceEvidence: [
    DECISION + '#' + decisionSha,
    BASE_PLAN + '#' + baseVersion,
    'plans/critique-backlog-tracker.md#' + sha256('plans/critique-backlog-tracker.md') + ' (S5 判定对象：P0 行状态语义)',
  ],
  touchedFiles: ['scripts/lib/ci.mjs', 'scripts/ci.mjs', 'scripts/lib/orchestrator.mjs'],
  ownerApprovalReceipt: receipt,
};

const res = await recordChange(input, {
  workspace: WS,
  sessionId: null,
  recordedBy: 'T7-closeout',
  dependencies: [],
  readyBefore: ['S5'],
  primaryNodes: ['S5'],
});

console.log(JSON.stringify(res, null, 2));
if (!res.ok) process.exitCode = 1;
