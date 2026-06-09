import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import {
	CheckCircle2,
	Loader2,
	ArrowRight,
	ArrowLeft,
	Plane,
	MapPin,
	Landmark,
	FileText,
	Eye,
} from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";

interface StepProps {
	data: any;
	onChange: (field: string, value: any) => void;
	onNext: () => void;
	onBack: () => void;
	isFirst: boolean;
	isLast: boolean;
}

const steps = [
	{
		id: 1,
		name: "Passport & PAN",
		icon: Plane,
		description: "Identity verification",
	},
	{
		id: 2,
		name: "Overseas Address",
		icon: MapPin,
		description: "Address proof",
	},
	{
		id: 3,
		name: "PIS & Bank Details",
		icon: Landmark,
		description: "Banking information",
	},
	{ id: 4, name: "FATCA/CRS", icon: FileText, description: "Tax compliance" },
	{ id: 5, name: "Review & Submit", icon: Eye, description: "Final review" },
];

// Step 1: Passport & PAN Verification
function PassportPANStep({ data, onChange, onNext, isFirst }: StepProps) {
	const { toast } = useToast();

	const verifyPassport = useMutation({
		mutationFn: async () => {
			const response = await apiRequest(
				"POST",
				"/api/kyc/nri/verify-passport",
				{
					body: {
						passportNumber: data.passportNumber,
						passportName: data.passportName,
						passportExpiry: data.passportExpiry,
						countryOfResidence: data.countryOfResidence,
						pan: data.pan,
						dob: data.dob,
					},
				},
			);
			return response.json();
		},
		onSuccess: () => {
			toast({ title: "✅ Passport Verified Successfully" });
			onNext();
		},
		onError: (error: any) => {
			toast({
				title: "Verification Failed",
				description: error.message,
				variant: "destructive",
			});
		},
	});

	return (
		<div className="space-y-6 animate-in fade-in-50 duration-500">
			<div className="space-y-4">
				<div className="space-y-2">
					<Label htmlFor="passportNumber">Passport Number *</Label>
					<Input
						id="passportNumber"
						placeholder="A1234567"
						value={data.passportNumber || ""}
						onChange={(e) =>
							onChange("passportNumber", e.target.value.toUpperCase())
						}
						data-testid="input-passport"
					/>
				</div>
				<div className="space-y-2">
					<Label htmlFor="passportName">Name (as per Passport) *</Label>
					<Input
						id="passportName"
						value={data.passportName || ""}
						onChange={(e) => onChange("passportName", e.target.value)}
						data-testid="input-passport-name"
					/>
				</div>
				<div className="space-y-2">
					<Label htmlFor="passportExpiry">Passport Expiry Date *</Label>
					<Input
						id="passportExpiry"
						type="date"
						value={data.passportExpiry || ""}
						onChange={(e) => onChange("passportExpiry", e.target.value)}
						data-testid="input-passport-expiry"
					/>
				</div>
				<div className="space-y-2">
					<Label htmlFor="countryOfResidence">Country of Residence *</Label>
					<Select
						value={data.countryOfResidence || ""}
						onValueChange={(value) => onChange("countryOfResidence", value)}
					>
						<SelectTrigger data-testid="select-country">
							<SelectValue placeholder="Select country" />
						</SelectTrigger>
						<SelectContent>
							<SelectItem value="USA">United States</SelectItem>
							<SelectItem value="UK">United Kingdom</SelectItem>
							<SelectItem value="UAE">United Arab Emirates</SelectItem>
							<SelectItem value="Singapore">Singapore</SelectItem>
							<SelectItem value="Canada">Canada</SelectItem>
							<SelectItem value="Australia">Australia</SelectItem>
						</SelectContent>
					</Select>
				</div>
				<div className="space-y-2">
					<Label htmlFor="pan">PAN Number (Optional)</Label>
					<Input
						id="pan"
						placeholder="ABCDE1234F"
						value={data.pan || ""}
						onChange={(e) => onChange("pan", e.target.value.toUpperCase())}
						maxLength={10}
						data-testid="input-pan"
					/>
				</div>
				{data.pan && (
					<div className="space-y-2">
						<Label htmlFor="dob">Date of Birth *</Label>
						<Input
							id="dob"
							type="date"
							value={data.dob || ""}
							onChange={(e) => onChange("dob", e.target.value)}
							data-testid="input-dob"
						/>
					</div>
				)}
			</div>

			<div className="flex justify-end">
				<Button
					onClick={() => verifyPassport.mutate()}
					disabled={
						!data.passportNumber ||
						!data.passportName ||
						!data.passportExpiry ||
						!data.countryOfResidence
					}
					data-testid="button-next"
				>
					{verifyPassport.isPending ? (
						<Loader2 className="h-4 w-4 animate-spin mr-2" />
					) : null}
					Next <ArrowRight className="ml-2 h-4 w-4" />
				</Button>
			</div>
		</div>
	);
}

