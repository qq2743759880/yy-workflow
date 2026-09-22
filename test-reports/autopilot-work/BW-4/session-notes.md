# session-notes（一行一条：现象 + 位置 + 猜测）

- [stage0] journey 未初始化：`tt-journey.mjs --prereq-check --step 0` exit 1（INFERRED 无 .tt-state/journey.json）；按脚本指引先跑 `--update --step 0` 手动建基线（本项目非编排内核派单，走 N=1 手动模式）。
- [stage0] `detect-platforms.mjs` 探测到 7 平台但 exit 2 且不自动写 config.json，只在 stdout 给提示；猜测：exit 2=仅探测未落盘的信号，config.json 需手工落（已按其输出手工写入本项目 config.json）。
- [stage1] owner 对 AskUserQuestion（形态/词表两问）未响应；按 owner 预授权缺席纪律取保守默认推进，`[待确认 owner]` 标注在 docs/01-concept.md 待确认清单，gate concept-signed 为代推进记录，白话补审页 docs/02-premise-plain.md。
- [stage2] 同上，premise-signed 亦为代推进，白话版 docs/02-premise-plain.md；owner 任一前提 disagree 应回阶段 1 重挖（journey 可回跳，已实施产物不回退）。
- [stage2] `plan-review.mjs --check` 的 Eng 引用行正则（`[:：]\d+\s*$` 或 `(file|src|packages|lib)...:\d+`）要求引用落在行尾或行内带 file/src/lib 字样，初版"docs/yy-dev-plan.md T03 GWT"式行中引用被 FAIL；猜测是防蒙混的硬编码启发式，改行尾 `file:line` 后 PASS。
- [journey] `--update` 后进度图的"当前位置"显示的是下一个 pending 步骤而非刚完成的步骤（如完成 step 3 后显示"重执行1"）；猜测为显示口径问题，journey.json 的 steps 才是权威状态（已核对：0/1/3 done + gates 在册）。
- [边界] 本场止步于 journey step 3（拆任务）；step 5 契约冻结未做，dev-plan 已冻结契约顺序清单并写明红线"缺契约不派单"，接手人从 step 5/7 继续。
- [恢复] 恢复场景：journey 状态（0/1/3 done）与 session-notes 交接记录一致，tt-journey --prereq-check --step 5 直接 PASS，无状态错位；从 step 5 接续，未重做已完成阶段。
- [恢复] 恢复场景：本会话无子 agent 派发通道（无 Agent/Task 工具），且编排工作流（dynamic workflow）启动需 owner 在场确认而 owner 异步——红线 C-01（编排者不得自写自验）无法按原样满足；按用户"交付优先"指示降级为 N=1 主 agent 直接实现 + 全量独立实证复现（红线 3 不降级，全部证据实跑/实取）。建议下一场若有多 agent 通道可对验收报告做二次独立复核。
- [step5] 契约 owner 审阅缺席，按前序 stage1/stage2 同款缺席纪律代签（contract-frozen），pending 项（P4 词表/P5 形态）写入契约 owner_review 段。
- [T05] EFF 短词表官方 URL 404（2016/07/18 路径），有效地址为 2016/09/08/eff_short_wordlist_1.txt（1296 词）；原表含 "yo-yo" 不符 /^[a-z]{3,8}$/ 且 "yoyo" 已存在、"yodel" 已存在，最终替换 yo-yo→yucca（脚本转换非手打，头注已标注）。猜测：EFF 曾调整文件路径。
- [T09] clip.exe 复制的剪贴板内容经 Get-Clipboard 读取时 PowerShell 自身输出带行尾 \r\n，验收脚本需剥行尾再比对；此前 FAIL 为验收脚本比对口径问题，非产品缺陷。
- [T07] 验收 fixtures 硬编码词 'act'/'able' 不在 EFF 短词表内（短词表非全 3~8 词收录），5 词口令 GWT 改为取 WORDS.slice(0,5) 动态生成，杜绝 fixture 漂移。
- [验收] scripts/acceptance.mjs 首跑 28/32，修 4 处（T07 fixture、T09 两处脚本口径、降级探针 file URL 转义）后 32/32 PASS exit 0。
- [step8] 批判 C-1（--length 无上限）涉及冻结契约，按"冻结后改契约走变更单"纪律未私自修，登记 tracker 待 owner 批（唯一滞后项）。
- [journey] --update 一次只显示第 1 个 artifact（显示口径问题），journey.json 内均已在册。
