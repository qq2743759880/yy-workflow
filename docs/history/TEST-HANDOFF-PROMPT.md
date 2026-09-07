# TT 测试交接 Prompt —— execution-trust + Phase 2 替换独立验收

> 用途：把本文件完整投喂给任意独立 agent（Claude Code / Codex / opencode / 另一会话）做**批判性验收**。
> 验收对象：TT 仓库工作树当前状态（基线 `cbd0868` + 未提交增量）。
> 原则：**不信任任何验收报告**（包括 `ACCEPTANCE-REPORT-PHASE2.md`），全部命令独立重跑 + 代码审读；重点不是「能不能跑」，而是「设计是否成立、有没有假成功、替换是否真替换」。

---

## 0. 你的角色

你是独立验收员，不是开发者的帮手。以下两条自述**请当作待证伪的假设**：

1. 「契约冻结已机器化：`contracts/<planId>.json` + gate 执行期 hash 比对 + 篡改 exit 4」
2. 「`--exec` 宿主通道已用真实 LLM 验证，execution 判定诚实（写文件型/空输出均正确处理）」
3. 「Phase 2 三个高杠杆资产已对齐竞品内核（implementation→opencode / sdlc→BMAD+cline / be-validator→portman）」

## 1. 验收对象与范围

- 仓库：`<TT_REPO>`（Windows，PowerShell；`<TT_REPO>` = tt skill 目录）
- 关键文件：`scripts/orchestrator.mjs`、`scripts/regression-all.mjs`、`scripts/lib/{gate,asset,planner,runtime,report}.mjs`、`scripts/lib/adapters/{prompt,bmad-cline,portman}.mjs`、`vendor/{implementation/implementation.md, sdlc/SKILL.md, be-validator/be-validator.md}`
- 只读复现：`git -C <TT_REPO> status --short`（工作树含未提交改动 + 新增文件，具体数以 git status 为准）

## 2. 预设批判点（逐条验证或推翻，给证据）

