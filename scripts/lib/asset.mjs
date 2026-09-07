import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
/** 剥离 frontmatter（--- 头块），返回正文。无 frontmatter 时原样返回。 */
function stripFrontmatter(text) {
  const clean = String(text).replace(/\r\n/g, '\n');
  const match = clean.match(/^---\n[\s\S]*?\n---\n?/);
  if (!match) return clean;
  return clean.slice(match[0].length);
}
/** 资产签名：manifest generatedAt + 各路由资产候选文件 mtime/size 摘要。文件变 → 签名变 → 缓存失效。 */
async function signature(entries, assetsRoot, only, generatedAt) {
  const parts = [String(entries.length), generatedAt || ''];
  for (const entry of entries) {
    if (only && !only.has(entry.name)) continue;
    const root = path.join(assetsRoot, entry.path);
    for (const f of [path.join(root, 'SKILL.md'), path.join(root, entry.name + '.md')]) {
      try { const st = await fs.stat(f); parts.push(entry.name + ':' + st.mtimeMs + ':' + st.size); } catch (error) { if (error.code !== 'ENOENT') throw error; }
    }
  }
  return crypto.createHash('sha1').update(parts.sort().join('|')).digest('hex');
}
/**
 * 资产加载器：把 manifest 中每个资产顶层 SKILL.md（或 agent .md）正文读入内存，
 * 按 manifest name 索引。正文进入执行上下文，由内置 prompt 后端组装进子任务指令包。
 * options: { vendorDir, assetsRoot?, workspace?, manifest?, only?, useCache? }
 *   assetsRoot = manifest entry.path 相对之根（默认 path.dirname(vendorDir)）；
 *   only        = 只加载这些 name（懒加载，本计划路由到的资产）；
 *   useCache    = 命中时用 workspace/.tt-state/assets-cache.json（BE-15，dry-run 不写缓存）。
 * 返回 Map<name, { name, type, meta, body }>。body 为空串表示该资产没有可加载正文。
 */
export async function loadAssets(options) {
  const vendorDir = options.vendorDir;
  const assetsRoot = options.assetsRoot || path.dirname(vendorDir);
  const workspace = options.workspace || path.dirname(vendorDir);
  let manifest = options.manifest;
  if (!manifest) {
    const { buildManifest } = await import('./manifest.mjs');
    manifest = await buildManifest({ vendorDir });
  }
  const only = options.only ? new Set(options.only) : null;
  const useCache = options.useCache !== false;
  const sig = await signature(manifest.entries, assetsRoot, only, manifest.generatedAt);
  const cacheFile = path.join(workspace, '.tt-state', 'assets-cache.json');
  if (useCache) {
    try {
      const cache = JSON.parse(await fs.readFile(cacheFile, 'utf8'));
      if (cache.signature === sig) {
        const assets = new Map();
        for (const item of cache.assets) assets.set(item.name, item);
        return assets;
      }
    } catch (error) { if (error.code !== 'ENOENT') throw error; }
  }
  const loaded = [];
  for (const entry of manifest.entries) {
    if (only && !only.has(entry.name)) continue;
    const root = path.join(assetsRoot, entry.path);
    const skillFile = path.join(root, 'SKILL.md');
    const agentFile = path.join(root, entry.name + '.md');
    let body = null;
    try { body = stripFrontmatter(await fs.readFile(skillFile, 'utf8')); } catch (error) {
      if (error.code !== 'ENOENT') throw error;
    }
    if (body === null) {
      try { body = stripFrontmatter(await fs.readFile(agentFile, 'utf8')); } catch (error) {
        if (error.code !== 'ENOENT') throw error;
      }
    }
    loaded.push({ name: entry.name, type: entry.type, meta: entry, body: body === null ? '' : body });
  }
  if (useCache) {
    await fs.mkdir(path.dirname(cacheFile), { recursive: true });
    await fs.writeFile(cacheFile, JSON.stringify({ signature: sig, generatedAt: new Date().toISOString(), assets: loaded }, null, 2));
  }
  return new Map(loaded.map(function(a) { return [a.name, a]; }));
}
export default loadAssets;
