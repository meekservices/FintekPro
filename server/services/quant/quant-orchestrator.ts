// GCR-compliant: strict typing enforced — @ts-nocheck removed (Audit C-E1)
import { db } from "../../db";
import { logger } from "../../logger";
import {
	quantGovernancePolicy,
	quantRunLog,
	quantTransitionLog,
} from "@shared/schema";
import { eq } from "drizzle-orm";
import {
	mvoEngine,
	type AssetData,
	type MVOResult,
	type TransitionConstraints,
} from "./mvo-engine";
import {
	blackLittermanEngine,
	type ViewSignal,
	type BLResult,
} from "./black-litterman-engine";
import {
	driftPredictionEngine,
	type DriftPredictionResult,
} from "./drift-prediction-engine";
import {
	callPython,
	isPythonServiceConfigured,
} from "../../clients/python-client";
// H-E2: Use upgraded market-regime-detector (Redis + AI signals + NSE breadth)
import { detectRegime as detectMarketRegime } from "../market-regime-detector";
import { globalMarketIntelligenceEngine } from "../macro/global-market-intelligence-engine";
import {
	calculateTailRiskAndStress,
	type TailRiskAnalysisResult,
	type PortfolioAssetInput,
} from "./tail-risk-stress-engine";
import { telemetryBus } from "../engine-telemetry-bus";

export interface QuantInput {
	assetsData: AssetData[];
	driftMetrics: Array<{
		category: string;
		currentPercent: number;
		targetPercent: number;
		drift: number;
	}>;
	potdPicks?: Array<{
		instrumentName: string;
		category: string;
		recoPrice: number;
		targetPrice: number;
		confidenceScore?: number;
	}>;
	riskProfile: string;
	toleranceBandPct: number;
	portfolioId?: string;
	transitionConstraints?: Partial<TransitionConstraints>;
}

export interface QuantOutput {
	optimizedWeights: Record<string, number>;
	mvoResult: MVOResult | null;
	blResult: BLResult | null;
	driftResult: DriftPredictionResult | null;
	tailRiskResult?: TailRiskAnalysisResult | null;
	usedMvo: boolean;
	usedBl: boolean;
	usedDriftPrediction: boolean;
	usedTransitionOptimizer: boolean;
	usedTailRiskStress?: boolean;
	fallbackUsed: boolean;
	totalRunTimeMs: number;
	modelVersions: string[];
	preemptiveRebalanceRecommended: boolean;
	highRiskCategories: string[];
}

