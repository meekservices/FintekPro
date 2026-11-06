import { logger } from "../logger";
import { taxAmendmentService } from "../services/tax-amendment-service";
import { Router, Request, Response } from "express";
import { db } from "../db";
import { eq, and, sql, desc, ilike, or, inArray } from "drizzle-orm";
import { partners, caProfiles, agentItrCases, users } from "@shared/schema";
import { caAssignmentService } from "../services/ca-assignment-service";
import { caCaseService } from "../services/ca-case-service";
import { caReconciliationService } from "../services/ca-reconciliation-service";
import { caCertificationService } from "../services/ca-certification-service";
import { caItdParserService } from "../services/ca-itd-parser-service";
import { caAdvanceTaxService } from "../services/ca-advance-tax-service";
import { caScheduleFaService } from "../services/ca-schedule-fa-service";
import { caDscService } from "../services/ca-dsc-service";
import { caClientApprovalService } from "../services/ca-client-approval-service";
import { caNoticeResolutionService } from "../services/ca-notice-resolution-service";
import { caGstReconciliationService } from "../services/ca-gst-reconciliation-service";
import { caMsmeAuditService } from "../services/ca-msme-audit-service";
import { caComplianceCalendarService } from "../services/ca-compliance-calendar-service";
import { verifyICAIMembership } from "../services/icai-verification-service";
import bcrypt from "bcryptjs";
import { z } from "zod";
import {
	requireAuth,
	requirePartnerPortal,
	requireAdminPortal,
	requireAgentPortal,
	injectRoleInfo,
} from "../middleware/roleMiddleware";

interface AuthRequest extends Request {
	user?: {
		id: string;
		email?: string;
		role?: string;
	};
}

interface PartnerRecord {
	id: string;
	companyName: string | null;
	contactEmail: string;
	contactPhone: string | null;
	icaiMembershipNumber: string | null;
	icaiMembershipType: string | null;
	caFirmName: string | null;
	caFirmRegistrationNumber: string | null;
	caSpecializations: string[] | null;
	caExperienceYears: number | null;
	caQualificationYear: number | null;
	caCity: string | null;
	caState: string | null;
	caAvailability: string | null;
	caMaxCasesPerMonth: number | null;
	caCurrentActiveCases: number | null;
	caCompletedCases: number | null;
	caAverageRating: string | null;
	caVerificationStatus: string | null;
	createdAt: string;
}

interface EmpanelmentRecord {
	ca_membership_number: string;
}

interface RegistryEntry {
	referralCode: string;
	referralCount: number;
	tier: string;
	isPubliclyListed: boolean;
}

interface ClientUser {
	id: string;
	firstName: string | null;
	lastName: string | null;
	email: string | null;
}

const router = Router();

const caRegistrationSchema = z.object({
	fullName: z.string().min(3),
	email: z.string().email(),
	mobile: z.string().length(10),
	password: z.string().min(8),
	icaiMembershipNumber: z.string().min(5),
	membershipType: z.enum(["ACA", "FCA"]),
	copNumber: z.string().optional(),
	qualificationYear: z.coerce.number(),
	experienceYears: z.coerce.number(),
	firmName: z.string().optional(),
	firmRegistrationNumber: z.string().optional(),
	specializations: z.array(z.string()),
	city: z.string(),
	state: z.string(),
	maxCasesPerMonth: z.coerce.number().default(50),
	responseTime: z.enum(["4h", "12h", "24h", "48h"]).default("24h"),
	baseFeeItr1: z.coerce.number().default(500),
	baseFeeItr2: z.coerce.number().default(1500),
	baseFeeItr3: z.coerce.number().default(3000),
	baseFeeItr4: z.coerce.number().default(2000),
	panNumber: z.string().length(10),
	bankAccountNumber: z.string().min(8),
	ifscCode: z.string().length(11),
	bankAccountHolderName: z.string().min(3),
	bio: z.string().optional(),
});

router.post("/register", async (req: Request, res: Response): Promise<void> => {
	try {
		const validatedData = caRegistrationSchema.parse(req.body);

		const existingPartner = await db
			.select()
			.from(partners)
			.where(
				or(
					eq(partners.contactEmail, validatedData.email),
					eq(partners.icaiMembershipNumber, validatedData.icaiMembershipNumber),
				),
			)
			.limit(1);

		if (existingPartner.length > 0) {
			res.status(400).json({
				success: false,
				error: "Email or ICAI membership number already registered",
			});
			return;
		}

		const hashedPassword = await bcrypt.hash(validatedData.password, 12);

		const [newPartner] = await db
			.insert(partners)
			.values({
				companyName: validatedData.fullName,
				contactEmail: validatedData.email,
				contactPhone: validatedData.mobile,
				password: hashedPassword,
				partnerType: "chartered_accountant",
				isActive: true,
				isVerified: false,

				icaiMembershipNumber: validatedData.icaiMembershipNumber,
				icaiMembershipType: validatedData.membershipType,
				caFirmName: validatedData.firmName || null,
				caFirmRegistrationNumber: validatedData.firmRegistrationNumber || null,
				caSpecializations: validatedData.specializations,
				caExperienceYears: validatedData.experienceYears,
				caQualificationYear: validatedData.qualificationYear,
				caCity: validatedData.city,
				caState: validatedData.state,
				caAvailability: "available",
				caMaxCasesPerMonth: validatedData.maxCasesPerMonth,
				caCurrentActiveCases: 0,
				caCompletedCases: 0,
				caAverageRating: "5.00",
				caTotalRatings: 0,
				caResponseTime: validatedData.responseTime,
				caVerificationStatus: "pending",
				caBio: validatedData.bio || null,

				panNumber: validatedData.panNumber.toUpperCase(),
				bankAccountNumber: validatedData.bankAccountNumber,
				ifscCode: validatedData.ifscCode.toUpperCase(),
				bankAccountHolderName: validatedData.bankAccountHolderName,

				commissionTier: "standard",
			})
			.returning();

		res.status(201).json({
			success: true,
			message:
				"Registration submitted successfully. Your application is under review.",
			partnerId: newPartner.id,
		});
	} catch (error: unknown) {
		logger.error("CA registration error:", error);
		if (error instanceof z.ZodError) {
			res.status(400).json({
				success: false,
				error: "Validation failed",
				details: error.issues,
			});
			return;
		}
		res.status(500).json({
			success: false,
			error: "Registration failed. Please try again.",
		});
	}
});

