#!/usr/bin/env python3
"""
Probe free public endpoints for KOL follower counts.

Usage:
  python3 scripts/test_kol_scraper.py URL [URL ...]

Examples:
  python3 scripts/test_kol_scraper.py \\
    https://www.instagram.com/zaynmalik/ \\
    https://www.tiktok.com/@charlidamelio \\
    https://www.youtube.com/@MrBeast

Zero deps — stdlib only. Prints follower count + any extra metrics if the
fetch succeeded, or the block reason if it didn't.
"""
import sys
import re
import json
import time
import urllib.parse
from urllib.request import Request, urlopen
from urllib.error import HTTPError, URLError

UA_DESKTOP = (
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
)
TIMEOUT = 20


def http_get(url, headers=None):
    h = {
        "User-Agent": UA_DESKTOP,
        "Accept-Language": "en-US,en;q=0.9",
        "Accept": "text/html,application/xhtml+xml,application/json,*/*",
    }
    if headers:
        h.update(headers)
    req = Request(url, headers=h)
    with urlopen(req, timeout=TIMEOUT) as r:
        return r.read().decode("utf-8", errors="replace")


def detect_platform(url):
    u = url.lower()
    if "instagram.com" in u:
        return "instagram"
    if "tiktok.com" in u:
        return "tiktok"
    if "youtube.com" in u or "youtu.be" in u:
        return "youtube"
    return None


def extract_handle(url, platform):
    p = urllib.parse.urlparse(url)
    parts = [x for x in p.path.split("/") if x]
    if platform == "instagram":
        # /USERNAME/ or /USERNAME
        return parts[0] if parts else None
    if platform == "tiktok":
        # /@username (?lang=...) — username may also be in query but typically path
        for x in parts:
            if x.startswith("@"):
                return x[1:]
        return parts[0] if parts else None
    if platform == "youtube":
        # /@handle, /c/name, /channel/UCxxx, /user/name
        if parts and parts[0].startswith("@"):
            return parts[0]  # keep the @
        if len(parts) >= 2 and parts[0] in ("c", "channel", "user"):
            return "/".join(parts[:2])
        return parts[0] if parts else None
    return None


# ---- Instagram ----------------------------------------------------------
def scrape_instagram(handle):
    url = f"https://i.instagram.com/api/v1/users/web_profile_info/?username={urllib.parse.quote(handle)}"
    headers = {
        # Public web app id used by instagram.com itself
        "x-ig-app-id": "936619743392459",
        "User-Agent": (
            "Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) "
            "AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Mobile/15E148 Safari/604.1"
        ),
        "Accept": "*/*",
    }
    body = http_get(url, headers)
    data = json.loads(body)
    user = data.get("data", {}).get("user")
    if not user:
        return {"error": "no user in response (login wall or username invalid)"}
    return {
        "followers": user.get("edge_followed_by", {}).get("count"),
        "following": user.get("edge_follow", {}).get("count"),
        "posts": user.get("edge_owner_to_timeline_media", {}).get("count"),
        "verified": user.get("is_verified"),
        "full_name": user.get("full_name"),
    }


# ---- TikTok -------------------------------------------------------------
def scrape_tiktok(handle):
    url = f"https://www.tiktok.com/@{urllib.parse.quote(handle)}"
    body = http_get(url)
    # Current payload (2024+)
    m = re.search(
        r'<script id="__UNIVERSAL_DATA_FOR_REHYDRATION__"[^>]*>(.*?)</script>',
        body,
        re.DOTALL,
    )
    if m:
        try:
            payload = json.loads(m.group(1))
            detail = payload.get("__DEFAULT_SCOPE__", {}).get("webapp.user-detail", {})
            stats = detail.get("userInfo", {}).get("stats", {})
            user = detail.get("userInfo", {}).get("user", {})
            if stats:
                return {
                    "followers": stats.get("followerCount"),
                    "following": stats.get("followingCount"),
                    "videos": stats.get("videoCount"),
                    "hearts": stats.get("heartCount"),
                    "verified": user.get("verified"),
                    "nickname": user.get("nickname"),
                }
        except Exception as e:
            return {"error": f"parse rehydration: {e}"}
    # Older payload fallback
    m = re.search(r'<script id="SIGI_STATE"[^>]*>(.*?)</script>', body, re.DOTALL)
    if m:
        try:
            payload = json.loads(m.group(1))
            users = payload.get("UserModule", {}).get("stats", {})
            for _k, v in users.items():
                return {
                    "followers": v.get("followerCount"),
                    "following": v.get("followingCount"),
                    "videos": v.get("videoCount"),
                }
        except Exception as e:
            return {"error": f"parse SIGI_STATE: {e}"}
    return {"error": "no JSON payload found (page blocked or layout changed)"}


