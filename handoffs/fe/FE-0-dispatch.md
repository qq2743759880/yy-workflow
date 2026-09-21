# FE-0 派单 — 构建期内容提取器 build-guide-content.mjs

你是本任务的独立执行 agent（autopilot 管线 L1，全新上下文）。工作区：`D:\.ai-hub\skills\yy`。
完成后由独立复核者（L2）重执行全部证据——**你不自称 DONE，只交付证据**。

## 必读
1. `plans/frontend-plan-20260921.md`（三件套定位与 FE-0 规格）
2. `commands/yy-*.md` 六个阶段命令文件（B 手册的注入内容源）
3. `vendor/*/SKILL.md` 16 资产 frontmatter（C 手册的功能描述源）
4. `scripts/matrix.mjs` 的 CLUSTERS（资产域簇归属）

## 交付物（白名单，仅 2 文件）
1. `scripts/build-guide-content.mjs` — 构建期提取器：
   - `node scripts/build-guide-content.mjs [--out webview/journey/content.js]`
   - 提取 6 阶段数据：阶段号/名/目标一句话（commands/yy-*.md 的"目标"行）、
     注入内容摘要（frontmatter description + 首段）、配套资产名（命令文件内点名的资产）、
     催办话术（按阶段纪律从命令文件的"纪律钥匙词"生成模板句）、重走等效 Prompt
     （"重新走阶段 N：/yy N + 该阶段前提"模板）
   - 提取 16 资产卡片：name / description（frontmatter description 首行，过长截 80 字）/
     cluster（matrix CLUSTERS 反查）/ 阶段关联（命令文件点名关系）
   - 输出 `webview/journey/content.js`：`export const GUIDE_CONTENT = {...}` ESM；
     JSON.stringify 可序列化、UTF-8、中文保留原样
   - **fail-closed**：任一源文件缺失/解析失败即报错退出，不静默缺页；输出前完整性自检
     （6 阶段全在 + 16 资产全在 + 每卡片三字段非空）
2. `webview/journey/content.js`（运行一次生成）
3. 自测 `test-reports/autopilot-work/FE-0/`：探针（重跑幂等字节一致/完整性自检触发/
   畸形源文件 fail-closed）+ RESULTS.md（输出原样 + D-xxx 偏差登记——**无 discrepancy
   登记 = 复核直接 FAIL**）

## 禁止
改 webview/ 其他文件、render-core/host-bridge（冻结锚）、contracts/、plans/、队列/看板；
读 test-reports/acceptance-*/；git 操作；读会话历史/本文件之外的任务上下文。

## 硬性要求
零 npm；ESM；中文注释；Fail-closed；风格无关（本任务纯数据层）。

