/**
 * client-resolver.ts — Resolves a clientId to prospect or registered user context.
 *
 * Purpose: Unified client resolution across all AI investment route files.
 *          Previously duplicated verbatim in 4 route files (H-14 fix).
 * Inputs:  clientId — string ID that may belong to a prospectClient or a registered user
 * Outputs: ClientContext object with Drizzle where-clause and portfolio create helper
 * Edge cases: clientId matches neither → isProspect=false, isUser=false (treated as user path)
 */
import { db } from "../db";
import { users, portfolios, prospectClients } from "@shared/schema";
import { eq } from "drizzle-orm";

export interface ClientContext {
	isProspect: boolean;
	isUser: boolean;
	prospect: any | null;
	user: any | null;
	portfolioWhereClause: ReturnType<typeof eq>;
	getPortfolioCreateValues: (name: string, source?: string) => any;
}

/**
 * Resolves a clientId to its prospect or user context, providing a unified
 * interface for portfolio operations that work for both client types.
 *
 * @param clientId - The ID to resolve (may be a prospectClient.id or users.id)
 * @returns ClientContext with type flags, entity refs, and Drizzle helpers
 */
export async function resolveClientType(clientId: string): Promise<ClientContext> {
	const [prospect] = await db
		.select()
		.from(prospectClients)
		.where(eq(prospectClients.id, clientId))
		.limit(1);

	const [user] = await db
		.select()
		.from(users)
		.where(eq(users.id, clientId))
		.limit(1);

	const isProspect = !!prospect;
	const isUser = !!user;

	return {
		isProspect,
		isUser,
		prospect,
		user,
		portfolioWhereClause: isProspect
			? eq(portfolios.prospectId, clientId)
			: eq(portfolios.userId, clientId),
		getPortfolioCreateValues: (name: string, source?: string) =>
			isProspect
				? {
						prospectId: clientId,
						name: `${prospect?.name || "Prospect"}'s ${name}`,
						isDefault: true,
						source: (source as any) || "manual",
						isVerified: false,
					}
				: {
						userId: clientId,
						name,
						isDefault: true,
					},
	};
}

