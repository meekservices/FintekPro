"""
FintekPro Python Market Data Routes — powered by yfinance

Endpoints:
  POST /market/quotes          — batch price quotes for global stocks & ETFs
  POST /market/fundamentals    — Indian/global stock fundamentals + derived ratios + historical tables
  POST /market/peer-enrich     — lightweight peer enrichment (PE, PB, ROE) for a batch of symbols
  GET  /market/movers/indian   — NIFTY50 top gainers & losers
  GET  /market/health          — provider health check

Indian stock yfinance row name notes:
  yfinance uses inconsistent row names for Indian (GAAP) vs US (US-GAAP) stocks.
  All row-name lookups use ordered candidate lists (first match wins) so we handle both.
"""

import asyncio
import logging
from concurrent.futures import ThreadPoolExecutor
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from auth import TokenPayload, verify_token

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/market", tags=["market-data"])

_executor = ThreadPoolExecutor(max_workers=6)

NIFTY50_SYMBOLS = [
    "RELIANCE.NS", "TCS.NS", "HDFCBANK.NS", "INFY.NS", "ICICIBANK.NS",
    "HINDUNILVR.NS", "SBIN.NS", "BAJFINANCE.NS", "BHARTIARTL.NS", "KOTAKBANK.NS",
    "LT.NS", "AXISBANK.NS", "ASIANPAINT.NS", "MARUTI.NS", "NESTLEIND.NS",
    "WIPRO.NS", "ULTRACEMCO.NS", "HCLTECH.NS", "POWERGRID.NS", "NTPC.NS",
    "TITAN.NS", "SUNPHARMA.NS", "ONGC.NS", "GRASIM.NS", "JSWSTEEL.NS",
    "TATAMOTORS.NS", "INDUSINDBK.NS", "TECHM.NS", "CIPLA.NS", "ADANIENT.NS",
    "ADANIPORTS.NS", "COALINDIA.NS", "DIVISLAB.NS", "DRREDDY.NS", "EICHERMOT.NS",
    "HEROMOTOCO.NS", "HINDALCO.NS", "M&M.NS", "SHREECEM.NS",
    "TATACONSUM.NS", "TATASTEEL.NS", "UPL.NS", "VEDL.NS", "BAJAJFINSV.NS",
    "BPCL.NS", "BRITANNIA.NS", "DABUR.NS", "GODREJCP.NS", "PIDILITIND.NS",
]

# ── yfinance row-name candidates (first match wins) ───────────────────────────
# These handle both US-GAAP and Indian-GAAP labels that yfinance uses

_REVENUE_ROWS    = ["Total Revenue", "Operating Revenue", "Revenue", "Net Revenue"]
_OP_INCOME_ROWS  = ["Operating Income", "EBIT", "Ebit",
                    "Net Operating Income", "Income From Operations"]
_NET_INCOME_ROWS = [
    "Net Income",
    "Net Income Common Stockholders",
    "Net Income From Continuing Operation Net Minority Interest",
    "Net Income From Continuing And Discontinued Operation",
    "Normalized Income",
]
_INTEREST_ROWS   = ["Interest Expense", "Interest Expense Non Operating",
                    "Net Interest Income"]
_DEPR_ROWS       = ["Reconciled Depreciation", "Depreciation And Amortization",
                    "Depreciation", "Depreciation Amortization Depletion",
                    "Depreciation Depletion And Amortization"]
_EPS_ROWS        = ["Basic EPS", "Diluted EPS", "Earnings Per Share"]
_GROSS_PROFIT    = ["Gross Profit"]
_EBITDA_ROWS     = ["EBITDA", "Normalized EBITDA"]

_EQUITY_ROWS     = ["Common Stock", "Capital Stock", "Share Capital",
                    "Common Stock Equity", "Stockholders Equity"]
_RESERVES_ROWS   = ["Retained Earnings", "Additional Paid In Capital",
                    "Gains Losses Not Affecting Retained Earnings"]
_DEBT_ROWS       = ["Total Debt", "Long Term Debt And Capital Lease Obligation",
                    "Long Term Debt", "Net Debt"]
_SHORT_DEBT      = ["Current Debt And Capital Lease Obligation",
                    "Current Debt", "Short Term Debt"]
_PPE_ROWS        = ["Net PPE", "Property Plant Equipment Net",
                    "Net Property Plant And Equipment"]
