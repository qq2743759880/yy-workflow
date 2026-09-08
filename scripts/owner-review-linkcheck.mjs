#!/usr/bin/env node
/**
 * YY skill — owner-review 引用链接机验（C-25 / C-33）。
 * 对 SKILL.md / commands/*.md / templates/*.md / templates/owner-review/*.md / reference/*.md：
 *   ① 文件级引用检查：正则提取全部 `templates/owner-review/<name>.md` 字面引用，
 *      目标文件不存在 → DANGLING 具名（文件:行号 + 引用串）。C-25 批判的
 *      「悬空引用 0 机验」由此闭环（validate-structure 只查目录存在，不查引用可达）。
 *   ② tab 前缀损坏模式检查（C-33 补充）：`$SKILL_DIR/t` 被吞成 tab 后的两种残留变体——
 *      `<TAB>emplates/`（tab 紧贴）与 `<TAB> emplates/`（tab+空格+emplates），命中即具名。
 *
 * 段落级裸字符串引用（「按其四段结构」等）属 PRD FR-3 GWT3 下一步，本脚本不做语义解析；
 * 核心是「文件级 + tab 损坏」两类，不追加段落名 grep（防过度设计）。
 *
 * 用法:
 *   node scripts/owner-review-linkcheck.mjs                # 扫描仓库根（默认）
 *   node scripts/owner-review-linkcheck.mjs --root <dir>   # 扫描指定根（fixture/自测用）
 *   node scripts/owner-review-linkcheck.mjs --self-test    # 内置正反自测（临时 fixture，跑完清理）
 *
 * 退出码: 0 = PASS（0 悬空 0 损坏）；1 = FAIL（有 DANGLING / TAB-CORRUPT，具名输出）。
 */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.join(__dirname, "..");

/** 引用提取：只认 templates/owner-review/<name>.md 完整形态，防路径前缀其他字符骗匹配。 */
const REF_RE = /templates\/owner-review\/([A-Za-z0-9._-]+\.md)/g;
/** tab 损坏：`t` 被 tab 吞掉 → tab 紧贴 emplates/，或 tab+空格+emplates/ 两种变体。 */
const TAB_RE = /\t ?emplates\//;

/** 解析 --root <dir>：显式参数生效于 fixture 场景；缺省 = 仓库根。 */
function parseRoot(argv) {
  const i = argv.indexOf("--root");
  if (i !== -1 && argv[i + 1]) return path.resolve(argv[i + 1]);
  return REPO_ROOT;
}

/** 递归免：非递归收集目录下 .md（容错：目录不存在返回空，防 ENOENT——如 references/ 不存在）。 */
function listMd(dir) {
  let entries;
  try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { return []; }
  return entries.filter((e) => e.isFile() && e.name.endsWith(".md")).map((e) => path.join(dir, e.name));
}

/** 扫描清单：SKILL.md + commands/ + templates/ 顶层 + templates/owner-review/ + reference/。 */
function scanTargets(root) {
  return [
    path.join(root, "SKILL.md"),
    ...listMd(path.join(root, "commands")),
    ...listMd(path.join(root, "templates")),
    ...listMd(path.join(root, "templates", "owner-review")),
    ...listMd(path.join(root, "reference")),
  ];
}

/** 核心检查：返回 { files, refs, findings }。findings = [{ tag, rel, line, snippet }]。 */
function check(root) {
  const findings = [];
  let files = 0;
  let refs = 0;
  for (const fp of scanTargets(root)) {
    if (!fs.existsSync(fp)) continue;
    files += 1;
    const rel = path.relative(root, fp).replace(/\\/g, "/");
    const lines = fs.readFileSync(fp, "utf8").replace(/\r\n/g, "\n").split("\n");
    lines.forEach((line, idx) => {
      const n = idx + 1;
      // ① 文件级引用：目标必须真实存在 templates/owner-review/<name>.md
      for (const m of line.matchAll(REF_RE)) {
        refs += 1;
        const target = path.join(root, "templates", "owner-review", m[1]);
        if (!fs.existsSync(target)) {
          findings.push({ tag: "DANGLING", rel, line: n, snippet: m[0] });
        }
      }
      // ② tab 前缀损坏残留（C-33 两种变体共用一个判定）
      if (TAB_RE.test(line)) {
        findings.push({ tag: "TAB-CORRUPT", rel, line: n, snippet: JSON.stringify(line.match(TAB_RE)[0]) });
      }
    });
  }
  return { files, refs, findings };
}

