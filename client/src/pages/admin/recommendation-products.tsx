import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
	DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import {
	ArrowLeft,
	Search,
	Loader2,
	TrendingUp,
	Plus,
	Pencil,
	Trash2,
	RefreshCw,
	Database,
	BarChart3,
	Building2,
	Factory,
	LineChart,
	CheckCircle,
	XCircle,
} from "lucide-react";
import { Link } from "wouter";

interface RecommendationProduct {
	id: string;
	productType: string;
	productId?: string;
	name: string;
	symbol?: string;
	amc?: string;
	category?: string;
	sector?: string;
	riskProfile: string;
	returns1Y?: string;
	returns3Y?: string;
	returns5Y?: string;
	dividendYield?: string;
	currentPrice?: string;
	peRatio?: string;
	marketCap?: string;
	riskLevel?: string;
	minimumInvestment?: string;
	lotSize?: number;
	selectionRationale?: string;
	investmentThesis?: string;
	priority: number;
	isActive: boolean;
	requiresEnhancedKYC: boolean;
	dataSource?: string;
	createdAt: string;
	updatedAt: string;
}

interface ProductStats {
	productType: string;
	riskProfile: string;
	count: number;
	activeCount: number;
}

const PRODUCT_TYPES = [
	{ value: "listed_stock", label: "Listed Stocks", icon: LineChart },
	{ value: "unlisted_stock", label: "Unlisted Stocks", icon: Factory },
	{ value: "reit", label: "REITs", icon: Building2 },
	{ value: "invit", label: "InvITs", icon: Building2 },
	{ value: "etf", label: "ETFs", icon: LineChart },
];

const RISK_PROFILES = [
	{ value: "conservative", label: "Conservative", color: "bg-green-500" },
	{ value: "moderate", label: "Moderate", color: "bg-blue-500" },
	{ value: "aggressive", label: "Aggressive", color: "bg-orange-500" },
	{ value: "very_aggressive", label: "Very Aggressive", color: "bg-red-500" },
];

const SECTORS = [
	"IT",
	"Banking",
	"Pharma",
	"FMCG",
	"Auto",
	"Energy",
	"Infrastructure",
	"Telecom",
	"Real Estate",
	"Metals",
	"Chemicals",
	"Financial",
	"Tech",
	"NBFC",
	"Exchange",
	"Power Transmission",
	"Roads",
	"Office",
];