_TOTAL_ASSET_ROWS = ["Total Assets"]
_CURR_ASSET_ROWS  = ["Current Assets"]
_CURR_LIAB_ROWS   = ["Current Liabilities"]
_RECV_ROWS        = ["Accounts Receivable", "Net Receivables", "Receivables"]
_INVENT_ROWS      = ["Inventory", "Inventories"]
_AP_ROWS          = ["Accounts Payable", "Payables"]
_GP_ROWS          = ["Gross Profit"]


class QuotesRequest(BaseModel):
    symbols: List[str]


class FundamentalsRequest(BaseModel):
    symbol: str


class PeerEnrichRequest(BaseModel):
    symbols: List[str]   # bare NSE symbols e.g. ["BEML", "TIL"]


# ─── helper functions ─────────────────────────────────────────────────────────

def _safe_float(v) -> Optional[float]:
    if v is None:
        return None
    try:
        f = float(v)
        return f if f == f else None  # NaN guard
    except (TypeError, ValueError):
        return None


def _to_crore(v) -> Optional[float]:
    if v is None:
        return None
    try:
        f = float(v)
        return round(f / 1e7, 2) if f == f else None
    except (TypeError, ValueError):
        return None


def _fmt_date(ts) -> str:
    try:
        return ts.strftime("%b %Y")
    except Exception:
        return str(ts)[:7]


def _df_val(df, row_names, col) -> Optional[float]:
    """
    Read one cell from a yfinance DataFrame.
    row_names: str or list of candidate names (first found wins).
    """
    if df is None or df.empty:
        return None
    names = [row_names] if isinstance(row_names, str) else row_names
    for name in names:
        if name in df.index:
            try:
                import pandas as pd
                v = df.loc[name, col]
                if pd.isna(v):
                    return None
                return float(v)
            except Exception:
                continue
    return None


def _build_history(df, mappings, in_crore=True, max_cols=6):
    """
    Build a HistoricalTable dict from a yfinance DataFrame.
    Only rows with at least one non-null value are returned.

    mappings: list of (label, row_name_or_list [, transform_fn])
    """
    if df is None or df.empty:
        return None
    try:
        import pandas as pd

        cols = sorted(df.columns)
        if len(cols) > max_cols:
            cols = cols[-max_cols:]

        headers = [_fmt_date(c) for c in cols]
        rows = []

        for item in mappings:
            transform = None
            if len(item) == 3:
                label, yf_name, transform = item
            else:
                label, yf_name = item

            names = [yf_name] if isinstance(yf_name, str) else yf_name

            vals = []
            for c in cols:
                raw = _df_val(df, names, c)
                if raw is None:
                    vals.append(None)
                elif transform:
                    try:
                        vals.append(transform(raw))
                    except Exception:
                        vals.append(None)
                elif in_crore:
                    vals.append(_to_crore(raw))
                else:
                    vals.append(round(float(raw), 4))

            # Only include rows that have at least one non-null value
            if any(v is not None for v in vals):
                rows.append({"label": label, "values": vals})

        if not rows:
            return None
        return {"headers": headers, "rows": rows}
    except Exception as e:
        logger.warning(f"[yfinance] _build_history error: {e}")
        return None


def _cagr(values: list, years: int) -> Optional[float]:
    """Compute CAGR from a list of values (oldest→newest). Returns decimal fraction."""
    if len(values) < years + 1:
        return None
    end = values[-1]
    start = values[-(years + 1)]
    if end is None or start is None or start <= 0:
        return None
    return round((end / start) ** (1 / years) - 1, 4)


# ─── core fundamentals fetch ──────────────────────────────────────────────────

