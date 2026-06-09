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
	DialogTrigger,
} from "@/components/ui/dialog";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Label } from "@/components/ui/label";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import {
	RefreshCw,
	Search,
	Loader2,
	ArrowLeft,
	Building2,
	Landmark,
	FileText,
	TrendingUp,
	AlertTriangle,
	History,
	Eye,
	Shield as LucideShield,
	DollarSign,
	Percent,
	Plus,
	Upload,
	Download,
	Check,
	X,
	ChevronDown,
	ChevronUp,
	ExternalLink,
	Play,
	Pause,
	Clock,
	Activity,
	Database,
} from "lucide-react";
import { Link } from "wouter";
import { format } from "date-fns";

interface BondCatalogItem {
	id: string;
	source: string;
	sourceId?: string;
	isin: string;
	bondName: string;
	issuerName: string;
	instrumentType: string;
	isListed: boolean;
	exchange?: string;
	faceValue: string;
	couponRate?: string;
	couponFrequency?: string;
	issueDate?: string;
	maturityDate: string;
	cleanPrice?: string;
	yieldToMaturity?: string;
	creditRating?: string;
	ratingAgency?: string;
	minInvestment?: string;
	lotSize?: number;
	taxCategory: string;
	tdsApplicable: boolean;
	tdsRate?: string;
	status: string;
	publishedAt?: string;
	lastSyncAt?: string;
	kycTierRequired: string;
	feeProfileId?: string;
	feeProfile?: FeeProfile;
}

interface FeeProfile {
	id: string;
	instrumentType: string;
	name: string;
	retailBrokerageRate: string;
	hniBrokerageRate: string;
	institutionalBrokerageRate: string;
	retailBrokerageCap: string;
	hniBrokerageCap: string;
	institutionalBrokerageCap: string;
	platformFeeRate: string;
	platformFeeCap: string;
	gstRate: string;
	stampDutyApplicable: boolean;
	isActive: boolean;
}

interface AuditLog {
	id: string;
	action: string;
	entityType: string;
	entityId: string;
	entityName?: string;
	oldValues?: any;
	newValues?: any;
	performedBy: string;
	timestamp: string | null;
	userEmail?: string;
	ipAddress?: string;
	additionalInfo?: any;
	afterValue?: any;
	changeDescription?: string;
}

interface NetYieldResult {
	grossYield: number;
	netYield: number;
	netYieldAfterTax: number;
	feeImpactBps: number;
	taxImpactBps: number;
	totalImpactBps: number;
	annualizedFeePercentage: number;
	breakdown: {
		platformFeeAnnualized: number;
		brokerageFeeAnnualized: number;
		transactionChargesAnnualized: number;
		gstAnnualized: number;
		stampDutyAnnualized: number;
	};
	regulatoryCompliant: boolean;
	violations: string[];
}

interface RefreshStatusResponse {
	success: boolean;
	status: {
		isRefreshing: boolean;
		schedulerActive: boolean;
		lastRefreshTime: string | null;
		lastRefreshResults: {
			gsec: { count: number; error?: string };
			corporate: { count: number; error?: string };
			sgb: { count: number; error?: string };
			taxFree: { count: number; error?: string };
			infrastructure: { count: number; error?: string };
		} | null;
		refreshIntervalMs: number;
	};
	stats: {
		governmentSecurities: number;
		corporateBonds: number;
		catalogTotal: number;
		publishedBonds: number;
	};
}

const INSTRUMENT_TYPES = [
	{
		value: "gsec",
		label: "Government Securities (G-Sec)",
		category: "government",
	},
	{ value: "tbill", label: "Treasury Bills (T-Bill)", category: "government" },
	{
		value: "sdl",
		label: "State Development Loans (SDL)",
		category: "government",
	},
	{ value: "sgb", label: "Sovereign Gold Bonds (SGB)", category: "government" },
	{ value: "corporate_bond", label: "Corporate Bonds", category: "corporate" },
	{
		value: "ncd",
		label: "Non-Convertible Debentures (NCD)",
		category: "corporate",
	},
	{ value: "tax_free_bond", label: "Tax-Free Bonds", category: "corporate" },
	{
		value: "infrastructure_bond",
		label: "Infrastructure Bonds",
		category: "corporate",
	},
];

const STATUS_COLORS: Record<string, string> = {
	draft:
		"bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200",
	published:
		"bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
	suspended: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
	archived: "bg-muted text-foreground",
};

const KYC_TIER_COLORS: Record<string, string> = {
	basic: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
	enhanced:
		"bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200",
	accredited:
		"bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200",
};

