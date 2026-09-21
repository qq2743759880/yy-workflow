# claude CLI 配置方法论指引（executor-setup 交接）

> 生成日期: 2026-09-21 ｜ 针对 CLI 版本: **2.1.276 (Claude Code)**（生成时本机 `claude --version` 实测）
>
> 腐烂防护：本文档只给步骤与自检命令，不给版本敏感的 UI 截图/深层参数。CLI 升级后若自检命令
> 报参数错误，以 `claude --help` 实测输出为准并回填本头部版本字段，不沿用旧行为假设。

## 边界（先读）

- 本向导（`scripts/executor-setup.mjs`）与本文档**绝不读取/写入任何凭据文件**（含
  `~/.claude/`、settings.json、凭据/keychain 等）；认证配置由用户本人在官方 CLI 内完成。
- 本文档只覆盖"怎么确认 CLI 可被非交互调用"，不覆盖账号注册/订阅/计费。

## 配置步骤（方法论，用户本人执行）

1. 安装 Node >= 18 后 `npm install -g @anthropic-ai/claude-code`（或按官方渠道安装）。
2. 在**用户自己的终端**（不是本向导）运行 `claude` 按其引导完成登录/认证。
3. 认证完成后关闭交互终端；后续非交互调用沿用户现有 env 认证，不写任何配置文件。

## 自检命令清单（机验，逐条应通过）

```bash
# 1. presence 档：在 PATH 且登记非交互形态（存在性，不代表可用）
node scripts/executor-setup.mjs --probe presence --only claude

# 2. 版本自检（实测版本回填本文档头部字段）
claude --version

# 3. roundtrip 档：真实喂"回复 OK"brief（60s 超时，沙箱 cwd；消耗一次 API 配额）
node scripts/executor-setup.mjs --probe roundtrip --cli claude
```

判定：1 应 `PRESENCE_YES`；2 应输出版本号；3 应 `ROUNDTRIP_OK` 且 stdout 含 `OK`。
3 失败时按 `stderr` 摘要排查认证/配额——**存在性档不因 3 失败而改判**（两档独立呈现）。

## 已知非交互形态（仓库编码，见 scripts/exec-host-generic.mjs）

- `claude -p`：brief 经 stdin 喂入；认证沿用户现有 env；不写 settings.json。
