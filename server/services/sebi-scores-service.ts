import { nanoid } from "nanoid";

export type ComplaintCategory =
	| "investment_advice"
	| "unauthorized_transaction"
	| "service_delay"
	| "fee_dispute"
	| "kyc_issue"
	| "portfolio_management"
	| "mutual_fund"
	| "bonds_securities"
	| "insurance_related"
	| "loan_related"
	| "data_privacy"
	| "platform_issue"
	| "other";

export type ComplaintStatus =
	| "submitted"
	| "acknowledged"
	| "under_review"
	| "pending_information"
	| "resolved"
	| "escalated"
	| "closed"
	| "rejected";

export type ComplaintPriority = "low" | "medium" | "high" | "critical";

export type ResolutionType =
	| "resolved_in_favor"
	| "resolved_against"
	| "partially_resolved"
	| "withdrawn"
	| "rejected_invalid"
	| "no_action_required";

interface ComplainantInfo {
	name: string;
	email: string;
	phone: string;
	panNumber?: string;
	address?: string;
}

interface ComplaintDetails {
	description: string;
	transactionDate?: string;
	transactionAmount?: number;
	transactionReference?: string;
	relatedProductType?: string;
	relatedProductId?: string;
	expectedResolution?: string;
	supportingDocuments?: string[];
}

export interface GrievanceComplaint {
	id: string;
	scoresReferenceNumber: string;
	clientId: string;
	complainant: ComplainantInfo;
	category: ComplaintCategory;
	subcategory?: string;
	priority: ComplaintPriority;
	status: ComplaintStatus;
	details: ComplaintDetails;
	assignedTo?: string;
	assignedToName?: string;
	submittedAt: Date;
	acknowledgedAt?: Date;
	lastUpdatedAt: Date;
	resolvedAt?: Date;
	closedAt?: Date;
	slaDeadline: Date;
	slaDaysRemaining: number;
	isEscalated: boolean;
	escalationLevel: number;
	escalationReason?: string;
	resolution?: {
		type: ResolutionType;
		summary: string;
		actionTaken: string;
		compensationProvided?: number;
		resolvedBy: string;
		resolvedByName: string;
		resolvedAt: Date;
	};
	internalNotes: Array<{
		id: string;
		note: string;
		addedBy: string;
		addedByName: string;
		addedAt: Date;
	}>;
	communications: Array<{
		id: string;
		type: "email" | "sms" | "call" | "letter";
		direction: "inbound" | "outbound";
		subject?: string;
		content: string;
		sentAt: Date;
		sentBy?: string;
	}>;
	statusHistory: Array<{
		status: ComplaintStatus;
		changedAt: Date;
		changedBy: string;
		reason?: string;
	}>;
	auditLog: Array<{
		action: string;
		performedBy: string;
		performedAt: Date;
		details: Record<string, any>;
	}>;
}

interface SubmitComplaintParams {
	clientId: string;
	complainant: ComplainantInfo;
	category: ComplaintCategory;
	subcategory?: string;
	details: ComplaintDetails;
}

interface UpdateComplaintParams {
	status?: ComplaintStatus;
	priority?: ComplaintPriority;
	assignedTo?: string;
	assignedToName?: string;
	internalNote?: string;
	noteAddedBy?: string;
	noteAddedByName?: string;
	updatedBy: string;
}

interface ResolveComplaintParams {
	resolutionType: ResolutionType;
	summary: string;
	actionTaken: string;
	compensationProvided?: number;
	resolvedBy: string;
	resolvedByName: string;
}

interface ComplaintMetrics {
	total: number;
	byStatus: Record<ComplaintStatus, number>;
	byCategory: Record<ComplaintCategory, number>;
	byPriority: Record<ComplaintPriority, number>;
	avgResolutionDays: number;
	slaBreaches: number;
	escalated: number;
	resolvedThisMonth: number;
	pendingOverdue: number;
}

class SebiScoresService {
	private complaints: Map<string, GrievanceComplaint> = new Map();
	private scoresCounter: number = 1000;
	private readonly SLA_DAYS = 30;

	constructor() {
		console.log("✅ SEBI SCORES Grievance Service initialized");
		console.log("   SLA Deadline: 30 days per SEBI SCORES guidelines");
	}

	private generateScoresReference(): string {
		this.scoresCounter++;
		const year = new Date().getFullYear();
		const month = String(new Date().getMonth() + 1).padStart(2, "0");
		return `FTKP/${year}/${month}/${String(this.scoresCounter).padStart(6, "0")}`;
	}

