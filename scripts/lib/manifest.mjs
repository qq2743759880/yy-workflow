/**
 * ⚠️ 边界声明（第九审计 F-003 采纳，2026-09-24）：本模块 = 遗留的运行时资产发现缓存
 * （扫 vendor SKILL.md frontmatter → {name,type,path,version,description,keywords}，缓存于
 * <ws>/.tt-state/manifest.json，供 brief 组装/关键词路由）。它 **不是** 治理 manifest：
 *  - 治理 manifest 唯一构建器 = scripts/manifest-build.mjs（产物 contracts/asset-manifest-v2.json）；
 *  - 本模块 **禁止** 写 contracts/ 下任何文件（preflight 断言把关）；
 *  - 全面统一（Option B）留批 2 Prompt Compiler 一起做。
 */
import fs from 'node:fs/promises'; 
import path from 'node:path'; 
function parseFrontmatter(text) { 
  const result = {}; 
  const match = text.replace(/\r\n/g, '\n').match(/---\n([\s\S]*?)\n---/); 
  if (!match) return result; 
  for (const line of match[1].split('\n')) { 
    const i = line.indexOf(':'); 
    if (i !== -1) result[line.slice(0, i).trim()] = line.slice(i + 1).trim(); 
  } 
  return result; 
} 
function keywords(value) { 
  if (!value) value = ''; 
  return [...new Set(String(value).toLowerCase().split(/[a-z0-9\u4e00-\u9fff]+/).filter(function(x) { return Boolean(x); }))]; 
} 
export async function buildManifest(options) { 
  const vendorDir = options.vendorDir; 
  const warnings = []; 
  let dirs; 
  try { dirs = await fs.readdir(vendorDir, { withFileTypes: true }); } catch (error) { 
    if (error.code === 'ENOENT') return { generatedAt: new Date().toISOString(), entries: [], warnings: ['vendor directory missing'] }; 
    throw error; 
  } 
  const entries = []; 
  const folders = dirs.filter(function(item) { return item.isDirectory(); }).sort(function(a, b) { return a.name.localeCompare(b.name); }); 
  for (const item of folders) { 
    const root = path.join(vendorDir, item.name); 
    const skillFile = path.join(root, 'SKILL.md'); 
    const agentFile = path.join(root, item.name + '.md'); 
    let type = null; 
    let version = null; 
    let name = item.name; 
    let description = ''; 
    try { 
      const text = await fs.readFile(skillFile, 'utf8'); 
      const fm = parseFrontmatter(text); 
      type = 'skill'; 
      if (fm.name) name = fm.name; 
      if (fm.version) version = fm.version; 
      if (fm.description) description = fm.description; 
    } catch (error) { 
      if (error.code !== 'ENOENT') throw error; 
      try { await fs.access(agentFile); type = 'agent'; description = (await fs.readFile(agentFile, 'utf8')).split('\n').slice(0, 8).join(' '); } catch (agentError) { 
        if (agentError.code === 'ENOENT') { warnings.push('unrecognized asset: ' + item.name); continue; } 
        throw agentError; 
      } 
    } 
    let optional_profile=null;
    try {optional_profile=JSON.parse(await fs.readFile(path.join(root,'METHODOLOGY.json'),'utf8')).optional_profile||null;} catch(e) {if(e.code!=='ENOENT') throw e;}
    entries.push({ optional_profile, name, type, path: path.relative(path.dirname(vendorDir), root).replace(/\\/g, '/'), version, description, keywords: keywords(name + ' ' + description) }); 
  } 
  return { generatedAt: new Date().toISOString(), entries, warnings }; 
} 
export async function loadManifest(options) {
  const vendorDir = options.vendorDir;
  let refresh = false;
  if (options.refresh) refresh = true;
  const stateDir = options.stateDir || path.join(path.dirname(vendorDir), '.tt-state');
  const cache = path.join(stateDir, 'manifest.json');
  // Rebuild bounded catalog: declaration policy cannot come from a stale discovery cache.
  const manifest = await buildManifest({ vendorDir }); 
  await fs.mkdir(stateDir, { recursive: true }); 
  await fs.writeFile(cache, JSON.stringify(manifest, null, 2)); 
  return manifest; 
}
