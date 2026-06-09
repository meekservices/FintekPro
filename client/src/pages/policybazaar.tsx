import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsTrigger } from "@/components/ui/tabs";
import { ScrollableTabsList } from "@/components/ScrollableTabsList";
import {
	Shield as LucideShield,
	Heart,
	Car,
	Plane,
	Home,
	Calculator,
	Users,
	Clock,
	CheckCircle,
	Star,
} from "lucide-react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Badge } from "@/components/ui/badge";
import { Slider } from "@/components/ui/slider";
import { Checkbox } from "@/components/ui/checkbox";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import {
	ArrowUpDown,
	Filter,
	Search,
	TrendingUp,
	Award,
	ShieldCheck,
} from "lucide-react";

// Enhanced Insurance Marketplace Component
interface EnhancedInsuranceMarketplaceProps {
	selectedInsurance: string;
	age: string;
	coverage: string;
	city: string;
}

function EnhancedInsuranceMarketplace({
	selectedInsurance,
	age,
	coverage,
	city,
}: EnhancedInsuranceMarketplaceProps) {
	const [viewMode, setViewMode] = useState<"grid" | "comparison">("grid");
	const [sortBy, setSortBy] = useState("premium");
	const [selectedProviders, setSelectedProviders] = useState<string[]>([]);
	const [searchTerm, setSearchTerm] = useState("");
	const [premiumRange, setPremiumRange] = useState([0, 50000]);
	const [selectedQuotes, setSelectedQuotes] = useState<any[]>([]);

	// Get insurance quotes with enhanced marketplace data
	const {
		data: quotes,
		isPending: quotesLoading,
		mutate: getQuotes,
	} = useMutation<any, Error, any, unknown>({
		mutationFn: async (data: any) => {
			return apiRequest("POST", "/api/policybazaar/quotes", data);
		},
	});

	// Compare insurance plans
	const { data: comparisonData, mutate: compareQuotes } = useMutation<
		any,
		Error,
		any,
		unknown
	>({
		mutationFn: async (data: any) => {
			return apiRequest("POST", "/api/insurance/compare", data);
		},
	});

	const handleGetQuotes = () => {
		const quoteData = {
			insuranceType: `${selectedInsurance} insurance`,
			age: age ? Number.parseInt(age) : 30,
			coverage: coverage ? Number.parseInt(coverage) : 500000,
			city: city || "Mumbai",
		};
		getQuotes(quoteData);
	};

	const handleCompareQuotes = () => {
		if (selectedQuotes.length < 2) {
			alert("Please select at least 2 plans to compare");
			return;
		}

		compareQuotes({
			insuranceType: `${selectedInsurance} insurance`,
			selectedProviders: selectedQuotes.map((q) => q.insurerId),
			criteria: {
				age: age ? Number.parseInt(age) : 30,
				coverage: coverage ? Number.parseInt(coverage) : 500000,
				sortBy: sortBy,
			},
		});
	};

	const handleQuoteSelection = (quote: any, isSelected: boolean) => {
		if (isSelected) {
			setSelectedQuotes((prev) => [...prev, quote]);
		} else {
			setSelectedQuotes((prev) =>
				prev.filter((q) => q.insurerId !== quote.insurerId),
			);
		}
	};

	const filteredQuotes =
		quotes?.data?.quotes?.filter((quote: any) => {
			const matchesSearch =
				quote.insurerName.toLowerCase().includes(searchTerm.toLowerCase()) ||
				quote.planName.toLowerCase().includes(searchTerm.toLowerCase());
			const matchesPremium =
				quote.premium >= premiumRange[0] && quote.premium <= premiumRange[1];
			const matchesProvider =
				selectedProviders.length === 0 ||
				selectedProviders.includes(quote.insurerId);

			return matchesSearch && matchesPremium && matchesProvider;
		}) || [];

	const sortedQuotes = filteredQuotes.sort((a: any, b: any) => {
		switch (sortBy) {
			case "premium":
				return a.premium - b.premium;
			case "rating":
				return b.rating - a.rating;
			case "claimRatio":
				return b.claimSettlementRatio - a.claimSettlementRatio;
			default:
				return 0;
		}
	});

	return (
		<div className="space-y-6">
			{/* Marketplace Header */}
			<Card>
				<CardHeader>
					<div className="flex justify-between items-start">
						<div>
							<CardTitle className="flex items-center gap-2">
								<ShieldCheck className="h-5 w-5 text-finance-blue" />
								Insurance Marketplace
							</CardTitle>
							<p className="text-sm text-muted-foreground mt-2">
								Compare plans from 15+ leading insurers and find the perfect
								coverage for you
							</p>
						</div>
						<div className="flex gap-2">
							<Button
								onClick={handleGetQuotes}
								className="bg-finance-blue hover:bg-blue-700"
							>
								<Search className="h-4 w-4 mr-2" />
								Get Quotes
							</Button>
							{selectedQuotes.length > 1 && (
								<Button variant="outline" onClick={handleCompareQuotes}>
									Compare ({selectedQuotes.length})
								</Button>
							)}
						</div>
					</div>
				</CardHeader>

				{/* Filters and Controls */}
				<CardContent>
					<div className="grid grid-cols-1 lg:grid-cols-4 gap-4 mb-6">
						{/* Search */}
						<div className="relative">
							<Search className="h-4 w-4 absolute left-3 top-3 text-muted-foreground" />
							<Input
								placeholder="Search insurers or plans..."
								value={searchTerm}
								onChange={(e) => setSearchTerm(e.target.value)}
								className="pl-10"
							/>
						</div>

						{/* Sort By */}
						<Select value={sortBy} onValueChange={setSortBy}>
							<SelectTrigger>
								<SelectValue placeholder="Sort by" />
							</SelectTrigger>
							<SelectContent>
								<SelectItem value="premium">Premium (Low to High)</SelectItem>
								<SelectItem value="rating">Rating (High to Low)</SelectItem>
								<SelectItem value="claimRatio">
									Claim Ratio (High to Low)
								</SelectItem>
							</SelectContent>
						</Select>

						{/* Premium Range */}
						<div className="space-y-2">
							<Label className="text-sm font-medium">Premium Range</Label>
							<Slider
								value={premiumRange}
								onValueChange={setPremiumRange}
								max={100000}
								step={1000}
								className="w-full"
							/>
							<div className="flex justify-between text-xs text-muted-foreground">
								<span>₹{premiumRange[0].toLocaleString()}</span>
								<span>₹{premiumRange[1].toLocaleString()}</span>
							</div>
						</div>

						{/* View Mode */}
						<div className="flex gap-2">
							<Button
								variant={viewMode === "grid" ? "default" : "outline"}
								size="sm"
								onClick={() => setViewMode("grid")}
							>
								Grid View
							</Button>
							<Button
								variant={viewMode === "comparison" ? "default" : "outline"}
								size="sm"
								onClick={() => setViewMode("comparison")}
							>
								Compare View
							</Button>
						</div>
					</div>
				</CardContent>
			</Card>

			{/* Marketplace Content */}
			{quotesLoading ? (
				<Card>
					<CardContent className="flex items-center justify-center py-12">
						<div className="text-center">
							<div className="animate-spin rounded-full h-8 w-8 border-b-2 border-finance-blue mx-auto mb-4" />
							<p>Loading insurance quotes from multiple providers...</p>
						</div>
					</CardContent>
				</Card>
			) : comparisonData?.success ? (
				<ComparisonMatrix data={comparisonData.data} />
			) : quotes?.success ? (
				viewMode === "grid" ? (
					<MarketplaceGrid
						quotes={sortedQuotes}
						selectedQuotes={selectedQuotes}
						onQuoteSelection={handleQuoteSelection}
					/>
				) : (
					<ComparisonTable
						quotes={sortedQuotes}
						onQuoteSelection={handleQuoteSelection}
					/>
				)
			) : (
				<Card>
					<CardContent className="text-center py-12">
						<LucideShield className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
						<h3 className="text-lg font-semibold text-foreground mb-2">
							Ready to Compare Insurance Plans?
						</h3>
						<p className="text-muted-foreground mb-4">
							Get quotes from 15+ top insurers and find the best coverage for
							your needs
						</p>
						<Button
							onClick={handleGetQuotes}
							className="bg-finance-blue hover:bg-blue-700"
						>
							Get Started
						</Button>
					</CardContent>
				</Card>
			)}
		</div>
	);
}

