import { db } from '../server/db';
import { instrumentMaster } from '../shared/schema';

async function syncNseStocks() {
  console.log("Fetching NSE equity list from archives...");
  
  const response = await fetch("https://archives.nseindia.com/content/equities/EQUITY_L.csv");
  if (!response.ok) {
    throw new Error(`Failed to fetch: ${response.statusText}`);
  }
  
  const csvText = await response.text();
  const lines = csvText.split('\n').filter(line => line.trim());
  
  console.log(`Processing ${lines.length - 1} stocks from NSE equity list`);
  
  let synced = 0;
  let errors = 0;
  
  for (let i = 1; i < lines.length; i++) {
    try {
      const line = lines[i];
      const parts = line.split(',');
      if (parts.length < 7) continue;
      
      const symbol = parts[0]?.trim();
      const name = parts[1]?.trim();
      const series = parts[2]?.trim();
      const isin = parts[6]?.trim();
      
      if (!symbol || !isin || !isin.startsWith('INE') || isin.length !== 12) {
        continue;
      }
      
      await db.insert(instrumentMaster).values({
        isin: isin,
        symbol: symbol,
        name: name || symbol,
        shortName: (name || symbol).substring(0, 50),
        assetClass: "equity",
        subType: null,
        sector: null,
        category: null,
        issuer: name || symbol,
        lastPrice: null,
        priceSource: "nse",
        riskLevel: "high",
        currency: "INR",
        sourceTable: "nse_equity_csv",
        sourceId: isin,
        metadata: {
          symbol: symbol,
          exchange: "NSE",
          series: series,
        },
      }).onConflictDoUpdate({
        target: instrumentMaster.isin,
        set: {
          symbol: symbol,
          name: name || symbol,
          shortName: (name || symbol).substring(0, 50),
          issuer: name || symbol,
          sourceTable: "nse_equity_csv",
          sourceId: isin,
          metadata: {
            symbol: symbol,
            exchange: "NSE",
            series: series,
          },
          updatedAt: new Date(),
        }
      });
      
      synced++;
      if (synced % 200 === 0) {
        console.log(`Progress: ${synced} stocks synced`);
      }
    } catch (e: any) {
      console.error(`Error on line ${i}:`, e.message);
      errors++;
    }
  }

  console.log(`\nCompleted: ${synced} stocks synced, ${errors} errors`);
  process.exit(0);
}

syncNseStocks().catch(e => {
  console.error("Fatal error:", e);
  process.exit(1);
});
