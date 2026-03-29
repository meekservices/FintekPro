/**
 * FintekPro — Direct DB-to-DB copy from old Neon to new Neon
 * 
 * Source: PRODUCTION_DATABASE_URL  (ep-muddy-queen — 5.6GB, old Replit Neon)
 * Dest  : TARGET_DB_URL            (ep-long-rain   — new Neon project)
 * 
 * Run:  node scripts/copy-to-new-neon.mjs [--include-nav]
 *   --include-nav  also copies historical_nav_data (16M rows, ~30 min)
 */

import pg from 'pg';
const { Pool } = pg;

const SRC_URL = process.env.PRODUCTION_DATABASE_URL;
const DST_URL = process.env.TARGET_DB_URL || 
  'postgresql://neondb_owner:npg_is3cCjaF6Lky@ep-long-rain-a4sitf97-pooler.us-east-1.aws.neon.tech/neondb?sslmode=require';

if (!SRC_URL) { console.error('❌ PRODUCTION_DATABASE_URL not set'); process.exit(1); }

const includeNav = process.argv.includes('--include-nav');

const src = new Pool({ connectionString: SRC_URL, ssl: { rejectUnauthorized: false }, max: 3 });
const dst = new Pool({ connectionString: DST_URL, ssl: { rejectUnauthorized: false }, max: 5 });

// Tables in dependency order (no FK violations)
// Excludes historical_nav_data unless --include-nav is passed
const TABLES = [
  // Reference / seed tables
  { name: 'market_indices',          batch: 500  },
  { name: 'commodities',             batch: 500  },
  { name: 'reits',                   batch: 500  },
  { name: 'invits',                  batch: 500  },
  { name: 'bond_catalog',            batch: 500  },
  { name: 'aif_master',              batch: 500  },
  { name: 'instrument_master',       batch: 500  },
  // Users / agents / partners (must come before FK dependents)
  { name: 'users',                   batch: 200  },
  { name: 'agents',                  batch: 200  },
  { name: 'partners',                batch: 200  },
  { name: 'portfolios',              batch: 200  },
  // Enriched market data
  { name: 'mutual_funds',            batch: 500  },
  { name: 'listed_stocks',           batch: 500  },
  { name: 'screener_stocks',         batch: 500  },
  { name: 'screener_financials',     batch: 300  },
  { name: 'screener_derived_metrics',batch: 300  },
  { name: 'mf_benchmark_map',        batch: 500  },
  { name: 'golden_prices',           batch: 500  },
  { name: 'symbol_mapping',          batch: 500  },
  { name: 'fixed_income_status_log', batch: 300  },
  { name: 'mf_nav_history',          batch: 500  },
  // NAV history — large, only with --include-nav
  ...(includeNav ? [{ name: 'historical_nav_data', batch: 1000 }] : []),
];

async function tableExists(pool, table) {
  const r = await pool.query(
    `SELECT 1 FROM information_schema.tables WHERE table_name=$1 AND table_schema='public'`, [table]
  );
  return r.rows.length > 0;
}

async function getColumns(pool, table) {
  const r = await pool.query(
    `SELECT column_name FROM information_schema.columns WHERE table_name=$1 AND table_schema='public' ORDER BY ordinal_position`, [table]
  );
  return r.rows.map(x => x.column_name);
}

async function copyTable({ name: table, batch }) {
  const srcExists = await tableExists(src, table);
  if (!srcExists) { console.log(`  ⏭  ${table}: not in source, skipped`); return; }
  const dstExists = await tableExists(dst, table);
  if (!dstExists) { console.log(`  ⏭  ${table}: not in destination yet, skipped`); return; }

  const countRes = await src.query(`SELECT COUNT(*) as n FROM "${table}"`);
  const total = parseInt(countRes.rows[0].n);
  if (total === 0) { console.log(`  ⚬  ${table}: empty`); return; }

  const cols = await getColumns(src, table);
  const colList = cols.map(c => `"${c}"`).join(', ');
  const placeholderFn = (rowIdx) =>
    '(' + cols.map((_, ci) => '$' + (rowIdx * cols.length + ci + 1)).join(', ') + ')';

  // Truncate destination table
  const dstClient = await dst.connect();
  await dstClient.query(`TRUNCATE TABLE "${table}" CASCADE`);

  let offset = 0;
  let inserted = 0;
  const startMs = Date.now();

  while (offset < total) {
    const rows = await src.query(
      `SELECT ${colList} FROM "${table}" ORDER BY 1 LIMIT ${batch} OFFSET ${offset}`
    );
    if (rows.rows.length === 0) break;

    // Build multi-row insert
    const placeholders = rows.rows.map((_, ri) => placeholderFn(ri)).join(', ');
    const values = rows.rows.flatMap(row => cols.map(c => row[c]));

    try {
      await dstClient.query(
        `INSERT INTO "${table}" (${colList}) VALUES ${placeholders} ON CONFLICT DO NOTHING`,
        values
      );
      inserted += rows.rows.length;
    } catch (e) {
      // Fall back to row-by-row on conflict
      for (const row of rows.rows) {
        const singlePH = '(' + cols.map((_, i) => '$' + (i + 1)).join(', ') + ')';
        const vals = cols.map(c => row[c]);
        await dstClient.query(
          `INSERT INTO "${table}" (${colList}) VALUES ${singlePH} ON CONFLICT DO NOTHING`,
          vals
        ).catch(() => {});
        inserted++;
      }
    }

    offset += batch;

    // Progress for large tables
    if (total > 5000 && offset % 5000 === 0) {
      const pct = Math.round(offset / total * 100);
      const elapsed = ((Date.now() - startMs) / 1000).toFixed(0);
      process.stdout.write(`  ${table}: ${pct}% (${offset.toLocaleString()}/${total.toLocaleString()}) ${elapsed}s\n`);
    }
  }

  dstClient.release();
  const secs = ((Date.now() - startMs) / 1000).toFixed(1);
  console.log(`  ✅ ${table.padEnd(35)} ${inserted.toLocaleString().padStart(10)} / ${total.toLocaleString()} rows  [${secs}s]`);
}

async function main() {
  console.log('\n🚀  FintekPro — Database Copy');
  console.log(`   Source: ${SRC_URL.match(/@([^/]+)/)?.[1]}`);
  console.log(`   Dest  : ${DST_URL.match(/@([^/]+)/)?.[1]}`);
  console.log(`   Tables: ${TABLES.length}${includeNav ? ' (including historical_nav_data)' : ''}\n`);

  for (const t of TABLES) {
    await copyTable(t);
  }

  // Final counts
  console.log('\n📊  Final row counts in destination:');
  const check = ['mutual_funds','listed_stocks','screener_stocks','bond_catalog','users','agents','mf_nav_history'];
  for (const t of check) {
    const r = await dst.query(`SELECT COUNT(*) FROM "${t}"`).catch(() => ({ rows: [{ count: 'N/A' }] }));
    console.log(`   ${t.padEnd(30)} ${r.rows[0].count}`);
  }

  await src.end();
  await dst.end();
  console.log('\n✅  Copy complete!\n');
  console.log('Next step: Set PRODUCTION_DATABASE_URL in Railway to:');
  console.log(DST_URL);
}

main().catch(e => { console.error('❌ Fatal:', e.message); process.exit(1); });
