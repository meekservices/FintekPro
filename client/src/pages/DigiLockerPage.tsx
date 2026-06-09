import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollableTabsList } from "@/components/ScrollableTabsList";
import { Separator } from "@/components/ui/separator";
import { Progress } from "@/components/ui/progress";
import {
	FileText,
	Download,
	RefreshCw,
	Shield as LucideShield,
	Clock,
	CheckCircle,
	AlertCircle,
	ExternalLink,
	UserCheck,
	CreditCard,
	Home,
	GraduationCap,
	Car,
	Building,
	Smartphone,
	FileImage,
	Loader2,
} from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";

interface DigiLockerDocument {
	id: string;
	documentUri: string;
	documentType: string;
	source?: string;
	filename?: string;
	contentType?: string;
	sharedTill?: string;
	sharingStatus: "shared" | "fetched" | "fetch_failed" | "expired";
	documentContent?: string;
	sharedAt: string;
	fetchedAt?: string;
}

interface KYCData {
	name?: string;
	dateOfBirth?: string;
	aadhaarNumber?: string;
	panNumber?: string;
	address?: {
		line1?: string;
		line2?: string;
		city?: string;
		state?: string;
		pincode?: string;
	};
	drivingLicense?: string;
	voterId?: string;
	passportNumber?: string;
	education?: Array<{
		degree?: string;
		institution?: string;
		year?: string;
	}>;
}

const DOCUMENT_ICONS: Record<string, any> = {
	aadhaar: UserCheck,
	pan: CreditCard,
	driving_license: Car,
	voter_id: Building,
	passport: FileText,
	education: GraduationCap,
	address_proof: Home,
	income_certificate: FileText,
	default: FileText,
};

const DOCUMENT_NAMES: Record<string, string> = {
	aadhaar: "Aadhaar Card",
	pan: "PAN Card",
	driving_license: "Driving License",
	voter_id: "Voter ID",
	passport: "Passport",
	education: "Education Certificate",
	address_proof: "Address Proof",
	income_certificate: "Income Certificate",
};

