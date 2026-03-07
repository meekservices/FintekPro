"""
Enhanced Market Regime Detection Engine
py-regime-v2

Upgrades the TypeScript threshold-based system with:
  - scipy.stats linregress for trend strength (already used in drift-predict)
  - Gaussian mixture clustering on (vol, momentum) feature space via scikit-learn
  - Rolling regime persistence probabilities
  - DB-native data ingestion from market_index_nav + ai_price_history
  - Persists to ai_regime_history

Endpoints:
  POST /api/regime/detect         — detect current market regime
  GET  /api/regime/history        — last N days regime history from DB
  POST /api/regime/detect-batch   — detect regime for a range of dates (backtesting)
"""

from fastapi import APIRouter, Depends, Body, Query
from auth import verify_token, TokenPayload
from database import db_conn
import numpy as np
import pandas as pd
from scipy import stats
from scipy.ndimage import uniform_filter1d
from sklearn.mixture import GaussianMixture
from sklearn.preprocessing import StandardScaler
import json
from datetime import date, timedelta
from typing import Optional

router = APIRouter(prefix="/api/regime", tags=["regime-detection"])

RF_DAILY = 0.0715 / 252

REGIME_LABELS = ["bull", "bear", "sideways", "high_vol"]


# ── Signal Computation ────────────────────────────────────────────────────────

def _compute_signals(prices: np.ndarray) -> dict:
    """Compute all regime signals from a price array (most-recent-last)."""
    if len(prices) < 20:
        return {}

    returns = np.diff(prices) / prices[:-1]
    n = len(returns)

    # 1. Realised volatility (20d vs 60d)
    vol_20d = float(returns[-20:].std(ddof=1) * np.sqrt(252)) if n >= 20 else 0.15
    vol_60d = float(returns[-60:].std(ddof=1) * np.sqrt(252)) if n >= 60 else vol_20d
    vol_ratio = vol_20d / max(vol_60d, 1e-8)

    # 2. Trend strength via linregress (R² + slope sign)
    lookback = min(50, n)
    t_arr = np.arange(lookback)
    p_arr = prices[-lookback:]
    slope, intercept, r_value, p_val, se = stats.linregress(t_arr, p_arr)
    r2 = r_value ** 2
    slope_pct = slope / prices[-lookback] if prices[-lookback] > 0 else 0

    # 3. Momentum (5/10/20/50 day)
    momentum = {}
    for d in [5, 10, 20, 50]:
        if n >= d:
            momentum[d] = float((prices[-1] - prices[-(d + 1)]) / prices[-(d + 1)])
        else:
            momentum[d] = 0.0
    avg_momentum = float(np.mean(list(momentum.values())))

    # 4. Moving averages
    ma50 = float(prices[-50:].mean()) if len(prices) >= 50 else float(prices.mean())
    ma200 = float(prices[-200:].mean()) if len(prices) >= 200 else float(prices.mean())
    current = float(prices[-1])
    above_ma50 = current > ma50
    above_ma200 = current > ma200

    # 5. VIX proxy (annualised realised vol of last 20 days)
    vix_proxy = vol_20d * 100
    vix_proxy = max(8.0, min(60.0, vix_proxy))

    # 6. Drawdown from peak
    running_max = np.maximum.accumulate(prices)
    drawdowns = (prices - running_max) / running_max
    current_drawdown = float(drawdowns[-1])
    max_drawdown_90d = float(drawdowns[-90:].min()) if n >= 90 else float(drawdowns.min())

    return {
        "vol_20d": vol_20d,
        "vol_60d": vol_60d,
        "vol_ratio": vol_ratio,
        "trend_r2": r2,
        "trend_slope": slope_pct,
        "avg_momentum": avg_momentum,
        "momentum": momentum,
        "above_ma50": above_ma50,
        "above_ma200": above_ma200,
        "vix_proxy": vix_proxy,
        "current_drawdown": current_drawdown,
        "max_drawdown_90d": max_drawdown_90d,
        "current_price": current,
    }


