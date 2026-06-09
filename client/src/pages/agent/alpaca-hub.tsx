/**
 * Alpaca Hub — Agent View
 * Shows an agent their clients' Alpaca US-trading account status,
 * position summaries, recent activity, LRS utilization, and funding status.
 * Read-only — agents cannot create journals or close accounts.
 */

import { useState } from "react";
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
import { Input } from "@/components/ui/input";
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
import { Progress } from "@/components/ui/progress";
import {
	Users,
	TrendingUp,
	ArrowUp,
	ArrowDown,
	RefreshCw,
	CheckCircle2,
	Clock,
	AlertTriangle,
	Search,
	Activity,
	Globe,
	Shield as LucideShield,
	Wallet,
	DollarSign,
	BarChart3,
	LineChart,
	ChevronRight,
	ExternalLink,
	Info,
	ArrowRightLeft,
	FileText,
	Building2,
	BadgeIndianRupee,
	Landmark,
	XCircle,
} from "lucide-react";
import { format, parseISO } from "date-fns";

const BASE = "/api/us-trading";

// ─── Helpers ─────────────────────────────────────────────────────────────────

function usd(val?: string | number | null) {
	const n = Number.parseFloat(String(val ?? "0"));
	return Number.isNaN(n)
		? "—"
		: `$${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function fmtDate(s?: string | null) {
	if (!s) return "—";
	try {
		return format(parseISO(s), "MMM d, yyyy");
	} catch {
		return s;
	}
}

function fmtDateTime(s?: string | null) {
	if (!s) return "—";
	try {
		return format(parseISO(s), "dd MMM HH:mm");
	} catch {
		return s;
	}
}

function StatusChip({ status }: { status: string }) {
	const map: Record<string, string> = {
		ACTIVE:
			"bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300",
		APPROVED:
			"bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300",
		SUBMITTED:
			"bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300",
		APPROVAL_PENDING:
			"bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300",
		PENDING:
			"bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300",
		ACTION_REQUIRED:
			"bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300",
		REJECTED: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300",
		DISABLED: "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400",
		ACCOUNT_CLOSED:
			"bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400",
		FILLED:
			"bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300",
		CANCELED: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300",
		NEW: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300",
		PARTIALLY_FILLED:
			"bg-indigo-100 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-300",
	};
	return (
		<span
			className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${map[status?.toUpperCase()] || "bg-muted text-muted-foreground"}`}
		>
			{status?.replace(/_/g, " ")}
		</span>
	);
}

// ─── Overview Cards ───────────────────────────────────────────────────────────

