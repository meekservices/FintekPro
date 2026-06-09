import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollableTabsList } from "@/components/ScrollableTabsList";
import {
	TrendingUp,
	TrendingDown,
	Activity,
	BarChart3,
	RefreshCw,
} from "lucide-react";

interface BSEData {
	symbol?: string;
	name?: string;
	ltp?: number;
	change?: number;
	pchange?: number;
	volume?: number;
	value?: number;
	high?: number;
	low?: number;
}

export function BSEData() {
	// Fetch BSE indices
	const {
		data: indicesData,
		refetch: refetchIndices,
		isLoading: indicesLoading,
	} = useQuery({
		queryKey: ["/api/bse/indices"],
		refetchInterval: 30000, // Refresh every 30 seconds
	});

	// Fetch BSE gainers
	const { data: gainersData, refetch: refetchGainers } = useQuery({
		queryKey: ["/api/bse/gainers"],
		refetchInterval: 30000,
	});

	// Fetch BSE losers
	const { data: losersData, refetch: refetchLosers } = useQuery({
		queryKey: ["/api/bse/losers"],
		refetchInterval: 30000,
	});

	// Fetch BSE top turnovers
	const { data: turnoversData, refetch: refetchTurnovers } = useQuery({
		queryKey: ["/api/bse/top-turnovers"],
		refetchInterval: 30000,
	});

	const handleRefresh = () => {
		refetchIndices();
		refetchGainers();
		refetchLosers();
		refetchTurnovers();
	};

	const formatNumber = (num: number) => {
		if (num >= 10000000) {
			return `₹${(num / 10000000).toFixed(2)}Cr`;
		}
		if (num >= 100000) {
			return `₹${(num / 100000).toFixed(2)}L`;
		}
		return `₹${num.toFixed(2)}`;
	};

	const indices = (indicesData as any)?.data || [];
	const gainers = (gainersData as any)?.data || [];
	const losers = (losersData as any)?.data || [];
	const turnovers = (turnoversData as any)?.data || [];

	return (
		<div className="space-y-6" data-testid="bse-data">
			{/* Main BSE Data */}
			<Card>
				<CardHeader className="flex flex-row items-center justify-between">
					<CardTitle className="flex items-center">
						<BarChart3 className="h-5 w-5 mr-2 text-orange-500" />
						BSE Live Data
					</CardTitle>
					<Button
						variant="outline"
						size="sm"
						onClick={handleRefresh}
						disabled={indicesLoading}
						data-testid="bse-refresh"
					>
						<RefreshCw
							className={`h-4 w-4 mr-2 ${indicesLoading ? "animate-spin" : ""}`}
						/>
						Refresh
					</Button>
				</CardHeader>
				<CardContent>
					<Tabs defaultValue="indices" className="w-full">
						<ScrollableTabsList className="grid w-full grid-cols-4">
							<TabsTrigger value="indices" data-testid="bse-indices-tab">
								Indices
							</TabsTrigger>
							<TabsTrigger value="gainers" data-testid="bse-gainers-tab">
								Top Gainers
							</TabsTrigger>
							<TabsTrigger value="losers" data-testid="bse-losers-tab">
								Top Losers
							</TabsTrigger>
							<TabsTrigger value="turnovers" data-testid="bse-turnovers-tab">
								Top Turnovers
							</TabsTrigger>
						</ScrollableTabsList>

						<TabsContent value="indices" className="space-y-4">
							<div className="grid gap-4">
								{indices.length > 0 ? (
									indices.slice(0, 8).map((index: BSEData, i: number) => (
										<div
											key={i}
											className="flex items-center justify-between p-4 border rounded-lg"
										>
											<div className="flex-1">
												<h4 className="font-semibold text-foreground">
													{index.name || index.symbol || `Index ${i + 1}`}
												</h4>
												<p className="text-2xl font-bold text-foreground">
													{index.ltp ? `₹${index.ltp.toFixed(2)}` : "N/A"}
												</p>
											</div>
											<div className="text-right">
												<div
													className={`flex items-center ${
														(index.change || 0) >= 0
															? "text-finance-green"
															: "text-finance-red"
													}`}
												>
													{(index.change || 0) >= 0 ? (
														<TrendingUp className="h-4 w-4 mr-1" />
													) : (
														<TrendingDown className="h-4 w-4 mr-1" />
													)}
													<span className="font-semibold">
														{index.change ? index.change.toFixed(2) : "0.00"} (
														{index.pchange ? index.pchange.toFixed(2) : "0.00"}
														%)
													</span>
												</div>
												{index.volume && (
													<p className="text-sm text-muted-foreground">
														Vol: {formatNumber(index.volume)}
													</p>
												)}
											</div>
										</div>
									))
								) : (
									<div className="text-center py-8">
										<p className="text-muted-foreground">
											Loading BSE indices data...
										</p>
									</div>
								)}
							</div>
						</TabsContent>

						<TabsContent value="gainers" className="space-y-4">
							<div className="grid gap-4">
								{gainers.length > 0 ? (
									gainers.slice(0, 10).map((stock: BSEData, i: number) => (
										<div
											key={i}
											className="flex items-center justify-between p-4 border rounded-lg"
										>
											<div className="flex-1">
												<h4 className="font-semibold text-foreground">
													{stock.name || stock.symbol}
												</h4>
												<p className="text-lg font-bold text-foreground">
													₹{stock.ltp ? stock.ltp.toFixed(2) : "N/A"}
												</p>
											</div>
											<div className="text-right">
												<div className="flex items-center text-finance-green">
													<TrendingUp className="h-4 w-4 mr-1" />
													<span className="font-semibold">
														+{stock.change ? stock.change.toFixed(2) : "0.00"}{" "}
														(+
														{stock.pchange ? stock.pchange.toFixed(2) : "0.00"}
														%)
													</span>
												</div>
												{stock.volume && (
													<p className="text-sm text-muted-foreground">
														Vol: {formatNumber(stock.volume)}
													</p>
												)}
											</div>
										</div>
									))
								) : (
									<div className="text-center py-8">
										<p className="text-muted-foreground">
											Loading BSE gainers data...
										</p>
									</div>
								)}
							</div>
						</TabsContent>

						<TabsContent value="losers" className="space-y-4">
							<div className="grid gap-4">
								{losers.length > 0 ? (
									losers.slice(0, 10).map((stock: BSEData, i: number) => (
										<div
											key={i}
											className="flex items-center justify-between p-4 border rounded-lg"
										>
											<div className="flex-1">
												<h4 className="font-semibold text-foreground">
													{stock.name || stock.symbol}
												</h4>
												<p className="text-lg font-bold text-foreground">
													₹{stock.ltp ? stock.ltp.toFixed(2) : "N/A"}
												</p>
											</div>
											<div className="text-right">
												<div className="flex items-center text-finance-red">
													<TrendingDown className="h-4 w-4 mr-1" />
													<span className="font-semibold">
														{stock.change ? stock.change.toFixed(2) : "0.00"} (
														{stock.pchange ? stock.pchange.toFixed(2) : "0.00"}
														%)
													</span>
												</div>
												{stock.volume && (
													<p className="text-sm text-muted-foreground">
														Vol: {formatNumber(stock.volume)}
													</p>
												)}
											</div>
										</div>
									))
								) : (
									<div className="text-center py-8">
										<p className="text-muted-foreground">
											Loading BSE losers data...
										</p>
									</div>
								)}
							</div>
						</TabsContent>

						<TabsContent value="turnovers" className="space-y-4">
							<div className="grid gap-4">
								{turnovers.length > 0 ? (
									turnovers.slice(0, 10).map((stock: BSEData, i: number) => (
										<div
											key={i}
											className="flex items-center justify-between p-4 border rounded-lg"
										>
											<div className="flex-1">
												<h4 className="font-semibold text-foreground">
													{stock.name || stock.symbol}
												</h4>
												<p className="text-lg font-bold text-foreground">
													₹{stock.ltp ? stock.ltp.toFixed(2) : "N/A"}
												</p>
											</div>
											<div className="text-right">
												<div
													className={`flex items-center ${
														(stock.change || 0) >= 0
															? "text-finance-green"
															: "text-finance-red"
													}`}
												>
													{(stock.change || 0) >= 0 ? (
														<TrendingUp className="h-4 w-4 mr-1" />
													) : (
														<TrendingDown className="h-4 w-4 mr-1" />
													)}
													<span className="font-semibold">
														{stock.change ? stock.change.toFixed(2) : "0.00"} (
														{stock.pchange ? stock.pchange.toFixed(2) : "0.00"}
														%)
													</span>
												</div>
												{stock.value && (
													<p className="text-sm text-muted-foreground">
														Value: {formatNumber(stock.value)}
													</p>
												)}
											</div>
										</div>
									))
								) : (
									<div className="text-center py-8">
										<p className="text-muted-foreground">
											Loading BSE turnovers data...
										</p>
									</div>
								)}
							</div>
						</TabsContent>
					</Tabs>
				</CardContent>
			</Card>
		</div>
	);
}
