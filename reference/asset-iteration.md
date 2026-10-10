# 资产迭代与文件生命周期硬门

本协议适用于治理 manifest 中全部资产。ASSET-FILES.yaml 只登记物理文件，不替代 V3 方法论或 Decision 语义。

G0 CURRENT TREE FREEZE：保存完整树及 SHA，取得唯一 writer 锁。
G1 CONSUMER MAP：逐文件核实当前 runtime、entry、按需 resource、executable 或必要 provenance；历史 inventory 不算消费者。
G2 UPSTREAM-FIRST：先核对 Matt 固定原件，再核对 approved mature upstream。依次选择 DIRECT_VENDOR → THIN_WRAPPER → COMPOSE → FORK_PATCH → CUSTOM；每个被跳过的更小模式必须登记拒绝原因。CUSTOM 仅在有源码/契约依据的 REAL_GAP 时允许。不得先自研再补来源。每资产 UPSTREAM-REUSE.yaml 与 METHODOLOGY.json 由 scripts/asset-upstream-reuse.mjs 核对原件、固定 commit、每文件 SHA、license、依赖闭包和真实执行路径；不联网自动升级，不访问 Skill Design Vault。
G3 CANDIDATE：在独立候选目录作有界变更，candidate 完成不代表 production 完成。
G4 CONTRACT SYNC：核对正文、V3、sidecar、runtime truth；语义变更另按已有治理门批准。
G5 FILE LIFECYCLE RECONCILIATION：每个旧件和新增件做 KEEP / WIRE / RETIRE，更新 ASSET-FILES.yaml。
G6 RETIREMENT：退役件先按 project-bath v0.1.3 在 D:/project-bath 外部保存实际原字节、SHA、理由、替代者、消费者证据与恢复清单，再退出 vendor；禁止 reset/clean。
G7 PORTABILITY：在新绝对路径和带空格路径验证引用及 core/mcp export。
G8 ACTIVATION PROOF：用 production loader 证明正文 source_hash 和请求资源来自实际新入口；不以文档存在冒充应用或模型效果。
G9 INDEPENDENT REVIEW：按后续任务授权进行独立审查、盲测或 A/B；本轮仅 deterministic 检查。

G5/G6/G7/G8 全部具备证据，才允许写 PRODUCTION_ASSET_MIGRATED。生产导出前必须运行 scripts/asset-file-hygiene.mjs；新增无分类、双入口、退役残留、缺消费者或悬空资源都拒绝发布。

五态：ACTIVE_ENTRY（唯一正文）、ACTIVE_RESOURCE（有条件加载的资料）、EXECUTABLE（实际工具或依赖）、PROVENANCE（法律/出处/治理信息）、RETIRED（仅在声明与外部归档中，不能留在 vendor）。无法裁定就 BLOCKED_FOR_CLASSIFICATION，不得导出。
声明使用现有严格 YAML 子集解析器。每个 file match 必须恰好覆盖一个状态；每项 consumer 用 canonical 相对路径，activation 仅用于正文，distribution 仅用于 provenance。按需件必须有 load 条件。当前采用逐文件路径，未来可用受控 * / **，重叠与无匹配都失败。

每份交接必须包含：asset_tree_before / asset_tree_after；new_files / modified_files / retired_files；active_entry / active_resources / executables / provenance；consumer_map_complete=YES；unclassified_files=0；retired_files_still_in_vendor=0；dual_entry_files=0；broken_internal_refs=0；candidate_only_runtime_refs=0；portability_check=PASS；export_hygiene_gate=PASS。禁止缺项进入 production integration。

安装的门：validate-structure、regression-all --cheap、export-package（复制前）。九资产当前树及未来五个 Wave 2 候选同样受门约束；不会因为候选研发结束而自动晋级。node_modules/.git/.venv/.mimosa 是非生产工具状态，不参与 payload；其他 vendor 文件必须分类，pyc/log/pid/local config 不可发行。