router.get(
	"/my-profile",
	requireAuth,
	injectRoleInfo,
	requirePartnerPortal,
	async (req: Request, res: Response): Promise<void> => {
		try {
			const user = (req as AuthRequest).user;

			if (!user) {
				res.status(401).json({
					success: false,
					error: "Authentication required",
				});
				return;
			}

			const [caPartner] = await db
				.select()
				.from(partners)
				.where(
					and(
						eq(partners.contactEmail, user.email || ""),
						eq(partners.partnerType, "chartered_accountant"),
					),
				)
				.limit(1);

			if (!caPartner) {
				res.status(404).json({
					success: false,
					error: "CA profile not found for this user",
				});
				return;
			}

			res.json({
				success: true,
				partnerId: caPartner.id,
				profile: {
					id: caPartner.id,
					name: caPartner.companyName,
					email: caPartner.contactEmail,
					icaiNumber: caPartner.icaiMembershipNumber,
					membershipType: caPartner.icaiMembershipType,
					verificationStatus: caPartner.caVerificationStatus,
				},
			});
		} catch (error: unknown) {
			logger.error("Error fetching CA profile:", error);
			res.status(500).json({
				success: false,
				error: "Failed to fetch CA profile",
			});
		}
	},
);

router.get(
	"/available",
	requireAuth,
	async (req: Request, res: Response): Promise<void> => {
		try {
			const { caseType, city, state, itrFormType } = req.query;
			const validCaseTypes = [
				"itr",
				"gst",
				"audit",
				"form15",
				"tax_notice",
				"company_law",
			];
			const selectedCaseType =
				typeof caseType === "string" && validCaseTypes.includes(caseType)
					? (caseType as
							| "itr"
							| "gst"
							| "audit"
							| "form15"
							| "tax_notice"
							| "company_law")
					: "itr";

			const candidates = await caAssignmentService.findBestCA({
				caseType: selectedCaseType,
				clientCity: city as string,
				clientState: state as string,
				itrFormType: itrFormType as string,
			});

			res.json({
				success: true,
				candidates,
			});
		} catch (error: unknown) {
			logger.error("Error fetching available CAs:", error);
			res.status(500).json({
				success: false,
				error: "Failed to fetch available CAs",
			});
		}
	},
);

router.post(
	"/assign",
	requireAuth,
	injectRoleInfo,
	requireAgentPortal,
	async (req: Request, res: Response): Promise<void> => {
		try {
			const { caseId, caPartnerId, autoAssign, criteria } = req.body;

			if (autoAssign && criteria) {
				const result = await caAssignmentService.autoAssignCA(caseId, criteria);
				res.json(result);
				return;
			}

			if (caseId && caPartnerId) {
				const result = await caAssignmentService.assignCAToCaseFromPartners(
					caseId,
					caPartnerId,
				);
				res.json(result);
				return;
			}

			res.status(400).json({
				success: false,
				error: "Missing required parameters",
			});
		} catch (error: unknown) {
			logger.error("Error assigning CA:", error);
			res.status(500).json({
				success: false,
				error: "Failed to assign CA",
			});
		}
	},
);

router.get(
	"/dashboard/:partnerId",
	requireAuth,
	injectRoleInfo,
	requirePartnerPortal,
	async (req: Request, res: Response): Promise<void> => {
		try {
			const { partnerId } = req.params;
			const user = (req as AuthRequest).user;

			const stats = await caAssignmentService.getCADashboardStats(partnerId, user?.id);

			const [caProfile] = await db
				.select()
				.from(partners)
				.where(
					and(
						eq(partners.id, partnerId),
						eq(partners.partnerType, "chartered_accountant"),
					),
				)
				.limit(1);

			if (!caProfile) {
				res.status(404).json({
					success: false,
					error: "CA profile not found",
				});
				return;
			}

			res.json({
				success: true,
				profile: {
					id: caProfile.id,
					name: caProfile.companyName,
					email: caProfile.contactEmail,
					icaiNumber: caProfile.icaiMembershipNumber,
					membershipType: caProfile.icaiMembershipType,
					specializations: caProfile.caSpecializations,
					city: caProfile.caCity,
					state: caProfile.caState,
					availability: caProfile.caAvailability,
					maxCases: caProfile.caMaxCasesPerMonth,
					verificationStatus: caProfile.caVerificationStatus,
				},
				stats,
			});
		} catch (error: unknown) {
			logger.error("Error fetching CA dashboard:", error);
			res.status(500).json({
				success: false,
				error: "Failed to fetch dashboard data",
			});
		}
	},
);

router.get(
	"/cases/:partnerId",
	requireAuth,
	injectRoleInfo,
	requirePartnerPortal,
	async (req: Request, res: Response): Promise<void> => {
		try {
			const { partnerId } = req.params;
			const { status } = req.query;
			const user = (req as AuthRequest).user;

			const cases = await caCaseService.getCasesForCA(
				partnerId,
				user?.id,
				status as string | undefined,
			);

			res.json({
				success: true,
				cases,
				total: cases.length,
			});
		} catch (error: unknown) {
			logger.error("Error fetching CA cases:", error);
			res.status(500).json({
				success: false,
				error: "Failed to fetch cases",
			});
		}
	},
);

router.get(
	"/cases/detail/:caseId",
	requireAuth,
	injectRoleInfo,
	requirePartnerPortal,
	async (req: Request, res: Response): Promise<void> => {
		try {
			const { caseId } = req.params;
			const caseDetail = await caCaseService.getCaseDetails(caseId);

			if (!caseDetail) {
				res.status(404).json({
					success: false,
					error: "Case not found",
				});
				return;
			}

			res.json({
				success: true,
				data: caseDetail,
			});
		} catch (error: unknown) {
			logger.error("Error fetching case detail:", error);
			res.status(500).json({
				success: false,
				error: "Failed to fetch case detail",
			});
		}
	},
);

router.patch(
	"/cases/:caseId/status",
	requireAuth,
	injectRoleInfo,
	requirePartnerPortal,
	async (req: Request, res: Response): Promise<void> => {
		try {
			const { caseId } = req.params;
			const { status, subStatus, notes } = req.body;
			const user = (req as AuthRequest).user;

			if (!status) {
				res.status(400).json({
					success: false,
					error: "Status is required",
				});
				return;
			}

			const result = await caCaseService.updateCaseStatus(caseId, {
				status,
				subStatus,
				notes,
				updatedBy: user?.email || user?.id || "CA Partner",
			});

			res.json(result);
		} catch (error: unknown) {
			logger.error("Error updating case status:", error);
			res.status(500).json({
				success: false,
				error: error instanceof Error ? error.message : "Failed to update case status",
			});
		}
	},
);

