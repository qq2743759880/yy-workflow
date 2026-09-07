# task A1 · be-validator→portman 实际契约校验

## 目标
验证已部署 portman 1.35.0 真实执行契约校验（非仅 `--version` 探测）。

## 执行
1. 造最小 OpenAPI JSON 契约（含 /users 路径 + schema）
2. 跑 portman 校验（参考 `portman --help` 最小方式，如 `portman --cliOptionsFile` 或对 OpenAPI 文件）
3. 记录实际输出（pass/diff/校验报告）

## GWT
- Given portman 已装；When 跑契约校验；Then 产出真实校验结果（非仅 version 回显）

## 产出
验证报告：执行命令 + 实际输出 + 通过判断，写 `.claude/specs/tasks/reports/A1-report.md`
