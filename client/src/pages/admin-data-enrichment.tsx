import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import {
	Database,
	RefreshCw,
	TrendingUp,
	Building2,
	BarChart3,
	CheckCircle2,
	AlertCircle,
	Clock,
	Percent,
} from "lucide-react";

interface MFStats {
	totalFunds: number;
	withTer: number;
	withAum: number;
	withBothNull: number;
	percentEnriched: number;
}

interface StockStats {
	totalStocks: number;
	withPe: number;
	withEps: number;
	withBookValue: number;
	allNull: number;
	percentEnriched: number;
}

interface EnrichmentProgress {
	status: string;
	currentStep: string;
	totalFunds?: number;
	totalStocks?: number;
	processedFunds?: number;
	processedStocks?: number;
	terUpdated?: number;
	aumUpdated?: number;
	enriched?: number;
	errors: string[];
}

interface ExtractionStats {
	totalFunds: number;
	withExtendedData: number;
	exitLoadExtracted: number;
	minLumpsumExtracted: number;
	minSipExtracted: number;
	launchDateExtracted: number;
	percentExtracted: number;
}

interface ExtractionProgress {
	status: string;
	processedFunds: number;
	totalFunds: number;
	exitLoadUpdated: number;
	minAmountsUpdated: number;
	launchDateUpdated: number;
	currentStep: string;
	errors: string[];
}

