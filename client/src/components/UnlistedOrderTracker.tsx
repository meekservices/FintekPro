import {
	ClipboardList,
	Handshake,
	CreditCard,
	Truck,
	CheckCircle2,
	AlertTriangle,
	Clock,
	XCircle,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface UnlistedOrderTrackerProps {
	status: string;
	statusMessage?: string;
	createdAt?: string;
	matchedAt?: string;
	paymentAt?: string;
	transferAt?: string;
	settledAt?: string;
	expectedSettlement?: string;
}

export function UnlistedOrderTracker({
	status,
	statusMessage,
	createdAt,
	matchedAt,
	paymentAt,
	transferAt,
	settledAt,
	expectedSettlement,
}: UnlistedOrderTrackerProps) {
	const stages = [
		{
			key: "created",
			label: "Request Created",
			icon: ClipboardList,
			date: createdAt,
		},
		{ key: "matched", label: "Deal Matched", icon: Handshake, date: matchedAt },
		{
			key: "payment",
			label: "Payment Confirmed",
			icon: CreditCard,
			date: paymentAt,
		},
		{
			key: "transfer",
			label: "Transfer in Progress",
			icon: Truck,
			date: transferAt,
		},
		{ key: "settled", label: "Settled", icon: CheckCircle2, date: settledAt },
	];

	const getCurrentStageIndex = (status: string): number => {
		const statusMap: Record<string, number> = {
			pending: 0,
			active: 0,
			created: 0,
			matched: 1,
			deal_matched: 1,
			buyer_confirmed: 1,
			seller_confirmed: 1,
			awaiting_payment: 2,
			payment_pending: 2,
			payment_confirmed: 2,
			paid: 2,
			transfer_initiated: 3,
			transfer_pending: 3,
			awaiting_transfer: 3,
			settled: 4,
			completed: 4,
			cancelled: -1,
			rejected: -1,
			expired: -1,
			failed: -1,
		};
		return statusMap[status?.toLowerCase()] ?? 0;
	};

	const currentIndex = getCurrentStageIndex(status);
	const isFailed = currentIndex === -1;

	const getStatusBadge = () => {
		if (isFailed) {
			const variant = status === "cancelled" ? "secondary" : "destructive";
			return (
				<Badge variant={variant} className="capitalize">
					<XCircle className="w-3 h-3 mr-1" />
					{status}
				</Badge>
			);
		}
		if (currentIndex === 4) {
			return (
				<Badge className="bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800">
					<CheckCircle2 className="w-3 h-3 mr-1" />
					Completed
				</Badge>
			);
		}
		return (
			<Badge
				variant="outline"
				className="text-blue-600 border-blue-300 dark:border-blue-700"
			>
				<Clock className="w-3 h-3 mr-1" />
				In Progress
			</Badge>
		);
	};

	if (isFailed) {
		return (
			<div className="space-y-4">
				<div className="flex items-center justify-between">
					<span className="text-sm font-medium text-muted-foreground">
						Order Status
					</span>
					{getStatusBadge()}
				</div>
				<div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
					<div className="flex items-center gap-2 text-red-600 dark:text-red-400">
						<AlertTriangle className="w-5 h-5" />
						<span className="font-medium capitalize">Order {status}</span>
					</div>
					{statusMessage && (
						<p className="text-sm text-red-500 dark:text-red-400 mt-2">
							{statusMessage}
						</p>
					)}
				</div>
			</div>
		);
	}

	return (
		<div className="space-y-4">
			<div className="flex items-center justify-between">
				<span className="text-sm font-medium text-muted-foreground">
					Order Progress
				</span>
				{getStatusBadge()}
			</div>

			<div className="relative">
				<div className="absolute top-5 left-0 right-0 h-1 bg-muted rounded-full" />
				<div
					className="absolute top-5 left-0 h-1 bg-gradient-to-r from-blue-500 to-emerald-500 rounded-full transition-all duration-500"
					style={{ width: `${(currentIndex / (stages.length - 1)) * 100}%` }}
				/>

				<div className="relative flex justify-between">
					{stages.map((stage, index) => {
						const StageIcon = stage.icon;
						const isComplete = index < currentIndex;
						const isCurrent = index === currentIndex;

						return (
							<div
								key={stage.key}
								className="flex flex-col items-center"
								data-testid={`stage-${stage.key}`}
							>
								<div
									className={`w-10 h-10 rounded-full flex items-center justify-center transition-all z-10 ${
										isComplete
											? "bg-emerald-500 text-white"
											: isCurrent
												? "bg-blue-100 dark:bg-blue-900 text-blue-600 border-2 border-blue-500 animate-pulse"
												: "bg-muted text-muted-foreground border border-border"
									}`}
								>
									<StageIcon className="w-5 h-5" />
								</div>
								<span
									className={`text-xs mt-2 text-center max-w-[70px] ${
										isCurrent
											? "font-medium text-blue-600 dark:text-blue-400"
											: isComplete
												? "text-emerald-600 dark:text-emerald-400"
												: "text-muted-foreground"
									}`}
								>
									{stage.label}
								</span>
								{stage.date && (
									<span className="text-[10px] text-muted-foreground mt-1">
										{new Date(stage.date).toLocaleDateString("en-IN", {
											day: "numeric",
											month: "short",
										})}
									</span>
								)}
							</div>
						);
					})}
				</div>
			</div>

			{expectedSettlement && currentIndex < 4 && (
				<div className="text-sm text-muted-foreground text-center mt-4 p-2 bg-muted rounded-lg">
					<Clock className="w-4 h-4 inline mr-1" />
					Expected settlement:{" "}
					{new Date(expectedSettlement).toLocaleDateString("en-IN", {
						weekday: "short",
						month: "short",
						day: "numeric",
					})}
				</div>
			)}
		</div>
	);
}
