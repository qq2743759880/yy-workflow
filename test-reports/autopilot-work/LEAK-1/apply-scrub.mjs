/** LEAK-1 scrub 执行器：字面量 find/replace + 次数断言（两遍式：先全量校验再写盘，可安全重跑）。
 * 占位符：«B» = 一个反斜杠，«Q» = 一个双引号。 */
import fs from 'node:fs';

const BS = String.fromCharCode(92);
const x = (s) => s.split('«B»').join(BS).split('«Q»').join('"');

const ROOT = 'D:/.ai-hub/skills/yy';
const EDITS = [
  ['docs/DEPENDENCY-AUDIT.md', [
    ['D:«B».ai-hub«B»thirdparty«B»venv-*', '~/.ai-hub/thirdparty/venv-*'],
    ['D:«B».ai-hub«B»thirdparty«B»node_modules', '~/.ai-hub/thirdparty/node_modules'],
    ['C:«B»Users«B»Administrator«B»go«B»bin', '~/go/bin'],
  ]],
  ['docs/history/COMPETITOR-DEPLOYMENT.md', [
    ['D:«B».ai-hub«B»thirdparty«B»muse-autoskill', '~/.ai-hub/thirdparty/muse-autoskill'],
    ['D:«B».ai-hub«B»thirdparty«B»node_modules', '~/.ai-hub/thirdparty/node_modules'],
    ['D:«B».ai-hub«B»thirdparty«B»', '~/.ai-hub/thirdparty/'],
    ['D:«B».ai-hub', '~/.ai-hub'],
    ['C:«B»Users«B»Administrator«B»go«B»bin«B»gitleaks.exe', '~/go/bin/gitleaks.exe'],
  ]],
  ['docs/history/OPTIMIZATION.md', [
    ['（无 `D:«B»` / `/Users/` / `Administrator`）', '（无盘符绝对路径 / 用户目录绝对路径 / 本机用户名）'],
    ['`/Users/lingzhi/...`', '`/Users/<user>/...`'],
    ['### 7.1 资产盘点（D:«B».ai-hub）', '### 7.1 资产盘点（~/.ai-hub）'],
    ['C:«B»Users«B»Administrator«B».claude«B»plugins«B»sdlc', '~/.claude/plugins/sdlc'],
    ['在全 D:«B».ai-hub 均不存在', '在全 ~/.ai-hub 均不存在'],
  ]],
  ['docs/history/RELEASE.md', [
    ['（无 `D:«B»` / `/Users/` / `Administrator`）', '（无盘符绝对路径 / 用户目录绝对路径 / 本机用户名）'],
  ]],
  ['docs/history/specs/HANDOFF-PROMPT.md', [
    ['都不得出现 `D:«B»`、`C:«B»Users«B»` 等本机绝对路径', '都不得出现盘符绝对路径、`C:` 盘 Users 目录等本机绝对路径'],
  ]],
  ['docs/history/specs/P1-report.md', [
    ['D:«B».ai-hub«B»skills«B»tt', '~/.ai-hub/skills/tt'],
  ]],
  ['docs/history/specs/T16-SKILLOPS-report.md', [
    ['资产库: D:«B».ai-hub«B»skills«B»tt«B»vendor', '资产库: ~/.ai-hub/skills/tt/vendor'],
  ]],
  ['docs/history/specs/VERIFY-2.9.0-report.md', [
    ['repo `D:«B».ai-hub«B»skills«B»tt`', 'repo `~/.ai-hub/skills/tt`'],
    ['（`C:«B»Users«B»Administrator«B»AppData«B»Local«B»Temp«B»opencode«B»tt-verify-2.9.0«B»`）', '（`<TEMP>/opencode/tt-verify-2.9.0/`）'],
  ]],
  ['docs/history/specs/dev-planner-optimization-prd.md', [
    ['（禁 `D:«B»`/`C:«B»Users`/`Administrator` 等绝对路径）', '（禁盘符绝对路径、`C:` 盘 Users 目录、本机用户名等泄露）'],
    ['grep 无 `D:«B»`、`C:«B»Users`、`/Users/`、`/home/` 绝对路径', 'grep 无盘符绝对路径、`C:` 盘 Users 目录、`/Users/`、`/home/` 绝对路径'],
  ]],
  ['docs/history/specs/muse-tt-fusion-plan.md', [
    ['D:«B».ai-hub«B»thirdparty«B»muse-autoskill', '~/.ai-hub/thirdparty/muse-autoskill'],
  ]],
  ['docs/history/specs/thirdparty-replacement-plan.md', [
    ['D:«B».ai-hub«B»thirdparty«B»node_modules', '~/.ai-hub/thirdparty/node_modules'],
    ['D:«B».ai-hub«B»thirdparty', '~/.ai-hub/thirdparty'],
  ]],
  ['docs/history/tasks/BE-12-regression-integration.md', [
    ['C:/Users/Administrator/.workbuddy/skills/skillops', '~/.workbuddy/skills/skillops'],
    ['写入 `D:«B»` 绝对路径', '写入盘符绝对路径'],
  ]],
  ['docs/history/tasks/FE-06-manifest-and-validator-update.md', [
    ['（如 `D:«B»`、`C:«B»Users«B»`）', '（如盘符绝对路径、`C:` 盘 Users 目录）'],
  ]],
  ['docs/history/tasks/reports/A1-report.md', [
    ['/c/Users/Administrator/AppData/Roaming/npm/portman', '~/AppData/Roaming/npm/portman'],
  ]],
  ['docs/history/tasks/reports/A2-kickoff.md', [
    ['node D:«B».ai-hub«B»skills«B»tt«B»scripts«B»orchestrator.mjs', 'node ~/.ai-hub/skills/tt/scripts/orchestrator.mjs'],
    ['D:«B».ai-hub«B»skills«B»tt«B».claude«B»specs«B»tasks«B»reports«B»A2-report.md', '~/.ai-hub/skills/tt/.claude/specs/tasks/reports/A2-report.md'],
  ]],
  ['docs/history/tasks/reports/A2-report.md', [
    ['`C:«B»Users«B»Administrator«B».openclaw«B»workspace«B»tmp«B»tt-a2`', '`~/.openclaw/workspace/tmp/tt-a2`'],
    ['node D:«B».ai-hub«B»skills«B»tt«B»scripts«B»orchestrator.mjs', 'node ~/.ai-hub/skills/tt/scripts/orchestrator.mjs'],
    ['--workspace C:«B»Users«B»Administrator«B».openclaw«B»workspace«B»tmp«B»tt-a2', '--workspace ~/.openclaw/workspace/tmp/tt-a2'],
  ]],
  ['docs/history/tasks/reports/B1-report.md', [
    ['`D:«B».ai-hub«B»thirdparty«B»venv-gpt-researcher`', '`~/.ai-hub/thirdparty/venv-gpt-researcher`'],
  ]],
  ['docs/history/tasks/reports/B12-kickoff.md', [
    ['D:«B».ai-hub«B»skills«B»tt«B».claude«B»specs«B»tasks«B»task-B1-gpt-researcher.md', '~/.ai-hub/skills/tt/.claude/specs/tasks/task-B1-gpt-researcher.md'],
    ['python -m venv D:«B».ai-hub«B»thirdparty«B»venv-gpt-researcher', 'python -m venv ~/.ai-hub/thirdparty/venv-gpt-researcher'],
    ['python -m venv D:«B».ai-hub«B»thirdparty«B»venv-metagpt', 'python -m venv ~/.ai-hub/thirdparty/venv-metagpt'],
    ['D:«B».ai-hub«B»skills«B»tt«B».claude«B»specs«B»tasks«B»reports«B»B1-report.md', '~/.ai-hub/skills/tt/.claude/specs/tasks/reports/B1-report.md'],
  ]],
  ['docs/history/tasks/reports/B2-report.md', [
    ['`D:«B».ai-hub«B»thirdparty«B»venv-metagpt`', '`~/.ai-hub/thirdparty/venv-metagpt`'],
  ]],
  ['docs/history/tasks/reports/C08-kickoff.md', [
    ['D:«B»«B».ai-hub«B»«B»skills«B»«B»tt«B»«B»scripts«B»«B»lib«B»«B»adapters«B»«B»portman.mjs', '~/.ai-hub/skills/tt/scripts/lib/adapters/portman.mjs'],
    ['D:«B»«B».ai-hub«B»«B»skills«B»«B»tt«B»«B».claude«B»«B»specs«B»«B»tasks«B»«B»task-C08-portman.md', '~/.ai-hub/skills/tt/.claude/specs/tasks/task-C08-portman.md'],
  ]],
  ['docs/history/tasks/reports/T1-report.md', [
    ['（D:«B» ...«B»hermes«B»bin«B»uv.exe）', '（~/.ai-hub/.../hermes/bin/uv.exe）'],
    ['`D:«B».ai-hub«B»thirdparty«B»venv-gpt-researcher`', '`~/.ai-hub/thirdparty/venv-gpt-researcher`'],
    ['`D:«B».ai-hub«B»thirdparty«B»venv-metagpt`', '`~/.ai-hub/thirdparty/venv-metagpt`'],
    ['`D:«B».ai-hub«B»thirdparty«B»venv-crewai-py311`', '`~/.ai-hub/thirdparty/venv-crewai-py311`'],
  ]],
  ['docs/history/tasks/reports/T3-report.md', [
    ['`D:«B».ai-hub«B»skills«B»tt«B»vendor«B»frontend-design«B»SKILL.md`', '`~/.ai-hub/skills/tt/vendor/frontend-design/SKILL.md`'],
    ['写死的 `D:«B».ai-hub«B»...` 绝对路径', '写死的机器绝对路径'],
    ['node D:«B».ai-hub«B»skills«B»tt«B»scripts«B»validate-structure.mjs', 'node ~/.ai-hub/skills/tt/scripts/validate-structure.mjs'],
  ]],
  ['docs/history/tasks/reports/T5-report.md', [
    ['`D:«B».ai-hub«B»thirdparty«B»node_modules`', '`~/.ai-hub/thirdparty/node_modules`'],
  ]],
  ['docs/history/tasks/reports/T7-report.md', [
    ['（已解析为 D:«B».ai-hub«B»skills«B»tt«B»docs«B»examples«B»nope.json）', '（已解析为 ~/.ai-hub/skills/tt/docs/examples/nope.json）'],
    ['plan-mtinmgyv-3 -> D:«B».ai-hub«B»skills«B»tt«B»docs«B»examples«B»openapi-login.sample.json', 'plan-mtinmgyv-3 -> ~/.ai-hub/skills/tt/docs/examples/openapi-login.sample.json'],
    ['D:«B»«B».ai-hub«B»«B»skills«B»«B»tt«B»«B»docs«B»«B»examples«B»«B»openapi-login.sample.json', '~/.ai-hub/skills/tt/docs/examples/openapi-login.sample.json'],
  ]],
  ['docs/history/tasks/reports/T8-report.md', [
    ['`D:«B».ai-hub«B»skills«B»tt«B»CHANGELOG.md`', '`~/.ai-hub/skills/tt/CHANGELOG.md`'],
    ['`C:«B»Users«B»Administrator«B»AppData«B»Local«B»Temp«B»opencode«B»dedup-changelog.mjs`', '`<TEMP>/opencode/dedup-changelog.mjs`'],
  ]],
  ['docs/history/tasks/task-B1-gpt-researcher.md', [
    ['`python -m venv D:«B».ai-hub«B»thirdparty«B»venv-gpt-researcher«B»`', '`python -m venv ~/.ai-hub/thirdparty/venv-gpt-researcher/`'],
  ]],
  ['docs/history/tasks/task-B2-metagpt.md', [
    ['`python -m venv D:«B».ai-hub«B»thirdparty«B»venv-metagpt«B»`', '`python -m venv ~/.ai-hub/thirdparty/venv-metagpt/`'],
  ]],
  ['docs/history/tasks/task01-a6api-host.md', [
    ['为 TT 仓库（D:«B».ai-hub«B»skills«B»tt）实现', '为 TT 仓库（~/.ai-hub/skills/tt）实现'],
    ['读 spec：D:«B».ai-hub«B»skills«B»tt«B».claude«B»specs«B»tasks«B»task01-a6api-host.md', '读 spec：~/.ai-hub/skills/tt/.claude/specs/tasks/task01-a6api-host.md'],
  ]],
  ['prototypes/yy-workflow-panel/index.html', [
    ['--workspace D:«B»«B»«B»«B».ai-hub«B»«B»«B»«B»skills«B»«B»«B»«B»yy --task M3', '--workspace <workspace> --task M3'],
    ['<span>D:«B»«B».ai-hub«B»«B»skills«B»«B»yy</span>', '<span>~/.ai-hub/skills/yy</span>'],
    ['input value=«Q»D:«B»«B».ai-hub«B»«B»skills«B»«B»yy«Q»', 'input value=«Q»~/.ai-hub/skills/yy«Q»'],
  ]],
  ['vendor/frontend-design/reference/design-data/data/stacks/avalonia.csv', [
    ['C:«B»Users«B»data«B»config.json', 'C:«B»ProgramData«B»MyApp«B»config.json'],
  ]],
  ['vendor/frontend-design/reference/design-data/scripts/validate_data.py', [
    ['data integrity issue(s) found:«B»n")', 'data integrity issue(s) found:", end="«B»n«B»n")'],
  ]],
];

const failures = [];
const summary = [];
// 第一遍：全量校验字面量可命中，任一未命中则整体不写盘（可安全重跑）
const pending = [];
for (const [rel, pairs] of EDITS) {
  const p = ROOT + '/' + rel;
  let text = fs.readFileSync(p, 'utf8');
  let applied = 0;
  for (const [find, replace] of pairs) {
    const f = x(find);
    const parts = text.split(f);
    if (parts.length < 2) { failures.push(`${rel}: 未找到字面量 ${JSON.stringify(find.slice(0, 80))}`); continue; }
    text = parts.join(x(replace));
    applied += parts.length - 1;
  }
  pending.push([p, text, applied, rel]);
}
if (failures.length === 0) {
  for (const [p, text, applied, rel] of pending) { fs.writeFileSync(p, text); summary.push(`${rel}: ${applied} 处替换`); }
}
console.log(summary.join('\n'));
if (failures.length) { console.error('\nFAILURES:\n' + failures.join('\n')); process.exit(1); }
console.log('\nALL OK');
