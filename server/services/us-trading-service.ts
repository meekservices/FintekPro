import { db } from "../db";
import {
	usBrokerAccounts,
	usOrders,
	usHoldings,
	usConsents,
	usLrsDeclarations,
	usWatchlist,
	usFeatureFlags,
	UsBrokerAccount,
	UsOrder,
	UsHolding,
	UsConsent,
	UsLrsDeclaration,
	UsWatchlist,
	UsFeatureFlag,
	InsertUsBrokerAccount,
	InsertUsOrder,
	InsertUsHolding,
	InsertUsConsent,
	InsertUsLrsDeclaration,
	InsertUsWatchlist,
	users,
	riskProfiles,
	kycVault,
} from "@shared/schema";
import { eq, and, desc, gte, sql } from "drizzle-orm";
import crypto from "crypto";

const LRS_ANNUAL_LIMIT_USD = 250000;

interface ComplianceCheckResult {
	eligible: boolean;
	checks: {
		femaResident: boolean;
		panVerified: boolean;
		riskProfileComplete: boolean;
		lrsAvailable: boolean;
		lrsRemainingUsd: number;
	};
	blockers: string[];
}

interface FeatureFlagStatus {
	US_TRADING_ENABLED: boolean;
	US_TRADING_ALPACA: boolean;
	US_MARKET_DATA_POLYGON: boolean;
	US_FRACTIONAL_TRADING: boolean;
}

class UsTradingService {
	private getCurrentFinancialYear(): string {
		const now = new Date();
		const year = now.getFullYear();
		const month = now.getMonth() + 1;
		if (month >= 4) {
			return `${year}-${(year + 1).toString().slice(-2)}`;
		}
		return `${year - 1}-${year.toString().slice(-2)}`;
	}

	async getFeatureFlags(): Promise<FeatureFlagStatus> {
		try {
			const flags = await db.select().from(usFeatureFlags);
			const flagMap: Record<string, boolean> = {};
			flags.forEach((f) => {
				flagMap[f.flagName] = f.isEnabled;
			});

			return {
				US_TRADING_ENABLED: flagMap.US_TRADING_ENABLED || false,
				US_TRADING_ALPACA: flagMap.US_TRADING_ALPACA || false,
				US_MARKET_DATA_POLYGON: flagMap.US_MARKET_DATA_POLYGON || false,
				US_FRACTIONAL_TRADING: flagMap.US_FRACTIONAL_TRADING || false,
			};
		} catch (error) {
			console.error("Error fetching feature flags:", error);
			return {
				US_TRADING_ENABLED: false,
				US_TRADING_ALPACA: false,
				US_MARKET_DATA_POLYGON: false,
				US_FRACTIONAL_TRADING: false,
			};
		}
	}

	async initializeFeatureFlags(): Promise<void> {
		const defaultFlags = [
			{
				flagName: "US_TRADING_ENABLED",
				isEnabled: false,
				description: "Master switch for US trading module",
			},
			{
				flagName: "US_TRADING_ALPACA",
				isEnabled: false,
				description: "Enable Alpaca broker integration",
			},
			{
				flagName: "US_MARKET_DATA_POLYGON",
				isEnabled: false,
				description: "Enable Massive (formerly Polygon.io) market data",
			},
			{
				flagName: "US_FRACTIONAL_TRADING",
				isEnabled: false,
				description: "Enable fractional share trading",
			},
		];

		for (const flag of defaultFlags) {
			try {
				await db.insert(usFeatureFlags).values(flag).onConflictDoNothing();
			} catch (error) {
				console.error(`Error initializing flag ${flag.flagName}:`, error);
			}
		}
	}

	async setFeatureFlag(
		flagName: string,
		isEnabled: boolean,
		updatedBy?: string,
	): Promise<boolean> {
		try {
			await db
				.update(usFeatureFlags)
				.set({ isEnabled, updatedAt: new Date(), updatedBy })
				.where(eq(usFeatureFlags.flagName, flagName));
			return true;
		} catch (error) {
			console.error("Error setting feature flag:", error);
			return false;
		}
	}

