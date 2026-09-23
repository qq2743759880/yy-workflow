# taskT1 技术批判（CR-1 自测样本：含 source，应通过三元绑定）

## C1 缺陷一
- 问题：批判来源绑定缺机验，自己定标准自己批判无人拦
- 级别：P1
- source: knowledge-base:docs/kb/critique-binding.md
- 竞品对标：https://github.com/sample/kb1 2026-09-20 结论A
- 优化方案：在 scripts/review-gate.mjs 加 --critique-sources 全局绑定
- 最小验证：node scripts/review-gate.mjs --self-test

## C2 缺陷二
- 问题：无外部源批判静默混入有效统计
- 级别：P2
- source: none（本批判无外部源，仅基于项目内部资料）
- 竞品对标：https://github.com/sample/kb2 2026-09-20 结论B
- 优化方案：source=none 逐条强制标注
- 最小验证：node scripts/review-gate.mjs --self-test

## C3 缺陷三
- 问题：转化单无施工步机验
- 级别：P1
- source: standard-doc
- evidence: templates/task-v2.md 七字段口径 2026-09-23
- 竞品对标：https://github.com/sample/kb3 2026-09-23 结论C
- 优化方案：--convert-critique 内置七字段断言
- 最小验证：node scripts/review-gate.mjs --self-test
