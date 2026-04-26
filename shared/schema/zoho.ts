import { sql } from "drizzle-orm";
import { pgTable, text, varchar, timestamp, boolean, index, integer, jsonb, decimal, date, serial, real, uniqueIndex } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { storeProducts, products, storeCategories } from '../schema';
import { users } from './users';
import { agents } from './agents';

// --- Auto-Migrated Tables ---
export const zohoConnections = pgTable("zoho_connections", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  
  // Connection Info
  connectionName: varchar("connection_name").notNull(), // 'Production CRM', 'Development Books'
  zohoDataCenter: varchar("zoho_data_center").default("com"), // com, eu, in, com.au, jp
  zohoOrgId: varchar("zoho_org_id"), // Zoho organization ID
  
  // OAuth Tokens
  accessToken: text("access_token").notNull(),
  refreshToken: text("refresh_token").notNull(),
  tokenType: varchar("token_type").default("Bearer"),
  expiresAt: timestamp("expires_at").notNull(), // Access token expiry (1 hour)
  scope: text("scope"), // API scopes granted
  
  // App Services Enabled
  services: text("services").array().default(sql`ARRAY[]::text[]`), // ['CRM', 'Books', 'Desk', 'WorkDrive', 'People', 'Campaigns']
  
  // Connection Status
  status: varchar("status").default("active"), // active, expired, revoked, error
  lastSyncAt: timestamp("last_sync_at"),
  lastErrorAt: timestamp("last_error_at"),
  lastError: text("last_error"),
  
  // Metadata
  createdBy: varchar("created_by").references(() => users.id),
  isProduction: boolean("is_production").default(false),
  isDefault: boolean("is_default").default(false), // Default connection for CRM sync
  isMaster: boolean("is_master").default(false), // Master agent connection - all sub-agents sync through this
  masterAgentId: varchar("master_agent_id"), // Agent ID this connection belongs to
  
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const zohoEntityMappings = pgTable("zoho_entity_mappings", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  
  connectionId: varchar("connection_id").references(() => zohoConnections.id).notNull(),
  
  // FintekPro Side
  fintekproEntityType: varchar("fintekpro_entity_type").notNull(), // 'partner', 'user', 'order', 'commission'
  fintekproEntityId: varchar("fintekpro_entity_id").notNull(),
  
  // Zoho Side
  zohoService: varchar("zoho_service").notNull(), // 'CRM', 'Books', 'Desk'
  zohoModule: varchar("zoho_module").notNull(), // 'Contacts', 'Vendors', 'Tickets'
  zohoRecordId: varchar("zoho_record_id").notNull(),
  zohoRecordData: jsonb("zoho_record_data"), // Cached Zoho record snapshot
  
  // Hierarchical Sync - Parent record linkage for agent-client hierarchy
  parentZohoRecordId: varchar("parent_zoho_record_id"), // Links to master agent's Zoho Account
  owningAgentId: varchar("owning_agent_id"), // FintekPro agent who owns/acquired this entity
  
  // Sync Status
  syncDirection: varchar("sync_direction").default("bidirectional"), // bidirectional, zoho_to_fintekpro, fintekpro_to_zoho
  lastSyncedAt: timestamp("last_synced_at"),
  syncStatus: varchar("sync_status").default("synced"), // synced, pending, conflict, error
  conflictData: jsonb("conflict_data"), // Store conflict details for resolution
  
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const zohoSyncLogs = pgTable("zoho_sync_logs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  
  connectionId: varchar("connection_id").references(() => zohoConnections.id),
  
  // Operation Details
  operation: varchar("operation").notNull(), // 'create', 'update', 'delete', 'bulk_sync'
  entityType: varchar("entity_type").notNull(),
  direction: varchar("direction").notNull(), // 'to_zoho', 'from_zoho'
  
  // Zoho API Details
  zohoService: varchar("zoho_service").notNull(),
  zohoModule: varchar("zoho_module"),
  zohoApiEndpoint: text("zoho_api_endpoint"),
  zohoRequestPayload: jsonb("zoho_request_payload"),
  zohoResponseData: jsonb("zoho_response_data"),
  
  // Result
  status: varchar("status").notNull(), // success, failure, partial
  recordsProcessed: integer("records_processed").default(0),
  recordsSucceeded: integer("records_succeeded").default(0),
  recordsFailed: integer("records_failed").default(0),
  errorMessage: text("error_message"),
  errorDetails: jsonb("error_details"),
  
  // Performance
  durationMs: integer("duration_ms"),
  apiCreditsUsed: integer("api_credits_used"),
  
  // Context
  triggeredBy: varchar("triggered_by"), // 'webhook', 'cron', 'manual', 'user_action'
  userId: varchar("user_id").references(() => users.id),
  
  createdAt: timestamp("created_at").defaultNow(),
});

export const zohoWebhookEvents = pgTable("zoho_webhook_events", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  
  connectionId: varchar("connection_id").references(() => zohoConnections.id),
  
  // Webhook Details
  zohoService: varchar("zoho_service").notNull(),
  zohoModule: varchar("zoho_module").notNull(),
  eventType: varchar("event_type").notNull(), // 'create', 'update', 'delete', 'custom'
  zohoRecordId: varchar("zoho_record_id"),
  
  // Payload
  webhookPayload: jsonb("webhook_payload").notNull(),
  headers: jsonb("headers"),
  
  // Processing Status
  status: varchar("status").default("pending"), // pending, processing, completed, failed
  processedAt: timestamp("processed_at"),
  processingError: text("processing_error"),
  retryCount: integer("retry_count").default(0),
  nextRetryAt: timestamp("next_retry_at"),
  
  // Mapping Result
  mappingId: varchar("mapping_id").references(() => zohoEntityMappings.id),
  
  // Deduplication
  zohoEventId: varchar("zoho_event_id").unique(), // Zoho's unique event ID if available
  
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const zohoCommerceConfig = pgTable("zoho_commerce_config", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id),
  
  // Prospect support - for goals created by agents before user registration
  prospectId: varchar("prospect_id"),
  createdByAgentId: varchar("created_by_agent_id").references(() => users.id),
  clientId: varchar("client_id").notNull(),
  clientSecret: varchar("client_secret").notNull(),
  redirectUri: varchar("redirect_uri").notNull(),
  baseUrl: varchar("base_url").notNull(), // e.g., 'https://commerce.zoho.com'
  scope: jsonb("scope").notNull(), // array of scopes
  accessToken: text("access_token"),
  refreshToken: text("refresh_token"),
  tokenExpiry: timestamp("token_expiry"),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`),
  updatedAt: timestamp("updated_at").default(sql`CURRENT_TIMESTAMP`),
});

export const insertZohoCommerceConfigSchema = createInsertSchema(zohoCommerceConfig).extend({
  id: z.any(),
  createdAt: z.any(),
  updatedAt: z.any(),
}).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type ZohoCommerceConfig = typeof zohoCommerceConfig.$inferSelect;

export type InsertZohoCommerceConfig = z.infer<typeof insertZohoCommerceConfigSchema>;

export const zohoCategories = pgTable("zoho_categories", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id),
  
  // Prospect support - for goals created by agents before user registration
  prospectId: varchar("prospect_id"),
  createdByAgentId: varchar("created_by_agent_id").references(() => users.id),
  zohoCategoryId: varchar("zoho_category_id"), // ID from Zoho Commerce
  localCategoryId: varchar("local_category_id").references(() => storeCategories.id),
  name: varchar("name").notNull(),
  description: text("description"),
  parentId: varchar("parent_id").references((): any => zohoCategories.id),
  sortOrder: integer("sort_order").default(0),
  isActive: boolean("is_active").default(true),
  seoTitle: varchar("seo_title"),
  seoDescription: text("seo_description"),
  imageUrl: varchar("image_url"),
  syncStatus: varchar("sync_status").default('pending'),
  lastSyncAt: timestamp("last_sync_at"),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`),
  updatedAt: timestamp("updated_at").default(sql`CURRENT_TIMESTAMP`),
});

