import { db } from "./db";
import { eq, and, between, desc, sql } from "drizzle-orm";
import {
	generatedReports,
	reportAccessLogs,
	clientStatements,
	aiTransactionTracking,
} from "@shared/schema";
import { randomUUID } from "crypto";

/**
 * Report Generation Service
 * Handles transaction reports, account statements, and tax reports
 * Supports PDF and Excel export formats
 */

export interface ReportRequest {
	userId: string;
	reportType:
		| "transaction_history"
		| "account_statement"
		| "tax_report"
		| "capital_gains"
		| "dividend_income";
	reportFormat: "pdf" | "excel" | "csv";
	dateFrom?: Date;
	dateTo?: Date;
	transactionTypes?: string[];
	filters?: Record<string, any>;
}

export interface GeneratedReportData {
	id: string;
	reportTitle: string;
	totalTransactions: number;
	totalAmount: string;
	fileUrl: string;
	fileName: string;
	status: string;
	generatedAt: Date;
}

/**
 * Generate a transaction history report
 */
export async function generateTransactionReport(
	request: ReportRequest,
): Promise<GeneratedReportData> {
	try {
		const {
			userId,
			reportType,
			reportFormat,
			dateFrom,
			dateTo,
			transactionTypes,
			filters,
		} = request;

		// Create report record
		const reportId = randomUUID();
		const reportTitle = `${reportType.replace(/_/g, " ").toUpperCase()} - ${new Date().toLocaleDateString()}`;

		// Query transactions from aiTransactionTracking
		const whereConditions: any[] = [eq(aiTransactionTracking.userId, userId)];

		// Apply date filters
		if (dateFrom && dateTo) {
			whereConditions.push(
				between(aiTransactionTracking.transactionDate, dateFrom, dateTo),
			);
		}

		// Execute query
		const transactions = await db
			.select()
			.from(aiTransactionTracking)
			.where(and(...whereConditions));

		// Calculate totals
		const totalTransactions = transactions.length;
		const totalAmount = transactions
			.reduce((sum, txn) => sum + Number.parseFloat(txn.amount || "0"), 0)
			.toFixed(2);

		// Generate report file (placeholder - actual implementation would create PDF/Excel)
		const fileName = `${reportType}_${Date.now()}.${reportFormat}`;
		const fileUrl = `/reports/${fileName}`; // This would be a cloud storage URL in production

		// Insert report record into database
		await db.insert(generatedReports).values({
			id: reportId,
			userId,
			reportType,
			reportFormat,
			reportStatus: "completed",
			dateFrom: dateFrom ? sql`${dateFrom}::date` : null,
			dateTo: dateTo ? sql`${dateTo}::date` : null,
			transactionTypes: transactionTypes
				? sql`${JSON.stringify(transactionTypes)}::jsonb`
				: null,
			filters: filters ? sql`${JSON.stringify(filters)}::jsonb` : null,
			reportTitle,
			totalTransactions,
			totalAmount: sql`${totalAmount}::decimal`,
			fileUrl,
			fileName,
			generatedAt: new Date(),
		});

		// Log report access
		await logReportAccess(reportId, userId, "generate");

		return {
			id: reportId,
			reportTitle,
			totalTransactions,
			totalAmount,
			fileUrl,
			fileName,
			status: "completed",
			generatedAt: new Date(),
		};
	} catch (error) {
		console.error("Error generating transaction report:", error);
		throw new Error("Failed to generate transaction report");
	}
}

/**
 * Generate an account statement
 */
export async function generateAccountStatement(
	userId: string,
	dateFrom: Date,
	dateTo: Date,
	format: "pdf" | "excel" = "pdf",
): Promise<GeneratedReportData> {
	try {
		const statementId = randomUUID();
		const statementPeriod = `${dateFrom.toLocaleDateString()} - ${dateTo.toLocaleDateString()}`;

		// Get all transactions for the period
		const transactions = await db
			.select()
			.from(aiTransactionTracking)
			.where(
				and(
					eq(aiTransactionTracking.userId, userId),
					between(aiTransactionTracking.transactionDate, dateFrom, dateTo),
				),
			)
			.orderBy(desc(aiTransactionTracking.transactionDate));

		// Calculate statement summary
		const totalCredits = transactions
			.filter(
				(t) =>
					t.transactionCategory === "deposit" ||
					t.transactionCategory === "salary",
			)
			.reduce((sum, t) => sum + Number.parseFloat(t.amount || "0"), 0);

		const totalDebits = transactions
			.filter(
				(t) =>
					t.transactionCategory === "withdrawal" ||
					t.transactionCategory === "investment",
			)
			.reduce((sum, t) => sum + Number.parseFloat(t.amount || "0"), 0);

		const netBalance = totalCredits - totalDebits;

		// Create statement record in database
		await db.insert(clientStatements).values({
			userId,
			statementType: "consolidated",
			statementPeriod,
			statementFormat: format,
			totalCredits: sql`${totalCredits.toFixed(2)}::decimal`,
			totalDebits: sql`${totalDebits.toFixed(2)}::decimal`,
			netBalance: sql`${netBalance.toFixed(2)}::decimal`,
			transactionCount: transactions.length,
			statementData: sql`${JSON.stringify(transactions)}::jsonb`,
			generatedAt: new Date(),
		} as any);

		// Create corresponding report record
		const reportId = randomUUID();
		const fileName = `account_statement_${Date.now()}.${format}`;
		const fileUrl = `/statements/${fileName}`;

		await db.insert(generatedReports).values({
			id: reportId,
			userId,
			reportType: "account_statement",
			reportFormat: format,
			reportStatus: "completed",
			dateFrom: sql`${dateFrom}::date`,
			dateTo: sql`${dateTo}::date`,
			reportTitle: `Account Statement - ${statementPeriod}`,
			totalTransactions: transactions.length,
			totalAmount: sql`${netBalance.toFixed(2)}::decimal`,
			fileUrl,
			fileName,
			generatedAt: new Date(),
		});

		await logReportAccess(reportId, userId, "generate");

		return {
			id: reportId,
			reportTitle: `Account Statement - ${statementPeriod}`,
			totalTransactions: transactions.length,
			totalAmount: netBalance.toFixed(2),
			fileUrl,
			fileName,
			status: "completed",
			generatedAt: new Date(),
		};
	} catch (error) {
		console.error("Error generating account statement:", error);
		throw new Error("Failed to generate account statement");
	}
}

