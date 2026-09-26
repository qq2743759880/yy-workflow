#!/usr/bin/env node
/**
 * TT 一键回归卡点（BE-16 / task05）。
 * 顺序执行各断言段，任一 FAIL → exit 1。
 *
 * 段：
 *   S1 validate-structure        —— 结构/9 资产/接口漂移/可移植性/U+FFFD（完整）
 *   S2 test-retry                —— P3 超时与重试回归（完整）
 *   S3 Phase 2 替换清单占位校验   —— 预埋：3 个高杠杆资产的适配器接线 + vendor 存在性 + 内核 marker 漂移门（见下）
 *   S4 契约工作流 smoke           —— 契约冻结（BE-13）：contracts/<planId>.json 生成 + resume 复用
 *   S5 宿主执行 smoke             —— 宿主执行（BE-14）：--exec 真实输出 → mode=exec；空输出 → mode=prompt 降级
 *   S6 资产缓存 smoke             —— 资产正文缓存（BE-15）：缓存文件生成 + 二次运行复用
 *   S7 review-gate self-test      —— 批判能力代码级闸门（有效批判≥3/URL+日期/tracker）
 *   S8 资产消费证据（D-1）        —— 锚点 + 内核词双断言（exec 全 true；仅锚点 → assetConsumed=false）
 *   S9 域声明机验（C-27）         —— test-domain-declared：false→DOMAIN_DECL_MISSING / true→ok / 旧数据→N/A
 *   S10 token 量尺 gate（B0-②）   —— token-audit --gate：快照对比，token 回退 ≥10% → FAIL（C-30 收尾口径）
 *   S11 引用链机验（C-25/C-33）    —— owner-review-linkcheck：templates/owner-review 文件级引用悬空 → FAIL 具名；tab 损坏残留（\t emplates/）→ FAIL 具名
 *   S12 kickoff 漂移门（C-26）     —— kickoff-drift-check：kickoff 五簇资产清单 vs matrix.mjs CLUSTERS 双向 diff，静默漂移 → FAIL 具名
 *   S13 junction 部署形态 smoke    —— junction 在场 → 真实执行 4 入口探针（复用 test-reports/fix-20260921/junction-smoke.mjs）；缺失 → SKIP（不进 PASS/FAIL，exit 0）
 *                                    探测路径可被环境变量 TT_JUNCTION_PROBE_PATH 覆盖（HARD-1 无 junction 模拟手段，生产勿设）。
 *   S14 preflight invariants      —— preflight.mjs（v3 批 1 B1-GATE）：语法门/导出查重/ADAPTERS 一致性/
 *                                    CLUSTERS↔磁盘/buildManifest 单源/DROP_ALLOWED/change-lock 核查，
 *                                    任一 FAIL 即 regression FAIL（详见 scripts/preflight.mjs 头注）。
 *   S15 migration invariants      —— AS-1 实装（2026-09-25）：六断言——A1 drop 资产引用 0 命中 /
 *                                    A2 replace 资产真实消费探针（spectral/semgrep/skill-scanner）/
 *                                    A3 manifest 驱动路由断言（Gate-2 三方 hash + eligible 9 true/7 false）/
 *                                    A4 legacy loader 不可达 / A5 真实执行≠能力覆盖（模式 1）/
 *                                    A6 correction≠作废（模式 2）。任一 FAIL → regression FAIL。
 *   S16 failed state cannot promote —— REMEDIATION-2（2026-09-26，第十四审计 F-028 重做，废除 HARDEN-1 旧版）。
 *                                    重做缘由（原两断言废除声明）：旧 S16-1/S16-2 验的是错误身份域——
 *                                    ①asset-migration 六态无 failed（migration_object.status==='failed'
 *                                    不是契约词汇）；②runtime promotionReceipt 字段无真实生产者（恒 undefined）；
 *                                    ③change receipt 身份域是 cr-/apr- 不是 plan-id——failed 身份 ids 与
 *                                    SIGNED receipt 文本 include 匹配两套 ID 本不相引，"零违例"恒真（vacuous）。
 *                                    新 S16 = 三段真实拒绝路径探针（全部走机验器真实代码路径，非文本匹配）：
 *                                    S16-1 Runtime plane（phase.transition 真实状态机——完整链走到 failed 后
 *                                    failed→done/executing/reviewing 须 INVALID_TRANSITION 拒绝且 canonical
 *                                    state 不变；mech 主链自然 failed 形态佐证）；S16-2 Migration plane（三失败
 *                                    形态真实机验器：shadow FAIL=真实 spectral 缺陷夹具 pass=false /
 *                                    rollback FAIL=SPECTRAL_NOT_AVAILABLE 无旗标拒绝 / runtime_binding FAIL=
 *                                    假 spectral SPECTRAL_OUTPUT_INVALID——三形态喂给生产 migration.mjs authority（scripts/lib/migration.mjs——本批新建生产模块，
 *                                    探针内自造 promote()/validatePromotionEvidence() test oracle 删除），
 *                                    SHADOW→MIGRATING 与 MIGRATING→PRIMARY 按 playbook Failure Rules 经生产
 *                                    transition()/promote() 硬拒绝（MIGRATION_BLOCKED:<形态>）；promotion
 *                                    evidence 校验=生产 validatePromotionEvidence（负终态→behavior_verified
 *                                    拒绝）；AS-2 三张已 PRIMARY migration-record 经生产 replayTransitions
 *                                    回放放行（兼容性证明）。S16-3 Cross-plane（migration promotionReceipt
 *                                    生成处校验=生产 migration.mjs validatePromotionEvidence 单点——sourceEvidence 引用 execution receipt 终态 FAILED/UNRESOLVED
 *                                    阻断 promotion；cross-plane 注入：状态层 done+receipt 层 FAILED →
 *                                    planning→executing 被 receiptCoverage 校验拒绝）。
 *                                    证据落 test-reports/autopilot-work/REMEDIATION-2/。任一 FAIL → regression FAIL。
 *   S17 九场景兼容与负向矩阵       —— W2-3（2026-09-27，Ingress Mini-Contract D.5）：capability ingress 九场景
 *                                    逐一走生产函数机验（buildPlan/applyCapabilityToPlan/deriveCapability/
 *                                    resolveAssetEligibility/dispatch/executePlan/governanceFor，禁自造 oracle——
 *                                    判定函数只核对生产产物上的具名码/具名留痕，不复刻资格语义）：
 *                                    ①capability only→解析+执行 ②asset only→legacy 零改动 ③capability+matching
 *                                    asset→双写 selectedAsset ④capability+conflicting asset→非静默取一（生产现状
 *                                    =capability 为准重绑定+双重具名留痕；D.5 具名 skip 码缺口 D-W23-1 登记）
 *                                    ⑤unknown capability→INELIGIBLE_CAPABILITY_UNKNOWN skip（runtime）+
 *                                    CAPABILITY_UNKNOWN throw（planner）⑥ineligible selected asset→既有资格门
 *                                    INELIGIBLE_WHEN_NOT_TO_USE ⑦dropped selected asset→既有 drop 检查
 *                                    （ASSET_NOT_FOUND/INELIGIBLE_DROP_PENDING）⑧old persisted plan→legacy 零改写
 *                                    ⑨cluster×capability 不在同簇→CAPABILITY_CLUSTER_MISMATCH fail-closed。
 *                                    另：注入反例三连（静默取一/静默执行/静默放行）必须被判定具名 FAIL（探针有牙，
 *                                    防恒真 vacuous）；具名失败码→governance 冻结事件两键匹配。
 *                                    证据落 test-reports/autopilot-work/W2-3/。任一 FAIL → regression FAIL。
 *
 * 注：S4-S6 在临时 workspace 中运行（os.tmpdir），结束后清理，不污染仓库。
 *
 * Phase 2 占位说明：ITERATION_PLAN.md 四期序（骨架→簇化→替换→反哺）中，资产替换迭代启动前
 * 必须先有回归基线。S3 是「替换清单」占位卡点——校验替换目标现状契约（① vendor 存在 ② 适配器接线
 * ③ 正文内核 marker）。替换内容后 marker 变化而 PHASE2 表未同步 → S3 FAIL，强制显式登记。
 */
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { resolveAdapter } from './lib/adapters/index.mjs';
import { runJunctionSmoke } from '../test-reports/fix-20260921/junction-smoke.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

/** Phase 2 替换目标清单。kernel = 资产正文必须包含的内核 marker（漂移门）。
 *  AS-1 drop 7（2026-09-25）：六行随资产删除收缩（vfv 资产本就不在本表）；
 *  保留 8 行（dev-planner 无 kernel 内核表行，S3 为子集门非全量门）。drop 逐资产清单
 *  权威 = change.record cr-20260925T102900Z-as1-drop7（此处置文件不再重抄名单，防猎手名单自命中）。 */
const PHASE2 = [
  { asset: 'implementation', dedicatedAdapter: true, kernel: ['opencode'], file: 'vendor/implementation/implementation.md', note: '实现簇(dev-backend+be-implementer) → opencode 执行内核' },
  { asset: 'sdlc', dedicatedAdapter: true, kernel: ['cline', 'BMAD'], file: 'vendor/sdlc/SKILL.md', note: 'sdlc → BMAD-METHOD + cline 执行层' },
  { asset: 'be-validator', dedicatedAdapter: true, kernel: ['OpenAPI', 'contract'], file: 'vendor/be-validator/be-validator.md', note: 'be-validator → spectral 契约校验（AS-2-first 晋升；vendor 正文 marker 保留）' },
  { asset: 'skill-sentinel', dedicatedAdapter: true, kernel: ['SkillSpector', 'skill_sentinel'], file: 'vendor/skill-sentinel/SKILL.md', note: 'skill 安全扫描 → skill-scanner 2.1.0 执行内核（AS-2-sentinel 晋升，cr-20260925T150000Z SIGNED；kernel marker 仍为 vendor 正文 SkillSpector/skill_sentinel——vendor 一字不改）' },
  { asset: 'security', dedicatedAdapter: true, kernel: ['semgrep'], file: 'vendor/security/SKILL.md', note: '安全簇 → semgrep 扫描内核（AS-2-security 晋升；gitleaks 暂缺登记为能力收缩，第十一审计 F-018）' },
  { asset: 'frontend-design', dedicatedAdapter: false, kernel: ['shadcn', 'bolt.new'], file: 'vendor/frontend-design/SKILL.md', note: '前端设计簇 → shadcn-ui/ui + bolt.new 内核' },
  { asset: 'planning', dedicatedAdapter: false, kernel: ['MetaGPT', 'crewAI'], file: 'vendor/planning/SKILL.md', note: '需求规划 → MetaGPT / crewAI 对标' },
  { asset: 'review', dedicatedAdapter: false, kernel: ['pr-agent', 'continuedev'], file: 'vendor/review/SKILL.md', note: '评审簇 → qodo-ai/pr-agent + continue 内核' },
];

let pass = 0;
let fail = 0;
let skip = 0;
const failures = [];

function section(name, ok, detail) {
  if (ok) { pass += 1; console.log('PASS ' + name + (detail ? '  ' + detail : '')); }
  else { fail += 1; failures.push(name); console.log('FAIL ' + name + (detail ? '  ' + detail : '')); }
}

function run(cmd, args, cwd) {
  return new Promise(function (resolve) {
    let out = '';
    const child = spawn(cmd, args, { cwd: cwd || ROOT, stdio: ['ignore', 'pipe', 'pipe'] });
    child.stdout.on('data', function (c) { out += c.toString(); });
    child.stderr.on('data', function (c) { out += c.toString(); });
    child.on('close', function (code) { resolve({ ok: code === 0, code, out }); });
  });
}

