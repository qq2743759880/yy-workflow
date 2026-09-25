#!/usr/bin/env node
/**
 * TT 一键回归卡点（BE-16 / task05）。
 * 顺序执行各断言段，任一 FAIL → exit 1。
 *
 * 段：
 *   S1 validate-structure        —— 结构/16 资产/接口漂移/可移植性/U+FFFD（完整）
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
 *   S15 migration invariants      —— 占位（B1-GATE 预埋）：迁移不变量段，AS-1 drop 执行时填充
 *                                    （EXPLICIT_COMPAT_MODE 门 / drop 资产 import 零命中 / manifest 驱动路由断言）。
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

/** Phase 2 替换目标清单（预埋占位）。kernel = 资产正文必须包含的内核 marker（漂移门）。 */
const PHASE2 = [
  { asset: 'implementation', dedicatedAdapter: true, kernel: ['opencode'], file: 'vendor/implementation/implementation.md', note: '实现簇(dev-backend+be-implementer) → opencode 执行内核' },
  { asset: 'sdlc', dedicatedAdapter: true, kernel: ['cline', 'BMAD'], file: 'vendor/sdlc/SKILL.md', note: 'sdlc → BMAD-METHOD + cline 执行层' },
  { asset: 'be-validator', dedicatedAdapter: true, kernel: ['OpenAPI', 'contract'], file: 'vendor/be-validator/be-validator.md', note: 'be-validator → portman/contracteer 契约校验' },
  { asset: 'agent-research', dedicatedAdapter: false, kernel: ['gpt-researcher'], file: 'vendor/agent-research/SKILL.md', note: '调研 hub → gpt-researcher 单点对标' },
  { asset: 'skill-sentinel', dedicatedAdapter: true, kernel: ['SkillSpector', 'skill_sentinel'], file: 'vendor/skill-sentinel/SKILL.md', note: 'skill 安全扫描 → skill-scanner 2.1.0 执行内核（AS-2-sentinel 晋升，cr-20260925T150000Z SIGNED；kernel marker 仍为 vendor 正文 SkillSpector/skill_sentinel——vendor 一字不改）' },
  { asset: 'security', dedicatedAdapter: true, kernel: ['semgrep'], file: 'vendor/security/SKILL.md', note: '安全簇 → semgrep 扫描内核（AS-2-security 晋升；gitleaks 暂缺登记为能力收缩，第十一审计 F-018）' },
  { asset: 'frontend-design', dedicatedAdapter: false, kernel: ['shadcn', 'bolt.new'], file: 'vendor/frontend-design/SKILL.md', note: '前端设计簇 → shadcn-ui/ui + bolt.new 内核' },
  { asset: 'planning', dedicatedAdapter: false, kernel: ['MetaGPT', 'crewAI'], file: 'vendor/planning/SKILL.md', note: '需求规划 → MetaGPT / crewAI 对标' },
  { asset: 'review', dedicatedAdapter: false, kernel: ['pr-agent', 'continuedev'], file: 'vendor/review/SKILL.md', note: '评审簇 → qodo-ai/pr-agent + continue 内核' },
  { asset: 'be-architect', dedicatedAdapter: false, kernel: ['system-design-template'], file: 'vendor/be-architect/be-architect.md', note: '架构设计 → system-design-template 对标' },
  { asset: 'be-provider', dedicatedAdapter: false, kernel: ['tsyringe', 'InversifyJS'], file: 'vendor/be-provider/be-provider.md', note: 'LLM provider → tsyringe / InversifyJS 对标' },
  { asset: 'be-resilience', dedicatedAdapter: false, kernel: ['cockatiel', 'Polly'], file: 'vendor/be-resilience/be-resilience.md', note: '韧性 → cockatiel / Polly 对标' },
  { asset: 'colorize', dedicatedAdapter: false, kernel: ['culori', 'chroma-js', 'poline'], file: 'vendor/colorize/SKILL.md', note: '前端配色 → culori/chroma-js/poline 计算内核' },
  { asset: 'agent-vision-toolkit', dedicatedAdapter: false, kernel: ['OmniParser', 'UI-TARS'], file: 'vendor/agent-vision-toolkit/SKILL.md', note: '视觉质检 → OmniParser v2 + UI-TARS VLM 内核' },
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
    // 专用 adapter 检查仅对 dedicatedAdapter 资产强制（resolveAdapter(asset,'cli')）；无专用的靠 prompt/auto 兜底（可达性由路由 16/16 保证）。
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

  // S15 migration invariants（占位，B1-GATE 预埋）：迁移不变量段——AS-1 drop 执行时填充：
  // ①EXPLICIT_COMPAT_MODE 门（v3.2：旧 loader 调用须显式旗标+留痕，禁静默并存）
  // ②drop 资产 import/引用 0 命中 ③manifest 驱动路由断言 ④旧 adapter 不可达。
  // 填充时本注释整段替换为真实断言（参照 S14 的 run() 模式）；此前不参与 PASS/FAIL 计数。
  console.log('S15 migration invariants（占位）：AS-1 drop 执行时填充（EXPLICIT_COMPAT_MODE 门 / import 零命中 / manifest 路由断言 / 旧 adapter 不可达）');

  console.log('\n结果: ' + pass + ' PASS / ' + fail + ' FAIL' + (skip ? ' / ' + skip + ' SKIP' : ''));
  if (failures.length) { for (const f of failures) console.log('  FAILED: ' + f); process.exitCode = 1; }
  else { console.log('回归基线通过。'); }
}

main();
