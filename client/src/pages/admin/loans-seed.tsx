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
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import {
	RefreshCw,
	Search,
	Loader2,
	ArrowLeft,
	CreditCard,
	Building,
	Home,
	Car,
	Coins,
	GraduationCap,
	Briefcase,
	TrendingUp,
	User,
} from "lucide-react";
import { Link } from "wouter";

interface LoanSubcategory {
	id: string;
	name: string;
	slug: string;
	description: string | null;
	icon: string;
	displayOrder: number;
	isActive: boolean;
}

interface LoanProduct {
	id: string;
	name: string;
	subcategoryId: string;
	provider: string;
	interestRateMin: string | null;
	interestRateMax: string | null;
	processingFee: string | null;
	minAmount: string | null;
	maxAmount: string | null;
	tenure: string | null;
	isActive: boolean;
}

const iconMap: Record<string, any> = {
	User: User,
	Home: Home,
	Briefcase: Briefcase,
	Car: Car,
	Coins: Coins,
	GraduationCap: GraduationCap,
	Building: Building,
	TrendingUp: TrendingUp,
	CreditCard: CreditCard,
};

export default function LoansSeedPage() {
	const { toast } = useToast();
	const [searchQuery, setSearchQuery] = useState("");

	const { data: categoriesData, isLoading: isLoadingCategories } = useQuery<{
		categories: any[];
	}>({
		queryKey: ["/api/admin/store/categories"],
	});

	const loansCategory = categoriesData?.categories?.find(
		(c) => c.id === "cat-loans",
	);
	const subcategories: LoanSubcategory[] = loansCategory?.subcategories || [];

	const filteredSubcategories = subcategories.filter((sub) => {
		if (!searchQuery) return true;
		const query = searchQuery.toLowerCase();
		return (
			sub.name.toLowerCase().includes(query) ||
			sub.slug.toLowerCase().includes(query) ||
			(sub.description?.toLowerCase().includes(query) ?? false)
		);
	});

	const toggleSubcategoryMutation = useMutation({
		mutationFn: async ({ id, isActive }: { id: string; isActive: boolean }) => {
			const response = await apiRequest(
				`/api/admin/store/subcategories/${id}`,
				{
					method: "PATCH",
					body: JSON.stringify({ isActive }),
				},
			);
			return response;
		},
		onSuccess: () => {
			queryClient.invalidateQueries({
				queryKey: ["/api/admin/store/categories"],
			});
			toast({ title: "Success", description: "Subcategory status updated" });
		},
		onError: () => {
			toast({
				title: "Error",
				description: "Failed to update status",
				variant: "destructive",
			});
		},
	});

	const getIcon = (iconName: string) => {
		const IconComponent = iconMap[iconName] || CreditCard;
		return <IconComponent className="h-4 w-4" />;
	};

	return (
		<div className="min-h-screen bg-background p-6">
			<div className="max-w-7xl mx-auto space-y-6">
				<div className="flex items-center gap-4">
					<Link href="/admin/store">
						<Button variant="ghost" size="icon">
							<ArrowLeft className="h-4 w-4" />
						</Button>
					</Link>
					<div>
						<h1 className="text-2xl font-bold">Loans & Credit Management</h1>
						<p className="text-muted-foreground">
							Manage loan subcategories and products for the platform
						</p>
					</div>
				</div>

				<Card>
					<CardHeader>
						<div className="flex items-center justify-between">
							<div>
								<CardTitle className="flex items-center gap-2">
									<CreditCard className="h-5 w-5" />
									Loan Subcategories
								</CardTitle>
								<CardDescription>
									{subcategories.length} subcategories configured
								</CardDescription>
							</div>
							<div className="flex items-center gap-2">
								<div className="relative">
									<Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
									<Input
										placeholder="Search subcategories..."
										className="pl-10 w-64"
										value={searchQuery}
										onChange={(e) => setSearchQuery(e.target.value)}
									/>
								</div>
							</div>
						</div>
					</CardHeader>
					<CardContent>
						{isLoadingCategories ? (
							<div className="flex items-center justify-center py-12">
								<Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
							</div>
						) : (
							<ScrollArea className="h-[500px]">
								<Table>
									<TableHeader>
										<TableRow>
											<TableHead className="w-12">#</TableHead>
											<TableHead>Icon</TableHead>
											<TableHead>Name</TableHead>
											<TableHead>Slug</TableHead>
											<TableHead>Description</TableHead>
											<TableHead className="text-center">Active</TableHead>
										</TableRow>
									</TableHeader>
									<TableBody>
										{filteredSubcategories.map((sub, index) => (
											<TableRow key={sub.id}>
												<TableCell className="font-medium">
													{sub.displayOrder}
												</TableCell>
												<TableCell>{getIcon(sub.icon)}</TableCell>
												<TableCell className="font-medium">
													{sub.name}
												</TableCell>
												<TableCell>
													<Badge variant="outline">{sub.slug}</Badge>
												</TableCell>
												<TableCell className="max-w-xs truncate text-muted-foreground">
													{sub.description || "—"}
												</TableCell>
												<TableCell className="text-center">
													<Switch
														checked={sub.isActive}
														onCheckedChange={(checked) =>
															toggleSubcategoryMutation.mutate({
																id: sub.id,
																isActive: checked,
															})
														}
													/>
												</TableCell>
											</TableRow>
										))}
										{filteredSubcategories.length === 0 && (
											<TableRow>
												<TableCell
													colSpan={6}
													className="text-center py-8 text-muted-foreground"
												>
													{searchQuery
														? "No subcategories match your search"
														: "No loan subcategories found"}
												</TableCell>
											</TableRow>
										)}
									</TableBody>
								</Table>
							</ScrollArea>
						)}
					</CardContent>
				</Card>

				<Card>
					<CardHeader>
						<CardTitle>Loan Types Overview</CardTitle>
						<CardDescription>
							Quick reference for available loan categories
						</CardDescription>
					</CardHeader>
					<CardContent>
						<div className="grid grid-cols-2 md:grid-cols-4 gap-4">
							{subcategories.map((sub) => (
								<div
									key={sub.id}
									className={`p-4 rounded-lg border ${sub.isActive ? "bg-card" : "bg-muted/50 opacity-60"}`}
								>
									<div className="flex items-center gap-2 mb-2">
										{getIcon(sub.icon)}
										<span className="font-medium text-sm">{sub.name}</span>
									</div>
									<p className="text-xs text-muted-foreground line-clamp-2">
										{sub.description || "No description"}
									</p>
									{!sub.isActive && (
										<Badge variant="secondary" className="mt-2 text-xs">
											Inactive
										</Badge>
									)}
								</div>
							))}
						</div>
					</CardContent>
				</Card>
			</div>
		</div>
	);
}
