"""
Google Finance data provider for FintekPro.
Fetches live price, PE ratio, market cap and key metrics for Indian stocks
using headless Chromium to fully render the JS-heavy Google Finance page.

Strategy waterfall (tried in order):
  1. Headless Chromium --dump-dom  — renders the full page; parses data-last-price
                                     and class="P6K39c" stat values  (PRIMARY)
  2. finance.google.com/finance/info JSONP — legacy endpoint; sometimes alive   (FALLBACK)

Provides:
  fetch_gf_quote(symbol, exchange)   → {price, pe, marketCap, timestamp, ...}
  fetch_gf_metrics(symbol, exchange) → {pe, marketCap, eps, dividendYield, ...}
  fetch_gf_peer_batch(symbols)       → {SYMBOL: {...}, ...}
"""

import json
import logging
import re
import shutil
import subprocess
import time
from functools import lru_cache
from typing import Dict, List, Optional

import requests

logger = logging.getLogger(__name__)

_SESSION = requests.Session()
_SESSION.headers.update({
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/124.0.0.0 Safari/537.36"
    ),
    "Accept-Language": "en-IN,en;q=0.9",
})

_CHROMIUM_TIMEOUT = 20
_JSONP_TIMEOUT = 6


# ─── Chromium path resolution ─────────────────────────────────────────────────

def _chromium_binary() -> Optional[str]:
    for name in ("chromium", "chromium-browser", "google-chrome"):
        path = shutil.which(name)
        if path:
            return path
    return None

_CHROMIUM = _chromium_binary()


def _safe_float(v) -> Optional[float]:
    try:
        if v is None:
            return None
        s = str(v).replace(",", "").replace("₹", "").replace("%", "").strip()
        if s in ("", "-", "N/A", "NaN", "None"):
            return None
        return float(s)
    except Exception:
        return None


def _parse_market_cap(raw: str) -> Optional[float]:
    """
    Convert Google Finance market cap strings to raw float (INR).
    Examples: '18.75T INR' → 18.75e12, '2.5L Cr' → 2.5e12, '85,000 Cr' → 8.5e11
    """
    if not raw:
        return None
    s = raw.upper().replace(",", "").replace("INR", "").replace("₹", "").strip()
    m = re.match(r"([\d.]+)\s*([TBMKL]?)\s*(?:CR)?", s)
    if not m:
        return None
    num = float(m.group(1))
    suffix = m.group(2)
    if suffix == "T":
        return num * 1e12
    if suffix == "B":
        return num * 1e9
    if suffix == "M":
        return num * 1e6
    if suffix == "K":
        return num * 1e3
    # bare Cr
    if "CR" in s:
        return num * 1e7
    return num


# ─── Strategy 1: Headless Chromium ───────────────────────────────────────────

_SAFE_TICKER = re.compile(r"^[A-Z0-9.\-&]{1,30}$")


def _chromium_dump_dom(symbol: str, exchange: str) -> Optional[str]:
    """
    Run Chromium in headless mode to fully render the Google Finance page
    and return the DOM as a string.
    """
    if not _CHROMIUM:
        return None
    if not _SAFE_TICKER.match(symbol.upper()) or not _SAFE_TICKER.match(exchange.upper()):
        logger.warning("[GoogleFinance] Rejected unsafe symbol/exchange: %r / %r", symbol, exchange)
        return None
    url = f"https://www.google.com/finance/quote/{symbol}:{exchange}"
    try:
        result = subprocess.run(
            [
                _CHROMIUM,
                "--headless=new",
                "--no-sandbox",
                "--disable-gpu",
                "--disable-dev-shm-usage",
                "--disable-extensions",
                "--disable-background-networking",
                "--dump-dom",
                url,
            ],
            capture_output=True,
            text=True,
            timeout=_CHROMIUM_TIMEOUT,
        )
        html = result.stdout
        if len(html) < 10000:
            return None
        return html
    except subprocess.TimeoutExpired:
        logger.warning(f"[GoogleFinance] Chromium timeout for {exchange}:{symbol}")
        return None
    except Exception as e:
        logger.debug(f"[GoogleFinance] Chromium error for {exchange}:{symbol}: {e}")
        return None


