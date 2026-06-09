import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
	FileText,
	Clock,
	CheckCircle2,
	XCircle,
	Download,
	Eye,
	AlertCircle,
	FileSignature,
	Calendar,
} from "lucide-react";
import { format } from "date-fns";
import { ESignModal } from "@/components/esign/ESignModal";
import { useAuth } from "@/hooks/useAuth";

interface Document {
	id: string;
	documentNumber: string;
	documentName: string;
	documentType: string;
	workflowStatus: string;
	clientStatus: "pending" | "completed" | "declined" | "expired";
	documentUrl: string | null;
	signedDocumentUrl: string | null;
	deadline: string | null;
	createdAt: string;
	completedAt: string | null;
	createdByName: string;
	participantRole: string;
	canSign: boolean;
	hasSigned: boolean;
	signedAt: string | null;
	signatureMethod: string | null;
	preferredSignatureMethod: string | null;
	declineReason: string | null;
}

interface DocumentsResponse {
	documents: Document[];
	pendingCount: number;
	completedCount: number;
	totalCount: number;
}

function getStatusBadge(status: Document["clientStatus"]) {
	switch (status) {
		case "pending":
			return (
				<Badge
					variant="outline"
					className="text-amber-600 border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-950/30"
				>
					<Clock className="h-3 w-3 mr-1" />
					Pending Signature
				</Badge>
			);
		case "completed":
			return (
				<Badge
					variant="outline"
					className="text-green-600 border-green-300 dark:border-green-700 bg-green-50 dark:bg-green-950/30"
				>
					<CheckCircle2 className="h-3 w-3 mr-1" />
					Signed
				</Badge>
			);
		case "declined":
			return (
				<Badge
					variant="outline"
					className="text-red-600 border-red-300 dark:border-red-700 bg-red-50 dark:bg-red-950/30"
				>
					<XCircle className="h-3 w-3 mr-1" />
					Declined
				</Badge>
			);
		case "expired":
			return (
				<Badge
					variant="outline"
					className="text-muted-foreground border-border bg-muted"
				>
					<AlertCircle className="h-3 w-3 mr-1" />
					Expired
				</Badge>
			);
		default:
			return null;
	}
}

function getDocumentTypeLabel(type: string) {
	const types: Record<string, string> = {
		investment_agreement: "Investment Agreement",
		kyc_consent: "KYC Consent",
		itr_verification: "ITR Verification",
		form_15ca: "Form 15CA",
		form_15cb: "Form 15CB",
		mandate: "Mandate",
		other: "Document",
	};
	return types[type] || type;
}

function DocumentCard({
	document,
	onSign,
}: { document: Document; onSign: (doc: Document) => void }) {
	const isPending = document.clientStatus === "pending";
	const canDownload = document.signedDocumentUrl || document.documentUrl;

	return (
		<Card className="hover:shadow-md transition-shadow">
			<CardContent className="p-4">
				<div className="flex items-start justify-between gap-4">
					<div className="flex-1 min-w-0">
						<div className="flex items-center gap-2 mb-1">
							<FileText className="h-4 w-4 text-muted-foreground flex-shrink-0" />
							<h3 className="font-medium truncate">{document.documentName}</h3>
						</div>
						<div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground mb-2">
							<span>{getDocumentTypeLabel(document.documentType)}</span>
							<span className="text-xs">|</span>
							<span>#{document.documentNumber}</span>
						</div>
						<div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
							<span className="flex items-center gap-1">
								<Calendar className="h-3 w-3" />
								{format(new Date(document.createdAt), "MMM d, yyyy")}
							</span>
							<span>From: {document.createdByName}</span>
							{document.deadline && document.clientStatus === "pending" && (
								<span className="text-amber-600">
									Due: {format(new Date(document.deadline), "MMM d, yyyy")}
								</span>
							)}
							{document.signedAt && (
								<span className="text-green-600">
									Signed: {format(new Date(document.signedAt), "MMM d, yyyy")}
								</span>
							)}
						</div>
					</div>
					<div className="flex flex-col items-end gap-2">
						{getStatusBadge(document.clientStatus)}
						<div className="flex gap-2">
							{isPending && document.canSign && (
								<Button size="sm" onClick={() => onSign(document)}>
									<FileSignature className="h-4 w-4 mr-1" />
									Sign Now
								</Button>
							)}
							{canDownload && (
								<Button
									size="sm"
									variant="outline"
									onClick={() =>
										window.open(
											document.signedDocumentUrl || document.documentUrl || "",
											"_blank",
										)
									}
								>
									{document.clientStatus === "completed" ? (
										<>
											<Download className="h-4 w-4 mr-1" />
											Download
										</>
									) : (
										<>
											<Eye className="h-4 w-4 mr-1" />
											View
										</>
									)}
								</Button>
							)}
						</div>
					</div>
				</div>
				{document.declineReason && (
					<div className="mt-3 p-2 bg-red-50 dark:bg-red-950/30 rounded text-sm text-red-700 dark:text-red-300">
						<strong>Decline reason:</strong> {document.declineReason}
					</div>
				)}
			</CardContent>
		</Card>
	);
}

function DocumentSkeleton() {
	return (
		<Card>
			<CardContent className="p-4">
				<div className="flex items-start justify-between gap-4">
					<div className="flex-1">
						<Skeleton className="h-5 w-48 mb-2" />
						<Skeleton className="h-4 w-32 mb-2" />
						<Skeleton className="h-3 w-64" />
					</div>
					<div className="flex flex-col items-end gap-2">
						<Skeleton className="h-6 w-24" />
						<Skeleton className="h-8 w-20" />
					</div>
				</div>
			</CardContent>
		</Card>
	);
}

