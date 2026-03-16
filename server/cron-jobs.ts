/**
 * Cron Jobs Coordinator
 *
 * Orchestrates all domain cron modules with staggered startup.
 * Domain files own their own schedule definitions — add jobs there, not here.
 *
 * Domain breakdown:
 *   cron-enrichment.ts   – MF/NAV/benchmark/stock/pricing/corporate-actions
 *   cron-unlisted.ts     – Unlisted marketplace, Probe42, MCA, lead scoring
 *   cron-order-ops.ts    – Unified order expiry, processing timeout, KYC reminders
 *   cron-compliance.ts   – Reconciliation, CKYC SLA, audit integrity, GIFT City
 *
 * Module-level crons (run on import):
 *   cron-enrichment.ts   → Fixed Income status + Startup stock enrichment
 *   cron-unlisted.ts     → MCA enrichment sweep + Valuation governance
 *
 * Schedule overview (production, IST):
 *  Frequency        │ Job
 *  ─────────────────┼─────────────────────────────────────────────────────────
 *  Every hour :15   │ Processing order timeout
 *  Every 4h  :30    │ KYC upgrade reminders
 *  Every 6h  :00    │ Stale unified order cleanup
 *  Every 6h  :05    │ Probe42 company sync
 *  Every 12h :00    │ Price suggestions, expired listings cleanup
 *  Daily 12:30 AM   │ Bond calendar refresh, Monthly returns (1st only)
 *  Daily  1:00 AM   │ Daily reconciliation
 *  Daily  2:20 AM   │ GIFT City product maintenance
 *  Daily  3:30 AM   │ Expiry warning emails (24h notice)
 *  Daily  3:35 AM   │ MF NAV cache pre-warm
 *  Daily  2:30 AM   │ Probe42 prospecting alerts
 *  Daily  2:40 AM   │ Error digest
 *  Daily  5:00 AM   │ Data enrichment scheduler
 *  Daily  6:00 AM   │ Fixed Income status
 *  Daily  6:05 AM   │ Lead scoring (weekly Sun only)
 *  Daily  7:00 AM   │ AIF NAV sync
 *  Daily  7:30 AM   │ PMS NAV sync
 *  Daily  8:00 AM   │ Commodity price sync
 *  Daily  9:00 PM   │ Golden Source Pricing Engine (Mon–Fri)
 *  Daily  9:05 PM   │ MoneyControl price sync
 *  Daily  2:00 AM   │ MCA enrichment sweep
 *  Daily  2:20 AM   │ GIFT City maintenance
 *  Weekly Sun 1 AM  │ Benchmark sync
 *  Weekly Mon 2 AM  │ AMFI benchmark ingestion
 *  Weekly Sun 8 PM  │ Golden price stale marker
 *  Monthly 1st 6 AM │ Exit load sync, Monthly MF returns
 *  Quarterly 1st 3AM│ Valuation governance staleness sweep
 */

import { staggeredStart } from './cron/utils';
// Named imports also execute module-level crons (Fixed Income, MCA enrichment, Valuation governance)
import { initializeEnrichmentCrons } from './cron-enrichment';
import { initializeUnlistedCrons } from './cron-unlisted';
import { initializeOrderOpsCrons } from './cron-order-ops';
import { initializeComplianceCrons } from './cron-compliance';

export function initializeCronJobs(): void {
  console.log('Initializing cron jobs (staggered startup enabled, 120s intervals)...');

  let delay = 60_000; // first domain starts 1 min after boot

  // ── Enrichment domain (heaviest — MF/NAV/benchmark/stock, all production) ─
  // If ENRICHMENT_WORKER_URL is set, initializeEnrichmentCrons() returns early
  // and all enrichment crons (including module-level Fixed Income + startup
  // enrichment) are silently skipped — the dedicated enrichment-worker project
  // handles them instead. See workers/enrichment-worker.ts for deploy steps.
  delay = initializeEnrichmentCrons(staggeredStart, delay);

  // ── Unlisted marketplace domain ────────────────────────────────────────────
  initializeUnlistedCrons();

  // ── Unified order operations domain ────────────────────────────────────────
  initializeOrderOpsCrons();

  // ── Compliance domain ──────────────────────────────────────────────────────
  initializeComplianceCrons();

  // Disabled pipelines — kept as tombstone comments for audit trail
  console.log('⏭️ [InstrumentTimeSeries] Daily updater + Historical backfill DISABLED — superseded by Golden Source Pricing Engine (9 PM IST → golden_prices)');
  console.log('⏭️ [Live MF NAV] Disabled — amfiNavScheduler covers AMFI→DB sync at 11:30 PM IST');
  console.log('⏭️ [MF NAV History] Disabled — MFAPI per-scheme spam removed; on-demand fetch retained');

  console.log('✓ Cron jobs initialized successfully');
}
