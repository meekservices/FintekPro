/**
 * Unlisted Marketplace Regulatory Compliance Service
 *
 * Implements SEBI/RBI/Companies Act compliance for unlisted share trading:
 * - 200 Investor Limit per company per FY (Section 42, Companies Act 2013)
 * - 6-Month Lock-In Period for private placements
 * - MCA Status Monitoring (auto-suspend when listed)
 * - STR Red Flag Detection for FIU-IND reporting
 * - Source of Funds verification for high-value trades
 */

import { db } from "../db";
import {
	unlistedInvestorTracking,
	unlistedShareLockIn,
	unlistedCompanyStatusLog,
	unlistedSTRFlags,
	unlistedCompanies,
	unlistedDeals,
	users,
	type InsertUnlistedInvestorTracking,
	type InsertUnlistedShareLockIn,
	type InsertUnlistedCompanyStatusLog,
	type InsertUnlistedSTRFlags,
} from "@shared/schema";
import { eq, and, gte, lte, sql, count, desc } from "drizzle-orm";
import { mcaService } from "./mca-service";

// Constants for regulatory limits
const MAX_INVESTORS_PER_FY = 200; // Companies Act Section 42(2)
const LOCK_IN_PERIOD_MONTHS = 6; // Private placement lock-in
const HIGH_VALUE_THRESHOLD = 5000000; // ₹50 lakhs - requires source of funds verification
const STR_DUE_DAYS = 7; // Working days to file STR with FIU-IND

// Get current financial year (April to March)
function getCurrentFinancialYear(): string {
	const now = new Date();
	const month = now.getMonth();
	const year = now.getFullYear();

	if (month >= 3) {
		// April onwards
		return `FY${year}-${(year + 1).toString().slice(-2)}`;
	}
	return `FY${year - 1}-${year.toString().slice(-2)}`;
}

// Calculate lock-in end date (6 months from acquisition)
function calculateLockInEndDate(acquisitionDate: Date): Date {
	const endDate = new Date(acquisitionDate);
	endDate.setMonth(endDate.getMonth() + LOCK_IN_PERIOD_MONTHS);
	return endDate;
}

class UnlistedRegulatoryComplianceService {
	// ==================== 200 INVESTOR LIMIT ====================

	/**
	 * Check if adding a new investor would exceed the 200 limit
	 */
	async checkInvestorLimit(
		companyId: string,
		userId: string,
	): Promise<{
		allowed: boolean;
		currentCount: number;
		maxAllowed: number;
		isExistingInvestor: boolean;
		reason?: string;
	}> {
		const fy = getCurrentFinancialYear();

		// Check if user is already an investor this FY
		const existingRecord = await db.query.unlistedInvestorTracking.findFirst({
			where: and(
				eq(unlistedInvestorTracking.companyId, companyId),
				eq(unlistedInvestorTracking.financialYear, fy),
				eq(unlistedInvestorTracking.userId, userId),
			),
		});

		if (existingRecord) {
			return {
				allowed: true,
				currentCount: 0, // Not needed for existing investor
				maxAllowed: MAX_INVESTORS_PER_FY,
				isExistingInvestor: true,
			};
		}

		// Count unique investors for this company this FY
		const [result] = await db
			.select({ count: count() })
			.from(unlistedInvestorTracking)
			.where(
				and(
					eq(unlistedInvestorTracking.companyId, companyId),
					eq(unlistedInvestorTracking.financialYear, fy),
				),
			);

		const currentCount = result?.count || 0;

		if (currentCount >= MAX_INVESTORS_PER_FY) {
			return {
				allowed: false,
				currentCount,
				maxAllowed: MAX_INVESTORS_PER_FY,
				isExistingInvestor: false,
				reason: `Company has reached maximum ${MAX_INVESTORS_PER_FY} investors for ${fy} as per Companies Act Section 42(2). Additional investors would trigger public issue requirements.`,
			};
		}

		return {
			allowed: true,
			currentCount,
			maxAllowed: MAX_INVESTORS_PER_FY,
			isExistingInvestor: false,
		};
	}