def _fetch_fundamentals_sync(symbol: str) -> dict:
    """
    Full fundamentals for an Indian/global stock via yfinance.
    Returns point-in-time ratios + historical tables + derived ratios.
    Only history rows with real data are included (all-null rows are dropped).
    """
    try:
        import yfinance as yf
    except ImportError:
        return {"error": "yfinance not installed", "source": "yfinance"}

    ns_symbol = symbol
    if not (symbol.endswith(".NS") or symbol.endswith(".BO") or
            ("." in symbol.split("/")[-1] and not symbol.endswith(".NS"))):
        ns_symbol = f"{symbol}.NS"

    try:
        t = yf.Ticker(ns_symbol)
        info = t.info or {}

        if not info.get("regularMarketPrice") and not info.get("currentPrice"):
            if ns_symbol.endswith(".NS"):
                bo_sym = ns_symbol.replace(".NS", ".BO")
                t_bo = yf.Ticker(bo_sym)
                bo_info = t_bo.info or {}
                if bo_info.get("currentPrice") or bo_info.get("regularMarketPrice"):
                    ns_symbol = bo_sym
                    t = t_bo
                    info = bo_info

        roe_raw    = _safe_float(info.get("returnOnEquity"))
        de_raw     = _safe_float(info.get("debtToEquity"))
        revenue_raw = info.get("totalRevenue")

        base = {
            "roe":              roe_raw,
            "roce":             None,
            "pe":               _safe_float(info.get("trailingPE")) or _safe_float(info.get("forwardPE")),
            "pb":               _safe_float(info.get("priceToBook")),
            "dividendYield":    _safe_float(info.get("dividendYield")),
            "debtToEquity":     round(de_raw / 100, 4) if de_raw is not None else None,
            "revenue":          _to_crore(revenue_raw),
            "netIncome":        _to_crore(info.get("netIncomeToCommon")),
            "operatingMargin":  _safe_float(info.get("operatingMargins")),
            "freeCashFlow":     _to_crore(info.get("freeCashflow")),
            "operatingCashFlow":_to_crore(info.get("operatingCashflow")),
            "bookValue":        _safe_float(info.get("bookValue")),
            "earningsGrowth":   _safe_float(info.get("earningsGrowth")),
            "revenueGrowth":    _safe_float(info.get("revenueGrowth")),
            "beta":             _safe_float(info.get("beta")),
            "eps":              _safe_float(info.get("trailingEps")),
            "price":            (_safe_float(info.get("currentPrice")) or
                                 _safe_float(info.get("regularMarketPrice"))),
            "name":             info.get("longName") or info.get("shortName"),
            "sector":           info.get("sector"),
            "industry":         info.get("industry"),
            "symbol":           ns_symbol,
            "source":           "yfinance",
            "plHistory":        None,
            "bsHistory":        None,
            "cfHistory":        None,
            "ratiosHistory":    None,
            "quarterlyHistory": None,
            "companyDescription": None,
            "salesCagr3Y":      None,
            "salesCagr5Y":      None,
            "profitCagr3Y":     None,
            "profitCagr5Y":     None,
        }

        desc = info.get("longBusinessSummary")
        if desc and isinstance(desc, str) and len(desc) > 20:
            base["companyDescription"] = desc[:1200]

        # ── Fetch statements ──────────────────────────────────────────────────
        try:
            fin = t.financials
        except Exception:
            fin = None
        try:
            bs = t.balance_sheet
        except Exception:
            bs = None
        try:
            cf = t.cashflow
        except Exception:
            cf = None
        try:
            qfin = t.quarterly_financials
        except Exception:
            qfin = None
        try:
            qbs = t.quarterly_balance_sheet
        except Exception:
            qbs = None

        # ── Annual P&L History ────────────────────────────────────────────────
        if fin is not None and not fin.empty:
            fin_cols = sorted(fin.columns)[-6:]
            headers  = [_fmt_date(c) for c in fin_cols]
            pl_rows  = []

            # Helper: build one row, skip if entirely null
            def _pl_row(label, names, transform=None):
                vals = []
                for c in fin_cols:
                    raw = _df_val(fin, names, c)
                    if raw is None:
                        vals.append(None)
                    elif transform:
                        try:
                            vals.append(transform(raw))
                        except Exception:
                            vals.append(None)
                    else:
                        vals.append(_to_crore(raw))
                if any(v is not None for v in vals):
                    pl_rows.append({"label": label, "values": vals})

            _pl_row("Sales",            _REVENUE_ROWS)

            # Operating Profit: try direct first, then derive from EBITDA - Depreciation
            op_vals = []
            for c in fin_cols:
                v = _df_val(fin, _OP_INCOME_ROWS, c)
                if v is None:
                    # derive: EBITDA - Depreciation
                    ebitda = _df_val(fin, _EBITDA_ROWS, c)
                    dep    = _df_val(fin, _DEPR_ROWS, c)
                    if ebitda is not None and dep is not None:
                        v = ebitda - dep
                    elif ebitda is not None:
                        # Use EBITDA as best proxy
                        v = ebitda
                op_vals.append(_to_crore(v) if v is not None else None)

            if any(v is not None for v in op_vals):
                pl_rows.append({"label": "Operating Profit", "values": op_vals})

                # OPM %: Op Profit / Revenue × 100
                opm_vals = []
                rev_lookup = [_to_crore(_df_val(fin, _REVENUE_ROWS, c)) for c in fin_cols]
                for op_v, rev_v in zip(op_vals, rev_lookup):
                    opm_vals.append(
                        round(op_v / rev_v * 100, 2)
                        if op_v is not None and rev_v is not None and rev_v > 0
                        else None
                    )
                if any(v is not None for v in opm_vals):
                    pl_rows.append({"label": "OPM %", "values": opm_vals})

            _pl_row("Other Income",    ["Other Non Operating Income",
                                        "Non Operating Income Other",
                                        "Other Income Expense"])
            _pl_row("Interest",        _INTEREST_ROWS,
                    transform=lambda v: _to_crore(abs(v)))   # interest can be sign-flipped
            _pl_row("Depreciation",    _DEPR_ROWS)
            _pl_row("Net Profit",      _NET_INCOME_ROWS)
            _pl_row("EPS in Rs",       _EPS_ROWS,
                    transform=lambda v: round(float(v), 2))   # already per share

            if pl_rows:
                base["plHistory"] = {"headers": headers, "rows": pl_rows}

            # ── CAGR ──────────────────────────────────────────────────────────
            rev_s = [_to_crore(_df_val(fin, _REVENUE_ROWS, c)) for c in fin_cols]
            pat_s = [_to_crore(_df_val(fin, _NET_INCOME_ROWS, c)) for c in fin_cols]
            base["salesCagr3Y"]  = _cagr(rev_s, 3)
            base["salesCagr5Y"]  = _cagr(rev_s, 5)
            base["profitCagr3Y"] = _cagr(pat_s, 3)
            base["profitCagr5Y"] = _cagr(pat_s, 5)

        # ── Balance Sheet History ─────────────────────────────────────────────
        if bs is not None and not bs.empty:
            bs_mappings = [
                ("Equity Capital",  _EQUITY_ROWS),
                ("Reserves",        _RESERVES_ROWS),
                ("Borrowings",      _DEBT_ROWS),
                ("Fixed Assets",    _PPE_ROWS),
                ("Total Assets",    _TOTAL_ASSET_ROWS),
            ]
            base["bsHistory"] = _build_history(bs, bs_mappings, in_crore=True)

            # ROCE from latest year
            if fin is not None and not fin.empty:
                bs_cols  = sorted(bs.columns)
                fin_cols_all = sorted(fin.columns)
                if bs_cols and fin_cols_all:
                    latest_bs  = bs_cols[-1]
                    latest_fin = fin_cols_all[-1]
                    ebit = (_df_val(fin, _OP_INCOME_ROWS, latest_fin) or
                            (_df_val(fin, _EBITDA_ROWS, latest_fin) or 0) -
                            (_df_val(fin, _DEPR_ROWS, latest_fin) or 0))
                    ta   = _df_val(bs, _TOTAL_ASSET_ROWS, latest_bs)
                    cl   = _df_val(bs, _CURR_LIAB_ROWS,   latest_bs)
                    if ebit and ta:
                        cap_emp = ta - (cl or 0)
                        if cap_emp > 0:
                            base["roce"] = round(ebit / cap_emp, 4)

        # ── Cash Flow History ─────────────────────────────────────────────────
        if cf is not None and not cf.empty:
            cf_cols = sorted(cf.columns)[-6:]
            cf_headers = [_fmt_date(c) for c in cf_cols]
            cf_rows = []
            cf_map = [
                ("Cash from Operating", ["Operating Cash Flow"]),
                ("Cash from Investing", ["Investing Cash Flow"]),
                ("Cash from Financing", ["Financing Cash Flow"]),
            ]
            series_by_label = {}
            for label, names in cf_map:
                vals = []
                for c in cf_cols:
                    raw = _df_val(cf, names, c)
                    vals.append(_to_crore(raw) if raw is not None else None)
                if any(v is not None for v in vals):
                    cf_rows.append({"label": label, "values": vals})
                series_by_label[label] = vals

            # Net Cash Flow
            net_vals = []
            for i in range(len(cf_cols)):
                parts = [series_by_label.get(lbl, [None]*len(cf_cols))[i]
                         for lbl in ["Cash from Operating",
                                     "Cash from Investing",
                                     "Cash from Financing"]]
                net = sum(p for p in parts if p is not None) if any(p is not None for p in parts) else None
                net_vals.append(round(net, 2) if net is not None else None)
            if any(v is not None for v in net_vals):
                cf_rows.append({"label": "Net Cash Flow", "values": net_vals})

            if cf_rows:
                base["cfHistory"] = {"headers": cf_headers, "rows": cf_rows}

        # ── Quarterly History ─────────────────────────────────────────────────
        if qfin is not None and not qfin.empty:
            q_cols = sorted(qfin.columns)[-5:]
            q_headers = [_fmt_date(c) for c in q_cols]
            q_rows = []

            def _q_row(label, names, transform=None):
                vals = []
                for c in q_cols:
                    raw = _df_val(qfin, names, c)
                    if raw is None:
                        vals.append(None)
                    elif transform:
                        try:
                            vals.append(transform(raw))
                        except Exception:
                            vals.append(None)
                    else:
                        vals.append(_to_crore(raw))
                if any(v is not None for v in vals):
                    q_rows.append({"label": label, "values": vals})

            _q_row("Sales",       _REVENUE_ROWS)

            # Quarterly Operating Profit
            q_op_vals = []
            for c in q_cols:
                v = _df_val(qfin, _OP_INCOME_ROWS, c)
                if v is None:
                    ebitda = _df_val(qfin, _EBITDA_ROWS, c)
                    dep    = _df_val(qfin, _DEPR_ROWS, c)
                    if ebitda is not None and dep is not None:
                        v = ebitda - dep
                    elif ebitda is not None:
                        v = ebitda
                q_op_vals.append(_to_crore(v) if v is not None else None)

            if any(v is not None for v in q_op_vals):
                q_rows.append({"label": "Operating Profit", "values": q_op_vals})
                q_opm = []
                q_rev = [_to_crore(_df_val(qfin, _REVENUE_ROWS, c)) for c in q_cols]
                for op_v, rev_v in zip(q_op_vals, q_rev):
                    q_opm.append(
                        round(op_v / rev_v * 100, 2)
                        if op_v is not None and rev_v is not None and rev_v > 0
                        else None
                    )
                if any(v is not None for v in q_opm):
                    q_rows.append({"label": "OPM %", "values": q_opm})

            _q_row("Net Profit",  _NET_INCOME_ROWS)
            _q_row("EPS in Rs",   _EPS_ROWS, transform=lambda v: round(float(v), 2))

            if q_rows:
                base["quarterlyHistory"] = {"headers": q_headers, "rows": q_rows}

        # ── Working Capital Ratios ────────────────────────────────────────────
        if bs is not None and not bs.empty and fin is not None and not fin.empty:
            try:
                common_years = sorted(set(bs.columns) & set(fin.columns))[-6:]
                if common_years:
                    r_headers = [_fmt_date(c) for c in common_years]
                    ratio_rows = []

                    deb_v, inv_v, pay_v, ccc_v, wc_v, roce_v = [], [], [], [], [], []
                    for c in common_years:
                        rev  = _df_val(fin, _REVENUE_ROWS, c)
                        gp   = _df_val(fin, _GP_ROWS, c)
                        cogs = (rev - gp) if rev and gp else None
                        ar   = _df_val(bs, _RECV_ROWS,    c)
                        inv  = _df_val(bs, _INVENT_ROWS,  c)
                        ap   = _df_val(bs, _AP_ROWS,      c)
                        ca   = _df_val(bs, _CURR_ASSET_ROWS, c)
                        cl   = _df_val(bs, _CURR_LIAB_ROWS,  c)
                        ta   = _df_val(bs, _TOTAL_ASSET_ROWS, c)
                        ebit = _df_val(fin, _OP_INCOME_ROWS, c)
                        if ebit is None:
                            eb = _df_val(fin, _EBITDA_ROWS, c)
                            dp = _df_val(fin, _DEPR_ROWS, c)
                            if eb and dp:
                                ebit = eb - dp

                        dd = round(ar / rev * 365, 1) if ar and rev and rev > 0 else None
                        id_ = round(inv / cogs * 365, 1) if inv and cogs and cogs > 0 else None
                        dp_ = round(ap / cogs * 365, 1) if ap and cogs and cogs > 0 else None
                        ccc = round(dd + id_ - dp_, 1) if all(x is not None for x in [dd, id_, dp_]) else None
                        wc  = round(((ca or 0) - (cl or 0)) / rev * 365, 1) if ca and rev and rev > 0 else None
                        cap_emp = ta - (cl or 0) if ta else None
                        roce_yr = round(ebit / cap_emp * 100, 2) if ebit and cap_emp and cap_emp > 0 else None

                        deb_v.append(dd); inv_v.append(id_); pay_v.append(dp_)
                        ccc_v.append(ccc); wc_v.append(wc); roce_v.append(roce_yr)

                    for label, vals in [
                        ("Debtor Days", deb_v),
                        ("Inventory Days", inv_v),
                        ("Days Payable", pay_v),
                        ("Cash Conversion Cycle", ccc_v),
                        ("Working Capital Days", wc_v),
                        ("ROCE %", roce_v),
                    ]:
                        if any(v is not None for v in vals):
                            ratio_rows.append({"label": label, "values": vals})

                    if ratio_rows:
                        base["ratiosHistory"] = {"headers": r_headers, "rows": ratio_rows}
            except Exception as e:
                logger.debug(f"[yfinance] ratiosHistory error: {e}")

        return base

    except Exception as e:
        logger.warning(f"[yfinance] Fundamentals error for {ns_symbol}: {e}")
        return {"error": str(e), "source": "yfinance"}


