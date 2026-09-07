# 模型与 API 配置说明（model-config）

> 通用配置说明；具体 key 由用户自行填入环境变量或本机 `.env`，**严禁提交仓库**。

## 双模型源（fast / strong）

| 用途 | 建议 | 配置项 |
|------|------|--------|
| fast（测试/开发环境默认） | 便宜快模型 | `config.json → model.fast.{baseUrl, model}` |
| strong（主模型，测试环境需用户确认后使用） | 高质量模型 | `config.json → model.strong.{baseUrl, model}` |

**纪律**：测试/开发环境默认只用 fast；如需主模型必须**先向用户明确确认**后才可用。

## Embedding / Reranker（记忆检索可选）

- 优先云端 API；本地模型降为 fallback（本地不可用或云端失败才回退）。
- 注意 embedding 维度与检索后端对齐（如 2048→1024 对齐示例）。

## 环境变量约定

```
FAST_BASE_URL=...
FAST_API_KEY=...
STRONG_BASE_URL=...
STRONG_API_KEY=...
EMBEDDING_API_URL=...
```

> 泄露红线：发布前 `grep -rnE "sk-|ark-|_KEY" 仓库` 应为 0（docs 示例内仅保留 `<YOUR_...>` 占位）。
