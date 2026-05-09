import { sql } from "drizzle-orm";
import { pgTable, text, varchar, timestamp, boolean, index, integer, jsonb, decimal, date, serial, real, uniqueIndex, pgEnum } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { users } from './users';
// import { sebiClauseChecklist } from '../schema'; // Moved here to break circularity

export const changeOperationEnum = pgEnum("change_operation", [
  "insert",
  "delete", 
  "modify",
  "comment"
]);

export const documentStatusEnum = pgEnum("document_status", [
  "draft",
  "negotiation", 
  "review",
  "approved",
  "signed",
  "legacy",
  "expired",
  "rejected",
  "archived"
]);

export const documentEntityTypeEnum = pgEnum("document_entity_type", [
  "vendor",
  "partner", 
  "agent",
  "ca",
  "lender",
  "client",
  "regulator",
  "internal"
]);

export const agreementTypeEnum = pgEnum("agreement_type", [
  "service_agreement",
  "partnership_agreement",
  "agent_agreement",
  "ca_engagement_letter",
  "lender_agreement",
  "client_agreement",
  "nda",
  "mou",
  "amendment",
  "addendum",
  "renewal",
  "termination",
  "compliance_declaration",
  "kyc_document",
  "regulatory_filing",
  "other"
]);


// --- Auto-Migrated Tables ---
export const documents = pgTable("documents", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  
  // Document Identity
  documentNumber: varchar("document_number", { length: 50 }).unique(),
  title: varchar("title", { length: 500 }).notNull(),
  description: text("description"),
  
  // Entity Association
  entityType: documentEntityTypeEnum("entity_type").notNull(),
  entityId: varchar("entity_id"), // Reference to vendor/partner/agent/etc.
  entityName: varchar("entity_name", { length: 255 }),
  entityPan: varchar("entity_pan", { length: 20 }),
  
  // Agreement Details
  agreementType: agreementTypeEnum("agreement_type").notNull(),
  status: documentStatusEnum("status").default("draft").notNull(),
  
  // Version Control
  currentVersionId: varchar("current_version_id"),
  versionCount: integer("version_count").default(1),
  parentDocumentId: varchar("parent_document_id"), // For amendments/renewals
  
  // Dates
  effectiveDate: date("effective_date"),
  expiryDate: date("expiry_date"),
  signedDate: date("signed_date"),
  renewalDate: date("renewal_date"),
  
  // Compliance Scoring
  riskScore: integer("risk_score").default(0), // 0-100
  complianceScore: integer("compliance_score").default(0), // 0-100
  aiReviewScore: integer("ai_review_score"), // Latest AI analysis score
  
  // Workflow Assignment
  assignedToUserId: varchar("assigned_to_user_id").references(() => users.id),
  assignedToRole: varchar("assigned_to_role", { length: 50 }),
  
  // Metadata
  tags: text("tags").array(),
  metadata: jsonb("metadata").default({}),
  
  // Legacy Document Tracking
  isLegacy: boolean("is_legacy").default(false),
  legacyUploadedAt: timestamp("legacy_uploaded_at"),
  legacyDeclaration: text("legacy_declaration"),
  originalSignDate: date("original_sign_date"),
  
  // Audit
  createdBy: varchar("created_by").references(() => users.id),
  createdByRole: varchar("created_by_role", { length: 50 }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("idx_documents_entity").on(table.entityType, table.entityId),
  index("idx_documents_status").on(table.status),
  index("idx_documents_expiry").on(table.expiryDate),
  index("idx_documents_pan").on(table.entityPan),
  index("idx_documents_agreement_type").on(table.agreementType),
]);

export const insertDocumentSchema = createInsertSchema(documents).extend({
  id: z.any(),
  createdAt: z.any(),
  updatedAt: z.any(),
}).omit({ id: true, createdAt: true, updatedAt: true });

