import { logger } from "../../logger";
import { db } from "../../db";
import { users } from "@shared/schema";
import { eq } from "drizzle-orm";

export type Role = "USER" | "AGENT" | "ADMIN";

export enum Action {
	VIEW_PORTFOLIO = "VIEW_PORTFOLIO",
	EXECUTE_TRADE = "EXECUTE_TRADE",
	APPROVE_KYC = "APPROVE_KYC",
	MANAGE_AGENTS = "MANAGE_AGENTS",
	VIEW_COMMISSION = "VIEW_COMMISSION",
	OVERRIDE_RISK = "OVERRIDE_RISK",
}

export class RbacEngine {
	// Define base policies
	private policies: Record<Role, Action[]> = {
		USER: [Action.VIEW_PORTFOLIO, Action.EXECUTE_TRADE],
		AGENT: [Action.VIEW_PORTFOLIO, Action.VIEW_COMMISSION],
		ADMIN: [
			Action.VIEW_PORTFOLIO,
			Action.EXECUTE_TRADE,
			Action.APPROVE_KYC,
			Action.MANAGE_AGENTS,
			Action.VIEW_COMMISSION,
			Action.OVERRIDE_RISK,
		],
	};

	/**
	 * Checks if a user has permission to perform an action
	 */
	async checkPermission(userId: string, action: Action): Promise<boolean> {
		try {
			const [user] = await db
				.select()
				.from(users)
				.where(eq(users.id, userId))
				.limit(1);

			if (!user) {
				logger.warn(`[RBAC] User ${userId} not found during permission check`);
				return false;
			}

			// If user has a role column, use it. For now, we simulate role from user data.
			// Default to USER if no role specified.
			const role: Role = (user.role as Role) || "USER";

			const allowedActions = this.policies[role];
			const hasPermission = allowedActions.includes(action);

			if (!hasPermission) {
				logger.warn(
					`[RBAC] Access denied: User ${userId} (${role}) attempted ${action}`,
				);
			}

			return hasPermission;
		} catch (error: any) {
			logger.error(`[RBAC] Error checking permissions`, {
				error: error.message,
			});
			return false; // Secure by default
		}
	}

	/**
	 * For Express middleware
	 */
	requirePermission(action: Action) {
		return async (req: any, res: any, next: any) => {
			const userId = req.user?.id;
			if (!userId) {
				return res.status(401).json({ message: "Unauthorized" });
			}

			const hasPermission = await this.checkPermission(userId, action);
			if (hasPermission) {
				next();
			} else {
				res.status(403).json({ message: "Forbidden" });
			}
		};
	}
}

export const rbacEngine = new RbacEngine();
