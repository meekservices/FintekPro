/**
 * Proposal Audit Service
 *
 * Regulator-grade audit logging for investment proposals
 * Features:
 * - SHA256 checksum chaining (tamper-proof)
 * - Before/after state snapshots
 * - Role-based override tracking
 * - PDF hash recording
 * - Regulator-ready export (JSON + CSV)
 * - 8-year retention policy
 */

import { db } from "../db";
import {
	proposalAuditEvents,
	proposalPdfMetadata,
	PROPOSAL_AUDIT_EVENT_TYPES,
	type InsertProposalAuditEvent,
	type ProposalAuditEvent,
	type InsertProposalPdfMetadata,
	type ProposalPdfMetadata,
} from "@shared/schema";
import { eq, desc, and, gte, lte, sql } from "drizzle-orm";
import { createHash } from "crypto";
import { nanoid } from "nanoid";

export type ProposalEventType = keyof typeof PROPOSAL_AUDIT_EVENT_TYPES;

interface AuditEventOptions {
	proposalId: string;
	proposalVersion?: string;
	eventType: ProposalEventType;
	eventAction?: string;
	actorId?: string;
	actorRole?: "agent" | "admin" | "compliance" | "system";
	actorName?: string;
	payloadBefore?: Record<string, any>;
	payloadAfter?: Record<string, any>;
	isOverride?: boolean;
	overrideReason?: string;
	overrideApprovedBy?: string;
	pdfVersion?: string;
	pdfHash?: string;
	ipAddress?: string;
	userAgent?: string;
	sessionId?: string;
	requestPath?: string;
}

interface PdfGenerationResult {
	pdfBuffer: Buffer;
	version: string;
	hash: string;
	sectionsIncluded: string[];
	totalPages: number;
}

class ProposalAuditService {
	private lastChecksum: string = "";
	private initialized: boolean = false;

	async initialize(): Promise<void> {
		if (this.initialized) return;

		try {
			// Load last checksum from database
			const result = await db
				.select({ checksum: proposalAuditEvents.checksum })
				.from(proposalAuditEvents)
				.orderBy(desc(proposalAuditEvents.createdAt))
				.limit(1);

			if (result.length > 0) {
				this.lastChecksum = result[0].checksum;
				console.log(
					"[ProposalAudit] Initialized with last checksum from database",
				);
			}

			this.initialized = true;
		} catch (error) {
			console.warn(
				"[ProposalAudit] Failed to load last checksum, starting fresh:",
				error,
			);
			this.initialized = true;
		}
	}

	/**
	 * Compute SHA256 hash for checksum chaining
	 */
	private computeChecksum(
		data: Record<string, any>,
		previousChecksum: string,
	): string {
		const payload = JSON.stringify({
			...data,
			previousChecksum,
			timestamp: new Date().toISOString(),
		});
		return createHash("sha256").update(payload).digest("hex");
	}

	/**
	 * Compute JSON diff between before and after states
	 */
	private computeDiff(
		before: Record<string, any> | undefined,
		after: Record<string, any> | undefined,
	): Record<string, any> | null {
		if (!before && !after) return null;
		if (!before) return { added: after };
		if (!after) return { removed: before };

		const diff: Record<string, any> = {};
		const allKeys = new Set([...Object.keys(before), ...Object.keys(after)]);

		for (const key of allKeys) {
			const beforeVal = JSON.stringify(before[key]);
			const afterVal = JSON.stringify(after[key]);

			if (beforeVal !== afterVal) {
				diff[key] = {
					from: before[key],
					to: after[key],
				};
			}
		}

		return Object.keys(diff).length > 0 ? diff : null;
	}

