import { sql } from "drizzle-orm";
import { pgTable, text, varchar, decimal, timestamp, jsonb, boolean, index, uniqueIndex, integer, date, numeric } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { partners } from './partners';
import { users } from './users';
import { preIpoCompanies } from './unlisted';

export const storeCategories: any = pgTable("store_categories", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: varchar("name").notNull(),
  description: text("description"),
  slug: varchar("slug").notNull().unique(),
  icon: varchar("icon"), // lucide icon name for UI display
  parentCategoryId: varchar("parent_category_id"),
  displayOrder: integer("display_order").default(0),
  isActive: boolean("is_active").default(true),
  // Category availability controls
  isEnabled: boolean("is_enabled").default(true), // Master toggle for category visibility
  comingSoonMessage: text("coming_soon_message"), // Message shown when category is disabled
  comingSoonExpectedDate: date("coming_soon_expected_date"), // Expected availability date
  // Direct fund controls for this category
  directFundsEnabled: boolean("direct_funds_enabled").default(false), // Toggle for Direct plan visibility
  requiresAdvisorySubscription: boolean("requires_advisory_subscription").default(true), // Whether Direct funds need advisory subscription
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Advisory Subscription Plans - Track client subscriptions for Direct fund access
export const advisorySubscriptions = pgTable("advisory_subscriptions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  
  // Client information
  userId: varchar("user_id").references(() => users.id),
  
  // Prospect support - for goals created by agents before user registration
  prospectId: varchar("prospect_id"),
  createdByAgentId: varchar("created_by_agent_id").references(() => users.id),
  
  // Plan details
  planName: varchar("plan_name").notNull(), // 'basic', 'premium', 'elite', 'family'
  planType: varchar("plan_type").notNull(), // 'individual', 'family', 'corporate'
  
  // Subscription status
  status: varchar("status").notNull().default("active"), // 'active', 'expired', 'cancelled', 'pending', 'suspended'
  
  // Validity period
  startDate: date("start_date").notNull(),
  endDate: date("end_date").notNull(),
  
  // Fee structure
  subscriptionFee: decimal("subscription_fee", { precision: 15, scale: 2 }),
  feeFrequency: varchar("fee_frequency").default("annual"), // 'monthly', 'quarterly', 'annual'
  lastPaymentDate: date("last_payment_date"),
  nextPaymentDate: date("next_payment_date"),
  
  // Direct fund access
  directFundsAccess: boolean("direct_funds_access").default(true), // Whether this plan includes Direct fund access
  maxDirectFundInvestment: decimal("max_direct_fund_investment", { precision: 15, scale: 2 }), // Optional investment limit
  
  // Categories included (null means all enabled categories)
  includedCategories: text("included_categories").array(), // Array of category slugs
  
  // Enrolled by
  enrolledBy: varchar("enrolled_by").references(() => users.id), // Admin/Partner/Agent who enrolled the client
  enrolledByRole: varchar("enrolled_by_role"), // 'admin', 'partner', 'agent'
  
  // Additional metadata
  notes: text("notes"),
  metadata: jsonb("metadata"), // Additional plan-specific data
  
  // Timestamps
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
  cancelledAt: timestamp("cancelled_at"),
  cancellationReason: text("cancellation_reason"),
});

