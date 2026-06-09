import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
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
import { Checkbox } from "@/components/ui/checkbox";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
	Shield as LucideShield,
	Lock,
	FileText,
	Eye,
	Clock,
	CheckCircle,
	AlertTriangle,
	Info,
} from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

interface PANConsentModalProps {
	isOpen: boolean;
	onClose: () => void;
	onSuccess?: (consent: any) => void;
	title?: string;
	description?: string;
}

export function PANConsentModal({
	isOpen,
	onClose,
	onSuccess,
	title = "PAN Consent Required",
	description = "To provide tax services, we need your consent to securely store and use your PAN number.",
}: PANConsentModalProps) {
	const [panNumber, setPanNumber] = useState("");
	const [consents, setConsents] = useState({
		dataCollection: false,
		dataProcessing: false,
		dataRetention: false,
		privacyPolicy: false,
	});
	const [errors, setErrors] = useState<string[]>([]);
	const { toast } = useToast();
	const queryClient = useQueryClient();

	const validatePAN = (pan: string): boolean => {
		const panRegex = /^[A-Z]{5}[0-9]{4}[A-Z]{1}$/;
		return panRegex.test(pan.toUpperCase());
	};

	const storePANConsent = useMutation({
		mutationFn: async (data: any) => {
			const response = await apiRequest("POST", "/api/pan-consent", data);
			return response.json();
		},
		onSuccess: (data) => {
			queryClient.invalidateQueries({ queryKey: ["/api/pan-consent"] });
			toast({
				title: "PAN Consent Saved",
				description: "Your PAN has been securely stored with your consent.",
			});
			onSuccess?.(data);
			onClose();
		},
		onError: (error: any) => {
			toast({
				title: "Error",
				description: error.message || "Failed to save PAN consent",
				variant: "destructive",
			});
		},
	});

	const handleSubmit = () => {
		const newErrors: string[] = [];

		// Validate PAN
		if (!panNumber) {
			newErrors.push("PAN number is required");
		} else if (!validatePAN(panNumber)) {
			newErrors.push("Invalid PAN format. Example: ABCDE1234F");
		}

		// Validate consents
		if (!consents.dataCollection) {
			newErrors.push("Data collection consent is required");
		}
		if (!consents.dataProcessing) {
			newErrors.push("Data processing consent is required");
		}
		if (!consents.dataRetention) {
			newErrors.push("Data retention consent is required");
		}
		if (!consents.privacyPolicy) {
			newErrors.push("Privacy policy acceptance is required");
		}

		setErrors(newErrors);

		if (newErrors.length === 0) {
			storePANConsent.mutate({
				panNumber: panNumber.toUpperCase(),
				consentVersion: "1.0",
				ipAddress: "auto-detect", // Backend will detect
				userAgent: navigator.userAgent,
			});
		}
	};

	const handleConsentChange = (key: keyof typeof consents, value: boolean) => {
		setConsents((prev) => ({ ...prev, [key]: value }));
		if (value && errors.length > 0) {
			setErrors((prev) => prev.filter((err) => !err.includes(key)));
		}
	};

	const allConsentsGiven = Object.values(consents).every(Boolean);

	return (
		<Dialog open={isOpen} onOpenChange={() => onClose()}>
			<DialogContent
				className="max-w-4xl max-h-[90vh] overflow-y-auto"
				data-testid="modal-pan-consent"
			>
				<DialogHeader>
					<DialogTitle
						className="flex items-center gap-2 text-xl"
						data-testid="heading-pan-consent"
					>
						<LucideShield className="h-5 w-5 text-blue-600" />
						{title}
					</DialogTitle>
					<DialogDescription className="text-base">
						{description}
					</DialogDescription>
				</DialogHeader>

				<div className="space-y-6">
					{/* Privacy Notice */}
					<Card className="border-blue-200 bg-blue-50 dark:bg-blue-900/10">
						<CardHeader className="pb-3">
							<CardTitle className="flex items-center gap-2 text-blue-700 dark:text-blue-300">
								<Info className="h-4 w-4" />
								Privacy & Security Notice
							</CardTitle>
						</CardHeader>
						<CardContent className="space-y-3">
							<div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
								<div className="flex items-start gap-2">
									<Lock className="h-4 w-4 text-green-600 mt-0.5" />
									<div>
										<p className="font-medium">AES-256 Encryption</p>
										<p className="text-muted-foreground">
											Your PAN is encrypted using military-grade security
										</p>
									</div>
								</div>
								<div className="flex items-start gap-2">
									<Eye className="h-4 w-4 text-green-600 mt-0.5" />
									<div>
										<p className="font-medium">Audit Trail</p>
										<p className="text-muted-foreground">
											All access is logged for transparency
										</p>
									</div>
								</div>
								<div className="flex items-start gap-2">
									<Clock className="h-4 w-4 text-green-600 mt-0.5" />
									<div>
										<p className="font-medium">7-Year Retention</p>
										<p className="text-muted-foreground">
											As per Income Tax Act requirements
										</p>
									</div>
								</div>
								<div className="flex items-start gap-2">
									<LucideShield className="h-4 w-4 text-green-600 mt-0.5" />
									<div>
										<p className="font-medium">Revocable Consent</p>
										<p className="text-muted-foreground">
											You can withdraw consent anytime
										</p>
									</div>
								</div>
							</div>
						</CardContent>
					</Card>

					{/* PAN Input */}
					<div className="space-y-3">
						<Label htmlFor="pan-input" className="text-base font-medium">
							PAN Number
						</Label>
						<Input
							id="pan-input"
							placeholder="ABCDE1234F"
							value={panNumber}
							onChange={(e) => setPanNumber(e.target.value.toUpperCase())}
							className="text-lg font-mono tracking-wider"
							maxLength={10}
							data-testid="input-pan-number"
						/>
						<p className="text-sm text-muted-foreground">
							Enter your 10-character PAN number (5 letters + 4 digits + 1
							letter)
						</p>
					</div>

					<Separator />

					{/* Consent Sections */}
					<div className="space-y-4">
						<h3 className="text-lg font-semibold">Your Consent</h3>

						<div className="space-y-4">
							{/* Data Collection Consent */}
							<Card className="border-l-4 border-l-blue-500">
								<CardHeader className="pb-3">
									<div className="flex items-center space-x-2">
										<Checkbox
											id="consent-collection"
											checked={consents.dataCollection}
											onCheckedChange={(checked) =>
												handleConsentChange("dataCollection", checked === true)
											}
											data-testid="checkbox-data-collection"
										/>
										<Label htmlFor="consent-collection" className="font-medium">
											Data Collection Consent
										</Label>
										<Badge variant="outline">Required</Badge>
									</div>
								</CardHeader>
								<CardContent className="pt-0">
									<p className="text-sm text-muted-foreground">
										I consent to the collection and secure storage of my PAN
										number for tax data aggregation, ITR filing, and related
										financial services as per the Information Technology Act,
										2000.
									</p>
								</CardContent>
							</Card>

							{/* Data Processing Consent */}
							<Card className="border-l-4 border-l-green-500">
								<CardHeader className="pb-3">
									<div className="flex items-center space-x-2">
										<Checkbox
											id="consent-processing"
											checked={consents.dataProcessing}
											onCheckedChange={(checked) =>
												handleConsentChange("dataProcessing", checked === true)
											}
											data-testid="checkbox-data-processing"
										/>
										<Label htmlFor="consent-processing" className="font-medium">
											Data Processing Consent
										</Label>
										<Badge variant="outline">Required</Badge>
									</div>
								</CardHeader>
								<CardContent className="pt-0">
									<p className="text-sm text-muted-foreground">
										I authorize the processing of my PAN for tax calculation,
										government API integration, ITR generation, and compliance
										verification purposes.
									</p>
								</CardContent>
							</Card>

							{/* Data Retention Consent */}
							<Card className="border-l-4 border-l-orange-500">
								<CardHeader className="pb-3">
									<div className="flex items-center space-x-2">
										<Checkbox
											id="consent-retention"
											checked={consents.dataRetention}
											onCheckedChange={(checked) =>
												handleConsentChange("dataRetention", checked === true)
											}
											data-testid="checkbox-data-retention"
										/>
										<Label htmlFor="consent-retention" className="font-medium">
											Data Retention Consent
										</Label>
										<Badge variant="outline">Required</Badge>
									</div>
								</CardHeader>
								<CardContent className="pt-0">
									<p className="text-sm text-muted-foreground">
										I consent to the retention of my encrypted PAN for 7 years
										as required by tax regulations, with the right to request
										deletion after this period.
									</p>
								</CardContent>
							</Card>

							{/* Privacy Policy Consent */}
							<Card className="border-l-4 border-l-purple-500">
								<CardHeader className="pb-3">
									<div className="flex items-center space-x-2">
										<Checkbox
											id="consent-privacy"
											checked={consents.privacyPolicy}
											onCheckedChange={(checked) =>
												handleConsentChange("privacyPolicy", checked === true)
											}
											data-testid="checkbox-privacy-policy"
										/>
										<Label htmlFor="consent-privacy" className="font-medium">
											Privacy Policy Agreement
										</Label>
										<Badge variant="outline">Required</Badge>
									</div>
								</CardHeader>
								<CardContent className="pt-0">
									<p className="text-sm text-muted-foreground">
										I have read and agree to the{" "}
										<a
											href="/privacy"
											target="_blank"
											className="text-blue-600 hover:underline"
											rel="noreferrer"
										>
											Privacy Policy
										</a>{" "}
										and{" "}
										<a
											href="/terms"
											target="_blank"
											className="text-blue-600 hover:underline"
											rel="noreferrer"
										>
											Terms of Service
										</a>{" "}
										regarding PAN data handling and security measures.
									</p>
								</CardContent>
							</Card>
						</div>
					</div>

					{/* Error Display */}
					{errors.length > 0 && (
						<Alert variant="destructive" data-testid="alert-consent-errors">
							<AlertTriangle className="h-4 w-4" />
							<AlertDescription>
								<ul className="list-disc list-inside space-y-1">
									{errors.map((error, index) => (
										<li key={index}>{error}</li>
									))}
								</ul>
							</AlertDescription>
						</Alert>
					)}

					{/* Action Buttons */}
					<div className="flex flex-col sm:flex-row gap-3 pt-4">
						<Button
							onClick={handleSubmit}
							disabled={
								!allConsentsGiven || !panNumber || storePANConsent.isPending
							}
							className="flex-1"
							data-testid="button-save-consent"
						>
							{storePANConsent.isPending ? (
								"Saving..."
							) : (
								<>
									<CheckCircle className="h-4 w-4 mr-2" />
									Save Consent & Continue
								</>
							)}
						</Button>
						<Button
							variant="outline"
							onClick={onClose}
							disabled={storePANConsent.isPending}
							className="flex-1 sm:flex-none"
							data-testid="button-cancel-consent"
						>
							Cancel
						</Button>
					</div>

					{/* Legal Notice */}
					<div className="text-xs text-muted-foreground bg-muted p-3 rounded-lg">
						<p className="mb-2">
							<strong>Legal Notice:</strong> This consent is collected in
							compliance with the Information Technology Act, 2000, and Income
							Tax Act, 1961. Your PAN will be used solely for tax-related
							services and government compliance.
						</p>
						<p>
							<strong>Your Rights:</strong> You have the right to access,
							modify, or delete your data, and withdraw consent at any time.
							Contact our support team for assistance with data requests.
						</p>
					</div>
				</div>
			</DialogContent>
		</Dialog>
	);
}
