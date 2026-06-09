import { Router, Request, Response, NextFunction } from "express";
import { db } from "../db";
import { eq, and, desc, sql, inArray, or, ilike } from "drizzle-orm";
import { z } from "zod";
import { nanoid } from "nanoid";
import multer from "multer";
import ExcelJS from "exceljs";
import { leadRegistryService } from "../services/lead-registry-service";
import {
	dsaLoanApplications,
	dsaLoanDocuments,
	loanRoutingHistory,
	bankConnectors,
	agentLoanActions,
	agentPayoutClaims,
	agentLoanStatusHistory,
	dsaCommissionTracking,
	bankInteractionEvents,
	bankerContacts,
} from "@shared/dsa-loan-schema";
import { users, agentClientMappingRequests } from "@shared/schema";
import {
	OriginationMode,
	RoutingIntent,
	WorkflowOwner,
	AGENT_ASSISTED_DEFAULTS,
	CURRENT_COMMISSION_POLICY_VERSION,
} from "@shared/loan-origination.constants";

const router = Router();
const upload = multer({
	storage: multer.memoryStorage(),
	limits: { fileSize: 5 * 1024 * 1024 },
});

const AGENT_ROLES = [
	"agent",
	"sub_agent",
	"master_agent",
	"associate",
	"tester",
];

async function requireAgentRole(
	req: Request,
	res: Response,
	next: NextFunction,
) {
	const user = (req as any).user;
	if (!user) {
		return res.status(401).json({ success: false, error: "Unauthorized" });
	}

	const userRoles: string[] = user.roles || (user.role ? [user.role] : []);
	const hasAgentRole = userRoles.some((r: string) => AGENT_ROLES.includes(r));
	if (!hasAgentRole) {
		return res.status(403).json({
			success: false,
			error: "Access denied. Agent role required.",
			requiredRoles: AGENT_ROLES,
		});
	}

	next();
}

async function validateAgentClientMapping(
	agentId: string,
	clientId: string,
): Promise<boolean> {
	const [client] = await db
		.select({ assignedAgentId: (users as any).assignedAgentId })
		.from(users)
		.where(eq(users.id, clientId))
		.limit(1);

	if (client?.assignedAgentId === agentId) {
		return true;
	}

	const [mapping] = await db
		.select()
		.from(agentClientMappingRequests)
		.where(
			and(
				eq(agentClientMappingRequests.agentId, agentId),
				eq(agentClientMappingRequests.clientId, clientId),
				eq(agentClientMappingRequests.status, "approved"),
			),
		)
		.limit(1);

	return !!mapping;
}

router.use(requireAgentRole);

const VALID_STATUS_TRANSITIONS: Record<string, string[]> = {
	draft: ["submitted", "withdrawn"],
	submitted: ["eligibility_check", "withdrawn"],
	eligibility_check: ["routed", "rejected", "withdrawn"],
	routed: ["pending_with_banks", "rejected", "withdrawn"],
	pending_with_banks: ["in_review", "rejected", "withdrawn"],
	in_review: ["approved", "rejected", "withdrawn"],
	approved: ["disbursed", "withdrawn"],
	disbursed: [],
	rejected: [],
	withdrawn: [],
	expired: [],
};

function generateClaimNumber(): string {
	const date = new Date();
	const year = date.getFullYear().toString().slice(-2);
	const month = (date.getMonth() + 1).toString().padStart(2, "0");
	return `CLM${year}${month}${nanoid(6).toUpperCase()}`;
}

function generateApplicationNumber(): string {
	const prefix = "AGT";
	const date = new Date();
	const year = date.getFullYear().toString().slice(-2);
	const month = (date.getMonth() + 1).toString().padStart(2, "0");
	const random = nanoid(6).toUpperCase();
	return `${prefix}${year}${month}${random}`;
}