function AgentOverviewCards() {
	const { data: accounts } = useQuery<{ accounts: any[] }>({
		queryKey: ["/api/us-trading/broker/accounts"],
		queryFn: () => fetch(`${BASE}/broker/accounts`).then((r) => r.json()),
	});

	const { data: positions } = useQuery<any>({
		queryKey: ["/api/us-trading/positions"],
		queryFn: () => fetch(`${BASE}/positions`).then((r) => r.json()),
	});

	const { data: lrs } = useQuery<any>({
		queryKey: ["/api/us-trading/lrs/status"],
		queryFn: () => fetch(`${BASE}/lrs/status`).then((r) => r.json()),
	});

	const accs = accounts?.accounts || [];
	const active = accs.filter((a: any) => a.status === "ACTIVE").length;
	const pending = accs.filter((a: any) =>
		["SUBMITTED", "PENDING", "APPROVAL_PENDING"].includes(a.status),
	).length;

	const cards = [
		{
			icon: Users,
			label: "Client US Accounts",
			value: accs.length,
			sub: `${active} active · ${pending} pending`,
			color: "text-blue-600",
			bg: "from-blue-50 to-blue-100 dark:from-blue-950 dark:to-blue-900",
		},
		{
			icon: TrendingUp,
			label: "Portfolio Value",
			value: positions?.configured ? usd(positions.totalValueUSD) : "—",
			sub: positions?.configured
				? `₹${(positions.totalValueINR || 0).toLocaleString("en-IN", { maximumFractionDigits: 0 })}`
				: "Configure Alpaca API",
			color: "text-emerald-600",
			bg: "from-emerald-50 to-emerald-100 dark:from-emerald-950 dark:to-emerald-900",
		},
		{
			icon: BadgeIndianRupee,
			label: "LRS Used (FY)",
			value: lrs ? `$${(lrs.usedUsd || 0).toLocaleString()}` : "—",
			sub: lrs
				? `${(lrs.usedPercent || 0).toFixed(1)}% of $2,50,000`
				: "Annual LRS quota",
			color: "text-purple-600",
			bg: "from-purple-50 to-purple-100 dark:from-purple-950 dark:to-purple-900",
		},
		{
			icon: LucideShield,
			label: "Compliance",
			value: active > 0 ? "✓ KYC OK" : "Pending",
			sub: `${active} accounts fully approved`,
			color: active > 0 ? "text-emerald-600" : "text-amber-600",
			bg:
				active > 0
					? "from-emerald-50 to-emerald-100 dark:from-emerald-950 dark:to-emerald-900"
					: "from-amber-50 to-amber-100 dark:from-amber-950 dark:to-amber-900",
		},
	];

	return (
		<div className="grid grid-cols-2 md:grid-cols-4 gap-3">
			{cards.map(({ icon: Icon, label, value, sub, color, bg }) => (
				<Card key={label} className={`bg-gradient-to-br ${bg}`}>
					<CardContent className="pt-4 pb-3 px-4">
						<div className="flex items-center justify-between mb-2">
							<span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
								{label}
							</span>
							<Icon className={`h-4 w-4 ${color}`} />
						</div>
						<div className="text-2xl font-bold">{value}</div>
						<p className="text-xs text-muted-foreground mt-0.5">{sub}</p>
					</CardContent>
				</Card>
			))}
		</div>
	);
}

// ─── Client Accounts Tab ──────────────────────────────────────────────────────

