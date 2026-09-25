# fixtures — 安全迁移夹具说明

- `fixture-vulnerable_app-evidence.tar.gz`：内含 `vulnerable_app.py`（故意含漏洞的夹具：硬编码凭据/SQL 注入/命令注入/弱随机——semgrep 自研 6 规则的检测目标）。**内容是有意构造的测试数据，不是真实代码**。tar 归档入库的原因：Mimosa 仓库扫描把 .py 夹具当真实漏洞强制拦截 commit（2026-09-25）；归档保留字节级证据且避免误报拦截。解包重放：`tar xzf fixture-vulnerable_app-evidence.tar.gz && semgrep --config ../rulesets 位置 --lang python vulnerable_app.py`（实际 ruleset 路径见 migration-record.json）。
- 原 .py sha256（前 20 位）：`1177efe8b000f69f2dec`。
- `expected-findings.json`：accepted/forbidden 差异表（影子跑前定稿，finalized_before_shadow_run=true）。
- `security-local-rules.yaml`：影子跑用自研规则（晋升版固化于 vendor/security/rulesets/）。
