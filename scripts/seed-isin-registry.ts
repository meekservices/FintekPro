/**
 * @file seed-isin-registry.ts
 * @description Seeds the isin_registry table from instrument-registry.ts.
 *
 * Usage:
 *   npx tsx scripts/seed-isin-registry.ts [--dry-run] [--verbose]
 *
 * Behaviour:
 *   - Idempotent: uses ON CONFLICT DO UPDATE
 *   - De-duplicates by ISIN (multiple names → one canonical record)
 *   - Skips entries without an ISIN (AIF, SGB variants, null-isin entries)
 *   - International instruments (US/non-IN) seeded separately below
 *
 * @compliance SEBI Reg 24 / ARN: only Regular Plan scheme codes here.
 */

import { db } from "../server/db";
import { isinRegistry } from "../shared/schema";
import { INSTRUMENT_REGISTRY } from "../server/data/instrument-registry";

const DRY_RUN = process.argv.includes("--dry-run");
const VERBOSE  = process.argv.includes("--verbose");

// ── Type → instrument_type mapping (registry uses internal type codes) ──────
function mapType(regType: string): string {
  const map: Record<string, string> = {
    large_cap:      "mutual_fund",
    mid_cap:        "mutual_fund",
    small_cap:      "mutual_fund",
    flexi_cap:      "mutual_fund",
    multi_cap:      "mutual_fund",
    equity:         "mutual_fund",
    debt:           "mutual_fund",
    liquid:         "mutual_fund",
    gilt:           "mutual_fund",
    thematic:       "mutual_fund",
    gold:           "etf",          // Gold ETF/FoF
    reit:           "reit",
    invit:          "invit",
    alternatives:   "aif",
    sif:            "sif",
    international:  "fof",          // Fund of Fund investing in intl ETFs
  };
  return map[regType] ?? "mutual_fund";
}

// ── Build de-duplicated ISIN map ──────────────────────────────────────────────
// Multiple registry names may share an ISIN. Use the FIRST entry as canonical.
const isinMap = new Map<string, {
  canonicalName: string;
  instrumentType: string;
  amfiCode: number | null;
  regType: string;
  isProxy: boolean;
  proxyNote: string | null;
}>();

for (const [name, info] of Object.entries(INSTRUMENT_REGISTRY)) {
  const isin = info.isin;
  if (!isin) continue; // skip entries with no ISIN (AIF, some SIF etc.)

  if (!isinMap.has(isin)) {
    // Check if this entry is a known proxy
    const isProxy = name === "Kotak Nasdaq 100 FOF" || name === "Kotak Nasdaq 100 Fund of Fund";
    const proxyNote = isProxy
      ? "Motilal Oswal Nasdaq 100 FOF Direct (145552) used as proxy — Kotak fund not on mfapi.in. Same underlying Nasdaq 100 index, ~0.5% ER difference."
      : null;

    isinMap.set(isin, {
      canonicalName:  name,
      instrumentType: mapType(info.type),
      amfiCode:       info.schemeCode,
      regType:        info.type,
      isProxy,
      proxyNote,
    });
  }
  // For duplicate ISINs: first entry wins as canonical (already set)
}

// ── International instruments (US ETFs, benchmarks) ─────────────────────────
const INTL_INSTRUMENTS = [
  {
    isin:            "US46090E1038",
    canonicalName:   "Invesco QQQ Trust (Nasdaq 100 ETF)",
    instrumentType:  "etf",
    country:         "US",
    currency:        "USD",
    cusip:           "46090E103",
    bloombergTicker: "QQQ US Equity",
    notes:           "Nasdaq 100 Index tracker — reference for Nasdaq FOF returns",
  },
  {
    isin:            "US78462F1030",
    canonicalName:   "SPDR S&P 500 ETF Trust",
    instrumentType:  "etf",
    country:         "US",
    currency:        "USD",
    cusip:           "78462F103",
    bloombergTicker: "SPY US Equity",
    notes:           "S&P 500 Index tracker — reference for US equity FOF returns",
  },
  {
    isin:            "US00507V1098",
    canonicalName:   "iShares MSCI India ETF",
    instrumentType:  "etf",
    country:         "US",
    currency:        "USD",
    cusip:           "00507V109",
    bloombergTicker: "INDA US Equity",
    notes:           "MSCI India ETF — US-listed instrument for global India exposure",
  },
  {
    isin:            "US4642874329",
    canonicalName:   "iShares Gold Trust",
    instrumentType:  "commodity_etf",
    country:         "US",
    currency:        "USD",
    cusip:           "464287432",
    bloombergTicker: "IAU US Equity",
    notes:           "Gold ETF — US-listed reference for gold return benchmarks",
  },
  {
    isin:            "US9220426513",
    canonicalName:   "Vanguard Total World Stock ETF",
    instrumentType:  "etf",
    country:         "US",
    currency:        "USD",
    cusip:           "922042651",
    bloombergTicker: "VT US Equity",
    notes:           "Global diversification benchmark",
  },
  {
    isin:            "HK0000004322",
    canonicalName:   "Hang Seng Index — reference only",
    instrumentType:  "index",
    country:         "HK",
    currency:        "HKD",
    notes:           "Benchmark for Nippon India ETF Hang Seng BeES returns",
  },
];

