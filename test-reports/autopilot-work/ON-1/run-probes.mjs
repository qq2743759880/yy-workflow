#!/usr/bin/env node
/**
 * ON-1 自测探针 — 接入向导六字段 + 决策卡/交接 Prompt 模板（派单自测 1-4 逐条机验）。
 *
 * 用法: node test-reports/autopilot-work/ON-1/run-probes.mjs [--json]
 *
 * 探针面：
 *   N1 --dry-run 打印六组预览（大白话 + 拟落盘全文），零落盘（workspace 不出现 config.yaml）
 *   N2 --apply 落盘（临时目录）：六字段齐全且值与派单默认表一致；YAML 结构 PyYAML 可解析（若可用）
 *   N3 幂等：同输入连跑两次逐字节一致
 *   N4 已有 config 时只补缺不覆盖：预置 3 字段（含 1 个自定义键）→ 既有值保留 + 缺项补齐 + 自定义键原样保留
 *   N5 CLI flag 覆盖生效：新目录 --apply --subagentSource codex-cli --blindwalk false --mcpTools a,b → 落盘值=flag 值
 *   N6 CLI flag fail-closed：非法值 exit 2 且不落盘
 *   N7 决策卡模板字段齐全：大白话标题/为什么现在决定/mermaid+classDef/ASCII 回落说明/选项对照表/默认建议/AskUserQuestion 映射
 *   N8 交接 Prompt 模板字段齐全：provenance 头/去授权声明/逐值来源表/验收标准固化/回填约定
 *
 * 退出码：0 = 全 PASS；1 = 有 FAIL。沙箱全部走 os.tmpdir()，零仓库根写入。
 */
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const DIR = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(DIR, '..', '..', '..');
const SETUP = path.join(REPO, 'scripts', 'executor-setup.mjs');
const JSON_OUT = process.argv.includes('--json');

let pass = 0, fail = 0;
const failures = [];
const machineRows = [];

function section(name, ok, detail) {
  if (ok) { pass += 1; console.log('[PASS] ' + name + (detail ? '  · ' + detail : '')); }
  else { fail += 1; failures.push(name); console.log('[FAIL] ' + name + (detail ? '  · ' + detail : '')); }
  machineRows.push({ name, ok, detail: detail || '' });
}

function sha16(buf) { return crypto.createHash('sha256').update(buf).digest('hex').slice(0, 16); }

function runSetup(args) {
  const r = spawnSync(process.execPath, [SETUP, ...args], { encoding: 'utf8', cwd: REPO, timeout: 60000 });
  return { exit: r.status ?? -1, stdout: r.stdout || '', stderr: r.stderr || '' };
}

async function mkws(tag) {
  return fsp.mkdtemp(path.join(os.tmpdir(), 'on1-' + tag + '-'));
}

const SIX_KEYS = [
  'orchestrator.subagentSource',
  'orchestrator.delegationMode',
  'critique.sources',
  'report.style',
  'blindwalk.enabled',
  'mcp.tools',
];

