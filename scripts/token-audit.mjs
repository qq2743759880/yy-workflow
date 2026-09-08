#!/usr/bin/env node
/**
 * YY skill — token 机验量尺（B0-② / C-35，C-30 收尾验收口径机验化）。
 * 对 SKILL.md / commands/*.md / templates/owner-review/*.md 做 CJK 加权 token 估算并落快照；
 * --gate 模式对比快照，任一文件 token 回退 ≥10% 即 FAIL，防 token 预算静默膨胀。
 *
 * 近似口径：token ≈ CJK字符数×0.75 + 非CJK字符数÷4（非精确 tokenizer，仅作回归量尺）。
 * CJK 范围：\u4e00-\u9fff（统一表意文字）、\u3000-\u303f（CJK 标点）、\uff00-\uffef（全角形式）。
 *
 * 用法:
 *   node scripts/token-audit.mjs             # 估算并打印各文件值，快照写入 docs/history/token-audit-snapshot.json
 *   node scripts/token-audit.mjs --snapshot  # 同默认（显式声明落快照）
 *   node scripts/token-audit.mjs --gate      # 对比快照：回退 ≥10% → exit 1；快照缺失 → exit 2
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, "..");
const SNAPSHOT_PATH = path.join(ROOT, "docs", "history", "token-audit-snapshot.json");
const REGRESSION_THRESHOLD = 10; // token 回退容忍度（%）

const CJK_RE = /[\u4e00-\u9fff\u3000-\u303f\uff00-\uffef]/;

/** CJK 加权 token 估算。近似口径：CJK×0.75 + 其余÷4，非精确 tokenizer。 */
function estimate(text) {
  const chars = [...text];
  let cjk = 0;
  for (const ch of chars) if (CJK_RE.test(ch)) cjk += 1;
  const nonCjk = chars.length - cjk;
  return { chars: chars.length, cjk, tokens: Math.round(cjk * 0.75 + nonCjk / 4) };
}

/** 行数统计（与 validate-structure H1 口径一致：按 \n 切分并去掉末尾空行）。 */
function countLines(text) {
  const normalized = text.replace(/\r\n/g, "\n");
  return normalized.split("\n").length - (normalized.endsWith("\n") ? 1 : 0);
}

/** 递归收集目录下 .md 文件（容错：目录不存在返回空）。 */
function listMd(dir) {
  let entries;
  try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { return []; }
  return entries.filter((e) => e.isFile() && e.name.endsWith(".md")).map((e) => path.join(dir, e.name));
}

/** 扫描清单：SKILL.md + commands/*.md + templates/owner-review/*.md。 */
function scanTargets() {
  return [
    path.join(ROOT, "SKILL.md"),
    ...listMd(path.join(ROOT, "commands")),
    ...listMd(path.join(ROOT, "templates", "owner-review")),
  ];
}

/** 实测全部目标文件，返回 { relpath: { lines, chars, cjk, tokens } }。 */
function measureAll() {
  const files = {};
  for (const fp of scanTargets()) {
    if (!fs.existsSync(fp)) continue;
    const text = fs.readFileSync(fp, "utf8");
    const rel = path.relative(ROOT, fp).replace(/\\/g, "/");
    files[rel] = { lines: countLines(text), ...estimate(text) };
  }
  return files;
}

function buildSnapshot(files) {
  const totals = { files: Object.keys(files).length, lines: 0, chars: 0, cjk: 0, tokens: 0 };
  for (const v of Object.values(files)) {
    totals.lines += v.lines; totals.chars += v.chars; totals.cjk += v.cjk; totals.tokens += v.tokens;
  }
  return { generatedAt: new Date().toISOString(), files, totals };
}

/** 默认模式：打印各文件估算值并写入快照 JSON。 */
function runSnapshot() {
  const snapshot = buildSnapshot(measureAll());
  fs.mkdirSync(path.dirname(SNAPSHOT_PATH), { recursive: true });
  fs.writeFileSync(SNAPSHOT_PATH, JSON.stringify(snapshot, null, 2) + "\n", "utf8");
  console.log("[token-audit] 近似口径：CJK×0.75+其余÷4，非精确 tokenizer");
  for (const [rel, v] of Object.entries(snapshot.files)) {
    console.log(`  ${rel}  ${v.lines} 行 / ${v.tokens} tok (${v.chars} chars, CJK ${v.cjk})`);
  }
  const t = snapshot.totals;
  console.log(`  [totals] ${t.files} 文件 / ${t.lines} 行 / ${t.tokens} tok`);
  console.log(`  快照已写入: ${path.relative(ROOT, SNAPSHOT_PATH).replace(/\\/g, "/")}`);
}

/** gate 模式：对比快照，任一文件 token 回退 ≥10% → FAIL exit 1；快照缺失 → exit 2。 */
function runGate() {
  if (!fs.existsSync(SNAPSHOT_PATH)) {
    console.error("[token-audit] 快照缺失: docs/history/token-audit-snapshot.json — 请先运行 node scripts/token-audit.mjs 生成快照");
    process.exit(2);
  }
  const snapshot = JSON.parse(fs.readFileSync(SNAPSHOT_PATH, "utf8"));
  const current = measureAll();
  const regressions = [];
  for (const [rel, now] of Object.entries(current)) {
    const prev = snapshot.files[rel];
    if (!prev) { regressions.push(`TOKEN_REGRESSION ${rel} 快照无此文件 当前${now.tokens}`); continue; }
    if (now.tokens > prev.tokens) {
      const pct = ((now.tokens - prev.tokens) / prev.tokens * 100).toFixed(1);
      if (Number(pct) >= REGRESSION_THRESHOLD) {
        regressions.push(`TOKEN_REGRESSION ${rel} 快照${prev.tokens} 当前${now.tokens} (+${pct}%)`);
      }
    }
  }
  if (regressions.length) {
    for (const r of regressions) console.error(r);
    console.error(`[token-audit] FAIL ${regressions.length} 个文件 token 回退 ≥${REGRESSION_THRESHOLD}%`);
    process.exit(1);
  }
  console.log(`[token-audit] PASS 全部 ${Object.keys(current).length} 文件 token 回退 <${REGRESSION_THRESHOLD}%（快照 ${snapshot.generatedAt}）`);
}

if (process.argv.includes("--gate")) runGate();
else runSnapshot(); // 默认与 --snapshot 同行为：估算 + 落快照
