# AS-2-review Step 2 — NO INSTALL 探测记录（派单预声明风险分支）

> 探测时点：2026-09-25T09:40–09:46Z｜执行：autopilot L1（AS-2-review-dispatch）
> 判定权威：plans/asset-migration-playbook.md §四 Failure Rule 3（provider identity 三件套缺一 = NO INSTALL）
> 原始输出：step2-probe-a-bugbot.txt / step2-probe-a2-bugbot-cli.txt / step2-probe-b-coderabbit.txt（注：probe-b 文件首行为控制台 GBK 回显产生的 mojibake，纯装饰性；证据实质均为 ASCII，未改动原始捕获）

## 候选 A：review-bugbot（宿主侧技能，C:\Users\Administrator\.agents\skills\review-bugbot）

| 三件套 | 实测 | 结论 |
|---|---|---|
| official_source | 本地宿主技能文件（非安装资产，无上游 source 可指向） | **缺** |
| install_channel | 无——宿主侧托管，无 npm/pip/clone 通道 | **缺** |
| runtime_test | **不可行**——目录穷举（-laR + 7 类可执行/脚本扩展名 find + package.json 搜索）仅得 `SKILL.md`（4902 bytes）一个文件；`where bugbot` 无此命令 | **缺** |

**结构性裁定**：SKILL.md 语义 = 指示**交互宿主**启动一个 `subagent_type: "bugbot"` 的宿主子代理（原文："Launch exactly one `bugbot` subagent"）。管线 adapter 契约（playbook §一 provider_identity 三件套形态：`<cli> --version` 可跑、可 spawn、exit code + 机器可读输出）要求的是**进程**；宿主子代理机制不是进程，不能被 child_process spawn。技能目录、宿主 skills 目录（仅 review / review-bugbot / review-security / source-command-code-review 四个 SKILL 型条目）、PATH 三处均无任何可执行入口。
→ 要"接入"只能自研 wrapper 把 prompt 指令伪造成引擎输出——派单明令禁止（"禁止为凑 replace 而自研 wrapper 假装接入"）。**NO INSTALL**。

## 候选 B：CodeRabbit CLI（npm 通道）

| 三件套 | 实测 | 结论 |
|---|---|---|
| official_source | `github:coderabbitai/*` 官方 org 存在（npm scope 实证：@coderabbitai/carrot-ui、@coderabbitai/config 维护者均为 @coderabbit.ai 官方邮箱） | 在 |
| install_channel | 派单指定探测通道 `npx @coderabbitai/cli` → **npm registry E404**（"Not found"）；`where coderabbit` 未安装；`npm search coderabbit` 全量检索**无官方 CLI 包**——registry 仅有第三方个人 wrapper（coderabbitai-mcp / coderabbit-cli-mcp，MIT，个人维护者，非官方） | **缺** |
| runtime_test | 不可行——包不存在无从安装，无 `--version` 可跑 | **缺** |

**补充事实**：官方 scope 真实存在而 cli 包未发布 = 通道死而非名称错；第三方 wrapper 按 npm 假包教训（AS-0：package name ≠ capability）一律禁用作替代。派单预声明的第二独立阻断（SaaS 需 auth，AS-0 未确认）因 install 已失败未达运行时门，留档备查。
→ **NO INSTALL**。

## 汇总裁定

**两条候选均 NO INSTALL（Failure Rule 3 命中）** → 按派单 §⚠ 预声明分支执行：

1. 迁移**停在 SHADOW 之前**：state_machine.current_state 保持 **ACTIVE**，ACTIVE→SHADOW 转移不达成（SHADOW 前置=影子跑夹具就位，而影子跑需要新引擎真实执行；无引擎即无影子对象——契约 §一转移条件结构性不满足）。
2. Step 3–9（旧引擎实测/差异表/影子跑/回滚演练/晋升链/晋升前后回归）全部 **BLOCKED_NO_INSTALL**，不产出、不假造。
3. 合法产出 = **adapt 而非 replace 的裁定材料**（adaptation-adjudication.md）交编排者/Owner。
4. 零生产写面：不创建 scripts/lib/adapters/review-bugbot.mjs（无引擎可驱动，创建即假接入）、不动 index.mjs / review.yaml / manifest；manifest 现值 hash d9f0d738… 预期收口时不变。
