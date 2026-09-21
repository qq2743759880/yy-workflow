PROBE1 幂等：连续两次 node scripts/build-guide-content.mjs 输出字节一致（sha256 前缀 6ee80007a901eeaa，diff 为空）→ PASS
PROBE2 完整性自检：写出前校验 6 阶段全在 + 16 资产全在 + 每卡片 name/description/cluster 非空，任一不满足即 exit 1 → PASS（正常路径自检通过输出 OK 行）
PROBE3a 畸形源文件 fail-closed：移除 commands/yy-1-requirement.md 的「**目标**：」行 → exit 1，FAIL-CLOSED: 目标行解析失败（无「**目标**：」）→ PASS
PROBE3b 源文件缺失 fail-closed：临时移走 vendor/review/ → exit 1，FAIL-CLOSED: 资产文件缺失 → PASS；恢复后重跑 sha256 与基线一致（源文件未被污染）