async function logAgentAction(params: {
	applicationId: string;
	agentId: string;
	actionType: string;
	actionDescription?: string;
	previousValue?: any;
	newValue?: any;
	affectedFields?: string[];
	bankCode?: string;
	documentId?: string;
	remarks?: string;
	req?: Request;
}) {
	const agent = await db
		.select({
			firstName: users.firstName,
			lastName: users.lastName,
			email: users.email,
		})
		.from(users)
		.where(eq(users.id, params.agentId))
		.limit(1);

	await db.insert(agentLoanActions).values({
		applicationId: params.applicationId,
		agentId: params.agentId,
		agentName: agent[0]
			? `${agent[0].firstName || ""} ${agent[0].lastName || ""}`.trim()
			: undefined,
		agentEmail: agent[0]?.email,
		actionType: params.actionType,
		actionDescription: params.actionDescription,
		previousValue: params.previousValue,
		newValue: params.newValue,
		affectedFields: params.affectedFields || [],
		bankCode: params.bankCode,
		documentId: params.documentId,
		remarks: params.remarks,
		ipAddress: params.req?.ip,
		userAgent: params.req?.headers["user-agent"],
		sessionId: (params.req as any)?.session?.id,
	});
}

const createAgentApplicationSchema = z.object({
	clientMode: z.enum(["new", "existing"]),
	clientId: z.string().optional(),
	applicantType: z.enum(["individual", "business"]).default("individual"),
	applicantName: z.string().min(1),
	applicantPhone: z.string().regex(/^[6-9]\d{9}$/),
	applicantEmail: z.string().email().optional(),
	applicantPan: z
		.string()
		.regex(/^[A-Z]{5}[0-9]{4}[A-Z]{1}$/)
		.optional(),
	applicantAadhaar: z.string().optional(),
	dateOfBirth: z.string().optional(),
	gender: z.enum(["male", "female", "other"]).optional(),
	addressLine1: z.string().optional(),
	addressLine2: z.string().optional(),
	city: z.string().optional(),
	state: z.string().optional(),
	pincode: z.string().optional(),
	employmentType: z.enum([
		"salaried",
		"self_employed",
		"business",
		"professional",
	]),
	companyName: z.string().optional(),
	designation: z.string().optional(),
	workExperience: z.number().int().optional(),
	monthlyIncome: z.number().positive(),
	annualIncome: z.number().positive().optional(),
	otherIncome: z.number().optional(),
	loanType: z.enum([
		"personal",
		"home",
		"car",
		"business",
		"education",
		"gold",
		"lap",
		"las",
	]),
	requestedAmount: z.number().positive(),
	requestedTenure: z.number().int().min(6).max(360),
	loanPurpose: z.string().optional(),
	existingLoans: z.number().int().optional(),
	existingEmiAmount: z.number().optional(),
	creditScore: z.number().int().min(300).max(900).optional(),
	processingMode: z
		.enum(["PLATFORM", "EXTERNAL_FINANCIER"])
		.default("PLATFORM"),
	financierName: z.string().optional(),
	bankerName: z.string().optional(),
	bankerMobile: z.string().optional(),
	bankerEmail: z.string().email().optional(),
	routingMode: z.enum(["auto", "manual"]).default("auto"),
	targetBanks: z.array(z.string()).optional(),
	dsaCode: z.string().optional(),
	subDsaCode: z.string().optional(),
});

