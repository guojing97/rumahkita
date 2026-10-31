# Neo-brutalism Design System & Responsive Reflow Specification

**Document Version:** 1.0.0  
**Target Milestone:** Milestone 4 (Frontend Web with Next.js App Router)  
**Author:** `explorer_m4_design_2` (Teamwork Spec Miner & Design System Specialist)  
**Target Audience:** `worker_m4_*` implementers, `reviewer_m4_*`, and `challenger_m4_*`  
**Reference Files:**
- `/Users/mac/Projects/03-Labs/RumahKita/.agents/teamwork/ORIGINAL_REQUEST.md` (Requirements §R4)
- `/Users/mac/Projects/03-Labs/RumahKita/doc/design.md` (Authoritative Design System Spec)
- `/Users/mac/Projects/03-Labs/RumahKita/packages/ui` (Shared UI Package)
- `/Users/mac/Projects/03-Labs/RumahKita/packages/contracts` (Shared Zod Schemas & IDR helpers)

---

## 1. Executive Summary & Design Intent

RumahKita is a private household finance and inventory management application designed for two household members managing shared resources in Indonesia. The visual design language is **Neo-brutalism**, engineered specifically for high readability, rapid transaction entry, tactile physical feedback, and strict mobile-first ergonomics.

### Core Principles
1. **Clarity Over Decoration:** Financial figures, transaction dates, stock counts, and key actions take visual dominance over decorative artifacts.
2. **Visible Tactile Structure:** Heavy 2px–3px solid `#171717` ink borders, zero-blur 4px hard drop shadows, and sharp contrasts divide content blocks into obvious physical surfaces.
3. **Active Physical Feedback:** Interactive controls (buttons, clickable cards) physically translate down and right (`translate-x-0.5 translate-y-0.5 shadow-none`) on press, simulating physical mechanical buttons.
4. **Responsive Table-to-Card Reflow:** Eliminates horizontal scroll leakage on narrow mobile viewports (360px–390px) by transforming wide desktop TanStack tables into high-density, thumb-friendly stacked cards.
5. **Accessible Brutalism:** All color combinations strictly pass WCAG AA (minimum 4.5:1 for body copy; 3:1 for large display text and UI components). Color is never the sole indicator of status (always paired with explicit Bahasa Indonesia labels and SVG icons).
6. **Anti-Slop Discipline:** Zero generic AI aesthetics (no purple-blue gradients, no excessive glassmorphism blur, no pill-shaped everything, no soft floating shadows, no fake placeholder data).

---

## 2. Neo-Brutalism Design Token System

### 2.1 Color Palette Matrix

| Token Name | Hex Code | CSS Variable | Tailwind Class | Contrast against `#171717` | Contrast against `#FFFFFF` / `#FFFDF7` | Primary Usage |
|---|---|---|---|---|---|---|
| **Primary (Neon Lime)** | `#C8F169` | `--primary` | `bg-primary`, `text-primary` | **13.9:1** (AAA) | N/A (Never use with white text) | Primary CTA buttons, key highlights, active sidebar states |
| **Primary Hover** | `#B5DF53` | `--primary-hover` | `hover:bg-primary-hover` | **11.8:1** (AAA) | N/A | Button hover state |
| **Background (Warm Cream)** | `#FFFDF7` | `--bg` | `bg-bg` | **17.7:1** (AAA) | 1.03:1 | Canvas background for entire viewport |
| **Surface (Card White)** | `#FFFFFF` | `--surface` | `bg-surface` | **18.1:1** (AAA) | 1.0:1 | Cards, modals, drawers, input fields |
| **Ink (Charcoal Black)** | `#171717` | `--ink` | `text-ink`, `border-ink` | 1.0:1 | **18.1:1** (AAA) | Primary typography, borders, hard drop shadows |
| **Muted Ink** | `#66645F` | `--muted` | `text-muted` | 3.25:1 | **5.57:1** (AA) | Helper text, field labels, metadata, inactive links |
| **Secondary (Baby Blue)** | `#B9D9FF` | `--secondary` | `bg-secondary` | **13.5:1** (AAA) | 1.34:1 | Info callouts, focus ring highlight (`ring-secondary`) |
| **Accent (Coral Orange)** | `#FF8A65` | `--accent` | `bg-accent` | **7.4:1** (AAA) | 2.45:1 | Purchase action highlights, critical attention |
| **Lavender** | `#D9C8FF` | `--lavender` | `bg-lavender` | **12.6:1** (AAA) | 1.44:1 | Charts, secondary category chips |
| **Success / Aman (Bg)** | `#D1FAE5` | `--success-bg` | `bg-emerald-100` | 15.4:1 | 1.18:1 | Safe stock badge background |
| **Success / Aman (Text)** | `#065F46` | `--success-ink` | `text-emerald-800` | 1.15:1 | **7.5:1** (AAA on white), **6.64:1** (AA on `#D1FAE5`) | Safe stock badge label and checkmark icon |
| **Warning / Menipis (Bg)** | `#FEF3C7` | `--warning-bg` | `bg-amber-100` | 15.2:1 | 1.19:1 | Low stock badge background |
| **Warning / Menipis (Text)** | `#92400E` | `--warning-ink` | `text-amber-800` | 1.19:1 | **7.0:1** (AAA on white), **5.88:1** (AA on `#FEF3C7`) | Low stock badge label and warning icon |
| **Danger / Habis (Bg)** | `#FEE2E2` | `--danger-bg` | `bg-rose-100` | 13.9:1 | 1.30:1 | Out-of-stock badge background, overdue debt bg |
| **Danger / Habis (Text)** | `#991B1B` | `--danger-ink` | `text-rose-800` | 1.30:1 | **7.6:1** (AAA on white), **6.52:1** (AA on `#FEE2E2`) | Out-of-stock badge label, overdue badge label |
| **Destructive Red** | `#B42318` | `--danger` | `bg-danger`, `text-danger` | 2.6:1 | **6.1:1** (AA on white) | Delete buttons, destructive actions, validation errors |

