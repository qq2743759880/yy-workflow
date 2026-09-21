# 修复记录：junction 部署静默失效（2026-09-21，盲测预跑发现）

## 坑（盲行者实测 + 编排者复现）

**现象**：经 `C:/Users/Administrator/.agents/skills/yy`（mklink junction → yy-release）调用
任何 CLI（tt-journey/executor-setup/review-gate/tt-tui）→ **exit 0、零输出、零副作用**。
盲行者烧掉约 4 分钟调试（rollout sess_268a7a12 03:13-03:17），会话最终未完成（配额超限），
session-notes.md 未写成。

**根因**：`const isMain = process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])`
—— junction 安装形态下 `import.meta.url` 被 Node 解析到**真实路径**（`D:\...\yy-release\...`），
而 `process.argv[1]` 保持**安装路径**（`C:\Users\...\.agents\skills\yy\...`）→ 永不相等 →
main() 永不执行 → 静默退出。违反项目 fail-closed 纪律（exit 0 零输出是最坏失败模式）。

**修复**（4 文件）：`isMainFileMatch()`——两侧 `fs.realpathSync` 归一后比较；
tt-journey/tt-tui/executor-setup/review-gate 全部替换；executor-setup 顺带补
`fileURLToPath` import（修复过程中 try/catch 吞 ReferenceError 的二段教训：**防御性
catch 不得包住 import 缺失类编程错误**）。

## 回归探针

`junction-smoke.mjs`：经 junction 绝对路径调用 4 个 CLI，断言 stdout 非空（main 存活）。
此探针只在"安装形态存在"时可跑（junction 缺失则 SKIP），开发仓回归不覆盖本场景
（它在真实路径上恒真），故单列。

## 遗留

- 坑#2（P0，待修）：命令文件首行指令缺 `--workspace` → prereq-check 读技能目录的
  .tt-state（截图证据）；修法候选：命令文件统一 `--workspace "$PROJECT_ROOT"` 或
  tt-journey 支持 `YY_WORKSPACE` env。纳入 BW-1 正式修复批。
- 坑#3（P2）：权限确认摩擦（每命令一次）。
- 坑#4（P2，协议）：盲行者可能烧完配额没写 session-notes → Owner 收报告时须同时收集
  会话总结文本；编排者可从 zcode 日志+db 自行取证（本次已示范）。
