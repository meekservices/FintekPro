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
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import {
	CheckCircle2,
	Circle,
	Loader2,
	ArrowRight,
	ArrowLeft,
	Shield as LucideShield,
	User,
	MapPin,
	CreditCard,
	FileText,
	Eye,
	Sparkles,
	Save,
	Check,
} from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/hooks/useAuth";
import { Progress } from "@/components/ui/progress";
import type { KycFormProgress } from "@shared/schema";
import { cn } from "@/lib/utils";

interface StepProps {
	data: any;
	onChange: (field: string, value: any) => void;
	onNext: () => void;
	onBack: () => void;
	isFirst: boolean;
	isLast: boolean;
	onAutoPopulate?: (source: string, data: any) => void;
	autoPopulatedFields?: Record<string, string>;
}

// Helper component for auto-populated field indicator
function AutoPopulatedBadge({ source }: { source?: string }) {
	if (!source) return null;

	const sourceConfig = {
		digilocker: {
			label: "DigiLocker",
			className:
				"bg-green-500/10 text-green-700 dark:text-green-400 border-green-500/20",
		},
		bse_star: {
			label: "BSE Star",
			className:
				"bg-blue-500/10 text-blue-700 dark:text-blue-400 border-blue-500/20",
		},
	};

	const config = sourceConfig[source as keyof typeof sourceConfig];
	if (!config) return null;

	return (
		<Badge variant="outline" className={cn("ml-2 text-xs", config.className)}>
			<Sparkles className="h-3 w-3 mr-1" />
			{config.label}
		</Badge>
	);
}

const steps = [
	{
		id: 1,
		name: "Personal Details",
		icon: User,
		description: "Basic information",
	},
	{
		id: 2,
		name: "Address & Contact",
		icon: MapPin,
		description: "Where you live",
	},
	{
		id: 3,
		name: "Bank Details",
		icon: CreditCard,
		description: "Account information",
	},
	{ id: 4, name: "Documents", icon: FileText, description: "Upload documents" },
	{ id: 5, name: "Review & Submit", icon: Eye, description: "Final review" },
];

