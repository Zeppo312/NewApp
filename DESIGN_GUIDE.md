Official Design Guide (App)

Overview
- Single source of truth for design tokens and glass card components lives in `constants/DesignGuide.tsx`.
- Sleep Tracker, Daily (Alltag), and Community screens now use these shared tokens/components.

Tokens (from constants/DesignGuide.tsx)
- Spacing: `LAYOUT_PAD`, `SECTION_GAP_TOP`, `SECTION_GAP_BOTTOM`
- Radius: `RADIUS`
- Colors: `PRIMARY`, `TEXT_PRIMARY`, `GLASS_BORDER`, `GLASS_OVERLAY`
- Typography scale: `FONT_SM`, `FONT_MD`, `FONT_LG`

Components
- `GlassCard`: Static frosted card with blur, border and overlay; ideal for small pills, banners, search bars.
- `LiquidGlassCard`: Tappable glass card with inner overlay; ideal for post cards, action cards, charts.

Usage
- Import from `@/constants/DesignGuide` in screens and components.
- Example:
  - `import { GlassCard, LiquidGlassCard, PRIMARY, LAYOUT_PAD } from '@/constants/DesignGuide';`
- Wrap content in `GlassCard`/`LiquidGlassCard` and keep inner padding (e.g., `padding: 16`).

Adopted Screens
- Sleep Tracker: `app/(tabs)/sleep-tracker.tsx` now imports tokens and glass components.
- Daily (Alltag): `app/(tabs)/daily_old.tsx` now imports tokens and glass components.
- Community: `app/community.tsx` uses `GlassCard` for search and `LiquidGlassCard` for post items.

Notes
- Keep new components/styles minimal and centralize future shared styling here.
- Prefer tokens over hard-coded values across screens.
