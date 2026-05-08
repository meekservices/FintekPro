import os
import asyncpg
from contextlib import asynccontextmanager
from typing import AsyncGenerator, Optional
from urllib.parse import urlparse

_pool: Optional[asyncpg.Pool] = None


def _mask_dsn(dsn: str) -> str:
    """Return DSN with password replaced by *** for safe logging."""
    try:
        parsed = urlparse(dsn)
        if parsed.password:
            return dsn.replace(parsed.password, "***")
        return dsn
    except Exception:
        return "(unparseable DSN)"


async def get_pool() -> asyncpg.Pool:
    global _pool
    if _pool is None:
        dsn = os.getenv("PRODUCTION_DATABASE_URL") or os.getenv("DATABASE_URL")
        if not dsn:
            # Absolute fallback if no env vars are present
            dsn = "postgresql://postgres:Kamini@321@/fintekpro?host=/cloudsql/fintekpro:asia-south1:fintekpro-db"

        print(f"[DB] Connecting to: {_mask_dsn(dsn)}")

        kwargs = {"min_size": 2, "max_size": 10, "command_timeout": 30}

        # Check for GCP Unix Socket
        cloud_sql_path = '/cloudsql/fintekpro:asia-south1:fintekpro-db'
        
        parsed = urlparse(dsn)
        user = parsed.username or 'postgres'
        password = parsed.password or 'Kamini@321'
        database = parsed.path.lstrip('/') or 'fintekpro'
        
        # Correction for common misconfigurations
        if user == 'fintekpro_user' and not parsed.password:
            user = 'postgres'
            password = 'Kamini@321'
        if database == 'fintekpro_db':
            database = 'fintekpro'

        if os.path.exists(cloud_sql_path):
            print(f"[DB] Cloud SQL Unix socket detected at {cloud_sql_path}")
            kwargs["host"] = cloud_sql_path
            kwargs["user"] = user
            kwargs["password"] = password
            kwargs["database"] = database
            _pool = await asyncpg.create_pool(**kwargs)
        else:
            print("[DB] No Unix socket found — connecting via TCP (proxy or direct)")
            # Reconstruct DSN if needed
            if not parsed.hostname and not parsed.netloc:
                dsn = f"postgresql://{user}:{password}@localhost:5432/{database}"
            _pool = await asyncpg.create_pool(dsn, **kwargs)


        # Verify the connection is actually usable
        async with _pool.acquire() as conn:
            await conn.fetchval("SELECT 1")
        print("✅ [DB] Connection verified successfully")

    return _pool


async def close_pool():
    global _pool
    if _pool:
        await _pool.close()
        _pool = None


@asynccontextmanager
async def db_conn() -> AsyncGenerator[asyncpg.Connection, None]:
    pool = await get_pool()
    async with pool.acquire() as conn:
        yield conn
