import { useState } from "react";
import {
	AlertDialog,
	AlertDialogAction,
	AlertDialogCancel,
	AlertDialogContent,
	AlertDialogDescription,
	AlertDialogFooter,
	AlertDialogHeader,
	AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertTriangle, Database, Clock } from "lucide-react";

interface RevokeConsentDialogProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	dataSource: string;
	sourceLabel: string;
	onConfirm: (reason: string) => void;
	isPending?: boolean;
}

export function RevokeConsentDialog({
	open,
	onOpenChange,
	dataSource,
	sourceLabel,
	onConfirm,
	isPending = false,
}: RevokeConsentDialogProps) {
	const [reason, setReason] = useState("");

	const handleConfirm = () => {
		if (reason.trim()) {
			onConfirm(reason);
			setReason("");
		}
	};

	const handleClose = () => {
		setReason("");
		onOpenChange(false);
	};

	return (
		<AlertDialog open={open} onOpenChange={handleClose}>
			<AlertDialogContent data-testid="dialog-revoke-consent">
				<AlertDialogHeader>
					<AlertDialogTitle className="flex items-center gap-2 text-destructive">
						<AlertTriangle className="h-5 w-5" />
						Revoke {sourceLabel} Consent
					</AlertDialogTitle>
					<AlertDialogDescription asChild>
						<div className="space-y-4">
							<p>
								You are about to revoke access to your {sourceLabel}. This
								action cannot be undone automatically.
							</p>

							<Alert variant="destructive">
								<AlertTriangle className="h-4 w-4" />
								<AlertDescription>
									After revocation, FintekPro will no longer be able to fetch
									updated data from this source.
								</AlertDescription>
							</Alert>

							<div className="space-y-3 text-sm">
								<div className="flex items-start gap-2">
									<Database className="h-4 w-4 mt-0.5 text-muted-foreground" />
									<span>
										<strong>Data Retention:</strong> Previously fetched data
										will be retained as per regulatory requirements (typically
										5-7 years for financial records).
									</span>
								</div>
								<div className="flex items-start gap-2">
									<Clock className="h-4 w-4 mt-0.5 text-muted-foreground" />
									<span>
										<strong>Re-granting:</strong> You can grant consent again at
										any time through the Auto-Population Dashboard.
									</span>
								</div>
							</div>

							<div className="space-y-2">
								<Label htmlFor="revoke-reason">
									Reason for revoking (required)
								</Label>
								<Textarea
									id="revoke-reason"
									placeholder="e.g., No longer want to track this account, Switching to a different platform..."
									value={reason}
									onChange={(e) => setReason(e.target.value)}
									className="min-h-[80px]"
									data-testid="textarea-revoke-reason"
								/>
							</div>
						</div>
					</AlertDialogDescription>
				</AlertDialogHeader>
				<AlertDialogFooter>
					<AlertDialogCancel data-testid="button-cancel-revoke">
						Keep Consent
					</AlertDialogCancel>
					<AlertDialogAction
						onClick={handleConfirm}
						disabled={!reason.trim() || isPending}
						className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
						data-testid="button-confirm-revoke"
					>
						{isPending ? "Revoking..." : "Revoke Consent"}
					</AlertDialogAction>
				</AlertDialogFooter>
			</AlertDialogContent>
		</AlertDialog>
	);
}
