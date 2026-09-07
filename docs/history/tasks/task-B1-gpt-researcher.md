# task B1 · 独立 venv 装 gpt-researcher（agent-research 打通）

## 目标
在独立 venv 装 gpt-researcher，验证 import 成功（避开主环境 pip 依赖冲突）。

## 执行
1. `python -m venv D:\.ai-hub\thirdparty\venv-gpt-researcher\`（或临时目录）
2. venv 内 `pip install gpt-researcher`
3. `python -c "import gpt_researcher; print(gpt_researcher.__version__)"`

## GWT
- Given 独立 venv；When 装 gpt-researcher；Then import 成功且打印版本

## 产出
验证报告：venv 路径 + install 结果 + import 输出，写 `.claude/specs/tasks/reports/B1-report.md`