// Marketplace Grid Component
function MarketplaceGrid({ quotes, selectedQuotes, onQuoteSelection }: any) {
	return (
		<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
			{quotes.map((quote: any) => (
				<MarketplaceCard
					key={quote.insurerId}
					quote={quote}
					isSelected={selectedQuotes.some(
						(q: any) => q.insurerId === quote.insurerId,
					)}
					onSelection={(isSelected: boolean) =>
						onQuoteSelection(quote, isSelected)
					}
				/>
			))}
		</div>
	);
}

// Enhanced Marketplace Card Component
function MarketplaceCard({ quote, isSelected, onSelection }: any) {
	return (
		<Card
			className={`relative overflow-hidden transition-all duration-200 hover:shadow-lg border-2 ${
				isSelected
					? "border-finance-blue bg-blue-50 dark:bg-blue-950/30"
					: "border-border hover:border-border"
			}`}
		>
			{/* Provider Header */}
			<CardContent className="p-0">
				<div className="bg-gradient-to-r from-gray-50 to-white p-4 border-b">
					<div className="flex items-center justify-between">
						<div className="flex items-center gap-3">
							<div className="w-10 h-10 bg-finance-blue rounded-full flex items-center justify-center text-white font-bold">
								{quote.insurerName.substring(0, 2)}
							</div>
							<div>
								<h3 className="font-semibold text-foreground">
									{quote.insurerName}
								</h3>
								<p className="text-sm text-muted-foreground">
									{quote.planName}
								</p>
							</div>
						</div>
						<Checkbox
							checked={isSelected}
							onCheckedChange={onSelection}
							className="data-[state=checked]:bg-finance-blue data-[state=checked]:border-finance-blue"
						/>
					</div>
				</div>

				{/* Plan Details */}
				<div className="p-4 space-y-4">
					{/* Premium and Rating */}
					<div className="flex items-center justify-between">
						<div>
							<p className="text-2xl font-bold text-finance-blue">
								₹{quote.premium?.toLocaleString()}
							</p>
							<p className="text-sm text-muted-foreground">Annual Premium</p>
						</div>
						<div className="text-right">
							<div className="flex items-center gap-1 mb-1">
								<Star className="h-4 w-4 text-yellow-500 fill-current" />
								<span className="font-medium">{quote.rating}</span>
							</div>
							<p className="text-xs text-muted-foreground">Customer Rating</p>
						</div>
					</div>

					{/* Coverage Amount */}
					<div className="bg-green-50 dark:bg-green-950/30 p-3 rounded-lg">
						<div className="flex items-center justify-between">
							<span className="text-sm text-muted-foreground">Sum Insured</span>
							<span className="font-semibold text-green-700 dark:text-green-300">
								₹{quote.sumInsured?.toLocaleString()}
							</span>
						</div>
					</div>

					{/* Key Metrics */}
					<div className="grid grid-cols-2 gap-4 text-center">
						<div>
							<p className="text-lg font-bold text-green-600">
								{quote.claimSettlementRatio}%
							</p>
							<p className="text-xs text-muted-foreground">Claim Settlement</p>
						</div>
						<div>
							<p className="text-lg font-bold text-blue-600">
								{quote.policyTerm}yr
							</p>
							<p className="text-xs text-muted-foreground">Policy Term</p>
						</div>
					</div>

					{/* Key Features */}
					<div>
						<h4 className="text-sm font-medium text-muted-foreground mb-2">
							Key Features
						</h4>
						<div className="space-y-1">
							{quote.features
								?.slice(0, 3)
								.map((feature: string, idx: number) => (
									<div key={idx} className="flex items-center gap-2 text-xs">
										<CheckCircle className="h-3 w-3 text-green-500 flex-shrink-0" />
										<span className="text-muted-foreground">{feature}</span>
									</div>
								))}
						</div>
					</div>

					{/* Special Offers */}
					{quote.specialOffers?.length > 0 && (
						<div className="bg-orange-50 dark:bg-orange-950/30 p-2 rounded border border-orange-200 dark:border-orange-800">
							<div className="flex items-center gap-1 mb-1">
								<Award className="h-3 w-3 text-orange-600" />
								<span className="text-xs font-medium text-orange-800 dark:text-orange-200">
									Special Offer
								</span>
							</div>
							<p className="text-xs text-orange-700 dark:text-orange-300">
								{quote.specialOffers[0]}
							</p>
						</div>
					)}

					{/* Action Buttons */}
					<div className="flex gap-2 pt-2">
						<Button variant="outline" size="sm" className="flex-1">
							View Details
						</Button>
						<Button
							size="sm"
							className="flex-1 bg-finance-blue hover:bg-blue-700"
						>
							Buy Now
						</Button>
					</div>
				</div>
			</CardContent>
		</Card>
	);
}

