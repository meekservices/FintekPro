import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery } from "@tanstack/react-query";
import { z } from "zod";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useAuth } from "@/hooks/useAuth";
import {
	User,
	Shield as LucideShield,
	CreditCard,
	Building,
	TrendingUp,
	Database,
	FileText,
	Eye,
	Phone,
	Mail,
	Users,
	Link,
	Info,
	Loader2,
	CheckCircle,
	Lock,
} from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { usePanConsent } from "@/hooks/use-pan-consent";
import { PANDataDashboard } from "@/components/pan-data-dashboard";
import { ReCKYCWorkflow } from "@/components/re-ckyc-workflow";
import { RiskAssessment } from "@/components/wealth/risk-assessment";

const profileSchema = z
	.object({
		// Enhanced KYC Fields - Mandatory as per SEBI
		panNumber: z
			.string()
			.regex(/^[A-Z]{5}[0-9]{4}[A-Z]{1}$/, "Invalid PAN format")
			.optional()
			.or(z.literal("")),
		panConsentGiven: z.boolean().optional(),
		aadharNumber: z
			.string()
			.regex(/^[0-9]{12}$/, "Aadhaar must be 12 digits")
			.optional()
			.or(z.literal("")),
		passportNumber: z.string().optional(),
		drivingLicense: z.string().optional(),
		voterIdNumber: z.string().optional(),
		dateOfBirth: z.string().optional(),
		nationality: z.string().optional(),
		fatherName: z.string().optional(),
		motherName: z.string().optional(),
		spouseName: z.string().optional(),
		maritalStatus: z.string().optional(),

		// Residency Status - Critical for NRI Compliance
		residentStatus: z.string().optional(),
		countryOfResidence: z.string().optional(),
		taxResidencyCountry: z.string().optional(),

		// Address Information
		address: z.string().optional(),
		city: z.string().optional(),
		state: z.string().optional(),
		pincode: z
			.string()
			.regex(/^[0-9]{6}$/, "Pincode must be 6 digits")
			.optional()
			.or(z.literal("")),
		country: z.string().optional(),

		// Financial Information - Enhanced for Compliance
		occupation: z.string().optional(),
		annualIncome: z.string().optional(),
		investmentExperience: z.string().optional(),
		riskTolerance: z.string().optional(),
		sourceOfWealth: z.string().optional(),

		// FATCA Compliance Fields
		fatcaStatus: z.string().optional(),
		fatcaTinNumber: z.string().optional(),
		fatcaCountryOfTaxResidence: z.string().optional(),

		// PEP Status
		pepStatus: z.string().optional(),
		pepDetails: z.string().optional(),

		// UBO Information
		isUbo: z.boolean().optional(),
		uboDetails: z.string().optional(),

		// API Integration (read-only, auto-populated from agent)
		euinNumber: z.string().optional(),
		arnCode: z.string().optional(),
		distributorId: z.string().optional(),
	})
	.refine(
		(data) => {
			// If PAN is provided, consent must be given (unless already recorded)
			if (data.panNumber && data.panNumber.length === 10) {
				return data.panConsentGiven === true;
			}
			return true;
		},
		{
			message: "PAN verification consent is required when providing PAN number",
			path: ["panConsentGiven"],
		},
	);

type ProfileFormData = z.infer<typeof profileSchema>;

type ProfileData = {
	// Enhanced KYC Fields
	panNumber?: string | null;
	panVerificationConsent?: boolean;
	panConsentGivenAt?: Date | null;
	aadharNumber?: string | null;
	passportNumber?: string | null;
	drivingLicense?: string | null;
	voterIdNumber?: string | null;
	dateOfBirth?: string | null;
	nationality?: string | null;
	fatherName?: string | null;
	motherName?: string | null;
	spouseName?: string | null;
	maritalStatus?: string | null;

	// Residency Status
	residentStatus?: string | null;
	countryOfResidence?: string | null;
	taxResidencyCountry?: string | null;

	// Address Information
	address?: string | null;
	city?: string | null;
	state?: string | null;
	pincode?: string | null;
	country?: string | null;

	// Financial Information
	occupation?: string | null;
	annualIncome?: string | null;
	investmentExperience?: string | null;
	riskTolerance?: string | null;
	sourceOfWealth?: string | null;

	// FATCA Compliance
	fatcaStatus?: string | null;
	fatcaTinNumber?: string | null;
	fatcaCountryOfTaxResidence?: string | null;

	// PEP Status
	pepStatus?: string | null;
	pepDetails?: string | null;

	// UBO Information
	isUbo?: boolean | null;
	uboDetails?: string | null;

	// API Integration (auto-populated from agent)
	euinNumber?: string | null;
	arnCode?: string | null;
	distributorId?: string | null;
};

// Indian Compliance Constants
const residentStatuses = [
	"Resident Indian",
	"Non-Resident Indian (NRI)",
	"Person of Indian Origin (PIO)",
	"Overseas Citizen of India (OCI)",
	"Foreign National",
];

const sourceOfWealthOptions = [
	"Employment/Salary",
	"Business Income",
	"Investment Returns",
	"Inheritance",
	"Gift",
	"Sale of Property",
	"Insurance Proceeds",
	"Other",
];

const fatcaStatuses = [
	"Not Applicable",
	"US Person",
	"Non-US Person",
	"Passive NFFE",
	"Active NFFE",
	"Financial Institution",
];

const pepStatuses = [
	"No",
	"Yes - Self",
	"Yes - Related Person",
	"Yes - Close Associate",
];

const countries = [
	"Afghanistan",
	"Albania",
	"Algeria",
	"Andorra",
	"Angola",
	"Argentina",
	"Armenia",
	"Australia",
	"Austria",
	"Azerbaijan",
	"Bahrain",
	"Bangladesh",
	"Belarus",
	"Belgium",
	"Bhutan",
	"Bolivia",
	"Brazil",
	"Brunei",
	"Bulgaria",
	"Cambodia",
	"Canada",
	"Chile",
	"China",
	"Colombia",
	"Croatia",
	"Cyprus",
	"Czech Republic",
	"Denmark",
	"Ecuador",
	"Egypt",
	"Estonia",
	"Ethiopia",
	"Finland",
	"France",
	"Georgia",
	"Germany",
	"Ghana",
	"Greece",
	"Hong Kong",
	"Hungary",
	"Iceland",
	"India",
	"Indonesia",
	"Iran",
	"Iraq",
	"Ireland",
	"Israel",
	"Italy",
	"Japan",
	"Jordan",
	"Kazakhstan",
	"Kenya",
	"Kuwait",
	"Latvia",
	"Lebanon",
	"Lithuania",
	"Luxembourg",
	"Malaysia",
	"Maldives",
	"Malta",
	"Mauritius",
	"Mexico",
	"Mongolia",
	"Myanmar",
	"Nepal",
	"Netherlands",
	"New Zealand",
	"Norway",
	"Oman",
	"Pakistan",
	"Philippines",
	"Poland",
	"Portugal",
	"Qatar",
	"Romania",
	"Russia",
	"Saudi Arabia",
	"Singapore",
	"Slovakia",
	"Slovenia",
	"South Africa",
	"South Korea",
	"Spain",
	"Sri Lanka",
	"Sweden",
	"Switzerland",
	"Taiwan",
	"Thailand",
	"Turkey",
	"UAE",
	"Ukraine",
	"United Kingdom",
	"United States",
	"Uzbekistan",
	"Vietnam",
	"Yemen",
];

