# T9 编排者独立验收报告（2026-09-20）

验收人：编排者。基线快照 `569a54c`。方法：写入范围核对 → 自报复核 → 执行者探针复跑（13/13）→
盲测探针（`blind-probes.mjs`，15 项）→ 回归全量。

## 判定

**T9 = ACCEPTED（无附条件）。** P2 向导的 10 条批判全部落地并经盲测证实。

## 验收证据

1. **写入范围**：4 处全在白名单（executor-setup.mjs 新 / docs/executor-setup 3 份 /
   summary-read.mjs 74+/1- 仅追加 / T9-wizard 自测目录）。零越界。
2. **复跑**：执行者 13/13；summary-read 既有功能零变化；regression 12/12；validate 0。
3. **盲测 15/15**：
   - H1 roundtrip 配额门：不指名目标 exit 2（fail-closed，零误烧配额）
   - H2 非 TTY 交互模式 387ms exit 2（不挂死）
   - H3 executor.json 三进程并写：3 成功 0 busy、内容无交错（withLock 生效）
   - H4 validate-handoff 三态：齐字段 PASS / 缺字段 FAIL(1) / 目录缺失 FAIL(1)
   - H5 凭据红线：三份指引零 key 字面量/贴 key 指令；脚本不读 auth 文件
   - H6 诚实性：presence/roundtrip 分档独立字段；opencode 无非交互编码如实标 unknown
   - H7 handoff：首生成 OK / 重复拒绝覆盖 / `../evil` 路径穿越拒绝（均 exit 2）
4. **规格溯源抽查**：`--cli` 漏进 parseArgs 的自曝修复属实（源码核对）；env 覆盖判 YES
   的诚实性修复属实；README/指引头部带"2026-09-21 + 六 CLI 版本号"实测字段。

## 发现登记（P0=0，P1=0，P2=2）

- **P2-1（执行者自报 #12，实测确认）**：validate-handoff 对正文冒号列表项的 key 有误判
  可能——不影响三必填字段判定（实测证据链完整时判定正确），后续可加严格 frontmatter 解析。
- **P2-2**：runner 沙箱磁盘累积（执行者自报 #11）——修剪策略已留 5 个，长期批次需关注。

## 执行者自报诚实度

13/13 输出与复跑一致；5 条偏差申报（含"真机 claude roundtrip 消耗 1 次配额"的如实标注、
两处施工中途自查自纠的产品 bug 披露）全部抽查属实。0/13→8/13→13/13 的过程留痕完整。

## 编排者探针侧勘误（记录在案）

H4/H7 首两版失败均为探针侧契约误用（报告目录树 vs 单报告目录；位置参数 vs --plan-id/--task-id），
非产品缺陷——修正过程留痕于 blind-probes.mjs 修改历史。
