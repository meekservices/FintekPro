import { Router, Request, Response, NextFunction } from "express";
import { db } from "../db";
import { onboardingInvitations, onboardingInvitationEvents, users, agents, partners } from "@shared/schema";
import { eq, and, desc, ilike, or, sql, SQL } from "drizzle-orm";
import { nanoid } from "nanoid";
import { partnerService } from "../partner-service";

const router = Router();

function buildConditions(...conditions: (SQL | undefined)[]): SQL | undefined {
  const validConditions = conditions.filter((c): c is SQL => c !== undefined);
  if (validConditions.length === 0) return undefined;
  if (validConditions.length === 1) return validConditions[0];
  return and(...validConditions);
}

async function getPartnerFromAuth(req: Request): Promise<any | null> {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Basic ')) return null;
  
  try {
    const [email, password] = Buffer.from(authHeader.split(' ')[1], 'base64').toString().split(':');
    const partner = await partnerService.authenticatePartner(email, password);
    return partner;
  } catch {
    return null;
  }
}

function generateReferralCode(): string {
  return `FTP-${nanoid(8).toUpperCase()}`;
}

async function logInvitationEvent(
  invitationId: string,
  eventType: string,
  actorId: string | null,
  actorType: string,
  eventData?: any,
  ipAddress?: string,
  userAgent?: string
) {
  await db.insert(onboardingInvitationEvents).values({
    invitationId,
    eventType,
    eventData: eventData || {},
    actorId,
    actorType,
    ipAddress,
    userAgent,
  });
}

// ============ AGENT INVITATION ROUTES ============

// Create invitation (agent)
router.post("/api/agent/onboarding-invitations", async (req: Request, res: Response) => {
  try {
    const user = req.user as any;
    if (!user) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const { clientEmail, clientMobile, clientName, suggestedEntityType, suggestedMode, notes } = req.body;

    if (!clientEmail && !clientMobile) {
      return res.status(400).json({ error: "Either email or mobile is required" });
    }

    const referralCode = generateReferralCode();
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 30);

    const [invitation] = await db.insert(onboardingInvitations).values({
      referralCode,
      inviterId: user.id,
      inviterType: "agent",
      inviterName: user.firstName ? `${user.firstName} ${user.lastName || ""}`.trim() : user.email,
      clientEmail,
      clientMobile,
      clientName,
      suggestedEntityType,
      suggestedMode,
      notes,
      status: "pending",
      expiresAt,
    }).returning();

    await logInvitationEvent(
      invitation.id,
      "created",
      user.id,
      "agent",
      { clientEmail, clientMobile, clientName },
      req.ip,
      req.headers["user-agent"]
    );

    res.json({
      success: true,
      invitation,
      referralLink: `${process.env.REPL_SLUG ? `https://${process.env.REPL_SLUG}.${process.env.REPL_OWNER}.repl.co` : ""}/onboarding?ref=${referralCode}`,
    });
  } catch (error: any) {
    console.error("Create invitation error:", error);
    res.status(500).json({ error: error.message || "Failed to create invitation" });
  }
});

// List invitations (agent)
router.get("/api/agent/onboarding-invitations", async (req: Request, res: Response) => {
  try {
    const user = req.user as any;
    if (!user) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const { status, search } = req.query;

    const whereCondition = buildConditions(
      eq(onboardingInvitations.inviterId, user.id),
      eq(onboardingInvitations.inviterType, "agent"),
      status ? eq(onboardingInvitations.status, status as string) : undefined,
      search ? or(
        ilike(onboardingInvitations.clientName, `%${search}%`),
        ilike(onboardingInvitations.clientEmail, `%${search}%`),
        ilike(onboardingInvitations.clientMobile, `%${search}%`)
      ) : undefined
    );

    const invitations = await db.select()
      .from(onboardingInvitations)
      .where(whereCondition)
      .orderBy(desc(onboardingInvitations.createdAt));

    res.json({
      success: true,
      invitations,
      total: invitations.length,
    });
  } catch (error: any) {
    console.error("List invitations error:", error);
    res.status(500).json({ error: error.message || "Failed to list invitations" });
  }
});

