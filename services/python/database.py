import os
import asyncpg
from contextlib import asynccontextmanager
from typing import AsyncGenerator

_pool: asyncpg.Pool | None = None


async def get_pool() -> asyncpg.Pool:
    global _pool
    if _pool is None:
        dsn = os.getenv("PRODUCTION_DATABASE_URL") or os.getenv("DATABASE_URL")
        if not dsn:
            raise RuntimeError("PRODUCTION_DATABASE_URL or DATABASE_URL must be set")
        _pool = await asyncpg.create_pool(dsn, min_size=2, max_size=10, command_timeout=30)
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