// Step 2: Overseas Address
function OverseasAddressStep({ data, onChange, onNext, onBack }: StepProps) {
	const { toast } = useToast();

	const verifyAddress = useMutation({
		mutationFn: async () => {
			const response = await apiRequest("POST", "/api/kyc/nri/verify-address", {
				body: {
					addressLine1: data.addressLine1,
					addressLine2: data.addressLine2,
					city: data.city,
					state: data.state,
					country: data.country,
					postalCode: data.postalCode,
					addressProofUrl: data.addressProofUrl,
				},
			});
			return response.json();
		},
		onSuccess: () => {
			toast({ title: "✅ Address Verified Successfully" });
			onNext();
		},
		onError: (error: any) => {
			toast({
				title: "Verification Failed",
				description: error.message,
				variant: "destructive",
			});
		},
	});

	return (
		<div className="space-y-6 animate-in fade-in-50 duration-500">
			<div className="space-y-4">
				<div className="space-y-2">
					<Label htmlFor="addressLine1">Address Line 1 *</Label>
					<Input
						id="addressLine1"
						value={data.addressLine1 || ""}
						onChange={(e) => onChange("addressLine1", e.target.value)}
						data-testid="input-address1"
					/>
				</div>
				<div className="space-y-2">
					<Label htmlFor="addressLine2">Address Line 2</Label>
					<Input
						id="addressLine2"
						value={data.addressLine2 || ""}
						onChange={(e) => onChange("addressLine2", e.target.value)}
						data-testid="input-address2"
					/>
				</div>
				<div className="grid grid-cols-2 gap-4">
					<div className="space-y-2">
						<Label htmlFor="city">City *</Label>
						<Input
							id="city"
							value={data.city || ""}
							onChange={(e) => onChange("city", e.target.value)}
							data-testid="input-city"
						/>
					</div>
					<div className="space-y-2">
						<Label htmlFor="state">State/Province</Label>
						<Input
							id="state"
							value={data.state || ""}
							onChange={(e) => onChange("state", e.target.value)}
							data-testid="input-state"
						/>
					</div>
				</div>
				<div className="grid grid-cols-2 gap-4">
					<div className="space-y-2">
						<Label htmlFor="country">Country *</Label>
						<Input
							id="country"
							value={data.country || ""}
							onChange={(e) => onChange("country", e.target.value)}
							data-testid="input-country"
						/>
					</div>
					<div className="space-y-2">
						<Label htmlFor="postalCode">Postal Code *</Label>
						<Input
							id="postalCode"
							value={data.postalCode || ""}
							onChange={(e) => onChange("postalCode", e.target.value)}
							data-testid="input-postal-code"
						/>
					</div>
				</div>
				<div className="space-y-2">
					<Label htmlFor="addressProof">
						Address Proof (Utility Bill/Lease Agreement) *
					</Label>
					<Input
						id="addressProof"
						type="file"
						onChange={(e) => onChange("addressProofUrl", e.target.files?.[0])}
						data-testid="input-address-proof"
					/>
				</div>
			</div>

			<div className="flex justify-between">
				<Button variant="outline" onClick={onBack} data-testid="button-back">
					<ArrowLeft className="mr-2 h-4 w-4" /> Back
				</Button>
				<Button
					onClick={() => verifyAddress.mutate()}
					disabled={
						!data.addressLine1 ||
						!data.city ||
						!data.country ||
						!data.postalCode ||
						!data.addressProofUrl
					}
					data-testid="button-next"
				>
					{verifyAddress.isPending ? (
						<Loader2 className="h-4 w-4 animate-spin mr-2" />
					) : null}
					Next <ArrowRight className="ml-2 h-4 w-4" />
				</Button>
			</div>
		</div>
	);
}