// Resend invitation (agent)
router.post("/api/agent/onboarding-invitations/:id/resend", async (req: Request, res: Response) => {
  try {
    const user = req.user as any;
    if (!user) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const { id } = req.params;

    const [invitation] = await db.select()
      .from(onboardingInvitations)
      .where(and(
        eq(onboardingInvitations.id, id),
        eq(onboardingInvitations.inviterId, user.id),
        eq(onboardingInvitations.inviterType, "agent")
      ));

    if (!invitation) {
      return res.status(404).json({ error: "Invitation not found" });
    }

    const newExpiresAt = new Date();
    newExpiresAt.setDate(newExpiresAt.getDate() + 30);

    await db.update(onboardingInvitations)
      .set({
        status: invitation.status === "expired" ? "pending" : invitation.status,
        expiresAt: newExpiresAt,
        inviteSentAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(onboardingInvitations.id, id));

    await logInvitationEvent(
      id,
      "resent",
      user.id,
      "agent",
      { previousStatus: invitation.status },
      req.ip,
      req.headers["user-agent"]
    );

    res.json({ success: true, message: "Invitation resent" });
  } catch (error: any) {
    console.error("Resend invitation error:", error);
    res.status(500).json({ error: error.message || "Failed to resend invitation" });
  }
});

// Get invitation stats (agent)
router.get("/api/agent/onboarding-invitations/stats", async (req: Request, res: Response) => {
  try {
    const user = req.user as any;
    if (!user) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const stats = await db.select({
      status: onboardingInvitations.status,
      count: sql<number>`count(*)::int`,
    })
      .from(onboardingInvitations)
      .where(and(
        eq(onboardingInvitations.inviterId, user.id),
        eq(onboardingInvitations.inviterType, "agent")
      ))
      .groupBy(onboardingInvitations.status);

    const statsMap: Record<string, number> = {};
    stats.forEach(s => {
      statsMap[s.status] = s.count;
    });

    res.json({
      success: true,
      stats: {
        pending: statsMap.pending || 0,
        sent: statsMap.sent || 0,
        opened: statsMap.opened || 0,
        started: statsMap.started || 0,
        in_progress: statsMap.in_progress || 0,
        completed: statsMap.completed || 0,
        expired: statsMap.expired || 0,
        total: Object.values(statsMap).reduce((a, b) => a + b, 0),
      },
    });
  } catch (error: any) {
    console.error("Get stats error:", error);
    res.status(500).json({ error: error.message || "Failed to get stats" });
  }
});

// ============ PARTNER INVITATION ROUTES ============

// Create invitation (partner)
router.post("/api/partner/onboarding-invitations", async (req: Request, res: Response) => {
  try {
    const partner = await getPartnerFromAuth(req);
    if (!partner) {
      return res.status(401).json({ error: "Partner authentication required" });
    }

    const { clientEmail, clientMobile, clientName, suggestedEntityType, suggestedMode, notes } = req.body;

    if (!clientEmail && !clientMobile) {
      return res.status(400).json({ error: "Either email or mobile is required" });
    }

    const referralCode = generateReferralCode();
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 30);

    const [invitation] = await db.insert(onboardingInvitations).values({
      referralCode,
      inviterId: partner.id,
      inviterType: "partner",
      inviterName: partner.companyName || partner.email,
      clientEmail,
      clientMobile,
      clientName,
      suggestedEntityType,
      suggestedMode,
      notes,
      status: "pending",
      expiresAt,
    }).returning();

    await logInvitationEvent(
      invitation.id,
      "created",
      partner.id,
      "partner",
      { clientEmail, clientMobile, clientName },
      req.ip,
      req.headers["user-agent"]
    );

    res.json({
      success: true,
      invitation,
      referralLink: `${process.env.REPL_SLUG ? `https://${process.env.REPL_SLUG}.${process.env.REPL_OWNER}.repl.co` : ""}/onboarding?ref=${referralCode}`,
    });
  } catch (error: any) {
    console.error("Create partner invitation error:", error);
    res.status(500).json({ error: error.message || "Failed to create invitation" });
  }
});

