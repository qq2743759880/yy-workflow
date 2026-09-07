---
name: multi-column-footer
category: footer
dial_compatibility:
  variance: [2, 5]
  motion: [1, 3]
  density: [3, 6]
when_to_use: "Standard page footer with brand + link columns + legal/social row. Use on every multi-section marketing/product page. High density is fine (footer is a sitemap)."
not_for: "Minimal single-line footers for one-page sites (use a simpler variant); app in-app footers."
stack: ["react", "next", "tailwind"]
---

# Multi-Column Footer

## 1. Visual sketch
```
┌──────────────────────── 1280 ────────────────────────────┐
│  ┌─brand───┬─Product───┬─Company───┬─Resources──┬─Social─┐ │
│  │ logo    │ feature1  │ about     │ blog       │  [icons] │
│  │ tagline │ feature2  │ careers   │ docs       │         │
│  │         │ feature3  │ contact   │ guides     │         │
│  └─────────┴───────────┴───────────┴────────────┴─────────┘ │
│  ───────────────────── divider ──────────────────────────── │
│  © 2026 Brand    [Legal: Privacy/Terms/Cookies]             │
└──────────────────────────────────────────────────────────────┘
```
Brand col (wider) + 3-4 link cols + optional social icons. Bottom row: copyright + legal links. High density is fine here.

## 2. Props API
```tsx
interface FooterLink { label: string; href: string; }
interface FooterColumn { title: string; links: FooterLink[]; }
interface MultiColumnFooterProps {
  brand: { name: string; tagline?: string };
  columns: FooterColumn[];
  legal?: FooterLink[];
  socials?: { href: string; label: string; icon: string }[];
  copyright: string;
  theme?: "light" | "dark" | "auto";
}
```

## 3. Code sketch
```tsx
// app/components/footer/multi-column.tsx (Server Component)
export function MultiColumnFooter({ brand, columns, legal, socials, copyright, theme = "auto" }: MultiColumnFooterProps) {
  return (
    <footer className="border-t px-4 sm:px-6 lg:px-8 py-12" data-theme={theme}>
      <div className="mx-auto max-w-7xl">
        <div className="grid grid-cols-2 gap-8 sm:grid-cols-3 lg:grid-cols-6">
          <div className="col-span-2">
            <span className="text-lg font-semibold">{brand.name}</span>
            {brand.tagline && <p className="mt-2 text-sm opacity-70">{brand.tagline}</p>}
          </div>
          {columns.map((col) => (
            <nav key={col.title} aria-label={col.title}>
              <h3 className="text-sm font-semibold">{col.title}</h3>
              <ul className="mt-3 space-y-2 text-sm opacity-80">
                {col.links.map((l) => <li key={l.href}><a href={l.href}>{l.label}</a></li>)}
              </ul>
            </nav>
          ))}
        </div>
        <div className="mt-10 flex flex-col gap-3 border-t pt-6 text-sm opacity-70 sm:flex-row sm:items-center sm:justify-between">
          <p>{copyright}</p>
          {legal && legal.length > 0 && (
            <div className="flex flex-wrap gap-4">{legal.map((l) => <a key={l.href} href={l.href}>{l.label}</a>)}</div>
          )}
        </div>
      </div>
    </footer>
  );
}
```

## 4. Mobile fallback
- `< 768px`: `grid-cols-2` → brand spans full, link columns 2-up. Bottom row stacks (column) with `gap-3`.
- No horizontal scroll; `flex-wrap` on legal links.

## 5. Motion variants
- **MOTION_INTENSITY 1-3:** static (default footer).
- **MOTION_INTENSITY 4-7:** optional stagger fade-in of columns on scroll (subtle). Fine to keep static.
- **MOTION_INTENSITY 8-10:** footer stays mostly static (motion here is pointless); only hover micro-interaction on links.

## 6. Dark-mode notes
- Footer surface often distinct: `--color-footer-bg` / `--color-muted-fg`. Links `--color-fg` hover `--color-primary`. No hardcoded hex.

## 7. Anti-patterns
- Footer as `border-t`+`border-b` every row (Pre-Flight ban for lists).
- Decorative version footers (Pre-Flight: no `v1.4.2` on marketing pages).
- Adding footer content not needed; footer is a sitemap, not a feature.
- Social icons from hand-rolled SVG (use allowed library).

## 8. References
- Standard SaaS footers (Linear, Vercel, Stripe) — sitemap-style.
