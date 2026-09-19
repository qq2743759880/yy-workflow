/**
 * R5b host-bridge: YY host-side injector for the Journey Control Room webview page.
 * OQ-U-17=a: host-injected global — data enters the page as window.__YY_JOURNEY__ BEFORE first script runs.
 * Consumes ONLY existing CLI: node scripts/tt-journey.mjs --read / --project (stdout unified shell JSON).
 * Additive file; does NOT modify scripts/tt-journey.mjs or scripts/lib/journey.mjs (frozen consumption).
 * OQ-U-18=a+c: refresh = host re-runs CLI and re-injects (page manual refresh asks host; no polling).
 */
import { spawn } from 'node:child_process';
import path from 'node:path';
import http from 'node:http';
import fs from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(HERE, '..', '..');

function runJourneyCli(args) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [path.join(REPO_ROOT, 'scripts', 'tt-journey.mjs'), ...args], {
      cwd: REPO_ROOT,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let out = '';
    let err = '';
    child.stdout.on('data', (d) => { out += d; });
    child.stderr.on('data', (d) => { err += d; });
    child.on('error', reject);
    child.on('close', () => {
      // NOT_FOUND / STALE exit 1 but are valid data-channel responses: parse stdout regardless of exit code.
      let shellJson = null;
      let parseError = null;
      try { shellJson = JSON.parse(out); } catch (e) { parseError = e.message; }
      if (shellJson) resolve(shellJson);
      else reject(new Error('tt-journey stdout 非统一壳 JSON: ' + (parseError || out.slice(0, 200) || err.slice(0, 200))));
    });
  });
}

/** Build the injection payload: both shells + echo metadata. Never invents data. */
export async function buildInjectionPayload({ workspace = '.', sessionId = null, mode = 'summary' } = {}) {
  const readArgs = ['--read', '--workspace', workspace, '--mode', mode];
  const projectArgs = ['--project', '--workspace', workspace, '--mode', mode];
  if (sessionId != null) { readArgs.push('--session', String(sessionId)); projectArgs.push('--session', String(sessionId)); }
  const [read, project] = await Promise.all([runJourneyCli(readArgs), runJourneyCli(projectArgs)]);
  return {
    read,
    project,
    injectedAt: new Date().toISOString(),
    sessionId: sessionId != null ? String(sessionId) : null,
  };
}

/** Script tag injected BEFORE the page's first script tag (OQ-U-17=a ordering guarantee). */
export function injectionScriptTag(payload) {
  return '<script>window.__YY_JOURNEY__ = ' + JSON.stringify(payload).replace(/</g, '\\u003c') + ';</script>';
}

/** OQ-U-19=a: single persistent page; session switch = host reloads page with new payload (host decides). */
export async function buildPageHtml({ workspace = '.', sessionId = null, mode = 'summary' } = {}) {
  const html = await fs.readFile(path.join(HERE, 'index.html'), 'utf8');
  const payload = await buildInjectionPayload({ workspace, sessionId, mode });
  const tag = injectionScriptTag(payload);
  // Inject before the first script tag so the global exists before page scripts run.
  const idx = html.indexOf('<script');
  const injected = idx >= 0 ? html.slice(0, idx) + tag + '\n' + html.slice(idx) : html + tag;
  return injected;
}

/** Optional dev static server with injection on every request (manual refresh / host push re-request => re-inject). */
export async function servePage({ workspace = '.', sessionId = null, mode = 'summary', port = 0 } = {}) {
  const server = http.createServer(async (req, res) => {
    try {
      const body = await buildPageHtml({ workspace, sessionId, mode });
      res.writeHead(200, { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' });
      res.end(body);
    } catch (e) {
      res.writeHead(500, { 'content-type': 'text/plain; charset=utf-8' });
      res.end('host-bridge error: ' + e.message);
    }
  });
  await new Promise((resolve) => server.listen(port, '127.0.0.1', resolve));
  const addr = server.address();
  return { server, url: 'http://127.0.0.1:' + addr.port + '/', close: () => new Promise((r) => server.close(r)) };
}