1. **契约 gate 是否被蒙混？** gate json 模式对「执行期删契约」「执行期改契约成非法 JSON」「执行期正常不变」三种情况分别如何？`--dry-run` 是否真不写契约文件？执行**前**已篡改的契约会不会被误报？（判断：后两者是否按设计区分）
2. **execution 判定是否诚实且不误判？** ①stdout 型宿主 `mode=exec` ②写文件型宿主（stdout 空但有非 brief 文件）`mode=exec` ③空宿主 `mode=prompt` 降级 ④超时宿主（`--exec-timeout`）是否快速降级不挂起。有无「假 exec」（例如 host 写了无关文件被误判）？
3. **Phase 2 替换是否真替换，还是只改字面？** 读 3 个资产正文：执行契约是否可执行（探测/产物/降级）、有无编造 flag、「以 --help 为准」是否诚实。S3 漂移门是否**足够强**（marker 只是关键字 contains，还是真能拦住内核漂移）？
4. **资产缓存是否有误命中风险？** 签名 = manifest generatedAt + 路由资产 mtime/size。touch 一个**不在路由集**里的 vendor 文件，缓存是否错误命中（应否失效）？`--dry-run` 是否不写缓存？
5. **resume 是否丢信息？** 混合 plan 只重试 skipped/failed（done 的 attempts 不增）；全 done 直接出报告；`--resume --dry-run` 互斥 exit 2。报告 subtasks 是否完整。
6. **参数面**：`--backend` 缺值/非法、`--exec-timeout` 非正整数、`--max-retries` 负数/NaN，是否全部 exit 2。
7. **可移植性**：部署面（SKILL/README/ONBOARDING/templates/scripts/**）0 U+FFFD、0 路径泄露；整目录拷到 `%TEMP%` 后 `regression-all` 是否仍 6/6。**实测基线：字节级（EF BF BD）全仓 0 FFFD**——若你发现任何 FFFD 字节，反而要重点报告（此前曾因 UTF-8 解码误报 GBK 历史文档为损坏）。

## 3. 必跑命令与期望输出（对照记录实际输出）

```powershell
cd <TT_REPO>

# 1) 一键回归：期望 6 PASS / 0 FAIL，exit 0
node scripts/regression-all.mjs

# 2) 契约 gate 三态（每次清理）
Remove-Item -Recurse -Force artifacts,.tt-state,contracts -ErrorAction SilentlyContinue
node scripts/orchestrator.mjs --task "backend login module"   # exit 0，contracts/<planId>.json 存在
node scripts/orchestrator.mjs --resume                        # remaining=2（仅重试 skipped）
# 篡改：exec 内 append 契约文件 → 期望 contract violation、exit 4
node scripts/orchestrator.mjs --task "backend login module" --exec node -e "const p=require('path'),fs=require('fs');fs.appendFileSync(p.join('contracts',p.basename(p.dirname(process.argv[1])).replace(/-\d+$/,'')+'.json'),'//tampered')"
# 期望 exit=4；exit 非 4 即批判点 1 成立

# 3) exec 判定三态
Remove-Item -Recurse -Force artifacts,.tt-state,contracts -ErrorAction SilentlyContinue
node scripts/orchestrator.mjs --task "backend login module" --exec node -e "console.log('x')"
#   期望 state.json modes.exec>0
node scripts/orchestrator.mjs --task "backend login module" --exec node -e "const fs=require('fs'),p=require('path');fs.writeFileSync(p.join(p.dirname(process.argv[1]),'plan.md'),'#p')"
#   期望 modes.exec>0（写文件型，无 stdout）
node scripts/orchestrator.mjs --task "backend login module" --exec node -e ""
#   期望 modes.prompt>0 且 modes.exec 不存在（空输出降级）

# 4) 路由可达：期望 16/16
node -e "import('./scripts/lib/matrix.mjs').then(async ({CLUSTERS})=>{const {buildManifest}=await import('./scripts/lib/manifest.mjs');const m=await buildManifest({vendorDir:process.cwd()+'/vendor'});const names=new Set(m.entries.map(e=>e.name));const routed=new Set();for(const c of CLUSTERS)for(const n of c.candidates)if(names.has(n))routed.add(n);console.log(routed.size+'/'+names.size)})"

# 5) 参数面：全部期望 exit 2
node scripts/orchestrator.mjs --task x --backend
node scripts/orchestrator.mjs --task x --backend bogus
node scripts/orchestrator.mjs --task x --exec-timeout abc
node scripts/orchestrator.mjs --task x --max-retries -3

# 6) dry-run 零副作用：期望三者 False
node scripts/orchestrator.mjs --task "frontend page" --dry-run
Test-Path artifacts; Test-Path contracts; Test-Path .tt-state

# 7) 新鲜部署：拷贝到 %TEMP% 后从该目录跑 regression-all，期望 6/6
robocopy <TT_REPO> $env:TEMP\tt-handoff /E /XD .git artifacts .tt-state contracts node_modules /XF *.pyc
# 在该目录：node scripts\regression-all.mjs
```

## 4. 报告格式（投喂的 agent 按此输出）

```
# 独立验收报告：execution-trust + Phase 2
## 结论：PASS / PASS_WITH_ISSUES / FAIL（三选一，一句话理由）
## 逐批判点：每点 验证结果（成立/推翻/部分成立）+ 证据（命令输出或代码行号）+ 影响
## 假成功审查：是否存在任何「把没做标成做了」的路径？（重点查 execution 判定、gate 与 prompt 交互、S3 漂移门强度）
## 修复建议：P0/P1/P2 分级列出
```

## 5. 特别提醒

- 全程**只读源码**：允许运行编排命令（会写 `artifacts/`、`.tt-state/`、`contracts/`，均已 gitignore），但**不要修改任何源码/资产文件**；发现问题在报告中描述，不要顺手改。
- 每次跑完编排命令后清理：`Remove-Item -Recurse -Force artifacts,.tt-state,contracts`（在仓库内）。
- 关注「诚实性」多于「功能性」：编排系统的核心价值是**不撒谎**；execution 判定与契约 gate 是重点。
- 验收基准见 `ACCEPTANCE-REPORT-PHASE2.md`——把它当作待证伪的假设，不是答案。
