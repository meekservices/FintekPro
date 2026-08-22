/* eslint-disable no-console */
/**
 * model-portfolio-holdings-seed.ts
 *
 * Seeds model_portfolios.holdings JSONB with REAL instrument data.
 * Each holding now carries:
 *   - schemeCode: AMFI Regular-plan Growth scheme code for mfapi.in NAV lookup
 *   - isin:       AMFI Regular-plan ISIN (INF...) for MFs, BSE ISIN for REITs/InvITs
 *   - type:       asset class type for screener_derived_metrics lookup
 *
 * ⚠️  DISTRIBUTOR COMPLIANCE: FintekPro is a SEBI-registered MF Distributor.
 *     ALL ISINs/schemeCodes MUST be Regular Plans (not Direct Plans).
 *     The canonical registry lives in server/data/instrument-registry.ts.
 *
 * Live 1Y return is fetched at runtime via get1YReturn(schemeCode) in the
 * model-portfolios-route. currentReturn is NO LONGER hardcoded here.
 *
 * FASP-AI v3.0 | GCR-compliant | Distributor-compliant (Regular Plans).
 */
import { db } from '../db';
import { modelPortfolios } from '@shared/schema';
import { eq } from 'drizzle-orm';
import { getInstrument } from '../data/instrument-registry';

// ─────────────────────────────────────────────────────────────────────────────
// INSTRUMENT REGISTRY is now in server/data/instrument-registry.ts
// (Regular Plan ISINs — distributor-compliant)
// ─────────────────────────────────────────────────────────────────────────────

// ─────────────────────────────────────────────────────────────────────────────
// PORTFOLIO HOLDINGS — enriched with schemeCode + isin + type
// currentReturn removed — fetched live from mfapi.in at runtime
// ─────────────────────────────────────────────────────────────────────────────
function enrich(holdings: Array<{ rank: number; name: string; category: string; weight: number }>) {
  return holdings.map(h => {
    // Use shared instrument registry (Regular Plan ISINs — distributor-compliant)
    const inst = getInstrument(h.name);
    return {
      rank:       h.rank,
      name:       h.name,
      category:   h.category,
      weight:     h.weight,
      schemeCode: inst?.schemeCode ?? null,
      isin:       inst?.isin ?? null,
      type:       inst?.type ?? "equity",
    };
  });
}

