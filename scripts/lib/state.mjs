/** TT state model. */
export const STATE = { IDLE: 'idle', PLANNING: 'planning', EXECUTING: 'executing', FROZEN: 'frozen', REVIEWING: 'reviewing', DONE: 'done', FAILED: 'failed' };
export const TRANSITIONS = { idle: ['planning', 'failed'], planning: ['executing', 'failed'], executing: ['frozen', 'reviewing', 'failed'], frozen: ['executing', 'reviewing', 'failed'], reviewing: ['done', 'executing', 'failed'], done: [], failed: [] };
export class IllegalTransitionError extends Error {
  constructor(from, to) { super('非法状态转换: ' + from + ' → ' + to); this.name = 'IllegalTransitionError'; }
}
export function canTransition(from, to) { return Boolean(TRANSITIONS[from] && TRANSITIONS[from].includes(to)); }
export function assertTransition(from, to) { if (!canTransition(from, to)) throw new IllegalTransitionError(from, to); return true; }