export const zohoProducts = pgTable("zoho_products", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id),
  
  // Prospect support - for goals created by agents before user registration
  prospectId: varchar("prospect_id"),
  createdByAgentId: varchar("created_by_agent_id").references(() => users.id),
  zohoProductId: varchar("zoho_product_id"), // ID from Zoho Commerce
  localProductId: varchar("local_product_id").references(() => storeProducts.id),
  name: varchar("name").notNull(),
  description: text("description"),
  price: decimal("price", { precision: 10, scale: 2 }).notNull(),
  comparePrice: decimal("compare_price", { precision: 10, scale: 2 }),
  sku: varchar("sku"),
  weight: decimal("weight", { precision: 8, scale: 2 }),
  weightUnit: varchar("weight_unit").default('kg'),
  trackQuantity: boolean("track_quantity").default(true),
  quantity: integer("quantity").default(0),
  categoryId: varchar("category_id").references(() => zohoCategories.id),
  brand: varchar("brand"),
  tags: jsonb("tags"), // array of tags
  images: jsonb("images"), // array of image objects
  variants: jsonb("variants"), // array of variant objects
  seoTitle: varchar("seo_title"),
  seoDescription: text("seo_description"),
  status: varchar("status").default('active'), // active, inactive, draft
  syncStatus: varchar("sync_status").default('pending'), // pending, synced, error
  lastSyncAt: timestamp("last_sync_at"),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`),
  updatedAt: timestamp("updated_at").default(sql`CURRENT_TIMESTAMP`),
});

export const zohoOrders = pgTable("zoho_orders", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id),
  
  // Prospect support - for goals created by agents before user registration
  prospectId: varchar("prospect_id"),
  createdByAgentId: varchar("created_by_agent_id").references(() => users.id),
  zohoOrderId: varchar("zoho_order_id"), // ID from Zoho Commerce
  orderNumber: varchar("order_number"),
  customerId: varchar("customer_id"),
  customerEmail: varchar("customer_email"),
  billingAddress: jsonb("billing_address"),
  shippingAddress: jsonb("shipping_address"),
  lineItems: jsonb("line_items"), // array of line items
  subtotal: decimal("subtotal", { precision: 10, scale: 2 }),
  totalTax: decimal("total_tax", { precision: 10, scale: 2 }),
  totalPrice: decimal("total_price", { precision: 10, scale: 2 }),
  currency: varchar("currency").default('INR'),
  orderStatus: varchar("order_status").default('pending'), // pending, confirmed, shipped, delivered, cancelled
  paymentStatus: varchar("payment_status").default('pending'), // pending, paid, failed, refunded
  fulfillmentStatus: varchar("fulfillment_status").default('unfulfilled'), // unfulfilled, partial, fulfilled
  notes: text("notes"),
  syncStatus: varchar("sync_status").default('pending'),
  lastSyncAt: timestamp("last_sync_at"),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`),
  updatedAt: timestamp("updated_at").default(sql`CURRENT_TIMESTAMP`),
});

