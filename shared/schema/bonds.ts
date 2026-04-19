import { sql } from "drizzle-orm";
import { bigint, boolean, date, decimal, index, integer, jsonb, pgTable, real, serial, text, timestamp, uniqueIndex, varchar } from 'drizzle-orm/pg-core';
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { users } from './users';
import { Document, User, Portfolio } from '../schema';
import { portfolios } from './portfolio';
import { agents } from './agents';
import { bondWatchlist } from './kyc';

// --- Core Bond Master Tables ---

// Government Securities table - G-Secs, T-Bills, SDLs from NSE NCB
export const governmentSecurities = pgTable("government_securities", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  isin: varchar("isin").notNull().unique(),
  securityName: text("security_name").notNull(),
  securityType: varchar("security_type").notNull(), 
  issuer: varchar("issuer").notNull(),
  auctionDate: date("auction_date"),
  auctionNumber: varchar("auction_number"),
  notifiedAmount: decimal("notified_amount", { precision: 15, scale: 2 }),
  ncbReservedAmount: decimal("ncb_reserved_amount", { precision: 15, scale: 2 }),
  faceValue: decimal("face_value", { precision: 15, scale: 2 }).default("100"),
  couponRate: decimal("coupon_rate", { precision: 8, scale: 4 }),
  issueDate: date("issue_date"),
  maturityDate: date("maturity_date").notNull(),
  tenorYears: decimal("tenor_years", { precision: 5, scale: 2 }),
  issuePrice: decimal("issue_price", { precision: 15, scale: 4 }),
  currentPrice: decimal("current_price", { precision: 15, scale: 4 }),
  yieldToMaturity: decimal("yield_to_maturity", { precision: 8, scale: 4 }),
  tradingStatus: varchar("trading_status").default("active"),
  minimumInvestment: decimal("minimum_investment", { precision: 15, scale: 2 }).default("10000"),
  duration: decimal("duration", { precision: 8, scale: 4 }),
  modifiedDuration: decimal("modified_duration", { precision: 8, scale: 4 }),
  creditRating: varchar("credit_rating").default("AAA"),
  goldReferencePrice: decimal("gold_reference_price", { precision: 15, scale: 2 }),
  goldWeight: decimal("gold_weight", { precision: 10, scale: 4 }),
  maxInvestmentLimit: decimal("max_investment_limit", { precision: 15, scale: 2 }),
  earlyRedemptionAllowed: boolean("early_redemption_allowed").default(false),
  earlyRedemptionPeriod: varchar("early_redemption_period"),
  taxStatus: varchar("tax_status").default("taxable"),
  taxBenefitSection: varchar("tax_benefit_section"),
  taxBenefitDetails: text("tax_benefit_details"),
  indexationBenefit: boolean("indexation_benefit").default(false),
  infrastructureSector: varchar("infrastructure_sector"),
  projectName: text("project_name"),
  utilizationPurpose: text("utilization_purpose"),
  specialFeatures: jsonb("special_features").default([]),
  eligibilityCriteria: text("eligibility_criteria"),
  lockinPeriod: varchar("lockin_period"),
  dataSource: varchar("data_source").default("nse_ncb"),
  lastUpdated: timestamp("last_updated").defaultNow(),
  createdAt: timestamp("created_at").defaultNow(),
});

