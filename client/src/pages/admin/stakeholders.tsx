import { useState, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import {
	Users,
	Building2,
	Headphones,
	Package,
	Search,
	Filter,
	Download,
	Plus,
	MoreVertical,
	TrendingUp,
	TrendingDown,
	Mail,
	Phone,
	MapPin,
	Check,
	X,
	RefreshCw,
	Pencil,
	Trash2,
	Eye,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
	DialogTrigger,
} from "@/components/ui/dialog";
import {
	AlertDialog,
	AlertDialogAction,
	AlertDialogCancel,
	AlertDialogContent,
	AlertDialogDescription,
	AlertDialogFooter,
	AlertDialogHeader,
	AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuLabel,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { z } from "zod";
import type {
	InsertPartner,
	InsertAgent,
	InsertSupplier,
} from "@shared/schema";

function buildUrl(base: string, params: Record<string, any>): string {
	const url = new URL(base, window.location.origin);
	Object.entries(params).forEach(([key, value]) => {
		if (value !== undefined && value !== null && value !== "") {
			url.searchParams.append(key, String(value));
		}
	});
	return url.pathname + url.search;
}

interface StakeholderStats {
	clients: { total: number; growth: number };
	partners: { total: number; growth: number };
	agents: { total: number; growth: number };
	suppliers: { total: number; growth: number };
}

type StakeholderType = "clients" | "partners" | "agents" | "suppliers";

interface User {
	id: string;
	userId: string;
	fullName: string;
	email: string;
	mobile: string | null;
	roles: string[];
	status: string;
	kycStatus?: string;
	createdAt: string;
	agentId?: string | null;
	agentName?: string | null;
}

const AVAILABLE_ROLES = [
	{ value: "user", label: "User" },
	{ value: "client", label: "Client" },
	{ value: "agent", label: "Agent" },
	{ value: "partner", label: "Partner" },
	{ value: "admin", label: "Admin" },
	{ value: "superadmin", label: "Super Admin" },
	{ value: "business_client", label: "Business Client" },
];

interface Partner {
	id: string;
	companyName: string;
	contactEmail: string;
	contactPhone: string | null;
	partnerType: string;
	status: string;
	revenueShare: string | null;
	commissionRate: string | null;
	isActive: boolean;
	createdAt: string;
}

interface Agent {
	id: string;
	fullName: string;
	email: string;
	phone: string | null;
	employeeId: string | null;
	arnCode: string | null;
	euinNumber: string | null;
	agentType: string;
	status: string;
	isActive: boolean;
	activeClients: number;
	totalRevenue: string;
	commissionSplitModel: string | null;
	defaultCommissionShare: string | null;
	createdAt: string;
}

interface Supplier {
	id: string;
	name: string;
	contactEmail: string | null;
	contactPhone: string | null;
	address: string | null;
	productCategories: string[];
	commissionRate: string | null;
	isActive: boolean;
	status: string;
	createdAt: string;
}

// Standalone schemas — avoids circular-dependency TDZ crash in production bundles
const partnerSchema = z.object({
	companyName: z.string().min(1, "Company name is required"),
	contactEmail: z.string().email("Valid email is required"),
	contactPhone: z.string().optional(),
	password: z.string().min(8, "Password must be at least 8 characters"),
	partnerType: z.string().min(1, "Partner type is required"),
	commissionRate: z.string().optional(),
	isActive: z.boolean().optional(),
});

const partnerEditSchema = z.object({
	companyName: z.string().min(1).optional(),
	contactEmail: z.string().email().optional(),
	contactPhone: z.string().optional(),
	password: z.string().min(8).optional().or(z.literal("")),
	partnerType: z.string().optional(),
	commissionRate: z.string().optional(),
	isActive: z.boolean().optional(),
});

const agentSchema = z.object({
	fullName: z.string().min(1, "Full name is required"),
	email: z.string().email("Valid email is required"),
	phone: z.string().optional(),
	employeeId: z.string().optional(),
	arnCode: z.string().optional(),
	euinNumber: z.string().optional(),
	agentType: z.string().min(1, "Agent type is required"),
	status: z.string().optional(),
});

const supplierSchema = z.object({
	companyName: z.string().min(1, "Company name is required"),
	contactEmail: z.string().email("Valid email is required"),
	contactPhone: z.string().optional(),
	supplierType: z.string().optional(),
	isActive: z.boolean().optional(),
});

export default function StakeholdersPage() {
	const [activeTab, setActiveTab] = useState<StakeholderType>("clients");
	const [searchQuery, setSearchQuery] = useState("");
	const [statusFilter, setStatusFilter] = useState<string>("all");
	const [currentPage, setCurrentPage] = useState(1);
	const pageLimit = 20;
	const { toast } = useToast();

	// Dialog states
	const [isAddPartnerOpen, setIsAddPartnerOpen] = useState(false);
	const [isAddAgentOpen, setIsAddAgentOpen] = useState(false);
	const [isAddSupplierOpen, setIsAddSupplierOpen] = useState(false);
	const [editingPartner, setEditingPartner] = useState<Partner | null>(null);
	const [editingAgent, setEditingAgent] = useState<Agent | null>(null);
	const [editingSupplier, setEditingSupplier] = useState<Supplier | null>(null);
	const [viewingClient, setViewingClient] = useState<User | null>(null);
	const [editingClient, setEditingClient] = useState<User | null>(null);
	const [deletingItem, setDeletingItem] = useState<{
		id: string;
		type: StakeholderType;
		name: string;
	} | null>(null);
	const [selectedClients, setSelectedClients] = useState<Set<string>>(
		new Set(),
	);
	const [bulkAssignAgentId, setBulkAssignAgentId] = useState<string>("");
	const [editFormRoles, setEditFormRoles] = useState<string[]>([]);
	const [editFormAgentId, setEditFormAgentId] = useState<string>("");

	const queryParams = useMemo(
		() => ({
			search: searchQuery || undefined,
			status: statusFilter === "all" ? undefined : statusFilter,
			page: currentPage,
			limit: pageLimit,
		}),
		[searchQuery, statusFilter, currentPage, pageLimit],
	);

	const {
		data: statsData,
		isLoading: loadingStats,
		refetch: refetchStats,
	} = useQuery<{ success: boolean; data: StakeholderStats }>({
		queryKey: ["/api/admin/stakeholders/stats"],
		queryFn: async () => {
			const res = await fetch("/api/admin/stakeholders/stats", {
				credentials: "include",
			});
			if (!res.ok) throw new Error("Failed to fetch stats");
			return res.json();
		},
	});

	const stats = statsData?.data || {
		clients: { total: 0, growth: 0 },
		partners: { total: 0, growth: 0 },
		agents: { total: 0, growth: 0 },
		suppliers: { total: 0, growth: 0 },
	};

	const {
		data: clientsData,
		isLoading: loadingClients,
		refetch: refetchClients,
	} = useQuery<any>({
		queryKey: ["/api/admin/users", queryParams],
		queryFn: async () => {
			const url = buildUrl("/api/admin/users", queryParams);
			const res = await fetch(url, { credentials: "include" });
			if (!res.ok) throw new Error("Failed to fetch clients");
			const data = await res.json();
			return { data: data.users || [], total: data.pagination?.total || 0 };
		},
		enabled: activeTab === "clients",
	});

	const {
		data: partnersData,
		isLoading: loadingPartners,
		refetch: refetchPartners,
	} = useQuery<any>({
		queryKey: ["/api/admin/partners", queryParams],
		queryFn: async () => {
			const url = buildUrl("/api/admin/partners", queryParams);
			const res = await fetch(url, { credentials: "include" });
			if (!res.ok) throw new Error("Failed to fetch partners");
			const json = await res.json();
			return json.data || { data: [], total: 0 };
		},
		enabled: activeTab === "partners",
	});

	const {
		data: agentsData,
		isLoading: loadingAgents,
		refetch: refetchAgents,
	} = useQuery<any>({
		queryKey: ["/api/admin/agents", queryParams],
		queryFn: async () => {
			const url = buildUrl("/api/admin/agents", queryParams);
			const res = await fetch(url, { credentials: "include" });
			if (!res.ok) throw new Error("Failed to fetch agents");
			const json = await res.json();
			// Handle multiple response formats from different endpoints
			const agentsList = json.agents || json.data?.data || json.data || [];
			const totalCount = json.total || json.data?.total || agentsList.length;
			return {
				data: Array.isArray(agentsList) ? agentsList : [],
				total: totalCount,
			};
		},
		enabled: activeTab === "agents",
	});

	const {
		data: suppliersData,
		isLoading: loadingSuppiers,
		refetch: refetchSuppliers,
	} = useQuery<any>({
		queryKey: ["/api/admin/suppliers", queryParams],
		queryFn: async () => {
			const url = buildUrl("/api/admin/suppliers", queryParams);
			const res = await fetch(url, { credentials: "include" });
			if (!res.ok) throw new Error("Failed to fetch suppliers");
			const json = await res.json();
			return json.data || { data: [], total: 0 };
		},
		enabled: activeTab === "suppliers",
	});

	// Fetch all agents for assignment dropdown (always enabled)
	const { data: allAgentsData } = useQuery<any>({
		queryKey: ["/api/admin/agents/list"],
		queryFn: async () => {
			const res = await fetch("/api/admin/agents?limit=100", {
				credentials: "include",
			});
			if (!res.ok) throw new Error("Failed to fetch agents");
			const json = await res.json();
			const agentsList = json.agents || json.data?.data || json.data || [];
			return Array.isArray(agentsList) ? agentsList : [];
		},
	});

	const availableAgents: Agent[] = allAgentsData || [];

	// Partner mutations
	const createPartnerMutation = useMutation({
		mutationFn: async (data: z.infer<typeof partnerSchema>) => {
			return apiRequest("/api/admin/partners", "POST", { body: data });
		},
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ["/api/admin/partners"] });
			queryClient.invalidateQueries({
				queryKey: ["/api/admin/stakeholders/stats"],
			});
			setIsAddPartnerOpen(false);
			toast({ title: "Partner created successfully" });
		},
		onError: (error: any) => {
			toast({
				title: "Failed to create partner",
				description: error.message || "An error occurred",
				variant: "destructive",
			});
		},
	});

	const updatePartnerMutation = useMutation({
		mutationFn: async ({ id, data }: { id: string; data: any }) => {
			return apiRequest(`/api/admin/partners/${id}`, "PATCH", { body: data });
		},
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ["/api/admin/partners"] });
			queryClient.invalidateQueries({
				queryKey: ["/api/admin/stakeholders/stats"],
			});
			setEditingPartner(null);
			toast({ title: "Partner updated successfully" });
		},
		onError: (error: any) => {
			toast({
				title: "Failed to update partner",
				description: error.message || "An error occurred",
				variant: "destructive",
			});
		},
	});

	// Agent mutations
	const createAgentMutation = useMutation({
		mutationFn: async (data: z.infer<typeof agentSchema>) => {
			return apiRequest("/api/admin/agents", "POST", { body: data });
		},
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ["/api/admin/agents"] });
			queryClient.invalidateQueries({
				queryKey: ["/api/admin/stakeholders/stats"],
			});
			setIsAddAgentOpen(false);
			toast({ title: "Agent created successfully" });
		},
		onError: (error: any) => {
			toast({
				title: "Failed to create agent",
				description: error.message || "An error occurred",
				variant: "destructive",
			});
		},
	});

	const updateAgentMutation = useMutation({
		mutationFn: async ({ id, data }: { id: string; data: any }) => {
			return apiRequest(`/api/admin/agents/${id}`, "PATCH", { body: data });
		},
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ["/api/admin/agents"] });
			queryClient.invalidateQueries({
				queryKey: ["/api/admin/stakeholders/stats"],
			});
			setEditingAgent(null);
			toast({ title: "Agent updated successfully" });
		},
		onError: (error: any) => {
			toast({
				title: "Failed to update agent",
				description: error.message || "An error occurred",
				variant: "destructive",
			});
		},
	});

	// Supplier mutations
	const createSupplierMutation = useMutation({
		mutationFn: async (data: any) => {
			return apiRequest("/api/admin/suppliers", "POST", { body: data });
		},
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ["/api/admin/suppliers"] });
			queryClient.invalidateQueries({
				queryKey: ["/api/admin/stakeholders/stats"],
			});
			setIsAddSupplierOpen(false);
			toast({ title: "Supplier created successfully" });
		},
		onError: (error: any) => {
			toast({
				title: "Failed to create supplier",
				description: error.message || "An error occurred",
				variant: "destructive",
			});
		},
	});

	const updateSupplierMutation = useMutation({
		mutationFn: async ({ id, data }: { id: string; data: any }) => {
			return apiRequest(`/api/admin/suppliers/${id}`, "PATCH", { body: data });
		},
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ["/api/admin/suppliers"] });
			queryClient.invalidateQueries({
				queryKey: ["/api/admin/stakeholders/stats"],
			});
			setEditingSupplier(null);
			toast({ title: "Supplier updated successfully" });
		},
		onError: (error: any) => {
			toast({
				title: "Failed to update supplier",
				description: error.message || "An error occurred",
				variant: "destructive",
			});
		},
	});

	// Delete mutation
	const deleteMutation = useMutation({
		mutationFn: async ({ id, type }: { id: string; type: StakeholderType }) => {
			const endpoint =
				type === "clients"
					? `/api/admin/users/${id}?permanent=true`
					: type === "partners"
						? `/api/admin/partners/${id}`
						: type === "agents"
							? `/api/admin/agents/${id}`
							: `/api/admin/suppliers/${id}`;
			return apiRequest(endpoint, "DELETE");
		},
		onSuccess: (_, variables) => {
			queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
			queryClient.invalidateQueries({ queryKey: ["/api/admin/partners"] });
			queryClient.invalidateQueries({ queryKey: ["/api/admin/agents"] });
			queryClient.invalidateQueries({ queryKey: ["/api/admin/suppliers"] });
			queryClient.invalidateQueries({
				queryKey: ["/api/admin/stakeholders/stats"],
			});
			setDeletingItem(null);
			toast({ title: "Deleted successfully" });
		},
		onError: (error: any) => {
			toast({
				title: "Failed to delete",
				description: error.message || "An error occurred",
				variant: "destructive",
			});
		},
	});

	// Get current data based on active tab
	const getCurrentData = () => {
		switch (activeTab) {
			case "clients":
				return clientsData;
			case "partners":
				return partnersData;
			case "agents":
				return agentsData;
			case "suppliers":
				return suppliersData;
			default:
				return null;
		}
	};

	const getCurrentLoading = () => {
		switch (activeTab) {
			case "clients":
				return loadingClients;
			case "partners":
				return loadingPartners;
			case "agents":
				return loadingAgents;
			case "suppliers":
				return loadingSuppiers;
			default:
				return false;
		}
	};

	const handleRefresh = () => {
		refetchStats();
		switch (activeTab) {
			case "clients":
				refetchClients();
				break;
			case "partners":
				refetchPartners();
				break;
			case "agents":
				refetchAgents();
				break;
			case "suppliers":
				refetchSuppliers();
				break;
		}
		toast({
			title: "Refreshed",
			description: "Stakeholder data has been refreshed",
		});
	};

	const handleStatusToggle = async (
		id: string,
		type: StakeholderType,
		currentStatus: string,
	) => {
		try {
			const newStatus = currentStatus === "active" ? "inactive" : "active";
			const endpoint =
				type === "clients"
					? `/api/admin/users/${id}/status`
					: type === "partners"
						? `/api/admin/partners/${id}/status`
						: type === "agents"
							? `/api/admin/agents/${id}/status`
							: `/api/admin/suppliers/${id}/status`;

			await apiRequest(endpoint, "PATCH", { body: { status: newStatus } });

			toast({
				title: "Status Updated",
				description: `Stakeholder ${newStatus === "active" ? "activated" : "deactivated"} successfully`,
			});

			handleRefresh();
		} catch (error) {
			toast({
				title: "Error",
				description: "Failed to update status",
				variant: "destructive",
			});
		}
	};

	const handleAddNew = () => {
		switch (activeTab) {
			case "partners":
				setIsAddPartnerOpen(true);
				break;
			case "agents":
				setIsAddAgentOpen(true);
				break;
			case "suppliers":
				setIsAddSupplierOpen(true);
				break;
		}
	};

	// Bulk selection helpers
	const clients: User[] = clientsData?.data || [];
	const handleSelectAll = (checked: boolean | "indeterminate") => {
		const isChecked = checked === true;
		if (isChecked) {
			setSelectedClients(new Set(clients.map((c) => c.id)));
		} else {
			setSelectedClients(new Set());
		}
	};

	const handleSelectClient = (
		clientId: string,
		checked: boolean | "indeterminate",
	) => {
		const isChecked = checked === true;
		const newSelected = new Set(selectedClients);
		if (isChecked) {
			newSelected.add(clientId);
		} else {
			newSelected.delete(clientId);
		}
		setSelectedClients(newSelected);
	};

	const handleOpenEditClient = (user: User) => {
		setEditingClient(user);
		setEditFormRoles(user.roles || []);
		setEditFormAgentId(user.agentId || "");
	};

	const handleToggleRole = (role: string) => {
		setEditFormRoles((prev) =>
			prev.includes(role) ? prev.filter((r) => r !== role) : [...prev, role],
		);
	};

	const handleBulkAssignAgent = async () => {
		if (!bulkAssignAgentId || selectedClients.size === 0) return;

		const agentIdToAssign =
			bulkAssignAgentId === "__unassign__" ? null : bulkAssignAgentId;

		try {
			const promises = Array.from(selectedClients).map((clientId) =>
				apiRequest(`/api/admin/users/${clientId}`, "PATCH", {
					body: { agentId: agentIdToAssign },
				}),
			);
			await Promise.all(promises);

			queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
			queryClient.invalidateQueries({
				queryKey: ["/api/stakeholders/clients"],
			});

			toast({
				title: "Clients Assigned",
				description: `${selectedClients.size} client(s) assigned to agent successfully`,
			});

			setSelectedClients(new Set());
			setBulkAssignAgentId("");
		} catch (error: any) {
			toast({
				title: "Assignment Failed",
				description: error.message || "Failed to assign clients to agent",
				variant: "destructive",
			});
		}
	};

	// Form handlers
	const handleCreatePartner = (e: React.FormEvent<HTMLFormElement>) => {
		e.preventDefault();
		const formData = new FormData(e.currentTarget);

		const data = {
			companyName: formData.get("companyName") as string,
			contactEmail: formData.get("contactEmail") as string,
			contactPhone: (formData.get("contactPhone") as string) || undefined,
			password: formData.get("password") as string,
			partnerType: formData.get("partnerType") as string,
			commissionRate: (formData.get("commissionRate") as string) || "0.00",
			isActive: formData.get("isActive") === "true",
		};

		try {
			partnerSchema.parse(data);
			createPartnerMutation.mutate(data as any);
		} catch (error) {
			if (error instanceof z.ZodError) {
				toast({
					title: "Validation Error",
					description: error.issues[0].message,
					variant: "destructive",
				});
			}
		}
	};

	const handleUpdatePartner = (e: React.FormEvent<HTMLFormElement>) => {
		e.preventDefault();
		if (!editingPartner) return;

		const formData = new FormData(e.currentTarget);

		const data: any = {
			companyName: formData.get("companyName") as string,
			contactEmail: formData.get("contactEmail") as string,
			contactPhone: (formData.get("contactPhone") as string) || undefined,
			partnerType: formData.get("partnerType") as string,
			commissionRate: (formData.get("commissionRate") as string) || "0.00",
			isActive: formData.get("isActive") === "true",
		};

		const password = formData.get("password") as string;
		if (password) {
			data.password = password;
		}

		updatePartnerMutation.mutate({ id: editingPartner.id, data });
	};

	const handleCreateAgent = (e: React.FormEvent<HTMLFormElement>) => {
		e.preventDefault();
		const formData = new FormData(e.currentTarget);

		const data = {
			fullName: formData.get("fullName") as string,
			email: formData.get("email") as string,
			phone: (formData.get("phone") as string) || undefined,
			employeeId: (formData.get("employeeId") as string) || undefined,
			arnCode: (formData.get("arnCode") as string) || undefined,
			euinNumber: (formData.get("euinNumber") as string) || undefined,
			agentType: formData.get("agentType") as string,
			status: formData.get("status") as string,
		};

		try {
			agentSchema.parse(data);
			createAgentMutation.mutate(data as any);
		} catch (error) {
			if (error instanceof z.ZodError) {
				toast({
					title: "Validation Error",
					description: error.issues[0].message,
					variant: "destructive",
				});
			}
		}
	};

	const handleUpdateAgent = (e: React.FormEvent<HTMLFormElement>) => {
		e.preventDefault();
		if (!editingAgent) return;

		const formData = new FormData(e.currentTarget);
		const commissionModel = formData.get("commissionSplitModel") as string;
		const commissionShare = formData.get("defaultCommissionShare") as string;

		const data: any = {
			fullName: formData.get("fullName") as string,
			email: formData.get("email") as string,
			phone: (formData.get("phone") as string) || undefined,
			employeeId: (formData.get("employeeId") as string) || undefined,
			arnCode: (formData.get("arnCode") as string) || undefined,
			euinNumber: (formData.get("euinNumber") as string) || undefined,
			agentType: formData.get("agentType") as string,
			status: formData.get("status") as string,
			commissionSplitModel: commissionModel,
		};

		// Only include commission share if using custom model and value is provided
		if (
			commissionModel === "custom" &&
			commissionShare &&
			commissionShare.trim() !== ""
		) {
			data.defaultCommissionShare = commissionShare;
		} else if (commissionModel === "standard") {
			// Clear commission share when switching to standard
			data.defaultCommissionShare = null;
		}

		updateAgentMutation.mutate({ id: editingAgent.id, data });
	};

	const handleCreateSupplier = (e: React.FormEvent<HTMLFormElement>) => {
		e.preventDefault();
		const formData = new FormData(e.currentTarget);

		const categoriesStr = formData.get("productCategories") as string;
		const categories = categoriesStr
			? categoriesStr.split(",").map((c) => c.trim())
			: [];

		const data = {
			name: formData.get("name") as string,
			contactEmail: (formData.get("contactEmail") as string) || undefined,
			contactPhone: (formData.get("contactPhone") as string) || undefined,
			address: (formData.get("address") as string) || undefined,
			productCategories: categories,
			commissionRate: (formData.get("commissionRate") as string) || "0.00",
			isActive: formData.get("isActive") === "true",
		};

		createSupplierMutation.mutate(data);
	};

	const handleUpdateSupplier = (e: React.FormEvent<HTMLFormElement>) => {
		e.preventDefault();
		if (!editingSupplier) return;

		const formData = new FormData(e.currentTarget);

		const categoriesStr = formData.get("productCategories") as string;
		const categories = categoriesStr
			? categoriesStr.split(",").map((c) => c.trim())
			: [];

		const data = {
			name: formData.get("name") as string,
			contactEmail: (formData.get("contactEmail") as string) || undefined,
			contactPhone: (formData.get("contactPhone") as string) || undefined,
			address: (formData.get("address") as string) || undefined,
			productCategories: categories,
			commissionRate: (formData.get("commissionRate") as string) || "0.00",
			isActive: formData.get("isActive") === "true",
		};

		updateSupplierMutation.mutate({ id: editingSupplier.id, data });
	};

	const currentData = getCurrentData();
	const isLoading = getCurrentLoading();
	const items = currentData?.data || [];
	const totalCount = currentData?.total || 0;
	const totalPages = Math.ceil(totalCount / pageLimit);

	return (
		<div className="space-y-6">
			{/* Header */}
			<div>
				<h1 className="text-3xl font-bold text-foreground">
					Stakeholder Management
				</h1>
				<p className="text-muted-foreground mt-2">
					Manage clients, partners, agents, and suppliers across your platform
				</p>
			</div>

			{/* Summary Cards */}
			<div className="grid grid-cols-1 md:grid-cols-4 gap-6">
				<Card data-testid="card-clients-summary">
					<CardHeader className="flex flex-row items-center justify-between pb-2">
						<CardTitle className="text-sm font-medium text-muted-foreground">
							Total Clients
						</CardTitle>
						<Users className="h-4 w-4 text-blue-600" />
					</CardHeader>
					<CardContent>
						<div className="text-2xl font-bold text-foreground">
							{loadingStats ? "..." : stats.clients.total}
						</div>
						<p
							className={`text-xs flex items-center mt-1 ${stats.clients.growth >= 0 ? "text-green-600" : "text-red-600"}`}
						>
							{stats.clients.growth >= 0 ? (
								<TrendingUp className="h-3 w-3 mr-1" />
							) : (
								<TrendingDown className="h-3 w-3 mr-1" />
							)}
							{Math.abs(stats.clients.growth)}% from last month
						</p>
					</CardContent>
				</Card>

				<Card data-testid="card-partners-summary">
					<CardHeader className="flex flex-row items-center justify-between pb-2">
						<CardTitle className="text-sm font-medium text-muted-foreground">
							Total Partners
						</CardTitle>
						<Building2 className="h-4 w-4 text-purple-600" />
					</CardHeader>
					<CardContent>
						<div className="text-2xl font-bold text-foreground">
							{loadingStats ? "..." : stats.partners.total}
						</div>
						<p
							className={`text-xs flex items-center mt-1 ${stats.partners.growth >= 0 ? "text-green-600" : "text-red-600"}`}
						>
							{stats.partners.growth >= 0 ? (
								<TrendingUp className="h-3 w-3 mr-1" />
							) : (
								<TrendingDown className="h-3 w-3 mr-1" />
							)}
							{Math.abs(stats.partners.growth)}% from last month
						</p>
					</CardContent>
				</Card>

				<Card data-testid="card-agents-summary">
					<CardHeader className="flex flex-row items-center justify-between pb-2">
						<CardTitle className="text-sm font-medium text-muted-foreground">
							Total Agents
						</CardTitle>
						<Headphones className="h-4 w-4 text-orange-600" />
					</CardHeader>
					<CardContent>
						<div className="text-2xl font-bold text-foreground">
							{loadingStats ? "..." : stats.agents.total}
						</div>
						<p
							className={`text-xs flex items-center mt-1 ${stats.agents.growth >= 0 ? "text-green-600" : "text-red-600"}`}
						>
							{stats.agents.growth >= 0 ? (
								<TrendingUp className="h-3 w-3 mr-1" />
							) : (
								<TrendingDown className="h-3 w-3 mr-1" />
							)}
							{Math.abs(stats.agents.growth)}% from last month
						</p>
					</CardContent>
				</Card>

				<Card data-testid="card-suppliers-summary">
					<CardHeader className="flex flex-row items-center justify-between pb-2">
						<CardTitle className="text-sm font-medium text-muted-foreground">
							Total Suppliers
						</CardTitle>
						<Package className="h-4 w-4 text-green-600" />
					</CardHeader>
					<CardContent>
						<div className="text-2xl font-bold text-foreground">
							{loadingStats ? "..." : stats.suppliers.total}
						</div>
						<p
							className={`text-xs flex items-center mt-1 ${stats.suppliers.growth >= 0 ? "text-green-600" : "text-red-600"}`}
						>
							{stats.suppliers.growth >= 0 ? (
								<TrendingUp className="h-3 w-3 mr-1" />
							) : (
								<TrendingDown className="h-3 w-3 mr-1" />
							)}
							{Math.abs(stats.suppliers.growth)}% from last month
						</p>
					</CardContent>
				</Card>
			</div>

			{/* Filters and Actions */}
			<div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
				<div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto">
					<div className="relative flex-1 sm:w-80">
						<Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
						<Input
							placeholder="Search by name, email, or ID..."
							className="pl-10"
							value={searchQuery}
							onChange={(e) => setSearchQuery(e.target.value)}
							data-testid="input-search-stakeholder"
						/>
					</div>
					<Select value={statusFilter} onValueChange={setStatusFilter}>
						<SelectTrigger
							className="w-full sm:w-[180px]"
							data-testid="select-status-filter"
						>
							<Filter className="h-4 w-4 mr-2" />
							<SelectValue placeholder="Filter by status" />
						</SelectTrigger>
						<SelectContent>
							<SelectItem value="all">All Status</SelectItem>
							<SelectItem value="active">Active</SelectItem>
							<SelectItem value="inactive">Inactive</SelectItem>
						</SelectContent>
					</Select>
				</div>
				<div className="flex gap-2 w-full sm:w-auto">
					<Button
						variant="outline"
						onClick={handleRefresh}
						data-testid="button-refresh"
					>
						<RefreshCw className="h-4 w-4 mr-2" />
						Refresh
					</Button>
					<Button variant="outline" data-testid="button-export">
						<Download className="h-4 w-4 mr-2" />
						Export
					</Button>
					{activeTab !== "clients" && (
						<Button onClick={handleAddNew} data-testid="button-add-stakeholder">
							<Plus className="h-4 w-4 mr-2" />
							Add New
						</Button>
					)}
				</div>
			</div>

			{/* Tabs */}
			<Tabs
				value={activeTab}
				onValueChange={(v) => {
					setActiveTab(v as StakeholderType);
					setCurrentPage(1);
					setSearchQuery("");
					setStatusFilter("all");
				}}
			>
				<TabsList className="grid w-full grid-cols-4">
					<TabsTrigger value="clients" data-testid="tab-clients">
						<Users className="h-4 w-4 mr-2" />
						Clients
					</TabsTrigger>
					<TabsTrigger value="partners" data-testid="tab-partners">
						<Building2 className="h-4 w-4 mr-2" />
						Partners
					</TabsTrigger>
					<TabsTrigger value="agents" data-testid="tab-agents">
						<Headphones className="h-4 w-4 mr-2" />
						Agents
					</TabsTrigger>
					<TabsTrigger value="suppliers" data-testid="tab-suppliers">
						<Package className="h-4 w-4 mr-2" />
						Suppliers
					</TabsTrigger>
				</TabsList>

				{/* Clients Tab */}
				<TabsContent value="clients" className="mt-6">
					{/* Bulk Action Bar */}
					{selectedClients.size > 0 && (
						<Card className="mb-4 border-primary/50 bg-primary/5">
							<CardContent className="py-3 px-4">
								<div className="flex items-center justify-between">
									<div className="flex items-center gap-4">
										<span className="text-sm font-medium">
											{selectedClients.size} client(s) selected
										</span>
										<div className="flex items-center gap-2">
											<Select
												value={bulkAssignAgentId}
												onValueChange={setBulkAssignAgentId}
											>
												<SelectTrigger className="w-[200px]">
													<SelectValue placeholder="Assign to Agent..." />
												</SelectTrigger>
												<SelectContent>
													<SelectItem value="__unassign__">
														Unassign Agent
													</SelectItem>
													{availableAgents.map((agent) => (
														<SelectItem key={agent.id} value={agent.id}>
															{agent.fullName || agent.email}
														</SelectItem>
													))}
												</SelectContent>
											</Select>
											<Button
												size="sm"
												onClick={handleBulkAssignAgent}
												disabled={!bulkAssignAgentId}
											>
												Assign
											</Button>
										</div>
									</div>
									<Button
										variant="ghost"
										size="sm"
										onClick={() => setSelectedClients(new Set())}
									>
										Clear Selection
									</Button>
								</div>
							</CardContent>
						</Card>
					)}
					<Card>
						<CardContent className="p-0">
							<Table>
								<TableHeader>
									<TableRow>
										<TableHead className="w-12">
											<Checkbox
												checked={
													clients.length > 0 &&
													selectedClients.size === clients.length
												}
												onCheckedChange={handleSelectAll}
												aria-label="Select all clients"
											/>
										</TableHead>
										<TableHead>User ID</TableHead>
										<TableHead>Name</TableHead>
										<TableHead>Contact</TableHead>
										<TableHead>Roles</TableHead>
										<TableHead>Assigned Agent</TableHead>
										<TableHead>KYC Status</TableHead>
										<TableHead>Status</TableHead>
										<TableHead>Actions</TableHead>
									</TableRow>
								</TableHeader>
								<TableBody>
									{loadingClients ? (
										<TableRow>
											<TableCell
												colSpan={9}
												className="text-center py-8 text-muted-foreground"
											>
												Loading...
											</TableCell>
										</TableRow>
									) : clients.length === 0 ? (
										<TableRow>
											<TableCell
												colSpan={9}
												className="text-center py-8 text-muted-foreground"
											>
												No clients found
											</TableCell>
										</TableRow>
									) : (
										clients.map((user: User) => (
											<TableRow
												key={user.id}
												data-testid={`row-client-${user.id}`}
											>
												<TableCell>
													<Checkbox
														checked={selectedClients.has(user.id)}
														onCheckedChange={(checked) =>
															handleSelectClient(user.id, checked as boolean)
														}
														aria-label={`Select ${user.fullName}`}
													/>
												</TableCell>
												<TableCell className="font-mono text-sm">
													{user.userId}
												</TableCell>
												<TableCell className="font-medium">
													{user.fullName}
												</TableCell>
												<TableCell>
													<div className="space-y-1 text-sm">
														<div className="flex items-center text-muted-foreground">
															<Mail className="h-3 w-3 mr-2" />
															{user.email}
														</div>
														{user.mobile && (
															<div className="flex items-center text-muted-foreground">
																<Phone className="h-3 w-3 mr-2" />
																{user.mobile}
															</div>
														)}
													</div>
												</TableCell>
												<TableCell>
													<div className="flex flex-wrap gap-1">
														{(user.roles || []).map((role) => (
															<Badge
																key={role}
																variant="secondary"
																className="text-xs"
															>
																{role}
															</Badge>
														))}
													</div>
												</TableCell>
												<TableCell>
													{user.agentName ? (
														<Badge
															variant="outline"
															className="bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300"
														>
															{user.agentName}
														</Badge>
													) : (
														<span className="text-muted-foreground text-sm">
															Not assigned
														</span>
													)}
												</TableCell>
												<TableCell>
													<Badge
														variant={
															user.kycStatus === "approved"
																? "default"
																: "secondary"
														}
														className={
															user.kycStatus === "approved"
																? "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100"
																: user.kycStatus === "pending"
																	? "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-100"
																	: "bg-muted text-foreground"
														}
													>
														{user.kycStatus || "Not Started"}
													</Badge>
												</TableCell>
												<TableCell>
													<Badge
														variant={
															user.status === "active" ? "default" : "secondary"
														}
													>
														{user.status}
													</Badge>
												</TableCell>
												<TableCell>
													<DropdownMenu>
														<DropdownMenuTrigger asChild>
															<Button
																variant="ghost"
																size="sm"
																data-testid={`button-actions-client-${user.id}`}
															>
																<MoreVertical className="h-4 w-4" />
															</Button>
														</DropdownMenuTrigger>
														<DropdownMenuContent align="end">
															<DropdownMenuLabel>Actions</DropdownMenuLabel>
															<DropdownMenuSeparator />
															<DropdownMenuItem
																onClick={() => setViewingClient(user)}
																data-testid={`button-view-client-${user.id}`}
															>
																<Eye className="h-4 w-4 mr-2" />
																View Details
															</DropdownMenuItem>
															<DropdownMenuItem
																onClick={() => handleOpenEditClient(user)}
																data-testid={`button-edit-client-${user.id}`}
															>
																<Pencil className="h-4 w-4 mr-2" />
																Edit Profile
															</DropdownMenuItem>
															<DropdownMenuItem
																onClick={() =>
																	handleStatusToggle(
																		user.id,
																		"clients",
																		user.status,
																	)
																}
															>
																{user.status === "active"
																	? "Deactivate"
																	: "Activate"}
															</DropdownMenuItem>
															<DropdownMenuSeparator />
															<DropdownMenuItem
																className="text-red-600"
																onClick={() =>
																	setDeletingItem({
																		id: user.id,
																		type: "clients",
																		name: user.fullName,
																	})
																}
																data-testid={`button-delete-client-${user.id}`}
															>
																<Trash2 className="h-4 w-4 mr-2" />
																Delete
															</DropdownMenuItem>
														</DropdownMenuContent>
													</DropdownMenu>
												</TableCell>
											</TableRow>
										))
									)}
								</TableBody>
							</Table>
						</CardContent>
					</Card>
				</TabsContent>

				{/* Partners Tab */}
				<TabsContent value="partners" className="mt-6">
					<Card>
						<CardContent className="p-0">
							<Table>
								<TableHeader>
									<TableRow>
										<TableHead>Company Name</TableHead>
										<TableHead>Contact</TableHead>
										<TableHead>Partner Type</TableHead>
										<TableHead>Commission Rate</TableHead>
										<TableHead>Status</TableHead>
										<TableHead>Actions</TableHead>
									</TableRow>
								</TableHeader>
								<TableBody>
									{loadingPartners ? (
										<TableRow>
											<TableCell
												colSpan={6}
												className="text-center py-8 text-muted-foreground"
											>
												Loading...
											</TableCell>
										</TableRow>
									) : (partnersData?.data || []).length === 0 ? (
										<TableRow>
											<TableCell
												colSpan={6}
												className="text-center py-8 text-muted-foreground"
											>
												No partners found
											</TableCell>
										</TableRow>
									) : (
										(partnersData?.data || []).map((partner: Partner) => (
											<TableRow
												key={partner.id}
												data-testid={`row-partner-${partner.id}`}
											>
												<TableCell className="font-medium">
													{partner.companyName}
												</TableCell>
												<TableCell>
													<div className="space-y-1 text-sm">
														<div className="flex items-center text-muted-foreground">
															<Mail className="h-3 w-3 mr-2" />
															{partner.contactEmail}
														</div>
														{partner.contactPhone && (
															<div className="flex items-center text-muted-foreground">
																<Phone className="h-3 w-3 mr-2" />
																{partner.contactPhone}
															</div>
														)}
													</div>
												</TableCell>
												<TableCell>
													<Badge variant="outline">{partner.partnerType}</Badge>
												</TableCell>
												<TableCell>
													{partner.commissionRate ||
														partner.revenueShare ||
														"0.00"}
													%
												</TableCell>
												<TableCell>
													<Badge
														variant={
															partner.status === "active"
																? "default"
																: "secondary"
														}
													>
														{partner.status}
													</Badge>
												</TableCell>
												<TableCell>
													<DropdownMenu>
														<DropdownMenuTrigger asChild>
															<Button
																variant="ghost"
																size="sm"
																data-testid={`button-actions-partner-${partner.id}`}
															>
																<MoreVertical className="h-4 w-4" />
															</Button>
														</DropdownMenuTrigger>
														<DropdownMenuContent align="end">
															<DropdownMenuLabel>Actions</DropdownMenuLabel>
															<DropdownMenuSeparator />
															<DropdownMenuItem>View Details</DropdownMenuItem>
															<DropdownMenuItem
																onClick={() => setEditingPartner(partner)}
																data-testid={`button-edit-partner-${partner.id}`}
															>
																<Pencil className="h-4 w-4 mr-2" />
																Edit Partner
															</DropdownMenuItem>
															<DropdownMenuItem
																onClick={() =>
																	handleStatusToggle(
																		partner.id,
																		"partners",
																		partner.status,
																	)
																}
															>
																{partner.status === "active"
																	? "Deactivate"
																	: "Activate"}
															</DropdownMenuItem>
															<DropdownMenuSeparator />
															<DropdownMenuItem
																className="text-red-600"
																onClick={() =>
																	setDeletingItem({
																		id: partner.id,
																		type: "partners",
																		name: partner.companyName,
																	})
																}
																data-testid={`button-delete-partner-${partner.id}`}
															>
																<Trash2 className="h-4 w-4 mr-2" />
																Delete
															</DropdownMenuItem>
														</DropdownMenuContent>
													</DropdownMenu>
												</TableCell>
											</TableRow>
										))
									)}
								</TableBody>
							</Table>
						</CardContent>
					</Card>
				</TabsContent>

				{/* Agents Tab */}
				<TabsContent value="agents" className="mt-6">
					<Card>
						<CardContent className="p-0">
							<Table>
								<TableHeader>
									<TableRow>
										<TableHead>Name</TableHead>
										<TableHead>Contact</TableHead>
										<TableHead>Employee ID</TableHead>
										<TableHead>Commission %</TableHead>
										<TableHead>Active Clients</TableHead>
										<TableHead>Revenue</TableHead>
										<TableHead>Status</TableHead>
										<TableHead>Actions</TableHead>
									</TableRow>
								</TableHeader>
								<TableBody>
									{loadingAgents ? (
										<TableRow>
											<TableCell
												colSpan={8}
												className="text-center py-8 text-muted-foreground"
											>
												Loading...
											</TableCell>
										</TableRow>
									) : (agentsData?.data || []).length === 0 ? (
										<TableRow>
											<TableCell
												colSpan={8}
												className="text-center py-8 text-muted-foreground"
											>
												No agents found
											</TableCell>
										</TableRow>
									) : (
										(agentsData?.data || []).map((agent: Agent) => (
											<TableRow
												key={agent.id}
												data-testid={`row-agent-${agent.id}`}
											>
												<TableCell className="font-medium">
													{agent.fullName}
												</TableCell>
												<TableCell>
													<div className="space-y-1 text-sm">
														<div className="flex items-center text-muted-foreground">
															<Mail className="h-3 w-3 mr-2" />
															{agent.email}
														</div>
														{agent.phone && (
															<div className="flex items-center text-muted-foreground">
																<Phone className="h-3 w-3 mr-2" />
																{agent.phone}
															</div>
														)}
													</div>
												</TableCell>
												<TableCell>
													<span className="font-mono text-sm">
														{agent.employeeId || "N/A"}
													</span>
												</TableCell>
												<TableCell>
													<div className="text-sm">
														{agent.commissionSplitModel === "custom" &&
														agent.defaultCommissionShare ? (
															<>
																<span className="font-medium">
																	{agent.defaultCommissionShare}%
																</span>
																<Badge
																	variant="outline"
																	className="ml-2 text-xs"
																>
																	Custom
																</Badge>
															</>
														) : (
															<span className="text-muted-foreground">
																Plan Default
															</span>
														)}
													</div>
												</TableCell>
												<TableCell>
													<Badge variant="secondary">
														{agent.activeClients || 0}
													</Badge>
												</TableCell>
												<TableCell className="font-medium">
													₹{agent.totalRevenue || "0.00"}
												</TableCell>
												<TableCell>
													<Badge
														variant={
															agent.status === "active"
																? "default"
																: "secondary"
														}
													>
														{agent.status}
													</Badge>
												</TableCell>
												<TableCell>
													<DropdownMenu>
														<DropdownMenuTrigger asChild>
															<Button
																variant="ghost"
																size="sm"
																data-testid={`button-actions-agent-${agent.id}`}
															>
																<MoreVertical className="h-4 w-4" />
															</Button>
														</DropdownMenuTrigger>
														<DropdownMenuContent align="end">
															<DropdownMenuLabel>Actions</DropdownMenuLabel>
															<DropdownMenuSeparator />
															<DropdownMenuItem>View Details</DropdownMenuItem>
															<DropdownMenuItem
																onClick={() => setEditingAgent(agent)}
																data-testid={`button-edit-agent-${agent.id}`}
															>
																<Pencil className="h-4 w-4 mr-2" />
																Edit Agent
															</DropdownMenuItem>
															<DropdownMenuItem>
																Assign Clients
															</DropdownMenuItem>
															<DropdownMenuItem
																onClick={() =>
																	handleStatusToggle(
																		agent.id,
																		"agents",
																		agent.status,
																	)
																}
															>
																{agent.status === "active"
																	? "Deactivate"
																	: "Activate"}
															</DropdownMenuItem>
															<DropdownMenuSeparator />
															<DropdownMenuItem
																className="text-red-600"
																onClick={() =>
																	setDeletingItem({
																		id: agent.id,
																		type: "agents",
																		name: agent.fullName,
																	})
																}
																data-testid={`button-delete-agent-${agent.id}`}
															>
																<Trash2 className="h-4 w-4 mr-2" />
																Delete
															</DropdownMenuItem>
														</DropdownMenuContent>
													</DropdownMenu>
												</TableCell>
											</TableRow>
										))
									)}
								</TableBody>
							</Table>
						</CardContent>
					</Card>
				</TabsContent>

				{/* Suppliers Tab */}
				<TabsContent value="suppliers" className="mt-6">
					<Card>
						<CardContent className="p-0">
							<Table>
								<TableHeader>
									<TableRow>
										<TableHead>Name</TableHead>
										<TableHead>Contact Info</TableHead>
										<TableHead>Categories</TableHead>
										<TableHead>Commission Rate</TableHead>
										<TableHead>Status</TableHead>
										<TableHead>Actions</TableHead>
									</TableRow>
								</TableHeader>
								<TableBody>
									{loadingSuppiers ? (
										<TableRow>
											<TableCell
												colSpan={6}
												className="text-center py-8 text-muted-foreground"
											>
												Loading...
											</TableCell>
										</TableRow>
									) : (suppliersData?.data || []).length === 0 ? (
										<TableRow>
											<TableCell
												colSpan={6}
												className="text-center py-8 text-muted-foreground"
											>
												No suppliers found
											</TableCell>
										</TableRow>
									) : (
										(suppliersData?.data || []).map((supplier: Supplier) => (
											<TableRow
												key={supplier.id}
												data-testid={`row-supplier-${supplier.id}`}
											>
												<TableCell className="font-medium">
													{supplier.name}
												</TableCell>
												<TableCell>
													<div className="space-y-1 text-sm">
														{supplier.contactEmail && (
															<div className="flex items-center text-muted-foreground">
																<Mail className="h-3 w-3 mr-2" />
																{supplier.contactEmail}
															</div>
														)}
														{supplier.contactPhone && (
															<div className="flex items-center text-muted-foreground">
																<Phone className="h-3 w-3 mr-2" />
																{supplier.contactPhone}
															</div>
														)}
													</div>
												</TableCell>
												<TableCell>
													<div className="flex flex-wrap gap-1">
														{supplier.productCategories &&
														supplier.productCategories.length > 0 ? (
															supplier.productCategories.map(
																(category, idx) => (
																	<Badge
																		key={idx}
																		variant="outline"
																		className="text-xs"
																	>
																		{category}
																	</Badge>
																),
															)
														) : (
															<span className="text-muted-foreground text-sm">
																N/A
															</span>
														)}
													</div>
												</TableCell>
												<TableCell>
													{supplier.commissionRate || "0.00"}%
												</TableCell>
												<TableCell>
													<Badge
														variant={
															supplier.status === "active"
																? "default"
																: "secondary"
														}
													>
														{supplier.status}
													</Badge>
												</TableCell>
												<TableCell>
													<DropdownMenu>
														<DropdownMenuTrigger asChild>
															<Button
																variant="ghost"
																size="sm"
																data-testid={`button-actions-supplier-${supplier.id}`}
															>
																<MoreVertical className="h-4 w-4" />
															</Button>
														</DropdownMenuTrigger>
														<DropdownMenuContent align="end">
															<DropdownMenuLabel>Actions</DropdownMenuLabel>
															<DropdownMenuSeparator />
															<DropdownMenuItem>View Details</DropdownMenuItem>
															<DropdownMenuItem
																onClick={() => setEditingSupplier(supplier)}
																data-testid={`button-edit-supplier-${supplier.id}`}
															>
																<Pencil className="h-4 w-4 mr-2" />
																Edit Supplier
															</DropdownMenuItem>
															<DropdownMenuItem>View Products</DropdownMenuItem>
															<DropdownMenuItem
																onClick={() =>
																	handleStatusToggle(
																		supplier.id,
																		"suppliers",
																		supplier.status,
																	)
																}
															>
																{supplier.status === "active"
																	? "Deactivate"
																	: "Activate"}
															</DropdownMenuItem>
															<DropdownMenuSeparator />
															<DropdownMenuItem
																className="text-red-600"
																onClick={() =>
																	setDeletingItem({
																		id: supplier.id,
																		type: "suppliers",
																		name: supplier.name,
																	})
																}
																data-testid={`button-delete-supplier-${supplier.id}`}
															>
																<Trash2 className="h-4 w-4 mr-2" />
																Delete
															</DropdownMenuItem>
														</DropdownMenuContent>
													</DropdownMenu>
												</TableCell>
											</TableRow>
										))
									)}
								</TableBody>
							</Table>
						</CardContent>
					</Card>
				</TabsContent>
			</Tabs>

			{/* Pagination */}
			{totalPages > 1 && (
				<div className="flex items-center justify-between">
					<p className="text-sm text-muted-foreground">
						Showing page {currentPage} of {totalPages} ({totalCount} total)
					</p>
					<div className="flex gap-2">
						<Button
							variant="outline"
							size="sm"
							onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
							disabled={currentPage === 1}
							data-testid="button-prev-page"
						>
							Previous
						</Button>
						<Button
							variant="outline"
							size="sm"
							onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
							disabled={currentPage === totalPages}
							data-testid="button-next-page"
						>
							Next
						</Button>
					</div>
				</div>
			)}

			{/* Add Partner Dialog */}
			<Dialog open={isAddPartnerOpen} onOpenChange={setIsAddPartnerOpen}>
				<DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
					<DialogHeader>
						<DialogTitle>Add New Partner</DialogTitle>
						<DialogDescription>
							Create a new partner account with login credentials
						</DialogDescription>
					</DialogHeader>
					<form onSubmit={handleCreatePartner} className="space-y-4">
						<div className="grid grid-cols-2 gap-4">
							<div className="space-y-2 col-span-2">
								<Label htmlFor="companyName">Company Name *</Label>
								<Input
									id="companyName"
									name="companyName"
									required
									data-testid="input-partner-companyName"
								/>
							</div>
							<div className="space-y-2">
								<Label htmlFor="contactEmail">Contact Email *</Label>
								<Input
									id="contactEmail"
									name="contactEmail"
									type="email"
									required
									data-testid="input-partner-contactEmail"
								/>
							</div>
							<div className="space-y-2">
								<Label htmlFor="contactPhone">Contact Phone</Label>
								<Input
									id="contactPhone"
									name="contactPhone"
									data-testid="input-partner-contactPhone"
								/>
							</div>
							<div className="space-y-2">
								<Label htmlFor="password">Password *</Label>
								<Input
									id="password"
									name="password"
									type="password"
									required
									minLength={8}
									data-testid="input-partner-password"
								/>
								<p className="text-xs text-muted-foreground">
									Minimum 8 characters
								</p>
							</div>
							<div className="space-y-2">
								<Label htmlFor="partnerType">Partner Type *</Label>
								<Select
									name="partnerType"
									required
									defaultValue="product_provider"
								>
									<SelectTrigger data-testid="select-partner-partnerType">
										<SelectValue placeholder="Select type" />
									</SelectTrigger>
									<SelectContent>
										<SelectItem value="product_provider">
											Product Provider
										</SelectItem>
										<SelectItem value="service_provider">
											Service Provider
										</SelectItem>
										<SelectItem value="both">Both</SelectItem>
										<SelectItem value="distributor">Distributor</SelectItem>
										<SelectItem value="agent">Agent</SelectItem>
									</SelectContent>
								</Select>
							</div>
							<div className="space-y-2">
								<Label htmlFor="commissionRate">Commission Rate (%)</Label>
								<Input
									id="commissionRate"
									name="commissionRate"
									type="number"
									step="0.01"
									defaultValue="0.00"
									data-testid="input-partner-commissionRate"
								/>
							</div>
							<div className="space-y-2">
								<Label htmlFor="isActive">Active Status</Label>
								<Select name="isActive" defaultValue="true">
									<SelectTrigger data-testid="select-partner-isActive">
										<SelectValue />
									</SelectTrigger>
									<SelectContent>
										<SelectItem value="true">Active</SelectItem>
										<SelectItem value="false">Inactive</SelectItem>
									</SelectContent>
								</Select>
							</div>
						</div>
						<div className="flex justify-end gap-2">
							<Button
								type="button"
								variant="outline"
								onClick={() => setIsAddPartnerOpen(false)}
								data-testid="button-cancel-partner"
							>
								Cancel
							</Button>
							<Button
								type="submit"
								disabled={createPartnerMutation.isPending}
								data-testid="button-submit-partner"
							>
								{createPartnerMutation.isPending
									? "Creating..."
									: "Create Partner"}
							</Button>
						</div>
					</form>
				</DialogContent>
			</Dialog>

			{/* Edit Partner Dialog */}
			<Dialog
				open={!!editingPartner}
				onOpenChange={(open) => !open && setEditingPartner(null)}
			>
				<DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
					<DialogHeader>
						<DialogTitle>Edit Partner</DialogTitle>
						<DialogDescription>Update partner information</DialogDescription>
					</DialogHeader>
					{editingPartner && (
						<form onSubmit={handleUpdatePartner} className="space-y-4">
							<div className="grid grid-cols-2 gap-4">
								<div className="space-y-2 col-span-2">
									<Label htmlFor="edit-companyName">Company Name *</Label>
									<Input
										id="edit-companyName"
										name="companyName"
										required
										defaultValue={editingPartner.companyName}
										data-testid="input-edit-partner-companyName"
									/>
								</div>
								<div className="space-y-2">
									<Label htmlFor="edit-contactEmail">Contact Email *</Label>
									<Input
										id="edit-contactEmail"
										name="contactEmail"
										type="email"
										required
										defaultValue={editingPartner.contactEmail}
										data-testid="input-edit-partner-contactEmail"
									/>
								</div>
								<div className="space-y-2">
									<Label htmlFor="edit-contactPhone">Contact Phone</Label>
									<Input
										id="edit-contactPhone"
										name="contactPhone"
										defaultValue={editingPartner.contactPhone || ""}
										data-testid="input-edit-partner-contactPhone"
									/>
								</div>
								<div className="space-y-2 col-span-2">
									<Label htmlFor="edit-password">Password</Label>
									<Input
										id="edit-password"
										name="password"
										type="password"
										placeholder="Leave empty to keep current password"
										data-testid="input-edit-partner-password"
									/>
									<p className="text-xs text-muted-foreground">
										Minimum 8 characters (leave empty to keep current)
									</p>
								</div>
								<div className="space-y-2">
									<Label htmlFor="edit-partnerType">Partner Type *</Label>
									<Select
										name="partnerType"
										required
										defaultValue={editingPartner.partnerType}
									>
										<SelectTrigger data-testid="select-edit-partner-partnerType">
											<SelectValue />
										</SelectTrigger>
										<SelectContent>
											<SelectItem value="product_provider">
												Product Provider
											</SelectItem>
											<SelectItem value="service_provider">
												Service Provider
											</SelectItem>
											<SelectItem value="both">Both</SelectItem>
											<SelectItem value="distributor">Distributor</SelectItem>
											<SelectItem value="agent">Agent</SelectItem>
										</SelectContent>
									</Select>
								</div>
								<div className="space-y-2">
									<Label htmlFor="edit-commissionRate">
										Commission Rate (%)
									</Label>
									<Input
										id="edit-commissionRate"
										name="commissionRate"
										type="number"
										step="0.01"
										defaultValue={
											editingPartner.commissionRate ||
											editingPartner.revenueShare ||
											"0.00"
										}
										data-testid="input-edit-partner-commissionRate"
									/>
								</div>
								<div className="space-y-2">
									<Label htmlFor="edit-isActive">Active Status</Label>
									<Select
										name="isActive"
										defaultValue={editingPartner.isActive ? "true" : "false"}
									>
										<SelectTrigger data-testid="select-edit-partner-isActive">
											<SelectValue />
										</SelectTrigger>
										<SelectContent>
											<SelectItem value="true">Active</SelectItem>
											<SelectItem value="false">Inactive</SelectItem>
										</SelectContent>
									</Select>
								</div>
							</div>
							<div className="flex justify-end gap-2">
								<Button
									type="button"
									variant="outline"
									onClick={() => setEditingPartner(null)}
									data-testid="button-cancel-edit-partner"
								>
									Cancel
								</Button>
								<Button
									type="submit"
									disabled={updatePartnerMutation.isPending}
									data-testid="button-submit-edit-partner"
								>
									{updatePartnerMutation.isPending
										? "Updating..."
										: "Update Partner"}
								</Button>
							</div>
						</form>
					)}
				</DialogContent>
			</Dialog>

			{/* Add Agent Dialog */}
			<Dialog open={isAddAgentOpen} onOpenChange={setIsAddAgentOpen}>
				<DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
					<DialogHeader>
						<DialogTitle>Add New Agent</DialogTitle>
						<DialogDescription>Create a new agent account</DialogDescription>
					</DialogHeader>
					<form onSubmit={handleCreateAgent} className="space-y-4">
						<div className="grid grid-cols-2 gap-4">
							<div className="space-y-2 col-span-2">
								<Label htmlFor="fullName">Full Name *</Label>
								<Input
									id="fullName"
									name="fullName"
									required
									data-testid="input-agent-fullName"
								/>
							</div>
							<div className="space-y-2">
								<Label htmlFor="email">Email *</Label>
								<Input
									id="email"
									name="email"
									type="email"
									required
									data-testid="input-agent-email"
								/>
							</div>
							<div className="space-y-2">
								<Label htmlFor="phone">Phone</Label>
								<Input
									id="phone"
									name="phone"
									data-testid="input-agent-phone"
								/>
							</div>
							<div className="space-y-2">
								<Label htmlFor="employeeId">Employee ID</Label>
								<Input
									id="employeeId"
									name="employeeId"
									data-testid="input-agent-employeeId"
								/>
							</div>
							<div className="space-y-2">
								<Label htmlFor="arnCode">ARN Code</Label>
								<Input
									id="arnCode"
									name="arnCode"
									data-testid="input-agent-arnCode"
								/>
							</div>
							<div className="space-y-2">
								<Label htmlFor="euinNumber">EUIN Number</Label>
								<Input
									id="euinNumber"
									name="euinNumber"
									data-testid="input-agent-euinNumber"
								/>
							</div>
							<div className="space-y-2">
								<Label htmlFor="agentType">Agent Type *</Label>
								<Select name="agentType" required defaultValue="individual">
									<SelectTrigger data-testid="select-agent-agentType">
										<SelectValue />
									</SelectTrigger>
									<SelectContent>
										<SelectItem value="individual">Individual</SelectItem>
										<SelectItem value="corporate">Corporate</SelectItem>
										<SelectItem value="sub_broker">Sub Broker</SelectItem>
									</SelectContent>
								</Select>
							</div>
							<div className="space-y-2">
								<Label htmlFor="status">Status *</Label>
								<Select name="status" required defaultValue="active">
									<SelectTrigger data-testid="select-agent-status">
										<SelectValue />
									</SelectTrigger>
									<SelectContent>
										<SelectItem value="active">Active</SelectItem>
										<SelectItem value="inactive">Inactive</SelectItem>
										<SelectItem value="suspended">Suspended</SelectItem>
										<SelectItem value="terminated">Terminated</SelectItem>
									</SelectContent>
								</Select>
							</div>
						</div>
						<div className="flex justify-end gap-2">
							<Button
								type="button"
								variant="outline"
								onClick={() => setIsAddAgentOpen(false)}
								data-testid="button-cancel-agent"
							>
								Cancel
							</Button>
							<Button
								type="submit"
								disabled={createAgentMutation.isPending}
								data-testid="button-submit-agent"
							>
								{createAgentMutation.isPending ? "Creating..." : "Create Agent"}
							</Button>
						</div>
					</form>
				</DialogContent>
			</Dialog>

			{/* Edit Agent Dialog */}
			<Dialog
				open={!!editingAgent}
				onOpenChange={(open) => !open && setEditingAgent(null)}
			>
				<DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
					<DialogHeader>
						<DialogTitle>Edit Agent</DialogTitle>
						<DialogDescription>Update agent information</DialogDescription>
					</DialogHeader>
					{editingAgent && (
						<form onSubmit={handleUpdateAgent} className="space-y-4">
							<div className="grid grid-cols-2 gap-4">
								<div className="space-y-2 col-span-2">
									<Label htmlFor="edit-fullName">Full Name *</Label>
									<Input
										id="edit-fullName"
										name="fullName"
										required
										defaultValue={editingAgent.fullName}
										data-testid="input-edit-agent-fullName"
									/>
								</div>
								<div className="space-y-2">
									<Label htmlFor="edit-email">Email *</Label>
									<Input
										id="edit-email"
										name="email"
										type="email"
										required
										defaultValue={editingAgent.email}
										data-testid="input-edit-agent-email"
									/>
								</div>
								<div className="space-y-2">
									<Label htmlFor="edit-phone">Phone</Label>
									<Input
										id="edit-phone"
										name="phone"
										defaultValue={editingAgent.phone || ""}
										data-testid="input-edit-agent-phone"
									/>
								</div>
								<div className="space-y-2">
									<Label htmlFor="edit-employeeId">Employee ID</Label>
									<Input
										id="edit-employeeId"
										name="employeeId"
										defaultValue={editingAgent.employeeId || ""}
										data-testid="input-edit-agent-employeeId"
									/>
								</div>
								<div className="space-y-2">
									<Label htmlFor="edit-arnCode">ARN Code</Label>
									<Input
										id="edit-arnCode"
										name="arnCode"
										defaultValue={editingAgent.arnCode || ""}
										data-testid="input-edit-agent-arnCode"
									/>
								</div>
								<div className="space-y-2">
									<Label htmlFor="edit-euinNumber">EUIN Number</Label>
									<Input
										id="edit-euinNumber"
										name="euinNumber"
										defaultValue={editingAgent.euinNumber || ""}
										data-testid="input-edit-agent-euinNumber"
									/>
								</div>
								<div className="space-y-2">
									<Label htmlFor="edit-agentType">Agent Type *</Label>
									<Select
										name="agentType"
										required
										defaultValue={editingAgent.agentType}
									>
										<SelectTrigger data-testid="select-edit-agent-agentType">
											<SelectValue />
										</SelectTrigger>
										<SelectContent>
											<SelectItem value="individual">Individual</SelectItem>
											<SelectItem value="corporate">Corporate</SelectItem>
											<SelectItem value="sub_broker">Sub Broker</SelectItem>
										</SelectContent>
									</Select>
								</div>
								<div className="space-y-2">
									<Label htmlFor="edit-status">Status *</Label>
									<Select
										name="status"
										required
										defaultValue={editingAgent.status}
									>
										<SelectTrigger data-testid="select-edit-agent-status">
											<SelectValue />
										</SelectTrigger>
										<SelectContent>
											<SelectItem value="active">Active</SelectItem>
											<SelectItem value="inactive">Inactive</SelectItem>
											<SelectItem value="suspended">Suspended</SelectItem>
											<SelectItem value="terminated">Terminated</SelectItem>
										</SelectContent>
									</Select>
								</div>
							</div>
							<div className="border-t pt-4 mt-4">
								<h4 className="font-medium mb-3">Commission Configuration</h4>
								<div className="grid grid-cols-2 gap-4">
									<div className="space-y-2">
										<Label htmlFor="edit-commissionSplitModel">
											Commission Model
										</Label>
										<Select
											name="commissionSplitModel"
											defaultValue={
												editingAgent.commissionSplitModel || "standard"
											}
											onValueChange={(value) => {
												const shareInput = document.getElementById(
													"edit-defaultCommissionShare",
												) as HTMLInputElement;
												if (shareInput) {
													shareInput.disabled = value !== "custom";
													if (value === "standard") {
														shareInput.value = "";
													}
												}
											}}
										>
											<SelectTrigger data-testid="select-edit-agent-commissionSplitModel">
												<SelectValue />
											</SelectTrigger>
											<SelectContent>
												<SelectItem value="standard">
													Standard (Use Plan Rates)
												</SelectItem>
												<SelectItem value="custom">
													Custom (Agent-Specific Rate)
												</SelectItem>
											</SelectContent>
										</Select>
										<p className="text-xs text-muted-foreground">
											Standard uses global plan rates, Custom allows
											agent-specific percentage
										</p>
									</div>
									<div className="space-y-2">
										<Label htmlFor="edit-defaultCommissionShare">
											Commission Share (%)
										</Label>
										<Input
											id="edit-defaultCommissionShare"
											name="defaultCommissionShare"
											type="number"
											step="0.01"
											min="0"
											max="100"
											defaultValue={
												editingAgent.commissionSplitModel === "custom"
													? editingAgent.defaultCommissionShare || ""
													: ""
											}
											disabled={editingAgent.commissionSplitModel !== "custom"}
											placeholder={
												editingAgent.commissionSplitModel !== "custom"
													? "Using plan default"
													: "Enter percentage"
											}
											data-testid="input-edit-agent-defaultCommissionShare"
										/>
										<p className="text-xs text-muted-foreground">
											{editingAgent.commissionSplitModel === "custom"
												? "Percentage of commission this agent receives (0-100%)"
												: "Select 'Custom' model to set agent-specific rate"}
										</p>
									</div>
								</div>
							</div>
							<div className="flex justify-end gap-2">
								<Button
									type="button"
									variant="outline"
									onClick={() => setEditingAgent(null)}
									data-testid="button-cancel-edit-agent"
								>
									Cancel
								</Button>
								<Button
									type="submit"
									disabled={updateAgentMutation.isPending}
									data-testid="button-submit-edit-agent"
								>
									{updateAgentMutation.isPending
										? "Updating..."
										: "Update Agent"}
								</Button>
							</div>
						</form>
					)}
				</DialogContent>
			</Dialog>

			{/* Add Supplier Dialog */}
			<Dialog open={isAddSupplierOpen} onOpenChange={setIsAddSupplierOpen}>
				<DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
					<DialogHeader>
						<DialogTitle>Add New Supplier</DialogTitle>
						<DialogDescription>Create a new supplier account</DialogDescription>
					</DialogHeader>
					<form onSubmit={handleCreateSupplier} className="space-y-4">
						<div className="grid grid-cols-2 gap-4">
							<div className="space-y-2 col-span-2">
								<Label htmlFor="name">Supplier Name *</Label>
								<Input
									id="name"
									name="name"
									required
									data-testid="input-supplier-name"
								/>
							</div>
							<div className="space-y-2">
								<Label htmlFor="contactEmail">Contact Email</Label>
								<Input
									id="contactEmail"
									name="contactEmail"
									type="email"
									data-testid="input-supplier-contactEmail"
								/>
							</div>
							<div className="space-y-2">
								<Label htmlFor="contactPhone">Contact Phone</Label>
								<Input
									id="contactPhone"
									name="contactPhone"
									data-testid="input-supplier-contactPhone"
								/>
							</div>
							<div className="space-y-2 col-span-2">
								<Label htmlFor="address">Address</Label>
								<Input
									id="address"
									name="address"
									data-testid="input-supplier-address"
								/>
							</div>
							<div className="space-y-2 col-span-2">
								<Label htmlFor="productCategories">
									Product Categories (comma-separated)
								</Label>
								<Input
									id="productCategories"
									name="productCategories"
									placeholder="e.g., Electronics, Furniture, Clothing"
									data-testid="input-supplier-productCategories"
								/>
								<p className="text-xs text-muted-foreground">
									Separate multiple categories with commas
								</p>
							</div>
							<div className="space-y-2">
								<Label htmlFor="commissionRate">Commission Rate (%)</Label>
								<Input
									id="commissionRate"
									name="commissionRate"
									type="number"
									step="0.01"
									defaultValue="0.00"
									data-testid="input-supplier-commissionRate"
								/>
							</div>
							<div className="space-y-2">
								<Label htmlFor="isActive">Active Status</Label>
								<Select name="isActive" defaultValue="true">
									<SelectTrigger data-testid="select-supplier-isActive">
										<SelectValue />
									</SelectTrigger>
									<SelectContent>
										<SelectItem value="true">Active</SelectItem>
										<SelectItem value="false">Inactive</SelectItem>
									</SelectContent>
								</Select>
							</div>
						</div>
						<div className="flex justify-end gap-2">
							<Button
								type="button"
								variant="outline"
								onClick={() => setIsAddSupplierOpen(false)}
								data-testid="button-cancel-supplier"
							>
								Cancel
							</Button>
							<Button
								type="submit"
								disabled={createSupplierMutation.isPending}
								data-testid="button-submit-supplier"
							>
								{createSupplierMutation.isPending
									? "Creating..."
									: "Create Supplier"}
							</Button>
						</div>
					</form>
				</DialogContent>
			</Dialog>

			{/* Edit Supplier Dialog */}
			<Dialog
				open={!!editingSupplier}
				onOpenChange={(open) => !open && setEditingSupplier(null)}
			>
				<DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
					<DialogHeader>
						<DialogTitle>Edit Supplier</DialogTitle>
						<DialogDescription>Update supplier information</DialogDescription>
					</DialogHeader>
					{editingSupplier && (
						<form onSubmit={handleUpdateSupplier} className="space-y-4">
							<div className="grid grid-cols-2 gap-4">
								<div className="space-y-2 col-span-2">
									<Label htmlFor="edit-name">Supplier Name *</Label>
									<Input
										id="edit-name"
										name="name"
										required
										defaultValue={editingSupplier.name}
										data-testid="input-edit-supplier-name"
									/>
								</div>
								<div className="space-y-2">
									<Label htmlFor="edit-contactEmail">Contact Email</Label>
									<Input
										id="edit-contactEmail"
										name="contactEmail"
										type="email"
										defaultValue={editingSupplier.contactEmail || ""}
										data-testid="input-edit-supplier-contactEmail"
									/>
								</div>
								<div className="space-y-2">
									<Label htmlFor="edit-contactPhone">Contact Phone</Label>
									<Input
										id="edit-contactPhone"
										name="contactPhone"
										defaultValue={editingSupplier.contactPhone || ""}
										data-testid="input-edit-supplier-contactPhone"
									/>
								</div>
								<div className="space-y-2 col-span-2">
									<Label htmlFor="edit-address">Address</Label>
									<Input
										id="edit-address"
										name="address"
										defaultValue={editingSupplier.address || ""}
										data-testid="input-edit-supplier-address"
									/>
								</div>
								<div className="space-y-2 col-span-2">
									<Label htmlFor="edit-productCategories">
										Product Categories (comma-separated)
									</Label>
									<Input
										id="edit-productCategories"
										name="productCategories"
										placeholder="e.g., Electronics, Furniture, Clothing"
										defaultValue={
											editingSupplier.productCategories?.join(", ") || ""
										}
										data-testid="input-edit-supplier-productCategories"
									/>
									<p className="text-xs text-muted-foreground">
										Separate multiple categories with commas
									</p>
								</div>
								<div className="space-y-2">
									<Label htmlFor="edit-commissionRate">
										Commission Rate (%)
									</Label>
									<Input
										id="edit-commissionRate"
										name="commissionRate"
										type="number"
										step="0.01"
										defaultValue={editingSupplier.commissionRate || "0.00"}
										data-testid="input-edit-supplier-commissionRate"
									/>
								</div>
								<div className="space-y-2">
									<Label htmlFor="edit-isActive">Active Status</Label>
									<Select
										name="isActive"
										defaultValue={editingSupplier.isActive ? "true" : "false"}
									>
										<SelectTrigger data-testid="select-edit-supplier-isActive">
											<SelectValue />
										</SelectTrigger>
										<SelectContent>
											<SelectItem value="true">Active</SelectItem>
											<SelectItem value="false">Inactive</SelectItem>
										</SelectContent>
									</Select>
								</div>
							</div>
							<div className="flex justify-end gap-2">
								<Button
									type="button"
									variant="outline"
									onClick={() => setEditingSupplier(null)}
									data-testid="button-cancel-edit-supplier"
								>
									Cancel
								</Button>
								<Button
									type="submit"
									disabled={updateSupplierMutation.isPending}
									data-testid="button-submit-edit-supplier"
								>
									{updateSupplierMutation.isPending
										? "Updating..."
										: "Update Supplier"}
								</Button>
							</div>
						</form>
					)}
				</DialogContent>
			</Dialog>

			{/* View Client Dialog */}
			<Dialog
				open={!!viewingClient}
				onOpenChange={(open) => !open && setViewingClient(null)}
			>
				<DialogContent className="max-w-md" data-testid="dialog-view-client">
					<DialogHeader>
						<DialogTitle>Client Details</DialogTitle>
						<DialogDescription>View client information</DialogDescription>
					</DialogHeader>
					{viewingClient && (
						<div className="space-y-4">
							<div className="grid grid-cols-2 gap-4">
								<div>
									<Label className="text-sm text-muted-foreground">
										User ID
									</Label>
									<p className="font-mono text-sm">{viewingClient.userId}</p>
								</div>
								<div>
									<Label className="text-sm text-muted-foreground">
										Full Name
									</Label>
									<p className="font-medium">{viewingClient.fullName}</p>
								</div>
								<div>
									<Label className="text-sm text-muted-foreground">Email</Label>
									<p className="text-sm">{viewingClient.email}</p>
								</div>
								<div>
									<Label className="text-sm text-muted-foreground">
										Mobile
									</Label>
									<p className="text-sm">{viewingClient.mobile || "N/A"}</p>
								</div>
								<div>
									<Label className="text-sm text-muted-foreground">
										Status
									</Label>
									<Badge
										variant={
											viewingClient.status === "active"
												? "default"
												: "secondary"
										}
									>
										{viewingClient.status}
									</Badge>
								</div>
								<div>
									<Label className="text-sm text-muted-foreground">
										KYC Status
									</Label>
									<Badge
										variant={
											viewingClient.kycStatus === "approved"
												? "default"
												: "secondary"
										}
										className={
											viewingClient.kycStatus === "approved"
												? "bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-200"
												: viewingClient.kycStatus === "pending"
													? "bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-200"
													: "bg-muted"
										}
									>
										{viewingClient.kycStatus || "Not Started"}
									</Badge>
								</div>
								<div className="col-span-2">
									<Label className="text-sm text-muted-foreground">Roles</Label>
									<div className="flex flex-wrap gap-1 mt-1">
										{(viewingClient.roles || []).map((role) => (
											<Badge key={role} variant="outline" className="text-xs">
												{role}
											</Badge>
										))}
									</div>
								</div>
							</div>
							<div className="flex justify-end">
								<Button
									variant="outline"
									onClick={() => setViewingClient(null)}
								>
									Close
								</Button>
							</div>
						</div>
					)}
				</DialogContent>
			</Dialog>

			{/* Edit Client Dialog */}
			<Dialog
				open={!!editingClient}
				onOpenChange={(open) => !open && setEditingClient(null)}
			>
				<DialogContent className="max-w-lg" data-testid="dialog-edit-client">
					<DialogHeader>
						<DialogTitle>Edit Client</DialogTitle>
						<DialogDescription>
							Update client information, roles, and agent assignment
						</DialogDescription>
					</DialogHeader>
					{editingClient && (
						<form
							onSubmit={async (e) => {
								e.preventDefault();
								const formData = new FormData(e.currentTarget);
								const data = {
									fullName: formData.get("fullName") as string,
									email: formData.get("email") as string,
									mobile: formData.get("mobile") as string,
									roles: editFormRoles,
									agentId:
										editFormAgentId === "__unassign__"
											? null
											: editFormAgentId || null,
								};
								try {
									await apiRequest(
										`/api/admin/users/${editingClient.id}`,
										"PATCH",
										{ body: data },
									);
									queryClient.invalidateQueries({
										queryKey: ["/api/admin/users"],
									});
									queryClient.invalidateQueries({
										queryKey: ["/api/stakeholders/clients"],
									});
									setEditingClient(null);
									toast({ title: "Client updated successfully" });
								} catch (error: any) {
									toast({
										title: "Failed to update client",
										description: error.message || "An error occurred",
										variant: "destructive",
									});
								}
							}}
							className="space-y-4"
						>
							<div className="grid grid-cols-2 gap-4">
								<div className="col-span-2">
									<Label htmlFor="fullName">Full Name</Label>
									<Input
										id="fullName"
										name="fullName"
										defaultValue={editingClient.fullName}
										required
									/>
								</div>
								<div>
									<Label htmlFor="email">Email</Label>
									<Input
										id="email"
										name="email"
										type="email"
										defaultValue={editingClient.email}
										required
									/>
								</div>
								<div>
									<Label htmlFor="mobile">Mobile</Label>
									<Input
										id="mobile"
										name="mobile"
										defaultValue={editingClient.mobile || ""}
									/>
								</div>
							</div>

							<div>
								<Label className="mb-2 block">Assign to Agent</Label>
								<Select
									value={editFormAgentId}
									onValueChange={setEditFormAgentId}
								>
									<SelectTrigger>
										<SelectValue placeholder="Select an agent..." />
									</SelectTrigger>
									<SelectContent>
										<SelectItem value="__unassign__">
											No Agent (Unassign)
										</SelectItem>
										{availableAgents.map((agent) => (
											<SelectItem key={agent.id} value={agent.id}>
												{agent.fullName || agent.email}
											</SelectItem>
										))}
									</SelectContent>
								</Select>
							</div>

							<div>
								<Label className="mb-2 block">Roles</Label>
								<div className="grid grid-cols-2 gap-2">
									{AVAILABLE_ROLES.map((role) => (
										<div
											key={role.value}
											className="flex items-center space-x-2"
										>
											<Checkbox
												id={`role-${role.value}`}
												checked={editFormRoles.includes(role.value)}
												onCheckedChange={() => handleToggleRole(role.value)}
											/>
											<Label
												htmlFor={`role-${role.value}`}
												className="text-sm font-normal cursor-pointer"
											>
												{role.label}
											</Label>
										</div>
									))}
								</div>
							</div>

							<div className="flex justify-end gap-2 pt-2">
								<Button
									type="button"
									variant="outline"
									onClick={() => setEditingClient(null)}
								>
									Cancel
								</Button>
								<Button type="submit">Update Client</Button>
							</div>
						</form>
					)}
				</DialogContent>
			</Dialog>

			{/* Delete Confirmation Dialog */}
			<AlertDialog
				open={!!deletingItem}
				onOpenChange={(open) => !open && setDeletingItem(null)}
			>
				<AlertDialogContent data-testid="dialog-delete-confirmation">
					<AlertDialogHeader>
						<AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
						<AlertDialogDescription>
							This action cannot be undone. This will permanently delete the{" "}
							{deletingItem?.type.slice(0, -1)} "{deletingItem?.name}".
						</AlertDialogDescription>
					</AlertDialogHeader>
					<AlertDialogFooter>
						<AlertDialogCancel data-testid="button-cancel-delete">
							Cancel
						</AlertDialogCancel>
						<AlertDialogAction
							onClick={() => {
								if (deletingItem) {
									deleteMutation.mutate({
										id: deletingItem.id,
										type: deletingItem.type,
									});
								}
							}}
							disabled={deleteMutation.isPending}
							className="bg-red-600 hover:bg-red-700"
							data-testid="button-confirm-delete"
						>
							{deleteMutation.isPending ? "Deleting..." : "Delete"}
						</AlertDialogAction>
					</AlertDialogFooter>
				</AlertDialogContent>
			</AlertDialog>
		</div>
	);
}
