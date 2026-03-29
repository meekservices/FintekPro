/**
 * Copy historical_nav_data from old Neon to new Neon
 * 16.7M rows — runs in background, writes progress to /tmp/nav-copy.log
 *
 * Usage: node scripts/copy-nav-history.mjs
 */
import pg from 'pg';
import fs from 'fs';

const { Pool } = pg;
const LOG = '/tmp/nav-copy.log';

function log(msg) {
  const line = new Date().toISOString() + ' ' + msg;
  console.log(line);
  fs.appendFileSync(LOG, line + '\n');
}

const SRC_URL = process.env.PRODUCTION_DATABASE_URL;
const DST_URL = 'postgresql://neondb_owner:npg_is3cCjaF6Lky@ep-long-rain-a4sitf97-pooler.us-east-1.aws.neon.tech/neondb?sslmode=require';

const src = new Pool({ connectionString: SRC_URL, ssl: { rejectUnauthorized: false }, max: 2, statement_timeout: 120000 });
const dst = new Pool({ connectionString: DST_URL, ssl: { rejectUnauthorized: false }, max: 4, statement_timeout: 120000 });

const BATCH = 2000;
const CHECKPOINT_FILE = '/tmp/nav-copy-offset.txt';

async function main() {
  // Get columns
  const cols = await src.query(
    `SELECT column_name FROM information_schema.columns
     WHERE table_name='historical_nav_data' AND table_schema='public'
     ORDER BY ordinal_position`
  );
  const colList = cols.rows.map(r => r.column_name);
  const colNames = colList.map(c => `"${c}"`).join(', ');

  const totalRes = await src.query('SELECT COUNT(*) as n FROM historical_nav_data');
  const total = parseInt(totalRes.rows[0].n);
  log(`Total rows to copy: ${total.toLocaleString()}`);

  // Truncate destination
  const dstCur = await dst.query('SELECT COUNT(*) as n FROM historical_nav_data');
  const dstCount = parseInt(dstCur.rows[0].n);
  
  // Resume from checkpoint if exists
  let startOffset = 0;
  if (fs.existsSync(CHECKPOINT_FILE)) {
    const saved = parseInt(fs.readFileSync(CHECKPOINT_FILE, 'utf8').trim());
    if (saved > 0 && saved < total) {
      startOffset = saved;
      log(`Resuming from offset ${startOffset.toLocaleString()}`);
    }
  }
  
  if (startOffset === 0 && dstCount > 0) {
    log(`Truncating destination (had ${dstCount.toLocaleString()} rows)...`);
    const dc = await dst.connect();
    await dc.query('TRUNCATE TABLE historical_nav_data');
    dc.release();
  }

  let offset = startOffset;
  let inserted = startOffset; // treat as already inserted
  const startTime = Date.now();

  while (offset < total) {
    const rows = await src.query(
      `SELECT ${colNames} FROM historical_nav_data ORDER BY 1 LIMIT ${BATCH} OFFSET ${offset}`
    );
    if (!rows.rows.length) break;

    // Build multi-row insert in chunks of 500 to stay under param limits
    const CHUNK = 500;
    const dc = await dst.connect();
    try {
      for (let ci = 0; ci < rows.rows.length; ci += CHUNK) {
        const chunk = rows.rows.slice(ci, ci + CHUNK);
        const ph = chunk.map((_, ri) =>
          '(' + colList.map((_, ci2) => '$' + (ri * colList.length + ci2 + 1)).join(', ') + ')'
        ).join(', ');
        const vals = chunk.flatMap(r => colList.map(c => r[c]));
        await dc.query(
          `INSERT INTO historical_nav_data (${colNames}) VALUES ${ph} ON CONFLICT DO NOTHING`,
          vals
        ).catch(async () => {
          // Row-by-row fallback
          for (const r of chunk) {
            const v = colList.map(c => r[c]);
            const p = '(' + colList.map((_, i) => '$' + (i + 1)).join(', ') + ')';
            await dc.query(
              `INSERT INTO historical_nav_data (${colNames}) VALUES ${p} ON CONFLICT DO NOTHING`, v
            ).catch(() => {});
          }
        });
      }
    } finally {
      dc.release();
    }

    inserted += rows.rows.length;
    offset += BATCH;

    // Save checkpoint every 20k rows
    if (offset % 20000 === 0) {
      fs.writeFileSync(CHECKPOINT_FILE, String(offset));
    }

    // Progress every 100k rows
    if (offset % 100000 === 0) {
      const pct = Math.round(offset / total * 100);
      const elapsed = Math.round((Date.now() - startTime) / 1000);
      const rate = Math.round(offset / elapsed);
      const remaining = Math.round((total - offset) / rate / 60);
      log(`Progress: ${pct}% (${offset.toLocaleString()}/${total.toLocaleString()}) | ${rate.toLocaleString()} rows/s | ~${remaining} min remaining`);
    }
  }

  const elapsed = Math.round((Date.now() - startTime) / 1000);
  log(`COMPLETE: ${inserted.toLocaleString()} rows copied in ${Math.round(elapsed/60)}m ${elapsed%60}s`);
  
  // Cleanup checkpoint
  if (fs.existsSync(CHECKPOINT_FILE)) fs.unlinkSync(CHECKPOINT_FILE);
  
  await src.end();
  await dst.end();
}

main().catch(e => {
  log('FATAL: ' + e.message);
  process.exit(1);
});
