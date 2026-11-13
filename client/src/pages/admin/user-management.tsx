import { useState, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
	DialogTrigger,
} from "@/components/ui/dialog";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@/components/ui/table";
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
	Users,
	Plus,
	Pencil,
	Trash2,
	Search,
	Shield as LucideShield,
	ShieldCheck,
	Scale,
	Building2,
	Briefcase,
	Award,
	UserCheck,
	UserX,
	TrendingUp,
	Download,
	Eye,
	EyeOff,
	Lock,
} from "lucide-react";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { LoadingState } from "@/components/LoadingState";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Checkbox } from "@/components/ui/checkbox";
import {
	BulkSelectTable,
	type Column,
	type BulkAction,
} from "@/components/admin/BulkSelectTable";
import {
	ROLE_DEFINITIONS,
	type RoleId,
	type RoleCategory,
	isStatutoryRole,
	isProfessionalRole,
	STATUTORY_ROLES,
	PROFESSIONAL_ROLES,
} from "@shared/roles";

export interface AssignableRoleItem {
	id: RoleId;
	label: string;
	category: RoleCategory;
	regulator?: string;
	mandatoryCredential?: string;
}

export const ALL_ASSIGNABLE_ROLES: AssignableRoleItem[] = [
	// Statutory Regulatory Roles
	{ id: "principal_officer", label: "Principal Officer", category: "statutory_officer", regulator: "SEBI", mandatoryCredential: "NISM Series X-A / X-B" },
	{ id: "compliance_officer", label: "Compliance Officer", category: "statutory_officer", regulator: "SEBI", mandatoryCredential: "NISM Series III-A" },
	{ id: "designated_director", label: "Designated Director", category: "statutory_officer", regulator: "FIU-IND", mandatoryCredential: "DIN & Board Resolution" },
	{ id: "grievance_officer", label: "Grievance Redressal Officer", category: "statutory_officer", regulator: "SEBI (SCORES)", mandatoryCredential: "SCORES 2.0 Credential" },
	{ id: "ciso", label: "Chief Information Security Officer", category: "statutory_officer", regulator: "CSCRF / CERT-In", mandatoryCredential: "CISA / CISM / CISSP" },
	{ id: "dpo", label: "Data Protection Officer", category: "statutory_officer", regulator: "DPDP Act", mandatoryCredential: "DPO Appointment" },
	{ id: "regulatory_auditor", label: "Regulatory Auditor", category: "statutory_officer", regulator: "SEBI", mandatoryCredential: "CA / Certified Auditor" },
	{ id: "master_agent", label: "Master Partner", category: "statutory_officer", regulator: "AMFI / IRDAI", mandatoryCredential: "ARN / EUIN / POSP" },

	// Licensed Practice Network
	{ id: "ca", label: "Chartered Accountant", category: "licensed_professional", regulator: "ICAI", mandatoryCredential: "ICAI Membership & COP" },
	{ id: "cs", label: "Company Secretary", category: "licensed_professional", regulator: "ICSI", mandatoryCredential: "ICSI Membership & COP" },

	// External Distribution Network
	{ id: "partner", label: "Distribution Partner", category: "distribution_network", regulator: "AMFI", mandatoryCredential: "ARN License" },
	{ id: "sales_support", label: "Sales Support (formerly Agent)", category: "distribution_network", mandatoryCredential: "EUIN Certification" },
	{ id: "client_support", label: "Client Support (formerly Sub-Agent)", category: "distribution_network" },
	{ id: "associate", label: "Partner Associate", category: "distribution_network" },

	// Internal Management & Staff
	{ id: "admin", label: "Administrator", category: "internal_management" },
	{ id: "bd_head", label: "Business Development Head", category: "internal_management" },
	{ id: "finance_head", label: "Finance Head", category: "internal_management" },
	{ id: "tech_head", label: "Technology Head", category: "internal_management" },
	{ id: "ops_head", label: "Operations Head", category: "internal_management" },

	// Client & Investor
	{ id: "client", label: "Retail Client", category: "client" },
	{ id: "business_client", label: "Business Client", category: "client" },
	{ id: "user", label: "Base User", category: "client" },
];

interface User {
	id: string;
	userId: string;
	email: string | null;
	mobile: string | null;
	firstName: string | null;
	middleName: string | null;
	lastName: string | null;
	roles: string[];
	isActive: boolean;
	panNumber: string | null;
	dateOfBirth: string | null;
	agentId: string | null;
	lastLoginAt: string | null;
	loginCount: number;
	createdAt: string;
	isEmailVerified: boolean;
	isMobileVerified: boolean;
}

interface UserStats {
	total: number;
	active: number;
	inactive: number;
	admins: number;
	agents: number;
	clients: number;
}