export const documentVersions = pgTable("document_versions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  documentId: varchar("document_id").references(() => documents.id).notNull(),
  
  // Version Info
  versionNumber: integer("version_number").notNull(),
  versionLabel: varchar("version_label", { length: 100 }), // e.g., "v1.0", "Draft 2"
  
  // Content
  content: text("content"), // Document content (text/markdown)
  contentType: varchar("content_type", { length: 50 }).default("text"), // text, html, pdf
  
  // File Storage
  fileUrl: varchar("file_url", { length: 1000 }),
  fileName: varchar("file_name", { length: 255 }),
  fileSize: integer("file_size"),
  fileMimeType: varchar("file_mime_type", { length: 100 }),
  
  // Integrity (SHA-256 Hash)
  contentHash: varchar("content_hash", { length: 128 }).notNull(),
  
  // Status at this version
  statusAtVersion: documentStatusEnum("status_at_version").notNull(),
  
  // Change Summary
  changeSummary: text("change_summary"),
  changesFromPrevious: jsonb("changes_from_previous").default([]),
  
  // Author
  createdBy: varchar("created_by").references(() => users.id),
  createdByRole: varchar("created_by_role", { length: 50 }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  
  // Lock flag - versions are immutable once created
  isLocked: boolean("is_locked").default(true),
}, (table) => [
  index("idx_doc_versions_document").on(table.documentId),
  index("idx_doc_versions_hash").on(table.contentHash),
  index("idx_doc_versions_number").on(table.documentId, table.versionNumber),
]);

export const insertDocumentVersionSchema = createInsertSchema(documentVersions).extend({
  id: z.any(),
  createdAt: z.any(),
}).omit({ id: true, createdAt: true });

export const documentWorkflowTransitions = pgTable("document_workflow_transitions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  documentId: varchar("document_id").references(() => documents.id).notNull(),
  versionId: varchar("version_id").references(() => documentVersions.id),
  
  // Transition Details
  fromStatus: documentStatusEnum("from_status").notNull(),
  toStatus: documentStatusEnum("to_status").notNull(),
  
  // Actor
  performedBy: varchar("performed_by").references(() => users.id).notNull(),
  performedByRole: varchar("performed_by_role", { length: 50 }).notNull(),
  
  // Justification
  action: varchar("action", { length: 100 }).notNull(), // approve, reject, send_back, sign, etc.
  reason: text("reason"),
  comments: text("comments"),
  
  // AI Override Tracking
  isAiOverride: boolean("is_ai_override").default(false),
  aiOverrideJustification: text("ai_override_justification"),
  
  // Checklist State
  checklistSnapshot: jsonb("checklist_snapshot"),
  checklistComplete: boolean("checklist_complete").default(false),
  
  // IP & Device
  ipAddress: varchar("ip_address", { length: 50 }),
  userAgent: text("user_agent"),
  
  // Timestamp
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  index("idx_workflow_transitions_doc").on(table.documentId),
  index("idx_workflow_transitions_actor").on(table.performedBy),
  index("idx_workflow_transitions_status").on(table.fromStatus, table.toStatus),
]);

export const insertDocumentWorkflowTransitionSchema = createInsertSchema(documentWorkflowTransitions).extend({
  id: z.any(),
  createdAt: z.any(),
}).omit({ id: true, createdAt: true });

export const documentClauses = pgTable("document_clauses", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  documentId: varchar("document_id").references(() => documents.id).notNull(),
  versionId: varchar("version_id").references(() => documentVersions.id).notNull(),
  
  // Clause Identity
  clauseNumber: varchar("clause_number", { length: 50 }),
  clauseTitle: varchar("clause_title", { length: 255 }),
  clauseCategory: varchar("clause_category", { length: 100 }), // payment_terms, liability, termination, etc.
  
  // Content
  clauseText: text("clause_text").notNull(),
  startPosition: integer("start_position"), // For text highlighting
  endPosition: integer("end_position"),
  
  // SEBI Compliance Mapping
  sebiClauseId: varchar("sebi_clause_id", { length: 50 }),
  isMandatory: boolean("is_mandatory").default(false),
  isCompliant: boolean("is_compliant"),
  complianceNotes: text("compliance_notes"),
  
  // AI Analysis
  aiConfidenceScore: integer("ai_confidence_score"), // 0-100
  aiSuggestedText: text("ai_suggested_text"),
  aiRiskLevel: varchar("ai_risk_level", { length: 20 }), // low, medium, high, critical
  
  // Timestamps
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("idx_clauses_document").on(table.documentId),
  index("idx_clauses_version").on(table.versionId),
  index("idx_clauses_category").on(table.clauseCategory),
  index("idx_clauses_sebi").on(table.sebiClauseId),
]);

export const insertDocumentClauseSchema = createInsertSchema(documentClauses).extend({
  id: z.any(),
  createdAt: z.any(),
  updatedAt: z.any(),
}).omit({ id: true, createdAt: true, updatedAt: true });

