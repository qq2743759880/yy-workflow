---
name: sticky-nav
category: navigation
dial_compatibility:
  variance: [2, 5]
  motion: [2, 5]
  density: [2, 4]
when_to_use: "Standard top navigation for marketing/product pages. One-line at desktop, logo + primary links + CTA. Sticky on scroll. Predictable, non-distracting."
not_for: "Mac-OS-dock / magnetic / gooey menus (those are Reference Vocabulary, higher variance); data-heavy app sidebars; megamenu unless needed."
stack: ["react", "next", "tailwind"]
---

# Sticky Nav

## 1. Visual sketch
```
┌──────────────────────── 1280 ────────────────────────────┐
│  [Logo]      Product  Company  Resources  Blog   [CTA]   │
│  ←────────── one line, ≤ 80px height ──────────────────→ │
│                    (sticky on scroll)                     │
└───────────────────────────────────────────────────────────┘
```
One line at desktop. Max ~5 links + 1 CTA. Height ≤ 80px. Logo left, links center/right, CTA right. No tagline under logo, no second nav row.

## 2. Props API
```tsx
interface NavLink { label: string; href: string; }
interface StickyNavProps {
  logo: { name: string; href: string };
  links: NavLink[];           // ≤ 5
  cta?: { label: string; href: string };
  theme?: "light" | "dark" | "auto";
}
```

## 3. Code sketch
```tsx
// app/components/navigation/sticky-nav.tsx (Server Component)
export function StickyNav({ logo, links, cta, theme = "auto" }: StickyNavProps) {
  return (
    <header className="sticky top-0 z-50 border-b bg-background/80 backdrop-blur" data-theme={theme}>
      <nav aria-label="Main" className="mx-auto max-w-7xl flex h-16 items-center justify-between px-4 sm:px-6 lg:px-8">
        <a href={logo.href} className="font-semibold">{logo.label}</a>
        <div className="hidden md:flex items-center gap-6 text-sm">
          {links.map((l) => <a key={l.href} href={l.href} className="opacity-80 hover:opacity-100">{l.label}</a>)}
        </div>
        <div className="flex items-center gap-3">
          {cta && <a href={cta.href} className="hidden md:inline-flex ...">{cta.label}</a>}
          {/* Mobile menu button (client leaf) toggles a simple sheet */}
        </div>
      </nav>
    </header>
  );
}
```
Mobile menu (hamburger → slide-down panel) is a client leaf `mobile-menu.tsx` with `useState`.

## 4. Mobile fallback
- `< 768px`: show hamburger (or hide secondary links), logo + CTA stay. Mobile menu opens as a slide-down panel (client leaf).
- Nav must be `flex-wrap`-safe; no horizontal overflow.
- Height stays ≤ 80px.

## 5. Motion variants
- **MOTION_INTENSITY 1-3:** static; scroll adds bg/blur only.
- **MOTION_INTENSITY 4-7:** nav bg transitions (transparent → solid on scroll), mobile menu animates height/fade (respect reduced-motion).
- **MOTION_INTENSITY 8-10:** optional active-link underline slide / scroll-progress indicator (subtle). Respect reduced-motion.

## 6. Dark-mode notes
- Nav uses `--color-background/80` + `backdrop-blur`; border `--color-border`. Links `--color-fg`. No hardcoded hex.

## 7. Anti-patterns
- Nav on 2 lines at desktop (Pre-Flight: Navigation on ONE line).
- Height > 80px.
- Logo + scroll + social micro-strip (noise).
- Sticky nav that hides content (test overlap with hero).

## 8. References
- Linear, Vercel, Stripe sticky navs.
