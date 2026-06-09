import { useState } from "react";
import {
	Card,
	CardHeader,
	CardTitle,
	CardContent,
	CardDescription,
	CardFooter,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useMutation } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { DollarSign, TrendingUp, Search } from "lucide-react";
import { Badge } from "@/components/ui/badge";

export function USTradingCard() {
	const { toast } = useToast();
	const [symbol, setSymbol] = useState("AAPL");
	const [notional, setNotional] = useState("");

	const tradeMutation = useMutation({
		mutationFn: async (data: { symbol: string; notional: number }) => {
			return apiRequest("/api/alpaca/trade/notional", {
				method: "POST",
				body: JSON.stringify({ ...data, side: "buy" }),
			});
		},
		onSuccess: (res: any) => {
			toast({
				title: "Order Placed!",
				description: `Successfully placed notional order for $${notional} of ${symbol}.`,
			});
			setNotional("");
		},
		onError: (error: Error) => {
			toast({
				title: "Trade Failed",
				description: error.message,
				variant: "destructive",
			});
		},
	});

	const handleBuy = () => {
		const val = Number.parseFloat(notional);
		if (Number.isNaN(val) || val <= 0) {
			toast({ title: "Invalid Amount", variant: "destructive" });
			return;
		}
		tradeMutation.mutate({ symbol, notional: val });
	};

	return (
		<Card className="border-primary/20 shadow-lg">
			<CardHeader>
				<CardTitle className="flex items-center justify-between">
					<div className="flex items-center gap-2">
						<TrendingUp className="h-5 w-5 text-primary" />
						Fractional Investing
					</div>
					<Badge variant="outline" className="bg-primary/5 text-primary">
						Notional
					</Badge>
				</CardTitle>
				<CardDescription>
					Buy your favorite stocks in dollars, not shares.
				</CardDescription>
			</CardHeader>
			<CardContent className="space-y-4">
				<div className="space-y-2">
					<Label>Stock Symbol</Label>
					<div className="relative">
						<Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
						<Input
							value={symbol}
							onChange={(e) => setSymbol(e.target.value.toUpperCase())}
							className="pl-9 font-bold uppercase"
							placeholder="e.g. NVDA"
						/>
					</div>
				</div>

				<div className="space-y-2">
					<Label>How much would you like to invest?</Label>
					<div className="relative">
						<DollarSign className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
						<Input
							type="number"
							placeholder="Min $1.00"
							className="pl-9"
							value={notional}
							onChange={(e) => setNotional(e.target.value)}
						/>
					</div>
					<div className="flex gap-2">
						{[10, 50, 100, 500].map((val) => (
							<Button
								key={val}
								variant="outline"
								size="sm"
								className="flex-1 text-xs"
								onClick={() => setNotional(val.toString())}
							>
								${val}
							</Button>
						))}
					</div>
				</div>
			</CardContent>
			<CardFooter>
				<Button
					className="w-full h-12 text-lg font-bold"
					onClick={handleBuy}
					disabled={tradeMutation.isPending}
				>
					Invest in {symbol}
				</Button>
			</CardFooter>
		</Card>
	);
}
