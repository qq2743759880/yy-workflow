# 人工交接与旧配置迁移

唯一入口是 [handoff CLI](../scripts/handoff.mjs)，字段以 [共享契约](../contracts/delegation-contract.md) 和 [JSON schema](../contracts/delegation.schema.json) 为准。

## 批准与模式

普通任务默认 DIRECT_HOST/HOST_NATIVE，实际 execute 绑定才证明能力；无绑定不假报执行。opencode/cline 是明确批准的外部路径。MANUAL_HANDOFF 优先于旧 command/provider/hosts，禁止自动执行。handoff-prompt/C-handoff 映射 manual，A-direct 映射 DIRECT_HOST，B-cli 的外部路径仍需授权。self-dispatch 保留 AUTO，缺 nativeSubagent.execute 返回 NATIVE_BINDING_UNAVAILABLE；同名 spawn_subagent 元数据不算能力，独立验收不授予派生权限。

已有 Store plan/task 才能准备。task.desc 是唯一执行正文，plan.task 仅为背景/Core 路由上下文，--force/--task-desc 不能覆盖批准任务。

本端批准 JSON 须完整满足冻结 schema，包含 workflow_id、budget_policy、permission_snapshot、checker_ref、frozen_checker、return_policy、project_root、project_inputs、authorized_project_paths、acceptance。预算明确本次输入/输出/调用/重试/并发/深度/读取限额与可选 tokenizer 身份，不猜生产数值；权限明确 read/write/network/git_write/redelegation 与 approved_checker_ids。项目输入须是批准相对文件的真实 raw SHA/bytes，且同时满足 read_paths。返回 policy 固定文件清单与大小/数量界限。checker 固定本端 command、dependency/raw SHA 和超时/输出界限，不采纳返回者命令。

可选 methodology_context 提供真实条件；资源/logical skills 来自批准 task，request_id/revision 指定版本。policy_digest 用去自身 digest 的 canonicalJson 原件 SHA256；checker digest 用 [既有 helper](../scripts/lib/result-validation.mjs)，不填虚构 digest。token 未确切计数为 null；standalone manual 无 tokenizer 绑定，不能满足非 null token 硬限额。

## 命令与包

共同命令形态：

```text
node "$SKILL_DIR/scripts/handoff.mjs" <operation> --workspace "$PROJECT_ROOT" --plan-id <id> --task-id <id> <operation-arguments>
```

| operation | 参数与行为 |
| --- | --- |
| preview | --config <approved.json>；零业务写，DRAFT/UNREGISTERED |
| prepare | --config <approved.json>；展示新鲜 C4，经 T07/T03 登记 AWAITING_RESULT |
| import | --return <return.json> --source-root <returned-files-root>；暂存登记，禁止返回命令 |
| validate | 仅运行批准、依赖 pin 匹配的确定性 checker |
| accept | 证据与 CAS 接受原任务 |
| resume | 重核已接受产物/checker 证据，不自动执行 |
| integrate | --patch-id <artifact-logical-id>；受限本端集成 |
| rework/supersede | 显式状态事务 |

状态事务可给 --expected-state-version <current-version>，不匹配拒绝。

旧 executor-setup --handoff 使用同一 prepare，仍给 --workspace/--plan-id/--task-id，并须 --handoff-config <approved.json>。嵌入 runHandoff(argv,{present,independenceVerifier}) 复用相同复核。

复制预览不授权。directory 含控制清单、交接文本、来源映射、返回模板与允许原件/许可/项目输入，整体迁移可在含空格路径读取。sources/ 保留原目录；source-map 的逻辑 ID→相对 alias 不授予任意路径权限。未触发/未提供链接是 NOT_PROVIDED/CONDITION_PENDING，不能泛收目录。

初始方法按 phase/条件选择，可选参考可取且不首轮展开；必要正文、权限、验收/root review obligations 不裁断。最终超限返回不可重试 INPUT_BUDGET_BLOCKED。目录与 Store 是分开的有界步骤，中断 ORPHAN_PREPARATION 不可接受。相同请求/包重跑幂等，source/config/checker/任务漂移拒绝。新包先 rework/supersede 并提高 revision，入口随新配置生成 request_id；显式复用旧 ID会拒绝。

## 返回与本地接受

填写正式 ReturnEnvelope，回显 handoff/revision/package/input/contract/methodology 身份，列 artifacts 的 logical_id/relative_path/raw SHA/bytes/kind、checks_reported/unrun/deviations；用 [returnEnvelopeDigest](../scripts/lib/return-intake.mjs) 计算 digest。reported_verdict=PASS 仅自述。只导入批准普通相对文件，链接/归档/未批准/超限拒绝；旧三字段 REPORT 仅兼容解析，不推进正式状态。

validate 保存 stdout/stderr/hash/checks/exit/unrun，确定性 checker 不算模型调用。当前快照匹配、checker PASS、必要独立证据满足后 accept 才完成原任务；required 无证据不得接受。PATCH_FOR_REVIEW 先 integrate，再对合并项目 validate，旧 PASS 失效。

integrate 仅支持一个批准 project_inputs/write_paths 中已有普通文本文件且 git_write=true，拒绝新增/删除/重命名/binary/隐藏/config/credential 路径及更广迁移。先保存 before/hash/proof，再核当前来源/CAS；多文件迁移另作本端批准。

summary-read --delegation/journey 只读，复制不执行或验收。input_bytes 是本地最终文本测量；远端过程/重试/费用/方法应用未认证时 UNKNOWN/UNVERIFIED，无 usageObservation 不补0。接受成果不证明远端身份或 Receipt v2；C5 DEFERRED。本端 config_ref/project_root/source_snapshot_core 保持私有，不进入 TaskView。

## 旧 JSON 纯迁移

```text
node "$SKILL_DIR/scripts/executor-setup.mjs" --migration-preview <existing.json>
```

本地普通 JSON ≤4 MiB，经 migrateDelegation 输出单 envelope/dry_run=true，保留未知设置和旧偏好，零探测/调用/写入。重复稳定，规范化输入 changes 为空；坏 JSON/同层冲突/链接/超限/混用其他模式拒绝。预览不替代本端授权。
