import { db } from "../db";
import { eq, and, sql, inArray, desc, or } from "drizzle-orm";
import { partners, agentItrCases, users } from "@shared/schema";

export interface CACaseSummary {
	id: string;
	clientId: string;
	clientName: string;
	clientEmail: string;
	clientMobile?: string | null;
	caseType: string;
	itrFormType: string | null;
	filingType: string | null;
	assessmentYear: string;
	financialYear: string;
	status: string;
	subStatus: string | null;
	priority: string;
	dueDate: Date | null;
	fee: number;
	feeStatus: string | null;
	totalGrossIncome: number;
	taxableIncome: number;
	refundOrDue: number;
	taxRegime: string | null;
	documentsCount: {
		required: number;
		received: number;
		missing: number;
	};
	createdAt: Date;
	updatedAt: Date;
}

export interface CaseComputationInput {
	salaryIncome?: number;
	interestIncome?: number;
	dividendIncome?: number;
	capitalGainsStcg?: number;
	capitalGainsLtcg?: number;
	businessIncome?: number;
	otherIncome?: number;
	section80c?: number;
	section80d?: number;
	otherDeductions?: number;
	tdsPaid?: number;
	advanceTaxPaid?: number;
	selfAssessmentTax?: number;
	taxRegime?: "old" | "new";
}

export interface CaseStatusUpdateInput {
	status: string;
	subStatus?: string;
	notes?: string;
	updatedBy: string;
}

export interface ClientQueryInput {
	query: string;
	askedBy: string;
}

/**
 * Service to manage CA case lifecycle, client query threads, computation adjustments, and document status.
 * Complies with FintekPro GCR v1.0 layered architecture rules.
 */
export class CACaseService {
	private readonly engineVersion = "CA_CASE_ENGINE_V2.0";

	/**
	 * Resolves the relevant CA user ID given a partner ID or user ID.
	 *
	 * @param partnerId ID from partners table
	 * @param authenticatedUserId Optional authenticated user ID fallback
	 * @returns Resolved CA user ID or partner ID
	 */
	async resolveCaUserId(partnerId: string, authenticatedUserId?: string): Promise<string[]> {
		const targetIds: string[] = [];
		if (authenticatedUserId) {
			targetIds.push(authenticatedUserId);
		}

		if (partnerId) {
			targetIds.push(partnerId);
			const [partner] = await db
				.select({ contactEmail: partners.contactEmail })
				.from(partners)
				.where(eq(partners.id, partnerId))
				.limit(1);

			if (partner?.contactEmail) {
				const [user] = await db
					.select({ id: users.id })
					.from(users)
					.where(eq(users.email, partner.contactEmail))
					.limit(1);

				if (user?.id && !targetIds.includes(user.id)) {
					targetIds.push(user.id);
				}
			}
		}

		return targetIds;
	}

