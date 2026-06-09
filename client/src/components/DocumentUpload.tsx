import { useState, useCallback } from "react";
import { useDropzone } from "react-dropzone";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import {
	Upload,
	FileText,
	CheckCircle2,
	XCircle,
	AlertCircle,
	Loader2,
	Eye,
	Download,
	Trash2,
} from "lucide-react";

interface Document {
	id: string;
	fileName: string;
	fileType: string;
	uploadedAt: string;
	status: "pending" | "verified" | "rejected";
	verifiedBy?: string;
	verifiedAt?: string;
	rejectionReason?: string;
}

interface DocumentUploadProps {
	dealId: string;
	documentType: "dis_slip" | "transfer_confirmation" | "other";
	title: string;
	description?: string;
	maxFiles?: number;
	acceptedTypes?: string[];
	onUploadComplete?: (documentId: string) => void;
	existingDocuments?: Document[];
	readonly?: boolean;
}

const DOCUMENT_TYPE_LABELS: Record<string, string> = {
	dis_slip: "DIS Slip",
	transfer_confirmation: "Transfer Confirmation",
	other: "Supporting Document",
};

export function DocumentUpload({
	dealId,
	documentType,
	title,
	description,
	maxFiles = 3,
	acceptedTypes = ["application/pdf", "image/png", "image/jpeg"],
	onUploadComplete,
	existingDocuments = [],
	readonly = false,
}: DocumentUploadProps) {
	const { toast } = useToast();
	const queryClient = useQueryClient();
	const [uploadProgress, setUploadProgress] = useState<number>(0);
	const [isUploading, setIsUploading] = useState(false);

	const uploadMutation = useMutation({
		mutationFn: async (file: File) => {
			setIsUploading(true);
			setUploadProgress(0);

			const formData = new FormData();
			formData.append("file", file);
			formData.append("dealId", dealId);
			formData.append("documentType", documentType);

			const progressInterval = setInterval(() => {
				setUploadProgress((prev) => Math.min(prev + 10, 90));
			}, 200);

			try {
				const response = await fetch("/api/unlisted/documents/upload", {
					method: "POST",
					body: formData,
					credentials: "include",
				});

				clearInterval(progressInterval);
				setUploadProgress(100);

				if (!response.ok) {
					const error = await response.json();
					throw new Error(error.message || "Upload failed");
				}

				return response.json();
			} catch (error) {
				clearInterval(progressInterval);
				throw error;
			} finally {
				setIsUploading(false);
				setTimeout(() => setUploadProgress(0), 1000);
			}
		},
		onSuccess: (data) => {
			toast({
				title: "Document uploaded",
				description: `${DOCUMENT_TYPE_LABELS[documentType]} uploaded successfully. Pending verification.`,
			});
			queryClient.invalidateQueries({
				queryKey: ["/api/unlisted/deals", dealId, "documents"],
			});
			if (onUploadComplete && data?.data?.id) {
				onUploadComplete(data.data.id);
			}
		},
		onError: (error: Error) => {
			toast({
				title: "Upload failed",
				description:
					error.message || "Failed to upload document. Please try again.",
				variant: "destructive",
			});
		},
	});

	const onDrop = useCallback(
		(acceptedFiles: File[]) => {
			if (existingDocuments.length >= maxFiles) {
				toast({
					title: "Maximum files reached",
					description: `You can only upload ${maxFiles} documents of this type.`,
					variant: "destructive",
				});
				return;
			}

			const file = acceptedFiles[0];
			if (file) {
				if (file.size > 10 * 1024 * 1024) {
					toast({
						title: "File too large",
						description: "Maximum file size is 10MB.",
						variant: "destructive",
					});
					return;
				}
				uploadMutation.mutate(file);
			}
		},
		[existingDocuments.length, maxFiles, toast, uploadMutation],
	);

	const { getRootProps, getInputProps, isDragActive } = useDropzone({
		onDrop,
		accept: acceptedTypes.reduce((acc, type) => ({ ...acc, [type]: [] }), {}),
		maxFiles: 1,
		disabled: isUploading || readonly || existingDocuments.length >= maxFiles,
	});

	const getStatusBadge = (status: string) => {
		const configs: Record<
			string,
			{
				variant: "default" | "secondary" | "destructive" | "outline";
				icon: any;
				label: string;
			}
		> = {
			pending: {
				variant: "secondary",
				icon: AlertCircle,
				label: "Pending Verification",
			},
			verified: { variant: "default", icon: CheckCircle2, label: "Verified" },
			rejected: { variant: "destructive", icon: XCircle, label: "Rejected" },
		};
		const config = configs[status] || configs.pending;
		const Icon = config.icon;
		return (
			<Badge variant={config.variant}>
				<Icon className="w-3 h-3 mr-1" />
				{config.label}
			</Badge>
		);
	};

	return (
		<Card data-testid={`document-upload-${documentType}`}>
			<CardHeader>
				<CardTitle className="text-lg flex items-center gap-2">
					<FileText className="w-5 h-5" />
					{title}
				</CardTitle>
				{description && <CardDescription>{description}</CardDescription>}
			</CardHeader>
			<CardContent className="space-y-4">
				{!readonly && existingDocuments.length < maxFiles && (
					<div
						{...getRootProps()}
						className={`border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors ${
							isDragActive
								? "border-primary bg-primary/5"
								: "border-border hover:border-primary/50"
						} ${isUploading ? "opacity-50 cursor-not-allowed" : ""}`}
						data-testid="dropzone"
					>
						<input {...getInputProps()} data-testid="file-input" />
						{isUploading ? (
							<div className="space-y-2">
								<Loader2 className="w-8 h-8 mx-auto animate-spin text-primary" />
								<p className="text-sm text-muted-foreground">Uploading...</p>
								<Progress
									value={uploadProgress}
									className="w-full max-w-xs mx-auto"
								/>
							</div>
						) : (
							<>
								<Upload className="w-8 h-8 mx-auto text-muted-foreground mb-2" />
								<p className="text-sm font-medium">
									{isDragActive
										? "Drop file here"
										: "Drag & drop or click to upload"}
								</p>
								<p className="text-xs text-muted-foreground mt-1">
									PDF, PNG, or JPEG up to 10MB
								</p>
							</>
						)}
					</div>
				)}

				{existingDocuments.length > 0 && (
					<div className="space-y-2">
						<h4 className="text-sm font-medium">Uploaded Documents</h4>
						{existingDocuments.map((doc) => (
							<div
								key={doc.id}
								className="flex items-center justify-between p-3 bg-muted rounded-lg"
								data-testid={`document-${doc.id}`}
							>
								<div className="flex items-center gap-3">
									<FileText className="w-5 h-5 text-blue-500" />
									<div>
										<p className="text-sm font-medium">{doc.fileName}</p>
										<p className="text-xs text-muted-foreground">
											Uploaded {new Date(doc.uploadedAt).toLocaleDateString()}
										</p>
									</div>
								</div>
								<div className="flex items-center gap-2">
									{getStatusBadge(doc.status)}
									<Button
										variant="ghost"
										size="sm"
										data-testid={`view-doc-${doc.id}`}
									>
										<Eye className="w-4 h-4" />
									</Button>
								</div>
							</div>
						))}
					</div>
				)}

				{existingDocuments.some((d) => d.status === "rejected") && (
					<div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
						<p className="text-sm text-red-700 dark:text-red-400">
							One or more documents were rejected. Please upload a new document.
						</p>
					</div>
				)}
			</CardContent>
		</Card>
	);
}

export default DocumentUpload;
