import { pgTable, varchar, decimal, timestamp, text, integer, jsonb, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { users } from "./users";
import { sql } from "drizzle-orm";

// --- MPAL Credit Domain Tables ---

export const creditProducts = pgTable("credit_products", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  providerId: varchar("provider_id").notNull(), // 'M2P', 'SETU', 'HDFC'
  productType: varchar("product_type").notNull(), // 'PERSONAL_LOAN', 'HOME_LOAN', 'CREDIT_CARD'
  name: varchar("name").notNull(),
  description: text("description"),
  interestRate: decimal("interest_rate", { precision: 5, scale: 2 }),
  maxTenureMonths: integer("max_tenure_months"),
  minLoanAmount: decimal("min_loan_amount", { precision: 15, scale: 2 }),
  maxLoanAmount: decimal("max_loan_amount", { precision: 15, scale: 2 }),
  eligibilityCriteria: jsonb("eligibility_criteria"), // Dynamic JSON for varying provider requirements
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const creditApplications = pgTable("credit_applications", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id),
  productId: varchar("product_id").notNull().references(() => creditProducts.id),
  providerRef: varchar("provider_ref"), // Reference ID from the external provider
  amountRequested: decimal("amount_requested", { precision: 15, scale: 2 }),
  tenureMonths: integer("tenure_months"),
  status: varchar("status").notNull(), // 'INITIATED', 'SUBMITTED', 'PENDING', 'APPROVED', 'REJECTED', 'DISBURSED'
  providerResponse: jsonb("provider_response"), // Store full raw responses for auditing
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const creditProviderLogs = pgTable("credit_provider_logs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  providerId: varchar("provider_id").notNull(),
  applicationId: varchar("application_id").references(() => creditApplications.id),
  action: varchar("action").notNull(), // 'ELIGIBILITY_CHECK', 'APPLICATION_SUBMISSION', 'STATUS_UPDATE'
  payload: jsonb("payload"),
  response: jsonb("response"),
  statusCode: integer("status_code"),
  timestamp: timestamp("timestamp").defaultNow(),
});

// --- Unified Profiles ---

export const financialProfiles = pgTable("financial_profiles", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id).unique(),
  netWorth: decimal("net_worth", { precision: 15, scale: 2 }).default("0"),
  totalAssets: decimal("total_assets", { precision: 15, scale: 2 }).default("0"),
  totalLiabilities: decimal("total_liabilities", { precision: 15, scale: 2 }).default("0"),
  creditUtilization: decimal("credit_utilization", { precision: 5, scale: 2 }).default("0"),
  internalRiskScore: integer("internal_risk_score"),
  lastCalculatedAt: timestamp("last_calculated_at").defaultNow(),
});

// Zod schemas
export const insertCreditProductSchema = createInsertSchema(creditProducts).omit({ id: true, createdAt: true, updatedAt: true });
export const insertCreditApplicationSchema = createInsertSchema(creditApplications).omit({ id: true, createdAt: true, updatedAt: true });
export const insertFinancialProfileSchema = createInsertSchema(financialProfiles).omit({ id: true, lastCalculatedAt: true });
