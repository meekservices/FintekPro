import { db } from "./db";
import { portfolios, comprehensiveHoldings } from "@shared/schema";
import { eq } from "drizzle-orm";

async function seedHoldings() {
	console.log("🚀 Seeding Sample Holdings for Portfolios...");

	const allPortfolios = await db.query.portfolios.findMany();

	if (allPortfolios.length === 0) {
		console.log("⚠️ No portfolios found to seed holdings for.");
		return;
	}

	const sampleAssets = [
		{
			symbol: "HDFCBANK",
			assetName: "HDFC Bank Ltd",
			assetType: "equity",
			assetClass: "large_cap",
			quantity: "50",
			avgPrice: "1450.00",
			currentPrice: "1520.00",
			dataSource: "manual",
		},
		{
			symbol: "RELIANCE",
			assetName: "Reliance Industries Ltd",
			assetType: "equity",
			assetClass: "large_cap",
			quantity: "20",
			avgPrice: "2300.00",
			currentPrice: "2950.00",
			dataSource: "manual",
		},
		{
			symbol: "INFY",
			assetName: "Infosys Ltd",
			assetType: "equity",
			assetClass: "large_cap",
			quantity: "100",
			avgPrice: "1600.00",
			currentPrice: "1420.00",
			dataSource: "manual",
		},
		{
			symbol: "HDFCGROWTH",
			assetName: "HDFC Top 100 Fund - Growth",
			assetType: "mutual_fund",
			assetClass: "large_cap",
			units: "1250.45",
			avgPrice: "85.20",
			currentPrice: "92.40",
			dataSource: "manual",
			folio: "123456789",
		},
	];

	for (const portfolio of allPortfolios) {
		console.log(`📦 Seeding holdings for portfolio: ${portfolio.name}`);

		for (const asset of sampleAssets) {
			try {
				const investedValue =
					Number.parseFloat(asset.quantity || asset.units || "0") *
					Number.parseFloat(asset.avgPrice);
				const marketValue =
					Number.parseFloat(asset.quantity || asset.units || "0") *
					Number.parseFloat(asset.currentPrice);
				const gainLoss = marketValue - investedValue;
				const gainLossPercent = (gainLoss / investedValue) * 100;

				await db.insert(comprehensiveHoldings).values({
					portfolioId: portfolio.id,
					userId: portfolio.userId,
					holdingDate: new Date().toISOString().split("T")[0],
					symbol: asset.symbol,
					assetName: asset.assetName,
					assetType: asset.assetType,
					assetClass: asset.assetClass,
					quantity: asset.quantity || null,
					units: asset.units || null,
					avgPrice: asset.avgPrice,
					currentPrice: asset.currentPrice,
					investedValue: investedValue.toString(),
					marketValue: marketValue.toString(),
					gainLoss: gainLoss.toString(),
					gainLossPercent: gainLossPercent.toString(),
					dataSource: asset.dataSource,
					folio: asset.folio || null,
				} as any);
			} catch (err) {
				// Ignore unique constraint errors if already seeded
			}
		}
	}

	console.log("✅ Holdings seeding complete.");
}

import { fileURLToPath } from "url";

if (process.argv[1] === fileURLToPath(import.meta.url)) {
	seedHoldings().catch(console.error);
}

export { seedHoldings };
