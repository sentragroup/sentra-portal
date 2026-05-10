# Sentra Internal Tools — CLAUDE.md

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

> After editing `Code.gs`, deploy a new version in Apps Script editor and run `clearAllCache()`.

---

## How to Edit Efficiently (Token Optimization)

`index.html` is ~1977 lines (~42k tokens). **Never read the whole file.** Use section markers to target specific parts.

### Step 1 — Find the section line number
```bash
grep -n "<!-- SECTION_NAME\|// ── SECTION_NAME" index.html
```

### Step 2 — Read only that section
```
Read index.html  offset: <start_line>  limit: <lines_to_read>
```

### HTML Section Map (comment markers in `index.html`)

| Section | Grep for | ~Start line | ~Lines |
|---------|----------|-------------|--------|
| CSS styles | `<style>` | 9 | 160 |
| Login screen | `<!-- LOGIN -->` | 170 | 25 |
| App shell + sidebar | `<!-- APP -->` | 194 | 48 |
| Home page | `<!-- HOME -->` | 241 | 13 |
| Agreement page | `<!-- AGREEMENT -->` | 253 | 68 |
| IP Master page | `<!-- IP MASTER -->` | 320 | 87 |
| Royalty Recipients page | `<!-- ROYALTY RECIPIENTS -->` | 406 | 64 |
| Sales Report page | `<!-- SALES REPORT -->` | 469 | 79 |
| Brand Master page | `<!-- BRAND MASTER -->` | 547 | 83 |
| Leads Tracker page | `<!-- LEADS TRACKER -->` | 629 | 73 |

### JS Section Map (`// ── markers` in `index.html`)

| Section | Grep for | ~Start line | ~Lines |
|---------|----------|-------------|--------|
| Core (login, nav, utils) | `<script>` | 701 | 143 |
| Agreement JS | `// ── AGREEMENT ──` | 844 | 124 |
| IP Master JS | `// ── IP MASTER ──` | 968 | 164 |
| Royalty Recipients JS | `// ── ROYALTY RECIPIENTS ──` | 1132 | 112 |
| Brand Master JS | `// ── BRAND MASTER ──` | 1244 | 210 |
| Sales Report JS | `// ── SALES REPORT ──` | 1454 | 327 |
| preloadAutocomplete | `// ── PRELOAD AUTOCOMPLETE` | 1714 | 42 |
| PKS autocomplete | `// ── PKS AUTOCOMPLETE` | 1755 | 32 |
| Leads Tracker JS | `// ── LEADS TRACKER ──` | 1786 | 178 |
| Duplicate check | `// ── DUPLICATE CHECK ──` | 1964 | 14 |

### Adding a new module — what to touch
1. **Sidebar nav** — read `<!-- APP -->` section (~line 194), add `sb-item` after the last tracker
2. **Home card** — read `<!-- HOME -->` section (~line 241), add `tool-card` div
3. **Page HTML** — insert new `<!-- PAGE_NAME -->` block before closing tags (~line 700)
4. **JS** — insert new `// ── MODULE ──` block before `// ── DUPLICATE CHECK ──` (~line 1964)
5. **Backend** — add to `SHEETS`, `HEADERS`, `CACHE_KEY_XX`, action handlers, `buildXXList()`, `clearAllCache()`

---

## API Convention
All API calls use GET — more reliable from GitHub Pages static hosting.

```js
const res = await apiGet({ action: "submitIP", name, category, ... });
if (res.success) { ... } else { showFeedback("Gagal: " + res.error, "err"); }
```

Apps Script always returns `{ success: true/false, ...data }`.
Cache cleared on every write: `clearCache(CACHE_KEY_XX)`.

---

## Design System

**Colors:** `--black:#0c0c0c` `--white:#f8f7f4` `--off:#f0efe9` `--g100` `--g200` `--g400` `--g600`

**Fonts:** Syne (headings), DM Mono (labels/code), DM Sans (body)