router.patch(
	"/cases/:caseId/computation",
	requireAuth,
	injectRoleInfo,
	requirePartnerPortal,
	async (req: Request, res: Response): Promise<void> => {
		try {
			const { caseId } = req.params;
			const computationInput = req.body;

			const result = await caCaseService.updateComputation(caseId, computationInput);
			res.json(result);
		} catch (error: unknown) {
			logger.error("Error updating case computation:", error);
			res.status(500).json({
				success: false,
				error: error instanceof Error ? error.message : "Failed to update computation",
			});
		}
	},
);

router.post(
	"/cases/:caseId/queries",
	requireAuth,
	injectRoleInfo,
	requirePartnerPortal,
	async (req: Request, res: Response): Promise<void> => {
		try {
			const { caseId } = req.params;
			const { query } = req.body;
			const user = (req as AuthRequest).user;

			if (!query?.trim()) {
				res.status(400).json({ success: false, error: "Query cannot be empty" });
				return;
			}

			const result = await caCaseService.addClientQuery(caseId, {
				query,
				askedBy: user?.email || user?.id || "CA",
			});
			res.json(result);
		} catch (error: unknown) {
			logger.error("Error adding client query:", error);
			res.status(500).json({ success: false, error: "Failed to add query" });
		}
	},
);

router.patch(
	"/cases/:caseId/queries/:queryIndex/resolve",
	requireAuth,
	injectRoleInfo,
	requirePartnerPortal,
	async (req: Request, res: Response): Promise<void> => {
		try {
			const { caseId, queryIndex } = req.params;
			const { response } = req.body;

			if (!response?.trim()) {
				res.status(400).json({ success: false, error: "Response cannot be empty" });
				return;
			}

			const result = await caCaseService.resolveClientQuery(
				caseId,
				Number.parseInt(queryIndex),
				response,
			);
			res.json(result);
		} catch (error: unknown) {
			logger.error("Error resolving query:", error);
			res.status(500).json({ success: false, error: "Failed to resolve query" });
		}
	},
);

router.patch(
	"/cases/:caseId/documents",
	requireAuth,
	injectRoleInfo,
	requirePartnerPortal,
	async (req: Request, res: Response): Promise<void> => {
		try {
			const { caseId } = req.params;
			const { documentsRequired, documentsReceived, documentsMissing } = req.body;

			const result = await caCaseService.updateDocuments(caseId, {
				documentsRequired,
				documentsReceived,
				documentsMissing,
			});
			res.json(result);
		} catch (error: unknown) {
			logger.error("Error updating documents:", error);
			res.status(500).json({ success: false, error: "Failed to update documents" });
		}
	},
);

router.post(
	"/reconciliation/run",
	requireAuth,
	injectRoleInfo,
	requirePartnerPortal,
	async (req: Request, res: Response): Promise<void> => {
		try {
			const { caseId, aisData, form26asData } = req.body;
			if (!caseId) {
				res.status(400).json({ success: false, error: "Case ID is required" });
				return;
			}

			const report = await caReconciliationService.reconcileCase(
				caseId,
				aisData || {},
				form26asData || {},
			);

			res.json({
				success: true,
				report,
				meta: {
					timestamp: new Date().toISOString(),
					version: "RECON_AIS_V1.0",
				},
			});
		} catch (error: unknown) {
			logger.error("Error running reconciliation:", error);
			res.status(500).json({
				success: false,
				error: error instanceof Error ? error.message : "Failed to run reconciliation",
			});
		}
	},
);

router.post(
	"/certification/udin/validate",
	requireAuth,
	injectRoleInfo,
	requirePartnerPortal,
	async (req: Request, res: Response): Promise<void> => {
		try {
			const { udin, membershipNumber } = req.body;
			if (!udin) {
				res.status(400).json({ success: false, error: "UDIN is required" });
				return;
			}

			const result = caCertificationService.validateUDINFormat(udin, membershipNumber);
			res.json({ success: true, result });
		} catch (error: unknown) {
			res.status(500).json({ success: false, error: "Failed to validate UDIN" });
		}
	},
);

router.post(
	"/certification/15cb/draft",
	requireAuth,
	injectRoleInfo,
	requirePartnerPortal,
	async (req: Request, res: Response): Promise<void> => {
		try {
			const draft = await caCertificationService.draftForm15CB(req.body);
			res.json({ success: true, draft });
		} catch (error: unknown) {
			res.status(500).json({
				success: false,
				error: error instanceof Error ? error.message : "Failed to draft Form 15CB",
			});
		}
	},
);

router.post(
	"/certification/networth/generate",
	requireAuth,
	injectRoleInfo,
	requirePartnerPortal,
	async (req: Request, res: Response): Promise<void> => {
		try {
			const cert = await caCertificationService.generateNetWorthCertificate(req.body);
			res.json(cert);
		} catch (error: unknown) {
			res.status(500).json({
				success: false,
				error: error instanceof Error ? error.message : "Failed to generate Net Worth Certificate",
			});
		}
	},
);

router.get(
	"/certification/history/:partnerId",
	requireAuth,
	injectRoleInfo,
	requirePartnerPortal,
	async (req: Request, res: Response): Promise<void> => {
		try {
			const { partnerId } = req.params;
			const history = await caCertificationService.getCertificationHistory(partnerId);
			res.json({ success: true, history });
		} catch (error: unknown) {
			res.status(500).json({ success: false, error: "Failed to fetch certification history" });
		}
	},
);

router.patch(
	"/availability/:partnerId",
	requireAuth,
	injectRoleInfo,
	requirePartnerPortal,
	async (req: Request, res: Response): Promise<void> => {
		try {
			const { partnerId } = req.params;
			const { availability } = req.body;

			if (
				!["available", "busy", "on_leave", "unavailable"].includes(availability)
			) {
				res.status(400).json({
					success: false,
					error: "Invalid availability status",
				});
				return;
			}

			await db
				.update(partners)
				.set({
					caAvailability: availability,
					updatedAt: new Date(),
				})
				.where(eq(partners.id, partnerId));

			res.json({
				success: true,
				message: "Availability updated",
			});
		} catch (error: unknown) {
			logger.error("Error updating availability:", error);
			res.status(500).json({
				success: false,
				error: "Failed to update availability",
			});
		}
	},
);

router.post(
	"/case/:caseId/complete",
	requireAuth,
	injectRoleInfo,
	requirePartnerPortal,
	async (req: Request, res: Response): Promise<void> => {
		try {
			const { caseId } = req.params;
			const { caPartnerId, rating } = req.body;

			const result = await caAssignmentService.markCaseCompleted(
				caseId,
				caPartnerId,
			);

			if (rating) {
				await caAssignmentService.updateCARating(caPartnerId, rating);
			}

			res.json(result);
		} catch (error: unknown) {
			logger.error("Error completing case:", error);
			res.status(500).json({
				success: false,
				error: "Failed to complete case",
			});
		}
	},
);