// Step 3: PIS & Bank Details
function PISBankStep({ data, onChange, onNext, onBack }: StepProps) {
	const { toast } = useToast();

	const verifyPIS = useMutation({
		mutationFn: async () => {
			const response = await apiRequest("POST", "/api/kyc/nri/verify-pis", {
				body: {
					pisPermissionLetterUrl: data.pisPermissionLetterUrl,
					pisBankName: data.pisBankName,
					pisBranchName: data.pisBranchName,
					foreignBankAccountNumber: data.foreignBankAccountNumber,
					foreignBankName: data.foreignBankName,
					foreignBankCountry: data.foreignBankCountry,
					swiftCode: data.swiftCode,
				},
			});
			return response.json();
		},
		onSuccess: () => {
			toast({ title: "✅ PIS & Bank Details Verified" });
			onNext();
		},
		onError: (error: any) => {
			toast({
				title: "Verification Failed",
				description: error.message,
				variant: "destructive",
			});
		},
	});

	return (
		<div className="space-y-6 animate-in fade-in-50 duration-500">
			<div className="space-y-4">
				<div className="space-y-2">
					<Label htmlFor="pisPermissionLetter">
						PIS Permission Letter (RBI) *
					</Label>
					<Input
						id="pisPermissionLetter"
						type="file"
						onChange={(e) =>
							onChange("pisPermissionLetterUrl", e.target.files?.[0])
						}
						data-testid="input-pis-letter"
					/>
				</div>
				<div className="space-y-2">
					<Label htmlFor="pisBankName">PIS Bank Name *</Label>
					<Input
						id="pisBankName"
						placeholder="HDFC Bank"
						value={data.pisBankName || ""}
						onChange={(e) => onChange("pisBankName", e.target.value)}
						data-testid="input-pis-bank"
					/>
				</div>
				<div className="space-y-2">
					<Label htmlFor="pisBranchName">PIS Branch Name *</Label>
					<Input
						id="pisBranchName"
						value={data.pisBranchName || ""}
						onChange={(e) => onChange("pisBranchName", e.target.value)}
						data-testid="input-pis-branch"
					/>
				</div>
				<div className="space-y-2">
					<Label htmlFor="foreignBankAccountNumber">
						Foreign Bank Account Number *
					</Label>
					<Input
						id="foreignBankAccountNumber"
						value={data.foreignBankAccountNumber || ""}
						onChange={(e) =>
							onChange("foreignBankAccountNumber", e.target.value)
						}
						data-testid="input-foreign-account"
					/>
				</div>
				<div className="space-y-2">
					<Label htmlFor="foreignBankName">Foreign Bank Name *</Label>
					<Input
						id="foreignBankName"
						value={data.foreignBankName || ""}
						onChange={(e) => onChange("foreignBankName", e.target.value)}
						data-testid="input-foreign-bank"
					/>
				</div>
				<div className="grid grid-cols-2 gap-4">
					<div className="space-y-2">
						<Label htmlFor="foreignBankCountry">Foreign Bank Country *</Label>
						<Input
							id="foreignBankCountry"
							value={data.foreignBankCountry || ""}
							onChange={(e) => onChange("foreignBankCountry", e.target.value)}
							data-testid="input-foreign-country"
						/>
					</div>
					<div className="space-y-2">
						<Label htmlFor="swiftCode">SWIFT Code *</Label>
						<Input
							id="swiftCode"
							value={data.swiftCode || ""}
							onChange={(e) =>
								onChange("swiftCode", e.target.value.toUpperCase())
							}
							data-testid="input-swift"
						/>
					</div>
				</div>
			</div>

			<div className="flex justify-between">
				<Button variant="outline" onClick={onBack} data-testid="button-back">
					<ArrowLeft className="mr-2 h-4 w-4" /> Back
				</Button>
				<Button
					onClick={() => verifyPIS.mutate()}
					disabled={
						!data.pisPermissionLetterUrl ||
						!data.pisBankName ||
						!data.foreignBankAccountNumber
					}
					data-testid="button-next"
				>
					{verifyPIS.isPending ? (
						<Loader2 className="h-4 w-4 animate-spin mr-2" />
					) : null}
					Next <ArrowRight className="ml-2 h-4 w-4" />
				</Button>
			</div>
		</div>
	);
}

