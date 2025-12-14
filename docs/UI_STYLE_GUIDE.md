# UI Style Guide
## LinkScope Dashboard

**Version**: 1.0  
**Last Updated**: 2025-12-14

---

## 1. Design Philosophy

### Core Principles
- **Clean over flashy** - No gradients, no glow effects
- **Purposeful** - Every element serves a function
- **Professional** - Appropriate for a work tool
- **Readable** - High contrast, clear hierarchy

### What to AVOID
- ❌ Gradients (looks cheap and dated)
- ❌ Generic icon packs (Font Awesome defaults)
- ❌ Neon/glow effects
- ❌ Excessive shadows
- ❌ Rounded everything
- ❌ Rainbow color schemes

---

## 2. Color Palette

### Dark Theme (Primary)

| Name | Hex | Usage |
|------|-----|-------|
| Background | `#0D0D0D` | Main page background |
| Surface | `#1A1A1A` | Cards, panels |
| Surface Elevated | `#242424` | Hover states, modals |
| Border | `#2E2E2E` | Subtle dividers |
| Text Primary | `#FFFFFF` | Headlines, important text |
| Text Secondary | `#A0A0A0` | Body text, descriptions |
| Text Muted | `#666666` | Disabled, placeholders |

### Accent Colors

| Name | Hex | Usage |
|------|-----|-------|
| Primary | `#0A66C2` | LinkedIn blue, primary actions |
| Primary Hover | `#004182` | Button hover states |
| Success | `#22C55E` | Connected, completed |
| Warning | `#F59E0B` | Caution, pending |
| Error | `#EF4444` | Errors, destructive |

### Score Colors

| Score | Color | Meaning |
|-------|-------|---------|
| 80-100 | `#22C55E` | High potential |
| 60-79 | `#0A66C2` | Good match |
| 40-59 | `#F59E0B` | Moderate |
| 0-39 | `#666666` | Low match |

---

## 3. Typography

### Font Stack
```css
--font-primary: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
--font-mono: 'JetBrains Mono', 'Fira Code', monospace;
```

### Scale

| Element | Size | Weight | Line Height |
|---------|------|--------|-------------|
| H1 | 28px | 600 | 1.2 |
| H2 | 22px | 600 | 1.3 |
| H3 | 18px | 500 | 1.4 |
| Body | 14px | 400 | 1.5 |
| Small | 12px | 400 | 1.4 |
| Mono | 13px | 400 | 1.4 |

---

## 4. Spacing

Use 4px base unit:

| Token | Value | Usage |
|-------|-------|-------|
| `--space-1` | 4px | Tight spacing |
| `--space-2` | 8px | Icon gaps |
| `--space-3` | 12px | Component padding |
| `--space-4` | 16px | Section spacing |
| `--space-6` | 24px | Card padding |
| `--space-8` | 32px | Section gaps |

---

## 5. Components

### Buttons

**Primary Button**
```css
.btn-primary {
  background: #0A66C2;
  color: #FFFFFF;
  padding: 10px 20px;
  border: none;
  border-radius: 6px;
  font-weight: 500;
  transition: background 0.15s ease;
}
.btn-primary:hover {
  background: #004182;
}
```

**Secondary Button**
```css
.btn-secondary {
  background: transparent;
  color: #FFFFFF;
  padding: 10px 20px;
  border: 1px solid #2E2E2E;
  border-radius: 6px;
}
.btn-secondary:hover {
  background: #1A1A1A;
}
```

### Cards
```css
.card {
  background: #1A1A1A;
  border: 1px solid #2E2E2E;
  border-radius: 8px;
  padding: 24px;
}
```

### Inputs
```css
.input {
  background: #0D0D0D;
  border: 1px solid #2E2E2E;
  border-radius: 6px;
  padding: 10px 14px;
  color: #FFFFFF;
}
.input:focus {
  border-color: #0A66C2;
  outline: none;
}
```

### Status Indicators
```css
.status-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
}
.status-connected { background: #22C55E; }
.status-disconnected { background: #666666; }
.status-running { background: #0A66C2; }
```

---

## 6. Icons

### Custom SVG Only
Do NOT use icon libraries. Create simple, purposeful SVGs:

```html
<!-- Example: Play icon -->
<svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
  <path d="M4 2.5v11l9-5.5L4 2.5z"/>
</svg>

<!-- Example: Stop icon -->
<svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
  <rect x="3" y="3" width="10" height="10" rx="1"/>
</svg>
```

### Icon Guidelines
- 16x16 or 20x20 standard sizes
- Single color (currentColor)
- Simple shapes, no detail
- Consistent stroke width if using strokes

---

## 7. Layout

### Dashboard Grid
```
┌──────────────────────────────────────────────────┐
│ HEADER (Logo + Status)                    64px   │
├───────────────────┬──────────────────────────────┤
│                   │                              │
│   SIDEBAR         │      MAIN CONTENT            │
│   (280px fixed)   │      (flexible)              │
│                   │                              │
│   - Login         │      - Session View          │
│   - Search        │      - Analytics             │
│   - Schedule      │      - Profile List          │
│                   │                              │
└───────────────────┴──────────────────────────────┘
```

### Responsive
- Desktop only (1024px minimum)
- No mobile optimization needed (personal tool)

---

## 8. Animation

### Principles
- Subtle and fast
- Purpose: feedback, not decoration
- Max duration: 200ms for interactions

### Allowed Transitions
```css
/* Buttons, links */
transition: background 0.15s ease, border-color 0.15s ease;

/* Modals, panels */
transition: opacity 0.2s ease, transform 0.2s ease;

/* Progress bars */
transition: width 0.3s ease;
```

### Forbidden
- ❌ Bounce effects
- ❌ Spinning animations (except loading)
- ❌ Slide-in from off-screen
- ❌ Anything over 300ms

---

## 9. Loading States

### Spinner (Only When Needed)
Simple rotation, not elaborate:
```css
.spinner {
  width: 20px;
  height: 20px;
  border: 2px solid #2E2E2E;
  border-top-color: #0A66C2;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}
```

### Skeleton Loading
For content areas:
```css
.skeleton {
  background: linear-gradient(90deg, #1A1A1A 25%, #242424 50%, #1A1A1A 75%);
  background-size: 200% 100%;
  animation: shimmer 1.5s infinite;
}
```

---

## 10. Reference Inspiration

Visual style similar to:
- Linear.app (clean dark UI)
- Raycast (minimal, functional)
- Vercel Dashboard (professional, clear)

NOT like:
- Crypto dashboards (too flashy)
- Gaming interfaces (too busy)
- Generic admin templates (too generic)