function ClientAccountsTab() {
	const [search, setSearch] = useState("");
	const [status, setStatus] = useState("all");

	const { data, isLoading, refetch } = useQuery<{
		accounts: any[];
		configured: boolean;
	}>({
		queryKey: ["/api/us-trading/broker/accounts", status, search],
		queryFn: () =>
			fetch(
				`${BASE}/broker/accounts?${new URLSearchParams({
					...(search ? { query: search } : {}),
					...(status !== "all" ? { status } : {}),
				})}`,
			).then((r) => r.json()),
	});

	const accounts = data?.accounts || [];

	return (
		<div className="space-y-4">
			{!data?.configured && (
				<Alert className="border-amber-200 bg-amber-50 dark:bg-amber-950/20">
					<AlertTriangle className="h-4 w-4 text-amber-500" />
					<AlertDescription className="text-amber-700 dark:text-amber-300 text-sm">
						Alpaca Broker API not configured. Contact your administrator to
						activate US Trading.
					</AlertDescription>
				</Alert>
			)}

			<div className="flex gap-3 flex-col sm:flex-row">
				<div className="relative flex-1">
					<Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
					<Input
						className="pl-9"
						placeholder="Search client accounts…"
						value={search}
						onChange={(e) => setSearch(e.target.value)}
					/>
				</div>
				<Select value={status} onValueChange={setStatus}>
					<SelectTrigger className="w-[180px]">
						<SelectValue />
					</SelectTrigger>
					<SelectContent>
						<SelectItem value="all">All Statuses</SelectItem>
						<SelectItem value="ACTIVE">Active</SelectItem>
						<SelectItem value="SUBMITTED">Submitted</SelectItem>
						<SelectItem value="APPROVAL_PENDING">Approval Pending</SelectItem>
						<SelectItem value="ACTION_REQUIRED">Action Required</SelectItem>
						<SelectItem value="PENDING">Pending</SelectItem>
						<SelectItem value="REJECTED">Rejected</SelectItem>
					</SelectContent>
				</Select>
				<Button variant="outline" size="icon" onClick={() => refetch()}>
					<RefreshCw className={`h-4 w-4 ${isLoading ? "animate-spin" : ""}`} />
				</Button>
			</div>

			<Card>
				<CardContent className="p-0">
					<div className="overflow-x-auto">
						<Table>
							<TableHeader>
								<TableRow>
									<TableHead>Account #</TableHead>
									<TableHead>Client Name</TableHead>
									<TableHead>Email</TableHead>
									<TableHead>Alpaca Status</TableHead>
									<TableHead>KYC / CIP</TableHead>
									<TableHead>Country</TableHead>
									<TableHead>Opened</TableHead>
								</TableRow>
							</TableHeader>
							<TableBody>
								{isLoading ? (
									[...Array(5)].map((_, i) => (
										<TableRow key={i}>
											{[...Array(7)].map((_, j) => (
												<TableCell key={j}>
													<div className="h-4 bg-muted animate-pulse rounded w-24" />
												</TableCell>
											))}
										</TableRow>
									))
								) : accounts.length === 0 ? (
									<TableRow>
										<TableCell
											colSpan={7}
											className="text-center py-12 text-muted-foreground"
										>
											<Users className="h-8 w-8 mx-auto mb-2 opacity-30" />
											No client accounts found
										</TableCell>
									</TableRow>
								) : (
									accounts.map((acc: any) => (
										<TableRow key={acc.id} className="hover:bg-muted/30">
											<TableCell className="font-mono text-xs font-semibold">
												{acc.account_number || acc.id?.slice(0, 8)}
											</TableCell>
											<TableCell className="font-medium">
												{acc.identity?.given_name} {acc.identity?.family_name}
											</TableCell>
											<TableCell className="text-sm text-muted-foreground">
												{acc.contact?.email_address || "—"}
											</TableCell>
											<TableCell>
												<StatusChip status={acc.status} />
											</TableCell>
											<TableCell>
												{acc.kyc_results?.approved ? (
													<span className="flex items-center gap-1 text-emerald-600 text-xs">
														<CheckCircle2 className="h-3.5 w-3.5" /> Approved
													</span>
												) : acc.kyc_results ? (
													<span className="flex items-center gap-1 text-amber-600 text-xs">
														<AlertTriangle className="h-3.5 w-3.5" /> In Review
													</span>
												) : (
													<span className="flex items-center gap-1 text-muted-foreground text-xs">
														<Clock className="h-3.5 w-3.5" /> Pending
													</span>
												)}
											</TableCell>
											<TableCell className="text-sm">
												{acc.contact?.country || "IND"}
											</TableCell>
											<TableCell className="text-sm text-muted-foreground">
												{fmtDate(acc.created_at)}
											</TableCell>
										</TableRow>
									))
								)}
							</TableBody>
						</Table>
					</div>
				</CardContent>
			</Card>
		</div>
	);
}

// ─── Positions Tab ────────────────────────────────────────────────────────────

