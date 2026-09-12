---
name: ADB Ticaret Corporate Retail System
colors:
  surface: '#f9f9ff'
  surface-dim: '#cfdaf2'
  surface-bright: '#f9f9ff'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#f0f3ff'
  surface-container: '#e7eeff'
  surface-container-high: '#dee8ff'
  surface-container-highest: '#d8e3fb'
  on-surface: '#111c2d'
  on-surface-variant: '#424752'
  inverse-surface: '#263143'
  inverse-on-surface: '#ecf1ff'
  outline: '#727784'
  outline-variant: '#c2c6d4'
  surface-tint: '#115cb9'
  primary: '#003f87'
  on-primary: '#ffffff'
  primary-container: '#0056b3'
  on-primary-container: '#bbd0ff'
  inverse-primary: '#acc7ff'
  secondary: '#4f5e83'
  on-secondary: '#ffffff'
  secondary-container: '#c4d4ff'
  on-secondary-container: '#4c5b80'
  tertiary: '#7d1f00'
  on-tertiary: '#ffffff'
  tertiary-container: '#a62c00'
  on-tertiary-container: '#ffc2b1'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#d7e2ff'
  primary-fixed-dim: '#acc7ff'
  on-primary-fixed: '#001a40'
  on-primary-fixed-variant: '#004491'
  secondary-fixed: '#d9e2ff'
  secondary-fixed-dim: '#b6c6f1'
  on-secondary-fixed: '#081a3c'
  on-secondary-fixed-variant: '#37466a'
  tertiary-fixed: '#ffdbd1'
  tertiary-fixed-dim: '#ffb5a0'
  on-tertiary-fixed: '#3b0900'
  on-tertiary-fixed-variant: '#862200'
  background: '#f9f9ff'
  on-background: '#111c2d'
  surface-variant: '#d8e3fb'
typography:
  display:
    fontFamily: Inter
    fontSize: 40px
    fontWeight: '700'
    lineHeight: 48px
    letterSpacing: -0.02em
  headline-lg:
    fontFamily: Inter
    fontSize: 32px
    fontWeight: '700'
    lineHeight: 40px
    letterSpacing: -0.015em
  headline-lg-mobile:
    fontFamily: Inter
    fontSize: 26px
    fontWeight: '700'
    lineHeight: 32px
    letterSpacing: -0.01em
  headline-md:
    fontFamily: Inter
    fontSize: 24px
    fontWeight: '600'
    lineHeight: 32px
    letterSpacing: -0.01em
  headline-sm:
    fontFamily: Inter
    fontSize: 18px
    fontWeight: '600'
    lineHeight: 26px
  body-lg:
    fontFamily: Inter
    fontSize: 16px
    fontWeight: '400'
    lineHeight: 24px
  body-md:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: '400'
    lineHeight: 20px
  body-sm:
    fontFamily: Inter
    fontSize: 12px
    fontWeight: '400'
    lineHeight: 16px
  label-lg:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: '600'
    lineHeight: 20px
    letterSpacing: 0.01em
  label-md:
    fontFamily: Inter
    fontSize: 12px
    fontWeight: '600'
    lineHeight: 16px
    letterSpacing: 0.02em
  label-sm:
    fontFamily: Inter
    fontSize: 11px
    fontWeight: '700'
    lineHeight: 14px
    letterSpacing: 0.04em
  price-display:
    fontFamily: Inter
    fontSize: 24px
    fontWeight: '700'
    lineHeight: 28px
    letterSpacing: -0.02em
  price-currency:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: '600'
    lineHeight: 16px
rounded:
  sm: 0.125rem
  DEFAULT: 0.25rem
  md: 0.375rem
  lg: 0.5rem
  xl: 0.75rem
  full: 9999px
spacing:
  gutter: 1.5rem
  margin: 2rem
  gutter-mobile: 0.75rem
  margin-mobile: 1rem
  space-xs: 0.25rem
  space-sm: 0.5rem
  space-md: 1rem
  space-lg: 1.5rem
  space-xl: 2rem
---

## Brand & Style

This design system establishes an authoritative, reliable, and high-clarity digital presence for an authorized appliance dealer. Built on the visual identity of corporate retail dependability, the interface balances customer-facing commercial trust with internal operational precision.

### Personality & Values
- **Authoritative Credibility:** Communicates official authorization and certified service standards at every touchpoint.
- **Systematic Precision:** Emphasizes structural order, readable technical specifications, and unambiguous operational status.
- **Reassuring Solidity:** Replaces ephemeral design trends with grounded contrast, dependable hierarchy, and durable visual clarity.

