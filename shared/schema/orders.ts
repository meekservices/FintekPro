import { sql } from "drizzle-orm";
import { pgTable, text, varchar, timestamp, boolean, index, integer, jsonb, decimal, date } from "drizzle-orm/pg-core";
import { users } from "./users";
import { portfolios } from "./portfolio";
import { investmentProposals } from "./proposals-base";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { usBrokerAccounts } from '../schema';


// ===== BOND ORDERS =====
export const bondOrders = pgTable("bond_orders", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  orderNumber: varchar("order_number").notNull().unique(),
  userId: varchar("user_id").references(() => users.id),
  prospectId: varchar("prospect_id"),
  createdByAgentId: varchar("created_by_agent_id").references(() => users.id),
  clientCode: varchar("client_code"),
  bondId: varchar("bond_id"),
  bondType: varchar("bond_type").notNull(),
  isin: varchar("isin").notNull(),
  bondName: text("bond_name").notNull(),
  orderType: varchar("order_type").notNull(),
  orderCategory: varchar("order_category").notNull(),
  quantity: integer("quantity").notNull(),
  faceValue: decimal("face_value", { precision: 15, scale: 2 }).notNull(),
  totalFaceValue: decimal("total_face_value", { precision: 15, scale: 2 }).notNull(),
  orderPrice: decimal("order_price", { precision: 15, scale: 4 }),
  limitPrice: decimal("limit_price", { precision: 15, scale: 4 }),
  grossAmount: decimal("gross_amount", { precision: 15, scale: 2 }).notNull(),
  accruedInterest: decimal("accrued_interest", { precision: 15, scale: 4 }).default("0"),
  netAmount: decimal("net_amount", { precision: 15, scale: 2 }).notNull(),
  orderStatus: varchar("order_status").default("pending"),
  executionPrice: decimal("execution_price", { precision: 15, scale: 4 }),
  executionDate: timestamp("execution_date"),
  settlementDate: date("settlement_date"),
  exchangeOrderId: varchar("exchange_order_id"),
  exchangeTransactionId: varchar("exchange_transaction_id"),
  exchange: varchar("exchange").default("bse"),
  paymentStatus: varchar("payment_status").default("pending"),
  paymentMethod: varchar("payment_method"),
  paymentReference: varchar("payment_reference"),
  paymentUrl: text("payment_url"),
  dematAccountId: varchar("demat_account_id"),
  dematAccountNumber: varchar("demat_account_number"),
  kycLevel: varchar("kyc_level"),
  kycValidated: boolean("kyc_validated").default(false),
  inventorySale: boolean("inventory_sale").default(false),
  purchaseCost: decimal("purchase_cost", { precision: 15, scale: 2 }),
  totalPurchaseCost: decimal("total_purchase_cost", { precision: 15, scale: 2 }),
  inventoryItemId: varchar("inventory_item_id"),
  profitMargin: decimal("profit_margin", { precision: 15, scale: 2 }),
  brokerageFee: decimal("brokerage_fee", { precision: 15, scale: 2 }),
  brokerageRate: decimal("brokerage_rate", { precision: 8, scale: 4 }),
  zohoInvoiceId: varchar("zoho_invoice_id"),
  zohoExpenseId: varchar("zoho_expense_id"),
  zohoSyncedAt: timestamp("zoho_synced_at"),
  zohoSyncStatus: varchar("zoho_sync_status", { length: 50 }),
  orderPlacedBy: varchar("order_placed_by"),
  remarks: text("remarks"),
  orderDate: timestamp("order_date").defaultNow(),
  lastUpdated: timestamp("last_updated").defaultNow(),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("idx_bond_orders_user_id").on(table.userId),
  index("idx_bond_orders_status").on(table.orderStatus),
  index("idx_bond_orders_date").on(table.orderDate),
  index("idx_bond_orders_inventory").on(table.inventorySale),
]);