	/**
	 * Record a new investor transaction
	 */
	async recordInvestorTransaction(data: {
		companyId: string;
		userId: string;
		userPan?: string;
		investmentValue: number;
		sharesAcquired: number;
		isPrivatePlacement?: boolean;
	}): Promise<{ success: boolean; recordId?: string; error?: string }> {
		try {
			const fy = getCurrentFinancialYear();
			const now = new Date();

			// Check limit first
			const limitCheck = await this.checkInvestorLimit(
				data.companyId,
				data.userId,
			);
			if (!limitCheck.allowed) {
				return { success: false, error: limitCheck.reason };
			}

			if (limitCheck.isExistingInvestor) {
				// Update existing record
				await db
					.update(unlistedInvestorTracking)
					.set({
						lastTransactionDate: now,
						totalInvestmentValue: sql`${unlistedInvestorTracking.totalInvestmentValue} + ${data.investmentValue}`,
						totalSharesAcquired: sql`${unlistedInvestorTracking.totalSharesAcquired} + ${data.sharesAcquired}`,
						updatedAt: now,
					})
					.where(
						and(
							eq(unlistedInvestorTracking.companyId, data.companyId),
							eq(unlistedInvestorTracking.financialYear, fy),
							eq(unlistedInvestorTracking.userId, data.userId),
						),
					);

				return { success: true };
			}

			// Create new investor record
			const insertData: InsertUnlistedInvestorTracking = {
				companyId: data.companyId,
				financialYear: fy,
				userId: data.userId,
				userPan: data.userPan,
				firstTransactionDate: now,
				lastTransactionDate: now,
				totalInvestmentValue: data.investmentValue.toString(),
				totalSharesAcquired: data.sharesAcquired,
				isPrivatePlacement: data.isPrivatePlacement || false,
				sourceOfFundsVerified: data.investmentValue < HIGH_VALUE_THRESHOLD,
			};

			const [record] = await db
				.insert(unlistedInvestorTracking)
				.values(insertData)
				.returning({ id: unlistedInvestorTracking.id });

			return { success: true, recordId: record.id };
		} catch (error: any) {
			console.error("[RegCompliance] Error recording investor:", error);
			return { success: false, error: error.message };
		}
	}

	/**
	 * Get investor count for a company this FY
	 */
	async getInvestorCount(companyId: string): Promise<{
		financialYear: string;
		currentCount: number;
		maxAllowed: number;
		utilizationPercent: number;
		isNearLimit: boolean;
	}> {
		const fy = getCurrentFinancialYear();

		const [result] = await db
			.select({ count: count() })
			.from(unlistedInvestorTracking)
			.where(
				and(
					eq(unlistedInvestorTracking.companyId, companyId),
					eq(unlistedInvestorTracking.financialYear, fy),
				),
			);

		const currentCount = result?.count || 0;
		const utilizationPercent = (currentCount / MAX_INVESTORS_PER_FY) * 100;

		return {
			financialYear: fy,
			currentCount,
			maxAllowed: MAX_INVESTORS_PER_FY,
			utilizationPercent: Math.round(utilizationPercent * 10) / 10,
			isNearLimit: currentCount >= 180, // 90% threshold
		};
	}

	// ==================== 6-MONTH LOCK-IN ====================