def _fetch_peer_enrich_sync(symbols: List[str]) -> dict:
    """
    Lightweight: fetch PE, PB, ROE, D/E for a list of NSE symbols via yfinance.
    Used as fallback when Screener.in fails for peers.
    Returns {symbol: {pe, pb, roe, debtToEquity, bookValue, price, marketCap}}.
    """
    try:
        import yfinance as yf
    except ImportError:
        return {}

    results = {}
    for sym in symbols:
        ns = f"{sym}.NS" if not sym.endswith((".NS", ".BO")) else sym
        try:
            t = yf.Ticker(ns)
            info = t.info or {}
            if not info:
                continue
            roe_raw = _safe_float(info.get("returnOnEquity"))
            de_raw  = _safe_float(info.get("debtToEquity"))
            results[sym] = {
                "pe":           _safe_float(info.get("trailingPE")),
                "pb":           _safe_float(info.get("priceToBook")),
                "roe":          roe_raw,
                "debtToEquity": round(de_raw / 100, 4) if de_raw is not None else None,
                "bookValue":    _safe_float(info.get("bookValue")),
                "price":        (_safe_float(info.get("currentPrice")) or
                                 _safe_float(info.get("regularMarketPrice"))),
                "marketCap":    _safe_float(info.get("marketCap")),
                "dividendYield":_safe_float(info.get("dividendYield")),
            }
        except Exception as e:
            logger.debug(f"[yfinance] peer-enrich skip {sym}: {e}")

    return results


