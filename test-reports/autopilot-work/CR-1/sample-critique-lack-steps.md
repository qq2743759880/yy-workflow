# taskCK 技术批判（CR-1 自测样本：条目1 缺「优化方案」→ 转化须拒绝落盘）

## C1 只写目标结果不给施工步
- 问题：某接口性能差应优化
- 级别：P1
- source: knowledge-base:docs/kb/perf.md
- 竞品对标：https://github.com/sample/ck1 2026-09-20 结论A

## C2 合规条目
- 问题：边界输入无校验
- 级别：P2
- source: standard-doc
- 竞品对标：https://github.com/sample/ck2 2026-09-20 结论B
- 优化方案：改 modules/b.ts 加边界检查
- 最小验证：node scripts/review-gate.mjs --self-test
