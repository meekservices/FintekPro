import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
	Form,
	FormControl,
	FormField,
	FormItem,
	FormLabel,
	FormMessage,
} from "@/components/ui/form";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import {
	Dialog,
	DialogContent,
	DialogHeader,
	DialogTitle,
	DialogFooter,
	DialogDescription,
	DialogTrigger,
} from "@/components/ui/dialog";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { LoadingState } from "@/components/LoadingState";
import {
	Building2,
	FileText,
	Clock,
	CheckCircle2,
	XCircle,
	AlertCircle,
	IndianRupee,
	User,
	Phone,
	Mail,
	Briefcase,
	ArrowRight,
	Loader2,
	TrendingUp,
	Users,
	Plus,
	Search,
	Send,
	Trash2,
	Eye,
	MoreVertical,
	RefreshCw,
	DollarSign,
	Calendar,
	CreditCard,
	Upload,
	Shield as LucideShield,
	AlertTriangle,
	CheckCircle,
} from "lucide-react";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
	LoanProgressStepper,
	ProcessingTimeDisplay,
} from "@/components/loan/loan-progress-stepper";
import {
	DraftIndicator,
	RestorePrompt,
} from "@/components/loan/draft-indicator";
import { useFormAutosave } from "@/hooks/use-form-autosave";
import {
	LoanDocumentUpload,
	UploadedDocument,
} from "@/components/loan/document-upload";
import ProjectFinanceWizard from "@/components/loan/project-finance-wizard";

const loanSubTypeLabels: Record<string, string> = {
	BUILDER_FUNDING: "Builder Funding",
	PROJECT_FUNDING: "Project Funding",
	CONSTRUCTION_FINANCE: "Construction Finance",
	LRD: "Lease Rental Discounting",
	LAND_FINANCE: "Land Finance",
	INVENTORY_FINANCE: "Inventory Finance",
	MEZZANINE: "Mezzanine Finance",
	BRIDGE: "Bridge Loan",
};

const loanApplicationSchema = z.object({
	clientSource: z.enum(["existing", "new"]),
	existingClientId: z.string().optional(),
	loanType: z.enum([
		"personal",
		"home",
		"car",
		"business",
		"education",
		"gold",
		"lap",
	]),
	requestedAmount: z.string().min(1, "Amount is required"),
	requestedTenure: z.string().min(1, "Tenure is required"),
	applicantName: z.string().min(2, "Name is required"),
	applicantEmail: z
		.string()
		.email("Valid email required")
		.optional()
		.or(z.literal("")),
	applicantPhone: z
		.string()
		.regex(/^[6-9]\d{9}$/, "Valid 10-digit phone required"),
	dateOfBirth: z.string().optional(),
	applicantPan: z
		.string()
		.regex(/^[A-Z]{5}[0-9]{4}[A-Z]{1}$/, "Invalid PAN format")
		.optional()
		.or(z.literal("")),
	employmentType: z.enum([
		"salaried",
		"self_employed",
		"business",
		"professional",
	]),
	monthlyIncome: z.string().min(1, "Monthly income required"),
	creditScore: z.string().optional(),
	processingMode: z
		.enum(["PLATFORM", "EXTERNAL_FINANCIER"])
		.default("PLATFORM"),
	financierName: z.string().optional(),
	dsaCode: z.string().optional(),
	bankerName: z.string().optional(),
	bankerMobile: z.string().optional(),
	bankerEmail: z
		.string()
		.email("Valid email required")
		.optional()
		.or(z.literal("")),
	branch: z.string().optional(),
	rmName: z.string().optional(),
	rmEmail: z
		.string()
		.email("Valid email required")
		.optional()
		.or(z.literal("")),
	rmMobile: z.string().optional(),
	routingMode: z.enum(["auto", "manual"]).default("auto"),
	routingStrategy: z
		.enum(["parallel", "waterfall", "priority_first"])
		.default("parallel"),
	targetBanks: z.array(z.string()).optional(),
	loanPurpose: z.string().optional(),
});

type LoanApplicationForm = z.infer<typeof loanApplicationSchema>;

interface ClientOption {
	id: string;
	name: string;
	mobile: string;
	email?: string;
	pan?: string;
	type: "client" | "prospect";
}

const statusColors: Record<string, string> = {
	draft: "bg-muted text-foreground",
	submitted: "bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-200",
	eligibility_check:
		"bg-purple-100 dark:bg-purple-900/30 text-purple-800 dark:text-purple-200",
	routed:
		"bg-indigo-100 dark:bg-indigo-900/30 text-indigo-800 dark:text-indigo-200",
	pending_with_banks:
		"bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-200",
	in_review:
		"bg-orange-100 dark:bg-orange-900/30 text-orange-800 dark:text-orange-200",
	approved:
		"bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-200",
	rejected: "bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-200",
	disbursed:
		"bg-emerald-100 dark:bg-emerald-900/30 text-emerald-800 dark:text-emerald-200",
};

const LEAD_STATUS_FLOW = ["REGISTERED", "LOGGED_IN", "APPROVED", "DISBURSED"];

const LEAD_STATUS_COLORS: Record<string, string> = {
	REGISTERED:
		"bg-gray-500/20 text-gray-600 dark:text-gray-400 border-gray-500/30",
	LOGGED_IN: "bg-blue-500/20 text-blue-600 border-blue-500/30",
	APPROVED: "bg-yellow-500/20 text-yellow-600 border-yellow-500/30",
	DISBURSED: "bg-emerald-500/20 text-emerald-600 border-emerald-500/30",
};

const PROCESSING_MODE_COLORS: Record<string, string> = {
	PLATFORM: "bg-blue-500/20 text-blue-600 border-blue-500/30",
	EXTERNAL_FINANCIER: "bg-orange-500/20 text-orange-600 border-orange-500/30",
};

const CLAIM_STATUS_COLORS: Record<string, string> = {
	PENDING_VERIFICATION: "bg-yellow-500/20 text-yellow-600 border-yellow-500/30",
	CONFIRMED_BY_FINANCIER: "bg-blue-500/20 text-blue-600 border-blue-500/30",
	APPROVED: "bg-emerald-500/20 text-emerald-600 border-emerald-500/30",
	ON_HOLD_PDD: "bg-orange-500/20 text-orange-600 border-orange-500/30",
	REJECTED: "bg-red-500/20 text-red-600 border-red-500/30",
	CLAWED_BACK: "bg-red-500/20 text-red-600 border-red-500/30",
};

const loanTypeLabels: Record<string, string> = {
	personal: "Personal Loan",
	home: "Home Loan",
	car: "Car Loan",
	business: "Business Loan",
	education: "Education Loan",
	gold: "Gold Loan",
	lap: "Loan Against Property",
};

interface Bank {
	id: string;
	bankCode: string;
	bankName: string;
	supportedLoanTypes: string[];
	isActive: boolean;
}

interface EligibilityResult {
	bankCode: string;
	bankName: string;
	eligible: boolean;
	reasons: string[];
	matchScore: number;
	estimatedRate?: number;
}

interface RoutingHistoryItem {
	id: string;
	bankCode: string;
	bankStatus: string;
	submittedAt: string;
	responseReceivedAt?: string;
	approvedAmount?: string;
	approvedTenure?: number;
	offeredInterestRate?: string;
	rejectionReason?: string;
}

interface Lead {
	id: string;
	pan: string;
	mobile: string;
	customerName: string;
	loanType: string;
	approximateAmount?: number;
	processingMode?: string;
	status: string;
	firstTouchTimestamp: string;
	financierName?: string;
	bankerName?: string;
	bankerMobile?: string;
	bankerEmail?: string;
}

interface PayoutClaim {
	id: string;
	leadId: string;
	customerName?: string;
	financierName?: string;
	disbursementAmount: number;
	disbursementDate: string;
	loanAccountNumber?: string;
	pddStatus: string;
	pddExceptionAllowed?: boolean;
	subventionFlag?: boolean;
	teamCase?: boolean;
	teamMembers?: string;
	claimStatus: string;
	createdAt: string;
}

const bankStatusColors: Record<string, string> = {
	pending:
		"bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-200",
	in_review: "bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-200",
	approved:
		"bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-200",
	rejected: "bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-200",
	query_raised:
		"bg-orange-100 dark:bg-orange-900/30 text-orange-800 dark:text-orange-200",
};

const AGENT_ROLES = [
	"agent",
	"sub_agent",
	"master_agent",
	"associate",
	"district_associate",
	"field_associate",
];

