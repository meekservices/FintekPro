import { pgTable, varchar, decimal, timestamp, text, integer, jsonb, boolean, uniqueIndex, index } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { users } from "./users";
import { sql } from "drizzle-orm";
import { z } from "zod";

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

// ─── MPAL Broker Orders — cross-broker order audit trail ────────────────────

/**
 * brokerOrders — Canonical order log across all broker adapters.
 *
 * Every order placed via InvestmentRouter is written here before calling
 * the broker, then updated on result. This enables:
 *   - Idempotent retries (idempotencyKey UNIQUE)
 *   - Audit trail (who placed what, when, via which broker)
 *   - Status reconciliation via webhook or polling
 *   - Cross-broker position aggregation
 */
export const brokerOrders = pgTable("broker_orders", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),

  // ── Who / What ───────────────────────────────────────────────────────────
  userId: varchar("user_id").notNull().references(() => users.id),
  /** IIFL | ALPACA | IRIS | ZERODHA | … */
  brokerId: varchar("broker_id").notNull(),
  /** EQUITY_IN | EQUITY_US | MF | NFO | FD | PMS | AIF | FNO | BOND */
  capability: varchar("capability").notNull(),

  // ── Instrument ───────────────────────────────────────────────────────────
  /** Canonical FintekPro symbol, e.g. "RELIANCE.NS", "AAPL", "INF200K01RK2" */
  symbol: varchar("symbol"),
  /** buy | sell */
  side: varchar("side").notNull(),
  /** market | limit | stop | stop_limit */
  orderType: varchar("order_type").default("market").notNull(),

  // ── Sizing ───────────────────────────────────────────────────────────────
  quantity: decimal("quantity", { precision: 18, scale: 6 }),
  notional: decimal("notional", { precision: 18, scale: 2 }),
  currency: varchar("currency").default("INR").notNull(),
  limitPrice: decimal("limit_price", { precision: 18, scale: 6 }),

  // ── Status Lifecycle ─────────────────────────────────────────────────────
  /** pending → submitted → partially_filled → filled | rejected | cancelled */
  status: varchar("status").default("pending").notNull(),
  /** The broker's own order reference */
  brokerOrderId: varchar("broker_order_id"),
  filledQty: decimal("filled_qty", { precision: 18, scale: 6 }),
  filledPrice: decimal("filled_price", { precision: 18, scale: 6 }),

  // ── Error Tracking ───────────────────────────────────────────────────────
  errorCode: varchar("error_code"),
  errorMessage: text("error_message"),
  retryable: boolean("retryable").default(false),
  attemptCount: integer("attempt_count").default(0).notNull(),

  // ── Idempotency & Audit ──────────────────────────────────────────────────
  /** Client-supplied key — UNIQUE so duplicate submissions are safe */
  idempotencyKey: varchar("idempotency_key"),
  /** api | system | cron | advisor */
  source: varchar("source").default("api").notNull(),

  // ── Timestamps ───────────────────────────────────────────────────────────
  submittedAt: timestamp("submitted_at"),
  filledAt: timestamp("filled_at"),
  cancelledAt: timestamp("cancelled_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => [
  index("idx_broker_orders_user").on(table.userId),
  index("idx_broker_orders_broker").on(table.brokerId),
  index("idx_broker_orders_status").on(table.status),
  index("idx_broker_orders_capability").on(table.capability),
  index("idx_broker_orders_created").on(table.createdAt),
  uniqueIndex("idx_broker_orders_idempotency").on(table.idempotencyKey),
]);

export const insertBrokerOrderSchema = createInsertSchema(brokerOrders).extend({
  id: z.any(),
  createdAt: z.any(),
  updatedAt: z.any(),
}).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type BrokerOrderRow = typeof brokerOrders.$inferSelect;
export type InsertBrokerOrder = z.infer<typeof insertBrokerOrderSchema>;
