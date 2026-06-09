import { useQuery } from "@tanstack/react-query";

export type PlanTier = "free" | "pro" | "elite";

export interface SubscriptionStatus {
	tier: PlanTier;
	planName: string;
	planExpiresAt: string | null;
	isActive: boolean;
	fxSpreadPct: number;
	tradeFeeInr: number | null;
	features: string[];
	subscription: {
		id: string;
		planTier: string;
		billingCycle: string;
		amountPaise: number;
		status: string;
		startsAt: string;
		expiresAt: string;
	} | null;
}

export function useSubscription() {
	return useQuery<SubscriptionStatus>({
		queryKey: ["/api/subscriptions/status"],
		retry: false,
		staleTime: 60_000,
	});
}

export function isPro(tier?: PlanTier | null): boolean {
	return tier === "pro" || tier === "elite";
}

export function isElite(tier?: PlanTier | null): boolean {
	return tier === "elite";
}