// Corporate Bonds table - BSE Bond market
export const corporateBonds = pgTable("corporate_bonds", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  isin: varchar("isin").notNull().unique(),
  securityCode: varchar("security_code").unique(),
  bondName: text("bond_name").notNull(),
  issuer: varchar("issuer").notNull(),
  bondType: varchar("bond_type").notNull(),
  faceValue: decimal("face_value", { precision: 15, scale: 2 }).default("1000"),
  couponType: varchar("coupon_type").notNull(),
  couponRate: decimal("coupon_rate", { precision: 8, scale: 4 }),
  couponFrequency: varchar("coupon_frequency"),
  issueDate: date("issue_date"),
  maturityDate: date("maturity_date").notNull(),
  tenorYears: decimal("tenor_years", { precision: 5, scale: 2 }),
  issuePrice: decimal("issue_price", { precision: 15, scale: 4 }),
  currentPrice: decimal("current_price", { precision: 15, scale: 4 }),
  yieldToMaturity: decimal("yield_to_maturity", { precision: 8, scale: 4 }),
  yieldToCall: decimal("yield_to_call", { precision: 8, scale: 4 }),
  listingDate: date("listing_date"),
  tradingStatus: varchar("trading_status").default("active"),
  minimumLotSize: integer("minimum_lot_size").default(1),
  minimumInvestment: decimal("minimum_investment", { precision: 15, scale: 2 }),
  isCallable: boolean("is_callable").default(false),
  callDate: date("call_date"),
  callPrice: decimal("call_price", { precision: 15, scale: 4 }),
  isPuttable: boolean("is_puttable").default(false),
  putDate: date("put_date"),
  putPrice: decimal("put_price", { precision: 15, scale: 4 }),
  secured: boolean("secured").default(false),
  securityType: varchar("security_type"),
  collateralType: text("collateral_type"),
  creditRating: varchar("credit_rating"),
  ratingAgency: varchar("rating_agency"),
  ratingDate: date("rating_date"),
  outlookStatus: varchar("outlook_status"),
  duration: decimal("duration", { precision: 8, scale: 4 }),
  modifiedDuration: decimal("modified_duration", { precision: 8, scale: 4 }),
  convexity: decimal("convexity", { precision: 10, scale: 4 }),
  lastTradedPrice: decimal("last_traded_price", { precision: 15, scale: 4 }),
  lastTradedDate: date("last_traded_date"),
  volume: integer("volume"),
  turnover: decimal("turnover", { precision: 15, scale: 2 }),
  issuerSector: varchar("issuer_sector"),
  issuerIndustry: varchar("issuer_industry"),
  issuerCreditRating: varchar("issuer_credit_rating"),
  taxStatus: varchar("tax_status").default("taxable"),
  taxBenefitSection: varchar("tax_benefit_section"),
  taxBenefitDetails: text("tax_benefit_details"),
  indexationBenefit: boolean("indexation_benefit").default(false),
  infrastructureSector: varchar("infrastructure_sector"),
  projectName: text("project_name"),
  utilizationPurpose: text("utilization_purpose"),
  sebiApproved: boolean("sebi_approved").default(false),
  specialFeatures: jsonb("special_features").default([]),
  lockinPeriod: varchar("lockin_period"),
  instrumentStatus: varchar("instrument_status", { length: 16 }).default("HIDDEN").notNull(),
  isListed: boolean("is_listed").default(true).notNull(),
  liquidityScore: integer("liquidity_score"),
  ratingCurrent: varchar("rating_current", { length: 10 }),
  ratingTrend: varchar("rating_trend", { length: 10 }),
  structureComplexity: integer("structure_complexity"),
  regulatoryEligibility: varchar("regulatory_eligibility", { length: 32 }),
  bidAskSpread: decimal("bid_ask_spread", { precision: 5, scale: 2 }),
  statusReason: text("status_reason"),
  statusLastUpdated: timestamp("status_last_updated"),
  dataSource: varchar("data_source").default("bse_bond"),
  lastUpdated: timestamp("last_updated").defaultNow(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const fixedIncomeStatusLog = pgTable("fixed_income_status_log", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  isin: varchar("isin").notNull(),
  previousStatus: varchar("previous_status", { length: 16 }),
  newStatus: varchar("new_status", { length: 16 }).notNull(),
  changeReason: text("change_reason").notNull(),
  evaluationGates: jsonb("evaluation_gates").default({}),
  triggeredBy: varchar("triggered_by", { length: 50 }).default("daily_refresh"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertGovernmentSecuritySchema = createInsertSchema(governmentSecurities).omit({
  id: true,
  createdAt: true,
});

export type GovernmentSecurity = typeof governmentSecurities.$inferSelect;
export type InsertGovernmentSecurity = z.infer<typeof insertGovernmentSecuritySchema>;
export type CorporateBond = typeof corporateBonds.$inferSelect;
export type CorporateBondInsert = typeof corporateBonds.$inferInsert;

// --- Auto-Migrated Tables ---
export const bondHoldings = pgTable("bond_holdings", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  
  // User and portfolio
  userId: varchar("user_id").references(() => users.id),
  
  // Prospect support - for goals created by agents before user registration
  prospectId: varchar("prospect_id"),
  createdByAgentId: varchar("created_by_agent_id").references(() => users.id),
  portfolioId: varchar("portfolio_id").references(() => portfolios.id),
  
  // Bond details
  bondId: varchar("bond_id"),
  bondType: varchar("bond_type").notNull(), // 'government', 'corporate'
  isin: varchar("isin").notNull(),
  bondName: text("bond_name").notNull(),
  issuer: varchar("issuer").notNull(),
  
  // Holding details
  quantity: integer("quantity").notNull(),
  faceValue: decimal("face_value", { precision: 15, scale: 2 }).notNull(),
  totalFaceValue: decimal("total_face_value", { precision: 15, scale: 2 }).notNull(),
  
  // Purchase details
  purchaseDate: date("purchase_date").notNull(),
  purchasePrice: decimal("purchase_price", { precision: 15, scale: 4 }).notNull(), // Price per bond
  purchaseYield: decimal("purchase_yield", { precision: 8, scale: 4 }),
  totalInvestedAmount: decimal("total_invested_amount", { precision: 15, scale: 2 }).notNull(),
  
  // Current valuation
  currentPrice: decimal("current_price", { precision: 15, scale: 4 }),
  currentYield: decimal("current_yield", { precision: 8, scale: 4 }),
  currentValue: decimal("current_value", { precision: 15, scale: 2 }),
  unrealizedGainLoss: decimal("unrealized_gain_loss", { precision: 15, scale: 2 }),
  
  // Bond characteristics
  couponRate: decimal("coupon_rate", { precision: 8, scale: 4 }),
  maturityDate: date("maturity_date").notNull(),
  creditRating: varchar("credit_rating"),
  
  // Income tracking
  totalCouponsReceived: decimal("total_coupons_received", { precision: 15, scale: 2 }).default("0"),
  nextCouponDate: date("next_coupon_date"),
  nextCouponAmount: decimal("next_coupon_amount", { precision: 15, scale: 4 }),
  
  // Demat account
  dematAccountId: varchar("demat_account_id"),
  dematAccountNumber: varchar("demat_account_number"),
  
  // Status
  holdingStatus: varchar("holding_status").default("active"), // 'active', 'matured', 'sold'
  
  // Metadata
  lastUpdated: timestamp("last_updated").defaultNow(),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("idx_bond_holdings_user_id").on(table.userId),
  index("idx_bond_holdings_portfolio_id").on(table.portfolioId),
  index("idx_bond_holdings_status").on(table.holdingStatus),
]);

// Family Portfolio Permissions - Granular access control

export const insertCorporateBondSchema = createInsertSchema(corporateBonds).omit({
  id: true,
  createdAt: true,
});

export const bondCommissionConfig = pgTable("bond_commission_config", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  
  // Bond type identification
  bondType: varchar("bond_type").notNull().unique(), // 'g_sec', 'corporate', 'ncd', 'tax_free', 'sgb', 'sdl', 't_bill', 'infrastructure'
  bondTypeLabel: varchar("bond_type_label").notNull(), // Display name: 'Government Securities', 'Corporate Bonds', etc.
  
  // Brokerage settings (basis points - 1 bp = 0.01%)
  brokerageBps: decimal("brokerage_bps", { precision: 8, scale: 4 }).default("5"), // e.g., 5 = 0.05%
  brokerageMinAmount: decimal("brokerage_min_amount", { precision: 15, scale: 2 }).default("10"), // Minimum brokerage in INR
  brokerageMaxAmount: decimal("brokerage_max_amount", { precision: 15, scale: 2 }).default("1000"), // Maximum brokerage cap in INR
  
  // Platform fee settings
  platformFeeType: varchar("platform_fee_type").default("fixed"), // 'fixed', 'percentage', 'tiered'
  platformFeeFixed: decimal("platform_fee_fixed", { precision: 15, scale: 2 }).default("25"), // Fixed fee in INR
  platformFeePercent: decimal("platform_fee_percent", { precision: 8, scale: 4 }).default("0"), // Percentage fee
  
  // Transaction charges
  transactionChargeBps: decimal("transaction_charge_bps", { precision: 8, scale: 4 }).default("0.5"), // Exchange transaction charge
  stampDutyBps: decimal("stamp_duty_bps", { precision: 8, scale: 4 }).default("1"), // Stamp duty (buy only)
  sebiTurnoverFeeBps: decimal("sebi_turnover_fee_bps", { precision: 8, scale: 4 }).default("0.0001"), // SEBI turnover fee
  
  // GST settings
  gstRate: decimal("gst_rate", { precision: 5, scale: 2 }).default("18"), // GST on brokerage and fees
  
  // Status
  isActive: boolean("is_active").default(true),
  
  // Tier-based pricing (JSON for tiered structure)
  tieredPricing: jsonb("tiered_pricing").default([]), // [{minAmount, maxAmount, brokerageBps}]
  
  // Audit
  lastUpdatedBy: varchar("last_updated_by").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertBondCommissionConfigSchema = createInsertSchema(bondCommissionConfig).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type BondCommissionConfig = typeof bondCommissionConfig.$inferSelect;

export type InsertBondCommissionConfig = z.infer<typeof insertBondCommissionConfigSchema>;

export const bondSellListings = pgTable("bond_sell_listings", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  sellerUserId: varchar("seller_user_id").references(() => users.id).notNull(),
  
  // Instrument Reference (one of these will be set based on instrumentType)
  instrumentType: varchar("instrument_type").notNull(), // 'government_security', 'corporate_bond'
  governmentSecurityId: varchar("government_security_id").references(() => governmentSecurities.id),
  corporateBondId: varchar("corporate_bond_id").references(() => corporateBonds.id),
  isin: varchar("isin").notNull(), // ISIN for cross-reference
  
  // Bond Details (denormalized for performance)
  bondName: text("bond_name").notNull(),
  bondType: varchar("bond_type").notNull(), // 'g_sec', 't_bill', 'sdl', 'sgb', 'tax_free_bond', 'infrastructure_bond', 'corporate_bond', 'ncd', 'debenture'
  couponRate: decimal("coupon_rate", { precision: 8, scale: 4 }),
  maturityDate: date("maturity_date"),
  creditRating: varchar("credit_rating"),
  isListed: boolean("is_listed").default(true), // Listed on NSE/BSE vs OTC/unlisted
  
  // Listing Details
  faceValue: decimal("face_value", { precision: 15, scale: 2 }).notNull(),
  quantity: bigint("quantity", { mode: "number" }).notNull(), // Number of units
  askPrice: decimal("ask_price", { precision: 15, scale: 4 }).notNull(), // Price per unit (clean price)
  askYield: decimal("ask_yield", { precision: 8, scale: 4 }), // Yield to maturity at ask price
  floorPrice: decimal("floor_price", { precision: 15, scale: 4 }).notNull(), // Minimum acceptable price
  
  // Accrued Interest (for dirty price calculation)
  accruedInterest: decimal("accrued_interest", { precision: 15, scale: 4 }),
  lastCouponDate: date("last_coupon_date"),
  nextCouponDate: date("next_coupon_date"),
  
  // Listing Status
  status: varchar("status").default("pending").notNull(), // pending, active, matched, partial, cancelled, expired, compliance_blocked
  quantityRemaining: bigint("quantity_remaining", { mode: "number" }),
  
  // Validity
  validUntil: timestamp("valid_until"),
  autoRenew: boolean("auto_renew").default(false),
  
  // Additional Terms
  minimumLotSize: bigint("minimum_lot_size", { mode: "number" }).default(1),
  settlementDays: integer("settlement_days").default(2), // T+2 settlement
  notes: text("notes"),
  
  // Holding Verification
  dematAccountNumber: varchar("demat_account_number"),
  holdingVerified: boolean("holding_verified").default(false),
  holdingVerifiedAt: timestamp("holding_verified_at"),
  holdingProofUrl: text("holding_proof_url"), // Document URL
  
  // KYC & Compliance
  kycTier: integer("kyc_tier").default(1), // 1=Basic, 2=Enhanced, 3=Accredited
  kycVerified: boolean("kyc_verified").default(false),
  complianceStatus: varchar("compliance_status").default("pending"), // pending, cleared, blocked
  complianceBlockReasons: jsonb("compliance_block_reasons").default([]),
  riskAcknowledged: boolean("risk_acknowledged").default(false),
  riskAcknowledgedAt: timestamp("risk_acknowledged_at"),
  
  // TDS Handling
  tdsApplicable: boolean("tds_applicable").default(true),
  tdsRate: decimal("tds_rate", { precision: 5, scale: 2 }).default("10.00"), // Default 10% TDS on interest
  
  // Metadata
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("idx_bond_sell_listings_seller").on(table.sellerUserId),
  index("idx_bond_sell_listings_isin").on(table.isin),
  index("idx_bond_sell_listings_status").on(table.status),
  index("idx_bond_sell_listings_type").on(table.instrumentType),
  index("idx_bond_sell_listings_bond_type").on(table.bondType),
]);

export type BondSellListing = typeof bondSellListings.$inferSelect;
export type InsertBondSellListing = typeof bondSellListings.$inferInsert;
export const insertBondSellListingSchema = createInsertSchema(bondSellListings).omit({ 
  id: true, createdAt: true, updatedAt: true, quantityRemaining: true 
});

export const bondBuyRequests = pgTable("bond_buy_requests", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  buyerUserId: varchar("buyer_user_id").references(() => users.id).notNull(),
  
  // Instrument Reference (one of these will be set based on instrumentType)
  instrumentType: varchar("instrument_type").notNull(), // 'government_security', 'corporate_bond'
  governmentSecurityId: varchar("government_security_id").references(() => governmentSecurities.id),
  corporateBondId: varchar("corporate_bond_id").references(() => corporateBonds.id),
  isin: varchar("isin").notNull(),
  
  // Bond Details (denormalized for performance)
  bondName: text("bond_name").notNull(),
  bondType: varchar("bond_type").notNull(),
  couponRate: decimal("coupon_rate", { precision: 8, scale: 4 }),
  maturityDate: date("maturity_date"),
  creditRating: varchar("credit_rating"),
  isListed: boolean("is_listed").default(true),
  
  // Request Details
  faceValue: decimal("face_value", { precision: 15, scale: 2 }).notNull(),
  quantity: bigint("quantity", { mode: "number" }).notNull(),
  maxPrice: decimal("max_price", { precision: 15, scale: 4 }).notNull(), // Maximum price willing to pay (clean)
  targetPrice: decimal("target_price", { precision: 15, scale: 4 }), // Preferred price
  targetYield: decimal("target_yield", { precision: 8, scale: 4 }), // Preferred yield
  
  // Request Status
  status: varchar("status").default("pending").notNull(), // pending, active, matched, partial, cancelled, expired, compliance_blocked
  quantityFilled: bigint("quantity_filled", { mode: "number" }).default(0),
  
  // Validity
  validUntil: timestamp("valid_until"),
  
  // Additional Preferences
  preferredLotSize: bigint("preferred_lot_size", { mode: "number" }),
  maxSettlementDays: integer("max_settlement_days").default(3),
  preferredRatingMin: varchar("preferred_rating_min"), // Minimum credit rating
  notes: text("notes"),
  
  // KYC & Compliance
  kycTier: integer("kyc_tier").default(1),
  kycVerified: boolean("kyc_verified").default(false),
  fundsVerified: boolean("funds_verified").default(false),
  complianceStatus: varchar("compliance_status").default("pending"),
  complianceBlockReasons: jsonb("compliance_block_reasons").default([]),
  riskAcknowledged: boolean("risk_acknowledged").default(false),
  riskAcknowledgedAt: timestamp("risk_acknowledged_at"),
  
  // SEBI Risk Disclosures Acknowledged
  sebiDisclosuresAcknowledged: jsonb("sebi_disclosures_acknowledged").default([]), // Array of disclosure IDs
  
  // Metadata
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("idx_bond_buy_requests_buyer").on(table.buyerUserId),
  index("idx_bond_buy_requests_isin").on(table.isin),
  index("idx_bond_buy_requests_status").on(table.status),
  index("idx_bond_buy_requests_type").on(table.instrumentType),
  index("idx_bond_buy_requests_bond_type").on(table.bondType),
]);

export type BondBuyRequest = typeof bondBuyRequests.$inferSelect;
export type InsertBondBuyRequest = typeof bondBuyRequests.$inferInsert;
export const insertBondBuyRequestSchema = createInsertSchema(bondBuyRequests).omit({ 
  id: true, createdAt: true, updatedAt: true, quantityFilled: true 
});

export const bondDeals = pgTable("bond_deals", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  sellListingId: varchar("sell_listing_id").references(() => bondSellListings.id).notNull(),
  buyRequestId: varchar("buy_request_id").references(() => bondBuyRequests.id).notNull(),
  
  // Parties
  sellerUserId: varchar("seller_user_id").references(() => users.id).notNull(),
  buyerUserId: varchar("buyer_user_id").references(() => users.id).notNull(),
  
  // Instrument Details
  instrumentType: varchar("instrument_type").notNull(),
  governmentSecurityId: varchar("government_security_id").references(() => governmentSecurities.id),
  corporateBondId: varchar("corporate_bond_id").references(() => corporateBonds.id),
  isin: varchar("isin").notNull(),
  bondName: text("bond_name").notNull(),
  bondType: varchar("bond_type").notNull(),
  
  // Deal Terms
  quantity: bigint("quantity", { mode: "number" }).notNull(),
  agreedPrice: decimal("agreed_price", { precision: 15, scale: 4 }).notNull(), // Clean price
  accruedInterest: decimal("accrued_interest", { precision: 15, scale: 4 }).default("0"),
  dirtyPrice: decimal("dirty_price", { precision: 15, scale: 4 }), // Clean + accrued
  totalValue: decimal("total_value", { precision: 20, scale: 2 }).notNull(), // quantity * dirtyPrice
  effectiveYield: decimal("effective_yield", { precision: 8, scale: 4 }), // YTM at agreed price
  
  // Deal Status
  status: varchar("status").default("pending").notNull(), // pending, escrowed, payment_pending, payment_received, transferred, completed, cancelled, failed
  
  // Payment & Transfer
  escrowId: varchar("escrow_id"),
  escrowedAt: timestamp("escrowed_at"),
  paymentGateway: varchar("payment_gateway"), // cashfree, phonepe
  paymentTransactionId: varchar("payment_transaction_id"),
  paymentCompletedAt: timestamp("payment_completed_at"),
  
  // Bond Transfer
  transferMode: varchar("transfer_mode"), // off_market, on_market
  transferReferenceNumber: varchar("transfer_reference_number"),
  bondsTransferredAt: timestamp("bonds_transferred_at"),
  
  // Settlement
  settlementDate: date("settlement_date"),
  actualSettlementDate: date("actual_settlement_date"),
  
  // Platform Fees
  platformFee: decimal("platform_fee", { precision: 15, scale: 2 }),
  sellerFee: decimal("seller_fee", { precision: 15, scale: 2 }),
  buyerFee: decimal("buyer_fee", { precision: 15, scale: 2 }),
  stampDuty: decimal("stamp_duty", { precision: 15, scale: 2 }),
  
  // TDS on Accrued Interest
  tdsOnInterest: decimal("tds_on_interest", { precision: 15, scale: 2 }).default("0"),
  tdsDeductedBy: varchar("tds_deducted_by"), // platform, seller
  tdsCertificateNumber: varchar("tds_certificate_number"),
  
  // Net Settlement
  sellerPayout: decimal("seller_payout", { precision: 20, scale: 2 }),
  buyerCharge: decimal("buyer_charge", { precision: 20, scale: 2 }),
  
  // Compliance
  complianceChecked: boolean("compliance_checked").default(false),
  complianceApprovedBy: varchar("compliance_approved_by").references(() => users.id),
  complianceApprovedAt: timestamp("compliance_approved_at"),
  complianceNotes: text("compliance_notes"),
  
  // Regulatory Reporting
  sebiReportingRequired: boolean("sebi_reporting_required").default(false),
  sebiReportedAt: timestamp("sebi_reported_at"),
  rbiReportingRequired: boolean("rbi_reporting_required").default(false),
  rbiReportedAt: timestamp("rbi_reported_at"),
  
  // Metadata
  matchedAt: timestamp("matched_at").defaultNow(),
  matchedBy: varchar("matched_by").references(() => users.id), // Admin who matched
  completedAt: timestamp("completed_at"),
  cancelledAt: timestamp("cancelled_at"),
  cancellationReason: text("cancellation_reason"),
  
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("idx_bond_deals_seller").on(table.sellerUserId),
  index("idx_bond_deals_buyer").on(table.buyerUserId),
  index("idx_bond_deals_isin").on(table.isin),
  index("idx_bond_deals_status").on(table.status),
  index("idx_bond_deals_matched").on(table.matchedAt),
]);

export type BondDeal = typeof bondDeals.$inferSelect;
export type InsertBondDeal = typeof bondDeals.$inferInsert;
export const insertBondDealSchema = createInsertSchema(bondDeals).omit({ 
  id: true, createdAt: true, updatedAt: true, matchedAt: true 
});

export const bondMarketplaceAuditLogs = pgTable("bond_marketplace_audit_logs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  
  // Actor
  userId: varchar("user_id").references(() => users.id),
  userEmail: varchar("user_email"),
  userRole: varchar("user_role"), // admin, investor, seller
  
  // Action Details
  action: varchar("action").notNull(), // create_listing, update_listing, cancel_listing, create_request, match_deal, approve_compliance, complete_deal, etc.
  entityType: varchar("entity_type").notNull(), // sell_listing, buy_request, deal
  entityId: varchar("entity_id").notNull(),
  
  // Instrument Context
  isin: varchar("isin"),
  bondType: varchar("bond_type"),
  instrumentType: varchar("instrument_type"),
  
  // Change Tracking
  beforeValue: jsonb("before_value"),
  afterValue: jsonb("after_value"),
  changeDescription: text("change_description"),
  
  // Compliance Context
  complianceRelated: boolean("compliance_related").default(false),
  riskLevel: varchar("risk_level"), // low, medium, high, critical
  
  // Request Context
  ipAddress: varchar("ip_address"),
  userAgent: text("user_agent"),
  sessionId: varchar("session_id"),
  
  // Timestamps
  timestamp: timestamp("timestamp").defaultNow(),
  
  // Retention Policy
  retentionExpiresAt: timestamp("retention_expires_at"), // 7 years from timestamp
}, (table) => [
  index("idx_bond_audit_user").on(table.userId),
  index("idx_bond_audit_action").on(table.action),
  index("idx_bond_audit_entity").on(table.entityType, table.entityId),
  index("idx_bond_audit_isin").on(table.isin),
  index("idx_bond_audit_timestamp").on(table.timestamp),
]);

