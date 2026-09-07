# TT (tt-together-agent) 璧勪骇杩唬浼樺寲鏂规 + 銆屾柟娉曡鏈変綑銆侀鏋朵笉瓒炽€嶈瘖鏂?
> 渚濇嵁 `COMPETITORS.md` 鐨?27 璧勪骇绔炲搧鍩哄噯锛岀粰鍑恒€屽彇鏇翠紭鑰呮浛鎹€嶇殑鎵ц璺嚎銆?> 鏍稿績鍒ゆ柇锛?*TT 鐜板湪涓嶇己璧勪骇锛?6 涓緢鍏級锛岀己鐨勬槸涓€涓彲杩愯鐨勭紪鎺掑唴鏍革紙skeleton锛夈€?*

---

## 涓€銆佷负浠€涔堣 TT銆屽彧鏈夋柟娉曡锛屾病鏈夐鏋躲€?
### 1.1 鍏堢湅浠撳簱閲屽埌搴曟湁浠€涔堬紙瀹炶瘉锛?
| 鐩綍 | 瀹為檯鍐呭 | 鎬ц川 |
|---|---|---|
| `SKILL.md` (26KB) | 缂栨帓鏂规硶璁猴細planner 璺敱銆乼ask脳agent脳skill脳workflow脳MCP 鐭╅樀銆佸绾﹀喕缁?鈶爚鈶€佷簲绫讳换鍔￠摼 T1鈥揟5 | **鏂囨。/璇存槑**锛堝憡璇夊涓?璇ユ€庝箞鍋?锛墊
| `templates/` | `task-agent-matrix.md`銆乣orchestration-frontend-backend.md`銆乣contract.md`銆乣dev-plan.md`鈥?| **Markdown 妯℃澘**锛堝啀娆℃弿杩版柟娉曡锛墊
| `vendor/` (26 璧勪骇) | 姣忎釜閮芥槸 `SKILL.md` 鎴?`<name>.md` 鐨?**prompt / 瑙掕壊瀹氫箟** | **鎻愮ず璇嶈祫浜?*锛堢粰 LLM 鐪嬬殑鎸囦护锛墊
| `scripts/` | `detect-platforms.mjs`銆乣validate-structure.mjs`銆乣sync.mjs` | **寮€鍙戞湡鏍￠獙鑴氭湰**锛堟鏌ョ粨鏋?鍙Щ妞嶆€э級锛?*涓嶆槸杩愯鏃?* |
| `COMPETITORS.md` | 绔炲搧鍩哄噯 | 鍒嗘瀽鏂囨。 |

### 1.2 銆屾柟娉曡銆嶅湪鍝?
TT 鎶婁竴濂楀畬鏁寸殑澶氭櫤鑳戒綋鍗忎綔鏂规硶璁哄啓寰楀緢娓呮锛?- 鎬庝箞鎶婁换鍔℃媶缁?agent / skill / workflow / MCP锛?- 鎬庝箞鍦?鈶爚鈶?姝ラ噷鍋氥€屽绾﹀喕缁撱€嶉槻姝㈣窇鍋忥紱
- 鎬庝箞鐢?planner 鎶婇渶姹傝矾鐢卞埌瀵瑰簲璧勪骇銆?
杩欏**鎬濊€冩鏋?*鏄?TT 鐨勭湡姝ｄ环鍊硷紝涔熸鏄畠鐩稿涓€鍫嗛浂鏁?skill 鐨勫樊寮傚寲銆?
### 1.3 銆岄鏋躲€嶇己鍦ㄥ摢

**楠ㄦ灦 = 鑳借涓婇潰閭ｅ鏂规硶璁虹湡姝?璺戣捣鏉?鐨勫彲鎵ц寮曟搸銆?* 浠撳簱閲?*娌℃湁**浠讳綍杩欐牱鐨勪唬鐮侊細

- 鉂?娌℃湁 agent 杩愯鏃讹紙璋佸幓 spawn / 璋冨害杩欎簺 agent锛燂級
- 鉂?娌℃湁娑堟伅鎬荤嚎 / 涓婁笅鏂囧叡浜紙澶?agent 涔嬮棿鎬庝箞浼犵姸鎬侊紵锛?- 鉂?娌℃湁缂栨帓寰幆椹卞姩鍣紙planner 鐨?璺敱"鏄啓鍦?SKILL.md 閲岃**瀹夸富瀹㈡埛绔?*鍘诲仛鐨勶紝涓嶆槸 TT 鑷繁鎵ц鐨勶級
- 鉂?濂戠害鍐荤粨鏄?`orchestration-frontend-backend.md` 閲岀殑涓€娈佃鑼冿紝**娌℃湁浠讳綍浠ｇ爜鍘诲己鍒舵牎楠?*
- 鉂?`scripts/` 鍙仛闈欐€佺粨鏋勬牎楠岋紝涓嶅弬涓庤繍琛?
### 1.4 涓€鍙ヨ瘽缁撹

> **TT 鏄竴浠?浼氭€濊€冪殑浣滄垬鎵嬪唽"锛屼笉鏄竴涓?浼氭墦浠楃殑鎸囨尌绯荤粺"銆?*
> 瀹冧緷璧栧閮ㄥ涓伙紙WorkBuddy / Claude / Codex锛夋潵鎻愪緵鎵ц鑳藉姏銆備竴鏃﹁劚绂昏繖浜涘涓伙紝TT 鑷繁浠€涔堜篃璺戜笉浜嗐€?> 杩欐鏄?`COMPETITORS.md` 閲?`tt` 鏈綋閭ｄ竴鑺備笅鐨勫垽鏂細**銆孴T 褰撳墠鏄€庢柟娉曡 + 璧勪骇鎵撳寘銆忓畾浣嶏紝缂哄皯鍙繍琛岀殑缂栨帓鍐呮牳銆?*銆?
瀵规爣 `claude-flow`锛堢粓绔唴鐪熸璺戣渹缇?娴佹按绾跨殑 CLI锛夈€乣lobehub`锛堝甫鎶€鑳藉競鍦鸿繍琛屾椂鐨勫簲鐢級銆乣MetaGPT`锛圥ython 鍖呯洿鎺ユ墽琛屽 agent锛夆€斺€斿畠浠兘鏈?楠ㄦ灦"锛孴T 娌℃湁銆?
---

## 浜屻€佹渶浣宠凯浠ｄ紭鍖栨柟妗堬紙鍥涙湡璺嚎锛?
> 鍘熷垯锛?*鍏堣ˉ楠ㄦ灦锛屽啀绨囧寲锛屽啀鏇挎崲锛屾渶鍚庣敤绔炲搧鍙嶅摵鏂规硶璁恒€?*
> 椤哄簭閿欎簡锛堟瘮濡傚厛鐙傛崲璧勪骇锛夊彧浼氬緱鍒颁竴涓?鏇村帤浣嗕笉浼氬姩鐨勬墜鍐?銆?
### Phase 0 鈥?琛ラ鏋讹紙鏈€楂樹紭鍏堢骇锛屼笉鏇挎崲浠讳綍璧勪骇锛?
鐩爣锛氳 TT 浠?鎵嬪唽"鍙樻垚"绯荤粺"銆?
| 鍔ㄤ綔 | 瀵规爣绔炲搧 | 鍋氭硶 |
|---|---|---|
| 寮曞叆缂栨帓鍐呮牳 | `ruvnet/claude-flow` (~61k) | 鍊熼壌鍏?*杩涚▼鍐?Agent 鍐呭瓨/涓婁笅鏂囧叡浜?*鏈哄埗锛屽仛涓€涓?`orchestrator`锛堣剼鏈?鍖咃級 |
| 鎶婃柟娉曡鍙樻垚浠ｇ爜 | `lobehub/lobehub` (~79k) | 灏?planner 璺敱銆乣task脳agent脳skill脳workflow脳MCP` 鐭╅樀銆佸绾﹀喕缁?鈶爚鈶?瀹炵幇涓哄彲鎵ц閫昏緫 |
| 寮哄埗濂戠害鍐荤粨 | `apideck-os/portman` / `sabai-tech/contracteer` | 鎶?濂戠害鍐荤粨"浠?Markdown 瑙勮寖鍙樻垚**鍙牎楠岀殑 gate**锛堣 Phase 2 be-validator锛墊

