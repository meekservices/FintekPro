import os
import asyncio
import logging
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv
from database import get_pool, close_pool
from routes.analytics import router as analytics_router
from routes.quant import router as quant_router
from routes.mf_analytics import router as mf_analytics_router
from routes.forecasting import router as forecasting_router
from routes.portfolio_ops import router as portfolio_ops_router
from routes.fixed_income import router as fixed_income_router
from routes.factor_model import router as factor_model_router
from routes.ml_scoring import router as ml_scoring_router, train_model_internal
from routes.regime import router as regime_router
from routes.price_returns import router as price_returns_router
from routes.corporate_actions import router as corporate_actions_router
from routes.data_lake import router as data_lake_router
from routes.market_data import router as market_data_router
from routes.derivatives import router as derivatives_router

load_dotenv()

# yfinance emits noisy WARNING/ERROR messages when Yahoo Finance temporarily
# rate-limits or returns empty responses (e.g. "possibly delisted", "Expecting
# value: line 1 column 1").  Our fallback chain (Google Finance JSONP, then
# Alpha Vantage, then Yahoo Node.js) already handles these gracefully, so we
# suppress the library's own log output to keep Railway logs clean.
logging.getLogger("yfinance").setLevel(logging.CRITICAL)
logging.getLogger("peewee").setLevel(logging.WARNING)


async def _auto_train_ml() -> None:
    """
    Background task: attempt to pre-train the ML scoring model at service startup.
    Runs 20 s after boot so the DB connection pool is fully warmed.
    Logs success or skips gracefully — never blocks startup or crashes the service.
    """
    await asyncio.sleep(20)
    try:
        result = await train_model_internal(asset_class="all", max_samples=5000)
        if result.get("success"):
            print(
                f"✅ [MLAutoTrain] Model ready: {result.get('sampleSize', 0)} samples | "
                f"R²={result.get('trainR2')} | directional={result.get('directionalAccuracy')}"
            )
        else:
            print(f"ℹ️  [MLAutoTrain] Training skipped at startup: {result.get('error', 'unknown reason')}"
                  " — call POST /api/ml/train once daily_picks have completed outcomes.")
    except Exception as exc:
        print(f"ℹ️  [MLAutoTrain] Non-critical startup error: {exc}")


@asynccontextmanager
async def lifespan(app: FastAPI):
    print("✅ [FintekPro Python Service] Starting up...")
    await get_pool()
    print("✅ [FintekPro Python Service] Database pool ready")
    asyncio.create_task(_auto_train_ml())
    yield
    await close_pool()
    print("⏹️  [FintekPro Python Service] Shutdown complete")


app = FastAPI(
    title="FintekPro Python Analytics Service",
    description="Pandas/SciPy/sklearn/yfinance-powered analytics: MF analytics, portfolio construction (MVO), fixed income, risk factor models, ML scoring, regime detection, batch financial metrics, and live market data (global stocks, ETFs, Indian fundamentals, market movers).",
    version="4.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["GET", "POST"],
    allow_headers=["Authorization", "Content-Type"],
)

app.include_router(analytics_router)
app.include_router(quant_router)
app.include_router(mf_analytics_router)
app.include_router(forecasting_router)
app.include_router(portfolio_ops_router)
app.include_router(fixed_income_router)
app.include_router(factor_model_router)
app.include_router(ml_scoring_router)
app.include_router(regime_router)
app.include_router(price_returns_router)
app.include_router(corporate_actions_router)
app.include_router(data_lake_router)
app.include_router(market_data_router)
app.include_router(derivatives_router)


@app.get("/health")
async def health():
    return {
        "status": "ok",
        "service": "fintekpro-python",
        "version": "4.0.0",
        "capabilities": [
            # Portfolio analytics
            "portfolio-summary",
            "capital-gains-fifo",
            "amc-breakdown",
            "batch-financial-metrics",
            # Quant
            "xirr",
            "rolling-returns",
            "mvo-scipy-slsqp",
            "black-litterman-numpy",
            "backtest-metrics",
            "drift-predict-scipy",
            "asset-allocation",
            # MF analytics
            "mf-compute-metrics",
            "mf-scheme-analytics",
            "mf-monthly-series",
            "mf-bulk-compute-db",
            "mf-cross-sectional-rank",
            "mf-risk-from-monthly",
            "mf-sync-change-pct",
            "mf-derived-metrics",
            "mf-nav-backfill",
            "mf-amfi-enrich",
            "mf-monthly-pipeline",
            # Forecasting
            "return-forecast",
            "sip-simulate",
            # Portfolio ops
            "overlap-analysis",
            "portfolio-rebalance",
            # Fixed Income & Corporate Treasury
            "bond-analytics",
            "batch-bond-analytics",
            "yield-curve",
            "treasury-optimize",
            # Factor Models
            "fund-factor-regression",
            "batch-fund-factors",
            "market-factors",
            # ML Scoring
            "ml-train",
            "ml-score",
            "ml-cross-validate",
            # Regime Detection
            "regime-detect",
            "regime-history",
            "regime-detect-batch",
            # Corporate Actions
            "corporate-actions-sync",
            "corporate-actions-pending",
            "corporate-actions-apply",
            "corporate-actions-list",
            "corporate-actions-history",
            # Data Lake
            "data-lake-store-bhavcopy",
            "data-lake-store-amfi-nav",
            "data-lake-list",
            "data-lake-retrieve",
            # Market Data (yfinance)
            "market-quotes-batch",
            "market-fundamentals-indian",
            "market-movers-nifty50",
        ],
    }
