import { useState, useEffect } from "react";
import { useVersionCheck } from "@/hooks/useVersionCheck";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { RefreshCw, Download, AlertTriangle } from "lucide-react";

export function VersionCheckModal() {
	const {
		isOutdated,
		currentVersion,
		serverVersion,
		forceUpdate,
		isChecking,
	} = useVersionCheck();

	const [isUpdating, setIsUpdating] = useState(false);
	const [countdown, setCountdown] = useState(10);

	// Auto-update countdown: when a new version is detected, count down 10s
	// then trigger the update automatically. The user can still click early.
	useEffect(() => {
		if (!isOutdated || isUpdating) return;
		if (countdown <= 0) {
			handleUpdate();
			return;
		}
		const t = setTimeout(() => setCountdown((c) => c - 1), 1000);
		return () => clearTimeout(t);
	}, [isOutdated, isUpdating, countdown]);

	if (!isOutdated && !isUpdating) {
		return null;
	}

	const handleUpdate = async () => {
		if (isUpdating) return;
		setIsUpdating(true);

		// Safety timeout to reset isUpdating if reload doesn't happen
		const safetyTimeout = setTimeout(() => {
			setIsUpdating(false);
		}, 5000);

		try {
			await forceUpdate();
		} catch (err) {
			console.error("Update failed:", err);
			setIsUpdating(false);
			clearTimeout(safetyTimeout);
		}
	};

	return (
		<Dialog
			open={isOutdated || isUpdating}
			onOpenChange={() => {/* non-dismissable */}}
		>
			<DialogContent className="sm:max-w-md" onInteractOutside={(e) => e.preventDefault()}>
				<DialogHeader>
					<div className="flex items-center gap-3 mb-2">
						<div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-100 dark:bg-blue-900">
							<Download className="h-5 w-5 text-blue-600 dark:text-blue-400" />
						</div>
						<DialogTitle className="text-xl">Update Available</DialogTitle>
					</div>
					<DialogDescription className="text-left space-y-3">
						<p>
							A new version of FintekPro is available. The page will refresh
							automatically in <strong>{countdown}s</strong>.
						</p>
						<div className="bg-muted/50 rounded-lg p-3 text-sm space-y-1">
							<div className="flex justify-between">
								<span className="text-muted-foreground">Your version:</span>
								<span className="font-mono text-orange-600 dark:text-orange-400">
									{currentVersion}
								</span>
							</div>
							<div className="flex justify-between">
								<span className="text-muted-foreground">Latest version:</span>
								<span className="font-mono text-green-600 dark:text-green-400">
									{serverVersion}
								</span>
							</div>
						</div>
						<div className="flex items-start gap-2 p-3 bg-amber-50 dark:bg-amber-950/30 rounded-lg text-amber-800 dark:text-amber-200 text-sm">
							<AlertTriangle className="h-4 w-4 mt-0.5 flex-shrink-0" />
							<span>
								Please update to ensure you have the latest security patches and
								features.
							</span>
						</div>
					</DialogDescription>
				</DialogHeader>
				<DialogFooter className="flex-col sm:flex-row gap-2 sm:gap-0">
					<Button
						onClick={handleUpdate}
						disabled={isChecking || isUpdating}
						className="w-full bg-blue-600 hover:bg-blue-700"
					>
						<RefreshCw
							className={`h-4 w-4 mr-2 ${isChecking || isUpdating ? "animate-spin" : ""}`}
						/>
						{isUpdating ? "Updating..." : `Update Now (${countdown}s)`}
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