// Comparison Table Component
function ComparisonTable({ quotes, onQuoteSelection }: any) {
	return (
		<Card>
			<CardHeader>
				<CardTitle>Side-by-Side Comparison</CardTitle>
			</CardHeader>
			<CardContent>
				<div className="overflow-x-auto">
					<table className="w-full border-collapse">
						<thead>
							<tr className="border-b">
								<th className="text-left p-4 font-medium">Insurer</th>
								<th className="text-left p-4 font-medium">Premium</th>
								<th className="text-left p-4 font-medium">Coverage</th>
								<th className="text-left p-4 font-medium">Rating</th>
								<th className="text-left p-4 font-medium">Claim Ratio</th>
								<th className="text-left p-4 font-medium">Select</th>
							</tr>
						</thead>
						<tbody>
							{quotes.map((quote: any, index: number) => (
								<tr
									key={quote.insurerId}
									className={index % 2 === 0 ? "bg-muted" : "bg-card"}
								>
									<td className="p-4">
										<div className="flex items-center gap-2">
											<div className="w-8 h-8 bg-finance-blue rounded-full flex items-center justify-center text-white text-sm font-bold">
												{quote.insurerName.substring(0, 2)}
											</div>
											<div>
												<p className="font-medium">{quote.insurerName}</p>
												<p className="text-sm text-muted-foreground">
													{quote.planName}
												</p>
											</div>
										</div>
									</td>
									<td className="p-4">
										<span className="font-bold text-finance-blue">
											₹{quote.premium?.toLocaleString()}
										</span>
									</td>
									<td className="p-4">
										<span className="font-medium">
											₹{quote.sumInsured?.toLocaleString()}
										</span>
									</td>
									<td className="p-4">
										<div className="flex items-center gap-1">
											<Star className="h-4 w-4 text-yellow-500 fill-current" />
											<span>{quote.rating}</span>
										</div>
									</td>
									<td className="p-4">
										<Badge
											variant="secondary"
											className="bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-200"
										>
											{quote.claimSettlementRatio}%
										</Badge>
									</td>
									<td className="p-4">
										<Checkbox
											onCheckedChange={(checked) =>
												onQuoteSelection(quote, checked)
											}
										/>
									</td>
								</tr>
							))}
						</tbody>
					</table>
				</div>
			</CardContent>
		</Card>
	);
}

