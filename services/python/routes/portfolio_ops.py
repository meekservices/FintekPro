"""
FintekPro Python Analytics — Overlap Intelligence + Rebalancing Engine
=======================================================================
Endpoints
---------
POST /api/portfolio/overlap-analysis
    Look-through fund overlap analysis using numpy cosine similarity.
POST /api/portfolio/rebalance
    Drift analysis + trade generation with scipy.optimize for optimal allocation.
"""
from fastapi import APIRouter, Depends, Body
from auth import verify_token, TokenPayload
import numpy as np
from scipy.optimize import minimize
from typing import Optional, Dict, Any, List

router = APIRouter(prefix="/api/portfolio", tags=["portfolio-ops"])

RF_ANNUAL = 0.0715


# ---------------------------------------------------------------------------
# Overlap Intelligence Engine
# ---------------------------------------------------------------------------

def _cosine_similarity(a: np.ndarray, b: np.ndarray) -> float:
    na = np.linalg.norm(a)
    nb = np.linalg.norm(b)
    if na == 0 or nb == 0:
        return 0.0
    return float(np.dot(a, b) / (na * nb))


def _build_holding_vector(holdings: List[Dict], all_stocks: List[str]) -> np.ndarray:
    """Convert holdings list → weight vector aligned to all_stocks."""
    stock_idx = {s: i for i, s in enumerate(all_stocks)}
    vec = np.zeros(len(all_stocks))
    for h in holdings:
        stock = str(h.get("stock", h.get("symbol", "")))
        wt = float(h.get("weight", h.get("pct", 0))) / 100.0
        if stock in stock_idx:
            vec[stock_idx[stock]] = wt
    # Normalise to unit simplex if non-zero
    if vec.sum() > 0:
        vec = vec / vec.sum()
    return vec