async function main() {
  console.log('# TT regression-all（一键回归卡点）\n');

  // S1 validate-structure
  const v = await run(process.execPath, ['scripts/validate-structure.mjs']);
  section('S1 validate-structure', v.ok, v.ok ? '' : 'exit=' + v.code);

  // S2 test-retry
  const t = await run(process.execPath, ['scripts/test-retry.mjs']);
  section('S2 test-retry', t.ok, t.ok ? '' : 'exit=' + t.code);

  // S3 Phase 2 替换清单占位校验
  let p2ok = true;
  const p2lines = [];
  // 漂移门：kernel marker 必须出现在「非否定 + 正面内核语义」行。
  // NEGATED 含常见否定/弃用词；ACTIVE 要求行内含动作动词或内核语义词（防 "ticket #opencode-42" / stub 行绕过）。
  const NEGATED = /\b(no longer|not|without|dropped|removed|abandoned|replaced|retired|deprecated|obsolete|discontinued|unsupported)\b/i;
  const ACTIVE = /\b(probes|spawns|executes|uses|implements|runs|invokes|kernel|execution layer|methodology layer|integrated|adapter)\b/i;
  for (const target of PHASE2) {
    const file = path.join(ROOT, target.file);
    const exists = fs.existsSync(file);
    // 专用 adapter 检查仅对 dedicatedAdapter 资产强制（resolveAdapter(asset,'cli')）；无专用的靠 prompt/auto 兜底（可达性由路由 9/9 保证——AS-1 drop 后口径）。
    const adapter = resolveAdapter(target.asset, target.dedicatedAdapter ? 'cli' : 'auto');
    const adapterOk = !!adapter;
    let marker = true;
    let missing = [];
    let kernelSection = false;
    let hasProbe = false;
    if (exists) {
      const body = fs.readFileSync(file, 'utf8');
      // 漂移门强约束：须含「## Execution kernel」段标题 + probe 动作词（防 stub 单行绕过，见独立验收 P2②）
      kernelSection = /^#{1,6}\s+Execution kernel/im.test(body);
      hasProbe = /\b(probe|probes|spawns|executes|invokes)\b/i.test(body);
      for (const k of target.kernel) {
        const hit = body.split('\n').some(function (ln) {
          const lower = ln.toLowerCase();
          return lower.includes(k.toLowerCase()) && !NEGATED.test(ln) && ACTIVE.test(ln);
        });
        if (!hit) { marker = false; missing.push(k); }
      }
    }
    const okItem = exists && adapterOk && marker && kernelSection && hasProbe;
    if (!okItem) p2ok = false;
    const detail = (exists ? '[vendor OK]' : '[vendor 缺失]') + (adapterOk ? (target.dedicatedAdapter ? ' [能力探测验证: 专用 adapter 支持 write_files/run_cmd]' : ' [prompt/auto 可达]') : ' [无专用 adapter，prompt/auto 兜底]')
      + (kernelSection ? ' [kernel 段]' : ' [缺 Execution kernel 段]')
      + (hasProbe ? ' [probe]' : ' [缺 probe]')
      + (marker ? ' [marker OK]' : ' [marker 缺失/否定或 stub: ' + missing.join(',') + ']');
    p2lines.push('  ' + (okItem ? '✓' : '✗') + ' ' + target.asset + ' — ' + target.note + ' ' + detail);
  }
  console.log('S3 Phase 2 替换清单（占位卡点，替换启动前须保持全绿）：');
  for (const l of p2lines) console.log(l);
  section('S3 Phase 2 替换清单', p2ok, p2ok ? '（3 个高杠杆目标现状契约完整）' : '（有目标缺专用 adapter/缺失/内核 marker 漂移，替换前先修）');

  // S4-S6 真实 smoke（临时 workspace，结束后清理）
  const tmpWs = fs.mkdtempSync(path.join(os.tmpdir(), 'tt-regression-'));

  // S4 契约工作流 smoke（BE-13）：冻结生成 + resume 复用 + 执行期篡改 → exit 4（json gate 真实生效）。
  // 显式 --backend prompt：机制测试须隔离外部 CLI/模型依赖，prompt 后端下所有子任务走内置 prompt
  // adapter + --exec 宿主，不触发 opencode CLI 真调（T6 修复后 auto 后端会真调 opencode run）。
  const s4a = await run(process.execPath, ['scripts/orchestrator.mjs', '--backend', 'prompt', '--task', 'backend login module', '--workspace', tmpWs]);
  const s4contracts = fs.existsSync(path.join(tmpWs, 'contracts')) && fs.readdirSync(path.join(tmpWs, 'contracts')).some(function (f) { return f.endsWith('.json'); });
  const s4resume = await run(process.execPath, ['scripts/orchestrator.mjs', '--backend', 'prompt', '--resume', '--workspace', tmpWs]);
  // 执行期篡改契约（exec 内 append 到 tmpWs 下的契约文件）→ 期望 exit 4。
  // 顺序依赖：exec 宿主以 brief 路径推导 planId（basename(dirname)-<idx>），簇内首个资产须为 prompt 兜底（无专用 CLI）——
  // 若调整 T2 簇序导致首个资产走专用 CLI，本推导需同步改用显式 planId 参数。
  const s4tamper = await run(process.execPath, ['scripts/orchestrator.mjs', '--backend', 'prompt', '--task', 'backend login module', '--workspace', tmpWs, '--exec', process.execPath, '-e', "const p=require('path'),fs=require('fs');fs.appendFileSync(p.join('contracts',p.basename(p.dirname(process.argv[1])).replace(/-\\d+$/,'')+'.json'),'//tampered')"]);
  section('S4 契约工作流 smoke', s4a.ok && s4contracts && s4resume.ok && s4tamper.code === 4, (s4a.ok && s4contracts ? 'contracts/<planId>.json 冻结 ✓ resume 复用 ✓' : '冻结失败') + ' 篡改→exit4 ✓');

  // S5 宿主执行 smoke（BE-14）：stdout 输出 → mode=exec；写产物文件(无 stdout) → mode=exec；空输出 → mode=prompt 降级。
  // 显式 --backend prompt：机制测试须隔离外部 CLI/模型依赖，不依赖 opencode 真调。
  const s5a = await run(process.execPath, ['scripts/orchestrator.mjs', '--backend', 'prompt', '--task', 'backend login module', '--workspace', tmpWs, '--exec', process.execPath, '-e', "console.log('smoke')"]);
  const s5state = s5a.ok ? JSON.parse(fs.readFileSync(path.join(tmpWs, '.tt-state', 'state.json'), 'utf8')) : null;
  const s5hasExec = s5state && s5state.modes && s5state.modes.exec > 0;
  // 写文件型宿主（claude/codex 行为）：stdout 空但产物目录有非 brief 文件 → 应 mode=exec
  const s5c = await run(process.execPath, ['scripts/orchestrator.mjs', '--backend', 'prompt', '--task', 'backend login module', '--workspace', tmpWs, '--exec', process.execPath, '-e', "const fs=require('fs'),p=require('path');fs.writeFileSync(p.join(p.dirname(process.argv[1]),'plan.md'),'# plan')"]);
  const s5cState = s5c.ok ? JSON.parse(fs.readFileSync(path.join(tmpWs, '.tt-state', 'state.json'), 'utf8')) : null;
  const s5cExec = s5cState && s5cState.modes && s5cState.modes.exec > 0;
  const s5b = await run(process.execPath, ['scripts/orchestrator.mjs', '--task', 'backend login module', '--workspace', tmpWs, '--backend', 'prompt', '--exec', process.execPath, '-e', '']);
  const s5bState = s5b.ok ? JSON.parse(fs.readFileSync(path.join(tmpWs, '.tt-state', 'state.json'), 'utf8')) : null;
  // 空输出 → prompt 降级：--backend prompt 隔离 prompt adapter 的 exec-host 消费链（C-09 起专用 CLI
  // adapter 会真实执行，auto 后端下 modes.exec>0 属预期，无法再断言"无任何 exec"）
  const s5bPrompt = s5bState && s5bState.modes && s5bState.modes.prompt > 0 && !s5bState.modes.exec;
  section('S5 宿主执行 smoke', s5a.ok && s5hasExec && s5c.ok && s5cExec && s5b.ok && s5bPrompt, 'stdout → exec ✓；写文件(无 stdout) → exec ✓；空输出 → prompt 降级 ✓');

  // S6 资产缓存 smoke（BE-15）：缓存文件生成 + 二次运行复用
  const s6cache = fs.existsSync(path.join(tmpWs, '.tt-state', 'assets-cache.json'));
  const s6b = await run(process.execPath, ['scripts/orchestrator.mjs', '--resume', '--workspace', tmpWs]);
  section('S6 资产缓存 smoke', s6cache && s6b.ok, s6cache ? 'assets-cache.json 生成 ✓ 二次运行复用 ✓' : '缓存未生成');

  fs.rmSync(tmpWs, { recursive: true, force: true });

  // S7 review-gate（批判能力代码级闸门）：self-test + 规划闸门真实断言（填好 plan → PASS；模板未填占位 → 拦截）
  const s7 = await run(process.execPath, ['scripts/review-gate.mjs', '--self-test']);
  const planSample = path.join(ROOT, '.tt-state', 's7-plan-sample.md');
  fs.mkdirSync(path.join(ROOT, '.tt-state'), { recursive: true });
  fs.writeFileSync(planSample, '# dev-plan\n\n## 需求前提挑战\n前提 Q1 结论已确认\n\n## 任务总纲\ntask01\n\n## 规划自审\n### CEO 范围自审\nFinding: 范围OK 处置: 采纳\n### Eng 架构自审\nFinding (confidence: 9/10) src/x.ts:12 处置: 采纳\n### Design 体验自审\nFinding: 空态 处置: 补');
  const s7plan = await run(process.execPath, ['scripts/review-gate.mjs', '--plan', planSample]);
  const s7tmpl = await run(process.execPath, ['scripts/review-gate.mjs', '--plan', path.join(ROOT, 'templates', 'dev-plan.md')]);
  fs.rmSync(path.join(ROOT, '.tt-state'), { recursive: true, force: true });
  section('S7 review-gate', s7.ok && s7plan.ok && !s7tmpl.ok, (s7.ok ? 'self-test ✓' : 'self-test ✗') + (s7plan.ok ? ' 填好plan→PASS ✓' : ' 填好plan→FAIL ✗') + (!s7tmpl.ok ? ' 模板未填→拦截 ✓' : ' 模板未填→漏过 ✗'));

  // S8 资产消费证据（D-1 强化）：宿主从 brief 提取方法论标题锚点 + Execution kernel 内核词写产物
  //（kernel 资产须锚点 AND ≥1 内核词，仅锚点会被判 assetConsumed=false）→ 正向：exec 全 true。
  // 显式 --backend prompt：机制测试须隔离外部 CLI/模型依赖，不依赖 opencode 真调。
  const s8ws = fs.mkdtempSync(path.join(os.tmpdir(), 'tt-rg-'));
  const s8 = await run(process.execPath, ['scripts/orchestrator.mjs', '--backend', 'prompt', '--task', 'backend login module', '--workspace', s8ws, '--exec', process.execPath, '-e', "const fs=require('fs'),p=require('path');const b=fs.readFileSync(process.argv[1],'utf8');const a=(b.match(/## \\u65b9\\u6cd5\\u8bba\\u6b63\\u6587[\\s\\S]*?\\n(#+\\s+[^\\n]+)/)||[])[1]||'x';const k=(b.match(/Kernel:\\s*([A-Za-z0-9][^\\n\\uFF08(]+)/)||[])[1]||'';fs.writeFileSync(p.join(p.dirname(process.argv[1]),'plan.md'),'# '+a+(k?'\\n\\n'+k:''))"]);
  const s8state = s8.ok ? JSON.parse(fs.readFileSync(path.join(s8ws, '.tt-state', 'state.json'), 'utf8')) : null;
  const s8execCount = s8state && s8state.modes ? (s8state.modes.exec || 0) : 0;
  const s8notConsumed = s8state ? s8state.subtasks.filter(function (s) { return s.assetConsumed === false && s.adapter === 'prompt'; }).length : -1;
  // 负向（P2-1 补）：kernel 资产宿主只写锚点 → 应出现 assetConsumed=false（防门禁退化为"锚点即够"）
  const s8n = await run(process.execPath, ['scripts/orchestrator.mjs', '--backend', 'prompt', '--task', 'backend login module', '--workspace', s8ws, '--exec', process.execPath, '-e', "const fs=require('fs'),p=require('path');const b=fs.readFileSync(process.argv[1],'utf8');const a=(b.match(/## \\u65b9\\u6cd5\\u8bba\\u6b63\\u6587[\\s\\S]*?\\n(#+\\s+[^\\n]+)/)||[])[1]||'x';fs.writeFileSync(p.join(p.dirname(process.argv[1]),'plan.md'),'# '+a)"]);
  const s8nState = s8n.ok ? JSON.parse(fs.readFileSync(path.join(s8ws, '.tt-state', 'state.json'), 'utf8')) : null;
  const s8nFalse = s8nState ? s8nState.subtasks.filter(function (s) { return s.assetConsumed === false; }).length : -1;
  fs.rmSync(s8ws, { recursive: true, force: true });
  section('S8 资产消费证据', s8.ok && s8execCount > 0 && s8notConsumed === 0 && s8nFalse > 0, 'exec=' + s8execCount + ' false(正)=0 false(负)=>' + s8nFalse + '（kernel 资产仅锚点 → false，强化生效）');

  // S9 域声明机验（C-27 / FR-5 GWT）：test-domain-declared 三态断言——domainDeclared:false → DOMAIN_DECL_MISSING
  // 具名 warning（缺声明检出 100%）；true → ok；全部无字段（旧数据）→ N/A 不误伤。任一断言失败计 FAIL。
  const s9 = await run(process.execPath, ['scripts/test-domain-declared.mjs']);
  section('S9 域声明机验', s9.ok, s9.ok ? 'missing→DOMAIN_DECL_MISSING ✓ true→ok ✓ 旧数据→N/A ✓' : 'exit=' + s9.code + '（详见 test-domain-declared 输出）');

  // S10 token 机验量尺（B0-② / C-35）：token-audit --gate 对比快照，任一文件 token 回退 ≥10% → FAIL。
  // 快照缺失（exit 2）同样计 FAIL——先跑 node scripts/token-audit.mjs 生成基线。
  const s10 = await run(process.execPath, ['scripts/token-audit.mjs', '--gate']);
  section('S10 token 量尺 gate（B0-②）', s10.ok, s10.ok ? '快照对比 PASS ✓' : 'exit=' + s10.code + '（快照缺失先跑 node scripts/token-audit.mjs，回退则查 TOKEN_REGRESSION 输出）');

  // S11 引用链机验（C-25/C-33）：owner-review-linkcheck——templates/owner-review/ 文件级引用悬空
  // 与 tab 损坏残留（\t emplates/）0 容忍；悬空/损坏 → 脚本具名输出 + exit 1，此处计 FAIL。
  // 反向用例（fixture 植入假引用 FAIL / 还原 PASS）由脚本 --self-test 内置，维护时可单独跑。
  const s11 = await run(process.execPath, ['scripts/owner-review-linkcheck.mjs']);
  section('S11 引用链机验（C-25/C-33）', s11.ok, s11.ok ? '悬空引用 0 / tab 损坏 0 ✓' : 'exit=' + s11.code + '（详见 linkcheck DANGLING/TAB-CORRUPT 具名输出）');

  // S12 kickoff 漂移门（C-26）：kickoff-drift-check——templates/kickoff-prompt.md 五簇资产清单
  // 与 matrix.mjs CLUSTERS 双向集合 diff；漂移 → 具名 DRIFT 输出 + exit 1，此处计 FAIL。
  // 反向用例（fixture 假资产 FAIL 具名 / 还原 PASS）由脚本 --self-test 内置，维护时可单独跑。
  const s12 = await run(process.execPath, ['scripts/kickoff-drift-check.mjs']);
  section('S12 kickoff 漂移门（C-26）', s12.ok, s12.ok ? '五簇资产双向一致 ✓' : 'exit=' + s12.code + '（详见 DRIFT 缺失/多出具名输出）');

  // S13 junction 部署形态 smoke（HARD-1）：junction 在场（本机安装形态）→ 真实执行 4 入口探针，
  // 内部 4/4 PASS 且无 FAIL 才计段 PASS；junction 缺失/真实目录安装 → 记 SKIP（显式打印，
  // 不进 PASS/FAIL 计数，整套回归照常 exit 0）。探测路径可被 TT_JUNCTION_PROBE_PATH 覆盖（模拟用）。
  const s13 = runJunctionSmoke();
  for (const l of s13.lines) console.log(l);
  if (s13.skipped) {
    skip += 1;
    console.log('SKIP S13 junction 部署形态 smoke  （junction 缺失/真实目录安装——本探针只覆盖 junction 形态，不计 PASS/FAIL）');
  } else {
    section('S13 junction 部署形态 smoke', s13.fail === 0 && s13.pass > 0, s13.pass + '/' + (s13.pass + s13.fail) + ' 内部探针 PASS');
  }

  // S14 preflight invariants（v3 批 1 B1-GATE）：scripts/preflight.mjs 全静态预检——
  // 语法门（blindqueue 重复声明教训：文件坏了 self-test 跑不起来，只有编译器级预检能抓）/
  // 跨模块导出查重 / ADAPTERS 注册一致性 / CLUSTERS↔磁盘 / buildManifest 单源 /
  // DROP_ALLOWED 断言（manifest 产物缺失时内部 SKIP，不 FAIL）/ change-lock 核查。
  // FAIL 即 regression FAIL；manifest 产物在场后 P6 自动生效（不用改本段）。
  const s14 = await run(process.execPath, ['scripts/preflight.mjs', '--owner', 'regression-all']);
  console.log(s14.out.trimEnd());
  section('S14 preflight invariants', s14.ok, s14.ok ? '7 项静态不变量全过' : 'exit=' + s14.code + '（具名 FAILED 见上方 preflight 输出）');

  // S14b audit-index self-test（REMEDIATION-2 F-032，2026-09-26；preflight P5 系延续编号 P5c）：
  // plans/audit-index-20260925.md 证据指针表机检——逐条断言证据路径存在 + 复验命令可执行
  // （exit 0；git 类命令 SKIP-git 归审计者；N 系披露行按 GAP 登记不阻断）。audit-index 从此不能
  // stale：指针失效/证据缺失/命令跑不通 → 本段 FAIL → 整机回归 FAIL。
  const s14b = await run(process.execPath, ['plans/audit-index-selftest.mjs']);
  const s14bTail = s14b.out.trimEnd().split('\n').filter((l) => /^(PASS|FAIL|结果)/.test(l.trim()));
  console.log(s14bTail.join('\n'));
  section('S14b audit-index self-test（P5c）', s14b.ok, s14b.ok ? '索引 ' + (s14bTail.find((l) => l.startsWith('结果')) || '').trim() + '——未 stale' : 'exit=' + s14b.code + '（STALE 具名见 selftest 输出）');

  // S15 migration invariants（AS-1 实装，2026-09-25；v3.2 定义 + 第十二审计两模式）——六断言：
  //   A1 drop 资产引用 0 命中（治理活面全扫；历史证据面/一字不改面/登记残留面显式排除并留痕输出）
  //   A2 replace 资产真实消费探针（be-validator=spectral / security=semgrep / skill-sentinel=skill-scanner
  //      各跑一次真实扫描——os.tmpdir 夹具，跑完即删）
  //   A3 manifest 驱动路由断言（manifest-build 打印 hash == 落盘 sha256 == 真实 dispatch Gate-2 日志 hash，
  //      三方机验期望值动态重算；eligible.mjs 9 资产全 eligible=true + 7 drop 资产 eligible=false）
  //   A4 legacy loader 不可达（orchestrator 生产调用恒传 manifest 静态断言；loadAssets manifest 路径与
  //      legacy 自动路径输出均零 drop 资产——vendor 物理删除后旧 loader 无法复活；adapter 旧引擎路径
  //      EXPLICIT_COMPAT_MODE 旗标门在场（Gate-1 禁静默并存））
  //   A5 真实执行≠能力覆盖（第十二审计模式 1：混合语言目录 semgrep 0 findings 仍 pass=false +
  //      UNCOVERED_LANGUAGES 必现——"真的扫了"≠"能力覆盖了目标"）
  //   A6 correction≠作废（第十二审计模式 2：voided transition 留痕保留不删；回放状态机跳过 voided 后
  //      终态==记录终态；voided 实例身份（from→to@at）不被任何 active transition 复用——不可再入）
  const DROPPED_ASSETS = ['be-architect', 'be-resilience', 'be-provider', 'colorize', 'frontend-visual-validation', 'agent-vision-toolkit', 'agent-research'];
  const KEPT_ASSETS = ['implementation', 'be-validator', 'sdlc', 'security', 'review', 'dev-planner', 'frontend-design', 'planning', 'skill-sentinel'];

  // ── S15-A1 drop 资产引用 0 命中 ──
  {
    // 排除面（显式列举，三类）：
    // ① 历史证据面：test-reports / docs / CHANGELOG / plans / handoffs / artifacts / recovery / prototypes /
    //    .learnings / .memory / .mimosa / .tmp-demo / contracts/discrepancies（change.record 本身必须具名 drop 资产）
    // ② 一字不改面：vendor/（保留资产含其正文提及，禁改纪律优先）
    // ③ 豁免残留面（D-3 清理后仅剩类 C 历史/schema 豁免件——S15-A1 豁免口径=历史证据面，
    //    改动反而篡改历史决断；逐文件计数留痕输出）+ S15 自身（断言持有 drop 清单常量——猎手名单≠资产引用）
    // ② 一字不改面：vendor/（保留资产含其正文/参考件提及 drop 资产名，禁改纪律优先）
    const A1_SKIP_DIRS = new Set(['node_modules', '.git', 'vendor', 'test-reports', 'docs', 'artifacts', 'recovery-20260919', 'prototypes', '.learnings', '.memory', '.mimosa', '.tmp-demo', 'plans', 'handoffs', 'contracts' + path.sep + 'discrepancies', 'contracts/discrepancies', 'contracts' + path.sep + 'drafts', 'contracts/drafts']);
    const A1_SKIP_FILES = new Set(['CHANGELOG.md', '.zcodeignore', '.gitignore', 'package-lock.json']);
    const A1_REGISTERED_RESIDUALS = new Set([
      'contracts' + path.sep + 'asset-manifest-v2.md', 'contracts' + path.sep + 'C-R3-review-checklist.md',
    ]);
    const A1_TEXT_EXT = /\.(md|mjs|js|cjs|json|yaml|yml|txt|html|css|py)$/i;
    const a1Violations = [];
    const a1Residuals = [];
    let a1Scanned = 0;
    (function walk(dir, relTop) {
      let entries = [];
      try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch (e) { return; }
      for (const ent of entries) {
        const full = path.join(dir, ent.name);
        const rel = path.join(relTop, ent.name);
        const relNorm = rel.replace(/\\/g, '/');
        if (ent.isDirectory()) {
          if (A1_SKIP_DIRS.has(ent.name) || A1_SKIP_DIRS.has(relNorm)) continue;
          walk(full, rel);
        } else if (ent.isFile() && A1_TEXT_EXT.test(ent.name) && !A1_SKIP_FILES.has(ent.name)) {
          const relKey = path.relative(ROOT, full);
          a1Scanned += 1;
          let body = '';
          try { body = fs.readFileSync(full, 'utf8'); } catch (e) { continue; }
          const hits = DROPPED_ASSETS.filter((n) => body.includes(n));
          if (!hits.length) continue;
          if (A1_REGISTERED_RESIDUALS.has(relKey)) a1Residuals.push(relKey.split(path.sep).join('/') + ' (' + hits.join(',') + ')');
          else a1Violations.push(relKey.split(path.sep).join('/') + ' -> ' + hits.join(','));
        }
      }
    })(ROOT, '');
    // S15 断言自身持有 DROPPED_ASSETS 常量（猎手名单）——自命中按豁免计，不进违规（猎手名单≠资产引用）。
    const a1ViolationsFinal = a1Violations.filter((v) => !v.startsWith('scripts/regression-all.mjs -> '));
    const a1SelfExempt = a1ViolationsFinal.length !== a1Violations.length;
    const a1okFinal = a1ViolationsFinal.length === 0;
    section('S15-A1 drop 资产引用 0 命中（治理活面）', a1okFinal,
      a1okFinal ? `扫描 ${a1Scanned} 文件 0 命中；类 C 豁免残留面 ${a1Residuals.length + (a1SelfExempt ? 1 : 0)} 文件（D-3 处置后仅剩历史/schema 豁免件 + S15 猎手名单自身，不阻断）${a1Residuals.length ? ': ' + a1Residuals.join('; ') : ''}${a1SelfExempt ? '; scripts/regression-all.mjs (S15 断言持有 drop 清单常量——猎手名单≠资产引用)' : ''}`
           : `DROP_REF_HIT ${a1ViolationsFinal.length} 文件: ${a1ViolationsFinal.join('; ')}`);
  }

  // ── S15-A2 replace 资产真实消费探针（三引擎各一次真实扫描，os.tmpdir 跑完即删）──
  {
    const ws2 = fs.mkdtempSync(path.join(os.tmpdir(), 'tt-s15-a2-'));
    let a2ok = true; const a2detail = [];
    try {
      // a2-1 be-validator → spectral 真实 lint（缺陷 OpenAPI：operation 缺 responses → error 级 finding）
      const specPath = path.join(ws2, 'bad-openapi.json');
      fs.writeFileSync(specPath, JSON.stringify({ openapi: '3.0.0', info: { title: 'S15 A2 probe', version: '1.0.0' }, paths: { '/login': { post: { operationId: 'login', summary: 'login', requestBody: { content: { 'application/json': { schema: { type: 'object' } } } } } } } }, null, 2));
      const bv = resolveAdapter('be-validator', 'cli');
      const bvRes = bv ? await bv.run({ id: 's15-a2-bevalidator', contract: specPath }, null, { workspace: ws2 }) : null;
      const bvOk = Boolean(bvRes && bvRes.ok && bvRes.contract && bvRes.contract.tool === 'spectral' && bvRes.contract.mode === 'exec' && bvRes.contract.pass === false && bvRes.contract.findings_total >= 1);
      a2detail.push('be-validator/spectral: ' + (bvOk ? `真扫 ${bvRes.contract.findings_total} findings pass=false` : 'FAIL'));
      if (!bvOk) a2ok = false;
      // a2-2 security → semgrep 真实扫描（Python 缺陷夹具：硬编码口令 + SQL 拼接）
      const pyPath = path.join(ws2, 'vulnerable.py');
      fs.writeFileSync(pyPath, 'import hashlib\n\ndef query(user):\n    password = "hunter2-plaintext"\n    sql = "SELECT * FROM users WHERE name = \'" + user + "\'"\n    return sql\n');
      const sec = resolveAdapter('security', 'cli');
      const secRes = sec ? await sec.run({ id: 's15-a2-security' }, null, { workspace: ws2, scanTarget: pyPath }) : null;
      const secOk = Boolean(secRes && secRes.ok && secRes.contract && secRes.contract.tool === 'semgrep' && secRes.contract.mode === 'exec' && secRes.contract.pass === false && secRes.contract.findings_total >= 1);
      a2detail.push('security/semgrep: ' + (secOk ? `真扫 ${secRes.contract.findings_total} findings pass=false` : 'FAIL'));
      if (!secOk) a2ok = false;
      // a2-3 skill-sentinel → skill-scanner 真实扫描（良性 skill 夹具：is_safe=true 威胁 0）
      const skillDir = path.join(ws2, 'benign-skill');
      fs.mkdirSync(skillDir, { recursive: true });
      fs.writeFileSync(path.join(skillDir, 'SKILL.md'), '# Benign Skill\n\nAdds two numbers and returns the sum.\n\n## Usage\n\nCall add(a, b) with two integers.\n');
      const sen = resolveAdapter('skill-sentinel', 'cli');
      const senRes = sen ? await sen.run({ id: 's15-a2-sentinel' }, null, { workspace: ws2, scanTarget: skillDir }) : null;
      const senOk = Boolean(senRes && senRes.ok && senRes.contract && senRes.contract.tool === 'skill-scanner' && senRes.contract.mode === 'exec' && senRes.contract.pass === true && senRes.contract.is_safe === true && senRes.contract.threats === 0);
      a2detail.push('skill-sentinel/skill-scanner: ' + (senOk ? '真扫 is_safe=true threats=0' : 'FAIL'));
      if (!senOk) a2ok = false;
    } catch (e) {
      a2ok = false; a2detail.push('probe exception: ' + e.message);
    } finally {
      fs.rmSync(ws2, { recursive: true, force: true });
    }
    section('S15-A2 replace 资产真实消费探针', a2ok, a2detail.join(' | ') + '（os.tmpdir 夹具已清理）');
  }

  // ── S15-A3 manifest 驱动路由断言（Gate-2 三方 hash + eligible 9 true / 7 false）──
  {
    let a3ok = true; const a3detail = [];
    const build = await run(process.execPath, ['scripts/manifest-build.mjs']);
    const buildHash = (build.out.match(/sha256\(asset-manifest-v2\.json\) = ([0-9a-f]{64})/) || [])[1];
    const buildRows = Number((build.out.match(/manifest-build: (\d+) 行/) || [])[1]);
    const manifestBytes = fs.readFileSync(path.join(ROOT, 'contracts', 'asset-manifest-v2.json'));
    const manifestSha = crypto.createHash('sha256').update(manifestBytes).digest('hex');
    const hashPairOk = build.ok && buildRows === 9 && Boolean(buildHash) && buildHash === manifestSha;
    a3detail.push(`manifest-build ${buildRows} 行 hash 三方一致: ` + (hashPairOk ? buildHash.slice(0, 12) + '… ✓' : 'FAIL'));
    if (!hashPairOk) a3ok = false;
    // 真实 dispatch 一次抓 Gate-2 日志 hash（期望值动态重算，禁硬编码）
    const ws3 = fs.mkdtempSync(path.join(os.tmpdir(), 'tt-s15-a3-'));
    try {
      const disp = await run(process.execPath, ['scripts/orchestrator.mjs', '--backend', 'prompt', '--task', 'backend login module', '--workspace', ws3]);
      const gate2Hash = (disp.out.match(/Gate-2 manifest_sha256=([0-9a-f]{64})/) || [])[1];
      const gate2Ok = Boolean(gate2Hash) && gate2Hash === manifestSha;
      a3detail.push('Gate-2 dispatch 日志 hash==build: ' + (gate2Ok ? '✓' : 'FAIL'));
      if (!gate2Ok) a3ok = false;
    } finally {
      fs.rmSync(ws3, { recursive: true, force: true });
    }
    // eligible.mjs：9 资产全 eligible=true；7 drop 资产全 eligible=false（负向探针）
    const eligBad = [];
    for (const asset of KEPT_ASSETS) {
      const r = await run(process.execPath, ['scripts/eligible.mjs', '--asset', asset]);
      let eligible = null;
      try { eligible = JSON.parse(r.out).eligible; } catch (e) { eligible = 'UNPARSABLE'; }
      if (eligible !== true) eligBad.push(asset + '=false');
    }
    for (const asset of DROPPED_ASSETS) {
      const r = await run(process.execPath, ['scripts/eligible.mjs', '--asset', asset]);
      let eligible = null;
      try { eligible = JSON.parse(r.out).eligible; } catch (e) { eligible = 'UNPARSABLE'; }
      if (eligible !== false) eligBad.push(asset + '(!)==true');
    }
    const eligOk = eligBad.length === 0;
    a3detail.push('eligible 9 true / 7 false: ' + (eligOk ? '✓' : 'FAIL ' + eligBad.join(', ')));
    if (!eligOk) a3ok = false;
    section('S15-A3 manifest 驱动路由断言', a3ok, a3detail.join(' | '));
  }

  // ── S15-A4 legacy loader 不可达 ──
  {
    let a4ok = true; const a4detail = [];
    // 静态①：生产唯一 loadAssets 调用点（orchestrator.mjs）恒传 manifest（manifest 驱动，不走 loader 内旧自动路径）
    const orchSrc = fs.readFileSync(path.join(ROOT, 'scripts', 'orchestrator.mjs'), 'utf8');
    const prodManifestDriven = /loadAssets\(\{[^}]*manifest[,\s}]/.test(orchSrc);
    a4detail.push('生产 loadAssets 恒 manifest 驱动: ' + (prodManifestDriven ? '✓' : 'FAIL'));
    if (!prodManifestDriven) a4ok = false;
    // 静态②：三个 replace adapter 的旧引擎回滚路径均在 EXPLICIT_COMPAT_MODE 旗标后（Gate-1 禁静默并存）
    const flagGated = ['portman.mjs', 'security-semgrep.mjs', 'skill-scanner.mjs'].every(function (f) {
      return fs.readFileSync(path.join(ROOT, 'scripts', 'lib', 'adapters', f), 'utf8').includes('EXPLICIT_COMPAT_MODE');
    });
    a4detail.push('adapter 旧引擎路径 EXPLICIT_COMPAT_MODE 旗标门在场: ' + (flagGated ? '✓' : 'FAIL'));
    if (!flagGated) a4ok = false;
    // 动态（EXPLICIT_COMPAT_MODE 未开启下执行）：loadAssets 双路径输出零 drop 资产；9 保留资产 manifest 路径全可达
    const compatWasOn = process.env.EXPLICIT_COMPAT_MODE === '1';
    const ws4 = fs.mkdtempSync(path.join(os.tmpdir(), 'tt-s15-a4-'));
    try {
      const { loadAssets } = await import('./lib/asset.mjs');
      const { loadManifest } = await import('./lib/manifest.mjs');
      const legacyManifest = await loadManifest({ vendorDir: path.join(ROOT, 'vendor'), stateDir: path.join(ws4, '.tt-state'), refresh: true });
      const viaManifest = await loadAssets({ vendorDir: path.join(ROOT, 'vendor'), workspace: ws4, manifest: legacyManifest, useCache: false });
      const legacyAuto = await loadAssets({ vendorDir: path.join(ROOT, 'vendor'), workspace: ws4, useCache: false });
      const namesManifest = [...viaManifest.keys()];
      const namesLegacy = [...legacyAuto.keys()];
      const leaked = DROPPED_ASSETS.filter((n) => namesManifest.includes(n) || namesLegacy.includes(n));
      const keptReachable = KEPT_ASSETS.every((n) => namesManifest.includes(n));
      const probeOk = !compatWasOn && leaked.length === 0 && keptReachable;
      a4detail.push('loader 双路径 drop 资产 0 输出 + 9 资产可达: ' + (leaked.length === 0 && keptReachable ? '✓' : 'FAIL leak=' + leaked.join(',') + ' keptMissing=' + KEPT_ASSETS.filter((n) => !namesManifest.includes(n)).join(',')) + (compatWasOn ? '（注：EXPLICIT_COMPAT_MODE=1 在场，本探针要求未开启语义）' : ''));
      if (!probeOk) a4ok = false;
    } catch (e) {
      a4ok = false; a4detail.push('probe exception: ' + e.message);
    } finally {
      fs.rmSync(ws4, { recursive: true, force: true });
    }
    section('S15-A4 legacy loader 不可达', a4ok, a4detail.join(' | '));
  }

  // ── S15-A5 真实执行≠能力覆盖（模式 1：混合语言目录 0 findings 仍 pass=false + UNCOVERED_LANGUAGES 必现）──
  {
    const ws5 = fs.mkdtempSync(path.join(os.tmpdir(), 'tt-s15-a5-'));
    let a5ok = false; let a5detail = 'FAIL';
    try {
      fs.writeFileSync(path.join(ws5, 'clean.py'), 'def add(a, b):\n    return a + b\n');
      fs.writeFileSync(path.join(ws5, 'plain.js'), 'function add(a, b) { return a + b; }\n');
      const sec = resolveAdapter('security', 'cli');
      const res5 = sec ? await sec.run({ id: 's15-a5-uncovered' }, null, { workspace: ws5, scanTarget: ws5 }) : null;
      const c5 = res5 && res5.contract;
      a5ok = Boolean(res5 && res5.ok && c5 && c5.tool === 'semgrep' && c5.findings_total === 0 && c5.pass === false && Array.isArray(c5.uncovered_languages) && c5.uncovered_languages.includes('js'));
      a5detail = a5ok ? 'semgrep 真扫 0 findings 仍 pass=false，UNCOVERED_LANGUAGES=' + JSON.stringify(c5.uncovered_languages) + '（真实执行≠能力覆盖成立）' : 'FAIL findings=' + (c5 && c5.findings_total) + ' pass=' + (c5 && c5.pass) + ' uncovered=' + JSON.stringify(c5 && c5.uncovered_languages);
    } catch (e) {
      a5detail = 'probe exception: ' + e.message;
    } finally {
      fs.rmSync(ws5, { recursive: true, force: true });
    }
    section('S15-A5 真实执行≠能力覆盖（模式 1）', a5ok, a5detail + '（夹具已清理）');
  }

  // ── S15-A6 correction≠作废（模式 2：voided transition 留痕 + 回放不可再入）──
  {
    let a6ok = false; let a6detail = 'FAIL';
    try {
      const rec = JSON.parse(fs.readFileSync(path.join(ROOT, 'test-reports', 'autopilot-work', 'AS-2-sentinel', 'migration-record.json'), 'utf8'));
      const transitions = rec.state_machine && Array.isArray(rec.state_machine.transitions) ? rec.state_machine.transitions : [];
      const voided = transitions.filter(function (t) { return t.voided === true; });
      const active = transitions.filter(function (t) { return t.voided !== true; });
      // ① correction 留痕保留（作废记录不删，voidReason 在场）
      const retained = voided.length >= 1 && voided.every(function (t) { return t.voidReason && t.from && t.to && t.at; });
      // ② 回放状态机：跳过 voided → 链式连续（from==当前态）→ 终态==记录终态
      let replayState = 'ACTIVE';
      let replayOk = true;
      for (const t of transitions) {
        if (t.voided === true) continue;
        if (t.from !== replayState) { replayOk = false; break; }
        replayState = t.to;
      }
      const finalOk = replayOk && replayState === rec.state_machine.current_state;
      // ③ 不可再入：voided 实例身份（from→to@at）未被任何 active transition 复用（重执行=新记录新时间戳）
      const reentered = voided.filter(function (v) { return active.some(function (a) { return a.from === v.from && a.to === v.to && a.at === v.at; }); });
      const noReuse = reentered.length === 0;
      a6ok = retained && finalOk && noReuse;
      a6detail = (retained ? 'voided 留痕 ' + voided.length + ' 条(voidReason 在场) ✓' : 'voided 留痕 FAIL') + ' | ' + (finalOk ? '回放跳过 voided 终态 ' + replayState + ' == 记录终态 ✓' : '回放终态 FAIL(replay=' + replayState + ' vs ' + rec.state_machine.current_state + ')') + ' | ' + (noReuse ? 'voided 身份零复用（不可再入）✓' : 'FAIL voided 身份被复用');
    } catch (e) {
      a6detail = 'probe exception: ' + e.message;
    }
    section('S15-A6 correction≠作废（模式 2）', a6ok, a6detail + '（证据 AS-2-sentinel/migration-record.json）');
  }


  // ── S16 failed state cannot promote（REMEDIATION-2 F-028 重做，2026-09-26；废除 HARDEN-1 旧两断言）──
  // 重做缘由（废除声明）：旧 S16-1/S16-2 用文本扫描验证身份域——asset-migration 六态无 failed
  // （migration_object.status==='failed' 不是契约词汇）、runtime promotionReceipt 字段无真实生产者、
  // change receipt 身份域是 cr-/apr- 不是 plan-id（两套 ID 本不相引，"零违例"恒真 vacuous）。
  // 新 S16 = 三段真实拒绝路径探针：判定全部走机验器真实代码（phase.transition 状态机 / spectral
  // adapter / receipt-append 事件链 / phase receiptCoverage 校验），非文本 include 匹配。
  {
    const REMED_DIR = path.join(ROOT, 'test-reports', 'autopilot-work', 'REMEDIATION-2');
    fs.mkdirSync(REMED_DIR, { recursive: true });

    // ── S16-1 Runtime plane：真实 phase 状态机拒绝 failed 子任务转入 done/executing ──
    // 真实机验器 = scripts/lib/phase.mjs transitionPhase（§3.2 矩阵：终态不可追加）+ checkPhase 只读面。
    // 探针先走完整合法链 idle→planning→executing→failed（canonical state.json 真实落盘），
    // 再断言 failed→{done,executing,reviewing} 全部 INVALID_TRANSITION 且 canonical state 保持 failed。
    {
      let s16_1ok = false; let s16_1detail = 'FAIL';
      const ev16 = { schema: 's16-runtime-plane@1.0.0', at: new Date().toISOString(), probe: 'phase.transition 终态不可追加（真实状态机）', steps: [], rejections: [], checks: {} };
      try {
        const { transitionPhase, checkPhase } = await import('./lib/phase.mjs');
        const ws16 = fs.mkdtempSync(path.join(os.tmpdir(), 'tt-s16-rt-'));
        const mkOpts = () => ({ now: new Date('2026-09-26T00:00:00Z'), env: { YY_GATE_MODE: 'legacy-warn', YY_SESSION_MODE: 'legacy' } });
        for (const [f, t] of [['idle', 'planning'], ['planning', 'executing'], ['executing', 'reviewing'], ['reviewing', 'failed']]) {
          const r = await transitionPhase({ workspace: ws16, from: f, to: t, opts: mkOpts() });
          ev16.steps.push({ from: f, to: t, ok: r.ok, code: r.code });
        }
        const stateFile = path.join(ws16, '.tt-state', 'state.json');
        const before = JSON.parse(fs.readFileSync(stateFile, 'utf8')).status;
        ev16.canonical_state_before_rejections = before;
        for (const to of ['done', 'executing', 'reviewing']) {
          const r = await transitionPhase({ workspace: ws16, from: 'failed', to, opts: mkOpts() });
          const after = JSON.parse(fs.readFileSync(stateFile, 'utf8')).status;
          const rejected = r.ok === false && r.code === 'INVALID_TRANSITION' && after === 'failed';
          ev16.rejections.push({ from: 'failed', to, ok: r.ok, code: r.code, reason: r.data.reason, canonical_state_unchanged: after === 'failed', rejected });
        }
        const chk = await checkPhase({ workspace: ws16, from: 'failed', to: 'done', opts: mkOpts() });
        ev16.readonly_check = { code: chk.code, allowed: chk.data.allowed, reason: chk.data.reason };
        ev16.checks.legal_chain_to_failed = ev16.steps.every((s) => s.ok) && before === 'failed';
        ev16.checks.all_terminal_rejections = ev16.rejections.every((r) => r.rejected);
        ev16.checks.readonly_rejects = chk.ok === false && chk.code === 'INVALID_TRANSITION' && chk.data.allowed === false;
        ev16.workspace = ws16;
        s16_1ok = ev16.checks.legal_chain_to_failed && ev16.checks.all_terminal_rejections && ev16.checks.readonly_rejects;
        s16_1detail = (ev16.checks.legal_chain_to_failed ? '合法链→failed ✓' : '合法链 FAIL') + ' | '
          + 'failed→done/executing/reviewing 全 INVALID_TRANSITION 且 canonical state 不变 ' + (ev16.checks.all_terminal_rejections ? '✓' : 'FAIL') + ' | '
          + '只读面 checkPhase 同拒 ' + (ev16.checks.readonly_rejects ? '✓' : 'FAIL');
        fs.writeFileSync(path.join(REMED_DIR, 's16-1-runtime-plane.json'), JSON.stringify(ev16, null, 2));
        fs.rmSync(ws16, { recursive: true, force: true });
      } catch (e) {
        s16_1detail = 'probe exception: ' + e.message;
        fs.writeFileSync(path.join(REMED_DIR, 's16-1-runtime-plane.json'), JSON.stringify(Object.assign(ev16, { exception: e.message, verdict: 'FAIL' }), null, 2));
      }
      section('S16-1 Runtime plane：真实状态机拒绝 failed→done/executing（INVALID_TRANSITION）', s16_1ok, s16_1detail + '（证据 REMEDIATION-2/s16-1-runtime-plane.json）');
    }

    // ── S16-2 Migration plane：三失败形态走真实机验器，SHADOW→MIGRATING 与 MIGRATING→PRIMARY 均拒绝 ──
    // 形态一 shadow FAIL：真实 spectral 对缺陷 OpenAPI 夹具（缺 responses）报 error findings → pass=false
    //   （os.tmpdir 夹具真实执行，AS-2-first 影子跑 FAIL 判据同源）；形态二 rollback FAIL：
    //   PATH 剥离 → SPECTRAL_NOT_AVAILABLE 且无 EXPLICIT_COMPAT_MODE 旗标 → adapter 拒绝（Gate-1）；
    //   形态三 runtime_binding FAIL：假 spectral（垃圾输出+exit 0）→ SPECTRAL_OUTPUT_INVALID。
    //   三形态下按 playbook Failure Rules（契约 §一转移表）判定：SHADOW→MIGRATING 与 MIGRATING→PRIMARY 拒绝。
    //   另断言 receipt 事件链机验器：负终态（verification_failed）→ behavior_verified 被 RECEIPT_INVALID 拒绝
    //   （promotion 前置证据链不可从失败终态升级）。
    {
      let s16_2ok = false; let s16_2detail = 'FAIL';
      const ev17 = { schema: 's16-migration-plane@1.0.0', at: new Date().toISOString(), shapes: {}, checks: {} };
      try {
        const { default: portmanAdapter } = await import('./lib/adapters/portman.mjs');
        const wsM = fs.mkdtempSync(path.join(os.tmpdir(), 'tt-s16-mig-'));
        fs.writeFileSync(path.join(wsM, 'bad-openapi.json'), JSON.stringify({ openapi: '3.0.0', info: { title: 'S16 migration-plane FAIL fixture', version: '1.0.0' }, paths: { '/login': { post: { operationId: 'login', summary: 'login', requestBody: { content: { 'application/json': { schema: { type: 'object' } } } } } } } }, null, 2));
        const subM = { id: 's16-mig-probe', asset: 'be-validator', task: 'contract validation', contract: path.join(wsM, 'bad-openapi.json') };
        // 形态一：shadow FAIL（真实 spectral 真扫缺陷夹具）
        const rShadow = await portmanAdapter.run(subM, null, { workspace: wsM });
        const shadowFail = rShadow.ok === true && rShadow.contract && rShadow.contract.pass === false && rShadow.contract.mode === 'exec' && rShadow.contract.findings_total >= 1;
        ev17.shapes.shadow_fail = { adapter_ok: rShadow.ok, pass: rShadow.contract && rShadow.contract.pass, findings_total: rShadow.contract && rShadow.contract.findings_total, detected: shadowFail };
        // 形态二：rollback FAIL（PATH 剥离 → spectral 不可达，无旗标旧路径被 Gate-1 拒绝）
        const oldPath = process.env.PATH; process.env.PATH = '';
        const rRollback = await portmanAdapter.run(subM, null, { workspace: wsM });
        process.env.PATH = oldPath;
        const rollbackFail = rRollback.ok === false && /SPECTRAL_NOT_AVAILABLE/.test(String(rRollback.error || ''));
        ev17.shapes.rollback_fail = { adapter_ok: rRollback.ok, error: rRollback.error, detected: rollbackFail };
        // 形态三：runtime_binding FAIL（假 spectral 垃圾输出+exit 0 → 输出契约违约）
        const fakeBin = path.join(wsM, 'fakebin'); fs.mkdirSync(fakeBin, { recursive: true });
        fs.writeFileSync(path.join(fakeBin, 'spectral.cmd'), '@echo off\r\necho NOT-A-JSON-GARBAGE\r\nexit /b 0\r\n');
        const oldPath2 = process.env.PATH; process.env.PATH = fakeBin + path.delimiter + oldPath2;
        const rInvalid = await portmanAdapter.run(subM, null, { workspace: wsM });
        process.env.PATH = oldPath2;
        const bindingFail = rInvalid.ok === false && rInvalid.error === 'SPECTRAL_OUTPUT_INVALID' && rInvalid.contract && rInvalid.contract.invalid_output === true;
        ev17.shapes.runtime_binding_fail = { adapter_ok: rInvalid.ok, error: rInvalid.error, invalid_output: rInvalid.contract && rInvalid.contract.invalid_output, detected: bindingFail };
        // playbook Failure Rules 判定改走生产 authority（GOV-AUTHORITY 任务一：test oracle 删除）——
        // 三失败形态逐个喂给生产 migration.transition()（合法边 + 形态门），断言 3×2 全拒（MIGRATION_BLOCKED:<形态>）；
        // 干净记录（零形态 + receipt 证据齐 + evidence 终态 behavior_verified）→ 生产 authority 放行（非恒拒）。
        const { transition: migrationTransition, promote: migrationPromote, validatePromotionEvidence, replayTransitions } = await import('./lib/migration.mjs');
        const PLAYBOOK = { SHADOW_TO_MIGRATING: '影子跑 FAIL（forbidden_difference/binding 违约）→ NO PROMOTION；回滚 FAIL → NO DROP', MIGRATING_TO_PRIMARY: '三硬门（Gate-1/2/3）任一 FAIL → 不得晋升 PRIMARY' };
        const tryTransition = (from, to, evidence) => migrationTransition({ current_state: from }, from, to, evidence);
        const denied = tryTransition('SHADOW', 'MIGRATING', { promotionReceipt: 'apr-x', failureShapes: ['shadow_fail'] });
        const deniedRb = tryTransition('SHADOW', 'MIGRATING', { promotionReceipt: 'apr-x', failureShapes: ['rollback_fail'] });
        const deniedRbP = tryTransition('MIGRATING', 'PRIMARY', { failureShapes: ['rollback_fail'] });
        const denied2 = tryTransition('MIGRATING', 'PRIMARY', { failureShapes: ['runtime_binding_fail'] });
        const denied3 = tryTransition('MIGRATING', 'PRIMARY', { terminal: 'behavior_verified', failureShapes: ['shadow_fail'] });
        const allowedS2M = tryTransition('SHADOW', 'MIGRATING', { promotionReceipt: 'apr-clean' });
        const allowedM2P = tryTransition('MIGRATING', 'PRIMARY', { terminal: 'behavior_verified' });
        ev17.checks.three_shapes_detected = shadowFail && rollbackFail && bindingFail;
        ev17.checks.shadow_to_migrating_denied_all = !denied.ok && String(denied.code).startsWith('MIGRATION_BLOCKED:shadow_fail')
          && !deniedRb.ok && String(deniedRb.code).startsWith('MIGRATION_BLOCKED:rollback_fail')
          && !denied3.ok && String(denied3.code).startsWith('MIGRATION_BLOCKED:shadow_fail');
        ev17.checks.migrating_to_primary_denied_all = !deniedRbP.ok && String(deniedRbP.code).startsWith('MIGRATION_BLOCKED:rollback_fail')
          && !denied2.ok && String(denied2.code).startsWith('MIGRATION_BLOCKED:runtime_binding_fail')
          && !denied3.ok;
        ev17.checks.clean_record_allowed = allowedS2M.ok === true && allowedM2P.ok === true;
        ev17.production_authority = { module: 'scripts/lib/migration.mjs', codes: { shadow: denied.code, rollback_s2m: deniedRb.code, rollback_m2p: deniedRbP.code, binding: denied2.code } };
        ev17.playbook_rules = PLAYBOOK;
        // receipt 事件链机验器：真实 receiptAppend 走 T1-T5 → verification_failed 负终态 → behavior_verified 拒绝
        const { receiptAppend } = await import('./lib/receipt.mjs');
        const crypto = await import('node:crypto');
        const sha256 = (b) => crypto.createHash('sha256').update(b).digest('hex');
        const srcHash = sha256(fs.readFileSync(path.join(ROOT, 'vendor', 'implementation', 'implementation.md')));
        const payload = 'Unified implementation agent body bytes here for payload.';
        const mkEvent = (transition, evidence, key) => ({ transition, assetId: 'implementation', sourceHash: srcHash, session: 's16', idempotencyKey: key, evidence, subtaskId: 'st-s16' });
        const wsRDir = fs.mkdtempSync(path.join(os.tmpdir(), 'tt-s16-rc-'));
        const artDir = path.join(wsRDir, 'artifacts', 'st-s16');
        fs.mkdirSync(artDir, { recursive: true });
        fs.writeFileSync(path.join(artDir, 'brief.md'), '## 方法论正文（资产全文）\n\n' + payload + '\n\n---\n执行要求：x');
        fs.writeFileSync(path.join(artDir, 'plan.md'), '# 实现资产标题\n\n' + payload + '\n\nAdditional real content: acceptance criteria.');
        const chain = [
          ['discovered', { catalogCacheIdentity: 'c', sourceHash: srcHash }, 'k1'],
          ['eligible', { phaseEligibility: { eligible: true } }, 'k2'],
          ['selected', { planId: 'p', subtaskId: 'st-s16', sourceHash: srcHash }, 'k3'],
          ['instructions_delivered', { activationLevel: 'body', payloadSha256: sha256(payload), briefPath: 'brief.md', sourceHashEcho: srcHash, budgetResult: { ok: true } }, 'k4'],
          ['execution_observed', { artifactPath: 'plan.md', artifactSha256: sha256(fs.readFileSync(path.join(artDir, 'plan.md'))), executed: true }, 'k5'],
        ];
        let chainOk = true;
        for (const [t, evidence, key] of chain) { const rr = receiptAppend({ event: mkEvent(t, evidence, key), opts: { workspace: wsRDir, vendorDir: path.join(ROOT, 'vendor') } }); if (!rr.ok) chainOk = false; }
        const rNeg = receiptAppend({ event: mkEvent('verification_failed', { behaviorCheck: { result: 'FAILED', checkId: 'st-s16#implementation' }, reason: 'behavior mismatch' }, 'k6'), opts: { workspace: wsRDir, vendorDir: path.join(ROOT, 'vendor') } });
        const rUpgrade = receiptAppend({ event: mkEvent('behavior_verified', { behaviorCheck: { result: 'VERIFIED' }, evidenceRefs: [1, 2, 3, 4, 5].map((n) => ({ eventSeq: n })) }, 'k7'), opts: { workspace: wsRDir, vendorDir: path.join(ROOT, 'vendor') } });
        ev17.receipt_chain = { t1_t5_all_ok: chainOk, verification_failed_ok: rNeg.ok === true, terminal: rNeg.data && rNeg.data.state, post_terminal_upgrade_rejected: rUpgrade.ok === false && rUpgrade.code === 'RECEIPT_INVALID', reason: rUpgrade.data && rUpgrade.data.reason };
        ev17.checks.receipt_negative_terminal_blocks_verified = chainOk && rNeg.ok === true && ev17.receipt_chain.post_terminal_upgrade_rejected;
        // 生产 promotionReceipt 生成处校验（S16-3 语义升为生产函数 validatePromotionEvidence——test oracle 删除）：
        // 负终态（FAILED/UNRESOLVED/INVALID/缺失）全拒，仅 behavior_verified 放行；promote() 生成 receipt 只在校验通过后
        const negTerminals = ['FAILED', 'UNRESOLVED', 'INVALID', null].every((t) => validatePromotionEvidence(t).ok === false) && validatePromotionEvidence('behavior_verified').ok === true;
        const promoteDenied = migrationPromote({ current_state: 'MIGRATING' }, { receiptTerminal: 'FAILED' });
        const promoteAllowed = migrationPromote({ current_state: 'MIGRATING' }, { receiptTerminal: 'behavior_verified', promotionReceiptId: 'apr-s16-clean' });
        ev17.production_promotion_receipt_gate = {
          negative_terminals_blocked: negTerminals,
          promote_failed_blocked: promoteDenied.ok === false && promoteDenied.code === 'PROMOTION_BLOCKED',
          promote_verified_receipt_issued: promoteAllowed.ok === true && promoteAllowed.data && promoteAllowed.data.promotionReceipt && promoteAllowed.data.promotionReceipt.receiptId === 'apr-s16-clean',
        };
        ev17.checks.promotion_receipt_issued_only_after_evidence_gate = negTerminals && promoteDenied.ok === false && promoteAllowed.ok === true;
        // AS-2 三张已 PRIMARY migration-record 回放兼容（GOV-AUTHORITY 任务一第 4 条）：真实 authority 对既有合法链放行
        const as2Dirs = ['AS-2-first', 'AS-2-security', 'AS-2-sentinel'];
        const as2Replays = as2Dirs.map((d) => {
          const rec = JSON.parse(fs.readFileSync(path.join(ROOT, 'test-reports', 'autopilot-work', d, 'migration-record.json'), 'utf8'));
          const r = replayTransitions(rec);
          return { record: d, ok: r.ok === true, terminal: r.data && r.data.current, code: r.code };
        });
        ev17.as2_replay_compatibility = as2Replays;
        ev17.checks.as2_three_records_replay_allowed = as2Replays.every((r) => r.ok && r.terminal === 'PRIMARY');
        s16_2ok = ev17.checks.three_shapes_detected && ev17.checks.shadow_to_migrating_denied_all && ev17.checks.migrating_to_primary_denied_all && ev17.checks.clean_record_allowed && ev17.checks.receipt_negative_terminal_blocks_verified && ev17.checks.promotion_receipt_issued_only_after_evidence_gate && ev17.checks.as2_three_records_replay_allowed;
        s16_2detail = 'shadow FAIL: spectral 真扫 ' + (rShadow.contract ? rShadow.contract.findings_total : '?') + ' findings pass=false ' + (shadowFail ? '✓' : 'FAIL') + ' | rollback FAIL: SPECTRAL_NOT_AVAILABLE 无旗标拒绝 ' + (rollbackFail ? '✓' : 'FAIL') + ' | runtime_binding FAIL: SPECTRAL_OUTPUT_INVALID ' + (bindingFail ? '✓' : 'FAIL') + ' | SHADOW→MIGRATING×3 形态全拒（生产 authority MIGRATION_BLOCKED）' + (ev17.checks.shadow_to_migrating_denied_all ? '✓' : 'FAIL') + ' | MIGRATING→PRIMARY×3 形态全拒 ' + (ev17.checks.migrating_to_primary_denied_all ? '✓' : 'FAIL') + ' | 干净记录放行（非恒拒）' + (ev17.checks.clean_record_allowed ? '✓' : 'FAIL') + ' | receipt 负终态→verified 拒绝 ' + (ev17.checks.receipt_negative_terminal_blocks_verified ? '✓' : 'FAIL') + ' | 生产 promotionReceipt 生成处校验（负终态全拒/verified 签发）' + (ev17.checks.promotion_receipt_issued_only_after_evidence_gate ? '✓' : 'FAIL') + ' | AS-2 三张回放兼容 ' + (ev17.checks.as2_three_records_replay_allowed ? '✓' : 'FAIL ' + JSON.stringify(as2Replays));
        fs.writeFileSync(path.join(REMED_DIR, 's16-2-migration-plane.json'), JSON.stringify(ev17, null, 2));
        fs.rmSync(wsM, { recursive: true, force: true }); fs.rmSync(wsRDir, { recursive: true, force: true });
      } catch (e) {
        s16_2detail = 'probe exception: ' + e.message;
        fs.writeFileSync(path.join(REMED_DIR, 's16-2-migration-plane.json'), JSON.stringify(Object.assign(ev17, { exception: e.message, verdict: 'FAIL' }), null, 2));
      }
      section('S16-2 Migration plane：三失败形态真实机验器 → SHADOW→MIGRATING 与 MIGRATING→PRIMARY 均拒绝', s16_2ok, s16_2detail + '（证据 REMEDIATION-2/s16-2-migration-plane.json）');
    }

    // ── S16-3 Cross-plane：migration sourceEvidence 引用 FAILED/UNRESOLVED execution receipt 阻断 promotion ──
    // 真实机验器 = phase.transition 前置谓词 receiptCoverage/depPrecondition（消费 scripts/lib/receipt.mjs
    // validateReceipt 事件重放终态）：状态层伪装 done 的上游，其 receipt 终态 FAILED → planning→executing
    // 拒绝（DEP_PRECONDITION/consumption 未达要求类别）；对照组 behavior_verified → 放行（非恒拒）。
    // promotionReceipt 生成处校验 = validatePromotionEvidence（sourceEvidence.terminal ∈
    // {FAILED,UNRESOLVED,INVALID,缺失} → PROMOTION_BLOCKED；仅 behavior_verified 放行）。
    {
      let s16_3ok = false; let s16_3detail = 'FAIL';
      const ev18 = { schema: 's16-cross-plane@1.0.0', at: new Date().toISOString(), checks: {} };
      try {
        const { transitionPhase } = await import('./lib/phase.mjs');
        const { receiptAppend, verifyReceiptFile } = await import('./lib/receipt.mjs');
        const crypto = await import('node:crypto');
        const sha256 = (b) => crypto.createHash('sha256').update(b).digest('hex');
        const srcHash = sha256(fs.readFileSync(path.join(ROOT, 'vendor', 'implementation', 'implementation.md')));
        const payload = 'Unified implementation agent body bytes here for payload.';
        const buildUpstream = async (ws, terminate) => {
          const mkEvent = (transition, evidence, key) => ({ transition, assetId: 'implementation', sourceHash: srcHash, session: 's', idempotencyKey: key, evidence, subtaskId: 's-0' });
          const dir = path.join(ws, 'artifacts', 's-0'); fs.mkdirSync(dir, { recursive: true });
          fs.writeFileSync(path.join(dir, 'brief.md'), '## 方法论正文（资产全文）\n\n' + payload + '\n\n---\n执行要求：x');
          fs.writeFileSync(path.join(dir, 'plan.md'), '# 实现资产标题\n\n' + payload + '\n\nAdditional real content: acceptance criteria.');
          const chain = [
            ['discovered', { catalogCacheIdentity: 'c', sourceHash: srcHash }, 'k1'],
            ['eligible', { phaseEligibility: { eligible: true } }, 'k2'],
            ['selected', { planId: 'p', subtaskId: 's-0', sourceHash: srcHash }, 'k3'],
            ['instructions_delivered', { activationLevel: 'body', payloadSha256: sha256(payload), briefPath: 'brief.md', sourceHashEcho: srcHash, budgetResult: { ok: true } }, 'k4'],
            ['execution_observed', { artifactPath: 'plan.md', artifactSha256: sha256(fs.readFileSync(path.join(dir, 'plan.md'))), executed: true }, 'k5'],
          ];
          for (const [t, evidence, key] of chain) receiptAppend({ event: mkEvent(t, evidence, key), opts: { workspace: ws, vendorDir: path.join(ROOT, 'vendor') } });
          if (terminate === 'FAILED') receiptAppend({ event: mkEvent('verification_failed', { behaviorCheck: { result: 'FAILED', checkId: 's-0#implementation' }, reason: 'behavior mismatch' }, 'k6'), opts: { workspace: ws, vendorDir: path.join(ROOT, 'vendor') } });
          else if (terminate === 'UNRESOLVED') receiptAppend({ event: mkEvent('unresolved', { behaviorCheck: { result: 'UNRESOLVED', checkId: 's-0#implementation' }, reason: 'unresolved at check' }, 'k6'), opts: { workspace: ws, vendorDir: path.join(ROOT, 'vendor') } });
          else if (terminate === 'behavior_verified') receiptAppend({ event: mkEvent('behavior_verified', { behaviorCheck: { result: 'VERIFIED', checkId: 's-0#implementation', reason: null }, evidenceRefs: [1, 2, 3, 4, 5].map((n) => ({ eventSeq: n })) }, 'k6'), opts: { workspace: ws, vendorDir: path.join(ROOT, 'vendor') } });
          return verifyReceiptFile(ws, 's-0');
        };
        const attemptPlanningToExecuting = async (terminate) => {
          const ws = fs.mkdtempSync(path.join(os.tmpdir(), 'tt-s16-xp-'));
          const mkOpts = () => ({ now: new Date('2026-09-26T00:00:00Z'), env: { YY_GATE_MODE: 'legacy-warn', YY_SESSION_MODE: 'legacy' } });
          await transitionPhase({ workspace: ws, from: 'idle', to: 'planning', opts: mkOpts() });
          const vr = await buildUpstream(ws, terminate);
          // cross-plane 注入：状态层把上游伪装成 done（状态层骗过 ≠ receipt 层骗过）
          const st = JSON.parse(fs.readFileSync(path.join(ws, '.tt-state', 'state.json'), 'utf8'));
          st.requireExec = true; st.preconditions = ['x'];
          st.subtasks = [{ id: 's-0', asset: 'implementation', status: 'done', assetConsumed: true, dependsOn: [] }, { id: 's-1', asset: 'security', status: 'idle', dependsOn: ['s-0'] }];
          fs.writeFileSync(path.join(ws, '.tt-state', 'state.json'), JSON.stringify(st, null, 2));
          const r = await transitionPhase({ workspace: ws, from: 'planning', to: 'executing', opts: mkOpts() });
          fs.rmSync(ws, { recursive: true, force: true });
          return { receipt_terminal: vr.data && vr.data.state, verified: vr.data && vr.data.verified, transition_ok: r.ok, code: r.code, reason: r.data && r.data.reason };
        };
        const failedCase = await attemptPlanningToExecuting('FAILED');
        const unresolvedCase = await attemptPlanningToExecuting('UNRESOLVED');
        const verifiedCase = await attemptPlanningToExecuting('behavior_verified');
        ev18.failed_upstream = failedCase; ev18.unresolved_upstream = unresolvedCase; ev18.verified_upstream = verifiedCase;
        // promotionReceipt 生成处校验（迁移面）= 生产 authority migration.validatePromotionEvidence
        // （GOV-AUTHORITY 任务一：S16-3 内自造 oracle 删除——本断言消费 scripts/lib/migration.mjs 单点）：
        // sourceEvidence 引用 receipt 终态，FAILED/UNRESOLVED/INVALID/缺失 → 阻断
        const { validatePromotionEvidence } = await import('./lib/migration.mjs');
        const ev19 = ['FAILED', 'UNRESOLVED', 'INVALID'].map((t) => ({ terminal: t, blocked: validatePromotionEvidence(t).ok === false })).every((x) => x.blocked) && validatePromotionEvidence('behavior_verified').ok === true && validatePromotionEvidence(null).ok === false;
        ev18.promotion_evidence_gate = { failed_unresolved_invalid_blocked: ev19 };
        ev18.checks.failed_receipt_blocks = failedCase.transition_ok === false && /^PHASE_PREREQ_UNMET$/.test(String(failedCase.code));
        ev18.checks.unresolved_receipt_blocks = unresolvedCase.transition_ok === false;
        ev18.checks.verified_receipt_allows = verifiedCase.transition_ok === true;
        s16_3ok = ev18.checks.failed_receipt_blocks && ev18.checks.unresolved_receipt_blocks && ev18.checks.verified_receipt_allows && ev18.promotion_evidence_gate.failed_unresolved_invalid_blocked;
        s16_3detail = '状态层 done + receipt 终态 FAILED → planning→executing 拒绝（' + failedCase.code + '）' + (ev18.checks.failed_receipt_blocks ? ' ✓' : ' FAIL') + ' | receipt 终态 UNRESOLVED 同拒 ' + (ev18.checks.unresolved_receipt_blocks ? '✓' : ' FAIL') + ' | 对照组 behavior_verified 放行（非恒拒）' + (ev18.checks.verified_receipt_allows ? ' ✓' : ' FAIL') + ' | promotionReceipt 生成处校验 FAILED/UNRESOLVED/INVALID/缺失全阻断 ' + (ev18.promotion_evidence_gate.failed_unresolved_invalid_blocked ? '✓' : ' FAIL');
        fs.writeFileSync(path.join(REMED_DIR, 's16-3-cross-plane.json'), JSON.stringify(ev18, null, 2));
      } catch (e) {
        s16_3detail = 'probe exception: ' + e.message;
        fs.writeFileSync(path.join(REMED_DIR, 's16-3-cross-plane.json'), JSON.stringify(Object.assign(ev18, { exception: e.message, verdict: 'FAIL' }), null, 2));
      }
      section('S16-3 Cross-plane：FAILED/UNRESOLVED execution receipt 阻断 promotion（对照 verified 放行）', s16_3ok, s16_3detail + '（证据 REMEDIATION-2/s16-3-cross-plane.json）');
    }

  }

  // ── S17 九场景兼容与负向矩阵（W2-3，2026-09-27；Ingress Mini-Contract D.5，派单 handoffs/v3/W2-3-dispatch.md）──
  // 九场景全部调生产函数（planner/applyCapabilityToPlan/capability-derivation/activation resolver/runtime
  // dispatch/executePlan/governanceFor），禁自造 oracle（F-036 教训）——判定函数只核对生产产物上的
  // 具名码/具名留痕，不复刻资格语义；「静默」是唯一被拒形态。反例注入三连证明判定有牙。
  {
    const W23_DIR = path.join(ROOT, 'test-reports', 'autopilot-work', 'W2-3');
    fs.mkdirSync(W23_DIR, { recursive: true });
    const s17GateSaved = process.env.TT_GATE_MODE;
    process.env.TT_GATE_MODE = 'warn'; // fake adapter 零产物 → gate 官方 warn 档（W2-2 同法；段末还原不外溢其他段）
    const s17Tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'tt-s17-'));
    const evidence = { schema: 's17-nine-scenarios@1.0.0', at: new Date().toISOString(), contract: 'plans/W2-0-ground-truth-ingress-contract-20260927.md#D.5', dispatchDoc: 'handoffs/v3/W2-3-dispatch.md', productionSurfaces: {}, scenarios: [], counterExamples: [], governance: {}, deviations: [] };
    try {
      const { buildPlan, route } = await import('./lib/planner.mjs');
      const { deriveCapability, resolveCapabilityAsset, CapabilityIngressError } = await import('./lib/capability-derivation.mjs');
      const { resolveAssetEligibility, CATALOG_IDS } = await import('./lib/activation.mjs');
      const { dispatch, executePlan, createContextBus } = await import('./lib/runtime.mjs');
      const { applyCapabilityToPlan } = await import('./lib/orchestrator.mjs');
      const { governanceFor, governanceEventForFailureCode } = await import('./lib/governance.mjs');
      const { default: createStore } = await import('./lib/store.mjs');
      evidence.productionSurfaces = {
        planner: 'scripts/lib/planner.mjs buildPlan(第3参 options)/route（W2-1）',
        planPostProcess: 'scripts/lib/orchestrator.mjs applyCapabilityToPlan（W2-1）',
        derivation: 'scripts/lib/capability-derivation.mjs deriveCapability/resolveCapabilityAsset（W2-1）',
        resolver: 'scripts/lib/activation.mjs resolveAssetEligibility/CAPABILITY_MAP（CD-1 单点）',
        runtime: 'scripts/lib/runtime.mjs dispatch(CD-1 capability 输入/AV-3 资格门/W2-2 selectedAsset 透传)/executePlan',
        governance: 'scripts/lib/governance.mjs governanceFor(FROZEN_STAGE_EVENT_BINDINGS 两键)/governanceEventForFailureCode',
      };

      const REAL_MANIFEST = path.join(ROOT, 'contracts', 'asset-manifest-v2.json');
      const realRows = JSON.parse(fs.readFileSync(REAL_MANIFEST, 'utf8'));
      // planner 对 manifest 的唯一读面是 entries[].name（W2-1 D-W21-5 / W2-2 D-W22-5 同法合成）
      const synthManifest = () => ({ manifestSource: 'synthetic:CATALOG_IDS', entries: CATALOG_IDS.map((n) => ({ name: n })) });
      const capLogger = () => { const lines = []; return { lines, info(m) { lines.push(['info', String(m)]); }, warn(m) { lines.push(['warn', String(m)]); }, error(m) { lines.push(['error', String(m)]); } }; };
      const baseOpts = () => ({ manifestPath: REAL_MANIFEST, resolveAdapter: () => ({ name: 'fake-probe', run: async () => ({ ok: true, executed: true, artifactPath: null, assetConsumed: true }) }), maxRetries: 1, verbose: false, logger: capLogger() });
      const overrideLogged = (opts) => opts.logger.lines.some(([, m]) => /被 capability 解析覆盖/.test(m));

      // ── 判定函数（只核对生产产物具名码/具名留痕；真实观察与注入反例共用同一判定，证明非恒真）──
      // judge4：冲突场景唯一被拒形态 = 静默取一（重绑定且零具名留痕）。具名 skip（D.5 行4 原义）或
      // 具名留痕（生产现状：override 日志 + resolver 解析链）二者其一在场即非静默。
      const judge4 = function (obs) {
        if (obs.skipped && obs.error === 'CAPABILITY_ASSET_CONFLICT') return { ok: true, form: 'D.5 具名 skip（CAPABILITY_ASSET_CONFLICT）' };
        if (obs.skipped) return { ok: false, violation: 'S17-4 冲突场景被 skip 但具名码不是 CAPABILITY_ASSET_CONFLICT: ' + String(obs.error) };
        if (!obs.reboundAsset || !obs.selectedAsset) return { ok: false, violation: 'S17-4 无解析产物（reboundAsset/selectedAsset 缺失即无判定对象）' };
        if (obs.selectedAsset !== obs.reboundAsset) return { ok: false, violation: 'S17-4 selectedAsset 与重绑定 asset 不一致（D.3 双写一致性破坏）' };
        if (!obs.overrideLogged && !obs.reasonChained) return { ok: false, violation: 'S17-4 CAPABILITY_ASSET_CONFLICT: 静默取一（冲突 asset 被取一且零具名留痕——D.5「不静默取一」明令禁止）' };
        return { ok: true, form: 'capability 为准重绑定 + 具名留痕（override 日志:' + (obs.overrideLogged ? '在场' : '无') + ' resolver解析链:' + (obs.reasonChained ? '在场' : '无') + '）——非静默；D.5 具名 skip 码缺口 D-W23-1 登记' };
      };
      const judge5 = function (obs) {
        if (!obs.skipped) return { ok: false, violation: 'S17-5 INELIGIBLE_CAPABILITY_UNKNOWN 缺失：unknown capability 未具名 skip（静默 ' + String(obs.status || '执行') + '）' };
        if (obs.error !== 'INELIGIBLE_CAPABILITY_UNKNOWN') return { ok: false, violation: 'S17-5 skip 码不符（期望 INELIGIBLE_CAPABILITY_UNKNOWN，实得 ' + String(obs.error) + '）' };
        return { ok: true, form: 'INELIGIBLE_CAPABILITY_UNKNOWN 具名 skip（不静默 done）' };
      };
      const judge9 = function (obs) {
        if (obs.threw === 'CAPABILITY_CLUSTER_MISMATCH') return { ok: true, form: 'plan 层 CAPABILITY_CLUSTER_MISMATCH fail-closed throw（严格于 subtask 级 skip，D-W21-3 口径）' };
        if (obs.threw) return { ok: false, violation: 'S17-9 拒绝码不符: ' + String(obs.threw) };
        if (obs.mappedAsset && Array.isArray(obs.clusterCandidates) && !obs.clusterCandidates.includes(obs.mappedAsset)) return { ok: false, violation: 'S17-9 CAPABILITY_CLUSTER_MISMATCH: capability 解析 asset 不在簇 candidates 未拒（静默放行）' };
        return { ok: false, violation: 'S17-9 观察形态不可判（无 throw 且无簇失配前提）' };
      };

      // ── S17-1 capability only（合法）→ 解析+执行 ──
      try {
        const pre = await resolveAssetEligibility({ capability: 'security-audit' }, { manifestPath: REAL_MANIFEST });
        const sub = { id: 's17-1', capability: 'security-audit' };
        const r = await dispatch(sub, createContextBus(), baseOpts());
        const ok = pre.eligible === true && pre.selected_asset === 'security'
          && r.ok === true && r.skipped !== true && sub.status === 'done'
          && sub.asset === 'security' && sub.selectedAsset === 'security'
          && !!sub.eligibility && sub.eligibility.eligible === true && sub.eligibility.reason.some((x) => /capability match/.test(x));
        evidence.scenarios.push({ id: 'S17-1', scenario: 'capability only（合法）', observed: { resolver: { selected_asset: pre.selected_asset, eligible: pre.eligible }, runtime: { ok: r.ok, skipped: !!r.skipped, status: sub.status, asset: sub.asset || null, selectedAsset: sub.selectedAsset || null } }, verdict: ok ? 'PASS' : 'FAIL' });
        section('S17-1 capability only（合法）→ 解析+执行', ok, ok ? 'resolver security-audit→security ✓ dispatch（零 asset 输入）解析绑定并执行 done ✓ selectedAsset 双写 ✓' : 'FAIL 详见 W2-3/s17-nine-scenarios.json');
      } catch (e) { evidence.scenarios.push({ id: 'S17-1', verdict: 'FAIL', exception: e.message }); section('S17-1 capability only（合法）→ 解析+执行', false, 'probe exception: ' + e.message); }

      // ── S17-2 asset only（legacy）→ 现行为零改动 ──
      try {
        const sub = { id: 's17-2', asset: 'implementation' };
        const r = await dispatch(sub, createContextBus(), baseOpts());
        const ok = r.ok === true && r.skipped !== true && sub.status === 'done' && sub.asset === 'implementation'
          && !('capability' in sub) && !('capabilitySource' in sub) && !('selectedAsset' in sub)
          && !!sub.eligibility && sub.eligibility.eligible === true && !('capability' in sub.eligibility);
        evidence.scenarios.push({ id: 'S17-2', scenario: 'asset only（legacy）', observed: { status: sub.status, newFields: ['capability', 'capabilitySource', 'selectedAsset'].filter((k) => k in sub), eligibilityKeys: Object.keys(sub.eligibility || {}) }, verdict: ok ? 'PASS' : 'FAIL' });
        section('S17-2 asset only（legacy）→ 现行为零改动', ok, ok ? 'name-based 全链 done ✓ 零新增字段（capability/capabilitySource/selectedAsset 均不在场，eligibility 无 capability 键）✓' : 'FAIL 详见 W2-3/s17-nine-scenarios.json');
      } catch (e) { evidence.scenarios.push({ id: 'S17-2', verdict: 'FAIL', exception: e.message }); section('S17-2 asset only（legacy）→ 现行为零改动', false, 'probe exception: ' + e.message); }

      // ── S17-3 capability + matching asset → 允许，双写 selectedAsset ──
      try {
        const sub = { id: 's17-3', asset: 'security', capability: 'security-audit' };
        const opts = baseOpts();
        const r = await dispatch(sub, createContextBus(), opts);
        const ok = r.ok === true && r.skipped !== true && sub.status === 'done'
          && sub.asset === 'security' && sub.selectedAsset === 'security'
          && !!sub.eligibility && sub.eligibility.capability === 'security-audit'
          && !overrideLogged(opts); // 本就一致 → 不得出现 override 痕
        evidence.scenarios.push({ id: 'S17-3', scenario: 'capability + matching asset', observed: { status: sub.status, asset: sub.asset, selectedAsset: sub.selectedAsset || null, eligibilityCapability: sub.eligibility && sub.eligibility.capability, overrideLog: overrideLogged(opts) }, verdict: ok ? 'PASS' : 'FAIL' });
        section('S17-3 capability+matching asset → 允许并双写 selectedAsset', ok, ok ? 'asset===selectedAsset===security ✓ eligibility.capability 留痕 ✓ 零 override 痕 ✓' : 'FAIL 详见 W2-3/s17-nine-scenarios.json');
      } catch (e) { evidence.scenarios.push({ id: 'S17-3', verdict: 'FAIL', exception: e.message }); section('S17-3 capability+matching asset → 允许并双写 selectedAsset', false, 'probe exception: ' + e.message); }

      // ── S17-4 capability + conflicting asset → 非静默取一（生产现状=重绑定+具名留痕；D.5 skip 码缺口 D-W23-1）──
      try {
        const sub = { id: 's17-4', asset: 'implementation', capability: 'security-audit' };
        const opts = baseOpts();
        const r = await dispatch(sub, createContextBus(), opts);
        const obs = { skipped: r.skipped === true, error: r.error || null, status: sub.status, reboundAsset: sub.asset || null, selectedAsset: sub.selectedAsset || null, overrideLogged: overrideLogged(opts), reasonChained: !!(sub.eligibility && sub.eligibility.reason && sub.eligibility.reason.some((x) => /capability match/.test(x))) };
        const v = judge4(obs);
        evidence.scenarios.push({ id: 'S17-4', scenario: 'capability + conflicting asset', observed: obs, verdict: v.ok ? 'PASS' : 'FAIL', judge: v, d5Row4NamedSkipImplemented: false, deviation: 'D-W23-1' });
        section('S17-4 capability+conflicting asset → 非静默取一（D.5 skip 码缺口 D-W23-1 登记）', v.ok, v.ok ? v.form + '：implementation→security 重绑定可观测、可回查' : v.violation);
      } catch (e) { evidence.scenarios.push({ id: 'S17-4', verdict: 'FAIL', exception: e.message }); section('S17-4 capability+conflicting asset → 非静默取一（D.5 skip 码缺口 D-W23-1 登记）', false, 'probe exception: ' + e.message); }

      // ── S17-5 unknown capability → INELIGIBLE_CAPABILITY_UNKNOWN skip（runtime）+ CAPABILITY_UNKNOWN throw（planner）──
      try {
        const sub = { id: 's17-5', asset: 'security', capability: 'no-such-capability' };
        const r = await dispatch(sub, createContextBus(), baseOpts());
        const v = judge5({ skipped: r.skipped === true, error: r.error || sub.error || null, status: sub.status });
        let plannerThrow = null;
        try { buildPlan('数据库 schema 迁移', synthManifest(), { capability: 'no-such-capability' }); } catch (e) { plannerThrow = (e instanceof CapabilityIngressError && e.code === 'CAPABILITY_UNKNOWN') ? 'CAPABILITY_UNKNOWN' : 'WRONG:' + e.message; }
        const ok = v.ok && plannerThrow === 'CAPABILITY_UNKNOWN' && sub.status === 'skipped' && sub.adapter === 'none';
        evidence.scenarios.push({ id: 'S17-5', scenario: 'unknown capability', observed: { runtime: v, plannerThrow, subStatus: sub.status, subAdapter: sub.adapter }, verdict: ok ? 'PASS' : 'FAIL' });
        section('S17-5 unknown capability → INELIGIBLE_CAPABILITY_UNKNOWN skip + CAPABILITY_UNKNOWN throw', ok, ok ? 'runtime 具名 skip（mode=skipped/adapter=none，不静默 done）✓ planner 层 CapabilityIngressError CAPABILITY_UNKNOWN fail-closed ✓' : 'FAIL runtime=' + JSON.stringify(v) + ' plannerThrow=' + plannerThrow);
      } catch (e) { evidence.scenarios.push({ id: 'S17-5', verdict: 'FAIL', exception: e.message }); section('S17-5 unknown capability → INELIGIBLE_CAPABILITY_UNKNOWN skip + CAPABILITY_UNKNOWN throw', false, 'probe exception: ' + e.message); }

      // ── S17-6 ineligible selected asset → 既有资格门 INELIGIBLE_WHEN_NOT_TO_USE skip ──
      try {
        const secRow = realRows.find((x) => x.id === 'security');
        const ntuEntry = String((secRow && secRow.when_not_to_use || [])[0] || '');
        const sub = { id: 's17-6', capability: 'security-audit' };
        const r = await dispatch(sub, createContextBus(), Object.assign(baseOpts(), { eligibilityRequirements: [ntuEntry] }));
        const ok = ntuEntry.length > 0 && r.skipped === true && r.error === 'INELIGIBLE_WHEN_NOT_TO_USE' && sub.status === 'skipped'
          && !!sub.eligibility && sub.eligibility.eligible === false
          && sub.eligibility.reason.some((x) => /INELIGIBLE_WHEN_NOT_TO_USE/.test(x));
        evidence.scenarios.push({ id: 'S17-6', scenario: 'ineligible selected asset（既有资格门）', observed: { ntuEntry, skipped: r.skipped === true, error: r.error || null, status: sub.status, reasonTokens: sub.eligibility && sub.eligibility.reason.filter((x) => /INELIGIBLE_/.test(x)) }, verdict: ok ? 'PASS' : 'FAIL' });
        section('S17-6 ineligible selected asset → 既有资格门 INELIGIBLE_WHEN_NOT_TO_USE skip', ok, ok ? 'capability 选中 security → when_not_to_use 负向命中 → 具名 skip（走既有 resolver 资格门，不静默派单）✓' : 'FAIL 详见 W2-3/s17-nine-scenarios.json');
      } catch (e) { evidence.scenarios.push({ id: 'S17-6', verdict: 'FAIL', exception: e.message }); section('S17-6 ineligible selected asset → 既有资格门 INELIGIBLE_WHEN_NOT_TO_USE skip', false, 'probe exception: ' + e.message); }

      // ── S17-7 dropped selected asset → 既有 drop 检查（manifest 行缺失 / drop_pending 硬门）具名 skip ──
      try {
        const rowsNoReview = realRows.filter((x) => x.id !== 'review');
        const resRows = await resolveAssetEligibility({ capability: 'code-review' }, { manifestRows: rowsNoReview });
        const fixturePath = path.join(s17Tmp, 'manifest-no-review.json');
        fs.writeFileSync(fixturePath, JSON.stringify(rowsNoReview, null, 2));
        const sub = { id: 's17-7', capability: 'code-review' };
        const r = await dispatch(sub, createContextBus(), Object.assign(baseOpts(), { manifestPath: fixturePath }));
        const rowsDropPending = realRows.map((x) => x.id === 'review' ? Object.assign({}, x, { drop_pending: true, drop_allowed: false }) : x);
        const resDrop = await resolveAssetEligibility({ capability: 'code-review' }, { manifestRows: rowsDropPending });
        const ok = resRows.eligible === false && /ASSET_NOT_FOUND/.test(resRows.reason.join(' | '))
          && r.skipped === true && r.error === 'INELIGIBLE_ASSET_NOT_FOUND' && sub.status === 'skipped'
          && resDrop.eligible === false && /INELIGIBLE_DROP_PENDING/.test(resDrop.reason.join(' | '));
        evidence.scenarios.push({ id: 'S17-7', scenario: 'dropped selected asset（既有 drop 检查）', observed: { resolverRowMissing: { eligible: resRows.eligible, hasAssetNotFound: /ASSET_NOT_FOUND/.test(resRows.reason.join(' | ')) }, runtimeRowMissing: { skipped: r.skipped === true, error: r.error || null, status: sub.status }, resolverDropPending: { eligible: resDrop.eligible, hasDropPendingCode: /INELIGIBLE_DROP_PENDING/.test(resDrop.reason.join(' | ')) } }, verdict: ok ? 'PASS' : 'FAIL' });
        section('S17-7 dropped selected asset → 既有 drop 检查具名 skip（ASSET_NOT_FOUND / INELIGIBLE_DROP_PENDING）', ok, ok ? 'manifest 行缺失 → runtime INELIGIBLE_ASSET_NOT_FOUND skip ✓ resolver 纯函数注入同判 ✓ drop_pending&&!drop_allowed → INELIGIBLE_DROP_PENDING ✓' : 'FAIL 详见 W2-3/s17-nine-scenarios.json');
      } catch (e) { evidence.scenarios.push({ id: 'S17-7', verdict: 'FAIL', exception: e.message }); section('S17-7 dropped selected asset → 既有 drop 检查具名 skip（ASSET_NOT_FOUND / INELIGIBLE_DROP_PENDING）', false, 'probe exception: ' + e.message); }

      // ── S17-8 old persisted plan（无 capability 字段）→ legacy 路径零改写（不重派生，防 replay 漂移）──
      try {
        const legacyPlan = buildPlan('数据库 schema 迁移', synthManifest());
        const ws8 = path.join(s17Tmp, 'ws8');
        await createStore(ws8).save(legacyPlan);
        const prev = await createStore(ws8).load(); // JSON 全量反序列化 = 老 state 缺字段容忍（store.load 单点）
        const prevZero = !JSON.stringify(prev).includes('capability');
        const r = await executePlan(prev, baseOpts());
        const out = JSON.stringify(r.plan);
        const ok = !JSON.stringify(legacyPlan).includes('capability') && prevZero
          && !out.includes('capability') && !out.includes('selectedAsset')
          && r.plan.status === 'done' && r.plan.subtasks.every((s) => s.status === 'done');
        evidence.scenarios.push({ id: 'S17-8', scenario: 'old persisted plan（无 capability 字段）', observed: { legacyPlanZeroFields: !JSON.stringify(legacyPlan).includes('capability'), loadedStateZeroFields: prevZero, resumedOutputZeroCapabilityToken: !out.includes('capability'), resumedOutputZeroSelectedAssetToken: !out.includes('selectedAsset'), planStatus: r.plan.status }, verdict: ok ? 'PASS' : 'FAIL' });
        section('S17-8 old persisted plan（无 capability 字段）→ legacy 零改写', ok, ok ? 'save→load→executePlan 全链 0 处 capability/selectedAsset 字样（不重派生、不迁移改写历史 state）✓' : 'FAIL 详见 W2-3/s17-nine-scenarios.json');
      } catch (e) { evidence.scenarios.push({ id: 'S17-8', verdict: 'FAIL', exception: e.message }); section('S17-8 old persisted plan（无 capability 字段）→ legacy 零改写', false, 'probe exception: ' + e.message); }

      // ── S17-9 cluster 与 capability 解析的 asset 不在同簇 → CAPABILITY_CLUSTER_MISMATCH fail-closed ──
      try {
        const derived = deriveCapability('前端页面功能拆解');
        const mappedAsset = derived ? resolveCapabilityAsset(derived.key) : null;
        const routed = route('前端页面功能拆解', synthManifest());
        const premise = !!derived && derived.key === 'feature-breakdown' && mappedAsset === 'dev-planner'
          && routed.id === 'T4_FRONTEND' && !routed.candidates.includes('dev-planner');
        let derivedThrow = null;
        try { buildPlan('前端页面功能拆解', synthManifest()); } catch (e) { derivedThrow = (e instanceof CapabilityIngressError && e.code === 'CAPABILITY_CLUSTER_MISMATCH') ? 'CAPABILITY_CLUSTER_MISMATCH' : 'WRONG:' + e.message; }
        let explicitThrow = null;
        try { applyCapabilityToPlan(buildPlan('数据库 schema 迁移', synthManifest()), { capability: 'feature-breakdown' }); } catch (e) { explicitThrow = (e instanceof CapabilityIngressError && e.code === 'CAPABILITY_CLUSTER_MISMATCH') ? 'CAPABILITY_CLUSTER_MISMATCH' : 'WRONG:' + e.message; }
        const obs = { threw: (derivedThrow === 'CAPABILITY_CLUSTER_MISMATCH' && explicitThrow === 'CAPABILITY_CLUSTER_MISMATCH') ? 'CAPABILITY_CLUSTER_MISMATCH' : (String(derivedThrow) + ' / ' + String(explicitThrow)), mappedAsset, clusterCandidates: routed.candidates, premise };
        const v = judge9(obs);
        const ok = premise && v.ok;
        evidence.scenarios.push({ id: 'S17-9', scenario: 'cluster×capability 不在同簇', observed: { derived: derived && { key: derived.key, matchedKey: derived.matchedKey }, mappedAsset, routedCluster: routed.id, derivedAxisThrow: derivedThrow, explicitAxisThrow: explicitThrow, judge: v }, verdict: ok ? 'PASS' : 'FAIL' });
        section('S17-9 cluster×capability 不在同簇 → CAPABILITY_CLUSTER_MISMATCH fail-closed', ok, ok ? '派生轴（T4_FRONTEND×feature-breakdown→dev-planner）throw ✓ 显式轴（applyCapabilityToPlan T1×feature-breakdown）throw ✓ 不静默取一 ✓' : 'FAIL premise=' + premise + ' judge=' + JSON.stringify(v));
      } catch (e) { evidence.scenarios.push({ id: 'S17-9', verdict: 'FAIL', exception: e.message }); section('S17-9 cluster×capability 不在同簇 → CAPABILITY_CLUSTER_MISMATCH fail-closed', false, 'probe exception: ' + e.message); }

      // ── S17-CE 注入反例三连：三种「静默」形态必须被判定具名 FAIL（证明探针有牙，非恒真 vacuous）──
      try {
        const ce1 = judge4({ skipped: false, error: null, status: 'done', reboundAsset: 'security', selectedAsset: 'security', overrideLogged: false, reasonChained: false });
        const ce2 = judge5({ skipped: false, error: null, status: 'done' });
        const ce3 = judge9({ threw: null, mappedAsset: 'dev-planner', clusterCandidates: ['frontend-design', 'planning', 'review', 'security'] });
        const teethOk = !ce1.ok && /CAPABILITY_ASSET_CONFLICT/.test(String(ce1.violation))
          && !ce2.ok && /INELIGIBLE_CAPABILITY_UNKNOWN/.test(String(ce2.violation))
          && !ce3.ok && /CAPABILITY_CLUSTER_MISMATCH/.test(String(ce3.violation));
        evidence.counterExamples = [
          { id: 'CE-1', injected: '场景4 静默取一（冲突 asset 被重绑定且零具名留痕——派单点名的反例形态）', expect: 'FAIL 具名 CAPABILITY_ASSET_CONFLICT', fired: ce1.ok === false, violation: ce1.violation || null },
          { id: 'CE-2', injected: '场景5 unknown capability 静默 done（未具名 skip）', expect: 'FAIL 具名 INELIGIBLE_CAPABILITY_UNKNOWN', fired: ce2.ok === false, violation: ce2.violation || null },
          { id: 'CE-3', injected: '场景9 簇失配静默放行（解析 asset 不在簇 candidates 仍照常产出）', expect: 'FAIL 具名 CAPABILITY_CLUSTER_MISMATCH', fired: ce3.ok === false, violation: ce3.violation || null },
        ];
        const missed = evidence.counterExamples.filter((c) => !c.fired).map((c) => c.id);
        section('S17-CE 注入反例三连（静默取一/静默执行/静默放行）→ 判定全数具名 FAIL', teethOk, teethOk ? 'CE-1/CE-2/CE-3 三种静默形态全被抓（判定与真实观察共用，非恒真）' : 'FAIL 静默形态漏抓: ' + missed.join(','));
      } catch (e) { evidence.counterExamples.push({ id: 'S17-CE', verdict: 'FAIL', exception: e.message }); section('S17-CE 注入反例三连（静默取一/静默执行/静默放行）→ 判定全数具名 FAIL', false, 'probe exception: ' + e.message); }

      // ── S17-GOV 具名失败码 → governance 冻结事件两键匹配（FROZEN_STAGE_EVENT_BINDINGS：stage 且 event 双命中）──
      try {
        const govCodes = ['INELIGIBLE_CAPABILITY_UNKNOWN', 'INELIGIBLE_WHEN_NOT_TO_USE', 'INELIGIBLE_ASSET_NOT_FOUND', 'INELIGIBLE_DROP_PENDING', 'RESOLVER_INTERNAL_ERROR', 'CAPABILITY_MISSING'];
        const mapped = govCodes.map((c) => ({ code: c, event: governanceEventForFailureCode(c) }));
        const frHit = governanceFor('failure_recovery', 'gate_failed');
        const allMapped = mapped.every((m) => m.event === 'gate_failed');
        const frOk = !!frHit && frHit.skill === 'systematic-debugging' && typeof frHit.body === 'string' && frHit.body.length > 0;
        const negEvent = governanceFor('failure_recovery', 'stage_7') === null; // event 不在 failure_recovery 冻结集 → null
        const negStage = governanceFor('implementation', 'gate_failed') === null; // stage 不匹配 → null
        const negUnmapped = governanceEventForFailureCode('S17_NOT_A_CODE') === null; // 未映射码 → null（不语义扩张）
        const ok = allMapped && frOk && negEvent && negStage && negUnmapped;
        evidence.governance = { mapped, failure_recovery_gate_failed_hit: { skill: frHit && frHit.skill, bodyBytes: frHit && frHit.body ? Buffer.byteLength(frHit.body) : 0, truncated: !!(frHit && frHit.truncated) }, twoKeyNegatives: { event_not_in_frozen_set: negEvent, stage_mismatch: negStage, unmapped_code_null: negUnmapped } };
        section('S17-GOV 具名失败码 → governance 冻结事件两键匹配', ok, ok ? '6 失败码全映射 gate_failed ✓ failure_recovery×gate_failed 命中（' + (frHit && frHit.skill) + '，超 5KB 截断在档）✓ event/stage/未映射码三负向全 null（fail-closed）✓' : 'FAIL 详见 W2-3/s17-nine-scenarios.json');
      } catch (e) { evidence.governance = { verdict: 'FAIL', exception: e.message }; section('S17-GOV 具名失败码 → governance 冻结事件两键匹配', false, 'probe exception: ' + e.message); }

      evidence.deviations = [
        'D-W23-1: D.5 行4 具名 skip 码 CAPABILITY_ASSET_CONFLICT 未实现（scripts/ 全树 grep 0 命中，2026-09-27 实测）；生产现状 = capability 为准重绑定 + 双重具名留痕（subtask.eligibility.reason「capability match」解析链 + dispatch override logger.info，W2-2 观察项 O-1 同源）。S17-4 判定口径 = 反「静默」：具名 skip 或具名留痕其一在场即过，静默取一即具名 FAIL（CE-1 证明有牙）。skip 化需 scripts/lib/runtime.mjs CD-1 段写面（本单白名单外）→ 留编排者裁定。W2-0 H.1 停单条件未触发（该码是缺席而非生产链误触发）。',
        'D-W23-2: D.5 行9 生产实现为 plan 层 fail-closed throw（buildPlan/applyCapabilityToPlan 的 CAPABILITY_CLUSTER_MISMATCH）——严格于 subtask 级 skip，沿 W2-1 D-W21-3 已登记口径复验（生成期无 subtask 终态语义；同源校验保证规则表映射 asset 全 ∈ 簇，生产任务不可达 mismatch，探针内为注入式构造）。',
        'D-W23-3: 探针替身声明（W2-1 D-W21-5 / W2-2 D-W22-5 同风格）：planner manifest 用 CATALOG_IDS 合成（planner 唯一读面 entries[].name）；dispatch 资格门用真实 contracts/asset-manifest-v2.json（S17-7 drop 夹具=真实行集删 1 行落 os.tmpdir，判定仍由生产 resolver/资格门作出）；adapter 经 B5 DI 注入 fake（不碰真实 vendor adapter）；TT_GATE_MODE=warn 仅段内生效段末还原。',
      ];
    } catch (e) {
      evidence.segmentException = e.message;
      section('S17 九场景兼容与负向矩阵', false, 'segment exception: ' + e.message);
    } finally {
      evidence.finishedAt = new Date().toISOString();
      try { fs.writeFileSync(path.join(W23_DIR, 's17-nine-scenarios.json'), JSON.stringify(evidence, null, 2)); } catch (e2) { /* 证据写失败不掩盖原判定 */ }
      if (s17GateSaved === undefined) delete process.env.TT_GATE_MODE; else process.env.TT_GATE_MODE = s17GateSaved;
      fs.rmSync(s17Tmp, { recursive: true, force: true });
    }
  }

  console.log('\n结果: ' + pass + ' PASS / ' + fail + ' FAIL' + (skip ? ' / ' + skip + ' SKIP' : ''));
  if (failures.length) { for (const f of failures) console.log('  FAILED: ' + f); process.exitCode = 1; }
  else { console.log('回归基线通过。'); }
}

main();
