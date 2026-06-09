import cron from "node-cron";
import { db } from "./db";
import { kycVerificationSessions } from "@shared/schema";
import { lt } from "drizzle-orm";

export function initSessionCleanupCron() {
	cron.schedule("0 */6 * * *", async () => {
		try {
			console.log("[SESSION-CLEANUP] Starting expired session cleanup...");

			const now = new Date();

			const result = await db
				.update(kycVerificationSessions)
				.set({ isActive: false })
				.where(lt(kycVerificationSessions.expiresAt, now));

			console.log(
				`[SESSION-CLEANUP] Deactivated expired sessions at ${now.toISOString()}`,
			);
		} catch (error) {
			console.error("[SESSION-CLEANUP] Error cleaning up sessions:", error);
		}
	});

	console.log("✅ Session cleanup cron job initialized (runs every 6 hours)");
}
