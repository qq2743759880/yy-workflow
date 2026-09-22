# taskB1 技术批判（BFX-B 跨工作区样本）

| # | 批判点 | 竞品对标(URL+日期+结论) | 差距 | 优化方案 | 最小验证 | 收益/成本 | 级别 |
|---|---|---|---|---|---|---|---|
| 1 | tracker 路径硬编码技能根目录 | https://github.com/example/bfx1（注） 2026-09-20 结论A | 外部工作区必 FAIL | 路径解析跟随 --dir | self-test + CLI 实测 | 1/2 | P0 |
| 2 | URL_RE 误吞中文标点 | https://github.com/example/bfx2。 2026-09-20 结论B | 误 404 | URL 边界加固 | self-test | 1/2 | P2 |
| 3 | 自由格式表格静默判 0 条 | https://github.com/example/bfx3 2026-09-20 结论C | 不可诊断 | FAIL 提示格式要求 | self-test | 1/2 | P2 |
