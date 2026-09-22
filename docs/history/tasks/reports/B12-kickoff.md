你是 TT 派单的执行验证 agent（task B1 + B2：独立 venv 装 gpt-researcher + metagpt）。
任务：在独立 venv 装两个框架竞品，验证 import 成功（避开主环境 pip 依赖冲突）。
步骤：
1. 读 spec：~/.ai-hub/skills/tt/.claude/specs/tasks/task-B1-gpt-researcher.md 和 task-B2-metagpt.md
2. B1：python -m venv ~/.ai-hub/thirdparty/venv-gpt-researcher → venv 内 pip install gpt-researcher → python -c "import gpt_researcher; print(gpt_researcher.__version__)"
3. B2：python -m venv ~/.ai-hub/thirdparty/venv-metagpt → venv 内 pip install metagpt → python -c "import metagpt; print(metagpt.__version__)"
4. 写报告：~/.ai-hub/skills/tt/.claude/specs/tasks/reports/B1-report.md 和 B2-report.md（venv 路径、install 结果、import 输出、通过/失败判断）
venv 隔离，不污染主环境；安装慢可等待。
