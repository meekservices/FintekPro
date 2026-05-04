import { sql } from "drizzle-orm";
import { pgTable, text, varchar, decimal, timestamp, jsonb, boolean, integer, numeric, pgEnum } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { users } from "./users";
import { portfolios } from "./portfolio";

// Investment proposals table for AI and RM portfolio improvement suggestions
export const investmentProposals = pgTable("investment_proposals", {
  id: varchar("id").primaryKey(), // Custom ID with prefix: AI-xxx, AGENT-xxx, CLIENT-xxx
  // Core relationships
  clientId: varchar("client_id").references(() => users.id).notNull(),
  agentId: varchar("agent_id").references(() => users.id), // Nullable for AI and client proposals
  portfolioId: varchar("portfolio_id").references(() => portfolios.id),
  
  // Proposal source identification
  proposalSource: varchar("proposal_source").notNull().default("agent"), // 'ai', 'agent', 'client', or 'hybrid'
  aiSubType: varchar("ai_sub_type"), // 'rebalancing', 'retirement', 'goals' - for AI proposals
  aiModelVersion: varchar("ai_model_version"), // AI model version used for generation
  aiConfidenceScore: decimal("ai_confidence_score", { precision: 5, scale: 2 }), // AI confidence 0-100
  
  // Proposal details
  title: varchar("title").notNull(),
  description: text("description").notNull(),
  analysisRationale: text("analysis_rationale"), // Agent's detailed reasoning
  currentAllocation: jsonb("current_allocation"), // Current portfolio breakdown
  targetAllocation: jsonb("target_allocation"), // Proposed allocation
  
  // Investment recommendations
  recommendations: jsonb("recommendations").notNull(), // Array of investment products
  totalInvestmentAmount: decimal("total_investment_amount", { precision: 15, scale: 2 }).notNull(),
  riskProfile: varchar("risk_profile"), // conservative, moderate, aggressive
  timeHorizon: varchar("time_horizon"), // short_term, medium_term, long_term
  
  // Expected outcomes
  expectedReturns: decimal("expected_returns", { precision: 5, scale: 2 }), // Annual % return
  expectedRisk: varchar("expected_risk"), // low, medium, high
  projectedValue: decimal("projected_value", { precision: 15, scale: 2 }), // After time horizon
  
  // Status and approval workflow
  status: varchar("status").default("pending"), // pending, waiting_client_approval, approved, rejected, executed, cancelled, in_cart
  clientResponse: text("client_response"), // Client's approval/rejection reason
  approvedAt: timestamp("approved_at"),
  rejectedAt: timestamp("rejected_at"),
  executedAt: timestamp("executed_at"),
  addedToCartAt: timestamp("added_to_cart_at"), // When proposal was added to cart
  cartItemId: varchar("cart_item_id"), // Reference to cart item
  
  // Payment and execution tracking
  paymentMethod: varchar("payment_method"), // iris, cams, kfintech
  paymentStatus: varchar("payment_status"), // pending, processing, completed, failed
  paymentId: varchar("payment_id"), // External payment reference
  executionStatus: varchar("execution_status"), // pending, processing, completed, failed
  executionDetails: jsonb("execution_details"), // Transaction IDs, confirmation numbers
  
  // Metadata
  priority: varchar("priority").default("medium"), // low, medium, high
  validUntil: timestamp("valid_until"), // Proposal expiry date
  remindersSent: integer("reminders_sent").default(0),
  lastReminderAt: timestamp("last_reminder_at"),
  
  // Demo proposal tracking
  isDemo: boolean("is_demo").default(false), // Whether this is a demo proposal
  demoConvertedAt: timestamp("demo_converted_at"), // When demo was converted to real proposal
  demoConvertedBy: varchar("demo_converted_by"), // Who converted the demo
  demoViewCount: integer("demo_view_count").default(0), // Number of times demo was viewed
  demoLastViewedAt: timestamp("demo_last_viewed_at"), // Last time demo was viewed
  
  // Timestamps
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Investment proposal items for detailed product recommendations
export const investmentProposalItems = pgTable("investment_proposal_items", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  proposalId: varchar("proposal_id").references(() => investmentProposals.id).notNull(),
  
  // Product details
  productType: varchar("product_type").notNull(), // mutual_fund, etf, bond, equity, ulip
  productCode: varchar("product_code").notNull(), // Scheme code, ISIN, etc.
  productName: varchar("product_name").notNull(),
  amc: varchar("amc"), // Asset Management Company
  category: varchar("category"), // Large Cap, Mid Cap, Debt, etc.
  subCategory: varchar("sub_category"),
  
  // Investment details
  recommendedAmount: decimal("recommended_amount", { precision: 15, scale: 2 }).notNull(),
  allocationPercentage: decimal("allocation_percentage", { precision: 5, scale: 2 }).notNull(),
  investmentType: varchar("investment_type"), // lumpsum, sip
  sipAmount: decimal("sip_amount", { precision: 10, scale: 2 }),
  sipFrequency: varchar("sip_frequency"), // monthly, quarterly
  sipDuration: integer("sip_duration_months"),
  
  // Performance and rationale
  nav: decimal("nav", { precision: 10, scale: 4 }), // Current NAV
  oneYearReturns: decimal("one_year_returns", { precision: 5, scale: 2 }),
  threeYearReturns: decimal("three_year_returns", { precision: 5, scale: 2 }),
  fiveYearReturns: decimal("five_year_returns", { precision: 5, scale: 2 }),
  expenseRatio: decimal("expense_ratio", { precision: 5, scale: 2 }),
  exitLoad: decimal("exit_load", { precision: 5, scale: 2 }),
  
  // Risk metrics
  riskRating: varchar("risk_rating"), // Very Low, Low, Moderate, High, Very High
  volatility: decimal("volatility", { precision: 5, scale: 2 }),
  beta: decimal("beta", { precision: 5, scale: 4 }),
  sharpeRatio: decimal("sharpe_ratio", { precision: 5, scale: 4 }),
  
  // Agent's reasoning
  selectionReason: text("selection_reason").notNull(),
  expectedOutcome: text("expected_outcome"),
  suitabilityScore: integer("suitability_score"), // 1-10 scale
  
  // Execution tracking
  isExecuted: boolean("is_executed").default(false),
  executedAmount: decimal("executed_amount", { precision: 15, scale: 2 }),
  executedAt: timestamp("executed_at"),
  transactionId: varchar("transaction_id"),
  folioNumber: varchar("folio_number"),
  
  // Cart integration
  isAddedToCart: boolean("is_added_to_cart").default(false),
  cartItemId: varchar("cart_item_id"), // Reference to cart item when added
  
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Types and Schemas
export const insertInvestmentProposalSchema = createInsertSchema(investmentProposals).extend({
  createdAt: z.any(),
  updatedAt: z.any(),
}).omit({
  createdAt: true,
  updatedAt: true,
});

export const insertInvestmentProposalItemSchema = createInsertSchema(investmentProposalItems).extend({
  id: z.any(),
  createdAt: z.any(),
  updatedAt: z.any(),
}).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InvestmentProposal = typeof investmentProposals.$inferSelect;
export type InsertInvestmentProposal = z.infer<typeof insertInvestmentProposalSchema>;
export type InvestmentProposalItem = typeof investmentProposalItems.$inferSelect;
export type InsertInvestmentProposalItem = z.infer<typeof insertInvestmentProposalItemSchema>;

// --- Instrument Master (Centralized for ISIN Intelligence) ---

export const InstrumentAssetClassEnum = pgEnum('instrument_asset_class', [
  'equity',
  'mutual_fund',
  'bond',
  'etf',
  'mld',
  'unlisted',
  'aif',
  'pms',
  'fd',
  'gold',
  'real_estate',
  'other'
]);
export type InstrumentAssetClass = (typeof InstrumentAssetClassEnum.enumValues)[number];

export const instrumentMaster = pgTable("instrument_master", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  isin: varchar("isin").notNull().unique(),
  symbol: varchar("symbol"),
  isinPrefix: varchar("isin_prefix", { length: 3 }),
  instrumentFamily: varchar("instrument_family"),
  issuerType: varchar("issuer_type"),
  primaryRegulator: varchar("primary_regulator"),
  secondaryRegulator: varchar("secondary_regulator"),
  complianceRegime: varchar("compliance_regime"),
  name: varchar("name").notNull(),
  shortName: varchar("short_name"),
  assetClass: varchar("asset_class").notNull(),
  subType: varchar("sub_type"),
  category: varchar("category"),
  issuer: varchar("issuer"),
  sector: varchar("sector"),
  region: varchar("region"),
  country: varchar("country", { length: 2 }),
  exchange: varchar("exchange"),
  marketType: varchar("market_type"),
  lastPrice: decimal("last_price", { precision: 15, scale: 4 }),
  currency: varchar("currency").default("INR"),
  priceSource: varchar("price_source"),
  priceUpdatedAt: timestamp("price_updated_at"),
  coupon: decimal("coupon", { precision: 8, scale: 4 }),
  faceValue: decimal("face_value", { precision: 15, scale: 4 }),
  maturityDate: timestamp("maturity_date"),
  creditRating: varchar("credit_rating"),
  riskLevel: varchar("risk_level"),
  isPerpetual: boolean("is_perpetual").default(false),
  isStructured: boolean("is_structured").default(false),
  isGoldLinked: boolean("is_gold_linked").default(false),
  isConvertible: boolean("is_convertible").default(false),
  isSecured: boolean("is_secured").default(false),
  hasEquityFlag: boolean("has_equity_flag").default(false),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertInstrumentMasterSchema = createInsertSchema(instrumentMaster).extend({
  id: z.any(),
  createdAt: z.any(),
  updatedAt: z.any(),
}).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InstrumentMaster = typeof instrumentMaster.$inferSelect;
export type InsertInstrumentMaster = z.infer<typeof insertInstrumentMasterSchema>;
