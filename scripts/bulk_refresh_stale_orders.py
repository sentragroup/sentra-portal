#!/usr/bin/env python3
"""
One-shot bulk refresh of stale jubelio_sales_orders.

Targets COMPLETED orders where the discount/grand_total signature is
suspicious (total_disc=0 AND sub_total=grand_total). These were synced
before the v3 sync logic that always re-fetches detail for non-COMPLETED
orders, so they're stuck with whatever Jubelio returned at first sync.

Calls sync-jubelio-orders edge function with refresh_ids in batches of
300 per invocation. Sleeps 2s between calls to be polite to Jubelio.

Usage:
  python3 scripts/bulk_refresh_stale_orders.py             # all 6700+
  python3 scripts/bulk_refresh_stale_orders.py --limit 500 # smoke-test 500
"""
import argparse
import os
import sys
import time
from pathlib import Path

try:
    from dotenv import load_dotenv
    load_dotenv(Path(__file__).parent / ".env")
except ImportError:
    pass

import httpx

SUPABASE_URL = os.getenv("SUPABASE_URL", "https://qyxdjdwgvwtrpnvfndnu.supabase.co")
SUPABASE_SERVICE_KEY = os.getenv("SUPABASE_SERVICE_KEY", "")

BATCH_SIZE = 300
SLEEP_BETWEEN_BATCHES = 2.0  # seconds, polite pacing


def fetch_suspicious_ids(limit=None):
    """Fetch all salesorder_id matching the stale signature, paginated."""
    headers = {
        "apikey": SUPABASE_SERVICE_KEY,
        "Authorization": f"Bearer {SUPABASE_SERVICE_KEY}",
    }
    rest = f"{SUPABASE_URL}/rest/v1/jubelio_sales_orders"
    params = {
        "select": "salesorder_id",
        "wms_status": "eq.COMPLETED",
        "total_disc": "eq.0",
        # PostgREST doesn't support inter-column comparison directly; we filter
        # client-side by also fetching sub_total + grand_total.
    }
    # Easier: pull (sub_total, grand_total) and filter in Python.
    params["select"] = "salesorder_id,sub_total,grand_total"

    ids = []
    page_size = 1000
    offset = 0
    while True:
        ph = {**headers, "Range-Unit": "items", "Range": f"{offset}-{offset+page_size-1}"}
        with httpx.Client(timeout=60) as client:
            r = client.get(rest, headers=ph, params=params)
            r.raise_for_status()
        rows = r.json()
        if not rows:
            break
        for row in rows:
            sub = row.get("sub_total")
            gt = row.get("grand_total")
            if sub is None or gt is None:
                continue
            if float(sub) == float(gt):  # stale signature
                ids.append(row["salesorder_id"])
        if len(rows) < page_size:
            break
        offset += page_size
        if limit and len(ids) >= limit:
            ids = ids[:limit]
            break
    return ids


def refresh_batch(ids):
    """Call sync-jubelio-orders with refresh_ids and return result dict."""
    url = f"{SUPABASE_URL}/functions/v1/sync-jubelio-orders"
    headers = {
        "Content-Type": "application/json",
        "Authorization": f"Bearer {SUPABASE_SERVICE_KEY}",
    }
    with httpx.Client(timeout=180) as client:
        r = client.post(url, headers=headers, json={"refresh_ids": ids})
        r.raise_for_status()
    return r.json()


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--limit", type=int, default=None, help="cap total IDs (for smoke test)")
    parser.add_argument("--batch-size", type=int, default=BATCH_SIZE)
    parser.add_argument("--sleep", type=float, default=SLEEP_BETWEEN_BATCHES)
    args = parser.parse_args()

    if not SUPABASE_SERVICE_KEY:
        print("ERROR: SUPABASE_SERVICE_KEY missing. Set in scripts/.env", file=sys.stderr)
        sys.exit(1)

    print(f"Fetching stale SO ids (total_disc=0 AND sub_total=grand_total, COMPLETED)...")
    ids = fetch_suspicious_ids(limit=args.limit)
    print(f"Found {len(ids)} candidate(s)\n")

    if not ids:
        print("Nothing to do.")
        return

    total_batches = (len(ids) + args.batch_size - 1) // args.batch_size
    print(f"Will run {total_batches} batches of {args.batch_size}, ~{args.sleep}s gap between\n")

    t0 = time.time()
    grand_fetched = 0
    grand_errors = 0
    for i, start in enumerate(range(0, len(ids), args.batch_size), 1):
        batch = ids[start:start + args.batch_size]
        try:
            result = refresh_batch(batch)
            fetched = result.get("fetched", 0)
            items = result.get("items", 0)
            errs = result.get("errors", [])
            grand_fetched += fetched
            grand_errors += len(errs)
            print(f"[{i}/{total_batches}] {len(batch)} sent → fetched={fetched} items={items} errors={len(errs)} elapsed_ms={result.get('elapsed_ms','?')}")
            if errs:
                for e in errs[:3]:
                    print(f"     ⚠ {e}")
        except Exception as e:
            print(f"[{i}/{total_batches}] FAILED: {type(e).__name__}: {e}")
            grand_errors += len(batch)
        if i < total_batches:
            time.sleep(args.sleep)

    dur = time.time() - t0
    print(f"\nDone in {dur:.1f}s. Total fetched={grand_fetched}, errors~={grand_errors}")


if __name__ == "__main__":
    main()