class QuantOrchestrator {
	async run(input: QuantInput): Promise<QuantOutput> {
		const startTime = Date.now();
		const {
			assetsData,
			driftMetrics,
			potdPicks,
			riskProfile,
			toleranceBandPct,
			portfolioId,
			transitionConstraints,
		} = input;

		const policy = await this.loadGovernancePolicy(riskProfile);

		const result: QuantOutput = {
			optimizedWeights: {},
			mvoResult: null,
			blResult: null,
			driftResult: null,
			usedMvo: false,
			usedBl: false,
			usedDriftPrediction: false,
			usedTransitionOptimizer: false,
			fallbackUsed: false,
			totalRunTimeMs: 0,
			modelVersions: [],
			preemptiveRebalanceRecommended: false,
			highRiskCategories: [],
		};

		if (
			!policy.useMvo &&
			!policy.useBlackLitterman &&
			!policy.useAiDriftPrediction
		) {
			logger.info("[QuantOrch] All quant features disabled", { riskProfile });
			result.fallbackUsed = true;
			result.totalRunTimeMs = Date.now() - startTime;
			return result;
		}

		// H-E2: Unified regime detector (was marketRegimeDetector.detectBlackSwanEvent() from stale ../risk path)
		let isBlackSwan = false;
		try {
			const regimeResult = await detectMarketRegime();
			isBlackSwan = regimeResult.vixProxy > 30 || regimeResult.regime === "HIGH_VOL";
		} catch { /* non-fatal — default false */ }

		const tc: Partial<TransitionConstraints> = {
			gamma: 5.0,
			maxPosition: Math.min(policy.maxAssetWeight, 0.2),
			turnoverCap: isBlackSwan ? 0.8 : 0.4, // Widen turnover cap during Black Swan to allow defensive pivots
			minWeight: 0.01,
			...transitionConstraints,
		};

		if (isBlackSwan) {
			logger.warn("[QuantOrch] Systemic Resilience Trigger: 10σ Black Swan active. Transition constraints widened.", {});
		}

		let blPosteriorReturns: number[] | undefined;

		if (policy.useMvo) {
			try {
				const mvoStart = Date.now();
				const mvoConfig = {
					riskAversion: policy.riskAversion,
					covarianceLookbackDays: policy.covarianceLookbackDays,
					ewmaSpan: policy.ewmaSpan,
					shrinkageIntensity: policy.shrinkageIntensity,
					maxAssetWeight: policy.maxAssetWeight,
					minAssetWeight: policy.minAssetWeight,
					solverMaxIterations: policy.solverMaxIterations,
					solverTolerance: policy.solverTolerance,
				};

				let mvoResult = await this.tryPythonMVO(assetsData, mvoConfig, tc);
				if (!mvoResult) {
					mvoResult = await mvoEngine.run(
						assetsData,
						mvoConfig,
						portfolioId,
						tc,
					);
				} else {
					logger.info("[QuantOrch] MVO computed by Python sidecar (scipy SLSQP)", {});
				}

				result.mvoResult = mvoResult;
				result.usedMvo = true;
				result.usedTransitionOptimizer = true;
				result.optimizedWeights = { ...mvoResult.weights };
				result.modelVersions.push(mvoResult.modelVersion);

				const mvoTimeMs = Date.now() - mvoStart;
				if (mvoTimeMs > 2000) {
					logger.warn("[QuantOrch] MVO exceeded 2s target", { latency_ms: mvoTimeMs });
				}

				const tm = mvoResult.transitionMetrics;
				logger.info("[QuantOrch] MVO transition complete", { sharpe: mvoResult.sharpeRatio, vol: mvoResult.portfolioVolatility, turnover: tm?.turnover });
			} catch (error: any) {
				logger.error("[QuantOrch] MVO failed, using fallback", { error: error.message });
				result.fallbackUsed = true;
				await this.logFallback(portfolioId, "MVO_TRANSITION", error.message);
			}
		}

		if (policy.useBlackLitterman && result.mvoResult) {
			try {
				const views: ViewSignal[] = [];

				if (potdPicks && potdPicks.length > 0) {
					const potdViews = blackLittermanEngine.convertPotdToViews(potdPicks);
					views.push(...potdViews);
				}

				// ── Synergy Upgrade 2: Ingest top-down macro cross-asset views from GMIE ──
				try {
					const gmieReport = await globalMarketIntelligenceEngine.getIntelligenceReport(false);
					if (gmieReport?.engineFeeds?.blackLittermanFeed?.viewsVectorQ) {
						const macroViews: ViewSignal[] = gmieReport.engineFeeds.blackLittermanFeed.viewsVectorQ.map(
							(v) => ({
								category: v.asset,
								direction:
									v.expectedExcessReturnPct > 9.0
										? ("BULLISH" as const)
										: v.expectedExcessReturnPct < 7.0
											? ("BEARISH" as const)
											: ("NEUTRAL" as const),
								magnitude: Math.min(0.25, Math.max(0.01, Math.abs(v.expectedExcessReturnPct / 100))),
								confidence: v.confidence,
								source: "REGIME" as const,
							})
						);
						views.push(...macroViews);
					}
				} catch (gmieErr: any) {
					logger.warn("[QuantOrch] GMIE macro views skipped; continuing with bottom-up views", {
						error: gmieErr?.message,
					});
				}

				if (views.length > 0) {
					const blConfig = {
						tau: policy.tau,
						tacticalBudget: policy.tacticalBudget,
						riskAversion: policy.riskAversion,
					};

					let blResult = await this.tryPythonBL(
						result.mvoResult!,
						views,
						blConfig,
					);
					if (!blResult) {
						blResult = await blackLittermanEngine.run(
							result.mvoResult!,
							views,
							blConfig,
							portfolioId,
						);
					} else {
						logger.info("[QuantOrch] BL computed by Python sidecar (numpy)", {});
					}

					result.blResult = blResult;
					result.usedBl = true;
					result.modelVersions.push(blResult.modelVersion);

					blPosteriorReturns = blResult.posteriorReturns;

					logger.info("[QuantOrch] BL overlay computed. Re-running transition optimizer with posterior returns.", {});

					const mvoConfig2 = {
						riskAversion: policy.riskAversion,
						covarianceLookbackDays: policy.covarianceLookbackDays,
						ewmaSpan: policy.ewmaSpan,
						shrinkageIntensity: policy.shrinkageIntensity,
						maxAssetWeight: policy.maxAssetWeight,
						minAssetWeight: policy.minAssetWeight,
						solverMaxIterations: policy.solverMaxIterations,
						solverTolerance: policy.solverTolerance,
					};

					try {
						let blConstrainedResult = await this.tryPythonMVO(
							assetsData,
							mvoConfig2,
							tc,
							blPosteriorReturns,
						);
						if (!blConstrainedResult) {
							blConstrainedResult = await mvoEngine.run(
								assetsData,
								mvoConfig2,
								portfolioId,
								tc,
								blPosteriorReturns,
							);
						}

						result.mvoResult = blConstrainedResult;
						result.optimizedWeights = { ...blConstrainedResult.weights };
						result.usedTransitionOptimizer = true;

						const tm = blConstrainedResult.transitionMetrics;
						logger.info("[QuantOrch] BL+Transition complete", { sharpe: blConstrainedResult.sharpeRatio, turnover: tm?.turnover });

						await this.logTransition(portfolioId, blConstrainedResult);
					} catch (blMvoError: any) {
						logger.error("[QuantOrch] BL+Transition re-optimization failed, using BL weights", { error: blMvoError.message });
						result.optimizedWeights = { ...blResult.posteriorWeights };
					}

					logger.info("[QuantOrch] BL active tilts", { tilts: Object.entries(blResult.tacticalTilts).filter(([_, t]) => Math.abs(t) > 0.001).map(([c, t]) => `${c}:${(t * 100).toFixed(1)}%`).join(", ") });
				} else {
					logger.info("[QuantOrch] BL skipped: no views available", {});

					if (result.mvoResult) {
						await this.logTransition(portfolioId, result.mvoResult);
					}
				}
			} catch (error: any) {
				logger.error("[QuantOrch] BL failed, using MVO weights", { error: error.message });
				await this.logFallback(portfolioId, "BLACK_LITTERMAN", error.message);

				if (result.mvoResult) {
					await this.logTransition(portfolioId, result.mvoResult);
				}
			}
		} else if (result.mvoResult) {
			await this.logTransition(portfolioId, result.mvoResult);
		}

		if (policy.useAiDriftPrediction) {
			try {
				let driftResult = await this.tryPythonDrift(
					driftMetrics,
					toleranceBandPct,
					policy.driftProbabilityTrigger,
				);
				if (!driftResult) {
					driftResult = await driftPredictionEngine.run(
						driftMetrics,
						toleranceBandPct,
						{ driftProbabilityTrigger: policy.driftProbabilityTrigger },
						portfolioId,
					);
				} else {
					logger.info("[QuantOrch] Drift prediction computed by Python sidecar (scipy.stats)", {});
				}

				result.driftResult = driftResult;
				result.usedDriftPrediction = true;
				result.preemptiveRebalanceRecommended =
					driftResult.recommendPreemptiveRebalance;
				result.highRiskCategories = driftResult.highRiskCategories;
				result.modelVersions.push(driftResult.modelVersion);

				if (driftResult.recommendPreemptiveRebalance) {
					logger.warn("[QuantOrch] PREEMPTIVE REBALANCE recommended", { highRiskCategories: driftResult.highRiskCategories });
				}
			} catch (error: any) {
				logger.error("[QuantOrch] Drift prediction failed", { error: error.message });
				await this.logFallback(
					portfolioId,
					"AI_DRIFT_PREDICTION",
					error.message,
				);
			}
		}

		// ── Synergy Upgrade 3: Tail-Risk, CVaR & Macro Stress-Testing Validation ──
		if (Object.keys(result.optimizedWeights).length > 0) {
			try {
				const stressAssets: PortfolioAssetInput[] = Object.entries(result.optimizedWeights).map(
					([sym, weight]) => {
						const assetInfo = assetsData.find((a) => a.category === sym);
						let assetClass: PortfolioAssetInput["assetClass"] = "LARGE_CAP";
						const cat = (assetInfo?.category || sym || "").toUpperCase();
						if (cat.includes("MID")) assetClass = "MID_CAP";
						else if (cat.includes("SMALL")) assetClass = "SMALL_CAP";
						else if (cat.includes("BANK")) assetClass = "BANKING";
						else if (cat.includes("IT") || cat.includes("TECH")) assetClass = "IT";
						else if (cat.includes("PHARMA") || cat.includes("HEALTH")) assetClass = "PHARMA";
						else if (cat.includes("AUTO")) assetClass = "AUTO";
						else if (cat.includes("DEBT") || cat.includes("BOND") || cat.includes("FIXED")) assetClass = "DEBT";
						else if (cat.includes("GOLD") || cat.includes("COMMODITY")) assetClass = "GOLD";

						return {
							symbol: sym,
							assetClass,
							weight,
							beta: (assetInfo as any)?.beta ?? (assetClass === "DEBT" ? 0.1 : assetClass === "GOLD" ? -0.1 : 1.0),
							historicalDailyReturns: assetInfo?.returns,
						};
					}
				);

				const tailRisk = calculateTailRiskAndStress(stressAssets);
				result.tailRiskResult = tailRisk;
				result.usedTailRiskStress = true;
				result.modelVersions.push(`tail-risk-stress@${tailRisk.engine_version}`);

				if (tailRisk.riskClassification === "CRITICAL_FAT_TAIL" || tailRisk.varMetrics.cvar95_expectedShortfallPct > 25) {
					logger.warn("[QuantOrch] Elevated tail risk detected by TailRiskStressEngine", {
						cvar95: tailRisk.varMetrics.cvar95_expectedShortfallPct,
						robustnessScore: tailRisk.portfolioRobustnessScore,
					});
					result.highRiskCategories.push("ELEVATED_TAIL_RISK_CVAR");
				}
			} catch (stressErr: any) {
				logger.warn("[QuantOrch] Tail risk stress validation non-fatal warning", {
					error: stressErr?.message,
				});
			}
		}

		result.totalRunTimeMs = Date.now() - startTime;

		if (result.totalRunTimeMs > 2000) {
			logger.warn("[QuantOrch] Total quant pipeline exceeded 2s target", { latency_ms: result.totalRunTimeMs });
		}

		// Operational Telemetry Bus Reporting
		telemetryBus.report({
			engineId: "quant-orchestrator",
			engineName: "Quant & MVO Portfolio Orchestrator",
			category: "Portfolio",
			reportedAt: new Date().toISOString(),
			latencyMs: result.totalRunTimeMs,
			qualityScore: result.fallbackUsed ? 75 : 98,
			itemsProcessed: Object.keys(result.optimizedWeights).length,
			errorCount: result.fallbackUsed ? 1 : 0,
			meta: {
				usedMvo: result.usedMvo,
				usedBl: result.usedBl,
				usedTailRiskStress: result.usedTailRiskStress,
				portfolioRobustnessScore: result.tailRiskResult?.portfolioRobustnessScore,
			},
		});

		try {
			await db.insert(quantRunLog).values({
				portfolioId: portfolioId || null,
				modelType: "QUANT_ORCHESTRATOR",
				runTimeMs: result.totalRunTimeMs,
				status: result.fallbackUsed ? "PARTIAL_FALLBACK" : "SUCCESS",
				outputSummary: {
					usedMvo: result.usedMvo,
					usedBl: result.usedBl,
					usedDriftPrediction: result.usedDriftPrediction,
					usedTransitionOptimizer: result.usedTransitionOptimizer,
					fallbackUsed: result.fallbackUsed,
					preemptiveRebalance: result.preemptiveRebalanceRecommended,
					modelVersions: result.modelVersions,
				},
				fallbackUsed: result.fallbackUsed,
				governancePolicyId: policy.id,
			});
		} catch (e) {
			logger.warn("[QuantOrch] Failed to log orchestrator run", { error: String(e) });
		}

		logger.info("[QuantOrch] Pipeline complete", { latency_ms: result.totalRunTimeMs, models: result.modelVersions });

		return result;
	}