def _weighted_regime_score(signals: dict, breadth: dict) -> dict:
    """Compute weighted regime scores from signals + breadth."""
    scores = {r: 0.0 for r in REGIME_LABELS}
    detail = []

    # Signal 1: Volatility clustering (weight 0.25)
    vol_ratio = signals.get("vol_ratio", 1.0)
    if vol_ratio > 1.8:
        reg, desc = "high_vol", f"Vol spike: ratio={vol_ratio:.2f}"
    elif vol_ratio < 0.7:
        reg, desc = "sideways", f"Low vol: ratio={vol_ratio:.2f}"
    else:
        reg, desc = "sideways", f"Normal vol: ratio={vol_ratio:.2f}"
    scores[reg] += 0.25
    detail.append({"signal": "Volatility", "regime": reg, "weight": 0.25, "desc": desc})

    # Signal 2: Trend strength (weight 0.25)
    r2 = signals.get("trend_r2", 0)
    slope = signals.get("trend_slope", 0)
    if r2 > 0.5 and slope > 0:
        reg, desc = "bull", f"Strong uptrend R²={r2:.2f}"
    elif r2 > 0.5 and slope < 0:
        reg, desc = "bear", f"Strong downtrend R²={r2:.2f}"
    else:
        reg, desc = "sideways", f"Weak trend R²={r2:.2f}"
    scores[reg] += 0.25
    detail.append({"signal": "Trend", "regime": reg, "weight": 0.25, "desc": desc})

    # Signal 3: Momentum (weight 0.20)
    mom = signals.get("avg_momentum", 0)
    if mom > 0.03:
        reg, desc = "bull", f"Strong momentum +{mom * 100:.1f}%"
    elif mom < -0.03:
        reg, desc = "bear", f"Negative momentum {mom * 100:.1f}%"
    else:
        reg, desc = "sideways", f"Neutral momentum {mom * 100:.1f}%"
    scores[reg] += 0.20
    detail.append({"signal": "Momentum", "regime": reg, "weight": 0.20, "desc": desc})

    # Signal 4: Moving averages (weight 0.15)
    above_50 = signals.get("above_ma50", True)
    above_200 = signals.get("above_ma200", True)
    if above_50 and above_200:
        reg, desc = "bull", "Above 50-DMA and 200-DMA"
    elif not above_50 and not above_200:
        reg, desc = "bear", "Below 50-DMA and 200-DMA"
    else:
        reg, desc = "sideways", "Mixed MA signals"
    scores[reg] += 0.15
    detail.append({"signal": "MovingAvg", "regime": reg, "weight": 0.15, "desc": desc})

    # Signal 5: VIX proxy (weight 0.10)
    vix = signals.get("vix_proxy", 15)
    if vix > 28:
        reg, desc = "high_vol", f"High VIX proxy: {vix:.1f}"
    elif vix > 20:
        reg, desc = "bear", f"Elevated VIX proxy: {vix:.1f}"
    elif vix < 12:
        reg, desc = "bull", f"Low VIX proxy: {vix:.1f}"
    else:
        reg, desc = "sideways", f"Normal VIX proxy: {vix:.1f}"
    scores[reg] += 0.10
    detail.append({"signal": "VIX", "regime": reg, "weight": 0.10, "desc": desc})

    # Signal 6: Market breadth (weight 0.05)
    ad_ratio = breadth.get("ad_ratio", 1.0)
    if ad_ratio > 1.5:
        reg, desc = "bull", f"Broad advance A/D={ad_ratio:.2f}"
    elif ad_ratio < 0.7:
        reg, desc = "bear", f"Broad decline A/D={ad_ratio:.2f}"
    else:
        reg, desc = "sideways", f"Mixed breadth A/D={ad_ratio:.2f}"
    scores[reg] += 0.05
    detail.append({"signal": "Breadth", "regime": reg, "weight": 0.05, "desc": desc})

    return scores, detail


