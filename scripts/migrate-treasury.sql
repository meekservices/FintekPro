-- Treasury Domain Schema Migration
-- Run this in Cloud SQL Studio for the 'fintekpro' database

CREATE TABLE IF NOT EXISTS treasury_entities (
    id VARCHAR(255) PRIMARY KEY,
    tenant_id VARCHAR(255) NOT NULL,
    name VARCHAR(255) NOT NULL,
    type VARCHAR(50) NOT NULL, -- subsidiary, parent, holding
    tax_id VARCHAR(100),
    status VARCHAR(20) DEFAULT 'active',
    config JSONB DEFAULT '{}',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS treasury_accounts (
    id VARCHAR(255) PRIMARY KEY,
    entity_id VARCHAR(255) REFERENCES treasury_entities(id),
    bank_name VARCHAR(255) NOT NULL,
    account_name VARCHAR(255),
    account_number VARCHAR(100) NOT NULL,
    account_type VARCHAR(50), -- current, savings, overdraft
    currency VARCHAR(10) DEFAULT 'INR',
    provider VARCHAR(50), -- razorpayx, cashfree, decentro, setu
    provider_account_id VARCHAR(255),
    status VARCHAR(20) DEFAULT 'active',
    balance_last_sync TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS treasury_positions (
    id VARCHAR(255) PRIMARY KEY,
    account_id VARCHAR(255) REFERENCES treasury_accounts(id),
    entity_id VARCHAR(255) REFERENCES treasury_entities(id),
    available_balance DECIMAL(20, 2) DEFAULT 0,
    ledger_balance DECIMAL(20, 2) DEFAULT 0,
    currency VARCHAR(10) DEFAULT 'INR',
    last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS liquidity_snapshots (
    id VARCHAR(255) PRIMARY KEY,
    entity_id VARCHAR(255) REFERENCES treasury_entities(id),
    total_liquidity DECIMAL(20, 2) NOT NULL,
    currency VARCHAR(10) DEFAULT 'INR',
    breakdown JSONB NOT NULL, -- { bank_name: amount }
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS cash_flows (
    id VARCHAR(255) PRIMARY KEY,
    entity_id VARCHAR(255) REFERENCES treasury_entities(id),
    account_id VARCHAR(255) REFERENCES treasury_accounts(id),
    type VARCHAR(20) NOT NULL, -- inflow, outflow
    category VARCHAR(100), -- operations, investment, financing
    amount DECIMAL(20, 2) NOT NULL,
    currency VARCHAR(10) DEFAULT 'INR',
    transaction_date DATE NOT NULL,
    description TEXT,
    metadata JSONB,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS approval_requests (
    id VARCHAR(255) PRIMARY KEY,
    entity_id VARCHAR(255) REFERENCES treasury_entities(id),
    resource_type VARCHAR(50) NOT NULL,
    resource_id VARCHAR(255),
    data JSONB,
    status VARCHAR(20) DEFAULT 'pending',
    required_approvals JSONB,
    approvals_received JSONB DEFAULT '[]',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
