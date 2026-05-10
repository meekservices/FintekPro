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
        dsn = os.getenv("PRODUCTION_DATABASE_URL")
        if not dsn:
            raise RuntimeError("PRODUCTION_DATABASE_URL must be set")

        print(f"[DB] Connecting to: {_mask_dsn(dsn)}")

        kwargs: dict = {"min_size": 2, "max_size": 10, "command_timeout": 30}

        # Check for GCP Cloud SQL Unix socket.
        # Socket directory format: /cloudsql/<project>:<region>:<instance>
        cloud_sql_path = "/cloudsql/fintekpro:asia-south1:fintekpro-db"
        if os.path.exists(cloud_sql_path):
            print(f"[DB] Cloud SQL Unix socket detected at {cloud_sql_path}")

            # Parse the DSN for credentials, with a safe fallback on error.
            try:
                parsed = urlparse(dsn)
                dsn_user = parsed.username
                dsn_password = parsed.password
                dsn_database = parsed.path.lstrip("/") or None
            except Exception as parse_err:
                print(f"⚠️  [DB] DSN parse error: {parse_err}. Falling back to env-var credentials.")
                dsn_user = None
                dsn_password = None
                dsn_database = None

            # asyncpg requires `host` to be the socket directory itself.
            kwargs["host"] = cloud_sql_path

            # Env-var overrides for the Cloud SQL socket path.
            # Set these in your .env / Cloud Run environment — never hardcode credentials.
            #   DB_FALLBACK_USER     — superuser to connect with (default: postgres)
            #   DB_FALLBACK_PASSWORD — corresponding password
            #   DB_FALLBACK_DBNAME   — database name (default: fintekpro)
            fallback_user = os.getenv("DB_FALLBACK_USER", "postgres")
            fallback_password = os.getenv("DB_FALLBACK_PASSWORD", "")
            fallback_dbname = os.getenv("DB_FALLBACK_DBNAME", "fintekpro")

            # Prefer DSN-extracted values; use env-var fallback when DSN contains
            # placeholder service-account names that are invalid for socket auth.
            resolved_user = (
                dsn_user if dsn_user and dsn_user != "fintekpro_user" else fallback_user
            )
            resolved_password = dsn_password if dsn_password else fallback_password
            resolved_database = (
                dsn_database
                if dsn_database and dsn_database != "fintekpro_db"
                else fallback_dbname
            )

            if resolved_user != dsn_user or resolved_database != dsn_database:
                print(
                    f"[DB] ℹ️  Socket auth — resolved user='{resolved_user}', "
                    f"db='{resolved_database}'"
                )

            kwargs["user"] = resolved_user
            kwargs["password"] = resolved_password
            kwargs["database"] = resolved_database
            _pool = await asyncpg.create_pool(**kwargs)
        else:
            print("[DB] No Unix socket found — connecting via TCP (proxy or direct)")
            _pool = await asyncpg.create_pool(dsn, **kwargs)

        # Verify the connection is actually usable before returning.
        async with _pool.acquire() as conn:
            await conn.fetchval("SELECT 1")
        print("✅ [DB] Connection verified successfully")

    return _pool


async def close_pool() -> None:
    global _pool
    if _pool is not None:
        await _pool.close()
        _pool = None


@asynccontextmanager
async def db_conn() -> AsyncGenerator[asyncpg.Connection, None]:
    pool = await get_pool()
    async with pool.acquire() as conn:
        yield conn
