// @ts-nocheck
/**
 * Credhive Vendor Adapter
 *
 * Implements the CorporateDataProvider interface using credhive-service.
 * All enrichment pipelines call this adapter — never call credhive-service
 * directly from business logic. This keeps vendor-specific API semantics
 * isolated from the rest of the application.
 *
 * Credhive endpoints used:
 *  POST /v1/company/search           — company search by name / CIN
 *  GET  /v1/company/{cin}            — full company profile
 *  GET  /v1/company/{cin}/financials — P&L, Balance Sheet, Cash Flow
 *  GET  /v1/company/{cin}/directors  — director list
 *  GET  /v1/company/{cin}/compliance — charges, risk signals
 *
 * Ratios are NOT available from Credhive — they are computed internally
 * by unlistedAnalyticsEngine.ts from the financial statements.
 */

import { db } from "../../db";
import { vendorApiCallLog } from "@shared/schema";
import { credhiveService } from "../credhive-service";

// ── Re-export domain interfaces so consumers need only this file ─────────────

export interface CompanyProfile {
	cin: string;
	name: string;
	pan?: string | null;
	sector?: string | null;
	industry?: string | null;
	status?: string | null;
	incorporationDate?: string | null;
	paidUpCapital?: number | null;
	authorizedCapital?: number | null;
	directors?: Array<{ name: string; din?: string; designation?: string }>;
	website?: string | null;
}

export interface FinancialStatement {
	financialYear: string;
	revenue?: number | null;
	ebitda?: number | null;
	ebit?: number | null;
	pat?: number | null;
	netProfit?: number | null;
	totalAssets?: number | null;
	totalLiabilities?: number | null;
	networth?: number | null;
	totalDebt?: number | null;
	operatingCashFlow?: number | null;
	source: string;
}

export interface FinancialRatios {
	financialYear: string;
	roe?: number | null;
	roce?: number | null;
	debtEquity?: number | null;
	currentRatio?: number | null;
	revenueGrowth?: number | null;
	profitGrowth?: number | null;
	marginEbitda?: number | null;
	marginPat?: number | null;
	peRatio?: number | null;
	source: string;
}

export interface Director {
	name: string;
	din?: string | null;
	designation?: string | null;
}

export interface Charge {
	chargeId?: string;
	chargeHolder?: string;
	amount?: number;
	status?: string;
	createdAt?: string;
}

// ── Interface contract ───────────────────────────────────────────────────────

export interface CorporateDataProvider {
	fetchCompanyProfile(cin: string): Promise<CompanyProfile | null>;
	fetchFinancials(cin: string, years?: number): Promise<FinancialStatement[]>;
	fetchRatios(cin: string, years?: number): Promise<FinancialRatios[]>;
	fetchDirectors(cin: string): Promise<Director[]>;
	fetchCharges(cin: string): Promise<Charge[]>;
}

// ── Credhive implementation ──────────────────────────────────────────────────

class CredhiveAdapter implements CorporateDataProvider {
	private async logApiCall(
		endpoint: string,
		cin: string,
		startMs: number,
		statusCode: number,
		success: boolean,
		error?: string,
	) {
		try {
			await db.insert(vendorApiCallLog).values({
				vendor: "credhive",
				endpoint,
				cin,
				statusCode,
				latencyMs: Date.now() - startMs,
				success,
				errorMessage: error ?? null,
				costUnit: 1,
			} as any);
		} catch {
			// Non-critical — never throw from logging
		}
	}

	async fetchCompanyProfile(cin: string): Promise<CompanyProfile | null> {
		const start = Date.now();
		const endpoint = `/v1/company/${cin}`;
		try {
			const resp = await credhiveService.getCompanyProfile(cin);
			await this.logApiCall(
				endpoint,
				cin,
				start,
				resp.success ? 200 : 500,
				resp.success,
				resp.error,
			);
			if (!resp.success || !resp.data) return null;
			const d = resp.data;

			// Fetch directors in the same call so profile is self-contained
			let directors: Director[] = [];
			try {
				const dirResp = await credhiveService.getDirectors(cin);
				if (dirResp.success && dirResp.data) {
					directors = dirResp.data
						.filter((dir) => dir.is_active)
						.map((dir) => ({
							name: dir.name,
							din: dir.din,
							designation: dir.designation,
						}));
				}
			} catch {
				// Non-fatal — profile still returned without directors
			}

			return {
				cin: d.cin || cin,
				name: d.company_name || "",
				pan: d.pan ?? null,
				sector: d.sector ?? null,
				industry: d.industry ?? null,
				status: d.status ?? null,
				incorporationDate: d.date_of_incorporation ?? null,
				paidUpCapital: d.paid_up_capital ?? null,
				authorizedCapital: d.authorized_capital ?? null,
				directors,
				website: d.website ?? null,
			};
		} catch (err: any) {
			await this.logApiCall(endpoint, cin, start, 500, false, err.message);
			console.warn(
				`[CredhiveAdapter] fetchCompanyProfile failed for ${cin}:`,
				err.message,
			);
			return null;
		}
	}

