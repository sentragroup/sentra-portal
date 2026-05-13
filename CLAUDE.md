# Sentra Internal Tools — CLAUDE.md

## What is this?
Internal tools portal for Sentra, a merchandise company that manages musicians, brands, and filmmakers. Handles licensing agreements, royalty payments, and sales report tracking for their IP portfolio.

**Live URL:** https://sentragroup.github.io/sentra-portal
**Repo:** https://github.com/sentragroup/sentra-portal

---

## Stack
- **Frontend:** Single `index.html` — vanilla HTML/CSS/JS, no framework, no build step
- **Backend:** Supabase (PostgreSQL + PostgREST) via `@supabase/supabase-js@2` CDN
- **Database:** Supabase project `qyxdjdwgvwtrpnvfndnu`
- **Deploy:** Push `index.html` to GitHub → auto-deploys via GitHub Pages

**Supabase config (in `index.html` `<script>` head):**
```js
const SUPABASE_URL  = "https://qyxdjdwgvwtrpnvfndnu.supabase.co";
const SUPABASE_ANON = "eyJhbGci...";   // anon/public key
const sb = supabase.createClient(SUPABASE_URL, SUPABASE_ANON);
```

> RLS is enabled on all tables with `allow_all` policies (`USING (true) WITH CHECK (true)`).
> No backend deploy needed after frontend changes — push `index.html` and it's live.

---

## How to Edit Efficiently (Token Optimization)

`index.html` is ~2400 lines. **Never read the whole file.** Use section markers to target specific parts.

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
| Distribution Partner JS | `// ── DISTRIBUTION PARTNER ──` | 2142 | 240 |
| Duplicate check | `// ── DUPLICATE CHECK ──` | ~2380 | 14 |

### Adding a new module — what to touch
1. **Sidebar nav** — read `<!-- APP -->` section (~line 194), add `sb-item` after the last tracker
2. **Home card** — read `<!-- HOME -->` section (~line 241), add `tool-card` div
3. **Page HTML** — insert new `<!-- PAGE_NAME -->` block before closing `</div></body>` (~line 700)
4. **JS** — insert new `// ── MODULE ──` block before `// ── DUPLICATE CHECK ──`
5. **Supabase** — create table via MCP, enable RLS, add `allow_all` policy

---

## API Convention
All reads/writes go directly to Supabase via the JS client. No server-side code.

```js
// Read
const { data, error } = await sb.from("agreements").select("*").order("id");
if (error) throw error;

// Insert
const { error } = await sb.from("agreements").insert({ id: genId("AGR"), title, ... });

// Update
const { error } = await sb.from("agreements").update({ status }).eq("id", rowIndex);

// Delete
const { error } = await sb.from("agreements").delete().eq("id", rowIndex);
```

**ID generation (client-side):**
```js
function genId(prefix) {
  const d = new Date().toISOString().slice(0,10).replace(/-/g,"");
  return `${prefix}-${d}-${String(Math.floor(Math.random()*9000)+1000)}`;
}
// e.g. "AGR-20260513-4521"
```

**Mapper functions** translate Supabase snake_case → JS camelCase and set `rowIndex: r.id` so all existing `onclick` handlers work unchanged:
```js
function mapAgr(r) { return { rowIndex: r.id, id: r.id, title: r.title, ... }; }
function mapIP(r)  { return { rowIndex: r.id, id: r.id, name: r.name, liveStatus: r.live_status, ... }; }
function mapBM(r)  { return { rowIndex: r.id, ..., apparel: r.apparel_rate, ... }; }
function mapRR(r)  { return { rowIndex: r.id, ..., name: r.nama, ip: r.related_ip, ... }; }
function mapLD(r)  { return { rowIndex: r.id, ..., name: r.lead_name, revenue: r.revenue_stream, ... }; }
function mapDP(r)  { return { rowIndex: r.id, ..., name: r.partner_name, contactPerson: r.contact_person, ... }; }
```

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
**Table:** `agreements` | **ID prefix:** `AGR-`