// Step 1: Personal Details
function PersonalDetailsStep({
	data,
	onChange,
	onNext,
	isFirst,
	onAutoPopulate,
	autoPopulatedFields,
}: StepProps) {
	const { toast } = useToast();
	const [isVerifying, setIsVerifying] = useState(false);

	const handlePANBlur = async () => {
		if (!data.pan || data.pan.length !== 10) return;

		setIsVerifying(true);
		try {
			const result = await apiRequest("/api/bse-star-kyc/verify-pan", {
				method: "POST",
				body: JSON.stringify({ panNumber: data.pan }),
			});

			if (result.success && result.data) {
				const autoData: Record<string, any> = {
					fullName: result.data.name || data.fullName,
					dateOfBirth: result.data.dob || data.dateOfBirth,
					fatherName: result.data.fatherName || data.fatherName,
				};

				Object.keys(autoData).forEach((key) => {
					if (autoData[key] && autoData[key] !== data[key]) {
						onChange(key, autoData[key]);
					}
				});

				if (onAutoPopulate) {
					onAutoPopulate("bse_star", autoData);
				}

				toast({
					title: "✨ Auto-filled from BSE Star",
					description: "Personal details populated successfully",
				});
			}
		} catch (error) {
			console.error("PAN verification failed:", error);
		} finally {
			setIsVerifying(false);
		}
	};

	return (
		<div className="space-y-6 animate-in fade-in-50 duration-500">
			<div className="space-y-4">
				<div className="grid gap-4">
					<div className="space-y-2">
						<Label htmlFor="pan">PAN Number *</Label>
						<Input
							id="pan"
							data-testid="input-pan"
							placeholder="ABCDE1234F"
							value={data.pan || ""}
							onChange={(e) => onChange("pan", e.target.value.toUpperCase())}
							onBlur={handlePANBlur}
							maxLength={10}
							className="uppercase transition-all"
						/>
						{isVerifying && (
							<p className="text-sm text-muted-foreground flex items-center gap-2 animate-in fade-in-50">
								<Loader2 className="h-3 w-3 animate-spin" />
								Fetching details from BSE Star...
							</p>
						)}
					</div>

					<div className="space-y-2">
						<div className="flex items-center">
							<Label htmlFor="fullName">Full Name *</Label>
							<AutoPopulatedBadge source={autoPopulatedFields?.fullName} />
						</div>
						<Input
							id="fullName"
							data-testid="input-fullname"
							placeholder="As per PAN card"
							value={data.fullName || ""}
							onChange={(e) => onChange("fullName", e.target.value)}
							className={cn(
								"transition-all",
								autoPopulatedFields?.fullName && "border-blue-500/50",
							)}
						/>
					</div>

					<div className="space-y-2">
						<div className="flex items-center">
							<Label htmlFor="dateOfBirth">Date of Birth *</Label>
							<AutoPopulatedBadge source={autoPopulatedFields?.dateOfBirth} />
						</div>
						<Input
							id="dateOfBirth"
							data-testid="input-dob"
							type="date"
							value={data.dateOfBirth || ""}
							onChange={(e) => onChange("dateOfBirth", e.target.value)}
							className={cn(
								"transition-all",
								autoPopulatedFields?.dateOfBirth && "border-blue-500/50",
							)}
						/>
					</div>

					<div className="space-y-2">
						<div className="flex items-center">
							<Label htmlFor="fatherName">Father's Name</Label>
							<AutoPopulatedBadge source={autoPopulatedFields?.fatherName} />
						</div>
						<Input
							id="fatherName"
							data-testid="input-fathername"
							placeholder="Father's full name"
							value={data.fatherName || ""}
							onChange={(e) => onChange("fatherName", e.target.value)}
							className={cn(
								"transition-all",
								autoPopulatedFields?.fatherName && "border-blue-500/50",
							)}
						/>
					</div>

					<div className="space-y-2">
						<Label htmlFor="gender">Gender *</Label>
						<Select
							value={data.gender || ""}
							onValueChange={(value) => onChange("gender", value)}
						>
							<SelectTrigger data-testid="select-gender">
								<SelectValue placeholder="Select gender" />
							</SelectTrigger>
							<SelectContent>
								<SelectItem value="M">Male</SelectItem>
								<SelectItem value="F">Female</SelectItem>
								<SelectItem value="T">Other</SelectItem>
							</SelectContent>
						</Select>
					</div>
				</div>
			</div>

			<Button
				onClick={onNext}
				disabled={
					!data.pan || !data.fullName || !data.dateOfBirth || !data.gender
				}
				className="w-full"
				data-testid="button-next-personal"
			>
				Continue to Address <ArrowRight className="ml-2 h-4 w-4" />
			</Button>
		</div>
	);
}

