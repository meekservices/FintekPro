"""
FintekPro Quandl / Nasdaq Data Link data provider.

Provides reliable end-of-day settlement prices for commodity futures, precious
metals, energy, agricultural, industrial metals, FX futures, and bond futures
using the CHRIS (Wiki Continuous Futures) dataset — all available on the free tier.

Primary use: fallback when yfinance is rate-limited by Yahoo Finance on Railway.

Public API
----------
fetch_quandl_futures(symbols)  → dict[yf_symbol, quote_dict]
    Accepts a list of yfinance-style symbols (e.g. ["GC=F", "CL=F"]).
    Returns a dict keyed by the same symbols with price, change, etc.
    Only symbols with a known Quandl mapping are returned.
    Never raises — returns {} on complete failure.
"""

import logging
import os
from concurrent.futures import ThreadPoolExecutor, as_completed
from typing import Dict, List, Optional

logger = logging.getLogger(__name__)

# ── yfinance symbol → Quandl CHRIS dataset code ───────────────────────────────
# CHRIS = Wiki Continuous Futures (free tier, end-of-day settlement prices)
_QUANDL_MAP: Dict[str, str] = {
    # Precious metals (CME/COMEX)
    "GC=F":  "CHRIS/CME_GC1",
    "SI=F":  "CHRIS/CME_SI1",
    "PA=F":  "CHRIS/CME_PA1",
    "PL=F":  "CHRIS/CME_PL1",
    # Energy (CME/NYMEX + ICE)
    "CL=F":  "CHRIS/CME_CL1",
    "BZ=F":  "CHRIS/ICE_B1",
    "NG=F":  "CHRIS/CME_NG1",
    "HO=F":  "CHRIS/CME_HO1",
    # Industrial metals (CME/COMEX)
    "HG=F":  "CHRIS/CME_HG1",
    "ALI=F": "CHRIS/CME_AL1",
    # Agricultural (CBOT/ICE)
    "ZW=F":  "CHRIS/CME_W1",
    "ZC=F":  "CHRIS/CME_C1",
    "ZS=F":  "CHRIS/CME_S1",
    "CT=F":  "CHRIS/ICE_CT1",
    "KC=F":  "CHRIS/ICE_KC1",
    # US Treasury futures (CBOT)
    "ZN=F":  "CHRIS/CME_TY1",
    "ZB=F":  "CHRIS/CME_US1",
    "ZT=F":  "CHRIS/CME_TU1",
    # FX futures (CME)
    "6E=F":  "CHRIS/CME_EC1",
    "6J=F":  "CHRIS/CME_JY1",
    "6B=F":  "CHRIS/CME_BP1",
    "6A=F":  "CHRIS/CME_AD1",
    "6C=F":  "CHRIS/CME_CD1",
}

# Columns that CHRIS datasets use for the settlement/close price (first match wins)
_SETTLE_COLS  = ["Settle", "Settlement Price", "Last", "Close"]
# Columns for the daily change (first match wins)
_CHANGE_COLS  = ["Change", "Daily Change"]
# Columns for open interest
_OI_COLS      = ["Previous Day Open Interest", "Open Interest"]


def _configure() -> bool:
    """
    Apply QUANDL_API_KEY from env and return True if a key is available.
    Safe to call repeatedly — quandl caches the config.
    """
    try:
        import quandl  # type: ignore
        key = os.environ.get("QUANDL_API_KEY", "")
        if key:
            quandl.ApiConfig.api_key = key
        return True
    except ImportError:
        logger.warning("[Quandl] quandl package not installed")
        return False


def _col_val(df, candidates) -> Optional[float]:
    """Return the first matching column value from the last DataFrame row."""
    try:
        import pandas as pd  # type: ignore
        row = df.iloc[-1]
        for col in candidates:
            if col in df.columns:
                v = row[col]
                if v is not None and not (isinstance(v, float) and v != v):
                    return float(v)
    except Exception:
        pass
    return None


def _fetch_one(yf_sym: str, dataset: str) -> tuple:
    """
    Fetch the latest settlement price for a single futures contract.
    Returns (yf_sym, result_dict) or (yf_sym, None) on failure.
    """
    try:
        import quandl  # type: ignore
        # Fetch last 2 rows so we can compute change vs previous settle
        df = quandl.get(dataset, rows=2)
        if df is None or df.empty:
            return (yf_sym, None)

        settle  = _col_val(df, _SETTLE_COLS)
        if settle is None or settle <= 0:
            return (yf_sym, None)

        # Daily change: prefer the reported "Change" column, else compute from
        # previous row's settle if we have 2 rows
        change = _col_val(df, _CHANGE_COLS)
        prev_settle: Optional[float] = None
        if len(df) >= 2:
            try:
                prev_row = df.iloc[-2]
                for col in _SETTLE_COLS:
                    if col in df.columns:
                        v = prev_row[col]
                        if v is not None and not (isinstance(v, float) and v != v):
                            prev_settle = float(v)
                            break
            except Exception:
                pass

        if change is None and prev_settle is not None:
            change = round(settle - prev_settle, 6)

        chg_pct = None
        if change is not None and prev_settle and prev_settle > 0:
            chg_pct = round((change / prev_settle) * 100, 4)

        # Trade date from index
        trade_date: Optional[str] = None
        try:
            trade_date = str(df.index[-1].date())
        except Exception:
            pass

        return (yf_sym, {
            "symbol":        yf_sym,
            "price":         round(settle, 6),
            "previousClose": round(prev_settle, 6) if prev_settle else None,
            "change":        round(change, 6)       if change is not None else None,
            "changePercent": chg_pct,
            "dayHigh":       _col_val(df, ["High"]),
            "dayLow":        _col_val(df, ["Low"]),
            "volume":        _col_val(df, ["Volume"]),
            "openInterest":  _col_val(df, _OI_COLS),
            "tradeDate":     trade_date,
            "source":        "quandl_chris",
            "dataset":       dataset,
        })
    except Exception as e:
        logger.debug("[Quandl] %s (%s) failed: %s", yf_sym, dataset, e)
        return (yf_sym, None)


def fetch_quandl_futures(
    symbols: List[str],
    max_workers: int = 6,
) -> Dict[str, dict]:
    """
    Fetch latest settlement prices for a list of yfinance-style futures symbols.

    Only symbols present in _QUANDL_MAP are fetched; unknown symbols are silently
    skipped so callers can pass a mixed list without pre-filtering.

    Returns a dict keyed by yfinance symbol, e.g.:
        {
            "GC=F": {"price": 2350.4, "change": -3.2, ..., "source": "quandl_chris"},
            ...
        }
    """
    if not _configure():
        return {}

    to_fetch = [(sym, _QUANDL_MAP[sym]) for sym in symbols if sym in _QUANDL_MAP]
    if not to_fetch:
        return {}

    results: Dict[str, dict] = {}
    with ThreadPoolExecutor(max_workers=max_workers) as ex:
        futs = {ex.submit(_fetch_one, sym, ds): sym for sym, ds in to_fetch}
        for fut in as_completed(futs, timeout=30):
            try:
                sym, data = fut.result()
                if data:
                    results[sym] = data
            except Exception as e:
                logger.debug("[Quandl] worker error: %s", e)

    if results:
        logger.info("[Quandl] priced %d/%d futures symbols", len(results), len(to_fetch))
    else:
        logger.warning("[Quandl] no futures data returned for %s", [s for s, _ in to_fetch])

    return results


def is_futures_symbol(sym: str) -> bool:
    """Return True if this yfinance symbol has a known Quandl mapping."""
    return sym in _QUANDL_MAP
