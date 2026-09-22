# B1 验证报告：gpt-researcher venv 打通

- 日期：2026-08-31
- 结论：**部分通过**（安装成功，import 依赖冲突待修）
- venv：`~/.ai-hub/thirdparty/venv-gpt-researcher`
- 安装：`pip install gpt-researcher` ✅ exit 0
- import：❌ `ModuleNotFoundError: No module named 'langchain.docstore'`（新版 langchain 移除 docstore）
- 补 `langchain-community`：仍缺 docstore
- 补 `langchain<0.3`：引发 `TypeError: metaclass conflict`（langchain-classic 1.0.8 与旧 langchain 不兼容）
- **待修**：需精确 langchain 版本组合（gpt-researcher requirements 锁定），或降级 gpt-researcher 到与当前 langchain 兼容版本