	/**
	 * Check if shares can be sold (not in lock-in period)
	 */
	async checkLockInStatus(
		companyId: string,
		userId: string,
		sharesToSell: number,
	): Promise<{
		canSell: boolean;
		availableShares: number;
		lockedShares: number;
		nextUnlockDate?: Date;
		reason?: string;
	}> {
		const now = new Date();

		// Get all active lock-in records for this user and company
		const lockInRecords = await db
			.select()
			.from(unlistedShareLockIn)
			.where(
				and(
					eq(unlistedShareLockIn.companyId, companyId),
					eq(unlistedShareLockIn.userId, userId),
					eq(unlistedShareLockIn.isActive, true),
				),
			)
			.orderBy(unlistedShareLockIn.lockInEndDate);

		let lockedShares = 0;
		let availableShares = 0;
		let nextUnlockDate: Date | undefined;

		for (const record of lockInRecords) {
			if (new Date(record.lockInEndDate) > now) {
				lockedShares += record.sharesRemaining;
				if (!nextUnlockDate) {
					nextUnlockDate = new Date(record.lockInEndDate);
				}
			} else {
				availableShares += record.sharesRemaining;
			}
		}

		if (sharesToSell > availableShares) {
			return {
				canSell: false,
				availableShares,
				lockedShares,
				nextUnlockDate,
				reason: `Cannot sell ${sharesToSell} shares. Only ${availableShares} shares are available. ${lockedShares} shares are locked until ${nextUnlockDate?.toLocaleDateString() || "unknown"} (6-month private placement lock-in period).`,
			};
		}

		return {
			canSell: true,
			availableShares,
			lockedShares,
			nextUnlockDate,
		};
	}

	/**
	 * Record shares acquired with lock-in period
	 */
	async recordShareAcquisition(data: {
		companyId: string;
		userId: string;
		sharesAcquired: number;
		acquisitionPrice: number;
		acquisitionType: "private_placement" | "secondary_transfer";
		transactionId?: string;
	}): Promise<{ success: boolean; lockInEndDate?: Date; error?: string }> {
		try {
			const now = new Date();

			// Only private placements have lock-in
			if (data.acquisitionType !== "private_placement") {
				return { success: true };
			}

			const lockInEndDate = calculateLockInEndDate(now);

			const insertData: InsertUnlistedShareLockIn = {
				companyId: data.companyId,
				userId: data.userId,
				acquisitionDate: now,
				lockInEndDate: lockInEndDate,
				sharesLocked: data.sharesAcquired,
				sharesRemaining: data.sharesAcquired,
				acquisitionType: data.acquisitionType,
				acquisitionPrice: data.acquisitionPrice.toString(),
				transactionId: data.transactionId,
				isActive: true,
			};

			await db.insert(unlistedShareLockIn).values(insertData);

			console.log(
				`[RegCompliance] Recorded lock-in for ${data.sharesAcquired} shares until ${lockInEndDate.toISOString()}`,
			);

			return { success: true, lockInEndDate };
		} catch (error: any) {
			console.error("[RegCompliance] Error recording lock-in:", error);
			return { success: false, error: error.message };
		}
	}

	// ==================== MCA STATUS MONITORING ====================

	/**
	 * Check company listing status from MCA
	 */
	async checkCompanyListingStatus(companyId: string): Promise<{
		isListed: boolean;
		status: string;
		source: string;
		listingDate?: Date;
		exchangeSymbol?: string;
		exchangeName?: string;
	}> {
		try {
			const company = await db.query.unlistedCompanies.findFirst({
				where: eq(unlistedCompanies.id, companyId),
			});

			if (!company || !company.cin) {
				return { isListed: false, status: "unknown", source: "internal" };
			}

			const mcaDataRaw = await mcaService.getCompanyByCIN(company.cin);
			const mcaData = mcaDataRaw as any;

			if (!mcaData) {
				return {
					isListed: false,
					status: company.status || "unknown",
					source: "cached",
				};
			}

			const statusLower = mcaData.status?.toLowerCase() || "";
			const isListed =
				statusLower.includes("listed") ||
				mcaData.listedStatus === "listed" ||
				mcaData.exchangeListing !== undefined;

			return {
				isListed,
				status: mcaData.status || "unknown",
				source: "mca",
				listingDate: mcaData.listingDate
					? new Date(mcaData.listingDate)
					: undefined,
			};
		} catch (error: any) {
			console.error("[RegCompliance] Error checking listing status:", error);
			return { isListed: false, status: "error", source: "error" };
		}
	}

