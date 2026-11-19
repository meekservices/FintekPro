/**
 * Lead & Prospect Deduplication Guardrail Service (v1.0)
 *
 * Enforces strict anti-collision and deduplication guardrails across:
 * 1. Registered Clients (users table)
 * 2. Active Leads (agentLeads table)
 * 3. HNI Prospects (prospectClients & prospectLeads tables)
 *
 * Guardrail Rules:
 * - PAN match (10-char alphanumeric, case-insensitive)
 * - Mobile match (normalized last 10 digits, stripping +91, 0, spaces, dashes)
 * - Email match (normalized lowercase)
 * - In-batch deduplication for bulk CSV uploads
 */

import { db } from "../db";
import { users, agentLeads, prospectClients } from "@shared/schema";
import { eq, or, and, sql, ne } from "drizzle-orm";
import { logger } from "../logger";

export interface DuplicateRecordInfo {
	id: string;
	name: string;
	email?: string | null;
	phone?: string | null;
	pan?: string | null;
	entityType: "CLIENT" | "LEAD" | "PROSPECT";
	assignedAgentId?: string | null;
	isSameAgent: boolean;
	stageOrStatus?: string | null;
}

export interface DeduplicationCheckResult {
	isDuplicate: boolean;
	duplicateType?:
		| "EXISTING_CLIENT"
		| "EXISTING_LEAD_SAME_AGENT"
		| "EXISTING_LEAD_OTHER_AGENT"
		| "EXISTING_PROSPECT_SAME_AGENT"
		| "EXISTING_PROSPECT_OTHER_AGENT";
	message?: string;
	matchedField?: "pan" | "mobile" | "email";
	existingRecord?: DuplicateRecordInfo;
}

export class LeadDeduplicationService {
	/**
	 * Normalizes a phone string to its canonical 10-digit representation.
	 */
	static normalizePhone(phone?: string | null): string {
		if (!phone) return "";
		const digits = phone.replace(/\D/g, "");
		// In India, numbers typically end with 10 digits after +91 or leading 0
		return digits.length >= 10 ? digits.slice(-10) : digits;
	}

	/**
	 * Normalizes an email string to lowercase trimmed.
	 */
	static normalizeEmail(email?: string | null): string {
		if (!email) return "";
		return email.trim().toLowerCase();
	}

	/**
	 * Normalizes a PAN string to uppercase trimmed.
	 */
	static normalizePan(pan?: string | null): string {
		if (!pan) return "";
		const clean = pan.trim().toUpperCase();
		return /^[A-Z]{5}[0-9]{4}[A-Z]{1}$/.test(clean) ? clean : "";
	}

