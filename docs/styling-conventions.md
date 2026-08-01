# Styling Conventions

## Breakpoint Tiers and Mobile-First Rule

All responsive styling in this codebase follows a **mobile-first** (progressive enhancement) approach, per CLAUDE.md Hard Rule #4. This means:

1. Default styles apply to all screen sizes (mobile-first)
2. Enhancements are applied via `@media (min-width: ...)` queries for larger viewports
3. Never use `@media (max-width: ...)` unless there is a documented, justified exception

### Sanctioned Breakpoint Tiers

| Breakpoint | Context | Direction | Usage |
|---|---|---|---|
| **640px** | Modal/dialog overlays | `@media (max-width: 640px)` | Modal content and shared `.modal` component; on mobile (<= 640px), modals are full-screen bottom sheets; on desktop (> 640px), modals are constrained cards. **Exception to min-width rule.** |
| **900px** | Screen shells (primary tier) | `@media (min-width: 900px)` | Default breakpoint for most page layouts, adaptive grids, and sidebar reveal. Use this for any responsive screen layout that doesn't have a specific requirement. |
| **1024px** | Auth/welcome flows (HD landscape) | `@media (min-width: 1024px)` | Dedicated tier for authentication and welcome screens that adapt to widescreen/landscape display (e.g., 1280×720 reference). |

### Why Desktop-First Queries (640px Modal Exception)

Modal overlays legitimately use `@media (max-width: 640px)` because the architectural behavior reverses at this tier:
- **Default (mobile, < 640px):** modal is full-screen bottom sheet (the "simpler" state)
- **Enhanced (desktop, ≥ 640px):** modal is constrained centered card (the "complex" state)

This is the **only sanctioned use of `max-width` queries**. All other responsive styling must use `min-width` (mobile-first) for consistency and testability.

### Where to Apply Each Tier

- **900px (`min-width`):** Most page layouts, data tables, adaptive column grids, spacing/padding adjustments
- **1024px (`min-width`):** Welcome, login, callback, and other auth-related screens that explicitly target HD/landscape viewports
- **640px (`max-width`):** Modal chrome only (padding, drag handle, layout); *content inside* the modal may use 640px breakpoints if it's part of the modal's responsive behavior (e.g., field layouts that adapt to the modal's width change)

### Non-Standard Breakpoints

Do not introduce new breakpoints (e.g., 768px, 480px, 1200px, 1440px) without first proposing and documenting them in an ADR or this guide. The three tiers above are sufficient for the current design and help reduce cognitive load and maintenance burden.

## Implementation Checklist

When adding responsive styling to a component:

1. Write mobile-first default styles
2. Add `@media (min-width: 900px) { ... }` for desktop enhancements (if needed)
3. Add `@media (min-width: 1024px) { ... }` only for auth/welcome flows
4. Never add `@media (max-width: ...)` unless it is the 640px modal exception and you've documented it
5. Test visual behavior at the boundaries (e.g., 899px → 900px, 1023px → 1024px)
