import { sql } from "drizzle-orm";
import { pgTable, text, varchar, timestamp, boolean, index, integer, decimal, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { users } from "./users";

// ========================================
// REIT (Real Estate Investment Trust) Tables
// ========================================

export const reits = pgTable("reits", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  symbol: varchar("symbol").notNull().unique(),
  name: text("name").notNull(),
  
  // Fund Details
  sponsor: text("sponsor"),
  manager: text("manager"),
  trustee: text("trustee"),
  listingDate: timestamp("listing_date"),
  exchange: varchar("exchange").default("NSE"),
  isinCode: varchar("isin_code"),
  
  // Sector & Property Details
  sector: varchar("sector").notNull(), // office, retail, industrial, hospitality, mixed
  propertyType: varchar("property_type"), // commercial, residential, mixed
  geography: text("geography"), // Cities/Regions where properties are located
  totalProperties: integer("total_properties"),
  totalLeasableArea: decimal("total_leasable_area", { precision: 15, scale: 2 }), // in sq ft
  occupancyRate: decimal("occupancy_rate", { precision: 5, scale: 2 }),
  
  // Pricing & NAV
  currentPrice: decimal("current_price", { precision: 15, scale: 4 }),
  nav: decimal("nav", { precision: 15, scale: 4 }),
  premiumToNav: decimal("premium_to_nav", { precision: 8, scale: 4 }), // % premium/discount
  weekHigh52: decimal("week_high_52", { precision: 15, scale: 4 }),
  weekLow52: decimal("week_low_52", { precision: 15, scale: 4 }),
  marketCap: decimal("market_cap", { precision: 20, scale: 2 }),
  
  // Yield & Returns
  distributionYield: decimal("distribution_yield", { precision: 8, scale: 4 }),
  dividendFrequency: varchar("dividend_frequency").default("quarterly"), // monthly, quarterly, semi-annual
  lastDividend: decimal("last_dividend", { precision: 10, scale: 4 }),
  lastDividendDate: timestamp("last_dividend_date"),
  returns1M: decimal("returns_1m", { precision: 8, scale: 4 }),
  returns3M: decimal("returns_3m", { precision: 8, scale: 4 }),
  returns6M: decimal("returns_6m", { precision: 8, scale: 4 }),
  returns1Y: decimal("returns_1y", { precision: 8, scale: 4 }),
  returns3Y: decimal("returns_3y", { precision: 8, scale: 4 }),
  returnsSinceInception: decimal("returns_since_inception", { precision: 8, scale: 4 }),
  
  // Financial Metrics
  debtToEquity: decimal("debt_to_equity", { precision: 10, scale: 4 }),
  interestCoverageRatio: decimal("interest_coverage_ratio", { precision: 10, scale: 4 }),
  fundsFromOperations: decimal("funds_from_operations", { precision: 15, scale: 2 }), // FFO
  netOperatingIncome: decimal("net_operating_income", { precision: 15, scale: 2 }), // NOI
  
  // Investment Details
  minimumInvestment: decimal("minimum_investment", { precision: 15, scale: 2 }),
  lotSize: integer("lot_size").default(1),
  faceValue: decimal("face_value", { precision: 10, scale: 2 }),
  
  // Risk & Ratings
  riskLevel: varchar("risk_level").default("moderate"), // low, moderate, high
  creditRating: varchar("credit_rating"),
  ratingAgency: varchar("rating_agency"),
  
  // AI Recommendation
  aiSignal: varchar("ai_signal").default("hold"), // buy, hold, sell
  aiConfidence: decimal("ai_confidence", { precision: 5, scale: 2 }),
  aiRationale: text("ai_rationale"),
  aiTargetPrice: decimal("ai_target_price", { precision: 15, scale: 4 }),

  // === SEBI Classification (per SEBI circular Nov 28, 2025 — effective Jan 1, 2026) ===
  // REITs are reclassified as equity-related instruments. AMFI must include them in
  // scrip classification by market cap (Large/Mid/Small Cap) alongside equity stocks.
  sebiAssetClass: varchar("sebi_asset_class", { length: 20 }).default("equity"),
  // 'equity' — per SEBI/HO/IMD/IMD-I/DOF5/P/CIR/2025/177

  amfiCapCategory: varchar("amfi_cap_category", { length: 20 }),
  // AMFI market-cap band: 'Large Cap' | 'Mid Cap' | 'Small Cap'
  // Threshold: Large Cap >= ₹20,000 Cr; Mid Cap ₹5,000-19,999 Cr; Small Cap < ₹5,000 Cr

  equityIndexEligible: boolean("equity_index_eligible").default(true),
  // REITs eligible for equity index inclusion from July 1, 2026 (SEBI circular)

  sebiCircularRef: varchar("sebi_circular_ref", { length: 100 }).default("SEBI/HO/IMD/IMD-I/DOF5/P/CIR/2025/177"),
  // Circular reference — retained for compliance audit trail

  sebiEffectiveDate: timestamp("sebi_effective_date"),
  // Date from which SEBI classification is effective (2026-01-01)
  
  // Status
  isActive: boolean("is_active").default(true),
  lastUpdated: timestamp("last_updated").defaultNow(),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("idx_reits_symbol").on(table.symbol),
  index("idx_reits_sector").on(table.sector),
  index("idx_reits_ai_signal").on(table.aiSignal),
  index("idx_reits_amfi_cap").on(table.amfiCapCategory),
  index("idx_reits_sebi_class").on(table.sebiAssetClass),
]);