const states = [
	"Andhra Pradesh",
	"Arunachal Pradesh",
	"Assam",
	"Bihar",
	"Chhattisgarh",
	"Goa",
	"Gujarat",
	"Haryana",
	"Himachal Pradesh",
	"Jharkhand",
	"Karnataka",
	"Kerala",
	"Madhya Pradesh",
	"Maharashtra",
	"Manipur",
	"Meghalaya",
	"Mizoram",
	"Nagaland",
	"Odisha",
	"Punjab",
	"Rajasthan",
	"Sikkim",
	"Tamil Nadu",
	"Telangana",
	"Tripura",
	"Uttar Pradesh",
	"Uttarakhand",
	"West Bengal",
	"Delhi",
	"Jammu and Kashmir",
	"Ladakh",
];

const maritalStatuses = [
	"Single",
	"Married",
	"Divorced",
	"Widowed",
	"Separated",
];

const nationalities = [
	"Indian",
	"American",
	"British",
	"Canadian",
	"Australian",
	"Other",
];

const nomineeRelations = [
	"Father",
	"Mother",
	"Spouse",
	"Son",
	"Daughter",
	"Brother",
	"Sister",
	"Other",
];

const incomeRanges = [
	"Below ₹2.5 Lakh",
	"₹2.5 - ₹5 Lakh",
	"₹5 - ₹10 Lakh",
	"₹10 - ₹25 Lakh",
	"₹25 - ₹50 Lakh",
	"Above ₹50 Lakh",
];

const experienceLevels = [
	"Beginner (0-1 years)",
	"Intermediate (1-3 years)",
	"Experienced (3-5 years)",
	"Expert (5+ years)",
];

const riskTolerances = ["Conservative", "Moderate", "Aggressive"];

