import { useState, useCallback } from "react";
import {
	Card,
	CardContent,
	CardHeader,
	CardTitle,
	CardDescription,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Progress } from "@/components/ui/progress";
import {
	FileText,
	Shield as LucideShield,
	CheckCircle2,
	Loader2,
	ArrowRight,
	Lock,
	Smartphone,
	AlertCircle,
	RefreshCw,
	ExternalLink,
	Download,
	FileCheck,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface DigiLockerDocument {
	id: string;
	name: string;
	type:
		| "aadhaar"
		| "pan"
		| "driving_license"
		| "passport"
		| "voter_id"
		| "class10_marksheet"
		| "class12_marksheet"
		| "degree";
	issuer: string;
	available: boolean;
	fetched: boolean;
}

interface FetchedDocumentData {
	documentType: string;
	name?: string;
	dob?: string;
	address?: string;
	documentNumber?: string;
	fatherName?: string;
	issuedDate?: string;
}

interface DigiLockerPrefillProps {
	onDocumentsFetched: (documents: FetchedDocumentData[]) => void;
	requiredDocuments?: string[];
}

export function DigiLockerPrefill({
	onDocumentsFetched,
	requiredDocuments = ["aadhaar", "pan"],
}: DigiLockerPrefillProps) {
	const { toast } = useToast();
	const [isConnecting, setIsConnecting] = useState(false);
	const [isConnected, setIsConnected] = useState(false);
	const [isFetching, setIsFetching] = useState(false);
	const [fetchProgress, setFetchProgress] = useState(0);
	const [currentFetchingDoc, setCurrentFetchingDoc] = useState<string | null>(
		null,
	);
	const [error, setError] = useState<string | null>(null);

	const [availableDocuments, setAvailableDocuments] = useState<
		DigiLockerDocument[]
	>([
		{
			id: "1",
			name: "Aadhaar Card",
			type: "aadhaar",
			issuer: "UIDAI",
			available: false,
			fetched: false,
		},
		{
			id: "2",
			name: "PAN Card",
			type: "pan",
			issuer: "Income Tax Dept",
			available: false,
			fetched: false,
		},
		{
			id: "3",
			name: "Driving License",
			type: "driving_license",
			issuer: "Transport Dept",
			available: false,
			fetched: false,
		},
		{
			id: "4",
			name: "Passport",
			type: "passport",
			issuer: "MEA",
			available: false,
			fetched: false,
		},
		{
			id: "5",
			name: "Voter ID",
			type: "voter_id",
			issuer: "Election Commission",
			available: false,
			fetched: false,
		},
	]);

	const [fetchedData, setFetchedData] = useState<FetchedDocumentData[]>([]);

	const handleConnect = useCallback(async () => {
		setIsConnecting(true);
		setError(null);

		try {
			await new Promise((resolve) => setTimeout(resolve, 2000));

			setAvailableDocuments((prev) =>
				prev.map((doc) => ({
					...doc,
					available: ["aadhaar", "pan", "driving_license"].includes(doc.type),
				})),
			);

			setIsConnected(true);
			toast({
				title: "DigiLocker Connected",
				description: "Successfully connected to your DigiLocker account.",
			});
		} catch (err) {
			setError("Failed to connect to DigiLocker. Please try again.");
			toast({
				title: "Connection Failed",
				description: "Unable to connect to DigiLocker. Please try again.",
				variant: "destructive",
			});
		} finally {
			setIsConnecting(false);
		}
	}, [toast]);

	const handleFetchDocuments = useCallback(async () => {
		setIsFetching(true);
		setFetchProgress(0);
		setError(null);

		const docsToFetch = availableDocuments.filter(
			(d) => d.available && requiredDocuments.includes(d.type),
		);
		const fetchedDocs: FetchedDocumentData[] = [];

		for (let i = 0; i < docsToFetch.length; i++) {
			const doc = docsToFetch[i];
			setCurrentFetchingDoc(doc.name);

			await new Promise((resolve) => setTimeout(resolve, 1500));

			const mockData: FetchedDocumentData = {
				documentType: doc.type,
				name: "Sample User Name",
				dob: "1990-01-15",
				address: "123 Sample Address, City, State - 123456",
				documentNumber:
					doc.type === "aadhaar" ? "XXXX XXXX 1234" : "ABCDE1234F",
				fatherName: "Father Name",
				issuedDate: "2020-01-01",
			};

			fetchedDocs.push(mockData);

			setAvailableDocuments((prev) =>
				prev.map((d) => (d.id === doc.id ? { ...d, fetched: true } : d)),
			);

			setFetchProgress(((i + 1) / docsToFetch.length) * 100);
		}

		setFetchedData(fetchedDocs);
		setCurrentFetchingDoc(null);
		setIsFetching(false);

		onDocumentsFetched(fetchedDocs);

		toast({
			title: "Documents Retrieved",
			description: `Successfully fetched ${fetchedDocs.length} documents from DigiLocker.`,
		});
	}, [availableDocuments, requiredDocuments, onDocumentsFetched, toast]);

	const handleDisconnect = useCallback(() => {
		setIsConnected(false);
		setAvailableDocuments((prev) =>
			prev.map((d) => ({ ...d, available: false, fetched: false })),
		);
		setFetchedData([]);
		setFetchProgress(0);
	}, []);

	if (!isConnected) {
		return (
			<Card
				className="border-2 border-dashed border-blue-200 dark:border-blue-800"
				data-testid="digilocker-connect"
			>
				<CardContent className="pt-6">
					<div className="text-center space-y-4">
						<div className="w-16 h-16 bg-blue-100 dark:bg-blue-900 rounded-full flex items-center justify-center mx-auto">
							<FileText className="h-8 w-8 text-blue-600 dark:text-blue-400" />
						</div>

						<div>
							<h3 className="text-lg font-semibold mb-1">Connect DigiLocker</h3>
							<p className="text-sm text-muted-foreground">
								Auto-fill your KYC details securely from government-issued
								documents
							</p>
						</div>

						<div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
							<Lock className="h-4 w-4" />
							<span>Secured by DigiLocker & Aadhaar</span>
						</div>

						{error && (
							<Alert variant="destructive">
								<AlertCircle className="h-4 w-4" />
								<AlertDescription>{error}</AlertDescription>
							</Alert>
						)}

						<Button
							className="w-full max-w-xs"
							onClick={handleConnect}
							disabled={isConnecting}
							data-testid="connect-digilocker-btn"
						>
							{isConnecting ? (
								<>
									<Loader2 className="h-4 w-4 mr-2 animate-spin" />
									Connecting...
								</>
							) : (
								<>
									<Smartphone className="h-4 w-4 mr-2" />
									Connect via Aadhaar OTP
								</>
							)}
						</Button>

						<p className="text-xs text-muted-foreground">
							By connecting, you authorize fetching your documents from
							DigiLocker
						</p>
					</div>
				</CardContent>
			</Card>
		);
	}

	return (
		<Card data-testid="digilocker-connected">
			<CardHeader>
				<div className="flex items-center justify-between">
					<div className="flex items-center gap-3">
						<div className="p-2 bg-green-100 dark:bg-green-900 rounded-full">
							<LucideShield className="h-5 w-5 text-green-600 dark:text-green-400" />
						</div>
						<div>
							<CardTitle className="text-lg">DigiLocker Connected</CardTitle>
							<CardDescription>
								Select documents to auto-fill your KYC
							</CardDescription>
						</div>
					</div>
					<Button variant="ghost" size="sm" onClick={handleDisconnect}>
						Disconnect
					</Button>
				</div>
			</CardHeader>
			<CardContent className="space-y-4">
				<div className="space-y-2">
					{availableDocuments.map((doc) => (
						<div
							key={doc.id}
							className={`flex items-center justify-between p-3 rounded-lg border transition-colors ${
								doc.fetched
									? "bg-green-50 dark:bg-green-950 border-green-200 dark:border-green-800"
									: doc.available
										? "bg-background border-border"
										: "bg-background border-border opacity-50"
							}`}
						>
							<div className="flex items-center gap-3">
								<FileCheck
									className={`h-5 w-5 ${doc.fetched ? "text-green-600" : "text-muted-foreground"}`}
								/>
								<div>
									<p className="font-medium">{doc.name}</p>
									<p className="text-xs text-muted-foreground">{doc.issuer}</p>
								</div>
							</div>
							<div>
								{doc.fetched ? (
									<Badge className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">
										<CheckCircle2 className="h-3 w-3 mr-1" />
										Fetched
									</Badge>
								) : doc.available ? (
									<Badge variant="secondary">Available</Badge>
								) : (
									<Badge variant="outline">Not Found</Badge>
								)}
							</div>
						</div>
					))}
				</div>

				{isFetching && (
					<div className="space-y-2">
						<div className="flex items-center justify-between text-sm">
							<span className="text-muted-foreground">
								Fetching {currentFetchingDoc}...
							</span>
							<span className="font-medium">{Math.round(fetchProgress)}%</span>
						</div>
						<Progress value={fetchProgress} className="h-2" />
					</div>
				)}

				{fetchedData.length > 0 && (
					<Alert className="bg-green-50 dark:bg-green-950 border-green-200 dark:border-green-800">
						<CheckCircle2 className="h-4 w-4 text-green-600" />
						<AlertTitle className="text-green-800 dark:text-green-200">
							Documents Retrieved
						</AlertTitle>
						<AlertDescription className="text-green-700 dark:text-green-300">
							Your KYC form has been pre-filled with data from{" "}
							{fetchedData.length} documents.
						</AlertDescription>
					</Alert>
				)}

				{!isFetching && fetchedData.length === 0 && (
					<Button
						className="w-full"
						onClick={handleFetchDocuments}
						disabled={!availableDocuments.some((d) => d.available)}
						data-testid="fetch-documents-btn"
					>
						<Download className="h-4 w-4 mr-2" />
						Fetch & Auto-Fill Documents
					</Button>
				)}

				{fetchedData.length > 0 && (
					<div className="flex gap-2">
						<Button
							variant="outline"
							className="flex-1"
							onClick={() => {
								setFetchedData([]);
								setAvailableDocuments((prev) =>
									prev.map((d) => ({ ...d, fetched: false })),
								);
								setFetchProgress(0);
							}}
							data-testid="refetch-documents-btn"
						>
							<RefreshCw className="h-4 w-4 mr-2" />
							Refresh
						</Button>
						<Button
							className="flex-1"
							onClick={() => onDocumentsFetched(fetchedData)}
							data-testid="apply-documents-btn"
						>
							Apply to Form
							<ArrowRight className="h-4 w-4 ml-2" />
						</Button>
					</div>
				)}
			</CardContent>
		</Card>
	);
}