### Design Movement: Corporate Modern
The aesthetic merges high-performance retail commerce with structured enterprise data systems. The visual tone utilizes clean architectural whites, clinical neutral borders, and high-contrast typographical hierarchy. Depth is achieved primarily through tonal layering and micro-borders rather than expressive shadows, ensuring dense product specifications, commercial badges, and administrative data tables remain legible and distraction-free.

## Colors

The color system is calibrated for light mode execution, balancing commercial dynamism with strict institutional credibility.

### Color Roles
- **Primary (`#0056B3`):** Dynamic corporate blue used for core interactive elements, active navigation states, primary buttons, and link accents.
- **Secondary (`#0F2042`):** Deep navy corporate tone used for high-emphasis headers, top-level administrative navigation bars, authoritative retail trust badges, and footers.
- **Tertiary (`#FF5722`):** High-visibility energy coral used exclusively for transactional urgency: promotional tags, discount badges, cart alerts, and lower energy class indicators.
- **Neutral (`#1E293B`):** Deep slate used for high-contrast primary typography and dense interface outlines.

### Supporting Functional Roles
- **Surface Canvas (`#FFFFFF`):** Base canvas for product displays, cards, and modal sheets.
- **Surface Muted (`#F4F6F9`):** Canvas background for admin views, spec tables, and alternating content sections.
- **Border Subtle (`#E5E9F0`):** Hairline structure divider for cards, specifications grids, and data table rows.
- **Success / In-Stock (`#10B981`):** In-stock confirmation, official dealer verification marks, and top-tier energy labels (Class A).

## Typography

Typography relies entirely on the systematic clarity of Inter. Its neutral grotesque geometry allows complex technical parameters, currency denominations, and product titles to sit side by side without visual friction.

### Typographic Hierarchy
- **Commercial Headings:** Clean, tight negative letter tracking on headlines creates structural impact on high-value appliances without feeling promotional or aggressive.
- **Numbers & Prices:** All numeric listings (SKUs, inventory levels, installment tables, TL currency values) utilize tabular lining figures (`font-feature-settings: 'tnum' 1`) to preserve vertical alignment across data lists and carts.
- **Retail Badges & Labels:** Upper-register small labels (`label-sm`) utilize uppercase styling and expanded tracking for compact certifications (e.g., 'YETKİLİ SATICI', 'ÜCRETSİZ MONTAJ').

## Layout & Spacing

The layout is built upon an 8pt architectural rhythm, driving layout density suitable for both commerce catalog browsing and enterprise-grade inventory tables.

### Grid Architecture
- **Desktop (1200px+):** 12-column layout conforming to a max-width container of 1440px. Gutters are fixed at `1.5rem` (`24px`) with `2rem` (`32px`) canvas margins. Admin views may expand to full-width fluid layouts with pinned left-hand navigation modules.
- **Tablet (768px – 1199px):** 8-column layout with `1rem` (`16px`) gutters and `1.5rem` (`24px`) margins. Sidebars collapse to off-canvas drawers.
- **Mobile (< 768px):** 4-column layout with `0.75rem` (`12px`) gutters and `1rem` (`16px`) margins. Two-up product grids remain strictly aligned with minimal gap spacing to maximize above-the-fold catalog browsing.

### Spacing Application
- Component internal padding uses compact tokens (`space-xs` to `space-md`) to ensure high density in specification sheets and checkout summaries.
- Layout sections maintain clear breathing room using `space-xl` intervals, separating primary selling points from warranty and installation terms.

## Elevation & Depth

To preserve an authentic, clinical authorized dealer atmosphere, the design system minimizes heavy dropped shadows and avoids decorative glassmorphism. Depth is created via layered structural surfaces and hairline boundary definitions.

### Depth System
1. **Level 0 (Base Canvas):** Background tone (`#F4F6F9` in admin and page backgrounds, `#FFFFFF` for e-commerce PDP sheets). Zero elevation.
2. **Level 1 (Card & Module Surface):** Crisp `#FFFFFF` surface enclosed by a 1px solid border in `#E5E9F0`. No shadow in idle state.
3. **Level 2 (Active & Hover Cards):** Subtle upward projection during hover interactions: `0 4px 12px -2px rgba(15, 32, 66, 0.08)`, paired with a border shift to `#0056B3` (20% alpha).
4. **Level 3 (Overlays & Drawers):** Cart slide-outs, spec comparison panels, and popover menus: `0 12px 32px -4px rgba(15, 32, 66, 0.16)`, accompanied by a solid backdrop fill (`rgba(15, 32, 66, 0.4)`).
5. **Dividers:** Horizontal and vertical data dividers strictly leverage 1px `#E5E9F0` lines without gradients.