	private calculatePriority(
		category: ComplaintCategory,
		amount?: number,
	): ComplaintPriority {
		if (
			category === "unauthorized_transaction" ||
			category === "data_privacy"
		) {
			return "critical";
		}
		if (amount && amount > 500000) {
			return "high";
		}
		if (category === "fee_dispute" || category === "investment_advice") {
			return "medium";
		}
		return "low";
	}

	private calculateSlaDays(complaint: GrievanceComplaint): number {
		const now = new Date();
		const deadline = new Date(complaint.slaDeadline);
		const diffTime = deadline.getTime() - now.getTime();
		const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
		return diffDays;
	}

	async submitComplaint(
		params: SubmitComplaintParams,
	): Promise<GrievanceComplaint> {
		const id = nanoid();
		const scoresRef = this.generateScoresReference();
		const now = new Date();
		const slaDeadline = new Date(now);
		slaDeadline.setDate(slaDeadline.getDate() + this.SLA_DAYS);

		const priority = this.calculatePriority(
			params.category,
			params.details.transactionAmount,
		);

		const complaint: GrievanceComplaint = {
			id,
			scoresReferenceNumber: scoresRef,
			clientId: params.clientId,
			complainant: params.complainant,
			category: params.category,
			subcategory: params.subcategory,
			priority,
			status: "submitted",
			details: params.details,
			submittedAt: now,
			lastUpdatedAt: now,
			slaDeadline,
			slaDaysRemaining: this.SLA_DAYS,
			isEscalated: false,
			escalationLevel: 0,
			internalNotes: [],
			communications: [],
			statusHistory: [
				{
					status: "submitted",
					changedAt: now,
					changedBy: "system",
					reason: "Complaint submitted by client",
				},
			],
			auditLog: [
				{
					action: "complaint_submitted",
					performedBy: params.clientId,
					performedAt: now,
					details: {
						category: params.category,
						priority,
						scoresReference: scoresRef,
					},
				},
			],
		};

		this.complaints.set(id, complaint);

		console.log(`[SEBI SCORES] New complaint submitted: ${scoresRef}`);
		console.log(`   Category: ${params.category}, Priority: ${priority}`);
		console.log(`   SLA Deadline: ${slaDeadline.toISOString()}`);

		return complaint;
	}

	async acknowledgeComplaint(
		complaintId: string,
		acknowledgedBy: string,
	): Promise<GrievanceComplaint | null> {
		const complaint = this.complaints.get(complaintId);
		if (!complaint) return null;

		const now = new Date();
		complaint.status = "acknowledged";
		complaint.acknowledgedAt = now;
		complaint.lastUpdatedAt = now;
		complaint.slaDaysRemaining = this.calculateSlaDays(complaint);

		complaint.statusHistory.push({
			status: "acknowledged",
			changedAt: now,
			changedBy: acknowledgedBy,
			reason: "Complaint acknowledged by support team",
		});

		complaint.auditLog.push({
			action: "complaint_acknowledged",
			performedBy: acknowledgedBy,
			performedAt: now,
			details: { acknowledgedWithinSla: complaint.slaDaysRemaining > 0 },
		});

		this.complaints.set(complaintId, complaint);
		console.log(
			`[SEBI SCORES] Complaint ${complaint.scoresReferenceNumber} acknowledged`,
		);

		return complaint;
	}

	async updateComplaint(
		complaintId: string,
		params: UpdateComplaintParams,
	): Promise<GrievanceComplaint | null> {
		const complaint = this.complaints.get(complaintId);
		if (!complaint) return null;

		const now = new Date();
		const changes: Record<string, any> = {};

		if (params.status && params.status !== complaint.status) {
			changes.previousStatus = complaint.status;
			changes.newStatus = params.status;
			complaint.status = params.status;
			complaint.statusHistory.push({
				status: params.status,
				changedAt: now,
				changedBy: params.updatedBy,
				reason: `Status updated to ${params.status}`,
			});
		}

		if (params.priority && params.priority !== complaint.priority) {
			changes.previousPriority = complaint.priority;
			changes.newPriority = params.priority;
			complaint.priority = params.priority;
		}

		if (params.assignedTo) {
			changes.assignedTo = params.assignedTo;
			complaint.assignedTo = params.assignedTo;
			complaint.assignedToName = params.assignedToName;
		}

		if (params.internalNote && params.noteAddedBy) {
			complaint.internalNotes.push({
				id: nanoid(),
				note: params.internalNote,
				addedBy: params.noteAddedBy,
				addedByName: params.noteAddedByName || params.noteAddedBy,
				addedAt: now,
			});
			changes.noteAdded = true;
		}

		complaint.lastUpdatedAt = now;
		complaint.slaDaysRemaining = this.calculateSlaDays(complaint);

		complaint.auditLog.push({
			action: "complaint_updated",
			performedBy: params.updatedBy,
			performedAt: now,
			details: changes,
		});

		this.complaints.set(complaintId, complaint);
		console.log(
			`[SEBI SCORES] Complaint ${complaint.scoresReferenceNumber} updated`,
		);

		return complaint;
	}