/**
 * Generate a tax report (capital gains, dividend income)
 */
export async function generateTaxReport(
	userId: string,
	financialYear: string,
	reportSubtype: "capital_gains" | "dividend_income" = "capital_gains",
	format: "pdf" | "excel" = "pdf",
): Promise<GeneratedReportData> {
	try {
		// Parse financial year (e.g., "2024-25")
		const [startYear, endYearShort] = financialYear.split("-");
		const dateFrom = new Date(`${startYear}-04-01`); // April 1st
		const dateTo = new Date(`20${endYearShort}-03-31`); // March 31st next year

		// Get relevant transactions based on report subtype
		const relevantCategories =
			reportSubtype === "capital_gains"
				? ["investment_redemption", "stock_sale", "mutual_fund_redemption"]
				: ["dividend_income"];

		const transactions = await db
			.select()
			.from(aiTransactionTracking)
			.where(
				and(
					eq(aiTransactionTracking.userId, userId),
					between(aiTransactionTracking.transactionDate, dateFrom, dateTo),
				),
			);

		// Filter by category
		const filteredTxns = transactions.filter((t) =>
			relevantCategories.includes(t.transactionCategory || ""),
		);

		const totalAmount = filteredTxns
			.reduce((sum, t) => sum + Number.parseFloat(t.amount || "0"), 0)
			.toFixed(2);

		// Create report record
		const reportId = randomUUID();
		const fileName = `tax_${reportSubtype}_FY${financialYear}.${format}`;
		const fileUrl = `/tax-reports/${fileName}`;

		await db.insert(generatedReports).values({
			id: reportId,
			userId,
			reportType: reportSubtype,
			reportFormat: format,
			reportStatus: "completed",
			dateFrom: sql`${dateFrom}::date`,
			dateTo: sql`${dateTo}::date`,
			reportTitle: `${reportSubtype.replace("_", " ").toUpperCase()} Report - FY ${financialYear}`,
			totalTransactions: filteredTxns.length,
			totalAmount: sql`${totalAmount}::decimal`,
			filters: sql`${JSON.stringify({ financialYear, reportSubtype })}::jsonb`,
			fileUrl,
			fileName,
			generatedAt: new Date(),
		});

		await logReportAccess(reportId, userId, "generate");

		return {
			id: reportId,
			reportTitle: `${reportSubtype.replace("_", " ").toUpperCase()} Report - FY ${financialYear}`,
			totalTransactions: filteredTxns.length,
			totalAmount,
			fileUrl,
			fileName,
			status: "completed",
			generatedAt: new Date(),
		};
	} catch (error) {
		console.error("Error generating tax report:", error);
		throw new Error("Failed to generate tax report");
	}
}

/**
 * Get user's report history
 */
export async function getUserReports(userId: string, limit: number = 20) {
	return await db
		.select()
		.from(generatedReports)
		.where(eq(generatedReports.userId, userId))
		.orderBy(desc(generatedReports.createdAt))
		.limit(limit);
}

/**
 * Get report by ID
 */
export async function getReportById(reportId: string, userId: string) {
	const [report] = await db
		.select()
		.from(generatedReports)
		.where(
			and(
				eq(generatedReports.id, reportId),
				eq(generatedReports.userId, userId),
			),
		);

	if (report) {
		await logReportAccess(reportId, userId, "view");
	}

	return report;
}

/**
 * Log report access for audit trail
 */
async function logReportAccess(
	reportId: string,
	userId: string,
	accessType: "view" | "download" | "generate" | "share",
) {
	try {
		await db.insert(reportAccessLogs).values({
			id: randomUUID(),
			reportId,
			userId,
			accessType,
			accessedAt: new Date(),
		});
	} catch (error) {
		console.error("Error logging report access:", error);
		// Non-critical error, don't throw
	}
}

/**
 * Export report data in specified format
 * (Placeholder - actual implementation would generate real PDF/Excel files)
 */
export async function exportReport(
	reportId: string,
	userId: string,
	format: "pdf" | "excel" | "csv",
): Promise<{ fileUrl: string; fileName: string }> {
	const report = await getReportById(reportId, userId);

	if (!report) {
		throw new Error("Report not found");
	}

	// Log download
	await logReportAccess(reportId, userId, "download");

	// In production, this would generate the actual file
	// For now, return the existing file URL
	return {
		fileUrl: report.fileUrl || "",
		fileName: report.fileName || `report_${reportId}.${format}`,
	};
}

/**
 * Delete old reports (cleanup task)
 */
export async function cleanupOldReports(daysOld: number = 90) {
	const cutoffDate = new Date();
	cutoffDate.setDate(cutoffDate.getDate() - daysOld);

	try {
		const result = await db
			.delete(generatedReports)
			.where(sql`${generatedReports.createdAt} < ${cutoffDate}`);

		console.log(`Cleaned up old reports older than ${daysOld} days`);
		return result;
	} catch (error) {
		console.error("Error cleaning up old reports:", error);
		throw error;
	}
}
