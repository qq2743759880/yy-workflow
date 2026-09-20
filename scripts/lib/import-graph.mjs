#!/usr/bin/env node
/**
 * import-graph.mjs — A0 静态 import 依赖图测绘（P3-A0）
 *
 * 口径声明：
 *   - 解析方式：保守正则扫描（非 AST），覆盖静态 `import ... from` / `import '...'` /
 *     `export ... from '...'` 三种顶层语句。
 *   - 已知盲区：
 *     1) 动态 `import('...')` 调用不解析（仅记录存在性）；
 *     2) 模板字符串拼接的模块说明符不解析；
 *     3) 注释中的 import 样例会被误抓（正则不区分注释）——保守起见宁可多报不可漏报；
 *     4) node: 内置模块（node:fs 等）不计入仓库内依赖边；
 *     5) 未安装的第三方包（零依赖项目中不存在）不计入。
 *   - 路径解析：相对说明符（./ 或 ../）相对于当前文件所在目录解析，
 *     尝试追加 .mjs 后缀与 /index.mjs；解析失败记为 unresolved。
 *
 * CLI: node scripts/lib/import-graph.mjs [--out <path>] [--root <scripts-dir>]
 *   --out  指定输出 JSON 文件路径（默认 stdout 打印 JSON + markdown 图）
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const DEFAULT_ROOT = path.resolve(SCRIPT_DIR, '..'); // scripts/

// ---------------------------------------------------------------------------
// 扫描与解析
// ---------------------------------------------------------------------------

/** 递归收集目录下所有 .mjs 文件（相对 root 的 posix 路径）。 */
export function collectModules(root) {
  const out = [];
  function walk(dir) {
    let entries;
    try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { return; }
    for (const ent of entries) {
      const full = path.join(dir, ent.name);
      if (ent.isDirectory()) walk(full);
      else if (ent.isFile() && ent.name.endsWith('.mjs')) {
        out.push(path.relative(root, full).split(path.sep).join('/'));
      }
    }
  }
  walk(root);
  return out.sort();
}

/**
 * 从源码文本中提取静态 import/export-from 说明符。
 * 返回 { static: string[], dynamic: string[] }。
 */
