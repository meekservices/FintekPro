import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollableTabsList } from "@/components/ScrollableTabsList";
import {
	Shield as LucideShield,
	FileText,
	Clock,
	CheckCircle,
	AlertTriangle,
	Upload,
	Video,
	Smartphone,
	RefreshCw,
	Info,
} from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

interface ReCKYCWorkflowProps {
	isOpen: boolean;
	onClose: () => void;
	requestedChanges?: Record<string, any>;
	userId: string;
	onSuccess?: () => void;
}

export function ReCKYCWorkflow({
	isOpen,
	onClose,
	requestedChanges = {},
	userId,
	onSuccess,
}: ReCKYCWorkflowProps) {
	const [currentStep, setCurrentStep] = useState<
		"overview" | "documents" | "verification" | "status"
	>("overview");
	const [verificationMethod, setVerificationMethod] = useState<
		"digilocker" | "manual_upload" | "video_kyc"
	>("digilocker");
	const [reason, setReason] = useState("");
	const [uploadedDocs, setUploadedDocs] = useState<string[]>([]);
	const { toast } = useToast();

	// Query re-CKYC status
	const {
		data: reCkycStatus,
		isLoading: statusLoading,
		refetch: refetchStatus,
	} = useQuery<{
		hasPendingRequests: boolean;
		pendingRequests: Array<{ id: string; [key: string]: any }>;
	}>({
		queryKey: [`/api/demographic/re-ckyc-status/${userId}`],
		enabled: isOpen,
		retry: 2,
	});

	// Submit re-CKYC request
	const submitReCKYC = useMutation({
		mutationFn: async (data: any) => {
			const response = await apiRequest(
				"POST",
				"/api/demographic/re-ckyc",
				data,
			);
			return response.json();
		},
		onSuccess: (data) => {
			toast({
				title: "Re-CKYC Request Submitted",
				description:
					"Your demographic data update request has been submitted for verification.",
			});
			refetchStatus();
			onSuccess?.();
			setCurrentStep("status");
		},
		onError: (error: any) => {
			toast({
				title: "Error",
				description: error.message || "Failed to submit re-CKYC request",
				variant: "destructive",
			});
		},
	});

	const handleSubmit = () => {
		if (!reason.trim()) {
			toast({
				title: "Reason Required",
				description: "Please provide a reason for the demographic data changes",
				variant: "destructive",
			});
			return;
		}

		submitReCKYC.mutate({
			userId,
			changes: requestedChanges,
			reason: reason.trim(),
			verificationMethod,
			documents: uploadedDocs,
		});
	};

	const getStepIcon = (step: string) => {
		switch (step) {
			case "overview":
				return <Info className="h-4 w-4" />;
			case "documents":
				return <Upload className="h-4 w-4" />;
			case "verification":
				return <LucideShield className="h-4 w-4" />;
			case "status":
				return <Clock className="h-4 w-4" />;
			default:
				return <Info className="h-4 w-4" />;
		}
	};

	return (
		<Dialog open={isOpen} onOpenChange={onClose}>
			<DialogContent
				className="max-w-4xl max-h-[90vh] overflow-y-auto"
				data-testid="modal-re-ckyc"
			>
				<DialogHeader>
					<DialogTitle
						className="flex items-center gap-2 text-xl"
						data-testid="heading-re-ckyc"
					>
						<LucideShield className="h-5 w-5 text-blue-600" />
						Re-CKYC Verification Required
					</DialogTitle>
					<DialogDescription className="text-base">
						Demographic data changes require re-CKYC verification for regulatory
						compliance
					</DialogDescription>
				</DialogHeader>

				<div className="space-y-6">
					{/* Progress Steps */}
					<div className="flex items-center justify-between bg-muted p-4 rounded-lg">
						{["overview", "documents", "verification", "status"].map(
							(step, index) => (
								<div key={step} className="flex items-center">
									<div
										className={`flex items-center justify-center w-8 h-8 rounded-full ${
											currentStep === step
												? "bg-blue-600 text-white"
												: index <
														[
															"overview",
															"documents",
															"verification",
															"status",
														].indexOf(currentStep)
													? "bg-green-600 text-white"
													: "bg-muted text-muted-foreground"
										}`}
									>
										{getStepIcon(step)}
									</div>
									<span className="ml-2 text-sm font-medium capitalize">
										{step}
									</span>
									{index < 3 && <div className="w-8 h-0.5 bg-muted mx-4" />}
								</div>
							),
						)}
					</div>

					{/* Step Content */}
					{currentStep === "overview" && (
						<div className="space-y-4">
							<Card>
								<CardHeader>
									<CardTitle className="flex items-center gap-2">
										<AlertTriangle className="h-5 w-5 text-amber-600" />
										Why Re-CKYC is Required
									</CardTitle>
								</CardHeader>
								<CardContent className="space-y-4">
									<div className="bg-amber-50 dark:bg-amber-900/10 p-4 rounded-lg">
										<h4 className="font-semibold text-amber-800 dark:text-amber-200 mb-2">
											Regulatory Compliance
										</h4>
										<ul className="text-sm text-amber-700 dark:text-amber-300 space-y-1">
											<li>
												• Demographic data changes require verification as per
												KYC regulations
											</li>
											<li>
												• Ensures data accuracy and prevents identity fraud
											</li>
											<li>
												• Maintains compliance with RBI and SEBI guidelines
											</li>
											<li>
												• Protects your account and financial transactions
											</li>
										</ul>
									</div>

									{Object.keys(requestedChanges).length > 0 && (
										<div className="mt-4">
											<h4 className="font-semibold mb-3">Requested Changes:</h4>
											<div className="space-y-2">
												{Object.entries(requestedChanges).map(
													([field, value]) => (
														<div
															key={field}
															className="flex justify-between items-center p-3 bg-muted rounded-lg"
														>
															<span className="font-medium capitalize">
																{field.replace(/([A-Z])/g, " $1").trim()}
															</span>
															<Badge variant="outline">{String(value)}</Badge>
														</div>
													),
												)}
											</div>
										</div>
									)}
								</CardContent>
							</Card>

							<div className="flex justify-end gap-3">
								<Button
									variant="outline"
									onClick={onClose}
									data-testid="button-cancel-re-ckyc"
								>
									Cancel
								</Button>
								<Button
									onClick={() => setCurrentStep("documents")}
									data-testid="button-proceed-re-ckyc"
								>
									Proceed with Re-CKYC
								</Button>
							</div>
						</div>
					)}

					{currentStep === "documents" && (
						<div className="space-y-4">
							<Card>
								<CardHeader>
									<CardTitle className="flex items-center gap-2">
										<FileText className="h-5 w-5 text-blue-600" />
										Document Verification Method
									</CardTitle>
									<CardDescription>
										Choose your preferred method for document verification
									</CardDescription>
								</CardHeader>
								<CardContent>
									<Tabs
										value={verificationMethod}
										onValueChange={(value: any) => setVerificationMethod(value)}
									>
										<ScrollableTabsList className="grid w-full grid-cols-3">
											<TabsTrigger
												value="digilocker"
												data-testid="tab-digilocker"
											>
												DigiLocker
											</TabsTrigger>
											<TabsTrigger
												value="video_kyc"
												data-testid="tab-video-kyc"
											>
												Video KYC
											</TabsTrigger>
											<TabsTrigger
												value="manual_upload"
												data-testid="tab-manual-upload"
											>
												Manual Upload
											</TabsTrigger>
										</ScrollableTabsList>

										<TabsContent value="digilocker" className="space-y-4">
											<div className="flex items-start gap-3 p-4 bg-green-50 dark:bg-green-900/10 rounded-lg">
												<Smartphone className="h-5 w-5 text-green-600 mt-1" />
												<div className="flex-1">
													<h4 className="font-semibold text-green-800 dark:text-green-200">
														DigiLocker Integration (Recommended)
													</h4>
													<p className="text-sm text-green-700 dark:text-green-300 mt-1">
														Fastest and most secure method. Your documents will
														be verified directly from DigiLocker.
													</p>
													<div className="mt-4 space-y-3">
														<Alert className="bg-blue-50 border-blue-200 dark:bg-blue-900/20">
															<Info className="h-4 w-4 text-blue-600" />
															<AlertDescription className="text-sm text-blue-700 dark:text-blue-300">
																DigiLocker will automatically fetch your
																Aadhaar, PAN, and other verified documents for
																instant KYC completion.
															</AlertDescription>
														</Alert>
														<Button
															onClick={() =>
																window.open("/digilocker", "_blank")
															}
															variant="outline"
															className="w-full"
															data-testid="button-open-digilocker"
														>
															<Smartphone className="h-4 w-4 mr-2" />
															Open DigiLocker to Share Documents
														</Button>
													</div>
												</div>
											</div>
										</TabsContent>

										<TabsContent value="video_kyc" className="space-y-4">
											<div className="flex items-start gap-3 p-4 bg-blue-50 dark:bg-blue-900/10 rounded-lg">
												<Video className="h-5 w-5 text-blue-600 mt-1" />
												<div>
													<h4 className="font-semibold text-blue-800 dark:text-blue-200">
														Video KYC Verification
													</h4>
													<p className="text-sm text-blue-700 dark:text-blue-300 mt-1">
														Live video call with verification executive.
														Documents verified in real-time.
													</p>
												</div>
											</div>
										</TabsContent>

										<TabsContent value="manual_upload" className="space-y-4">
											<div className="flex items-start gap-3 p-4 bg-orange-50 dark:bg-orange-900/10 rounded-lg">
												<Upload className="h-5 w-5 text-orange-600 mt-1" />
												<div>
													<h4 className="font-semibold text-orange-800 dark:text-orange-200">
														Manual Document Upload
													</h4>
													<p className="text-sm text-orange-700 dark:text-orange-300 mt-1">
														Upload scanned copies of your documents. Takes 2-3
														business days for verification.
													</p>
												</div>
											</div>
										</TabsContent>
									</Tabs>
								</CardContent>
							</Card>

							<div className="flex justify-between gap-3">
								<Button
									variant="outline"
									onClick={() => setCurrentStep("overview")}
									data-testid="button-back-to-overview"
								>
									Back
								</Button>
								<Button
									onClick={() => setCurrentStep("verification")}
									data-testid="button-proceed-to-verification"
								>
									Continue
								</Button>
							</div>
						</div>
					)}

					{currentStep === "verification" && (
						<div className="space-y-4">
							<Card>
								<CardHeader>
									<CardTitle className="flex items-center gap-2">
										<LucideShield className="h-5 w-5 text-green-600" />
										Verification Details
									</CardTitle>
									<CardDescription>
										Provide reason for demographic data changes
									</CardDescription>
								</CardHeader>
								<CardContent className="space-y-4">
									<div className="space-y-2">
										<Label htmlFor="reason" className="text-base font-medium">
											Reason for Changes <span className="text-red-500">*</span>
										</Label>
										<Textarea
											id="reason"
											placeholder="Please explain why you need to update your demographic information..."
											value={reason}
											onChange={(e) => setReason(e.target.value)}
											className="min-h-[100px]"
											data-testid="textarea-re-ckyc-reason"
										/>
										<p className="text-sm text-muted-foreground">
											This information helps our compliance team process your
											request efficiently
										</p>
									</div>

									<div className="bg-blue-50 dark:bg-blue-900/10 p-4 rounded-lg">
										<h4 className="font-semibold text-blue-800 dark:text-blue-200 mb-2">
											What happens next?
										</h4>
										<ul className="text-sm text-blue-700 dark:text-blue-300 space-y-1">
											<li>
												• Your request will be reviewed by our compliance team
											</li>
											<li>
												• Documents will be verified through the chosen method
											</li>
											<li>
												• You'll receive updates via email and in-app
												notifications
											</li>
											<li>• Processing typically takes 1-3 business days</li>
										</ul>
									</div>
								</CardContent>
							</Card>

							<div className="flex justify-between gap-3">
								<Button
									variant="outline"
									onClick={() => setCurrentStep("documents")}
									data-testid="button-back-to-documents"
								>
									Back
								</Button>
								<Button
									onClick={handleSubmit}
									disabled={!reason.trim() || submitReCKYC.isPending}
									data-testid="button-submit-re-ckyc"
								>
									{submitReCKYC.isPending ? (
										<>
											<RefreshCw className="h-4 w-4 mr-2 animate-spin" />
											Submitting...
										</>
									) : (
										<>
											<CheckCircle className="h-4 w-4 mr-2" />
											Submit Re-CKYC Request
										</>
									)}
								</Button>
							</div>
						</div>
					)}

					{currentStep === "status" && (
						<div className="space-y-4">
							<Card>
								<CardHeader>
									<CardTitle className="flex items-center gap-2">
										<CheckCircle className="h-5 w-5 text-green-600" />
										Request Submitted Successfully
									</CardTitle>
									<CardDescription>
										Your re-CKYC request has been submitted for processing
									</CardDescription>
								</CardHeader>
								<CardContent className="space-y-4">
									<Alert className="border-green-200 bg-green-50 dark:bg-green-900/10">
										<CheckCircle className="h-4 w-4 text-green-600" />
										<AlertDescription className="text-green-800 dark:text-green-200">
											Your demographic data change request has been successfully
											submitted. You will receive updates on the verification
											progress via email.
										</AlertDescription>
									</Alert>

									{reCkycStatus?.hasPendingRequests && (
										<div className="mt-4">
											<h4 className="font-semibold mb-3">Pending Requests:</h4>
											<div className="space-y-2">
												{reCkycStatus.pendingRequests.map((request: any) => (
													<div
														key={request.id}
														className="flex justify-between items-center p-3 bg-muted rounded-lg"
													>
														<span className="text-sm">
															Request ID: {request.id}
														</span>
														<Badge variant="secondary">
															<Clock className="h-3 w-3 mr-1" />
															Pending
														</Badge>
													</div>
												))}
											</div>
										</div>
									)}
								</CardContent>
							</Card>

							<div className="flex justify-end">
								<Button onClick={onClose} data-testid="button-close-re-ckyc">
									Close
								</Button>
							</div>
						</div>
					)}
				</div>
			</DialogContent>
		</Dialog>
	);
}