// Step 4: FATCA/CRS Declaration
function FATCAStep({ data, onChange, onNext, onBack }: StepProps) {
	const { toast } = useToast();

	const completeFATCA = useMutation({
		mutationFn: async () => {
			const response = await apiRequest("POST", "/api/kyc/nri/fatca", {
				body: {
					taxResidencyCountry: data.taxResidencyCountry,
					taxIdentificationNumber: data.taxIdentificationNumber,
					usCitizen: data.usCitizen || false,
					greenCardHolder: data.greenCardHolder || false,
					fatcaDeclarationUrl: data.fatcaDeclarationUrl,
					crsDeclarationUrl: data.crsDeclarationUrl,
				},
			});
			return response.json();
		},
		onSuccess: () => {
			toast({ title: "✅ FATCA/CRS Declaration Completed" });
			onNext();
		},
		onError: (error: any) => {
			toast({
				title: "Declaration Failed",
				description: error.message,
				variant: "destructive",
			});
		},
	});

	return (
		<div className="space-y-6 animate-in fade-in-50 duration-500">
			<div className="space-y-4">
				<div className="space-y-2">
					<Label htmlFor="taxResidencyCountry">Tax Residency Country *</Label>
					<Input
						id="taxResidencyCountry"
						value={data.taxResidencyCountry || ""}
						onChange={(e) => onChange("taxResidencyCountry", e.target.value)}
						data-testid="input-tax-country"
					/>
				</div>
				<div className="space-y-2">
					<Label htmlFor="taxIdentificationNumber">
						Tax Identification Number (TIN) *
					</Label>
					<Input
						id="taxIdentificationNumber"
						value={data.taxIdentificationNumber || ""}
						onChange={(e) =>
							onChange("taxIdentificationNumber", e.target.value)
						}
						data-testid="input-tin"
					/>
				</div>
				<div className="flex items-center space-x-2">
					<Checkbox
						id="usCitizen"
						checked={data.usCitizen || false}
						onCheckedChange={(checked) => onChange("usCitizen", checked)}
						data-testid="checkbox-us-citizen"
					/>
					<Label htmlFor="usCitizen">US Citizen</Label>
				</div>
				<div className="flex items-center space-x-2">
					<Checkbox
						id="greenCardHolder"
						checked={data.greenCardHolder || false}
						onCheckedChange={(checked) => onChange("greenCardHolder", checked)}
						data-testid="checkbox-green-card"
					/>
					<Label htmlFor="greenCardHolder">Green Card Holder</Label>
				</div>
				<div className="space-y-2">
					<Label htmlFor="fatcaDeclaration">
						FATCA Declaration (W8-BEN Form) *
					</Label>
					<Input
						id="fatcaDeclaration"
						type="file"
						onChange={(e) =>
							onChange("fatcaDeclarationUrl", e.target.files?.[0])
						}
						data-testid="input-fatca"
					/>
				</div>
				<div className="space-y-2">
					<Label htmlFor="crsDeclaration">CRS Declaration (Optional)</Label>
					<Input
						id="crsDeclaration"
						type="file"
						onChange={(e) => onChange("crsDeclarationUrl", e.target.files?.[0])}
						data-testid="input-crs"
					/>
				</div>
			</div>

			<div className="flex justify-between">
				<Button variant="outline" onClick={onBack} data-testid="button-back">
					<ArrowLeft className="mr-2 h-4 w-4" /> Back
				</Button>
				<Button
					onClick={() => completeFATCA.mutate()}
					disabled={
						!data.taxResidencyCountry ||
						!data.taxIdentificationNumber ||
						!data.fatcaDeclarationUrl
					}
					data-testid="button-next"
				>
					{completeFATCA.isPending ? (
						<Loader2 className="h-4 w-4 animate-spin mr-2" />
					) : null}
					Next <ArrowRight className="ml-2 h-4 w-4" />
				</Button>
			</div>
		</div>
	);
}

