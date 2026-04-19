import { sql } from "drizzle-orm";
import { pgTable, text, varchar, timestamp, boolean, index, integer, jsonb, decimal, date, numeric, bigint, uniqueIndex } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { users } from './users';
import { unlistedCompanies } from './unlisted';
import { storeProducts, investmentProposals, Product, User } from '../schema';

// Old User Cart (Product Store)
export const userCart = pgTable("user_cart", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id),
  prospectId: varchar("prospect_id"),
  createdByAgentId: varchar("created_by_agent_id").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const userCartItems = pgTable("user_cart_items", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  cartId: varchar("cart_id").references(() => userCart.id).notNull(),
  productId: varchar("product_id").references(() => storeProducts.id),
  proposalId: varchar("proposal_id").references(() => investmentProposals.id),
  investmentId: varchar("investment_id"),
  itemType: varchar("item_type").notNull().default("product"),
  quantity: integer("quantity").notNull().default(1),
  investmentAmount: decimal("investment_amount", { precision: 15, scale: 2 }),
  proposalItemIds: text("proposal_item_ids").array(),
  metadata: jsonb("metadata").$type<Record<string, any>>().default({}),
  addedAt: timestamp("added_at").defaultNow(),
});

// Old Unlisted Cart
export const unlistedCart = pgTable("unlisted_cart", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id),
  prospectId: varchar("prospect_id"),
  createdByAgentId: varchar("created_by_agent_id").references(() => users.id),
  companyId: varchar("company_id").references(() => unlistedCompanies.id).notNull(),
  quantity: bigint("quantity", { mode: "number" }).notNull(),
  maxPrice: decimal("max_price", { precision: 20, scale: 2 }).notNull(),
  targetPrice: decimal("target_price", { precision: 20, scale: 2 }),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("idx_unlisted_cart_user").on(table.userId),
  index("idx_unlisted_cart_company").on(table.companyId),
]);

// New Unified Cart Infrastructure
export const unifiedCartItems = pgTable("unified_cart_items", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id),
  prospectId: varchar("prospect_id"),
  createdByAgentId: varchar("created_by_agent_id").references(() => users.id),
  productCategory: varchar("product_category").notNull(),
  storeProductId: varchar("store_product_id").references(() => storeProducts.id),
  unlistedCompanyId: varchar("unlisted_company_id").references(() => unlistedCompanies.id),
  mutualFundSchemeCode: varchar("mutual_fund_scheme_code"),
  bondIsin: varchar("bond_isin"),
  ncdIsin: varchar("ncd_isin"),
  ipoId: varchar("ipo_id"),
  source: varchar("source").notNull().default('client'),
  sourceUserId: varchar("source_user_id").references(() => users.id),
  sourceProposalId: varchar("source_proposal_id"),
  quantity: integer("quantity").default(1),
  amount: decimal("amount", { precision: 20, scale: 2 }),
  targetPrice: decimal("target_price", { precision: 20, scale: 2 }),
  metadata: jsonb("metadata").$type<Record<string, any>>().default({}),
  displayName: varchar("display_name"),
  displayImageUrl: text("display_image_url"),
  status: varchar("status").default('active'),
  clientApproved: boolean("client_approved").default(false),
  approvedAt: timestamp("approved_at"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("idx_unified_cart_user").on(table.userId),
  index("idx_unified_cart_category").on(table.productCategory),
  index("idx_unified_cart_source").on(table.source),
  index("idx_unified_cart_status").on(table.status),
]);

// Enums
export const ProductCategoryEnum = z.enum(['store', 'unlisted', 'mutual_fund', 'bond', 'ncd', 'ipo']);
export const CartItemSourceEnum = z.enum(['client', 'agent', 'ai']);
export const CartItemStatusEnum = z.enum(['active', 'pending_approval', 'removed', 'ordered']);

// Zod Schemas
export const insertUserCartSchema = createInsertSchema(userCart).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertUserCartItemSchema = createInsertSchema(userCartItems).omit({
  id: true,
  addedAt: true,
}).refine((data) => {
  const hasProduct = !!data.productId;
  const hasProposal = !!data.proposalId;
  const hasInvestment = !!data.investmentId;
  const count = [hasProduct, hasProposal, hasInvestment].filter(Boolean).length;
  return count === 1;
}, {
  message: "Exactly one of productId, proposalId, or investmentId must be provided",
});

export const insertUnlistedCartSchema = createInsertSchema(unlistedCart).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertUnifiedCartItemSchema = createInsertSchema(unifiedCartItems).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

// Types
export type UserCart = typeof userCart.$inferSelect;
export type InsertUserCart = z.infer<typeof insertUserCartSchema>;
export type UserCartItem = typeof userCartItems.$inferSelect;
export type InsertUserCartItem = z.infer<typeof insertUserCartItemSchema>;
export type UnlistedCartItem = typeof unlistedCart.$inferSelect;
export type InsertUnlistedCartItem = z.infer<typeof insertUnlistedCartSchema>;
export type UnifiedCartItem = typeof unifiedCartItems.$inferSelect;
export type InsertUnifiedCartItem = z.infer<typeof insertUnifiedCartItemSchema>;
export type ProductCategory = z.infer<typeof ProductCategoryEnum>;
export type CartItemSource = z.infer<typeof CartItemSourceEnum>;
export type CartItemStatus = z.infer<typeof CartItemStatusEnum>;