function AgentPositionsTab() {
	const { data, isLoading, refetch } = useQuery<any>({
		queryKey: ["/api/us-trading/positions"],
		queryFn: () => fetch(`${BASE}/positions`).then((r) => r.json()),
		refetchInterval: 30_000,
	});

	const positions: any[] = data?.positions || [];

	return (
		<div className="space-y-4">
			{data?.configured && (
				<div className="grid grid-cols-2 md:grid-cols-4 gap-3">
					{[
						{
							label: "Portfolio Value (USD)",
							value: usd(data.totalValueUSD),
							sub: data.isPaper ? "Paper account" : "Live account",
						},
						{
							label: "Portfolio Value (INR)",
							value: `₹${(data.totalValueINR || 0).toLocaleString("en-IN", { maximumFractionDigits: 0 })}`,
							sub: "At current FX rate",
						},
						{
							label: "Total Unrealised P&L",
							value: usd(data.totalGainLossUSD),
							sub: `${(data.totalGainLossPercent || 0).toFixed(2)}%`,
						},
						{
							label: "# Holdings",
							value: positions.length,
							sub: "Open positions",
						},
					].map(({ label, value, sub }) => (
						<Card key={label}>
							<CardContent className="pt-4 pb-3 px-4">
								<p className="text-xs text-muted-foreground">{label}</p>
								<p className="text-xl font-bold mt-0.5">{value}</p>
								<p className="text-xs text-muted-foreground">{sub}</p>
							</CardContent>
						</Card>
					))}
				</div>
			)}

			<div className="flex justify-end">
				<Button variant="outline" size="sm" onClick={() => refetch()}>
					<RefreshCw
						className={`h-4 w-4 mr-1.5 ${isLoading ? "animate-spin" : ""}`}
					/>{" "}
					Live Refresh
				</Button>
			</div>

			<Card>
				<CardContent className="p-0">
					<div className="overflow-x-auto">
						<Table>
							<TableHeader>
								<TableRow>
									<TableHead>Symbol</TableHead>
									<TableHead>Qty</TableHead>
									<TableHead>Avg Cost</TableHead>
									<TableHead>Current Price</TableHead>
									<TableHead>Market Value</TableHead>
									<TableHead>Unrealised P&L</TableHead>
									<TableHead>Return %</TableHead>
								</TableRow>
							</TableHeader>
							<TableBody>
								{isLoading ? (
									[...Array(4)].map((_, i) => (
										<TableRow key={i}>
											{[...Array(7)].map((_, j) => (
												<TableCell key={j}>
													<div className="h-4 bg-muted animate-pulse rounded" />
												</TableCell>
											))}
										</TableRow>
									))
								) : !data?.configured ? (
									<TableRow>
										<TableCell
											colSpan={7}
											className="text-center py-12 text-muted-foreground"
										>
											Alpaca API not configured
										</TableCell>
									</TableRow>
								) : positions.length === 0 ? (
									<TableRow>
										<TableCell
											colSpan={7}
											className="text-center py-12 text-muted-foreground"
										>
											<LineChart className="h-8 w-8 mx-auto mb-2 opacity-30" />
											No open positions
										</TableCell>
									</TableRow>
								) : (
									positions.map((p: any) => (
										<TableRow key={p.symbol} className="hover:bg-muted/30">
											<TableCell className="font-bold">{p.symbol}</TableCell>
											<TableCell>{p.quantity}</TableCell>
											<TableCell>{usd(p.avgPrice)}</TableCell>
											<TableCell>{usd(p.currentPrice)}</TableCell>
											<TableCell className="font-medium">
												{usd(p.marketValue)}
											</TableCell>
											<TableCell
												className={
													p.gainLoss >= 0
														? "text-emerald-600 font-medium"
														: "text-red-500 font-medium"
												}
											>
												{p.gainLoss >= 0 ? "+" : ""}
												{usd(p.gainLoss)}
											</TableCell>
											<TableCell
												className={
													p.gainLossPercent >= 0
														? "text-emerald-600"
														: "text-red-500"
												}
											>
												{p.gainLossPercent >= 0 ? "+" : ""}
												{p.gainLossPercent?.toFixed(2)}%
											</TableCell>
										</TableRow>
									))
								)}
							</TableBody>
						</Table>
					</div>
				</CardContent>
			</Card>
		</div>
	);
}

// ─── Activity Feed Tab ────────────────────────────────────────────────────────