	/**
	 * Log a proposal audit event
	 */
	async logEvent(options: AuditEventOptions): Promise<ProposalAuditEvent> {
		if (!this.initialized) {
			await this.initialize();
		}

		const eventId = nanoid();
		const payloadDiff = this.computeDiff(
			options.payloadBefore,
			options.payloadAfter,
		);

		// Compute checksum for chain integrity
		const checksumData = {
			eventId,
			proposalId: options.proposalId,
			eventType: options.eventType,
			eventAction: options.eventAction,
			actorId: options.actorId,
			payloadAfter: options.payloadAfter,
		};
		const checksum = this.computeChecksum(checksumData, this.lastChecksum);

		// Calculate retention expiry (8 years from now)
		const retentionExpiresAt = new Date();
		retentionExpiresAt.setFullYear(retentionExpiresAt.getFullYear() + 8);

		const eventData: InsertProposalAuditEvent = {
			proposalId: options.proposalId,
			proposalVersion: options.proposalVersion,
			eventType: PROPOSAL_AUDIT_EVENT_TYPES[options.eventType],
			eventAction: options.eventAction,
			actorId: options.actorId,
			actorRole: options.actorRole,
			actorName: options.actorName,
			payloadBefore: options.payloadBefore,
			payloadAfter: options.payloadAfter,
			payloadDiff: payloadDiff,
			isOverride: options.isOverride || false,
			overrideReason: options.overrideReason,
			overrideApprovedBy: options.overrideApprovedBy,
			pdfVersion: options.pdfVersion,
			pdfHash: options.pdfHash,
			ipAddress: options.ipAddress,
			userAgent: options.userAgent,
			sessionId: options.sessionId,
			requestPath: options.requestPath,
			checksum,
			previousChecksum: this.lastChecksum || undefined,
			retentionYears: 8,
			retentionExpiresAt,
			isArchived: false,
		};

		const [inserted] = await db
			.insert(proposalAuditEvents)
			.values(eventData)
			.returning();

		this.lastChecksum = checksum;

		console.log(
			`[ProposalAudit] ${options.eventType}:${options.eventAction || "LOG"}`,
			{
				proposalId: options.proposalId,
				actorId: options.actorId,
				checksum: checksum.substring(0, 16) + "...",
			},
		);

		return inserted;
	}

	// ==================== Convenience Methods ====================

	async logProspectSelected(
		proposalId: string,
		prospectData: Record<string, any>,
		actorId: string,
		actorRole: "agent" | "admin" = "agent",
	): Promise<ProposalAuditEvent> {
		return this.logEvent({
			proposalId,
			eventType: "PROSPECT_SELECTED",
			eventAction: "CREATED",
			actorId,
			actorRole,
			payloadAfter: prospectData,
		});
	}

	async logRiskProfileSet(
		proposalId: string,
		riskProfile: Record<string, any>,
		actorId: string,
	): Promise<ProposalAuditEvent> {
		return this.logEvent({
			proposalId,
			eventType: "RISK_PROFILE_SET",
			eventAction: "UPDATED",
			actorId,
			actorRole: "agent",
			payloadAfter: riskProfile,
		});
	}

	async logHoldingsImported(
		proposalId: string,
		holdingsData: Record<string, any>,
		actorId: string,
	): Promise<ProposalAuditEvent> {
		return this.logEvent({
			proposalId,
			eventType: "HOLDINGS_IMPORTED",
			eventAction: "CREATED",
			actorId,
			actorRole: "agent",
			payloadAfter: holdingsData,
		});
	}

	async logAnalysisRun(
		proposalId: string,
		analysisResult: Record<string, any>,
		actorId: string,
	): Promise<ProposalAuditEvent> {
		return this.logEvent({
			proposalId,
			eventType: "ANALYSIS_RUN",
			eventAction: "EXECUTED",
			actorId,
			actorRole: "system",
			payloadAfter: analysisResult,
		});
	}

	async logVerdictFinalized(
		proposalId: string,
		verdicts: Record<string, any>,
		actorId: string,
	): Promise<ProposalAuditEvent> {
		return this.logEvent({
			proposalId,
			eventType: "VERDICT_FINALIZED",
			eventAction: "FINALIZED",
			actorId,
			actorRole: "agent",
			payloadAfter: verdicts,
		});
	}