export default function ProfilePage() {
	const { user } = useAuth();
	const { toast } = useToast();
	const { hasConsent, recordConsent, isRecording } = usePanConsent();
	const [isEditing, setIsEditing] = useState(false);
	const [showAutoPopulate, setShowAutoPopulate] = useState(false);
	const [panConsentGiven, setPanConsentGiven] = useState(false);
	const [autoPopulateData, setAutoPopulateData] = useState({
		panNumber: "",
		mobile: "",
		email: "",
		accountNumber: "",
		bankName: "ICICI",
		investmentPreference: "balanced",
	});
	const [currentStep, setCurrentStep] = useState(0);
	const [showReCKYCWorkflow, setShowReCKYCWorkflow] = useState(false);

	// Fetch demographic protection restrictions
	const { data: protectedFieldsData } = useQuery<{
		success: boolean;
		data: string[];
	}>({
		queryKey: ["/api/demographic/protected-fields"],
		staleTime: 5 * 60 * 1000, // 5 minutes
	});

	// Helper function to check if a field is protected
	const isFieldProtected = (fieldName: string) => {
		return protectedFieldsData?.data?.includes(fieldName) || false;
	};

	// Helper function to render protected field with lock icon
	const renderProtectedField = (
		fieldName: string,
		children: React.ReactNode,
	) => {
		if (!isFieldProtected(fieldName)) {
			return children;
		}

		return (
			<div className="relative">
				<div className="opacity-50 pointer-events-none">{children}</div>
				<div className="absolute inset-0 flex items-center justify-center bg-muted/80/80 rounded border-2 border-orange-300 dark:border-orange-700">
					<div className="flex items-center gap-2 text-orange-600 dark:text-orange-400 text-sm font-medium">
						<Lock className="h-4 w-4" />
						<span>Re-CKYC Required</span>
					</div>
				</div>
			</div>
		);
	};

	const { data: profileData, isLoading } = useQuery<ProfileData>({
		queryKey: ["/api/profile"],
		enabled: !!user,
	});

	const form = useForm<ProfileFormData>({
		resolver: zodResolver(profileSchema),
		defaultValues: {
			// Enhanced KYC Fields
			panNumber: "",
			panConsentGiven: false,
			aadharNumber: "",
			passportNumber: "",
			drivingLicense: "",
			voterIdNumber: "",
			dateOfBirth: "",
			nationality: "",
			fatherName: "",
			motherName: "",
			spouseName: "",
			maritalStatus: "",

			// Residency Status
			residentStatus: "",
			countryOfResidence: "",
			taxResidencyCountry: "",

			// Address Information
			address: "",
			city: "",
			state: "",
			pincode: "",
			country: "India",

			// Financial Information
			occupation: "",
			annualIncome: "",
			investmentExperience: "",
			riskTolerance: "",
			sourceOfWealth: "",

			// FATCA Compliance
			fatcaStatus: "",
			fatcaTinNumber: "",
			fatcaCountryOfTaxResidence: "",

			// PEP Status
			pepStatus: "",
			pepDetails: "",

			// UBO Information
			isUbo: false,
			uboDetails: "",

			// API Integration (auto-populated)
			euinNumber: "",
			arnCode: "",
			distributorId: "",
		},
	});

	useEffect(() => {
		if (profileData) {
			form.reset({
				// Enhanced KYC Fields
				panNumber: profileData.panNumber || "",
				panConsentGiven: profileData.panVerificationConsent || false,
				aadharNumber: profileData.aadharNumber || "",
				passportNumber: profileData.passportNumber || "",
				drivingLicense: profileData.drivingLicense || "",
				voterIdNumber: profileData.voterIdNumber || "",
				dateOfBirth: profileData.dateOfBirth || "",
				nationality: profileData.nationality || "",
				fatherName: profileData.fatherName || "",
				motherName: profileData.motherName || "",
				spouseName: profileData.spouseName || "",
				maritalStatus: profileData.maritalStatus || "",

				// Residency Status
				residentStatus: profileData.residentStatus || "",
				countryOfResidence: profileData.countryOfResidence || "",
				taxResidencyCountry: profileData.taxResidencyCountry || "",

				// Address Information
				address: profileData.address || "",
				city: profileData.city || "",
				state: profileData.state || "",
				pincode: profileData.pincode || "",
				country: profileData.country || "India",

				// Financial Information
				occupation: profileData.occupation || "",
				annualIncome: profileData.annualIncome || "",
				investmentExperience: profileData.investmentExperience || "",
				riskTolerance: profileData.riskTolerance || "",
				sourceOfWealth: profileData.sourceOfWealth || "",

				// FATCA Compliance
				fatcaStatus: profileData.fatcaStatus || "",
				fatcaTinNumber: profileData.fatcaTinNumber || "",
				fatcaCountryOfTaxResidence:
					profileData.fatcaCountryOfTaxResidence || "",

				// PEP Status
				pepStatus: profileData.pepStatus || "",
				pepDetails: profileData.pepDetails || "",

				// UBO Information
				isUbo: profileData.isUbo || false,
				uboDetails: profileData.uboDetails || "",

				// API Integration (auto-populated)
				euinNumber: profileData.euinNumber || "",
				arnCode: profileData.arnCode || "",
				distributorId: profileData.distributorId || "",
			});
		}
	}, [profileData, form]);

	const updateProfileMutation = useMutation({
		mutationFn: async (data: ProfileFormData) => {
			const response = await apiRequest("/api/profile", {
				method: "PUT",
				body: JSON.stringify(data),
			});

			// Record PAN consent if given and not already recorded
			if (data.panNumber && data.panConsentGiven && !hasConsent) {
				await recordConsent();
			}

			return response;
		},
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ["/api/profile"] });
			queryClient.invalidateQueries({ queryKey: ["/api/user"] });
			queryClient.invalidateQueries({ queryKey: ["/api/pan-consent/check"] });
			setIsEditing(false);
			toast({
				title: "Profile Updated",
				description: "Your profile information has been saved successfully.",
			});
		},
		onError: (error: Error) => {
			toast({
				title: "Update Failed",
				description: error.message,
				variant: "destructive",
			});
		},
	});

	const autoPopulateMutation = useMutation({
		mutationFn: async (data: any) => {
			const response = await apiRequest("/api/client/auto-populate", {
				method: "POST",
				body: JSON.stringify(data),
			});
			return response;
		},
		onSuccess: (data) => {
			// Auto-fill form with fetched data
			if (data.personalInfo || data.bankingData) {
				form.setValue("panNumber", autoPopulateData.panNumber);
				form.setValue(
					"annualIncome",
					data.bankingData?.monthlyAverage
						? (data.bankingData.monthlyAverage * 12).toString()
						: "",
				);
				form.setValue("riskTolerance", autoPopulateData.investmentPreference);

				// Set additional fields based on fetched data
				if (data.complianceData) {
					form.setValue("residentStatus", data.complianceData.residentStatus);
					form.setValue(
						"countryOfResidence",
						data.complianceData.countryOfResidence,
					);
					form.setValue("pepStatus", data.complianceData.pepStatus);
					form.setValue("fatcaStatus", data.complianceData.fatcaStatus);
				}
			}

			setCurrentStep(6);
			setShowAutoPopulate(false);
			toast({
				title: "Profile Auto-Populated!",
				description: `Successfully fetched ${data.totalDataPoints} data points from your banking and compliance records`,
				variant: "default",
			});
			queryClient.invalidateQueries({ queryKey: ["/api/profile"] });
		},
		onError: (error) => {
			toast({
				title: "Auto-Population Failed",
				description: error.message,
				variant: "destructive",
			});
			setCurrentStep(0);
		},
	});

	const onSubmit = (data: ProfileFormData) => {
		updateProfileMutation.mutate(data);
	};

	if (isLoading) {
		return (
			<div className="flex items-center justify-center min-h-[400px]">
				<div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
			</div>
		);
	}

	return (
		<div className="container mx-auto p-6 max-w-4xl">
			<div className="mb-6">
				<h1 className="text-3xl font-bold text-foreground mb-2">
					Profile Settings
				</h1>
				<p className="text-muted-foreground">
					Complete your profile to enable advanced portfolio features and
					compliance tracking
				</p>
			</div>

			<div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
				{/* Profile Overview */}
				<div className="lg:col-span-1">
					<Card>
						<CardHeader>
							<CardTitle className="flex items-center gap-2">
								<User className="h-5 w-5" />
								Profile Overview
							</CardTitle>
						</CardHeader>
						<CardContent className="space-y-4">
							<div className="text-center">
								<div className="w-20 h-20 bg-blue-100 dark:bg-blue-900 rounded-full flex items-center justify-center mx-auto mb-4">
									<User className="h-10 w-10 text-blue-600 dark:text-blue-400" />
								</div>
								<h3 className="font-semibold text-lg">
									{user?.firstName} {user?.middleName && user.middleName + " "}
									{user?.lastName}
								</h3>
								<p className="text-sm text-muted-foreground">
									{user?.email || user?.mobile}
								</p>
							</div>

							<div className="space-y-2">
								<div className="flex items-center gap-2 text-sm">
									<LucideShield className="h-4 w-4" />
									<span>KYC Status:</span>
									<span
										className={`font-medium ${profileData?.panNumber ? "text-green-600" : "text-orange-600"}`}
									>
										{profileData?.panNumber ? "Completed" : "Pending"}
									</span>
								</div>
								<div className="flex items-center gap-2 text-sm">
									<TrendingUp className="h-4 w-4" />
									<span>Profile Status:</span>
									<span
										className={`font-medium ${profileData?.panNumber ? "text-green-600" : "text-muted-foreground"}`}
									>
										{profileData?.panNumber ? "Complete" : "Incomplete"}
									</span>
								</div>
								<div className="flex items-center gap-2 text-sm">
									<Lock className="h-4 w-4" />
									<span>Protected Fields:</span>
									<span className="font-medium text-orange-600">
										{protectedFieldsData?.data?.length || 0} Fields
									</span>
								</div>
							</div>

							{protectedFieldsData?.data &&
								protectedFieldsData.data.length > 0 && (
									<div className="pt-4 border-t border-border">
										<Button
											onClick={() => setShowReCKYCWorkflow(true)}
											variant="outline"
											size="sm"
											className="w-full text-orange-600 border-orange-300 hover:bg-orange-50 dark:text-orange-400 dark:border-orange-700 dark:hover:bg-orange-950"
											data-testid="button-start-re-ckyc"
										>
											<LucideShield className="h-4 w-4 mr-2" />
											Update Protected Data
										</Button>
										<p className="text-xs text-muted-foreground text-center mt-1">
											via Re-CKYC Process
										</p>
									</div>
								)}
						</CardContent>
					</Card>

					{/* Smart Auto-Populate Section */}
					<Card className="mt-6">
						<CardHeader>
							<CardTitle className="flex items-center gap-2">
								<Database className="h-5 w-5" />
								Smart Profile Setup
							</CardTitle>
							<p className="text-sm text-muted-foreground">
								Auto-populate your profile using banking APIs and compliance
								data
							</p>
						</CardHeader>
						<CardContent>
							{!showAutoPopulate ? (
								<div className="space-y-4">
									<div className="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 p-4 rounded-lg">
										<h4 className="font-semibold text-blue-800 dark:text-blue-200 mb-2">
											Instant Profile Setup
										</h4>
										<p className="text-sm text-blue-700 dark:text-blue-300 mb-3">
											Just provide your PAN and bank details - we'll auto-fetch
											your complete profile from official sources
										</p>
										<div className="flex items-center gap-4 text-xs text-blue-600 dark:text-blue-400">
											<div className="flex items-center gap-1">
												<CheckCircle className="w-3 h-3" />
												Banking data
											</div>
											<div className="flex items-center gap-1">
												<CheckCircle className="w-3 h-3" />
												Portfolio holdings
											</div>
											<div className="flex items-center gap-1">
												<CheckCircle className="w-3 h-3" />
												Compliance data
											</div>
										</div>
									</div>
									<Button
										onClick={() => setShowAutoPopulate(true)}
										className="w-full"
										variant="default"
										data-testid="button-start-auto-populate"
									>
										<Database className="w-4 h-4 mr-2" />
										Start Smart Setup
									</Button>
								</div>
							) : (
								<div className="space-y-6">
									{/* Step Indicator */}
									<div className="flex items-center justify-between mb-6">
										{[1, 2, 3, 4, 5, 6].map((step) => (
											<div
												key={step}
												className={`flex items-center justify-center w-8 h-8 rounded-full text-sm font-medium ${
													currentStep >= step
														? "bg-blue-600 text-white"
														: currentStep + 1 === step
															? "bg-blue-100 dark:bg-blue-900/30 text-blue-600"
															: "bg-muted text-muted-foreground"
												}`}
											>
												{currentStep > step ? (
													<CheckCircle className="w-4 h-4" />
												) : (
													step
												)}
											</div>
										))}
									</div>

									{/* Step Content */}
									{currentStep === 0 && (
										<div className="space-y-4">
											<h3 className="font-semibold">Basic Information</h3>
											<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
												<div>
													<Label htmlFor="auto-pan">PAN Number *</Label>
													<Input
														id="auto-pan"
														value={autoPopulateData.panNumber}
														onChange={(e) =>
															setAutoPopulateData({
																...autoPopulateData,
																panNumber: e.target.value.toUpperCase(),
															})
														}
														placeholder="ABCDE1234F"
														className="uppercase"
														data-testid="input-auto-pan"
													/>
												</div>
												<div>
													<Label htmlFor="auto-mobile">Mobile Number *</Label>
													<Input
														id="auto-mobile"
														value={autoPopulateData.mobile}
														onChange={(e) =>
															setAutoPopulateData({
																...autoPopulateData,
																mobile: e.target.value,
															})
														}
														placeholder="9876543210"
														data-testid="input-auto-mobile"
													/>
												</div>
											</div>
											<Button
												onClick={() => setCurrentStep(1)}
												disabled={
													!autoPopulateData.panNumber ||
													!autoPopulateData.mobile
												}
												data-testid="button-next-step-1"
											>
												Next: Banking Details
											</Button>
										</div>
									)}

									{currentStep === 1 && (
										<div className="space-y-4">
											<h3 className="font-semibold">Banking Information</h3>
											<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
												<div>
													<Label htmlFor="auto-bank">Bank</Label>
													<Select
														value={autoPopulateData.bankName}
														onValueChange={(value) =>
															setAutoPopulateData({
																...autoPopulateData,
																bankName: value,
															})
														}
													>
														<SelectTrigger data-testid="select-auto-bank">
															<SelectValue placeholder="Select your bank" />
														</SelectTrigger>
														<SelectContent>
															<SelectItem value="ICICI">ICICI Bank</SelectItem>
															<SelectItem value="HDFC">HDFC Bank</SelectItem>
															<SelectItem value="SBI">
																State Bank of India
															</SelectItem>
															<SelectItem value="AXIS">Axis Bank</SelectItem>
														</SelectContent>
													</Select>
												</div>
												<div>
													<Label htmlFor="auto-account">Account Number</Label>
													<Input
														id="auto-account"
														value={autoPopulateData.accountNumber}
														onChange={(e) =>
															setAutoPopulateData({
																...autoPopulateData,
																accountNumber: e.target.value,
															})
														}
														placeholder="Account number"
														data-testid="input-auto-account"
													/>
												</div>
											</div>
											<div className="flex gap-2">
												<Button
													variant="outline"
													onClick={() => setCurrentStep(0)}
													data-testid="button-back-step-1"
												>
													Back
												</Button>
												<Button
													onClick={() => setCurrentStep(2)}
													disabled={
														!autoPopulateData.bankName ||
														!autoPopulateData.accountNumber
													}
													data-testid="button-next-step-2"
												>
													Next: Investment Preference
												</Button>
											</div>
										</div>
									)}

									{currentStep === 2 && (
										<div className="space-y-4">
											<h3 className="font-semibold">Investment Preference</h3>
											<div>
												<Label htmlFor="auto-preference">Risk Tolerance</Label>
												<Select
													value={autoPopulateData.investmentPreference}
													onValueChange={(value) =>
														setAutoPopulateData({
															...autoPopulateData,
															investmentPreference: value,
														})
													}
												>
													<SelectTrigger data-testid="select-auto-preference">
														<SelectValue placeholder="Select investment preference" />
													</SelectTrigger>
													<SelectContent>
														<SelectItem value="Conservative">
															Conservative
														</SelectItem>
														<SelectItem value="Moderate">Moderate</SelectItem>
														<SelectItem value="Aggressive">
															Aggressive
														</SelectItem>
													</SelectContent>
												</Select>
											</div>
											<div className="flex gap-2">
												<Button
													variant="outline"
													onClick={() => setCurrentStep(1)}
													data-testid="button-back-step-2"
												>
													Back
												</Button>
												<Button
													onClick={() => {
														setCurrentStep(3);
														autoPopulateMutation.mutate(autoPopulateData);
													}}
													disabled={autoPopulateMutation.isPending}
													data-testid="button-auto-populate"
												>
													{autoPopulateMutation.isPending ? (
														<>
															<Loader2 className="w-4 h-4 mr-2 animate-spin" />
															Fetching Data...
														</>
													) : (
														"Auto-Populate Profile"
													)}
												</Button>
											</div>
										</div>
									)}

									{(currentStep === 3 ||
										currentStep === 4 ||
										currentStep === 5) && (
										<div className="space-y-4">
											<div className="text-center">
												<Loader2 className="w-8 h-8 animate-spin mx-auto mb-4 text-blue-600" />
												<h3 className="font-semibold">
													{currentStep === 3 && "Fetching banking data..."}
													{currentStep === 4 && "Loading portfolio holdings..."}
													{currentStep === 5 &&
														"Retrieving compliance information..."}
												</h3>
												<p className="text-sm text-muted-foreground mt-2">
													This may take a few moments as we securely fetch your
													data
												</p>
											</div>
										</div>
									)}

									{currentStep === 6 && (
										<div className="space-y-4">
											<div className="text-center">
												<CheckCircle className="w-12 h-12 text-green-600 mx-auto mb-4" />
												<h3 className="font-semibold text-green-800 dark:text-green-200">
													Profile Successfully Populated!
												</h3>
												<p className="text-sm text-muted-foreground mt-2">
													Your profile has been automatically filled with data
													from banking and compliance sources
												</p>
											</div>
											<Button
												onClick={() => {
													setShowAutoPopulate(false);
													setCurrentStep(0);
													setIsEditing(true);
												}}
												className="w-full"
												data-testid="button-review-profile"
											>
												Review & Edit Profile
											</Button>
										</div>
									)}

									<Button
										variant="outline"
										onClick={() => {
											setShowAutoPopulate(false);
											setCurrentStep(0);
										}}
										className="w-full"
										data-testid="button-cancel-auto-populate"
									>
										Cancel
									</Button>
								</div>
							)}
						</CardContent>
					</Card>
				</div>

				{/* Profile Form */}
				<div className="lg:col-span-2">
					<form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
						{/* KYC Information */}
						<Card>
							<CardHeader>
								<CardTitle className="flex items-center gap-2">
									<LucideShield className="h-5 w-5" />
									KYC Information
								</CardTitle>
							</CardHeader>
							<CardContent className="space-y-4">
								<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
									<div>
										<Label htmlFor="panNumber">PAN Number *</Label>
										{renderProtectedField(
											"panNumber",
											<Input
												id="panNumber"
												{...form.register("panNumber")}
												placeholder="ABCDE1234F"
												disabled={!isEditing}
												className="uppercase"
												data-testid="input-pan-number"
											/>,
										)}
										{form.formState.errors.panNumber && (
											<p className="text-sm text-red-600 mt-1">
												{form.formState.errors.panNumber.message}
											</p>
										)}

										{/* PAN Verification Consent - Show only when PAN is provided and consent not already given */}
										{form.watch("panNumber") && !hasConsent && (
											<div className="mt-3 p-3 bg-blue-50 dark:bg-blue-950 rounded-lg border border-blue-200 dark:border-blue-800">
												<div className="flex items-start space-x-3">
													<Checkbox
														id="panConsentGiven"
														checked={form.watch("panConsentGiven") || false}
														onCheckedChange={(checked) => {
															form.setValue(
																"panConsentGiven",
																checked as boolean,
															);
															setPanConsentGiven(checked as boolean);
														}}
														data-testid="checkbox-pan-consent"
													/>
													<div className="flex-1">
														<Label
															htmlFor="panConsentGiven"
															className="text-sm font-medium"
														>
															PAN Verification Consent *
														</Label>
														<p className="text-xs text-muted-foreground mt-1">
															I consent to verify my PAN details with NSDL/CDSL
															for regulatory compliance and account verification
															purposes. This is a one-time consent required for
															KYC completion.
														</p>
													</div>
												</div>
												{form.formState.errors.panConsentGiven && (
													<p className="text-sm text-red-600 mt-2">
														{form.formState.errors.panConsentGiven.message}
													</p>
												)}
											</div>
										)}

										{/* Show consent status if already given */}
										{hasConsent && (
											<div className="mt-3 p-3 bg-green-50 dark:bg-green-950 rounded-lg border border-green-200 dark:border-green-800">
												<div className="flex items-center space-x-2">
													<CheckCircle className="h-4 w-4 text-green-600" />
													<span className="text-sm text-green-700 dark:text-green-300">
														PAN verification consent already provided
													</span>
												</div>
											</div>
										)}
									</div>
									<div>
										<Label htmlFor="aadharNumber">Aadhaar Number *</Label>
										<Input
											id="aadharNumber"
											{...form.register("aadharNumber")}
											placeholder="123456789012"
											disabled={!isEditing}
											data-testid="input-aadhar-number"
										/>
										{form.formState.errors.aadharNumber && (
											<p className="text-sm text-red-600 mt-1">
												{form.formState.errors.aadharNumber.message}
											</p>
										)}
									</div>
								</div>

								<div className="grid grid-cols-1 md:grid-cols-3 gap-4">
									<div>
										<Label htmlFor="passportNumber">Passport Number</Label>
										<Input
											id="passportNumber"
											{...form.register("passportNumber")}
											placeholder="A1234567"
											disabled={!isEditing}
											data-testid="input-passport-number"
										/>
									</div>
									<div>
										<Label htmlFor="drivingLicense">Driving License</Label>
										<Input
											id="drivingLicense"
											{...form.register("drivingLicense")}
											placeholder="DL1420110012345"
											disabled={!isEditing}
											data-testid="input-driving-license"
										/>
									</div>
									<div>
										<Label htmlFor="voterIdNumber">Voter ID Number</Label>
										<Input
											id="voterIdNumber"
											{...form.register("voterIdNumber")}
											placeholder="ABC1234567"
											disabled={!isEditing}
											data-testid="input-voter-id-number"
										/>
									</div>
								</div>

								<div className="grid grid-cols-1 md:grid-cols-3 gap-4">
									<div>
										<Label htmlFor="dateOfBirth">Date of Birth</Label>
										<Input
											id="dateOfBirth"
											type="date"
											{...form.register("dateOfBirth")}
											disabled={!isEditing}
											data-testid="input-date-of-birth"
										/>
									</div>
									<div>
										<Label htmlFor="nationality">Nationality</Label>
										<Select
											value={form.watch("nationality")}
											onValueChange={(value) =>
												form.setValue("nationality", value)
											}
											disabled={!isEditing}
										>
											<SelectTrigger data-testid="select-nationality">
												<SelectValue placeholder="Select nationality" />
											</SelectTrigger>
											<SelectContent>
												{nationalities.map((nationality) => (
													<SelectItem key={nationality} value={nationality}>
														{nationality}
													</SelectItem>
												))}
											</SelectContent>
										</Select>
									</div>
									<div>
										<Label htmlFor="maritalStatus">Marital Status</Label>
										<Select
											value={form.watch("maritalStatus")}
											onValueChange={(value) =>
												form.setValue("maritalStatus", value)
											}
											disabled={!isEditing}
										>
											<SelectTrigger data-testid="select-marital-status">
												<SelectValue placeholder="Select status" />
											</SelectTrigger>
											<SelectContent>
												{maritalStatuses.map((status) => (
													<SelectItem key={status} value={status}>
														{status}
													</SelectItem>
												))}
											</SelectContent>
										</Select>
									</div>
								</div>

								<div className="grid grid-cols-1 md:grid-cols-3 gap-4">
									<div>
										<Label htmlFor="fatherName">Father's Name</Label>
										<Input
											id="fatherName"
											{...form.register("fatherName")}
											placeholder="Father's full name"
											disabled={!isEditing}
											data-testid="input-father-name"
										/>
									</div>
									<div>
										<Label htmlFor="motherName">Mother's Name</Label>
										<Input
											id="motherName"
											{...form.register("motherName")}
											placeholder="Mother's full name"
											disabled={!isEditing}
											data-testid="input-mother-name"
										/>
									</div>
									<div>
										<Label htmlFor="spouseName">Spouse's Name</Label>
										<Input
											id="spouseName"
											{...form.register("spouseName")}
											placeholder="Spouse's full name"
											disabled={!isEditing}
											data-testid="input-spouse-name"
										/>
									</div>
								</div>
							</CardContent>
						</Card>

						{/* Address Information */}
						<Card>
							<CardHeader>
								<CardTitle className="flex items-center gap-2">
									<Building className="h-5 w-5" />
									Address Information
								</CardTitle>
							</CardHeader>
							<CardContent className="space-y-4">
								<div>
									<Label htmlFor="address">Address</Label>
									<Textarea
										id="address"
										{...form.register("address")}
										placeholder="Complete address"
										disabled={!isEditing}
										rows={3}
										data-testid="input-address"
									/>
								</div>
								<div className="grid grid-cols-1 md:grid-cols-4 gap-4">
									<div>
										<Label htmlFor="city">City</Label>
										<Input
											id="city"
											{...form.register("city")}
											placeholder="City"
											disabled={!isEditing}
											data-testid="input-city"
										/>
									</div>
									<div>
										<Label htmlFor="state">State</Label>
										<Select
											value={form.watch("state")}
											onValueChange={(value) => form.setValue("state", value)}
											disabled={!isEditing}
										>
											<SelectTrigger data-testid="select-state">
												<SelectValue placeholder="Select state" />
											</SelectTrigger>
											<SelectContent>
												{states.map((state) => (
													<SelectItem key={state} value={state}>
														{state}
													</SelectItem>
												))}
											</SelectContent>
										</Select>
									</div>
									<div>
										<Label htmlFor="pincode">Pincode</Label>
										<Input
											id="pincode"
											{...form.register("pincode")}
											placeholder="123456"
											disabled={!isEditing}
											data-testid="input-pincode"
										/>
										{form.formState.errors.pincode && (
											<p className="text-sm text-red-600 mt-1">
												{form.formState.errors.pincode.message}
											</p>
										)}
									</div>
									<div>
										<Label htmlFor="country">Country</Label>
										<Input
											id="country"
											{...form.register("country")}
											placeholder="India"
											disabled={!isEditing}
											data-testid="input-country"
										/>
									</div>
								</div>
							</CardContent>
						</Card>

						{/* Financial Information */}
						<Card>
							<CardHeader>
								<CardTitle className="flex items-center gap-2">
									<TrendingUp className="h-5 w-5" />
									Financial Information
								</CardTitle>
							</CardHeader>
							<CardContent className="space-y-4">
								<div>
									<Label htmlFor="occupation">Occupation</Label>
									<Input
										id="occupation"
										{...form.register("occupation")}
										placeholder="e.g., Software Engineer, Business Owner"
										disabled={!isEditing}
										data-testid="input-occupation"
									/>
								</div>
								<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
									<div>
										<Label htmlFor="annualIncome">Annual Income</Label>
										<Select
											value={form.watch("annualIncome")}
											onValueChange={(value) =>
												form.setValue("annualIncome", value)
											}
											disabled={!isEditing}
										>
											<SelectTrigger data-testid="select-annual-income">
												<SelectValue placeholder="Select range" />
											</SelectTrigger>
											<SelectContent>
												{incomeRanges.map((range) => (
													<SelectItem key={range} value={range}>
														{range}
													</SelectItem>
												))}
											</SelectContent>
										</Select>
									</div>
								</div>

								<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
									<div>
										<Label htmlFor="investmentExperience">
											Investment Experience
										</Label>
										<Select
											value={form.watch("investmentExperience")}
											onValueChange={(value) =>
												form.setValue("investmentExperience", value)
											}
											disabled={!isEditing}
										>
											<SelectTrigger data-testid="select-investment-experience">
												<SelectValue placeholder="Select experience" />
											</SelectTrigger>
											<SelectContent>
												{experienceLevels.map((level) => (
													<SelectItem key={level} value={level}>
														{level}
													</SelectItem>
												))}
											</SelectContent>
										</Select>
									</div>
									<div>
										<Label htmlFor="riskTolerance">Risk Tolerance</Label>
										<Select
											value={form.watch("riskTolerance")}
											onValueChange={(value) =>
												form.setValue("riskTolerance", value)
											}
											disabled={!isEditing}
										>
											<SelectTrigger data-testid="select-risk-tolerance">
												<SelectValue placeholder="Select tolerance" />
											</SelectTrigger>
											<SelectContent>
												{riskTolerances.map((tolerance) => (
													<SelectItem key={tolerance} value={tolerance}>
														{tolerance}
													</SelectItem>
												))}
											</SelectContent>
										</Select>
									</div>
								</div>

								<div>
									<Label htmlFor="sourceOfWealth">Source of Wealth</Label>
									<Select
										value={form.watch("sourceOfWealth")}
										onValueChange={(value) =>
											form.setValue("sourceOfWealth", value)
										}
										disabled={!isEditing}
									>
										<SelectTrigger data-testid="select-source-of-wealth">
											<SelectValue placeholder="Select source" />
										</SelectTrigger>
										<SelectContent>
											{sourceOfWealthOptions.map((source) => (
												<SelectItem key={source} value={source}>
													{source}
												</SelectItem>
											))}
										</SelectContent>
									</Select>
								</div>
							</CardContent>
						</Card>

						{/* Risk Profile Assessment */}
						<Card>
							<CardHeader>
								<CardTitle className="flex items-center gap-2">
									<LucideShield className="h-5 w-5 text-blue-600" />
									Investment Risk Profile
								</CardTitle>
								<p className="text-sm text-muted-foreground mt-1">
									SEBI-compliant risk profiling for personalized investment
									recommendations
								</p>
							</CardHeader>
							<CardContent>
								<RiskAssessment />
							</CardContent>
						</Card>

						{/* Residency & Tax Status - Critical for NRI Compliance */}
						<Card>
							<CardHeader>
								<CardTitle className="flex items-center gap-2">
									<Info className="h-5 w-5" />
									Residency & Tax Status
								</CardTitle>
								<p className="text-sm text-muted-foreground mt-1">
									Required for Indian regulatory compliance and NRI investor
									classification
								</p>
							</CardHeader>
							<CardContent className="space-y-4">
								<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
									<div>
										<Label htmlFor="residentStatus">Resident Status *</Label>
										<Select
											value={form.watch("residentStatus")}
											onValueChange={(value) =>
												form.setValue("residentStatus", value)
											}
											disabled={!isEditing}
										>
											<SelectTrigger data-testid="select-resident-status">
												<SelectValue placeholder="Select status" />
											</SelectTrigger>
											<SelectContent>
												{residentStatuses.map((status) => (
													<SelectItem key={status} value={status}>
														{status}
													</SelectItem>
												))}
											</SelectContent>
										</Select>
									</div>
									<div>
										<Label htmlFor="countryOfResidence">
											Country of Residence
										</Label>
										<Select
											value={form.watch("countryOfResidence")}
											onValueChange={(value) =>
												form.setValue("countryOfResidence", value)
											}
											disabled={!isEditing}
										>
											<SelectTrigger data-testid="select-country-of-residence">
												<SelectValue placeholder="Select country" />
											</SelectTrigger>
											<SelectContent>
												{countries.map((country) => (
													<SelectItem key={country} value={country}>
														{country}
													</SelectItem>
												))}
											</SelectContent>
										</Select>
									</div>
								</div>

								<div>
									<Label htmlFor="taxResidencyCountry">
										Tax Residency Country
									</Label>
									<Select
										value={form.watch("taxResidencyCountry")}
										onValueChange={(value) =>
											form.setValue("taxResidencyCountry", value)
										}
										disabled={!isEditing}
									>
										<SelectTrigger data-testid="select-tax-residency-country">
											<SelectValue placeholder="Select tax residency" />
										</SelectTrigger>
										<SelectContent>
											{countries.map((country) => (
												<SelectItem key={country} value={country}>
													{country}
												</SelectItem>
											))}
										</SelectContent>
									</Select>
								</div>

								<div className="mt-3 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
									<p className="text-xs text-blue-700 dark:text-blue-300">
										<strong>Note for NRIs:</strong> As per SEBI guidelines,
										Non-Resident Indians must declare their residency status for
										proper classification and compliance with FEMA regulations.
									</p>
								</div>
							</CardContent>
						</Card>

						{/* FATCA Compliance */}
						<Card>
							<CardHeader>
								<CardTitle className="flex items-center gap-2">
									<FileText className="h-5 w-5" />
									FATCA Compliance
								</CardTitle>
								<p className="text-sm text-muted-foreground mt-1">
									Foreign Account Tax Compliance Act - Required for
									international compliance
								</p>
							</CardHeader>
							<CardContent className="space-y-4">
								<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
									<div>
										<Label htmlFor="fatcaStatus">FATCA Status</Label>
										<Select
											value={form.watch("fatcaStatus")}
											onValueChange={(value) =>
												form.setValue("fatcaStatus", value)
											}
											disabled={!isEditing}
										>
											<SelectTrigger data-testid="select-fatca-status">
												<SelectValue placeholder="Select FATCA status" />
											</SelectTrigger>
											<SelectContent>
												{fatcaStatuses.map((status) => (
													<SelectItem key={status} value={status}>
														{status}
													</SelectItem>
												))}
											</SelectContent>
										</Select>
									</div>
									<div>
										<Label htmlFor="fatcaTinNumber">US TIN Number</Label>
										<Input
											id="fatcaTinNumber"
											{...form.register("fatcaTinNumber")}
											placeholder="123-45-6789 or 12-3456789"
											disabled={!isEditing}
											data-testid="input-fatca-tin-number"
										/>
									</div>
								</div>

								<div>
									<Label htmlFor="fatcaCountryOfTaxResidence">
										FATCA Country of Tax Residence
									</Label>
									<Select
										value={form.watch("fatcaCountryOfTaxResidence")}
										onValueChange={(value) =>
											form.setValue("fatcaCountryOfTaxResidence", value)
										}
										disabled={!isEditing}
									>
										<SelectTrigger data-testid="select-fatca-country-of-tax-residence">
											<SelectValue placeholder="Select country" />
										</SelectTrigger>
										<SelectContent>
											{countries.map((country) => (
												<SelectItem key={country} value={country}>
													{country}
												</SelectItem>
											))}
										</SelectContent>
									</Select>
								</div>

								<div className="mt-3 p-3 bg-orange-50 dark:bg-orange-900/20 rounded-lg">
									<p className="text-xs text-orange-700 dark:text-orange-300">
										<strong>FATCA Declaration:</strong> This information is
										required for compliance with US tax regulations. Please
										ensure accuracy as false information may result in
										penalties.
									</p>
								</div>
							</CardContent>
						</Card>

						{/* PEP Status & UBO Information */}
						<Card>
							<CardHeader>
								<CardTitle className="flex items-center gap-2">
									<LucideShield className="h-5 w-5" />
									PEP Status & Beneficial Ownership
								</CardTitle>
								<p className="text-sm text-muted-foreground mt-1">
									Politically Exposed Person declaration and Ultimate Beneficial
									Owner information
								</p>
							</CardHeader>
							<CardContent className="space-y-4">
								<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
									<div>
										<Label htmlFor="pepStatus">PEP Status</Label>
										<Select
											value={form.watch("pepStatus")}
											onValueChange={(value) =>
												form.setValue("pepStatus", value)
											}
											disabled={!isEditing}
										>
											<SelectTrigger data-testid="select-pep-status">
												<SelectValue placeholder="Select PEP status" />
											</SelectTrigger>
											<SelectContent>
												{pepStatuses.map((status) => (
													<SelectItem key={status} value={status}>
														{status}
													</SelectItem>
												))}
											</SelectContent>
										</Select>
									</div>
									<div className="flex items-center space-x-2">
										<input
											type="checkbox"
											id="isUbo"
											checked={form.watch("isUbo") || false}
											onChange={(e) => form.setValue("isUbo", e.target.checked)}
											disabled={!isEditing}
											data-testid="checkbox-is-ubo"
										/>
										<Label htmlFor="isUbo" className="text-sm cursor-pointer">
											I am the Ultimate Beneficial Owner (UBO)
										</Label>
									</div>
								</div>

								{form.watch("pepStatus") &&
									form.watch("pepStatus") !== "No" && (
										<div>
											<Label htmlFor="pepDetails">PEP Details</Label>
											<Textarea
												id="pepDetails"
												{...form.register("pepDetails")}
												placeholder="Please provide details about political exposure..."
												disabled={!isEditing}
												rows={3}
												data-testid="input-pep-details"
											/>
										</div>
									)}

								{form.watch("isUbo") && (
									<div>
										<Label htmlFor="uboDetails">UBO Details</Label>
										<Textarea
											id="uboDetails"
											{...form.register("uboDetails")}
											placeholder="Details about beneficial ownership structure..."
											disabled={!isEditing}
											rows={3}
											data-testid="input-ubo-details"
										/>
									</div>
								)}

								<div className="mt-3 p-3 bg-red-50 dark:bg-red-900/20 rounded-lg">
									<p className="text-xs text-red-700 dark:text-red-300">
										<strong>Important:</strong> PEP status and UBO information
										is critical for anti-money laundering (AML) compliance.
										Accurate disclosure is mandatory under Indian regulations.
									</p>
								</div>
							</CardContent>
						</Card>

						{/* API Integration Settings */}
						<Card>
							<CardHeader>
								<CardTitle className="flex items-center gap-2">
									<Link className="h-5 w-5" />
									API Integration Settings
								</CardTitle>
								<p className="text-sm text-muted-foreground mt-1">
									External service codes automatically assigned by your
									relationship manager
								</p>
							</CardHeader>
							<CardContent className="space-y-4">
								<div className="grid grid-cols-1 md:grid-cols-3 gap-4">
									<div>
										<Label htmlFor="euinNumber">EUIN Number</Label>
										<Input
											id="euinNumber"
											value={
												form.watch("euinNumber") || "Auto-assigned by agent"
											}
											disabled={true}
											className="bg-muted"
											data-testid="input-euin-number"
										/>
										<p className="text-xs text-muted-foreground mt-1">
											Employee Unique Identification Number
										</p>
									</div>
									<div>
										<Label htmlFor="arnCode">ARN Code</Label>
										<Input
											id="arnCode"
											value={form.watch("arnCode") || "Auto-assigned by agent"}
											disabled={true}
											className="bg-muted"
											data-testid="input-arn-code"
										/>
										<p className="text-xs text-muted-foreground mt-1">
											AMFI Registration Number
										</p>
									</div>
									<div>
										<Label htmlFor="distributorId">Distributor ID</Label>
										<Input
											id="distributorId"
											value={
												form.watch("distributorId") || "Auto-assigned by agent"
											}
											disabled={true}
											className="bg-muted"
											data-testid="input-distributor-id"
										/>
										<p className="text-xs text-muted-foreground mt-1">
											Distributor Identification Code
										</p>
									</div>
								</div>

								<div className="mt-3 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
									<p className="text-xs text-blue-700 dark:text-blue-300">
										<strong>Note:</strong> These codes are automatically
										provided by your assigned relationship manager and cannot be
										edited. They enable seamless integration with mutual fund
										registrars and other financial services.
									</p>
								</div>
							</CardContent>
						</Card>

						{/* NRI Documentation Requirements */}
						<Card>
							<CardHeader>
								<CardTitle className="flex items-center gap-2">
									<FileText className="h-5 w-5" />
									NRI Documentation Requirements
								</CardTitle>
								<p className="text-sm text-muted-foreground mt-1">
									Additional documents required for Non-Resident Indian
									investors
								</p>
							</CardHeader>
							<CardContent className="space-y-4">
								<div className="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 p-4 rounded-lg">
									<h4 className="font-semibold text-blue-800 dark:text-blue-200 mb-3">
										Required Documents for NRI Investors:
									</h4>
									<div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
										<div className="space-y-2">
											<div className="flex items-center gap-2">
												<div className="w-2 h-2 bg-blue-500 rounded-full" />
												<span>Valid Passport with Indian origin proof</span>
											</div>
											<div className="flex items-center gap-2">
												<div className="w-2 h-2 bg-blue-500 rounded-full" />
												<span>Overseas address proof</span>
											</div>
											<div className="flex items-center gap-2">
												<div className="w-2 h-2 bg-blue-500 rounded-full" />
												<span>Visa/Work permit copy</span>
											</div>
											<div className="flex items-center gap-2">
												<div className="w-2 h-2 bg-blue-500 rounded-full" />
												<span>Bank statement from overseas account</span>
											</div>
										</div>
										<div className="space-y-2">
											<div className="flex items-center gap-2">
												<div className="w-2 h-2 bg-blue-500 rounded-full" />
												<span>PIO/OCI card (if applicable)</span>
											</div>
											<div className="flex items-center gap-2">
												<div className="w-2 h-2 bg-blue-500 rounded-full" />
												<span>FATCA declaration</span>
											</div>
											<div className="flex items-center gap-2">
												<div className="w-2 h-2 bg-blue-500 rounded-full" />
												<span>Tax residency certificate</span>
											</div>
											<div className="flex items-center gap-2">
												<div className="w-2 h-2 bg-blue-500 rounded-full" />
												<span>FEMA compliance declaration</span>
											</div>
										</div>
									</div>
								</div>

								<div className="bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20 p-4 rounded-lg">
									<h4 className="font-semibold text-green-800 dark:text-green-200 mb-3">
										Investment Restrictions for NRIs:
									</h4>
									<div className="text-sm space-y-1 text-green-700 dark:text-green-300">
										<p>
											• Portfolio Investment Scheme (PIS) permission required
											for equity investments
										</p>
										<p>• FDI restrictions apply for certain sectors</p>
										<p>• Repatriation limits as per RBI guidelines</p>
										<p>
											• Tax implications in both India and country of residence
										</p>
									</div>
								</div>

								<div className="bg-gradient-to-r from-amber-50 to-yellow-50 dark:from-amber-900/20 dark:to-yellow-900/20 p-4 rounded-lg">
									<h4 className="font-semibold text-amber-800 dark:text-amber-200 mb-3">
										Compliance Checklist:
									</h4>
									<div className="text-sm space-y-1 text-amber-700 dark:text-amber-300">
										<p>✓ Valid KYC documentation completed</p>
										<p>✓ FATCA status declared and TIN provided</p>
										<p>✓ Residency status accurately classified</p>
										<p>✓ PEP status declared</p>
										<p>✓ UBO information disclosed</p>
										<p>✓ Tax residency country specified</p>
									</div>
								</div>
							</CardContent>
						</Card>

						{/* PAN Data Security Dashboard */}
						<PANDataDashboard className="mt-6" />

						{/* Action Buttons */}
						<div className="flex gap-4">
							{!isEditing ? (
								<Button
									type="button"
									onClick={() => setIsEditing(true)}
									data-testid="button-edit-profile"
								>
									Edit Profile
								</Button>
							) : (
								<>
									<Button
										type="submit"
										disabled={updateProfileMutation.isPending}
										data-testid="button-save-profile"
									>
										{updateProfileMutation.isPending
											? "Saving..."
											: "Save Changes"}
									</Button>
									<Button
										type="button"
										variant="outline"
										onClick={() => {
											setIsEditing(false);
											form.reset();
										}}
										data-testid="button-cancel-edit"
									>
										Cancel
									</Button>
								</>
							)}
						</div>
					</form>
				</div>
			</div>

			{/* Re-CKYC Workflow Modal */}
			{showReCKYCWorkflow && user?.id && (
				<ReCKYCWorkflow
					isOpen={showReCKYCWorkflow}
					userId={user.id}
					onClose={() => setShowReCKYCWorkflow(false)}
					onSuccess={() => {
						setShowReCKYCWorkflow(false);
						// Refresh profile data after successful re-CKYC
						queryClient.invalidateQueries({ queryKey: ["/api/profile"] });
						toast({
							title: "Re-CKYC Request Submitted",
							description:
								"Your demographic data change request has been submitted for verification.",
						});
					}}
				/>
			)}
		</div>
	);
}
