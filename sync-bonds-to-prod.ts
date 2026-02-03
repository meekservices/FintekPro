import { db } from './server/db';
import { bondCatalog } from '@shared/schema';

const PRODUCTION_URL = process.env.REPL_SLUG 
  ? `https://${process.env.REPL_SLUG}.${process.env.REPL_OWNER}.repl.co`
  : 'https://fintekpro.replit.app';

async function syncBondsToProd() {
  console.log('🔄 Starting bond catalog sync to production...\n');
  
  // Fetch all bonds from development database
  console.log('📊 Fetching bonds from development database...');
  const bonds = await db.select().from(bondCatalog);
  console.log(`Found ${bonds.length} bonds in development\n`);
  
  if (bonds.length === 0) {
    console.log('No bonds to sync');
    return;
  }
  
  // Export to JSON file for manual upload if API fails
  const fs = await import('fs');
  fs.writeFileSync('bond-catalog-export.json', JSON.stringify(bonds, null, 2));
  console.log('📁 Exported bonds to bond-catalog-export.json\n');
  
  console.log(`Total bonds exported: ${bonds.length}`);
  console.log('\n✅ Bond data exported successfully!');
  console.log('\nTo import to production:');
  console.log('1. Log in as admin on production');
  console.log('2. Use the Admin > Fixed Income > Import feature');
  console.log('3. Or call POST /api/admin/bonds/bulk-import-bonds with the JSON data');
}

syncBondsToProd().catch(console.error).finally(() => process.exit(0));