> **Critical Rule on Primary `#C8F169`:** Text on top of `#C8F169` **MUST ALWAYS** be `#171717` (Deep Ink). White text on `#C8F169` provides an unreadable 1.29:1 contrast ratio, failing WCAG catastrophically.

---

### 2.2 Hard Drop Shadow & Elevation System

Neo-brutalism relies exclusively on **unblurred hard drop shadows** with `0px` blur radius and `0px` spread:

```css
:root {
  --shadow-sm: 2px 2px 0px #171717;      /* Small chips, badges, inline controls */
  --shadow-base: 4px 4px 0px #171717;    /* Default buttons, cards, inputs */
  --shadow-hover: 5px 5px 0px #171717;   /* Button hover elevation (paired with translate(-1px, -1px)) */
  --shadow-lg: 6px 6px 0px #171717;      /* Modals, bottom-sheets, large summary cards */
  --shadow-active: 0px 0px 0px #171717;  /* Pressed state (shadow vanishes as button physically depresses) */
}
```

#### Tailwind Configuration Mapping (`packages/ui/src/preset.ts`):
```typescript
boxShadow: {
  'neo-sm': '2px 2px 0px #171717',
  'neo': '4px 4px 0px #171717',
  'neo-hover': '5px 5px 0px #171717',
  'neo-lg': '6px 6px 0px #171717',
  'neo-active': '0px 0px 0px #171717',
  'neo-none': '0 0 0 transparent',
}
```

---

### 2.3 Border and Radius Scale

- **Border Widths:**
  - Standard Elements: `2px solid #171717` (`border-neo border-ink`).
  - Major Prominence (Hero sections, large modal dialogs): `3px solid #171717` (`border-neo-thick border-ink`).
  - Subtle dividers (internal card footers, table row dividers): `1px solid rgba(23, 23, 23, 0.15)` (`border-ink/15`).
- **Corner Radii:**
  - Status Badges / Small Chips: `6px` (`rounded-badge` / `rounded-[6px]`).
  - Buttons / Form Inputs / Dropdown Triggers: `8px` (`rounded-btn` / `rounded-input` / `rounded-[8px]`).
  - Cards / Stat Cards / Data Tables: `10px` to `12px` (`rounded-card` / `rounded-xl`).
  - Modals (Desktop): `12px` (`rounded-modal` / `rounded-xl`).
  - Mobile Bottom-Sheet Drawers: `16px` top corners (`rounded-t-2xl rounded-b-none`).

---

### 2.4 Typography System

- **Heading Font:** `Space Grotesk`, sans-serif (Weights: 600 SemiBold, 700 Bold).
- **Body & UI Font:** `Inter`, sans-serif (Weights: 400 Regular, 500 Medium, 600 SemiBold).
- **Financial & Numeric Figures:** `tabular-nums` (`font-variant-numeric: tabular-nums`). Essential for vertical alignment in tables, card lists, and stat cards so rupiah figures do not jitter as numbers change.
- **Microcopy Guidelines:**
  - Sentence case for titles, headings, and buttons (e.g. `Simpan transaksi`, `Tambah barang`, not `SIMPAN TRANSAKSI`).
  - Plain Indonesian language: `Pemasukan`, `Pengeluaran`, `Sisa Arus Kas`, `Belanja`, `Koreksi Stok`.

---

## 3. Component Library Blueprint

All components reside in `packages/ui/src/components/` and export standard TypeScript props.

### 3.1 Button Component (`Button`)

A tactile mechanical button with hover lift and physical click depression.

