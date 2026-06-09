import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
	DialogFooter,
} from "@/components/ui/dialog";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@/components/ui/table";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
	ArrowLeft,
	ExternalLink,
	RefreshCw,
	CheckCircle,
	Clock,
	XCircle,
	AlertTriangle,
	Building2,
	IndianRupee,
	FileText,
	Search,
	Download,
} from "lucide-react";
import { Link } from "wouter";
import { format } from "date-fns";

interface McaPayment {
	id: string;
	cin: string;
	companyName: string;
	feeType: string;
	filingYear: string;
	amount: string;
	status: string;
	mcaChallanNumber: string;
	mcaTransactionId: string;
	mcaPaymentDate: string;
	mcaReceiptUrl: string;
	paymentMode: string;
	bankName: string;
	initiatedBy: string;
	confirmedBy: string;
	confirmedAt: string;
	zohoExpenseId: string;
	zohoSyncStatus: string;
	zohoSyncError: string;
	zohoSyncedAt: string;
	notes: string;
	createdAt: string;
}

interface FeeType {
	code: string;
	description: string;
}

interface PaymentSummary {
	totalPayments: number;
	totalAmount: number;
	pendingConfirmation: number;
	confirmed: number;
	syncedToZoho: number;
	failedSync: number;
}

const statusColors: Record<string, string> = {
	initiated:
		"bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-200",
	confirmed:
		"bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-200",
	cancelled: "bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-200",
};

const zohoSyncColors: Record<string, string> = {
	pending: "bg-muted text-foreground",
	synced:
		"bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-200",
	failed: "bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-200",
	skipped: "bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-200",
};

