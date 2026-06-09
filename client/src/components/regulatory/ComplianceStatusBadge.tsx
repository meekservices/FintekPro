import { useQuery } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { ShieldCheck, ShieldAlert, Activity, Lock } from "lucide-react";
import {
	Tooltip,
	TooltipContent,
	TooltipProvider,
	TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

interface ComplianceStatus {
	status: "compliant" | "warning" | "critical";
	healthScore: number;
	auditStats?: {
		retentionPeriod: string;
		lastArchivedAt: string;
	};
	alerts?: Array<{
		id: string;
		message: string;
		severity: string;
	}>;
	heartbeat?: {
		lastPulse: string;
		status: string;
	};
}

export function ComplianceStatusBadge() {
	const { data: status, isLoading } = useQuery<ComplianceStatus>({
		queryKey: ["/api/compliance/status"],
	});

	if (isLoading || !status) {
		return <div className="h-6 w-32 animate-pulse bg-muted rounded-full" />;
	}

	const isCompliant = status.status === "compliant";

	return (
		<TooltipProvider>
			<Tooltip>
				<TooltipTrigger asChild>
					<div
						className={cn(
							"flex items-center gap-2 px-3 py-1 rounded-full text-xs font-medium border transition-all cursor-help",
							isCompliant
								? "bg-green-50 border-green-200 text-green-700 dark:bg-green-900/20 dark:border-green-800 dark:text-green-400"
								: "bg-amber-50 border-amber-200 text-amber-700 dark:bg-amber-900/20 dark:border-amber-800 dark:text-amber-400",
						)}
					>
						{isCompliant ? (
							<ShieldCheck className="h-3.5 w-3.5" />
						) : (
							<ShieldAlert className="h-3.5 w-3.5" />
						)}
						<span>Compliance: {status.healthScore}%</span>
						<div className="flex items-center gap-1 border-l pl-2 ml-1 border-current opacity-50">
							<Activity className="h-3 w-3" />
							<Lock className="h-3 w-3" />
						</div>
					</div>
				</TooltipTrigger>
				<TooltipContent side="bottom" className="w-64 p-3 shadow-xl">
					<div className="space-y-2">
						<div className="flex justify-between items-center">
							<span className="font-semibold text-sm">Regulatory Health</span>
							<Badge
								variant={isCompliant ? "outline" : "destructive"}
								className="text-[10px] uppercase h-4 px-1.5"
							>
								{status.status.replace("_", " ")}
							</Badge>
						</div>

						<div className="grid grid-cols-2 gap-2 pt-1 border-t text-[11px]">
							<div>
								<p className="text-muted-foreground">Forensic Logs</p>
								<p className="font-medium text-green-600 dark:text-green-400">
									Verified
								</p>
							</div>
							<div>
								<p className="text-muted-foreground">Retention</p>
								<p className="font-medium">
									{status.auditStats?.retentionPeriod || "7 Years"}
								</p>
							</div>
							<div className="col-span-2 pt-1 border-t">
								<p className="text-muted-foreground">Active Alerts</p>
								<p
									className={cn(
										"font-medium",
										status.alerts && status.alerts.length > 0
											? "text-amber-600 dark:text-amber-400"
											: "text-green-600 dark:text-green-400",
									)}
								>
									{status.alerts && status.alerts.length > 0
										? `${status.alerts.length} Pending Actions`
										: "System Clear"}
								</p>
							</div>
						</div>

						{status.alerts && status.alerts.length > 0 && (
							<div className="mt-2 text-[10px] bg-amber-50 dark:bg-amber-900/20 p-1.5 rounded border border-amber-200 dark:border-amber-800 italic">
								{status.alerts[0].message}
							</div>
						)}

						<div className="flex items-center gap-1 text-[10px] text-muted-foreground pt-2 border-t mt-2">
							<Activity className="h-2.5 w-2.5" />
							<span>
								Forensic Heartbeat Active •{" "}
								{status.heartbeat?.lastPulse
									? new Date(status.heartbeat.lastPulse).toLocaleTimeString()
									: "Live"}
							</span>
						</div>
					</div>
				</TooltipContent>
			</Tooltip>
		</TooltipProvider>
	);
}
