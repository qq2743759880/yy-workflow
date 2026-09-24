# AS-0 五源许可证核查 + superpowers 选品清单

调研 agent：AS-0（L1 独立只读调研，全新上下文）。日期：2026-09-24。
网络通道：api.github.com / registry.npmjs.org / raw.githubusercontent.com / npm pack（WebSearch 全环境不可用，未使用）。
白名单遵守：零仓库源文件改动、零 git 写操作；superpowers clone 仅入系统临时目录。

状态：调研进行中（边跑边写）。

---

## 1. claude-task-master（npm task-master-ai@0.43.1）——【有条件】可引入

### 实测证据
- npm 拆包：`npm pack task-master-ai` → `task-master-ai-0.43.1.tgz`（2026-09-24，包内仅一个 LICENSE 文件 `package/LICENSE`）。
- GitHub 仓库 `eyaltoledano/claude-task-master`（default branch `main`）根 `LICENSE` 与 npm 包 LICENSE 内容一致；GitHub API license 字段 `spdx_id: NOASSERTION`（与 R3 实测一致，原因是 LICENSE 非标准 SPDX 单许可文本）。
- LICENSE 原文关键段（【实测】逐字摘录）：
  1. 正文开头为标准 **MIT License**（Copyright (c) 2025 — Eyal Toledano, Ralph Khreish），授予 use/copy/modify/merge/publish/distribute/sublicense/sell……
  2. 随后附 **"Commons Clause" License Condition v1.0**：`the grant of rights under the License will not include, and the License does not grant to you, the right to Sell the Software.`
  3. **适用范围原文（决定性条款）**：`Software: All Task Master associated files (including all files in the GitHub repository "claude-task-master" and in the npm package "task-master-ai").`
  4. `License: MIT`；`Licensor: Eyal Toledano, Ralph Khreish`

### 结论：templates/schema 目录是否受 Commons-Clause 约束？
**受约束。【实测】** LICENSE 的 Software 定义显式覆盖"GitHub 仓库与 npm 包内**所有文件**"，不存在对 templates/ 或 schema 目录的豁免。即 templates 与 task schema 均为 **MIT + Commons Clause**，而非纯 MIT。

### 引入方式是否合法？
- Commons Clause **只剥夺一项权利：Sell**（"对第三方收费/有偿提供，作为价值主要源自该软件的产品或服务的一部分"，含 hosting/consulting）；copy/modify/merge/distribute 等 MIT 权利全部保留。
- 本项目 vendor 其 templates/ + task schema（`src/schemas/`、`packages/tm-core/src/common/schemas/`、`src/prompts/schemas/` 均在仓库内）→ 属 MIT 允许的 copy/modify，**合法**。
- 附加义务：任何 license notice / attribution 必须一并带上 Commons Clause notice（LICENSE 原文：`Any license notice or attribution required by the License must also include this Commons Clause License Condition notice.`）。

### 风险
- 【推断】若未来 yy 项目本身被**有偿**销售/托管服务化，则 vendor 物触发 Sell 禁令；需届时移除或换源。
- 【推断】分发 vendor 物时须原样携带 LICENSE（含 Commons Clause），否则丢署名义务。

### 结论：**有条件可引入**（【实测】LICENSE 原文依据；条件=不 Sell + 携带完整许可声明；vendor 范围照旧仅 templates/ + schema 目录，不入运行时依赖）。