export type BondMarketplaceAuditLog = typeof bondMarketplaceAuditLogs.$inferSelect;
export type InsertBondMarketplaceAuditLog = typeof bondMarketplaceAuditLogs.$inferInsert;
export const insertBondMarketplaceAuditLogSchema = createInsertSchema(bondMarketplaceAuditLogs).omit({ 
  id: true, timestamp: true 
});

export const bondRiskDisclosureAcknowledgments = pgTable("bond_risk_disclosure_acknowledgments", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id),
  
  // Prospect support - for goals created by agents before user registration
  prospectId: varchar("prospect_id"),
  createdByAgentId: varchar("created_by_agent_id").references(() => users.id),
  
  // Disclosure Category (per SEBI NCS Regulations)
  disclosureCategory: varchar("disclosure_category").notNull(), // credit_risk, interest_rate_risk, liquidity_risk, default_risk, call_risk, reinvestment_risk, regulatory_risk, issuer_risk
  disclosureVersion: varchar("disclosure_version").default("1.0"),
  
  // Instrument Context (can be general or specific)
  bondType: varchar("bond_type"), // If specific to a bond type
  isin: varchar("isin"), // If specific to an instrument
  creditRatingCategory: varchar("credit_rating_category"), // investment_grade, below_investment_grade
  
  // Acknowledgment Details
  acknowledged: boolean("acknowledged").default(false),
  acknowledgedAt: timestamp("acknowledged_at"),
  acknowledgedFromIp: varchar("acknowledged_from_ip"),
  
  // Disclosure Content Hash (for version tracking)
  contentHash: varchar("content_hash"),
  
  // Validity
  validUntil: timestamp("valid_until"), // May require re-acknowledgment annually
  
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("idx_bond_disclosure_user").on(table.userId),
  index("idx_bond_disclosure_category").on(table.disclosureCategory),
  index("idx_bond_disclosure_isin").on(table.isin),
]);

