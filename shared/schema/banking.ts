import { pgTable, varchar, text, timestamp, jsonb, boolean, index, integer, numeric, decimal, uniqueIndex, date } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { users } from "./users";
import { userCart } from "./cart";
import { lrsComplianceTracking } from "./kyc";

// ============================================================================
// BBPS INFRASTRUCTURE - Bharat Bill Payment System
// ============================================================================

export const bbpsCategories = pgTable("bbps_categories", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  categoryName: varchar("category_name").notNull(), // Electricity, Gas, Telecom, etc.
  categoryCode: varchar("category_code").notNull().unique(), // ELECTRICITY_BILL, GAS_BILL, etc.
  description: text("description"),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const bbpsBillers = pgTable("bbps_billers", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  billerName: varchar("biller_name").notNull(), // BSES, Airtel, etc.
  billerCode: varchar("biller_code").notNull().unique(), // BSES001, AIRTEL001, etc.
  categoryId: varchar("category_id").references(() => bbpsCategories.id).notNull(),
  billerAliasName: varchar("biller_alias_name"),
  billerCoverage: varchar("biller_coverage"), // ALL_INDIA, STATE_WISE, etc.
  paymentAmountExactness: varchar("payment_amount_exactness").default("EXACT_BILL_AMOUNT"), // EXACT_BILL_AMOUNT, EXACT_OR_LOWER, ANY
  customerParamName: varchar("customer_param_name").notNull(), // ConsumerNumber, AccountNumber, etc.
  billerEffctvFrom: timestamp("biller_effctv_from"),
  billerEffctvTo: timestamp("biller_effctv_to"),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const bbpsCustomerBills = pgTable("bbps_customer_bills", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id),
  
  // Prospect support - for goals created by agents before user registration
  prospectId: varchar("prospect_id"),
  createdByAgentId: varchar("created_by_agent_id").references(() => users.id),
  billerId: varchar("biller_id").references(() => bbpsBillers.id).notNull(),
  customerParam: varchar("customer_param").notNull(), // Consumer number, account number, etc.
  billAmount: varchar("bill_amount"), // Bill amount in paise
  dueDate: varchar("due_date"), // Bill due date
  billDate: varchar("bill_date"), // Bill generation date
  billPeriod: varchar("bill_period"), // Billing period
  billFetchStatus: varchar("bill_fetch_status").default("PENDING"), // PENDING, SUCCESS, FAILED
  billData: text("bill_data"), // JSON string of bill details
  fetchedAt: timestamp("fetched_at"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const bbpsTransactions = pgTable("bbps_transactions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id),
  
  // Prospect support - for goals created by agents before user registration
  prospectId: varchar("prospect_id"),
  createdByAgentId: varchar("created_by_agent_id").references(() => users.id),
  billId: varchar("bill_id").references(() => bbpsCustomerBills.id),
  billerCode: varchar("biller_code").notNull(),
  customerParam: varchar("customer_param").notNull(),
  amount: varchar("amount").notNull(), // Amount in rupees (for Cashfree integration)
  paymentAmount: varchar("payment_amount").notNull(), // Amount in paise (for BBPS API)
  transactionId: varchar("transaction_id").unique(), // Our internal transaction ID
  bbpsTransactionId: varchar("bbps_transaction_id"), // BBPS network transaction ID
  cashfreeOrderId: varchar("cashfree_order_id"), // Cashfree payment order ID
  paymentStatus: varchar("payment_status").default("PENDING"), // PENDING, SUCCESS, FAILED, INITIATED
  paymentMode: varchar("payment_mode"), // UPI, NETBANKING, DEBITCARD, etc.
  transactionReference: varchar("transaction_reference"), // Bank reference number
  failureReason: text("failure_reason"),
  commissionAmount: varchar("commission_amount"), // Commission earned
  settlementDate: timestamp("settlement_date"),
  receiptData: text("receipt_data"), // JSON string of receipt details
  initiatedAt: timestamp("initiated_at"),
  completedAt: timestamp("completed_at"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// ============================================================================
// PAYMENT GATEWAY INFRASTRUCTURE
// ============================================================================

// Cashfree Payment Transactions table
export const cashfreeTransactions = pgTable("cashfree_transactions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id),
  
  // Prospect support - for goals created by agents before user registration
  prospectId: varchar("prospect_id"),
  createdByAgentId: varchar("created_by_agent_id").references(() => users.id),
  
  // Transaction Identification
  orderId: varchar("order_id").notNull().unique(), // Our generated order ID
  cashfreeOrderId: varchar("cashfree_order_id"), // Cashfree's transaction ID
  paymentSessionId: varchar("payment_session_id"), // Cashfree payment session ID
  
  // Amount Details
  amount: decimal("amount", { precision: 15, scale: 2 }).notNull(), // Amount in rupees
  currency: varchar("currency").default("INR"),
  
  // Payment Details
  paymentMethod: varchar("payment_method"), // UPI, CARD, NET_BANKING, WALLET
  paymentInstrumentType: varchar("payment_instrument_type"), // Specific instrument type
  
  // User Information
  customerId: varchar("customer_id"), // Cashfree customer ID
  mobileNumber: varchar("mobile_number"),
  customerName: varchar("customer_name"),
  customerEmail: varchar("customer_email"),
  
  // Transaction Status
  status: varchar("status").default("PENDING").notNull(), // PENDING, SUCCESS, FAILED, ACTIVE
  orderStatus: varchar("order_status"), // Cashfree order status
  responseMessage: text("response_message"), // Cashfree response message
  
  // URLs and Redirects
  returnUrl: text("return_url"),
  paymentUrl: text("payment_url"), // Cashfree payment page URL
  
  // Related Entities
  cartId: varchar("cart_id").references(() => userCart.id), // If payment for cart checkout
  itemType: varchar("item_type"), // mutual_fund, product, proposal, loan
  itemId: varchar("item_id"), // ID of the item being purchased
  
  // Cashfree Gateway Response
  gatewayResponse: jsonb("gateway_response"), // Full response from Cashfree
  
  // Metadata
  metadata: jsonb("metadata"), // Additional transaction data
  failureReason: text("failure_reason"),
  retryCount: integer("retry_count").default(0),
  
  // Timestamps
  initiatedAt: timestamp("initiated_at").defaultNow(),
  completedAt: timestamp("completed_at"),
  callbackReceivedAt: timestamp("callback_received_at"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// PhonePe Payment Transactions table
export const phonePeTransactions = pgTable("phonepe_transactions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id),
  
  // Prospect support - for goals created by agents before user registration
  prospectId: varchar("prospect_id"),
  createdByAgentId: varchar("created_by_agent_id").references(() => users.id),
  
  // Transaction Identification
  orderId: varchar("order_id").notNull().unique(), // Our generated order ID
  merchantTransactionId: varchar("merchant_transaction_id").notNull().unique(), // PhonePe merchant transaction ID
  transactionId: varchar("transaction_id"), // PhonePe's internal transaction ID
  
  // Amount Details
  amount: decimal("amount", { precision: 15, scale: 2 }).notNull(), // Amount in rupees
  currency: varchar("currency").default("INR"),
  
  // Payment Details
  paymentMethod: varchar("payment_method"), // UPI, CARD, NET_BANKING, WALLET
  paymentInstrumentType: varchar("payment_instrument_type"), // Specific instrument type
  
  // Status Tracking
  status: varchar("status").default("initiated").notNull(), 
  // possible values: 'initiated', 'pending', 'success', 'failed', 'cancelled'
  state: varchar("state"), // PhonePe state: COMPLETED, FAILED, PENDING
  responseCode: varchar("response_code"), // PhonePe response code
  
  // Customer Details
  customerName: varchar("customer_name"),
  customerEmail: varchar("customer_email"),
  customerPhone: varchar("customer_phone"),
  
  // URLs
  redirectUrl: text("redirect_url"),
  callbackUrl: text("callback_url"),
  paymentUrl: text("payment_url"), // PhonePe payment page URL
  
  // Related Entities
  cartId: varchar("cart_id").references(() => userCart.id), // If payment for cart checkout
  itemType: varchar("item_type"), // mutual_fund, product, proposal, loan
  itemId: varchar("item_id"), // ID of the item being purchased
  
  // PhonePe Gateway Response
  gatewayResponse: jsonb("gateway_response"), // Full response from PhonePe
  
  // Metadata
  metadata: jsonb("metadata"), // Additional transaction data
  failureReason: text("failure_reason"),
  retryCount: integer("retry_count").default(0),
  
  // Timestamps
  initiatedAt: timestamp("initiated_at").defaultNow(),
  completedAt: timestamp("completed_at"),
  callbackReceivedAt: timestamp("callback_received_at"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Payment Idempotency Keys - Prevent duplicate payment orders
export const paymentIdempotencyKeys = pgTable("payment_idempotency_keys", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  idempotencyKey: varchar("idempotency_key").notNull(),
  userId: varchar("user_id").references(() => users.id).notNull(),
  orderId: varchar("order_id").notNull(),
  gateway: varchar("gateway").notNull(), // 'cashfree' | 'phonepe'
  responsePayload: jsonb("response_payload").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  expiresAt: timestamp("expires_at").notNull(),
}, (table) => [
  uniqueIndex("idx_payment_idempotency_scope").on(table.userId, table.idempotencyKey),
  index("idx_payment_idempotency_expires").on(table.expiresAt),
]);

// ============================================================================
// INFRASTRUCTURE LOGS & MONITORING
// ============================================================================

// Webhook Logs - Track all incoming webhooks from payment gateways and services
export const webhookLogs = pgTable("webhook_logs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  
  // Webhook source
  provider: varchar("provider").notNull(), // cashfree, phonepe, zoho, stripe, etc.
  eventType: varchar("event_type").notNull(), // payment_success, order_created, etc.
  
  // Request details
  method: varchar("method").default("POST"),
  endpoint: varchar("endpoint").notNull(),
  headers: jsonb("headers"),
  payload: jsonb("payload").notNull(),
  
  // Response details
  statusCode: integer("status_code"),
  responseBody: jsonb("response_body"),
  responseTime: integer("response_time"), // milliseconds
  
  // Processing details
  processingStatus: varchar("processing_status").default("pending"), // pending, success, failed, retry
  processingError: text("processing_error"),
  retryCount: integer("retry_count").default(0),
  
  // Verification
  signatureVerified: boolean("signature_verified").default(false),
  ipAddress: varchar("ip_address"),
  
  // Related data
  orderId: varchar("order_id"),
  transactionId: varchar("transaction_id"),
  userId: varchar("user_id"),
  
  // Timestamps
  receivedAt: timestamp("received_at").defaultNow(),
  processedAt: timestamp("processed_at"),
}, (table) => [
  index("idx_webhook_logs_provider").on(table.provider),
  index("idx_webhook_logs_event").on(table.eventType),
  index("idx_webhook_logs_status").on(table.processingStatus),
  index("idx_webhook_logs_received").on(table.receivedAt),
]);

// API Usage Logs - Track outbound API calls to 3rd party services
export const apiUsageLogs = pgTable("api_usage_logs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  
  // API details
  provider: varchar("provider").notNull(), // cashfree, phonepe, gemini, twilio, etc.
  apiEndpoint: varchar("api_endpoint").notNull(),
  apiMethod: varchar("api_method").default("GET"),
  
  // Request details
  requestHeaders: jsonb("request_headers"),
  requestBody: jsonb("request_body"),
  
  // Response details
  statusCode: integer("status_code"),
  responseBody: jsonb("response_body"),
  responseTime: integer("response_time"), // milliseconds
  
  // Status and error tracking
  status: varchar("status").default("pending"), // success, error, timeout
  errorMessage: text("error_message"),
  errorCode: varchar("error_code"),
  
  // Usage tracking
  userId: varchar("user_id"),
  feature: varchar("feature"), // payment, kyc, sms, ai_chat, etc.
  
  // Cost tracking (for paid APIs)
  estimatedCost: decimal("estimated_cost", { precision: 10, scale: 4 }),
  currency: varchar("currency").default("USD"),
  
  // Timestamps
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("idx_api_usage_provider").on(table.provider),
  index("idx_api_usage_status").on(table.status),
  index("idx_api_usage_feature").on(table.feature),
  index("idx_api_usage_created").on(table.createdAt),
]);

// Integration Health - Track health and status of all integrations
export const integrationHealth = pgTable("integration_health", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  
  // Integration details
  provider: varchar("provider").notNull().unique(), // cashfree, phonepe, gemini, twilio, etc.
  displayName: varchar("display_name").notNull(),
  category: varchar("category").notNull(), // payment, kyc, communication, ai, etc.
  
  // Status
  status: varchar("status").default("active"), // active, degraded, down, maintenance
  lastCheckedAt: timestamp("last_checked_at"),
  
  // Health metrics
  uptime: decimal("uptime", { precision: 5, scale: 2 }).default("100"), // percentage
  avgResponseTime: integer("avg_response_time"), // milliseconds
  errorRate: decimal("error_rate", { precision: 5, scale: 2 }).default("0"), // percentage
  
  // API usage stats (24h rolling window)
  totalRequests24h: integer("total_requests_24h").default(0),
  successfulRequests24h: integer("successful_requests_24h").default(0),
  failedRequests24h: integer("failed_requests_24h").default(0),
  
  // Configuration
  isEnabled: boolean("is_enabled").default(true),
  hasApiKey: boolean("has_api_key").default(false),
  hasWebhook: boolean("has_webhook").default(false),
  webhookUrl: varchar("webhook_url"),
  
  // Alerts
  alertsEnabled: boolean("alerts_enabled").default(true),
  alertThreshold: integer("alert_threshold").default(90), // error rate threshold
  lastAlertSent: timestamp("last_alert_sent"),
  
  // Metadata
  metadata: jsonb("metadata"),
  
  // Timestamps
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("idx_integration_health_status").on(table.status),
  index("idx_integration_health_category").on(table.category),
]);

// ============================================================================
// REMITTANCE & GLOBAL BANKING (LRS)
// ============================================================================

// LRS Transactions - Individual remittance records
export const lrsTransactions = pgTable("lrs_transactions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id),
  
  // Prospect support - for goals created by agents before user registration
  prospectId: varchar("prospect_id"),
  createdByAgentId: varchar("created_by_agent_id").references(() => users.id),
  trackingId: varchar("tracking_id").references(() => lrsComplianceTracking.id).notNull(),
  transactionDate: date("transaction_date").notNull(),
  amountUsd: numeric("amount_usd").notNull(),
  amountInr: numeric("amount_inr").notNull(),
  exchangeRate: numeric("exchange_rate").notNull(),
  purpose: varchar("purpose", { length: 50 }).notNull(), // investment, education, travel, medical, maintenance
  purposeCode: varchar("purpose_code", { length: 10 }), // RBI purpose code
  beneficiaryName: varchar("beneficiary_name", { length: 255 }),
  beneficiaryCountry: varchar("beneficiary_country", { length: 50 }),
  beneficiaryBank: varchar("beneficiary_bank", { length: 255 }),
  adBankName: varchar("ad_bank_name", { length: 255 }), // Authorized Dealer bank
  adBankBranch: varchar("ad_bank_branch", { length: 255 }),
  swiftReference: varchar("swift_reference", { length: 50 }),
  form15caNumber: varchar("form15ca_number", { length: 50 }),
  form15cbNumber: varchar("form15cb_number", { length: 50 }),
  tcsRate: numeric("tcs_rate"), // Tax collected at source
  tcsAmount: numeric("tcs_amount"),
  status: varchar("status", { length: 20 }).default("completed"), // pending, completed, failed, reversed
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  index("idx_lrs_tx_user").on(table.userId),
  index("idx_lrs_tx_tracking").on(table.trackingId),
  index("idx_lrs_tx_date").on(table.transactionDate),
]);

// ============================================================================
// ZOD SCHEMAS
// ============================================================================

// BBPS Zod schemas
export const insertBbpsCategorySchema = createInsertSchema(bbpsCategories).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertBbpsBillerSchema = createInsertSchema(bbpsBillers).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertBbpsCustomerBillSchema = createInsertSchema(bbpsCustomerBills).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertBbpsTransactionSchema = createInsertSchema(bbpsTransactions).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

// Cashfree Transaction Insert Schema
export const insertCashfreeTransactionSchema = createInsertSchema(cashfreeTransactions).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  initiatedAt: true,
});

// PhonePe Transaction Insert Schema
export const insertPhonePeTransactionSchema = createInsertSchema(phonePeTransactions).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  initiatedAt: true,
});

