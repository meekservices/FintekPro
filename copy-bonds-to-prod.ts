import { Pool } from '@neondatabase/serverless';

const devPool = new Pool({ connectionString: process.env.DATABASE_URL });
const prodPool = new Pool({ connectionString: process.env.PRODUCTION_DATABASE_URL });

async function copyBonds() {
  console.log('Fetching bonds from development...');
  
  try {
    // Get all bonds from development
    const { rows: bonds } = await devPool.query('SELECT * FROM bond_catalog');
    console.log(`Found ${bonds.length} bonds in development`);
    
    // Get existing bonds in production
    const { rows: existingBonds } = await prodPool.query('SELECT id FROM bond_catalog');
    const existingIds = new Set(existingBonds.map((b: any) => b.id));
    console.log(`Found ${existingIds.size} bonds in production`);
    
    // Filter new bonds
    const newBonds = bonds.filter((b: any) => !existingIds.has(b.id));
    console.log(`${newBonds.length} bonds to insert`);
    
    if (newBonds.length === 0) {
      console.log('No new bonds to insert');
      return;
    }
    
    // Insert in batches of 50
    let inserted = 0;
    
    for (const bond of newBonds) {
      try {
        await prodPool.query(`
          INSERT INTO bond_catalog (
            id, source, source_id, isin, bond_name, issuer_name, instrument_type,
            is_listed, exchange, face_value, coupon_rate, coupon_frequency,
            issue_date, maturity_date, clean_price, dirty_price, accrued_interest,
            yield_to_maturity, credit_rating, rating_agency, min_investment, lot_size,
            tax_category, tds_applicable, tds_rate, fee_profile_id, fee_override_id,
            net_yield_to_maturity, status, published_at, published_by, unpublished_at,
            unpublished_by, unpublish_reason, compliance_approved, compliance_approved_by,
            compliance_approved_at, regulatory_tier, kyc_tier_required, last_sync_at,
            sync_errors, created_at, updated_at, created_by, updated_by, region, country, currency
          ) VALUES (
            $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17,
            $18, $19, $20, $21, $22, $23, $24, $25, $26, $27, $28, $29, $30, $31, $32,
            $33, $34, $35, $36, $37, $38, $39, $40, $41, $42, $43, $44, $45, $46, $47, $48
          ) ON CONFLICT (id) DO NOTHING
        `, [
          bond.id, bond.source, bond.source_id, bond.isin, bond.bond_name, bond.issuer_name,
          bond.instrument_type, bond.is_listed, bond.exchange, bond.face_value, bond.coupon_rate,
          bond.coupon_frequency, bond.issue_date, bond.maturity_date, bond.clean_price,
          bond.dirty_price, bond.accrued_interest, bond.yield_to_maturity, bond.credit_rating,
          bond.rating_agency, bond.min_investment, bond.lot_size, bond.tax_category,
          bond.tds_applicable, bond.tds_rate, bond.fee_profile_id, bond.fee_override_id,
          bond.net_yield_to_maturity, bond.status, bond.published_at, bond.published_by,
          bond.unpublished_at, bond.unpublished_by, bond.unpublish_reason, bond.compliance_approved,
          bond.compliance_approved_by, bond.compliance_approved_at, bond.regulatory_tier,
          bond.kyc_tier_required, bond.last_sync_at, bond.sync_errors, bond.created_at,
          bond.updated_at, bond.created_by, bond.updated_by, bond.region, bond.country, bond.currency
        ]);
        inserted++;
        if (inserted % 100 === 0) {
          console.log(`Progress: ${inserted}/${newBonds.length}`);
        }
      } catch (err: any) {
        console.error(`Error inserting bond ${bond.id}:`, err.message);
      }
    }
    
    console.log(`\n✅ Inserted ${inserted} bonds to production`);
    
    // Verify final count
    const { rows: [finalCount] } = await prodPool.query('SELECT COUNT(*) as count FROM bond_catalog');
    console.log(`Production now has ${finalCount.count} bonds`);
    
  } finally {
    await devPool.end();
    await prodPool.end();
  }
}

copyBonds().catch(console.error);
