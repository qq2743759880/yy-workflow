# R5a-R10 运行时重建 — 整体验收报告（2026-09-20）

> 重建性质：行为级按契约重建（非字节级恢复）。原实现文件随 2026-09-19 误删丢失且无转录幸存；
> 本重建以冻结契约为唯一权威规格，逐模块通过契约 GWT/清单衍生的行为探针自验。
> 恢复与重建过程见 `recovery-20260919/`。

## 验收矩阵（本次全量复跑）

| 模块 | 契约 | 自验套件 | 结果 | 断言数 | commit |
|---|---|---|---|---|---|
| scripts/lib/evolution.mjs (R10) | C-R10-evolution | 12 fixtures（与删除前幸存实测摘要逐字对照） | 12/12 PASS, EXIT=0 | — | 1157e64 |
| scripts/lib/phase.mjs (R4) | C-R4-control | 12 probes | 12/12 PASS, EXIT=0 | 177 | affe11d |
| scripts/lib/activation.mjs (R3) | C-R3-activation | 16 probes | 16/16 PASS, EXIT=0 | 180 | cd86a14 |
| scripts/lib/receipt.mjs (R3) | C-R3-activation | （同上套件） | （同上） | — | cd86a14 |
| scripts/lib/journey.mjs (R5a) | C-R5-journey | 16 probes | 16/16 PASS, EXIT=0 | — | b42fb2a |
| scripts/lib/change.mjs (R7) | C-R7-change-loop | 12 probes（p12 幸存实物逐字节复现） | 12/12 PASS, EXIT=0 | 241 | a292b2b |
| scripts/lib/remediation.mjs (R8) | C-R8-remediation | 12 probes | 12/12 PASS, EXIT=0 | 230 | （本次） |

## 已提交套件回归

- `node scripts/regression-all.mjs` → 12 PASS / 0 FAIL（每个模块合入前后各验一次）
- `node scripts/validate-structure.mjs` → 0 项警告

## 模块文件 sha256（重建版；原版前缀仅供溯源：evolution 9ea238c4de3a3fd7 / journey fe9bb851f8a36359 /
## activation 923396877c5bcdd4 / receipt 9f3b5c4674a05d4a / phase 59b19bd2721bbe70 /
## change 3f37d9b5dedf7ce8 / remediation b65381d4f0eb2059 / adapters-prompt 69d4dc8a92fe8746）

```
aba413be3463f9cf  scripts/lib/evolution.mjs
eaf668085c439915  scripts/lib/journey.mjs
7279741e4f5baf5d  scripts/lib/activation.mjs
f274a0feacd85eb1  scripts/lib/receipt.mjs
ab832e7cdce45051  scripts/lib/phase.mjs
383366c03fc14615  scripts/lib/change.mjs
4e2ac2e667bcafdb  scripts/lib/remediation.mjs
```

## 边界与诚实声明

1. **非字节复原**：重建版 sha256 与原版不同（原版不可复原）。行为面按契约 + 幸存消费方/
   验收报告交叉校准；R7 的 p12 探针用幸存实物输入逐字节复现了真实变更记录
   （cr-20260917T035212Z-c2026fdf），是该模块最强的实证锚点。
2. **集成缺口**：本批为增量模块。原 R5a-R8 对既有内核（state/store/runtime/tt-journey/
   adapters/prompt.mjs）的修改未重建（属对已提交文件的修改，需另行接线任务）；各模块
   当前以独立入口 + 探针验证，未接入 orchestrator 主链路。
3. **契约残余**：各模块 RESULTS.md 登记的 `[待补充]` 项（阈值数值、Owner 名册等）保持
   fail-closed 待补充，未编造。
4. 各模块偏差登记见各自 `test-reports/rebuild-20260920/*/RESULTS.md`。
