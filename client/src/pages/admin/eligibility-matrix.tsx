import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import {
	Card,
	CardContent,
	CardHeader,
	CardTitle,
	CardDescription,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@/components/ui/table";
import {
	Dialog,
	DialogContent,
	DialogHeader,
	DialogTitle,
	DialogFooter,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";
import {
	Building2,
	Edit,
	Trash2,
	Plus,
	CheckCircle,
	XCircle,
	RefreshCw,
	Calculator,
	Filter,
	Settings,
	ArrowUpDown,
} from "lucide-react";

interface EligibilityRule {
	id: string;
	bankCode: string;
	bankName: string;
	productType: string;
	minCibilScore?: number;
	maxCibilScore?: number;
	minMonthlyIncome?: number;
	maxMonthlyIncome?: number;
	employmentTypes?: string[];
	propertyTypes?: string[];
	minBusinessVintageMonths?: number;
	minAnnualTurnover?: number;
	maxAnnualTurnover?: number;
	minAge?: number;
	maxAge?: number;
	minLoanAmount?: number;
	maxLoanAmount?: number;
	geographicRestrictions?: Record<string, any>;
	additionalCriteria?: Record<string, any>;
	isActive: boolean;
	routingPriority: number;
	notes?: string;
	createdAt?: string;
	updatedAt?: string;
}

const BANKS = [
	{ code: "ICICI", name: "ICICI Bank" },
	{ code: "HDFC", name: "HDFC Bank" },
	{ code: "AXIS", name: "Axis Bank" },
	{ code: "KOTAK", name: "Kotak Mahindra Bank" },
	{ code: "SBI", name: "State Bank of India" },
	{ code: "BAJAJ", name: "Bajaj Finance" },
	{ code: "TATA", name: "Tata Capital" },
];

const PRODUCT_TYPES = [
	{ value: "personal_loan", label: "Personal Loan" },
	{ value: "business_loan", label: "Business Loan" },
	{ value: "loan_against_property", label: "Loan Against Property" },
	{ value: "home_loan", label: "Home Loan" },
];

const EMPLOYMENT_TYPES = [
	"salaried",
	"self_employed",
	"proprietor",
	"partnership",
	"private_limited",
	"llp",
	"professional",
];

const PROPERTY_TYPES = [
	"residential",
	"commercial",
	"industrial",
	"agricultural",
	"mixed_use",
];

function formatCurrency(value?: number): string {
	if (!value) return "-";
	if (value >= 10000000) return `₹${(value / 10000000).toFixed(1)} Cr`;
	if (value >= 100000) return `₹${(value / 100000).toFixed(1)} L`;
	if (value >= 1000) return `₹${(value / 1000).toFixed(0)} K`;
	return `₹${value}`;
}

export default function EligibilityMatrixPage() {
	const { toast } = useToast();
	const queryClient = useQueryClient();
	const [selectedBank, setSelectedBank] = useState<string>("all");
	const [selectedProduct, setSelectedProduct] = useState<string>("all");
	const [isEditing, setIsEditing] = useState(false);
	const [editingRule, setEditingRule] = useState<EligibilityRule | null>(null);
	const [isTestDialogOpen, setIsTestDialogOpen] = useState(false);
	const [testProfile, setTestProfile] = useState({
		cibilScore: 720,
		monthlyIncome: 75000,
		employmentType: "salaried",
		age: 35,
		loanAmount: 500000,
	});

	const { data: rulesData, isLoading } = useQuery<{
		success: boolean;
		data: EligibilityRule[];
	}>({
		queryKey: ["/api/eligibility-matrix/rules"],
	});

	const rules = rulesData?.data || [];

	const filteredRules = rules.filter((rule) => {
		if (selectedBank !== "all" && rule.bankCode !== selectedBank) return false;
		if (selectedProduct !== "all" && rule.productType !== selectedProduct)
			return false;
		return true;
	});

	const updateRuleMutation = useMutation({
		mutationFn: async ({
			id,
			data,
		}: { id: string; data: Partial<EligibilityRule> }) => {
			return apiRequest(`/api/eligibility-matrix/rules/${id}`, {
				method: "PUT",
				body: JSON.stringify(data),
			});
		},
		onSuccess: () => {
			queryClient.invalidateQueries({
				queryKey: ["/api/eligibility-matrix/rules"],
			});
			toast({ title: "Rule updated successfully" });
			setIsEditing(false);
			setEditingRule(null);
		},
		onError: () => {
			toast({ title: "Failed to update rule", variant: "destructive" });
		},
	});

	const createRuleMutation = useMutation({
		mutationFn: async (data: Partial<EligibilityRule>) => {
			return apiRequest("/api/eligibility-matrix/rules", {
				method: "POST",
				body: JSON.stringify(data),
			});
		},
		onSuccess: () => {
			queryClient.invalidateQueries({
				queryKey: ["/api/eligibility-matrix/rules"],
			});
			toast({ title: "Rule created successfully" });
			setIsEditing(false);
			setEditingRule(null);
		},
		onError: () => {
			toast({ title: "Failed to create rule", variant: "destructive" });
		},
	});

	const deleteRuleMutation = useMutation({
		mutationFn: async (id: string) => {
			return apiRequest(`/api/eligibility-matrix/rules/${id}`, {
				method: "DELETE",
			});
		},
		onSuccess: () => {
			queryClient.invalidateQueries({
				queryKey: ["/api/eligibility-matrix/rules"],
			});
			toast({ title: "Rule deleted successfully" });
		},
		onError: () => {
			toast({ title: "Failed to delete rule", variant: "destructive" });
		},
	});

	const evaluateMutation = useMutation({
		mutationFn: async () => {
			return apiRequest("/api/eligibility-matrix/evaluate", {
				method: "POST",
				body: JSON.stringify({
					applicant: testProfile,
					productType:
						selectedProduct !== "all" ? selectedProduct : "personal_loan",
				}),
			});
		},
		onSuccess: (data: any) => {
			toast({
				title: "Evaluation Complete",
				description: `${data.data?.length || 0} banks evaluated`,
			});
		},
	});

	const handleSaveRule = () => {
		if (!editingRule) return;

		if (editingRule.id) {
			updateRuleMutation.mutate({ id: editingRule.id, data: editingRule });
		} else {
			createRuleMutation.mutate(editingRule);
		}
	};

	const handleAddNewRule = () => {
		setEditingRule({
			id: "",
			bankCode: "ICICI",
			bankName: "ICICI Bank",
			productType: "personal_loan",
			minCibilScore: 650,
			minMonthlyIncome: 25000,
			employmentTypes: ["salaried"],
			minAge: 21,
			maxAge: 60,
			minLoanAmount: 50000,
			maxLoanAmount: 2000000,
			isActive: true,
			routingPriority: 5,
			notes: "",
		});
		setIsEditing(true);
	};

	const handleEditRule = (rule: EligibilityRule) => {
		setEditingRule({ ...rule });
		setIsEditing(true);
	};

	const groupedByBank = rules.reduce(
		(acc, rule) => {
			if (!acc[rule.bankCode]) {
				acc[rule.bankCode] = { bankName: rule.bankName, rules: [] };
			}
			acc[rule.bankCode].rules.push(rule);
			return acc;
		},
		{} as Record<string, { bankName: string; rules: EligibilityRule[] }>,
	);

	return (
		<div className="p-6 max-w-7xl mx-auto space-y-6">
			<div className="flex justify-between items-center">
				<div>
					<h1 className="text-2xl font-bold flex items-center gap-2">
						<Settings className="h-6 w-6" />
						Bank Eligibility Matrix
					</h1>
					<p className="text-muted-foreground">
						Configure bank-specific eligibility rules for intelligent loan
						routing
					</p>
				</div>
				<div className="flex gap-2">
					<Button variant="outline" onClick={() => setIsTestDialogOpen(true)}>
						<Calculator className="h-4 w-4 mr-2" />
						Test Eligibility
					</Button>
					<Button onClick={handleAddNewRule}>
						<Plus className="h-4 w-4 mr-2" />
						Add Rule
					</Button>
				</div>
			</div>

			<div className="flex gap-4 items-center">
				<div className="flex items-center gap-2">
					<Filter className="h-4 w-4 text-muted-foreground" />
					<Select value={selectedBank} onValueChange={setSelectedBank}>
						<SelectTrigger className="w-[180px]">
							<SelectValue placeholder="Filter by bank" />
						</SelectTrigger>
						<SelectContent>
							<SelectItem value="all">All Banks</SelectItem>
							{BANKS.map((bank) => (
								<SelectItem key={bank.code} value={bank.code}>
									{bank.name}
								</SelectItem>
							))}
						</SelectContent>
					</Select>
				</div>
				<Select value={selectedProduct} onValueChange={setSelectedProduct}>
					<SelectTrigger className="w-[200px]">
						<SelectValue placeholder="Filter by product" />
					</SelectTrigger>
					<SelectContent>
						<SelectItem value="all">All Products</SelectItem>
						{PRODUCT_TYPES.map((product) => (
							<SelectItem key={product.value} value={product.value}>
								{product.label}
							</SelectItem>
						))}
					</SelectContent>
				</Select>
				<Badge variant="secondary">{filteredRules.length} rules</Badge>
			</div>

			<Tabs defaultValue="table">
				<TabsList>
					<TabsTrigger value="table">Table View</TabsTrigger>
					<TabsTrigger value="grid">Bank Grid</TabsTrigger>
				</TabsList>

				<TabsContent value="table" className="mt-4">
					<Card>
						<CardContent className="p-0">
							<Table>
								<TableHeader>
									<TableRow>
										<TableHead>Bank</TableHead>
										<TableHead>Product</TableHead>
										<TableHead>CIBIL Range</TableHead>
										<TableHead>Min Income</TableHead>
										<TableHead>Employment</TableHead>
										<TableHead>Loan Range</TableHead>
										<TableHead>Age</TableHead>
										<TableHead>Priority</TableHead>
										<TableHead>Status</TableHead>
										<TableHead className="text-right">Actions</TableHead>
									</TableRow>
								</TableHeader>
								<TableBody>
									{isLoading ? (
										<TableRow>
											<TableCell colSpan={10} className="text-center py-8">
												<RefreshCw className="h-6 w-6 animate-spin mx-auto mb-2" />
												Loading rules...
											</TableCell>
										</TableRow>
									) : filteredRules.length === 0 ? (
										<TableRow>
											<TableCell
												colSpan={10}
												className="text-center py-8 text-muted-foreground"
											>
												No eligibility rules found. Add rules to configure loan
												routing.
											</TableCell>
										</TableRow>
									) : (
										filteredRules.map((rule) => (
											<TableRow key={rule.id}>
												<TableCell>
													<div className="flex items-center gap-2">
														<Building2 className="h-4 w-4 text-muted-foreground" />
														<span className="font-medium">{rule.bankName}</span>
													</div>
												</TableCell>
												<TableCell>
													<Badge variant="outline">
														{PRODUCT_TYPES.find(
															(p) => p.value === rule.productType,
														)?.label || rule.productType}
													</Badge>
												</TableCell>
												<TableCell>
													{rule.minCibilScore
														? `${rule.minCibilScore}${rule.maxCibilScore ? `-${rule.maxCibilScore}` : "+"}`
														: "-"}
												</TableCell>
												<TableCell>
													{formatCurrency(rule.minMonthlyIncome)}
												</TableCell>
												<TableCell>
													<div className="flex gap-1 flex-wrap">
														{(rule.employmentTypes || [])
															.slice(0, 2)
															.map((type) => (
																<Badge
																	key={type}
																	variant="secondary"
																	className="text-xs"
																>
																	{type}
																</Badge>
															))}
														{(rule.employmentTypes?.length || 0) > 2 && (
															<Badge variant="secondary" className="text-xs">
																+{(rule.employmentTypes?.length || 0) - 2}
															</Badge>
														)}
													</div>
												</TableCell>
												<TableCell>
													{formatCurrency(rule.minLoanAmount)} -{" "}
													{formatCurrency(rule.maxLoanAmount)}
												</TableCell>
												<TableCell>
													{rule.minAge}-{rule.maxAge}
												</TableCell>
												<TableCell>
													<Badge
														variant={
															rule.routingPriority === 1
																? "default"
																: "secondary"
														}
													>
														{rule.routingPriority}
													</Badge>
												</TableCell>
												<TableCell>
													{rule.isActive ? (
														<CheckCircle className="h-5 w-5 text-green-500" />
													) : (
														<XCircle className="h-5 w-5 text-red-500" />
													)}
												</TableCell>
												<TableCell className="text-right">
													<div className="flex gap-1 justify-end">
														<Button
															variant="ghost"
															size="icon"
															onClick={() => handleEditRule(rule)}
														>
															<Edit className="h-4 w-4" />
														</Button>
														<Button
															variant="ghost"
															size="icon"
															onClick={() => deleteRuleMutation.mutate(rule.id)}
														>
															<Trash2 className="h-4 w-4 text-red-500" />
														</Button>
													</div>
												</TableCell>
											</TableRow>
										))
									)}
								</TableBody>
							</Table>
						</CardContent>
					</Card>
				</TabsContent>

				<TabsContent value="grid" className="mt-4">
					<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
						{Object.entries(groupedByBank).map(
							([bankCode, { bankName, rules: bankRules }]) => (
								<Card key={bankCode}>
									<CardHeader className="pb-3">
										<CardTitle className="flex items-center gap-2">
											<Building2 className="h-5 w-5" />
											{bankName}
										</CardTitle>
										<CardDescription>
											{bankRules.length} product rules
										</CardDescription>
									</CardHeader>
									<CardContent>
										<div className="space-y-3">
											{bankRules.map((rule) => (
												<div
													key={rule.id}
													className={`p-3 rounded-lg border ${rule.isActive ? "bg-green-50 dark:bg-green-950/20 border-green-200" : "bg-background border-border"}`}
												>
													<div className="flex justify-between items-start">
														<div>
															<Badge variant="outline" className="mb-1">
																{
																	PRODUCT_TYPES.find(
																		(p) => p.value === rule.productType,
																	)?.label
																}
															</Badge>
															<div className="text-sm text-muted-foreground mt-1">
																CIBIL: {rule.minCibilScore}+ | Income:{" "}
																{formatCurrency(rule.minMonthlyIncome)}
															</div>
														</div>
														<Badge
															variant={
																rule.routingPriority === 1
																	? "default"
																	: "secondary"
															}
														>
															P{rule.routingPriority}
														</Badge>
													</div>
												</div>
											))}
										</div>
									</CardContent>
								</Card>
							),
						)}
					</div>
				</TabsContent>
			</Tabs>

			<Dialog open={isEditing} onOpenChange={setIsEditing}>
				<DialogContent className="max-w-2xl max-h-[90vh]">
					<DialogHeader>
						<DialogTitle>
							{editingRule?.id
								? "Edit Eligibility Rule"
								: "Add New Eligibility Rule"}
						</DialogTitle>
					</DialogHeader>
					<ScrollArea className="max-h-[60vh] pr-4">
						{editingRule && (
							<div className="space-y-4 py-4">
								<div className="grid grid-cols-2 gap-4">
									<div className="space-y-2">
										<Label>Bank</Label>
										<Select
											value={editingRule.bankCode}
											onValueChange={(v) => {
												const bank = BANKS.find((b) => b.code === v);
												setEditingRule({
													...editingRule,
													bankCode: v,
													bankName: bank?.name || v,
												});
											}}
										>
											<SelectTrigger>
												<SelectValue />
											</SelectTrigger>
											<SelectContent>
												{BANKS.map((bank) => (
													<SelectItem key={bank.code} value={bank.code}>
														{bank.name}
													</SelectItem>
												))}
											</SelectContent>
										</Select>
									</div>
									<div className="space-y-2">
										<Label>Product Type</Label>
										<Select
											value={editingRule.productType}
											onValueChange={(v) =>
												setEditingRule({ ...editingRule, productType: v })
											}
										>
											<SelectTrigger>
												<SelectValue />
											</SelectTrigger>
											<SelectContent>
												{PRODUCT_TYPES.map((product) => (
													<SelectItem key={product.value} value={product.value}>
														{product.label}
													</SelectItem>
												))}
											</SelectContent>
										</Select>
									</div>
								</div>

								<div className="grid grid-cols-2 gap-4">
									<div className="space-y-2">
										<Label>Min CIBIL Score</Label>
										<Input
											type="number"
											value={editingRule.minCibilScore || ""}
											onChange={(e) =>
												setEditingRule({
													...editingRule,
													minCibilScore:
														Number.parseInt(e.target.value) || undefined,
												})
											}
										/>
									</div>
									<div className="space-y-2">
										<Label>Max CIBIL Score</Label>
										<Input
											type="number"
											value={editingRule.maxCibilScore || ""}
											onChange={(e) =>
												setEditingRule({
													...editingRule,
													maxCibilScore:
														Number.parseInt(e.target.value) || undefined,
												})
											}
										/>
									</div>
								</div>

								<div className="grid grid-cols-2 gap-4">
									<div className="space-y-2">
										<Label>Min Monthly Income</Label>
										<Input
											type="number"
											value={editingRule.minMonthlyIncome || ""}
											onChange={(e) =>
												setEditingRule({
													...editingRule,
													minMonthlyIncome:
														Number.parseInt(e.target.value) || undefined,
												})
											}
										/>
									</div>
									<div className="space-y-2">
										<Label>Routing Priority (1=highest)</Label>
										<Input
											type="number"
											value={editingRule.routingPriority}
											onChange={(e) =>
												setEditingRule({
													...editingRule,
													routingPriority: Number.parseInt(e.target.value) || 1,
												})
											}
											min={1}
											max={10}
										/>
									</div>
								</div>

								<div className="grid grid-cols-2 gap-4">
									<div className="space-y-2">
										<Label>Min Loan Amount</Label>
										<Input
											type="number"
											value={editingRule.minLoanAmount || ""}
											onChange={(e) =>
												setEditingRule({
													...editingRule,
													minLoanAmount:
														Number.parseInt(e.target.value) || undefined,
												})
											}
										/>
									</div>
									<div className="space-y-2">
										<Label>Max Loan Amount</Label>
										<Input
											type="number"
											value={editingRule.maxLoanAmount || ""}
											onChange={(e) =>
												setEditingRule({
													...editingRule,
													maxLoanAmount:
														Number.parseInt(e.target.value) || undefined,
												})
											}
										/>
									</div>
								</div>

								<div className="grid grid-cols-2 gap-4">
									<div className="space-y-2">
										<Label>Min Age</Label>
										<Input
											type="number"
											value={editingRule.minAge || ""}
											onChange={(e) =>
												setEditingRule({
													...editingRule,
													minAge: Number.parseInt(e.target.value) || undefined,
												})
											}
										/>
									</div>
									<div className="space-y-2">
										<Label>Max Age</Label>
										<Input
											type="number"
											value={editingRule.maxAge || ""}
											onChange={(e) =>
												setEditingRule({
													...editingRule,
													maxAge: Number.parseInt(e.target.value) || undefined,
												})
											}
										/>
									</div>
								</div>

								<div className="space-y-2">
									<Label>Min Business Vintage (months)</Label>
									<Input
										type="number"
										value={editingRule.minBusinessVintageMonths || ""}
										onChange={(e) =>
											setEditingRule({
												...editingRule,
												minBusinessVintageMonths:
													Number.parseInt(e.target.value) || undefined,
											})
										}
									/>
								</div>

								<div className="space-y-2">
									<Label>Notes</Label>
									<Textarea
										value={editingRule.notes || ""}
										onChange={(e) =>
											setEditingRule({ ...editingRule, notes: e.target.value })
										}
										rows={2}
									/>
								</div>

								<div className="flex items-center space-x-2">
									<Switch
										checked={editingRule.isActive}
										onCheckedChange={(v) =>
											setEditingRule({ ...editingRule, isActive: v })
										}
									/>
									<Label>Active</Label>
								</div>
							</div>
						)}
					</ScrollArea>
					<DialogFooter>
						<Button variant="outline" onClick={() => setIsEditing(false)}>
							Cancel
						</Button>
						<Button
							onClick={handleSaveRule}
							disabled={
								updateRuleMutation.isPending || createRuleMutation.isPending
							}
						>
							{updateRuleMutation.isPending || createRuleMutation.isPending
								? "Saving..."
								: "Save Rule"}
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>

			<Dialog open={isTestDialogOpen} onOpenChange={setIsTestDialogOpen}>
				<DialogContent>
					<DialogHeader>
						<DialogTitle>Test Eligibility</DialogTitle>
					</DialogHeader>
					<div className="space-y-4 py-4">
						<div className="grid grid-cols-2 gap-4">
							<div className="space-y-2">
								<Label>CIBIL Score</Label>
								<Input
									type="number"
									value={testProfile.cibilScore}
									onChange={(e) =>
										setTestProfile({
											...testProfile,
											cibilScore: Number.parseInt(e.target.value),
										})
									}
								/>
							</div>
							<div className="space-y-2">
								<Label>Monthly Income</Label>
								<Input
									type="number"
									value={testProfile.monthlyIncome}
									onChange={(e) =>
										setTestProfile({
											...testProfile,
											monthlyIncome: Number.parseInt(e.target.value),
										})
									}
								/>
							</div>
						</div>
						<div className="grid grid-cols-2 gap-4">
							<div className="space-y-2">
								<Label>Employment Type</Label>
								<Select
									value={testProfile.employmentType}
									onValueChange={(v) =>
										setTestProfile({ ...testProfile, employmentType: v })
									}
								>
									<SelectTrigger>
										<SelectValue />
									</SelectTrigger>
									<SelectContent>
										{EMPLOYMENT_TYPES.map((type) => (
											<SelectItem key={type} value={type}>
												{type}
											</SelectItem>
										))}
									</SelectContent>
								</Select>
							</div>
							<div className="space-y-2">
								<Label>Age</Label>
								<Input
									type="number"
									value={testProfile.age}
									onChange={(e) =>
										setTestProfile({
											...testProfile,
											age: Number.parseInt(e.target.value),
										})
									}
								/>
							</div>
						</div>
						<div className="space-y-2">
							<Label>Loan Amount</Label>
							<Input
								type="number"
								value={testProfile.loanAmount}
								onChange={(e) =>
									setTestProfile({
										...testProfile,
										loanAmount: Number.parseInt(e.target.value),
									})
								}
							/>
						</div>
					</div>
					<DialogFooter>
						<Button
							variant="outline"
							onClick={() => setIsTestDialogOpen(false)}
						>
							Close
						</Button>
						<Button
							onClick={() => evaluateMutation.mutate()}
							disabled={evaluateMutation.isPending}
						>
							{evaluateMutation.isPending ? "Evaluating..." : "Evaluate"}
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>
		</div>
	);
}