router.get(
	"/admin/pending-verifications",
	requireAuth,
	injectRoleInfo,
	requireAdminPortal,
	async (_req: Request, res: Response): Promise<void> => {
		try {
			const pendingCAs = await db
				.select()
				.from(partners)
				.where(
					and(
						eq(partners.partnerType, "chartered_accountant"),
						eq(partners.caVerificationStatus, "pending"),
					),
				)
				.orderBy(desc(partners.createdAt));

			res.json({
				success: true,
				pendingCAs: pendingCAs.map((ca) => ({
					id: ca.id,
					name: ca.companyName,
					email: ca.contactEmail,
					mobile: ca.contactPhone,
					icaiNumber: ca.icaiMembershipNumber,
					membershipType: ca.icaiMembershipType,
					firmName: ca.caFirmName,
					specializations: ca.caSpecializations,
					city: ca.caCity,
					state: ca.caState,
					experience: ca.caExperienceYears,
					appliedAt: ca.createdAt,
				})),
			});
		} catch (error: unknown) {
			logger.error("Error fetching pending verifications:", error);
			res.status(500).json({
				success: false,
				error: "Failed to fetch pending verifications",
			});
		}
	},
);

router.post(
	"/admin/verify/:partnerId",
	requireAuth,
	injectRoleInfo,
	requireAdminPortal,
	async (req: Request, res: Response): Promise<void> => {
		try {
			const { partnerId } = req.params;
			const { action, adminId } = req.body;

			if (!["approve", "reject"].includes(action)) {
				res.status(400).json({
					success: false,
					error: "Invalid action",
				});
				return;
			}

			await db
				.update(partners)
				.set({
					caVerificationStatus: action === "approve" ? "verified" : "rejected",
					caVerifiedAt: new Date(),
					caVerifiedBy: adminId,
					isVerified: action === "approve",
					updatedAt: new Date(),
				})
				.where(eq(partners.id, partnerId));

			res.json({
				success: true,
				message: `CA ${action === "approve" ? "approved" : "rejected"} successfully`,
			});
		} catch (error: unknown) {
			logger.error("Error verifying CA:", error);
			res.status(500).json({
				success: false,
				error: "Failed to verify CA",
			});
		}
	},
);

router.get(
	"/admin/all",
	requireAuth,
	injectRoleInfo,
	requireAdminPortal,
	async (req: Request, res: Response): Promise<void> => {
		try {
			const { status, search, page = "1", limit = "20" } = req.query;

			const query = db
				.select()
				.from(partners)
				.where(eq(partners.partnerType, "chartered_accountant"));
			const allCAs = await query.orderBy(desc(partners.createdAt));

			const filteredCAs = allCAs.filter((ca) => {
				if (status && status !== "all" && ca.caVerificationStatus !== status) {
					return false;
				}
				if (search) {
					const searchLower = (search as string).toLowerCase();
					return (
						ca.companyName?.toLowerCase().includes(searchLower) ||
						false ||
						ca.contactEmail?.toLowerCase().includes(searchLower) ||
						false ||
						ca.icaiMembershipNumber?.toLowerCase().includes(searchLower) ||
						false
					);
				}
				return true;
			});

			const pageNum = Number.parseInt(page as string);
			const limitNum = Number.parseInt(limit as string);
			const offset = (pageNum - 1) * limitNum;
			const paginatedCAs = filteredCAs.slice(offset, offset + limitNum);

			res.json({
				success: true,
				cas: paginatedCAs.map((ca) => ({
					id: ca.id,
					name: ca.companyName,
					email: ca.contactEmail,
					mobile: ca.contactPhone,
					icaiNumber: ca.icaiMembershipNumber,
					membershipType: ca.icaiMembershipType,
					firmName: ca.caFirmName,
					specializations: ca.caSpecializations,
					city: ca.caCity,
					state: ca.caState,
					experience: ca.caExperienceYears,
					availability: ca.caAvailability,
					activeCases: ca.caCurrentActiveCases,
					completedCases: ca.caCompletedCases,
					rating: ca.caAverageRating,
					verificationStatus: ca.caVerificationStatus,
					createdAt: ca.createdAt,
				})),
				pagination: {
					total: filteredCAs.length,
					page: pageNum,
					limit: limitNum,
					totalPages: Math.ceil(filteredCAs.length / limitNum),
				},
			});
		} catch (error: unknown) {
			logger.error("Error fetching CAs:", error);
			res.status(500).json({
				success: false,
				error: "Failed to fetch CAs",
			});
		}
	},
);

router.get(
	"/admin/performance",
	requireAuth,
	injectRoleInfo,
	requireAdminPortal,
	async (_req: Request, res: Response): Promise<void> => {
		try {
			const allCAs = await db
				.select()
				.from(partners)
				.where(
					and(
						eq(partners.partnerType, "chartered_accountant"),
						eq(partners.caVerificationStatus, "verified"),
					),
				);

			const performance = allCAs.map((ca) => ({
				id: ca.id,
				name: ca.companyName,
				activeCases: ca.caCurrentActiveCases || 0,
				completedCases: ca.caCompletedCases || 0,
				maxCases: ca.caMaxCasesPerMonth || 50,
				utilizationRate: Math.round(
					((ca.caCurrentActiveCases || 0) / (ca.caMaxCasesPerMonth || 50)) *
						100,
				),
				rating: Number.parseFloat(ca.caAverageRating || "5.0"),
				responseTime: ca.caResponseTime,
				availability: ca.caAvailability,
				specializations: ca.caSpecializations,
			}));

			res.json({
				success: true,
				performance,
				summary: {
					totalCAs: allCAs.length,
					availableCAs: allCAs.filter((ca) => ca.caAvailability === "available")
						.length,
					avgUtilization:
						Math.round(
							performance.reduce((sum, ca) => sum + ca.utilizationRate, 0) /
								performance.length,
						) || 0,
					avgRating:
						(
							performance.reduce((sum, ca) => sum + ca.rating, 0) /
							performance.length
						).toFixed(2) || "0.00",
				},
			});
		} catch (error: unknown) {
			logger.error("Error fetching CA performance:", error);
			res.status(500).json({
				success: false,
				error: "Failed to fetch performance data",
			});
		}
	},
);

