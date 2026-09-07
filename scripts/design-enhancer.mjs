#!/usr/bin/env node
/**
 * design-enhancer — 设计感增强（FR-7）：给定页面描述，生成设计规范参考文档。
 * 自动组合 taste-blocks、shadcn 规范、design-data 色板/字体，产出可执行的设计规范。
 *
 * 用法：node scripts/design-enhancer.mjs --task "登录页面" [--out <dir>] [--taste-blocks-dir <dir>]
 * 退出码：0 = 成功；1 = 参数错误
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const TASTE_BLOCKS = path.join(ROOT, 'vendor', 'frontend-design', 'reference', 'taste-blocks');
const SHADCN_CSV = path.join(ROOT, 'vendor', 'frontend-design', 'reference', 'design-data', 'data', 'stacks', 'shadcn.csv');
const STYLES_CSV = path.join(ROOT, 'vendor', 'frontend-design', 'reference', 'design-data', 'data', 'styles.csv');
const COLORS_CSV = path.join(ROOT, 'vendor', 'frontend-design', 'reference', 'design-data', 'data', 'colors.csv');
const TYPOGRAPHY_CSV = path.join(ROOT, 'vendor', 'frontend-design', 'reference', 'design-data', 'data', 'typography.csv');
const UI_REASONING_CSV = path.join(ROOT, 'vendor', 'frontend-design', 'reference', 'design-data', 'data', 'ui-reasoning.csv');

function parseArgs(args) {
  const out = { task: '登录页面', out: '.' };
  for (let i = 0; i < args.length; i += 1) {
    if (args[i] === '--task') { out.task = args[i + 1]; i += 1; }
    else if (args[i] === '--out') { out.out = args[i + 1]; i += 1; }
  }
  return out;
}

function readBlocks(dir) {
  const blocks = {};
  if (!fs.existsSync(dir)) return blocks;
  for (const cat of fs.readdirSync(dir, { withFileTypes: true })) {
    if (!cat.isDirectory()) continue;
    for (const file of fs.readdirSync(path.join(dir, cat.name))) {
      if (file.endsWith('.md')) {
        const name = cat.name + '/' + file.replace(/\.md$/, '');
        const content = fs.readFileSync(path.join(dir, cat.name, file), 'utf8');
        const whenToUse = (content.match(/when_to_use:\s*"([^"]+)"/) || [])[1] || '';
        blocks[name] = { file: cat.name + '/' + file, whenToUse };
      }
    }
  }
  return blocks;
}

function readCsvLines(p) {
  try { return fs.readFileSync(p, 'utf8').split('\n').filter(Boolean); } catch (e) { return []; }
}

function searchCsv(lines, query) {
  const q = query.toLowerCase();
  return lines.filter(l => l.toLowerCase().includes(q)).slice(0, 5);
}

function main() {
  const opts = parseArgs(process.argv.slice(2));
  const outDir = path.resolve(opts.out);
  fs.mkdirSync(outDir, { recursive: true });

  const blocks = readBlocks(TASTE_BLOCKS);
  const shadcnLines = readCsvLines(SHADCN_CSV);
  const styleLines = readCsvLines(STYLES_CSV);
  const colorLines = readCsvLines(COLORS_CSV);
  const fontLines = readCsvLines(TYPOGRAPHY_CSV);

  // 匹配推荐 block：任务词 + 英文对照回退
  const task = opts.task.toLowerCase();
  const taskEn = ['login', 'landing', 'hero', 'authentication', 'signin'].find(k => task.includes(k)) || 'landing';
  const recommended = Object.entries(blocks).filter(([name, info]) => {
    const w = (info.whenToUse + ' ' + name).toLowerCase();
    return w.includes(task) || task.includes(name.split('/')[0]) || w.includes(taskEn) || name.includes('hero');
  });

  // 搜索相关设计数据：任务词 + 回退通用词
  const search = (lines, qs) => {
    for (const q of qs) {
      const m = searchCsv(lines, q);
      if (m.length) return m;
    }
    return [];
  };
  const matchedStyles = search(styleLines, [task, taskEn, 'landing']);
  const matchedColors = search(colorLines, [task, taskEn, 'blue', 'neutral']);
  const matchedFonts = search(fontLines, [task, 'sans', 'serif']);

  const md = [
    '# 设计规范参考 · ' + opts.task, '',
    '> 由 design-enhancer（FR-7）根据现有 taste-blocks、shadcn 规范、design-data 生成。',
    '> 消费资产：frontend-design（taste-blocks + shadcn + design-data）。',
    '',
    '## 推荐组件块（taste-blocks）',
    recommended.length ? recommended.map(([name, info]) => {
      return '- `' + name + '`' + (info.whenToUse ? ' — ' + info.whenToUse : '');
    }).join('\n') : '- 无精确匹配的 taste-blocks（可参考 9 个通用块：cta/feature/footer/hero/navigation/portfolio/pricing/social-proof/transition）',
    '',
    '## shadcn 规范参考',
    matchedStyles.length ? matchedStyles.map(l => '- ' + l.split(',')[2] || l).join('\n') : '- 参考 shadcn 安装与主题规范：' + shadcnLines.slice(1, 4).map(l => l.split(',')[2]).filter(Boolean).join('；'),
    '',
    '## 色板建议（design-data）',
    matchedColors.length ? matchedColors.map(l => '- ' + l.split(',')[2] || l).join('\n') : '- 参考 colorize 资产的 `color-palette.mjs` 生成和谐色板',
    '',
    '## 字体建议（design-data）',
    matchedFonts.length ? matchedFonts.map(l => '- ' + l.split(',')[2] || l).join('\n') : '- 参考 ui-ux-pro-max 的 google-fonts.csv 选配',
    '',
    '## 设计规范摘要',
    '- 技术栈: shadcn/ui（CSS 变量主题 + OKLCH 色值 + Tailwind v4 @theme inline）',
    '- 反 AI-slop: 禁止硬编码 hex、Inter/Roboto 默认字体、纯黑白背景、弹性缓动、layout 动画、em-dash',
    '- 检查: 产出前跑 `node scripts/frontend-quality-gate.mjs <目录>` 确保机验通过',
    '- 原型一致性: 验收前跑 `node scripts/prototype-parity-check.mjs --proto <原型> --impl <实现>`',
    '',
    '## 消费资产',
    '- frontend-design（taste-blocks 9 个 + shadcn 规范 + design-data 色板/字体）',
    '- colorize（color-palette.mjs 和谐色板生成）',
    '- frontend-visual-validation（L0 像素 diff + L1 VLM 抽样）',
    '',
  ].join('\n');

  const reportPath = path.join(outDir, 'design-spec-' + opts.task.replace(/[^a-zA-Z0-9\u4e00-\u9fff]/g, '-').slice(0, 30) + '.md');
  fs.writeFileSync(reportPath, md);
  console.log('# design-enhancer（FR-7）');
  console.log('- task: ' + opts.task);
  console.log('- 推荐 blocks: ' + (recommended.length ? recommended.map(r => r[0]).join(', ') : '无精确匹配'));
  console.log('- shadcn 规范: ' + (matchedStyles.length + ' 条匹配'));
  console.log('- 色板: ' + (matchedColors.length + ' 条匹配'));
  console.log('- 字体: ' + (matchedFonts.length + ' 条匹配'));
  console.log('- report: ' + reportPath);
  return 0;
}

process.exitCode = main();