import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
	DialogFooter,
} from "@/components/ui/dialog";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import {
	RefreshCw,
	Search,
	Loader2,
	ArrowLeft,
	TrendingUp,
	AlertTriangle,
	Plus,
	Edit,
	Coins,
	Calendar,
	Percent,
	IndianRupee,
} from "lucide-react";
import { Link } from "wouter";
import { format } from "date-fns";

interface SgbIssue {
	id: number;
	seriesNumber: string;
	seriesName: string;
	fiscalYear: string;
	issueOpenDate: string;
	issueCloseDate: string;
	issuePrice: string;
	discountOnlinePayment: string | null;
	interestRate: string;
	tenureYears: number;
	maturityDate: string | null;
	issueStatus: string;
	goldReferencePrice: string | null;
	minimumInvestmentGrams: number;
	maximumInvestmentGrams: number;
	isPublished: boolean;
}

interface GoldProduct {
	id: number;
	isin: string;
	securityName: string;
	securityType: string;
	issuer: string;
	issueDate: string | null;
	maturityDate: string | null;
	couponRate: string | null;
	currentPrice: string | null;
	yieldToMaturity: string | null;
	tradingStatus: string | null;
	sgbGoldPrice: string | null;
	sgbRedemptionValue: string | null;
	lastUpdated: string | null;
}