	/**
	 * Checks whether a given contact is already an existing client, lead, or prospect.
	 *
	 * @param params Contact parameters to check
	 * @returns DeduplicationCheckResult indicating collision status
	 */
	static async checkDuplicate(params: {
		phone?: string | null;
		email?: string | null;
		pan?: string | null;
		agentId: string;
		excludeLeadId?: string;
	}): Promise<DeduplicationCheckResult> {
		const normPhone = this.normalizePhone(params.phone);
		const normEmail = this.normalizeEmail(params.email);
		const normPan = this.normalizePan(params.pan);

		if (!normPhone && !normEmail && !normPan) {
			return { isDuplicate: false };
		}

		// ─────────────────────────────────────────────────────────────────────────────
		// Check 1: Registered Clients (`users` table)
		// Non-clients cannot be registered if they already have an active client account.
		// ─────────────────────────────────────────────────────────────────────────────
		const userConditions = [];
		if (normPan) userConditions.push(eq(users.panNumber, normPan));
		if (normEmail) userConditions.push(eq(users.email, normEmail));
		if (normPhone) {
			userConditions.push(
				sql`RIGHT(REGEXP_REPLACE(${users.mobile}, '[^0-9]', '', 'g'), 10) = ${normPhone}`,
			);
		}

		if (userConditions.length > 0) {
			const [existingUser] = await db
				.select({
					id: users.id,
					firstName: users.firstName,
					lastName: users.lastName,
					email: users.email,
					mobile: users.mobile,
					panNumber: users.panNumber,
					agentId: users.agentId,
				})
				.from(users)
				.where(or(...userConditions))
				.limit(1);

			if (existingUser) {
				const userName = [existingUser.firstName, existingUser.lastName]
					.filter(Boolean)
					.join(" ") || "Client";
				const isSameAgent = existingUser.agentId === params.agentId;

				const matchedField =
					normPan && existingUser.panNumber === normPan
						? "pan"
						: normPhone && this.normalizePhone(existingUser.mobile) === normPhone
							? "mobile"
							: "email";

				logger.info("[DeduplicationGuardrail] Detected duplicate with existing client", {
					userId: existingUser.id,
					agentId: params.agentId,
					matchedField,
				});

				return {
					isDuplicate: true,
					duplicateType: "EXISTING_CLIENT",
					matchedField,
					message: isSameAgent
						? `Contact is already your registered client (${userName}). Please manage them in your Clients portfolio.`
						: `Contact is already a registered client on FintekPro (${userName}) with another advisor.`,
					existingRecord: {
						id: existingUser.id,
						name: userName,
						email: existingUser.email,
						phone: existingUser.mobile,
						pan: existingUser.panNumber,
						entityType: "CLIENT",
						assignedAgentId: existingUser.agentId,
						isSameAgent,
					},
				};
			}
		}

		// ─────────────────────────────────────────────────────────────────────────────
		// Check 2: Active Leads (`agent_leads` table)
		// ─────────────────────────────────────────────────────────────────────────────
		const leadConditions = [];
		if (normEmail) leadConditions.push(eq(sql`LOWER(${agentLeads.email})`, normEmail));
		if (normPhone) {
			leadConditions.push(
				sql`RIGHT(REGEXP_REPLACE(${agentLeads.phone}, '[^0-9]', '', 'g'), 10) = ${normPhone}`,
			);
		}

		if (leadConditions.length > 0) {
			let query = db
				.select({
					id: agentLeads.id,
					name: agentLeads.name,
					email: agentLeads.email,
					phone: agentLeads.phone,
					agentId: agentLeads.agentId,
					stage: agentLeads.stage,
				})
				.from(agentLeads)
				.where(
					and(
						or(...leadConditions),
						ne(agentLeads.stage, "lost"), // lost leads can be re-engaged if needed
						params.excludeLeadId ? ne(agentLeads.id, params.excludeLeadId) : sql`1=1`,
					),
				)
				.limit(1);

			const [existingLead] = await query;

			if (existingLead) {
				const isSameAgent = existingLead.agentId === params.agentId;
				const matchedField =
					normPhone && this.normalizePhone(existingLead.phone) === normPhone
						? "mobile"
						: "email";

				logger.info("[DeduplicationGuardrail] Detected duplicate with existing lead", {
					leadId: existingLead.id,
					agentId: params.agentId,
					matchedField,
					isSameAgent,
				});

				return {
					isDuplicate: true,
					duplicateType: isSameAgent
						? "EXISTING_LEAD_SAME_AGENT"
						: "EXISTING_LEAD_OTHER_AGENT",
					matchedField,
					message: isSameAgent
						? `You already have an active lead for this contact: "${existingLead.name}" in stage [${existingLead.stage}].`
						: `This contact is currently an active lead registered under another advisor.`,
					existingRecord: {
						id: existingLead.id,
						name: existingLead.name,
						email: existingLead.email,
						phone: existingLead.phone,
						entityType: "LEAD",
						assignedAgentId: existingLead.agentId,
						isSameAgent,
						stageOrStatus: existingLead.stage,
					},
				};
			}
		}

		// ─────────────────────────────────────────────────────────────────────────────
		// Check 3: HNI Prospects (`prospect_clients` table)
		// ─────────────────────────────────────────────────────────────────────────────
		const prospectConditions = [];
		if (normPan) prospectConditions.push(eq(prospectClients.pan, normPan));
		if (normEmail) prospectConditions.push(eq(sql`LOWER(${prospectClients.email})`, normEmail));
		if (normPhone) {
			prospectConditions.push(
				sql`RIGHT(REGEXP_REPLACE(${prospectClients.mobile}, '[^0-9]', '', 'g'), 10) = ${normPhone}`,
			);
		}

		if (prospectConditions.length > 0) {
			const [existingProspect] = await db
				.select({
					id: prospectClients.id,
					name: prospectClients.name,
					email: prospectClients.email,
					mobile: prospectClients.mobile,
					pan: prospectClients.pan,
					agentId: prospectClients.agentId,
					state: prospectClients.state,
				})
				.from(prospectClients)
				.where(or(...prospectConditions))
				.limit(1);

			if (existingProspect) {
				const isSameAgent = existingProspect.agentId === params.agentId;
				const matchedField =
					normPan && existingProspect.pan === normPan
						? "pan"
						: normPhone && this.normalizePhone(existingProspect.mobile) === normPhone
							? "mobile"
							: "email";

				logger.info("[DeduplicationGuardrail] Detected duplicate with existing HNI prospect", {
					prospectId: existingProspect.id,
					agentId: params.agentId,
					matchedField,
					isSameAgent,
				});

				return {
					isDuplicate: true,
					duplicateType: isSameAgent
						? "EXISTING_PROSPECT_SAME_AGENT"
						: "EXISTING_PROSPECT_OTHER_AGENT",
					matchedField,
					message: isSameAgent
						? `You already have an active HNI prospect for this contact: "${existingProspect.name}".`
						: `This contact is already being managed as an HNI prospect by another advisor.`,
					existingRecord: {
						id: existingProspect.id,
						name: existingProspect.name,
						email: existingProspect.email,
						phone: existingProspect.mobile,
						pan: existingProspect.pan,
						entityType: "PROSPECT",
						assignedAgentId: existingProspect.agentId,
						isSameAgent,
						stageOrStatus: existingProspect.state,
					},
				};
			}
		}

		return { isDuplicate: false };
	}