router.post(
	"/admin/verify-icai/:partnerId",
	requireAuth,
	injectRoleInfo,
	requireAdminPortal,
	async (req: Request, res: Response): Promise<void> => {
		try {
			const { partnerId } = req.params;
			const { forceRefresh = false } = req.body;

			const [partner] = await db
				.select()
				.from(partners)
				.where(
					and(
						eq(partners.id, partnerId),
						eq(partners.partnerType, "chartered_accountant"),
					),
				)
				.limit(1);

			if (!partner) {
				res.status(404).json({ success: false, error: "CA partner not found" });
				return;
			}

			if (!partner.icaiMembershipNumber) {
				res
					.status(400)
					.json({
						success: false,
						error: "Partner has no ICAI membership number on record",
					});
				return;
			}

			const result = await verifyICAIMembership(
				partner.icaiMembershipNumber,
				partner.companyName ?? undefined,
				partnerId,
				Boolean(forceRefresh),
			);

			const icaiActive =
				result.membershipStatus === "ACTIVE" ||
				result.membershipStatus === "FELLOW" ||
				result.membershipStatus === "ASSOCIATE";
			const icaiScraperStatus = icaiActive
				? "verified"
				: result.source === "SCRAPER_FAILED"
					? "scraper_failed"
					: "unverified";
			const autoApprove = icaiActive && (result.nameMatchScore ?? 0) >= 70;
			const newVerifStatus = autoApprove
				? "verified"
				: result.source === "SCRAPER_FAILED"
					? partner.caVerificationStatus
					: "pending";

			await db.execute(sql`
      UPDATE partners SET
        icai_scraped_name       = ${result.nameAtICAI ?? null},
        icai_scraper_status     = ${icaiScraperStatus},
        icai_scraper_run_at     = NOW(),
        icai_scraper_source     = ${result.source},
        icai_confidence_score   = ${result.confidenceScore},
        icai_cop_status         = ${result.copStatus ?? null},
        ca_verification_status  = ${newVerifStatus},
        updated_at = NOW()
      WHERE id = ${partnerId}
    `);

			res.json({
				success: true,
				partnerId,
				icaiNumber: partner.icaiMembershipNumber,
				result: {
					nameAtICAI: result.nameAtICAI,
					providedName: partner.companyName,
					membershipStatus: result.membershipStatus,
					membershipType: result.membershipType,
					copStatus: result.copStatus,
					nameMatchScore: result.nameMatchScore,
					confidenceScore: result.confidenceScore,
					source: result.source,
					error: result.error,
				},
				autoApproved:
					(result.membershipStatus === "ACTIVE" ||
						result.membershipStatus === "FELLOW") &&
					(result.nameMatchScore ?? 0) >= 70,
			});
		} catch (error: unknown) {
			const msg = error instanceof Error ? error.message : String(error);
			logger.error("[ICAI] Admin verify-icai error:", msg);
			res.status(500).json({ success: false, error: msg });
		}
	},
);

router.post(
	"/icai-check",
	requireAuth,
	injectRoleInfo,
	requirePartnerPortal,
	async (req: Request, res: Response): Promise<void> => {
		try {
			const user = (req as AuthRequest).user;
			const { membershipNumber } = req.body;

			if (!user) {
				res.status(401).json({ success: false, error: "Unauthorized" });
				return;
			}

			const [partner] = await db
				.select()
				.from(partners)
				.where(
					and(
						eq(partners.contactEmail, user.email || ""),
						eq(partners.partnerType, "chartered_accountant"),
					),
				)
				.limit(1);

			if (!partner) {
				res.status(404).json({ success: false, error: "CA profile not found" });
				return;
			}

			const icaiNumber =
				(membershipNumber as string) || partner.icaiMembershipNumber;
			if (!icaiNumber) {
				res
					.status(400)
					.json({
						success: false,
						error: "No ICAI membership number provided",
					});
				return;
			}

			const result = await verifyICAIMembership(
				icaiNumber,
				partner.companyName ?? undefined,
				partner.id,
			);

			await db.execute(sql`
      UPDATE partners SET
        icai_scraped_name     = ${result.nameAtICAI ?? null},
        icai_scraper_status   = ${result.source === "SCRAPER_FAILED" ? "scraper_failed" : "checked"},
        icai_scraper_run_at   = NOW(),
        icai_scraper_source   = ${result.source},
        icai_confidence_score = ${result.confidenceScore},
        icai_cop_status       = ${result.copStatus ?? null},
        updated_at = NOW()
      WHERE id = ${partner.id}
    `);

			res.json({
				success: true,
				membershipStatus: result.membershipStatus,
				nameAtICAI: result.nameAtICAI,
				copStatus: result.copStatus,
				confidenceScore: result.confidenceScore,
				source: result.source,
				nameMatchScore: result.nameMatchScore,
				message:
					result.source === "SCRAPER_FAILED"
						? "Could not reach ICAI portal. Manual verification will be done by our team."
						: result.membershipStatus === "ACTIVE" ||
								result.membershipStatus === "FELLOW"
							? "ICAI membership confirmed. Your application is under review."
							: "ICAI membership status could not be confirmed. Our team will verify manually.",
				error: result.error,
			});
		} catch (error: unknown) {
			logger.error("[ICAI] Self-check error:", error);
			res
				.status(500)
				.json({
					success: false,
					error: "Verification request failed. Please try again.",
				});
		}
	},
);

router.get(
	"/icai-status/:membershipNumber",
	requireAuth,
	async (req: Request, res: Response): Promise<void> => {
		try {
			const { membershipNumber } = req.params;
			const cleaned = membershipNumber.trim().toUpperCase();

			const rows = await db.execute(sql`
      SELECT
        p.id,
        p.company_name,
        p.icai_membership_number,
        p.icai_scraped_name,
        p.icai_scraper_status,
        p.icai_scraper_run_at,
        p.icai_scraper_source,
        p.icai_confidence_score,
        p.icai_cop_status,
        p.ca_verification_status
      FROM partners p
      WHERE p.icai_membership_number = ${cleaned}
        AND p.partner_type = 'chartered_accountant'
      LIMIT 1
    `);

			const row = (rows as unknown as { rows: any[] }).rows[0];
			if (!row) {
				res
					.status(404)
					.json({
						success: false,
						error: "No CA record found for this membership number",
					});
				return;
			}

			res.json({
				success: true,
				partnerId: row.id,
				membershipNumber: row.icai_membership_number,
				registeredName: row.company_name,
				scraperResult: {
					nameAtICAI: row.icai_scraped_name,
					status: row.icai_scraper_status,
					runAt: row.icai_scraper_run_at,
					source: row.icai_scraper_source,
					confidenceScore: row.icai_confidence_score,
					copStatus: row.icai_cop_status,
				},
				overallVerificationStatus: row.ca_verification_status,
			});
		} catch (error: unknown) {
			const msg = error instanceof Error ? error.message : String(error);
			logger.error("[ICAI] Status check error:", msg);
			res.status(500).json({ success: false, error: msg });
		}
	},
);

