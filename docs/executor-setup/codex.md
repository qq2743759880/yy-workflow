# codex CLI 配置方法论指引（executor-setup 交接）

> 生成日期: 2026-09-21 ｜ 针对 CLI 版本: **codex-cli 0.153.4**（生成时本机 `codex --version` 实测）
>
> 腐烂防护：codex 有 config schema 变更前科（0.153 前后）。本文档只给步骤与自检命令；
> CLI 升级后若自检命令报参数错误，以 `codex --help` 实测输出为准并回填本头部版本字段。

## 边界（先读）

- 本向导（`scripts/executor-setup.mjs`）与本文档**绝不读取/写入任何凭据文件**（含
  `~/.codex/`、auth.json、config.toml 等）；认证配置由用户本人在官方 CLI 内完成。
- 本文档只覆盖"怎么确认 CLI 可被非交互调用"，不覆盖账号/配额开通。

## 配置步骤（方法论，用户本人执行）

1. 安装 Node >= 18 后安装 codex CLI（`npm install -g @openai/codex` 或官方渠道）。
2. 在**用户自己的终端**运行 `codex`（或其 `login` 类子命令）完成认证——具体登录形态
   以本机 `codex --help` 为准，本文档不复制易腐烂的登录参数。
3. 认证完成后，非交互调用沿用户现有 env 认证；本仓库宿主脚本不写任何宿主配置文件。

## 自检命令清单（机验，逐条应通过）

```bash
# 1. presence 档：在 PATH 且登记非交互形态（存在性，不代表可用）
node scripts/executor-setup.mjs --probe presence --only codex

# 2. 版本自检（实测版本回填本文档头部字段）
codex --version

# 3. roundtrip 档：真实喂"回复 OK"brief（60s 超时，沙箱 cwd；消耗一次 API 配额）
node scripts/executor-setup.mjs --probe roundtrip --cli codex
```

判定：1 应 `PRESENCE_YES`；2 应输出版本号；3 应 `ROUNDTRIP_OK` 且 stdout 含 `OK`。
历史先例：codex 曾"存在但 API 挂"（presence YES / roundtrip FAIL）——这正是两档分立的原因，
3 失败时**不得**回头改判 1 的结论。

## 已知非交互形态（仓库编码，见 scripts/exec-host-generic.mjs）

- `codex exec -`：brief 经 stdin 喂入；挂起则诚实报 TIMEOUT，不强接。
