import React, { useState } from "react";
import { DynamicBar } from "@/components/ui/dynamic-bar";
import { useQuery } from "@tanstack/react-query";
import {
	Card,
	CardContent,
	CardHeader,
	CardTitle,
	CardDescription,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
	TrendingUp,
	Activity,
	RefreshCw,
	CheckCircle2,
	XCircle,
	BarChart3,
	Globe,
	AlertTriangle,
	BadgeIndianRupee,
	DollarSign,
	Building2,
	ShieldCheck,
	Zap,
	ArrowUpRight,
	Clock,
	Target,
	Landmark,
	Wallet,
	Info,
} from "lucide-react";
import { format } from "date-fns";

// ─── Types ─────────────────────────────────────────────────────────────────────

interface BrokerEarning {
	brokerId: string;
	label: string;
	domain: string;
	currency: "INR" | "USD";
	orderCount: number;
	filledCount: number;
	totalOrderValue: number;
	estimatedCommission: number;
	filledCommission: number;
	successRate: number;
	configured: boolean;
	capabilityList: string[];
}

interface BrokerHealth {
	brokerId: string;
	configured: boolean;
	capabilities: string[];
	commissionRate: number;
	domain: string;
	currency: string;
}

interface RecentOrder {
	id: string;
	brokerId: string;
	assetClass: string;
	side: string;
	status: string;
	symbol?: string;
	requestedQty?: string;
	requestedNotional?: string;
	filledQty?: string;
	filledPrice?: string;
	createdAt: string;
}

