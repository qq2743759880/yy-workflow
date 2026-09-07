#!/usr/bin/env node
/** 
 * Git Data API 推送脚本：把本地 git 历史推送到 GitHub 私有仓（github.com:443 被墙时 git push 不通，
 * api.github.com 可达，走 Git Data API）。用法：
 *   GH_TOKEN=<pat> node scripts/push-gitdata.mjs [--branch main] [--commit <sha>]
 *   GH_TOKEN=<pat> node scripts/push-gitdata.mjs [--branch main] [--commit <sha>] [--ref-only] [--force]
 * 流程：探测远端 ref → 收集远端已有对象（断点续传）→ 并发上传缺失 blobs（8 路）→
 *       按拓扑序上传缺失 trees → 上传 commit 链 → 更新 ref。
 * --ref-only：跳过 blob/tree/commit 上传，只更新 ref（对象已上传但 ref 更新失败时秒级重试）。
 * --force：远端历史与本地链分叉（非 fast-forward）时强制更新 ref（谨慎，会丢弃远端孤立历史）。
 * 只读本地 git，不改动仓库；token 只从环境变量读取。api() 带 30s 超时 + 指数退避重试。
 */
import { execFileSync } from 'node:child_process'; 
import fs from 'node:fs'; 
import path from 'node:path'; 
import { fileURLToPath } from 'node:url'; 

const REPO = process.env.TT_PUSH_REPO || 'qq2743759880/tt-together-agent'; 
const API = 'https://api.github.com'; 

function die(message) { console.error('[push] ' + message); process.exit(1); } 
function run(cmd, args) { return execFileSync(cmd, args, { maxBuffer: 64 * 1024 * 1024 }); } 
function git(args) { return run('git', ['-C', repoRoot].concat(args)); } 
function gitText(args) { return git(args).toString().trim(); } 

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'); 
const branch = process.argv.includes('--branch') ? process.argv[process.argv.indexOf('--branch') + 1] : 'main'; 
const target = process.argv.includes('--commit') ? process.argv[process.argv.indexOf('--commit') + 1] : gitText(['rev-parse', 'HEAD']); 
const refOnly = process.argv.includes('--ref-only'); 
const force = process.argv.includes('--force'); 

