/**
 * KYC Vault API Routes
 *
 * Endpoints for production-grade KYC verification and reuse system
 * Implements SEBI/RBI/PMLA compliant KYC vault with encryption, tokenization, and audit trails
 */

import type { Express, Request, Response } from "express";
import { kycWorkflowOrchestrator } from "./services/kyc-workflow-orchestrator";
import { kycReuseTokenService } from "./services/kyc-reuse-token-service";
import { db } from "./db";
import { kycVault, kycReuseTokens, kycAuditLogs } from "../shared/schema";
import { eq } from "drizzle-orm";
import expressRateLimit from "express-rate-limit";

// Rate limiting for KYC endpoints (security requirement)
const kycRateLimiter = expressRateLimit({
	windowMs: 15 * 60 * 1000, // 15 minutes
	max: 10, // 10 requests per window per IP
	message: "Too many KYC requests from this IP, please try again later",
	standardHeaders: true,
	legacyHeaders: false,
});

const kycTokenRateLimiter = expressRateLimit({
	windowMs: 60 * 60 * 1000, // 1 hour
	max: 50, // 50 token requests per hour
	message: "Token generation rate limit exceeded",
});

export function registerKYCVaultRoutes(app: Express) {
	/**
	 * POST /api/kyc-vault/initiate
	 * Step 1: Initiate OKYC workflow - Generate OTP for Aadhaar verification
	 */
	app.post(
		"/api/kyc-vault/initiate",
		kycRateLimiter,
		async (req: Request, res: Response) => {
			try {
				const { aadhaarNumber } = req.body;

				if (!aadhaarNumber || aadhaarNumber.length !== 12) {
					return res.status(400).json({
						success: false,
						error: "Valid 12-digit Aadhaar number is required",
					});
				}

				const result =
					await kycWorkflowOrchestrator.initiateOKYC(aadhaarNumber);

				if (!result.success) {
					return res.status(400).json(result);
				}

				res.json({
					success: true,
					message: result.message,
					refId: result.data?.refId,
					maskedAadhaar: result.data?.maskedAadhaar,
				});
			} catch (error: any) {
				console.error("KYC initiation error:", error);
				res.status(500).json({
					success: false,
					error: error.message || "Failed to initiate KYC verification",
				});
			}
		},
	);

	/**
	 * POST /api/kyc-vault/verify-otp
	 * Step 2: Verify OTP and retrieve Aadhaar data
	 */
	app.post(
		"/api/kyc-vault/verify-otp",
		kycRateLimiter,
		async (req: Request, res: Response) => {
			try {
				const { otp, refId } = req.body;

				if (!otp || !refId) {
					return res.status(400).json({
						success: false,
						error: "OTP and reference ID are required",
					});
				}

				const result = await kycWorkflowOrchestrator.verifyOKYC(otp, refId);

				if (!result.success) {
					return res.status(400).json(result);
				}

				res.json({
					success: true,
					message: result.message,
					data: result.data,
				});
			} catch (error: any) {
				console.error("OTP verification error:", error);
				res.status(500).json({
					success: false,
					error: error.message || "Failed to verify OTP",
				});
			}
		},
	);

	/**
	 * POST /api/kyc-vault/complete
	 * Step 3: Complete KYC workflow - Store in vault and generate reuse token
	 * This executes the full workflow: CKYC lookup → creation → vault storage → token generation
	 */
	app.post(
		"/api/kyc-vault/complete",
		kycRateLimiter,
		async (req: any, res: Response) => {
			try {
				const { panNumber, aadhaarNumber, otp, refId, consent } = req.body;

				// Require authentication
				if (!req.user || !req.user.id) {
					return res.status(401).json({
						success: false,
						error: "Authentication required",
					});
				}

				const userId = req.user.id;

				// Validate required fields
				if (!panNumber || !aadhaarNumber || !otp || !refId) {
					return res.status(400).json({
						success: false,
						error: "PAN, Aadhaar, OTP, and reference ID are required",
					});
				}

				// Check consent
				if (!consent) {
					return res.status(400).json({
						success: false,
						error: "User consent is required for KYC data storage and reuse",
					});
				}

				// Get IP address and user agent for audit
				const ipAddress = req.ip || req.headers["x-forwarded-for"] || "unknown";
				const userAgent = req.headers["user-agent"] || "unknown";

				// Execute complete workflow
				const result = await kycWorkflowOrchestrator.executeCompleteWorkflow(
					userId,
					panNumber.toUpperCase(),
					aadhaarNumber,
					otp,
					refId,
					ipAddress as string,
					userAgent,
				);

				if (!result.success) {
					return res.status(400).json(result);
				}

				res.json({
					success: true,
					message: result.message,
					kycStatus: result.kycStatus,
					ckycKinNumber: result.ckycKinNumber,
					kycReuseToken: result.kycReuseToken,
					data: result.data,
				});
			} catch (error: any) {
				console.error("KYC completion error:", error);
				res.status(500).json({
					success: false,
					error: error.message || "Failed to complete KYC workflow",
				});
			}
		},
	);

	/**
	 * POST /api/kyc-vault/token/generate
	 * Generate a new KYC Reuse Token for sharing with external parties
	 */
	app.post(
		"/api/kyc-vault/token/generate",
		kycTokenRateLimiter,
		async (req: any, res: Response) => {
			try {
				// Require authentication
				if (!req.user || !req.user.id) {
					return res.status(401).json({
						success: false,
						error: "Authentication required",
					});
				}

				const userId = req.user.id;
				const { purpose, issuedTo, expiryDays } = req.body;

				const result = await kycReuseTokenService.generateToken(userId, {
					purpose,
					issuedTo,
					expiryDays: expiryDays || 365,
				});

				if (!result.success) {
					return res.status(400).json(result);
				}

				// Log token generation
				await db.insert(kycAuditLogs).values({
					userId,
					accessedBy: userId,
					accessType: "token_generate_api",
					dataFieldsAccessed: ["kyc_reuse_token"],
					purpose: `API: Generated KYC Reuse Token for ${purpose || "general use"}`,
					externalParty: issuedTo,
					ipAddress: req.ip || "unknown",
					accessStatus: "success",
					regulatoryPurpose: "KYC_REUSE",
				});

				res.json({
					success: true,
					tokenId: result.tokenId,
					token: result.token,
					expiresAt: result.expiresAt,
				});
			} catch (error: any) {
				console.error("Token generation error:", error);
				res.status(500).json({
					success: false,
					error: error.message || "Failed to generate KYC reuse token",
				});
			}
		},
	);

	/**
	 * POST /api/kyc-vault/token/validate
	 * Validate a KYC Reuse Token (for external parties)
	 */
	app.post(
		"/api/kyc-vault/token/validate",
		kycTokenRateLimiter,
		async (req: Request, res: Response) => {
			try {
				const { tokenId } = req.body;

				if (!tokenId) {
					return res.status(400).json({
						success: false,
						error: "Token ID is required",
					});
				}

				const result = await kycReuseTokenService.validateToken(tokenId);

				if (!result.success) {
					return res.status(400).json(result);
				}

				if (!result.valid) {
					return res.status(400).json({
						success: true,
						valid: false,
						error: result.error,
					});
				}

				res.json({
					success: true,
					valid: true,
					claims: result.claims,
					tokenId: result.tokenId,
				});
			} catch (error: any) {
				console.error("Token validation error:", error);
				res.status(500).json({
					success: false,
					error: error.message || "Failed to validate token",
				});
			}
		},
	);

	/**
	 * GET /api/kyc-vault/status
	 * Get current KYC status for authenticated user
	 */
	app.get("/api/kyc-vault/status", async (req: any, res: Response) => {
		try {
			// Require authentication
			if (!req.user || !req.user.id) {
				return res.status(401).json({
					success: false,
					error: "Authentication required",
				});
			}

			const userId = req.user.id;

			// Fetch KYC vault data
			const vaultData = await db
				.select({
					kycStatus: kycVault.kycStatus,
					ckycStatus: kycVault.ckycStatus,
					source: kycVault.source,
					verificationMethod: kycVault.verificationMethod,
					isReusable: kycVault.isReusable,
					kycVerifiedAt: kycVault.kycVerifiedAt,
					kycExpiryDate: kycVault.kycExpiryDate,
					kycNextRenewalDate: kycVault.kycNextRenewalDate,
					isExpired: kycVault.isExpired,
				})
				.from(kycVault)
				.where(eq(kycVault.userId, userId))
				.limit(1);

			if (vaultData.length === 0) {
				return res.json({
					success: true,
					kycStatus: "not_started",
					message: "KYC verification not yet initiated",
				});
			}

			const vault = vaultData[0];

			res.json({
				success: true,
				kycStatus: vault.kycStatus,
				ckycStatus: vault.ckycStatus,
				source: vault.source,
				verificationMethod: vault.verificationMethod,
				isReusable: vault.isReusable,
				kycVerifiedAt: vault.kycVerifiedAt,
				kycExpiryDate: vault.kycExpiryDate,
				kycNextRenewalDate: vault.kycNextRenewalDate,
				isExpired: vault.isExpired,
				needsRenewal: vault.kycNextRenewalDate
					? new Date() >= new Date(vault.kycNextRenewalDate)
					: false,
			});
		} catch (error: any) {
			console.error("KYC status fetch error:", error);
			res.status(500).json({
				success: false,
				error: error.message || "Failed to fetch KYC status",
			});
		}
	});

	/**
	 * GET /api/kyc-vault/tokens
	 * Get all active KYC Reuse Tokens for authenticated user
	 */
	app.get("/api/kyc-vault/tokens", async (req: any, res: Response) => {
		try {
			// Require authentication
			if (!req.user || !req.user.id) {
				return res.status(401).json({
					success: false,
					error: "Authentication required",
				});
			}

			const userId = req.user.id;

			const tokens = await kycReuseTokenService.getUserTokens(userId);

			res.json({
				success: true,
				tokens: tokens.map((token) => ({
					tokenId: token.tokenId,
					purpose: token.tokenPurpose,
					issuedTo: token.issuedTo,
					isActive: token.isActive,
					isRevoked: token.isRevoked,
					usageCount: (token as any).usageCount,
					maxUsageLimit: (token as any).maxUsageLimit,
					expiresAt: token.expiresAt,
					issuedAt: token.issuedAt,
					lastUsedAt: (token as any).lastUsedAt,
				})),
			});
		} catch (error: any) {
			console.error("Tokens fetch error:", error);
			res.status(500).json({
				success: false,
				error: error.message || "Failed to fetch tokens",
			});
		}
	});

	/**
	 * POST /api/kyc-vault/token/revoke
	 * Revoke a KYC Reuse Token
	 */
	app.post("/api/kyc-vault/token/revoke", async (req: any, res: Response) => {
		try {
			// Require authentication
			if (!req.user || !req.user.id) {
				return res.status(401).json({
					success: false,
					error: "Authentication required",
				});
			}

			const userId = req.user.id;
			const { tokenId, reason } = req.body;

			if (!tokenId) {
				return res.status(400).json({
					success: false,
					error: "Token ID is required",
				});
			}

			const result = await kycReuseTokenService.revokeToken(
				tokenId,
				userId,
				reason || "User requested revocation",
			);

			if (!result.success) {
				return res.status(400).json(result);
			}

			res.json({
				success: true,
				message: "Token revoked successfully",
			});
		} catch (error: any) {
			console.error("Token revocation error:", error);
			res.status(500).json({
				success: false,
				error: error.message || "Failed to revoke token",
			});
		}
	});

	console.log("✅ KYC Vault API routes registered");
}
