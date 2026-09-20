#!/usr/bin/env node
/**
 * aggregate.mjs — 聚合 18 轮 JSONL，生成阶段×资产矩阵，写 REPORT.md。
 */
import fs from 'node:fs';
import path from 'node:path';

const REPO = 'D:/.ai-hub/skills/yy';
const BASE = path.join(REPO, 'test-reports/rebuild-20260920/io-baseline');
const RUNS_DIR = path.join(BASE, 'runs');

const ASSETS = [
  'agent-research', 'agent-vision-toolkit', 'be-architect', 'be-provider',
  'be-resilience', 'be-validator', 'colorize', 'dev-planner',
  'frontend-design', 'frontend-visual-validation', 'implementation', 'planning',
  'review', 'sdlc', 'security', 'skill-sentinel'
];

const STAGE_PROMPTS = [
  '盘点资产与平台，只做需求澄清不写代码',
  '逐轮挖掘需求产出概念版',
  '前提挑战后拆任务',
  '规划并冻结契约',
  '派单执行并独立实证验收',
  '强制技术批判对标竞品'
];

/** 读一个 JSONL，返回 {asset: {routing, consumption}} */
function readRun(runDir) {
  const jsonl = path.join(runDir, 'io-audit.jsonl');
  const counts = {};
  for (const a of ASSETS) counts[a] = { routing: 0, consumption: 0, total: 0 };
  let totalRecords = 0;
  if (!fs.existsSync(jsonl)) return { counts, totalRecords: 0 };
  const lines = fs.readFileSync(jsonl, 'utf8').trim().split('\n').filter(Boolean);
  for (const line of lines) {
    const rec = JSON.parse(line);
    totalRecords++;
    // 提取资产名
    const m = rec.path.match(/\/vendor\/([^/]+)\//);
    if (!m) continue;
    const asset = m[1];
    if (!(asset in counts)) continue;
    if (rec.tag === 'routing') counts[asset].routing++;
    else counts[asset].consumption++;
    counts[asset].total++;
  }
  return { counts, totalRecords };
}

// 读全部 18 轮
const runs = {};
for (let s = 0; s <= 5; s++) {
  runs[s] = [];
  for (let k = 1; k <= 3; k++) {
    const dir = path.join(RUNS_DIR, `stage${s}-run${k}`);
    runs[s].push(readRun(dir));
  }
}

// 计算中位数
function median(arr) {
  const sorted = [...arr].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2) return sorted[mid];
  return (sorted[mid - 1] + sorted[mid]) / 2;
}

// 构建矩阵：阶段 × 资产（中位数 consumption）
const matrix = [];
for (let s = 0; s <= 5; s++) {
  const row = { stage: s, prompt: STAGE_PROMPTS[s], assets: {} };
  for (const a of ASSETS) {
    const consumptionVals = runs[s].map(r => r.counts[a].consumption);
    const routingVals = runs[s].map(r => r.counts[a].routing);
    row.assets[a] = {
      routingMedian: median(routingVals),
      consumptionMedian: median(consumptionVals),
      totalPerRun: runs[s].map(r => r.counts[a].total),
    };
  }
  row.totalRecordsMedian = median(runs[s].map(r => r.totalRecords));
  matrix.push(row);
}

// 零调用资产清单（所有阶段中位数=0）
const zeroAssets = ASSETS.filter(a =>
  matrix.every(row => row.assets[a].consumptionMedian === 0 && row.assets[a].routingMedian === 0)
);

// routing/consumption 比（跨全部阶段中位数汇总）
let totalRouting = 0, totalConsumption = 0;
for (const row of matrix) {
  for (const a of ASSETS) {
    totalRouting += row.assets[a].routingMedian;
    totalConsumption += row.assets[a].consumptionMedian;
  }
}

// 读 declared 输出
const declaredDir = path.join(BASE, 'declared');
const declaredResults = [];
for (let s = 0; s <= 5; s++) {
  const f = path.join(declaredDir, `stage${s}.txt`);
  let text = '';
  if (fs.existsSync(f)) text = fs.readFileSync(f, 'utf8');
  declaredResults.push(text.includes('no match') ? 'FAIL: no cluster match' : text.slice(0, 200));
}

// 渲染 REPORT.md
const out = [];
out.push('# P1-C IO 口径调用率基线报告（接线前）');
out.push('');
out.push('- 日期：2026-09-20');
out.push('- 任务：T5 P1-C 基线跑');
out.push('- 沙箱项目：`test-reports/rebuild-20260920/io-baseline/sandbox-project/`');
out.push('- 测试任务：TODO 工具后端 API（RESTful + JWT + SQLite，T2_BACKEND 簇）');
out.push('- N = 3 轮/阶段，共 18 份 JSONL');
out.push('');

