import { sql } from "drizzle-orm";
import { pgTable, text, varchar, timestamp, boolean, index, integer, jsonb, decimal, date, serial, real, uniqueIndex } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { agents } from './agents';
import { users } from './users';

// --- Auto-Migrated Tables ---
export const insuranceHoldings = pgTable("insurance_holdings", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id),
  
  // Prospect support - for goals created by agents before user registration
  prospectId: varchar("prospect_id"),
  createdByAgentId: varchar("created_by_agent_id").references(() => users.id),
  
  // Policy Information
  policyNumber: varchar("policy_number").notNull(),
  policyName: varchar("policy_name").notNull(),
  insuranceCompany: varchar("insurance_company").notNull(),
  policyType: varchar("policy_type").notNull(), // life, health, motor, general
  category: varchar("category").notNull(), // traditional, ulip, term, health, motor
  
  // Coverage and Premium Details
  sumAssured: decimal("sum_assured", { precision: 15, scale: 2 }).notNull(),
  premiumAmount: decimal("premium_amount", { precision: 15, scale: 2 }).notNull(),
  premiumFrequency: varchar("premium_frequency").default("yearly"), // monthly, quarterly, half_yearly, yearly
  fundValue: decimal("fund_value", { precision: 15, scale: 2 }), // For ULIP policies
  
  // Policy Dates
  policyStartDate: date("policy_start_date").notNull(),
  policyMaturityDate: date("policy_maturity_date"),
  premiumDueDate: date("premium_due_date"),
  lastPremiumPaidDate: date("last_premium_paid_date"),
  
  // Depository Information
  depositoryName: varchar("depository_name").notNull(), // NSDL or CDSL
  depositoryAccountNumber: varchar("depository_account_number"),
  isinNumber: varchar("isin_number"),
  
  // Policy Status
  policyStatus: varchar("policy_status").default("active"), // active, lapsed, matured, surrendered
  paidUpValue: decimal("paid_up_value", { precision: 15, scale: 2 }),
  surrenderValue: decimal("surrender_value", { precision: 15, scale: 2 }),
  
  // Nominee Information
  nomineeDetails: text("nominee_details"),
  nomineeRelation: varchar("nominee_relation"),
  
  // Additional Metadata
  agentCode: varchar("agent_code"),
  branchCode: varchar("branch_code"),
  servicing_branch: varchar("servicing_branch"),
  
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});
