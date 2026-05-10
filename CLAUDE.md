# Sentra Internal Tools — Project Context

## What is this?
Internal tools portal for Sentra, a merchandise company that manages musicians, brands, and filmmakers. Handles licensing agreements, royalty payments, and sales report tracking for their IP portfolio.

**Live URL:** https://sentragroup.github.io/sentra-portal
**Repo:** https://github.com/sentragroup/sentra-portal

---

## Stack
- **Frontend:** Single `index.html` — vanilla HTML/CSS/JS, no framework, no build step
- **Backend:** Google Apps Script (`Code.gs`) deployed as web app
- **Database:** Google Sheets (ID: `1sTG43OTwwNFpibT-l36ZjOW9pv8UDlLzmwlSgH-UdgE`)
- **Deploy:** Push `index.html` to GitHub → auto-deploys via GitHub Pages

**Apps Script URL:**
```
https://script.google.com/macros/s/AKfycbwBA8VlKGMKt48u4qlrKbLMDIWIhSkHCwvE7J0Ydl2qYtYoPZ1zKWRtdzse2BP7rPnF/exec
```

> After editing `Code.gs`, you must deploy a new version in Apps Script editor and run `clearAllCache()`.

---

## API Convention
All API calls use GET (not POST) — more reliable from GitHub Pages static files.

```js
// Frontend
async function apiGet(params) {
  const r = await fetch(SCRIPT_URL + "?" + new URLSearchParams(params));
  return r.json();
}

// Usage
const res = await apiGet({ action: "submitIP", name, category, ... });
if (res.success) { ... } else { alert(res.error); }
```

Apps Script always returns `{ success: true/false, ...data }`.
Cache is cleared on every write: `clearCache(CACHE_KEY_XX)`.

---

## Design System

**Colors (CSS vars):**
```
--black: #0c0c0c    --white: #f8f7f4    --off: #f0efe9
--g100: #e8e7e0     --g200: #d4d3cb     --g400: #9a9890     --g600: #5a5850
```

**Fonts:** Syne (headings/`.head`), DM Mono (code/labels/`.mono`), DM Sans (body)

**Design:** Black & white, minimal, no UI framework

**Key CSS classes:**
- `.pill` — status badges (variants: `.p-active`, `.p-draft`, `.p-expired`, `.p-near`, `.p-signings`, `.p-inactive`)
- `.filter-panel` + `.filter-grid` — 3-col filter bar
- `.stats-row` — grid of stat cards (`.stat-card`, `.stat-card.warn`, `.stat-card.danger`, `.stat-card.info`)
- `.form-card` + `.form-grid` — 2-col form layout, `.fg.full` for full-width fields
- `.edit-row-form` + `.edit-row-grid` — inline edit rows in tables (3-col grid)
- `.ac-wrap` + `.ac-list` — autocomplete dropdown wrapper
- `.live-toggle` — inline dropdown pill for live status in tables

---

## Modules

### 1. Agreement Tracker
Sheet tab: `agreements`
- Fields: ID, Date Submitted, Agreement Title, Partner/Client, PIC, Related IP/Brand, Revenue Stream, Agreement Type, Start Date, End Date, Status, Link Agreement, Email Thread Link, Submitted By, Last Updated, Last Updated By
- Status flow (manual): `Draft → Under Review → Signings → Signed`
- Auto-status (computed from end date): `Active`, `Near Expiring` (≤30 days), `Expired`
- Inline status dropdown update in table
- Filter: Status, Kondisi, Revenue, Brand, PIC, Type

### 2. IP Master
Sheet tab: `ip_master`
Columns: `ID | IP/Brand Name | Category | Live Status | Revenue Stream | Related Agreement | Royalty Type | Percentage | Fixed Amount | Termin | PPh Tax Rate | Notes | Date Added | Added By`
- **Two separate statuses:**
  - **Agreement Status** (computed): Active, Near Expiring, Expired, In Progress, No Agreement
  - **Live Status** (manual): Active / Inactive — inline toggle in table
- Category: autocomplete (Musician, Brand, Filmmaker + add new)
- Related Agreement: rich autocomplete → shows `AGR-xxx — Partner — Type`
- Live Status defaults to "Active" in form
- **Duplicate check:** name cannot exist in both IP Master AND Brand Master

### 3. Collaborator Royalty
Sheet tab: `royalty_recipients`
Columns: `ID | Nama Penerima | Tipe | Related IP | Royalty Type | Percentage | Fixed Amount | Termin | Link PKS | Notes | Date Added | Added By`
- PKS field: autocomplete from Agreement Tracker → stores **Drive link** (not AGR ID)
- PKS field only shows when Tipe = "Collaborator"
- PKS clickable in table (opens Google Drive)
- Edit inline: all fields

### 4. Brand Master
Sheet tab: `brand_master`
Columns: `ID | IP/Brand Name | Category | Live Status | Revenue Stream | Related Agreement | Apparel Rate | Accessories Rate | Collectible Rate | Preloved Goods Rate | Wellness Rate | Others Rate | Notes | Date Added | Added By`
- Normal rates: Apparel 30%, Accessories 25%, Collectible 20%, Preloved 20%, Wellness 20%, Others 30%
- Non-standard rates highlighted yellow ⚠️ in table
- Stats: Total, Rate Normal, Ada Rate Nego, Live Active
- Related Agreement: rich autocomplete (same as IP Master)
- Live Status defaults to "Active"
- **Duplicate check:** same as IP Master