	// ---------------------------------------------------------------------------
	// Python sidecar helpers — try scipy/numpy first, fall back to Node.js
	// ---------------------------------------------------------------------------

	private async tryPythonMVO(
		assetsData: AssetData[],
		config: Record<string, any>,
		tc: Partial<TransitionConstraints>,
		overrideReturns?: number[],
	): Promise<MVOResult | null> {
		if (!isPythonServiceConfigured()) return null;

		const assets = assetsData.map((a, i) => ({
			category: a.category,
			returns: a.returns,
			currentWeight: a.currentWeight ?? 0,
			sector: a.sector,
			instrumentType: a.instrumentType,
			...(overrideReturns ? { overrideReturn: overrideReturns[i] } : {}),
		}));

		const py = await callPython<any>("/api/quant/mvo", "POST", {
			assets,
			config,
			transition: tc,
		});

		if (!py || py.error) return null;

		const maxWeight = Math.max(
			...Object.values(py.weights as Record<string, number>),
		);

		const mvoResult: MVOResult = {
			categories: py.categories,
			weights: py.weights,
			expectedReturns:
				py.expectedReturns ?? py.categories.map(() => py.expectedReturn),
			expectedReturn: py.expectedReturn,
			portfolioVolatility: py.portfolioVolatility,
			sharpeRatio: py.sharpeRatio,
			covarianceMatrix: py.covarianceMatrix,
			annualizedCovarianceMatrix: py.annualizedCovarianceMatrix,
			modelVersion: py.modelVersion ?? "py-mvo-slsqp-v1",
			transitionMetrics: py.transitionMetrics
				? {
						turnover: py.transitionMetrics.turnover ?? 0,
						maxWeight,
						sectorExposure: {},
						categoryExposure: py.weights,
						gammaUsed: py.transitionMetrics.gammaUsed ?? 0,
						filteredCount: 0,
						constraintsApplied: [
							"scipy-SLSQP",
							"turnover-cap",
							"weight-bounds",
						],
					}
				: undefined,
		};

		return mvoResult;
	}

