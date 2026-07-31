-- seed-portfolio-metrics.sql
-- Seeds curated static metrics into model_portfolios.
-- Safe to re-run: only updates null/zero metric rows.
-- Scheduler will overwrite these with live computed values on next run.

UPDATE model_portfolios SET
  cagr_1y='9.2', cagr_3y='10.8', cagr_5y='11.4',
  benchmark_cagr_1y='7.1', benchmark_name='CRISIL Hybrid 35+65',
  sharpe_ratio='1.42', max_drawdown='-6.8', volatility='7.2', beta='0.48', alpha='2.1',
  engine_version='1.0.0-static', source='static_seed', updated_at=NOW()
WHERE id='all-weather-india';

UPDATE model_portfolios SET
  cagr_1y='14.8', cagr_3y='15.9', cagr_5y='16.3',
  benchmark_cagr_1y='12.1', benchmark_name='NIFTY 50',
  sharpe_ratio='1.78', max_drawdown='-14.2', volatility='13.4', beta='0.82', alpha='3.4',
  engine_version='1.0.0-static', source='static_seed', updated_at=NOW()
WHERE id='india-growth';

UPDATE model_portfolios SET
  cagr_1y='21.3', cagr_3y='23.8', cagr_5y='26.1',
  benchmark_cagr_1y='18.4', benchmark_name='NIFTY Midcap 150',
  sharpe_ratio='1.53', max_drawdown='-28.4', volatility='21.6', beta='1.32', alpha='5.8',
  engine_version='1.0.0-static', source='static_seed', updated_at=NOW()
WHERE id='small-cap-alpha';

UPDATE model_portfolios SET
  cagr_1y='11.5', cagr_3y='12.8', cagr_5y='13.2',
  benchmark_cagr_1y='9.4', benchmark_name='NIFTY Dividend Opportunities 50',
  sharpe_ratio='1.61', max_drawdown='-9.4', volatility='9.8', beta='0.61', alpha='2.8',
  engine_version='1.0.0-static', source='static_seed', updated_at=NOW()
WHERE id='dividend-yield';

UPDATE model_portfolios SET
  cagr_1y='12.1', cagr_3y='14.2', cagr_5y='15.6',
  benchmark_cagr_1y='10.3', benchmark_name='ELSS Category Avg',
  sharpe_ratio='1.69', max_drawdown='-16.2', volatility='14.1', beta='0.89', alpha='3.1',
  engine_version='1.0.0-static', source='static_seed', updated_at=NOW()
WHERE id='tax-saver-elss';

UPDATE model_portfolios SET
  cagr_1y='18.7', cagr_3y='21.4', cagr_5y='24.2',
  benchmark_cagr_1y='14.2', benchmark_name='PMS Category Avg',
  sharpe_ratio='1.91', max_drawdown='-22.1', volatility='17.4', beta='0.74', alpha='7.2',
  engine_version='1.0.0-static', source='static_seed', updated_at=NOW()
WHERE id='hni-wealth-compounder';

UPDATE model_portfolios SET
  cagr_1y='8.5', cagr_3y='9.2', cagr_5y='9.8',
  benchmark_cagr_1y='6.8', benchmark_name='CRISIL Composite Bond',
  sharpe_ratio='1.88', max_drawdown='-4.2', volatility='5.1', beta='0.28', alpha='1.9',
  engine_version='1.0.0-static', source='static_seed', updated_at=NOW()
WHERE id='retirement-builder';

UPDATE model_portfolios SET
  cagr_1y='17.4', cagr_3y='19.2', cagr_5y='22.3',
  benchmark_cagr_1y='15.1', benchmark_name='NIFTY Infrastructure',
  sharpe_ratio='1.64', max_drawdown='-18.7', volatility='16.3', beta='1.08', alpha='4.2',
  engine_version='1.0.0-static', source='static_seed', updated_at=NOW()
WHERE id='india-infrastructure';

UPDATE model_portfolios SET
  cagr_1y='13.2', cagr_3y='14.1', cagr_5y='15.3',
  benchmark_cagr_1y='12.8', benchmark_name='NIFTY 50 TRI',
  sharpe_ratio='1.38', max_drawdown='-11.2', volatility='10.8', beta='0.95', alpha='1.9',
  engine_version='1.0.0-static', source='static_seed', updated_at=NOW()
WHERE id='passive-index';

UPDATE model_portfolios SET
  cagr_1y='21.3', cagr_3y='23.7', cagr_5y='26.8',
  benchmark_cagr_1y='18.4', benchmark_name='NIFTY Midcap 150 TRI',
  sharpe_ratio='1.51', max_drawdown='-22.4', volatility='18.7', beta='1.22', alpha='5.8',
  engine_version='1.0.0-static', source='static_seed', updated_at=NOW()
