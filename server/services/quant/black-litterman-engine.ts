import { db } from "../../db";
import { quantRunLog } from "@shared/schema";
import { logger } from "../../logger";
import type { MVOResult } from "./mvo-engine";

export interface ViewSignal {
	category: string;
	direction: "BULLISH" | "BEARISH" | "NEUTRAL";
	magnitude: number;
	confidence: number;
	source: "POTD" | "REGIME" | "MOMENTUM" | "ANALYST";
}

export interface BLConfig {
	tau: number;
	tacticalBudget: number;
	riskAversion: number;
}

export interface BLResult {
	posteriorReturns: number[];
	posteriorWeights: Record<string, number>;
	impliedReturns: number[];
	viewAdjustments: Record<string, number>;
	tacticalTilts: Record<string, number>;
	categories: string[];
	modelVersion: string;
}

const DEFAULT_BL_CONFIG: BLConfig = {
	tau: 0.05,
	tacticalBudget: 0.1,
	riskAversion: 2.5,
};

class BlackLittermanEngine {
	computeImpliedReturns(
		covarianceMatrix: number[][],
		marketWeights: number[],
		riskAversion: number,
	): number[] {
		const n = marketWeights.length;
		const pi: number[] = new Array(n).fill(0);

		for (let i = 0; i < n; i++) {
			for (let j = 0; j < n; j++) {
				pi[i] += riskAversion * covarianceMatrix[i][j] * marketWeights[j];
			}
		}

		return pi;
	}

	private matchCategoryIndex(viewCat: string, categories: string[]): number {
		const exact = categories.indexOf(viewCat);
		if (exact >= 0) return exact;

		const lower = viewCat.toLowerCase();
		const aliases: Record<string, string[]> = {
			listed_stocks: ["equity", "equity_largecap", "equity_midcap", "equity_in", "stocks"],
			mutual_funds: ["equity", "hybrid", "mf", "equity_largecap"],
			bonds: ["debt", "debt_long_term", "debt_short_term", "fixed_income"],
			fixed_deposits: ["debt", "cash", "liquid", "fixed_income"],
			sgb: ["gold", "commodities"],
			etfs: ["equity", "index", "equity_largecap"],
			reits_invits: ["reit", "real_estate", "alternatives"],
			global_stocks: ["international", "equity_us", "equity_global"],
		};

		const candidateAliases = aliases[lower] ?? [];
		for (const alias of candidateAliases) {
			const idx = categories.findIndex((c) => c.toLowerCase() === alias.toLowerCase());
			if (idx >= 0) return idx;
		}

		return categories.findIndex(
			(c) => c.toLowerCase().includes(lower) || lower.includes(c.toLowerCase()),
		);
	}

	buildViewMatrices(
		views: ViewSignal[],
		categories: string[],
	): { P: number[][]; Q: number[]; Omega: number[][] } {
		const resolvedViews: Array<{ view: ViewSignal; catIdx: number }> = [];
		for (const v of views) {
			if (v.direction === "NEUTRAL") continue;
			const catIdx = this.matchCategoryIndex(v.category, categories);
			if (catIdx >= 0) {
				resolvedViews.push({ view: v, catIdx });
			}
		}

		if (resolvedViews.length === 0) {
			return { P: [], Q: [], Omega: [] };
		}

		const k = resolvedViews.length;
		const n = categories.length;

		const P: number[][] = Array.from({ length: k }, () => Array(n).fill(0));
		const Q: number[] = new Array(k);
		const Omega: number[][] = Array.from({ length: k }, () => Array(k).fill(0));

		resolvedViews.forEach(({ view, catIdx }, vi) => {
			P[vi][catIdx] = view.direction === "BULLISH" ? 1 : -1;
			Q[vi] = view.magnitude * (view.direction === "BULLISH" ? 1 : -1);
			const uncertainty = 1 / Math.max(view.confidence, 0.1);
			Omega[vi][vi] = uncertainty * uncertainty * 0.01;
		});

		return { P, Q, Omega };
	}