// Comparison Matrix Component
function ComparisonMatrix({ data }: any) {
	const { comparisons, bestValue, topRated, bestClaims, comparisonMatrix } =
		data;

	return (
		<div className="space-y-6">
			{/* Quick Insights */}
			<div className="grid grid-cols-1 md:grid-cols-3 gap-4">
				<Card className="border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-950/30">
					<CardContent className="p-4">
						<div className="flex items-center gap-2 mb-2">
							<TrendingUp className="h-4 w-4 text-green-600" />
							<span className="text-sm font-medium text-green-800 dark:text-green-200">
								Best Value
							</span>
						</div>
						<p className="font-bold text-green-900 dark:text-green-100">
							{bestValue?.insurerName}
						</p>
						<p className="text-sm text-green-700 dark:text-green-300">
							₹{bestValue?.premium?.toLocaleString()}
						</p>
					</CardContent>
				</Card>

				<Card className="border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-950/30">
					<CardContent className="p-4">
						<div className="flex items-center gap-2 mb-2">
							<Star className="h-4 w-4 text-blue-600" />
							<span className="text-sm font-medium text-blue-800 dark:text-blue-200">
								Top Rated
							</span>
						</div>
						<p className="font-bold text-blue-900 dark:text-blue-100">
							{topRated?.insurerName}
						</p>
						<p className="text-sm text-blue-700 dark:text-blue-300">
							{topRated?.rating} ⭐
						</p>
					</CardContent>
				</Card>

				<Card className="border-purple-200 dark:border-purple-800 bg-purple-50 dark:bg-purple-950/30">
					<CardContent className="p-4">
						<div className="flex items-center gap-2 mb-2">
							<Award className="h-4 w-4 text-purple-600" />
							<span className="text-sm font-medium text-purple-800 dark:text-purple-200">
								Best Claims
							</span>
						</div>
						<p className="font-bold text-purple-900 dark:text-purple-100">
							{bestClaims?.insurerName}
						</p>
						<p className="text-sm text-purple-700 dark:text-purple-300">
							{bestClaims?.claimSettlementRatio}%
						</p>
					</CardContent>
				</Card>
			</div>

			{/* Detailed Comparison */}
			<Card>
				<CardHeader>
					<CardTitle>Detailed Comparison Matrix</CardTitle>
				</CardHeader>
				<CardContent>
					<div className="space-y-6">
						{comparisonMatrix?.map((criterion: any, index: number) => (
							<div key={index}>
								<h4 className="font-medium text-foreground mb-3">
									{criterion.criterion}
								</h4>
								<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
									{criterion.values.map((value: any, idx: number) => (
										<div
											key={idx}
											className="flex items-center justify-between p-3 bg-muted rounded"
										>
											<span className="text-sm font-medium">
												{
													comparisons.find(
														(c: any) => c.insurerId === value.providerId,
													)?.insurerName
												}
											</span>
											<Badge variant="outline">
												{typeof value.value === "number" &&
												criterion.criterion === "Premium"
													? `₹${value.value.toLocaleString()}`
													: value.value}
											</Badge>
										</div>
									))}
								</div>
							</div>
						))}
					</div>
				</CardContent>
			</Card>
		</div>
	);
}

