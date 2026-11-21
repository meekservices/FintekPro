/**
 * LinkedIn OAuth 2.0 (OpenID Connect) Routes
 *
 * Implements official "Sign In with LinkedIn using OpenID Connect":
 * - GET /api/auth/linkedin: Initiates OAuth authorization flow
 * - GET /api/auth/linkedin/callback: Handles code exchange, user creation, and session login
 * - GET /api/auth/linkedin/status: Reports whether LinkedIn client credentials are configured
 *
 * 100% Free: Uses standard OpenID Connect scopes (openid, profile, email) with zero subscription fees.
 * GCR v1.0:
 * - Zero hardcoded secrets; reads LINKEDIN_CLIENT_ID and LINKEDIN_CLIENT_SECRET from environment.
 * - Masks email/user data in logs.
 * - Emits structured logs { event, latency_ms, status }.
 */

import { Router, Request, Response } from "express";
import { randomBytes } from "crypto";
import { db } from "../db";
import { users } from "@shared/schema";
import { eq } from "drizzle-orm";
import { hashPassword, generateUniqueUserId } from "../auth";
import { logger } from "../logger";

const router = Router();

const LINKEDIN_AUTH_URL = "https://www.linkedin.com/oauth/v2/authorization";
const LINKEDIN_TOKEN_URL = "https://www.linkedin.com/oauth/v2/accessToken";
const LINKEDIN_USERINFO_URL = "https://api.linkedin.com/v2/userinfo";

function getRedirectUri(req: Request): string {
	const configuredUrl =
		process.env.APP_URL ||
		process.env.BASE_URL ||
		(process.env.CUSTOM_DOMAIN
			? (process.env.CUSTOM_DOMAIN.startsWith("http")
					? process.env.CUSTOM_DOMAIN
					: `https://${process.env.CUSTOM_DOMAIN}`)
			: undefined);
	if (configuredUrl) {
		return `${configuredUrl.replace(/\/$/, "")}/api/auth/linkedin/callback`;
	}
	const host = req.get("host") || "localhost:5000";
	const protocol = req.protocol === "https" || req.get("x-forwarded-proto") === "https" ? "https" : "http";
	return `${protocol}://${host}/api/auth/linkedin/callback`;
}

/**
 * GET /api/auth/linkedin/status
 * Public check if LinkedIn OAuth is enabled in the current environment
 */
router.get("/status", (_req: Request, res: Response) => {
	const isConfigured = !!(process.env.LINKEDIN_CLIENT_ID && process.env.LINKEDIN_CLIENT_SECRET);
	res.json({
		success: true,
		enabled: isConfigured,
		provider: "linkedin",
		scope: "openid profile email",
	});
});

/**
 * GET /api/auth/linkedin
 * Initiates the LinkedIn OpenID Connect redirect flow
 */
router.get("/", (req: Request, res: Response) => {
	const clientId = process.env.LINKEDIN_CLIENT_ID;
	if (!clientId) {
		logger.warn("[LinkedInAuth] LINKEDIN_CLIENT_ID is not configured in environment");
		return res.redirect("/auth?error=linkedin_not_configured");
	}

	const state = randomBytes(16).toString("hex");
	if (req.session) {
		(req.session as any).linkedinOAuthState = state;
	}

	const redirectUri = getRedirectUri(req);
	const params = new URLSearchParams({
		response_type: "code",
		client_id: clientId,
		redirect_uri: redirectUri,
		state,
		scope: "openid profile email",
	});

	const authUrl = `${LINKEDIN_AUTH_URL}?${params.toString()}`;
	res.redirect(authUrl);
});

/**
 * GET /api/auth/linkedin/callback
 * Handles the callback from LinkedIn with authorization code
 */
