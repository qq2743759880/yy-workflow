# 编排总表：前端-后端执行排序 + 契约冻结机制

> 配套 `task-agent-matrix.md` 使用。定义任务执行顺序、跨端依赖，以及「契约冻结」的 14 道闸门（①~⑭），确保前端/后端并行开发时接口不漂移。

## 1. 执行排序总表

```
┌─ 阶段 0  需求冻结 (planning 簇：formal-prd + vibe-prd)
│
├─ 阶段 1  架构 & 契约 (implementation 簇产 contract.md；fe-architect 产 design-spec)
│           └─ 契约冻结① 两端口径对齐 → 写入 contract.md / design-spec.md
│
├─ 阶段 2  [后端并行] be-implementer→be-tester（按契约实现+自测）
│           [前端并行] fe-implementer HTML 原型 → 用户签收(Gate A)
│           └─ 契约冻结②~⑦ 各自内部闸门
│
├─ 阶段 3  [后端] security 簇(be-security/harden) 加固 → be-validator 契约核验
│           [前端] fe-tester(Gate B) / fe-visual-auditor 技术验收
│           └─ 契约冻结⑧~⑪ 验收闸门
│
├─ 阶段 4  集成 (L0 合并检查点：文件交集扫描 + L2 冒烟)
│           └─ 契约冻结⑫ 集成 gate
│
└─ 阶段 5  批判反哺 (review 簇(critique) / security 簇(audit)) → 优化方案 → 回写本 skill
            └─ 契约冻结⑬~⑭ 批判闭环 + 经验沉淀
```

## 2. 契约冻结机制（①~⑭）

| 闸门 | 名称 | 判据（二值化） |
| --- | --- | --- |
| ① | 双端口径对齐 | contract.md 与 design-spec.md 字段一致 |
| ② | 后端契约冻结 | contract.md 冻结（契约先行）且被 be-implementer 接受 |
| ③ | 前端风格定调 | design-spec(风格/ token) 已冻结 |
| ④ | HTML 原型产出 | test-reports/fe-html/{page}.html 存在 |
| ⑤ | Gate A 用户签收 | 用户显式 APPROVED（主观） |
| ⑥ | 后端单测通过 | tsc 0 错 / eslint 0 / 单测全绿 |
| ⑦ | 契约实现一致 | be-validator 比对实现 vs contract，无漂移 |
| ⑧ | 安全审查通过 | be-security 无高危项 |
| ⑨ | 容错设计通过 | security 簇加固覆盖限流/降级路径 |
| ⑩ | 加固完成 | security 簇(harden) 覆盖边界/异常/i18n/溢出 |
| ⑪ | Gate B 技术验收 | fe-tester(vitest) + fe-visual-auditor(playwright) 全过（客观机验） |
| ⑫ | 集成 gate | L0 合并检查点：文件交集扫描 + L2 冒烟通过 |
| ⑬ | 批判闭环 | review 簇(critique) / security 簇(audit) 已产出且每条有修复落点 |
| ⑭ | 经验沉淀 | 优化方案回写本 skill（OPTIMIZATION.md / CHANGELOG） |

## 3. 规则

1. **未冻结不实现**：阶段 2 的 be-implementer / fe-implementer 在契约冻结①~③ 完成前不得动手。
2. **独立验收**：be-tester / be-validator 独立于实现者；fe-tester 独立于 fe-implementer。
3. **契约变更级联失效**：任一契约变更 → 受影响下游标记「待重验」，重走对应闸门。
4. **跨端冲突上浮主 agent**：接口不一致由主 agent 仲裁，不私下改对端契约。

> 本表与 `contract.md`、`task-agent-matrix.md` 配合使用；路径引用一律 `$SKILL_DIR/...`，离线可用。