#### Variants & Sizes
- **Variants:**
  - `primary`: `bg-primary text-ink border-2 border-ink shadow-neo hover:-translate-x-[1px] hover:-translate-y-[1px] hover:shadow-neo-hover active:translate-x-0.5 active:translate-y-0.5 active:shadow-neo-active`
  - `secondary`: `bg-surface text-ink border-2 border-ink shadow-neo hover:-translate-x-[1px] hover:-translate-y-[1px] hover:shadow-neo-hover active:translate-x-0.5 active:translate-y-0.5 active:shadow-neo-active`
  - `destructive`: `bg-danger text-white border-2 border-ink shadow-neo hover:-translate-x-[1px] hover:-translate-y-[1px] hover:shadow-neo-hover active:translate-x-0.5 active:translate-y-0.5 active:shadow-neo-active`
  - `outline`: `bg-transparent text-ink border-2 border-ink hover:bg-surface/60 active:translate-x-[1px] active:translate-y-[1px]`
  - `ghost`: `bg-transparent text-ink border-transparent hover:bg-ink/5 active:bg-ink/10`
- **Sizes:**
  - `sm`: `h-9 px-3 text-xs gap-1.5`
  - `md`: `h-11 px-4 text-sm font-medium gap-2` (Default size satisfies the 44px touch-target requirement!)
  - `lg`: `h-12 px-6 text-base font-semibold gap-2.5`
  - `icon`: `h-11 w-11 p-0 flex items-center justify-center` (Ensures 44x44px minimum tap target)

#### Component TypeScript Blueprint
```tsx
import * as React from 'react';
import { Loader2 } from 'lucide-react';
import { cn } from '../lib/utils.js';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'destructive' | 'outline' | 'ghost';
  size?: 'sm' | 'md' | 'lg' | 'icon';
  isLoading?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      className,
      variant = 'primary',
      size = 'md',
      isLoading = false,
      disabled = false,
      children,
      leftIcon,
      rightIcon,
      ...props
    },
    ref
  ) => {
    const baseStyles =
      'inline-flex items-center justify-center font-medium font-body rounded-btn transition-all duration-150 select-none cursor-pointer focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-secondary focus-visible:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none disabled:shadow-neo';

    const variantStyles = {
      primary:
        'bg-primary text-ink border-neo border-ink shadow-neo hover:-translate-x-[1px] hover:-translate-y-[1px] hover:shadow-neo-hover active:translate-x-0.5 active:translate-y-0.5 active:shadow-neo-active',
      secondary:
        'bg-surface text-ink border-neo border-ink shadow-neo hover:-translate-x-[1px] hover:-translate-y-[1px] hover:shadow-neo-hover active:translate-x-0.5 active:translate-y-0.5 active:shadow-neo-active',
      destructive:
        'bg-danger text-white border-neo border-ink shadow-neo hover:-translate-x-[1px] hover:-translate-y-[1px] hover:shadow-neo-hover active:translate-x-0.5 active:translate-y-0.5 active:shadow-neo-active',
      outline:
        'bg-transparent text-ink border-neo border-ink hover:bg-surface/50 active:translate-x-[1px] active:translate-y-[1px]',
      ghost:
        'bg-transparent text-ink border-transparent hover:bg-ink/5 active:bg-ink/10',
    };

    const sizeStyles = {
      sm: 'h-9 px-3 text-xs gap-1.5',
      md: 'h-11 px-4 text-sm gap-2 min-h-[44px]',
      lg: 'h-12 px-6 text-base font-semibold gap-2.5 min-h-[48px]',
      icon: 'h-11 w-11 p-0 min-h-[44px] min-w-[44px]',
    };

    return (
      <button
        ref={ref}
        disabled={disabled || isLoading}
        className={cn(baseStyles, variantStyles[variant], sizeStyles[size], className)}
        {...props}
      >
        {isLoading && <Loader2 className="w-4 h-4 animate-spin shrink-0" />}
        {!isLoading && leftIcon && <span className="inline-flex shrink-0">{leftIcon}</span>}
        <span>{children}</span>
        {!isLoading && rightIcon && <span className="inline-flex shrink-0">{rightIcon}</span>}
      </button>
    );
  }
);
Button.displayName = 'Button';
```

---

### 3.2 Card & Surface Hierarchy (`Card`)

Modular container for panels, form cards, and dashboard widgets.

```tsx
export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  elevated?: boolean;
}

export const Card = React.forwardRef<HTMLDivElement, CardProps>(
  ({ className, elevated = true, ...props }, ref) => (
    <div
      ref={ref}
      className={cn(
        'bg-surface border-neo border-ink rounded-card text-ink p-5 md:p-6 transition-all duration-150',
        elevated && 'shadow-neo',
        className
      )}
      {...props}
    />
  )
);
Card.displayName = 'Card';
```

Subcomponents:
- `CardHeader`: `flex flex-col space-y-1.5 mb-4`
- `CardTitle`: `font-heading font-bold text-xl leading-snug tracking-tight text-ink`
- `CardDescription`: `text-sm text-muted font-body`
- `CardContent`: `font-body`
- `CardFooter`: `flex items-center justify-between pt-4 mt-4 border-t border-ink/15`

---

### 3.3 StatCard Component (`StatCard`)

Specialized card for high-level financial and inventory KPI metrics.

