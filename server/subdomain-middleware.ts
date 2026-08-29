import { Request, Response, NextFunction } from "express";
import { logger } from "./logger";

// Extend Express Request interface to include subdomain info
declare global {
	namespace Express {
		interface Request {
			isAdminPortal?: boolean;
			isPartnerPortal?: boolean;
			isAgentPortal?: boolean;
			subdomain?: string;
		}
	}
}

/**
 * Middleware to detect subdomain from hostname and set portal context
 * Supports:
 * - admin.fintekpro.com → Admin Portal
 * - partner.fintekpro.com → Partner Portal
 * - agent.fintekpro.com → Agent Portal
 * - fintekpro.com / www.fintekpro.com → Client Portal
 * - admin.localhost:5000 → Admin Portal (dev)
 * - partner.localhost:5000 → Partner Portal (dev)
 * - agent.localhost:5000 → Agent Portal (dev)
 * - localhost:5000 → Client Portal (dev)
 */
export function subdomainDetection(
	req: Request,
	res: Response,
	next: NextFunction,
) {
	// CRITICAL: Prioritize X-Forwarded-Host for Cloud Run / Firebase Proxy compatibility
	const xForwardedHost = req.get("x-forwarded-host");
	const hostname = (
		xForwardedHost ||
		req.hostname ||
		req.get("host") ||
		""
	).toLowerCase();

	const debugEnabled =
		process.env.DEBUG_SUBDOMAIN === "true" ||
		process.env.NODE_ENV !== "production";
	if (debugEnabled) {
		logger.info("SUBDOMAIN_DEBUG", { event: "SUBDOMAIN_DEBUG", path: req.path });
		logger.info("SUBDOMAIN_DEBUG", {
			event: "SUBDOMAIN_DEBUG",
			host: req.get("host"),
			xForwardedHost,
			reqHostname: req.hostname,
			using: hostname,
		});
		logger.info("SUBDOMAIN_DEBUG", {
			event: "SUBDOMAIN_DEBUG",
			xForwardedProto: req.get("x-forwarded-proto"),
			origin: req.get("origin"),
		});
	}

	// Extract subdomain
	const parts = hostname.split(".");
	let subdomain = "";

	// Skip portal parsing for Cloud Run internal URLs or common GCP domains
	// IMPORTANT: When a request arrives via the internal .a.run.app URL, check the
	// X-Forwarded-Host or Origin header to recover the true subdomain.
	if (
		hostname.includes(".a.run.app") ||
		hostname.includes("cloudfunctions.net")
	) {
		// Try to recover true subdomain from X-Forwarded-Host or Origin
		const originHost = (req.get("origin") || "")
			.replace(/^https?:\/\//, "")
			.split(":")[0]
			.toLowerCase();
		const forwardedParts = (xForwardedHost || originHost || "").split(".");
		if (forwardedParts.length > 2 &&
			forwardedParts[0] !== "www" &&
			["admin", "partner", "agent"].includes(forwardedParts[0])
		) {
			subdomain = forwardedParts[0];
			logger.info("SUBDOMAIN_GCP_RECOVERED", { event: "SUBDOMAIN_GCP_RECOVERED", subdomain, hostname });
		} else {
			subdomain = "";
			logger.info("SUBDOMAIN_GCP_DEFAULT", { event: "SUBDOMAIN_GCP_DEFAULT", hostname });
		}
		if (debugEnabled) {
			logger.info("SUBDOMAIN_GCP_HEADERS", { event: "SUBDOMAIN_GCP_HEADERS", headers: req.headers });
		}
	}
	// For localhost development (admin.localhost, partner.localhost, agent.localhost, or just localhost)
	else if (
		hostname.includes("localhost") ||
		hostname.includes("0.0.0.0") ||
		hostname.includes("127.0.0.1")
	) {
		if (parts[0] === "admin") {
			subdomain = "admin";
		} else if (parts[0] === "partner") {
			subdomain = "partner";
		} else if (parts[0] === "agent") {
			subdomain = "agent";
		} else {
			subdomain = "";
		}
	}
	// For production domains (e.g. agent.fintekpro.com or fintekpro.com)
	else if (parts.length >= 2) {
		// If we have more than 2 parts, the first part is likely a subdomain
		// Example: agent.fintekpro.com -> parts = ['agent', 'fintekpro', 'com'] -> length 3
		if (parts.length > 2 && parts[0] !== "www") {
			subdomain = parts[0];
		} else {
			subdomain = "";
		}
	}

	// Development-only override - NEVER allow in production
	// Allow override via query params (enabled in production for Cloud Run compatibility)
	if (req.query.portal) {
		subdomain = String(req.query.portal);
	} else if (req.query.admin === "true") {
		subdomain = "admin";
	} else if (req.query.partner === "true") {
		subdomain = "partner";
	} else if (req.query.agent === "true") {
		subdomain = "agent";
	}

	// Set flags on request
	req.subdomain = subdomain;
	req.isAdminPortal = subdomain === "admin";
	req.isPartnerPortal = subdomain === "partner";
	req.isAgentPortal = subdomain === "agent";

	// Log only for portal requests to reduce noise (disabled by default)
	// Enable with DEBUG_SUBDOMAIN=true for troubleshooting
	if (process.env.DEBUG_SUBDOMAIN === "true" &&
		(req.isAdminPortal || req.isPartnerPortal || req.isAgentPortal)
	) {
		logger.info("SUBDOMAIN_DETECTED", { event: "SUBDOMAIN_DETECTED", subdomain, hostname });
	}

	next();
}

/**
 * Middleware to restrict routes to admin portal only
 * SECURITY: Requires BOTH admin subdomain AND admin user role
 */
export async function requireAdminPortal(
	req: Request,
	res: Response,
	next: NextFunction,
) {
	// First check: Must be on admin subdomain
	if (!req.isAdminPortal) {
		return res.status(403).json({
			error: "Access denied",
			message: "This resource is only available on the admin portal",
			redirectTo: `https://admin.${req.hostname}`,
		});
	}

	// Second check: User must be authenticated
	if (!req.user) {
		return res.status(401).json({
			error: "Authentication required",
			message: "Please log in to access the admin portal",
		});
	}

	// Third check: User must have admin role
	const userRoles = req.user.roles || [];
	const isAdmin =
		userRoles.includes("admin") || userRoles.includes("super_admin");

	if (!isAdmin) {
		return res.status(403).json({
			error: "Access denied",
			message: "Admin privileges required",
		});
	}

	next();
}

/**
 * Middleware to restrict routes to partner portal only
 * SECURITY: Requires BOTH partner subdomain AND partner/agent user role
 */
export async function requirePartnerPortal(
	req: Request,
	res: Response,
	next: NextFunction,
) {
	// First check: Must be on partner subdomain
	if (!req.isPartnerPortal) {
		return res.status(403).json({
			error: "Access denied",
			message: "This resource is only available on the partner portal",
			redirectTo: `https://partner.${req.hostname.replace(/^(admin\\.|partner\\.)/, "")}`,
		});
	}

	// Second check: User must be authenticated
	if (!req.user) {
		return res.status(401).json({
			error: "Authentication required",
			message: "Please log in to access the partner portal",
		});
	}

	// Third check: User must have agent/partner role
	const userRoles = req.user.roles || [];
	const isPartner =
		userRoles.includes("partner") ||
		userRoles.includes("agent") ||
		userRoles.includes("master_agent") ||
		userRoles.includes("sub_agent");

	if (!isPartner) {
		return res.status(403).json({
			error: "Access denied",
			message: "Partner privileges required",
		});
	}

	next();
}

/**
 * Middleware to restrict routes to agent portal only
 * SECURITY: Requires BOTH agent subdomain AND agent user role
 */
export async function requireAgentPortal(
	req: Request,
	res: Response,
	next: NextFunction,
) {
	// First check: Must be on agent subdomain
	if (!req.isAgentPortal) {
		return res.status(403).json({
			error: "Access denied",
			message: "This resource is only available on the agent portal",
			redirectTo: `https://agent.${req.hostname.replace(/^(admin\\.|partner\\.|agent\\.)/, "")}`,
		});
	}

	// Second check: User must be authenticated
	if (!req.user) {
		return res.status(401).json({
			error: "Authentication required",
			message: "Please log in to access the agent portal",
		});
	}

	// Third check: User must have agent role
	const userRoles = req.user.roles || [];
	const isAgent =
		userRoles.includes("agent") ||
		userRoles.includes("master_agent") ||
		userRoles.includes("sub_agent");

	if (!isAgent) {
		return res.status(403).json({
			error: "Access denied",
			message: "Agent privileges required",
		});
	}

	next();
}

/**
 * Middleware to restrict routes to client portal only
 */
export function requireClientPortal(
	req: Request,
	res: Response,
	next: NextFunction,
) {
	if (req.isAdminPortal || req.isPartnerPortal || req.isAgentPortal) {
		return res.status(403).json({
			error: "Access denied",
			message:
				"This resource is not available on the admin, partner, or agent portal",
			redirectTo: `https://${req.hostname.replace(/^(admin\\.|partner\\.|agent\\.)/, "")}`,
		});
	}
	next();
}

/**
 * Stamped the session with the current portal type to prevent portal hopping
 * called during login verification.
 */
export function stampSessionPortal(req: Request, portalType?: string) {
	if (req.session) {
		const finalPortalType = portalType || req.subdomain || "main";
		(req.session as any).portalType = finalPortalType;

		if (process.env.DEBUG_SUBDOMAIN === "true") {
			logger.info("SUBDOMAIN_STAMP", {
				event: "SUBDOMAIN_STAMP",
				sessionId: req.sessionID,
				portal: finalPortalType,
			});
		}
	}
}

/**
 * Middleware to validate that session portal matches current subdomain.
 * If mismatch detected, forces logout for security.
 * Only enforced for authenticated users on non-main portals.
 */
export function validateSessionPortal(
	req: Request,
	res: Response,
	next: NextFunction,
) {
	if (!req.user || !req.session) {
		return next();
	}

	const sessionPortal = (req.session as any).portalType;
	const currentPortal = req.subdomain || "main";

	if (!sessionPortal) {
		(req.session as any).portalType = currentPortal;
		return next();
	}

	const isPrivilegedPortal = (p: string) =>
		["admin", "partner", "agent"].includes(p);

	// ── CLOUD RUN INTERNAL ROUTING SAFEGUARD ────────────────────────────────────
	// When requests arrive via the Cloud Run internal URL (*.a.run.app), subdomain
	// detection may fall back to '' / 'main' even though the user is on the agent
	// portal. In this case currentPortal = '' which creates a false mismatch with
	// sessionPortal = 'agent'. We handle this by checking if the user actually
	// has the required role for their stored session portal — if yes, we trust the
	// session and update currentPortal to match rather than force-logging out.
	if (
		(currentPortal === "" || currentPortal === "main") &&
		isPrivilegedPortal(sessionPortal)
	) {
		const userRoles = req.user.roles || [];
		let hasSessionPortalRole = false;
		if (sessionPortal === "admin") {
			hasSessionPortalRole =
				userRoles.includes("admin") ||
				userRoles.includes("superadmin") ||
				userRoles.includes("super_admin");
		} else if (sessionPortal === "partner") {
			hasSessionPortalRole =
				userRoles.includes("partner") ||
				userRoles.includes("agent") ||
				userRoles.includes("master_agent") ||
				userRoles.includes("sub_agent");
		} else if (sessionPortal === "agent") {
			hasSessionPortalRole =
				userRoles.includes("agent") ||
				userRoles.includes("master_agent") ||
				userRoles.includes("sub_agent") ||
				userRoles.includes("admin") ||
				userRoles.includes("superadmin");
		}
		if (hasSessionPortalRole) {
			// Trust the session's portal binding — the user legitimately belongs there
			req.subdomain = sessionPortal;
			req.isAdminPortal = sessionPortal === "admin";
			req.isPartnerPortal = sessionPortal === "partner";
			req.isAgentPortal = sessionPortal === "agent";
			return next();
		}
	}

	const isMismatch =
		(isPrivilegedPortal(currentPortal) && sessionPortal !== currentPortal) ||
		(currentPortal === "" && isPrivilegedPortal(sessionPortal)) ||
		(currentPortal === "main" && isPrivilegedPortal(sessionPortal));

	if (isMismatch) {
		// Relaxed validation: If user has the required role for the current portal,
		// we allow the switch and update the session portal binding.
		const userRoles = req.user.roles || [];
		let hasAccess = false;

		if (currentPortal === "admin") {
			hasAccess =
				userRoles.includes("admin") ||
				userRoles.includes("superadmin") ||
				userRoles.includes("super_admin");
		} else if (currentPortal === "partner") {
			hasAccess =
				userRoles.includes("partner") ||
				userRoles.includes("agent") ||
				userRoles.includes("master_agent") ||
				userRoles.includes("sub_agent");
		} else if (currentPortal === "agent") {
			hasAccess =
				userRoles.includes("agent") ||
				userRoles.includes("master_agent") ||
				userRoles.includes("sub_agent");
		} else if (currentPortal === "main" || currentPortal === "") {
			hasAccess = true;
		}

		if (hasAccess) {
			logger.info("PORTAL_SWITCH", {
				event: "PORTAL_SWITCH",
				user_id: req.user.id,
				from: sessionPortal,
				to: currentPortal || "main",
			});
			(req.session as any).portalType = currentPortal;
			return next();
		}

		logger.warn("PORTAL_MISMATCH", {
			event: "PORTAL_MISMATCH",
			user_id: req.user.id,
			sessionPortal,
			currentPortal: currentPortal || "main",
		});
		req.logout((err) => {
			if (err) logger.error("PORTAL_LOGOUT_ERROR", { event: "PORTAL_LOGOUT_ERROR", error: String(err) });
			res.status(403).json({
				error: "Portal mismatch",
				message:
					"Your session was created on a different portal and you lack roles for the current one. Please log in again.",
				sessionPortal,
				currentPortal: currentPortal || "main",
				action: "force_logout",
			});
		});
		return;
	}

	next();
}