Columns: `id | date_submitted | title | partner | pic | brand | revenue | type | start_date | end_date | status | link | email_link | notes | submitted_by | last_updated | last_updated_by`

- Manual status: `Draft → Under Review → Signings → Signed`
- Auto-status (computed from end date): `Active`, `Near Expiring` (≤30d), `Expired`
- Inline status dropdown in table row
- Filters: Status, Kondisi, Revenue, Brand, PIC, Type

---

### 2. IP Master
**Page:** `page-ipmaster` | **JS:** `// ── IP MASTER ──` (~line 968)
**Table:** `ip_master` | **ID prefix:** `IP-`

Columns: `id | name | category | live_status | revenue_stream | related_agreement | royalty_type | percentage | fixed_amount | termin | pph_tax_rate | notes | date_added | added_by | pic | last_updated | last_updated_by`

- Two statuses: **Agreement Status** (computed via `computeIPStatusLocal()`) + **Live Status** (manual)
- `computeIPStatusLocal(relatedAgreements)` — client-side, uses already-loaded `allRows`
- Agreement Status: Active / Near Expiring / Expired / In Progress / No Agreement
- Revenue: multi-checkbox, stored comma-separated
- **Duplicate check** across IP Master + Brand Master

---

### 3. Collaborator Royalty
**Page:** `page-recipients` | **JS:** `// ── ROYALTY RECIPIENTS ──` (~line 1132)
**Table:** `royalty_recipients` | **ID prefix:** `RR-`

Columns: `id | nama | tipe | related_ip | royalty_type | percentage | fixed_amount | termin | pks | notes | date_added | added_by | pic | last_updated | last_updated_by`

- PKS field shows only when Tipe = "Collaborator"
- PKS autocomplete (`setupACPKS`) picks from Agreement Tracker → stores **Drive link** (not AGR ID)
- `acAgrLinks` map: `{agrId: driveLink}`

---

### 4. Brand Master
**Page:** `page-brandmaster` | **JS:** `// ── BRAND MASTER ──` (~line 1244)
**Table:** `brand_master` | **ID prefix:** `BM-`

Columns: `id | name | category | live_status | revenue_stream | related_agreement | apparel_rate | accessories_rate | collectible_rate | preloved_rate | wellness_rate | others_rate | notes | date_added | added_by | pic | last_updated | last_updated_by`

Normal rates: Apparel 30% · Accessories 25% · Collectible 20% · Preloved 20% · Wellness 20% · Others 30%
- Rates stored as NUMERIC — use `parseFloat()` in forms
- Non-standard rates shown with yellow ⚠️ pill
- **Duplicate check** across IP Master + Brand Master

---

### 5. Sales Report
**Page:** `page-salesreport` | **JS:** `// ── SALES REPORT ──` (~line 1454)
**Tables:** `sr_reports`, `sr_startdates`

- Calendar grid: Brand rows × months (Jun–Dec 2026, 7 months fixed)
- Brand sources merged client-side: Brand Master (Active) + IP Master (Active) + Royalty Recipients
- Cell key format: `"brandId_monthIdx"` (0-indexed, Jun=0)
- `SR_MONTHS` array defines the month config
- `isCellDue(brand, monthIdx)` — false if before brand's startDate
- Click cell → modal to submit/update/clear link
- `sr_startdates` uses `upsert` with `onConflict: "brand_id"`

`sr_reports` columns: `id BIGSERIAL | brand_id | brand_name | month_index | link | notes | submitted_by | submitted_at`
`sr_startdates` columns: `id BIGSERIAL | brand_id UNIQUE | brand_name | start_date | set_by | set_at`

---

### 6. Leads Tracker
**Page:** `page-leads` | **JS:** `// ── LEADS TRACKER ──` (~line 1786)
**Table:** `leads` | **ID prefix:** `LD-`

Columns: `id | lead_name | category | stage | pic | revenue_stream | contact | notes | priority | date_added | added_by | last_updated | last_updated_by`

- Stage flow: `New → Contacted → Meeting → Proposal → Negotiation → Won / Lost / On Hold`
- Pipeline Aktif = stages: New, Contacted, Meeting, Proposal, Negotiation
- Inline stage dropdown in table
- Filters: Stage, Category, Revenue, PIC, Search

