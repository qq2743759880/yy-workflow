---
name: bento-grid
category: feature
dial_compatibility:
  variance: [6, 10]
  motion: [3, 7]
  density: [3, 6]
when_to_use: "Feature / capability overview with 4-8 distinct value props. Apple-Control-Center style asymmetric tile grouping. Best when each tile has a distinct medium (text, image, chart, animation) so cells don't look uniform."
not_for: "More than 8 capabilities (becomes a grid dump); uniform card grids (use a plain card list instead); data-dense admin tables (Section 13 Out of Scope)."
stack: ["react", "next", "tailwind", "motion"]
---

# Bento Grid

## 1. Visual sketch
```
┌──────────────────────── 1280 ────────────────────────┐
│  header: eyebrow + H2 + sub                          │
│  ┌─────────── 4 cols (lg:grid-cols-4) ─────────────┐ │
│  │ [feature A] 2col │ [feature B] 1col │ [feature C]1col│
│  │ [feature D] 1col │ [feature E] 2col │ [feature F]1col│
│  │ [feature G] 2col-span-2  [feature H] 2col       │ │
│  └─────────────────────────────────────────────────┘ │
│  auto-rows / grid-flow-dense, gap-4                  │
└──────────────────────────────────────────────────────┘
```
Asymmetric, not uniform. At least 2-3 cells with real visual variation (image / gradient / motion), not all white-on-white text cards (Pre-Flight: Bento Background Diversity).

## 2. Props API
```tsx
interface BentoCell {
  id: string;
  span: { cols?: 1 | 2 | 3 | 4; rows?: 1 | 2 };
  title: string;
  body?: string;
  visual?: { kind: "image" | "gradient" | "motion" | "text"; src?: string; alt?: string };
  cta?: { label: string; href: string };
}
interface BentoGridProps {
  cells: BentoCell[];
  theme?: "light" | "dark" | "auto";
}
```
Grid classes derived from `lg:col-span-{n}` per cell; never hand-assign absolute pixel widths.

## 3. Code sketch
```tsx
// app/components/feature/bento.tsx (Server Component)
export function BentoGrid({ cells, theme = "auto" }: BentoGridProps) {
  return (
    <section aria-labelledby="bento-title" className="px-4 sm:px-6 lg:px-8 py-16" data-theme={theme}>
      <div className="mx-auto max-w-7xl">
        <h2 id="bento-title" className="...">Capabilities</h2>
        <div className="mt-10 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 [grid-auto-rows:minmax(140px,auto)]">
          {cells.map((cell) => (
            <div
              key={cell.id}
              className={`rounded-2xl border p-5 ${colSpan(cell.span.sm)} ${rowSpan(cell.span.rows)}`}
            >
              <BentoBackground kind={cell.background?.kind} />
              <h3 className="text-base font-semibold">{cell.title}</h3>
              {cell.description && <p className="mt-2 text-sm opacity-80">{cell.description}</p>}
              {cell.cta && <a href={cell.cta.href} className="mt-3 inline-flex ...">{cell.cta.label}</a>}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
```
Motion (stagger fade-in on scroll) isolated in client leaf `bento-reveal.tsx`.

## 4. Mobile fallback
- `< 768px`: `grid-cols-1` (all cells stack full-width). `sm:grid-cols-2` at ≥640px, `lg:grid-cols-4` at ≥1024px.
- Cell spans collapse to `col-span-1` / `row-span-1` at mobile (no lingering 2-col spans).
- Gap `gap-4` retained; `px-4` padding.

## 5. Motion variants
- **MOTION_INTENSITY 1-3:** static grid, no entrance; only CTA hover transition.
- **MOTION_INTENSITY 4-7:** staggered reveal (each cell `useInView` + `motion.div`, 80-120ms stagger, 400-500ms ease-out). No per-cell parallax.
- **MOTION_INTENSITY 8-10:** adds per-cell hover parallax tilt only on 1-2 hero cells (never all), plus a subtle mesh-gradient background that drifts slowly. Respect reduced-motion → all off.

## 6. Dark-mode notes
- Cell surface `--color-card`, border `--color-border`, bg `--color-background`. Cells get `@media (prefers-color-scheme: dark)` card + border overrides; text via `--color-card-foreground`.
- Gradient/pattern cells must still read on dark (avoid pure-white fills). No hardcoded hex.

## 7. Anti-patterns
- Uniform cells (Pre-Flight: Bento needs rhythm AND exact cell count, N items = N cells, no empty cells).
- Empty middle/end cells.
- Fewer than 2-3 varied backgrounds → white-text-card monotony.
- Hand-rolled decorative SVG fills (use allowed icon library: Phosphor / HugeIcons / Radix / Tabler).
- Reusing the same layout family as an adjacent section (Pre-Flight: Section-Layout-Repetition).

## 8. References
- Apple Control Center bento layout.
- Refactoring UI: grouping related info, spacing hierarchy.
- Linear-style capability grids.
