#!/usr/bin/env python3
"""
Weekly KOL follower refresh — runs locally on a Mac via launchd.

Reads kol_database from Supabase, fetches follower counts per platform,
writes back to followers_by_platform JSONB + last_refreshed_at + tier.

Platforms supported:
- YouTube: official Data API v3 (free, reliable)
- Instagram, TikTok: Playwright with real Chromium (residential IP advantage)

Setup once:
  pip3 install playwright httpx python-dotenv
  python3 -m playwright install chromium
  cp scripts/.env.example scripts/.env  # then fill in keys

Usage:
  python3 scripts/refresh_kol.py --dry-run            # preview, no DB write
  python3 scripts/refresh_kol.py --limit 3 --dry-run  # smoke test 3 rows
  python3 scripts/refresh_kol.py --kol "Najwa Shihab" # one KOL only
  python3 scripts/refresh_kol.py                      # full refresh + DB write
"""
import argparse
import asyncio
import os
import re
import sys
from datetime import datetime, timezone
from pathlib import Path

# Load .env from scripts/ dir
try:
    from dotenv import load_dotenv
    load_dotenv(Path(__file__).parent / ".env")
except ImportError:
    pass

SUPABASE_URL = os.getenv("SUPABASE_URL", "https://qyxdjdwgvwtrpnvfndnu.supabase.co")
SUPABASE_SERVICE_KEY = os.getenv("SUPABASE_SERVICE_KEY", "")
YOUTUBE_API_KEY = os.getenv("YOUTUBE_API_KEY", "")
PER_PROFILE_DELAY = float(os.getenv("PER_PROFILE_DELAY", "5"))  # seconds

# Tier thresholds — pick the highest follower count across platforms
TIER_THRESHOLDS = [
    (1_000_000, "Mega"),
    (500_000,   "Macro"),
    (100_000,   "Mid"),
    (10_000,    "Micro"),
    (0,         "Nano"),
]


def compute_tier(followers_by_platform):
    counts = [v for v in (followers_by_platform or {}).values() if isinstance(v, int) and v > 0]
    if not counts:
        return None
    m = max(counts)
    for thresh, name in TIER_THRESHOLDS:
        if m >= thresh:
            return name
    return "Nano"


def parse_short(s):
    """Parse '1.2M' / '500K' / '1,234' → integer."""
    if not s:
        return None
    s = s.replace(",", "").strip().upper()
    m = re.match(r"^([\d.]+)\s*([KMB])?", s)
    if not m:
        return None
    n = float(m.group(1))
    suf = m.group(2)
    if suf == "K":
        n *= 1_000
    elif suf == "M":
        n *= 1_000_000
    elif suf == "B":
        n *= 1_000_000_000
    return int(n)


# ---- YouTube (official API) -------------------------------------------
def yt_handle_from_url(url):
    m = re.search(r"youtube\.com/(@[^/?#]+|channel/[^/?#]+|c/[^/?#]+|user/[^/?#]+)", url)
    return m.group(1) if m else None


async def fetch_youtube(client, url):
    if not YOUTUBE_API_KEY:
        return {"error": "YOUTUBE_API_KEY not set in .env"}
    raw = yt_handle_from_url(url)
    if not raw:
        return {"error": "could not parse YouTube URL"}
    params = {"part": "statistics", "key": YOUTUBE_API_KEY}
    if raw.startswith("@"):
        params["forHandle"] = raw
    elif raw.startswith("channel/"):
        params["id"] = raw.split("/", 1)[1]
    elif raw.startswith("user/"):
        params["forUsername"] = raw.split("/", 1)[1]
    elif raw.startswith("c/"):
        return {"error": "legacy /c/ URL not supported; switch to @handle"}
    try:
        r = await client.get("https://www.googleapis.com/youtube/v3/channels", params=params)
    except Exception as e:
        return {"error": f"YT API request failed: {e}"}
    if r.status_code != 200:
        return {"error": f"YT API {r.status_code}: {r.text[:200]}"}
    items = r.json().get("items", [])
    if not items:
        return {"error": "no channel found (handle wrong?)"}
    stats = items[0].get("statistics", {}) or {}
    sub = stats.get("subscriberCount")
    if sub is None:
        return {"error": "subscriberCount hidden"}
    return {"followers": int(sub)}


