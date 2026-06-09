import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
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
	DollarSign,
	Calendar,
	Target,
	Activity,
	BarChart3,
	AlertCircle,
	CheckCircle,
	Clock,
} from "lucide-react";

interface DerivativePosition {
	id: string;
	symbol: string;
	type: "future" | "call" | "put";
	strike?: number;
	expiry: string;
	quantity: number;
	buyPrice: number;
	currentPrice: number;
	pnl: number;
	pnlPercentage: number;
}

interface PopularContract {
	symbol: string;
	ltp: number;
	change: number;
	volume: string;
}

export default function DerivativesPage() {
	const { user, isAuthenticated } = useAuth();
	const [orderType, setOrderType] = useState<"buy" | "sell">("buy");
	const [productType, setProductType] = useState<"futures" | "options">(
		"futures",
	);

	const { data: positionsData, isLoading: isLoadingPositions } = useQuery<
		DerivativePosition[]
	>({
		queryKey: ["/api/derivatives/positions"],
		enabled: isAuthenticated,
	});

	const { data: contractsData, isLoading: isLoadingContracts } = useQuery<
		PopularContract[]
	>({
		queryKey: ["/api/derivatives/popular-contracts"],
		enabled: isAuthenticated,
	});

	const positions = positionsData || [];
	const popularContracts = contractsData || [];

	const calculateTotalPnL = () => {
		return positions.reduce((sum, pos) => sum + pos.pnl, 0);
	};

	return (
		<div className="container mx-auto py-6 px-4 max-w-7xl">
			<div className="mb-6">
				<div className="flex items-center gap-3 mb-2">
					<Activity className="h-8 w-8 text-primary" />
					<div>
						<h1 className="text-3xl font-bold" data-testid="derivatives-title">
							Derivatives Trading
						</h1>
						<p className="text-muted-foreground">
							Trade Futures & Options on NSE
						</p>
					</div>
				</div>
			</div>

			{/* Overview Cards */}
			<div className="grid md:grid-cols-4 gap-4 mb-6">
				<Card>
					<CardContent className="pt-6">
						<div className="flex items-center justify-between">
							<div>
								<p className="text-sm text-muted-foreground">Total P&L</p>
								<p
									className={`text-2xl font-bold ${calculateTotalPnL() >= 0 ? "text-green-600" : "text-red-600"}`}
								>
									₹{calculateTotalPnL().toLocaleString()}
								</p>
							</div>
							{calculateTotalPnL() >= 0 ? (
								<TrendingUp className="h-8 w-8 text-green-600" />
							) : (
								<TrendingDown className="h-8 w-8 text-red-600" />
							)}
						</div>
					</CardContent>
				</Card>

				<Card>
					<CardContent className="pt-6">
						<div className="flex items-center justify-between">
							<div>
								<p className="text-sm text-muted-foreground">Open Positions</p>
								<p className="text-2xl font-bold">{positions.length}</p>
							</div>
							<Target className="h-8 w-8 text-blue-600" />
						</div>
					</CardContent>
				</Card>

				<Card>
					<CardContent className="pt-6">
						<div className="flex items-center justify-between">
							<div>
								<p className="text-sm text-muted-foreground">Margin Used</p>
								<p className="text-2xl font-bold">₹2.5L</p>
							</div>
							<DollarSign className="h-8 w-8 text-orange-600" />
						</div>
					</CardContent>
				</Card>

				<Card>
					<CardContent className="pt-6">
						<div className="flex items-center justify-between">
							<div>
								<p className="text-sm text-muted-foreground">
									Available Margin
								</p>
								<p className="text-2xl font-bold">₹7.5L</p>
							</div>
							<BarChart3 className="h-8 w-8 text-purple-600" />
						</div>
					</CardContent>
				</Card>
			</div>

			<Tabs defaultValue="futures" className="space-y-6">
				<ScrollableTabsList>
					<TabsTrigger value="futures" data-testid="tab-futures">
						<TrendingUp className="h-4 w-4 mr-2" />
						Futures
					</TabsTrigger>
					<TabsTrigger value="options" data-testid="tab-options">
						<Target className="h-4 w-4 mr-2" />
						Options
					</TabsTrigger>
					<TabsTrigger value="positions" data-testid="tab-positions">
						<Activity className="h-4 w-4 mr-2" />
						Positions
					</TabsTrigger>
					<TabsTrigger value="chain" data-testid="tab-chain">
						<BarChart3 className="h-4 w-4 mr-2" />
						Option Chain
					</TabsTrigger>
				</ScrollableTabsList>

				{/* Futures Tab */}
				<TabsContent value="futures" className="space-y-6">
					<div className="grid lg:grid-cols-3 gap-6">
						<Card className="lg:col-span-2">
							<CardHeader>
								<CardTitle>Place Futures Order</CardTitle>
								<CardDescription>Trade index and stock futures</CardDescription>
							</CardHeader>
							<CardContent className="space-y-4">
								<div className="grid md:grid-cols-2 gap-4">
									<div className="space-y-2">
										<Label>Symbol</Label>
										<Select>
											<SelectTrigger data-testid="select-symbol">
												<SelectValue placeholder="Select symbol" />
											</SelectTrigger>
											<SelectContent>
												<SelectItem value="nifty">NIFTY 50</SelectItem>
												<SelectItem value="banknifty">BANKNIFTY</SelectItem>
												<SelectItem value="finnifty">FINNIFTY</SelectItem>
												<SelectItem value="reliance">RELIANCE</SelectItem>
											</SelectContent>
										</Select>
									</div>

									<div className="space-y-2">
										<Label>Expiry Date</Label>
										<Select>
											<SelectTrigger data-testid="select-expiry">
												<SelectValue placeholder="Select expiry" />
											</SelectTrigger>
											<SelectContent>
												<SelectItem value="2025-01-23">23 Jan 2025</SelectItem>
												<SelectItem value="2025-01-30">30 Jan 2025</SelectItem>
												<SelectItem value="2025-02-27">27 Feb 2025</SelectItem>
											</SelectContent>
										</Select>
									</div>
								</div>

								<div className="grid md:grid-cols-2 gap-4">
									<div className="space-y-2">
										<Label>Order Type</Label>
										<div className="flex gap-2">
											<Button
												variant={orderType === "buy" ? "default" : "outline"}
												className="flex-1"
												onClick={() => setOrderType("buy")}
												data-testid="button-buy"
											>
												Buy
											</Button>
											<Button
												variant={orderType === "sell" ? "default" : "outline"}
												className="flex-1"
												onClick={() => setOrderType("sell")}
												data-testid="button-sell"
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
											data-testid="input-quantity"
										/>
									</div>
								</div>

								<div className="grid md:grid-cols-2 gap-4">
									<div className="space-y-2">
										<Label>Price</Label>
										<Input
											type="number"
											placeholder="0.00"
											data-testid="input-price"
										/>
									</div>

									<div className="space-y-2">
										<Label>Order Validity</Label>
										<Select defaultValue="day">
											<SelectTrigger data-testid="select-validity">
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
										<span className="font-medium">₹1,50,000</span>
									</div>
									<div className="flex justify-between text-sm">
										<span className="text-muted-foreground">
											Available Margin
										</span>
										<span className="font-medium text-green-600">
											₹7,50,000
										</span>
									</div>
								</div>

								<Button
									className="w-full"
									size="lg"
									data-testid="button-place-order"
								>
									Place Order
								</Button>
							</CardContent>
						</Card>

						<Card>
							<CardHeader>
								<CardTitle>Popular Futures</CardTitle>
								<CardDescription>Most traded contracts</CardDescription>
							</CardHeader>
							<CardContent className="space-y-3">
								{popularContracts.map((contract) => (
									<div
										key={contract.symbol}
										className="p-3 border rounded-lg cursor-pointer hover:bg-accent transition-colors"
									>
										<div className="flex justify-between items-start mb-2">
											<h4 className="font-semibold">{contract.symbol}</h4>
											<Badge
												variant={
													contract.change >= 0 ? "default" : "destructive"
												}
											>
												{contract.change >= 0 ? "+" : ""}
												{contract.change}%
											</Badge>
										</div>
										<div className="flex justify-between text-sm">
											<span className="text-muted-foreground">
												LTP: ₹{contract.ltp.toLocaleString()}
											</span>
											<span className="text-muted-foreground">
												Vol: {contract.volume}
											</span>
										</div>
									</div>
								))}
							</CardContent>
						</Card>
					</div>
				</TabsContent>

				{/* Options Tab */}
				<TabsContent value="options" className="space-y-6">
					<div className="grid lg:grid-cols-3 gap-6">
						<Card className="lg:col-span-2">
							<CardHeader>
								<CardTitle>Place Options Order</CardTitle>
								<CardDescription>Trade Call and Put options</CardDescription>
							</CardHeader>
							<CardContent className="space-y-4">
								<div className="grid md:grid-cols-2 gap-4">
									<div className="space-y-2">
										<Label>Symbol</Label>
										<Select>
											<SelectTrigger data-testid="select-options-symbol">
												<SelectValue placeholder="Select symbol" />
											</SelectTrigger>
											<SelectContent>
												<SelectItem value="nifty">NIFTY 50</SelectItem>
												<SelectItem value="banknifty">BANKNIFTY</SelectItem>
												<SelectItem value="finnifty">FINNIFTY</SelectItem>
											</SelectContent>
										</Select>
									</div>

									<div className="space-y-2">
										<Label>Option Type</Label>
										<Select>
											<SelectTrigger data-testid="select-option-type">
												<SelectValue placeholder="Select type" />
											</SelectTrigger>
											<SelectContent>
												<SelectItem value="ce">Call (CE)</SelectItem>
												<SelectItem value="pe">Put (PE)</SelectItem>
											</SelectContent>
										</Select>
									</div>
								</div>

								<div className="grid md:grid-cols-2 gap-4">
									<div className="space-y-2">
										<Label>Strike Price</Label>
										<Select>
											<SelectTrigger data-testid="select-strike">
												<SelectValue placeholder="Select strike" />
											</SelectTrigger>
											<SelectContent>
												<SelectItem value="21500">21500</SelectItem>
												<SelectItem value="21550">21550</SelectItem>
												<SelectItem value="21600">21600</SelectItem>
												<SelectItem value="21650">21650</SelectItem>
												<SelectItem value="21700">21700</SelectItem>
											</SelectContent>
										</Select>
									</div>

									<div className="space-y-2">
										<Label>Expiry Date</Label>
										<Select>
											<SelectTrigger data-testid="select-options-expiry">
												<SelectValue placeholder="Select expiry" />
											</SelectTrigger>
											<SelectContent>
												<SelectItem value="2025-01-23">23 Jan 2025</SelectItem>
												<SelectItem value="2025-01-30">30 Jan 2025</SelectItem>
												<SelectItem value="2025-02-27">27 Feb 2025</SelectItem>
											</SelectContent>
										</Select>
									</div>
								</div>

								<div className="grid md:grid-cols-2 gap-4">
									<div className="space-y-2">
										<Label>Action</Label>
										<div className="flex flex-wrap gap-2">
											<Button
												variant={orderType === "buy" ? "default" : "outline"}
												className="flex-1 min-w-[100px]"
												onClick={() => setOrderType("buy")}
											>
												Buy
											</Button>
											<Button
												variant={orderType === "sell" ? "default" : "outline"}
												className="flex-1 min-w-[100px]"
												onClick={() => setOrderType("sell")}
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
											data-testid="input-options-quantity"
										/>
									</div>
								</div>

								<div className="space-y-2">
									<Label>Premium Price</Label>
									<Input
										type="number"
										placeholder="0.00"
										data-testid="input-premium"
									/>
								</div>

								<Button
									className="w-full"
									size="lg"
									data-testid="button-place-options-order"
								>
									Place Options Order
								</Button>
							</CardContent>
						</Card>

						<Card>
							<CardHeader>
								<CardTitle>Greeks</CardTitle>
								<CardDescription>Option Greeks analysis</CardDescription>
							</CardHeader>
							<CardContent className="space-y-4">
								<div className="space-y-3">
									<div className="flex justify-between">
										<span className="text-sm text-muted-foreground">
											Delta (Δ)
										</span>
										<span className="font-medium">0.65</span>
									</div>
									<div className="flex justify-between">
										<span className="text-sm text-muted-foreground">
											Gamma (Γ)
										</span>
										<span className="font-medium">0.012</span>
									</div>
									<div className="flex justify-between">
										<span className="text-sm text-muted-foreground">
											Theta (Θ)
										</span>
										<span className="font-medium text-red-600">-0.85</span>
									</div>
									<div className="flex justify-between">
										<span className="text-sm text-muted-foreground">
											Vega (ν)
										</span>
										<span className="font-medium">0.18</span>
									</div>
									<div className="flex justify-between">
										<span className="text-sm text-muted-foreground">IV</span>
										<span className="font-medium">18.5%</span>
									</div>
								</div>
							</CardContent>
						</Card>
					</div>
				</TabsContent>

				{/* Positions Tab */}
				<TabsContent value="positions" className="space-y-4">
					<Card>
						<CardHeader>
							<CardTitle>Open Positions</CardTitle>
							<CardDescription>
								Monitor your active derivative positions
							</CardDescription>
						</CardHeader>
						<CardContent>
							<div className="space-y-3">
								{positions.map((position) => (
									<div
										key={position.id}
										className="border rounded-lg p-4"
										data-testid={`position-${position.id}`}
									>
										<div className="flex items-start justify-between mb-3">
											<div>
												<h4 className="font-semibold text-lg">
													{position.symbol}
													{position.type !== "future" &&
														` ${position.strike} ${position.type.toUpperCase()}`}
												</h4>
												<p className="text-sm text-muted-foreground">
													<Clock className="h-3 w-3 inline mr-1" />
													Expiry:{" "}
													{new Date(position.expiry).toLocaleDateString()}
												</p>
											</div>
											<Badge
												variant={position.pnl >= 0 ? "default" : "destructive"}
											>
												{position.type}
											</Badge>
										</div>

										<div className="grid grid-cols-2 md:grid-cols-5 gap-4">
											<div>
												<p className="text-xs text-muted-foreground">
													Quantity
												</p>
												<p className="font-medium">{position.quantity}</p>
											</div>
											<div>
												<p className="text-xs text-muted-foreground">
													Buy Price
												</p>
												<p className="font-medium">
													₹{position.buyPrice.toLocaleString()}
												</p>
											</div>
											<div>
												<p className="text-xs text-muted-foreground">
													Current Price
												</p>
												<p className="font-medium">
													₹{position.currentPrice.toLocaleString()}
												</p>
											</div>
											<div>
												<p className="text-xs text-muted-foreground">P&L</p>
												<p
													className={`font-medium ${position.pnl >= 0 ? "text-green-600" : "text-red-600"}`}
												>
													{position.pnl >= 0 ? "+" : ""}₹
													{position.pnl.toLocaleString()}
												</p>
											</div>
											<div>
												<p className="text-xs text-muted-foreground">P&L %</p>
												<p
													className={`font-medium ${position.pnlPercentage >= 0 ? "text-green-600" : "text-red-600"}`}
												>
													{position.pnlPercentage >= 0 ? "+" : ""}
													{position.pnlPercentage}%
												</p>
											</div>
										</div>

										<div className="flex flex-wrap gap-2 mt-4">
											<Button
												variant="outline"
												size="sm"
												className="whitespace-nowrap"
												data-testid={`button-exit-${position.id}`}
											>
												Exit Position
											</Button>
											<Button
												variant="outline"
												size="sm"
												className="whitespace-nowrap"
												data-testid={`button-modify-${position.id}`}
											>
												Modify
											</Button>
										</div>
									</div>
								))}
							</div>
						</CardContent>
					</Card>
				</TabsContent>

				{/* Option Chain Tab */}
				<TabsContent value="chain" className="space-y-4">
					<Card>
						<CardHeader>
							<CardTitle>Option Chain Analysis</CardTitle>
							<CardDescription>
								Call and Put option chain for NIFTY
							</CardDescription>
						</CardHeader>
						<CardContent>
							<div className="overflow-x-auto">
								<table className="w-full text-sm">
									<thead>
										<tr className="border-b">
											<th className="text-left p-2 text-green-600">Calls</th>
											<th className="text-center p-2">OI</th>
											<th className="text-center p-2">Volume</th>
											<th className="text-center p-2 font-bold">Strike</th>
											<th className="text-center p-2">Volume</th>
											<th className="text-center p-2">OI</th>
											<th className="text-right p-2 text-red-600">Puts</th>
										</tr>
									</thead>
									<tbody>
										<tr className="border-b hover:bg-accent">
											<td className="p-2 text-green-600">₹250</td>
											<td className="text-center p-2">15,500</td>
											<td className="text-center p-2">8,200</td>
											<td className="text-center p-2 font-bold bg-muted">
												21500
											</td>
											<td className="text-center p-2">12,400</td>
											<td className="text-center p-2">22,800</td>
											<td className="p-2 text-right text-red-600">₹180</td>
										</tr>
										<tr className="border-b hover:bg-accent">
											<td className="p-2 text-green-600">₹200</td>
											<td className="text-center p-2">18,200</td>
											<td className="text-center p-2">9,500</td>
											<td className="text-center p-2 font-bold">21550</td>
											<td className="text-center p-2">10,200</td>
											<td className="text-center p-2">19,500</td>
											<td className="p-2 text-right text-red-600">₹210</td>
										</tr>
										<tr className="border-b hover:bg-accent bg-blue-50 dark:bg-blue-950/30">
											<td className="p-2 text-green-600 font-bold">₹165</td>
											<td className="text-center p-2">25,400</td>
											<td className="text-center p-2">15,800</td>
											<td className="text-center p-2 font-bold bg-blue-100 dark:bg-blue-900/30">
												21600 (ATM)
											</td>
											<td className="text-center p-2">16,500</td>
											<td className="text-center p-2">28,200</td>
											<td className="p-2 text-right text-red-600 font-bold">
												₹155
											</td>
										</tr>
										<tr className="border-b hover:bg-accent">
											<td className="p-2 text-green-600">₹125</td>
											<td className="text-center p-2">20,100</td>
											<td className="text-center p-2">11,200</td>
											<td className="text-center p-2 font-bold">21650</td>
											<td className="text-center p-2">14,800</td>
											<td className="text-center p-2">24,500</td>
											<td className="p-2 text-right text-red-600">₹195</td>
										</tr>
										<tr className="border-b hover:bg-accent">
											<td className="p-2 text-green-600">₹95</td>
											<td className="text-center p-2">16,800</td>
											<td className="text-center p-2">8,900</td>
											<td className="text-center p-2 font-bold">21700</td>
											<td className="text-center p-2">12,100</td>
											<td className="text-center p-2">21,200</td>
											<td className="p-2 text-right text-red-600">₹240</td>
										</tr>
									</tbody>
								</table>
							</div>
							<div className="mt-4 p-4 bg-muted rounded-lg">
								<div className="grid md:grid-cols-2 gap-4 text-sm">
									<div>
										<p className="text-muted-foreground">Total Call OI</p>
										<p className="font-medium text-green-600">96,000</p>
									</div>
									<div>
										<p className="text-muted-foreground">Total Put OI</p>
										<p className="font-medium text-red-600">1,16,200</p>
									</div>
									<div>
										<p className="text-muted-foreground">
											Put-Call Ratio (PCR)
										</p>
										<p className="font-medium">1.21</p>
									</div>
									<div>
										<p className="text-muted-foreground">Max Pain</p>
										<p className="font-medium">21550</p>
									</div>
								</div>
							</div>
						</CardContent>
					</Card>
				</TabsContent>
			</Tabs>
		</div>
	);
}
