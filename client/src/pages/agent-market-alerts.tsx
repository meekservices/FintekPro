import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import {
	BellRing,
	RefreshCw,
	TrendingUp,
	TrendingDown,
	MessageCircle,
	ExternalLink,
	Activity,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";

interface AlertClient {
	clientId: string;
	clientName: string;
	holdingValue: number;
	phone?: string;
}

interface MarketAlert {
	symbol: string;
	name: string;
	changePercent: number;
	direction: "up" | "down";
	currentPrice: number;
	clients: AlertClient[];
}

interface AlertsData {
	generatedAt: string;
	alerts: MarketAlert[];
	cached: boolean;
}

function formatCurrency(n: number) {
	if (n >= 10000000) return `₹${(n / 10000000).toFixed(1)}Cr`;
	if (n >= 100000) return `₹${(n / 100000).toFixed(1)}L`;
	if (n >= 1000) return `₹${(n / 1000).toFixed(0)}K`;
	return `₹${n.toFixed(0)}`;
}

function whatsappLink(client: AlertClient, alert: MarketAlert) {
	const direction = alert.direction === "up" ? "gained" : "declined";
	const msg = `Hi ${client.clientName.split(" ")[0]}, ${alert.name} (${alert.symbol}) has ${direction} ${Math.abs(alert.changePercent).toFixed(2)}% today. Current price: ₹${alert.currentPrice.toFixed(2)}. Your holding value: ${formatCurrency(client.holdingValue)}. Please check your portfolio.`;
	const phone = (client.phone || "").replace(/\D/g, "");
	return `https://wa.me/${phone.startsWith("91") ? phone : "91" + phone}?text=${encodeURIComponent(msg)}`;
}

export default function AgentMarketAlerts() {
	const [minMove, setMinMove] = useState("2.5");
	const [filterClient, setFilterClient] = useState("all");

	const queryKey = ["/api/agent/market-alerts", minMove];
	const { data, isLoading, refetch, isFetching } = useQuery<AlertsData>({
		queryKey,
		queryFn: async () => {
			const res = await fetch(`/api/agent/market-alerts?minMove=${minMove}`);
			if (!res.ok) throw new Error("Failed to fetch");
			return res.json();
		},
		refetchInterval: 15 * 60 * 1000,
	});

	const alerts = data?.alerts || [];
	const gainers = alerts.filter((a) => a.direction === "up");
	const decliners = alerts.filter((a) => a.direction === "down");

	// Collect all unique clients for the filter dropdown
	const allClients = Array.from(
		new Map(
			alerts.flatMap((a) => a.clients.map((c) => [c.clientId, c.clientName])),
		).entries(),
	).map(([id, name]) => ({ id, name }));

	const filteredAlerts =
		filterClient === "all"
			? alerts
			: alerts.filter((a) =>
					a.clients.some((c) => c.clientId === filterClient),
				);

	const filteredGainers = filteredAlerts.filter((a) => a.direction === "up");
	const filteredDecliners = filteredAlerts.filter(
		(a) => a.direction === "down",
	);

	return (
		<div className="container max-w-7xl mx-auto p-4 sm:p-6 space-y-6">
			{/* Header */}
			<div className="flex items-center justify-between flex-wrap gap-3">
				<div>
					<h1 className="text-2xl font-bold flex items-center gap-2">
						<BellRing className="h-6 w-6 text-primary" />
						Market Alert Center
					</h1>
					<p className="text-sm text-muted-foreground mt-1">
						{data?.generatedAt
							? `Last updated ${formatDistanceToNow(new Date(data.generatedAt), { addSuffix: true })}${data.cached ? " (cached)" : ""}`
							: "Significant moves in your clients' holdings"}
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

			{/* Summary chips */}
			<div className="flex items-center gap-3 flex-wrap">
				<Badge variant="secondary" className="px-3 py-1 text-sm gap-1">
					<Activity className="h-3 w-3" /> {alerts.length} alerts today
				</Badge>
				<Badge className="px-3 py-1 text-sm gap-1 bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">
					<TrendingUp className="h-3 w-3" /> {gainers.length} gainers
				</Badge>
				<Badge className="px-3 py-1 text-sm gap-1 bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200">
					<TrendingDown className="h-3 w-3" /> {decliners.length} decliners
				</Badge>
			</div>

			{/* Filters */}
			<div className="flex items-center gap-3 flex-wrap">
				<div className="flex items-center gap-2">
					<span className="text-sm text-muted-foreground">Min move:</span>
					<Select value={minMove} onValueChange={setMinMove}>
						<SelectTrigger className="w-24 h-8">
							<SelectValue />
						</SelectTrigger>
						<SelectContent>
							<SelectItem value="2.5">2.5%</SelectItem>
							<SelectItem value="5">5%</SelectItem>
							<SelectItem value="10">10%</SelectItem>
						</SelectContent>
					</Select>
				</div>
				{allClients.length > 0 && (
					<div className="flex items-center gap-2">
						<span className="text-sm text-muted-foreground">Client:</span>
						<Select value={filterClient} onValueChange={setFilterClient}>
							<SelectTrigger className="w-48 h-8">
								<SelectValue />
							</SelectTrigger>
							<SelectContent>
								<SelectItem value="all">All Clients</SelectItem>
								{allClients.map((c) => (
									<SelectItem key={c.id} value={c.id}>
										{c.name}
									</SelectItem>
								))}
							</SelectContent>
						</Select>
					</div>
				)}
			</div>

			{isLoading ? (
				<div className="py-16 text-center text-muted-foreground">
					Scanning client holdings for market moves...
				</div>
			) : filteredAlerts.length === 0 ? (
				<Card>
					<CardContent className="py-16 text-center">
						<BellRing className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
						<h3 className="font-semibold text-lg mb-2">No significant moves</h3>
						<p className="text-muted-foreground text-sm max-w-sm mx-auto">
							{alerts.length === 0
								? "No holdings in your clients' portfolios have moved more than " +
									minMove +
									"% today. Markets may be closed."
								: "No moves match the current filter criteria."}
						</p>
					</CardContent>
				</Card>
			) : (
				<div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
					{/* Gainers */}
					<div className="space-y-3">
						<h3 className="font-semibold flex items-center gap-2 text-green-700 dark:text-green-400">
							<TrendingUp className="h-4 w-4" /> Gainers (
							{filteredGainers.length})
						</h3>
						{filteredGainers.length === 0 ? (
							<p className="text-sm text-muted-foreground py-4 text-center">
								No gainers with current filter
							</p>
						) : (
							filteredGainers.map((alert) => (
								<AlertCard
									key={alert.symbol}
									alert={alert}
									filterClient={filterClient}
								/>
							))
						)}
					</div>

					{/* Decliners */}
					<div className="space-y-3">
						<h3 className="font-semibold flex items-center gap-2 text-red-700 dark:text-red-400">
							<TrendingDown className="h-4 w-4" /> Decliners (
							{filteredDecliners.length})
						</h3>
						{filteredDecliners.length === 0 ? (
							<p className="text-sm text-muted-foreground py-4 text-center">
								No decliners with current filter
							</p>
						) : (
							filteredDecliners.map((alert) => (
								<AlertCard
									key={alert.symbol}
									alert={alert}
									filterClient={filterClient}
								/>
							))
						)}
					</div>
				</div>
			)}
		</div>
	);
}

function AlertCard({
	alert,
	filterClient,
}: { alert: MarketAlert; filterClient: string }) {
	const isUp = alert.direction === "up";
	const borderColor = isUp ? "border-l-green-500" : "border-l-red-500";
	const changeColor = isUp
		? "text-green-700 dark:text-green-400"
		: "text-red-700 dark:text-red-400";
	const bgColor = isUp
		? "bg-green-50/50 dark:bg-green-950/20"
		: "bg-red-50/50 dark:bg-red-950/20";

	const displayedClients =
		filterClient === "all"
			? alert.clients
			: alert.clients.filter((c) => c.clientId === filterClient);

	return (
		<Card className={`border-l-4 ${borderColor} ${bgColor}`}>
			<CardContent className="p-4 space-y-3">
				<div className="flex items-start justify-between">
					<div>
						<div className="font-semibold text-sm">{alert.name}</div>
						<div className="text-xs text-muted-foreground">{alert.symbol}</div>
					</div>
					<div className="text-right">
						<div className={`text-xl font-bold ${changeColor}`}>
							{isUp ? "+" : ""}
							{alert.changePercent.toFixed(2)}%
						</div>
						<div className="text-xs text-muted-foreground">
							₹{alert.currentPrice.toFixed(2)}
						</div>
					</div>
				</div>

				<div className="space-y-1.5">
					<div className="text-xs text-muted-foreground font-medium">
						Affected clients:
					</div>
					{displayedClients.map((client) => (
						<div
							key={client.clientId}
							className="flex items-center justify-between"
						>
							<div>
								<span className="text-sm font-medium">{client.clientName}</span>
								{client.holdingValue > 0 && (
									<span className="text-xs text-muted-foreground ml-2">
										{formatCurrency(client.holdingValue)}
									</span>
								)}
							</div>
							<div className="flex gap-1">
								{client.phone && (
									<Button
										variant="ghost"
										size="sm"
										className="h-6 px-2 text-xs gap-1 text-green-700"
										onClick={() =>
											window.open(whatsappLink(client, alert), "_blank")
										}
									>
										<MessageCircle className="h-3 w-3" /> WA
									</Button>
								)}
								<Button
									variant="ghost"
									size="sm"
									className="h-6 px-2 text-xs"
									onClick={() =>
										window.open(
											`/agent/crm/clients/${client.clientId}`,
											"_blank",
										)
									}
								>
									<ExternalLink className="h-3 w-3" />
								</Button>
							</div>
						</div>
					))}
				</div>
			</CardContent>
		</Card>
	);
}