export const documentTrackedChanges = pgTable("document_tracked_changes", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  documentId: varchar("document_id").references(() => documents.id).notNull(),
  versionId: varchar("version_id").references(() => documentVersions.id).notNull(),
  clauseId: varchar("clause_id").references(() => documentClauses.id),
  
  // Change Details
  operation: changeOperationEnum("operation").notNull(),
  oldText: text("old_text"),
  newText: text("new_text"),
  
  // Position in Document
  startPosition: integer("start_position"),
  endPosition: integer("end_position"),
  
  // Suggestion Details
  suggestedBy: varchar("suggested_by").references(() => users.id).notNull(),
  suggestedByRole: varchar("suggested_by_role", { length: 50 }).notNull(),
  
  // Resolution
  status: varchar("status", { length: 20 }).default("pending"), // pending, accepted, rejected
  resolvedBy: varchar("resolved_by").references(() => users.id),
  resolvedByRole: varchar("resolved_by_role", { length: 50 }),
  resolvedAt: timestamp("resolved_at"),
  resolutionComment: text("resolution_comment"),
  
  // Timestamps
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  index("idx_tracked_changes_doc").on(table.documentId),
  index("idx_tracked_changes_version").on(table.versionId),
  index("idx_tracked_changes_status").on(table.status),
]);

export const insertDocumentTrackedChangeSchema = createInsertSchema(documentTrackedChanges).extend({
  id: z.any(),
  createdAt: z.any(),
}).omit({ id: true, createdAt: true });

export const documentComments = pgTable("document_comments", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  documentId: varchar("document_id").references(() => documents.id).notNull(),
  versionId: varchar("version_id").references(() => documentVersions.id),
  clauseId: varchar("clause_id").references(() => documentClauses.id),
  trackedChangeId: varchar("tracked_change_id").references(() => documentTrackedChanges.id),
  
  // Thread Structure
  parentCommentId: varchar("parent_comment_id"), // For nested replies
  threadId: varchar("thread_id"), // Group related comments
  
  // Content
  content: text("content").notNull(),
  
  // Position (for inline comments)
  selectionStart: integer("selection_start"),
  selectionEnd: integer("selection_end"),
  selectedText: text("selected_text"),
  
  // Author
  authorId: varchar("author_id").references(() => users.id).notNull(),
  authorRole: varchar("author_role", { length: 50 }).notNull(),
  
  // Status
  isResolved: boolean("is_resolved").default(false),
  resolvedBy: varchar("resolved_by").references(() => users.id),
  resolvedAt: timestamp("resolved_at"),
  
  // AI Generated
  isAiGenerated: boolean("is_ai_generated").default(false),
  aiConfidence: integer("ai_confidence"),
  
  // Timestamps
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("idx_comments_document").on(table.documentId),
  index("idx_comments_thread").on(table.threadId),
  index("idx_comments_author").on(table.authorId),
]);

export const insertDocumentCommentSchema = createInsertSchema(documentComments).extend({
  id: z.any(),
  createdAt: z.any(),
  updatedAt: z.any(),
}).omit({ id: true, createdAt: true, updatedAt: true });
export const sebiClauseChecklist = pgTable("sebi_clause_checklist", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  
  // Clause Identity
  clauseCode: varchar("clause_code", { length: 50 }).unique().notNull(),
  clauseCategory: varchar("clause_category", { length: 100 }).notNull(),
  clauseTitle: varchar("clause_title", { length: 500 }).notNull(),
  clauseDescription: text("clause_description"),
  
  // Applicability
  isMandatory: boolean("is_mandatory").default(true),
  isConditional: boolean("is_conditional").default(false),
  conditionDescription: text("condition_description"),
  applicableEntityTypes: text("applicable_entity_types").array(), // vendor, partner, agent, etc.
  applicableAgreementTypes: text("applicable_agreement_types").array(),
  
  // Risk & Compliance
  riskWeight: integer("risk_weight").default(1), // 1-10 importance
  regulatoryReference: varchar("regulatory_reference", { length: 255 }), // SEBI circular/guideline reference
  
  // Template
  suggestedClauseText: text("suggested_clause_text"),
  
  // Status
  isActive: boolean("is_active").default(true),
  effectiveFrom: date("effective_from"),
  effectiveTo: date("effective_to"),
  
  // Timestamps
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("idx_sebi_checklist_category").on(table.clauseCategory),
  index("idx_sebi_checklist_mandatory").on(table.isMandatory),
]);

export const insertSebiClauseChecklistSchema = createInsertSchema(sebiClauseChecklist).omit({ id: true, createdAt: true, updatedAt: true });
export type SebiClauseChecklist = typeof sebiClauseChecklist.$inferSelect;
export type InsertSebiClauseChecklist = z.infer<typeof insertSebiClauseChecklistSchema>;


