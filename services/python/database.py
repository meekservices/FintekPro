import os
import asyncpg
from contextlib import asynccontextmanager
from typing import AsyncGenerator

_pool: asyncpg.Pool | None = None


async def get_pool() -> asyncpg.Pool:
    global _pool
    if _pool is None:
        dsn = os.getenv("PRODUCTION_DATABASE_URL")
        if not dsn:
            raise RuntimeError("PRODUCTION_DATABASE_URL must be set")

        kwargs = {"min_size": 2, "max_size": 10, "command_timeout": 30}
        
        # Check for GCP Unix Socket in DSN format postgresql://user:pass@/dbname?host=/cloudsql/...
        # or checking the absolute path
        cloud_sql_path = '/cloudsql/fintekpro:asia-south1:fintekpro-db'
        if os.path.exists(cloud_sql_path):
            import urllib.parse
            parsed = urllib.parse.urlparse(dsn)
            # asyncpg requires host to be the directory of the socket, e.g. /cloudsql/...
            kwargs["host"] = cloud_sql_path
            kwargs["user"] = parsed.username
            kwargs["password"] = parsed.password
            kwargs["database"] = parsed.path.lstrip('/') or 'fintekpro'
            _pool = await asyncpg.create_pool(**kwargs)
        else:
            _pool = await asyncpg.create_pool(dsn, **kwargs)
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