// ========================================
// InvIT (Infrastructure Investment Trust) Tables
// ========================================

export const invits = pgTable("invits", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  symbol: varchar("symbol").notNull().unique(),
  name: text("name").notNull(),
  
  // Fund Details
  sponsor: text("sponsor"),
  manager: text("manager"),
  trustee: text("trustee"),
  listingDate: timestamp("listing_date"),
  exchange: varchar("exchange").default("NSE"),
  isinCode: varchar("isin_code"),
  
  // Sector & Infrastructure Details
  sector: varchar("sector").notNull(), // power, roads, telecom, gas_pipelines, ports, airports, mixed
  infrastructureType: varchar("infrastructure_type"), // transmission, generation, toll_roads, fiber
  geography: text("geography"),
  totalAssets: integer("total_assets"),
  assetDetails: text("asset_details"),
  concessionLife: decimal("concession_life", { precision: 5, scale: 1 }), // Average remaining life in years
  
  // Pricing & NAV
  currentPrice: decimal("current_price", { precision: 15, scale: 4 }),
  nav: decimal("nav", { precision: 15, scale: 4 }),
  premiumToNav: decimal("premium_to_nav", { precision: 8, scale: 4 }),
  weekHigh52: decimal("week_high_52", { precision: 15, scale: 4 }),
  weekLow52: decimal("week_low_52", { precision: 15, scale: 4 }),
  marketCap: decimal("market_cap", { precision: 20, scale: 2 }),
  
  // Yield & Returns
  distributionYield: decimal("distribution_yield", { precision: 8, scale: 4 }),
  dividendFrequency: varchar("dividend_frequency").default("quarterly"),
  lastDividend: decimal("last_dividend", { precision: 10, scale: 4 }),
  lastDividendDate: timestamp("last_dividend_date"),
  returns1M: decimal("returns_1m", { precision: 8, scale: 4 }),
  returns3M: decimal("returns_3m", { precision: 8, scale: 4 }),
  returns6M: decimal("returns_6m", { precision: 8, scale: 4 }),
  returns1Y: decimal("returns_1y", { precision: 8, scale: 4 }),
  returns3Y: decimal("returns_3y", { precision: 8, scale: 4 }),
  returnsSinceInception: decimal("returns_since_inception", { precision: 8, scale: 4 }),
  
  // Financial Metrics
  debtToEquity: decimal("debt_to_equity", { precision: 10, scale: 4 }),
  interestCoverageRatio: decimal("interest_coverage_ratio", { precision: 10, scale: 4 }),
  ebitda: decimal("ebitda", { precision: 15, scale: 2 }),
  cashFlowFromOperations: decimal("cash_flow_from_operations", { precision: 15, scale: 2 }),
  
  // Investment Details
  minimumInvestment: decimal("minimum_investment", { precision: 15, scale: 2 }),
  lotSize: integer("lot_size").default(1),
  faceValue: decimal("face_value", { precision: 10, scale: 2 }),
  
  // Risk & Ratings
  riskLevel: varchar("risk_level").default("moderate"),
  creditRating: varchar("credit_rating"),
  ratingAgency: varchar("rating_agency"),
  
  // AI Recommendation
  aiSignal: varchar("ai_signal").default("hold"),
  aiConfidence: decimal("ai_confidence", { precision: 5, scale: 2 }),
  aiRationale: text("ai_rationale"),
  aiTargetPrice: decimal("ai_target_price", { precision: 15, scale: 4 }),

  // === SEBI Classification (per SEBI circular Nov 28, 2025 — effective Jan 1, 2026) ===
  // InvITs remain classified as HYBRID instruments. They are NOT reclassified as equity.
  // Only REITs were upgraded to equity-related instruments in this circular.
  sebiAssetClass: varchar("sebi_asset_class", { length: 20 }).default("hybrid"),
  // 'hybrid' — per SEBI/HO/IMD/IMD-I/DOF5/P/CIR/2025/177

  sebiCircularRef: varchar("sebi_circular_ref", { length: 100 }).default("SEBI/HO/IMD/IMD-I/DOF5/P/CIR/2025/177"),
  sebiEffectiveDate: timestamp("sebi_effective_date"),
  
  // Status
  isActive: boolean("is_active").default(true),
  lastUpdated: timestamp("last_updated").defaultNow(),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("idx_invits_symbol").on(table.symbol),
  index("idx_invits_sector").on(table.sector),
  index("idx_invits_ai_signal").on(table.aiSignal),
  index("idx_invits_sebi_class").on(table.sebiAssetClass),
]);


