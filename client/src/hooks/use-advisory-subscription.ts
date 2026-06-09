import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";

interface AdvisorySubscription {
	id: string;
	userId: string;
	planName: string;
	planType: string;
	startDate: string;
	endDate: string | null;
	status: string;
	directFundsAccess: boolean;
	subscriptionFee: string | null;
	feeFrequency: string | null;
}

interface AdvisoryCheckResponse {
	success: boolean;
	hasAdvisorySubscription: boolean;
	subscription: AdvisorySubscription | null;
	directFundsAccess: boolean;
}

export function useAdvisorySubscription() {
	const { user, isAuthenticated } = useAuth();

	const { data, isLoading, error } = useQuery<AdvisoryCheckResponse>({
		queryKey: ["/api/user/advisory-subscription"],
		enabled: isAuthenticated && !!user,
		staleTime: 5 * 60 * 1000,
		gcTime: 10 * 60 * 1000,
	});

	return {
		hasAdvisorySubscription: data?.hasAdvisorySubscription ?? false,
		directFundsAccess: data?.directFundsAccess ?? false,
		subscription: data?.subscription ?? null,
		isLoading,
		error,
	};
}

export function useCanAccessDirectFunds() {
	const { directFundsAccess, isLoading } = useAdvisorySubscription();
	return { canAccess: directFundsAccess, isLoading };
}
