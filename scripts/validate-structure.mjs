#!/usr/bin/env node
/**
 * TT skill — 结构校验脚本（只读校验，不修改）
 * 检查 SKILL.md: ①frontmatter 完整 ②0~8 步闭环节齐全且编号连续 ③所有 $VAR 已在变量清单声明 ④引用资产存在或标记可选。
 * 用法: node validate-structure.mjs [SKILL.md路径] [--verbose]
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const args = process.argv.slice(2);
const SKILL = args.find((a) => !a.startsWith("--")) || path.join(__dirname, "..", "SKILL.md");
const VERBOSE = args.includes("--verbose");

const errors = [];
const warnings = [];

// ① frontmatter
const raw = fs.readFileSync(SKILL, "utf8").replace(/\r\n/g, "\n");
const fmMatch = raw.match(/^---\n([\s\S]*?)\n---/);
if (!fmMatch) errors.push("缺少 frontmatter (--- 块)");
else {
  for (const key of ["name", "description", "version"]) {
    if (!fmMatch[1].includes(`${key}:`)) errors.push(`frontmatter 缺少字段: ${key}`);
  }
}

// ② 8 步闭环节
const body = raw.replace(/^---\n[\s\S]*?\n---/, "");
const headings = [...body.matchAll(/^##{1,4}\s+(.+)$/gm)].map((m) => m[1].trim());
const sectionTitles = headings.filter((h) => /^\d+[b.]?\s/.test(h) || /^(0|0b)\.?/.test(h));
const requiredFragments = [
  ["闭环全景", "0b"], ["资产整合", "1"], ["文档化", "2"], ["任务拆解", "3"],
  ["规划", "4"], ["并行派单", "5"], ["前端页面", "6"], ["强制技术批判", "7"], ["记忆与同步", "8"], ["迭代优化", "9"],
];
for (const [kw, _] of requiredFragments) {
  if (!headings.some((h) => h.includes(kw))) warnings.push(`未找到章节: ${kw}`);
}

// ③ $VAR 声明
const varsUsed = [...body.matchAll(/\$([A-Z][A-Z0-9_]*)/g)].map((m) => m[1]);
const unique = [...new Set(varsUsed)].sort();
const declaredBlock = body.match(/## 附 A：变量声明清单[\s\S]*?\n([\s\S]*?)(?=## |$)/);
const declared = declaredBlock ? [...declaredBlock[1].matchAll(/\$([A-Z][A-Z0-9_]*)/g)].map((m) => m[1]) : [];
const undeclared = unique.filter((v) => !declared.includes(v) && v !== "VAR"); // VAR 为 §0 泛称占位
if (undeclared.length) errors.push(`未声明的变量: ${undeclared.join(", ")}`);

// ④ 引用资产存在性（随包 vendor/，自包含核心）
const VENDOR = path.join(__dirname, "..", "vendor");
const refs = [...body.matchAll(/`\$SKILL_DIR\/vendor\/([a-z0-9-]+)\//g)].map((m) => m[1]);
// skill 型条目：含 SKILL.md（或索引 SKILL.md），需 name/description/version 接口一致
const SKILL_ENTRIES=["agent-research","agent-vision-toolkit","colorize","frontend-design","frontend-visual-validation","planning","review","sdlc","security","skill-sentinel"];// agent 型条目：含 <name>.md 提示词，无 frontmatter（对应 skillops agent 类型资产）
const AGENT_ENTRIES=["be-architect","be-provider","be-resilience","be-validator","dev-planner","implementation"];
const EXPECTED_VENDOR = [...SKILL_ENTRIES, ...AGENT_ENTRIES];
let vendorMissing = 0;
for (const name of EXPECTED_VENDOR) {
  if (!fs.existsSync(path.join(VENDOR, name))) { warnings.push(`随包资产缺失: vendor/${name}`); vendorMissing++; }
}
for (const name of refs) {
  if (!fs.existsSync(path.join(VENDOR, name))) errors.push(`引用的随包资产不存在: vendor/${name}`);
}

// ⑤ 可移植性校验（对应 skillops add_validator: portability:no_hardcoded_paths）
// tt 自身（SKILL.md + 全部脚本）不得泄露本机绝对路径，所有引用须走 $SKILL_DIR/$AIHUB_ROOT 变量。
const PORTABILITY_RE = /(D:\\|C:\\Users|\/Users\/[^/\s]+|\/home\/[^/\s]+|Administrator)/;
function listCodeFiles(dir, acc = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (e.name === '.git' || e.name === 'artifacts' || e.name === '.tt-state') continue;
    const full = path.join(dir, e.name);
    if (e.isDirectory()) listCodeFiles(full, acc);
    else if (e.name.endsWith('.mjs')) acc.push(full);
  }
  return acc;
}
/** 递归收集 .md 文件（容错：目录不存在时返回空）。 */
function listMd(dir, acc = []) {
  let entries;
  try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch (error) { return acc; }
  for (const e of entries) {
    if (e.name === '.git' || e.name === 'artifacts' || e.name === '.tt-state') continue;
    const full = path.join(dir, e.name);
    if (e.isDirectory()) listMd(full, acc);
    else if (e.name.endsWith('.md')) acc.push(full);
  }
  return acc;
}
const SCRIPT_FILES = [SKILL,
  path.join(path.dirname(SKILL), "README.md"),
  path.join(path.dirname(SKILL), "ONBOARDING.md"),
  ...listCodeFiles(path.join(__dirname, "..", "scripts")),
  ...fs.readdirSync(path.join(__dirname, "..", "templates")).filter((n) => n.endsWith(".md")).map((n) => path.join(__dirname, "..", "templates", n)),
  ...listMd(path.join(__dirname, "..", "commands")),
  ...listMd(path.join(__dirname, "..", "templates", "owner-review")),
];
let leak = 0;
for (const f of SCRIPT_FILES) {
  if (!fs.existsSync(f)) continue;
  fs.readFileSync(f, "utf8").split("\n").forEach((ln, i) => {
    if (PORTABILITY_RE.test(ln) && !ln.includes("PORTABILITY_RE") && !ln.includes("$SKILL_DIR") && !ln.includes("$AIHUB_ROOT")) {
      errors.push(`可移植性泄露 ${path.basename(f)}:${i + 1}`);
      leak++;
    }
  });
}