	async resolveComplaint(
		complaintId: string,
		params: ResolveComplaintParams,
	): Promise<GrievanceComplaint | null> {
		const complaint = this.complaints.get(complaintId);
		if (!complaint) return null;

		const now = new Date();
		complaint.status = "resolved";
		complaint.resolvedAt = now;
		complaint.lastUpdatedAt = now;
		complaint.slaDaysRemaining = this.calculateSlaDays(complaint);

		complaint.resolution = {
			type: params.resolutionType,
			summary: params.summary,
			actionTaken: params.actionTaken,
			compensationProvided: params.compensationProvided,
			resolvedBy: params.resolvedBy,
			resolvedByName: params.resolvedByName,
			resolvedAt: now,
		};

		complaint.statusHistory.push({
			status: "resolved",
			changedAt: now,
			changedBy: params.resolvedBy,
			reason: `Resolved: ${params.resolutionType}`,
		});

		complaint.auditLog.push({
			action: "complaint_resolved",
			performedBy: params.resolvedBy,
			performedAt: now,
			details: {
				resolutionType: params.resolutionType,
				withinSla: complaint.slaDaysRemaining >= 0,
				resolutionDays: Math.ceil(
					(now.getTime() - complaint.submittedAt.getTime()) /
						(1000 * 60 * 60 * 24),
				),
			},
		});

		this.complaints.set(complaintId, complaint);
		console.log(
			`[SEBI SCORES] Complaint ${complaint.scoresReferenceNumber} resolved: ${params.resolutionType}`,
		);

		return complaint;
	}

	async closeComplaint(
		complaintId: string,
		closedBy: string,
		reason?: string,
	): Promise<GrievanceComplaint | null> {
		const complaint = this.complaints.get(complaintId);
		if (!complaint) return null;

		const now = new Date();
		complaint.status = "closed";
		complaint.closedAt = now;
		complaint.lastUpdatedAt = now;

		complaint.statusHistory.push({
			status: "closed",
			changedAt: now,
			changedBy: closedBy,
			reason: reason || "Complaint closed after resolution",
		});

		complaint.auditLog.push({
			action: "complaint_closed",
			performedBy: closedBy,
			performedAt: now,
			details: { reason },
		});

		this.complaints.set(complaintId, complaint);
		console.log(
			`[SEBI SCORES] Complaint ${complaint.scoresReferenceNumber} closed`,
		);

		return complaint;
	}

	async escalateComplaint(
		complaintId: string,
		escalatedBy: string,
		reason: string,
	): Promise<GrievanceComplaint | null> {
		const complaint = this.complaints.get(complaintId);
		if (!complaint) return null;

		const now = new Date();
		complaint.status = "escalated";
		complaint.isEscalated = true;
		complaint.escalationLevel += 1;
		complaint.escalationReason = reason;
		complaint.lastUpdatedAt = now;

		if (complaint.priority !== "critical") {
			complaint.priority =
				complaint.priority === "low"
					? "medium"
					: complaint.priority === "medium"
						? "high"
						: "critical";
		}

		complaint.statusHistory.push({
			status: "escalated",
			changedAt: now,
			changedBy: escalatedBy,
			reason: `Escalation Level ${complaint.escalationLevel}: ${reason}`,
		});

		complaint.auditLog.push({
			action: "complaint_escalated",
			performedBy: escalatedBy,
			performedAt: now,
			details: {
				escalationLevel: complaint.escalationLevel,
				reason,
				newPriority: complaint.priority,
			},
		});

		this.complaints.set(complaintId, complaint);
		console.log(
			`[SEBI SCORES] Complaint ${complaint.scoresReferenceNumber} escalated to level ${complaint.escalationLevel}`,
		);

		return complaint;
	}

