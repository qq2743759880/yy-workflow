---
task_id: taskNN-contract
title: <接口/模块名>
from: <开发平台>
to: <消费平台>
status: 待验收
contract_version: 1
---

# 契约单

> owner 审核指引：templates/owner-review/contract-review.md

## 端点/接口
| 方法 | 路径 | 请求 | 响应 |
|------|------|------|------|
| POST | /api/... | {...} | {...} |

## 字段定义
（字段名/类型/必填/约束 —— 冻结后不改，错误码必须是稳定字符串）

## 真实 curl 示例
```bash
curl -X POST http://localhost:PORT/api/... -H 'Content-Type: application/json' -d '{...}'
# 期望响应
```

## 错误码
| code | 含义 |
|------|------|

## 验收标准（供测试 agent L1/CDC 核验）
- [ ] 字段与 schemas.py 逐字段一致
- [ ] curl 实测响应符合示例
- [ ] 下游类型定义可编译/可消费

## 状态机
待验收 → 已验收(解锁下游) → [上游改动] 契约变更单 → 待重验 → 重验收/失效