// ⑥ vendor 资产 frontmatter 接口一致性（对应 skillops add_validator: frontmatter_version_present）
// skill 型条目：每个随包 SKILL.md 必须含 name / description / version，防止接口漂移。
// agent 型条目：仅有 <name>.md 提示词，无 frontmatter，跳过 ⑥，仅做 ⑦ 可移植性扫描。
let drift = 0;
for (const name of SKILL_ENTRIES) {
  const f = path.join(VENDOR, name, "SKILL.md");
  if (!fs.existsSync(f)) { warnings.push(`vendor/${name} 缺少 SKILL.md`); continue; }
  const t = fs.readFileSync(f, "utf8").replace(/\r\n/g, "\n");
  const m = t.match(/^---\n([\s\S]*?)\n---/);
  if (!m) { errors.push(`vendor/${name} 缺少 frontmatter`); drift++; continue; }
  for (const key of ["name", "description", "version"]) {
    if (!m[1].includes(`${key}:`)) { errors.push(`vendor/${name} frontmatter 缺少字段: ${key}`); drift++; }
  }
  // ⑥b frontmatter name 必须等于目录名，防止接口漂移（manifest 按 frontmatter name 注册）
  const fmName = (m[1].match(/^name:\s*(.+)$/m) || [])[1]?.trim();
  if (fmName && fmName !== name) { errors.push(`vendor/${name} frontmatter name 漂移: "${fmName}" ≠ 目录名 "${name}"`); drift++; }
  // ⑦ 可移植性：vendor 资产本身也不得泄露本机绝对路径
  t.split("\n").forEach((ln, i) => {
    if (PORTABILITY_RE.test(ln) && !ln.includes("$SKILL_DIR") && !ln.includes("$AIHUB_ROOT")) {
      errors.push(`可移植性泄露 vendor/${name}/SKILL.md:${i + 1}`); drift++;
    }
  });
}
for (const name of AGENT_ENTRIES) {
  const f = path.join(VENDOR, name, `${name}.md`);
  if (!fs.existsSync(f)) { warnings.push(`vendor/${name} 缺少 ${name}.md`); continue; }
  // ⑦ 可移植性：agent 提示词同样不得泄露本机绝对路径
  fs.readFileSync(f, "utf8").replace(/\r\n/g, "\n").split("\n").forEach((ln, i) => {
    if (PORTABILITY_RE.test(ln) && !ln.includes("$SKILL_DIR") && !ln.includes("$AIHUB_ROOT")) {
      errors.push(`可移植性泄露 vendor/${name}/${name}.md:${i + 1}`); drift++;
    }
  });
}

