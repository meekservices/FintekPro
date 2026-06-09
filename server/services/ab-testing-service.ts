import {
	RecommendationMode,
	ExperimentAssignment,
	RECOMMENDATION_MODE,
} from "@shared/profit-optimized-scoring";

interface ExperimentConfig {
	experimentId: string;
	name: string;
	startDate: Date;
	endDate?: Date;
	isActive: boolean;
	groupAMode: RecommendationMode;
	groupBMode: RecommendationMode;
	groupSplit: number;
	eligibilityCriteria: {
		minRiskLevel?: string;
		clientCategories?: string[];
		excludeNewClients?: boolean;
	};
}

interface ExperimentMetrics {
	experimentId: string;
	groupA: GroupMetrics;
	groupB: GroupMetrics;
	statisticalSignificance?: number;
}

interface GroupMetrics {
	clientCount: number;
	recommendationAcceptanceRate: number;
	avgAllocationToGrowthAssets: number;
	avgTimeToDecision: number;
	aiExplanationEngagement: number;
}

interface SafetyThresholds {
	maxDrawdown: number;
	maxComplaintRate: number;
	maxRestrictedAssetExposure: number;
}

class ABTestingService {
	private assignments: Map<string, ExperimentAssignment> = new Map();
	private experiments: Map<string, ExperimentConfig> = new Map();
	private metrics: Map<string, { groupA: any[]; groupB: any[] }> = new Map();
	private safetyThresholds: SafetyThresholds = {
		maxDrawdown: 15,
		maxComplaintRate: 2,
		maxRestrictedAssetExposure: 30,
	};

	private defaultExperiment: ExperimentConfig = {
		experimentId: "exp_growth_optimized_v1",
		name: "Growth-Optimized vs Balanced",
		startDate: new Date(),
		isActive: process.env.NODE_ENV === "production",
		groupAMode: RECOMMENDATION_MODE.BALANCED,
		groupBMode: RECOMMENDATION_MODE.GROWTH_OPTIMIZED,
		groupSplit: 0.5,
		eligibilityCriteria: {
			minRiskLevel: "moderate",
			clientCategories: ["HNI", "sHNI", "bHNI"],
			excludeNewClients: true,
		},
	};

	constructor() {
		this.experiments.set(
			this.defaultExperiment.experimentId,
			this.defaultExperiment,
		);
		console.log("✅ A/B Testing Service initialized");
	}

	assignClient(
		clientId: string,
		clientProfile: {
			risk_category: string;
			client_category: string;
			created_at?: Date;
		},
	): ExperimentAssignment | null {
		if (this.assignments.has(clientId)) {
			return this.assignments.get(clientId)!;
		}

		const experiment = this.getActiveExperiment();
		if (!experiment) {
			return null;
		}

		if (!this.isClientEligible(clientProfile, experiment)) {
			return null;
		}

		const hashValue = this.hashClientId(clientId);
		const group = hashValue < experiment.groupSplit ? "A" : "B";
		const mode = group === "A" ? experiment.groupAMode : experiment.groupBMode;

		const assignment: ExperimentAssignment = {
			clientId,
			group,
			mode,
			assignedAt: new Date(),
			experimentId: experiment.experimentId,
		};

		this.assignments.set(clientId, assignment);
		console.log(
			`[A/B TEST] Client ${clientId} assigned to Group ${group} (${mode})`,
		);

		return assignment;
	}

	private hashClientId(clientId: string): number {
		let hash = 0;
		for (let i = 0; i < clientId.length; i++) {
			const char = clientId.charCodeAt(i);
			hash = (hash << 5) - hash + char;
			hash = hash & hash;
		}
		return Math.abs(hash % 100) / 100;
	}

	private isClientEligible(
		clientProfile: {
			risk_category: string;
			client_category: string;
			created_at?: Date;
		},
		experiment: ExperimentConfig,
	): boolean {
		const { eligibilityCriteria } = experiment;

		if (eligibilityCriteria.minRiskLevel) {
			const riskHierarchy = {
				conservative: 1,
				moderate: 2,
				aggressive: 3,
				very_aggressive: 4,
			};
			const clientRisk =
				riskHierarchy[
					clientProfile.risk_category as keyof typeof riskHierarchy
				] || 1;
			const minRisk =
				riskHierarchy[
					eligibilityCriteria.minRiskLevel as keyof typeof riskHierarchy
				] || 2;

			if (clientRisk < minRisk) {
				return false;
			}
		}

		if (eligibilityCriteria.clientCategories) {
			if (
				!eligibilityCriteria.clientCategories.includes(
					clientProfile.client_category,
				)
			) {
				return false;
			}
		}

		if (eligibilityCriteria.excludeNewClients && clientProfile.created_at) {
			const thirtyDaysAgo = new Date();
			thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

			if (clientProfile.created_at > thirtyDaysAgo) {
				return false;
			}
		}

		return true;
	}