### 5. Sales Report
Sheet tabs: `sr_reports`, `sr_startdates`
- Calendar grid: Brand rows × Jun–Dec 2026 columns (7 months fixed)
- Brand sources: Brand Master (Live=Active) + IP Master (Live=Active) + Collaborator Royalty (Nama Penerima) — merged by name
- Cell states: `—` grey (before start date) | 🔴 red (due, not submitted) | ✅ green (submitted + clickable link)
- Click red → modal: input link + notes → save
- Click green → can update or clear
- Start date: "+ Set" button per brand → modal → saves to `sr_startdates`
- No start date = tracking from Jun 2026 (all cells red)
- Filter: Revenue Stream, specific month, missing/complete, search

### 6. Leads Tracker
Sheet tab: `leads`
Columns: `ID | Brand/Artist Name | Category | Contact Person | Contact Info | PIC | Revenue Stream | Source | Priority | Stage | Est. Value | Next Action | Next Action Date | Lost Reason | Products | Notes | Date Added | Added By | Last Updated | Last Updated By`
- Stage flow: `New → Contacted → Meeting → Proposal → Negotiation → Won / Lost / On Hold`
- Priority: High / Medium / Low
- Lost Reason: free text, only shown when Stage = Lost
- Product Interest: multi-checkbox (Apparel, Accessories, Collectible, Preloved Goods, Wellness, Others)
- Source: Inbound / Outbound / Referral / Event
- Table sorted: High priority first, then by Next Action Date
- Overdue next action dates highlighted red ⚠️
- Inline stage dropdown update + inline edit all fields

---

## Key Global Variables (JS)

```js
let currentUser = "";
let allRows = [], acBrands = [], acTypes = [], acPics = [];       // Agreements
let allIPRows = [], acAgrOptions = [], acAgrLinks = {};            // IP Master + Agreement autocomplete
let acIPCategories = ["Musician","Brand","Filmmaker"];
let allRRRows = [], acRRTipes = [], acRRIPs = [];                  // Collaborator Royalty
let allBMRows = [], acBMCategories = ["Musician","Brand","Filmmaker"]; // Brand Master
let srBrands = [], srReports = {};                                 // Sales Report
let allLeadsRows = [], acLDPics = [], acLDCategories = [];         // Leads
```

**`acAgrOptions`** — array of `{id, label}` where label = `"Partner — Type"`
**`acAgrLinks`** — map of `{agrId: driveLink}` for PKS autocomplete

---

## Autocomplete System

```js
// Standard autocomplete (plain list)
setupAC("input-id", "ac-list-id", () => arrayOfStrings);

// Rich autocomplete (shows ID + sub-label)
setupAC("input-id", "ac-list-id", () => acAgrOptions.map(o=>o.id), () => acAgrOptions);

// Special PKS autocomplete (stores drive link on pick)
setupACPKS("rr-pks", "ac-rr-pks");  // uses acAgrOptions + acAgrLinks
```

Autocomplete is **preloaded on login** via `preloadAutocomplete()` which fetches IP Master, Brand Master, and Agreements in parallel — so history is always available without visiting list tabs first.

---

## Google Sheet Structure

| Tab | Purpose |
|-----|---------|
| `agreements` | Agreement Tracker |
| `ip_master` | IP Master |
| `royalty_recipients` | Collaborator Royalty |
| `brand_master` | Brand Master |
| `sr_reports` | Sales Report submissions |
| `sr_startdates` | Sales Report start dates |
| `leads` | Leads Tracker |

---

## Revenue Streams
`SD&Y`, `Lagaa`, `Marte`

## Termin Options
`Per Bulan`, `Per Quarter`, `Per Tahun`, `Per Akhir Project`

## Royalty Type Options
`Post-Sales`, `Advance`, `Both`

---

## Deploy Checklist

**Frontend (index.html):**
1. Edit `index.html`
2. `git add index.html && git commit -m "..." && git push`
3. GitHub Pages auto-deploys in ~1 min
4. Hard refresh browser (`Ctrl+Shift+R`)

**Backend (Code.gs):**
1. Open Apps Script editor
2. Paste updated `Code.gs`
3. Click Deploy → Manage Deployments → New Version
4. Run `clearAllCache()` in Apps Script console
5. No need to change the deployment URL

---

## Common Gotchas
- Always use GET not POST for API calls
- `sheet.getLastRow()` includes header, so new IDs are `padStart(3,"0")` of `lastRow`
- Cache TTL is 60 seconds — run `clearAllCache()` after backend changes
- IP Master column order matters: `ID(1) Name(2) Category(3) LiveStatus(4) Revenue(5) Agreements(6) RoyaltyType(7) Pct(8) Fixed(9) Termin(10) PPh(11) Notes(12)`
- Brand Master column order: `ID(1) Name(2) Category(3) LiveStatus(4) Revenue(5) Agreements(6) Apparel(7) Accessories(8) Collectible(9) Preloved(10) Wellness(11) Others(12) Notes(13)`
- Live Status defaults to "Active" — never save empty string for this field
- Duplicate names are rejected across IP Master + Brand Master