router.post(
	"/applications/:id/submit-to-bank",
	async (req: Request, res: Response) => {
		try {
			const agentId = (req as any).user?.id;
			if (!agentId) {
				return res.status(401).json({ success: false, error: "Unauthorized" });
			}

			const { bankCodes, submissionReference, lenderDisclaimerAccepted } =
				req.body;

			if (!bankCodes || !Array.isArray(bankCodes) || bankCodes.length === 0) {
				return res
					.status(400)
					.json({ success: false, error: "bankCodes array is required" });
			}

			const [application] = await db
				.select()
				.from(dsaLoanApplications)
				.where(
					and(
						eq(dsaLoanApplications.id, req.params.id),
						eq(dsaLoanApplications.agentId, agentId),
					),
				)
				.limit(1);

			if (!application) {
				return res
					.status(404)
					.json({ success: false, error: "Application not found" });
			}

			// SUB-DSA GOVERNANCE: Enforce lender disclaimer before first bank submission
			if (!(application as any).lenderDisclaimerAt) {
				if (!lenderDisclaimerAccepted) {
					return res.status(400).json({
						success: false,
						error:
							"Lender disclaimer must be accepted before first bank submission",
						disclaimerRequired: true,
						disclaimerText:
							"FintekPro acts as a Sub-DSA / facilitation platform. Final credit decision rests with the lender.",
					});
				}
				// Record disclaimer acceptance
				await db
					.update(dsaLoanApplications)
					.set({ lenderDisclaimerAt: new Date() } as any)
					.where(eq(dsaLoanApplications.id, req.params.id));
			}

			const banks = await db
				.select()
				.from(bankConnectors)
				.where(inArray(bankConnectors.bankCode, bankCodes));

			if (banks.length === 0) {
				return res
					.status(400)
					.json({ success: false, error: "No valid banks found" });
			}

			const routingHistoryIds: string[] = [];
			for (let i = 0; i < banks.length; i++) {
				const bank = banks[i];
				const [routing] = await db
					.insert(loanRoutingHistory)
					.values({
						applicationId: req.params.id,
						bankCode: bank.bankCode,
						routingStrategy: "manual",
						routingMode: "manual" as any,
						routingPriority: i + 1,
						submissionMethod: "agent_manual",
						submissionReference,
						submittedByAgentId: agentId,
						bankStatus: "pending",
					} as any)
					.returning();
				routingHistoryIds.push(routing.id);
			}

			await db
				.update(dsaLoanApplications)
				.set({
					status: "routed",
					routingMode: "manual" as any,
					routedBanks: bankCodes,
					targetBanks: bankCodes,
					routedAt: new Date(),
					updatedAt: new Date(),
				})
				.where(eq(dsaLoanApplications.id, req.params.id));

			await logAgentAction({
				applicationId: req.params.id,
				agentId,
				actionType: "manual_route",
				actionDescription: `Manually submitted to banks: ${bankCodes.join(", ")}`,
				newValue: { bankCodes, routingMode: "manual" },
				affectedFields: ["routedBanks", "routingMode", "status"],
				req,
			});

			// SUB-DSA GOVERNANCE: Log bank interaction events for audit trail
			for (const bankCode of bankCodes) {
				await db.insert(bankInteractionEvents).values({
					loanId: req.params.id,
					bankCode,
					eventType: "RECEIVED" as any,
					reportedBy: "AGENT" as any,
					reportedById: agentId,
					referenceId: submissionReference,
					remarks: `Application submitted to ${bankCode} via agent manual routing`,
				} as any);
			}

			res.json({
				success: true,
				data: {
					applicationId: req.params.id,
					routedBanks: bankCodes,
					routingHistoryIds,
					routingMode: "manual",
				},
				message: "Application manually submitted to selected banks",
			});
		} catch (error: any) {
			res.status(500).json({ success: false, error: error.message });
		}
	},
);

const recordDisbursementSchema = z.object({
	disbursedAmount: z.number().positive(),
	disbursementDate: z.string(),
	bankConfirmationNumber: z.string().min(1),
	disbursementProofUrl: z.string().url().optional(),
	bankCode: z.string(),
});

router.post(
	"/applications/:id/record-disbursement",
	async (req: Request, res: Response) => {
		try {
			const agentId = (req as any).user?.id;
			if (!agentId) {
				return res.status(401).json({ success: false, error: "Unauthorized" });
			}

			const parsed = recordDisbursementSchema.parse(req.body);

			const [application] = await db
				.select()
				.from(dsaLoanApplications)
				.where(
					and(
						eq(dsaLoanApplications.id, req.params.id),
						eq(dsaLoanApplications.agentId, agentId),
					),
				)
				.limit(1);

			if (!application) {
				return res
					.status(404)
					.json({ success: false, error: "Application not found" });
			}

			if (application.status !== "approved") {
				return res.status(400).json({
					success: false,
					error: "Only approved loans can have disbursement recorded",
				});
			}

			const [updated] = await db
				.update(dsaLoanApplications)
				.set({
					status: "disbursed",
					actualDisbursedAmount: parsed.disbursedAmount.toString(),
					actualDisbursementDate: parsed.disbursementDate,
					bankConfirmationNumber: parsed.bankConfirmationNumber,
					disbursementProofUrl: parsed.disbursementProofUrl,
					updatedAt: new Date(),
				})
				.where(eq(dsaLoanApplications.id, req.params.id))
				.returning();

			await db
				.update(loanRoutingHistory)
				.set({
					disbursedAmount: parsed.disbursedAmount.toString(),
					disbursedAt: new Date(parsed.disbursementDate),
					disbursementReference: parsed.bankConfirmationNumber,
					bankStatus: "disbursed",
				})
				.where(
					and(
						eq(loanRoutingHistory.applicationId, req.params.id),
						eq(loanRoutingHistory.bankCode, parsed.bankCode),
					),
				);

			await logAgentAction({
				applicationId: req.params.id,
				agentId,
				actionType: "disbursement_record",
				actionDescription: `Recorded disbursement of ₹${parsed.disbursedAmount}`,
				newValue: parsed,
				affectedFields: [
					"status",
					"actualDisbursedAmount",
					"actualDisbursementDate",
				],
				bankCode: parsed.bankCode,
				req,
			});

			res.json({
				success: true,
				data: updated,
				message: "Disbursement recorded successfully",
			});
		} catch (error: any) {
			if (error instanceof z.ZodError) {
				res
					.status(400)
					.json({
						success: false,
						error: "Validation failed",
						details: error.issues,
					});
			} else {
				res.status(500).json({ success: false, error: error.message });
			}
		}
	},
);