export default function McaDirectPayments() {
	const { toast } = useToast();
	const [selectedPayment, setSelectedPayment] = useState<McaPayment | null>(
		null,
	);
	const [showConfirmDialog, setShowConfirmDialog] = useState(false);
	const [showInitiateDialog, setShowInitiateDialog] = useState(false);
	const [filter, setFilter] = useState({ status: "all", feeType: "all" });
	const [confirmForm, setConfirmForm] = useState({
		mcaChallanNumber: "",
		mcaPaymentDate: new Date().toISOString().split("T")[0],
		mcaTransactionId: "",
		paymentMode: "",
		bankName: "",
	});
	const [initiateForm, setInitiateForm] = useState({
		cin: "",
		companyName: "",
		feeType: "",
		filingYear: "",
		amount: "",
		notes: "",
	});

	const { data: feeTypesData } = useQuery<{
		feeTypes: FeeType[];
		mcaPortalUrl: string;
	}>({
		queryKey: ["/api/mca/direct-payments/fee-types"],
	});

	const { data: summaryData, isLoading: summaryLoading } = useQuery<{
		summary: PaymentSummary;
	}>({
		queryKey: ["/api/mca/direct-payments/summary/stats"],
	});

	const {
		data: paymentsData,
		isLoading: paymentsLoading,
		refetch,
	} = useQuery<{ payments: McaPayment[]; total: number }>({
		queryKey: ["/api/mca/direct-payments", filter],
		queryFn: async () => {
			const params = new URLSearchParams();
			if (filter.status && filter.status !== "all")
				params.set("status", filter.status);
			if (filter.feeType && filter.feeType !== "all")
				params.set("feeType", filter.feeType);
			const url = `/api/mca/direct-payments${params.toString() ? `?${params.toString()}` : ""}`;
			const res = await fetch(url, { credentials: "include" });
			if (!res.ok) throw new Error("Failed to fetch payments");
			return res.json();
		},
	});

	const initiateMutation = useMutation({
		mutationFn: (data: typeof initiateForm) =>
			apiRequest("/api/mca/direct-payments/initiate", {
				method: "POST",
				body: JSON.stringify({
					...data,
					amount: Number.parseFloat(data.amount),
					initiatedBy: "admin",
				}),
			}),
		onSuccess: (result: any) => {
			toast({
				title: "Payment Initiated",
				description: "Please complete payment on MCA portal.",
			});
			setShowInitiateDialog(false);
			setInitiateForm({
				cin: "",
				companyName: "",
				feeType: "",
				filingYear: "",
				amount: "",
				notes: "",
			});
			queryClient.invalidateQueries({ queryKey: ["/api/mca/direct-payments"] });
			if (result.mcaPortalUrl) {
				window.open(result.mcaPortalUrl, "_blank");
			}
		},
		onError: (error: any) => {
			toast({
				variant: "destructive",
				title: "Failed to Initiate",
				description: error.message,
			});
		},
	});

	const confirmMutation = useMutation({
		mutationFn: (data: { paymentId: string; formData: typeof confirmForm }) =>
			apiRequest(`/api/mca/direct-payments/${data.paymentId}/confirm`, {
				method: "POST",
				body: JSON.stringify({
					...data.formData,
					confirmedBy: "admin",
				}),
			}),
		onSuccess: (result: any) => {
			toast({
				title: "Payment Confirmed",
				description: result.zohoSynced
					? "Payment confirmed and synced to Zoho Books."
					: "Payment confirmed. Zoho sync pending.",
			});
			setShowConfirmDialog(false);
			setSelectedPayment(null);
			queryClient.invalidateQueries({ queryKey: ["/api/mca/direct-payments"] });
		},
		onError: (error: any) => {
			toast({
				variant: "destructive",
				title: "Confirmation Failed",
				description: error.message,
			});
		},
	});

	const retryZohoMutation = useMutation({
		mutationFn: (paymentId: string) =>
			apiRequest(`/api/mca/direct-payments/${paymentId}/retry-zoho-sync`, {
				method: "POST",
			}),
		onSuccess: () => {
			toast({
				title: "Zoho Sync Successful",
				description: "Payment synced to Zoho Books.",
			});
			queryClient.invalidateQueries({ queryKey: ["/api/mca/direct-payments"] });
		},
		onError: (error: any) => {
			toast({
				variant: "destructive",
				title: "Sync Failed",
				description: error.message,
			});
		},
	});

	const handleConfirmPayment = (payment: McaPayment) => {
		setSelectedPayment(payment);
		setConfirmForm({
			mcaChallanNumber: "",
			mcaPaymentDate: new Date().toISOString().split("T")[0],
			mcaTransactionId: "",
			paymentMode: "",
			bankName: "",
		});
		setShowConfirmDialog(true);
	};

	const summary = summaryData?.summary;
	const payments = paymentsData?.payments || [];
	const feeTypes = feeTypesData?.feeTypes || [];

	return (
		<div className="container mx-auto p-6 space-y-6">
			<div className="flex items-center justify-between">
				<div className="flex items-center gap-4">
					<Link href="/admin">
						<Button variant="ghost" size="icon">
							<ArrowLeft className="h-4 w-4" />
						</Button>
					</Link>
					<div>
						<h1 className="text-2xl font-bold">MCA Direct Payments</h1>
						<p className="text-muted-foreground">
							Track and manage direct payments to MCA portal
						</p>
					</div>
				</div>
				<div className="flex gap-2">
					<Button variant="outline" onClick={() => refetch()}>
						<RefreshCw className="h-4 w-4 mr-2" />
						Refresh
					</Button>
					<Button onClick={() => setShowInitiateDialog(true)}>
						<IndianRupee className="h-4 w-4 mr-2" />
						Initiate Payment
					</Button>
				</div>
			</div>

			<div className="grid grid-cols-1 md:grid-cols-6 gap-4">
				<Card>
					<CardHeader className="pb-2">
						<CardDescription>Total Payments</CardDescription>
					</CardHeader>
					<CardContent>
						<div className="text-2xl font-bold">
							{summary?.totalPayments || 0}
						</div>
					</CardContent>
				</Card>
				<Card>
					<CardHeader className="pb-2">
						<CardDescription>Total Amount</CardDescription>
					</CardHeader>
					<CardContent>
						<div className="text-2xl font-bold text-green-600">
							₹{(summary?.totalAmount || 0).toLocaleString()}
						</div>
					</CardContent>
				</Card>
				<Card>
					<CardHeader className="pb-2">
						<CardDescription>Pending Confirmation</CardDescription>
					</CardHeader>
					<CardContent>
						<div className="text-2xl font-bold text-yellow-600">
							{summary?.pendingConfirmation || 0}
						</div>
					</CardContent>
				</Card>
				<Card>
					<CardHeader className="pb-2">
						<CardDescription>Confirmed</CardDescription>
					</CardHeader>
					<CardContent>
						<div className="text-2xl font-bold text-green-600">
							{summary?.confirmed || 0}
						</div>
					</CardContent>
				</Card>
				<Card>
					<CardHeader className="pb-2">
						<CardDescription>Synced to Zoho</CardDescription>
					</CardHeader>
					<CardContent>
						<div className="text-2xl font-bold text-blue-600">
							{summary?.syncedToZoho || 0}
						</div>
					</CardContent>
				</Card>
				<Card>
					<CardHeader className="pb-2">
						<CardDescription>Failed Sync</CardDescription>
					</CardHeader>
					<CardContent>
						<div className="text-2xl font-bold text-red-600">
							{summary?.failedSync || 0}
						</div>
					</CardContent>
				</Card>
			</div>

			<Card>
				<CardHeader>
					<div className="flex items-center justify-between">
						<div>
							<CardTitle>Payment History</CardTitle>
							<CardDescription>
								All MCA direct payments with status and sync info
							</CardDescription>
						</div>
						<div className="flex gap-2">
							<Select
								value={filter.status}
								onValueChange={(v) => setFilter({ ...filter, status: v })}
							>
								<SelectTrigger className="w-[140px]">
									<SelectValue placeholder="Status" />
								</SelectTrigger>
								<SelectContent>
									<SelectItem value="all">All Status</SelectItem>
									<SelectItem value="initiated">Pending</SelectItem>
									<SelectItem value="confirmed">Confirmed</SelectItem>
									<SelectItem value="cancelled">Cancelled</SelectItem>
								</SelectContent>
							</Select>
							<Select
								value={filter.feeType}
								onValueChange={(v) => setFilter({ ...filter, feeType: v })}
							>
								<SelectTrigger className="w-[150px]">
									<SelectValue placeholder="Fee Type" />
								</SelectTrigger>
								<SelectContent>
									<SelectItem value="all">All Types</SelectItem>
									{feeTypes.map((ft) => (
										<SelectItem key={ft.code} value={ft.code}>
											{ft.code}
										</SelectItem>
									))}
								</SelectContent>
							</Select>
						</div>
					</div>
				</CardHeader>
				<CardContent>
					{paymentsLoading ? (
						<div className="text-center py-8 text-muted-foreground">
							Loading payments...
						</div>
					) : payments.length === 0 ? (
						<div className="text-center py-8 text-muted-foreground">
							No payments found
						</div>
					) : (
						<Table>
							<TableHeader>
								<TableRow>
									<TableHead>Company</TableHead>
									<TableHead>Fee Type</TableHead>
									<TableHead>Amount</TableHead>
									<TableHead>Status</TableHead>
									<TableHead>Challan No.</TableHead>
									<TableHead>Zoho Sync</TableHead>
									<TableHead>Date</TableHead>
									<TableHead>Actions</TableHead>
								</TableRow>
							</TableHeader>
							<TableBody>
								{payments.map((payment) => (
									<TableRow key={payment.id}>
										<TableCell>
											<div>
												<div className="font-medium">
													{payment.companyName || payment.cin}
												</div>
												<div className="text-xs text-muted-foreground">
													{payment.cin}
												</div>
											</div>
										</TableCell>
										<TableCell>
											<Badge variant="outline">{payment.feeType}</Badge>
											{payment.filingYear && (
												<span className="text-xs text-muted-foreground ml-1">
													FY{payment.filingYear}
												</span>
											)}
										</TableCell>
										<TableCell className="font-medium">
											₹{Number.parseFloat(payment.amount).toLocaleString()}
										</TableCell>
										<TableCell>
											<Badge className={statusColors[payment.status]}>
												{payment.status}
											</Badge>
										</TableCell>
										<TableCell>{payment.mcaChallanNumber || "-"}</TableCell>
										<TableCell>
											<Badge className={zohoSyncColors[payment.zohoSyncStatus]}>
												{payment.zohoSyncStatus}
											</Badge>
											{payment.zohoSyncStatus === "failed" && (
												<Button
													variant="ghost"
													size="sm"
													className="ml-1"
													onClick={() => retryZohoMutation.mutate(payment.id)}
												>
													<RefreshCw className="h-3 w-3" />
												</Button>
											)}
										</TableCell>
										<TableCell className="text-sm text-muted-foreground">
											{format(new Date(payment.createdAt), "dd MMM yyyy")}
										</TableCell>
										<TableCell>
											{payment.status === "initiated" && (
												<Button
													size="sm"
													onClick={() => handleConfirmPayment(payment)}
												>
													<CheckCircle className="h-4 w-4 mr-1" />
													Confirm
												</Button>
											)}
											{payment.mcaReceiptUrl && (
												<Button
													variant="ghost"
													size="sm"
													onClick={() =>
														window.open(payment.mcaReceiptUrl, "_blank")
													}
												>
													<FileText className="h-4 w-4" />
												</Button>
											)}
										</TableCell>
									</TableRow>
								))}
							</TableBody>
						</Table>
					)}
				</CardContent>
			</Card>

			<Dialog open={showInitiateDialog} onOpenChange={setShowInitiateDialog}>
				<DialogContent className="max-w-md">
					<DialogHeader>
						<DialogTitle>Initiate MCA Payment</DialogTitle>
						<DialogDescription>
							Record a new MCA payment. After initiating, complete payment on
							the MCA portal.
						</DialogDescription>
					</DialogHeader>
					<div className="space-y-4">
						<div className="space-y-2">
							<Label>CIN (21 characters)</Label>
							<Input
								value={initiateForm.cin}
								onChange={(e) =>
									setInitiateForm({
										...initiateForm,
										cin: e.target.value.toUpperCase(),
									})
								}
								placeholder="e.g., U72900KA2010PTC054571"
								maxLength={21}
							/>
						</div>
						<div className="space-y-2">
							<Label>Company Name (optional)</Label>
							<Input
								value={initiateForm.companyName}
								onChange={(e) =>
									setInitiateForm({
										...initiateForm,
										companyName: e.target.value,
									})
								}
								placeholder="Company name"
							/>
						</div>
						<div className="space-y-2">
							<Label>Fee Type</Label>
							<Select
								value={initiateForm.feeType}
								onValueChange={(v) =>
									setInitiateForm({ ...initiateForm, feeType: v })
								}
							>
								<SelectTrigger>
									<SelectValue placeholder="Select fee type" />
								</SelectTrigger>
								<SelectContent>
									{feeTypes.map((ft) => (
										<SelectItem key={ft.code} value={ft.code}>
											{ft.code} - {ft.description}
										</SelectItem>
									))}
								</SelectContent>
							</Select>
						</div>
						<div className="grid grid-cols-2 gap-4">
							<div className="space-y-2">
								<Label>Filing Year</Label>
								<Input
									value={initiateForm.filingYear}
									onChange={(e) =>
										setInitiateForm({
											...initiateForm,
											filingYear: e.target.value,
										})
									}
									placeholder="e.g., 2023-24"
								/>
							</div>
							<div className="space-y-2">
								<Label>Amount (₹)</Label>
								<Input
									type="number"
									value={initiateForm.amount}
									onChange={(e) =>
										setInitiateForm({ ...initiateForm, amount: e.target.value })
									}
									placeholder="0"
								/>
							</div>
						</div>
						<div className="space-y-2">
							<Label>Notes (optional)</Label>
							<Input
								value={initiateForm.notes}
								onChange={(e) =>
									setInitiateForm({ ...initiateForm, notes: e.target.value })
								}
								placeholder="Any additional notes"
							/>
						</div>
					</div>
					<DialogFooter>
						<Button
							variant="outline"
							onClick={() => setShowInitiateDialog(false)}
						>
							Cancel
						</Button>
						<Button
							onClick={() => initiateMutation.mutate(initiateForm)}
							disabled={
								!initiateForm.cin ||
								!initiateForm.feeType ||
								!initiateForm.amount ||
								initiateMutation.isPending
							}
						>
							{initiateMutation.isPending
								? "Initiating..."
								: "Initiate & Open MCA Portal"}
							<ExternalLink className="h-4 w-4 ml-2" />
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>

			<Dialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
				<DialogContent className="max-w-md">
					<DialogHeader>
						<DialogTitle>Confirm MCA Payment</DialogTitle>
						<DialogDescription>
							Enter the payment details from MCA portal to confirm this payment.
						</DialogDescription>
					</DialogHeader>
					{selectedPayment && (
						<div className="space-y-4">
							<div className="bg-muted p-3 rounded-lg">
								<div className="text-sm font-medium">
									{selectedPayment.companyName || selectedPayment.cin}
								</div>
								<div className="text-xs text-muted-foreground">
									{selectedPayment.feeType} - ₹
									{Number.parseFloat(selectedPayment.amount).toLocaleString()}
								</div>
							</div>
							<div className="space-y-2">
								<Label>MCA Challan/SRN Number *</Label>
								<Input
									value={confirmForm.mcaChallanNumber}
									onChange={(e) =>
										setConfirmForm({
											...confirmForm,
											mcaChallanNumber: e.target.value,
										})
									}
									placeholder="Enter challan or SRN number"
								/>
							</div>
							<div className="space-y-2">
								<Label>Payment Date *</Label>
								<Input
									type="date"
									value={confirmForm.mcaPaymentDate}
									onChange={(e) =>
										setConfirmForm({
											...confirmForm,
											mcaPaymentDate: e.target.value,
										})
									}
								/>
							</div>
							<div className="grid grid-cols-2 gap-4">
								<div className="space-y-2">
									<Label>Payment Mode</Label>
									<Select
										value={confirmForm.paymentMode}
										onValueChange={(v) =>
											setConfirmForm({ ...confirmForm, paymentMode: v })
										}
									>
										<SelectTrigger>
											<SelectValue placeholder="Select mode" />
										</SelectTrigger>
										<SelectContent>
											<SelectItem value="net_banking">Net Banking</SelectItem>
											<SelectItem value="upi">UPI</SelectItem>
											<SelectItem value="card">Card</SelectItem>
											<SelectItem value="neft">NEFT/RTGS</SelectItem>
										</SelectContent>
									</Select>
								</div>
								<div className="space-y-2">
									<Label>Bank Name</Label>
									<Input
										value={confirmForm.bankName}
										onChange={(e) =>
											setConfirmForm({
												...confirmForm,
												bankName: e.target.value,
											})
										}
										placeholder="e.g., HDFC Bank"
									/>
								</div>
							</div>
							<div className="space-y-2">
								<Label>Transaction ID (optional)</Label>
								<Input
									value={confirmForm.mcaTransactionId}
									onChange={(e) =>
										setConfirmForm({
											...confirmForm,
											mcaTransactionId: e.target.value,
										})
									}
									placeholder="Bank transaction ID"
								/>
							</div>
						</div>
					)}
					<DialogFooter>
						<Button
							variant="outline"
							onClick={() => setShowConfirmDialog(false)}
						>
							Cancel
						</Button>
						<Button
							onClick={() => {
								if (selectedPayment) {
									confirmMutation.mutate({
										paymentId: selectedPayment.id,
										formData: confirmForm,
									});
								}
							}}
							disabled={
								!confirmForm.mcaChallanNumber ||
								!confirmForm.mcaPaymentDate ||
								confirmMutation.isPending
							}
						>
							{confirmMutation.isPending ? "Confirming..." : "Confirm Payment"}
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>
		</div>
	);
}
