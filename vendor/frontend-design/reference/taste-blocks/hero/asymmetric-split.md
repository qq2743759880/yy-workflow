---
name: asymmetric-split-hero
category: hero
dial_compatibility:
  variance: [6, 10]
  motion: [3, 10]
  density: [2, 5]
when_to_use: "Landing pages with one strong asset and one strong message. Default hero for SaaS, agency, premium consumer. Highest value when the product's differentiation is visual (product shot, app UI, editorial image)."
not_for: "Editorial / manifesto launches where the message IS the design; trust-first regulated pages that need a centered, symmetric lockup."
stack: ["react", "next", "tailwind", "motion"]
---

# Asymmetric Split Hero

## 1. Visual sketch
```
┌──────────────────────────── 1280 ────────────────────────────┐
│                                                              │
│  [Nav]                                            (80px nav) │
│                                                              │
│  ┌────────────── 560px ──────────────┐  ┌── 600px ──┐        │
│  │ eyebrow                          │  │           │        │
│  │ Headline spans                    │  │  [ASSET]  │        │
│  │ two lines, weight 700             │  │   product │        │
│  │                                   │  │   or app  │        │
│  │ subtext ≤ 20 words, ≤ 4 lines      │  │    shot   │        │
│  │                                   │  │           │        │
│  │ [Primary CTA]  [Secondary]        │  │           │        │
│  └───────────────────────────────────┘  └───────────┘        │
│                    generous white space                        │
└──────────────────────────────────────────────────────────────┘
```
Left: 7/12, right: 5/12. Divider is white space, not a border. Text block is left-aligned, never centered in this variant.

## 2. Props API
```tsx
interface AsymmetricSplitHeroProps {
  eyebrow?: string;          // uppercase micro-label, count against EYEBROW budget
  headline: string;          // ≤ 2 lines at desktop
  subtext?: string;          // ≤ 20 words AND ≤ 4 lines
  primaryCta: { label: string; href: string };
  secondaryCta?: { label: string; href: string };
  asset: { src: string; alt: string; kind: "image" | "video" | "mock" };
  theme?: "light" | "dark" | "auto";
}
```
Server Component default. No client state unless `asset.kind === "video"` or motion needs it.

## 3. Code sketch
```tsx
// app/components/hero/asymmetric-split.tsx (Server Component)
import { MotionClient } from "@/components/motion-client"; // 'use client' leaf

export function AsymmetricSplitHero({
  eyebrow, headline, sub-line, primaryCta, secondaryCta, asset, theme = "auto",
}: AsymmetricSplitHeroProps) {
  return (
    <section
      aria-labelledby="hero-heading"
      className={`min-h-[100dvh] flex items-center px-4 sm:px-6 lg:px-8 pt-24`}
      data-theme={theme}
    >
      <div className="mx-auto max-w-7xl w-full grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-16 items-center">
        <div className="lg:col-span-7 space-y-5">
          {eyebrow && <p className="text-sm uppercase tracking-widest">{eyebrow}</p>}
          <h1 id="hero-heading" className="text-4xl sm:text-5xl lg:text-6xl font-bold leading-[1.05]">
            {headline}
          </h1>
          {sub-line && <p className="max-w-prose text-lg leading-relaxed">{sub-line}</p>}
          <div className="flex flex-wrap gap-3 pt-2">
            <a href={primaryCta.href} className="...">{primaryCta.label}</a>
            {secondaryCta && <a href={secondaryCta.href} className="...">{secondaryCta.label}</a>}
          </div>
        </div>
        <div className="lg:col-span-5">
          {/* Asset: image is Server-safe; video/motion wrap in client leaf */}
          <AssetRenderer asset={asset} />
        </div>
      </div>
    </div>
  );
}
```
Motion (fade-up on scroll, 600ms, `useInView` + `motion.div`) isolated in `src/client/hero-reveal.tsx`.

## 4. Mobile fallback
- `< 768px`: single column, stack `[eyebrow → headline → sub → CTAs → asset]`.
- Asset renders **below** the copy (not above) so the headline is first in tab order and paint.
- CTA buttons become `w-full`, stacked, `gap-2`. Never side-by-side at mobile.
- Padding: `px-4`; container `max-w-7xl mx-auto` preserved.

## 5. Motion variants
- **MOTION_INTENSITY 1-3 (minimal):** static. No entrance animation. CSS `transition` only for CTA hover.
- **MOTION_INTENSITY 4-7 (default):** fade-up reveal of eyebrow → headline (stagger 80ms) → sub → CTAs, each 500-600ms `ease-out`. Asset cross-fades in. All transform/opacity only.
- **MOTION_INTENSITY 8-10 (cinematic):** adds scroll-pinned hero (Section 5.A skeleton) with `scroll` progress driving a subtle asset scale (1 → 1.08) and parallax. Keep under 3 animated nodes; respect `prefers-reduced-motion: reduce` → all animations disabled, content fully visible statically.

## 6. Dark-mode notes
- Tokens from `design-tokens.json` `--color-*` semantic set. `--hero-bg` uses `@media (prefers-color-scheme: dark)` override; text flips via `--color-fg` / `--color-bg`.
- Asset frame: light = subtle shadow + border; dark = same border + reduced shadow (deeper bg already provides depth). No hardcoded hex anywhere.

## 7. Anti-patterns
- Centering the headline when the split is asymmetric — breaks the asymmetry contract.
- Two-column "split header ban": don't reuse this as a generic section header; hero only.
- CTA label wrapping to 2 lines at desktop (Pre-Flight: CTA Button Wrap).
- Floating the headline "halfway down the viewport" (`pt-24` max at desktop).
- Trust micro-strip / tiny tagline below CTAs in the hero (Pre-Flight: Hero stack discipline ≤ 4 text elements).
- Text overlaid on a busy image without contrast.

## 8. References
- Linear-style asymmetric SaaS heroes (asymmetric split with product shot).
- Apple product-marketing hero layout patterns.
- Refactoring UI: asymmetry + generous whitespace for perceived quality.
