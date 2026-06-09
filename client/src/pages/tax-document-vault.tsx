import { useState } from "react";
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
import { Skeleton } from "@/components/ui/skeleton";
import {
	FileText,
	Download,
	Eye,
	Upload,
	Folder,
	Search,
	Filter,
	Calendar,
	CheckCircle,
	Clock,
	FileCheck,
	Receipt,
	File,
	FolderOpen,
	Shield as LucideShield,
	Lock,
	Inbox,
} from "lucide-react";

interface TaxDocument {
	id: string;
	name: string;
	type:
		| "itr"
		| "computation"
		| "form26as"
		| "ais"
		| "tis"
		| "form15"
		| "acknowledgement"
		| "other";
	assessmentYear: string;
	uploadDate: string;
	size: string;
	status: "verified" | "pending" | "expired";
	pan: string;
}

const DOCUMENT_CATEGORIES = [
	{
		type: "itr",
		name: "ITR Returns",
		icon: FileText,
		color: "text-blue-600 bg-blue-100 dark:bg-blue-900/30",
	},
	{
		type: "computation",
		name: "Computations",
		icon: Receipt,
		color: "text-green-600 bg-green-100 dark:bg-green-900/30",
	},
	{
		type: "form26as",
		name: "Form 26AS",
		icon: FileCheck,
		color: "text-purple-600 bg-purple-100 dark:bg-purple-900/30",
	},
	{
		type: "ais",
		name: "AIS",
		icon: File,
		color: "text-orange-600 bg-orange-100 dark:bg-orange-900/30",
	},
	{
		type: "tis",
		name: "TIS",
		icon: File,
		color: "text-yellow-600 bg-yellow-100 dark:bg-yellow-900/30",
	},
	{
		type: "form15",
		name: "Form 15CA/CB",
		icon: LucideShield,
		color: "text-red-600 bg-red-100 dark:bg-red-900/30",
	},
	{
		type: "acknowledgement",
		name: "Acknowledgements",
		icon: CheckCircle,
		color: "text-emerald-600 bg-emerald-100 dark:bg-emerald-900/30",
	},
];

