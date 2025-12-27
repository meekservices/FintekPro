import { Router, Request, Response, NextFunction } from "express";
import { db } from "../db";
import { 
  users, 
  appointmentAuditLogs, 
  pendingAppointments,
  UserAppointmentStatus
} from "@shared/schema";
import { eq, and, desc, or, sql, inArray } from "drizzle-orm";

const router = Router();

// Appointment Status Constants
const APPOINTMENT_STATUSES = {
  DRAFT: 'draft',
  PENDING_ADMIN_APPROVAL: 'pending_admin_approval',
  ACTIVE: 'active',
  REJECTED: 'rejected',
  SUSPENDED: 'suspended'
} as const;

// Roles that require Admin approval
const ROLES_REQUIRING_APPROVAL = [
  'partner', 'master_agent', 'agent', 'sub_agent', 'support_staff', 'ca', 'associate'
];

// Roles that can initiate appointments
const APPOINTMENT_PERMISSIONS: Record<string, string[]> = {
  'admin': ['partner', 'master_agent', 'agent', 'sub_agent', 'support_staff', 'ca', 'associate'],
  'superadmin': ['partner', 'master_agent', 'agent', 'sub_agent', 'support_staff', 'ca', 'associate', 'admin'],
  'partner': ['agent', 'sub_agent', 'support_staff', 'ca'],
  'master_agent': ['agent', 'sub_agent', 'support_staff'],
  'agent': ['sub_agent', 'support_staff']
};

// Helper to log appointment actions
async function logAppointmentAction(data: {
  userId: string;
  role: string;
  previousStatus?: string;
  newStatus: string;
  createdByUserId?: string;
  createdByRole?: string;
  createdByName?: string;
  adminUserId?: string;
  adminName?: string;
  adminAction?: string;
  adminReason?: string;
  costCentreId?: string;
  costCentreName?: string;
  ipAddress?: string;
  userAgent?: string;
  metadata?: any;
}) {
  try {
    await db.insert(appointmentAuditLogs).values({
      userId: data.userId,
      role: data.role,
      previousStatus: data.previousStatus,
      newStatus: data.newStatus,
      createdByUserId: data.createdByUserId,
      createdByRole: data.createdByRole,
      createdByName: data.createdByName,
      adminUserId: data.adminUserId,
      adminName: data.adminName,
      adminAction: data.adminAction,
      adminReason: data.adminReason,
      costCentreId: data.costCentreId,
      costCentreName: data.costCentreName,
      ipAddress: data.ipAddress,
      userAgent: data.userAgent,
      metadata: data.metadata || {},
    });
  } catch (error) {
    console.error('[Appointment Audit] Failed to log action:', error);
  }
}

// ==================== ADMIN ENDPOINTS ====================

// GET /api/admin/appointments/pending - Get pending appointments queue
router.get("/api/admin/appointments/pending", async (req: Request, res: Response) => {
  try {
    const { role, initiator, costCentre, page = 1, limit = 20 } = req.query;
    const offset = (Number(page) - 1) * Number(limit);

    // Get pending appointments with user details
    const pendingUsers = await db
      .select({
        id: users.id,
        userId: users.userId,
        email: users.email,
        mobile: users.mobile,
        firstName: users.firstName,
        lastName: users.lastName,
        roles: users.roles,
        appointmentStatus: users.appointmentStatus,
        appointmentInitiatedBy: users.appointmentInitiatedBy,
        appointmentInitiatorRole: users.appointmentInitiatorRole,
        appointmentCostCentreId: users.appointmentCostCentreId,
        createdAt: users.createdAt,
        panNumber: users.panNumber,
        city: users.city,
        state: users.state,
      })
      .from(users)
      .where(eq(users.appointmentStatus, APPOINTMENT_STATUSES.PENDING_ADMIN_APPROVAL))
      .orderBy(desc(users.createdAt))
      .limit(Number(limit))
      .offset(offset);

    // Get total count
    const countResult = await db
      .select({ count: sql<number>`count(*)` })
      .from(users)
      .where(eq(users.appointmentStatus, APPOINTMENT_STATUSES.PENDING_ADMIN_APPROVAL));

    // Enrich with initiator names
    const enrichedAppointments = await Promise.all(
      pendingUsers.map(async (user) => {
        let initiatorName = "System";
        if (user.appointmentInitiatedBy) {
          const initiator = await db
            .select({ firstName: users.firstName, lastName: users.lastName })
            .from(users)
            .where(eq(users.id, user.appointmentInitiatedBy))
            .limit(1);
          if (initiator.length > 0) {
            initiatorName = `${initiator[0].firstName || ''} ${initiator[0].lastName || ''}`.trim() || "Unknown";
          }
        }
        return {
          ...user,
          initiatorName,
          requestedRole: user.roles?.[0] || 'unknown',
        };
      })
    );

    res.json({
      appointments: enrichedAppointments,
      total: Number(countResult[0]?.count || 0),
      page: Number(page),
      limit: Number(limit),
      totalPages: Math.ceil(Number(countResult[0]?.count || 0) / Number(limit)),
    });
  } catch (error: any) {
    console.error('[Appointments] Error fetching pending:', error);
    res.status(500).json({ error: error.message });
  }
});