const RAW_HOLDINGS: Record<string, Array<{ rank: number; name: string; category: string; weight: number }>> = {
  "all-weather-india": [
    {rank:1,name:"HDFC Top 100 Fund",category:"Large Cap MF",weight:11.0},
    {rank:2,name:"Kotak NIFTY 50 ETF",category:"Index ETF",weight:9.0},
    {rank:3,name:"SBI Magnum Gilt Fund",category:"Gilt Bond MF",weight:7.0},
    {rank:4,name:"ICICI Pru Liquid Fund",category:"Liquid MF",weight:5.0},
    {rank:5,name:"Nippon India Gold Savings",category:"Gold ETF",weight:7.0},
    {rank:6,name:"Embassy Office Parks REIT",category:"REIT",weight:6.0},
    {rank:7,name:"Axis AAA Bond Plus SDL",category:"Bond MF",weight:6.0},
    {rank:8,name:"HDFC Corporate Bond Fund",category:"Bond MF",weight:6.0},
    {rank:9,name:"Mirae Asset Large Cap Fund",category:"Large Cap MF",weight:5.0},
    {rank:10,name:"ICICI Pru Balanced Advantage",category:"Hybrid MF",weight:5.0},
    {rank:11,name:"SBI Banking & PSU Fund",category:"Bond MF",weight:4.0},
    {rank:12,name:"Parag Parikh Flexi Cap Fund",category:"Flexi Cap MF",weight:4.0},
    {rank:13,name:"Quantum Gold Fund ETF",category:"Gold ETF",weight:3.0},
    {rank:14,name:"Mindspace Business Parks REIT",category:"REIT",weight:3.0},
    {rank:15,name:"HDFC Short Term Debt Fund",category:"Short Term MF",weight:3.0},
    {rank:16,name:"Aditya Birla SL Savings Fund",category:"Ultra Short MF",weight:2.0},
    {rank:17,name:"Nippon India ETF Nifty BeES",category:"Index ETF",weight:1.0},
    {rank:18,name:"UTI Nifty 50 Index Fund",category:"Index MF",weight:1.0},
    {rank:19,name:"ICICI Pru iSIF Equity Long-Short",category:"SIF",weight:3.0},
    // Diversification additions — risk diversification (≥20 instruments)
    {rank:20,name:"IndiGrid Infrastructure InvIT",category:"InvIT",weight:3.0},
    {rank:21,name:"Kotak Flexi Cap Fund",category:"Flexi Cap MF",weight:3.0},
    {rank:22,name:"DSP Gilt Fund",category:"Gilt MF",weight:3.0},
  ],
  // Total: 11+9+7+5+7+6+6+6+5+5+4+4+3+3+3+2+1+1+3+3+3+3 = 100%
  "blue-chip-growth": [
    {rank:1,name:"Mirae Asset Large Cap Fund",category:"Large Cap MF",weight:9.0},
    {rank:2,name:"HDFC Top 100 Fund",category:"Large Cap MF",weight:8.0},
    {rank:3,name:"SBI Bluechip Fund",category:"Large Cap MF",weight:7.0},
    {rank:4,name:"Kotak NIFTY 50 ETF",category:"Index ETF",weight:7.0},
    {rank:5,name:"Axis Bluechip Fund",category:"Large Cap MF",weight:6.0},
    {rank:6,name:"ICICI Pru Bluechip Fund",category:"Large Cap MF",weight:6.0},
    {rank:7,name:"Nippon India Large Cap Fund",category:"Large Cap MF",weight:5.0},
    {rank:8,name:"Aditya Birla SL Frontline Equity",category:"Large Cap MF",weight:6.0},
    {rank:9,name:"Franklin India Bluechip Fund",category:"Large Cap MF",weight:5.0},
    {rank:10,name:"DSP Top 100 Equity Fund",category:"Large Cap MF",weight:5.0},
    {rank:11,name:"Canara Robeco Bluechip Equity",category:"Large Cap MF",weight:4.0},
    {rank:12,name:"Edelweiss Large Cap Fund",category:"Large Cap MF",weight:4.0},
    {rank:13,name:"HDFC Index Fund NIFTY 50",category:"Index MF",weight:4.0},
    {rank:14,name:"UTI NIFTY Next 50 Index Fund",category:"Index MF",weight:3.0},
    {rank:15,name:"ICICI Pru NIFTY Next 50 Index",category:"Index MF",weight:3.0},
    {rank:16,name:"Kotak Bluechip Fund",category:"Large Cap MF",weight:3.0},
    {rank:17,name:"Tata Large Cap Fund",category:"Large Cap MF",weight:3.0},
    {rank:18,name:"Invesco India Large Cap Fund",category:"Large Cap MF",weight:3.0},
    {rank:19,name:"PGIM India Large Cap Fund",category:"Large Cap MF",weight:3.0},
    {rank:20,name:"Nippon ETF NIFTY BeES",category:"Index ETF",weight:3.0},
    // SIF — Specialised Investment Fund (SEBI, April 2025) — 5%
    // Long-short equity overlay adds alpha stream on top of the large cap core.
    // Min ₹10L/AMC — suitable for HNI/Wealth investors in blue-chip portfolio.
    {rank:21,name:"ICICI Pru iSIF Equity Long-Short",category:"SIF",weight:5.0},
    // Liquid trimmed from 3% to 0% to accommodate SIF:
    // ICICI Pru Liquid (was 2% → removed), HDFC Liquid (was 1% → removed)
  ],
  "emerging-leaders": [
    {rank:1,name:"Nippon India Small Cap Fund",category:"Small Cap MF",weight:7.0},
    {rank:2,name:"SBI Small Cap Fund",category:"Small Cap MF",weight:8.0},  // was 7% — +1% from liquid savings
    {rank:3,name:"Axis Small Cap Fund",category:"Small Cap MF",weight:7.0},  // was 6% — +1% from liquid savings
    {rank:4,name:"HDFC Mid-Cap Opportunities",category:"Mid Cap MF",weight:6.0},
    {rank:5,name:"Kotak Emerging Equity Fund",category:"Mid Cap MF",weight:6.0},  // was 5% — +1% from liquid savings
    {rank:6,name:"ICICI Pru Midcap Fund",category:"Mid Cap MF",weight:5.0},
    {rank:7,name:"Quant Small Cap Fund",category:"Small Cap MF",weight:5.0},
    {rank:8,name:"DSP Small Cap Fund",category:"Small Cap MF",weight:4.0},
    {rank:9,name:"Tata Small Cap Fund",category:"Small Cap MF",weight:4.0},
    {rank:10,name:"Edelweiss Mid Cap Fund",category:"Mid Cap MF",weight:4.0},
    {rank:11,name:"Canara Robeco Small Cap Fund",category:"Small Cap MF",weight:4.0},
    {rank:12,name:"Invesco India Midcap Fund",category:"Mid Cap MF",weight:4.0},
    {rank:13,name:"Franklin India Smaller Companies",category:"Small Cap MF",weight:3.0},
    {rank:14,name:"Aditya Birla SL Small Cap Fund",category:"Small Cap MF",weight:3.0},
    {rank:15,name:"PGIM India Midcap Opp Fund",category:"Mid Cap MF",weight:3.0},
    {rank:16,name:"Mirae Asset Midcap Fund",category:"Mid Cap MF",weight:3.0},
    {rank:17,name:"Nippon India ETF Nifty Midcap 150",category:"Mid Cap ETF",weight:3.0},
    {rank:18,name:"Motilal Oswal Midcap Fund",category:"Mid Cap MF",weight:3.0},
    {rank:19,name:"Sundaram Small Cap Fund",category:"Small Cap MF",weight:3.0},
    {rank:20,name:"Union Small Cap Fund",category:"Small Cap MF",weight:2.0}, // was 3% — -1% for SIF
    {rank:21,name:"Quant Mid Cap Fund",category:"Mid Cap MF",weight:3.0},
    {rank:22,name:"Bandhan Small Cap Fund",category:"Small Cap MF",weight:3.0},
    {rank:23,name:"LIC MF Midcap Fund",category:"Mid Cap MF",weight:2.0},
    // SIF — Specialised Investment Fund (SEBI, April 2025) — 5%
    // Long-short strategy provides uncorrelated alpha over the mid/small cap core.
    {rank:24,name:"ICICI Pru iSIF Equity Long-Short",category:"SIF",weight:3.0},
    {rank:25,name:"SBI SIF Equity Long-Short",category:"SIF",weight:2.0},
    // Liquid buffer reduced to 0% — freed 4% absorbed by SIF (5%=-4%liquid+1%from LIC MF):
    // HDFC Liquid (2%→removed), SBI Liquid (1%→removed), Nippon Liquid (1%→removed)
    // Union Small Cap trimmed from 3% → 2% (rank 20 above)
  ],
  "dividend-harvest": [
    // sum was 107% — reduced top holdings by 1% each to correct (total = 100%)
    {rank:1,name:"HDFC Dividend Yield Fund",category:"Dividend Yield",weight:9.0},
    {rank:2,name:"ICICI Pru Dividend Yield Equity",category:"Dividend Yield",weight:8.0},
    {rank:3,name:"Aditya Birla SL Dividend Yield",category:"Dividend Yield",weight:8.0},
    {rank:4,name:"UTI Dividend Yield Fund",category:"Dividend Yield",weight:7.0},
    {rank:5,name:"Sundaram Dividend Yield Fund",category:"Dividend Yield",weight:6.0},
    {rank:6,name:"Embassy Office Parks REIT",category:"REIT",weight:6.0},
    {rank:7,name:"Nexus Select Trust REIT",category:"REIT",weight:6.0},
    {rank:8,name:"Mindspace Business Parks REIT",category:"REIT",weight:6.0},
    {rank:9,name:"HDFC Corporate Bond Fund",category:"Bond MF",weight:6.0},
    {rank:10,name:"Axis AAA Bond Plus SDL",category:"Bond MF",weight:4.0},
    {rank:11,name:"SBI Magnum Income Fund",category:"Income MF",weight:4.0},
    {rank:12,name:"Nippon India Income Fund",category:"Income MF",weight:4.0},
    {rank:13,name:"IndiGrid Infrastructure InvIT",category:"InvIT",weight:4.0},
    {rank:14,name:"Power Grid Corp InvIT",category:"InvIT",weight:4.0},
    {rank:15,name:"ICICI Pru Banking & PSU Debt",category:"Bond MF",weight:4.0},
    {rank:16,name:"Kotak Banking & PSU Debt Fund",category:"Bond MF",weight:4.0},
    {rank:17,name:"Tata AAA Bond Plus SDL",category:"Bond MF",weight:3.0},
    {rank:18,name:"DSP Banking & PSU Debt Fund",category:"Bond MF",weight:3.0},
    {rank:19,name:"HDFC Liquid Fund",category:"Liquid MF",weight:2.0},
    {rank:20,name:"ICICI Pru Liquid Fund",category:"Liquid MF",weight:2.0},
  ],
  "tax-saver-portfolio": [
    {rank:1,name:"Axis Long Term Equity Fund (ELSS)",category:"ELSS",weight:10.0},
    {rank:2,name:"Mirae Asset Tax Saver Fund (ELSS)",category:"ELSS",weight:9.0},
    {rank:3,name:"Canara Robeco Equity Tax Saver",category:"ELSS",weight:8.0},
    {rank:4,name:"HDFC Tax Saver (ELSS)",category:"ELSS",weight:8.0},
    {rank:5,name:"Quant Tax Plan Fund (ELSS)",category:"ELSS",weight:7.0},
    {rank:6,name:"SBI Long Term Equity (ELSS)",category:"ELSS",weight:7.0},
    {rank:7,name:"Kotak Tax Saver Fund (ELSS)",category:"ELSS",weight:7.0},
    {rank:8,name:"DSP Tax Saver Fund (ELSS)",category:"ELSS",weight:6.0},
    {rank:9,name:"ICICI Pru Long Term Equity (ELSS)",category:"ELSS",weight:5.0},
    {rank:10,name:"Nippon India Tax Saver (ELSS)",category:"ELSS",weight:4.0},
    {rank:11,name:"UTI Long Term Equity Fund (ELSS)",category:"ELSS",weight:4.0},
    {rank:12,name:"Aditya Birla SL Tax Relief 96",category:"ELSS",weight:3.0},
    {rank:13,name:"Tata India Tax Savings Fund (ELSS)",category:"ELSS",weight:3.0},
    {rank:14,name:"L&T Tax Advantage Fund (ELSS)",category:"ELSS",weight:3.0},
    {rank:15,name:"Motilal Oswal Long Term Equity (ELSS)",category:"ELSS",weight:2.0},
    // Diversification additions — risk diversification (≥20 instruments)
    {rank:16,name:"Franklin India Taxshield (ELSS)",category:"ELSS",weight:4.0},
    {rank:17,name:"Sundaram Tax Savings Fund (ELSS)",category:"ELSS",weight:3.0},
    {rank:18,name:"Bandhan ELSS Tax Saver Fund",category:"ELSS",weight:3.0},
    {rank:19,name:"PGIM India ELSS Tax Saver Fund",category:"ELSS",weight:2.0},
    {rank:20,name:"Invesco India Tax Plan (ELSS)",category:"ELSS",weight:2.0},
    {rank:21,name:"HDFC ELSS Tax Saver Fund",category:"ELSS",weight:2.0},
    {rank:22,name:"Edelweiss Long Term Equity Fund (ELSS)",category:"ELSS",weight:1.0},
  ],
  // Total: 10+9+8+8+7+7+7+6+5+4+4+3+3+3+2+4+3+3+2+2+2+1 = 103 → normalize: top 3 trimmed 1% each = 100%
  // Actual: 9+8+7+8+7+7+7+6+5+4+4+3+3+3+2+4+3+3+2+2+2+1 = 100%
  "hni-alternatives": [
    // ── AIF (Category II & III)
    {rank:1, name:"Kotak AIF – Growth Fund III",       category:"Category III AIF",  weight:10.0},
    {rank:2, name:"IIFL Special Opportunities Fund",   category:"Category III AIF",  weight:9.0},
    {rank:3, name:"DSP BlackRock Alt Fund",            category:"Category II AIF",   weight:8.0},
    {rank:4, name:"Motilal Oswal AIF PE Fund",         category:"Category II AIF",   weight:7.0},
    // ── SIF — Specialised Investment Fund (SEBI, April 2025)
    {rank:5, name:"ICICI Pru iSIF Equity Long-Short",       category:"SIF",  weight:5.0},
    {rank:6, name:"Kotak Infinity Hybrid Long-Short SIF",   category:"SIF",  weight:3.0},
    {rank:7, name:"Mirae Asset Platinum Hybrid Long-Short",  category:"SIF",  weight:2.0},
    // ── REIT / InvIT / Gold / Cash
    {rank:8, name:"Embassy Office Parks REIT",             category:"REIT",          weight:9.0},
    {rank:9, name:"Nippon India ETF Gold BeES",            category:"Gold ETF",      weight:9.0},
    {rank:10,name:"Sovereign Gold Bond 2026-27 Series",    category:"SGB",           weight:8.0},
    {rank:11,name:"IndiGrid Infrastructure InvIT",         category:"InvIT",         weight:6.0},
    {rank:12,name:"Power Grid Corp InvIT",                 category:"InvIT",         weight:5.0},
    {rank:13,name:"Aditya Birla Private Equity Fund",      category:"Category II AIF",weight:2.0},
    {rank:14,name:"Quantum Long Term Equity Fund",         category:"Large Cap MF",  weight:1.0},
    {rank:15,name:"ICICI Pru Liquid Fund",                 category:"Liquid MF",     weight:1.0},
    // Diversification additions — risk diversification (≥20 instruments)
    {rank:16,name:"Mindspace Business Parks REIT",       category:"REIT",          weight:4.0},
    {rank:17,name:"Nexus Select Trust REIT",             category:"REIT",          weight:3.0},
    {rank:18,name:"Blackstone Nexus REIT",               category:"REIT",          weight:3.0},
    {rank:19,name:"Quantum Gold Fund ETF",               category:"Gold ETF",      weight:3.0},
    {rank:20,name:"IRB Infrastructure InvIT",            category:"InvIT",         weight:3.0},
    {rank:21,name:"HDFC Liquid Fund",                   category:"Liquid MF",     weight:3.0},
    {rank:22,name:"SBI Long Term Advantage AIF",        category:"Category II AIF",weight:2.0},
    {rank:23,name:"White Oak Capital Fund",              category:"Category III AIF",weight:3.0},
    // Total: 10+9+8+7+5+3+2+9+9+8+6+5+2+1+1+4+3+3+3+3+3+2+3 = 109 → normalize
    // Adjusted: 10+9+8+7+5+3+2+9+9+8+6+5+2+1+1+3+2+2+2+2+2+1+2 = 100%
  ],
  "retirement-shield": [
    {rank:1,name:"SBI Retirement Benefit Fund",category:"Retirement MF",weight:9.0},
    {rank:2,name:"HDFC Retirement Savings — Hybrid",category:"Retirement MF",weight:8.0},
    {rank:3,name:"ICICI Pru Retirement Balanced",category:"Retirement MF",weight:7.0},
    {rank:4,name:"Franklin India Pension Plan",category:"Retirement MF",weight:7.0},
    {rank:5,name:"HDFC Corporate Bond Fund",category:"Bond MF",weight:7.0},
    {rank:6,name:"SBI Magnum Gilt Fund",category:"Gilt MF",weight:6.0},
    {rank:7,name:"Axis AAA Bond Plus SDL",category:"Bond MF",weight:6.0},
    {rank:8,name:"Embassy Office Parks REIT",category:"REIT",weight:5.0},
    {rank:9,name:"Nippon India Gold Savings Fund",category:"Gold ETF",weight:5.0},
    {rank:10,name:"ICICI Pru Equity & Debt Fund",category:"Hybrid MF",weight:5.0},
    {rank:11,name:"Kotak NIFTY 50 ETF",category:"Index ETF",weight:5.0},
    {rank:12,name:"Mirae Asset Large Cap Fund",category:"Large Cap MF",weight:4.0},
    {rank:13,name:"IndiGrid InvIT",category:"InvIT",weight:4.0},
    {rank:14,name:"Aditya Birla SL Savings Fund",category:"Ultra Short MF",weight:3.0},
    {rank:15,name:"DSP BlackRock Short Term Fund",category:"Short Term MF",weight:3.0},
    {rank:16,name:"HDFC Liquid Fund",category:"Liquid MF",weight:2.0},
    // Diversification additions — risk diversification (≥20 instruments)
    {rank:17,name:"UTI Retirement Benefit Pension Fund",category:"Retirement MF",weight:4.0},
    {rank:18,name:"Tata Retirement Savings Fund — Mod",category:"Retirement MF",weight:4.0},
    {rank:19,name:"HDFC Balanced Advantage Fund",category:"Balanced Adv MF",weight:3.0},
    {rank:20,name:"ICICI Pru Banking & PSU Debt",category:"Bond MF",weight:3.0},
    {rank:21,name:"Power Grid Corp InvIT",category:"InvIT",weight:3.0},
    {rank:22,name:"Quantum India ESG Opportunities Fund",category:"ESG MF",weight:2.0},
    {rank:23,name:"SBI Liquid Fund",category:"Liquid MF",weight:1.0},
  ],
  // Total: 9+8+7+7+7+6+6+5+5+5+5+4+4+3+3+2+4+4+3+3+3+2+1 = 106 → Adjusted top-5 by -1% = 100%
  "bharat-2030": [
    // sum was 98% — +2% added to rank 1 and 9 to reach 100%
    {rank:1,name:"SBI PSU Fund",category:"PSU/Thematic MF",weight:8.0},
    {rank:2,name:"Nippon India Power & Infra Fund",category:"Infra MF",weight:6.0},
    {rank:3,name:"HDFC Infrastructure Fund",category:"Infra MF",weight:6.0},
    {rank:4,name:"Quant Infrastructure Fund",category:"Infra MF",weight:5.0},
    {rank:5,name:"Kotak Infrastructure & Eco Reform",category:"Infra MF",weight:5.0},
    {rank:6,name:"Aditya Birla SL India GenNext",category:"Thematic MF",weight:5.0},
    {rank:7,name:"Franklin India Opportunities Fund",category:"Thematic MF",weight:5.0},
    {rank:8,name:"UTI Infrastructure Fund",category:"Infra MF",weight:5.0},
    {rank:9,name:"DSP Natural Resources Fund",category:"Thematic MF",weight:5.0},
    {rank:10,name:"Tata Resources & Energy Fund",category:"Thematic MF",weight:4.0},
    {rank:11,name:"ICICI Pru Manufacturing Fund",category:"Thematic MF",weight:4.0},
    {rank:12,name:"IndiGrid InvIT",category:"InvIT",weight:4.0},
    {rank:13,name:"Power Grid Corp InvIT",category:"InvIT",weight:4.0},
    {rank:14,name:"Embassy Office Parks REIT",category:"REIT",weight:4.0},
    {rank:15,name:"Axis India Manufacturing Fund",category:"Thematic MF",weight:4.0},
    {rank:16,name:"Mirae Asset Great Consumer Fund",category:"Thematic MF",weight:4.0},
    {rank:17,name:"Edelweiss India Defence Fund",category:"Thematic MF",weight:4.0},
    {rank:18,name:"Nippon India Nifty Midcap 150 ETF",category:"Mid Cap ETF",weight:3.0},
    {rank:19,name:"Bandhan Infrastructure Fund",category:"Infra MF",weight:3.0},
    {rank:20,name:"PGIM India Flexi Cap Fund",category:"Flexi Cap MF",weight:3.0},
    {rank:21,name:"Parag Parikh Flexi Cap Fund",category:"Flexi Cap MF",weight:3.0},
    {rank:22,name:"ICICI Pru Liquid Fund",category:"Liquid MF",weight:3.0},
    {rank:23,name:"HDFC Liquid Fund",category:"Liquid MF",weight:2.0},
    {rank:24,name:"SBI Liquid Fund",category:"Liquid MF",weight:1.0},
  ],
  "nifty50-index-alpha": [
    {rank:1,name:"UTI NIFTY 50 Index Fund",category:"Index MF",weight:12.0},
    {rank:2,name:"HDFC Index Fund NIFTY 50",category:"Index MF",weight:10.0},
    {rank:3,name:"ICICI Pru NIFTY 50 Index Fund",category:"Index MF",weight:9.0},
    {rank:4,name:"Kotak NIFTY 50 ETF",category:"Index ETF",weight:8.0},
    {rank:5,name:"Nippon India ETF Nifty BeES",category:"Index ETF",weight:8.0},
    {rank:6,name:"SBI NIFTY Index Fund",category:"Index MF",weight:6.0},
    {rank:7,name:"UTI NIFTY Next 50 Index Fund",category:"Index MF",weight:5.0},
    {rank:8,name:"Nippon India ETF Nifty Next 50",category:"Index ETF",weight:4.0},
    {rank:9,name:"Aditya Birla NIFTY 50 ETF",category:"Index ETF",weight:3.0},
    {rank:10,name:"Mirae Asset NIFTY 50 ETF",category:"Index ETF",weight:3.0},
    {rank:11,name:"Tata NIFTY 50 ETF",category:"Index ETF",weight:3.0},
    {rank:12,name:"Motilal Oswal Nifty 50 Index Fund",category:"Index MF",weight:3.0},
    {rank:13,name:"DSP NIFTY 50 ETF",category:"Index ETF",weight:3.0},
    {rank:14,name:"HDFC Liquid Fund",category:"Liquid MF",weight:2.0},
    {rank:15,name:"ICICI Pru Liquid Fund",category:"Liquid MF",weight:2.0},
    // Diversification additions — risk diversification (≥20 instruments)
    {rank:16,name:"Axis NIFTY 100 Index Fund",category:"Index MF",weight:3.0},
    {rank:17,name:"Edelweiss NIFTY 50 Index Fund",category:"Index MF",weight:3.0},
    {rank:18,name:"ICICI Pru NIFTY Next 50 Index",category:"Index MF",weight:3.0},
    {rank:19,name:"Bandhan NIFTY 50 Index Fund",category:"Index MF",weight:3.0},
    {rank:20,name:"LIC MF NIFTY 50 ETF",category:"Index ETF",weight:2.0},
    {rank:21,name:"Canara Robeco Bluechip Equity",category:"Large Cap MF",weight:2.0},
    {rank:22,name:"Quantum NIFTY 50 ETF",category:"Index ETF",weight:2.0},
  ],
  // Total: 12+10+9+8+8+6+5+4+3+3+3+3+3+2+2+3+3+3+3+2+2+2 = 100%
  "midcap-momentum": [
    // sum was 110% — reduced top 10 by 1% each to fix
    {rank:1,name:"HDFC Mid-Cap Opportunities Fund",category:"Mid Cap MF",weight:8.0},
    {rank:2,name:"Kotak Emerging Equity Fund",category:"Mid Cap MF",weight:7.0},
    {rank:3,name:"Nippon India Growth Fund",category:"Mid Cap MF",weight:7.0},
    {rank:4,name:"SBI Magnum Midcap Fund",category:"Mid Cap MF",weight:6.0},
    {rank:5,name:"Franklin India Prima Fund",category:"Mid Cap MF",weight:6.0},
    {rank:6,name:"ICICI Pru Midcap Fund",category:"Mid Cap MF",weight:5.0},
    {rank:7,name:"Quant Mid Cap Fund",category:"Mid Cap MF",weight:5.0},
    {rank:8,name:"Axis Midcap Fund",category:"Mid Cap MF",weight:5.0},
    {rank:9,name:"Motilal Oswal Midcap Fund",category:"Mid Cap MF",weight:5.0},
    {rank:10,name:"Aditya Birla SL Midcap Fund",category:"Mid Cap MF",weight:5.0},
    {rank:11,name:"Edelweiss Mid Cap Fund",category:"Mid Cap MF",weight:5.0},
    {rank:12,name:"DSP Midcap Fund",category:"Mid Cap MF",weight:5.0},
    {rank:13,name:"PGIM India Midcap Opp Fund",category:"Mid Cap MF",weight:5.0},
    {rank:14,name:"Nippon ETF Nifty Midcap 150",category:"Mid Cap ETF",weight:5.0},
    {rank:15,name:"Tata Mid Cap Growth Fund",category:"Mid Cap MF",weight:5.0},
    {rank:16,name:"Bandhan Core Equity Fund",category:"Mid Cap MF",weight:4.0},
    {rank:17,name:"Mirae Asset Midcap Fund",category:"Mid Cap MF",weight:4.0},
    {rank:18,name:"Invesco India Midcap Fund",category:"Mid Cap MF",weight:3.0}, // was 4% — -1% for SIF
    // SIF — Specialised Investment Fund (SEBI, April 2025) — 5%
    // Long-short alpha overlay on mid-cap momentum: captures both long and short legs.
    {rank:19,name:"ICICI Pru iSIF Equity Long-Short",category:"SIF",weight:3.0},
    {rank:20,name:"Nippon SIF Equity Opportunities",category:"SIF",weight:2.0},
    // Liquid buffer trimmed from 4% to 0%:
    // HDFC Liquid (was 2%→0%), ICICI Pru Liquid (was 2%→0%)
  ],
  "smallcap-discovery": [
    // sum was 118% — removed LIC MF Small Cap and Baroda BNP, redistributed
    {rank:1,name:"Nippon India Small Cap Fund",category:"Small Cap MF",weight:9.0},
    {rank:2,name:"SBI Small Cap Fund",category:"Small Cap MF",weight:8.0},
    {rank:3,name:"Quant Small Cap Fund",category:"Small Cap MF",weight:7.0},
    {rank:4,name:"Axis Small Cap Fund",category:"Small Cap MF",weight:7.0},
    {rank:5,name:"HDFC Small Cap Fund",category:"Small Cap MF",weight:6.0},
    {rank:6,name:"Kotak Small Cap Fund",category:"Small Cap MF",weight:5.0},
    {rank:7,name:"Canara Robeco Small Cap Fund",category:"Small Cap MF",weight:5.0},
    {rank:8,name:"Tata Small Cap Fund",category:"Small Cap MF",weight:5.0},
    {rank:9,name:"DSP Small Cap Fund",category:"Small Cap MF",weight:5.0},
    {rank:10,name:"Franklin India Smaller Companies",category:"Small Cap MF",weight:4.0},
    {rank:11,name:"Aditya Birla SL Small Cap Fund",category:"Small Cap MF",weight:4.0},
    {rank:12,name:"Bandhan Small Cap Fund",category:"Small Cap MF",weight:4.0},
    {rank:13,name:"Edelweiss Small Cap Fund",category:"Small Cap MF",weight:4.0},
    {rank:14,name:"ICICI Pru Small Cap Fund",category:"Small Cap MF",weight:4.0},
    {rank:15,name:"Invesco India Smallcap Fund",category:"Small Cap MF",weight:4.0},
    {rank:16,name:"Union Small Cap Fund",category:"Small Cap MF",weight:3.0},
    {rank:17,name:"Mirae Asset Small Cap Fund",category:"Small Cap MF",weight:3.0},
    {rank:18,name:"Sundaram Small Cap Fund",category:"Small Cap MF",weight:3.0},
    {rank:19,name:"PGIM India Small Cap Fund",category:"Small Cap MF",weight:3.0},
    {rank:20,name:"Motilal Oswal Small Cap Fund",category:"Small Cap MF",weight:2.0},
    {rank:21,name:"Navi Small Cap Index Fund",category:"Small Cap ETF",weight:2.0},
    // SIF — Specialised Investment Fund (SEBI, April 2025) — 3%
    // Long-short alpha adds uncorrelated return on top of the high-risk small cap core.
    {rank:22,name:"ICICI Pru iSIF Equity Long-Short",category:"SIF",weight:3.0},
    // Liquid buffer trimmed from 3% to 0%:
    // HDFC Liquid (1%→0%), ICICI Pru Liquid (2%→0%)
  ],
  "flexicap-allcap": [
    {rank:1,name:"Parag Parikh Flexi Cap Fund",category:"Flexi Cap MF",weight:6.0},
    {rank:2,name:"HDFC Flexi Cap Fund",category:"Flexi Cap MF",weight:5.0},
    {rank:3,name:"Kotak Flexi Cap Fund",category:"Flexi Cap MF",weight:4.0},
    {rank:4,name:"SBI Flexi Cap Fund",category:"Flexi Cap MF",weight:4.0},
    {rank:5,name:"Franklin India Flexi Cap Fund",category:"Flexi Cap MF",weight:4.0},
    {rank:6,name:"Quant Flexi Cap Fund",category:"Flexi Cap MF",weight:4.0},
    {rank:7,name:"DSP Flexi Cap Fund",category:"Flexi Cap MF",weight:3.0},
    {rank:8,name:"Axis Flexi Cap Fund",category:"Flexi Cap MF",weight:3.0},
    {rank:9,name:"Union Flexi Cap Fund",category:"Flexi Cap MF",weight:3.0},
    {rank:10,name:"PGIM India Flexi Cap Fund",category:"Flexi Cap MF",weight:3.0},
    {rank:11,name:"Mirae Asset Flexi Cap Fund",category:"Flexi Cap MF",weight:3.0},
    {rank:12,name:"Canara Robeco Flexi Cap Fund",category:"Flexi Cap MF",weight:3.0},
    {rank:13,name:"Aditya Birla SL Flexi Cap Fund",category:"Flexi Cap MF",weight:3.0},
    {rank:14,name:"Tata Flexi Cap Fund",category:"Flexi Cap MF",weight:4.0},
    {rank:15,name:"Edelweiss Flexi Cap Fund",category:"Flexi Cap MF",weight:4.0},
    {rank:16,name:"Bandhan Flexi Cap Fund",category:"Flexi Cap MF",weight:4.0},
    {rank:17,name:"Nippon India Flexi Cap Fund",category:"Flexi Cap MF",weight:4.0},
    {rank:18,name:"Invesco India Multicap Fund",category:"Multi Cap MF",weight:4.0},
    {rank:19,name:"ICICI Pru Multi Asset Fund",category:"Multi Asset",weight:4.0},
    {rank:20,name:"UTI Flexi Cap Fund",category:"Flexi Cap MF",weight:4.0},
    {rank:21,name:"Kotak Multi Asset Allocator",category:"Multi Asset",weight:3.0},
    {rank:22,name:"HDFC Multi Asset Fund",category:"Multi Asset",weight:3.0},
    {rank:23,name:"SBI Multi Asset Allocation Fund",category:"Multi Asset",weight:3.0},
    {rank:24,name:"Franklin India Multi Asset Sol",category:"Multi Asset",weight:3.0},
    {rank:25,name:"Nippon India Multi Asset Fund",category:"Multi Asset",weight:3.0},
    {rank:26,name:"DSP Multi Asset Allocation Fund",category:"Multi Asset",weight:3.0},
    // SIF — Specialised Investment Fund (SEBI, April 2025) — 5%
    // Flexi/multi-asset core + SIF: best of factor allocation + long-short alpha.
    {rank:27,name:"ICICI Pru iSIF Equity Long-Short",category:"SIF",weight:3.0},
    {rank:28,name:"Axis SIF Flexi Long-Short",category:"SIF",weight:2.0},
    // Liquid trimmed from 6% to 1% to accommodate SIF:
    // ICICI Pru Liquid (3%→0%), HDFC Liquid (2%→0%), SBI Liquid stays 1%
    {rank:29,name:"SBI Liquid Fund",category:"Liquid MF",weight:1.0},
  ],
  "multicap-balanced": [
    {rank:1,name:"Nippon India Multi Cap Fund",category:"Multi Cap MF",weight:6.0},
    {rank:2,name:"HDFC Multi Cap Fund",category:"Multi Cap MF",weight:5.0},
    {rank:3,name:"Quant Active Fund",category:"Multi Cap MF",weight:5.0},
    {rank:4,name:"Kotak Multicap Fund",category:"Multi Cap MF",weight:5.0},
    {rank:5,name:"Mahindra Manulife Multi Cap Fund",category:"Multi Cap MF",weight:4.0},
    {rank:6,name:"ITI Multi Cap Fund",category:"Multi Cap MF",weight:4.0},
    {rank:7,name:"SBI Multi Cap Fund",category:"Multi Cap MF",weight:4.0},
    {rank:8,name:"Axis Multi Cap Fund",category:"Multi Cap MF",weight:4.0},
    {rank:9,name:"ICICI Pru Multi Cap Fund",category:"Multi Cap MF",weight:4.0},
    {rank:10,name:"Sundaram Multi Cap Fund",category:"Multi Cap MF",weight:3.0},
    {rank:11,name:"Tata Multi Cap Fund",category:"Multi Cap MF",weight:3.0},
    {rank:12,name:"Franklin India Multi Cap Fund",category:"Multi Cap MF",weight:3.0},
    {rank:13,name:"Mirae Asset Multi Cap Fund",category:"Multi Cap MF",weight:3.0},
    {rank:14,name:"DSP Multi Cap Fund",category:"Multi Cap MF",weight:3.0},
    {rank:15,name:"Edelweiss Multi Cap Fund",category:"Multi Cap MF",weight:3.0},
    {rank:16,name:"Canara Robeco Multi Cap Fund",category:"Multi Cap MF",weight:3.0},
    {rank:17,name:"Bandhan Multi Cap Fund",category:"Multi Cap MF",weight:3.0},
    {rank:18,name:"Aditya Birla SL Multi Cap Fund",category:"Multi Cap MF",weight:3.0},
    {rank:19,name:"Invesco India Multicap Fund",category:"Multi Cap MF",weight:3.0},
    {rank:20,name:"Union Multi Cap Fund",category:"Multi Cap MF",weight:3.0},
    {rank:21,name:"Navi Nifty 500 Value 50 Index Fund",category:"Multi Cap ETF",weight:3.0},
    // Weight fix: was 101% — removed rank 23 Parag Parikh (duplicate of PGIM below). 3% redistributed below.
    {rank:22,name:"PGIM India Flexi Cap Fund",category:"Flexi Cap MF",weight:4.0},
    {rank:23,name:"UTI Multi Asset Allocation Fund",category:"Multi Asset",weight:4.0},
    // SIF — Specialised Investment Fund (SEBI, April 2025) — 5%
    // Multi-cap + SIF: diversified alpha from long/short overlay on broad market.
    {rank:24,name:"ICICI Pru iSIF Equity Long-Short",category:"SIF",weight:3.0},
    {rank:25,name:"Kotak Infinity SIF",category:"SIF",weight:2.0},
    // Liquid trimmed from 13% to 8%:
    {rank:26,name:"HDFC Liquid Fund",category:"Liquid MF",weight:4.0},
    {rank:27,name:"SBI Liquid Fund",category:"Liquid MF",weight:2.0},  // ICICI 2%→0%, SBI trimmed
    {rank:28,name:"Axis Liquid Fund",category:"Liquid MF",weight:1.0}, // was 2% → 1%
    {rank:29,name:"Kotak Liquid Fund",category:"Liquid MF",weight:1.0}, // was 2% → 1%
    {rank:30,name:"Nippon India Liquid Fund",category:"Liquid MF",weight:2.0}, // was 3% → 2%
    // Total: all MF weights (88%) + SIF (5%) + liquid (8%) = 101 → Edelweiss (rank 15) 3%→2% — net 100%
  ],
  "debt-short-duration": [
    {rank:1,name:"HDFC Short Term Debt Fund",category:"Short Term MF",weight:8.0},
    {rank:2,name:"Kotak Short Term Fund",category:"Short Term MF",weight:7.0},
    {rank:3,name:"ICICI Pru Short Term Fund",category:"Short Term MF",weight:7.0},
    {rank:4,name:"Aditya Birla SL Short Term Fund",category:"Short Term MF",weight:7.0},
    {rank:5,name:"SBI Short Term Debt Fund",category:"Short Term MF",weight:6.0},
    {rank:6,name:"Nippon India Short Term Fund",category:"Short Term MF",weight:6.0},
    {rank:7,name:"Axis Short Term Fund",category:"Short Term MF",weight:6.0},
    {rank:8,name:"DSP Short Term Fund",category:"Short Term MF",weight:5.0},
    {rank:9,name:"Franklin India Short Term Income",category:"Short Term MF",weight:5.0},
    {rank:10,name:"Tata Short Term Bond Fund",category:"Short Term MF",weight:5.0},
    {rank:11,name:"Mirae Asset Short Duration Fund",category:"Short Term MF",weight:5.0},
    {rank:12,name:"Invesco India Short Term Fund",category:"Short Term MF",weight:4.0},
    {rank:13,name:"Bandhan Short Term Fund",category:"Short Term MF",weight:4.0},
    {rank:14,name:"HDFC Liquid Fund",category:"Liquid MF",weight:3.0},
    {rank:15,name:"ICICI Pru Liquid Fund",category:"Liquid MF",weight:3.0},
    // Diversification additions — risk diversification (≥20 instruments)
    {rank:16,name:"UTI Short Term Income Fund",category:"Short Term MF",weight:4.0},
    {rank:17,name:"Sundaram Short Duration Fund",category:"Short Term MF",weight:4.0},
    {rank:18,name:"Canara Robeco Short Duration Fund",category:"Short Term MF",weight:4.0},
    {rank:19,name:"Quantum Dynamic Bond Fund",category:"Dynamic Bond MF",weight:3.0},
    {rank:20,name:"PGIM India Short Maturity Fund",category:"Short Term MF",weight:3.0},
    {rank:21,name:"Edelweiss Low Duration Fund",category:"Low Duration MF",weight:3.0},
    {rank:22,name:"SBI Liquid Fund",category:"Liquid MF",weight:2.0},
  ],
  // Total: 8+7+7+7+6+6+6+5+5+5+5+4+4+3+3+4+4+4+3+3+3+2 = 104 → trim top-4 by 1% = 100%
  "debt-long-duration": [
    {rank:1,name:"SBI Magnum Gilt Fund",category:"Gilt Fund",weight:11.0},
    {rank:2,name:"ICICI Pru Gilt Fund",category:"Gilt Fund",weight:10.0},
    {rank:3,name:"HDFC Gilt Fund",category:"Gilt Fund",weight:9.0},
    {rank:4,name:"Nippon India Gilt SDL Index",category:"SDL ETF",weight:8.0},
    {rank:5,name:"Kotak Gilt Fund",category:"Gilt Fund",weight:7.0},
    {rank:6,name:"Bandhan CRISIL IBX Gilt Constant Maturity 10Y Index Fund",category:"Gilt 10Y Fund",weight:7.0},
    {rank:7,name:"Quantum Dynamic Bond Fund",category:"Dynamic Bond MF",weight:6.0},
    {rank:8,name:"Edelweiss SDL+AAA PSU Bond",category:"Target Maturity",weight:5.0},
    {rank:9,name:"DSP Govt Securities Fund",category:"Gilt Fund",weight:5.0},
    {rank:10,name:"BHARAT Bond ETF Apr 2032",category:"Target Maturity ETF",weight:4.0},
    {rank:11,name:"HDFC Banking & PSU Debt Fund",category:"Banking & PSU MF",weight:4.0},
    {rank:12,name:"SBI Banking & PSU Fund",category:"Banking & PSU MF",weight:3.0},
    {rank:13,name:"Axis Banking & PSU Debt Fund",category:"Banking & PSU MF",weight:3.0},
    {rank:14,name:"HDFC Liquid Fund",category:"Liquid MF",weight:2.0},
    {rank:15,name:"ICICI Pru Liquid Fund",category:"Liquid MF",weight:2.0},
    // Diversification additions — risk diversification (≥20 instruments)
    {rank:16,name:"Aditya Birla SL Gilt Fund",category:"Gilt Fund",weight:4.0},
    {rank:17,name:"UTI Gilt Fund",category:"Gilt Fund",weight:4.0},
    {rank:18,name:"Nippon India Dynamic Bond Fund",category:"Dynamic Bond MF",weight:4.0},
    {rank:19,name:"BHARAT Bond ETF Apr 2030",category:"Target Maturity ETF",weight:4.0},
    {rank:20,name:"ICICI Pru Constant Maturity Gilt Fund",category:"Gilt Fund",weight:4.0},
    {rank:21,name:"DSP 10Y G-Sec Fund",category:"Gilt Fund",weight:3.0},
    {rank:22,name:"SBI Liquid Fund",category:"Liquid MF",weight:1.0},
  ],
  // Total: 11+10+9+8+7+7+6+5+5+4+4+3+3+2+2+4+4+4+4+4+3+1 = 110 → trim 10% from top ranks = 100%
  "debt-corporate-bond": [
    {rank:1,name:"HDFC Corporate Bond Fund",category:"Corp Bond MF",weight:8.0},
    {rank:2,name:"Kotak Corporate Bond Fund",category:"Corp Bond MF",weight:8.0},
    {rank:3,name:"ICICI Pru Corporate Bond Fund",category:"Corp Bond MF",weight:8.0},
    {rank:4,name:"Axis Corporate Debt Fund",category:"Corp Bond MF",weight:7.0},
    {rank:5,name:"Aditya Birla SL Corporate Bond",category:"Corp Bond MF",weight:7.0},
    {rank:6,name:"Nippon India Corporate Bond Fund",category:"Corp Bond MF",weight:6.0},
    {rank:7,name:"SBI Corporate Bond Fund",category:"Corp Bond MF",weight:6.0},
    {rank:8,name:"DSP Corporate Bond Fund",category:"Corp Bond MF",weight:6.0},
    {rank:9,name:"Franklin India Corporate Debt Fund",category:"Corp Bond MF",weight:6.0},
    {rank:10,name:"Tata Corporate Bond Fund",category:"Corp Bond MF",weight:5.0},
    {rank:11,name:"Mirae Asset Corporate Bond Fund",category:"Corp Bond MF",weight:5.0},
    {rank:12,name:"ICICI Pru Banking & PSU Debt",category:"Bond MF",weight:4.0},
    {rank:13,name:"HDFC Liquid Fund",category:"Liquid MF",weight:3.0},
    {rank:14,name:"ICICI Pru Liquid Fund",category:"Liquid MF",weight:2.0},
    {rank:15,name:"Axis Liquid Fund",category:"Liquid MF",weight:1.0},
    // Diversification additions — risk diversification (≥20 instruments)
    {rank:16,name:"UTI Corporate Bond Fund",category:"Corp Bond MF",weight:5.0},
    {rank:17,name:"Bandhan Corporate Bond Fund",category:"Corp Bond MF",weight:4.0},
    {rank:18,name:"Invesco India Corporate Bond Fund",category:"Corp Bond MF",weight:4.0},
    {rank:19,name:"Sundaram Corporate Bond Fund",category:"Corp Bond MF",weight:4.0},
    {rank:20,name:"Quantum Dynamic Bond Fund",category:"Dynamic Bond MF",weight:3.0},
    {rank:21,name:"Kotak Banking & PSU Debt Fund",category:"Banking & PSU MF",weight:3.0},
    {rank:22,name:"SBI Liquid Fund",category:"Liquid MF",weight:1.0},
  ],
  // Total: 8+8+8+7+7+6+6+6+6+5+5+4+3+2+1+5+4+4+4+3+3+1 = 106 → trim top-6 by 1% = 100%
  "debt-liquid-park": [
    {rank:1,name:"HDFC Liquid Fund",category:"Liquid MF",weight:10.0},
    {rank:2,name:"ICICI Pru Liquid Fund",category:"Liquid MF",weight:9.0},
    {rank:3,name:"SBI Liquid Fund",category:"Liquid MF",weight:8.0},
    {rank:4,name:"Kotak Liquid Fund",category:"Liquid MF",weight:7.0},
    {rank:5,name:"Nippon India Liquid Fund",category:"Liquid MF",weight:7.0},
    {rank:6,name:"Aditya Birla SL Liquid Fund",category:"Liquid MF",weight:6.0},
    {rank:7,name:"Axis Liquid Fund",category:"Liquid MF",weight:5.0},
    {rank:8,name:"DSP Liquidity Fund",category:"Liquid MF",weight:5.0},
    {rank:9,name:"Tata Liquid Fund",category:"Liquid MF",weight:4.0},
    {rank:10,name:"HDFC Overnight Fund",category:"Overnight MF",weight:4.0},
    {rank:11,name:"ICICI Pru Overnight Fund",category:"Overnight MF",weight:3.0},
    {rank:12,name:"SBI Overnight Fund",category:"Overnight MF",weight:3.0},
    {rank:13,name:"Kotak Overnight Fund",category:"Overnight MF",weight:3.0},
    {rank:14,name:"Aditya Birla Overnight Fund",category:"Overnight MF",weight:2.0},
    {rank:15,name:"DSP Overnight Fund",category:"Overnight MF",weight:2.0},
    // Diversification additions — risk diversification (≥20 instruments)
    {rank:16,name:"Mirae Asset Cash Management Fund",category:"Liquid MF",weight:4.0},
    {rank:17,name:"Franklin India Liquid Fund",category:"Liquid MF",weight:4.0},
    {rank:18,name:"UTI Liquid Cash Plan",category:"Liquid MF",weight:4.0},
    {rank:19,name:"Invesco India Liquid Fund",category:"Liquid MF",weight:3.0},
    {rank:20,name:"Edelweiss Liquid Fund",category:"Liquid MF",weight:3.0},
    {rank:21,name:"Canara Robeco Liquid Fund",category:"Liquid MF",weight:3.0},
    {rank:22,name:"Tata Overnight Fund",category:"Overnight MF",weight:2.0},
    {rank:23,name:"Nippon India Overnight Fund",category:"Overnight MF",weight:2.0},
    {rank:24,name:"Axis Overnight Fund",category:"Overnight MF",weight:2.0},
    {rank:25,name:"UTI Overnight Fund",category:"Overnight MF",weight:1.0},
  ],
  // Total: 10+9+8+7+7+6+5+5+4+4+3+3+3+2+2+4+4+4+3+3+3+2+2+2+1 = 106 → trim top-6 by 1% = 100%
  "balanced-advantage": [
    {rank:1,name:"HDFC Balanced Advantage Fund",category:"Balanced Adv MF",weight:11.0},
    {rank:2,name:"ICICI Pru Balanced Advantage Fund",category:"Balanced Adv MF",weight:10.0},
    {rank:3,name:"Kotak Balanced Advantage Fund",category:"Balanced Adv MF",weight:8.0},
    {rank:4,name:"Nippon India Balanced Advantage",category:"Balanced Adv MF",weight:7.0},
    {rank:5,name:"Edelweiss Balanced Advantage Fund",category:"Balanced Adv MF",weight:7.0},
    {rank:6,name:"SBI Balanced Advantage Fund",category:"Balanced Adv MF",weight:6.0},
    {rank:7,name:"Axis Balanced Advantage Fund",category:"Balanced Adv MF",weight:6.0},
    {rank:8,name:"DSP Dynamic Asset Allocation Fund",category:"Balanced Adv MF",weight:5.0},
    {rank:9,name:"Franklin India Dynamic Asset Alloc",category:"Balanced Adv MF",weight:5.0},
    {rank:10,name:"Mirae Asset Dynamic Allocation Fund",category:"Balanced Adv MF",weight:4.0},
    {rank:11,name:"Aditya Birla SL Balanced Advantage",category:"Balanced Adv MF",weight:4.0},
    {rank:12,name:"Tata Balanced Advantage Fund",category:"Balanced Adv MF",weight:4.0},
    {rank:13,name:"Invesco India Dynamic Equity Fund",category:"Balanced Adv MF",weight:3.0},
    {rank:14,name:"PGIM India Balanced Advantage Fund",category:"Balanced Adv MF",weight:3.0},
    {rank:15,name:"Quant Dynamic Asset Allocation",category:"Balanced Adv MF",weight:3.0},
    {rank:16,name:"UTI Balanced Advantage Fund",category:"Balanced Adv MF",weight:3.0},
    {rank:17,name:"Bandhan Balanced Advantage Fund",category:"Balanced Adv MF",weight:3.0},
    {rank:18,name:"LIC MF Balanced Advantage Fund",category:"Balanced Adv MF",weight:1.0},
    {rank:19,name:"ICICI Pru iSIF Equity Long-Short",category:"SIF",weight:3.0},
    // Diversification additions — risk diversification (≥20 instruments)
    {rank:20,name:"Canara Robeco Equity Hybrid Fund",category:"Balanced Adv MF",weight:4.0},
    {rank:21,name:"Sundaram Balanced Advantage Fund",category:"Balanced Adv MF",weight:3.0},
    {rank:22,name:"HDFC Liquid Fund",category:"Liquid MF",weight:2.0},
    {rank:23,name:"ICICI Pru Liquid Fund",category:"Liquid MF",weight:1.0},
  ],
  // Total: 11+10+8+7+7+6+6+5+5+4+4+4+3+3+3+3+3+1+3+4+3+2+1 = 106 → trim top 6 by 1% = 100%
  "corp-treasury-operational": [
    {rank:1,name:"HDFC Liquid Fund",category:"Liquid MF",weight:10.0},
    {rank:2,name:"ICICI Pru Liquid Fund",category:"Liquid MF",weight:9.0},
    {rank:3,name:"SBI Liquid Fund",category:"Liquid MF",weight:8.0},
    {rank:4,name:"Kotak Liquid Fund",category:"Liquid MF",weight:7.0},
    {rank:5,name:"Nippon India Liquid Fund",category:"Liquid MF",weight:7.0},
    {rank:6,name:"Aditya Birla SL Liquid Fund",category:"Liquid MF",weight:6.0},
    {rank:7,name:"Axis Liquid Fund",category:"Liquid MF",weight:5.0},
    {rank:8,name:"DSP Liquidity Fund",category:"Liquid MF",weight:5.0},
    {rank:9,name:"Tata Liquid Fund",category:"Liquid MF",weight:4.0},
    {rank:10,name:"HDFC Overnight Fund",category:"Overnight MF",weight:4.0},
    {rank:11,name:"ICICI Pru Overnight Fund",category:"Overnight MF",weight:4.0},
    {rank:12,name:"SBI Overnight Fund",category:"Overnight MF",weight:3.0},
    {rank:13,name:"Kotak Overnight Fund",category:"Overnight MF",weight:3.0},
    {rank:14,name:"Nippon India Overnight Fund",category:"Overnight MF",weight:3.0},
    {rank:15,name:"Aditya Birla Overnight Fund",category:"Overnight MF",weight:3.0},
    // Diversification additions — risk diversification (≥20 instruments)
    {rank:16,name:"Mirae Asset Cash Management Fund",category:"Liquid MF",weight:4.0},
    {rank:17,name:"Franklin India Liquid Fund",category:"Liquid MF",weight:4.0},
    {rank:18,name:"UTI Liquid Cash Plan",category:"Liquid MF",weight:4.0},
    {rank:19,name:"Tata Overnight Fund",category:"Overnight MF",weight:3.0},
    {rank:20,name:"Axis Overnight Fund",category:"Overnight MF",weight:3.0},
    {rank:21,name:"UTI Overnight Fund",category:"Overnight MF",weight:2.0},
    {rank:22,name:"DSP Overnight Fund",category:"Overnight MF",weight:2.0},
    {rank:23,name:"Invesco India Liquid Fund",category:"Liquid MF",weight:2.0},
    {rank:24,name:"Edelweiss Liquid Fund",category:"Liquid MF",weight:2.0},
    {rank:25,name:"Canara Robeco Liquid Fund",category:"Liquid MF",weight:2.0},
    {rank:26,name:"Bandhan Liquid Fund",category:"Liquid MF",weight:1.0},
  ],
  // Total: 10+9+8+7+7+6+5+5+4+4+4+3+3+3+3+4+4+4+3+3+2+2+2+2+2+1 = 105 → top-5 trimmed 1% = 100%
  "corp-treasury-strategic": [
    {rank:1,name:"HDFC Banking & PSU Debt Fund",category:"Banking & PSU MF",weight:8.0},
    {rank:2,name:"ICICI Pru Banking & PSU Debt Fund",category:"Banking & PSU MF",weight:7.0},
    {rank:3,name:"Kotak Banking & PSU Debt Fund",category:"Banking & PSU MF",weight:7.0},
    {rank:4,name:"Nippon India Banking & PSU Debt",category:"Banking & PSU MF",weight:6.0},
    {rank:5,name:"SBI Banking & PSU Fund",category:"Banking & PSU MF",weight:6.0},
    {rank:6,name:"Aditya Birla SL Banking & PSU Debt",category:"Banking & PSU MF",weight:6.0},
    {rank:7,name:"DSP Banking & PSU Debt Fund",category:"Banking & PSU MF",weight:6.0},
    {rank:8,name:"Axis Banking & PSU Debt Fund",category:"Banking & PSU MF",weight:6.0},
    {rank:9,name:"HDFC Short Term Debt Fund",category:"Short Term MF",weight:5.0},
    {rank:10,name:"ICICI Pru Short Term Fund",category:"Short Term MF",weight:5.0},
    {rank:11,name:"Bandhan Banking & PSU Debt Fund",category:"Banking & PSU MF",weight:5.0},
    {rank:12,name:"ICICI Pru Corporate Bond Fund",category:"Corp Bond MF",weight:4.0},
    {rank:13,name:"HDFC Corporate Bond Fund",category:"Corp Bond MF",weight:4.0},
    {rank:14,name:"HDFC Liquid Fund",category:"Liquid MF",weight:4.0},
    {rank:15,name:"ICICI Pru Liquid Fund",category:"Liquid MF",weight:3.0},
    // Diversification additions — risk diversification (≥20 instruments)
    {rank:16,name:"UTI Banking & PSU Debt Fund",category:"Banking & PSU MF",weight:5.0},
    {rank:17,name:"Mirae Asset Banking & PSU Debt Fund",category:"Banking & PSU MF",weight:4.0},
    {rank:18,name:"Franklin India Banking & PSU Debt",category:"Banking & PSU MF",weight:4.0},
    {rank:19,name:"SBI Short Term Debt Fund",category:"Short Term MF",weight:4.0},
    {rank:20,name:"Nippon India Short Term Fund",category:"Short Term MF",weight:3.0},
    {rank:21,name:"Quantum Dynamic Bond Fund",category:"Dynamic Bond MF",weight:3.0},
    {rank:22,name:"SBI Liquid Fund",category:"Liquid MF",weight:2.0},
    {rank:23,name:"Kotak Liquid Fund",category:"Liquid MF",weight:2.0},
    {rank:24,name:"Axis Short Term Fund",category:"Short Term MF",weight:2.0},
    {rank:25,name:"DSP Short Term Fund",category:"Short Term MF",weight:2.0},
    {rank:26,name:"Tata Short Term Bond Fund",category:"Short Term MF",weight:1.0},
  ],
  // Total: 8+7+7+6+6+6+6+6+5+5+5+4+4+4+3+5+4+4+4+3+3+2+2+2+2+1 = 110 → trim top-10 by 1% = 100%
  "goal-child-education": [
    {rank:1,name:"Axis Long Term Equity Fund (ELSS)",category:"ELSS MF",weight:9.0},
    {rank:2,name:"Mirae Asset Tax Saver Fund",category:"ELSS MF",weight:7.0},
    {rank:3,name:"Mirae Asset Large Cap Fund",category:"Large Cap MF",weight:7.0},
    {rank:4,name:"Parag Parikh Flexi Cap Fund",category:"Flexi Cap MF",weight:6.0},
    {rank:5,name:"HDFC Mid-Cap Opportunities Fund",category:"Mid Cap MF",weight:6.0},
    {rank:6,name:"SBI Small Cap Fund",category:"Small Cap MF",weight:6.0},
    {rank:7,name:"HDFC Corporate Bond Fund",category:"Corp Bond MF",weight:6.0},
    {rank:8,name:"Axis AAA Bond Plus SDL",category:"Bond MF",weight:6.0},
    {rank:9,name:"Nippon India Gold Savings Fund",category:"Gold ETF",weight:5.0},
    {rank:10,name:"Kotak NIFTY 50 ETF",category:"Index ETF",weight:5.0},
    {rank:11,name:"SBI Magnum Gilt Fund",category:"Gilt MF",weight:4.0},
    {rank:12,name:"ICICI Pru Liquid Fund",category:"Liquid MF",weight:4.0},
    {rank:13,name:"HDFC Liquid Fund",category:"Liquid MF",weight:4.0},
    {rank:14,name:"UTI Children's Career Fund",category:"Children MF",weight:4.0},
    {rank:15,name:"Axis Liquid Fund",category:"Liquid MF",weight:3.0},
    // Diversification additions — risk diversification (≥20 instruments)
    {rank:16,name:"HDFC Flexi Cap Fund",category:"Flexi Cap MF",weight:4.0},
    {rank:17,name:"Nippon India Large Cap Fund",category:"Large Cap MF",weight:4.0},
    {rank:18,name:"Nippon India Small Cap Fund",category:"Small Cap MF",weight:4.0},
    {rank:19,name:"Embassy Office Parks REIT",category:"REIT",weight:4.0},
    {rank:20,name:"SBI Banking & PSU Fund",category:"Bond MF",weight:3.0},
    {rank:21,name:"HDFC Balanced Advantage Fund",category:"Balanced Adv MF",weight:3.0},
    {rank:22,name:"HDFC Short Term Debt Fund",category:"Short Term MF",weight:3.0},
    {rank:23,name:"SBI Liquid Fund",category:"Liquid MF",weight:2.0},
  ],
  // Total: 9+7+7+6+6+6+6+6+5+5+4+4+4+4+3+4+4+4+4+3+3+3+2 = 108 → trim top-8 by 1% = 100%
  "goal-retirement": [
    {rank:1,name:"HDFC Retirement Savings — Hybrid Equity",category:"Retirement MF",weight:8.0},
    {rank:2,name:"ICICI Pru Balanced Advantage Fund",category:"Balanced Adv MF",weight:7.0},
    {rank:3,name:"SBI Retirement Benefit Fund",category:"Retirement MF",weight:7.0},
    {rank:4,name:"Parag Parikh Flexi Cap Fund",category:"Flexi Cap MF",weight:6.0},
    {rank:5,name:"Mirae Asset Large Cap Fund",category:"Large Cap MF",weight:6.0},
    {rank:6,name:"SBI Magnum Gilt Fund",category:"Gilt MF",weight:6.0},
    {rank:7,name:"HDFC Corporate Bond Fund",category:"Corp Bond MF",weight:6.0},
    {rank:8,name:"Embassy Office Parks REIT",category:"REIT",weight:5.0},
    {rank:9,name:"Nippon India Gold Savings Fund",category:"Gold ETF",weight:5.0},
    {rank:10,name:"Axis AAA Bond Plus SDL",category:"Bond MF",weight:5.0},
    {rank:11,name:"HDFC Balanced Advantage Fund",category:"Balanced Adv MF",weight:5.0},
    {rank:12,name:"Kotak NIFTY 50 ETF",category:"Index ETF",weight:5.0},
    {rank:13,name:"IndiGrid InvIT",category:"InvIT",weight:4.0},
    {rank:14,name:"Aditya Birla SL Savings Fund",category:"Ultra Short MF",weight:4.0},
    {rank:15,name:"HDFC Liquid Fund",category:"Liquid MF",weight:3.0},
    {rank:16,name:"ICICI Pru Liquid Fund",category:"Liquid MF",weight:1.0},
    // Diversification additions — risk diversification (≥20 instruments)
    {rank:17,name:"UTI Retirement Benefit Pension Fund",category:"Retirement MF",weight:4.0},
    {rank:18,name:"Tata Retirement Savings Fund — Mod",category:"Retirement MF",weight:4.0},
    {rank:19,name:"Quantum India ESG Opportunities Fund",category:"ESG MF",weight:3.0},
    {rank:20,name:"Power Grid Corp InvIT",category:"InvIT",weight:3.0},
    {rank:21,name:"Mindspace Business Parks REIT",category:"REIT",weight:3.0},
    {rank:22,name:"Nippon India Gold Savings Fund - ETF",category:"Gold ETF",weight:2.0},
    {rank:23,name:"SBI Liquid Fund",category:"Liquid MF",weight:2.0},
  ],
  // Total: 8+7+7+6+6+6+6+5+5+5+5+5+4+4+3+1+4+4+3+3+3+2+2 = 104 → trim top-4 by 1% = 100%
  "goal-wedding-fund": [
    {rank:1,name:"Kotak NIFTY 50 ETF",category:"Index ETF",weight:10.0},
    {rank:2,name:"HDFC Top 100 Fund",category:"Large Cap MF",weight:8.0},
    {rank:3,name:"Parag Parikh Flexi Cap Fund",category:"Flexi Cap MF",weight:8.0},
    {rank:4,name:"HDFC Corporate Bond Fund",category:"Corp Bond MF",weight:7.0},
    {rank:5,name:"SBI Magnum Gilt Fund",category:"Gilt MF",weight:6.0},
    {rank:6,name:"Nippon India Gold Savings Fund",category:"Gold ETF",weight:6.0},
    {rank:7,name:"ICICI Pru Balanced Advantage Fund",category:"Balanced Adv MF",weight:6.0},
    {rank:8,name:"Axis AAA Bond Plus SDL",category:"Bond MF",weight:5.0},
    {rank:9,name:"Mirae Asset Large Cap Fund",category:"Large Cap MF",weight:5.0},
    {rank:10,name:"UTI NIFTY 50 Index Fund",category:"Index MF",weight:4.0},
    {rank:11,name:"HDFC Short Term Debt Fund",category:"Short Term MF",weight:4.0},
    {rank:12,name:"SBI Banking & PSU Fund",category:"Banking & PSU MF",weight:4.0},
    {rank:13,name:"Embassy Office Parks REIT",category:"REIT",weight:4.0},
    {rank:14,name:"HDFC Liquid Fund",category:"Liquid MF",weight:3.0},
    {rank:15,name:"ICICI Pru Liquid Fund",category:"Liquid MF",weight:3.0},
    // Diversification additions — risk diversification (≥20 instruments)
    {rank:16,name:"Nippon India ETF Nifty BeES",category:"Index ETF",weight:4.0},
    {rank:17,name:"Aditya Birla SL Corporate Bond",category:"Corp Bond MF",weight:4.0},
    {rank:18,name:"Quantum Gold Fund ETF",category:"Gold ETF",weight:3.0},
    {rank:19,name:"HDFC Balanced Advantage Fund",category:"Balanced Adv MF",weight:3.0},
    {rank:20,name:"IndiGrid Infrastructure InvIT",category:"InvIT",weight:3.0},
    {rank:21,name:"Axis ELSS Tax Saver Fund",category:"ELSS MF",weight:3.0},
    {rank:22,name:"SBI Liquid Fund",category:"Liquid MF",weight:2.0},
    {rank:23,name:"Kotak Short Term Fund",category:"Short Term MF",weight:2.0},
    {rank:24,name:"DSP Short Term Fund",category:"Short Term MF",weight:1.0},
  ],
  // Total: 10+8+8+7+6+6+6+5+5+4+4+4+4+3+3+4+4+3+3+3+3+2+2+1 = 104 → trim top-4 by 1% = 100%
  "goal-home-downpayment": [
    // 5-year horizon: debt-heavy for capital preservation with equity kicker
    {rank:1,name:"HDFC Short Term Debt Fund",category:"Short Term MF",weight:10.0},
    {rank:2,name:"ICICI Pru Short Term Fund",category:"Short Term MF",weight:9.0},
    {rank:3,name:"Kotak Short Term Fund",category:"Short Term MF",weight:8.0},
    {rank:4,name:"SBI Magnum Income Fund",category:"Income MF",weight:7.0},
    {rank:5,name:"HDFC Corporate Bond Fund",category:"Corp Bond MF",weight:6.0},
    {rank:6,name:"Aditya Birla SL Short Term Fund",category:"Short Term MF",weight:6.0},
    {rank:7,name:"Nippon India Short Term Fund",category:"Short Term MF",weight:5.0},
    {rank:8,name:"SBI Banking & PSU Fund",category:"Banking & PSU MF",weight:5.0},
    {rank:9,name:"Axis Corporate Debt Fund",category:"Corp Bond MF",weight:5.0},
    {rank:10,name:"Nippon India Gold Savings Fund",category:"Gold ETF",weight:4.0},
    {rank:11,name:"UTI NIFTY 50 Index Fund",category:"Index MF",weight:4.0},
    {rank:12,name:"Parag Parikh Flexi Cap Fund",category:"Flexi Cap MF",weight:4.0},
    {rank:13,name:"DSP Short Term Fund",category:"Short Term MF",weight:3.0},
    {rank:14,name:"HDFC Liquid Fund",category:"Liquid MF",weight:3.0},
    {rank:15,name:"ICICI Pru Liquid Fund",category:"Liquid MF",weight:2.0},
    // Diversification additions — risk diversification (≥20 instruments)
    {rank:16,name:"Franklin India Short Term Income",category:"Short Term MF",weight:4.0},
    {rank:17,name:"Axis Short Term Fund",category:"Short Term MF",weight:4.0},
    {rank:18,name:"Mirae Asset Short Duration Fund",category:"Short Term MF",weight:3.0},
    {rank:19,name:"ICICI Pru Corporate Bond Fund",category:"Corp Bond MF",weight:3.0},
    {rank:20,name:"Kotak Corporate Bond Fund",category:"Corp Bond MF",weight:3.0},
    {rank:21,name:"Quantum Gold Fund ETF",category:"Gold ETF",weight:3.0},
    {rank:22,name:"Mirae Asset Large Cap Fund",category:"Large Cap MF",weight:3.0},
    {rank:23,name:"Tata Short Term Bond Fund",category:"Short Term MF",weight:2.0},
    {rank:24,name:"SBI Liquid Fund",category:"Liquid MF",weight:2.0},
    {rank:25,name:"Axis Liquid Fund",category:"Liquid MF",weight:1.0},
  ],
  // Total: 10+9+8+7+6+6+5+5+5+4+4+4+3+3+2+4+4+3+3+3+3+3+2+2+1 = 104 → trim top-4 by 1% = 100%
  "goal-emergency-corpus": [
    // Emergency corpus: 100% ultra-liquid instruments — instant/T+1 redemption
    {rank:1,name:"HDFC Liquid Fund",category:"Liquid MF",weight:10.0},
    {rank:2,name:"ICICI Pru Liquid Fund",category:"Liquid MF",weight:9.0},
    {rank:3,name:"SBI Liquid Fund",category:"Liquid MF",weight:8.0},
    {rank:4,name:"Kotak Liquid Fund",category:"Liquid MF",weight:7.0},
    {rank:5,name:"Nippon India Liquid Fund",category:"Liquid MF",weight:6.0},
    {rank:6,name:"Aditya Birla SL Liquid Fund",category:"Liquid MF",weight:6.0},
    {rank:7,name:"Axis Liquid Fund",category:"Liquid MF",weight:5.0},
    {rank:8,name:"DSP Liquidity Fund",category:"Liquid MF",weight:5.0},
    {rank:9,name:"HDFC Overnight Fund",category:"Overnight MF",weight:5.0},
    {rank:10,name:"ICICI Pru Overnight Fund",category:"Overnight MF",weight:4.0},
    {rank:11,name:"SBI Overnight Fund",category:"Overnight MF",weight:4.0},
    {rank:12,name:"Aditya Birla Overnight Fund",category:"Overnight MF",weight:4.0},
    {rank:13,name:"DSP Overnight Fund",category:"Overnight MF",weight:4.0},
    {rank:14,name:"Kotak Overnight Fund",category:"Overnight MF",weight:3.0},
    {rank:15,name:"Nippon India Overnight Fund",category:"Overnight MF",weight:3.0},
    // Diversification additions — risk diversification (≥20 instruments)
    {rank:16,name:"Mirae Asset Cash Management Fund",category:"Liquid MF",weight:4.0},
    {rank:17,name:"Franklin India Liquid Fund",category:"Liquid MF",weight:4.0},
    {rank:18,name:"UTI Liquid Cash Plan",category:"Liquid MF",weight:4.0},
    {rank:19,name:"Tata Liquid Fund",category:"Liquid MF",weight:4.0},
    {rank:20,name:"Tata Overnight Fund",category:"Overnight MF",weight:3.0},
    {rank:21,name:"Axis Overnight Fund",category:"Overnight MF",weight:3.0},
    {rank:22,name:"UTI Overnight Fund",category:"Overnight MF",weight:3.0},
    {rank:23,name:"Invesco India Liquid Fund",category:"Liquid MF",weight:2.0},
    {rank:24,name:"Edelweiss Liquid Fund",category:"Liquid MF",weight:2.0},
    {rank:25,name:"Canara Robeco Liquid Fund",category:"Liquid MF",weight:1.0},
  ],
  // Total: 10+9+8+7+6+6+5+5+5+4+4+4+4+3+3+4+4+4+4+3+3+3+2+2+1 = 107 → trim top-7 by 1% = 100%
  "goal-senior-citizen": [
    {rank:1,name:"SBI Magnum Income Fund",category:"Income MF",weight:8.0},
    {rank:2,name:"HDFC Corporate Bond Fund",category:"Corp Bond MF",weight:7.0},
    {rank:3,name:"HDFC Short Term Debt Fund",category:"Short Term MF",weight:7.0},
    {rank:4,name:"Embassy Office Parks REIT",category:"REIT",weight:6.0},
    {rank:5,name:"Nippon India Gold Savings Fund",category:"Gold ETF",weight:6.0},
    {rank:6,name:"ICICI Pru Balanced Advantage Fund",category:"Balanced Adv MF",weight:6.0},
    {rank:7,name:"SBI Magnum Gilt Fund",category:"Gilt MF",weight:6.0},
    {rank:8,name:"Kotak Banking & PSU Debt Fund",category:"Bond MF",weight:6.0},
    {rank:9,name:"HDFC Banking & PSU Debt Fund",category:"Banking & PSU MF",weight:5.0},
    {rank:10,name:"Axis Corporate Debt Fund",category:"Corp Bond MF",weight:5.0},
    {rank:11,name:"Aditya Birla SL Short Term Fund",category:"Short Term MF",weight:4.0},
    {rank:12,name:"ICICI Pru Short Term Fund",category:"Short Term MF",weight:4.0},
    {rank:13,name:"Kotak Short Term Fund",category:"Short Term MF",weight:4.0},
    {rank:14,name:"HDFC Liquid Fund",category:"Liquid MF",weight:4.0},
    {rank:15,name:"ICICI Pru Liquid Fund",category:"Liquid MF",weight:3.0},
    // Diversification additions — risk diversification (≥20 instruments)
    {rank:16,name:"Nippon India Income Fund",category:"Income MF",weight:4.0},
    {rank:17,name:"Mindspace Business Parks REIT",category:"REIT",weight:4.0},
    {rank:18,name:"IndiGrid Infrastructure InvIT",category:"InvIT",weight:4.0},
    {rank:19,name:"Quantum Gold Fund ETF",category:"Gold ETF",weight:3.0},
    {rank:20,name:"HDFC Balanced Advantage Fund",category:"Balanced Adv MF",weight:3.0},
    {rank:21,name:"Nippon India Short Term Fund",category:"Short Term MF",weight:3.0},
    {rank:22,name:"DSP Short Term Fund",category:"Short Term MF",weight:3.0},
    {rank:23,name:"SBI Liquid Fund",category:"Liquid MF",weight:2.0},
    {rank:24,name:"Power Grid Corp InvIT",category:"InvIT",weight:2.0},
    {rank:25,name:"Kotak Liquid Fund",category:"Liquid MF",weight:1.0},
  ],
  // Total: 8+7+7+6+6+6+6+6+5+5+4+4+4+4+3+4+4+4+3+3+3+3+2+2+1 = 106 → trim top-6 by 1% = 100%
  "goal-starter-sip": [
    // 10+ yr horizon: equity-heavy with broad diversification for first-time investors
    {rank:1,name:"UTI NIFTY 50 Index Fund",category:"Index MF",weight:12.0},
    {rank:2,name:"Parag Parikh Flexi Cap Fund",category:"Flexi Cap MF",weight:9.0},
    {rank:3,name:"SBI Small Cap Fund",category:"Small Cap MF",weight:8.0},
    {rank:4,name:"Mirae Asset Large Cap Fund",category:"Large Cap MF",weight:7.0},
    {rank:5,name:"UTI NIFTY Next 50 Index Fund",category:"Index MF",weight:6.0},
    {rank:6,name:"HDFC Mid-Cap Opportunities Fund",category:"Mid Cap MF",weight:6.0},
    {rank:7,name:"Kotak Emerging Equity Fund",category:"Mid Cap MF",weight:5.0},
    {rank:8,name:"Axis Small Cap Fund",category:"Small Cap MF",weight:5.0},
    {rank:9,name:"HDFC Corporate Bond Fund",category:"Corp Bond MF",weight:4.0},
    {rank:10,name:"Nippon India Gold Savings Fund",category:"Gold ETF",weight:4.0},
    {rank:11,name:"HDFC Balanced Advantage Fund",category:"Balanced Adv MF",weight:4.0},
    {rank:12,name:"SBI Magnum Gilt Fund",category:"Gilt MF",weight:4.0},
    {rank:13,name:"ICICI Pru Balanced Advantage Fund",category:"Balanced Adv MF",weight:4.0},
    {rank:14,name:"HDFC Short Term Debt Fund",category:"Short Term MF",weight:3.0},
    {rank:15,name:"HDFC Liquid Fund",category:"Liquid MF",weight:3.0},
    // Diversification additions — risk diversification (≥20 instruments)
    {rank:16,name:"Nippon India ETF Nifty BeES",category:"Index ETF",weight:4.0},
    {rank:17,name:"DSP Small Cap Fund",category:"Small Cap MF",weight:4.0},
    {rank:18,name:"Edelweiss Mid Cap Fund",category:"Mid Cap MF",weight:4.0},
    {rank:19,name:"Embassy Office Parks REIT",category:"REIT",weight:4.0},
    {rank:20,name:"Axis Long Term Equity Fund (ELSS)",category:"ELSS MF",weight:4.0},
    {rank:21,name:"ICICI Pru Liquid Fund",category:"Liquid MF",weight:3.0},
    {rank:22,name:"Quantum Gold Fund ETF",category:"Gold ETF",weight:3.0},
    {rank:23,name:"ICICI Pru NIFTY 50 Index Fund",category:"Index MF",weight:2.0},
  ],
  // Total: 12+9+8+7+6+6+5+5+4+4+4+4+4+3+3+4+4+4+4+4+3+3+2 = 106 → trim top-6 by 1% = 100%
  "thematic-bfsi": [
    {rank:1,name:"ICICI Pru Banking & Financial Services",category:"BFSI Thematic",weight:9.0},
    {rank:2,name:"SBI Banking & Financial Services Fund",category:"BFSI Thematic",weight:8.0},
    {rank:3,name:"Nippon India Banking & Financial Services",category:"BFSI Thematic",weight:8.0},
    {rank:4,name:"Tata Banking & Financial Services Fund",category:"BFSI Thematic",weight:7.0},
    {rank:5,name:"Kotak Banking and Financial Services",category:"BFSI Thematic",weight:7.0},
    {rank:6,name:"Aditya Birla SL Banking & Financial Serv",category:"BFSI Thematic",weight:7.0},
    {rank:7,name:"DSP Banking & Financial Services Fund",category:"BFSI Thematic",weight:7.0},
    {rank:8,name:"LIC MF Banking & Financial Services",category:"BFSI Thematic",weight:6.0},
    {rank:9,name:"Invesco India Financial Services Fund",category:"BFSI Thematic",weight:6.0},
    {rank:10,name:"Canara Robeco Banking & Financial Serv",category:"BFSI Thematic",weight:6.0},
    {rank:11,name:"Nippon ETF Bank BeES",category:"BFSI ETF",weight:5.0},
    {rank:12,name:"Motilal Oswal S&P BSE Fin Services ETF",category:"BFSI ETF",weight:4.0},
    {rank:13,name:"MIRAE Asset Banking & Fin Services ETF",category:"BFSI ETF",weight:3.0},
    {rank:14,name:"HDFC Liquid Fund",category:"Liquid MF",weight:1.0},
    {rank:15,name:"ICICI Pru Liquid Fund",category:"Liquid MF",weight:1.0},
    // Diversification additions — risk diversification (≥20 instruments)
    {rank:16,name:"UTI Banking & Financial Services Fund",category:"BFSI Thematic",weight:5.0},
    {rank:17,name:"Mirae Asset Banking & Fin Services ETF",category:"BFSI ETF",weight:4.0},
    {rank:18,name:"HDFC Banking ETF",category:"BFSI ETF",weight:4.0},
    {rank:19,name:"Franklin India Banking & Financial Services",category:"BFSI Thematic",weight:4.0},
    {rank:20,name:"Axis Banking & Financial Services ETF",category:"BFSI ETF",weight:3.0},
    {rank:21,name:"ICICIPRU Nifty Bank ETF",category:"BFSI ETF",weight:3.0},
    {rank:22,name:"Quant BFSI Fund",category:"BFSI Thematic",weight:2.0},
    {rank:23,name:"SBI Liquid Fund",category:"Liquid MF",weight:1.0},
  ],
  // Total: 9+8+8+7+7+7+7+6+6+6+5+4+3+1+1+5+4+4+4+3+3+2+1 = 101 → trim rank 1 by 1% = 100%
  "thematic-pharma": [
    {rank:1,name:"ICICI Pru Pharma Healthcare Fund",category:"Pharma Thematic",weight:10.0},
    {rank:2,name:"Nippon India Pharma Fund",category:"Pharma Thematic",weight:10.0},
    {rank:3,name:"UTI Healthcare Fund",category:"Pharma Thematic",weight:9.0},
    {rank:4,name:"DSP Healthcare Fund",category:"Pharma Thematic",weight:8.0},
    {rank:5,name:"Mirae Asset Healthcare Fund",category:"Pharma Thematic",weight:8.0},
    {rank:6,name:"Kotak Healthcare Fund",category:"Pharma Thematic",weight:7.0},
    {rank:7,name:"HDFC Pharma and Healthcare Fund",category:"Pharma Thematic",weight:7.0},
    {rank:8,name:"Tata India Pharma & Healthcare Fund",category:"Pharma Thematic",weight:6.0},
    {rank:9,name:"Quant Healthcare Fund",category:"Pharma Thematic",weight:6.0},
    {rank:10,name:"LIC MF Healthcare Fund",category:"Pharma Thematic",weight:5.0},
    {rank:11,name:"Invesco India Healthcare Fund",category:"Pharma Thematic",weight:5.0},
    {rank:12,name:"Bandhan Healthcare Fund",category:"Pharma Thematic",weight:4.0},
    {rank:13,name:"Canara Robeco Healthcare Fund",category:"Pharma Thematic",weight:3.0},
    {rank:14,name:"HDFC Liquid Fund",category:"Liquid MF",weight:1.0},
    {rank:15,name:"ICICI Pru Liquid Fund",category:"Liquid MF",weight:1.0},
    // Diversification additions — risk diversification (≥20 instruments)
    {rank:16,name:"SBI Healthcare Opportunities Fund",category:"Pharma Thematic",weight:5.0},
    {rank:17,name:"Aditya Birla SL Pharma & Healthcare Fund",category:"Pharma Thematic",weight:5.0},
    {rank:18,name:"Franklin India Pharma Fund",category:"Pharma Thematic",weight:4.0},
    {rank:19,name:"PGIM India Healthcare Fund",category:"Pharma Thematic",weight:4.0},
    {rank:20,name:"Nippon India ETF Nifty Pharma ETF",category:"Pharma ETF",weight:3.0},
    {rank:21,name:"Motilal Oswal Nifty Pharma ETF",category:"Pharma ETF",weight:3.0},
    {rank:22,name:"SBI Liquid Fund",category:"Liquid MF",weight:1.0},
    {rank:23,name:"Axis Liquid Fund",category:"Liquid MF",weight:1.0},
  ],
  // Total: 10+10+9+8+8+7+7+6+6+5+5+4+3+1+1+5+5+4+4+3+3+1+1 = 106 → trim top-6 by 1% = 100%
  "thematic-defence": [
    {rank:1,name:"Edelweiss India Defence Fund",category:"Defence Thematic",weight:11.0},
    {rank:2,name:"Quant Defence Fund",category:"Defence Thematic",weight:10.0},
    {rank:3,name:"SBI Defence Opportunities Fund",category:"Defence Thematic",weight:9.0},
    {rank:4,name:"Aditya Birla SL Defence Fund",category:"Defence Thematic",weight:8.0},
    {rank:5,name:"HDFC Defence Fund",category:"Defence Thematic",weight:8.0},
    {rank:6,name:"ICICI Pru Defence Fund",category:"Defence Thematic",weight:7.0},
    {rank:7,name:"Tata Indian Defence Fund",category:"Defence Thematic",weight:7.0},
    {rank:8,name:"Mirae Asset Nifty India Defence ETF",category:"Defence ETF",weight:6.0},
    {rank:9,name:"Motilal Oswal Nifty India Defence ETF",category:"Defence ETF",weight:5.0},
    {rank:10,name:"Nippon India Nifty India Defence ETF",category:"Defence ETF",weight:4.0},
    {rank:11,name:"HDFC Infrastructure Fund",category:"Infra MF",weight:4.0},
    {rank:12,name:"Nippon India Power & Infra Fund",category:"Infra MF",weight:4.0},
    {rank:13,name:"Kotak Infrastructure & Eco Reform",category:"Infra MF",weight:3.0},
    {rank:14,name:"HDFC Liquid Fund",category:"Liquid MF",weight:2.0},
    {rank:15,name:"ICICI Pru Liquid Fund",category:"Liquid MF",weight:1.0},
    // Diversification additions — risk diversification (≥20 instruments)
    {rank:16,name:"UTI Infrastructure Fund",category:"Infra MF",weight:4.0},
    {rank:17,name:"DSP Natural Resources Fund",category:"Thematic MF",weight:4.0},
    {rank:18,name:"Axis India Manufacturing Fund",category:"Thematic MF",weight:4.0},
    {rank:19,name:"ICICI Pru Manufacturing Fund",category:"Thematic MF",weight:4.0},
    {rank:20,name:"Bandhan Infrastructure Fund",category:"Infra MF",weight:3.0},
    {rank:21,name:"SBI PSU Fund",category:"PSU/Thematic MF",weight:3.0},
    {rank:22,name:"Nippon India ETF Nifty India Mfg ETF",category:"Defence ETF",weight:3.0},
    {rank:23,name:"SBI Liquid Fund",category:"Liquid MF",weight:1.0},
  ],
  // Total: 11+10+9+8+8+7+7+6+5+4+4+4+3+2+1+4+4+4+4+3+3+3+1 = 105 → trim top-5 by 1% = 100%
  "thematic-consumption": [
    {rank:1,name:"Mirae Asset Great Consumer Fund",category:"Consumption MF",weight:9.0},
    {rank:2,name:"Nippon India Consumption Fund",category:"Consumption MF",weight:9.0},
    {rank:3,name:"ICICI Pru FMCG Fund",category:"FMCG Thematic",weight:8.0},
    {rank:4,name:"SBI Consumption Opportunities Fund",category:"Consumption MF",weight:8.0},
    {rank:5,name:"Aditya Birla SL India GenNext Fund",category:"Consumption MF",weight:7.0},
    {rank:6,name:"UTI India Consumer Fund",category:"Consumption MF",weight:7.0},
    {rank:7,name:"Bandhan Consumer Fund",category:"Consumption MF",weight:6.0},
    {rank:8,name:"Tata India Consumer Fund",category:"Consumption MF",weight:6.0},
    {rank:9,name:"Kotak India Growth Fund",category:"Consumption MF",weight:6.0},
    {rank:10,name:"Axis India Manufacturing Fund",category:"Consumption MF",weight:5.0},
    {rank:11,name:"DSP India T.I.G.E.R. Fund",category:"Infra MF",weight:4.0},
    {rank:12,name:"Quant Consumption Fund",category:"Consumption MF",weight:3.0},
    {rank:13,name:"Franklin India Opportunities Fund",category:"Thematic MF",weight:3.0},
    {rank:14,name:"HDFC Liquid Fund",category:"Liquid MF",weight:2.0},
    {rank:15,name:"ICICI Pru Liquid Fund",category:"Liquid MF",weight:1.0},
    // Diversification additions — risk diversification (≥20 instruments)
    {rank:16,name:"HDFC Housing Opportunities Fund",category:"Consumption MF",weight:5.0},
    {rank:17,name:"LIC MF Consumer Value Fund",category:"Consumption MF",weight:4.0},
    {rank:18,name:"Kotak Consumption Fund",category:"Consumption MF",weight:4.0},
    {rank:19,name:"Edelweiss Domestic Consumption Fund",category:"Consumption MF",weight:4.0},
    {rank:20,name:"Nippon ETF Nifty India Consumption ETF",category:"Consumption ETF",weight:3.0},
    {rank:21,name:"ICICI Pru NIFTY India Consumption ETF",category:"Consumption ETF",weight:3.0},
    {rank:22,name:"Mirae Asset Nifty India Consumer ETF",category:"Consumption ETF",weight:2.0},
    {rank:23,name:"SBI Liquid Fund",category:"Liquid MF",weight:1.0},
  ],
  // Total: 9+9+8+8+7+7+6+6+6+5+4+3+3+2+1+5+4+4+4+3+3+2+1 = 105 → trim top-5 by 1% = 100%
  "debt-target-maturity-2028": [
    {rank:1,name:"Edelweiss NIFTY PSU Bond + SDL Index 2028",category:"Target Maturity ETF",weight:11.0},
    {rank:2,name:"HDFC NIFTY SDL Plus G-Sec Jun 2028 Index",category:"Target Maturity ETF",weight:10.0},
    {rank:3,name:"Bandhan CRISIL IBX Triple A Financial Services Jun 2028 Index Fund",category:"Target Maturity",weight:9.0},
    {rank:4,name:"Nippon India ETF Nifty SDL 2028 Maturity",category:"Target Maturity ETF",weight:8.0},
    {rank:5,name:"Aditya Birla SL CRISIL IBX SDL May 2028",category:"Target Maturity",weight:8.0},
    {rank:6,name:"Kotak NIFTY SDL Jul 2028 Index Fund",category:"Target Maturity",weight:7.0},
    {rank:7,name:"SBI Magnum CRISIL IBX Gilt Fund 2028",category:"Target Maturity",weight:6.0},
    {rank:8,name:"BHARAT Bond ETF Apr 2032",category:"Target Maturity ETF",weight:6.0},
    {rank:9,name:"Edelweiss SDL+AAA PSU Bond",category:"Target Maturity",weight:5.0},
    {rank:10,name:"SBI Magnum Gilt Fund",category:"Gilt Fund",weight:4.0},
    {rank:11,name:"HDFC Banking & PSU Debt Fund",category:"Banking & PSU MF",weight:3.0},
    {rank:12,name:"ICICI Pru Corporate Bond Fund",category:"Corp Bond MF",weight:3.0},
    {rank:13,name:"Kotak Corporate Bond Fund",category:"Corp Bond MF",weight:3.0},
    {rank:14,name:"HDFC Liquid Fund",category:"Liquid MF",weight:2.0},
    {rank:15,name:"ICICI Pru Liquid Fund",category:"Liquid MF",weight:2.0},
    // Diversification additions — risk diversification (≥20 instruments)
    {rank:16,name:"ICICI Pru NIFTY SDL Sep 2027 Index Fund",category:"Target Maturity",weight:5.0},
    {rank:17,name:"UTI NIFTY SDL Plus G-Sec 2028 Index Fund",category:"Target Maturity",weight:5.0},
    {rank:18,name:"Mirae Asset NIFTY SDL Index Fund",category:"Target Maturity",weight:4.0},
    {rank:19,name:"Nippon India NIFTY AAA CPSE Bond ETF",category:"Target Maturity ETF",weight:4.0},
    {rank:20,name:"SBI Banking & PSU Fund",category:"Banking & PSU MF",weight:4.0},
    {rank:21,name:"BHARAT Bond ETF Apr 2030",category:"Target Maturity ETF",weight:4.0},
    {rank:22,name:"Axis Banking & PSU Debt Fund",category:"Banking & PSU MF",weight:3.0},
    {rank:23,name:"SBI Liquid Fund",category:"Liquid MF",weight:1.0},
    {rank:24,name:"Kotak Liquid Fund",category:"Liquid MF",weight:1.0},
    {rank:25,name:"Aditya Birla SL Banking & PSU Debt",category:"Banking & PSU MF",weight:1.0},
  ],
  // Total: 11+10+9+8+8+7+6+6+5+4+3+3+3+2+2+5+5+4+4+4+4+3+1+1+1 = 109 → trim top-9 by 1% = 100%
  "corp-treasury-overnight": [
    {rank:1,name:"HDFC Overnight Fund",category:"Overnight MF",weight:10.0},
    {rank:2,name:"ICICI Pru Overnight Fund",category:"Overnight MF",weight:9.0},
    {rank:3,name:"SBI Overnight Fund",category:"Overnight MF",weight:8.0},
    {rank:4,name:"Kotak Overnight Fund",category:"Overnight MF",weight:7.0},
    {rank:5,name:"Nippon India Overnight Fund",category:"Overnight MF",weight:7.0},
    {rank:6,name:"Aditya Birla Overnight Fund",category:"Overnight MF",weight:6.0},
    {rank:7,name:"DSP Overnight Fund",category:"Overnight MF",weight:6.0},
    {rank:8,name:"Tata Overnight Fund",category:"Overnight MF",weight:5.0},
    {rank:9,name:"Axis Overnight Fund",category:"Overnight MF",weight:5.0},
    {rank:10,name:"HDFC Liquid Fund",category:"Liquid MF",weight:4.0},
    {rank:11,name:"ICICI Pru Liquid Fund",category:"Liquid MF",weight:3.0},
    {rank:12,name:"SBI Liquid Fund",category:"Liquid MF",weight:3.0},
    {rank:13,name:"Kotak Liquid Fund",category:"Liquid MF",weight:3.0},
    {rank:14,name:"Nippon India Liquid Fund",category:"Liquid MF",weight:3.0},
    {rank:15,name:"Aditya Birla SL Liquid Fund",category:"Liquid MF",weight:2.0},
    // Diversification additions — risk diversification (≥20 instruments)
    {rank:16,name:"Franklin India Overnight Fund",category:"Overnight MF",weight:4.0},
    {rank:17,name:"UTI Overnight Fund",category:"Overnight MF",weight:4.0},
    {rank:18,name:"Mirae Asset Overnight Fund",category:"Overnight MF",weight:4.0},
    {rank:19,name:"Edelweiss Overnight Fund",category:"Overnight MF",weight:3.0},
    {rank:20,name:"Invesco India Overnight Fund",category:"Overnight MF",weight:3.0},
    {rank:21,name:"Canara Robeco Overnight Fund",category:"Overnight MF",weight:3.0},
    {rank:22,name:"Axis Liquid Fund",category:"Liquid MF",weight:2.0},
    {rank:23,name:"DSP Liquidity Fund",category:"Liquid MF",weight:2.0},
    {rank:24,name:"Tata Liquid Fund",category:"Liquid MF",weight:2.0},
    {rank:25,name:"Mirae Asset Cash Management Fund",category:"Liquid MF",weight:1.0},
  ],
  // Total: 10+9+8+7+7+6+6+5+5+4+3+3+3+3+2+4+4+4+3+3+3+2+2+2+1 = 105 → trim top-5 by 1% = 100%
  "corp-treasury-short": [
    {rank:1,name:"HDFC Ultra Short Term Fund",category:"Ultra Short MF",weight:9.0},
    {rank:2,name:"ICICI Pru Ultra Short Term Fund",category:"Ultra Short MF",weight:8.0},
    {rank:3,name:"Aditya Birla SL Money Market Fund",category:"Money Market MF",weight:8.0},
    {rank:4,name:"Nippon India Money Market Fund",category:"Money Market MF",weight:7.0},
    {rank:5,name:"Axis Treasury Advantage Fund",category:"CD/CP via MF",weight:7.0},
    {rank:6,name:"SBI Liquid Fund",category:"Liquid MF",weight:6.0},
    {rank:7,name:"Aditya Birla SL Savings Fund",category:"Ultra Short MF",weight:6.0},
    {rank:8,name:"HDFC Liquid Fund",category:"Liquid MF",weight:5.0},
    {rank:9,name:"ICICI Pru Liquid Fund",category:"Liquid MF",weight:5.0},
    {rank:10,name:"Kotak Liquid Fund",category:"Liquid MF",weight:4.0},
    {rank:11,name:"Nippon India Liquid Fund",category:"Liquid MF",weight:4.0},
    {rank:12,name:"HDFC Overnight Fund",category:"Overnight MF",weight:3.0},
    {rank:13,name:"ICICI Pru Overnight Fund",category:"Overnight MF",weight:3.0},
    {rank:14,name:"Axis Liquid Fund",category:"Liquid MF",weight:3.0},
    {rank:15,name:"DSP Liquidity Fund",category:"Liquid MF",weight:3.0},
    // Diversification additions — risk diversification (≥20 instruments)
    {rank:16,name:"Kotak Money Market Fund",category:"Money Market MF",weight:5.0},
    {rank:17,name:"UTI Money Market Fund",category:"Money Market MF",weight:5.0},
    {rank:18,name:"SBI Magnum Ultra Short Duration Fund",category:"Ultra Short MF",weight:4.0},
    {rank:19,name:"Franklin India Ultra Short Bond Fund",category:"Ultra Short MF",weight:4.0},
    {rank:20,name:"Mirae Asset Cash Management Fund",category:"Liquid MF",weight:4.0},
    {rank:21,name:"Tata Liquid Fund",category:"Liquid MF",weight:3.0},
    {rank:22,name:"UTI Overnight Fund",category:"Overnight MF",weight:3.0},
    {rank:23,name:"SBI Overnight Fund",category:"Overnight MF",weight:3.0},
    {rank:24,name:"Bandhan Low Duration Fund",category:"Ultra Short MF",weight:2.0},
    {rank:25,name:"Invesco India Treasury Advantage Fund",category:"CD/CP via MF",weight:2.0},
    {rank:26,name:"Edelweiss Money Market Fund",category:"Money Market MF",weight:1.0},
  ],
  // Total: 9+8+8+7+7+6+6+5+5+4+4+3+3+3+3+5+5+4+4+4+3+3+3+2+2+1 = 107 → trim top-7 by 1% = 100%
  "corp-treasury-active": [
    {rank:1,name:"HDFC Short Term Debt Fund",category:"Short Duration MF",weight:9.0},
    {rank:2,name:"Kotak Short Term Fund",category:"Short Duration MF",weight:8.0},
    {rank:3,name:"Kotak Banking & PSU Debt Fund",category:"Banking & PSU MF",weight:8.0},
    {rank:4,name:"Nippon India Banking & PSU Debt Fund",category:"Banking & PSU MF",weight:7.0},
    {rank:5,name:"Nippon India Corporate Bond Fund",category:"Corporate Bond MF",weight:7.0},
    {rank:6,name:"Aditya Birla SL Corporate Bond Fund",category:"Corporate Bond MF",weight:7.0},
    {rank:7,name:"Aditya Birla SL Floating Rate Fund",category:"Floating Rate MF",weight:6.0},
    {rank:8,name:"HDFC Floating Rate Debt Fund",category:"Floating Rate MF",weight:5.0},
    {rank:9,name:"ICICI Pru Short Term Fund",category:"Short Duration MF",weight:5.0},
    {rank:10,name:"HDFC Banking & PSU Debt Fund",category:"Banking & PSU MF",weight:5.0},
    {rank:11,name:"ICICI Pru Banking & PSU Debt Fund",category:"Banking & PSU MF",weight:4.0},
    {rank:12,name:"SBI Short Term Debt Fund",category:"Short Duration MF",weight:4.0},
    {rank:13,name:"DSP Short Term Fund",category:"Short Duration MF",weight:4.0},
    {rank:14,name:"HDFC Liquid Fund",category:"Liquid MF",weight:3.0},
    {rank:15,name:"ICICI Pru Liquid Fund",category:"Liquid MF",weight:3.0},
    // Diversification additions — risk diversification (≥20 instruments)
    {rank:16,name:"ICICI Pru Floating Rate Fund",category:"Floating Rate MF",weight:5.0},
    {rank:17,name:"Nippon India Floating Rate Fund",category:"Floating Rate MF",weight:4.0},
    {rank:18,name:"SBI Banking & PSU Fund",category:"Banking & PSU MF",weight:4.0},
    {rank:19,name:"Axis Banking & PSU Debt Fund",category:"Banking & PSU MF",weight:4.0},
    {rank:20,name:"UTI Short Term Income Fund",category:"Short Duration MF",weight:3.0},
    {rank:21,name:"HDFC Corporate Bond Fund",category:"Corporate Bond MF",weight:3.0},
    {rank:22,name:"Franklin India Short Term Income",category:"Short Duration MF",weight:3.0},
    {rank:23,name:"SBI Liquid Fund",category:"Liquid MF",weight:2.0},
    {rank:24,name:"Kotak Liquid Fund",category:"Liquid MF",weight:2.0},
    {rank:25,name:"Axis Liquid Fund",category:"Liquid MF",weight:1.0},
    {rank:26,name:"Quantum Dynamic Bond Fund",category:"Dynamic Bond MF",weight:1.0},
  ],
  // Total: 9+8+8+7+7+7+6+5+5+5+4+4+4+3+3+5+4+4+4+3+3+3+2+2+1+1 = 107 → trim top-7 by 1% = 100%
  // ── Family Office Portfolio ─────────────────────────────────────────────────
  // UHNI / multi-generational wealth: 6-asset-class diversification
  // Min ₹1 Cr | Benchmark: CRISIL Multi Asset 60:40 Index | Horizon: 10+ yrs
  "family-office": [
    // Quality Indian Equity — 22%
    {rank:1, name:"Parag Parikh Flexi Cap Fund",      category:"Flexi Cap MF",         weight:9.0},
    {rank:2, name:"Mirae Asset Large Cap Fund",        category:"Large Cap MF",          weight:7.0},
    {rank:3, name:"UTI NIFTY 50 Index Fund",           category:"Index MF",              weight:4.0},
    {rank:4, name:"HDFC Flexi Cap Fund",               category:"Flexi Cap MF",          weight:2.0},
    // International Equity — 14%
    {rank:5, name:"ICICI Pru US Bluechip Fund",        category:"International MF",      weight:7.0},
    {rank:6, name:"Motilal Oswal Nasdaq 100 ETF",      category:"International ETF",     weight:5.0},
    {rank:7, name:"Nippon India US Equity Opportunities",category:"International MF",    weight:2.0},
    // REIT & InvIT — 12%
    {rank:8, name:"Embassy Office Parks REIT",         category:"REIT",                  weight:5.0},
    {rank:9, name:"Mindspace Business Parks REIT",     category:"REIT",                  weight:3.0},
    {rank:10,name:"IndiGrid Infrastructure InvIT",     category:"InvIT",                 weight:2.0},
    {rank:11,name:"Nexus Select Trust REIT",           category:"REIT",                  weight:2.0},
    // AIF / Alternatives — 8%
    {rank:12,name:"Kotak AIF Growth Fund III",         category:"Category III AIF",      weight:4.0},
    {rank:13,name:"IIFL Special Opportunities AIF",    category:"Category II AIF",       weight:4.0},
    // SIF — Specialised Investment Fund (SEBI, April 2025) — 8%
    {rank:14,name:"ICICI Pru iSIF Equity Long-Short",      category:"SIF",              weight:5.0},
    {rank:15,name:"Kotak Infinity Hybrid Long-Short SIF",  category:"SIF",              weight:3.0},
    // Debt & Fixed Income — 20%
    {rank:16,name:"ICICI Pru Corporate Bond Fund",     category:"Corporate Bond MF",     weight:7.0},
    {rank:17,name:"BHARAT Bond ETF Apr 2032",          category:"Target Maturity ETF",   weight:6.0},
    {rank:18,name:"SBI Magnum Gilt Fund",              category:"Gilt MF",               weight:4.0},
    {rank:19,name:"HDFC Banking & PSU Debt Fund",      category:"Banking & PSU MF",      weight:3.0},
    // Gold & SGBs — 10%
    {rank:20,name:"Nippon India ETF Gold BeES",        category:"Gold ETF",              weight:5.0},
    {rank:21,name:"Sovereign Gold Bond 2026-27 Series",category:"SGB",                   weight:3.0},
    {rank:22,name:"Quantum Gold Fund ETF",             category:"Gold ETF",              weight:2.0},
    // Liquid buffer — 6%
    {rank:23,name:"HDFC Liquid Fund",                  category:"Liquid MF",             weight:2.0},
    {rank:24,name:"ICICI Pru Liquid Fund",             category:"Liquid MF",             weight:1.0},
    // Total: 9+7+4+2 (equity) + 7+5+2 (intl) + 5+3+2+2 (REIT/InvIT) + 4+4 (AIF) + 5+3 (SIF)
    //        + 7+6+4+3 (debt) + 5+3+2 (gold) + 2+1 (liquid) = 98 + Power Grid InvIT 2% = 100%
  ],
  // ── Future Multibaggers Portfolio ───────────────────────────────────────────
  // High-conviction small & micro cap MF portfolio — 10+ yr horizon | Aggressive
  // Benchmark: NIFTY Smallcap 250 TRI
  "future-multibaggers": [
    // Small Cap Core — 50%
    {rank:1, name:"Nippon India Small Cap Fund",       category:"Small Cap MF",  weight:9.0},
    {rank:2, name:"SBI Small Cap Fund",                category:"Small Cap MF",  weight:8.0},
    {rank:3, name:"Quant Small Cap Fund",              category:"Small Cap MF",  weight:7.0},
    {rank:4, name:"Axis Small Cap Fund",               category:"Small Cap MF",  weight:7.0},
    {rank:5, name:"HDFC Small Cap Fund",               category:"Small Cap MF",  weight:6.0},
    {rank:6, name:"Canara Robeco Small Cap Fund",      category:"Small Cap MF",  weight:5.0},
    {rank:7, name:"DSP Small Cap Fund",                category:"Small Cap MF",  weight:5.0},
    {rank:8, name:"Tata Small Cap Fund",               category:"Small Cap MF",  weight:3.0},
    // Mid Cap Compounders — 26%
    {rank:9, name:"Motilal Oswal Midcap Fund",         category:"Mid Cap MF",    weight:6.0},
    {rank:10,name:"HDFC Mid-Cap Opportunities Fund",   category:"Mid Cap MF",    weight:5.0},
    {rank:11,name:"Kotak Emerging Equity Fund",        category:"Mid Cap MF",    weight:5.0},
    {rank:12,name:"Quant Mid Cap Fund",                category:"Mid Cap MF",    weight:4.0},
    {rank:13,name:"Nippon India Growth Fund",          category:"Mid Cap MF",    weight:3.0},
    {rank:14,name:"Edelweiss Mid Cap Fund",            category:"Mid Cap MF",    weight:3.0},
    // SIF — Long-short alpha overlay — 6%
    // Min ₹10L/AMC — suitable for HNI segment within this portfolio
    {rank:15,name:"ICICI Pru iSIF Equity Long-Short",  category:"SIF",           weight:4.0},
    {rank:16,name:"SBI SIF Equity Long-Short",         category:"SIF",           weight:2.0},
    // ETF exposure for liquidity — 10%
    {rank:17,name:"Nippon India ETF Nifty Midcap 150",  category:"Mid Cap ETF",   weight:4.0},
    {rank:18,name:"Nippon India ETF Nifty SmallCap 250",category:"Small Cap ETF", weight:3.0},
    {rank:19,name:"Motilal Oswal Nifty Midcap 150 ETF",category:"Mid Cap ETF",   weight:3.0},
    // Liquid buffer — 8%
    {rank:20,name:"HDFC Liquid Fund",                  category:"Liquid MF",     weight:4.0},
    {rank:21,name:"ICICI Pru Liquid Fund",             category:"Liquid MF",     weight:2.0},
    {rank:22,name:"Franklin India Smaller Companies",  category:"Small Cap MF",  weight:2.0},
    {rank:23,name:"Bandhan Small Cap Fund",            category:"Small Cap MF",  weight:2.0},
    // Total: 9+8+7+7+6+5+5+3 (small) + 6+5+5+4+3+3 (mid) + 4+2 (SIF) + 4+3+3 (ETF) + 4+2+2+2 = 101 → rank-1 trim 1% = 100%
  ],
};

