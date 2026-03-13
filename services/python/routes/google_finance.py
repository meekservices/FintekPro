"""
Google Finance data provider for FintekPro.
Provides price quotes and key metrics for Indian stocks (NSE/BSE) via
Google Finance HTML parsing and the legacy JSONP info endpoint.

Strategy waterfall (tried in order):
  1. finance.google.com/finance/info  — legacy JSONP (fast, sometimes works)
  2. www.google.com/finance/quote     — HTML parsing with embedded JSON blob
  3. Structured-data / og:description fallback

Provides:
  fetch_gf_quote(symbol, exchange)   → {price, change, changePercent, ...}
  fetch_gf_metrics(symbol, exchange) → {pe, pb, marketCap, high52w, low52w, ...}
  fetch_gf_peer_batch(symbols)       → {SYMBOL: {pe, pb, roe, price, ...}, ...}
"""

import json
import logging
import re
import time
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
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
})

_TIMEOUT = 12
_JSONP_TIMEOUT = 6


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


# ─── Strategy 1: Legacy JSONP endpoint ────────────────────────────────────────

def _try_jsonp(symbol: str, exchange: str) -> Optional[dict]:
    """
    finance.google.com/finance/info?client=ig&q=NSE:RELIANCE
    Returns JSONP like:  // [{"id":"...", "t":"RELIANCE","l_fix":"2850.00","c_fix":"25.00","cp":"0.88",...}]
    """
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


# ─── Strategy 2: HTML page parsing ────────────────────────────────────────────

_GF_JSON_PATTERNS = [
    # JSON blob embedded in data- attributes or script vars
    r'"PRICE":\[\d+,(\d[\d,]*(?:\.\d+)?)',
    r'"LAST_PRICE":\[\d+,(\d[\d,]*(?:\.\d+)?)',
    r'"c\\?":\s*"(\d[\d,]*(?:\.\d+)?)"',   # some variants
]

_GF_PE_PATTERNS = [
    r'"PE_RATIO":\[\d+,(\d[\d,]*(?:\.\d+)?)',
    r'"PRICE_EARNINGS_RATIO":\[\d+,(\d[\d,]*(?:\.\d+)?)',
    r'P/E ratio[^<]*<[^>]+>([0-9]+\.?[0-9]*)',
]

_GF_PB_PATTERNS = [
    r'"PRICE_TO_BOOK":\[\d+,(\d[\d,]*(?:\.\d+)?)',
    r'"PB_RATIO":\[\d+,(\d[\d,]*(?:\.\d+)?)',
    r'Price/Book[^<]*<[^>]+>([0-9]+\.?[0-9]*)',
]

_GF_MKTCAP_PATTERNS = [
    r'"MARKET_CAP":\[\d+,(\d[\d,]*(?:\.\d+)?)',
    r'"MKTCAP":\[\d+,(\d[\d,]*(?:\.\d+)?)',
    r'Market cap[^<]*<[^>]+>([₹0-9,\.T L Cr]+)',
]

_GF_HIGH52_PATTERNS = [
    r'"HIGH_52_WEEKS":\[\d+,(\d[\d,]*(?:\.\d+)?)',
    r'52-wk high[^<]*<[^>]+>([0-9,]+\.?[0-9]*)',
]

_GF_LOW52_PATTERNS = [
    r'"LOW_52_WEEKS":\[\d+,(\d[\d,]*(?:\.\d+)?)',
    r'52-wk low[^<]*<[^>]+>([0-9,]+\.?[0-9]*)',
]

_GF_DIVYIELD_PATTERNS = [
    r'"DIVIDEND_YIELD":\[\d+,(\d[\d,]*(?:\.\d+)?)',
    r'Div yield[^<]*<[^>]+>([0-9]+\.?[0-9]*)',
]

_GF_EPS_PATTERNS = [
    r'"EPS":\[\d+,(-?\d[\d,]*(?:\.\d+)?)',
    r'"EARNINGS_PER_SHARE":\[\d+,(-?\d[\d,]*(?:\.\d+)?)',
    r'EPS[^<]*<[^>]+>([0-9]+\.?[0-9]*)',
]


def _extract_first(html: str, patterns: List[str]) -> Optional[float]:
    for pat in patterns:
        m = re.search(pat, html)
        if m:
            raw = m.group(1).replace(",", "")
            val = _safe_float(raw)
            if val is not None and val > 0:
                return val
    return None


def _fetch_gf_html(symbol: str, exchange: str) -> Optional[str]:
    url = f"https://www.google.com/finance/quote/{symbol}:{exchange}"
    try:
        resp = _SESSION.get(url, timeout=_TIMEOUT)
        if resp.ok:
            return resp.text
    except Exception as e:
        logger.debug(f"[GoogleFinance] HTML fetch failed for {exchange}:{symbol}: {e}")
    return None


