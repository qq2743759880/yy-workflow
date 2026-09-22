# BFX-B 修复槽 RESULTS（yy 技能 · review-gate.mjs 跨项目/解析加固）

- 日期：2026-09-22（Asia/Shanghai）
- 执行者：autopilot L1 独立执行 agent（BFX-B 槽，全新上下文）
- 白名单遵守：仅改动 `scripts/review-gate.mjs` 与本目录（`test-reports/autopilot-work/BFX-B/`）。未改其他 scripts/、SKILL.md、commands/、webview/、contracts/、reference/、plans/；未读 test-reports/acceptance-*/；无 git 操作；未跑 make-release。
- 状态：**修复完成 + 自测全绿（13/13 回归 + 0 警告），待编排者 L2 复核，不自称 DONE。**

## 0. 修复总览（scripts/review-gate.mjs，行号为修复后实测）

| 项 | 修复点 | 位置（L） |
|---|---|---|
| BFX-1 | 新增 `resolveWorkspacePath(dir, relSegments, override)`：工作区相对路径统一解析，无 dir 回落 ROOT（向后兼容），显式注入最优先 | 300-306 |
| BFX-1① | `registerFromFiles` 默认 tracker 路径 `path.join(ROOT,...)` → 跟随 dir | 527 |
| BFX-1② | `--auto-register` 分支 tracker 读取 `path.join(ROOT,...)` → 跟随 dir | 1060 |
| BFX-1③ | 常规分支（无 --auto-register）tracker 读取 `path.join(ROOT,...)` → 跟随 dir | 1091 |
| P2-1 | `URL_RE` 由 `/https?:\/\/\S+/i` 改为排除 CJK 标点区（U+3000-U+303F）/全角区（U+FF00-U+FFEF）/ASCII 引号尖括号 | 32-35 |
| P2-2 | 新增 `looksLikeCritiqueTable`（≥3 行含 ≥2 个 `\|`）+ `CRIT_TABLE_FORMAT_HINT`；checkReview 在「解析 0 条且疑似表格」时 FAIL detail 附格式要求 | 563-585 |
| 自测 | selfTest() 新增 P2-1/P2-2/BFX-1 断言（L720-765）；selfTestAutoRegister() 新增「默认路径跟随 dir + ROOT tracker 零改动」端到端断言（L899-922） | — |

三处 tracker 路径逐处核对（--auto-register 分支 + 常规分支 + registerFromFiles 默认值）：`grep -n "path.join(ROOT, \.\.\." scripts/review-gate.mjs` 仅剩注释中一处历史说明，代码 0 残留。

## 1. BFX-1（P0 跨项目）：tracker 路径跟随 --dir

### E1a 常规批判 gate：--dir 外部工作区（tracker 在工作区）→ 全 PASS exit 0
（原文见 `e1a-dir-gate.log`）
```
PASS 批判文档存在  3 条
PASS 有效批判≥3（含URL+日期）  有效 3/3
PASS 优化修改方案存在  存在
PASS tracker 已登记  含 taskB1
[OK] taskB1 批判闸门通过
exit=0
```

### E1b --auto-register 分支：登记落工作区 tracker + 工作区任务文档
（原文见 `e1b-dir-auto-register.log`）
```
REGISTER C-02  tracker 路径硬编码技能根目录
REGISTER C-03  URL_RE 误吞中文标点
REGISTER C-04  自由格式表格静默判 0 条
[OK] taskB1 批判闸门通过 + 自动登记 3 条 / 生成任务文档 3 份 / 跳过重复 0 条
exit=0
```
落点核对（`e1e-register-landed.log`）：工作区 tracker 实际新增 3 行（如 `| C-02 | tracker 路径硬编码技能根目录（来源：taskB1-技术批判.md，2026-09-20） | P0 | ... | ⬜ 待落地 |`）；任务文档 `critique-C-02/03/04-task.md` 全部落于 `fixtures/ws-a/docs/history/tasks/`；技能安装目录 `docs/history/tasks/` 新增 0（find 计数 = 0）。