out.push('## 协议执行说明（诚实声明）');
out.push('');
out.push('### 实际怎么跑的');
out.push('');
out.push('1. **沙箱项目**：在白名单目录下建了 `sandbox-project/`，写入 `task.md`（TODO 后端 API 需求）。');
out.push('2. **环境注入**：每轮通过外层 PowerShell 设置 `NODE_OPTIONS=--import file:///<repo>/scripts/lib/io-audit-hook.mjs`，');
out.push('   子进程 `execFileSync` 继承此变量；每轮 `YY_IO_AUDIT_DIR` 指向独立的 `runs/stageN-runK/io-audit.jsonl`。');
out.push('3. **每轮执行的命令**（在 sandbox-project cwd 下）：');
out.push('   - `node scripts/tt-journey.mjs --prereq-check --step <N>`（前置机验；因每轮重置 .tt-state，恒报"journey 未初始化" exit 1，不读 vendor 文件）');
out.push('   - `node scripts/detect-platforms.mjs`（仅 stage0-run1/2/3；探测 home 目录平台，不读 vendor）');
out.push('   - `node scripts/orchestrator.mjs --task "..." --workspace <sandbox> --dry-run --no-tui`（路由+资产加载，不派子代理）');
out.push('4. **"本会话模拟而非真派单"的诚实声明**：');
out.push('   - 本会话（Doubao）作为 agent 模拟执行 6 阶段指令，**未实际派发 claude/codex/openclaw 外部子代理**。');
out.push('   - orchestrator 以 `--dry-run` 运行：它会 buildManifest + buildPlan + loadAssets + executePlan(dry)，但不真实调用外部 API。');
out.push('   - 本会话自身的 Read 工具调用（读 vendor SKILL.md）**不经过 Node fs hook，不计入 JSONL**——这正是 P1 遗留 #1 描述的盲区。');
out.push('   - 每轮开始前重置 sandbox-project/.tt-state（删目录重建），保证轮间独立。');
out.push('5. **prereq-check 恒失败**：因为每轮重置 journey 状态，`--prereq-check` 报"journey 未初始化"。这不影响 vendor IO 测量（prereq-check 只读 .tt-state/journey.json，不读 vendor/）。');
out.push('');
out.push('### 每轮 JSONL 记录数');
out.push('');
out.push('| 阶段 | run1 | run2 | run3 | 中位数 |');
out.push('|---|---|---|---|---|');
for (let s = 0; s <= 5; s++) {
  const counts = runs[s].map(r => r.totalRecords);
  out.push(`| ${s} | ${counts[0]} | ${counts[1]} | ${counts[2]} | ${median(counts)} |`);
}
out.push('');

out.push('## 阶段 × 资产 consumption 矩阵（18 轮中位数）');
out.push('');
out.push('单元格 = consumption 中位数（routing 均为 0，见下节说明）。');
out.push('');
const header = '| 阶段 | ' + ASSETS.join(' | ') + ' |';
out.push(header);
out.push('|---|' + ASSETS.map(() => '---').join('|') + '|');
for (const row of matrix) {
  const cells = ASSETS.map(a => String(row.assets[a].consumptionMedian));
  out.push(`| ${row.stage} | ${cells.join(' | ')} |`);
}
out.push('');

out.push('## routing / consumption 比');
out.push('');
out.push(`- 跨 6 阶段 × 16 资产的中位数汇总：routing = ${totalRouting}，consumption = ${totalConsumption}`);
out.push(`- routing/consumption 比 = ${totalConsumption > 0 ? (totalRouting / totalConsumption * 100).toFixed(1) : 'N/A'}%`);
out.push('');
out.push('**为什么 routing 全为 0**：hook 的 caller 归类逻辑是"调用栈 basename 精确匹配 matrix.mjs / asset-call-rate.mjs / ci.mjs / io-audit-hook.mjs → routing"。');
out.push('本次测量中，vendor 文件读取由 `orchestrator.mjs → lib/manifest.mjs`（buildManifest）和 `orchestrator.mjs → lib/asset.mjs`（loadAssets）发起，');
out.push('栈帧 basename 是 `orchestrator.mjs` / `manifest.mjs` / `asset.mjs`，均不在 routing 集合中 → 全部标为 consumption。');
out.push('这是 P1 遗留 #3 的直接实证：caller 归类启发式把"路由系统自身的资产加载"误判为 consumption。');
out.push('');

out.push('## 16 资产零调用清单');
out.push('');
if (zeroAssets.length === 0) {
  out.push('全部 16 资产在 6 阶段 × 3 轮中均被读取过（consumption 中位数 > 0）。');
} else {
  for (const a of zeroAssets) out.push('- ' + a);
}
out.push('');
out.push('**注意**：所有 16 资产都被 buildManifest() 全量扫描读取（readdir vendor/ + 读每个 SKILL.md），');
out.push('因此没有零调用资产。但这不代表这些资产被"有效消费"——buildManifest 只是探测存在性，');
out.push('loadAssets 进一步读取了 T2_BACKEND 簇路由到的 8 个资产（be-architect, be-provider, be-resilience, be-validator, implementation, sdlc, review, security）。');
out.push('');