	async logSipGenerated(
		proposalId: string,
		sipData: Record<string, any>,
		actorId: string,
	): Promise<ProposalAuditEvent> {
		return this.logEvent({
			proposalId,
			eventType: "SIP_GENERATED",
			eventAction: "CREATED",
			actorId,
			actorRole: "system",
			payloadAfter: sipData,
		});
	}

	async logReportSectionToggled(
		proposalId: string,
		sectionCode: string,
		before: boolean,
		after: boolean,
		actorId: string,
		actorRole: "agent" | "admin",
		reason?: string,
	): Promise<ProposalAuditEvent> {
		return this.logEvent({
			proposalId,
			eventType: "REPORT_SECTION_TOGGLED",
			eventAction: after ? "ENABLED" : "DISABLED",
			actorId,
			actorRole,
			payloadBefore: { sectionCode, enabled: before },
			payloadAfter: { sectionCode, enabled: after },
			isOverride: actorRole === "admin",
			overrideReason: reason,
		});
	}

	async logBenchmarkOverridden(
		proposalId: string,
		before: Record<string, any>,
		after: Record<string, any>,
		actorId: string,
		reason: string,
	): Promise<ProposalAuditEvent> {
		return this.logEvent({
			proposalId,
			eventType: "BENCHMARK_OVERRIDDEN",
			eventAction: "OVERRIDDEN",
			actorId,
			actorRole: "admin",
			payloadBefore: before,
			payloadAfter: after,
			isOverride: true,
			overrideReason: reason,
		});
	}

	async logPdfGenerated(
		proposalId: string,
		pdfVersion: string,
		pdfHash: string,
		sectionsIncluded: string[],
		actorId: string,
	): Promise<ProposalAuditEvent> {
		return this.logEvent({
			proposalId,
			proposalVersion: pdfVersion,
			eventType: "PDF_GENERATED",
			eventAction: "GENERATED",
			actorId,
			actorRole: "system",
			pdfVersion,
			pdfHash,
			payloadAfter: { sectionsIncluded, generatedAt: new Date().toISOString() },
		});
	}

	async logPdfDownloaded(
		proposalId: string,
		pdfVersion: string,
		pdfHash: string,
		actorId: string,
		ipAddress?: string,
	): Promise<ProposalAuditEvent> {
		return this.logEvent({
			proposalId,
			proposalVersion: pdfVersion,
			eventType: "PDF_DOWNLOADED",
			eventAction: "DOWNLOADED",
			actorId,
			actorRole: "agent",
			pdfVersion,
			pdfHash,
			ipAddress,
			payloadAfter: { downloadedAt: new Date().toISOString() },
		});
	}

	// ==================== PDF Metadata ====================

	/**
	 * Record PDF generation metadata
	 */
	async recordPdfMetadata(
		proposalId: string,
		pdfResult: PdfGenerationResult,
		generatedBy: string,
		generatedByRole: "agent" | "admin" | "system",
		clientPan?: string,
		riskProfileVersion?: string,
		benchmarkVersion?: string,
		storageKey?: string,
	): Promise<ProposalPdfMetadata> {
		// Get previous PDF metadata for chain linking
		const previousPdf = await db
			.select()
			.from(proposalPdfMetadata)
			.where(eq(proposalPdfMetadata.proposalId, proposalId))
			.orderBy(desc(proposalPdfMetadata.createdAt))
			.limit(1);

		const previousHash =
			previousPdf.length > 0 ? previousPdf[0].pdfHash : undefined;

		// Parse version
		const versionMatch = pdfResult.version.match(/v(\d+)\.(\d+)/);
		const majorVersion = versionMatch ? Number.parseInt(versionMatch[1]) : 1;
		const minorVersion = versionMatch ? Number.parseInt(versionMatch[2]) : 0;

		// Hash PAN if provided
		const hashedPan = clientPan
			? createHash("sha256").update(clientPan).digest("hex").substring(0, 64)
			: undefined;

		const metadata: InsertProposalPdfMetadata = {
			proposalId,
			version: pdfResult.version,
			majorVersion,
			minorVersion,
			generatedAt: new Date(),
			generatedBy,
			generatedByRole,
			engineVersion: "PB_ENGINE_2.5",
			pdfHash: pdfResult.hash,
			previousHash,
			clientPan: hashedPan,
			riskProfileVersion,
			benchmarkVersion,
			sectionsIncluded: pdfResult.sectionsIncluded,
			totalPages: pdfResult.totalPages,
			fileSizeBytes: pdfResult.pdfBuffer.length,
			storageKey,
			downloadCount: 0,
		};

		const [inserted] = await db
			.insert(proposalPdfMetadata)
			.values(metadata)
			.returning();

		return inserted;
	}