// Step 2: Address & Contact
function AddressStep({
	data,
	onChange,
	onNext,
	onBack,
	onAutoPopulate,
	autoPopulatedFields,
}: StepProps) {
	const { toast } = useToast();
	const [isVerifying, setIsVerifying] = useState(false);

	const handleAadhaarBlur = async () => {
		if (!data.aadhar || data.aadhar.length !== 12) return;

		setIsVerifying(true);
		try {
			// Try DigiLocker first
			const result = await apiRequest("/api/digilocker/fetch-aadhaar", {
				method: "POST",
				body: JSON.stringify({ aadhaarNumber: data.aadhar }),
			});

			if (result.success && result.data) {
				const autoData: Record<string, any> = {
					address: result.data.address || data.address,
					city: result.data.city || data.city,
					state: result.data.state || data.state,
					pincode: result.data.pincode || data.pincode,
				};

				Object.keys(autoData).forEach((key) => {
					if (autoData[key] && autoData[key] !== data[key]) {
						onChange(key, autoData[key]);
					}
				});

				if (onAutoPopulate) {
					onAutoPopulate("digilocker", autoData);
				}

				toast({
					title: "✨ Auto-filled from DigiLocker",
					description: "Address details populated successfully",
				});
			}
		} catch (error) {
			console.error("Aadhaar verification failed:", error);
			// Fallback to BSE Star if DigiLocker fails
			try {
				const fallbackResult = await apiRequest(
					"/api/bse-star-kyc/auto-populate",
					{
						method: "POST",
						body: JSON.stringify({ aadhaarNumber: data.aadhar }),
					},
				);

				if (fallbackResult.success && fallbackResult.data) {
					// Apply fallback data to state
					const fallbackAutoData: Record<string, any> = {
						address: fallbackResult.data.address || data.address,
						city: fallbackResult.data.city || data.city,
						state: fallbackResult.data.state || data.state,
						pincode: fallbackResult.data.pincode || data.pincode,
					};

					Object.keys(fallbackAutoData).forEach((key) => {
						if (fallbackAutoData[key] && fallbackAutoData[key] !== data[key]) {
							onChange(key, fallbackAutoData[key]);
						}
					});

					if (onAutoPopulate) {
						onAutoPopulate("bse_star", fallbackAutoData);
					}

					toast({
						title: "✨ Auto-filled from BSE Star",
						description: "Address details populated via fallback",
					});
				}
			} catch (fallbackError) {
				console.error("Fallback also failed:", fallbackError);
			}
		} finally {
			setIsVerifying(false);
		}
	};

	return (
		<div className="space-y-6 animate-in fade-in-50 duration-500">
			<div className="space-y-4">
				<div className="space-y-2">
					<Label htmlFor="aadhar">Aadhaar Number (Optional)</Label>
					<Input
						id="aadhar"
						data-testid="input-aadhar"
						placeholder="XXXX XXXX XXXX"
						value={data.aadhar || ""}
						onChange={(e) =>
							onChange("aadhar", e.target.value.replace(/\s/g, ""))
						}
						onBlur={handleAadhaarBlur}
						maxLength={12}
						className="transition-all"
					/>
					{isVerifying && (
						<p className="text-sm text-muted-foreground flex items-center gap-2">
							<Loader2 className="h-3 w-3 animate-spin" />
							Fetching address from DigiLocker...
						</p>
					)}
				</div>

				<div className="space-y-2">
					<div className="flex items-center">
						<Label htmlFor="address">Address *</Label>
						<AutoPopulatedBadge source={autoPopulatedFields?.address} />
					</div>
					<Input
						id="address"
						data-testid="input-address"
						placeholder="House no., Street, Area"
						value={data.address || ""}
						onChange={(e) => onChange("address", e.target.value)}
						className={cn(
							"transition-all",
							(autoPopulatedFields?.address === "digilocker" &&
								"border-green-500/50") ||
								(autoPopulatedFields?.address === "bse_star" &&
									"border-blue-500/50"),
						)}
					/>
				</div>

				<div className="grid grid-cols-2 gap-4">
					<div className="space-y-2">
						<div className="flex items-center">
							<Label htmlFor="city">City *</Label>
							<AutoPopulatedBadge source={autoPopulatedFields?.city} />
						</div>
						<Input
							id="city"
							data-testid="input-city"
							value={data.city || ""}
							onChange={(e) => onChange("city", e.target.value)}
							className={cn(
								"transition-all",
								(autoPopulatedFields?.city === "digilocker" &&
									"border-green-500/50") ||
									(autoPopulatedFields?.city === "bse_star" &&
										"border-blue-500/50"),
							)}
						/>
					</div>

					<div className="space-y-2">
						<div className="flex items-center">
							<Label htmlFor="state">State *</Label>
							<AutoPopulatedBadge source={autoPopulatedFields?.state} />
						</div>
						<Input
							id="state"
							data-testid="input-state"
							value={data.state || ""}
							onChange={(e) => onChange("state", e.target.value)}
							className={cn(
								"transition-all",
								(autoPopulatedFields?.state === "digilocker" &&
									"border-green-500/50") ||
									(autoPopulatedFields?.state === "bse_star" &&
										"border-blue-500/50"),
							)}
						/>
					</div>
				</div>

				<div className="grid grid-cols-2 gap-4">
					<div className="space-y-2">
						<div className="flex items-center">
							<Label htmlFor="pincode">Pincode *</Label>
							<AutoPopulatedBadge source={autoPopulatedFields?.pincode} />
						</div>
						<Input
							id="pincode"
							data-testid="input-pincode"
							maxLength={6}
							value={data.pincode || ""}
							onChange={(e) => onChange("pincode", e.target.value)}
							className={cn(
								"transition-all",
								(autoPopulatedFields?.pincode === "digilocker" &&
									"border-green-500/50") ||
									(autoPopulatedFields?.pincode === "bse_star" &&
										"border-blue-500/50"),
							)}
						/>
					</div>

					<div className="space-y-2">
						<Label htmlFor="mobile">Mobile *</Label>
						<Input
							id="mobile"
							data-testid="input-mobile"
							maxLength={10}
							value={data.mobile || ""}
							onChange={(e) => onChange("mobile", e.target.value)}
						/>
					</div>
				</div>

				<div className="space-y-2">
					<Label htmlFor="email">Email *</Label>
					<Input
						id="email"
						data-testid="input-email"
						type="email"
						value={data.email || ""}
						onChange={(e) => onChange("email", e.target.value)}
					/>
				</div>
			</div>

			<div className="flex gap-4">
				<Button
					variant="outline"
					onClick={onBack}
					className="flex-1"
					data-testid="button-back-address"
				>
					<ArrowLeft className="mr-2 h-4 w-4" /> Back
				</Button>
				<Button
					onClick={onNext}
					disabled={
						!data.address ||
						!data.city ||
						!data.state ||
						!data.pincode ||
						!data.mobile ||
						!data.email
					}
					className="flex-1"
					data-testid="button-next-address"
				>
					Continue to Bank Details <ArrowRight className="ml-2 h-4 w-4" />
				</Button>
			</div>
		</div>
	);
}

