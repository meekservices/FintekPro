import { Component, ReactNode, ErrorInfo, ComponentType } from "react";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
	AlertCircle,
	RefreshCw,
	Home,
	Copy,
	Check,
	MessageSquare,
	Send,
} from "lucide-react";
import { ApiError } from "@/lib/queryClient";
import { trackException } from "@/lib/error-tracking";
import { Textarea } from "@/components/ui/textarea";

interface Props {
	children: ReactNode;
	fallback?: ReactNode;
	module?: string;
}

interface State {
	hasError: boolean;
	error?: Error;
	errorInfo?: ErrorInfo;
	errorId?: string | null;
	copied: boolean;
	showFeedback: boolean;
	feedbackText: string;
	feedbackSubmitting: boolean;
	feedbackSubmitted: boolean;
}

export class ErrorBoundary extends Component<Props, State> {
	constructor(props: Props) {
		super(props);
		this.state = {
			hasError: false,
			copied: false,
			showFeedback: false,
			feedbackText: "",
			feedbackSubmitting: false,
			feedbackSubmitted: false,
		};
	}

	static getDerivedStateFromError(error: Error): Partial<State> {
		return { hasError: true, error };
	}

	componentDidCatch(error: Error, errorInfo: ErrorInfo) {
		if (import.meta.env.DEV) {
			console.error("Error Boundary caught an error:", error, errorInfo);
		}

		this.setState({ error, errorInfo });

		trackException(error, {
			module: this.props.module || "system",
			metadata: {
				componentStack: errorInfo.componentStack,
			},
		}).then((errorId) => {
			this.setState({ errorId });
		});
	}

	handleReload = () => {
		window.location.reload();
	};

	handleReset = () => {
		this.setState({ hasError: false, error: undefined, errorInfo: undefined });
	};

	handleGoHome = () => {
		window.location.href = "/";
	};

