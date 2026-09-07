#!/usr/bin/env node
/**
 * TT skill — openclaw 真机 --exec 宿主（零依赖，node >= 18）
 * 读 brief（prompt 后端的子任务执行指令包）→ 写临时 message 文件 → spawn 本机 openclaw agent
 * （--agent main，模型由 openclaw 本机 agent 配置决定，如 deepseek-v4-flash，无 key 需注入）
 * → 解析 --json stdout 的 result.payloads[0].text → 原样写 plan.md 到 brief 同目录。
 * 用法: node exec-host-openclaw.mjs <brief 绝对路径>
 */
import { spawn } from "node:child_process";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

const TIMEOUT_MS = 180000;          // 宿主调用 openclaw 的超时
const OPENCLAW_SELF_TIMEOUT = 175;  // 传给 openclaw 的 agent 自身超时（秒），先自中止再兜底 kill
const IS_WIN = process.platform === "win32";

function fail(code, msg) {
  console.error("[exec-host-openclaw] " + msg);
  process.exit(code);
}

const briefPath = process.argv[2];
if (!briefPath) fail(2, "用法: node exec-host-openclaw.mjs <brief 绝对路径>");

let brief;
try { brief = await fs.readFile(briefPath, "utf8"); }
catch (e) { fail(2, "读取 brief 失败: " + e.message); }

const assetMatch = brief.match(/-\s*asset:\s*([^\s]+)/);
const asset = assetMatch ? assetMatch[1].trim() : "(unknown)";

// 方法论锚点 = 「方法论正文」段之后的首个标题（与编排器 assetConsumed 校验一致）；取不到则回落资产名
const methodMatch = brief.match(/##\s*方法论正文[\s\S]*?\n(#{1,6}\s+[^\n]+)/);
const anchor = (methodMatch && methodMatch[1].replace(/^#{1,6}\s*/, "").trim()) || asset;

const taskMatch = brief.match(/##\s*本子任务[\s\S]*?-\s*说明:\s*([^\n]+)/);
const task = taskMatch ? taskMatch[1].trim() : "(brief 中未提取到任务)";

// 方法内核 token（与编排器 assetConsumed 校验一致）：kernel 资产须锚点 AND ≥1 内核词，故提取后注入指令让模型显式引用
const VIRTUAL = /^(via|the|and|for|of|to|in|is|or|not|with|as|at|by|hub|uses|layer)$/i;
const kernelLine = (brief.match(/## Execution kernel[\s\S]*?Kernel:\s*([^\n]+)/) || [])[1] || "";
const kernelTokens = [...new Set((kernelLine.match(/`([A-Za-z][A-Za-z0-9._/-]{2,})`|([A-Za-z][A-Za-z0-9._/-]{2,})/g) || [])
  .map((t) => t.replace(/`/g, "").toLowerCase())
  .filter((t) => t.length >= 3 && !VIRTUAL.test(t)))];

// 临时 message 文件：brief 全文 + 宿主注入指令
const msgFile = path.join(os.tmpdir(), "tt-exec-openclaw-" + process.pid + "-" + Date.now() + ".md");
const message = brief + "\n\n---\n\n## 执行指令（宿主注入，openclaw 真机执行宿主）\n\n" +
  "- 严格以上述 brief 中「## 方法论正文（资产全文）」为方法论指导，针对「## 本子任务」产出可直接执行的方案（Markdown）。\n" +
  "- 回复第一行必须写方法论标题锚点（即「方法论正文」段之后首个标题的标题文字，预期为：" + anchor + "）。\n" +
  (kernelTokens.length
    ? "- 回复正文须包含方法论内核标识（brief 中 `Kernel:` 行 token）中的至少一个，如：" + kernelTokens.slice(0, 6).join("、") + "。\n"
    : "") +
  "- 回复正文须标明消费了哪个资产的方法论；不要用 ``` 代码围栏包裹整篇回复。";
await fs.writeFile(msgFile, message, "utf8");

function runOpenclaw() {
  return new Promise(function (resolve) {
    let stdout = "";
    let stderr = "";
    let done = false;
    const args = ["agent", "--agent", "main", "--message-file", msgFile, "--json", "--timeout", String(OPENCLAW_SELF_TIMEOUT)];
    const opts = { stdio: ["ignore", "pipe", "pipe"] };
    let child;
    if (IS_WIN) {
      // Windows 下 openclaw 是 .cmd shim，Node spawn 直调会 ENOENT → 走 shell，逐参数加引号防空格路径
      const cmdline = args.map(function (a) { return '"' + a.replace(/"/g, '\\"') + '"'; }).join(" ");
      child = spawn("openclaw " + cmdline, [], Object.assign({}, opts, { shell: true }));
    } else {
      child = spawn("openclaw", args, opts);
    }
    const timer = setTimeout(function () {
      child.kill();
      finish({ ok: false, error: "openclaw 超时（" + Math.round(TIMEOUT_MS / 1000) + "s）" });
    }, TIMEOUT_MS);
    if (timer.unref) timer.unref();
    function finish(result) { if (done) return; done = true; clearTimeout(timer); resolve(result); }
    child.stdout.on("data", function (c) { stdout += c; });
    child.stderr.on("data", function (c) { stderr += c; });
    child.on("error", function (e) {
      finish({ ok: false, error: e.code === "ENOENT" ? "openclaw 未找到（PATH 中无 openclaw）" : String(e.message || e) });
    });
    child.on("close", function (code) { finish({ ok: code === 0, code: code, stdout: stdout, stderr: stderr }); });
  });
}

let run;
try { run = await runOpenclaw(); }
finally {
  try { await fs.rm(msgFile, { force: true }); } catch (e) { /* 清理失败不阻断 */ }
}

if (!run.ok) {
  const detail = run.stderr ? " stderr: " + run.stderr.slice(0, 400) : "";
  fail(1, "openclaw 执行失败（exit " + run.code + "）" + detail);
}

let data;
try {
  data = JSON.parse(run.stdout);
} catch (e) {
  const m = run.stdout.match(/\{[\s\S]*\}/);
  if (!m) fail(1, "openclaw --json 输出无法解析为 JSON: " + run.stdout.slice(0, 300));
  try { data = JSON.parse(m[0]); } catch (e2) { fail(1, "openclaw --json 输出非 JSON: " + run.stdout.slice(0, 300)); }
}

const payload = data && data.result && Array.isArray(data.result.payloads) ? data.result.payloads[0] : null;
let text = (payload && typeof payload.text === "string") ? payload.text.trim() : "";
if (!text) {
  if (data && data.result && data.result.aborted) fail(1, "openclaw 回复被中止（aborted），无有效文本");
  fail(1, "openclaw 空回复（无 result.payloads[0].text）");
}

const planPath = path.join(path.dirname(briefPath), "plan.md");
await fs.writeFile(planPath, text + "\n", "utf8");

const hasAnchor = text.toLowerCase().includes(String(anchor).toLowerCase());
console.log(
  "[exec-host-openclaw] ok asset=" + asset +
  " anchor=" + anchor +
  " plan=" + path.relative(process.cwd(), planPath) +
  " task=" + task +
  " " + (hasAnchor ? "含锚点" : "缺锚点(assetConsumed=false 风险)")
);