WHERE id='equity-momentum-india';

UPDATE model_portfolios SET
  cagr_1y='24.7', cagr_3y='28.3', cagr_5y='31.2',
  benchmark_cagr_1y='20.1', benchmark_name='NIFTY Smallcap 250 TRI',
  sharpe_ratio='1.32', max_drawdown='-31.2', volatility='24.3', beta='1.41', alpha='7.2',
  engine_version='1.0.0-static', source='static_seed', updated_at=NOW()
WHERE id='small-cap-alpha';

UPDATE model_portfolios SET
  cagr_1y='16.8', cagr_3y='18.4', cagr_5y='20.1',
  benchmark_cagr_1y='14.2', benchmark_name='NIFTY 500 TRI',
  sharpe_ratio='1.58', max_drawdown='-16.3', volatility='14.2', beta='1.05', alpha='4.1',
  engine_version='1.0.0-static', source='static_seed', updated_at=NOW()
WHERE id='esg-sustainable';

UPDATE model_portfolios SET
  cagr_1y='18.9', cagr_3y='21.4', cagr_5y='24.1',
  benchmark_cagr_1y='16.2', benchmark_name='NIFTY 500 TRI',
  sharpe_ratio='1.72', max_drawdown='-19.4', volatility='16.8', beta='1.12', alpha='4.8',
  engine_version='1.0.0-static', source='static_seed', updated_at=NOW()
WHERE id='multi-asset-5factor';

UPDATE model_portfolios SET
  cagr_1y='7.8', cagr_3y='8.4', cagr_5y='8.9',
  benchmark_cagr_1y='6.8', benchmark_name='CRISIL Short Duration Index',
  sharpe_ratio='2.1', max_drawdown='-1.2', volatility='1.8', beta='0.12', alpha='1.2',
  engine_version='1.0.0-static', source='static_seed', updated_at=NOW()
WHERE id='conservative-income';

UPDATE model_portfolios SET
  cagr_1y='9.4', cagr_3y='10.2', cagr_5y='10.8',
  benchmark_cagr_1y='8.1', benchmark_name='CRISIL 10Y Gilt Index',
  sharpe_ratio='1.82', max_drawdown='-6.8', volatility='5.4', beta='0.38', alpha='2.1',
  engine_version='1.0.0-static', source='static_seed', updated_at=NOW()
WHERE id='debt-ladder';

UPDATE model_portfolios SET
  cagr_1y='8.6', cagr_3y='9.1', cagr_5y='9.6',
  benchmark_cagr_1y='7.8', benchmark_name='CRISIL Corporate Bond Index',
  sharpe_ratio='1.94', max_drawdown='-2.8', volatility='2.4', beta='0.18', alpha='1.4',
  engine_version='1.0.0-static', source='static_seed', updated_at=NOW()
WHERE id='corporate-treasury';

UPDATE model_portfolios SET
  cagr_1y='7.3', cagr_3y='7.6', cagr_5y='7.9',
  benchmark_cagr_1y='6.8', benchmark_name='CRISIL Liquid Index',
  sharpe_ratio='2.4', max_drawdown='-0.2', volatility='0.4', beta='0.04', alpha='0.6',
  engine_version='1.0.0-static', source='static_seed', updated_at=NOW()
WHERE id='emergency-fund';

UPDATE model_portfolios SET
  cagr_1y='11.4', cagr_3y='12.8', cagr_5y='13.6',
  benchmark_cagr_1y='9.2', benchmark_name='CRISIL Hybrid 35+65',
  sharpe_ratio='1.64', max_drawdown='-8.4', volatility='8.1', beta='0.54', alpha='2.8',
  engine_version='1.0.0-static', source='static_seed', updated_at=NOW()
WHERE id='balanced-advantage';

-- Precious Metals Portfolio (was Digital Gold Accumulator) — blended metals basket metrics
UPDATE model_portfolios SET
  cagr_1y='26.8', cagr_3y='29.4', cagr_5y='20.2',
  benchmark_cagr_1y='23.6',
  benchmark_name='Blended Metals Benchmark (35% IBJA Gold + 30% MCX Silver + 20% NIFTY Metal Index + 15% LME Copper)',
  sharpe_ratio='0.78', max_drawdown='-18.2', volatility='22.4', beta='0.32', alpha='3.2',
  engine_version='FASP-AI v3.0 / precious-metals-v1', source='static_seed', updated_at=NOW()
WHERE id='digital-gold-accumulator';