# ---- YouTube ------------------------------------------------------------
def scrape_youtube(handle):
    # Caller may pass either '@handle', 'channel/UCxxx', 'c/foo', or bare name
    if not handle.startswith("@") and "/" not in handle:
        handle = "@" + handle
    url = f"https://www.youtube.com/{handle}"
    body = http_get(url)
    # Newer: "subscriberCountText":{"accessibility":{...},"simpleText":"1.23M subscribers"}
    m = re.search(
        r'"subscriberCountText"\s*:\s*\{[^}]*?"simpleText"\s*:\s*"([^"]+)"',
        body,
    )
    if m:
        return {"subscribers_text": m.group(1), "raw_form": "simpleText"}
    # Alt: "subscriberCountText":{"runs":[{"text":"123K subscribers"}]}
    m = re.search(
        r'"subscriberCountText"\s*:\s*\{[^}]*?"runs"\s*:\s*\[\s*\{\s*"text"\s*:\s*"([^"]+)"',
        body,
    )
    if m:
        return {"subscribers_text": m.group(1), "raw_form": "runs"}
    # Some channels hide subscriber count entirely; try metadata for channel name still
    m = re.search(r'"channelMetadataRenderer"\s*:\s*\{[^}]*?"title"\s*:\s*"([^"]+)"', body)
    title = m.group(1) if m else None
    return {
        "error": f"subscriberCountText not found (channel may hide count or page layout changed){' [title='+title+']' if title else ''}"
    }


SCRAPERS = {
    "instagram": scrape_instagram,
    "tiktok": scrape_tiktok,
    "youtube": scrape_youtube,
}


def main(argv):
    if len(argv) < 2:
        print(__doc__)
        return 1
    print(f"Probing {len(argv)-1} URL(s) with 2s pause between each...\n")
    for url in argv[1:]:
        platform = detect_platform(url)
        tag = platform[:2].upper() if platform else "??"
        if not platform:
            print(f"[{tag}] {url} → unknown platform")
            continue
        handle = extract_handle(url, platform)
        if not handle:
            print(f"[{tag}] {url} → could not extract handle")
            continue
        label = handle.ljust(28)
        try:
            result = SCRAPERS[platform](handle)
        except HTTPError as e:
            reason = "login wall" if e.code in (401, 403) else "rate-limited" if e.code == 429 else str(e.reason)
            print(f"[{tag}] {label} → HTTP {e.code} ({reason})")
            time.sleep(2)
            continue
        except URLError as e:
            print(f"[{tag}] {label} → network: {e.reason}")
            time.sleep(2)
            continue
        except Exception as e:
            print(f"[{tag}] {label} → error: {type(e).__name__}: {e}")
            time.sleep(2)
            continue
        if "error" in result:
            print(f"[{tag}] {label} → {result['error']}")
        elif platform == "youtube":
            print(f"[{tag}] {label} → {result.get('subscribers_text')} subs")
        else:
            f = result.get("followers")
            fmt = f"{f:,}" if isinstance(f, int) else "n/a"
            extra = []
            if isinstance(result.get("following"), int):
                extra.append(f"following={result['following']:,}")
            if isinstance(result.get("posts"), int):
                extra.append(f"posts={result['posts']}")
            if isinstance(result.get("videos"), int):
                extra.append(f"videos={result['videos']}")
            if result.get("verified"):
                extra.append("✓verified")
            if result.get("full_name"):
                extra.append(f"({result['full_name']})")
            elif result.get("nickname"):
                extra.append(f"({result['nickname']})")
            tail = " · " + " · ".join(extra) if extra else ""
            print(f"[{tag}] {label} → {fmt} followers{tail}")
        time.sleep(2)
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv))