function AgentActivityTab() {
	const [actType, setActType] = useState("");

	const { data, isLoading, refetch } = useQuery<{ activities: any[] }>({
		queryKey: ["/api/us-trading/broker/activities", actType],
		queryFn: () =>
			fetch(
				`${BASE}/broker/activities${actType ? `?activity_type=${actType}` : ""}`,
			).then((r) => r.json()),
	});

	const activities = data?.activities || [];

	const iconFor = (type: string) => {
		const m: Record<string, any> = {
			FILL: TrendingUp,
			JNLC: Landmark,
			JNLS: Landmark,
			DIV: BarChart3,
			CSD: ArrowUp,
			CSW: ArrowDown,
			ACATC: ArrowRightLeft,
			ACATS: ArrowRightLeft,
		};
		return m[type] || Activity;
	};

	return (
		<div className="space-y-4">
			<div className="flex items-center gap-3">
				<Select value={actType} onValueChange={setActType}>
					<SelectTrigger className="w-[220px]">
						<SelectValue placeholder="All activity types" />
					</SelectTrigger>
					<SelectContent>
						{["", "FILL", "JNLC", "JNLS", "DIV", "CSD", "CSW", "ACATC"].map(
							(v) => (
								<SelectItem key={v} value={v}>
									{v === "" ? "All Types" : v}
								</SelectItem>
							),
						)}
					</SelectContent>
				</Select>
				<Button variant="outline" size="icon" onClick={() => refetch()}>
					<RefreshCw className={`h-4 w-4 ${isLoading ? "animate-spin" : ""}`} />
				</Button>
			</div>

			<div className="space-y-2">
				{isLoading ? (
					[...Array(6)].map((_, i) => (
						<div key={i} className="h-14 bg-muted animate-pulse rounded-lg" />
					))
				) : activities.length === 0 ? (
					<div className="text-center py-12 text-muted-foreground">
						<Activity className="h-8 w-8 mx-auto mb-2 opacity-30" />
						No activities found
					</div>
				) : (
					activities.map((a: any) => {
						const Icon = iconFor(a.activity_type);
						const net = Number.parseFloat(a.net_amount || "0");
						return (
							<div
								key={a.id}
								className="flex items-center gap-4 p-3 rounded-lg border bg-card hover:bg-muted/30 transition-colors"
							>
								<div className="p-2 rounded-full bg-muted">
									<Icon className="h-4 w-4 text-muted-foreground" />
								</div>
								<div className="flex-1 min-w-0">
									<div className="flex items-center gap-2">
										<Badge variant="outline" className="text-xs">
											{a.activity_type}
										</Badge>
										{a.symbol && (
											<span className="font-medium text-sm">{a.symbol}</span>
										)}
										{a.qty && (
											<span className="text-xs text-muted-foreground">
												× {a.qty}
											</span>
										)}
									</div>
									<p className="text-xs text-muted-foreground mt-0.5">
										Acct: {a.account_id?.slice(0, 8)}… · {fmtDateTime(a.date)}
									</p>
								</div>
								<div
									className={`font-semibold text-sm ${net >= 0 ? "text-emerald-600" : "text-red-500"}`}
								>
									{a.net_amount
										? `${net >= 0 ? "+" : ""}${usd(net)}`
										: a.price
											? usd(a.price)
											: "—"}
								</div>
							</div>
						);
					})
				)}
			</div>
		</div>
	);
}

// ─── LRS Status Tab ───────────────────────────────────────────────────────────