## Shapes

The design system employs a soft, precision-engineered shape language (Level 1). This ensures interface modules feel sturdy, technical, and durable, mirroring the physical construction of major domestic appliances.

### Radius Rules
- **Base Components (`0.25rem` / `4px`):** Used for input fields, energy badges, table rows, action buttons, and small trust chips.
- **Containers (`0.5rem` / `8px`):** Used for product listing cards, checkout panels, accordion blocks, and admin KPI metrics widgets.
- **Large Modals (`0.75rem` / `12px`):** Used exclusively for large dialogue overlays, image zoom panels, and master administrative sheets.
- **Pill Shapes:** Strictly prohibited for general UI elements. Only circular elements (e.g., dealer checkmarks, status indicator dots) maintain a fully rounded perimeter.

## Components

### 1. Buttons
- **Primary:** Solid `#0056B3` background, `#FFFFFF` text, `0.25rem` radius, bold label font. Height: 44px (touch-compliant). Hover: `#004494`.
- **Secondary / Cart Action:** Solid `#0F2042` background with `#FFFFFF` text for checkout-level authority.
- **Tertiary / Utility:** `#FFFFFF` background with 1px `#E5E9F0` border and `#1E293B` text. Hover: `#F4F6F9` fill.
- **Promotional Action:** High-urgency discount button with solid `#FF5722` fill and white label text.

### 2. Retail Trust Badges & Energy Tags
- **Authorized Dealer Seal:** `#0F2042` background block with micro-padded `#FFFFFF` typography, accompanied by an authorized checkmark icon.
- **Service Assurance Chips:** Subtle `#F4F6F9` background with 1px `#E5E9F0` border and `#0056B3` icon prefix ('Ücretsiz Montaj', 'Beko Garantisi', 'Orijinal Ürün').
- **Energy Efficiency Badges:** Block tags with directional arrow points. Standardized color codes:
  - Class A: `#10B981` (Green)
  - Class B: `#84CC16` (Light Green)
  - Class C: `#EAB308` (Yellow)
  - Class D+: `#FF5722` (Orange-Coral)
  Typography inside energy tags is strictly 11px bold uppercase.

### 3. Product Cards
- Clean `#FFFFFF` surface container, 1px `#E5E9F0` border, `0.5rem` outer radius.
- Structure: Top-right quadrant houses the energy label tag. The top-left quadrant houses promotion/dealer chips. The center features a high-key product packshot.
- Bottom details: Product model code (12px muted), bold appliance title (14px, 2-line max), key technical features (3 bullet points), price block with VAT disclosure, and full-width 'Sepete Ekle' button.

### 4. Technical Specs Accordion & Tables
- Flush borders with 1px `#E5E9F0` separators.
- Alternating zebra backgrounds (`#FFFFFF` and `#F4F6F9`) for multi-line appliance specs (Dimensions, Energy Consumption, Motor Type).
- Key labels sit on the left (40% column width, `#1E293B` regular), values sit on the right (60% column width, bold tabular tracking).

### 5. Admin Metrics & Data Tables
- **KPI Metrics Cards:** Top-accented 3px border line (Primary `#0056B3` for sales volume, Emerald `#10B981` for active inventory, Coral `#FF5722` for service requests). Big number display (`headline-md`) over compact label (`label-sm`).
- **Data Tables:** Dense layout with fixed 48px header height (`#F4F6F9` fill) and 44px data row heights. Hover state reveals contextual quick-action buttons (stock adjustments, invoice downloads).
- **Status Chips:** Flat micro-tags with 4px border radius:
  - `Hazırlanıyor`: Subtle blue tint (`rgba(0, 86, 179, 0.1)`) with `#0056B3` text.
  - `Teslim Edildi`: Subtle green tint (`rgba(16, 185, 129, 0.1)`) with `#065F46` text.
  - `Montaj Bekliyor`: Subtle orange tint (`rgba(255, 87, 34, 0.1)`) with `#C2410C` text.

### 6. Form Inputs & Selectors
- Flat `#FFFFFF` fields with 1px `#E5E9F0` border, `0.25rem` radius, and 40px height. Focus states transition the border to `#0056B3` with a crisp 1px outline offset.
- Floating helper labels maintain readable 12px sizing above the input value.