function report(root, { files, refs, findings }, quiet) {
  if (!quiet) {
    console.log(`[linkcheck] scanned ${files} files / ${refs} refs（root: ${path.resolve(root)}）`);
    for (const f of findings) console.log(`${f.tag} ${f.rel}:${f.line} ${f.snippet}`);
  }
  if (findings.length) {
    if (!quiet) console.error(`[linkcheck] FAIL ${findings.length} 处（DANGLING=悬空引用 / TAB-CORRUPT=tab 损坏残留）`);
    return 1;
  }
  if (!quiet) console.log("[linkcheck] PASS 0 悬空引用 / 0 tab 损坏");
  return 0;
}

/** 内置自测：① 正向=当前仓库根 PASS；② 反向=临时 fixture（假引用 + tab 损坏）经真实 CLI --root 跑出 FAIL 具名两条；跑完清理。 */
function selfTest() {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "yy-linkcheck-"));
  // fixture：commands/fixture.md 植入假引用 + tab 损坏（\t 为真实 tab 字符）
  const fixtureDir = path.join(tmp, "commands");
  fs.mkdirSync(fixtureDir, { recursive: true });
  fs.writeFileSync(
    path.join(fixtureDir, "fixture.md"),
    [
      "读取 templates/owner-review/ghost-file.md（假引用，目标不存在）",
      "\t emplates/owner-review/real-file.md（tab 吞 t 损坏残留：tab+空格+emplates）",
      "",
    ].join("\n"),
    "utf8",
  );
  // 反向：真实 CLI + --root 指向 fixture（证明 --root 真生效），期望 FAIL exit 1 且两条具名
  const child = spawn(process.execPath, [fileURLToPath(import.meta.url), "--root", tmp], { stdio: ["ignore", "pipe", "pipe"] });
  let out = "";
  child.stdout.on("data", (c) => { out += c.toString(); });
  child.stderr.on("data", (c) => { out += c.toString(); });
  child.on("close", (rc) => {
    const hasDangling = /DANGLING .*ghost-file\.md/.test(out);
    const hasTab = /TAB-CORRUPT .*emplates\//.test(out);
    if (rc === 1 && hasDangling && hasTab) {
      console.log("[linkcheck] self-test 反向：fixture 假引用 + tab 损坏 → FAIL 具名两条 ✓");
    } else {
      console.error(`[linkcheck] self-test 反向失败：exit=${rc} dangling=${hasDangling} tab=${hasTab}\n${out}`);
      process.exitCode = 1;
    }
    // 正向：当前仓库根必须全绿
    const fwd = report(REPO_ROOT, check(REPO_ROOT), true);
    if (fwd === 0) {
      console.log("[linkcheck] self-test 正向：当前仓库根 PASS ✓");
    } else {
      console.error("[linkcheck] self-test 正向失败：仓库根存在悬空/损坏，先修复再跑自测");
      process.exitCode = 1;
    }
    // fixture 验证完毕再清理（子进程跑完才删，防竞态）
    fs.rmSync(tmp, { recursive: true, force: true });
    if (process.exitCode === 1) console.error("[linkcheck] self-test FAIL");
    else console.log("[linkcheck] self-test PASS");
  });
}

if (process.argv.includes("--self-test")) {
  selfTest();
} else {
  process.exitCode = report(parseRoot(process.argv), check(parseRoot(process.argv)));
}