	computePosteriorReturns(
		impliedReturns: number[],
		covarianceMatrix: number[][],
		P: number[][],
		Q: number[],
		Omega: number[][],
		tau: number,
	): number[] {
		if (P.length === 0) {
			return [...impliedReturns];
		}

		const n = impliedReturns.length;
		const k = P.length;

		const tauSigma = covarianceMatrix.map((row) => row.map((v) => v * tau));

		const tauSigmaInv = this.invertMatrix(tauSigma);
		if (!tauSigmaInv) {
			logger.warn(
				"[BL] Failed to invert tau*Sigma, returning implied returns",
			);
			return [...impliedReturns];
		}

		const Pt = this.transpose(P);
		const OmegaInv = this.invertMatrix(Omega);
		if (!OmegaInv) {
			logger.warn("[BL] Failed to invert Omega, returning implied returns");
			return [...impliedReturns];
		}

		const PtOmegaInv = this.multiply(Pt, OmegaInv);
		const PtOmegaInvP = this.multiply(PtOmegaInv, P);

		const posteriorPrecision: number[][] = Array.from({ length: n }, (_, i) =>
			Array.from(
				{ length: n },
				(_, j) => tauSigmaInv[i][j] + PtOmegaInvP[i][j],
			),
		);

		const posteriorCov = this.invertMatrix(posteriorPrecision);
		if (!posteriorCov) {
			logger.warn(
				"[BL] Failed to invert posterior precision, returning implied returns",
			);
			return [...impliedReturns];
		}

		const tauSigmaInvPi: number[] = new Array(n).fill(0);
		for (let i = 0; i < n; i++) {
			for (let j = 0; j < n; j++) {
				tauSigmaInvPi[i] += tauSigmaInv[i][j] * impliedReturns[j];
			}
		}

		const PtOmegaInvQ: number[] = new Array(n).fill(0);
		for (let i = 0; i < n; i++) {
			for (let l = 0; l < k; l++) {
				PtOmegaInvQ[i] += PtOmegaInv[i][l] * Q[l];
			}
		}

		const posteriorReturns: number[] = new Array(n).fill(0);
		for (let i = 0; i < n; i++) {
			const sum = tauSigmaInvPi[i] + PtOmegaInvQ[i];
			for (let j = 0; j < n; j++) {
				posteriorReturns[i] +=
					posteriorCov[i][j] * (tauSigmaInvPi[j] + PtOmegaInvQ[j]);
			}
		}

		return posteriorReturns;
	}

	applyTacticalBudget(
		strategicWeights: number[],
		posteriorWeights: number[],
		tacticalBudget: number,
	): number[] {
		const n = strategicWeights.length;
		const tilts = posteriorWeights.map((pw, i) => pw - strategicWeights[i]);
		const totalTilt = tilts.reduce((s, t) => s + Math.abs(t), 0);

		if (totalTilt <= tacticalBudget) {
			return posteriorWeights;
		}

		const scale = tacticalBudget / totalTilt;
		const constrained = strategicWeights.map((sw, i) => sw + tilts[i] * scale);

		const sum = constrained.reduce((s, w) => s + w, 0);
		return constrained.map((w) => w / sum);
	}

	async run(
		mvoResult: MVOResult,
		views: ViewSignal[],
		config: Partial<BLConfig> = {},
		portfolioId?: string,
	): Promise<BLResult> {
		const startTime = Date.now();
		const fullConfig = { ...DEFAULT_BL_CONFIG, ...config };
		const {
			categories,
			covarianceMatrix,
			annualizedCovarianceMatrix,
			weights: strategicWeightsMap,
		} = mvoResult;
		// Use annualised covariance so that BL views (expressed in annual return terms, e.g. 0.15 = 15%)
		// are on the same scale as the implied returns. Daily cov suppresses view signals by ~250×.
		const blCovMatrix = annualizedCovarianceMatrix ?? covarianceMatrix;
		const strategicWeights = categories.map((c) => strategicWeightsMap[c] || 0);

		try {
			const impliedReturns = this.computeImpliedReturns(
				blCovMatrix,
				strategicWeights,
				fullConfig.riskAversion,
			);

			const { P, Q, Omega } = this.buildViewMatrices(views, categories);

			const posteriorReturns = this.computePosteriorReturns(
				impliedReturns,
				blCovMatrix,
				P,
				Q,
				Omega,
				fullConfig.tau,
			);

			const rawPosteriorWeights = this.returnsToWeights(
				posteriorReturns,
				blCovMatrix,
				fullConfig.riskAversion,
			);

			const constrainedWeights = this.applyTacticalBudget(
				strategicWeights,
				rawPosteriorWeights,
				fullConfig.tacticalBudget,
			);

			const posteriorWeightsMap: Record<string, number> = {};
			const viewAdjustments: Record<string, number> = {};
			const tacticalTilts: Record<string, number> = {};

			categories.forEach((cat, i) => {
				posteriorWeightsMap[cat] =
					Math.round(constrainedWeights[i] * 10000) / 10000;
				viewAdjustments[cat] =
					Math.round((posteriorReturns[i] - impliedReturns[i]) * 10000) / 10000;
				tacticalTilts[cat] =
					Math.round((constrainedWeights[i] - strategicWeights[i]) * 10000) /
					10000;
			});

			const runTimeMs = Date.now() - startTime;
			const modelVersion = `bl-v1.0-tau${fullConfig.tau}-tb${fullConfig.tacticalBudget}`;

			try {
				await db.insert(quantRunLog).values({
					portfolioId: portfolioId || null,
					modelType: "BLACK_LITTERMAN",
					runTimeMs,
					status: "SUCCESS",
					outputSummary: {
						viewCount: views.length,
						tacticalTilts,
						posteriorWeights: posteriorWeightsMap,
					},
					fallbackUsed: false,
				});
			} catch (e) {
				logger.warn("[BL] Failed to log run:", { error: String(e) });
			}

			logger.info(
				`[BL] Tactical overlay complete in ${runTimeMs}ms. Views: ${views.length}, Active tilts: ${Object.values(tacticalTilts).filter((t) => Math.abs(t) > 0.001).length}`,
			);

			return {
				posteriorReturns,
				posteriorWeights: posteriorWeightsMap,
				impliedReturns,
				viewAdjustments,
				tacticalTilts,
				categories,
				modelVersion,
			};
		} catch (error: any) {
			const runTimeMs = Date.now() - startTime;
			try {
				await db.insert(quantRunLog).values({
					portfolioId: portfolioId || null,
					modelType: "BLACK_LITTERMAN",
					runTimeMs,
					status: "ERROR",
					errorMessage: error.message,
					fallbackUsed: true,
				});
			} catch (reportErr: any) {
				logger.warn("[BL] Failed to record error status:", { error: reportErr?.message });
			}

			logger.error("[BL] Tactical overlay failed:", { error: error.message });
			throw error;
		}
	}