	/**
	 * Handle company listing status change
	 * Auto-suspends P2P trading and routes to exchange
	 */
	async handleListingStatusChange(
		companyId: string,
		data: {
			newStatus: string;
			listingDate?: Date;
			exchangeSymbol?: string;
			exchangeName?: string;
			adminUserId?: string;
		},
	): Promise<{ success: boolean; suspended: boolean; error?: string }> {
		try {
			// Get current company data
			const company = await db.query.unlistedCompanies.findFirst({
				where: eq(unlistedCompanies.id, companyId),
			});

			if (!company) {
				return { success: false, suspended: false, error: "Company not found" };
			}

			const now = new Date();
			const isNowListed = data.newStatus.toLowerCase().includes("listed");

			// Log the status change
			const logData: InsertUnlistedCompanyStatusLog = {
				companyId,
				previousStatus: company.status || "unlisted",
				newStatus: data.newStatus,
				statusSource: "mca",
				listingDate: data.listingDate,
				exchangeSymbol: data.exchangeSymbol,
				exchangeName: data.exchangeName,
				tradingSuspendedAt: isNowListed ? now : undefined,
				suspensionReason: isNowListed
					? "Company is now listed. P2P trading disabled. Use exchange for transactions."
					: undefined,
				adminUserId: data.adminUserId,
			};

			await db.insert(unlistedCompanyStatusLog).values(logData);

			// Suspend P2P trading if now listed
			if (isNowListed) {
				await db
					.update(unlistedCompanies)
					.set({
						status: "listed",
						...({ tradingEnabled: false } as any),
						updatedAt: now,
					} as any)
					.where(eq(unlistedCompanies.id, companyId));

				console.log(
					`[RegCompliance] Suspended P2P trading for ${company.name} - now listed on ${data.exchangeName || "exchange"}`,
				);
			}

			return { success: true, suspended: isNowListed };
		} catch (error: any) {
			console.error("[RegCompliance] Error handling status change:", error);
			return { success: false, suspended: false, error: error.message };
		}
	}

	// ==================== STR RED FLAG DETECTION ====================

	/**
	 * Detect suspicious transaction patterns
	 */
	async detectRedFlags(transaction: {
		dealId?: string;
		userId: string;
		companyId: string;
		amount: number;
		transactionType: "buy" | "sell";
	}): Promise<{
		flagged: boolean;
		flags: {
			type: string;
			severity: "low" | "medium" | "high" | "critical";
			reason: string;
		}[];
	}> {
		const flags: {
			type: string;
			severity: "low" | "medium" | "high" | "critical";
			reason: string;
		}[] = [];

		// 1. Large transaction without source of funds verification
		if (transaction.amount >= HIGH_VALUE_THRESHOLD) {
			const investorRecord = await db.query.unlistedInvestorTracking.findFirst({
				where: and(
					eq(unlistedInvestorTracking.userId, transaction.userId),
					eq(unlistedInvestorTracking.companyId, transaction.companyId),
				),
			});

			if (!investorRecord?.sourceOfFundsVerified) {
				flags.push({
					type: "source_of_funds",
					severity: "high",
					reason: `Transaction of ₹${(transaction.amount / 100000).toFixed(2)} lakhs requires source of funds verification`,
				});
			}
		}

		// 2. High frequency trading (more than 5 transactions in 7 days)
		const sevenDaysAgo = new Date();
		sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

		const recentTransactions = await db
			.select({ count: count() })
			.from(unlistedInvestorTracking)
			.where(
				and(
					eq(unlistedInvestorTracking.userId, transaction.userId),
					gte(unlistedInvestorTracking.lastTransactionDate, sevenDaysAgo),
				),
			);

		if ((recentTransactions[0]?.count || 0) > 5) {
			flags.push({
				type: "high_frequency",
				severity: "medium",
				reason: `User has made more than 5 transactions in the last 7 days - unusual trading pattern`,
			});
		}

		// 3. Structured payments (multiple transactions just below threshold)
		if (
			transaction.amount >= HIGH_VALUE_THRESHOLD * 0.8 &&
			transaction.amount < HIGH_VALUE_THRESHOLD
		) {
			flags.push({
				type: "structured_payment",
				severity: "medium",
				reason: `Transaction amount (₹${(transaction.amount / 100000).toFixed(2)} lakhs) is close to but below the ₹50 lakh threshold - possible structuring`,
			});
		}

		return {
			flagged: flags.length > 0,
			flags,
		};
	}