	async checkCompliance(
		clientId: string,
	): Promise<
		ComplianceCheckResult & { riskProfile?: string; kycComplete?: boolean }
	> {
		const blockers: string[] = [];

		const account = await this.getBrokerAccount(clientId);

		const [userResult] = await db
			.select({
				panNumber: users.panNumber,
				residentStatus: users.residentStatus,
				countryOfResidence: users.countryOfResidence,
				riskTolerance: users.riskTolerance,
				investorCategory: users.investorCategory,
			})
			.from(users)
			.where(eq(users.id, clientId))
			.limit(1);

		const [kycResult] = await db
			.select({
				kycStatus: kycVault.kycStatus,
				panVerifiedAt: kycVault.panVerifiedAt,
			})
			.from(kycVault)
			.where(eq(kycVault.userId, clientId))
			.limit(1);

		const [riskProfileResult] = await db
			.select({
				riskTolerance: riskProfiles.riskTolerance,
				riskScore: riskProfiles.riskScore,
			})
			.from(riskProfiles)
			.where(eq(riskProfiles.userId, clientId))
			.limit(1);

		const panVerified =
			Boolean(kycResult?.panVerifiedAt) || Boolean(userResult?.panNumber);

		const isIndianResident =
			!userResult?.residentStatus ||
			userResult.residentStatus === "resident" ||
			userResult.countryOfResidence === "India" ||
			userResult.countryOfResidence === "IN";
		const femaResident = isIndianResident;

		const riskProfileComplete =
			Boolean(riskProfileResult?.riskTolerance) ||
			Boolean(userResult?.riskTolerance) ||
			Boolean(account?.riskProfileCompleted);

		const kycComplete =
			kycResult?.kycStatus === "verified" || Boolean(panVerified);

		const fy = this.getCurrentFinancialYear();
		const lrsUsed = account?.lrsUsedUsd
			? Number.parseFloat(account.lrsUsedUsd)
			: 0;
		const lrsRemainingUsd = LRS_ANNUAL_LIMIT_USD - lrsUsed;
		const lrsAvailable = lrsRemainingUsd > 0;

		if (!femaResident)
			blockers.push(
				"FEMA residency status not verified - must be Indian resident",
			);
		if (!panVerified) blockers.push("PAN verification required");
		if (!riskProfileComplete)
			blockers.push("Complete your risk profile assessment");
		if (!lrsAvailable)
			blockers.push(
				"LRS limit of $250,000 exhausted for current financial year",
			);

		return {
			eligible: blockers.length === 0,
			checks: {
				femaResident,
				panVerified,
				riskProfileComplete,
				lrsAvailable,
				lrsRemainingUsd,
			},
			blockers,
			riskProfile:
				riskProfileResult?.riskTolerance ||
				userResult?.riskTolerance ||
				"Not assessed",
			kycComplete,
		};
	}

	async getBrokerAccount(clientId: string): Promise<UsBrokerAccount | null> {
		const accounts = await db
			.select()
			.from(usBrokerAccounts)
			.where(eq(usBrokerAccounts.clientId, clientId))
			.limit(1);
		return accounts[0] || null;
	}

	async createBrokerAccount(
		data: InsertUsBrokerAccount,
	): Promise<UsBrokerAccount> {
		const fy = this.getCurrentFinancialYear();
		const [account] = await db
			.insert(usBrokerAccounts)
			.values({ ...data, lrsFinancialYear: fy })
			.returning();
		return account;
	}

	async updateBrokerAccount(
		clientId: string,
		updates: Partial<UsBrokerAccount>,
	): Promise<UsBrokerAccount | null> {
		const [updated] = await db
			.update(usBrokerAccounts)
			.set({ ...updates, updatedAt: new Date() })
			.where(eq(usBrokerAccounts.clientId, clientId))
			.returning();
		return updated || null;
	}

	async getOrders(clientId: string, limit = 50): Promise<UsOrder[]> {
		return db
			.select()
			.from(usOrders)
			.where(eq(usOrders.clientId, clientId))
			.orderBy(desc(usOrders.createdAt))
			.limit(limit);
	}

	async getOrderById(orderId: string): Promise<UsOrder | null> {
		const orders = await db
			.select()
			.from(usOrders)
			.where(eq(usOrders.id, orderId))
			.limit(1);
		return orders[0] || null;
	}

