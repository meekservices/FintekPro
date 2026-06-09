import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
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
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Tabs, TabsContent, TabsTrigger } from "@/components/ui/tabs";
import { ScrollableTabsList } from "@/components/ScrollableTabsList";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
	Dialog,
	DialogContent,
	DialogDescription,
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
	Loader2,
	Shield as LucideShield,
	Users,
	Building2,
	Vote,
	TrendingUp,
	ArrowUpCircle,
	ArrowDownCircle,
	FileCheck,
	CreditCard,
	Database,
	CheckCircle,
	XCircle,
	Clock,
	AlertTriangle,
	Phone,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";

// Form Schemas
const accountSetupSchema = z.object({
	clientName: z.string().min(1, "Client name is required"),
	pan: z.string().regex(/^[A-Z]{5}[0-9]{4}[A-Z]{1}$/, "Invalid PAN format"),
	mobile: z.string().regex(/^[6-9]\d{9}$/, "Invalid mobile number"),
	email: z.string().email("Invalid email address"),
	address: z.string().min(1, "Address is required"),
	nomineeName: z.string().optional(),
	nomineeRelation: z.string().optional(),
});

const edisConsentSchema = z.object({
	boId: z.string().min(1, "BO ID is required"),
	isin: z.string().min(1, "ISIN is required"),
	quantity: z.string().min(1, "Quantity is required"),
	clientCode: z.string().min(1, "Client code is required"),
	executionDate: z.string().min(1, "Execution date is required"),
	tpin: z.string().length(6, "TPIN must be 6 digits"),
});

const pledgeSchema = z.object({
	boId: z.string().min(1, "BO ID is required"),
	isin: z.string().min(1, "ISIN is required"),
	quantity: z.string().min(1, "Quantity is required"),
	pledgeeClientCode: z.string().min(1, "Pledgee client code is required"),
	pledgeReason: z.string().optional(),
	tpin: z.string().length(6, "TPIN must be 6 digits"),
});

const elasSchema = z.object({
	boId: z.string().min(1, "BO ID is required"),
	lenderCode: z.string().min(1, "Lender code is required"),
	loanAmount: z.string().min(1, "Loan amount is required"),
	purpose: z.string().optional(),
	tpin: z.string().length(6, "TPIN must be 6 digits"),
});

