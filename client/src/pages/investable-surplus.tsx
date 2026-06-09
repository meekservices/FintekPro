import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
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
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
	DialogTrigger,
} from "@/components/ui/dialog";
import {
	Form,
	FormControl,
	FormField,
	FormItem,
	FormLabel,
	FormMessage,
} from "@/components/ui/form";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
	TrendingUp,
	TrendingDown,
	Wallet,
	AlertTriangle,
	CheckCircle,
	DollarSign,
	PiggyBank,
	CreditCard,
	Users,
	Calculator,
	Plus,
	Trash2,
	Edit,
	RefreshCw,
	Shield as LucideShield,
	Target,
	Landmark,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { apiRequest, queryClient } from "@/lib/queryClient";
import {
	ResponsiveContainer,
	PieChart,
	Pie,
	Cell,
	BarChart,
	Bar,
	XAxis,
	YAxis,
	CartesianGrid,
	Tooltip,
	Legend,
} from "recharts";

const incomeFormSchema = z.object({
	incomeType: z.string().min(1, "Income type is required"),
	sourceName: z.string().min(1, "Source name is required"),
	grossAmount: z.string().min(1, "Gross amount is required"),
	netAmount: z.string().min(1, "Net amount is required"),
	frequency: z.string().default("monthly"),
	stabilityScore: z.number().min(0).max(100).default(100),
});

const obligationFormSchema = z.object({
	obligationType: z.string().min(1, "Type is required"),
	creditorName: z.string().min(1, "Creditor name is required"),
	monthlyAmount: z.string().min(1, "Monthly amount is required"),
	totalOutstanding: z.string().optional(),
	tenureMonths: z.number().optional(),
});

const emergencyFundSchema = z.object({
	monthlyExpenses: z.string().min(1, "Monthly expenses is required"),
	currentEmergencyFund: z.string().min(1, "Current fund amount is required"),
	fundLocation: z.string().optional(),
	fundType: z.string().optional(),
});

const INCOME_TYPES = [
	{ value: "salary", label: "Salary" },
	{ value: "business", label: "Business Income" },
	{ value: "rental", label: "Rental Income" },
	{ value: "interest", label: "Interest Income" },
	{ value: "dividend", label: "Dividend Income" },
	{ value: "other", label: "Other Income" },
];

const OBLIGATION_TYPES = [
	{ value: "home_loan", label: "Home Loan EMI" },
	{ value: "car_loan", label: "Car Loan EMI" },
	{ value: "personal_loan", label: "Personal Loan EMI" },
	{ value: "education_loan", label: "Education Loan EMI" },
	{ value: "credit_card", label: "Credit Card Payment" },
	{ value: "insurance_premium", label: "Insurance Premium" },
	{ value: "rent", label: "Rent" },
	{ value: "utility", label: "Utilities" },
	{ value: "maintenance", label: "Maintenance" },
	{ value: "other_emi", label: "Other EMI" },
];

const SEGMENT_COLORS = {
	retail: "bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-200",
	hni: "bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-200",
	shni: "bg-purple-100 dark:bg-purple-900/30 text-purple-800 dark:text-purple-200",
	bhni: "bg-amber-100 dark:bg-amber-900/30 text-amber-800 dark:text-amber-200",
	corporate: "bg-muted text-foreground",
};

const SEGMENT_DESCRIPTIONS = {
	retail: "Retail Investor (< ₹25L surplus)",
	hni: "High Net-Worth Individual (₹25L - ₹1Cr)",
	shni: "Super HNI (₹1Cr - ₹5Cr)",
	bhni: "Big HNI (₹5Cr+)",
	corporate: "Corporate Treasury",
};

const PIE_COLORS = [
	"#3B82F6",
	"#10B981",
	"#F59E0B",
	"#EF4444",
	"#8B5CF6",
	"#06B6D4",
];