	private returnsToWeights(
		returns: number[],
		covMatrix: number[][],
		riskAversion: number,
	): number[] {
		const n = returns.length;
		const inv = this.invertMatrix(covMatrix);
		if (!inv) {
			return Array(n).fill(1 / n);
		}

		const raw: number[] = new Array(n).fill(0);
		for (let i = 0; i < n; i++) {
			for (let j = 0; j < n; j++) {
				raw[i] += inv[i][j] * returns[j];
			}
			raw[i] /= riskAversion;
		}

		const sum = raw.reduce((s, w) => s + Math.abs(w), 0);
		if (sum === 0) return Array(n).fill(1 / n);

		const normalized = raw.map((w) => Math.max(0, w));
		const normSum = normalized.reduce((s, w) => s + w, 0);
		return normSum > 0
			? normalized.map((w) => w / normSum)
			: Array(n).fill(1 / n);
	}

	private invertMatrix(matrix: number[][]): number[][] | null {
		const n = matrix.length;
		if (n === 0) return null;

		const augmented = matrix.map((row, i) => {
			const identityRow = Array(n).fill(0);
			identityRow[i] = 1;
			return [...row, ...identityRow];
		});

		for (let col = 0; col < n; col++) {
			let maxRow = col;
			for (let row = col + 1; row < n; row++) {
				if (Math.abs(augmented[row][col]) > Math.abs(augmented[maxRow][col])) {
					maxRow = row;
				}
			}
			[augmented[col], augmented[maxRow]] = [augmented[maxRow], augmented[col]];

			const pivot = augmented[col][col];
			if (Math.abs(pivot) < 1e-12) return null;

			for (let j = 0; j < 2 * n; j++) {
				augmented[col][j] /= pivot;
			}

			for (let row = 0; row < n; row++) {
				if (row === col) continue;
				const factor = augmented[row][col];
				for (let j = 0; j < 2 * n; j++) {
					augmented[row][j] -= factor * augmented[col][j];
				}
			}
		}

		return augmented.map((row) => row.slice(n));
	}

	private transpose(matrix: number[][]): number[][] {
		if (matrix.length === 0) return [];
		const rows = matrix.length;
		const cols = matrix[0].length;
		const result: number[][] = Array.from({ length: cols }, () =>
			Array(rows).fill(0),
		);
		for (let i = 0; i < rows; i++) {
			for (let j = 0; j < cols; j++) {
				result[j][i] = matrix[i][j];
			}
		}
		return result;
	}

	private multiply(A: number[][], B: number[][]): number[][] {
		const m = A.length;
		const n = B[0]?.length || 0;
		const p = B.length;
		const result: number[][] = Array.from({ length: m }, () =>
			Array(n).fill(0),
		);
		for (let i = 0; i < m; i++) {
			for (let j = 0; j < n; j++) {
				for (let k = 0; k < p; k++) {
					result[i][j] += A[i][k] * B[k][j];
				}
			}
		}
		return result;
	}

	convertPotdToViews(
		potdPicks: Array<{
			instrumentName: string;
			category: string;
			recoPrice: number;
			targetPrice: number;
			confidenceScore?: number;
		}>,
	): ViewSignal[] {
		return potdPicks.map((pick) => {
			const reco = Number(pick.recoPrice) || 1;
			const target = Number(pick.targetPrice) || reco;
			const upside = (target - reco) / reco;
			// Guardrail: bound magnitude to [0.01, 0.25] (1% to 25% annual active alpha view)
			const magnitude = Math.min(0.25, Math.max(0.01, Math.abs(upside)));
			return {
				category: pick.category,
				direction: upside > 0 ? ("BULLISH" as const) : ("BEARISH" as const),
				magnitude,
				confidence: (pick.confidenceScore || 50) / 100,
				source: "POTD" as const,
			};
		});
	}
}

export const blackLittermanEngine = new BlackLittermanEngine();
