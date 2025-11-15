import { userProfiles } from '../shared/schema';
import { db } from '../server/db';
import { sql } from 'drizzle-orm';

async function diffUserProfiles() {
  console.log('📊 Extracting schema from shared/schema.ts...');
  
  // Get schema columns from Drizzle
  const schemaColumns: any[] = [];
  for (const [key, column] of Object.entries(userProfiles)) {
    if (key === 'getSQL') continue;
    
    const col: any = column;
    const columnName = col.name || key;
    
    // Extract column type info
    let dataType = 'unknown';
    let precision: number | null = null;
    let scale: number | null = null;
    let defaultValue: string | null = null;
    
    if (col.dataType) {
      if (col.dataType === 'string') dataType = 'varchar';
      else if (col.dataType === 'number') {
        // Check if it's decimal with precision
        if (col.columnType && col.columnType.includes('numeric')) {
          dataType = 'numeric';
          const match = col.columnType.match(/numeric\((\d+),\s*(\d+)\)/);
          if (match) {
            precision = parseInt(match[1]);
            scale = parseInt(match[2]);
          }
        } else if (col.columnType && col.columnType.includes('serial')) {
          dataType = 'integer';
        } else {
          dataType = 'numeric';
        }
      }
      else if (col.dataType === 'boolean') dataType = 'boolean';
      else if (col.dataType === 'date') dataType = 'timestamp';
      else if (col.dataType === 'json') dataType = 'jsonb';
    }
    
    // Try to extract default value
    if (col.default !== undefined) {
      if (typeof col.default === 'string') {
        defaultValue = `'${col.default}'`;
      } else if (typeof col.default === 'boolean') {
        defaultValue = col.default.toString();
      } else if (typeof col.default === 'function') {
        defaultValue = 'NOW()';
      }
    }
    
    schemaColumns.push({
      columnName,
      dataType,
      precision,
      scale,
      defaultValue,
      rawColumn: col
    });
  }
  
  console.log(`✅ Found ${schemaColumns.length} columns in schema`);
  
  // Get actual database columns
  console.log('\n📊 Querying database for current columns...');
  
  const dbColumns = await db.execute(sql`
    SELECT 
      column_name,
      data_type,
      numeric_precision,
      numeric_scale,
      column_default,
      is_nullable
    FROM information_schema.columns 
    WHERE table_name = 'user_profiles' 
    ORDER BY ordinal_position
  `);
  
  console.log(`✅ Found ${dbColumns.rows.length} columns in database\n`);
  
  // Find missing columns
  const dbColumnNames = new Set(dbColumns.rows.map((r: any) => r.column_name));
  const missingColumns = schemaColumns.filter(
    col => !dbColumnNames.has(col.columnName)
  );
  
  console.log(`\n🔍 ANALYSIS:`);
  console.log(`   Schema defines: ${schemaColumns.length} columns`);
  console.log(`   Database has: ${dbColumns.rows.length} columns`);
  console.log(`   Missing: ${missingColumns.length} columns\n`);
  
  if (missingColumns.length === 0) {
    console.log('✅ Database is in sync with schema!');
    return;
  }
  
  // Generate migration SQL
  console.log('📝 Generating migration SQL...\n');
  console.log('-- Add missing columns to user_profiles table');
  console.log('ALTER TABLE user_profiles');
  
  const alterStatements: string[] = [];
  
  for (const col of missingColumns) {
    let sqlType = col.dataType.toUpperCase();
    
    if (col.dataType === 'numeric' && col.precision && col.scale) {
      sqlType = `NUMERIC(${col.precision}, ${col.scale})`;
    } else if (col.dataType === 'varchar') {
      sqlType = 'VARCHAR';
    } else if (col.dataType === 'timestamp') {
      sqlType = 'TIMESTAMP WITH TIME ZONE';
    }
    
    let stmt = `ADD COLUMN IF NOT EXISTS "${col.columnName}" ${sqlType}`;
    
    if (col.defaultValue) {
      stmt += ` DEFAULT ${col.defaultValue}`;
    }
    
    alterStatements.push(stmt);
  }
  
  console.log(alterStatements.join(',\n') + ';');
  
  console.log(`\n✅ Generated ALTER TABLE with ${alterStatements.length} column additions`);
  console.log('\nCopy the SQL above and run it via execute_sql_tool to sync the database.');
}

diffUserProfiles()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('❌ Error:', err);
    process.exit(1);
  });