export default function UserManagement() {
	const { toast } = useToast();
	const [isAddOpen, setIsAddOpen] = useState(false);
	const [editingUser, setEditingUser] = useState<User | null>(null);
	const [deletingUser, setDeletingUser] = useState<User | null>(null);
	const [searchQuery, setSearchQuery] = useState("");
	const [roleFilter, setRoleFilter] = useState("all");
	const [statusFilter, setStatusFilter] = useState("all");

	// PII Unmasking state
	const [unmaskingData, setUnmaskingData] = useState<{
		userId: string;
		field: string;
		maskedValue: string;
	} | null>(null);
	const [unmaskReason, setUnmaskReason] = useState("");
	const [unmaskedValues, setUnmaskedValues] = useState<Record<string, string>>(
		{},
	);

	// Fetch user statistics
	const { data: stats } = useQuery<UserStats>({
		queryKey: ["/api/admin/users-stats"],
	});

	// Fetch users with filters
	const { data: usersData, isLoading } = useQuery({
		queryKey: [
			"/api/admin/users",
			{
				search: searchQuery,
				role: roleFilter !== "all" ? roleFilter : undefined,
				status: statusFilter !== "all" ? statusFilter : undefined,
			},
		],
		queryFn: async () => {
			const params = new URLSearchParams();
			if (searchQuery) params.append("search", searchQuery);
			if (roleFilter !== "all") params.append("role", roleFilter);
			if (statusFilter !== "all") params.append("status", statusFilter);

			const response = await fetch(`/api/admin/users?${params.toString()}`);
			if (!response.ok) throw new Error("Failed to fetch users");
			return response.json();
		},
	});

	const users: User[] = usersData?.users || [];

	// Create user mutation
	const createUserMutation = useMutation({
		mutationFn: async (data: any) => {
			return apiRequest("/api/admin/users", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify(data),
			});
		},
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
			queryClient.invalidateQueries({ queryKey: ["/api/admin/users-stats"] });
			setIsAddOpen(false);
			toast({ title: "User created successfully" });
		},
		onError: (error: any) => {
			toast({
				title: "Failed to create user",
				description: error.message || "An error occurred",
				variant: "destructive",
			});
		},
	});

	// Update user mutation
	const updateUserMutation = useMutation({
		mutationFn: async ({ id, data }: { id: string; data: any }) => {
			return apiRequest(`/api/admin/users/${id}`, {
				method: "PATCH",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify(data),
			});
		},
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
			queryClient.invalidateQueries({ queryKey: ["/api/admin/users-stats"] });
			setEditingUser(null);
			toast({ title: "User updated successfully" });
		},
		onError: (error: any) => {
			toast({
				title: "Failed to update user",
				description: error.message || "An error occurred",
				variant: "destructive",
			});
		},
	});

	// Delete user mutation
	const deleteUserMutation = useMutation({
		mutationFn: async (id: string) => {
			return apiRequest(`/api/admin/users/${id}`, { method: "DELETE" });
		},
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
			queryClient.invalidateQueries({ queryKey: ["/api/admin/users-stats"] });
			setDeletingUser(null);
			toast({ title: "User deleted successfully" });
		},
		onError: (error: any) => {
			toast({
				title: "Failed to delete user",
				description: error.message || "An error occurred",
				variant: "destructive",
			});
		},
	});

	// Unmask mutation
	const unmaskMutation = useMutation({
		mutationFn: async (data: {
			userId: string;
			field: string;
			reason: string;
		}) => {
			const response = await apiRequest("/api/admin/unmask", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify(data),
			});
			return response;
		},
		onSuccess: (data, variables) => {
			const key = `${variables.userId}-${variables.field}`;
			setUnmaskedValues((prev) => ({ ...prev, [key]: data.rawValue }));
			setUnmaskingData(null);
			setUnmaskReason("");
			toast({
				title: "Data Unmasked",
				description: "Access has been logged for audit purposes.",
			});
		},
		onError: (error: any) => {
			toast({
				title: "Unmasking Failed",
				description: error.message || "Unauthorized or invalid reason",
				variant: "destructive",
			});
		},
	});

	const handleCreateUser = (e: React.FormEvent<HTMLFormElement>) => {
		e.preventDefault();
		const formData = new FormData(e.currentTarget);

		const roles: string[] = [];
		for (const roleItem of ALL_ASSIGNABLE_ROLES) {
			if (formData.get(`role_${roleItem.id}`)) {
				roles.push(roleItem.id);
			}
		}
		// Fallbacks for legacy checkbox keys if present
		if (formData.get("role_user") && !roles.includes("user")) roles.push("user");
		if (formData.get("role_admin") && !roles.includes("admin")) roles.push("admin");
		if (formData.get("role_partner") && !roles.includes("partner")) roles.push("partner");
		if (formData.get("role_client") && !roles.includes("client")) roles.push("client");
		if (formData.get("role_agent") && !roles.includes("sales_support")) roles.push("sales_support");

		createUserMutation.mutate({
			email: formData.get("email") || null,
			mobile: formData.get("mobile") || null,
			password: formData.get("password"),
			firstName: formData.get("firstName"),
			middleName: formData.get("middleName") || null,
			lastName: formData.get("lastName") || null,
			roles: roles.length > 0 ? roles : ["user"],
			isActive: formData.get("isActive") === "true",
			panNumber: formData.get("panNumber") || null,
			dateOfBirth: formData.get("dateOfBirth") || null,
			agentId: formData.get("agentId") || null,
		});
	};

	const handleUpdateUser = (e: React.FormEvent<HTMLFormElement>) => {
		e.preventDefault();
		if (!editingUser) return;

		const formData = new FormData(e.currentTarget);

		const roles: string[] = [];
		for (const roleItem of ALL_ASSIGNABLE_ROLES) {
			if (formData.get(`role_${roleItem.id}`)) {
				roles.push(roleItem.id);
			}
		}
		// Fallbacks for legacy checkbox keys if present
		if (formData.get("role_user") && !roles.includes("user")) roles.push("user");
		if (formData.get("role_admin") && !roles.includes("admin")) roles.push("admin");
		if (formData.get("role_partner") && !roles.includes("partner")) roles.push("partner");
		if (formData.get("role_client") && !roles.includes("client")) roles.push("client");
		if (formData.get("role_agent") && !roles.includes("sales_support")) roles.push("sales_support");

		const updateData: any = {
			email: formData.get("email") || null,
			mobile: formData.get("mobile") || null,
			firstName: formData.get("firstName"),
			middleName: formData.get("middleName") || null,
			lastName: formData.get("lastName") || null,
			roles: roles.length > 0 ? roles : ["user"],
			isActive: formData.get("isActive") === "true",
			panNumber: formData.get("panNumber") || null,
			dateOfBirth: formData.get("dateOfBirth") || null,
			agentId: formData.get("agentId") || null,
		};

		const password = formData.get("password") as string;
		if (password) {
			updateData.password = password;
		}

		updateUserMutation.mutate({ id: editingUser.id, data: updateData });
	};

	const getRoleBadge = (roles: string[]) => {
		if (!roles || roles.length === 0) {
			return <Badge variant="secondary">User</Badge>;
		}

		// Normalize legacy agent -> sales_support and sub_agent -> client_support for display
		const displayRoles = roles.map((r) => {
			if (r === "agent") return "sales_support";
			if (r === "sub_agent") return "client_support";
			return r;
		});

		// Find relevant roles to display (filter out base 'user' if higher roles exist)
		const effectiveRoles = displayRoles.length > 1 ? displayRoles.filter((r) => r !== "user") : displayRoles;

		return (
			<div className="flex flex-wrap gap-1 max-w-[280px]">
				{effectiveRoles.map((roleId) => {
					const def = ROLE_DEFINITIONS[roleId as RoleId];
					const name = def?.name || roleId;
					const category = def?.category;
					const regulator = def?.regulator;

					if (category === "statutory_officer" || isStatutoryRole(roleId as RoleId)) {
						return (
							<Badge
								key={roleId}
								className="bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-500/30 flex items-center gap-1 font-semibold text-xs py-0.5"
								data-testid={`badge-statutory-${roleId}`}
							>
								<ShieldCheck className="w-3 h-3 text-amber-500" />
								<span>{name}</span>
								{regulator && <span className="text-[10px] opacity-80 uppercase">({regulator})</span>}
							</Badge>
						);
					}

					if (category === "licensed_professional" || isProfessionalRole(roleId as RoleId)) {
						return (
							<Badge
								key={roleId}
								className="bg-indigo-500/15 text-indigo-700 dark:text-indigo-300 border border-indigo-500/30 flex items-center gap-1 font-medium text-xs py-0.5"
								data-testid={`badge-prof-${roleId}`}
							>
								<Scale className="w-3 h-3 text-indigo-500" />
								<span>{name}</span>
								{regulator && <span className="text-[10px] opacity-80">({regulator})</span>}
							</Badge>
						);
					}

					if (roleId === "superadmin" || roleId === "admin" || category === "internal_management") {
						return (
							<Badge
								key={roleId}
								variant="destructive"
								className="flex items-center gap-1 text-xs py-0.5"
								data-testid={`badge-admin-${roleId}`}
							>
								<LucideShield className="w-3 h-3" />
								<span>{name}</span>
							</Badge>
						);
					}

					if (category === "distribution_network" || roleId === "partner" || roleId === "sales_support" || roleId === "client_support" || roleId === "associate") {
						return (
							<Badge
								key={roleId}
								className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30 flex items-center gap-1 font-medium text-xs py-0.5"
								data-testid={`badge-partner-${roleId}`}
							>
								<Users className="w-3 h-3 text-emerald-500" />
								<span>{name}</span>
							</Badge>
						);
					}

					if (category === "internal_staff") {
						return (
							<Badge
								key={roleId}
								variant="outline"
								className="bg-slate-500/10 text-slate-700 dark:text-slate-300 border-slate-400/30 flex items-center gap-1 text-xs py-0.5"
								data-testid={`badge-staff-${roleId}`}
							>
								<Building2 className="w-3 h-3 text-slate-500" />
								<span>{name}</span>
							</Badge>
						);
					}

					return (
						<Badge
							key={roleId}
							variant="secondary"
							className="text-xs py-0.5"
							data-testid={`badge-client-${roleId}`}
						>
							{roleId === "business_client" ? "Business Client" : "Client"}
						</Badge>
					);
				})}
			</div>
		);
	};

	const refetchUsers = () => {
		queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
		queryClient.invalidateQueries({ queryKey: ["/api/admin/users-stats"] });
	};

	const userColumns: Column<User>[] = useMemo(
		() => [
			{
				id: "userId",
				header: "User ID",
				cell: (user) => (
					<span
						className="font-mono text-sm"
						data-testid={`text-userId-${user.id}`}
					>
						{user.userId}
					</span>
				),
			},
			{
				id: "name",
				header: "Name",
				cell: (user) => (
					<span data-testid={`text-name-${user.id}`}>
						{[user.firstName, user.middleName, user.lastName]
							.filter(Boolean)
							.join(" ") || "N/A"}
					</span>
				),
			},
			{
				id: "email",
				header: "Email",
				cell: (user) => {
					const key = `${user.id}-email`;
					const isUnmasked = !!unmaskedValues[key];
					return (
						<div className="flex items-center gap-2">
							<span className="truncate max-w-[150px]">
								{isUnmasked ? unmaskedValues[key] : user.email || "N/A"}
							</span>
							{!isUnmasked && user.email?.includes("*") && (
								<Button
									variant="ghost"
									size="icon"
									className="h-6 w-6"
									onClick={() =>
										setUnmaskingData({
											userId: user.id,
											field: "email",
											maskedValue: user.email!,
										})
									}
								>
									<Eye className="h-3 w-3" />
								</Button>
							)}
						</div>
					);
				},
			},
			{
				id: "mobile",
				header: "Mobile",
				cell: (user) => {
					const key = `${user.id}-mobile`;
					const isUnmasked = !!unmaskedValues[key];
					return (
						<div className="flex items-center gap-2">
							<span>
								{isUnmasked ? unmaskedValues[key] : user.mobile || "N/A"}
							</span>
							{!isUnmasked && user.mobile?.includes("*") && (
								<Button
									variant="ghost"
									size="icon"
									className="h-6 w-6"
									onClick={() =>
										setUnmaskingData({
											userId: user.id,
											field: "mobile",
											maskedValue: user.mobile!,
										})
									}
								>
									<Eye className="h-3 w-3" />
								</Button>
							)}
						</div>
					);
				},
			},
			{
				id: "role",
				header: "Role",
				cell: (user) => getRoleBadge(user.roles),
			},
			{
				id: "status",
				header: "Status",
				cell: (user) =>
					user.isActive ? (
						<Badge
							variant="outline"
							className="bg-green-50 dark:bg-green-950/30 text-green-700 dark:text-green-300 border-green-200 dark:border-green-800"
							data-testid={`badge-active-${user.id}`}
						>
							Active
						</Badge>
					) : (
						<Badge
							variant="outline"
							className="bg-red-50 dark:bg-red-950/30 text-red-700 dark:text-red-300 border-red-200 dark:border-red-800"
							data-testid={`badge-inactive-${user.id}`}
						>
							Inactive
						</Badge>
					),
			},
			{
				id: "lastLogin",
				header: "Last Login",
				cell: (user) => (
					<span
						className="text-sm text-muted-foreground"
						data-testid={`text-lastLogin-${user.id}`}
					>
						{user.lastLoginAt
							? new Date(user.lastLoginAt).toLocaleDateString()
							: "Never"}
					</span>
				),
			},
			{
				id: "actions",
				header: "Actions",
				cell: (user) => (
					<div className="flex justify-end gap-2">
						<Button
							variant="ghost"
							size="sm"
							className="text-amber-600 hover:text-amber-800 dark:text-amber-200 hover:bg-amber-50 dark:bg-amber-950/30"
							onClick={() => setEditingUser(user)}
							data-testid={`button-edit-${user.id}`}
						>
							<Pencil className="w-4 h-4" />
						</Button>
						<Button
							variant="ghost"
							size="sm"
							className="text-red-600 hover:text-red-800 dark:text-red-200 hover:bg-red-50 dark:bg-red-950/30"
							onClick={() => setDeletingUser(user)}
							data-testid={`button-delete-${user.id}`}
						>
							<Trash2 className="w-4 h-4" />
						</Button>
					</div>
				),
			},
		],
		[],
	);

	const userBulkActions: BulkAction<User>[] = useMemo(
		() => [
			{
				id: "batch-activate",
				label: "Activate Selected",
				icon: <UserCheck className="h-4 w-4 mr-2" />,
				variant: "default",
				requiresConfirmation: true,
				confirmTitle: "Activate Users",
				confirmDescription:
					"Are you sure you want to activate the selected users?",
				onExecute: async (items) => {
					try {
						const inactiveItems = items.filter((u) => !u.isActive);
						if (inactiveItems.length === 0) {
							toast({
								title: "No inactive users selected",
								variant: "destructive",
							});
							return;
						}
						const result = await apiRequest("/api/admin/users/batch-activate", {
							method: "POST",
							body: JSON.stringify({ ids: inactiveItems.map((u) => u.id) }),
						});
						toast({
							title: result.success ? "Success" : "Partial Success",
							description: result.message,
							variant: result.success ? "default" : "destructive",
						});
						refetchUsers();
					} catch (error: any) {
						toast({
							title: "Error",
							description: error.message || "Activation failed",
							variant: "destructive",
						});
					}
				},
			},
			{
				id: "batch-suspend",
				label: "Suspend Selected",
				icon: <UserX className="h-4 w-4 mr-2" />,
				variant: "destructive",
				requiresConfirmation: true,
				confirmTitle: "Suspend Users",
				confirmDescription:
					"Are you sure you want to suspend the selected users? They will not be able to log in.",
				onExecute: async (items) => {
					try {
						const activeItems = items.filter((u) => u.isActive);
						if (activeItems.length === 0) {
							toast({
								title: "No active users selected",
								variant: "destructive",
							});
							return;
						}
						const result = await apiRequest("/api/admin/users/batch-suspend", {
							method: "POST",
							body: JSON.stringify({
								ids: activeItems.map((u) => u.id),
								reason: "Bulk suspension via admin console",
							}),
						});
						toast({
							title: result.success ? "Success" : "Partial Success",
							description: result.message,
							variant: result.success ? "default" : "destructive",
						});
						refetchUsers();
					} catch (error: any) {
						toast({
							title: "Error",
							description: error.message || "Suspension failed",
							variant: "destructive",
						});
					}
				},
			},
			{
				id: "batch-export",
				label: "Export Selected",
				icon: <Download className="h-4 w-4 mr-2" />,
				variant: "outline",
				requiresConfirmation: false,
				onExecute: async (items) => {
					try {
						const response = await fetch("/api/admin/users/batch-export", {
							method: "POST",
							headers: { "Content-Type": "application/json" },
							body: JSON.stringify({
								ids: items.map((u) => u.id),
								format: "csv",
							}),
							credentials: "include",
						});
						if (!response.ok) throw new Error("Export failed");
						const blob = await response.blob();
						const url = window.URL.createObjectURL(blob);
						const a = document.createElement("a");
						a.href = url;
						a.download = "users_export.csv";
						document.body.appendChild(a);
						a.click();
						window.URL.revokeObjectURL(url);
						document.body.removeChild(a);
						toast({
							title: "Export Complete",
							description: `Exported ${items.length} users`,
						});
					} catch (error: any) {
						toast({
							title: "Error",
							description: error.message || "Export failed",
							variant: "destructive",
						});
					}
				},
			},
		],
		[toast],
	);

	if (isLoading) {
		return <LoadingState variant="table" />;
	}

	return (
		<div className="space-y-6 p-6">
			<div className="flex justify-between items-center">
				<div>
					<h1 className="text-3xl font-bold">User Management</h1>
					<p className="text-muted-foreground">Manage all users across roles</p>
				</div>
				<Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
					<DialogTrigger asChild>
						<Button
							className="bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-700 hover:to-blue-700 text-foreground shadow-md"
							data-testid="button-add-user"
						>
							<Plus className="w-4 h-4 mr-2" />
							Add User
						</Button>
					</DialogTrigger>
					<DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
						<DialogHeader>
							<DialogTitle>Create New User</DialogTitle>
							<DialogDescription>
								Add a new user with specific role and permissions
							</DialogDescription>
						</DialogHeader>
						<form onSubmit={handleCreateUser} className="space-y-4">
							<div className="grid grid-cols-2 gap-4">
								<div className="space-y-2">
									<Label htmlFor="firstName">First Name *</Label>
									<Input
										id="firstName"
										name="firstName"
										required
										data-testid="input-firstName"
									/>
								</div>
								<div className="space-y-2">
									<Label htmlFor="middleName">Middle Name</Label>
									<Input
										id="middleName"
										name="middleName"
										data-testid="input-middleName"
									/>
								</div>
							</div>
							<div className="space-y-2">
								<Label htmlFor="lastName">Last Name</Label>
								<Input
									id="lastName"
									name="lastName"
									data-testid="input-lastName"
								/>
							</div>
							<div className="grid grid-cols-2 gap-4">
								<div className="space-y-2">
									<Label htmlFor="email">Email</Label>
									<Input
										id="email"
										name="email"
										type="email"
										data-testid="input-email"
									/>
								</div>
								<div className="space-y-2">
									<Label htmlFor="mobile">Mobile</Label>
									<Input id="mobile" name="mobile" data-testid="input-mobile" />
								</div>
							</div>
							<div className="space-y-2">
								<Label htmlFor="password">Password *</Label>
								<Input
									id="password"
									name="password"
									type="password"
									required
									minLength={8}
									data-testid="input-password"
								/>
								<p className="text-xs text-muted-foreground">
									Minimum 8 characters
								</p>
							</div>
							<div className="grid grid-cols-2 gap-4">
								<div className="space-y-2">
									<Label htmlFor="panNumber">PAN Number</Label>
									<Input
										id="panNumber"
										name="panNumber"
										data-testid="input-panNumber"
									/>
								</div>
								<div className="space-y-2">
									<Label htmlFor="dateOfBirth">Date of Birth</Label>
									<Input
										id="dateOfBirth"
										name="dateOfBirth"
										type="date"
										data-testid="input-dateOfBirth"
									/>
								</div>
							</div>
							<div className="space-y-2">
								<Label htmlFor="agentId">Agent ID (if applicable)</Label>
								<Input
									id="agentId"
									name="agentId"
									data-testid="input-agentId"
								/>
							</div>
							<div className="space-y-3">
								<Label className="text-sm font-semibold">User Roles & Access Permissions *</Label>
								
								{/* 1. Statutory Regulatory Roles */}
								<div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-3 space-y-2">
									<div className="flex items-center gap-1.5 text-xs font-semibold text-amber-700 dark:text-amber-300">
										<ShieldCheck className="w-4 h-4 text-amber-500" />
										<span>Statutory Regulatory Officers (Mandatory Regulatory Filings)</span>
									</div>
									<div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
										{ALL_ASSIGNABLE_ROLES.filter((r) => r.category === "statutory_officer").map((role) => (
											<div key={role.id} className="flex items-start space-x-2">
												<Checkbox
													id={`role_${role.id}`}
													name={`role_${role.id}`}
													data-testid={`checkbox-role-${role.id}`}
												/>
												<Label
													htmlFor={`role_${role.id}`}
													className="text-xs font-normal cursor-pointer leading-tight"
												>
													<span className="font-medium text-foreground">{role.label}</span>
													{role.regulator && (
														<span className="ml-1 text-[10px] text-amber-600 dark:text-amber-400 font-semibold uppercase">
															({role.regulator})
														</span>
													)}
													{role.mandatoryCredential && (
														<span className="block text-[10px] text-muted-foreground">
															Req: {role.mandatoryCredential}
														</span>
													)}
												</Label>
											</div>
										))}
									</div>
								</div>

								{/* 2. Accredited Practice Network */}
								<div className="rounded-lg border border-indigo-500/30 bg-indigo-500/5 p-3 space-y-2">
									<div className="flex items-center gap-1.5 text-xs font-semibold text-indigo-700 dark:text-indigo-300">
										<Scale className="w-4 h-4 text-indigo-500" />
										<span>Accredited Licensed Practice (CA & CS Practice Portal)</span>
									</div>
									<div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
										{ALL_ASSIGNABLE_ROLES.filter((r) => r.category === "licensed_professional").map((role) => (
											<div key={role.id} className="flex items-start space-x-2">
												<Checkbox
													id={`role_${role.id}`}
													name={`role_${role.id}`}
													data-testid={`checkbox-role-${role.id}`}
												/>
												<Label
													htmlFor={`role_${role.id}`}
													className="text-xs font-normal cursor-pointer leading-tight"
												>
													<span className="font-medium text-foreground">{role.label}</span>
													{role.regulator && (
														<span className="ml-1 text-[10px] text-indigo-600 dark:text-indigo-400 font-semibold">
															({role.regulator})
														</span>
													)}
													{role.mandatoryCredential && (
														<span className="block text-[10px] text-muted-foreground">
															Req: {role.mandatoryCredential}
														</span>
													)}
												</Label>
											</div>
										))}
									</div>
								</div>

								{/* 3. External Distribution Network */}
								<div className="rounded-lg border border-emerald-500/30 bg-emerald-500/5 p-3 space-y-2">
									<div className="flex items-center gap-1.5 text-xs font-semibold text-emerald-700 dark:text-emerald-300">
										<Users className="w-4 h-4 text-emerald-500" />
										<span>External Distribution Network & Support</span>
									</div>
									<div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
										{ALL_ASSIGNABLE_ROLES.filter((r) => r.category === "distribution_network").map((role) => (
											<div key={role.id} className="flex items-start space-x-2">
												<Checkbox
													id={`role_${role.id}`}
													name={`role_${role.id}`}
													data-testid={`checkbox-role-${role.id}`}
												/>
												<Label
													htmlFor={`role_${role.id}`}
													className="text-xs font-normal cursor-pointer leading-tight"
												>
													<span className="font-medium text-foreground">{role.label}</span>
													{role.mandatoryCredential && (
														<span className="block text-[10px] text-muted-foreground">
															Req: {role.mandatoryCredential}
														</span>
													)}
												</Label>
											</div>
										))}
									</div>
								</div>

								{/* 4. Administration & Clients */}
								<div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
									<div className="rounded-lg border border-border p-3 space-y-2">
										<span className="text-xs font-semibold text-foreground">Internal Administration</span>
										<div className="space-y-1.5">
											{ALL_ASSIGNABLE_ROLES.filter((r) => r.category === "internal_management").map((role) => (
												<div key={role.id} className="flex items-center space-x-2">
													<Checkbox
														id={`role_${role.id}`}
														name={`role_${role.id}`}
														data-testid={`checkbox-role-${role.id}`}
													/>
													<Label htmlFor={`role_${role.id}`} className="text-xs font-normal cursor-pointer">
														{role.label}
													</Label>
												</div>
											))}
										</div>
									</div>

									<div className="rounded-lg border border-border p-3 space-y-2">
										<span className="text-xs font-semibold text-foreground">Clients & Investors</span>
										<div className="space-y-1.5">
											{ALL_ASSIGNABLE_ROLES.filter((r) => r.category === "client").map((role) => (
												<div key={role.id} className="flex items-center space-x-2">
													<Checkbox
														id={`role_${role.id}`}
														name={`role_${role.id}`}
														defaultChecked={role.id === "user"}
														data-testid={`checkbox-role-${role.id}`}
													/>
													<Label htmlFor={`role_${role.id}`} className="text-xs font-normal cursor-pointer">
														{role.label}
													</Label>
												</div>
											))}
										</div>
									</div>
								</div>
							</div>
							<div className="space-y-2">
								<Label htmlFor="isActive">Status</Label>
								<Select name="isActive" defaultValue="true">
									<SelectTrigger data-testid="select-status">
										<SelectValue />
									</SelectTrigger>
									<SelectContent>
										<SelectItem value="true">Active</SelectItem>
										<SelectItem value="false">Inactive</SelectItem>
									</SelectContent>
								</Select>
							</div>
							<div className="flex justify-end gap-2">
								<Button
									type="button"
									variant="outline"
									className="border-border text-muted-foreground hover:bg-muted"
									onClick={() => setIsAddOpen(false)}
									data-testid="button-cancel"
								>
									Cancel
								</Button>
								<Button
									type="submit"
									className="bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-700 hover:to-blue-700 text-foreground"
									disabled={createUserMutation.isPending}
									data-testid="button-submit"
								>
									{createUserMutation.isPending ? "Creating..." : "Create User"}
								</Button>
							</div>
						</form>
					</DialogContent>
				</Dialog>
			</div>

			{/* Statistics Cards */}
			{stats && (
				<div className="grid grid-cols-2 md:grid-cols-6 gap-4">
					<Card>
						<CardHeader className="pb-2">
							<CardTitle className="text-sm font-medium text-muted-foreground">
								Total Users
							</CardTitle>
						</CardHeader>
						<CardContent>
							<div className="flex items-center gap-2">
								<Users className="w-4 h-4 text-muted-foreground" />
								<span className="text-2xl font-bold" data-testid="stat-total">
									{stats.total}
								</span>
							</div>
						</CardContent>
					</Card>
					<Card>
						<CardHeader className="pb-2">
							<CardTitle className="text-sm font-medium text-muted-foreground">
								Active
							</CardTitle>
						</CardHeader>
						<CardContent>
							<div className="flex items-center gap-2">
								<UserCheck className="w-4 h-4 text-green-500" />
								<span
									className="text-2xl font-bold text-green-600"
									data-testid="stat-active"
								>
									{stats.active}
								</span>
							</div>
						</CardContent>
					</Card>
					<Card>
						<CardHeader className="pb-2">
							<CardTitle className="text-sm font-medium text-muted-foreground">
								Inactive
							</CardTitle>
						</CardHeader>
						<CardContent>
							<div className="flex items-center gap-2">
								<UserX className="w-4 h-4 text-red-500" />
								<span
									className="text-2xl font-bold text-red-600"
									data-testid="stat-inactive"
								>
									{stats.inactive}
								</span>
							</div>
						</CardContent>
					</Card>
					<Card>
						<CardHeader className="pb-2">
							<CardTitle className="text-sm font-medium text-muted-foreground">
								Admins
							</CardTitle>
						</CardHeader>
						<CardContent>
							<div className="flex items-center gap-2">
								<LucideShield className="w-4 h-4 text-red-500" />
								<span className="text-2xl font-bold" data-testid="stat-admins">
									{stats.admins}
								</span>
							</div>
						</CardContent>
					</Card>
					<Card>
						<CardHeader className="pb-2">
							<CardTitle className="text-sm font-medium text-muted-foreground">
								Agents
							</CardTitle>
						</CardHeader>
						<CardContent>
							<div className="flex items-center gap-2">
								<TrendingUp className="w-4 h-4 text-blue-500" />
								<span className="text-2xl font-bold" data-testid="stat-agents">
									{stats.agents}
								</span>
							</div>
						</CardContent>
					</Card>
					<Card>
						<CardHeader className="pb-2">
							<CardTitle className="text-sm font-medium text-muted-foreground">
								Clients
							</CardTitle>
						</CardHeader>
						<CardContent>
							<div className="flex items-center gap-2">
								<Users className="w-4 h-4 text-muted-foreground" />
								<span className="text-2xl font-bold" data-testid="stat-clients">
									{stats.clients}
								</span>
							</div>
						</CardContent>
					</Card>
				</div>
			)}

			{/* Filters */}
			<Card>
				<CardHeader>
					<CardTitle>Search & Filter</CardTitle>
				</CardHeader>
				<CardContent>
					<div className="flex gap-4">
						<div className="flex-1">
							<div className="relative">
								<Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
								<Input
									placeholder="Search by name, email, mobile, userId, PAN..."
									value={searchQuery}
									onChange={(e) => setSearchQuery(e.target.value)}
									className="pl-9"
									data-testid="input-search"
								/>
							</div>
						</div>
						<Select value={roleFilter} onValueChange={setRoleFilter}>
							<SelectTrigger className="w-56" data-testid="select-role-filter">
								<SelectValue placeholder="Filter by role" />
							</SelectTrigger>
							<SelectContent className="max-h-80">
								<SelectItem value="all">All Roles</SelectItem>
								
								{/* Statutory Regulatory Roles */}
								<SelectItem value="statutory" className="font-semibold text-amber-600 dark:text-amber-400">
									🛡️ All Statutory Officers
								</SelectItem>
								<SelectItem value="principal_officer">Principal Officer (SEBI)</SelectItem>
								<SelectItem value="compliance_officer">Compliance Officer (SEBI)</SelectItem>
								<SelectItem value="designated_director">Designated Director (PMLA)</SelectItem>
								<SelectItem value="ciso">CISO (CSCRF/CERT-In)</SelectItem>
								<SelectItem value="grievance_officer">Grievance Officer (SCORES)</SelectItem>
								<SelectItem value="dpo">Data Protection Officer (DPDP)</SelectItem>
								<SelectItem value="regulatory_auditor">Regulatory Auditor</SelectItem>
								<SelectItem value="master_agent">Master Partner Anchor</SelectItem>

								{/* Professional Practice */}
								<SelectItem value="professional" className="font-semibold text-indigo-600 dark:text-indigo-400">
									⚖️ All CA & CS Practice
								</SelectItem>
								<SelectItem value="ca">Chartered Accountant (ICAI)</SelectItem>
								<SelectItem value="cs">Company Secretary (ICSI)</SelectItem>

								{/* Distribution Network */}
								<SelectItem value="partner_network" className="font-semibold text-emerald-600 dark:text-emerald-400">
									🤝 All Partners & Support
								</SelectItem>
								<SelectItem value="partner">Distribution Partner</SelectItem>
								<SelectItem value="sales_support">Sales Support</SelectItem>
								<SelectItem value="client_support">Client Support</SelectItem>
								<SelectItem value="associate">Partner Associate</SelectItem>

								{/* Management & Clients */}
								<SelectItem value="admin">Administrator / Management</SelectItem>
								<SelectItem value="client">Clients & Users</SelectItem>
							</SelectContent>
						</Select>
						<Select value={statusFilter} onValueChange={setStatusFilter}>
							<SelectTrigger
								className="w-40"
								data-testid="select-status-filter"
							>
								<SelectValue placeholder="Filter by status" />
							</SelectTrigger>
							<SelectContent>
								<SelectItem value="all">All Status</SelectItem>
								<SelectItem value="active">Active</SelectItem>
								<SelectItem value="inactive">Inactive</SelectItem>
							</SelectContent>
						</Select>
					</div>
				</CardContent>
			</Card>

			{/* Users Table with Bulk Selection */}
			<Card>
				<CardHeader>
					<CardTitle>All Users ({users.length})</CardTitle>
					<CardDescription>
						Complete list of users in the system - Select users for bulk actions
					</CardDescription>
				</CardHeader>
				<CardContent className="p-0">
					<BulkSelectTable
						data={users}
						columns={userColumns}
						bulkActions={userBulkActions}
						isLoading={isLoading}
						emptyMessage="No users found matching your criteria"
					/>
				</CardContent>
			</Card>

			{/* Edit User Dialog */}
			<Dialog
				open={!!editingUser}
				onOpenChange={(open) => !open && setEditingUser(null)}
			>
				<DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
					<DialogHeader>
						<DialogTitle>Edit User</DialogTitle>
						<DialogDescription>
							Update user information and permissions
						</DialogDescription>
					</DialogHeader>
					{editingUser && (
						<form onSubmit={handleUpdateUser} className="space-y-4">
							<div className="grid grid-cols-2 gap-4">
								<div className="space-y-2">
									<Label htmlFor="edit-firstName">First Name *</Label>
									<Input
										id="edit-firstName"
										name="firstName"
										defaultValue={editingUser.firstName || ""}
										required
										data-testid="input-edit-firstName"
									/>
								</div>
								<div className="space-y-2">
									<Label htmlFor="edit-middleName">Middle Name</Label>
									<Input
										id="edit-middleName"
										name="middleName"
										defaultValue={editingUser.middleName || ""}
										data-testid="input-edit-middleName"
									/>
								</div>
							</div>
							<div className="space-y-2">
								<Label htmlFor="edit-lastName">Last Name</Label>
								<Input
									id="edit-lastName"
									name="lastName"
									defaultValue={editingUser.lastName || ""}
									data-testid="input-edit-lastName"
								/>
							</div>
							<div className="grid grid-cols-2 gap-4">
								<div className="space-y-2">
									<Label htmlFor="edit-email">Email</Label>
									<Input
										id="edit-email"
										name="email"
										type="email"
										defaultValue={editingUser.email || ""}
										data-testid="input-edit-email"
									/>
								</div>
								<div className="space-y-2">
									<Label htmlFor="edit-mobile">Mobile</Label>
									<Input
										id="edit-mobile"
										name="mobile"
										defaultValue={editingUser.mobile || ""}
										data-testid="input-edit-mobile"
									/>
								</div>
							</div>
							<div className="space-y-2">
								<Label htmlFor="edit-password">
									Password (leave blank to keep current)
								</Label>
								<Input
									id="edit-password"
									name="password"
									type="password"
									minLength={8}
									data-testid="input-edit-password"
								/>
							</div>
							<div className="grid grid-cols-2 gap-4">
								<div className="space-y-2">
									<Label htmlFor="edit-panNumber">PAN Number</Label>
									<Input
										id="edit-panNumber"
										name="panNumber"
										defaultValue={editingUser.panNumber || ""}
										data-testid="input-edit-panNumber"
									/>
								</div>
								<div className="space-y-2">
									<Label htmlFor="edit-dateOfBirth">Date of Birth</Label>
									<Input
										id="edit-dateOfBirth"
										name="dateOfBirth"
										type="date"
										defaultValue={editingUser.dateOfBirth || ""}
										data-testid="input-edit-dateOfBirth"
									/>
								</div>
							</div>
							<div className="space-y-2">
								<Label htmlFor="edit-agentId">Agent ID</Label>
								<Input
									id="edit-agentId"
									name="agentId"
									defaultValue={editingUser.agentId || ""}
									data-testid="input-edit-agentId"
								/>
							</div>
							<div className="space-y-3">
								<Label className="text-sm font-semibold">User Roles & Access Permissions *</Label>
								
								{/* 1. Statutory Regulatory Roles */}
								<div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-3 space-y-2">
									<div className="flex items-center gap-1.5 text-xs font-semibold text-amber-700 dark:text-amber-300">
										<ShieldCheck className="w-4 h-4 text-amber-500" />
										<span>Statutory Regulatory Officers (Mandatory Regulatory Filings)</span>
									</div>
									<div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
										{ALL_ASSIGNABLE_ROLES.filter((r) => r.category === "statutory_officer").map((role) => (
											<div key={role.id} className="flex items-start space-x-2">
												<Checkbox
													id={`edit-role_${role.id}`}
													name={`role_${role.id}`}
													defaultChecked={editingUser.roles.includes(role.id)}
													data-testid={`checkbox-edit-role-${role.id}`}
												/>
												<Label
													htmlFor={`edit-role_${role.id}`}
													className="text-xs font-normal cursor-pointer leading-tight"
												>
													<span className="font-medium text-foreground">{role.label}</span>
													{role.regulator && (
														<span className="ml-1 text-[10px] text-amber-600 dark:text-amber-400 font-semibold uppercase">
															({role.regulator})
														</span>
													)}
													{role.mandatoryCredential && (
														<span className="block text-[10px] text-muted-foreground">
															Req: {role.mandatoryCredential}
														</span>
													)}
												</Label>
											</div>
										))}
									</div>
								</div>

								{/* 2. Accredited Practice Network */}
								<div className="rounded-lg border border-indigo-500/30 bg-indigo-500/5 p-3 space-y-2">
									<div className="flex items-center gap-1.5 text-xs font-semibold text-indigo-700 dark:text-indigo-300">
										<Scale className="w-4 h-4 text-indigo-500" />
										<span>Accredited Licensed Practice (CA & CS Practice Portal)</span>
									</div>
									<div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
										{ALL_ASSIGNABLE_ROLES.filter((r) => r.category === "licensed_professional").map((role) => (
											<div key={role.id} className="flex items-start space-x-2">
												<Checkbox
													id={`edit-role_${role.id}`}
													name={`role_${role.id}`}
													defaultChecked={editingUser.roles.includes(role.id)}
													data-testid={`checkbox-edit-role-${role.id}`}
												/>
												<Label
													htmlFor={`edit-role_${role.id}`}
													className="text-xs font-normal cursor-pointer leading-tight"
												>
													<span className="font-medium text-foreground">{role.label}</span>
													{role.regulator && (
														<span className="ml-1 text-[10px] text-indigo-600 dark:text-indigo-400 font-semibold">
															({role.regulator})
														</span>
													)}
													{role.mandatoryCredential && (
														<span className="block text-[10px] text-muted-foreground">
															Req: {role.mandatoryCredential}
														</span>
													)}
												</Label>
											</div>
										))}
									</div>
								</div>

								{/* 3. External Distribution Network */}
								<div className="rounded-lg border border-emerald-500/30 bg-emerald-500/5 p-3 space-y-2">
									<div className="flex items-center gap-1.5 text-xs font-semibold text-emerald-700 dark:text-emerald-300">
										<Users className="w-4 h-4 text-emerald-500" />
										<span>External Distribution Network & Support</span>
									</div>
									<div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
										{ALL_ASSIGNABLE_ROLES.filter((r) => r.category === "distribution_network").map((role) => (
											<div key={role.id} className="flex items-start space-x-2">
												<Checkbox
													id={`edit-role_${role.id}`}
													name={`role_${role.id}`}
													defaultChecked={
														editingUser.roles.includes(role.id) ||
														(role.id === "sales_support" && editingUser.roles.includes("agent")) ||
														(role.id === "client_support" && editingUser.roles.includes("sub_agent"))
													}
													data-testid={`checkbox-edit-role-${role.id}`}
												/>
												<Label
													htmlFor={`edit-role_${role.id}`}
													className="text-xs font-normal cursor-pointer leading-tight"
												>
													<span className="font-medium text-foreground">{role.label}</span>
													{role.mandatoryCredential && (
														<span className="block text-[10px] text-muted-foreground">
															Req: {role.mandatoryCredential}
														</span>
													)}
												</Label>
											</div>
										))}
									</div>
								</div>

								{/* 4. Administration & Clients */}
								<div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
									<div className="rounded-lg border border-border p-3 space-y-2">
										<span className="text-xs font-semibold text-foreground">Internal Administration</span>
										<div className="space-y-1.5">
											{ALL_ASSIGNABLE_ROLES.filter((r) => r.category === "internal_management").map((role) => (
												<div key={role.id} className="flex items-center space-x-2">
													<Checkbox
														id={`edit-role_${role.id}`}
														name={`role_${role.id}`}
														defaultChecked={editingUser.roles.includes(role.id)}
														data-testid={`checkbox-edit-role-${role.id}`}
													/>
													<Label htmlFor={`edit-role_${role.id}`} className="text-xs font-normal cursor-pointer">
														{role.label}
													</Label>
												</div>
											))}
										</div>
									</div>

									<div className="rounded-lg border border-border p-3 space-y-2">
										<span className="text-xs font-semibold text-foreground">Clients & Investors</span>
										<div className="space-y-1.5">
											{ALL_ASSIGNABLE_ROLES.filter((r) => r.category === "client").map((role) => (
												<div key={role.id} className="flex items-center space-x-2">
													<Checkbox
														id={`edit-role_${role.id}`}
														name={`role_${role.id}`}
														defaultChecked={editingUser.roles.includes(role.id)}
														data-testid={`checkbox-edit-role-${role.id}`}
													/>
													<Label htmlFor={`edit-role_${role.id}`} className="text-xs font-normal cursor-pointer">
														{role.label}
													</Label>
												</div>
											))}
										</div>
									</div>
								</div>
							</div>
							<div className="space-y-2">
								<Label htmlFor="edit-isActive">Status</Label>
								<Select
									name="isActive"
									defaultValue={editingUser.isActive ? "true" : "false"}
								>
									<SelectTrigger data-testid="select-edit-status">
										<SelectValue />
									</SelectTrigger>
									<SelectContent>
										<SelectItem value="true">Active</SelectItem>
										<SelectItem value="false">Inactive</SelectItem>
									</SelectContent>
								</Select>
							</div>
							<div className="flex justify-end gap-2">
								<Button
									type="button"
									variant="outline"
									className="border-border text-muted-foreground hover:bg-muted"
									onClick={() => setEditingUser(null)}
									data-testid="button-edit-cancel"
								>
									Cancel
								</Button>
								<Button
									type="submit"
									className="bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-700 hover:to-blue-700 text-foreground"
									disabled={updateUserMutation.isPending}
									data-testid="button-edit-submit"
								>
									{updateUserMutation.isPending ? "Updating..." : "Update User"}
								</Button>
							</div>
						</form>
					)}
				</DialogContent>
			</Dialog>

			{/* Delete Confirmation Dialog */}
			<AlertDialog
				open={!!deletingUser}
				onOpenChange={(open) => !open && setDeletingUser(null)}
			>
				<AlertDialogContent>
					<AlertDialogHeader>
						<AlertDialogTitle>Delete User</AlertDialogTitle>
						<AlertDialogDescription>
							Are you sure you want to deactivate {deletingUser?.firstName}{" "}
							{deletingUser?.lastName}? This will set their status to inactive
							but preserve their data.
						</AlertDialogDescription>
					</AlertDialogHeader>
					<AlertDialogFooter>
						<AlertDialogCancel data-testid="button-delete-cancel">
							Cancel
						</AlertDialogCancel>
						<AlertDialogAction
							onClick={() =>
								deletingUser && deleteUserMutation.mutate(deletingUser.id)
							}
							className="bg-red-600 hover:bg-red-700"
							data-testid="button-delete-confirm"
						>
							{deleteUserMutation.isPending ? "Deleting..." : "Delete User"}
						</AlertDialogAction>
					</AlertDialogFooter>
				</AlertDialogContent>
			</AlertDialog>
			{/* PII Unmasking Dialog */}
			<Dialog
				open={!!unmaskingData}
				onOpenChange={(open) => !open && setUnmaskingData(null)}
			>
				<DialogContent>
					<DialogHeader>
						<DialogTitle className="flex items-center gap-2 text-red-600">
							<Lock className="h-5 w-5" />
							Sensitive Data Access
						</DialogTitle>
						<DialogDescription>
							You are requesting access to raw PII for user ID:{" "}
							{unmaskingData?.userId}. This action will be permanently logged in
							the immutable audit trail.
						</DialogDescription>
					</DialogHeader>

					<div className="space-y-4 py-4">
						<div className="p-3 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-md">
							<p className="text-sm text-amber-800 dark:text-amber-200 font-medium">
								Field: {unmaskingData?.field.toUpperCase()}
							</p>
							<p className="text-xs text-amber-700 dark:text-amber-300 mt-1">
								Masked: {unmaskingData?.maskedValue}
							</p>
						</div>

						<div className="space-y-2">
							<Label>Justification / Reason *</Label>
							<Textarea
								placeholder="e.g., Compliance audit, KYC verification, Customer support request..."
								value={unmaskReason}
								onChange={(e) => setUnmaskReason(e.target.value)}
								required
							/>
							<p className="text-[10px] text-muted-foreground">
								Minimum 10 characters required for regulatory compliance.
							</p>
						</div>
					</div>

					<DialogFooter>
						<Button variant="outline" onClick={() => setUnmaskingData(null)}>
							Cancel
						</Button>
						<Button
							variant="destructive"
							disabled={unmaskReason.length < 10 || unmaskMutation.isPending}
							onClick={() =>
								unmaskingData &&
								unmaskMutation.mutate({
									userId: unmaskingData.userId,
									field: unmaskingData.field,
									reason: unmaskReason,
								})
							}
						>
							{unmaskMutation.isPending ? "Unmasking..." : "Unmask & Log"}
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>
		</div>
	);
}
