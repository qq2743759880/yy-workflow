/**
 * _helper.mjs — R5a journey.mjs 探针共用工具（T8 测试资产加固批①）。
 *
 * 背景（T7 D-4 / 编排者 P2-3）：p16 间歇失败 ≈40%。根因链已机验：
 *   夹具**紧邻写入** state.json 与 artifacts/<id>/receipt.json 两个 authoritative 源，
 *   只要两次 fs.writeFileSync 落在不同的文件时间戳刻度上（样本 20 次中 8 次），
 *   journey.mjs 的 computeStale()（OQ-R5-2=A 相对判据，取「最新 vs 最老」比较）即判 STALE；
 *   而 §4.3「仅当展示态 ∈ {AUTHORIZED, OBSERVED} 才落盘 journey.json」⇒ STALE 运行必然
 *   persistedTo=null —— 一个根因，两处断言同时失败。
 *
 * 加固（与 R3 probes/_helper.mjs 同源模式）：
 *   - **固定时钟** FIXED_NOW_MS：一切夹具文件写入后统一 utimes 到该时刻，
 *     使 state/receipts/journey 三类权威源的 mtime 完全相等 ⇒ computeStale 的
 *     "最新 vs 最老" 必然相等 ⇒ STALE 不可能由夹具写入时序诱发。
 *   - 需要**故意错时**的探针（p04-stale-relative）显式用 setMtime() 覆盖，
 *     保持其「相对 STALE」语义不被加固抹平。
 *
 * 只读保证：本 helper 只写 run-probes.mjs 分配的沙箱目录，不触碰仓库任何既有文件。
 */
import fs from 'node:fs';
import path from 'node:path';

/** 固定文件时间戳（mtime/atime），与 R3 的 FIXED_NOW 同一常量语义。 */
export const FIXED_NOW_MS = Date.parse('2026-09-20T00:00:00.000Z');

export function fixedNow() { return new Date(FIXED_NOW_MS); }

/** 把已存在文件的 mtime/atime 固定为 ms（默认 FIXED_NOW_MS）。 */
export function setMtime(file, ms = FIXED_NOW_MS) {
  const d = new Date(ms);
  fs.utimesSync(file, d, d);
  return file;
}

/** 写文本并把 mtime 固定（消除紧邻写跨刻度）。 */
export function writeFixed(file, content, ms = FIXED_NOW_MS) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, content, 'utf8');
  return setMtime(file, ms);
}

/** 写 JSON 并把 mtime 固定（消除紧邻写跨刻度）。 */
export function writeJsonFixed(file, obj, ms = FIXED_NOW_MS) {
  return writeFixed(file, JSON.stringify(obj), ms);
}