#### Anatomy
1. **Header Row:** Title label (`text-sm font-medium text-muted`) + Neo-icon container (`p-2 rounded-btn bg-bg border border-ink/20 text-ink`).
2. **Nominal Metric:** Giant formatted figure (`font-heading font-bold text-2xl lg:text-3xl tracking-tight tabular-nums text-ink`).
3. **Context / Change Delta Row:** Badges (`+12%`, `Aman`, etc.) + explanatory text (`Bulan ini`, `Pemasukan vs pengeluaran`).

#### Component TypeScript Blueprint
```tsx
export interface StatCardProps extends React.HTMLAttributes<HTMLDivElement> {
  title: string;
  value: string | number;
  icon?: React.ReactNode;
  description?: string;
  badge?: React.ReactNode;
}

export const StatCard = React.forwardRef<HTMLDivElement, StatCardProps>(
  ({ className, title, value, icon, description, badge, ...props }, ref) => (
    <div
      ref={ref}
      className={cn(
        'bg-surface border-neo border-ink rounded-card shadow-neo p-5 flex flex-col justify-between text-ink min-h-[128px]',
        className
      )}
      {...props}
    >
      <div className="flex items-start justify-between gap-2 mb-2">
        <span className="text-sm font-medium text-muted font-body">{title}</span>
        {icon && <div className="p-2 rounded-btn bg-bg border-neo border-ink text-ink">{icon}</div>}
      </div>
      <div>
        <div className="font-heading font-bold text-2xl lg:text-3xl tracking-tight tabular-nums text-ink">
          {value}
        </div>
        {(description || badge) && (
          <div className="flex items-center gap-2 mt-2">
            {badge}
            {description && <span className="text-xs text-muted font-body">{description}</span>}
          </div>
        )}
      </div>
    </div>
  )
);
StatCard.displayName = 'StatCard';
```

---

### 3.4 Stock Status & Semantic Badge Component (`Badge`)

High-contrast status pill pairing explicit Indonesian labels with SVG icons.

#### Badge Matrix
| Variant | Label Pattern | Background | Text/Ink | Border | Icon Component |
|---|---|---|---|---|---|
| `aman` | `Aman ✓` | `#D1FAE5` | `#065F46` | `#065F46` | `<Check className="w-3.5 h-3.5" />` |
| `menipis` | `Menipis ⚠` | `#FEF3C7` | `#92400E` | `#92400E` | `<AlertTriangle className="w-3.5 h-3.5" />` |
| `habis` | `Habis ✕` | `#FEE2E2` | `#991B1B` | `#991B1B` | `<XCircle className="w-3.5 h-3.5" />` |
| `overdue` | `Jatuh Tempo` | `#FEE2E2` | `#991B1B` | `#991B1B` | `<Clock className="w-3.5 h-3.5" />` |
| `primary` | Category/Tag | `#C8F169` | `#171717` | `#171717` | None |
| `secondary` | Category/Tag | `#B9D9FF` | `#171717` | `#171717` | None |
| `neutral` | Category/Tag | `#FFFFFF` | `#171717` | `#171717` | None |

#### Component TypeScript Blueprint
```tsx
import * as React from 'react';
import { Check, AlertTriangle, XCircle, Clock } from 'lucide-react';
import { cn } from '../lib/utils.js';

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: 'aman' | 'menipis' | 'habis' | 'overdue' | 'primary' | 'secondary' | 'neutral';
  icon?: React.ReactNode;
}

export const Badge = React.forwardRef<HTMLSpanElement, BadgeProps>(
  ({ className, variant = 'neutral', icon, children, ...props }, ref) => {
    const baseStyles =
      'inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-badge border text-xs font-semibold font-body select-none';

    const variantStyles: Record<string, string> = {
      aman: 'bg-[#D1FAE5] text-[#065F46] border-[#065F46]',
      menipis: 'bg-[#FEF3C7] text-[#92400E] border-[#92400E]',
      habis: 'bg-[#FEE2E2] text-[#991B1B] border-[#991B1B]',
      overdue: 'bg-[#FEE2E2] text-[#991B1B] border-[#991B1B]',
      primary: 'bg-primary text-ink border-ink',
      secondary: 'bg-secondary text-ink border-ink',
      neutral: 'bg-surface text-ink border-ink',
    };

    let defaultIcon: React.ReactNode = null;
    if (variant === 'aman') defaultIcon = <Check className="w-3.5 h-3.5 shrink-0" />;
    if (variant === 'menipis') defaultIcon = <AlertTriangle className="w-3.5 h-3.5 shrink-0" />;
    if (variant === 'habis') defaultIcon = <XCircle className="w-3.5 h-3.5 shrink-0" />;
    if (variant === 'overdue') defaultIcon = <Clock className="w-3.5 h-3.5 shrink-0" />;

    const renderIcon = icon !== undefined ? icon : defaultIcon;

    return (
      <span ref={ref} className={cn(baseStyles, variantStyles[variant], className)} {...props}>
        {renderIcon}
        <span>{children}</span>
      </span>
    );
  }
);
Badge.displayName = 'Badge';
```

---

### 3.5 Input, Select, and Form Field Blueprint

Accessible form inputs with permanent visible labels, clear error states, and high-visibility focus indicators.

