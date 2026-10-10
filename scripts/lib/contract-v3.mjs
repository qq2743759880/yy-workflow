/**
 * contract-v3.mjs — yy/asset-contract@3 读取层（B-P0-03-REWORK1）。
 *
 * 严格 YAML 子集解析（与 manifest-build.mjs 同纪律：自带解析，零外部依赖，fail-closed）：
 *   - 缩进只允许 2 空格整数倍，禁止 TAB
 *   - key: value 单行标量；key: 空值 + 同缩进 "- item" 列表；或空值 + 更深缩进嵌套 map
 *   - 列表项 "- " 后可接内联 "key: value"（项为 map，续行缩进 = 项缩进 + 2）
 *   - 标量只支持 true/false/整数/字符串；禁止块标量（| >）、flow（[ ] { }）、行内 # 注释
 *   - 未知构造一律抛错（拒绝半懂），重复 key 抛错
 *
 * 消费方：scripts/generate-projections.mjs、scripts/contract-drift-check.mjs。
 * 生命周期纪律：DRAFT/UNPOPULATED/NON_CANONICAL 契约不得作为生产 V3 投影语义来源。
 */
import fs from 'node:fs/promises';
import path from 'node:path';

const KEY_RE = /^[A-Za-z0-9_@.\-]+$/;

function parseError(label, line, message) {
  return new Error(`contract-v3 parse error: ${label}#${line}: ${message}`);
}

function scalar(rawVal, label, line) {
  if (rawVal === '[]') return [];
  if (rawVal === '{}') return {};
  if (/^['"]/.test(rawVal)) {
    if (rawVal.length < 2 || rawVal[0] !== rawVal[rawVal.length - 1]) {
      throw parseError(label, line, '引号标量必须成对闭合且单行');
    }
    return rawVal.slice(1, -1);
  }
  if (/^[|>\[{]/.test(rawVal)) throw parseError(label, line, `子集不支持的构造: ${rawVal.slice(0, 20)}`);
  if (rawVal.includes(' #')) throw parseError(label, line, '行内 # 注释不受支持（注释必须整行）');
  if (rawVal === 'true') return true;
  if (rawVal === 'false') return false;
  if (/^\d+$/.test(rawVal)) return parseInt(rawVal, 10);
  return rawVal;
}

/** 解析受约束 YAML 子集 → 纯 map/list 树。 */
export function parseYamlSubset(text, label) {
  const lines = text.replace(/\r\n/g, '\n').split('\n');
  const items = [];
  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i];
    if (raw.includes('\t')) throw parseError(label, i + 1, 'TAB 字符（缩进只允许空格）');
    const trimmed = raw.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const indent = raw.length - raw.trimStart().length;
    if (indent % 2 !== 0) throw parseError(label, i + 1, '缩进非 2 空格整数倍');
    items.push({ line: i + 1, indent, text: trimmed });
  }
  let pos = 0;
  const peek = () => (pos < items.length ? items[pos] : null);

  function parseMap(indent) {
    const map = {};
    while (peek() && peek().indent === indent) {
      const it = items[pos];
      if (it.text.startsWith('- ')) throw parseError(label, it.line, 'map 上下文出现列表项');
      const ci = it.text.indexOf(':');
      if (ci === -1) throw parseError(label, it.line, `行缺少 "key:" 结构: ${it.text.slice(0, 40)}`);
      const key = it.text.slice(0, ci).trim();
      if (!KEY_RE.test(key)) throw parseError(label, it.line, `非法 key: ${key}`);
      if (Object.prototype.hasOwnProperty.call(map, key)) throw parseError(label, it.line, `重复 key: ${key}`);
      pos += 1;
      let rawVal = it.text.slice(ci + 1).trim();
      if (rawVal !== '') {
        // 折叠标量：key: value 后更深缩进的续行折叠为单行（YAML folding 子集）
        while (peek() && peek().indent > indent) {
          rawVal += ' ' + items[pos].text;
          pos += 1;
        }
        map[key] = scalar(rawVal, label, it.line);
        continue;
      }
      const nx = peek();
      if (nx && nx.indent === indent && nx.text.startsWith('- ')) map[key] = parseList(indent);
      else if (nx && nx.indent > indent) map[key] = parseNode(nx.indent);
      else map[key] = null;
    }
    if (peek() && peek().indent > indent) throw parseError(label, peek().line, '意外更深层缩进');
    return map;
  }

  function parseList(indent) {
    const arr = [];
    while (peek() && peek().indent === indent && peek().text.startsWith('- ')) {
      const it = items[pos];
      const content = it.text.slice(2).trim();
      // 项为 map 当且仅当内容以 "合法key:"（冒号后空格或行尾）开头；否则为标量
      const m = content.match(/^([A-Za-z0-9_@.\-]+):(?:\s|$)/);
      if (!m) {
        pos += 1;
        arr.push(scalar(content, label, it.line));
        continue;
      }
      // 项为 map：把 dash 行改写成 indent+2 的虚拟行插回，统一交给 parseMap 消费（含续行字段）
      items.splice(pos, 1, { line: it.line, indent: indent + 2, text: content });
      arr.push(parseMap(indent + 2));
    }
    return arr;
  }

  function parseNode(indent) {
    const it = peek();
    if (!it) throw parseError(label, 0, '意外 EOF');
    return it.text.startsWith('- ') ? parseList(indent) : parseMap(indent);
  }

  const result = parseNode(0);
  if (peek()) throw parseError(label, peek().line, '存在未能归属的残余行');
  return result;
}

/** 读取单个 V3 契约（返回 { file, id, doc }）；结构性错误直接抛出（fail-closed）。 */
export async function loadContractV3(file) {
  const label = path.basename(file);
  const text = await fs.readFile(file, 'utf8');
  const doc = parseYamlSubset(text, label);
  if (!doc || typeof doc !== 'object' || Array.isArray(doc)) throw new Error(`${label}: 顶层必须是 map`);
  if (doc.schema !== 'yy/asset-contract@3') throw new Error(`${label}: schema 必须为 yy/asset-contract@3，实际 ${JSON.stringify(doc.schema)}`);
  if (typeof doc.id !== 'string' || !doc.id) throw new Error(`${label}: 缺 id`);
  return { file, label, id: doc.id, doc };
}

/** 读取目录下全部 *.contract-v3.yaml（按文件名排序，确定性）。 */
export async function loadAllContractsV3(dir) {
  const names = (await fs.readdir(dir)).filter((f) => f.endsWith('.contract-v3.yaml')).sort();
  const out = [];
  for (const name of names) out.push(await loadContractV3(path.join(dir, name)));
  return out;
}

/** 生命周期判定：只有 ACCEPTED+CANONICAL 才有资格作为生产 V3 投影语义来源。 */
export function isV3Authoritative(doc) {
  return doc.lifecycle
    && doc.lifecycle.status === 'ACCEPTED'
    && doc.lifecycle.authority === 'CANONICAL';
}

/** POPULATED_PENDING_ACCEPTANCE（填充批次）：参与漂移语义检查，但不具备生产投影资格。 */
export function isPopulatedPending(doc) {
  return doc.lifecycle && doc.lifecycle.status === 'POPULATED_PENDING_ACCEPTANCE';
}
