/**
 * MFA Enforcement Middleware (GAP-2)
 *
 * SEBI CSCRF 2023, Clause 4.3 — Multi-factor authentication is mandatory for:
 *   - superadmin, master_agent, admin department heads
 *   - compliance_officer, regulatory_auditor
 *   - finance_head, tech_head
 *
 * WebAuthn passkeys (webauthn-routes.ts) are the primary MFA mechanism.
 * TOTP (authenticator apps) is the fallback.
 *
 * Flow:
 *  1. Session is established via password + OTP (existing flow)
 *  2. This middleware blocks privileged API access until MFA assertion is verified
 *  3. Verified MFA sets `session.mfaVerifiedAt` timestamp
 *  4. MFA assertion expires after 8 hours (re-challenged on next login)
 */

import { Request, Response, NextFunction } from "express";
import { logger } from "../logger";

/** Roles that require MFA before any API access */
export const MFA_REQUIRED_ROLES = new Set([
	"superadmin",
	"master_agent",
	"admin",
	"compliance_officer",
	"compliance_team",
	"finance_head",
	"regulatory_auditor",
	"tech_head",
]);

/** MFA session validity — 8 hours */
const MFA_TTL_MS = 8 * 60 * 60 * 1000;

/**
 * Paths exempt from MFA check (auth paths, WebAuthn assertion, health checks)
 */
const MFA_EXEMPT_PATHS = new Set([
	"/api/login",
	"/api/register",
	"/api/logout",
	"/api/auth/webauthn/authenticate",
	"/api/auth/webauthn/authenticate/options",
	"/api/mfa/verify-totp",
	"/api/mfa/status",
	"/api/csrf-token",
	"/api/health",
	"/health",
	"/live",
]);

/**
 * requireMFA — middleware that enforces MFA for privileged roles.
 *
 * Usage: Register AFTER the main auth middleware in index.ts:
 *   app.use('/api', requireMFA);
 */
export function requireMFA(
	req: Request,
	res: Response,
	next: NextFunction,
): void {
	// Skip if not authenticated (handled by auth middleware)
	if (!req.user?.id) return next();

	// Skip exempt paths
	if (MFA_EXEMPT_PATHS.has(req.path)) return next();

	// Get user role(s)
	const userRoles: string[] = (req.user as any).roles || [
		(req.user as any).role || "user",
	];
	const needsMFA = userRoles.some((role) => MFA_REQUIRED_ROLES.has(role));

	if (!needsMFA) return next();

	// Check if MFA has been completed in this session
	const session = req.session as any;
	const mfaVerifiedAt: number | undefined = session.mfaVerifiedAt;

	if (mfaVerifiedAt && Date.now() - mfaVerifiedAt < MFA_TTL_MS) {
		return next(); // MFA still valid
	}

	// MFA required but not yet verified for this session
	logger.warn("[MFA] Privileged access blocked — MFA not verified", {
		userId: req.user.id,
		userRoles,
		path: req.path,
		method: req.method,
	});

	res.status(403).json({
		code: "MFA_REQUIRED",
		message:
			"Multi-factor authentication is required for your role before accessing this resource.",
		mfaMethods: ["webauthn", "totp"],
		verifyEndpoint: "/api/auth/webauthn/authenticate",
		regulatoryBasis:
			"SEBI Cybersecurity & Cyber Resilience Framework 2023, Clause 4.3",
	});
}

/**
 * Mark MFA as verified in the current session.
 * Called from WebAuthn assertion success handler and TOTP verify route.
 */
export function markMFAVerified(req: Request): void {
	(req.session as any).mfaVerifiedAt = Date.now();
}

/**
 * Get MFA status for the current session.
 * Used by the frontend to show/hide MFA challenge UI.
 */
export function getMFAStatus(req: Request): {
	required: boolean;
	verified: boolean;
	verifiedAt?: Date;
	expiresAt?: Date;
} {
	const userRoles: string[] = (req.user as any)?.roles || [
		(req.user as any)?.role || "user",
	];
	const required = userRoles.some((role) => MFA_REQUIRED_ROLES.has(role));
	const mfaVerifiedAt: number | undefined = (req.session as any)?.mfaVerifiedAt;

	if (!required) return { required: false, verified: true };

	if (!mfaVerifiedAt) return { required: true, verified: false };

	const isValid = Date.now() - mfaVerifiedAt < MFA_TTL_MS;
	return {
		required: true,
		verified: isValid,
		verifiedAt: new Date(mfaVerifiedAt),
		expiresAt: new Date(mfaVerifiedAt + MFA_TTL_MS),
	};
}