export const storeProducts = pgTable("store_products", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: varchar("name").notNull(),
  shortDescription: text("short_description"),
  fullDescription: text("full_description"),
  categoryId: varchar("category_id").references(() => storeCategories.id).notNull(),
  subcategoryId: varchar("subcategory_id"), // Link to subcategory for hierarchical structure
  productType: varchar("product_type").notNull(), // 'mutual_fund', 'etf', 'bond', 'insurance', 'loan', 'advisory'
  productKey: varchar("product_key"), // unique product identifier key
  // Mutual Fund Plan Type (SEBI-compliant: Direct vs Regular)
  planType: varchar("plan_type"), // 'direct' or 'regular' - for mutual funds only
  expenseRatio: decimal("expense_ratio", { precision: 5, scale: 4 }), // TER percentage (e.g., 0.0050 = 0.50%)
  trailCommission: decimal("trail_commission", { precision: 5, scale: 4 }), // Distributor trail commission % (Regular plans only)
  exitLoad: decimal("exit_load", { precision: 5, scale: 2 }), // Exit load percentage
  exitLoadPeriod: integer("exit_load_period"), // Exit load applicable period in days
  // Scheme identifiers for mutual funds
  amfiCode: varchar("amfi_code"), // AMFI scheme code
  isinCode: varchar("isin_code"), // ISIN for the scheme
  schemeCode: varchar("scheme_code"), // AMC-specific scheme code
  price: decimal("price", { precision: 15, scale: 2 }),
  currency: varchar("currency").default("INR"),
  minimumInvestment: decimal("minimum_investment", { precision: 15, scale: 2 }),
  lockInPeriod: integer("lock_in_period"), // in months
  riskLevel: varchar("risk_level"), // 'low', 'medium', 'high'
  expectedReturns: decimal("expected_returns", { precision: 5, scale: 2 }), // percentage
  features: jsonb("features"), // array of key features
  eligibility: jsonb("eligibility"), // eligibility criteria
  documents: jsonb("documents"), // required documents
  provider: varchar("provider"), // AMC/Bank/Insurance company name
  providerCode: varchar("provider_code"), // internal provider code
  regulatory: jsonb("regulatory"), // regulatory information like NAV, fund manager, etc.
  isActive: boolean("is_active").default(true),
  isFeatured: boolean("is_featured").default(false),
  displayOrder: integer("display_order").default(0),
  launchDate: date("launch_date"),
  // Visibility controls for different user roles
  visibleToClients: boolean("visible_to_clients").default(true),
  visibleToPartners: boolean("visible_to_partners").default(true),
  visibleToAgents: boolean("visible_to_agents").default(true),
  visibleToGuests: boolean("visible_to_guests").default(true),
  // Inquiry settings when product is disabled
  showInquiryForm: boolean("show_inquiry_form").default(true),
  inquiryMessage: text("inquiry_message"),
  // Link to source unlisted company (for unlisted stocks seeded from admin)
  sourceCompanyId: varchar("source_company_id").references(() => preIpoCompanies.id),
  // Unlisted stock specific fields
  lotSize: integer("lot_size"), // minimum shares per transaction
  faceValue: decimal("face_value", { precision: 10, scale: 2 }),
  marketCap: decimal("market_cap", { precision: 20, scale: 2 }),
  peRatio: decimal("pe_ratio", { precision: 10, scale: 2 }),
  // Admin-controlled buy/sell prices for unlisted stocks
  buyPrice: decimal("buy_price", { precision: 15, scale: 2 }), // Admin-set price for buying
  sellPrice: decimal("sell_price", { precision: 15, scale: 2 }), // Admin-set price for selling
  priceSource: varchar("price_source"), // 'moneycontrol', 'internal', 'marketplace', 'manual'
  priceUpdatedAt: timestamp("price_updated_at"), // When prices were last updated
  priceMetadata: jsonb("price_metadata"), // Additional price context for auditing
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const storeProductImages = pgTable("store_product_images", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  productId: varchar("product_id").references(() => storeProducts.id).notNull(),
  imageUrl: varchar("image_url").notNull(),
  altText: varchar("alt_text"),
  isPrimary: boolean("is_primary").default(false),
  displayOrder: integer("display_order").default(0),
  createdAt: timestamp("created_at").defaultNow(),
});

export const storeProductTags = pgTable("store_product_tags", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: varchar("name").notNull().unique(),
  slug: varchar("slug").notNull().unique(),
  color: varchar("color").default("#3B82F6"), // hex color for display
  createdAt: timestamp("created_at").defaultNow(),
});

export const storeProductTagMappings = pgTable("store_product_tag_mappings", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  productId: varchar("product_id").references(() => storeProducts.id).notNull(),
  tagId: varchar("tag_id").references(() => storeProductTags.id).notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const userWishlist = pgTable("user_wishlist", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id),
  
  // Prospect support - for goals created by agents before user registration
  prospectId: varchar("prospect_id"),
  createdByAgentId: varchar("created_by_agent_id").references(() => users.id),
  productId: varchar("product_id").references(() => storeProducts.id).notNull(),
  addedAt: timestamp("added_at").defaultNow(),
});

export const insertStoreCategorySchema = createInsertSchema(storeCategories).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertAdvisorySubscriptionSchema = createInsertSchema(advisorySubscriptions).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertStoreProductSchema = createInsertSchema(storeProducts).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertStoreProductImageSchema = createInsertSchema(storeProductImages).omit({
  id: true,
  createdAt: true,
});

export const insertStoreProductTagSchema = createInsertSchema(storeProductTags).omit({
  id: true,
  createdAt: true,
});

export const insertStoreProductTagMappingSchema = createInsertSchema(storeProductTagMappings).omit({
  id: true,
  createdAt: true,
});