interface EarningsData {
	period: { days: number; since: string; until: string };
	summary: {
		totalOrders: number;
		totalFilled: number;
		overallSuccessRate: number;
		totalCommissionINR: number;
		totalCommissionUSD: number;
		activeBrokers: number;
		totalBrokers: number;
	};
	brokers: BrokerEarning[];
	allBrokerHealth: BrokerHealth[];
	topProducts: { assetClass: string; count: number; brokerId: string }[];
	recentOrders: RecentOrder[];
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const inr = (v: number) =>
	new Intl.NumberFormat("en-IN", {
		style: "currency",
		currency: "INR",
		maximumFractionDigits: 0,
	}).format(v || 0);

const usd = (v: number) =>
	`$${(v || 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const compact = (v: number, cur: "INR" | "USD" = "INR") => {
	const s = cur === "USD" ? "$" : "₹";
	if (v >= 1e7) return `${s}${(v / 1e7).toFixed(2)}Cr`;
	if (v >= 1e5) return `${s}${(v / 1e5).toFixed(2)}L`;
	if (v >= 1000) return `${s}${(v / 1000).toFixed(1)}K`;
	return `${s}${Math.round(v)}`;
};

const fmtDate = (s?: string) => {
	if (!s) return "—";
	try {
		return format(new Date(s), "dd MMM yy, HH:mm");
	} catch {
		return s;
	}
};

const BROKER_COLORS: Record<
	string,
	{ bg: string; text: string; border: string }
> = {
	IRIS: {
		bg: "bg-violet-100 dark:bg-violet-900/30",
		text: "text-violet-700 dark:text-violet-300",
		border: "border-violet-200 dark:border-violet-700",
	},
	IIFL: {
		bg: "bg-blue-100 dark:bg-blue-900/30",
		text: "text-blue-700 dark:text-blue-300",
		border: "border-blue-200 dark:border-blue-700",
	},
	ALPACA: {
		bg: "bg-amber-100 dark:bg-amber-900/30",
		text: "text-amber-700 dark:text-amber-300",
		border: "border-amber-200 dark:border-amber-700",
	},
};

const STATUS_COLORS: Record<string, string> = {
	filled:
		"bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300",
	completed:
		"bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300",
	pending:
		"bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300",
	submitted: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300",
	rejected: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300",
	cancelled: "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400",
};

// ─── Sub-components ────────────────────────────────────────────────────────────

function BrokerCard({ b }: { b: BrokerEarning }) {
	const c = BROKER_COLORS[b.brokerId] ?? BROKER_COLORS.IRIS;
	return (
		<Card className={`border ${c.border} hover:shadow-lg transition-shadow`}>
			<CardContent className="p-5">
				{/* Header */}
				<div className="flex items-center justify-between mb-3">
					<div className="flex items-center gap-2">
						<div
							className={`w-8 h-8 rounded-lg ${c.bg} flex items-center justify-center`}
						>
							<Building2 className={`h-4 w-4 ${c.text}`} />
						</div>
						<div>
							<p className="font-semibold text-sm">{b.label}</p>
							<p className="text-[11px] text-muted-foreground">{b.domain}</p>
						</div>
					</div>
					<div className="flex flex-col items-end gap-1">
						{b.configured ? (
							<Badge className="bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300 text-[10px] h-5">
								<CheckCircle2 className="h-2.5 w-2.5 mr-1" /> Live
							</Badge>
						) : (
							<Badge
								variant="outline"
								className="text-muted-foreground text-[10px] h-5"
							>
								Not configured
							</Badge>
						)}
					</div>
				</div>

				{/* Metrics grid */}
				<div className="grid grid-cols-2 gap-3 mt-4">
					<div className="space-y-0.5">
						<p className="text-[10px] text-muted-foreground uppercase tracking-wide">
							Orders
						</p>
						<p className="text-lg font-bold">{b.orderCount.toLocaleString()}</p>
						<p className="text-[10px] text-muted-foreground">
							{b.filledCount} filled
						</p>
					</div>
					<div className="space-y-0.5">
						<p className="text-[10px] text-muted-foreground uppercase tracking-wide">
							Success Rate
						</p>
						<p
							className={`text-lg font-bold ${b.successRate >= 80 ? "text-green-600" : b.successRate >= 50 ? "text-amber-600" : "text-red-600"}`}
						>
							{b.successRate}%
						</p>
						<DynamicBar
							percent={b.successRate}
							colorClass={
								b.successRate >= 80
									? "bg-green-500"
									: b.successRate >= 50
										? "bg-amber-500"
										: "bg-red-500"
							}
							heightClass="h-1"
							trackClass="mt-1"
						/>
					</div>
					<div className="space-y-0.5">
						<p className="text-[10px] text-muted-foreground uppercase tracking-wide">
							Est. Commission
						</p>
						<p className="text-sm font-semibold text-primary">
							{b.currency === "USD"
								? usd(b.estimatedCommission)
								: inr(b.estimatedCommission)}
						</p>
					</div>
					<div className="space-y-0.5">
						<p className="text-[10px] text-muted-foreground uppercase tracking-wide">
							Earned (Filled)
						</p>
						<p className="text-sm font-bold text-green-600">
							{b.currency === "USD"
								? usd(b.filledCommission)
								: inr(b.filledCommission)}
						</p>
					</div>
				</div>

				{/* Capabilities */}
				<div className="flex flex-wrap gap-1 mt-3">
					{b.capabilityList.slice(0, 4).map((cap) => (
						<span
							key={cap}
							className={`text-[9px] px-1.5 py-0.5 rounded ${c.bg} ${c.text} font-medium`}
						>
							{cap.replace(/_/g, " ")}
						</span>
					))}
					{b.capabilityList.length > 4 && (
						<span className="text-[9px] text-muted-foreground">
							+{b.capabilityList.length - 4} more
						</span>
					)}
				</div>
			</CardContent>
		</Card>
	);
}

function HealthGrid({ health }: { health: BrokerHealth[] }) {
	return (
		<div className="space-y-3">
			{health.map((b) => {
				const c = BROKER_COLORS[b.brokerId] ?? BROKER_COLORS.IRIS;
				return (
					<div
						key={b.brokerId}
						className={`flex items-center justify-between p-3 rounded-lg border ${c.border} ${c.bg}`}
					>
						<div className="flex items-center gap-3">
							{b.configured ? (
								<CheckCircle2 className="h-4 w-4 text-green-500 flex-shrink-0" />
							) : (
								<XCircle className="h-4 w-4 text-muted-foreground flex-shrink-0" />
							)}
							<div>
								<p className={`text-sm font-semibold ${c.text}`}>
									{b.brokerId}
								</p>
								<p className="text-[10px] text-muted-foreground">{b.domain}</p>
							</div>
						</div>
						<div className="flex items-center gap-3 text-right">
							<div>
								<p className="text-xs font-medium">
									{(b.commissionRate * 100).toFixed(2)}%
								</p>
								<p className="text-[10px] text-muted-foreground">commission</p>
							</div>
							<Badge
								variant={b.configured ? "default" : "outline"}
								className="text-[10px]"
							>
								{b.configured ? "Active" : "Offline"}
							</Badge>
						</div>
					</div>
				);
			})}
		</div>
	);
}

// ─── Main Page ─────────────────────────────────────────────────────────────────

export default function MultibrokerEarningsDashboard() {
	const [days, setDays] = useState("30");
	const [brokerFilter, setBrokerFilter] = useState("ALL");

	const { data, isLoading, refetch, dataUpdatedAt } = useQuery<{
		success: boolean;
		data: EarningsData;
	}>({
		queryKey: ["/api/mpal/admin/earnings", days, brokerFilter],
		queryFn: () => {
			const params = new URLSearchParams({ days });
			if (brokerFilter !== "ALL") params.set("brokerId", brokerFilter);
			return fetch(`/api/mpal/admin/earnings?${params}`).then((r) => r.json());
		},
		staleTime: 60_000,
		refetchInterval: 120_000,
	});

	const d = data?.data;
	const summary = d?.summary;
	const brokers = d?.brokers ?? [];

	const kpis = [
		{
			icon: BadgeIndianRupee,
			label: "Commission (INR)",
			value: isLoading ? "…" : inr(summary?.totalCommissionINR ?? 0),
			sub: "Across IRIS + IIFL",
			color: "text-violet-600",
			bg: "bg-violet-100 dark:bg-violet-900/30",
		},
		{
			icon: DollarSign,
			label: "Commission (USD)",
			value: isLoading ? "…" : usd(summary?.totalCommissionUSD ?? 0),
			sub: "Alpaca order-flow rebates",
			color: "text-amber-600",
			bg: "bg-amber-100 dark:bg-amber-900/30",
		},
		{
			icon: Activity,
			label: "Total Orders",
			value: isLoading ? "…" : (summary?.totalOrders ?? 0).toLocaleString(),
			sub: `${summary?.totalFilled ?? 0} filled`,
			color: "text-blue-600",
			bg: "bg-blue-100 dark:bg-blue-900/30",
		},
		{
			icon: Target,
			label: "Fill Rate",
			value: isLoading ? "…" : `${summary?.overallSuccessRate ?? 0}%`,
			sub: "Across all brokers",
			color:
				(summary?.overallSuccessRate ?? 0) >= 80
					? "text-green-600"
					: "text-amber-600",
			bg: "bg-green-100 dark:bg-green-900/30",
		},
		{
			icon: ShieldCheck,
			label: "Active Brokers",
			value: isLoading
				? "…"
				: `${summary?.activeBrokers ?? 0} / ${summary?.totalBrokers ?? 0}`,
			sub: "Configured & live",
			color: "text-emerald-600",
			bg: "bg-emerald-100 dark:bg-emerald-900/30",
		},
	];

	return (
		<div className="min-h-screen bg-background">
			<div className="max-w-7xl mx-auto px-4 py-8 space-y-8">
				{/* Header */}
				<div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
					<div>
						<h1 className="text-2xl font-bold flex items-center gap-2">
							<Landmark className="h-6 w-6 text-primary" />
							Multibroker Earnings Dashboard
						</h1>
						<p className="text-sm text-muted-foreground mt-0.5">
							Commission, order flow, and payout summary across IRIS · IIFL ·
							Alpaca
						</p>
						{dataUpdatedAt > 0 && (
							<p className="text-[11px] text-muted-foreground mt-1">
								Last updated: {fmtDate(new Date(dataUpdatedAt).toISOString())}
							</p>
						)}
					</div>
					<div className="flex items-center gap-2 flex-wrap">
						<Select value={brokerFilter} onValueChange={setBrokerFilter}>
							<SelectTrigger className="w-[140px] h-8 text-sm">
								<SelectValue />
							</SelectTrigger>
							<SelectContent>
								<SelectItem value="ALL">All Brokers</SelectItem>
								<SelectItem value="IRIS">IRIS KFintech</SelectItem>
								<SelectItem value="IIFL">IIFL Securities</SelectItem>
								<SelectItem value="ALPACA">Alpaca</SelectItem>
							</SelectContent>
						</Select>
						<Select value={days} onValueChange={setDays}>
							<SelectTrigger className="w-[120px] h-8 text-sm">
								<SelectValue />
							</SelectTrigger>
							<SelectContent>
								<SelectItem value="7">Last 7 days</SelectItem>
								<SelectItem value="30">Last 30 days</SelectItem>
								<SelectItem value="90">Last 90 days</SelectItem>
								<SelectItem value="180">Last 180 days</SelectItem>
								<SelectItem value="365">Last 1 year</SelectItem>
							</SelectContent>
						</Select>
						<Button
							variant="outline"
							size="sm"
							onClick={() => refetch()}
							disabled={isLoading}
						>
							<RefreshCw
								className={`h-3.5 w-3.5 mr-1.5 ${isLoading ? "animate-spin" : ""}`}
							/>
							Refresh
						</Button>
					</div>
				</div>

				{/* Disclaimer */}
				<Alert className="border-blue-200 bg-blue-50 dark:bg-blue-950/20 dark:border-blue-800">
					<Info className="h-4 w-4 text-blue-500" />
					<AlertDescription className="text-blue-700 dark:text-blue-300 text-xs">
						Commission figures are estimates based on order flow. Trail
						commissions from IRIS are confirmed via monthly AMFI/IRIS
						reconciliation reports. For final payout reconciliation, see{" "}
						<a
							href="/admin/commission-ledger"
							className="underline font-medium"
						>
							Commission Ledger
						</a>
						.
					</AlertDescription>
				</Alert>

				{/* KPI Row */}
				<div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
					{kpis.map(({ icon: Icon, label, value, sub, color, bg }) => (
						<Card key={label} className="hover:shadow-md transition-shadow">
							<CardContent className="pt-4 pb-4">
								<div
									className={`w-8 h-8 rounded-lg ${bg} flex items-center justify-center mb-3`}
								>
									<Icon className={`h-4 w-4 ${color}`} />
								</div>
								<p className="text-xs text-muted-foreground uppercase tracking-wide font-medium">
									{label}
								</p>
								<p className="text-2xl font-bold mt-0.5">{value}</p>
								<p className="text-[11px] text-muted-foreground mt-0.5">
									{sub}
								</p>
							</CardContent>
						</Card>
					))}
				</div>

				{/* Tabs */}
				<Tabs defaultValue="brokers">
					<TabsList className="h-9">
						<TabsTrigger value="brokers" className="text-sm">
							<Building2 className="h-3.5 w-3.5 mr-1.5" /> Broker Breakdown
						</TabsTrigger>
						<TabsTrigger value="orders" className="text-sm">
							<Activity className="h-3.5 w-3.5 mr-1.5" /> Recent Orders
						</TabsTrigger>
						<TabsTrigger value="products" className="text-sm">
							<BarChart3 className="h-3.5 w-3.5 mr-1.5" /> Top Products
						</TabsTrigger>
						<TabsTrigger value="health" className="text-sm">
							<ShieldCheck className="h-3.5 w-3.5 mr-1.5" /> Broker Health
						</TabsTrigger>
					</TabsList>

					{/* ── Broker Breakdown ── */}
					<TabsContent value="brokers" className="mt-6">
						{isLoading ? (
							<div className="grid grid-cols-1 md:grid-cols-3 gap-4">
								{[1, 2, 3].map((i) => (
									<Card key={i}>
										<CardContent className="p-5 space-y-3">
											{[1, 2, 3, 4].map((j) => (
												<div
													key={j}
													className="h-5 bg-muted animate-pulse rounded"
												/>
											))}
										</CardContent>
									</Card>
								))}
							</div>
						) : brokers.length === 0 ? (
							<Card>
								<CardContent className="py-16 text-center">
									<Building2 className="h-12 w-12 text-muted-foreground mx-auto mb-3 opacity-40" />
									<p className="text-muted-foreground font-medium">
										No orders in this period
									</p>
									<p className="text-sm text-muted-foreground mt-1">
										Orders routed through MPAL will appear here as they are
										placed.
									</p>
								</CardContent>
							</Card>
						) : (
							<div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
								{brokers.map((b) => (
									<BrokerCard key={b.brokerId} b={b} />
								))}
							</div>
						)}

						{/* Commission rate reference */}
						{!isLoading && (
							<Card className="mt-6">
								<CardHeader className="pb-3">
									<CardTitle className="text-sm flex items-center gap-2">
										<Wallet className="h-4 w-4" /> Commission Rate Reference
									</CardTitle>
									<CardDescription className="text-xs">
										Rates applied for earnings estimation. Finalized via monthly
										reconciliation.
									</CardDescription>
								</CardHeader>
								<CardContent>
									<Table>
										<TableHeader>
											<TableRow>
												<TableHead className="text-xs">Broker</TableHead>
												<TableHead className="text-xs">Domain</TableHead>
												<TableHead className="text-xs">
													Commission Rate
												</TableHead>
												<TableHead className="text-xs">Currency</TableHead>
												<TableHead className="text-xs">Basis</TableHead>
											</TableRow>
										</TableHeader>
										<TableBody>
											{(d?.allBrokerHealth ?? []).map((b) => (
												<TableRow key={b.brokerId}>
													<TableCell className="font-medium text-sm">
														{b.brokerId}
													</TableCell>
													<TableCell className="text-xs text-muted-foreground">
														{b.domain}
													</TableCell>
													<TableCell className="font-mono text-sm">
														{(b.commissionRate * 100).toFixed(2)}%
													</TableCell>
													<TableCell>
														<Badge variant="outline" className="text-[10px]">
															{b.currency}
														</Badge>
													</TableCell>
													<TableCell className="text-xs text-muted-foreground">
														{b.brokerId === "IRIS"
															? "Trail on AUM"
															: b.brokerId === "IIFL"
																? "Brokerage share"
																: "Order-flow rebate"}
													</TableCell>
												</TableRow>
											))}
										</TableBody>
									</Table>
								</CardContent>
							</Card>
						)}
					</TabsContent>

					{/* ── Recent Orders ── */}
					<TabsContent value="orders" className="mt-6">
						<Card>
							<CardHeader className="pb-3">
								<CardTitle className="text-sm flex items-center gap-2">
									<Clock className="h-4 w-4" /> Recent Orders (Last 20)
								</CardTitle>
								<CardDescription className="text-xs">
									Cross-broker order log from{" "}
									<code className="text-xs">broker_orders</code> table
								</CardDescription>
							</CardHeader>
							<CardContent className="p-0">
								<div className="overflow-x-auto">
									<Table>
										<TableHeader>
											<TableRow>
												<TableHead className="text-xs">Order ID</TableHead>
												<TableHead className="text-xs">Broker</TableHead>
												<TableHead className="text-xs">
													Symbol / Class
												</TableHead>
												<TableHead className="text-xs">Side</TableHead>
												<TableHead className="text-xs">
													Qty / Notional
												</TableHead>
												<TableHead className="text-xs">
													Filled @ Price
												</TableHead>
												<TableHead className="text-xs">Status</TableHead>
												<TableHead className="text-xs">Time</TableHead>
											</TableRow>
										</TableHeader>
										<TableBody>
											{isLoading ? (
												[...Array(8)].map((_, i) => (
													<TableRow key={i}>
														{[...Array(8)].map((_, j) => (
															<TableCell key={j}>
																<div className="h-4 bg-muted animate-pulse rounded w-16" />
															</TableCell>
														))}
													</TableRow>
												))
											) : (d?.recentOrders ?? []).length === 0 ? (
												<TableRow>
													<TableCell
														colSpan={8}
														className="text-center py-10 text-muted-foreground text-sm"
													>
														No orders in this period
													</TableCell>
												</TableRow>
											) : (
												(d?.recentOrders ?? []).map((o) => {
													const bc =
														BROKER_COLORS[o.brokerId] ?? BROKER_COLORS.IRIS;
													return (
														<TableRow key={o.id}>
															<TableCell className="font-mono text-[11px] text-muted-foreground">
																{o.id.slice(0, 8)}…
															</TableCell>
															<TableCell>
																<Badge
																	className={`text-[10px] border ${bc.bg} ${bc.text} ${bc.border}`}
																>
																	{o.brokerId}
																</Badge>
															</TableCell>
															<TableCell className="text-xs">
																{o.symbol ?? o.assetClass ?? "—"}
															</TableCell>
															<TableCell>
																<Badge
																	variant="outline"
																	className={`text-[10px] ${o.side === "buy" ? "text-green-700 border-green-300" : "text-red-700 border-red-300"}`}
																>
																	{o.side?.toUpperCase() ?? "—"}
																</Badge>
															</TableCell>
															<TableCell className="text-xs font-mono">
																{o.requestedNotional
																	? `₹${Number.parseFloat(o.requestedNotional).toLocaleString("en-IN")}`
																	: o.requestedQty
																		? `${o.requestedQty} units`
																		: "—"}
															</TableCell>
															<TableCell className="text-xs font-mono">
																{o.filledQty && o.filledPrice
																	? `${o.filledQty} @ ${o.filledPrice}`
																	: "—"}
															</TableCell>
															<TableCell>
																<span
																	className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${STATUS_COLORS[o.status] ?? "bg-muted text-muted-foreground"}`}
																>
																	{o.status}
																</span>
															</TableCell>
															<TableCell className="text-[11px] text-muted-foreground whitespace-nowrap">
																{fmtDate(o.createdAt)}
															</TableCell>
														</TableRow>
													);
												})
											)}
										</TableBody>
									</Table>
								</div>
							</CardContent>
						</Card>
					</TabsContent>

					{/* ── Top Products ── */}
					<TabsContent value="products" className="mt-6">
						<div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
							<Card>
								<CardHeader className="pb-3">
									<CardTitle className="text-sm flex items-center gap-2">
										<BarChart3 className="h-4 w-4" /> Top Asset Classes by
										Volume
									</CardTitle>
								</CardHeader>
								<CardContent className="space-y-3">
									{isLoading ? (
										[...Array(6)].map((_, i) => (
											<div
												key={i}
												className="h-10 bg-muted animate-pulse rounded"
											/>
										))
									) : (d?.topProducts ?? []).length === 0 ? (
										<p className="text-sm text-muted-foreground text-center py-6">
											No data in this period
										</p>
									) : (
										(d?.topProducts ?? []).map((p, idx) => {
											const maxCount = d?.topProducts?.[0]?.count ?? 1;
											const pct = Math.round((p.count / maxCount) * 100);
											const bc =
												BROKER_COLORS[p.brokerId] ?? BROKER_COLORS.IRIS;
											return (
												<div key={p.assetClass} className="space-y-1">
													<div className="flex items-center justify-between">
														<div className="flex items-center gap-2">
															<span className="text-xs text-muted-foreground font-mono w-4">
																{idx + 1}
															</span>
															<span className="text-sm font-medium">
																{p.assetClass.replace(/_/g, " ")}
															</span>
															<Badge
																className={`text-[9px] ${bc.bg} ${bc.text} border-0`}
															>
																{p.brokerId}
															</Badge>
														</div>
														<span className="text-sm font-bold">{p.count}</span>
													</div>
													<DynamicBar
														percent={pct}
														colorClass={bc.bg.replace("/30", "")}
														heightClass="h-1.5"
													/>
												</div>
											);
										})
									)}
								</CardContent>
							</Card>

							<Card>
								<CardHeader className="pb-3">
									<CardTitle className="text-sm flex items-center gap-2">
										<Zap className="h-4 w-4" /> Revenue Streams Guide
									</CardTitle>
									<CardDescription className="text-xs">
										How FintekPro earns from each broker
									</CardDescription>
								</CardHeader>
								<CardContent className="space-y-3 text-sm">
									{[
										{
											broker: "IRIS",
											stream: "MF Trail Commission",
											rate: "0.50% of AUM p.a.",
											note: "Paid monthly by AMC via AMFI",
											color: "text-violet-600",
										},
										{
											broker: "IRIS",
											stream: "NFO / NPS Upfront",
											rate: "0.25–1% one-time",
											note: "On new investment",
											color: "text-violet-600",
										},
										{
											broker: "IIFL",
											stream: "Brokerage Revenue Share",
											rate: "0.10% per filled order",
											note: "Equity + F&O",
											color: "text-blue-600",
										},
										{
											broker: "ALPACA",
											stream: "Order Flow Rebate",
											rate: "0.20% per filled USD order",
											note: "US equities + ETFs",
											color: "text-amber-600",
										},
										{
											broker: "ALPACA",
											stream: "FX Spread (LRS)",
											rate: "0.25–1% per remittance",
											note: "On USD funding",
											color: "text-amber-600",
										},
										{
											broker: "ALL",
											stream: "Subscription (SaaS)",
											rate: "₹999–₹1L/yr",
											note: "Platform access fee",
											color: "text-green-600",
										},
									].map((item, i) => (
										<div
											key={i}
											className="flex items-start justify-between py-2 border-b border-muted/50 last:border-0"
										>
											<div className="space-y-0.5">
												<div className="flex items-center gap-1.5">
													<Badge
														variant="outline"
														className={`text-[9px] ${item.color}`}
													>
														{item.broker}
													</Badge>
													<span className="text-sm font-medium">
														{item.stream}
													</span>
												</div>
												<p className="text-[11px] text-muted-foreground">
													{item.note}
												</p>
											</div>
											<span
												className={`text-xs font-semibold ${item.color} whitespace-nowrap ml-4`}
											>
												{item.rate}
											</span>
										</div>
									))}
								</CardContent>
							</Card>
						</div>
					</TabsContent>

					{/* ── Broker Health ── */}
					<TabsContent value="health" className="mt-6">
						<div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
							<Card>
								<CardHeader className="pb-3">
									<CardTitle className="text-sm flex items-center gap-2">
										<ShieldCheck className="h-4 w-4" /> Broker Registry Status
									</CardTitle>
									<CardDescription className="text-xs">
										From{" "}
										<code className="text-xs">
											providerRegistry.getAllBrokers()
										</code>
									</CardDescription>
								</CardHeader>
								<CardContent>
									{isLoading ? (
										<div className="space-y-3">
											{[1, 2, 3].map((i) => (
												<div
													key={i}
													className="h-14 bg-muted animate-pulse rounded"
												/>
											))}
										</div>
									) : (
										<HealthGrid health={d?.allBrokerHealth ?? []} />
									)}
								</CardContent>
							</Card>

							<Card>
								<CardHeader className="pb-3">
									<CardTitle className="text-sm flex items-center gap-2">
										<Globe className="h-4 w-4" /> MPAL Capability Map
									</CardTitle>
									<CardDescription className="text-xs">
										What each broker handles in the routing layer
									</CardDescription>
								</CardHeader>
								<CardContent>
									<div className="space-y-4">
										{(d?.allBrokerHealth ?? []).map((b) => {
											const bc =
												BROKER_COLORS[b.brokerId] ?? BROKER_COLORS.IRIS;
											return (
												<div key={b.brokerId} className="space-y-2">
													<div className="flex items-center gap-2">
														<span
															className={`text-sm font-semibold ${bc.text}`}
														>
															{b.brokerId}
														</span>
														{!b.configured && (
															<Badge
																variant="outline"
																className="text-[9px] text-muted-foreground"
															>
																<AlertTriangle className="h-2.5 w-2.5 mr-0.5" />{" "}
																Not configured
															</Badge>
														)}
													</div>
													<div className="flex flex-wrap gap-1">
														{b.capabilities.map((cap) => (
															<span
																key={cap}
																className={`text-[10px] px-2 py-0.5 rounded-full ${bc.bg} ${bc.text} font-medium`}
															>
																{cap.replace(/_/g, " ")}
															</span>
														))}
													</div>
												</div>
											);
										})}
									</div>

									<div className="mt-6 pt-4 border-t">
										<p className="text-xs text-muted-foreground font-medium mb-2">
											Quick Links
										</p>
										<div className="flex flex-col gap-1.5">
											{[
												{
													href: "/admin/commission-ledger",
													label: "Commission Ledger",
												},
												{
													href: "/admin/revenue-analytics",
													label: "Revenue Analytics",
												},
												{
													href: "/admin/commission-master",
													label: "Commission Master Config",
												},
												{
													href: "/admin/broker-dashboard",
													label: "Alpaca Broker Dashboard",
												},
											].map(({ href, label }) => (
												<a
													key={href}
													href={href}
													className="text-xs text-primary hover:underline flex items-center gap-1"
												>
													<ArrowUpRight className="h-3 w-3" /> {label}
												</a>
											))}
										</div>
									</div>
								</CardContent>
							</Card>
						</div>
					</TabsContent>
				</Tabs>
			</div>
		</div>
	);
}