// Step 3: Bank Details
function BankDetailsStep({ data, onChange, onNext, onBack }: StepProps) {
	return (
		<div className="space-y-6">
			<div className="space-y-4">
				<div className="space-y-2">
					<Label htmlFor="bankName">Bank Name *</Label>
					<Input
						id="bankName"
						data-testid="input-bankname"
						placeholder="e.g., HDFC Bank"
						value={data.bankName || ""}
						onChange={(e) => onChange("bankName", e.target.value)}
					/>
				</div>

				<div className="space-y-2">
					<Label htmlFor="accountNumber">Account Number *</Label>
					<Input
						id="accountNumber"
						data-testid="input-accountnumber"
						placeholder="Enter account number"
						value={data.accountNumber || ""}
						onChange={(e) => onChange("accountNumber", e.target.value)}
					/>
				</div>

				<div className="space-y-2">
					<Label htmlFor="ifscCode">IFSC Code *</Label>
					<Input
						id="ifscCode"
						data-testid="input-ifsc"
						placeholder="e.g., HDFC0001234"
						value={data.ifscCode || ""}
						onChange={(e) => onChange("ifscCode", e.target.value.toUpperCase())}
						maxLength={11}
						className="uppercase"
					/>
				</div>

				<div className="space-y-2">
					<Label htmlFor="accountType">Account Type *</Label>
					<Select
						value={data.accountType || ""}
						onValueChange={(value) => onChange("accountType", value)}
					>
						<SelectTrigger data-testid="select-accounttype">
							<SelectValue placeholder="Select account type" />
						</SelectTrigger>
						<SelectContent>
							<SelectItem value="savings">Savings</SelectItem>
							<SelectItem value="current">Current</SelectItem>
							<SelectItem value="nro">NRO</SelectItem>
							<SelectItem value="nre">NRE</SelectItem>
						</SelectContent>
					</Select>
				</div>
			</div>

			<div className="flex gap-4">
				<Button
					variant="outline"
					onClick={onBack}
					className="flex-1"
					data-testid="button-back-bank"
				>
					<ArrowLeft className="mr-2 h-4 w-4" /> Back
				</Button>
				<Button
					onClick={onNext}
					disabled={
						!data.bankName ||
						!data.accountNumber ||
						!data.ifscCode ||
						!data.accountType
					}
					className="flex-1"
					data-testid="button-next-bank"
				>
					Continue to Documents <ArrowRight className="ml-2 h-4 w-4" />
				</Button>
			</div>
		</div>
	);
}