export default function TaxDocumentVaultPage() {
	const [searchTerm, setSearchTerm] = useState("");
	const [selectedYear, setSelectedYear] = useState("all");
	const [selectedType, setSelectedType] = useState("all");

	// Fetch real tax documents from API
	const { data: documentsData, isLoading } = useQuery<{
		documents: TaxDocument[];
	}>({
		queryKey: ["/api/tax/documents"],
	});

	const documents = documentsData?.documents || [];

	const getDocumentIcon = (type: string) => {
		const category = DOCUMENT_CATEGORIES.find((c) => c.type === type);
		if (category) {
			const Icon = category.icon;
			return <Icon className={`h-5 w-5 ${category.color.split(" ")[0]}`} />;
		}
		return <FileText className="h-5 w-5 text-muted-foreground" />;
	};

	const getStatusBadge = (status: string) => {
		switch (status) {
			case "verified":
				return (
					<Badge className="bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300">
						<CheckCircle className="h-3 w-3 mr-1" /> Verified
					</Badge>
				);
			case "pending":
				return (
					<Badge className="bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300">
						<Clock className="h-3 w-3 mr-1" /> Pending
					</Badge>
				);
			case "expired":
				return (
					<Badge className="bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300">
						Expired
					</Badge>
				);
			default:
				return null;
		}
	};

	const filteredDocuments = documents.filter((doc) => {
		const matchesSearch = doc.name
			.toLowerCase()
			.includes(searchTerm.toLowerCase());
		const matchesYear =
			selectedYear === "all" || doc.assessmentYear === selectedYear;
		const matchesType = selectedType === "all" || doc.type === selectedType;
		return matchesSearch && matchesYear && matchesType;
	});

	const years = Array.from(new Set(documents.map((d) => d.assessmentYear)))
		.sort()
		.reverse();
	const documentsByYear: Record<string, TaxDocument[]> = years.reduce(
		(acc, year) => {
			acc[year] = filteredDocuments.filter((d) => d.assessmentYear === year);
			return acc;
		},
		{} as Record<string, TaxDocument[]>,
	);

	if (isLoading) {
		return (
			<div className="container mx-auto p-6 space-y-6">
				<Skeleton className="h-10 w-64" />
				<Skeleton className="h-16 w-full" />
				<div className="grid grid-cols-2 md:grid-cols-4 gap-4">
					{[1, 2, 3, 4].map((i) => (
						<Skeleton key={i} className="h-24 w-full" />
					))}
				</div>
				<Skeleton className="h-64 w-full" />
			</div>
		);
	}

	return (
		<div className="container mx-auto p-6 space-y-6">
			{/* Page Header */}
			<div className="flex items-center justify-between">
				<div>
					<h1 className="text-3xl font-bold flex items-center gap-3">
						<Folder className="h-8 w-8 text-blue-500" />
						Tax Document Vault
					</h1>
					<p className="text-muted-foreground">
						Securely store and access all your tax documents
					</p>
				</div>
				<Button className="gap-2" data-testid="button-upload-document">
					<Upload className="h-4 w-4" /> Upload Document
				</Button>
			</div>

			{/* Security Banner */}
			<Card className="bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-950 dark:to-emerald-950 border-green-200">
				<CardContent className="py-4">
					<div className="flex items-center gap-4">
						<div className="p-3 bg-green-100 dark:bg-green-900 rounded-full">
							<Lock className="h-6 w-6 text-green-600" />
						</div>
						<div>
							<p className="font-medium text-green-800 dark:text-green-200">
								Bank-Grade Security
							</p>
							<p className="text-sm text-green-700 dark:text-green-300">
								All documents are encrypted and stored securely. 8-year
								retention as per compliance requirements.
							</p>
						</div>
					</div>
				</CardContent>
			</Card>

			{/* Quick Stats */}
			<div className="grid grid-cols-2 md:grid-cols-4 gap-4">
				{DOCUMENT_CATEGORIES.slice(0, 4).map((category) => {
					const count = documents.filter(
						(d) => d.type === category.type,
					).length;
					const Icon = category.icon;
					return (
						<Card
							key={category.type}
							className="cursor-pointer hover:shadow-md transition-shadow"
							onClick={() => setSelectedType(category.type)}
							data-testid={`category-${category.type}`}
						>
							<CardContent className="pt-6">
								<div className="flex items-center justify-between">
									<div>
										<p className="text-sm text-muted-foreground">
											{category.name}
										</p>
										<p className="text-2xl font-bold">{count}</p>
									</div>
									<div
										className={`p-3 rounded-lg ${category.color.split(" ")[1]}`}
									>
										<Icon
											className={`h-6 w-6 ${category.color.split(" ")[0]}`}
										/>
									</div>
								</div>
							</CardContent>
						</Card>
					);
				})}
			</div>

			{/* Filters */}
			<Card>
				<CardContent className="py-4">
					<div className="flex items-center gap-4">
						<div className="relative flex-1">
							<Search className="h-4 w-4 absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground" />
							<Input
								placeholder="Search documents..."
								value={searchTerm}
								onChange={(e) => setSearchTerm(e.target.value)}
								className="pl-9"
								data-testid="input-search-documents"
							/>
						</div>
						<Select value={selectedYear} onValueChange={setSelectedYear}>
							<SelectTrigger className="w-40" data-testid="select-year">
								<SelectValue placeholder="Select Year" />
							</SelectTrigger>
							<SelectContent>
								<SelectItem value="all">All Years</SelectItem>
								{years.map((year) => (
									<SelectItem key={year} value={year}>
										AY {year}
									</SelectItem>
								))}
							</SelectContent>
						</Select>
						<Select value={selectedType} onValueChange={setSelectedType}>
							<SelectTrigger className="w-48" data-testid="select-type">
								<SelectValue placeholder="Document Type" />
							</SelectTrigger>
							<SelectContent>
								<SelectItem value="all">All Types</SelectItem>
								{DOCUMENT_CATEGORIES.map((cat) => (
									<SelectItem key={cat.type} value={cat.type}>
										{cat.name}
									</SelectItem>
								))}
							</SelectContent>
						</Select>
					</div>
				</CardContent>
			</Card>

			{/* Documents by Year */}
			<div className="space-y-6">
				{Object.entries(documentsByYear)
					.filter(([_, docs]) => docs.length > 0)
					.map(([year, docs]) => (
						<Card key={year} data-testid={`year-section-${year}`}>
							<CardHeader>
								<CardTitle className="flex items-center gap-2">
									<FolderOpen className="h-5 w-5 text-blue-500" />
									Assessment Year {year}
								</CardTitle>
								<CardDescription>{docs.length} document(s)</CardDescription>
							</CardHeader>
							<CardContent>
								<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
									{docs.map((doc) => (
										<div
											key={doc.id}
											className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted transition-colors"
											data-testid={`document-${doc.id}`}
										>
											<div className="flex items-center gap-3">
												<div
													className={`p-2 rounded-lg ${DOCUMENT_CATEGORIES.find((c) => c.type === doc.type)?.color.split(" ")[1] || "bg-muted"}`}
												>
													{getDocumentIcon(doc.type)}
												</div>
												<div>
													<p className="font-medium">{doc.name}</p>
													<div className="flex items-center gap-2 text-xs text-muted-foreground">
														<Calendar className="h-3 w-3" />
														<span>{doc.uploadDate}</span>
														<span>•</span>
														<span>{doc.size}</span>
													</div>
												</div>
											</div>
											<div className="flex items-center gap-2">
												{getStatusBadge(doc.status)}
												<Button
													size="icon"
													variant="ghost"
													data-testid={`button-view-${doc.id}`}
												>
													<Eye className="h-4 w-4" />
												</Button>
												<Button
													size="icon"
													variant="ghost"
													data-testid={`button-download-${doc.id}`}
												>
													<Download className="h-4 w-4" />
												</Button>
											</div>
										</div>
									))}
								</div>
							</CardContent>
						</Card>
					))}

				{filteredDocuments.length === 0 && (
					<Card className="py-12">
						<CardContent className="text-center">
							<Folder className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
							<h3 className="font-semibold text-lg">No documents found</h3>
							<p className="text-muted-foreground mb-4">
								Upload your first document to get started
							</p>
							<Button data-testid="button-upload-first">
								<Upload className="h-4 w-4 mr-2" /> Upload Document
							</Button>
						</CardContent>
					</Card>
				)}
			</div>
		</div>
	);
}