楠屾敹鏍囧噯锛氱粰涓€涓换鍔★紝TT 鑳借嚜鍔?璺敱 鈫?娲惧崟 鈫?濂戠害鍐荤粨 鈫?楠屾敹锛屾棤闇€浜哄伐閫愭澶嶅埗 prompt銆?
### Phase 1 鈥?绨囧寲鍘婚噸锛堥檷缁存姢闈紝绔嬪嵆鍙仛锛?
渚濇嵁 `COMPETITORS.md` 闄勫綍 A锛?6 涓?vendor 璧勪骇瀛樺湪 5 涓噸鍙犵皣锛屽悎骞跺悗 **26 鈫?~16**锛?
| 绨?| 鎴愬憳 | 鍔ㄤ綔 |
|---|---|---|
| 鍓嶇璁捐绨?| frontend-design 路 taste-skill 路 ui-ux-pro-max 路 pick-ui-library 路 prototype | 缁熶竴搴曞骇 `shadcn-ui/ui` + `bolt.new` |
| 闇€姹?瑙勫垝绨?| prd-writer 路 vibe-coding-prd 路 dev-planner | 缁熶竴涓哄崟涓€ PRD/瑙勫垝璧勪骇 |
| 瀹夊叏绨?| audit 路 harden 路 be-security | 缁熶竴 SAST 鍐呮牳 `semgrep` + `trailofbits/skills` |
| 瀹炵幇绨?| dev-backend 路 be-implementer | 鍚堝苟涓哄崟涓€瀹炵幇璧勪骇锛屽唴鏍?`opencode` |
| 璇勫绨?| critique 路 be-tester | 缁熶竴璇勫鍐呮牳 `qodo-ai/pr-agent` / `continue` |

