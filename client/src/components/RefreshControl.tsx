import { useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";
import { StaleDataIndicator } from "./StaleDataIndicator";

interface RefreshControlProps {
	onRefresh: () => Promise<void> | void;
	lastUpdated?: Date | string | null;
	isRefreshing?: boolean;
	showStaleIndicator?: boolean;
	variant?: "button" | "icon" | "compact";
	size?: "sm" | "default" | "lg";
	className?: string;
	disabled?: boolean;
}

export function RefreshControl({
	onRefresh,
	lastUpdated,
	isRefreshing: externalIsRefreshing,
	showStaleIndicator = true,
	variant = "button",
	size = "sm",
	className,
	disabled = false,
}: RefreshControlProps) {
	const [internalRefreshing, setInternalRefreshing] = useState(false);
	const isRefreshing = externalIsRefreshing ?? internalRefreshing;

	const handleRefresh = useCallback(async () => {
		if (isRefreshing || disabled) return;

		setInternalRefreshing(true);
		try {
			await onRefresh();
		} finally {
			setInternalRefreshing(false);
		}
	}, [onRefresh, isRefreshing, disabled]);

	if (variant === "icon") {
		return (
			<div className={cn("flex items-center gap-2", className)}>
				{showStaleIndicator && lastUpdated && (
					<StaleDataIndicator lastUpdated={lastUpdated} showLabel />
				)}
				<Button
					variant="ghost"
					size="icon"
					onClick={handleRefresh}
					disabled={isRefreshing || disabled}
					className="h-8 w-8"
					data-testid="button-refresh-icon"
				>
					<RefreshCw
						className={cn("h-4 w-4", isRefreshing && "animate-spin")}
					/>
				</Button>
			</div>
		);
	}

	if (variant === "compact") {
		return (
			<button
				onClick={handleRefresh}
				disabled={isRefreshing || disabled}
				className={cn(
					"flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors",
					isRefreshing && "opacity-50",
					className,
				)}
				data-testid="button-refresh-compact"
			>
				<RefreshCw className={cn("h-3 w-3", isRefreshing && "animate-spin")} />
				<span>{isRefreshing ? "Updating..." : "Refresh"}</span>
				{showStaleIndicator && lastUpdated && (
					<>
						<span className="mx-1">•</span>
						<StaleDataIndicator lastUpdated={lastUpdated} />
					</>
				)}
			</button>
		);
	}

	return (
		<div className={cn("flex items-center gap-3", className)}>
			{showStaleIndicator && lastUpdated && (
				<StaleDataIndicator lastUpdated={lastUpdated} showLabel />
			)}
			<Button
				variant="outline"
				size={size}
				onClick={handleRefresh}
				disabled={isRefreshing || disabled}
				data-testid="button-refresh"
			>
				<RefreshCw
					className={cn("h-4 w-4 mr-2", isRefreshing && "animate-spin")}
				/>
				{isRefreshing ? "Refreshing..." : "Refresh"}
			</Button>
		</div>
	);
}

export function useRefreshControl(
	refetchFn: () => Promise<unknown> | unknown,
	options?: {
		onSuccess?: () => void;
		onError?: (error: Error) => void;
	},
) {
	const [isRefreshing, setIsRefreshing] = useState(false);
	const [lastRefreshed, setLastRefreshed] = useState<Date | null>(null);

	const refresh = useCallback(async () => {
		setIsRefreshing(true);
		try {
			await refetchFn();
			setLastRefreshed(new Date());
			options?.onSuccess?.();
		} catch (error) {
			options?.onError?.(error as Error);
		} finally {
			setIsRefreshing(false);
		}
	}, [refetchFn, options]);

	return {
		refresh,
		isRefreshing,
		lastRefreshed,
	};
}