def _parse_price_from_html(html: str) -> Optional[float]:
    return _extract_first(html, _GF_JSON_PATTERNS)


def _parse_change_from_html(html: str):
    patterns = [
        r'"CHANGE":\[\d+,(-?\d[\d,]*(?:\.\d+)?)',
        r'"DAY_CHANGE":\[\d+,(-?\d[\d,]*(?:\.\d+)?)',
    ]
    for pat in patterns:
        m = re.search(pat, html)
        if m:
            raw = m.group(1).replace(",", "")
            val = _safe_float(raw)
            if val is not None:
                return val
    return None


def _parse_change_pct_from_html(html: str):
    patterns = [
        r'"CHANGE_PERCENT":\[\d+,(-?\d[\d,]*(?:\.\d+)?)',
        r'"DAY_CHANGE_PERCENT":\[\d+,(-?\d[\d,]*(?:\.\d+)?)',
    ]
    for pat in patterns:
        m = re.search(pat, html)
        if m:
            raw = m.group(1).replace(",", "")
            val = _safe_float(raw)
            if val is not None:
                return val
    return None


# ─── Public API ───────────────────────────────────────────────────────────────

def fetch_gf_quote(symbol: str, exchange: str = "NSE") -> Optional[dict]:
    """
    Fetch live price quote for a stock from Google Finance.
    Returns: {symbol, price, change, changePercent, previousClose, source}
    """
    result = _try_jsonp(symbol, exchange)
    if result and result.get("price"):
        return result

    if exchange == "NSE" and not result:
        result = _try_jsonp(symbol, "BOM")

    html = _fetch_gf_html(symbol, exchange)
    if not html:
        if exchange == "NSE":
            html = _fetch_gf_html(symbol, "BOM")

    if html:
        price = _parse_price_from_html(html)
        if price:
            return {
                "symbol": symbol,
                "price": price,
                "change": _parse_change_from_html(html),
                "changePercent": _parse_change_pct_from_html(html),
                "source": "google_finance_html",
            }

    return None


def fetch_gf_metrics(symbol: str, exchange: str = "NSE") -> Optional[dict]:
    """
    Fetch key metrics (PE, PB, market cap, 52w range, dividend yield, EPS)
    from Google Finance HTML.
    Returns: {pe, pb, marketCap, high52w, low52w, dividendYield, eps, source}
    """
    html = _fetch_gf_html(symbol, exchange)
    if not html:
        if exchange == "NSE":
            html = _fetch_gf_html(symbol, "BOM")
        if not html:
            return None

    pe = _extract_first(html, _GF_PE_PATTERNS)
    pb = _extract_first(html, _GF_PB_PATTERNS)
    high52 = _extract_first(html, _GF_HIGH52_PATTERNS)
    low52 = _extract_first(html, _GF_LOW52_PATTERNS)
    div_yield = _extract_first(html, _GF_DIVYIELD_PATTERNS)
    eps = _extract_first(html, _GF_EPS_PATTERNS)

    mktcap_raw = None
    for pat in _GF_MKTCAP_PATTERNS:
        m = re.search(pat, html)
        if m:
            mktcap_raw = _safe_float(m.group(1).replace(",", "").replace("₹", "").strip())
            if mktcap_raw:
                break

    if not any([pe, pb, high52, low52, div_yield]):
        logger.debug(f"[GoogleFinance] No metrics extracted from HTML for {symbol}:{exchange}")
        return None

    return {
        "pe": pe,
        "pb": pb,
        "marketCap": mktcap_raw,
        "high52w": high52,
        "low52w": low52,
        "dividendYield": div_yield,
        "eps": eps,
        "source": "google_finance",
    }


def fetch_gf_peer_batch(symbols: List[str], exchange: str = "NSE") -> Dict[str, dict]:
    """
    Fetch basic metrics for a batch of symbols for peer comparison.
    Retrieves PE, PB, dividend yield, price, EPS via Google Finance.
    Returns {SYMBOL: {pe, pb, dividendYield, eps, price, ...}}
    """
    results = {}
    for sym in symbols:
        try:
            html = _fetch_gf_html(sym, exchange)
            if not html and exchange == "NSE":
                html = _fetch_gf_html(sym, "BOM")
            if not html:
                continue

            price = _parse_price_from_html(html)
            pe = _extract_first(html, _GF_PE_PATTERNS)
            pb = _extract_first(html, _GF_PB_PATTERNS)
            div = _extract_first(html, _GF_DIVYIELD_PATTERNS)
            eps = _extract_first(html, _GF_EPS_PATTERNS)

            if any(v is not None for v in [price, pe, pb]):
                results[sym] = {
                    "price": price,
                    "pe": pe,
                    "pb": pb,
                    "dividendYield": div,
                    "eps": eps,
                    "source": "google_finance",
                }
            time.sleep(0.5)
        except Exception as e:
            logger.debug(f"[GoogleFinance] peer batch skip {sym}: {e}")

    return results
