import { LogIn, AlertTriangle } from "lucide-react";
import {
	AlertDialog,
	AlertDialogContent,
	AlertDialogDescription,
	AlertDialogFooter,
	AlertDialogHeader,
	AlertDialogTitle,
	AlertDialogAction,
} from "@/components/ui/alert-dialog";
import { useSession } from "@/contexts/session-context";

export function SessionExpiredDialog() {
	const { isSessionExpired, handleLogoutAndRedirect } = useSession();

	const handleSignIn = () => {
		handleLogoutAndRedirect();
	};

	return (
		<AlertDialog open={isSessionExpired}>
			<AlertDialogContent
				data-testid="dialog-session-expired"
				onEscapeKeyDown={(e) => e.preventDefault()}
			>
				<AlertDialogHeader>
					<div className="flex items-center gap-3 mb-2">
						<div className="p-2 rounded-full bg-amber-100 dark:bg-amber-900/30">
							<AlertTriangle className="h-6 w-6 text-amber-600 dark:text-amber-400" />
						</div>
						<AlertDialogTitle>Session Expired</AlertDialogTitle>
					</div>
					<AlertDialogDescription className="text-base">
						Your session has expired for security reasons. Please sign in again
						to continue using the application.
					</AlertDialogDescription>
				</AlertDialogHeader>
				<AlertDialogFooter>
					<AlertDialogAction
						onClick={handleSignIn}
						data-testid="button-sign-in-again"
						className="w-full sm:w-auto"
					>
						<LogIn className="h-4 w-4 mr-2" />
						Sign In Again
					</AlertDialogAction>
				</AlertDialogFooter>
			</AlertDialogContent>
		</AlertDialog>
	);
}
