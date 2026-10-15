import { sql } from "drizzle-orm";
import { pgTable, text, varchar, timestamp, jsonb, boolean, integer, index } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { users } from "./users";
import { prospectLeads } from "./crm";
import { prospectClients } from "./proposals";

/**
 * ── Call Logs Table ─────────────────────────────────────────────────────────
 * Tracks individual phone calls made via Exotel Cloud Telephony.
 * Includes TRAI compliance status, call masking virtual number (ExoPhone),
 * recording URLs, call durations, and advisor disposition notes.
 */
export const outboundCallLogs = pgTable("outbound_call_logs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  agentId: varchar("agent_id").references(() => users.id).notNull(),
  
  // Optional links to lead or client
  prospectLeadId: varchar("prospect_lead_id").references(() => prospectLeads.id),
  prospectClientId: varchar("prospect_client_id").references(() => prospectClients.id),
  
  // Contact details
  prospectName: varchar("prospect_name").notNull(),
  prospectPhone: varchar("prospect_phone").notNull(),
  agentPhone: varchar("agent_phone").notNull(),
  callerId: varchar("caller_id"), // ExoPhone virtual number used for masking
  
  // Exotel Call identifiers
  exotelCallSid: varchar("exotel_call_sid"),
  direction: varchar("direction").notNull().default("outbound"), // outbound | inbound
  dialerMode: varchar("dialer_mode").notNull().default("progressive_queue"), // click_to_call | progressive_queue | campaign
  
  // Call status lifecycle
  status: varchar("status").notNull().default("initiated"), // initiated | ringing | in_progress | completed | busy | no_answer | failed | canceled
  duration: integer("duration").default(0), // duration in seconds
  recordingUrl: text("recording_url"), // Exotel call audio recording URL
  
  // Disposition & CRM Outcome
  disposition: varchar("disposition"), // interested | callback_requested | not_interested | wrong_number | dnd | meeting_fixed | converted | unreachable
  dispositionNotes: text("disposition_notes"),
  followUpDate: timestamp("follow_up_date"),
  
  // Regulatory & Compliance
  dndStatus: varchar("dnd_status").default("scrubbed_clean"), // scrubbed_clean | dnd_consent_override | dnd_blocked
  complianceWarning: text("compliance_warning"),
  
  // Telemetry & Extra Metadata
  metadata: jsonb("metadata").$type<{
    exotelStatus?: string;
    conversationDuration?: number;
    hangupCause?: string;
    dialedAt?: string;
    answeredAt?: string;
    completedAt?: string;
    rawPayload?: Record<string, any>;
  }>(),
  
  source: varchar("source").default("agent_dialer"), // agent_dialer | progressive_queue | campaign
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("idx_call_logs_agent").on(table.agentId),
  index("idx_call_logs_lead").on(table.prospectLeadId),
  index("idx_call_logs_prospect_client").on(table.prospectClientId),
  index("idx_call_logs_status").on(table.status),
  index("idx_call_logs_created").on(table.createdAt),
]);

export const insertOutboundCallLogSchema = createInsertSchema(outboundCallLogs as any).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type OutboundCallLog = typeof outboundCallLogs.$inferSelect;
export type InsertOutboundCallLog = z.infer<typeof insertOutboundCallLogSchema>;

/**
 * ── Dialer Queues Table ─────────────────────────────────────────────────────
 * Manages active progressive auto-dialing sessions for agents.
 */
export const dialerQueues = pgTable("dialer_queues", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  agentId: varchar("agent_id").references(() => users.id).notNull(),
  name: varchar("name").notNull().default("Daily Prospect Queue"),
  status: varchar("status").notNull().default("active"), // active | paused | completed
  targetSegment: varchar("target_segment").default("all"), // hot | warm | follow_up | all
  leadIds: jsonb("lead_ids").$type<string[]>().default([]),
  currentIndex: integer("current_index").default(0),
  totalCount: integer("total_count").default(0),
  completedCount: integer("completed_count").default(0),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("idx_dialer_queues_agent").on(table.agentId),
  index("idx_dialer_queues_status").on(table.status),
]);

export const insertDialerQueueSchema = createInsertSchema(dialerQueues as any).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type DialerQueue = typeof dialerQueues.$inferSelect;
export type InsertDialerQueue = z.infer<typeof insertDialerQueueSchema>;

export const CallDispositionEnum = z.enum([
  "interested",
  "callback_requested",
  "not_interested",
  "wrong_number",
  "dnd",
  "meeting_fixed",
  "converted",
  "unreachable",
]);

export const CallStatusEnum = z.enum([
  "initiated",
  "ringing",
  "in_progress",
  "completed",
  "busy",
  "no_answer",
  "failed",
  "canceled",
]);
