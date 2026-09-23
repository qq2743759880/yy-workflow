# taskT2 技术批判（CR-1 自测样本：条目2 缺 source，应判 INVALID 且 detail 指名）

## C1 有源批判
- 问题：某模块缺少校验
- 级别：P1
- source: search-tool
- 竞品对标：https://github.com/sample/ms1 2026-09-20 结论A
- 优化方案：加输入校验
- 最小验证：node scripts/review-gate.mjs --self-test

## C2 缺源批判（本条故意不带 source 标签）
- 问题：某功能超时无兜底
- 级别：P0
- 竞品对标：https://github.com/sample/ms2 2026-09-20 结论B
- 优化方案：加超时兜底
- 最小验证：node scripts/review-gate.mjs --self-test

## C3 再一条有源批判
- 问题：日志无脱敏
- 级别：P1
- source: standard-doc
- 竞品对标：https://github.com/sample/ms3 2026-09-20 结论C
- 优化方案：日志字段脱敏
- 最小验证：node scripts/review-gate.mjs --self-test
