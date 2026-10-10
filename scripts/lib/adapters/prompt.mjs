import fs from 'node:fs/promises';
import path from 'node:path';
import { runCommand } from './util.mjs';
import { renderBrief } from '../activation.mjs';
import {prepareHostInput,executeEmbedded,briefOnly,dependencyPlan,methodologyDelivery,invokeAuthorizedHost,executionPolicy,materializeHostSources,snapshotExecutionFiles,isExecutionControlFile} from '../host-execution.mjs';
import {safeHostFile} from '../host-adapter.mjs';
export const name = 'prompt';
/**
 * 内置 Prompt 执行后端（P1-1 根治核心）。
 * 默认：把「资产方法论正文 + 父任务上下文 + 唯一子任务 + 独立验收 + 上游产物引用」
 * 组装为可独立消费的子任务执行指令包 brief.md，写入 artifacts/<subtaskId>/。
 * 可选宿主执行（消费链闭环）：配置 options.exec（命令数组）时，将 brief 路径作为最后一个
 * 参数投喂给任意显式配置的 executable，stdout 写 result.txt；
 * 宿主缺失或失败 → 诚实回落 brief-only（degraded），绝不假报执行成功。
 */
export async function run(subtask, ctx, options = {}) {
  const mode=executionPolicy(options);
  if(mode.resolved_delegation==='NATIVE_SUBAGENT')options={...options,host:options.nativeSubagent};
  if(!mode.automatic_dispatch_allowed)options={...options,executionMode:'BRIEF_ONLY',exec:null,provider:null,hosts:null,configHosts:null,host:null};
  if(!/^[a-z0-9][a-z0-9_.-]*$/i.test(subtask.id)||subtask.id.includes('..')) throw new Error('EXECUTION_SUBTASK_INVALID');
  if(options.executionMode&&!['HOST_NATIVE','EXTERNAL_PROVIDER','BRIEF_ONLY'].includes(options.executionMode)) throw new Error('EXECUTION_MODE_INVALID');
  const workspace = options.workspace || '.';
  safeHostFile(workspace,subtask.id);
  const assets = options.assets;
  const asset = assets ? assets.get(subtask.asset) : null;
  let body = asset && asset.body ? asset.body : '(资产正文缺失：该资产没有可加载的 SKILL.md / agent 正文)';
  const prior = [];
  if (ctx && typeof ctx.dump === 'function') {
    const dump = ctx.dump();
    for (const key of Object.keys(dump)) {
      if (key.startsWith('artifact:')) prior.push('- ' + key.slice('artifact:'.length) + ' → ' + dump[key]);
    }
  }
  const input=await prepareHostInput(subtask,body,subtask.upstreamRefs||prior.map(p=>p.replace(/^- /,'')),options);
  body=input.methodology_payload.content;
  // 资产根目录：供消费者解析正文中的相对引用（reference/*.md 等），避免悬空路径
  const assetRoot = (asset && asset.meta && asset.meta.path && options.assetsRoot)
    ? asset.meta.path
    : '(未知，见方法论正文的相对引用)';
  // 前置条件（T2 硬约束）：cluster 级结构化前置条件由 planner 写入 subtask.preconditions，
  // 派单前必须逐条满足（含资产消费证据）；空/旧 state 无该字段 → 不渲染该段（向后兼容）。
  const preconditions = Array.isArray(subtask.preconditions) && subtask.preconditions.length
    ? subtask.preconditions
    : (Array.isArray(options.preconditions) && options.preconditions.length ? options.preconditions : []);
  // B6：activation 产物组装路径（YY_ACTIVATION=lib 时由 runtime 注入 options.activationPackage）。
  // Both legacy and activation share the existing frame renderer. Runtime values
  // keep the sole child task, parent context and acceptance in separate sections.
  const useActivation = Boolean(options.activationPackage && options.activationPackage.briefFrame);
  let brief;
  if (useActivation) {
    const frame = Object.assign({}, options.activationPackage.briefFrame);
    frame.subtaskId = subtask.id;
    frame.task = input.parent_task;
    frame.parentTask = input.parent_task;
    frame.asset = subtask.asset;
    frame.assetRoot = assetRoot;
    frame.description = subtask.desc || subtask.task || subtask.contract || '(无)';
    frame.role = subtask.role || frame.role || null;
    frame.acceptanceCriteria = Array.isArray(subtask.acceptanceCriteria) ? subtask.acceptanceCriteria : frame.acceptanceCriteria || [];
    frame.contract = subtask.contract || '(无)';
    frame.upstreamRefs = prior.map(function(p) { return p.replace(/^- /, ''); });
    frame.preconditions = preconditions;
    frame.bodyContent = body;
    brief = renderBrief(frame);
    // B6：journey copyNextPrompt 快照引用注入（仅在调用方显式提供 options.nextPrompt 时追加；
    // 复制 = 快照引用不重算，recompute 恒 false——journey.copyNextPrompt 语义）。
    if (options.nextPrompt && typeof options.nextPrompt === 'object') {
      const np = options.nextPrompt;
      const lines = ['', '---', '', '## 下一步提示（journey 快照引用，不重算）'];
      if (np.actionHint) lines.push('- actionHint: ' + np.actionHint);
      if (np.targetNode) lines.push('- targetNode: step ' + (np.targetNode.step === undefined ? '?' : np.targetNode.step) + ' ' + (np.targetNode.name || ''));
      if (Array.isArray(np.requiredInputs) && np.requiredInputs.length) lines.push('- requiredInputs: ' + np.requiredInputs.join('; '));
      if (np.snapshotRef) lines.push('- snapshotRef: ' + JSON.stringify(np.snapshotRef));
      brief += '\n' + lines.join('\n');
    }
  } else {
    brief = renderBrief({ subtaskId:subtask.id, parentTask:input.parent_task,
      description:subtask.desc || subtask.task || subtask.contract || '(无)', asset:subtask.asset,
      assetRoot, role:subtask.role || null, contract:subtask.contract || '(无)',
      acceptanceCriteria:subtask.acceptanceCriteria || [], upstreamRefs:prior.map(p => p.replace(/^- /,'')),
      preconditions, bodyContent:body });
  }
  const dir = path.join(workspace, 'artifacts', subtask.id);
  const briefPath = path.join(dir, 'brief.md');
  await fs.mkdir(dir, { recursive: true });
  if(mode.automatic_dispatch_allowed){
    const refs=await materializeHostSources(subtask,input,options);
    input.source_files=refs;
    if(refs.length)brief+='\n\n## 可读取的固定原件（workspace 相对路径；不是追加任务）\n'+refs.map(r=>'- '+r.source_id+' → '+r.relative_path+'; sha256 '+r.raw_sha256).join('\n');
  }
  await fs.writeFile(briefPath, brief);
  const briefArtifact = path.join('artifacts', subtask.id, 'brief.md');
  await fs.writeFile(path.join(dir,'execution-package.json'),JSON.stringify({schema:'yy/host-execution@1',input,dependencies:dependencyPlan(input),
    authority:{decision_authority_digest:options.decisionAuthorityDigest||options.decisionPacket?.data?.authority?.decision_authority_digest||null}},null,2)+'\n');
  if(options.executionMode==='BRIEF_ONLY') return briefOnly(briefArtifact,mode.reason_codes[0]||'Host explicitly requested BRIEF_ONLY');
  if(options.provider) {
    const {EXTERNAL_PROVIDERS}=await import('./index.mjs');
    const provider=(options.providers||EXTERNAL_PROVIDERS).get(options.provider);
    if(!provider?.adapter) return {ok:false,status:'FAILED',executed:false,error:'PROVIDER_UNKNOWN'};
    const result=await invokeAuthorizedHost(subtask,brief,options,()=>provider.adapter.run({...subtask,task:brief},ctx,{...options,executionInput:input}));
    if(result.ok&&!result.assetConsumed) return briefOnly(briefArtifact,'external provider produced no execution evidence');
    return {...result,status:result.ok?'EXECUTED':'FAILED',executed:result.ok===true&&!!result.assetConsumed,
      executionMode:'EXTERNAL_PROVIDER',provider:options.provider,artifacts:result.artifactPath?[result.artifactPath]:[],evidence:{methodology_delivery:methodologyDelivery(input,result.ok===true&&!!result.assetConsumed)},methodology_application:'UNVERIFIED'};
  }
  if(options.executionMode!=='EXTERNAL_PROVIDER'&&(options.executionMode==='HOST_NATIVE'||!options.exec?.length)&&typeof options.host?.execute==='function')
    return invokeAuthorizedHost(subtask,JSON.stringify(input),options,()=>executeEmbedded(input,{...options,workspace,subtaskId:subtask.id,subtask,host:options.host}));
  if(options.executionMode==='HOST_NATIVE') return briefOnly(briefArtifact);
  // 可选宿主执行：options.exec = [program, ...args]，brief 绝对路径作为最后一个参数追加
  const execArgs = options.exec;
  if (Array.isArray(execArgs) && execArgs.length) {
    const before=await snapshotExecutionFiles(dir);
    // P2 修复：清空上次 attempt 遗留的宿主产物（resume/retry 不得继承陈旧证据）
    try {
      for (const f of await fs.readdir(dir)) {
        if(f==='sources'||isExecutionControlFile(f))continue;
        const file=path.join(dir,f),st=await fs.lstat(file);if(st.isSymbolicLink())throw new Error('EXECUTION_ARTIFACT_INVALID');
        if(st.isFile())await fs.rm(file,{force:true});
      }
    } catch (error) { throw error; }
    const execResult = await invokeAuthorizedHost(subtask,brief,options,()=>runCommand(execArgs[0], execArgs.slice(1).concat([briefPath]), {
      workspace, timeoutMs: options.execTimeoutMs, timeoutCode: 'EXEC_TIMEOUT', notAvailableCode: 'EXEC_NOT_AVAILABLE', subtask,
    }));
    if (execResult.ok) {
      // 执行真实性校验（BE-14）：真实 agent 宿主把结果写入 subtask 产物目录（文件）而非 stdout。
      // 资产消费证据（硬约束，P1 修复）：指纹用资产正文首标题锚点（高熵，防 security/review 等
      // 低熵资产名被正常措辞碰巧命中）；产物须含锚点才记 assetConsumed=true。
      const anchor = (asset && asset.body && (asset.body.match(/^#{1,6}\s+(.+)$/m) || [])[1])
        ? asset.body.match(/^#{1,6}\s+(.+)$/m)[1].trim()
        : String(subtask.asset);
      const anchorLower = String(anchor).toLowerCase();
      // kernel 词（D-1 强化，P1 修复）：资产有 Execution kernel 段时，产物须含锚点 且 ≥1 内核词。
      // 提取规则：Kernel: 行内 ASCII 工具 token（反引号或含 ./_- 的 ≥3 字符 token），过滤虚词；
      // 兼容中文开头 Kernel 行（be-validator/skill-sentinel 等在役资产），不再静默回落锚点即可。
      const hasKernelSection = Boolean(asset && asset.body && /^#{1,6}\s+Execution kernel/im.test(asset.body));
      const VIRTUAL = /^(via|the|and|for|of|to|in|is|or|not|with|as|at|by|hub|uses|layer)$/i;
      const kernelLine = asset && asset.body ? ((asset.body.match(/## Execution kernel[\s\S]*?Kernel:\s*([^\n]+)/) || [])[1] || '') : '';
      const kernelTokens = [...new Set((kernelLine.match(/`([A-Za-z][A-Za-z0-9._/-]{2,})`|([A-Za-z][A-Za-z0-9._/-]{2,})/g) || [])
        .map((t) => t.replace(/`/g, '').toLowerCase())
        .filter((t) => t.length >= 3 && !VIRTUAL.test(t)))];
      let hasRealOutput = false;const artifacts=[],proof=[];
      let assetConsumed = false;
      try {
        const files = await snapshotExecutionFiles(dir);
        for (const [file,digest] of files) {
          const f=path.basename(file);if(before.get(file)===digest)continue;
          // 交付物命名白名单：防无关文件（junk.tmp 等）伪造 exec；且要求内容 trim 后非空（纯空白不算产出）。
          if (!/\.(md|json|yaml|yml)$/.test(f)) continue;
          try {
            const txt = (await fs.readFile(file, 'utf8'));
            if (txt.trim()) {
              hasRealOutput = true;
              const relative=path.relative(workspace,file).split(path.sep).join('/');artifacts.push(relative);proof.push({path:relative,sha256:digest});
              const lower = txt.toLowerCase();
              // D-1：kernel 资产须锚点 AND ≥1 内核词；kernel 段存在但无可提取内核词（如 Kernel 行以中文起始）
              // → 回落锚点即可（不卡死合法消费，也不放松有内核词的资产）
              if (hasKernelSection && kernelTokens.length) assetConsumed = lower.includes(anchorLower) && kernelTokens.some((k) => lower.includes(k));
              else assetConsumed = lower.includes(anchorLower);
            }
          } catch (error) { /* 读不到跳过 */ }
        }
      } catch (error) { throw error; }
      if (!hasRealOutput && execResult.artifactPath&&execResult.stdout?.trim()&&execResult.stdout.trim()!=='completed') {
        hasRealOutput=true;artifacts.push(execResult.artifactPath);
      }
      if (hasRealOutput) return { ok: true,status:'EXECUTED',executionMode:'EXTERNAL_PROVIDER',provider:'generic-host',artifacts,evidence:{artifacts:proof,methodology_delivery:methodologyDelivery(input,true)}, artifactPath:artifacts[0], executed: true, assetConsumed,methodology_application:'UNVERIFIED' };
      return briefOnly(briefArtifact,'executor empty output: no real artifact produced');
    }
    return briefOnly(briefArtifact,'executor unavailable/failed: '+(execResult.error||'unknown'));
  }
  return briefOnly(briefArtifact);
}
export default { name, run };