export default function AdminDataEnrichment() {
	const { toast } = useToast();
	const queryClient = useQueryClient();
	const [activeTab, setActiveTab] = useState("overview");

	const { data: mfStats, isLoading: mfLoading } = useQuery<{
		success: boolean;
		stats: MFStats;
	}>({
		queryKey: ["/api/admin/enrichment/mf/stats"],
		refetchInterval: 30000,
	});

	const { data: stockStats, isLoading: stockLoading } = useQuery<{
		success: boolean;
		stats: StockStats;
	}>({
		queryKey: ["/api/admin/enrichment/stocks/stats"],
		refetchInterval: 30000,
	});

	const { data: mfProgress } = useQuery<{
		success: boolean;
		progress: EnrichmentProgress;
	}>({
		queryKey: ["/api/admin/enrichment/mf/progress"],
		refetchInterval: 2000,
	});

	const { data: stockProgress } = useQuery<{
		success: boolean;
		progress: EnrichmentProgress;
	}>({
		queryKey: ["/api/admin/enrichment/stocks/progress"],
		refetchInterval: 2000,
	});

	const { data: extractionStats, isLoading: extractionLoading } = useQuery<{
		success: boolean;
		stats: ExtractionStats;
	}>({
		queryKey: ["/api/admin/enrichment/extraction/stats"],
		refetchInterval: 30000,
	});

	const { data: extractionProgress } = useQuery<{
		success: boolean;
		progress: ExtractionProgress;
	}>({
		queryKey: ["/api/admin/enrichment/extraction/progress"],
		refetchInterval: 2000,
	});

	const runExtraction = useMutation({
		mutationFn: async (forceRefresh: boolean) => {
			return apiRequest("/api/admin/enrichment/extraction/run", {
				method: "POST",
				body: JSON.stringify({ forceRefresh }),
			});
		},
		onSuccess: () => {
			toast({
				title: "Extraction Started",
				description: "Extracting data from extendedData JSONB...",
			});
			queryClient.invalidateQueries({
				queryKey: ["/api/admin/enrichment/extraction/progress"],
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

	const runMfEnrichment = useMutation({
		mutationFn: async (forceRefresh: boolean) => {
			return apiRequest("/api/admin/enrichment/mf/run", {
				method: "POST",
				body: JSON.stringify({ forceRefresh }),
			});
		},
		onSuccess: () => {
			toast({
				title: "MF Enrichment Started",
				description: "Processing funds in the background...",
			});
			queryClient.invalidateQueries({
				queryKey: ["/api/admin/enrichment/mf/progress"],
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

	const runStockEnrichment = useMutation({
		mutationFn: async (useYahoo: boolean) => {
			return apiRequest("/api/admin/enrichment/stocks/run", {
				method: "POST",
				body: JSON.stringify({ useYahoo }),
			});
		},
		onSuccess: () => {
			toast({
				title: "Stock Enrichment Started",
				description: "Processing stocks in the background...",
			});
			queryClient.invalidateQueries({
				queryKey: ["/api/admin/enrichment/stocks/progress"],
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

	const mf = mfStats?.stats;
	const stock = stockStats?.stats;
	const extraction = extractionStats?.stats;
	const mfProg = mfProgress?.progress;
	const stockProg = stockProgress?.progress;
	const extProg = extractionProgress?.progress;

	const isMfRunning =
		mfProg?.status === "fetching" || mfProg?.status === "enriching";
	const isStockRunning =
		stockProg?.status === "fetching" || stockProg?.status === "enriching";
	const isExtractionRunning = extProg?.status === "running";

	return (
		<div className="container mx-auto py-6 space-y-6">
			<div className="flex items-center justify-between">
				<div>
					<h1 className="text-3xl font-bold flex items-center gap-2">
						<Database className="h-8 w-8" />
						Data Enrichment Dashboard
					</h1>
					<p className="text-muted-foreground mt-1">
						Fill NULL database columns with real, dynamic data from AMFI and
						market sources
					</p>
				</div>
			</div>

			<Tabs value={activeTab} onValueChange={setActiveTab}>
				<TabsList>
					<TabsTrigger value="overview">Overview</TabsTrigger>
					<TabsTrigger value="mutual-funds">Mutual Funds</TabsTrigger>
					<TabsTrigger value="stocks">Stocks</TabsTrigger>
					<TabsTrigger value="extraction">Data Extraction</TabsTrigger>
				</TabsList>

				<TabsContent value="overview" className="space-y-4">
					<div className="grid gap-4 md:grid-cols-2">
						<Card>
							<CardHeader className="flex flex-row items-center justify-between pb-2">
								<CardTitle className="text-sm font-medium">
									Mutual Funds
								</CardTitle>
								<TrendingUp className="h-4 w-4 text-muted-foreground" />
							</CardHeader>
							<CardContent>
								{mfLoading ? (
									<div className="animate-pulse h-20 bg-muted rounded" />
								) : mf ? (
									<div className="space-y-3">
										<div className="flex items-center justify-between">
											<span className="text-2xl font-bold">
												{mf.totalFunds.toLocaleString()}
											</span>
											<Badge
												variant={
													mf.percentEnriched > 50 ? "default" : "secondary"
												}
											>
												{mf.percentEnriched}% enriched
											</Badge>
										</div>
										<div className="grid grid-cols-2 gap-2 text-sm">
											<div className="flex items-center gap-1">
												<CheckCircle2 className="h-3 w-3 text-green-500" />
												<span>TER: {mf.withTer.toLocaleString()}</span>
											</div>
											<div className="flex items-center gap-1">
												<CheckCircle2 className="h-3 w-3 text-green-500" />
												<span>AUM: {mf.withAum.toLocaleString()}</span>
											</div>
											<div className="flex items-center gap-1 col-span-2">
												<AlertCircle className="h-3 w-3 text-amber-500" />
												<span>
													Both NULL: {mf.withBothNull.toLocaleString()}
												</span>
											</div>
										</div>
										<Progress value={mf.percentEnriched} className="h-2" />
									</div>
								) : (
									<p className="text-muted-foreground">No data available</p>
								)}
							</CardContent>
						</Card>

						<Card>
							<CardHeader className="flex flex-row items-center justify-between pb-2">
								<CardTitle className="text-sm font-medium">
									Listed Stocks
								</CardTitle>
								<Building2 className="h-4 w-4 text-muted-foreground" />
							</CardHeader>
							<CardContent>
								{stockLoading ? (
									<div className="animate-pulse h-20 bg-muted rounded" />
								) : stock ? (
									<div className="space-y-3">
										<div className="flex items-center justify-between">
											<span className="text-2xl font-bold">
												{stock.totalStocks.toLocaleString()}
											</span>
											<Badge
												variant={
													stock.percentEnriched > 50 ? "default" : "secondary"
												}
											>
												{stock.percentEnriched}% enriched
											</Badge>
										</div>
										<div className="grid grid-cols-2 gap-2 text-sm">
											<div className="flex items-center gap-1">
												<CheckCircle2 className="h-3 w-3 text-green-500" />
												<span>P/E: {stock.withPe.toLocaleString()}</span>
											</div>
											<div className="flex items-center gap-1">
												<CheckCircle2 className="h-3 w-3 text-green-500" />
												<span>EPS: {stock.withEps.toLocaleString()}</span>
											</div>
											<div className="flex items-center gap-1">
												<CheckCircle2 className="h-3 w-3 text-green-500" />
												<span>
													Book Value: {stock.withBookValue.toLocaleString()}
												</span>
											</div>
											<div className="flex items-center gap-1">
												<AlertCircle className="h-3 w-3 text-amber-500" />
												<span>All NULL: {stock.allNull.toLocaleString()}</span>
											</div>
										</div>
										<Progress value={stock.percentEnriched} className="h-2" />
									</div>
								) : (
									<p className="text-muted-foreground">No data available</p>
								)}
							</CardContent>
						</Card>
					</div>

					<Card>
						<CardHeader>
							<CardTitle>Quick Actions</CardTitle>
							<CardDescription>
								Run enrichment jobs to fill NULL columns with real data
							</CardDescription>
						</CardHeader>
						<CardContent className="flex gap-4">
							<Button
								onClick={() => runMfEnrichment.mutate(false)}
								disabled={isMfRunning || runMfEnrichment.isPending}
							>
								{isMfRunning ? (
									<>
										<RefreshCw className="h-4 w-4 mr-2 animate-spin" />
										Running...
									</>
								) : (
									<>
										<TrendingUp className="h-4 w-4 mr-2" />
										Enrich Mutual Funds
									</>
								)}
							</Button>
							<Button
								onClick={() => runStockEnrichment.mutate(false)}
								disabled={isStockRunning || runStockEnrichment.isPending}
								variant="outline"
							>
								{isStockRunning ? (
									<>
										<RefreshCw className="h-4 w-4 mr-2 animate-spin" />
										Running...
									</>
								) : (
									<>
										<Building2 className="h-4 w-4 mr-2" />
										Enrich Stocks
									</>
								)}
							</Button>
						</CardContent>
					</Card>
				</TabsContent>

				<TabsContent value="mutual-funds" className="space-y-4">
					<Card>
						<CardHeader>
							<CardTitle className="flex items-center gap-2">
								<TrendingUp className="h-5 w-5" />
								Mutual Fund Data Enrichment
							</CardTitle>
							<CardDescription>
								Fetches TER (expense ratio) and AUM data from AMFI and GitHub
								sources
							</CardDescription>
						</CardHeader>
						<CardContent className="space-y-6">
							{mf && (
								<div className="grid gap-4 md:grid-cols-4">
									<div className="bg-muted/50 rounded-lg p-4">
										<div className="text-sm text-muted-foreground">
											Total Funds
										</div>
										<div className="text-2xl font-bold">
											{mf.totalFunds.toLocaleString()}
										</div>
									</div>
									<div className="bg-muted/50 rounded-lg p-4">
										<div className="text-sm text-muted-foreground">
											With TER
										</div>
										<div className="text-2xl font-bold text-green-600">
											{mf.withTer.toLocaleString()}
										</div>
										<div className="text-xs text-muted-foreground">
											{mf.totalFunds > 0
												? Math.round((mf.withTer / mf.totalFunds) * 100)
												: 0}
											%
										</div>
									</div>
									<div className="bg-muted/50 rounded-lg p-4">
										<div className="text-sm text-muted-foreground">
											With AUM
										</div>
										<div className="text-2xl font-bold text-green-600">
											{mf.withAum.toLocaleString()}
										</div>
										<div className="text-xs text-muted-foreground">
											{mf.totalFunds > 0
												? Math.round((mf.withAum / mf.totalFunds) * 100)
												: 0}
											%
										</div>
									</div>
									<div className="bg-muted/50 rounded-lg p-4">
										<div className="text-sm text-muted-foreground">
											Missing Both
										</div>
										<div className="text-2xl font-bold text-amber-600">
											{mf.withBothNull.toLocaleString()}
										</div>
									</div>
								</div>
							)}

							{isMfRunning && mfProg && (
								<div className="border rounded-lg p-4 space-y-3">
									<div className="flex items-center gap-2">
										<RefreshCw className="h-4 w-4 animate-spin text-primary" />
										<span className="font-medium">Enrichment in Progress</span>
									</div>
									<p className="text-sm text-muted-foreground">
										{mfProg.currentStep}
									</p>
									<Progress
										value={
											mfProg.totalFunds
												? (mfProg.processedFunds! / mfProg.totalFunds) * 100
												: 0
										}
										className="h-2"
									/>
									<div className="flex gap-4 text-sm text-muted-foreground">
										<span>
											Processed: {mfProg.processedFunds?.toLocaleString() || 0}
										</span>
										<span>
											TER Updated: {mfProg.terUpdated?.toLocaleString() || 0}
										</span>
										<span>
											AUM Updated: {mfProg.aumUpdated?.toLocaleString() || 0}
										</span>
									</div>
								</div>
							)}

							<div className="flex gap-3">
								<Button
									onClick={() => runMfEnrichment.mutate(false)}
									disabled={isMfRunning || runMfEnrichment.isPending}
								>
									{isMfRunning ? (
										<RefreshCw className="h-4 w-4 mr-2 animate-spin" />
									) : (
										<BarChart3 className="h-4 w-4 mr-2" />
									)}
									Enrich NULL Values
								</Button>
								<Button
									variant="outline"
									onClick={() => runMfEnrichment.mutate(true)}
									disabled={isMfRunning || runMfEnrichment.isPending}
								>
									Force Refresh All
								</Button>
							</div>

							<div className="text-sm text-muted-foreground space-y-1">
								<p>
									<strong>Data Sources:</strong>
								</p>
								<ul className="list-disc list-inside ml-2">
									<li>
										TER: Inferred from SEBI category-based averages (Direct vs
										Regular plans)
									</li>
									<li>
										AUM: GitHub Mutual_Fund_Data repository (daily updated)
									</li>
								</ul>
							</div>
						</CardContent>
					</Card>
				</TabsContent>

				<TabsContent value="stocks" className="space-y-4">
					<Card>
						<CardHeader>
							<CardTitle className="flex items-center gap-2">
								<Building2 className="h-5 w-5" />
								Stock Financial Ratios Enrichment
							</CardTitle>
							<CardDescription>
								Fetches PE ratio, EPS, Book Value, and other financial metrics
							</CardDescription>
						</CardHeader>
						<CardContent className="space-y-6">
							{stock && (
								<div className="grid gap-4 md:grid-cols-4">
									<div className="bg-muted/50 rounded-lg p-4">
										<div className="text-sm text-muted-foreground">
											Total Stocks
										</div>
										<div className="text-2xl font-bold">
											{stock.totalStocks.toLocaleString()}
										</div>
									</div>
									<div className="bg-muted/50 rounded-lg p-4">
										<div className="text-sm text-muted-foreground">
											With P/E Ratio
										</div>
										<div className="text-2xl font-bold text-green-600">
											{stock.withPe.toLocaleString()}
										</div>
										<div className="text-xs text-muted-foreground">
											{stock.totalStocks > 0
												? Math.round((stock.withPe / stock.totalStocks) * 100)
												: 0}
											%
										</div>
									</div>
									<div className="bg-muted/50 rounded-lg p-4">
										<div className="text-sm text-muted-foreground">
											With EPS
										</div>
										<div className="text-2xl font-bold text-green-600">
											{stock.withEps.toLocaleString()}
										</div>
										<div className="text-xs text-muted-foreground">
											{stock.totalStocks > 0
												? Math.round((stock.withEps / stock.totalStocks) * 100)
												: 0}
											%
										</div>
									</div>
									<div className="bg-muted/50 rounded-lg p-4">
										<div className="text-sm text-muted-foreground">
											With Book Value
										</div>
										<div className="text-2xl font-bold text-green-600">
											{stock.withBookValue.toLocaleString()}
										</div>
									</div>
								</div>
							)}

							{isStockRunning && stockProg && (
								<div className="border rounded-lg p-4 space-y-3">
									<div className="flex items-center gap-2">
										<RefreshCw className="h-4 w-4 animate-spin text-primary" />
										<span className="font-medium">Enrichment in Progress</span>
									</div>
									<p className="text-sm text-muted-foreground">
										{stockProg.currentStep}
									</p>
									<Progress
										value={
											stockProg.totalStocks
												? (stockProg.processedStocks! / stockProg.totalStocks) *
													100
												: 0
										}
										className="h-2"
									/>
									<div className="flex gap-4 text-sm text-muted-foreground">
										<span>
											Processed:{" "}
											{stockProg.processedStocks?.toLocaleString() || 0}
										</span>
										<span>
											Enriched: {stockProg.enriched?.toLocaleString() || 0}
										</span>
									</div>
								</div>
							)}

							<div className="flex gap-3">
								<Button
									onClick={() => runStockEnrichment.mutate(false)}
									disabled={isStockRunning || runStockEnrichment.isPending}
								>
									{isStockRunning ? (
										<RefreshCw className="h-4 w-4 mr-2 animate-spin" />
									) : (
										<BarChart3 className="h-4 w-4 mr-2" />
									)}
									Enrich from Sector Averages
								</Button>
								<Button
									variant="outline"
									onClick={() => runStockEnrichment.mutate(true)}
									disabled={isStockRunning || runStockEnrichment.isPending}
								>
									Enrich with Yahoo Finance (Slow)
								</Button>
							</div>

							<div className="text-sm text-muted-foreground space-y-1">
								<p>
									<strong>Data Sources:</strong>
								</p>
								<ul className="list-disc list-inside ml-2">
									<li>
										Sector Averages: NSE sector-based PE, P/B, and EPS estimates
										(fast)
									</li>
									<li>
										Yahoo Finance: Real-time financials API (rate-limited,
										slower)
									</li>
								</ul>
							</div>
						</CardContent>
					</Card>
				</TabsContent>

				<TabsContent value="extraction" className="space-y-4">
					<Card>
						<CardHeader>
							<CardTitle className="flex items-center gap-2">
								<Database className="h-5 w-5" />
								Extended Data Extraction
							</CardTitle>
							<CardDescription>
								Extract structured fields from extendedData JSONB (exit load,
								min investment, launch date)
							</CardDescription>
						</CardHeader>
						<CardContent className="space-y-4">
							{extractionLoading ? (
								<div className="animate-pulse h-40 bg-muted rounded" />
							) : extraction ? (
								<div className="grid gap-4 md:grid-cols-4">
									<div className="text-center p-4 border rounded-lg">
										<div className="text-sm text-muted-foreground">
											Total Funds
										</div>
										<div className="text-2xl font-bold">
											{extraction.totalFunds.toLocaleString()}
										</div>
									</div>
									<div className="text-center p-4 border rounded-lg">
										<div className="text-sm text-muted-foreground">
											With Extended Data
										</div>
										<div className="text-2xl font-bold text-blue-600">
											{extraction.withExtendedData.toLocaleString()}
										</div>
									</div>
									<div className="text-center p-4 border rounded-lg">
										<div className="text-sm text-muted-foreground">
											Exit Load Extracted
										</div>
										<div className="text-2xl font-bold text-green-600">
											{extraction.exitLoadExtracted.toLocaleString()}
										</div>
									</div>
									<div className="text-center p-4 border rounded-lg">
										<div className="text-sm text-muted-foreground">
											Min Investment Extracted
										</div>
										<div className="text-2xl font-bold text-green-600">
											{extraction.minLumpsumExtracted.toLocaleString()}
										</div>
									</div>
								</div>
							) : (
								<p className="text-muted-foreground">No data available</p>
							)}

							{extraction && (
								<div className="grid gap-4 md:grid-cols-3">
									<div className="p-4 border rounded-lg">
										<div className="text-sm text-muted-foreground">
											Min SIP Extracted
										</div>
										<div className="text-xl font-bold text-green-600">
											{extraction.minSipExtracted.toLocaleString()}
										</div>
										<div className="text-xs text-muted-foreground">
											{extraction.totalFunds > 0
												? Math.round(
														(extraction.minSipExtracted /
															extraction.totalFunds) *
															100,
													)
												: 0}
											%
										</div>
									</div>
									<div className="p-4 border rounded-lg">
										<div className="text-sm text-muted-foreground">
											Launch Date Extracted
										</div>
										<div className="text-xl font-bold text-green-600">
											{extraction.launchDateExtracted.toLocaleString()}
										</div>
										<div className="text-xs text-muted-foreground">
											{extraction.totalFunds > 0
												? Math.round(
														(extraction.launchDateExtracted /
															extraction.totalFunds) *
															100,
													)
												: 0}
											%
										</div>
									</div>
									<div className="p-4 border rounded-lg">
										<div className="text-sm text-muted-foreground">
											Overall Extracted
										</div>
										<div className="text-xl font-bold">
											{extraction.percentExtracted}%
										</div>
										<Progress
											value={extraction.percentExtracted}
											className="h-2 mt-2"
										/>
									</div>
								</div>
							)}

							{isExtractionRunning && extProg && (
								<div className="border rounded-lg p-4 space-y-3">
									<div className="flex items-center gap-2">
										<RefreshCw className="h-4 w-4 animate-spin text-primary" />
										<span className="font-medium">Extraction in Progress</span>
									</div>
									<p className="text-sm text-muted-foreground">
										{extProg.currentStep}
									</p>
									<Progress
										value={
											extProg.totalFunds
												? (extProg.processedFunds / extProg.totalFunds) * 100
												: 0
										}
										className="h-2"
									/>
									<div className="flex gap-4 text-sm text-muted-foreground">
										<span>
											Processed: {extProg.processedFunds.toLocaleString()}
										</span>
										<span>
											Exit Loads: {extProg.exitLoadUpdated.toLocaleString()}
										</span>
										<span>
											Min Amounts: {extProg.minAmountsUpdated.toLocaleString()}
										</span>
									</div>
								</div>
							)}

							<div className="flex gap-3">
								<Button
									onClick={() => runExtraction.mutate(false)}
									disabled={isExtractionRunning || runExtraction.isPending}
								>
									{isExtractionRunning ? (
										<RefreshCw className="h-4 w-4 mr-2 animate-spin" />
									) : (
										<Database className="h-4 w-4 mr-2" />
									)}
									Extract from Extended Data
								</Button>
								<Button
									variant="outline"
									onClick={() => runExtraction.mutate(true)}
									disabled={isExtractionRunning || runExtraction.isPending}
								>
									Force Re-extract All
								</Button>
							</div>

							<div className="text-sm text-muted-foreground space-y-1">
								<p>
									<strong>Fields Extracted:</strong>
								</p>
								<ul className="list-disc list-inside ml-2">
									<li>
										<strong>Exit Load:</strong> Parses text like "1% if redeemed
										within 1 year" → percent + days
									</li>
									<li>
										<strong>Min Investment:</strong> Extracts lumpsum and SIP
										minimum amounts
									</li>
									<li>
										<strong>Launch Date:</strong> Parses scheme launch date from
										various formats
									</li>
								</ul>
							</div>
						</CardContent>
					</Card>
				</TabsContent>
			</Tabs>
		</div>
	);
}
