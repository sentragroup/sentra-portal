/**
 * fetch-jubelio-missing  v5
 *
 * Modes (POST body JSON, always requires "secret"):
 *
 * 1. Dry-run / upsert by date window:
 *    { "secret":"...", "run":true, "periods":[{"from":"2026-03-19","to":"2026-03-20"}] }
 *
 * 2. Auto last-N-days (for cron – MARTE POS only by default):
 *    { "secret":"...", "run":true, "last_days":21 }
 *
 * 3. All-channel search (find missing Shopee / non-POS orders):
 *    { "secret":"...", "run":true, "periods":[...], "channel_filter":null }
 *
 * 4. Refresh specific order IDs (re-fetch from Jubelio, update wms_status + items):
 *    { "secret":"...", "run":true, "refresh_ids":[111442, 111673] }
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL        = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const JUBELIO_EMAIL       = Deno.env.get("JUBELIO_EMAIL") ?? "gio@suneatercoven.com";
const JUBELIO_PASSWORD    = Deno.env.get("JUBELIO_PASSWORD") ?? "Ryobodat100694!";
const SECRET              = "sntr-jbl-missing-f9k3";
const BASE                = "https://api2.jubelio.com";
const PAGE_SIZE           = 200;

interface Period { from: string; to: string; }

const DEFAULT_PERIODS: Period[] = [
  { from: "2026-03-19", to: "2026-03-20" },
  { from: "2026-04-27", to: "2026-05-01" },
];

async function jubelioLogin(): Promise<string> {
  const r = await fetch(`${BASE}/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: JUBELIO_EMAIL, password: JUBELIO_PASSWORD }),
  });
  if (!r.ok) throw new Error(`Login failed: ${r.status}`);
  const j = await r.json();
  if (!j.token) throw new Error(`No token in login response`);
  return j.token;
}

// deno-lint-ignore no-explicit-any
async function jubelioGet(path: string, token: string): Promise<any> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Jubelio ${path} → ${res.status}: ${text.slice(0, 200)}`);
  }
  return res.json();
}

function buildLastDaysPeriods(lastDays: number, windowDays = 7): Period[] {
  const periods: Period[] = [];
  const today = new Date();
  let end = new Date(today);
  end.setUTCDate(end.getUTCDate() + 1);
  const earliest = new Date(today);
  earliest.setUTCDate(earliest.getUTCDate() - lastDays);
  while (end > earliest) {
    const start = new Date(end);
    start.setUTCDate(start.getUTCDate() - windowDays);
    if (start < earliest) start.setTime(earliest.getTime());
    periods.unshift({ from: start.toISOString().slice(0, 10), to: end.toISOString().slice(0, 10) });
    end = new Date(start);
  }
  return periods;
}

async function fetchOrdersInWindow(from: string, to: string, token: string): Promise<unknown[]> {
  const allOrders: unknown[] = [];
  let page = 1;
  while (true) {
    const params = new URLSearchParams({
      transactionDateFrom: from,
      transactionDateTo: to,
      pageSize: String(PAGE_SIZE),
      page: String(page),
    });
    // deno-lint-ignore no-explicit-any
    const data = await jubelioGet(`/sales/orders/?${params}`, token) as any;
    const rows: unknown[] = data.data ?? data.list ?? [];
    if (!rows.length) break;
    allOrders.push(...rows);
    const total = data.totalCount ?? data.total_rows ?? data.totalRows ?? 0;
    if (allOrders.length >= total || rows.length < PAGE_SIZE) break;
    page++;
    if (page > 50) break;
  }
  return allOrders;
}

// deno-lint-ignore no-explicit-any
function mapHeader(r: any) {
  return {
    salesorder_id: r.salesorder_id,
    salesorder_no: r.salesorder_no,
    invoice_no: r.invoice_no ?? null,
    invoice_created_date: r.invoice_created_date ?? null,
    shipping_full_name: r.shipping_full_name ?? null,
    customer_name: r.customer_name ?? null,
    transaction_date: r.transaction_date ?? null,
    created_date: r.created_date ?? null,
    location_name: r.location_name ?? null,
    grand_total: r.grand_total ?? null,
    channel_status: r.channel_status ?? null,
    internal_status: r.internal_status ?? null,
    is_paid: r.is_paid ?? null,
    is_canceled: r.is_canceled ?? null,
    channel_name: r.source_name ?? r.channel_name ?? null,
    store_name: r.store_name ?? null,
    shipper: r.shipper ?? null,
    store_id: r.store_id ?? null,
    channel_id: r.channel_id ?? null,
    awb_created_date: r.awb_created_date ?? null,
    last_modified: r.last_modified ?? null,
    cancel_reason: r.cancel_reason ?? null,
    cancel_reason_detail: r.cancel_reason_detail ?? null,
    wms_status: r.wms_status ?? null,
    note: r.note ?? null,
    tracking_number: r.tracking_number ?? null,
    is_cod: r.is_cod ?? null,
    ref_no: r.ref_no ?? null,
    customer_phone: r.customer_phone ?? null,
    customer_email: r.customer_email ?? null,
    contact_id: r.contact_id ?? null,
    invoice_id: r.invoice_id ?? null,
    payment_date: r.payment_date ?? null,
    is_tax_included: r.is_tax_included ?? null,
    sub_total: r.sub_total ?? null,
    total_disc: r.total_disc ?? null,
    total_tax: r.total_tax ?? null,
    payment_method: r.payment_method ?? null,
    buyer_shipping_cost: r.buyer_shipping_cost ?? null,
    shipping_cost: r.shipping_cost ?? null,
    insurance_cost: r.insurance_cost ?? null,
    service_fee: r.service_fee ?? null,
    discount_marketplace: r.discount_marketplace ?? null,
    add_disc: r.add_disc ?? null,
    add_fee: r.add_fee ?? null,
    voucher_amount: r.voucher_amount ?? null,
    cod_fee: r.cod_fee ?? null,
    original_shipment_cost: r.original_shipment_cost ?? null,
    shipping_cost_discount: r.shipping_cost_discount ?? null,
    shipping_fee_discount_platform: r.shipping_fee_discount_platform ?? null,
    shipping_fee_discount_seller: r.shipping_fee_discount_seller ?? null,
    shipping_phone: r.shipping_phone ?? null,
    shipping_address: r.shipping_address ?? null,
    shipping_area: r.shipping_area ?? null,
    shipping_city: r.shipping_city ?? null,
    shipping_province: r.shipping_province ?? null,
    shipping_post_code: r.shipping_post_code ?? null,
    shipping_country: r.shipping_country ?? null,
    shipping_subdistric: r.shipping_subdistric ?? null,
    total_weight_in_kg: r.total_weight_in_kg ?? null,
    location_id: r.location_id ?? null,
    source_name: r.source_name ?? null,
    buyer_id: r.buyer_id ?? null,
    courier: r.courier ?? null,
    received_date: r.received_date ?? null,
    due_date: r.due_date ?? null,
    internal_cancel_date: r.internal_cancel_date ?? null,
    salesmen_id: r.salesmen_id ?? null,
    salesmen_name: r.salesmen_name ?? null,
    use_shipping_insurance: r.use_shipping_insurance ?? null,
    mp_cancel_reason: r.mp_cancel_reason ?? null,
    mp_cancel_by: r.mp_cancel_by ?? null,
    mp_cancel_date: r.mp_cancel_date ?? null,
    total_amount_mp: r.total_amount_mp ?? null,
    raw_data: null,
    synced_at: new Date().toISOString(),
    detail_synced_at: null,
  };
}

// deno-lint-ignore no-explicit-any
function mapItem(item: any, salesorder_id: number) {
  const price  = parseFloat(item.price  ?? "0") || 0;
  const disc   = parseFloat(item.disc   ?? "0") || 0;
  const amount = parseFloat(item.amount ?? "0") || 0;
  const rawQty = parseFloat(item.qty    ?? "0") || 0;
  let qty = rawQty;
  if (qty === 0 && price > 0 && amount > 0) {
    const unitPrice = price * (1.0 - disc / 100.0);
    if (unitPrice > 0) qty = Math.round(amount / unitPrice);
  }
  if (qty === 0) qty = parseFloat(item.qty_in_base ?? "0") || 0;
  return {
    salesorder_detail_id: item.salesorder_detail_id,
    salesorder_id,
    item_id: item.item_id,
    item_code: item.item_code ?? null,
    item_name: item.item_name ?? null,
    qty,
    price,
    disc,
    disc_amount: parseFloat(item.disc_amount ?? "0") || 0,
    amount,
    unit: item.unit ?? null,
    variant: item.variant ?? null,
    location_id: item.loc_id ?? null,
    location_name: item.loc_name ?? null,
  };
}

Deno.serve(async (req) => {
  let body: {
    secret?: string;
    run?: boolean;
    periods?: Period[];
    last_days?: number;
    window_days?: number;
    channel_filter?: string | null;  // undefined/"MARTESCSHR" = POS only, null = all channels
    refresh_ids?: number[];          // re-fetch + update these specific salesorder_ids
  } = {};
  try { body = await req.json(); } catch { /* ok */ }

  if (body.secret !== SECRET) {
    return new Response(JSON.stringify({ error: "unauthorized" }), { status: 401 });
  }

  const run = body.run === true;
  const sb  = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
  const token = await jubelioLogin();

  // ── MODE 4: refresh specific order IDs ──────────────────────────────────
  if (body.refresh_ids?.length) {
    const ids = body.refresh_ids;
    const results: unknown[] = [];
    for (const id of ids) {
      try {
        // deno-lint-ignore no-explicit-any
        const detail = await jubelioGet(`/sales/orders/${id}`, token) as any;
        if (run) {
          await sb.from("jubelio_sales_orders").update({
            wms_status:       detail.wms_status ?? null,
            is_canceled:      detail.is_canceled ?? null,
            raw_data:         detail,
            detail_synced_at: new Date().toISOString(),
            channel_name:     detail.source_name ?? null,
            invoice_no:       detail.invoice_no ?? null,
            invoice_id:       detail.invoice_id ?? null,
          }).eq("salesorder_id", id);

          const items = (detail.items ?? []).map((item: unknown) => mapItem(item, id));
          if (items.length > 0) {
            await sb.from("jubelio_sales_order_items")
              .upsert(items, { onConflict: "salesorder_detail_id", ignoreDuplicates: false });
          }
        }
        results.push({
          salesorder_id: id,
          salesorder_no: detail.salesorder_no,
          wms_status: detail.wms_status,
          is_canceled: detail.is_canceled,
          items_count: (detail.items ?? []).length,
        });
      } catch (e) {
        results.push({ salesorder_id: id, error: String(e) });
      }
    }
    return new Response(JSON.stringify({ run, mode: "refresh_ids", results }, null, 2), {
      headers: { "Content-Type": "application/json" },
    });
  }

  // ── MODE 1/2/3: date window search ──────────────────────────────────────
  let periods: Period[];
  if (body.last_days) {
    periods = buildLastDaysPeriods(body.last_days, body.window_days ?? 7);
  } else {
    periods = body.periods ?? DEFAULT_PERIODS;
  }

  // channel_filter: undefined/unset → "MARTESCSHR" (POS only, for cron)
  //                 null             → no filter (all channels)
  //                 "SOME_STRING"    → filter by that string
  const channelFilter: string | null =
    "channel_filter" in body ? (body.channel_filter ?? null) : "MARTESCSHR";

  const results: unknown[] = [];
  let totalNew = 0, totalFetched = 0, totalItems = 0;

  for (const period of periods) {
    console.log(`Fetching ${period.from} → ${period.to} (filter=${channelFilter ?? "ALL"}) ...`);
    let listRows: unknown[];
    try {
      listRows = await fetchOrdersInWindow(period.from, period.to, token);
    } catch (e) {
      results.push({ period, error: String(e) });
      continue;
    }

    // Apply channel filter
    // deno-lint-ignore no-explicit-any
    const filtered = channelFilter
      ? listRows.filter((r: any) =>
          typeof r.salesorder_no === "string" && r.salesorder_no.includes(channelFilter)
        )
      : listRows;

    console.log(`  → ${listRows.length} total, ${filtered.length} after filter`);

    // Check which are already in DB
    // deno-lint-ignore no-explicit-any
    const incomingIds = filtered.map((r: any) => r.salesorder_id);
    let existingIds = new Set<number>();
    if (incomingIds.length > 0) {
      const { data: existing } = await sb
        .from("jubelio_sales_orders")
        .select("salesorder_id")
        .in("salesorder_id", incomingIds);
      existingIds = new Set((existing ?? []).map((x: { salesorder_id: number }) => x.salesorder_id));
    }

    // deno-lint-ignore no-explicit-any
    const newRows = filtered.filter((r: any) => !existingIds.has(r.salesorder_id));
    console.log(`  → ${newRows.length} genuinely new`);
    totalNew += newRows.length;

    if (!run) {
      results.push({
        period,
        total_in_window: listRows.length,
        filtered_count: filtered.length,
        new_count: newRows.length,
        // deno-lint-ignore no-explicit-any
        new_orders: newRows.map((r: any) => ({
          salesorder_id: r.salesorder_id,
          salesorder_no: r.salesorder_no,
          transaction_date: r.transaction_date,
          wms_status: r.wms_status,
        })),
      });
      continue;
    }

    if (newRows.length > 0) {
      const headers = newRows.map(mapHeader);
      const { error: hErr } = await sb
        .from("jubelio_sales_orders")
        .upsert(headers, { onConflict: "salesorder_id", ignoreDuplicates: false });
      if (hErr) { results.push({ period, error: `header upsert: ${hErr.message}` }); continue; }
    }

    let detailFetched = 0, itemsInserted = 0;
    for (const row of newRows) {
      // deno-lint-ignore no-explicit-any
      const r = row as any;
      try {
        const detail = await jubelioGet(`/sales/orders/${r.salesorder_id}`, token) as {
          // deno-lint-ignore no-explicit-any
          items?: any[]; wms_status?: string; [k: string]: any;
        };
        await sb.from("jubelio_sales_orders").update({
          raw_data:         detail,
          detail_synced_at: new Date().toISOString(),
          wms_status:       detail.wms_status ?? r.wms_status,
          invoice_id:       detail.invoice_id ?? r.invoice_id,
          invoice_no:       detail.invoice_no ?? r.invoice_no,
          channel_name:     detail.source_name ?? r.source_name ?? null,
        }).eq("salesorder_id", r.salesorder_id);

        const items = (detail.items ?? []).map((item) => mapItem(item, r.salesorder_id));
        if (items.length > 0) {
          const { error: iErr } = await sb
            .from("jubelio_sales_order_items")
            .upsert(items, { onConflict: "salesorder_detail_id", ignoreDuplicates: false });
          if (iErr) throw new Error(`items upsert: ${iErr.message}`);
          itemsInserted += items.length;
        }
        detailFetched++;
        totalFetched++;
        totalItems += items.length;
      } catch (e) {
        console.error(`  Detail fetch failed for ${r.salesorder_id}: ${e}`);
      }
    }

    results.push({
      period,
      total_in_window: listRows.length,
      filtered_count: filtered.length,
      new_count: newRows.length,
      headers_upserted: newRows.length,
      details_fetched: detailFetched,
      items_inserted: itemsInserted,
    });
  }

  return new Response(JSON.stringify({ run, channel_filter: channelFilter, periods_checked: periods.length, total_new: totalNew, total_fetched: totalFetched, total_items: totalItems, results }, null, 2), {
    headers: { "Content-Type": "application/json" },
  });
});