export const insertUserWishlistSchema = createInsertSchema(userWishlist).omit({
  id: true,
  addedAt: true,
});

// Export types for Product Store
export type StoreCategory = typeof storeCategories.$inferSelect;
export type InsertStoreCategory = z.infer<typeof insertStoreCategorySchema>;
export type AdvisorySubscription = typeof advisorySubscriptions.$inferSelect;
export type InsertAdvisorySubscription = z.infer<typeof insertAdvisorySubscriptionSchema>;
export type StoreProduct = typeof storeProducts.$inferSelect;
export type InsertStoreProduct = z.infer<typeof insertStoreProductSchema>;
export type StoreProductImage = typeof storeProductImages.$inferSelect;
export type StoreProductTag = typeof storeProductTags.$inferSelect;
export type UserWishlist = typeof userWishlist.$inferSelect;

export const fundManagers = pgTable("fund_managers", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  
  // Basic Info
  name: text("name").notNull(),
  designation: text("designation"),
  fundHouse: text("fund_house"),
  
  // Experience
  experienceYears: integer("experience_years"),
  qualifications: text("qualifications"),
  certifications: text("certifications").array(),
  
  // Performance Metrics
  totalAumManaged: decimal("total_aum_managed", { precision: 20, scale: 2 }),
  fundsManaged: integer("funds_managed"),
  avgAlpha: decimal("avg_alpha", { precision: 8, scale: 4 }),
  consistencyScore: decimal("consistency_score", { precision: 5, scale: 2 }), // 0-10 score
  
  // Bio
  bio: text("bio"),
  photoUrl: text("photo_url"),
  linkedinUrl: text("linkedin_url"),
  
  // Metadata
  metadata: jsonb("metadata"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => [
  index("idx_fund_managers_name").on(table.name),
  index("idx_fund_managers_fund_house").on(table.fundHouse),
]);

export const insertFundManagerSchema = createInsertSchema(fundManagers).extend({
  id: z.any(),
  createdAt: z.any(),
  updatedAt: z.any(),
}).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type FundManager = typeof fundManagers.$inferSelect;
export type InsertFundManager = z.infer<typeof insertFundManagerSchema>;

// Products table for partner-managed financial products
export const products = pgTable("products", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  partnerId: varchar("partner_id").references(() => partners.id).notNull(),
  // Product details
  name: varchar("name").notNull(),
  description: text("description"),
  category: varchar("category").notNull(), // 'mutual_fund', 'insurance', 'loan', 'credit_card', 'deposit', 'bond', 'ncd', 'mld', 'ipo', 'pre_ipo', 'unlisted', 'global_stock', 'global_fund'
  subCategory: varchar("sub_category"), // Specific type within category
  provider: varchar("provider"), // Provider/AMC/Bank name
  // Pricing and features
  basePrice: decimal("base_price", { precision: 15, scale: 2 }),
  interestRate: decimal("interest_rate", { precision: 8, scale: 4 }),
  minimumInvestment: decimal("minimum_investment", { precision: 15, scale: 2 }),
  features: jsonb("features").default({}), // Product features and benefits
  eligibilityCriteria: jsonb("eligibility_criteria").default({}),
  documents: jsonb("documents").default([]), // Required documents
  // Performance tracking - Short term
  returns1m: decimal("returns_1m", { precision: 8, scale: 4 }),
  returns3m: decimal("returns_3m", { precision: 8, scale: 4 }),
  returns6m: decimal("returns_6m", { precision: 8, scale: 4 }),
  // Performance tracking - Long term
  returns1y: decimal("returns_1y", { precision: 8, scale: 4 }),
  returns3y: decimal("returns_3y", { precision: 8, scale: 4 }),
  returns5y: decimal("returns_5y", { precision: 8, scale: 4 }),
  returnsSinceInception: decimal("returns_since_inception", { precision: 8, scale: 4 }),
  // Risk and ratings
  riskLevel: varchar("risk_level"), // 'low', 'medium', 'high', 'very_high'
  creditRating: varchar("credit_rating"), // For bonds/NCDs: AAA, AA+, etc.
  performanceTag: varchar("performance_tag"), // Auto-calculated: 'top_performer', 'rising_star', 'stable', 'high_growth'
  // Fund fact sheet details - Exit loads and fees
  exitLoad: jsonb("exit_load"), // [{ period: "0-1 year", load: "1%" }]
  entryLoad: decimal("entry_load", { precision: 5, scale: 2 }),
  expenseRatio: decimal("expense_ratio", { precision: 5, scale: 2 }),
  totalExpenseRatio: decimal("total_expense_ratio", { precision: 5, scale: 2 }), // TER
  // Investment style and factors
  investmentStyle: varchar("investment_style"), // 'value', 'growth', 'blend', 'income'
  marketCapFocus: varchar("market_cap_focus"), // 'large', 'mid', 'small', 'multi'
  strategyFactors: text("strategy_factors").array(), // ['momentum', 'quality', 'low_volatility']
  sectorFocus: varchar("sector_focus"), // 'technology', 'healthcare', 'banking', 'diversified'
  investmentTheme: varchar("investment_theme"), // 'esg', 'infrastructure', 'consumption', 'export'
  // Fund fact sheet and holdings
  fundFactSheetUrl: varchar("fund_fact_sheet_url"),
  factSheetLastUpdated: timestamp("fact_sheet_last_updated"),
  portfolioHoldings: jsonb("portfolio_holdings"), // Top holdings: [{ name, weight, sector }]
  sectorAllocation: jsonb("sector_allocation"), // {technology: 25, healthcare: 15, ...}
  assetAllocationEquity: decimal("asset_allocation_equity", { precision: 5, scale: 2 }),
  assetAllocationDebt: decimal("asset_allocation_debt", { precision: 5, scale: 2 }),
  assetAllocationCash: decimal("asset_allocation_cash", { precision: 5, scale: 2 }),
  // Fund manager details
  fundManagerName: varchar("fund_manager_name"),
  fundManagerTenure: integer("fund_manager_tenure"), // months
  // Performance metrics
  benchmarkIndex: varchar("benchmark_index"), // 'NIFTY 50', 'SENSEX', 'NIFTY Midcap 100'
  sharpeRatio: decimal("sharpe_ratio", { precision: 8, scale: 4 }),
  alphaRatio: decimal("alpha_ratio", { precision: 8, scale: 4 }),
  betaRatio: decimal("beta_ratio", { precision: 8, scale: 4 }),
  standardDeviation: decimal("standard_deviation", { precision: 8, scale: 4 }),
  // Product characteristics
  isFeatured: boolean("is_featured").default(false),
  isNew: boolean("is_new").default(false),
  badge: varchar("badge"), // 'HOT', 'NEW', 'PREMIUM', 'TRENDING'
  // Product status and visibility
  status: varchar("status").default("draft"), // 'draft', 'active', 'suspended', 'discontinued'
  isPublic: boolean("is_public").default(false), // Visible to end users
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const productAccountPreferences = pgTable("product_account_preferences", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id).notNull(),
  // Product type this preference applies to
  productCategory: varchar("product_category").notNull(), // 'mutual_fund', 'stock', 'bond', 'insurance', etc.
  productSubCategory: varchar("product_sub_category"),
  // Preferred Bank Account for funding/withdrawals
  preferredBankAccountId: varchar("preferred_bank_account_id"), 
  // Preferred Demat Account for holding units
  preferredDematAccountId: varchar("preferred_demat_account_id"),
  // Default distribution mode
  distributionMode: varchar("distribution_mode").default("physical"), // 'demat', 'physical'
  // Communication preferences
  enableNotifications: boolean("enable_notifications").default(true),
  preferredContactMethod: varchar("preferred_contact_method").default("email"), // 'email', 'whatsapp', 'sms'
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const productApplications = pgTable("product_applications", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id).notNull(),
  productId: varchar("product_id").references(() => products.id).notNull(),
  // Application details
  applicationNumber: varchar("application_number").unique().notNull(),
  status: varchar("status").default("pending"), // 'pending', 'submitted', 'processing', 'approved', 'rejected', 'action_required'
  submissionDate: timestamp("submission_date"),
  // AI Suitability Check Reference
  suitabilityScore: integer("suitability_score"),
  aiRecommendation: text("ai_recommendation"),
  // Compliance verification details
  kycVerified: boolean("kyc_verified").default(false),
  esignStatus: varchar("esign_status").default("not_started"), // 'not_started', 'pending', 'completed', 'failed'
  esignRequestIds: text("esign_request_ids").array(),
  // Payment information
  paymentStatus: varchar("payment_status").default("pending"), // 'pending', 'completed', 'failed', 'refunded'
  paymentAmount: decimal("payment_amount", { precision: 15, scale: 2 }),
  paymentReference: varchar("payment_reference"),
  // Metadata for varied product needs
  applicationData: jsonb("application_data").default({}),
  requiredDocuments: jsonb("required_documents").default([]),
  uploadedDocuments: jsonb("uploaded_documents").default([]),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("idx_product_apps_user").on(table.userId),
  index("idx_product_apps_product").on(table.productId),
  index("idx_product_apps_status").on(table.status),
]);

