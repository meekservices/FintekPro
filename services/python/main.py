import os
import asyncio
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
from routes.price_returns import router as price_returns_router
from routes.corporate_actions import router as corporate_actions_router
from routes.data_lake import router as data_lake_router
from routes.market_data import router as market_data_router
from routes.derivatives import router as derivatives_router

load_dotenv()

# Track whether the ML model is warm (used by /health)
_model_ready = False


async def _auto_train_ml():
    """
    Boot-time auto-training: warm the ML model cache so the first
    /api/ml/score call doesn't fail with 'No trained model found'.
    Non-blocking — failures are logged but never crash the server.
    """
    global _model_ready
    try:
        from routes.ml_scoring import train_model_internal
        print("[MLAutoTrain] Starting boot-time model training...")
        result = await train_model_internal(asset_class="all", max_samples=5000)
        if "error" in result:
            print(f"⚠️  [MLAutoTrain] Training returned error: {result['error']}")
            if "Insufficient" in str(result.get("error", "")):
                print("[MLAutoTrain] Not enough completed picks yet — model will be trained once data is available")
        else:
            _model_ready = True
            print(f"✅ [MLAutoTrain] Model trained successfully — "
                  f"R²={result.get('trainR2', '?')}, "
                  f"samples={result.get('sampleSize', '?')}")
    except Exception as e:
        print(f"⚠️  [MLAutoTrain] Auto-training failed (non-fatal): {e}")


@asynccontextmanager
async def lifespan(app: FastAPI):
    print("✅ [FintekPro Python Service] Starting up...")
    try:
        await get_pool()
        print("✅ [FintekPro Python Service] Database pool ready")

        # Auto-train ML model in a background task so it doesn't block startup
        asyncio.create_task(_auto_train_ml())
    except Exception as db_err:
        print(f"⚠️  [FintekPro Python Service] Database pool unavailable at startup: {db_err}")
        print("⚠️  [FintekPro Python Service] Service will start — DB connections retried per request")
    yield
    await close_pool()
    print("⏹️  [FintekPro Python Service] Shutdown complete")


app = FastAPI(
    title="FintekPro Python Analytics Service",
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
app.include_router(ml_scoring_router)   # ← this is the line that was missing
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
        "model_ready": _model_ready,
    }