	async createOrder(data: InsertUsOrder): Promise<UsOrder> {
		const [order] = await db.insert(usOrders).values(data).returning();
		return order;
	}

	async updateOrderStatus(
		orderId: string,
		status: string,
		updates?: Partial<UsOrder>,
	): Promise<UsOrder | null> {
		const [updated] = await db
			.update(usOrders)
			.set({ status, ...updates, updatedAt: new Date() })
			.where(eq(usOrders.id, orderId))
			.returning();
		return updated || null;
	}

	async getHoldings(clientId: string): Promise<UsHolding[]> {
		return db
			.select()
			.from(usHoldings)
			.where(eq(usHoldings.clientId, clientId));
	}

	async upsertHolding(
		clientId: string,
		symbol: string,
		data: Partial<InsertUsHolding>,
	): Promise<UsHolding> {
		const existing = await db
			.select()
			.from(usHoldings)
			.where(
				and(eq(usHoldings.clientId, clientId), eq(usHoldings.symbol, symbol)),
			)
			.limit(1);

		if (existing[0]) {
			const [updated] = await db
				.update(usHoldings)
				.set({ ...data, updatedAt: new Date() })
				.where(eq(usHoldings.id, existing[0].id))
				.returning();
			return updated;
		}
		const [created] = await db
			.insert(usHoldings)
			.values({ clientId, symbol, ...data } as InsertUsHolding)
			.returning();
		return created;
	}

	generateConsentHash(data: object): string {
		const payload = JSON.stringify(data);
		return crypto.createHash("sha256").update(payload).digest("hex");
	}

	async recordConsent(data: InsertUsConsent): Promise<UsConsent> {
		const [consent] = await db.insert(usConsents).values(data).returning();
		return consent;
	}

	async getConsentsForOrder(orderId: string): Promise<UsConsent[]> {
		return db.select().from(usConsents).where(eq(usConsents.orderId, orderId));
	}

	async getLrsUsage(
		clientId: string,
		financialYear?: string,
	): Promise<{
		used: number;
		remaining: number;
		declarations: UsLrsDeclaration[];
	}> {
		const fy = financialYear || this.getCurrentFinancialYear();

		const declarations = await db
			.select()
			.from(usLrsDeclarations)
			.where(
				and(
					eq(usLrsDeclarations.clientId, clientId),
					eq(usLrsDeclarations.financialYear, fy),
				),
			);

		const used = declarations.reduce(
			(sum, d) => sum + Number.parseFloat(d.amountUsd),
			0,
		);

		return {
			used,
			remaining: LRS_ANNUAL_LIMIT_USD - used,
			declarations,
		};
	}

	async recordLrsDeclaration(
		data: InsertUsLrsDeclaration,
	): Promise<UsLrsDeclaration> {
		const declarationHash = this.generateConsentHash({
			clientId: data.clientId,
			financialYear: data.financialYear,
			amountUsd: data.amountUsd,
			timestamp: new Date().toISOString(),
		});

		const [declaration] = await db
			.insert(usLrsDeclarations)
			.values({ ...data, declarationHash })
			.returning();

		await db
			.update(usBrokerAccounts)
			.set({
				lrsUsedUsd: sql`COALESCE(${usBrokerAccounts.lrsUsedUsd}, 0) + ${data.amountUsd}`,
				lrsFinancialYear: data.financialYear,
			})
			.where(eq(usBrokerAccounts.clientId, data.clientId));

		return declaration;
	}

	async getWatchlist(clientId: string): Promise<UsWatchlist[]> {
		return db
			.select()
			.from(usWatchlist)
			.where(eq(usWatchlist.clientId, clientId))
			.orderBy(desc(usWatchlist.addedAt));
	}

	async addToWatchlist(data: InsertUsWatchlist): Promise<UsWatchlist> {
		const [item] = await db.insert(usWatchlist).values(data).returning();
		return item;
	}

	async removeFromWatchlist(
		clientId: string,
		symbol: string,
	): Promise<boolean> {
		const result = await db
			.delete(usWatchlist)
			.where(
				and(eq(usWatchlist.clientId, clientId), eq(usWatchlist.symbol, symbol)),
			);
		return true;
	}
}

export const usTradingService = new UsTradingService();