// POST /api/admin/appointments/:userId/approve - Approve an appointment
router.post("/api/admin/appointments/:userId/approve", async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;
    const adminUser = (req as any).user;
    const adminId = adminUser?.id || 'admin';
    const adminName = adminUser ? `${adminUser.firstName || ''} ${adminUser.lastName || ''}`.trim() : 'System Admin';

    // Get user details
    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    if (user.appointmentStatus !== APPOINTMENT_STATUSES.PENDING_ADMIN_APPROVAL) {
      return res.status(400).json({ 
        error: "Invalid status", 
        message: `User appointment status is ${user.appointmentStatus}, not pending approval` 
      });
    }

    // Update user status to ACTIVE
    await db
      .update(users)
      .set({
        appointmentStatus: APPOINTMENT_STATUSES.ACTIVE,
        isActive: true,
        appointmentApprovedBy: adminId,
        appointmentApprovedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(users.id, userId));

    // Log the approval
    await logAppointmentAction({
      userId,
      role: user.roles?.[0] || 'unknown',
      previousStatus: APPOINTMENT_STATUSES.PENDING_ADMIN_APPROVAL,
      newStatus: APPOINTMENT_STATUSES.ACTIVE,
      adminUserId: adminId,
      adminName,
      adminAction: 'approved',
      costCentreId: user.appointmentCostCentreId || undefined,
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
      metadata: { approvedAt: new Date().toISOString() },
    });

    res.json({
      success: true,
      message: "Appointment approved successfully",
      userId,
      newStatus: APPOINTMENT_STATUSES.ACTIVE,
    });
  } catch (error: any) {
    console.error('[Appointments] Error approving:', error);
    res.status(500).json({ error: error.message });
  }
});

// POST /api/admin/appointments/:userId/reject - Reject an appointment
router.post("/api/admin/appointments/:userId/reject", async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;
    const { reason } = req.body;
    const adminUser = (req as any).user;
    const adminId = adminUser?.id || 'admin';
    const adminName = adminUser ? `${adminUser.firstName || ''} ${adminUser.lastName || ''}`.trim() : 'System Admin';

    if (!reason || reason.trim().length === 0) {
      return res.status(400).json({ error: "Rejection reason is mandatory" });
    }

    // Get user details
    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    if (user.appointmentStatus !== APPOINTMENT_STATUSES.PENDING_ADMIN_APPROVAL) {
      return res.status(400).json({ 
        error: "Invalid status", 
        message: `User appointment status is ${user.appointmentStatus}, not pending approval` 
      });
    }

    // Update user status to REJECTED
    await db
      .update(users)
      .set({
        appointmentStatus: APPOINTMENT_STATUSES.REJECTED,
        isActive: false,
        appointmentRejectionReason: reason,
        updatedAt: new Date(),
      })
      .where(eq(users.id, userId));

    // Log the rejection
    await logAppointmentAction({
      userId,
      role: user.roles?.[0] || 'unknown',
      previousStatus: APPOINTMENT_STATUSES.PENDING_ADMIN_APPROVAL,
      newStatus: APPOINTMENT_STATUSES.REJECTED,
      adminUserId: adminId,
      adminName,
      adminAction: 'rejected',
      adminReason: reason,
      costCentreId: user.appointmentCostCentreId || undefined,
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
      metadata: { rejectedAt: new Date().toISOString(), reason },
    });

    res.json({
      success: true,
      message: "Appointment rejected",
      userId,
      newStatus: APPOINTMENT_STATUSES.REJECTED,
    });
  } catch (error: any) {
    console.error('[Appointments] Error rejecting:', error);
    res.status(500).json({ error: error.message });
  }
});

