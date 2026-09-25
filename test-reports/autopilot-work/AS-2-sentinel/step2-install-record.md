# skill-scanner 安装与版本记录（AS-2-sentinel Step 2）
date: 2026-09-25T05:5x:xxZ
install: pip install cisco-ai-skill-scanner -> exit 0（cisco-ai-skill-scanner-2.1.0，wheel/sdist 路径装成，hatch-vcs git 元数据问题未触发——dispatch 预案 git clone 未需要）
runtime_test: skill-scanner --version -> 2.1.0 (exit 0); skill-scanner --help -> exit 0（entry point skill_scanner.cli.cli:main）
official_source: github:cisco-ai-defense/skill-scanner（2550 stars）
license: Apache-2.0（GitHub LICENSE 全文 Cisco Systems + pip show License: Apache-2.0 双源实测）
requires-python: >=3.11,<3.15（本机 3.14.6 满足）

## 重要发现：PyPI 同名撞车陷阱
PyPI 包 skill-scanner (0.3.3, MIT, thedevappsecguy, entry skill_scanner.cli:app) 与官方 cisco-ai-defense/skill-scanner 是不同项目——官方 PyPI 包名 = cisco-ai-skill-scanner（entry skill_scanner.cli.cli:main，与派单声明一致）。pip install skill-scanner 会装到错误项目（npm semgrep 假包同款教训）。
