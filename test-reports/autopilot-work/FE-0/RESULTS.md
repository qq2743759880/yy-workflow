# FE-0 自测 RESULTS

执行者：L1（FE-0 派单）。以下为交付证据，未自称 DONE，待 L2 独立复核。

## 交付物
1. scripts/build-guide-content.mjs（sha256 前缀 f6d31c4ca97459ea）
2. webview/journey/content.js（sha256 前缀 6ee80007a901eeaa，重跑幂等字节一致）

## 探针结果
PROBE1 幂等：连续两次 node scripts/build-guide-content.mjs 输出字节一致（sha256 前缀 6ee80007a901eeaa，diff 为空）→ PASS
PROBE2 完整性自检：写出前校验 6 阶段全在 + 16 资产全在 + 每卡片 name/description/cluster 非空，任一不满足即 exit 1 → PASS（正常路径自检通过输出 OK 行）
PROBE3a 畸形源文件 fail-closed：移除 commands/yy-1-requirement.md 的「**目标**：」行 → exit 1，FAIL-CLOSED: 目标行解析失败（无「**目标**：」）→ PASS
PROBE3b 源文件缺失 fail-closed：临时移走 vendor/review/ → exit 1，FAIL-CLOSED: 资产文件缺失 → PASS；恢复后重跑 sha256 与基线一致（源文件未被污染）

## 输出原样摘要

- 6 阶段全在：0 立项 / 资产整合 / 1 需求挖掘 / 2 拆任务（前提挑战） / 3 规划 + 契约冻结 / 4 派单执行 / 5 验收批判（反哺）
- 16 资产全在：be-architect、implementation、be-validator、be-provider、sdlc、be-resilience、security、review、agent-research、dev-planner、frontend-design、frontend-visual-validation、agent-vision-toolkit、colorize、planning、skill-sentinel
- 每卡片三字段（name/description/cluster）非空校验通过（脚本内 fail-closed）
- 话术含可复制标记：kickPrompt/redoPrompt 全 6 阶段非空，FE-2 以可复制按钮渲染
- JSON.stringify 序列化 5885 字节，UTF-8 中文保留原样

## D-xxx 偏差登记

- D-FE0-1 vendor/implementation/implementation.md 无 frontmatter（正文以「# implementation」开头），提取器对无 frontmatter 资产退化为「# name + 正文首段」提取，description 取正文首段——与「frontmatter description」规格有偏差，已按唯一可提取事实源处理并保持 fail-closed 字段校验。
- D-FE0-2 「配套资产」按命令文件正文独立词匹配提取（(?<![w-]) 边界，排除 review-gate/yy-2-planning 等子串假阳性）；结果仅阶段 2 点名 dev-planner，其余阶段命令文件未点名任何 16 资产——命令文件事实如此，非提取器缺陷。
