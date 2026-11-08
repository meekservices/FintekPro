import { useMarketStatus, type ExchangeStatus } from "@/hooks/use-market-data";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Clock, Circle, Sparkles } from "lucide-react";

interface MarketStatusCardProps {
	exchange: ExchangeStatus;
	exchangeCode: string;
}

function MarketStatusCard({ exchange, exchangeCode }: MarketStatusCardProps) {
	const isOpen = exchange.status === "open";

	return (
		<div
			className="flex items-center justify-between p-3 bg-muted rounded-lg"
			data-testid={`market-status-${exchangeCode}`}
		>
			<div className="flex items-center gap-3">
				<Circle
					className={`h-3 w-3 fill-current ${isOpen ? "text-finance-green" : "text-finance-red"}`}
					data-testid={`status-indicator-${exchangeCode}`}
				/>
				<div>
					<p
						className="font-medium text-foreground"
						data-testid={`exchange-name-${exchangeCode}`}
					>
						{exchange.name}
					</p>
					<p
						className="text-xs text-muted-foreground"
						data-testid={`trading-hours-${exchangeCode}`}
					>
						{exchange.tradingHours}
					</p>
				</div>
			</div>

			<div className="text-right">
				<p
					className={`text-sm font-medium ${isOpen ? "text-finance-green" : "text-finance-red"}`}
					data-testid={`status-text-${exchangeCode}`}
				>
					{isOpen ? "LIVE" : "CLOSED"}
				</p>
				<p
					className="text-xs text-muted-foreground"
					data-testid={`next-time-${exchangeCode}`}
				>
					{isOpen
						? `Closes ${exchange.nextClose}`
						: `Opens ${exchange.nextOpen}`}
				</p>
			</div>
		</div>
	);
}

export function MarketStatus() {
	const { data: marketStatus, isLoading, error } = useMarketStatus();

	if (isLoading) {
		return (
			<Card data-testid="market-status-loading">
				<CardHeader>
					<CardTitle className="text-lg font-semibold text-foreground flex items-center gap-2">
						<Clock className="h-5 w-5 text-finance-blue" />
						Market Status
					</CardTitle>
				</CardHeader>
				<CardContent>
					<div className="space-y-3">
						{Array.from({ length: 6 }).map((_, i) => (
							<div
								key={i}
								className="flex items-center justify-between p-3 bg-muted rounded-lg animate-pulse"
							>
								<div className="flex items-center gap-3">
									<div className="h-3 w-3 bg-muted rounded-full" />
									<div>
										<div className="h-4 w-32 bg-muted rounded mb-1" />
										<div className="h-3 w-24 bg-muted rounded" />
									</div>
								</div>
								<div className="text-right">
									<div className="h-4 w-16 bg-muted rounded mb-1" />
									<div className="h-3 w-20 bg-muted rounded" />
								</div>
							</div>
						))}
					</div>
				</CardContent>
			</Card>
		);
	}

	if (error) {
		return (
			<Card data-testid="market-status-error">
				<CardHeader>
					<CardTitle className="text-lg font-semibold text-foreground flex items-center gap-2">
						<Clock className="h-5 w-5 text-finance-blue" />
						Market Status
					</CardTitle>
				</CardHeader>
				<CardContent>
					<div className="text-center py-4">
						<p className="text-red-500 text-sm">Unable to load market status</p>
						<p className="text-muted-foreground text-xs">
							Please check your connection
						</p>
					</div>
				</CardContent>
			</Card>
		);
	}

	if (!marketStatus) {
		return null;
	}

	const specialSession =
		marketStatus.exchanges.nse?.specialSession ||
		marketStatus.exchanges.bse?.specialSession ||
		marketStatus.exchanges.mcx?.specialSession;
	const isSpecialSessionLive =
		(marketStatus.exchanges.nse?.status === "open" && !!marketStatus.exchanges.nse?.specialSession) ||
		(marketStatus.exchanges.bse?.status === "open" && !!marketStatus.exchanges.bse?.specialSession);

	return (
		<Card data-testid="market-status">
			<CardHeader>
				<div className="flex items-center justify-between">
					<CardTitle className="text-lg font-semibold text-foreground flex items-center gap-2">
						<Clock className="h-5 w-5 text-finance-blue" />
						Market Status
					</CardTitle>
					<div className="text-right">
						<p
							className="text-sm font-medium text-foreground"
							data-testid="current-time"
						>
							{marketStatus.currentTime}
						</p>
						<p className="text-xs text-muted-foreground">IST</p>
					</div>
				</div>
			</CardHeader>
			<CardContent>
				{specialSession && (
					<div
						className="mb-3 p-3 bg-amber-500/10 border border-amber-500/30 rounded-lg flex items-center justify-between"
						data-testid="banner-special-session"
					>
						<div className="flex items-center gap-2.5">
							<Sparkles className="h-4 w-4 text-amber-500 animate-pulse shrink-0" />
							<div>
								<p className="text-sm font-semibold text-amber-700 dark:text-amber-400">
									{specialSession.name} ({specialSession.startTime} – {specialSession.endTime} IST)
								</p>
								<p className="text-xs text-muted-foreground">
									{isSpecialSessionLive
										? "Special festive session is currently LIVE"
										: "Special trading session scheduled for today"}
								</p>
							</div>
						</div>
						<span
							className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
								isSpecialSessionLive
									? "bg-green-600 text-white animate-pulse"
									: "bg-amber-500/20 text-amber-700 dark:text-amber-300"
							}`}
						>
							{isSpecialSessionLive ? "LIVE NOW" : "SCHEDULED"}
						</span>
					</div>
				)}
				<div className="space-y-3" data-testid="exchanges-status">
					<MarketStatusCard
						exchange={marketStatus.exchanges.nse}
						exchangeCode="nse"
					/>
					<MarketStatusCard
						exchange={marketStatus.exchanges.bse}
						exchangeCode="bse"
					/>
					<MarketStatusCard
						exchange={marketStatus.exchanges.mcx}
						exchangeCode="mcx"
					/>
					<MarketStatusCard
						exchange={marketStatus.exchanges.ncdex}
						exchangeCode="ncdex"
					/>
					<MarketStatusCard
						exchange={marketStatus.exchanges.msei}
						exchangeCode="msei"
					/>
					<MarketStatusCard
						exchange={marketStatus.exchanges.global}
						exchangeCode="global"
					/>
				</div>

				<div className="mt-4 pt-3 border-t border-border">
					<div className="flex items-center justify-between text-xs text-muted-foreground">
						<span>
							Last updated:{" "}
							{new Date(marketStatus.timestamp).toLocaleTimeString()}
						</span>
						<span>Timezone: {marketStatus.timezone}</span>
					</div>
				</div>
			</CardContent>
		</Card>
	);
}
