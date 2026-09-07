---
name: testimonial-wall
category: social-proof
dial_compatibility:
  variance: [4, 8]
  motion: [2, 6]
  density: [2, 5]
when_to_use: "Build trust near conversion points (after a feature or before pricing/CTA). Works for enterprise SaaS, consumer apps, agency proof. Use when you have real, citable testimonials — never fabricate quotes."
not_for: "Pages with no genuine testimonials (fabricating = AI tell); hero (logo wall belongs under hero, testimonials as their own section); data-dense dashboards."
stack: ["react", "next", "tailwind", "motion"]
---

# Testimonial Wall

## 1. Visual sketch
```
┌──────────────────────── 1280 ────────────────────────────────┐
│  eyebrow + H2 ("Loved by teams building X")                   │
│  ┌─────────────── 3-col grid (lg) ───────────────┐           │
│  │ ┌─card─┐   ┌─card─┐   ┌─card─┐                 │           │
│  │ │quote │   │quote │   │quote │                 │           │
│  │ │      │   │      │   │      │                 │           │
│  │ │-Name │   │-Name │   │-Name │                 │           │
│  │ │ role │   │ role │   │ role │                 │           │
│  │ └──────┘   └──────┘   └──────┘                 │           │
│  └────────────────────────────────────────────────┘           │
│  [Logo wall / trusted-by strip] (real SVG logos)              │
└────────────────────────────────────────────────────────────────┘
```
Quotes ≤ 3 lines. Attribution: name + role (no em-dash). Cards optional; prefer spacing over card chrome.

## 2. Props API
```tsx
interface Testimonial {
  quote: string;          // ≤ 3 lines of body text
  name: string;
  role: string;
  avatar?: { src: string; alt: string };  // real image, not AI-face
}
interface TestimonialWallProps {
  title: string;
  testimonials: Testimonial[];   // 3-6, real quotes
  logos?: { src: string; alt: string }[];  // real SVG marks (Simple Icons / devicon)
  theme?: "light" | "dark" | "auto";
}
```

## 3. Code sketch
```tsx
// app/components/social-proof/testimonials.tsx (Server Component)
export function TestimonialWall({ title, testimonials, logos }: TestimonialWallProps) {
  return (
    <section aria-labelledby="social-title" className="px-4 sm:px-6 lg:px-8 py-16" data-theme={theme}>
      <div className="mx-auto max-w-7xl">
        <h2 id="social-title" className="...">{title}</h2>
        <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {testimonials.map((t) => (
            <figure key={t.name} className="space-y-3">
              <blockquote className="text-base leading-relaxed">{t.quote}</blockquote>
              <figcaption className="text-sm font-medium">
                {t.name} <span className="opacity-70">· {t.role}</span>
              </figcaption>
            </figure>
          ))}
        </div>
        {logos && logos.length > 0 && (
          <div className="mt-12 flex flex-wrap items-center gap-6 opacity-70">
            {logos.map((l) => <img key={l.src} src={l.src} alt={l.alt} className="h-6 w-auto" />)}
          </div>
        )}
      </div>
    </section>
  );
}
```

## 4. Mobile fallback
- `< 768px`: `grid-cols-1`; quotes stack full-width, gap-6.
- Logo wall becomes `flex-wrap` (never horizontal overflow). No horizontal scroll.
- Attribution stays on one line or wraps cleanly.

## 5. Motion variants
- **MOTION_INTENSITY 1-3:** static.
- **MOTION_INTENSITY 4-7:** fade-up staggered reveal of cards (100-120ms stagger, 450ms ease-out). Logo wall fades in as a block.
- **MOTION_INTENSITY 8-10:** optional autoplay carousel (respect reduced-motion + pause on hover/focus). Do not autoplay by default.

## 6. Dark-mode notes
- Quote text `--color-fg`; attribution `--color-muted-fg`; card (if used) `--color-card`/`--color-border`. Logos get `opacity-70` + optional dark-mode invert filter. No hardcoded hex.

## 7. Anti-patterns
- Fabricated quotes (never ship fake testimonials — Pre-Flight honesty).
- Photo-credit captions as decoration.
- Logo wall = logo only, no category labels printed below logos (Pre-Flight: Logo wall = logo only).
- Score/progress bars as comparison visuals (Pre-Flight ban).
- Two CTAs with same intent on the same page (Pre-Flight: No Duplicate CTA Intent).

## 8. References
- SaaS landing pages with real testimonial walls.
- Refactoring UI: spacing as grouping.
