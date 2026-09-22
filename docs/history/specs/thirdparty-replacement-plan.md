# Third-party 竞品实际部署 + 资产替换方案

> 目标：把 TT 资产从 `.md 空壳 + Execution kernel 声明` 升级为**实际调用已部署竞品能力**。原则：别重复造轮子——有真实竞品的资产，直接调用竞品；不可部署的诚实标注。
> 部署位置：CLI 全局（npm/pip/go）/ 库 `~/.ai-hub/thirdparty/node_modules`。

## 一、部署现状（2026-08-31 实测）

| 竞品 | 部署方式 | 状态 | 版本 | 落点 |
|---|---|---|---|---|
| opencode | `npm i -g opencode-ai` | ✅ 已装 | 1.18.25 | PATH 全局 |
| portman | `npm i -g @apideck/portman` | ✅ 已装 | 1.35.0 | PATH 全局 |
| semgrep | `pip install semgrep` | ✅ 已装 | 1.175.0 | Python env |
| gitleaks | `go install github.com/zricethezav/gitleaks/v8` | ✅ 已装 | build-set | `%GOPATH%\bin` |
| tsyringe / inversify | npm 库 | ✅ 已装 | 4.10/8.2 | `~/.ai-hub/thirdparty` |
| cockatiel / polly-js | npm 库 | ✅ 已装 | 4.0/1.8 | `~/.ai-hub/thirdparty` |
| culori / chroma-js / poline | npm 库 | ✅ 已装 | 4.0/3.2/0.13 | `~/.ai-hub/thirdparty` |
| cline | `npm i -g @cline/cli` | ⚠️ 不可用 | 0.0.13 | bin 为 `clite`，官方 CLI 未成熟（cline 是 VS Code 扩展） |
| gpt-researcher | `pip install` | ❌ 失败 | — | pip 依赖冲突（ResolutionImpossible）→ 需独立 venv |
| metagpt | `pip install` | ❌ 失败 | — | 同上 |
| crewai | `pip install` | ❌ 未尝试 | — | 同上 |
| shadcn-ui/ui | `npx shadcn@latest init`（项目内） | ⚠️ 项目内用 | 4.19 | 非全局部署 |
| bolt.new | 闭源 web 服务 | ❌ 不可部署 | — | 仅 web 参考 |
| SkillSpector | 未开源发布 | ❌ 不可部署 | — | NVIDIA 论文/未发布 |
| OmniParser v2 / UI-TARS | 需 GPU 模型 | ❌ 不可本机 | — | VLM 模型推理 |
| system-design-template | 方法论文档 | ⚠️ 文档模板 | — | git clone 参考 |
| qodo-ai/pr-agent | 需 Docker | ⚠️ Docker 可选 | — | pip 无此包 |
| continuedev/continue | VS Code 扩展 | ⚠️ 扩展 | — | IDE 层 |

## 二、替换策略（三级）

- **A 级 · 立即替换**（竞品已部署，资产改为实际调用）：implementation→opencode、security→semgrep+gitleaks、be-validator→portman、colorize→culori/chroma/poline、be-provider→tsyringe/inversify、be-resilience→cockatiel/polly
- **B 级 · 待环境**（pip 冲突/CLI 未成熟）：agent-research→gpt-researcher、planning→MetaGPT、sdlc→cline（待官方 CLI）
- **C 级 · 不可本机**（闭源/需 GPU/扩展/文档）：bolt、SkillSpector、OmniParser/UI-TARS、pr-agent、continue、system-design-template、shadcn（项目内）

## 三、替换动作清单

| 资产 | 动作 | 落点 | 验证 |
|---|---|---|---|
| **implementation** | opencode 作实际执行内核（orchestrator 已有 adapter） | `scripts/lib/adapters/opencode.mjs` | `opencode --version` + orchestrator `--exec opencode` |
| **security** | 新增 `scripts/security-scan.mjs`（调 semgrep + gitleaks 实际扫描） | 新增脚本 + security/SKILL.md 引用 | `node scripts/security-scan.mjs <dir>` 输出发现 |
| **be-validator** | portman 实际契约校验（adapter 已探测通过） | `portman.mjs` + 真实契约文件 | `portman --version` + 契约校验 |
| **colorize** | 新增 `scripts/color-palette.mjs`（culori/poline 实际生成和谐色 + WCAG 对比） | 新增脚本 + colorize/SKILL.md 引用 | `node scripts/color-palette.mjs <base>` 输出色板 |
| **be-provider** | tsyringe/inversify DI 实际代码示例（库引用） | reference + SKILL 引用 | import 可用 |
| **be-resilience** | cockatiel/polly 韧性原语实际代码 | reference + SKILL 引用 | import 可用 |

## 四、执行优先级

1. **A-安全**：security-scan.mjs（semgrep+gitleaks 真实扫描）——安全是最硬价值
2. **A-配色**：color-palette.mjs（culori/poline 真实计算）——证明计算内核非空壳
3. **A-实现/契约**：验证 opencode/portman adapter 真跑
4. B 级：独立 venv 装 gpt-researcher/metagpt（待环境）
5. C 级：记录不可部署，资产保留方法论 + 诚实标注