	private async tryPythonBL(
		mvoResult: MVOResult,
		views: ViewSignal[],
		config: Record<string, any>,
	): Promise<BLResult | null> {
		if (!isPythonServiceConfigured()) return null;

		const py = await callPython<any>("/api/quant/black-litterman", "POST", {
			mvoResult: {
				categories: mvoResult.categories,
				weights: mvoResult.weights,
				annualizedCovarianceMatrix: mvoResult.annualizedCovarianceMatrix,
				covarianceMatrix: mvoResult.covarianceMatrix,
			},
			views: views.map((v) => ({
				category: v.category,
				direction: v.direction,
				magnitude: v.magnitude,
				confidence: v.confidence,
			})),
			config,
		});

		if (!py || py.error) return null;

		// Map Python dict-based returns to array-based as BLResult expects
		const posteriorReturns = mvoResult.categories.map(
			(c: string) => (py.posteriorReturns as Record<string, number>)[c] ?? 0,
		);
		const impliedReturns = mvoResult.categories.map(
			(c: string) => (py.impliedReturns as Record<string, number>)[c] ?? 0,
		);

		const blResult: BLResult = {
			categories: mvoResult.categories,
			posteriorWeights: py.posteriorWeights,
			posteriorReturns,
			impliedReturns,
			viewAdjustments: py.tacticalTilts ?? {},
			tacticalTilts: py.tacticalTilts ?? {},
			modelVersion: py.modelVersion ?? "py-bl-v1",
		};

		return blResult;
	}

