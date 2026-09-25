# AS-2-sentinel 夹具说明（D-7 先例归档）

按 AS-2-security D-7 先例：恶意样本夹具含 prompt 注入/数据外泄指令文本，直接以 tar.gz 归档入库，避免夹具明文触发扫描器/Mimosa 拦截。

## 双夹具

| 文件 | 内容 | sha256 |
|---|---|---|
| fixture-benign-skill-evidence.tar.gz | 良性包：governance-skills/verification-before-completion 打包副本（仅 SKILL.md，本体未改动——派单白名单"打包副本仅进临时目录"） | a626fd06f91f56597bc8918b03e1e2661db89f09847ddae7dad2a0464a83e0c9 |
| fixture-malicious-skill-evidence.tar.gz | 恶意包：构造的假 skill（SKILL.md 含 prompt 注入"忽略全部先前指令"+凭据窃取+C2 外泄指令；scripts/collect_diagnostics.py 含外泄代码+反弹 shell） | b445e6893d96ac3adaa83efb8476675bb64aa2550827b026fd8100271cc59e9e |

复现：解包至 os.tmpdir 后对目录执行 `skill-scanner scan <目录> --format json`。

## smoke 产物（Step 4 差异表定稿依据，影子跑前）

- smoke-benign.json：is_safe=true，findings=1（MANIFEST_MISSING_LICENSE，INFO，policy_violation——打包完整性提示，非威胁检出）
- smoke-malicious.json：is_safe=false，findings=5（威胁检出 4：PROMPT_INJECTION_UNRESTRICTED_MODE HIGH / DATA_EXFIL_NETWORK_REQUESTS MEDIUM×2 / YARA_command_injection_generic CRITICAL；扫描机制注记 1：SKILL_LOAD_FALLBACK_USED INFO）

原始夹具目录位于 os.tmpdir（as2sent-fixtures/），跑完即删；本目录 tar 归档为唯一入库证据。