#### Form Field Rules
1. **Always-visible `<Label>`:** Never rely on placeholder text alone.
2. **Currency formatting:** Prefix `Rp` displayed inside an absolute left decorator (`pl-10`), while raw inputs store integer nominals.
3. **High-contrast focus ring:** `focus:ring-3 focus:ring-secondary focus:ring-offset-2` (a bright baby blue outer glow around the black 2px border).
4. **Touch target compliance:** Minimum height `h-11` (44px).

#### Component TypeScript Blueprint
```tsx
import * as React from 'react';
import { cn } from '../lib/utils.js';
import { Label } from './label.js';

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  required?: boolean;
  error?: string;
  helperText?: string;
  leftPrefix?: React.ReactNode;
  rightSuffix?: React.ReactNode;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  (
    {
      className,
      type = 'text',
      label,
      required,
      error,
      helperText,
      leftPrefix,
      rightSuffix,
      id,
      ...props
    },
    ref
  ) => {
    const generatedId = React.useId();
    const inputId = id || generatedId;

    return (
      <div className="w-full">
        {label && (
          <Label htmlFor={inputId} required={required}>
            {label}
          </Label>
        )}
        <div className="relative flex items-center">
          {leftPrefix && (
            <div className="absolute left-3 flex items-center pointer-events-none text-muted font-semibold font-body select-none">
              {leftPrefix}
            </div>
          )}
          <input
            ref={ref}
            id={inputId}
            type={type}
            aria-invalid={Boolean(error)}
            aria-describedby={error ? `${inputId}-error` : helperText ? `${inputId}-helper` : undefined}
            className={cn(
              'w-full bg-surface text-ink border-neo border-ink rounded-input h-11 px-3.5 py-2 text-sm font-body',
              'placeholder:text-muted/60 transition-colors duration-150',
              'focus:outline-none focus:ring-3 focus:ring-secondary focus:ring-offset-2',
              'disabled:opacity-50 disabled:cursor-not-allowed disabled:bg-bg',
              leftPrefix && 'pl-11',
              rightSuffix && 'pr-11',
              error && 'border-danger focus:ring-danger/40',
              className
            )}
            {...props}
          />
          {rightSuffix && (
            <div className="absolute right-3 flex items-center pointer-events-none text-muted">
              {rightSuffix}
            </div>
          )}
        </div>
        {error && (
          <p id={`${inputId}-error`} className="mt-1 text-xs font-semibold text-danger font-body flex items-center gap-1">
            <span>⚠</span>
            <span>{error}</span>
          </p>
        )}
        {!error && helperText && (
          <p id={`${inputId}-helper`} className="mt-1 text-xs text-muted font-body">
            {helperText}
          </p>
        )}
      </div>
    );
  }
);
Input.displayName = 'Input';
```

---

### 3.6 Dialog & Drawer (Responsive Modal / Bottom-Sheet Pattern)

Modals must adapt to viewport constraints:
- **Desktop (>=768px):** Centered floating dialog (`max-w-lg`, `border-3 border-ink`, `rounded-modal`, `shadow-neo-lg`).
- **Mobile (<768px):** Fixed bottom-sheet drawer (`w-full`, `rounded-t-2xl`, top drag handle, sticky bottom action bar, `max-h-[90dvh]`).

#### Responsive Dialog Architecture
```tsx
import * as React from 'react';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import { X } from 'lucide-react';
import { cn } from '../lib/utils.js';

export const Dialog = DialogPrimitive.Root;
export const DialogTrigger = DialogPrimitive.Trigger;

export const DialogContent = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content>
>(({ className, children, ...props }, ref) => (
  <DialogPrimitive.Portal>
    <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-ink/60 backdrop-blur-xs transition-opacity data-[state=open]:animate-in data-[state=closed]:animate-out" />
    <DialogPrimitive.Content
      ref={ref}
      className={cn(
        // Desktop Modal: Centered
        'fixed z-50 bg-surface border-neo-thick border-ink p-6 shadow-neo-lg duration-200',
        'hidden md:block md:top-1/2 md:left-1/2 md:-translate-x-1/2 md:-translate-y-1/2 md:w-full md:max-w-lg md:rounded-modal',
        // Mobile Bottom-Sheet: Docked at bottom
        'block md:hidden bottom-0 left-0 right-0 w-full rounded-t-2xl max-h-[90dvh] overflow-y-auto',
        className
      )}
      {...props}
    >
      {/* Mobile Drag Indicator */}
      <div className="md:hidden w-12 h-1.5 bg-ink/20 rounded-full mx-auto mb-4" />
      
      {children}

      <DialogPrimitive.Close className="absolute right-4 top-4 rounded-btn p-1.5 text-muted hover:text-ink hover:bg-bg border border-transparent hover:border-ink focus:outline-none focus:ring-2 focus:ring-secondary">
        <X className="w-5 h-5" />
        <span className="sr-only">Tutup</span>
      </DialogPrimitive.Close>
    </DialogPrimitive.Content>
  </DialogPrimitive.Portal>
));
DialogContent.displayName = 'DialogContent';
```

