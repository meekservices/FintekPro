import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
	X,
	Shield as LucideShield,
	AlertTriangle,
	ChevronRight,
	Lock,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { useLocation } from "wouter";

interface KycNotificationData {
	hasIncompleteKyc: boolean;
	currentTier: string;
	percentComplete: number;
	missingSteps: string[];
	blockedProducts: string[];
	urgencyLevel: "low" | "medium" | "high";
	notifications: any[];
}

export function KycUpgradeBanner() {
	const [, setLocation] = useLocation();
	const [isDismissed, setIsDismissed] = useState(false);

	const { data: kycData, isLoading } = useQuery<KycNotificationData>({
		queryKey: ["/api/kyc/notification-status"],
		staleTime: 5 * 60 * 1000,
		refetchOnWindowFocus: false,
	});

	if (isLoading || !kycData || !kycData.hasIncompleteKyc || isDismissed) {
		return null;
	}

	const {
		currentTier,
		percentComplete,
		missingSteps,
		blockedProducts,
		urgencyLevel,
	} = kycData;

	const getBannerStyle = () => {
		switch (urgencyLevel) {
			case "high":
				return "bg-red-50 border-red-200 dark:bg-red-950 dark:border-red-800";
			case "medium":
				return "bg-amber-50 border-amber-200 dark:bg-amber-950 dark:border-amber-800";
			default:
				return "bg-blue-50 border-blue-200 dark:bg-blue-950 dark:border-blue-800";
		}
	};

	const getIconStyle = () => {
		switch (urgencyLevel) {
			case "high":
				return "text-red-600 dark:text-red-400";
			case "medium":
				return "text-amber-600 dark:text-amber-400";
			default:
				return "text-blue-600 dark:text-blue-400";
		}
	};

	const getButtonStyle = () => {
		switch (urgencyLevel) {
			case "high":
				return "bg-red-600 hover:bg-red-700 text-white";
			case "medium":
				return "bg-amber-600 hover:bg-amber-700 text-white";
			default:
				return "bg-blue-600 hover:bg-blue-700 text-white";
		}
	};

	const getTitle = () => {
		switch (urgencyLevel) {
			case "high":
				return "Action Required: Complete Your KYC";
			case "medium":
				return "Complete Your KYC to Unlock Features";
			default:
				return "Upgrade Your Account";
		}
	};

	const handleCompleteKyc = () => {
		setLocation("/kyc/complete");
	};

	const canDismiss = urgencyLevel !== "high";

	return (
		<div
			className={`relative border-b ${getBannerStyle()}`}
			data-testid="kyc-upgrade-banner"
		>
			<div className="container mx-auto px-4 py-3">
				<div className="flex items-center justify-between gap-4">
					<div className="flex items-center gap-3 flex-1">
						{urgencyLevel === "high" ? (
							<AlertTriangle
								className={`h-5 w-5 ${getIconStyle()} flex-shrink-0`}
							/>
						) : (
							<LucideShield
								className={`h-5 w-5 ${getIconStyle()} flex-shrink-0`}
							/>
						)}

						<div className="flex-1 min-w-0">
							<div className="flex items-center gap-3 flex-wrap">
								<h4 className="font-semibold text-sm text-foreground">
									{getTitle()}
								</h4>
								<span className="text-xs px-2 py-0.5 rounded-full bg-muted text-muted-foreground">
									{currentTier.toUpperCase()} Tier
								</span>
							</div>

							<div className="mt-1 flex items-center gap-4">
								<div className="flex-1 max-w-xs">
									<Progress value={percentComplete} className="h-2" />
								</div>
								<span className="text-xs text-muted-foreground">
									{percentComplete}% Complete
								</span>
							</div>

							{missingSteps.length > 0 && (
								<p className="text-xs text-muted-foreground mt-1">
									Next: {missingSteps[0]}
								</p>
							)}
						</div>
					</div>

					<div className="flex items-center gap-2">
						{blockedProducts.length > 0 && (
							<div className="hidden md:flex items-center gap-1 text-xs text-muted-foreground">
								<Lock className="h-3 w-3" />
								<span>{blockedProducts.length} products locked</span>
							</div>
						)}

						<Button
							size="sm"
							className={getButtonStyle()}
							onClick={handleCompleteKyc}
							data-testid="button-complete-kyc"
						>
							Complete KYC
							<ChevronRight className="h-4 w-4 ml-1" />
						</Button>

						{canDismiss && (
							<Button
								variant="ghost"
								size="sm"
								className="h-8 w-8 p-0"
								onClick={() => setIsDismissed(true)}
								data-testid="button-dismiss-kyc-banner"
							>
								<X className="h-4 w-4" />
							</Button>
						)}
					</div>
				</div>
			</div>
		</div>
	);
}