router.get(
	"/clients/:partnerId",
	requireAuth,
	injectRoleInfo,
	requirePartnerPortal,
	async (req: Request, res: Response): Promise<void> => {
		try {
			const user = (req as AuthRequest).user;
			if (!user) {
				res.status(401).json({ success: false, error: "Unauthorized" });
				return;
			}
			const caUserId = user.id;

			const clientCases = await db
				.select({
					clientId: agentItrCases.clientId,
					caseId: agentItrCases.id,
					assessmentYear: agentItrCases.assessmentYear,
					financialYear: agentItrCases.financialYear,
					status: agentItrCases.status,
					itrFormType: agentItrCases.itrFormType,
					totalFee: agentItrCases.totalFee,
					feeStatus: agentItrCases.feeStatus,
					createdAt: agentItrCases.createdAt,
				})
				.from(agentItrCases)
				.where(eq(agentItrCases.caId, caUserId))
				.orderBy(desc(agentItrCases.createdAt));

			const uniqueClientIds = [...new Set(clientCases.map((c) => c.clientId))];
			let clientUsers: ClientUser[] = [];
			if (uniqueClientIds.length > 0) {
				clientUsers = (await db
					.select({
						id: users.id,
						firstName: users.firstName,
						lastName: users.lastName,
						email: users.email,
					})
					.from(users)
					.where(
						inArray(users.id, uniqueClientIds),
					)) as unknown as ClientUser[];
			}
			const clientMap = Object.fromEntries(clientUsers.map((u) => [u.id, u]));

			const clientsMap = new Map<string, any>();
			for (const c of clientCases) {
				if (!clientsMap.has(c.clientId)) {
					const u = clientMap[c.clientId] || {};
					const clientName =
						u.firstName || u.lastName
							? `${u.firstName || ""} ${u.lastName || ""}`.trim()
							: u.email || "Client";
					clientsMap.set(c.clientId, {
						clientId: c.clientId,
						name: clientName,
						email: u.email || "",
						totalCases: 0,
						activeCases: 0,
						completedCases: 0,
						totalFees: 0,
						joinedAt: c.createdAt,
						latestStatus: c.status,
					});
				}
				const client = clientsMap.get(c.clientId)!;
				client.totalCases++;
				if (["completed", "filed", "acknowledged"].includes(c.status || "")) {
					client.completedCases++;
				} else {
					client.activeCases++;
				}
				client.totalFees += Number.parseFloat(String(c.totalFee || "0"));
				client.latestStatus = c.status;
			}

			res.json({
				success: true,
				clients: Array.from(clientsMap.values()),
				totalCases: clientCases.length,
			});
		} catch (error: unknown) {
			logger.error("Error fetching CA clients:", error);
			res
				.status(500)
				.json({ success: false, error: "Failed to fetch clients" });
		}
	},
);

router.get(
	"/referral-stats",
	requireAuth,
	injectRoleInfo,
	requirePartnerPortal,
	async (req: Request, res: Response): Promise<void> => {
		try {
			const user = (req as AuthRequest).user;
			if (!user) {
				res.status(401).json({ success: false, error: "Unauthorized" });
				return;
			}
			const { caRegistryService } = await import(
				"../services/ca-registry-service"
			);

			const empResult = await db.execute(sql`
      SELECT ca_membership_number FROM agent_empanelments WHERE agent_id = ${user.id} LIMIT 1
    `);
			const emp = (empResult as unknown as { rows: any[] })
				.rows[0] as unknown as EmpanelmentRecord | undefined;
			const icaiNumber = emp?.ca_membership_number;

			if (!icaiNumber) {
				res
					.status(404)
					.json({
						success: false,
						error: "CA membership not linked to this account",
					});
				return;
			}

			const entry = (await caRegistryService.lookupFromRegistry(
				icaiNumber,
			)) as unknown as RegistryEntry | null;
			if (!entry) {
				res
					.status(404)
					.json({ success: false, error: "Registry entry not found" });
				return;
			}

			res.json({
				success: true,
				referralCode: entry.referralCode,
				referralCount: entry.referralCount || 0,
				tier: entry.tier,
				isPubliclyListed: entry.isPubliclyListed,
			});
		} catch (error: unknown) {
			logger.error("Error fetching CA referral stats:", error);
			res
				.status(500)
				.json({ success: false, error: "Failed to fetch referral stats" });
		}
	},
);

router.post(
	"/redeem-referral",
	async (req: Request, res: Response): Promise<void> => {
		try {
			const { code } = req.body;
			if (!code) {
				res
					.status(400)
					.json({ success: false, error: "Referral code is required" });
				return;
			}

			const { caRegistryService } = await import(
				"../services/ca-registry-service"
			);
			const result = await caRegistryService.redeemReferralCode(code);

			if (!result) {
				res
					.status(404)
					.json({ success: false, error: "Invalid or expired referral code" });
				return;
			}

			res.json({
				success: true,
				message: "Referral code redeemed successfully",
			});
		} catch (error: unknown) {
			logger.error("Error redeeming referral code:", error);
			res.status(500).json({ success: false, error: "Failed to redeem code" });
		}
	},
);

router.post(
	"/clients/invite",
	requireAuth,
	injectRoleInfo,
	requirePartnerPortal,
	async (req: Request, res: Response): Promise<void> => {
		try {
			const user = (req as AuthRequest).user;
			const { name, email, mobile } = req.body;

			if (!user) {
				res.status(401).json({ success: false, error: "Unauthorized" });
				return;
			}

			if (!email && !mobile) {
				res
					.status(400)
					.json({
						success: false,
						error: "Email or mobile number is required",
					});
				return;
			}

			const [caPartner] = await db
				.select({ id: partners.id })
				.from(partners)
				.where(
					and(
						eq(partners.contactEmail, user.email || ""),
						eq(partners.partnerType, "chartered_accountant"),
					),
				)
				.limit(1);

			const caRef = caPartner?.id || user.id;
			const protocol = req.headers["x-forwarded-proto"] || "https";
			const host =
				req.headers["x-forwarded-host"] || req.headers.host || "fintekpro.com";

			const { caRegistryService } = await import(
				"../services/ca-registry-service"
			);
			const empResult = await db.execute(
				sql`SELECT ca_membership_number FROM agent_empanelments WHERE agent_id = ${user.id} LIMIT 1`,
			);
			const emp = (empResult as unknown as { rows: any[] })
				.rows[0] as unknown as EmpanelmentRecord | undefined;
			const icai = emp?.ca_membership_number;
			const registryEntry = icai
				? ((await caRegistryService.lookupFromRegistry(
						icai,
					)) as unknown as RegistryEntry | null)
				: null;

			const code = registryEntry?.referralCode || `ca_${caRef}`;
			const inviteLink = `${protocol}://${host}/itr-tax-services?ref=${code}`;

			res.json({
				success: true,
				inviteLink,
				message: `Invite link generated${name ? ` for ${name}` : ""}`,
				inviteDetails: {
					clientName: name || null,
					clientEmail: email || null,
					clientMobile: mobile || null,
					referralCode: code,
					generatedAt: new Date().toISOString(),
				},
			});
		} catch (error: unknown) {
			logger.error("Error generating CA client invite:", error);
			res
				.status(500)
				.json({ success: false, error: "Failed to generate invite" });
		}
	},
);

