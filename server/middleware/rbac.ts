import { Request, Response, NextFunction } from "express";
import { db } from "../db";
import { usBrokerAccounts, users } from "@shared/schema";
import { eq, and } from "drizzle-orm";
import { apiResponse } from "../utils/responses";

/**
 * Middleware to ensure that the authenticated user has access to a specific Alpaca account.
 *
 * Access rules:
 * 1. Admin/Superadmin: Can access any account.
 * 2. Agent: Can access accounts of clients assigned to them.
 * 3. Client: Can access only their own account.
 */
export const alpacaAccountGuard = async (
	req: Request,
	res: Response,
	next: NextFunction,
) => {
	const accountId =
		req.params.accountId ||
		(req.query.accountId as string) ||
		(req.query.account_id as string);
	const user = (req as any).user;

	if (!user) {
		return apiResponse.unauthorized(res);
	}

	// 1. Admin/Superadmin access
	if (user.roles?.some((r: string) => ["admin", "superadmin"].includes(r))) {
		return next();
	}

	if (!accountId) {
		return next(); // No accountId to check
	}

	try {
		// Find the broker account to get the owner (clientId)
		const [brokerAccount] = await db
			.select()
			.from(usBrokerAccounts)
			.where(eq(usBrokerAccounts.alpacaAccountId, accountId))
			.limit(1);

		if (!brokerAccount) {
			// If we can't find it by alpacaAccountId, check if it's our internal ID
			const [brokerAccountById] = await db
				.select()
				.from(usBrokerAccounts)
				.where(eq(usBrokerAccounts.id, accountId))
				.limit(1);

			if (!brokerAccountById) {
				return apiResponse.notFound(res, "Broker account not found");
			}

			return checkAccess(user, brokerAccountById.clientId, res, next);
		}

		return checkAccess(user, brokerAccount.clientId, res, next);
	} catch (error) {
		console.error("Error in alpacaAccountGuard:", error);
		return apiResponse.serverError(res);
	}
};

async function checkAccess(
	user: any,
	clientId: string,
	res: Response,
	next: NextFunction,
) {
	// 3. Client access (own account)
	if (user.id === clientId) {
		return next();
	}

	// 2. Agent access (assigned client)
	if (user.roles?.includes("agent")) {
		const [client] = await db
			.select({ agentId: users.agentId })
			.from(users)
			.where(eq(users.id, clientId))
			.limit(1);

		if (client?.agentId === user.id) {
			return next();
		}

		// Fallback: check client_agent_relationships table if agentId on users is not set
		// (Though agentId on users is the primary way in this codebase)
	}

	return apiResponse.forbidden(
		res,
		"You do not have permission to access this Alpaca account",
	);
}
