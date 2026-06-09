import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@/components/ui/table";
import {
	Collapsible,
	CollapsibleContent,
	CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
	Crosshair,
	RefreshCw,
	ChevronDown,
	ChevronRight,
	ExternalLink,
	AlertTriangle,
	CheckCircle2,
	Activity,
} from "lucide-react";
import { format } from "date-fns";

interface ClientDrift {
	clientId: string;
	clientName: string;
	riskProfile: string;
	currentAllocation: Record<string, number>;
	targetAllocation: Record<string, number>;
	driftScore: number;
	lastRebalancedAt: string | null;
	rebalancedThisMonth: boolean;
	totalValue: number;
}

interface DriftData {
	clients: ClientDrift[];
	summary: { highDrift: number; avgDrift: number; rebalancedThisMonth: number };
}

const ASSET_CLASSES = [
	"equity",
	"debt",
	"gold",
	"real_estate",
	"alternatives",
	"cash",
];
const ASSET_COLORS: Record<string, string> = {
	equity: "bg-blue-500",
	debt: "bg-green-500",
	gold: "bg-yellow-500",
	real_estate: "bg-orange-500",
	alternatives: "bg-purple-500",
	cash: "bg-gray-400",
};
const ASSET_LABELS: Record<string, string> = {
	equity: "Equity",
	debt: "Debt",
	gold: "Gold",
	real_estate: "Real Estate",
	alternatives: "Alt.",
	cash: "Cash",
};

function DriftBadge({ score }: { score: number }) {
	if (score > 15)
		return (
			<span className="inline-flex items-center gap-1 text-red-700 font-bold text-sm">
				<AlertTriangle className="h-3 w-3" />
				{score}%
			</span>
		);
	if (score > 5)
		return (
			<span className="text-amber-700 font-semibold text-sm">{score}%</span>
		);
	return (
		<span className="inline-flex items-center gap-1 text-green-700 font-medium text-sm">
			<CheckCircle2 className="h-3 w-3" />
			{score}%
		</span>
	);
}

function MiniAllocationBar({
	current,
	target,
	assetClass,
}: { current: number; target: number; assetClass: string }) {
	const color = ASSET_COLORS[assetClass] || "bg-gray-400";
	return (
		<div className="flex items-center gap-1 text-xs">
			<span className="w-14 text-right text-muted-foreground">
				{ASSET_LABELS[assetClass]}
			</span>
			<div className="flex-1 bg-muted rounded-full h-2 relative overflow-hidden">
				<div
					className={`h-full ${color} rounded-full`}
					style={{ width: `${Math.min(current, 100)}%` }}
				/>
			</div>
			<span className="w-10 text-muted-foreground">{current.toFixed(0)}%</span>
			<span className="text-muted-foreground/50">vs</span>
			<span className="w-10 text-primary/70">{target.toFixed(0)}%</span>
		</div>
	);
}

function formatCurrency(n: number) {
	if (n >= 10000000) return `₹${(n / 10000000).toFixed(1)}Cr`;
	if (n >= 100000) return `₹${(n / 100000).toFixed(1)}L`;
	return `₹${(n / 1000).toFixed(0)}K`;
}