// POST /api/admin/appointments/:userId/suspend - Suspend an active user
router.post("/api/admin/appointments/:userId/suspend", async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;
    const { reason } = req.body;
    const adminUser = (req as any).user;
    const adminId = adminUser?.id || 'admin';
    const adminName = adminUser ? `${adminUser.firstName || ''} ${adminUser.lastName || ''}`.trim() : 'System Admin';

    if (!reason || reason.trim().length === 0) {
      return res.status(400).json({ error: "Suspension reason is mandatory" });
    }

    // Get user details
    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    // Update user status to SUSPENDED
    await db
      .update(users)
      .set({
        appointmentStatus: APPOINTMENT_STATUSES.SUSPENDED,
        isActive: false,
        appointmentRejectionReason: reason,
        updatedAt: new Date(),
      })
      .where(eq(users.id, userId));

    // Log the suspension
    await logAppointmentAction({
      userId,
      role: user.roles?.[0] || 'unknown',
      previousStatus: user.appointmentStatus || 'unknown',
      newStatus: APPOINTMENT_STATUSES.SUSPENDED,
      adminUserId: adminId,
      adminName,
      adminAction: 'suspended',
      adminReason: reason,
      costCentreId: user.appointmentCostCentreId || undefined,
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
      metadata: { suspendedAt: new Date().toISOString(), reason },
    });

    res.json({
      success: true,
      message: "User suspended",
      userId,
      newStatus: APPOINTMENT_STATUSES.SUSPENDED,
    });
  } catch (error: any) {
    console.error('[Appointments] Error suspending:', error);
    res.status(500).json({ error: error.message });
  }
});

// GET /api/admin/appointments/stats - Get appointment statistics
router.get("/api/admin/appointments/stats", async (req: Request, res: Response) => {
  try {
    const stats = await db
      .select({
        status: users.appointmentStatus,
        count: sql<number>`count(*)`,
      })
      .from(users)
      .where(
        or(
          eq(users.appointmentStatus, APPOINTMENT_STATUSES.PENDING_ADMIN_APPROVAL),
          eq(users.appointmentStatus, APPOINTMENT_STATUSES.ACTIVE),
          eq(users.appointmentStatus, APPOINTMENT_STATUSES.REJECTED),
          eq(users.appointmentStatus, APPOINTMENT_STATUSES.SUSPENDED)
        )
      )
      .groupBy(users.appointmentStatus);

    const statsMap = stats.reduce((acc, s) => {
      acc[s.status || 'unknown'] = Number(s.count);
      return acc;
    }, {} as Record<string, number>);

    res.json({
      pending: statsMap[APPOINTMENT_STATUSES.PENDING_ADMIN_APPROVAL] || 0,
      active: statsMap[APPOINTMENT_STATUSES.ACTIVE] || 0,
      rejected: statsMap[APPOINTMENT_STATUSES.REJECTED] || 0,
      suspended: statsMap[APPOINTMENT_STATUSES.SUSPENDED] || 0,
      total: Object.values(statsMap).reduce((a, b) => a + b, 0),
    });
  } catch (error: any) {
    console.error('[Appointments] Error fetching stats:', error);
    res.status(500).json({ error: error.message });
  }
});

// GET /api/admin/appointments/audit-trail - Get audit trail for appointments
router.get("/api/admin/appointments/audit-trail", async (req: Request, res: Response) => {
  try {
    const { userId, role, action, startDate, endDate, page = 1, limit = 50 } = req.query;
    const offset = (Number(page) - 1) * Number(limit);

    const logs = await db
      .select()
      .from(appointmentAuditLogs)
      .orderBy(desc(appointmentAuditLogs.timestamp))
      .limit(Number(limit))
      .offset(offset);

    res.json({
      logs,
      page: Number(page),
      limit: Number(limit),
    });
  } catch (error: any) {
    console.error('[Appointments] Error fetching audit trail:', error);
    res.status(500).json({ error: error.message });
  }
});