	/**
	 * Fetches all cases assigned to a CA partner with optional status filtering.
	 *
	 * @param partnerId Partner ID
	 * @param authenticatedUserId Authenticated User ID
	 * @param status Optional status filter ('active', 'pending', 'completed', or specific status string)
	 * @returns Array of detailed CA Case summaries
	 */
	async getCasesForCA(
		partnerId: string,
		authenticatedUserId?: string,
		status?: string,
	): Promise<CACaseSummary[]> {
		const caUserIds = await this.resolveCaUserId(partnerId, authenticatedUserId);

		if (caUserIds.length === 0) {
			return [];
		}

		const cases = await db
			.select()
			.from(agentItrCases)
			.where(inArray(agentItrCases.caId, caUserIds))
			.orderBy(desc(agentItrCases.createdAt));

		if (cases.length === 0) {
			return [];
		}

		// Retrieve client user details in batch
		const clientIds = [...new Set(cases.map((c) => c.clientId))];
		const clientUsers = await db
			.select({
				id: users.id,
				firstName: users.firstName,
				lastName: users.lastName,
				email: users.email,
				mobile: users.mobile,
			})
			.from(users)
			.where(inArray(users.id, clientIds));

		const clientMap = new Map(clientUsers.map((u) => [u.id, u]));

		const mappedCases: CACaseSummary[] = cases.map((c) => {
			const client = clientMap.get(c.clientId);
			const clientName = client
				? `${client.firstName || ""} ${client.lastName || ""}`.trim() || client.email || "Client"
				: "Client";

			const docsReq = (c.documentsRequired as string[]) || [];
			const docsRec = (c.documentsReceived as string[]) || [];
			const docsMiss = (c.documentsMissing as string[]) || [];

			return {
				id: c.id,
				clientId: c.clientId,
				clientName,
				clientEmail: client?.email || "",
				clientMobile: client?.mobile,
				caseType: c.sourceProduct || "ITR Filing",
				itrFormType: c.itrFormType,
				filingType: c.filingType,
				assessmentYear: c.assessmentYear,
				financialYear: c.financialYear,
				status: c.status,
				subStatus: c.subStatus,
				priority: c.priority || "normal",
				dueDate: c.dueDate,
				fee: Number.parseFloat(String(c.caFee || c.totalFee || "0")),
				feeStatus: c.feeStatus,
				totalGrossIncome: Number.parseFloat(String(c.totalGrossIncome || "0")),
				taxableIncome: Number.parseFloat(String(c.taxableIncome || "0")),
				refundOrDue: Number.parseFloat(String(c.refundOrDue || "0")),
				taxRegime: c.taxRegime,
				documentsCount: {
					required: docsReq.length,
					received: docsRec.length,
					missing: docsMiss.length,
				},
				createdAt: c.createdAt,
				updatedAt: c.updatedAt,
			};
		});

		if (!status || status === "all") {
			return mappedCases;
		}

		if (status === "active") {
			return mappedCases.filter((c) =>
				["initiated", "documents_pending", "documents_received", "under_review", "processing", "draft_ready"].includes(c.status),
			);
		}

		if (status === "pending") {
			return mappedCases.filter((c) => ["documents_pending", "under_review"].includes(c.status));
		}

		if (status === "completed") {
			return mappedCases.filter((c) => ["filed", "acknowledged", "completed"].includes(c.status));
		}

		return mappedCases.filter((c) => c.status === status);
	}

	/**
	 * Retrieves the complete details of a single case for review.
	 *
	 * @param caseId Case ID
	 * @returns Full case record with client info and structured computations
	 */
	async getCaseDetails(caseId: string) {
		const [caseRecord] = await db
			.select()
			.from(agentItrCases)
			.where(eq(agentItrCases.id, caseId))
			.limit(1);

		if (!caseRecord) {
			return null;
		}

		const [client] = await db
			.select({
				id: users.id,
				firstName: users.firstName,
				lastName: users.lastName,
				email: users.email,
				mobile: users.mobile,
				pan: users.panNumber,
			})
			.from(users)
			.where(eq(users.id, caseRecord.clientId))
			.limit(1);

		return {
			...caseRecord,
			client: client
				? {
						...client,
						fullName: `${client.firstName || ""} ${client.lastName || ""}`.trim() || client.email,
						maskedPan: client.pan ? `${client.pan.slice(0, 2)}XXXXX${client.pan.slice(-2)}` : null,
					}
				: null,
			meta: {
				engineVersion: this.engineVersion,
				retrievedAt: new Date().toISOString(),
			},
		};
	}

	/**
	 * Updates the status of a case and logs an internal audit entry.
	 *
	 * @param caseId Target case ID
	 * @param input Status update parameters
	 */
	async updateCaseStatus(caseId: string, input: CaseStatusUpdateInput) {
		const [currentCase] = await db
			.select()
			.from(agentItrCases)
			.where(eq(agentItrCases.id, caseId))
			.limit(1);

		if (!currentCase) {
			throw new Error("Case not found");
		}

		const internalNotes = (currentCase.internalNotes as { note: string; by: string; at: string }[]) || [];
		if (input.notes) {
			internalNotes.push({
				note: input.notes,
				by: input.updatedBy,
				at: new Date().toISOString(),
			});
		}

		const isCompleting = ["filed", "completed"].includes(input.status);

		const [updated] = await db
			.update(agentItrCases)
			.set({
				status: input.status,
				subStatus: input.subStatus || currentCase.subStatus,
				internalNotes,
				completedAt: isCompleting ? new Date() : currentCase.completedAt,
				updatedAt: new Date(),
			})
			.where(eq(agentItrCases.id, caseId))
			.returning();

		return {
			success: true,
			case: updated,
			meta: {
				engineVersion: this.engineVersion,
				timestamp: new Date().toISOString(),
			},
		};
	}

