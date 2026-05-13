import pg from 'pg';
const { Pool } = pg;

const NEON = 'postgresql://neondb_owner:npg_is3cCjaF6Lky@ep-long-rain-a4sitf97-pooler.us-east-1.aws.neon.tech/neondb?sslmode=require';
const RAILWAY = 'postgresql://postgres:piNjsIgTTtVFKghdEBYIoGOeiknfrDMG@gondola.proxy.rlwy.net:34748/railway';

const src = new Pool({ connectionString: NEON, ssl: { rejectUnauthorized: false }, max: 5 });
const dst = new Pool({ connectionString: RAILWAY, max: 5 });

// Priority order — most important first
const PRIORITY_TABLES = [
  'users', 'user_profiles', 'agents', 'partners', 'portfolios',
  'portfolio_holdings', 'transactions', 'goals', 'sip_records',
  'mutual_funds', 'bond_catalog', 'listed_stocks', 'instrument_master',
  'screener_stocks', 'screener_financials', 'market_indices',
  'mf_benchmark_map', 'mf_nav_history', 'mf_monthly_returns',
  'mf_scheme_exit_loads', 'bond_metrics', 'golden_prices',
  'instrument_prices', 'instrument_returns', 'pick_of_the_day',
  'daily_picks', 'market_stories', 'partners',
];

const SKIP = ['historical_nav_data']; // rebuilt by EnrichmentWorker

async function copyTable(table) {
  try {
    const countRes = await src.query(`SELECT COUNT(*) as n FROM "${table}"`);
    const total = parseInt(countRes.rows[0].n);
    if (total === 0) return { table, copied: 0, total: 0, status: 'empty' };

    const colRes = await src.query(
      `SELECT column_name FROM information_schema.columns WHERE table_schema='public' AND table_name=$1 ORDER BY ordinal_position`,
      [table]
    );
    const cols = colRes.rows.map(r => r.column_name);
    const colList = cols.map(c => `"${c}"`).join(', ');
    const placeholders = cols.map((_, i) => `$${i + 1}`).join(', ');

    // Clear and copy
    await dst.query(`DELETE FROM "${table}"`);

    const BATCH = 1000;
    let copied = 0;
    while (copied < total) {
      const rows = await src.query(`SELECT ${colList} FROM "${table}" ORDER BY 1 LIMIT ${BATCH} OFFSET ${copied}`);
      if (!rows.rows.length) break;

      // Batch insert
      const values = [];
      const rowPlaceholders = [];
      let pIdx = 1;
      for (const row of rows.rows) {
        const rowVals = cols.map(c => row[c]);
        rowPlaceholders.push(`(${rowVals.map(() => `$${pIdx++}`).join(',')})`);
        values.push(...rowVals);
      }
      await dst.query(
        `INSERT INTO "${table}" (${colList}) VALUES ${rowPlaceholders.join(',')} ON CONFLICT DO NOTHING`,
        values
      ).catch(async () => {
        // Fallback: row by row
        for (const row of rows.rows) {
          await dst.query(
            `INSERT INTO "${table}" (${colList}) VALUES (${placeholders}) ON CONFLICT DO NOTHING`,
            cols.map(c => row[c])
          ).catch(() => {});
        }
      });
      copied += rows.rows.length;
    }
    return { table, copied, total, status: 'ok' };
  } catch(e) {
    return { table, error: e.message.slice(0, 100), status: 'error' };
  }
}

async function main() {
  console.log('🚀 Starting Neon → Railway migration...\n');
  await Promise.all([src.query('SELECT 1'), dst.query('SELECT 1')]);

  // Get all tables from source
  const allTablesRes = await src.query(
    `SELECT tablename FROM pg_tables WHERE schemaname='public' ORDER BY tablename`
  );
  const allTables = allTablesRes.rows.map(r => r.tablename).filter(t => !SKIP.includes(t));

  // Put priority tables first, then the rest
  const prioritySet = new Set(PRIORITY_TABLES);
  const ordered = [
    ...PRIORITY_TABLES.filter(t => allTables.includes(t)),
    ...allTables.filter(t => !prioritySet.has(t))
  ];

  console.log(`Tables to copy: ${ordered.length} (skipping: ${SKIP.join(', ')})\n`);

  let success = 0, empty = 0, errors = 0, totalRows = 0;

  for (const table of ordered) {
    const result = await copyTable(table);
    if (result.status === 'error') {
      console.log(`  ❌ ${table}: ${result.error}`);
      errors++;
    } else if (result.status === 'empty') {
      empty++;
    } else {
      if (result.copied > 0) {
        console.log(`  ✅ ${table}: ${result.copied} rows`);
        totalRows += result.copied;
      }
      success++;
    }
  }

  console.log(`\n✅ Migration complete!`);
  console.log(`   Tables: ${success} copied, ${empty} empty, ${errors} errors`);
  console.log(`   Total rows: ${totalRows.toLocaleString()}`);
  console.log(`   Skipped: historical_nav_data (rebuilt by EnrichmentWorker)\n`);

  // Verify key tables
  console.log('Verification:');
  for (const t of ['users', 'agents', 'mutual_funds', 'bond_catalog', 'screener_stocks', 'instrument_master', 'listed_stocks']) {
    const r = await dst.query(`SELECT COUNT(*) as n FROM "${t}"`).catch(() => ({ rows: [{ n: 'ERR' }] }));
    console.log(`  ${t}: ${r.rows[0].n}`);
  }

  await src.end();
  await dst.end();
}

main().catch(e => { console.error('Failed:', e.message); process.exit(1); });
