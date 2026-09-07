#!/usr/bin/env node
/**
 * TT skill — a6api 参考 --exec 宿主（零依赖，node >= 18）
 * 读 brief（prompt 后端的子任务指令包）→ 调 a6api 真机 LLM → 把回复写为 plan.md 到 brief 同目录。
 * 用法: node exec-host-a6api.mjs [--model <id>] <brief 绝对路径>
 *   --model <id>  指定 a6api 模型（默认 DeepSeek-V4-Flash-0731）；Outside Voice 跨模型批判可传
 *                 --model gpt-5.6-luna 等作第二宿主，让不同模型审同一任务以对比分歧。
 *   key 从环境变量 A6API_KEY 读（禁写死）；brief 为位置参数（编排器追加在最后）。
 * 产物 plan.md 含资产名/方法论标题锚点，供编排器 assetConsumed=true 校验。
 */
import fs from "node:fs/promises";
import path from "node:path";

const ENDPOINT = process.env.A6API_BASE_URL ? process.env.A6API_BASE_URL.replace(/\/$/, "") + "/v1/chat/completions" : "http://127.0.0.1:15724/v1/chat/completions";
const DEFAULT_MODEL = "DeepSeek-V4-Flash-0731";

async function fail(code, msg) {
  console.error("[exec-host-a6api] " + msg);
  await new Promise((r) => setTimeout(r, 50)); // 给 undici 事件循环清理时间，避免 Windows libuv 崩溃码
  process.exit(code);
}

// argv 解析：--model <id> 为标志值对，可出现在任意位置；brief 为位置参数（通常最后一个）。
// 无 --model 时 brief 仍在 argv[2]，保持原用法；有 --model 时位于其后，扫描定位即可。
const args = process.argv.slice(2);
let model = DEFAULT_MODEL;
let briefPath = null;
for (let i = 0; i < args.length; i += 1) {
  const a = args[i];
  if (a === "--help" || a === "-h") {
    console.log("用法: node exec-host-a6api.mjs [--model <id>] <brief 绝对路径>");
    console.log("  --model <id>  a6api 模型 id（默认 " + DEFAULT_MODEL + "）");
    process.exit(0);
  } else if (a === "--model") {
    const v = args[i + 1];
    if (v === undefined || v.startsWith("--")) await fail(1, "--model 需要一个模型 id（如 gpt-5.6-luna）；显式传入但缺值/非法不允许静默回落默认");
    model = v;
    i += 1;
  } else if (!a.startsWith("--")) {
    briefPath = a;
  }
}
if (!briefPath) await fail(2, "用法: node exec-host-a6api.mjs [--model <id>] <brief 绝对路径>");

const key = process.env.A6API_KEY || "PROXY_MANAGED";

let brief;
try { brief = await fs.readFile(briefPath, "utf8"); }
catch (e) { await fail(2, "读取 brief 失败: " + e.message); }

const assetMatch = brief.match(/-\s*asset:\s*([^\s]+)/);
const asset = assetMatch ? assetMatch[1].trim() : "(unknown)";

// 方法论锚点 = 「方法论正文」段之后的首个标题（与编排器 assetConsumed 校验一致）；取不到则回落资产名
const methodMatch = brief.match(/##\s*方法论正文[\s\S]*?\n(#{1,6}\s+[^\n]+)/);
const anchor = (methodMatch && methodMatch[1].replace(/^#{1,6}\s*/, "").trim()) || asset;

const taskMatch = brief.match(/##\s*本子任务[\s\S]*?-\s*说明:\s*([^\n]+)/);
const task = taskMatch ? taskMatch[1].trim() : "(brief 中未提取到任务)";

const system = [
  "你是 TT 多 Agent 编排的执行宿主，负责把 brief 转换为可直接执行的方案。",
  "严格以 brief 中「方法论正文（资产全文）」为指导，针对本子任务产出方案/计划。",
  "回复开头必须包含方法论标题锚点标题（取自 brief 的标题），并在正文标明消费了哪个资产的方法论。",
  "回复为 Markdown，简洁、可执行。",
].join("\n");

const payload = {
  model: model,
  max_tokens: 2000,
  messages: [
    { role: "system", content: system },
    { role: "user", content: brief },
  ],
};

let data;
try {
  const res = await fetch(ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/json", "Authorization": "Bearer " + key },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(120000),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    await fail(1, "a6api 调用失败 HTTP " + res.status + ": " + body.slice(0, 500));
  }
  data = await res.json();
} catch (e) {
  await fail(1, "a6api 调用异常: " + (e && e.message ? e.message : String(e)));
}

const choice = data && data.choices && data.choices[0];
const msg = (choice && choice.message) || {};
let content = msg.content || "";
if (!content || !content.trim()) {
  // reasoning_content 回落（DeepSeek 推理模型 content 常空）：剥离 CoT 元标记（<summary>/<details> 块），只留结论，避免产物混入推理元评论
  let rc = msg.reasoning_content || "";
  if (rc) {
    rc = rc.replace(/<summary>[\s\S]*?<\/summary>/gi, "").replace(/<details>[\s\S]*?<\/details>/gi, "").replace(/```[\s\S]*?```/g, "");
    content = rc.trim();
  }
}
if (!content || !content.trim()) await fail(1, "a6api 返回空内容（无 message.content 且无 reasoning_content）");

const planPath = path.join(path.dirname(briefPath), "plan.md");
const plan = [
  "# " + anchor,
  "",
  "> 资产: `" + asset + "` · 执行宿主: a6api 参考宿主（model `" + model + "`）",
  "",
  content.trim(),
  "",
].join("\n");
await fs.writeFile(planPath, plan, "utf8");

console.log(
  "[exec-host-a6api] ok asset=" + asset +
  " anchor=" + anchor +
  " plan=" + path.relative(process.cwd(), planPath) +
  " task=" + task
);
