#!/usr/bin/env node
/**
 * YY skill — kickoff 五簇清单漂移机验（C-26）。
 * templates/kickoff-prompt.md「## 各簇 candidates + preconditions」段的资产清单
 * 若与 scripts/lib/matrix.mjs CLUSTERS 手抄两份，CLUSTERS 增删资产时 kickoff 会静默漂移。
 * 本脚本从 kickoff 段提取各簇资产文件名集合，与 CLUSTERS 数据的本簇资产名集合双向 diff。
 *
 * 用法:
 *   node scripts/kickoff-drift-check.mjs                  # 比对仓库根（默认）
 *   node scripts/kickoff-drift-check.mjs --kickoff <file> # 指定 kickoff 文件（fixture/自测用）
 *   node scripts/kickoff-drift-check.mjs --self-test      # 内置正反自测（临时副本加假资产→FAIL 具名，还原→PASS）
 *
 * 退出码: 0 = PASS（五簇资产集合双向一致）；1 = FAIL（diff 非空，具名输出）。
 */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { CLUSTERS } from "./lib/matrix.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.join(__dirname, "..");
const KICKOFF = path.join(REPO_ROOT, "templates", "kickoff-prompt.md");

/** kickoff 段展示名 → CLUSTERS 簇 id（比对按 CLUSTERS 顺序逐簇进行）。 */
const TITLE_TO_ID = {
  "T1 数据库": "T1_DATABASE",
  "T2 后端": "T2_BACKEND",
  "T3 AI-RAG-MCP": "T3_AI_RAG_MCP",
  "T4 前端": "T4_FRONTEND",
  "T5 运维": "T5_OPS",
};
/** 候选资产引用形态：`$SKILL_DIR/vendor/<name>/<file>.md`（反引号包裹、顿号分隔）。 */
const CAND_RE = /`?\$SKILL_DIR\/vendor\/([A-Za-z0-9._-]+)\//g;

/** 解析 --kickoff <file>：显式参数生效于 fixture 场景；缺省 = 仓库根 kickoff-prompt.md。 */
function parseKickoffPath(argv) {
  const i = argv.indexOf("--kickoff");
  if (i !== -1 && argv[i + 1]) return path.resolve(argv[i + 1]);
  return KICKOFF;
}

/** 从 kickoff 文本提取各簇资产名集合：{ [clusterId]: Set<assetName> }。 */
function extractClusters(text) {
  const lines = text.replace(/\r\n/g, "\n").split("\n");
  const result = {};
  let current = null;
  for (const line of lines) {
    const heading = line.match(/^###\s+(.+?)\s*$/);
    if (heading) {
      current = TITLE_TO_ID[heading[1]] || null;
      if (current) result[current] = new Set();
      continue;
    }
    if (current && /^candidates：/.test(line)) {
      for (const m of line.matchAll(CAND_RE)) result[current].add(m[1]);
    }
  }
  return result;
}

/** 双向 diff：返回 { missing, extra, notFound }——missing=kickoff 缺 / extra=kickoff 多出 / notFound=段缺整簇。 */
function diff(kickoffClusters) {
  const missing = [];
  const extra = [];
  const notFound = [];
  for (const cluster of CLUSTERS) {
    const got = kickoffClusters[cluster.id];
    if (!got) { notFound.push(cluster.id); continue; }
    const want = new Set(cluster.candidates);
    for (const name of want) if (!got.has(name)) missing.push(cluster.id + ":" + name);
    for (const name of got) if (!want.has(name)) extra.push(cluster.id + ":" + name);
  }
  return { missing, extra, notFound };
}

function check(kickoffPath) {
  let text;
  try { text = fs.readFileSync(kickoffPath, "utf8"); } catch (error) {
    return { ok: false, output: "[drift-check] FAIL 无法读取 kickoff 文件: " + kickoffPath + "（" + error.code + "）", count: 0 };
  }
  const { missing, extra, notFound } = diff(extractClusters(text));
  const total = CLUSTERS.reduce(function (sum, c) { return sum + c.candidates.length; }, 0);
  const lines = [];
  if (missing.length) lines.push("DRIFT kickoff 缺失: [" + missing.join(", ") + "]");
  if (extra.length) lines.push("DRIFT kickoff 多出: [" + extra.join(", ") + "]");
  for (const id of notFound) lines.push("DRIFT kickoff 缺失簇段: [" + id + "]");
  if (lines.length) return { ok: false, output: lines.join("\n"), count: total };
  return { ok: true, output: "[drift-check] PASS " + total + " 资产双向一致", count: total };
}

/** 内置自测：① 正向=仓库根 PASS；② 反向=临时 kickoff 副本加一条假资产，经真实 CLI --kickoff 跑出 FAIL 具名；跑完清理。 */
function selfTest() {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "yy-drift-"));
  const fixture = path.join(tmp, "kickoff-prompt.md");
  fs.copyFileSync(KICKOFF, fixture);
  const original = fs.readFileSync(fixture, "utf8");
  // T1 簇 candidates 行尾追加假资产 ghost-asset（真实 CLI + --kickoff 指向副本）
  // T1 为五簇首个 section，其 candidates 是全文首个 `candidates：` 行，按行替换（`.` 不跨行，不能用跨行锚）。
  const tampered = original.replace(/^(candidates：.*)$/m, "$1、`$SKILL_DIR/vendor/ghost-asset/SKILL.md`");
  fs.writeFileSync(fixture, tampered, "utf8");
  const child = spawn(process.execPath, [fileURLToPath(import.meta.url), "--kickoff", fixture], { stdio: ["ignore", "pipe", "pipe"] });
  let out = "";
  child.stdout.on("data", (c) => { out += c.toString(); });
  child.stderr.on("data", (c) => { out += c.toString(); });
  child.on("close", (rc) => {
    const hasGhost = /DRIFT kickoff 多出: \[T1_DATABASE:ghost-asset\]/.test(out);
    if (rc === 1 && hasGhost) {
      console.log("[drift-check] self-test 反向：fixture 假资产 ghost-asset → FAIL 具名 ✓");
    } else {
      console.error(`[drift-check] self-test 反向失败：exit=${rc} ghost=${hasGhost}\n${out}`);
      process.exitCode = 1;
    }
    // 正向：还原后的真实仓库根 kickoff 必须全绿
    const fwd = check(KICKOFF);
    if (fwd.ok) {
      console.log("[drift-check] self-test 正向：还原后仓库根 " + fwd.output + " ✓");
    } else {
      console.error("[drift-check] self-test 正向失败：仓库根本身存在漂移，先修复再跑自测\n" + fwd.output);
      process.exitCode = 1;
    }
    fs.rmSync(tmp, { recursive: true, force: true });
    if (process.exitCode === 1) console.error("[drift-check] self-test FAIL");
    else console.log("[drift-check] self-test PASS");
  });
}

if (process.argv.includes("--self-test")) {
  selfTest();
} else {
  const kickoffPath = parseKickoffPath(process.argv);
  const result = check(kickoffPath);
  console.log(result.output);
  process.exitCode = result.ok ? 0 : 1;
}