export const documentChecklistRuns = pgTable("document_checklist_runs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  documentId: varchar("document_id").references(() => documents.id).notNull(),
  versionId: varchar("version_id").references(() => documentVersions.id).notNull(),
  
  // Run Details
  runType: varchar("run_type", { length: 50 }).default("manual"), // manual, ai, automatic
  runBy: varchar("run_by").references(() => users.id),
  runByRole: varchar("run_by_role", { length: 50 }),
  
  // Results Summary
  totalItems: integer("total_items").default(0),
  completedItems: integer("completed_items").default(0),
  pendingItems: integer("pending_items").default(0),
  overriddenItems: integer("overridden_items").default(0),
  
  // Scores
  complianceScore: integer("compliance_score"), // 0-100
  riskScore: integer("risk_score"), // 0-100
  
  // Status
  status: varchar("status", { length: 20 }).default("in_progress"), // in_progress, completed, approved
  isApproved: boolean("is_approved").default(false),
  approvedBy: varchar("approved_by").references(() => users.id),
  approvedAt: timestamp("approved_at"),
  
  // Snapshot of checklist items at time of run
  checklistSnapshot: jsonb("checklist_snapshot").default([]),
  
  // Timestamps
  createdAt: timestamp("created_at").defaultNow().notNull(),
  completedAt: timestamp("completed_at"),
}, (table) => [
  index("idx_checklist_runs_doc").on(table.documentId),
  index("idx_checklist_runs_version").on(table.versionId),
  index("idx_checklist_runs_status").on(table.status),
]);

export const insertDocumentChecklistRunSchema = createInsertSchema(documentChecklistRuns).extend({
  id: z.any(),
  createdAt: z.any(),
}).omit({ id: true, createdAt: true });

export const documentChecklistItems = pgTable("document_checklist_items", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  runId: varchar("run_id").references(() => documentChecklistRuns.id).notNull(),
  sebiClauseId: varchar("sebi_clause_id").references(() => sebiClauseChecklist.id).notNull(),
  clauseId: varchar("clause_id").references(() => documentClauses.id), // Mapped document clause
  
  // Status
  status: varchar("status", { length: 20 }).default("pending"), // pending, checked, not_applicable, overridden
  isCompliant: boolean("is_compliant"),
  
  // Override Tracking
  isOverridden: boolean("is_overridden").default(false),
  overrideReason: text("override_reason"),
  overriddenBy: varchar("overridden_by").references(() => users.id),
  overriddenAt: timestamp("overridden_at"),
  
  // AI Mapping
  aiMappedClauseRef: varchar("ai_mapped_clause_ref"),
  aiConfidence: integer("ai_confidence"),
  aiNotes: text("ai_notes"),
  
  // Manual Notes
  reviewerNotes: text("reviewer_notes"),
  reviewedBy: varchar("reviewed_by").references(() => users.id),
  reviewedAt: timestamp("reviewed_at"),
  
  // Timestamps
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("idx_checklist_items_run").on(table.runId),
  index("idx_checklist_items_sebi").on(table.sebiClauseId),
  index("idx_checklist_items_status").on(table.status),
]);

export const insertDocumentChecklistItemSchema = createInsertSchema(documentChecklistItems).extend({
  id: z.any(),
  createdAt: z.any(),
  updatedAt: z.any(),
}).omit({ id: true, createdAt: true, updatedAt: true });

