import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsTrigger } from "@/components/ui/tabs";
import { ScrollableTabsList } from "@/components/ScrollableTabsList";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import {
	TrendingUp,
	TrendingDown,
	Wheat,
	Droplet,
	Zap,
	Gem,
	Package,
	BarChart3,
	Activity,
	DollarSign,
} from "lucide-react";

interface Commodity {
	id: string;
	name: string;
	symbol: string;
	exchange: "MCX" | "NCDEX";
	category: string;
	price: number;
	change: number;
	changePercent: number;
	volume: string;
	unit: string;
}

export default function CommoditiesPage() {
	const [selectedExchange, setSelectedExchange] = useState<
		"MCX" | "NCDEX" | "ALL"
	>("ALL");

	const { data: commoditiesData, isLoading } = useQuery<Commodity[]>({
		queryKey: ["/api/market/commodities", { exchange: selectedExchange }],
	});

	const commodities = commoditiesData || [];

	const filteredCommodities = useMemo(() => {
		return selectedExchange === "ALL"
			? commodities
			: commodities.filter((c) => c.exchange === selectedExchange);
	}, [commodities, selectedExchange]);

	const getCategoryIcon = (category: string) => {
		switch (category) {
			case "Precious Metals":
				return <Gem className="h-5 w-5" />;
			case "Energy":
				return <Zap className="h-5 w-5" />;
			case "Base Metals":
				return <Package className="h-5 w-5" />;
			case "Agriculture":
				return <Wheat className="h-5 w-5" />;
			case "Spices":
				return <Droplet className="h-5 w-5" />;
			default:
				return <Activity className="h-5 w-5" />;
		}
	};

	const parseVolume = (volume: string | number): number => {
		if (typeof volume === "number") return volume;
		if (!volume) return 0;
		const str = String(volume).toUpperCase();
		if (str.includes("K"))
			return Number.parseFloat(str.replace("K", "")) * 1000;
		if (str.includes("M"))
			return Number.parseFloat(str.replace("M", "")) * 1000000;
		return Number.parseFloat(str) || 0;
	};

	const formatVolume = (volume: number): string => {
		if (volume >= 1000000) return `${(volume / 1000000).toFixed(1)}M`;
		if (volume >= 1000) return `${(volume / 1000).toFixed(1)}K`;
		return String(volume);
	};

	const marketStats = useMemo(() => {
		if (commodities.length === 0) {
			return {
				totalVolume: "0",
				advancers: 0,
				decliners: 0,
				topGainer: { name: "-", percent: 0 },
				topLoser: { name: "-", percent: 0 },
			};
		}

		const advancers = commodities.filter((c) => c.changePercent > 0).length;
		const decliners = commodities.filter((c) => c.changePercent < 0).length;
		const sorted = [...commodities].sort(
			(a, b) => b.changePercent - a.changePercent,
		);
		const topGainer = sorted[0];
		const topLoser = sorted[sorted.length - 1];
		const totalVolume = commodities.reduce(
			(sum, c) => sum + parseVolume(c.volume),
			0,
		);

		return {
			totalVolume: formatVolume(totalVolume),
			advancers,
			decliners,
			topGainer: topGainer
				? { name: topGainer.name, percent: topGainer.changePercent }
				: { name: "-", percent: 0 },
			topLoser: topLoser
				? { name: topLoser.name, percent: topLoser.changePercent }
				: { name: "-", percent: 0 },
		};
	}, [commodities]);

	return (
		<div className="container mx-auto py-6 px-4 max-w-7xl">
			<div className="mb-6">
				<div className="flex items-center gap-3 mb-2">
					<Package className="h-8 w-8 text-primary" />
					<div>
						<h1 className="text-3xl font-bold" data-testid="commodities-title">
							Commodities Trading
						</h1>
						<p className="text-muted-foreground">
							Trade on MCX and NCDEX exchanges
						</p>
					</div>
				</div>
			</div>

			{/* Market Stats */}
			<div className="grid md:grid-cols-5 gap-4 mb-6">
				<Card>
					<CardContent className="pt-6">
						<div className="flex items-center justify-between">
							<div>
								<p className="text-sm text-muted-foreground">Total Volume</p>
								<p className="text-2xl font-bold">{marketStats.totalVolume}</p>
							</div>
							<BarChart3 className="h-8 w-8 text-blue-600" />
						</div>
					</CardContent>
				</Card>

				<Card>
					<CardContent className="pt-6">
						<div className="flex items-center justify-between">
							<div>
								<p className="text-sm text-muted-foreground">Advancers</p>
								<p className="text-2xl font-bold text-green-600">
									{marketStats.advancers}
								</p>
							</div>
							<TrendingUp className="h-8 w-8 text-green-600" />
						</div>
					</CardContent>
				</Card>

				<Card>
					<CardContent className="pt-6">
						<div className="flex items-center justify-between">
							<div>
								<p className="text-sm text-muted-foreground">Decliners</p>
								<p className="text-2xl font-bold text-red-600">
									{marketStats.decliners}
								</p>
							</div>
							<TrendingDown className="h-8 w-8 text-red-600" />
						</div>
					</CardContent>
				</Card>

				<Card>
					<CardContent className="pt-6">
						<div>
							<p className="text-sm text-muted-foreground">Top Gainer</p>
							<p className="font-semibold">{marketStats.topGainer.name}</p>
							<p className="text-green-600 font-bold">
								+{marketStats.topGainer.percent}%
							</p>
						</div>
					</CardContent>
				</Card>

				<Card>
					<CardContent className="pt-6">
						<div>
							<p className="text-sm text-muted-foreground">Top Loser</p>
							<p className="font-semibold">{marketStats.topLoser.name}</p>
							<p className="text-red-600 font-bold">
								{marketStats.topLoser.percent}%
							</p>
						</div>
					</CardContent>
				</Card>
			</div>

			<Tabs defaultValue="market" className="space-y-6">
				<ScrollableTabsList>
					<TabsTrigger value="market" data-testid="tab-market">
						<Activity className="h-4 w-4 mr-2" />
						Market Watch
					</TabsTrigger>
					<TabsTrigger value="trade" data-testid="tab-trade">
						<DollarSign className="h-4 w-4 mr-2" />
						Place Order
					</TabsTrigger>
					<TabsTrigger value="metals" data-testid="tab-metals">
						<Gem className="h-4 w-4 mr-2" />
						Precious Metals
					</TabsTrigger>
					<TabsTrigger value="energy" data-testid="tab-energy">
						<Zap className="h-4 w-4 mr-2" />
						Energy
					</TabsTrigger>
					<TabsTrigger value="agri" data-testid="tab-agri">
						<Wheat className="h-4 w-4 mr-2" />
						Agriculture
					</TabsTrigger>
				</ScrollableTabsList>

				{/* Market Watch Tab */}
				<TabsContent value="market" className="space-y-4">
					<Card>
						<CardHeader>
							<div className="flex items-center justify-between">
								<div>
									<CardTitle>Live Commodity Prices</CardTitle>
									<CardDescription>
										Real-time prices from MCX and NCDEX
									</CardDescription>
								</div>
								<Select
									value={selectedExchange}
									onValueChange={(value: any) => setSelectedExchange(value)}
								>
									<SelectTrigger className="w-32" data-testid="select-exchange">
										<SelectValue />
									</SelectTrigger>
									<SelectContent>
										<SelectItem value="ALL">All</SelectItem>
										<SelectItem value="MCX">MCX</SelectItem>
										<SelectItem value="NCDEX">NCDEX</SelectItem>
									</SelectContent>
								</Select>
							</div>
						</CardHeader>
						<CardContent>
							<div className="space-y-3">
								{filteredCommodities.map((commodity) => (
									<div
										key={commodity.id}
										className="flex items-center justify-between p-4 border rounded-lg hover:bg-accent transition-colors cursor-pointer"
										data-testid={`commodity-${commodity.id}`}
									>
										<div className="flex items-center gap-4">
											<div className="p-2 bg-muted rounded-lg">
												{getCategoryIcon(commodity.category)}
											</div>
											<div>
												<h4 className="font-semibold">{commodity.name}</h4>
												<div className="flex items-center gap-2 text-sm text-muted-foreground">
													<span>{commodity.symbol}</span>
													<Badge variant="outline" className="text-xs">
														{commodity.exchange}
													</Badge>
													<span>• {commodity.category}</span>
												</div>
											</div>
										</div>

										<div className="text-right">
											<p className="text-xl font-bold">
												₹{commodity.price.toLocaleString()}
											</p>
											<div className="flex items-center gap-2 justify-end">
												<p
													className={`text-sm font-medium ${commodity.change >= 0 ? "text-green-600" : "text-red-600"}`}
												>
													{commodity.change >= 0 ? "+" : ""}
													{commodity.change}
												</p>
												<Badge
													variant={
														commodity.changePercent >= 0
															? "default"
															: "destructive"
													}
												>
													{commodity.changePercent >= 0 ? "+" : ""}
													{commodity.changePercent}%
												</Badge>
											</div>
											<p className="text-xs text-muted-foreground mt-1">
												Vol: {commodity.volume} • /{commodity.unit}
											</p>
										</div>
									</div>
								))}
							</div>
						</CardContent>
					</Card>
				</TabsContent>

				{/* Trade Tab */}
				<TabsContent value="trade" className="space-y-6">
					<div className="grid lg:grid-cols-3 gap-6">
						<Card className="lg:col-span-2">
							<CardHeader>
								<CardTitle>Place Commodity Order</CardTitle>
								<CardDescription>
									Trade commodities on MCX and NCDEX
								</CardDescription>
							</CardHeader>
							<CardContent className="space-y-4">
								<div className="grid md:grid-cols-2 gap-4">
									<div className="space-y-2">
										<Label>Exchange</Label>
										<Select>
											<SelectTrigger data-testid="select-trade-exchange">
												<SelectValue placeholder="Select exchange" />
											</SelectTrigger>
											<SelectContent>
												<SelectItem value="mcx">MCX</SelectItem>
												<SelectItem value="ncdex">NCDEX</SelectItem>
											</SelectContent>
										</Select>
									</div>

									<div className="space-y-2">
										<Label>Commodity</Label>
										<Select>
											<SelectTrigger data-testid="select-commodity">
												<SelectValue placeholder="Select commodity" />
											</SelectTrigger>
											<SelectContent>
												<SelectItem value="gold">Gold</SelectItem>
												<SelectItem value="silver">Silver</SelectItem>
												<SelectItem value="crude">Crude Oil</SelectItem>
												<SelectItem value="naturalgas">Natural Gas</SelectItem>
											</SelectContent>
										</Select>
									</div>
								</div>

								<div className="grid md:grid-cols-2 gap-4">
									<div className="space-y-2">
										<Label>Order Type</Label>
										<div className="flex gap-2">
											<Button
												variant="default"
												className="flex-1"
												data-testid="button-buy-commodity"
											>
												Buy
											</Button>
											<Button
												variant="outline"
												className="flex-1"
												data-testid="button-sell-commodity"
											>
												Sell
											</Button>
										</div>
									</div>

									<div className="space-y-2">
										<Label>Quantity (Lot)</Label>
										<Input
											type="number"
											defaultValue="1"
											data-testid="input-commodity-quantity"
										/>
									</div>
								</div>

								<div className="grid md:grid-cols-2 gap-4">
									<div className="space-y-2">
										<Label>Price</Label>
										<Input
											type="number"
											placeholder="Market Price"
											data-testid="input-commodity-price"
										/>
									</div>

									<div className="space-y-2">
										<Label>Validity</Label>
										<Select defaultValue="day">
											<SelectTrigger data-testid="select-commodity-validity">
												<SelectValue />
											</SelectTrigger>
											<SelectContent>
												<SelectItem value="day">Day</SelectItem>
												<SelectItem value="ioc">IOC</SelectItem>
											</SelectContent>
										</Select>
									</div>
								</div>

								<div className="pt-4 space-y-2">
									<div className="flex justify-between text-sm">
										<span className="text-muted-foreground">
											Margin Required
										</span>
										<span className="font-medium">₹85,000</span>
									</div>
									<div className="flex justify-between text-sm">
										<span className="text-muted-foreground">
											Available Margin
										</span>
										<span className="font-medium text-green-600">
											₹5,00,000
										</span>
									</div>
								</div>

								<Button
									className="w-full"
									size="lg"
									data-testid="button-place-commodity-order"
								>
									Place Order
								</Button>
							</CardContent>
						</Card>

						<Card>
							<CardHeader>
								<CardTitle>Order Book</CardTitle>
								<CardDescription>Recent commodity orders</CardDescription>
							</CardHeader>
							<CardContent>
								<div className="space-y-3">
									<div className="p-3 border rounded-lg">
										<div className="flex justify-between items-start mb-2">
											<div>
												<p className="font-semibold">Gold</p>
												<p className="text-sm text-muted-foreground">MCX</p>
											</div>
											<Badge>Buy</Badge>
										</div>
										<div className="flex justify-between text-sm">
											<span className="text-muted-foreground">Qty: 1</span>
											<span className="font-medium">₹62,850</span>
										</div>
									</div>

									<div className="p-3 border rounded-lg">
										<div className="flex justify-between items-start mb-2">
											<div>
												<p className="font-semibold">Crude Oil</p>
												<p className="text-sm text-muted-foreground">MCX</p>
											</div>
											<Badge variant="destructive">Sell</Badge>
										</div>
										<div className="flex justify-between text-sm">
											<span className="text-muted-foreground">Qty: 2</span>
											<span className="font-medium">₹6,250</span>
										</div>
									</div>
								</div>
							</CardContent>
						</Card>
					</div>
				</TabsContent>

				{/* Precious Metals Tab */}
				<TabsContent value="metals" className="space-y-4">
					<div className="grid md:grid-cols-2 gap-6">
						{commodities
							.filter((c) => c.category === "Precious Metals")
							.map((metal) => (
								<Card key={metal.id}>
									<CardHeader>
										<div className="flex items-center justify-between">
											<div className="flex items-center gap-3">
												<Gem className="h-6 w-6 text-yellow-600" />
												<div>
													<CardTitle>{metal.name}</CardTitle>
													<CardDescription>
														{metal.exchange} • {metal.unit}
													</CardDescription>
												</div>
											</div>
											<Badge
												variant={
													metal.changePercent >= 0 ? "default" : "destructive"
												}
											>
												{metal.changePercent >= 0 ? "+" : ""}
												{metal.changePercent}%
											</Badge>
										</div>
									</CardHeader>
									<CardContent>
										<div className="space-y-4">
											<div>
												<p className="text-3xl font-bold">
													₹{metal.price.toLocaleString()}
												</p>
												<p
													className={`text-sm ${metal.change >= 0 ? "text-green-600" : "text-red-600"}`}
												>
													{metal.change >= 0 ? "+" : ""}₹{metal.change} today
												</p>
											</div>
											<div className="flex justify-between text-sm">
												<span className="text-muted-foreground">Volume</span>
												<span className="font-medium">{metal.volume}</span>
											</div>
											<Button
												className="w-full"
												data-testid={`button-trade-${metal.symbol.toLowerCase()}`}
											>
												Trade {metal.name}
											</Button>
										</div>
									</CardContent>
								</Card>
							))}
					</div>
				</TabsContent>

				{/* Energy Tab */}
				<TabsContent value="energy" className="space-y-4">
					<div className="grid md:grid-cols-2 gap-6">
						{commodities
							.filter((c) => c.category === "Energy")
							.map((energy) => (
								<Card key={energy.id}>
									<CardHeader>
										<div className="flex items-center justify-between">
											<div className="flex items-center gap-3">
												<Zap className="h-6 w-6 text-orange-600" />
												<div>
													<CardTitle>{energy.name}</CardTitle>
													<CardDescription>
														{energy.exchange} • {energy.unit}
													</CardDescription>
												</div>
											</div>
											<Badge
												variant={
													energy.changePercent >= 0 ? "default" : "destructive"
												}
											>
												{energy.changePercent >= 0 ? "+" : ""}
												{energy.changePercent}%
											</Badge>
										</div>
									</CardHeader>
									<CardContent>
										<div className="space-y-4">
											<div>
												<p className="text-3xl font-bold">
													₹{energy.price.toLocaleString()}
												</p>
												<p
													className={`text-sm ${energy.change >= 0 ? "text-green-600" : "text-red-600"}`}
												>
													{energy.change >= 0 ? "+" : ""}₹{energy.change} today
												</p>
											</div>
											<div className="flex justify-between text-sm">
												<span className="text-muted-foreground">Volume</span>
												<span className="font-medium">{energy.volume}</span>
											</div>
											<Button
												className="w-full"
												data-testid={`button-trade-${energy.symbol.toLowerCase()}`}
											>
												Trade {energy.name}
											</Button>
										</div>
									</CardContent>
								</Card>
							))}
					</div>
				</TabsContent>

				{/* Agriculture Tab */}
				<TabsContent value="agri" className="space-y-4">
					<div className="grid md:grid-cols-2 gap-6">
						{commodities
							.filter(
								(c) => c.category === "Agriculture" || c.category === "Spices",
							)
							.map((agri) => (
								<Card key={agri.id}>
									<CardHeader>
										<div className="flex items-center justify-between">
											<div className="flex items-center gap-3">
												<Wheat className="h-6 w-6 text-green-600" />
												<div>
													<CardTitle>{agri.name}</CardTitle>
													<CardDescription>
														{agri.exchange} • {agri.unit}
													</CardDescription>
												</div>
											</div>
											<Badge
												variant={
													agri.changePercent >= 0 ? "default" : "destructive"
												}
											>
												{agri.changePercent >= 0 ? "+" : ""}
												{agri.changePercent}%
											</Badge>
										</div>
									</CardHeader>
									<CardContent>
										<div className="space-y-4">
											<div>
												<p className="text-3xl font-bold">
													₹{agri.price.toLocaleString()}
												</p>
												<p
													className={`text-sm ${agri.change >= 0 ? "text-green-600" : "text-red-600"}`}
												>
													{agri.change >= 0 ? "+" : ""}₹{agri.change} today
												</p>
											</div>
											<div className="flex justify-between text-sm">
												<span className="text-muted-foreground">Volume</span>
												<span className="font-medium">{agri.volume}</span>
											</div>
											<Button
												className="w-full"
												data-testid={`button-trade-${agri.symbol.toLowerCase()}`}
											>
												Trade {agri.name}
											</Button>
										</div>
									</CardContent>
								</Card>
							))}
					</div>
				</TabsContent>
			</Tabs>
		</div>
	);
}