// ============================================
// BOND FEE PROFILES - RBI/SEBI Compliant Fee Structure
// ============================================

// Instrument types for bond fee profiles
export const bondInstrumentTypes = [
  'gsec',           // Government Securities
  'tbill',          // Treasury Bills
  'sdl',            // State Development Loans
  'sgb',            // Sovereign Gold Bonds
  'corporate_bond', // Listed Corporate Bonds
  'ncd',            // Non-Convertible Debentures
  'infrastructure_bond', // Infrastructure Bonds (54EC, Tax-Free)
  'unlisted_bond',  // Unlisted/Private Bonds
  'tax_free_bond',  // Tax-Free Bonds
] as const;

export type BondInstrumentType = typeof bondInstrumentTypes[number];

// Bond Fee Profiles - Category-level fee defaults with regulatory caps
export const bondFeeProfiles = pgTable("bond_fee_profiles", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  
  // Instrument Classification
  instrumentType: varchar("instrument_type").notNull(), // gsec, tbill, sdl, sgb, corporate_bond, ncd, infrastructure_bond, unlisted_bond
  instrumentLabel: varchar("instrument_label").notNull(), // Display name
  
  // Platform Fee Structure
  platformFeeType: varchar("platform_fee_type").default("percentage"), // percentage or flat
  platformFeeValue: decimal("platform_fee_value", { precision: 10, scale: 4 }).default("0"),
  platformFeeMin: decimal("platform_fee_min", { precision: 10, scale: 2 }),
  platformFeeMax: decimal("platform_fee_max", { precision: 10, scale: 2 }),
  
  // Brokerage Fee Structure
  brokerageFeeType: varchar("brokerage_fee_type").default("percentage"), // percentage or flat
  brokerageFeeValue: decimal("brokerage_fee_value", { precision: 10, scale: 4 }).default("0"),
  brokerageFeeMin: decimal("brokerage_fee_min", { precision: 10, scale: 2 }),
  brokerageFeeMax: decimal("brokerage_fee_max", { precision: 10, scale: 2 }),
  
  // Transaction Charges
  transactionCharges: decimal("transaction_charges", { precision: 10, scale: 4 }).default("0"),
  transactionChargesType: varchar("transaction_charges_type").default("percentage"),
  
  // Regulatory Caps (RBI/SEBI mandated)
  regulatoryMaxBrokerage: decimal("regulatory_max_brokerage", { precision: 10, scale: 4 }),
  regulatoryMaxPlatformFee: decimal("regulatory_max_platform_fee", { precision: 10, scale: 4 }),
  
  // GST Configuration
  gstApplicable: boolean("gst_applicable").default(true),
  gstRate: decimal("gst_rate", { precision: 5, scale: 2 }).default("18"),
  
  // Stamp Duty
  stampDutyApplicable: boolean("stamp_duty_applicable").default(false),
  stampDutyRate: decimal("stamp_duty_rate", { precision: 5, scale: 4 }).default("0"),
  
  // Investor Segment Multipliers
  retailMultiplier: decimal("retail_multiplier", { precision: 5, scale: 2 }).default("1.00"),
  hniMultiplier: decimal("hni_multiplier", { precision: 5, scale: 2 }).default("1.00"),
  institutionalMultiplier: decimal("institutional_multiplier", { precision: 5, scale: 2 }).default("0.50"),
  
  // Transaction Type Differentiation
  buyFeeMultiplier: decimal("buy_fee_multiplier", { precision: 5, scale: 2 }).default("1.00"),
  sellFeeMultiplier: decimal("sell_fee_multiplier", { precision: 5, scale: 2 }).default("1.00"),
  
  // Regulatory Reference
  regulatoryReference: varchar("regulatory_reference"),
  regulatoryNotes: text("regulatory_notes"),
  
  // Status
  isActive: boolean("is_active").default(true),
  effectiveFrom: timestamp("effective_from").defaultNow(),
  effectiveUntil: timestamp("effective_until"),
  
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
  createdBy: varchar("created_by").references(() => users.id),
  updatedBy: varchar("updated_by").references(() => users.id),
}, (table) => [
  index("idx_bond_fee_instrument").on(table.instrumentType),
  index("idx_bond_fee_active").on(table.isActive),
]);

