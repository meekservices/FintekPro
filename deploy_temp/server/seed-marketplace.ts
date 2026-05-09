import { db } from "./db";
import { unlistedCompanies, preIpoCompanies } from "@shared/schema";
import { sql } from "drizzle-orm";

async function seedMarketplace() {
  console.log("🚀 Seeding Unlisted Marketplace...");

  const companies = [
    {
      name: "National Stock Exchange (NSE)",
      sector: "Financial Services",
      industry: "Stock Exchange",
      status: "active",
      listingStage: "mature",
      publishedBuyPrice: "3400.00",
      publishedSellPrice: "3550.00",
      description: "India's largest stock exchange, awaiting IPO approval.",
    },
    {
      name: "Swiggy",
      sector: "Technology",
      industry: "Food Delivery",
      status: "active",
      listingStage: "pre_ipo",
      publishedBuyPrice: "380.00",
      publishedSellPrice: "410.00",
      description: "Leading food delivery and quick commerce platform.",
    },
    {
      name: "HDB Financial Services",
      sector: "Financial Services",
      industry: "NBFC",
      status: "active",
      listingStage: "mature",
      publishedBuyPrice: "650.00",
      publishedSellPrice: "680.00",
      description: "A subsidiary of HDFC Bank, providing retail and commercial loans.",
    },
    {
      name: "Razorpay",
      sector: "Technology",
      industry: "Fintech",
      status: "active",
      listingStage: "growth",
      publishedBuyPrice: "12500.00",
      publishedSellPrice: "13200.00",
      description: "Leading payments and banking platform for businesses in India.",
    },
    {
      name: "Tata Play",
      sector: "Consumer Services",
      industry: "DTH",
      status: "active",
      listingStage: "pre_ipo",
      publishedBuyPrice: "65.00",
      publishedSellPrice: "72.00",
      description: "India's largest DTH service provider, a joint venture between Tata Sons and Disney.",
    }
  ];

  for (const company of companies) {
    try {
      await db.insert(unlistedCompanies).values({
        ...company,
        pricingStatus: "published",
        complianceStatus: "cleared",
        identityStatus: "active",
        identityConfidence: "1.00",
      } as any).onConflictDoNothing();
      console.log(`✅ Seeded: ${company.name}`);
    } catch (err) {
      console.error(`❌ Failed to seed ${company.name}:`, err);
    }
  }

  console.log("✅ Marketplace seeding complete.");
}

import { fileURLToPath } from "url";

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  seedMarketplace().catch(console.error);
}

export { seedMarketplace };