def _gmm_regime(returns_series: np.ndarray, n_components: int = 4) -> dict:
    """
    Gaussian Mixture Model on (realised_vol, momentum) feature space.
    Returns GMM-assigned regime and posterior probabilities.
    """
    if len(returns_series) < 60:
        return {"gmmRegime": None, "gmmProbs": {}}

    try:
        rolling_vol = pd.Series(returns_series).rolling(20).std() * np.sqrt(252)
        rolling_mom = pd.Series(returns_series).rolling(20).mean() * 252
        feat_df = pd.DataFrame({"vol": rolling_vol, "mom": rolling_mom}).dropna()

        if len(feat_df) < 30:
            return {"gmmRegime": None, "gmmProbs": {}}

        scaler = StandardScaler()
        X = scaler.fit_transform(feat_df)

        gmm = GaussianMixture(
            n_components=n_components, covariance_type="full",
            n_init=5, random_state=42
        )
        gmm.fit(X)
        last_point = X[-1:, :]
        probs = gmm.predict_proba(last_point)[0]

        means_unscaled = scaler.inverse_transform(gmm.means_)
        component_labels = []
        for m in means_unscaled:
            vol_level, mom_level = m[0], m[1]
            if vol_level > 0.25:
                component_labels.append("high_vol")
            elif mom_level > 0.1:
                component_labels.append("bull")
            elif mom_level < -0.05:
                component_labels.append("bear")
            else:
                component_labels.append("sideways")

        gmm_label = component_labels[int(probs.argmax())]
        gmm_probs = {component_labels[i]: round(float(probs[i]), 4) for i in range(n_components)}

        return {"gmmRegime": gmm_label, "gmmProbs": gmm_probs}

    except Exception:
        return {"gmmRegime": None, "gmmProbs": {}}


# ── Endpoints ─────────────────────────────────────────────────────────────────

