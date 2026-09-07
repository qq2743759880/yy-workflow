---
name: review
description: Unified review cluster for critique, automated verification, and polish
version: 1.0.0
---

# Review Cluster

1. Critique: discover UX, architecture, and quality problems using reference/critique.md.
2. Verification: run the nested testing agent in agents/be-tester.md and record reproducible evidence.
3. Polish: apply focused improvements from reference/polish.md.

Preserve polish YAGNI and minimum-change principles: do not add work that does not serve the task, and prefer the smallest safe change.

## Execution kernel (qodo-ai/pr-agent + continuedev/continue)

Kernel: qodo-ai/pr-agent（行级批注，~11.6k★）+ continuedev/continue（规则即代码，~33.7k★）为评审内核（原 descriptive reference 升级为内核声明）。
- Invocation: 行级批注可 probe pr-agent 可用性；规则校验可接入 continue 检查。
- Degradation: 外部内核缺失 → 用 reference/critique.md + agents/be-tester.md 内置流程，不假报已用外部内核。