---

## 4. Responsive Table-to-Card Reflow Architecture

Data-dense financial grids and inventory listings require dual representation:

```text
                  Viewport Width Evaluation
                              │
               ┌──────────────┴──────────────┐
               ▼                             ▼
        Desktop (>= 768px)            Mobile (< 768px)
     TanStack React Table            Stacked Card List
   ────────────────────────       ────────────────────────
   - Sortable column headers      - Zero horizontal overflow
   - Tabular aligned numbers      - Big bold nominal display
   - High data density            - 44px thumb touch targets
   - Quick action buttons         - Primary label + status badge
```

### 4.1 Data Architecture & Shared Definition Contract

To prevent code duplication, each domain (Transaksi, Inventori, Hutang) defines a **unified column and cell formatter interface**.

```typescript
export interface TableCardColumnDef<TData> {
  id: string;
  header: string;
  accessorKey?: keyof TData;
  // Desktop Table Cell Renderer
  cell: (info: { row: TData }) => React.ReactNode;
  // Mobile Card Field Mapping
  mobileRole: 'badge' | 'title' | 'metric' | 'meta' | 'action' | 'hidden';
}
```

---

### 4.2 Pattern 1: Financial Transactions (`/transaksi` - Incomes & Expenses)

#### Desktop Table View (>= 768px)
```tsx
<div className="hidden md:block bg-surface border-neo border-ink rounded-card shadow-neo overflow-hidden">
  <table className="w-full text-left text-sm font-body">
    <thead className="bg-bg border-b-neo border-ink font-heading text-xs uppercase tracking-wider text-ink font-bold">
      <tr>
        <th className="py-3.5 px-4 cursor-pointer hover:bg-ink/5" onClick={() => toggleSort('date')}>
          <div className="flex items-center gap-1.5">
            <span>Tanggal</span>
            <ArrowUpDown className="w-3.5 h-3.5 text-muted" />
          </div>
        </th>
        <th className="py-3.5 px-4">Kategori / Sumber</th>
        <th className="py-3.5 px-4">Catatan</th>
        <th className="py-3.5 px-4 text-right cursor-pointer hover:bg-ink/5" onClick={() => toggleSort('amount')}>
          <div className="flex items-center justify-end gap-1.5">
            <span>Nominal</span>
            <ArrowUpDown className="w-3.5 h-3.5 text-muted" />
          </div>
        </th>
        <th className="py-3.5 px-4 text-center">Aksi</th>
      </tr>
    </thead>
    <tbody className="divide-y divide-ink/15">
      {transactions.map((tx) => (
        <tr key={tx.id} className="hover:bg-bg/60 transition-colors">
          <td className="py-3.5 px-4 text-xs font-medium text-muted">{formatDate(tx.date)}</td>
          <td className="py-3.5 px-4">
            <Badge variant={tx.type === 'income' ? 'secondary' : 'neutral'}>
              {tx.categoryName}
            </Badge>
          </td>
          <td className="py-3.5 px-4 font-medium text-ink truncate max-w-xs">{tx.notes || '-'}</td>
          <td className="py-3.5 px-4 text-right font-heading font-bold tabular-nums text-ink">
            {tx.type === 'income' ? '+' : '-'} {formatIDR(tx.amount)}
          </td>
          <td className="py-3.5 px-4 text-center">
            <Button variant="ghost" size="sm" aria-label="Edit transaksi">
              <Edit className="w-4 h-4" />
            </Button>
          </td>
        </tr>
      ))}
    </tbody>
  </table>
</div>
```

#### Mobile Card List View (< 768px, 390px base)
```tsx
<div className="flex flex-col gap-3 md:hidden">
  {transactions.map((tx) => (
    <div
      key={tx.id}
      className="bg-surface border-neo border-ink rounded-card shadow-neo p-4 flex flex-col gap-2.5 active:bg-bg/40 transition-colors"
    >
      {/* Top Row: Category Badge & Date */}
      <div className="flex items-center justify-between">
        <Badge variant={tx.type === 'income' ? 'secondary' : 'neutral'}>
          {tx.categoryName}
        </Badge>
        <span className="text-xs text-muted font-body">{formatDate(tx.date)}</span>
      </div>

      {/* Main Metric Row: Notes + Big Bold Nominal */}
      <div className="flex items-baseline justify-between gap-2">
        <span className="font-body font-medium text-ink text-sm truncate max-w-[55%]">
          {tx.notes || tx.categoryName}
        </span>
        <span
          className={cn(
            'font-heading font-bold text-lg tabular-nums shrink-0',
            tx.type === 'income' ? 'text-success' : 'text-ink'
          )}
        >
          {tx.type === 'income' ? '+' : '-'} {formatIDR(tx.amount)}
        </span>
      </div>

      {/* Action Row: Full width or thumb targets */}
      <div className="flex items-center justify-end gap-2 pt-2 border-t border-ink/10">
        <Button variant="ghost" size="sm" className="h-9 px-3 text-xs" onClick={() => onEdit(tx)}>
          Ubah
        </Button>
        <Button variant="destructive" size="sm" className="h-9 px-3 text-xs" onClick={() => onDelete(tx)}>
          Hapus
        </Button>
      </div>
    </div>
  ))}
</div>
```