### E1c 反向判别：--dir 工作区无 tracker → FAIL（证明读的是工作区而非 ROOT）
（原文见 `e1c-dir-no-tracker.log`。旧代码此处会读到 ROOT tracker（其标题含 `critique-backlog-tracker` 字样）而误 PASS；修复后读工作区缺失 → 正确 FAIL）
```
PASS 批判文档存在  3 条
PASS 有效批判≥3（含URL+日期）  有效 3/3
PASS 优化修改方案存在  存在
FAIL tracker 已登记  未含 taskB2
[FAIL] taskB2 批判闸门未过（硬闸门：有效批判≥3/竞品对标/tracker）
exit=1
```

### E1d 技能目录零残留：ROOT tracker 哈希前后一致
（原文见 `e1d-root-tracker` 相关 `e1d-root-untouched.log`）
```
before: dea1f24bda8eb163930e494e78607322668b20b972c7b4d078621da06c0ad4eb
after : dea1f24bda8eb163930e494e78607322668b20b972c7b4d078621da06c0ad4eb
ROOT tracker 未被改动：一致
```
（盲行者「把 tracker 复制进技能目录再删」的 workaround 不再需要；本批全程未向技能目录复制/写入任何 tracker 或任务文档。）

## 2. 默认行为回归（无 --dir → 仍读 ROOT）

### E2a 路径解析回落 ROOT 且文件在场
（原文见 `e2a-default-resolve.log`）
```
resolveWorkspacePath(undefined) = D:\.ai-hub\skills\yy\plans\critique-backlog-tracker.md
fs.existsSync = true
```

### E2b 无 --dir CLI 跑批：tracker 项 PASS（读 ROOT tracker），批判文档缺失 FAIL
（原文见 `e2b-default-cli.log`；ROOT 下无 taskNOPE 批判文档属预期，此处验证 tracker 读取仍走 ROOT）
```
FAIL 批判文档存在  缺失
FAIL 有效批判≥3（含URL+日期）  有效 0/0
FAIL 优化修改方案存在  缺失
PASS tracker 已登记  含 taskNOPE     ← tracker 读取自 ROOT plans/，默认行为不变
exit=1
```

## 3. P2-1：中文标点 URL 边界（不再误吞）

（原文见 `e3-url-cjk-punct.log`）
```
样例引用        : https://example.com/prod（注）
旧 \S+ 吞成     : https://example.com/prod（注）  ← 误 404
新边界截断为    : https://example.com/prod
解析 url = "https://example.com/prod" | valid = true
解析 url = "https://example.com/doc" | valid = true     （。后缀）
解析 url = "https://example.com/x" | valid = true       （，注 后缀）
解析 url = "https://github.com/a/b?x=1&y=2#frag" | valid = true
PASS 全部 URL 干净截断，正常 URL（含 query/fragment）不受影响
exit=0
```
self-test 内亦有同等断言（L720-739：括号/句号/顿号后缀 + query/fragment 回归 + 块式 `- 竞品对标：https://docs.b.com/prod（注）。` 用例），`review-gate --self-test` 全绿。

## 4. P2-2：自由格式批判表格解析 0 条 → FAIL 明确提示格式要求

### E4 疑似表格解析 0 条：FAIL detail 含格式提示
（原文见 `e4-format-hint.log`）
```
FAIL 有效批判≥3（含URL+日期）  有效 0/0（检测到疑似表格但解析出 0 条批判——表格需含列：# | 批判点 | 竞品对标 | 差距 | 优化方案 | 最小验证 | 收益/成本 | 级别（表头须含「批判点」「竞品对标」字样且 ≥2 条数据行）；或改用 ## C{n} / 数字列表块式，每条含竞品 URL + 日期）
[FAIL] taskB3 批判闸门未过（硬闸门：有效批判≥3/竞品对标/tracker）
exit=1
```
判定语义未放松：该用例仍 FAIL（exit 1），仅报错可诊断性增强。

### E4b 对照：非表格形态不误提示
（原文见 `e4b-no-false-hint.log`：ws-b 块式批判 3 条有效解析成功，FAIL 仅因 tracker 缺失，无格式提示）
「块式无 URL 批判解析 0 条且无表格形态 → 不误提示」对照在 selfTest 内断言（L753-756，`blockBadR2` detail 不含「表格需含列」）。

## 5. 全量回归（S7 真跑）

### E5 regression-all：13/13 PASS（`e5-regression-all.log` 全文）
```
PASS S7 review-gate  self-test ✓ 填好plan→PASS ✓ 模板未填→拦截 ✓
...
结果: 13 PASS / 0 FAIL
回归基线通过。
regression-exit=0
```
S7 为真跑（regression-all.mjs L169 起以 `node scripts/review-gate.mjs --self-test` 子进程实跑 + plan 双向断言），本次修复后实跑通过。

