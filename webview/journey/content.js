export const GUIDE_CONTENT = {
  "generatedBy": "scripts/build-guide-content.mjs",
  "phases": [
    {
      "step": 0,
      "journeyStep": 0,
      "name": "立项 / 资产整合",
      "goal": "一句话定边界，盘点资产与平台，只做需求澄清 + 概念版，不拆任务不写代码。",
      "summary": "阶段 0 立项/资产整合。触发词「/yy 0」「注入阶段 0 prompt」「立项」「资产整合」。 首行指令：先跑 `node scripts/tt-journey.mjs --workspace \"$PROJECT_ROOT\" --prereq-check --step 0`（或读 `$PROJECT_ROOT/.tt-state/journey.json`）机验前置。本阶段无前置（step 0 起点，天然放行），",
      "assets": [],
      "discipline": [
        "只做第 N 步",
        "允许反驳",
        "契约先冻结 / HTML 原型 APPROVED / 每轮验收竞品批判"
      ],
      "kickPrompt": "按阶段 0 纪律执行：「只做第 N 步」「允许反驳」",
      "redoPrompt": "重新走阶段 0：/yy 0（起点阶段，无前置 gate）"
    },
    {
      "step": 1,
      "journeyStep": 1,
      "name": "需求挖掘",
      "goal": "你当唯一事实源，按 forcing-questions 逐轮追问（每次 ≤2 题），产出概念版并签收后才进下一步。",
      "summary": "阶段 1 需求挖掘。触发词「/yy 1」「注入阶段 1 prompt」「需求挖掘」「挖掘需求」。 首行指令：先跑 `node scripts/tt-journey.mjs --workspace \"$PROJECT_ROOT\" --prereq-check --step 1` 机验前置。前置 step 0 未 done 时 exit 1 输出原因并阻断注入，先回阶段 0。",
      "assets": [],
      "discipline": [
        "先别产文档",
        "逐轮问我 ≤2 题",
        "回源核验",
        "查不到标 [待补充] 禁止编造"
      ],
      "kickPrompt": "按阶段 1 纪律执行：「先别产文档」「逐轮问我 ≤2 题」",
      "redoPrompt": "重新走阶段 1：/yy 1（前提：step0 全部满足后再注入）"
    },
    {
      "step": 2,
      "journeyStep": 3,
      "name": "拆任务（前提挑战）",
      "goal": "拆任务前先走 dev-planner Step0 前提挑战（≤6 条前提 + 4 问结论），逐条确认后拆成带 GWT 验收 + 前后置 + 契约冻结顺序 + 选型依据的 task。",
      "summary": "阶段 3 拆任务。触发词「/yy 2」「注入阶段 2 prompt」「拆任务」「任务拆解」。 首行指令：先跑 `node scripts/tt-journey.mjs --workspace \"$PROJECT_ROOT\" --prereq-check --step 3` 机验前置。前置 step 1 未 done 或 gate concept-signed 未过时 exit 1 输出原因并阻断注入，先回阶段 ",
      "assets": [
        {
          "name": "dev-planner",
          "desc": "Analyzes feature requirements, breaks them into frontend/backend tasks, defines"
        }
      ],
      "discipline": [
        "前提挑战",
        "GWT 验收",
        "前后置依赖",
        "契约冻结顺序",
        "选型依据",
        "HTML 原型 gate",
        "review-gate --plan 自检三视角"
      ],
      "kickPrompt": "按阶段 2 纪律执行：「前提挑战」「GWT 验收」；agent 未调用配套资产时点名要求：读取并应用 vendor/dev-planner",
      "redoPrompt": "重新走阶段 2：/yy 2（前提：step1、concept-signed 全部满足后再注入）"
    },
    {
      "step": 3,
      "journeyStep": 5,
      "name": "规划 + 契约冻结",
      "goal": "任务×agent×skill×workflow×MCP 矩阵 + 执行排序 + 契约冻结时序 + 开工 prompt；契约冻结前列接口清单/schema/错误码/响应壳，逐条审完才冻结。",
      "summary": "阶段 5 规划+契约冻结。触发词「/yy 3」「注入阶段 3 prompt」「契约冻结」「冻结契约」。 首行指令：先跑 `node scripts/tt-journey.mjs --workspace \"$PROJECT_ROOT\" --prereq-check --step 5` 机验前置。前置 step 3 未 done 时 exit 1 输出原因并阻断注入，先回阶段 3。",
      "assets": [],
      "discipline": [
        "契约先冻结",
        "冻结后执行期禁止改契约",
        "要改走变更单 + 重验收",
        "前端缺契约就停下不要臆造接口"
      ],
      "kickPrompt": "按阶段 3 纪律执行：「契约先冻结」「冻结后执行期禁止改契约」",
      "redoPrompt": "重新走阶段 3：/yy 3（前提：step3 全部满足后再注入）"
    },
    {
      "step": 4,
      "journeyStep": 7,
      "name": "派单执行",
      "goal": "按 C-01 派独立子 agent 执行（task/claude/codex/openclaw），你不得自写自验；每任务完工 = 你独立实证验收，不采信完工报告。",
      "summary": "阶段 7 派单执行。触发词「/yy 4」「注入阶段 4 prompt」「派单执行」「并行派单」。 首行指令：先跑 `node scripts/tt-journey.mjs --workspace \"$PROJECT_ROOT\" --prereq-check --step 7` 机验前置。前置 step 5 未 done 或 gate contract-frozen 未过时 exit 1 输出原因并阻断注入，先回阶段",
      "assets": [],
      "discipline": [
        "独立子 agent",
        "独立实证验收",
        "不采信完工报告",
        "HTML 原型先 APPROVED 才准写框架",
        "验收断言逐个复现"
      ],
      "kickPrompt": "按阶段 4 纪律执行：「独立子 agent」「独立实证验收」",
      "redoPrompt": "重新走阶段 4：/yy 4（前提：step5、contract-frozen 全部满足后再注入）"
    },
    {
      "step": 5,
      "journeyStep": 8,
      "name": "验收批判（反哺）",
      "goal": "每轮验收后强制技术批判——真实搜索竞品对标（GitHub stars/官方文档/近 1-2 年 benchmark），URL 可达性机验（--verify-urls），不足 3 条有效批判按硬闸门拒绝；批判要毒舌，结论反哺下一轮。",
      "summary": "阶段 8 批判反哺。触发词「/yy 5」「注入阶段 5 prompt」「验收批判」「强制技术批判」。 首行指令：先跑 `node scripts/tt-journey.mjs --workspace \"$PROJECT_ROOT\" --prereq-check --step 8` 机验前置。前置 step 7 需 in_progress 或 done，否则 exit 1 输出原因并阻断注入，先回阶段 7。",
      "assets": [],
      "discipline": [
        "真实竞品对标",
        "--verify-urls",
        "不足 3 条有效批判按硬闸门拒绝",
        "毒舌不许客气",
        "登记 tracker 生成后续任务"
      ],
      "kickPrompt": "按阶段 5 纪律执行：「真实竞品对标」「--verify-urls」",
      "redoPrompt": "重新走阶段 5：/yy 5（前提：step7 全部满足后再注入）"
    }
  ],
  "assets": [
    {
      "name": "implementation",
      "description": "Unified implementation agent: turn requirements and frozen contracts into runnab",
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
      "description": "BMAD-METHOD phase orchestration with cline plan and exec execution",
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
      "description": "Unified review cluster for critique, automated verification, and polish",
      "cluster": "T2_BACKEND/T4_FRONTEND/T5_OPS",
      "stages": []
    },
    {
      "name": "dev-planner",
      "description": "Analyzes feature requirements, breaks them into frontend/backend tasks, defines",
      "cluster": "T3_AI_RAG_MCP",
      "stages": [
        2
      ]
    },
    {
      "name": "frontend-design",
      "description": "Unified frontend design cluster covering generation, taste, design data, compone",
      "cluster": "T4_FRONTEND",
      "stages": []
    },
    {
      "name": "planning",
      "description": "Unified PRD and planning cluster for formal PRDs and Vibe Coding PRDs",
      "cluster": "T4_FRONTEND",
      "stages": []
    },
    {
      "name": "skill-sentinel",
      "description": "Agent Skill 包安全扫描器。扫描 SKILL.md 中的恶意模式、凭据泄露、C2 基础设施，用于插件市场/社区资产上线前安全审查。触发：安装第三方 s",
      "cluster": "T5_OPS",
      "stages": []
    }
  ]
};
