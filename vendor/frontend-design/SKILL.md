---
name: frontend-design
description: Unified frontend design cluster covering generation, taste, design data, component selection, and prototyping
version: 2.0.0
---

# Frontend Design Cluster

Single entry for five capabilities. Run them in order when relevant: read the brief, infer direction, generate, then optionally prototype and validate against data.

> **Every design task MUST do two steps before writing code:** ① run the taste-skill workflow below (Design Read → three dials → Pre-Flight Check); ② query real design data via `search.py`. Do not skip either — they are the load-bearing path that turns this thin entry into an executable workflow.

## Design generation
Production-grade interface, interaction, responsive, motion, and accessibility guidance (reference/color-and-contrast.md, interaction-design.md, motion-design.md, responsive-design.md, spatial-design.md, typography.md, ux-writing.md).

1. **Design Read before code** (from reference/taste-skill.md §0): state in one line `Reading this as: <page kind> for <audience>, with a <vibe> language, leaning toward <system or aesthetic family>.` Do not generate before this.
2. **Set three dials** (reference/taste-skill.md §1.A inference table): `DESIGN_VARIANCE / MOTION_INTENSITY / VISUAL_DENSITY`, baseline `8 / 6 / 4`; infer from the brief.
3. **Anti-default discipline**: do not default to AI-purple gradients, centered hero over dark mesh, three equal feature cards, glassmorphism everywhere, Inter + slate-900. Reach past defaults deliberately.

## Anti-template taste — EXECUTE, don't skim
Read `reference/taste-skill.md` (full methodology: brief inference, three dials, anti-default discipline, audit-first on redesigns, strict pre-flight check) and **follow it as a workflow**:

1. **Brief inference** → emit the one-line Design Read (§0.B).
2. **Three dials** → pick `DESIGN_VARIANCE / MOTION_INTENSITY / VISUAL_DENSITY` from §1.A.
3. **Pre-Flight Check** → before delivering, run §14 (50+ item matrix). Any item fails → rework the artifact and re-run. Em-dash ban included.
4. **Component blocks** → reuse the ready-made blocks under `reference/taste-blocks/<category>/<name>.md` (9 blocks): `cta/centered-cta.md`, `feature/bento-grid.md`, `footer/multi-column-footer.md`, `hero/asymmetric-split.md`, `navigation/sticky-nav.md`, `portfolio/project-gallery.md`, `pricing/tiered-pricing.md`, `social-proof/testimonial-wall.md`, `transition/sticky-scroll-stack.md`. Each file already encodes the relevant Pre-Flight rules.

Every rule is contextual — none fires automatically; read the file, apply the parts the brief triggers.

## Design data and search — QUERY, don't invent
Query real design data with the search script before choosing style, color, font, icon, or stack. Do not hand-wave values the catalog can answer.

```powershell
python <frontend-design>/reference/design-data/scripts/search.py "<query>" --domain <ux|style|color|typography|gsap|chart>
```

- Works from any cwd; `<frontend-design>` = `$SKILL_DIR/vendor/frontend-design`.
- Domains map to catalogs (all with provenance): `ux` → ux-guidelines.csv (119 guidelines), `style` → styles.csv (79 styles), `color` → colors.csv (192 palettes), `typography` → typography.csv + google-fonts.csv (74 font pairings), `gsap` → motion.csv, `chart` → charts.csv. Stack catalogs at `reference/design-data/data/stacks/<framework>.csv`.
- **Decide with returned rows** (real names, real values). Example: `python $SKILL_DIR/vendor/frontend-design/reference/design-data/scripts/search.py "error summary validation" --domain ux`.
- **Honest degradation**: if `python` is missing, read the CSVs directly (`reference/design-data/data/*.csv`) or state in the artifact that search was skipped — never fake results.

## Component selection
Choose libraries by framework and interaction complexity (reference/component-selection.md). Baseline component set: shadcn-ui/ui. Do not introduce a component library without checking the selection criteria first.

## Prototyping
Only when explicitly invoked: build several genuinely different variants of one UI piece, render them behind the visual picker, let the user flip and promote a winner (reference/prototyping.md). Copy the picker markup/CSS verbatim from reference/PICKER.md — it is harness chrome, never a design decision. Never touch production code during exploration; clean up after the winner is promoted.

## Execution kernel (shadcn-ui/ui + bolt.new)

Kernel: shadcn-ui/ui（组件底座，~85k★）+ stackblitz-labs/bolt.new（原型生成）为前端设计簇的执行内核（原 COMPETITORS.md descriptive conclusion 升级为内核声明）。
- Invocation: 组件实现时 probe 组件库可用性（npm 检查）后按 shadcn 规范产出；原型 phase 用 bolt.new 生成可运行变体。
- Degradation: 外部底座缺失 → 用 reference/design-data + taste-blocks 内置流程，不假报已用外部内核。