// Step 4: Documents
function DocumentsStep({ data, onChange, onNext, onBack }: StepProps) {
	return (
		<div className="space-y-6">
			<div className="space-y-4">
				<div className="p-4 border-2 border-dashed rounded-lg text-center">
					<FileText className="mx-auto h-12 w-12 text-muted-foreground mb-2" />
					<p className="text-sm text-muted-foreground">
						Document upload will be implemented with DigiLocker integration
					</p>
				</div>
			</div>

			<div className="flex gap-4">
				<Button
					variant="outline"
					onClick={onBack}
					className="flex-1"
					data-testid="button-back-documents"
				>
					<ArrowLeft className="mr-2 h-4 w-4" /> Back
				</Button>
				<Button
					onClick={onNext}
					className="flex-1"
					data-testid="button-next-documents"
				>
					Continue to Review <ArrowRight className="ml-2 h-4 w-4" />
				</Button>
			</div>
		</div>
	);
}

// Step 5: Review & Submit
function ReviewStep({ data, onBack, isLast, autoPopulatedFields }: StepProps) {
	const [isSubmitting, setIsSubmitting] = useState(false);
	const { toast } = useToast();
	const queryClient = useQueryClient();

	const handleSubmit = async () => {
		setIsSubmitting(true);
		try {
			// Submit KYC data
			await apiRequest("/api/ckyc", {
				method: "POST",
				body: JSON.stringify({
					pan: data.pan,
					aadhar: data.aadhar,
					fullName: data.fullName,
					dateOfBirth: data.dateOfBirth,
					gender: data.gender,
					fatherName: data.fatherName,
					address: data.address,
					city: data.city,
					state: data.state,
					pincode: data.pincode,
					mobile: data.mobile,
					email: data.email,
				}),
			});

			// Submit bank details
			await apiRequest("/api/user-bank-accounts", {
				method: "POST",
				body: JSON.stringify({
					bankName: data.bankName,
					accountNumber: data.accountNumber,
					ifscCode: data.ifscCode,
					accountType: data.accountType,
				}),
			});

			// Mark progress as completed
			await apiRequest("/api/kyc-progress", {
				method: "PUT",
				body: JSON.stringify({
					isCompleted: true,
					completedAt: new Date().toISOString(),
				}),
			});

			toast({
				title: "✅ KYC Submitted Successfully",
				description: "Your verification is under review",
			});

			queryClient.invalidateQueries({ queryKey: ["/api/ckyc"] });
			queryClient.invalidateQueries({ queryKey: ["/api/kyc-progress"] });
		} catch (error) {
			toast({
				title: "Submission Failed",
				description: (error as Error).message,
				variant: "destructive",
			});
		} finally {
			setIsSubmitting(false);
		}
	};

	return (
		<div className="space-y-6 animate-in fade-in-50 duration-500">
			{/* Personal Details Section */}
			<div className="rounded-lg border bg-card p-4 space-y-3">
				<div className="flex items-center gap-2">
					<User className="h-5 w-5 text-primary" />
					<h3 className="font-semibold">Personal Details</h3>
				</div>
				<div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
					<div className="flex justify-between">
						<span className="text-muted-foreground">PAN:</span>
						<span className="font-medium">{data.pan}</span>
					</div>
					<div className="flex justify-between items-center">
						<span className="text-muted-foreground">Name:</span>
						<div className="flex items-center gap-1">
							<span className="font-medium">{data.fullName}</span>
							<AutoPopulatedBadge source={autoPopulatedFields?.fullName} />
						</div>
					</div>
					<div className="flex justify-between items-center">
						<span className="text-muted-foreground">DOB:</span>
						<div className="flex items-center gap-1">
							<span className="font-medium">{data.dateOfBirth}</span>
							<AutoPopulatedBadge source={autoPopulatedFields?.dateOfBirth} />
						</div>
					</div>
					<div className="flex justify-between">
						<span className="text-muted-foreground">Gender:</span>
						<span className="font-medium">
							{data.gender === "M"
								? "Male"
								: data.gender === "F"
									? "Female"
									: "Other"}
						</span>
					</div>
				</div>
			</div>

			{/* Address Section */}
			<div className="rounded-lg border bg-card p-4 space-y-3">
				<div className="flex items-center gap-2">
					<MapPin className="h-5 w-5 text-primary" />
					<h3 className="font-semibold">Address & Contact</h3>
				</div>
				<div className="space-y-2 text-sm">
					<div className="flex justify-between items-start">
						<span className="text-muted-foreground">Address:</span>
						<div className="flex items-center gap-1 text-right">
							<span className="font-medium">{data.address}</span>
							<AutoPopulatedBadge source={autoPopulatedFields?.address} />
						</div>
					</div>
					<div className="flex justify-between items-center">
						<span className="text-muted-foreground">City:</span>
						<div className="flex items-center gap-1">
							<span className="font-medium">{data.city}</span>
							<AutoPopulatedBadge source={autoPopulatedFields?.city} />
						</div>
					</div>
					<div className="flex justify-between items-center">
						<span className="text-muted-foreground">State:</span>
						<div className="flex items-center gap-1">
							<span className="font-medium">{data.state}</span>
							<AutoPopulatedBadge source={autoPopulatedFields?.state} />
						</div>
					</div>
					<div className="flex justify-between items-center">
						<span className="text-muted-foreground">Pincode:</span>
						<div className="flex items-center gap-1">
							<span className="font-medium">{data.pincode}</span>
							<AutoPopulatedBadge source={autoPopulatedFields?.pincode} />
						</div>
					</div>
					<div className="flex justify-between">
						<span className="text-muted-foreground">Mobile:</span>
						<span className="font-medium">{data.mobile}</span>
					</div>
					<div className="flex justify-between">
						<span className="text-muted-foreground">Email:</span>
						<span className="font-medium">{data.email}</span>
					</div>
				</div>
			</div>

			{/* Bank Details Section */}
			<div className="rounded-lg border bg-card p-4 space-y-3">
				<div className="flex items-center gap-2">
					<CreditCard className="h-5 w-5 text-primary" />
					<h3 className="font-semibold">Bank Details</h3>
				</div>
				<div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
					<div className="flex justify-between">
						<span className="text-muted-foreground">Bank:</span>
						<span className="font-medium">{data.bankName}</span>
					</div>
					<div className="flex justify-between">
						<span className="text-muted-foreground">Account:</span>
						<span className="font-medium">{data.accountNumber}</span>
					</div>
					<div className="flex justify-between">
						<span className="text-muted-foreground">IFSC:</span>
						<span className="font-medium">{data.ifscCode}</span>
					</div>
					<div className="flex justify-between">
						<span className="text-muted-foreground">Type:</span>
						<span className="font-medium">{data.accountType}</span>
					</div>
				</div>
			</div>

			<div className="flex gap-4">
				<Button
					variant="outline"
					onClick={onBack}
					className="flex-1"
					data-testid="button-back-review"
				>
					<ArrowLeft className="mr-2 h-4 w-4" /> Back
				</Button>
				<Button
					onClick={handleSubmit}
					disabled={isSubmitting}
					className="flex-1"
					data-testid="button-submit-kyc"
				>
					{isSubmitting ? (
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

// Main Wizard Component
export function MultiStepKYCWizard() {
	const { user } = useAuth();
	const userId = user?.id || "";
	const [currentStep, setCurrentStep] = useState(1);
	const [formData, setFormData] = useState<any>({});
	const [autoPopulatedFields, setAutoPopulatedFields] = useState<any>({});
	const queryClient = useQueryClient();

	// Load saved progress
	const { data: progress } = useQuery<KycFormProgress>({
		queryKey: ["/api/kyc-progress"],
		retry: false,
	});

	// Load backend-verified KYC milestone percentage
	const { data: kycStatus } = useQuery<{ percentComplete: number }>({
		queryKey: ["/api/kyc/notification-status"],
		retry: false,
		select: (d: any) => ({ percentComplete: d?.percentComplete ?? 0 }),
	});

	// Auto-save mutation
	const saveProgressMutation = useMutation({
		mutationFn: async (data: any) => {
			await apiRequest("/api/kyc-progress", {
				method: "PUT",
				body: JSON.stringify(data),
			});
		},
	});

	// Load progress on mount
	useEffect(() => {
		if (progress) {
			setCurrentStep(progress.currentStep || 1);
			setFormData({
				...(progress.personalDetailsData || {}),
				...(progress.addressDetailsData || {}),
				...(progress.bankDetailsData || {}),
			});
		}
	}, [progress]);

	// Auto-save whenever formData changes
	useEffect(() => {
		const timer = setTimeout(() => {
			if (Object.keys(formData).length > 0) {
				const stepData = {
					currentStep,
					completedSteps: Array.from(
						{ length: currentStep - 1 },
						(_, i) => i + 1,
					),
					completionPercentage: ((currentStep - 1) / steps.length) * 100,
					personalDetailsData:
						currentStep >= 1
							? {
									pan: formData.pan,
									fullName: formData.fullName,
									dateOfBirth: formData.dateOfBirth,
									gender: formData.gender,
									fatherName: formData.fatherName,
								}
							: null,
					addressDetailsData:
						currentStep >= 2
							? {
									aadhar: formData.aadhar,
									address: formData.address,
									city: formData.city,
									state: formData.state,
									pincode: formData.pincode,
									mobile: formData.mobile,
									email: formData.email,
								}
							: null,
					bankDetailsData:
						currentStep >= 3
							? {
									bankName: formData.bankName,
									accountNumber: formData.accountNumber,
									ifscCode: formData.ifscCode,
									accountType: formData.accountType,
								}
							: null,
					autoPopulatedFields,
					lastSavedAt: new Date().toISOString(),
				};

				saveProgressMutation.mutate(stepData);
			}
		}, 2000); // Debounce for 2 seconds

		return () => clearTimeout(timer);
	}, [formData, currentStep, autoPopulatedFields]);

	const handleFieldChange = (field: string, value: any) => {
		setFormData((prev: any) => ({ ...prev, [field]: value }));
	};

	const handleAutoPopulate = (source: string, data: any) => {
		const fieldSources: Record<string, string> = {};
		Object.keys(data).forEach((key) => {
			if (data[key]) {
				fieldSources[key] = source;
			}
		});
		setAutoPopulatedFields((prev: any) => ({ ...prev, ...fieldSources }));
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

	const CurrentStepComponent = [
		PersonalDetailsStep,
		AddressStep,
		BankDetailsStep,
		DocumentsStep,
		ReviewStep,
	][currentStep - 1];

	return (
		<div className="max-w-4xl mx-auto space-y-6 p-4 md:p-6">
			{/* Header */}
			<div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-primary/10 via-primary/5 to-background p-6 md:p-8 border">
				<div className="flex items-center gap-4">
					<div className="p-3 rounded-xl bg-primary/10 backdrop-blur-sm">
						<LucideShield className="h-8 w-8 text-primary" />
					</div>
					<div>
						<h1 className="text-2xl md:text-3xl font-bold bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent">
							Complete Your KYC
						</h1>
						<p className="text-sm md:text-base text-muted-foreground mt-1">
							Quick and secure verification process
						</p>
					</div>
				</div>
			</div>

			{/* Progress */}
			<div className="space-y-3">
				<div className="flex items-center justify-between">
					<p className="text-sm font-medium">
						Step {currentStep} of {steps.length}
					</p>
					<p className="text-sm font-medium text-primary">
						{kycStatus?.percentComplete ?? 0}% Verified
					</p>
				</div>
				<Progress value={kycStatus?.percentComplete ?? 0} className="h-2.5" />
			</div>

			{/* Stepper */}
			<div className="flex justify-between items-start gap-2 overflow-x-auto pb-2">
				{steps.map((step, index) => {
					const Icon = step.icon;
					const isCompleted = currentStep > step.id;
					const isCurrent = currentStep === step.id;

					return (
						<div
							key={step.id}
							className="flex flex-col items-center flex-1 min-w-[80px]"
						>
							<div
								className={cn(
									"flex items-center justify-center w-12 h-12 rounded-full border-2 mb-2 transition-all duration-300",
									isCompleted &&
										"bg-primary border-primary text-primary-foreground shadow-md",
									isCurrent &&
										"border-primary text-primary shadow-lg scale-110",
									!isCompleted &&
										!isCurrent &&
										"border-muted-foreground/30 text-muted-foreground",
								)}
							>
								{isCompleted ? (
									<CheckCircle2 className="h-5 w-5 animate-in zoom-in-50" />
								) : (
									<Icon className="h-5 w-5" />
								)}
							</div>
							<p
								className={cn(
									"text-xs font-medium text-center transition-colors line-clamp-2",
									isCurrent && "text-primary font-semibold",
									!isCurrent && "text-muted-foreground",
								)}
							>
								{step.name}
							</p>
						</div>
					);
				})}
			</div>

			{/* Current Step */}
			<Card>
				<CardHeader>
					<CardTitle>{steps[currentStep - 1].name}</CardTitle>
					<CardDescription>
						{steps[currentStep - 1].description}
					</CardDescription>
				</CardHeader>
				<CardContent>
					<CurrentStepComponent
						data={formData}
						onChange={handleFieldChange}
						onNext={handleNext}
						onBack={handleBack}
						isFirst={currentStep === 1}
						isLast={currentStep === steps.length}
						onAutoPopulate={handleAutoPopulate}
						autoPopulatedFields={autoPopulatedFields}
					/>
				</CardContent>
			</Card>

			{/* Auto-save indicator */}
			<div className="fixed bottom-6 right-6 z-50">
				{saveProgressMutation.isPending && (
					<div className="bg-background border shadow-lg rounded-lg px-4 py-2 flex items-center gap-2 animate-in fade-in-50 slide-in-from-bottom-5">
						<Save className="h-4 w-4 text-muted-foreground animate-pulse" />
						<p className="text-sm text-muted-foreground">Saving...</p>
					</div>
				)}
				{saveProgressMutation.isSuccess && !saveProgressMutation.isPending && (
					<div className="bg-background border shadow-lg rounded-lg px-4 py-2 flex items-center gap-2 animate-in fade-in-50 slide-in-from-bottom-5">
						<Check className="h-4 w-4 text-green-600" />
						<p className="text-sm text-green-600 font-medium">Saved</p>
					</div>
				)}
			</div>
		</div>
	);
}
