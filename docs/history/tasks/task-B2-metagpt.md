# task B2 · 独立 venv 装 metagpt（planning 打通）

## 目标
在独立 venv 装 metagpt，验证 import 成功。

## 执行
1. `python -m venv ~/.ai-hub/thirdparty/venv-metagpt/`（或临时目录）
2. venv 内 `pip install metagpt`
3. `python -c "import metagpt; print(metagpt.__version__)"`

## GWT
- Given 独立 venv；When 装 metagpt；Then import 成功且打印版本

## 产出
验证报告：venv 路径 + install 结果 + import 输出，写 `.claude/specs/tasks/reports/B2-report.md`
