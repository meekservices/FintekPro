"""
Derivatives data routes for FintekPro Python Analytics Service.

Covers:
  GET  /derivatives/global-futures  — 20+ global futures via yfinance (equity indices,
                                      commodities, bonds, FX, volatility, agricultural)
  POST /derivatives/nse-spot        — Real spot prices for NSE indices + equities via yfinance
"""

import asyncio
import time
from concurrent.futures import ThreadPoolExecutor
from typing import Any, Dict, Optional

import yfinance as yf
from fastapi import APIRouter

router = APIRouter()

# ── Global futures universe ────────────────────────────────────────────────────
GLOBAL_FUTURES: Dict[str, Dict[str, str]] = {
    # US equity index futures (CME E-mini)
    "ES=F":  {"name": "S&P 500 E-mini",      "category": "equity_index", "market": "US"},
    "NQ=F":  {"name": "Nasdaq 100 E-mini",   "category": "equity_index", "market": "US"},
    "YM=F":  {"name": "Dow Jones E-mini",    "category": "equity_index", "market": "US"},
    "RTY=F": {"name": "Russell 2000 E-mini", "category": "equity_index", "market": "US"},
    # Asia-Pacific index futures
    "NIY=F": {"name": "Nikkei 225 (USD)",    "category": "equity_index", "market": "Japan"},
    "HSI=F": {"name": "Hang Seng Index",     "category": "equity_index", "market": "HK"},
    # Energy futures
    "CL=F":  {"name": "WTI Crude Oil",       "category": "energy",       "market": "Global"},
    "BZ=F":  {"name": "Brent Crude",         "category": "energy",       "market": "Global"},
    "NG=F":  {"name": "Natural Gas",         "category": "energy",       "market": "Global"},
    "HO=F":  {"name": "Heating Oil",         "category": "energy",       "market": "Global"},
    # Precious metals
    "GC=F":  {"name": "Gold",                "category": "precious_metal", "market": "Global"},
    "SI=F":  {"name": "Silver",              "category": "precious_metal", "market": "Global"},
    "PL=F":  {"name": "Platinum",            "category": "precious_metal", "market": "Global"},
    "PA=F":  {"name": "Palladium",           "category": "precious_metal", "market": "Global"},
    # Industrial metals
    "HG=F":  {"name": "Copper",              "category": "industrial_metal", "market": "Global"},
    "ALI=F": {"name": "Aluminium",           "category": "industrial_metal", "market": "Global"},
    # Fixed income futures (CBOT)
    "ZN=F":  {"name": "10-Year Treasury Note","category": "bond",        "market": "US"},
    "ZB=F":  {"name": "30-Year Treasury Bond","category": "bond",        "market": "US"},
    "ZT=F":  {"name": "2-Year Treasury Note", "category": "bond",        "market": "US"},
    # FX futures (CME)
    "6E=F":  {"name": "EUR/USD Futures",     "category": "currency",     "market": "FX"},
    "6J=F":  {"name": "JPY/USD Futures",     "category": "currency",     "market": "FX"},
    "6B=F":  {"name": "GBP/USD Futures",     "category": "currency",     "market": "FX"},
    "6A=F":  {"name": "AUD/USD Futures",     "category": "currency",     "market": "FX"},
    "6C=F":  {"name": "CAD/USD Futures",     "category": "currency",     "market": "FX"},
    # Agricultural (CBOT)
    "ZW=F":  {"name": "Wheat",               "category": "agricultural", "market": "Global"},
    "ZC=F":  {"name": "Corn",                "category": "agricultural", "market": "Global"},
    "ZS=F":  {"name": "Soybean",             "category": "agricultural", "market": "Global"},
    "KC=F":  {"name": "Coffee",              "category": "agricultural", "market": "Global"},
    "CT=F":  {"name": "Cotton",              "category": "agricultural", "market": "Global"},
    # Volatility
    "VIX=F": {"name": "VIX Futures",         "category": "volatility",   "market": "US"},
}

