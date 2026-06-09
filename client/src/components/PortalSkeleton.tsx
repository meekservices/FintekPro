import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardHeader } from "@/components/ui/card";

interface PortalSkeletonProps {
	variant?: "admin" | "agent" | "dashboard" | "default";
}

export function PortalSkeleton({ variant = "default" }: PortalSkeletonProps) {
	return (
		<div className="min-h-screen bg-background p-6 space-y-6">
			<div className="flex items-center justify-between">
				<div className="space-y-2">
					<Skeleton className="h-8 w-48" />
					<Skeleton className="h-4 w-64" />
				</div>
				<Skeleton className="h-10 w-32" />
			</div>

			<div className="flex gap-2">
				{[1, 2, 3, 4, 5].map((i) => (
					<Skeleton key={i} className="h-10 w-24" />
				))}
			</div>

			<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
				{[1, 2, 3, 4].map((i) => (
					<Card key={i}>
						<CardHeader className="pb-2">
							<Skeleton className="h-4 w-24" />
						</CardHeader>
						<CardContent>
							<Skeleton className="h-8 w-16 mb-2" />
							<Skeleton className="h-3 w-20" />
						</CardContent>
					</Card>
				))}
			</div>

			{variant === "admin" && <AdminSkeleton />}
			{variant === "agent" && <AgentSkeleton />}
			{variant === "dashboard" && <DashboardSkeleton />}
			{variant === "default" && <DefaultSkeleton />}
		</div>
	);
}

function AdminSkeleton() {
	return (
		<div className="space-y-6">
			<Card>
				<CardHeader>
					<Skeleton className="h-6 w-32" />
					<Skeleton className="h-4 w-48" />
				</CardHeader>
				<CardContent>
					<div className="space-y-4">
						{[1, 2, 3, 4, 5].map((i) => (
							<div
								key={i}
								className="flex items-center justify-between p-4 border rounded-lg"
							>
								<div className="flex items-center gap-4">
									<Skeleton className="h-10 w-10 rounded-full" />
									<div className="space-y-2">
										<Skeleton className="h-4 w-32" />
										<Skeleton className="h-3 w-24" />
									</div>
								</div>
								<div className="flex gap-2">
									<Skeleton className="h-6 w-16" />
									<Skeleton className="h-8 w-8" />
								</div>
							</div>
						))}
					</div>
				</CardContent>
			</Card>
		</div>
	);
}

function AgentSkeleton() {
	return (
		<div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
			<div className="lg:col-span-2 space-y-6">
				<Card>
					<CardHeader>
						<Skeleton className="h-6 w-40" />
					</CardHeader>
					<CardContent>
						<div className="space-y-3">
							{[1, 2, 3].map((i) => (
								<div
									key={i}
									className="flex items-center gap-4 p-3 border rounded"
								>
									<Skeleton className="h-12 w-12 rounded" />
									<div className="flex-1 space-y-2">
										<Skeleton className="h-4 w-3/4" />
										<Skeleton className="h-3 w-1/2" />
									</div>
									<Skeleton className="h-8 w-20" />
								</div>
							))}
						</div>
					</CardContent>
				</Card>
			</div>

			<div className="space-y-6">
				<Card>
					<CardHeader>
						<Skeleton className="h-5 w-24" />
					</CardHeader>
					<CardContent className="space-y-3">
						{[1, 2, 3, 4].map((i) => (
							<div key={i} className="flex justify-between items-center">
								<Skeleton className="h-4 w-20" />
								<Skeleton className="h-4 w-12" />
							</div>
						))}
					</CardContent>
				</Card>
			</div>
		</div>
	);
}

function DashboardSkeleton() {
	return (
		<div className="space-y-6">
			<div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
				<Card>
					<CardHeader>
						<Skeleton className="h-6 w-32" />
					</CardHeader>
					<CardContent>
						<Skeleton className="h-48 w-full" />
					</CardContent>
				</Card>
				<Card>
					<CardHeader>
						<Skeleton className="h-6 w-28" />
					</CardHeader>
					<CardContent>
						<Skeleton className="h-48 w-full" />
					</CardContent>
				</Card>
			</div>

			<Card>
				<CardHeader>
					<Skeleton className="h-6 w-36" />
				</CardHeader>
				<CardContent>
					<div className="space-y-3">
						{[1, 2, 3, 4, 5].map((i) => (
							<div key={i} className="flex items-center gap-4">
								<Skeleton className="h-10 w-10 rounded" />
								<div className="flex-1 space-y-2">
									<Skeleton className="h-4 w-2/3" />
									<Skeleton className="h-3 w-1/3" />
								</div>
								<Skeleton className="h-6 w-16" />
							</div>
						))}
					</div>
				</CardContent>
			</Card>
		</div>
	);
}

function DefaultSkeleton() {
	return (
		<div className="space-y-6">
			<Card>
				<CardHeader>
					<Skeleton className="h-6 w-40" />
					<Skeleton className="h-4 w-60" />
				</CardHeader>
				<CardContent>
					<div className="space-y-4">
						{[1, 2, 3, 4, 5, 6].map((i) => (
							<div
								key={i}
								className="flex items-center gap-4 p-4 border rounded-lg"
							>
								<Skeleton className="h-12 w-12 rounded" />
								<div className="flex-1 space-y-2">
									<Skeleton className="h-4 w-1/2" />
									<Skeleton className="h-3 w-1/3" />
								</div>
								<Skeleton className="h-8 w-24" />
							</div>
						))}
					</div>
				</CardContent>
			</Card>
		</div>
	);
}

export function TableSkeleton({
	rows = 5,
	columns = 4,
}: { rows?: number; columns?: number }) {
	return (
		<div className="space-y-3">
			<div className="flex gap-4 p-3 border-b">
				{Array.from({ length: columns }).map((_, i) => (
					<Skeleton key={i} className="h-4 flex-1" />
				))}
			</div>
			{Array.from({ length: rows }).map((_, i) => (
				<div key={i} className="flex gap-4 p-3">
					{Array.from({ length: columns }).map((_, j) => (
						<Skeleton key={j} className="h-4 flex-1" />
					))}
				</div>
			))}
		</div>
	);
}

export function CardsSkeleton({ count = 4 }: { count?: number }) {
	return (
		<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
			{Array.from({ length: count }).map((_, i) => (
				<Card key={i}>
					<CardHeader className="pb-2">
						<Skeleton className="h-4 w-24" />
					</CardHeader>
					<CardContent>
						<Skeleton className="h-8 w-20 mb-2" />
						<Skeleton className="h-3 w-16" />
					</CardContent>
				</Card>
			))}
		</div>
	);
}

export function FormSkeleton({ fields = 4 }: { fields?: number }) {
	return (
		<div className="space-y-6">
			{Array.from({ length: fields }).map((_, i) => (
				<div key={i} className="space-y-2">
					<Skeleton className="h-4 w-24" />
					<Skeleton className="h-10 w-full" />
				</div>
			))}
			<Skeleton className="h-10 w-32" />
		</div>
	);
}
