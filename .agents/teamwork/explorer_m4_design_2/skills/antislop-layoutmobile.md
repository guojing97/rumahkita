# Antislop Mobile Layout Skill Reference
Source: /Users/mac/.gemini/config/skills/antislop-layoutmobile/SKILL.md

Core Methodology:
- Mobile is a distinct layout, not desktop squeezed into a narrow box.
- Fluid breakpoints based on content breaking points, supporting continuous width range (360px–390px base up to tablet 768px and desktop 1280px+).
- Zero horizontal scroll leak (R-03, R-35).
- Table-to-card reflow: desktop TanStack table -> mobile card list with high-density stacked cards.
- Minimum 44x44px touch targets with adequate spacing between interactive elements.
- Bottom navigation and bottom-sheet drawers that respect safe area insets and never cover active content.
