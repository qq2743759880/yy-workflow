---
name: centered-cta
category: cta
dial_compatibility:
  variance: [3, 7]
  motion: [2, 6]
  density: [1, 3]
when_to_use: "A single, focused call-to-action band before the footer (or after pricing). Best when there is ONE action and no competing links. Center-aligned lockup: H2 + sub + primary CTA."
not_for: "Pages needing two CTA intents (split them); hero (hero has its own rules); trust-first regulated that should avoid pressure copy."
stack: ["react", "next", "tailwind", "motion"]
---

# Centered CTA

## 1. Visual sketch
```
┌──────────────────────── 1280 ────────────────────────────┐
│                                                          │
│  ┌──────────────── centered ──────────────────────────┐  │
│  │                                                     │  │
│  │        H2 "Ready to ship?"                          │  │
│  │        sub ≤ 20 words, ≤ 4 lines                     │  │
│  │                                                     │  │
│  │              [Primary CTA]                           │  │
│  │                                                     │  │
│  └─────────────────────────────────────────────────────┘  │
│  (optional subtle background: gradient / pattern, quiet)   │
└──────────────────────────────────────────────────────────────┘
```
One CTA. Max one intent. Generous vertical padding; content vertically centered. No trust micro-strip below the CTA.

## 2. Props API
```tsx
interface CenteredCtaProps {
  headline: string;         // ≤ 2 lines
  subtext?: string;         // ≤ 60 words, ≤ 4 lines
  primaryCta: { label: string; href: string };
  background?: "plain" | "gradient" | "pattern";
  theme?: "light" | "dark" | "auto";
}
```

## 3. Code sketch
```tsx
// app/components/cta/centered.tsx (Server Component)
export function CenteredCta({ headline, subtext, primaryCta, background = "plain", theme = "auto" }: CenteredCtaProps) {
  return (
    <section aria-labelledby="cta-title" className="px-4 sm:px-6 lg:px-8 py-24" data-theme={theme}>
      <div className={`mx-auto max-w-2xl text-center ${background === "gradient" ? "rounded-3xl p-12 bg-gradient..." : ""}`}>
        <h2 id="cta-title" className="text-3xl sm:text-4xl font-bold leading-[1.1]">{headline}</h2>
        {subtext && <p className="mt-4 text-lg text-balance">{subtext}</p>}
        <a href={primaryCta.href} className="mt-8 inline-flex ...">{primaryCta.label}</a>
      </div>
    </section>
  );
}
```

## 4. Mobile fallback
- `< 768px`: single column, text centered (already), `px-4`. CTA `w-full` or auto with padding.
- Background gradient/pattern must not reduce contrast (Pre-Flight: Button Contrast).
- No horizontal overflow.

## 5. Motion variants
- **MOTION_INTENSITY 1-3:** static.
- **MOTION_INTENSITY 4-7:** fade-up reveal of headline → sub → CTA (80-100ms stagger, 450ms). 
- **MOTION_INTENSITY 8-10:** subtle background drift (mesh gradient slow pan) + CTA magnetic/hover micro-interaction. Respect reduced-motion.

## 6. Dark-mode notes
- Background uses `--color-*-gradient` tokens; text `--color-fg`. Gradient/pattern must pass on dark too. No hardcoded hex.

## 7. Anti-patterns
- Two CTAs with same intent on page (Pre-Flight).
- CTA label wraps to 2+ lines at desktop.
- Trust micro-strip / social-proof inside the CTA band (keep it minimal).
- Decoration text strip at band bottom.
- Locale/time/city strips (Pre-Flight) unless relevant.

## 8. References
- Refactoring UI: one strong CTA, centered lockup.
- Common SaaS pre-footer CTA bands.