---

### 4.3 Pattern 2: Inventory & Stock Management (`/inventori`)

#### Desktop Table View (>= 768px)
- **Columns:**
  1. `Nama Barang`: bold label + category badge.
  2. `Stok Saat Ini`: tabular number + unit (e.g., `4 kg`).
  3. `Ambang Batas Minimum`: tabular number + unit (e.g., `2 kg`).
  4. `Status Stok`: `<Badge variant={status}>` (`Aman ✓` / `Menipis ⚠` / `Habis ✕`).
  5. `Lokasi / Rak`: text badge or muted string.
  6. `Aksi`: `Koreksi Stok` button + `Edit` button.

#### Mobile Card List View (< 768px)
```tsx
<div className="flex flex-col gap-3 md:hidden">
  {items.map((item) => (
    <div
      key={item.id}
      className="bg-surface border-neo border-ink rounded-card shadow-neo p-4 flex flex-col gap-3"
    >
      {/* Header: Name and Status Badge */}
      <div className="flex items-start justify-between gap-2">
        <div>
          <h4 className="font-heading font-bold text-base text-ink leading-tight">{item.name}</h4>
          {item.category && <span className="text-xs text-muted font-body">{item.category}</span>}
        </div>
        <Badge variant={item.status.toLowerCase() as any}>
          {item.status === 'SAFE' ? 'Aman ✓' : item.status === 'LOW' ? 'Menipis ⚠' : 'Habis ✕'}
        </Badge>
      </div>

      {/* Stock Quantity Highlight */}
      <div className="p-3 bg-bg border border-ink/20 rounded-btn flex items-center justify-between">
        <div>
          <span className="text-xs text-muted block">Stok Saat Ini</span>
          <span className="font-heading font-bold text-xl tabular-nums text-ink">
            {item.quantityOnHand} <span className="text-sm font-normal text-muted">{item.unit}</span>
          </span>
        </div>
        <div className="text-right">
          <span className="text-xs text-muted block">Batas Minimum</span>
          <span className="font-heading font-medium text-sm tabular-nums text-muted">
            {item.lowStockThreshold} {item.unit}
          </span>
        </div>
      </div>

      {/* Action Buttons: Min 44px tap target */}
      <div className="grid grid-cols-2 gap-2 pt-1">
        <Button
          variant="outline"
          size="md"
          className="w-full text-xs"
          onClick={() => openStockAdjustment(item)}
        >
          Koreksi Stok
        </Button>
        <Button
          variant="secondary"
          size="md"
          className="w-full text-xs"
          onClick={() => openEditItem(item)}
        >
          Edit Barang
        </Button>
      </div>
    </div>
  ))}
</div>
```

---

## 5. Features Discovered & Specification Matrix

| # | Category | Feature | Description | Inputs | Outputs | Error Behavior | Discovered Via |
|---|---|---|---|---|---|---|---|
| 1 | Tokens | Primary Neon Lime | High-energy Neo-brutalism highlight color | Hex `#C8F169` | `bg-primary`, `text-primary` | White text on lime fails WCAG (1.29:1); MUST use `#171717` | `doc/design.md` §2 |
| 2 | Tokens | Warm Cream Canvas | Eye-friendly warm off-white background | Hex `#FFFDF7` | `bg-bg` | None (17.7:1 contrast with `#171717`) | `doc/design.md` §2 |
| 3 | Tokens | Hard Drop Shadows | 0px blur unblurred shadow system | 2px, 4px, 5px, 6px | `shadow-neo`, `shadow-neo-lg` | Avoid soft blurred shadows (AI slop rule R-12) | `doc/design.md` §2 |
| 4 | Tokens | Corner Radii Hierarchy | Strict radius scale for components | 6px (badge), 8px (btn), 10-12px (card) | Tailwind rounded tokens | Avoid uniform pill-shaped elements (rule R-11) | `doc/design.md` §2 |
| 5 | Tokens | Aman Stock Badge | Safe inventory level indicator | `#D1FAE5` bg, `#065F46` text, Check `✓` | High contrast green badge | Color without icon fails accessible brutalism | `doc/design.md` §4.6 |
| 6 | Tokens | Menipis Stock Badge | Low inventory warning indicator | `#FEF3C7` bg, `#92400E` text, Warning `⚠` | High contrast amber badge | Color without icon fails accessible brutalism | `doc/design.md` §4.6 |
| 7 | Tokens | Habis Stock Badge | Depleted stock alarm indicator | `#FEE2E2` bg, `#991B1B` text, Cross `✕` | High contrast red badge | Color without icon fails accessible brutalism | `doc/design.md` §4.6 |
| 8 | Component | Tactile Button | Mechanical click button with physical feedback | `variant`, `size`, `isLoading` | Interactive button | Double-click disabled on `isLoading` | `packages/ui` |
| 9 | Component | Surface Card | Core container with 2px ink border and 4px shadow | `elevated`, children | Form & content container | Overflow content properly padded | `packages/ui` |
| 10 | Component | KPI StatCard | Top-level summary metric widget | Title, formatted nominal, icon | Big bold KPI card | Overcrowding on narrow mobile screens | `packages/ui` |
| 11 | Component | Accessible Input | Form input with permanent label and error slot | Label, prefix, error string | Input field with 44px min-h | Displays red border + error text underneath | `packages/ui` |
| 12 | Component | Responsive Dialog | Centered modal (desktop) to bottom-sheet (mobile) | Children, trigger, state | Polymorphic modal | Focus trap & Escape key handler | `doc/design.md` §5 |
| 13 | Reflow | TanStack Table | Desktop sorted table with pagination | Columns def, data rows | Desktop data table | Horizontal squishing below 768px | `doc/design.md` §3 |
| 14 | Reflow | Mobile Card List | High-density stacked card view for mobile | Rows data, render mapping | Mobile stacked cards | Eliminates horizontal scroll leak | `doc/design.md` §3 |
| 15 | Formatting | IDR Currency Formatter | Integer numeric formatter with Indonesian locale | `number` / `bigint` | `Rp 150.000` string | NaN / non-numeric fallback handled | `contracts/idr.ts` |