# ---- Instagram (Playwright) -------------------------------------------
async def fetch_instagram(page, url):
    m = re.search(r"instagram\.com/([^/?#]+)", url)
    if not m:
        return {"error": "could not parse IG URL"}
    handle = m.group(1).strip("/")
    target = f"https://www.instagram.com/{handle}/"
    try:
        await page.goto(target, wait_until="domcontentloaded", timeout=25000)
        await page.wait_for_timeout(2500)
        # Meta description: "X Followers, Y Following, Z Posts - ..."
        try:
            content = await page.locator('meta[name="description"]').first.get_attribute(
                "content", timeout=4000
            )
        except Exception:
            content = None
        if content:
            m2 = re.search(r"([\d.,KMB]+)\s+Followers?", content, re.IGNORECASE)
            if m2:
                n = parse_short(m2.group(1))
                if n:
                    return {"followers": n}
        # Fallback — scan rendered HTML for embedded JSON
        html = await page.content()
        m2 = re.search(r'"edge_followed_by"\s*:\s*\{\s*"count"\s*:\s*(\d+)', html)
        if m2:
            return {"followers": int(m2.group(1))}
        # Detect login wall
        if "loginForm" in html or "accounts/login" in html:
            return {"error": "login wall (anonymous blocked)"}
        return {"error": "follower count not found in DOM"}
    except Exception as e:
        return {"error": f"{type(e).__name__}: {e}"}


# ---- Threads (Playwright) ---------------------------------------------
# Meta-owned, similar restrictions to IG. Best-effort scrape — meta tag first,
# then embedded JSON. Preserves previous value on failure (main loop handles).
async def fetch_threads(page, url):
    m = re.search(r"threads\.(?:net|com)/@?([^/?#]+)", url)
    if not m:
        return {"error": "could not parse Threads URL"}
    handle = m.group(1).lstrip("@")
    target = f"https://www.threads.net/@{handle}"
    try:
        await page.goto(target, wait_until="domcontentloaded", timeout=25000)
        await page.wait_for_timeout(3000)
        # og:description tipically reads: "X Followers, Y Threads"
        try:
            content = await page.locator('meta[property="og:description"]').first.get_attribute(
                "content", timeout=4000
            )
        except Exception:
            content = None
        if content:
            m2 = re.search(r"([\d.,KMB]+)\s+Followers?", content, re.IGNORECASE)
            if m2:
                n = parse_short(m2.group(1))
                if n:
                    return {"followers": n}
        # Fallback — embedded JSON
        html = await page.content()
        m2 = re.search(r'"follower_count"\s*:\s*(\d+)', html)
        if m2:
            return {"followers": int(m2.group(1))}
        if "loginForm" in html or "accounts/login" in html:
            return {"error": "login wall"}
        return {"error": "follower count not found"}
    except Exception as e:
        return {"error": f"{type(e).__name__}: {e}"}


# ---- X / Twitter (Playwright, best-effort) ----------------------------
# X is heavily anti-scraping — anonymous fetches usually redirect to login
# after a few hits. Included for completeness; expect frequent failures.
async def fetch_twitter(page, url):
    m = re.search(r"(?:twitter|x)\.com/([^/?#]+)", url)
    if not m:
        return {"error": "could not parse X URL"}
    handle = m.group(1).strip("/")
    target = f"https://x.com/{handle}"
    try:
        await page.goto(target, wait_until="domcontentloaded", timeout=25000)
        await page.wait_for_timeout(4000)
        html = await page.content()
        # Look for "X Followers" in profile area (rendered by JS)
        m2 = re.search(r'href="/[^"]+/followers"[^>]*>[^<]*<[^>]*>([\d.,KMB]+)\s*</span>', html)
        if m2:
            n = parse_short(m2.group(1))
            if n:
                return {"followers": n}
        # Fallback: scan og:description
        try:
            content = await page.locator('meta[property="og:description"]').first.get_attribute(
                "content", timeout=4000
            )
            if content:
                m2 = re.search(r"([\d.,KMB]+)\s+Followers?", content, re.IGNORECASE)
                if m2:
                    n = parse_short(m2.group(1))
                    if n:
                        return {"followers": n}
        except Exception:
            pass
        if "login" in html.lower() and "signup" in html.lower():
            return {"error": "X redirected to login wall (anonymous blocked)"}
        return {"error": "follower count not found in DOM"}
    except Exception as e:
        return {"error": f"{type(e).__name__}: {e}"}


# ---- TikTok (Playwright) ----------------------------------------------
async def fetch_tiktok(page, url):
    m = re.search(r"tiktok\.com/@?([^/?#]+)", url)
    if not m:
        return {"error": "could not parse TikTok URL"}
    handle = m.group(1).lstrip("@")
    target = f"https://www.tiktok.com/@{handle}"
    try:
        await page.goto(target, wait_until="domcontentloaded", timeout=25000)
        await page.wait_for_timeout(3500)
        # Prefer the official data-e2e selector
        try:
            txt = await page.locator('[data-e2e="followers-count"]').first.text_content(timeout=4000)
            if txt:
                n = parse_short(txt.strip())
                if n:
                    return {"followers": n}
        except Exception:
            pass
        # Fallback — scrape embedded JSON
        html = await page.content()
        m2 = re.search(r'"followerCount"\s*:\s*(\d+)', html)
        if m2:
            return {"followers": int(m2.group(1))}
        if "captcha" in html.lower() or "verify" in html.lower():
            return {"error": "captcha/verify wall"}
        return {"error": "follower count not found in DOM"}
    except Exception as e:
        return {"error": f"{type(e).__name__}: {e}"}