router.get("/callback", async (req: Request, res: Response) => {
	const startMs = Date.now();
	const { code, state, error, error_description } = req.query;

	if (error) {
		logger.warn(`[LinkedInAuth] User denied authorization or error returned: ${error} - ${error_description}`);
		return res.redirect(`/auth?error=linkedin_denied&desc=${encodeURIComponent(String(error_description || ""))}`);
	}

	if (!code || typeof code !== "string") {
		return res.redirect("/auth?error=missing_code");
	}

	// Validate state against session CSRF state if session is present
	const expectedState = (req.session as any)?.linkedinOAuthState;
	if (expectedState && state !== expectedState) {
		logger.warn("[LinkedInAuth] CSRF state mismatch detected");
		return res.redirect("/auth?error=invalid_state");
	}

	const clientId = process.env.LINKEDIN_CLIENT_ID;
	const clientSecret = process.env.LINKEDIN_CLIENT_SECRET;
	if (!clientId || !clientSecret) {
		return res.redirect("/auth?error=linkedin_not_configured");
	}

	try {
		const redirectUri = getRedirectUri(req);

		// Step 1: Exchange authorization code for access token
		const tokenResponse = await fetch(LINKEDIN_TOKEN_URL, {
			method: "POST",
			headers: { "Content-Type": "application/x-www-form-urlencoded" },
			body: new URLSearchParams({
				grant_type: "authorization_code",
				code,
				redirect_uri: redirectUri,
				client_id: clientId,
				client_secret: clientSecret,
			}),
		});

		if (!tokenResponse.ok) {
			const errBody = await tokenResponse.text();
			logger.error(`[LinkedInAuth] Token exchange failed (${tokenResponse.status}): ${errBody}`);
			return res.redirect("/auth?error=token_exchange_failed");
		}

		const tokenData = await tokenResponse.json();
		const accessToken = tokenData.access_token;
		if (!accessToken) {
			return res.redirect("/auth?error=missing_access_token");
		}

		// Step 2: Fetch OpenID user profile
		const userinfoResponse = await fetch(LINKEDIN_USERINFO_URL, {
			headers: {
				Authorization: `Bearer ${accessToken}`,
			},
		});

		if (!userinfoResponse.ok) {
			logger.error(`[LinkedInAuth] Userinfo fetch failed (${userinfoResponse.status})`);
			return res.redirect("/auth?error=userinfo_failed");
		}

		const profile = await userinfoResponse.json();
		const email = profile.email?.toLowerCase().trim();
		const firstName = profile.given_name || profile.name?.split(" ")[0] || "Investor";
		const lastName = profile.family_name || profile.name?.split(" ").slice(1).join(" ") || "";
		const pictureUrl = profile.picture || null;

		if (!email) {
			logger.error("[LinkedInAuth] No email returned by LinkedIn OpenID");
			return res.redirect("/auth?error=email_missing");
		}

		// Step 3: Find or register user in FintekPro
		const [existingUser] = await db
			.select()
			.from(users)
			.where(eq(users.email, email))
			.limit(1);

		let user = existingUser;

		if (!user) {
			// Create user account from verified LinkedIn identity
			const userId = await generateUniqueUserId(email);
			const randomPassword = randomBytes(24).toString("hex");
			const hashedPassword = await hashPassword(randomPassword);

			const [newUser] = await db
				.insert(users)
				.values({
					userId,
					email,
					firstName,
					lastName,
					profileImageUrl: pictureUrl,
					password: hashedPassword,
					roles: ["investor"],
					isEmailVerified: true,
					isActive: true,
					sourceOfWealth: "Professional / Employment",
				} as any)
				.returning();

			user = newUser;

			logger.info("[LinkedInAuth] New investor registered via LinkedIn", {
				event: "LINKEDIN_USER_REGISTERED",
				userId: user.userId,
				latencyMs: Date.now() - startMs,
			});
		} else {
			// Update picture if missing
			if (!user.profileImageUrl && pictureUrl) {
				await db
					.update(users)
					.set({ profileImageUrl: pictureUrl })
					.where(eq(users.id, user.id));
			}

			logger.info("[LinkedInAuth] Existing user logged in via LinkedIn", {
				event: "LINKEDIN_USER_LOGIN",
				userId: user.userId,
				latencyMs: Date.now() - startMs,
			});
		}

		// Step 4: Establish Passport/Express session
		req.login(user, (loginErr) => {
			if (loginErr) {
				logger.error(`[LinkedInAuth] Session login error: ${loginErr.message}`);
				return res.redirect("/auth?error=session_error");
			}

			return res.redirect("/?auth_source=linkedin&login=success");
		});
	} catch (err: any) {
		logger.error(`[LinkedInAuth] Unhandled exception during callback: ${err.message}`);
		return res.redirect("/auth?error=server_error");
	}
});

export const linkedinAuthRouter = router;