	async addCommunication(
		complaintId: string,
		type: "email" | "sms" | "call" | "letter",
		direction: "inbound" | "outbound",
		content: string,
		subject?: string,
		sentBy?: string,
	): Promise<GrievanceComplaint | null> {
		const complaint = this.complaints.get(complaintId);
		if (!complaint) return null;

		const now = new Date();
		complaint.communications.push({
			id: nanoid(),
			type,
			direction,
			subject,
			content,
			sentAt: now,
			sentBy,
		});

		complaint.lastUpdatedAt = now;
		complaint.auditLog.push({
			action: "communication_added",
			performedBy: sentBy || "system",
			performedAt: now,
			details: { type, direction, subject },
		});

		this.complaints.set(complaintId, complaint);
		return complaint;
	}

	getComplaint(complaintId: string): GrievanceComplaint | undefined {
		const complaint = this.complaints.get(complaintId);
		if (complaint) {
			complaint.slaDaysRemaining = this.calculateSlaDays(complaint);
		}
		return complaint;
	}

	getComplaintByReference(
		scoresReference: string,
	): GrievanceComplaint | undefined {
		for (const complaint of this.complaints.values()) {
			if (complaint.scoresReferenceNumber === scoresReference) {
				complaint.slaDaysRemaining = this.calculateSlaDays(complaint);
				return complaint;
			}
		}
		return undefined;
	}

	getClientComplaints(clientId: string): GrievanceComplaint[] {
		const complaints = Array.from(this.complaints.values())
			.filter((c) => c.clientId === clientId)
			.map((c) => ({
				...c,
				slaDaysRemaining: this.calculateSlaDays(c),
			}))
			.sort((a, b) => b.submittedAt.getTime() - a.submittedAt.getTime());
		return complaints;
	}

	getAllComplaints(filters?: {
		status?: ComplaintStatus;
		category?: ComplaintCategory;
		priority?: ComplaintPriority;
		isEscalated?: boolean;
		assignedTo?: string;
		fromDate?: Date;
		toDate?: Date;
	}): GrievanceComplaint[] {
		let complaints = Array.from(this.complaints.values());

		if (filters) {
			if (filters.status) {
				complaints = complaints.filter((c) => c.status === filters.status);
			}
			if (filters.category) {
				complaints = complaints.filter((c) => c.category === filters.category);
			}
			if (filters.priority) {
				complaints = complaints.filter((c) => c.priority === filters.priority);
			}
			if (filters.isEscalated !== undefined) {
				complaints = complaints.filter(
					(c) => c.isEscalated === filters.isEscalated,
				);
			}
			if (filters.assignedTo) {
				complaints = complaints.filter(
					(c) => c.assignedTo === filters.assignedTo,
				);
			}
			if (filters.fromDate) {
				complaints = complaints.filter(
					(c) => c.submittedAt >= filters.fromDate!,
				);
			}
			if (filters.toDate) {
				complaints = complaints.filter((c) => c.submittedAt <= filters.toDate!);
			}
		}

		return complaints
			.map((c) => ({
				...c,
				slaDaysRemaining: this.calculateSlaDays(c),
			}))
			.sort((a, b) => b.submittedAt.getTime() - a.submittedAt.getTime());
	}

	getOverdueComplaints(): GrievanceComplaint[] {
		const now = new Date();
		return Array.from(this.complaints.values())
			.filter(
				(c) =>
					!["resolved", "closed", "rejected"].includes(c.status) &&
					c.slaDeadline < now,
			)
			.map((c) => ({
				...c,
				slaDaysRemaining: this.calculateSlaDays(c),
			}))
			.sort((a, b) => a.slaDeadline.getTime() - b.slaDeadline.getTime());
	}

	getPendingEscalations(): GrievanceComplaint[] {
		const now = new Date();
		const warningThreshold = 5;

		return Array.from(this.complaints.values())
			.filter((c) => {
				if (
					["resolved", "closed", "rejected", "escalated"].includes(c.status)
				) {
					return false;
				}
				const daysRemaining = this.calculateSlaDays(c);
				return daysRemaining <= warningThreshold && daysRemaining > 0;
			})
			.map((c) => ({
				...c,
				slaDaysRemaining: this.calculateSlaDays(c),
			}))
			.sort((a, b) => a.slaDaysRemaining - b.slaDaysRemaining);
	}

