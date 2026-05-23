/**
 * sync-jubelio-orders  v1
 *
 * Unified sync untuk SEMUA Jubelio sales orders (semua channel).
 *
 * POST body:
 *   {}                                          — daily mode: 60 hari ke belakang
 *   { "from": "2026-01-01" }                   — dari tanggal ini sampai hari ini
 *   { "from": "2026-01-01", "to": "2026-03-01" } — range eksplisit
 *   { "refresh_ids": [111442, 111673] }         — re-fetch order spesifik
 *
 * Optimizations:
 *   - 7-hari narrow windows → tidak ada timeout pagination
 *   - Skip COMPLETED + sudah punya detail → tidak re-fetch yang sudah beres
 *   - Update wms_status non-COMPLETED dari list response (tanpa API call tambahan)
 *   - 110s time budget → return next_from kalau belum selesai (untuk backfill bertahap)
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL         = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const JUBELIO_EMAIL        = Deno.env.get("JUBELIO_EMAIL") ?? "gio@suneatercoven.com";
const JUBELIO_PASSWORD     = Deno.env.get("JUBELIO_PASSWORD") ?? "Ryobodat100694!";
const BASE                 = "https://api2.jubelio.com";
const PAGE_SIZE            = 200;
const CONCURRENCY          = 10;
const WINDOW_DAYS          = 7;
const DEFAULT_LOOKBACK     = 60;
const TIME_BUDGET_MS       = 110_000;

// ── Column whitelists (same as sync-jubelio-gudang-offline v15) ────────────
const HEADER_COLS = new Set([
  "salesorder_id","salesorder_no","invoice_no","invoice_id","ref_no","contact_id","buyer_id",
  "invoice_created_date","transaction_date","created_date","last_modified",
  "payment_date","received_date","due_date","awb_created_date",
  "customer_name","customer_phone","customer_email","shipping_full_name",
  "location_id","location_name","channel_id","channel_name","store_id","store_name","source_name",
  "channel_status","internal_status","wms_status","is_paid","is_canceled","is_cod",
  "cancel_reason","cancel_reason_detail","internal_cancel_date",
  "mp_cancel_reason","mp_cancel_by","mp_cancel_date",
  "grand_total","sub_total","total_disc","total_tax","total_amount_mp",
  "is_tax_included","payment_method",
  "buyer_shipping_cost","shipping_cost","original_shipment_cost",
  "shipping_cost_discount","shipping_fee_discount_platform","shipping_fee_discount_seller",
  "insurance_cost","service_fee","cod_fee",
  "discount_marketplace","voucher_amount","add_disc","add_fee","total_weight_in_kg",
  "shipping_phone","shipping_address","shipping_area","shipping_city",
  "shipping_province","shipping_post_code","shipping_country","shipping_subdistric",
  "courier","shipper","tracking_number",
  "note","salesmen_id","salesmen_name","use_shipping_insurance",
  "raw_data","detail_synced_at","synced_at",
]);

const ITEM_COLS = new Set([
  "salesorder_detail_id","salesorder_id","item_id","item_code","item_name","item_group_id",
  "description","serial_no","serials","variant","unit","uom_id","qty","qty_picked",
  "weight_in_gram","price","sell_price","original_price","rate","disc","disc_amount",
  "disc_marketplace","tax_id","tax_name","tax_amount","amount","loc_id","loc_name",
  "thumbnail","shipper","shipped_date","awb_created_date","pack_scanned_date",
  "pick_scanned_date","channel_order_detail_id","ticket_no","destination_code",
  "origin_code","status","is_bundle","is_bundle_deal","is_free_gift","is_canceled_item",
  "is_return_resolved","reject_return_reason","fbm","is_fbm","use_serial_number",
  "use_batch_number","promotion_id","promotion_name",
]);

const FORCE_TEXT_HEADER = new Set([
  "customer_phone","shipping_phone","shipping_post_code","ref_no","tracking_number","internal_status",
]);
const FORCE_TEXT_ITEM = new Set([
  "channel_order_detail_id","ticket_no","sell_price","original_price","promotion_id",
  "destination_code","origin_code","reject_return_reason","fbm",
]);

// ── Helpers ────────────────────────────────────────────────────────────────
// deno-lint-ignore no-explicit-any
function filterCols(obj: Record<string, any>, allow: Set<string>, forceText: Set<string>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj)) {
    if (!allow.has(k)) continue;
    out[k] = forceText.has(k) && v != null && typeof v !== "string" ? String(v) : v;
  }
  return out;
}

// deno-lint-ignore no-explicit-any
function mapItem(item: any, salesorder_id: number): Record<string, unknown> {
  const price  = parseFloat(item.price  ?? "0") || 0;
  const disc   = parseFloat(item.disc   ?? "0") || 0;
  const amount = parseFloat(item.amount ?? "0") || 0;
  let qty      = parseFloat(item.qty    ?? "0") || 0;
  // Fix qty=0 bug on Jubelio POS items
  if (qty === 0 && price > 0 && amount > 0) {
    const unit = price * (1 - disc / 100);
    if (unit > 0) qty = Math.round(amount / unit);
  }
  if (qty === 0) qty = parseFloat(item.qty_in_base ?? "0") || 0;

  const filtered = filterCols(item, ITEM_COLS, FORCE_TEXT_ITEM);
  filtered.salesorder_id = salesorder_id;
  filtered.qty           = qty;
  return filtered;
}

async function jubelioLogin(): Promise<string> {
  const r = await fetch(`${BASE}/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: JUBELIO_EMAIL, password: JUBELIO_PASSWORD }),
  });
  if (!r.ok) throw new Error(`Login failed: ${r.status}`);
  const j = await r.json();
  if (!j.token) throw new Error("No token in login response");
  return j.token;
}

// deno-lint-ignore no-explicit-any
async function jubelioGet(path: string, token: string): Promise<any> {
  const r = await fetch(`${BASE}${path}`, {
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
  });
  if (!r.ok) {
    const t = await r.text();
    throw new Error(`Jubelio ${path} → ${r.status}: ${t.slice(0, 200)}`);
  }
  return r.json();
}

/** Fetch ALL orders for a narrow date window (handles pagination) */
// deno-lint-ignore no-explicit-any
async function fetchWindow(from: string, to: string, token: string): Promise<Record<string, any>[]> {
  const all: Record<string, unknown>[] = [];
  let page = 1;
  while (true) {
    const params = new URLSearchParams({
      transactionDateFrom: from,
      transactionDateTo:   to,
      pageSize:            String(PAGE_SIZE),
      page:                String(page),
    });
    // deno-lint-ignore no-explicit-any
    const data = await jubelioGet(`/sales/orders/?${params}`, token) as any;
    const rows = data.data ?? data.list ?? [];
    if (!rows.length) break;
    all.push(...rows);
    const total = data.totalCount ?? data.total_rows ?? data.totalRows ?? 0;
    if (all.length >= total || rows.length < PAGE_SIZE) break;
    page++;
    if (page > 50) break;
  }
  // deno-lint-ignore no-explicit-any
  return all as Record<string, any>[];
}