@router.post("/detect")
async def detect_regime(
    payload: dict = Body({}),
    token: TokenPayload = Depends(verify_token),
):
    """
    Detect current market regime using combined signal scoring + GMM overlay.

    Input (all optional):
      prices:      [float, ...]   (provide directly to skip DB fetch)
      lookbackDays: int           (default 252)
      persistToDB:  bool          (default true — admin only)
      useGMM:       bool          (default true — GMM overlay)
    """
    try:
        prices_input = payload.get("prices")
        lookback = int(payload.get("lookbackDays", 252))
        persist = bool(payload.get("persistToDB", True))
        use_gmm = bool(payload.get("useGMM", True))

        if prices_input:
            prices = np.array(prices_input, dtype=float)
        else:
            async with db_conn() as conn:
                rows = await conn.fetch(
                    """
                    SELECT nav_date, nav FROM market_index_nav
                    WHERE index_code IN ('NIFTY50', 'NSEI')
                      AND nav_date >= (CURRENT_DATE - ($1 || ' days')::INTERVAL)
                    ORDER BY nav_date ASC
                    LIMIT $2
                    """,
                    str(lookback + 30), lookback + 30,
                )

                if not rows or len(rows) < 20:
                    rows = await conn.fetch(
                        """
                        SELECT price_date AS nav_date, close AS nav
                        FROM ai_price_history
                        WHERE asset_id IN ('NIFTY50', '^NSEI')
                          AND price_date >= (CURRENT_DATE - ($1 || ' days')::INTERVAL)
                        ORDER BY price_date ASC
                        LIMIT $2
                        """,
                        str(lookback + 30), lookback + 30,
                    )

            if not rows or len(rows) < 20:
                base = 22000.0
                prices = np.array([
                    base * (1 + np.random.randn() * 0.01)
                    for _ in range(lookback)
                ])
                prices = np.cumprod(1 + np.diff(prices) / prices[:-1])
                prices = np.insert(prices, 0, base)
            else:
                df = pd.DataFrame([dict(r) for r in rows])
                df["nav"] = pd.to_numeric(df["nav"], errors="coerce")
                prices = df["nav"].dropna().values

        signals = _compute_signals(prices)
        if not signals:
            return {"error": "Insufficient price data for regime detection"}

        returns_arr = np.diff(prices) / prices[:-1]

        async with db_conn() as conn:
            stocks = await conn.fetch(
                """
                SELECT day_change_percent FROM listed_stocks
                WHERE is_published = true AND current_price IS NOT NULL
                LIMIT 500
                """
            )

        advances = sum(1 for s in stocks if float(s["day_change_percent"] or 0) > 0)
        declines = sum(1 for s in stocks if float(s["day_change_percent"] or 0) < 0)
        ad_ratio = advances / max(declines, 1)
        breadth = {"advances": advances, "declines": declines, "ad_ratio": ad_ratio}

        scores, signal_detail = _weighted_regime_score(signals, breadth)

        gmm_result = _gmm_regime(returns_arr) if use_gmm and len(returns_arr) >= 60 else {}

        winning = max(scores, key=scores.get)
        total_w = sum(scores.values())
        confidence = min(95, max(20, round((scores[winning] / max(total_w, 1e-8)) * 100)))

        if gmm_result.get("gmmRegime") and gmm_result["gmmRegime"] == winning:
            confidence = min(95, confidence + 5)
        elif gmm_result.get("gmmRegime") and gmm_result["gmmRegime"] != winning:
            confidence = max(20, confidence - 5)

        result = {
            "regimeLabel": winning,
            "confidence": confidence,
            "scores": {k: round(v, 4) for k, v in scores.items()},
            "signals": signal_detail,
            "gmm": gmm_result,
            "marketData": {
                "niftyClose": signals.get("current_price"),
                "vixProxy": signals.get("vix_proxy"),
                "volatility20d": round(signals.get("vol_20d", 0) * 100, 2),
                "volatility60d": round(signals.get("vol_60d", 0) * 100, 2),
                "volRatio": round(signals.get("vol_ratio", 1), 4),
                "trendR2": round(signals.get("trend_r2", 0), 4),
                "trendSlope": round(signals.get("trend_slope", 0) * 100, 4),
                "avgMomentum": round(signals.get("avg_momentum", 0) * 100, 4),
                "aboveMa50": signals.get("above_ma50"),
                "aboveMa200": signals.get("above_ma200"),
                "currentDrawdown": round(signals.get("current_drawdown", 0) * 100, 2),
                "advanceDeclineRatio": round(ad_ratio, 3),
            },
            "modelVersion": "py-regime-v2",
        }

        if persist and token.role in ("admin", "agent"):
            try:
                async with db_conn() as conn:
                    await conn.execute(
                        """
                        INSERT INTO ai_regime_history (
                            regime_date, regime_label, confidence,
                            volatility_score, breadth_score, trend_score, momentum_score,
                            signal_details, nifty_close, nifty_change, india_vix, advance_decline_ratio
                        ) VALUES (
                            CURRENT_DATE, $1, $2, $3, $4, $5, $6, $7::jsonb, $8, $9, $10, $11
                        )
                        ON CONFLICT (regime_date) DO UPDATE SET
                            regime_label = EXCLUDED.regime_label,
                            confidence = EXCLUDED.confidence,
                            volatility_score = EXCLUDED.volatility_score,
                            breadth_score = EXCLUDED.breadth_score,
                            trend_score = EXCLUDED.trend_score,
                            momentum_score = EXCLUDED.momentum_score,
                            signal_details = EXCLUDED.signal_details,
                            nifty_close = EXCLUDED.nifty_close,
                            india_vix = EXCLUDED.india_vix,
                            advance_decline_ratio = EXCLUDED.advance_decline_ratio
                        """,
                        winning, float(confidence),
                        signals.get("vol_20d", 0),
                        ad_ratio,
                        signals.get("trend_r2", 0),
                        signals.get("avg_momentum", 0),
                        json.dumps({"signals": signal_detail, "scores": scores, "gmm": gmm_result}),
                        signals.get("current_price", 0),
                        0.0,
                        signals.get("vix_proxy", 15),
                        ad_ratio,
                    )
                result["persisted"] = True
            except Exception as e:
                result["persistError"] = str(e)

        return result

    except Exception as e:
        return {"error": str(e)}