	handleSubmitFeedback = async () => {
		if (!this.state.feedbackText.trim()) return;

		this.setState({ feedbackSubmitting: true });

		try {
			const response = await fetch("/api/errors/feedback", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					errorId: this.state.errorId,
					feedbackText: this.state.feedbackText,
					url: window.location.href,
					userAgent: navigator.userAgent,
				}),
			});

			if (response.ok) {
				this.setState({ feedbackSubmitted: true, feedbackSubmitting: false });
			} else {
				this.setState({ feedbackSubmitting: false });
			}
		} catch (err) {
			this.setState({ feedbackSubmitting: false });
		}
	};

	getUserFriendlyMessage(): string {
		if (!this.state.error) return "An unexpected error occurred";

		if (this.state.error instanceof ApiError) {
			return this.state.error.getUserFriendlyMessage();
		}

		return this.state.error.message || "An unexpected error occurred";
	}

	render() {
		if (this.state.hasError) {
			if (this.props.fallback) {
				return this.props.fallback;
			}

			return (
				<div
					className="min-h-screen flex items-center justify-center p-4"
					data-testid="error-boundary-container"
				>
					<Card className="w-full max-w-md">
						<CardHeader className="text-center">
							<div className="mx-auto mb-4 p-3 bg-red-100 dark:bg-red-900/20 rounded-full w-fit">
								<AlertCircle className="h-6 w-6 text-red-600 dark:text-red-400" />
							</div>
							<CardTitle className="text-xl">Something went wrong</CardTitle>
							<CardDescription>
								We encountered an unexpected error. You can try refreshing the
								page or go back to the previous page.
							</CardDescription>
						</CardHeader>
						<CardContent className="space-y-4">
							<Alert variant="destructive" data-testid="error-message">
								<AlertCircle className="h-4 w-4" />
								<AlertDescription>
									{this.getUserFriendlyMessage()}
								</AlertDescription>
							</Alert>

							{(this.state.errorId ||
								(this.state.error instanceof ApiError &&
									this.state.error.traceId)) && (
								<div className="flex items-center justify-center gap-2">
									<p className="text-xs text-muted-foreground">
										Error ID:{" "}
										{this.state.errorId ||
											(this.state.error instanceof ApiError &&
												this.state.error.traceId)}
									</p>
									<Button
										variant="ghost"
										size="sm"
										className="h-6 w-6 p-0"
										onClick={() => {
											const id =
												this.state.errorId ||
												(this.state.error instanceof ApiError &&
													this.state.error.traceId);
											if (id) {
												navigator.clipboard.writeText(id);
												this.setState({ copied: true });
												setTimeout(
													() => this.setState({ copied: false }),
													2000,
												);
											}
										}}
										data-testid="button-copy-error-id"
									>
										{this.state.copied ? (
											<Check className="h-3 w-3" />
										) : (
											<Copy className="h-3 w-3" />
										)}
									</Button>
								</div>
							)}

							{import.meta.env.DEV && this.state.error && (
								<details className="text-sm">
									<summary className="cursor-pointer font-medium mb-2 text-muted-foreground">
										Technical Details (Development Only)
									</summary>
									<div className="p-3 bg-muted rounded-md space-y-2">
										<p className="text-sm font-mono text-red-600 dark:text-red-400">
											{this.state.error.message}
										</p>
										{this.state.error instanceof ApiError && (
											<div className="text-xs space-y-1">
												{this.state.error.code && (
													<p>
														<strong>Code:</strong> {this.state.error.code}
													</p>
												)}
												{this.state.error.status && (
													<p>
														<strong>Status:</strong> {this.state.error.status}
													</p>
												)}
												{this.state.error.details && (
													<details>
														<summary className="cursor-pointer">
															Error Details
														</summary>
														<pre className="mt-1 overflow-auto max-h-32">
															{JSON.stringify(
																this.state.error.details,
																null,
																2,
															)}
														</pre>
													</details>
												)}
											</div>
										)}
										{this.state.errorInfo && (
											<details className="cursor-pointer">
												<summary className="text-xs text-muted-foreground">
													Component Stack
												</summary>
												<pre className="mt-1 text-xs overflow-auto max-h-32">
													{this.state.errorInfo.componentStack}
												</pre>
											</details>
										)}
									</div>
								</details>
							)}

							<div className="flex gap-2 flex-wrap">
								<Button
									onClick={this.handleReset}
									variant="outline"
									className="flex-1"
									data-testid="button-try-again"
								>
									<RefreshCw className="h-4 w-4 mr-2" />
									Try Again
								</Button>
								<Button
									onClick={this.handleReload}
									variant="default"
									className="flex-1"
									data-testid="button-refresh"
								>
									<RefreshCw className="h-4 w-4 mr-2" />
									Reload Page
								</Button>
								<Button
									onClick={this.handleGoHome}
									variant="outline"
									className="flex-1"
									data-testid="button-home"
								>
									<Home className="h-4 w-4 mr-2" />
									Home
								</Button>
							</div>

							{!this.state.showFeedback && !this.state.feedbackSubmitted && (
								<Button
									variant="ghost"
									size="sm"
									className="w-full text-muted-foreground"
									onClick={() => this.setState({ showFeedback: true })}
									data-testid="button-report-issue"
								>
									<MessageSquare className="h-4 w-4 mr-2" />
									Report this issue
								</Button>
							)}

							{this.state.showFeedback && !this.state.feedbackSubmitted && (
								<div className="space-y-2">
									<Textarea
										placeholder="What were you trying to do when this error occurred?"
										value={this.state.feedbackText}
										onChange={(e) =>
											this.setState({ feedbackText: e.target.value })
										}
										rows={3}
										className="text-sm"
										data-testid="input-feedback"
									/>
									<div className="flex gap-2">
										<Button
											variant="outline"
											size="sm"
											className="flex-1"
											onClick={() =>
												this.setState({ showFeedback: false, feedbackText: "" })
											}
										>
											Cancel
										</Button>
										<Button
											size="sm"
											className="flex-1"
											onClick={this.handleSubmitFeedback}
											disabled={
												this.state.feedbackSubmitting ||
												!this.state.feedbackText.trim()
											}
											data-testid="button-submit-feedback"
										>
											{this.state.feedbackSubmitting ? (
												"Sending..."
											) : (
												<>
													<Send className="h-4 w-4 mr-2" />
													Send Feedback
												</>
											)}
										</Button>
									</div>
								</div>
							)}

							{this.state.feedbackSubmitted && (
								<div className="text-center p-3 bg-green-50 dark:bg-green-950/20 rounded-lg">
									<Check className="h-5 w-5 mx-auto mb-1 text-green-600" />
									<p className="text-sm text-green-700 dark:text-green-400">
										Thank you for your feedback!
									</p>
								</div>
							)}

							{!this.state.showFeedback && !this.state.feedbackSubmitted && (
								<p className="text-sm text-muted-foreground text-center">
									If this problem persists, please contact support with the
									error ID above.
								</p>
							)}
						</CardContent>
					</Card>
				</div>
			);
		}

		return this.props.children;
	}
}

// Higher-order component for easier usage
export function withErrorBoundary<P extends object>(
	Component: ComponentType<P>,
	fallback?: ReactNode,
) {
	return function WrappedComponent(props: P) {
		return (
			<ErrorBoundary fallback={fallback}>
				<Component {...props} />
			</ErrorBoundary>
		);
	};
}