export type BondFeeProfile = typeof bondFeeProfiles.$inferSelect;
export type InsertBondFeeProfile = typeof bondFeeProfiles.$inferInsert;
export const insertBondFeeProfileSchema = createInsertSchema(bondFeeProfiles).omit({ 
  id: true, createdAt: true, updatedAt: true 
});

export const bondFeeOverrides = pgTable("bond_fee_overrides", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  
  // Bond Reference
  governmentSecurityId: varchar("government_security_id").references(() => governmentSecurities.id),
  corporateBondId: varchar("corporate_bond_id").references(() => corporateBonds.id),
  isin: varchar("isin"),
  
  // Override Values (null = use category default)
  platformFeeOverride: decimal("platform_fee_override", { precision: 10, scale: 4 }),
  brokerageFeeOverride: decimal("brokerage_fee_override", { precision: 10, scale: 4 }),
  transactionChargesOverride: decimal("transaction_charges_override", { precision: 10, scale: 4 }),
  
  // Override Reason (for audit)
  overrideReason: text("override_reason"),
  
  // Approval
  approvedBy: varchar("approved_by").references(() => users.id),
  approvedAt: timestamp("approved_at"),
  
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
  createdBy: varchar("created_by").references(() => users.id),
}, (table) => [
  index("idx_bond_override_gsec").on(table.governmentSecurityId),
  index("idx_bond_override_corp").on(table.corporateBondId),
  index("idx_bond_override_isin").on(table.isin),
]);