	getMetrics(): ComplaintMetrics {
		const complaints = Array.from(this.complaints.values());
		const now = new Date();
		const thisMonth = new Date(now.getFullYear(), now.getMonth(), 1);

		const byStatus: Record<ComplaintStatus, number> = {
			submitted: 0,
			acknowledged: 0,
			under_review: 0,
			pending_information: 0,
			resolved: 0,
			escalated: 0,
			closed: 0,
			rejected: 0,
		};

		const byCategory: Record<ComplaintCategory, number> = {
			investment_advice: 0,
			unauthorized_transaction: 0,
			service_delay: 0,
			fee_dispute: 0,
			kyc_issue: 0,
			portfolio_management: 0,
			mutual_fund: 0,
			bonds_securities: 0,
			insurance_related: 0,
			loan_related: 0,
			data_privacy: 0,
			platform_issue: 0,
			other: 0,
		};

		const byPriority: Record<ComplaintPriority, number> = {
			low: 0,
			medium: 0,
			high: 0,
			critical: 0,
		};

		let totalResolutionDays = 0;
		let resolvedCount = 0;
		let slaBreaches = 0;
		let escalated = 0;
		let resolvedThisMonth = 0;
		let pendingOverdue = 0;

		for (const complaint of complaints) {
			byStatus[complaint.status]++;
			byCategory[complaint.category]++;
			byPriority[complaint.priority]++;

			if (complaint.isEscalated) escalated++;

			if (complaint.resolvedAt) {
				resolvedCount++;
				const resolutionDays = Math.ceil(
					(complaint.resolvedAt.getTime() - complaint.submittedAt.getTime()) /
						(1000 * 60 * 60 * 24),
				);
				totalResolutionDays += resolutionDays;

				if (resolutionDays > this.SLA_DAYS) {
					slaBreaches++;
				}

				if (complaint.resolvedAt >= thisMonth) {
					resolvedThisMonth++;
				}
			}

			if (!["resolved", "closed", "rejected"].includes(complaint.status)) {
				if (complaint.slaDeadline < now) {
					pendingOverdue++;
				}
			}
		}

		return {
			total: complaints.length,
			byStatus,
			byCategory,
			byPriority,
			avgResolutionDays:
				resolvedCount > 0 ? Math.round(totalResolutionDays / resolvedCount) : 0,
			slaBreaches,
			escalated,
			resolvedThisMonth,
			pendingOverdue,
		};
	}

	async checkSlaBreaches(): Promise<{
		breached: GrievanceComplaint[];
		nearingDeadline: GrievanceComplaint[];
	}> {
		const breached = this.getOverdueComplaints();
		const nearingDeadline = this.getPendingEscalations();

		if (breached.length > 0) {
			console.log(
				`[SEBI SCORES SLA] ${breached.length} complaints have breached SLA deadline`,
			);
		}
		if (nearingDeadline.length > 0) {
			console.log(
				`[SEBI SCORES SLA] ${nearingDeadline.length} complaints are nearing SLA deadline`,
			);
		}

		return { breached, nearingDeadline };
	}

	getCategoryOptions(): Array<{
		value: ComplaintCategory;
		label: string;
		description: string;
	}> {
		return [
			{
				value: "investment_advice",
				label: "Investment Advice",
				description:
					"Issues with investment recommendations or advice provided",
			},
			{
				value: "unauthorized_transaction",
				label: "Unauthorized Transaction",
				description: "Transactions executed without proper authorization",
			},
			{
				value: "service_delay",
				label: "Service Delay",
				description: "Delays in service delivery or response",
			},
			{
				value: "fee_dispute",
				label: "Fee/Charges Dispute",
				description: "Disputes regarding fees, charges, or commissions",
			},
			{
				value: "kyc_issue",
				label: "KYC/Onboarding Issue",
				description: "Problems with KYC verification or onboarding process",
			},
			{
				value: "portfolio_management",
				label: "Portfolio Management",
				description: "Issues with portfolio management services",
			},
			{
				value: "mutual_fund",
				label: "Mutual Fund",
				description: "Issues related to mutual fund transactions or services",
			},
			{
				value: "bonds_securities",
				label: "Bonds & Securities",
				description: "Issues with bond or securities transactions",
			},
			{
				value: "insurance_related",
				label: "Insurance Related",
				description: "Issues with insurance products or services",
			},
			{
				value: "loan_related",
				label: "Loan Related",
				description: "Issues with loan applications or servicing",
			},
			{
				value: "data_privacy",
				label: "Data Privacy",
				description: "Concerns about data handling or privacy breaches",
			},
			{
				value: "platform_issue",
				label: "Platform/Technical Issue",
				description: "Technical problems with the platform",
			},
			{
				value: "other",
				label: "Other",
				description: "Other issues not covered above",
			},
		];
	}
}

export const sebiScoresService = new SebiScoresService();