// --- ADVANCED CA TOOLS & PRACTICE UPGRADES ---

router.post(
	"/tools/itd-json/parse",
	requireAuth,
	injectRoleInfo,
	requirePartnerPortal,
	async (req: Request, res: Response): Promise<void> => {
		try {
			const { rawJson, caseId } = req.body;
			if (!rawJson) {
				res.status(400).json({ success: false, error: "Raw JSON payload is required" });
				return;
			}

			const parsed = caItdParserService.parseJson(rawJson);

			let appliedCase = null;
			if (caseId) {
				appliedCase = await caItdParserService.applyToCase(caseId, parsed);
			}

			res.json({
				success: true,
				parsed,
				applied: !!appliedCase,
			});
		} catch (error: unknown) {
			logger.error("Error parsing ITD pre-fill JSON:", error);
			res.status(500).json({
				success: false,
				error: error instanceof Error ? error.message : "Failed to parse ITD JSON",
			});
		}
	},
);

router.post(
	"/tools/advance-tax/calculate",
	requireAuth,
	injectRoleInfo,
	requirePartnerPortal,
	async (req: Request, res: Response): Promise<void> => {
		try {
			const report = caAdvanceTaxService.calculateSchedule(req.body);
			res.json({ success: true, report });
		} catch (error: unknown) {
			logger.error("Error calculating advance tax:", error);
			res.status(500).json({
				success: false,
				error: error instanceof Error ? error.message : "Failed to calculate advance tax",
			});
		}
	},
);

router.post(
	"/tools/schedule-fa/generate",
	requireAuth,
	injectRoleInfo,
	requirePartnerPortal,
	async (req: Request, res: Response): Promise<void> => {
		try {
			const report = caScheduleFaService.generateReport(req.body);
			res.json({ success: true, report });
		} catch (error: unknown) {
			logger.error("Error generating Schedule FA:", error);
			res.status(500).json({
				success: false,
				error: error instanceof Error ? error.message : "Failed to generate Schedule FA",
			});
		}
	},
);

router.get(
	"/tools/dsc/list/:partnerId",
	requireAuth,
	injectRoleInfo,
	requirePartnerPortal,
	async (req: Request, res: Response): Promise<void> => {
		try {
			const { partnerId } = req.params;
			const tokens = caDscService.listTokens(partnerId);
			res.json({ success: true, tokens });
		} catch (error: unknown) {
			logger.error("Error listing DSC tokens:", error);
			res.status(500).json({ success: false, error: "Failed to list DSC tokens" });
		}
	},
);

router.post(
	"/tools/dsc/register",
	requireAuth,
	injectRoleInfo,
	requirePartnerPortal,
	async (req: Request, res: Response): Promise<void> => {
		try {
			const { partnerId, token } = req.body;
			if (!token || !partnerId) {
				res.status(400).json({ success: false, error: "Partner ID and token details required" });
				return;
			}
			const created = caDscService.registerToken(partnerId, token);
			res.json({ success: true, token: created });
		} catch (error: unknown) {
			logger.error("Error registering DSC token:", error);
			res.status(500).json({ success: false, error: "Failed to register DSC token" });
		}
	},
);

router.post(
	"/tools/client-approval/request",
	requireAuth,
	injectRoleInfo,
	requirePartnerPortal,
	async (req: Request, res: Response): Promise<void> => {
		try {
			const { caseId, caPartnerId } = req.body;
			if (!caseId || !caPartnerId) {
				res.status(400).json({ success: false, error: "Case ID and CA Partner ID required" });
				return;
			}

			const protocol = req.headers["x-forwarded-proto"] || "https";
			const host = req.headers["x-forwarded-host"] || req.headers.host || "fintekpro.com";
			const baseUrl = `${protocol}://${host}`;

			const sheet = await caClientApprovalService.generateApprovalSheet(caseId, caPartnerId, baseUrl);
			res.json({ success: true, sheet });
		} catch (error: unknown) {
			logger.error("Error generating client approval sheet:", error);
			res.status(500).json({
				success: false,
				error: error instanceof Error ? error.message : "Failed to generate approval sheet",
			});
		}
	},
);

router.post(
	"/tools/client-approval/verify/:token",
	async (req: Request, res: Response): Promise<void> => {
		try {
			const { token } = req.params;
			const result = await caClientApprovalService.verifyApproval(token);
			res.json(result);
		} catch (error: unknown) {
			logger.error("Error verifying client approval:", error);
			res.status(500).json({
				success: false,
				error: error instanceof Error ? error.message : "Failed to verify approval",
			});
		}
	},
);

// --- INCOME TAX NOTICE RESOLUTION & LITIGATION HUB ---

router.post(
	"/notices/validate",
	requireAuth,
	injectRoleInfo,
	requirePartnerPortal,
	async (req: Request, res: Response): Promise<void> => {
		try {
			const result = caNoticeResolutionService.validateNoticeAndDin(req.body);
			res.json({ success: true, result });
		} catch (error: unknown) {
			res.status(500).json({ success: false, error: "Failed to validate notice DIN" });
		}
	},
);

router.post(
	"/notices/reconcile",
	requireAuth,
	injectRoleInfo,
	requirePartnerPortal,
	async (req: Request, res: Response): Promise<void> => {
		try {
			const report = await caNoticeResolutionService.reconcileNoticeDiscrepancy(req.body);
			res.json({ success: true, report });
		} catch (error: unknown) {
			res.status(500).json({
				success: false,
				error: error instanceof Error ? error.message : "Failed to reconcile notice",
			});
		}
	},
);