export type BondFeeOverride = typeof bondFeeOverrides.$inferSelect;
export type InsertBondFeeOverride = typeof bondFeeOverrides.$inferInsert;
export const insertBondFeeOverrideSchema = createInsertSchema(bondFeeOverrides).omit({ 
  id: true, createdAt: true, updatedAt: true 
});

export const bondCatalog = pgTable("bond_catalog", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  
  // Source Identification
  source: varchar("source").notNull(), // nse, bse, rbi_retail_direct, manual
  sourceId: varchar("source_id"),
  
  // Bond Identification
  isin: varchar("isin").notNull(),
  bondName: varchar("bond_name").notNull(),
  issuerName: varchar("issuer_name").notNull(),
  
  // Classification
  instrumentType: varchar("instrument_type").notNull(), // gsec, tbill, sdl, sgb, corporate_bond, ncd, infrastructure_bond, unlisted_bond
  isListed: boolean("is_listed").default(true),
  exchange: varchar("exchange"), // NSE, BSE, null for unlisted
  
  // Bond Terms
  faceValue: decimal("face_value", { precision: 15, scale: 2 }).default("1000"),
  couponRate: decimal("coupon_rate", { precision: 8, scale: 4 }),
  couponFrequency: varchar("coupon_frequency"), // annual, semi_annual, quarterly, monthly
  issueDate: date("issue_date"),
  maturityDate: date("maturity_date"),
  
  // Pricing
  cleanPrice: decimal("clean_price", { precision: 15, scale: 4 }),
  dirtyPrice: decimal("dirty_price", { precision: 15, scale: 4 }),
  accruedInterest: decimal("accrued_interest", { precision: 15, scale: 4 }),
  yieldToMaturity: decimal("yield_to_maturity", { precision: 8, scale: 4 }),
  
  // Credit Rating
  creditRating: varchar("credit_rating"),
  ratingAgency: varchar("rating_agency"),
  
  // Investment Details
  minInvestment: decimal("min_investment", { precision: 15, scale: 2 }),
  lotSize: integer("lot_size").default(1),
  
  // Tax Treatment
  taxCategory: varchar("tax_category"), // taxable, tax_free, tax_saving
  tdsApplicable: boolean("tds_applicable").default(true),
  tdsRate: decimal("tds_rate", { precision: 5, scale: 2 }),
  
  // Fee Configuration
  feeProfileId: varchar("fee_profile_id").references(() => bondFeeProfiles.id),
  feeOverrideId: varchar("fee_override_id").references(() => bondFeeOverrides.id),
  
  // Calculated Net Yield
  netYieldToMaturity: decimal("net_yield_to_maturity", { precision: 8, scale: 4 }),
  
  // Publish Workflow
  status: varchar("status").default("draft").notNull(), // draft, pending_review, published, unpublished, archived
  publishedAt: timestamp("published_at"),
  publishedBy: varchar("published_by").references(() => users.id),
  unpublishedAt: timestamp("unpublished_at"),
  unpublishedBy: varchar("unpublished_by").references(() => users.id),
  unpublishReason: text("unpublish_reason"),
  
  // Compliance
  complianceApproved: boolean("compliance_approved").default(false),
  complianceApprovedBy: varchar("compliance_approved_by").references(() => users.id),
  complianceApprovedAt: timestamp("compliance_approved_at"),
  
  // Regulatory Tier
  regulatoryTier: varchar("regulatory_tier"),
  kycTierRequired: varchar("kyc_tier_required").default("basic"),
  
  // Metadata
  lastSyncAt: timestamp("last_sync_at"),
  syncErrors: text("sync_errors"),
  
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
  createdBy: varchar("created_by").references(() => users.id),
  updatedBy: varchar("updated_by").references(() => users.id),
}, (table) => [
  index("idx_bond_catalog_isin").on(table.isin),
  index("idx_bond_catalog_source").on(table.source),
  index("idx_bond_catalog_type").on(table.instrumentType),
  index("idx_bond_catalog_status").on(table.status),
  index("idx_bond_catalog_listed").on(table.isListed),
  index("idx_bond_catalog_exchange").on(table.exchange),
]);

export type BondCatalogEntry = typeof bondCatalog.$inferSelect;
export type InsertBondCatalogEntry = typeof bondCatalog.$inferInsert;
export const insertBondCatalogSchema = createInsertSchema(bondCatalog).omit({ 
  id: true, createdAt: true, updatedAt: true, publishedAt: true 
});

export const bondAlerts = pgTable("bond_alerts", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id),
  watchlistId: varchar("watchlist_id").references(() => bondWatchlist.id),
  
  // Alert Type
  alertType: varchar("alert_type").notNull(), // yield_change, price_change, new_listing, maturity_approaching
  
  // Bond Reference
  isin: varchar("isin").notNull(),
  bondName: varchar("bond_name").notNull(),
  
  // Alert Details
  title: varchar("title").notNull(),
  message: text("message").notNull(),
  previousValue: decimal("previous_value", { precision: 15, scale: 4 }),
  currentValue: decimal("current_value", { precision: 15, scale: 4 }),
  changePercentage: decimal("change_percentage", { precision: 8, scale: 4 }),
  
  // Status
  status: varchar("status").default("unread").notNull(), // unread, read, dismissed
  readAt: timestamp("read_at"),
  
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("idx_bond_alerts_user").on(table.userId),
  index("idx_bond_alerts_status").on(table.status),
]);

export type BondAlert = typeof bondAlerts.$inferSelect;
export type InsertBondAlert = typeof bondAlerts.$inferInsert;
export const insertBondAlertSchema = createInsertSchema(bondAlerts).omit({
  id: true, createdAt: true
});

export const bondRiskDisclosureAttestations = pgTable("bond_risk_disclosure_attestations", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id),
  
  // Order Reference
  orderId: varchar("order_id"),
  orderType: varchar("order_type"), // buy_request, sell_listing
  
  // Bond Reference
  isin: varchar("isin").notNull(),
  bondName: varchar("bond_name").notNull(),
  instrumentType: varchar("instrument_type").notNull(),
  transactionValue: decimal("transaction_value", { precision: 15, scale: 2 }).notNull(),
  
  // Disclosure Categories Acknowledged
  disclosuresAcknowledged: jsonb("disclosures_acknowledged").notNull(), // Array of category codes
  allDisclosuresAccepted: boolean("all_disclosures_accepted").default(false),
  
  // User Attestation
  attestedAt: timestamp("attested_at").defaultNow(),
  ipAddress: varchar("ip_address"),
  userAgent: text("user_agent"),
  
  // Audit (7-year SEBI retention)
  retentionExpiresAt: timestamp("retention_expires_at"),
}, (table) => [
  index("idx_disclosure_attestation_user").on(table.userId),
  index("idx_disclosure_attestation_order").on(table.orderId),
  index("idx_disclosure_attestation_isin").on(table.isin),
]);

export type BondRiskDisclosureAttestation = typeof bondRiskDisclosureAttestations.$inferSelect;
export type InsertBondRiskDisclosureAttestation = typeof bondRiskDisclosureAttestations.$inferInsert;

