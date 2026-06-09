import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardHeader } from "@/components/ui/card";

export function PortfolioSkeleton() {
	return (
		<div className="space-y-6">
			<div className="bg-gradient-to-r from-primary/10 to-primary/5 rounded-xl p-6 space-y-4">
				<Skeleton className="h-8 w-64" />
				<div className="grid grid-cols-2 md:grid-cols-4 gap-4">
					{Array.from({ length: 4 }).map((_, i) => (
						<div key={i} className="space-y-2">
							<Skeleton className="h-4 w-20" />
							<Skeleton className="h-8 w-32" />
						</div>
					))}
				</div>
			</div>

			<div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
				<Card className="lg:col-span-2">
					<CardHeader>
						<Skeleton className="h-6 w-40" />
					</CardHeader>
					<CardContent>
						<Skeleton className="h-[300px] w-full rounded-lg" />
					</CardContent>
				</Card>
				<Card>
					<CardHeader>
						<Skeleton className="h-6 w-32" />
					</CardHeader>
					<CardContent>
						<Skeleton className="h-[250px] w-full rounded-full" />
					</CardContent>
				</Card>
			</div>

			<Card>
				<CardHeader>
					<Skeleton className="h-6 w-48" />
				</CardHeader>
				<CardContent>
					<div className="space-y-3">
						{Array.from({ length: 5 }).map((_, i) => (
							<div
								key={i}
								className="flex items-center justify-between py-3 border-b border-border last:border-0"
							>
								<div className="flex items-center gap-3">
									<Skeleton className="h-10 w-10 rounded-full" />
									<div className="space-y-1">
										<Skeleton className="h-4 w-32" />
										<Skeleton className="h-3 w-24" />
									</div>
								</div>
								<div className="text-right space-y-1">
									<Skeleton className="h-4 w-20" />
									<Skeleton className="h-3 w-16" />
								</div>
							</div>
						))}
					</div>
				</CardContent>
			</Card>
		</div>
	);
}

export function HoldingsTableSkeleton({ rows = 10 }: { rows?: number }) {
	return (
		<div className="space-y-4">
			<div className="flex gap-4 pb-3 border-b border-border">
				<Skeleton className="h-4 w-32" />
				<Skeleton className="h-4 w-20" />
				<Skeleton className="h-4 w-24" />
				<Skeleton className="h-4 w-24" />
				<Skeleton className="h-4 w-20" />
				<Skeleton className="h-4 w-28" />
			</div>
			{Array.from({ length: rows }).map((_, i) => (
				<div
					key={i}
					className="flex items-center gap-4 py-2 border-b border-border/50 last:border-0"
				>
					<div className="flex items-center gap-2 w-32">
						<Skeleton className="h-8 w-8 rounded" />
						<Skeleton className="h-4 w-20" />
					</div>
					<Skeleton className="h-4 w-16" />
					<Skeleton className="h-4 w-20" />
					<Skeleton className="h-4 w-20" />
					<Skeleton className="h-4 w-16" />
					<Skeleton className="h-4 w-24" />
				</div>
			))}
		</div>
	);
}
