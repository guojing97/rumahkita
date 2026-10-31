# Anti-Slop UI Skill Summary & Reference
Source: /Users/mac/.gemini/config/skills/antislop-ui/SKILL.md

Key Methodology:
- No generic blue-purple gradients, no excessive glassmorphism, no uniform pill shapes.
- Hard shadows used strictly according to design tokens: `4px 4px 0 var(--ink)`, large panels `6px 6px 0 var(--ink)`.
- No soft blurry shadows.
- No glowing decorative dots or decorative emoji in UI chrome.
- Accessible contrast (WCAG AA) with status labels combining text + icons, never color alone.
- Mobile touch targets minimum 44x44px.
- Meaningful empty states ("Belum ada transaksi bulan ini" + CTA "Catat transaksi pertama").
- Meaningful error states retaining user inputs and suggesting next actions.
- Form accessibility: permanent visible labels, inline errors near fields, prefix `Rp` for nominal inputs.