// REIT/InvIT Holdings (Portfolio)
export const reitInvitHoldings = pgTable("reit_invit_holdings", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id),
  
  // Prospect support - for goals created by agents before user registration
  prospectId: varchar("prospect_id"),
  createdByAgentId: varchar("created_by_agent_id").references(() => users.id),
  
  // Asset Details
  assetType: varchar("asset_type").notNull(), // reit, invit
  assetId: varchar("asset_id").notNull(),
  symbol: varchar("symbol").notNull(),
  assetName: text("asset_name"),
  
  // Holding Details
  quantity: integer("quantity").notNull(),
  averageCost: decimal("average_cost", { precision: 15, scale: 4 }),
  totalInvested: decimal("total_invested", { precision: 15, scale: 2 }),
  currentValue: decimal("current_value", { precision: 15, scale: 2 }),
  unrealizedGain: decimal("unrealized_gain", { precision: 15, scale: 2 }),
  unrealizedGainPercent: decimal("unrealized_gain_percent", { precision: 8, scale: 4 }),
  
  // Income Tracking
  totalDividendsReceived: decimal("total_dividends_received", { precision: 15, scale: 2 }).default("0"),
  lastDividendDate: timestamp("last_dividend_date"),
  
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("idx_reit_invit_holdings_user").on(table.userId),
  index("idx_reit_invit_holdings_asset").on(table.assetType, table.assetId),
]);

// Insert Schemas and Types
export const insertReitSchema = createInsertSchema(reits).extend({
  id: z.any(),
  createdAt: z.any(),
  lastUpdated: z.any(),
}).omit({
  id: true,
  createdAt: true,
  lastUpdated: true,
});
export type Reit = typeof reits.$inferSelect;
export type InsertReit = z.infer<typeof insertReitSchema>;

export const insertInvitSchema = createInsertSchema(invits).extend({
  id: z.any(),
  createdAt: z.any(),
  lastUpdated: z.any(),
}).omit({
  id: true,
  createdAt: true,
  lastUpdated: true,
});
export type Invit = typeof invits.$inferSelect;
export type InsertInvit = z.infer<typeof insertInvitSchema>;

export const insertReitInvitHoldingSchema = createInsertSchema(reitInvitHoldings).extend({
  id: z.any(),
  createdAt: z.any(),
  updatedAt: z.any(),
}).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type ReitInvitHolding = typeof reitInvitHoldings.$inferSelect;
export type InsertReitInvitHolding = z.infer<typeof insertReitInvitHoldingSchema>;

// Enums for type safety
export const ReitSectorEnum = z.enum(['office', 'retail', 'industrial', 'hospitality', 'mixed', 'healthcare', 'data_centers']);
export const InvitSectorEnum = z.enum(['power', 'roads', 'telecom', 'gas_pipelines', 'ports', 'airports', 'mixed', 'renewable_energy']);