	/**
	 * Record STR flag for FIU-IND reporting
	 */
	async recordSTRFlag(data: {
		dealId?: string;
		userId: string;
		companyId: string;
		flagType: string;
		severity: "low" | "medium" | "high" | "critical";
		transactionAmount: number;
		flagReason: string;
		detectionMethod?: string;
		relatedTransactions?: string[];
	}): Promise<{
		success: boolean;
		flagId?: string;
		dueDate?: Date;
		error?: string;
	}> {
		try {
			const now = new Date();

			// Calculate STR due date (7 working days)
			const dueDate = new Date(now);
			let workingDays = 0;
			while (workingDays < STR_DUE_DAYS) {
				dueDate.setDate(dueDate.getDate() + 1);
				const dayOfWeek = dueDate.getDay();
				if (dayOfWeek !== 0 && dayOfWeek !== 6) {
					workingDays++;
				}
			}

			const insertData: InsertUnlistedSTRFlags = {
				dealId: data.dealId,
				userId: data.userId,
				companyId: data.companyId,
				flagType: data.flagType,
				severity: data.severity,
				transactionAmount: data.transactionAmount.toString(),
				flagReason: data.flagReason,
				detectionMethod: data.detectionMethod || "automated",
				relatedTransactions: data.relatedTransactions || [],
				strDueDate: dueDate,
				status: "pending",
			};

			const [record] = await db
				.insert(unlistedSTRFlags)
				.values(insertData)
				.returning({ id: unlistedSTRFlags.id });

			console.log(
				`[RegCompliance] STR flag recorded: ${data.flagType} (${data.severity}) - Due: ${dueDate.toISOString()}`,
			);

			return { success: true, flagId: record.id, dueDate };
		} catch (error: any) {
			console.error("[RegCompliance] Error recording STR flag:", error);
			return { success: false, error: error.message };
		}
	}

	// ==================== VALUATION DEVIATION MONITORING ====================

	/**
	 * Get transactions with high valuation deviation (>20%)
	 * Critical for Section 56(2)(x) tax compliance
	 */
	async getHighDeviationTransactions(): Promise<any[]> {
		return await db
			.select()
			.from(unlistedDeals)
			.where(sql`CAST(valuation_deviation AS NUMERIC) > 20`)
			.orderBy(desc(unlistedDeals.createdAt));
	}

	/**
	 * Get pending STR flags requiring action
	 */
	async getPendingSTRFlags(): Promise<{
		total: number;
		overdue: number;
		dueSoon: number;
		flags: any[];
	}> {
		const now = new Date();
		const threeDaysFromNow = new Date(now);
		threeDaysFromNow.setDate(threeDaysFromNow.getDate() + 3);

		const flags = await db
			.select()
			.from(unlistedSTRFlags)
			.where(eq(unlistedSTRFlags.status, "pending"))
			.orderBy(unlistedSTRFlags.strDueDate);

		const overdue = flags.filter((f) => new Date(f.strDueDate!) < now).length;
		const dueSoon = flags.filter((f) => {
			const dueDate = new Date(f.strDueDate!);
			return dueDate >= now && dueDate <= threeDaysFromNow;
		}).length;

		return {
			total: flags.length,
			overdue,
			dueSoon,
			flags,
		};
	}

