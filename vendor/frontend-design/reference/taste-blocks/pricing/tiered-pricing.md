---
name: tiered-pricing
category: pricing
dial_compatibility:
  variance: [4, 7]
  motion: [2, 5]
  density: [3, 6]
when_to_use: "3-tier pricing (Basic/Pro/Enterprise) with a clear 'most popular' middle tier. Use for SaaS, subscription products, dev tools. Highlights the recommended plan without aggressive pressure."
not_for: "Usage-based / dynamic pricing (needs custom calculator, not static tiers); B2B sales-led quotes; dashboards."
stack: ["react", "next", "tailwind", "motion"]
---

# Tiered Pricing

## 1. Visual sketch
```
┌──────────────────────── 1280 ────────────────────────────┐
│  eyebrow + H2 + sub                                       │
│  ┌─── 3-col grid (lg:grid-cols-3) ───────────────────┐   │
│  │ Basic        │ ★ Pro (popular)    │ Enterprise     │   │
│  │ $0           │ $29/mo            │ Custom          │   │
│  │ features     │ features + badge   │ features        │   │
│  │ [Start]      │ [Start] highlighted │ [Contact]       │   │
│  └──────────────────────────────────────────────────┘   │
│  (optional) toggle: monthly / annual                     │
└──────────────────────────────────────────────────────────┘
```
Middle "most popular" tier visually distinguished (border/badge/scale) but not gaudy. Prices use `tabular-nums`. Features = concise list, check icons (allowed library), not fake-precise.

## 2. Props API
```tsx
interface Plan {
  name: string;            // "Basic" | "Pro" | "Enterprise"
  price: string;           // "$0" | "$29/mo" | "Custom"
  billingNote?: string;    // "billed annually" etc.
  features: string[];      // concise, no fabricated precision
  cta: { label: string; href: string };
  highlighted?: boolean;   // most popular
}
interface TieredPricingProps {
  plans: Plan[];           // typically 3
  toggle?: { monthlyLabel: string; annualLabel: string };  // optional billing toggle
  theme?: "light" | "dark" | "auto";
}
```

## 3. Code sketch
```tsx
// app/components/pricing/tiered.tsx (Server Component)
export function TieredPricing({ plans, toggle, theme = "auto" }: TieredPricingProps) {
  return (
    <section aria-labelledby="pricing-title" className="px-4 sm:px-6 lg:px-8 py-16" data-theme={theme}>
      <div className="mx-auto max-w-7xl">
        <h2 id="pricing-title" className="...">Pricing</h2>
        <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-3 items-start">
          {plans.map((plan) => (
            <div
              key={plan.name}
              className={plan.highlighted
                ? "rounded-2xl border-2 p-6 lg:scale-[1.03] shadow-lg"
                : "rounded-2xl border p-6"}
            >
              {plan.highlighted && <span className="text-xs uppercase tracking-widest">Most popular</span>}
              <h3 className="mt-2 text-lg font-semibold">{plan.name}</h3>
              <p className="mt-1 text-3xl font-bold tabular-nums">{plan.price}</p>
              {plan.billingNote && <p className="text-sm opacity-70">{plan.billingNote}</p>}
              <ul className="mt-4 space-y-2 text-sm">
                {plan.features.map((f) => <li key={f} className="flex gap-2">✓ {f}</li>)}
              </ul>
              <a href={plan.cta.href} className="mt-6 block ...">{plan.cta.label}</a>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
```
Billing toggle (if used) is a client leaf with `useState` + `useTransition` for smooth price swap.

## 4. Mobile fallback
- `< 768px`: single column, cards stack full-width, `items-start`.
- `lg:scale-[1.03]` only at desktop (removed at mobile).
- CTA `w-full` on mobile.

## 5. Motion variants
- **MOTION_INTENSITY 1-3:** static.
- **MOTION_INTENSITY 4-7:** fade-up stagger of the 3 cards (100-120ms, 450ms). Billing toggle cross-fades price via `transition`.
- **MOTION_INTENSITY 8-10:** optional scroll-reveal of the highlighted card scaling up slightly; price digit roll on toggle (optional). Respect reduced-motion.

## 6. Dark-mode notes
- Cards `--color-card`/`--color-border`; highlighted uses `--color-primary` border + shadow. Text via `--color-card-foreground`. No hardcoded hex.

## 7. Anti-patterns
- More than 4 tiers (too many decisions).
- Fake-precise features (e.g. "unlimited X" that isn't). No fabricated metrics.
- Hiding the middle tier's CTA — "most popular" must still have a clear primary action.
- Cards as default `<ul>` with `divide-y` for > 5 items (Pre-Flight: long lists use right UI).
- Two CTAs same intent (Pre-Flight).

## 8. References
- Linear, Stripe, Supabase pricing page patterns (3-tier with highlighted middle).
