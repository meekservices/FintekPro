import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsTrigger } from "@/components/ui/tabs";
import { ScrollableTabsList } from "@/components/ScrollableTabsList";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import {
	TrendingUp,
	TrendingDown,
	IndianRupee,
	Package,
	Users,
	AlertTriangle,
	Shield as LucideShield,
} from "lucide-react";
import { ProfitDashboard } from "@/components/supplier/profit-dashboard";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { LoadingState } from "@/components/LoadingState";

type Supplier = {
	id: string;
	name: string;
	isActive: boolean;
	contactEmail?: string;
	contactPhone?: string;
	performanceRating?: string;
	commissionRate?: string;
};

type Product = {
	id: string;
	name: string;
};

type ProfitAnalysis = {
	totalSuppliers: number;
	avgProfitMargin: number;
	totalRevenue: number;
	bestMargin: number;
	recommendations: string[];
};

type SupplierComparison = {
	supplierId: string;
	supplierName: string;
	isActive: boolean;
	costPrice: number;
	sellingPrice: number;
	profitMargin: number;
	performanceRating: number;
	salesVolume: number;
	revenue: number;
	commissionRate: number;
	notes?: string;
};

type OptimalSupplier = {
	supplierId: string;
	supplierName: string;
	profitMargin: number;
	profitScore: number;
};

type SuppliersResponse = { suppliers: Supplier[] };
type ProductsResponse = { products: Product[] };
type AnalysisResponse = { analysis: ProfitAnalysis };
type ComparisonResponse = { suppliers: SupplierComparison[] };
type OptimalResponse = { optimalSupplier: OptimalSupplier };