// Suitability Scores - Bond matching to investor profile
export const bondSuitabilityScores = pgTable("bond_suitability_scores", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id),
  isin: varchar("isin").notNull(),
  
  // Scoring Components (0-100)
  riskAlignmentScore: integer("risk_alignment_score").notNull(), // How well risk matches profile
  horizonAlignmentScore: integer("horizon_alignment_score").notNull(), // Investment horizon match
  liquidityScore: integer("liquidity_score").notNull(), // Liquidity needs match
  yieldExpectationScore: integer("yield_expectation_score").notNull(), // Yield target match
  taxEfficiencyScore: integer("tax_efficiency_score").notNull(), // Tax benefit match
  
  // Overall Score
  overallSuitabilityScore: integer("overall_suitability_score").notNull(),
  suitabilityCategory: varchar("suitability_category").notNull(), // highly_suitable, suitable, neutral, less_suitable, not_suitable
  
  // Reasoning
  reasoningSummary: text("reasoning_summary"),
  warnings: jsonb("warnings"), // Array of warning messages
  
  // Cache invalidation
  calculatedAt: timestamp("calculated_at").defaultNow(),
  validUntil: timestamp("valid_until"),
  
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("idx_suitability_user").on(table.userId),
  index("idx_suitability_isin").on(table.isin),
  index("idx_suitability_score").on(table.overallSuitabilityScore),
]);

export type BondSuitabilityScore = typeof bondSuitabilityScores.$inferSelect;
export type InsertBondSuitabilityScore = typeof bondSuitabilityScores.$inferInsert;

// Fee Override Audit Trail - For compliance dashboard
export const bondFeeOverrideAudit = pgTable("bond_fee_override_audit", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  
  // Override Reference
  overrideId: varchar("override_id").references(() => bondFeeOverrides.id),
  isin: varchar("isin").notNull(),
  bondName: varchar("bond_name"),
  instrumentType: varchar("instrument_type"),
  
  // Change Details
  action: varchar("action").notNull(), // created, modified, approved, revoked
  
  // Before/After Values
  previousPlatformFee: decimal("previous_platform_fee", { precision: 10, scale: 4 }),
  newPlatformFee: decimal("new_platform_fee", { precision: 10, scale: 4 }),
  previousBrokerageFee: decimal("previous_brokerage_fee", { precision: 10, scale: 4 }),
  newBrokerageFee: decimal("new_brokerage_fee", { precision: 10, scale: 4 }),
  previousTransactionCharges: decimal("previous_transaction_charges", { precision: 10, scale: 4 }),
  newTransactionCharges: decimal("new_transaction_charges", { precision: 10, scale: 4 }),
  
  // Net Yield Impact
  previousNetYield: decimal("previous_net_yield", { precision: 8, scale: 4 }),
  newNetYield: decimal("new_net_yield", { precision: 8, scale: 4 }),
  yieldImpactBps: integer("yield_impact_bps"),
  
  // Reason and Approval
  overrideReason: text("override_reason"),
  regulatoryViolations: jsonb("regulatory_violations"), // Array of violation messages
  
  // Audit Metadata
  performedBy: varchar("performed_by").references(() => users.id),
  approvedBy: varchar("approved_by").references(() => users.id),
  performedAt: timestamp("performed_at").defaultNow(),
  
  // Compliance Retention (7 years)
  retentionExpiresAt: timestamp("retention_expires_at"),
}, (table) => [
  index("idx_fee_audit_override").on(table.overrideId),
  index("idx_fee_audit_isin").on(table.isin),
  index("idx_fee_audit_action").on(table.action),
  index("idx_fee_audit_date").on(table.performedAt),
]);

export type BondFeeOverrideAudit = typeof bondFeeOverrideAudit.$inferSelect;
export type InsertBondFeeOverrideAudit = typeof bondFeeOverrideAudit.$inferInsert;

// Bond Comparison Sessions - Temporary storage for comparison feature
export const bondComparisonSessions = pgTable("bond_comparison_sessions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id),
  sessionToken: varchar("session_token"),
  
  // Bonds to compare (max 4)
  bondIsins: text("bond_isins").array().notNull(),
  
  createdAt: timestamp("created_at").defaultNow(),
  expiresAt: timestamp("expires_at"),
}, (table) => [
  index("idx_comparison_user").on(table.userId),
  index("idx_comparison_session").on(table.sessionToken),
]);

// =============================================================================
// SEBI/RBI REGULATORY FRAMEWORK FOR FIXED INCOME
// =============================================================================

// Investor Classification Types (SEBI Guidelines 2024)
export const investorClassificationTypes = ["retail", "sHNI", "bHNI", "qib", "anchor"] as const;
export type InvestorClassificationType = typeof investorClassificationTypes[number];

// Investor Classification Rules (auto-classification based on investment/net worth)
export const investorClassificationRules = pgTable("investor_classification_rules", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  
  // Classification Type
  classificationType: varchar("classification_type").notNull(), // retail, sHNI, bHNI, qib, anchor
  displayName: varchar("display_name").notNull(),
  description: text("description"),
  
  // Investment Amount Thresholds (SEBI 2024)
  minInvestmentAmount: decimal("min_investment_amount", { precision: 18, scale: 2 }).notNull(),
  maxInvestmentAmount: decimal("max_investment_amount", { precision: 18, scale: 2 }), // null = no limit
  
  // Net Worth Thresholds (for QIB classification)
  minNetWorth: decimal("min_net_worth", { precision: 18, scale: 2 }),
  minAum: decimal("min_aum", { precision: 18, scale: 2 }), // Assets Under Management for institutions
  
  // KYC Requirements
  requiredKycTier: varchar("required_kyc_tier").notNull().default("basic"), // basic, enhanced, accredited_investor
  requiresSEBIRegistration: boolean("requires_sebi_registration").default(false),
  requiresProfessionalQualification: boolean("requires_professional_qualification").default(false),
  
  // Eligible Entity Types
  eligibleEntityTypes: text("eligible_entity_types").array().default(sql`'{}'::text[]`), // individual, company, trust, partnership, huf, llp, fpi, mf, insurance, pension
  
  // Allotment Rules
  allotmentMethod: varchar("allotment_method").notNull(), // lottery, proportionate, direct
  ipoQuotaPercentage: decimal("ipo_quota_percentage", { precision: 5, scale: 2 }),
  canBidAtCutoff: boolean("can_bid_at_cutoff").default(false),
  canWithdrawBid: boolean("can_withdraw_bid").default(true),
  
  // Lock-in Requirements
  lockInPeriodDays: integer("lock_in_period_days").default(0),
  
  // Status
  isActive: boolean("is_active").default(true),
  effectiveFrom: timestamp("effective_from").defaultNow(),
  effectiveTo: timestamp("effective_to"),
  
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("idx_classification_type").on(table.classificationType),
  index("idx_classification_active").on(table.isActive),
]);

