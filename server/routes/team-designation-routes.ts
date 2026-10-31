/**
 * FintekPro Team & Designation Management Routes
 * ─────────────────────────────────────────────────────────────────────────────
 * Exposes team and designation management endpoints aligned with candidate
 * eligibility and IRIS KFintech RTA distributor hierarchy:
 *
 *   GET  /api/team/designations            — List all standard designations & regulatory rules
 *   GET  /api/team/designations/:id        — Get single designation details
 *   POST /api/team/eligibility/evaluate    — Evaluate candidate eligibility for designation
 *   GET  /api/team/members                 — List team members with eligibility & IRIS sync status
 *   POST /api/team/members                 — Onboard candidate with mandatory eligibility gate
 *   PUT  /api/team/members/:agentId/designation — Update/promote designation with eligibility check
 *   POST /api/team/members/:agentId/sync-iris   — Synchronize eligible member to IRIS hierarchy
 *   GET  /api/team/iris-alignment          — IRIS endpoint alignment matrix
 *
 * FASP-AI GCR v1.0 Compliance:
 * - Structured logging: { event, user_id, latency_ms, status }
 * - Error format: { error_code, message, retryable }
 * - Response format: { success, data, meta: { timestamp, version, latency_ms } }
 * - Mask PAN in logs
 */

import { Express, Request, Response } from "express";
import { z } from "zod";
import { requireAuth } from "../middleware/auth";
import { requirePartnerPortal } from "../middleware/roleMiddleware";
import {
  teamDesignationService,
  CandidateProfile,
  EducationLevel,
  ENGINE_VERSION,
} from "../services/team-designation-service";
import { logger } from "../logger";

// ── Validation Schemas ───────────────────────────────────────────────────────

const CandidateCertificationSchema = z.object({
  code: z.string().min(2),
  name: z.string().min(2),
  certificateNumber: z.string().optional(),
  validUntil: z.string().optional(),
  isVerified: z.boolean().optional(),
});

const EvaluateEligibilitySchema = z.object({
  targetDesignationId: z.string().default("relationship_manager"),
  candidate: z.object({
    candidateId: z.string().optional(),
    name: z.string().min(2),
    email: z.string().email(),
    mobile: z.string().regex(/^\d{10}$/, "10-digit mobile number required"),
    panNumber: z.string().regex(/^[A-Z]{5}[0-9]{4}[A-Z]$/, "Invalid PAN format"),
    panVerified: z.boolean().optional(),
    kycStatus: z.enum(["PENDING", "VERIFIED", "REJECTED"]).optional(),
    euinNumber: z.string().regex(/^E\d{6}$/, "EUIN must be E followed by 6 digits e.g. E123456").optional(),
    euinVerified: z.boolean().optional(),
    euinValidTo: z.string().optional(),
    arnCode: z.string().optional(),
    arnVerified: z.boolean().optional(),
    sebiRegNo: z.string().optional(),
    highestEducation: z.enum(["high_school", "bachelors", "masters", "professional"]),
    hasFinancialDegree: z.boolean().optional(),
    yearsOfExperience: z.number().min(0).max(50),
    certifications: z.array(CandidateCertificationSchema).optional(),
    branchId: z.string().optional(),
  }),
});

const OnboardTeamMemberSchema = z.object({
  targetDesignationId: z.string().min(2),
  candidate: z.object({
    candidateId: z.string().optional(),
    name: z.string().min(2),
    email: z.string().email(),
    mobile: z.string().regex(/^\d{10}$/, "10-digit mobile number required"),
    panNumber: z.string().regex(/^[A-Z]{5}[0-9]{4}[A-Z]$/, "Invalid PAN format"),
    panVerified: z.boolean().optional(),
    kycStatus: z.enum(["PENDING", "VERIFIED", "REJECTED"]).optional(),
    euinNumber: z.string().regex(/^E\d{6}$/, "EUIN must be E followed by 6 digits e.g. E123456").optional(),
    euinVerified: z.boolean().optional(),
    euinValidTo: z.string().optional(),
    arnCode: z.string().optional(),
    arnVerified: z.boolean().optional(),
    sebiRegNo: z.string().optional(),
    highestEducation: z.enum(["high_school", "bachelors", "masters", "professional"]),
    hasFinancialDegree: z.boolean().optional(),
    yearsOfExperience: z.number().min(0).max(50),
    certifications: z.array(CandidateCertificationSchema).optional(),
    branchId: z.string().optional(),
  }),
});