### Phase 2 鈥?鎸夋爣鏉嗘浛鎹㈠叧閿祫浜э紙鍙栨洿浼樿€咃級

| 璧勪骇绨?/ 璧勪骇 | 鐜版€?| 鎺ㄨ崘鏇挎崲绔炲搧 | 鏇挎崲鐞嗙敱 | 椋庨櫓 |
|---|---|---|---|---|
| 瀹炵幇绨?(dev-backend, be-implementer) | 鑷畾涔?prompt | **`opencode-ai/opencode` (~95k)** | 鏄熸爣鏈€楂樸€佺粓绔唴 AI 杞欢宸ョ▼甯堬紝鐩存帴浣滄墽琛屽唴鏍?| 闇€閫傞厤 TT 濂戠害鏍煎紡 |
| sdlc | 鑷爺缂栨帓 | **`bmad-code-org/BMAD-METHOD` (~49.5k)** + **`cline/cline` (~63.7k)** | 鏂规硶璁哄眰鏈€璐磋繎锛沜line 鎻愪緵鍙繍琛?plan鈫抏xec鈫抳erify | 浜岃€呴渶缂濆悎 |
| agent-research | 17 瀛愭妧鑳介泦 | **`assafelovic/gpt-researcher` (~20k)** | 鑷富 deep-research锛屽崟鐐规渶寮烘浛浠?| 闇€淇濈暀 TT 鐨勫瓙鎶€鑳芥媶鍒?|
| 鍓嶇璁捐绨?| 5 璧勪骇 | **`shadcn-ui/ui` (~85k)** + **`stackblitz-labs/bolt.new` (~30k)** | 缁勪欢搴曞骇 + 涓€鍙ヨ瘽鍑哄彲杩愯搴旂敤 | 璁捐鎰熼渶 taste-skill 琛?|
| be-validator | 鑷畾涔夊绾︽牎楠?| **`sabai-tech/contracteer`** / **`apideck-os/portman`** | OpenAPI鈫掑绾︽祴璇曪紝**鐩存帴寮哄寲濂戠害鍐荤粨** | 闇€鎺?Phase 0 鐨?gate |
| skill-sentinel | 鑷爺鎵弿 | **`NVIDIA/SkillSpector`** | 68 绫绘紡娲炴ā寮?+ **SARIF 鏍囧噯鍖栬緭鍑?* | 杈撳嚭鏍煎紡杩佺Щ |
| 瀹夊叏绨?| audit/harden/be-security | **`semgrep/semgrep` (~30k)** + **`gitleaks/gitleaks` (~24.9k)** + **`trailofbits/skills`** | 澶氳瑷€ SAST + 瀵嗛挜鎵弿 + 鐜版垚瀹夊叏 skill | 涓変欢濂楁暣鍚?|
| be-resilience | 鑷畾涔?| **`sachiniyer/cockatiel`**锛圱S, 褰㈡€佷竴鑷达級/ `App-vNext/Polly` | 閲嶈瘯/鐔旀柇/闅旂锛屼笌 TT 涓婁笅鏂囪创鍚?| 璺ㄨ瑷€鍙傝€?|
| be-provider | 鑷畾涔?DI | **`microsoft/tsyringe`** / `InversifyJS` | 杞婚噺瑁呴グ鍣ㄥ紡 DI | 浣?|
| be-architect | 鑷畾涔?| **`csalvato/system-design-template`** | 10 闃舵 agent-first锛岄樁娈靛寲鎬濊矾濂戝悎 TT | 涓?|
| 璇勫绨?(critique, be-tester) | 鑷畾涔?| **`qodo-ai/pr-agent` (~11.6k)** + **`continuedev/continue` (~33.7k)** | 琛岀骇鎵规敞 + 瑙勫垯鍗充唬鐮?| 涓?|
| be-tester | 鑷畾涔?| **`alibaba/open-code-review` (~14.8k)** | 娣峰悎鏋舵瀯 + 琛岀骇鎵规敞锛岄樋閲岃妯￠獙璇?| 涓?|