export default function DocumentsPage() {
	const { user } = useAuth();
	const [selectedDoc, setSelectedDoc] = useState<Document | null>(null);
	const [showESignModal, setShowESignModal] = useState(false);

	const { data, isLoading, refetch } = useQuery<DocumentsResponse>({
		queryKey: ["/api/client/my-documents"],
		enabled: !!user,
	});

	const pendingDocs =
		data?.documents.filter((d) => d.clientStatus === "pending") || [];
	const completedDocs =
		data?.documents.filter((d) => d.clientStatus === "completed") || [];
	const allDocs = data?.documents || [];

	const handleSign = (doc: Document) => {
		setSelectedDoc(doc);
		setShowESignModal(true);
	};

	const handleSignSuccess = () => {
		setShowESignModal(false);
		setSelectedDoc(null);
		refetch();
	};

	return (
		<div className="container max-w-4xl mx-auto py-6 space-y-6">
			<div>
				<h1 className="text-2xl font-bold">My Documents</h1>
				<p className="text-muted-foreground">
					View and sign documents requiring your attention
				</p>
			</div>

			<div className="grid grid-cols-3 gap-4">
				<Card>
					<CardContent className="p-4 text-center">
						<div className="text-2xl font-bold text-amber-600">
							{data?.pendingCount || 0}
						</div>
						<div className="text-sm text-muted-foreground">
							Pending Signature
						</div>
					</CardContent>
				</Card>
				<Card>
					<CardContent className="p-4 text-center">
						<div className="text-2xl font-bold text-green-600">
							{data?.completedCount || 0}
						</div>
						<div className="text-sm text-muted-foreground">Completed</div>
					</CardContent>
				</Card>
				<Card>
					<CardContent className="p-4 text-center">
						<div className="text-2xl font-bold">{data?.totalCount || 0}</div>
						<div className="text-sm text-muted-foreground">Total Documents</div>
					</CardContent>
				</Card>
			</div>

			<Tabs defaultValue="pending" className="w-full">
				<TabsList className="grid w-full grid-cols-3">
					<TabsTrigger value="pending" className="flex items-center gap-2">
						<Clock className="h-4 w-4" />
						Pending
						{pendingDocs.length > 0 && (
							<Badge variant="secondary" className="ml-1">
								{pendingDocs.length}
							</Badge>
						)}
					</TabsTrigger>
					<TabsTrigger value="completed" className="flex items-center gap-2">
						<CheckCircle2 className="h-4 w-4" />
						Completed
					</TabsTrigger>
					<TabsTrigger value="all" className="flex items-center gap-2">
						<FileText className="h-4 w-4" />
						All Documents
					</TabsTrigger>
				</TabsList>

				<TabsContent value="pending" className="mt-4 space-y-3">
					{isLoading ? (
						<>
							<DocumentSkeleton />
							<DocumentSkeleton />
						</>
					) : pendingDocs.length === 0 ? (
						<Card>
							<CardContent className="p-8 text-center">
								<CheckCircle2 className="h-12 w-12 text-green-500 mx-auto mb-3" />
								<h3 className="font-medium mb-1">All caught up!</h3>
								<p className="text-sm text-muted-foreground">
									No documents pending your signature
								</p>
							</CardContent>
						</Card>
					) : (
						pendingDocs.map((doc) => (
							<DocumentCard key={doc.id} document={doc} onSign={handleSign} />
						))
					)}
				</TabsContent>

				<TabsContent value="completed" className="mt-4 space-y-3">
					{isLoading ? (
						<>
							<DocumentSkeleton />
							<DocumentSkeleton />
						</>
					) : completedDocs.length === 0 ? (
						<Card>
							<CardContent className="p-8 text-center">
								<FileText className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
								<h3 className="font-medium mb-1">No completed documents</h3>
								<p className="text-sm text-muted-foreground">
									Documents you sign will appear here
								</p>
							</CardContent>
						</Card>
					) : (
						completedDocs.map((doc) => (
							<DocumentCard key={doc.id} document={doc} onSign={handleSign} />
						))
					)}
				</TabsContent>

				<TabsContent value="all" className="mt-4 space-y-3">
					{isLoading ? (
						<>
							<DocumentSkeleton />
							<DocumentSkeleton />
						</>
					) : allDocs.length === 0 ? (
						<Card>
							<CardContent className="p-8 text-center">
								<FileText className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
								<h3 className="font-medium mb-1">No documents yet</h3>
								<p className="text-sm text-muted-foreground">
									Documents sent to you will appear here
								</p>
							</CardContent>
						</Card>
					) : (
						allDocs.map((doc) => (
							<DocumentCard key={doc.id} document={doc} onSign={handleSign} />
						))
					)}
				</TabsContent>
			</Tabs>

			{selectedDoc && user && (
				<ESignModal
					open={showESignModal}
					onOpenChange={setShowESignModal}
					documentType={selectedDoc.documentType as any}
					documentName={selectedDoc.documentName}
					documentHash={selectedDoc.id}
					documentUrl={selectedDoc.documentUrl || undefined}
					aadhaarNumber={(user as any).aadhaarNumber || ""}
					fullName={(user as any).firstName || (user as any).name || ""}
					onSuccess={handleSignSuccess}
					onError={(error) => console.error("eSign error:", error)}
				/>
			)}
		</div>
	);
}