	// ==================== SOURCE OF FUNDS VERIFICATION ====================

	/**
	 * Check if source of funds verification is required
	 */
	requiresSourceOfFundsVerification(transactionAmount: number): boolean {
		return transactionAmount >= HIGH_VALUE_THRESHOLD;
	}

	/**
	 * Mark source of funds as verified
	 */
	async markSourceOfFundsVerified(
		companyId: string,
		userId: string,
		verifiedBy: string,
	): Promise<{ success: boolean }> {
		try {
			const fy = getCurrentFinancialYear();

			await db
				.update(unlistedInvestorTracking)
				.set({
					sourceOfFundsVerified: true,
					updatedAt: new Date(),
				})
				.where(
					and(
						eq(unlistedInvestorTracking.companyId, companyId),
						eq(unlistedInvestorTracking.userId, userId),
						eq(unlistedInvestorTracking.financialYear, fy),
					),
				);

			console.log(
				`[RegCompliance] Source of funds verified for user ${userId} by ${verifiedBy}`,
			);

			return { success: true };
		} catch (error: any) {
			console.error("[RegCompliance] Error marking SOF verified:", error);
			return { success: false };
		}
	}

	// ==================== DOCUMENT VERIFICATION ====================

	/**
	 * Verify trade documents (DIS, CML, Exercise Letter)
	 */
	async verifyTradeDocuments(
		dealId: string,
		documents: {
			type: "DIS" | "CML" | "EXERCISE_LETTER" | "OTHER";
			documentUrl: string;
			verifiedBy: string;
			remarks?: string;
		},
	): Promise<{ success: boolean; auditLogId?: string }> {
		try {
			const deal = await db.query.unlistedDeals.findFirst({
				where: eq(unlistedDeals.id, dealId),
			});

			if (!deal) {
				throw new Error("Deal not found");
			}

			// Record in audit log
			const [log] = await db
				.insert(unlistedCompanyStatusLog)
				.values({
					companyId: deal.companyId,
					previousStatus: deal.status,
					newStatus: deal.status, // Status doesn't change here, just adding a log entry
					statusSource: "admin_verification",
					adminUserId: documents.verifiedBy,
					notes: `Document Verified: ${documents.type}. URL: ${documents.documentUrl}. Remarks: ${documents.remarks || "None"}`,
				} as any)
				.returning({ id: unlistedCompanyStatusLog.id });

			// Update deal compliance notes
			const now = new Date();
			const updatedNotes =
				(deal.complianceNotes || "") +
				`\n[VERIFIED] ${documents.type} at ${now.toISOString()} by ${documents.verifiedBy}`;

			await db
				.update(unlistedDeals)
				.set({
					complianceNotes: updatedNotes,
					updatedAt: now,
				})
				.where(eq(unlistedDeals.id, dealId));

			return { success: true, auditLogId: log.id };
		} catch (error: any) {
			console.error("[RegCompliance] Error verifying documents:", error);
			return { success: false };
		}
	}

	// ==================== ADMIN DASHBOARD DATA ====================

	/**
	 * Get compliance overview for admin dashboard
	 */
	async getComplianceOverview(): Promise<{
		investorLimits: {
			companiesNearLimit: number;
			companiesAtLimit: number;
			companiesAtRisk: any[];
		};
		lockIns: {
			activeRecords: number;
			sharesLocked: number;
			unlockingThisMonth: number;
		};
		strFlags: {
			pending: number;
			overdue: number;
			filedThisMonth: number;
		};
		statusChanges: {
			listedThisMonth: number;
			suspended: number;
		};
		valuationDeviations: {
			highDeviationCount: number;
		};
	}> {
		const now = new Date();
		const fy = getCurrentFinancialYear();
		const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
		const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0);

		// Investor limits
		const investorCounts = await db
			.select({
				companyId: unlistedInvestorTracking.companyId,
				count: count(),
			})
			.from(unlistedInvestorTracking)
			.where(eq(unlistedInvestorTracking.financialYear, fy))
			.groupBy(unlistedInvestorTracking.companyId);