@router.post("/overlap-analysis")
async def overlap_analysis(
    payload: dict = Body(...),
    token: TokenPayload = Depends(verify_token),
):
    """
    Portfolio overlap analysis.

    Input:
      funds: [
        {isin, name, weight, holdings: [{stock, weight}], sharpeRatio?, expenseRatio?}
      ]
      candidateFund?: {isin, name, holdings: [{stock, weight}]}  — optional, fund being considered
      topN: int — top N stocks to surface (default 20)
    """
    try:
        funds = payload.get("funds", [])
        candidate = payload.get("candidateFund")
        top_n = int(payload.get("topN", 20))

        if not funds:
            return {"error": "No funds provided"}

        # Collect all unique stocks across all funds
        all_stocks_set: set = set()
        for f in funds:
            for h in f.get("holdings", []):
                s = str(h.get("stock", h.get("symbol", "")))
                if s:
                    all_stocks_set.add(s)
        if candidate:
            for h in candidate.get("holdings", []):
                s = str(h.get("stock", h.get("symbol", "")))
                if s:
                    all_stocks_set.add(s)

        all_stocks = sorted(all_stocks_set)
        n_stocks = len(all_stocks)

        if n_stocks == 0:
            return {"error": "No stock holdings data provided in funds"}

        # Build weight matrix: funds × stocks
        fund_weights = np.array([float(f.get("weight", 100 / len(funds))) / 100.0 for f in funds])
        fund_weights = fund_weights / fund_weights.sum()

        holding_vecs = np.array([
            _build_holding_vector(f.get("holdings", []), all_stocks)
            for f in funds
        ])  # shape: (n_funds, n_stocks)

        # ── Portfolio-level stock exposure (look-through) ─────────────────
        portfolio_exposure = fund_weights @ holding_vecs  # (n_stocks,)

        # Top N exposures
        top_idx = np.argsort(portfolio_exposure)[::-1][:top_n]
        top_stocks = [
            {
                "stock": all_stocks[i],
                "exposurePct": round(float(portfolio_exposure[i]) * 100, 4),
                "fundsHolding": sum(1 for v in holding_vecs if v[i] > 0),
            }
            for i in top_idx if portfolio_exposure[i] > 0
        ]

        # ── Pairwise fund-level overlap (cosine similarity matrix) ────────
        n_funds = len(funds)
        sim_matrix = np.zeros((n_funds, n_funds))
        for i in range(n_funds):
            for j in range(n_funds):
                sim_matrix[i, j] = _cosine_similarity(holding_vecs[i], holding_vecs[j])

        overlap_matrix = []
        for i, fi in enumerate(funds):
            row = []
            for j, fj in enumerate(funds):
                row.append({
                    "fundA": fi.get("isin", fi.get("name", f"Fund{i}")),
                    "fundB": fj.get("isin", fj.get("name", f"Fund{j}")),
                    "overlap": round(float(sim_matrix[i, j]) * 100, 2),
                })
            overlap_matrix.append(row)

        # ── Diversification score ─────────────────────────────────────────
        score = 100.0
        # Penalty: any stock > 10% look-through
        max_exposure = float(portfolio_exposure.max()) * 100
        if max_exposure > 10:
            score -= 15
        elif max_exposure > 5:
            score -= 8

        # Penalty: average pairwise overlap > 40%
        upper_tri = sim_matrix[np.triu_indices(n_funds, k=1)]
        avg_overlap = float(upper_tri.mean()) * 100 if len(upper_tri) > 0 else 0
        if avg_overlap > 60:
            score -= 20
        elif avg_overlap > 40:
            score -= 12
        elif avg_overlap > 25:
            score -= 5

        # Penalty: too many funds (>6 = over-diversification)
        if n_funds > 6:
            score -= 5
        elif n_funds < 2:
            score -= 10

        score = max(0.0, min(100.0, score))
        grade = "Excellent" if score >= 85 else ("Good" if score >= 70 else ("Fair" if score >= 55 else "Poor"))

        # ── Replacement candidates (pair overlap > 50%) ───────────────────
        replacements = []
        for i in range(n_funds):
            for j in range(i + 1, n_funds):
                if sim_matrix[i, j] > 0.50:
                    fi, fj = funds[i], funds[j]
                    # Determine which to replace: lower Sharpe → replaced
                    sh_i = float(fi.get("sharpeRatio", 0) or 0)
                    sh_j = float(fj.get("sharpeRatio", 0) or 0)
                    er_i = float(fi.get("expenseRatio", 0) or 0)
                    er_j = float(fj.get("expenseRatio", 0) or 0)
                    replace_idx = i if sh_i < sh_j or (sh_i == sh_j and er_i > er_j) else j
                    keep_idx    = j if replace_idx == i else i
                    replacements.append({
                        "replaceFund": funds[replace_idx].get("isin", funds[replace_idx].get("name", "")),
                        "keepFund": funds[keep_idx].get("isin", funds[keep_idx].get("name", "")),
                        "overlapPct": round(float(sim_matrix[i, j]) * 100, 2),
                        "reason": "High overlap (>{:.0f}% common holdings)".format(sim_matrix[i, j] * 100),
                    })

        # ── Candidate fund evaluation ─────────────────────────────────────
        candidate_analysis = None
        if candidate:
            cand_vec = _build_holding_vector(candidate.get("holdings", []), all_stocks)
            cand_overlaps = [
                {
                    "fund": f.get("isin", f.get("name", "")),
                    "overlapPct": round(float(_cosine_similarity(cand_vec, holding_vecs[i])) * 100, 2),
                }
                for i, f in enumerate(funds)
            ]
            max_cand_overlap = max(o["overlapPct"] for o in cand_overlaps) if cand_overlaps else 0
            recommendation = "EXCLUDE" if max_cand_overlap > 60 else ("REVIEW" if max_cand_overlap > 40 else "INCLUDE")
            candidate_analysis = {
                "isin": candidate.get("isin", ""),
                "name": candidate.get("name", ""),
                "maxOverlapWithPortfolio": round(max_cand_overlap, 2),
                "overlapDetail": cand_overlaps,
                "recommendation": recommendation,
                "rationale": f"Max overlap with existing fund: {max_cand_overlap:.1f}%",
            }

        # ── Advisor talking points ────────────────────────────────────────
        talking_points = []
        if max_exposure > 10:
            top_st = top_stocks[0] if top_stocks else {}
            talking_points.append(
                f"Your portfolio has {top_st.get('exposurePct','0')}% concentrated look-through "
                f"exposure to {top_st.get('stock','a single stock')} across {top_st.get('fundsHolding',1)} funds."
            )
        if avg_overlap > 40:
            talking_points.append(
                f"Average fund-to-fund overlap is {avg_overlap:.1f}% — you may be paying multiple expense ratios for similar exposures."
            )
        if replacements:
            talking_points.append(
                f"{len(replacements)} fund pair(s) have >50% common holdings. Consider switching the lower-quality fund."
            )

        return {
            "diversificationScore": round(score, 1),
            "grade": grade,
            "portfolioStockExposure": top_stocks,
            "maxSingleStockExposure": round(max_exposure, 4),
            "avgPairwiseOverlap": round(avg_overlap, 4),
            "overlapMatrix": overlap_matrix,
            "replacementCandidates": replacements,
            "candidateFundAnalysis": candidate_analysis,
            "advisorTalkingPoints": talking_points,
            "totalFunds": n_funds,
            "totalUniqueStocks": n_stocks,
            "modelVersion": "py-overlap-v1",
        }

    except Exception as e:
        return {"error": str(e)}


# ---------------------------------------------------------------------------
# Rebalancing Engine
# ---------------------------------------------------------------------------