const token = process.env.GH_TOKEN; 
if (!token) die('缺少 GH_TOKEN 环境变量（GitHub Personal Access Token，需要 Contents: write 权限）'); 
const auth = { Authorization: 'Bearer ' + token, Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28' }; 

async function api(method, url, body, retries = 3) { 
  let lastError; 
  for (let attempt = 0; attempt <= retries; attempt++) { 
    const controller = new AbortController(); 
    const timer = setTimeout(function() { controller.abort(); }, 30000); 
    try { 
      const response = await fetch(API + url, { method, headers: auth, body: body === undefined ? undefined : JSON.stringify(body), signal: controller.signal }); 
      const text = await response.text(); 
      let data = null; 
      try { data = text ? JSON.parse(text) : null; } catch (error) { data = { raw: text }; } 
      if (!response.ok) { 
        const message = data && (data.message || data.raw) || ('HTTP ' + response.status); 
        throw new Error(method + ' ' + url + ' -> ' + response.status + ': ' + message); 
      } 
      return data; 
    } catch (error) { 
      lastError = error; 
      // 幂等操作可安全重试；HTTP 4xx（鉴权/不存在）不重试
      if (error.message && / 4\d\d:/.test(error.message)) throw error; 
      if (attempt < retries) { 
        const wait = 1000 * Math.pow(2, attempt); 
        console.warn('[push] api ' + method + ' ' + url + ' 失败(' + error.message + ')，' + wait + 'ms 后重试 (' + (attempt + 1) + '/' + retries + ')'); 
        await new Promise(function(resolve) { setTimeout(resolve, wait); }); 
      } 
    } finally { 
      clearTimeout(timer); 
    } 
  } 
  throw lastError; 
} 

// 1) 远端状态探测
console.log('[push] target commit: ' + target + ' branch: ' + branch + ' repo: ' + REPO); 
let remoteHead = null; 
try { 
  const repoInfo = await api('GET', '/repos/' + REPO); 
  console.log('[push] repo: ' + (repoInfo.private ? 'private' : 'public') + ', default_branch=' + repoInfo.default_branch); 
} catch (error) { die('仓库不可访问（不存在或 token 无权限）: ' + error.message); } 
try { 
  const ref = await api('GET', '/repos/' + REPO + '/git/ref/heads/' + branch); 
  remoteHead = ref.object.sha; 
  console.log('[push] remote ' + branch + ' at ' + remoteHead); 
} catch (error) { 
  if (String(error.message).includes('404')) console.log('[push] remote ' + branch + ' 不存在（全新推送）'); 
  else die('探测远端 ref 失败: ' + error.message); 
} 

// 本地链：target 及其全部祖先（若远端已有共同祖先，只推其后增量 commit；blobs/trees 幂等全传）
const commits = gitText(['rev-list', '--topo-order', target]).split('\n').filter(Boolean).reverse(); 
let startIndex = 0; 
if (remoteHead) { 
  const idx = commits.indexOf(remoteHead); 
  if (idx !== -1) { startIndex = idx + 1; console.log('[push] common ancestor ' + remoteHead + ' @' + idx + ', pushing ' + (commits.length - startIndex) + ' new commits'); } 
  else { console.log('[push] remote head ' + remoteHead + ' 不在本地链上，将完整推送本地链'); } 
} 
const commitsToPush = commits.slice(startIndex); 
console.log('[push] local commits to push: ' + commitsToPush.length + ' (' + commitsToPush[0] + ' ... ' + target + ')'); 

// 远端对象清单（断点续传/增量跳过：Git Data API 对相同内容幂等返回相同 sha）
const remoteObjects = new Set(); 
if (remoteHead && !refOnly) { 
  try { 
    const remoteTree = await api('GET', '/repos/' + REPO + '/git/trees/' + remoteHead + '?recursive=1'); 
    for (const item of (remoteTree.tree || [])) { if (item.type === 'blob' || item.type === 'tree') remoteObjects.add(item.sha); } 
    console.log('[push] remote objects known: ' + remoteObjects.size); 
  } catch (error) { console.warn('[push] 无法读取远端对象清单，将全量上传: ' + error.message); } 
} 

// 2) 上传 blobs（并发 8；跳过远端已存在对象）
const blobShas = gitText(['rev-list', '--objects', target]).split('\n').filter(function(line) { return line; }) 
  .map(function(line) { return line.split(' ')[0]; }); 
const seenBlobs = new Set(); 
const blobList = []; 
for (const sha of blobShas) { 
  const type = gitText(['cat-file', '-t', sha]); 
  if (type !== 'blob' || seenBlobs.has(sha)) continue; 
  seenBlobs.add(sha); 
  blobList.push(sha); 
} 
const blobSkip = blobList.filter(function(sha) { return remoteObjects.has(sha); }); 
const blobUpload = blobList.filter(function(sha) { return !remoteObjects.has(sha); }); 
console.log('[push] blobs total ' + blobList.length + ', skip(existing) ' + blobSkip.length + ', upload ' + blobUpload.length); 
let blobCount = 0; 
const CONCURRENCY = 8; 
let nextBlob = 0; 
async function uploadBlob(sha) { 
  const raw = git(['cat-file', 'blob', sha]); 
  await api('POST', '/repos/' + REPO + '/git/blobs', { content: raw.toString('base64'), encoding: 'base64' }); 
  blobCount += 1; 
  if (blobCount % 20 === 0) console.log('[push] blobs uploaded: ' + blobCount + '/' + blobUpload.length); 
} 
async function blobWorker() { 
  while (nextBlob < blobUpload.length) { const i = nextBlob; nextBlob += 1; await uploadBlob(blobUpload[i]); } 
} 
if (!refOnly) await Promise.all(Array.from({ length: Math.min(CONCURRENCY, blobUpload.length) }, blobWorker)); 
console.log('[push] blobs uploaded: ' + blobCount); 

// 3) 按拓扑序上传 trees（叶子→根：父 tree 引用的子 tree sha 必须已存在）
const treeShas = new Set(); 
for (const commit of commits) { 
  const tree = gitText(['rev-parse', commit + '^{tree}']); 
  const seen = new Set(); 
  const stack = [tree]; 
  while (stack.length) { 
    const t = stack.pop(); 
    if (seen.has(t)) continue; 
    seen.add(t); treeShas.add(t); 
    const entries = gitText(['ls-tree', t]).split('\n').filter(Boolean); 
    for (const line of entries) { const sha = line.split(/\s+/)[2]; const type = line.split(/\s+/)[1]; if (type === 'tree') stack.push(sha); } 
  } 
} 
const treeList = [...treeShas]; 
const depth = new Map(); 
function treeDepth(sha) { 
  if (depth.has(sha)) return depth.get(sha); 
  let d = 0; 
  const entries = gitText(['ls-tree', sha]).split('\n').filter(Boolean); 
  for (const line of entries) { const type = line.split(/\s+/)[1]; const child = line.split(/\s+/)[2]; if (type === 'tree') d = Math.max(d, 1 + treeDepth(child)); } 
  depth.set(sha, d); return d; 
} 
for (const t of treeList) treeDepth(t); 
treeList.sort(function(a, b) { return depth.get(a) - depth.get(b); }); 
let treeCount = 0; let treeSkipped = 0; 
if (!refOnly) { 
  for (const t of treeList) { 
    if (remoteObjects.has(t)) { treeSkipped += 1; continue; } 
    const entries = gitText(['ls-tree', t]).split('\n').filter(Boolean).map(function(line) { 
      const parts = line.split(/\s+/); 
      return { path: line.slice(line.indexOf('\t') + 1), mode: parts[0], type: parts[1], sha: parts[2] }; 
    }); 
    await api('POST', '/repos/' + REPO + '/git/trees', { tree: entries }); 
    treeCount += 1; 
  } 
} 
console.log('[push] trees uploaded: ' + treeCount + ', skip(existing) ' + treeSkipped); 

// 4) 上传 commits（老→新，只传增量）
let commitCount = 0; 
if (!refOnly) { 
  for (const sha of commitsToPush) { 
    const raw = git(['cat-file', 'commit', sha]).toString(); 
    const lines = raw.split('\n'); 
    const tree = lines.find(function(l) { return l.startsWith('tree '); }).slice(5); 
    const parents = lines.filter(function(l) { return l.startsWith('parent '); }).map(function(l) { return l.slice(7); }); 
    const authorLine = lines.find(function(l) { return l.startsWith('author '); }).slice(7); 
    const committerLine = lines.find(function(l) { return l.startsWith('committer '); }).slice(10); 
    const author = parseIdentity(authorLine); 
    const committer = parseIdentity(committerLine); 
    const message = raw.slice(raw.indexOf('\n\n') + 2); 
    const created = await api('POST', '/repos/' + REPO + '/git/commits', { tree, parents, message, author, committer }); 
    if (created.sha !== sha) die('commit sha 不匹配：期望 ' + sha + ' 实际 ' + created.sha + '（对象内容/编码不一致）'); 
    commitCount += 1; 
  } 
} 
console.log('[push] commits uploaded: ' + commitCount); 

// 5) 更新 ref
const finalCommit = commitsToPush[commitsToPush.length - 1]; 
if (remoteHead) { 
  try { 
    await api('PATCH', '/repos/' + REPO + '/git/refs/heads/' + branch, { sha: finalCommit, force: false }); 
  } catch (error) { 
    if (String(error.message).includes('422') && force) { 
      console.warn('[push] 非 fast-forward（远端历史与本地链分叉），--force 已指定，强制更新 ref'); 
      await api('PATCH', '/repos/' + REPO + '/git/refs/heads/' + branch, { sha: finalCommit, force: true }); 
    } else { 
      throw error; 
    } 
  } 
} else { 
  await api('POST', '/repos/' + REPO + '/git/refs', { ref: 'refs/heads/' + branch, sha: finalCommit }); 
} 
console.log('[push] OK: ' + branch + ' -> ' + finalCommit); 

function parseIdentity(line) { 
  const match = line.match(/^(.*) <(.*)> (\d+) ([+-]\d{4})$/); 
  if (!match) die('无法解析身份行: ' + line); 
  return { name: match[1], email: match[2], date: isoWithOffset(Number(match[3]), match[4]) }; 
} 
// 保留原始时区偏移重建 ISO 8601（GitHub commit API 若只给 UTC(Z)，重建对象的 offset 被归一化为 +0000，
// 与本地原始 commit 的 +0800 等偏移不一致 → 对象内容不同 → sha 不匹配）
function isoWithOffset(epochSeconds, offset) { 
  const sign = offset[0] === '-' ? -1 : 1; 
  const hh = parseInt(offset.slice(1, 3), 10); 
  const mm = parseInt(offset.slice(3, 5), 10); 
  const wall = new Date(epochSeconds * 1000 + sign * (hh * 3600 + mm * 60) * 1000); 
  function p(n, w) { return String(n).padStart(w, '0'); } 
  return wall.getUTCFullYear() + '-' + p(wall.getUTCMonth() + 1, 2) + '-' + p(wall.getUTCDate(), 2) 
    + 'T' + p(wall.getUTCHours(), 2) + ':' + p(wall.getUTCMinutes(), 2) + ':' + p(wall.getUTCSeconds(), 2) 
    + (sign === -1 ? '-' : '+') + p(hh, 2) + ':' + p(mm, 2); 
} 