	private async tryPythonDrift(
		driftMetrics: QuantInput["driftMetrics"],
		toleranceBandPct: number,
		policyTrigger: number,
	): Promise<DriftPredictionResult | null> {
		if (!isPythonServiceConfigured()) return null;

		const py = await callPython<any>("/api/quant/drift-predict", "POST", {
			driftMetrics,
			toleranceBandPct,
		});

		if (!py || py.error || !py.predictions) return null;

		const predictions = (py.predictions as any[]).map((p) => ({
			category: p.category,
			breachProbability: p.breachProbability,
			predictedDrift: p.driftVelocity ?? 0,
			predictedDriftDirection: (p.breachProbability > 0.5
				? "OVERWEIGHT"
				: "STABLE") as "OVERWEIGHT" | "UNDERWEIGHT" | "STABLE",
			timeToBreachDays: p.daysToBreachMean ?? null,
			confidence: p.rSquared ?? 0.5,
			// Type cast: Python model provides predictions without full DriftFeatures internals;
			// features here serve as explainability metadata only, not for downstream ML scoring.
			features: {
				category: p.category ?? "",
				currentWeight: p.currentWeight ?? 0,
				targetWeight: p.targetWeight ?? 0,
				currentDrift: p.currentDrift ?? 0,
				historicalDriftMean: p.historicalDriftMean ?? 0,
				historicalDriftStd: p.historicalDriftStd ?? 0,
				driftVelocity: p.driftVelocity ?? 0,
				driftAcceleration: p.driftAcceleration ?? 0,
				categoryVolatility: p.categoryVolatility ?? 12,
				daysSinceLastRebalance: p.daysSinceLastRebalance ?? 0,
				marketRegime: (p.marketRegime ?? "NORMAL") as "LOW_VOL" | "NORMAL" | "HIGH_VOL" | "CRISIS",
			},
			triggerPreemptive: p.breachProbability >= policyTrigger,
		}));

		const highRisk = predictions
			.filter((p) => p.triggerPreemptive)
			.map((p) => p.category);
		const portfolioBreachProb =
			predictions.length > 0
				? predictions.reduce((s, p) => s + p.breachProbability, 0) /
					predictions.length
				: 0;

		return {
			predictions,
			portfolioBreachProbability: portfolioBreachProb,
			recommendPreemptiveRebalance: highRisk.length > 0,
			highRiskCategories: highRisk,
			modelVersion: "py-drift-v1",
		};
	}