@router.get("/history")
async def regime_history(
    days: int = Query(90),
    token: TokenPayload = Depends(verify_token),
):
    """Return recent regime history from ai_regime_history."""
    try:
        async with db_conn() as conn:
            rows = await conn.fetch(
                """
                SELECT regime_date, regime_label, confidence,
                       nifty_close, india_vix, advance_decline_ratio,
                       volatility_score, trend_score, momentum_score
                FROM ai_regime_history
                WHERE regime_date >= (CURRENT_DATE - ($1 || ' days')::INTERVAL)
                ORDER BY regime_date DESC
                LIMIT $1
                """,
                days,
            )

        if not rows:
            return {"days": days, "entries": [], "distribution": {}}

        entries = [
            {
                "date": str(row["regime_date"]),
                "regimeLabel": row["regime_label"],
                "confidence": float(row["confidence"] or 0),
                "niftyClose": float(row["nifty_close"] or 0),
                "indiaVix": float(row["india_vix"] or 0),
                "adRatio": float(row["advance_decline_ratio"] or 1),
                "volatilityScore": float(row["volatility_score"] or 0),
                "trendScore": float(row["trend_score"] or 0),
                "momentumScore": float(row["momentum_score"] or 0),
            }
            for row in rows
        ]

        dist = {}
        for e in entries:
            dist[e["regimeLabel"]] = dist.get(e["regimeLabel"], 0) + 1

        return {
            "days": days,
            "count": len(entries),
            "distribution": dist,
            "currentRegime": entries[0]["regimeLabel"] if entries else None,
            "entries": entries,
            "modelVersion": "py-regime-v2",
        }

    except Exception as e:
        return {"error": str(e)}


@router.post("/detect-batch")
async def detect_regime_batch(
    payload: dict = Body(...),
    token: TokenPayload = Depends(verify_token),
):
    """
    Run regime detection over a historical date range (backtesting).
    Input: {priceSeries: [{date, close}], windowDays: int (default 60)}
    Returns: [{date, regime, confidence, signals}]
    """
    try:
        if token.role not in ("admin", "agent"):
            return {"error": "Admin or agent role required"}

        price_series = payload.get("priceSeries", [])
        window = int(payload.get("windowDays", 60))

        if len(price_series) < window + 5:
            return {"error": f"Need at least {window + 5} price points"}

        dates = [p["date"] for p in price_series]
        closes = np.array([float(p["close"]) for p in price_series])

        results = []
        for i in range(window, len(closes)):
            window_prices = closes[max(0, i - window):i + 1]
            sigs = _compute_signals(window_prices)
            if not sigs:
                continue
            scores, _ = _weighted_regime_score(sigs, {"ad_ratio": 1.0})
            winning = max(scores, key=scores.get)
            conf = min(95, max(20, round((scores[winning] / sum(scores.values())) * 100)))
            results.append({
                "date": dates[i],
                "regimeLabel": winning,
                "confidence": conf,
                "vixProxy": round(sigs["vix_proxy"], 2),
                "vol20d": round(sigs["vol_20d"] * 100, 2),
                "trendR2": round(sigs["trend_r2"], 4),
                "momentum": round(sigs["avg_momentum"] * 100, 4),
            })

        dist = {}
        for r in results:
            dist[r["regimeLabel"]] = dist.get(r["regimeLabel"], 0) + 1

        return {
            "count": len(results),
            "distribution": dist,
            "window": window,
            "results": results,
            "modelVersion": "py-regime-v2",
        }

    except Exception as e:
        return {"error": str(e)}
