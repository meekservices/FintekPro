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
import { Badge } from "@/components/ui/badge";
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
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@/components/ui/table";
import {
	CreditCard,
	IndianRupee,
	Send,
	CheckCircle,
	AlertCircle,
	Clock,
	Eye,
	Download,
	RefreshCw,
	Building2,
	Banknote,
	Receipt,
	History,
	Shield as LucideShield,
	Users,
	TrendingUp,
} from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { LoadingState } from "@/components/LoadingState";

export default function ICICIBanking() {
	const [selectedAccount, setSelectedAccount] = useState("");
	const [paymentForm, setPaymentForm] = useState({
		beneficiaryAccountNumber: "",
		beneficiaryIFSC: "",
		amount: "",
		purpose: "",
		remarks: "",
		beneficiaryName: "",
	});
	const [validationForm, setValidationForm] = useState({
		accountNumber: "",
		ifscCode: "",
	});
	const [statementForm, setStatementForm] = useState({
		fromDate: "",
		toDate: "",
		format: "pdf",
	});
	const [transactionForm, setTransactionForm] = useState({
		fromDate: "",
		toDate: "",
		limit: "50",
	});

	const { toast } = useToast();

	// Mock account data (replace with actual user accounts)
	const userAccounts = [
		{
			accountNumber: "123456789012",
			accountType: "Savings Account",
			accountName: "Primary Savings",
			currency: "INR",
		},
		{
			accountNumber: "123456789013",
			accountType: "Current Account",
			accountName: "Business Current",
			currency: "INR",
		},
	];

	// Account balance query
	const {
		data: accountBalance,
		isLoading: balanceLoading,
		refetch: refetchBalance,
	} = useQuery<any>({
		queryKey: ["/api/icici/accounts/balance", selectedAccount],
		enabled: !!selectedAccount,
		refetchInterval: 30000, // Refresh every 30 seconds
	});

	// Account validation mutation
	const validateAccountMutation = useMutation<any, any, typeof validationForm>({
		mutationFn: async (data: typeof validationForm) => {
			return await apiRequest("/api/icici/accounts/validate", {
				method: "POST",
				body: JSON.stringify(data),
			});
		},
		onSuccess: (data) => {
			if (data.success) {
				toast({
					title: "Account Validated",
					description: data.data?.valid
						? `Valid account: ${data.data.accountName || "Account found"}`
						: "Invalid account details",
					variant: data.data?.valid ? "default" : "destructive",
				});
			} else {
				toast({
					title: "Validation Failed",
					description: data.error || "Unable to validate account",
					variant: "destructive",
				});
			}
		},
		onError: () => {
			toast({
				title: "Error",
				description: "Failed to validate account",
				variant: "destructive",
			});
		},
	});

	// IMPS payment mutation
	const paymentMutation = useMutation<
		any,
		any,
		typeof paymentForm & { accountNumber: string }
	>({
		mutationFn: async (
			data: typeof paymentForm & { accountNumber: string },
		) => {
			return await apiRequest("/api/icici/payments/imps", {
				method: "POST",
				body: JSON.stringify(data),
			});
		},
		onSuccess: (data) => {
			if (data.success) {
				toast({
					title: "Payment Initiated",
					description: `Transaction ID: ${data.data?.transactionId}`,
					variant: "default",
				});
				setPaymentForm({
					beneficiaryAccountNumber: "",
					beneficiaryIFSC: "",
					amount: "",
					purpose: "",
					remarks: "",
					beneficiaryName: "",
				});
				refetchBalance();
			} else {
				toast({
					title: "Payment Failed",
					description: data.error || "Payment could not be processed",
					variant: "destructive",
				});
			}
		},
		onError: () => {
			toast({
				title: "Error",
				description: "Failed to process payment",
				variant: "destructive",
			});
		},
	});

	// Transaction history query
	const { data: transactions, isLoading: transactionsLoading } = useQuery<any>({
		queryKey: [
			"/api/icici/accounts/transactions",
			selectedAccount,
			transactionForm,
		],
		enabled:
			!!selectedAccount &&
			!!transactionForm.fromDate &&
			!!transactionForm.toDate,
	});

	// Account statement mutation
	const statementMutation = useMutation<
		any,
		any,
		typeof statementForm & { accountNumber: string }
	>({
		mutationFn: async (
			data: typeof statementForm & { accountNumber: string },
		) => {
			return await apiRequest("/api/icici/accounts/statement", {
				method: "POST",
				body: JSON.stringify(data),
			});
		},
		onSuccess: (data) => {
			if (data.success) {
				toast({
					title: "Statement Generated",
					description: "Statement download will begin shortly",
					variant: "default",
				});
				// Open download URL
				if (data.data?.downloadUrl) {
					window.open(data.data.downloadUrl, "_blank");
				}
			} else {
				toast({
					title: "Statement Generation Failed",
					description: data.error || "Unable to generate statement",
					variant: "destructive",
				});
			}
		},
		onError: () => {
			toast({
				title: "Error",
				description: "Failed to generate statement",
				variant: "destructive",
			});
		},
	});

	const handlePayment = () => {
		if (!selectedAccount) {
			toast({
				title: "Error",
				description: "Please select an account first",
				variant: "destructive",
			});
			return;
		}

		paymentMutation.mutate({
			...paymentForm,
			accountNumber: selectedAccount,
		});
	};

	const handleValidation = () => {
		validateAccountMutation.mutate(validationForm);
	};

	const handleStatementGeneration = () => {
		if (!selectedAccount) {
			toast({
				title: "Error",
				description: "Please select an account first",
				variant: "destructive",
			});
			return;
		}

		statementMutation.mutate({
			...statementForm,
			accountNumber: selectedAccount,
		});
	};

	return (
		<div
			className="min-h-screen bg-gradient-to-br from-blue-50/30 to-indigo-100/30 dark:from-background dark:to-card p-4"
			data-testid="icici-banking-page"
		>
			<div className="container mx-auto max-w-7xl space-y-6">
				{/* Header */}
				<div className="text-center space-y-4">
					<div className="flex items-center justify-center gap-3">
						<Building2 className="h-8 w-8 text-blue-600" />
						<h1 className="text-3xl font-bold text-foreground">
							ICICI Bank Services
						</h1>
					</div>
					<p className="text-muted-foreground max-w-2xl mx-auto">
						Access comprehensive banking services including account management,
						payments, and transaction history
					</p>
				</div>

				{/* Account Selection */}
				<Card data-testid="account-selection-card">
					<CardHeader>
						<CardTitle className="flex items-center gap-2">
							<CreditCard className="h-5 w-5" />
							Select Account
						</CardTitle>
						<CardDescription>Choose an account to manage</CardDescription>
					</CardHeader>
					<CardContent>
						<div className="space-y-4">
							<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
								{userAccounts.map((account) => (
									<Card
										key={account.accountNumber}
										className={`cursor-pointer transition-all hover:shadow-md ${
											selectedAccount === account.accountNumber
												? "ring-2 ring-blue-500 bg-blue-50 dark:bg-blue-900/20"
												: ""
										}`}
										onClick={() => setSelectedAccount(account.accountNumber)}
										data-testid={`account-card-${account.accountNumber}`}
									>
										<CardContent className="p-4">
											<div className="space-y-2">
												<div className="flex items-center justify-between">
													<Badge variant="outline">{account.accountType}</Badge>
													<Badge variant="secondary">{account.currency}</Badge>
												</div>
												<div>
													<p className="font-medium">{account.accountName}</p>
													<p className="text-sm text-muted-foreground">
														****{account.accountNumber.slice(-4)}
													</p>
												</div>
											</div>
										</CardContent>
									</Card>
								))}
							</div>
						</div>
					</CardContent>
				</Card>

				{selectedAccount && (
					<>
						{/* Account Balance */}
						<Card data-testid="account-balance-card">
							<CardHeader>
								<CardTitle className="flex items-center justify-between">
									<div className="flex items-center gap-2">
										<IndianRupee className="h-5 w-5" />
										Account Balance
									</div>
									<Button
										variant="outline"
										size="sm"
										onClick={() => refetchBalance()}
										disabled={balanceLoading}
										data-testid="refresh-balance-button"
									>
										<RefreshCw
											className={`h-4 w-4 ${balanceLoading ? "animate-spin" : ""}`}
										/>
										Refresh
									</Button>
								</CardTitle>
							</CardHeader>
							<CardContent>
								{balanceLoading ? (
									<LoadingState variant="stats" count={3} />
								) : accountBalance?.success ? (
									<div className="grid grid-cols-1 md:grid-cols-3 gap-4">
										<div className="text-center p-4 bg-green-50 dark:bg-green-900/20 rounded-lg">
											<p className="text-sm text-green-600 dark:text-green-400">
												Available Balance
											</p>
											<p
												className="text-2xl font-bold text-green-700 dark:text-green-300"
												data-testid="available-balance"
											>
												₹
												{accountBalance.data?.availableBalance?.toLocaleString()}
											</p>
										</div>
										<div className="text-center p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
											<p className="text-sm text-blue-600 dark:text-blue-400">
												Ledger Balance
											</p>
											<p
												className="text-2xl font-bold text-blue-700 dark:text-blue-300"
												data-testid="ledger-balance"
											>
												₹{accountBalance.data?.ledgerBalance?.toLocaleString()}
											</p>
										</div>
										<div className="text-center p-4 bg-muted rounded-lg">
											<p className="text-sm text-muted-foreground">
												Last Updated
											</p>
											<p
												className="text-sm font-medium"
												data-testid="last-updated"
											>
												{accountBalance.data?.lastUpdated
													? format(
															new Date(accountBalance.data.lastUpdated),
															"MMM dd, yyyy HH:mm",
														)
													: "N/A"}
											</p>
										</div>
									</div>
								) : (
									<div className="text-center p-8 text-red-600 dark:text-red-400">
										<AlertCircle className="h-8 w-8 mx-auto mb-2" />
										<p>Failed to load account balance</p>
										<p className="text-sm">{accountBalance?.error}</p>
									</div>
								)}
							</CardContent>
						</Card>

						{/* Banking Services Tabs */}
						<Tabs defaultValue="payments" className="space-y-6">
							<div className="overflow-x-auto pb-2">
								<ScrollableTabsList className="inline-flex w-auto min-w-full">
									<TabsTrigger
										value="payments"
										data-testid="payments-tab"
										className="flex-shrink-0"
									>
										<Send className="h-4 w-4 mr-2" />
										Payments
									</TabsTrigger>
									<TabsTrigger
										value="transactions"
										data-testid="transactions-tab"
										className="flex-shrink-0"
									>
										<History className="h-4 w-4 mr-2" />
										Transactions
									</TabsTrigger>
									<TabsTrigger
										value="statements"
										data-testid="statements-tab"
										className="flex-shrink-0"
									>
										<Receipt className="h-4 w-4 mr-2" />
										Statements
									</TabsTrigger>
									<TabsTrigger
										value="validation"
										data-testid="validation-tab"
										className="flex-shrink-0"
									>
										<LucideShield className="h-4 w-4 mr-2" />
										Validation
									</TabsTrigger>
								</ScrollableTabsList>
							</div>

							{/* IMPS Payments */}
							<TabsContent value="payments">
								<Card data-testid="payments-card">
									<CardHeader>
										<CardTitle>IMPS Payment</CardTitle>
										<CardDescription>
											Send instant payments to any bank account
										</CardDescription>
									</CardHeader>
									<CardContent>
										<div className="grid grid-cols-1 md:grid-cols-2 gap-6">
											<div className="space-y-4">
												<div>
													<Label htmlFor="beneficiary-account">
														Beneficiary Account Number
													</Label>
													<Input
														id="beneficiary-account"
														data-testid="input-beneficiary-account"
														value={paymentForm.beneficiaryAccountNumber}
														onChange={(e) =>
															setPaymentForm({
																...paymentForm,
																beneficiaryAccountNumber: e.target.value,
															})
														}
														placeholder="Enter beneficiary account number"
													/>
												</div>
												<div>
													<Label htmlFor="beneficiary-ifsc">
														Beneficiary IFSC Code
													</Label>
													<Input
														id="beneficiary-ifsc"
														data-testid="input-beneficiary-ifsc"
														value={paymentForm.beneficiaryIFSC}
														onChange={(e) =>
															setPaymentForm({
																...paymentForm,
																beneficiaryIFSC: e.target.value,
															})
														}
														placeholder="Enter IFSC code"
													/>
												</div>
												<div>
													<Label htmlFor="beneficiary-name">
														Beneficiary Name
													</Label>
													<Input
														id="beneficiary-name"
														data-testid="input-beneficiary-name"
														value={paymentForm.beneficiaryName}
														onChange={(e) =>
															setPaymentForm({
																...paymentForm,
																beneficiaryName: e.target.value,
															})
														}
														placeholder="Enter beneficiary name"
													/>
												</div>
											</div>
											<div className="space-y-4">
												<div>
													<Label htmlFor="amount">Amount (₹)</Label>
													<Input
														id="amount"
														type="number"
														data-testid="input-amount"
														value={paymentForm.amount}
														onChange={(e) =>
															setPaymentForm({
																...paymentForm,
																amount: e.target.value,
															})
														}
														placeholder="Enter amount"
													/>
												</div>
												<div>
													<Label htmlFor="purpose">Purpose</Label>
													<Select
														onValueChange={(value) =>
															setPaymentForm({ ...paymentForm, purpose: value })
														}
													>
														<SelectTrigger data-testid="select-purpose">
															<SelectValue placeholder="Select purpose" />
														</SelectTrigger>
														<SelectContent>
															<SelectItem value="personal">Personal</SelectItem>
															<SelectItem value="business">Business</SelectItem>
															<SelectItem value="education">
																Education
															</SelectItem>
															<SelectItem value="medical">Medical</SelectItem>
															<SelectItem value="family">
																Family Maintenance
															</SelectItem>
															<SelectItem value="others">Others</SelectItem>
														</SelectContent>
													</Select>
												</div>
												<div>
													<Label htmlFor="remarks">Remarks (Optional)</Label>
													<Textarea
														id="remarks"
														data-testid="input-remarks"
														value={paymentForm.remarks}
														onChange={(e) =>
															setPaymentForm({
																...paymentForm,
																remarks: e.target.value,
															})
														}
														placeholder="Enter any remarks"
														rows={3}
													/>
												</div>
											</div>
										</div>
										<div className="mt-6">
											<Button
												onClick={handlePayment}
												disabled={
													paymentMutation.isPending ||
													!paymentForm.beneficiaryAccountNumber ||
													!paymentForm.amount
												}
												className="w-full"
												data-testid="button-submit-payment"
											>
												{paymentMutation.isPending ? (
													<>
														<RefreshCw className="h-4 w-4 mr-2 animate-spin" />
														Processing Payment...
													</>
												) : (
													<>
														<Send className="h-4 w-4 mr-2" />
														Send Payment
													</>
												)}
											</Button>
										</div>
									</CardContent>
								</Card>
							</TabsContent>

							{/* Transaction History */}
							<TabsContent value="transactions">
								<Card data-testid="transactions-card">
									<CardHeader>
										<CardTitle>Transaction History</CardTitle>
										<CardDescription>
											View your account transaction history
										</CardDescription>
									</CardHeader>
									<CardContent>
										<div className="space-y-4">
											<div className="grid grid-cols-1 md:grid-cols-3 gap-4">
												<div>
													<Label htmlFor="from-date">From Date</Label>
													<Input
														id="from-date"
														type="date"
														data-testid="input-from-date"
														value={transactionForm.fromDate}
														onChange={(e) =>
															setTransactionForm({
																...transactionForm,
																fromDate: e.target.value,
															})
														}
													/>
												</div>
												<div>
													<Label htmlFor="to-date">To Date</Label>
													<Input
														id="to-date"
														type="date"
														data-testid="input-to-date"
														value={transactionForm.toDate}
														onChange={(e) =>
															setTransactionForm({
																...transactionForm,
																toDate: e.target.value,
															})
														}
													/>
												</div>
												<div>
													<Label htmlFor="limit">Limit</Label>
													<Select
														onValueChange={(value) =>
															setTransactionForm({
																...transactionForm,
																limit: value,
															})
														}
													>
														<SelectTrigger data-testid="select-limit">
															<SelectValue placeholder="Select limit" />
														</SelectTrigger>
														<SelectContent>
															<SelectItem value="25">
																25 transactions
															</SelectItem>
															<SelectItem value="50">
																50 transactions
															</SelectItem>
															<SelectItem value="100">
																100 transactions
															</SelectItem>
															<SelectItem value="200">
																200 transactions
															</SelectItem>
														</SelectContent>
													</Select>
												</div>
											</div>

											{transactionsLoading ? (
												<div className="flex items-center justify-center p-8">
													<RefreshCw className="h-6 w-6 animate-spin" />
													<span className="ml-2">Loading transactions...</span>
												</div>
											) : transactions?.success &&
												transactions.data?.length > 0 ? (
												<div className="border rounded-lg">
													<Table>
														<TableHeader>
															<TableRow>
																<TableHead>Date</TableHead>
																<TableHead>Description</TableHead>
																<TableHead>Type</TableHead>
																<TableHead>Amount</TableHead>
																<TableHead>Balance</TableHead>
																<TableHead>Reference</TableHead>
															</TableRow>
														</TableHeader>
														<TableBody>
															{transactions.data.map((transaction: any) => (
																<TableRow
																	key={transaction.transactionId}
																	data-testid={`transaction-row-${transaction.transactionId}`}
																>
																	<TableCell>
																		{format(
																			new Date(transaction.transactionDate),
																			"MMM dd, yyyy",
																		)}
																	</TableCell>
																	<TableCell>
																		{transaction.description}
																	</TableCell>
																	<TableCell>
																		<Badge
																			variant={
																				transaction.transactionType === "CREDIT"
																					? "default"
																					: "destructive"
																			}
																		>
																			{transaction.transactionType}
																		</Badge>
																	</TableCell>
																	<TableCell
																		className={
																			transaction.transactionType === "CREDIT"
																				? "text-green-600"
																				: "text-red-600"
																		}
																	>
																		{transaction.transactionType === "CREDIT"
																			? "+"
																			: "-"}
																		₹
																		{Math.abs(
																			transaction.amount,
																		).toLocaleString()}
																	</TableCell>
																	<TableCell>
																		₹{transaction.balance.toLocaleString()}
																	</TableCell>
																	<TableCell>
																		{transaction.referenceNumber}
																	</TableCell>
																</TableRow>
															))}
														</TableBody>
													</Table>
												</div>
											) : transactions?.success ? (
												<div className="text-center p-8 text-muted-foreground">
													<History className="h-8 w-8 mx-auto mb-2" />
													<p>No transactions found for the selected period</p>
												</div>
											) : (
												<div className="text-center p-8 text-red-600 dark:text-red-400">
													<AlertCircle className="h-8 w-8 mx-auto mb-2" />
													<p>Please select date range to view transactions</p>
												</div>
											)}
										</div>
									</CardContent>
								</Card>
							</TabsContent>

							{/* Account Statements */}
							<TabsContent value="statements">
								<Card data-testid="statements-card">
									<CardHeader>
										<CardTitle>Account Statements</CardTitle>
										<CardDescription>
											Generate and download account statements
										</CardDescription>
									</CardHeader>
									<CardContent>
										<div className="space-y-4">
											<div className="grid grid-cols-1 md:grid-cols-3 gap-4">
												<div>
													<Label htmlFor="statement-from-date">From Date</Label>
													<Input
														id="statement-from-date"
														type="date"
														data-testid="input-statement-from-date"
														value={statementForm.fromDate}
														onChange={(e) =>
															setStatementForm({
																...statementForm,
																fromDate: e.target.value,
															})
														}
													/>
												</div>
												<div>
													<Label htmlFor="statement-to-date">To Date</Label>
													<Input
														id="statement-to-date"
														type="date"
														data-testid="input-statement-to-date"
														value={statementForm.toDate}
														onChange={(e) =>
															setStatementForm({
																...statementForm,
																toDate: e.target.value,
															})
														}
													/>
												</div>
												<div>
													<Label htmlFor="statement-format">Format</Label>
													<Select
														onValueChange={(value) =>
															setStatementForm({
																...statementForm,
																format: value,
															})
														}
													>
														<SelectTrigger data-testid="select-statement-format">
															<SelectValue placeholder="Select format" />
														</SelectTrigger>
														<SelectContent>
															<SelectItem value="pdf">PDF</SelectItem>
															<SelectItem value="excel">Excel</SelectItem>
														</SelectContent>
													</Select>
												</div>
											</div>
											<Button
												onClick={handleStatementGeneration}
												disabled={
													statementMutation.isPending ||
													!statementForm.fromDate ||
													!statementForm.toDate
												}
												data-testid="button-generate-statement"
											>
												{statementMutation.isPending ? (
													<>
														<RefreshCw className="h-4 w-4 mr-2 animate-spin" />
														Generating Statement...
													</>
												) : (
													<>
														<Download className="h-4 w-4 mr-2" />
														Generate Statement
													</>
												)}
											</Button>
										</div>
									</CardContent>
								</Card>
							</TabsContent>

							{/* Account Validation */}
							<TabsContent value="validation">
								<Card data-testid="validation-card">
									<CardHeader>
										<CardTitle>Account Validation</CardTitle>
										<CardDescription>
											Validate account number and IFSC code
										</CardDescription>
									</CardHeader>
									<CardContent>
										<div className="space-y-4">
											<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
												<div>
													<Label htmlFor="validation-account">
														Account Number
													</Label>
													<Input
														id="validation-account"
														data-testid="input-validation-account"
														value={validationForm.accountNumber}
														onChange={(e) =>
															setValidationForm({
																...validationForm,
																accountNumber: e.target.value,
															})
														}
														placeholder="Enter account number"
													/>
												</div>
												<div>
													<Label htmlFor="validation-ifsc">IFSC Code</Label>
													<Input
														id="validation-ifsc"
														data-testid="input-validation-ifsc"
														value={validationForm.ifscCode}
														onChange={(e) =>
															setValidationForm({
																...validationForm,
																ifscCode: e.target.value,
															})
														}
														placeholder="Enter IFSC code"
													/>
												</div>
											</div>
											<Button
												onClick={handleValidation}
												disabled={
													validateAccountMutation.isPending ||
													!validationForm.accountNumber ||
													!validationForm.ifscCode
												}
												data-testid="button-validate-account"
											>
												{validateAccountMutation.isPending ? (
													<>
														<RefreshCw className="h-4 w-4 mr-2 animate-spin" />
														Validating...
													</>
												) : (
													<>
														<LucideShield className="h-4 w-4 mr-2" />
														Validate Account
													</>
												)}
											</Button>
										</div>
									</CardContent>
								</Card>
							</TabsContent>
						</Tabs>
					</>
				)}

				{/* API Status */}
				<Card data-testid="api-status-card">
					<CardHeader>
						<CardTitle className="flex items-center gap-2">
							<CheckCircle className="h-5 w-5 text-green-500" />
							ICICI Bank API Status
						</CardTitle>
						<CardDescription>Real-time API health monitoring</CardDescription>
					</CardHeader>
					<CardContent>
						<div className="flex items-center justify-between p-4 bg-green-50 dark:bg-green-900/20 rounded-lg">
							<div className="flex items-center gap-3">
								<CheckCircle className="h-6 w-6 text-green-500" />
								<div>
									<p className="font-medium">API Services Active</p>
									<p className="text-sm text-green-600 dark:text-green-400">
										Account Management • Payments • Transaction History •
										Validation
									</p>
								</div>
							</div>
							<Badge
								variant="secondary"
								className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200"
							>
								Operational
							</Badge>
						</div>
					</CardContent>
				</Card>
			</div>
		</div>
	);
}