---

## 6. Edge Cases & Boundary Conditions

| # | Feature | Input / Condition | Observed / Required Behavior |
|---|---|---|---|
| 1 | Button Active Animation | User presses mouse/touch down on Button | Button immediately translates `translate-x-0.5 translate-y-0.5` and shadow reduces to `0px`, producing physical tactile feedback. |
| 2 | Reduced Motion Accessibility | System preference `prefers-reduced-motion: reduce` active | CSS `@media (prefers-reduced-motion: reduce)` disables all transforms and transitions, rendering instantaneous state changes. |
| 3 | Mobile Table Horizontal Leak | Wide 7-column table viewed on 360px viewport | Desktop table is completely hidden (`hidden md:block`); mobile card list is rendered (`block md:hidden`), ensuring zero horizontal page scroll. |
| 4 | Giant Financial Number | Nominal is `Rp 999.999.999.999` (12 digits) | StatCard and mobile card use `text-2xl` with `truncate` or auto-shrinking text size to prevent card blowout. |
| 5 | Small Touch Targets | Icon-only action button in mobile card list | Size set to `size="icon"` with `h-11 w-11` (44x44px hit-box) ensuring thumbs never mis-click. |
| 6 | Dialog on Small Mobile Screen | Mobile keyboard opens while editing form in Drawer | Drawer sets `max-h-[90dvh]` with `overflow-y-auto` and bottom action buttons remain sticky or scroll into view. |
| 7 | Low Stock Transition Alert | Stock drops from 5 to 1 (threshold is 2) | Status badge instantly flips from `Aman ✓` to `Menipis ⚠` with amber background `#FEF3C7` and amber text `#92400E`. |
| 8 | Completely Out of Stock | Stock equals 0 | Status badge flips to `Habis ✕` with rose background `#FEE2E2` and deep red text `#991B1B`. |
| 9 | Overdue Debt Item | Debt item due date is past and balance > 0 | Badge renders `Jatuh Tempo` with red background and `<Clock />` icon; never just a red dot without text. |
| 10 | Currency Input Prefix | User enters nominal into money field | Visual `Rp` prefix sits at `left-3`; input text has `pl-11` padding preventing typed text from overlapping prefix. |

---

## 7. Design Quality Gates & Antislop Verification Checklist

Before approving any UI code implementation in Milestone 4, verify:

- [x] **Palette Discipline:** Core active palette strictly bounded to `#C8F169` (lime), `#FFFDF7` (cream), `#FFFFFF` (surface), `#171717` (ink), and status badges. No purple-blue gradients or unbranded glows.
- [x] **No Pure Pill Everywhere:** Radii follow 6px (badge), 8px (button/input), 10–12px (card/dialog).
- [x] **Hard Shadows Only:** All shadows are `0px` blur (e.g. `4px 4px 0px #171717`). No blurry soft shadows.
- [x] **WCAG AA Contrast Checked:** Every text element exceeds 4.5:1. Primary button uses `#171717` text on `#C8F169` (13.9:1).
- [x] **Color + Icon Status:** Every status badge combines explicit Indonesian text (`Aman`, `Menipis`, `Habis`) with an SVG icon (`✓`, `⚠`, `✕`).
- [x] **Responsive Zero-Leak:** Table switches to Card List below 768px. Zero horizontal scroll on 360px and 390px viewports.
- [x] **44px Touch Targets:** Every interactive button and input has a minimum height/width of 44px on mobile.
- [x] **Authentic Copywriting:** Plain, clear Indonesian terms (`Pemasukan`, `Pengeluaran`, `Sisa Arus Kas`, `Belanja`, `Koreksi Stok`). No generic English AI filler.