// List invitations (partner)
router.get("/api/partner/onboarding-invitations", async (req: Request, res: Response) => {
  try {
    const partner = await getPartnerFromAuth(req);
    if (!partner) {
      return res.status(401).json({ error: "Partner authentication required" });
    }

    const { status, search } = req.query;

    const whereCondition = buildConditions(
      eq(onboardingInvitations.inviterId, partner.id),
      eq(onboardingInvitations.inviterType, "partner"),
      status ? eq(onboardingInvitations.status, status as string) : undefined,
      search ? or(
        ilike(onboardingInvitations.clientName, `%${search}%`),
        ilike(onboardingInvitations.clientEmail, `%${search}%`)
      ) : undefined
    );

    const invitations = await db.select()
      .from(onboardingInvitations)
      .where(whereCondition)
      .orderBy(desc(onboardingInvitations.createdAt));

    res.json({
      success: true,
      invitations,
      total: invitations.length,
    });
  } catch (error: any) {
    console.error("List partner invitations error:", error);
    res.status(500).json({ error: error.message || "Failed to list invitations" });
  }
});

// Resend invitation (partner)
router.post("/api/partner/onboarding-invitations/:id/resend", async (req: Request, res: Response) => {
  try {
    const partner = await getPartnerFromAuth(req);
    if (!partner) {
      return res.status(401).json({ error: "Partner authentication required" });
    }

    const { id } = req.params;

    const [invitation] = await db.select()
      .from(onboardingInvitations)
      .where(and(
        eq(onboardingInvitations.id, id),
        eq(onboardingInvitations.inviterId, partner.id),
        eq(onboardingInvitations.inviterType, "partner")
      ));

    if (!invitation) {
      return res.status(404).json({ error: "Invitation not found" });
    }

    const newExpiresAt = new Date();
    newExpiresAt.setDate(newExpiresAt.getDate() + 30);

    await db.update(onboardingInvitations)
      .set({
        status: invitation.status === "expired" ? "pending" : invitation.status,
        expiresAt: newExpiresAt,
        inviteSentAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(onboardingInvitations.id, id));

    await logInvitationEvent(
      id,
      "resent",
      partner.id,
      "partner",
      { previousStatus: invitation.status },
      req.ip,
      req.headers["user-agent"]
    );

    res.json({ success: true, message: "Invitation resent" });
  } catch (error: any) {
    console.error("Resend partner invitation error:", error);
    res.status(500).json({ error: error.message || "Failed to resend invitation" });
  }
});

// Get invitation stats (partner)
router.get("/api/partner/onboarding-invitations/stats", async (req: Request, res: Response) => {
  try {
    const partner = await getPartnerFromAuth(req);
    if (!partner) {
      return res.status(401).json({ error: "Partner authentication required" });
    }

    const stats = await db.select({
      status: onboardingInvitations.status,
      count: sql<number>`count(*)::int`,
    })
      .from(onboardingInvitations)
      .where(and(
        eq(onboardingInvitations.inviterId, partner.id),
        eq(onboardingInvitations.inviterType, "partner")
      ))
      .groupBy(onboardingInvitations.status);

    const statsMap: Record<string, number> = {};
    stats.forEach(s => {
      statsMap[s.status] = s.count;
    });

    res.json({
      success: true,
      stats: {
        pending: statsMap.pending || 0,
        sent: statsMap.sent || 0,
        opened: statsMap.opened || 0,
        started: statsMap.started || 0,
        in_progress: statsMap.in_progress || 0,
        completed: statsMap.completed || 0,
        expired: statsMap.expired || 0,
        total: Object.values(statsMap).reduce((a, b) => a + b, 0),
      },
    });
  } catch (error: any) {
    console.error("Get partner stats error:", error);
    res.status(500).json({ error: error.message || "Failed to get stats" });
  }
});

// ============ PUBLIC REFERRAL ROUTES ============

// Validate referral code (public)
router.get("/api/onboarding/referrals/:code", async (req: Request, res: Response) => {
  try {
    const { code } = req.params;

    const [invitation] = await db.select()
      .from(onboardingInvitations)
      .where(eq(onboardingInvitations.referralCode, code));

    if (!invitation) {
      return res.status(404).json({ error: "Invalid referral code", valid: false });
    }

    if (invitation.status === "expired" || (invitation.expiresAt && new Date(invitation.expiresAt) < new Date())) {
      return res.status(400).json({ error: "Referral link has expired", valid: false });
    }

    if (invitation.status === "completed") {
      return res.status(400).json({ error: "This invitation has already been completed", valid: false });
    }

    if (invitation.status === "pending") {
      await db.update(onboardingInvitations)
        .set({
          status: "opened",
          inviteOpenedAt: new Date(),
          lastActivityAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(onboardingInvitations.id, invitation.id));

      await logInvitationEvent(
        invitation.id,
        "opened",
        null,
        "client",
        {},
        req.ip,
        req.headers["user-agent"]
      );
    }

    res.json({
      valid: true,
      inviterName: invitation.inviterName,
      inviterType: invitation.inviterType,
      suggestedEntityType: invitation.suggestedEntityType,
      suggestedMode: invitation.suggestedMode,
      clientName: invitation.clientName,
      clientEmail: invitation.clientEmail,
    });
  } catch (error: any) {
    console.error("Validate referral error:", error);
    res.status(500).json({ error: error.message || "Failed to validate referral" });
  }
});

// Update referral progress (called from onboarding flow)
router.patch("/api/onboarding/referrals/:code/progress", async (req: Request, res: Response) => {
  try {
    const { code } = req.params;
    const { currentStep, completedSteps, progressPercentage, onboardingSessionId, linkedUserId } = req.body;

    const [invitation] = await db.select()
      .from(onboardingInvitations)
      .where(eq(onboardingInvitations.referralCode, code));

    if (!invitation) {
      return res.status(404).json({ error: "Invalid referral code" });
    }

    const updates: any = {
      lastActivityAt: new Date(),
      updatedAt: new Date(),
    };

    if (currentStep) updates.currentStep = currentStep;
    if (completedSteps) updates.completedSteps = completedSteps;
    if (progressPercentage !== undefined) updates.progressPercentage = progressPercentage;
    if (onboardingSessionId) updates.onboardingSessionId = onboardingSessionId;
    if (linkedUserId) updates.linkedUserId = linkedUserId;

    if (invitation.status === "opened") {
      updates.status = "started";
      updates.onboardingStartedAt = new Date();

      await logInvitationEvent(
        invitation.id,
        "started",
        linkedUserId || null,
        "client",
        { currentStep },
        req.ip,
        req.headers["user-agent"]
      );
    } else if (progressPercentage > 0 && invitation.status !== "in_progress" && invitation.status !== "completed") {
      updates.status = "in_progress";
    }

    if (progressPercentage === 100) {
      updates.status = "completed";
      updates.onboardingCompletedAt = new Date();

      await logInvitationEvent(
        invitation.id,
        "completed",
        linkedUserId || null,
        "client",
        { completedSteps },
        req.ip,
        req.headers["user-agent"]
      );
    } else if (currentStep) {
      await logInvitationEvent(
        invitation.id,
        "step_completed",
        linkedUserId || null,
        "client",
        { currentStep, completedSteps, progressPercentage },
        req.ip,
        req.headers["user-agent"]
      );
    }

    await db.update(onboardingInvitations)
      .set(updates)
      .where(eq(onboardingInvitations.id, invitation.id));

    res.json({ success: true });
  } catch (error: any) {
    console.error("Update referral progress error:", error);
    res.status(500).json({ error: error.message || "Failed to update progress" });
  }
});

export default router;