export const documentAiReviews = pgTable("document_ai_reviews", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  documentId: varchar("document_id").references(() => documents.id).notNull(),
  versionId: varchar("version_id").references(() => documentVersions.id).notNull(),
  
  // Review Details
  reviewType: varchar("review_type", { length: 50 }).default("compliance"), // compliance, legal, risk
  modelUsed: varchar("model_used", { length: 100 }), // e.g., "gemini-pro"
  
  // Results
  overallScore: integer("overall_score"), // 0-100
  riskScore: integer("risk_score"), // 0-100
  complianceScore: integer("compliance_score"), // 0-100
  
  // Detailed Findings
  findings: jsonb("findings").default([]), // Array of {clause, issue, severity, suggestion}
  missingClauses: jsonb("missing_clauses").default([]), // Clauses that should be present
  riskFactors: jsonb("risk_factors").default([]), // Identified risks
  recommendations: jsonb("recommendations").default([]), // Suggested improvements
  
  // Clause Mapping
  clauseMapping: jsonb("clause_mapping").default([]), // AI-mapped clauses to SEBI checklist
  
  // Report Storage
  reportPdfUrl: varchar("report_pdf_url", { length: 1000 }),
  reportJsonUrl: varchar("report_json_url", { length: 1000 }),
  reportHash: varchar("report_hash", { length: 128 }),
  
  // Confidence & Explainability
  overallConfidence: integer("overall_confidence"), // 0-100
  explainabilityNotes: text("explainability_notes"),
  limitations: text("limitations"),
  
  // Admin Acknowledgment
  isAcknowledged: boolean("is_acknowledged").default(false),
  acknowledgedBy: varchar("acknowledged_by").references(() => users.id),
  acknowledgedAt: timestamp("acknowledged_at"),
  acknowledgmentNotes: text("acknowledgment_notes"),
  
  // Timestamps
  createdAt: timestamp("created_at").defaultNow().notNull(),
  processingTime: integer("processing_time"), // in milliseconds
}, (table) => [
  index("idx_ai_reviews_doc").on(table.documentId),
  index("idx_ai_reviews_version").on(table.versionId),
  index("idx_ai_reviews_score").on(table.overallScore),
]);

export const insertDocumentAiReviewSchema = createInsertSchema(documentAiReviews).extend({
  id: z.any(),
  createdAt: z.any(),
}).omit({ id: true, createdAt: true });

export const documentAuditEvents = pgTable("document_audit_events", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  documentId: varchar("document_id").references(() => documents.id).notNull(),
  versionId: varchar("version_id").references(() => documentVersions.id),
  
  // Event Details
  eventType: varchar("event_type", { length: 100 }).notNull(), // created, viewed, edited, status_changed, signed, etc.
  eventCategory: varchar("event_category", { length: 50 }), // document, workflow, compliance, signature
  
  // Actor
  actorId: varchar("actor_id").references(() => users.id),
  actorRole: varchar("actor_role", { length: 50 }),
  actorName: varchar("actor_name", { length: 255 }),
  
  // Event Data
  eventData: jsonb("event_data").default({}),
  previousState: jsonb("previous_state"),
  newState: jsonb("new_state"),
  
  // Integrity
  eventHash: varchar("event_hash", { length: 128 }).notNull(), // SHA-256 hash of event
  previousEventHash: varchar("previous_event_hash", { length: 128 }), // Chain link
  
  // IP & Device
  ipAddress: varchar("ip_address", { length: 50 }),
  userAgent: text("user_agent"),
  sessionId: varchar("session_id", { length: 100 }),
  
  // Timestamp (immutable)
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  index("idx_audit_events_doc").on(table.documentId),
  index("idx_audit_events_actor").on(table.actorId),
  index("idx_audit_events_type").on(table.eventType),
  index("idx_audit_events_hash").on(table.eventHash),
  index("idx_audit_events_time").on(table.createdAt),
]);

export const insertDocumentAuditEventSchema = createInsertSchema(documentAuditEvents).extend({
  id: z.any(),
  createdAt: z.any(),
}).omit({ id: true, createdAt: true });

export const documentSignatures = pgTable("document_signatures", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  documentId: varchar("document_id").references(() => documents.id).notNull(),
  versionId: varchar("version_id").references(() => documentVersions.id).notNull(),
  
  // Signer Details
  signerId: varchar("signer_id").references(() => users.id),
  signerName: varchar("signer_name", { length: 255 }).notNull(),
  signerEmail: varchar("signer_email", { length: 255 }),
  signerPhone: varchar("signer_phone", { length: 20 }),
  signerRole: varchar("signer_role", { length: 50 }),
  signerDesignation: varchar("signer_designation", { length: 100 }),
  
  // Signature Method
  signatureMethod: varchar("signature_method", { length: 50 }).notNull(), // aadhaar_esign, dsc, physical
  signatureProvider: varchar("signature_provider", { length: 50 }), // authbridge, protean
  
  // Signature Details
  status: varchar("status", { length: 20 }).default("pending"), // pending, in_progress, signed, rejected, expired
  signatureRef: varchar("signature_ref", { length: 255 }), // Provider reference
  transactionId: varchar("transaction_id", { length: 255 }),
  
  // Verification
  verificationMethod: varchar("verification_method", { length: 50 }), // aadhaar_otp, biometric, dsc
  verificationRef: varchar("verification_ref"),
  
  // Certificate
  certificateData: jsonb("certificate_data"),
  certificateHash: varchar("certificate_hash", { length: 128 }),
  
  // Binding
  documentHash: varchar("document_hash", { length: 128 }).notNull(), // Hash of document at signing
  signatureHash: varchar("signature_hash", { length: 128 }),
  
  // IP & Device
  ipAddress: varchar("ip_address", { length: 50 }),
  userAgent: text("user_agent"),
  
  // Consent
  consentCaptured: boolean("consent_captured").default(false),
  consentText: text("consent_text"),
  consentTimestamp: timestamp("consent_timestamp"),
  
  // Timestamps
  requestedAt: timestamp("requested_at").defaultNow().notNull(),
  signedAt: timestamp("signed_at"),
  expiresAt: timestamp("expires_at"),
}, (table) => [
  index("idx_signatures_doc").on(table.documentId),
  index("idx_signatures_signer").on(table.signerId),
  index("idx_signatures_status").on(table.status),
  index("idx_signatures_ref").on(table.signatureRef),
]);

