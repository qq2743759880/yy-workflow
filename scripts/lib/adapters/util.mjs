import { spawn } from 'node:child_process'; 
import fs from 'node:fs/promises'; 
import path from 'node:path'; 
import { TimeoutError } from '../errors.mjs'; 
import { existsSync } from 'node:fs'; 
/**
 * 解析可执行命令（npm 全局安装的 CLI 在 Windows 下通常是 .cmd/.bat shim，
 * libuv 的 spawn 不按 PATHEXT 解析，直接 spawn('cli') 会 ENOENT）。
 * 沿 PATH+PATHEXT 定位 shim 后经 ComSpec（cmd.exe） /d /c 启动（与 npm 自身处理 .cmd 一致）。
 * 非 win32 或找不到时返回裸名，让 spawn 产出 ENOENT → 上层统一映射 NOT_AVAILABLE（行为不变）。
 */
export function resolveCommandShim(cmd) {
  if (process.platform !== 'win32') return { command: cmd, prefix: [] };
  const exts = (process.env.PATHEXT || '.COM;.EXE;.BAT;.CMD').split(';').map(function(s) { return s.trim().toLowerCase(); }).filter(Boolean);
  for (const dir of (process.env.PATH || '').split(path.delimiter).filter(Boolean)) {
    for (const ext of exts) {
      const candidate = path.join(dir, cmd + ext);
      if (existsSync(candidate)) {
        const low = candidate.toLowerCase();
        if (low.endsWith('.cmd') || low.endsWith('.bat')) return { command: process.env.ComSpec || 'cmd.exe', prefix: ['/d', '/c', candidate] };
        return { command: candidate, prefix: [] };
      }
    }
  }
  return { command: cmd, prefix: [] };
}
export function runCommand(command, args, options) { 
  let workspace = options.workspace; 
  if (!workspace) workspace = '.'; 
  let timeoutMs = options.timeoutMs; 
  if (!timeoutMs) timeoutMs = 600000; 
  return new Promise(function(resolve, reject) {
    let output = '';
    let errOutput = '';
    let done = false;
    const child = spawn(command, args, { cwd: workspace, stdio: ['ignore', 'pipe', 'pipe'] });
    // 超时解耦（P2）：默认 resolve 失败对象（探测/降级语义）；throwOnTimeout:true 时超时 throw TimeoutError，
    // 供 withRetry 捕获重试——真实执行调用的超时从此可重试，探测调用不受影响。
    let timer = setTimeout(function() {
      child.kill();
      if (options.throwOnTimeout) fail(new TimeoutError(String(options.timeoutCode)));
      else finish({ ok: false, error: options.timeoutCode });
    }, timeoutMs);
    if (timer.unref) timer.unref();
    function finish(result) { if (done) return; done = true; clearTimeout(timer); resolve(result); }
    function fail(error) { if (done) return; done = true; clearTimeout(timer); reject(error); }
    // result.txt 只采信 stdout（stderr 仅用于错误信息），防"仅 stderr 输出"被误判为真实产出
    child.stdout.on('data', function(chunk) { output += chunk.toString(); });
    child.stderr.on('data', function(chunk) { errOutput += chunk.toString(); });
    child.on('error', function(error) { if (error.code === 'ENOENT') finish({ ok: false, error: options.notAvailableCode }); else finish({ ok: false, error: error.message }); });
    child.on('close', async function(code) {
      if (code !== 0) { if (!output && !errOutput) output = 'external command failed'; else if (!output) output = errOutput.trim(); finish({ ok: false, error: output.trim() }); return; }
      if (!output) output = 'completed';
      const dir = path.join(workspace, 'artifacts', options.subtask.id);
      await fs.mkdir(dir, { recursive: true });
      await fs.writeFile(path.join(dir, 'result.txt'), output);
      finish({ ok: true, artifactPath: path.join('artifacts', options.subtask.id, 'result.txt') });
    });
  });
}
