#!/usr/bin/env node
/**
 * TT skill — 平台探测脚本（只读，不安装不修改）
 * 探测本机已安装的 AI 平台及其配置目录，输出可用平台 + 能力提示。
 * 用法: node detect-platforms.mjs [--json]
 */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const HOME = os.homedir();

/** 平台探测定义: 名称 → 候选配置路径(存在任一即视为已装) */
const PLATFORMS = [
  { name: "opencode", dirs: [path.join(HOME, ".config", "opencode")], note: "常作编排者/主 agent" },
  { name: "trae", dirs: [path.join(HOME, ".trae-cn")], note: "Trae CN" },
  { name: "traework", dirs: [process.env.APPDATA ? path.join(process.env.APPDATA, "TRAE SOLO CN") : ""], note: "TRAE SOLO CN" },
  { name: "claude", dirs: [path.join(HOME, ".claude")], note: "Claude Code" },
  { name: "codex", dirs: [path.join(HOME, ".codex")], note: "OpenAI Codex" },
  { name: "cursor", dirs: [path.join(HOME, ".cursor")], note: "Cursor" },
  { name: "openclaw", dirs: [path.join(HOME, ".openclaw")], note: "openclaw" },
];

function detect() {
  const found = [];
  for (const p of PLATFORMS) {
    const hit = p.dirs.filter(Boolean).some((d) => fs.existsSync(d));
    if (hit) found.push({ name: p.name, note: p.note });
  }
  return found;
}

function assignRoles(platforms) {
  // 角色分配启发式: 编排者=首个(opencode 优先); 其余按序分域
  const roles = { orchestrator: null, domains: [] };
  if (platforms.length === 0) return roles;
  const ordered = [...platforms].sort((a, b) => {
    const rank = { opencode: 0, claude: 1, trae: 2, traework: 3, codex: 4, cursor: 5, openclaw: 6 };
    return (rank[a.name] ?? 9) - (rank[b.name] ?? 9);
  });
  roles.orchestrator = ordered[0].name;
  const rest = ordered.slice(1);
  const labels = ["backend", "frontend", "research", "review"];
  roles.domains = rest.map((p, i) => ({ platform: p.name, domain: labels[i % labels.length] }));
  return roles;
}

const platforms = detect();
const roles = assignRoles(platforms);
const result = { platforms, count: platforms.length, mode: platforms.length >= 2 ? "multi" : "single", roles };

if (process.argv.includes("--json")) {
  process.stdout.write(JSON.stringify(result, null, 2) + "\n");
} else {
  console.log(`[TT] 探测到 ${platforms.length} 个平台 (模式: ${result.mode})`);
  if (platforms.length === 0) {
    console.log("  未探测到已知 AI 平台配置目录。请检查 $AIHUB_ROOT 配置或手工编辑 config.json 的 platforms 段。");
  } else {
    for (const p of platforms) console.log(`  - ${p.name} (${p.note})`);
    console.log(`  编排者建议: ${roles.orchestrator ?? "(无)"}`);
    if (roles.domains.length) {
      console.log("  分域建议(可覆写):");
      for (const d of roles.domains) console.log(`    ${d.platform} → ${d.domain}`);
    }
  }
  console.log("\n提示: 将结果写入 config.json 的 platforms 段可固化分配；可手工覆写。");
}
