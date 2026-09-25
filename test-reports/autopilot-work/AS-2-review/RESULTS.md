# AS-2-review RESULTS — review(prompt-backend) replace 探测（Playbook §六 复制单 #3）——NO INSTALL 分支

> 执行：autopilot L1（AS-2-review-dispatch，照 plans/asset-migration-playbook.md §六 wizard；派单 §⚠ 预声明 NO INSTALL 风险分支）｜日期：2026-09-25
> 契约权威：contracts/asset-migration.md（asset-migration@1.0.0）｜状态：**ACTIVE（迁移停 SHADOW 前——两候选均 NO INSTALL，Failure Rule 3）**
> 本文档不自称 DONE——adapt 裁定权在编排者/Owner（裁定材料见 adaptation-adjudication.md）。

## 一、NO INSTALL 探测结果（派单要求的第一交付项）

**两条候选均不通（Failure Rule 3：provider identity 三件套缺一即 NO INSTALL）**：

| 候选 | 探测实测 | 三件套 | 裁定 |
|---|---|---|---|
| **A: review-bugbot 宿主技能**（C:\Users\Administrator\.agents\skills\review-bugbot） | 目录穷举（-laR + 7 类可执行扩展名 find + package.json 搜索）**仅 SKILL.md（4902B）一个文件**；`where bugbot` 无命令；宿主 skills 目录四个相关条目全部为 SKILL 型。SKILL.md 语义 = 指示交互宿主启动 `subagent_type: "bugbot"` 宿主子代理——**非进程，结构性不可被管线 spawn** | official_source 缺 / install_channel 缺 / runtime_test 不可行 | **NO INSTALL** |
| **B: CodeRabbit CLI**（npm 通道） | `npx @coderabbitai/cli` → **registry E404**（包未发布）；`where coderabbit` 未安装；`npm search coderabbit` 全量检索无官方 CLI 包（官方 scope @coderabbitai 真实存在——carrot-ui/config 皆官方——唯 cli 缺位）；registry 仅有第三方个人 wrapper（npm 假包教训禁用作替代）。SaaS auth 门（派单预声明，AS-0 未确认）为独立第二阻断，因 install 失败未达运行时门 | official_source 在 / install_channel 缺 / runtime_test 不可行 | **NO INSTALL** |

**按派单 §⚠ 分支执行**：迁移停在 SHADOW 之前（state 保持 ACTIVE，ACTIVE→SHADOW 转移条件=影子跑夹具就位，而无新引擎即无影子对象——结构性不满足）；**零生产写面**（未创建 review-bugbot.mjs / review-coderabbit.mjs——无引擎可驱动，创建即假接入；未动 index.mjs / review.yaml / manifest；**未自研任何 wrapper**）；合法产出 = adapt 裁定材料交编排者/Owner。

## 二、wizard 勾选（NO INSTALL 分支态）

- [x] **Step 0 锁**：零生产写面分支——仅对本单证据 migration-record.json acquire（exit 0，list 确认 ACTIVE，ttl 120min；D-2 锁面收窄登记），收口 release
- [x] **Step 1 baseline 行核对 + preflight**：asset-baseline-before.json#review 四面核对（adapter=prompt / routes T2_BACKEND,T4_FRONTEND,T5_OPS / consumption S8链内,BW提及 / vendor vendor/review，snapshot 2026-09-24T08:45:39Z，与派单一致）；开工 preflight **8 PASS / 0 FAIL / 0 SKIP**（留档 precheck-preflight.txt）；manifest 现值 sha256=d9f0d738… 实测核验
- [x] **Step 2 NO INSTALL 探测**（见 §一；证据 step2-probe-a-bugbot.txt / step2-probe-a2-bugbot-cli.txt / step2-probe-b-coderabbit.txt + step2-no-install-record.md 汇总）
- **Step 3–9**：**BLOCKED_NO_INSTALL**——旧引擎实测（无回滚面变化，不适用）、差异表定稿（无对照对象，D-3）、影子跑、回滚三场景、晋升链（manifest verification / manifest-build 新 hash / eligible / Gate-2 / 五元组）、change.record（第 6 条属"若晋升"分支，未触发）——全部不产出、不假造