export const insertInvestorClassificationRuleSchema = createInsertSchema(investorClassificationRules).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const bondCalendarEvents = pgTable("bond_calendar_events", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  
  // Event Identification
  eventType: varchar("event_type").notNull(), // issuance, maturity, coupon_payment, etc.
  eventTitle: varchar("event_title").notNull(),
  eventDescription: text("event_description"),
  
  // Timing
  eventDate: date("event_date").notNull(),
  eventTime: varchar("event_time"), // HH:MM format if specific time known
  endDate: date("end_date"), // For events spanning multiple days (IPO open/close period)
  
  // Bond/Instrument Reference
  isin: varchar("isin"),
  instrumentName: varchar("instrument_name").notNull(),
  instrumentType: varchar("instrument_type").notNull(), // gsec, tbill, sdl, sgb, corporate_bond, ncd, infrastructure_bond
  
  // Issuer Information
  issuerName: varchar("issuer_name"),
  issuerType: varchar("issuer_type"), // government, psu, corporate, bank, nbfc
  
  // Financial Details
  faceValue: decimal("face_value", { precision: 15, scale: 2 }),
  issueSize: decimal("issue_size", { precision: 18, scale: 2 }), // Total issue amount in crores
  couponRate: decimal("coupon_rate", { precision: 6, scale: 3 }),
  yieldIndicative: decimal("yield_indicative", { precision: 8, scale: 4 }),
  creditRating: varchar("credit_rating"), // AAA, AA+, etc.
  
  // For IPO/NCD issuances
  minInvestment: decimal("min_investment", { precision: 15, scale: 2 }),
  maxInvestment: decimal("max_investment", { precision: 18, scale: 2 }),
  lotSize: integer("lot_size"),
  retailQuota: decimal("retail_quota", { precision: 5, scale: 2 }), // Percentage for retail investors
  
  // Source and External Reference
  source: varchar("source").notNull(), // rbi, sebi, nse, bse, manual, internal
  sourceUrl: text("source_url"), // Link to official announcement
  externalId: varchar("external_id"), // ID from source system
  
  // Status
  status: varchar("status").default("upcoming"), // upcoming, ongoing, completed, cancelled
  isHighlighted: boolean("is_highlighted").default(false), // Feature on dashboard
  
  // Metadata
  tags: text("tags").array().default(sql`'{}'::text[]`), // tax-free, green-bond, sovereign, etc.
  additionalInfo: jsonb("additional_info").default({}), // Flexible additional data
  
  // Audit
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
  lastSyncedAt: timestamp("last_synced_at"),
}, (table) => [
  index("idx_bond_calendar_date").on(table.eventDate),
  index("idx_bond_calendar_type").on(table.eventType),
  index("idx_bond_calendar_instrument").on(table.instrumentType),
  index("idx_bond_calendar_status").on(table.status),
  index("idx_bond_calendar_source").on(table.source),
  index("idx_bond_calendar_isin").on(table.isin),
]);

export const insertBondCalendarEventSchema = createInsertSchema(bondCalendarEvents).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const bondMetrics = pgTable("bond_metrics", {
  id: serial("id").primaryKey(),
  bondId: varchar("bond_id"),
  isin: varchar("isin").notNull(),
  issuerName: varchar("issuer_name"),
  fiscalYear: varchar("fiscal_year", { length: 10 }).notNull(),
  
  // === YIELD METRICS ===
  couponRate: decimal("coupon_rate", { precision: 8, scale: 4 }),
  currentYield: decimal("current_yield", { precision: 8, scale: 4 }),
  yieldToMaturity: decimal("yield_to_maturity", { precision: 10, scale: 4 }),
  yieldToCall: decimal("yield_to_call", { precision: 10, scale: 4 }),
  yieldToWorst: decimal("yield_to_worst", { precision: 10, scale: 4 }),
  yieldSpread: decimal("yield_spread", { precision: 10, scale: 4 }), // vs benchmark
  gSpread: decimal("g_spread", { precision: 10, scale: 4 }), // vs GSec
  zSpread: decimal("z_spread", { precision: 10, scale: 4 }),
  
  // === DURATION & SENSITIVITY ===
  macaulayDuration: decimal("macaulay_duration", { precision: 10, scale: 4 }),
  modifiedDuration: decimal("modified_duration", { precision: 10, scale: 4 }),
  effectiveDuration: decimal("effective_duration", { precision: 10, scale: 4 }),
  convexity: decimal("convexity", { precision: 12, scale: 4 }),
  dv01: decimal("dv01", { precision: 15, scale: 6 }), // Dollar value of 1bp
  
  // === CREDIT METRICS ===
  creditRating: varchar("credit_rating", { length: 10 }),
  creditRatingAgency: varchar("credit_rating_agency", { length: 50 }),
  creditSpread: decimal("credit_spread", { precision: 10, scale: 4 }),
  defaultProbability: decimal("default_probability", { precision: 10, scale: 6 }),
  recoveryRate: decimal("recovery_rate", { precision: 8, scale: 4 }),
  
  // === ISSUER FINANCIALS ===
  issuerDebtToEquity: decimal("issuer_debt_to_equity", { precision: 10, scale: 4 }),
  issuerInterestCoverage: decimal("issuer_interest_coverage", { precision: 12, scale: 4 }),
  issuerCurrentRatio: decimal("issuer_current_ratio", { precision: 10, scale: 4 }),
  
  // === BOND DETAILS ===
  faceValue: decimal("face_value", { precision: 15, scale: 2 }),
  currentPrice: decimal("current_price", { precision: 15, scale: 4 }),
  accruedInterest: decimal("accrued_interest", { precision: 15, scale: 4 }),
  cleanPrice: decimal("clean_price", { precision: 15, scale: 4 }),
  dirtyPrice: decimal("dirty_price", { precision: 15, scale: 4 }),
  issueDate: date("issue_date"),
  maturityDate: date("maturity_date"),
  nextCouponDate: date("next_coupon_date"),
  daysToMaturity: integer("days_to_maturity"),
  yearsToMaturity: decimal("years_to_maturity", { precision: 8, scale: 4 }),
  isCallable: boolean("is_callable").default(false),
  callDate: date("call_date"),
  
  // === LIQUIDITY ===
  tradingVolume30d: decimal("trading_volume_30d", { precision: 20, scale: 2 }),
  bidAskSpread: decimal("bid_ask_spread", { precision: 10, scale: 4 }),
  
  // === METADATA ===
  dataSource: varchar("data_source", { length: 50 }),
  calculatedAt: timestamp("calculated_at").defaultNow(),
  lastUpdated: timestamp("last_updated").defaultNow(),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("idx_bond_metrics_bond").on(table.bondId),
  index("idx_bond_metrics_isin").on(table.isin),
  index("idx_bond_metrics_fy").on(table.fiscalYear),
]);

export const insertBondMetricsSchema = createInsertSchema(bondMetrics).omit({
  id: true, calculatedAt: true, lastUpdated: true, createdAt: true,
});

export type BondMetrics = typeof bondMetrics.$inferSelect;

export type InsertBondMetrics = z.infer<typeof insertBondMetricsSchema>;