/** Build 7-day windows between two dates (ascending) */
function buildWindows(from: string, to: string): { from: string; to: string }[] {
  const wins: { from: string; to: string }[] = [];
  let cur = new Date(from + "T00:00:00Z");
  const end = new Date(to   + "T00:00:00Z");
  while (cur < end) {
    const next = new Date(cur);
    next.setUTCDate(next.getUTCDate() + WINDOW_DAYS);
    if (next > end) next.setTime(end.getTime());
    wins.push({ from: cur.toISOString().slice(0, 10), to: next.toISOString().slice(0, 10) });
    cur = new Date(next);
  }
  return wins;
}

/** Fetch details + upsert items for a list of order IDs (in batches of CONCURRENCY) */
async function fetchDetails(
  ids: number[],
  token: string,
  sb: ReturnType<typeof createClient>,
): Promise<{ fetched: number; items: number; errors: string[] }> {
  const now = new Date().toISOString();
  const allHeaders: Record<string, unknown>[] = [];
  const allItems:   Record<string, unknown>[] = [];
  const errors:     string[] = [];

  for (let i = 0; i < ids.length; i += CONCURRENCY) {
    const batch = ids.slice(i, i + CONCURRENCY);
    const results = await Promise.allSettled(
      batch.map(id => jubelioGet(`/sales/orders/${id}`, token))
    );
    for (let k = 0; k < results.length; k++) {
      const res = results[k];
      const id  = batch[k];
      if (res.status === "rejected") {
        errors.push(`${id}: ${res.reason?.message ?? res.reason}`);
        continue;
      }
      const d = res.value;
      const header = filterCols(d, HEADER_COLS, FORCE_TEXT_HEADER);
      header.raw_data         = d;
      header.detail_synced_at = now;
      allHeaders.push(header);
      for (const it of (d.items ?? [])) {
        allItems.push(mapItem(it, id));
      }
    }
  }

  // Bulk upsert headers
  for (let i = 0; i < allHeaders.length; i += 200) {
    const { error } = await sb.from("jubelio_sales_orders")
      .upsert(allHeaders.slice(i, i + 200), { onConflict: "salesorder_id" });
    if (error) errors.push(`header batch ${i}: ${error.message}`);
  }
  // Bulk upsert items
  for (let i = 0; i < allItems.length; i += 200) {
    const { error } = await sb.from("jubelio_sales_order_items")
      .upsert(allItems.slice(i, i + 200), { onConflict: "salesorder_detail_id" });
    if (error) errors.push(`items batch ${i}: ${error.message}`);
  }

  return { fetched: allHeaders.length, items: allItems.length, errors: errors.slice(0, 10) };
}

