#!/usr/bin/env node
/**
 * task 文档 v2 独立机验器（TK-1，execution-plan-v3 §五批 0）。
 *
 * 用法:   node scripts/validate-task.mjs <task文档路径>
 * 退出码: 0 = 七字段全部合规；1 = FAIL（逐项断言输出，detail 指名字段）；2 = 用法/读取错误。
 *
 * 七字段（模板：templates/task-v2.md）：
 *   1. implementation_steps[]     步数 ∈[1,7]，每步 {target,action,rationale}，target 路径真实存在
 *   2. executor_acceptance[]      ≥1 条，每条 {ac,verify_command,expected_exit}
 *   3. trajectory_checkpoints[]   step 覆盖 1..N 全部 steps，{step,artifact,evidence}
 *   4. complexity_score+must_split 确定性口径 score=touched_files+dep_depth×2，
 *                                 must_split=(score>12 或 touched_files>5)；禁 LLM 评分
 *   5. boundaries                 always/never 各 1-3 条 + edge_matrix ≥1 行；批准后冻结只许追加
 *   6. dev_record                 status=completed 时必填且 changed_files 逐个存在
 *   7. spec_budget                正文 token（CJK 加权，量尺同 validate-structure H1）≤ 上限（≤1200）
 *
 * 解析约定见模板 §二：标量在 YAML frontmatter；结构化字段为 ```json <字段名> 围栏块。
 * 本脚本零依赖、只读，不修改任何文件。
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, ".."); // 工作区根：task 文档内相对路径以此为基准解析

const args = process.argv.slice(2).filter((a) => a !== "--verbose");
const VERBOSE = process.argv.includes("--verbose");
if (args.length !== 1) {
  console.error("用法: node scripts/validate-task.mjs <task文档路径>");
  process.exit(2);
}
const docPath = path.resolve(args[0]);
if (!fs.existsSync(docPath) || !fs.statSync(docPath).isFile()) {
  console.error(`[validate-task] 文件不存在: ${args[0]}`);
  process.exit(2);
}
let raw;
try {
  raw = fs.readFileSync(docPath, "utf8");
} catch (e) {
  console.error(`[validate-task] 读取失败: ${e.message}`);
  process.exit(2);
}
const text = raw.replace(/\r\n/g, "\n");

const results = []; // { name, ok, detail }
function check(name, ok, detail) {
  results.push({ name, ok, detail });
}
const isNonEmptyStr = (v) => typeof v === "string" && v.trim().length > 0;

// ── 解析 frontmatter 标量 ──
const fmMatch = text.match(/^---\n([\s\S]*?)\n---/);
const fm = {};
if (fmMatch) {
  for (const line of fmMatch[1].split("\n")) {
    const m = line.match(/^([A-Za-z_][A-Za-z0-9_]*):\s*(.*?)\s*$/);
    if (m) fm[m[1]] = m[2];
  }
}

// ── 解析 ```json <字段名> 围栏块（同名字段取首个）──
const blocks = {};
for (const m of text.matchAll(/```json[ \t]+([a-z_]+)[ \t]*\n([\s\S]*?)\n[ \t]*```/g)) {
  if (!(m[1] in blocks)) blocks[m[1]] = m[2];
}
function parseField(name) {
  if (!(name in blocks)) return { error: "字段块缺失（须为 ```json " + name + " 围栏块）" };
  try {
    return { value: JSON.parse(blocks[name]) };
  } catch (e) {
    return { error: `JSON 解析失败: ${e.message}` };
  }
}

// ── 路径断言：工作区相对路径且真实存在 ──
function relPathExists(p) {
  if (!isNonEmptyStr(p)) return "空";
  if (/^[a-zA-Z]:[\\/]/.test(p) || /^[\\/]/.test(p)) return "绝对路径（须为工作区相对路径）";
  const clean = p.replace(/^\.\//, "");
  return fs.existsSync(path.join(ROOT, clean)) ? null : "目标不存在";
}

// ── token 量尺（与 validate-structure.mjs countTokens 同式：non-CJK/2 + CJK×0.6）──
function countTokens(t) {
  let cjk = 0, non = 0;
  for (const ch of t) {
    const c = ch.codePointAt(0);
    if ((c >= 0x4e00 && c <= 0x9fff) || (c >= 0x3400 && c <= 0x4dbf) || (c >= 0x3000 && c <= 0x303f) || (c >= 0xff00 && c <= 0xffef)) cjk++;
    else non++;
  }
  return Math.round(non / 2 + cjk * 0.6);
}

// ══ 字段 1: implementation_steps ══
let steps = null; // 供字段 3 覆盖核对使用
{
  const r = parseField("implementation_steps");
  if (r.error) {
    check("implementation_steps", false, r.error);
  } else {
    const v = r.value;
    if (!Array.isArray(v)) {
      check("implementation_steps", false, "须为数组");
    } else if (v.length < 1 || v.length > 7) {
      check("implementation_steps", false, `步数 ${v.length} 越界（须 ∈[1,7]）`);
    } else {
      const bad = [];
      v.forEach((s, i) => {
        const n = `步骤${i + 1}`;
        if (!s || typeof s !== "object") { bad.push(`${n} 非对象`); return; }
        if (!isNonEmptyStr(s.target)) bad.push(`${n}.target 空`);
        if (!isNonEmptyStr(s.action)) bad.push(`${n}.action 空`);
        if (!isNonEmptyStr(s.rationale)) bad.push(`${n}.rationale 空`);
        if (isNonEmptyStr(s.target)) {
          const err = relPathExists(s.target);
          if (err) bad.push(`${n}.target "${s.target}" ${err}`);
        }
      });
      if (bad.length) check("implementation_steps", false, bad.join("; "));
      else check("implementation_steps", true, `${v.length} 步，target 全部存在`);
      steps = v;
    }
  }
}

// ══ 字段 2: executor_acceptance ══
{
  const r = parseField("executor_acceptance");
  if (r.error) {
    check("executor_acceptance", false, r.error);
  } else if (!Array.isArray(r.value) || r.value.length < 1) {
    check("executor_acceptance", false, "须为非空数组（≥1 条 AC）");
  } else {
    const bad = [];
    r.value.forEach((a, i) => {
      const n = `条目${i + 1}`;
      if (!a || typeof a !== "object") { bad.push(`${n} 非对象`); return; }
      if (!isNonEmptyStr(a.ac)) bad.push(`${n}.ac 空`);
      if (!isNonEmptyStr(a.verify_command)) bad.push(`${n}.verify_command 空`);
      const ee = a.expected_exit;
      if (!Number.isInteger(ee) || ee < 0 || ee > 255) bad.push(`${n}.expected_exit 须为 0-255 整数，实得 ${JSON.stringify(ee)}`);
    });
    check("executor_acceptance", bad.length ? false : true, bad.length ? bad.join("; ") : `${r.value.length} 条，verify_command 齐备`);
  }
}

// ══ 字段 3: trajectory_checkpoints（覆盖全部 steps）══
{
  const r = parseField("trajectory_checkpoints");
  if (r.error) {
    check("trajectory_checkpoints", false, r.error);
  } else if (!Array.isArray(r.value) || r.value.length < 1) {
    check("trajectory_checkpoints", false, "须为非空数组");
  } else if (!steps) {
    check("trajectory_checkpoints", false, "覆盖核对不成立：implementation_steps 未通过机验");
  } else {
    const n = steps.length;
    const bad = [];
    const seen = new Set();
    r.value.forEach((c, i) => {
      const tag = `checkpoint${i + 1}`;
      if (!c || typeof c !== "object") { bad.push(`${tag} 非对象`); return; }
      if (!Number.isInteger(c.step) || c.step < 1 || c.step > n) bad.push(`${tag}.step=${JSON.stringify(c.step)} 越界（合法 1..${n}）`);
      else if (seen.has(c.step)) bad.push(`${tag}.step=${c.step} 重复`);
      else seen.add(c.step);
      if (!isNonEmptyStr(c.artifact)) bad.push(`${tag}.artifact 空`);
      if (!isNonEmptyStr(c.evidence)) bad.push(`${tag}.evidence 空`);
    });
    const missing = [];
    for (let s = 1; s <= n; s++) if (!seen.has(s)) missing.push(s);
    if (missing.length) bad.push(`未覆盖 steps: ${missing.join(", ")}（checkpoint 须覆盖全部 ${n} 步）`);
    check("trajectory_checkpoints", bad.length ? false : true, bad.length ? bad.join("; ") : `${n}/${n} 步全覆盖`);
  }
}

// ══ 字段 4: complexity_score + must_split（确定性口径，禁 LLM 评分）══
{
  const bad = [];
  const touched = fm.complexity_touched_files;
  const depth = fm.complexity_dep_depth;
  const score = fm.complexity_score;
  const split = fm.must_split;
  const missing = [];
  if (touched === undefined) missing.push("complexity_touched_files");
  if (depth === undefined) missing.push("complexity_dep_depth");
  if (score === undefined) missing.push("complexity_score");
  if (split === undefined) missing.push("must_split");
  if (missing.length) {
    bad.push(`frontmatter 缺 ${missing.join(", ")}`);
  } else {
    const t = Number(touched), d = Number(depth), s = Number(score);
    if (!Number.isInteger(t) || t < 0) bad.push(`complexity_touched_files 须为 ≥0 整数，实得 "${touched}"`);
    if (!Number.isInteger(d) || d < 0) bad.push(`complexity_dep_depth 须为 ≥0 整数，实得 "${depth}"`);
    if (!Number.isInteger(s) || s < 0) bad.push(`complexity_score 须为 ≥0 整数，实得 "${score}"`);
    if (split !== "true" && split !== "false") bad.push(`must_split 须为 true/false，实得 "${split}"`);
    if (!bad.length) {
      const expectScore = t + d * 2;
      if (s !== expectScore) bad.push(`score=${s} 与口径公式不符：touched_files(${t}) + dep_depth(${d})×2 应为 ${expectScore}`);
      const expectSplit = s > 12 || t > 5;
      if ((split === "true") !== expectSplit) bad.push(`must_split=${split} 与拆解规则不符：score(${s})>12 或 touched(${t})>5 应为 ${expectSplit}`);
    }
  }
  check("complexity_score+must_split", bad.length ? false : true,
    bad.length ? bad.join("; ") : `touched=${touched} depth=${depth} score=${score} must_split=${split}（口径公式相符）`);
}

// ══ 字段 5: boundaries（Always/Never 各 ≤3 + 边缘用例矩阵）══
{
  const r = parseField("boundaries");
  if (r.error) {
    check("boundaries", false, r.error);
  } else {
    const v = r.value;
    const bad = [];
    if (!v || typeof v !== "object" || Array.isArray(v)) {
      bad.push("须为对象 {always,never,edge_matrix}");
    } else {
      for (const key of ["always", "never"]) {
        const arr = v[key];
        if (!Array.isArray(arr) || arr.length < 1) { bad.push(`${key} 须为非空数组（1-3 条）`); continue; }
        if (arr.length > 3) bad.push(`${key} ${arr.length} 条超上限（≤3）`);
        arr.forEach((x, i) => { if (!isNonEmptyStr(x)) bad.push(`${key}[${i}] 空`); });
      }
      const em = v.edge_matrix;
      if (!Array.isArray(em) || em.length < 1) bad.push("edge_matrix 须为非空数组（≥1 行）");
      else em.forEach((row, i) => {
        if (!row || typeof row !== "object") bad.push(`edge_matrix[${i}] 非对象`);
        else {
          if (!isNonEmptyStr(row.input)) bad.push(`edge_matrix[${i}].input 空`);
          if (!isNonEmptyStr(row.expected)) bad.push(`edge_matrix[${i}].expected 空`);
        }
      });
    }
    check("boundaries", bad.length ? false : true,
      bad.length ? bad.join("; ") : `always ${(v.always || []).length} / never ${(v.never || []).length} / edge_matrix ${(v.edge_matrix || []).length} 行（≤3 纪律相符）`);
  }
}

// ══ 字段 6: dev_record（执行者回填；status=completed 时强制）══
const status = (fm.status || "pending").trim();
{
  const r = parseField("dev_record");
  if (status === "completed") {
    if (r.error) {
      check("dev_record", false, `status=completed 但 ${r.error}`);
    } else {
      const v = r.value;
      const bad = [];
      if (!v || typeof v !== "object" || Array.isArray(v)) bad.push("须为对象 {changed_files,notes,deviations}");
      else {
        if (!Array.isArray(v.changed_files) || v.changed_files.length < 1) bad.push("changed_files 须为非空数组（≥1 个实际改动文件）");
        else v.changed_files.forEach((p, i) => {
          const err = relPathExists(p);
          if (err) bad.push(`changed_files[${i}] "${p}" ${err}`);
        });
        if (!isNonEmptyStr(v.notes)) bad.push("notes（完成备注）空");
        if (!isNonEmptyStr(v.deviations)) bad.push("deviations（偏离原因）空（无偏离须写「无」）");
      }
      check("dev_record", bad.length ? false : true, bad.length ? bad.join("; ") : `${(v.changed_files || []).length} 个改动文件全部存在，notes/deviations 非空`);
    }
  } else {
    const ok = !r.error;
    check("dev_record", true, `status=${status}（未完工，dev_record 允许暂缺${ok ? "" : "；注意当前字段块: " + r.error}）`);
  }
}

// ══ 字段 7: spec_budget（正文 token 上限 ≤1200）══
{
  const limitRaw = fm.spec_budget_tokens === undefined ? "1200" : fm.spec_budget_tokens;
  const limit = Number(limitRaw);
  if (!Number.isInteger(limit) || limit < 1) {
    check("spec_budget", false, `spec_budget_tokens 须为正整数，实得 "${limitRaw}"`);
  } else if (limit > 1200) {
    check("spec_budget", false, `spec_budget_tokens=${limit} 超 v2 定额上限 1200`);
  } else {
    let body = text.replace(/^---\n[\s\S]*?\n---/, "");
    if ("dev_record" in blocks) {
      const idx = body.indexOf("```json dev_record");
      if (idx >= 0) body = body.slice(0, idx); // 执行者回填不计入任务描述预算
    }
    const tok = countTokens(body);
    check("spec_budget", tok <= limit, tok <= limit ? `正文 ${tok} tok ≤ 上限 ${limit}` : `正文 ${tok} tok > 上限 ${limit}（超限即拆 subtasks）`);
  }
}

// ── 输出 ──
console.log(`[validate-task] ${args[0]}`);
for (const r of results) console.log(`  [${r.ok ? "PASS" : "FAIL"}] ${r.name} — ${r.detail}`);
const fails = results.filter((r) => !r.ok);
console.log(`结果: ${results.length - fails.length} PASS / ${fails.length} FAIL`);
if (fails.length) {
  console.log(`[FAIL] ${fails.map((f) => f.name).join(", ")}`);
  process.exit(1);
}
console.log("[OK] task 文档七字段机验通过");
process.exit(0);
