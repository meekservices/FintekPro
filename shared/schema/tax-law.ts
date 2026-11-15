import { sql } from "drizzle-orm";
import { pgTable, text, varchar, timestamp, boolean, integer, jsonb, decimal } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { users } from "./users";

/**
 * Income Tax Statute Sections (Income-tax Act, 1961)
 * Fully indexed sections for CA & CS professional advisory
 */
export const taxStatuteSections = pgTable("tax_statute_sections", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  sectionNumber: varchar("section_number", { length: 50 }).notNull().unique(), // e.g. "54F", "115JB", "148", "44AB", "56(2)(viib)"
  title: text("title").notNull(),
  chapter: varchar("chapter", { length: 50 }).notNull(), // e.g. "Chapter IV", "Chapter XII-B", "Chapter XIV"
  chapterTitle: text("chapter_title"), // e.g. "Special Provisions Relating to Certain Companies"
  subChapter: varchar("sub_chapter", { length: 50 }),
  bareActSummary: text("bare_act_summary").notNull(),
  fullStatutoryText: text("full_statutory_text").notNull(),
  assessmentYearApplicable: varchar("assessment_year_applicable", { length: 20 }).default("2025-26"),
  amendedByFinanceAct: varchar("amended_by_finance_act", { length: 100 }), // e.g. "Finance (No. 2) Act, 2024"
  amendmentNotes: text("amendment_notes"),
  targetProfession: varchar("target_profession", { length: 20 }).notNull().default("both"), // 'both' | 'ca' | 'cs'
  relatedRules: jsonb("related_rules").$type<string[]>().default([]), // e.g. ["Rule 11UA", "Rule 6G"]
  relatedForms: jsonb("related_forms").$type<string[]>().default([]), // e.g. ["Form 3CD", "Form 15CB", "ITR-6"]
  form3cdClauses: jsonb("form3cd_clauses").$type<number[]>().default([]), // e.g. [17, 21, 26, 31]
  tags: jsonb("tags").$type<string[]>().default([]),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

/**
 * Income Tax Statute Rules (Income-tax Rules, 1962)
 */
export const taxStatuteRules = pgTable("tax_statute_rules", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  ruleNumber: varchar("rule_number", { length: 50 }).notNull().unique(), // e.g. "Rule 11UA", "Rule 6G", "Rule 37BB"
  title: text("title").notNull(),
  parentSection: varchar("parent_section", { length: 50 }).notNull(), // e.g. "56(2)(viib)", "44AB", "195"
  ruleSummary: text("rule_summary").notNull(),
  statutoryText: text("statutory_text").notNull(),
  associatedForm: varchar("associated_form", { length: 50 }), // e.g. "Form 3CD", "Form 15CB"
  targetProfession: varchar("target_profession", { length: 20 }).notNull().default("both"),
  tags: jsonb("tags").$type<string[]>().default([]),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

/**
 * CBDT Circulars and Notifications
 */
export const taxCbdtCirculars = pgTable("tax_cbdt_circulars", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  notificationType: varchar("notification_type", { length: 30 }).notNull().default("circular"), // 'circular' | 'notification' | 'order'
  circularNumber: varchar("circular_number", { length: 100 }).notNull(), // e.g. "Circular No. 12/2024"
  issuedDate: varchar("issued_date", { length: 20 }).notNull(), // YYYY-MM-DD
  subject: text("subject").notNull(),
  summary: text("summary").notNull(),
  sectionsCovered: jsonb("sections_covered").$type<string[]>().default([]),
  clarificationRatio: text("clarification_ratio"),
  pdfUrl: text("pdf_url"),
  targetProfession: varchar("target_profession", { length: 20 }).default("both"),
  createdAt: timestamp("created_at").defaultNow(),
});

/**
 * Judicial Precedents & Case Law (SC, High Courts, ITAT)
 */
export const taxJudicialPrecedents = pgTable("tax_judicial_precedents", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  caseTitle: text("case_title").notNull(), // e.g. "CIT v. Reliance Industries Ltd."
  citation: varchar("citation", { length: 150 }).notNull(), // e.g. "[2023] 455 ITR 1 (SC)"
  courtBench: varchar("court_bench", { length: 100 }).notNull(), // "Supreme Court of India", "Bombay High Court", "ITAT Mumbai"
  judgementDate: varchar("judgement_date", { length: 20 }),
  assessmentYear: varchar("assessment_year", { length: 20 }),
  sectionCovered: varchar("section_covered", { length: 50 }).notNull(),
  ratioDecidendi: text("ratio_decidendi").notNull(), // Core legal proposition
  headnote: text("headnote").notNull(),
  decisionInFavorOf: varchar("decision_in_favor_of", { length: 20 }).notNull(), // 'Assessee' | 'Revenue' | 'Remanded'
  keyPrinciples: jsonb("key_principles").$type<string[]>().default([]),
  targetProfession: varchar("target_profession", { length: 20 }).default("both"),
  createdAt: timestamp("created_at").defaultNow(),
});