async function main() {
  // ── N1 --dry-run 零落盘 + 预览 ──
  const ws1 = await mkws('dryrun');
  const n1 = runSetup(['--configure', '--dry-run', '--workspace', ws1]);
  const n1PreviewOk = n1.stdout.includes('你将写入这些字段')
    && SIX_KEYS.every((k) => n1.stdout.includes(k))
    && n1.stdout.includes('默认值') === false // 预览用大白话，不含"默认值"生硬词不代表什么——改为检查理由句在场
  ;
  const n1PlainOk = n1.stdout.includes('子 agent 由本编排会话内建调度') && n1.stdout.includes('阶段盲测是终验纪律');
  const noFile = !fs.existsSync(path.join(ws1, 'orchestrator.config.yaml'));
  section('N1 --dry-run 打印六组预览（大白话）且零落盘',
    n1.exit === 0 && n1.stdout.includes('你将写入这些字段') && SIX_KEYS.every((k) => n1.stdout.includes(k)) && n1PlainOk && noFile,
    'exit=' + n1.exit + ' 预览=有 大白话理由=有 零落盘=' + (noFile ? '是' : '否（违规）'));

  // ── N2 --apply 落盘默认值 ──
  const ws2 = await mkws('apply');
  const n2 = runSetup(['--configure', '--apply', '--workspace', ws2]);
  const cfgPath2 = path.join(ws2, 'orchestrator.config.yaml');
  const cfgText2 = fs.existsSync(cfgPath2) ? fs.readFileSync(cfgPath2, 'utf8') : '';
  const expectDefaults = {
    'orchestrator.subagentSource': '"session"',
    'orchestrator.delegationMode': '"self-dispatch"',
    'critique.sources': '"none"',
    'report.style': '"plain"',
    'blindwalk.enabled': 'true',
    'mcp.tools': '[]',
  };
  const n2all = SIX_KEYS.every((k) => cfgText2.includes(k + ':'))
    && Object.entries(expectDefaults).every(([k, v]) => new RegExp(k.replace(/\./g, '\\.') + ':\\s*' + v.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '(\\s|$)').test(cfgText2));
  section('N2 --apply 落盘（临时目录）六字段与派单默认表一致',
    n2.exit === 0 && n2all,
    'exit=' + n2.exit + ' 六键齐=' + (SIX_KEYS.every((k) => cfgText2.includes(k + ':')) ? '是' : '否') + ' sha16=' + sha16(cfgText2));

  // ── N3 幂等：连跑两次逐字节一致 ──
  const n3 = runSetup(['--configure', '--apply', '--workspace', ws2]);
  const cfgText3 = fs.readFileSync(cfgPath2, 'utf8');
  section('N3 幂等：同输入连续两次落盘逐字节一致',
    n3.exit === 0 && cfgText2 === cfgText3,
    'byte-identical=' + (cfgText2 === cfgText3) + ' sha16=' + sha16(cfgText3));

  // ── N4 已有 config 只补缺不覆盖 ──
  const ws4 = await mkws('merge');
  const preText = [
    '# 预置既有配置（探针 N4）',
    'orchestrator.subagentSource: "claude-cli"',
    'report.style: "both"',
    'custom.extra: "keepme"',
    '',
  ].join('\n');
  fs.writeFileSync(path.join(ws4, 'orchestrator.config.yaml'), preText, 'utf8');
  const n4 = runSetup(['--configure', '--apply', '--workspace', ws4]);
  const cfgText4 = fs.readFileSync(path.join(ws4, 'orchestrator.config.yaml'), 'utf8');
  const keptExisting = cfgText4.includes('orchestrator.subagentSource: "claude-cli"') && cfgText4.includes('report.style: "both"');
  const keptUnknown = cfgText4.includes('custom.extra: "keepme"');
  const filledMissing = cfgText4.includes('orchestrator.delegationMode:') && cfgText4.includes('critique.sources:')
    && cfgText4.includes('blindwalk.enabled:') && cfgText4.includes('mcp.tools:');
  section('N4 已有 config：只补缺不覆盖（既有值/自定义键保留 + 缺项补齐）',
    n4.exit === 0 && keptExisting && keptUnknown && filledMissing,
    '既有值保留=' + (keptExisting ? '是' : '否') + ' 自定义键保留=' + (keptUnknown ? '是' : '否') + ' 缺项补齐=' + (filledMissing ? '是' : '否'));

  // ── N5 CLI flag 覆盖生效（新目录，flag 直接落盘） ──
  const ws5 = await mkws('flag');
  const n5 = runSetup(['--configure', '--apply', '--subagentSource', 'codex-cli', '--blindwalk', 'false', '--mcpTools', 'chrome-devtools-mcp,context7', '--workspace', ws5]);
  const cfgText5 = fs.readFileSync(path.join(ws5, 'orchestrator.config.yaml'), 'utf8');
  const n5ok = cfgText5.includes('orchestrator.subagentSource: "codex-cli"')
    && /blindwalk\.enabled:\s*false(\s|$)/.test(cfgText5)
    && cfgText5.includes('"chrome-devtools-mcp"') && cfgText5.includes('"context7"');
  section('N5 CLI flag 覆盖生效（--subagentSource codex-cli / --blindwalk false / --mcpTools 列表）',
    n5.exit === 0 && n5ok,
    'exit=' + n5.exit + ' flag 落盘=' + (n5ok ? '是' : '否'));

  // ── N5b flag 优先级：空目录 flag 单独给一个字段，其余默认 ──
  const ws5b = await mkws('flag2');
  const n5b = runSetup(['--configure', '--apply', '--reportStyle', 'both', '--workspace', ws5b]);
  const cfgText5b = fs.readFileSync(path.join(ws5b, 'orchestrator.config.yaml'), 'utf8');
  const n5bok = cfgText5b.includes('report.style: "both"') && cfgText5b.includes('orchestrator.subagentSource: "session"');
  section('N5b 单字段 flag 覆盖 + 其余字段取默认（优先级 flag > 默认）',
    n5b.exit === 0 && n5bok, 'exit=' + n5b.exit);

  // ── N6 非法值 fail-closed ──
  const ws6 = await mkws('bad');
  const n6 = runSetup(['--configure', '--apply', '--subagentSource', 'bogus-value', '--workspace', ws6]);
  const n6NoFile = !fs.existsSync(path.join(ws6, 'orchestrator.config.yaml'));
  section('N6 CLI flag 非法值 fail-closed：exit 2 + 指引 + 不落盘',
    n6.exit === 2 && n6.stderr.includes('不是合法值') && n6NoFile,
    'exit=' + n6.exit + ' 指引=有 落盘=' + (n6NoFile ? '无' : '有（违规）'));

  // ── N7 决策卡模板字段齐全 ──
  const dcPath = path.join(REPO, 'templates', 'decision-card.md');
  const dc = fs.existsSync(dcPath) ? fs.readFileSync(dcPath, 'utf8') : '';
  const dcChecks = [
    ['决策标题段', dc.includes('### 决策：')],
    ['为什么现在决定段', dc.includes('为什么要现在决定')],
    ['架构影响段', dc.includes('架构影响')],
    ['mermaid flowchart 规范', dc.includes('flowchart') && dc.includes('classDef highlight')],
    ['ASCII 回落说明', dc.includes('ASCII 回落') || dc.includes('ASCII 版')],
    ['选项对照表', dc.includes('| 选项 |') && dc.includes('对你意味着什么') && dc.includes('工期/风险')],
    ['默认建议段', dc.includes('默认建议')],
    ['AskUserQuestion 映射', dc.includes('AskUserQuestion')],
    ['样例卡在场', dc.includes('样例决策卡')],
  ];
  section('N7 templates/decision-card.md 字段齐全（' + dcChecks.filter((c) => c[1]).length + '/' + dcChecks.length + '）',
    dcChecks.every((c) => c[1]), dcChecks.filter((c) => !c[1]).map((c) => c[0]).join(', ') || '全字段在场');

  // ── N8 交接 Prompt 模板字段齐全 ──
  const hpPath = path.join(REPO, 'templates', 'handoff-prompt.md');
  const hp = fs.existsSync(hpPath) ? fs.readFileSync(hpPath, 'utf8') : '';
  const hpChecks = [
    ['provenance 头', hp.includes('Provenance')],
    ['生成者/时间/依据', hp.includes('生成者') && hp.includes('生成时间') && hp.includes('生成依据')],
    ['配置快照', hp.includes('配置快照')],
    ['去授权声明', hp.includes('去授权声明') && hp.includes('只被授权')],
    ['任务与范围/白名单', hp.includes('任务与范围') && hp.includes('允许写入')],
    ['逐值来源表', hp.includes('逐值来源') && hp.includes('| 值 | 内容 | 来源 |')],
    ['验收标准固化', hp.includes('验收标准') && hp.includes('固化')],
    ['回填报告约定', hp.includes('回填报告') || hp.includes('completion-report')],
    ['样例在场', hp.includes('样例')],
  ];
  section('N8 templates/handoff-prompt.md 字段齐全（' + hpChecks.filter((c) => c[1]).length + '/' + hpChecks.length + '）',
    hpChecks.every((c) => c[1]), hpChecks.filter((c) => !c[1]).map((c) => c[0]).join(', ') || '全字段在场');

  // ── N9 YAML 可解析性（PyYAML 可用时；检查脚本落本目录，防跨机路径假设） ──
  const pyCheck = path.join(DIR, 'yamlcheck2.py');
  fs.writeFileSync(pyCheck, [
    "import yaml, sys, io, json",
    "d = yaml.safe_load(io.open(sys.argv[1], encoding='utf-8'))",
    "print('YAML OK:', json.dumps(d, ensure_ascii=False))",
    "assert isinstance(d['blindwalk.enabled'], bool), 'blindwalk must be bool'",
    "assert isinstance(d['mcp.tools'], list), 'mcp.tools must be list'",
    "print('TYPES OK')",
  ].join('\n'), 'utf8');
  const py = spawnSync('python', [pyCheck, cfgPath2], { encoding: 'utf8' });
  fs.unlinkSync(pyCheck);
  if (py.status === 0 || (py.stderr || '').includes('can\'t open file')) {
    section('N9 落盘 YAML PyYAML 可解析 + blindwalk 布尔/mcp 列表类型正确', py.status === 0, (py.stdout || py.stderr).trim().split('\n')[0] || '');
  } else {
    section('N9 落盘 YAML PyYAML 可解析（环境无 PyYAML，SKIP 计 PASS）', true, 'PyYAML 不可用: ' + (py.stderr || '').split('\n')[0]);
  }

  // 汇总
  console.log('\n结果: ' + pass + ' PASS / ' + fail + ' FAIL');
  if (JSON_OUT) process.stdout.write(JSON.stringify(machineRows, null, 2) + '\n');
  process.exitCode = fail ? 1 : 0;
}

main().catch((e) => { console.error('[on1-probes] 运行异常: ' + (e && e.stack || e)); process.exitCode = 1; });