	getActiveExperiment(): ExperimentConfig | null {
		for (const experiment of this.experiments.values()) {
			if (experiment.isActive) {
				if (experiment.endDate && new Date() > experiment.endDate) {
					experiment.isActive = false;
					continue;
				}
				return experiment;
			}
		}
		return null;
	}

	getAssignment(clientId: string): ExperimentAssignment | null {
		return this.assignments.get(clientId) || null;
	}

	recordMetric(
		clientId: string,
		metricType: "acceptance" | "allocation" | "time_to_decision" | "engagement",
		value: number,
	): void {
		const assignment = this.assignments.get(clientId);
		if (!assignment) return;

		const experimentMetrics = this.metrics.get(assignment.experimentId) || {
			groupA: [],
			groupB: [],
		};
		const groupMetrics =
			assignment.group === "A"
				? experimentMetrics.groupA
				: experimentMetrics.groupB;

		groupMetrics.push({
			clientId,
			metricType,
			value,
			timestamp: new Date(),
		});

		this.metrics.set(assignment.experimentId, experimentMetrics);
	}

	getExperimentMetrics(experimentId?: string): ExperimentMetrics | null {
		const expId = experimentId || this.defaultExperiment.experimentId;
		const rawMetrics = this.metrics.get(expId);

		if (!rawMetrics) {
			return {
				experimentId: expId,
				groupA: this.getEmptyGroupMetrics(),
				groupB: this.getEmptyGroupMetrics(),
			};
		}

		return {
			experimentId: expId,
			groupA: this.calculateGroupMetrics(rawMetrics.groupA),
			groupB: this.calculateGroupMetrics(rawMetrics.groupB),
			statisticalSignificance: this.calculateSignificance(rawMetrics),
		};
	}

	private getEmptyGroupMetrics(): GroupMetrics {
		return {
			clientCount: 0,
			recommendationAcceptanceRate: 0,
			avgAllocationToGrowthAssets: 0,
			avgTimeToDecision: 0,
			aiExplanationEngagement: 0,
		};
	}

	private calculateGroupMetrics(metrics: any[]): GroupMetrics {
		if (metrics.length === 0) {
			return this.getEmptyGroupMetrics();
		}

		const uniqueClients = new Set(metrics.map((m) => m.clientId));

		const acceptanceMetrics = metrics.filter(
			(m) => m.metricType === "acceptance",
		);
		const allocationMetrics = metrics.filter(
			(m) => m.metricType === "allocation",
		);
		const timeMetrics = metrics.filter(
			(m) => m.metricType === "time_to_decision",
		);
		const engagementMetrics = metrics.filter(
			(m) => m.metricType === "engagement",
		);

		return {
			clientCount: uniqueClients.size,
			recommendationAcceptanceRate:
				acceptanceMetrics.length > 0
					? acceptanceMetrics.reduce((sum, m) => sum + m.value, 0) /
						acceptanceMetrics.length
					: 0,
			avgAllocationToGrowthAssets:
				allocationMetrics.length > 0
					? allocationMetrics.reduce((sum, m) => sum + m.value, 0) /
						allocationMetrics.length
					: 0,
			avgTimeToDecision:
				timeMetrics.length > 0
					? timeMetrics.reduce((sum, m) => sum + m.value, 0) /
						timeMetrics.length
					: 0,
			aiExplanationEngagement:
				engagementMetrics.length > 0
					? engagementMetrics.reduce((sum, m) => sum + m.value, 0) /
						engagementMetrics.length
					: 0,
		};
	}