export const insertDocumentSignatureSchema = createInsertSchema(documentSignatures).extend({
  id: z.any(),
  requestedAt: z.any(),
}).omit({ id: true, requestedAt: true });

export const documentRenewals = pgTable("document_renewals", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  documentId: varchar("document_id").references(() => documents.id).notNull(),
  
  // Renewal Details
  renewalType: varchar("renewal_type", { length: 50 }).default("expiry"), // expiry, regulatory_change, override_trigger
  triggerReason: text("trigger_reason"),
  
  // Dates
  originalExpiryDate: date("original_expiry_date"),
  reminderT90Sent: boolean("reminder_t90_sent").default(false),
  reminderT60Sent: boolean("reminder_t60_sent").default(false),
  reminderT30Sent: boolean("reminder_t30_sent").default(false),
  
  // AI Analysis
  aiComparisonDone: boolean("ai_comparison_done").default(false),
  clauseDrift: jsonb("clause_drift").default([]), // Changes from original
  riskDelta: jsonb("risk_delta").default({}),
  recommendedFixes: jsonb("recommended_fixes").default([]),
  
  // Status
  status: varchar("status", { length: 20 }).default("pending"), // pending, in_progress, completed, skipped
  newDocumentId: varchar("new_document_id").references(() => documents.id),
  
  // Timestamps
  createdAt: timestamp("created_at").defaultNow().notNull(),
  completedAt: timestamp("completed_at"),
}, (table) => [
  index("idx_renewals_doc").on(table.documentId),
  index("idx_renewals_status").on(table.status),
]);

export const insertDocumentRenewalSchema = createInsertSchema(documentRenewals).extend({
  id: z.any(),
  createdAt: z.any(),
}).omit({ id: true, createdAt: true });

export const documentOverrides = pgTable("document_overrides", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  documentId: varchar("document_id").references(() => documents.id).notNull(),
  checklistItemId: varchar("checklist_item_id").references(() => documentChecklistItems.id),
  
  // Override Details
  overrideType: varchar("override_type", { length: 50 }).notNull(), // checklist, ai_recommendation, workflow
  clauseCode: varchar("clause_code", { length: 50 }),
  
  // Reason
  reason: text("reason").notNull(),
  justification: text("justification"),
  
  // Actor
  overriddenBy: varchar("overridden_by").references(() => users.id).notNull(),
  overriddenByRole: varchar("overridden_by_role", { length: 50 }).notNull(),
  
  // Second Level Approval (if required)
  requiresSecondApproval: boolean("requires_second_approval").default(false),
  secondApprovalBy: varchar("second_approval_by").references(() => users.id),
  secondApprovalAt: timestamp("second_approval_at"),
  secondApprovalNotes: text("second_approval_notes"),
  
  // Risk Assessment
  riskLevel: varchar("risk_level", { length: 20 }), // low, medium, high, critical
  
  // Timestamps
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  index("idx_overrides_doc").on(table.documentId),
  index("idx_overrides_actor").on(table.overriddenBy),
  index("idx_overrides_type").on(table.overrideType),
  index("idx_overrides_clause").on(table.clauseCode),
]);

export const insertDocumentOverrideSchema = createInsertSchema(documentOverrides).extend({
  id: z.any(),
  createdAt: z.any(),
}).omit({ id: true, createdAt: true });
export type Document = typeof documents.$inferSelect;
export type InsertDocument = typeof documents.$inferInsert;
export type DocumentVersion = typeof documentVersions.$inferSelect;
export type InsertDocumentVersion = typeof documentVersions.$inferInsert;