def _fetch_quotes_sync(symbols: List[str]) -> dict:
    try:
        import yfinance as yf
    except ImportError:
        return {}

    results = {}
    if not symbols:
        return results
    try:
        joined = " ".join(symbols)
        tickers = yf.Tickers(joined)
        for sym in symbols:
            try:
                t = tickers.tickers.get(sym)
                if not t:
                    continue
                fi = t.fast_info
                price = _safe_float(getattr(fi, "last_price", None))
                prev_close = _safe_float(getattr(fi, "previous_close", None))
                change = round(price - prev_close, 4) if price is not None and prev_close is not None else None
                change_pct = round((change / prev_close) * 100, 4) if change is not None and prev_close else None
                results[sym] = {
                    "symbol": sym,
                    "price": price,
                    "previousClose": prev_close,
                    "change": change,
                    "changePercent": change_pct,
                    "dayHigh": _safe_float(getattr(fi, "day_high", None)),
                    "dayLow": _safe_float(getattr(fi, "day_low", None)),
                    "volume": _safe_float(getattr(fi, "three_month_average_volume", None)),
                    "marketCap": _safe_float(getattr(fi, "market_cap", None)),
                    "currency": getattr(fi, "currency", None),
                    "exchange": getattr(fi, "exchange", None),
                    "source": "yfinance",
                }
            except Exception as e:
                logger.debug(f"[yfinance] Quote skip {sym}: {e}")
    except Exception as e:
        logger.error(f"[yfinance] Batch quotes error: {e}")

    return results


