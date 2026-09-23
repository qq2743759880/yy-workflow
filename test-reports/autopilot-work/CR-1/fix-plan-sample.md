# taskT1 / taskT2 优化修改方案（CR-1 自测夹具）

| # | 对应批判 | 修改内容 | 量化指标 | 测试方案 | 风险应对 |
|---|---|---|---|---|---|
| 1 | 全部 | review-gate 加 --critique-sources/--rubric/--convert-critique | INVALID 检出率 100% | review-gate --self-test | 回滚单文件 |
