import { useState, useCallback, useRef } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";

export type AnalyticsSection =
	| "capitalGains"
	| "healthScore"
	| "expenseRatio"
	| "dividend"
	| "riskHeatmap"
	| "benchmark"
	| "whatIf"
	| "sipRecommendations"
	| "exitLoad"
	| "priorityRecommendations"
	| "goalGap"
	| "executiveSummary";

interface SectionData {
	data: any;
	version: number;
	computedAt: string;
	assumptions: string[];
	dataSource: "historical" | "estimated";
	isLoading: boolean;
	error: string | null;
}

interface UseSectionAnalyticsOptions {
	holdings: any[];
	riskProfile: any;
	analysis: any;
	enabled?: boolean;
}

interface SectionCache {
	[section: string]: {
		data: any;
		version: number;
		computedAt: string;
		assumptions: string[];
		dataSource: "historical" | "estimated";
		holdingsHash: string;
	};
}

function hashHoldings(holdings: any[]): string {
	return JSON.stringify(
		holdings.map((h) => ({
			name: h.name || h.productName,
			value: h.currentValue,
		})),
	);
}

export function useSectionAnalytics({
	holdings,
	riskProfile,
	analysis,
	enabled = true,
}: UseSectionAnalyticsOptions) {
	const queryClient = useQueryClient();
	const [loadedSections, setLoadedSections] = useState<Set<AnalyticsSection>>(
		new Set(),
	);
	const [sectionData, setSectionData] = useState<Record<string, SectionData>>(
		{},
	);
	const cacheRef = useRef<SectionCache>({});
	const loadingRef = useRef<Set<string>>(new Set());

	const holdingsHash = hashHoldings(holdings);

	const loadSection = useCallback(
		async (section: AnalyticsSection) => {
			if (!enabled || !holdings.length || !riskProfile || !analysis) {
				return null;
			}

			const cached = cacheRef.current[section];
			if (cached && cached.holdingsHash === holdingsHash) {
				setSectionData((prev) => ({
					...prev,
					[section]: {
						data: cached.data,
						version: cached.version,
						computedAt: cached.computedAt,
						assumptions: cached.assumptions,
						dataSource: cached.dataSource,
						isLoading: false,
						error: null,
					},
				}));
				setLoadedSections((prev) => new Set(prev).add(section));
				return cached.data;
			}

			if (loadingRef.current.has(section)) {
				return null;
			}

			loadingRef.current.add(section);
			setSectionData((prev) => ({
				...prev,
				[section]: {
					...prev[section],
					isLoading: true,
					error: null,
				} as SectionData,
			}));

			try {
				const response = await fetch("/api/agent-wizard/proposal-analytics", {
					method: "POST",
					headers: { "Content-Type": "application/json" },
					credentials: "include",
					body: JSON.stringify({
						holdings,
						riskProfile,
						analysis,
						sectionsRequested: [section],
					}),
				});

				if (!response.ok) {
					throw new Error(`Failed to load ${section} analytics`);
				}

				const result = await response.json();

				if (result.success && result.analytics) {
					const sectionResult = result.analytics[section];
					const metadata = result.metadata?.[section] || {};

					cacheRef.current[section] = {
						data: sectionResult,
						version: metadata.version || 1,
						computedAt: metadata.computedAt || new Date().toISOString(),
						assumptions: metadata.assumptions || [],
						dataSource: metadata.dataSource || "estimated",
						holdingsHash,
					};

					setSectionData((prev) => ({
						...prev,
						[section]: {
							data: sectionResult,
							version: metadata.version || 1,
							computedAt: metadata.computedAt || new Date().toISOString(),
							assumptions: metadata.assumptions || [],
							dataSource: metadata.dataSource || "estimated",
							isLoading: false,
							error: null,
						},
					}));

					setLoadedSections((prev) => new Set(prev).add(section));
					return sectionResult;
				}

				throw new Error(result.error || "Unknown error");
			} catch (error: any) {
				setSectionData((prev) => ({
					...prev,
					[section]: {
						...prev[section],
						isLoading: false,
						error: error.message,
					} as SectionData,
				}));
				return null;
			} finally {
				loadingRef.current.delete(section);
			}
		},
		[holdings, riskProfile, analysis, holdingsHash, enabled],
	);

	const loadMultipleSections = useCallback(
		async (sections: AnalyticsSection[]) => {
			if (!enabled || !holdings.length || !riskProfile || !analysis) {
				return {};
			}

			const sectionsToLoad = sections.filter((s) => {
				const cached = cacheRef.current[s];
				return !cached || cached.holdingsHash !== holdingsHash;
			});

			if (sectionsToLoad.length === 0) {
				sections.forEach((section) => {
					const cached = cacheRef.current[section];
					if (cached) {
						setSectionData((prev) => ({
							...prev,
							[section]: {
								data: cached.data,
								version: cached.version,
								computedAt: cached.computedAt,
								assumptions: cached.assumptions,
								dataSource: cached.dataSource,
								isLoading: false,
								error: null,
							},
						}));
					}
				});
				setLoadedSections((prev) => {
					const newSet = new Set(prev);
					sections.forEach((s) => newSet.add(s));
					return newSet;
				});
				return {};
			}

			sectionsToLoad.forEach((section) => {
				loadingRef.current.add(section);
				setSectionData((prev) => ({
					...prev,
					[section]: {
						...prev[section],
						isLoading: true,
						error: null,
					} as SectionData,
				}));
			});

			try {
				const response = await fetch("/api/agent-wizard/proposal-analytics", {
					method: "POST",
					headers: { "Content-Type": "application/json" },
					credentials: "include",
					body: JSON.stringify({
						holdings,
						riskProfile,
						analysis,
						sectionsRequested: sectionsToLoad,
					}),
				});

				if (!response.ok) {
					throw new Error("Failed to load analytics");
				}

				const result = await response.json();

				if (result.success && result.analytics) {
					sectionsToLoad.forEach((section) => {
						const sectionResult = result.analytics[section];
						const metadata = result.metadata?.[section] || {};

						cacheRef.current[section] = {
							data: sectionResult,
							version: metadata.version || 1,
							computedAt: metadata.computedAt || new Date().toISOString(),
							assumptions: metadata.assumptions || [],
							dataSource: metadata.dataSource || "estimated",
							holdingsHash,
						};

						setSectionData((prev) => ({
							...prev,
							[section]: {
								data: sectionResult,
								version: metadata.version || 1,
								computedAt: metadata.computedAt || new Date().toISOString(),
								assumptions: metadata.assumptions || [],
								dataSource: metadata.dataSource || "estimated",
								isLoading: false,
								error: null,
							},
						}));
					});

					setLoadedSections((prev) => {
						const newSet = new Set(prev);
						sectionsToLoad.forEach((s) => newSet.add(s));
						return newSet;
					});

					return result.analytics;
				}

				throw new Error(result.error || "Unknown error");
			} catch (error: any) {
				sectionsToLoad.forEach((section) => {
					setSectionData((prev) => ({
						...prev,
						[section]: {
							...prev[section],
							isLoading: false,
							error: error.message,
						} as SectionData,
					}));
				});
				return {};
			} finally {
				sectionsToLoad.forEach((s) => loadingRef.current.delete(s));
			}
		},
		[holdings, riskProfile, analysis, holdingsHash, enabled],
	);

	const invalidateSection = useCallback((section: AnalyticsSection) => {
		delete cacheRef.current[section];
		setLoadedSections((prev) => {
			const newSet = new Set(prev);
			newSet.delete(section);
			return newSet;
		});
		setSectionData((prev) => {
			const newData = { ...prev };
			delete newData[section];
			return newData;
		});
	}, []);

	const invalidateAll = useCallback(() => {
		cacheRef.current = {};
		setLoadedSections(new Set());
		setSectionData({});
	}, []);

	const getSectionState = useCallback(
		(section: AnalyticsSection): SectionData | null => {
			return sectionData[section] || null;
		},
		[sectionData],
	);

	const isSectionLoaded = useCallback(
		(section: AnalyticsSection): boolean => {
			return loadedSections.has(section);
		},
		[loadedSections],
	);

	const isSectionLoading = useCallback(
		(section: AnalyticsSection): boolean => {
			return sectionData[section]?.isLoading || false;
		},
		[sectionData],
	);

	return {
		loadSection,
		loadMultipleSections,
		invalidateSection,
		invalidateAll,
		getSectionState,
		isSectionLoaded,
		isSectionLoading,
		sectionData,
		loadedSections,
	};
}