ASSET_VOLATILITIES = {
    "equity":       0.20,
    "debt":         0.05,
    "gold":         0.15,
    "real_estate":  0.12,
    "cash":         0.01,
    "international": 0.22,
    "alternatives": 0.18,
    "commodity":    0.20,
}

ASSET_LIMITS = {
    "equity":       (0.0, 0.80),
    "debt":         (0.0, 0.80),
    "gold":         (0.0, 0.30),
    "real_estate":  (0.0, 0.30),
    "cash":         (0.00, 0.20),
    "international":(0.0, 0.40),
    "alternatives": (0.0, 0.25),
    "commodity":    (0.0, 0.20),
}

TAX_RATES = {
    "equity":       {"stcg": 0.20, "ltcg": 0.125, "lt_months": 12},
    "debt":         {"stcg": 0.30, "ltcg": 0.20,  "lt_months": 24},
    "gold":         {"stcg": 0.30, "ltcg": 0.20,  "lt_months": 36},
    "real_estate":  {"stcg": 0.30, "ltcg": 0.20,  "lt_months": 24},
    "international":{"stcg": 0.30, "ltcg": 0.20,  "lt_months": 24},
}


def _tax_impact(asset: str, sell_value: float, gain_pct: float, holding_months: int, tax_bracket: float) -> Dict:
    tax_info = TAX_RATES.get(asset, {"stcg": tax_bracket, "ltcg": tax_bracket * 0.5, "lt_months": 12})
    gain = sell_value * gain_pct / 100.0
    if gain <= 0:
        return {"stcgTax": 0, "ltcgTax": 0, "totalTax": 0, "taxEfficiency": "High"}
    is_lt = holding_months >= tax_info["lt_months"]
    tax = gain * (tax_info["ltcg"] if is_lt else tax_info["stcg"])
    label = "High" if is_lt else ("Medium" if holding_months > 6 else "Low")
    return {
        "isLongTerm": is_lt,
        "gain": round(gain, 2),
        "stcgTax": round(tax if not is_lt else 0, 2),
        "ltcgTax": round(tax if is_lt else 0, 2),
        "totalTax": round(tax, 2),
        "taxEfficiency": label,
    }