// ==================== INITIATOR ENDPOINTS ====================

// GET /api/appointments/my-team - Get appointments initiated by current user
router.get("/api/appointments/my-team", async (req: Request, res: Response) => {
  try {
    const currentUser = (req as any).user;
    const initiatorId = currentUser?.id || req.query.initiatorId;

    if (!initiatorId) {
      return res.status(400).json({ error: "Initiator ID required" });
    }

    const teamMembers = await db
      .select({
        id: users.id,
        userId: users.userId,
        email: users.email,
        firstName: users.firstName,
        lastName: users.lastName,
        roles: users.roles,
        appointmentStatus: users.appointmentStatus,
        appointmentRejectionReason: users.appointmentRejectionReason,
        createdAt: users.createdAt,
      })
      .from(users)
      .where(eq(users.appointmentInitiatedBy, initiatorId as string))
      .orderBy(desc(users.createdAt));

    res.json({
      teamMembers,
      statusCounts: {
        pending: teamMembers.filter(m => m.appointmentStatus === APPOINTMENT_STATUSES.PENDING_ADMIN_APPROVAL).length,
        active: teamMembers.filter(m => m.appointmentStatus === APPOINTMENT_STATUSES.ACTIVE).length,
        rejected: teamMembers.filter(m => m.appointmentStatus === APPOINTMENT_STATUSES.REJECTED).length,
        suspended: teamMembers.filter(m => m.appointmentStatus === APPOINTMENT_STATUSES.SUSPENDED).length,
      },
    });
  } catch (error: any) {
    console.error('[Appointments] Error fetching team:', error);
    res.status(500).json({ error: error.message });
  }
});

// POST /api/appointments/create - Create new appointment (non-admin)
router.post("/api/appointments/create", async (req: Request, res: Response) => {
  try {
    const currentUser = (req as any).user;
    const initiatorId = currentUser?.id;
    const initiatorRole = currentUser?.roles?.[0] || 'user';
    const initiatorName = currentUser ? `${currentUser.firstName || ''} ${currentUser.lastName || ''}`.trim() : 'Unknown';

    const { userId, role, costCentreId } = req.body;

    // Validate role assignment permission
    const allowedRoles = APPOINTMENT_PERMISSIONS[initiatorRole] || [];
    
    // Admin can approve directly, others create pending appointments
    const isAdmin = ['admin', 'superadmin'].includes(initiatorRole);
    const newStatus = isAdmin ? APPOINTMENT_STATUSES.ACTIVE : APPOINTMENT_STATUSES.PENDING_ADMIN_APPROVAL;

    // Update the user
    await db
      .update(users)
      .set({
        roles: [role],
        appointmentStatus: newStatus,
        appointmentInitiatedBy: initiatorId,
        appointmentInitiatorRole: initiatorRole,
        appointmentCostCentreId: costCentreId,
        isActive: isAdmin,
        updatedAt: new Date(),
      })
      .where(eq(users.id, userId));

    // Log the creation
    await logAppointmentAction({
      userId,
      role,
      previousStatus: undefined,
      newStatus,
      createdByUserId: initiatorId,
      createdByRole: initiatorRole,
      createdByName: initiatorName,
      adminUserId: isAdmin ? initiatorId : undefined,
      adminAction: isAdmin ? 'approved' : undefined,
      costCentreId,
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
      metadata: { createdAt: new Date().toISOString() },
    });

    res.json({
      success: true,
      message: isAdmin 
        ? "Appointment created and activated" 
        : "Appointment created, pending Admin approval",
      userId,
      status: newStatus,
    });
  } catch (error: any) {
    console.error('[Appointments] Error creating:', error);
    res.status(500).json({ error: error.message });
  }
});

export function registerAppointmentManagementRoutes(app: any) {
  app.use(router);
  console.log("✅ Appointment Management routes registered");
}

export default router;