def _fetch_movers_sync() -> dict:
    try:
        import yfinance as yf
        import pandas as pd
    except ImportError:
        return {"gainers": [], "losers": [], "source": "yfinance", "error": "yfinance not installed"}

    stocks = []
    try:
        symbols = list(dict.fromkeys(NIFTY50_SYMBOLS))
        data = yf.download(
            symbols, period="2d", interval="1d",
            group_by="ticker", auto_adjust=True,
            progress=False, threads=True, timeout=30,
        )

        for sym in symbols:
            try:
                if isinstance(data.columns, pd.MultiIndex):
                    if sym not in data.columns.get_level_values(0):
                        continue
                    sym_data = data[sym]
                else:
                    sym_data = data

                closes = sym_data["Close"].dropna()
                if len(closes) < 2:
                    continue

                today_close = float(closes.iloc[-1])
                prev_close  = float(closes.iloc[-2])
                if today_close <= 0 or prev_close <= 0:
                    continue

                change     = today_close - prev_close
                change_pct = (change / prev_close) * 100
                display    = sym.replace(".NS", "").replace(".BO", "")
                stocks.append({
                    "symbol": display, "name": display,
                    "price": round(today_close, 2),
                    "change": round(change, 2),
                    "changePercent": round(change_pct, 4),
                    "previousClose": round(prev_close, 2),
                })
            except Exception:
                pass
    except Exception as e:
        logger.error(f"[yfinance] Market movers download error: {e}")

    stocks.sort(key=lambda x: x["changePercent"], reverse=True)
    gainers = [s for s in stocks if s["changePercent"] > 0][:5]
    losers  = sorted([s for s in stocks if s["changePercent"] < 0],
                     key=lambda x: x["changePercent"])[:5]
    return {"gainers": gainers, "losers": losers,
            "total": len(stocks), "source": "yfinance"}


