#!/usr/bin/env node
/**
 * FintekPro Production Database Backup
 * Works with any PostgreSQL server version (no pg_dump version dependency)
 * 
 * Usage:  node scripts/backup-production.mjs
 * Output: backup-YYYYMMDD-HHMM.sql  (plain SQL, gzip-friendly)
 */

import pg from 'pg';
import fs from 'fs';
import { createGzip } from 'zlib';
import { pipeline } from 'stream/promises';
import { Readable } from 'stream';

const { Pool } = pg;

const DB_URL = process.env.PRODUCTION_DATABASE_URL;
if (!DB_URL) {
  console.error('❌ PRODUCTION_DATABASE_URL not set');
  process.exit(1);
}

const TIMESTAMP = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 16);
const OUTPUT_FILE = `backup-${TIMESTAMP}.sql.gz`;

// Tables to back up — ordered by dependency (no FK violations on restore)
const TABLES = [
  // Seed / reference tables first
  'market_indices',
  'feature_flags',
  'commodities',
  'reits',
  'invits',
  'bond_catalog',
  'aif_master',
  'instrument_master',
  // Core enriched data (the valuable stuff)
  'mutual_funds',
  'listed_stocks',
  'screener_stocks',
  'screener_financials',
  'screener_derived_metrics',
  'mf_benchmark_map',
  'golden_prices',
  'symbol_mapping',
  'fixed_income_status_log',
  // NAV history — largest table, backed up last
  'mf_nav_history',
  'historical_nav_data',
];

const pool = new Pool({
  connectionString: DB_URL,
  ssl: { rejectUnauthorized: false },
  max: 3,
  connectionTimeoutMillis: 30000,
  query_timeout: 120000,
});

async function getTableColumns(client, table) {
  const res = await client.query(
    `SELECT column_name, data_type 
     FROM information_schema.columns 
     WHERE table_name = $1 AND table_schema = 'public'
     ORDER BY ordinal_position`,
    [table]
  );
  return res.rows;
}

async function getRowCount(client, table) {
  const res = await client.query(`SELECT COUNT(*) as cnt FROM "${table}"`);
  return parseInt(res.rows[0].cnt);
}

function escape(val) {
  if (val === null || val === undefined) return 'NULL';
  if (typeof val === 'boolean') return val ? 'TRUE' : 'FALSE';
  if (typeof val === 'number') return String(val);
  if (val instanceof Date) return `'${val.toISOString()}'`;
  if (typeof val === 'object') return `'${JSON.stringify(val).replace(/'/g, "''")}'`;
  return `'${String(val).replace(/'/g, "''")}'`;
}

async function* generateSQL(client) {
  yield `-- FintekPro Production Backup\n`;
  yield `-- Generated: ${new Date().toISOString()}\n`;
  yield `-- Database: ${DB_URL.match(/@([^/]+)/)?.[1] || 'unknown'}\n\n`;
  yield `SET client_encoding = 'UTF8';\n`;
  yield `SET standard_conforming_strings = on;\n\n`;

  for (const table of TABLES) {
    // Check table exists
    const exists = await client.query(
      `SELECT 1 FROM information_schema.tables WHERE table_name=$1 AND table_schema='public'`,
      [table]
    );
    if (exists.rows.length === 0) {
      yield `-- Table ${table}: does not exist, skipped\n\n`;
      continue;
    }

    const count = await getRowCount(client, table);
    const cols = await getTableColumns(client, table);
    const colNames = cols.map(c => `"${c.column_name}"`).join(', ');

    console.log(`  📦 ${table.padEnd(35)} ${count.toLocaleString().padStart(12)} rows`);

    yield `-- ============================================================\n`;
    yield `-- Table: ${table}  (${count.toLocaleString()} rows)\n`;
    yield `-- ============================================================\n`;
    yield `TRUNCATE TABLE "${table}" CASCADE;\n\n`;

    if (count === 0) {
      yield `-- (empty table)\n\n`;
      continue;
    }

    // Stream rows in batches of 500
    const BATCH = 500;
    let offset = 0;
    while (offset < count) {
      const res = await client.query(
        `SELECT * FROM "${table}" ORDER BY 1 LIMIT ${BATCH} OFFSET ${offset}`
      );
      if (res.rows.length === 0) break;

      for (const row of res.rows) {
        const values = cols.map(c => escape(row[c.column_name])).join(', ');
        yield `INSERT INTO "${table}" (${colNames}) VALUES (${values});\n`;
      }
      offset += BATCH;
    }
    yield `\n`;
  }

  yield `-- Backup complete: ${new Date().toISOString()}\n`;
}

async function run() {
  console.log(`\n🗄️  FintekPro Production Backup`);
  console.log(`   Output: ${OUTPUT_FILE}\n`);

  const client = await pool.connect();
  const gzip = createGzip({ level: 9 });
  const out = fs.createWriteStream(OUTPUT_FILE);

  try {
    const sqlStream = Readable.from(generateSQL(client));
    await pipeline(sqlStream, gzip, out);
    const stats = fs.statSync(OUTPUT_FILE);
    const mb = (stats.size / 1024 / 1024).toFixed(1);
    console.log(`\n✅ Backup complete → ${OUTPUT_FILE} (${mb} MB compressed)`);
  } finally {
    client.release();
    await pool.end();
  }
}

run().catch(e => {
  console.error('❌ Backup failed:', e.message);
  process.exit(1);
});