export const zohoCustomers = pgTable("zoho_customers", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id),
  
  // Prospect support - for goals created by agents before user registration
  prospectId: varchar("prospect_id"),
  createdByAgentId: varchar("created_by_agent_id").references(() => users.id),
  zohoCustomerId: varchar("zoho_customer_id"), // ID from Zoho Commerce
  localUserId: varchar("local_user_id").references(() => users.id),
  email: varchar("email").notNull(),
  firstName: varchar("first_name"),
  lastName: varchar("last_name"),
  phone: varchar("phone"),
  addresses: jsonb("addresses"), // array of address objects
  orderCount: integer("order_count").default(0),
  totalSpent: decimal("total_spent", { precision: 10, scale: 2 }).default('0.00'),
  lastOrderDate: timestamp("last_order_date"),
  acceptsMarketing: boolean("accepts_marketing").default(false),
  syncStatus: varchar("sync_status").default('pending'),
  lastSyncAt: timestamp("last_sync_at"),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`),
  updatedAt: timestamp("updated_at").default(sql`CURRENT_TIMESTAMP`),
});

export const zohoInventory = pgTable("zoho_inventory", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id),
  
  // Prospect support - for goals created by agents before user registration
  prospectId: varchar("prospect_id"),
  createdByAgentId: varchar("created_by_agent_id").references(() => users.id),
  productId: varchar("product_id").references(() => zohoProducts.id).notNull(),
  variantId: varchar("variant_id"), // Zoho variant ID
  sku: varchar("sku"),
  quantity: integer("quantity").default(0),
  reservedQuantity: integer("reserved_quantity").default(0),
  availableQuantity: integer("available_quantity").default(0),
  reorderLevel: integer("reorder_level").default(0),
  reorderQuantity: integer("reorder_quantity").default(0),
  cost: decimal("cost", { precision: 10, scale: 2 }),
  location: varchar("location"),
  syncStatus: varchar("sync_status").default('pending'),
  lastSyncAt: timestamp("last_sync_at"),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`),
  updatedAt: timestamp("updated_at").default(sql`CURRENT_TIMESTAMP`),
});

export const insertZohoInventorySchema = createInsertSchema(zohoInventory).extend({
  id: z.any(),
  createdAt: z.any(),
  updatedAt: z.any(),
}).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type ZohoInventory = typeof zohoInventory.$inferSelect;

export type InsertZohoInventory = z.infer<typeof insertZohoInventorySchema>;

export const zohoCommerceWebhooks = pgTable("zoho_commerce_webhooks", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id),
  
  // Prospect support - for goals created by agents before user registration
  prospectId: varchar("prospect_id"),
  createdByAgentId: varchar("created_by_agent_id").references(() => users.id),
  zohoWebhookId: varchar("zoho_webhook_id"), // ID from Zoho Commerce
  eventType: varchar("event_type").notNull(), // order.created, product.updated, etc.
  targetUrl: varchar("target_url").notNull(),
  isActive: boolean("is_active").default(true),
  secretKey: varchar("secret_key"), // for webhook verification
  lastTriggered: timestamp("last_triggered"),
  successCount: integer("success_count").default(0),
  failureCount: integer("failure_count").default(0),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`),
  updatedAt: timestamp("updated_at").default(sql`CURRENT_TIMESTAMP`),
});

export const zohoCommerceSyncLogs = pgTable("zoho_commerce_sync_logs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id),
  
  // Prospect support - for goals created by agents before user registration
  prospectId: varchar("prospect_id"),
  createdByAgentId: varchar("created_by_agent_id").references(() => users.id),
  syncType: varchar("sync_type").notNull(), // products, orders, customers, inventory
  status: varchar("status").notNull(), // success, error, warning
  recordsProcessed: integer("records_processed").default(0),
  recordsSuccess: integer("records_success").default(0),
  recordsError: integer("records_error").default(0),
  errorDetails: jsonb("error_details"),
  startedAt: timestamp("started_at").default(sql`CURRENT_TIMESTAMP`),
  completedAt: timestamp("completed_at"),
  duration: integer("duration"), // in milliseconds
});