export function KycBlockedProductAlert({
	productName,
}: { productName: string }) {
	const [, setLocation] = useLocation();

	return (
		<Alert
			variant="destructive"
			className="mb-4"
			data-testid="kyc-blocked-alert"
		>
			<Lock className="h-4 w-4" />
			<AlertTitle>KYC Required</AlertTitle>
			<AlertDescription className="flex items-center justify-between">
				<span>Complete your KYC verification to access {productName}.</span>
				<Button
					size="sm"
					variant="outline"
					onClick={() => setLocation("/kyc/complete")}
					data-testid="button-unlock-product"
				>
					Unlock Now
				</Button>
			</AlertDescription>
		</Alert>
	);
}

export function KycProgressWidget() {
	const [, setLocation] = useLocation();

	const { data: kycData, isLoading } = useQuery<KycNotificationData>({
		queryKey: ["/api/kyc/notification-status"],
		staleTime: 5 * 60 * 1000,
	});

	if (isLoading) {
		return (
			<div className="p-4 border rounded-lg bg-muted animate-pulse">
				<div className="h-4 bg-muted rounded w-3/4 mb-2" />
				<div className="h-2 bg-muted rounded w-full mb-2" />
				<div className="h-3 bg-muted rounded w-1/2" />
			</div>
		);
	}

	if (!kycData || !kycData.hasIncompleteKyc) {
		return (
			<div
				className="p-4 border rounded-lg bg-green-50 dark:bg-green-950 border-green-200 dark:border-green-800"
				data-testid="kyc-complete-widget"
			>
				<div className="flex items-center gap-2">
					<LucideShield className="h-5 w-5 text-green-600 dark:text-green-400" />
					<span className="font-medium text-green-700 dark:text-green-300">
						KYC Complete
					</span>
				</div>
				<p className="text-sm text-green-600 dark:text-green-400 mt-1">
					Your account is fully verified
				</p>
			</div>
		);
	}

	const { currentTier, percentComplete, missingSteps, blockedProducts } =
		kycData;

	return (
		<div
			className="p-4 border rounded-lg bg-card"
			data-testid="kyc-progress-widget"
		>
			<div className="flex items-center justify-between mb-3">
				<h3 className="font-semibold text-foreground">KYC Progress</h3>
				<span className="text-xs px-2 py-0.5 rounded-full bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300">
					{currentTier.toUpperCase()}
				</span>
			</div>

			<div className="mb-3">
				<div className="flex items-center justify-between text-sm mb-1">
					<span className="text-muted-foreground">Verification Progress</span>
					<span className="font-medium">{percentComplete}%</span>
				</div>
				<Progress value={percentComplete} className="h-2" />
			</div>

			{missingSteps.length > 0 && (
				<div className="space-y-2 mb-4">
					<p className="text-xs text-muted-foreground font-medium">
						Remaining Steps:
					</p>
					{missingSteps.slice(0, 3).map((step, index) => (
						<div
							key={index}
							className="flex items-center gap-2 text-sm text-muted-foreground"
						>
							<div className="w-5 h-5 rounded-full border-2 border-border flex items-center justify-center text-xs">
								{index + 1}
							</div>
							{step}
						</div>
					))}
					{missingSteps.length > 3 && (
						<p className="text-xs text-muted-foreground">
							+{missingSteps.length - 3} more steps
						</p>
					)}
				</div>
			)}

			{blockedProducts.length > 0 && (
				<div className="text-xs text-muted-foreground mb-3">
					<Lock className="h-3 w-3 inline mr-1" />
					{blockedProducts.length} products blocked until KYC complete
				</div>
			)}

			<Button
				className="w-full"
				onClick={() => setLocation("/kyc/complete")}
				data-testid="button-continue-kyc"
			>
				Continue Verification
				<ChevronRight className="h-4 w-4 ml-1" />
			</Button>
		</div>
	);
}