		const companiesNearLimit = investorCounts.filter(
			(c) => c.count >= 180 && c.count < 200,
		);
		const companiesAtLimit = investorCounts.filter((c) => c.count >= 200);

		// Fetch company names for those near or at limit
		const atRiskIds = [...companiesNearLimit, ...companiesAtLimit].map(
			(c) => c.companyId,
		);
		let companiesAtRisk: {
			id: string;
			name: string;
			count: number;
			status: "near_limit" | "at_limit";
		}[] = [];

		if (atRiskIds.length > 0) {
			const companyDetails = await db
				.select({
					id: unlistedCompanies.id,
					name: unlistedCompanies.name,
				})
				.from(unlistedCompanies)
				.where(sql`${unlistedCompanies.id} IN ${atRiskIds}`);

			companiesAtRisk = atRiskIds.map((id) => {
				const detail = companyDetails.find((d) => d.id === id);
				const invCount =
					investorCounts.find((c) => c.companyId === id)?.count || 0;
				return {
					id,
					name: detail?.name || "Unknown Company",
					count: invCount,
					status: invCount >= 200 ? "at_limit" : "near_limit",
				};
			});
		}

		// Lock-ins
		const activeLockIns = await db
			.select({
				count: count(),
				totalShares: sql<number>`COALESCE(SUM(${unlistedShareLockIn.sharesRemaining}), 0)`,
			})
			.from(unlistedShareLockIn)
			.where(eq(unlistedShareLockIn.isActive, true));

		const unlockingThisMonth = await db
			.select({ count: count() })
			.from(unlistedShareLockIn)
			.where(
				and(
					eq(unlistedShareLockIn.isActive, true),
					gte(unlistedShareLockIn.lockInEndDate, monthStart),
					lte(unlistedShareLockIn.lockInEndDate, monthEnd),
				),
			);

		// STR flags
		const strStats = await this.getPendingSTRFlags();
		const filedThisMonth = await db
			.select({ count: count() })
			.from(unlistedSTRFlags)
			.where(
				and(
					eq(unlistedSTRFlags.status, "filed"),
					gte(unlistedSTRFlags.strFiledAt, monthStart),
				),
			);

		// Status changes
		const listedThisMonth = await db
			.select({ count: count() })
			.from(unlistedCompanyStatusLog)
			.where(
				and(
					sql`LOWER(${unlistedCompanyStatusLog.newStatus}) LIKE '%listed%'`,
					gte(unlistedCompanyStatusLog.createdAt, monthStart),
				),
			);

		const suspended = await db
			.select({ count: count() })
			.from(unlistedCompanies)
			.where(eq((unlistedCompanies as any).tradingEnabled, false));

		// Valuation Deviations
		const highDeviations = await db
			.select({ count: count() })
			.from(unlistedDeals)
			.where(sql`CAST(valuation_deviation AS NUMERIC) > 20`);

		return {
			investorLimits: {
				companiesNearLimit: companiesNearLimit.length,
				companiesAtLimit: companiesAtLimit.length,
				companiesAtRisk,
			},
			lockIns: {
				activeRecords: activeLockIns[0]?.count || 0,
				sharesLocked: activeLockIns[0]?.totalShares || 0,
				unlockingThisMonth: unlockingThisMonth[0]?.count || 0,
			},
			strFlags: {
				pending: strStats.total,
				overdue: strStats.overdue,
				filedThisMonth: filedThisMonth[0]?.count || 0,
			},
			statusChanges: {
				listedThisMonth: listedThisMonth[0]?.count || 0,
				suspended: suspended[0]?.count || 0,
			},
			valuationDeviations: {
				highDeviationCount: highDeviations[0]?.count || 0,
			},
		};
	}
}

export const regulatoryComplianceService =
	new UnlistedRegulatoryComplianceService();
