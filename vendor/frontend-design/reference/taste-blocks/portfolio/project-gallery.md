---
name: project-gallery
category: portfolio
dial_compatibility:
  variance: [6, 10]
  motion: [5, 9]
  density: [2, 4]
when_to_use: "Portfolio/studio/agency work showcase. Grid or asymmetric layout of project cards with real imagery, titles, and optional case-study links. High variance and motion welcome (creative context)."
not_for: "SaaS capability grids (use bento); uniform card grids that feel like dashboards; pages without real project imagery."
stack: ["react", "next", "tailwind", "motion"]
---

# Project Gallery

## 1. Visual sketch
```
┌──────────────────────── 1280 ────────────────────────────┐
│  eyebrow + H2 ("Selected work")                            │
│  ┌───────────── asymmetric / masonry ───────────────┐    │
│  │  [proj A]  wide   │  [proj B]  tall              │    │
│  │  [proj C]         │  [proj D]  wide               │    │
│  │  title/tagline over real image                    │    │
│  └──────────────────────────────────────────────────┘    │
└──────────────────────────────────────────────────────────────┘
```
Real project imagery (gen-tool or real screenshots), not decorative SVGs. Titles/taglines overlay or sit below image. Asymmetric to feel curated.

## 2. Props API
```tsx
interface Project {
  id: string;
  title: string;
  tagline?: string;
  image: { src: string; alt: string };
  link?: { href: string; label: string };
  span?: { cols?: 1 | 2; rows?: 1 | 2 };
}
interface ProjectGalleryProps {
  title: string;
  projects: Project[];
  theme?: "light" | "dark" | "auto";
}
```

## 3. Code sketch
```tsx
// app/components/portfolio/gallery.tsx (Server Component)
export function ProjectGallery({ title, projects, theme = "auto" }: ProjectGalleryProps) {
  return (
    <section aria-labelledby="work-title" className="px-4 sm:px-6 lg:px-8 py-16" data-theme={theme}>
      <div className="mx-auto max-w-7xl">
        <h2 id="work-title" className="...">{title}</h2>
        <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-3 [grid-auto-rows:auto]">
          {projects.map((p) => (
            <a key={p.id} href={p.link?.href ?? "#"} className={`group ${colSpan(p.span?.cols)}`}>
              <div className="overflow-hidden rounded-xl">
                <img src={p.image.src} alt={p.image.alt} className="aspect-[4/3] w-full object-cover transition-transform duration-500 group-hover:scale-105" />
              </div>
              <h3 className="mt-3 text-lg font-semibold">{p.title}</h3>
              {p.tagline && <p className="text-sm opacity-70">{p.tagline}</p>}
            </a>
          ))}
        </div>
      </div>
    </section>
  );
}
```
Motion (hover scale + scroll reveal) isolated in client leaf `gallery-motion.tsx`.

## 4. Mobile fallback
- `< 768px`: `grid-cols-1` (all projects stack). `sm:grid-cols-2`, `lg:grid-cols-3`.
- Spans collapse to 1 at mobile. Image `aspect-[4/3]` retained.
- No horizontal scroll.

## 5. Motion variants
- **MOTION_INTENSITY 1-3:** static; hover scale only.
- **MOTION_INTENSITY 4-7:** scroll-reveal stagger of cards (100ms, 500ms ease-out); hover image scale-105.
- **MOTION_INTENSITY 8-10:** parallax on hover (translateY subtle), tilt on featured project, optional coverflow/carousel. Respect reduced-motion; keep ≤ 2 motion nodes per card.

## 6. Dark-mode notes
- Cards `--color-card`/`--color-border`; text `--color-card-foreground`. Images get no forced filters (they're real). No hardcoded hex.

## 7. Anti-patterns
- Fake/placeholder project images (div-based fake screenshots — Pre-Flight ban).
- Uniform card grid (feels like bento, not portfolio).
- Text overlay on busy image without contrast.
- No pills/labels overlaid on images (Pre-Flight).

## 8. References
- Awwwards portfolio sites (asymmetric curated grids).