export function extractImps(source) {
  const staticImps = [];
  const dynamicImps = [];
  // 逐行扫描，避免跨行误匹配
  for (const rawLine of source.split('\n')) {
    const line = rawLine.trim();
    // import ... from 'spec'  /  import ... from "spec"
    let m = line.match(/^\s*(?:import|export)\s+(?:[^'"]*?\s+from\s+)?['"]([^'"]+)['"]/);
    if (m) { staticImps.push(m[1]); continue; }
    // import 'spec'; （副作用导入）
    m = line.match(/^\s*import\s+['"]([^'"]+)['"]/);
    if (m) { staticImps.push(m[1]); continue; }
    // 动态 import('spec')
    const dyn = line.match(/import\(\s*['"]([^'"]+)['"]\s*\)/g);
    if (dyn) for (const d of dyn) {
      const mm = d.match(/import\(\s*['"]([^'"]+)['"]\s*\)/);
      if (mm) dynamicImps.push(mm[1]);
    }
  }
  return { static: staticImps, dynamic: dynamicImps };
}

/** 将相对说明符解析为仓库内模块路径（posix，相对 root）。失败返回 null。 */
export function resolveSpecifier(spec, fromFile, root) {
  // 仅解析相对路径
  if (!spec.startsWith('./') && !spec.startsWith('../')) return null; // node: 或裸说明符
  const fromDir = path.dirname(path.join(root, fromFile));
  let resolved = path.resolve(fromDir, spec);
  // 尝试追加 .mjs
  const candidates = [
    resolved + '.mjs',
    path.join(resolved, 'index.mjs'),
    resolved,
  ];
  for (const c of candidates) {
    if (fs.existsSync(c) && fs.statSync(c).isFile()) {
      return path.relative(root, c).split(path.sep).join('/');
    }
  }
  return null;
}

/** 构建依赖图。返回 { nodes, edges, unresolved, dynamicRefs }。 */
export function buildGraph(root) {
  const modules = collectModules(root);
  const nodes = new Set(modules);
  const edgeSet = new Set(); // 去重：同一对 from→to 只记一次
  const edges = []; // { from, to }
  const unresolved = []; // { from, spec }
  const dynamicRefs = []; // { from, spec }

  for (const mod of modules) {
    const full = path.join(root, mod);
    const source = fs.readFileSync(full, 'utf8');
    const { static: statics, dynamic } = extractImps(source);
    for (const spec of statics) {
      if (spec.startsWith('node:') || (!spec.startsWith('.') && !spec.startsWith('/'))) continue;
      const target = resolveSpecifier(spec, mod, root);
      if (target && nodes.has(target)) {
        const key = mod + '→' + target;
        if (!edgeSet.has(key)) { edgeSet.add(key); edges.push({ from: mod, to: target }); }
      } else {
        unresolved.push({ from: mod, spec });
      }
    }
    for (const spec of dynamic) {
      if (spec.startsWith('.') || spec.startsWith('../')) {
        const target = resolveSpecifier(spec, mod, root);
        dynamicRefs.push({ from: mod, spec, resolved: target });
      }
    }
  }
  return { nodes: [...nodes].sort(), edges, unresolved, dynamicRefs };
}

// ---------------------------------------------------------------------------
// 环检测（DFS 三色）
// ---------------------------------------------------------------------------

export function findCycles(graph) {
  const adj = new Map();
  for (const n of graph.nodes) adj.set(n, new Set());
  for (const e of graph.edges) adj.get(e.from)?.add(e.to);

  const WHITE = 0, GRAY = 1, BLACK = 2;
  const color = new Map();
  for (const n of graph.nodes) color.set(n, WHITE);
  const cycles = [];
  const stack = [];

  function dfs(u) {
    color.set(u, GRAY);
    stack.push(u);
    for (const v of adj.get(u) || []) {
      if (color.get(v) === GRAY) {
        // 找到环：从 v 在 stack 中的位置到末尾
        const idx = stack.indexOf(v);
        cycles.push([...stack.slice(idx), v]);
      } else if (color.get(v) === WHITE) {
        dfs(v);
      }
    }
    stack.pop();
    color.set(u, BLACK);
  }

  for (const n of graph.nodes) {
    if (color.get(n) === WHITE) dfs(n);
  }
  return cycles;
}

// ---------------------------------------------------------------------------
// B1→B7 接线序校验
// ---------------------------------------------------------------------------

/**
 * 期望接线序（P3 阶段 B）：
 *   B1 state → B2 store → B3 tt-journey → B4 gate → B5 runtime → B6 adapters/prompt → B7 orchestrator
 * 检查：若 A 应在 B 之前接线（A→B），则 B 不应 import A（反向边）。
 * 反向边 = 冲突边。
 */
export function checkWiringOrder(graph) {
  // 期望序：后者依赖前者（B7 可依赖 B6，B6 可依赖 B5...）
  // 冲突 = 前者 import 后者（如 state.mjs import runtime.mjs）
  const layers = [
    { label: 'B1(state)',      match: (n) => n === 'lib/state.mjs' },
    { label: 'B2(store)',       match: (n) => n === 'lib/store.mjs' },
    { label: 'B3(tt-journey)', match: (n) => n === 'tt-journey.mjs' || n === 'lib/journey.mjs' },
    { label: 'B4(gate)',        match: (n) => n === 'lib/gate.mjs' },
    { label: 'B5(runtime)',     match: (n) => n === 'lib/runtime.mjs' },
    { label: 'B6(adapters/prompt)', match: (n) => n.startsWith('lib/adapters/') },
    { label: 'B7(orchestrator)', match: (n) => n === 'orchestrator.mjs' },
  ];

  // 构建每层的节点集合
  const layerNodes = layers.map((l) => graph.nodes.filter(l.match));

  const conflicts = [];
  // 对每对 (i, j) 其中 i < j（i 应先接线），检查是否有 layer[i] → layer[j] 的边
  // 这意味着先接线的模块依赖后接线的模块 = 冲突
  for (let i = 0; i < layers.length; i++) {
    for (let j = i + 1; j < layers.length; j++) {
      for (const e of graph.edges) {
        if (layerNodes[i].includes(e.from) && layerNodes[j].includes(e.to)) {
          conflicts.push({
            fromLayer: layers[i].label,
            toLayer: layers[j].label,
            from: e.from,
            to: e.to,
            reason: `${layers[i].label} 应先于 ${layers[j].label} 接线，但 ${e.from} import 了 ${e.to}（反向依赖）`,
          });
        }
      }
    }
  }
  return { layers, layerNodes, conflicts };
}

// ---------------------------------------------------------------------------
// 输出格式化
// ---------------------------------------------------------------------------

export function toJSON(graph, cycles, wiring) {
  return {
    generatedAt: new Date().toISOString(),
    moduleCount: graph.nodes.length,
    edgeCount: graph.edges.length,
    nodes: graph.nodes,
    edges: graph.edges,
    unresolved: graph.unresolved,
    dynamicRefs: graph.dynamicRefs,
    cycles,
    wiringCheck: {
      expectedOrder: wiring.layers.map((l) => l.label),
      conflicts: wiring.conflicts,
      conflictCount: wiring.conflicts.length,
    },
  };
}

export function toMarkdown(graph, cycles, wiring) {
  const lines = [];
  lines.push('# Import 依赖图报告');
  lines.push('');
  lines.push(`- 模块数: ${graph.nodes.length}`);
  lines.push(`- 依赖边数: ${graph.edges.length}`);
  lines.push(`- 未解析说明符: ${graph.unresolved.length}`);
  lines.push(`- 动态 import 引用: ${graph.dynamicRefs.length}`);
  lines.push('');

  lines.push('## 环检测');
  if (cycles.length === 0) {
    lines.push('');
    lines.push('无环（DAG）。');
  } else {
    lines.push('');
    for (const c of cycles) {
      lines.push(`- 环: ${c.join(' → ')}`);
    }
  }
  lines.push('');

  lines.push('## B1→B7 接线序校验');
  lines.push('');
  lines.push(`期望序: ${wiring.layers.map((l) => l.label).join(' → ')}`);
  lines.push('');
  if (wiring.conflicts.length === 0) {
    lines.push('无冲突边——接线序与真实依赖一致。');
  } else {
    lines.push(`**发现 ${wiring.conflicts.length} 条冲突边：**`);
    lines.push('');
    for (const c of wiring.conflicts) {
      lines.push(`- ${c.reason}`);
    }
  }
  lines.push('');

  lines.push('## 邻接表（每个模块的直接依赖）');
  lines.push('');
  const adj = new Map();
  for (const n of graph.nodes) adj.set(n, []);
  for (const e of graph.edges) adj.get(e.from)?.push(e.to);
  for (const n of graph.nodes) {
    const deps = adj.get(n) || [];
    if (deps.length) {
      lines.push(`- \`${n}\` → ${deps.map((d) => `\`${d}\``).join(', ')}`);
    }
  }
  lines.push('');

  if (graph.unresolved.length) {
    lines.push('## 未解析说明符');
    lines.push('');
    for (const u of graph.unresolved) {
      lines.push(`- \`${u.from}\` → \`${u.spec}\``);
    }
    lines.push('');
  }

  return lines.join('\n');
}

// ---------------------------------------------------------------------------
// CLI 入口
// ---------------------------------------------------------------------------

async function main() {
  const args = process.argv.slice(2);
  let outPath = null;
  let root = DEFAULT_ROOT;
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--out' && args[i + 1]) { outPath = args[i + 1]; i += 1; }
    else if (args[i] === '--root' && args[i + 1]) { root = path.resolve(args[i + 1]); i += 1; }
  }

  const graph = buildGraph(root);
  const cycles = findCycles(graph);
  const wiring = checkWiringOrder(graph);
  const report = toJSON(graph, cycles, wiring);
  const md = toMarkdown(graph, cycles, wiring);

  if (outPath) {
    fs.writeFileSync(outPath, JSON.stringify(report, null, 2), 'utf8');
    console.log('JSON 已写入: ' + outPath);
  } else {
    console.log(JSON.stringify(report, null, 2));
  }
  console.error('\n' + md);
}

// 仅当直接执行时跑 main（被 import 时不自动执行）
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main();
}

export default { collectModules, extractImps, resolveSpecifier, buildGraph, findCycles, checkWiringOrder, toJSON, toMarkdown };