// Step 5: Review & Submit
function ReviewStep({ data, onBack }: StepProps) {
	const { toast } = useToast();
	const queryClient = useQueryClient();

	const confirmKYC = useMutation({
		mutationFn: async () => {
			const response = await apiRequest("POST", "/api/kyc/nri/confirm", {
				body: {
					nriStatus: data.nriStatus || "NRI",
					investmentType: data.investmentType || "repatriable",
				},
			});
			return response.json();
		},
		onSuccess: () => {
			toast({ title: "🎉 NRI KYC Completed Successfully!" });
			queryClient.invalidateQueries({ queryKey: ["/api/user/profile"] });
		},
		onError: (error: any) => {
			toast({
				title: "Submission Failed",
				description: error.message,
				variant: "destructive",
			});
		},
	});

	return (
		<div className="space-y-6 animate-in fade-in-50 duration-500">
			<Card>
				<CardHeader>
					<CardTitle>Review Your Information</CardTitle>
					<CardDescription>
						Please verify all details before submission
					</CardDescription>
				</CardHeader>
				<CardContent className="space-y-4">
					<div>
						<Label className="text-muted-foreground">Passport Number</Label>
						<p className="font-medium">{data.passportNumber}</p>
					</div>
					<div>
						<Label className="text-muted-foreground">
							Country of Residence
						</Label>
						<p className="font-medium">{data.countryOfResidence}</p>
					</div>
					<div>
						<Label className="text-muted-foreground">Tax Residency</Label>
						<p className="font-medium">{data.taxResidencyCountry}</p>
					</div>
					<div className="space-y-2">
						<Label htmlFor="nriStatus">NRI Status *</Label>
						<Select
							value={data.nriStatus || "NRI"}
							onValueChange={(value) => data.onChange("nriStatus", value)}
						>
							<SelectTrigger data-testid="select-nri-status">
								<SelectValue />
							</SelectTrigger>
							<SelectContent>
								<SelectItem value="NRI">NRI</SelectItem>
								<SelectItem value="PIO">PIO</SelectItem>
								<SelectItem value="OCI">OCI</SelectItem>
							</SelectContent>
						</Select>
					</div>
					<div className="space-y-2">
						<Label htmlFor="investmentType">Investment Type *</Label>
						<Select
							value={data.investmentType || "repatriable"}
							onValueChange={(value) => data.onChange("investmentType", value)}
						>
							<SelectTrigger data-testid="select-investment-type">
								<SelectValue />
							</SelectTrigger>
							<SelectContent>
								<SelectItem value="repatriable">Repatriable</SelectItem>
								<SelectItem value="non_repatriable">Non-Repatriable</SelectItem>
							</SelectContent>
						</Select>
					</div>
				</CardContent>
			</Card>

			<div className="flex justify-between">
				<Button variant="outline" onClick={onBack} data-testid="button-back">
					<ArrowLeft className="mr-2 h-4 w-4" /> Back
				</Button>
				<Button
					onClick={() => confirmKYC.mutate()}
					disabled={confirmKYC.isPending}
					data-testid="button-submit"
				>
					{confirmKYC.isPending ? (
						<Loader2 className="mr-2 h-4 w-4 animate-spin" />
					) : (
						<CheckCircle2 className="mr-2 h-4 w-4" />
					)}
					Submit KYC
				</Button>
			</div>
		</div>
	);
}

