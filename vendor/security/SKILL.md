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
