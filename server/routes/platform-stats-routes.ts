import { Express } from "express";
import { requireAdmin } from "../middleware/roleMiddleware";
import { platformStatsCache } from "../services/platform-stats-cache";
import { storage } from "../storage";
import { db } from "../db";
import { sql } from "drizzle-orm";
import { complianceMonitor } from "../compliance-monitor";
import { logger } from "../logger";

export async function registerPlatformStatsRoutes(app: Express): Promise<void> {
	// Platform Statistics endpoint - Real data for homepage (with caching)
	app.get("/api/platform/stats", async (req, res) => {
		try {
			const { data, cached, cacheAge } = await platformStatsCache.getStats();
			res.set("X-Cache-Status", cached ? "HIT" : "MISS");
			res.set("X-Cache-Age", String(Math.round(cacheAge / 1000)));
			res.json(data);
		} catch (error) {
			logger.error("Error fetching platform stats", { error: (error as any)?.message || error });
			res.json({
				activeUsers: "0",
				activeUsersRaw: 0,
				portfolioValue: "₹0",
				portfolioValueRaw: 0,
				avgPortfolioValue: "₹0",
				avgPortfolioValueRaw: 0,
				portfoliosCount: "0",
				portfoliosCountRaw: 0,
				dailyTrades: "0",
				dailyTradesRaw: 0,
				monthlyTrades: "0",
				monthlyTradesRaw: 0,
				mutualFundsCount: "0",
				mutualFundsCountRaw: 0,
				bondsCount: "0",
				bondsCountRaw: 0,
				stocksCount: "0",
				stocksCountRaw: 0,
				activeIpos: "0",
				activeIposRaw: 0,
				investmentOptions: "0+",
				investmentOptionsRaw: 0,
				lastUpdated: new Date().toISOString(),
			});
		}
	});

	// Platform Stats Cache Management endpoints (admin only)
	app.post("/api/platform/stats/invalidate", requireAdmin, async (req, res) => {
		platformStatsCache.invalidate();
		res.json({ success: true, message: "Platform stats cache invalidated" });
	});

	app.get("/api/platform/stats/metrics", requireAdmin, async (req, res) => {
		res.json(platformStatsCache.getMetrics());
	});

	app.post("/api/platform/stats/configure", requireAdmin, async (req, res) => {
		const { ttlSeconds } = req.body;
		if (
			typeof ttlSeconds === "number" &&
			ttlSeconds >= 10 &&
			ttlSeconds <= 3600
		) {
			platformStatsCache.setTTL(ttlSeconds * 1000);
			res.json({ success: true, ttlSeconds });
		} else {
			res
				.status(400)
				.json({ error: "ttlSeconds must be a number between 10 and 3600" });
		}
	});

	// Public Feature Flag Check endpoint
	app.get("/api/feature-flags/check/:flagKey", async (req, res) => {
		try {
			const { flagKey } = req.params;
			const userId = (req as any).user?.id;

			const result = await db.execute(sql`
      SELECT id, flag_key, flag_name, is_enabled,
             COALESCE((targeting_rules->>'percentRollout')::int, 100) as rollout_percentage
      FROM platform_feature_flags
      WHERE flag_key = ${flagKey}
      LIMIT 1
    `);

			if (result.rows.length === 0) {
				return res.json({ enabled: false, reason: "flag_not_found" });
			}

			const flag = result.rows[0] as any;
			const isEnabled = flag.is_enabled || false;
			const rolloutPercentage = flag.rollout_percentage || 100;

			// Simple hash-based rollout for consistent user experience
			let inRollout = true;
			if (rolloutPercentage < 100 && userId) {
				const hash = userId
					.split("")
					.reduce((acc: number, char: string) => acc + char.charCodeAt(0), 0);
				inRollout = hash % 100 < rolloutPercentage;
			}

			res.json({
				enabled: isEnabled && inRollout,
				flagKey: flag.flag_key,
				rolloutPercentage,
			});
		} catch (error: any) {
			logger.error("[Feature Flags] Check error", { error: error.message });
			res.json({ enabled: false, error: "check_failed" });
		}
	});
	// GDPR Consent endpoint
	app.post("/api/consent", async (req, res) => {
		try {
			const { preferences, timestamp, version, sessionId } = req.body;
			const userId = (req as any).user?.id;
			const ipAddress = req.ip || req.connection.remoteAddress || "";
			const userAgent = req.get("User-Agent") || "";

			// Log consent for audit trail (legacy compliance monitor)
			complianceMonitor.logEvent({
				userId,
				eventType: "consent_change",
				action: "GDPR consent recorded",
				ipAddress,
				userAgent,
				outcome: "success",
				riskLevel: "low",
				details: { preferences, timestamp, version },
			});

			// Record to immutable consent audit log (DPDPA 2023 compliance)
			try {
				const { consentAuditService } = await import(
					"../services/consent-audit-service"
				);
				const consents: Array<{
					consentType: any;
					action: "granted" | "withdrawn";
				}> = [];

				if (preferences) {
					if (preferences.essential !== undefined) {
						consents.push({
							consentType: "essential_cookies",
							action: preferences.essential ? "granted" : "withdrawn",
						});
					}
					if (preferences.analytics !== undefined) {
						consents.push({
							consentType: "analytics_cookies",
							action: preferences.analytics ? "granted" : "withdrawn",
						});
					}
					if (preferences.marketing !== undefined) {
						consents.push({
							consentType: "marketing_cookies",
							action: preferences.marketing ? "granted" : "withdrawn",
						});
					}
					if (preferences.thirdParty !== undefined) {
						consents.push({
							consentType: "third_party_sharing",
							action: preferences.thirdParty ? "granted" : "withdrawn",
						});
					}
					if (preferences.all !== undefined) {
						consents.push({
							consentType: "all_cookies",
							action: preferences.all ? "granted" : "withdrawn",
						});
					}
					if (preferences.fnoRiskDisclosure !== undefined) {
						consents.push({
							consentType: "sebi_fno_risk_disclosure",
							action: preferences.fnoRiskDisclosure ? "granted" : "withdrawn",
						});
					}
					if (preferences.aiGovernance !== undefined) {
						consents.push({
							consentType: "ai_governance_acknowledgment",
							action: preferences.aiGovernance ? "granted" : "withdrawn",
						});
					}
					if (preferences.dpdpConsent !== undefined) {
						consents.push({
							consentType: "dpdp_data_consent",
							action: preferences.dpdpConsent ? "granted" : "withdrawn",
						});
					}
				}

				if (consents.length > 0) {
					await consentAuditService.recordBulkConsent(consents, {
						userId,
						sessionId: sessionId || `session-${Date.now()}`,
						version: version || "1.0",
						sourceScreen: req.body.sourceScreen || "privacy_dialog",
						sourceComponent: req.body.sourceComponent || "CookieConsentBanner",
						ipAddress,
						userAgent,
						additionalData: { rawPreferences: preferences, timestamp },
					});
				}
			} catch (auditError) {
				logger.error("[ConsentAudit] Failed to persist consent", { error: (auditError as any)?.message || auditError });
			}

			res.json({
				success: true,
				message: "Consent preferences recorded successfully",
			});
		} catch (error) {
			logger.error("Error recording consent", { error: (error as any)?.message || error });
			res.status(500).json({ error: "Failed to record consent preferences" });
		}
	});

	// DPDP Act 2023 Section 11: Right to Access Information (Data Export)
	app.get("/api/privacy/export-my-data", async (req, res) => {
		try {
			const userId = (req as any).user?.id;
			if (!userId) {
				res.status(401).json({ success: false, error: "Authentication required to export data" });
				return;
			}

			const [user, profile, bankAccounts, dematAccounts] = await Promise.all([
				storage.getUser(userId),
				storage.getUserProfile(userId).catch(() => null),
				storage.getUserBankAccounts(userId).catch(() => []),
				storage.getUserDematAccounts(userId).catch(() => []),
			]);

			if (!user) {
				res.status(404).json({ success: false, error: "User not found" });
				return;
			}

			// Sanitize sensitive credentials
			const sanitizedUser = {
				id: user.id,
				email: user.email,
				phone: (user as any).phone || (user as any).mobile || null,
				fullName: (user as any).fullName || `${(user as any).firstName || ''} ${(user as any).lastName || ''}`.trim(),
				kycStatus: (user as any).kycStatus || "PENDING",
				role: (user as any).role || (user as any).roles || "CLIENT",
				createdAt: user.createdAt,
			};

			const exportPayload = {
				version: "1.0",
				statutoryFramework: "DPDP_ACT_2023_SECTION_11",
				dataFiduciary: {
					name: "FintekPro Wealth Systems",
					entityRegistration: "SEBI Registered Intermediary",
					dpoContact: "privacy@fintekpro.com",
				},
				exportTimestamp: new Date().toISOString(),
				userData: {
					user: sanitizedUser,
					profile,
					bankAccounts,
					dematAccounts,
				},
				regulatoryNotice: "Personal data exported in compliance with the Digital Personal Data Protection Act, 2023. Statutory transaction records, KYC documents, and order audit trails are preserved under mandatory SEBI and PMLA 7-year retention requirements.",
			};

			res.setHeader("Content-Disposition", `attachment; filename="fintekpro-data-export-${userId}.json"`);
			res.setHeader("Content-Type", "application/json");
			res.send(JSON.stringify(exportPayload, null, 2));
		} catch (error) {
			logger.error("[Privacy API] Export error", { error: (error as any)?.message || error });
			res.status(500).json({ success: false, error: "Failed to generate personal data export" });
		}
	});

	// DPDP Act 2023 Section 12: Right to Correction & Erasure (With PMLA/SEBI Retention Hold)
	app.post("/api/privacy/request-erasure", async (req, res) => {
		try {
			const userId = (req as any).user?.id;
			const { reason } = req.body;
			const ipAddress = req.ip || req.connection.remoteAddress || "";
			const userAgent = req.get("User-Agent") || "";

			if (!userId) {
				res.status(401).json({ success: false, error: "Authentication required" });
				return;
			}

			// Record erasure request into audit trail
			complianceMonitor.logEvent({
				userId,
				eventType: "delete_data",
				action: "DPDP Section 12 Erasure Requested",
				ipAddress,
				userAgent,
				outcome: "success",
				riskLevel: "medium",
				details: { reason, timestamp: new Date().toISOString() },
			});

			try {
				const { consentAuditService } = await import("../services/consent-audit-service");
				await consentAuditService.recordConsent({
					userId,
					sessionId: `session-${Date.now()}`,
					consentType: "dpdp_data_consent",
					action: "withdrawn",
					sourceScreen: "settings_privacy",
					sourceComponent: "DataPrivacyDpdpCard",
					ipAddress,
					userAgent,
					consentText: "User requested personal data erasure under DPDP Act 2023 Section 12",
					additionalData: { reason },
				});
			} catch (auditErr) {
				logger.error("[Privacy API] Audit logging error", { error: (auditErr as any)?.message || auditErr });
			}

			res.json({
				success: true,
				message: "Data erasure request registered. Non-statutory marketing and personalized processing have been revoked. As required under SEBI Master Circular and PMLA 2002, statutory financial transaction records, KYC logs, and tax filings will remain securely preserved in encrypted cold storage for the mandatory 7-year retention period before final purging.",
				retentionHoldApplied: true,
				statutoryRegulations: ["SEBI Master Circular for Intermediaries", "Prevention of Money Laundering Act (PMLA) 2002 Rule 3", "Income Tax Act 1961 Section 149"],
			});
		} catch (error) {
			logger.error("[Privacy API] Erasure request error", { error: (error as any)?.message || error });
			res.status(500).json({ success: false, error: "Failed to process erasure request" });
		}
	});

	// Authentication endpoints are now handled by auth-setup.ts
	// Old local auth routes removed - using Replit Auth instead

	// Seed products endpoint
}
