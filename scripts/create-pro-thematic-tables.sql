-- ─────────────────────────────────────────────────────────────────────────────
-- FintekPro Curated PRO Themes & Dynamic Screener Engine
-- DB Migration: create-pro-thematic-tables.sql
-- Idempotent: Uses IF NOT EXISTS, DO NOTHING
-- ─────────────────────────────────────────────────────────────────────────────

-- 1. Taxonomy of Curated PRO Categories
CREATE TABLE IF NOT EXISTS pro_thematic_categories (
  slug VARCHAR(64) PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT NOT NULL,
  primary_metric_label VARCHAR(64) NOT NULL,
  secondary_metric_label VARCHAR(64),
  screening_formula TEXT,
  table_footers TEXT,
  display_order INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT TRUE,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Seed initial 12 PRO categories
INSERT INTO pro_thematic_categories (slug, name, description, primary_metric_label, secondary_metric_label, table_footers, display_order)
VALUES
  ('high-potential-upside', 'High Potential Upside', 'Stocks with higher upside potential based on consensus analyst price target', 'Price Forecast Upside %', 'Target Price', '* Average 1-year target upside potential based on institutional analyst price estimates', 1),
  ('analysts', 'Most Followed by Analysts', 'Stocks covered by the highest number of institutional research analysts', 'Analyst Coverage', 'Consensus Rating', '* Ranked by total number of active institutional research analysts', 2),
  ('top-buy-rating', 'Top Buy Rating', 'Stocks with the highest proportion of Buy or Strong Buy recommendations', 'Buy Rating %', 'Analyst Count', '* Screened for consensus Buy/Strong Buy rating across covering brokerages', 3),
  ('green-energy', 'Green Energy Leaders', 'Pure-play & transition companies in Solar, Wind, Hydro, and Clean Energy infrastructure', '1Y Thematic Return %', 'Clean Energy Segment', '* Companies leading India''s clean energy transition and power decarbonization', 4),
  ('ev-leaders', 'EV Leaders & Ecosystem', 'Electric vehicle OEMs, lithium-ion battery makers, auto ancillaries, and charging network players', '1Y Return %', 'EV Ecosystem Focus', '* Companies capitalizing on the EV transition across passenger, 2W, and commercial mobility', 5),
  ('defence-guardians', 'Defence Guardians', 'Aerospace, naval shipbuilders, missile systems, defence electronics, and indigenous manufacturers', '1Y Return %', 'Defence Sub-sector', '* Beneficiaries of India''s indigenisation (Aatmanirbhar Bharat) defence capital outlay', 6),
  ('fscore', 'High Piotroski F-Score', 'Companies with high fundamental strength, balance sheet resilience, and operating efficiency (Score 7-9)', 'Piotroski F-Score', 'Leverage Trend', '* Piotroski 9-point fundamental financial health score evaluating profitability, leverage, and efficiency', 7),
  ('turnaround', 'Turnaround Stocks', 'Stocks showing an operational pivot from previous losses into sustained net profitability', 'Turnaround PAT', 'Previous Period', '* Companies pivoting into sustainable net profitability after multi-quarter turnaround efforts', 8),
  ('profit-blasters', 'Profit Blasters', 'Stocks registering explosive multi-fold YoY profit growth over the trailing 12 months', 'YoY Profit Growth %', 'Operating Margin', '* Companies registering explosive multi-fold YoY profit growth over the trailing 12 months', 9),
  ('top-deals', 'Top Deal Makers', 'Top stocks by deal value in institutional bulk and block deals on NSE/BSE', 'Deal Value (₹ Cr)', 'Deal Direction', '* High-conviction bulk/block transactions executed on NSE/BSE by FIIs, DIIs and promoters', 10),
  ('turning-bullish', 'Turning Bullish', 'Stocks with a recent technical momentum shift to Bullish trend (50/200 DMA, RSI breakout)', 'Technical Trigger', 'Day Change %', '* Technical screening based on 50/200 EMA Golden Cross, RSI > 55, and momentum confirmation', 11),
  ('turning-bearish', 'Turning Bearish', 'Stocks with a recent technical breakdown or bearish trend shift below key moving averages', 'Technical Breakdown', 'Day Decline %', '* Technical screening based on breakdown below 200 EMA, RSI < 40, and Death Cross indicators', 12)
ON CONFLICT (slug) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  primary_metric_label = EXCLUDED.primary_metric_label,
  secondary_metric_label = EXCLUDED.secondary_metric_label,
  table_footers = EXCLUDED.table_footers,
  display_order = EXCLUDED.display_order,
  updated_at = CURRENT_TIMESTAMP;

-- 2. Relational Thematic Assignments
CREATE TABLE IF NOT EXISTS stock_thematic_assignments (
  id VARCHAR(64) PRIMARY KEY DEFAULT gen_random_uuid(),
  category_slug VARCHAR(64) NOT NULL REFERENCES pro_thematic_categories(slug) ON DELETE CASCADE,
  symbol VARCHAR(30) NOT NULL,
  isin VARCHAR(20),
  theme_badge VARCHAR(48),
  revenue_exposure_percent DECIMAL(5, 2),
  thesis_summary TEXT,
  assigned_by VARCHAR(32) DEFAULT 'system_screener',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_stock_thematic_lookup ON stock_thematic_assignments (category_slug, symbol);
CREATE UNIQUE INDEX IF NOT EXISTS uq_theme_stock_slug_symbol ON stock_thematic_assignments (category_slug, symbol);

-- 3. Quarterly Financials
CREATE TABLE IF NOT EXISTS stock_quarterly_financials (
  id SERIAL PRIMARY KEY,
  symbol VARCHAR(30) NOT NULL,
  isin VARCHAR(20),
  quarter_end DATE NOT NULL,
  quarter_label VARCHAR(16) NOT NULL,
  revenue_cr DECIMAL(12, 2),
  ebitda_cr DECIMAL(12, 2),
  ebitda_margin_percent DECIMAL(6, 2),
  net_profit_cr DECIMAL(12, 2),
  net_margin_percent DECIMAL(6, 2),
  prev_quarter_pat_cr DECIMAL(12, 2),
  prev_year_pat_cr DECIMAL(12, 2),
  pat_growth_yoy_percent DECIMAL(10, 2),
  is_loss_to_profit_turnaround BOOLEAN DEFAULT FALSE,
  filing_date TIMESTAMP,
  source VARCHAR(32) DEFAULT 'bse_nse_filing'
);

CREATE INDEX IF NOT EXISTS idx_quarterly_symbol_quarter ON stock_quarterly_financials (symbol, quarter_end);
CREATE INDEX IF NOT EXISTS idx_quarterly_turnaround ON stock_quarterly_financials (is_loss_to_profit_turnaround);
CREATE INDEX IF NOT EXISTS idx_quarterly_pat_growth ON stock_quarterly_financials (pat_growth_yoy_percent);

-- 4. Market Bulk and Block Deals
CREATE TABLE IF NOT EXISTS market_bulk_block_deals (
  id VARCHAR(64) PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_date DATE NOT NULL,
  symbol VARCHAR(30) NOT NULL,
  isin VARCHAR(20),
  exchange VARCHAR(10) DEFAULT 'NSE',
  deal_type VARCHAR(16) NOT NULL,
  transaction_type VARCHAR(10) NOT NULL,
  client_name TEXT NOT NULL,
  quantity DECIMAL(15, 0) NOT NULL,
  trade_price DECIMAL(12, 2) NOT NULL,
  deal_value_cr DECIMAL(12, 2) NOT NULL,
  reported_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_deals_date_symbol ON market_bulk_block_deals (deal_date, symbol);
CREATE INDEX IF NOT EXISTS idx_deals_value ON market_bulk_block_deals (deal_value_cr);

-- 5. Consensus Research Analyst Estimates
CREATE TABLE IF NOT EXISTS stock_analyst_consensus (
  symbol VARCHAR(30) PRIMARY KEY,
  isin VARCHAR(20),
  total_analysts INTEGER NOT NULL,
  strong_buy_count INTEGER DEFAULT 0,
  buy_count INTEGER DEFAULT 0,
  hold_count INTEGER DEFAULT 0,
  sell_count INTEGER DEFAULT 0,
  buy_rating_percent DECIMAL(5, 2),
  target_price_mean DECIMAL(12, 2),
  target_price_median DECIMAL(12, 2),
  last_revision_date DATE,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_analyst_total_analysts ON stock_analyst_consensus (total_analysts);
CREATE INDEX IF NOT EXISTS idx_analyst_buy_rating_pct ON stock_analyst_consensus (buy_rating_percent);

-- 6. Technical Signals Engine
CREATE TABLE IF NOT EXISTS stock_technical_signals (
  symbol VARCHAR(30) PRIMARY KEY,
  rsi_14 DECIMAL(6, 2),
  dma_20 DECIMAL(12, 2),
  dma_50 DECIMAL(12, 2),
  dma_200 DECIMAL(12, 2),
  macd_histogram DECIMAL(8, 4),
  signal_type VARCHAR(32),
  trend_direction VARCHAR(16),
  calculated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_tech_signal_trend ON stock_technical_signals (trend_direction);
CREATE INDEX IF NOT EXISTS idx_tech_signal_type ON stock_technical_signals (signal_type);

-- 7. Materialized Dynamic Screener Constituents Cache
CREATE TABLE IF NOT EXISTS pro_thematic_constituents (
  id VARCHAR(64) PRIMARY KEY DEFAULT gen_random_uuid(),
  category_slug VARCHAR(64) NOT NULL REFERENCES pro_thematic_categories(slug) ON DELETE CASCADE,
  symbol VARCHAR(30) NOT NULL,
  isin VARCHAR(20),
  company_name TEXT NOT NULL,
  sector VARCHAR(100),
  market_cap_category VARCHAR(32),
  rank INTEGER NOT NULL,
  primary_metric_label VARCHAR(64) NOT NULL,
  primary_metric_value VARCHAR(64) NOT NULL,
  secondary_metric_label VARCHAR(64),
  secondary_metric_value VARCHAR(64),
  target_price DECIMAL(12, 2),
  upside_percent DECIMAL(8, 2),
  f_score INTEGER,
  theme_badge VARCHAR(48),
  technical_signal VARCHAR(48),
  engine_version VARCHAR(32) DEFAULT 'pro-screener@2.0.0',
  calculation_timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_pro_constituents_slug_rank ON pro_thematic_constituents (category_slug, rank);
CREATE UNIQUE INDEX IF NOT EXISTS uq_pro_constituents_slug_symbol ON pro_thematic_constituents (category_slug, symbol);
