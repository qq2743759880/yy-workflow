# TT Skill 上手指南（ONBOARDING）

> TT（Together Agent）= 多 Agent 平台编排闭环方法论。15 分钟上手。
> 开源发布方案（定位/场景/差异/边界/贡献指南）见 `docs/OPENSOURCE-PLAN.md`；本文件只讲怎么跑起来。

## 前置条件

- Node.js ≥ 18（脚本零依赖，无需 npm install）
- 至少一个 AI 平台可用（opencode / claude / codex / cursor / trae / traework / openclaw 任一）

## 三步上手

### 第 1 步：配置资产中心

```bash
# 设置 AIHUB_ROOT（默认 ~/.ai-hub；如已有 AI-Hub 资产中心请指向它）
export AIHUB_ROOT="$HOME/.ai-hub"
# 复制配置模板并编辑
cp skills/tt/config.example.json ./config.json
```

`config.json` 必填项：`projectRoot`（当前项目根）、`platforms`（可先用第 2 步探测结果）。

### 第 2 步：探测平台 + 自检

```bash
node skills/tt/scripts/detect-platforms.mjs        # 探测已装平台 + 角色分配建议
node skills/tt/scripts/validate-structure.mjs      # 校验 skill 结构完整
```

把探测结果（或手工分配）写入 `config.json` 的 `platforms` 段。

### 第 3 步：读 SKILL.md 开工

```bash
cat skills/tt/SKILL.md    # 或让 AI 平台加载本 skill
```

按 §0b 八步闭环推进。首次运行建议先做一次小任务冒烟，再上完整项目。

## 常见问题

- **只有一个平台怎么办？** 自动进入单平台模式（N=1）：8 步框架不变，跳过并行派单，"跨平台切换返工"退化为换子 agent/换批判视角复验。
- **增强资产（frontend-design、planning、review、security 等簇）没有？** 不影响核心闭环；§6.2/§2.1 有内置降级路径，缺失时自动走通用步骤。
- **模型 key 怎么配？** 放环境变量或本机 `.env`，`config.example.json` 的 model 段只放 baseUrl/model 名，**勿提交 key**。

## 自检清单（发布前/迁移后）

- [ ] `validate-structure.mjs` 通过
- [ ] `detect-platforms.mjs` 输出与实际平台一致
- [ ] 无本机绝对路径（盘符/用户目录/用户名）与 key 残留（`grep` 扫描）