**Status pills:**
```html
<span class="pill p-active">Active</span>      <!-- green -->
<span class="pill p-draft">Draft</span>        <!-- gray -->
<span class="pill p-review">Under Review</span><!-- yellow -->
<span class="pill p-signings">Signings</span>  <!-- blue -->
<span class="pill p-near">Near Expiring</span> <!-- orange -->
<span class="pill p-expired">Expired</span>    <!-- red -->
<span class="pill p-inactive">Inactive</span>  <!-- muted gray -->
```

**Standard page layout pattern:**
```html
<!-- MODULE NAME -->
<div class="page" id="page-modulename">
  <div class="page-header">
    <div><div class="page-title">Title</div><div class="page-sub">Subtitle</div></div>
    <div class="tab-bar">
      <button class="tab-btn active" onclick="switchXTab('new',this)">Tambah</button>
      <button class="tab-btn" onclick="switchXTab('list',this)">Semua</button>
    </div>
  </div>
  <div class="stats-row" style="grid-template-columns:repeat(N,1fr);margin-bottom:1.25rem;">
    <div class="stat-card"><div class="stat-num" id="x-s-total">—</div><div class="stat-lbl">Total</div></div>
  </div>
  <div id="xtab-new">
    <div class="form-card">
      <div class="form-sec">Section Label</div>
      <div class="form-grid">
        <div class="fg"><label>Field <span class="req">*</span></label><input type="text" id="x-field"></div>
        <div class="fg full"><!-- full width --></div>
      </div>
      <div class="btn-row">
        <button class="btn-primary" id="xSubmitBtn" onclick="submitX()">Simpan</button>
        <button class="btn-ghost" onclick="clearXForm()">Bersihkan</button>
      </div>
      <div class="feedback" id="x-feedback"></div>
    </div>
  </div>
  <div id="xtab-list" style="display:none;">
    <div class="filter-panel">...</div>
    <div class="table-toolbar">
      <button class="btn-refresh" onclick="loadX()">↻ Refresh</button>
      <div class="tcount" id="x-tcount">— entri</div>
    </div>
    <div class="table-wrap"><table>...</table></div>
  </div>
</div>
```

**Inline edit row pattern:**
```html
<tr id="x-edit-row-${r.rowIndex}" style="display:none">
  <td colspan="N" style="padding:0 12px 12px;">
    <div class="edit-row-form">
      <div class="edit-row-grid">
        <div class="fg"><label>Field</label><input id="x-e-field-${r.rowIndex}" value="${r.field}"></div>
      </div>
      <div class="edit-row-btns">
        <button class="btn-save" onclick="saveXEdit(${r.rowIndex})">Simpan</button>
        <button class="btn-cancel" onclick="closeXEdit(${r.rowIndex})">Batal</button>
      </div>
    </div>
  </td>
</tr>
```

---

## Modules

### 1. Agreement Tracker
**Page:** `page-agreement` | **JS:** `// ── AGREEMENT ──` (~line 844)
**Sheet:** `agreements` | **Cache:** `CACHE_KEY` | **ID prefix:** `AGR-`

Columns: `ID | Date Submitted | Agreement Title | Partner/Client | PIC | Related IP/Brand | Revenue Stream | Agreement Type | Start Date | End Date | Status | Link Agreement | Email Thread Link | Submitted By | Last Updated | Last Updated By`

- Manual status: `Draft → Under Review → Signings → Signed`
- Auto-status (computed from end date): `Active`, `Near Expiring` (≤30d), `Expired`
- Inline status dropdown in table row
- Filters: Status, Kondisi, Revenue, Brand, PIC, Type

---

### 2. IP Master
**Page:** `page-ipmaster` | **JS:** `// ── IP MASTER ──` (~line 968)
**Sheet:** `ip_master` | **Cache:** `CACHE_KEY_IP` | **ID prefix:** `IP-`

