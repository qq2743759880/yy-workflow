#!/usr/bin/env node
/**
 * FR-204 plan-review.mjs — autoplan 式一键串评审编排器（gstack 对标，零外部依赖）。
 * 不调用 LLM（由主 agent/子 agent 按输出提示词执行各视角）；本脚本负责：
 *   顺序强制（CEO → Eng → Design，Design 收尾）、提示词组装（引用 plan-review-perspectives.md 对应段）、
 *   报告产物（plan-review-report.md）、可机验（--check 防蒙混）。
 * 用法：
 *   node scripts/plan-review.mjs --plan <dev-plan.md>          # 生成三阶段提示 + 报告骨架
 *   node scripts/plan-review.mjs --check <plan-review-report.md>  # 校验三阶段均有实质 finding+处置
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const PERSPECTIVES = [
  { key: 'CEO 范围', header: '## CEO 范围视角' },
  { key: 'Eng 架构', header: '## Eng 架构视角' },
  { key: 'Design 体验', header: '## Design 体验视角' },
];

/** 提取模板中某视角段（header 到下一个 ## 之间）。 */
function sectionOf(text, header) {
  const idx = text.indexOf(header);
  if (idx === -1) return '';
  const rest = text.slice(idx + header.length);
  const end = rest.indexOf('\n## ');
  return (end === -1 ? rest : rest.slice(0, end)).trim();
}

function main() {
  const args = process.argv.slice(2);
  const perspectivesFile = path.join(ROOT, 'templates', 'plan-review-perspectives.md');
  if (!fs.existsSync(perspectivesFile)) { console.error('FAIL 模板缺失: templates/plan-review-perspectives.md'); return 1; }
  const perspectives = fs.readFileSync(perspectivesFile, 'utf8');

  // --check 模式：校验报告三阶段顺序 + 各段实质 finding+处置（防"全 PASS 讨好"/空话/单视角）
  const ci = args.indexOf('--check');
  if (ci !== -1) {
    const reportFile = args[ci + 1];
    if (!reportFile || !fs.existsSync(path.resolve(reportFile))) { console.error('FAIL --check 需要报告路径'); return 1; }
    const report = fs.readFileSync(path.resolve(reportFile), 'utf8');
    let ok = true;
    // 顺序强制：CEO → Eng → Design（各段头出现位置递增）
    const order = PERSPECTIVES.map((p) => report.indexOf(p.header));
    if (order.some((o) => o === -1)) { ok = false; console.log('FAIL 三视角段缺失'); }
    else if (!(order[0] < order[1] && order[1] < order[2])) { ok = false; console.log('FAIL 三视角顺序（须 CEO → Eng → Design）'); }
    for (const p of PERSPECTIVES) {
      const sec = sectionOf(report, p.header);
      const filler = /Finding\s*[:：]\s*(无|无问题|No issues|No problem)/i.test(sec);
      const hasFinding = sec.includes('Finding') && !/_{3,}/.test(sec) && !filler;
      const hasDispo = sec.includes('处置');
      let pass = hasFinding && hasDispo;
      if (p.key === 'Eng 架构') {
        const hasConf = /confidence\s*[:：]\s*\d/i.test(sec);
        const hasRef = /[:：]\d+\s*$|(file|src|packages|lib)[^\n]*:\d+/im.test(sec);
        if (!hasConf || !hasRef) { pass = false; if (!hasConf) console.log('FAIL Eng: 缺 confidence: N/10'); if (!hasRef) console.log('FAIL Eng: 缺引用行 file:line'); }
      }
      if (!pass) { ok = false; console.log('FAIL ' + p.header + ': finding 缺失/占位/空话或处置缺失'); }
      else console.log('PASS ' + p.header + ' finding+处置' + (p.key === 'Eng 架构' ? '+confidence+引用行' : ''));
    }
    return ok ? 0 : 1;
  }

  const pi = args.indexOf('--plan');
  const planPath = pi !== -1 ? args[pi + 1] : null;
  if (!planPath) { console.error('FAIL --plan <dev-plan.md>'); return 1; }
  const planFile = path.resolve(planPath);
  if (!fs.existsSync(planFile)) { console.error('FAIL dev-plan.md 不存在: ' + planFile); return 1; }
  fs.readFileSync(planFile, 'utf8'); // 可读性校验

  const report = ['# plan-review-report', '', '- plan: ' + planPath, '- 生成: ' + new Date().toISOString(), '', '## 执行顺序（CEO → Eng → Design，Design 收尾）', ''];
  for (const p of PERSPECTIVES) {
    const prompt = sectionOf(perspectives, p.header);
    console.log('\n=== ' + p.header + ' ===');
    console.log('审查对象: ' + planPath);
    console.log(prompt || '（提示词缺失——检查 templates/plan-review-perspectives.md）');
    console.log('\n将 finding 填入 plan-review-report.md 对应段（格式见各视角输出要求）。');
    report.push(p.header, '', '- Finding（≥1，Eng 须含 confidence: N/10 + 引用行）：___', '- 处置：___', '');
  }
  const reportFile = path.join(path.dirname(planFile), 'plan-review-report.md');
  fs.writeFileSync(reportFile, report.join('\n'));
  console.log('\n产物: ' + reportFile);
  return 0;
}

process.exitCode = main();
