#!/usr/bin/env node
/**
 * TT skill — 轻量跨平台同步脚本（替代 Windows-only sync.ps1 的 TT 场景等价物）
 * 职责（TT 编排场景最小集）:
 *   1. 校验 $AIHUB_ROOT / 配置存在
 *   2. 把 templates/ 渲染产物模板复制到 $PROJECT_ROOT/.ai-hub/plans(或 config 指定)
 *   3. 校验当前项目记忆分区存在（<平台>-projects），缺失则提示
 * 用法: node sync.mjs [--project <PROJECT_ROOT>] [--templates-only] [--dry-run]
 */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __scriptDir = path.dirname(__filename);
const __ttRoot = path.dirname(__scriptDir); // scripts/ -> tt skill 根目录
// SKILL_DIR 解析顺序：① 显式 $SKILL_DIR ② $AIHUB_ROOT/skills/tt（有完整 AI-Hub 时）③ 脚本自身所在目录（自包含/离线）
const SKILL_DIR = process.env.SKILL_DIR || (process.env.AIHUB_ROOT ? path.join(process.env.AIHUB_ROOT, "skills", "tt") : __ttRoot);
const AIHUB_ROOT = process.env.AIHUB_ROOT || path.join(os.homedir(), ".ai-hub");
const DRY = process.argv.includes("--dry-run");

function loadConfig() {
  const cfgPath = path.join(process.cwd(), "config.json");
  if (fs.existsSync(cfgPath)) {
    try { return JSON.parse(fs.readFileSync(cfgPath, "utf8")); } catch { return {}; }
  }
  return {};
}

function copyDir(src, dst) {
  if (!fs.existsSync(src)) return 0;
  fs.mkdirSync(dst, { recursive: true });
  let n = 0;
  for (const e of fs.readdirSync(src, { withFileTypes: true })) {
    const s = path.join(src, e.name);
    const d = path.join(dst, e.name);
    if (e.isDirectory()) n += copyDir(s, d);
    else if (!fs.existsSync(d)) {
      if (!DRY) fs.copyFileSync(s, d);
      n++;
      console.log(`  [SYNC] ${d}`);
    }
  }
  return n;
}

const cfg = loadConfig();
const projectRoot = (process.argv.indexOf("--project") >= 0 ? process.argv[process.argv.indexOf("--project") + 1] : null)
  || cfg.projectRoot || process.cwd();
const externalMode = !!process.env.AIHUB_ROOT;
const memRoot = cfg.memoryRoot || (externalMode ? path.join(AIHUB_ROOT, "memory") : path.join(SKILL_DIR, "memory"));

console.log(`[TT] sync (mode=${externalMode ? "external(AIHUB_ROOT)" : "self-contained(SKILL_DIR)"}, SKILL_DIR=${SKILL_DIR})${DRY ? " [DRY-RUN]" : ""}`);
// 自包含模式（未设 $AIHUB_ROOT）下不要求外部 AI-Hub 存在；仅外部模式才校验 AIHUB_ROOT。
if (externalMode && !fs.existsSync(AIHUB_ROOT)) {
  console.error(`[FAIL] AIHUB_ROOT 不存在: ${AIHUB_ROOT}（设置环境变量 AIHUB_ROOT 或检查 config.json）`);
  process.exit(1);
}
if (!fs.existsSync(SKILL_DIR)) {
  console.error(`[FAIL] TT skill 不存在: ${SKILL_DIR}`);
  process.exit(1);
}

// 1. templates → 项目
const tplSrc = path.join(SKILL_DIR, "templates");
const tplDst = path.join(projectRoot, ".ai-hub", "templates");
console.log(`[1] 模板同步 → ${tplDst}`);
const n = copyDir(tplSrc, tplDst);
console.log(`    新增 ${n} 个模板`);

// 2. 项目记忆分区校验
const platforms = (cfg.platforms || []).map((p) => (typeof p === "string" ? p : p.name));
if (platforms.length) {
  console.log(`[2] 项目记忆分区校验 (${platforms.join(", ")})`);
  for (const p of platforms) {
    const d = path.join(memRoot, `${p}-projects`);
    if (fs.existsSync(d)) console.log(`    [OK] ${d}`);
    else console.log(`    [WARN] 分区不存在: ${d}（项目记忆将无法归集）`);
  }
}

console.log(`\n[OK] sync 完成${DRY ? " (dry-run 未写盘)" : ""}`);