@router.post("/rebalance")
async def rebalance_portfolio(
    payload: dict = Body(...),
    token: TokenPayload = Depends(verify_token),
):
    """
    Portfolio rebalancing engine.

    Input:
      currentAllocations  : {assetClass: pct}    e.g. {"equity": 65, "debt": 30, "gold": 5}
      targetAllocations   : {assetClass: pct}
      totalValue          : portfolio total value (₹)
      riskScore           : user risk score 1–100
      taxBracket          : user marginal tax rate % (e.g. 30)
      holdingPeriods      : {assetClass: months}  — for tax calc
      cashInflow          : new capital to deploy (₹) — optional
      cashOutflow         : withdrawal required (₹) — optional
      minTradeSize        : minimum trade size ₹ (default 1000)
      driftThreshold      : drift % to trigger rebalance (default 2.0)
      useOptimizer        : use scipy for minimum-cost allocation (default true)
    """
    try:
        current = {k: float(v) for k, v in payload.get("currentAllocations", {}).items()}
        target  = {k: float(v) for k, v in payload.get("targetAllocations", {}).items()}
        total_value     = float(payload.get("totalValue", 0))
        risk_score      = int(payload.get("riskScore", 50))
        tax_bracket_pct = float(payload.get("taxBracket", 30.0)) / 100.0
        holding_periods = {k: int(v) for k, v in payload.get("holdingPeriods", {}).items()}
        cash_inflow     = float(payload.get("cashInflow", 0))
        cash_outflow    = float(payload.get("cashOutflow", 0))
        min_trade       = float(payload.get("minTradeSize", 1000))
        drift_threshold = float(payload.get("driftThreshold", 2.0))
        use_optimizer   = bool(payload.get("useOptimizer", True))

        if not current or not target:
            return {"error": "currentAllocations and targetAllocations are required"}
        if total_value <= 0:
            return {"error": "totalValue must be > 0"}

        # Normalise to 100%
        cur_sum = sum(current.values())
        tgt_sum = sum(target.values())
        current = {k: v / cur_sum * 100 for k, v in current.items()}
        target  = {k: v / tgt_sum * 100 for k, v in target.items()}

        all_assets = sorted(set(current.keys()) | set(target.keys()))

        # ── Drift analysis ────────────────────────────────────────────────
        drift_items = []
        max_drift = 0.0
        for asset in all_assets:
            cur_pct = current.get(asset, 0)
            tgt_pct = target.get(asset, 0)
            drift   = cur_pct - tgt_pct
            drift_items.append({
                "assetClass": asset,
                "current": round(cur_pct, 2),
                "target": round(tgt_pct, 2),
                "drift": round(drift, 2),
                "driftAbs": round(abs(drift), 2),
                "direction": "overweight" if drift > 0 else ("underweight" if drift < 0 else "neutral"),
            })
            max_drift = max(max_drift, abs(drift))

        needs_rebalance = max_drift >= drift_threshold

        # Portfolio risk drift (weighted volatility change)
        risk_drift = sum(
            abs(current.get(a, 0) - target.get(a, 0)) / 100 * ASSET_VOLATILITIES.get(a, 0.15)
            for a in all_assets
        )

        # ── Urgency ───────────────────────────────────────────────────────
        if max_drift >= 10 or risk_drift > 0.03:
            urgency = "immediate"
        elif max_drift >= 5 or risk_drift > 0.015:
            urgency = "recommended"
        elif needs_rebalance:
            urgency = "optional"
        else:
            urgency = "none"

        # ── Constraint violations ─────────────────────────────────────────
        constraint_violations = []
        for asset in all_assets:
            cur_pct = current.get(asset, 0)
            lo, hi = ASSET_LIMITS.get(asset, (0, 1))
            if cur_pct / 100 > hi:
                constraint_violations.append({"asset": asset, "type": "OVER_LIMIT", "value": cur_pct, "limit": hi * 100})
            if cur_pct / 100 < lo and cur_pct > 0:
                constraint_violations.append({"asset": asset, "type": "UNDER_LIMIT", "value": cur_pct, "limit": lo * 100})

        # ── Optional: scipy minimum-cost rebalancing ──────────────────────
        adjusted_target = dict(target)
        if use_optimizer and len(all_assets) >= 3:
            n = len(all_assets)
            cur_arr = np.array([current.get(a, 0) / 100 for a in all_assets])
            tgt_arr = np.array([target.get(a, 0) / 100 for a in all_assets])
            bounds  = [ASSET_LIMITS.get(a, (0, 1)) for a in all_assets]

            def objective(w):
                return float(np.sum((w - tgt_arr) ** 2))

            constraints = [{"type": "eq", "fun": lambda w: w.sum() - 1}]
            result = minimize(objective, tgt_arr, method="SLSQP", bounds=bounds, constraints=constraints)
            if result.success:
                adjusted_target = {all_assets[i]: round(float(result.x[i]) * 100, 4) for i in range(n)}

        # ── Trade generation ──────────────────────────────────────────────
        net_value = total_value + cash_inflow - cash_outflow
        trades = []
        stcg_total = ltcg_total = 0.0

        for asset in all_assets:
            cur_pct = current.get(asset, 0)
            tgt_pct = adjusted_target.get(asset, target.get(asset, 0))
            drift   = cur_pct - tgt_pct
            if abs(drift) < 0.5:
                continue

            cur_val = total_value * cur_pct / 100
            tgt_val = net_value   * tgt_pct / 100
            trade_val = tgt_val - cur_val

            if abs(trade_val) < min_trade:
                continue

            action = "buy" if trade_val > 0 else "sell"

            # Priority scoring
            priority = int(abs(drift) * 2)
            for cv in constraint_violations:
                if cv["asset"] == asset:
                    priority += 30

            tax = {}
            if action == "sell":
                avg_gain_pct = 15.0  # default assumption
                months = holding_periods.get(asset, 13)
                tax = _tax_impact(asset, abs(trade_val), avg_gain_pct, months, tax_bracket_pct)
                stcg_total += tax.get("stcgTax", 0)
                ltcg_total += tax.get("ltcgTax", 0)

            trades.append({
                "assetClass": asset,
                "action": action,
                "currentPct": round(cur_pct, 2),
                "targetPct": round(tgt_pct, 2),
                "currentValue": round(cur_val, 2),
                "tradeValue": round(abs(trade_val), 2),
                "priority": priority,
                "taxImpact": tax,
                "rationale": f"{asset.capitalize()} is {abs(drift):.1f}% {'above' if drift>0 else 'below'} target",
            })

        trades.sort(key=lambda t: -t["priority"])

        return {
            "needsRebalance": needs_rebalance,
            "urgency": urgency,
            "maxDrift": round(max_drift, 2),
            "portfolioRiskDrift": round(risk_drift * 100, 4),
            "driftAnalysis": drift_items,
            "trades": trades,
            "taxSummary": {
                "estimatedStcg": round(stcg_total, 2),
                "estimatedLtcg": round(ltcg_total, 2),
                "totalTaxImpact": round(stcg_total + ltcg_total, 2),
            },
            "constraintViolations": constraint_violations,
            "optimizerUsed": use_optimizer,
            "adjustedTarget": adjusted_target,
            "parameters": {
                "totalValue": total_value,
                "cashInflow": cash_inflow,
                "cashOutflow": cash_outflow,
                "riskScore": risk_score,
                "driftThreshold": drift_threshold,
            },
            "modelVersion": "py-rebalance-v1",
        }

    except Exception as e:
        return {"error": str(e)}
