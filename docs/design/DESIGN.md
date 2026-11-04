---
name: Academic Calm
colors:
  surface: '#f9f9ff'
  surface-dim: '#d9d9e0'
  surface-bright: '#f9f9ff'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#f3f3fa'
  surface-container: '#ededf4'
  surface-container-high: '#e8e7ef'
  surface-container-highest: '#e2e2e9'
  on-surface: '#1a1b21'
  on-surface-variant: '#3e4945'
  inverse-surface: '#2e3036'
  inverse-on-surface: '#f0f0f7'
  outline: '#6e7975'
  outline-variant: '#bec9c4'
  surface-tint: '#036b58'
  primary: '#005444'
  on-primary: '#ffffff'
  primary-container: '#0b6e5b'
  on-primary-container: '#9aedd5'
  inverse-primary: '#83d6bf'
  secondary: '#b4261e'
  on-secondary: '#ffffff'
  secondary-container: '#fe5c4c'
  on-secondary-container: '#610002'
  tertiary: '#77362a'
  on-tertiary: '#ffffff'
  tertiary-container: '#944d3f'
  on-tertiary-container: '#ffd3ca'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#9ff3da'
  primary-fixed-dim: '#83d6bf'
  on-primary-fixed: '#002019'
  on-primary-fixed-variant: '#005142'
  secondary-fixed: '#ffdad5'
  secondary-fixed-dim: '#ffb4a9'
  on-secondary-fixed: '#410001'
  on-secondary-fixed-variant: '#920708'
  tertiary-fixed: '#ffdad3'
  tertiary-fixed-dim: '#ffb4a5'
  on-tertiary-fixed: '#3b0903'
  on-tertiary-fixed-variant: '#733427'
  background: '#f9f9ff'
  on-background: '#1a1b21'
  surface-variant: '#e2e2e9'
typography:
  headline-lg:
    fontFamily: Inter
    fontSize: 24px
    fontWeight: '600'
    lineHeight: 30px
    letterSpacing: -0.02em
  headline-lg-mobile:
    fontFamily: Inter
    fontSize: 20px
    fontWeight: '600'
    lineHeight: 26px
    letterSpacing: -0.015em
  headline-md:
    fontFamily: Inter
    fontSize: 18px
    fontWeight: '600'
    lineHeight: 24px
    letterSpacing: -0.01em
  headline-sm:
    fontFamily: Inter
    fontSize: 15px
    fontWeight: '600'
    lineHeight: 20px
    letterSpacing: -0.005em
  body-lg:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: '400'
    lineHeight: 20px
    letterSpacing: 0em
  body-md:
    fontFamily: Inter
    fontSize: 13px
    fontWeight: '400'
    lineHeight: 18px
    letterSpacing: 0em
  body-sm:
    fontFamily: Inter
    fontSize: 12px
    fontWeight: '400'
    lineHeight: 16px
    letterSpacing: 0.01em
  label-lg:
    fontFamily: Inter
    fontSize: 13px
    fontWeight: '500'
    lineHeight: 18px
    letterSpacing: 0.005em
  label-md:
    fontFamily: Inter
    fontSize: 12px
    fontWeight: '500'
    lineHeight: 16px
    letterSpacing: 0.01em
  label-sm:
    fontFamily: Inter
    fontSize: 11px
    fontWeight: '600'
    lineHeight: 14px
    letterSpacing: 0.04em
  data-tabular:
    fontFamily: Inter
    fontSize: 13px
    fontWeight: '500'
    lineHeight: 18px
    letterSpacing: 0em
rounded:
  sm: 0.25rem
  DEFAULT: 0.5rem
  md: 0.75rem
  lg: 1rem
  xl: 1.5rem
  full: 9999px
spacing:
  gutter: 1rem
  gutter-desktop: 1.5rem
  margin: 1rem
  margin-tablet: 1.5rem
  margin-desktop: 2rem
  space-xs: 0.25rem
  space-sm: 0.5rem
  space-md: 0.75rem
  space-lg: 1rem
  space-xl: 1.5rem
  space-2xl: 2rem
---

## Brand & Style

This design system establishes an architectural, utilitarian, and deeply restrained operating environment for multi-campus higher education institutions. Designed specifically for academic administrators, department heads, faculty, and registrars handling high-density institutional data across three disparate campuses, the interface rejects modern SaaS visual noise: zero gradients, zero decorative glassmorphism, zero decorative illustrations, and zero emojis. 

