import { useState } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import {
	Loader2,
	CheckCircle,
	AlertCircle,
	User,
	CreditCard,
	Building,
	Briefcase,
} from "lucide-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";

interface MinimalClientData {
	// Essential identifiers only
	panNumber: string;
	mobile: string;
	email: string;
	accountNumber?: string;
	bankName?: string;
	investmentPreference?: string;
}

interface AutoPopulatedData {
	personalInfo: any;
	bankingData: any;
	portfolioData: any;
	productRecommendations: any;
	complianceData: any;
}

export default function ClientAutoPopulatePage() {
	const [formData, setFormData] = useState<MinimalClientData>({
		panNumber: "",
		mobile: "",
		email: "",
		accountNumber: "",
		bankName: "ICICI",
		investmentPreference: "balanced",
	});

	const [autoPopulatedData, setAutoPopulatedData] =
		useState<AutoPopulatedData | null>(null);
	const [currentStep, setCurrentStep] = useState(0);
	const { toast } = useToast();
	const queryClient = useQueryClient();

	const steps = [
		"Collecting Basic Info",
		"Fetching Banking Data",
		"Analyzing Investment Profile",
		"Generating Product Recommendations",
		"Creating Portfolio",
		"Completing Setup",
	];

	// Auto-populate client data mutation
	const autoPopulateMutation = useMutation({
		mutationFn: async (clientData: MinimalClientData) => {
			const response = await apiRequest("POST", "/api/client/auto-populate", {
				body: clientData,
			});
			return response.json();
		},
		onSuccess: (data) => {
			setAutoPopulatedData(data);
			setCurrentStep(steps.length);
			toast({
				title: "Profile Created Successfully!",
				description: `Auto-populated ${data.totalDataPoints} data points from banking and market APIs`,
				variant: "default",
			});
			queryClient.invalidateQueries({ queryKey: ["/api/profile"] });
			queryClient.invalidateQueries({ queryKey: ["/api/portfolios"] });
		},
		onError: (error) => {
			toast({
				title: "Auto-Population Failed",
				description: error.message,
				variant: "destructive",
			});
		},
	});

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault();

		if (!formData.panNumber || !formData.mobile || !formData.email) {
			toast({
				title: "Missing Required Fields",
				description: "Please provide PAN, mobile, and email",
				variant: "destructive",
			});
			return;
		}

		setCurrentStep(1);
		autoPopulateMutation.mutate(formData);
	};

	const isLoading = autoPopulateMutation.isPending;

	return (
		<div className="min-h-screen bg-gradient-to-br from-blue-50/30 to-indigo-100/30 dark:from-background dark:to-card p-4">
			<div className="max-w-4xl mx-auto space-y-6">
				{/* Header */}
				<div className="text-center">
					<h1 className="text-3xl font-bold text-foreground mb-2">
						Smart Client Onboarding
					</h1>
					<p className="text-muted-foreground">
						Provide minimal details - we'll fetch everything else automatically
					</p>
				</div>

				{/* Progress Indicator */}
				{isLoading && (
					<Card>
						<CardContent className="pt-6">
							<div className="space-y-4">
								<div className="flex items-center justify-between text-sm">
									<span className="font-medium">Progress</span>
									<span>{Math.round((currentStep / steps.length) * 100)}%</span>
								</div>
								<div className="w-full bg-muted rounded-full h-2">
									<div
										className="bg-blue-600 h-2 rounded-full transition-all duration-500"
										style={{ width: `${(currentStep / steps.length) * 100}%` }}
									/>
								</div>
								<div className="text-center">
									<Loader2 className="h-6 w-6 animate-spin mx-auto mb-2" />
									<p className="text-sm text-muted-foreground">
										{currentStep < steps.length
											? steps[currentStep]
											: "Completed"}
									</p>
								</div>
							</div>
						</CardContent>
					</Card>
				)}

				{/* Input Form */}
				{!autoPopulatedData && (
					<form onSubmit={handleSubmit} className="space-y-6">
						{/* Basic Information */}
						<Card>
							<CardHeader>
								<CardTitle className="flex items-center gap-2">
									<User className="h-5 w-5" />
									Essential Information
								</CardTitle>
							</CardHeader>
							<CardContent className="space-y-4">
								<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
									<div>
										<Label htmlFor="panNumber">PAN Number *</Label>
										<Input
											id="panNumber"
											value={formData.panNumber}
											onChange={(e) =>
												setFormData((prev) => ({
													...prev,
													panNumber: e.target.value.toUpperCase(),
												}))
											}
											placeholder="ABCDE1234F"
											maxLength={10}
											required
											data-testid="input-pan-number"
										/>
									</div>
									<div>
										<Label htmlFor="mobile">Mobile Number *</Label>
										<Input
											id="mobile"
											type="tel"
											value={formData.mobile}
											onChange={(e) =>
												setFormData((prev) => ({
													...prev,
													mobile: e.target.value,
												}))
											}
											placeholder="9876543210"
											maxLength={10}
											required
											data-testid="input-mobile"
										/>
									</div>
								</div>

								<div>
									<Label htmlFor="email">Email Address *</Label>
									<Input
										id="email"
										type="email"
										value={formData.email}
										onChange={(e) =>
											setFormData((prev) => ({
												...prev,
												email: e.target.value,
											}))
										}
										placeholder="client@example.com"
										required
										data-testid="input-email"
									/>
								</div>
							</CardContent>
						</Card>

						{/* Banking Information (Optional) */}
						<Card>
							<CardHeader>
								<CardTitle className="flex items-center gap-2">
									<CreditCard className="h-5 w-5" />
									Banking Details (Optional)
								</CardTitle>
								<p className="text-sm text-muted-foreground">
									Providing banking info enables auto-fetch of transaction
									history and balance
								</p>
							</CardHeader>
							<CardContent className="space-y-4">
								<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
									<div>
										<Label htmlFor="bankName">Bank</Label>
										<Select
											value={formData.bankName}
											onValueChange={(value) =>
												setFormData((prev) => ({ ...prev, bankName: value }))
											}
										>
											<SelectTrigger data-testid="select-bank-name">
												<SelectValue placeholder="Select bank" />
											</SelectTrigger>
											<SelectContent>
												<SelectItem value="ICICI">ICICI Bank</SelectItem>
												<SelectItem value="HDFC">HDFC Bank</SelectItem>
												<SelectItem value="SBI">State Bank of India</SelectItem>
												<SelectItem value="AXIS">Axis Bank</SelectItem>
											</SelectContent>
										</Select>
									</div>
									<div>
										<Label htmlFor="accountNumber">Account Number</Label>
										<Input
											id="accountNumber"
											value={formData.accountNumber}
											onChange={(e) =>
												setFormData((prev) => ({
													...prev,
													accountNumber: e.target.value,
												}))
											}
											placeholder="Account number"
											data-testid="input-account-number"
										/>
									</div>
								</div>
							</CardContent>
						</Card>

						{/* Investment Preference */}
						<Card>
							<CardHeader>
								<CardTitle className="flex items-center gap-2">
									<Briefcase className="h-5 w-5" />
									Investment Preference
								</CardTitle>
							</CardHeader>
							<CardContent>
								<div>
									<Label htmlFor="investmentPreference">Risk Appetite</Label>
									<Select
										value={formData.investmentPreference}
										onValueChange={(value) =>
											setFormData((prev) => ({
												...prev,
												investmentPreference: value,
											}))
										}
									>
										<SelectTrigger data-testid="select-investment-preference">
											<SelectValue placeholder="Select preference" />
										</SelectTrigger>
										<SelectContent>
											<SelectItem value="conservative">
												Conservative - Low Risk
											</SelectItem>
											<SelectItem value="balanced">
												Balanced - Medium Risk
											</SelectItem>
											<SelectItem value="aggressive">
												Aggressive - High Risk
											</SelectItem>
											<SelectItem value="ultra_aggressive">
												Ultra Aggressive - Very High Risk
											</SelectItem>
										</SelectContent>
									</Select>
								</div>
							</CardContent>
						</Card>

						<div className="flex justify-center">
							<Button
								type="submit"
								size="lg"
								disabled={isLoading}
								data-testid="button-auto-populate"
								className="min-w-[200px]"
							>
								{isLoading ? (
									<>
										<Loader2 className="h-4 w-4 animate-spin mr-2" />
										Auto-Populating...
									</>
								) : (
									<>
										<CheckCircle className="h-4 w-4 mr-2" />
										Create Complete Profile
									</>
								)}
							</Button>
						</div>
					</form>
				)}

				{/* Results Display */}
				{autoPopulatedData && (
					<div className="space-y-6">
						<Card className="border-green-200 bg-green-50 dark:bg-green-900/20">
							<CardHeader>
								<CardTitle className="flex items-center gap-2 text-green-800 dark:text-green-200">
									<CheckCircle className="h-5 w-5" />
									Profile Successfully Created!
								</CardTitle>
							</CardHeader>
							<CardContent>
								<div className="grid grid-cols-1 md:grid-cols-3 gap-4">
									<div className="text-center">
										<div className="text-2xl font-bold text-green-700 dark:text-green-300">
											{autoPopulatedData.personalInfo?.dataPoints || 0}
										</div>
										<div className="text-sm text-green-600 dark:text-green-400">
											Personal Details
										</div>
									</div>
									<div className="text-center">
										<div className="text-2xl font-bold text-blue-700 dark:text-blue-300">
											{autoPopulatedData.bankingData?.accounts?.length || 0}
										</div>
										<div className="text-sm text-blue-600 dark:text-blue-400">
											Bank Accounts
										</div>
									</div>
									<div className="text-center">
										<div className="text-2xl font-bold text-purple-700 dark:text-purple-300">
											{autoPopulatedData.productRecommendations?.length || 0}
										</div>
										<div className="text-sm text-purple-600 dark:text-purple-400">
											Product Matches
										</div>
									</div>
								</div>
							</CardContent>
						</Card>

						{/* Auto-populated Data Summary */}
						<div className="grid grid-cols-1 md:grid-cols-2 gap-6">
							{/* Banking Data */}
							{autoPopulatedData.bankingData && (
								<Card>
									<CardHeader>
										<CardTitle className="flex items-center gap-2">
											<Building className="h-5 w-5" />
											Banking Information
										</CardTitle>
									</CardHeader>
									<CardContent>
										<div className="space-y-2 text-sm">
											<div className="flex justify-between">
												<span>Total Balance:</span>
												<span className="font-semibold">
													₹
													{autoPopulatedData.bankingData.totalBalance?.toLocaleString()}
												</span>
											</div>
											<div className="flex justify-between">
												<span>Monthly Average:</span>
												<span>
													₹
													{autoPopulatedData.bankingData.monthlyAverage?.toLocaleString()}
												</span>
											</div>
											<div className="flex justify-between">
												<span>Risk Profile:</span>
												<span className="capitalize">
													{autoPopulatedData.bankingData.inferredRiskProfile}
												</span>
											</div>
										</div>
									</CardContent>
								</Card>
							)}

							{/* Product Recommendations */}
							{autoPopulatedData.productRecommendations && (
								<Card>
									<CardHeader>
										<CardTitle>Recommended Products</CardTitle>
									</CardHeader>
									<CardContent>
										<div className="space-y-2">
											{autoPopulatedData.productRecommendations
												.slice(0, 5)
												.map((product: any, index: number) => (
													<div
														key={index}
														className="flex justify-between items-center text-sm"
													>
														<span>{product.name}</span>
														<span className="text-xs bg-blue-100 dark:bg-blue-900 px-2 py-1 rounded">
															{product.matchScore}% match
														</span>
													</div>
												))}
										</div>
									</CardContent>
								</Card>
							)}
						</div>

						<div className="flex justify-center space-x-4">
							<Button
								onClick={() => (window.location.href = "/portfolio")}
								data-testid="button-view-portfolio"
							>
								View Portfolio
							</Button>
							<Button
								variant="outline"
								onClick={() => (window.location.href = "/store")}
								data-testid="button-browse-products"
							>
								Browse Products
							</Button>
						</div>
					</div>
				)}
			</div>
		</div>
	);
}