# ---- Main -------------------------------------------------------------
async def main():
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--dry-run", action="store_true", help="print results, don't write DB")
    parser.add_argument("--limit", type=int, default=None, help="only process first N rows")
    parser.add_argument("--kol", type=str, default=None, help="only refresh this exact KOL name")
    parser.add_argument("--headed", action="store_true", help="show browser window (debug)")
    args = parser.parse_args()

    if not SUPABASE_SERVICE_KEY:
        print("ERROR: SUPABASE_SERVICE_KEY missing. Set it in scripts/.env", file=sys.stderr)
        sys.exit(1)

    import httpx

    ts_start = datetime.now()
    print(f"== KOL refresh @ {ts_start.isoformat(timespec='seconds')} ==")
    print(f"   mode: {'DRY-RUN' if args.dry_run else 'WRITE'}")
    print(f"   per-profile delay: {PER_PROFILE_DELAY}s")

    headers = {
        "apikey": SUPABASE_SERVICE_KEY,
        "Authorization": f"Bearer {SUPABASE_SERVICE_KEY}",
    }
    rest = f"{SUPABASE_URL}/rest/v1/kol_database"

    async with httpx.AsyncClient(timeout=30) as client:
        params = {"select": "id,name,platforms,followers_by_platform"}
        if args.kol:
            params["name"] = f"eq.{args.kol}"
        r = await client.get(rest, headers=headers, params=params)
        r.raise_for_status()
        rows = r.json()
        if args.limit:
            rows = rows[: args.limit]
        print(f"   loaded {len(rows)} KOL row(s)\n")

        from playwright.async_api import async_playwright

        async with async_playwright() as pw:
            browser = await pw.chromium.launch(
                headless=not args.headed,
                args=[
                    "--disable-blink-features=AutomationControlled",
                    "--no-sandbox",
                ],
            )
            ctx = await browser.new_context(
                user_agent=(
                    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
                    "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
                ),
                viewport={"width": 1280, "height": 800},
                locale="en-US",
            )
            page = await ctx.new_page()

            ok_count = 0
            err_count = 0
            for i, row in enumerate(rows):
                name = row.get("name") or "?"
                platforms = row.get("platforms") or []
                prev_followers = row.get("followers_by_platform") or {}
                if not isinstance(platforms, list):
                    continue
                print(f"[{i+1}/{len(rows)}] {name}")
                followers = {}
                for p in platforms:
                    if not isinstance(p, dict):
                        continue
                    plat = (p.get("platform") or "").strip().lower()
                    purl = (p.get("url") or "").strip()
                    if not purl:
                        continue
                    if plat == "youtube":
                        res = await fetch_youtube(client, purl)
                    elif plat == "instagram":
                        res = await fetch_instagram(page, purl)
                    elif plat == "tiktok":
                        res = await fetch_tiktok(page, purl)
                    elif plat == "threads":
                        res = await fetch_threads(page, purl)
                    elif plat == "x" or plat == "twitter":
                        res = await fetch_twitter(page, purl)
                    else:
                        continue
                    if "followers" in res:
                        followers[plat] = res["followers"]
                        ok_count += 1
                        print(f"     {plat:10} → {res['followers']:>12,}")
                    else:
                        err_count += 1
                        # Preserve previous value if scrape failed
                        if plat in prev_followers and isinstance(prev_followers[plat], int):
                            followers[plat] = prev_followers[plat]
                        print(f"     {plat:10} → ERR: {res.get('error')}")
                    await asyncio.sleep(PER_PROFILE_DELAY)
                tier = compute_tier(followers)
                if not args.dry_run and followers:
                    payload = {
                        "followers_by_platform": followers,
                        "last_refreshed_at": datetime.now(timezone.utc).isoformat(),
                        "tier": tier,
                    }
                    uh = {**headers, "Content-Type": "application/json", "Prefer": "return=minimal"}
                    up = await client.patch(
                        rest,
                        headers=uh,
                        params={"id": f"eq.{row['id']}"},
                        json=payload,
                    )
                    if up.status_code >= 400:
                        print(f"     ⚠ DB write {up.status_code}: {up.text[:200]}")
                    else:
                        print(f"     ✓ saved (tier={tier})")
                else:
                    suffix = " — dry-run" if args.dry_run else " — nothing to save"
                    print(f"     · tier={tier}{suffix}")

            await browser.close()

    dur = (datetime.now() - ts_start).total_seconds()
    print(f"\nDone in {dur:.1f}s — ok={ok_count}, err={err_count}")


if __name__ == "__main__":
    asyncio.run(main())
