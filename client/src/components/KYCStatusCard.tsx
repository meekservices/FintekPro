import { useQuery, useMutation } from "@tanstack/react-query";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Progress } from "@/components/ui/progress";
import {
	CheckCircle2,
	AlertTriangle,
	XCircle,
	Clock,
	Shield as LucideShield,
	TrendingUp,
	Globe,
} from "lucide-react";
import { queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

interface KYCStatus {
	userId: string;
	currentLevel: "none" | "basic" | "enhanced";
	isActive: boolean;
	dueDate: string | null;
	daysUntilExpiry: number | null;
	requiresReKYC: boolean;
	remindersSent: number;
	canTradeMutualFunds: boolean;
	canTradeBroking: boolean;
	canTradeInternational: boolean;
	riskCategory: string;
	reviewFrequency: string;
	lastUpdated: string | null;
	pendingActions: string[];
}

export function KYCStatusCard() {
	const { toast } = useToast();

	const { data: kycStatus, isLoading } = useQuery<{
		success: boolean;
		data: KYCStatus;
	}>({
		queryKey: ["/api/profile/kyc-status"],
	});

	const triggerReKYCMutation = useMutation({
		mutationFn: async () => {
			const response = await fetch("/api/profile/trigger-rekyc", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
			});
			if (!response.ok) throw new Error("Failed to trigger Re-KYC");
			return response.json();
		},
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ["/api/profile/kyc-status"] });
			toast({
				title: "Re-KYC Initiated",
				description:
					"Please complete your KYC verification to continue trading",
			});
		},
		onError: () => {
			toast({
				variant: "destructive",
				title: "Error",
				description: "Failed to initiate Re-KYC process",
			});
		},
	});

	if (isLoading) {
		return (
			<Card data-testid="kyc-status-card">
				<CardHeader>
					<CardTitle>KYC Status</CardTitle>
					<CardDescription>Loading your verification status...</CardDescription>
				</CardHeader>
				<CardContent>
					<div className="space-y-4">
						<div className="h-24 bg-muted animate-pulse rounded-lg" />
						<div className="h-20 bg-muted animate-pulse rounded-lg" />
					</div>
				</CardContent>
			</Card>
		);
	}

	const status = kycStatus?.data;

	if (!status) {
		return (
			<Card data-testid="kyc-status-card">
				<CardHeader>
					<CardTitle>KYC Status</CardTitle>
				</CardHeader>
				<CardContent>
					<Alert>
						<AlertDescription>Unable to load KYC status</AlertDescription>
					</Alert>
				</CardContent>
			</Card>
		);
	}

	// Determine status badge
	const getStatusBadge = () => {
		if (status.requiresReKYC) {
			return (
				<Badge
					variant="destructive"
					className="gap-1"
					data-testid="kyc-badge-expired"
				>
					<XCircle className="h-3 w-3" />
					Expired - Re-KYC Required
				</Badge>
			);
		}

		if (status.daysUntilExpiry !== null && status.daysUntilExpiry <= 30) {
			return (
				<Badge
					variant="default"
					className="gap-1 bg-yellow-500 hover:bg-yellow-600 text-white"
					data-testid="kyc-badge-expiring"
				>
					<AlertTriangle className="h-3 w-3" />
					Expiring Soon ({status.daysUntilExpiry} days)
				</Badge>
			);
		}

		if (status.isActive) {
			return (
				<Badge
					variant="default"
					className="gap-1 bg-green-600 hover:bg-green-700"
					data-testid="kyc-badge-active"
				>
					<CheckCircle2 className="h-3 w-3" />
					Active
				</Badge>
			);
		}

		return (
			<Badge
				variant="outline"
				className="gap-1"
				data-testid="kyc-badge-incomplete"
			>
				<Clock className="h-3 w-3" />
				Incomplete
			</Badge>
		);
	};

	// Determine level color
	const getLevelBadgeColor = () => {
		switch (status.currentLevel) {
			case "enhanced":
				return "bg-green-600 hover:bg-green-700";
			case "basic":
				return "bg-blue-600 hover:bg-blue-700";
			default:
				return "bg-muted-foreground";
		}
	};

	// Calculate completion percentage based on KYC level
	const completionPercentage =
		status.currentLevel === "enhanced"
			? 100
			: status.currentLevel === "basic"
				? 50
				: 25;

	return (
		<Card data-testid="kyc-status-card" className="border-2">
			<CardHeader>
				<div className="flex items-center justify-between">
					<div>
						<CardTitle className="flex items-center gap-2">
							<LucideShield className="h-5 w-5" />
							KYC Verification Status
						</CardTitle>
						<CardDescription>
							Your current verification level and transaction permissions
						</CardDescription>
					</div>
					{getStatusBadge()}
				</div>
			</CardHeader>

			<CardContent className="space-y-6">
				{/* KYC Level */}
				<div className="space-y-2">
					<div className="flex items-center justify-between">
						<span className="text-sm font-medium">Current Level</span>
						<Badge
							className={getLevelBadgeColor()}
							data-testid="kyc-level-badge"
						>
							{status.currentLevel.toUpperCase()} KYC
						</Badge>
					</div>
					<Progress value={completionPercentage} className="h-2" />
					<p className="text-xs text-muted-foreground">
						{completionPercentage}% Complete
					</p>
				</div>

				{/* Expiry Information */}
				{status.dueDate && (
					<div className="rounded-lg border p-3 space-y-1">
						<div className="flex items-center justify-between">
							<span className="text-sm font-medium">Renewal Due</span>
							<span
								className="text-sm text-muted-foreground"
								data-testid="kyc-due-date"
							>
								{new Date(status.dueDate).toLocaleDateString()}
							</span>
						</div>
						{status.daysUntilExpiry !== null && (
							<div className="text-xs text-muted-foreground">
								{status.daysUntilExpiry > 0
									? `${status.daysUntilExpiry} days remaining`
									: `Expired ${Math.abs(status.daysUntilExpiry)} days ago`}
							</div>
						)}
					</div>
				)}

				{/* Permission Matrix */}
				<div className="space-y-3">
					<h4 className="text-sm font-semibold">Transaction Permissions</h4>

					{/* Mutual Funds */}
					<div className="flex items-center justify-between p-2 rounded-lg border">
						<div className="flex items-center gap-2">
							<TrendingUp className="h-4 w-4 text-blue-600" />
							<span className="text-sm">Mutual Funds</span>
						</div>
						{status.canTradeMutualFunds ? (
							<Badge
								variant="default"
								className="bg-green-600"
								data-testid="permission-mf"
							>
								<CheckCircle2 className="h-3 w-3 mr-1" />
								Enabled
							</Badge>
						) : (
							<Badge variant="secondary" data-testid="permission-mf">
								<XCircle className="h-3 w-3 mr-1" />
								Disabled
							</Badge>
						)}
					</div>

					{/* Broking/Stocks */}
					<div className="flex items-center justify-between p-2 rounded-lg border">
						<div className="flex items-center gap-2">
							<TrendingUp className="h-4 w-4 text-purple-600" />
							<span className="text-sm">Stocks & Broking</span>
						</div>
						{status.canTradeBroking ? (
							<Badge
								variant="default"
								className="bg-green-600"
								data-testid="permission-broking"
							>
								<CheckCircle2 className="h-3 w-3 mr-1" />
								Enabled
							</Badge>
						) : (
							<Badge variant="secondary" data-testid="permission-broking">
								<XCircle className="h-3 w-3 mr-1" />
								Requires Full KYC
							</Badge>
						)}
					</div>

					{/* International */}
					<div className="flex items-center justify-between p-2 rounded-lg border">
						<div className="flex items-center gap-2">
							<Globe className="h-4 w-4 text-indigo-600" />
							<span className="text-sm">International Trading</span>
						</div>
						{status.canTradeInternational ? (
							<Badge
								variant="default"
								className="bg-green-600"
								data-testid="permission-international"
							>
								<CheckCircle2 className="h-3 w-3 mr-1" />
								Enabled
							</Badge>
						) : (
							<Badge variant="secondary" data-testid="permission-international">
								<XCircle className="h-3 w-3 mr-1" />
								Requires Enhanced KYC
							</Badge>
						)}
					</div>
				</div>

				{/* Pending Actions */}
				{status.pendingActions.length > 0 && (
					<Alert className="border-yellow-500 bg-yellow-50 dark:bg-yellow-950">
						<AlertTriangle className="h-4 w-4 text-yellow-600" />
						<AlertDescription>
							<p className="font-semibold mb-2">Action Required:</p>
							<ul className="list-disc list-inside space-y-1 text-sm">
								{status.pendingActions.map((action, index) => (
									<li key={index} data-testid={`pending-action-${index}`}>
										{action}
									</li>
								))}
							</ul>
						</AlertDescription>
					</Alert>
				)}

				{/* Action Button */}
				{status.requiresReKYC ? (
					<Button
						onClick={() => triggerReKYCMutation.mutate()}
						className="w-full"
						variant="default"
						disabled={triggerReKYCMutation.isPending}
						data-testid="button-complete-rekyc"
					>
						{triggerReKYCMutation.isPending
							? "Processing..."
							: "Complete Re-KYC Now"}
					</Button>
				) : (
					<div className="flex gap-2">
						<Button
							onClick={() => (window.location.href = "/kyc-dashboard")}
							className="flex-1"
							variant="outline"
							data-testid="button-view-verification"
						>
							<LucideShield className="h-4 w-4 mr-2" />
							View Full Verification Status
						</Button>
						{status.currentLevel !== "enhanced" && (
							<Button
								onClick={() => (window.location.href = "/kyc-dashboard")}
								className="flex-1"
								variant="default"
								data-testid="button-upgrade-kyc"
							>
								Upgrade KYC
							</Button>
						)}
					</div>
				)}

				{/* Additional Info */}
				<div className="text-xs text-muted-foreground space-y-1">
					<p>
						Risk Category:{" "}
						<span className="font-medium capitalize">
							{status.riskCategory}
						</span>
					</p>
					<p>
						Review Frequency:{" "}
						<span className="font-medium">
							{status.reviewFrequency.replace("_", " ")}
						</span>
					</p>
					{status.lastUpdated && (
						<p>
							Last Updated: {new Date(status.lastUpdated).toLocaleDateString()}
						</p>
					)}
				</div>
			</CardContent>
		</Card>
	);
}