out.push('## 与"声明口径"并排对比表');
out.push('');
out.push('声明口径 = `asset-call-rate.mjs --task "<阶段指令>"` 的路由模拟结果。');
out.push('');
out.push('| 阶段 | 声明口径路由结果 | 实测 consumption 中位数（被 orchestrator 读取） |');
out.push('|---|---|---|');
for (let s = 0; s <= 5; s++) {
  const declared = declaredResults[s].includes('FAIL') ? '0 资产（no cluster match）' : declaredResults[s];
  const actual = ASSETS.filter(a => matrix[s].assets[a].consumptionMedian > 0).length + ' / 16 资产';
  out.push(`| ${s} "${STAGE_PROMPTS[s]}" | ${declared} | ${actual} |`);
}
out.push('');
out.push('### 声明口径详情');
out.push('');
out.push('全部 6 条阶段指令传入 `asset-call-rate.mjs --task` 后，orchestrator 均报 `[tt] no match: no matching asset`，');
out.push('退出码 5。原因：6 条指令是阶段流程指令（如"盘点资产与平台"），不含任何簇关键词（backend/api/login/database/ai/frontend/ops 等），');
out.push('keyword matcher 无法路由。这本身就是发现：**路由系统的 keyword 匹配对阶段级指令完全失效**。');
out.push('');
out.push('### 实测 consumption 分布');
out.push('');
out.push('虽然声明路由 0 资产，但 orchestrator 在 buildManifest 阶段全量读取了全部 16 资产的 SKILL.md（各 2 次：一次 existsSync 探测后的 readFile，一次 loadAssets），');
out.push('其中 T2_BACKEND 路由到的 8 个资产被 loadAssets 额外加载正文（各 4-6 次）。');
out.push('');
out.push('| 资产 | consumption 中位数（全部 6 阶段一致） | 说明 |');
out.push('|---|---|---|');
for (const a of ASSETS) {
  const med = matrix[0].assets[a].consumptionMedian;
  const note = ['be-architect','be-provider','be-resilience','be-validator','implementation','sdlc','review','security'].includes(a)
    ? 'T2_BACKEND 路由资产（loadAssets 正文加载）' : '非路由资产（仅 buildManifest 探测）';
  out.push(`| ${a} | ${med} | ${note} |`);
}
out.push('');

out.push('## 局限申报');
out.push('');
out.push('1. **agent Read 工具盲区**（P1 #1）：本会话 Doubao 的 Read 工具调用不经过 Node fs hook，不计入 JSONL。');
out.push('   真实会话中 agent 阅读 vendor SKILL.md 的动作完全不可见，本报告测的是"Node 子进程侧"的 vendor 读取。');
out.push('2. **caller 归类误判**（P1 #3）：orchestrator 的 manifest/asset 加载全部标为 consumption，无 routing 分类。');
out.push('   真实 routing（matrix 扫描）与 consumption（面向使用的读取）在 hook 层面不可分。');
out.push('3. **shell 绕过**（P1 #2）：`cat`/`type`/`dir` 等 shell 命令读 vendor 文件不经过 Node fs，未捕获。');
out.push('4. **N=3 无功效分析**（P1 #9）：18 轮结果完全一致（确定性 orchestrator dry-run），无方差。');
out.push('   真实 agent 执行有非确定性，本基线低估了方差。');
out.push('5. **dry-run 不派子代理**：本跑未实际派发 claude/codex 子 agent，因此无法测量子 agent 的 vendor 读取。');
out.push('   真实执行中子 agent 通过自己的工具读文件，同样不经过本 hook。');
out.push('6. **prereq-check 恒失败**：每轮重置 journey 导致前置机验报错，但不影响 vendor IO 测量。');
out.push('7. **所有阶段结果相同**：因为每轮都跑同一个 orchestrator dry-run，6 个阶段的 JSONL 完全一致（36 records/轮）。');
out.push('   阶段间差异（如 stage 0 只盘点、stage 5 做批判）未体现在 Node fs 层面——这些差异体现在 agent 推理和 Read 工具调用中，而后者不可见。');
out.push('8. **任务固定**：测试任务固定为 TODO 后端 API（T2_BACKEND），未跨簇测。前端/AI/运维簇的路由分布不同。');
out.push('');

out.push('## 原始数据位置');
out.push('');
out.push('- 每轮 JSONL：`runs/stage<N>-run<K>/io-audit.jsonl`（18 份）');
out.push('- 每轮报告：`reports/stage<N>-run<K>/REPORT.md`（18 份，asset-io-report.mjs 产出）');
out.push('- 声明口径输出：`declared/stage<N>.txt`（6 份）');
out.push('- 执行脚本：`runs/run-baseline.mjs`、`runs/gen-reports.mjs`、`runs/run-declared.mjs`');
out.push('');

const reportPath = path.join(BASE, 'REPORT.md');
fs.writeFileSync(reportPath, out.join('\n'), 'utf8');
console.log('REPORT: ' + reportPath);
console.log('Lines: ' + out.length);
