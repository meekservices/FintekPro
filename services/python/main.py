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
    description="Pandas/SciPy-powered portfolio analytics, capital gains (FIFO), XIRR, rolling returns, MF analytics, forecasting, and portfolio operations.",
    version="2.0.0",
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


@app.get("/health")
async def health():
    return {
        "status": "ok",
        "service": "fintekpro-python",
        "version": "2.0.0",
        "capabilities": [
            # Portfolio analytics
            "portfolio-summary",
            "capital-gains-fifo",
            "amc-breakdown",
            # Quant
            "xirr",
            "rolling-returns",
            "mvo-scipy-slsqp",
            "black-litterman-numpy",
            "backtest-metrics",
            "drift-predict-scipy",
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
        ],
    }
