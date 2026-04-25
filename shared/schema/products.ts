import { sql } from "drizzle-orm";
import { pgTable, text, varchar, decimal, timestamp, jsonb, boolean, index, uniqueIndex, integer, date, numeric } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { partners } from './partners';
import { users } from './users';

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
