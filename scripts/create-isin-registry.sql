-- ─────────────────────────────────────────────────────────────────────────────
-- ISIN Registry (ISIN Equalizer) — DB Migration
-- Run once on production via Cloud SQL Admin or psql.
-- Idempotent: uses IF NOT EXISTS / ON CONFLICT DO NOTHING.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS isin_registry (
  -- Primary key: ISO 6166 ISIN (e.g. INF174K01RZ6, US46090E1038)
  isin                TEXT        PRIMARY KEY,

  -- Canonical identity
  canonical_name      TEXT        NOT NULL,
  instrument_type     VARCHAR(50) NOT NULL,  -- 'mutual_fund','etf','stock','bond','reit','invit','commodity_etf'
  country             VARCHAR(2)  NOT NULL DEFAULT 'IN',  -- ISO 3166-1 alpha-2
  currency            VARCHAR(3)  NOT NULL DEFAULT 'INR', -- ISO 4217
  amc                 VARCHAR(100),          -- Asset Management Company

  -- ⚠️ COMPLIANCE: amfi_code = Regular Plan–Growth ONLY (SEBI Reg 24 / ARN)
  amfi_code           INTEGER,               -- mfapi.in scheme code (Regular Growth) ← use for NAV
  amfi_code_direct    INTEGER,               -- Direct plan code — reference only, DO NOT use for returns
  sebi_category       VARCHAR(100),
  plan_type           VARCHAR(20) DEFAULT 'regular',  -- 'regular','direct','etf'
  expense_ratio       DECIMAL(5,4),

  -- Stock / ETF identifiers
  nse_symbol          VARCHAR(50),           -- NSE ticker
  bse_code            INTEGER,               -- BSE scrip code

  -- International identifiers
  cusip               VARCHAR(9),            -- US/CA
  sedol               VARCHAR(7),            -- UK/International
  bloomberg_ticker    VARCHAR(50),           -- e.g. "QQQ US Equity"
  reuters_ric         VARCHAR(50),           -- Refinitiv RIC

  -- Status
  is_active           BOOLEAN     NOT NULL DEFAULT TRUE,
  is_proxy            BOOLEAN     NOT NULL DEFAULT FALSE,  -- code maps to proxy fund
  proxy_note          TEXT,                  -- explanation when is_proxy=true
  source              VARCHAR(50) DEFAULT 'manual',  -- 'amfi','nse','manual','seed'
  notes               TEXT,

  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for fast reverse lookups
CREATE INDEX IF NOT EXISTS idx_isin_registry_amfi_code
  ON isin_registry(amfi_code) WHERE amfi_code IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_isin_registry_nse_symbol
  ON isin_registry(nse_symbol) WHERE nse_symbol IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_isin_registry_type_country
  ON isin_registry(instrument_type, country);

CREATE INDEX IF NOT EXISTS idx_isin_registry_canonical_name
  ON isin_registry(canonical_name);

-- Auto-update updated_at on every row change
CREATE OR REPLACE FUNCTION update_isin_registry_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_isin_registry_updated_at ON isin_registry;
CREATE TRIGGER trg_isin_registry_updated_at
  BEFORE UPDATE ON isin_registry
  FOR EACH ROW EXECUTE FUNCTION update_isin_registry_updated_at();

COMMENT ON TABLE isin_registry IS
  'ISIN Equalizer: maps ISO 6166 ISIN to all API identifiers for multinational instrument enrichment. ISIN is the primary key. amfi_code must be Regular Plan only (SEBI Reg 24).';