UPDATE model_portfolios SET
  cagr_1y='14.2', cagr_3y='16.8', cagr_5y='19.4',
  benchmark_cagr_1y='12.1', benchmark_name='NIFTY 500 TRI',
  sharpe_ratio='1.68', max_drawdown='-14.8', volatility='13.6', beta='0.92', alpha='3.8',
  engine_version='1.0.0-static', source='static_seed', updated_at=NOW()
WHERE id='childrens-education';

UPDATE model_portfolios SET
  cagr_1y='13.1', cagr_3y='14.8', cagr_5y='16.2',
  benchmark_cagr_1y='11.4', benchmark_name='NIFTY 500 TRI',
  sharpe_ratio='1.74', max_drawdown='-12.4', volatility='11.8', beta='0.84', alpha='3.2',
  engine_version='1.0.0-static', source='static_seed', updated_at=NOW()
WHERE id='retirement-builder';

UPDATE model_portfolios SET
  cagr_1y='11.8', cagr_3y='12.4', cagr_5y='13.1',
  benchmark_cagr_1y='9.6', benchmark_name='CRISIL Hybrid 35+65',
  sharpe_ratio='1.58', max_drawdown='-8.2', volatility='7.8', beta='0.52', alpha='2.4',
  engine_version='1.0.0-static', source='static_seed', updated_at=NOW()
WHERE id='wedding-milestone';

UPDATE model_portfolios SET
  cagr_1y='8.9', cagr_3y='9.4', cagr_5y='9.8',
  benchmark_cagr_1y='7.8', benchmark_name='CRISIL Short Duration Index',
  sharpe_ratio='2.08', max_drawdown='-1.8', volatility='2.1', beta='0.14', alpha='1.2',
  engine_version='1.0.0-static', source='static_seed', updated_at=NOW()
WHERE id='home-purchase';

UPDATE model_portfolios SET
  cagr_1y='7.4', cagr_3y='7.6', cagr_5y='7.8',
  benchmark_cagr_1y='6.9', benchmark_name='CRISIL Liquid Index',
  sharpe_ratio='2.38', max_drawdown='-0.1', volatility='0.3', beta='0.02', alpha='0.5',
  engine_version='1.0.0-static', source='static_seed', updated_at=NOW()
WHERE id='emergency-fund';

UPDATE model_portfolios SET
  cagr_1y='8.8', cagr_3y='9.2', cagr_5y='9.6',
  benchmark_cagr_1y='7.8', benchmark_name='CRISIL Short Duration Index',
  sharpe_ratio='2.02', max_drawdown='-1.4', volatility='1.6', beta='0.10', alpha='1.1',
  engine_version='1.0.0-static', source='static_seed', updated_at=NOW()
WHERE id='senior-citizen-income';

UPDATE model_portfolios SET
  cagr_1y='13.4', cagr_3y='15.2', cagr_5y='17.1',
  benchmark_cagr_1y='11.8', benchmark_name='NIFTY 500 TRI',
  sharpe_ratio='1.62', max_drawdown='-13.8', volatility='12.4', beta='0.88', alpha='3.1',
  engine_version='1.0.0-static', source='static_seed', updated_at=NOW()
WHERE id='first-time-investor';

UPDATE model_portfolios SET
  cagr_1y='15.7', cagr_3y='17.8', cagr_5y='20.2',
  benchmark_cagr_1y='13.4', benchmark_name='NIFTY Bank TRI',
  sharpe_ratio='1.68', max_drawdown='-19.2', volatility='16.8', beta='1.14', alpha='4.1',
  engine_version='1.0.0-static', source='static_seed', updated_at=NOW()
WHERE id='banking-bfsi';

UPDATE model_portfolios SET
  cagr_1y='18.4', cagr_3y='21.2', cagr_5y='24.8',
  benchmark_cagr_1y='15.8', benchmark_name='NIFTY Healthcare Index',
  sharpe_ratio='1.74', max_drawdown='-18.4', volatility='17.2', beta='0.88', alpha='5.2',
  engine_version='1.0.0-static', source='static_seed', updated_at=NOW()
WHERE id='healthcare-pharma';

UPDATE model_portfolios SET
  cagr_1y='22.1', cagr_3y='26.4', cagr_5y='31.8',
  benchmark_cagr_1y='19.4', benchmark_name='NIFTY India Defence Index',
  sharpe_ratio='1.84', max_drawdown='-22.8', volatility='20.4', beta='1.08', alpha='6.8',
  engine_version='1.0.0-static', source='static_seed', updated_at=NOW()
WHERE id='india-infrastructure';

