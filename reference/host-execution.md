# 平台中立执行接口

方法论由资产持有，Decision/routing/activation/evidence 由 YY 持有，执行由当前宿主持有。语义输入字段固定为 task、parent_task、methodology_payload、requested_resources、acceptance_criteria、contract、upstream_artifacts；输出固定为 status、artifacts、evidence、provider、executed。见 contracts/host-execution-contract.yaml。

默认 HOST_NATIVE：调用 admitted task 的 dispatch/executePlan 时传入 host.execute(input, context)。宿主用自己的模型与工具执行；无需子进程。context 提供 workspace、artifacts_dir，以及逻辑依赖的 dependencies/invoke_skill。宿主返回 EXECUTED、executed=true 和任务 artifacts 目录中的非空新产物；YY复核路径与哈希。input_sha256 回显只能证明消费包关联，methodology_application 仍 UNVERIFIED，不产生 Receipt v2 APPLIED/VERIFIED。

嵌入入口是 scripts/lib/host-execution.mjs 的 executePreparedHost(record, options)，options 提供 transport、present、workspace、host 与 executionContext（contract、parent_task、acceptance_criteria、upstream_artifacts、methodology_context、owner_intent）。它重用既有 verifyHostDecision 与冻结契约 gate。嵌入接入先通过既有 prepareHostDecision/present/verifyHostDecision 完成 C4 admission，不能跳过 Decision Packet。Execution 不重算路由、资格或 owner；task 使用唯一子任务 desc，父任务只是 context。一个包只含一条可执行 task statement。

EXTERNAL_PROVIDER 显式 opt-in：provider 注册表在 adapters/index.mjs，可注入同形 registry。--provider 或部署 executor.provider 选择具名可选 provider；options.exec 数组是通用外部桥，最后参数仍为 brief.md，同目录 execution-package.json 保存与嵌入模式相同的逻辑 input 和 Decision authority。外部 adapter 可内部翻译，不能改变任务、验收、方法论或引用。

BRIEF_ONLY：没有可执行回调/明确外部配置时返回完整 brief 与 execution-package.json、executed=false；计划 awaiting-host，子任务可恢复，不算执行成功。CLI 本身无法调用正在运行的模型，不能据其进程存在假称 HOST_NATIVE 已执行。嵌入 harness 必须实际绑定回调。

METHODOLOGY.json 是逻辑依赖与 pin 映射。唯一解析器是 scripts/lib/methodology.mjs 的 resolveMethodologyPolicy；wrapper_policy 和 logical invocation_policy 均被消费，options.invocationPolicy 无覆盖权。USER_EXPLICIT 在已准入的用户资产任务中可 INLINE，但只有 owner_intent.logical_skills 明确列出该 logical skill 才能 native invoke；MODEL_ELIGIBLE 在宿主有对应能力时 native，否则 INLINE；YY_ROUTED 由已准入派单驱动。支持相应 logical skill 的宿主通过 invokeSkill 读取，缺原生 Skill 工具则使用已内联的固定字节方法论，缺内容或 pin 不符则 fail-closed。agents/openai.yaml 与 upstream frontmatter 只作为出处保留，不能成为跨平台权威。execution-package.json 记录 primary_methodology、dependencies、source hashes、bindings/resolution。evidence.methodology_delivery 只证明包已送达，native_invocations 仅记实际回调成功返回；methodology_application 仍 UNVERIFIED。资源并未因此被宣称已应用。

确定性工具依赖是具体 capability 的依赖，缺工具必须诚实报告；它们不代表宿主平台不兼容。没有模型选择、安装 CLI 或自动付费评测。C1/C4 admission 与 M1/V2 ABI 不变，C5 待交付。