	/**
	 * Updates the tax computation figures deterministically for a case.
	 *
	 * @param caseId Case ID
	 * @param input Computation inputs
	 */
	async updateComputation(caseId: string, input: CaseComputationInput) {
		const [currentCase] = await db
			.select()
			.from(agentItrCases)
			.where(eq(agentItrCases.id, caseId))
			.limit(1);

		if (!currentCase) {
			throw new Error("Case not found");
		}

		const salary = input.salaryIncome ?? Number.parseFloat(String(currentCase.salaryIncome || "0"));
		const interest = input.interestIncome ?? Number.parseFloat(String(currentCase.interestIncome || "0"));
		const dividend = input.dividendIncome ?? Number.parseFloat(String(currentCase.dividendIncome || "0"));
		const stcg = input.capitalGainsStcg ?? Number.parseFloat(String(currentCase.capitalGainsStcg || "0"));
		const ltcg = input.capitalGainsLtcg ?? Number.parseFloat(String(currentCase.capitalGainsLtcg || "0"));
		const business = input.businessIncome ?? Number.parseFloat(String(currentCase.businessIncome || "0"));
		const other = input.otherIncome ?? Number.parseFloat(String(currentCase.otherIncome || "0"));

		const totalGrossIncome = salary + interest + dividend + stcg + ltcg + business + other;

		const s80c = input.section80c ?? Number.parseFloat(String(currentCase.section80c || "0"));
		const s80d = input.section80d ?? Number.parseFloat(String(currentCase.section80d || "0"));
		const otherDeds = input.otherDeductions ?? Number.parseFloat(String(currentCase.otherDeductions || "0"));
		const totalDeductions = s80c + s80d + otherDeds;

		const taxRegime = input.taxRegime ?? currentCase.taxRegime ?? "new";
		
		// In New Regime (Sec 115BAC), standard deduction of 75,000 applies
		const taxableIncome = taxRegime === "new"
			? Math.max(0, totalGrossIncome - 75000)
			: Math.max(0, totalGrossIncome - 50000 - totalDeductions);

		// Calculate basic tax payable (Standard Indian slab simulation for decision support)
		let taxPayable = 0;
		if (taxRegime === "new") {
			if (taxableIncome <= 300000) taxPayable = 0;
			else if (taxableIncome <= 700000) taxPayable = (taxableIncome - 300000) * 0.05;
			else if (taxableIncome <= 1000000) taxPayable = 20000 + (taxableIncome - 700000) * 0.10;
			else if (taxableIncome <= 1200000) taxPayable = 50000 + (taxableIncome - 1000000) * 0.15;
			else if (taxableIncome <= 1500000) taxPayable = 80000 + (taxableIncome - 1200000) * 0.20;
			else taxPayable = 140000 + (taxableIncome - 1500000) * 0.30;

			// Section 87A rebate for new regime if total taxable <= 7 Lakh
			if (taxableIncome <= 700000) taxPayable = 0;
		} else {
			if (taxableIncome <= 250000) taxPayable = 0;
			else if (taxableIncome <= 500000) taxPayable = (taxableIncome - 250000) * 0.05;
			else if (taxableIncome <= 1000000) taxPayable = 12500 + (taxableIncome - 500000) * 0.20;
			else taxPayable = 112500 + (taxableIncome - 1000000) * 0.30;

			// Section 87A rebate for old regime if total taxable <= 5 Lakh
			if (taxableIncome <= 500000) taxPayable = 0;
		}

		// 4% Health & Education Cess
		taxPayable = Math.round(taxPayable * 1.04);

		const tds = input.tdsPaid ?? Number.parseFloat(String(currentCase.tdsPaid || "0"));
		const advTax = input.advanceTaxPaid ?? Number.parseFloat(String(currentCase.advanceTaxPaid || "0"));
		const saTax = input.selfAssessmentTax ?? Number.parseFloat(String(currentCase.selfAssessmentTax || "0"));
		const totalPaid = tds + advTax + saTax;
		const refundOrDue = taxPayable - totalPaid;

		const [updated] = await db
			.update(agentItrCases)
			.set({
				salaryIncome: salary.toString(),
				interestIncome: interest.toString(),
				dividendIncome: dividend.toString(),
				capitalGainsStcg: stcg.toString(),
				capitalGainsLtcg: ltcg.toString(),
				businessIncome: business.toString(),
				otherIncome: other.toString(),
				totalGrossIncome: totalGrossIncome.toString(),
				section80c: s80c.toString(),
				section80d: s80d.toString(),
				otherDeductions: otherDeds.toString(),
				totalDeductions: totalDeductions.toString(),
				taxRegime,
				taxableIncome: taxableIncome.toString(),
				taxPayable: taxPayable.toString(),
				tdsPaid: tds.toString(),
				advanceTaxPaid: advTax.toString(),
				selfAssessmentTax: saTax.toString(),
				refundOrDue: refundOrDue.toString(),
				updatedAt: new Date(),
			})
			.where(eq(agentItrCases.id, caseId))
			.returning();

		return {
			success: true,
			case: updated,
			computation: {
				totalGrossIncome,
				totalDeductions,
				taxableIncome,
				taxPayable,
				totalTdsAndAdvanceTax: totalPaid,
				refundOrDue,
				status: refundOrDue > 0 ? "TAX_PAYABLE" : refundOrDue < 0 ? "REFUND_DUE" : "NIL_BALANCE",
			},
			meta: {
				engineVersion: this.engineVersion,
				calculationTimestamp: new Date().toISOString(),
			},
		};
	}