/**
 * Form 3CD Tax Audit Clauses & Verification Guidelines (for CAs)
 */
export const taxForm3cdClauses = pgTable("tax_form3cd_clauses", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  clauseNumber: integer("clause_number").notNull().unique(), // 1 to 44
  subClause: varchar("sub_clause", { length: 20 }),
  clauseTitle: text("clause_title").notNull(),
  relevantSection: varchar("relevant_section", { length: 100 }).notNull(), // e.g. "40A(3)", "43B", "269SS/T", "50C"
  statutoryLimit: text("statutory_limit"), // e.g. "₹10,000 per person per day for cash payments"
  auditVerificationGuidance: text("audit_verification_guidance").notNull(),
  reportingRequirement: text("reporting_requirement").notNull(),
  riskLevel: varchar("risk_level", { length: 20 }).notNull().default("standard"), // 'high' | 'medium' | 'standard'
  automatedCheckAvailable: boolean("automated_check_available").default(false),
  checkEngineCode: varchar("check_engine_code", { length: 50 }), // e.g. "CHECK_40A3_CASH", "CHECK_43B_MSME"
  createdAt: timestamp("created_at").defaultNow(),
});

/**
 * CS (Company Secretary) Corporate Law & Tax Intersecting Modules
 */
export const taxCsCorporateModules = pgTable("tax_cs_corporate_modules", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  moduleCode: varchar("module_code", { length: 50 }).notNull().unique(), // e.g. "RULE_11UA_VALUATION", "BUYBACK_115QA"
  moduleName: text("module_name").notNull(),
  itActSection: varchar("it_act_section", { length: 100 }).notNull(), // e.g. "Section 56(2)(viib)"
  companiesActSection: varchar("companies_act_section", { length: 100 }).notNull(), // e.g. "Section 42 & 62, Rule 13"
  governanceTopic: varchar("governance_topic", { length: 100 }).notNull(), // e.g. "Unlisted Share Issuance & Angel Tax"
  overview: text("overview").notNull(),
  secretarialChecklist: jsonb("secretarial_checklist").$type<string[]>().default([]),
  caCertificationRequired: boolean("ca_certification_required").default(false),
  riskFactors: jsonb("risk_factors").$type<string[]>().default([]),
  formulaUsed: text("formula_used"),
  createdAt: timestamp("created_at").defaultNow(),
});

/**
 * AI Advisory & Legal Research Logs (FASP-AI v1.0 Compliance)
 */
export const taxAiAdvisoryLogs = pgTable("tax_ai_advisory_logs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id),
  professionalRole: varchar("professional_role", { length: 20 }).notNull().default("ca"), // 'ca' | 'cs' | 'admin'
  queryPrompt: text("query_prompt").notNull(),
  sectionsConsidered: jsonb("sections_considered").$type<string[]>().default([]),
  precedentsCited: jsonb("precedents_cited").$type<string[]>().default([]),
  recommendationSummary: text("recommendation_summary").notNull(),
  confidenceScore: decimal("confidence_score", { precision: 5, scale: 2 }).notNull(), // e.g. 94.50
  factorsConsidered: jsonb("factors_considered").$type<string[]>().default([]),
  modelVersion: varchar("model_version", { length: 50 }).notNull().default("FASP-TAX-AI-v1.0"),
  reviewedByProfessional: boolean("reviewed_by_professional").default(false),
  mandatoryDisclaimer: text("mandatory_disclaimer").notNull(),
  timestamp: timestamp("timestamp").defaultNow(),
});