export default function DigiLockerPage() {
	const [isInitiatingShare, setIsInitiatingShare] = useState(false);
	const { toast } = useToast();
	const queryClient = useQueryClient();

	// Fetch user's DigiLocker documents
	const {
		data: documents = [],
		isLoading: isLoadingDocuments,
		refetch: refetchDocuments,
	} = useQuery<DigiLockerDocument[]>({
		queryKey: ["/api/digilocker/documents"],
	});

	// Auto-populate KYC mutation
	const autoPopulateKYC = useMutation({
		mutationFn: async (): Promise<{ kycData: KYCData }> => {
			const res = await fetch("/api/digilocker/auto-populate-kyc", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
			});
			if (!res.ok) throw new Error("Failed to auto-populate KYC");
			return res.json();
		},
		onSuccess: (data) => {
			toast({
				title: "KYC Data Auto-populated",
				description:
					"Your profile has been updated with data from DigiLocker documents.",
			});
		},
		onError: (error) => {
			toast({
				title: "Auto-populate Failed",
				description: error.message,
				variant: "destructive",
			});
		},
	});

	// Fetch document content mutation
	const fetchDocumentContent = useMutation({
		mutationFn: async (documentId: string) => {
			const res = await fetch(`/api/digilocker/documents/${documentId}/fetch`, {
				method: "POST",
			});
			if (!res.ok) throw new Error("Failed to fetch document content");
			return res.json();
		},
		onSuccess: () => {
			queryClient.invalidateQueries({
				queryKey: ["/api/digilocker/documents"],
			});
			toast({
				title: "Document Updated",
				description: "Document content has been refreshed.",
			});
		},
		onError: (error) => {
			toast({
				title: "Fetch Failed",
				description: error.message,
				variant: "destructive",
			});
		},
	});

	const initiateDocumentSharing = async () => {
		setIsInitiatingShare(true);

		try {
			const res = await fetch("/api/digilocker/initiate-sharing", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ docTypes: ["aadhaar", "pan"], flow: "signin" }),
			});

			if (!res.ok) {
				const error = await res.json();
				throw new Error(error.message || "Failed to initiate document sharing");
			}

			const result = await res.json();

			if (result.authorizationUrl || result.widgetUrl) {
				window.open(
					result.authorizationUrl || result.widgetUrl,
					"_blank",
					"width=800,height=600",
				);
				toast({
					title: "DigiLocker Opened",
					description:
						"Please complete authentication in the DigiLocker window to share your documents.",
				});
			}

			refetchDocuments();
		} catch (error: any) {
			toast({
				title: "Sharing Failed",
				description:
					error.message || "Failed to share documents from DigiLocker.",
				variant: "destructive",
			});
		} finally {
			setIsInitiatingShare(false);
		}
	};

	const getDocumentIcon = (documentType: string) => {
		const IconComponent =
			DOCUMENT_ICONS[documentType] || DOCUMENT_ICONS.default;
		return <IconComponent className="h-5 w-5" />;
	};

	const getDocumentName = (documentType: string) => {
		return (
			DOCUMENT_NAMES[documentType] ||
			documentType.replace(/_/g, " ").toUpperCase()
		);
	};

	const getStatusColor = (status: string) => {
		switch (status) {
			case "fetched":
				return "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200";
			case "shared":
				return "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200";
			case "fetch_failed":
				return "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200";
			case "expired":
				return "bg-muted text-foreground";
			default:
				return "bg-muted text-foreground";
		}
	};

	const getStatusIcon = (status: string) => {
		switch (status) {
			case "fetched":
				return <CheckCircle className="h-4 w-4" />;
			case "shared":
				return <Clock className="h-4 w-4" />;
			case "fetch_failed":
				return <AlertCircle className="h-4 w-4" />;
			case "expired":
				return <Clock className="h-4 w-4" />;
			default:
				return <FileText className="h-4 w-4" />;
		}
	};

	const formatDate = (dateString: string) => {
		return new Date(dateString).toLocaleDateString("en-IN", {
			year: "numeric",
			month: "short",
			day: "numeric",
			hour: "2-digit",
			minute: "2-digit",
		});
	};

	const completedDocuments = documents.filter(
		(doc) => doc.sharingStatus === "fetched",
	).length;
	const totalDocuments = documents.length;
	const completionPercentage =
		totalDocuments > 0 ? (completedDocuments / totalDocuments) * 100 : 0;

	return (
		<div
			className="container mx-auto p-6 max-w-6xl"
			data-testid="digilocker-page"
		>
			<div className="mb-8">
				<h1 className="text-3xl font-bold mb-2" data-testid="page-title">
					DigiLocker Integration
				</h1>
				<p className="text-muted-foreground" data-testid="page-description">
					Access and manage your digital documents from India's official
					DigiLocker platform
				</p>
			</div>

			{/* Overview Cards */}
			<div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
				<Card>
					<CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
						<CardTitle className="text-sm font-medium">
							Total Documents
						</CardTitle>
						<FileText className="h-4 w-4 text-muted-foreground" />
					</CardHeader>
					<CardContent>
						<div className="text-2xl font-bold" data-testid="total-documents">
							{totalDocuments}
						</div>
						<p className="text-xs text-muted-foreground">
							Available in DigiLocker
						</p>
					</CardContent>
				</Card>

				<Card>
					<CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
						<CardTitle className="text-sm font-medium">
							Verified Documents
						</CardTitle>
						<CheckCircle className="h-4 w-4 text-muted-foreground" />
					</CardHeader>
					<CardContent>
						<div
							className="text-2xl font-bold"
							data-testid="verified-documents"
						>
							{completedDocuments}
						</div>
						<p className="text-xs text-muted-foreground">
							Successfully fetched
						</p>
					</CardContent>
				</Card>

				<Card>
					<CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
						<CardTitle className="text-sm font-medium">Completion</CardTitle>
						<LucideShield className="h-4 w-4 text-muted-foreground" />
					</CardHeader>
					<CardContent>
						<div
							className="text-2xl font-bold"
							data-testid="completion-percentage"
						>
							{Math.round(completionPercentage)}%
						</div>
						<Progress value={completionPercentage} className="mt-2" />
					</CardContent>
				</Card>
			</div>

			<Tabs defaultValue="documents" className="space-y-6">
				<ScrollableTabsList>
					<TabsTrigger
						value="documents"
						data-testid="tab-documents"
						className="flex-shrink-0"
					>
						Documents
					</TabsTrigger>
					<TabsTrigger
						value="share"
						data-testid="tab-share"
						className="flex-shrink-0"
					>
						Share Documents
					</TabsTrigger>
					<TabsTrigger
						value="kyc"
						data-testid="tab-kyc"
						className="flex-shrink-0"
					>
						Auto-fill KYC
					</TabsTrigger>
				</ScrollableTabsList>

				<TabsContent value="documents" className="space-y-4">
					<Card>
						<CardHeader>
							<CardTitle className="flex items-center gap-2">
								<FileText className="h-5 w-5" />
								My DigiLocker Documents
							</CardTitle>
							<CardDescription>
								Documents shared from your DigiLocker account
							</CardDescription>
						</CardHeader>
						<CardContent>
							{isLoadingDocuments ? (
								<div className="flex items-center justify-center py-8">
									<Loader2 className="h-6 w-6 animate-spin mr-2" />
									Loading documents...
								</div>
							) : documents.length === 0 ? (
								<div className="text-center py-8">
									<FileText className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
									<p className="text-muted-foreground mb-4">
										No documents found
									</p>
									<p className="text-sm text-muted-foreground">
										Share documents from DigiLocker to get started
									</p>
								</div>
							) : (
								<div className="space-y-4">
									{documents.map((doc) => (
										<div
											key={doc.id}
											className="flex items-center justify-between p-4 border rounded-lg"
											data-testid={`document-${doc.documentType}`}
										>
											<div className="flex items-center gap-4">
												{getDocumentIcon(doc.documentType)}
												<div>
													<h4 className="font-medium">
														{getDocumentName(doc.documentType)}
													</h4>
													<p className="text-sm text-muted-foreground">
														Shared: {formatDate(doc.sharedAt)}
														{doc.sharedTill && ` • Expires: ${doc.sharedTill}`}
													</p>
													{doc.source && (
														<p className="text-xs text-muted-foreground">
															Source: {doc.source}
														</p>
													)}
												</div>
											</div>

											<div className="flex items-center gap-2">
												<Badge
													variant="outline"
													className={getStatusColor(doc.sharingStatus)}
												>
													{getStatusIcon(doc.sharingStatus)}
													<span className="ml-1">
														{doc.sharingStatus.replace(/_/g, " ").toUpperCase()}
													</span>
												</Badge>

												{doc.sharingStatus === "shared" && (
													<Button
														size="sm"
														variant="outline"
														onClick={() => fetchDocumentContent.mutate(doc.id)}
														disabled={fetchDocumentContent.isPending}
														data-testid={`fetch-${doc.documentType}`}
													>
														{fetchDocumentContent.isPending ? (
															<Loader2 className="h-4 w-4 animate-spin" />
														) : (
															<Download className="h-4 w-4" />
														)}
													</Button>
												)}

												{doc.sharingStatus === "fetched" && (
													<Button
														size="sm"
														variant="outline"
														onClick={() => fetchDocumentContent.mutate(doc.id)}
														disabled={fetchDocumentContent.isPending}
														data-testid={`refresh-${doc.documentType}`}
													>
														<RefreshCw className="h-4 w-4" />
													</Button>
												)}
											</div>
										</div>
									))}
								</div>
							)}
						</CardContent>
					</Card>
				</TabsContent>

				<TabsContent value="share" className="space-y-4">
					<Card>
						<CardHeader>
							<CardTitle className="flex items-center gap-2">
								<ExternalLink className="h-5 w-5" />
								Share Documents from DigiLocker
							</CardTitle>
							<CardDescription>
								Securely share your government documents for KYC verification
							</CardDescription>
						</CardHeader>
						<CardContent className="space-y-6">
							<Alert>
								<LucideShield className="h-4 w-4" />
								<AlertDescription>
									Your documents are fetched securely from the official
									DigiLocker platform. We only access documents you explicitly
									choose to share.
								</AlertDescription>
							</Alert>

							<div className="space-y-4">
								<h4 className="font-medium">Recommended Documents for KYC:</h4>
								<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
									{[
										{
											type: "aadhaar",
											name: "Aadhaar Card",
											icon: UserCheck,
											required: true,
										},
										{
											type: "pan",
											name: "PAN Card",
											icon: CreditCard,
											required: true,
										},
										{
											type: "driving_license",
											name: "Driving License",
											icon: Car,
											required: false,
										},
										{
											type: "passport",
											name: "Passport",
											icon: FileText,
											required: false,
										},
										{
											type: "voter_id",
											name: "Voter ID",
											icon: Building,
											required: false,
										},
										{
											type: "education",
											name: "Education Certificate",
											icon: GraduationCap,
											required: false,
										},
									].map((docType) => (
										<div
											key={docType.type}
											className="flex items-center gap-3 p-3 border rounded-lg"
										>
											<docType.icon className="h-5 w-5 text-muted-foreground" />
											<div className="flex-1">
												<p className="font-medium">{docType.name}</p>
												<p className="text-sm text-muted-foreground">
													{docType.required ? "Required for KYC" : "Optional"}
												</p>
											</div>
											{docType.required && (
												<Badge variant="secondary">Required</Badge>
											)}
										</div>
									))}
								</div>
							</div>

							<Separator />

							<div className="flex flex-col gap-4">
								<Button
									onClick={initiateDocumentSharing}
									disabled={isInitiatingShare}
									className="w-full"
									size="lg"
									data-testid="share-documents-btn"
								>
									{isInitiatingShare ? (
										<>
											<Loader2 className="h-5 w-5 animate-spin mr-2" />
											Connecting to DigiLocker...
										</>
									) : (
										<>
											<ExternalLink className="h-5 w-5 mr-2" />
											Share Documents from DigiLocker
										</>
									)}
								</Button>

								<p className="text-sm text-muted-foreground text-center">
									You'll be redirected to the official DigiLocker platform to
									select and share your documents
								</p>
							</div>
						</CardContent>
					</Card>
				</TabsContent>

				<TabsContent value="kyc" className="space-y-4">
					<Card>
						<CardHeader>
							<CardTitle className="flex items-center gap-2">
								<UserCheck className="h-5 w-5" />
								Auto-fill KYC Information
							</CardTitle>
							<CardDescription>
								Automatically populate your profile with verified document data
							</CardDescription>
						</CardHeader>
						<CardContent className="space-y-6">
							<Alert>
								<CheckCircle className="h-4 w-4" />
								<AlertDescription>
									We'll extract relevant information from your DigiLocker
									documents to automatically fill your KYC profile with verified
									data.
								</AlertDescription>
							</Alert>

							{completedDocuments === 0 ? (
								<div className="text-center py-8">
									<FileText className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
									<p className="text-muted-foreground mb-2">
										No documents available
									</p>
									<p className="text-sm text-muted-foreground">
										Share documents from DigiLocker first to enable auto-fill
									</p>
								</div>
							) : (
								<div className="space-y-4">
									<div className="p-4 bg-muted rounded-lg">
										<h4 className="font-medium mb-2">
											Available Data Sources:
										</h4>
										<div className="space-y-2">
											{documents
												.filter((doc) => doc.sharingStatus === "fetched")
												.map((doc) => (
													<div key={doc.id} className="flex items-center gap-2">
														{getDocumentIcon(doc.documentType)}
														<span className="text-sm">
															{getDocumentName(doc.documentType)}
														</span>
														<Badge variant="secondary" className="ml-auto">
															<CheckCircle className="h-3 w-3 mr-1" />
															Verified
														</Badge>
													</div>
												))}
										</div>
									</div>

									<Button
										onClick={() => autoPopulateKYC.mutate()}
										disabled={autoPopulateKYC.isPending}
										className="w-full"
										size="lg"
										data-testid="auto-populate-kyc-btn"
									>
										{autoPopulateKYC.isPending ? (
											<>
												<Loader2 className="h-5 w-5 animate-spin mr-2" />
												Processing Documents...
											</>
										) : (
											<>
												<UserCheck className="h-5 w-5 mr-2" />
												Auto-fill KYC Profile
											</>
										)}
									</Button>

									<p className="text-sm text-muted-foreground text-center">
										This will update your profile with verified information from
										your DigiLocker documents
									</p>
								</div>
							)}
						</CardContent>
					</Card>
				</TabsContent>
			</Tabs>
		</div>
	);
}
