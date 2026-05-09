-- Migration to ensure treasury tables exist and have proper permissions
CREATE TABLE IF NOT EXISTS treasury_accounts (
    id SERIAL PRIMARY KEY,
    entity_id TEXT NOT NULL,
    bank_name TEXT NOT NULL,
    account_name TEXT NOT NULL,
    account_number TEXT NOT NULL UNIQUE,
    ifsc_code TEXT NOT NULL,
    provider TEXT NOT NULL, -- 'razorpayx', 'cashfree', etc.
    provider_account_id TEXT,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS treasury_positions (
    id SERIAL PRIMARY KEY,
    account_id INTEGER REFERENCES treasury_accounts(id) UNIQUE,
    ledger_balance DECIMAL(18, 2) NOT NULL DEFAULT 0.00,
    available_balance DECIMAL(18, 2) NOT NULL DEFAULT 0.00,
    currency TEXT NOT NULL DEFAULT 'INR',
    last_synced_at TIMESTAMP WITH TIME ZONE,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS liquidity_snapshots (
    id SERIAL PRIMARY KEY,
    entity_id TEXT NOT NULL,
    total_liquidity DECIMAL(18, 2) NOT NULL,
    snapshot_date DATE NOT NULL,
    breakdown JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Permissions
GRANT SELECT, INSERT, UPDATE ON treasury_accounts TO postgres;
GRANT SELECT, INSERT, UPDATE ON treasury_positions TO postgres;
GRANT SELECT, INSERT, UPDATE ON liquidity_snapshots TO postgres;
GRANT SELECT ON platform_stats TO postgres;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO postgres;
