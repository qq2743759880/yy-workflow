# M2-R2 技术批判报告（第二轮 · 2026-09-08）

> 触发：owner 实测反馈（token 失控 6-8k/交互 + 阶段纪律纯 prompt 级）+ 第一轮 C-25~C-29 遗留验证。
> 仓库：yy @ HEAD b74d40d（master）。
> 自验：`node scripts/review-gate.mjs --dir plans/tasks --id M2-R2 --verify-urls` → PASS（2026-09-08 执行，结果见文末）。

## 一、遗留验证结论（实测，非采信）

**C-25~C-29 修复落地 0/5**（2026-09-08 实测复测）：

| 条目 | 声称修复 | 实测证据 | 结论 |
|---|---|---|---|
| C-27 (P0) | domainDeclared 字段 + DOMAIN_DECL_MISSING warning | 全仓 `domainDeclared\|DOMAIN_DECL` 零命中；asset-call-rate.mjs 无域声明逻辑 | ❌ 未实施 |
| C-25 (P1) | owner-review-linkcheck.mjs + regression S9 | scripts/owner-review-linkcheck.mjs 不存在；regression-all.mjs 无 S9 段 | ❌ 未实施 |
| C-26 (P1) | renderKickoffClusters + kickoff-drift-check.mjs | matrix.mjs 无 renderKickoffClusters；kickoff-drift-check.mjs 不存在（30 清单暂未漂移，但防线为零） | ❌ 未实施 |
| C-28 (P2) | 自测三问 + 试读留痕 + readability-baseline.mjs | readability-baseline.mjs、docs/history/owner-review-trial.md 均不存在 | ❌ 未实施 |
| C-29 (P2) | L1 元数据块 ≤120 tok + validate 断言 | 无 L1 元数据块；0a 仍是 ~1.5k token 手动表 | ❌ 未实施 |

另实测确认：M1 批判 C-21（token-audit.mjs 量尺）同样 0 落地 → 本轮升级为 C-35。

## 二、本轮新批判（C-30~C-35）

1. **C-30（P0）渐进披露是假的**：SKILL.md 339 行 / 21,140 字符（CJK 7,974），CJK 加权 ≈9.3k token（用户实测口径 ≈10k）——不是草稿期以为的 6.6-7k，是连规范推荐上限（<5000 tok）都超 86%。省 500 token 摘要、吞 9.3k 本体，18 倍回吐。修法：瘦身 ≤60 行 + 8 个 references/ 拆分清单（优化方案 §1）。
2. **C-31（P1）阶段纪律是祈使句，校验器在给祈使句作伪证**：validate-structure.mjs:158-166 机验「commands 含 --prereq-check 字符串」——校验恳求写在纸上，不校验恳求被执行。机器闸门仅 --update 写路径 exit 3；六模板 grep「阶段机验」零命中，跑没跑无痕。修法：6 模板加字段 + validate/review-gate 双机验（优化方案 §2）。
3. **C-32（P1）批判反哺对自己失灵**：第一轮 5 条修复 0/5 落地。修法：B0~B6 修复批次排期（优化方案 §3）。
4. **C-33（P1）现行犯**：commands/yy-1/2/3/5 四文件 :20 行指针损坏（`\t emplates/` 应为 `templates/`）——agent 照指针 Read 失败 → F3 白话化审阅静默缺失；全部校验放行。修法：B0-① 止血 + B2 linkcheck。
5. **C-34（P1）validate-structure 是假闸门**：188 行源码通读，四项核心断言（行数体积/指针存在性/模板字段/引用有效性）全缺，四份损坏引用全绿放行——校验器是被批判对象的同谋。修法：随 B4 落四断言。
6. **C-35（P2）验收指标无机验量尺**：token-audit.mjs 不存在（C-21 修复 0 落地），token 验收只能手测。修法：B0-② 落地量尺。

## 三、竞品实证（全部 2026-09-08 真实抓取，结论回填）

- **agentskills.io/specification**：三级渐进披露（Metadata ~100 tok / body <5000 tok 推荐 / resources 按需）+「Keep your main SKILL.md under 500 lines. Move detailed reference material to separate files.」+ references/ focused 按需加载 + 引用一层深 + skills-ref validate 官方校验器。**注意：规范无硬性大小上限，均为推荐值——YY 是连推荐值都超**。
- **anthropic.com/engineering（2025-10-16 发布）**：「When the SKILL.md file becomes unwieldy, split its content into separate files」「If certain contexts are mutually exclusive or rarely used together, keeping the paths separate will reduce the token usage」原文在场——阶段化 skill 正是互斥上下文教科书案例。
- **github.com/anthropics/skills**：175.0k★ / 20.7k fork / 54 commits；官方 pdf skill SKILL.md 精瘦 + forms.md/reference.md 按场景拆分示范。
- **npm skills（vercel-labs/skills@1.5.24）**：registry API 实测月下载 39,676,919、上周 8,478,818——现成渐进披露 loader 生态在爆发式增长，YY「不引 npm」约束下应对标其加载策略而非无视。
- **npm openskills（numman-ali/openskills@1.5.0）**：月下载 45,233，keywords 原文含 progressive-disclosure——业界 loader 在装载期解析引用，坏路径装载期即暴露。
- **docs.litellm.ai/docs/proxy/virtual_keys**：per-key/team/user max_budget + spend tracking，超限网关层强制——约束做进协议层不靠自觉（对照 C-31/C-35）。

## 四、毒舌结论

M2 的白话文案是合格的散文，但机制层四连击外加两枚哑弹：**渐进披露是假的**（超规范推荐上限 86%，互斥上下文不拆分）；**阶段纪律是祈使句**（注入零闸门、产物零痕迹、校验器只证明「祈使句在场」）；**批判反哺对自己失灵**（0/5 落地，连 M1 的量尺修复都停尸）；**校验器是假闸门**（四断言全缺，给断链超标开绿灯）。一句话：YY 的立身之本是「机验代替纪律」，M2-R2 实测证明从 SKILL.md 到校验器到修复链已全线退回到纪律——**写了纪律、没写机器，连量尺都没写**。修复批次 B0~B6 已排期，P0 的 C-30 不得晚于下一个交付里程碑。

## 五、产出物

- plans/tasks/M2-R2-技术批判.md（6 条 C-30~C-35，每条含 URL+日期+当日结论，表格格式机验可解析）
- plans/tasks/M2-R2-优化修改方案.md（B0 止血量尺 + C-30 拆分清单 + C-31 模板机验 + B0~B6 批次）
- plans/critique-backlog-tracker.md（M2-R2 段重写为 6 条）
- 机器验收：review-gate --dir plans/tasks --id M2-R2 --verify-urls → PASS（2026-09-08）