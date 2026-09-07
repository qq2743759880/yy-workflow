# T1 报告：Python 竞品虚拟环境修复

> 执行者：TT 工作流派出的独立执行子 agent
> 日期：2026-09-01
> 环境事实：Windows；解释器 py3.10.10（Program Files）、py3.11.15（uv 管理）、py3.12.7（anaconda3）、py3.14.6（C:\Python314）
> 工具：`uv`（D:\ ...\hermes\bin\uv.exe），全程独立 venv，未污染任何全局 Python。

## 总结（验收结果）

| 竞品 | venv | 结果 | import | 版本 |
|------|------|------|--------|------|
| gpt-researcher（调研类） | venv-gpt-researcher（py3.10） | ✅ 成功 | OK | 0.12.3 |
| crewai（规划类，替代） | venv-crewai-py311（py3.11） | ✅ 成功 | OK | 1.15.18 |
| metagpt（规划类） | venv-metagpt（py3.10） | ⚠️ 仅 0.1 老版可用 | OK | 0.1 |

验收：调研类 1 个 ✅（gpt-researcher）；规划类 1 个 ✅（crewai 1.15.18，作为 metagpt 现代版不可装的替代）。

---

## 1. gpt-researcher（调研类）— 修复成功

### venv 路径
`D:\.ai-hub\thirdparty\venv-gpt-researcher`（Python 3.10.10，删除重建为干净 venv）

### 原始故障（已核实）
原 venv 同时存在 `langchain 0.2.17` + `langchain-classic 1.0.8`（metaclass 冲突），且解析到了新版 langchain 1.x（移除 `langchain.docstore`），`import gpt_researcher` 报 `ModuleNotFoundError: No module named 'langchain.docstore'`。

### 安装命令（均为 uv，基于 venv 内 python）
1. 重建：`uv venv --python "...\Python310\python.exe" venv-gpt-researcher`
2. 首次装：`uv pip install --python <venv>/Scripts/python.exe "gpt-researcher==0.12.3"`
   → exit 0；但 uv 默认解析到 `langchain 1.3.18`（langchain 1.x 已删 `langchain.docstore`），`import gpt_researcher` 仍报 `ModuleNotFoundError: langchain.docstore`。
3. 钉住 0.x 系重装：`uv pip install ... "gpt-researcher==0.12.3" "langchain<1.0" "langchain-core<1.0" "langchain-community<1.0" "langchain-openai<1.0"`
   → exit 0；解析为 langchain 0.3.30 / core 0.3.86 / community 0.3.31 / openai 0.3.35。
4. 卸载遗留冲突包：`uv pip uninstall ... langchain-classic`（1.0.8 残留物，移除消除 metaclass 冲突隐患）

### import 输出
```
import gpt_researcher -> OK
from gpt_researcher import GPTResearcher -> OK
langchain.__version__ = 0.3.30
gpt_researcher.__version__ = 0.12.3
```

### 结论
✅ 成功。根因 = langchain 1.x 破坏性变更（移除 docstore）+ 旧手动装包混入 langchain-classic 1.0.8。修复 = 干净 venv + 钉 langchain<1.0（0.3.30），并卸载 langchain-classic。

---

## 2. metagpt（规划类）— 现代版不可装，仅 0.1 老版可用

### venv 路径
`D:\.ai-hub\thirdparty\venv-metagpt`（Python 3.10.10）

### 原始故障（已核实）
`pip install metagpt` 报 `OSError: [Errno 2]`（volcengine-python-sdk 在 Windows 的文件/路径问题）。本次用 uv 重试后 volcengine OSError **未复现**（uv 的解析/安装路径避开了该问题）。

### 安装尝试（诚实记录，按时间顺序）
1. `uv pip install ... metagpt`（不钉版本）
   → exit 0；但解析到 `metagpt 0.1`（deepwisdomai 远古版），`import metagpt` OK。原因：uv 对无约束解析给了 0.1（PyPI 列表含 0.1..0.8.2，最新 0.8.2）。
2. `uv pip install ... "metagpt==0.8.2" --reinstall`
   → exit 1。**根因 1：`metagpt>=0.8.2 depends on lancedb==0.4.0`，而 PyPI 上 lancedb 最早仅 0.14.0，0.4.0 从未发布**（已用 `pip index versions lancedb` 与 `pip download lancedb==0.4.0` 双重核实）。依赖硬伤，任何平台都装不了。
3. `uv pip install ... metagpt==0.7.7 / 0.6.13 / 0.6.0` → 同样钉 `lancedb==0.4.0`，exit 1。
4. `metagpt==0.5.2 / 0.4.0 / 0.3.0` → 钉 `lancedb==0.1.16`，同样不存在，exit 1。
5. 最后尝试：`uv pip install ... "metagpt==0.6.13" --no-deps`（绕过 lancedb）→ 包装上，但 `import metagpt` 报 `ModuleNotFoundError: No module named 'semantic_kernel'`，且其依赖要求 `semantic-kernel==0.4.3.dev0`（2023 年远古 dev 版，PyPI 不可得）；继续补装无实际收益 → 放弃。

### 最终处理
恢复唯一可完整安装并 import 的 `metagpt==0.1`（带依赖重装），并如实标注为老版本：
```
import metagpt -> OK
metagpt.__version__ = 0.1（deepwisdomai 早期版，非现代 MetaGPT）
```

### 结论
⚠️ 现代 metagpt（0.3~0.8.2）**确认无法从 PyPI 安装**：所有版本钉住不存在的 `lancedb==0.1.16 / 0.4.0`（PyPI 自 0.14.0 起才发布），0.6+ 另需远古 `semantic-kernel==0.4.3.dev0`。非 Windows 特定问题，是上游依赖发布缺失。venv 内保留 0.1 老版作为最小可用形态；规划类竞品改由 **crewAI** 承担。

---

## 3. crewai（规划类替代）— 成功

### venv 路径
`D:\.ai-hub\thirdparty\venv-crewai-py311`（Python 3.11.15，uv 管理；按任务约束不使用 py3.14 的 venv-crewai）

### 安装命令
1. `uv venv --python "...\uv\python\cpython-3.11.15-windows-x86_64-none\python.exe" venv-crewai-py311`
2. `uv pip install --python <venv>/Scripts/python.exe crewai`
   → exit 0；crewai / crewai-cli / crewai-core 1.15.18。

### import 输出
```
import crewai -> OK
crewai.__version__ = 1.15.18
```

### 结论
✅ 成功。py3.14（venv-crewai，原为空 venv）下 crewai 不保证可用，故按任务指引改 py3.11 新建独立 venv。

---

## 附：最终 venv 清单（thirdparty 下）

| venv | Python | 装了什么 | 可 import |
|------|--------|----------|-----------|
| venv-gpt-researcher | 3.10.10 | gpt-researcher 0.12.3 + langchain 0.3.30 系 | ✅ |
| venv-metagpt | 3.10.10 | metagpt 0.1（老版） | ✅ |
| venv-crewai-py311 | 3.11.15 | crewai 1.15.18 | ✅ |
| venv-crewai | 3.14.6 | 空（弃用，crewai 不保证支持 3.14） | — |

## 硬性约束遵守
- 所有安装均在独立 venv 内，未用 `--user`，未触碰全局 Python。
- 未修改任何代码/文档仓库文件，仅做环境安装与 import 验证。
- 失败均已诚实记录（metagpt 现代版不可装的根因 = lancedb/semantic-kernel 版本在 PyPI 不存在，非网络或 Windows 特定问题）。
