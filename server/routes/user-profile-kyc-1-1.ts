import { Express } from "express";
import { storage } from "../storage";
import { db } from "../db";
import { eq, and, or, gte, sql, count, inArray } from "drizzle-orm";
import { requireAdmin } from "../middleware/roleMiddleware";

function hasRole(user: any, roles: string[]): boolean {
	const userRoles: string[] = [
		...(Array.isArray(user?.roles) ? user.roles : []),
		...(user?.role ? [user.role] : []),
		...(user?.userRole ? [user.userRole] : []),
	];
	return userRoles.some((r) => roles.includes(r));
}

const requireClientOrHigher = async (req: any, res: any, next: any) => {
	if (!req.user) {
		return res.status(401).json({ message: "Authentication required" });
	}

	if (
		!hasRole(req.user, [
			"user",
			"client",
			"business_client",
			"agent",
			"partner",
			"admin",
			"superadmin",
		])
	) {
		return res.status(403).json({ message: "Client access required" });
	}

	next();
};

export function registerUserProfileKYCPart1Part1Routes(app: Express): void {
	app.get("/api/profile", requireClientOrHigher, async (req, res) => {
		try {
			const userId = req.user!.id;
			const profile = await storage.getUserProfile(userId);

			if (!profile) {
				try {
					const newProfile = await storage.upsertUserProfile({ userId });
					return res.json(newProfile);
				} catch (insertErr: any) {
					// FK violation: user row doesn't exist in `users` table yet (race or orphaned session).
					// Return a minimal stub so the frontend doesn't crash.
					const pgCode = insertErr?.code || insertErr?.cause?.code;
					console.error(
						`[Profile] upsert failed for userId=${userId} pg=${pgCode}:`,
						insertErr?.message || insertErr,
					);
					if (pgCode === "23503") {
						return res.json({
							userId,
							profileCompleteness: 0,
							isProfileCompleted: false,
						});
					}
					throw insertErr; // re-throw anything else
				}
			}

			res.json(profile);
		} catch (error: any) {
			const pgCode = error?.code || error?.cause?.code;
			console.error(
				`[Profile] GET error userId=${(req.user as any)?.id} pg=${pgCode}:`,
				error?.message || error,
			);
			res.status(500).json({ error: "Failed to fetch profile", code: pgCode });
		}
	});

	app.post("/api/profile", requireClientOrHigher, async (req, res) => {
		try {
			const profileData = {
				...req.body,
				userId: req.user!.id, // Use authenticated user ID
			};

			const profile = await storage.upsertUserProfile(profileData);
			res.json(profile);
		} catch (error) {
			console.error("Error updating user profile:", error);
			res.status(500).json({ error: "Failed to update profile" });
		}
	});

	// User profile endpoint for clients - allows self-service profile updates
	app.get("/api/user/profile", requireClientOrHigher, async (req, res) => {
		try {
			const userId = req.user!.id;

			// Get both user info and profile info
			const user = await storage.getUser(userId);
			const profile = await storage.getUserProfile(userId);

			if (!user) {
				return res.status(404).json({ error: "User not found" });
			}

			res.json({
				...user,
				...profile,
				roles: user.roles || ((user as any).role ? [(user as any).role] : []), // Backwards compatibility
			});
		} catch (error) {
			console.error("Error fetching user profile:", error);
			res.status(500).json({ error: "Failed to fetch profile" });
		}
	});

	app.put("/api/user/profile", requireClientOrHigher, async (req, res) => {
		try {
			const userId = req.user!.id;

			// Clients can only update their own profile
			// Higher roles (agent, partner, admin) could potentially edit other profiles
			const profileData = {
				...req.body,
				userId: userId,
			};

			const profile = await storage.upsertUserProfile(profileData);
			res.json(profile);
		} catch (error) {
			console.error("Error updating user profile:", error);
			res.status(500).json({ error: "Failed to update profile" });
		}
	});

	// Communication Preferences - Get user's notification channel preferences
	app.get(
		"/api/user/communication-preferences",
		requireClientOrHigher,
		async (req, res) => {
			try {
				const userId = req.user!.id;
				const { notificationPreferences } = await import("@shared/schema");

				let prefs = await db.query.notificationPreferences.findFirst({
					where: eq(notificationPreferences.userId, userId),
				});

				// Return defaults if no preferences exist
				if (!prefs) {
					prefs = {
						id: "",
						userId,
						emailEnabled: true,
						whatsappEnabled: true,
						smsEnabled: false,
						pushEnabled: true,
						preferredOtpChannels: ["email", "whatsapp", "sms"],
						usOrderFilled: true,
						usOrderCancelled: true,
						usOrderRejected: true,
						usMarketAlerts: true,
						usRebalancingSuggestions: true,
						orderUpdates: true,
						portfolioAlerts: true,
						updatedAt: new Date(),
					};
				}

				res.json({
					success: true,
					preferences: {
						emailEnabled: prefs.emailEnabled,
						whatsappEnabled: prefs.whatsappEnabled,
						smsEnabled: prefs.smsEnabled,
						pushEnabled: prefs.pushEnabled,
						preferredOtpChannels: prefs.preferredOtpChannels || [
							"email",
							"whatsapp",
							"sms",
						],
					},
				});
			} catch (error) {
				console.error("Error fetching communication preferences:", error);
				res
					.status(500)
					.json({ success: false, error: "Failed to fetch preferences" });
			}
		},
	);

	// Communication Preferences - Update user's notification channel preferences
	app.patch(
		"/api/user/communication-preferences",
		requireClientOrHigher,
		async (req, res) => {
			try {
				const userId = req.user!.id;
				const {
					emailEnabled,
					whatsappEnabled,
					smsEnabled,
					pushEnabled,
					preferredOtpChannels,
				} = req.body;
				const { notificationPreferences } = await import("@shared/schema");

				// Validate preferredOtpChannels - only allow valid channel names
				const validChannels = ["email", "whatsapp", "sms"];
				let sanitizedChannels = ["email", "whatsapp", "sms"];
				if (Array.isArray(preferredOtpChannels)) {
					sanitizedChannels = preferredOtpChannels.filter((c) =>
						validChannels.includes(c),
					);
					if (sanitizedChannels.length === 0) {
						sanitizedChannels = ["email", "whatsapp", "sms"];
					}
				}

				// Check if preferences exist
				const existing = await db.query.notificationPreferences.findFirst({
					where: eq(notificationPreferences.userId, userId),
				});

				const updates: any = { updatedAt: new Date() };
				if (typeof emailEnabled === "boolean")
					updates.emailEnabled = emailEnabled;
				if (typeof whatsappEnabled === "boolean")
					updates.whatsappEnabled = whatsappEnabled;
				if (typeof smsEnabled === "boolean") updates.smsEnabled = smsEnabled;
				if (typeof pushEnabled === "boolean") updates.pushEnabled = pushEnabled;
				if (Array.isArray(preferredOtpChannels))
					updates.preferredOtpChannels = sanitizedChannels;

				let prefs;
				if (existing) {
					await db
						.update(notificationPreferences)
						.set(updates)
						.where(eq(notificationPreferences.userId, userId));
					prefs = await db.query.notificationPreferences.findFirst({
						where: eq(notificationPreferences.userId, userId),
					});
				} else {
					const [created] = await db
						.insert(notificationPreferences)
						.values({
							userId,
							emailEnabled: emailEnabled ?? true,
							whatsappEnabled: whatsappEnabled ?? true,
							smsEnabled: smsEnabled ?? false,
							pushEnabled: pushEnabled ?? true,
							preferredOtpChannels: sanitizedChannels,
							usOrderFilled: true,
							usOrderCancelled: true,
							usOrderRejected: true,
							usMarketAlerts: true,
							usRebalancingSuggestions: true,
							orderUpdates: true,
							portfolioAlerts: true,
						})
						.returning();
					prefs = created;
				}

				console.log(`✅ Updated communication preferences for user ${userId}`);

				res.json({
					success: true,
					preferences: {
						emailEnabled: prefs?.emailEnabled,
						whatsappEnabled: prefs?.whatsappEnabled,
						smsEnabled: prefs?.smsEnabled,
						pushEnabled: prefs?.pushEnabled,
						preferredOtpChannels: prefs?.preferredOtpChannels || [
							"email",
							"whatsapp",
							"sms",
						],
					},
					message: "Communication preferences updated successfully",
				});
			} catch (error) {
				console.error("Error updating communication preferences:", error);
				res
					.status(500)
					.json({ success: false, error: "Failed to update preferences" });
			}
		},
	);

	// Advisory Subscription Check endpoint
	app.get(
		"/api/user/advisory-subscription",
		requireClientOrHigher,
		async (req, res) => {
			try {
				const userId = req.user!.id;
				const { advisorySubscriptions } = await import("@shared/schema");
				const { eq, and } = await import("drizzle-orm");

				const activeSubscription = await db
					.select()
					.from(advisorySubscriptions)
					.where(
						and(
							eq(advisorySubscriptions.userId, userId),
							eq(advisorySubscriptions.status, "active"),
						),
					)
					.limit(1);

				const hasAdvisory = activeSubscription.length > 0;
				const subscription = hasAdvisory ? activeSubscription[0] : null;

				res.json({
					success: true,
					hasAdvisorySubscription: hasAdvisory,
					subscription,
					directFundsAccess: hasAdvisory && subscription?.directFundsAccess,
				});
			} catch (error) {
				console.error("Error checking advisory subscription:", error);
				res
					.status(500)
					.json({
						success: false,
						error: "Failed to check advisory subscription",
					});
			}
		},
	);

	// KYC Status endpoint - returns comprehensive KYC info and transaction readiness
	app.get(
		"/api/profile/kyc-status",
		requireClientOrHigher,
		async (req, res) => {
			try {
				const { getKYCStatus } = await import("../rekyc-service");
				const userId = req.user!.id;

				const kycStatus = await getKYCStatus(userId);

				res.json({
					success: true,
					data: kycStatus,
				});
			} catch (error) {
				console.error("Error fetching KYC status:", error);
				res.status(500).json({
					success: false,
					error: "Failed to fetch KYC status",
				});
			}
		},
	);

	// Trigger Re-KYC process
}