const UpdateDesignationSchema = z.object({
  targetDesignationId: z.string().min(2),
  candidateProfile: z.object({
    name: z.string().min(2),
    email: z.string().email(),
    mobile: z.string().regex(/^\d{10}$/),
    panNumber: z.string().regex(/^[A-Z]{5}[0-9]{4}[A-Z]$/),
    panVerified: z.boolean().optional(),
    kycStatus: z.enum(["PENDING", "VERIFIED", "REJECTED"]).optional(),
    euinNumber: z.string().optional(),
    euinVerified: z.boolean().optional(),
    arnCode: z.string().optional(),
    highestEducation: z.enum(["high_school", "bachelors", "masters", "professional"]),
    yearsOfExperience: z.number().min(0),
    certifications: z.array(CandidateCertificationSchema).optional(),
    branchId: z.string().optional(),
  }),
});

// ── Response Helpers ────────────────────────────────────────────────────────

function sendOk(res: Response, data: unknown, startMs: number, meta: Record<string, unknown> = {}) {
  res.json({
    success: true,
    data,
    meta: {
      timestamp: new Date().toISOString(),
      version: "fintekpro-team-v1",
      engine_version: ENGINE_VERSION,
      latency_ms: Date.now() - startMs,
      ...meta,
    },
  });
}

function sendErr(
  res: Response,
  status: number,
  errorCode: string,
  message: string,
  startMs: number,
  retryable = false,
  extra: Record<string, unknown> = {}
) {
  res.status(status).json({
    success: false,
    error: {
      error_code: errorCode,
      message,
      retryable,
      ...extra,
    },
    meta: {
      timestamp: new Date().toISOString(),
      version: "fintekpro-team-v1",
      latency_ms: Date.now() - startMs,
    },
  });
}

// ── Route Registration ───────────────────────────────────────────────────────

