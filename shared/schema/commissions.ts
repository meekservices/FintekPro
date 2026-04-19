import { sql } from "drizzle-orm";
import { pgTable, text, varchar, decimal, timestamp, jsonb, boolean, index, uniqueIndex, integer, date, uuid } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { users } from "./users";
import { prospectClients } from "./proposals-base";

export const amfiVerificationLog = pgTable("amfi_verification_log", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  agentId: varchar("agent_id").references(() => customerCareAgents.id),
  
  // Verification Details
  verificationType: varchar("verification_type").notNull(), // arn_verification, euin_verification, distributor_details
  arnCode: varchar("arn_code"),
  euinNumber: varchar("euin_number"),
  
  // API Response
  apiRequest: jsonb("api_request"), // Request payload
  apiResponse: jsonb("api_response"), // Response from AMFI
  verificationStatus: varchar("verification_status").notNull(), // success, failed, error
  errorMessage: text("error_message"),
  
  // Extracted Data
  distributorName: varchar("distributor_name"),
  distributorStatus: varchar("distributor_status"), // active, inactive, suspended
  arnExpiryDate: timestamp("arn_expiry_date"),
  registrationDate: timestamp("registration_date"),
  
  // Audit
  verifiedBy: varchar("verified_by").references(() => users.id),
  ipAddress: varchar("ip_address"),
  userAgent: text("user_agent"),
  
  createdAt: timestamp("created_at").defaultNow(),
});

export const commissionConfig = pgTable("commission_config", {
  configId: varchar("config_id").primaryKey().default(sql`gen_random_uuid()`),
  productType: varchar("product_type").notNull(),
  agentPct: decimal("agent_pct", { precision: 5, scale: 2 }).notNull().default("70.00"),
  platformPct: decimal("platform_pct", { precision: 5, scale: 2 }).notNull().default("15.00"),
  uplineIncentivePct: decimal("upline_incentive_pct", { precision: 5, scale: 2 }).notNull().default("5.00"),
  minResidualThreshold: decimal("min_residual_threshold", { precision: 10, scale: 2 }).notNull().default("1.00"),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
});

export const progressiveCommissionLedger = pgTable("progressive_commission_ledger", {
  ledgerId: varchar("ledger_id").primaryKey().default(sql`gen_random_uuid()`),
  transactionId: varchar("transaction_id").notNull(),
  partnerId: varchar("partner_id"),
  role: varchar("role").notNull(),
  levelOffset: integer("level_offset"),
  amount: decimal("amount", { precision: 12, scale: 2 }).notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const commissionExecution = pgTable("commission_execution", {
  transactionId: varchar("transaction_id").primaryKey(),
  executedAt: timestamp("executed_at").defaultNow(),
});

export const disputeCases = pgTable("dispute_cases", {
  disputeId: varchar("dispute_id").primaryKey().default(sql`gen_random_uuid()`),
  transactionId: varchar("transaction_id").notNull(),
  raisedByPartnerId: varchar("raised_by_partner_id").notNull(),
  status: varchar("status", { length: 20 }).notNull().default("OPEN"),
  reasonCode: varchar("reason_code", { length: 100 }).notNull(),
  description: text("description"),
  resolvedBy: varchar("resolved_by"),
  resolutionNotes: text("resolution_notes"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const reversalLedger = pgTable("reversal_ledger", {
  reversalId: varchar("reversal_id").primaryKey().default(sql`gen_random_uuid()`),
  originalLedgerId: varchar("original_ledger_id").notNull(),
  transactionId: varchar("transaction_id").notNull(),
  partnerId: varchar("partner_id"),
  reversalAmount: decimal("reversal_amount", { precision: 12, scale: 2 }).notNull(),
  reversalType: varchar("reversal_type", { length: 30 }).notNull().default("FULL"),
  walletDebited: boolean("wallet_debited").default(false),
  negativeCarryForward: decimal("negative_carry_forward", { precision: 12, scale: 2 }).default("0.00"),
  disputeId: varchar("dispute_id"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertCommissionConfigSchema = createInsertSchema(commissionConfig).omit({
  configId: true,
  createdAt: true,
});
export type InsertCommissionConfig = z.infer<typeof insertCommissionConfigSchema>;
export type CommissionConfig = typeof commissionConfig.$inferSelect;

export const insertProgressiveCommissionLedgerSchema = createInsertSchema(progressiveCommissionLedger).omit({
  ledgerId: true,
  createdAt: true,
});
export type InsertProgressiveCommissionLedger = z.infer<typeof insertProgressiveCommissionLedgerSchema>;
export type ProgressiveCommissionLedger = typeof progressiveCommissionLedger.$inferSelect;

export const insertCommissionExecutionSchema = createInsertSchema(commissionExecution).omit({
  executedAt: true,
});
export type InsertCommissionExecution = z.infer<typeof insertCommissionExecutionSchema>;
export type CommissionExecution = typeof commissionExecution.$inferSelect;

export const insertDisputeCaseSchema = createInsertSchema(disputeCases).omit({
  disputeId: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertDisputeCase = z.infer<typeof insertDisputeCaseSchema>;
export type DisputeCase = typeof disputeCases.$inferSelect;

export const insertReversalLedgerSchema = createInsertSchema(reversalLedger).omit({
  reversalId: true,
  createdAt: true,
});
export type InsertReversalLedger = z.infer<typeof insertReversalLedgerSchema>;
export type ReversalLedger = typeof reversalLedger.$inferSelect;

export const insertAmfiVerificationLogSchema = createInsertSchema(amfiVerificationLog).omit({
  id: true,
  createdAt: true,
});
export type InsertAmfiVerificationLog = z.infer<typeof insertAmfiVerificationLogSchema>;
export type AmfiVerificationLog = typeof amfiVerificationLog.$inferSelect;