	/**
	 * Adds a client query to the case's communication thread.
	 *
	 * @param caseId Case ID
	 * @param input Query details
	 */
	async addClientQuery(caseId: string, input: ClientQueryInput) {
		const [currentCase] = await db
			.select()
			.from(agentItrCases)
			.where(eq(agentItrCases.id, caseId))
			.limit(1);

		if (!currentCase) {
			throw new Error("Case not found");
		}

		const queries = (currentCase.clientQueries as { query: string; response?: string; askedAt: string; respondedAt?: string }[]) || [];
		queries.push({
			query: input.query,
			askedAt: new Date().toISOString(),
		});

		const [updated] = await db
			.update(agentItrCases)
			.set({
				clientQueries: queries,
				updatedAt: new Date(),
			})
			.where(eq(agentItrCases.id, caseId))
			.returning();

		return {
			success: true,
			queries: updated.clientQueries,
		};
	}

	/**
	 * Resolves an existing client query with a response from the CA or client.
	 *
	 * @param caseId Case ID
	 * @param queryIndex Zero-based index of the query to answer
	 * @param response Answer string
	 */
	async resolveClientQuery(caseId: string, queryIndex: number, response: string) {
		const [currentCase] = await db
			.select()
			.from(agentItrCases)
			.where(eq(agentItrCases.id, caseId))
			.limit(1);

		if (!currentCase) {
			throw new Error("Case not found");
		}

		const queries = [...((currentCase.clientQueries as { query: string; response?: string; askedAt: string; respondedAt?: string }[]) || [])];
		if (!queries[queryIndex]) {
			throw new Error("Query index out of range");
		}

		queries[queryIndex].response = response;
		queries[queryIndex].respondedAt = new Date().toISOString();

		const [updated] = await db
			.update(agentItrCases)
			.set({
				clientQueries: queries,
				updatedAt: new Date(),
			})
			.where(eq(agentItrCases.id, caseId))
			.returning();

		return {
			success: true,
			queries: updated.clientQueries,
		};
	}

	/**
	 * Updates the document tracking checklist for the case.
	 *
	 * @param caseId Case ID
	 * @param docs Object containing required, received, or missing arrays
	 */
	async updateDocuments(
		caseId: string,
		docs: {
			documentsRequired?: string[];
			documentsReceived?: string[];
			documentsMissing?: string[];
		},
	) {
		const [currentCase] = await db
			.select()
			.from(agentItrCases)
			.where(eq(agentItrCases.id, caseId))
			.limit(1);

		if (!currentCase) {
			throw new Error("Case not found");
		}

		const required = docs.documentsRequired ?? (currentCase.documentsRequired as string[]) ?? [];
		const received = docs.documentsReceived ?? (currentCase.documentsReceived as string[]) ?? [];
		const missing = docs.documentsMissing ?? (currentCase.documentsMissing as string[]) ?? [];

		const [updated] = await db
			.update(agentItrCases)
			.set({
				documentsRequired: required,
				documentsReceived: received,
				documentsMissing: missing,
				updatedAt: new Date(),
			})
			.where(eq(agentItrCases.id, caseId))
			.returning();

		return {
			success: true,
			documents: {
				required: updated.documentsRequired,
				received: updated.documentsReceived,
				missing: updated.documentsMissing,
			},
		};
	}
}

export const caCaseService = new CACaseService();