## 三、adapt 裁定材料（交编排者/Owner，摘要）

- **推荐选项 1**：review 保留 prompt-backend（adapt 终局）——与 vendor/review/SKILL.md 头部既有降级语义一致（"外部内核缺失 → 内置流程，不假报已用外部内核"）。
- **选项 2（可叠加）**：宿主技能绑定文档化——草案在 adaptation-adjudication.md 附录 A（绑定对象 /review-bugbot、交互宿主适用面、管线非适用面显式边界）；正式化落位需 Owner 另行授权（D-5）。
- **选项 3**：未来再评估触发器已列明（bugbot 获得可 spawn CLI 入口 / @coderabbitai/cli 发布且 auth 确认 / 其他官方可安装引擎出现）——届时新派单重走全 wizard，supersede-not-delete。
- **Owner 应知悉代价**：管线维持无机器可验 review 引擎状态，review 停留 EA-1"提及"级；差距属生态面缺失（宿主子代理不可 spawn / 官方 CLI 未发布），非本方可安装修复。

## 四、回归三件 + 零漂移机证

- 开工 preflight：**8 PASS / 0 FAIL / 0 SKIP**（precheck-preflight.txt）
- 收口 regression-all：**14 PASS / 0 FAIL**（post-probe-regression-all.txt；S14 PASS，S15 占位照常）
- 收口 preflight：**8 PASS / 0 FAIL / 0 SKIP**（post-probe-preflight.txt）
- 收口 validate-structure：**0 警告**（post-probe-validate-structure.txt）
- **manifest hash 零漂移**：开工 sha256=d9f0d738… == 收口 sha256=d9f0d738…（零生产写面机证；本单无晋升 → 无 Gate-2 hash 重算面，现值即终值）

## 五、偏差登记（6 条，交 L2/Owner）

| id | 内容 | 状态 |
|---|---|---|
| D-1 | NO INSTALL（两候选 Failure Rule 3 命中）——迁移停 SHADOW 前，state 保持 ACTIVE；派单预声明分支如实执行，交编排者/Owner 裁定 | 已执行，待裁定 |
| D-2 | 锁面收窄：零生产写面仅锁证据 record 1 把（非 4 锁先例），收口 release | 登记待 L2 |
| D-3 | 夹具/expected-findings 结构性 BLOCKED（无新引擎可喂）非遗漏；危险文本 tar 归档先例未触发（无夹具） | 登记待 L2 |
| D-4 | change.record 未创建（CONTRACT 类归 L2/编排者；Owner 采纳 adapt 后按需补立；派单第 6 条属"若晋升"分支未触发） | 待 L2/Owner |
| D-5 | 宿主技能绑定文档化以草案落本单证据目录（正式化落位超白名单，需 Owner 授权） | 待 Owner |
| D-6 | step2-probe-b-coderabbit.txt 首行控制台 GBK mojibake（纯装饰性，证据实质 ASCII，未改原始捕获） | 备查 |

## 六、产物索引

- 迁移记录：test-reports/autopilot-work/AS-2-review/migration-record.json（ACTIVE 态 + no_install_verdict + deviations + regression）
- NO INSTALL 探测：step2-no-install-record.md + step2-probe-a-bugbot.txt + step2-probe-a2-bugbot-cli.txt + step2-probe-b-coderabbit.txt
- adapt 裁定材料：adaptation-adjudication.md（含宿主技能绑定文档化草案附录 A）
- 回归留档：precheck-preflight.txt + post-probe-{regression-all,preflight,validate-structure}.txt
- 写面：**零生产写面改动**（scripts/lib/adapters/ 零新增零修改；index.mjs / review.yaml / asset-manifest-v2.json 零触碰；vendor/ 零触碰；禁改面零触碰；禁 git 遵守）