	convertWeightsToAllocations(
		weights: Record<string, number>,
		categories: string[],
	): Record<string, number> {
		const allocations: Record<string, number> = {};
		let total = 0;

		for (const cat of categories) {
			const pct = Math.round((weights[cat] || 0) * 100);
			allocations[cat] = pct;
			total += pct;
		}

		if (total !== 100 && total > 0) {
			const maxCat = Object.entries(allocations).sort(
				([, a], [, b]) => b - a,
			)[0];
			if (maxCat) {
				allocations[maxCat[0]] += 100 - total;
			}
		}

		return allocations;
	}

	private async logTransition(
		portfolioId: string | undefined,
		mvoResult: MVOResult,
	): Promise<void> {
		if (!mvoResult.transitionMetrics) return;

		const tm = mvoResult.transitionMetrics;
		try {
			await db.insert(quantTransitionLog).values({
				portfolioId: portfolioId || null,
				turnover: tm.turnover,
				maxWeight: tm.maxWeight,
				sectorExposure: tm.sectorExposure,
				categoryExposure: tm.categoryExposure,
				gammaUsed: tm.gammaUsed,
				filteredCount: tm.filteredCount,
				constraintsApplied: tm.constraintsApplied,
				weightsSnapshot: mvoResult.weights,
				sharpeRatio: mvoResult.sharpeRatio,
				portfolioReturn: mvoResult.expectedReturn,
				portfolioVolatility: mvoResult.portfolioVolatility,
				modelVersion: mvoResult.modelVersion,
			});
		} catch (e) {
			logger.warn("[QuantOrch] Failed to log transition", { error: String(e) });
		}
	}

	private async loadGovernancePolicy(riskProfile: string) {
		try {
			const rows = await db
				.select()
				.from(quantGovernancePolicy)
				.where(eq(quantGovernancePolicy.riskProfile, riskProfile))
				.limit(1);

			if (rows[0]) return rows[0];
		} catch (e) {
			logger.warn("[QuantOrch] Failed to load governance policy", { error: String(e) });
		}

		return {
			id: 0,
			riskProfile,
			useMvo: false,
			useBlackLitterman: false,
			useAiDriftPrediction: false,
			riskAversion: 2.5,
			tau: 0.05,
			tacticalBudget: 0.1,
			driftProbabilityTrigger: 0.7,
			maxAssetWeight: 0.4,
			minAssetWeight: 0.0,
			covarianceLookbackDays: 250,
			ewmaSpan: 60,
			shrinkageIntensity: 0.5,
			solverMaxIterations: 1000,
			solverTolerance: 1e-8,
			updatedAt: new Date(),
		};
	}

	private async logFallback(
		portfolioId: string | undefined,
		modelType: string,
		errorMessage: string,
	) {
		try {
			await db.insert(quantRunLog).values({
				portfolioId: portfolioId || null,
				modelType,
				status: "FALLBACK",
				errorMessage,
				fallbackUsed: true,
			});
		} catch (reportErr: any) {
			logger.warn("[QuantOrchestrator] Failed to record fallback status", { error: reportErr?.message });
		}
	}
}

export const quantOrchestrator = new QuantOrchestrator();
