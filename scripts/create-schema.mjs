import pg from 'pg';
const { Pool } = pg;

const NEON = 'postgresql://neondb_owner:npg_is3cCjaF6Lky@ep-long-rain-a4sitf97-pooler.us-east-1.aws.neon.tech/neondb?sslmode=require';
const RAILWAY = 'postgresql://postgres:piNjsIgTTtVFKghdEBYIoGOeiknfrDMG@gondola.proxy.rlwy.net:34748/railway';

const src = new Pool({ connectionString: NEON, ssl: { rejectUnauthorized: false }, max: 3 });
const dst = new Pool({ connectionString: RAILWAY, max: 3 });

function colType(col) {
  const { data_type, udt_name, column_default, character_maximum_length, numeric_precision, numeric_scale } = col;
  if (column_default && column_default.startsWith('nextval(')) {
    if (data_type === 'integer') return { type: 'serial', useDefault: false };
    if (data_type === 'bigint') return { type: 'bigserial', useDefault: false };
    if (data_type === 'smallint') return { type: 'smallserial', useDefault: false };
  }
  if (data_type === 'ARRAY') return { type: `${udt_name.replace(/^_/, '')}[]`, useDefault: true };
  if (data_type === 'USER-DEFINED') return { type: `"${udt_name}"`, useDefault: true };
  if (data_type === 'character varying' && character_maximum_length) return { type: `varchar(${character_maximum_length})`, useDefault: true };
  if (data_type === 'character varying') return { type: 'text', useDefault: true };
  if (data_type === 'numeric' && numeric_precision !== null && numeric_scale !== null)
    return { type: `numeric(${numeric_precision},${numeric_scale})`, useDefault: true };
  return { type: data_type, useDefault: true };
}

async function main() {
  console.log('Fetching schema from Neon...');
  
  const [enums, cols, pks, indexes] = await Promise.all([
    src.query(`SELECT t.typname as name, string_agg(e.enumlabel, ',' ORDER BY e.enumsortorder) as values
               FROM pg_type t JOIN pg_enum e ON t.oid=e.enumtypid
               JOIN pg_namespace n ON n.oid=t.typnamespace WHERE n.nspname='public' GROUP BY t.typname`),
    src.query(`SELECT table_name,column_name,ordinal_position,column_default,is_nullable,
               data_type,udt_name,character_maximum_length,numeric_precision,numeric_scale
               FROM information_schema.columns WHERE table_schema='public' ORDER BY table_name,ordinal_position`),
    src.query(`SELECT tc.table_name, kcu.column_name FROM information_schema.table_constraints tc
               JOIN information_schema.key_column_usage kcu ON tc.constraint_name=kcu.constraint_name AND tc.table_schema=kcu.table_schema
               WHERE tc.constraint_type='PRIMARY KEY' AND tc.table_schema='public' ORDER BY tc.table_name,kcu.ordinal_position`),
    src.query(`SELECT indexname,tablename,indexdef FROM pg_indexes WHERE schemaname='public'
               AND indexname NOT IN (SELECT constraint_name FROM information_schema.table_constraints
               WHERE constraint_type IN ('PRIMARY KEY','UNIQUE') AND table_schema='public')`)
  ]);
  
  console.log(`Got: ${enums.rows.length} enums, ${Object.keys(cols.rows.reduce((a,r)=>{a[r.table_name]=1;return a},{})).length} tables, ${indexes.rows.length} indexes`);

  const tableMap = {};
  for (const col of cols.rows) {
    if (!tableMap[col.table_name]) tableMap[col.table_name] = [];
    tableMap[col.table_name].push(col);
  }
  const pkMap = {};
  for (const pk of pks.rows) {
    if (!pkMap[pk.table_name]) pkMap[pk.table_name] = [];
    pkMap[pk.table_name].push(pk.column_name);
  }

  // Build all DDL as single SQL block
  const ddlParts = [];

  // Enums
  for (const e of enums.rows) {
    const rawVals = String(e.values || '').split(',').filter(Boolean);
    const vals = rawVals.map(v => `'${v.replace(/'/g, "''")}'`).join(', ');
    if (!vals) continue;
    ddlParts.push(`DO $$ BEGIN CREATE TYPE "${e.name}" AS ENUM (${vals}); EXCEPTION WHEN duplicate_object THEN null; END $$;`);
  }

  // Tables
  let tableCount = 0;
  for (const [table, tableCols] of Object.entries(tableMap)) {
    const colDefs = tableCols.map(c => {
      const { type, useDefault } = colType(c);
      let def = `  "${c.column_name}" ${type}`;
      if (useDefault && c.column_default && !c.column_default.startsWith('nextval('))
        def += ` DEFAULT ${c.column_default}`;
      if (c.is_nullable === 'NO') def += ' NOT NULL';
      return def;
    });
    const pkCols = pkMap[table];
    if (pkCols?.length) colDefs.push(`  PRIMARY KEY (${pkCols.map(c=>`"${c}"`).join(', ')})`);
    ddlParts.push(`CREATE TABLE IF NOT EXISTS "${table}" (\n${colDefs.join(',\n')}\n);`);
    tableCount++;
  }

  // Indexes
  for (const idx of indexes.rows) {
    const safe = idx.indexdef
      .replace(/^CREATE INDEX /, 'CREATE INDEX IF NOT EXISTS ')
      .replace(/^CREATE UNIQUE INDEX /, 'CREATE UNIQUE INDEX IF NOT EXISTS ');
    ddlParts.push(safe + ';');
  }

  const fullSQL = ddlParts.join('\n');
  console.log(`Executing ${ddlParts.length} DDL statements in one shot (~${Math.round(fullSQL.length/1024)}KB)...`);

  const dstClient = await dst.connect();
  try {
    await dstClient.query(fullSQL);
    console.log('✅ Schema applied successfully!');
  } catch(e) {
    console.error('Error applying full batch, trying statement-by-statement...');
    let ok = 0, fail = 0;
    for (const stmt of ddlParts) {
      try { await dstClient.query(stmt); ok++; }
      catch(err) { 
        if (!err.message.includes('already exists') && !err.message.includes('duplicate')) {
          console.log(`  ❌ ${err.message.slice(0,80)}`);
          fail++;
        }
      }
    }
    console.log(`Fallback: ${ok} ok, ${fail} errors`);
  } finally {
    dstClient.release();
  }

  const count = await dst.query(`SELECT count(*) as n FROM pg_tables WHERE schemaname='public'`);
  console.log(`\n🎉 Railway Postgres now has ${count.rows[0].n} tables`);

  await src.end();
  await dst.end();
}

main().catch(e => { console.error('Failed:', e.message); process.exit(1); });
