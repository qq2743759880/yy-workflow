# task08｜动态资产目录与执行可用性（M1）

状态：动态目录与分页本地实现通过 fixture 用例；阶段适用性/执行器/目标覆盖缺权威来源，按 `UNKNOWN` 返回，完整 AT-06–09 尚未建立。依据：PRD FR-04；AT-06–09。证据：`docs/yy-web/RELEASE-EVIDENCE-20260927.json`。

## 交付与关联

- 交付 `yy_list_assets` 的完整分页目录、适用阶段、定义/许可/部署/内核/覆盖状态与 `blocked_reason`。只读方法不生成本机执行宣称。
- 前置：task06 绑定及 task03 权限合同；后置：task11。选型：从 asset manifest 和实际能力探测组合，不把文档存在误当 executor 存在。
- 候选 seam：`contracts/asset-manifest-v2.json`、现有资产发现逻辑、生产 M 的目录工具；新增字段由阶段 5 冻结。

## GWT 验收

1. Given 当前阶段候选目录，When 分页耗尽，Then每个候选均可检索，有来源、版本、适用性与阻塞原因，页间无丢失或重复。
2. Given 文档存在但内核缺失或 security 对象混合，When 查询，Then分别展示不可执行/未知与拒绝/部分覆盖/通过，不虚构真扫能力。
3. Given `be-validator` 等只读方法，When 浏览目录，Then只返回方法与限制，不创建 job 或声称已在本机执行。

停止条件：能力状态无法证实时回 `unknown`，不提升为 available。