### E6 validate-structure：0 警告（`e6-validate-structure.log` 全文）
```
[OK] 结构校验通过 (0 项警告, 见 --verbose)
validate-exit=0
```

### E0 self-test 本体（`node scripts/review-gate.mjs --self-test`）
```
PASS review-gate 核心断言 self-test（格式/规划闸门/登记解析/阶段机验核对）
PASS review-gate URL 真验 self-test（真 URL PASS / 假 URL FAIL / 断网 SKIPPED 三态）
```

## 6. D-xxx 偏差记录

- **D-BFXB-1（同族扩展，超出票据字面）**：`registerFromFiles` 的 `tasksDir` 默认值（任务文档 `docs/history/tasks/`）也一并跟随 dir（L528）。票据只点名 tracker 路径，但任务文档原硬编码 ROOT 属同一跨工作区 bug 家族——不修则外部工作区 --auto-register 仍向技能目录写任务文档（E1e 已验证落点为工作区）。无 --dir 时 dir=ROOT，默认行为逐字节不变（E2a/E2b + regression 全绿）。
- **D-BFXB-2（边界集比票据列举略宽）**：P2-1 排除集取整个 CJK 标点区（U+3000-U+303F）与全角区（U+FF00-U+FFEF）外加 ASCII `"'<>`，宽于票据列举的「）】」」。；，、」。理由：中文写作中全角字符出现在 URL 尾部必为引用正文而非 URL 本身（合法 URL 字符集不含任何全角字符）；已用 query/fragment 正常用例回归证明无误杀（E3 第 4 行）。
- **D-BFXB-3（证据片段退出码口径）**：import `review-gate.mjs` 会触发其顶层 `process.exitCode = 1`（既有 CLI 预设，非本次引入），故 E3 的 node --input-type=module 片段末尾显式归零后再读取退出码，日志已注明。CLI 级证据（E1/E2/E4）不受影响。
- **D-BFXB-4（P2-2 未做列序容错）**：票据允许「如能安全支持列序容错也可做」。本次未放宽 `parseTableEntries` 的 9 列判定与列序假设（cells[2]/cells[3]/cells[5]/cells[6]/cells[8]），仅做 0 条时的格式诊断提示——保守处理以保证判定阈值语义零变化。
- **D-BFXB-5（fixtures 驻留）**：跨工作区 fixtures（ws-a/ws-b/ws-c）按白名单驻留于本目录 `fixtures/` 下作为 L2 复核可重放样本；重放命令：`node scripts/review-gate.mjs --dir test-reports/autopilot-work/BFX-B/fixtures/ws-a`（ws-a 已含 E1b 登记产物，重跑 --auto-register 应幂等 SKIP 3 条）。

## 7. 产物清单（本目录）

```
BFX-B/
├── RESULTS.md                       本文件
├── root-tracker.sha256.before       ROOT tracker 修复前哈希基线
├── e1a-dir-gate.log                 BFX-1 常规分支 --dir 实测
├── e1b-dir-auto-register.log        BFX-1 --auto-register 分支 --dir 实测
├── e1c-dir-no-tracker.log           BFX-1 反向判别（工作区无 tracker → FAIL）
├── e1d-root-untouched.log           ROOT tracker 哈希前后一致（零残留）
├── e1e-register-landed.log          登记落点核对（工作区 tracker 行 + 工作区任务文档）
├── e2a-default-resolve.log          默认行为：无 dir 回落 ROOT
├── e2b-default-cli.log              默认行为：无 --dir CLI tracker 项 PASS
├── e3-url-cjk-punct.log             P2-1 新旧正则对比 + 解析器实测
├── e4-format-hint.log               P2-2 格式诊断提示实测
├── e4b-no-false-hint.log            P2-2 对照（不误提示）
├── e5-regression-all.log            regression 13/13 全文
├── e5-regression-exit.log           regression exit 0
├── e6-validate-structure.log        validate 0 警告全文
└── fixtures/
    ├── ws-a/（含 plans/tracker 种子 + taskB1 批判/方案 + E1b 登记产物 C-02~C-04）
    ├── ws-b/（无 tracker 反向判别样本）
    └── ws-c/（自由格式表格样本）
```