// ===== UNIFIED ORDERS =====
export const unifiedOrders = pgTable("unified_orders", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  orderNumber: varchar("order_number").notNull().unique(),
  userId: varchar("user_id").references(() => users.id),
  prospectId: varchar("prospect_id"),
  createdByAgentId: varchar("created_by_agent_id").references(() => users.id),
  productType: varchar("product_type").notNull(),
  productId: varchar("product_id"),
  productName: text("product_name").notNull(),
  orderType: varchar("order_type").notNull(),
  quantity: decimal("quantity", { precision: 18, scale: 4 }),
  amount: decimal("amount", { precision: 18, scale: 2 }).notNull(),
  currency: varchar("currency").default("INR"),
  cartId: varchar("cart_id"),
  proposalId: varchar("proposal_id").references(() => investmentProposals.id),
  portfolioId: varchar("portfolio_id").references(() => portfolios.id),
  status: varchar("status").notNull().default("initiated"),
  paymentStatus: varchar("payment_status").default("pending"),
  paymentGateway: varchar("payment_gateway"),
  paymentTransactionId: varchar("payment_transaction_id"),
  paymentAmount: decimal("payment_amount", { precision: 18, scale: 2 }),
  paymentCompletedAt: timestamp("payment_completed_at"),
  kycStatus: varchar("kyc_status").default("pending"),
  kycTier: varchar("kyc_tier"),
  kycVerifiedAt: timestamp("kyc_verified_at"),
  kycRejectionReason: text("kyc_rejection_reason"),
  executionStatus: varchar("execution_status").default("pending"),
  externalOrderId: varchar("external_order_id"),
  externalReference: varchar("external_reference"),
  executionPrice: decimal("execution_price", { precision: 18, scale: 6 }),
  executedQuantity: decimal("executed_quantity", { precision: 18, scale: 4 }),
  executedAt: timestamp("executed_at"),
  executionError: text("execution_error"),
  settlementStatus: varchar("settlement_status").default("pending"),
  settlementDate: timestamp("settlement_date"),
  settlementReference: varchar("settlement_reference"),
  metadata: jsonb("metadata"),
  notes: text("notes"),
  cancellationReason: text("cancellation_reason"),
  createdBy: varchar("created_by").references(() => users.id),
  assignedTo: varchar("assigned_to").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
  completedAt: timestamp("completed_at"),
  cancelledAt: timestamp("cancelled_at"),
}, (table) => [
  index("idx_unified_orders_user").on(table.userId),
  index("idx_unified_orders_status").on(table.status),
  index("idx_unified_orders_product_type").on(table.productType),
  index("idx_unified_orders_payment_status").on(table.paymentStatus),
  index("idx_unified_orders_execution_status").on(table.executionStatus),
  index("idx_unified_orders_created_at").on(table.createdAt),
  index("idx_unified_orders_order_number").on(table.orderNumber),
]);

export const orderRefunds = pgTable("order_refunds", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  orderId: varchar("order_id").references(() => unifiedOrders.id).notNull(),
  amount: decimal("amount", { precision: 18, scale: 2 }).notNull(),
  reason: text("reason").notNull(),
  status: varchar("status").notNull().default("pending"),
  gatewayRefundId: varchar("gateway_refund_id"),
  initiatedBy: varchar("initiated_by").notNull(),
  processedAt: timestamp("processed_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const orderLifecycleEvents = pgTable("order_lifecycle_events", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  orderId: varchar("order_id").references(() => unifiedOrders.id).notNull(),
  eventType: varchar("event_type").notNull(),
  eventName: varchar("event_name").notNull(),
  eventDescription: text("event_description"),
  previousState: jsonb("previous_state"),
  newState: jsonb("new_state"),
  actorId: varchar("actor_id").references(() => users.id),
  actorType: varchar("actor_type"),
  metadata: jsonb("metadata"),
  isSystemGenerated: boolean("is_system_generated").default(true),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("idx_order_events_order").on(table.orderId),
  index("idx_order_events_type").on(table.eventType),
  index("idx_order_events_created").on(table.createdAt),
]);

export const orderDocuments = pgTable("order_documents", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  orderId: varchar("order_id").references(() => unifiedOrders.id).notNull(),
  documentType: varchar("document_type").notNull(),
  documentName: text("document_name").notNull(),
  documentUrl: text("document_url"),
  fileSize: integer("file_size"),
  mimeType: varchar("mime_type"),
  status: varchar("status").default("generated"),
  sentToClient: boolean("sent_to_client").default(false),
  sentAt: timestamp("sent_at"),
  requiresSignature: boolean("requires_signature").default(false),
  signedBy: varchar("signed_by").references(() => users.id),
  signedAt: timestamp("signed_at"),
  signatureHash: varchar("signature_hash"),
  metadata: jsonb("metadata"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("idx_order_documents_order").on(table.orderId),
  index("idx_order_documents_type").on(table.documentType),
  index("idx_order_documents_status").on(table.status),
]);

// ===== REIT/InvIT ORDERS =====
export const reitInvitOrders = pgTable("reit_invit_orders", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id),
  prospectId: varchar("prospect_id"),
  createdByAgentId: varchar("created_by_agent_id").references(() => users.id),
  assetType: varchar("asset_type").notNull(),
  assetId: varchar("asset_id").notNull(),
  symbol: varchar("symbol").notNull(),
  assetName: text("asset_name"),
  orderType: varchar("order_type").notNull(),
  transactionType: varchar("transaction_type").default("market"),
  quantity: integer("quantity").notNull(),
  pricePerUnit: decimal("price_per_unit", { precision: 15, scale: 4 }),
  totalAmount: decimal("total_amount", { precision: 15, scale: 2 }),
  status: varchar("status").default("pending"),
  executedQuantity: integer("executed_quantity"),
  executedPrice: decimal("executed_price", { precision: 15, scale: 4 }),
  executedAt: timestamp("executed_at"),
  paymentStatus: varchar("payment_status").default("pending"),
  paymentReference: varchar("payment_reference"),
  settlementDate: timestamp("settlement_date"),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("idx_reit_invit_orders_user").on(table.userId),
  index("idx_reit_invit_orders_asset").on(table.assetType, table.assetId),
  index("idx_reit_invit_orders_status").on(table.status),
]);

