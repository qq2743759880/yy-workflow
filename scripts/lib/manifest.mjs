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
    entries.push({ name, type, path: path.relative(path.dirname(vendorDir), root).replace(/\\/g, '/'), version, description, keywords: keywords(name + ' ' + description) }); 
  } 
  return { generatedAt: new Date().toISOString(), entries, warnings }; 
} 
export async function loadManifest(options) {
  const vendorDir = options.vendorDir;
  let refresh = false;
  if (options.refresh) refresh = true;
  const stateDir = options.stateDir || path.join(path.dirname(vendorDir), '.tt-state');
  const cache = path.join(stateDir, 'manifest.json');
  if (!refresh) { 
    try { return JSON.parse(await fs.readFile(cache, 'utf8')); } catch (error) { if (error.code !== 'ENOENT') throw error; } 
  } 
  const manifest = await buildManifest({ vendorDir }); 
  await fs.mkdir(stateDir, { recursive: true }); 
  await fs.writeFile(cache, JSON.stringify(manifest, null, 2)); 
  return manifest; 
}
