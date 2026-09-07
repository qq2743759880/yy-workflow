---
name: sticky-scroll-stack
category: transition
dial_compatibility:
  variance: [7, 10]
  motion: [8, 10]
  density: [2, 4]
when_to_use: "Story-driven scroll sections (product narrative, timeline, case-study reveal). Cards/sections pin and physically stack as the user scrolls. High motion, high variance — for editorial/creative/storytelling pages."
not_for: "Information-dense pages (admin, docs); pages that must stay scannable; low-motion briefs."
stack: ["react", "next", "tailwind", "gsap", "motion"]
---

# Sticky Scroll Stack

## 1. Visual sketch
```
  scroll ↓
┌───────────────┐
│ [section 1]    │ pinned (sticky)
└───────────────┘
      ↓ next section slides OVER / UNDER, stacking
┌───────────────┐
│ [section 2]    │
└───────────────┘
  ...sections physically stack like cards
```
Each section pins (sticky) while the next scrolls over it. Sections stack vertically — the "sticky stack" effect. Must use the canonical skeleton (Pre-Flight 5.A: `start: "top top"`, `pin: true`, correct `scrub`).

## 2. Props API
```tsx
interface StackSection {
  id: string;
  headline: string;
  body: string;
  visual?: { kind: "image" | "video" | "text"; src?: string; alt?: string };
}
interface StickyScrollStackProps {
  sections: StackSection[];   // 3-6
  theme?: "light" | "dark" | "auto";
}
```

## 3. Code sketch
```tsx
// app/components/transition/sticky-scroll-stack.tsx
// Server wrapper + client leaf for GSAP pinning
// Uses Section 5.A canonical skeleton: gsap ScrollTrigger, start:"top top", pin:true, scrub
// Each section is a sticky child; next section overlaps via absolute/pinned positioning.
// Isolate in dedicated leaf component with useEffect cleanup (gsap.context / ScrollTrigger.kill()).
```
Client-only; requires GSAP + ScrollTrigger. Cleanup mandatory.

## 4. Mobile fallback
- `< 768px`: **disable pinning** — stack becomes a normal vertical list (sticky scroll hijacks break small screens). Sections render in normal document flow.
- Ensure no scroll trap on mobile; `overflow` restored to normal.

## 5. Motion variants
- **MOTION_INTENSITY 1-7:** not appropriate — sticky stack is inherently high-motion; if MOTION_INTENSITY < 8, use a different block (e.g. plain feature stack).
- **MOTION_INTENSITY 8-10:** full pin-and-stack with scrub. Reduced-motion → fall back to static stacked list (content fully visible).

## 6. Dark-mode notes
- Each card surface `--color-card`/`--color-border`; text `--color-fg`. Ensure stacked cards visually separate (border/shadow per card). No hardcoded hex.

## 7. Anti-patterns
- Using on low-motion pages (Motion claimed = motion shown — Pre-Flight).
- No `prefers-reduced-motion: reduce` fallback.
- Missing ScrollTrigger cleanup (memory leak).
- Mixing GSAP with Motion in same tree (Pre-Flight ban) — this block is GSAP; don't also add Motion here.
- No `window.addEventListener('scroll')` (Pre-Flight).

## 8. References
- Product storytelling scroll sections (Apple, Stripe narrative).