// ===== US ORDERS =====
export const usOrders = pgTable("us_orders", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  clientId: varchar("client_id").references(() => users.id).notNull(),
  brokerAccountId: varchar("broker_account_id"), // usBrokerAccounts not imported to avoid circularity if possible, or use raw string if needed
  recommendationId: varchar("recommendation_id"),
  symbol: varchar("symbol", { length: 10 }).notNull(),
  side: varchar("side", { length: 10 }).notNull(),
  orderType: varchar("order_type", { length: 20 }).default("market").notNull(),
  timeInForce: varchar("time_in_force", { length: 10 }).default("day").notNull(),
  quantity: decimal("quantity", { precision: 15, scale: 6 }),
  notionalUsd: decimal("notional_usd", { precision: 15, scale: 2 }),
  limitPrice: decimal("limit_price", { precision: 15, scale: 4 }),
  stopPrice: decimal("stop_price", { precision: 15, scale: 4 }),
  filledQuantity: decimal("filled_quantity", { precision: 15, scale: 6 }).default("0"),
  avgFillPrice: decimal("avg_fill_price", { precision: 15, scale: 4 }),
  status: varchar("status", { length: 20 }).default("pending").notNull(),
  alpacaOrderId: varchar("alpaca_order_id"),
  alpacaClientOrderId: varchar("alpaca_client_order_id"),
  fxRateUsdInr: decimal("fx_rate_usd_inr", { precision: 10, scale: 4 }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  submittedAt: timestamp("submitted_at"),
  filledAt: timestamp("filled_at"),
  cancelledAt: timestamp("cancelled_at"),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("idx_us_orders_client").on(table.clientId),
  index("idx_us_orders_symbol").on(table.symbol),
  index("idx_us_orders_status").on(table.status),
  index("idx_us_orders_alpaca_id").on(table.alpacaOrderId),
]);

export const ReitInvitOrderTypeEnum = z.enum(['buy', 'sell']);
export const ReitInvitOrderStatusEnum = z.enum(['pending', 'confirmed', 'executed', 'cancelled', 'failed']);

// Zod Schemas
export const insertBondOrderSchema = createInsertSchema(bondOrders).extend({
  id: z.any(),
  createdAt: z.any(),
  orderDate: z.any(),
}).omit({
  id: true,
  createdAt: true,
  orderDate: true,
});

export const insertUnifiedOrderSchema = createInsertSchema(unifiedOrders).extend({
  id: z.any(),
  createdAt: z.any(),
  updatedAt: z.any(),
  completedAt: z.any(),
  cancelledAt: z.any(),
}).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  completedAt: true,
  cancelledAt: true,
});

export const insertOrderLifecycleEventSchema = createInsertSchema(orderLifecycleEvents).extend({
  id: z.any(),
  createdAt: z.any(),
}).omit({
  id: true,
  createdAt: true,
});

export const insertOrderDocumentSchema = createInsertSchema(orderDocuments).extend({
  id: z.any(),
  createdAt: z.any(),
  updatedAt: z.any(),
}).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertReitInvitOrderSchema = createInsertSchema(reitInvitOrders).extend({
  id: z.any(),
  createdAt: z.any(),
  updatedAt: z.any(),
}).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertUsOrderSchema = createInsertSchema(usOrders).extend({
  id: z.any(),
  createdAt: z.any(),
  updatedAt: z.any(),
}).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

// Types
export type BondOrder = typeof bondOrders.$inferSelect;
export type InsertBondOrder = z.infer<typeof insertBondOrderSchema>;
export type UnifiedOrder = typeof unifiedOrders.$inferSelect;
export type InsertUnifiedOrder = z.infer<typeof insertUnifiedOrderSchema>;
export type ReitInvitOrder = typeof reitInvitOrders.$inferSelect;
export type InsertReitInvitOrder = z.infer<typeof insertReitInvitOrderSchema>;
export type UsOrder = typeof usOrders.$inferSelect;
export type InsertUsOrder = z.infer<typeof insertUsOrderSchema>;
export type OrderRefund = typeof orderRefunds.$inferSelect;
export type OrderLifecycleEvent = typeof orderLifecycleEvents.$inferSelect;
export type InsertOrderLifecycleEvent = z.infer<typeof insertOrderLifecycleEventSchema>;
export type OrderDocument = typeof orderDocuments.$inferSelect;
export type InsertOrderDocument = z.infer<typeof insertOrderDocumentSchema>;