### Phase 3 鈥?鐢ㄧ珵鍝佸弽鍝烘柟娉曡

鎶婄珵鍝佺殑寮烘満鍒跺啓鍥?TT 鐨勬柟娉曡鏂囨。锛屽舰鎴愰棴鐜細
- `claude-flow` 鐨?*鍐呭瓨/涓婁笅鏂囧叡浜?* 鈫?琛ヨ繘 orchestrator 璁捐锛?- `MetaGPT` 鐨?*瑙掕壊鈫掓枃妗?*浜х墿閾?鈫?寮哄寲 task-agent-matrix 鐨勪骇鐗╃害瀹氾紱
- `portman` 鐨?**OpenAPI鈫掑绾︽祴璇?* 鈫?鍥哄寲涓?TT 鐨?濂戠害鍐荤粨 gate"鏍囧噯瀹炵幇銆?
### Phase 4 鈥?楠岃瘉闂幆锛圫killOps + 绔炲搧娴嬭瘯鍣級

- 鎸佺画璺?`skillops sweep()` 妫€娴?alternative / redundancy 杈癸紝闃叉鏇挎崲鍚庝骇鐢熸柊瀛ゅ効锛?- 鐢?Phase 2 鐨?`be-tester` 绔炲搧锛坄alibaba/open-code-review`銆乣qodo-ai/pr-agent`锛夊姣忎釜璧勪骇鍋?*璐ㄩ噺鍥炲綊**锛?- `validate-structure.mjs` 浣滀负 CI 鍗＄偣锛屼繚璇佹瘡娆℃浛鎹?26/26銆? 婕傜Щ銆? 娉勯湶銆?
---

