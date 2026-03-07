"""
AI ML Scoring Engine — scikit-learn GradientBoostingRegressor
py-sklearn-v1

Replaces the TypeScript Decision Stump Ensemble with:
  - sklearn GradientBoostingRegressor with cross-validated hyperparameters
  - Per-asset-class models with in-memory caching (1-hour TTL)
  - Feature importance + SHAP-style contribution decomposition
  - Regime-conditioned scoring overlay

Endpoints:
  POST /api/ml/train        — train/retrain model for an asset class from DB
  POST /api/ml/score        — score a list of assets
  GET  /api/ml/model-info   — cached model metadata + feature importances
  POST /api/ml/cross-validate — k-fold CV report
"""

from fastapi import APIRouter, Depends, Body, Query
from auth import verify_token, TokenPayload
from database import db_conn
import numpy as np
import pandas as pd
from sklearn.ensemble import GradientBoostingRegressor, RandomForestRegressor
from sklearn.preprocessing import StandardScaler
from sklearn.model_selection import KFold, cross_val_score
from sklearn.metrics import r2_score, mean_squared_error
from sklearn.pipeline import Pipeline
import time
import json
from typing import List, Optional

router = APIRouter(prefix="/api/ml", tags=["ml-scoring"])

FEATURE_KEYS = ["pe", "returns1y", "returns3y", "volatility", "sharpeRatio", "yield", "confidenceScore"]
ASSET_CLASSES = ["listed_stocks", "mutual_funds", "bonds", "unlisted", "global_stocks",
                 "etfs", "reits_invits", "fixed_deposits", "sgb"]

MODEL_CACHE: dict = {}
CACHE_TTL_S = 3600


def _cache_key(asset_class: str) -> str:
    return f"gbr_{asset_class}"


def _is_stale(key: str) -> bool:
    if key not in MODEL_CACHE:
        return True
    return (time.time() - MODEL_CACHE[key]["trained_at"]) > CACHE_TTL_S


def _impute_and_scale(df: pd.DataFrame, feature_cols: List[str],
                      scaler: Optional[StandardScaler] = None) -> tuple:
    X = df[feature_cols].copy()
    for col in feature_cols:
        X[col] = pd.to_numeric(X[col], errors="coerce")
    means = X.mean()
    X = X.fillna(means)
    if scaler is None:
        scaler = StandardScaler()
        X_scaled = scaler.fit_transform(X)
    else:
        X_scaled = scaler.transform(X)
    return X_scaled, scaler, means.to_dict()


def _feature_contributions(model: GradientBoostingRegressor,
                            scaler: StandardScaler,
                            x_raw: pd.Series,
                            feature_cols: List[str],
                            means: dict) -> dict:
    """
    Approximate SHAP-like contribution: iterate through feature importances
    and multiply by signed deviation from mean (scaled). Quick but not exact SHAP.
    """
    x_filled = {f: float(x_raw.get(f, means.get(f, 0)) or means.get(f, 0)) for f in feature_cols}
    x_arr = np.array([x_filled[f] for f in feature_cols]).reshape(1, -1)
    x_scaled = scaler.transform(x_arr)[0]

    base_pred = float(model.predict(x_arr)[0])
    contributions = {}
    for i, feat in enumerate(feature_cols):
        x_mod = x_arr.copy()
        x_mod[0, i] = scaler.mean_[i]
        ablated = float(model.predict(x_mod)[0])
        contributions[feat] = round(base_pred - ablated, 6)

    return contributions


