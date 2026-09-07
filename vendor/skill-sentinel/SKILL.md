---
version: 1.0.0
name: skill-sentinel
description: Agent Skill 包安全扫描器。扫描 SKILL.md 中的恶意模式、凭据泄露、C2 基础设施，用于插件市场/社区资产上线前安全审查。触发：安装第三方 skill 前、社区资产审查、插件市场安全扫描。
---

# Skill Sentinel

Agent Skill 包安全扫描器（Python 工具）。用于 插件市场 / 社区资产上线前的安全审查。

## 用途
- 扫描 SKILL.md 中的恶意模式（prompt injection、凭据泄露、C2 基础设施）
- 20+ 检测模式威胁情报库
- 插件市场 / 社区资产上线前强制扫描

## 使用
```bash
python analyze-skill.sh <skill目录>
# 或
python -m skill_sentinel <skill目录>
```

## Execution kernel (SkillSpector 对标)

Kernel: 自带 Python 工具（analyze-skill.sh / python -m skill_sentinel）为声明执行内核；对标升级候选 NVIDIA/SkillSpector（68 类漏洞模式 + SARIF 标准化输出）。
- **诚实标注（P2）**：本机实测 `python -m skill_sentinel` 无此模块、vendor 内无 analyze-skill.sh——自带工具**未实际部署**，当前仅声明层。SkillSpector 也未发布。
- Invocation: probe `python -m skill_sentinel --help`；可用时扫描目标 skill 目录；SARIF 输出为迁移目标。
- Degradation: python 缺失或工具未部署 → 明确标注"扫描未执行（工具未部署）"，不假报通过。

## 集成
- 插件市场：拉取 skill → skill-sentinel 扫描 → 通过才安装
- 社区资产：共享工作流/agent 包/记忆模板上线前扫描
- 呼应批 2/8：skill-sentinel 是插件/社区资产安全硬门槛