# NSE/BSE symbol → yfinance ticker
NSE_SYMBOL_MAP: Dict[str, str] = {
    "NIFTY":       "^NSEI",
    "NIFTY50":     "^NSEI",
    "BANKNIFTY":   "^NSEBANK",
    "FINNIFTY":    "NIFTY_FIN_SERVICE.NS",
    "MIDCPNIFTY":  "^NIFTY_MIDCAP_150",
    "SENSEX":      "^BSESN",
}


def _fetch_futures_quote(symbol: str) -> Optional[Dict[str, Any]]:
    """Fetch a single futures quote via yfinance fast_info (< 1s)."""
    try:
        info = yf.Ticker(symbol).fast_info
        price = float(info.last_price or 0)
        if price <= 0:
            return None
        prev = float(info.previous_close or 0)
        chg = price - prev if prev else None
        chg_pct = (chg / prev * 100) if prev and prev > 0 else None
        return {
            "price":         round(price, 4),
            "previousClose": round(prev, 4)   if prev    else None,
            "change":        round(chg, 4)    if chg is not None  else None,
            "changePercent": round(chg_pct, 4) if chg_pct is not None else None,
            "dayHigh":       round(float(info.day_high), 4) if info.day_high else None,
            "dayLow":        round(float(info.day_low),  4) if info.day_low  else None,
        }
    except Exception:
        return None


def _fetch_nse_spot(internal: str) -> Optional[Dict[str, Any]]:
    """Fetch NSE/BSE spot price via yfinance."""
    yf_sym = NSE_SYMBOL_MAP.get(internal.upper(), internal.upper() + ".NS")
    try:
        info = yf.Ticker(yf_sym).fast_info
        price = float(info.last_price or 0)
        if price <= 0:
            return None
        prev = float(info.previous_close or 0)
        chg = price - prev if prev else None
        chg_pct = (chg / prev * 100) if prev and prev > 0 else None
        return {
            "price":         round(price, 2),
            "previousClose": round(prev, 2)    if prev    else None,
            "change":        round(chg, 2)     if chg is not None else None,
            "changePercent": round(chg_pct, 4) if chg_pct is not None else None,
            "yfinanceSymbol": yf_sym,
        }
    except Exception:
        return None


# ── Endpoints ─────────────────────────────────────────────────────────────────

@router.get("/derivatives/global-futures")
async def get_global_futures():
    """
    Returns live quotes for ~30 global futures across equity indices, commodities,
    bonds, FX, and agricultural markets.  Uses yfinance fast_info in parallel threads.
    """
    symbols = list(GLOBAL_FUTURES.keys())
    loop = asyncio.get_event_loop()

    with ThreadPoolExecutor(max_workers=12) as ex:
        tasks = [loop.run_in_executor(ex, _fetch_futures_quote, s) for s in symbols]
        raw = await asyncio.gather(*tasks, return_exceptions=True)

    output = []
    failed = []
    for sym, result in zip(symbols, raw):
        if isinstance(result, Exception) or result is None:
            failed.append(sym)
            continue
        meta = GLOBAL_FUTURES[sym]
        output.append({"symbol": sym, **meta, **result})

    return {
        "futures":   output,
        "count":     len(output),
        "failed":    failed,
        "timestamp": time.time(),
    }


@router.post("/derivatives/nse-spot")
async def get_nse_spot(payload: dict):
    """
    Returns real-time spot prices for NSE indices (NIFTY, BANKNIFTY, FINNIFTY …)
    and individual NSE/BSE equities (RELIANCE, TCS …) via yfinance.

    Body: { "symbols": ["NIFTY", "BANKNIFTY", "RELIANCE"] }
    """
    symbols: list = payload.get("symbols", [])
    if not symbols:
        return {"results": {}}

    results: Dict[str, Any] = {}
    loop = asyncio.get_event_loop()

    def fetch_one(sym: str):
        return sym, _fetch_nse_spot(sym)

    with ThreadPoolExecutor(max_workers=8) as ex:
        tasks = [loop.run_in_executor(ex, fetch_one, s) for s in symbols]
        pairs = await asyncio.gather(*tasks, return_exceptions=True)

    for item in pairs:
        if isinstance(item, Exception):
            continue
        sym, data = item
        if data:
            results[sym] = data

    return {"results": results}