export const pmsMaster = pgTable("pms_master", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  
  // Basic Information
  name: text("name").notNull(),
  registrationNo: text("registration_no").unique(),
  strategy: text("strategy"), // Multi-cap, Mid-cap, Small-cap, Large-cap, Arbitrage, etc.
  
  // Manager and AMC
  managerId: varchar("manager_id"), // Placeholder for references(() => fundManagers.id)
  amcName: text("amc_name"),
  
  // Style and Characteristics
  style: text("style"), // Growth, Value, Blend, Thematic
  marketCapBias: text("market_cap_bias"), // Large, Mid, Small, Multi
  minInvestment: decimal("min_investment", { precision: 15, scale: 2 }).default("5000000"), // ₹50L standard
  benchmark: text("benchmark"),
  
  // Status & Publishing
  status: text("status").default("active"), // active, soft_close, hard_close, existing_only, suspended
  isPublished: boolean("is_published").default(false),
  
  // Valuation Information
  navFrequency: text("nav_frequency").default("MONTHLY"), // DAILY, WEEKLY, MONTHLY
  latestNav: decimal("latest_nav", { precision: 15, scale: 4 }),
  lastNavDate: date("last_nav_date"),
  aum: decimal("aum", { precision: 20, scale: 2 }), // Assets Under Management in Cr
  
  // Performance Metrics
  return1M: decimal("return_1m", { precision: 8, scale: 4 }),
  return3M: decimal("return_3m", { precision: 8, scale: 4 }),
  return6M: decimal("return_6m", { precision: 8, scale: 4 }),
  return1Y: decimal("return_1y", { precision: 8, scale: 4 }),
  return3Y: decimal("return_3y", { precision: 8, scale: 4 }),
  return5Y: decimal("return_5y", { precision: 8, scale: 4 }),
  returnSinceInception: decimal("return_since_inception", { precision: 8, scale: 4 }),
  
  // Risk Metrics
  volatility: decimal("volatility", { precision: 8, scale: 4 }),
  maxDrawdown: decimal("max_drawdown", { precision: 8, scale: 4 }),
  sharpeRatio: decimal("sharpe_ratio", { precision: 8, scale: 4 }),
  sortinoRatio: decimal("sortino_ratio", { precision: 8, scale: 4 }),
  riskScore: integer("risk_score"), // 1-10 scale
  
  // AI Score for Suitability
  suitabilityScore: integer("suitability_score"), // 1-10
  aiRecommendation: text("ai_recommendation"),
  
  // Identifiers
  isin: text("isin"),
  sebiId: text("sebi_id"),
  apmiId: text("apmi_id"), // Association of Portfolio Managers in India ID
  
  // Metadata
  inceptionDate: date("inception_date"),
  description: text("description"),
  investmentObjective: text("investment_objective"),
  metadata: jsonb("metadata"),
  
  // Timestamps
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => [
  index("idx_pms_master_registration").on(table.registrationNo),
  index("idx_pms_master_strategy").on(table.strategy),
  index("idx_pms_master_published").on(table.isPublished),
  index("idx_pms_master_status").on(table.status),
]);