Columns (1-indexed): `ID(1) | Name(2) | Category(3) | LiveStatus(4) | Revenue(5) | Agreements(6) | RoyaltyType(7) | Pct(8) | Fixed(9) | Termin(10) | PPh(11) | Notes(12) | DateAdded(13) | AddedBy(14)`

- Two statuses: **Agreement Status** (computed via `computeIPStatus()`) + **Live Status** (manual col 4)
- Agreement Status: Active / Near Expiring / Expired / In Progress / No Agreement
- Revenue: multi-checkbox, stored comma-separated
- **Duplicate check** across IP Master + Brand Master

---

### 3. Collaborator Royalty
**Page:** `page-recipients` | **JS:** `// ── ROYALTY RECIPIENTS ──` (~line 1132)
**Sheet:** `royalty_recipients` | **Cache:** `CACHE_KEY_RR` | **ID prefix:** `RR-`

Columns: `ID | Nama Penerima | Tipe | Related IP | RoyaltyType | Pct | Fixed | Termin | LinkPKS | Notes | DateAdded | AddedBy`

- PKS field shows only when Tipe = "Collaborator"
- PKS autocomplete (`setupACPKS`) picks from Agreement Tracker → stores **Drive link** (not ID)
- `acAgrLinks` map: `{agrId: driveLink}`

---

### 4. Brand Master
**Page:** `page-brandmaster` | **JS:** `// ── BRAND MASTER ──` (~line 1244)
**Sheet:** `brand_master` | **Cache:** `CACHE_KEY_BM` | **ID prefix:** `BM-`

Columns (1-indexed): `ID(1) | Name(2) | Category(3) | LiveStatus(4) | Revenue(5) | Agreements(6) | Apparel(7) | Accessories(8) | Collectible(9) | Preloved(10) | Wellness(11) | Others(12) | Notes(13) | DateAdded(14) | AddedBy(15)`

Normal rates: Apparel 30% · Accessories 25% · Collectible 20% · Preloved 20% · Wellness 20% · Others 30%
- Non-standard rates shown with yellow ⚠️ pill
- **Duplicate check** across IP Master + Brand Master

---

### 5. Sales Report
**Page:** `page-salesreport` | **JS:** `// ── SALES REPORT ──` (~line 1454)
**Sheets:** `sr_reports`, `sr_startdates` | **Cache:** `CACHE_KEY_SR`

- Calendar grid: Brand rows × months (Jun–Dec 2026, 7 months fixed)
- Brand sources merged: Brand Master (Active) + IP Master (Active) + Royalty Recipients
- Cell key format: `"brandId_monthIdx"` (0-indexed, Jun=0)
- `SR_MONTHS` array defines the month config
- `isCellDue(brand, monthIdx)` — false if before brand's startDate
- Click cell → modal to submit/update/clear link

---

### 6. Leads Tracker
**Page:** `page-leads` | **JS:** `// ── LEADS TRACKER ──` (~line 1786)
**Sheet:** `leads` | **Cache:** `CACHE_KEY_LD` | **ID prefix:** `LD-`

Columns (1-indexed): `ID(1) | LeadName(2) | Category(3) | Stage(4) | PIC(5) | Revenue(6) | Contact(7) | Notes(8) | DateAdded(9) | AddedBy(10) | LastUpdated(11) | LastUpdatedBy(12)`

- Stage flow: `New → Contacted → Meeting → Proposal → Negotiation → Won / Lost / On Hold`
- Pipeline Aktif = stages: New, Contacted, Meeting, Proposal, Negotiation
- Inline stage dropdown in table (action: `updateLeadStage`)
- Filters: Stage, Category, Revenue, PIC, Search
- Actions: `submitLead`, `listLeads`, `updateLead`, `updateLeadStage`

---

## Key Global Variables (JS)