function LrsTab() {
	const { data, isLoading, refetch } = useQuery<any>({
		queryKey: ["/api/us-trading/lrs/status"],
		queryFn: () => fetch(`${BASE}/lrs/status`).then((r) => r.json()),
	});

	const lrs = data || {};
	const usedPct = Math.min(lrs.usedPercent || 0, 100);
	const tcsApplies = lrs.tcsApplies;

	return (
		<div className="space-y-6">
			{/* LRS Utilization */}
			<Card>
				<CardHeader className="pb-3">
					<CardTitle className="text-base flex items-center gap-2">
						<Globe className="h-4 w-4 text-primary" /> LRS Utilization — FY{" "}
						{lrs.financialYear || "—"}
					</CardTitle>
					<CardDescription>
						RBI Liberalised Remittance Scheme quota tracking
					</CardDescription>
				</CardHeader>
				<CardContent className="space-y-4">
					{isLoading ? (
						<div className="h-24 bg-muted animate-pulse rounded" />
					) : (
						<>
							<div className="flex justify-between text-sm mb-1">
								<span className="font-medium">
									${(lrs.usedUsd || 0).toLocaleString()} used
								</span>
								<span className="text-muted-foreground">Limit: $250,000</span>
							</div>
							<Progress
								value={usedPct}
								className={`h-3 ${usedPct >= 100 ? "bg-red-200" : usedPct >= 80 ? "bg-amber-200" : ""}`}
							/>
							<div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-2">
								{[
									{
										label: "Used (USD)",
										value: `$${(lrs.usedUsd || 0).toLocaleString()}`,
										color: "text-blue-600",
									},
									{
										label: "Remaining (USD)",
										value: `$${(lrs.remainingUsd || 250000).toLocaleString()}`,
										color: "text-emerald-600",
									},
									{
										label: "Used (INR)",
										value: `₹${(lrs.usedInr || 0).toLocaleString("en-IN")}`,
										color: "text-purple-600",
									},
									{
										label: "FX Rate",
										value: `₹${lrs.usdInrRate || 84}/$`,
										color: "text-amber-600",
									},
								].map(({ label, value, color }) => (
									<div
										key={label}
										className="p-3 rounded-lg border bg-muted/20"
									>
										<p className="text-xs text-muted-foreground">{label}</p>
										<p className={`font-bold ${color}`}>{value}</p>
									</div>
								))}
							</div>
							{lrs.warning && (
								<Alert
									className={`border-amber-200 bg-amber-50 dark:bg-amber-950/20 py-2`}
								>
									<AlertTriangle className="h-3.5 w-3.5 text-amber-600" />
									<AlertDescription className="text-xs text-amber-700 dark:text-amber-300">
										{lrs.warning}
									</AlertDescription>
								</Alert>
							)}
						</>
					)}
				</CardContent>
			</Card>

			{/* TCS Status */}
			<Card
				className={tcsApplies ? "border-orange-200 dark:border-orange-800" : ""}
			>
				<CardHeader className="pb-3">
					<CardTitle className="text-base flex items-center gap-2">
						<BadgeIndianRupee
							className={`h-4 w-4 ${tcsApplies ? "text-orange-500" : "text-muted-foreground"}`}
						/>
						TCS — Tax Collected at Source
					</CardTitle>
				</CardHeader>
				<CardContent>
					<div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
						<div className="p-3 rounded-lg border bg-muted/20">
							<p className="text-xs text-muted-foreground">
								TCS Threshold (FY)
							</p>
							<p className="font-bold">₹7,00,000</p>
						</div>
						<div className="p-3 rounded-lg border bg-muted/20">
							<p className="text-xs text-muted-foreground">
								TCS Rate (Above Threshold)
							</p>
							<p className="font-bold">20%</p>
						</div>
						<div
							className={`p-3 rounded-lg border ${tcsApplies ? "bg-orange-50 border-orange-200 dark:bg-orange-950/20 dark:border-orange-800" : "bg-muted/20"}`}
						>
							<p className="text-xs text-muted-foreground">TCS Applicable?</p>
							<p
								className={`font-bold ${tcsApplies ? "text-orange-600" : "text-emerald-600"}`}
							>
								{tcsApplies
									? `Yes — ₹${(lrs.tcsAmountInr || 0).toLocaleString("en-IN")}`
									: "Not yet"}
							</p>
						</div>
					</div>
					<p className="text-xs text-muted-foreground mt-3">
						Your AD-I bank deducts 20% TCS on LRS amounts exceeding ₹7L/FY.
						Claim TCS credit when filing your ITR under §206C(1G).
					</p>
				</CardContent>
			</Card>

			{/* SWIFT / Funding Guide */}
			<Card>
				<CardHeader className="pb-3">
					<CardTitle className="text-base flex items-center gap-2">
						<Wallet className="h-4 w-4 text-primary" /> How to Fund Your Alpaca
						Account
					</CardTitle>
					<CardDescription>
						SWIFT wire transfer via LRS from your India bank
					</CardDescription>
				</CardHeader>
				<CardContent>
					<div className="space-y-3">
						{[
							{
								step: 1,
								title: "Get your USD account details",
								desc: "Check Funding → Wallet for your dedicated Alpaca beneficiary account number.",
							},
							{
								step: 2,
								title: "Visit your AD-I bank (LRS desk)",
								desc: "SBI, HDFC, ICICI, Axis, Kotak, etc. Online: HDFC Netbanking → Forex, or Wise.",
							},
							{
								step: 3,
								title: "Fill Form A2",
								desc: "Purpose: 'Overseas portfolio investment in US equities under LRS'. Purpose code: S0001.",
							},
							{
								step: 4,
								title: "Provide PAN + KYC",
								desc: "PAN is mandatory. Ensure PAN is linked to Aadhaar at your bank.",
							},
							{
								step: 5,
								title: "Initiate SWIFT wire",
								desc: "Send USD to your Alpaca beneficiary account. Settlement: 2–5 business days.",
							},
						].map(({ step, title, desc }) => (
							<div key={step} className="flex gap-3">
								<div className="w-6 h-6 rounded-full bg-primary/10 text-primary text-xs font-bold flex items-center justify-center shrink-0 mt-0.5">
									{step}
								</div>
								<div>
									<p className="text-sm font-medium">{title}</p>
									<p className="text-xs text-muted-foreground">{desc}</p>
								</div>
							</div>
						))}
					</div>
				</CardContent>
			</Card>
		</div>
	);
}

