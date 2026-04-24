/**
 * ══════════════════════════════════════════════════════════════════════════════
 *  FintekPro — Enrichment Worker (Standalone Service)
 * ══════════════════════════════════════════════════════════════════════════════
 *
 *  HOW TO DEPLOY AS A SEPARATE REPLIT PROJECT
 *  ───────────────────────────────────────────
 *  1. Fork / copy the full FintekPro codebase into a new Replit project.
 *  2. Set the run command to:
 *       NODE_ENV=production tsx workers/enrichment-worker.ts
 *  3. Set deployment target to "autoscale" (always-on) in .replit.
 *  4. Add these secrets to the new project (same values as the main app):
 *       PRODUCTION_DATABASE_URL   ← same Neon DB
 *       FINNHUB_API_KEY           ← for stock enrichment
 *       FMP_API_KEY               ← for stock financial enrichment (optional)
 *       ALPHA_VANTAGE_API_KEY     ← for Golden Pricing (optional)
 *  5. Publish the new project.  Copy its public URL, e.g.:
 *       https://fintekpro-enrichment.yourname.replit.app
 *  6. In the MAIN FintekPro project's production secrets, set:
 *       ENRICHMENT_WORKER_URL = https://fintekpro-enrichment.yourname.replit.app
 *  7. Redeploy the main app — it will now skip all enrichment crons and delegate
 *     them entirely to this worker.
 *
 *  WHAT THIS WORKER DOES
 *  ──────────────────────
 *  • Runs all market-data enrichment cron jobs (MF/AIF/PMS/Commodity NAV syncs,
 *    benchmarks, stock PE/EPS enrichment, corporate actions, Golden Source Pricing,
 *    Fixed Income status, startup stock enrichment via Screener.in)
 *  • Exposes GET /health  →  200 OK with uptime/status JSON
 *  • Exposes GET /api/enrichment/status  →  last-run summary per cron group
 *  • Does NOT serve any user-facing routes, auth, KYC, loans, or frontend assets
 *
 *  WHAT IT SHARES WITH THE MAIN APP
 *  ──────────────────────────────────
 *  • Same Neon PostgreSQL database (PRODUCTION_DATABASE_URL)
 *  • All writes go to the same tables (listed_stocks, symbol_mapping,
 *    golden_prices, screener_financials, mutual_funds, etc.)
 *  • Main app reads those tables normally — it just doesn't write enriched data
 *
 *  ISOLATION BENEFITS
 *  ───────────────────
 *  • Enrichment crash/restart cycle is completely separate from the main app
 *  • Heavy Screener.in / FMP / Alpha Vantage HTTP calls never block main app CPU
 *  • Main app's autoscale instances stay focused on user traffic
 *  • Enrichment crons can be paused/redeployed without any user-visible downtime
 */

import express from 'express';

// ── Boot time tracking ───────────────────────────────────────────────────────
const bootTime = Date.now();

// ── Health / status state (updated by cron callbacks) ───────────────────────
export const cronStatus: Record<string, { lastRun: Date | null; lastResult: string }> = {
  'MF NAV sync':             { lastRun: null, lastResult: 'not yet run' },
  'AIF NAV sync':            { lastRun: null, lastResult: 'not yet run' },
  'PMS NAV sync':            { lastRun: null, lastResult: 'not yet run' },
  'Commodity sync':          { lastRun: null, lastResult: 'not yet run' },
  'Stock enrichment':        { lastRun: null, lastResult: 'not yet run' },
  'MF extended enrichment':  { lastRun: null, lastResult: 'not yet run' },
  'Corporate actions sync':  { lastRun: null, lastResult: 'not yet run' },
  'Golden Pricing':          { lastRun: null, lastResult: 'not yet run' },
  'Fixed Income status':     { lastRun: null, lastResult: 'not yet run' },
  'Benchmark sync':          { lastRun: null, lastResult: 'not yet run' },
  'Startup enrichment':      { lastRun: null, lastResult: 'not yet run' },
};

// ── Import the enrichment cron module ───────────────────────────────────────
// Importing this module immediately:
//   1. Registers the Fixed Income status cron (daily 6 AM IST)
//   2. Schedules the startup stock enrichment timeout (5 min after boot)
// The initializeEnrichmentCrons() call below then starts all the staggered
// scheduler starts (MF sync, REIT refresh, benchmark seeding, etc.)
import { initializeEnrichmentCrons } from '../server/cron-enrichment';
import { staggeredStart } from '../server/cron/utils';

// ── Express app for health checks ──────────────────────────────────────────
const app = express();
app.use(express.json());

app.get('/health', (_req, res) => {
  res.json({
    status: 'ok',
    service: 'fintekpro-enrichment-worker',
    uptime_seconds: Math.floor((Date.now() - bootTime) / 1000),
    environment: process.env.NODE_ENV || 'development',
    timestamp: new Date().toISOString(),
  });
});

app.get('/api/enrichment/status', (_req, res) => {
  res.json({
    service: 'fintekpro-enrichment-worker',
    uptime_seconds: Math.floor((Date.now() - bootTime) / 1000),
    crons: Object.fromEntries(
      Object.entries(cronStatus).map(([name, state]) => [name, {
        lastRun: state.lastRun?.toISOString() ?? null,
        lastResult: state.lastResult,
      }])
    ),
  });
});

// ── Start enrichment crons ──────────────────────────────────────────────────
console.log('[EnrichmentWorker] ⚠️ Enrichment Crons are PAUSED pending GCP Database Consolidation.');
// initializeEnrichmentCrons(staggeredStart, 60_000); // 1 min initial delay
// console.log('[EnrichmentWorker] All enrichment crons registered');

// ── Start HTTP server ───────────────────────────────────────────────────────
const PORT = parseInt(process.env.PORT || '8002', 10);
app.listen(PORT, () => {
  console.log(`[EnrichmentWorker] Health server listening on port ${PORT}`);
  console.log(`[EnrichmentWorker] GET /health          → uptime + status`);
  console.log(`[EnrichmentWorker] GET /api/enrichment/status → per-cron last-run summary`);
  console.log('[EnrichmentWorker] Ready');
});

// ── Graceful shutdown ───────────────────────────────────────────────────────
process.on('SIGTERM', () => {
  console.log('[EnrichmentWorker] SIGTERM received — shutting down gracefully');
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('[EnrichmentWorker] SIGINT received — shutting down');
  process.exit(0);
});