export function SupplierManagement() {
	const [selectedProductId, setSelectedProductId] = useState("");
	const { user, isAuthenticated, isLoading } = useAuth();
	const { toast } = useToast();

	// Check if user is admin
	const isAdmin =
		user?.roles?.includes("admin") || user?.roles?.includes("superadmin");

	// Redirect non-admin users
	useEffect(() => {
		if (!isLoading && isAuthenticated && !isAdmin) {
			toast({
				title: "Access Denied",
				description: "You don't have permission to access supplier management.",
				variant: "destructive",
			});
			setTimeout(() => {
				window.location.href = "/";
			}, 1500);
			return;
		}
		if (!isLoading && !isAuthenticated) {
			toast({
				title: "Authentication Required",
				description: "Please log in to access supplier management.",
				variant: "destructive",
			});
			setTimeout(() => {
				window.location.href = "/api/login";
			}, 1500);
			return;
		}
	}, [isAuthenticated, isLoading, isAdmin, toast]);

	const { data: suppliersData } = useQuery<SuppliersResponse>({
		queryKey: ["/api/suppliers"],
	});

	const { data: storeProductsData } = useQuery<ProductsResponse>({
		queryKey: ["/api/store-products"],
	});

	const { data: profitAnalysis, isLoading: isAnalysisLoading } =
		useQuery<AnalysisResponse>({
			queryKey: ["/api/products", selectedProductId, "profit-analysis"],
			enabled: !!selectedProductId,
		});

	const { data: supplierComparison, isLoading: isComparisonLoading } =
		useQuery<ComparisonResponse>({
			queryKey: ["/api/products", selectedProductId, "supplier-comparison"],
			enabled: !!selectedProductId,
		});

	const { data: optimalSupplierData } = useQuery<OptimalResponse>({
		queryKey: ["/api/products", selectedProductId, "optimal-supplier"],
		enabled: !!selectedProductId,
	});

	const suppliers = suppliersData?.suppliers || [];
	const storeProducts = storeProductsData?.products || [];
	const analysis = profitAnalysis?.analysis;
	const comparison = supplierComparison?.suppliers || [];
	const optimal = optimalSupplierData?.optimalSupplier;

	// Show loading state
	if (isLoading) {
		return (
			<div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
				<LoadingState variant="card" count={4} />
			</div>
		);
	}

	// Show unauthorized access for non-admin users
	if (isAuthenticated && !isAdmin) {
		return (
			<div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
				<Card>
					<CardContent className="p-12 text-center">
						<LucideShield className="h-12 w-12 text-red-500 mx-auto mb-4" />
						<h3 className="text-lg font-semibold mb-2">Access Denied</h3>
						<p className="text-muted-foreground">
							You don't have permission to access supplier management. Admin
							access required.
						</p>
					</CardContent>
				</Card>
			</div>
		);
	}

	// Show login prompt for unauthenticated users
	if (!isAuthenticated) {
		return (
			<div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
				<Card>
					<CardContent className="p-12 text-center">
						<LucideShield className="h-12 w-12 text-blue-500 mx-auto mb-4" />
						<h3 className="text-lg font-semibold mb-2">
							Authentication Required
						</h3>
						<p className="text-muted-foreground mb-4">
							Please log in to access supplier management.
						</p>
						<Button onClick={() => (window.location.href = "/api/login")}>
							Log In
						</Button>
					</CardContent>
				</Card>
			</div>
		);
	}

	return (
		<div className="container mx-auto p-6 space-y-6">
			<div className="flex justify-between items-center">
				<div>
					<h1 className="text-3xl font-bold">Supplier Management</h1>
					<p className="text-muted-foreground">
						Optimize profits through smart supplier selection
					</p>
				</div>
				<Button data-testid="button-add-supplier">Add New Supplier</Button>
			</div>

			{/* Product Selection */}
			<Card>
				<CardHeader>
					<CardTitle>Select Product for Analysis</CardTitle>
					<CardDescription>
						Choose a product to analyze supplier performance and profit
						optimization
					</CardDescription>
				</CardHeader>
				<CardContent>
					<Select
						value={selectedProductId}
						onValueChange={setSelectedProductId}
					>
						<SelectTrigger data-testid="select-product">
							<SelectValue placeholder="Select a product to analyze" />
						</SelectTrigger>
						<SelectContent>
							{storeProducts.map((product) => (
								<SelectItem key={product.id} value={product.id}>
									{product.name}
								</SelectItem>
							))}
						</SelectContent>
					</Select>
				</CardContent>
			</Card>

			{selectedProductId && (
				<Tabs defaultValue="analysis" className="space-y-4">
					<ScrollableTabsList>
						<TabsTrigger value="analysis" data-testid="tab-analysis">
							Profit Analysis
						</TabsTrigger>
						<TabsTrigger value="comparison" data-testid="tab-comparison">
							Supplier Comparison
						</TabsTrigger>
						<TabsTrigger value="dashboard" data-testid="tab-dashboard">
							Profit Dashboard
						</TabsTrigger>
						<TabsTrigger value="suppliers" data-testid="tab-suppliers">
							All Suppliers
						</TabsTrigger>
					</ScrollableTabsList>

					<TabsContent value="analysis" className="space-y-4">
						{isAnalysisLoading ? (
							<Card>
								<CardContent className="p-6">
									<div className="text-center">Loading profit analysis...</div>
								</CardContent>
							</Card>
						) : analysis ? (
							<>
								{/* Key Metrics */}
								<div className="grid grid-cols-1 md:grid-cols-4 gap-4">
									<Card>
										<CardContent className="p-6">
											<div className="flex items-center space-x-2">
												<Users className="h-4 w-4 text-blue-500" />
												<div>
													<p className="text-sm font-medium text-muted-foreground">
														Total Suppliers
													</p>
													<p
														className="text-2xl font-bold"
														data-testid="text-total-suppliers"
													>
														{analysis.totalSuppliers}
													</p>
												</div>
											</div>
										</CardContent>
									</Card>

									<Card>
										<CardContent className="p-6">
											<div className="flex items-center space-x-2">
												<TrendingUp className="h-4 w-4 text-green-500" />
												<div>
													<p className="text-sm font-medium text-muted-foreground">
														Avg Profit Margin
													</p>
													<p
														className="text-2xl font-bold"
														data-testid="text-avg-margin"
													>
														{analysis.avgProfitMargin.toFixed(1)}%
													</p>
												</div>
											</div>
										</CardContent>
									</Card>

									<Card>
										<CardContent className="p-6">
											<div className="flex items-center space-x-2">
												<IndianRupee className="h-4 w-4 text-green-500" />
												<div>
													<p className="text-sm font-medium text-muted-foreground">
														Total Revenue
													</p>
													<p
														className="text-2xl font-bold"
														data-testid="text-total-revenue"
													>
														₹{analysis.totalRevenue.toLocaleString()}
													</p>
												</div>
											</div>
										</CardContent>
									</Card>

									<Card>
										<CardContent className="p-6">
											<div className="flex items-center space-x-2">
												<TrendingUp className="h-4 w-4 text-green-500" />
												<div>
													<p className="text-sm font-medium text-muted-foreground">
														Best Margin
													</p>
													<p
														className="text-2xl font-bold"
														data-testid="text-best-margin"
													>
														{analysis.bestMargin.toFixed(1)}%
													</p>
												</div>
											</div>
										</CardContent>
									</Card>
								</div>

								{/* Optimal Supplier */}
								{optimal && (
									<Card>
										<CardHeader>
											<CardTitle className="flex items-center space-x-2">
												<Package className="h-5 w-5 text-green-500" />
												<span>Recommended Supplier</span>
											</CardTitle>
											<CardDescription>
												Best supplier based on profit optimization algorithm
											</CardDescription>
										</CardHeader>
										<CardContent>
											<div className="grid grid-cols-1 md:grid-cols-3 gap-4">
												<div>
													<p className="text-sm font-medium text-muted-foreground">
														Supplier
													</p>
													<p
														className="font-semibold"
														data-testid="text-optimal-supplier"
													>
														{optimal.supplierName}
													</p>
												</div>
												<div>
													<p className="text-sm font-medium text-muted-foreground">
														Profit Margin
													</p>
													<p
														className="font-semibold text-green-600"
														data-testid="text-optimal-margin"
													>
														{optimal.profitMargin.toFixed(1)}%
													</p>
												</div>
												<div>
													<p className="text-sm font-medium text-muted-foreground">
														Profit Score
													</p>
													<p
														className="font-semibold"
														data-testid="text-profit-score"
													>
														{optimal.profitScore.toFixed(1)}
													</p>
												</div>
											</div>
										</CardContent>
									</Card>
								)}

								{/* Recommendations */}
								{analysis.recommendations.length > 0 && (
									<Card>
										<CardHeader>
											<CardTitle className="flex items-center space-x-2">
												<AlertTriangle className="h-5 w-5 text-orange-500" />
												<span>Profit Optimization Recommendations</span>
											</CardTitle>
										</CardHeader>
										<CardContent>
											<ul className="space-y-2">
												{analysis.recommendations.map((rec, index) => (
													<li
														key={index}
														className="flex items-start space-x-2"
													>
														<span className="text-orange-500 mt-1">•</span>
														<span data-testid={`text-recommendation-${index}`}>
															{rec}
														</span>
													</li>
												))}
											</ul>
										</CardContent>
									</Card>
								)}
							</>
						) : null}
					</TabsContent>

					<TabsContent value="comparison" className="space-y-4">
						{isComparisonLoading ? (
							<Card>
								<CardContent className="p-6">
									<div className="text-center">
										Loading supplier comparison...
									</div>
								</CardContent>
							</Card>
						) : (
							<div className="grid grid-cols-1 gap-4">
								{comparison.map((supplier, index) => (
									<Card
										key={supplier.supplierId}
										className={
											index === 0
												? "border-green-500 bg-green-50 dark:bg-green-950"
												: ""
										}
									>
										<CardHeader>
											<div className="flex justify-between items-center">
												<CardTitle className="flex items-center space-x-2">
													<span
														data-testid={`text-supplier-name-${supplier.supplierId}`}
													>
														{supplier.supplierName}
													</span>
													{index === 0 && (
														<Badge
															variant="secondary"
															className="bg-green-500 text-white"
														>
															Best Choice
														</Badge>
													)}
												</CardTitle>
												<Badge
													variant={supplier.isActive ? "default" : "secondary"}
												>
													{supplier.isActive ? "Active" : "Inactive"}
												</Badge>
											</div>
										</CardHeader>
										<CardContent>
											<div className="grid grid-cols-2 md:grid-cols-4 gap-4">
												<div>
													<p className="text-sm font-medium text-muted-foreground">
														Cost Price
													</p>
													<p
														className="font-semibold"
														data-testid={`text-cost-price-${supplier.supplierId}`}
													>
														₹{supplier.costPrice.toLocaleString()}
													</p>
												</div>
												<div>
													<p className="text-sm font-medium text-muted-foreground">
														Selling Price
													</p>
													<p
														className="font-semibold"
														data-testid={`text-selling-price-${supplier.supplierId}`}
													>
														₹{supplier.sellingPrice.toLocaleString()}
													</p>
												</div>
												<div>
													<p className="text-sm font-medium text-muted-foreground">
														Profit Margin
													</p>
													<p
														className={`font-semibold ${supplier.profitMargin > 0 ? "text-green-600" : "text-red-600"}`}
														data-testid={`text-profit-margin-${supplier.supplierId}`}
													>
														{supplier.profitMargin.toFixed(1)}%
													</p>
												</div>
												<div>
													<p className="text-sm font-medium text-muted-foreground">
														Performance Rating
													</p>
													<div className="flex items-center space-x-2">
														<Progress
															value={supplier.performanceRating * 20}
															className="flex-1"
														/>
														<span
															className="text-sm font-medium"
															data-testid={`text-rating-${supplier.supplierId}`}
														>
															{supplier.performanceRating.toFixed(1)}
														</span>
													</div>
												</div>
											</div>

											<div className="grid grid-cols-2 md:grid-cols-3 gap-4 mt-4">
												<div>
													<p className="text-sm font-medium text-muted-foreground">
														Sales Volume
													</p>
													<p
														className="font-semibold"
														data-testid={`text-sales-volume-${supplier.supplierId}`}
													>
														{supplier.salesVolume.toLocaleString()}
													</p>
												</div>
												<div>
													<p className="text-sm font-medium text-muted-foreground">
														Revenue
													</p>
													<p
														className="font-semibold"
														data-testid={`text-revenue-${supplier.supplierId}`}
													>
														₹{supplier.revenue.toLocaleString()}
													</p>
												</div>
												<div>
													<p className="text-sm font-medium text-muted-foreground">
														Commission Rate
													</p>
													<p
														className="font-semibold"
														data-testid={`text-commission-${supplier.supplierId}`}
													>
														{supplier.commissionRate.toFixed(1)}%
													</p>
												</div>
											</div>

											{supplier.notes && (
												<div className="mt-4">
													<p className="text-sm font-medium text-muted-foreground">
														Notes
													</p>
													<p
														className="text-sm"
														data-testid={`text-notes-${supplier.supplierId}`}
													>
														{supplier.notes}
													</p>
												</div>
											)}
										</CardContent>
									</Card>
								))}
							</div>
						)}
					</TabsContent>

					<TabsContent value="dashboard" className="space-y-4">
						{isAnalysisLoading ? (
							<Card>
								<CardContent className="p-6">
									<div className="text-center">Loading profit dashboard...</div>
								</CardContent>
							</Card>
						) : analysis && optimal ? (
							<ProfitDashboard
								analysis={analysis}
								suppliers={comparison}
								optimalSupplier={optimal}
							/>
						) : (
							<Card>
								<CardContent className="p-6 text-center">
									<Package className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
									<p className="text-muted-foreground">
										No data available for dashboard analysis
									</p>
								</CardContent>
							</Card>
						)}
					</TabsContent>

					<TabsContent value="suppliers" className="space-y-4">
						<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
							{suppliers.map((supplier) => (
								<Card key={supplier.id}>
									<CardHeader>
										<div className="flex justify-between items-center">
											<CardTitle data-testid={`text-supplier-${supplier.id}`}>
												{supplier.name}
											</CardTitle>
											<Badge
												variant={supplier.isActive ? "default" : "secondary"}
											>
												{supplier.isActive ? "Active" : "Inactive"}
											</Badge>
										</div>
									</CardHeader>
									<CardContent>
										<div className="space-y-2">
											{supplier.contactEmail && (
												<p
													className="text-sm"
													data-testid={`text-email-${supplier.id}`}
												>
													<span className="font-medium">Email:</span>{" "}
													{supplier.contactEmail}
												</p>
											)}
											{supplier.contactPhone && (
												<p
													className="text-sm"
													data-testid={`text-phone-${supplier.id}`}
												>
													<span className="font-medium">Phone:</span>{" "}
													{supplier.contactPhone}
												</p>
											)}
											<div className="flex items-center justify-between">
												<span className="text-sm font-medium">
													Performance Rating
												</span>
												<div className="flex items-center space-x-2">
													<Progress
														value={
															Number.parseFloat(
																supplier.performanceRating || "0",
															) * 20
														}
														className="w-16"
													/>
													<span
														className="text-sm"
														data-testid={`text-supplier-rating-${supplier.id}`}
													>
														{Number.parseFloat(
															supplier.performanceRating || "0",
														).toFixed(1)}
													</span>
												</div>
											</div>
											<div className="flex items-center justify-between">
												<span className="text-sm font-medium">
													Commission Rate
												</span>
												<span
													className="text-sm font-semibold"
													data-testid={`text-supplier-commission-${supplier.id}`}
												>
													{Number.parseFloat(
														supplier.commissionRate || "0",
													).toFixed(1)}
													%
												</span>
											</div>
										</div>
										<div className="flex space-x-2 mt-4">
											<Button
												variant="outline"
												size="sm"
												data-testid={`button-edit-supplier-${supplier.id}`}
											>
												Edit
											</Button>
											<Button
												variant="outline"
												size="sm"
												data-testid={`button-view-products-${supplier.id}`}
											>
												View Products
											</Button>
										</div>
									</CardContent>
								</Card>
							))}
						</div>
					</TabsContent>
				</Tabs>
			)}

			{/* Empty State */}
			{!selectedProductId && (
				<Card>
					<CardContent className="p-12 text-center">
						<Package className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
						<h3 className="text-lg font-semibold mb-2">Select a Product</h3>
						<p className="text-muted-foreground">
							Choose a product from the dropdown above to view supplier analysis
							and profit optimization insights.
						</p>
					</CardContent>
				</Card>
			)}
		</div>
	);
}
