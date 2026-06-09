import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardHeader } from "@/components/ui/card";

export function StockRowSkeleton() {
	return (
		<div className="flex justify-between items-center p-3 bg-muted rounded-lg">
			<div>
				<Skeleton className="h-4 w-20 mb-2" />
				<Skeleton className="h-3 w-32" />
			</div>
			<div className="text-right">
				<Skeleton className="h-4 w-16 mb-2" />
				<Skeleton className="h-3 w-20" />
			</div>
		</div>
	);
}

export function MarketMoversSkeleton({ rows = 5 }: { rows?: number }) {
	return (
		<Card data-testid="market-movers-skeleton">
			<CardHeader>
				<div className="flex justify-between items-center">
					<Skeleton className="h-6 w-32" />
					<div className="flex space-x-2">
						<Skeleton className="h-8 w-16 rounded-md" />
						<Skeleton className="h-8 w-16 rounded-md" />
					</div>
				</div>
			</CardHeader>
			<CardContent>
				<div className="space-y-4">
					{Array.from({ length: rows }).map((_, i) => (
						<StockRowSkeleton key={i} />
					))}
				</div>
				<Skeleton className="h-9 w-full mt-4" />
			</CardContent>
		</Card>
	);
}

export function PlatformStatsSkeleton({ columns = 4 }: { columns?: number }) {
	return (
		<div
			className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-8 border-t border-white/20"
			data-testid="platform-stats-skeleton"
		>
			{Array.from({ length: columns }).map((_, index) => (
				<div key={index} className="text-center">
					<div className="flex items-center justify-center mb-2">
						<Skeleton className="w-6 h-6 rounded-full" />
					</div>
					<Skeleton className="h-7 w-16 mx-auto mb-1" />
					<Skeleton className="h-4 w-20 mx-auto" />
				</div>
			))}
		</div>
	);
}

export function MarketNewsSkeleton({ items = 4 }: { items?: number }) {
	return (
		<Card data-testid="market-news-skeleton">
			<CardHeader>
				<Skeleton className="h-6 w-28" />
			</CardHeader>
			<CardContent>
				<div className="space-y-4">
					{Array.from({ length: items }).map((_, i) => (
						<div key={i} className="flex gap-3 p-3 bg-muted rounded-lg">
							<Skeleton className="w-16 h-16 rounded-md flex-shrink-0" />
							<div className="flex-1 space-y-2">
								<Skeleton className="h-4 w-full" />
								<Skeleton className="h-4 w-3/4" />
								<Skeleton className="h-3 w-24" />
							</div>
						</div>
					))}
				</div>
			</CardContent>
		</Card>
	);
}

export function MarketChartSkeleton() {
	return (
		<Card data-testid="market-chart-skeleton">
			<CardHeader>
				<div className="flex justify-between items-center">
					<Skeleton className="h-6 w-40" />
					<div className="flex space-x-2">
						{Array.from({ length: 4 }).map((_, i) => (
							<Skeleton key={i} className="h-7 w-12 rounded-md" />
						))}
					</div>
				</div>
			</CardHeader>
			<CardContent>
				<Skeleton className="h-[300px] w-full rounded-lg" />
			</CardContent>
		</Card>
	);
}
