import { ReactNode } from "react";
import { AlertTriangle, Clock, RefreshCw, Wifi } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

interface PythonServiceUnavailableProps {
	feature: string;
	reason?: string;
	fallback?: ReactNode;
	latency?: number;
	onRetry?: () => void;
}

const FEATURE_LABELS: Record<string, string> = {
	xirr: "XIRR Calculator",
	"portfolio-xirr": "Portfolio XIRR",
	"rolling-returns": "Rolling Returns",
	mvo: "MVO Optimizer",
	"black-litterman": "Black-Litterman Model",
	backtest: "Backtesting Engine",
	"drift-predict": "Drift Predictor",
	"return-forecast": "Return Forecasting",
	"sip-simulate": "SIP Simulator",
	"portfolio-overlap": "Portfolio Overlap Analysis",
	"portfolio-rebalance": "Portfolio Rebalancer",
	"asset-allocation": "Asset Allocation Optimizer",
	analytics: "Analytics Service",
	health: "Health Monitor",
};

function getFeatureLabel(feature: string): string {
	return (
		FEATURE_LABELS[feature] ??
		feature.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())
	);
}

export default function PythonServiceUnavailable({
	feature,
	reason = "Analytics service temporarily unavailable",
	fallback,
	latency,
	onRetry,
}: PythonServiceUnavailableProps) {
	const featureLabel = getFeatureLabel(feature);

	return (
		<Card className="border-amber-200 dark:border-amber-800 bg-amber-50/50 dark:bg-amber-950/20">
			<CardHeader className="pb-3">
				<div className="flex items-start justify-between gap-4">
					<div className="flex items-center gap-3">
						<div className="p-2 rounded-full bg-amber-100 dark:bg-amber-900/40">
							<AlertTriangle className="h-5 w-5 text-amber-600 dark:text-amber-400" />
						</div>
						<div>
							<CardTitle className="text-base text-amber-800 dark:text-amber-300">
								{featureLabel} Unavailable
							</CardTitle>
							<p className="text-sm text-amber-700 dark:text-amber-400 mt-0.5">
								{reason}
							</p>
						</div>
					</div>
					<div className="flex items-center gap-2 shrink-0">
						<Badge
							variant="outline"
							className="text-amber-700 border-amber-300 dark:text-amber-400 dark:border-amber-700 gap-1"
						>
							<Wifi className="h-3 w-3" />
							Basic Mode
						</Badge>
						{latency !== undefined && (
							<Badge
								variant="outline"
								className="text-muted-foreground gap-1 text-xs"
							>
								<Clock className="h-3 w-3" />
								{latency}ms
							</Badge>
						)}
					</div>
				</div>
			</CardHeader>

			{(fallback || onRetry) && (
				<CardContent className="pt-0 space-y-4">
					{fallback && (
						<div className="p-3 rounded-md bg-amber-100/60 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800">
							<p className="text-xs font-medium text-amber-700 dark:text-amber-400 uppercase tracking-wide mb-2">
								Basic Mode Estimate
							</p>
							{fallback}
						</div>
					)}
					{onRetry && (
						<Button
							variant="outline"
							size="sm"
							onClick={onRetry}
							className="border-amber-300 text-amber-700 hover:bg-amber-100 dark:border-amber-700 dark:text-amber-400 dark:hover:bg-amber-900/30"
						>
							<RefreshCw className="h-3.5 w-3.5 mr-1.5" />
							Retry
						</Button>
					)}
				</CardContent>
			)}
		</Card>
	);
}