The aesthetic adheres strictly to institutional functionalism—drawing inspiration from paper ledgers, tabular records, and clinical Swiss typography. It creates an atmosphere of unhurried precision, high trust, and cognitive calm under bureaucratic pressure. Visual feedback is understated: critical states speak strictly through high-contrast legibility and purposeful tinting, allowing operators to complete high-volume workflows (attendance verification, exam seating, fee reconciliation, faculty allotments) without eye fatigue or cognitive friction.

## Colors

The palette is engineered with austere editorial discipline to emphasize data density and critical operational flags:

- **Canvas & Surfaces**: The default canvas uses a warm, unbleached stone `#FAFAF8`, providing soft paper-like contrast beneath `#FFFFFF` content containers. Borders utilize a 1px hairline `#E9E7E2` to structure surfaces without adding visual bulk.
- **Primary Accent (`#0B6E5B`)**: An authoritative, deep academic teal. Applied deliberately to primary action triggers, active tabs, confirmed record states, and high-level focus rings. It conveys quiet confidence and legitimacy rather than aggressive tech vibrancy.
- **Strict Danger & Risk (`#CF3A2E`)**: A resolute, uncompromising institutional crimson. This token is restricted strictly to statutory and academic alerts: attendance shortages falling below 75%, past-due tuition, student debarment warnings, or missing regulatory consent. It is never used for playful dismissals or generic deletions.
- **Typography & Neutrals**: Body and display copy rely on `#15171C` (a high-legibility ink black), supported by `#6A6F7A` for secondary context, audit timestamps, and table headers.

### Dark Mode Adaptation
In dark mode, the hierarchy shifts smoothly while maintaining the same tactile clarity:
- **Canvas**: `#111215` (deep charcoal canvas).
- **Surface**: `#181A1F` (elevated sheet surface).
- **Borders**: `#272A33` (subtle 1px boundary).
- **Text**: Primary `#F3F4F6`, Secondary `#969CA8`.
- **Primary Accent**: `#128A73` (slightly brightened for legibility against dark slate).
- **Risk Crimson**: `#E04B3E` (adjusted for high-contrast visibility against deep backgrounds).

## Typography

The type scale uses a tight, structured implementation of **Inter** across all device viewports. 

- **Display & Headings**: Module and page titles peak at an austere 24px semibold (`headline-lg`), ensuring zero vertical waste in desktop data matrices. Page subtitles run at 13px muted regular directly underneath.
- **Tabular Figures**: Every numeric data point—including Student Permanent Roll Numbers (PRNs), Indian Rupee ledger amounts (`₹`), attendance percentages, GPA calculations, and seating codes—must explicitly enforce `font-variant-numeric: tabular-nums` or `font-feature-settings: "tnum" 1`. This guarantees clean vertical alignment across densely packed multi-row tables.
- **Micro-labels**: Column headers and metadata chips leverage 11px uppercase (`label-sm`) with deliberate `+0.04em` tracking for crisp scanning at rapid glance rates.

## Layout & Spacing

Layouts follow an unyielding administrative rhythm built on an 8px base grid with a 4px sub-grid for fine alignment:

- **Structural Grid**: Desktop views leverage a standard 12-column layout with 24px (`gutter-desktop`) gutters and 32px (`margin-desktop`) canvas margins. Tablet simplifies to an 8-column layout (16px gutters), and mobile switches to a single-column 4-column flow with 16px margins.
- **Universal Module Anatomy**: Every screen across all campus departments must adhere to a 4-tier vertical structure:
  1. *Header Zone*: Page title (24px semibold) accompanied by a single concise subtitle line and one primary trigger button aligned to the right.
  2. *Control Bar*: A unified 44px high filter bar featuring quick keyword search, academic year/semester selectors, and campus switcher tabs.
  3. *Main Action Zone*: Primary operational view (multi-column data tables, seating plans, or ledger rows).
  4. *Footer Utility*: Fixed bottom record counters, pagination indices, and bulk selection trays.
- **Compact Vertical Cadence**: Desktop padding within data containers is kept tight (`space-sm` and `space-md`), preserving vertical screen real estate so at least 15 tabular records are visible without scrolling on standard enterprise displays.

## Elevation & Depth

This design system deliberately eschews float, layered drop shadows, and heavy blurs. Physicality is expressed strictly through subtle outlines and micro-surfaces:

