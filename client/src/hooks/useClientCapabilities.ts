import { useQuery } from "@tanstack/react-query";

export interface ClientCapabilities {
	canUseAi: boolean;
	canViewRecommendations: boolean;
	advisoryFeeApplicable: boolean;
	platformFeeApplicable: boolean;
	feeMode: "ADVISORY_PLATFORM" | "PLATFORM_ONLY" | null;
	feeModeSelected: boolean;
	requiresModeSelection: boolean;
	policyVersion: number;
}

interface CapabilitiesResponse {
	success: boolean;
	capabilities: ClientCapabilities;
}

export function useClientCapabilities() {
	const query = useQuery<CapabilitiesResponse>({
		queryKey: ["/api/fee-mode/capabilities"],
		queryFn: async () => {
			const response = await fetch("/api/fee-mode/capabilities", {
				credentials: "include",
			});
			if (!response.ok) {
				throw new Error("Failed to fetch capabilities");
			}
			return response.json();
		},
		staleTime: 60000,
		refetchOnWindowFocus: false,
	});

	return {
		capabilities: query.data?.capabilities ?? null,
		isLoading: query.isLoading,
		isError: query.isError,
		refetch: query.refetch,
		canUseAi: query.data?.capabilities?.canUseAi ?? true,
		canViewRecommendations:
			query.data?.capabilities?.canViewRecommendations ?? true,
		feeMode: query.data?.capabilities?.feeMode ?? null,
		feeModeSelected: query.data?.capabilities?.feeModeSelected ?? false,
		requiresModeSelection:
			query.data?.capabilities?.requiresModeSelection ?? false,
	};
}