const claimPayoutSchema = z.object({
	claimedAmount: z.number().positive(),
	disbursementProofUrl: z.string().url().optional(),
});

router.post(
	"/applications/:id/claim-payout",
	async (req: Request, res: Response) => {
		try {
			const agentId = (req as any).user?.id;
			if (!agentId) {
				return res.status(401).json({ success: false, error: "Unauthorized" });
			}

			const parsed = claimPayoutSchema.parse(req.body);

			const [application] = await db
				.select()
				.from(dsaLoanApplications)
				.where(
					and(
						eq(dsaLoanApplications.id, req.params.id),
						eq(dsaLoanApplications.agentId, agentId),
					),
				)
				.limit(1);

			if (!application) {
				return res
					.status(404)
					.json({ success: false, error: "Application not found" });
			}

			if (application.status !== "disbursed") {
				return res.status(400).json({
					success: false,
					error: "Payout can only be claimed for disbursed loans",
				});
			}

			const existingClaim = await db
				.select()
				.from(agentPayoutClaims)
				.where(
					and(
						eq(agentPayoutClaims.applicationId, req.params.id),
						eq(agentPayoutClaims.agentId, agentId),
					),
				)
				.limit(1);

			if (existingClaim.length > 0) {
				return res.status(400).json({
					success: false,
					error: "Payout claim already exists for this application",
					existingClaim: existingClaim[0],
				});
			}

			const claimNumber = generateClaimNumber();

			const [claim] = await db
				.insert(agentPayoutClaims)
				.values({
					claimNumber,
					applicationId: req.params.id,
					agentId,
					claimedAmount: parsed.claimedAmount.toString(),
					disbursedAmount: application.actualDisbursedAmount || "0",
					disbursementDate:
						application.actualDisbursementDate ||
						new Date().toISOString().split("T")[0],
					bankConfirmationNumber: application.bankConfirmationNumber,
					disbursementProofUrl:
						parsed.disbursementProofUrl || application.disbursementProofUrl,
					status: "pending",
				} as any)
				.returning();

			await logAgentAction({
				applicationId: req.params.id,
				agentId,
				actionType: "payout_claim",
				actionDescription: `Claimed payout of ₹${parsed.claimedAmount}`,
				newValue: { claimNumber, claimedAmount: parsed.claimedAmount },
				req,
			});

			res.status(201).json({
				success: true,
				data: claim,
				message: "Payout claim submitted successfully",
			});
		} catch (error: any) {
			if (error instanceof z.ZodError) {
				res
					.status(400)
					.json({
						success: false,
						error: "Validation failed",
						details: error.issues,
					});
			} else {
				res.status(500).json({ success: false, error: error.message });
			}
		}
	},
);

router.get("/payout-claims", async (req: Request, res: Response) => {
	try {
		const agentId = (req as any).user?.id;
		if (!agentId) {
			return res.status(401).json({ success: false, error: "Unauthorized" });
		}

		const { status } = req.query;

		const conditions = [eq(agentPayoutClaims.agentId, agentId)];
		if (status) {
			conditions.push(eq(agentPayoutClaims.status, status as any));
		}

		const claims = await db
			.select()
			.from(agentPayoutClaims)
			.where(and(...conditions))
			.orderBy(desc(agentPayoutClaims.createdAt));

		res.json({ success: true, data: claims });
	} catch (error: any) {
		res.status(500).json({ success: false, error: error.message });
	}
});

export default router;