## 涓夈€佹帹鑽愮洰鏍囨灦鏋勶紙鏂囧瓧鍥撅級

```
鈹屸攢鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹?鈹? 瀹夸富瀹㈡埛绔?(WorkBuddy / Claude / Codex)                  鈹?鈹斺攢鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹攢鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹?                鈹?鍔犺浇
                鈻?鈹屸攢鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹?鈹? TT orchestrator  鈼€鈹€鈹€ Phase 0 楠ㄦ灦锛堝綋鍓嶇己澶憋紝浼樺厛琛ワ級     鈹?鈹?  路 planner 璺敱  路 浠诲姟脳agent脳skill脳workflow脳MCP 鐭╅樀      鈹?鈹?  路 濂戠害鍐荤粨 gate锛堢敱 portman/contracteer 寮哄埗鏍￠獙锛?       鈹?鈹斺攢鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹攢鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹?                鈹?璋冨害
   鈹屸攢鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹尖攢鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹攢鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹?   鈻?           鈻?              鈻?               鈻? 瀹炵幇绨?       sdlc           鍓嶇绨?          瀹夊叏绨?(open-code)   (BMAD+cline)   (shadcn+bolt)   (semgrep+gitleaks)
   鈹?           鈹?              鈹?               鈹?   鈹斺攢鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹粹攢鈹€鈹€鈹€鈹€鈹€鈹€鈹攢鈹€鈹€鈹€鈹€鈹€鈹€鈹粹攢鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹?                        鈻?              鈹屸攢鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹?              鈹?闊ф€у眰 be-resilience  鈹? (cockatiel / Polly)
              鈹?璇勫灞?be-tester     鈹? (pr-agent / open-code-review)
              鈹斺攢鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹攢鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹?                        鈻?                  SkillOps sweep() 鎸佺画鏍￠獙
```

---

## 鍥涖€丮VP 鎵ц椤哄簭锛堝埆棰犲€掞級

1. **Phase 0 琛ラ鏋?* 鈥斺€?鍚﹀垯鎹㈠啀澶氳祫浜т粛鏄?浼氳璇濅絾涓嶄細鍔ㄦ墜"銆傝繖鏄渶楂樻潬鏉嗐€?2. **Phase 1 绨囧寲** 鈥斺€?鍏堝噺閲嶏紝26鈫?6锛屽悗缁瘡涓浛鎹㈡垚鏈洿闄嶃€?3. **Phase 2 鍙厛鎹?3 涓渶楂樻潬鏉嗚祫浜?*锛氬疄鐜扮皣(`opencode`) + sdlc(`BMAD+cline`) + be-validator(`portman`)銆傝繖涓変釜鐩存帴琛ラ綈"鑳芥墽琛?/ 鑳界紪鎺?/ 鑳藉崱濂戠害"涓夊潡鏈€鐥涚殑鐭澘銆?4. 鍏朵綑璧勪骇鎸?Phase 2 琛ㄦ牸**娓愯繘鏇挎崲**锛屾瘡鎹竴涓窇涓€娆?`validate-structure.mjs` + `sweep()`銆?
---

## 浜斻€佷竴鍙ヨ瘽鎬荤粨

> TT 鐜板湪鏄竴杈?*璁捐鍥炬瀬鍏剁簿缇庛€佷絾杩樻病鏈夊彂鍔ㄦ満**鐨勮溅銆?> 绔炲搧鍩哄噯鍛婅瘔鎴戜滑闆朵欢锛堣祫浜э級宸茬粡澶熷澶熷ソ锛?*褰撳姟涔嬫€ユ槸閫犲彂鍔ㄦ満锛坰keleton锛?*锛屽啀鎶婂嚑鍧楁渶寮辩殑闆朵欢鎹㈡垚鏍囨潌浠讹紱绨囧寲鍒欐槸椤烘墜鎶婂啑浣欒灪涓濆嵏鎺夈€? 
 
## MVP 状态（2026-08-29） 