# ─── routes ───────────────────────────────────────────────────────────────────

@router.post("/quotes")
async def batch_quotes(
    payload: QuotesRequest,
    _: TokenPayload = Depends(verify_token),
):
    symbols = payload.symbols
    if not symbols:
        raise HTTPException(status_code=400, detail="symbols list required")
    if len(symbols) > 150:
        raise HTTPException(status_code=400, detail="Max 150 symbols per request")
    loop = asyncio.get_event_loop()
    results = await loop.run_in_executor(_executor, _fetch_quotes_sync, symbols)
    return {"results": results, "count": len(results), "source": "yfinance"}


@router.post("/fundamentals")
async def stock_fundamentals(
    payload: FundamentalsRequest,
    _: TokenPayload = Depends(verify_token),
):
    """
    Full Indian stock fundamentals via yfinance.
    Returns point-in-time ratios + 4-year historical tables (only rows with data).
    """
    symbol = payload.symbol.strip().upper()
    if not symbol:
        raise HTTPException(status_code=400, detail="symbol required")
    loop = asyncio.get_event_loop()
    result = await loop.run_in_executor(_executor, _fetch_fundamentals_sync, symbol)
    return result


@router.post("/peer-enrich")
async def peer_enrich(
    payload: PeerEnrichRequest,
    _: TokenPayload = Depends(verify_token),
):
    """
    Lightweight peer enrichment: PE, PB, ROE, D/E for up to 10 NSE symbols.
    Used as fallback when Screener.in fails for peer comparison.
    """
    symbols = payload.symbols[:10]
    if not symbols:
        raise HTTPException(status_code=400, detail="symbols list required")
    loop = asyncio.get_event_loop()
    result = await loop.run_in_executor(_executor, _fetch_peer_enrich_sync, symbols)
    return {"results": result, "count": len(result)}


@router.get("/movers/indian")
async def indian_market_movers(_: TokenPayload = Depends(verify_token)):
    loop = asyncio.get_event_loop()
    result = await loop.run_in_executor(_executor, _fetch_movers_sync)
    return result


@router.get("/health")
async def market_data_health():
    try:
        import yfinance as yf
        version = getattr(yf, "__version__", "unknown")
        return {"status": "ok", "provider": "yfinance", "version": version}
    except ImportError:
        return {"status": "unavailable", "error": "yfinance not installed"}