export default function PolicyBazaar() {
	// Navigation state for responsive layout
	const [isNavCollapsed, setIsNavCollapsed] = useState(() => {
		try {
			const saved = localStorage.getItem("navigation-collapsed");
			return saved ? JSON.parse(saved) : false;
		} catch {
			return false;
		}
	});

	// Listen for navigation state changes
	useEffect(() => {
		const handleNavChange = (event: CustomEvent) => {
			setIsNavCollapsed(event.detail.isCollapsed);
		};

		window.addEventListener(
			"navigation-state-changed",
			handleNavChange as EventListener,
		);
		return () =>
			window.removeEventListener(
				"navigation-state-changed",
				handleNavChange as EventListener,
			);
	}, []);
	const [selectedInsurance, setSelectedInsurance] = useState("health");
	const [age, setAge] = useState("");
	const [income, setIncome] = useState("");
	const [city, setCity] = useState("");
	const [coverage, setCoverage] = useState("");

	// Health Insurance form state
	const [familyMembers, setFamilyMembers] = useState("");
	const [preExistingDiseases, setPreExistingDiseases] = useState<string[]>([]);

	// Life Insurance form state
	const [dependents, setDependents] = useState("");
	const [existingCoverage, setExistingCoverage] = useState("");
	const [smokingStatus, setSmokingStatus] = useState("");

	// Motor Insurance form state
	const [vehicleType, setVehicleType] = useState("");
	const [vehicleAge, setVehicleAge] = useState("");
	const [idv, setIdv] = useState("");
	const [previousClaims, setPreviousClaims] = useState("");
	const [ncb, setNcb] = useState("");

	// Travel Insurance form state
	const [destination, setDestination] = useState("");
	const [duration, setDuration] = useState("");
	const [tripType, setTripType] = useState("");

	// Get insurance quotes
	const {
		data: quotes,
		isPending: quotesLoading,
		mutate: getQuotes,
	} = useMutation<any, Error, any, unknown>({
		mutationFn: async (data: any) => {
			return apiRequest("POST", "/api/policybazaar/quotes", data);
		},
	});

	// Health insurance calculator
	const { data: healthCalculation, mutate: calculateHealth } = useMutation<
		any,
		Error,
		any,
		unknown
	>({
		mutationFn: async (data: any) => {
			return apiRequest("POST", "/api/policybazaar/health-calculator", data);
		},
	});

	// Life insurance calculator
	const { data: lifeCalculation, mutate: calculateLife } = useMutation<
		any,
		Error,
		any,
		unknown
	>({
		mutationFn: async (data: any) => {
			return apiRequest("POST", "/api/policybazaar/life-calculator", data);
		},
	});

	// Motor insurance calculator
	const { data: motorCalculation, mutate: calculateMotor } = useMutation<
		any,
		Error,
		any,
		unknown
	>({
		mutationFn: async (data: any) => {
			return apiRequest("POST", "/api/policybazaar/motor-calculator", data);
		},
	});

	// Travel insurance calculator
	const { data: travelCalculation, mutate: calculateTravel } = useMutation<
		any,
		Error,
		any,
		unknown
	>({
		mutationFn: async (data: any) => {
			return apiRequest("POST", "/api/policybazaar/travel-calculator", data);
		},
	});

	const handleGetQuotes = () => {
		const baseData = {
			insuranceType: selectedInsurance,
			age: Number.parseInt(age),
			income: Number.parseInt(income),
			city,
			coverage: Number.parseInt(coverage),
		};

		if (selectedInsurance === "health insurance") {
			getQuotes({
				...baseData,
				familyMembers: Number.parseInt(familyMembers) || 1,
				preExistingDiseases,
			});
		} else {
			getQuotes(baseData);
		}
	};

	const handleCalculate = () => {
		const baseData = { age: Number.parseInt(age), city };

		switch (selectedInsurance) {
			case "health insurance":
				calculateHealth({
					...baseData,
					familyMembers: Number.parseInt(familyMembers) || 1,
					preExistingDiseases,
					coverage: Number.parseInt(coverage) || 500000,
				});
				break;
			case "life insurance":
				calculateLife({
					...baseData,
					income: Number.parseInt(income),
					dependents: Number.parseInt(dependents) || 0,
					existingCoverage: Number.parseInt(existingCoverage) || 0,
					smokingStatus,
				});
				break;
			case "motor insurance":
				calculateMotor({
					vehicleType,
					vehicleAge: Number.parseInt(vehicleAge),
					city,
					idv: Number.parseInt(idv),
					previousClaims: Number.parseInt(previousClaims) || 0,
					ncb,
				});
				break;
			case "travel insurance":
				calculateTravel({
					destination,
					duration: Number.parseInt(duration),
					age: Number.parseInt(age),
					tripType,
					coverage: Number.parseInt(coverage) || 100000,
				});
				break;
		}
	};

	const insuranceTypes = [
		{
			value: "health insurance",
			label: "Health Insurance",
			icon: Heart,
			color: "text-red-600",
		},
		{
			value: "life insurance",
			label: "Life Insurance",
			icon: LucideShield,
			color: "text-blue-600",
		},
		{
			value: "motor insurance",
			label: "Motor Insurance",
			icon: Car,
			color: "text-green-600",
		},
		{
			value: "travel insurance",
			label: "Travel Insurance",
			icon: Plane,
			color: "text-purple-600",
		},
	];

	const currentCalculation = {
		"health insurance": healthCalculation,
		"life insurance": lifeCalculation,
		"motor insurance": motorCalculation,
		"travel insurance": travelCalculation,
	}[selectedInsurance];

	return (
		<div
			className="min-h-screen bg-finance-light"
			data-testid="policybazaar-page"
		>
			<main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
				{/* Insurance Type Selection */}
				<div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
					{insuranceTypes.map((type) => {
						const IconComponent = type.icon;
						return (
							<Card
								key={type.value}
								className={`cursor-pointer transition-all hover:shadow-md ${
									selectedInsurance === type.value
										? "ring-2 ring-finance-blue bg-blue-50 dark:bg-blue-950/30"
										: ""
								}`}
								onClick={() => setSelectedInsurance(type.value)}
								data-testid={`insurance-type-${type.value}`}
							>
								<CardContent className="p-6 text-center">
									<IconComponent
										className={`h-8 w-8 mx-auto mb-3 ${type.color}`}
									/>
									<h3 className="font-semibold text-foreground">
										{type.label}
									</h3>
								</CardContent>
							</Card>
						);
					})}
				</div>

				<Tabs defaultValue="calculator" className="space-y-8">
					<ScrollableTabsList className="grid w-full grid-cols-3">
						<TabsTrigger value="calculator" data-testid="tab-calculator">
							Premium Calculator
						</TabsTrigger>
						<TabsTrigger value="compare" data-testid="tab-compare">
							Compare Quotes
						</TabsTrigger>
						<TabsTrigger value="policies" data-testid="tab-policies">
							My Policies
						</TabsTrigger>
					</ScrollableTabsList>

					<TabsContent
						value="calculator"
						className="space-y-6"
						data-testid="calculator-tab"
					>
						<div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
							<Card>
								<CardHeader>
									<CardTitle className="flex items-center gap-2">
										<Calculator className="h-5 w-5 text-finance-blue" />
										{
											insuranceTypes.find((t) => t.value === selectedInsurance)
												?.label
										}{" "}
										Calculator
									</CardTitle>
								</CardHeader>
								<CardContent className="space-y-4">
									{/* Common fields */}
									<div>
										<label className="text-sm font-medium text-muted-foreground mb-2 block">
											Age
										</label>
										<Input
											type="number"
											placeholder="Enter your age"
											value={age}
											onChange={(e) => setAge(e.target.value)}
											data-testid="age-input"
										/>
									</div>

									<div>
										<label className="text-sm font-medium text-muted-foreground mb-2 block">
											City
										</label>
										<Select value={city} onValueChange={setCity}>
											<SelectTrigger data-testid="city-select">
												<SelectValue placeholder="Select your city" />
											</SelectTrigger>
											<SelectContent>
												<SelectItem value="mumbai">Mumbai</SelectItem>
												<SelectItem value="delhi">Delhi</SelectItem>
												<SelectItem value="bangalore">Bangalore</SelectItem>
												<SelectItem value="chennai">Chennai</SelectItem>
												<SelectItem value="hyderabad">Hyderabad</SelectItem>
												<SelectItem value="pune">Pune</SelectItem>
												<SelectItem value="kolkata">Kolkata</SelectItem>
												<SelectItem value="other">Other</SelectItem>
											</SelectContent>
										</Select>
									</div>

									{/* Health Insurance specific fields */}
									{selectedInsurance === "health insurance" && (
										<>
											<div>
												<label className="text-sm font-medium text-muted-foreground mb-2 block">
													Family Members
												</label>
												<Input
													type="number"
													placeholder="Number of family members"
													value={familyMembers}
													onChange={(e) => setFamilyMembers(e.target.value)}
													data-testid="family-members-input"
												/>
											</div>
											<div>
												<label className="text-sm font-medium text-muted-foreground mb-2 block">
													Coverage Amount (₹)
												</label>
												<Select value={coverage} onValueChange={setCoverage}>
													<SelectTrigger data-testid="coverage-select">
														<SelectValue placeholder="Select coverage amount" />
													</SelectTrigger>
													<SelectContent>
														<SelectItem value="300000">₹3 Lakhs</SelectItem>
														<SelectItem value="500000">₹5 Lakhs</SelectItem>
														<SelectItem value="1000000">₹10 Lakhs</SelectItem>
														<SelectItem value="2000000">₹20 Lakhs</SelectItem>
														<SelectItem value="5000000">₹50 Lakhs</SelectItem>
													</SelectContent>
												</Select>
											</div>
										</>
									)}

									{/* Life Insurance specific fields */}
									{selectedInsurance === "life insurance" && (
										<>
											<div>
												<label className="text-sm font-medium text-muted-foreground mb-2 block">
													Monthly Income (₹)
												</label>
												<Input
													type="number"
													placeholder="Enter monthly income"
													value={income}
													onChange={(e) => setIncome(e.target.value)}
													data-testid="income-input"
												/>
											</div>
											<div>
												<label className="text-sm font-medium text-muted-foreground mb-2 block">
													Number of Dependents
												</label>
												<Input
													type="number"
													placeholder="Number of dependents"
													value={dependents}
													onChange={(e) => setDependents(e.target.value)}
													data-testid="dependents-input"
												/>
											</div>
											<div>
												<label className="text-sm font-medium text-muted-foreground mb-2 block">
													Smoking Status
												</label>
												<Select
													value={smokingStatus}
													onValueChange={setSmokingStatus}
												>
													<SelectTrigger data-testid="smoking-select">
														<SelectValue placeholder="Select smoking status" />
													</SelectTrigger>
													<SelectContent>
														<SelectItem value="non-smoker">
															Non-Smoker
														</SelectItem>
														<SelectItem value="smoker">Smoker</SelectItem>
													</SelectContent>
												</Select>
											</div>
										</>
									)}

									{/* Motor Insurance specific fields */}
									{selectedInsurance === "motor insurance" && (
										<>
											<div>
												<label className="text-sm font-medium text-muted-foreground mb-2 block">
													Vehicle Type
												</label>
												<Select
													value={vehicleType}
													onValueChange={setVehicleType}
												>
													<SelectTrigger data-testid="vehicle-type-select">
														<SelectValue placeholder="Select vehicle type" />
													</SelectTrigger>
													<SelectContent>
														<SelectItem value="car">Car</SelectItem>
														<SelectItem value="bike">Two Wheeler</SelectItem>
														<SelectItem value="commercial">
															Commercial Vehicle
														</SelectItem>
													</SelectContent>
												</Select>
											</div>
											<div>
												<label className="text-sm font-medium text-muted-foreground mb-2 block">
													Vehicle Age (Years)
												</label>
												<Input
													type="number"
													placeholder="Vehicle age in years"
													value={vehicleAge}
													onChange={(e) => setVehicleAge(e.target.value)}
													data-testid="vehicle-age-input"
												/>
											</div>
											<div>
												<label className="text-sm font-medium text-muted-foreground mb-2 block">
													IDV - Insured Declared Value (₹)
												</label>
												<Input
													type="number"
													placeholder="Enter vehicle IDV"
													value={idv}
													onChange={(e) => setIdv(e.target.value)}
													data-testid="idv-input"
												/>
											</div>
											<div>
												<label className="text-sm font-medium text-muted-foreground mb-2 block">
													No Claim Bonus (Years)
												</label>
												<Select value={ncb} onValueChange={setNcb}>
													<SelectTrigger data-testid="ncb-select">
														<SelectValue placeholder="Select NCB years" />
													</SelectTrigger>
													<SelectContent>
														<SelectItem value="0">0 Years</SelectItem>
														<SelectItem value="1">1 Year</SelectItem>
														<SelectItem value="2">2 Years</SelectItem>
														<SelectItem value="3">3 Years</SelectItem>
														<SelectItem value="4">4 Years</SelectItem>
														<SelectItem value="5+">5+ Years</SelectItem>
													</SelectContent>
												</Select>
											</div>
										</>
									)}

									{/* Travel Insurance specific fields */}
									{selectedInsurance === "travel insurance" && (
										<>
											<div>
												<label className="text-sm font-medium text-muted-foreground mb-2 block">
													Destination
												</label>
												<Select
													value={destination}
													onValueChange={setDestination}
												>
													<SelectTrigger data-testid="destination-select">
														<SelectValue placeholder="Select destination" />
													</SelectTrigger>
													<SelectContent>
														<SelectItem value="domestic">Domestic</SelectItem>
														<SelectItem value="asia">Asia</SelectItem>
														<SelectItem value="europe">Europe</SelectItem>
														<SelectItem value="usa">USA/Canada</SelectItem>
														<SelectItem value="schengen">
															Schengen Countries
														</SelectItem>
														<SelectItem value="worldwide">Worldwide</SelectItem>
													</SelectContent>
												</Select>
											</div>
											<div>
												<label className="text-sm font-medium text-muted-foreground mb-2 block">
													Trip Duration (Days)
												</label>
												<Input
													type="number"
													placeholder="Number of days"
													value={duration}
													onChange={(e) => setDuration(e.target.value)}
													data-testid="duration-input"
												/>
											</div>
											<div>
												<label className="text-sm font-medium text-muted-foreground mb-2 block">
													Trip Type
												</label>
												<Select value={tripType} onValueChange={setTripType}>
													<SelectTrigger data-testid="trip-type-select">
														<SelectValue placeholder="Select trip type" />
													</SelectTrigger>
													<SelectContent>
														<SelectItem value="leisure">Leisure</SelectItem>
														<SelectItem value="business">Business</SelectItem>
														<SelectItem value="adventure">Adventure</SelectItem>
													</SelectContent>
												</Select>
											</div>
											<div>
												<label className="text-sm font-medium text-muted-foreground mb-2 block">
													Coverage Amount (₹)
												</label>
												<Select value={coverage} onValueChange={setCoverage}>
													<SelectTrigger data-testid="travel-coverage-select">
														<SelectValue placeholder="Select coverage amount" />
													</SelectTrigger>
													<SelectContent>
														<SelectItem value="100000">₹1 Lakh</SelectItem>
														<SelectItem value="200000">₹2 Lakhs</SelectItem>
														<SelectItem value="500000">₹5 Lakhs</SelectItem>
														<SelectItem value="1000000">₹10 Lakhs</SelectItem>
													</SelectContent>
												</Select>
											</div>
										</>
									)}

									<Button
										onClick={handleCalculate}
										className="w-full bg-finance-blue hover:bg-blue-700"
										data-testid="calculate-premium"
									>
										Calculate Premium
									</Button>
								</CardContent>
							</Card>

							{/* Results Card */}
							<Card>
								<CardHeader>
									<CardTitle>Premium Calculation Results</CardTitle>
								</CardHeader>
								<CardContent>
									{currentCalculation?.success ? (
										<div className="space-y-6">
											<div className="text-center p-6 bg-blue-50 dark:bg-blue-950/30 rounded-lg">
												<h3 className="text-sm font-medium text-muted-foreground mb-2">
													Estimated Premium
												</h3>
												<p
													className="text-3xl font-bold text-finance-blue"
													data-testid="estimated-premium"
												>
													₹
													{currentCalculation.data.estimatedPremium?.toLocaleString() ||
														currentCalculation.data.monthlyPremium?.toLocaleString() ||
														"N/A"}
												</p>
												{currentCalculation.data.monthlyPremium && (
													<p className="text-sm text-muted-foreground mt-1">
														per month
													</p>
												)}
											</div>

											{/* Plan Options */}
											{currentCalculation.data.planOptions && (
												<div className="space-y-4">
													<h4 className="font-semibold text-foreground">
														Available Plans
													</h4>
													{currentCalculation.data.planOptions.map(
														(plan: any, index: number) => (
															<div
																key={index}
																className="p-4 border rounded-lg"
															>
																<div className="flex justify-between items-start mb-2">
																	<h5 className="font-medium text-foreground">
																		{plan.plan}
																	</h5>
																	<span className="font-bold text-finance-blue">
																		₹
																		{plan.premium?.toLocaleString() ||
																			plan.monthlyPremium?.toLocaleString()}
																	</span>
																</div>
																<p className="text-sm text-muted-foreground mb-2">
																	Coverage: ₹{plan.coverage?.toLocaleString()}
																</p>
																<ul className="text-xs text-muted-foreground space-y-1">
																	{plan.features?.map(
																		(feature: string, idx: number) => (
																			<li key={idx}>• {feature}</li>
																		),
																	)}
																</ul>
															</div>
														),
													)}
												</div>
											)}

											{/* Plan Recommendations */}
											{currentCalculation.data.planRecommendations && (
												<div className="space-y-4">
													<h4 className="font-semibold text-foreground">
														Plan Recommendations
													</h4>
													{currentCalculation.data.planRecommendations.map(
														(plan: any, index: number) => (
															<div
																key={index}
																className="p-4 border rounded-lg"
															>
																<div className="flex justify-between items-start mb-2">
																	<h5 className="font-medium text-foreground">
																		{plan.plan}
																	</h5>
																	<span className="font-bold text-finance-blue">
																		₹{plan.premium?.toLocaleString()}
																	</span>
																</div>
																<p className="text-sm text-muted-foreground mb-2">
																	Coverage: ₹{plan.coverage?.toLocaleString()}
																</p>
																<ul className="text-xs text-muted-foreground space-y-1">
																	{plan.features?.map(
																		(feature: string, idx: number) => (
																			<li key={idx}>• {feature}</li>
																		),
																	)}
																</ul>
															</div>
														),
													)}
												</div>
											)}
										</div>
									) : (
										<div className="text-center py-12">
											<Calculator className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
											<p className="text-muted-foreground">
												Fill in the details and click "Calculate Premium" to see
												results
											</p>
										</div>
									)}
								</CardContent>
							</Card>
						</div>
					</TabsContent>

					<TabsContent
						value="compare"
						className="space-y-6"
						data-testid="compare-tab"
					>
						<EnhancedInsuranceMarketplace
							selectedInsurance={selectedInsurance}
							age={age}
							coverage={coverage}
							city={city}
						/>
					</TabsContent>

					<TabsContent
						value="policies"
						className="space-y-6"
						data-testid="policies-tab"
					>
						<Card className="border-dashed border-2 border-border">
							<CardContent className="flex flex-col items-center justify-center py-12">
								<LucideShield className="h-12 w-12 text-muted-foreground mb-4" />
								<h3 className="text-lg font-semibold text-foreground mb-2">
									No Policies Found
								</h3>
								<p className="text-muted-foreground text-center mb-4">
									Your purchased insurance policies will appear here
								</p>
								<Button variant="outline">Buy Your First Policy</Button>
							</CardContent>
						</Card>
					</TabsContent>
				</Tabs>
			</main>
		</div>
	);
}