// ─── Main ─────────────────────────────────────────────────────────────────────

const AGENT_TABS = [
	{ value: "accounts", label: "Client Accounts", icon: Users },
	{ value: "positions", label: "Positions", icon: TrendingUp },
	{ value: "activity", label: "Activity", icon: Activity },
	{ value: "lrs", label: "LRS & Funding", icon: Globe },
] as const;

type AgentTabValue = (typeof AGENT_TABS)[number]["value"];

export default function AlpacaHubAgent() {
	const [activeTab, setActiveTab] = useState<AgentTabValue>("accounts");

	return (
		<div className="space-y-6">
			{/* Header */}
			<div className="flex items-start justify-between">
				<div>
					<h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
						<Building2 className="h-6 w-6 text-primary" />
						US Trading — Alpaca Hub
					</h1>
					<p className="text-muted-foreground text-sm mt-0.5">
						Client account status, positions, activity feed & LRS utilization
					</p>
				</div>
				<Button variant="outline" size="sm" asChild>
					<a
						href="https://alpaca.markets"
						target="_blank"
						rel="noopener noreferrer"
					>
						<ExternalLink className="h-3.5 w-3.5 mr-1.5" /> Alpaca Docs
					</a>
				</Button>
			</div>

			{/* Overview Cards */}
			<AgentOverviewCards />

			{/* Tabs */}
			<Tabs
				value={activeTab}
				onValueChange={(v) => setActiveTab(v as AgentTabValue)}
			>
				<TabsList className="flex-wrap h-auto gap-1 bg-muted/50 p-1 rounded-lg">
					{AGENT_TABS.map(({ value, label, icon: Icon }) => (
						<TabsTrigger
							key={value}
							value={value}
							className="gap-1.5 data-[state=active]:bg-background data-[state=active]:shadow-sm"
						>
							<Icon className="h-3.5 w-3.5" /> {label}
						</TabsTrigger>
					))}
				</TabsList>

				<div className="mt-4">
					<TabsContent value="accounts" className="mt-0">
						<ClientAccountsTab />
					</TabsContent>
					<TabsContent value="positions" className="mt-0">
						<AgentPositionsTab />
					</TabsContent>
					<TabsContent value="activity" className="mt-0">
						<AgentActivityTab />
					</TabsContent>
					<TabsContent value="lrs" className="mt-0">
						<LrsTab />
					</TabsContent>
				</div>
			</Tabs>

			{/* Info Footer */}
			<Alert className="border-blue-200 bg-blue-50/50 dark:bg-blue-950/10">
				<Info className="h-4 w-4 text-blue-500" />
				<AlertDescription className="text-xs text-blue-700 dark:text-blue-300">
					<strong>Note:</strong> FintekPro operates as a Fully-Disclosed
					Broker-Dealer via Alpaca Markets. All US equity accounts are held in
					custody by Velox Clearing LLC (FINRA member, SIPC protected). Data
					refreshes every 30 seconds for live accounts.
				</AlertDescription>
			</Alert>
		</div>
	);
}