export default function BondSeedAdmin() {
	const { toast } = useToast();
	const [activeTab, setActiveTab] = useState("government");
	const [searchQuery, setSearchQuery] = useState("");
	const [selectedBonds, setSelectedBonds] = useState<Set<string>>(new Set());
	const [publishDialog, setPublishDialog] = useState<{
		open: boolean;
		bonds: BondCatalogItem[];
	}>({ open: false, bonds: [] });
	const [netYields, setNetYields] = useState<Record<string, NetYieldResult>>(
		{},
	);
	const [selectedSegment, setSelectedSegment] = useState<
		"retail" | "hni" | "institutional"
	>("retail");
	const [unlisistedDialog, setUnlistedDialog] = useState(false);
	const [feeOverrideDialog, setFeeOverrideDialog] = useState<{
		open: boolean;
		bond: BondCatalogItem | null;
	}>({ open: false, bond: null });
	const [feeOverride, setFeeOverride] = useState({
		platformFeeOverride: "",
		brokerageFeeOverride: "",
		transactionChargesOverride: "",
		overrideReason: "",
	});
	const [overrideNetYield, setOverrideNetYield] =
		useState<NetYieldResult | null>(null);
	const [newUnlistedBond, setNewUnlistedBond] = useState({
		isin: "",
		bondName: "",
		issuerName: "",
		instrumentType: "corporate_bond",
		faceValue: "1000",
		couponRate: "",
		maturityDate: "",
		yieldToMaturity: "",
		minInvestment: "10000",
		lotSize: 1,
		creditRating: "",
		ratingAgency: "",
	});

	// ISIN Seeding State
	const [isinSeedDialog, setIsinSeedDialog] = useState(false);
	const [isinInput, setIsinInput] = useState("");
	const [isinLookupResult, setIsinLookupResult] = useState<{
		found: boolean;
		alreadyInCatalog: boolean;
		existingEntry: BondCatalogItem | null;
		bondData: {
			isin: string;
			issuerName: string;
			securityDescription: string;
			currency: string;
			interestRate: string;
			maturityDate: string | null;
			securityType: string;
			instrumentType: string;
		};
	} | null>(null);
	const [isinOverrides, setIsinOverrides] = useState({
		bondName: "",
		issuerName: "",
		instrumentType: "",
		faceValue: "1000",
		couponRate: "",
		maturityDate: "",
		yieldToMaturity: "",
		minInvestment: "100000",
		lotSize: 1,
		creditRating: "",
		ratingAgency: "",
		kycTierRequired: "enhanced",
	});
	const [bulkIsinInput, setBulkIsinInput] = useState("");
	const [bulkIsinTab, setBulkIsinTab] = useState<"single" | "bulk">("single");

	const {
		data: catalogData,
		isLoading: isLoadingCatalog,
		refetch: refetchCatalog,
	} = useQuery<{ bonds: BondCatalogItem[] }>({
		queryKey: ["/api/admin/bond-seed/catalog"],
	});

	const { data: feeProfilesData, isLoading: isLoadingProfiles } = useQuery<{
		profiles: FeeProfile[];
	}>({
		queryKey: ["/api/admin/bond-seed/fee-profiles"],
	});

	const { data: auditLogsData, isLoading: isLoadingLogs } = useQuery<{
		logs: AuditLog[];
	}>({
		queryKey: ["/api/admin/bond-seed/audit-logs"],
	});

	const {
		data: refreshStatusData,
		isLoading: isLoadingRefreshStatus,
		refetch: refetchRefreshStatus,
	} = useQuery<RefreshStatusResponse>({
		queryKey: ["/api/admin/bond-seed/refresh/status"],
		refetchInterval: 5000,
	});

	const bonds = catalogData?.bonds || [];
	const feeProfiles = feeProfilesData?.profiles || [];
	const auditLogs = auditLogsData?.logs || [];

	const governmentBonds = bonds.filter((b) =>
		["gsec", "tbill", "sdl", "sgb"].includes(b.instrumentType),
	);
	const corporateBonds = bonds.filter((b) =>
		["corporate_bond", "ncd", "tax_free_bond", "infrastructure_bond"].includes(
			b.instrumentType,
		),
	);
	const unlistedBonds = bonds.filter((b) => !b.isListed);

	const syncNseMutation = useMutation({
		mutationFn: () =>
			apiRequest("/api/admin/bond-seed/sync/nse", { method: "POST" }),
		onSuccess: (data: any) => {
			queryClient.invalidateQueries({
				queryKey: ["/api/admin/bond-seed/catalog"],
			});
			queryClient.invalidateQueries({
				queryKey: ["/api/admin/bond-seed/audit-logs"],
			});
			toast({
				title: "NSE Sync Complete",
				description: `Synced ${data.synced || 0} new bonds, updated ${data.updated || 0} existing`,
			});
		},
		onError: (error: any) => {
			toast({
				title: "Sync Failed",
				description: error.message || "Failed to sync from NSE",
				variant: "destructive",
			});
		},
	});

	const syncBseMutation = useMutation({
		mutationFn: () =>
			apiRequest("/api/admin/bond-seed/sync/bse", { method: "POST" }),
		onSuccess: (data: any) => {
			queryClient.invalidateQueries({
				queryKey: ["/api/admin/bond-seed/catalog"],
			});
			queryClient.invalidateQueries({
				queryKey: ["/api/admin/bond-seed/audit-logs"],
			});
			toast({
				title: "BSE Sync Complete",
				description: `Synced ${data.synced || 0} new bonds, updated ${data.updated || 0} existing`,
			});
		},
		onError: (error: any) => {
			toast({
				title: "Sync Failed",
				description: error.message || "Failed to sync from BSE",
				variant: "destructive",
			});
		},
	});

	const refreshAllMutation = useMutation({
		mutationFn: () =>
			apiRequest("/api/admin/bond-seed/refresh/all", { method: "POST" }),
		onSuccess: (data: any) => {
			queryClient.invalidateQueries({
				queryKey: ["/api/admin/bond-seed/catalog"],
			});
			queryClient.invalidateQueries({
				queryKey: ["/api/admin/bond-seed/refresh/status"],
			});
			queryClient.invalidateQueries({
				queryKey: ["/api/admin/bond-seed/audit-logs"],
			});
			const results = data.results;
			const total =
				(results?.gsec?.count || 0) +
				(results?.corporate?.count || 0) +
				(results?.sgb?.count || 0) +
				(results?.taxFree?.count || 0) +
				(results?.infrastructure?.count || 0);
			toast({
				title: "Refresh Complete",
				description: `Refreshed ${total} bonds from all sources`,
			});
		},
		onError: (error: any) => {
			toast({
				title: "Refresh Failed",
				description: error.message || "Failed to refresh bonds",
				variant: "destructive",
			});
		},
	});

	const refreshCategoryMutation = useMutation({
		mutationFn: (category: string) =>
			apiRequest(`/api/admin/bond-seed/refresh/${category}`, {
				method: "POST",
			}),
		onSuccess: (data: any) => {
			queryClient.invalidateQueries({
				queryKey: ["/api/admin/bond-seed/catalog"],
			});
			queryClient.invalidateQueries({
				queryKey: ["/api/admin/bond-seed/refresh/status"],
			});
			toast({
				title: "Category Refresh Complete",
				description: `Refreshed ${data.count || 0} ${data.type || "bonds"}`,
			});
		},
		onError: (error: any) => {
			toast({
				title: "Refresh Failed",
				description: error.message || "Failed to refresh category",
				variant: "destructive",
			});
		},
	});

	const schedulerStartMutation = useMutation({
		mutationFn: () =>
			apiRequest("/api/admin/bond-seed/scheduler/start", { method: "POST" }),
		onSuccess: () => {
			queryClient.invalidateQueries({
				queryKey: ["/api/admin/bond-seed/refresh/status"],
			});
			toast({
				title: "Scheduler Started",
				description: "Auto-refresh is now enabled (1-hour interval)",
			});
		},
		onError: (error: any) => {
			toast({
				title: "Failed",
				description: error.message || "Failed to start scheduler",
				variant: "destructive",
			});
		},
	});

	const schedulerStopMutation = useMutation({
		mutationFn: () =>
			apiRequest("/api/admin/bond-seed/scheduler/stop", { method: "POST" }),
		onSuccess: () => {
			queryClient.invalidateQueries({
				queryKey: ["/api/admin/bond-seed/refresh/status"],
			});
			toast({
				title: "Scheduler Stopped",
				description: "Auto-refresh is now disabled",
			});
		},
		onError: (error: any) => {
			toast({
				title: "Failed",
				description: error.message || "Failed to stop scheduler",
				variant: "destructive",
			});
		},
	});

	const publishBondsMutation = useMutation({
		mutationFn: (bondIds: string[]) =>
			apiRequest("/api/admin/bond-seed/catalog/bulk-publish", {
				method: "POST",
				body: JSON.stringify({ bondIds }),
			}),
		onSuccess: (data: any) => {
			queryClient.invalidateQueries({
				queryKey: ["/api/admin/bond-seed/catalog"],
			});
			queryClient.invalidateQueries({
				queryKey: ["/api/admin/bond-seed/audit-logs"],
			});
			setSelectedBonds(new Set());
			setPublishDialog({ open: false, bonds: [] });
			toast({
				title: "Bonds Published",
				description: `${data.published || 0} bonds are now visible in the marketplace`,
			});
		},
		onError: (error: any) => {
			toast({
				title: "Publish Failed",
				description: error.message || "Failed to publish bonds",
				variant: "destructive",
			});
		},
	});

	const fetchNetYieldsMutation = useMutation({
		mutationFn: async ({
			bondIds,
			investorSegment,
		}: { bondIds: string[]; investorSegment: string }) => {
			const response = await apiRequest(
				"/api/admin/bond-seed/catalog/batch-net-yield",
				{
					method: "POST",
					body: JSON.stringify({ bondIds, investorSegment }),
				},
			);
			return response as { netYields: Record<string, NetYieldResult> };
		},
		onSuccess: (data) => {
			setNetYields(data.netYields || {});
		},
		onError: (error: any) => {
			console.error("Error fetching net yields:", error);
		},
	});

	const previewOverrideNetYieldMutation = useMutation({
		mutationFn: async (data: {
			bond: BondCatalogItem;
			override: typeof feeOverride;
		}) => {
			const response = await apiRequest(
				"/api/admin/bond-seed/preview-override-net-yield",
				{
					method: "POST",
					body: JSON.stringify({
						instrumentType: data.bond.instrumentType,
						grossYield: data.bond.yieldToMaturity || "0",
						transactionAmount: data.bond.minInvestment || "100000",
						holdingPeriodYears: data.bond.maturityDate
							? Math.max(
									0.25,
									(new Date(data.bond.maturityDate).getTime() - Date.now()) /
										(365.25 * 24 * 60 * 60 * 1000),
								)
							: 1,
						investorSegment: selectedSegment,
						platformFeeOverride: data.override.platformFeeOverride || null,
						brokerageFeeOverride: data.override.brokerageFeeOverride || null,
						transactionChargesOverride:
							data.override.transactionChargesOverride || null,
					}),
				},
			);
			return response as NetYieldResult;
		},
		onSuccess: (data) => {
			setOverrideNetYield(data);
		},
		onError: (error: any) => {
			console.error("Error previewing override net yield:", error);
		},
	});

	const createFeeOverrideMutation = useMutation({
		mutationFn: async (data: {
			bond: BondCatalogItem;
			override: typeof feeOverride;
		}) => {
			return await apiRequest("/api/admin/bond-seed/fee-overrides", {
				method: "POST",
				body: JSON.stringify({
					isin: data.bond.isin,
					catalogId: data.bond.id,
					platformFeeOverride: data.override.platformFeeOverride || null,
					brokerageFeeOverride: data.override.brokerageFeeOverride || null,
					transactionChargesOverride:
						data.override.transactionChargesOverride || null,
					overrideReason: data.override.overrideReason,
				}),
			});
		},
		onSuccess: () => {
			queryClient.invalidateQueries({
				queryKey: ["/api/admin/bond-seed/catalog"],
			});
			queryClient.invalidateQueries({
				queryKey: ["/api/admin/bond-seed/audit-logs"],
			});
			setFeeOverrideDialog({ open: false, bond: null });
			setFeeOverride({
				platformFeeOverride: "",
				brokerageFeeOverride: "",
				transactionChargesOverride: "",
				overrideReason: "",
			});
			setOverrideNetYield(null);
			toast({
				title: "Fee Override Created",
				description: "Custom fees have been applied to this bond",
			});
		},
		onError: (error: any) => {
			toast({
				title: "Error",
				description: error.message || "Failed to create fee override",
				variant: "destructive",
			});
		},
	});

	const unpublishBondMutation = useMutation({
		mutationFn: (bondId: string) =>
			apiRequest(`/api/admin/bond-seed/catalog/${bondId}/unpublish`, {
				method: "POST",
			}),
		onSuccess: () => {
			queryClient.invalidateQueries({
				queryKey: ["/api/admin/bond-seed/catalog"],
			});
			queryClient.invalidateQueries({
				queryKey: ["/api/admin/bond-seed/audit-logs"],
			});
			toast({
				title: "Bond Unpublished",
				description: "Bond removed from marketplace",
			});
		},
		onError: (error: any) => {
			toast({
				title: "Error",
				description: error.message || "Failed to unpublish bond",
				variant: "destructive",
			});
		},
	});

	const createUnlistedBondMutation = useMutation({
		mutationFn: (bond: typeof newUnlistedBond) =>
			apiRequest("/api/admin/bond-seed/unlisted", {
				method: "POST",
				body: JSON.stringify(bond),
			}),
		onSuccess: () => {
			queryClient.invalidateQueries({
				queryKey: ["/api/admin/bond-seed/catalog"],
			});
			queryClient.invalidateQueries({
				queryKey: ["/api/admin/bond-seed/audit-logs"],
			});
			setUnlistedDialog(false);
			setNewUnlistedBond({
				isin: "",
				bondName: "",
				issuerName: "",
				instrumentType: "corporate_bond",
				faceValue: "1000",
				couponRate: "",
				maturityDate: "",
				yieldToMaturity: "",
				minInvestment: "10000",
				lotSize: 1,
				creditRating: "",
				ratingAgency: "",
			});
			toast({
				title: "Unlisted Bond Created",
				description: "Bond added to catalog as draft",
			});
		},
		onError: (error: any) => {
			toast({
				title: "Error",
				description: error.message || "Failed to create bond",
				variant: "destructive",
			});
		},
	});

	// ISIN Lookup and Seed Mutations
	const isinLookupMutation = useMutation({
		mutationFn: async (isin: string) => {
			const response = await apiRequest(
				`/api/admin/bond-seed/isin-lookup/${isin}`,
			);
			return response as typeof isinLookupResult;
		},
		onSuccess: (data) => {
			setIsinLookupResult(data);
			if (data?.bondData) {
				setIsinOverrides((prev) => ({
					...prev,
					bondName: data.bondData.securityDescription || "",
					issuerName: data.bondData.issuerName || "",
					instrumentType: data.bondData.instrumentType || "corporate_bond",
					maturityDate: data.bondData.maturityDate || "",
					couponRate:
						data.bondData.interestRate?.match(/(\d+\.?\d*)/)?.[1] || "",
				}));
			}
		},
		onError: (error: any) => {
			setIsinLookupResult(null);
			toast({
				title: "ISIN Lookup Failed",
				description: error.message || "ISIN not found in NSDL database",
				variant: "destructive",
			});
		},
	});

	const seedFromIsinMutation = useMutation({
		mutationFn: async ({
			isin,
			overrides,
			publish,
		}: { isin: string; overrides: any; publish: boolean }) => {
			return await apiRequest("/api/admin/bond-seed/seed-from-isin", {
				method: "POST",
				body: JSON.stringify({ isin, overrides, publish }),
			});
		},
		onSuccess: (data: any) => {
			queryClient.invalidateQueries({
				queryKey: ["/api/admin/bond-seed/catalog"],
			});
			queryClient.invalidateQueries({
				queryKey: ["/api/admin/bond-seed/audit-logs"],
			});
			setIsinSeedDialog(false);
			setIsinInput("");
			setIsinLookupResult(null);
			setIsinOverrides({
				bondName: "",
				issuerName: "",
				instrumentType: "",
				faceValue: "1000",
				couponRate: "",
				maturityDate: "",
				yieldToMaturity: "",
				minInvestment: "100000",
				lotSize: 1,
				creditRating: "",
				ratingAgency: "",
				kycTierRequired: "enhanced",
			});
			toast({
				title: "Bond Seeded Successfully",
				description: data.message || `Bond added from ISIN`,
			});
		},
		onError: (error: any) => {
			toast({
				title: "Seed Failed",
				description: error.message || "Failed to seed bond from ISIN",
				variant: "destructive",
			});
		},
	});

	const bulkSeedFromIsinMutation = useMutation({
		mutationFn: async ({
			isins,
			publish,
		}: { isins: string[]; publish: boolean }) => {
			return await apiRequest("/api/admin/bond-seed/bulk-seed-from-isin", {
				method: "POST",
				body: JSON.stringify({ isins, publish }),
			});
		},
		onSuccess: (data: any) => {
			queryClient.invalidateQueries({
				queryKey: ["/api/admin/bond-seed/catalog"],
			});
			queryClient.invalidateQueries({
				queryKey: ["/api/admin/bond-seed/audit-logs"],
			});
			setBulkIsinInput("");
			toast({
				title: "Bulk Seed Complete",
				description: `Succeeded: ${data.summary?.succeeded || 0}, Failed: ${data.summary?.failed || 0}, Skipped: ${data.summary?.skipped || 0}`,
			});
		},
		onError: (error: any) => {
			toast({
				title: "Bulk Seed Failed",
				description: error.message || "Failed to bulk seed bonds",
				variant: "destructive",
			});
		},
	});

	const handleIsinLookup = () => {
		if (isinInput.length >= 12) {
			isinLookupMutation.mutate(isinInput.toUpperCase());
		}
	};

	const handleSeedFromIsin = (publish: boolean) => {
		if (!isinLookupResult?.bondData) return;
		seedFromIsinMutation.mutate({
			isin: isinInput.toUpperCase(),
			overrides: isinOverrides,
			publish,
		});
	};

	const handleBulkSeed = (publish: boolean) => {
		const isins = bulkIsinInput
			.split(/[\n,]+/)
			.map((s) => s.trim().toUpperCase())
			.filter((s) => s.length >= 12);

		if (isins.length === 0) {
			toast({
				title: "No Valid ISINs",
				description: "Please enter at least one valid ISIN (12 characters)",
				variant: "destructive",
			});
			return;
		}

		bulkSeedFromIsinMutation.mutate({ isins, publish });
	};

	const handleSelectBond = (bondId: string, checked: boolean) => {
		const newSet = new Set(selectedBonds);
		if (checked) {
			newSet.add(bondId);
		} else {
			newSet.delete(bondId);
		}
		setSelectedBonds(newSet);
	};

	const handleSelectAll = (bonds: BondCatalogItem[], checked: boolean) => {
		const publishableBonds = bonds.filter(
			(b) => b.status === "draft" || b.status === "unpublished",
		);
		if (checked) {
			setSelectedBonds(new Set(publishableBonds.map((b) => b.id)));
		} else {
			setSelectedBonds(new Set());
		}
	};

	const handlePublishSelected = () => {
		const selectedBondItems = bonds.filter(
			(b) =>
				selectedBonds.has(b.id) &&
				(b.status === "draft" || b.status === "unpublished"),
		);
		if (selectedBondItems.length > 0) {
			setPublishDialog({ open: true, bonds: selectedBondItems });
			// Fetch net yields for selected bonds
			fetchNetYieldsMutation.mutate({
				bondIds: selectedBondItems.map((b) => b.id),
				investorSegment: selectedSegment,
			});
		}
	};

	const handleSegmentChange = (segment: "retail" | "hni" | "institutional") => {
		setSelectedSegment(segment);
		if (publishDialog.bonds.length > 0) {
			fetchNetYieldsMutation.mutate({
				bondIds: publishDialog.bonds.map((b) => b.id),
				investorSegment: segment,
			});
		}
	};

	const filteredBonds = (list: BondCatalogItem[]) => {
		if (!searchQuery) return list;
		const query = searchQuery.toLowerCase();
		return list.filter(
			(b) =>
				b.bondName.toLowerCase().includes(query) ||
				b.isin.toLowerCase().includes(query) ||
				b.issuerName.toLowerCase().includes(query),
		);
	};

	const getFeeProfileForType = (instrumentType: string) => {
		return feeProfiles.find((p) => p.instrumentType === instrumentType);
	};

	const renderBondTable = (
		bondsList: BondCatalogItem[],
		showSync: "nse" | "bse" | "none",
	) => {
		const filtered = filteredBonds(bondsList);
		const publishableBonds = filtered.filter(
			(b) => b.status === "draft" || b.status === "unpublished",
		);

		return (
			<Card>
				<CardHeader className="pb-3">
					<div className="flex items-center justify-between">
						<div className="flex items-center gap-2">
							<Input
								placeholder="Search by name, ISIN, issuer..."
								value={searchQuery}
								onChange={(e) => setSearchQuery(e.target.value)}
								className="w-[300px]"
								data-testid="input-search-bonds"
							/>
							<Button
								variant="outline"
								size="icon"
								onClick={() => refetchCatalog()}
							>
								<RefreshCw className="h-4 w-4" />
							</Button>
						</div>
						<div className="flex items-center gap-2">
							{showSync === "nse" && (
								<Button
									onClick={() => syncNseMutation.mutate()}
									disabled={syncNseMutation.isPending}
									data-testid="button-sync-nse"
								>
									{syncNseMutation.isPending ? (
										<Loader2 className="h-4 w-4 mr-2 animate-spin" />
									) : (
										<Download className="h-4 w-4 mr-2" />
									)}
									Sync from NSE
								</Button>
							)}
							{showSync === "bse" && (
								<Button
									onClick={() => syncBseMutation.mutate()}
									disabled={syncBseMutation.isPending}
									data-testid="button-sync-bse"
								>
									{syncBseMutation.isPending ? (
										<Loader2 className="h-4 w-4 mr-2 animate-spin" />
									) : (
										<Download className="h-4 w-4 mr-2" />
									)}
									Sync from BSE
								</Button>
							)}
							{showSync === "none" && (
								<Button
									onClick={() => setUnlistedDialog(true)}
									data-testid="button-add-unlisted"
								>
									<Plus className="h-4 w-4 mr-2" />
									Add Unlisted Bond
								</Button>
							)}
							{selectedBonds.size > 0 && publishableBonds.length > 0 && (
								<Button
									onClick={handlePublishSelected}
									variant="default"
									data-testid="button-publish-selected"
								>
									<Check className="h-4 w-4 mr-2" />
									Publish Selected ({selectedBonds.size})
								</Button>
							)}
						</div>
					</div>
				</CardHeader>
				<CardContent>
					<ScrollArea className="h-[600px]">
						<Table>
							<TableHeader>
								<TableRow>
									<TableHead className="w-[50px]">
										<Checkbox
											checked={
												publishableBonds.length > 0 &&
												selectedBonds.size === publishableBonds.length
											}
											onCheckedChange={(checked) =>
												handleSelectAll(filtered, !!checked)
											}
										/>
									</TableHead>
									<TableHead>ISIN / Name</TableHead>
									<TableHead>Issuer</TableHead>
									<TableHead>Type</TableHead>
									<TableHead className="text-right">Coupon</TableHead>
									<TableHead className="text-right">YTM</TableHead>
									<TableHead className="text-right">Price</TableHead>
									<TableHead>Rating</TableHead>
									<TableHead>KYC Tier</TableHead>
									<TableHead>Status</TableHead>
									<TableHead className="text-right">Actions</TableHead>
								</TableRow>
							</TableHeader>
							<TableBody>
								{isLoadingCatalog ? (
									<TableRow>
										<TableCell colSpan={11} className="text-center py-8">
											<Loader2 className="h-6 w-6 animate-spin mx-auto" />
										</TableCell>
									</TableRow>
								) : filtered.length === 0 ? (
									<TableRow>
										<TableCell
											colSpan={11}
											className="text-center py-8 text-muted-foreground"
										>
											No bonds found.{" "}
											{showSync !== "none"
												? "Try syncing from the exchange."
												: "Add an unlisted bond to get started."}
										</TableCell>
									</TableRow>
								) : (
									filtered.map((bond) => (
										<TableRow key={bond.id}>
											<TableCell>
												<Checkbox
													checked={selectedBonds.has(bond.id)}
													onCheckedChange={(checked) =>
														handleSelectBond(bond.id, !!checked)
													}
													disabled={
														bond.status !== "draft" &&
														bond.status !== "unpublished"
													}
												/>
											</TableCell>
											<TableCell>
												<div className="font-medium text-sm">
													{bond.bondName}
												</div>
												<div className="text-xs text-muted-foreground">
													{bond.isin}
												</div>
											</TableCell>
											<TableCell className="text-sm">
												{bond.issuerName}
											</TableCell>
											<TableCell>
												<Badge variant="outline" className="text-xs">
													{INSTRUMENT_TYPES.find(
														(t) => t.value === bond.instrumentType,
													)?.label || bond.instrumentType}
												</Badge>
											</TableCell>
											<TableCell className="text-right font-mono text-sm">
												{bond.couponRate
													? `${Number.parseFloat(bond.couponRate).toFixed(2)}%`
													: "-"}
											</TableCell>
											<TableCell className="text-right font-mono text-sm">
												{bond.yieldToMaturity
													? `${Number.parseFloat(bond.yieldToMaturity).toFixed(2)}%`
													: "-"}
											</TableCell>
											<TableCell className="text-right font-mono text-sm">
												{bond.cleanPrice
													? `₹${Number.parseFloat(bond.cleanPrice).toLocaleString()}`
													: "-"}
											</TableCell>
											<TableCell>
												{bond.creditRating && (
													<Badge variant="secondary" className="text-xs">
														{bond.creditRating}
													</Badge>
												)}
											</TableCell>
											<TableCell>
												<Badge
													className={
														KYC_TIER_COLORS[bond.kycTierRequired] || "bg-muted"
													}
												>
													{bond.kycTierRequired}
												</Badge>
											</TableCell>
											<TableCell>
												<Badge
													className={STATUS_COLORS[bond.status] || "bg-muted"}
												>
													{bond.status}
												</Badge>
											</TableCell>
											<TableCell className="text-right">
												<div className="flex items-center justify-end gap-2">
													<div className="flex items-center gap-2">
														<span
															className={`text-xs ${bond.status === "published" ? "text-green-600 font-medium" : "text-muted-foreground"}`}
														>
															{bond.status === "published" ? "Live" : "Draft"}
														</span>
														<Switch
															checked={bond.status === "published"}
															onCheckedChange={(checked) => {
																if (checked) {
																	setPublishDialog({
																		open: true,
																		bonds: [bond],
																	});
																	fetchNetYieldsMutation.mutate({
																		bondIds: [bond.id],
																		investorSegment: selectedSegment,
																	});
																} else {
																	unpublishBondMutation.mutate(bond.id);
																}
															}}
															disabled={unpublishBondMutation.isPending}
															data-testid={`toggle-publish-${bond.id}`}
														/>
													</div>
													<Button
														size="sm"
														variant="ghost"
														onClick={() =>
															setFeeOverrideDialog({ open: true, bond })
														}
														data-testid={`button-fee-override-${bond.id}`}
														title="Set custom fees"
													>
														<Percent className="h-3 w-3" />
													</Button>
												</div>
											</TableCell>
										</TableRow>
									))
								)}
							</TableBody>
						</Table>
					</ScrollArea>
				</CardContent>
			</Card>
		);
	};

	const renderFeeProfilesTable = () => (
		<Card>
			<CardHeader>
				<CardTitle className="flex items-center gap-2">
					<DollarSign className="h-5 w-5" />
					Fee Profiles (SEBI/RBI Regulatory Caps)
				</CardTitle>
				<CardDescription>
					Brokerage and platform fee configurations per instrument type. Rates
					cannot exceed regulatory caps.
				</CardDescription>
			</CardHeader>
			<CardContent>
				<ScrollArea className="h-[500px]">
					<Table>
						<TableHeader>
							<TableRow>
								<TableHead>Instrument Type</TableHead>
								<TableHead className="text-center">Retail Rate / Cap</TableHead>
								<TableHead className="text-center">HNI Rate / Cap</TableHead>
								<TableHead className="text-center">
									Institutional Rate / Cap
								</TableHead>
								<TableHead className="text-center">Platform Fee</TableHead>
								<TableHead className="text-center">GST</TableHead>
								<TableHead className="text-center">Stamp Duty</TableHead>
								<TableHead>Status</TableHead>
							</TableRow>
						</TableHeader>
						<TableBody>
							{isLoadingProfiles ? (
								<TableRow>
									<TableCell colSpan={8} className="text-center py-8">
										<Loader2 className="h-6 w-6 animate-spin mx-auto" />
									</TableCell>
								</TableRow>
							) : feeProfiles.length === 0 ? (
								<TableRow>
									<TableCell
										colSpan={8}
										className="text-center py-8 text-muted-foreground"
									>
										No fee profiles configured. Default profiles will be created
										on first sync.
									</TableCell>
								</TableRow>
							) : (
								feeProfiles.map((profile) => (
									<TableRow key={profile.id}>
										<TableCell>
											<div className="font-medium">{profile.name}</div>
											<div className="text-xs text-muted-foreground">
												{profile.instrumentType}
											</div>
										</TableCell>
										<TableCell className="text-center">
											<div className="font-mono text-sm">
												{Number.parseFloat(profile.retailBrokerageRate).toFixed(
													3,
												)}
												%
											</div>
											<div className="text-xs text-muted-foreground">
												max{" "}
												{Number.parseFloat(profile.retailBrokerageCap).toFixed(
													3,
												)}
												%
											</div>
										</TableCell>
										<TableCell className="text-center">
											<div className="font-mono text-sm">
												{Number.parseFloat(profile.hniBrokerageRate).toFixed(3)}
												%
											</div>
											<div className="text-xs text-muted-foreground">
												max{" "}
												{Number.parseFloat(profile.hniBrokerageCap).toFixed(3)}%
											</div>
										</TableCell>
										<TableCell className="text-center">
											<div className="font-mono text-sm">
												{Number.parseFloat(
													profile.institutionalBrokerageRate,
												).toFixed(3)}
												%
											</div>
											<div className="text-xs text-muted-foreground">
												max{" "}
												{Number.parseFloat(
													profile.institutionalBrokerageCap,
												).toFixed(3)}
												%
											</div>
										</TableCell>
										<TableCell className="text-center">
											<div className="font-mono text-sm">
												{Number.parseFloat(profile.platformFeeRate).toFixed(2)}%
											</div>
											<div className="text-xs text-muted-foreground">
												max{" "}
												{Number.parseFloat(profile.platformFeeCap).toFixed(2)}%
											</div>
										</TableCell>
										<TableCell className="text-center font-mono text-sm">
											{Number.parseFloat(profile.gstRate).toFixed(0)}%
										</TableCell>
										<TableCell className="text-center">
											{profile.stampDutyApplicable ? (
												<Check className="h-4 w-4 mx-auto text-green-600" />
											) : (
												<X className="h-4 w-4 mx-auto text-muted-foreground" />
											)}
										</TableCell>
										<TableCell>
											<Badge
												variant={profile.isActive ? "default" : "secondary"}
											>
												{profile.isActive ? "Active" : "Inactive"}
											</Badge>
										</TableCell>
									</TableRow>
								))
							)}
						</TableBody>
					</Table>
				</ScrollArea>
			</CardContent>
		</Card>
	);

	const renderAuditLogs = () => (
		<Card>
			<CardHeader>
				<CardTitle className="flex items-center gap-2">
					<History className="h-5 w-5" />
					Audit Trail
				</CardTitle>
				<CardDescription>
					Complete history of bond seed operations for compliance review
				</CardDescription>
			</CardHeader>
			<CardContent>
				<ScrollArea className="h-[500px]">
					<Table>
						<TableHeader>
							<TableRow>
								<TableHead>Timestamp</TableHead>
								<TableHead>Action</TableHead>
								<TableHead>Entity</TableHead>
								<TableHead>Performed By</TableHead>
								<TableHead>Details</TableHead>
							</TableRow>
						</TableHeader>
						<TableBody>
							{isLoadingLogs ? (
								<TableRow>
									<TableCell colSpan={5} className="text-center py-8">
										<Loader2 className="h-6 w-6 animate-spin mx-auto" />
									</TableCell>
								</TableRow>
							) : auditLogs.length === 0 ? (
								<TableRow>
									<TableCell
										colSpan={5}
										className="text-center py-8 text-muted-foreground"
									>
										No audit logs yet. Operations will be recorded here.
									</TableCell>
								</TableRow>
							) : (
								auditLogs.map((log) => (
									<TableRow key={log.id}>
										<TableCell className="text-sm">
											{log.timestamp
												? format(new Date(log.timestamp), "dd MMM yyyy HH:mm")
												: "-"}
										</TableCell>
										<TableCell>
											<Badge variant="outline">{log.action}</Badge>
										</TableCell>
										<TableCell>
											<div className="text-sm">
												{log.entityName || log.entityId}
											</div>
											<div className="text-xs text-muted-foreground">
												{log.entityType}
											</div>
										</TableCell>
										<TableCell className="text-sm">
											{log.userEmail || log.performedBy || "-"}
										</TableCell>
										<TableCell className="text-xs text-muted-foreground max-w-[200px] truncate">
											{log.changeDescription ||
												(log.afterValue ? JSON.stringify(log.afterValue) : "-")}
										</TableCell>
									</TableRow>
								))
							)}
						</TableBody>
					</Table>
				</ScrollArea>
			</CardContent>
		</Card>
	);

	return (
		<div className="container max-w-7xl mx-auto py-6 space-y-6">
			<div className="flex items-center justify-between">
				<div className="flex items-center gap-4">
					<Link href="/admin/store-management">
						<Button variant="ghost" size="icon" data-testid="button-back">
							<ArrowLeft className="h-5 w-5" />
						</Button>
					</Link>
					<div>
						<h1 className="text-2xl font-bold">Bond Seed Administration</h1>
						<p className="text-muted-foreground">
							Ingest bonds from NSE/BSE, manage fee profiles, and publish to
							marketplace
						</p>
					</div>
				</div>
				<div className="flex items-center gap-2">
					<Badge variant="outline" className="flex items-center gap-1">
						<Landmark className="h-3 w-3" />
						{governmentBonds.length} G-Secs
					</Badge>
					<Badge variant="outline" className="flex items-center gap-1">
						<Building2 className="h-3 w-3" />
						{corporateBonds.length} Corporate
					</Badge>
					<Badge variant="outline" className="flex items-center gap-1">
						<FileText className="h-3 w-3" />
						{unlistedBonds.length} Unlisted
					</Badge>
					<Button
						onClick={() => setIsinSeedDialog(true)}
						className="ml-2"
						data-testid="button-seed-from-isin"
					>
						<Upload className="h-4 w-4 mr-2" />
						Seed from ISIN
					</Button>
				</div>
			</div>

			<Alert>
				<LucideShield className="h-4 w-4" />
				<AlertDescription>
					<strong>Regulatory Compliance:</strong> All brokerage rates are capped
					as per SEBI/RBI guidelines. Government securities: max 0.025% (G-Secs,
					SDLs), 0.0125% (T-Bills), 0.50% (SGBs). Corporate bonds: max 0.50%.
					GST at 18% applies on brokerage.
				</AlertDescription>
			</Alert>

			<Tabs value={activeTab} onValueChange={setActiveTab}>
				<TabsList className="grid w-full grid-cols-6">
					<TabsTrigger
						value="government"
						className="flex items-center gap-2"
						data-testid="tab-government"
					>
						<Landmark className="h-4 w-4" />
						Government Securities
					</TabsTrigger>
					<TabsTrigger
						value="corporate"
						className="flex items-center gap-2"
						data-testid="tab-corporate"
					>
						<Building2 className="h-4 w-4" />
						Corporate Bonds
					</TabsTrigger>
					<TabsTrigger
						value="unlisted"
						className="flex items-center gap-2"
						data-testid="tab-unlisted"
					>
						<FileText className="h-4 w-4" />
						Unlisted Bonds
					</TabsTrigger>
					<TabsTrigger
						value="fees"
						className="flex items-center gap-2"
						data-testid="tab-fees"
					>
						<Percent className="h-4 w-4" />
						Fee Profiles
					</TabsTrigger>
					<TabsTrigger
						value="refresh"
						className="flex items-center gap-2"
						data-testid="tab-refresh"
					>
						<Activity className="h-4 w-4" />
						Data Refresh
					</TabsTrigger>
					<TabsTrigger
						value="audit"
						className="flex items-center gap-2"
						data-testid="tab-audit"
					>
						<History className="h-4 w-4" />
						Audit Logs
					</TabsTrigger>
				</TabsList>

				<TabsContent value="government" className="mt-6">
					{renderBondTable(governmentBonds, "nse")}
				</TabsContent>

				<TabsContent value="corporate" className="mt-6">
					{renderBondTable(corporateBonds, "bse")}
				</TabsContent>

				<TabsContent value="unlisted" className="mt-6">
					{renderBondTable(unlistedBonds, "none")}
				</TabsContent>

				<TabsContent value="fees" className="mt-6">
					{renderFeeProfilesTable()}
				</TabsContent>

				<TabsContent value="refresh" className="mt-6">
					<div className="space-y-6">
						<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
							<Card>
								<CardHeader className="pb-2">
									<CardTitle className="text-sm font-medium flex items-center gap-2">
										<Landmark className="h-4 w-4" />
										Government Securities
									</CardTitle>
								</CardHeader>
								<CardContent>
									<div className="text-2xl font-bold">
										{refreshStatusData?.stats?.governmentSecurities || 0}
									</div>
									<p className="text-xs text-muted-foreground">
										G-Secs, T-Bills, SDLs, SGBs
									</p>
								</CardContent>
							</Card>
							<Card>
								<CardHeader className="pb-2">
									<CardTitle className="text-sm font-medium flex items-center gap-2">
										<Building2 className="h-4 w-4" />
										Corporate Bonds
									</CardTitle>
								</CardHeader>
								<CardContent>
									<div className="text-2xl font-bold">
										{refreshStatusData?.stats?.corporateBonds || 0}
									</div>
									<p className="text-xs text-muted-foreground">
										NCDs, Tax-Free, Infrastructure
									</p>
								</CardContent>
							</Card>
							<Card>
								<CardHeader className="pb-2">
									<CardTitle className="text-sm font-medium flex items-center gap-2">
										<Database className="h-4 w-4" />
										Catalog Total
									</CardTitle>
								</CardHeader>
								<CardContent>
									<div className="text-2xl font-bold">
										{refreshStatusData?.stats?.catalogTotal || 0}
									</div>
									<p className="text-xs text-muted-foreground">
										All bonds in catalog
									</p>
								</CardContent>
							</Card>
							<Card>
								<CardHeader className="pb-2">
									<CardTitle className="text-sm font-medium flex items-center gap-2">
										<Check className="h-4 w-4 text-green-600" />
										Published
									</CardTitle>
								</CardHeader>
								<CardContent>
									<div className="text-2xl font-bold text-green-600">
										{refreshStatusData?.stats?.publishedBonds || 0}
									</div>
									<p className="text-xs text-muted-foreground">
										Live in marketplace
									</p>
								</CardContent>
							</Card>
						</div>

						<div className="grid grid-cols-1 md:grid-cols-2 gap-6">
							<Card>
								<CardHeader>
									<CardTitle className="flex items-center gap-2">
										<Clock className="h-5 w-5" />
										Scheduler Status
									</CardTitle>
									<CardDescription>
										Auto-refresh runs every hour to keep bond data current
									</CardDescription>
								</CardHeader>
								<CardContent className="space-y-4">
									<div className="flex items-center justify-between">
										<div className="flex items-center gap-2">
											{refreshStatusData?.status?.isRefreshing ? (
												<>
													<Loader2 className="h-4 w-4 animate-spin text-primary" />
													<span className="text-sm font-medium">
														Refreshing...
													</span>
												</>
											) : refreshStatusData?.status?.schedulerActive ? (
												<>
													<div className="h-2 w-2 rounded-full bg-green-500 animate-pulse" />
													<span className="text-sm font-medium text-green-600">
														Auto-refresh Active
													</span>
												</>
											) : (
												<>
													<div className="h-2 w-2 rounded-full bg-yellow-500" />
													<span className="text-sm font-medium text-yellow-600">
														Scheduler Stopped
													</span>
												</>
											)}
										</div>
										<div className="flex gap-2">
											<Button
												variant="outline"
												size="sm"
												onClick={() => schedulerStartMutation.mutate()}
												disabled={
													schedulerStartMutation.isPending ||
													refreshStatusData?.status?.schedulerActive
												}
											>
												<Play className="h-4 w-4 mr-1" />
												Start
											</Button>
											<Button
												variant="outline"
												size="sm"
												onClick={() => schedulerStopMutation.mutate()}
												disabled={
													schedulerStopMutation.isPending ||
													!refreshStatusData?.status?.schedulerActive
												}
											>
												<Pause className="h-4 w-4 mr-1" />
												Stop
											</Button>
										</div>
									</div>
									{refreshStatusData?.status?.lastRefreshTime && (
										<div className="text-sm text-muted-foreground">
											Last refresh:{" "}
											{format(
												new Date(refreshStatusData.status.lastRefreshTime),
												"PPp",
											)}
										</div>
									)}
									{refreshStatusData?.status?.lastRefreshResults && (
										<div className="text-xs space-y-1 pt-2 border-t">
											<div className="flex justify-between">
												<span>G-Secs:</span>
												<span
													className={
														refreshStatusData.status.lastRefreshResults.gsec
															.error
															? "text-red-500"
															: ""
													}
												>
													{
														refreshStatusData.status.lastRefreshResults.gsec
															.count
													}
													{refreshStatusData.status.lastRefreshResults.gsec
														.error && " (error)"}
												</span>
											</div>
											<div className="flex justify-between">
												<span>Corporate:</span>
												<span
													className={
														refreshStatusData.status.lastRefreshResults
															.corporate.error
															? "text-red-500"
															: ""
													}
												>
													{
														refreshStatusData.status.lastRefreshResults
															.corporate.count
													}
													{refreshStatusData.status.lastRefreshResults.corporate
														.error && " (error)"}
												</span>
											</div>
											<div className="flex justify-between">
												<span>SGBs:</span>
												<span
													className={
														refreshStatusData.status.lastRefreshResults.sgb
															.error
															? "text-red-500"
															: ""
													}
												>
													{
														refreshStatusData.status.lastRefreshResults.sgb
															.count
													}
													{refreshStatusData.status.lastRefreshResults.sgb
														.error && " (error)"}
												</span>
											</div>
											<div className="flex justify-between">
												<span>Tax-Free:</span>
												<span
													className={
														refreshStatusData.status.lastRefreshResults.taxFree
															.error
															? "text-red-500"
															: ""
													}
												>
													{
														refreshStatusData.status.lastRefreshResults.taxFree
															.count
													}
													{refreshStatusData.status.lastRefreshResults.taxFree
														.error && " (error)"}
												</span>
											</div>
											<div className="flex justify-between">
												<span>Infrastructure:</span>
												<span
													className={
														refreshStatusData.status.lastRefreshResults
															.infrastructure.error
															? "text-red-500"
															: ""
													}
												>
													{
														refreshStatusData.status.lastRefreshResults
															.infrastructure.count
													}
													{refreshStatusData.status.lastRefreshResults
														.infrastructure.error && " (error)"}
												</span>
											</div>
										</div>
									)}
								</CardContent>
							</Card>

							<Card>
								<CardHeader>
									<CardTitle className="flex items-center gap-2">
										<RefreshCw className="h-5 w-5" />
										Manual Refresh
									</CardTitle>
									<CardDescription>
										Trigger immediate data refresh from exchange APIs
									</CardDescription>
								</CardHeader>
								<CardContent className="space-y-4">
									<Button
										className="w-full"
										onClick={() => refreshAllMutation.mutate()}
										disabled={
											refreshAllMutation.isPending ||
											refreshStatusData?.status?.isRefreshing
										}
									>
										{refreshAllMutation.isPending ? (
											<Loader2 className="h-4 w-4 mr-2 animate-spin" />
										) : (
											<RefreshCw className="h-4 w-4 mr-2" />
										)}
										Refresh All Bond Data
									</Button>
									<div className="grid grid-cols-2 gap-2">
										<Button
											variant="outline"
											size="sm"
											onClick={() => refreshCategoryMutation.mutate("gsec")}
											disabled={refreshCategoryMutation.isPending}
										>
											G-Secs
										</Button>
										<Button
											variant="outline"
											size="sm"
											onClick={() => refreshCategoryMutation.mutate("sgb")}
											disabled={refreshCategoryMutation.isPending}
										>
											SGBs
										</Button>
										<Button
											variant="outline"
											size="sm"
											onClick={() =>
												refreshCategoryMutation.mutate("corporate")
											}
											disabled={refreshCategoryMutation.isPending}
										>
											Corporate
										</Button>
										<Button
											variant="outline"
											size="sm"
											onClick={() => refreshCategoryMutation.mutate("tax-free")}
											disabled={refreshCategoryMutation.isPending}
										>
											Tax-Free
										</Button>
										<Button
											variant="outline"
											size="sm"
											onClick={() =>
												refreshCategoryMutation.mutate("infrastructure")
											}
											disabled={refreshCategoryMutation.isPending}
											className="col-span-2"
										>
											Infrastructure Bonds
										</Button>
									</div>
								</CardContent>
							</Card>
						</div>

						<Alert>
							<Activity className="h-4 w-4" />
							<AlertDescription>
								<strong>Data Sources:</strong> Government securities from NSE
								NCB API, Corporate bonds from BSE Bond Platform. Auto-refresh
								interval: 1 hour. Manual refresh available anytime.
							</AlertDescription>
						</Alert>
					</div>
				</TabsContent>

				<TabsContent value="audit" className="mt-6">
					{renderAuditLogs()}
				</TabsContent>
			</Tabs>

			<Dialog
				open={publishDialog.open}
				onOpenChange={(open) => setPublishDialog({ ...publishDialog, open })}
			>
				<DialogContent className="max-w-3xl max-h-[80vh] overflow-hidden flex flex-col">
					<DialogHeader>
						<DialogTitle>Publish Bonds to Marketplace</DialogTitle>
						<DialogDescription>
							Review fee structure and net yields before publishing. Bonds will
							be visible to clients with appropriate KYC tier.
						</DialogDescription>
					</DialogHeader>

					<div className="flex items-center gap-4 py-2 border-b">
						<Label className="text-sm font-medium">Investor Segment:</Label>
						<Select
							value={selectedSegment}
							onValueChange={(v) =>
								handleSegmentChange(v as "retail" | "hni" | "institutional")
							}
						>
							<SelectTrigger
								className="w-[180px]"
								data-testid="select-investor-segment"
							>
								<SelectValue />
							</SelectTrigger>
							<SelectContent>
								<SelectItem value="retail">Retail</SelectItem>
								<SelectItem value="hni">HNI</SelectItem>
								<SelectItem value="institutional">Institutional</SelectItem>
							</SelectContent>
						</Select>
						{fetchNetYieldsMutation.isPending && (
							<Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
						)}
					</div>

					<ScrollArea className="flex-1 pr-4">
						<div className="space-y-4 py-4">
							{publishDialog.bonds.map((bond) => {
								const profile = getFeeProfileForType(bond.instrumentType);
								const yieldData = netYields[bond.id];
								return (
									<Card key={bond.id} className="p-4">
										<div className="flex justify-between items-start">
											<div>
												<h4 className="font-medium">{bond.bondName}</h4>
												<p className="text-sm text-muted-foreground">
													{bond.isin} | {bond.issuerName}
												</p>
											</div>
											<Badge className={KYC_TIER_COLORS[bond.kycTierRequired]}>
												{bond.kycTierRequired} KYC required
											</Badge>
										</div>

										{yieldData && (
											<div className="mt-3 pt-3 border-t">
												<div className="flex items-center gap-2 mb-3">
													<TrendingUp className="h-4 w-4 text-primary" />
													<span className="text-sm font-medium">
														Net Yield Analysis
													</span>
													{!yieldData.regulatoryCompliant && (
														<Badge variant="destructive" className="ml-auto">
															<AlertTriangle className="h-3 w-3 mr-1" />
															Compliance Issue
														</Badge>
													)}
												</div>
												<div className="grid grid-cols-4 gap-4 text-sm">
													<div className="bg-muted/50 p-2 rounded">
														<p className="text-muted-foreground text-xs">
															Gross YTM
														</p>
														<p className="font-mono text-lg font-semibold text-green-600 dark:text-green-400">
															{yieldData.grossYield.toFixed(2)}%
														</p>
													</div>
													<div className="bg-muted/50 p-2 rounded">
														<p className="text-muted-foreground text-xs">
															Fee Impact
														</p>
														<p className="font-mono text-lg font-semibold text-amber-600 dark:text-amber-400">
															-{yieldData.feeImpactBps} bps
														</p>
													</div>
													<div className="bg-muted/50 p-2 rounded">
														<p className="text-muted-foreground text-xs">
															Net Yield
														</p>
														<p className="font-mono text-lg font-semibold text-blue-600 dark:text-blue-400">
															{yieldData.netYield.toFixed(2)}%
														</p>
													</div>
													<div className="bg-muted/50 p-2 rounded">
														<p className="text-muted-foreground text-xs">
															After Tax (30%)
														</p>
														<p className="font-mono text-lg font-semibold">
															{yieldData.netYieldAfterTax.toFixed(2)}%
														</p>
													</div>
												</div>
												<div className="mt-2 grid grid-cols-5 gap-2 text-xs text-muted-foreground">
													<div>
														<span className="block">Platform</span>
														<span className="font-mono">
															{yieldData.breakdown.platformFeeAnnualized.toFixed(
																4,
															)}
															%
														</span>
													</div>
													<div>
														<span className="block">Brokerage</span>
														<span className="font-mono">
															{yieldData.breakdown.brokerageFeeAnnualized.toFixed(
																4,
															)}
															%
														</span>
													</div>
													<div>
														<span className="block">Txn Charges</span>
														<span className="font-mono">
															{yieldData.breakdown.transactionChargesAnnualized.toFixed(
																4,
															)}
															%
														</span>
													</div>
													<div>
														<span className="block">GST</span>
														<span className="font-mono">
															{yieldData.breakdown.gstAnnualized.toFixed(4)}%
														</span>
													</div>
													<div>
														<span className="block">Stamp Duty</span>
														<span className="font-mono">
															{yieldData.breakdown.stampDutyAnnualized.toFixed(
																4,
															)}
															%
														</span>
													</div>
												</div>
												{yieldData.violations.length > 0 && (
													<Alert variant="destructive" className="mt-3">
														<AlertTriangle className="h-4 w-4" />
														<AlertDescription>
															{yieldData.violations.join("; ")}
														</AlertDescription>
													</Alert>
												)}
											</div>
										)}

										{!yieldData && profile && (
											<div className="mt-3 pt-3 border-t grid grid-cols-3 gap-4 text-sm">
												<div>
													<p className="text-muted-foreground">
														Retail Brokerage
													</p>
													<p className="font-mono">
														{Number.parseFloat(
															profile.retailBrokerageRate,
														).toFixed(3)}
														% + GST
													</p>
												</div>
												<div>
													<p className="text-muted-foreground">HNI Brokerage</p>
													<p className="font-mono">
														{Number.parseFloat(
															profile.hniBrokerageRate,
														).toFixed(3)}
														% + GST
													</p>
												</div>
												<div>
													<p className="text-muted-foreground">Platform Fee</p>
													<p className="font-mono">
														{Number.parseFloat(profile.platformFeeRate).toFixed(
															2,
														)}
														%
													</p>
												</div>
											</div>
										)}
									</Card>
								);
							})}
						</div>
					</ScrollArea>
					<DialogFooter className="pt-4 border-t">
						<Button
							variant="outline"
							onClick={() => setPublishDialog({ open: false, bonds: [] })}
						>
							Cancel
						</Button>
						<Button
							onClick={() =>
								publishBondsMutation.mutate(
									publishDialog.bonds.map((b) => b.id),
								)
							}
							disabled={publishBondsMutation.isPending}
							data-testid="button-confirm-publish"
						>
							{publishBondsMutation.isPending ? (
								<Loader2 className="h-4 w-4 mr-2 animate-spin" />
							) : (
								<Check className="h-4 w-4 mr-2" />
							)}
							Confirm Publish ({publishDialog.bonds.length})
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>

			<Dialog open={unlisistedDialog} onOpenChange={setUnlistedDialog}>
				<DialogContent className="max-w-xl">
					<DialogHeader>
						<DialogTitle>Add Unlisted Bond</DialogTitle>
						<DialogDescription>
							Manually add an unlisted bond to the catalog. It will be created
							as a draft.
						</DialogDescription>
					</DialogHeader>
					<div className="grid grid-cols-2 gap-4 py-4">
						<div className="space-y-2">
							<Label>ISIN</Label>
							<Input
								value={newUnlistedBond.isin}
								onChange={(e) =>
									setNewUnlistedBond({
										...newUnlistedBond,
										isin: e.target.value,
									})
								}
								placeholder="INE..."
								data-testid="input-isin"
							/>
						</div>
						<div className="space-y-2">
							<Label>Instrument Type</Label>
							<Select
								value={newUnlistedBond.instrumentType}
								onValueChange={(v) =>
									setNewUnlistedBond({ ...newUnlistedBond, instrumentType: v })
								}
							>
								<SelectTrigger data-testid="select-instrument-type">
									<SelectValue />
								</SelectTrigger>
								<SelectContent>
									{INSTRUMENT_TYPES.filter(
										(t) => t.category === "corporate",
									).map((t) => (
										<SelectItem key={t.value} value={t.value}>
											{t.label}
										</SelectItem>
									))}
								</SelectContent>
							</Select>
						</div>
						<div className="col-span-2 space-y-2">
							<Label>Bond Name</Label>
							<Input
								value={newUnlistedBond.bondName}
								onChange={(e) =>
									setNewUnlistedBond({
										...newUnlistedBond,
										bondName: e.target.value,
									})
								}
								placeholder="Company Name 8.5% NCD 2028"
								data-testid="input-bond-name"
							/>
						</div>
						<div className="col-span-2 space-y-2">
							<Label>Issuer Name</Label>
							<Input
								value={newUnlistedBond.issuerName}
								onChange={(e) =>
									setNewUnlistedBond({
										...newUnlistedBond,
										issuerName: e.target.value,
									})
								}
								placeholder="Company Name Ltd"
								data-testid="input-issuer-name"
							/>
						</div>
						<div className="space-y-2">
							<Label>Face Value (₹)</Label>
							<Input
								value={newUnlistedBond.faceValue}
								onChange={(e) =>
									setNewUnlistedBond({
										...newUnlistedBond,
										faceValue: e.target.value,
									})
								}
								type="number"
								data-testid="input-face-value"
							/>
						</div>
						<div className="space-y-2">
							<Label>Coupon Rate (%)</Label>
							<Input
								value={newUnlistedBond.couponRate}
								onChange={(e) =>
									setNewUnlistedBond({
										...newUnlistedBond,
										couponRate: e.target.value,
									})
								}
								type="number"
								step="0.01"
								data-testid="input-coupon-rate"
							/>
						</div>
						<div className="space-y-2">
							<Label>Maturity Date</Label>
							<Input
								value={newUnlistedBond.maturityDate}
								onChange={(e) =>
									setNewUnlistedBond({
										...newUnlistedBond,
										maturityDate: e.target.value,
									})
								}
								type="date"
								data-testid="input-maturity-date"
							/>
						</div>
						<div className="space-y-2">
							<Label>YTM (%)</Label>
							<Input
								value={newUnlistedBond.yieldToMaturity}
								onChange={(e) =>
									setNewUnlistedBond({
										...newUnlistedBond,
										yieldToMaturity: e.target.value,
									})
								}
								type="number"
								step="0.01"
								data-testid="input-ytm"
							/>
						</div>
						<div className="space-y-2">
							<Label>Min Investment (₹)</Label>
							<Input
								value={newUnlistedBond.minInvestment}
								onChange={(e) =>
									setNewUnlistedBond({
										...newUnlistedBond,
										minInvestment: e.target.value,
									})
								}
								type="number"
								data-testid="input-min-investment"
							/>
						</div>
						<div className="space-y-2">
							<Label>Lot Size</Label>
							<Input
								value={newUnlistedBond.lotSize}
								onChange={(e) =>
									setNewUnlistedBond({
										...newUnlistedBond,
										lotSize: Number.parseInt(e.target.value) || 1,
									})
								}
								type="number"
								data-testid="input-lot-size"
							/>
						</div>
						<div className="space-y-2">
							<Label>Credit Rating</Label>
							<Select
								value={newUnlistedBond.creditRating}
								onValueChange={(v) =>
									setNewUnlistedBond({ ...newUnlistedBond, creditRating: v })
								}
							>
								<SelectTrigger data-testid="select-credit-rating">
									<SelectValue placeholder="Select rating" />
								</SelectTrigger>
								<SelectContent>
									{[
										"AAA",
										"AA+",
										"AA",
										"AA-",
										"A+",
										"A",
										"A-",
										"BBB+",
										"BBB",
										"BBB-",
										"BB+",
										"BB",
										"Below BB",
									].map((r) => (
										<SelectItem key={r} value={r}>
											{r}
										</SelectItem>
									))}
								</SelectContent>
							</Select>
						</div>
						<div className="space-y-2">
							<Label>Rating Agency</Label>
							<Select
								value={newUnlistedBond.ratingAgency}
								onValueChange={(v) =>
									setNewUnlistedBond({ ...newUnlistedBond, ratingAgency: v })
								}
							>
								<SelectTrigger data-testid="select-rating-agency">
									<SelectValue placeholder="Select agency" />
								</SelectTrigger>
								<SelectContent>
									{["CRISIL", "ICRA", "CARE", "India Ratings", "Brickwork"].map(
										(a) => (
											<SelectItem key={a} value={a}>
												{a}
											</SelectItem>
										),
									)}
								</SelectContent>
							</Select>
						</div>
					</div>
					<DialogFooter>
						<Button variant="outline" onClick={() => setUnlistedDialog(false)}>
							Cancel
						</Button>
						<Button
							onClick={() => createUnlistedBondMutation.mutate(newUnlistedBond)}
							disabled={
								createUnlistedBondMutation.isPending ||
								!newUnlistedBond.isin ||
								!newUnlistedBond.bondName
							}
							data-testid="button-create-unlisted"
						>
							{createUnlistedBondMutation.isPending ? (
								<Loader2 className="h-4 w-4 mr-2 animate-spin" />
							) : (
								<Plus className="h-4 w-4 mr-2" />
							)}
							Create Draft
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>

			{/* ISIN Seed Dialog */}
			<Dialog
				open={isinSeedDialog}
				onOpenChange={(open) => {
					setIsinSeedDialog(open);
					if (!open) {
						setIsinInput("");
						setIsinLookupResult(null);
						setBulkIsinInput("");
						setBulkIsinTab("single");
					}
				}}
			>
				<DialogContent className="max-w-2xl">
					<DialogHeader>
						<DialogTitle className="flex items-center gap-2">
							<FileText className="h-5 w-5" />
							Seed Bonds from ISIN
						</DialogTitle>
						<DialogDescription>
							Look up bond details from NSDL using ISIN and add to catalog
							automatically.
						</DialogDescription>
					</DialogHeader>

					<Tabs
						value={bulkIsinTab}
						onValueChange={(v) => setBulkIsinTab(v as "single" | "bulk")}
					>
						<TabsList className="grid w-full grid-cols-2">
							<TabsTrigger value="single" data-testid="tab-single-isin">
								Single ISIN
							</TabsTrigger>
							<TabsTrigger value="bulk" data-testid="tab-bulk-isin">
								Bulk ISINs
							</TabsTrigger>
						</TabsList>

						<TabsContent value="single" className="space-y-4">
							<div className="flex gap-2">
								<Input
									placeholder="Enter ISIN (e.g., INE001A08012)"
									value={isinInput}
									onChange={(e) => setIsinInput(e.target.value.toUpperCase())}
									className="flex-1"
									data-testid="input-isin-lookup"
								/>
								<Button
									onClick={handleIsinLookup}
									disabled={
										isinInput.length < 12 || isinLookupMutation.isPending
									}
									data-testid="button-lookup-isin"
								>
									{isinLookupMutation.isPending ? (
										<Loader2 className="h-4 w-4 animate-spin" />
									) : (
										<Search className="h-4 w-4" />
									)}
								</Button>
							</div>

							{isinLookupResult && (
								<div className="space-y-4">
									{isinLookupResult.alreadyInCatalog ? (
										<Alert>
											<AlertTriangle className="h-4 w-4" />
											<AlertDescription>
												This ISIN already exists in the catalog as "
												{isinLookupResult.existingEntry?.bondName}"
											</AlertDescription>
										</Alert>
									) : (
										<>
											<Card className="p-4 bg-muted/50">
												<h4 className="font-medium mb-2">
													Bond Details from NSDL
												</h4>
												<div className="grid grid-cols-2 gap-2 text-sm">
													<div>
														<span className="text-muted-foreground">ISIN:</span>
														<span className="ml-2 font-mono">
															{isinLookupResult.bondData.isin}
														</span>
													</div>
													<div>
														<span className="text-muted-foreground">Type:</span>
														<Badge variant="outline" className="ml-2">
															{isinLookupResult.bondData.instrumentType}
														</Badge>
													</div>
													<div className="col-span-2">
														<span className="text-muted-foreground">
															Issuer:
														</span>
														<span className="ml-2">
															{isinLookupResult.bondData.issuerName}
														</span>
													</div>
													<div className="col-span-2">
														<span className="text-muted-foreground">
															Description:
														</span>
														<span className="ml-2">
															{isinLookupResult.bondData.securityDescription}
														</span>
													</div>
													{isinLookupResult.bondData.interestRate && (
														<div>
															<span className="text-muted-foreground">
																Interest Rate:
															</span>
															<span className="ml-2">
																{isinLookupResult.bondData.interestRate}
															</span>
														</div>
													)}
													{isinLookupResult.bondData.maturityDate && (
														<div>
															<span className="text-muted-foreground">
																Maturity:
															</span>
															<span className="ml-2">
																{isinLookupResult.bondData.maturityDate}
															</span>
														</div>
													)}
												</div>
											</Card>

											<div className="space-y-3">
												<h4 className="font-medium">
													Override Details (Optional)
												</h4>
												<div className="grid grid-cols-2 gap-3">
													<div className="space-y-1">
														<Label className="text-xs">Bond Name</Label>
														<Input
															value={isinOverrides.bondName}
															onChange={(e) =>
																setIsinOverrides({
																	...isinOverrides,
																	bondName: e.target.value,
																})
															}
															placeholder="Override bond name"
															data-testid="input-override-bond-name"
														/>
													</div>
													<div className="space-y-1">
														<Label className="text-xs">Instrument Type</Label>
														<Select
															value={isinOverrides.instrumentType}
															onValueChange={(v) =>
																setIsinOverrides({
																	...isinOverrides,
																	instrumentType: v,
																})
															}
														>
															<SelectTrigger data-testid="select-override-instrument-type">
																<SelectValue placeholder="Auto-detected" />
															</SelectTrigger>
															<SelectContent>
																{INSTRUMENT_TYPES.map((t) => (
																	<SelectItem key={t.value} value={t.value}>
																		{t.label}
																	</SelectItem>
																))}
															</SelectContent>
														</Select>
													</div>
													<div className="space-y-1">
														<Label className="text-xs">YTM (%)</Label>
														<Input
															value={isinOverrides.yieldToMaturity}
															onChange={(e) =>
																setIsinOverrides({
																	...isinOverrides,
																	yieldToMaturity: e.target.value,
																})
															}
															type="number"
															step="0.01"
															placeholder="Current yield"
															data-testid="input-override-ytm"
														/>
													</div>
													<div className="space-y-1">
														<Label className="text-xs">Credit Rating</Label>
														<Select
															value={isinOverrides.creditRating}
															onValueChange={(v) =>
																setIsinOverrides({
																	...isinOverrides,
																	creditRating: v,
																})
															}
														>
															<SelectTrigger data-testid="select-override-credit-rating">
																<SelectValue placeholder="Select rating" />
															</SelectTrigger>
															<SelectContent>
																{[
																	"Sovereign",
																	"AAA",
																	"AA+",
																	"AA",
																	"AA-",
																	"A+",
																	"A",
																	"A-",
																	"BBB+",
																	"BBB",
																	"BBB-",
																].map((r) => (
																	<SelectItem key={r} value={r}>
																		{r}
																	</SelectItem>
																))}
															</SelectContent>
														</Select>
													</div>
													<div className="space-y-1">
														<Label className="text-xs">
															Min Investment (₹)
														</Label>
														<Input
															value={isinOverrides.minInvestment}
															onChange={(e) =>
																setIsinOverrides({
																	...isinOverrides,
																	minInvestment: e.target.value,
																})
															}
															type="number"
															data-testid="input-override-min-investment"
														/>
													</div>
													<div className="space-y-1">
														<Label className="text-xs">KYC Tier</Label>
														<Select
															value={isinOverrides.kycTierRequired}
															onValueChange={(v) =>
																setIsinOverrides({
																	...isinOverrides,
																	kycTierRequired: v,
																})
															}
														>
															<SelectTrigger data-testid="select-override-kyc-tier">
																<SelectValue />
															</SelectTrigger>
															<SelectContent>
																<SelectItem value="basic">Basic</SelectItem>
																<SelectItem value="enhanced">
																	Enhanced
																</SelectItem>
																<SelectItem value="accredited">
																	Accredited
																</SelectItem>
															</SelectContent>
														</Select>
													</div>
												</div>
											</div>

											<DialogFooter className="flex gap-2">
												<Button
													variant="outline"
													onClick={() => setIsinSeedDialog(false)}
												>
													Cancel
												</Button>
												<Button
													variant="secondary"
													onClick={() => handleSeedFromIsin(false)}
													disabled={seedFromIsinMutation.isPending}
													data-testid="button-seed-draft"
												>
													{seedFromIsinMutation.isPending ? (
														<Loader2 className="h-4 w-4 mr-2 animate-spin" />
													) : (
														<Plus className="h-4 w-4 mr-2" />
													)}
													Save as Draft
												</Button>
												<Button
													onClick={() => handleSeedFromIsin(true)}
													disabled={seedFromIsinMutation.isPending}
													data-testid="button-seed-publish"
												>
													{seedFromIsinMutation.isPending ? (
														<Loader2 className="h-4 w-4 mr-2 animate-spin" />
													) : (
														<Check className="h-4 w-4 mr-2" />
													)}
													Seed & Publish
												</Button>
											</DialogFooter>
										</>
									)}
								</div>
							)}
						</TabsContent>

						<TabsContent value="bulk" className="space-y-4">
							<div className="space-y-2">
								<Label>Enter ISINs (one per line or comma-separated)</Label>
								<textarea
									className="w-full h-40 p-3 text-sm font-mono border rounded-md bg-background"
									placeholder="INE001A08012&#10;INE002A08020&#10;INE003A08030"
									value={bulkIsinInput}
									onChange={(e) =>
										setBulkIsinInput(e.target.value.toUpperCase())
									}
									data-testid="textarea-bulk-isin"
								/>
								<p className="text-xs text-muted-foreground">
									{
										bulkIsinInput
											.split(/[\n,]+/)
											.filter((s) => s.trim().length >= 12).length
									}{" "}
									valid ISINs detected
								</p>
							</div>

							<Alert>
								<AlertTriangle className="h-4 w-4" />
								<AlertDescription>
									Bulk seeding will automatically detect bond type and apply
									default settings. Existing ISINs will be skipped.
								</AlertDescription>
							</Alert>

							<DialogFooter className="flex gap-2">
								<Button
									variant="outline"
									onClick={() => setIsinSeedDialog(false)}
								>
									Cancel
								</Button>
								<Button
									variant="secondary"
									onClick={() => handleBulkSeed(false)}
									disabled={bulkSeedFromIsinMutation.isPending}
									data-testid="button-bulk-seed-draft"
								>
									{bulkSeedFromIsinMutation.isPending ? (
										<Loader2 className="h-4 w-4 mr-2 animate-spin" />
									) : (
										<Upload className="h-4 w-4 mr-2" />
									)}
									Bulk Seed as Draft
								</Button>
								<Button
									onClick={() => handleBulkSeed(true)}
									disabled={bulkSeedFromIsinMutation.isPending}
									data-testid="button-bulk-seed-publish"
								>
									{bulkSeedFromIsinMutation.isPending ? (
										<Loader2 className="h-4 w-4 mr-2 animate-spin" />
									) : (
										<Check className="h-4 w-4 mr-2" />
									)}
									Bulk Seed & Publish
								</Button>
							</DialogFooter>
						</TabsContent>
					</Tabs>
				</DialogContent>
			</Dialog>

			<Dialog
				open={feeOverrideDialog.open}
				onOpenChange={(open) => {
					setFeeOverrideDialog({ ...feeOverrideDialog, open });
					if (!open) {
						setFeeOverride({
							platformFeeOverride: "",
							brokerageFeeOverride: "",
							transactionChargesOverride: "",
							overrideReason: "",
						});
						setOverrideNetYield(null);
					}
				}}
			>
				<DialogContent className="max-w-2xl">
					<DialogHeader>
						<DialogTitle>Custom Fee Override</DialogTitle>
						<DialogDescription>
							Set custom fees for this bond. Net yield will be recalculated
							automatically.
						</DialogDescription>
					</DialogHeader>

					{feeOverrideDialog.bond && (
						<div className="space-y-6 py-4">
							<div className="p-3 bg-muted rounded-lg">
								<h4 className="font-medium">
									{feeOverrideDialog.bond.bondName}
								</h4>
								<p className="text-sm text-muted-foreground">
									{feeOverrideDialog.bond.isin} |{" "}
									{feeOverrideDialog.bond.issuerName}
								</p>
								<div className="mt-2 flex gap-4 text-sm">
									<span>
										Gross YTM:{" "}
										<strong>{feeOverrideDialog.bond.yieldToMaturity}%</strong>
									</span>
									<span>
										Type:{" "}
										<strong>{feeOverrideDialog.bond.instrumentType}</strong>
									</span>
								</div>
							</div>

							<div className="grid grid-cols-3 gap-4">
								<div className="space-y-2">
									<Label>Platform Fee Override (%)</Label>
									<Input
										value={feeOverride.platformFeeOverride}
										onChange={(e) =>
											setFeeOverride({
												...feeOverride,
												platformFeeOverride: e.target.value,
											})
										}
										type="number"
										step="0.001"
										placeholder="Leave blank for default"
										data-testid="input-platform-fee-override"
									/>
								</div>
								<div className="space-y-2">
									<Label>Brokerage Override (%)</Label>
									<Input
										value={feeOverride.brokerageFeeOverride}
										onChange={(e) =>
											setFeeOverride({
												...feeOverride,
												brokerageFeeOverride: e.target.value,
											})
										}
										type="number"
										step="0.001"
										placeholder="Leave blank for default"
										data-testid="input-brokerage-override"
									/>
								</div>
								<div className="space-y-2">
									<Label>Txn Charges Override (%)</Label>
									<Input
										value={feeOverride.transactionChargesOverride}
										onChange={(e) =>
											setFeeOverride({
												...feeOverride,
												transactionChargesOverride: e.target.value,
											})
										}
										type="number"
										step="0.001"
										placeholder="Leave blank for default"
										data-testid="input-txn-charges-override"
									/>
								</div>
							</div>

							<div className="space-y-2">
								<Label>
									Override Reason <span className="text-red-500">*</span>
								</Label>
								<Input
									value={feeOverride.overrideReason}
									onChange={(e) =>
										setFeeOverride({
											...feeOverride,
											overrideReason: e.target.value,
										})
									}
									placeholder="Reason for custom fee override (required for audit)"
									data-testid="input-override-reason"
								/>
							</div>

							<Button
								variant="outline"
								onClick={() => {
									if (feeOverrideDialog.bond) {
										previewOverrideNetYieldMutation.mutate({
											bond: feeOverrideDialog.bond,
											override: feeOverride,
										});
									}
								}}
								disabled={previewOverrideNetYieldMutation.isPending}
								data-testid="button-preview-net-yield"
							>
								{previewOverrideNetYieldMutation.isPending ? (
									<Loader2 className="h-4 w-4 mr-2 animate-spin" />
								) : (
									<TrendingUp className="h-4 w-4 mr-2" />
								)}
								Preview Net Yield
							</Button>

							{overrideNetYield && (
								<div className="p-4 border rounded-lg bg-muted/30">
									<h5 className="text-sm font-medium mb-3 flex items-center gap-2">
										<TrendingUp className="h-4 w-4 text-primary" />
										Net Yield Preview (with overrides)
									</h5>
									<div className="grid grid-cols-4 gap-4 text-sm">
										<div className="bg-card p-2 rounded">
											<p className="text-muted-foreground text-xs">Gross YTM</p>
											<p className="font-mono text-lg font-semibold text-green-600 dark:text-green-400">
												{overrideNetYield.grossYield.toFixed(2)}%
											</p>
										</div>
										<div className="bg-card p-2 rounded">
											<p className="text-muted-foreground text-xs">
												Fee Impact
											</p>
											<p className="font-mono text-lg font-semibold text-amber-600 dark:text-amber-400">
												-{overrideNetYield.feeImpactBps} bps
											</p>
										</div>
										<div className="bg-card p-2 rounded">
											<p className="text-muted-foreground text-xs">Net Yield</p>
											<p className="font-mono text-lg font-semibold text-blue-600 dark:text-blue-400">
												{overrideNetYield.netYield.toFixed(2)}%
											</p>
										</div>
										<div className="bg-card p-2 rounded">
											<p className="text-muted-foreground text-xs">
												After Tax (30%)
											</p>
											<p className="font-mono text-lg font-semibold">
												{overrideNetYield.netYieldAfterTax.toFixed(2)}%
											</p>
										</div>
									</div>
									{!overrideNetYield.regulatoryCompliant && (
										<Alert variant="destructive" className="mt-3">
											<AlertTriangle className="h-4 w-4" />
											<AlertDescription>
												{overrideNetYield.violations.join("; ")}
											</AlertDescription>
										</Alert>
									)}
								</div>
							)}
						</div>
					)}

					<DialogFooter>
						<Button
							variant="outline"
							onClick={() => setFeeOverrideDialog({ open: false, bond: null })}
						>
							Cancel
						</Button>
						<Button
							onClick={() => {
								if (feeOverrideDialog.bond) {
									createFeeOverrideMutation.mutate({
										bond: feeOverrideDialog.bond,
										override: feeOverride,
									});
								}
							}}
							disabled={
								createFeeOverrideMutation.isPending ||
								!feeOverride.overrideReason
							}
							data-testid="button-save-override"
						>
							{createFeeOverrideMutation.isPending ? (
								<Loader2 className="h-4 w-4 mr-2 animate-spin" />
							) : (
								<Check className="h-4 w-4 mr-2" />
							)}
							Save Override
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>
		</div>
	);
}