function formatCurrency(value: string | null | undefined): string {
	if (!value) return "—";
	const num = Number.parseFloat(value);
	if (Number.isNaN(num)) return "—";
	return `₹${num.toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;
}

function formatDate(dateStr: string | null | undefined): string {
	if (!dateStr) return "—";
	try {
		return format(new Date(dateStr), "dd MMM yyyy");
	} catch {
		return dateStr;
	}
}

export default function GoldSeedPage() {
	const { toast } = useToast();
	const [searchQuery, setSearchQuery] = useState("");
	const [activeTab, setActiveTab] = useState("sgb-issues");

	const {
		data: sgbIssuesData,
		isLoading: isLoadingSgb,
		refetch: refetchSgb,
	} = useQuery<{ issues: SgbIssue[] }>({
		queryKey: ["/api/admin/gold/sgb-issues"],
	});

	const {
		data: goldProductsData,
		isLoading: isLoadingProducts,
		refetch: refetchProducts,
	} = useQuery<{ products: GoldProduct[] }>({
		queryKey: ["/api/admin/gold/products"],
	});

	const sgbIssues = sgbIssuesData?.issues || [];
	const goldProducts = goldProductsData?.products || [];

	const filteredSgbIssues = sgbIssues.filter((issue) => {
		if (!searchQuery) return true;
		const query = searchQuery.toLowerCase();
		return (
			issue.seriesNumber.toLowerCase().includes(query) ||
			issue.seriesName.toLowerCase().includes(query) ||
			issue.fiscalYear.toLowerCase().includes(query)
		);
	});

	const filteredGoldProducts = goldProducts.filter((product) => {
		if (!searchQuery) return true;
		const query = searchQuery.toLowerCase();
		return (
			product.isin.toLowerCase().includes(query) ||
			product.securityName.toLowerCase().includes(query)
		);
	});

	const togglePublishMutation = useMutation({
		mutationFn: async ({
			id,
			isPublished,
		}: { id: number; isPublished: boolean }) => {
			const response = await apiRequest(
				`/api/admin/gold/sgb-issues/${id}/publish`,
				{
					method: "PATCH",
					body: JSON.stringify({ isPublished }),
				},
			);
			return response;
		},
		onSuccess: () => {
			queryClient.invalidateQueries({
				queryKey: ["/api/admin/gold/sgb-issues"],
			});
			toast({ title: "Success", description: "SGB issue status updated" });
		},
		onError: () => {
			toast({
				title: "Error",
				description: "Failed to update status",
				variant: "destructive",
			});
		},
	});

	const refreshMutation = useMutation({
		mutationFn: async () => {
			const response = await apiRequest("/api/admin/gold/refresh", {
				method: "POST",
			});
			return response;
		},
		onSuccess: () => {
			refetchSgb();
			refetchProducts();
			toast({
				title: "Success",
				description: "Gold data refreshed from RBI/NSE",
			});
		},
		onError: () => {
			toast({
				title: "Error",
				description: "Failed to refresh data",
				variant: "destructive",
			});
		},
	});

	const getStatusBadge = (status: string) => {
		switch (status) {
			case "open":
				return <Badge className="bg-green-500">Open</Badge>;
			case "closed":
				return <Badge variant="secondary">Closed</Badge>;
			case "upcoming":
				return <Badge className="bg-blue-500">Upcoming</Badge>;
			case "matured":
				return <Badge variant="outline">Matured</Badge>;
			default:
				return <Badge variant="outline">{status}</Badge>;
		}
	};

	return (
		<div className="container mx-auto py-6 space-y-6">
			<div className="flex items-center justify-between">
				<div className="flex items-center gap-4">
					<Link href="/admin/store">
						<Button variant="ghost" size="icon">
							<ArrowLeft className="h-5 w-5" />
						</Button>
					</Link>
					<div>
						<h1 className="text-2xl font-bold flex items-center gap-2">
							<Coins className="h-6 w-6 text-yellow-500" />
							Gold & SGB Seed Management
						</h1>
						<p className="text-muted-foreground">
							Manage Sovereign Gold Bonds and gold investment products
						</p>
					</div>
				</div>
				<Button
					onClick={() => refreshMutation.mutate()}
					disabled={refreshMutation.isPending}
				>
					{refreshMutation.isPending ? (
						<Loader2 className="h-4 w-4 mr-2 animate-spin" />
					) : (
						<RefreshCw className="h-4 w-4 mr-2" />
					)}
					Refresh from RBI/NSE
				</Button>
			</div>

			<div className="grid grid-cols-1 md:grid-cols-4 gap-4">
				<Card>
					<CardHeader className="pb-2">
						<CardTitle className="text-sm font-medium text-muted-foreground">
							Total SGB Issues
						</CardTitle>
					</CardHeader>
					<CardContent>
						<div className="text-2xl font-bold">{sgbIssues.length}</div>
					</CardContent>
				</Card>
				<Card>
					<CardHeader className="pb-2">
						<CardTitle className="text-sm font-medium text-muted-foreground">
							Open Issues
						</CardTitle>
					</CardHeader>
					<CardContent>
						<div className="text-2xl font-bold text-green-600">
							{sgbIssues.filter((i) => i.issueStatus === "open").length}
						</div>
					</CardContent>
				</Card>
				<Card>
					<CardHeader className="pb-2">
						<CardTitle className="text-sm font-medium text-muted-foreground">
							Gold Products
						</CardTitle>
					</CardHeader>
					<CardContent>
						<div className="text-2xl font-bold">{goldProducts.length}</div>
					</CardContent>
				</Card>
				<Card>
					<CardHeader className="pb-2">
						<CardTitle className="text-sm font-medium text-muted-foreground">
							Published
						</CardTitle>
					</CardHeader>
					<CardContent>
						<div className="text-2xl font-bold text-blue-600">
							{sgbIssues.filter((i) => i.isPublished).length}
						</div>
					</CardContent>
				</Card>
			</div>

			<Card>
				<CardHeader>
					<div className="flex items-center justify-between">
						<div className="relative w-80">
							<Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
							<Input
								placeholder="Search by series, name, or ISIN..."
								value={searchQuery}
								onChange={(e) => setSearchQuery(e.target.value)}
								className="pl-10"
							/>
						</div>
					</div>
				</CardHeader>
				<CardContent>
					<Tabs value={activeTab} onValueChange={setActiveTab}>
						<TabsList>
							<TabsTrigger value="sgb-issues">SGB Issues</TabsTrigger>
							<TabsTrigger value="gold-products">Gold Products</TabsTrigger>
						</TabsList>

						<TabsContent value="sgb-issues" className="mt-4">
							{isLoadingSgb ? (
								<div className="flex justify-center py-8">
									<Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
								</div>
							) : filteredSgbIssues.length === 0 ? (
								<div className="text-center py-8 text-muted-foreground">
									<Coins className="h-12 w-12 mx-auto mb-4 opacity-50" />
									<p>No SGB issues found</p>
									<p className="text-sm">
										Click "Refresh from RBI/NSE" to fetch latest data
									</p>
								</div>
							) : (
								<ScrollArea className="h-[500px]">
									<Table>
										<TableHeader>
											<TableRow>
												<TableHead>Series</TableHead>
												<TableHead>Fiscal Year</TableHead>
												<TableHead>Issue Period</TableHead>
												<TableHead>Issue Price</TableHead>
												<TableHead>Interest Rate</TableHead>
												<TableHead>Tenure</TableHead>
												<TableHead>Status</TableHead>
												<TableHead>Published</TableHead>
											</TableRow>
										</TableHeader>
										<TableBody>
											{filteredSgbIssues.map((issue) => (
												<TableRow key={issue.id}>
													<TableCell>
														<div className="font-medium">
															{issue.seriesNumber}
														</div>
														<div className="text-sm text-muted-foreground">
															{issue.seriesName}
														</div>
													</TableCell>
													<TableCell>{issue.fiscalYear}</TableCell>
													<TableCell>
														<div className="text-sm">
															{formatDate(issue.issueOpenDate)} -{" "}
															{formatDate(issue.issueCloseDate)}
														</div>
													</TableCell>
													<TableCell>
														<div className="font-medium">
															{formatCurrency(issue.issuePrice)}
														</div>
														{issue.discountOnlinePayment && (
															<div className="text-xs text-green-600">
																Online:{" "}
																{formatCurrency(
																	(
																		Number.parseFloat(issue.issuePrice) -
																		Number.parseFloat(
																			issue.discountOnlinePayment,
																		)
																	).toString(),
																)}
															</div>
														)}
													</TableCell>
													<TableCell>
														<Badge variant="outline" className="gap-1">
															<Percent className="h-3 w-3" />
															{issue.interestRate}%
														</Badge>
													</TableCell>
													<TableCell>{issue.tenureYears} years</TableCell>
													<TableCell>
														{getStatusBadge(issue.issueStatus)}
													</TableCell>
													<TableCell>
														<Switch
															checked={issue.isPublished}
															onCheckedChange={(checked) =>
																togglePublishMutation.mutate({
																	id: issue.id,
																	isPublished: checked,
																})
															}
															disabled={togglePublishMutation.isPending}
														/>
													</TableCell>
												</TableRow>
											))}
										</TableBody>
									</Table>
								</ScrollArea>
							)}
						</TabsContent>

						<TabsContent value="gold-products" className="mt-4">
							{isLoadingProducts ? (
								<div className="flex justify-center py-8">
									<Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
								</div>
							) : filteredGoldProducts.length === 0 ? (
								<div className="text-center py-8 text-muted-foreground">
									<Coins className="h-12 w-12 mx-auto mb-4 opacity-50" />
									<p>No gold products found</p>
									<p className="text-sm">
										Gold products from bond catalog will appear here
									</p>
								</div>
							) : (
								<ScrollArea className="h-[500px]">
									<Table>
										<TableHeader>
											<TableRow>
												<TableHead>ISIN</TableHead>
												<TableHead>Security Name</TableHead>
												<TableHead>Type</TableHead>
												<TableHead>Issue Date</TableHead>
												<TableHead>Maturity</TableHead>
												<TableHead>Coupon</TableHead>
												<TableHead>Current Price</TableHead>
												<TableHead>Gold Price</TableHead>
												<TableHead>Status</TableHead>
											</TableRow>
										</TableHeader>
										<TableBody>
											{filteredGoldProducts.map((product) => (
												<TableRow key={product.id}>
													<TableCell className="font-mono text-sm">
														{product.isin}
													</TableCell>
													<TableCell className="font-medium">
														{product.securityName}
													</TableCell>
													<TableCell>
														<Badge variant="outline">
															{product.securityType}
														</Badge>
													</TableCell>
													<TableCell>{formatDate(product.issueDate)}</TableCell>
													<TableCell>
														{formatDate(product.maturityDate)}
													</TableCell>
													<TableCell>
														{product.couponRate
															? `${product.couponRate}%`
															: "—"}
													</TableCell>
													<TableCell>
														{formatCurrency(product.currentPrice)}
													</TableCell>
													<TableCell>
														{formatCurrency(product.sgbGoldPrice)}
													</TableCell>
													<TableCell>
														<Badge
															variant={
																product.tradingStatus === "active"
																	? "default"
																	: "secondary"
															}
														>
															{product.tradingStatus || "Unknown"}
														</Badge>
													</TableCell>
												</TableRow>
											))}
										</TableBody>
									</Table>
								</ScrollArea>
							)}
						</TabsContent>
					</Tabs>
				</CardContent>
			</Card>
		</div>
	);
}
