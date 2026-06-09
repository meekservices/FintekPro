import { useState, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";

export type TransactionType =
	| "mutual_funds"
	| "insurance"
	| "loans"
	| "bonds"
	| "ipo"
	| "nps"
	| "unlisted"
	| "reit"
	| "equity_india"
	| "fno"
	| "commodities"
	| "us_equity"
	| "pms"
	| "aif"
	| "mld";

export interface KycCheckResult {
	success: boolean;
	canProceed: boolean;
	transactionType: string;
	productLabel: string;
	sebiRef?: string;
	currentLevel: number;
	requiredLevel: number;
	missingSteps: string[];
	kycPath: string;
	allRequiredSteps: string[];
}

interface KycGuardState {
	open: boolean;
	transactionType: TransactionType | null;
	checkResult: KycCheckResult | null;
	pendingAction: (() => void) | null;
}

export function useKycGuard() {
	const [, navigate] = useLocation();
	const [state, setState] = useState<KycGuardState>({
		open: false,
		transactionType: null,
		checkResult: null,
		pendingAction: null,
	});
	const [isChecking, setIsChecking] = useState(false);

	const guardAction = useCallback(
		async (transactionType: TransactionType, action: () => void) => {
			setIsChecking(true);
			try {
				const res = await fetch(
					`/api/kyc/transaction-check?type=${transactionType}`,
					{
						credentials: "include",
					},
				);

				if (res.status === 401) {
					// Not logged in — redirect to auth
					navigate("/auth");
					return;
				}

				const data: KycCheckResult = await res.json();

				if (data.canProceed) {
					// KYC is sufficient — run the action immediately
					action();
				} else {
					// KYC is insufficient — show the modal
					setState({
						open: true,
						transactionType,
						checkResult: data,
						pendingAction: action,
					});
				}
			} catch {
				// Network error — allow action (don't block on error)
				action();
			} finally {
				setIsChecking(false);
			}
		},
		[navigate],
	);

	const closeModal = useCallback(() => {
		setState((prev) => ({ ...prev, open: false, pendingAction: null }));
	}, []);

	const proceedToKyc = useCallback(
		(returnPath?: string) => {
			const kycPath = state.checkResult?.kycPath || "/onboarding";
			const returnTo = encodeURIComponent(
				returnPath || window.location.pathname + window.location.search,
			);
			closeModal();
			navigate(`${kycPath}&returnTo=${returnTo}`);
		},
		[state.checkResult, closeModal, navigate],
	);

	return {
		guardAction,
		isChecking,
		modalState: state,
		closeModal,
		proceedToKyc,
	};
}