export const mldMaster = pgTable("mld_master", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  
  // Basic Information
  isin: text("isin").unique().notNull(),
  name: text("name").notNull(),
  issuer: text("issuer").notNull(),
  
  // Underlying & Structure
  underlying: text("underlying").notNull(), // NIFTY 50, SENSEX, etc.
  payoffType: text("payoff_type").notNull(), // digital, barrier, sharkfin, range, participation, autocall, snowball
  barrierLevel: decimal("barrier_level", { precision: 8, scale: 4 }), // e.g., 0.9 = 90%
  participationRate: decimal("participation_rate", { precision: 8, scale: 4 }), // e.g., 1.5 = 150%
  cap: decimal("cap", { precision: 8, scale: 4 }), // Maximum payoff cap
  floor: decimal("floor", { precision: 8, scale: 4 }), // Principal protection floor
  
  // Dates
  issueDate: date("issue_date"),
  maturityDate: date("maturity_date").notNull(),
  observationSchedule: jsonb("observation_schedule").default([]), // Array of observation dates for autocall
  
  // Investment Details
  faceValue: decimal("face_value", { precision: 15, scale: 2 }).default("1000000"),
  minInvestment: decimal("min_investment", { precision: 15, scale: 2 }).default("1000000"),
  
  // Rating & Risk
  rating: text("rating"), // AAA, AA+, AA, etc.
  riskScore: integer("risk_score"), // 1-10 scale
  creditRisk: text("credit_risk"), // Low, Medium, High
  structuralRisk: text("structural_risk"),
  liquidityRisk: text("liquidity_risk"),
  
  // Status & Publishing
  status: text("status").default("active"), // active, closed, matured, called_back
  isListed: boolean("is_listed").default(false),
  isPublished: boolean("is_published").default(false),
  liquidityProfile: text("liquidity_profile"), // High, Medium, Low
  
  // Pricing
  latestPrice: decimal("latest_price", { precision: 15, scale: 4 }),
  lastPriceDate: date("last_price_date"),
  ytm: decimal("ytm", { precision: 8, scale: 4 }), // Yield to Maturity
  impliedYield: decimal("implied_yield", { precision: 8, scale: 4 }),
  irr: decimal("irr", { precision: 8, scale: 4 }),
  
  // Term Sheet
  termSheetPath: text("term_sheet_path"),
  termSheetParsed: jsonb("term_sheet_parsed").default({}), // Parsed structure from term sheet
  
  // AI Suitability
  suitabilityScore: integer("suitability_score"), // 1-10
  aiRecommendation: text("ai_recommendation"),
  warningIndicators: jsonb("warning_indicators").default([]),
  
  // Metadata
  description: text("description"),
  metadata: jsonb("metadata"),
  
  // Timestamps
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => [
  index("idx_mld_master_isin").on(table.isin),
  index("idx_mld_master_issuer").on(table.issuer),
  index("idx_mld_master_underlying").on(table.underlying),
  index("idx_mld_master_payoff_type").on(table.payoffType),
  index("idx_mld_master_published").on(table.isPublished),
  index("idx_mld_master_status").on(table.status),
  index("idx_mld_master_maturity").on(table.maturityDate),
]);