export default function RecommendationProductsAdmin() {
	const { toast } = useToast();
	const [activeTab, setActiveTab] = useState("listed_stock");
	const [searchQuery, setSearchQuery] = useState("");
	const [riskFilter, setRiskFilter] = useState<string>("all");
	const [activeFilter, setActiveFilter] = useState<string>("all");
	const [selectedProducts, setSelectedProducts] = useState<Set<string>>(
		new Set(),
	);
	const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
	const [editingProduct, setEditingProduct] =
		useState<RecommendationProduct | null>(null);

	const [formData, setFormData] = useState({
		name: "",
		symbol: "",
		amc: "",
		category: "",
		sector: "",
		riskProfile: "moderate",
		returns1Y: "",
		returns3Y: "",
		returns5Y: "",
		dividendYield: "",
		currentPrice: "",
		peRatio: "",
		marketCap: "",
		riskLevel: "Moderate",
		minimumInvestment: "",
		lotSize: 1,
		selectionRationale: "",
		investmentThesis: "",
		priority: 50,
		isActive: true,
		requiresEnhancedKYC: false,
	});

	const {
		data: products,
		isLoading,
		refetch,
	} = useQuery<RecommendationProduct[]>({
		queryKey: [
			"/api/admin/recommendation-products",
			activeTab,
			riskFilter,
			activeFilter,
			searchQuery,
		],
		queryFn: async () => {
			const params = new URLSearchParams();
			params.set("productType", activeTab);
			if (riskFilter !== "all") params.set("riskProfile", riskFilter);
			if (activeFilter !== "all") params.set("isActive", activeFilter);
			if (searchQuery) params.set("search", searchQuery);
			const res = await fetch(`/api/admin/recommendation-products?${params}`);
			return res.json();
		},
	});

	const { data: stats } = useQuery<ProductStats[]>({
		queryKey: ["/api/admin/recommendation-products/stats"],
	});

	const createMutation = useMutation({
		mutationFn: async (data: any) => {
			return apiRequest("/api/admin/recommendation-products", {
				method: "POST",
				body: JSON.stringify({ ...data, productType: activeTab }),
			});
		},
		onSuccess: () => {
			toast({ title: "Product added successfully" });
			queryClient.invalidateQueries({
				queryKey: ["/api/admin/recommendation-products"],
			});
			setIsAddDialogOpen(false);
			resetForm();
		},
		onError: (error: any) => {
			toast({
				title: "Error adding product",
				description: error.message,
				variant: "destructive",
			});
		},
	});

	const updateMutation = useMutation({
		mutationFn: async ({ id, data }: { id: string; data: any }) => {
			return apiRequest(`/api/admin/recommendation-products/${id}`, {
				method: "PATCH",
				body: JSON.stringify(data),
			});
		},
		onSuccess: () => {
			toast({ title: "Product updated successfully" });
			queryClient.invalidateQueries({
				queryKey: ["/api/admin/recommendation-products"],
			});
			setEditingProduct(null);
			resetForm();
		},
		onError: (error: any) => {
			toast({
				title: "Error updating product",
				description: error.message,
				variant: "destructive",
			});
		},
	});

	const deleteMutation = useMutation({
		mutationFn: async (id: string) => {
			return apiRequest(`/api/admin/recommendation-products/${id}`, {
				method: "DELETE",
			});
		},
		onSuccess: () => {
			toast({ title: "Product deleted successfully" });
			queryClient.invalidateQueries({
				queryKey: ["/api/admin/recommendation-products"],
			});
		},
		onError: (error: any) => {
			toast({
				title: "Error deleting product",
				description: error.message,
				variant: "destructive",
			});
		},
	});

	const bulkStatusMutation = useMutation({
		mutationFn: async ({
			ids,
			isActive,
		}: { ids: string[]; isActive: boolean }) => {
			return apiRequest("/api/admin/recommendation-products/bulk-status", {
				method: "POST",
				body: JSON.stringify({ ids, isActive }),
			});
		},
		onSuccess: () => {
			toast({ title: "Status updated successfully" });
			queryClient.invalidateQueries({
				queryKey: ["/api/admin/recommendation-products"],
			});
			setSelectedProducts(new Set());
		},
		onError: (error: any) => {
			toast({
				title: "Error updating status",
				description: error.message,
				variant: "destructive",
			});
		},
	});

	const seedMutation = useMutation({
		mutationFn: async () => {
			return apiRequest("/api/admin/recommendation-products/seed-initial", {
				method: "POST",
			});
		},
		onSuccess: (data: any) => {
			toast({
				title: "Seed complete",
				description: `Inserted ${data.inserted || 0} products`,
			});
			queryClient.invalidateQueries({
				queryKey: ["/api/admin/recommendation-products"],
			});
		},
		onError: (error: any) => {
			toast({
				title: "Error seeding",
				description: error.message,
				variant: "destructive",
			});
		},
	});

	const resetForm = () => {
		setFormData({
			name: "",
			symbol: "",
			amc: "",
			category: "",
			sector: "",
			riskProfile: "moderate",
			returns1Y: "",
			returns3Y: "",
			returns5Y: "",
			dividendYield: "",
			currentPrice: "",
			peRatio: "",
			marketCap: "",
			riskLevel: "Moderate",
			minimumInvestment: "",
			lotSize: 1,
			selectionRationale: "",
			investmentThesis: "",
			priority: 50,
			isActive: true,
			requiresEnhancedKYC: false,
		});
	};

	const handleEdit = (product: RecommendationProduct) => {
		setEditingProduct(product);
		setFormData({
			name: product.name,
			symbol: product.symbol || "",
			amc: product.amc || "",
			category: product.category || "",
			sector: product.sector || "",
			riskProfile: product.riskProfile,
			returns1Y: product.returns1Y || "",
			returns3Y: product.returns3Y || "",
			returns5Y: product.returns5Y || "",
			dividendYield: product.dividendYield || "",
			currentPrice: product.currentPrice || "",
			peRatio: product.peRatio || "",
			marketCap: product.marketCap || "",
			riskLevel: product.riskLevel || "Moderate",
			minimumInvestment: product.minimumInvestment || "",
			lotSize: product.lotSize || 1,
			selectionRationale: product.selectionRationale || "",
			investmentThesis: product.investmentThesis || "",
			priority: product.priority,
			isActive: product.isActive,
			requiresEnhancedKYC: product.requiresEnhancedKYC,
		});
		setIsAddDialogOpen(true);
	};

	const handleSubmit = () => {
		if (!formData.name.trim()) {
			toast({ title: "Name is required", variant: "destructive" });
			return;
		}

		if (editingProduct) {
			updateMutation.mutate({ id: editingProduct.id, data: formData });
		} else {
			createMutation.mutate(formData);
		}
	};

	const toggleSelectAll = () => {
		if (products && selectedProducts.size === products.length) {
			setSelectedProducts(new Set());
		} else if (products) {
			setSelectedProducts(new Set(products.map((p) => p.id)));
		}
	};

	const toggleSelect = (id: string) => {
		const newSelected = new Set(selectedProducts);
		if (newSelected.has(id)) {
			newSelected.delete(id);
		} else {
			newSelected.add(id);
		}
		setSelectedProducts(newSelected);
	};

	const getTypeStats = (type: string) => {
		if (!stats) return { total: 0, active: 0 };
		const typeStats = stats.filter((s) => s.productType === type);
		return {
			total: typeStats.reduce((sum, s) => sum + Number(s.count), 0),
			active: typeStats.reduce((sum, s) => sum + Number(s.activeCount), 0),
		};
	};

	const getRiskBadgeColor = (risk: string) => {
		const profile = RISK_PROFILES.find((r) => r.value === risk);
		return profile?.color || "bg-muted";
	};

	return (
		<div className="container mx-auto p-6 max-w-7xl">
			<div className="flex items-center gap-4 mb-6">
				<Link href="/admin">
					<Button variant="ghost" size="icon">
						<ArrowLeft className="h-5 w-5" />
					</Button>
				</Link>
				<div>
					<h1 className="text-2xl font-bold">Recommendation Products</h1>
					<p className="text-muted-foreground">
						Manage stocks, REITs, and InvITs for investment recommendations
					</p>
				</div>
				<div className="ml-auto flex gap-2">
					<Button
						variant="outline"
						onClick={() => seedMutation.mutate()}
						disabled={seedMutation.isPending}
					>
						{seedMutation.isPending ? (
							<Loader2 className="h-4 w-4 animate-spin mr-2" />
						) : (
							<Database className="h-4 w-4 mr-2" />
						)}
						Seed Initial Data
					</Button>
					<Button variant="outline" onClick={() => refetch()}>
						<RefreshCw className="h-4 w-4 mr-2" />
						Refresh
					</Button>
				</div>
			</div>

			<div className="grid grid-cols-4 gap-4 mb-6">
				{PRODUCT_TYPES.map((type) => {
					const typeStats = getTypeStats(type.value);
					const Icon = type.icon;
					return (
						<Card
							key={type.value}
							className={activeTab === type.value ? "border-primary" : ""}
						>
							<CardHeader className="pb-2">
								<CardTitle className="text-sm flex items-center gap-2">
									<Icon className="h-4 w-4" />
									{type.label}
								</CardTitle>
							</CardHeader>
							<CardContent>
								<div className="text-2xl font-bold">{typeStats.active}</div>
								<p className="text-xs text-muted-foreground">
									of {typeStats.total} active
								</p>
							</CardContent>
						</Card>
					);
				})}
			</div>

			<Card>
				<CardHeader>
					<Tabs value={activeTab} onValueChange={setActiveTab}>
						<TabsList className="grid w-full grid-cols-4">
							{PRODUCT_TYPES.map((type) => (
								<TabsTrigger key={type.value} value={type.value}>
									{type.label}
								</TabsTrigger>
							))}
						</TabsList>
					</Tabs>
				</CardHeader>
				<CardContent>
					<div className="flex gap-4 mb-4">
						<div className="relative flex-1">
							<Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
							<Input
								placeholder="Search by name, symbol, sector..."
								value={searchQuery}
								onChange={(e) => setSearchQuery(e.target.value)}
								className="pl-10"
							/>
						</div>
						<Select value={riskFilter} onValueChange={setRiskFilter}>
							<SelectTrigger className="w-48">
								<SelectValue placeholder="Risk Profile" />
							</SelectTrigger>
							<SelectContent>
								<SelectItem value="all">All Risk Profiles</SelectItem>
								{RISK_PROFILES.map((r) => (
									<SelectItem key={r.value} value={r.value}>
										{r.label}
									</SelectItem>
								))}
							</SelectContent>
						</Select>
						<Select value={activeFilter} onValueChange={setActiveFilter}>
							<SelectTrigger className="w-36">
								<SelectValue placeholder="Status" />
							</SelectTrigger>
							<SelectContent>
								<SelectItem value="all">All</SelectItem>
								<SelectItem value="true">Active</SelectItem>
								<SelectItem value="false">Inactive</SelectItem>
							</SelectContent>
						</Select>
						<Dialog
							open={isAddDialogOpen}
							onOpenChange={(open) => {
								setIsAddDialogOpen(open);
								if (!open) {
									setEditingProduct(null);
									resetForm();
								}
							}}
						>
							<DialogTrigger asChild>
								<Button>
									<Plus className="h-4 w-4 mr-2" />
									Add Product
								</Button>
							</DialogTrigger>
							<DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
								<DialogHeader>
									<DialogTitle>
										{editingProduct ? "Edit" : "Add"}{" "}
										{PRODUCT_TYPES.find(
											(t) => t.value === activeTab,
										)?.label.slice(0, -1)}
									</DialogTitle>
									<DialogDescription>
										{editingProduct
											? "Update the product details"
											: "Add a new product for recommendations"}
									</DialogDescription>
								</DialogHeader>
								<div className="grid gap-4 py-4">
									<div className="grid grid-cols-2 gap-4">
										<div className="space-y-2">
											<Label>Name *</Label>
											<Input
												value={formData.name}
												onChange={(e) =>
													setFormData({ ...formData, name: e.target.value })
												}
												placeholder="Company/Fund name"
											/>
										</div>
										<div className="space-y-2">
											<Label>Symbol</Label>
											<Input
												value={formData.symbol}
												onChange={(e) =>
													setFormData({ ...formData, symbol: e.target.value })
												}
												placeholder="NSE symbol"
											/>
										</div>
									</div>
									<div className="grid grid-cols-2 gap-4">
										<div className="space-y-2">
											<Label>Sector</Label>
											<Select
												value={formData.sector}
												onValueChange={(v) =>
													setFormData({ ...formData, sector: v })
												}
											>
												<SelectTrigger>
													<SelectValue placeholder="Select sector" />
												</SelectTrigger>
												<SelectContent>
													{SECTORS.map((s) => (
														<SelectItem key={s} value={s}>
															{s}
														</SelectItem>
													))}
												</SelectContent>
											</Select>
										</div>
										<div className="space-y-2">
											<Label>Category</Label>
											<Input
												value={formData.category}
												onChange={(e) =>
													setFormData({ ...formData, category: e.target.value })
												}
												placeholder="e.g., Stock - Large Cap"
											/>
										</div>
									</div>
									<div className="grid grid-cols-3 gap-4">
										<div className="space-y-2">
											<Label>Risk Profile *</Label>
											<Select
												value={formData.riskProfile}
												onValueChange={(v) =>
													setFormData({ ...formData, riskProfile: v })
												}
											>
												<SelectTrigger>
													<SelectValue />
												</SelectTrigger>
												<SelectContent>
													{RISK_PROFILES.map((r) => (
														<SelectItem key={r.value} value={r.value}>
															{r.label}
														</SelectItem>
													))}
												</SelectContent>
											</Select>
										</div>
										<div className="space-y-2">
											<Label>Risk Level</Label>
											<Select
												value={formData.riskLevel}
												onValueChange={(v) =>
													setFormData({ ...formData, riskLevel: v })
												}
											>
												<SelectTrigger>
													<SelectValue />
												</SelectTrigger>
												<SelectContent>
													<SelectItem value="Low">Low</SelectItem>
													<SelectItem value="Moderate">Moderate</SelectItem>
													<SelectItem value="Moderately High">
														Moderately High
													</SelectItem>
													<SelectItem value="High">High</SelectItem>
													<SelectItem value="Very High">Very High</SelectItem>
												</SelectContent>
											</Select>
										</div>
										<div className="space-y-2">
											<Label>Priority (1-100)</Label>
											<Input
												type="number"
												min={1}
												max={100}
												value={formData.priority}
												onChange={(e) =>
													setFormData({
														...formData,
														priority: Number.parseInt(e.target.value) || 50,
													})
												}
											/>
										</div>
									</div>
									<div className="grid grid-cols-4 gap-4">
										<div className="space-y-2">
											<Label>1Y Returns %</Label>
											<Input
												value={formData.returns1Y}
												onChange={(e) =>
													setFormData({
														...formData,
														returns1Y: e.target.value,
													})
												}
												placeholder="e.g., 15.5"
											/>
										</div>
										<div className="space-y-2">
											<Label>3Y Returns %</Label>
											<Input
												value={formData.returns3Y}
												onChange={(e) =>
													setFormData({
														...formData,
														returns3Y: e.target.value,
													})
												}
												placeholder="e.g., 18.2"
											/>
										</div>
										<div className="space-y-2">
											<Label>5Y Returns %</Label>
											<Input
												value={formData.returns5Y}
												onChange={(e) =>
													setFormData({
														...formData,
														returns5Y: e.target.value,
													})
												}
												placeholder="e.g., 20.0"
											/>
										</div>
										<div className="space-y-2">
											<Label>Dividend Yield %</Label>
											<Input
												value={formData.dividendYield}
												onChange={(e) =>
													setFormData({
														...formData,
														dividendYield: e.target.value,
													})
												}
												placeholder="e.g., 2.5"
											/>
										</div>
									</div>
									<div className="grid grid-cols-3 gap-4">
										<div className="space-y-2">
											<Label>Current Price</Label>
											<Input
												value={formData.currentPrice}
												onChange={(e) =>
													setFormData({
														...formData,
														currentPrice: e.target.value,
													})
												}
												placeholder="e.g., 2500"
											/>
										</div>
										<div className="space-y-2">
											<Label>P/E Ratio</Label>
											<Input
												value={formData.peRatio}
												onChange={(e) =>
													setFormData({ ...formData, peRatio: e.target.value })
												}
												placeholder="e.g., 25.5"
											/>
										</div>
										<div className="space-y-2">
											<Label>Market Cap</Label>
											<Select
												value={formData.marketCap}
												onValueChange={(v) =>
													setFormData({ ...formData, marketCap: v })
												}
											>
												<SelectTrigger>
													<SelectValue placeholder="Select" />
												</SelectTrigger>
												<SelectContent>
													<SelectItem value="Large Cap">Large Cap</SelectItem>
													<SelectItem value="Mid Cap">Mid Cap</SelectItem>
													<SelectItem value="Small Cap">Small Cap</SelectItem>
												</SelectContent>
											</Select>
										</div>
									</div>
									<div className="space-y-2">
										<Label>Selection Rationale</Label>
										<Textarea
											value={formData.selectionRationale}
											onChange={(e) =>
												setFormData({
													...formData,
													selectionRationale: e.target.value,
												})
											}
											placeholder="Why this product is recommended..."
											rows={2}
										/>
									</div>
									<div className="space-y-2">
										<Label>Investment Thesis</Label>
										<Textarea
											value={formData.investmentThesis}
											onChange={(e) =>
												setFormData({
													...formData,
													investmentThesis: e.target.value,
												})
											}
											placeholder="Investment thesis for agents..."
											rows={2}
										/>
									</div>
									<div className="flex items-center gap-6">
										<div className="flex items-center gap-2">
											<Switch
												checked={formData.isActive}
												onCheckedChange={(checked) =>
													setFormData({ ...formData, isActive: checked })
												}
											/>
											<Label>Active (available for recommendations)</Label>
										</div>
										<div className="flex items-center gap-2">
											<Switch
												checked={formData.requiresEnhancedKYC}
												onCheckedChange={(checked) =>
													setFormData({
														...formData,
														requiresEnhancedKYC: checked,
													})
												}
											/>
											<Label>Requires Enhanced KYC</Label>
										</div>
									</div>
								</div>
								<DialogFooter>
									<Button
										variant="outline"
										onClick={() => setIsAddDialogOpen(false)}
									>
										Cancel
									</Button>
									<Button
										onClick={handleSubmit}
										disabled={
											createMutation.isPending || updateMutation.isPending
										}
									>
										{(createMutation.isPending || updateMutation.isPending) && (
											<Loader2 className="h-4 w-4 animate-spin mr-2" />
										)}
										{editingProduct ? "Update" : "Add"} Product
									</Button>
								</DialogFooter>
							</DialogContent>
						</Dialog>
					</div>

					{selectedProducts.size > 0 && (
						<div className="flex gap-2 mb-4 p-3 bg-muted rounded-lg">
							<span className="text-sm font-medium">
								{selectedProducts.size} selected
							</span>
							<Button
								size="sm"
								variant="outline"
								onClick={() =>
									bulkStatusMutation.mutate({
										ids: Array.from(selectedProducts),
										isActive: true,
									})
								}
							>
								<CheckCircle className="h-4 w-4 mr-1" /> Activate
							</Button>
							<Button
								size="sm"
								variant="outline"
								onClick={() =>
									bulkStatusMutation.mutate({
										ids: Array.from(selectedProducts),
										isActive: false,
									})
								}
							>
								<XCircle className="h-4 w-4 mr-1" /> Deactivate
							</Button>
							<Button
								size="sm"
								variant="ghost"
								onClick={() => setSelectedProducts(new Set())}
							>
								Clear
							</Button>
						</div>
					)}

					<ScrollArea className="h-[500px]">
						{isLoading ? (
							<div className="flex items-center justify-center h-32">
								<Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
							</div>
						) : products && products.length > 0 ? (
							<Table>
								<TableHeader>
									<TableRow>
										<TableHead className="w-12">
											<Checkbox
												checked={
													products.length > 0 &&
													selectedProducts.size === products.length
												}
												onCheckedChange={toggleSelectAll}
											/>
										</TableHead>
										<TableHead>Product</TableHead>
										<TableHead>Sector</TableHead>
										<TableHead>Risk Profile</TableHead>
										<TableHead>Returns (1Y)</TableHead>
										<TableHead>Priority</TableHead>
										<TableHead>Status</TableHead>
										<TableHead className="text-right">Actions</TableHead>
									</TableRow>
								</TableHeader>
								<TableBody>
									{products.map((product) => (
										<TableRow key={product.id}>
											<TableCell>
												<Checkbox
													checked={selectedProducts.has(product.id)}
													onCheckedChange={() => toggleSelect(product.id)}
												/>
											</TableCell>
											<TableCell>
												<div>
													<div className="font-medium">{product.name}</div>
													<div className="text-sm text-muted-foreground">
														{product.symbol && (
															<span className="mr-2">{product.symbol}</span>
														)}
														{product.category}
													</div>
												</div>
											</TableCell>
											<TableCell>{product.sector || "-"}</TableCell>
											<TableCell>
												<Badge
													className={getRiskBadgeColor(product.riskProfile)}
												>
													{
														RISK_PROFILES.find(
															(r) => r.value === product.riskProfile,
														)?.label
													}
												</Badge>
											</TableCell>
											<TableCell>
												{product.returns1Y ? (
													<span
														className={
															Number.parseFloat(product.returns1Y) >= 0
																? "text-green-600"
																: "text-red-600"
														}
													>
														{Number.parseFloat(product.returns1Y) >= 0
															? "+"
															: ""}
														{product.returns1Y}%
													</span>
												) : (
													"-"
												)}
											</TableCell>
											<TableCell>
												<Badge variant="outline">{product.priority}</Badge>
											</TableCell>
											<TableCell>
												<Badge
													variant={product.isActive ? "default" : "secondary"}
												>
													{product.isActive ? "Active" : "Inactive"}
												</Badge>
											</TableCell>
											<TableCell className="text-right">
												<div className="flex justify-end gap-1">
													<Button
														size="icon"
														variant="ghost"
														onClick={() => handleEdit(product)}
													>
														<Pencil className="h-4 w-4" />
													</Button>
													<Button
														size="icon"
														variant="ghost"
														onClick={() => {
															if (confirm("Delete this product?")) {
																deleteMutation.mutate(product.id);
															}
														}}
													>
														<Trash2 className="h-4 w-4 text-destructive" />
													</Button>
												</div>
											</TableCell>
										</TableRow>
									))}
								</TableBody>
							</Table>
						) : (
							<div className="flex flex-col items-center justify-center h-32 text-muted-foreground">
								<BarChart3 className="h-12 w-12 mb-2" />
								<p>No products found</p>
								<p className="text-sm">Add products or seed initial data</p>
							</div>
						)}
					</ScrollArea>
				</CardContent>
			</Card>
		</div>
	);
}
