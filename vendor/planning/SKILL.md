---
name: planning
description: Unified PRD and planning cluster for formal PRDs and Vibe Coding PRDs
version: 1.0.0
---

# Planning Cluster

For formal team review use reference/formal-prd.md. For direct coding-agent execution use reference/vibe-prd.md.

## Execution kernel (MetaGPT / crewAI 对标)

Kernel: geekan/MetaGPT（PRD 生成标杆，~69k★）+ crewAI（角色流）为 PRD 生成内核对标（ITERATION_PLAN Phase 2）。
- Invocation: 生成正式 PRD 时可 probe 对标工具可用性；否则用本簇 formal-prd / vibe-prd 内置流程（四确认关卡）。
- Degradation: 外部内核缺失 → 用内置流程，不假报已用 MetaGPT/crewAI。

## Formal PRD
Covers product context, goals, users, features, priorities, acceptance, and risks. See reference/formal-prd.md.

## Vibe Coding PRD
Must pass four confirmation gates in order: requirements definition, feature priorities, technology stack, and prototype. Do not enter the next gate until the previous gate is confirmed. See reference/prd-template.md.