router.post(
	"/notices/rebuttal",
	requireAuth,
	injectRoleInfo,
	requirePartnerPortal,
	async (req: Request, res: Response): Promise<void> => {
		try {
			const { notice, clientName, clientPan, caFirmName, caName, icaiNumber } = req.body;
			if (!notice || !clientName) {
				res.status(400).json({ success: false, error: "Notice details and client name required" });
				return;
			}

			const draft = caNoticeResolutionService.generateRebuttal(
				notice,
				clientName,
				clientPan || "PAN_ON_FILE",
				caFirmName || "Chartered Accountants",
				caName || "Authorized Representative",
				icaiNumber,
			);
			res.json({ success: true, draft });
		} catch (error: unknown) {
			res.status(500).json({
				success: false,
				error: error instanceof Error ? error.message : "Failed to draft rebuttal",
			});
		}
	},
);

router.post(
	"/notices/appeal",
	requireAuth,
	injectRoleInfo,
	requirePartnerPortal,
	async (req: Request, res: Response): Promise<void> => {
		try {
			const { notice, clientName } = req.body;
			const draft = caNoticeResolutionService.draftCitAppeal(notice, clientName || "Appellant");
			res.json({ success: true, draft });
		} catch (error: unknown) {
			res.status(500).json({
				success: false,
				error: error instanceof Error ? error.message : "Failed to draft appeal",
			});
		}
	},
);

// --- GST 360°, MSME § 43B(h), & MASTER COMPLIANCE CALENDAR ---

router.post(
	"/gst/reconcile-2b",
	requireAuth,
	injectRoleInfo,
	requirePartnerPortal,
	async (req: Request, res: Response): Promise<void> => {
		try {
			const { returnPeriod, purchaseInvoices, gstr2bInvoices } = req.body;
			if (!returnPeriod || !purchaseInvoices || !gstr2bInvoices) {
				res.status(400).json({ success: false, error: "Return period, purchase invoices, and GSTR-2B invoices required" });
				return;
			}

			const report = caGstReconciliationService.reconcile(
				returnPeriod,
				purchaseInvoices,
				gstr2bInvoices,
			);
			res.json({ success: true, report });
		} catch (error: unknown) {
			res.status(500).json({
				success: false,
				error: error instanceof Error ? error.message : "Failed to reconcile GSTR-2B",
			});
		}
	},
);

router.post(
	"/msme/audit-43bh",
	requireAuth,
	injectRoleInfo,
	requirePartnerPortal,
	async (req: Request, res: Response): Promise<void> => {
		try {
			const { financialYear, payables } = req.body;
			if (!financialYear || !payables) {
				res.status(400).json({ success: false, error: "Financial year and payables list required" });
				return;
			}

			const report = caMsmeAuditService.auditPayables(financialYear, payables);
			res.json({ success: true, report });
		} catch (error: unknown) {
			res.status(500).json({
				success: false,
				error: error instanceof Error ? error.message : "Failed to audit MSME payables",
			});
		}
	},
);

router.get(
	"/calendar/deadlines",
	requireAuth,
	injectRoleInfo,
	requirePartnerPortal,
	async (req: Request, res: Response): Promise<void> => {
		try {
			const { year, month } = req.query;
			const y = year ? Number.parseInt(year as string) : undefined;
			const m = month ? Number.parseInt(month as string) : undefined;

			const deadlines = caComplianceCalendarService.getDeadlines(y, m);
			res.json({ success: true, deadlines });
		} catch (error: unknown) {
			res.status(500).json({ success: false, error: "Failed to fetch compliance calendar" });
		}
	},
);

// ─────────────────────────────────────────────────────────────────────────────
// TAX AMENDMENT MANAGEMENT & DYNAMIC PATCHING ENDPOINTS
// ─────────────────────────────────────────────────────────────────────────────

router.get(
	"/tax-amendments",
	requireAuth,
	injectRoleInfo,
	requirePartnerPortal,
	async (req: Request, res: Response): Promise<void> => {
		try {
			const { assessmentYear, category, status } = req.query;
			const amendments = taxAmendmentService.listAmendments({
				assessmentYear: assessmentYear as string,
				category: category as any,
				status: status as any,
			});
			res.json({ success: true, count: amendments.length, amendments });
		} catch (error: unknown) {
			logger.error("Error fetching tax amendments:", { error });
			res.status(500).json({ success: false, error: "Failed to fetch tax amendments" });
		}
	},
);

router.get(
	"/tax-amendments/capital-gains-rule",
	requireAuth,
	injectRoleInfo,
	requirePartnerPortal,
	async (req: Request, res: Response): Promise<void> => {
		try {
			const { assetClass, transactionDate } = req.query;
			if (!assetClass || !transactionDate) {
				res.status(400).json({ success: false, error: "assetClass and transactionDate are required" });
				return;
			}
			const rule = taxAmendmentService.resolveCapitalGainsRule({
				assetClass: assetClass as any,
				transactionDate: transactionDate as string,
			});
			res.json({ success: true, rule });
		} catch (error: unknown) {
			logger.error("Error resolving capital gains rule:", { error });
			res.status(500).json({ success: false, error: "Failed to resolve capital gains rule" });
		}
	},
);

router.post(
	"/tax-amendments/simulate",
	requireAuth,
	injectRoleInfo,
	requirePartnerPortal,
	async (req: Request, res: Response): Promise<void> => {
		try {
			const { amendmentId, sampleIncome, sampleCapitalGains } = req.body;
			if (!amendmentId || sampleIncome === undefined) {
				res.status(400).json({ success: false, error: "amendmentId and sampleIncome are required" });
				return;
			}
			const simulation = taxAmendmentService.simulateAmendmentImpact({
				amendmentId,
				sampleIncome,
				sampleCapitalGains,
			});
			res.json({ success: true, simulation });
		} catch (error: unknown) {
			logger.error("Error simulating tax amendment:", { error });
			res.status(500).json({
				success: false,
				error: error instanceof Error ? error.message : "Failed to simulate tax amendment",
			});
		}
	},
);

router.post(
	"/tax-amendments/ingest",
	requireAuth,
	injectRoleInfo,
	requireAdminPortal,
	async (req: Request, res: Response): Promise<void> => {
		try {
			const patchInput = req.body;
			const result = taxAmendmentService.ingestAmendment(patchInput);
			res.status(201).json(result);
		} catch (error: unknown) {
			logger.error("Error ingesting tax amendment patch:", { error });
			res.status(400).json({
				success: false,
				error: error instanceof Error ? error.message : "Failed to ingest tax amendment patch",
			});
		}
	},
);

export default router;
