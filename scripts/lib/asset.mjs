import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';

/**
 * CANDIDATE_INVALID 错误码：资产 manifest 字段提取失败时 fail-closed 抛出
 * （与 evolution.propose 同口径：缺字段即拒绝，不臆造数据）。
 */
export const CANDIDATE_INVALID = 'CANDIDATE_INVALID';

/** 必填字段清单（AV-2 manifest 每行必须齐备） */
const REQUIRED_MANIFEST_FIELDS = ['id', 'name', 'role', 'capability', 'cluster', 'when_to_use', 'when_not_to_use', 'verification', 'source'];

/**
 * 校验 manifest 行必填字段齐全；缺必填字段 → 抛 CANDIDATE_INVALID（fail-closed）。
 * @param {object} row — manifest 单行
 * @param {string} [row.source] — 可选，用于诊断（源文档定位）
 */
function assertManifestRow(row) {
  const missing = REQUIRED_MANIFEST_FIELDS.filter((k) => row[k] === undefined || row[k] === null || row[k] === '' || (Array.isArray(row[k]) && row[k].length === 0));
  if (missing.length > 0) {
    const err = Object.assign(new Error(`manifest row ${row?.id ?? '<unknown>'}: 必填字段缺失 ${missing.join(', ')}（fail-closed CANDIDATE_INVALID）`), { code: CANDIDATE_INVALID, missingFields: missing });
    throw err;
  }
}

/**
 * 从外部 manifest 文件读取并校验（仅读取接口，不改既有逻辑）。
 * 缺必填字段 → 抛 CANDIDATE_INVALID。
 * @param {string} manifestPath — manifest JSON 文件路径
 * @returns {Promise<object[]>>} 校验过的 manifest 行数组
 */
export async function readManifest(manifestPath) {
  const text = await fs.readFile(manifestPath, 'utf8');
  const rows = JSON.parse(text);
  if (!Array.isArray(rows)) {
    const err = Object.assign(new Error(`manifest 非数组: ${manifestPath}（fail-closed CANDIDATE_INVALID）`), { code: CANDIDATE_INVALID });
    throw err;
  }
  return rows.map((row) => { assertManifestRow(row); return row; });
}

/**
 * 从 manifest 对象（buildManifest / loadManifest 返回）读取并校验。
 * 缺必填字段 → 抛 CANDIDATE_INVALID。
 * @param {{entries: object[]}} manifest — manifest 对象（含 entries 数组）
 * @returns {object[]} 校验过的条目数组（原始 entries，不含 manifest 元字段）
 */
export function readManifestEntries(manifest) {
  const entries = manifest?.entries;
  if (!Array.isArray(entries)) {
    const err = Object.assign(new Error(`manifest.entries 非数组（fail-closed CANDIDATE_INVALID）`), { code: CANDIDATE_INVALID });
    throw err;
  }
  return entries.map((entry) => {
    assertManifestRow(entry);
    return entry;
  });
}

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