export default function AgentLoanApplyPage() {
	const { toast } = useToast();
	const { user } = useAuth();
	const userRolesAll = user?.roles || [];
	const userRole = userRolesAll[0] || "";
	const isAgent = userRolesAll.some((r: string) => AGENT_ROLES.includes(r));
	const [activeTab, setActiveTab] = useState("apply");
	const [loanVertical, setLoanVertical] = useState<
		"RETAIL" | "MSME" | "DEVELOPER"
	>("RETAIL");
	const [loanSubType, setLoanSubType] = useState<string>("");
	const [devAppId, setDevAppId] = useState<string>("");
	const [clientSource, setClientSource] = useState<"existing" | "new">("new");
	const [searchQuery, setSearchQuery] = useState("");
	const [devClientSource, setDevClientSource] = useState<"existing" | "new">(
		"new",
	);
	const [devSearchQuery, setDevSearchQuery] = useState("");
	const [devClientConfirmed, setDevClientConfirmed] = useState(false);
	const [devClientInfo, setDevClientInfo] = useState<{
		clientMode: "new" | "existing";
		clientId?: string;
		applicantName: string;
		applicantPhone: string;
		applicantEmail?: string;
		applicantPan?: string;
		employmentType: string;
		monthlyIncome: string;
	}>({
		clientMode: "new",
		applicantName: "",
		applicantPhone: "",
		applicantEmail: "",
		applicantPan: "",
		employmentType: "business",
		monthlyIncome: "",
	});
	const [routeDialogOpen, setRouteDialogOpen] = useState(false);
	const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
	const [detailsDialogOpen, setDetailsDialogOpen] = useState(false);
	const [eligibilityDialogOpen, setEligibilityDialogOpen] = useState(false);
	const [payoutClaimDialogOpen, setPayoutClaimDialogOpen] = useState(false);
	const [selectedApp, setSelectedApp] = useState<any>(null);
	const [selectedBanks, setSelectedBanks] = useState<string[]>([]);
	const [eligibilityResults, setEligibilityResults] = useState<
		EligibilityResult[]
	>([]);
	const [uploadedDocuments, setUploadedDocuments] = useState<
		UploadedDocument[]
	>([]);
	const [payoutClaimForm, setPayoutClaimForm] = useState({
		disbursementAmount: "",
		disbursementDate: "",
		loanAccountNumber: "",
		pddStatus: "NOT_APPLICABLE",
		pddExceptionAllowed: false,
		subventionFlag: false,
		teamCase: false,
		teamMembers: "",
	});
	const [auditDialogOpen, setAuditDialogOpen] = useState(false);
	const [auditLead, setAuditLead] = useState<Lead | null>(null);
	const [proofDialogOpen, setProofDialogOpen] = useState(false);
	const [financierQuery, setFinancierQuery] = useState("");
	const [financierDropdownOpen, setFinancierDropdownOpen] = useState(false);
	const [proofClaim, setProofClaim] = useState<PayoutClaim | null>(null);
	const [proofForm, setProofForm] = useState({
		fileName: "",
		fileType: "",
		fileSize: "",
		fileHash: "",
		storagePath: "",
	});

	const form = useForm<LoanApplicationForm, any, LoanApplicationForm>({
		resolver: zodResolver(loanApplicationSchema) as any,
		defaultValues: {
			clientSource: "new",
			loanType: "personal",
			requestedAmount: "",
			requestedTenure: "36",
			applicantName: "",
			applicantEmail: "",
			applicantPhone: "",
			dateOfBirth: "",
			applicantPan: "",
			employmentType: "salaried",
			monthlyIncome: "",
			creditScore: "",
			processingMode: "PLATFORM",
			financierName: "",
			dsaCode: "",
			bankerName: "",
			bankerMobile: "",
			bankerEmail: "",
			branch: "",
			rmName: "",
			rmEmail: "",
			rmMobile: "",
			routingMode: "auto",
			routingStrategy: "parallel",
			targetBanks: [],
			loanPurpose: "",
		},
	});

	const {
		showRestorePrompt,
		restoreDraft,
		discardDraft,
		clearDraft,
		formatLastSaved,
	} = useFormAutosave({
		form,
		storageKey: "fintekpro-agent-loan-draft",
		debounceMs: 1000,
		excludeFields: ["existingClientId"],
	});

	const { data: myClients, isLoading: loadingClients } = useQuery<
		ClientOption[]
	>({
		queryKey: ["/api/agent/clients-for-loan"],
		queryFn: async () => {
			const response = await fetch(
				"/api/admin/marketing/audience/all?filter=all&consentOnly=false",
			);
			if (!response.ok) return [];
			const data = await response.json();
			return data.map((c: any) => ({
				id: c.id,
				name: c.name,
				mobile: c.mobile,
				email: c.email,
				pan: c.pan,
				type: c.type,
			}));
		},
	});

	const {
		data: myApplications,
		isLoading: loadingApplications,
		refetch: refetchApplications,
	} = useQuery<any>({
		queryKey: ["/api/agent/loans/my-applications"],
		enabled: isAgent,
		retry: false,
	});

	const { data: banksData } = useQuery<{ success: boolean; data: Bank[] }>({
		queryKey: ["/api/dsa-loans/banks"],
	});

	const banks = banksData?.data || [];

	const { data: routingHistoryData, isLoading: loadingHistory } = useQuery<{
		success: boolean;
		data: RoutingHistoryItem[];
	}>({
		queryKey: [
			"/api/dsa-loans/applications",
			selectedApp?.id,
			"routing-history",
		],
		enabled: detailsDialogOpen && !!selectedApp?.id,
	});

	const routingHistory = routingHistoryData?.data || [];

	const isAgentOrPartner =
		user &&
		userRolesAll.some((r: string) =>
			["agent", "partner", "admin", "superadmin", "tester"].includes(r),
		);

	const { data: leads = [], isLoading: leadsLoading } = useQuery<Lead[]>({
		queryKey: ["/api/leads"],
		enabled: !!isAgentOrPartner,
	});

	const { data: claims = [], isLoading: claimsLoading } = useQuery<
		PayoutClaim[]
	>({
		queryKey: ["/api/payout-claims"],
		enabled: !!isAgentOrPartner,
	});

	const [bankerSearchQuery, setBankerSearchQuery] = useState("");
	const [excelUploading, setExcelUploading] = useState(false);
	const [addContactOpen, setAddContactOpen] = useState(false);

	const { data: bankerContactsData, isLoading: bankerContactsLoading } =
		useQuery<{
			success: boolean;
			data: Array<{
				id: string;
				financierName: string;
				dsaCode?: string;
				productNames?: string[];
				bankerName: string;
				bankerMobile?: string;
				bankerEmail?: string;
				branch?: string;
				rmName?: string;
				rmEmail?: string;
				rmMobile?: string;
				designation?: string;
				usageCount: number;
				lastUsedAt?: string;
				source?: string;
			}>;
			message?: string;
		}>({
			queryKey: ["/api/agent/loans/banker-contacts", bankerSearchQuery],
			queryFn: async () => {
				const params =
					bankerSearchQuery.length >= 3
						? `?search=${encodeURIComponent(bankerSearchQuery)}`
						: "";
				const res = await fetch(`/api/agent/loans/banker-contacts${params}`, {
					credentials: "include",
				});
				if (!res.ok) throw new Error("Failed to fetch contacts");
				return res.json();
			},
			enabled: !!isAgent,
		});
	const savedBankerContacts = bankerContactsData?.data || [];

	const {
		data: financierSuggestionsData,
		isLoading: financierSuggestionsLoading,
	} = useQuery<{
		success: boolean;
		data: Array<{
			name: string;
			type: string;
			source: string;
			dsaCode?: string;
		}>;
	}>({
		queryKey: [
			`/api/agent/loans/financier-suggestions?q=${encodeURIComponent(financierQuery)}`,
		],
		enabled: !!isAgent && financierQuery.length >= 1,
	});
	const financierSuggestions = financierSuggestionsData?.data || [];

	const routeMutation = useMutation({
		mutationFn: async ({
			applicationId,
			bankCodes,
		}: { applicationId: string; bankCodes: string[] }) => {
			return apiRequest(`/api/dsa-loans/applications/${applicationId}/route`, {
				method: "POST",
				body: JSON.stringify({ bankCodes, strategy: "parallel" }),
			});
		},
		onSuccess: (_data, variables) => {
			toast({
				title: "Banks Assigned",
				description: "Application has been routed to selected banks.",
			});
			queryClient.invalidateQueries({
				queryKey: ["/api/agent/loans/my-applications"],
			});
			queryClient.invalidateQueries({
				queryKey: [
					"/api/dsa-loans/applications",
					variables.applicationId,
					"routing-history",
				],
			});
			setRouteDialogOpen(false);
			setSelectedApp(null);
			setSelectedBanks([]);
		},
		onError: (error: any) => {
			toast({
				title: "Error",
				description: error.message || "Failed to route application",
				variant: "destructive",
			});
		},
	});

	const deleteMutation = useMutation({
		mutationFn: async (applicationId: string) => {
			return apiRequest(`/api/dsa-loans/applications/${applicationId}`, {
				method: "DELETE",
			});
		},
		onSuccess: () => {
			toast({
				title: "Application Deleted",
				description: "The loan application has been deleted.",
			});
			queryClient.invalidateQueries({
				queryKey: ["/api/agent/loans/my-applications"],
			});
			setDeleteDialogOpen(false);
			setSelectedApp(null);
		},
		onError: (error: any) => {
			toast({
				title: "Error",
				description: error.message || "Failed to delete application",
				variant: "destructive",
			});
		},
	});

	const checkEligibilityMutation = useMutation({
		mutationFn: async (applicationId: string) => {
			return apiRequest(
				`/api/dsa-loans/applications/${applicationId}/check-eligibility`,
				{
					method: "POST",
				},
			);
		},
		onSuccess: (data: any) => {
			setEligibilityResults([...data.data.eligible, ...data.data.ineligible]);
			setEligibilityDialogOpen(true);
			queryClient.invalidateQueries({
				queryKey: ["/api/agent/loans/my-applications"],
			});
		},
		onError: (error: any) => {
			toast({
				title: "Error",
				description: error.message || "Failed to check eligibility",
				variant: "destructive",
			});
		},
	});

	const createApplicationMutation = useMutation({
		mutationFn: async (data: LoanApplicationForm) => {
			const payload = {
				clientMode: data.clientSource,
				clientId: data.existingClientId || undefined,
				applicantName: data.applicantName,
				applicantPhone: data.applicantPhone,
				applicantEmail: data.applicantEmail || undefined,
				applicantPan: data.applicantPan || undefined,
				dateOfBirth: data.dateOfBirth || undefined,
				loanType: data.loanType,
				requestedAmount: Number.parseInt(data.requestedAmount),
				requestedTenure: Number.parseInt(data.requestedTenure),
				employmentType: data.employmentType,
				monthlyIncome: Number.parseInt(data.monthlyIncome),
				creditScore: data.creditScore
					? Number.parseInt(data.creditScore)
					: undefined,
				processingMode: data.processingMode,
				financierName:
					data.processingMode === "EXTERNAL_FINANCIER"
						? data.financierName
						: undefined,
				dsaCode:
					data.processingMode === "EXTERNAL_FINANCIER"
						? data.dsaCode || undefined
						: undefined,
				bankerName:
					data.processingMode === "EXTERNAL_FINANCIER"
						? data.bankerName || undefined
						: undefined,
				bankerMobile:
					data.processingMode === "EXTERNAL_FINANCIER"
						? data.bankerMobile || undefined
						: undefined,
				bankerEmail:
					data.processingMode === "EXTERNAL_FINANCIER" && data.bankerEmail
						? data.bankerEmail
						: undefined,
				branch:
					data.processingMode === "EXTERNAL_FINANCIER"
						? data.branch || undefined
						: undefined,
				rmName:
					data.processingMode === "EXTERNAL_FINANCIER"
						? data.rmName || undefined
						: undefined,
				rmMobile:
					data.processingMode === "EXTERNAL_FINANCIER"
						? data.rmMobile || undefined
						: undefined,
				rmEmail:
					data.processingMode === "EXTERNAL_FINANCIER" && data.rmEmail
						? data.rmEmail
						: undefined,
				routingMode:
					data.processingMode === "PLATFORM" ? data.routingMode : undefined,
				targetBanks:
					data.processingMode === "PLATFORM" && data.routingMode === "manual"
						? data.targetBanks
						: undefined,
				loanPurpose: data.loanPurpose || undefined,
			};
			return apiRequest("/api/agent/loans/applications", {
				method: "POST",
				body: JSON.stringify(payload),
			});
		},
		onSuccess: () => {
			toast({
				title: "Loan Lead Submitted",
				description: "The loan application has been submitted for processing.",
			});
			queryClient.invalidateQueries({
				queryKey: ["/api/agent/loans/my-applications"],
			});
			queryClient.invalidateQueries({
				queryKey: ["/api/agent/loans/banker-contacts"],
			});
			clearDraft();
			setUploadedDocuments([]);
			form.reset();
			setActiveTab("track");
		},
		onError: (error: any) => {
			toast({
				title: "Error",
				description: error.message || "Failed to submit application",
				variant: "destructive",
			});
		},
	});

	const submitPayoutClaimMutation = useMutation({
		mutationFn: async () => {
			if (!selectedApp) return;
			const leadId = selectedApp.leadRegistryId;
			if (!leadId)
				throw new Error("No lead registry ID found for this application");
			return apiRequest("/api/payout-claims", {
				method: "POST",
				body: JSON.stringify({
					leadId,
					disbursementAmount: Number(payoutClaimForm.disbursementAmount),
					disbursementDate: payoutClaimForm.disbursementDate,
					loanAccountNumber: payoutClaimForm.loanAccountNumber || undefined,
					financierName: selectedApp.financierName || "",
					pddStatus: payoutClaimForm.pddStatus,
					pddExceptionAllowed: payoutClaimForm.pddExceptionAllowed,
					subventionFlag: payoutClaimForm.subventionFlag,
					teamCase: payoutClaimForm.teamCase,
					teamMembers: payoutClaimForm.teamCase
						? payoutClaimForm.teamMembers
						: undefined,
				}),
			});
		},
		onSuccess: () => {
			toast({
				title: "Payout Claim Submitted",
				description: "Your payout claim has been submitted for review.",
			});
			setPayoutClaimDialogOpen(false);
			setPayoutClaimForm({
				disbursementAmount: "",
				disbursementDate: "",
				loanAccountNumber: "",
				pddStatus: "NOT_APPLICABLE",
				pddExceptionAllowed: false,
				subventionFlag: false,
				teamCase: false,
				teamMembers: "",
			});
			queryClient.invalidateQueries({
				queryKey: ["/api/agent/loans/my-applications"],
			});
			queryClient.invalidateQueries({ queryKey: ["/api/payout-claims"] });
		},
		onError: (error: any) => {
			toast({
				title: "Error",
				description: error.message || "Failed to submit payout claim",
				variant: "destructive",
			});
		},
	});

	const updateLeadStatusMutation = useMutation({
		mutationFn: ({ leadId, status }: { leadId: string; status: string }) =>
			apiRequest(`/api/leads/${leadId}/status`, {
				method: "PATCH",
				body: JSON.stringify({ status }),
			}),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ["/api/leads"] });
			toast({ title: "Lead status updated" });
		},
		onError: (err: any) => {
			toast({
				title: "Failed to update status",
				description: err.message,
				variant: "destructive",
			});
		},
	});

	const uploadProofMutation = useMutation({
		mutationFn: ({
			claimId,
			proof,
		}: { claimId: string; proof: typeof proofForm }) =>
			apiRequest(`/api/payout-claims/${claimId}/proof`, {
				method: "POST",
				body: JSON.stringify(proof),
			}),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ["/api/payout-claims"] });
			toast({ title: "Proof uploaded successfully" });
			setProofDialogOpen(false);
			setProofClaim(null);
			setProofForm({
				fileName: "",
				fileType: "",
				fileSize: "",
				fileHash: "",
				storagePath: "",
			});
		},
		onError: (err: any) => {
			toast({
				title: "Failed to upload proof",
				description: err.message,
				variant: "destructive",
			});
		},
	});

	const onSubmit = (data: LoanApplicationForm) => {
		createApplicationMutation.mutate(data);
	};

	const handleClientSelect = (clientId: string) => {
		const client = myClients?.find((c) => c.id === clientId);
		if (client) {
			form.setValue("existingClientId", clientId);
			form.setValue("applicantName", client.name);
			form.setValue("applicantPhone", client.mobile);
			if (client.email) form.setValue("applicantEmail", client.email);
			if (client.pan) form.setValue("applicantPan", client.pan);
		}
	};

	const filteredClients =
		myClients?.filter(
			(c) =>
				c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
				c.mobile.includes(searchQuery),
		) || [];

	const formatCurrency = (amount: number | string) => {
		const num = typeof amount === "string" ? Number.parseInt(amount) : amount;
		return new Intl.NumberFormat("en-IN", {
			style: "currency",
			currency: "INR",
			maximumFractionDigits: 0,
		}).format(num);
	};

	const formatDate = (dateStr: string) => {
		return new Date(dateStr).toLocaleDateString("en-IN", {
			day: "numeric",
			month: "short",
			year: "numeric",
		});
	};

	function maskPan(pan: string): string {
		if (!pan || pan.length < 4) return pan || "";
		return "XXXXXX" + pan.slice(-4);
	}

	function getValidLeadTransitions(currentStatus: string): string[] {
		const idx = LEAD_STATUS_FLOW.indexOf(currentStatus);
		if (idx < 0 || idx >= LEAD_STATUS_FLOW.length - 1) return [];
		return LEAD_STATUS_FLOW.slice(idx + 1);
	}

	const applications = myApplications?.data || [];

	const openRouteDialog = (app: any) => {
		setSelectedApp(app);
		setSelectedBanks(app.routedBanks || []);
		setRouteDialogOpen(true);
	};

	const openDeleteDialog = (app: any) => {
		setSelectedApp(app);
		setDeleteDialogOpen(true);
	};

	const openDetailsDialog = (app: any) => {
		setSelectedApp(app);
		setDetailsDialogOpen(true);
	};

	const handleBankToggle = (bankCode: string) => {
		setSelectedBanks((prev) =>
			prev.includes(bankCode)
				? prev.filter((b) => b !== bankCode)
				: [...prev, bankCode],
		);
	};

	const handleRouteSubmit = () => {
		if (selectedApp && selectedBanks.length > 0) {
			routeMutation.mutate({
				applicationId: selectedApp.id,
				bankCodes: selectedBanks,
			});
		}
	};

	const handleDeleteConfirm = () => {
		if (selectedApp) {
			deleteMutation.mutate(selectedApp.id);
		}
	};

	const handleCheckEligibility = (app: any) => {
		setSelectedApp(app);
		checkEligibilityMutation.mutate(app.id);
	};

	const getEligibleBanks = (loanType: string) => {
		return banks.filter(
			(b) => b.isActive && (b.supportedLoanTypes || []).includes(loanType),
		);
	};

	const canEdit = (status: string) =>
		["draft", "submitted", "eligibility_check"].includes(status);
	const canDelete = (status: string) => ["draft", "submitted"].includes(status);

	return (
		<div className="space-y-4 sm:space-y-6">
			<div className="flex items-center justify-between flex-wrap gap-2">
				<div>
					<h1 className="text-lg sm:text-2xl font-bold">
						Loan Lead Submission
					</h1>
					<p className="text-muted-foreground text-sm">
						Submit loan applications for your clients
					</p>
				</div>
				<Badge variant="outline" className="text-xs sm:text-sm">
					<TrendingUp className="h-3 w-3 sm:h-4 sm:w-4 mr-1" />
					DSA Portal
				</Badge>
			</div>

			<Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
				<TabsList className="grid w-full grid-cols-3 mb-6">
					<TabsTrigger value="apply" className="flex items-center gap-2">
						<Plus className="h-4 w-4" />
						Submit New Lead
					</TabsTrigger>
					<TabsTrigger value="track" className="flex items-center gap-2">
						<Clock className="h-4 w-4" />
						My Submissions ({applications.length})
					</TabsTrigger>
					<TabsTrigger value="contacts" className="flex items-center gap-2">
						<Users className="h-4 w-4" />
						Banker Directory
					</TabsTrigger>
				</TabsList>

				<TabsContent value="apply">
					<Card className="mb-6">
						<CardHeader>
							<CardTitle className="flex items-center gap-2">
								<Building2 className="h-5 w-5" />
								Loan Vertical
							</CardTitle>
							<CardDescription>
								Select the loan category to proceed
							</CardDescription>
						</CardHeader>
						<CardContent>
							<div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
								{[
									{
										value: "RETAIL" as const,
										label: "Retail Loans",
										desc: "Personal, Home, Car, Education, Gold, LAP",
									},
									{
										value: "MSME" as const,
										label: "MSME Loans",
										desc: "Business & Working Capital",
									},
									{
										value: "DEVELOPER" as const,
										label: "Developer Finance",
										desc: "Builder Funding, Project Finance, LRD",
									},
								].map((v) => (
									<div
										key={v.value}
										onClick={() => {
											setLoanVertical(v.value);
											if (v.value !== "DEVELOPER") setLoanSubType("");
											setDevClientConfirmed(false);
											setDevClientInfo({
												clientMode: "new",
												applicantName: "",
												applicantPhone: "",
												applicantEmail: "",
												applicantPan: "",
												employmentType: "business",
												monthlyIncome: "",
											});
											setDevClientSource("new");
											setDevSearchQuery("");
										}}
										className={`cursor-pointer rounded-lg border-2 p-3 sm:p-4 transition-all ${
											loanVertical === v.value
												? "border-primary bg-primary/5"
												: "border-muted hover:border-primary/40"
										}`}
									>
										<p className="font-semibold text-sm">{v.label}</p>
										<p className="text-xs text-muted-foreground mt-1">
											{v.desc}
										</p>
									</div>
								))}
							</div>

							{loanVertical === "DEVELOPER" && (
								<div className="mt-4">
									<Label className="text-sm font-medium">Loan Sub-Type</Label>
									<Select
										value={loanSubType}
										onValueChange={(val) => {
											setLoanSubType(val);
											setDevClientConfirmed(false);
											setDevClientInfo({
												clientMode: "new",
												applicantName: "",
												applicantPhone: "",
												applicantEmail: "",
												applicantPan: "",
												employmentType: "business",
												monthlyIncome: "",
											});
											setDevClientSource("new");
										}}
									>
										<SelectTrigger className="mt-1">
											<SelectValue placeholder="Select developer finance type" />
										</SelectTrigger>
										<SelectContent>
											{Object.entries(loanSubTypeLabels).map(([key, label]) => (
												<SelectItem key={key} value={key}>
													{label}
												</SelectItem>
											))}
										</SelectContent>
									</Select>
								</div>
							)}
						</CardContent>
					</Card>

					{loanVertical === "DEVELOPER" ? (
						<>
							{!loanSubType ? (
								<Card className="mb-6">
									<CardContent className="py-8">
										<div className="text-center space-y-3">
											<Building2 className="h-10 w-10 mx-auto text-muted-foreground/50" />
											<div>
												<p className="font-medium text-muted-foreground">
													Select a Loan Sub-Type
												</p>
												<p className="text-sm text-muted-foreground/70 mt-1">
													Choose a developer finance type above to proceed with
													client selection and project details
												</p>
											</div>
										</div>
									</CardContent>
								</Card>
							) : (
								<>
									<Card className="mb-6">
										<CardHeader>
											<CardTitle className="flex items-center gap-2">
												<Users className="h-5 w-5" />
												Client Selection
											</CardTitle>
											<CardDescription>
												Select an existing client or enter new lead details for
												this developer finance application
											</CardDescription>
										</CardHeader>
										<CardContent className="space-y-4">
											<RadioGroup
												onValueChange={(value) => {
													setDevClientSource(value as "existing" | "new");
													setDevClientConfirmed(false);
													setDevClientInfo((prev) => ({
														...prev,
														clientMode: value as "new" | "existing",
														clientId: undefined,
														applicantName: "",
														applicantPhone: "",
														applicantEmail: "",
														applicantPan: "",
													}));
												}}
												value={devClientSource}
												className="flex gap-4"
											>
												<div className="flex items-center space-x-2">
													<RadioGroupItem value="new" id="dev-new" />
													<Label htmlFor="dev-new">New Lead</Label>
												</div>
												<div className="flex items-center space-x-2">
													<RadioGroupItem value="existing" id="dev-existing" />
													<Label htmlFor="dev-existing">
														Existing Client/Prospect
													</Label>
												</div>
											</RadioGroup>

											{devClientSource === "existing" && (
												<div className="space-y-3">
													<div className="relative">
														<Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
														<Input
															placeholder="Search by name or phone..."
															value={devSearchQuery}
															onChange={(e) =>
																setDevSearchQuery(e.target.value)
															}
															className="pl-9"
														/>
													</div>
													{loadingClients ? (
														<div className="text-center py-4 text-muted-foreground">
															Loading clients...
														</div>
													) : (
														<div className="max-h-48 overflow-y-auto space-y-2 border rounded-md p-2">
															{(myClients || [])
																.filter(
																	(c) =>
																		c.name
																			.toLowerCase()
																			.includes(devSearchQuery.toLowerCase()) ||
																		c.mobile.includes(devSearchQuery),
																)
																.slice(0, 10)
																.map((client) => (
																	<div
																		key={client.id}
																		className={`p-3 rounded-md cursor-pointer hover:bg-muted transition-colors ${
																			devClientInfo.clientId === client.id
																				? "bg-primary/10 border-primary border"
																				: "border"
																		}`}
																		onClick={() => {
																			setDevClientInfo({
																				clientMode: "existing",
																				clientId: client.id,
																				applicantName: client.name,
																				applicantPhone: client.mobile,
																				applicantEmail: client.email || "",
																				applicantPan: client.pan || "",
																				employmentType: "business",
																				monthlyIncome: "",
																			});
																			setDevClientConfirmed(true);
																		}}
																	>
																		<div className="flex items-center justify-between">
																			<div>
																				<div className="font-medium">
																					{client.name}
																				</div>
																				<div className="text-sm text-muted-foreground">
																					{client.mobile}
																				</div>
																			</div>
																			<Badge
																				variant="outline"
																				className="text-xs capitalize"
																			>
																				{client.type}
																			</Badge>
																		</div>
																	</div>
																))}
															{(myClients || []).filter(
																(c) =>
																	c.name
																		.toLowerCase()
																		.includes(devSearchQuery.toLowerCase()) ||
																	c.mobile.includes(devSearchQuery),
															).length === 0 && (
																<div className="text-center py-4 text-muted-foreground">
																	No clients found
																</div>
															)}
														</div>
													)}
													{devClientInfo.clientId && (
														<div className="mt-2 p-3 bg-primary/5 rounded-md border border-primary/20">
															<p className="text-sm font-medium flex items-center gap-2">
																<CheckCircle2 className="h-4 w-4 text-green-600" />
																Selected: {devClientInfo.applicantName} (
																{devClientInfo.applicantPhone})
															</p>
														</div>
													)}
												</div>
											)}

											{devClientSource === "new" && (
												<div className="space-y-4">
													<div className="grid grid-cols-2 gap-4">
														<div className="space-y-2">
															<Label className="text-sm font-medium">
																<User className="h-3.5 w-3.5 inline mr-1" />
																Full Name *
															</Label>
															<Input
																placeholder="Enter applicant name"
																value={devClientInfo.applicantName}
																onChange={(e) =>
																	setDevClientInfo((prev) => ({
																		...prev,
																		applicantName: e.target.value,
																	}))
																}
															/>
														</div>
														<div className="space-y-2">
															<Label className="text-sm font-medium">
																<Phone className="h-3.5 w-3.5 inline mr-1" />
																Phone *
															</Label>
															<Input
																placeholder="10-digit mobile number"
																value={devClientInfo.applicantPhone}
																onChange={(e) =>
																	setDevClientInfo((prev) => ({
																		...prev,
																		applicantPhone: e.target.value,
																	}))
																}
															/>
														</div>
													</div>
													<div className="grid grid-cols-2 gap-4">
														<div className="space-y-2">
															<Label className="text-sm font-medium">
																<Mail className="h-3.5 w-3.5 inline mr-1" />
																Email
															</Label>
															<Input
																placeholder="Email address"
																type="email"
																value={devClientInfo.applicantEmail || ""}
																onChange={(e) =>
																	setDevClientInfo((prev) => ({
																		...prev,
																		applicantEmail: e.target.value,
																	}))
																}
															/>
														</div>
														<div className="space-y-2">
															<Label className="text-sm font-medium">PAN</Label>
															<Input
																placeholder="ABCDE1234F"
																value={devClientInfo.applicantPan || ""}
																onChange={(e) =>
																	setDevClientInfo((prev) => ({
																		...prev,
																		applicantPan: e.target.value.toUpperCase(),
																	}))
																}
															/>
														</div>
													</div>
													<div className="grid grid-cols-2 gap-4">
														<div className="space-y-2">
															<Label className="text-sm font-medium">
																<Briefcase className="h-3.5 w-3.5 inline mr-1" />
																Employment Type
															</Label>
															<Select
																value={devClientInfo.employmentType}
																onValueChange={(val) =>
																	setDevClientInfo((prev) => ({
																		...prev,
																		employmentType: val,
																	}))
																}
															>
																<SelectTrigger>
																	<SelectValue />
																</SelectTrigger>
																<SelectContent>
																	<SelectItem value="salaried">
																		Salaried
																	</SelectItem>
																	<SelectItem value="self_employed">
																		Self Employed
																	</SelectItem>
																	<SelectItem value="business">
																		Business Owner
																	</SelectItem>
																	<SelectItem value="professional">
																		Professional
																	</SelectItem>
																</SelectContent>
															</Select>
														</div>
														<div className="space-y-2">
															<Label className="text-sm font-medium">
																<IndianRupee className="h-3.5 w-3.5 inline mr-1" />
																Monthly Income *
															</Label>
															<Input
																placeholder="Monthly income"
																type="number"
																value={devClientInfo.monthlyIncome}
																onChange={(e) =>
																	setDevClientInfo((prev) => ({
																		...prev,
																		monthlyIncome: e.target.value,
																	}))
																}
															/>
														</div>
													</div>
													{devClientInfo.applicantPhone &&
														!/^[6-9]\d{9}$/.test(
															devClientInfo.applicantPhone,
														) && (
															<p className="text-xs text-red-500">
																Please enter a valid 10-digit mobile number
																starting with 6-9
															</p>
														)}
													{devClientInfo.applicantPan &&
														!/^[A-Z]{5}[0-9]{4}[A-Z]{1}$/.test(
															devClientInfo.applicantPan,
														) && (
															<p className="text-xs text-red-500">
																PAN format should be ABCDE1234F
															</p>
														)}
													<Button
														type="button"
														className="w-full"
														disabled={
															!devClientInfo.applicantName.trim() ||
															!devClientInfo.applicantPhone ||
															!/^[6-9]\d{9}$/.test(
																devClientInfo.applicantPhone,
															) ||
															!devClientInfo.monthlyIncome ||
															(!!devClientInfo.applicantPan &&
																!/^[A-Z]{5}[0-9]{4}[A-Z]{1}$/.test(
																	devClientInfo.applicantPan,
																))
														}
														onClick={() => setDevClientConfirmed(true)}
													>
														<ArrowRight className="h-4 w-4 mr-2" />
														Continue to Project Details
													</Button>
												</div>
											)}
										</CardContent>
									</Card>

									{devClientConfirmed && (
										<ProjectFinanceWizard
											applicationId={devAppId}
											loanSubType={loanSubType}
											clientInfo={devClientInfo}
											onComplete={() => {
												toast({
													title: "Success",
													description:
														"Developer finance application submitted successfully",
												});
												setActiveTab("track");
												setDevClientConfirmed(false);
												setDevClientInfo({
													clientMode: "new",
													applicantName: "",
													applicantPhone: "",
													applicantEmail: "",
													applicantPan: "",
													employmentType: "business",
													monthlyIncome: "",
												});
												queryClient.invalidateQueries({
													queryKey: ["/api/agent/loans/my-applications"],
												});
											}}
										/>
									)}
								</>
							)}
						</>
					) : (
						<>
							{showRestorePrompt && (
								<RestorePrompt
									onRestore={restoreDraft}
									onDiscard={discardDraft}
								/>
							)}
							<Form {...form}>
								<form
									onSubmit={form.handleSubmit(onSubmit)}
									className="space-y-6"
								>
									<Card>
										<CardHeader>
											<div className="flex items-center justify-between">
												<CardTitle className="flex items-center gap-2">
													<Users className="h-5 w-5" />
													Client Selection
												</CardTitle>
												<DraftIndicator lastSaved={formatLastSaved()} />
											</div>
											<CardDescription>
												Select an existing client or enter new lead details
											</CardDescription>
										</CardHeader>
										<CardContent className="space-y-4">
											<FormField
												control={form.control}
												name="clientSource"
												render={({ field }) => (
													<FormItem>
														<FormControl>
															<RadioGroup
																onValueChange={(value) => {
																	field.onChange(value);
																	setClientSource(value as "existing" | "new");
																	if (value === "new") {
																		form.setValue("applicantName", "");
																		form.setValue("applicantPhone", "");
																		form.setValue("applicantEmail", "");
																		form.setValue("applicantPan", "");
																	}
																}}
																value={field.value}
																className="flex gap-4"
															>
																<div className="flex items-center space-x-2">
																	<RadioGroupItem value="new" id="new" />
																	<Label htmlFor="new">New Lead</Label>
																</div>
																<div className="flex items-center space-x-2">
																	<RadioGroupItem
																		value="existing"
																		id="existing"
																	/>
																	<Label htmlFor="existing">
																		Existing Client/Prospect
																	</Label>
																</div>
															</RadioGroup>
														</FormControl>
													</FormItem>
												)}
											/>

											{clientSource === "existing" && (
												<div className="space-y-3">
													<div className="relative">
														<Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
														<Input
															placeholder="Search by name or phone..."
															value={searchQuery}
															onChange={(e) => setSearchQuery(e.target.value)}
															className="pl-9"
														/>
													</div>
													{loadingClients ? (
														<div className="text-center py-4 text-muted-foreground">
															Loading clients...
														</div>
													) : filteredClients.length === 0 ? (
														<div className="text-center py-4 text-muted-foreground">
															No clients found
														</div>
													) : (
														<div className="max-h-48 overflow-y-auto space-y-2 border rounded-md p-2">
															{filteredClients.slice(0, 10).map((client) => (
																<div
																	key={client.id}
																	className={`p-3 rounded-md cursor-pointer hover:bg-muted transition-colors ${
																		form.watch("existingClientId") === client.id
																			? "bg-primary/10 border-primary border"
																			: "border"
																	}`}
																	onClick={() => handleClientSelect(client.id)}
																>
																	<div className="flex items-center justify-between">
																		<div>
																			<div className="font-medium">
																				{client.name}
																			</div>
																			<div className="text-sm text-muted-foreground">
																				{client.mobile}
																			</div>
																		</div>
																		<Badge
																			variant="outline"
																			className="text-xs capitalize"
																		>
																			{client.type}
																		</Badge>
																	</div>
																</div>
															))}
														</div>
													)}
												</div>
											)}
										</CardContent>
									</Card>

									<Card>
										<CardHeader>
											<CardTitle className="flex items-center gap-2">
												<User className="h-5 w-5" />
												Applicant Details
											</CardTitle>
										</CardHeader>
										<CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
											<FormField
												control={form.control}
												name="applicantName"
												render={({ field }) => (
													<FormItem>
														<FormLabel>Full Name *</FormLabel>
														<FormControl>
															<Input placeholder="Enter full name" {...field} />
														</FormControl>
														<FormMessage />
													</FormItem>
												)}
											/>
											<FormField
												control={form.control}
												name="applicantPhone"
												render={({ field }) => (
													<FormItem>
														<FormLabel>Mobile Number *</FormLabel>
														<FormControl>
															<Input placeholder="10-digit mobile" {...field} />
														</FormControl>
														<FormMessage />
													</FormItem>
												)}
											/>
											<FormField
												control={form.control}
												name="applicantEmail"
												render={({ field }) => (
													<FormItem>
														<FormLabel>Email</FormLabel>
														<FormControl>
															<Input
																type="email"
																placeholder="email@example.com"
																{...field}
															/>
														</FormControl>
														<FormMessage />
													</FormItem>
												)}
											/>
											<FormField
												control={form.control}
												name="applicantPan"
												render={({ field }) => (
													<FormItem>
														<FormLabel>PAN Number</FormLabel>
														<FormControl>
															<Input
																placeholder="ABCDE1234F"
																{...field}
																className="uppercase"
															/>
														</FormControl>
														<FormMessage />
													</FormItem>
												)}
											/>
											<FormField
												control={form.control}
												name="dateOfBirth"
												render={({ field }) => (
													<FormItem>
														<FormLabel>Date of Birth</FormLabel>
														<FormControl>
															<Input type="date" {...field} />
														</FormControl>
														<FormMessage />
													</FormItem>
												)}
											/>
											<FormField
												control={form.control}
												name="employmentType"
												render={({ field }) => (
													<FormItem>
														<FormLabel>Employment Type *</FormLabel>
														<Select
															onValueChange={field.onChange}
															value={field.value}
														>
															<FormControl>
																<SelectTrigger>
																	<SelectValue placeholder="Select employment type" />
																</SelectTrigger>
															</FormControl>
															<SelectContent>
																<SelectItem value="salaried">
																	Salaried
																</SelectItem>
																<SelectItem value="self_employed">
																	Self Employed
																</SelectItem>
																<SelectItem value="business">
																	Business Owner
																</SelectItem>
																<SelectItem value="professional">
																	Professional
																</SelectItem>
															</SelectContent>
														</Select>
														<FormMessage />
													</FormItem>
												)}
											/>
											<FormField
												control={form.control}
												name="monthlyIncome"
												render={({ field }) => (
													<FormItem>
														<FormLabel>Monthly Income (₹) *</FormLabel>
														<FormControl>
															<Input
																type="number"
																placeholder="50000"
																{...field}
															/>
														</FormControl>
														<FormMessage />
													</FormItem>
												)}
											/>
											<FormField
												control={form.control}
												name="creditScore"
												render={({ field }) => (
													<FormItem>
														<FormLabel>Credit Score (if known)</FormLabel>
														<FormControl>
															<Input
																type="number"
																placeholder="750"
																min="300"
																max="900"
																{...field}
															/>
														</FormControl>
														<FormMessage />
													</FormItem>
												)}
											/>
										</CardContent>
									</Card>

									<Card>
										<CardHeader>
											<CardTitle className="flex items-center gap-2">
												<IndianRupee className="h-5 w-5" />
												Loan Requirements
											</CardTitle>
										</CardHeader>
										<CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
											<FormField
												control={form.control}
												name="loanType"
												render={({ field }) => (
													<FormItem>
														<FormLabel>Loan Type *</FormLabel>
														<Select
															onValueChange={field.onChange}
															value={field.value}
														>
															<FormControl>
																<SelectTrigger>
																	<SelectValue placeholder="Select loan type" />
																</SelectTrigger>
															</FormControl>
															<SelectContent>
																<SelectItem value="personal">
																	Personal Loan
																</SelectItem>
																<SelectItem value="home">Home Loan</SelectItem>
																<SelectItem value="car">Car Loan</SelectItem>
																<SelectItem value="business">
																	Business Loan
																</SelectItem>
																<SelectItem value="education">
																	Education Loan
																</SelectItem>
																<SelectItem value="gold">Gold Loan</SelectItem>
																<SelectItem value="lap">
																	Loan Against Property
																</SelectItem>
															</SelectContent>
														</Select>
														<FormMessage />
														<ProcessingTimeDisplay
															loanType={field.value}
															className="mt-2"
														/>
													</FormItem>
												)}
											/>
											<FormField
												control={form.control}
												name="requestedAmount"
												render={({ field }) => (
													<FormItem>
														<FormLabel>Loan Amount (₹) *</FormLabel>
														<FormControl>
															<Input
																type="number"
																placeholder="500000"
																{...field}
															/>
														</FormControl>
														<FormMessage />
													</FormItem>
												)}
											/>
											<FormField
												control={form.control}
												name="requestedTenure"
												render={({ field }) => (
													<FormItem>
														<FormLabel>Tenure (months) *</FormLabel>
														<Select
															onValueChange={field.onChange}
															value={field.value}
														>
															<FormControl>
																<SelectTrigger>
																	<SelectValue placeholder="Select tenure" />
																</SelectTrigger>
															</FormControl>
															<SelectContent>
																<SelectItem value="12">12 months</SelectItem>
																<SelectItem value="24">24 months</SelectItem>
																<SelectItem value="36">36 months</SelectItem>
																<SelectItem value="48">48 months</SelectItem>
																<SelectItem value="60">60 months</SelectItem>
																<SelectItem value="84">84 months</SelectItem>
																<SelectItem value="120">120 months</SelectItem>
																<SelectItem value="180">
																	180 months (Home)
																</SelectItem>
																<SelectItem value="240">
																	240 months (Home)
																</SelectItem>
															</SelectContent>
														</Select>
														<FormMessage />
													</FormItem>
												)}
											/>
											{form.watch("processingMode") !==
												"EXTERNAL_FINANCIER" && (
												<>
													<FormField
														control={form.control}
														name="routingMode"
														render={({ field }) => (
															<FormItem>
																<FormLabel>Bank Selection Mode</FormLabel>
																<Select
																	onValueChange={field.onChange}
																	value={field.value}
																>
																	<FormControl>
																		<SelectTrigger>
																			<SelectValue placeholder="Select mode" />
																		</SelectTrigger>
																	</FormControl>
																	<SelectContent>
																		<SelectItem value="auto">
																			Auto (System selects banks)
																		</SelectItem>
																		<SelectItem value="manual">
																			Manual (Choose banks)
																		</SelectItem>
																	</SelectContent>
																</Select>
																<FormMessage />
															</FormItem>
														)}
													/>
													{form.watch("routingMode") === "auto" && (
														<FormField
															control={form.control}
															name="routingStrategy"
															render={({ field }) => (
																<FormItem>
																	<FormLabel>Routing Strategy</FormLabel>
																	<Select
																		onValueChange={field.onChange}
																		value={field.value}
																	>
																		<FormControl>
																			<SelectTrigger>
																				<SelectValue placeholder="Select routing" />
																			</SelectTrigger>
																		</FormControl>
																		<SelectContent>
																			<SelectItem value="parallel">
																				Parallel (All eligible banks)
																			</SelectItem>
																			<SelectItem value="waterfall">
																				Waterfall (One by one)
																			</SelectItem>
																			<SelectItem value="priority_first">
																				Priority First
																			</SelectItem>
																		</SelectContent>
																	</Select>
																	<FormMessage />
																</FormItem>
															)}
														/>
													)}
													{form.watch("routingMode") === "manual" && (
														<div className="md:col-span-2">
															<Label className="text-sm font-medium">
																Select Target Banks *
															</Label>
															<div className="mt-2 grid grid-cols-2 md:grid-cols-3 gap-3">
																{banks
																	.filter(
																		(b) =>
																			b.isActive &&
																			b.supportedLoanTypes?.includes(
																				form.watch("loanType"),
																			),
																	)
																	.map((bank) => (
																		<label
																			key={bank.bankCode}
																			className={`flex items-center gap-2 p-3 border rounded-lg cursor-pointer transition-colors ${
																				form
																					.watch("targetBanks")
																					?.includes(bank.bankCode)
																					? "bg-primary/10 border-primary"
																					: "hover:bg-muted"
																			}`}
																		>
																			<Checkbox
																				checked={form
																					.watch("targetBanks")
																					?.includes(bank.bankCode)}
																				onCheckedChange={(checked) => {
																					const current =
																						form.getValues("targetBanks") || [];
																					if (checked) {
																						form.setValue("targetBanks", [
																							...current,
																							bank.bankCode,
																						]);
																					} else {
																						form.setValue(
																							"targetBanks",
																							current.filter(
																								(b) => b !== bank.bankCode,
																							),
																						);
																					}
																				}}
																			/>
																			<div className="flex items-center gap-2">
																				<Building2 className="h-4 w-4 text-muted-foreground" />
																				<span className="text-sm font-medium">
																					{bank.bankName}
																				</span>
																			</div>
																		</label>
																	))}
															</div>
															{banks.filter(
																(b) =>
																	b.isActive &&
																	b.supportedLoanTypes?.includes(
																		form.watch("loanType"),
																	),
															).length === 0 && (
																<p className="text-sm text-muted-foreground mt-2">
																	No banks available for this loan type
																</p>
															)}
															{form.watch("targetBanks")?.length === 0 &&
																form.watch("routingMode") === "manual" && (
																	<p className="text-sm text-destructive mt-2">
																		Please select at least one bank
																	</p>
																)}
														</div>
													)}
												</>
											)}
											<FormField
												control={form.control}
												name="loanPurpose"
												render={({ field }) => (
													<FormItem className="md:col-span-2">
														<FormLabel>Purpose of Loan</FormLabel>
														<FormControl>
															<Input
																placeholder="e.g., Home renovation, Medical expenses, Business expansion"
																{...field}
															/>
														</FormControl>
														<FormMessage />
													</FormItem>
												)}
											/>
										</CardContent>
									</Card>

									<Card>
										<CardHeader>
											<CardTitle className="flex items-center gap-2">
												<Briefcase className="h-5 w-5" />
												Who Will Process This Loan?
											</CardTitle>
											<CardDescription>
												Choose whether you (agent) will collect documents and
												process the loan, or give the lead directly to a
												bank/financier
											</CardDescription>
										</CardHeader>
										<CardContent className="space-y-4">
											<FormField
												control={form.control}
												name="processingMode"
												render={({ field }) => (
													<FormItem>
														<FormControl>
															<div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
																<div
																	onClick={() => field.onChange("PLATFORM")}
																	className={`cursor-pointer rounded-lg border-2 p-4 transition-all ${
																		field.value === "PLATFORM"
																			? "border-primary bg-primary/5"
																			: "border-muted hover:border-primary/40"
																	}`}
																>
																	<div className="flex items-center gap-2 mb-2">
																		<FileText className="h-5 w-5 text-primary" />
																		<p className="font-semibold text-sm">
																			Agent Processes
																		</p>
																	</div>
																	<p className="text-xs text-muted-foreground">
																		You collect documents, process the loan
																		through the platform, and route to banks
																	</p>
																</div>
																<div
																	onClick={() =>
																		field.onChange("EXTERNAL_FINANCIER")
																	}
																	className={`cursor-pointer rounded-lg border-2 p-4 transition-all ${
																		field.value === "EXTERNAL_FINANCIER"
																			? "border-orange-500 bg-orange-500/5"
																			: "border-muted hover:border-orange-500/40"
																	}`}
																>
																	<div className="flex items-center gap-2 mb-2">
																		<Building2 className="h-5 w-5 text-orange-500" />
																		<p className="font-semibold text-sm">
																			Give Lead to Bank
																		</p>
																	</div>
																	<p className="text-xs text-muted-foreground">
																		You give the lead directly to the
																		bank/financier. They handle documentation
																		and processing
																	</p>
																</div>
															</div>
														</FormControl>
													</FormItem>
												)}
											/>

											{form.watch("processingMode") ===
												"EXTERNAL_FINANCIER" && (
												<div className="space-y-4 pt-4 border-t">
													<div className="flex items-center justify-between mb-2">
														<div className="flex items-center gap-2">
															<AlertCircle className="h-4 w-4 text-orange-500" />
															<p className="text-sm font-medium text-orange-700 dark:text-orange-400">
																Provide bank/financier details where you are
																sending this lead
															</p>
														</div>
													</div>

													{savedBankerContacts.length > 0 && (
														<div className="space-y-2">
															<p className="text-xs text-muted-foreground font-medium">
																Select from saved contacts or enter new details
																below
															</p>
															<div className="flex flex-wrap gap-2 max-h-32 overflow-y-auto p-2 rounded-md border bg-muted/30">
																{savedBankerContacts.map((contact) => (
																	<Button
																		key={contact.id}
																		type="button"
																		variant="outline"
																		size="sm"
																		className="text-xs h-auto py-1.5 px-3"
																		onClick={() => {
																			form.setValue(
																				"financierName",
																				contact.financierName,
																			);
																			form.setValue(
																				"bankerName",
																				contact.bankerName,
																			);
																			form.setValue(
																				"bankerMobile",
																				contact.bankerMobile || "",
																			);
																			form.setValue(
																				"bankerEmail",
																				contact.bankerEmail || "",
																			);
																			form.setValue(
																				"branch",
																				contact.branch || "",
																			);
																			form.setValue(
																				"rmName",
																				contact.rmName || "",
																			);
																			form.setValue(
																				"rmMobile",
																				contact.rmMobile || "",
																			);
																			form.setValue(
																				"rmEmail",
																				contact.rmEmail || "",
																			);
																		}}
																	>
																		<Building2 className="h-3 w-3 mr-1.5" />
																		<span className="font-medium">
																			{contact.financierName}
																		</span>
																		<span className="mx-1 text-muted-foreground">
																			·
																		</span>
																		<span>{contact.bankerName}</span>
																	</Button>
																))}
															</div>
														</div>
													)}

													<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
														<FormField
															control={form.control}
															name="financierName"
															render={({ field }) => (
																<FormItem className="relative">
																	<FormLabel>Financier / Bank Name *</FormLabel>
																	<FormControl>
																		<Input
																			placeholder="Type to search banks & NBFCs..."
																			{...field}
																			autoComplete="off"
																			onChange={(e) => {
																				field.onChange(e);
																				setFinancierQuery(e.target.value);
																				setFinancierDropdownOpen(
																					e.target.value.length >= 1,
																				);
																			}}
																			onFocus={() => {
																				if (
																					field.value &&
																					field.value.length >= 1
																				) {
																					setFinancierQuery(field.value);
																					setFinancierDropdownOpen(true);
																				}
																			}}
																			onBlur={() => {
																				setTimeout(
																					() => setFinancierDropdownOpen(false),
																					200,
																				);
																			}}
																		/>
																	</FormControl>
																	{financierDropdownOpen && (
																		<div className="absolute top-full left-0 right-0 z-50 mt-1 max-h-48 overflow-y-auto rounded-md border bg-popover shadow-md">
																			{financierSuggestionsLoading ? (
																				<div className="flex items-center justify-center py-3 text-sm text-muted-foreground">
																					<Loader2 className="h-4 w-4 animate-spin mr-2" />
																					Searching...
																				</div>
																			) : financierSuggestions.length > 0 ? (
																				financierSuggestions.map((s, i) => (
																					<button
																						key={`${s.name}-${i}`}
																						type="button"
																						className="flex w-full items-center justify-between px-3 py-2 text-sm hover:bg-accent cursor-pointer text-left"
																						onMouseDown={(e) => {
																							e.preventDefault();
																							form.setValue(
																								"financierName",
																								s.name,
																							);
																							if (s.dsaCode)
																								form.setValue(
																									"dsaCode",
																									s.dsaCode,
																								);
																							setFinancierDropdownOpen(false);
																							setFinancierQuery("");
																						}}
																					>
																						<div>
																							<span className="font-medium">
																								{s.name}
																							</span>
																							{s.dsaCode && (
																								<span className="text-[10px] text-muted-foreground ml-1">
																									({s.dsaCode})
																								</span>
																							)}
																						</div>
																						<Badge
																							variant="outline"
																							className="text-[10px] ml-2 capitalize"
																						>
																							{s.type}
																						</Badge>
																					</button>
																				))
																			) : (
																				<div className="px-3 py-2 text-sm text-muted-foreground">
																					No matches found
																				</div>
																			)}
																		</div>
																	)}
																	<FormMessage />
																</FormItem>
															)}
														/>
														<FormField
															control={form.control}
															name="dsaCode"
															render={({ field }) => (
																<FormItem>
																	<FormLabel>DSA Code</FormLabel>
																	<FormControl>
																		<Input
																			placeholder="DSA code (auto-filled)"
																			{...field}
																		/>
																	</FormControl>
																	<FormMessage />
																</FormItem>
															)}
														/>
														<FormField
															control={form.control}
															name="bankerName"
															render={({ field }) => (
																<FormItem>
																	<FormLabel>
																		SM Name (Sales Manager) *
																	</FormLabel>
																	<FormControl>
																		<Input
																			placeholder="Sales manager / contact person name"
																			{...field}
																		/>
																	</FormControl>
																	<FormMessage />
																</FormItem>
															)}
														/>
														<FormField
															control={form.control}
															name="bankerMobile"
															render={({ field }) => (
																<FormItem>
																	<FormLabel>SM Mobile Number *</FormLabel>
																	<FormControl>
																		<Input
																			placeholder="10-digit mobile number"
																			{...field}
																		/>
																	</FormControl>
																	<FormMessage />
																</FormItem>
															)}
														/>
														<FormField
															control={form.control}
															name="bankerEmail"
															render={({ field }) => (
																<FormItem>
																	<FormLabel>SM Email</FormLabel>
																	<FormControl>
																		<Input
																			type="email"
																			placeholder="sm@bank.com"
																			{...field}
																		/>
																	</FormControl>
																	<FormMessage />
																</FormItem>
															)}
														/>
														<FormField
															control={form.control}
															name="branch"
															render={({ field }) => (
																<FormItem>
																	<FormLabel>SM Branch</FormLabel>
																	<FormControl>
																		<Input
																			placeholder="e.g. Bangalore - Whitefield"
																			{...field}
																		/>
																	</FormControl>
																	<FormMessage />
																</FormItem>
															)}
														/>
														<FormField
															control={form.control}
															name="rmName"
															render={({ field }) => (
																<FormItem>
																	<FormLabel>
																		RM Name (Relationship Manager)
																	</FormLabel>
																	<FormControl>
																		<Input
																			placeholder="Relationship manager name"
																			{...field}
																		/>
																	</FormControl>
																	<FormMessage />
																</FormItem>
															)}
														/>
														<FormField
															control={form.control}
															name="rmMobile"
															render={({ field }) => (
																<FormItem>
																	<FormLabel>RM Mobile Number</FormLabel>
																	<FormControl>
																		<Input
																			placeholder="10-digit mobile number"
																			{...field}
																		/>
																	</FormControl>
																	<FormMessage />
																</FormItem>
															)}
														/>
														<FormField
															control={form.control}
															name="rmEmail"
															render={({ field }) => (
																<FormItem>
																	<FormLabel>RM Email</FormLabel>
																	<FormControl>
																		<Input
																			type="email"
																			placeholder="rm@bank.com"
																			{...field}
																		/>
																	</FormControl>
																	<FormMessage />
																</FormItem>
															)}
														/>
													</div>
													<p className="text-xs text-muted-foreground">
														New banker contacts are automatically saved for
														future use.
													</p>
												</div>
											)}
										</CardContent>
									</Card>

									{form.watch("processingMode") === "PLATFORM" && (
										<LoanDocumentUpload
											loanType={form.watch("loanType")}
											documents={uploadedDocuments}
											onDocumentsChange={setUploadedDocuments}
										/>
									)}

									<div className="flex justify-end gap-3">
										<Button
											type="button"
											variant="outline"
											onClick={() => form.reset()}
										>
											Reset Form
										</Button>
										<Button
											type="submit"
											disabled={createApplicationMutation.isPending}
										>
											{createApplicationMutation.isPending ? (
												<>
													<Loader2 className="h-4 w-4 mr-2 animate-spin" />
													Submitting...
												</>
											) : (
												<>
													<ArrowRight className="h-4 w-4 mr-2" />
													Submit Loan Lead
												</>
											)}
										</Button>
									</div>
								</form>
							</Form>
						</>
					)}
				</TabsContent>

				<TabsContent value="track">
					<Card>
						<CardHeader className="flex flex-row items-center justify-between">
							<div>
								<CardTitle className="flex items-center gap-2">
									<FileText className="h-5 w-5" />
									My Loan Submissions
								</CardTitle>
								<CardDescription>
									Track the status of loan applications you've submitted
								</CardDescription>
							</div>
							<Button
								variant="outline"
								size="sm"
								onClick={() => refetchApplications()}
							>
								<RefreshCw className="h-4 w-4 mr-2" />
								Refresh
							</Button>
						</CardHeader>
						<CardContent>
							{loadingApplications ? (
								<LoadingState variant="list" count={3} />
							) : applications.length === 0 ? (
								<div className="text-center py-12 text-muted-foreground">
									<FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
									<p>No loan applications submitted yet</p>
									<Button variant="link" onClick={() => setActiveTab("apply")}>
										Submit your first loan lead
									</Button>
								</div>
							) : (
								<div className="space-y-4">
									{applications.map((app: any) => (
										<div
											key={app.id}
											className="border rounded-lg p-4 hover:bg-muted/50 transition-colors"
										>
											<div className="flex items-start justify-between">
												<div className="space-y-1">
													<div className="flex items-center gap-2">
														<span className="font-medium">
															{app.applicantName}
														</span>
														<Badge variant="outline" className="text-xs">
															{app.applicationNumber || app.id.slice(0, 8)}
														</Badge>
													</div>
													<div className="text-sm text-muted-foreground flex items-center gap-3">
														<span className="flex items-center gap-1">
															<Phone className="h-3 w-3" />
															{app.applicantPhone}
														</span>
														<span>
															{loanTypeLabels[app.loanType] || app.loanType}
														</span>
													</div>
												</div>
												<div className="flex items-center gap-2">
													{app.processingMode === "EXTERNAL_FINANCIER" ? (
														<Badge
															variant="outline"
															className="text-xs bg-orange-500/10 text-orange-600 border-orange-500/30"
														>
															Bank Processes
														</Badge>
													) : (
														<Badge
															variant="outline"
															className="text-xs bg-blue-500/10 text-blue-600 border-blue-500/30"
														>
															Agent Processes
														</Badge>
													)}
													<Badge
														className={statusColors[app.status] || "bg-muted"}
													>
														{app.status?.replace(/_/g, " ")}
													</Badge>
													<DropdownMenu>
														<DropdownMenuTrigger asChild>
															<Button variant="ghost" size="sm">
																<MoreVertical className="h-4 w-4" />
															</Button>
														</DropdownMenuTrigger>
														<DropdownMenuContent align="end">
															<DropdownMenuItem
																onClick={() => openDetailsDialog(app)}
															>
																<Eye className="h-4 w-4 mr-2" />
																View Details
															</DropdownMenuItem>
															{canEdit(app.status) &&
																app.processingMode !== "EXTERNAL_FINANCIER" && (
																	<>
																		<DropdownMenuItem
																			onClick={() =>
																				handleCheckEligibility(app)
																			}
																			disabled={
																				checkEligibilityMutation.isPending
																			}
																		>
																			{checkEligibilityMutation.isPending &&
																			selectedApp?.id === app.id ? (
																				<Loader2 className="h-4 w-4 mr-2 animate-spin" />
																			) : (
																				<CheckCircle2 className="h-4 w-4 mr-2" />
																			)}
																			{checkEligibilityMutation.isPending &&
																			selectedApp?.id === app.id
																				? "Checking..."
																				: "Check Bank Eligibility"}
																		</DropdownMenuItem>
																		<DropdownMenuItem
																			onClick={() => openRouteDialog(app)}
																		>
																			<Send className="h-4 w-4 mr-2" />
																			Assign Banks
																		</DropdownMenuItem>
																	</>
																)}
															{(app.status === "disbursed" ||
																app.status === "approved") &&
																app.leadRegistryId && (
																	<DropdownMenuItem
																		onClick={() => {
																			setSelectedApp(app);
																			setPayoutClaimForm((prev) => ({
																				...prev,
																				disbursementAmount:
																					app.requestedAmount?.toString() || "",
																			}));
																			setPayoutClaimDialogOpen(true);
																		}}
																		className="text-emerald-600"
																	>
																		<DollarSign className="h-4 w-4 mr-2" />
																		Claim Payout
																	</DropdownMenuItem>
																)}
															{canDelete(app.status) && (
																<DropdownMenuItem
																	onClick={() => openDeleteDialog(app)}
																	className="text-red-600"
																>
																	<Trash2 className="h-4 w-4 mr-2" />
																	Delete
																</DropdownMenuItem>
															)}
														</DropdownMenuContent>
													</DropdownMenu>
												</div>
											</div>
											<Separator className="my-3" />
											<div className="grid grid-cols-2 md:grid-cols-5 gap-4 text-sm">
												<div>
													<span className="text-muted-foreground">Amount</span>
													<div className="font-medium">
														{formatCurrency(app.requestedAmount)}
													</div>
												</div>
												<div>
													<span className="text-muted-foreground">Tenure</span>
													<div className="font-medium">
														{app.requestedTenure} months
													</div>
												</div>
												{app.processingMode === "EXTERNAL_FINANCIER" ? (
													<div>
														<span className="text-muted-foreground">
															Financier
														</span>
														<div className="font-medium">
															{app.financierName || "—"}
														</div>
													</div>
												) : (
													<div>
														<span className="text-muted-foreground">
															Banks Routed
														</span>
														<div className="font-medium">
															{app.routedBanks?.length || 0}
														</div>
													</div>
												)}
												<div>
													<span className="text-muted-foreground">
														Submitted
													</span>
													<div className="font-medium">
														{formatDate(app.createdAt)}
													</div>
												</div>
												<div className="flex items-end gap-2">
													{canEdit(app.status) &&
														app.processingMode !== "EXTERNAL_FINANCIER" && (
															<Button
																size="sm"
																variant="outline"
																onClick={() => openRouteDialog(app)}
															>
																<Send className="h-3 w-3 mr-1" />
																Assign Banks
															</Button>
														)}
												</div>
											</div>
											<div className="mt-4 pt-4 border-t">
												<p className="text-xs text-muted-foreground mb-3">
													Application Progress
												</p>
												<LoanProgressStepper status={app.status} />
											</div>
										</div>
									))}
								</div>
							)}
						</CardContent>
					</Card>

					{/* Lead Registry Section - only for agent/partner roles */}
					{isAgentOrPartner && (
						<Card className="mt-6">
							<CardHeader>
								<CardTitle className="flex items-center gap-2">
									<LucideShield className="h-5 w-5 text-emerald-600" />
									Lead Registry
								</CardTitle>
								<CardDescription>
									All registered leads and their current status
								</CardDescription>
							</CardHeader>
							<CardContent>
								{leadsLoading ? (
									<LoadingState variant="list" count={3} />
								) : leads.length === 0 ? (
									<div className="text-center py-8 text-muted-foreground">
										<LucideShield className="h-10 w-10 mx-auto mb-3 opacity-30" />
										<p>
											No leads registered yet. Leads are auto-registered when
											you submit loan applications.
										</p>
									</div>
								) : (
									<div className="overflow-x-auto">
										<Table>
											<TableHeader>
												<TableRow>
													<TableHead>Customer Name</TableHead>
													<TableHead>PAN</TableHead>
													<TableHead>Mobile</TableHead>
													<TableHead>Loan Type</TableHead>
													<TableHead>Amount</TableHead>
													<TableHead>Processing Mode</TableHead>
													<TableHead>Status</TableHead>
													<TableHead>First Touch</TableHead>
													<TableHead>Actions</TableHead>
												</TableRow>
											</TableHeader>
											<TableBody>
												{leads.map((lead) => {
													const transitions = getValidLeadTransitions(
														lead.status,
													);
													return (
														<TableRow key={lead.id}>
															<TableCell className="font-medium">
																{lead.customerName}
															</TableCell>
															<TableCell className="font-mono text-sm text-muted-foreground">
																{maskPan(lead.pan)}
															</TableCell>
															<TableCell className="text-muted-foreground">
																{lead.mobile}
															</TableCell>
															<TableCell className="text-muted-foreground">
																{lead.loanType}
															</TableCell>
															<TableCell>
																{formatCurrency(lead.approximateAmount || 0)}
															</TableCell>
															<TableCell>
																{lead.processingMode ? (
																	<Badge
																		variant="outline"
																		className={
																			PROCESSING_MODE_COLORS[
																				lead.processingMode
																			] || ""
																		}
																	>
																		{lead.processingMode ===
																		"EXTERNAL_FINANCIER"
																			? "External"
																			: lead.processingMode}
																	</Badge>
																) : (
																	<Badge variant="outline">Pending</Badge>
																)}
															</TableCell>
															<TableCell>
																<Badge
																	variant="outline"
																	className={
																		LEAD_STATUS_COLORS[lead.status] || ""
																	}
																>
																	{lead.status}
																</Badge>
															</TableCell>
															<TableCell className="text-muted-foreground text-sm">
																{lead.firstTouchTimestamp
																	? new Date(
																			lead.firstTouchTimestamp,
																		).toLocaleDateString("en-IN")
																	: "—"}
															</TableCell>
															<TableCell>
																<div className="flex items-center gap-2 flex-wrap">
																	{transitions.length > 0 && (
																		<Select
																			onValueChange={(newStatus) =>
																				updateLeadStatusMutation.mutate({
																					leadId: lead.id,
																					status: newStatus,
																				})
																			}
																		>
																			<SelectTrigger className="h-8 w-[140px] text-sm">
																				<SelectValue placeholder="Update Status" />
																			</SelectTrigger>
																			<SelectContent>
																				{transitions.map((s) => (
																					<SelectItem key={s} value={s}>
																						{s}
																					</SelectItem>
																				))}
																			</SelectContent>
																		</Select>
																	)}
																	<Button
																		size="sm"
																		variant="ghost"
																		className="h-8 text-muted-foreground hover:text-foreground"
																		onClick={() => {
																			setAuditLead(lead);
																			setAuditDialogOpen(true);
																		}}
																	>
																		<Eye className="h-3 w-3 mr-1" />
																		Audit
																	</Button>
																</div>
															</TableCell>
														</TableRow>
													);
												})}
											</TableBody>
										</Table>
									</div>
								)}
							</CardContent>
						</Card>
					)}

					{/* Payout Claims Section - only for agent/partner roles */}
					{isAgentOrPartner && (
						<Card className="mt-6">
							<CardHeader>
								<CardTitle className="flex items-center gap-2">
									<IndianRupee className="h-5 w-5 text-emerald-600" />
									Payout Claims
								</CardTitle>
								<CardDescription>
									Track submitted payout claims and their status
								</CardDescription>
							</CardHeader>
							<CardContent>
								{claimsLoading ? (
									<LoadingState variant="list" count={3} />
								) : claims.length === 0 ? (
									<div className="text-center py-8 text-muted-foreground">
										<IndianRupee className="h-10 w-10 mx-auto mb-3 opacity-30" />
										<p>
											No payout claims submitted yet. Claims can be made for
											disbursed loans.
										</p>
									</div>
								) : (
									<div className="overflow-x-auto">
										<Table>
											<TableHeader>
												<TableRow>
													<TableHead>Claim ID</TableHead>
													<TableHead>Lead / Customer</TableHead>
													<TableHead>Financier</TableHead>
													<TableHead>Amount</TableHead>
													<TableHead>Disbursement Date</TableHead>
													<TableHead>PDD Status</TableHead>
													<TableHead>Claim Status</TableHead>
													<TableHead>Created</TableHead>
													<TableHead>Actions</TableHead>
												</TableRow>
											</TableHeader>
											<TableBody>
												{claims.map((claim) => (
													<TableRow key={claim.id}>
														<TableCell className="font-mono text-sm">
															{claim.id.slice(0, 8)}
														</TableCell>
														<TableCell>
															{claim.customerName ||
																claim.leadId?.slice(0, 8) ||
																"—"}
														</TableCell>
														<TableCell className="text-muted-foreground">
															{claim.financierName || "—"}
														</TableCell>
														<TableCell>
															{formatCurrency(claim.disbursementAmount)}
														</TableCell>
														<TableCell className="text-muted-foreground">
															{claim.disbursementDate
																? new Date(
																		claim.disbursementDate,
																	).toLocaleDateString("en-IN")
																: "—"}
														</TableCell>
														<TableCell>
															<Badge variant="outline" className="text-xs">
																{claim.pddStatus}
															</Badge>
														</TableCell>
														<TableCell>
															<Badge
																variant="outline"
																className={
																	CLAIM_STATUS_COLORS[claim.claimStatus] || ""
																}
															>
																{claim.claimStatus}
															</Badge>
														</TableCell>
														<TableCell className="text-muted-foreground text-sm">
															{claim.createdAt
																? new Date(claim.createdAt).toLocaleDateString(
																		"en-IN",
																	)
																: "—"}
														</TableCell>
														<TableCell>
															<Button
																size="sm"
																variant="outline"
																className="h-8"
																onClick={() => {
																	setProofClaim(claim);
																	setProofDialogOpen(true);
																}}
															>
																<Upload className="h-3 w-3 mr-1" />
																Upload Proof
															</Button>
														</TableCell>
													</TableRow>
												))}
											</TableBody>
										</Table>
									</div>
								)}
							</CardContent>
						</Card>
					)}
				</TabsContent>

				<TabsContent value="contacts">
					<Card>
						<CardHeader>
							<CardTitle className="flex items-center gap-2">
								<Users className="h-5 w-5" />
								Banker Contacts Directory
							</CardTitle>
							<CardDescription>
								Search banker contacts by name, financier, DSA code, or product.
								Type at least 3 characters to search.
							</CardDescription>
						</CardHeader>
						<CardContent className="space-y-4">
							<div className="flex flex-col sm:flex-row gap-3">
								<div className="relative flex-1">
									<Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
									<Input
										placeholder="Search by name, financier, DSA code, or product (min 3 chars)..."
										value={bankerSearchQuery}
										onChange={(e) => setBankerSearchQuery(e.target.value)}
										className="pl-9"
									/>
								</div>
								<div className="flex gap-2">
									<label className="cursor-pointer">
										<input
											type="file"
											accept=".xlsx,.xls"
											className="hidden"
											onChange={async (e) => {
												const file = e.target.files?.[0];
												if (!file) return;
												setExcelUploading(true);
												try {
													const formData = new FormData();
													formData.append("file", file);
													const res = await fetch(
														"/api/agent/loans/banker-contacts/import-excel",
														{
															method: "POST",
															body: formData,
															credentials: "include",
														},
													);
													const result = await res.json();
													if (result.success) {
														toast({
															title: "Import Successful",
															description: `${result.data.imported} contacts imported, ${result.data.skipped} skipped`,
														});
														queryClient.invalidateQueries({
															queryKey: ["/api/agent/loans/banker-contacts"],
														});
													} else {
														toast({
															title: "Import Failed",
															description: result.error,
															variant: "destructive",
														});
													}
												} catch (err: any) {
													toast({
														title: "Upload Error",
														description: err.message,
														variant: "destructive",
													});
												} finally {
													setExcelUploading(false);
													e.target.value = "";
												}
											}}
										/>
										<Button variant="outline" asChild disabled={excelUploading}>
											<span className="flex items-center gap-2">
												{excelUploading ? (
													<Loader2 className="h-4 w-4 animate-spin" />
												) : (
													<Upload className="h-4 w-4" />
												)}
												Import Excel
											</span>
										</Button>
									</label>
									<Button
										variant="outline"
										onClick={async () => {
											try {
												await apiRequest(
													"/api/agent/loans/banker-contacts/sync-zoho",
													{
														method: "POST",
														body: JSON.stringify({ direction: "both" }),
													},
												);
												toast({
													title: "Zoho Sync Complete",
													description: "Banker contacts synced with Zoho CRM",
												});
												queryClient.invalidateQueries({
													queryKey: ["/api/agent/loans/banker-contacts"],
												});
											} catch (err: any) {
												toast({
													title: "Sync Failed",
													description: err.message,
													variant: "destructive",
												});
											}
										}}
									>
										<RefreshCw className="h-4 w-4 mr-1" /> Sync Zoho
									</Button>
									<Button
										variant="default"
										onClick={() => setAddContactOpen(true)}
									>
										<Plus className="h-4 w-4 mr-1" /> Add Contact
									</Button>
								</div>
							</div>

							{bankerSearchQuery.length > 0 && bankerSearchQuery.length < 3 && (
								<p className="text-sm text-muted-foreground">
									Type at least 3 characters to search...
								</p>
							)}

							{bankerContactsLoading ? (
								<div className="flex items-center justify-center py-8">
									<Loader2 className="h-6 w-6 animate-spin mr-2" />
									<span className="text-muted-foreground">
										Loading contacts...
									</span>
								</div>
							) : savedBankerContacts.length > 0 ? (
								<div className="border rounded-lg overflow-x-auto">
									<Table>
										<TableHeader>
											<TableRow>
												<TableHead>Financier Name</TableHead>
												<TableHead>DSA Code</TableHead>
												<TableHead>Products</TableHead>
												<TableHead>SM Name</TableHead>
												<TableHead>SM Mobile</TableHead>
												<TableHead>SM Branch</TableHead>
												<TableHead>RM Name</TableHead>
												<TableHead>RM Mobile</TableHead>
												<TableHead>Source</TableHead>
												<TableHead className="text-right">Actions</TableHead>
											</TableRow>
										</TableHeader>
										<TableBody>
											{savedBankerContacts.map((contact) => (
												<TableRow key={contact.id}>
													<TableCell className="font-medium">
														{contact.financierName}
													</TableCell>
													<TableCell>
														{contact.dsaCode ? (
															<Badge variant="secondary" className="text-xs">
																{contact.dsaCode}
															</Badge>
														) : (
															<span className="text-muted-foreground text-xs">
																-
															</span>
														)}
													</TableCell>
													<TableCell>
														<div className="flex flex-wrap gap-1">
															{contact.productNames &&
															contact.productNames.length > 0 ? (
																contact.productNames.map((p, idx) => (
																	<Badge
																		key={idx}
																		variant="outline"
																		className="text-[10px]"
																	>
																		{p}
																	</Badge>
																))
															) : (
																<span className="text-muted-foreground text-xs">
																	-
																</span>
															)}
														</div>
													</TableCell>
													<TableCell>{contact.bankerName}</TableCell>
													<TableCell>{contact.bankerMobile || "-"}</TableCell>
													<TableCell>{contact.branch || "-"}</TableCell>
													<TableCell>{contact.rmName || "-"}</TableCell>
													<TableCell>{contact.rmMobile || "-"}</TableCell>
													<TableCell>
														<Badge
															variant={
																contact.source === "excel_import"
																	? "secondary"
																	: "outline"
															}
															className="text-[10px] capitalize"
														>
															{contact.source === "excel_import"
																? "Excel"
																: contact.source || "Manual"}
														</Badge>
													</TableCell>
													<TableCell className="text-right">
														<Button
															variant="ghost"
															size="sm"
															onClick={() => {
																form.setValue(
																	"financierName",
																	contact.financierName,
																);
																form.setValue("dsaCode", contact.dsaCode || "");
																form.setValue("bankerName", contact.bankerName);
																form.setValue(
																	"bankerMobile",
																	contact.bankerMobile || "",
																);
																form.setValue(
																	"bankerEmail",
																	contact.bankerEmail || "",
																);
																form.setValue("branch", contact.branch || "");
																form.setValue("rmName", contact.rmName || "");
																form.setValue(
																	"rmMobile",
																	contact.rmMobile || "",
																);
																form.setValue("rmEmail", contact.rmEmail || "");
																form.setValue(
																	"processingMode",
																	"EXTERNAL_FINANCIER",
																);
																setActiveTab("apply");
																toast({
																	title: "Contact Applied",
																	description: `${contact.bankerName} details filled in the form`,
																});
															}}
														>
															<ArrowRight className="h-4 w-4 mr-1" /> Use
														</Button>
													</TableCell>
												</TableRow>
											))}
										</TableBody>
									</Table>
								</div>
							) : bankerSearchQuery.length >= 3 ? (
								<div className="text-center py-8 space-y-3">
									<p className="text-muted-foreground">
										No banker contacts found for "{bankerSearchQuery}"
									</p>
									<Button
										variant="outline"
										onClick={() => setAddContactOpen(true)}
									>
										<Plus className="h-4 w-4 mr-1" /> Add New Contact
									</Button>
								</div>
							) : (
								<div className="text-center py-8 text-muted-foreground">
									<p>
										Search for contacts or import from Excel to get started.
									</p>
								</div>
							)}
						</CardContent>
					</Card>
				</TabsContent>
			</Tabs>

			<Dialog open={addContactOpen} onOpenChange={setAddContactOpen}>
				<DialogContent className="max-w-md">
					<DialogHeader>
						<DialogTitle>Add Banker Contact</DialogTitle>
						<DialogDescription>
							Add a new banker contact to the directory.
						</DialogDescription>
					</DialogHeader>
					<form
						onSubmit={async (e) => {
							e.preventDefault();
							const formData = new FormData(e.currentTarget);
							const productRaw = (formData.get("productNames") as string) || "";
							const products = productRaw
								.split(/[,&\/]+/)
								.map((p) => p.trim().toUpperCase())
								.filter(Boolean);
							try {
								await apiRequest("/api/agent/loans/banker-contacts", {
									method: "POST",
									body: JSON.stringify({
										financierName: formData.get("financierName"),
										dsaCode: formData.get("dsaCode") || undefined,
										productNames: products,
										bankerName: formData.get("bankerName"),
										bankerMobile: formData.get("bankerMobile") || undefined,
										bankerEmail: formData.get("bankerEmail") || undefined,
										branch: formData.get("branch") || undefined,
										rmName: formData.get("rmName") || undefined,
										rmMobile: formData.get("rmMobile") || undefined,
										rmEmail: formData.get("rmEmail") || undefined,
									}),
								});
								toast({ title: "Contact Added" });
								queryClient.invalidateQueries({
									queryKey: ["/api/agent/loans/banker-contacts"],
								});
								setAddContactOpen(false);
							} catch (err: any) {
								toast({
									title: "Error",
									description: err.message,
									variant: "destructive",
								});
							}
						}}
						className="space-y-3"
					>
						<div className="space-y-2">
							<Label>Financier Name *</Label>
							<Input
								name="financierName"
								required
								placeholder="e.g. HDFC Bank"
							/>
						</div>
						<div className="space-y-2">
							<Label>DSA Code</Label>
							<Input name="dsaCode" placeholder="e.g. MUM01329" />
						</div>
						<div className="space-y-2">
							<Label>Products (comma-separated)</Label>
							<Input name="productNames" placeholder="e.g. HL, PL, LAP" />
						</div>
						<div className="space-y-2">
							<Label>SM Name (Sales Manager) *</Label>
							<Input
								name="bankerName"
								required
								placeholder="Sales manager / contact person name"
							/>
						</div>
						<div className="space-y-2">
							<Label>SM Mobile Number</Label>
							<Input name="bankerMobile" placeholder="10-digit mobile" />
						</div>
						<div className="space-y-2">
							<Label>SM Email</Label>
							<Input
								name="bankerEmail"
								type="email"
								placeholder="email@bank.com"
							/>
						</div>
						<div className="space-y-2">
							<Label>SM Branch</Label>
							<Input name="branch" placeholder="e.g. Bangalore - Whitefield" />
						</div>
						<div className="space-y-2">
							<Label>RM Name (Relationship Manager)</Label>
							<Input name="rmName" placeholder="Relationship manager name" />
						</div>
						<div className="space-y-2">
							<Label>RM Mobile Number</Label>
							<Input name="rmMobile" placeholder="10-digit mobile" />
						</div>
						<div className="space-y-2">
							<Label>RM Email</Label>
							<Input name="rmEmail" type="email" placeholder="rm@bank.com" />
						</div>
						<DialogFooter>
							<Button
								type="button"
								variant="outline"
								onClick={() => setAddContactOpen(false)}
							>
								Cancel
							</Button>
							<Button type="submit">Save Contact</Button>
						</DialogFooter>
					</form>
				</DialogContent>
			</Dialog>

			<Dialog open={routeDialogOpen} onOpenChange={setRouteDialogOpen}>
				<DialogContent className="max-w-lg">
					<DialogHeader>
						<DialogTitle>Assign Banks</DialogTitle>
						<DialogDescription>
							Select banks to route this loan application to
						</DialogDescription>
					</DialogHeader>
					{selectedApp && (
						<div className="space-y-4">
							<div className="p-3 bg-muted rounded-lg">
								<p className="font-medium">{selectedApp.applicantName}</p>
								<p className="text-sm text-muted-foreground">
									{loanTypeLabels[selectedApp.loanType]} -{" "}
									{formatCurrency(selectedApp.requestedAmount)}
								</p>
							</div>

							<div className="space-y-2">
								<p className="text-sm font-medium">
									Select Banks ({selectedBanks.length} selected)
								</p>
								<div className="max-h-64 overflow-y-auto space-y-2 border rounded-lg p-2">
									{getEligibleBanks(selectedApp.loanType).map((bank) => (
										<div
											key={bank.bankCode}
											className="flex items-center space-x-3 p-2 hover:bg-muted rounded-md cursor-pointer"
											onClick={() => handleBankToggle(bank.bankCode)}
										>
											<Checkbox
												checked={selectedBanks.includes(bank.bankCode)}
												onCheckedChange={() => handleBankToggle(bank.bankCode)}
											/>
											<div className="flex-1">
												<p className="font-medium">{bank.bankName}</p>
												<p className="text-xs text-muted-foreground">
													{bank.bankCode}
												</p>
											</div>
										</div>
									))}
									{getEligibleBanks(selectedApp.loanType).length === 0 && (
										<p className="text-sm text-muted-foreground text-center py-4">
											No banks available for this loan type
										</p>
									)}
								</div>
							</div>
						</div>
					)}
					<DialogFooter>
						<Button variant="outline" onClick={() => setRouteDialogOpen(false)}>
							Cancel
						</Button>
						<Button
							onClick={handleRouteSubmit}
							disabled={selectedBanks.length === 0 || routeMutation.isPending}
						>
							{routeMutation.isPending
								? "Routing..."
								: `Route to ${selectedBanks.length} Bank(s)`}
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>

			<Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
				<DialogContent>
					<DialogHeader>
						<DialogTitle>Delete Application</DialogTitle>
						<DialogDescription>
							Are you sure you want to delete this loan application? This action
							cannot be undone.
						</DialogDescription>
					</DialogHeader>
					{selectedApp && (
						<div className="p-3 bg-muted rounded-lg">
							<p className="font-medium">{selectedApp.applicantName}</p>
							<p className="text-sm text-muted-foreground">
								{selectedApp.applicationNumber} -{" "}
								{loanTypeLabels[selectedApp.loanType]}
							</p>
						</div>
					)}
					<DialogFooter>
						<Button
							variant="outline"
							onClick={() => setDeleteDialogOpen(false)}
						>
							Cancel
						</Button>
						<Button
							variant="destructive"
							onClick={handleDeleteConfirm}
							disabled={deleteMutation.isPending}
						>
							{deleteMutation.isPending ? "Deleting..." : "Delete Application"}
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>

			<Dialog open={detailsDialogOpen} onOpenChange={setDetailsDialogOpen}>
				<DialogContent className="max-w-lg">
					<DialogHeader>
						<DialogTitle>Application Details</DialogTitle>
						<DialogDescription>
							View complete details of this loan application
						</DialogDescription>
					</DialogHeader>
					{selectedApp && (
						<div className="space-y-4">
							<div className="grid grid-cols-2 gap-4">
								<div>
									<p className="text-sm text-muted-foreground">
										Application Number
									</p>
									<p className="font-medium">{selectedApp.applicationNumber}</p>
								</div>
								<div>
									<p className="text-sm text-muted-foreground">Status</p>
									<Badge className={statusColors[selectedApp.status]}>
										{selectedApp.status?.replace(/_/g, " ")}
									</Badge>
								</div>
								<div>
									<p className="text-sm text-muted-foreground">
										Applicant Name
									</p>
									<p className="font-medium">{selectedApp.applicantName}</p>
								</div>
								<div>
									<p className="text-sm text-muted-foreground">Phone</p>
									<p className="font-medium">{selectedApp.applicantPhone}</p>
								</div>
								<div>
									<p className="text-sm text-muted-foreground">Loan Type</p>
									<p className="font-medium">
										{loanTypeLabels[selectedApp.loanType]}
									</p>
								</div>
								<div>
									<p className="text-sm text-muted-foreground">Amount</p>
									<p className="font-medium">
										{formatCurrency(selectedApp.requestedAmount)}
									</p>
								</div>
								<div>
									<p className="text-sm text-muted-foreground">Tenure</p>
									<p className="font-medium">
										{selectedApp.requestedTenure} months
									</p>
								</div>
								<div>
									<p className="text-sm text-muted-foreground">
										Monthly Income
									</p>
									<p className="font-medium">
										{formatCurrency(selectedApp.monthlyIncome || 0)}
									</p>
								</div>
							</div>
							<div>
								<p className="text-sm font-medium mb-2">Bank Routing Status</p>
								{loadingHistory ? (
									<div className="flex items-center gap-2 text-sm text-muted-foreground py-2">
										<Loader2 className="h-4 w-4 animate-spin" />
										Loading bank responses...
									</div>
								) : routingHistory.length > 0 ? (
									<div className="space-y-2 max-h-48 overflow-y-auto">
										{routingHistory.map((history) => (
											<div
												key={history.id}
												className={`p-3 rounded-lg border ${
													history.bankStatus === "approved"
														? "bg-green-50 dark:bg-green-950/30 border-green-200 dark:border-green-800"
														: history.bankStatus === "rejected"
															? "bg-red-50 dark:bg-red-950/30 border-red-200 dark:border-red-800"
															: history.bankStatus === "in_review"
																? "bg-blue-50 dark:bg-blue-950/30 border-blue-200 dark:border-blue-800"
																: "bg-yellow-50 dark:bg-yellow-950/30 border-yellow-200 dark:border-yellow-800"
												}`}
											>
												<div className="flex items-center justify-between mb-1">
													<span className="font-medium text-sm">
														{history.bankCode}
													</span>
													<Badge
														className={
															bankStatusColors[history.bankStatus] || "bg-muted"
														}
													>
														{history.bankStatus?.replace(/_/g, " ")}
													</Badge>
												</div>
												<div className="text-xs text-muted-foreground">
													Submitted: {formatDate(history.submittedAt)}
													{history.responseReceivedAt && (
														<span>
															{" "}
															| Response:{" "}
															{formatDate(history.responseReceivedAt)}
														</span>
													)}
												</div>
												{history.bankStatus === "approved" &&
													history.offeredInterestRate && (
														<div className="mt-1 text-xs">
															<span className="text-green-700 dark:text-green-300">
																Rate: {history.offeredInterestRate}% p.a.
																{history.approvedAmount &&
																	` | Amount: ${formatCurrency(history.approvedAmount)}`}
															</span>
														</div>
													)}
												{history.bankStatus === "rejected" &&
													history.rejectionReason && (
														<div className="mt-1 text-xs text-red-700 dark:text-red-300">
															Reason: {history.rejectionReason}
														</div>
													)}
											</div>
										))}
									</div>
								) : (selectedApp.routedBanks || []).length > 0 ? (
									<div className="flex flex-wrap gap-2">
										{selectedApp.routedBanks.map((bank: string) => (
											<Badge key={bank} variant="outline">
												{bank}
											</Badge>
										))}
									</div>
								) : (
									<p className="text-sm text-muted-foreground">
										No banks routed yet
									</p>
								)}
							</div>
							{selectedApp.loanPurpose && (
								<div>
									<p className="text-sm text-muted-foreground">Purpose</p>
									<p className="font-medium">{selectedApp.loanPurpose}</p>
								</div>
							)}
						</div>
					)}
					<DialogFooter>
						<Button
							variant="outline"
							onClick={() => setDetailsDialogOpen(false)}
						>
							Close
						</Button>
						{selectedApp && canEdit(selectedApp.status) && (
							<Button
								onClick={() => {
									setDetailsDialogOpen(false);
									openRouteDialog(selectedApp);
								}}
							>
								<Send className="h-4 w-4 mr-2" />
								Assign Banks
							</Button>
						)}
					</DialogFooter>
				</DialogContent>
			</Dialog>

			<Dialog
				open={eligibilityDialogOpen}
				onOpenChange={setEligibilityDialogOpen}
			>
				<DialogContent className="max-w-2xl">
					<DialogHeader>
						<DialogTitle>Bank Eligibility Results</DialogTitle>
						<DialogDescription>
							Based on the applicant's profile, here are the eligible banks
						</DialogDescription>
					</DialogHeader>
					<div className="space-y-3 max-h-96 overflow-y-auto">
						{eligibilityResults.map((result) => (
							<div
								key={result.bankCode}
								className={`p-3 rounded-lg border ${result.eligible ? "bg-green-50 dark:bg-green-950/30 border-green-200 dark:border-green-800" : "bg-red-50 dark:bg-red-950/30 border-red-200 dark:border-red-800"}`}
							>
								<div className="flex items-center justify-between">
									<div className="flex items-center gap-2">
										{result.eligible ? (
											<CheckCircle2 className="h-5 w-5 text-green-600" />
										) : (
											<XCircle className="h-5 w-5 text-red-600" />
										)}
										<span className="font-medium">{result.bankName}</span>
									</div>
									<div className="flex items-center gap-2">
										<Badge variant={result.eligible ? "default" : "secondary"}>
											Score: {result.matchScore}%
										</Badge>
										{result.estimatedRate && (
											<Badge variant="outline">
												{result.estimatedRate}% p.a.
											</Badge>
										)}
									</div>
								</div>
								<div className="mt-2 text-sm text-muted-foreground">
									{result.reasons.join(", ")}
								</div>
							</div>
						))}
					</div>
					<DialogFooter>
						<Button
							variant="outline"
							onClick={() => setEligibilityDialogOpen(false)}
						>
							Close
						</Button>
						{selectedApp &&
							eligibilityResults.filter((r) => r.eligible).length > 0 && (
								<Button
									onClick={() => {
										setEligibilityDialogOpen(false);
										setSelectedBanks(
											eligibilityResults
												.filter((r) => r.eligible)
												.map((r) => r.bankCode),
										);
										setRouteDialogOpen(true);
									}}
								>
									<Send className="h-4 w-4 mr-2" />
									Route to Eligible Banks
								</Button>
							)}
					</DialogFooter>
				</DialogContent>
			</Dialog>

			<Dialog
				open={payoutClaimDialogOpen}
				onOpenChange={setPayoutClaimDialogOpen}
			>
				<DialogContent className="max-w-lg">
					<DialogHeader>
						<DialogTitle className="flex items-center gap-2">
							<DollarSign className="h-5 w-5 text-emerald-600" />
							Claim Payout
						</DialogTitle>
						<DialogDescription>
							Submit payout claim for {selectedApp?.applicantName} —{" "}
							{selectedApp?.processingMode === "EXTERNAL_FINANCIER"
								? "Bank-Processed"
								: "Agent-Processed"}{" "}
							lead
						</DialogDescription>
					</DialogHeader>
					<div className="space-y-4">
						<div className="bg-muted/50 p-3 rounded-lg text-sm space-y-1">
							<div className="flex justify-between">
								<span className="text-muted-foreground">Application</span>
								<span className="font-medium">
									{selectedApp?.applicationNumber}
								</span>
							</div>
							<div className="flex justify-between">
								<span className="text-muted-foreground">Loan Type</span>
								<span className="font-medium capitalize">
									{selectedApp?.loanType}
								</span>
							</div>
							<div className="flex justify-between">
								<span className="text-muted-foreground">Processing Mode</span>
								<Badge
									variant={
										selectedApp?.processingMode === "EXTERNAL_FINANCIER"
											? "secondary"
											: "default"
									}
									className="text-xs"
								>
									{selectedApp?.processingMode === "EXTERNAL_FINANCIER"
										? "Bank Processed"
										: "Agent Processed"}
								</Badge>
							</div>
							{selectedApp?.financierName && (
								<div className="flex justify-between">
									<span className="text-muted-foreground">Financier</span>
									<span className="font-medium">
										{selectedApp.financierName}
									</span>
								</div>
							)}
						</div>

						<div className="space-y-3">
							<div>
								<Label>Disbursement Amount (₹) *</Label>
								<Input
									type="number"
									placeholder="Enter disbursed amount"
									value={payoutClaimForm.disbursementAmount}
									onChange={(e) =>
										setPayoutClaimForm((prev) => ({
											...prev,
											disbursementAmount: e.target.value,
										}))
									}
								/>
							</div>
							<div>
								<Label>Disbursement Date *</Label>
								<Input
									type="date"
									value={payoutClaimForm.disbursementDate}
									onChange={(e) =>
										setPayoutClaimForm((prev) => ({
											...prev,
											disbursementDate: e.target.value,
										}))
									}
								/>
							</div>
							<div>
								<Label>Loan Account Number *</Label>
								<Input
									placeholder="Enter loan account number"
									value={payoutClaimForm.loanAccountNumber}
									onChange={(e) =>
										setPayoutClaimForm((prev) => ({
											...prev,
											loanAccountNumber: e.target.value,
										}))
									}
								/>
							</div>
							<div>
								<Label>PDD Status</Label>
								<Select
									value={payoutClaimForm.pddStatus}
									onValueChange={(v) =>
										setPayoutClaimForm((prev) => ({ ...prev, pddStatus: v }))
									}
								>
									<SelectTrigger>
										<SelectValue />
									</SelectTrigger>
									<SelectContent>
										<SelectItem value="NOT_APPLICABLE">
											Not Applicable
										</SelectItem>
										<SelectItem value="PENDING">Pending</SelectItem>
										<SelectItem value="SUBMITTED">Submitted</SelectItem>
										<SelectItem value="CLEARED">Cleared</SelectItem>
									</SelectContent>
								</Select>
							</div>
							<div className="flex items-center gap-2">
								<Checkbox
									id="subvention"
									checked={payoutClaimForm.subventionFlag}
									onCheckedChange={(c) =>
										setPayoutClaimForm((prev) => ({
											...prev,
											subventionFlag: !!c,
										}))
									}
								/>
								<Label htmlFor="subvention" className="text-sm">
									Subvention Case
								</Label>
							</div>
							<div className="flex items-center gap-2">
								<Checkbox
									id="teamCase"
									checked={payoutClaimForm.teamCase}
									onCheckedChange={(c) =>
										setPayoutClaimForm((prev) => ({ ...prev, teamCase: !!c }))
									}
								/>
								<Label htmlFor="teamCase" className="text-sm">
									Team Case (split commission)
								</Label>
							</div>
							{payoutClaimForm.teamCase && (
								<div>
									<Label>Team Member IDs (comma-separated)</Label>
									<Input
										placeholder="agent-id-1, agent-id-2"
										value={payoutClaimForm.teamMembers}
										onChange={(e) =>
											setPayoutClaimForm((prev) => ({
												...prev,
												teamMembers: e.target.value,
											}))
										}
									/>
								</div>
							)}
						</div>
					</div>
					<DialogFooter>
						<Button
							variant="outline"
							onClick={() => setPayoutClaimDialogOpen(false)}
						>
							Cancel
						</Button>
						<Button
							onClick={() => submitPayoutClaimMutation.mutate()}
							disabled={
								submitPayoutClaimMutation.isPending ||
								!payoutClaimForm.disbursementAmount ||
								!payoutClaimForm.disbursementDate ||
								!payoutClaimForm.loanAccountNumber
							}
							className="bg-emerald-600 hover:bg-emerald-700"
						>
							{submitPayoutClaimMutation.isPending ? (
								<Loader2 className="h-4 w-4 mr-2 animate-spin" />
							) : (
								<DollarSign className="h-4 w-4 mr-2" />
							)}
							Submit Payout Claim
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>

			{/* Audit Trail Dialog */}
			<Dialog open={auditDialogOpen} onOpenChange={setAuditDialogOpen}>
				<DialogContent className="max-w-md">
					<DialogHeader>
						<DialogTitle>Audit Trail</DialogTitle>
						<DialogDescription>
							Activity log for {auditLead?.customerName || "this lead"}
						</DialogDescription>
					</DialogHeader>
					{auditLead && (
						<div className="space-y-3 mt-2">
							<div className="flex items-center gap-3 p-3 bg-muted rounded-lg border">
								<CheckCircle className="h-4 w-4 text-emerald-500 flex-shrink-0" />
								<div>
									<p className="text-sm font-medium">Lead Registered</p>
									<p className="text-muted-foreground text-xs">
										{auditLead.firstTouchTimestamp
											? new Date(auditLead.firstTouchTimestamp).toLocaleString(
													"en-IN",
												)
											: "—"}
									</p>
								</div>
							</div>
							{auditLead.processingMode && (
								<div className="flex items-center gap-3 p-3 bg-muted rounded-lg border">
									<LucideShield className="h-4 w-4 text-blue-500 flex-shrink-0" />
									<div>
										<p className="text-sm font-medium">
											Processing Mode: {auditLead.processingMode}
										</p>
									</div>
								</div>
							)}
							<div className="flex items-center gap-3 p-3 bg-muted rounded-lg border">
								<AlertTriangle className="h-4 w-4 text-yellow-500 flex-shrink-0" />
								<div>
									<p className="text-sm font-medium">
										Current Status: {auditLead.status}
									</p>
								</div>
							</div>
						</div>
					)}
				</DialogContent>
			</Dialog>

			{/* Upload Proof Dialog */}
			<Dialog open={proofDialogOpen} onOpenChange={setProofDialogOpen}>
				<DialogContent className="max-w-md">
					<DialogHeader>
						<DialogTitle>Upload Proof</DialogTitle>
						<DialogDescription>
							Provide file metadata for claim {proofClaim?.id?.slice(0, 8)}
						</DialogDescription>
					</DialogHeader>
					<div className="space-y-4 mt-4">
						<div>
							<Label>File Name</Label>
							<Input
								value={proofForm.fileName}
								onChange={(e) =>
									setProofForm({ ...proofForm, fileName: e.target.value })
								}
								className="mt-1"
								placeholder="disbursement_letter.pdf"
							/>
						</div>
						<div className="grid grid-cols-2 gap-4">
							<div>
								<Label>File Type</Label>
								<Input
									value={proofForm.fileType}
									onChange={(e) =>
										setProofForm({ ...proofForm, fileType: e.target.value })
									}
									className="mt-1"
									placeholder="application/pdf"
								/>
							</div>
							<div>
								<Label>File Size</Label>
								<Input
									value={proofForm.fileSize}
									onChange={(e) =>
										setProofForm({ ...proofForm, fileSize: e.target.value })
									}
									className="mt-1"
									placeholder="2048000"
								/>
							</div>
						</div>
						<div>
							<Label>File Hash</Label>
							<Input
								value={proofForm.fileHash}
								onChange={(e) =>
									setProofForm({ ...proofForm, fileHash: e.target.value })
								}
								className="mt-1"
								placeholder="sha256:abc123..."
							/>
						</div>
						<div>
							<Label>Storage Path</Label>
							<Input
								value={proofForm.storagePath}
								onChange={(e) =>
									setProofForm({ ...proofForm, storagePath: e.target.value })
								}
								className="mt-1"
								placeholder="/proofs/claim-xyz/file.pdf"
							/>
						</div>
						<DialogFooter>
							<Button
								variant="outline"
								onClick={() => setProofDialogOpen(false)}
							>
								Cancel
							</Button>
							<Button
								onClick={() => {
									if (proofClaim) {
										uploadProofMutation.mutate({
											claimId: proofClaim.id,
											proof: proofForm,
										});
									}
								}}
								disabled={!proofForm.fileName || uploadProofMutation.isPending}
								className="bg-emerald-600 hover:bg-emerald-700"
							>
								{uploadProofMutation.isPending && (
									<Loader2 className="h-4 w-4 mr-2 animate-spin" />
								)}
								Upload Proof
							</Button>
						</DialogFooter>
					</div>
				</DialogContent>
			</Dialog>
		</div>
	);
}