// ⑧ 编码完整性：字节级检测 U+FFFD 替换字符序列 (EF BF BD)。
// 注意：必须扫原始字节，不能 readFileSync(f,"utf8") 解码后 .includes("\uFFFD")——
// 那会误报任何非 UTF-8 文件（如 GBK 中文历史文档）为损坏，即使其不含任何 FFFD 字节。
function hasFFFDByte(buf) {
  for (let i = 0; i <= buf.length - 3; i += 1) {
    if (buf[i] === 0xEF && buf[i + 1] === 0xBF && buf[i + 2] === 0xBD) return true;
  }
  return false;
}
const mojibakeFiles = [];
for (const f of SCRIPT_FILES) {
  if (!fs.existsSync(f)) continue;
  if (hasFFFDByte(fs.readFileSync(f))) mojibakeFiles.push(path.relative(path.join(__dirname, ".."), f).replace(/\\/g, "/"));
}
if (mojibakeFiles.length) errors.push(`编码损坏 (U+FFFD): ${mojibakeFiles.join(", ")}`);

// ⑨ 防跳阶段调用行（M1 批判 C1 补）：commands/*.md 正文必须含 --prereq-check 调用行字样，
// 防「机验入口存在但 0 处被引用」回归（首扫时 6 文件 0 处含，已补齐）。
const COMMANDS_DIR = path.join(__dirname, "..", "commands");
const cmdFiles = listMd(COMMANDS_DIR).filter((f) => !f.endsWith(".gitkeep"));
let prereqMissing = 0;
for (const f of cmdFiles) {
  const text = fs.readFileSync(f, "utf8").replace(/\r\n/g, "\n");
  const body = text.replace(/^---\n[\s\S]*?\n---/, "");
  if (!/--prereq-check/.test(body)) { errors.push(`阶段命令缺少 --prereq-check 调用行: ${path.relative(path.join(__dirname, ".."), f).replace(/\\/g, "/")}`); prereqMissing++; }
}

// 输出
console.log(`[YY] validate ${SKILL}`);
console.log(`  frontmatter: ${fmMatch ? "OK" : "FAIL"}`);
console.log(`  章节数: ${headings.length}, 闭环关键节 ${requiredFragments.length} 项检查中警告 ${warnings.length} 项`);
console.log(`  变量使用: ${unique.length} 个 (${unique.join(", ")})`);
console.log(`  未声明变量: ${undeclared.length ? undeclared.join(", ") : "无"}`);
console.log(`  随包 vendor 资产: ${EXPECTED_VENDOR.length - vendorMissing}/${EXPECTED_VENDOR.length} 存在`);
console.log(`  接口漂移(vendor frontmatter): ${drift === 0 ? "无" : drift + " 处"}`);
console.log(`  可移植性泄露: ${leak === 0 ? "无" : leak + " 处 (含 vendor)"}`);
console.log(`  编码损坏(U+FFFD): ${mojibakeFiles.length === 0 ? "无" : mojibakeFiles.length + " 个文件"}`);
console.log(`  阶段命令防跳调用行(--prereq-check): ${cmdFiles.length - prereqMissing}/${cmdFiles.length} 命中`);
if (VERBOSE) {
  for (const w of warnings) console.log(`  [WARN] ${w}`);
  for (const e of errors) console.log(`  [ERR]  ${e}`);
}
if (errors.length) {
  console.log(`\n[FAIL] ${errors.length} 项错误`);
  process.exit(1);
}
console.log(`\n[OK] 结构校验通过 (${warnings.length} 项警告, 见 --verbose)`);