// ── Seed execution ────────────────────────────────────────────────────────────
async function main() {
  console.log(`\n🌱 ISIN Registry Seed — ${DRY_RUN ? "DRY RUN" : "LIVE"}`);
  console.log(`   Source: ${isinMap.size} unique ISINs from instrument-registry.ts`);
  console.log(`   International: ${INTL_INSTRUMENTS.length} entries`);
  console.log("");

  let seeded = 0, skipped = 0, errors = 0;

  // 1. Indian instruments from registry
  for (const [isin, info] of isinMap) {
    try {
      if (VERBOSE) {
        console.log(`  → ${isin}  ${info.canonicalName}  [amfi=${info.amfiCode}]`);
      }

      if (!DRY_RUN) {
        await db
          .insert(isinRegistry)
          .values({
            isin:            isin.toUpperCase(),
            canonicalName:   info.canonicalName,
            instrumentType:  info.instrumentType,
            country:         "IN",
            currency:        "INR",
            amfiCode:        info.amfiCode,
            planType:        ["reit","invit","aif","sif"].includes(info.instrumentType)
                               ? "etf" : "regular",
            isProxy:         info.isProxy,
            proxyNote:       info.proxyNote,
            source:          "seed",
            isActive:        true,
            updatedAt:       new Date(),
          })
          .onConflictDoUpdate({
            target: isinRegistry.isin,
            set: {
              canonicalName:   info.canonicalName,
              instrumentType:  info.instrumentType,
              amfiCode:        info.amfiCode,
              isProxy:         info.isProxy,
              proxyNote:       info.proxyNote,
              source:          "seed",
              updatedAt:       new Date(),
            },
          });
      }
      seeded++;
    } catch (err) {
      console.error(`  ❌ ${isin}: ${err instanceof Error ? err.message : String(err)}`);
      errors++;
    }
  }

  // 2. International instruments
  for (const inst of INTL_INSTRUMENTS) {
    try {
      if (VERBOSE) {
        console.log(`  → ${inst.isin}  ${inst.canonicalName}  [${inst.country}]`);
      }

      if (!DRY_RUN) {
        await db
          .insert(isinRegistry)
          .values({
            isin:            inst.isin.toUpperCase(),
            canonicalName:   inst.canonicalName,
            instrumentType:  inst.instrumentType,
            country:         inst.country ?? "US",
            currency:        inst.currency ?? "USD",
            cusip:           (inst as any).cusip ?? null,
            bloombergTicker: (inst as any).bloombergTicker ?? null,
            planType:        "etf",
            isProxy:         false,
            source:          "seed",
            notes:           inst.notes,
            isActive:        true,
            updatedAt:       new Date(),
          })
          .onConflictDoUpdate({
            target: isinRegistry.isin,
            set: {
              canonicalName:   inst.canonicalName,
              instrumentType:  inst.instrumentType,
              source:          "seed",
              updatedAt:       new Date(),
            },
          });
      }
      seeded++;
    } catch (err) {
      console.error(`  ❌ ${inst.isin}: ${err instanceof Error ? err.message : String(err)}`);
      errors++;
    }
  }

  console.log("");
  console.log(`✅  Seeded:  ${seeded}`);
  console.log(`⏭️   Skipped: ${skipped} (no ISIN)`);
  if (errors > 0) console.log(`❌  Errors:  ${errors}`);
  console.log(DRY_RUN ? "\n(Dry run — no DB writes)" : "\n🎉 Done!");
  process.exit(errors > 0 ? 1 : 0);
}

main().catch(e => { console.error(e); process.exit(1); });
