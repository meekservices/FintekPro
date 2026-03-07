import os
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
from routes.ml_scoring import router as ml_scoring_router
from routes.regime import router as regime_router

load_dotenv()


@asynccontextmanager
async def lifespan(app: FastAPI):
    print("✅ [FintekPro Python Service] Starting up...")
    await get_pool()
    print("✅ [FintekPro Python Service] Database pool ready")
    yield
    await close_pool()
    print("⏹️  [FintekPro Python Service] Shutdown complete")


app = FastAPI(
    title="FintekPro Python Analytics Service",
    description="Pandas/SciPy/sklearn-powered quantitative analytics: MF analytics, portfolio construction (MVO), fixed income (bond analytics, treasury optimizer), risk factor models (FF3/Carhart4), ML scoring (GBR), regime detection (GMM+signals), and batch financial metrics.",
    version="3.0.0",
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


@app.get("/health")
async def health():
    return {
        "status": "ok",
        "service": "fintekpro-python",
        "version": "3.0.0",
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
        ],
    }