export const giftCityProducts = pgTable("gift_city_products", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: varchar("name", { length: 255 }).notNull(),
  description: text("description"),
  category: varchar("category", { length: 100 }).notNull(),
  subcategory: varchar("subcategory", { length: 100 }),
  flowDirection: varchar("flow_direction", { length: 20 }).default("inbound").notNull(), // inbound or outbound per IFSCA regulations
  regulatoryFramework: varchar("regulatory_framework", { length: 100 }), // IFSCA Fund Management, IFSCA Banking, FEMA LRS
  investorType: varchar("investor_type", { length: 100 }), // Resident Indian, NRI, Foreign Investor, FPI, Institutional
  lrsApplicable: boolean("lrs_applicable").default(false).notNull(), // LRS limits apply for outbound
  lrsCategory: varchar("lrs_category", { length: 100 }), // Capital Account, Current Account, Investment
  minimumInvestment: decimal("minimum_investment", { precision: 20, scale: 2 }),
  currency: varchar("currency", { length: 20 }).default("USD"),
  expectedReturns: varchar("expected_returns", { length: 50 }),
  riskLevel: varchar("risk_level", { length: 50 }),
  provider: varchar("provider", { length: 255 }),
  features: text("features").array(),
  regulatoryBenefits: text("regulatory_benefits").array(),
  eligibility: text("eligibility").array(),
  complianceRequirements: text("compliance_requirements").array(), // KYC, FATCA, CRS requirements
  taxImplications: text("tax_implications"), // Tax treatment notes
  isPublished: boolean("is_published").default(true).notNull(),
  isPremium: boolean("is_premium").default(false).notNull(),
  isLimited: boolean("is_limited").default(false).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => [
  index("idx_gift_city_products_category").on(table.category),
  index("idx_gift_city_products_published").on(table.isPublished),
  index("idx_gift_city_products_flow").on(table.flowDirection),
]);

export const fundPerformanceMonthwise = pgTable("fund_performance_monthwise", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  
  // Fund Reference (supports both AIF and PMS)
  fundType: text("fund_type").notNull(), // 'aif' or 'pms'
  fundId: varchar("fund_id").notNull(),
  
  // Period
  year: integer("year").notNull(),
  month: integer("month").notNull(), // 1-12
  
  // Performance Data
  nav: decimal("nav", { precision: 15, scale: 4 }),
  returnPercent: decimal("return_percent", { precision: 8, scale: 4 }),
  benchmarkReturn: decimal("benchmark_return", { precision: 8, scale: 4 }),
  alpha: decimal("alpha", { precision: 8, scale: 4 }),
  
  // Additional metrics
  aum: decimal("aum", { precision: 20, scale: 2 }),
  volatility: decimal("volatility", { precision: 8, scale: 4 }),
  
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  index("idx_fund_perf_monthly_fund").on(table.fundType, table.fundId),
  index("idx_fund_perf_monthly_period").on(table.year, table.month),
]);

