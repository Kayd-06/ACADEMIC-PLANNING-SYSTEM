# EduAdmin Pro — Design System Reference

Use this as the shared style reference for every Google Stitch prompt. Paste the relevant section into Stitch alongside each screen prompt, or reference it as "follow the EduAdmin Pro design system" if Stitch retains context across a session.

---

## 1. Brand

- **Product name shown in UI:** "EduAdmin Pro"
- **Logo treatment:** 40x40px rounded-square (12px corner radius), navy background, white bold initials (e.g. "EA"), subtle shadow
- **Tone:** Clean, institutional, professional SaaS — not playful. Think enterprise admin dashboard (Linear / Notion-grade polish), not a consumer app.

---

## 2. Color Palette

### Primary / Accent (Navy — main brand color)
| Token | Hex | Usage |
|---|---|---|
| `accent-primary` | `#002045` | Primary buttons, active nav state, headings, key icons, links |
| `accent-hover` | `#1a365d` | Hover state for navy elements |
| `accent-light` | `#eff6ff` | Active nav background, highlighted info tiles |

### Secondary Brand (Indigo — used for notifications/secondary actions)
| Token | Hex | Usage |
|---|---|---|
| `brand-500` | `#6366f1` | Secondary buttons, unread indicators, links inside modals |
| `brand-600` | `#4f46e5` | Hover state for indigo elements |
| `brand-50` | `#f5f7ff` | Light backgrounds for indigo badges/tiles |

### Status Colors
| Token | Hex (text/icon) | Hex (background) | Usage |
|---|---|---|---|
| Success | `#10b981` | `#ecfdf5` | Completed, Active, Paid, Present |
| Danger | `#ef4444` | `#fef2f2` | Overdue, Absent, Urgent, Rejected |
| Warning | `#f59e0b` | `#fffbeb` | Pending, Delayed, Due Soon |
| Info | `#6366f1` | `#f5f7ff` | In Progress, Scheduled, Informational |

### Neutrals (Slate scale)
| Token | Hex | Usage |
|---|---|---|
| `slate-50` | `#f8fafc` | Page background, sidebar background |
| `slate-100` | `#f1f5f9` | Subtle section backgrounds, table header bg |
| `slate-200` | `#e2e8f0` | Borders, dividers |
| `slate-400` | `#94a3b8` | Muted icons, placeholder text |
| `slate-500` | `#64748b` | Secondary text, captions |
| `slate-600` | `#475569` | Body text (secondary emphasis) |
| `slate-700` | `#334155` | Body text (default) |
| `slate-800` | `#1e293b` | Headings, primary text |
| `slate-900` | `#0f172a` | Highest-emphasis text |
| `white` | `#ffffff` | Card backgrounds, header background |

---

## 3. Typography

**Font family:** Inter (fallback: system-ui, sans-serif)

| Style | Size | Weight | Usage |
|---|---|---|---|
| Heading XL | 20px | Bold | Page titles (e.g. "Institutional Dashboard") |
| Heading L | 18px | Bold | Modal titles |
| Heading M | 14px | Semibold | Card section titles |
| Body Default | 13px | Medium | Standard UI text, table cells, buttons |
| Body Small | 12px | Regular | Secondary descriptions, helper text |
| Caption Label | 11px | Bold, uppercase, letter-spacing wide | Table column headers, field labels, status badge text |

---

## 4. Layout Shell (applies to every screen)

Every screen uses the **same persistent shell**:

### Sidebar (left, 264px fixed width, full height)
- Background: `slate-50`, right border 1px `slate-200`
- **Top:** Logo block — 40x40 navy rounded-square logo + "EduAdmin Pro" bold 13px + role label (e.g. "Management" / "Faculty") 11px muted, bottom border divider
- **Middle:** Vertical nav list, each item: icon (16x16) + label, 13px medium, rounded-md, 12px vertical / 16px horizontal padding
  - **Active item:** background `accent-light`, text `accent-primary`, bold, 4px left-side accent border (right-aligned border in original RTL note: it's a right border in code, but functionally reads as an active-state side accent)
  - **Inactive item:** text `slate-600`, hover background `slate-100`
- **Bottom:** Primary CTA button (navy, full width, rounded-lg) relevant to role (e.g. "New Recruitment" for management), then "Support" and "Sign Out" text links with icons, muted slate-500, top border divider

### Top Header (full width minus sidebar, 64px fixed height)
- Background: white, bottom border 1px `slate-200`, subtle shadow
- **Left:** Product wordmark "EduAdmin Pro" bold navy
- **Center-left:** Search input, pill-shaped (rounded-full), light gray background, search icon, placeholder text e.g. "Search faculty, roles..."
- **Right (icon cluster):** Notification bell (with red dot badge if unread), Help icon, Settings icon, circular user-initials avatar (navy background, white text) with hover tooltip showing name/email/role badge

### Main Content Area
- Background: `slate-50` (page bg) or white depending on screen
- Padding: 24px
- Page header row: Title (Heading XL) + subtitle description (Body Small, muted) on the left, primary action button on the right
- Content below uses a **12-column grid** for dashboard-style pages, or a single full-width white card with a table for list-style pages

---

## 5. Reusable Components

### Cards
- White background, 1px border `slate-200` (or `gray-100`), 12px corner radius (`rounded-xl`), subtle shadow (`shadow-sm`), 20-24px padding
- Card header row: icon (16x16, muted) + title (Heading M) on left, optional action link/button on right

### Stat Tiles (used inside cards for quick metrics)
- Light background tint (e.g. `slate-50` default, or `accent-light` if highlighted/primary metric)
- Small uppercase caption label (10-11px, muted, letter-spaced) above
- Value below in 14-16px medium/semibold
- Optional left accent border (4px, navy) for the "highlighted" tile in a group

### Buttons
- **Primary:** Navy background (`accent-primary`), white text, bold, rounded-lg (8px), hover → `accent-hover`, subtle shadow
- **Secondary:** White background, `slate-200` border, `slate-700` text, hover → light gray background
- **Destructive:** Red text/background variant, used sparingly (delete/remove actions)
- Icon + label combos common (e.g. "+ New Recruitment")

### Status Badges / Pills
- Rounded-full, small uppercase bold text (11px), colored per status table in section 2
- Border in matching lighter shade of the status color

### Tables
- White card wrapper, rounded-xl
- Header row: uppercase 11px bold `slate-400` text, `slate-50` or transparent background, bottom border
- Body rows: 13-14px text, hover background `slate-50`, bottom border divider per row, generous vertical padding (14px)
- Last column often has an icon-only action button (chevron, more-options)

### Modals
- Centered overlay, dark backdrop with blur (`rgba(15,23,42,0.4)` + blur)
- White panel, rounded-2xl (16px), shadow-2xl, max-width 400-560px depending on content
- Header row: title (Heading L) + close (X) icon button, bottom border divider
- Footer: primary action button, often full-width or right-aligned

### Notification/Dropdown Panels
- White rounded-2xl panel, shadow-xl, anchored below trigger icon
- List items with unread dot indicator (navy or red if urgent), timestamp top-right, title + description

---

## 6. Motion (for reference — Stitch may not replicate animation, but informs perceived polish)

- Page sections fade up + slight vertical slide on load (subtle, ~250-300ms)
- Buttons scale slightly on hover/tap (1.02 / 0.98)
- Dropdowns/modals scale + fade in from 0.95 → 1
- Sidebar nav items shift 2px right on hover

---

## 7. Iconography

- Line-style icons (Lucide icon set aesthetic) — thin stroke, 16-20px, no fill, rounded line caps
- Icon color matches text emphasis level of its context (muted slate-400 for secondary, navy/brand for active/primary)
