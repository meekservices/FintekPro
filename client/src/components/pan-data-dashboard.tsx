import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollableTabsList } from "@/components/ScrollableTabsList";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Separator } from "@/components/ui/separator";
import {
	Shield as LucideShield,
	Eye,
	Clock,
	Activity,
	CheckCircle,
	AlertTriangle,
	Info,
	RefreshCw,
	Lock,
	FileText,
	Calendar,
} from "lucide-react";
import { format } from "date-fns";

interface PANDataDashboardProps {
	className?: string;
}

export function PANDataDashboard({ className }: PANDataDashboardProps) {
	const [refreshKey, setRefreshKey] = useState(0);

	// Query user's PAN status
	const {
		data: panStatus,
		isLoading: statusLoading,
		error: statusError,
	} = useQuery({
		queryKey: ["/api/pan-consent/my-data", refreshKey],
		retry: 2,
	}) as {
		data?: { success: boolean; data: any } | undefined;
		isLoading: boolean;
		error: any;
	};

	// Query audit log
	const { data: auditLog, isLoading: auditLoading } = useQuery({
		queryKey: ["/api/pan-consent/audit", refreshKey],
		retry: 2,
	}) as {
		data?: { success: boolean; data: any[] } | undefined;
		isLoading: boolean;
		error: any;
	};

	const handleRefresh = () => {
		setRefreshKey((prev) => prev + 1);
	};

	if (statusError) {
		return (
			<Card className={className}>
				<CardContent className="p-6">
					<Alert variant="destructive" data-testid="alert-pan-error">
						<AlertTriangle className="h-4 w-4" />
						<AlertDescription>
							Unable to load PAN data. Please try refreshing the page.
						</AlertDescription>
					</Alert>
				</CardContent>
			</Card>
		);
	}

	return (
		<div className={`space-y-6 ${className}`}>
			{/* Header */}
			<div className="flex items-center justify-between">
				<div>
					<h2
						className="text-2xl font-bold text-foreground"
						data-testid="heading-pan-dashboard"
					>
						My PAN Information
					</h2>
					<p className="text-muted-foreground">
						Secure access to your PAN consent and usage data
					</p>
				</div>
				<Button
					variant="outline"
					size="sm"
					onClick={handleRefresh}
					disabled={statusLoading}
					data-testid="button-refresh-pan-data"
				>
					<RefreshCw
						className={`h-4 w-4 mr-2 ${statusLoading ? "animate-spin" : ""}`}
					/>
					Refresh
				</Button>
			</div>

			{statusLoading ? (
				<Card>
					<CardContent className="p-6">
						<div className="flex items-center justify-center py-8">
							<RefreshCw className="h-6 w-6 animate-spin mr-2" />
							<span>Loading your PAN information...</span>
						</div>
					</CardContent>
				</Card>
			) : !panStatus?.data?.hasActivePan ? (
				<Card>
					<CardContent className="p-6">
						<div className="text-center py-8">
							<LucideShield className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
							<h3 className="text-lg font-medium text-foreground mb-2">
								No PAN Consent Found
							</h3>
							<p className="text-muted-foreground mb-4">
								You haven't provided PAN consent yet. This is required for tax
								services.
							</p>
							<Button variant="default" data-testid="button-setup-pan">
								Set Up PAN Consent
							</Button>
						</div>
					</CardContent>
				</Card>
			) : (
				<Tabs defaultValue="overview" className="space-y-4">
					<ScrollableTabsList className="grid w-full grid-cols-3">
						<TabsTrigger value="overview" data-testid="tab-pan-overview">
							Overview
						</TabsTrigger>
						<TabsTrigger value="compliance" data-testid="tab-pan-compliance">
							Compliance
						</TabsTrigger>
						<TabsTrigger value="audit" data-testid="tab-pan-audit">
							Audit Log
						</TabsTrigger>
					</ScrollableTabsList>

					<TabsContent value="overview" className="space-y-4">
						{/* PAN Information Card */}
						<Card>
							<CardHeader>
								<CardTitle className="flex items-center gap-2">
									<Lock className="h-5 w-5 text-blue-600" />
									PAN Information
								</CardTitle>
								<CardDescription>
									Your encrypted PAN number and verification status
								</CardDescription>
							</CardHeader>
							<CardContent className="space-y-4">
								<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
									<div className="space-y-2">
										<Label className="text-sm font-medium">Masked PAN</Label>
										<div className="flex items-center gap-2">
											<code
												className="text-lg font-mono bg-muted px-3 py-2 rounded-md"
												data-testid="text-masked-pan"
											>
												{panStatus?.data?.maskedPan || "N/A"}
											</code>
											<Badge
												variant={
													panStatus?.data?.consentDetails?.panVerified
														? "default"
														: "secondary"
												}
												data-testid="badge-pan-verified"
											>
												{panStatus?.data?.consentDetails?.panVerified ? (
													<>
														<CheckCircle className="h-3 w-3 mr-1" />
														Verified
													</>
												) : (
													<>
														<Clock className="h-3 w-3 mr-1" />
														Pending
													</>
												)}
											</Badge>
										</div>
									</div>

									<div className="space-y-2">
										<Label className="text-sm font-medium">KYC Status</Label>
										<Badge
											variant={
												panStatus?.data?.consentDetails?.kycVerified
													? "default"
													: "outline"
											}
											data-testid="badge-kyc-status"
										>
											{panStatus?.data?.consentDetails?.kycVerified ? (
												<>
													<CheckCircle className="h-3 w-3 mr-1" />
													Verified
												</>
											) : (
												<>
													<Clock className="h-3 w-3 mr-1" />
													Pending
												</>
											)}
										</Badge>
									</div>
								</div>

								<Separator />

								<div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
									<div>
										<p className="text-muted-foreground">Consent Given</p>
										<p className="font-medium" data-testid="text-consent-date">
											{panStatus?.data?.consentDetails?.consentTimestamp
												? format(
														new Date(
															panStatus.data.consentDetails.consentTimestamp,
														),
														"MMM dd, yyyy",
													)
												: "N/A"}
										</p>
									</div>
									<div>
										<p className="text-muted-foreground">Last Used</p>
										<p className="font-medium" data-testid="text-last-used">
											{panStatus?.data?.consentDetails?.lastUsed
												? format(
														new Date(panStatus.data.consentDetails.lastUsed),
														"MMM dd, yyyy",
													)
												: "Never"}
										</p>
									</div>
									<div>
										<p className="text-muted-foreground">Usage Count</p>
										<p className="font-medium" data-testid="text-usage-count">
											{panStatus?.data?.consentDetails?.usageCount || 0} times
										</p>
									</div>
								</div>
							</CardContent>
						</Card>

						{/* Security Information */}
						<Card>
							<CardHeader>
								<CardTitle className="flex items-center gap-2">
									<LucideShield className="h-5 w-5 text-green-600" />
									Security & Privacy
								</CardTitle>
								<CardDescription>
									How your PAN data is protected and managed
								</CardDescription>
							</CardHeader>
							<CardContent>
								<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
									<div className="flex items-start gap-3">
										<div className="bg-blue-100 dark:bg-blue-900/20 p-2 rounded-full">
											<Lock className="h-4 w-4 text-blue-600" />
										</div>
										<div>
											<p className="font-medium">AES-256 Encryption</p>
											<p className="text-sm text-muted-foreground">
												Your PAN is encrypted using military-grade security
											</p>
										</div>
									</div>

									<div className="flex items-start gap-3">
										<div className="bg-green-100 dark:bg-green-900/20 p-2 rounded-full">
											<Eye className="h-4 w-4 text-green-600" />
										</div>
										<div>
											<p className="font-medium">Complete Audit Trail</p>
											<p className="text-sm text-muted-foreground">
												Every access is logged for transparency
											</p>
										</div>
									</div>

									<div className="flex items-start gap-3">
										<div className="bg-orange-100 dark:bg-orange-900/20 p-2 rounded-full">
											<Calendar className="h-4 w-4 text-orange-600" />
										</div>
										<div>
											<p className="font-medium">7-Year Retention</p>
											<p className="text-sm text-muted-foreground">
												Compliant with tax regulations
											</p>
										</div>
									</div>

									<div className="flex items-start gap-3">
										<div className="bg-purple-100 dark:bg-purple-900/20 p-2 rounded-full">
											<LucideShield className="h-4 w-4 text-purple-600" />
										</div>
										<div>
											<p className="font-medium">Revocable Consent</p>
											<p className="text-sm text-muted-foreground">
												You can withdraw consent anytime
											</p>
										</div>
									</div>
								</div>
							</CardContent>
						</Card>
					</TabsContent>

					<TabsContent value="compliance" className="space-y-4">
						<Card>
							<CardHeader>
								<CardTitle className="flex items-center gap-2">
									<FileText className="h-5 w-5 text-blue-600" />
									Compliance Status
								</CardTitle>
								<CardDescription>
									Current compliance with data protection regulations
								</CardDescription>
							</CardHeader>
							<CardContent className="space-y-4">
								{panStatus?.data?.compliance?.isCompliant ? (
									<Alert className="border-green-200 bg-green-50 dark:bg-green-900/10">
										<CheckCircle className="h-4 w-4 text-green-600" />
										<AlertDescription className="text-green-800 dark:text-green-200">
											Your PAN consent is fully compliant with all regulatory
											requirements.
										</AlertDescription>
									</Alert>
								) : (
									<Alert variant="destructive">
										<AlertTriangle className="h-4 w-4" />
										<AlertDescription>
											Compliance issues detected. Please review the details
											below.
										</AlertDescription>
									</Alert>
								)}

								<div className="space-y-3">
									<div className="flex items-center justify-between">
										<span className="text-sm font-medium">Needs Renewal</span>
										<Badge
											variant={
												panStatus?.data?.compliance?.needsRenewal
													? "destructive"
													: "default"
											}
										>
											{panStatus?.data?.compliance?.needsRenewal ? "Yes" : "No"}
										</Badge>
									</div>

									{panStatus?.data?.compliance?.issues &&
										panStatus.data.compliance.issues.length > 0 && (
											<div>
												<p className="text-sm font-medium mb-2">
													Issues to Address:
												</p>
												<ul className="list-disc list-inside space-y-1 text-sm text-muted-foreground">
													{panStatus.data.compliance.issues.map(
														(issue: string, index: number) => (
															<li key={index}>{issue}</li>
														),
													)}
												</ul>
											</div>
										)}
								</div>
							</CardContent>
						</Card>
					</TabsContent>

					<TabsContent value="audit" className="space-y-4">
						<Card>
							<CardHeader>
								<CardTitle className="flex items-center gap-2">
									<Activity className="h-5 w-5 text-muted-foreground" />
									Access Audit Log
								</CardTitle>
								<CardDescription>
									Complete history of PAN data access for transparency
								</CardDescription>
							</CardHeader>
							<CardContent>
								{auditLoading ? (
									<div className="text-center py-4">
										<RefreshCw className="h-5 w-5 animate-spin mx-auto mb-2" />
										<p className="text-sm text-muted-foreground">
											Loading audit log...
										</p>
									</div>
								) : auditLog?.data && auditLog.data.length > 0 ? (
									<div className="space-y-3">
										{auditLog.data
											.slice(0, 10)
											.map((entry: any, index: number) => (
												<div
													key={entry.id || index}
													className="border-l-2 border-border pl-4 py-2"
												>
													<div className="flex items-center justify-between text-sm">
														<div>
															<span className="font-medium capitalize">
																{entry.action}
															</span>
															{entry.accessReason && (
																<span className="text-muted-foreground ml-2">
																	- {entry.accessReason}
																</span>
															)}
														</div>
														<span className="text-muted-foreground text-xs">
															{format(
																new Date(entry.timestamp),
																"MMM dd, HH:mm",
															)}
														</span>
													</div>
													{entry.apiEndpoint && (
														<p className="text-xs text-muted-foreground mt-1">
															Endpoint: {entry.apiEndpoint}
														</p>
													)}
												</div>
											))}
									</div>
								) : (
									<div className="text-center py-8 text-muted-foreground">
										<Activity className="h-8 w-8 mx-auto mb-2 opacity-50" />
										<p>No audit log entries found</p>
									</div>
								)}
							</CardContent>
						</Card>
					</TabsContent>
				</Tabs>
			)}
		</div>
	);
}

// Helper component for labels
function Label({
	children,
	className,
}: { children: React.ReactNode; className?: string }) {
	return (
		<label
			className={`block text-sm font-medium text-muted-foreground ${className || ""}`}
		>
			{children}
		</label>
	);
}