- **Flat Spatial Architecture**: Depth is produced through surface color contrast (`#FAFAF8` canvas holding `#FFFFFF` cards) demarcated by 1px hairline borders (`#E9E7E2`).
- **Hairline Restraint**: All container separations, table cell dividers, and navigation sidebars rely on a precise `1px solid #E9E7E2` boundary.
- **Micro-Ambient Shadow**: Floating menus, select overlays, and standalone modal sheets use only an ultra-soft, zero-spread ambient occlusion shadow:
  - *Base Cards*: `none` (bordered only).
  - *Dropdowns / Popovers*: `box-shadow: 0 1px 3px 0 rgba(0, 0, 0, 0.04), 0 1px 2px -1px rgba(0, 0, 0, 0.02)`.
  - *Critical Action Modals*: `box-shadow: 0 4px 12px -2px rgba(0, 0, 0, 0.06), 0 2px 4px -2px rgba(0, 0, 0, 0.03)`.
- **Dark Mode Elevation**: Outlines shift to `1px solid #272A33`. Overlays do not cast heavier black shadows; instead, visual separation is achieved by shifting background tone from `#111215` (canvas) to `#181A1F` (modal surface) with a slightly brightened hairline border (`#333742`).

## Shapes

Shapes are strictly geometric, structured, and pragmatic. Rounded corners provide soft guidance without appearing playful or bubbly:

- **Cards & Data Panels**: Border radius is fixed at `12px`.
- **Form Controls & Triggers**: Interactive elements (inputs, single selects, control buttons, tab badges) use an exact `9px` corner radius (`border-radius: 9px`).
- **Pills & Status Tags**: Badges, status chips, and campus identifiers use a compact `4px` or `6px` radius—never a full-pill circular shape—retaining an institutional index-card feel.
- **Consistency**: No nested radii conflict: a 9px button sits harmoniously inside a 12px card container padded by at least 12px (`space-md`).

## Components

### Buttons & Interactive Controls
- **Primary Button**: Solid teal `#0B6E5B` background, `#FFFFFF` text, 9px radius, no shadow. Height is 38px on desktop (44px on mobile touch devices). Padding: 12px 18px. Active state: `#085446`. Focus state: 2px offset ring in `#0B6E5B`.
- **Secondary Button**: Crisp `#FFFFFF` background, 1px `#E9E7E2` border, `#15171C` label. Hover state: subtle wash `#F5F4F0`.
- **Destructive/Risk Button**: Solid crimson `#CF3A2E`, `#FFFFFF` label. Used solely for irreversible punitive actions (student suspension, exam cancellation).

### Data Tables (Core Component)
- **Header Row**: 36px height, uppercase 11px font (`label-sm`), background `#FAFAF8`, bottom border 1px `#E9E7E2`. Text `#6A6F7A`.
- **Data Rows**: 44px min-height on desktop, white background, bottom hairline border. Hover row state: `#F8F8F6`.
- **Numeric & Metric Alignment**: All currency, attendance stats, and roll codes must align flush right with `font-variant-numeric: tabular-nums`.

### Status Badges & Chips
- **Neutral / Normal State**: 1px `#E9E7E2` border, `#F5F4F0` background, `#15171C` 12px text.
- **Teal / Positive Confirmation**: Pale mint tint background (`#E6F2EF`), text `#0B6E5B`.
- **Risk / Warning (Attendance < 75%, Fee Due)**: Pale red tint (`#FBEBEA`), solid `#CF3A2E` text, semibold weight. An optional 6px solid red dot prefix may accompany the label.

### Form Inputs & Selectors
- **Input Fields**: Single-line text, selects, and pickers use a 40px desktop height (44px mobile), 9px border radius, 1px `#E9E7E2` border, `#FFFFFF` background.
- **Focus Indicator**: Border transitions to `#0B6E5B` with an immediate, non-blurry `0 0 0 1px #0B6E5B` inner outline.
- **Labels & Validation**: 12px medium label `#15171C` positioned strictly above the field with 6px spacing. Errors trigger a crisp 1px `#CF3A2E` border with a 12px red helper note below.

### Cards & Panels
- **Structure**: Surface `#FFFFFF`, 12px border radius, 1px hairline border `#E9E7E2`. Internal padding is uniform: 20px on desktop, 16px on mobile. No drop shadows.
- **Section Headers**: Integrated directly into the card top with an optional 1px bottom border separating actions from summary metadata.

### Specialized ERP Components
- **Campus Selector Dropdown**: Minimalist inline toggle displaying current campus prefix (e.g., `BLR-NORTH`, `BLR-SOUTH`, `PUN-WEST`) in 11px medium bold with hairline boundaries.
- **Attendance Gauge**: Linear, 6px-tall segmented bar. Green `#0B6E5B` above 75%, strict red `#CF3A2E` below 75% threshold with absolute numerical percentage adjacent.