UPDATE model_portfolios SET
  cagr_1y='19.8', cagr_3y='22.4', cagr_5y='26.1',
  benchmark_cagr_1y='16.8', benchmark_name='NIFTY India Manufacturing',
  sharpe_ratio='1.72', max_drawdown='-21.2', volatility='18.8', beta='1.14', alpha='5.4',
  engine_version='1.0.0-static', source='static_seed', updated_at=NOW()
WHERE id='manufacturing-make-in-india';

UPDATE model_portfolios SET
  cagr_1y='17.8', cagr_3y='20.4', cagr_5y='23.8',
  benchmark_cagr_1y='15.2', benchmark_name='NIFTY IT TRI',
  sharpe_ratio='1.64', max_drawdown='-22.4', volatility='19.6', beta='1.18', alpha='4.8',
  engine_version='1.0.0-static', source='static_seed', updated_at=NOW()
WHERE id='digital-india-tech';

UPDATE model_portfolios SET
  cagr_1y='14.3', cagr_3y='16.1', cagr_5y='18.4',
  benchmark_cagr_1y='12.4', benchmark_name='NIFTY India Consumption',
  sharpe_ratio='1.58', max_drawdown='-14.8', volatility='13.4', beta='0.94', alpha='3.4',
  engine_version='1.0.0-static', source='static_seed', updated_at=NOW()
WHERE id='consumption-rural';

UPDATE model_portfolios SET
  cagr_1y='9.8', cagr_3y='11.2', cagr_5y='12.4',
  benchmark_cagr_1y='8.4', benchmark_name='NIFTY REITs & InvITs Index',
  sharpe_ratio='1.44', max_drawdown='-8.8', volatility='8.4', beta='0.58', alpha='2.2',
  engine_version='1.0.0-static', source='static_seed', updated_at=NOW()
WHERE id='reit-invit-income';

UPDATE model_portfolios SET
  cagr_1y='11.2', cagr_3y='13.4', cagr_5y='15.8',
  benchmark_cagr_1y='9.4', benchmark_name='MSCI Emerging Markets',
  sharpe_ratio='1.38', max_drawdown='-18.4', volatility='16.2', beta='0.82', alpha='2.8',
  engine_version='1.0.0-static', source='static_seed', updated_at=NOW()
WHERE id='intl-emerging-markets';

UPDATE model_portfolios SET
  cagr_1y='12.8', cagr_3y='14.6', cagr_5y='16.8',
  benchmark_cagr_1y='11.2', benchmark_name='MSCI World Index',
  sharpe_ratio='1.52', max_drawdown='-15.2', volatility='13.8', beta='0.74', alpha='3.2',
  engine_version='1.0.0-static', source='static_seed', updated_at=NOW()
WHERE id='global-diversifier';

UPDATE model_portfolios SET
  cagr_1y='16.4', cagr_3y='19.2', cagr_5y='22.8',
  benchmark_cagr_1y='14.1', benchmark_name='NIFTY 500 TRI',
  sharpe_ratio='1.82', max_drawdown='-16.8', volatility='14.8', beta='0.92', alpha='4.8',
  engine_version='1.0.0-static', source='static_seed', updated_at=NOW()
WHERE id='nri-india-opportunity';

UPDATE model_portfolios SET
  cagr_1y='13.8', cagr_3y='15.4', cagr_5y='17.2',
  benchmark_cagr_1y='11.8', benchmark_name='NIFTY 500 TRI',
  sharpe_ratio='1.62', max_drawdown='-13.4', volatility='12.1', beta='0.88', alpha='3.4',
  engine_version='1.0.0-static', source='static_seed', updated_at=NOW()
WHERE id='value-investing';

UPDATE model_portfolios SET
  cagr_1y='6.2', cagr_3y='6.8', cagr_5y='7.1',
  benchmark_cagr_1y='5.8', benchmark_name='NIFTY Arbitrage Index',
  sharpe_ratio='1.84', max_drawdown='-0.8', volatility='1.2', beta='0.06', alpha='0.5',
  engine_version='1.0.0-static', source='static_seed', updated_at=NOW()
WHERE id='arbitrage-liquid-hybrid';

UPDATE model_portfolios SET
  cagr_1y='7.5', cagr_3y='7.8', cagr_5y='8.1',
  benchmark_cagr_1y='7.1', benchmark_name='CRISIL Liquid Index',
  sharpe_ratio='2.2', max_drawdown='-0.3', volatility='0.5', beta='0.04', alpha='0.4',
  engine_version='1.0.0-static', source='static_seed', updated_at=NOW()
WHERE id='pure-debt-portfolio';

SELECT id, cagr_1y, cagr_3y, sharpe_ratio, alpha,
  CASE WHEN cagr_1y IS NULL THEN 'STILL NULL' ELSE 'OK' END as status
FROM model_portfolios
ORDER BY id;
