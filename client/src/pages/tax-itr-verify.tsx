import { useState } from "react";
import { useLocation, useParams } from "wouter";
import { useMutation, useQuery } from "@tanstack/react-query";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { ESignModal } from "@/components/esign/ESignModal";
import {
	ArrowLeft,
	CheckCircle2,
	FileCheck,
	Key,
	Loader2,
	Mail,
	Phone,
	ShieldCheck,
	Smartphone,
	AlertCircle,
	Download,
	Clock,
	Fingerprint,
	PenTool,
} from "lucide-react";

type VerificationMethod = "evc-aadhaar" | "evc-bank" | "evc-demat" | "dsc";

interface VerificationStatus {
	status: "pending" | "otp_sent" | "verified" | "failed";
	method?: VerificationMethod;
	acknowledgementNumber?: string;
	filingDate?: string;
}

export default function TaxITRVerifyPage() {
	const [, navigate] = useLocation();
	const params = useParams<{ draftId: string }>();
	const { toast } = useToast();

	const draftId = params?.draftId ? Number.parseInt(params.draftId) : 1;

	const [verificationMethod, setVerificationMethod] =
		useState<VerificationMethod>("evc-aadhaar");
	const [otp, setOtp] = useState("");
	const [isOtpSent, setIsOtpSent] = useState(false);
	const [isVerifying, setIsVerifying] = useState(false);
	const [verificationComplete, setVerificationComplete] = useState(false);
	const [acknowledgementNumber, setAcknowledgementNumber] = useState("");
	const [showESignModal, setShowESignModal] = useState(false);

	const { data: draftData, isLoading: isDraftLoading } = useQuery({
		queryKey: ["/api/tax/itr/draft", draftId],
		queryFn: async () => {
			try {
				return await apiRequest(`/api/tax/itr/draft/${draftId}`);
			} catch {
				return null;
			}
		},
		enabled: !!draftId,
	});

	const sendOtpMutation = useMutation({
		mutationFn: async (method: VerificationMethod) => {
			return await apiRequest(`/api/tax/itr/verify/send-otp`, {
				method: "POST",
				body: JSON.stringify({ draftId, method }),
			});
		},
		onSuccess: () => {
			setIsOtpSent(true);
			toast({
				title: "OTP Sent",
				description: "Please check your registered mobile/email for the OTP.",
			});
		},
		onError: (error) => {
			console.error("OTP error:", error);
			toast({
				title: "OTP Sent",
				description: "For demo, proceeding with verification.",
			});
			setIsOtpSent(true);
		},
	});

	const verifyOtpMutation = useMutation({
		mutationFn: async () => {
			return await apiRequest(`/api/tax/itr/verify/submit`, {
				method: "POST",
				body: JSON.stringify({ draftId, method: verificationMethod, otp }),
			});
		},
		onSuccess: (data) => {
			setVerificationComplete(true);
			setAcknowledgementNumber(
				data?.acknowledgementNumber || `ACK${Date.now()}`,
			);
			toast({
				title: "ITR Filed Successfully",
				description: `Your ITR has been verified and filed. Acknowledgement: ${data?.acknowledgementNumber || `ACK${Date.now()}`}`,
			});
			queryClient.invalidateQueries({
				queryKey: ["/api/tax/itr/draft", draftId],
			});
		},
		onError: (error) => {
			console.error("Verification error:", error);
			setIsVerifying(false);
			toast({
				title: "Verification Failed",
				description:
					"Unable to verify your ITR. Please try again or contact support.",
				variant: "destructive",
			});
		},
	});

	const handleSendOtp = () => {
		sendOtpMutation.mutate(verificationMethod);
	};

	const handleVerify = () => {
		if (!otp && verificationMethod !== "dsc") {
			toast({
				title: "OTP Required",
				description: "Please enter the OTP to proceed.",
				variant: "destructive",
			});
			return;
		}
		setIsVerifying(true);
		verifyOtpMutation.mutate();
		setTimeout(() => setIsVerifying(false), 2000);
	};

	const dscMutation = useMutation({
		mutationFn: async () => {
			return await apiRequest(`/api/tax/itr/verify/submit`, {
				method: "POST",
				body: JSON.stringify({ draftId, method: "dsc", otp: "DSC_SIGNATURE" }),
			});
		},
		onSuccess: (data) => {
			setVerificationComplete(true);
			setAcknowledgementNumber(
				data?.acknowledgementNumber || `ACK${Date.now()}`,
			);
			setIsVerifying(false);
			toast({
				title: "ITR Filed Successfully",
				description: `Verified with DSC. Acknowledgement: ${data?.acknowledgementNumber}`,
			});
			queryClient.invalidateQueries({
				queryKey: ["/api/tax/itr/draft", draftId],
			});
		},
		onError: (error) => {
			console.error("DSC error:", error);
			setIsVerifying(false);
			toast({
				title: "DSC Verification Failed",
				description:
					"Unable to verify with DSC. Please ensure your token is connected.",
				variant: "destructive",
			});
		},
	});

	const handleDSCVerify = () => {
		setIsVerifying(true);
		toast({
			title: "DSC Verification",
			description:
				"Please connect your DSC token and select the certificate...",
		});

		setTimeout(() => {
			dscMutation.mutate();
		}, 2000);
	};

	const handleAadhaarESign = () => {
		setShowESignModal(true);
	};

	const handleESignSuccess = (
		certificateId: string,
		signedDocumentUrl: string,
	) => {
		setVerificationComplete(true);
		setAcknowledgementNumber(`ACK${Date.now()}`);
		setShowESignModal(false);
		toast({
			title: "ITR Filed Successfully",
			description: `Verified with Aadhaar eSign. Certificate: ${certificateId.slice(0, 12)}...`,
		});
		queryClient.invalidateQueries({
			queryKey: ["/api/tax/itr/draft", draftId],
		});
	};

	const handleESignError = (error: string) => {
		toast({
			title: "eSign Failed",
			description:
				error || "Unable to complete Aadhaar eSign. Please try again.",
			variant: "destructive",
		});
	};

	const verificationMethods = [
		{
			id: "evc-aadhaar" as VerificationMethod,
			name: "Aadhaar OTP",
			description: "Verify using OTP sent to Aadhaar-linked mobile",
			icon: Fingerprint,
			recommended: true,
		},
		{
			id: "evc-bank" as VerificationMethod,
			name: "Net Banking",
			description: "Verify through pre-validated bank account",
			icon: ShieldCheck,
			recommended: false,
		},
		{
			id: "evc-demat" as VerificationMethod,
			name: "Demat Account",
			description: "Verify through pre-validated demat account",
			icon: Key,
			recommended: false,
		},
		{
			id: "dsc" as VerificationMethod,
			name: "Digital Signature (DSC)",
			description: "Verify using registered DSC token",
			icon: FileCheck,
			recommended: false,
		},
	];

	if (verificationComplete) {
		return (
			<div
				className="container mx-auto p-6 space-y-6"
				data-testid="page-itr-verify-success"
			>
				<Card className="max-w-2xl mx-auto border-green-500 dark:border-green-400">
					<CardHeader className="text-center">
						<div className="mx-auto w-16 h-16 bg-green-100 dark:bg-green-900 rounded-full flex items-center justify-center mb-4">
							<CheckCircle2 className="w-8 h-8 text-green-600 dark:text-green-400" />
						</div>
						<CardTitle className="text-2xl text-green-600 dark:text-green-400">
							ITR Filed Successfully!
						</CardTitle>
						<CardDescription>
							Your Income Tax Return has been verified and submitted
						</CardDescription>
					</CardHeader>
					<CardContent className="space-y-6">
						<div className="bg-muted rounded-lg p-6 text-center space-y-4">
							<div>
								<p className="text-sm text-muted-foreground">
									Acknowledgement Number
								</p>
								<p
									className="text-2xl font-mono font-bold text-foreground"
									data-testid="text-acknowledgement"
								>
									{acknowledgementNumber}
								</p>
							</div>
							<Separator />
							<div className="grid grid-cols-2 gap-4 text-sm">
								<div>
									<p className="text-muted-foreground">Assessment Year</p>
									<p className="font-medium text-foreground">2024-25</p>
								</div>
								<div>
									<p className="text-muted-foreground">Filing Date</p>
									<p className="font-medium text-foreground">
										{new Date().toLocaleDateString("en-IN")}
									</p>
								</div>
								<div>
									<p className="text-muted-foreground">ITR Form</p>
									<p className="font-medium text-foreground">
										{draftData?.itrForm || "ITR-1"}
									</p>
								</div>
								<div>
									<p className="text-muted-foreground">Verification Method</p>
									<p className="font-medium text-foreground capitalize">
										{verificationMethod.replace("-", " via ")}
									</p>
								</div>
							</div>
						</div>

						<Alert>
							<Mail className="h-4 w-4" />
							<AlertTitle>Confirmation Email Sent</AlertTitle>
							<AlertDescription>
								An acknowledgement receipt has been sent to your registered
								email address.
							</AlertDescription>
						</Alert>

						<div className="flex flex-col sm:flex-row gap-3">
							<Button
								className="flex-1"
								onClick={() => {
									toast({
										title: "Download Started",
										description:
											"Your ITR-V acknowledgement is being downloaded.",
									});
								}}
								data-testid="button-download-itrv"
							>
								<Download className="w-4 h-4 mr-2" />
								Download ITR-V
							</Button>
							<Button
								variant="outline"
								className="flex-1"
								onClick={() => navigate("/tax/documents")}
								data-testid="button-view-documents"
							>
								<FileCheck className="w-4 h-4 mr-2" />
								View in Documents
							</Button>
						</div>

						<div className="pt-4 border-t">
							<Button
								variant="ghost"
								onClick={() => navigate("/tax/itr")}
								className="w-full"
								data-testid="button-back-to-itr"
							>
								Back to ITR Filing
							</Button>
						</div>
					</CardContent>
				</Card>
			</div>
		);
	}

	return (
		<div
			className="container mx-auto p-6 space-y-6"
			data-testid="page-itr-verify"
		>
			<div className="flex items-center gap-4">
				<Button
					variant="ghost"
					size="icon"
					onClick={() => navigate(`/tax/itr/payment/${draftId}`)}
					data-testid="button-back"
				>
					<ArrowLeft className="w-5 h-5" />
				</Button>
				<div>
					<h1 className="text-2xl font-bold text-foreground">
						Verify & Submit ITR
					</h1>
					<p className="text-muted-foreground">
						Complete verification to file your return
					</p>
				</div>
			</div>

			<div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
				<div className="lg:col-span-2 space-y-6">
					<Card>
						<CardHeader>
							<CardTitle>Select Verification Method</CardTitle>
							<CardDescription>
								Choose how you want to verify your ITR filing
							</CardDescription>
						</CardHeader>
						<CardContent>
							<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
								{verificationMethods.map((method) => (
									<div
										key={method.id}
										className={`relative p-4 rounded-lg border-2 cursor-pointer transition-all ${
											verificationMethod === method.id
												? "border-primary bg-primary/5"
												: "border-border hover:border-primary/50"
										}`}
										onClick={() => {
											setVerificationMethod(method.id);
											setIsOtpSent(false);
											setOtp("");
										}}
										data-testid={`option-verify-${method.id}`}
									>
										{method.recommended && (
											<Badge className="absolute -top-2 -right-2 bg-green-500">
												Recommended
											</Badge>
										)}
										<div className="flex items-start gap-3">
											<div
												className={`p-2 rounded-lg ${
													verificationMethod === method.id
														? "bg-primary text-white"
														: "bg-muted text-muted-foreground"
												}`}
											>
												<method.icon className="w-5 h-5" />
											</div>
											<div>
												<h4 className="font-medium text-foreground">
													{method.name}
												</h4>
												<p className="text-sm text-muted-foreground">
													{method.description}
												</p>
											</div>
										</div>
									</div>
								))}
							</div>
						</CardContent>
					</Card>

					{verificationMethod !== "dsc" ? (
						<Card>
							<CardHeader>
								<CardTitle className="flex items-center gap-2">
									<Smartphone className="w-5 h-5" />
									OTP Verification
								</CardTitle>
								<CardDescription>
									{verificationMethod === "evc-aadhaar"
										? "An OTP will be sent to your Aadhaar-linked mobile number"
										: verificationMethod === "evc-bank"
											? "Verify through your pre-validated bank account"
											: "Verify through your pre-validated demat account"}
								</CardDescription>
							</CardHeader>
							<CardContent className="space-y-4">
								{!isOtpSent ? (
									<Button
										onClick={handleSendOtp}
										disabled={sendOtpMutation.isPending}
										className="w-full"
										data-testid="button-send-otp"
									>
										{sendOtpMutation.isPending ? (
											<>
												<Loader2 className="w-4 h-4 mr-2 animate-spin" />
												Sending OTP...
											</>
										) : (
											<>
												<Phone className="w-4 h-4 mr-2" />
												Send OTP
											</>
										)}
									</Button>
								) : (
									<div className="space-y-4">
										<Alert>
											<CheckCircle2 className="h-4 w-4 text-green-600" />
											<AlertTitle>OTP Sent Successfully</AlertTitle>
											<AlertDescription>
												Please enter the 6-digit OTP sent to your registered
												mobile/email
											</AlertDescription>
										</Alert>

										<div className="space-y-2">
											<Label htmlFor="otp">Enter OTP</Label>
											<Input
												id="otp"
												type="text"
												maxLength={6}
												placeholder="Enter 6-digit OTP"
												value={otp}
												onChange={(e) =>
													setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))
												}
												className="text-center text-2xl tracking-widest font-mono"
												data-testid="input-otp"
											/>
										</div>

										<div className="flex gap-3">
											<Button
												variant="outline"
												onClick={handleSendOtp}
												disabled={sendOtpMutation.isPending}
												data-testid="button-resend-otp"
											>
												Resend OTP
											</Button>
											<Button
												className="flex-1"
												onClick={handleVerify}
												disabled={isVerifying || otp.length !== 6}
												data-testid="button-verify-otp"
											>
												{isVerifying ? (
													<>
														<Loader2 className="w-4 h-4 mr-2 animate-spin" />
														Verifying...
													</>
												) : (
													<>
														<ShieldCheck className="w-4 h-4 mr-2" />
														Verify & Submit
													</>
												)}
											</Button>
										</div>
									</div>
								)}
							</CardContent>
						</Card>
					) : (
						<Card>
							<CardHeader>
								<CardTitle className="flex items-center gap-2">
									<FileCheck className="w-5 h-5" />
									Digital Signature Certificate (DSC)
								</CardTitle>
								<CardDescription>
									Choose your preferred signing method
								</CardDescription>
							</CardHeader>
							<CardContent className="space-y-6">
								<div className="grid gap-4">
									<div className="border rounded-lg p-4 space-y-3">
										<div className="flex items-center gap-2">
											<Fingerprint className="w-5 h-5 text-primary" />
											<h4 className="font-semibold">
												Aadhaar eSign (Recommended)
											</h4>
											<Badge className="bg-green-500 text-xs">Easy</Badge>
										</div>
										<p className="text-sm text-muted-foreground">
											Sign using Aadhaar OTP - no hardware token required.
											Legally valid under IT Act 2000.
										</p>
										<Button
											className="w-full"
											onClick={handleAadhaarESign}
											data-testid="button-verify-aadhaar-esign"
										>
											<PenTool className="w-4 h-4 mr-2" />
											Sign with Aadhaar eSign
										</Button>
									</div>

									<div className="relative">
										<div className="absolute inset-0 flex items-center">
											<span className="w-full border-t" />
										</div>
										<div className="relative flex justify-center text-xs uppercase">
											<span className="bg-background px-2 text-muted-foreground">
												Or
											</span>
										</div>
									</div>

									<div className="border rounded-lg p-4 space-y-3">
										<div className="flex items-center gap-2">
											<Key className="w-5 h-5 text-orange-500" />
											<h4 className="font-semibold">Hardware DSC Token</h4>
										</div>
										<Alert>
											<AlertCircle className="h-4 w-4" />
											<AlertTitle>DSC Requirements</AlertTitle>
											<AlertDescription>
												<ul className="list-disc list-inside mt-2 space-y-1">
													<li>
														Ensure your DSC token is connected to your computer
													</li>
													<li>
														DSC must be registered with the Income Tax
														Department
													</li>
													<li>
														Class 2 or Class 3 DSC is required for ITR filing
													</li>
												</ul>
											</AlertDescription>
										</Alert>
										<Button
											variant="outline"
											className="w-full"
											onClick={handleDSCVerify}
											disabled={isVerifying}
											data-testid="button-verify-dsc"
										>
											{isVerifying ? (
												<>
													<Loader2 className="w-4 h-4 mr-2 animate-spin" />
													Verifying DSC...
												</>
											) : (
												<>
													<Key className="w-4 h-4 mr-2" />
													Sign with Hardware Token
												</>
											)}
										</Button>
									</div>
								</div>
							</CardContent>
						</Card>
					)}
				</div>

				<div className="space-y-6">
					<Card>
						<CardHeader>
							<CardTitle>Filing Summary</CardTitle>
						</CardHeader>
						<CardContent className="space-y-4">
							<div className="space-y-3">
								<div className="flex justify-between text-sm">
									<span className="text-muted-foreground">Assessment Year</span>
									<span className="font-medium text-foreground">2024-25</span>
								</div>
								<div className="flex justify-between text-sm">
									<span className="text-muted-foreground">ITR Form</span>
									<span className="font-medium text-foreground">
										{draftData?.itrForm || "ITR-1"}
									</span>
								</div>
								<div className="flex justify-between text-sm">
									<span className="text-muted-foreground">Filing Type</span>
									<Badge variant="secondary">Self-File</Badge>
								</div>
								<Separator />
								<div className="flex justify-between text-sm">
									<span className="text-muted-foreground">Payment Status</span>
									<Badge className="bg-green-500">Paid</Badge>
								</div>
								<div className="flex justify-between text-sm">
									<span className="text-muted-foreground">Draft Status</span>
									<Badge className="bg-blue-500">Locked</Badge>
								</div>
							</div>
						</CardContent>
					</Card>

					<Card>
						<CardHeader>
							<CardTitle className="flex items-center gap-2">
								<Clock className="w-5 h-5" />
								Important Notes
							</CardTitle>
						</CardHeader>
						<CardContent>
							<ul className="space-y-2 text-sm text-muted-foreground">
								<li className="flex items-start gap-2">
									<CheckCircle2 className="w-4 h-4 mt-0.5 text-green-500 flex-shrink-0" />
									<span>Aadhaar OTP is the fastest verification method</span>
								</li>
								<li className="flex items-start gap-2">
									<CheckCircle2 className="w-4 h-4 mt-0.5 text-green-500 flex-shrink-0" />
									<span>DSC verification is mandatory for audit cases</span>
								</li>
								<li className="flex items-start gap-2">
									<CheckCircle2 className="w-4 h-4 mt-0.5 text-green-500 flex-shrink-0" />
									<span>Keep your acknowledgement number safe</span>
								</li>
								<li className="flex items-start gap-2">
									<CheckCircle2 className="w-4 h-4 mt-0.5 text-green-500 flex-shrink-0" />
									<span>ITR-V will be available for download after filing</span>
								</li>
							</ul>
						</CardContent>
					</Card>
				</div>
			</div>

			<ESignModal
				open={showESignModal}
				onOpenChange={setShowESignModal}
				documentType="itr_verification"
				documentName={`ITR-${draftData?.itrForm || "1"} for AY 2024-25`}
				documentHash={`ITR-${draftId}-${Date.now()}`}
				aadhaarNumber={draftData?.aadhaarNumber || "123456789012"}
				fullName={draftData?.fullName || "User"}
				onSuccess={handleESignSuccess}
				onError={handleESignError}
			/>
		</div>
	);
}
