-- Phase 5: New Screener Ratio Columns
-- Run once against the target DB to add the three new computed columns
-- Safe to re-run: all DDL uses IF NOT EXISTS guards

-- 1. Magic Formula Rank (Greenblatt: combined ROIC + Earnings Yield rank)
ALTER TABLE screener_derived_metrics
  ADD COLUMN IF NOT EXISTS magic_formula_rank INTEGER;

-- 2. Revenue CAGR 3Y (annualised 3-year revenue growth from screener_growth_metrics)
ALTER TABLE screener_derived_metrics
  ADD COLUMN IF NOT EXISTS revenue_cagr_3y NUMERIC(10, 4);

-- 3. EPS CAGR 3Y (annualised 3-year diluted EPS growth)
ALTER TABLE screener_derived_metrics
  ADD COLUMN IF NOT EXISTS eps_cagr_3y NUMERIC(10, 4);

-- Indexes for sort/filter performance
CREATE INDEX IF NOT EXISTS idx_screener_derived_magic_formula
  ON screener_derived_metrics (magic_formula_rank);

CREATE INDEX IF NOT EXISTS idx_screener_derived_rev_cagr
  ON screener_derived_metrics (revenue_cagr_3y);

CREATE INDEX IF NOT EXISTS idx_screener_derived_eps_cagr
  ON screener_derived_metrics (eps_cagr_3y);
