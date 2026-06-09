import { useState, useEffect } from "react";
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
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Separator } from "@/components/ui/separator";
import { Progress } from "@/components/ui/progress";
import {
	Usb,
	KeyRound,
	ShieldCheck,
	FileSignature,
	CheckCircle,
	XCircle,
	AlertTriangle,
	Loader2,
	RefreshCw,
	Download,
	Eye,
	EyeOff,
	Clock,
	Award,
	Building2,
} from "lucide-react";
import { dscBridge, DSCCertificateInfo, DSCTokenInfo } from "@/lib/dsc-bridge";
import { useNetworkState } from "@/hooks/use-network-state";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";

interface DSCSigningModalProps {
	open: boolean;
	onClose: () => void;
	documentType:
		| "itr_verification"
		| "form_15ca"
		| "form_15cb"
		| "investment_agreement"
		| "kyc_consent"
		| "mandate"
		| "other";
	documentName: string;
	documentHash: string;
	documentUrl?: string;
	signerName: string;
	onSigningComplete?: (result: {
		success: boolean;
		transactionId?: string;
		certificateId?: string;
		signedAt?: Date;
	}) => void;
}

type SigningStep = "detect" | "pin" | "select" | "sign" | "complete" | "error";

export function DSCSigningModal({
	open,
	onClose,
	documentType,
	documentName,
	documentHash,
	documentUrl,
	signerName,
	onSigningComplete,
}: DSCSigningModalProps) {
	const [step, setStep] = useState<SigningStep>("detect");
	const [tokenInfo, setTokenInfo] = useState<DSCTokenInfo | null>(null);
	const [selectedCert, setSelectedCert] = useState<DSCCertificateInfo | null>(
		null,
	);
	const [pin, setPin] = useState("");
	const [showPin, setShowPin] = useState(false);
	const [isLoading, setIsLoading] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [progress, setProgress] = useState(0);
	const [transactionId, setTransactionId] = useState<string | null>(null);
	const [signingResult, setSigningResult] = useState<any>(null);

	const { status } = useNetworkState();
	const { toast } = useToast();

	const isOfflineOrSlow = status === "offline" || status === "slow";

	useEffect(() => {
		if (open) {
			setStep("detect");
			setTokenInfo(null);
			setSelectedCert(null);
			setPin("");
			setError(null);
			setProgress(0);
			setTransactionId(null);
			setSigningResult(null);
			detectToken();
		}
	}, [open]);

	const detectToken = async () => {
		setIsLoading(true);
		setError(null);
		setProgress(10);

		try {
			const info = await dscBridge.detectToken();
			setProgress(30);

			if (info) {
				setTokenInfo(info);
				setStep("pin");
			} else {
				setError(
					"No DSC token detected. Please insert your USB token and try again.",
				);
			}
		} catch (err) {
			setError(
				"Failed to detect DSC token. Please check if the token is properly connected.",
			);
		} finally {
			setIsLoading(false);
		}
	};

	const handlePinSubmit = async () => {
		if (pin.length < 4) {
			setError("PIN must be at least 4 characters");
			return;
		}

		setIsLoading(true);
		setError(null);
		setProgress(40);

		try {
			const authenticated = await dscBridge.enterPin(pin);
			setProgress(50);

			if (authenticated) {
				setStep("select");
			} else {
				setError("Invalid PIN. Please try again.");
				setPin("");
			}
		} catch (err) {
			setError("PIN verification failed. Please try again.");
		} finally {
			setIsLoading(false);
		}
	};

	const handleCertificateSelect = async (cert: DSCCertificateInfo) => {
		setSelectedCert(cert);
		dscBridge.selectCertificate(cert);
		setStep("sign");
	};

	const queueSignatureForLaterSubmission = (payload: {
		transactionId: string;
		signature: string;
		signatureAlgorithm: string;
		signedAt: string;
		documentName: string;
	}) => {
		const queueKey = "dsc_pending_signatures";
		const existing = localStorage.getItem(queueKey);
		const queue = existing ? JSON.parse(existing) : [];
		queue.push({
			...payload,
			queuedAt: new Date().toISOString(),
			id: `queued-${Date.now()}`,
		});
		localStorage.setItem(queueKey, JSON.stringify(queue));
	};

	const handleSign = async () => {
		if (!selectedCert) return;

		setIsLoading(true);
		setError(null);
		setProgress(60);

		const certInfo = {
			serialNumber: selectedCert.serialNumber,
			subject: selectedCert.subject,
			issuer: selectedCert.issuer,
			validFrom: selectedCert.validFrom.toISOString(),
			validTo: selectedCert.validTo.toISOString(),
			certificateClass: selectedCert.certificateClass,
			certificateType: selectedCert.certificateType,
			keyUsage: selectedCert.keyUsage,
			fingerprint: selectedCert.fingerprint,
			publicKey: selectedCert.publicKey,
		};

		try {
			const initiateResponse = await apiRequest("/api/esign/dsc/initiate", {
				method: "POST",
				body: JSON.stringify({
					documentType,
					documentName,
					documentHash,
					documentUrl,
					signerName,
					certificateInfo: certInfo,
					signingMethod: "usb_token",
				}),
			});

			setProgress(70);

			if (!initiateResponse.success) {
				throw new Error(
					initiateResponse.message || "Failed to initiate signing session",
				);
			}

			setTransactionId(initiateResponse.transactionId);

			const signResult = await dscBridge.signData(
				initiateResponse.dataToSign,
				"SHA256withRSA",
			);
			setProgress(85);

			if (!signResult.success) {
				throw new Error(signResult.error || "Signing failed");
			}

			if (isOfflineOrSlow) {
				queueSignatureForLaterSubmission({
					transactionId: initiateResponse.transactionId,
					signature: signResult.signature!,
					signatureAlgorithm: signResult.signatureAlgorithm!,
					signedAt:
						signResult.signedAt?.toISOString() || new Date().toISOString(),
					documentName,
				});

				setProgress(100);
				setSigningResult({
					success: true,
					queued: true,
					message: "Signature created locally and queued for submission",
					signatureData: {
						signedAt: signResult.signedAt,
						signatureAlgorithm: signResult.signatureAlgorithm,
					},
				});
				setStep("complete");

				toast({
					title: "Document Signed Locally",
					description:
						"Signature queued for submission when network is available.",
					variant: "default",
				});

				onSigningComplete?.({
					success: true,
					transactionId: initiateResponse.transactionId,
					signedAt: signResult.signedAt,
				});

				return;
			}

			const submitResponse = await apiRequest(
				"/api/esign/dsc/submit-signature",
				{
					method: "POST",
					body: JSON.stringify({
						transactionId: initiateResponse.transactionId,
						signature: signResult.signature,
						signatureAlgorithm: signResult.signatureAlgorithm,
						signedAt: signResult.signedAt?.toISOString(),
					}),
				},
			);

			setProgress(100);

			if (submitResponse.success) {
				setSigningResult(submitResponse);
				setStep("complete");

				onSigningComplete?.({
					success: true,
					transactionId: initiateResponse.transactionId,
					certificateId: submitResponse.certificateId,
					signedAt: submitResponse.signatureData?.signedAt,
				});

				toast({
					title: "Document Signed Successfully",
					description: `Signed with DSC Certificate: ${selectedCert.subject.commonName}`,
				});
			} else {
				throw new Error(submitResponse.message || "Failed to complete signing");
			}
		} catch (err) {
			console.error("DSC signing error:", err);
			setError((err as Error).message || "Signing failed. Please try again.");
			setStep("error");
		} finally {
			setIsLoading(false);
		}
	};

	const getCertDisplayInfo = (cert: DSCCertificateInfo) => {
		return dscBridge.getCertificateDisplayInfo(cert);
	};

	const renderDetectStep = () => (
		<div className="space-y-6">
			<div className="flex flex-col items-center justify-center py-8">
				{isLoading ? (
					<>
						<Loader2 className="h-16 w-16 text-primary animate-spin mb-4" />
						<p className="text-muted-foreground">Detecting DSC token...</p>
					</>
				) : error ? (
					<>
						<XCircle className="h-16 w-16 text-destructive mb-4" />
						<p className="text-destructive text-center">{error}</p>
						<Button onClick={detectToken} className="mt-4" variant="outline">
							<RefreshCw className="h-4 w-4 mr-2" />
							Try Again
						</Button>
					</>
				) : (
					<>
						<Usb className="h-16 w-16 text-muted-foreground mb-4" />
						<p className="text-muted-foreground">
							Please insert your DSC USB token
						</p>
						<Button onClick={detectToken} className="mt-4">
							<RefreshCw className="h-4 w-4 mr-2" />
							Detect Token
						</Button>
					</>
				)}
			</div>

			{dscBridge.isInMockMode() && (
				<Alert>
					<AlertTriangle className="h-4 w-4" />
					<AlertDescription>
						Running in mock mode. Real DSC middleware not detected.
					</AlertDescription>
				</Alert>
			)}
		</div>
	);

	const renderPinStep = () => (
		<div className="space-y-6">
			<div className="flex items-center gap-4 p-4 bg-muted rounded-lg">
				<Usb className="h-8 w-8 text-green-600" />
				<div>
					<p className="font-medium">{tokenInfo?.deviceName}</p>
					<p className="text-sm text-muted-foreground">
						{tokenInfo?.manufacturer} - {tokenInfo?.serialNumber}
					</p>
				</div>
				<Badge variant="secondary" className="ml-auto">
					Connected
				</Badge>
			</div>

			<div className="space-y-4">
				<Label htmlFor="pin">Enter Token PIN</Label>
				<div className="relative">
					<Input
						id="pin"
						type={showPin ? "text" : "password"}
						value={pin}
						onChange={(e) => setPin(e.target.value)}
						placeholder="Enter your PIN"
						maxLength={8}
						disabled={isLoading}
						data-testid="input-dsc-pin"
					/>
					<Button
						type="button"
						variant="ghost"
						size="icon"
						className="absolute right-2 top-1/2 -translate-y-1/2"
						onClick={() => setShowPin(!showPin)}
					>
						{showPin ? (
							<EyeOff className="h-4 w-4" />
						) : (
							<Eye className="h-4 w-4" />
						)}
					</Button>
				</div>
				<p className="text-sm text-muted-foreground">
					Enter the PIN for your DSC token to access certificates
				</p>
			</div>

			{error && (
				<Alert variant="destructive">
					<XCircle className="h-4 w-4" />
					<AlertDescription>{error}</AlertDescription>
				</Alert>
			)}

			<Button
				onClick={handlePinSubmit}
				className="w-full"
				disabled={isLoading || pin.length < 4}
				data-testid="button-verify-pin"
			>
				{isLoading ? (
					<>
						<Loader2 className="h-4 w-4 mr-2 animate-spin" />
						Verifying...
					</>
				) : (
					<>
						<KeyRound className="h-4 w-4 mr-2" />
						Verify PIN
					</>
				)}
			</Button>
		</div>
	);

	const renderSelectStep = () => (
		<div className="space-y-6">
			<div className="flex items-center gap-2 text-green-600">
				<ShieldCheck className="h-5 w-5" />
				<span className="font-medium">Token Authenticated</span>
			</div>

			<div>
				<h4 className="font-medium mb-3">Select Certificate for Signing</h4>
				<div className="space-y-3">
					{tokenInfo?.certificates.map((cert, index) => {
						const displayInfo = getCertDisplayInfo(cert);
						return (
							<Card
								key={index}
								className={`cursor-pointer transition-all hover:border-primary ${
									selectedCert?.serialNumber === cert.serialNumber
										? "border-primary bg-primary/5"
										: ""
								} ${displayInfo.isExpired ? "opacity-50" : ""}`}
								onClick={() =>
									!displayInfo.isExpired && handleCertificateSelect(cert)
								}
								data-testid={`card-certificate-${index}`}
							>
								<CardContent className="p-4">
									<div className="flex items-start justify-between">
										<div className="space-y-1">
											<div className="flex items-center gap-2">
												<span className="font-medium">{displayInfo.name}</span>
												<Badge
													variant={
														cert.certificateClass === "Class3"
															? "default"
															: cert.certificateClass === "Class2"
																? "secondary"
																: "outline"
													}
												>
													{displayInfo.classLabel}
												</Badge>
											</div>
											<div className="flex items-center gap-2 text-sm text-muted-foreground">
												<Building2 className="h-3 w-3" />
												{displayInfo.organization}
											</div>
											<div className="flex items-center gap-2 text-sm text-muted-foreground">
												<Award className="h-3 w-3" />
												Issued by: {displayInfo.issuer}
											</div>
											<div className="flex items-center gap-2 text-sm">
												<Clock className="h-3 w-3" />
												<span
													className={
														displayInfo.isExpiringSoon ? "text-orange-500" : ""
													}
												>
													Valid until: {displayInfo.validUntil}
													{displayInfo.isExpiringSoon &&
														` (${displayInfo.daysRemaining} days remaining)`}
												</span>
											</div>
										</div>
										{displayInfo.isExpired ? (
											<Badge variant="destructive">Expired</Badge>
										) : displayInfo.isExpiringSoon ? (
											<Badge
												variant="outline"
												className="text-orange-500 border-orange-500"
											>
												Expiring Soon
											</Badge>
										) : (
											<CheckCircle className="h-5 w-5 text-green-500" />
										)}
									</div>
								</CardContent>
							</Card>
						);
					})}
				</div>
			</div>
		</div>
	);

	const renderSignStep = () => (
		<div className="space-y-6">
			<Card>
				<CardHeader>
					<CardTitle className="text-lg">Document to Sign</CardTitle>
				</CardHeader>
				<CardContent className="space-y-3">
					<div className="flex justify-between">
						<span className="text-muted-foreground">Document:</span>
						<span className="font-medium">{documentName}</span>
					</div>
					<div className="flex justify-between">
						<span className="text-muted-foreground">Type:</span>
						<Badge variant="outline">{documentType.replace(/_/g, " ")}</Badge>
					</div>
					<Separator />
					<div className="flex justify-between">
						<span className="text-muted-foreground">Signing as:</span>
						<span className="font-medium">{signerName}</span>
					</div>
					<div className="flex justify-between">
						<span className="text-muted-foreground">Certificate:</span>
						<span className="font-medium">
							{selectedCert?.subject.commonName}
						</span>
					</div>
					<div className="flex justify-between">
						<span className="text-muted-foreground">Class:</span>
						<Badge>{selectedCert?.certificateClass}</Badge>
					</div>
				</CardContent>
			</Card>

			{isOfflineOrSlow && (
				<Alert>
					<AlertTriangle className="h-4 w-4" />
					<AlertDescription>
						You are {status}. A brief connection is required to initiate signing
						(get server challenge), but the signature submission can be queued
						if connection drops during signing.
					</AlertDescription>
				</Alert>
			)}

			{error && (
				<Alert variant="destructive">
					<XCircle className="h-4 w-4" />
					<AlertDescription>{error}</AlertDescription>
				</Alert>
			)}

			<div className="flex gap-3">
				<Button
					variant="outline"
					onClick={() => setStep("select")}
					disabled={isLoading}
					className="flex-1"
				>
					Back
				</Button>
				<Button
					onClick={handleSign}
					disabled={isLoading}
					className="flex-1"
					data-testid="button-sign-document"
				>
					{isLoading ? (
						<>
							<Loader2 className="h-4 w-4 mr-2 animate-spin" />
							Signing...
						</>
					) : (
						<>
							<FileSignature className="h-4 w-4 mr-2" />
							Sign Document
						</>
					)}
				</Button>
			</div>

			{isLoading && (
				<div className="space-y-2">
					<Progress value={progress} />
					<p className="text-sm text-muted-foreground text-center">
						{progress < 70
							? "Preparing signature..."
							: progress < 90
								? "Signing with DSC token..."
								: "Submitting signature..."}
					</p>
				</div>
			)}
		</div>
	);

	const renderCompleteStep = () => {
		const isQueued = signingResult?.queued;

		return (
			<div className="space-y-6">
				<div className="flex flex-col items-center py-6">
					{isQueued ? (
						<>
							<Clock className="h-16 w-16 text-orange-500 mb-4" />
							<h3 className="text-xl font-semibold">Document Signed Locally</h3>
							<p className="text-muted-foreground text-center mt-2">
								Your document has been signed with your DSC token. Submission is
								queued until network connectivity is restored.
							</p>
						</>
					) : (
						<>
							<CheckCircle className="h-16 w-16 text-green-500 mb-4" />
							<h3 className="text-xl font-semibold">
								Document Signed Successfully
							</h3>
							<p className="text-muted-foreground text-center mt-2">
								Your document has been digitally signed using your DSC token.
							</p>
						</>
					)}
				</div>

				{isQueued && (
					<Alert>
						<AlertTriangle className="h-4 w-4" />
						<AlertDescription>
							Signature will be automatically submitted when you're back online.
							Do not remove your DSC token until submission is complete.
						</AlertDescription>
					</Alert>
				)}

				<Card>
					<CardHeader>
						<CardTitle className="text-lg">Signature Details</CardTitle>
					</CardHeader>
					<CardContent className="space-y-3 text-sm">
						{transactionId && (
							<div className="flex justify-between">
								<span className="text-muted-foreground">Transaction ID:</span>
								<span className="font-mono">{transactionId}</span>
							</div>
						)}
						{signingResult?.certificateId && (
							<div className="flex justify-between">
								<span className="text-muted-foreground">Certificate ID:</span>
								<span className="font-mono">{signingResult.certificateId}</span>
							</div>
						)}
						<div className="flex justify-between">
							<span className="text-muted-foreground">Signed At:</span>
							<span>
								{signingResult?.signatureData?.signedAt
									? new Date(
											signingResult.signatureData.signedAt,
										).toLocaleString("en-IN")
									: "N/A"}
							</span>
						</div>
						<div className="flex justify-between">
							<span className="text-muted-foreground">Algorithm:</span>
							<span>
								{signingResult?.signatureData?.signatureAlgorithm || "N/A"}
							</span>
						</div>
						{signingResult?.signatureData?.issuer && (
							<div className="flex justify-between">
								<span className="text-muted-foreground">Issuer:</span>
								<span>{signingResult.signatureData.issuer}</span>
							</div>
						)}
						{isQueued && (
							<div className="flex justify-between">
								<span className="text-muted-foreground">Status:</span>
								<Badge
									variant="outline"
									className="text-orange-500 border-orange-500"
								>
									Queued
								</Badge>
							</div>
						)}
					</CardContent>
				</Card>

				<div className="flex gap-3">
					{!isQueued && (
						<Button
							variant="outline"
							onClick={() =>
								window.open(signingResult?.signedDocumentUrl, "_blank")
							}
							className="flex-1"
							data-testid="button-download-signed"
						>
							<Download className="h-4 w-4 mr-2" />
							Download Signed Document
						</Button>
					)}
					<Button
						onClick={onClose}
						className={isQueued ? "w-full" : "flex-1"}
						data-testid="button-close-modal"
					>
						{isQueued ? "Close" : "Done"}
					</Button>
				</div>
			</div>
		);
	};

	const renderErrorStep = () => (
		<div className="space-y-6">
			<div className="flex flex-col items-center py-6">
				<XCircle className="h-16 w-16 text-destructive mb-4" />
				<h3 className="text-xl font-semibold">Signing Failed</h3>
				<p className="text-muted-foreground text-center mt-2">{error}</p>
			</div>

			<div className="flex gap-3">
				<Button variant="outline" onClick={onClose} className="flex-1">
					Cancel
				</Button>
				<Button onClick={() => setStep("detect")} className="flex-1">
					<RefreshCw className="h-4 w-4 mr-2" />
					Try Again
				</Button>
			</div>
		</div>
	);

	return (
		<Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
			<DialogContent className="max-w-lg">
				<DialogHeader>
					<DialogTitle className="flex items-center gap-2">
						<KeyRound className="h-5 w-5" />
						Sign with DSC Token
					</DialogTitle>
					<DialogDescription>
						Use your Digital Signature Certificate (USB Token) to sign the
						document
					</DialogDescription>
				</DialogHeader>

				<div className="mt-4">
					{step === "detect" && renderDetectStep()}
					{step === "pin" && renderPinStep()}
					{step === "select" && renderSelectStep()}
					{step === "sign" && renderSignStep()}
					{step === "complete" && renderCompleteStep()}
					{step === "error" && renderErrorStep()}
				</div>
			</DialogContent>
		</Dialog>
	);
}

export default DSCSigningModal;
