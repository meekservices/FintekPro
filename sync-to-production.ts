import fs from 'fs';

const PRODUCTION_URL = 'https://fintekpro.replit.app';
const MIGRATION_SECRET = 'fintekpro-bond-sync-2026';
const BATCH_SIZE = 200;

async function syncToProd() {
  console.log('🔄 Syncing bonds to production...\n');
  
  // Read exported bonds
  const bondsData = fs.readFileSync('bond-catalog-export.json', 'utf-8');
  const bonds = JSON.parse(bondsData);
  console.log(`📊 Loaded ${bonds.length} bonds from export file\n`);
  
  let totalInserted = 0;
  let totalSkipped = 0;
  
  // Send in batches
  for (let i = 0; i < bonds.length; i += BATCH_SIZE) {
    const batch = bonds.slice(i, i + BATCH_SIZE);
    console.log(`Sending batch ${Math.floor(i/BATCH_SIZE) + 1}/${Math.ceil(bonds.length/BATCH_SIZE)} (${batch.length} bonds)...`);
    
    try {
      const response = await fetch(`${PRODUCTION_URL}/api/migration/sync-bonds`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ secret: MIGRATION_SECRET, bonds: batch })
      });
      
      if (!response.ok) {
        const error = await response.text();
        console.error(`❌ Batch failed: ${error}`);
        continue;
      }
      
      const result = await response.json();
      totalInserted += result.inserted;
      totalSkipped += result.skipped;
      console.log(`   ✅ Inserted: ${result.inserted}, Skipped: ${result.skipped}`);
    } catch (err: any) {
      console.error(`❌ Batch error: ${err.message}`);
    }
  }
  
  console.log('\n' + '='.repeat(50));
  console.log(`✅ Sync complete!`);
  console.log(`   Total inserted: ${totalInserted}`);
  console.log(`   Total skipped: ${totalSkipped}`);
}

syncToProd().catch(console.error);