// Schemas & Types
export const insertProductSchema = createInsertSchema(products).extend({
  id: z.any(),
  createdAt: z.any(),
  updatedAt: z.any(),
}).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type Product = typeof products.$inferSelect;
export type InsertProduct = z.infer<typeof insertProductSchema>;

export const insertProductAccountPreferenceSchema = createInsertSchema(productAccountPreferences).extend({
  id: z.any(),
  createdAt: z.any(),
  updatedAt: z.any(),
}).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type ProductAccountPreference = typeof productAccountPreferences.$inferSelect;
export type InsertProductAccountPreference = z.infer<typeof insertProductAccountPreferenceSchema>;

export const insertProductApplicationSchema = createInsertSchema(productApplications).extend({
  id: z.any(),
  createdAt: z.any(),
  updatedAt: z.any(),
}).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type ProductApplication = typeof productApplications.$inferSelect;
export type InsertProductApplication = z.infer<typeof insertProductApplicationSchema>;

export const insertPmsMasterSchema = createInsertSchema(pmsMaster).extend({
  id: z.any(),
  createdAt: z.any(),
  updatedAt: z.any(),
}).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type PmsMaster = typeof pmsMaster.$inferSelect;
export type InsertPmsMaster = z.infer<typeof insertPmsMasterSchema>;

export const insertMldMasterSchema = createInsertSchema(mldMaster).extend({
  id: z.any(),
  createdAt: z.any(),
  updatedAt: z.any(),
}).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type MldMaster = typeof mldMaster.$inferSelect;
export type InsertMldMaster = z.infer<typeof insertMldMasterSchema>;

export const insertGiftCityProductSchema = createInsertSchema(giftCityProducts).extend({
  id: z.any(),
  createdAt: z.any(),
  updatedAt: z.any(),
}).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type GiftCityProduct = typeof giftCityProducts.$inferSelect;
export type InsertGiftCityProduct = z.infer<typeof insertGiftCityProductSchema>;

export const insertFundPerformanceMonthwiseSchema = createInsertSchema(fundPerformanceMonthwise).extend({
  id: z.any(),
  createdAt: z.any(),
}).omit({
  id: true,
  createdAt: true,
});
export type FundPerformanceMonthwise = typeof fundPerformanceMonthwise.$inferSelect;
export type InsertFundPerformanceMonthwise = z.infer<typeof insertFundPerformanceMonthwiseSchema>;

// Marketing Campaigns Table
export const marketingCampaigns = pgTable("marketing_campaigns", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  
  // Campaign details
  name: varchar("name").notNull(),
  description: text("description"),
  campaignType: varchar("campaign_type").notNull(), // email/whatsapp/sms/multi_channel
  
  // Channel specific IDs
  zohoCampaignId: varchar("zoho_campaign_id"), // Zoho Campaigns API campaign ID
  aisensyBroadcastId: varchar("aisensy_broadcast_id"), // Legacy: was AiSensy, now using Twilio for WhatsApp
  
  // Status
  status: varchar("status").notNull().default("draft"), // draft/scheduled/sending/sent/failed/cancelled
  
  // Audience
  targetSegment: varchar("target_segment"), // new_users/kyc_pending/active_traders/inactive_users/custom
  customFilters: jsonb("custom_filters"), // Advanced filtering criteria
  recipientCount: integer("recipient_count").default(0),
  
  // Email specific
  emailSubject: varchar("email_subject"),
  emailFromName: varchar("email_from_name"),
  emailReplyTo: varchar("email_reply_to"),
  emailHtmlContent: text("email_html_content"),
  emailTextContent: text("email_text_content"),
  
  // WhatsApp specific
  whatsappTemplateId: varchar("whatsapp_template_id"), // Approved template ID
  whatsappTemplateName: varchar("whatsapp_template_name"),
  whatsappMessage: text("whatsapp_message"),
  whatsappMediaUrl: varchar("whatsapp_media_url"), // Image/video/document URL
  whatsappButtons: jsonb("whatsapp_buttons"), // Interactive buttons
  
  // Scheduling
  scheduledAt: timestamp("scheduled_at"),
  sendAt: timestamp("send_at"), // Actual send time
  
  // Performance metrics
  sentCount: integer("sent_count").default(0),
  deliveredCount: integer("delivered_count").default(0),
  openedCount: integer("opened_count").default(0),
  clickedCount: integer("clicked_count").default(0),
  bouncedCount: integer("bounced_count").default(0),
  unsubscribedCount: integer("unsubscribed_count").default(0),
  
  // Conversion tracking
  conversionGoal: varchar("conversion_goal"), // kyc_completion/investment/loan_application
  conversionsCount: integer("conversions_count").default(0),
  revenue: numeric("revenue", { precision: 15, scale: 2 }),
  
  // Creator
  createdBy: varchar("created_by").references(() => users.id),
  
  // Timestamps
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
  completedAt: timestamp("completed_at"),
}, (table) => [
  index("idx_campaign_type").on(table.campaignType),
  index("idx_campaign_status").on(table.status),
  index("idx_campaign_created").on(table.createdAt),
]);

