export const GUIDE_CONTENT = {
  "generatedBy": "scripts/build-guide-content.mjs",
  "phases": [
    {
      "step": 0,
      "journeyStep": 0,
      "name": "立项 / 资产整合",
      "goal": "一句话定边界，盘点资产与平台，只做需求澄清 + 概念版，不拆任务不写代码。",
      "summary": "阶段 0 立项/资产整合。触发词「/yy 0」「注入阶段 0 prompt」「立项」「资产整合」。 首行指令：先跑 `node \"$SKILL_DIR/scripts/host-adapter.mjs\" prepare --workspace \"$PROJECT_ROOT\" --session <session> --intent \"/yy 0\" --subtask-id <id> --save` 展示包，仅 `ok",
      "assets": [],
      "discipline": [
        "读取 commands/yy-0-init.md 的边界、产物与方法指针；宿主准入以其首行指令为准。"
      ],
      "kickPrompt": "请读取 commands/yy-0-init.md；先按其首行 host-adapter.mjs 指令展示并消费 Decision Packet，再按本阶段目标工作。",
      "redoPrompt": "重新走 /yy 0：读取 commands/yy-0-init.md，重新按其首行 host-adapter.mjs 指令准备并复核 Decision Packet。"
    },
    {
      "step": 1,
      "journeyStep": 1,
      "name": "需求挖掘",
      "goal": "你当唯一事实源，按 forcing-questions 逐轮追问（每次 ≤2 题），产出概念版并签收后才进下一步。",
      "summary": "阶段 1 需求挖掘。触发词「/yy 1」「注入阶段 1 prompt」「需求挖掘」「挖掘需求」。 首行指令：先跑 `node \"$SKILL_DIR/scripts/host-adapter.mjs\" prepare --workspace \"$PROJECT_ROOT\" --session <session> --intent \"/yy 1\" --subtask-id <id> --save` 展示包，仅 `ok",
      "assets": [],
      "discipline": [
        "读取 commands/yy-1-requirement.md 的边界、产物与方法指针；宿主准入以其首行指令为准。"
      ],
      "kickPrompt": "请读取 commands/yy-1-requirement.md；先按其首行 host-adapter.mjs 指令展示并消费 Decision Packet，再按本阶段目标工作。",
      "redoPrompt": "重新走 /yy 1：读取 commands/yy-1-requirement.md，重新按其首行 host-adapter.mjs 指令准备并复核 Decision Packet。"
    },
    {
      "step": "research",
      "journeyStep": 1.5,
      "name": "需求签收后的研究门",
      "goal": "用真实来源查已有方案和竞品差距。产物 `docs/prior-art.md`、`docs/market.md` 格式按 verifyPriorArt/verifyMarket，禁止编造 URL/引文。",
      "summary": "需求签收后的研究门。触发词「/yy research」「研究门」「竞品研究」。 首行指令：先跑 `node \"$SKILL_DIR/scripts/host-adapter.mjs\" prepare --workspace \"$PROJECT_ROOT\" --session <session> --intent \"/yy research\" --subtask-id <id> --save` 展示",
      "assets": [],
      "discipline": [
        "读取 commands/yy-research.md 的边界、产物与方法指针；宿主准入以其首行指令为准。"
      ],
      "kickPrompt": "请读取 commands/yy-research.md；先按其首行 host-adapter.mjs 指令展示并消费 Decision Packet，再按本阶段目标工作。",
      "redoPrompt": "重新走 /yy research：读取 commands/yy-research.md，重新按其首行 host-adapter.mjs 指令准备并复核 Decision Packet。"
    },
    {
      "step": 2,
      "journeyStep": 3,
      "name": "拆任务（前提挑战）",
      "goal": "拆任务前先走 dev-planner Step0 前提挑战（≤6 条前提 + 4 问结论），逐条确认后拆成带 GWT 验收 + 前后置 + 契约冻结顺序 + 选型依据的 task。",
      "summary": "阶段 3 拆任务。触发词「/yy 2」「注入阶段 2 prompt」「拆任务」「任务拆解」。 首行指令：先跑 `node \"$SKILL_DIR/scripts/host-adapter.mjs\" prepare --workspace \"$PROJECT_ROOT\" --session <session> --intent \"/yy 2\" --task-text \"<本次有界拆分任务>\" --subtask-",
      "assets": [
        {
          "name": "dev-planner",
          "desc": "Thin Decision asset bridge to pinned grilling, to-spec and to-tickets. Deliver s"
        }
      ],
      "discipline": [
        "读取 commands/yy-2-planning.md 的边界、产物与方法指针；宿主准入以其首行指令为准。"
      ],
      "kickPrompt": "请读取 commands/yy-2-planning.md；先按其首行 host-adapter.mjs 指令展示并消费 Decision Packet，再按本阶段目标工作。",
      "redoPrompt": "重新走 /yy 2：读取 commands/yy-2-planning.md，重新按其首行 host-adapter.mjs 指令准备并复核 Decision Packet。"
    },
    {
      "step": 3,
      "journeyStep": 5,
      "name": "规划 + 契约冻结",
      "goal": "执行矩阵与排序、契约冻结时序；接口/schema/错误码逐条审完才冻结。",
      "summary": "阶段 5 规划+契约冻结。触发词「/yy 3」「注入阶段 3 prompt」「契约冻结」「冻结契约」。 首行指令：先跑 `node \"$SKILL_DIR/scripts/host-adapter.mjs\" prepare --workspace \"$PROJECT_ROOT\" --session <session> --intent \"/yy 3\" --subtask-id <id> --save` 展示包，仅 `ok",
      "assets": [
        {
          "name": "planning",
          "desc": "Compose pinned grilling and to-spec; YY adds only formal/vibe owner governance a"
        }
      ],
      "discipline": [
        "读取 commands/yy-3-contract.md 的边界、产物与方法指针；宿主准入以其首行指令为准。"
      ],
      "kickPrompt": "请读取 commands/yy-3-contract.md；先按其首行 host-adapter.mjs 指令展示并消费 Decision Packet，再按本阶段目标工作。",
      "redoPrompt": "重新走 /yy 3：读取 commands/yy-3-contract.md，重新按其首行 host-adapter.mjs 指令准备并复核 Decision Packet。"
    },
    {
      "step": 4,
      "journeyStep": 7,
      "name": "派单执行",
      "goal": "由当前宿主原生执行已准入子任务；实现与独立实证验收分开，不采信完工报告。缺执行或独立验收能力时明确返回未执行/未验证，不假报完成。",
      "summary": "阶段 7 派单执行。触发词「/yy 4」「注入阶段 4 prompt」「派单执行」「并行派单」。 首行指令：先跑 `node \"$SKILL_DIR/scripts/host-adapter.mjs\" prepare --workspace \"$PROJECT_ROOT\" --session <session> --intent \"/yy 4\" --task-text \"<本次有界子任务>\" --subtask-i",
      "assets": [],
      "discipline": [
        "读取 commands/yy-4-execute.md 的边界、产物与方法指针；宿主准入以其首行指令为准。"
      ],
      "kickPrompt": "请读取 commands/yy-4-execute.md；先按其首行 host-adapter.mjs 指令展示并消费 Decision Packet，再按本阶段目标工作。",
      "redoPrompt": "重新走 /yy 4：读取 commands/yy-4-execute.md，重新按其首行 host-adapter.mjs 指令准备并复核 Decision Packet。"
    },
    {
      "step": 5,
      "journeyStep": 8,
      "name": "验收批判（反哺）",
      "goal": "验收后用真实竞品/官方文档/benchmark 对标；`--verify-urls` 验可达性，不足 3 条有效批判拒绝，结论反哺下一轮。",
      "summary": "阶段 8 批判反哺。触发词「/yy 5」「注入阶段 5 prompt」「验收批判」「强制技术批判」。 首行指令：先跑 `node \"$SKILL_DIR/scripts/host-adapter.mjs\" prepare --workspace \"$PROJECT_ROOT\" --session <session> --intent \"/yy 5\" --subtask-id <id> --save` 展示包，仅 `ok",
      "assets": [],
      "discipline": [
        "读取 commands/yy-5-critique.md 的边界、产物与方法指针；宿主准入以其首行指令为准。"
      ],
      "kickPrompt": "请读取 commands/yy-5-critique.md；先按其首行 host-adapter.mjs 指令展示并消费 Decision Packet，再按本阶段目标工作。",
      "redoPrompt": "重新走 /yy 5：读取 commands/yy-5-critique.md，重新按其首行 host-adapter.mjs 指令准备并复核 Decision Packet。"
    }
  ],
  "assets": [
    {
      "name": "implementation",
      "description": "Thin implementation wrapper for an admitted task, spec or tickets; host-native e",
      "cluster": "T1_DATABASE/T2_BACKEND/T3_AI_RAG_MCP",
      "stages": []
    },
    {
      "name": "be-validator",
      "description": "Zod schemas, OpenAPI generation, RFC 9457 error responses, input sanitization",
      "cluster": "T1_DATABASE/T2_BACKEND/T3_AI_RAG_MCP/T5_OPS",
      "stages": []
    },
    {
      "name": "sdlc",
      "description": "LEGACY_HEAVY_PROFILE for explicit release, large-migration or multi-stage govern",
      "cluster": "T1_DATABASE/T2_BACKEND",
      "stages": []
    },
    {
      "name": "security",
      "description": "Unified security cluster for audit, hardening, and backend security verification",
      "cluster": "T2_BACKEND/T4_FRONTEND/T5_OPS",
      "stages": []
    },
    {
      "name": "review",
      "description": "Matt change review plus YY existing-code audit, seven-element findings and backe",
      "cluster": "T2_BACKEND/T4_FRONTEND/T5_OPS",
      "stages": []
    },
    {
      "name": "dev-planner",
      "description": "Thin Decision asset bridge to pinned grilling, to-spec and to-tickets. Deliver s",
      "cluster": "T3_AI_RAG_MCP",
      "stages": [
        2
      ]
    },
    {
      "name": "frontend-design",
      "description": "分级前端设计资产（L0-L3）。有界面产物时按复杂度加载：小修只过机检门，标准页面走 Design Read+三拨盘+按主题查设计数据，全设计任务才进完整 ta",
      "cluster": "T4_FRONTEND",
      "stages": []
    },
    {
      "name": "planning",
      "description": "Compose pinned grilling and to-spec; YY adds only formal/vibe owner governance a",
      "cluster": "T4_FRONTEND",
      "stages": [
        3
      ]
    },
    {
      "name": "skill-sentinel",
      "description": "Agent Skill 包安全扫描器。扫描 SKILL.md 中的恶意模式、凭据泄露、C2 基础设施，用于插件市场/社区资产上线前安全审查。触发：安装第三方 s",
      "cluster": "T5_OPS",
      "stages": []
    }
  ]
};
