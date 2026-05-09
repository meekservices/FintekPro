import { drizzle } from "drizzle-orm/neon-serverless";
import { neonConfig, Pool } from "@neondatabase/serverless";
import { sql } from "drizzle-orm";
import ws from "ws";

neonConfig.webSocketConstructor = ws;

async function migrateBondsToProduction(): Promise<void> {
  const devDbUrl = process.env.DATABASE_URL;
  const prodDbUrl = process.env.PRODUCTION_DATABASE_URL;

  if (!devDbUrl) {
    console.error("ERROR: DATABASE_URL not set");
    process.exit(1);
  }
  if (!prodDbUrl) {
    console.error("ERROR: PRODUCTION_DATABASE_URL not set");
    process.exit(1);
  }

  console.log("\n🔧 Connecting to databases...");

  const devPool = new Pool({ connectionString: devDbUrl });
  const devDb = drizzle(devPool);

  const prodPool = new Pool({ connectionString: prodDbUrl });
  const prodDb = drizzle(prodPool);

  try {
    const devCount = await devDb.execute(sql`SELECT COUNT(*) as cnt FROM bond_catalog`);
    const devTotal = parseInt(String((devCount.rows[0] as any)?.cnt || '0'));
    console.log(`📊 Development database: ${devTotal} bonds`);

    const prodCount = await prodDb.execute(sql`SELECT COUNT(*) as cnt FROM bond_catalog`);
    const prodTotal = parseInt(String((prodCount.rows[0] as any)?.cnt || '0'));
    console.log(`📊 Production database: ${prodTotal} bonds`);

    if (devTotal <= prodTotal) {
      console.log("✅ Production already has equal or more bonds. No migration needed.");
      return;
    }

    const prodIds = await prodDb.execute(sql`SELECT id FROM bond_catalog`);
    const existingIds = new Set((prodIds.rows as any[]).map(r => r.id));
    console.log(`🔍 Found ${existingIds.size} existing bond IDs in production`);

    const BATCH_SIZE = 100;
    const allBonds = await devDb.execute(sql`
      SELECT id, source, source_id, isin, bond_name, issuer_name, instrument_type,
             is_listed, exchange, face_value, coupon_rate, coupon_frequency,
             issue_date, maturity_date, clean_price, dirty_price, accrued_interest,
             yield_to_maturity, credit_rating, rating_agency, min_investment, lot_size,
             tax_category, tds_applicable, tds_rate, fee_profile_id, fee_override_id,
             net_yield_to_maturity, status, published_at, published_by,
             unpublished_at, unpublished_by, unpublish_reason,
             compliance_approved, compliance_approved_by, compliance_approved_at,
             regulatory_tier, kyc_tier_required, last_sync_at, sync_errors,
             created_at, updated_at, created_by, updated_by,
             region, country, currency
      FROM bond_catalog
      ORDER BY id
    `);

    const newBonds = (allBonds.rows as any[]).filter(b => !existingIds.has(b.id));
    console.log(`📋 ${newBonds.length} new bonds to migrate`);

    if (newBonds.length === 0) {
      console.log("✅ No new bonds to migrate.");
      return;
    }

    let inserted = 0;
    let errors = 0;

    for (let i = 0; i < newBonds.length; i += BATCH_SIZE) {
      const batch = newBonds.slice(i, i + BATCH_SIZE);
      const batchNum = Math.floor(i / BATCH_SIZE) + 1;
      const totalBatches = Math.ceil(newBonds.length / BATCH_SIZE);

      try {
        for (const bond of batch) {
          try {
            await prodDb.execute(sql`
              INSERT INTO bond_catalog (
                id, source, source_id, isin, bond_name, issuer_name, instrument_type,
                is_listed, exchange, face_value, coupon_rate, coupon_frequency,
                issue_date, maturity_date, clean_price, dirty_price, accrued_interest,
                yield_to_maturity, credit_rating, rating_agency, min_investment, lot_size,
                tax_category, tds_applicable, tds_rate, fee_profile_id, fee_override_id,
                net_yield_to_maturity, status,
                compliance_approved,
                regulatory_tier, kyc_tier_required, last_sync_at, sync_errors,
                created_at, updated_at,
                region, country, currency
              ) VALUES (
                ${bond.id}, ${bond.source}, ${bond.source_id}, ${bond.isin},
                ${bond.bond_name}, ${bond.issuer_name}, ${bond.instrument_type},
                ${bond.is_listed}, ${bond.exchange}, ${bond.face_value},
                ${bond.coupon_rate}, ${bond.coupon_frequency},
                ${bond.issue_date}, ${bond.maturity_date}, ${bond.clean_price},
                ${bond.dirty_price}, ${bond.accrued_interest},
                ${bond.yield_to_maturity}, ${bond.credit_rating}, ${bond.rating_agency},
                ${bond.min_investment}, ${bond.lot_size},
                ${bond.tax_category}, ${bond.tds_applicable}, ${bond.tds_rate},
                ${bond.fee_profile_id}, ${bond.fee_override_id},
                ${bond.net_yield_to_maturity}, ${bond.status},
                ${bond.compliance_approved},
                ${bond.regulatory_tier}, ${bond.kyc_tier_required},
                ${bond.last_sync_at}, ${bond.sync_errors},
                ${bond.created_at}, ${bond.updated_at},
                ${bond.region}, ${bond.country}, ${bond.currency}
              )
              ON CONFLICT (id) DO NOTHING
            `);
            inserted++;
          } catch (err: any) {
            errors++;
            if (errors <= 5) {
              console.error(`  ⚠️ Error inserting bond ${bond.id}: ${err.message}`);
            }
          }
        }

        console.log(`  ✅ Batch ${batchNum}/${totalBatches}: ${batch.length} processed (${inserted} inserted, ${errors} errors)`);
      } catch (batchErr: any) {
        console.error(`  ❌ Batch ${batchNum} failed: ${batchErr.message}`);
        errors += batch.length;
      }
    }

    const finalCount = await prodDb.execute(sql`SELECT COUNT(*) as cnt FROM bond_catalog`);
    const finalTotal = parseInt(String((finalCount.rows[0] as any)?.cnt || '0'));

    console.log(`\n✅ Migration complete!`);
    console.log(`   Inserted: ${inserted}`);
    console.log(`   Errors: ${errors}`);
    console.log(`   Production total: ${finalTotal} bonds`);

  } catch (error: any) {
    console.error("❌ Migration failed:", error.message);
    process.exit(1);
  } finally {
    await devPool.end();
    await prodPool.end();
  }
}

migrateBondsToProduction();