	private calculateSignificance(rawMetrics: {
		groupA: any[];
		groupB: any[];
	}): number {
		const minSampleSize = 30;
		if (
			rawMetrics.groupA.length < minSampleSize ||
			rawMetrics.groupB.length < minSampleSize
		) {
			return 0;
		}

		const aAcceptance = rawMetrics.groupA.filter(
			(m) => m.metricType === "acceptance",
		);
		const bAcceptance = rawMetrics.groupB.filter(
			(m) => m.metricType === "acceptance",
		);

		if (aAcceptance.length < 10 || bAcceptance.length < 10) {
			return 0;
		}

		const pA =
			aAcceptance.reduce((sum, m) => sum + m.value, 0) / aAcceptance.length;
		const pB =
			bAcceptance.reduce((sum, m) => sum + m.value, 0) / bAcceptance.length;
		const pooledP =
			(pA * aAcceptance.length + pB * bAcceptance.length) /
			(aAcceptance.length + bAcceptance.length);

		const se = Math.sqrt(
			pooledP *
				(1 - pooledP) *
				(1 / aAcceptance.length + 1 / bAcceptance.length),
		);

		if (se === 0) return 0;

		const zScore = Math.abs(pB - pA) / se;
		const confidence = Math.min(99.9, this.zToConfidence(zScore));

		return confidence;
	}

	private zToConfidence(z: number): number {
		if (z >= 2.576) return 99;
		if (z >= 1.96) return 95;
		if (z >= 1.645) return 90;
		if (z >= 1.282) return 80;
		return Math.round(z * 40);
	}

	checkSafetyThresholds(metrics: {
		drawdown?: number;
		complaintRate?: number;
		restrictedAssetExposure?: number;
	}): { safe: boolean; violations: string[] } {
		const violations: string[] = [];

		if (
			metrics.drawdown !== undefined &&
			metrics.drawdown > this.safetyThresholds.maxDrawdown
		) {
			violations.push(
				`Drawdown ${metrics.drawdown}% exceeds threshold ${this.safetyThresholds.maxDrawdown}%`,
			);
		}

		if (
			metrics.complaintRate !== undefined &&
			metrics.complaintRate > this.safetyThresholds.maxComplaintRate
		) {
			violations.push(
				`Complaint rate ${metrics.complaintRate}% exceeds threshold ${this.safetyThresholds.maxComplaintRate}%`,
			);
		}

		if (
			metrics.restrictedAssetExposure !== undefined &&
			metrics.restrictedAssetExposure >
				this.safetyThresholds.maxRestrictedAssetExposure
		) {
			violations.push(
				`Restricted asset exposure ${metrics.restrictedAssetExposure}% exceeds threshold ${this.safetyThresholds.maxRestrictedAssetExposure}%`,
			);
		}

		return {
			safe: violations.length === 0,
			violations,
		};
	}

	updateSafetyThresholds(thresholds: Partial<SafetyThresholds>): void {
		this.safetyThresholds = { ...this.safetyThresholds, ...thresholds };
		console.log(`[A/B TEST] Safety thresholds updated:`, this.safetyThresholds);
	}

	getSafetyThresholds(): SafetyThresholds {
		return { ...this.safetyThresholds };
	}

	createExperiment(
		config: Omit<ExperimentConfig, "experimentId">,
	): ExperimentConfig {
		const experimentId = `exp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
		const experiment: ExperimentConfig = { ...config, experimentId };

		this.experiments.set(experimentId, experiment);
		console.log(`[A/B TEST] New experiment created: ${experiment.name}`);

		return experiment;
	}

	endExperiment(experimentId: string): void {
		const experiment = this.experiments.get(experimentId);
		if (experiment) {
			experiment.isActive = false;
			experiment.endDate = new Date();
			console.log(`[A/B TEST] Experiment ended: ${experiment.name}`);
		}
	}

	getExperimentSummary(): {
		activeExperiment: ExperimentConfig | null;
		totalAssignments: number;
		groupACount: number;
		groupBCount: number;
		safetyStatus: { safe: boolean; violations: string[] };
	} {
		const active = this.getActiveExperiment();

		let groupACount = 0;
		let groupBCount = 0;

		for (const assignment of this.assignments.values()) {
			if (assignment.group === "A") groupACount++;
			else groupBCount++;
		}

		return {
			activeExperiment: active,
			totalAssignments: this.assignments.size,
			groupACount,
			groupBCount,
			safetyStatus: this.checkSafetyThresholds({}),
		};
	}
}

export const abTestingService = new ABTestingService();