```js
let currentUser = "";
let allRows = [], acBrands = [], acTypes = [], acPics = [];            // Agreement
let allIPRows = [], acAgrOptions = [], acAgrLinks = {};                // IP Master
let acIPCategories = ["Musician","Brand","Filmmaker"];
let allRRRows = [], acRRTipes = [], acRRIPs = [];                      // Royalty Recipients
let allBMRows = [], acBMCategories = ["Musician","Brand","Filmmaker"]; // Brand Master
let srBrands = [], srReports = {};                                     // Sales Report
let allLeadsRows = [], acLeadsCategories = ["Musician","Brand","Filmmaker"]; // Leads
```

`acAgrOptions` — `[{id, label}]` where label = `"Partner — Type"`
`acAgrLinks` — `{agrId: driveLink}` used by PKS autocomplete

---

## Autocomplete System

```js
setupAC("input-id", "ac-list-id", () => arrayOfStrings);
setupAC("input-id", "ac-list-id", () => acAgrOptions.map(o=>o.id), () => acAgrOptions); // rich
setupACPKS("rr-pks", "ac-rr-pks");  // special: picks AGR → stores drive link
```

All autocompletes preloaded on login via `preloadAutocomplete()` (parallel fetch of agreements + IP + brand master).

---

## Backend (Code.gs) Conventions

**Adding a new module:**
```js
const CACHE_KEY_XX = "xx_data";
SHEETS.xx = "sheet_tab_name";
HEADERS.xx = ["ID", ...cols];

// in doGet:
if(action==="submitXX") { /* appendRow + clearCache(CACHE_KEY_XX) */ }
if(action==="listXX")   { /* cache check + buildXXList() */ }
if(action==="updateXX") { /* setRange values + clearCache */ }

function buildXXList() { /* read sheet, map to row objects */ }

// in clearAllCache — add CACHE_KEY_XX to the array
```

**ID generation:**
```js
const id = "PFX-" + Utilities.formatDate(now, tz, "yyyyMMdd") + "-" + String(sheet.getLastRow()).padStart(3,"0");
```

**Column update (1-indexed):**
```js
sheet.getRange(row, 2).setValue(p.name||"");   // col 2 = Name
sheet.getRange(row, 11).setValue(nowFmt);       // col 11 = Last Updated
```

---

## Google Sheet Tabs

| Tab | Module | Cache Key |
|-----|--------|-----------|
| `agreements` | Agreement Tracker | `CACHE_KEY` |
| `ip_master` | IP Master | `CACHE_KEY_IP` |
| `royalty_recipients` | Collaborator Royalty | `CACHE_KEY_RR` |
| `brand_master` | Brand Master | `CACHE_KEY_BM` |
| `sr_reports` | Sales Report submissions | `CACHE_KEY_SR` |
| `sr_startdates` | Sales Report start dates | `CACHE_KEY_SR` |
| `leads` | Leads Tracker | `CACHE_KEY_LD` |

---

## Revenue Streams
`SD&Y`, `Lagaa`, `Marte`

## Termin Options
`Per Bulan`, `Per Quarter`, `Per Tahun`, `Per Akhir Project`

## Royalty Type Options
`Post-Sales`, `Advance`, `Both`

---

## Deploy Checklist

**Frontend:**
```bash
git add index.html && git commit -m "feat: ..." && git push
# GitHub Pages auto-deploys in ~1 min. Hard refresh: Ctrl+Shift+R
```

**Backend:**
1. Paste updated `Code.gs` into Apps Script editor
2. Deploy → Manage Deployments → edit → New Version → Deploy
3. Run `clearAllCache()` in Apps Script console
4. URL stays the same — no frontend change needed

---

## Common Gotchas
- Always GET not POST for API calls (GitHub Pages CORS)
- `sheet.getLastRow()` includes header — IDs use this for sequential suffix
- Cache TTL = 60s — always `clearCache()` after writes
- Live Status must be "Active" or "Inactive" — never empty string
- Duplicate names rejected across IP Master + Brand Master (client-side check)
- Revenue stored comma-separated: `"SD&Y, Lagaa"`
- Related Agreements stored as comma-separated AGR IDs