export function registerTeamDesignationRoutes(app: Express): void {
  const requireUser = requireAuth;
  const requirePartnerOrAdmin = requirePartnerPortal;

  /**
   * GET /api/team/designations
   * Returns all standard FintekPro designations with regulatory criteria & IRIS mappings.
   */
  app.get("/api/team/designations", requireUser, (req: Request, res: Response) => {
    const t = Date.now();
    const uid = (req as any).user?.id ?? "system";
    const designations = teamDesignationService.getAllDesignations();

    logger.info(
      JSON.stringify({
        event: "TEAM_DESIGNATIONS_LISTED",
        user_id: uid,
        count: designations.length,
        status: "success",
      })
    );

    sendOk(res, designations, t, { total: designations.length });
  });

  /**
   * GET /api/team/designations/:designationId
   * Returns detailed rules and statutory basis for a specific designation.
   */
  app.get("/api/team/designations/:designationId", requireUser, (req: Request, res: Response) => {
    const t = Date.now();
    const designation = teamDesignationService.getDesignation(req.params.designationId);
    if (!designation) {
      return sendErr(res, 404, "DESIGNATION_NOT_FOUND", `Designation '${req.params.designationId}' not found`, t);
    }
    sendOk(res, designation, t);
  });

  /**
   * POST /api/team/eligibility/evaluate
   * Evaluates candidate eligibility against a proposed designation.
   * Exposes intermediate scoring, gate checks, and recommended alternatives.
   */
  app.post("/api/team/eligibility/evaluate", requireUser, async (req: Request, res: Response) => {
    const t = Date.now();
    const uid = (req as any).user?.id ?? "system";
    const parsed = EvaluateEligibilitySchema.safeParse(req.body);

    if (!parsed.success) {
      return sendErr(
        res,
        400,
        "INVALID_CANDIDATE_INPUT",
        parsed.error.issues.map((i) => i.message).join("; "),
        t,
        false
      );
    }

    try {
      const { targetDesignationId, candidate } = parsed.data;
      const report = teamDesignationService.evaluateCandidateEligibility(
        candidate as CandidateProfile,
        targetDesignationId
      );

      sendOk(res, report, t, {
        targetDesignationId,
        isEligible: report.isEligible,
        overallScore: report.overallScore,
      });
    } catch (err: any) {
      logger.error(
        JSON.stringify({
          event: "ELIGIBILITY_EVALUATION_ERROR",
          user_id: uid,
          error: err.message,
          status: "error",
        })
      );
      sendErr(res, 500, "EVALUATION_FAILED", err.message, t, true);
    }
  });

  /**
   * GET /api/team/members
   * List team members with designations, eligibility score, EUIN status, and IRIS sync status.
   * Supports pagination: page, limit.
   */
  app.get("/api/team/members", requirePartnerOrAdmin, async (req: Request, res: Response) => {
    const t = Date.now();
    const uid = (req as any).user?.id ?? "system";
    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 20));

    try {
      const allMembers = await teamDesignationService.getTeamMembers(uid);
      const total = allMembers.length;
      const offset = (page - 1) * limit;
      const paginated = allMembers.slice(offset, offset + limit);

      sendOk(res, paginated, t, {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      });
    } catch (err: any) {
      logger.error(
        JSON.stringify({
          event: "TEAM_MEMBERS_FETCH_ERROR",
          user_id: uid,
          error: err.message,
          status: "error",
        })
      );
      sendErr(res, 500, "FETCH_TEAM_MEMBERS_FAILED", err.message, t, true);
    }
  });

  /**
   * POST /api/team/members
   * Onboard/create a team member with mandatory candidate eligibility validation.
   * Rejects with 422 if statutory eligibility requirements are not met.
   */
  app.post("/api/team/members", requirePartnerOrAdmin, async (req: Request, res: Response) => {
    const t = Date.now();
    const uid = (req as any).user?.id ?? "system";
    const parsed = OnboardTeamMemberSchema.safeParse(req.body);

    if (!parsed.success) {
      return sendErr(
        res,
        400,
        "INVALID_ONBOARDING_INPUT",
        parsed.error.issues.map((i) => i.message).join("; "),
        t,
        false
      );
    }

    try {
      const { targetDesignationId, candidate } = parsed.data;
      const result = await teamDesignationService.onboardTeamMemberWithEligibilityCheck(
        uid,
        candidate as CandidateProfile,
        targetDesignationId
      );

      if (!result.success) {
        return sendErr(
          res,
          422,
          "CANDIDATE_INELIGIBLE",
          result.error || "Candidate does not meet statutory eligibility for this designation",
          t,
          false,
          {
            eligibilityReport: result.eligibilityReport,
          }
        );
      }

      logger.info(
        JSON.stringify({
          event: "TEAM_MEMBER_ONBOARDED_WITH_ELIGIBILITY",
          user_id: uid,
          agent_user_id: result.member?.agentUserId,
          designation: targetDesignationId,
          score: result.eligibilityReport.overallScore,
          status: "success",
        })
      );

      sendOk(res, result, t, { status: "created" });
    } catch (err: any) {
      logger.error(
        JSON.stringify({
          event: "ONBOARDING_ERROR",
          user_id: uid,
          error: err.message,
          status: "error",
        })
      );
      sendErr(res, 500, "ONBOARDING_FAILED", err.message, t, true);
    }
  });

  /**
   * PUT /api/team/members/:agentUserId/designation
   * Promote or update a team member's designation with candidate eligibility check.
   */
  app.put("/api/team/members/:agentUserId/designation", requirePartnerOrAdmin, async (req: Request, res: Response) => {
    const t = Date.now();
    const uid = (req as any).user?.id ?? "system";
    const { agentUserId } = req.params;
    const parsed = UpdateDesignationSchema.safeParse(req.body);

    if (!parsed.success) {
      return sendErr(
        res,
        400,
        "INVALID_UPDATE_INPUT",
        parsed.error.issues.map((i) => i.message).join("; "),
        t,
        false
      );
    }

    try {
      const { targetDesignationId, candidateProfile } = parsed.data;
      const result = await teamDesignationService.onboardTeamMemberWithEligibilityCheck(
        uid,
        { ...candidateProfile, candidateId: agentUserId } as CandidateProfile,
        targetDesignationId
      );

      if (!result.success) {
        return sendErr(
          res,
          422,
          "DESIGNATION_PROMOTION_INELIGIBLE",
          result.error || "Candidate does not meet statutory requirements for promotion",
          t,
          false,
          { eligibilityReport: result.eligibilityReport }
        );
      }

      sendOk(res, result, t);
    } catch (err: any) {
      sendErr(res, 500, "UPDATE_DESIGNATION_FAILED", err.message, t, true);
    }
  });

  /**
   * POST /api/team/members/:agentUserId/sync-iris
   * Synchronize an eligible team member to IRIS KFintech hierarchy.
   */
  app.post("/api/team/members/:agentUserId/sync-iris", requirePartnerOrAdmin, async (req: Request, res: Response) => {
    const t = Date.now();
    const uid = (req as any).user?.id ?? "system";
    const { agentUserId } = req.params;
    const candidateDetails = req.body?.candidateDetails as CandidateProfile;

    if (!candidateDetails) {
      return sendErr(res, 400, "MISSING_CANDIDATE_DETAILS", "candidateDetails object is required for IRIS sync", t);
    }

    try {
      const syncResult = await teamDesignationService.syncTeamMemberToIris(
        uid,
        agentUserId,
        candidateDetails
      );

      if (!syncResult.success) {
        return sendErr(
          res,
          502,
          "IRIS_SYNC_FAILED",
          syncResult.error || "Failed to sync team member to IRIS",
          t,
          true,
          { irisEndpoint: syncResult.irisEndpoint, classification: syncResult.irisClassification }
        );
      }

      sendOk(res, syncResult, t, { synced: true });
    } catch (err: any) {
      sendErr(res, 500, "SYNC_IRIS_ERROR", err.message, t, true);
    }
  });

  /**
   * GET /api/team/iris-alignment
   * Returns a comprehensive alignment matrix between IRIS team endpoints and FintekPro designations.
   */
  app.get("/api/team/iris-alignment", requireUser, (req: Request, res: Response) => {
    const t = Date.now();
    const matrix = {
      description: "FintekPro Team & Designation Management Alignment with IRIS KFintech RTA Hierarchy",
      engine_version: ENGINE_VERSION,
      irisEndpoints: [
        {
          entity: "Relationship Managers (RMs)",
          irisPath: "/api/iris/staff/rms",
          methods: ["GET", "POST", "PUT"],
          subPaths: [
            "/api/iris/staff/rms/:rmId/clients",
            "/api/iris/staff/rms/:rmId/aum",
            "/api/iris/staff/rms/reassign",
          ],
          alignedDesignations: ["relationship_manager", "senior_rm"],
          statutoryPrerequisites: "Mandatory valid EUIN, NISM Series V-A certification, Active PAN & KYC.",
          transactionCapability: true,
        },
        {
          entity: "Sub-Brokers / Agents",
          irisPath: "/api/iris/staff/sub-brokers",
          methods: ["GET", "POST", "PUT", "DELETE"],
          subPaths: [
            "/api/iris/staff/sub-brokers/:euinCode/clients",
            "/api/iris/staff/sub-brokers/:euinCode/aum",
            "/api/iris/staff/sub-brokers/:euinCode/orders",
          ],
          alignedDesignations: ["sub_broker"],
          statutoryPrerequisites: "Mandatory valid EUIN, AMFI Reg No (ARN), NISM Series V-A, SEBI registration.",
          transactionCapability: true,
        },
        {
          entity: "Branch Network",
          irisPath: "/api/iris/staff/branches",
          methods: ["GET", "POST", "PUT"],
          subPaths: [
            "/api/iris/staff/branches/:branchId/employees",
            "/api/iris/staff/branches/:branchId/aum",
          ],
          alignedDesignations: ["branch_manager"],
          statutoryPrerequisites: "Min 5 years experience, valid EUIN, NISM Series V-A.",
          transactionCapability: true,
        },
        {
          entity: "Employees / RIA Staff",
          irisPath: "/api/iris/staff/employees",
          methods: ["GET", "POST", "PUT", "DELETE"],
          subPaths: ["/api/iris/staff/employees/:euinCode"],
          alignedDesignations: ["investment_advisor", "compliance_officer", "principal_officer"],
          statutoryPrerequisites: "NISM Series X-A/X-B for Advisors; NISM Series III-A for Compliance.",
          transactionCapability: true,
        },
        {
          entity: "EUIN Registry",
          irisPath: "/api/iris/staff/euins",
          methods: ["GET", "POST", "PUT", "DELETE"],
          subPaths: ["/api/iris/staff/euins/:euinCode"],
          alignedDesignations: ["relationship_manager", "senior_rm", "sub_broker", "branch_manager", "investment_advisor", "principal_officer"],
          statutoryPrerequisites: "AMFI NISM Series V-A unexpired validity.",
          transactionCapability: true,
        },
        {
          entity: "Internal / Lead-Generation Only",
          irisPath: "N/A (CRM Only - No RTA Sync)",
          methods: [],
          subPaths: [],
          alignedDesignations: ["lead_associate", "field_executive"],
          statutoryPrerequisites: "PAN verified. No EUIN required.",
          transactionCapability: false,
          notes: "STRICTLY BLOCKED from mutual fund order execution and advisory per SEBI guidelines.",
        },
      ],
    };

    sendOk(res, matrix, t);
  });
}

