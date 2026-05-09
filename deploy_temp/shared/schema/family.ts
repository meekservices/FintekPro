import { sql } from "drizzle-orm";
import { pgTable, text, varchar, timestamp, boolean, index, integer, jsonb, decimal, date, serial, real, uniqueIndex } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { users } from './users';
import { familyGroups, portfolios } from './portfolio';

export const familyMembers = pgTable("family_members", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  familyId: varchar("family_id").references(() => familyGroups.id).notNull(),
  userId: varchar("user_id").references(() => users.id),
  
  // Prospect support - for goals created by agents before user registration
  prospectId: varchar("prospect_id"),
  createdByAgentId: varchar("created_by_agent_id").references(() => users.id),
  role: varchar("role").default("member"), // owner, admin, member, view_only
  displayName: varchar("display_name"), // How they want to be called in family
  invitationStatus: varchar("invitation_status").default("pending"), // pending, accepted, declined
  invitedBy: varchar("invited_by").references(() => users.id),
  invitedAt: timestamp("invited_at").defaultNow(),
  joinedAt: timestamp("joined_at"),
  leftAt: timestamp("left_at"),
}, (table) => [
  index("idx_family_members_family_id").on(table.familyId),
  index("idx_family_members_user_id").on(table.userId),
]);

export const familyPortfolioPermissions = pgTable("family_portfolio_permissions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  portfolioId: varchar("portfolio_id").references(() => portfolios.id).notNull(),
  familyId: varchar("family_id").references(() => familyGroups.id).notNull(),
  userId: varchar("user_id").references(() => users.id),
  
  // Prospect support - for goals created by agents before user registration
  prospectId: varchar("prospect_id"),
  createdByAgentId: varchar("created_by_agent_id").references(() => users.id),
  permissionLevel: varchar("permission_level").default("view"), // view, contribute, manage, owner
  canViewTransactions: boolean("can_view_transactions").default(true),
  canAddFunds: boolean("can_add_funds").default(false),
  canTrade: boolean("can_trade").default(false),
  canWithdraw: boolean("can_withdraw").default(false),
  grantedAt: timestamp("granted_at").defaultNow(),
  grantedBy: varchar("granted_by").references(() => users.id),
}, (table) => [
  index("idx_family_portfolio_permissions_portfolio").on(table.portfolioId),
  index("idx_family_portfolio_permissions_user").on(table.userId),
]);

// Family Goals - Shared financial goals
export const familyGoals = pgTable("family_goals", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  familyId: varchar("family_id").references(() => familyGroups.id).notNull(),
  goalName: text("goal_name").notNull(),
  goalType: varchar("goal_type").notNull(), // retirement, education, home_purchase, vacation, emergency_fund, debt_payoff
  targetAmount: decimal("target_amount", { precision: 15, scale: 2 }).notNull(),
  currentAmount: decimal("current_amount", { precision: 15, scale: 2 }).default("0"),
  targetDate: date("target_date"),
  priority: varchar("priority").default("medium"), // high, medium, low
  status: varchar("status").default("active"), // active, completed, paused, cancelled
  isShared: boolean("is_shared").default(true), // True for family goals, false for individual within family
  ownerId: varchar("owner_id").references(() => users.id), // Primary owner/creator
  description: text("description"),
  createdAt: timestamp("created_at").defaultNow(),
  completedAt: timestamp("completed_at"),
}, (table) => [
  index("idx_family_goals_family").on(table.familyId),
  index("idx_family_goals_status").on(table.status),
]);

// Family Goal Contributions - Track who contributed what
export const familyGoalContributions = pgTable("family_goal_contributions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  goalId: varchar("goal_id").references(() => familyGoals.id).notNull(),
  userId: varchar("user_id").references(() => users.id),
  
  // Prospect support - for goals created by agents before user registration
  prospectId: varchar("prospect_id"),
  createdByAgentId: varchar("created_by_agent_id").references(() => users.id),
  amount: decimal("amount", { precision: 15, scale: 2 }).notNull(),
  contributionDate: timestamp("contribution_date").defaultNow(),
  note: text("note"),
  contributionType: varchar("contribution_type").default("manual"), // manual, auto, transfer
}, (table) => [
  index("idx_family_goal_contributions_goal").on(table.goalId),
  index("idx_family_goal_contributions_user").on(table.userId),
]);

// Family Activity Log - Audit trail of all family financial activities
export const familyActivityLogs = pgTable("family_activity_logs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  familyId: varchar("family_id").references(() => familyGroups.id).notNull(),
  userId: varchar("user_id").references(() => users.id),
  
  // Prospect support - for goals created by agents before user registration
  prospectId: varchar("prospect_id"),
  createdByAgentId: varchar("created_by_agent_id").references(() => users.id),
  activityType: varchar("activity_type").notNull(), // portfolio_created, goal_added, contribution_made, member_invited, permission_changed, discussion_posted
  entityType: varchar("entity_type"), // portfolio, goal, member, permission, discussion
  entityId: varchar("entity_id"),
  action: text("action").notNull(),
  metadata: jsonb("metadata"), // Additional context like amounts, old/new values
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("idx_family_activity_logs_family").on(table.familyId),
  index("idx_family_activity_logs_type").on(table.activityType),
  index("idx_family_activity_logs_created").on(table.createdAt),
]);

// Family Discussions - Communication for financial decisions
export const familyDiscussions = pgTable("family_discussions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  familyId: varchar("family_id").references(() => familyGroups.id).notNull(),
  topicType: varchar("topic_type").notNull(), // general, goal, portfolio, budget, investment
  topicId: varchar("topic_id"), // Related entity ID (goal, portfolio, etc.)
  subject: text("subject").notNull(),
  authorId: varchar("author_id").references(() => users.id).notNull(),
  content: text("content").notNull(),
  parentMessageId: varchar("parent_message_id").references((): any => familyDiscussions.id), // For threaded replies
  attachments: jsonb("attachments"), // File URLs or references
  isResolved: boolean("is_resolved").default(false),
  isPinned: boolean("is_pinned").default(false),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("idx_family_discussions_family").on(table.familyId),
  index("idx_family_discussions_topic").on(table.topicId),
  index("idx_family_discussions_author").on(table.authorId),
]);

// Family Budgets - Shared household budgets
export const familyBudgets = pgTable("family_budgets", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  familyId: varchar("family_id").references(() => familyGroups.id).notNull(),
  budgetName: text("budget_name").notNull(),
  category: varchar("category").notNull(), // housing, food, transportation, utilities, entertainment, healthcare, education
  monthlyLimit: decimal("monthly_limit", { precision: 15, scale: 2 }).notNull(),
  currentSpend: decimal("current_spend", { precision: 15, scale: 2 }).default("0"),
  period: varchar("period").default("monthly"), // weekly, monthly, quarterly, yearly
  startDate: date("start_date").notNull(),
  endDate: date("end_date"),
  alertThreshold: decimal("alert_threshold", { precision: 5, scale: 2 }).default("80"), // Percentage
  createdBy: varchar("created_by").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("idx_family_budgets_family").on(table.familyId),
  index("idx_family_budgets_category").on(table.category),
]);

// Note: insertGovernmentSecuritySchema has been moved to shared/schema.ts
// to avoid a circular dependency (family.ts -> schema.ts -> family.ts)