export default function InvestableSurplusPage() {
	const { toast } = useToast();
	const { user } = useAuth();
	const [activeTab, setActiveTab] = useState("overview");
	const [incomeDialogOpen, setIncomeDialogOpen] = useState(false);
	const [obligationDialogOpen, setObligationDialogOpen] = useState(false);
	const [emergencyDialogOpen, setEmergencyDialogOpen] = useState(false);

	// Get user ID from auth context
	const userId = user?.id || "";

	const {
		data: summary,
		isLoading,
		refetch,
	} = useQuery({
		queryKey: ["/api/surplus/summary", userId],
		queryFn: async () => {
			const res = await fetch(`/api/surplus/summary/${userId}`);
			if (!res.ok) throw new Error("Failed to fetch summary");
			return res.json();
		},
	});

	const addIncomeMutation = useMutation({
		mutationFn: async (data: z.infer<typeof incomeFormSchema>) => {
			return apiRequest("/api/surplus/income-streams", {
				method: "POST",
				body: JSON.stringify({ ...data, userId }),
			});
		},
		onSuccess: () => {
			queryClient.invalidateQueries({
				queryKey: ["/api/surplus/summary", userId],
			});
			setIncomeDialogOpen(false);
			toast({
				title: "Income stream added",
				description: "Your income has been recorded.",
			});
		},
		onError: (error: any) => {
			toast({
				title: "Error",
				description: error.message,
				variant: "destructive",
			});
		},
	});

	const addObligationMutation = useMutation({
		mutationFn: async (data: z.infer<typeof obligationFormSchema>) => {
			return apiRequest("/api/surplus/obligations", {
				method: "POST",
				body: JSON.stringify({ ...data, userId }),
			});
		},
		onSuccess: () => {
			queryClient.invalidateQueries({
				queryKey: ["/api/surplus/summary", userId],
			});
			setObligationDialogOpen(false);
			toast({
				title: "Obligation added",
				description: "Your obligation has been recorded.",
			});
		},
		onError: (error: any) => {
			toast({
				title: "Error",
				description: error.message,
				variant: "destructive",
			});
		},
	});

	const updateEmergencyFundMutation = useMutation({
		mutationFn: async (data: z.infer<typeof emergencyFundSchema>) => {
			return apiRequest("/api/surplus/emergency-fund", {
				method: "POST",
				body: JSON.stringify({ ...data, userId }),
			});
		},
		onSuccess: () => {
			queryClient.invalidateQueries({
				queryKey: ["/api/surplus/summary", userId],
			});
			setEmergencyDialogOpen(false);
			toast({
				title: "Emergency fund updated",
				description: "Your emergency fund details have been saved.",
			});
		},
		onError: (error: any) => {
			toast({
				title: "Error",
				description: error.message,
				variant: "destructive",
			});
		},
	});

	const recalculateMutation = useMutation({
		mutationFn: async () => {
			return apiRequest(`/api/surplus/surplus/assess/${userId}`, {
				method: "POST",
			});
		},
		onSuccess: () => {
			queryClient.invalidateQueries({
				queryKey: ["/api/surplus/summary", userId],
			});
			toast({
				title: "Assessment complete",
				description: "Your investable surplus has been recalculated.",
			});
		},
		onError: (error: any) => {
			toast({
				title: "Error",
				description: error.message,
				variant: "destructive",
			});
		},
	});

	const incomeForm = useForm<
		z.infer<typeof incomeFormSchema>,
		any,
		z.infer<typeof incomeFormSchema>
	>({
		resolver: zodResolver(incomeFormSchema) as any,
		defaultValues: {
			incomeType: "",
			sourceName: "",
			grossAmount: "",
			netAmount: "",
			frequency: "monthly",
			stabilityScore: 100,
		},
	});

	const obligationForm = useForm<
		z.infer<typeof obligationFormSchema>,
		any,
		z.infer<typeof obligationFormSchema>
	>({
		resolver: zodResolver(obligationFormSchema),
		defaultValues: {
			obligationType: "",
			creditorName: "",
			monthlyAmount: "",
			totalOutstanding: "",
			tenureMonths: 0,
		},
	});

	const emergencyForm = useForm<
		z.infer<typeof emergencyFundSchema>,
		any,
		z.infer<typeof emergencyFundSchema>
	>({
		resolver: zodResolver(emergencyFundSchema),
		defaultValues: {
			monthlyExpenses: "",
			currentEmergencyFund: "",
			fundLocation: "",
			fundType: "savings",
		},
	});

	const formatCurrency = (amount: number) => {
		if (amount >= 10000000) return `₹${(amount / 10000000).toFixed(2)} Cr`;
		if (amount >= 100000) return `₹${(amount / 100000).toFixed(2)} L`;
		return `₹${amount.toLocaleString("en-IN")}`;
	};

	const liveCalc = summary?.liveCalculation;
	const segment = summary?.segment;
	const emergencyFund = summary?.emergencyFund;

	const incomeBreakdownData = liveCalc?.incomeBreakdown
		? Object.entries(liveCalc.incomeBreakdown)
				.filter(([_, value]) => (value as number) > 0)
				.map(([key, value]) => ({
					name: key.charAt(0).toUpperCase() + key.slice(1),
					value: value as number,
				}))
		: [];

	const obligationsBreakdownData = liveCalc?.obligationsBreakdown
		? Object.entries(liveCalc.obligationsBreakdown)
				.filter(([_, value]) => (value as number) > 0)
				.map(([key, value]) => ({
					name: key.charAt(0).toUpperCase() + key.slice(1),
					value: value as number,
				}))
		: [];

	const surplusFlowData = [
		{ name: "Gross Income", amount: liveCalc?.totalGrossIncome || 0 },
		{
			name: "Tax Deductions",
			amount:
				(liveCalc?.totalGrossIncome || 0) - (liveCalc?.totalNetIncome || 0),
		},
		{ name: "Obligations", amount: liveCalc?.totalObligations || 0 },
		{ name: "Emergency Buffer", amount: liveCalc?.emergencyBufferAmount || 0 },
		{
			name: "Investable Surplus",
			amount: liveCalc?.annualInvestableSurplus || 0,
		},
	];

	if (isLoading) {
		return (
			<div className="flex items-center justify-center h-[600px]">
				<RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
			</div>
		);
	}

	return (
		<div className="container mx-auto p-6 space-y-6">
			<div className="flex items-center justify-between">
				<div>
					<h1 className="text-3xl font-bold" data-testid="page-title">
						Investable Surplus Engine
					</h1>
					<p className="text-muted-foreground">
						Calculate your real investable capacity based on income,
						obligations, and emergency reserves.
					</p>
				</div>
				<div className="flex gap-2">
					<Button
						variant="outline"
						onClick={() => refetch()}
						data-testid="button-refresh"
					>
						<RefreshCw className="h-4 w-4 mr-2" />
						Refresh
					</Button>
					<Button
						onClick={() => recalculateMutation.mutate()}
						disabled={recalculateMutation.isPending}
						data-testid="button-recalculate"
					>
						<Calculator className="h-4 w-4 mr-2" />
						Recalculate & Save
					</Button>
				</div>
			</div>

			{/* Key Metrics Cards */}
			<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
				<Card data-testid="card-net-income">
					<CardHeader className="flex flex-row items-center justify-between pb-2">
						<CardTitle className="text-sm font-medium">
							Annual Net Income
						</CardTitle>
						<DollarSign className="h-4 w-4 text-muted-foreground" />
					</CardHeader>
					<CardContent>
						<div className="text-2xl font-bold text-green-600">
							{formatCurrency(liveCalc?.totalNetIncome || 0)}
						</div>
						<p className="text-xs text-muted-foreground">
							After tax deductions
						</p>
					</CardContent>
				</Card>

				<Card data-testid="card-obligations">
					<CardHeader className="flex flex-row items-center justify-between pb-2">
						<CardTitle className="text-sm font-medium">
							Annual Obligations
						</CardTitle>
						<CreditCard className="h-4 w-4 text-muted-foreground" />
					</CardHeader>
					<CardContent>
						<div className="text-2xl font-bold text-red-600">
							{formatCurrency(liveCalc?.totalObligations || 0)}
						</div>
						<p className="text-xs text-muted-foreground">
							EMIs, rent, insurance, etc.
						</p>
					</CardContent>
				</Card>

				<Card data-testid="card-surplus">
					<CardHeader className="flex flex-row items-center justify-between pb-2">
						<CardTitle className="text-sm font-medium">
							Monthly Investable Surplus
						</CardTitle>
						<Wallet className="h-4 w-4 text-muted-foreground" />
					</CardHeader>
					<CardContent>
						<div className="text-2xl font-bold text-blue-600">
							{formatCurrency(liveCalc?.monthlyInvestableSurplus || 0)}
						</div>
						<p className="text-xs text-muted-foreground">Available for SIPs</p>
					</CardContent>
				</Card>

				<Card data-testid="card-segment">
					<CardHeader className="flex flex-row items-center justify-between pb-2">
						<CardTitle className="text-sm font-medium">
							Client Segment
						</CardTitle>
						<Users className="h-4 w-4 text-muted-foreground" />
					</CardHeader>
					<CardContent>
						<div className="flex items-center gap-2">
							<Badge
								className={
									SEGMENT_COLORS[
										segment?.segment as keyof typeof SEGMENT_COLORS
									] || "bg-muted"
								}
							>
								{(segment?.segment || "retail").toUpperCase()}
							</Badge>
						</div>
						<p className="text-xs text-muted-foreground mt-1">
							{SEGMENT_DESCRIPTIONS[
								segment?.segment as keyof typeof SEGMENT_DESCRIPTIONS
							] || "Retail Investor"}
						</p>
					</CardContent>
				</Card>
			</div>

			{/* Emergency Fund Status Alert */}
			{emergencyFund && (
				<Alert
					variant={
						emergencyFund.status === "adequate" ? "default" : "destructive"
					}
					data-testid="alert-emergency-fund"
				>
					<LucideShield className="h-4 w-4" />
					<AlertTitle>
						Emergency Fund Status:{" "}
						{(emergencyFund.status || "unknown").toUpperCase()}
					</AlertTitle>
					<AlertDescription className="flex items-center justify-between">
						<span>
							Coverage: {emergencyFund.coverageMonths.toFixed(1)} months |
							Current: {formatCurrency(emergencyFund.current)} | Required:{" "}
							{formatCurrency(emergencyFund.required)}
						</span>
						<Dialog
							open={emergencyDialogOpen}
							onOpenChange={setEmergencyDialogOpen}
						>
							<DialogTrigger asChild>
								<Button
									variant="outline"
									size="sm"
									data-testid="button-update-emergency"
								>
									<Edit className="h-3 w-3 mr-1" /> Update
								</Button>
							</DialogTrigger>
							<DialogContent>
								<DialogHeader>
									<DialogTitle>Update Emergency Fund</DialogTitle>
									<DialogDescription>
										Recommended: 6 months of expenses in liquid savings
									</DialogDescription>
								</DialogHeader>
								<Form {...emergencyForm}>
									<form
										onSubmit={emergencyForm.handleSubmit((data) =>
											updateEmergencyFundMutation.mutate(data),
										)}
										className="space-y-4"
									>
										<FormField
											control={emergencyForm.control}
											name="monthlyExpenses"
											render={({ field }) => (
												<FormItem>
													<FormLabel>Monthly Expenses (₹)</FormLabel>
													<FormControl>
														<Input
															type="number"
															placeholder="50000"
															{...field}
															data-testid="input-monthly-expenses"
														/>
													</FormControl>
													<FormMessage />
												</FormItem>
											)}
										/>
										<FormField
											control={emergencyForm.control}
											name="currentEmergencyFund"
											render={({ field }) => (
												<FormItem>
													<FormLabel>Current Emergency Fund (₹)</FormLabel>
													<FormControl>
														<Input
															type="number"
															placeholder="300000"
															{...field}
															data-testid="input-emergency-fund"
														/>
													</FormControl>
													<FormMessage />
												</FormItem>
											)}
										/>
										<FormField
											control={emergencyForm.control}
											name="fundLocation"
											render={({ field }) => (
												<FormItem>
													<FormLabel>Fund Location</FormLabel>
													<FormControl>
														<Input
															placeholder="HDFC Savings Account"
															{...field}
															data-testid="input-fund-location"
														/>
													</FormControl>
													<FormMessage />
												</FormItem>
											)}
										/>
										<DialogFooter>
											<Button
												type="submit"
												disabled={updateEmergencyFundMutation.isPending}
												data-testid="button-save-emergency"
											>
												Save Changes
											</Button>
										</DialogFooter>
									</form>
								</Form>
							</DialogContent>
						</Dialog>
					</AlertDescription>
				</Alert>
			)}

			{/* Main Content Tabs */}
			<Tabs value={activeTab} onValueChange={setActiveTab}>
				<TabsList className="grid w-full grid-cols-5">
					<TabsTrigger value="overview" data-testid="tab-overview">
						Overview
					</TabsTrigger>
					<TabsTrigger value="income" data-testid="tab-income">
						Income
					</TabsTrigger>
					<TabsTrigger value="obligations" data-testid="tab-obligations">
						Obligations
					</TabsTrigger>
					<TabsTrigger value="eligibility" data-testid="tab-eligibility">
						Product Eligibility
					</TabsTrigger>
					<TabsTrigger
						value="recommendations"
						data-testid="tab-recommendations"
					>
						Recommendations
					</TabsTrigger>
				</TabsList>

				{/* Overview Tab */}
				<TabsContent value="overview" className="space-y-6">
					<div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
						{/* Cash Flow Breakdown */}
						<Card>
							<CardHeader>
								<CardTitle>Cash Flow Breakdown</CardTitle>
								<CardDescription>Annual income to surplus flow</CardDescription>
							</CardHeader>
							<CardContent>
								<ResponsiveContainer width="100%" height={300}>
									<BarChart data={surplusFlowData} layout="vertical">
										<CartesianGrid strokeDasharray="3 3" />
										<XAxis
											type="number"
											tickFormatter={(v) => formatCurrency(v)}
										/>
										<YAxis type="category" dataKey="name" width={120} />
										<Tooltip
											formatter={(value) => formatCurrency(value as number)}
										/>
										<Bar dataKey="amount" fill="#3B82F6" />
									</BarChart>
								</ResponsiveContainer>
							</CardContent>
						</Card>

						{/* Income Breakdown Pie */}
						<Card>
							<CardHeader>
								<CardTitle>Income Sources</CardTitle>
								<CardDescription>Distribution by category</CardDescription>
							</CardHeader>
							<CardContent>
								{incomeBreakdownData.length > 0 ? (
									<ResponsiveContainer width="100%" height={300}>
										<PieChart>
											<Pie
												data={incomeBreakdownData}
												cx="50%"
												cy="50%"
												innerRadius={60}
												outerRadius={100}
												paddingAngle={5}
												dataKey="value"
												label={({ name, percent }) =>
													`${name} ${(percent * 100).toFixed(0)}%`
												}
											>
												{incomeBreakdownData.map((_, index) => (
													<Cell
														key={`cell-${index}`}
														fill={PIE_COLORS[index % PIE_COLORS.length]}
													/>
												))}
											</Pie>
											<Tooltip
												formatter={(value) => formatCurrency(value as number)}
											/>
										</PieChart>
									</ResponsiveContainer>
								) : (
									<div className="flex items-center justify-center h-[300px] text-muted-foreground">
										No income streams added yet
									</div>
								)}
							</CardContent>
						</Card>

						{/* Surplus Stability */}
						<Card>
							<CardHeader>
								<CardTitle>Surplus Stability</CardTitle>
								<CardDescription>
									How reliable is your investable surplus?
								</CardDescription>
							</CardHeader>
							<CardContent className="space-y-4">
								<div className="flex items-center justify-between">
									<span>Stability Rating</span>
									<Badge
										variant={
											liveCalc?.surplusStability === "stable"
												? "default"
												: liveCalc?.surplusStability === "moderate"
													? "secondary"
													: "destructive"
										}
									>
										{(liveCalc?.surplusStability || "unknown").toUpperCase()}
									</Badge>
								</div>
								<div className="space-y-2">
									<div className="flex justify-between text-sm">
										<span>Confidence Score</span>
										<span>{liveCalc?.confidenceScore || 0}%</span>
									</div>
									<Progress value={liveCalc?.confidenceScore || 0} />
								</div>
								<div className="grid grid-cols-2 gap-4 pt-4">
									<div className="text-center p-3 bg-muted rounded-lg">
										<div className="text-2xl font-bold text-green-600">
											{formatCurrency(liveCalc?.monthlyInvestableSurplus || 0)}
										</div>
										<div className="text-xs text-muted-foreground">
											Monthly SIP Capacity
										</div>
									</div>
									<div className="text-center p-3 bg-muted rounded-lg">
										<div className="text-2xl font-bold text-blue-600">
											{formatCurrency(liveCalc?.annualInvestableSurplus || 0)}
										</div>
										<div className="text-xs text-muted-foreground">
											Annual Lumpsum
										</div>
									</div>
								</div>
							</CardContent>
						</Card>

						{/* Obligations Breakdown */}
						<Card>
							<CardHeader>
								<CardTitle>Obligations Breakdown</CardTitle>
								<CardDescription>Distribution by category</CardDescription>
							</CardHeader>
							<CardContent>
								{obligationsBreakdownData.length > 0 ? (
									<ResponsiveContainer width="100%" height={300}>
										<PieChart>
											<Pie
												data={obligationsBreakdownData}
												cx="50%"
												cy="50%"
												innerRadius={60}
												outerRadius={100}
												paddingAngle={5}
												dataKey="value"
												label={({ name, percent }) =>
													`${name} ${(percent * 100).toFixed(0)}%`
												}
											>
												{obligationsBreakdownData.map((_, index) => (
													<Cell
														key={`cell-${index}`}
														fill={PIE_COLORS[index % PIE_COLORS.length]}
													/>
												))}
											</Pie>
											<Tooltip
												formatter={(value) => formatCurrency(value as number)}
											/>
										</PieChart>
									</ResponsiveContainer>
								) : (
									<div className="flex items-center justify-center h-[300px] text-muted-foreground">
										No obligations added yet
									</div>
								)}
							</CardContent>
						</Card>
					</div>
				</TabsContent>

				{/* Income Tab */}
				<TabsContent value="income" className="space-y-4">
					<div className="flex justify-between items-center">
						<h3 className="text-lg font-semibold">Income Streams</h3>
						<Dialog open={incomeDialogOpen} onOpenChange={setIncomeDialogOpen}>
							<DialogTrigger asChild>
								<Button data-testid="button-add-income">
									<Plus className="h-4 w-4 mr-2" /> Add Income
								</Button>
							</DialogTrigger>
							<DialogContent>
								<DialogHeader>
									<DialogTitle>Add Income Stream</DialogTitle>
									<DialogDescription>
										Enter details about your income source
									</DialogDescription>
								</DialogHeader>
								<Form {...incomeForm}>
									<form
										onSubmit={incomeForm.handleSubmit((data) =>
											addIncomeMutation.mutate(data),
										)}
										className="space-y-4"
									>
										<FormField
											control={incomeForm.control}
											name="incomeType"
											render={({ field }) => (
												<FormItem>
													<FormLabel>Income Type</FormLabel>
													<Select
														onValueChange={field.onChange}
														defaultValue={field.value}
													>
														<FormControl>
															<SelectTrigger data-testid="select-income-type">
																<SelectValue placeholder="Select type" />
															</SelectTrigger>
														</FormControl>
														<SelectContent>
															{INCOME_TYPES.map((type) => (
																<SelectItem key={type.value} value={type.value}>
																	{type.label}
																</SelectItem>
															))}
														</SelectContent>
													</Select>
													<FormMessage />
												</FormItem>
											)}
										/>
										<FormField
											control={incomeForm.control}
											name="sourceName"
											render={({ field }) => (
												<FormItem>
													<FormLabel>Source Name</FormLabel>
													<FormControl>
														<Input
															placeholder="e.g., TCS Ltd"
															{...field}
															data-testid="input-source-name"
														/>
													</FormControl>
													<FormMessage />
												</FormItem>
											)}
										/>
										<div className="grid grid-cols-2 gap-4">
											<FormField
												control={incomeForm.control}
												name="grossAmount"
												render={({ field }) => (
													<FormItem>
														<FormLabel>Gross Amount (₹)</FormLabel>
														<FormControl>
															<Input
																type="number"
																placeholder="100000"
																{...field}
																data-testid="input-gross-amount"
															/>
														</FormControl>
														<FormMessage />
													</FormItem>
												)}
											/>
											<FormField
												control={incomeForm.control}
												name="netAmount"
												render={({ field }) => (
													<FormItem>
														<FormLabel>Net Amount (₹)</FormLabel>
														<FormControl>
															<Input
																type="number"
																placeholder="80000"
																{...field}
																data-testid="input-net-amount"
															/>
														</FormControl>
														<FormMessage />
													</FormItem>
												)}
											/>
										</div>
										<FormField
											control={incomeForm.control}
											name="frequency"
											render={({ field }) => (
												<FormItem>
													<FormLabel>Frequency</FormLabel>
													<Select
														onValueChange={field.onChange}
														defaultValue={field.value}
													>
														<FormControl>
															<SelectTrigger data-testid="select-frequency">
																<SelectValue placeholder="Select frequency" />
															</SelectTrigger>
														</FormControl>
														<SelectContent>
															<SelectItem value="monthly">Monthly</SelectItem>
															<SelectItem value="quarterly">
																Quarterly
															</SelectItem>
															<SelectItem value="annually">Annually</SelectItem>
															<SelectItem value="one_time">One Time</SelectItem>
														</SelectContent>
													</Select>
													<FormMessage />
												</FormItem>
											)}
										/>
										<DialogFooter>
											<Button
												type="submit"
												disabled={addIncomeMutation.isPending}
												data-testid="button-save-income"
											>
												Add Income
											</Button>
										</DialogFooter>
									</form>
								</Form>
							</DialogContent>
						</Dialog>
					</div>

					<div className="grid gap-4">
						{summary?.incomeStreams?.length > 0 ? (
							summary.incomeStreams.map((stream: any) => (
								<Card key={stream.id} data-testid={`card-income-${stream.id}`}>
									<CardContent className="flex items-center justify-between py-4">
										<div className="flex items-center gap-4">
											<div className="p-2 rounded-full bg-green-100 dark:bg-green-900/30">
												<TrendingUp className="h-5 w-5 text-green-600" />
											</div>
											<div>
												<h4 className="font-medium">{stream.sourceName}</h4>
												<p className="text-sm text-muted-foreground">
													{
														INCOME_TYPES.find(
															(t) => t.value === stream.incomeType,
														)?.label
													}{" "}
													• {stream.frequency}
												</p>
											</div>
										</div>
										<div className="text-right">
											<div className="font-bold text-green-600">
												{formatCurrency(
													Number.parseFloat(stream.netAmount || "0"),
												)}
											</div>
											<div className="text-xs text-muted-foreground">
												Net ({stream.frequency})
											</div>
										</div>
									</CardContent>
								</Card>
							))
						) : (
							<Card>
								<CardContent className="py-12 text-center">
									<DollarSign className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
									<h3 className="font-medium mb-2">No income streams yet</h3>
									<p className="text-sm text-muted-foreground mb-4">
										Add your income sources to calculate investable surplus
									</p>
									<Button
										onClick={() => setIncomeDialogOpen(true)}
										data-testid="button-add-first-income"
									>
										<Plus className="h-4 w-4 mr-2" /> Add First Income
									</Button>
								</CardContent>
							</Card>
						)}
					</div>
				</TabsContent>

				{/* Obligations Tab */}
				<TabsContent value="obligations" className="space-y-4">
					<div className="flex justify-between items-center">
						<h3 className="text-lg font-semibold">Financial Obligations</h3>
						<Dialog
							open={obligationDialogOpen}
							onOpenChange={setObligationDialogOpen}
						>
							<DialogTrigger asChild>
								<Button data-testid="button-add-obligation">
									<Plus className="h-4 w-4 mr-2" /> Add Obligation
								</Button>
							</DialogTrigger>
							<DialogContent>
								<DialogHeader>
									<DialogTitle>Add Financial Obligation</DialogTitle>
									<DialogDescription>
										Enter details about your financial commitment
									</DialogDescription>
								</DialogHeader>
								<Form {...obligationForm}>
									<form
										onSubmit={obligationForm.handleSubmit((data) =>
											addObligationMutation.mutate(data),
										)}
										className="space-y-4"
									>
										<FormField
											control={obligationForm.control}
											name="obligationType"
											render={({ field }) => (
												<FormItem>
													<FormLabel>Obligation Type</FormLabel>
													<Select
														onValueChange={field.onChange}
														defaultValue={field.value}
													>
														<FormControl>
															<SelectTrigger data-testid="select-obligation-type">
																<SelectValue placeholder="Select type" />
															</SelectTrigger>
														</FormControl>
														<SelectContent>
															{OBLIGATION_TYPES.map((type) => (
																<SelectItem key={type.value} value={type.value}>
																	{type.label}
																</SelectItem>
															))}
														</SelectContent>
													</Select>
													<FormMessage />
												</FormItem>
											)}
										/>
										<FormField
											control={obligationForm.control}
											name="creditorName"
											render={({ field }) => (
												<FormItem>
													<FormLabel>Creditor Name</FormLabel>
													<FormControl>
														<Input
															placeholder="e.g., HDFC Bank"
															{...field}
															data-testid="input-creditor-name"
														/>
													</FormControl>
													<FormMessage />
												</FormItem>
											)}
										/>
										<FormField
											control={obligationForm.control}
											name="monthlyAmount"
											render={({ field }) => (
												<FormItem>
													<FormLabel>Monthly Amount (₹)</FormLabel>
													<FormControl>
														<Input
															type="number"
															placeholder="25000"
															{...field}
															data-testid="input-monthly-amount"
														/>
													</FormControl>
													<FormMessage />
												</FormItem>
											)}
										/>
										<FormField
											control={obligationForm.control}
											name="totalOutstanding"
											render={({ field }) => (
												<FormItem>
													<FormLabel>
														Total Outstanding (₹) - Optional
													</FormLabel>
													<FormControl>
														<Input
															type="number"
															placeholder="2500000"
															{...field}
															data-testid="input-outstanding"
														/>
													</FormControl>
													<FormMessage />
												</FormItem>
											)}
										/>
										<DialogFooter>
											<Button
												type="submit"
												disabled={addObligationMutation.isPending}
												data-testid="button-save-obligation"
											>
												Add Obligation
											</Button>
										</DialogFooter>
									</form>
								</Form>
							</DialogContent>
						</Dialog>
					</div>

					<div className="grid gap-4">
						{summary?.obligations?.length > 0 ? (
							summary.obligations.map((obligation: any) => (
								<Card
									key={obligation.id}
									data-testid={`card-obligation-${obligation.id}`}
								>
									<CardContent className="flex items-center justify-between py-4">
										<div className="flex items-center gap-4">
											<div className="p-2 rounded-full bg-red-100 dark:bg-red-900/30">
												<CreditCard className="h-5 w-5 text-red-600" />
											</div>
											<div>
												<h4 className="font-medium">
													{obligation.creditorName}
												</h4>
												<p className="text-sm text-muted-foreground">
													{
														OBLIGATION_TYPES.find(
															(t) => t.value === obligation.obligationType,
														)?.label
													}
												</p>
											</div>
										</div>
										<div className="text-right">
											<div className="font-bold text-red-600">
												{formatCurrency(
													Number.parseFloat(obligation.monthlyAmount || "0"),
												)}
											</div>
											<div className="text-xs text-muted-foreground">
												per month
											</div>
										</div>
									</CardContent>
								</Card>
							))
						) : (
							<Card>
								<CardContent className="py-12 text-center">
									<CreditCard className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
									<h3 className="font-medium mb-2">No obligations recorded</h3>
									<p className="text-sm text-muted-foreground mb-4">
										Add your EMIs, rent, and other financial commitments
									</p>
									<Button
										onClick={() => setObligationDialogOpen(true)}
										data-testid="button-add-first-obligation"
									>
										<Plus className="h-4 w-4 mr-2" /> Add First Obligation
									</Button>
								</CardContent>
							</Card>
						)}
					</div>
				</TabsContent>

				{/* Product Eligibility Tab */}
				<TabsContent value="eligibility" className="space-y-4">
					<Card>
						<CardHeader>
							<CardTitle className="flex items-center gap-2">
								<Target className="h-5 w-5" />
								Product Eligibility Based on Your Segment
							</CardTitle>
							<CardDescription>
								Your segment:{" "}
								{SEGMENT_DESCRIPTIONS[
									segment?.segment as keyof typeof SEGMENT_DESCRIPTIONS
								] || "Retail Investor"}
							</CardDescription>
						</CardHeader>
						<CardContent>
							<div className="space-y-6">
								<div>
									<h4 className="font-medium mb-3 flex items-center gap-2">
										<CheckCircle className="h-4 w-4 text-green-500" /> Eligible
										Products
									</h4>
									<div className="flex flex-wrap gap-2">
										{segment?.eligibleProducts?.map((product: string) => (
											<Badge
												key={product}
												variant="secondary"
												className="bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-200"
											>
												{product.replace(/_/g, " ").toUpperCase()}
											</Badge>
										)) || (
											<span className="text-muted-foreground">
												All retail products
											</span>
										)}
									</div>
								</div>

								<div>
									<h4 className="font-medium mb-3 flex items-center gap-2">
										<AlertTriangle className="h-4 w-4 text-amber-500" />{" "}
										Restricted Products
									</h4>
									<div className="flex flex-wrap gap-2">
										{segment?.restrictedProducts?.map((product: string) => (
											<Badge
												key={product}
												variant="secondary"
												className="bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-200"
											>
												{product.replace(/_/g, " ").toUpperCase()}
											</Badge>
										)) || <span className="text-muted-foreground">None</span>}
									</div>
								</div>

								{segment?.investmentCaps &&
									Object.values(segment.investmentCaps).some(
										(v: any) => v !== null,
									) && (
										<div>
											<h4 className="font-medium mb-3 flex items-center gap-2">
												<Landmark className="h-4 w-4 text-blue-500" />{" "}
												Investment Caps
											</h4>
											<div className="grid grid-cols-2 md:grid-cols-4 gap-4">
												{Object.entries(
													segment.investmentCaps as Record<
														string,
														number | null
													>,
												)
													.filter(([_, value]) => value !== null)
													.map(([key, value]) => (
														<div
															key={key}
															className="p-3 bg-muted rounded-lg text-center"
														>
															<div className="text-lg font-bold">
																{formatCurrency(value as number)}
															</div>
															<div className="text-xs text-muted-foreground">
																{key.toUpperCase()} min
															</div>
														</div>
													))}
											</div>
										</div>
									)}
							</div>
						</CardContent>
					</Card>
				</TabsContent>

				{/* Recommendations Tab */}
				<TabsContent value="recommendations" className="space-y-4">
					<div className="grid gap-4">
						{liveCalc?.recommendations?.immediate?.length > 0 && (
							<Card>
								<CardHeader>
									<CardTitle className="flex items-center gap-2 text-red-600">
										<AlertTriangle className="h-5 w-5" /> Immediate Actions
									</CardTitle>
								</CardHeader>
								<CardContent>
									<ul className="space-y-2">
										{liveCalc.recommendations.immediate.map(
											(rec: string, i: number) => (
												<li key={i} className="flex items-start gap-2">
													<span className="text-red-600">•</span>
													{rec}
												</li>
											),
										)}
									</ul>
								</CardContent>
							</Card>
						)}

						{liveCalc?.recommendations?.shortTerm?.length > 0 && (
							<Card>
								<CardHeader>
									<CardTitle className="flex items-center gap-2 text-amber-600">
										<Target className="h-5 w-5" /> Short-term Goals (1-3 months)
									</CardTitle>
								</CardHeader>
								<CardContent>
									<ul className="space-y-2">
										{liveCalc.recommendations.shortTerm.map(
											(rec: string, i: number) => (
												<li key={i} className="flex items-start gap-2">
													<span className="text-amber-600">•</span>
													{rec}
												</li>
											),
										)}
									</ul>
								</CardContent>
							</Card>
						)}

						{liveCalc?.recommendations?.longTerm?.length > 0 && (
							<Card>
								<CardHeader>
									<CardTitle className="flex items-center gap-2 text-green-600">
										<TrendingUp className="h-5 w-5" /> Long-term Objectives
									</CardTitle>
								</CardHeader>
								<CardContent>
									<ul className="space-y-2">
										{liveCalc.recommendations.longTerm.map(
											(rec: string, i: number) => (
												<li key={i} className="flex items-start gap-2">
													<span className="text-green-600">•</span>
													{rec}
												</li>
											),
										)}
									</ul>
								</CardContent>
							</Card>
						)}

						{!liveCalc?.recommendations?.immediate?.length &&
							!liveCalc?.recommendations?.shortTerm?.length &&
							!liveCalc?.recommendations?.longTerm?.length && (
								<Card>
									<CardContent className="py-12 text-center">
										<CheckCircle className="h-12 w-12 mx-auto text-green-500 mb-4" />
										<h3 className="font-medium mb-2">
											Add your financial data
										</h3>
										<p className="text-sm text-muted-foreground">
											Add income streams and obligations to get personalized
											recommendations
										</p>
									</CardContent>
								</Card>
							)}
					</div>
				</TabsContent>
			</Tabs>
		</div>
	);
}
