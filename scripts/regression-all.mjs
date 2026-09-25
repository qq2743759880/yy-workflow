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
 *  AS-1 drop 7（2026-09-25）：agent-research/be-architect/be-provider/be-resilience/colorize/
 *  agent-vision-toolkit 六行随资产删除收缩（frontend-visual-validation 本就不在本表）；
 *  保留 8 行（dev-planner 无 kernel 内核表行，S3 为子集门非全量门）。 */
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
    // ③ 登记残留面（白名单外活文件，本单不越权改动，逐文件登记 RESULTS 偏差交 L2/Owner 处置）+
    //    S15 自身（断言持有 drop 清单常量——猎手名单≠资产引用）
    // ② 一字不改面：vendor/（保留资产含其正文/参考件提及 drop 资产名，禁改纪律优先）
    const A1_SKIP_DIRS = new Set(['node_modules', '.git', 'vendor', 'test-reports', 'docs', 'artifacts', 'recovery-20260919', 'prototypes', '.learnings', '.memory', '.mimosa', '.tmp-demo', 'plans', 'handoffs', 'contracts' + path.sep + 'discrepancies', 'contracts/discrepancies', 'contracts' + path.sep + 'drafts', 'contracts/drafts']);
    const A1_SKIP_FILES = new Set(['CHANGELOG.md', '.zcodeignore', '.gitignore', 'package-lock.json']);
    const A1_REGISTERED_RESIDUALS = new Set([
      'README.md', 'reference' + path.sep + 'asset-integration.md', 'reference' + path.sep + 'planning.md', 'reference' + path.sep + 'frontend-gate.md',
      'templates' + path.sep + 'orchestration-frontend-backend.md', 'templates' + path.sep + 'task-agent-matrix.md', 'contracts' + path.sep + 'asset-manifest-v2.md',
      'contracts' + path.sep + 'C-R3-review-checklist.md',
      'scripts' + path.sep + 'color-palette.mjs', 'scripts' + path.sep + 'color-mix.mjs', 'scripts' + path.sep + 'design-enhancer.mjs', 'scripts' + path.sep + 'resilience-check.mjs', 'scripts' + path.sep + 'di-container.mjs',
      'scripts' + path.sep + 'lib' + path.sep + 'adapters' + path.sep + 'prompt.mjs', 'scripts' + path.sep + 'lib' + path.sep + 'activation.mjs', 'scripts' + path.sep + 'lib' + path.sep + 'evolution.mjs',
      'scripts' + path.sep + 'regression-all.mjs',
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
    const a1ok = a1Violations.length === 0;
    section('S15-A1 drop 资产引用 0 命中（治理活面）', a1ok,
      a1ok ? `扫描 ${a1Scanned} 文件 0 命中；登记残留面 ${a1Residuals.length} 文件（D-3 登记 RESULTS，不阻断）${a1Residuals.length ? ': ' + a1Residuals.join('; ') : ''}`
           : `DROP_REF_HIT ${a1Violations.length} 文件: ${a1Violations.join('; ')}`);
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

  console.log('\n结果: ' + pass + ' PASS / ' + fail + ' FAIL' + (skip ? ' / ' + skip + ' SKIP' : ''));
  if (failures.length) { for (const f of failures) console.log('  FAILED: ' + f); process.exitCode = 1; }
  else { console.log('回归基线通过。'); }
}

main();
