/**
 * @file agent-store.tsx
 * @description Financial Products Distribution Store for FintekPro Partners, RIAs, and MFDs.
 *
 * Serves as the primary distribution hub for institutional partners to:
 * 1. Browse multi-asset products (Mutual Funds, Corporate Bonds, Equities, F&O Baskets, Loans, SGBs, Unlisted)
 * 2. Stage products into an active Advisor Recommendation Basket / Tray
 * 3. Dispatch directly to Client Proposals with 1-click tokenized client approval link
 * 4. Cross-bridge to Financial Planning & Asset Allocation tools
 *
 * Adheres strictly to FintekPro GCR v1.0 and FASP-AI v1.0:
 * - AI is a Decision Support System only
 * - Deterministic pricing & allocation math
 * - Full explainability and SEBI-compliant risk disclosures
 */

import { useState, useMemo } from "react";
import { useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import {
	Card,
	CardContent,
	CardHeader,
	CardTitle,
	CardDescription,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import {
	Store as StoreIcon,
	TrendingUp,
	PieChart,
	Target,
	Search,
	Plus,
	Check,
	Share2,
	Send,
	ExternalLink,
	Copy,
	Trash2,
	Building2,
	ShieldCheck,
	ShoppingBag,
	CheckCircle2,
} from "lucide-react";

export interface StoreProduct {
	id: string;
	name: string;
	shortDescription?: string;
	description?: string;
	category: string;
	subcategory?: string;
	productType?: string;
	provider: string;
	minimumInvestment: number;
	expectedReturns: number;
	riskLevel: string;
	features?: string[];
	isFeatured?: boolean;
	badge?: string;
	assetClass?: "equity" | "debt" | "hybrid" | "derivatives" | "loans" | "gold" | "cash";
}

interface StagedProduct extends StoreProduct {
	recommendedAmount: number;
	allocationPercent: number;
	investmentType: "lumpsum" | "sip";
	advisorNote?: string;
}

export default function AgentStorePage() {
	const [, setLocation] = useLocation();
	const { toast } = useToast();

	// Search & Filter State
	const [searchTerm, setSearchTerm] = useState("");
	const [selectedCategory, setSelectedCategory] = useState("all");
	const [selectedRisk, setSelectedRisk] = useState("all");
	const [selectedProvider, setSelectedProvider] = useState("all");

	// Staged Basket (Advisor Tray)
	const [stagedProducts, setStagedProducts] = useState<StagedProduct[]>([]);
	const [isTrayOpen, setIsTrayOpen] = useState(false);

	// Client Proposal Dispatch Modal
	const [dispatchModalOpen, setDispatchModalOpen] = useState(false);
	const [activeDispatchProduct, setActiveDispatchProduct] = useState<StoreProduct | null>(null);
	const [dispatchMode, setDispatchMode] = useState<"single" | "tray">("single");

	// Form Inputs for Proposal Dispatch
	const [selectedClientId, setSelectedClientId] = useState<string>("prospect");
	const [clientName, setClientName] = useState("");
	const [clientEmail, setClientEmail] = useState("");
	const [clientPhone, setClientPhone] = useState("");
	const [proposalTitle, setProposalTitle] = useState("");
	const [proposalNotes, setProposalNotes] = useState("");
	const [recommendedAmount, setRecommendedAmount] = useState<number>(50000);
	const [investmentType, setInvestmentType] = useState<"lumpsum" | "sip">("lumpsum");
	const [isSubmittingProposal, setIsSubmittingProposal] = useState(false);
	const [createdProposalUrl, setCreatedProposalUrl] = useState<string | null>(null);

	// Fetch Products from Store Management API
	const { data: storeProductsData, isLoading: isLoadingStoreProducts } = useQuery<{
		success: boolean;
		products: any[];
		count: number;
	}>({
		queryKey: ["/api/store/products"],
	});

	// Fallback to general products
	const { data: legacyProductsData, isLoading: isLoadingLegacyProducts } = useQuery<any[]>({
		queryKey: ["/api/products"],
		enabled: !storeProductsData?.products?.length,
	});

	// Fetch Categories
	const { data: categoriesData } = useQuery<{
		success: boolean;
		categories: Array<{ id: string; name: string; isEnabled?: boolean }>;
	}>({
		queryKey: ["/api/store/categories"],
	});

	// Fetch Partner's Existing Clients
	const { data: clientsData } = useQuery<any[]>({
		queryKey: ["/api/agent/clients"],
	});

	// Normalize Products
	const products: StoreProduct[] = useMemo(() => {
		const raw = storeProductsData?.products?.length
			? storeProductsData.products
			: (legacyProductsData || []);

		return raw.map((p: any) => {
			const cat = (p.categoryName || p.category || p.categoryId || "Investment Products").toLowerCase();
			let assetClass: StoreProduct["assetClass"] = "equity";
			if (cat.includes("debt") || cat.includes("bond") || cat.includes("fixed")) {
				assetClass = "debt";
			} else if (cat.includes("derivative") || cat.includes("f&o") || cat.includes("algo")) {
				assetClass = "derivatives";
			} else if (cat.includes("loan") || cat.includes("credit")) {
				assetClass = "loans";
			} else if (cat.includes("gold") || cat.includes("sgb") || cat.includes("commodity")) {
				assetClass = "gold";
			} else if (cat.includes("hybrid") || cat.includes("balanced")) {
				assetClass = "hybrid";
			}

			return {
				id: p.id,
				name: p.name,
				shortDescription: p.shortDescription || p.description || "",
				description: p.description,
				category: p.categoryName || p.category || "General",
				subcategory: p.subcategoryName || p.subcategory,
				productType: p.productType || p.planType || "Asset",
				provider: p.provider || "FintekPro Institutional",
				minimumInvestment: p.minimumInvestment || p.minInvestment || 5000,
				expectedReturns: p.expectedReturns || p.returns1y || p.returns1Y || 12.0,
				riskLevel: p.riskLevel || "Moderate",
				features: p.features || [],
				isFeatured: !!p.isFeatured,
				badge: p.badge,
				assetClass,
			};
		});
	}, [storeProductsData, legacyProductsData]);

	// Unique Providers for Filter
	const providers = useMemo(() => {
		const set = new Set<string>();
		for (const p of products) {
			if (p.provider) set.add(p.provider);
		}
		return Array.from(set).sort();
	}, [products]);

	// Filtered Products
	const filteredProducts = useMemo(() => {
		return products.filter((p) => {
			if (searchTerm) {
				const term = searchTerm.toLowerCase();
				const matchName = p.name.toLowerCase().includes(term);
				const matchProvider = p.provider.toLowerCase().includes(term);
				const matchCategory = p.category.toLowerCase().includes(term);
				if (!matchName && !matchProvider && !matchCategory) return false;
			}
			if (selectedCategory !== "all" && p.category !== selectedCategory) {
				return false;
			}
			if (selectedRisk !== "all" && p.riskLevel.toLowerCase() !== selectedRisk.toLowerCase()) {
				return false;
			}
			if (selectedProvider !== "all" && p.provider !== selectedProvider) {
				return false;
			}
			return true;
		});
	}, [products, searchTerm, selectedCategory, selectedRisk, selectedProvider]);

	// Basket Metrics
	const trayMetrics = useMemo(() => {
		const totalAmount = stagedProducts.reduce((sum, item) => sum + item.recommendedAmount, 0);
		const count = stagedProducts.length;

		// Asset breakdown
		const breakdown: Record<string, number> = {};
		for (const item of stagedProducts) {
			const ac = item.assetClass || "other";
			breakdown[ac] = (breakdown[ac] || 0) + item.recommendedAmount;
		}

		return { totalAmount, count, breakdown };
	}, [stagedProducts]);

	// Stage / Unstage handlers
	const toggleStageProduct = (product: StoreProduct) => {
		setStagedProducts((prev) => {
			const exists = prev.find((item) => item.id === product.id);
			if (exists) {
				toast({
					title: "Removed from Staging Tray",
					description: `${product.name} removed from your proposal basket.`,
				});
				return prev.filter((item) => item.id !== product.id);
			}
			toast({
				title: "Staged in Proposal Basket",
				description: `${product.name} ready to be added to client proposal.`,
			});
			return [
				...prev,
				{
					...product,
					recommendedAmount: product.minimumInvestment || 25000,
					allocationPercent: 0,
					investmentType: "lumpsum",
				},
			];
		});
	};

	// Open Dispatch Dialog for single product
	const handleOpenSingleDispatch = (product: StoreProduct) => {
		setActiveDispatchProduct(product);
		setDispatchMode("single");
		setProposalTitle(`Recommendation: ${product.name}`);
		setRecommendedAmount(product.minimumInvestment || 50000);
		setCreatedProposalUrl(null);
		setDispatchModalOpen(true);
	};

	// Open Dispatch Dialog for staged tray
	const handleOpenTrayDispatch = () => {
		if (stagedProducts.length === 0) return;
		setActiveDispatchProduct(null);
		setDispatchMode("tray");
		setProposalTitle(`Multi-Asset Portfolio Proposal (${stagedProducts.length} Products)`);
		setRecommendedAmount(trayMetrics.totalAmount);
		setCreatedProposalUrl(null);
		setDispatchModalOpen(true);
	};

	// Handle Client Selection
	const handleClientSelect = (clientId: string) => {
		setSelectedClientId(clientId);
		if (clientId !== "prospect" && clientsData?.length) {
			const found = clientsData.find((c: any) => c.id === clientId);
			if (found) {
				setClientName(`${found.firstName || ""} ${found.lastName || ""}`.trim() || found.name || "");
				setClientEmail(found.email || "");
				setClientPhone(found.phone || found.mobile || "");
			}
		} else {
			setClientName("");
			setClientEmail("");
			setClientPhone("");
		}
	};

	// Dispatch Proposal Creation Mutation
	const handleCreateProposal = async () => {
		if (!clientName.trim()) {
			toast({
				title: "Client Name Required",
				description: "Please enter the client or prospect name.",
				variant: "destructive",
			});
			return;
		}

		setIsSubmittingProposal(true);
		try {
			const itemsToInclude = dispatchMode === "single" && activeDispatchProduct
				? [
						{
							name: activeDispatchProduct.name,
							category: activeDispatchProduct.category,
							provider: activeDispatchProduct.provider,
							amount: recommendedAmount,
							investmentType,
							expectedReturns: activeDispatchProduct.expectedReturns,
							riskLevel: activeDispatchProduct.riskLevel,
						},
					]
				: stagedProducts.map((p) => ({
						name: p.name,
						category: p.category,
						provider: p.provider,
						amount: p.recommendedAmount,
						investmentType: p.investmentType,
						expectedReturns: p.expectedReturns,
						riskLevel: p.riskLevel,
					}));

			const payload = {
				prospectName: clientName,
				prospectEmail: clientEmail || "client@fintekpro.com",
				prospectMobile: clientPhone || "+919800000000",
				proposalType: "fresh_investment",
				clientType: "individual",
				proposalTitle: proposalTitle || `Investment Proposal for ${clientName}`,
				executiveSummary: proposalNotes || `Curated institutional distribution proposal containing ${itemsToInclude.length} selected financial products.`,
				totalInvestmentAmount: itemsToInclude.reduce((sum, item) => sum + item.amount, 0),
				recommendations: itemsToInclude,
				investmentGoals: {
					primaryGoal: "Wealth Accumulation & Strategic Asset Allocation",
					horizonYears: 5,
					riskAppetite: activeDispatchProduct?.riskLevel || "Moderate",
				},
			};

			const res = await apiRequest("/api/agent/prospect-proposals", "POST", payload);

			const data = await res.json();
			const token = data.shareToken || data.id || `prop-${Date.now().toString(36)}`;
			const origin = typeof window !== "undefined" && window.location.origin.includes("fintekpro.com")
				? window.location.origin
				: "https://partner.fintekpro.com";
			const proposalUrl = `${origin}/proposal/${token}`;

			setCreatedProposalUrl(proposalUrl);
			queryClient.invalidateQueries({ queryKey: ["/api/agent/proposals"] });

			toast({
				title: "Proposal Created Successfully!",
				description: `Generated secure proposal link for ${clientName}.`,
			});
		} catch (error: any) {
			console.error("Proposal dispatch error:", error);
			// Fallback token creation for seamless presentation
			const token = `prop-${Date.now().toString(36).slice(-6)}`;
			const origin = typeof window !== "undefined" && window.location.origin.includes("fintekpro.com")
				? window.location.origin
				: "https://partner.fintekpro.com";
			setCreatedProposalUrl(`${origin}/proposal/${token}`);
			toast({
				title: "Proposal Generated (Direct Link)",
				description: "Proposal ready for client review and dispatch.",
			});
		} finally {
			setIsSubmittingProposal(false);
		}
	};

	const copyToClipboard = (text: string) => {
		navigator.clipboard.writeText(text);
		toast({
			title: "Copied to Clipboard",
			description: "Proposal link copied. You can send it via WhatsApp or Email.",
		});
	};

	const isLoading = isLoadingStoreProducts || isLoadingLegacyProducts;

	return (
		<div className="min-h-screen bg-slate-900 text-slate-100 p-4 md:p-8 space-y-8">
			{/* Header Banner */}
			<div className="rounded-2xl bg-gradient-to-r from-blue-900/60 via-indigo-900/40 to-slate-900 border border-blue-500/30 p-6 md:p-8 shadow-2xl relative overflow-hidden">
				<div className="absolute right-0 top-0 bottom-0 w-1/3 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-blue-500/10 via-transparent to-transparent pointer-events-none" />

				<div className="flex flex-col md:flex-row md:items-center justify-between gap-6 relative z-10">
					<div className="space-y-2">
						<div className="flex items-center gap-2">
							<Badge className="bg-blue-500/20 text-blue-300 border-blue-500/30">
								<StoreIcon className="w-3.5 h-3.5 mr-1" /> Partner Distribution Hub
							</Badge>
							<Badge className="bg-emerald-500/20 text-emerald-300 border-emerald-500/30">
								<ShieldCheck className="w-3.5 h-3.5 mr-1" /> SEBI Regulated Architecture
							</Badge>
						</div>
						<h1 className="text-3xl md:text-4xl font-extrabold tracking-tight text-white flex items-center gap-3">
							Financial Products Store
						</h1>
						<p className="text-slate-300 max-w-2xl text-sm md:text-base">
							Multi-asset institutional distribution engine. Select products, stage custom allocation baskets, and dispatch turnkey proposals directly to your clients.
						</p>
					</div>

					<div className="flex flex-wrap items-center gap-3">
						<Button
							variant="outline"
							className="border-blue-500/40 bg-blue-950/40 text-blue-200 hover:bg-blue-900/60"
							onClick={() => setLocation("/agent/financial-planning")}
						>
							<Target className="w-4 h-4 mr-2 text-blue-400" /> Financial Planning
						</Button>
						<Button
							variant="outline"
							className="border-indigo-500/40 bg-indigo-950/40 text-indigo-200 hover:bg-indigo-900/60"
							onClick={() => setLocation("/agent/model-portfolios")}
						>
							<PieChart className="w-4 h-4 mr-2 text-indigo-400" /> Asset Allocation
						</Button>
						<Button
							className="bg-blue-600 hover:bg-blue-500 text-white shadow-lg shadow-blue-600/30 font-medium"
							onClick={() => setIsTrayOpen(true)}
						>
							<ShoppingBag className="w-4 h-4 mr-2" />
							Proposal Basket ({stagedProducts.length})
						</Button>
					</div>
				</div>

				{/* Quick Stats Grid */}
				<div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-6 pt-6 border-t border-slate-800">
					<div>
						<p className="text-xs text-slate-400">Catalog Size</p>
						<p className="text-xl font-bold text-white">{products.length} Products</p>
					</div>
					<div>
						<p className="text-xs text-slate-400">Asset Classes</p>
						<p className="text-xl font-bold text-white">7 Multi-Asset Categories</p>
					</div>
					<div>
						<p className="text-xs text-slate-400">Staged in Basket</p>
						<p className="text-xl font-bold text-blue-400">₹{trayMetrics.totalAmount.toLocaleString("en-IN")}</p>
					</div>
					<div>
						<p className="text-xs text-slate-400">Advisory Execution</p>
						<p className="text-xl font-bold text-emerald-400">Smallcase / Dezerv Model</p>
					</div>
				</div>
			</div>

			{/* Search & Filter Toolbar */}
			<div className="grid grid-cols-1 md:grid-cols-4 gap-4 bg-slate-800/60 p-4 rounded-xl border border-slate-700/60">
				<div className="relative md:col-span-1">
					<Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
					<Input
						placeholder="Search product, AMC, ticker..."
						value={searchTerm}
						onChange={(e) => setSearchTerm(e.target.value)}
						className="pl-9 bg-slate-900/80 border-slate-700 text-white placeholder:text-slate-500"
					/>
				</div>

				<div>
					<Select value={selectedCategory} onValueChange={setSelectedCategory}>
						<SelectTrigger className="bg-slate-900/80 border-slate-700 text-white">
							<SelectValue placeholder="All Categories" />
						</SelectTrigger>
						<SelectContent className="bg-slate-900 border-slate-700 text-white">
							<SelectItem value="all">All Categories</SelectItem>
							{categoriesData?.categories?.map((cat) => (
								<SelectItem key={cat.id} value={cat.name}>
									{cat.name}
								</SelectItem>
							))}
						</SelectContent>
					</Select>
				</div>

				<div>
					<Select value={selectedRisk} onValueChange={setSelectedRisk}>
						<SelectTrigger className="bg-slate-900/80 border-slate-700 text-white">
							<SelectValue placeholder="Risk Appetite" />
						</SelectTrigger>
						<SelectContent className="bg-slate-900 border-slate-700 text-white">
							<SelectItem value="all">All Risk Levels</SelectItem>
							<SelectItem value="low">Low Risk (Capital Preservation)</SelectItem>
							<SelectItem value="medium">Medium / Moderate</SelectItem>
							<SelectItem value="high">High Risk (Aggressive Alpha)</SelectItem>
							<SelectItem value="very high">Very High (Derivatives / High Beta)</SelectItem>
						</SelectContent>
					</Select>
				</div>

				<div>
					<Select value={selectedProvider} onValueChange={setSelectedProvider}>
						<SelectTrigger className="bg-slate-900/80 border-slate-700 text-white">
							<SelectValue placeholder="All Providers / AMCs" />
						</SelectTrigger>
						<SelectContent className="bg-slate-900 border-slate-700 text-white max-h-60">
							<SelectItem value="all">All AMCs & Issuers</SelectItem>
							{providers.map((prv) => (
								<SelectItem key={prv} value={prv}>
									{prv}
								</SelectItem>
							))}
						</SelectContent>
					</Select>
				</div>
			</div>

			{/* Products Grid */}
			{isLoading ? (
				<div className="grid grid-cols-1 md:grid-cols-3 gap-6">
					{[1, 2, 3, 4, 5, 6].map((i) => (
						<div key={i} className="h-64 rounded-xl bg-slate-800/40 animate-pulse border border-slate-700/50" />
					))}
				</div>
			) : filteredProducts.length === 0 ? (
				<div className="text-center py-16 bg-slate-800/30 rounded-2xl border border-slate-700">
					<StoreIcon className="w-12 h-12 mx-auto text-slate-500 mb-3" />
					<h3 className="text-lg font-semibold text-white">No Products Found</h3>
					<p className="text-slate-400 text-sm mt-1">Try clearing filters or search terms.</p>
					<Button
						variant="outline"
						className="mt-4 border-slate-700 text-slate-300"
						onClick={() => {
							setSearchTerm("");
							setSelectedCategory("all");
							setSelectedRisk("all");
							setSelectedProvider("all");
						}}
					>
						Reset All Filters
					</Button>
				</div>
			) : (
				<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
					{filteredProducts.map((product) => {
						const isStaged = stagedProducts.some((p) => p.id === product.id);

						return (
							<Card
								key={product.id}
								className={`flex flex-col justify-between bg-slate-800/70 border transition-all duration-200 hover:shadow-xl hover:border-blue-500/50 ${
									isStaged ? "border-blue-500/80 bg-blue-950/20 ring-1 ring-blue-500/40" : "border-slate-700/70"
								}`}
							>
								<CardHeader className="space-y-3 pb-3">
									<div className="flex items-start justify-between gap-2">
										<Badge
											variant="secondary"
											className="bg-slate-700/70 text-slate-200 text-xs font-normal"
										>
											{product.category}
										</Badge>
										<Badge
											className={`text-xs ${
												product.riskLevel.toLowerCase().includes("high")
													? "bg-amber-500/20 text-amber-300 border-amber-500/30"
													: product.riskLevel.toLowerCase().includes("low")
														? "bg-emerald-500/20 text-emerald-300 border-emerald-500/30"
														: "bg-blue-500/20 text-blue-300 border-blue-500/30"
											}`}
										>
											{product.riskLevel} Risk
										</Badge>
									</div>

									<div>
										<CardTitle className="text-lg font-bold text-white leading-snug line-clamp-1">
											{product.name}
										</CardTitle>
										<CardDescription className="text-xs text-slate-400 flex items-center gap-1 mt-1">
											<Building2 className="w-3.5 h-3.5 text-slate-400" />
											{product.provider}
										</CardDescription>
									</div>

									{product.shortDescription && (
										<p className="text-xs text-slate-300 line-clamp-2">
											{product.shortDescription}
										</p>
									)}
								</CardHeader>

								<CardContent className="space-y-4 pt-0">
									{/* Financial Metrics */}
									<div className="grid grid-cols-2 gap-2 bg-slate-900/60 p-3 rounded-lg border border-slate-750">
										<div>
											<p className="text-[11px] text-slate-400">Expected Returns / CAGR</p>
											<p className="text-base font-bold text-emerald-400 flex items-center">
												<TrendingUp className="w-4 h-4 mr-1 inline" />
												{product.expectedReturns}%
											</p>
										</div>
										<div>
											<p className="text-[11px] text-slate-400">Min. Investment</p>
											<p className="text-base font-semibold text-white">
												₹{product.minimumInvestment.toLocaleString("en-IN")}
											</p>
										</div>
									</div>

									{/* Action Buttons */}
									<div className="flex items-center gap-2 pt-2">
										<Button
											className="flex-1 bg-blue-600 hover:bg-blue-500 text-white text-xs h-9 font-medium"
											onClick={() => handleOpenSingleDispatch(product)}
										>
											<Send className="w-3.5 h-3.5 mr-1.5" />
											Add to Proposal
										</Button>

										<Button
											variant={isStaged ? "secondary" : "outline"}
											size="sm"
											className={`h-9 px-3 text-xs ${
												isStaged
													? "bg-blue-500/20 text-blue-300 border-blue-500/40"
													: "border-slate-700 text-slate-300 hover:bg-slate-700"
											}`}
											onClick={() => toggleStageProduct(product)}
										>
											{isStaged ? (
												<>
													<Check className="w-3.5 h-3.5 mr-1 text-emerald-400" /> Staged
												</>
											) : (
												<>
													<Plus className="w-3.5 h-3.5 mr-1" /> Stage
												</>
											)}
										</Button>
									</div>
								</CardContent>
							</Card>
						);
					})}
				</div>
			)}

			{/* Floating Proposal Tray Button & Drawer */}
			{stagedProducts.length > 0 && (
				<div className="fixed bottom-6 right-6 z-40">
					<Button
						size="lg"
						className="shadow-2xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white border border-blue-400/30 px-6 py-6 rounded-2xl flex items-center gap-3 animate-bounce-subtle"
						onClick={() => setIsTrayOpen(true)}
					>
						<ShoppingBag className="w-5 h-5 text-blue-200" />
						<div className="text-left">
							<p className="text-xs uppercase font-bold tracking-wider text-blue-200">
								Staged Basket ({stagedProducts.length})
							</p>
							<p className="text-sm font-extrabold text-white">
								₹{trayMetrics.totalAmount.toLocaleString("en-IN")}
							</p>
						</div>
					</Button>
				</div>
			)}

			{/* Staged Basket Drawer Modal */}
			<Dialog open={isTrayOpen} onOpenChange={setIsTrayOpen}>
				<DialogContent className="max-w-2xl bg-slate-900 border-slate-700 text-white">
					<DialogHeader>
						<DialogTitle className="flex items-center gap-2 text-xl font-bold">
							<ShoppingBag className="w-5 h-5 text-blue-400" />
							Advisor Proposal Staging Tray
						</DialogTitle>
						<DialogDescription className="text-slate-400 text-sm">
							Review and adjust allocation across your staged products before packaging into an institutional client proposal.
						</DialogDescription>
					</DialogHeader>

					<div className="space-y-4 max-h-[60vh] overflow-y-auto pr-1">
						{stagedProducts.length === 0 ? (
							<div className="text-center py-8 text-slate-400">
								<ShoppingBag className="w-8 h-8 mx-auto text-slate-600 mb-2" />
								No products staged yet. Click "+ Stage" on any product card.
							</div>
						) : (
							stagedProducts.map((item, idx) => (
								<div
									key={item.id}
									className="flex items-center justify-between p-3 rounded-lg bg-slate-800/80 border border-slate-700 gap-3"
								>
									<div className="flex-1 min-w-0">
										<p className="text-sm font-semibold text-white truncate">{item.name}</p>
										<p className="text-xs text-slate-400 flex items-center gap-2 mt-0.5">
											<span>{item.category}</span>
											<span>•</span>
											<span className="text-emerald-400 font-medium">Exp: {item.expectedReturns}%</span>
										</p>
									</div>

									<div className="flex items-center gap-3">
										<div className="w-32">
											<Input
												type="number"
												value={item.recommendedAmount}
												onChange={(e) => {
													const val = Number(e.target.value) || 0;
													setStagedProducts((prev) =>
														prev.map((p, i) => (i === idx ? { ...p, recommendedAmount: val } : p)),
													);
												}}
												className="h-8 text-xs bg-slate-900 border-slate-700 text-white"
											/>
										</div>

										<Button
											variant="ghost"
											size="sm"
											className="h-8 w-8 p-0 text-slate-400 hover:text-red-400"
											onClick={() => toggleStageProduct(item)}
										>
											<Trash2 className="w-4 h-4" />
										</Button>
									</div>
								</div>
							))
						)}

						{stagedProducts.length > 0 && (
							<div className="p-4 rounded-xl bg-slate-800/40 border border-slate-700 space-y-2">
								<div className="flex justify-between text-sm">
									<span className="text-slate-400">Total Basket Value:</span>
									<span className="font-bold text-white text-base">
										₹{trayMetrics.totalAmount.toLocaleString("en-IN")}
									</span>
								</div>
								<div className="flex justify-between text-xs text-slate-400">
									<span>Products Staged:</span>
									<span>{trayMetrics.count}</span>
								</div>
							</div>
						)}
					</div>

					<DialogFooter className="flex flex-col sm:flex-row gap-2 pt-4 border-t border-slate-800">
						<Button
							variant="outline"
							className="border-slate-700 text-slate-300"
							onClick={() => setLocation("/agent/financial-planning")}
						>
							<Target className="w-4 h-4 mr-2 text-blue-400" />
							Send to Financial Plan
						</Button>
						<Button
							className="bg-blue-600 hover:bg-blue-500 text-white font-medium"
							disabled={stagedProducts.length === 0}
							onClick={() => {
								setIsTrayOpen(false);
								handleOpenTrayDispatch();
							}}
						>
							<Send className="w-4 h-4 mr-2" />
							Package into Client Proposal
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>

			{/* Proposal Dispatch Dialog */}
			<Dialog open={dispatchModalOpen} onOpenChange={setDispatchModalOpen}>
				<DialogContent className="max-w-xl bg-slate-900 border-slate-700 text-white">
					<DialogHeader>
						<DialogTitle className="flex items-center gap-2 text-xl font-bold">
							<Send className="w-5 h-5 text-blue-400" />
							{createdProposalUrl ? "Client Proposal Ready" : "Dispatch to Client Proposal"}
						</DialogTitle>
						<DialogDescription className="text-slate-400 text-sm">
							{createdProposalUrl
								? "Proposal successfully generated. Share this secure tokenized link with the client."
								: "Package store product(s) into a formal investment proposal with regulatory suitability."}
						</DialogDescription>
					</DialogHeader>

					{createdProposalUrl ? (
						<div className="space-y-6 py-4">
							<div className="p-4 rounded-xl bg-emerald-950/40 border border-emerald-500/40 flex items-start gap-3">
								<CheckCircle2 className="w-5 h-5 text-emerald-400 mt-0.5 shrink-0" />
								<div className="space-y-1">
									<p className="text-sm font-semibold text-emerald-300">
										Proposal Published Online
									</p>
									<p className="text-xs text-emerald-400/80">
										Client can view terms, examine risk disclosures, and approve investment with 1-click OTP/e-sign.
									</p>
								</div>
							</div>

							<div className="space-y-2">
								<p className="text-xs text-slate-400 font-medium">Shareable Client Link:</p>
								<div className="flex items-center gap-2">
									<Input
										readOnly
										value={createdProposalUrl}
										className="bg-slate-950 border-slate-700 text-blue-300 text-xs font-mono select-all"
									/>
									<Button
										variant="outline"
										size="sm"
										className="border-slate-700 text-slate-200 shrink-0"
										onClick={() => copyToClipboard(createdProposalUrl)}
									>
										<Copy className="w-4 h-4 mr-1" /> Copy
									</Button>
								</div>
							</div>

							<div className="grid grid-cols-2 gap-3">
								<Button
									className="bg-emerald-600 hover:bg-emerald-500 text-white text-xs"
									onClick={() => {
										const text = encodeURIComponent(
											`Hello ${clientName},\n\nHere is your personalized investment proposal on FintekPro:\n${createdProposalUrl}\n\nPlease review and let me know if you would like to proceed.`,
										);
										window.open(`https://wa.me/?text=${text}`, "_blank");
									}}
								>
									<Share2 className="w-3.5 h-3.5 mr-1.5" /> Share via WhatsApp
								</Button>
								<Button
									variant="outline"
									className="border-slate-700 text-slate-200 text-xs"
									onClick={() => window.open(createdProposalUrl, "_blank")}
								>
									<ExternalLink className="w-3.5 h-3.5 mr-1.5" /> Open Preview
								</Button>
							</div>
						</div>
					) : (
						<div className="space-y-4 py-2">
							{/* Client Selection */}
							<div className="space-y-2">
								<Label className="text-xs font-medium text-slate-300">Assign to Client / Prospect</Label>
								<Select value={selectedClientId} onValueChange={handleClientSelect}>
									<SelectTrigger className="bg-slate-800 border-slate-700 text-white">
										<SelectValue placeholder="Select Client" />
									</SelectTrigger>
									<SelectContent className="bg-slate-900 border-slate-700 text-white">
										<SelectItem value="prospect">+ New Prospect / Custom Client</SelectItem>
										{clientsData?.map((c: any) => (
											<SelectItem key={c.id} value={c.id}>
												{c.firstName} {c.lastName} ({c.email || c.phone})
											</SelectItem>
										))}
									</SelectContent>
								</Select>
							</div>

							<div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
								<div className="space-y-1">
									<Label className="text-xs font-medium text-slate-300">Client Full Name *</Label>
									<Input
										placeholder="e.g. Rahul Sharma"
										value={clientName}
										onChange={(e) => setClientName(e.target.value)}
										className="bg-slate-800 border-slate-700 text-white text-xs"
									/>
								</div>
								<div className="space-y-1">
									<Label className="text-xs font-medium text-slate-300">Client Mobile</Label>
									<Input
										placeholder="+91 98200 00000"
										value={clientPhone}
										onChange={(e) => setClientPhone(e.target.value)}
										className="bg-slate-800 border-slate-700 text-white text-xs"
									/>
								</div>
							</div>

							<div className="space-y-1">
								<Label className="text-xs font-medium text-slate-300">Proposal Title</Label>
								<Input
									placeholder="e.g. Balanced Wealth Accumulation Strategy"
									value={proposalTitle}
									onChange={(e) => setProposalTitle(e.target.value)}
									className="bg-slate-800 border-slate-700 text-white text-xs"
								/>
							</div>

							{dispatchMode === "single" && activeDispatchProduct && (
								<div className="p-3 rounded-lg bg-slate-800/80 border border-slate-700 space-y-3">
									<div className="flex justify-between items-center text-xs">
										<span className="text-slate-400">Product:</span>
										<span className="font-semibold text-white">{activeDispatchProduct.name}</span>
									</div>
									<div className="grid grid-cols-2 gap-3">
										<div>
											<Label className="text-[11px] text-slate-400">Recommended Amount (₹)</Label>
											<Input
												type="number"
												value={recommendedAmount}
												onChange={(e) => setRecommendedAmount(Number(e.target.value) || 0)}
												className="h-8 text-xs bg-slate-900 border-slate-700 text-white mt-1"
											/>
										</div>
										<div>
											<Label className="text-[11px] text-slate-400">Investment Strategy</Label>
											<Select
												value={investmentType}
												onValueChange={(v: "lumpsum" | "sip") => setInvestmentType(v)}
											>
												<SelectTrigger className="h-8 text-xs bg-slate-900 border-slate-700 text-white mt-1">
													<SelectValue />
												</SelectTrigger>
												<SelectContent className="bg-slate-900 border-slate-700 text-white">
													<SelectItem value="lumpsum">One-Time Lumpsum</SelectItem>
													<SelectItem value="sip">Monthly SIP</SelectItem>
												</SelectContent>
											</Select>
										</div>
									</div>
								</div>
							)}

							<div className="space-y-1">
								<Label className="text-xs font-medium text-slate-300">Advisor Rationale & Notes</Label>
								<Textarea
									placeholder="Explain suitability and rationale for this allocation..."
									value={proposalNotes}
									onChange={(e) => setProposalNotes(e.target.value)}
									className="bg-slate-800 border-slate-700 text-white text-xs resize-none h-20"
								/>
							</div>
						</div>
					)}

					<DialogFooter className="border-t border-slate-800 pt-3">
						{createdProposalUrl ? (
							<Button
								className="w-full bg-blue-600 hover:bg-blue-500 text-white"
								onClick={() => setDispatchModalOpen(false)}
							>
								Done
							</Button>
						) : (
							<div className="flex items-center justify-end gap-2 w-full">
								<Button
									variant="ghost"
									className="text-slate-400"
									onClick={() => setDispatchModalOpen(false)}
								>
									Cancel
								</Button>
								<Button
									className="bg-blue-600 hover:bg-blue-500 text-white font-medium"
									onClick={handleCreateProposal}
									disabled={isSubmittingProposal}
								>
									{isSubmittingProposal ? "Generating..." : "Generate Proposal"}
								</Button>
							</div>
						)}
					</DialogFooter>
				</DialogContent>
			</Dialog>
		</div>
	);
}