/**
 * Autonomous Regulatory Amendment Proposals & Staging Pipeline
 * Receives auto-scraped circulars, notifications, and statutory amendments
 * with automated regression testing and compliance officer sign-off gate.
 */
export const regulatoryAmendmentProposals = pgTable("regulatory_amendment_proposals", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  regulator: varchar("regulator", { length: 30 }).notNull(), // 'CBDT' | 'SEBI' | 'MCA' | 'IRS' | 'RBI' | 'DPBI' | 'CERT_IN'
  documentNumber: varchar("document_number", { length: 150 }).notNull(), // e.g. "Circular No. 12/2025"
  documentTitle: text("document_title").notNull(),
  sourceUrl: text("source_url"),
  gazetteDate: varchar("gazette_date", { length: 20 }).notNull(), // YYYY-MM-DD
  effectiveDate: varchar("effective_date", { length: 20 }).notNull(), // YYYY-MM-DD
  statutoryAct: varchar("statutory_act", { length: 150 }).notNull(), // e.g. "Income-tax Act, 1961"
  sectionAffected: varchar("section_affected", { length: 100 }).notNull(), // e.g. "Section 112A"
  amendmentType: varchar("amendment_type", { length: 50 }).notNull(), // 'rate_change' | 'threshold_change' | 'procedural' | 'new_rule'
  parsedDiff: jsonb("parsed_diff").$type<{
    fieldModified: string;
    oldValue: any;
    newValue: any;
    changeSummary: string;
    grandfatheringNotes?: string;
    calculationImpact: string;
  }>().notNull(),
  rawSummary: text("raw_summary").notNull(),
  status: varchar("status", { length: 30 }).notNull().default("pending_review"), // 'pending_review' | 'approved' | 'rejected' | 'promoted_to_engine'
  promotedEngineVersion: varchar("promoted_engine_version", { length: 50 }),
  regressionTestStatus: varchar("regression_test_status", { length: 30 }).notNull().default("passed"), // 'pending' | 'passed' | 'failed'
  reviewedBy: varchar("reviewed_by").references(() => users.id),
  reviewedAt: timestamp("reviewed_at"),
  createdAt: timestamp("created_at").defaultNow(),
});

// Zod schemas for validation
export const insertTaxStatuteSectionSchema = createInsertSchema(taxStatuteSections);
export const insertTaxStatuteRuleSchema = createInsertSchema(taxStatuteRules);
export const insertTaxCbdtCircularSchema = createInsertSchema(taxCbdtCirculars);
export const insertTaxJudicialPrecedentSchema = createInsertSchema(taxJudicialPrecedents);
export const insertTaxForm3cdClauseSchema = createInsertSchema(taxForm3cdClauses);
export const insertTaxCsCorporateModuleSchema = createInsertSchema(taxCsCorporateModules);
export const insertTaxAiAdvisoryLogSchema = createInsertSchema(taxAiAdvisoryLogs);
export const insertRegulatoryAmendmentProposalSchema = createInsertSchema(regulatoryAmendmentProposals);

export type TaxStatuteSection = typeof taxStatuteSections.$inferSelect;
export type TaxStatuteRule = typeof taxStatuteRules.$inferSelect;
export type TaxCbdtCircular = typeof taxCbdtCirculars.$inferSelect;
export type TaxJudicialPrecedent = typeof taxJudicialPrecedents.$inferSelect;
export type TaxForm3cdClause = typeof taxForm3cdClauses.$inferSelect;
export type TaxCsCorporateModule = typeof taxCsCorporateModules.$inferSelect;
export type TaxAiAdvisoryLog = typeof taxAiAdvisoryLogs.$inferSelect;
export type RegulatoryAmendmentProposal = typeof regulatoryAmendmentProposals.$inferSelect;
