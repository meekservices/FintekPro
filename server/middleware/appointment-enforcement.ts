import { Request, Response, NextFunction } from "express";
import { db } from "../db";
import { users } from "@shared/schema";
import { eq } from "drizzle-orm";

// Appointment Status Constants
const APPOINTMENT_STATUSES = {
	DRAFT: "draft",
	PENDING_ADMIN_APPROVAL: "pending_admin_approval",
	ACTIVE: "active",
	REJECTED: "rejected",
	SUSPENDED: "suspended",
} as const;

// Routes that are exempt from appointment enforcement (public routes)
const EXEMPT_ROUTES = [
	"/api/auth",
	"/api/login",
	"/api/register",
	"/api/logout",
	"/api/health",
	"/api/market",
	"/api/bonds/yield-curve/public",
	"/api/public",
];

// Routes that require ACTIVE appointment status
const PROTECTED_ROUTE_PATTERNS = [
	"/api/agent/",
	"/api/admin/",
	"/api/partner/",
	"/api/client/",
	"/api/investments/",
	"/api/portfolio/",
	"/api/recommendations/",
	"/api/ai-",
];

/**
 * Middleware to enforce appointment status
 * Only ACTIVE users can access protected routes
 */
export function appointmentEnforcementMiddleware(
	req: Request,
	res: Response,
	next: NextFunction,
) {
	// Check if route is exempt
	const isExempt = EXEMPT_ROUTES.some((route) => req.path.startsWith(route));
	if (isExempt) {
		return next();
	}

	// Check if route requires protection
	const isProtected = PROTECTED_ROUTE_PATTERNS.some((pattern) =>
		req.path.includes(pattern),
	);
	if (!isProtected) {
		return next();
	}

	const user = (req as any).user;

	// If no user session, let auth middleware handle it
	if (!user) {
		return next();
	}

	// Check appointment status
	const appointmentStatus = user.appointmentStatus;

	// Only ACTIVE users can proceed
	if (appointmentStatus !== APPOINTMENT_STATUSES.ACTIVE) {
		// Log the blocked attempt
		console.log(
			`[Appointment Enforcement] Blocked access for user ${user.id}: status=${appointmentStatus}, path=${req.path}`,
		);

		let message: string;
		switch (appointmentStatus) {
			case APPOINTMENT_STATUSES.PENDING_ADMIN_APPROVAL:
				message =
					"Your account is pending administrator approval. Please wait for activation.";
				break;
			case APPOINTMENT_STATUSES.REJECTED:
				message =
					"Your account application has been rejected. Please contact support.";
				break;
			case APPOINTMENT_STATUSES.SUSPENDED:
				message =
					"Your account has been suspended. Please contact administrator.";
				break;
			case APPOINTMENT_STATUSES.DRAFT:
				message =
					"Your account setup is incomplete. Please complete registration.";
				break;
			default:
				message = "Your account is not active. Please contact support.";
		}

		return res.status(403).json({
			error: "Account not active",
			code: "APPOINTMENT_NOT_ACTIVE",
			status: appointmentStatus,
			message,
		});
	}

	next();
}

/**
 * Role-specific access restrictions for CA and Support Staff
 * Ensures they cannot access certain modules per SEBI compliance
 */
export function roleRestrictionMiddleware(
	req: Request,
	res: Response,
	next: NextFunction,
) {
	const user = (req as any).user;

	if (!user || !user.roles) {
		return next();
	}

	const userRoles = user.roles as string[];

	// CA restrictions - cannot access AI or investments
	if (userRoles.includes("ca")) {
		const restrictedForCA = [
			"/api/ai-",
			"/api/recommendations/",
			"/api/investments/",
			"/api/portfolio/",
			"/api/trading/",
		];

		const isRestricted = restrictedForCA.some((pattern) =>
			req.path.includes(pattern),
		);
		if (isRestricted) {
			console.log(`[Role Restriction] CA blocked from: ${req.path}`);
			return res.status(403).json({
				error: "Access restricted",
				code: "ROLE_RESTRICTION",
				message: "This feature is not available for your role.",
			});
		}
	}

	// Support Staff restrictions - cannot see client portfolios
	if (userRoles.includes("support_staff")) {
		const restrictedForSupport = [
			"/api/portfolio/",
			"/api/client/",
			"/api/investments/",
			"/api/holdings/",
		];

		const isRestricted = restrictedForSupport.some((pattern) =>
			req.path.includes(pattern),
		);
		if (isRestricted) {
			console.log(`[Role Restriction] Support Staff blocked from: ${req.path}`);
			return res.status(403).json({
				error: "Access restricted",
				code: "ROLE_RESTRICTION",
				message: "This feature is not available for your role.",
			});
		}
	}

	next();
}

/**
 * Middleware to attach appointment status to session on login
 */
export async function attachAppointmentStatus(
	req: Request,
	res: Response,
	next: NextFunction,
) {
	const user = (req as any).user;

	if (!user || !user.id) {
		return next();
	}

	try {
		// Fetch current appointment status from database
		const [dbUser] = await db
			.select({
				appointmentStatus: users.appointmentStatus,
				appointmentRejectionReason: users.appointmentRejectionReason,
			})
			.from(users)
			.where(eq(users.id, user.id))
			.limit(1);

		if (dbUser) {
			(req as any).user.appointmentStatus = dbUser.appointmentStatus;
			(req as any).user.appointmentRejectionReason =
				dbUser.appointmentRejectionReason;
		}
	} catch (error) {
		console.error("[Appointment Status] Error fetching status:", error);
	}

	next();
}
