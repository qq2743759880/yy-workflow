# 子任务执行指令包 shadow-old-engine

## 任务（父任务）
对 fixtures/vulnerable_app.py 执行 security 审计三阶段（audit 发现与定级 → harden → backend specialist 核查），输出发现清单（含严重级）

## 本子任务
- asset: security
- 资产根目录: (未知，见方法论正文的相对引用)
- 说明: 对 fixtures/vulnerable_app.py 执行 security 审计三阶段（audit 发现与定级 → harden → backend specialist 核查），输出发现清单（含严重级）
- contract: SAST 扫描 D:/.ai-hub/skills/yy/test-reports/autopilot-work/AS-2-security/fixtures/vulnerable_app.py，输出发现清单（含严重级）

## 上游产物引用
(无上游产物)

## 前置条件（硬约束）
(本子任务无显式前置条件；仍须产出资产消费证据，见「执行要求」)

## 方法论正文（资产全文）

---
name: security
description: Unified security cluster for audit, hardening, and backend security verification
version: 1.0.0
---

# Security Cluster

Execute in three stages: audit discovery, hardening fixes, and backend specialist verification.

## Audit
Find issues and severity; see reference/audit.md.

## Harden
Improve errors, i18n, overflow, boundaries, and degradation; see reference/harden.md.

## Backend specialist
Check auth, injection, sensitive data, keys, dependencies, CORS, CSRF, and SSRF; see agents/be-security.md.

## Execution kernel (semgrep + gitleaks)

Kernel: semgrep（多语言 SAST）+ gitleaks（密钥扫描）为扫描执行内核（原 COMPETITORS.md descriptive reference 升级为执行内核声明）。
- **实际执行（第三方面部署，非声明）**：`node $SKILL_DIR/scripts/security-scan.mjs <目标目录>` 调用已部署的 semgrep + gitleaks 真实扫描，输出发现清单并 exit 1（有发现）。部署：`pip install semgrep` + `go install github.com/zricethezav/gitleaks/v8`。
- Invocation: probe `semgrep --version` / `gitleaks --version`；可用时对目标目录执行扫描，结果汇入 audit 发现清单。
- Degradation: 工具缺失 → audit 阶段明确标注"SAST/密钥扫描未执行（工具缺失）"，不假报"无高危"。audit/harden/be-security 三阶段不变。


---
执行要求：以「方法论正文」为指导，针对本子任务产出可直接执行的方案或文档（如设计说明、任务清单、验收要点）。
产出请写入本目录下的其他文件（如 plan.md / checklist.md / acceptance.md），并在最终产物中标明你消费了哪个资产的方法论。