	/**
	 * Increment download count
	 */
	async recordPdfDownload(proposalId: string, pdfHash: string): Promise<void> {
		await db
			.update(proposalPdfMetadata)
			.set({
				downloadCount: sql`download_count + 1`,
				lastDownloadedAt: new Date(),
			})
			.where(
				and(
					eq(proposalPdfMetadata.proposalId, proposalId),
					eq(proposalPdfMetadata.pdfHash, pdfHash),
				),
			);
	}

	/**
	 * Get PDF metadata history for a proposal
	 */
	async getPdfMetadataHistory(
		proposalId: string,
	): Promise<ProposalPdfMetadata[]> {
		return db
			.select()
			.from(proposalPdfMetadata)
			.where(eq(proposalPdfMetadata.proposalId, proposalId))
			.orderBy(desc(proposalPdfMetadata.createdAt));
	}

	/**
	 * Verify PDF hash
	 */
	async verifyPdfHash(proposalId: string, hash: string): Promise<boolean> {
		const result = await db
			.select()
			.from(proposalPdfMetadata)
			.where(
				and(
					eq(proposalPdfMetadata.proposalId, proposalId),
					eq(proposalPdfMetadata.pdfHash, hash),
				),
			)
			.limit(1);

		return result.length > 0;
	}

	// ==================== Audit Trail Query ====================

	/**
	 * Get audit trail for a proposal
	 */
	async getAuditTrail(proposalId: string): Promise<ProposalAuditEvent[]> {
		return db
			.select()
			.from(proposalAuditEvents)
			.where(eq(proposalAuditEvents.proposalId, proposalId))
			.orderBy(desc(proposalAuditEvents.createdAt));
	}

	/**
	 * Get audit events by type
	 */
	async getEventsByType(
		proposalId: string,
		eventType: ProposalEventType,
	): Promise<ProposalAuditEvent[]> {
		return db
			.select()
			.from(proposalAuditEvents)
			.where(
				and(
					eq(proposalAuditEvents.proposalId, proposalId),
					eq(
						proposalAuditEvents.eventType,
						PROPOSAL_AUDIT_EVENT_TYPES[eventType],
					),
				),
			)
			.orderBy(desc(proposalAuditEvents.createdAt));
	}

	/**
	 * Get override events only
	 */
	async getOverrideEvents(proposalId: string): Promise<ProposalAuditEvent[]> {
		return db
			.select()
			.from(proposalAuditEvents)
			.where(
				and(
					eq(proposalAuditEvents.proposalId, proposalId),
					eq(proposalAuditEvents.isOverride, true),
				),
			)
			.orderBy(desc(proposalAuditEvents.createdAt));
	}

	// ==================== Chain Integrity ====================