export function NRIKYCWizard() {
	const [currentStep, setCurrentStep] = useState(1);
	const [formData, setFormData] = useState<any>({});

	// Load progress on mount
	const progressQuery = useQuery({
		queryKey: ["/api/kyc/nri/progress"],
	});
	const progress: any = progressQuery.data;

	useEffect(() => {
		if (progress && !progress.isCompleted) {
			setCurrentStep(progress.currentStep || 1);
			setFormData(progress);
		}
	}, [progress]);

	const handleChange = (field: string, value: any) => {
		setFormData((prev: any) => ({ ...prev, [field]: value }));
	};

	const handleNext = () => {
		if (currentStep < steps.length) {
			setCurrentStep(currentStep + 1);
		}
	};

	const handleBack = () => {
		if (currentStep > 1) {
			setCurrentStep(currentStep - 1);
		}
	};

	const stepProps: StepProps = {
		data: formData,
		onChange: handleChange,
		onNext: handleNext,
		onBack: handleBack,
		isFirst: currentStep === 1,
		isLast: currentStep === steps.length,
	};

	const currentStepComponent = () => {
		switch (currentStep) {
			case 1:
				return <PassportPANStep {...stepProps} />;
			case 2:
				return <OverseasAddressStep {...stepProps} />;
			case 3:
				return <PISBankStep {...stepProps} />;
			case 4:
				return <FATCAStep {...stepProps} />;
			case 5:
				return <ReviewStep {...stepProps} />;
			default:
				return null;
		}
	};

	const progressPercentage = (currentStep / steps.length) * 100;

	return (
		<div className="max-w-4xl mx-auto p-6 space-y-8">
			<div>
				<h2 className="text-3xl font-bold">NRI KYC</h2>
				<p className="text-muted-foreground">
					Complete your Non-Resident Indian verification
				</p>
			</div>

			{/* Progress Bar */}
			<div className="space-y-2">
				<div className="flex justify-between text-sm">
					<span>
						Step {currentStep} of {steps.length}
					</span>
					<span>{Math.round(progressPercentage)}% Complete</span>
				</div>
				<Progress value={progressPercentage} className="h-2" />
			</div>

			{/* Steps Indicator */}
			<div className="flex justify-between">
				{steps.map((step) => {
					const StepIcon = step.icon;
					const isActive = step.id === currentStep;
					const isCompleted = step.id < currentStep;

					return (
						<div
							key={step.id}
							className="flex flex-col items-center gap-2 flex-1"
						>
							<div
								className={cn(
									"w-10 h-10 rounded-full flex items-center justify-center border-2 transition-colors",
									isCompleted
										? "bg-primary border-primary text-primary-foreground"
										: isActive
											? "border-primary text-primary"
											: "border-muted text-muted-foreground",
								)}
							>
								{isCompleted ? (
									<CheckCircle2 className="h-5 w-5" />
								) : (
									<StepIcon className="h-5 w-5" />
								)}
							</div>
							<div className="text-xs text-center max-w-[80px]">
								<div className={cn("font-medium", isActive && "text-primary")}>
									{step.name}
								</div>
							</div>
						</div>
					);
				})}
			</div>

			{/* Current Step Component */}
			<Card>
				<CardHeader>
					<CardTitle>{steps[currentStep - 1].name}</CardTitle>
					<CardDescription>
						{steps[currentStep - 1].description}
					</CardDescription>
				</CardHeader>
				<CardContent>{currentStepComponent()}</CardContent>
			</Card>
		</div>
	);
}
