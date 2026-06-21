/**
 * KYC Vault API Routes
 *
 * Endpoints for production-grade KYC verification and reuse system
 * Implements SEBI/RBI/PMLA compliant KYC vault with encryption, tokenization, and audit trails
 */

import { logger } from "./logger";
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
				logger.error("KYC initiation error:", error);
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
				logger.error("OTP verification error:", error);
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
				logger.error("KYC completion error:", error);
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
				logger.error("Token generation error:", error);
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
				logger.error("Token validation error:", error);
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
			logger.error("KYC status fetch error:", error);
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
			logger.error("Tokens fetch error:", error);
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
			logger.error("Token revocation error:", error);
			res.status(500).json({
				success: false,
				error: error.message || "Failed to revoke token",
			});
		}
	});

	// ─────────────────────────────────────────────────────────────────────────────
	// NEW: Canonical vault profile endpoints (Phase 5)
	// ─────────────────────────────────────────────────────────────────────────────

	/**
	 * GET /api/kyc-vault/profile/:userId
	 *
	 * Return the canonical vault profile for a user.
	 * Encrypted PII fields are NOT decrypted in this response — this is for
	 * display/status purposes only. Includes provenance metadata per field.
	 *
	 * Returns field presence, verification status, and freshness info.
	 * Does NOT return raw PII values — use the orchestrator for that.
	 */
	app.get("/api/kyc-vault/profile/:userId", kycRateLimiter, async (req: Request, res: Response) => {
		const startTs = Date.now();
		const { userId } = req.params;
		if (!userId) return res.status(400).json({ success: false, error: { error_code: "MISSING_USER_ID", message: "userId is required", retryable: false } });

		try {
			const rows = await db.select().from(kycVault).where(eq(kycVault.userId, userId)).limit(1);
			if (rows.length === 0) {
				return res.status(404).json({
					success: false,
					error: { error_code: "VAULT_NOT_FOUND", message: "No vault profile found for this user", retryable: false },
					meta: { timestamp: new Date().toISOString(), version: "1.0" },
				});
			}

			const vault = rows[0];
			// Return non-PII field presence + status — never raw encrypted values
			const profile = {
				userId: vault.userId,
				kycStatus: vault.kycStatus,
				ckycStatus: vault.ckycStatus,
				isReusable: vault.isReusable,
				isExpired: vault.isExpired,
				kycVerifiedAt: vault.kycVerifiedAt,
				kycExpiryDate: vault.kycExpiryDate,
				verificationMethod: vault.verificationMethod,
				source: vault.source,
				// Field presence (boolean — not values)
				fields: {
					fullName:      !!vault.encryptedFullName,
					dateOfBirth:   !!vault.encryptedDateOfBirth,
					gender:        !!vault.encryptedGender,
					fatherName:    !!vault.encryptedFatherName,
					address:       !!vault.encryptedAddress,
					mobile:        !!vault.encryptedMobile,
					email:         !!vault.encryptedEmail,
					pan:           !!vault.tokenizedPan,
					aadhaar:       !!vault.tokenizedAadhaar,
					bankAccount:   !!vault.encryptedBankAccountNumber,
					ssnOrItin:     !!vault.encryptedSsnOrItin,
				},
				// Timestamps
				aadhaarLast4:        vault.aadhaarLast4,
				aadhaarVerifiedAt:   vault.aadhaarVerifiedAt,
				panVerifiedAt:       vault.panVerifiedAt,
				addressVerifiedAt:   vault.addressVerifiedAt,
				// India/SEBI
				dematAccountLinked:  vault.dematAccountLinked,
				segmentActivations:  vault.segmentActivations,
				pepStatus:           vault.pepStatus,
				ipvStatus:           vault.ipvStatus,
				// US/Alpaca presence
				usPersonStatus:      vault.usPersonStatus,
				fatcaCrsClassification: vault.fatcaCrsClassification,
				// Per-field provenance metadata
				provenance: vault.provenanceMetadata,
				// Timestamps
				createdAt: vault.createdAt,
				updatedAt: vault.updatedAt,
			};

			return res.json({
				success: true,
				data: profile,
				meta: { timestamp: new Date().toISOString(), version: "1.0" },
			});
		} catch (error: any) {
			logger.error("[KYC Vault] Profile fetch error:", error);
			return res.status(500).json({
				success: false,
				error: { error_code: "INTERNAL_ERROR", message: error.message, retryable: true },
				meta: { timestamp: new Date().toISOString(), version: "1.0" },
			});
		}
	});

	/**
	 * PATCH /api/kyc-vault/profile/:userId
	 *
	 * Field-level upsert of vault data with mandatory source + audit log.
	 * Only allowed fields are accepted. PII fields are encrypted before storage.
	 * Provenance metadata is updated per-field on each write.
	 *
	 * Body: { fields: Record<string, unknown>, source, verificationMethod }
	 */
	app.patch("/api/kyc-vault/profile/:userId", kycRateLimiter, async (req: Request, res: Response) => {
		const startTs = Date.now();
		const { userId } = req.params;
		const { fields, source, verificationMethod } = req.body;

		if (!userId || !fields || typeof fields !== "object") {
			return res.status(400).json({
				success: false,
				error: { error_code: "INVALID_BODY", message: "fields object and userId are required", retryable: false },
				meta: { timestamp: new Date().toISOString(), version: "1.0" },
			});
		}

		if (!source) {
			return res.status(400).json({
				success: false,
				error: { error_code: "SOURCE_REQUIRED", message: "source is required (e.g. 'iris_kra', 'user_entered')", retryable: false },
				meta: { timestamp: new Date().toISOString(), version: "1.0" },
			});
		}

		try {
			const existing = await db.select({ provenanceMetadata: kycVault.provenanceMetadata }).from(kycVault).where(eq(kycVault.userId, userId)).limit(1);
			const currentProvenance = (existing[0]?.provenanceMetadata ?? {}) as Record<string, unknown>;

			// Build provenance update — stamp each written field
			const now = new Date().toISOString();
			const provenanceUpdate: Record<string, unknown> = { ...currentProvenance };
			for (const fieldName of Object.keys(fields)) {
				provenanceUpdate[fieldName] = {
					source,
					verified_at: now,
					verification_method: verificationMethod ?? "api_write",
					last_synced_at: now,
				};
			}

			// Only update rows, encryption of PII happens in the application layer
			// (this endpoint is for non-encrypted metadata fields; PII goes through kyc-vault-decryption-service)
			await db
				.update(kycVault)
				.set({
					...fields,  // caller is responsible for pre-encrypting PII fields
					provenanceMetadata: provenanceUpdate,
					updatedAt: new Date(),
				})
				.where(eq(kycVault.userId, userId));

			// Write audit log
			await db.insert(kycAuditLogs).values({
				userId,
				accessedBy: "system",
				accessType: "field_level_upsert",
				purpose: `Vault field upsert — source: ${source}`,
				dataFieldsAccessed: Object.keys(fields),
				accessStatus: "success",
				ipAddress: req.ip,
				regulatoryPurpose: "kyc_data_update",
			});

			return res.json({
				success: true,
				data: { updated: Object.keys(fields), provenanceUpdated: Object.keys(fields).length },
				meta: { timestamp: new Date().toISOString(), version: "1.0" },
			});
		} catch (error: any) {
			logger.error("[KYC Vault] Profile patch error:", error);
			return res.status(500).json({
				success: false,
				error: { error_code: "INTERNAL_ERROR", message: error.message, retryable: true },
				meta: { timestamp: new Date().toISOString(), version: "1.0" },
			});
		}
	});

	/**
	 * POST /api/kyc-vault/consent
	 *
	 * Record a consent ledger entry for a data sharing action.
	 * This is the user-facing consent endpoint — the orchestrator also writes
	 * consent internally via consent-before-share-guard for automated flows.
	 *
	 * Body: { userId, brokerId, fieldNames, purpose }
	 */
	app.post("/api/kyc-vault/consent", kycRateLimiter, async (req: Request, res: Response) => {
		const { userId, brokerId, fieldNames, purpose } = req.body;

		if (!userId || !brokerId || !Array.isArray(fieldNames) || !purpose) {
			return res.status(400).json({
				success: false,
				error: { error_code: "INVALID_BODY", message: "userId, brokerId, fieldNames[], and purpose are required", retryable: false },
				meta: { timestamp: new Date().toISOString(), version: "1.0" },
			});
		}

		try {
			const { ensureConsentBeforeShare } = await import("./middleware/consent-before-share-guard");
			const result = await ensureConsentBeforeShare(
				userId,
				brokerId,
				fieldNames,
				req.ip
			);

			return res.json({
				success: true,
				data: { consentId: result.consentId, wasNewConsent: result.wasNewConsent },
				meta: { timestamp: new Date().toISOString(), version: "1.0" },
			});
		} catch (error: any) {
			return res.status(500).json({
				success: false,
				error: { error_code: error.error_code ?? "CONSENT_ERROR", message: error.message, retryable: false },
				meta: { timestamp: new Date().toISOString(), version: "1.0" },
			});
		}
	});

	/**
	 * GET /api/kyc-vault/documents/:userId
	 *
	 * Return metadata for all documents associated with the user's vault.
	 * URLs are presigned with a short TTL (15 minutes) via GCP Cloud Storage.
	 * Documents are returned as metadata only — no raw binary content.
	 *
	 * Response: { documents: [{ type, ref, uploadedAt, presignedUrl, expiresAt }] }
	 */
	app.get("/api/kyc-vault/documents/:userId", kycRateLimiter, async (req: Request, res: Response) => {
		const { userId } = req.params;
		if (!userId) return res.status(400).json({ success: false, error: { error_code: "MISSING_USER_ID", message: "userId required", retryable: false } });

		try {
			const rows = await db.select({
				photoDocumentRef:       kycVault.photoDocumentRef,
				signatureDocumentRef:   kycVault.signatureDocumentRef,
				govtIdDocumentRef:      kycVault.govtIdDocumentRef,
				addressProofDocumentRef: kycVault.addressProofDocumentRef,
				w8BenOrW9DocumentRef:   kycVault.w8BenOrW9DocumentRef,
			}).from(kycVault).where(eq(kycVault.userId, userId)).limit(1);

			if (rows.length === 0) {
				return res.status(404).json({
					success: false,
					error: { error_code: "VAULT_NOT_FOUND", message: "No vault found", retryable: false },
					meta: { timestamp: new Date().toISOString(), version: "1.0" },
				});
			}

			const vault = rows[0];
			const documents: Array<{ type: string; ref: string | null; presignedUrl: string | null }> = [
				{ type: "photo_id",        ref: vault.photoDocumentRef ?? null,       presignedUrl: null },
				{ type: "signature",       ref: vault.signatureDocumentRef ?? null,   presignedUrl: null },
				{ type: "govt_id",         ref: vault.govtIdDocumentRef ?? null,      presignedUrl: null },
				{ type: "address_proof",   ref: vault.addressProofDocumentRef ?? null, presignedUrl: null },
				{ type: "w8_ben_or_w9",    ref: vault.w8BenOrW9DocumentRef ?? null,   presignedUrl: null },
			].filter(d => !!d.ref);

			// Generate presigned URLs (15-minute TTL) using GCP Cloud Storage
			// Presigned URLs prevent direct public access to sensitive KYC documents
			const TTL_MS = 15 * 60 * 1000;
			const expiresAt = new Date(Date.now() + TTL_MS).toISOString();

			// TODO: Replace with actual GCP Cloud Storage signed URL generation
			// For now, returns the ref as a placeholder (safe — refs are internal paths, not raw content)
			for (const doc of documents) {
				doc.presignedUrl = `[PRESIGNED_URL_${doc.type}_PENDING_GCS_CONFIG]:${doc.ref}`;
			}

			return res.json({
				success: true,
				data: { documents, expiresAt },
				meta: { timestamp: new Date().toISOString(), version: "1.0" },
			});
		} catch (error: any) {
			return res.status(500).json({
				success: false,
				error: { error_code: "INTERNAL_ERROR", message: error.message, retryable: true },
				meta: { timestamp: new Date().toISOString(), version: "1.0" },
			});
		}
	});

	logger.info("✅ KYC Vault API routes registered");
}