@router.post("/train")
async def train_model(
    payload: dict = Body(...),
    token: TokenPayload = Depends(verify_token),
):
    """
    Train / retrain GradientBoostingRegressor for an asset class.
    Reads completed daily_picks from DB as training data.

    Input:
      assetClass:     str   (default 'all')
      maxSamples:     int   (default 5000)
      nEstimators:    int   (default 200)
      maxDepth:       int   (default 4)
      learningRate:   float (default 0.05)
      nFolds:         int   (default 5)
      targetDays:     int   (return horizon days, informational)
    """
    if token.role not in ("admin", "agent"):
        return {"error": "Admin or agent role required"}

    try:
        asset_class = payload.get("assetClass", "all")
        max_samples = int(payload.get("maxSamples", 5000))
        n_estimators = int(payload.get("nEstimators", 200))
        max_depth = int(payload.get("maxDepth", 4))
        learning_rate = float(payload.get("learningRate", 0.05))
        n_folds = int(payload.get("nFolds", 5))

        async with db_conn() as conn:
            rows = await conn.fetch(
                """
                SELECT category, return_pct, confidence_score, key_metrics
                FROM daily_picks
                WHERE status IN ('target_hit', 'stoploss_hit', 'expired')
                  AND return_pct IS NOT NULL
                  AND ($1 = 'all' OR category = $1)
                ORDER BY reco_date DESC
                LIMIT $2
                """,
                asset_class, max_samples,
            )

        if not rows or len(rows) < 20:
            return {
                "error": f"Insufficient training data: {len(rows) if rows else 0} samples (need ≥ 20)",
                "tip": "Run more daily picks to completion before training",
            }

        records = []
        for row in rows:
            try:
                metrics = dict(row["key_metrics"]) if row["key_metrics"] else {}
                feat = {}
                for k in FEATURE_KEYS:
                    v = metrics.get(k)
                    if v is not None and not (isinstance(v, float) and np.isnan(v)):
                        feat[k] = float(v)
                if row["confidence_score"] is not None:
                    feat["confidenceScore"] = float(row["confidence_score"])
                if len(feat) < 2:
                    continue
                feat["_target"] = float(row["return_pct"])
                feat["_category"] = str(row["category"])
                records.append(feat)
            except Exception:
                continue

        if len(records) < 20:
            return {"error": f"Only {len(records)} usable samples after feature extraction (need ≥ 20)"}

        df = pd.DataFrame(records)
        available_features = [f for f in FEATURE_KEYS if f in df.columns and df[f].notna().sum() > 5]
        if not available_features:
            return {"error": "No usable features found in training data"}

        y = df["_target"].values
        X_scaled, scaler, means = _impute_and_scale(df, available_features)

        model = GradientBoostingRegressor(
            n_estimators=n_estimators,
            max_depth=max_depth,
            learning_rate=learning_rate,
            subsample=0.8,
            random_state=42,
            validation_fraction=0.1,
            n_iter_no_change=20,
            tol=1e-4,
        )

        kf = KFold(n_splits=min(n_folds, len(records) // 5), shuffle=True, random_state=42)
        cv_r2 = cross_val_score(model, X_scaled, y, cv=kf, scoring="r2")
        cv_rmse = np.sqrt(-cross_val_score(model, X_scaled, y, cv=kf, scoring="neg_mean_squared_error"))

        model.fit(X_scaled, y)

        y_pred = model.predict(X_scaled)
        train_r2 = float(r2_score(y, y_pred))
        train_rmse = float(np.sqrt(mean_squared_error(y, y_pred)))
        directional_acc = float(np.mean(np.sign(y_pred) == np.sign(y)))

        importance_dict = {f: round(float(imp), 6)
                           for f, imp in zip(available_features, model.feature_importances_)}

        cache_entry = {
            "model": model,
            "scaler": scaler,
            "feature_cols": available_features,
            "feature_means": means,
            "asset_class": asset_class,
            "trained_at": time.time(),
            "metadata": {
                "assetClass": asset_class,
                "sampleSize": len(records),
                "features": available_features,
                "nEstimators": int(model.n_estimators_),
                "maxDepth": max_depth,
                "learningRate": learning_rate,
                "trainR2": round(train_r2, 4),
                "trainRmse": round(train_rmse, 4),
                "cvR2Mean": round(float(cv_r2.mean()), 4),
                "cvR2Std": round(float(cv_r2.std()), 4),
                "cvRmseMean": round(float(cv_rmse.mean()), 4),
                "directionalAccuracy": round(directional_acc, 4),
                "featureImportances": importance_dict,
                "modelVersion": "py-sklearn-v1",
                "trainedAt": pd.Timestamp.now().isoformat(),
            },
        }
        MODEL_CACHE[_cache_key(asset_class)] = cache_entry

        return {
            "success": True,
            "assetClass": asset_class,
            "sampleSize": len(records),
            "features": available_features,
            "trainR2": round(train_r2, 4),
            "trainRmse": round(train_rmse, 4),
            "cvR2": {"mean": round(float(cv_r2.mean()), 4), "std": round(float(cv_r2.std()), 4)},
            "cvRmse": {"mean": round(float(cv_rmse.mean()), 4)},
            "directionalAccuracy": round(directional_acc, 4),
            "featureImportances": importance_dict,
            "nEstimatorsActual": int(model.n_estimators_),
            "modelVersion": "py-sklearn-v1",
        }

    except Exception as e:
        return {"error": str(e)}


@router.post("/score")
async def score_assets(
    payload: dict = Body(...),
    token: TokenPayload = Depends(verify_token),
):
    """
    Score assets using cached GBR model.

    Input:
      assetClass: str
      assets: [{id, pe, returns1y, returns3y, volatility, sharpeRatio, yield, confidenceScore}]
      regime: str   (optional — 'bull'|'bear'|'sideways'|'high_vol' — applies confidence modifier)

    Returns: scored assets with predictedReturn, confidence, featureContributions.
    """
    try:
        asset_class = payload.get("assetClass", "all")
        assets = payload.get("assets", [])
        regime = payload.get("regime", "sideways")

        if not assets:
            return {"error": "Provide assets list"}

        key = _cache_key(asset_class)
        if key not in MODEL_CACHE:
            key = _cache_key("all")
        if key not in MODEL_CACHE:
            return {
                "error": "No trained model found. Call POST /api/ml/train first.",
                "assetClass": asset_class,
            }

        entry = MODEL_CACHE[key]
        model = entry["model"]
        scaler = entry["scaler"]
        feature_cols = entry["feature_cols"]
        means = entry["feature_means"]

        df = pd.DataFrame(assets)
        asset_ids = df.get("id", pd.Series(range(len(df)))).tolist() if "id" in df.columns else list(range(len(df)))

        X_scaled, _, _ = _impute_and_scale(df, feature_cols, scaler=scaler)
        predictions = model.predict(X_scaled)

        regime_conf_mod = {"bull": 0, "bear": -10, "sideways": -5, "high_vol": -15}.get(regime, 0)

        results = []
        for i, (asset_id, pred) in enumerate(zip(asset_ids, predictions)):
            feat_row = df.iloc[i]
            contributions = _feature_contributions(model, scaler, feat_row, feature_cols, means)

            r2 = float(entry["metadata"].get("cvR2Mean", 0))
            pred_magnitude = abs(float(pred))
            confidence = min(95, max(10, round(
                30 + r2 * 40 + min(pred_magnitude * 200, 25) + regime_conf_mod
            )))

            results.append({
                "id": asset_id,
                "predictedReturn": round(float(pred), 4),
                "confidence": confidence,
                "featureContributions": contributions,
                "regime": regime,
            })

        results.sort(key=lambda x: x["predictedReturn"], reverse=True)

        return {
            "assetClass": asset_class,
            "scored": len(results),
            "regime": regime,
            "modelVersion": "py-sklearn-v1",
            "cachedModelR2": entry["metadata"].get("cvR2Mean"),
            "results": results,
        }

    except Exception as e:
        return {"error": str(e)}


@router.get("/model-info")
async def model_info(
    assetClass: str = Query("all"),
    token: TokenPayload = Depends(verify_token),
):
    """Return metadata for the cached model for an asset class."""
    key = _cache_key(assetClass)
    if key not in MODEL_CACHE:
        return {"error": "No model cached. Call POST /api/ml/train first.", "assetClass": assetClass}

    entry = MODEL_CACHE[key]
    age_minutes = round((time.time() - entry["trained_at"]) / 60, 1)
    return {
        "assetClass": assetClass,
        "cacheAgeMinutes": age_minutes,
        "stale": _is_stale(key),
        **entry["metadata"],
    }


@router.post("/cross-validate")
async def cross_validate(
    payload: dict = Body(...),
    token: TokenPayload = Depends(verify_token),
):
    """
    Run k-fold cross-validation and return detailed per-fold metrics.
    Same data loading as /train but returns fold-level breakdown.
    """
    if token.role not in ("admin", "agent"):
        return {"error": "Admin or agent role required"}

    try:
        asset_class = payload.get("assetClass", "all")
        n_folds = int(payload.get("nFolds", 5))

        async with db_conn() as conn:
            rows = await conn.fetch(
                """
                SELECT category, return_pct, confidence_score, key_metrics
                FROM daily_picks
                WHERE status IN ('target_hit', 'stoploss_hit', 'expired')
                  AND return_pct IS NOT NULL
                  AND ($1 = 'all' OR category = $1)
                ORDER BY reco_date DESC
                LIMIT 5000
                """,
                asset_class,
            )

        if not rows or len(rows) < 20:
            return {"error": f"Insufficient data: {len(rows) if rows else 0} samples"}

        records = []
        for row in rows:
            try:
                metrics = dict(row["key_metrics"]) if row["key_metrics"] else {}
                feat = {k: float(metrics[k]) for k in FEATURE_KEYS if k in metrics and metrics[k] is not None}
                if row["confidence_score"] is not None:
                    feat["confidenceScore"] = float(row["confidence_score"])
                if len(feat) < 2:
                    continue
                feat["_target"] = float(row["return_pct"])
                records.append(feat)
            except Exception:
                continue

        df = pd.DataFrame(records)
        available_features = [f for f in FEATURE_KEYS if f in df.columns and df[f].notna().sum() > 5]
        y = df["_target"].values
        X_scaled, _, _ = _impute_and_scale(df, available_features)

        model = GradientBoostingRegressor(n_estimators=200, max_depth=4, learning_rate=0.05,
                                          subsample=0.8, random_state=42)

        kf = KFold(n_splits=min(n_folds, max(2, len(records) // 5)), shuffle=True, random_state=42)
        fold_results = []
        for fold_i, (train_idx, test_idx) in enumerate(kf.split(X_scaled)):
            m = GradientBoostingRegressor(n_estimators=200, max_depth=4, learning_rate=0.05,
                                          subsample=0.8, random_state=42)
            m.fit(X_scaled[train_idx], y[train_idx])
            y_pred = m.predict(X_scaled[test_idx])
            fold_r2 = float(r2_score(y[test_idx], y_pred))
            fold_rmse = float(np.sqrt(mean_squared_error(y[test_idx], y_pred)))
            fold_dir = float(np.mean(np.sign(y_pred) == np.sign(y[test_idx])))
            fold_results.append({
                "fold": fold_i + 1,
                "trainSize": len(train_idx),
                "testSize": len(test_idx),
                "r2": round(fold_r2, 4),
                "rmse": round(fold_rmse, 4),
                "directionalAccuracy": round(fold_dir, 4),
            })

        avg_r2 = float(np.mean([f["r2"] for f in fold_results]))
        avg_rmse = float(np.mean([f["rmse"] for f in fold_results]))
        avg_da = float(np.mean([f["directionalAccuracy"] for f in fold_results]))

        return {
            "assetClass": asset_class,
            "totalSamples": len(records),
            "features": available_features,
            "nFolds": len(fold_results),
            "summary": {
                "avgR2": round(avg_r2, 4),
                "avgRmse": round(avg_rmse, 4),
                "avgDirectionalAccuracy": round(avg_da, 4),
            },
            "folds": fold_results,
            "modelVersion": "py-sklearn-v1",
        }

    except Exception as e:
        return {"error": str(e)}