	/**
	 * Deduplicates a batch of leads (e.g. from CSV upload).
	 * Eliminates internal duplicates within the batch as well as collisions with the database.
	 */
	static async deduplicateBatch<
		T extends {
			name: string;
			phone?: string | null;
			email?: string | null;
			pan?: string | null;
			[key: string]: any;
		},
	>(
		leads: T[],
		agentId: string,
	): Promise<{
		validLeads: T[];
		duplicateCount: number;
		duplicates: Array<{ lead: T; reason: string }>;
	}> {
		const validLeads: T[] = [];
		const duplicates: Array<{ lead: T; reason: string }> = [];

		const seenPhonesInBatch = new Set<string>();
		const seenEmailsInBatch = new Set<string>();
		const seenPansInBatch = new Set<string>();

		for (const lead of leads) {
			const p = this.normalizePhone(lead.phone);
			const e = this.normalizeEmail(lead.email);
			const pan = this.normalizePan(lead.pan);

			// Check 1: In-batch duplication
			if (p && seenPhonesInBatch.has(p)) {
				duplicates.push({ lead, reason: `Duplicate phone (${p}) within the uploaded batch` });
				continue;
			}
			if (e && seenEmailsInBatch.has(e)) {
				duplicates.push({ lead, reason: `Duplicate email (${e}) within the uploaded batch` });
				continue;
			}
			if (pan && seenPansInBatch.has(pan)) {
				duplicates.push({ lead, reason: `Duplicate PAN (${pan}) within the uploaded batch` });
				continue;
			}

			// Check 2: Database collisions
			const dbCheck = await this.checkDuplicate({
				phone: lead.phone,
				email: lead.email,
				pan: lead.pan,
				agentId,
			});

			if (dbCheck.isDuplicate) {
				duplicates.push({ lead, reason: dbCheck.message || "Collision with existing record" });
				continue;
			}

			// Mark as seen in this batch
			if (p) seenPhonesInBatch.add(p);
			if (e) seenEmailsInBatch.add(e);
			if (pan) seenPansInBatch.add(pan);

			validLeads.push(lead);
		}

		logger.info("[DeduplicationGuardrail] Batch deduplication complete", {
			totalInput: leads.length,
			validCount: validLeads.length,
			duplicateCount: duplicates.length,
			agentId,
		});

		return {
			validLeads,
			duplicateCount: duplicates.length,
			duplicates,
		};
	}
}
