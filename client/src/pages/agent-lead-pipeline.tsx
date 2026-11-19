import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
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
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
	DialogTrigger,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { AutoDialerModal } from "@/components/dialer/AutoDialerModal";
import {
	Plus,
	Search,
	Phone,
	PhoneCall,
	Upload,
	FileSpreadsheet,
	Download,
	Check,
	Mail,
	Calendar,
	User,
	IndianRupee,
	Target,
	TrendingUp,
	Clock,
	CheckCircle,
	CheckCircle2,
	XCircle,
	ArrowRight,
	MoreHorizontal,
	MessageSquare,
	Edit,
	Trash2,
	Filter,
	ChevronRight,
	Loader2,
	AlertCircle,
	Star,
	Zap,
	Crown,
	Sparkles,
	Share2,
	Copy,
	ExternalLink,
	ShieldCheck,
	FileText,
	UserCheck,
} from "lucide-react";

interface Lead {
	id: string;
	name: string;
	email: string;
	phone: string;
	stage:
		| "new"
		| "contacted"
		| "proposal_sent"
		| "negotiating"
		| "converted"
		| "lost";
	source: string;
	potentialValue: number;
	score: number;
	notes: string;
	lastContact?: string;
	nextFollowUp?: string;
	createdAt: string;
	tags: string[];
	tier?: "RETAIL" | "AFFLUENT" | "HNI" | "UHNI";
	isHni?: boolean;
	pan?: string;
	prospectClientId?: string;
	proposalsCount?: number;
	latestProposal?: {
		id: string;
		title: string;
		status: string;
		shareToken: string;
		viewCount: number;
		investmentAmount?: number;
		lastViewedAt?: string;
	} | null;
}

interface LeadStats {
	total: number;
	new: number;
	contacted: number;
	proposalSent: number;
	negotiating: number;
	converted: number;
	lost: number;
	conversionRate: number;
	avgDealValue: number;
	pipelineValue: number;
	hniCount?: number;
	activeProposalsCount?: number;
	proposalsViewedCount?: number;
}

const STAGE_CONFIG = {
	new: {
		label: "New Leads",
		color: "bg-blue-500",
		textColor: "text-blue-400",
		bgColor: "bg-blue-500/10",
		borderColor: "border-blue-500/30",
	},
	contacted: {
		label: "Contacted",
		color: "bg-amber-500",
		textColor: "text-amber-400",
		bgColor: "bg-amber-500/10",
		borderColor: "border-amber-500/30",
	},
	proposal_sent: {
		label: "Proposal Sent",
		color: "bg-purple-500",
		textColor: "text-purple-400",
		bgColor: "bg-purple-500/10",
		borderColor: "border-purple-500/30",
	},
	negotiating: {
		label: "Negotiating",
		color: "bg-orange-500",
		textColor: "text-orange-400",
		bgColor: "bg-orange-500/10",
		borderColor: "border-orange-500/30",
	},
	converted: {
		label: "Converted",
		color: "bg-emerald-500",
		textColor: "text-emerald-400",
		bgColor: "bg-emerald-500/10",
		borderColor: "border-emerald-500/30",
	},
	lost: {
		label: "Lost",
		color: "bg-red-500",
		textColor: "text-red-400",
		bgColor: "bg-red-500/10",
		borderColor: "border-red-500/30",
	},
};

const STAGES: (keyof typeof STAGE_CONFIG)[] = [
	"new",
	"contacted",
	"proposal_sent",
	"negotiating",
	"converted",
	"lost",
];