	async fetchFinancials(
		cin: string,
		years: number = 5,
	): Promise<FinancialStatement[]> {
		const start = Date.now();
		const endpoint = `/v1/company/${cin}/financials`;
		try {
			const resp = await credhiveService.getFinancials(cin);
			await this.logApiCall(
				endpoint,
				cin,
				start,
				resp.success ? 200 : 500,
				resp.success,
				resp.error,
			);
			if (!resp.success || !resp.data) return [];

			return resp.data.slice(0, years).map((r) => ({
				financialYear: r.financial_year,
				revenue: r.revenue ?? null,
				ebitda: r.ebitda ?? null,
				ebit: r.ebit ?? null,
				pat: r.pat ?? null,
				netProfit: r.net_profit ?? null,
				totalAssets: r.total_assets ?? null,
				totalLiabilities: r.total_liabilities ?? null,
				networth: r.networth ?? null,
				totalDebt: r.total_debt ?? null,
				operatingCashFlow: r.operating_cash_flow ?? null,
				source: "credhive",
			}));
		} catch (err: any) {
			await this.logApiCall(endpoint, cin, start, 500, false, err.message);
			console.warn(
				`[CredhiveAdapter] fetchFinancials failed for ${cin}:`,
				err.message,
			);
			return [];
		}
	}

	/**
	 * Credhive does not expose a ratios endpoint.
	 * Ratios are computed by unlistedAnalyticsEngine.ts from the financials.
	 * This method derives simple ratios on-the-fly from the financial statements
	 * so callers that need ratio structs for FHS computation still work.
	 */
	async fetchRatios(
		cin: string,
		years: number = 5,
	): Promise<FinancialRatios[]> {
		const financials = await this.fetchFinancials(cin, years);
		if (!financials.length) return [];

		const ratios: FinancialRatios[] = financials.map((f, i) => {
			const prev = financials[i + 1];
			const roe =
				f.pat != null && f.networth && f.networth !== 0
					? (f.pat / f.networth) * 100
					: null;
			const debtEquity =
				f.totalDebt != null && f.networth && f.networth !== 0
					? f.totalDebt / f.networth
					: null;
			const marginEbitda =
				f.ebitda != null && f.revenue && f.revenue !== 0
					? (f.ebitda / f.revenue) * 100
					: null;
			const marginPat =
				f.pat != null && f.revenue && f.revenue !== 0
					? (f.pat / f.revenue) * 100
					: null;
			const revenueGrowth =
				prev?.revenue && f.revenue != null && prev.revenue !== 0
					? ((f.revenue - prev.revenue) / prev.revenue) * 100
					: null;
			const profitGrowth =
				prev?.pat && f.pat != null && prev.pat !== 0
					? ((f.pat - prev.pat) / prev.pat) * 100
					: null;

			return {
				financialYear: f.financialYear,
				roe,
				roce: roe, // approximate ROCE ≈ ROE when D/E is unavailable
				debtEquity,
				currentRatio: null, // current assets/liabilities not in Credhive financials
				revenueGrowth,
				profitGrowth,
				marginEbitda,
				marginPat,
				peRatio: null, // requires market price
				source: "credhive",
			};
		});

		return ratios;
	}

	async fetchDirectors(cin: string): Promise<Director[]> {
		const start = Date.now();
		const endpoint = `/v1/company/${cin}/directors`;
		try {
			const resp = await credhiveService.getDirectors(cin);
			await this.logApiCall(
				endpoint,
				cin,
				start,
				resp.success ? 200 : 500,
				resp.success,
				resp.error,
			);
			if (!resp.success || !resp.data) return [];
			return resp.data
				.filter((d) => d.is_active)
				.map((d) => ({
					name: d.name,
					din: d.din || null,
					designation: d.designation || null,
				}));
		} catch (err: any) {
			await this.logApiCall(endpoint, cin, start, 500, false, err.message);
			console.warn(
				`[CredhiveAdapter] fetchDirectors failed for ${cin}:`,
				err.message,
			);
			return [];
		}
	}

	async fetchCharges(cin: string): Promise<Charge[]> {
		const start = Date.now();
		const endpoint = `/v1/company/${cin}/compliance`;
		try {
			const resp = await credhiveService.getCompliance(cin);
			await this.logApiCall(
				endpoint,
				cin,
				start,
				resp.success ? 200 : 500,
				resp.success,
				resp.error,
			);
			if (!resp.success || !resp.data) return [];

			// Map compliance signals that represent charges into the Charge interface
			return resp.data.signals
				.filter((s) => s.type === "charge")
				.map((s) => ({
					chargeHolder: s.description,
					amount: s.amount,
					status: s.severity,
					createdAt: s.date,
				}));
		} catch (err: any) {
			await this.logApiCall(endpoint, cin, start, 500, false, err.message);
			console.warn(
				`[CredhiveAdapter] fetchCharges failed for ${cin}:`,
				err.message,
			);
			return [];
		}
	}
}

export const credhiveAdapter = new CredhiveAdapter();