export const insertPaymentIdempotencyKeySchema = createInsertSchema(paymentIdempotencyKeys).omit({
  id: true,
  createdAt: true,
});

export const insertWebhookLogSchema = createInsertSchema(webhookLogs).omit({
  id: true,
  receivedAt: true,
  processedAt: true,
});

export const insertApiUsageLogSchema = createInsertSchema(apiUsageLogs).omit({
  id: true,
  createdAt: true,
});

export const insertIntegrationHealthSchema = createInsertSchema(integrationHealth).omit({
  id: true,
  lastCheckedAt: true,
  createdAt: true,
  updatedAt: true,
});

export const insertLrsTransactionSchema = createInsertSchema(lrsTransactions).omit({ 
  id: true, 
  createdAt: true 
});

// ============================================================================
// TYPES
// ============================================================================

// BBPS types
export type BbpsCategory = typeof bbpsCategories.$inferSelect;
export type InsertBbpsCategory = z.infer<typeof insertBbpsCategorySchema>;
export type BbpsBiller = typeof bbpsBillers.$inferSelect;
export type InsertBbpsBiller = z.infer<typeof insertBbpsBillerSchema>;
export type BbpsCustomerBill = typeof bbpsCustomerBills.$inferSelect;
export type InsertBbpsCustomerBill = z.infer<typeof insertBbpsCustomerBillSchema>;
export type BbpsTransaction = typeof bbpsTransactions.$inferSelect;
export type InsertBbpsTransaction = z.infer<typeof insertBbpsTransactionSchema>;

// Payment types
export type CashfreeTransaction = typeof cashfreeTransactions.$inferSelect;
export type InsertCashfreeTransaction = z.infer<typeof insertCashfreeTransactionSchema>;
export type PhonePeTransaction = typeof phonePeTransactions.$inferSelect;
export type InsertPhonePeTransaction = z.infer<typeof insertPhonePeTransactionSchema>;
export type PaymentIdempotencyKey = typeof paymentIdempotencyKeys.$inferSelect;
export type InsertPaymentIdempotencyKey = z.infer<typeof insertPaymentIdempotencyKeySchema>;

// Log types
export type WebhookLog = typeof webhookLogs.$inferSelect;
export type InsertWebhookLog = z.infer<typeof insertWebhookLogSchema>;
export type ApiUsageLog = typeof apiUsageLogs.$inferSelect;
export type InsertApiUsageLog = z.infer<typeof insertApiUsageLogSchema>;
export type IntegrationHealth = typeof integrationHealth.$inferSelect;
export type InsertIntegrationHealth = z.infer<typeof insertIntegrationHealthSchema>;

// LRS types
export type LrsTransaction = typeof lrsTransactions.$inferSelect;
export type InsertLrsTransaction = z.infer<typeof insertLrsTransactionSchema>;
