import { Button } from "@/components/ui/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import { AlertOctagon, RefreshCw, Home, Phone } from "lucide-react";

interface FatalErrorScreenProps {
	errorId?: string;
	title?: string;
	description?: string;
	showRefresh?: boolean;
	showHome?: boolean;
	showContact?: boolean;
	contactInfo?: string;
}

export function FatalErrorScreen({
	errorId,
	title = "Something went wrong",
	description = "We encountered an unexpected error. Our team has been notified and is working on a fix.",
	showRefresh = true,
	showHome = true,
	showContact = true,
	contactInfo = "support@fintekpro.com",
}: FatalErrorScreenProps) {
	const handleRefresh = () => {
		window.location.reload();
	};

	const handleGoHome = () => {
		window.location.href = "/";
	};

	return (
		<div className="min-h-screen bg-background flex items-center justify-center p-4">
			<Card className="w-full max-w-lg text-center">
				<CardHeader className="pb-4">
					<div className="mx-auto w-20 h-20 bg-red-100 dark:bg-red-900/20 rounded-full flex items-center justify-center mb-4">
						<AlertOctagon className="h-10 w-10 text-red-600 dark:text-red-400" />
					</div>
					<CardTitle className="text-2xl">{title}</CardTitle>
					<CardDescription className="text-base">{description}</CardDescription>
				</CardHeader>
				<CardContent className="space-y-4">
					{errorId && (
						<div className="bg-muted p-4 rounded-lg">
							<p className="text-xs text-muted-foreground mb-1">
								Error Reference
							</p>
							<code
								className="text-sm font-mono break-all"
								data-testid="text-error-id"
							>
								{errorId}
							</code>
							<p className="text-xs text-muted-foreground mt-2">
								Please include this code when contacting support
							</p>
						</div>
					)}

					<div className="flex flex-col sm:flex-row gap-3 justify-center">
						{showRefresh && (
							<Button onClick={handleRefresh} data-testid="button-refresh">
								<RefreshCw className="h-4 w-4 mr-2" />
								Refresh Page
							</Button>
						)}
						{showHome && (
							<Button
								variant="outline"
								onClick={handleGoHome}
								data-testid="button-home"
							>
								<Home className="h-4 w-4 mr-2" />
								Go to Home
							</Button>
						)}
					</div>

					{showContact && (
						<div className="pt-4 border-t">
							<p className="text-sm text-muted-foreground mb-2">
								Need help? Contact our support team
							</p>
							<Button variant="ghost" size="sm" asChild>
								<a href={`mailto:${contactInfo}`} data-testid="link-contact">
									<Phone className="h-4 w-4 mr-2" />
									{contactInfo}
								</a>
							</Button>
						</div>
					)}
				</CardContent>
			</Card>
		</div>
	);
}