export default function AgentPortfolioDrift() {
	const [showHighDriftOnly, setShowHighDriftOnly] = useState(false);
	const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());

	const { data, isLoading, refetch, isFetching } = useQuery<DriftData>({
		queryKey: ["/api/agent/portfolio-drift"],
		refetchInterval: false,
	});

	const clients = data?.clients || [];
	const summary = data?.summary || {
		highDrift: 0,
		avgDrift: 0,
		rebalancedThisMonth: 0,
	};

	const filtered = showHighDriftOnly
		? clients.filter((c) => c.driftScore > 15)
		: clients;

	const toggleRow = (id: string) =>
		setExpandedRows((prev) => {
			const next = new Set(prev);
			next.has(id) ? next.delete(id) : next.add(id);
			return next;
		});

	return (
		<div className="container max-w-7xl mx-auto p-4 sm:p-6 space-y-6">
			<div className="flex items-center justify-between">
				<div>
					<h1 className="text-2xl font-bold flex items-center gap-2">
						<Crosshair className="h-6 w-6 text-primary" />
						Portfolio Drift Monitor
					</h1>
					<p className="text-sm text-muted-foreground mt-1">
						Detect allocation drift across your clients
					</p>
				</div>
				<Button
					variant="outline"
					size="sm"
					onClick={() => refetch()}
					disabled={isFetching}
					className="gap-2"
				>
					<RefreshCw
						className={`h-4 w-4 ${isFetching ? "animate-spin" : ""}`}
					/>{" "}
					Refresh
				</Button>
			</div>

			{/* Summary */}
			<div className="grid grid-cols-3 gap-4">
				<Card>
					<CardContent className="p-4 flex items-center justify-between">
						<div>
							<p className="text-xs text-muted-foreground">
								High Drift (&gt;15%)
							</p>
							<p className="text-2xl font-bold text-red-600">
								{summary.highDrift}
							</p>
						</div>
						<AlertTriangle className="h-8 w-8 text-red-400 opacity-60" />
					</CardContent>
				</Card>
				<Card>
					<CardContent className="p-4 flex items-center justify-between">
						<div>
							<p className="text-xs text-muted-foreground">Avg Drift Score</p>
							<p className="text-2xl font-bold">{summary.avgDrift}%</p>
						</div>
						<Activity className="h-8 w-8 text-primary opacity-60" />
					</CardContent>
				</Card>
				<Card>
					<CardContent className="p-4 flex items-center justify-between">
						<div>
							<p className="text-xs text-muted-foreground">
								Rebalanced This Month
							</p>
							<p className="text-2xl font-bold text-green-600">
								{summary.rebalancedThisMonth}
							</p>
						</div>
						<CheckCircle2 className="h-8 w-8 text-green-400 opacity-60" />
					</CardContent>
				</Card>
			</div>

			{/* Filter */}
			<div className="flex items-center gap-3">
				<Switch
					checked={showHighDriftOnly}
					onCheckedChange={setShowHighDriftOnly}
				/>
				<Label className="text-sm">Show high drift only (&gt;15%)</Label>
			</div>

			{/* Legend */}
			<div className="flex items-center gap-4 text-xs text-muted-foreground">
				<span className="flex items-center gap-1">
					<span className="inline-block w-2 h-2 rounded-full bg-green-500" />
					Low drift (&lt;5%)
				</span>
				<span className="flex items-center gap-1">
					<span className="inline-block w-2 h-2 rounded-full bg-amber-500" />
					Moderate (5–15%)
				</span>
				<span className="flex items-center gap-1">
					<span className="inline-block w-2 h-2 rounded-full bg-red-500" />
					High drift (&gt;15%)
				</span>
				<span className="text-muted-foreground/50 ml-2">
					Current% vs Target%
				</span>
			</div>

			{isLoading ? (
				<div className="text-center py-12 text-muted-foreground">
					Calculating portfolio drift...
				</div>
			) : filtered.length === 0 ? (
				<Card>
					<CardContent className="py-12 text-center">
						<Crosshair className="h-12 w-12 mx-auto text-muted-foreground mb-3" />
						<p className="text-muted-foreground">
							{clients.length === 0
								? "No portfolio data available for your clients."
								: "No clients match the current filter."}
						</p>
					</CardContent>
				</Card>
			) : (
				<div className="rounded-lg border overflow-x-auto">
					<Table>
						<TableHeader>
							<TableRow>
								<TableHead className="w-8" />
								<TableHead>Client</TableHead>
								<TableHead>Risk Profile</TableHead>
								<TableHead>Portfolio Value</TableHead>
								<TableHead>Drift Score</TableHead>
								<TableHead>Last Rebalanced</TableHead>
								<TableHead className="text-right">Actions</TableHead>
							</TableRow>
						</TableHeader>
						<TableBody>
							{filtered.map((client) => {
								const isExpanded = expandedRows.has(client.clientId);
								const rowBg =
									client.driftScore > 15
										? "bg-red-50/30 dark:bg-red-950/10"
										: client.driftScore > 5
											? "bg-amber-50/30 dark:bg-amber-950/10"
											: "";
								return (
									<>
										<TableRow key={client.clientId} className={rowBg}>
											<TableCell>
												<Button
													variant="ghost"
													size="sm"
													className="h-6 w-6 p-0"
													onClick={() => toggleRow(client.clientId)}
												>
													{isExpanded ? (
														<ChevronDown className="h-3 w-3" />
													) : (
														<ChevronRight className="h-3 w-3" />
													)}
												</Button>
											</TableCell>
											<TableCell className="font-medium">
												{client.clientName}
											</TableCell>
											<TableCell>
												<Badge variant="outline" className="capitalize text-xs">
													{client.riskProfile}
												</Badge>
											</TableCell>
											<TableCell className="text-sm">
												{client.totalValue > 0
													? formatCurrency(client.totalValue)
													: "—"}
											</TableCell>
											<TableCell>
												<DriftBadge score={client.driftScore} />
											</TableCell>
											<TableCell className="text-sm text-muted-foreground">
												{client.lastRebalancedAt
													? format(
															new Date(client.lastRebalancedAt),
															"dd MMM yy",
														)
													: "Never"}
												{client.rebalancedThisMonth && (
													<Badge className="ml-2 text-xs bg-green-100 text-green-700">
														This month
													</Badge>
												)}
											</TableCell>
											<TableCell className="text-right">
												<Button
													size="sm"
													variant="outline"
													className="h-7 gap-1"
													onClick={() =>
														window.open(
															`/portfolio-rebalancing?clientId=${client.clientId}`,
															"_blank",
														)
													}
												>
													<RefreshCw className="h-3 w-3" /> Rebalance
												</Button>
											</TableCell>
										</TableRow>
										{isExpanded && (
											<TableRow className={rowBg}>
												<TableCell colSpan={7} className="pb-4 pt-0">
													<div className="ml-8 grid grid-cols-1 sm:grid-cols-2 gap-3 max-w-2xl">
														{ASSET_CLASSES.filter(
															(cls) =>
																(client.targetAllocation[cls] || 0) +
																	(client.currentAllocation[cls] || 0) >
																0,
														).map((cls) => (
															<MiniAllocationBar
																key={cls}
																assetClass={cls}
																current={client.currentAllocation[cls] || 0}
																target={client.targetAllocation[cls] || 0}
															/>
														))}
													</div>
													<p className="ml-8 mt-1 text-xs text-muted-foreground">
														Current% vs Target%
													</p>
												</TableCell>
											</TableRow>
										)}
									</>
								);
							})}
						</TableBody>
					</Table>
				</div>
			)}
		</div>
	);
}