export default function AgentLeadPipeline() {
	const { toast } = useToast();
	const queryClient = useQueryClient();
	const [searchQuery, setSearchQuery] = useState("");
	const [tierFilter, setTierFilter] = useState<"all" | "hni" | "proposals" | "hot">("all");
	const [showAddLead, setShowAddLead] = useState(false);
	const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
	const [convertedOnboardingUrl, setConvertedOnboardingUrl] = useState<string | null>(null);
	const [copiedLink, setCopiedLink] = useState(false);
	const [draggedLead, setDraggedLead] = useState<Lead | null>(null);
	const [dialerOpen, setDialerOpen] = useState(false);
	const [dialerTargetLead, setDialerTargetLead] = useState<any>(null);
	const [isQueueMode, setIsQueueMode] = useState(false);

	const [newLead, setNewLead] = useState({
		name: "",
		email: "",
		phone: "",
		pan: "",
		source: "referral",
		potentialValue: "",
		notes: "",
	});

	const [showEditLead, setShowEditLead] = useState(false);
	const [editLead, setEditLead] = useState({
		id: "",
		name: "",
		email: "",
		phone: "",
		stage: "new" as Lead["stage"],
		source: "referral",
		potentialValue: "",
		score: 50,
		notes: "",
		tags: [] as string[],
		nextFollowUp: "",
	});

	const handleOpenEditLead = (lead: Lead) => {
		setEditLead({
			id: lead.id,
			name: lead.name || "",
			email: lead.email || "",
			phone: lead.phone || "",
			stage: lead.stage || "new",
			source: lead.source || "referral",
			potentialValue: lead.potentialValue ? String(lead.potentialValue) : "",
			score: lead.score || 50,
			notes: lead.notes || "",
			tags: lead.tags || [],
			nextFollowUp: lead.nextFollowUp ? lead.nextFollowUp.split("T")[0] : "",
		});
		setShowEditLead(true);
	};

	const updateLeadMutation = useMutation({
		mutationFn: async (data: typeof editLead) => {
			const res = await apiRequest(`/api/agent/leads/${data.id}`, {
				method: "PUT",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					name: data.name,
					email: data.email,
					phone: data.phone,
					stage: data.stage,
					source: data.source,
					potentialValue: data.potentialValue,
					score: data.score,
					notes: data.notes,
					tags: data.tags,
					nextFollowUpAt: data.nextFollowUp || undefined,
				}),
			});
			return res.json();
		},
		onSuccess: (data: any) => {
			queryClient.invalidateQueries({ queryKey: ["/api/agent/leads"] });
			queryClient.invalidateQueries({ queryKey: ["/api/agent/leads/stats"] });
			setShowEditLead(false);
			if (data?.data) {
				setSelectedLead(data.data);
			} else if (selectedLead) {
				setSelectedLead({
					...selectedLead,
					...editLead,
					potentialValue: Number(editLead.potentialValue) || 0,
				});
			}
			toast({
				title: "Lead Updated",
				description: "Lead details have been saved successfully.",
			});
		},
		onError: (err: any) => {
			toast({
				title: "Update Failed",
				description: err.message || "Failed to update lead",
				variant: "destructive",
			});
		},
	});

	const deleteLeadMutation = useMutation({
		mutationFn: async (id: string) => {
			const res = await apiRequest(`/api/agent/leads/${id}`, {
				method: "DELETE",
			});
			return res.json();
		},
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ["/api/agent/leads"] });
			queryClient.invalidateQueries({ queryKey: ["/api/agent/leads/stats"] });
			setSelectedLead(null);
			setShowEditLead(false);
			toast({
				title: "Lead Deleted",
				description: "Lead was removed from pipeline.",
			});
		},
		onError: (err: any) => {
			toast({
				title: "Delete Failed",
				description: err.message || "Failed to delete lead",
				variant: "destructive",
			});
		},
	});

	const { data: leads, isLoading: leadsLoading } = useQuery<Lead[]>({
		queryKey: ["/api/agent/leads"],
	});

	const { data: stats } = useQuery<LeadStats>({
		queryKey: ["/api/agent/leads/stats"],
	});

	const createLeadMutation = useMutation({
		mutationFn: async (data: typeof newLead) => {
			const res = await apiRequest("/api/agent/leads", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify(data),
			});
			if (!res.ok) {
				const errData = await res.json().catch(() => ({}));
				throw new Error(errData.error || errData.message || "Failed to create lead");
			}
			return res.json();
		},
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ["/api/agent/leads"] });
			queryClient.invalidateQueries({ queryKey: ["/api/agent/leads/stats"] });
			setShowAddLead(false);
			setNewLead({
				name: "",
				email: "",
				phone: "",
				pan: "",
				source: "referral",
				potentialValue: "",
				notes: "",
			});
			toast({
				title: "Lead added successfully",
				description: "Passed anti-collision guardrails and is active in your pipeline.",
			});
		},
		onError: (err: any) => {
			toast({
				title: "Duplicate / Collision Detected",
				description: err.message || "Failed to add lead. Contact may already exist as an active client, lead, or prospect.",
				variant: "destructive",
			});
		},
	});

	const [showBulkUpload, setShowBulkUpload] = useState(false);
	const [bulkFile, setBulkFile] = useState<File | null>(null);
	const [parsedLeads, setParsedLeads] = useState<any[]>([]);
	const [parsingError, setParsingError] = useState<string | null>(null);

	const downloadSampleTemplate = () => {
		const csvContent =
			"Name,Phone,Email,Potential Value,Source,Stage,Notes,Tags\n" +
			"Rajesh Sharma,9876543210,rajesh.sharma@example.com,2500000,referral,new,Interested in mutual fund portfolio,HNI;Wealth\n" +
			"Priya Patel,9823456789,priya.patel@example.com,5000000,website,contacted,Looking for tax advisory and corporate bonds,Tax;HNW\n" +
			"Amit Verma,9811223344,amit.verma@example.com,1500000,cold_call,new,Portfolio review requested,Retirement\n" +
			"Sunita Rao,9833445566,sunita.rao@example.com,4000000,linkedin,new,High networth prospect from Bengaluru,UltraHNI\n";

		const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
		const url = URL.createObjectURL(blob);
		const link = document.createElement("a");
		link.setAttribute("href", url);
		link.setAttribute("download", "fintekpro_leads_template.csv");
		document.body.appendChild(link);
		link.click();
		document.body.removeChild(link);
		URL.revokeObjectURL(url);
	};

	const handleCSVFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
		setParsingError(null);
		const file = e.target.files?.[0];
		if (!file) return;

		setBulkFile(file);
		const reader = new FileReader();
		reader.onload = (event) => {
			try {
				const text = (event.target?.result as string) || "";
				const lines = text
					.split(/\r?\n/)
					.map((l) => l.trim())
					.filter((l) => l.length > 0);

				if (lines.length < 2) {
					setParsingError("CSV file must have a header row and at least one lead row.");
					setParsedLeads([]);
					return;
				}

				const headers = lines[0]
					.split(",")
					.map((h) => h.trim().toLowerCase().replace(/['"]/g, ""));

				const extracted: any[] = [];
				for (let i = 1; i < lines.length; i++) {
					// Handle comma separation
					const cells = lines[i].split(",").map((c) => c.trim().replace(/^["']|["']$/g, ""));
					if (cells.length === 0 || !cells.some((c) => c.length > 0)) continue;

					const leadRow: Record<string, any> = {};
					headers.forEach((header, idx) => {
						const val = cells[idx] || "";
						if (header.includes("name")) leadRow.name = val;
						else if (header.includes("phone") || header.includes("mobile")) leadRow.phone = val;
						else if (header.includes("email")) leadRow.email = val;
						else if (header.includes("value") || header.includes("amount") || header.includes("aum"))
							leadRow.potentialValue = val;
						else if (header.includes("source")) leadRow.source = val;
						else if (header.includes("stage")) leadRow.stage = val;
						else if (header.includes("note") || header.includes("remark")) leadRow.notes = val;
						else if (header.includes("tag"))
							leadRow.tags = val ? val.split(";").map((t) => t.trim()) : [];
					});

					if (leadRow.name) {
						extracted.push({
							name: leadRow.name,
							phone: leadRow.phone || "",
							email: leadRow.email || "",
							potentialValue: leadRow.potentialValue || "0",
							source: leadRow.source || "bulk_import",
							stage: leadRow.stage || "new",
							notes: leadRow.notes || "",
							tags: leadRow.tags || [],
						});
					}
				}

				if (extracted.length === 0) {
					setParsingError("No valid leads found in CSV. Please verify that a 'Name' column is present.");
					setParsedLeads([]);
				} else {
					setParsedLeads(extracted);
				}
			} catch (err: any) {
				setParsingError(`Failed to parse file: ${err.message}`);
				setParsedLeads([]);
			}
		};
		reader.readAsText(file);
	};

	const bulkUploadMutation = useMutation({
		mutationFn: async (leadsToImport: any[]) => {
			const res = await apiRequest("/api/agent/leads/bulk", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ leads: leadsToImport }),
			});
			return res.json();
		},
		onSuccess: (data: any) => {
			queryClient.invalidateQueries({ queryKey: ["/api/agent/leads"] });
			queryClient.invalidateQueries({ queryKey: ["/api/agent/leads/stats"] });
			setShowBulkUpload(false);
			setParsedLeads([]);
			setBulkFile(null);
			const skipped = data.skippedDuplicates || 0;
			toast({
				title: "Bulk Import Finished",
				description: `Successfully added ${data.importedCount || parsedLeads.length} unique leads.${skipped > 0 ? ` Skipped ${skipped} duplicate contacts per anti-collision guardrails.` : ""}`,
			});
		},
		onError: (err: any) => {
			toast({
				title: "Bulk Upload Failed",
				description: err.message || "Failed to upload leads batch. Contacts may all be duplicates.",
				variant: "destructive",
			});
		},
	});

	const convertToClientMutation = useMutation({
		mutationFn: async (leadId: string) => {
			const res = await apiRequest(`/api/agent/leads/${leadId}/convert-to-client`, {
				method: "POST",
				headers: { "Content-Type": "application/json" },
			});
			if (!res.ok) {
				const errData = await res.json().catch(() => ({}));
				throw new Error(errData.error || errData.message || "Failed to convert lead to client");
			}
			return res.json();
		},
		onSuccess: (data: any) => {
			queryClient.invalidateQueries({ queryKey: ["/api/agent/leads"] });
			queryClient.invalidateQueries({ queryKey: ["/api/agent/leads/stats"] });
			if (selectedLead) {
				setSelectedLead({ ...selectedLead, stage: "converted" });
			}
			if (data?.data?.onboardingUrl) {
				setConvertedOnboardingUrl(data.data.onboardingUrl);
			}
			toast({
				title: "Lead Converted to Client",
				description: data.message || "Lead has been marked as converted and KYC onboarding invitation generated.",
			});
		},
		onError: (err: any) => {
			toast({
				title: "Conversion Failed",
				description: err.message || "Failed to convert lead to client",
				variant: "destructive",
			});
		},
	});

	const updateLeadStageMutation = useMutation({
		mutationFn: ({ id, stage }: { id: string; stage: string }) =>
			apiRequest(`/api/agent/leads/${id}/stage`, {
				method: "PATCH",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ stage }),
			}),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ["/api/agent/leads"] });
			queryClient.invalidateQueries({ queryKey: ["/api/agent/leads/stats"] });
			toast({ title: "Lead stage updated" });
		},
	});

	if (leadsLoading) {
		return (
			<div className="min-h-screen bg-background p-6 flex items-center justify-center">
				<Loader2 className="h-8 w-8 animate-spin text-emerald-500" />
				<span className="ml-2 text-muted-foreground">
					Loading lead pipeline...
				</span>
			</div>
		);
	}

	const displayLeads = leads || [];
	const displayStats: LeadStats = stats || {
		total: 0,
		new: 0,
		contacted: 0,
		proposalSent: 0,
		negotiating: 0,
		converted: 0,
		lost: 0,
		conversionRate: 0,
		avgDealValue: 0,
		pipelineValue: 0,
	};

	const filteredLeads = displayLeads.filter((lead) => {
		const matchesSearch =
			(lead.name || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
			(lead.email || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
			(lead.phone || "").includes(searchQuery) ||
			(lead.pan || "").toLowerCase().includes(searchQuery.toLowerCase());

		if (!matchesSearch) return false;

		if (tierFilter === "hni") {
			return lead.tier === "HNI" || lead.tier === "UHNI" || lead.isHni;
		}
		if (tierFilter === "proposals") {
			return (lead.proposalsCount || 0) > 0 || !!lead.latestProposal;
		}
		if (tierFilter === "hot") {
			return lead.score >= 80 && lead.stage !== "converted" && lead.stage !== "lost";
		}
		return true;
	});

	const getLeadsByStage = (stage: string) =>
		filteredLeads.filter((lead) => lead.stage === stage);

	const formatCurrency = (value: number) => {
		if (value >= 10000000) return `₹${(value / 10000000).toFixed(1)}Cr`;
		if (value >= 100000) return `₹${(value / 100000).toFixed(1)}L`;
		return `₹${(value / 1000).toFixed(0)}K`;
	};

	const getScoreColor = (score: number) => {
		if (score >= 80) return "text-emerald-400 bg-emerald-500/20";
		if (score >= 60) return "text-amber-400 bg-amber-500/20";
		return "text-red-400 bg-red-500/20";
	};

	const handleDragStart = (lead: Lead) => {
		setDraggedLead(lead);
	};

	const handleDragOver = (e: React.DragEvent) => {
		e.preventDefault();
	};

	const handleDrop = (stage: keyof typeof STAGE_CONFIG) => {
		if (draggedLead && draggedLead.stage !== stage) {
			updateLeadStageMutation.mutate({ id: draggedLead.id, stage });
		}
		setDraggedLead(null);
	};

	return (
		<div className="min-h-screen bg-background p-6">
			<div className="max-w-full mx-auto space-y-6">
				{/* Header */}
				<div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
					<div>
						<h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
							<Target className="h-7 w-7 text-emerald-500" />
							Lead Pipeline
						</h1>
						<p className="text-muted-foreground mt-1">
							Track and convert prospects into clients
						</p>
					</div>
					<div className="flex items-center gap-3">
						<div className="relative">
							<Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
							<Input
								placeholder="Search leads..."
								value={searchQuery}
								onChange={(e) => setSearchQuery(e.target.value)}
								className="pl-10 w-64 bg-card border-border text-foreground"
								data-testid="input-search-leads"
							/>
						</div>
						<Button
							onClick={() => {
								setDialerTargetLead(null);
								setIsQueueMode(true);
								setDialerOpen(true);
							}}
							className="bg-emerald-600 hover:bg-emerald-700 text-white font-medium shadow-sm"
							data-testid="button-start-auto-dialer"
						>
							<PhoneCall className="h-4 w-4 mr-2" />
							Auto-Dialer Queue
						</Button>
						<Dialog open={showBulkUpload} onOpenChange={setShowBulkUpload}>
							<DialogTrigger asChild>
								<Button
									variant="outline"
									className="border-emerald-500/40 text-emerald-400 bg-emerald-500/5 hover:bg-emerald-500/10 font-medium"
									data-testid="button-bulk-upload-leads"
								>
									<FileSpreadsheet className="h-4 w-4 mr-2 text-emerald-400" />
									Bulk Upload
								</Button>
							</DialogTrigger>
							<DialogContent className="bg-slate-950 border-slate-800 text-white max-w-2xl">
								<DialogHeader>
									<div className="flex items-center justify-between">
										<DialogTitle className="text-xl font-bold flex items-center gap-2">
											<Upload className="h-5 w-5 text-emerald-400" />
											Bulk Upload Leads
										</DialogTitle>
										<Button
											variant="outline"
											size="sm"
											onClick={downloadSampleTemplate}
											className="border-slate-700 text-slate-300 hover:text-white text-xs h-8"
											data-testid="button-download-leads-template"
										>
											<Download className="h-3.5 w-3.5 mr-1.5" />
											Download CSV Template
										</Button>
									</div>
									<DialogDescription className="text-xs text-slate-400">
										Import multiple prospects at once using a CSV file. Columns supported: Name, Phone, Email, Potential Value, Source, Stage, Notes, Tags.
									</DialogDescription>
								</DialogHeader>

								<div className="space-y-4 py-2">
									{/* File Dropzone */}
									<div className="border-2 border-dashed border-slate-800 hover:border-emerald-500/50 rounded-xl p-6 text-center transition-colors bg-slate-900/40">
										<input
											type="file"
											accept=".csv,.txt"
											onChange={handleCSVFileChange}
											className="hidden"
											id="bulk-lead-file-input"
										/>
										<label
											htmlFor="bulk-lead-file-input"
											className="cursor-pointer flex flex-col items-center space-y-2"
										>
											<div className="p-3 rounded-full bg-emerald-500/10 text-emerald-400">
												<FileSpreadsheet className="h-6 w-6" />
											</div>
											<div>
												<p className="text-sm font-semibold text-white">
													{bulkFile ? bulkFile.name : "Click to browse or drag and drop your CSV file"}
												</p>
												<p className="text-xs text-slate-400 mt-0.5">
													Supports standard comma-separated (.csv) files up to 500 leads per batch
												</p>
											</div>
										</label>
									</div>

									{parsingError && (
										<div className="p-3 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs flex items-center gap-2">
											<AlertCircle className="h-4 w-4 shrink-0" />
											<span>{parsingError}</span>
										</div>
									)}

									{/* Parsed Preview Table */}
									{parsedLeads.length > 0 && (
										<div className="space-y-2">
											<div className="flex items-center justify-between text-xs">
												<span className="font-semibold text-emerald-400 flex items-center gap-1.5">
													<Check className="h-3.5 w-3.5" />
													{parsedLeads.length} Leads ready for import
												</span>
												<span className="text-slate-400">Showing top 5 preview rows</span>
											</div>

											<div className="border border-slate-800 rounded-lg overflow-hidden bg-slate-900/60 max-h-48 overflow-y-auto">
												<table className="w-full text-xs text-left">
													<thead className="bg-slate-900 text-slate-400 border-b border-slate-800">
														<tr>
															<th className="p-2">Name</th>
															<th className="p-2">Phone</th>
															<th className="p-2">Email</th>
															<th className="p-2">Value</th>
															<th className="p-2">Tags</th>
														</tr>
													</thead>
													<tbody className="divide-y divide-slate-800/60 text-slate-300">
														{parsedLeads.slice(0, 5).map((l, i) => (
															<tr key={i} className="hover:bg-slate-800/40">
																<td className="p-2 font-medium text-white">{l.name}</td>
																<td className="p-2 font-mono text-emerald-400">{l.phone || "—"}</td>
																<td className="p-2 text-slate-400">{l.email || "—"}</td>
																<td className="p-2">₹{Number(l.potentialValue || 0).toLocaleString("en-IN")}</td>
																<td className="p-2">
																	{Array.isArray(l.tags) && l.tags.length > 0
																		? l.tags.join(", ")
																		: "—"}
																</td>
															</tr>
														))}
													</tbody>
												</table>
											</div>
										</div>
									)}
								</div>

								<div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-800">
									<Button
										variant="outline"
										onClick={() => {
											setShowBulkUpload(false);
											setParsedLeads([]);
											setBulkFile(null);
											setParsingError(null);
										}}
										className="border-slate-800 text-slate-300 hover:text-white"
									>
										Cancel
									</Button>
									<Button
										onClick={() => bulkUploadMutation.mutate(parsedLeads)}
										disabled={parsedLeads.length === 0 || bulkUploadMutation.isPending}
										className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs px-6"
										data-testid="button-confirm-bulk-upload"
									>
										{bulkUploadMutation.isPending
											? "Importing Leads..."
											: `Import ${parsedLeads.length} Leads`}
									</Button>
								</div>
							</DialogContent>
						</Dialog>

						<Dialog open={showAddLead} onOpenChange={setShowAddLead}>
							<DialogTrigger asChild>
								<Button
									variant="outline"
									className="border-border text-foreground hover:bg-muted"
									data-testid="button-add-lead"
								>
									<Plus className="h-4 w-4 mr-2" />
									Add Lead
								</Button>
							</DialogTrigger>
							<DialogContent className="bg-background border-border text-foreground max-w-md">
								<DialogHeader>
									<DialogTitle>Add New Lead</DialogTitle>
									<DialogDescription className="text-muted-foreground">
										Enter prospect details to add to your pipeline
									</DialogDescription>
								</DialogHeader>
								<div className="space-y-4 mt-4">
									<div>
										<Label htmlFor="name" className="text-muted-foreground">
											Name *
										</Label>
										<Input
											id="name"
											value={newLead.name}
											onChange={(e) =>
												setNewLead({ ...newLead, name: e.target.value })
											}
											className="mt-1 bg-card border-border"
											placeholder="Full name"
											data-testid="input-lead-name"
										/>
									</div>
									<div className="grid grid-cols-2 gap-4">
										<div>
											<Label htmlFor="email" className="text-muted-foreground">
												Email
											</Label>
											<Input
												id="email"
												type="email"
												value={newLead.email}
												onChange={(e) =>
													setNewLead({ ...newLead, email: e.target.value })
												}
												className="mt-1 bg-card border-border"
												placeholder="email@example.com"
												data-testid="input-lead-email"
											/>
										</div>
										<div>
											<Label htmlFor="phone" className="text-muted-foreground">
												Phone
											</Label>
											<Input
												id="phone"
												value={newLead.phone}
												onChange={(e) =>
													setNewLead({ ...newLead, phone: e.target.value })
												}
												className="mt-1 bg-card border-border"
												placeholder="9876543210"
												data-testid="input-lead-phone"
											/>
										</div>
									</div>
									<div className="grid grid-cols-2 gap-4">
										<div>
											<Label htmlFor="value" className="text-muted-foreground">
												Potential Value (₹)
											</Label>
											<Input
												id="value"
												type="number"
												value={newLead.potentialValue}
												onChange={(e) =>
													setNewLead({
														...newLead,
														potentialValue: e.target.value,
													})
												}
												className="mt-1 bg-card border-border"
												placeholder="1000000"
												data-testid="input-lead-value"
											/>
										</div>
										<div>
											<Label htmlFor="pan" className="text-muted-foreground flex items-center justify-between">
												<span>PAN (Optional)</span>
												<span className="text-[10px] text-emerald-400">HNI Check</span>
											</Label>
											<Input
												id="pan"
												value={newLead.pan}
												onChange={(e) =>
													setNewLead({
														...newLead,
														pan: e.target.value.toUpperCase(),
													})
												}
												className="mt-1 bg-card border-border uppercase font-mono"
												placeholder="ABCDE1234F"
												maxLength={10}
												data-testid="input-lead-pan"
											/>
										</div>
									</div>
									<div className="flex items-center gap-2 p-2 rounded bg-emerald-500/10 border border-emerald-500/20 text-[11px] text-emerald-400">
										<ShieldCheck className="h-3.5 w-3.5 shrink-0" />
										<span>Anti-collision guardrails active. Duplicate clients, active leads, and HNI prospects are blocked.</span>
									</div>
									<div>
										<Label htmlFor="notes" className="text-muted-foreground">
											Notes
										</Label>
										<Textarea
											id="notes"
											value={newLead.notes}
											onChange={(e) =>
												setNewLead({ ...newLead, notes: e.target.value })
											}
											className="mt-1 bg-card border-border"
											placeholder="Initial observations, interests, requirements..."
											rows={3}
											data-testid="textarea-lead-notes"
										/>
									</div>
									<div className="flex justify-end gap-3 pt-4">
										<Button
											variant="outline"
											onClick={() => setShowAddLead(false)}
											className="border-border"
										>
											Cancel
										</Button>
										<Button
											onClick={() => createLeadMutation.mutate(newLead)}
											disabled={!newLead.name || createLeadMutation.isPending}
											className="bg-emerald-600 hover:bg-emerald-700"
											data-testid="button-save-lead"
										>
											{createLeadMutation.isPending && (
												<Loader2 className="h-4 w-4 mr-2 animate-spin" />
											)}
											Add Lead
										</Button>
									</div>
								</div>
							</DialogContent>
						</Dialog>
					</div>
				</div>

				{/* Stats Cards */}
				<div className="grid grid-cols-2 md:grid-cols-5 gap-4">
					<Card className="bg-card/50 border-border">
						<CardContent className="p-4">
							<div className="flex justify-between items-start">
								<div>
									<p className="text-muted-foreground text-sm">
										Pipeline Value
									</p>
									<p
										className="text-xl font-bold text-foreground mt-1"
										data-testid="text-pipeline-value"
									>
										{formatCurrency(displayStats.pipelineValue)}
									</p>
								</div>
								<div className="p-2 bg-emerald-500/20 rounded-lg">
									<IndianRupee className="h-5 w-5 text-emerald-400" />
								</div>
							</div>
						</CardContent>
					</Card>
					<Card className="bg-card/50 border-border">
						<CardContent className="p-4">
							<div className="flex justify-between items-start">
								<div>
									<p className="text-muted-foreground text-sm">Total Leads</p>
									<p
										className="text-xl font-bold text-foreground mt-1"
										data-testid="text-total-leads"
									>
										{displayStats.total}
									</p>
								</div>
								<div className="p-2 bg-blue-500/20 rounded-lg">
									<User className="h-5 w-5 text-blue-400" />
								</div>
							</div>
						</CardContent>
					</Card>
					<Card className="bg-card/50 border-border">
						<CardContent className="p-4">
							<div className="flex justify-between items-start">
								<div>
									<p className="text-muted-foreground text-sm">
										Conversion Rate
									</p>
									<p
										className="text-xl font-bold text-foreground mt-1"
										data-testid="text-conversion-rate"
									>
										{displayStats.conversionRate.toFixed(1)}%
									</p>
								</div>
								<div className="p-2 bg-purple-500/20 rounded-lg">
									<TrendingUp className="h-5 w-5 text-purple-400" />
								</div>
							</div>
						</CardContent>
					</Card>
					<Card className="bg-card/50 border-border">
						<CardContent className="p-4">
							<div className="flex justify-between items-start">
								<div>
									<p className="text-muted-foreground text-sm">Avg Deal Size</p>
									<p className="text-xl font-bold text-foreground mt-1">
										{formatCurrency(displayStats.avgDealValue)}
									</p>
								</div>
								<div className="p-2 bg-amber-500/20 rounded-lg">
									<Target className="h-5 w-5 text-amber-400" />
								</div>
							</div>
						</CardContent>
					</Card>
					<Card className="bg-card/50 border-border">
						<CardContent className="p-4">
							<div className="flex justify-between items-start">
								<div>
									<p className="text-muted-foreground text-sm">Hot Leads</p>
									<p className="text-xl font-bold text-foreground mt-1">
										{
											displayLeads.filter(
												(l) =>
													l.score >= 80 &&
													l.stage !== "converted" &&
													l.stage !== "lost",
											).length
										}
									</p>
								</div>
								<div className="p-2 bg-red-500/20 rounded-lg">
									<Zap className="h-5 w-5 text-red-400" />
								</div>
							</div>
						</CardContent>
					</Card>
				</div>

				{/* Funnel Segment Filter Bar */}
				<div className="flex flex-wrap items-center justify-between gap-3 bg-card/60 p-2.5 rounded-lg border border-border">
					<div className="flex items-center gap-1.5 flex-wrap">
						<Button
							variant={tierFilter === "all" ? "default" : "outline"}
							size="sm"
							onClick={() => setTierFilter("all")}
							className={
								tierFilter === "all"
									? "bg-emerald-600 hover:bg-emerald-700 text-white text-xs h-8"
									: "border-border text-muted-foreground text-xs h-8"
							}
						>
							All Leads ({displayLeads.length})
						</Button>
						<Button
							variant={tierFilter === "hni" ? "default" : "outline"}
							size="sm"
							onClick={() => setTierFilter("hni")}
							className={
								tierFilter === "hni"
									? "bg-amber-500 hover:bg-amber-600 text-slate-950 font-semibold text-xs h-8"
									: "border-border text-amber-400 hover:text-amber-300 text-xs h-8"
							}
						>
							<Crown className="h-3.5 w-3.5 mr-1 text-amber-400" />
							HNI / Promoters ({displayLeads.filter((l) => l.isHni || l.tier === "HNI" || l.tier === "UHNI").length})
						</Button>
						<Button
							variant={tierFilter === "proposals" ? "default" : "outline"}
							size="sm"
							onClick={() => setTierFilter("proposals")}
							className={
								tierFilter === "proposals"
									? "bg-purple-600 hover:bg-purple-700 text-white text-xs h-8"
									: "border-border text-purple-400 text-xs h-8"
							}
						>
							<FileText className="h-3.5 w-3.5 mr-1 text-purple-400" />
							Proposals Active ({displayLeads.filter((l) => (l.proposalsCount || 0) > 0 || l.latestProposal).length})
						</Button>
						<Button
							variant={tierFilter === "hot" ? "default" : "outline"}
							size="sm"
							onClick={() => setTierFilter("hot")}
							className={
								tierFilter === "hot"
									? "bg-rose-600 hover:bg-rose-700 text-white text-xs h-8"
									: "border-border text-rose-400 text-xs h-8"
							}
						>
							<Zap className="h-3.5 w-3.5 mr-1 text-rose-400" />
							Hot Leads (80+) ({displayLeads.filter((l) => l.score >= 80 && l.stage !== "converted" && l.stage !== "lost").length})
						</Button>
					</div>
					<div className="flex items-center gap-2 text-xs text-muted-foreground">
						<ShieldCheck className="h-4 w-4 text-emerald-400" />
						<span>Anti-collision deduplication active</span>
					</div>
				</div>

				{/* Kanban Board */}
				<div className="overflow-x-auto pb-4">
					<div className="flex gap-4 min-w-max">
						{STAGES.filter((s) => s !== "lost").map((stage) => {
							const config = STAGE_CONFIG[stage];
							const stageLeads = getLeadsByStage(stage);
							const stageValue = stageLeads.reduce(
								(sum, l) => sum + l.potentialValue,
								0,
							);

							return (
								<section
									key={stage}
									aria-label={config.label}
									className="w-80 flex-shrink-0"
									onDragOver={handleDragOver}
									onDrop={() => handleDrop(stage)}
								>
									<div
										className={`rounded-t-lg p-3 ${config.bgColor} border ${config.borderColor} border-b-0`}
									>
										<div className="flex items-center justify-between">
											<div className="flex items-center gap-2">
												<div
													className={`w-3 h-3 rounded-full ${config.color}`}
												/>
												<span className="text-foreground font-medium">
													{config.label}
												</span>
												<Badge
													variant="outline"
													className="text-muted-foreground border-border ml-1"
												>
													{stageLeads.length}
												</Badge>
											</div>
											<span className={`text-sm ${config.textColor}`}>
												{formatCurrency(stageValue)}
											</span>
										</div>
									</div>
									<ScrollArea className="h-[500px] rounded-b-lg border border-border border-t-0 bg-background/50">
										<div className="p-2 space-y-2">
											{stageLeads.length === 0 ? (
												<div className="p-4 text-center text-muted-foreground text-sm">
													No leads in this stage
												</div>
											) : (
												stageLeads.map((lead) => (
													<Card
														key={lead.id}
														className="bg-card border-border cursor-grab active:cursor-grabbing hover:border-border transition-colors"
														draggable
														onDragStart={() => handleDragStart(lead)}
														onClick={() => setSelectedLead(lead)}
														data-testid={`card-lead-${lead.id}`}
													>
														<CardContent className="p-3">
															<div className="flex items-start justify-between mb-2">
																<div>
																	<div className="flex items-center gap-1.5 flex-wrap">
																		<p className="text-foreground font-medium text-sm">
																			{lead.name}
																		</p>
																		{lead.tier === "UHNI" && (
																			<Badge className="bg-amber-500/20 text-amber-300 border border-amber-500/40 text-[9px] px-1 py-0 flex items-center gap-0.5 font-bold">
																				<Crown className="h-2.5 w-2.5 text-amber-400" /> UHNI
																			</Badge>
																		)}
																		{(lead.tier === "HNI" || lead.isHni) && lead.tier !== "UHNI" && (
																			<Badge className="bg-amber-500/15 text-amber-400 border border-amber-500/30 text-[9px] px-1 py-0 flex items-center gap-0.5 font-bold">
																				<Crown className="h-2.5 w-2.5 text-amber-400" /> HNI
																			</Badge>
																		)}
																	</div>
																	<p className="text-muted-foreground text-xs">
																		{lead.source}
																	</p>
																</div>
																<div className="flex items-center gap-1.5">
																	<Button
																		variant="ghost"
																		size="icon"
																		className="h-6 w-6 text-muted-foreground hover:text-foreground"
																		data-testid={`btn-quick-edit-${lead.id}`}
																		onClick={(e) => {
																			e.stopPropagation();
																			handleOpenEditLead(lead);
																		}}
																		title="Edit Lead"
																	>
																		<Edit className="h-3.5 w-3.5" />
																	</Button>
																	<Badge
																		className={`${getScoreColor(lead.score)} text-xs`}
																	>
																		{lead.score}
																	</Badge>
																</div>
															</div>
															<div className="flex items-center gap-2 text-xs text-muted-foreground mb-2">
																<IndianRupee className="h-3 w-3" />
																<span>
																	{formatCurrency(lead.potentialValue)}
																</span>
																{lead.pan && (
																	<span className="font-mono text-[10px] text-slate-400">
																		• {lead.pan}
																	</span>
																)}
															</div>
															{lead.latestProposal && (
																<div className="mb-2">
																	<Badge className="bg-purple-500/15 text-purple-300 border border-purple-500/30 text-[10px] px-1.5 py-0 flex items-center gap-1 w-fit">
																		<FileText className="h-2.5 w-2.5 text-purple-400" />
																		Proposal: {lead.latestProposal.status} ({lead.latestProposal.viewCount}v)
																	</Badge>
																</div>
															)}
															{lead.tags.length > 0 && (
																<div className="flex flex-wrap gap-1 mb-2">
																	{lead.tags.slice(0, 2).map((tag, i) => (
																		<Badge
																			key={i}
																			variant="outline"
																			className="text-xs border-border text-muted-foreground py-0"
																		>
																			{tag}
																		</Badge>
																	))}
																	{lead.tags.length > 2 && (
																		<Badge
																			key="extra-tags"
																			variant="outline"
																			className="text-xs border-border text-muted-foreground py-0"
																		>
																			+{lead.tags.length - 2}
																		</Badge>
																	)}
																</div>
															)}
															{lead.nextFollowUp && (
																<div className="flex items-center gap-1 text-xs text-amber-400">
																	<Clock className="h-3 w-3" />
																	<span>
																		Follow up:{" "}
																		{new Date(
																			lead.nextFollowUp,
																		).toLocaleDateString()}
																	</span>
																</div>
															)}
															<div className="flex items-center justify-between mt-3 pt-2 border-t border-border">
																<div className="flex gap-1">
																	<Button
																		size="sm"
																		variant="ghost"
																		className="h-7 w-7 p-0 text-muted-foreground hover:text-foreground"
																		title="Call lead"
																		onClick={(e) => {
																			e.stopPropagation();
																			setDialerTargetLead({
																				id: lead.id,
																				companyName: lead.name,
																				contactName: lead.name,
																				phone: lead.phone,
																				email: lead.email,
																				leadScore: lead.score,
																				notes: lead.notes,
																			});
																			setIsQueueMode(false);
																			setDialerOpen(true);
																		}}
																	>
																		<Phone className="h-3 w-3" />
																	</Button>
																	<Button
																		size="sm"
																		variant="ghost"
																		className="h-7 w-7 p-0 text-muted-foreground hover:text-foreground"
																		title="Send email"
																		onClick={(e) => {
																			e.stopPropagation();
																			if (lead.email) {
																				window.open(`mailto:${lead.email}?subject=FintekPro Wealth Advisory`);
																			}
																		}}
																	>
																		<Mail className="h-3 w-3" />
																	</Button>
																	<Button
																		size="sm"
																		variant="ghost"
																		className="h-7 w-7 p-0 text-purple-400 hover:text-purple-300 hover:bg-purple-500/10"
																		title="Generate / Open AI Proposal"
																		onClick={(e) => {
																			e.stopPropagation();
																			window.location.href = `/agent/prospect-wizard?name=${encodeURIComponent(lead.name)}&phone=${lead.phone}&email=${lead.email}&value=${lead.potentialValue}&ref=${lead.id}`;
																		}}
																	>
																		<Sparkles className="h-3.5 w-3.5" />
																	</Button>
																</div>
																<Button
																	size="sm"
																	variant="ghost"
																	className="h-7 text-xs text-muted-foreground hover:text-foreground"
																>
																	<ChevronRight className="h-3 w-3" />
																</Button>
															</div>
														</CardContent>
													</Card>
												))
											)}
										</div>
									</ScrollArea>
								</section>
							);
						})}
					</div>
				</div>

				{/* Lost Leads Section (Collapsed) */}
				<Card className="bg-background/50 border-border">
					<CardHeader className="py-3">
						<div className="flex items-center justify-between">
							<CardTitle className="text-foreground text-sm flex items-center gap-2">
								<XCircle className="h-4 w-4 text-red-400" />
								Lost Leads ({getLeadsByStage("lost").length})
							</CardTitle>
							<Button
								variant="ghost"
								size="sm"
								className="text-muted-foreground"
							>
								View All
							</Button>
						</div>
					</CardHeader>
					<CardContent className="py-2">
						<div className="flex gap-4 overflow-x-auto pb-2">
							{getLeadsByStage("lost").map((lead) => (
								<div
									key={lead.id}
									className="flex items-center gap-3 p-2 bg-card/50 rounded-lg min-w-[200px]"
								>
									<div className="w-8 h-8 rounded-full bg-red-500/20 flex items-center justify-center">
										<User className="h-4 w-4 text-red-400" />
									</div>
									<div>
										<p className="text-foreground text-sm">{lead.name}</p>
										<p className="text-muted-foreground text-xs">
											{formatCurrency(lead.potentialValue)}
										</p>
									</div>
								</div>
							))}
						</div>
					</CardContent>
				</Card>

				{/* Lead Detail Dialog */}
				<Dialog
					open={!!selectedLead}
					onOpenChange={() => setSelectedLead(null)}
				>
					<DialogContent className="bg-background border-border text-foreground max-w-lg">
						{selectedLead && (
							<>
								<DialogHeader>
									<div className="flex items-start justify-between">
										<div>
											<div className="flex items-center gap-2">
												<DialogTitle className="text-xl">
													{selectedLead.name}
												</DialogTitle>
												{selectedLead.tier === "UHNI" && (
													<Badge className="bg-amber-500/20 text-amber-300 border border-amber-500/40 text-xs px-2 py-0.5 flex items-center gap-1 font-bold">
														<Crown className="h-3 w-3 text-amber-400" /> UHNI
													</Badge>
												)}
												{(selectedLead.tier === "HNI" || selectedLead.isHni) && selectedLead.tier !== "UHNI" && (
													<Badge className="bg-amber-500/15 text-amber-400 border border-amber-500/30 text-xs px-2 py-0.5 flex items-center gap-1 font-bold">
														<Crown className="h-3 w-3 text-amber-400" /> HNI Prospect
													</Badge>
												)}
											</div>
											<DialogDescription className="text-muted-foreground flex items-center gap-2 mt-1">
												<Badge
													className={`${STAGE_CONFIG[selectedLead.stage].bgColor} ${STAGE_CONFIG[selectedLead.stage].textColor}`}
												>
													{STAGE_CONFIG[selectedLead.stage].label}
												</Badge>
												<span>•</span>
												<span>Score: {selectedLead.score}</span>
												{selectedLead.pan && (
													<>
														<span>•</span>
														<span className="font-mono text-xs">PAN: {selectedLead.pan}</span>
													</>
												)}
											</DialogDescription>
										</div>
									</div>
								</DialogHeader>
								<div className="space-y-4 mt-4">
									<div className="grid grid-cols-2 gap-4">
										<div className="p-3 bg-card rounded-lg">
											<p className="text-muted-foreground text-xs">
												Potential Value / Surplus
											</p>
											<p className="text-foreground font-medium">
												{formatCurrency(selectedLead.potentialValue)}
											</p>
										</div>
										<div className="p-3 bg-card rounded-lg">
											<p className="text-muted-foreground text-xs">Source</p>
											<p className="text-foreground font-medium">
												{selectedLead.source}
											</p>
										</div>
									</div>

									{/* Proposal Section if exists */}
									{selectedLead.latestProposal && (
										<div className="p-3 rounded-lg border border-purple-500/30 bg-purple-500/5 space-y-2">
											<div className="flex items-center justify-between">
												<div className="flex items-center gap-2 text-xs font-semibold text-purple-300">
													<FileText className="h-4 w-4 text-purple-400" />
													<span>Active Proposal: {selectedLead.latestProposal.title}</span>
												</div>
												<Badge className="bg-purple-500/20 text-purple-300 border-purple-500/40 text-[10px]">
													{selectedLead.latestProposal.status.toUpperCase()}
												</Badge>
											</div>
											<div className="flex items-center justify-between text-xs text-muted-foreground">
												<span>Views: {selectedLead.latestProposal.viewCount} times</span>
												{selectedLead.latestProposal.lastViewedAt && (
													<span>Last viewed: {new Date(selectedLead.latestProposal.lastViewedAt).toLocaleDateString()}</span>
												)}
											</div>
											<div className="flex items-center gap-2 pt-1">
												<Button
													size="sm"
													variant="outline"
													className="h-7 text-xs border-purple-500/40 text-purple-300 hover:text-white hover:bg-purple-500/20 flex-1"
													onClick={() => {
														window.open(`/proposal/view/${selectedLead.latestProposal?.shareToken}`, "_blank");
													}}
												>
													<ExternalLink className="h-3 w-3 mr-1" />
													View Proposal
												</Button>
												<Button
													size="sm"
													variant="outline"
													className="h-7 text-xs border-purple-500/40 text-purple-300 hover:text-white hover:bg-purple-500/20"
													onClick={() => {
														const link = `${window.location.origin}/proposal/view/${selectedLead.latestProposal?.shareToken}`;
														navigator.clipboard.writeText(link);
														toast({ title: "Proposal link copied to clipboard" });
													}}
												>
													<Copy className="h-3 w-3 mr-1" />
													Copy Link
												</Button>
											</div>
										</div>
									)}

									{/* Converted KYC Onboarding Invitation Box */}
									{convertedOnboardingUrl && (
										<div className="p-3 rounded-lg border border-emerald-500/40 bg-emerald-500/10 space-y-2">
											<div className="flex items-center gap-2 text-xs font-semibold text-emerald-400">
												<CheckCircle2 className="h-4 w-4" />
												<span>KYC Onboarding Link Ready for Client</span>
											</div>
											<p className="text-[11px] text-muted-foreground">
												Share this personalized onboarding link with the prospect to finalize their FintekPro client registration.
											</p>
											<div className="flex items-center gap-2 pt-1">
												<Button
													size="sm"
													className="h-7 text-xs bg-emerald-600 hover:bg-emerald-700 text-white flex-1"
													onClick={() => {
														const fullUrl = `${window.location.origin}${convertedOnboardingUrl}`;
														navigator.clipboard.writeText(fullUrl);
														setCopiedLink(true);
														setTimeout(() => setCopiedLink(false), 2000);
														toast({ title: "KYC link copied to clipboard!" });
													}}
												>
													{copiedLink ? <Check className="h-3 w-3 mr-1" /> : <Copy className="h-3 w-3 mr-1" />}
													{copiedLink ? "Copied!" : "Copy KYC Link"}
												</Button>
												{selectedLead.phone && (
													<Button
														size="sm"
														variant="outline"
														className="h-7 text-xs border-emerald-500/40 text-emerald-400 hover:bg-emerald-500/20"
														onClick={() => {
															const fullUrl = `${window.location.origin}${convertedOnboardingUrl}`;
															const cleanPhone = selectedLead.phone.replace(/\D/g, "").slice(-10);
															const msg = encodeURIComponent(
																`Hello ${selectedLead.name}, here is your FintekPro onboarding link to activate your investment account: ${fullUrl}`
															);
															window.open(`https://api.whatsapp.com/send?phone=91${cleanPhone}&text=${msg}`, "_blank");
														}}
													>
														<Share2 className="h-3 w-3 mr-1" />
														WhatsApp
													</Button>
												)}
											</div>
										</div>
									)}

									<div className="space-y-2">
										<div className="flex items-center gap-2 text-sm">
											<Mail className="h-4 w-4 text-muted-foreground" />
											<span className="text-muted-foreground">
												{selectedLead.email || "No email provided"}
											</span>
										</div>
										<div className="flex items-center gap-2 text-sm">
											<Phone className="h-4 w-4 text-muted-foreground" />
											<span className="text-muted-foreground">
												{selectedLead.phone || "No phone provided"}
											</span>
										</div>
										{selectedLead.lastContact && (
											<div className="flex items-center gap-2 text-sm">
												<Calendar className="h-4 w-4 text-muted-foreground" />
												<span className="text-muted-foreground">
													Last contact:{" "}
													{new Date(
														selectedLead.lastContact,
													).toLocaleDateString()}
												</span>
											</div>
										)}
									</div>
									{selectedLead.notes && (
										<div className="p-3 bg-card rounded-lg">
											<p className="text-muted-foreground text-xs mb-1">
												Notes
											</p>
											<p className="text-foreground text-sm">
												{selectedLead.notes}
											</p>
										</div>
									)}
									{selectedLead.tags.length > 0 && (
										<div className="flex flex-wrap gap-2">
											{selectedLead.tags.map((tag, i) => (
												<Badge
													key={i}
													variant="outline"
													className="border-border text-muted-foreground"
												>
													{tag}
												</Badge>
											))}
										</div>
									)}

									{/* Action Buttons */}
									<div className="grid grid-cols-2 gap-2 pt-2 border-t border-border">
										<Button
											onClick={() => {
												window.location.href = `/agent/prospect-wizard?name=${encodeURIComponent(selectedLead.name)}&phone=${selectedLead.phone}&email=${selectedLead.email}&value=${selectedLead.potentialValue}&ref=${selectedLead.id}`;
											}}
											className="bg-purple-600 hover:bg-purple-700 text-white font-medium text-xs h-9"
										>
											<Sparkles className="h-3.5 w-3.5 mr-1.5" />
											AI Proposal Studio
										</Button>
										{selectedLead.stage !== "converted" ? (
											<Button
												onClick={() => convertToClientMutation.mutate(selectedLead.id)}
												disabled={convertToClientMutation.isPending}
												className="bg-emerald-600 hover:bg-emerald-700 text-white font-medium text-xs h-9"
											>
												{convertToClientMutation.isPending ? (
													<Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
												) : (
													<UserCheck className="h-3.5 w-3.5 mr-1.5" />
												)}
												Convert to Client (KYC)
											</Button>
										) : (
											<Button
												variant="outline"
												disabled
												className="border-emerald-500/40 text-emerald-400 font-medium text-xs h-9"
											>
												<CheckCircle2 className="h-3.5 w-3.5 mr-1.5" />
												Client Converted
											</Button>
										)}
									</div>

									<div className="flex gap-2 pt-2 border-t border-border">
										<Button
											onClick={() => {
												setDialerTargetLead({
													id: selectedLead.id,
													companyName: selectedLead.name,
													contactName: selectedLead.name,
													phone: selectedLead.phone,
													email: selectedLead.email,
													leadScore: selectedLead.score,
													notes: selectedLead.notes,
												});
												setIsQueueMode(false);
												setDialerOpen(true);
											}}
											className="flex-1 bg-slate-800 hover:bg-slate-700 text-white font-medium text-xs h-8"
											data-testid="button-call-lead"
										>
											<Phone className="h-3.5 w-3.5 mr-1.5" />
											Call (Device SIM)
										</Button>
										<Button
											variant="outline"
											className="flex-1 border-border text-xs h-8"
											data-testid="button-email-lead"
											onClick={() => {
												if (selectedLead.email) {
													window.open(`mailto:${selectedLead.email}?subject=FintekPro Wealth Advisory`);
												}
											}}
										>
											<Mail className="h-3.5 w-3.5 mr-1.5" />
											Email
										</Button>
										<Button
											variant="outline"
											className="border-border hover:bg-muted text-xs h-8"
											data-testid="button-edit-lead"
											onClick={() => handleOpenEditLead(selectedLead)}
											title="Edit Lead"
										>
											<Edit className="h-3.5 w-3.5 mr-1.5" />
											Edit
										</Button>
										<Button
											variant="ghost"
											size="icon"
											className="text-red-500 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950 h-8 w-8"
											data-testid="button-delete-lead"
											onClick={() => {
												if (confirm(`Are you sure you want to delete lead "${selectedLead.name}"?`)) {
													deleteLeadMutation.mutate(selectedLead.id);
												}
											}}
											title="Delete Lead"
										>
											<Trash2 className="h-4 w-4" />
										</Button>
									</div>
								</div>
							</>
						)}
					</DialogContent>
				</Dialog>

				{/* Edit Lead Dialog */}
				<Dialog open={showEditLead} onOpenChange={setShowEditLead}>
					<DialogContent className="bg-background border-border text-foreground max-w-lg">
						<DialogHeader>
							<DialogTitle className="text-xl">Edit Lead</DialogTitle>
							<DialogDescription className="text-muted-foreground">
								Modify prospect details and pipeline stage
							</DialogDescription>
						</DialogHeader>
						<div className="space-y-4 mt-4">
							<div>
								<Label htmlFor="edit-name" className="text-muted-foreground">
									Name *
								</Label>
								<Input
									id="edit-name"
									value={editLead.name}
									onChange={(e) =>
										setEditLead({ ...editLead, name: e.target.value })
									}
									className="mt-1 bg-card border-border"
									placeholder="Full name"
									data-testid="input-edit-lead-name"
								/>
							</div>
							<div className="grid grid-cols-2 gap-4">
								<div>
									<Label htmlFor="edit-email" className="text-muted-foreground">
										Email
									</Label>
									<Input
										id="edit-email"
										type="email"
										value={editLead.email}
										onChange={(e) =>
											setEditLead({ ...editLead, email: e.target.value })
										}
										className="mt-1 bg-card border-border"
										placeholder="email@example.com"
										data-testid="input-edit-lead-email"
									/>
								</div>
								<div>
									<Label htmlFor="edit-phone" className="text-muted-foreground">
										Phone
									</Label>
									<Input
										id="edit-phone"
										value={editLead.phone}
										onChange={(e) =>
											setEditLead({ ...editLead, phone: e.target.value })
										}
										className="mt-1 bg-card border-border"
										placeholder="9876543210"
										data-testid="input-edit-lead-phone"
									/>
								</div>
							</div>
							<div className="grid grid-cols-2 gap-4">
								<div>
									<Label htmlFor="edit-stage" className="text-muted-foreground">
										Stage
									</Label>
									<Select
										value={editLead.stage}
										onValueChange={(value: Lead["stage"]) =>
											setEditLead({ ...editLead, stage: value })
										}
									>
										<SelectTrigger
											className="mt-1 bg-card border-border"
											data-testid="select-edit-lead-stage"
										>
											<SelectValue />
										</SelectTrigger>
										<SelectContent className="bg-card border-border">
											{STAGES.map((s) => (
												<SelectItem key={s} value={s}>
													{STAGE_CONFIG[s].label}
												</SelectItem>
											))}
										</SelectContent>
									</Select>
								</div>
								<div>
									<Label htmlFor="edit-source" className="text-muted-foreground">
										Source
									</Label>
									<Select
										value={editLead.source}
										onValueChange={(value) =>
											setEditLead({ ...editLead, source: value })
										}
									>
										<SelectTrigger
											className="mt-1 bg-card border-border"
											data-testid="select-edit-lead-source"
										>
											<SelectValue />
										</SelectTrigger>
										<SelectContent className="bg-card border-border">
											<SelectItem value="referral">Referral</SelectItem>
											<SelectItem value="website">Website</SelectItem>
											<SelectItem value="linkedin">LinkedIn</SelectItem>
											<SelectItem value="event">Event</SelectItem>
											<SelectItem value="webinar">Webinar</SelectItem>
											<SelectItem value="cold_call">Cold Call</SelectItem>
											<SelectItem value="manual">Manual</SelectItem>
										</SelectContent>
									</Select>
								</div>
							</div>
							<div className="grid grid-cols-2 gap-4">
								<div>
									<Label htmlFor="edit-value" className="text-muted-foreground">
										Potential Value (₹)
									</Label>
									<Input
										id="edit-value"
										type="number"
										value={editLead.potentialValue}
										onChange={(e) =>
											setEditLead({
												...editLead,
												potentialValue: e.target.value,
											})
										}
										className="mt-1 bg-card border-border"
										placeholder="1000000"
										data-testid="input-edit-lead-value"
									/>
								</div>
								<div>
									<Label htmlFor="edit-followup" className="text-muted-foreground">
										Next Follow-up
									</Label>
									<Input
										id="edit-followup"
										type="date"
										value={editLead.nextFollowUp}
										onChange={(e) =>
											setEditLead({
												...editLead,
												nextFollowUp: e.target.value,
											})
										}
										className="mt-1 bg-card border-border"
										data-testid="input-edit-lead-followup"
									/>
								</div>
							</div>
							<div>
								<Label htmlFor="edit-notes" className="text-muted-foreground">
									Notes
								</Label>
								<Textarea
									id="edit-notes"
									value={editLead.notes}
									onChange={(e) =>
										setEditLead({ ...editLead, notes: e.target.value })
									}
									className="mt-1 bg-card border-border"
									placeholder="Observations, client requirements, investment goals..."
									rows={3}
									data-testid="textarea-edit-lead-notes"
								/>
							</div>
							<div className="flex justify-end gap-3 pt-4">
								<Button
									variant="outline"
									onClick={() => setShowEditLead(false)}
									className="border-border"
								>
									Cancel
								</Button>
								<Button
									onClick={() => updateLeadMutation.mutate(editLead)}
									disabled={!editLead.name || updateLeadMutation.isPending}
									className="bg-emerald-600 hover:bg-emerald-700"
									data-testid="button-save-edit-lead"
								>
									{updateLeadMutation.isPending && (
										<Loader2 className="h-4 w-4 mr-2 animate-spin" />
									)}
									Save Changes
								</Button>
							</div>
						</div>
					</DialogContent>
				</Dialog>

				{/* Exotel Cloud Telephony Progressive Auto-Dialer Modal */}
				<AutoDialerModal
					isOpen={dialerOpen}
					onClose={() => setDialerOpen(false)}
					initialLead={dialerTargetLead}
					isQueueMode={isQueueMode}
				/>
			</div>
		</div>
	);
}