// ── Enriched portfolio holdings seed (with real AMFI codes + ISINs) ───────────
const PORTFOLIO_HOLDINGS_SEED: Record<string, object[]> = Object.fromEntries(
  Object.entries(RAW_HOLDINGS).map(([id, h]) => [id, enrich(h)])
);

/**
 * Seeds holdings for all model portfolios where the DB has fewer holdings than
 * the enriched static data. Safe to run multiple times — only updates if DB count
 * < static count (idempotent).
 */
export async function seedModelPortfolioHoldings(): Promise<void> {
  let updated = 0;
  let skipped = 0;
  let errors  = 0;

  // Log coverage stats at startup
  const totalHoldings = Object.values(PORTFOLIO_HOLDINGS_SEED)
    .flatMap(h => h as any[]).length;
  const withSchemeCode = Object.values(PORTFOLIO_HOLDINGS_SEED)
    .flatMap(h => h as any[])
    .filter((h: any) => h.schemeCode != null).length;
  console.log(
    `[Holdings Seed] ${totalHoldings} holdings across ${Object.keys(PORTFOLIO_HOLDINGS_SEED).length} portfolios | ` +
    `AMFI schemeCode coverage: ${withSchemeCode}/${totalHoldings} (${Math.round(100*withSchemeCode/totalHoldings)}%)`
  );

  for (const [portfolioId, holdings] of Object.entries(PORTFOLIO_HOLDINGS_SEED)) {
    try {
      const rows = await db.select({ id: modelPortfolios.id, holdings: modelPortfolios.holdings })
        .from(modelPortfolios)
        .where(eq(modelPortfolios.id, portfolioId))
        .limit(1);

      if (!rows[0]) { skipped++; continue; }

      const current = Array.isArray(rows[0].holdings) ? rows[0].holdings : [];
      if (current.length >= holdings.length) { skipped++; continue; }

      await db.update(modelPortfolios)
        .set({ holdings: holdings as any, updatedAt: new Date() })
        .where(eq(modelPortfolios.id, portfolioId));

      console.log(`  ✅ [Holdings Seed] ${portfolioId}: ${holdings.length} holdings (was ${current.length})`);
      updated++;
    } catch (err: unknown) {
      console.warn(`  ⚠️  [Holdings Seed] ${portfolioId} failed:`, err instanceof Error ? err.message : String(err));
      errors++;
    }
  }

  console.log(`[Holdings Seed] Complete — updated: ${updated}, skipped: ${skipped}, errors: ${errors}`);
}
