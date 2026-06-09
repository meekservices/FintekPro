import { useMarketIndices } from "@/hooks/use-market-data";
import { GLOBAL_INDICES } from "@/lib/constants";
import { Skeleton } from "@/components/ui/skeleton";

export function MarketTicker() {
	const { data: indices, isLoading, error } = useMarketIndices();

	if (isLoading) {
		return (
			<div className="bg-finance-gray text-white py-3 overflow-hidden">
				<div className="flex space-x-8 whitespace-nowrap">
					{Array.from({ length: 4 }).map((_, i) => (
						<div key={i} className="flex items-center space-x-2">
							<Skeleton className="h-4 w-16 bg-muted" />
							<Skeleton className="h-4 w-20 bg-muted" />
							<Skeleton className="h-4 w-12 bg-muted" />
						</div>
					))}
				</div>
			</div>
		);
	}

	if (error) {
		return (
			<div className="bg-finance-gray text-white py-3">
				<div className="text-center text-red-400" data-testid="ticker-error">
					Error loading market data
				</div>
			</div>
		);
	}

	const getIndexName = (symbol: string) => {
		const index = GLOBAL_INDICES.find((idx) => idx.symbol === symbol);
		return index?.name || symbol;
	};

	return (
		<div
			className="bg-finance-gray text-white py-3 overflow-hidden"
			data-testid="market-ticker"
		>
			<div className="flex animate-scroll space-x-8 whitespace-nowrap">
				{indices?.map((index) => (
					<div
						key={index.symbol}
						className="flex items-center space-x-2"
						data-testid={`ticker-${index.symbol}`}
					>
						<span
							className="font-medium"
							data-testid={`ticker-name-${index.symbol}`}
						>
							{getIndexName(index.symbol)}
						</span>
						<span
							className={`${index.change >= 0 ? "text-finance-green" : "text-finance-red"}`}
							data-testid={`ticker-price-${index.symbol}`}
						>
							{index.price?.toLocaleString(undefined, {
								minimumFractionDigits: 2,
								maximumFractionDigits: 2,
							})}
						</span>
						<span
							className={`text-sm ${index.changePercent >= 0 ? "text-finance-green" : "text-finance-red"}`}
							data-testid={`ticker-change-${index.symbol}`}
						>
							{index.changePercent >= 0 ? "+" : ""}
							{index.changePercent?.toFixed(2)}%
						</span>
					</div>
				))}
			</div>
		</div>
	);
}