export default function CDSLServices() {
	const { toast } = useToast();
	const queryClient = useQueryClient();
	const [selectedBoId, setSelectedBoId] = useState("1756285624077"); // Demo BO ID
	const [showTpinDialog, setShowTpinDialog] = useState(false);
	const [tpinMobile, setTpinMobile] = useState("");

	// Account Setup Form
	const accountForm = useForm<z.infer<typeof accountSetupSchema>>({
		resolver: zodResolver(accountSetupSchema),
		defaultValues: {
			clientName: "",
			pan: "",
			mobile: "",
			email: "",
			address: "",
			nomineeName: "",
			nomineeRelation: "",
		},
	});

	// eDIS Consent Form
	const edisForm = useForm<z.infer<typeof edisConsentSchema>>({
		resolver: zodResolver(edisConsentSchema),
		defaultValues: {
			boId: selectedBoId,
			isin: "",
			quantity: "",
			clientCode: "",
			executionDate: new Date().toISOString().split("T")[0],
			tpin: "",
		},
	});

	// Pledge Creation Form
	const pledgeForm = useForm<z.infer<typeof pledgeSchema>>({
		resolver: zodResolver(pledgeSchema),
		defaultValues: {
			boId: selectedBoId,
			isin: "",
			quantity: "",
			pledgeeClientCode: "",
			pledgeReason: "TRADING_MARGIN",
			tpin: "",
		},
	});

	// eLAS Form
	const elasForm = useForm<z.infer<typeof elasSchema>>({
		resolver: zodResolver(elasSchema),
		defaultValues: {
			boId: selectedBoId,
			lenderCode: "",
			loanAmount: "",
			purpose: "PERSONAL_LOAN",
			tpin: "",
		},
	});

	// Mutations
	const accountSetupMutation = useMutation({
		mutationFn: async (data: any) => {
			const response = await fetch("/api/cdsl/account/setup", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify(data),
			});
			return response.json();
		},
		onSuccess: (result) => {
			toast({ title: "Success", description: result.message });
			accountForm.reset();
			queryClient.invalidateQueries({ queryKey: ["/api/cdsl/holdings"] });
		},
		onError: (error: any) => {
			toast({
				title: "Error",
				description: error.error || "Failed to setup account",
				variant: "destructive",
			});
		},
	});

	const edisConsentMutation = useMutation({
		mutationFn: async (data: any) => {
			const response = await fetch("/api/cdsl/edis/consent", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify(data),
			});
			return response.json();
		},
		onSuccess: (result) => {
			toast({ title: "Success", description: result.message });
			edisForm.reset();
			edisForm.setValue("boId", selectedBoId);
		},
		onError: (error: any) => {
			toast({
				title: "Error",
				description: error.error || "Failed to provide eDIS consent",
				variant: "destructive",
			});
		},
	});

	const pledgeCreateMutation = useMutation({
		mutationFn: async (data: any) => {
			const response = await fetch("/api/cdsl/pledge/create", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify(data),
			});
			return response.json();
		},
		onSuccess: (result) => {
			toast({ title: "Success", description: result.message });
			pledgeForm.reset();
			pledgeForm.setValue("boId", selectedBoId);
		},
		onError: (error: any) => {
			toast({
				title: "Error",
				description: error.error || "Failed to create pledge",
				variant: "destructive",
			});
		},
	});

	const elasMutation = useMutation({
		mutationFn: async (data: any) => {
			const response = await fetch("/api/cdsl/elas/pledge", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify(data),
			});
			return response.json();
		},
		onSuccess: (result) => {
			toast({ title: "Success", description: result.message });
			elasForm.reset();
			elasForm.setValue("boId", selectedBoId);
		},
		onError: (error: any) => {
			toast({
				title: "Error",
				description: error.error || "Failed to create eLAS pledge",
				variant: "destructive",
			});
		},
	});

	const tpinGenerateMutation = useMutation({
		mutationFn: async (data: any) => {
			const response = await fetch("/api/cdsl/tpin/generate", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify(data),
			});
			return response.json();
		},
		onSuccess: (result) => {
			toast({
				title: "TPIN Sent",
				description: `TPIN sent to registered mobile. Valid for ${result.data.validityMinutes} minutes.`,
			});
			setShowTpinDialog(false);
		},
		onError: (error: any) => {
			toast({
				title: "Error",
				description: error.error || "Failed to generate TPIN",
				variant: "destructive",
			});
		},
	});

	// Holdings Query
	const holdingsQuery = useQuery({
		queryKey: ["/api/cdsl/holdings", selectedBoId],
		queryFn: async () => {
			const response = await fetch(`/api/cdsl/holdings/${selectedBoId}`);
			return response.json();
		},
		enabled: !!selectedBoId,
	});

	const handleAccountSetup = (values: z.infer<typeof accountSetupSchema>) => {
		accountSetupMutation.mutate(values);
	};

	const handleEdisConsent = (values: z.infer<typeof edisConsentSchema>) => {
		edisConsentMutation.mutate(values);
	};

	const handlePledgeCreate = (values: z.infer<typeof pledgeSchema>) => {
		pledgeCreateMutation.mutate(values);
	};

	const handleElasCreate = (values: z.infer<typeof elasSchema>) => {
		const securitiesData =
			holdingsQuery.data?.data?.holdings?.slice(0, 2) || [];
		elasMutation.mutate({
			...values,
			securities: securitiesData,
		});
	};

	const handleTpinGenerate = () => {
		if (!tpinMobile) {
			toast({
				title: "Error",
				description: "Please enter mobile number",
				variant: "destructive",
			});
			return;
		}
		tpinGenerateMutation.mutate({
			boId: selectedBoId,
			mobile: tpinMobile,
		});
	};

	return (
		<div className="container mx-auto py-8 space-y-8">
			{/* Header */}
			<div className="text-center space-y-4">
				<div className="flex items-center justify-center space-x-3">
					<LucideShield className="h-12 w-12 text-finance-red" />
					<h1 className="text-4xl font-bold text-foreground">CDSL Services</h1>
				</div>
				<p className="text-xl text-muted-foreground max-w-3xl mx-auto">
					Central Depository Services Limited - Complete depository services
					including demat accounts, eDIS transactions, margin pledge, and
					e-voting facilities
				</p>
			</div>

			{/* CDSL Status Card */}
			<Card className="border-l-4 border-l-finance-red">
				<CardHeader>
					<CardTitle className="flex items-center text-lg">
						<Database className="h-5 w-5 mr-2 text-finance-red" />
						CDSL API Integration Status
						<Badge className="ml-2 bg-finance-green text-white">
							Connected
						</Badge>
					</CardTitle>
				</CardHeader>
				<CardContent>
					<div className="grid grid-cols-2 md:grid-cols-4 gap-4">
						<div className="text-center">
							<div className="text-2xl font-bold text-finance-red">6.5Cr+</div>
							<div className="text-sm text-muted-foreground">
								Active Accounts
							</div>
						</div>
						<div className="text-center">
							<div className="text-2xl font-bold text-finance-red">₹75L Cr</div>
							<div className="text-sm text-muted-foreground">
								Assets Under Custody
							</div>
						</div>
						<div className="text-center">
							<div className="text-2xl font-bold text-finance-red">99.9%</div>
							<div className="text-sm text-muted-foreground">Uptime</div>
						</div>
						<div className="text-center">
							<div className="text-2xl font-bold text-finance-red">24x7</div>
							<div className="text-sm text-muted-foreground">
								API Availability
							</div>
						</div>
					</div>
				</CardContent>
			</Card>

			{/* TPIN Generator */}
			<Card>
				<CardHeader>
					<CardTitle className="flex items-center">
						<Phone className="h-5 w-5 mr-2" />
						Generate TPIN
					</CardTitle>
					<CardDescription>
						Transaction PIN required for secure CDSL operations
					</CardDescription>
				</CardHeader>
				<CardContent>
					<div className="flex space-x-4 items-end">
						<div className="flex-1">
							<Label>Mobile Number</Label>
							<Input
								placeholder="Enter registered mobile number"
								value={tpinMobile}
								onChange={(e) => setTpinMobile(e.target.value)}
								data-testid="input-tpin-mobile"
							/>
						</div>
						<Button
							onClick={handleTpinGenerate}
							disabled={tpinGenerateMutation.isPending}
							data-testid="button-generate-tpin"
						>
							{tpinGenerateMutation.isPending && (
								<Loader2 className="h-4 w-4 mr-2 animate-spin" />
							)}
							Generate TPIN
						</Button>
					</div>
				</CardContent>
			</Card>

			{/* Main Services Tabs */}
			<Tabs defaultValue="account" className="w-full">
				<ScrollableTabsList className="grid w-full grid-cols-6">
					<TabsTrigger value="account" data-testid="tab-account">
						Account
					</TabsTrigger>
					<TabsTrigger value="holdings" data-testid="tab-holdings">
						Holdings
					</TabsTrigger>
					<TabsTrigger value="edis" data-testid="tab-edis">
						eDIS
					</TabsTrigger>
					<TabsTrigger value="pledge" data-testid="tab-pledge">
						Pledge
					</TabsTrigger>
					<TabsTrigger value="elas" data-testid="tab-elas">
						eLAS
					</TabsTrigger>
					<TabsTrigger value="evoting" data-testid="tab-evoting">
						e-Voting
					</TabsTrigger>
				</ScrollableTabsList>

				{/* Account Setup Tab */}
				<TabsContent value="account" className="space-y-6">
					<Card>
						<CardHeader>
							<CardTitle className="flex items-center">
								<Users className="h-5 w-5 mr-2" />
								CDSL Demat Account Opening
							</CardTitle>
							<CardDescription>
								Open a new CDSL demat account with complete digital onboarding
							</CardDescription>
						</CardHeader>
						<CardContent>
							<Form {...accountForm}>
								<form
									onSubmit={accountForm.handleSubmit(handleAccountSetup)}
									className="space-y-4"
								>
									<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
										<FormField
											control={accountForm.control}
											name="clientName"
											render={({ field }) => (
												<FormItem>
													<FormLabel>Client Name *</FormLabel>
													<FormControl>
														<Input
															placeholder="Enter full name"
															{...field}
															data-testid="input-client-name"
														/>
													</FormControl>
													<FormMessage />
												</FormItem>
											)}
										/>

										<FormField
											control={accountForm.control}
											name="pan"
											render={({ field }) => (
												<FormItem>
													<FormLabel>PAN Number *</FormLabel>
													<FormControl>
														<Input
															placeholder="ABCDE1234F"
															{...field}
															data-testid="input-pan"
														/>
													</FormControl>
													<FormMessage />
												</FormItem>
											)}
										/>

										<FormField
											control={accountForm.control}
											name="mobile"
											render={({ field }) => (
												<FormItem>
													<FormLabel>Mobile Number *</FormLabel>
													<FormControl>
														<Input
															placeholder="9876543210"
															{...field}
															data-testid="input-mobile"
														/>
													</FormControl>
													<FormMessage />
												</FormItem>
											)}
										/>

										<FormField
											control={accountForm.control}
											name="email"
											render={({ field }) => (
												<FormItem>
													<FormLabel>Email Address *</FormLabel>
													<FormControl>
														<Input
															type="email"
															placeholder="client@example.com"
															{...field}
															data-testid="input-email"
														/>
													</FormControl>
													<FormMessage />
												</FormItem>
											)}
										/>
									</div>

									<FormField
										control={accountForm.control}
										name="address"
										render={({ field }) => (
											<FormItem>
												<FormLabel>Address *</FormLabel>
												<FormControl>
													<Textarea
														placeholder="Complete address"
														{...field}
														data-testid="textarea-address"
													/>
												</FormControl>
												<FormMessage />
											</FormItem>
										)}
									/>

									<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
										<FormField
											control={accountForm.control}
											name="nomineeName"
											render={({ field }) => (
												<FormItem>
													<FormLabel>Nominee Name</FormLabel>
													<FormControl>
														<Input
															placeholder="Nominee name (optional)"
															{...field}
															data-testid="input-nominee-name"
														/>
													</FormControl>
													<FormMessage />
												</FormItem>
											)}
										/>

										<FormField
											control={accountForm.control}
											name="nomineeRelation"
											render={({ field }) => (
												<FormItem>
													<FormLabel>Nominee Relation</FormLabel>
													<FormControl>
														<Input
															placeholder="Relationship (optional)"
															{...field}
															data-testid="input-nominee-relation"
														/>
													</FormControl>
													<FormMessage />
												</FormItem>
											)}
										/>
									</div>

									<Button
										type="submit"
										className="w-full"
										disabled={accountSetupMutation.isPending}
										data-testid="button-setup-account"
									>
										{accountSetupMutation.isPending && (
											<Loader2 className="h-4 w-4 mr-2 animate-spin" />
										)}
										Setup CDSL Account
									</Button>
								</form>
							</Form>
						</CardContent>
					</Card>
				</TabsContent>

				{/* Holdings Tab */}
				<TabsContent value="holdings" className="space-y-6">
					<Card>
						<CardHeader>
							<CardTitle className="flex items-center">
								<Building2 className="h-5 w-5 mr-2" />
								CDSL Holdings
							</CardTitle>
							<CardDescription>
								View your complete demat account holdings and positions
							</CardDescription>
						</CardHeader>
						<CardContent>
							{holdingsQuery.isLoading ? (
								<div className="flex items-center justify-center py-8">
									<Loader2 className="h-8 w-8 animate-spin" />
								</div>
							) : holdingsQuery.data?.data ? (
								<div className="space-y-4">
									<div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
										<div className="text-center">
											<div className="text-2xl font-bold">
												₹{holdingsQuery.data.data.totalMarketValue}
											</div>
											<div className="text-sm text-muted-foreground">
												Total Value
											</div>
										</div>
										<div className="text-center">
											<div className="text-2xl font-bold">
												{holdingsQuery.data.data.totalSecurities}
											</div>
											<div className="text-sm text-muted-foreground">
												Securities
											</div>
										</div>
										<div className="text-center">
											<div className="text-2xl font-bold">
												{holdingsQuery.data.data.dpId}
											</div>
											<div className="text-sm text-muted-foreground">DP ID</div>
										</div>
										<div className="text-center">
											<div className="text-2xl font-bold">
												{holdingsQuery.data.data.boId}
											</div>
											<div className="text-sm text-muted-foreground">BO ID</div>
										</div>
									</div>

									<div className="space-y-3">
										{holdingsQuery.data.data.holdings.map(
											(holding: any, index: number) => (
												<Card key={index}>
													<CardContent className="pt-4">
														<div className="flex justify-between items-start">
															<div className="flex-1">
																<h4 className="font-semibold">
																	{holding.securityName}
																</h4>
																<p className="text-sm text-muted-foreground">
																	ISIN: {holding.isin}
																</p>
															</div>
															<div className="text-right">
																<div className="text-lg font-bold">
																	₹{holding.marketValue}
																</div>
																<div className="text-sm text-muted-foreground">
																	{holding.quantity} shares
																</div>
															</div>
														</div>
														<div className="grid grid-cols-4 gap-4 mt-3 text-sm">
															<div>
																<div className="text-muted-foreground">
																	Free
																</div>
																<div className="font-medium">
																	{holding.freeQuantity}
																</div>
															</div>
															<div>
																<div className="text-muted-foreground">
																	Locked
																</div>
																<div className="font-medium">
																	{holding.lockedQuantity}
																</div>
															</div>
															<div>
																<div className="text-muted-foreground">
																	Pledged
																</div>
																<div className="font-medium">
																	{holding.pledgedQuantity}
																</div>
															</div>
															<div>
																<div className="text-muted-foreground">
																	Earmark
																</div>
																<div className="font-medium">
																	{holding.earmarkQuantity}
																</div>
															</div>
														</div>
													</CardContent>
												</Card>
											),
										)}
									</div>
								</div>
							) : (
								<Alert>
									<AlertTriangle className="h-4 w-4" />
									<AlertDescription>
										No holdings data available. Please check your BO ID or try
										again later.
									</AlertDescription>
								</Alert>
							)}
						</CardContent>
					</Card>
				</TabsContent>

				{/* eDIS Tab */}
				<TabsContent value="edis" className="space-y-6">
					<Card>
						<CardHeader>
							<CardTitle className="flex items-center">
								<FileCheck className="h-5 w-5 mr-2" />
								eDIS - Electronic Delivery Instruction
							</CardTitle>
							<CardDescription>
								Provide electronic consent for delivery of shares without
								physical DIS
							</CardDescription>
						</CardHeader>
						<CardContent>
							<Form {...edisForm}>
								<form
									onSubmit={edisForm.handleSubmit(handleEdisConsent)}
									className="space-y-4"
								>
									<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
										<FormField
											control={edisForm.control}
											name="boId"
											render={({ field }) => (
												<FormItem>
													<FormLabel>BO ID *</FormLabel>
													<FormControl>
														<Input {...field} data-testid="input-bo-id" />
													</FormControl>
													<FormMessage />
												</FormItem>
											)}
										/>

										<FormField
											control={edisForm.control}
											name="isin"
											render={({ field }) => (
												<FormItem>
													<FormLabel>ISIN *</FormLabel>
													<FormControl>
														<Input
															placeholder="INE040A01034"
															{...field}
															data-testid="input-isin"
														/>
													</FormControl>
													<FormMessage />
												</FormItem>
											)}
										/>

										<FormField
											control={edisForm.control}
											name="quantity"
											render={({ field }) => (
												<FormItem>
													<FormLabel>Quantity *</FormLabel>
													<FormControl>
														<Input
															type="number"
															placeholder="100"
															{...field}
															data-testid="input-quantity"
														/>
													</FormControl>
													<FormMessage />
												</FormItem>
											)}
										/>

										<FormField
											control={edisForm.control}
											name="clientCode"
											render={({ field }) => (
												<FormItem>
													<FormLabel>Client Code *</FormLabel>
													<FormControl>
														<Input
															placeholder="CLIENT001"
															{...field}
															data-testid="input-client-code"
														/>
													</FormControl>
													<FormMessage />
												</FormItem>
											)}
										/>

										<FormField
											control={edisForm.control}
											name="executionDate"
											render={({ field }) => (
												<FormItem>
													<FormLabel>Execution Date *</FormLabel>
													<FormControl>
														<Input
															type="date"
															{...field}
															data-testid="input-execution-date"
														/>
													</FormControl>
													<FormMessage />
												</FormItem>
											)}
										/>

										<FormField
											control={edisForm.control}
											name="tpin"
											render={({ field }) => (
												<FormItem>
													<FormLabel>TPIN *</FormLabel>
													<FormControl>
														<Input
															type="password"
															maxLength={6}
															placeholder="6-digit TPIN"
															{...field}
															data-testid="input-tpin"
														/>
													</FormControl>
													<FormMessage />
												</FormItem>
											)}
										/>
									</div>

									<Button
										type="submit"
										className="w-full"
										disabled={edisConsentMutation.isPending}
										data-testid="button-edis-consent"
									>
										{edisConsentMutation.isPending && (
											<Loader2 className="h-4 w-4 mr-2 animate-spin" />
										)}
										Provide eDIS Consent
									</Button>
								</form>
							</Form>
						</CardContent>
					</Card>
				</TabsContent>

				{/* Pledge Tab */}
				<TabsContent value="pledge" className="space-y-6">
					<Card>
						<CardHeader>
							<CardTitle className="flex items-center">
								<CreditCard className="h-5 w-5 mr-2" />
								Margin Pledge Creation
							</CardTitle>
							<CardDescription>
								Create pledges for trading margin and collateral benefits
							</CardDescription>
						</CardHeader>
						<CardContent>
							<Form {...pledgeForm}>
								<form
									onSubmit={pledgeForm.handleSubmit(handlePledgeCreate)}
									className="space-y-4"
								>
									<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
										<FormField
											control={pledgeForm.control}
											name="boId"
											render={({ field }) => (
												<FormItem>
													<FormLabel>BO ID *</FormLabel>
													<FormControl>
														<Input
															{...field}
															data-testid="input-pledge-bo-id"
														/>
													</FormControl>
													<FormMessage />
												</FormItem>
											)}
										/>

										<FormField
											control={pledgeForm.control}
											name="isin"
											render={({ field }) => (
												<FormItem>
													<FormLabel>ISIN *</FormLabel>
													<FormControl>
														<Input
															placeholder="INE040A01034"
															{...field}
															data-testid="input-pledge-isin"
														/>
													</FormControl>
													<FormMessage />
												</FormItem>
											)}
										/>

										<FormField
											control={pledgeForm.control}
											name="quantity"
											render={({ field }) => (
												<FormItem>
													<FormLabel>Quantity *</FormLabel>
													<FormControl>
														<Input
															type="number"
															placeholder="50"
															{...field}
															data-testid="input-pledge-quantity"
														/>
													</FormControl>
													<FormMessage />
												</FormItem>
											)}
										/>

										<FormField
											control={pledgeForm.control}
											name="pledgeeClientCode"
											render={({ field }) => (
												<FormItem>
													<FormLabel>Pledgee Client Code *</FormLabel>
													<FormControl>
														<Input
															placeholder="BROKER001"
															{...field}
															data-testid="input-pledgee-code"
														/>
													</FormControl>
													<FormMessage />
												</FormItem>
											)}
										/>

										<FormField
											control={pledgeForm.control}
											name="pledgeReason"
											render={({ field }) => (
												<FormItem>
													<FormLabel>Pledge Reason</FormLabel>
													<Select
														onValueChange={field.onChange}
														defaultValue={field.value}
													>
														<FormControl>
															<SelectTrigger data-testid="select-pledge-reason">
																<SelectValue placeholder="Select reason" />
															</SelectTrigger>
														</FormControl>
														<SelectContent>
															<SelectItem value="TRADING_MARGIN">
																Trading Margin
															</SelectItem>
															<SelectItem value="LOAN_AGAINST_SECURITIES">
																Loan Against Securities
															</SelectItem>
															<SelectItem value="COLLATERAL">
																Collateral
															</SelectItem>
														</SelectContent>
													</Select>
													<FormMessage />
												</FormItem>
											)}
										/>

										<FormField
											control={pledgeForm.control}
											name="tpin"
											render={({ field }) => (
												<FormItem>
													<FormLabel>TPIN *</FormLabel>
													<FormControl>
														<Input
															type="password"
															maxLength={6}
															placeholder="6-digit TPIN"
															{...field}
															data-testid="input-pledge-tpin"
														/>
													</FormControl>
													<FormMessage />
												</FormItem>
											)}
										/>
									</div>

									<Button
										type="submit"
										className="w-full"
										disabled={pledgeCreateMutation.isPending}
										data-testid="button-create-pledge"
									>
										{pledgeCreateMutation.isPending && (
											<Loader2 className="h-4 w-4 mr-2 animate-spin" />
										)}
										Create Pledge
									</Button>
								</form>
							</Form>
						</CardContent>
					</Card>
				</TabsContent>

				{/* eLAS Tab */}
				<TabsContent value="elas" className="space-y-6">
					<Card>
						<CardHeader>
							<CardTitle className="flex items-center">
								<TrendingUp className="h-5 w-5 mr-2" />
								eLAS - Online Loan Against Shares
							</CardTitle>
							<CardDescription>
								Apply for loans against your securities with instant processing
							</CardDescription>
						</CardHeader>
						<CardContent>
							<Form {...elasForm}>
								<form
									onSubmit={elasForm.handleSubmit(handleElasCreate)}
									className="space-y-4"
								>
									<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
										<FormField
											control={elasForm.control}
											name="boId"
											render={({ field }) => (
												<FormItem>
													<FormLabel>BO ID *</FormLabel>
													<FormControl>
														<Input {...field} data-testid="input-elas-bo-id" />
													</FormControl>
													<FormMessage />
												</FormItem>
											)}
										/>

										<FormField
											control={elasForm.control}
											name="lenderCode"
											render={({ field }) => (
												<FormItem>
													<FormLabel>Lender Code *</FormLabel>
													<FormControl>
														<Input
															placeholder="LENDER001"
															{...field}
															data-testid="input-lender-code"
														/>
													</FormControl>
													<FormMessage />
												</FormItem>
											)}
										/>

										<FormField
											control={elasForm.control}
											name="loanAmount"
											render={({ field }) => (
												<FormItem>
													<FormLabel>Loan Amount *</FormLabel>
													<FormControl>
														<Input
															type="number"
															placeholder="100000"
															{...field}
															data-testid="input-loan-amount"
														/>
													</FormControl>
													<FormMessage />
												</FormItem>
											)}
										/>

										<FormField
											control={elasForm.control}
											name="purpose"
											render={({ field }) => (
												<FormItem>
													<FormLabel>Loan Purpose</FormLabel>
													<Select
														onValueChange={field.onChange}
														defaultValue={field.value}
													>
														<FormControl>
															<SelectTrigger data-testid="select-loan-purpose">
																<SelectValue placeholder="Select purpose" />
															</SelectTrigger>
														</FormControl>
														<SelectContent>
															<SelectItem value="PERSONAL_LOAN">
																Personal Loan
															</SelectItem>
															<SelectItem value="BUSINESS_LOAN">
																Business Loan
															</SelectItem>
															<SelectItem value="TRADING_FINANCE">
																Trading Finance
															</SelectItem>
															<SelectItem value="INVESTMENT">
																Investment
															</SelectItem>
														</SelectContent>
													</Select>
													<FormMessage />
												</FormItem>
											)}
										/>

										<div className="md:col-span-2">
											<FormField
												control={elasForm.control}
												name="tpin"
												render={({ field }) => (
													<FormItem>
														<FormLabel>TPIN *</FormLabel>
														<FormControl>
															<Input
																type="password"
																maxLength={6}
																placeholder="6-digit TPIN"
																{...field}
																data-testid="input-elas-tpin"
															/>
														</FormControl>
														<FormMessage />
													</FormItem>
												)}
											/>
										</div>
									</div>

									<Alert>
										<AlertTriangle className="h-4 w-4" />
										<AlertDescription>
											<strong>Note:</strong> Your securities will be pledged as
											collateral. Typical LTV (Loan to Value) ratio is 70-80%
											based on security type. Interest rates starting from 11.5%
											per annum.
										</AlertDescription>
									</Alert>

									<Button
										type="submit"
										className="w-full"
										disabled={elasMutation.isPending}
										data-testid="button-create-elas"
									>
										{elasMutation.isPending && (
											<Loader2 className="h-4 w-4 mr-2 animate-spin" />
										)}
										Apply for eLAS
									</Button>
								</form>
							</Form>
						</CardContent>
					</Card>
				</TabsContent>

				{/* e-Voting Tab */}
				<TabsContent value="evoting" className="space-y-6">
					<Card>
						<CardHeader>
							<CardTitle className="flex items-center">
								<Vote className="h-5 w-5 mr-2" />
								e-Voting Services
							</CardTitle>
							<CardDescription>
								Cast your votes on company resolutions through CDSL's e-voting
								platform
							</CardDescription>
						</CardHeader>
						<CardContent>
							<div className="text-center py-8">
								<Vote className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
								<h3 className="text-lg font-semibold mb-2">e-Voting Portal</h3>
								<p className="text-muted-foreground mb-4">
									Access the complete e-voting interface to participate in
									corporate governance
								</p>
								<Button
									onClick={() =>
										window.open("https://www.evotingindia.com", "_blank")
									}
									data-testid="button-evoting-portal"
								>
									Access e-Voting Portal
								</Button>
							</div>
						</CardContent>
					</Card>
				</TabsContent>
			</Tabs>
		</div>
	);
}
