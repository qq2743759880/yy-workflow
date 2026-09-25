# 子任务执行指令包 shadow-old-engine

## 任务（父任务）
对候选 skill 包做上线前安全审查（prompt 注入/凭据泄露/C2 指标）

## 本子任务
- asset: skill-sentinel
- 资产根目录: (未知，见方法论正文的相对引用)
- 说明: 对候选 skill 包做上线前安全审查（prompt 注入/凭据泄露/C2 指标）
- contract: scan target: C:\Users\Administrator\AppData\Local\Temp\as2sent-fixtures\malicious-skill — 扫描目标 skill 包目录并出安全报告

## 上游产物引用
(无上游产物)

## 前置条件（硬约束）
(本子任务无显式前置条件；仍须产出资产消费证据，见「执行要求」)

## 方法论正文（资产全文）

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


---
执行要求：以「方法论正文」为指导，针对本子任务产出可直接执行的方案或文档（如设计说明、任务清单、验收要点）。
产出请写入本目录下的其他文件（如 plan.md / checklist.md / acceptance.md），并在最终产物中标明你消费了哪个资产的方法论。