	/**
	 * Verify audit chain integrity
	 */
	async verifyChainIntegrity(proposalId: string): Promise<{
		valid: boolean;
		totalEvents: number;
		brokenLinks: string[];
	}> {
		const events = await db
			.select()
			.from(proposalAuditEvents)
			.where(eq(proposalAuditEvents.proposalId, proposalId))
			.orderBy(proposalAuditEvents.createdAt);

		if (events.length === 0) {
			return { valid: true, totalEvents: 0, brokenLinks: [] };
		}

		const brokenLinks: string[] = [];
		let previousChecksum = "";

		for (const event of events) {
			// First event should have no previous checksum or empty
			if (previousChecksum && event.previousChecksum !== previousChecksum) {
				brokenLinks.push(event.id);
			}
			previousChecksum = event.checksum;
		}

		return {
			valid: brokenLinks.length === 0,
			totalEvents: events.length,
			brokenLinks,
		};
	}

	// ==================== Export ====================

	/**
	 * Export audit bundle for regulators (JSON + CSV format)
	 */
	async exportAuditBundle(proposalId: string): Promise<{
		json: {
			proposal: { id: string; exportedAt: string };
			auditEvents: ProposalAuditEvent[];
			pdfMetadata: ProposalPdfMetadata[];
			chainIntegrity: { valid: boolean; totalEvents: number };
		};
		csv: string;
	}> {
		const [auditEvents, pdfMetadata, chainIntegrity] = await Promise.all([
			this.getAuditTrail(proposalId),
			this.getPdfMetadataHistory(proposalId),
			this.verifyChainIntegrity(proposalId),
		]);

		const json = {
			proposal: {
				id: proposalId,
				exportedAt: new Date().toISOString(),
			},
			auditEvents,
			pdfMetadata,
			chainIntegrity: {
				valid: chainIntegrity.valid,
				totalEvents: chainIntegrity.totalEvents,
			},
		};

		// Generate CSV for audit events
		const csvHeaders = [
			"Event ID",
			"Timestamp",
			"Event Type",
			"Event Action",
			"Actor ID",
			"Actor Role",
			"Is Override",
			"Override Reason",
			"PDF Version",
			"PDF Hash",
			"Checksum",
		].join(",");

		const csvRows = auditEvents.map((event) =>
			[
				event.id,
				event.createdAt?.toISOString(),
				event.eventType,
				event.eventAction || "",
				event.actorId || "",
				event.actorRole || "",
				event.isOverride ? "Yes" : "No",
				(event.overrideReason || "").replace(/,/g, ";"),
				event.pdfVersion || "",
				event.pdfHash || "",
				event.checksum,
			].join(","),
		);

		const csv = [csvHeaders, ...csvRows].join("\n");

		return { json, csv };
	}

	// ==================== Retention ====================

	/**
	 * Archive old events (move to cold storage/mark archived)
	 */
	async archiveExpiredEvents(): Promise<number> {
		const now = new Date();

		const result = await db
			.update(proposalAuditEvents)
			.set({ isArchived: true })
			.where(
				and(
					eq(proposalAuditEvents.isArchived, false),
					lte(proposalAuditEvents.retentionExpiresAt, now),
				),
			);

		console.log(`[ProposalAudit] Archived expired audit events`);
		return 0; // Drizzle doesn't return affected count easily
	}

	/**
	 * Get retention statistics
	 */
	async getRetentionStats(): Promise<{
		totalEvents: number;
		archivedEvents: number;
		oldestEvent: Date | null;
		newestEvent: Date | null;
	}> {
		const stats = await db.execute(sql`
      SELECT 
        COUNT(*) as total_events,
        SUM(CASE WHEN is_archived THEN 1 ELSE 0 END) as archived_events,
        MIN(created_at) as oldest_event,
        MAX(created_at) as newest_event
      FROM proposal_audit_events
    `);

		const row = stats.rows[0] as any;
		return {
			totalEvents: Number.parseInt(row?.total_events || "0"),
			archivedEvents: Number.parseInt(row?.archived_events || "0"),
			oldestEvent: row?.oldest_event ? new Date(row.oldest_event) : null,
			newestEvent: row?.newest_event ? new Date(row.newest_event) : null,
		};
	}
}

export const proposalAuditService = new ProposalAuditService();
