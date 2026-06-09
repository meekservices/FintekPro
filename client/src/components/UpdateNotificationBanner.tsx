import { useState, useEffect } from "react";
import { Download, X, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface UpdateNotificationBannerProps {
	className?: string;
}

export function UpdateNotificationBanner({
	className,
}: UpdateNotificationBannerProps) {
	const [updateAvailable, setUpdateAvailable] = useState(false);
	const [isRefreshing, setIsRefreshing] = useState(false);
	const [dismissed, setDismissed] = useState(false);

	useEffect(() => {
		const handleUpdateAvailable = () => {
			console.log("[UpdateBanner] Update available event received");
			setUpdateAvailable(true);
			setDismissed(false);
		};

		window.addEventListener("appUpdateAvailable", handleUpdateAvailable);

		return () => {
			window.removeEventListener("appUpdateAvailable", handleUpdateAvailable);
		};
	}, []);

	const handleRefresh = () => {
		setIsRefreshing(true);

		const registration = (window as any).__swRegistration as
			| ServiceWorkerRegistration
			| undefined;

		if (registration?.waiting) {
			registration.waiting.postMessage("skipWaiting");
		} else {
			window.location.reload();
		}
	};

	const handleDismiss = () => {
		setDismissed(true);
	};

	if (!updateAvailable || dismissed) {
		return null;
	}

	return (
		<div
			className={cn(
				"fixed top-0 left-0 right-0 z-[100] px-4 py-2 flex items-center justify-between gap-4",
				"bg-blue-600 dark:bg-blue-700 text-white",
				className,
			)}
			role="alert"
			aria-live="polite"
			data-testid="update-notification-banner"
		>
			<div className="flex items-center gap-3 flex-1">
				<Download className="h-5 w-5 flex-shrink-0" />
				<div className="flex flex-col sm:flex-row sm:items-center sm:gap-2">
					<span
						className="font-semibold text-sm"
						data-testid="update-notification-title"
					>
						New version available
					</span>
					<span className="text-sm opacity-90 hidden sm:inline">
						Refresh to get the latest features and improvements.
					</span>
				</div>
			</div>

			<div className="flex items-center gap-2">
				<Button
					variant="ghost"
					size="sm"
					className="h-8 px-3 text-foreground hover:bg-card/20 font-medium"
					onClick={handleRefresh}
					disabled={isRefreshing}
					data-testid="button-refresh-app"
				>
					<RefreshCw
						className={cn("h-4 w-4 mr-1", isRefreshing && "animate-spin")}
					/>
					{isRefreshing ? "Updating..." : "Refresh Now"}
				</Button>

				<Button
					variant="ghost"
					size="sm"
					className="h-8 w-8 p-0 text-foreground hover:bg-card/20"
					onClick={handleDismiss}
					data-testid="button-dismiss-update"
				>
					<X className="h-4 w-4" />
				</Button>
			</div>
		</div>
	);
}