// ── Main handler ───────────────────────────────────────────────────────────
Deno.serve(async (req: Request) => {
  const startMs = Date.now();
  const elapsed = () => Date.now() - startMs;

  // deno-lint-ignore no-explicit-any
  let body: any = {};
  try { body = await req.json(); } catch { /* ok */ }

  const sb    = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
  const token = await jubelioLogin();

  // ── MODE: refresh specific order IDs ────────────────────────────────────
  if (Array.isArray(body.refresh_ids) && body.refresh_ids.length) {
    const ids: number[] = body.refresh_ids;
    const result = await fetchDetails(ids, token, sb);
    return new Response(JSON.stringify({
      ok: true, mode: "refresh_ids", ids_requested: ids.length, ...result,
      elapsed_ms: elapsed(),
    }), { headers: { "Content-Type": "application/json" } });
  }

  // ── MODE: window-based sync ──────────────────────────────────────────────
  const today   = new Date().toISOString().slice(0, 10);
  const toDate  = (body.to   as string | undefined) ?? today;
  const fromDate = body.from
    ? (body.from as string)
    : (() => { const d = new Date(); d.setUTCDate(d.getUTCDate() - DEFAULT_LOOKBACK); return d.toISOString().slice(0, 10); })();

  const windows = buildWindows(fromDate, toDate);

  let windowsDone = 0;
  let nextFrom: string | null = null;
  let totalNew = 0, totalStatusUpdated = 0, totalDetailFetched = 0, totalItems = 0;
  const allErrors: string[] = [];

  for (const win of windows) {
    if (elapsed() > TIME_BUDGET_MS) { nextFrom = win.from; break; }

    // 1. Fetch list from Jubelio
    let listRows: Record<string, unknown>[];
    try {
      listRows = await fetchWindow(win.from, win.to, token);
    } catch (e) {
      allErrors.push(`window ${win.from}→${win.to}: ${e}`);
      windowsDone++;
      continue;
    }
    if (!listRows.length) { windowsDone++; continue; }

    const ids = listRows.map(r => r.salesorder_id as number);

    // 2. Query DB: get existing IDs with their current status + has_detail flag
    type ExRow = { salesorder_id: number; wms_status: string; detail_synced_at: string | null };
    const existingMap = new Map<number, ExRow>();
    for (let i = 0; i < ids.length; i += 1000) {
      const { data } = await sb
        .from("jubelio_sales_orders")
        .select("salesorder_id, wms_status, detail_synced_at")
        .in("salesorder_id", ids.slice(i, i + 1000));
      for (const r of (data ?? []) as ExRow[]) existingMap.set(r.salesorder_id, r);
    }

    // 3. Categorize each order
    const toInsert:       Record<string, unknown>[] = [];
    const toFetchDetail:  number[]                  = [];
    const statusUpdates:  Record<string, unknown>[] = [];

    for (const row of listRows) {
      const id        = row.salesorder_id as number;
      const newStatus = (row.wms_status as string) ?? null;
      const ex        = existingMap.get(id);

      if (!ex) {
        // New — insert header + fetch detail
        const h = filterCols(row, HEADER_COLS, FORCE_TEXT_HEADER);
        h.synced_at = new Date().toISOString();
        toInsert.push(h);
        toFetchDetail.push(id);

      } else if (ex.wms_status === "COMPLETED" && ex.detail_synced_at !== null) {
        // Fully synced, status won't change — skip
        continue;

      } else {
        // Already in DB but not fully done
        if (ex.detail_synced_at === null) {
          // Missing detail → fetch it
          toFetchDetail.push(id);
        }
        // Status changed? Update from list response (no extra API call needed)
        if (ex.wms_status !== newStatus) {
          statusUpdates.push({
            salesorder_id: id,
            wms_status:    newStatus,
            is_canceled:   row.is_canceled ?? null,
            synced_at:     new Date().toISOString(),
          });
        }
      }
    }

    // 4. Insert new headers
    if (toInsert.length > 0) {
      for (let i = 0; i < toInsert.length; i += 500) {
        const { error } = await sb.from("jubelio_sales_orders")
          .upsert(toInsert.slice(i, i + 500), { onConflict: "salesorder_id" });
        if (error) allErrors.push(`insert ${win.from}: ${error.message}`);
      }
      totalNew += toInsert.length;
    }

    // 5. Bulk update changed statuses
    if (statusUpdates.length > 0) {
      for (let i = 0; i < statusUpdates.length; i += 500) {
        const { error } = await sb.from("jubelio_sales_orders")
          .upsert(statusUpdates.slice(i, i + 500), { onConflict: "salesorder_id", ignoreDuplicates: false });
        if (error) allErrors.push(`status update ${win.from}: ${error.message}`);
      }
      totalStatusUpdated += statusUpdates.length;
    }

    // 6. Fetch details for new + missing
    if (toFetchDetail.length > 0) {
      const res = await fetchDetails(toFetchDetail, token, sb);
      totalDetailFetched += res.fetched;
      totalItems         += res.items;
      allErrors.push(...res.errors);
    }

    windowsDone++;
  }

  return new Response(JSON.stringify({
    ok:                    true,
    mode:                  "window_sync",
    from:                  fromDate,
    to:                    toDate,
    windows_total:         windows.length,
    windows_processed:     windowsDone,
    done:                  nextFrom === null,
    next_from:             nextFrom,
    total_new:             totalNew,
    total_status_updated:  totalStatusUpdated,
    total_detail_fetched:  totalDetailFetched,
    total_items:           totalItems,
    errors:                allErrors.slice(0, 10),
    elapsed_ms:            elapsed(),
  }, null, 2), { headers: { "Content-Type": "application/json" } });
});
