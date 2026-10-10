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

import {checkMethodologyClosure,matrixBytes} from './asset-upstream-reuse.mjs';
import {checkAssetFiles} from './asset-file-hygiene.mjs';
const hygiene = checkAssetFiles(path.resolve(__dirname, '..'));
const closure=checkMethodologyClosure(path.resolve(__dirname,'..'));
if(closure.ok) {
 try {if(fs.readFileSync(path.resolve(__dirname,'../contracts/generated/asset-invocation-matrix.json'),'utf8')!==matrixBytes(closure.rows)) closure.errors.push({code:'INVOCATION_MATRIX_DRIFT',path:'contracts/generated/asset-invocation-matrix.json',reason:'Regenerate from current declarations'});} catch(e){closure.errors.push({code:'INVOCATION_MATRIX_MISSING',reason:e.message});}
}
const errors = [...closure.errors,...hygiene.errors].map(e => `${e.code}: ${e.path}: ${e.reason}`);
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

// ② 8 步闭环节（M2-R2 瘦身后：SKILL.md 仅保留 0a/0b/红线/指针表；§1~§9 协议迁至 reference/，
// 闭环关键节改为检查 SKILL.md 残留节 + reference/ 文件头部来源章节号，防迁移丢内容）
const body = raw.replace(/^---\n[\s\S]*?\n---/, "");
const headings = [...body.matchAll(/^##{1,4}\s+(.+)$/gm)].map((m) => m[1].trim());
const sectionTitles = headings.filter((h) => /^\d+[b.]?\s/.test(h) || /^(0|0b)\.?/.test(h));
const requiredFragments = [
  ["阶段命令索引", "0a"], ["闭环全景", "0b"], ["红线", "red-lines"], ["分层协议", "pointers"],
];
for (const [kw, _] of requiredFragments) {
  if (!headings.some((h) => h.includes(kw))) warnings.push(`未找到章节: ${kw}`);
}
// reference/ 迁移内容检查（每文件头部须注明来源章节，防「搬迁丢纪律」）
const REF_MIGRATION = [
  ["reference/variables-and-config.md", "变量与配置", "§0"],
  ["reference/asset-integration.md", "资产整合", "§1"],
  ["reference/documentation.md", "文档化", "§2"],
  ["reference/task-decomposition.md", "任务拆解", "§3"],
  ["reference/planning.md", "规划", "§4"],
  ["reference/dispatch-and-acceptance.md", "派单", "§5"],
  ["reference/frontend-gate.md", "前端页面", "§6"],
  ["reference/critique-protocol.md", "技术批判", "§7"],

  ["reference/yy-tt-diff.md", "差异", "附"],
];
for (const [rel, kw, srcSec] of REF_MIGRATION) {
  const fp = path.join(path.dirname(SKILL), rel);
  if (!fs.existsSync(fp)) continue; // 存在性由 H6a 硬断言管
  const t = fs.readFileSync(fp, "utf8");
  if (!t.includes(kw) || !t.includes(srcSec)) warnings.push(`${rel} 头部缺来源章节标记（${kw} / ${srcSec}）`);
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
// （AS-1 drop 7 后 16→9；逐资产清单 = contracts/discrepancies/ 的 AS-1 drop change.record）
const SKILL_ENTRIES=["frontend-design","planning","review","sdlc","security","skill-sentinel"];
// agent 型条目：含 <name>.md 提示词，无 frontmatter（对应 skillops agent 类型资产）
// （AS-1 drop 7 后 6→3，同上清单）
const AGENT_ENTRIES=["be-validator","dev-planner","implementation"];
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

// ⑨ C4 防跳阶段接线：commands 必须调用唯一 host adapter 的 prepare/check。
// 旧 --prereq-check 独立准入已由 Decision Core/V2 取代。
const COMMANDS_DIR = path.join(__dirname, "..", "commands");
const cmdFiles = listMd(COMMANDS_DIR).filter((f) => !f.endsWith(".gitkeep"));
let prereqMissing = 0;
for (const f of cmdFiles) {
  const text = fs.readFileSync(f, "utf8").replace(/\r\n/g, "\n");
  const body = text.replace(/^---\n[\s\S]*?\n---/, "");
  if (!/host-adapter\.mjs["'`]?\s+prepare/.test(body)||!/host-adapter\.mjs["'`]?\s+(check|execute)/.test(body)||!/--save/.test(body)) { errors.push(`阶段命令缺少 C4 prepare --save / check|execute 调用行: ${path.relative(path.join(__dirname, ".."), f).replace(/\\/g, "/")}`); prereqMissing++; }
}

// ============================================================
// M2-R2 硬性协议断言（C-30~C-35 根因修复，任何 FAIL → exit 1，--verbose 不可绕过）
// ============================================================

const ROOT = path.join(__dirname, "..");
const hardAssertions = []; // { name, ok, detail }
function assertHard(name, ok, detail) { hardAssertions.push({ name, ok, detail }); }

/** CJK 加权 token 估算（字符级实测非估算）：non-CJK/2 + CJK×0.6。
 * CJK 判定含 CJK 统一表意文字/扩展A、CJK 标点、全角形式。 */
function countTokens(text) {
  let cjk = 0, non = 0;
  for (const ch of text) {
    const c = ch.codePointAt(0);
    if (
      (c >= 0x4e00 && c <= 0x9fff) || (c >= 0x3400 && c <= 0x4dbf) ||
      (c >= 0x3000 && c <= 0x303f) || (c >= 0xff00 && c <= 0xffef)
    ) cjk++;
    else non++;
  }
  return Math.round(non / 2 + cjk * 0.6);
}

const stripFm = (t) => t.replace(/^---\r?\n[\s\S]*?\r?\n---/, "");

// ── 断言 H1：Token 预算（SKILL.md ≤ 1200 / commands/*.md 每文件 ≤ 500）──
{
  const rawSkill = fs.readFileSync(SKILL, "utf8");
  const bodyOnly = stripFm(rawSkill.replace(/\r\n/g, "\n"));
  const skillLinesTotal = rawSkill.replace(/\r\n/g, "\n").split("\n").length - (rawSkill.endsWith("\n") ? 1 : 0);
  const skillTok = countTokens(bodyOnly);
  const overLine = skillLinesTotal > 60;
  const overTok = skillTok > 1200;
  assertHard(
    "H1a SKILL.md ≤60 行 且 token ≤1200（CJK 加权字符级实测）",
    !overLine && !overTok,
    `实测 ${skillLinesTotal} 行 / ${skillTok} tok${overLine ? "（超行数预算）" : ""}${overTok ? "（超 token 预算）" : ""}`
  );
  const cmdOver = [];
  for (const f of cmdFiles) {
    const t = stripFm(fs.readFileSync(f, "utf8").replace(/\r\n/g, "\n"));
    const tok = countTokens(t);
    if (tok > 500) cmdOver.push(`${path.relative(ROOT, f).replace(/\\/g, "/")}=${tok}tok`);
  }
  assertHard(
    "H1b commands/*.md 每文件 token 预算 ≤500",
    cmdOver.length === 0,
    cmdOver.length ? `超限: ${cmdOver.join(", ")}` : `${cmdFiles.length} 个命令文件全部达标`
  );
}

// ── 断言 H2：交叉引用完整性（防悬空引用——C-25/C-33 复发）──
{
  const dangling = [];
  const tabBroken = [];
  for (const f of cmdFiles) {
    const text = fs.readFileSync(f, "utf8").replace(/\r\n/g, "\n");
    const rel = path.relative(ROOT, f).replace(/\\/g, "/");
    // H2-0 tab 损坏模式（"\t emplates/" 或 "\templates/"，C-33 现行犯回归门）
    if (/[\t\\] ?emplates\/|\\templates\//.test(text)) tabBroken.push(rel);
    // H2-1 owner-review 字面引用必须存在
    for (const m of text.matchAll(/templates\/owner-review\/([a-z0-9-]+)\.md/g)) {
      if (!fs.existsSync(path.join(ROOT, "templates", "owner-review", `${m[1]}.md`))) dangling.push(`${rel} -> templates/owner-review/${m[1]}.md`);
    }
    // H2-2 「XX 段」引用 → 目标模板中该段名（## 标题）必须真实存在
    for (const m of text.matchAll(/「([^「」]{2,25})」\s*段/g)) {
      const seg = m[1];
      // 在 commands 文件自身与三大目标模板中找「## ... seg ...」标题
      const targets = ["templates/contract.md", "templates/completion-report.md", "templates/dev-plan.md", rel];
      const found = targets.some((tp) => {
        const fp = path.join(ROOT, tp);
        if (!fs.existsSync(fp)) return false;
        const t = fs.readFileSync(fp, "utf8").replace(/\r\n/g, "\n");
        return new RegExp(`^#{1,4} .*${seg.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`, "m").test(t);
      });
      if (!found) dangling.push(`${rel} -> 「${seg}」段（目标模板无此段名）`);
    }
  }
  // H2-3 templates/*.md 头部 owner 审核指引引用必须存在
  const tplFiles = fs.readdirSync(path.join(ROOT, "templates")).filter((n) => n.endsWith(".md"));
  for (const name of tplFiles) {
    const t = fs.readFileSync(path.join(ROOT, "templates", name), "utf8").replace(/\r\n/g, "\n");
    for (const m of t.matchAll(/owner 审核指引[：:]\s*templates\/owner-review\/([a-z0-9-]+)\.md/g)) {
      if (!fs.existsSync(path.join(ROOT, "templates", "owner-review", `${m[1]}.md`))) dangling.push(`templates/${name} -> templates/owner-review/${m[1]}.md`);
    }
  }
  if (tabBroken.length) dangling.push(...tabBroken.map((r) => `${r} -> tab 损坏引用 \\templates/`));
  assertHard("H2 交叉引用完整性（owner-review 引用 + 「XX 段」段名 + tab 损坏模式）", dangling.length === 0, dangling.length ? `悬空 ${dangling.length} 处: ${dangling.join("; ")}` : "零悬空");
}

// ── 断言 H3：Gate 接线（防 C-31 复发——祈使句必须变为接线）──
{
  // H3-1 指引必须接入 C4 门禁；实际语义由 test-host-adapter 验证。
  assertHard("H3a commands/*.md 接入 C4 prepare --save / check|execute", prereqMissing === 0, `${cmdFiles.length - prereqMissing}/${cmdFiles.length} 命中`);
  // H3-2 tt-journey.mjs --update 路径必须含 prereqCheck 调用（grep 源码）
  const journeySrc = fs.readFileSync(path.join(ROOT, "scripts", "tt-journey.mjs"), "utf8");
  const hasUpdate = /has\(['"]update['"]\)/.test(journeySrc) || /'--update'|"--update"/.test(journeySrc);
  assertHard("H3b tt-journey.mjs 含 --update 分支", hasUpdate, "grep: has('update') 分支在场");
  const hasPrereqCall = /prereqCheck\(/.test(journeySrc);
  assertHard("H3c tt-journey.mjs --update 路径含 prereqCheck 调用（grep 源码）", hasUpdate && hasPrereqCall, hasPrereqCall ? "prereqCheck( 在场（:101 定义 :132/:492 调用）" : "prereqCheck 调用缺失");
  // H3-3 orchestrator.mjs syncJourney 路径必须含 journey 写入（grep 源码）
  const orchSrc = fs.readFileSync(path.join(ROOT, "scripts", "orchestrator.mjs"), "utf8");
  const hasSyncJourney = /function\s+syncJourney/.test(orchSrc) || /syncJourney/.test(orchSrc);
  assertHard("H3d orchestrator.mjs 含 syncJourney（grep 源码）", hasSyncJourney, "syncJourney 定义/调用在场");
  const syncRegion = orchSrc.slice(Math.max(0, orchSrc.indexOf("function syncJourney")), orchSrc.indexOf("function syncJourney") + 4000);
  const hasJourneyWrite = /writeFile\([^)]*journey|journey\.steps\s*=|updateJourney\(/.test(syncRegion);
  assertHard("H3e syncJourney 路径含 journey 写入（grep 源码）", hasJourneyWrite, hasJourneyWrite ? "journey.steps= / writeFile(journey) 在场" : "journey 写入缺失");
}

// ── 断言 H4：Kickoff 资产清单一致性（防 C-26 复发——清单漂移）──
{
  // 动态导入 CLUSTERS（ESM 数据源，零依赖）
  const matrixUrl = new URL("file:///" + path.join(ROOT, "scripts", "lib", "matrix.mjs").replace(/\\/g, "/"));
  const { CLUSTERS } = await import(matrixUrl.href);
  const kickoffSrc = fs.readFileSync(path.join(ROOT, "templates", "kickoff-prompt.md"), "utf8");
  const drift = [];
  for (const cluster of CLUSTERS) {
    for (const asset of cluster.candidates) {
      // kickoff 中资产以 $SKILL_DIR/vendor/<asset>/ 形式具名（skill 型）或 vendor/<asset>/<asset>.md（agent 型）
      const hit = kickoffSrc.includes(`vendor/${asset}/`);
      if (!hit) drift.push(`${cluster.id}: ${asset}`);
    }
  }
  const total = CLUSTERS.reduce((n, c) => n + c.candidates.length, 0);
  assertHard("H4 kickoff-prompt 资产清单与 matrix.mjs CLUSTERS 一致（逐字对齐）", drift.length === 0, drift.length ? `漂移 ${drift.length}/${total}: ${drift.join(", ")}` : `${total}/${total} 资产名全部在场`);
}

// ── 断言 H5：双源文件一致性（附 A 声明清单必须逐字登记全部 6 个核心变量，防清单缩水）──
{
  // SKILL.md 附 A 是变量声明唯一落点（正文 §0 变量表已迁 reference/variables-and-config.md，
  // 那里的变量表与附 A 同源——此处直接锁定附 A 必含的变量集，缺一即 FAIL）
  const CORE_VARS = ["SKILL_DIR", "AIHUB_ROOT", "PROJECT_ROOT", "PLATFORMS", "TT_HTTP_PROXY"];
  const missingVars = CORE_VARS.filter((v) => !declared.includes(v));
  const bodyVarsInRef = undeclared.filter((v) => v !== "VAR"); // 复用 ③ 的正文扫描结果
  const ok = missingVars.length === 0 && bodyVarsInRef.length === 0;
  assertHard(
    "H5 SKILL.md 附 A 变量声明完整（6 核心变量）且正文 $VAR 全部已声明",
    ok,
    ok ? `${CORE_VARS.length} 核心变量全部登记，正文 ${unique.length} 个变量零未声明` : `${missingVars.length ? "附 A 缺: " + missingVars.join(", ") + " " : ""}${bodyVarsInRef.length ? "正文未声明: " + bodyVarsInRef.join(", ") : ""}`
  );
}

// ── 断言 H6：渐进披露结构（reference/ 文件齐备 + SKILL.md 指针表覆盖）──
{
  const REF_DIR = path.join(ROOT, "reference");
  // 单一事实源（坑#7 解耦）：reference 文件清单不再硬编码于此——从 SKILL.md 指针表动态派生。
  // SKILL.md 指针表是渐进披露的唯一入口，删除/新增一个 reference 文件只需改 SKILL.md，
  // 无需同步改本断言（渐进披露不增改造成本）。指针形态：`reference/<name>.md`（正文任意位置）。
  const skillSrc = stripFm(fs.readFileSync(SKILL, "utf8").replace(/\r\n/g, "\n"));
  const expectedRefs = [...new Set([...skillSrc.matchAll(/reference\/([a-z0-9-]+\.md)/g)].map((m) => m[1]))].sort();
  assertHard("H6a-0 SKILL.md 指针表派生 reference 清单非空（单源可派生）", expectedRefs.length >= 5, `派生 ${expectedRefs.length} 个: ${expectedRefs.join(", ")}`);
  const missingRefs = expectedRefs.filter((n) => !fs.existsSync(path.join(REF_DIR, n)));
  assertHard("H6a reference/ 指针表登记文件齐备（动态）", missingRefs.length === 0, missingRefs.length ? `缺失: ${missingRefs.join(", ")}` : `${expectedRefs.length}/${expectedRefs.length} 在场`);
  // H6b 语义不变：指针表中每个 reference 文件名必须在 SKILL.md 出现（由构造天然成立，
  // 保留显式断言防派生正则将来被改坏——若 expectedRefs 为空或正则失配，此断言抓回归）。
  const uncovered = expectedRefs.filter((n) => !skillSrc.includes(`reference/${n}`));
  assertHard("H6b SKILL.md 指针表覆盖全部 reference/ 文件（派生自同源）", uncovered.length === 0, uncovered.length ? `未覆盖: ${uncovered.join(", ")}` : `${expectedRefs.length}/${expectedRefs.length} 指针在场`);
  // 反向断言：reference/ 目录里存在但指针表未登记的文件 → 提醒（不 FAIL，允许草稿期文件）
  let refOrphan = [];
  try {
    for (const n of fs.readdirSync(REF_DIR)) {
      if (n.endsWith(".md") && !expectedRefs.includes(n) && !hygiene.references?.includes(`reference/${n}`)) refOrphan.push(n);
    }
  } catch (e) { /* reference 目录缺失由 H6a FAIL 覆盖 */ }
  assertHard("H6a-1 reference/ 无未登记孤儿文件（新增须先登记指针）", refOrphan.length === 0, refOrphan.length ? `孤儿: ${refOrphan.join(", ")}` : "零孤儿");
  const refOver = [];
  for (const n of expectedRefs) {
    const fp = path.join(REF_DIR, n);
    if (!fs.existsSync(fp)) continue;
    const tok = countTokens(fs.readFileSync(fp, "utf8").replace(/\r\n/g, "\n"));
    if (tok > 2000) refOver.push(`${n}=${tok}tok`);
  }
  assertHard("H6c reference/ 单文件 ≤2000 token（focused 按需加载）", refOver.length === 0, refOver.length ? `超限: ${refOver.join(", ")}` : "全部达标");
}

// H7: gate 产物模板必须含「阶段机验」字段（C-31 核心未覆盖点）
const GATE_TEMPLATES = [
  "templates/completion-report.md",
  "templates/contract.md",
  "templates/dev-plan.md",
  ...fs.readdirSync(path.join(path.dirname(SKILL), "templates", "owner-review"))
    .filter(f => f.endsWith(".md"))
    .map(f => `templates/owner-review/${f}`),
];
const gateMissing = [];
for (const gp of GATE_TEMPLATES) {
  const fp = path.join(path.dirname(SKILL), gp);
  if (!fs.existsSync(fp)) continue;
  const gt = fs.readFileSync(fp, "utf8");
  if (!gt.includes("阶段机验")) gateMissing.push(gp);
}
assertHard("H7 gate 产物模板含「阶段机验」字段（C-31 出口打卡记录）", gateMissing.length === 0, gateMissing.length ? `缺字段: ${gateMissing.join(", ")}` : `${GATE_TEMPLATES.length} 文件全部在场`);

// H8: 批判落地率动态阈值（C-32：基线 50%，超 20 条后每条 +2%，上限 80%）
const trackerPath = path.join(path.dirname(SKILL), "plans", "critique-backlog-tracker.md");
if (fs.existsSync(trackerPath)) {
  const trackerLines = fs.readFileSync(trackerPath, "utf8").split("\n").filter(l => /^\| C-/.test(l.trim()));
  const closed = trackerLines.filter(l => l.includes("✅")).length;
  const total = trackerLines.length;
  const rate = total > 0 ? Math.floor(closed / total * 100) : 100;
  const dynamicThreshold = Math.min(80, 50 + Math.max(0, total - 20) * 2);
  assertHard("H8 批判落地率 ≥" + dynamicThreshold + "%（动态：基线 50% + 每新增批判 +2%）", rate >= dynamicThreshold, `落地率 ${rate}% (${closed}/${total} ✅) 阈值 ${dynamicThreshold}%`);
}

// ── 断言 H9：SKILL.md token 预算（C-30 收尾机验口径，对齐 B0-② token-audit 量尺）──
// token ≈ CJK×0.75 + 非CJK÷4（CJK 范围 \u4e00-\u9fff\u3000-\u303f\uff00-\uffef），与 scripts/token-audit.mjs 公式一致。
{
  const rawSkill = fs.readFileSync(SKILL, "utf8").replace(/\r\n/g, "\n");
  const h9Lines = rawSkill.split("\n").length - (rawSkill.endsWith("\n") ? 1 : 0);
  let h9Cjk = 0, h9Other = 0;
  for (const ch of rawSkill) {
    const c = ch.codePointAt(0);
    if ((c >= 0x4e00 && c <= 0x9fff) || (c >= 0x3000 && c <= 0x303f) || (c >= 0xff00 && c <= 0xffef)) h9Cjk += 1;
    else h9Other += 1;
  }
  const h9Tok = Math.round(h9Cjk * 0.75 + h9Other / 4);
  const overLine = h9Lines > 60;
  const overTok = h9Tok > 1500;
  assertHard(
    "H9 SKILL.md ≤60 行 且 CJK 加权 token ≤1500（CJK×0.75+其余÷4，对齐 token-audit 量尺）",
    !overLine && !overTok,
    `实测 ${h9Lines} 行 / ${h9Tok} tok${overLine ? "（超行数预算）" : ""}${overTok ? "（超 token 预算）" : ""}`
  );
}

// 硬性断言输出（独立于 --verbose，任何 FAIL → exit 1）
console.log("\n[M2-R2 硬性协议断言]");
for (const a of hardAssertions) {
  console.log(`  [${a.ok ? "PASS" : "FAIL"}] ${a.name} — ${a.detail}`);
  if (!a.ok) errors.push(`硬性断言失败: ${a.name} — ${a.detail}`);
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
console.log(`  阶段命令 C4 接线(prepare/check): ${cmdFiles.length - prereqMissing}/${cmdFiles.length} 命中`);
if (VERBOSE) {
  for (const w of warnings) console.log(`  [WARN] ${w}`);
  for (const e of errors) console.log(`  [ERR]  ${e}`);
}
if (errors.length) {
  console.log(`\n[FAIL] ${errors.length} 项错误`);
  process.exit(1);
}
console.log(`\n[OK] 结构校验通过 (${warnings.length} 项警告, 见 --verbose)`);