---

### 7. Distribution Partner
**Page:** `page-distpartner` | **JS:** `// ── DISTRIBUTION PARTNER ──` (~line 2142)
**Table:** `dist_partners` | **ID prefix:** `DP-`

Columns: `id | partner_name | type | channel | region | pic | contact_person | contact_info | related_agreement | live_status | notes | date_added | added_by | last_updated | last_updated_by`

- Type: `Consignment`, `Bulk Purchase` (multi-value, comma-separated)
- Channel: `Online Store`, `Physical Store`, `Marketplace`, `Pop-up` (multi-value)
- Filters: Type, Channel, Live Status, PIC, Search

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
let allDPRows = [], acDPTypes = [...], acDPChannels = [...];           // Dist Partners
```

`acAgrOptions` — `[{id, label}]` where label = `"Partner — Type"`
`acAgrLinks` — `{agrId: driveLink}` used by PKS autocomplete

---

## Autocomplete System

```js
setupAC("input-id", "ac-list-id", () => arrayOfStrings);
setupAC("input-id", "ac-list-id", () => acAgrOptions.map(o=>o.id), () => acAgrOptions); // rich
setupACPKS("rr-pks", "ac-rr-pks");  // special: picks AGR → stores drive link
setupACMulti("dp-type", "ac-dp-type", () => acDPTypes);  // multi-value comma input
```

All autocompletes preloaded on login via `preloadAutocomplete()` (parallel Supabase fetch of agreements + ip_master + brand_master).

---

## Supabase Tables

| Table | Module | ID prefix |
|-------|--------|-----------|
| `agreements` | Agreement Tracker | `AGR-` |
| `ip_master` | IP Master | `IP-` |
| `royalty_recipients` | Collaborator Royalty | `RR-` |
| `brand_master` | Brand Master | `BM-` |
| `sr_reports` | Sales Report submissions | BIGSERIAL |
| `sr_startdates` | Sales Report start dates | BIGSERIAL |
| `leads` | Leads Tracker | `LD-` |
| `dist_partners` | Distribution Partner | `DP-` |

All tables have RLS enabled with `allow_all` policy:
```sql
CREATE POLICY "allow_all" ON table_name FOR ALL USING (true) WITH CHECK (true);
```

---

## Revenue Streams
`SD&Y`, `Lagaa`, `Marte`

## Termin Options
`Per Bulan`, `Per Quarter`, `Per Tahun`, `Per Akhir Project`

## Royalty Type Options
`Post-Sales`, `Advance`, `Both`

---

## Deploy Checklist

**Frontend only — no backend deploy ever needed:**
```bash
git add index.html && git commit -m "feat: ..." && git push
# GitHub Pages auto-deploys in ~1 min. Hard refresh: Ctrl+Shift+R
```

**Schema changes (Supabase):**
1. Use Supabase MCP `apply_migration` for DDL (CREATE TABLE, ALTER TABLE)
2. Use `execute_sql` for data fixes
3. No restart or cache clear needed — changes are live instantly

---

## Common Gotchas
- `rowIndex` in all mapper functions is set to `r.id` (the string ID, e.g. "AGR-20260513-4521") — this is what gets passed to `openEdit(rowIndex)`, `delete(rowIndex)`, etc.
- BM rates are NUMERIC in Postgres — use `parseFloat()` when reading form values, not string comparison
- `computeIPStatusLocal()` runs client-side; `loadIPMaster()` pre-loads agreements if `allRows` is empty
- Sales Report brand list is built client-side by merging BM + IP + RR fetches
- `sr_startdates` upsert uses `onConflict: "brand_id"`
- `sr_reports` insert/update uses check-then-insert pattern (no unique constraint on brand_id+month_index)
- Revenue stored comma-separated: `"SD&Y, Lagaa"`
- Related Agreements stored as comma-separated AGR IDs
- Duplicate names rejected across IP Master + Brand Master (client-side `checkDuplicate()`)
