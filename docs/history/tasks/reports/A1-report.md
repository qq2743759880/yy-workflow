# A1 验证报告 · be-validator→portman 实际契约校验

- **task**: task-A1-portman.md
- **执行时间**: 2026-08-31 22:38–22:45
- **结论**: **PASS** — portman 1.35.0 已完成真实契约校验（非仅 `--version` 探测），含**正例通过 + 反例失败（diff）**双向实证
- **前置状态**: `portman --version` → `1.35.0`（PATH 全局，`/c/Users/Administrator/AppData/Roaming/npm/portman`）

---

## 1. 执行命令

```bash
# 参考 portman --help 采用 --local + --includeTests + --runNewman 最小方式：
#  OpenAPI JSON → Postman 集合 → 注入契约测试 → 用 Newman 对真实 baseUrl 执行
portman --local oas.json --baseUrl http://127.0.0.1:39876 --includeTests --runNewman   # 正例（契约合规）
portman --local oas.json --baseUrl http://127.0.0.1:39877 --includeTests --runNewman   # 反例（契约违约）
```

## 2. 测试契约（最小 OpenAPI 3.0，临时目录 `tmp/a1-portman/`，已清理）

- `paths./users.get` → `operationId: getUsers`，200 响应 `application/json` → `array of $ref User`
- `components.schemas.User` → `required: [id, name]`；`id: int64`、`name: string`
- 本地 mock 服务（node http，127.0.0.1）
  - 正例（39876）：`GET /users` → `[{"id":1,"name":"alice"},{"id":2,"name":"bob"}]`（合规）
  - 反例（39877）：`GET /users` → `[{"id":3}]`（**缺 required `name`**，故意违约）

## 3. 实际输出

### 3a. 正例（契约合规 → PASS，exit 0）

```
- Converting OpenApi to Postman Collection
  ✔ Conversion successful
================================================================================
 Run Newman against:  http://127.0.0.1:39876
→ List users
  GET http://127.0.0.1:39876/users [200 OK, 202B, 47ms]
  √  [GET]::/users - Status code is 2xx
  √  [GET]::/users - Content-Type is application/json
  √  [GET]::/users - Response has JSON Body
  √  [GET]::/users - Schema is valid
Collection run completed.

│              iterations │      1 │      0 │
│                requests │      1 │      0 │
│            test-scripts │      1 │      0 │
│              assertions │      4 │      0 │
└────... total run duration: 202ms ───┘
```

### 3b. 反例（契约违约 → FAIL + diff，exit 1）

```
→ List users
  GET http://127.0.0.1:39877/users [200 OK, 165B, 34ms]
  √  [GET]::/users - Status code is 2xx
  √  [GET]::/users - Content-Type is application/json
  √  [GET]::/users - Response has JSON Body
  1. [GET]::/users - Schema is valid            ← FAIL
Failed assertions: 1; Failures: 2
│              assertions │      4 │      1 │
1.  AssertionError    [GET]::/users - Schema is valid
     expected data to satisfy schema but found following errors:
     data[0] should have required property 'name'    ← diff 明确指向缺 required 字段
================================================================================
Newman run failed with:
[GET]::/users - Schema is valid
---EXIT:1---
```

## 4. 通过判断

| GWT | 结果 |
|-----|------|
| Given portman 已装 | ✅ `portman --version` → 1.35.0 |
| When 跑契约校验 | ✅ `portman --local … --runNewman` 真实执行 |
| Then 产出真实校验结果（非仅 version 回显） | ✅ **双向实证**：合规→4/4 assertions PASS、exit 0；违约→schema 断言 FAIL、`data[0] should have required property 'name'`、exit 1 |

**判定：PASS。** portman 1.35.0 具备真实契约校验能力，行为与 TT 契约 gate 期望一致：一致输出 `pass`（exit 0）、不一致输出 diff 并失败（exit 1）。

## 5. 对 TT 代码的发现（只读，未改动）

- `scripts/lib/adapters/portman.mjs` 当前对契约文件仅做「文件可读 + hash 记录」，`pass:null + degraded:true`，**不调用真实 portman CLI**（v1.35 已装且实测可跑）。
- 结论：适配器行为诚实（未伪造 pass），但已落后于部署状态。**建议**（后续迭代，非本 task 范围）：将 `portman --local <oas> --baseUrl <target> --includeTests --runNewman` 接入适配器，把 exit code / Newman 断言数映射为 `pass:true/false + diff`，届时契约 gate 可升级为真实阻塞校验（对照 BE-09 与 `dev-tt-mvp.md` MVP-6 AC）。

## 6. 清理

- 临时契约与 mock 脚本（`tmp/a1-portman/`）已删除，mock 进程已停止（端口 39876/39877 无监听）。
- 本次未修改任何 TT 源码。