// Campaign Recipients - Track individual campaign sends
export const campaignRecipients = pgTable("campaign_recipients", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  
  campaignId: varchar("campaign_id").references(() => marketingCampaigns.id).notNull(),
  userId: varchar("user_id").references(() => users.id),
  
  // Status
  status: varchar("status").default("pending"), // pending/sent/delivered/opened/clicked/failed/bounced
  errorCode: varchar("error_code"),
  errorMessage: text("error_message"),
  
  // Channel specific tracking IDs
  externalMessageId: varchar("external_message_id"), // Twilio SID, Zoho ID, etc.
  
  // Engagement
  deliveredAt: timestamp("delivered_at"),
  openedAt: timestamp("opened_at"),
  clickedAt: timestamp("clicked_at"),
  
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("idx_recipient_campaign").on(table.campaignId),
  index("idx_recipient_user").on(table.userId),
  index("idx_recipient_status").on(table.status),
]);

export const insertMarketingCampaignSchema = createInsertSchema(marketingCampaigns).extend({
  id: z.any(),
  createdAt: z.any(),
  updatedAt: z.any(),
  completedAt: z.any(),
}).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  completedAt: true,
});
export type MarketingCampaign = typeof marketingCampaigns.$inferSelect;
export type InsertMarketingCampaign = z.infer<typeof insertMarketingCampaignSchema>;

export const insertCampaignRecipientSchema = createInsertSchema(campaignRecipients).extend({
  id: z.any(),
  createdAt: z.any(),
}).omit({
  id: true,
  createdAt: true,
});
export type CampaignRecipient = typeof campaignRecipients.$inferSelect;
export type InsertCampaignRecipient = z.infer<typeof insertCampaignRecipientSchema>;

// ============ FUND PERFORMANCE ROLLING ============
// Rolling returns and risk metrics for AIF/PMS performance analysis

export const fundPerformanceRolling = pgTable("fund_performance_rolling", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  
  // Fund Reference
  fundType: text("fund_type").notNull(), // 'aif' or 'pms'
  fundId: varchar("fund_id").notNull(),
  
  // As-of date for the rolling calculation
  asOfDate: date("as_of_date").notNull(),
  
  // Rolling Returns
  return1M: decimal("return_1m", { precision: 8, scale: 4 }),
  return3M: decimal("return_3m", { precision: 8, scale: 4 }),
  return6M: decimal("return_6m", { precision: 8, scale: 4 }),
  return1Y: decimal("return_1y", { precision: 8, scale: 4 }),
  return2Y: decimal("return_2y", { precision: 8, scale: 4 }),
  return3Y: decimal("return_3y", { precision: 8, scale: 4 }),
  return5Y: decimal("return_5y", { precision: 8, scale: 4 }),
  returnSI: decimal("return_si", { precision: 8, scale: 4 }), // Since Inception
  
  // Risk Metrics at snapshot
  volatility: decimal("volatility", { precision: 8, scale: 4 }),
  maxDrawdown: decimal("max_drawdown", { precision: 8, scale: 4 }),
  sharpeRatio: decimal("sharpe_ratio", { precision: 8, scale: 4 }),
  
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  index("idx_fund_perf_rolling_fund").on(table.fundType, table.fundId),
  index("idx_fund_perf_rolling_date").on(table.asOfDate),
]);

export const insertFundPerformanceRollingSchema = createInsertSchema(fundPerformanceRolling).extend({
  id: z.any(),
  createdAt: z.any(),
}).omit({
  id: true,
  createdAt: true,
});
export type FundPerformanceRolling = typeof fundPerformanceRolling.$inferSelect;
export type InsertFundPerformanceRolling = z.infer<typeof insertFundPerformanceRollingSchema>;
