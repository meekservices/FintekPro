import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";

export type SchemeType = "epf" | "ppf" | "eps" | "nps" | "apy" | "insurance";

interface ConsentStatus {
	hasConsent: boolean;
	panNumber: string;
	schemeType: SchemeType;
}

interface ConsentHook {
	checkConsent: (
		panNumber: string,
		schemeType: SchemeType,
	) => Promise<ConsentStatus>;
	grantConsent: (
		panNumber: string,
		schemeType: SchemeType,
		purpose?: string,
	) => Promise<void>;
	revokeConsent: (panNumber: string, schemeType: SchemeType) => Promise<void>;
	getConsents: (panNumber?: string) => any;
	isCheckingConsent: boolean;
	isGrantingConsent: boolean;
	isRevokingConsent: boolean;
}

export function useConsent(): ConsentHook {
	const queryClient = useQueryClient();

	const checkConsentQuery = async (
		panNumber: string,
		schemeType: SchemeType,
	): Promise<ConsentStatus> => {
		const response = await fetch(
			`/api/government-schemes/consent/${panNumber}/${schemeType}`,
			{
				credentials: "include",
			},
		);

		if (!response.ok) {
			throw new Error(`Failed to check consent: ${response.statusText}`);
		}

		return response.json();
	};

	const grantConsentMutation = useMutation({
		mutationFn: async ({
			panNumber,
			schemeType,
			purpose,
		}: {
			panNumber: string;
			schemeType: SchemeType;
			purpose?: string;
		}) => {
			return await apiRequest("/api/government-schemes/consent", {
				method: "POST",
				body: JSON.stringify({
					panNumber,
					schemeType,
					purpose:
						purpose ||
						"Access government scheme holdings data for portfolio management",
				}),
				headers: {
					"Content-Type": "application/json",
				},
			});
		},
		onSuccess: () => {
			queryClient.invalidateQueries({
				queryKey: ["government-schemes", "consent"],
			});
			queryClient.invalidateQueries({ queryKey: ["government-schemes"] });
		},
	});

	const revokeConsentMutation = useMutation({
		mutationFn: async ({
			panNumber,
			schemeType,
		}: { panNumber: string; schemeType: SchemeType }) => {
			const response = await fetch(
				`/api/government-schemes/consent/${panNumber}/${schemeType}`,
				{
					method: "DELETE",
					credentials: "include",
				},
			);

			if (!response.ok) {
				throw new Error(`Failed to revoke consent: ${response.statusText}`);
			}

			return response.json();
		},
		onSuccess: () => {
			queryClient.invalidateQueries({
				queryKey: ["government-schemes", "consent"],
			});
			queryClient.invalidateQueries({ queryKey: ["government-schemes"] });
		},
	});

	const consentsQuery = useQuery({
		queryKey: ["government-schemes", "consents"],
		queryFn: async () => {
			const response = await fetch("/api/government-schemes/consents", {
				credentials: "include",
			});

			if (!response.ok) {
				throw new Error(`Failed to fetch consents: ${response.statusText}`);
			}

			return response.json();
		},
	});

	return {
		checkConsent: checkConsentQuery,
		grantConsent: async (
			panNumber: string,
			schemeType: SchemeType,
			purpose?: string,
		) => {
			await grantConsentMutation.mutateAsync({
				panNumber,
				schemeType,
				purpose,
			});
		},
		revokeConsent: async (panNumber: string, schemeType: SchemeType) => {
			await revokeConsentMutation.mutateAsync({ panNumber, schemeType });
		},
		getConsents: (panNumber?: string) => consentsQuery,
		isCheckingConsent: false,
		isGrantingConsent: grantConsentMutation.isPending,
		isRevokingConsent: revokeConsentMutation.isPending,
	};
}
