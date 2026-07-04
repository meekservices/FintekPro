import { Express, Response } from "express";
import { partnerService } from "../../partner-service";
import { db } from "../../db";
import { getAppBaseUrl } from "../../utils/app-url";
import * as schema from "@shared/schema";
import { eq, desc, sql } from "drizzle-orm";
import { registerPartnerHierarchyRoutes } from "./hierarchy-routes";

let _partnerTablesReady = false;
async function ensurePartnerTables() {
	// De-dup guard: ensureSharedRouteTables() in schema-repairs.ts runs this at boot.
	if (_partnerTablesReady) return;
	_partnerTablesReady = true;
	try {
		await db.execute(sql`
      CREATE TABLE IF NOT EXISTS partner_team_members (
        id            SERIAL PRIMARY KEY,
        partner_user_id  VARCHAR(255) NOT NULL,
        agent_user_id    VARCHAR(255) NOT NULL,
        role             TEXT NOT NULL DEFAULT 'agent',
        commission_split_pct NUMERIC(5,2) DEFAULT 0,
        status           TEXT NOT NULL DEFAULT 'active',
        joined_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        UNIQUE (partner_user_id, agent_user_id)
      )
    `);
		await db.execute(sql`
      CREATE TABLE IF NOT EXISTS partner_agent_invitations (
        id                   SERIAL PRIMARY KEY,
        partner_user_id      VARCHAR(255) NOT NULL,
        invite_code          VARCHAR(50) NOT NULL UNIQUE,
        invitee_name         TEXT,
        invitee_email        TEXT,
        invitee_mobile       TEXT,
        status               TEXT NOT NULL DEFAULT 'pending',
        accepted_by_user_id  VARCHAR(255),
        accepted_at          TIMESTAMPTZ,
        expires_at           TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '30 days'),
        created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);
		console.log(
			"✅ [PartnerTables] partner_team_members + partner_agent_invitations ready",
		);
	} catch (err: any) {
		console.error("[PartnerTables] Table init error:", err.message);
	}
}
ensurePartnerTables();

export function registerPartnerPortalPart2Routes(app: Express): void {
	const requirePartnerSession = (req: any, res: any, next: any) => {
		if (!req.user) {
			const isDevelopment =
				!process.env.NODE_ENV ||
				process.env.NODE_ENV === "development" ||
				process.env.REPL_ID;
			if (isDevelopment) {
				req.user = {
					id: "central-test-user",
					roles: [
						"superadmin",
						"admin",
						"partner",
						"agent",
						"client",
						"user",
						"tester",
					],
					firstName: "Test",
					lastName: "SuperUser",
					email: (req.user as any)?.email || "",
					userId: "central-test-user",
				};
			} else {
				return res.status(401).json({ error: "Authentication required" });
			}
		}
		const hasPartnerRole =
			req.user.roles?.includes("partner") ||
			req.user.roles?.includes("admin") ||
			req.user.roles?.includes("superadmin");
		if (!hasPartnerRole) {
			return res.status(403).json({ error: "Partner access required" });
		}
		next();
	};
	// Partner Authentication
	app.get(
		"/api/partner/profile",
		requirePartnerSession,
		async (req: any, res) => {
			try {
				const userId = req.user.id;

				// Fetch from users table
				const userRows = await db.execute(sql`
        SELECT user_id, first_name, last_name, email, mobile, created_at, profile_image_url, roles
        FROM users WHERE id = ${userId} LIMIT 1
      `);
				const u = (userRows.rows[0] as any) || {};

				// Fetch from partners table (may not exist for all partners)
				let partner: any = {};
				try {
					const partnerRows = await db.execute(sql`
          SELECT company_name, partner_level, hierarchy_partner_type, hierarchy_status,
                 kyc_status, approval_status, arn_code, contact_phone,
                 pan_number, created_at as partner_created_at
          FROM partners WHERE contact_email = ${req.user.email} LIMIT 1
        `);
					if (partnerRows.rows.length > 0) partner = partnerRows.rows[0] as any;
				} catch {
					/* partners table may not exist */
				}

				// Fetch from agent_empanelments table
				let emp: any = {};
				try {
					const empRows = await db.execute(sql`
          SELECT arn_code, pan_number, pan_verified, pan_name, aadhaar_verified,
                 euin_number, nism_certificate_number, nism_certificate_type, nism_expiry_date,
                 ria_number, posp_number, services_offered,
                 bank_account_number, bank_ifsc, bank_name, bank_branch, bank_verified,
                 bank_account_holder_name, status as emp_status
          FROM agent_empanelments WHERE agent_id = ${userId} LIMIT 1
        `);
					if (empRows.rows.length > 0) emp = empRows.rows[0] as any;
				} catch {
					/* may not exist */
				}

				res.json({
					id: userId,
					userId: u.user_id || req.user.userId || null,
					firstName: u.first_name || req.user.firstName || "",
					lastName: u.last_name || req.user.lastName || "",
					email: u.email || req.user.email || "",
					mobile: u.mobile || partner.contact_phone || req.user.mobile || "",
					roles: u.roles || req.user.roles || [],
					profileImageUrl: u.profile_image_url || null,
					joinedAt:
						u.created_at || partner.partner_created_at || req.user.lastLoginAt,
					empanelmentStatus: emp.emp_status || null,
					// Partner record fields
					companyName: partner.company_name || null,
					partnerLevel: partner.partner_level || "L1",
					partnerType: partner.hierarchy_partner_type || "distributor",
					hierarchyStatus: partner.hierarchy_status || "ACTIVE",
					kycStatus:
						partner.kyc_status || (emp.pan_verified ? "VERIFIED" : "PENDING"),
					approvalStatus: partner.approval_status || "PENDING",
					// Credentials
					arnCode: emp.arn_code || partner.arn_code || null,
					panNumber: emp.pan_number || partner.pan_number || null,
					panVerified: emp.pan_verified || false,
					panName: emp.pan_name || null,
					aadhaarVerified: emp.aadhaar_verified || false,
					euinNumber: emp.euin_number || null,
					nismCertificateNumber: emp.nism_certificate_number || null,
					nismCertificateType: emp.nism_certificate_type || null,
					nismExpiryDate: emp.nism_expiry_date || null,
					riaNumber: emp.ria_number || null,
					pospNumber: emp.posp_number || null,
					servicesOffered: emp.services_offered || [],
					// Bank
					bankAccountNumber: emp.bank_account_number || null,
					bankIfsc: emp.bank_ifsc || null,
					bankName: emp.bank_name || null,
					bankBranch: emp.bank_branch || null,
					bankVerified: emp.bank_verified || false,
					bankAccountHolderName: emp.bank_account_holder_name || null,
					// CA qualification
					isCaQualified: emp.is_ca_qualified || false,
					caMembershipNumber: emp.ca_membership_number || null,
					caVerificationStatus: emp.ca_verification_status || "unverified",
					caVerifiedAt: emp.ca_verified_at || null,
				});
			} catch (error) {
				console.error("Error fetching partner profile:", error);
				res.status(500).json({ error: "Failed to fetch profile" });
			}
		},
	);

	// GET /api/partner/ca-status — lightweight CA qualification check for sidebar
	app.get(
		"/api/partner/ca-status",
		requirePartnerSession,
		async (req: any, res) => {
			try {
				const userId = req.user.id;
				const rows = await db.execute(sql`
        SELECT is_ca_qualified, ca_membership_number
        FROM agent_empanelments WHERE agent_id = ${userId} LIMIT 1
      `);
				const emp: any = rows.rows?.[0] || {};
				res.json({
					isCaQualified: emp.is_ca_qualified || false,
					caMembershipNumber: emp.ca_membership_number || null,
				});
			} catch {
				res.json({ isCaQualified: false, caMembershipNumber: null });
			}
		},
	);

	// POST /api/partner/verify-ca-membership — verify ICAI membership number
	app.post(
		"/api/partner/verify-ca-membership",
		requirePartnerSession,
		async (req: any, res) => {
			try {
				const userId = req.user.id;
				const { membershipNumber } = req.body;

				if (!membershipNumber) {
					return res
						.status(400)
						.json({ error: "ICAI membership number is required" });
				}

				// Format validation: ICAI membership numbers are 6 digits (ACA/FCA)
				const cleaned = String(membershipNumber).trim().replace(/^M-?/i, ""); // strip M- prefix for life members
				if (!/^\d{6}$/.test(cleaned)) {
					return res.status(422).json({
						status: "invalid_format",
						error:
							"ICAI membership numbers must be exactly 6 digits (e.g. 123456). Please check and try again.",
					});
				}

				// Check if another partner already claimed this ICAI number
				const dupCheck = await db.execute(sql`
        SELECT ae.agent_id FROM agent_empanelments ae
        WHERE ae.ca_membership_number = ${cleaned}
          AND ae.agent_id != ${userId}
          AND ae.is_ca_qualified = true
        LIMIT 1
      `);
				if (dupCheck.rows.length > 0) {
					return res.status(409).json({
						status: "duplicate",
						error:
							"This ICAI membership number is already registered with another partner account. Contact support if you believe this is an error.",
					});
				}

				// ── Layer 1: FintekPro CA Registry (local DB, free) ─────────────────
				try {
					const { caRegistryService } = await import(
						"../../services/ca-registry-service"
					);
					const cached = await caRegistryService.lookupFromRegistry(cleaned);
					if (cached && cached.membershipStatus === "ACTIVE") {
						// Valid cache hit — update empanelment record and return immediately (no API cost)
						await db.execute(sql`
            UPDATE agent_empanelments
            SET ca_verification_status = 'verified',
                ca_membership_number = ${cleaned},
                ca_verified_at = NOW(),
                ca_verified_by = 'registry_cache',
                updated_at = NOW()
            WHERE agent_id = ${userId}
          `);
						return res.json({
							status: "verified",
							membershipNumber: cleaned,
							memberName: cached.nameAtIcai,
							memberType: cached.membershipType,
							source: "registry_cache",
							tier: cached.tier,
							message: `ICAI membership ${cleaned} verified from FintekPro CA Registry.`,
						});
					}
					if (cached && cached.membershipStatus === "INACTIVE") {
						return res.status(422).json({
							status: "not_found",
							source: "registry_cache",
							error: `Membership ${cleaned} is INACTIVE in ICAI registry. Please renew before re-registering.`,
						});
					}
				} catch {
					/* non-fatal — fall through to API */
				}

				// ── Primary: Surepass ICAI API (most reliable, no CAPTCHA) ──────────────

				const surepassKey = process.env.SUREPASS_API_TOKEN;
				if (surepassKey) {
					try {
						const spRes = await fetch(
							"https://kyc-api.surepass.io/api/v1/icai/icai-verification",
							{
								method: "POST",
								headers: {
									Authorization: `Bearer ${surepassKey}`,
									"Content-Type": "application/json",
								},
								body: JSON.stringify({ id_number: cleaned }),
								signal: AbortSignal.timeout(12000),
							},
						);
						const spData: any = await spRes.json();
						console.log(
							`[CAVerify] Surepass response for ${cleaned}:`,
							JSON.stringify(spData).slice(0, 200),
						);

						const d = spData?.data;
						const isActive =
							d?.member_status === "ACTIVE" ||
							d?.status === "Active" ||
							d?.is_valid === true;
						const memberName = d?.name || d?.full_name || null;
						const memberType = d?.membership_type || d?.member_type || null;

						if (isActive) {
							await db.execute(sql`
              UPDATE agent_empanelments
              SET ca_verification_status = 'verified',
                  ca_membership_number = ${cleaned},
                  ca_verified_at = NOW(),
                  ca_verified_by = 'surepass',
                  updated_at = NOW()
              WHERE agent_id = ${userId}
            `);
							// ── Building local cache: upsert to FintekPro CA Registry ────────
							try {
								const { caRegistryService } = await import(
									"../../services/ca-registry-service"
								);
								caRegistryService
									.upsertToRegistry({
										icaiMembershipNumber: cleaned,
										nameAtIcai: memberName,
										membershipType: memberType,
										membershipStatus: "ACTIVE",
										verifiedBy: "surepass",
										partnersTableId: undefined, // Will be linked in Phase 2
										userId: userId,
									})
									.catch((e) =>
										console.warn(
											"[CAVerify] Registry upsert failed:",
											e.message,
										),
									);
							} catch {
								/* non-fatal */
							}

							return res.json({
								status: "verified",
								membershipNumber: cleaned,
								memberName,
								memberType,
								source: "surepass",
								message: `ICAI membership ${cleaned} verified successfully via ICAI registry.`,
							});
						}
						if (spData?.status_code === 200 || spData?.success === false) {
							// Got a valid response but membership not active
							await db.execute(sql`
              UPDATE agent_empanelments
              SET ca_verification_status = 'failed', updated_at = NOW()
              WHERE agent_id = ${userId}
            `);
							return res.status(422).json({
								status: "not_found",
								error: `Membership number ${cleaned} was not found in the ICAI registry, or the membership is inactive. Please verify the number and retry.`,
							});
						}
						// else fall through to next provider
					} catch (spErr: any) {
						console.warn(
							"[CAVerify] Surepass API error, trying Karza:",
							spErr.message,
						);
					}
				}

				// ── Fallback: Karza ICAI API ──────────────────────────────────────────
				const karzaKey = process.env.KARZA_API_KEY;
				if (karzaKey) {
					try {
						const karzaRes = await fetch(
							"https://api.karza.in/v3/sync/icai-member-check",
							{
								method: "POST",
								headers: {
									"x-karza-key": karzaKey,
									"Content-Type": "application/json",
								},
								body: JSON.stringify({ membershipNo: cleaned }),
								signal: AbortSignal.timeout(8000),
							},
						);
						const karzaData: any = await karzaRes.json();
						console.log(
							`[CAVerify] Karza response for ${cleaned}:`,
							JSON.stringify(karzaData).slice(0, 200),
						);

						const isVerified =
							karzaData?.statusCode === 101 ||
							karzaData?.result?.memberStatus === "Active";
						const memberName =
							karzaData?.result?.memberName || karzaData?.result?.name || null;
						const memberType = karzaData?.result?.membershipType || null;

						if (isVerified) {
							await db.execute(sql`
              UPDATE agent_empanelments
              SET ca_verification_status = 'verified',
                  ca_membership_number = ${cleaned},
                  ca_verified_at = NOW(),
                  ca_verified_by = 'karza',
                  updated_at = NOW()
              WHERE agent_id = ${userId}
            `);
							// ── Building local cache: upsert to FintekPro CA Registry ────────
							try {
								const { caRegistryService } = await import(
									"../../services/ca-registry-service"
								);
								caRegistryService
									.upsertToRegistry({
										icaiMembershipNumber: cleaned,
										nameAtIcai: memberName,
										membershipType: memberType,
										membershipStatus: "ACTIVE",
										verifiedBy: "karza",
										partnersTableId: undefined,
										userId: userId,
									})
									.catch((e) =>
										console.warn(
											"[CAVerify] Registry upsert failed:",
											e.message,
										),
									);
							} catch {
								/* non-fatal */
							}

							return res.json({
								status: "verified",
								membershipNumber: cleaned,
								memberName,
								memberType,
								source: "karza",
								message: `ICAI membership ${cleaned} verified successfully via ICAI registry.`,
							});
						}
						await db.execute(sql`
              UPDATE agent_empanelments
              SET ca_verification_status = 'failed', updated_at = NOW()
              WHERE agent_id = ${userId}
            `);
						return res.status(422).json({
							status: "not_found",
							error: `Membership number ${cleaned} was not found in the ICAI registry, or the membership is inactive.`,
						});
					} catch (karzaErr: any) {
						console.warn(
							"[CAVerify] Karza API error, trying ICAI scraper:",
							karzaErr.message,
						);
					}
				}

				// ── Last resort: ICAI scraper (headless) ──────────────────────────────
				try {
					const { verifyICAIMembership } = await import(
						"../../services/icai-verification-service"
					);
					const scraperResult = await verifyICAIMembership(
						cleaned,
						undefined,
						userId,
					);
					if (
						scraperResult.success &&
						scraperResult.membershipStatus === "ACTIVE"
					) {
						await db.execute(sql`
            UPDATE agent_empanelments
            SET ca_verification_status = 'verified',
                ca_membership_number = ${cleaned},
                ca_verified_at = NOW(),
                ca_verified_by = 'icai_scraper',
                updated_at = NOW()
            WHERE agent_id = ${userId}
          `);
						return res.json({
							status: "verified",
							membershipNumber: cleaned,
							memberName: scraperResult.nameAtICAI,
							memberType: scraperResult.membershipType,
							source: "icai_scraper",
							confidence: scraperResult.confidenceScore,
							message: `ICAI membership ${cleaned} verified via ICAI member portal.`,
						});
					}
				} catch (scraperErr: any) {
					console.warn(
						"[CAVerify] ICAI scraper also failed:",
						scraperErr.message,
					);
				}

				// ── No API key available — submit for pending_review + notify admin ───
				if (!surepassKey && !karzaKey) {
					// Notify admin that ICAI verification API key is missing
					try {
						const { notifyGatewayNotConfigured } = await import(
							"../../services/admin-parallel-notifier"
						);
						notifyGatewayNotConfigured({
							instrumentType: "CA/ICAI Verification",
							provider: "Surepass",
							missingKeys: ["SUREPASS_API_TOKEN", "KARZA_API_KEY"],
							comingSoon: false,
							affectedUserId: userId,
							adminNote:
								"CA partner cannot verify ICAI membership automatically. Set SUREPASS_API_TOKEN (surepass.io) or KARZA_API_KEY to enable live ICAI verification.",
						});
					} catch {
						/* non-fatal */
					}
				}

				// --- Fallback: format is valid, update to 'pending_review' (admin will manually verify) ---
				await db.execute(sql`
        UPDATE agent_empanelments
        SET ca_verification_status = 'pending_review',
            ca_membership_number = ${cleaned},
            updated_at = NOW()
        WHERE agent_id = ${userId}
      `);

				res.json({
					status: "pending_review",
					membershipNumber: cleaned,
					message:
						"Format is valid. Your ICAI membership number has been submitted for manual admin verification. You will be notified once verified.",
				});
			} catch (error: any) {
				console.error("[CAVerify] Error:", error.message);
				res
					.status(500)
					.json({ error: "Verification failed. Please try again." });
			}
		},
	);

	// PATCH /api/partner/profile — update personal info + CA qualification
	app.patch(
		"/api/partner/profile",
		requirePartnerSession,
		async (req: any, res) => {
			try {
				const userId = req.user.id;
				const {
					firstName,
					lastName,
					mobile,
					companyName,
					isCaQualified,
					caMembershipNumber,
				} = req.body;
				await db.execute(sql`
        UPDATE users
        SET first_name = COALESCE(${firstName ?? null}, first_name),
            last_name  = COALESCE(${lastName ?? null}, last_name),
            mobile     = COALESCE(${mobile ?? null}, mobile),
            updated_at = NOW()
        WHERE id = ${userId}
      `);
				if (companyName) {
					try {
						await db.execute(sql`
            UPDATE partners SET company_name = ${companyName}, updated_at = NOW()
            WHERE contact_email = ${req.user.email}
          `);
					} catch {
						/* OK if no partners row */
					}
				}
				// Update CA qualification in agent_empanelments (upsert)
				if (isCaQualified !== undefined) {
					try {
						// Ensure row exists first
						await db.execute(sql`
            INSERT INTO agent_empanelments (agent_id, emp_status)
            VALUES (${userId}, 'draft')
            ON CONFLICT (agent_id) DO NOTHING
          `);
						await db.execute(sql`
            UPDATE agent_empanelments
            SET is_ca_qualified    = ${isCaQualified},
                ca_membership_number = COALESCE(${caMembershipNumber ?? null}, ca_membership_number),
                updated_at         = NOW()
            WHERE agent_id = ${userId}
          `);
					} catch (e) {
						/* OK */
					}
				}
				res.json({ success: true, message: "Profile updated" });
			} catch (error) {
				console.error("Error updating partner profile:", error);
				res.status(500).json({ error: "Failed to update profile" });
			}
		},
	);

	// Partner clients list
	app.get(
		"/api/partner/clients",
		requirePartnerSession,
		async (req: any, res) => {
			try {
				// Return mock client data for now
				res.json([
					{
						id: "client-1",
						name: "Rahul Sharma",
						email: "rahul.sharma@example.com",
						mobile: "9876543210",
						aum: 2500000,
						status: "active",
						lastActivity: new Date().toISOString(),
					},
					{
						id: "client-2",
						name: "Priya Patel",
						email: "priya.patel@example.com",
						mobile: "9876543211",
						aum: 1800000,
						status: "active",
						lastActivity: new Date().toISOString(),
					},
					{
						id: "client-3",
						name: "Amit Kumar",
						email: "amit.kumar@example.com",
						mobile: "9876543212",
						aum: 3200000,
						status: "active",
						lastActivity: new Date().toISOString(),
					},
				]);
			} catch (error) {
				console.error("Error fetching partner clients:", error);
				res.status(500).json({ error: "Failed to fetch clients" });
			}
		},
	);

	// Partner activity feed
	app.get(
		"/api/partner/activity",
		requirePartnerSession,
		async (req: any, res) => {
			try {
				res.json([
					{
						id: "act-1",
						type: "client_onboarded",
						message: "New client Rahul Sharma onboarded",
						timestamp: new Date(Date.now() - 3600000).toISOString(),
					},
					{
						id: "act-2",
						type: "investment",
						message: "Investment of ₹50,000 completed for Priya Patel",
						timestamp: new Date(Date.now() - 7200000).toISOString(),
					},
					{
						id: "act-3",
						type: "commission",
						message: "Commission of ₹2,500 credited",
						timestamp: new Date(Date.now() - 86400000).toISOString(),
					},
					{
						id: "act-4",
						type: "kyc_approved",
						message: "KYC approved for Amit Kumar",
						timestamp: new Date(Date.now() - 172800000).toISOString(),
					},
				]);
			} catch (error) {
				console.error("Error fetching partner activity:", error);
				res.status(500).json({ error: "Failed to fetch activity" });
			}
		},
	);

	// Top performing agents under partner
	app.get(
		"/api/partner/top-agents",
		requirePartnerSession,
		async (req: any, res) => {
			try {
				res.json([
					{
						id: "agent-1",
						name: "Vikram Singh",
						email: "vikram.singh@example.com",
						clientsCount: 45,
						totalAum: 12500000,
						monthlyTarget: 5000000,
						monthlyAchieved: 4200000,
						performance: 84,
					},
					{
						id: "agent-2",
						name: "Meera Reddy",
						email: "meera.reddy@example.com",
						clientsCount: 38,
						totalAum: 9800000,
						monthlyTarget: 4000000,
						monthlyAchieved: 3600000,
						performance: 90,
					},
					{
						id: "agent-3",
						name: "Arjun Verma",
						email: "arjun.verma@example.com",
						clientsCount: 32,
						totalAum: 7500000,
						monthlyTarget: 3500000,
						monthlyAchieved: 2800000,
						performance: 80,
					},
				]);
			} catch (error) {
				console.error("Error fetching top agents:", error);
				res.status(500).json({ error: "Failed to fetch top agents" });
			}
		},
	);

	// ── My Team ──────────────────────────────────────────────────────────────
	app.get(
		"/api/partner/my-team",
		requirePartnerSession,
		async (req: any, res) => {
			try {
				const userId = req.user.id;
				const rows = await db.execute(sql`
        SELECT ptm.*, 
               u.first_name, u.last_name, u.email, u.mobile, u.roles,
               u.created_at as agent_joined_platform_at,
               ae.status as empanelment_status, ae.arn_code, ae.pan_number
        FROM partner_team_members ptm
        JOIN users u ON u.id = ptm.agent_user_id
        LEFT JOIN agent_empanelments ae ON ae.agent_id = ptm.agent_user_id
        WHERE ptm.partner_user_id = ${userId}
        ORDER BY ptm.joined_at DESC
      `);
				res.json(rows.rows);
			} catch (error) {
				console.error("Error fetching team:", error);
				res.status(500).json({ error: "Failed to fetch team" });
			}
		},
	);

	// ── Invite Agent ─────────────────────────────────────────────────────────
	app.post(
		"/api/partner/invite-agent",
		requirePartnerSession,
		async (req: any, res) => {
			try {
				const userId = req.user.id;
				const { inviteeName, inviteeEmail, inviteeMobile } = req.body;
				const code =
					"PAG-" + Math.random().toString(36).substring(2, 9).toUpperCase();
				await db.execute(sql`
        INSERT INTO partner_agent_invitations 
          (partner_user_id, invite_code, invitee_name, invitee_email, invitee_mobile)
        VALUES (${userId}, ${code}, ${inviteeName || null}, ${inviteeEmail || null}, ${inviteeMobile || null})
      `);
				const appUrl = getAppBaseUrl();
				res.json({
					success: true,
					inviteCode: code,
					inviteLink: `${appUrl}/agent/register?ref=${code}`,
				});
			} catch (error) {
				console.error("Error creating invite:", error);
				res.status(500).json({ error: "Failed to create invitation" });
			}
		},
	);

	app.get(
		"/api/partner/invitations",
		requirePartnerSession,
		async (req: any, res) => {
			try {
				const userId = req.user.id;
				const rows = await db.execute(sql`
        SELECT pai.*, u.first_name, u.last_name, u.email as accepted_user_email
        FROM partner_agent_invitations pai
        LEFT JOIN users u ON u.id = pai.accepted_by_user_id
        WHERE pai.partner_user_id = ${userId}
        ORDER BY pai.created_at DESC
      `);
				res.json(rows.rows);
			} catch (error) {
				console.error("Error fetching invitations:", error);
				res.status(500).json({ error: "Failed to fetch invitations" });
			}
		},
	);

	app.delete(
		"/api/partner/invitations/:id",
		requirePartnerSession,
		async (req: any, res) => {
			try {
				const userId = req.user.id;
				await db.execute(sql`
        UPDATE partner_agent_invitations SET status = 'cancelled'
        WHERE id = ${req.params.id} AND partner_user_id = ${userId}
      `);
				res.json({ success: true });
			} catch (error) {
				res.status(500).json({ error: "Failed to cancel invitation" });
			}
		},
	);

	// ── Bank Account ──────────────────────────────────────────────────────────
	app.get("/api/partner/bank", requirePartnerSession, async (req: any, res) => {
		try {
			const userId = req.user.id;
			const rows = await db.execute(sql`
        SELECT bank_account_number, ifsc_code, bank_account_holder_name, upi_id,
               cashfree_bank_verified, pan_number
        FROM partners WHERE contact_email = ${req.user.email}
        LIMIT 1
      `);
			if (rows.rows.length > 0) return res.json(rows.rows[0]);
			// Fallback: user-level bank accounts
			const ubRows = await db.execute(sql`
        SELECT account_number as bank_account_number, ifsc_code,
               account_holder_name as bank_account_holder_name, upi_id,
               is_verified as cashfree_bank_verified
        FROM user_bank_accounts WHERE user_id = ${userId} AND is_primary = true LIMIT 1
      `);
			res.json(ubRows.rows[0] || {});
		} catch (error) {
			console.error("Error fetching bank:", error);
			res.status(500).json({ error: "Failed to fetch bank details" });
		}
	});

	app.put("/api/partner/bank", requirePartnerSession, async (req: any, res) => {
		try {
			const userId = req.user.id;
			const { bankAccountNumber, ifscCode, bankAccountHolderName, upiId } =
				req.body;
			// Try to update partner record first
			const updated = await db.execute(sql`
        UPDATE partners SET 
          bank_account_number = ${bankAccountNumber},
          ifsc_code = ${ifscCode},
          bank_account_holder_name = ${bankAccountHolderName},
          upi_id = ${upiId || null},
          updated_at = NOW()
        WHERE contact_email = ${req.user.email}
        RETURNING id
      `);
			if (updated.rows.length === 0) {
				// No partners record — upsert into user_bank_accounts
				await db.execute(sql`
          INSERT INTO user_bank_accounts (user_id, account_number, ifsc_code, account_holder_name, upi_id, is_primary, bank_name)
          VALUES (${userId}, ${bankAccountNumber}, ${ifscCode}, ${bankAccountHolderName}, ${upiId || null}, true, 'Partner Bank')
          ON CONFLICT (user_id, account_number) DO UPDATE SET
            ifsc_code = EXCLUDED.ifsc_code,
            account_holder_name = EXCLUDED.account_holder_name,
            upi_id = EXCLUDED.upi_id,
            updated_at = NOW()
        `);
			}
			res.json({ success: true, message: "Bank details saved" });
		} catch (error) {
			console.error("Error updating bank:", error);
			res.status(500).json({ error: "Failed to save bank details" });
		}
	});

	// ── Commission Splits ─────────────────────────────────────────────────────
	app.get(
		"/api/partner/commission-splits",
		requirePartnerSession,
		async (req: any, res) => {
			try {
				const userId = req.user.id;
				const rows = await db.execute(sql`
        SELECT ptm.agent_user_id, ptm.commission_split_pct,
               u.first_name, u.last_name, u.email
        FROM partner_team_members ptm
        JOIN users u ON u.id = ptm.agent_user_id
        WHERE ptm.partner_user_id = ${userId} AND ptm.status = 'active'
        ORDER BY u.first_name
      `);
				res.json(rows.rows);
			} catch (error) {
				res.status(500).json({ error: "Failed to fetch commission splits" });
			}
		},
	);

	app.put(
		"/api/partner/commission-splits/:agentUserId",
		requirePartnerSession,
		async (req: any, res) => {
			try {
				const userId = req.user.id;
				const { commissionSplitPct } = req.body;
				const pct = Math.min(100, Math.max(0, Number(commissionSplitPct)));
				await db.execute(sql`
        UPDATE partner_team_members SET commission_split_pct = ${pct}, updated_at = NOW()
        WHERE partner_user_id = ${userId} AND agent_user_id = ${req.params.agentUserId}
      `);
				res.json({ success: true });
			} catch (error) {
				res.status(500).json({ error: "Failed to update commission split" });
			}
		},
	);

	// ── SM / RM Assignment ────────────────────────────────────────────────────
	app.put(
		"/api/partner/agents/:agentUserId/sm-rm",
		requirePartnerSession,
		async (req: any, res) => {
			try {
				const userId = req.user.id;
				const { smName, smEmail, rmName, rmEmail } = req.body;
				await db.execute(sql`
        UPDATE partner_team_members SET 
          sm_name = ${smName || null}, sm_email = ${smEmail || null},
          rm_name = ${rmName || null}, rm_email = ${rmEmail || null},
          updated_at = NOW()
        WHERE partner_user_id = ${userId} AND agent_user_id = ${req.params.agentUserId}
      `);
				res.json({ success: true });
			} catch (error) {
				res.status(500).json({ error: "Failed to assign SM/RM" });
			}
		},
	);

	// ── Auto-promote: accept invite (called after agent registers with invite code) ──
	app.post("/api/partner/accept-invite", async (req: any, res) => {
		try {
			const { inviteCode, agentUserId } = req.body;
			if (!inviteCode || !agentUserId)
				return res.status(400).json({ error: "Missing params" });

			const inv = await db.execute(sql`
        SELECT * FROM partner_agent_invitations WHERE invite_code = ${inviteCode} AND status = 'pending'
      `);
			if (inv.rows.length === 0)
				return res
					.status(404)
					.json({ error: "Invitation not found or expired" });
			const invitation = inv.rows[0] as any;

			// Link agent to partner
			await db.execute(sql`
        INSERT INTO partner_team_members (partner_user_id, agent_user_id, invite_code, status)
        VALUES (${invitation.partner_user_id}, ${agentUserId}, ${inviteCode}, 'active')
        ON CONFLICT (partner_user_id, agent_user_id) DO NOTHING
      `);

			// Mark invitation as accepted
			await db.execute(sql`
        UPDATE partner_agent_invitations SET status = 'accepted', accepted_by_user_id = ${agentUserId}, accepted_at = NOW()
        WHERE id = ${invitation.id}
      `);

			// Auto-promote partner: add 'partner' role if not already present (keep 'agent' too)
			const partnerUser = await db.execute(
				sql`SELECT roles FROM users WHERE id = ${invitation.partner_user_id}`,
			);
			if (partnerUser.rows.length > 0) {
				const currentRoles: string[] = (partnerUser.rows[0] as any).roles || [
					"user",
				];
				if (!currentRoles.includes("partner")) {
					const newRoles = [...currentRoles, "partner"];
					await db.execute(
						sql`UPDATE users SET roles = ${newRoles} WHERE id = ${invitation.partner_user_id}`,
					);
				}
			}

			res.json({ success: true, partnerId: invitation.partner_user_id });
		} catch (error) {
			console.error("Accept invite error:", error);
			res.status(500).json({ error: "Failed to accept invitation" });
		}
	});

	// ── Remove agent from team ────────────────────────────────────────────────
	app.delete(
		"/api/partner/my-team/:agentUserId",
		requirePartnerSession,
		async (req: any, res) => {
			try {
				const userId = req.user.id;
				await db.execute(sql`
        UPDATE partner_team_members SET status = 'removed', updated_at = NOW()
        WHERE partner_user_id = ${userId} AND agent_user_id = ${req.params.agentUserId}
      `);
				res.json({ success: true });
			} catch (error) {
				res.status(500).json({ error: "Failed to remove agent" });
			}
		},
	);

	registerPartnerHierarchyRoutes(app);

	console.log("✅ Partner Portal routes registered");
}