def _parse_chromium_html(html: str, symbol: str) -> Optional[dict]:
    """
    Parse the fully-rendered Google Finance HTML.
    Extracts price from data-last-price, stats from class="P6K39c".
    """
    if not html:
        return None

    price_m = re.search(r'data-last-price="([\d.]+)"', html)
    ts_m = re.search(r'data-last-normal-market-timestamp="(\d+)"', html)
    if not price_m:
        return None

    price = _safe_float(price_m.group(1))
    if not price:
        return None

    timestamp = int(ts_m.group(1)) if ts_m else None

    def _stat_after(label: str) -> Optional[str]:
        pos = html.find(label)
        if pos < 0:
            return None
        snip = html[pos:pos + 500]
        m = re.search(r'class="P6K39c">([^<]+)</div>', snip)
        return m.group(1).strip() if m else None

    pe_raw = _stat_after("P/E ratio")
    mktcap_raw = _stat_after("Market cap")
    div_raw = _stat_after("Div yield")
    prev_close_raw = _stat_after("Prev close")

    pe = _safe_float(pe_raw)
    market_cap = _parse_market_cap(mktcap_raw) if mktcap_raw else None
    div_yield_pct = div_raw.replace("%", "").strip() if div_raw else None
    div_yield = _safe_float(div_yield_pct)
    prev_close = _safe_float(prev_close_raw)

    # Derive EPS from price/PE to avoid false match with P/E tooltip text
    eps = round(price / pe, 2) if pe and pe > 0 else None

    return {
        "symbol": symbol,
        "price": price,
        "previousClose": prev_close,
        "change": round(price - prev_close, 2) if prev_close else None,
        "changePercent": round((price - prev_close) / prev_close * 100, 4) if prev_close else None,
        "pe": pe,
        "eps": eps,
        "marketCap": market_cap,
        "dividendYield": div_yield,
        "timestamp": timestamp,
        "source": "google_finance_chromium",
    }


# ─── Strategy 2: Legacy JSONP endpoint ───────────────────────────────────────

def _try_jsonp(symbol: str, exchange: str) -> Optional[dict]:
    url = f"https://finance.google.com/finance/info?client=ig&q={exchange}:{symbol}"
    try:
        resp = _SESSION.get(url, timeout=_JSONP_TIMEOUT)
        if not resp.ok:
            return None
        text = resp.text.strip()
        if text.startswith("//"):
            text = text[2:].strip()
        data = json.loads(text)
        if not isinstance(data, list) or not data:
            return None
        item = data[0]
        price = _safe_float(item.get("l_fix") or item.get("l"))
        if not price:
            return None
        return {
            "symbol": symbol,
            "price": price,
            "change": _safe_float(item.get("c_fix") or item.get("c")),
            "changePercent": _safe_float(item.get("cp_fix") or item.get("cp")),
            "previousClose": _safe_float(item.get("pcls_fix")),
            "source": "google_finance_jsonp",
        }
    except Exception as e:
        logger.debug(f"[GoogleFinance] JSONP failed for {exchange}:{symbol}: {e}")
        return None


# ─── Public API ───────────────────────────────────────────────────────────────

def fetch_gf_quote(symbol: str, exchange: str = "NSE") -> Optional[dict]:
    """
    Fetch live price quote from Google Finance.
    Returns: {symbol, price, change, changePercent, previousClose, pe, marketCap, source}
    """
    html = _chromium_dump_dom(symbol, exchange)
    if html:
        result = _parse_chromium_html(html, symbol)
        if result and result.get("price"):
            return result

    if exchange == "NSE" and not html:
        html = _chromium_dump_dom(symbol, "BOM")
        if html:
            result = _parse_chromium_html(html, symbol)
            if result and result.get("price"):
                return result

    jsonp = _try_jsonp(symbol, exchange)
    if jsonp and jsonp.get("price"):
        return jsonp

    if exchange == "NSE":
        return _try_jsonp(symbol, "BOM")

    return None


def fetch_gf_metrics(symbol: str, exchange: str = "NSE") -> Optional[dict]:
    """
    Fetch key metrics: PE, market cap, EPS, dividend yield.
    Returns: {pe, marketCap, eps, dividendYield, source}
    """
    result = fetch_gf_quote(symbol, exchange)
    if not result:
        return None

    has_metrics = any(result.get(k) for k in ("pe", "marketCap", "eps", "dividendYield"))
    if not has_metrics:
        return None

    return {
        "pe": result.get("pe"),
        "pb": None,
        "marketCap": result.get("marketCap"),
        "eps": result.get("eps"),
        "dividendYield": result.get("dividendYield"),
        "high52w": None,
        "low52w": None,
        "source": result.get("source", "google_finance"),
    }


def fetch_gf_peer_batch(symbols: List[str], exchange: str = "NSE") -> Dict[str, dict]:
    """
    Fetch metrics for a batch of symbols for peer comparison.
    Capped at 5 symbols to keep Chromium usage reasonable.
    """
    results = {}
    for sym in symbols[:5]:
        try:
            data = fetch_gf_quote(sym, exchange)
            if data and data.get("price"):
                results[sym] = data
            time.sleep(1.0)
        except Exception as e:
            logger.debug(f"[GoogleFinance] peer batch skip {sym}: {e}")
    return results
