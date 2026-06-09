import { useState, useEffect } from "react";
import { useMutation } from "@tanstack/react-query";
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
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import {
	Fingerprint,
	Loader2,
	CheckCircle2,
	AlertCircle,
	RefreshCw,
	ShieldCheck,
	FileCheck,
	Clock,
} from "lucide-react";

type DocumentType =
	| "itr_verification"
	| "form_15ca"
	| "form_15cb"
	| "investment_agreement"
	| "kyc_consent"
	| "mandate"
	| "other";

interface ESignModalProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	documentType: DocumentType;
	documentName: string;
	documentHash: string;
	documentUrl?: string;
	aadhaarNumber: string;
	fullName: string;
	onSuccess?: (certificateId: string, signedDocumentUrl: string) => void;
	onError?: (error: string) => void;
}

type SigningStep = "initiate" | "otp" | "verifying" | "success" | "failed";

export function ESignModal({
	open,
	onOpenChange,
	documentType,
	documentName,
	documentHash,
	documentUrl,
	aadhaarNumber,
	fullName,
	onSuccess,
	onError,
}: ESignModalProps) {
	const { toast } = useToast();
	const [step, setStep] = useState<SigningStep>("initiate");
	const [otp, setOtp] = useState("");
	const [transactionId, setTransactionId] = useState("");
	const [maskedMobile, setMaskedMobile] = useState("");
	const [expiresAt, setExpiresAt] = useState<Date | null>(null);
	const [certificateId, setCertificateId] = useState("");
	const [signedDocumentUrl, setSignedDocumentUrl] = useState("");
	const [errorMessage, setErrorMessage] = useState("");
	const [timeRemaining, setTimeRemaining] = useState(0);

	useEffect(() => {
		if (!expiresAt) return;

		const timer = setInterval(() => {
			const remaining = Math.max(
				0,
				Math.floor((expiresAt.getTime() - Date.now()) / 1000),
			);
			setTimeRemaining(remaining);

			if (remaining <= 0) {
				clearInterval(timer);
				if (step === "otp") {
					setStep("failed");
					setErrorMessage("OTP expired. Please try again.");
				}
			}
		}, 1000);

		return () => clearInterval(timer);
	}, [expiresAt, step]);

	useEffect(() => {
		if (open) {
			setStep("initiate");
			setOtp("");
			setTransactionId("");
			setErrorMessage("");
		}
	}, [open]);

	const initiateMutation = useMutation({
		mutationFn: async () => {
			return await apiRequest("/api/esign/initiate", {
				method: "POST",
				body: JSON.stringify({
					documentType,
					documentName,
					documentHash,
					documentUrl,
					aadhaarNumber,
					fullName,
				}),
			});
		},
		onSuccess: (data) => {
			if (data.success) {
				setTransactionId(data.transactionId);
				setMaskedMobile(data.maskedMobile || "XXXXXX****");
				setExpiresAt(new Date(data.expiresAt || Date.now() + 10 * 60 * 1000));
				setTimeRemaining(600);
				setStep("otp");
				toast({
					title: "OTP Sent",
					description: `OTP sent to ${data.maskedMobile || "your Aadhaar-linked mobile"}`,
				});
			} else {
				setStep("failed");
				setErrorMessage(data.message || "Failed to initiate eSign");
			}
		},
		onError: (error: any) => {
			setStep("failed");
			setErrorMessage(error?.message || "Failed to initiate eSign");
			onError?.(error?.message || "Failed to initiate eSign");
		},
	});

	const verifyMutation = useMutation({
		mutationFn: async () => {
			return await apiRequest("/api/esign/verify", {
				method: "POST",
				body: JSON.stringify({
					transactionId,
					otp,
				}),
			});
		},
		onSuccess: (data) => {
			if (data.success) {
				setCertificateId(data.certificateId || "");
				setSignedDocumentUrl(data.signedDocumentUrl || "");
				setStep("success");
				toast({
					title: "Document Signed Successfully",
					description:
						"Your document has been digitally signed using Aadhaar eSign.",
				});
				onSuccess?.(data.certificateId || "", data.signedDocumentUrl || "");
			} else {
				setStep("failed");
				setErrorMessage(data.message || "OTP verification failed");
			}
		},
		onError: (error: any) => {
			setStep("failed");
			setErrorMessage(error?.message || "OTP verification failed");
			onError?.(error?.message || "OTP verification failed");
		},
	});

	const resendOtpMutation = useMutation({
		mutationFn: async () => {
			return await apiRequest("/api/esign/resend-otp", {
				method: "POST",
				body: JSON.stringify({ transactionId }),
			});
		},
		onSuccess: (data) => {
			if (data.success) {
				setExpiresAt(new Date(Date.now() + 10 * 60 * 1000));
				setTimeRemaining(600);
				toast({
					title: "OTP Resent",
					description: "A new OTP has been sent to your Aadhaar-linked mobile.",
				});
			}
		},
		onError: (error: any) => {
			toast({
				title: "Failed to resend OTP",
				description: error?.message || "Please try again.",
				variant: "destructive",
			});
		},
	});

	const handleInitiate = () => {
		initiateMutation.mutate();
	};

	const handleVerify = () => {
		if (otp.length !== 6) {
			toast({
				title: "Invalid OTP",
				description: "Please enter a 6-digit OTP",
				variant: "destructive",
			});
			return;
		}
		setStep("verifying");
		verifyMutation.mutate();
	};

	const handleResendOtp = () => {
		resendOtpMutation.mutate();
	};

	const handleRetry = () => {
		setStep("initiate");
		setOtp("");
		setErrorMessage("");
	};

	const formatTime = (seconds: number) => {
		const mins = Math.floor(seconds / 60);
		const secs = seconds % 60;
		return `${mins}:${secs.toString().padStart(2, "0")}`;
	};

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="sm:max-w-md" data-testid="esign-modal">
				<DialogHeader>
					<DialogTitle className="flex items-center gap-2">
						<Fingerprint className="h-5 w-5 text-primary" />
						Aadhaar eSign (DSC)
					</DialogTitle>
					<DialogDescription>
						Digitally sign your document using Aadhaar-based authentication
					</DialogDescription>
				</DialogHeader>

				<div className="space-y-4">
					{step === "initiate" && (
						<div className="space-y-4">
							<Alert>
								<ShieldCheck className="h-4 w-4" />
								<AlertTitle>Secure Digital Signature</AlertTitle>
								<AlertDescription>
									Your document will be signed electronically using Aadhaar OTP
									verification. This is legally valid under IT Act 2000.
								</AlertDescription>
							</Alert>

							<div className="rounded-lg border p-4 space-y-2">
								<div className="flex justify-between text-sm">
									<span className="text-muted-foreground">Document:</span>
									<span className="font-medium">{documentName}</span>
								</div>
								<div className="flex justify-between text-sm">
									<span className="text-muted-foreground">Signer:</span>
									<span className="font-medium">{fullName}</span>
								</div>
								<div className="flex justify-between text-sm">
									<span className="text-muted-foreground">Aadhaar:</span>
									<span className="font-medium">
										XXXX-XXXX-{aadhaarNumber.slice(-4)}
									</span>
								</div>
							</div>

							<Button
								onClick={handleInitiate}
								disabled={initiateMutation.isPending}
								className="w-full"
								data-testid="btn-initiate-esign"
							>
								{initiateMutation.isPending ? (
									<>
										<Loader2 className="mr-2 h-4 w-4 animate-spin" />
										Sending OTP...
									</>
								) : (
									<>
										<Fingerprint className="mr-2 h-4 w-4" />
										Send OTP to Aadhaar-linked Mobile
									</>
								)}
							</Button>
						</div>
					)}

					{step === "otp" && (
						<div className="space-y-4">
							<Alert>
								<Clock className="h-4 w-4" />
								<AlertTitle>OTP Sent</AlertTitle>
								<AlertDescription>
									Enter the 6-digit OTP sent to {maskedMobile}
								</AlertDescription>
							</Alert>

							<div className="flex items-center justify-between text-sm">
								<span className="text-muted-foreground">Time remaining:</span>
								<Badge
									variant={timeRemaining < 60 ? "destructive" : "secondary"}
								>
									{formatTime(timeRemaining)}
								</Badge>
							</div>

							<Progress value={(timeRemaining / 600) * 100} className="h-2" />

							<div className="space-y-2">
								<Label htmlFor="otp">Enter OTP</Label>
								<Input
									id="otp"
									type="text"
									inputMode="numeric"
									maxLength={6}
									placeholder="Enter 6-digit OTP"
									value={otp}
									onChange={(e) => setOtp(e.target.value.replace(/\D/g, ""))}
									className="text-center text-lg tracking-widest"
									data-testid="input-esign-otp"
								/>
							</div>

							<div className="flex gap-2">
								<Button
									variant="outline"
									onClick={handleResendOtp}
									disabled={resendOtpMutation.isPending || timeRemaining > 540}
									className="flex-1"
									data-testid="btn-resend-otp"
								>
									{resendOtpMutation.isPending ? (
										<Loader2 className="mr-2 h-4 w-4 animate-spin" />
									) : (
										<RefreshCw className="mr-2 h-4 w-4" />
									)}
									Resend OTP
								</Button>
								<Button
									onClick={handleVerify}
									disabled={otp.length !== 6 || verifyMutation.isPending}
									className="flex-1"
									data-testid="btn-verify-esign"
								>
									{verifyMutation.isPending ? (
										<Loader2 className="mr-2 h-4 w-4 animate-spin" />
									) : (
										<CheckCircle2 className="mr-2 h-4 w-4" />
									)}
									Verify & Sign
								</Button>
							</div>
						</div>
					)}

					{step === "verifying" && (
						<div className="text-center py-8 space-y-4">
							<Loader2 className="h-12 w-12 animate-spin mx-auto text-primary" />
							<p className="text-lg font-medium">Verifying and signing...</p>
							<p className="text-sm text-muted-foreground">
								Please wait while we verify your OTP and generate the digital
								signature.
							</p>
						</div>
					)}

					{step === "success" && (
						<div className="space-y-4">
							<div className="text-center py-4">
								<CheckCircle2 className="h-16 w-16 text-green-500 mx-auto mb-4" />
								<h3 className="text-lg font-semibold text-green-700 dark:text-green-300">
									Document Signed Successfully
								</h3>
							</div>

							<Alert className="bg-green-50 dark:bg-green-950/30 border-green-200 dark:border-green-800">
								<FileCheck className="h-4 w-4 text-green-600" />
								<AlertTitle className="text-green-800 dark:text-green-200">
									eSign Complete
								</AlertTitle>
								<AlertDescription className="text-green-700 dark:text-green-300">
									Your document has been digitally signed using Aadhaar
									authentication.
								</AlertDescription>
							</Alert>

							<div className="rounded-lg border p-4 space-y-2 bg-muted/50">
								<div className="flex justify-between text-sm">
									<span className="text-muted-foreground">Certificate ID:</span>
									<span className="font-mono text-xs">{certificateId}</span>
								</div>
								<div className="flex justify-between text-sm">
									<span className="text-muted-foreground">Signed At:</span>
									<span>{new Date().toLocaleString()}</span>
								</div>
								<div className="flex justify-between text-sm">
									<span className="text-muted-foreground">Algorithm:</span>
									<span>SHA256 with RSA</span>
								</div>
							</div>

							<Button
								onClick={() => onOpenChange(false)}
								className="w-full"
								data-testid="btn-close-esign"
							>
								Done
							</Button>
						</div>
					)}

					{step === "failed" && (
						<div className="space-y-4">
							<div className="text-center py-4">
								<AlertCircle className="h-16 w-16 text-red-500 mx-auto mb-4" />
								<h3 className="text-lg font-semibold text-red-700 dark:text-red-300">
									Signing Failed
								</h3>
							</div>

							<Alert variant="destructive">
								<AlertCircle className="h-4 w-4" />
								<AlertTitle>Error</AlertTitle>
								<AlertDescription>{errorMessage}</AlertDescription>
							</Alert>

							<div className="flex gap-2">
								<Button
									variant="outline"
									onClick={() => onOpenChange(false)}
									className="flex-1"
								>
									Cancel
								</Button>
								<Button
									onClick={handleRetry}
									className="flex-1"
									data-testid="btn-retry-esign"
								>
									<RefreshCw className="mr-2 h-4 w-4" />
									Try Again
								</Button>
							</div>
						</div>
					)}
				</div>
			</DialogContent>
		</Dialog>
	);
}

export default ESignModal;
