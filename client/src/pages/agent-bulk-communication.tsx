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
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import {
	MessageSquare,
	Mail,
	Phone,
	Plus,
	Send,
	Eye,
	RefreshCw,
	Users,
	Filter,
	Calendar,
	Clock,
	CheckCircle,
	XCircle,
	AlertCircle,
	ChevronRight,
	ChevronLeft,
	Image,
	FileText,
	Loader2,
	BarChart3,
	TrendingUp,
	Share2,
	Copy,
	Check,
	Sparkles,
	Download,
	ExternalLink,
	Zap,
	Target,
	Award,
	ArrowUpRight,
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { LoadingState } from "@/components/LoadingState";
import { queryClient, apiRequest } from "@/lib/queryClient";
import {
	BarChart,
	Bar,
	XAxis,
	YAxis,
	CartesianGrid,
	Tooltip,
	ResponsiveContainer,
	PieChart,
	Pie,
	Cell,
} from "recharts";

interface Campaign {
	id: string;
	name: string;
	channel: "sms" | "email" | "whatsapp";
	status: "draft" | "scheduled" | "sending" | "sent" | "failed";
	recipientCount: number;
	sentCount: number;
	deliveredCount: number;
	readCount: number;
	failedCount: number;
	scheduledAt?: string;
	sentAt?: string;
	createdAt: string;
	message?: string;
	subject?: string;
	templateName?: string;
}

interface WhatsAppTemplate {
	id: string;
	name: string;
	language: string;
	category: "MARKETING" | "UTILITY" | "AUTHENTICATION";
	status: "APPROVED" | "PENDING" | "REJECTED";
	bodyText: string;
	headerType?: "TEXT" | "IMAGE" | "VIDEO" | "DOCUMENT";
	headerText?: string;
	footerText?: string;
	buttons?: Array<{ type: string; text: string }>;
	variables: string[];
}

interface Client {
	id: string;
	firstName: string;
	lastName: string;
	email: string;
	phone: string;
	kycStatus: string;
	investmentValue: number;
	lastInteraction?: string;
	tags?: string[];
	type?: "client" | "lead";
	tier?: string;
	stage?: string;
}

interface RecipientFilter {
	kycStatus?: string;
	minInvestmentValue?: number;
	maxInvestmentValue?: number;
	lastInteractionDays?: number;
	tags?: string[];
}

const CHART_COLORS = ["#10b981", "#3b82f6", "#f59e0b", "#ef4444"];

export default function AgentBulkCommunication() {
	const { toast } = useToast();
	const [isWizardOpen, setIsWizardOpen] = useState(false);
	const [wizardStep, setWizardStep] = useState(1);
	const [selectedChannel, setSelectedChannel] = useState<
		"sms" | "email" | "whatsapp"
	>("sms");
	const [campaignName, setCampaignName] = useState("");
	const [selectedRecipients, setSelectedRecipients] = useState<string[]>([]);
	const [recipientFilter, setRecipientFilter] = useState<RecipientFilter>({});
	const [messageContent, setMessageContent] = useState("");
	const [emailSubject, setEmailSubject] = useState("");
	const [selectedTemplate, setSelectedTemplate] =
		useState<WhatsAppTemplate | null>(null);
	const [templateVariables, setTemplateVariables] = useState<
		Record<string, string>
	>({});
	const [mediaUrl, setMediaUrl] = useState("");
	const [scheduleType, setScheduleType] = useState<"now" | "schedule">("now");
	const [scheduledDate, setScheduledDate] = useState("");
	const [scheduledTime, setScheduledTime] = useState("");
	const [selectAll, setSelectAll] = useState(false);
	const [targetAudienceType, setTargetAudienceType] = useState<"all" | "leads" | "clients">("all");

	// Marketing Studio Digital Acquisition & Lead Magnet States
	const { user } = useAuth();
	const [copiedPosterId, setCopiedPosterId] = useState<string | null>(null);
	const [copiedLeadMagnetLink, setCopiedLeadMagnetLink] = useState(false);
	const [selectedPosterCategory, setSelectedPosterCategory] = useState<string>("all");

	const partnerName = user
		? `${user.firstName || ""} ${user.lastName || ""}`.trim() || user.userId
		: "FintekPro Advisory Partner";
	const partnerPhone = user?.mobile || "";
	const partnerInitials =
		partnerName
			.split(" ")
			.map((n: string) => n[0])
			.join("")
			.slice(0, 2)
			.toUpperCase() || "FP";

	const leadMagnetUrl =
		typeof window !== "undefined"
			? `${window.location.origin}/tools/portfolio-xray?ref=${user?.id || user?.userId || "default"}`
			: "";

	const copyLeadMagnet = () => {
		navigator.clipboard.writeText(leadMagnetUrl);
		setCopiedLeadMagnetLink(true);
		toast({
			title: "Link Copied!",
			description: "Your personalized Portfolio X-Ray lead magnet link is copied to clipboard.",
		});
		setTimeout(() => setCopiedLeadMagnetLink(false), 2500);
	};

	const copyPosterCaption = (caption: string, id: string) => {
		navigator.clipboard.writeText(caption);
		setCopiedPosterId(id);
		toast({
			title: "Caption & Link Copied!",
			description: "Ready to paste into WhatsApp, LinkedIn, or Email.",
		});
		setTimeout(() => setCopiedPosterId(null), 2500);
	};

	const posterTemplates = useMemo(
		() => [
			{
				id: "sip-multiplier",
				title: "The 10% Step-Up SIP Multiplier",
				subtitle: "How an annual 10% bump turns ₹10k/mo into ₹2.1 Crore",
				category: "Wealth Creation",
				tagColor: "bg-emerald-500/10 text-emerald-400 border-emerald-500/30",
				highlightStat: "₹2.12 Cr vs ₹98L",
				statSub: "Over 15 Years @ 12% CAGR",
				keyPoints: [
					"Flat ₹10,000/mo SIP = ₹98 Lakhs",
					"10% Annual Step-Up SIP = ₹2.12 Crore",
					"Adds ₹1.14 Cr extra wealth with small salary hikes",
				],
				caption: `📈 Did you know? Increasing your monthly mutual fund SIP by just 10% every year more than DOUBLES your final wealth!\n\n💡 Flat ₹10k/mo SIP: ₹98 Lakhs\n🚀 10% Annual Step-Up: ₹2.12 Crore (₹1.14 Cr extra!)\n\nAudit your mutual fund portfolio and compounding roadmap for free with our 60-second Portfolio X-Ray:\n👉 ${leadMagnetUrl}\n\n— ${partnerName} | Financial Partner`,
			},
			{
				id: "market-dip",
				title: "Market Volatility: Risk or Secret Weapon?",
				subtitle: "Why 5%+ corrections historically deliver 15%+ multi-year XIRR",
				category: "Market Outlook",
				tagColor: "bg-blue-500/10 text-blue-400 border-blue-500/30",
				highlightStat: "+62% Average Rally",
				statSub: "Over 3 Years following major corrections",
				keyPoints: [
					"Every 5%+ Nifty dip historically rebounded to fresh all-time highs",
					"Panic redemptions turn paper drawdowns into permanent capital loss",
					"Opportunistic lumpsum deployments supercharge long-term alpha",
				],
				caption: `📉 Market Volatility: Should You Panic or Deploy?\n\nHistorically, every 5%+ correction in the Indian equity markets has presented generational compounding opportunities for long-term investors.\n\nBefore pausing SIPs or panic selling, run your portfolio through our health diagnostic:\n👉 ${leadMagnetUrl}\n\n— ${partnerName} | Financial Partner`,
			},
			{
				id: "fee-leakage",
				title: "Hidden Mutual Fund Commissions",
				subtitle: "Is your portfolio losing ₹14 Lakhs to Regular plan fees?",
				category: "Advisory Diagnostic",
				tagColor: "bg-red-500/10 text-red-400 border-red-500/30",
				highlightStat: "1.10% Annual Drag",
				statSub: "~₹14 Lakhs lost on ₹25L over 10 Years",
				keyPoints: [
					"Regular mutual funds charge trailing distributor commissions annually",
					"Direct / RIA advisory plans eliminate middleman deductions",
					"Compounding savings adds 1-2 years to early retirement",
				],
				caption: `🔬 Are you paying hidden distributor commissions on your mutual funds without knowing it?\n\nRegular mutual funds silently bleed ~1.0% to 1.25% in distributor trailing fees each year. On a ₹25L portfolio, that's over ₹14 Lakhs lost in 10 years!\n\nCheck your exact fee leakage in 60 seconds with our free diagnostic:\n👉 ${leadMagnetUrl}\n\n— ${partnerName} | Financial Partner`,
			},
			{
				id: "tax-harvesting",
				title: "LTCG 12.5% Tax Strategy Guide",
				subtitle: "How annual tax-loss harvesting saves ₹15,000+ every year",
				category: "Tax Strategy",
				tagColor: "bg-amber-500/10 text-amber-400 border-amber-500/30",
				highlightStat: "₹1.25L Tax Exemption",
				statSub: "Annual tax-free equity capital gains threshold",
				keyPoints: [
					"Union Budget revised Equity LTCG rate to 12.5% beyond ₹1.25L",
					"Harvest up to ₹1.25L unrealized profit each FY tax-free",
					"Offset equity capital gains against short-term losses",
				],
				caption: `⚖️ Union Budget Revised Equity LTCG to 12.5%.\n\nAre you taking advantage of the annual ₹1.25 Lakh tax-free profit exemption and systematic tax-loss harvesting before March 31?\n\nAudit your portfolio for tax-efficiency:\n👉 ${leadMagnetUrl}\n\n— ${partnerName} | Financial Partner`,
			},
			{
				id: "corporate-bonds",
				title: "Corporate Bonds vs Traditional FDs",
				subtitle: "Senior-secured debt yielding 9.5% to 11.2% with regular payouts",
				category: "Fixed Income",
				tagColor: "bg-purple-500/10 text-purple-400 border-purple-500/30",
				highlightStat: "9.5% - 11.2% Yield",
				statSub: "Senior Secured & Rated AA/AAA",
				keyPoints: [
					"Beats traditional bank FDs by 250–350 basis points",
					"Monthly or quarterly coupon credit directly to bank account",
					"Listed and tradeable on NSE/BSE secondary markets",
				],
				caption: `🏛️ Looking for higher fixed income returns than bank FDs?\n\nExplore curated Senior Secured Corporate Bonds & NCDs yielding 9.5% to 11.2% with regular quarterly or monthly payouts.\n\nDiscover curated debt opportunities:\n👉 ${leadMagnetUrl}\n\n— ${partnerName} | Financial Partner`,
			},
			{
				id: "hni-alternatives",
				title: "Beyond Nifty: AIFs & Pre-IPO Alpha",
				subtitle: "Exclusive wealth creation strategies for high-net-worth investors",
				category: "HNI Wealth",
				tagColor: "bg-yellow-500/10 text-yellow-400 border-yellow-500/30",
				highlightStat: "CAT-II & Pre-IPO",
				statSub: "Uncorrelated private market returns",
				keyPoints: [
					"Access to pre-IPO growth companies before exchange listing",
					"Private credit and long-short quantitative hedge strategies",
					"Curated deals with Institutional-grade diligence",
				],
				caption: `👑 Build generational wealth beyond standard mutual funds.\n\nExplore curated Category II & III Alternative Investment Funds (AIFs) and Pre-IPO high-growth companies with FintekPro Institutional Diligence.\n\nSchedule an exclusive HNI consultation:\n👉 ${leadMagnetUrl}\n\n— ${partnerName} | Financial Partner`,
			},
		],
		[leadMagnetUrl, partnerName],
	);

	const { data: campaigns, isLoading: campaignsLoading } = useQuery<Campaign[]>(
		{
			queryKey: ["/api/agent/campaigns"],
			queryFn: async () => {
				const response = await fetch("/api/agent/campaigns");
				if (!response.ok) {
					return [];
				}
				return response.json();
			},
		},
	);

	const { data: clients, isLoading: clientsLoading } = useQuery<Client[]>({
		queryKey: ["/api/agent/clients"],
		queryFn: async () => {
			const response = await fetch("/api/agent/clients");
			if (!response.ok) {
				return [];
			}
			return response.json();
		},
	});

	const { data: leadsResponse, isLoading: leadsLoading } = useQuery<{ success?: boolean; data?: any[] }>({
		queryKey: ["/api/agent/leads"],
		queryFn: async () => {
			const response = await fetch("/api/agent/leads");
			if (!response.ok) {
				return { success: false, data: [] };
			}
			return response.json();
		},
	});

	const { data: whatsappTemplates } = useQuery<WhatsAppTemplate[]>({
		queryKey: ["/api/marketing/whatsapp/templates"],
		queryFn: async () => {
			const response = await fetch("/api/marketing/whatsapp/templates");
			if (!response.ok) {
				return [];
			}
			return response.json();
		},
		enabled: selectedChannel === "whatsapp",
	});

	const allContacts = useMemo(() => {
		const list: Client[] = [];

		if (clients && Array.isArray(clients)) {
			for (const c of clients) {
				list.push({
					...c,
					type: "client",
				});
			}
		}

		const rawLeads = leadsResponse?.data;
		if (rawLeads && Array.isArray(rawLeads)) {
			for (const l of rawLeads) {
				const parts = (l.name || "Lead").trim().split(" ");
				list.push({
					id: String(l.id),
					firstName: parts[0] || l.name || "Lead",
					lastName: parts.slice(1).join(" ") || "",
					email: l.email || "",
					phone: l.phone || "",
					kycStatus: "Non-Client Lead",
					investmentValue: Number(l.potentialValue || 0),
					lastInteraction: l.createdAt,
					tags: [l.tier || "Lead", l.status || "new"],
					type: "lead",
					tier: l.tier,
					stage: l.status,
				});
			}
		}

		return list;
	}, [clients, leadsResponse]);

	const xrayLeads = useMemo(() => {
		const rawLeads = leadsResponse?.data || [];
		return rawLeads.filter(
			(l: any) =>
				l.source === "portfolio_xray_magnet" ||
				(l.tags && l.tags.includes("portfolio_xray")),
		);
	}, [leadsResponse]);

	const totalXRayTracked = useMemo(() => {
		return xrayLeads.reduce(
			(sum: number, l: any) => sum + (Number(l.potentialValue) || 0),
			0,
		);
	}, [xrayLeads]);

	const filteredClients = useMemo(() => {
		let list = allContacts;

		if (targetAudienceType === "leads") {
			list = list.filter((c) => c.type === "lead");
		} else if (targetAudienceType === "clients") {
			list = list.filter((c) => c.type === "client");
		}

		return list.filter((client) => {
			if (
				recipientFilter.kycStatus &&
				client.kycStatus !== recipientFilter.kycStatus
			) {
				return false;
			}
			if (
				recipientFilter.minInvestmentValue &&
				client.investmentValue < recipientFilter.minInvestmentValue
			) {
				return false;
			}
			if (
				recipientFilter.maxInvestmentValue &&
				client.investmentValue > recipientFilter.maxInvestmentValue
			) {
				return false;
			}
			if (recipientFilter.lastInteractionDays && client.lastInteraction) {
				const daysSinceInteraction = Math.floor(
					(Date.now() - new Date(client.lastInteraction).getTime()) /
						(1000 * 60 * 60 * 24),
				);
				if (daysSinceInteraction > recipientFilter.lastInteractionDays) {
					return false;
				}
			}
			if (recipientFilter.tags && recipientFilter.tags.length > 0) {
				if (
					!client.tags ||
					!recipientFilter.tags.some((tag) => client.tags?.includes(tag))
				) {
					return false;
				}
			}
			return true;
		});
	}, [allContacts, targetAudienceType, recipientFilter]);

	const campaignStats = useMemo(() => {
		if (!campaigns || !Array.isArray(campaigns) || campaigns.length === 0) {
			return {
				total: 0,
				sent: 0,
				delivered: 0,
				read: 0,
				failed: 0,
				deliveryRate: 0,
				readRate: 0,
			};
		}

		const total = campaigns.length;
		const sent = campaigns.reduce((sum, c) => sum + (c.sentCount || 0), 0);
		const delivered = campaigns.reduce(
			(sum, c) => sum + (c.deliveredCount || 0),
			0,
		);
		const read = campaigns.reduce((sum, c) => sum + (c.readCount || 0), 0);
		const failed = campaigns.reduce((sum, c) => sum + (c.failedCount || 0), 0);

		return {
			total,
			sent,
			delivered,
			read,
			failed,
			deliveryRate: sent > 0 ? ((delivered / sent) * 100).toFixed(1) : 0,
			readRate: delivered > 0 ? ((read / delivered) * 100).toFixed(1) : 0,
		};
	}, [campaigns]);

	const channelBreakdown = useMemo(() => {
		if (!campaigns || !Array.isArray(campaigns)) return [];

		const breakdown = { sms: 0, email: 0, whatsapp: 0 };
		campaigns.forEach((c) => {
			if (c.channel && breakdown.hasOwnProperty(c.channel)) {
				breakdown[c.channel]++;
			}
		});

		return [
			{ name: "SMS", value: breakdown.sms, color: "#10b981" },
			{ name: "Email", value: breakdown.email, color: "#3b82f6" },
			{ name: "WhatsApp", value: breakdown.whatsapp, color: "#22c55e" },
		].filter((item) => item.value > 0);
	}, [campaigns]);

	const performanceData = useMemo(() => {
		if (!campaigns || !Array.isArray(campaigns)) return [];

		return campaigns.slice(0, 5).map((c) => ({
			name:
				(c.name || "Campaign").substring(0, 15) +
				((c.name || "").length > 15 ? "..." : ""),
			sent: c.sentCount || 0,
			delivered: c.deliveredCount || 0,
			read: c.readCount || 0,
		}));
	}, [campaigns]);

	const createCampaignMutation = useMutation({
		mutationFn: async (data: any) => {
			const endpoint = `/api/agent/campaigns/${selectedChannel}`;
			return apiRequest(endpoint, "POST", data);
		},
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ["/api/agent/campaigns"] });
			resetWizard();
			toast({
				title: "Campaign created successfully",
				description:
					scheduleType === "now"
						? "Your campaign is being sent."
						: "Your campaign has been scheduled.",
			});
		},
		onError: () => {
			toast({
				title: "Failed to create campaign",
				variant: "destructive",
			});
		},
	});

	const syncAnalyticsMutation = useMutation({
		mutationFn: async (campaignId: string) => {
			return apiRequest(
				`/api/agent/campaigns/${campaignId}/sync-analytics`,
				"POST",
			);
		},
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ["/api/agent/campaigns"] });
			toast({ title: "Analytics synced successfully" });
		},
	});

	const resetWizard = () => {
		setIsWizardOpen(false);
		setWizardStep(1);
		setSelectedChannel("sms");
		setCampaignName("");
		setSelectedRecipients([]);
		setRecipientFilter({});
		setMessageContent("");
		setEmailSubject("");
		setSelectedTemplate(null);
		setTemplateVariables({});
		setMediaUrl("");
		setScheduleType("now");
		setScheduledDate("");
		setScheduledTime("");
		setSelectAll(false);
	};

	const handleSelectAll = (checked: boolean) => {
		setSelectAll(checked);
		if (checked) {
			setSelectedRecipients(filteredClients.map((c) => c.id));
		} else {
			setSelectedRecipients([]);
		}
	};

	const handleRecipientToggle = (clientId: string) => {
		setSelectedRecipients((prev) =>
			prev.includes(clientId)
				? prev.filter((id) => id !== clientId)
				: [...prev, clientId],
		);
	};

	const handleTemplateSelect = (templateName: string) => {
		const template =
			whatsappTemplates?.find((t) => t.name === templateName) || null;
		setSelectedTemplate(template);
		if (template) {
			const vars: Record<string, string> = {};
			template.variables.forEach((v, i) => {
				vars[`var${i + 1}`] = "";
			});
			setTemplateVariables(vars);
		}
	};

	const getPreviewMessage = () => {
		if (selectedChannel === "whatsapp" && selectedTemplate) {
			let preview = selectedTemplate.bodyText;
			Object.entries(templateVariables).forEach(([key, value], index) => {
				preview = preview.replace(
					`{{${index + 1}}}`,
					value || `{{${index + 1}}}`,
				);
			});
			return preview;
		}
		return messageContent;
	};

	const handleSubmitCampaign = () => {
		const recipients = selectedRecipients.map((id) => {
			const client = filteredClients.find((c) => c.id === id);
			return {
				id: client?.id,
				phone: client?.phone,
				email: client?.email,
				firstName: client?.firstName,
				lastName: client?.lastName,
			};
		});

		const payload: any = {
			name: campaignName,
			recipients,
			scheduledAt:
				scheduleType === "schedule"
					? `${scheduledDate}T${scheduledTime}`
					: undefined,
		};

		if (selectedChannel === "sms") {
			payload.message = messageContent;
		} else if (selectedChannel === "email") {
			payload.subject = emailSubject;
			payload.htmlContent = messageContent;
		} else if (selectedChannel === "whatsapp") {
			payload.templateName = selectedTemplate?.name;
			payload.bodyParams = Object.values(templateVariables);
			payload.mediaUrl = mediaUrl || undefined;
		}

		createCampaignMutation.mutate(payload);
	};

	const getChannelIcon = (channel: string) => {
		switch (channel) {
			case "sms":
				return <Phone className="h-4 w-4" />;
			case "email":
				return <Mail className="h-4 w-4" />;
			case "whatsapp":
				return <MessageSquare className="h-4 w-4" />;
			default:
				return <MessageSquare className="h-4 w-4" />;
		}
	};

	const getStatusBadge = (status: string) => {
		switch (status) {
			case "sent":
				return (
					<Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30">
						Sent
					</Badge>
				);
			case "sending":
				return (
					<Badge className="bg-blue-500/20 text-blue-400 border-blue-500/30">
						Sending
					</Badge>
				);
			case "scheduled":
				return (
					<Badge className="bg-amber-500/20 text-amber-400 border-amber-500/30">
						Scheduled
					</Badge>
				);
			case "failed":
				return (
					<Badge className="bg-red-500/20 text-red-400 border-red-500/30">
						Failed
					</Badge>
				);
			default:
				return <Badge variant="secondary">Draft</Badge>;
		}
	};

	if (campaignsLoading) {
		return <LoadingState variant="list" />;
	}

	return (
		<div className="space-y-6 p-6">
			<div className="flex justify-between items-center">
				<div>
					<h1 className="text-3xl font-bold tracking-tight text-foreground">
						Bulk Communication Hub
					</h1>
					<p className="text-muted-foreground">
						Create and manage SMS, Email, and WhatsApp campaigns
					</p>
				</div>
				<Dialog
					open={isWizardOpen}
					onOpenChange={(open) => {
						if (!open) resetWizard();
						else setIsWizardOpen(true);
					}}
				>
					<DialogTrigger asChild>
						<Button
							className="bg-emerald-600 hover:bg-emerald-700"
							data-testid="button-create-campaign"
						>
							<Plus className="mr-2 h-4 w-4" />
							Create Campaign
						</Button>
					</DialogTrigger>
					<DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden bg-background border-border">
						<DialogHeader>
							<DialogTitle className="text-foreground">
								Create New Campaign
							</DialogTitle>
							<DialogDescription className="text-muted-foreground">
								Step {wizardStep} of 5 -{" "}
								{wizardStep === 1
									? "Channel Selection"
									: wizardStep === 2
										? "Recipient Selection"
										: wizardStep === 3
											? "Message Composer"
											: wizardStep === 4
												? "Schedule"
												: "Preview & Confirm"}
							</DialogDescription>
						</DialogHeader>

						<Progress value={wizardStep * 20} className="h-2 bg-card" />

						<ScrollArea className="max-h-[60vh] pr-4">
							{wizardStep === 1 && (
								<div className="space-y-6 py-4">
									<div className="space-y-2">
										<Label
											htmlFor="campaignName"
											className="text-muted-foreground"
										>
											Campaign Name
										</Label>
										<Input
											id="campaignName"
											value={campaignName}
											onChange={(e) => setCampaignName(e.target.value)}
											placeholder="Q4 Investment Updates"
											className="bg-card border-border text-foreground"
											data-testid="input-campaign-name"
										/>
									</div>

									<div className="space-y-3">
										<Label className="text-muted-foreground">
											Select Channel
										</Label>
										<div className="grid grid-cols-3 gap-4">
											{[
												{
													id: "sms",
													label: "SMS",
													icon: Phone,
													description: "Direct text messages",
												},
												{
													id: "email",
													label: "Email",
													icon: Mail,
													description: "Rich email campaigns",
												},
												{
													id: "whatsapp",
													label: "WhatsApp",
													icon: MessageSquare,
													description: "Template-based messages",
												},
											].map((channel) => (
												<button
													type="button"
													key={channel.id}
													onClick={() =>
														setSelectedChannel(
															channel.id as "sms" | "email" | "whatsapp",
														)
													}
													className={`text-left w-full cursor-pointer rounded-lg border-2 p-4 transition-all ${
														selectedChannel === channel.id
															? "border-emerald-500 bg-emerald-500/10"
															: "border-border hover:border-border bg-card"
													}`}
													data-testid={`channel-${channel.id}`}
												>
													<channel.icon
														className={`h-8 w-8 mb-2 ${selectedChannel === channel.id ? "text-emerald-500" : "text-muted-foreground"}`}
													/>
													<h3 className="font-semibold text-foreground">
														{channel.label}
													</h3>
													<p className="text-xs text-muted-foreground">
														{channel.description}
													</p>
												</button>
											))}
										</div>
									</div>
								</div>
							)}

							{wizardStep === 2 && (
								<div className="space-y-6 py-4">
									{/* Audience Segment Switcher */}
									<div className="flex flex-wrap items-center gap-2 p-1.5 bg-card/60 rounded-lg border border-border">
										<button
											type="button"
											onClick={() => setTargetAudienceType("all")}
											className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all ${
												targetAudienceType === "all"
													? "bg-emerald-600 text-white shadow-sm"
													: "text-muted-foreground hover:text-foreground hover:bg-muted"
											}`}
										>
											All Contacts ({allContacts.length})
										</button>
										<button
											type="button"
											onClick={() => setTargetAudienceType("leads")}
											className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all ${
												targetAudienceType === "leads"
													? "bg-amber-600 text-white shadow-sm"
													: "text-muted-foreground hover:text-foreground hover:bg-muted"
											}`}
										>
											🎯 Non-Client Leads ({allContacts.filter((c) => c.type === "lead").length})
										</button>
										<button
											type="button"
											onClick={() => setTargetAudienceType("clients")}
											className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all ${
												targetAudienceType === "clients"
													? "bg-blue-600 text-white shadow-sm"
													: "text-muted-foreground hover:text-foreground hover:bg-muted"
											}`}
										>
											👥 Active Clients ({allContacts.filter((c) => c.type === "client").length})
										</button>
									</div>

									<div className="grid grid-cols-2 gap-4">
										<div className="space-y-2">
											<Label className="text-muted-foreground">
												KYC Status
											</Label>
											<Select
												value={recipientFilter.kycStatus || "all"}
												onValueChange={(v) =>
													setRecipientFilter((prev) => ({
														...prev,
														kycStatus: v === "all" ? undefined : v,
													}))
												}
											>
												<SelectTrigger
													className="bg-card border-border text-foreground"
													data-testid="select-kyc-status"
												>
													<SelectValue placeholder="All statuses" />
												</SelectTrigger>
												<SelectContent className="bg-card border-border">
													<SelectItem value="all">All Statuses</SelectItem>
													<SelectItem value="verified">Verified</SelectItem>
													<SelectItem value="pending">Pending</SelectItem>
													<SelectItem value="incomplete">Incomplete</SelectItem>
												</SelectContent>
											</Select>
										</div>

										<div className="space-y-2">
											<Label className="text-muted-foreground">
												Last Interaction (days)
											</Label>
											<Select
												value={
													recipientFilter.lastInteractionDays?.toString() ||
													"all"
												}
												onValueChange={(v) =>
													setRecipientFilter((prev) => ({
														...prev,
														lastInteractionDays:
															v === "all" ? undefined : Number.parseInt(v),
													}))
												}
											>
												<SelectTrigger
													className="bg-card border-border text-foreground"
													data-testid="select-interaction"
												>
													<SelectValue placeholder="Any time" />
												</SelectTrigger>
												<SelectContent className="bg-card border-border">
													<SelectItem value="all">Any Time</SelectItem>
													<SelectItem value="7">Last 7 days</SelectItem>
													<SelectItem value="30">Last 30 days</SelectItem>
													<SelectItem value="90">Last 90 days</SelectItem>
													<SelectItem value="180">Last 6 months</SelectItem>
												</SelectContent>
											</Select>
										</div>

										<div className="space-y-2">
											<Label className="text-muted-foreground">
												Min Investment Value (₹)
											</Label>
											<Input
												type="number"
												placeholder="0"
												value={recipientFilter.minInvestmentValue || ""}
												onChange={(e) =>
													setRecipientFilter((prev) => ({
														...prev,
														minInvestmentValue: e.target.value
															? Number.parseInt(e.target.value)
															: undefined,
													}))
												}
												className="bg-card border-border text-foreground"
												data-testid="input-min-investment"
											/>
										</div>

										<div className="space-y-2">
											<Label className="text-muted-foreground">
												Max Investment Value (₹)
											</Label>
											<Input
												type="number"
												placeholder="No limit"
												value={recipientFilter.maxInvestmentValue || ""}
												onChange={(e) =>
													setRecipientFilter((prev) => ({
														...prev,
														maxInvestmentValue: e.target.value
															? Number.parseInt(e.target.value)
															: undefined,
													}))
												}
												className="bg-card border-border text-foreground"
												data-testid="input-max-investment"
											/>
										</div>
									</div>

									<Separator className="bg-muted" />

									<div className="flex items-center justify-between">
										<div className="flex items-center gap-2">
											<Checkbox
												id="selectAll"
												checked={selectAll}
												onCheckedChange={handleSelectAll}
												className="border-border"
												data-testid="checkbox-select-all"
											/>
											<Label
												htmlFor="selectAll"
												className="text-muted-foreground"
											>
												Select All ({filteredClients.length} recipients)
											</Label>
										</div>
										<Badge
											variant="outline"
											className="text-emerald-400 border-emerald-500/50"
										>
											{selectedRecipients.length} selected
										</Badge>
									</div>

									<ScrollArea className="h-64 rounded border border-border">
										<div className="p-2 space-y-2">
											{clientsLoading ? (
												<div className="flex items-center justify-center py-8">
													<Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
												</div>
											) : filteredClients.length === 0 ? (
												<div className="text-center py-8 text-muted-foreground">
													<Users className="h-8 w-8 mx-auto mb-2" />
													<p>No clients match your filters</p>
												</div>
											) : (
												filteredClients.map((client) => (
													<button
														type="button"
														key={client.id}
														className={`w-full text-left flex items-center gap-3 p-3 rounded-lg cursor-pointer transition-colors ${
															selectedRecipients.includes(client.id)
																? "bg-emerald-500/10 border border-emerald-500/30"
																: "bg-card hover:bg-muted"
														}`}
														onClick={() => handleRecipientToggle(client.id)}
														data-testid={`recipient-${client.id}`}
													>
														<Checkbox
															checked={selectedRecipients.includes(client.id)}
															className="border-border"
														/>
														<div className="flex-1">
															<div className="flex items-center gap-2">
																<p className="font-medium text-foreground">
																	{client.firstName} {client.lastName}
																</p>
																{client.type === "lead" ? (
																	<Badge className="bg-amber-500/10 text-amber-400 border-amber-500/30 text-[10px] py-0 px-1.5">
																		Lead
																	</Badge>
																) : (
																	<Badge className="bg-blue-500/10 text-blue-400 border-blue-500/30 text-[10px] py-0 px-1.5">
																		Client
																	</Badge>
																)}
																{client.tier && (
																	<span className="text-[10px] font-semibold text-amber-300">
																		{client.tier}
																	</span>
																)}
															</div>
															<p className="text-xs text-muted-foreground">
																{client.email || "No email"} • {client.phone || "No phone"}
																{client.stage && ` • ${client.stage}`}
															</p>
														</div>
														<Badge variant="outline" className="text-xs">
															{client.type === "lead"
																? (client.investmentValue ? `₹${(client.investmentValue / 100000).toFixed(1)}L Est` : "Lead")
																: `₹${(client.investmentValue / 100000).toFixed(1)}L`}
														</Badge>
													</button>
												))
											)}
										</div>
									</ScrollArea>
								</div>
							)}

							{wizardStep === 3 && (
								<div className="space-y-6 py-4">
									{selectedChannel === "whatsapp" ? (
										<>
											<div className="space-y-2">
												<Label className="text-muted-foreground">
													Select Template
												</Label>
												<Select
													onValueChange={handleTemplateSelect}
													data-testid="select-template"
												>
													<SelectTrigger className="bg-card border-border text-foreground">
														<SelectValue placeholder="Choose a WhatsApp template" />
													</SelectTrigger>
													<SelectContent className="bg-card border-border">
														{whatsappTemplates
															?.filter((t) => t.status === "APPROVED")
															.map((template) => (
																<SelectItem
																	key={template.id}
																	value={template.name}
																>
																	<div className="flex items-center gap-2">
																		<span>{template.name}</span>
																		<Badge
																			variant="outline"
																			className="text-xs"
																		>
																			{template.category}
																		</Badge>
																	</div>
																</SelectItem>
															))}
													</SelectContent>
												</Select>
											</div>

											{selectedTemplate && (
												<>
													<div className="p-4 bg-card rounded-lg border border-border">
														<h4 className="font-medium text-foreground mb-2">
															Template Preview
														</h4>
														<p className="text-muted-foreground whitespace-pre-wrap">
															{selectedTemplate.bodyText}
														</p>
														{selectedTemplate.footerText && (
															<p className="text-xs text-muted-foreground mt-2">
																{selectedTemplate.footerText}
															</p>
														)}
													</div>

													{selectedTemplate.variables.length > 0 && (
														<div className="space-y-4">
															<Label className="text-muted-foreground">
																Variable Substitution
															</Label>
															{selectedTemplate.variables.map(
																(variable, index) => (
																	<div key={index} className="space-y-1">
																		<Label className="text-xs text-muted-foreground">
																			{`{{${index + 1}}}`} - {variable}
																		</Label>
																		<Input
																			placeholder={`Value for ${variable}`}
																			value={
																				templateVariables[`var${index + 1}`] ||
																				""
																			}
																			onChange={(e) =>
																				setTemplateVariables((prev) => ({
																					...prev,
																					[`var${index + 1}`]: e.target.value,
																				}))
																			}
																			className="bg-card border-border text-foreground"
																			data-testid={`input-var-${index + 1}`}
																		/>
																	</div>
																),
															)}
														</div>
													)}

													{selectedTemplate.headerType &&
														selectedTemplate.headerType !== "TEXT" && (
															<div className="space-y-2">
																<Label className="text-muted-foreground flex items-center gap-2">
																	<Image className="h-4 w-4" />
																	Media URL (
																	{selectedTemplate.headerType.toLowerCase()})
																</Label>
																<Input
																	type="url"
																	placeholder="https://example.com/media.jpg"
																	value={mediaUrl}
																	onChange={(e) => setMediaUrl(e.target.value)}
																	className="bg-card border-border text-foreground"
																	data-testid="input-media-url"
																/>
															</div>
														)}
												</>
											)}
										</>
									) : selectedChannel === "email" ? (
										<>
											<div className="space-y-2">
												<Label className="text-muted-foreground">
													Email Subject
												</Label>
												<Input
													value={emailSubject}
													onChange={(e) => setEmailSubject(e.target.value)}
													placeholder="Important Update: Your Investment Portfolio"
													className="bg-card border-border text-foreground"
													data-testid="input-email-subject"
												/>
											</div>
											<div className="space-y-2">
												<Label className="text-muted-foreground">
													Email Content (HTML)
												</Label>
												<Textarea
													value={messageContent}
													onChange={(e) => setMessageContent(e.target.value)}
													placeholder="<html><body><h1>Hello {{firstName}},</h1><p>Your message here...</p></body></html>"
													rows={12}
													className="bg-card border-border text-foreground font-mono text-sm"
													data-testid="textarea-email-content"
												/>
												<p className="text-xs text-muted-foreground">
													Variables: {"{{firstName}}"}, {"{{lastName}}"},{" "}
													{"{{email}}"}
												</p>
											</div>
										</>
									) : (
										<div className="space-y-2">
											<Label className="text-muted-foreground">
												SMS Message
											</Label>
											<Textarea
												value={messageContent}
												onChange={(e) => setMessageContent(e.target.value)}
												placeholder="Hi {{firstName}}, your investment portfolio has grown by 12% this month! View details at fintekpro.com/portfolio"
												rows={6}
												className="bg-card border-border text-foreground"
												data-testid="textarea-sms-content"
											/>
											<div className="flex justify-between text-xs text-muted-foreground">
												<span>
													Variables: {"{{firstName}}"}, {"{{lastName}}"}
												</span>
												<span>{messageContent.length}/160 characters</span>
											</div>
										</div>
									)}
								</div>
							)}

							{wizardStep === 4 && (
								<div className="space-y-6 py-4">
									<div className="space-y-3">
										<Label className="text-muted-foreground">
											When to send?
										</Label>
										<div className="grid grid-cols-2 gap-4">
											<button
												type="button"
												onClick={() => setScheduleType("now")}
												className={`text-left w-full cursor-pointer rounded-lg border-2 p-4 transition-all ${
													scheduleType === "now"
														? "border-emerald-500 bg-emerald-500/10"
														: "border-border hover:border-border bg-card"
												}`}
												data-testid="schedule-now"
											>
												<Send
													className={`h-8 w-8 mb-2 ${scheduleType === "now" ? "text-emerald-500" : "text-muted-foreground"}`}
												/>
												<h3 className="font-semibold text-foreground">
													Send Immediately
												</h3>
												<p className="text-xs text-muted-foreground">
													Campaign will be sent right away
												</p>
											</button>
											<button
												type="button"
												onClick={() => setScheduleType("schedule")}
												className={`text-left w-full cursor-pointer rounded-lg border-2 p-4 transition-all ${
													scheduleType === "schedule"
														? "border-emerald-500 bg-emerald-500/10"
														: "border-border hover:border-border bg-card"
												}`}
												data-testid="schedule-later"
											>
												<Calendar
													className={`h-8 w-8 mb-2 ${scheduleType === "schedule" ? "text-emerald-500" : "text-muted-foreground"}`}
												/>
												<h3 className="font-semibold text-foreground">
													Schedule for Later
												</h3>
												<p className="text-xs text-muted-foreground">
													Choose date and time
												</p>
											</button>
										</div>
									</div>

									{scheduleType === "schedule" && (
										<div className="grid grid-cols-2 gap-4">
											<div className="space-y-2">
												<Label className="text-muted-foreground">Date</Label>
												<Input
													type="date"
													value={scheduledDate}
													onChange={(e) => setScheduledDate(e.target.value)}
													className="bg-card border-border text-foreground"
													data-testid="input-schedule-date"
												/>
											</div>
											<div className="space-y-2">
												<Label className="text-muted-foreground">Time</Label>
												<Input
													type="time"
													value={scheduledTime}
													onChange={(e) => setScheduledTime(e.target.value)}
													className="bg-card border-border text-foreground"
													data-testid="input-schedule-time"
												/>
											</div>
										</div>
									)}
								</div>
							)}

							{wizardStep === 5 && (
								<div className="space-y-6 py-4">
									<Card className="bg-card border-border">
										<CardHeader className="pb-3">
											<CardTitle className="text-lg text-foreground flex items-center gap-2">
												<Eye className="h-5 w-5 text-emerald-500" />
												Campaign Summary
											</CardTitle>
										</CardHeader>
										<CardContent className="space-y-4">
											<div className="grid grid-cols-2 gap-4 text-sm">
												<div>
													<span className="text-muted-foreground">
														Campaign Name:
													</span>
													<p className="font-medium text-foreground">
														{campaignName}
													</p>
												</div>
												<div>
													<span className="text-muted-foreground">
														Channel:
													</span>
													<p className="font-medium text-foreground capitalize flex items-center gap-2">
														{getChannelIcon(selectedChannel)} {selectedChannel}
													</p>
												</div>
												<div>
													<span className="text-muted-foreground">
														Recipients:
													</span>
													<p className="font-medium text-foreground">
														{selectedRecipients.length} clients
													</p>
												</div>
												<div>
													<span className="text-muted-foreground">
														Schedule:
													</span>
													<p className="font-medium text-foreground">
														{scheduleType === "now"
															? "Send Immediately"
															: `${scheduledDate} at ${scheduledTime}`}
													</p>
												</div>
											</div>

											<Separator className="bg-muted" />

											<div>
												<span className="text-muted-foreground text-sm">
													Message Preview:
												</span>
												<div className="mt-2 p-3 bg-background rounded-lg border border-border">
													{selectedChannel === "email" && emailSubject && (
														<p className="font-medium text-foreground mb-2">
															Subject: {emailSubject}
														</p>
													)}
													<p className="text-muted-foreground whitespace-pre-wrap text-sm">
														{getPreviewMessage() || "No message content"}
													</p>
												</div>
											</div>
										</CardContent>
									</Card>
								</div>
							)}
						</ScrollArea>

						<div className="flex justify-between pt-4 border-t border-border">
							<Button
								variant="outline"
								onClick={() =>
									wizardStep > 1 ? setWizardStep(wizardStep - 1) : resetWizard()
								}
								className="border-border text-muted-foreground"
								data-testid="button-wizard-back"
							>
								<ChevronLeft className="mr-2 h-4 w-4" />
								{wizardStep === 1 ? "Cancel" : "Back"}
							</Button>

							{wizardStep < 5 ? (
								<Button
									onClick={() => setWizardStep(wizardStep + 1)}
									disabled={
										(wizardStep === 1 && !campaignName) ||
										(wizardStep === 2 && selectedRecipients.length === 0) ||
										(wizardStep === 3 &&
											selectedChannel === "whatsapp" &&
											!selectedTemplate) ||
										(wizardStep === 3 &&
											selectedChannel !== "whatsapp" &&
											!messageContent) ||
										(wizardStep === 4 &&
											scheduleType === "schedule" &&
											(!scheduledDate || !scheduledTime))
									}
									className="bg-emerald-600 hover:bg-emerald-700"
									data-testid="button-wizard-next"
								>
									Next
									<ChevronRight className="ml-2 h-4 w-4" />
								</Button>
							) : (
								<Button
									onClick={handleSubmitCampaign}
									disabled={createCampaignMutation.isPending}
									className="bg-emerald-600 hover:bg-emerald-700"
									data-testid="button-wizard-submit"
								>
									{createCampaignMutation.isPending ? (
										<Loader2 className="mr-2 h-4 w-4 animate-spin" />
									) : (
										<Send className="mr-2 h-4 w-4" />
									)}
									{scheduleType === "now"
										? "Send Campaign"
										: "Schedule Campaign"}
								</Button>
							)}
						</div>
					</DialogContent>
				</Dialog>
			</div>

			<Tabs defaultValue="dashboard" className="space-y-6">
				<TabsList className="bg-card border-border flex flex-wrap h-auto p-1 gap-1">
					<TabsTrigger
						value="dashboard"
						className="data-[state=active]:bg-emerald-600"
						data-testid="tab-dashboard"
					>
						<BarChart3 className="mr-2 h-4 w-4" />
						Dashboard
					</TabsTrigger>
					<TabsTrigger
						value="campaigns"
						className="data-[state=active]:bg-emerald-600"
						data-testid="tab-campaigns"
					>
						<MessageSquare className="mr-2 h-4 w-4" />
						Campaigns
					</TabsTrigger>
					<TabsTrigger
						value="posters"
						className="data-[state=active]:bg-emerald-600"
						data-testid="tab-posters"
					>
						<Sparkles className="mr-2 h-4 w-4 text-amber-400" />
						Co-Branded Poster Studio
					</TabsTrigger>
					<TabsTrigger
						value="xray-magnet"
						className="data-[state=active]:bg-emerald-600"
						data-testid="tab-xray-magnet"
					>
						<Target className="mr-2 h-4 w-4 text-blue-400" />
						Portfolio X-Ray Magnet
					</TabsTrigger>
					<TabsTrigger
						value="flash-broadcasts"
						className="data-[state=active]:bg-emerald-600"
						data-testid="tab-flash-broadcasts"
					>
						<Zap className="mr-2 h-4 w-4 text-purple-400" />
						Market Flash Broadcasts
					</TabsTrigger>
				</TabsList>

				<TabsContent value="dashboard" className="space-y-6">
					<div className="grid gap-4 md:grid-cols-4">
						<Card className="bg-card border-border">
							<CardHeader className="pb-2">
								<CardTitle className="text-sm font-medium text-muted-foreground">
									Total Campaigns
								</CardTitle>
							</CardHeader>
							<CardContent>
								<div
									className="text-2xl font-bold text-foreground"
									data-testid="text-total-campaigns"
								>
									{campaignStats.total}
								</div>
							</CardContent>
						</Card>

						<Card className="bg-card border-border">
							<CardHeader className="pb-2">
								<CardTitle className="text-sm font-medium text-muted-foreground">
									Messages Sent
								</CardTitle>
							</CardHeader>
							<CardContent>
								<div
									className="text-2xl font-bold text-foreground"
									data-testid="text-total-sent"
								>
									{campaignStats.sent.toLocaleString()}
								</div>
							</CardContent>
						</Card>

						<Card className="bg-card border-border">
							<CardHeader className="pb-2">
								<CardTitle className="text-sm font-medium text-muted-foreground">
									Delivery Rate
								</CardTitle>
							</CardHeader>
							<CardContent>
								<div
									className="text-2xl font-bold text-emerald-500"
									data-testid="text-delivery-rate"
								>
									{campaignStats.deliveryRate}%
								</div>
							</CardContent>
						</Card>

						<Card className="bg-card border-border">
							<CardHeader className="pb-2">
								<CardTitle className="text-sm font-medium text-muted-foreground">
									Read Rate
								</CardTitle>
							</CardHeader>
							<CardContent>
								<div
									className="text-2xl font-bold text-emerald-500"
									data-testid="text-read-rate"
								>
									{campaignStats.readRate}%
								</div>
							</CardContent>
						</Card>
					</div>

					<div className="grid gap-6 md:grid-cols-2">
						<Card className="bg-card border-border">
							<CardHeader>
								<CardTitle className="text-foreground">
									Campaign Performance
								</CardTitle>
								<CardDescription className="text-muted-foreground">
									Recent campaign metrics
								</CardDescription>
							</CardHeader>
							<CardContent>
								{performanceData.length > 0 ? (
									<ResponsiveContainer width="100%" height={250}>
										<BarChart data={performanceData}>
											<CartesianGrid strokeDasharray="3 3" stroke="#374151" />
											<XAxis
												dataKey="name"
												tick={{ fill: "#9ca3af", fontSize: 12 }}
											/>
											<YAxis tick={{ fill: "#9ca3af", fontSize: 12 }} />
											<Tooltip
												contentStyle={{
													backgroundColor: "#1e293b",
													border: "1px solid #374151",
													borderRadius: "8px",
												}}
												labelStyle={{ color: "#fff" }}
											/>
											<Bar dataKey="sent" fill="#3b82f6" name="Sent" />
											<Bar
												dataKey="delivered"
												fill="#10b981"
												name="Delivered"
											/>
											<Bar dataKey="read" fill="#22c55e" name="Read" />
										</BarChart>
									</ResponsiveContainer>
								) : (
									<div className="flex items-center justify-center h-64 text-muted-foreground">
										<div className="text-center">
											<TrendingUp className="h-12 w-12 mx-auto mb-2 opacity-50" />
											<p>No campaign data yet</p>
										</div>
									</div>
								)}
							</CardContent>
						</Card>

						<Card className="bg-card border-border">
							<CardHeader>
								<CardTitle className="text-foreground">
									Channel Distribution
								</CardTitle>
								<CardDescription className="text-muted-foreground">
									Campaigns by channel type
								</CardDescription>
							</CardHeader>
							<CardContent>
								{channelBreakdown.length > 0 ? (
									<ResponsiveContainer width="100%" height={250}>
										<PieChart>
											<Pie
												data={channelBreakdown}
												cx="50%"
												cy="50%"
												innerRadius={60}
												outerRadius={80}
												paddingAngle={5}
												dataKey="value"
												label={({ name, value }) => `${name}: ${value}`}
											>
												{channelBreakdown.map((entry, index) => (
													<Cell key={`cell-${index}`} fill={entry.color} />
												))}
											</Pie>
											<Tooltip
												contentStyle={{
													backgroundColor: "#1e293b",
													border: "1px solid #374151",
													borderRadius: "8px",
												}}
											/>
										</PieChart>
									</ResponsiveContainer>
								) : (
									<div className="flex items-center justify-center h-64 text-muted-foreground">
										<div className="text-center">
											<MessageSquare className="h-12 w-12 mx-auto mb-2 opacity-50" />
											<p>No campaigns created yet</p>
										</div>
									</div>
								)}
							</CardContent>
						</Card>
					</div>
				</TabsContent>

				<TabsContent value="campaigns" className="space-y-4">
					<Card className="bg-card border-border">
						<CardHeader>
							<CardTitle className="text-foreground">All Campaigns</CardTitle>
							<CardDescription className="text-muted-foreground">
								Manage and track your communication campaigns
							</CardDescription>
						</CardHeader>
						<CardContent>
							{!campaigns || campaigns.length === 0 ? (
								<div className="text-center py-12">
									<MessageSquare className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
									<p className="text-muted-foreground mb-4">No campaigns yet</p>
									<Button
										onClick={() => setIsWizardOpen(true)}
										className="bg-emerald-600 hover:bg-emerald-700"
										data-testid="button-create-first"
									>
										<Plus className="mr-2 h-4 w-4" />
										Create Your First Campaign
									</Button>
								</div>
							) : (
								<div className="space-y-4">
									{campaigns.map((campaign) => (
										<div
											key={campaign.id}
											className="border border-border rounded-lg p-4 hover:bg-muted transition-colors"
											data-testid={`campaign-${campaign.id}`}
										>
											<div className="flex items-start justify-between">
												<div className="flex-1">
													<div className="flex items-center gap-2 mb-2">
														<span
															className={`p-1.5 rounded ${
																campaign.channel === "sms"
																	? "bg-emerald-500/20 text-emerald-400"
																	: campaign.channel === "email"
																		? "bg-blue-500/20 text-blue-400"
																		: "bg-green-500/20 text-green-400"
															}`}
														>
															{getChannelIcon(campaign.channel)}
														</span>
														<h3
															className="font-semibold text-foreground"
															data-testid={`text-campaign-name-${campaign.id}`}
														>
															{campaign.name}
														</h3>
														{getStatusBadge(campaign.status)}
													</div>
													<p className="text-sm text-muted-foreground">
														{campaign.recipientCount} recipients • Created{" "}
														{new Date(campaign.createdAt).toLocaleDateString()}
													</p>
												</div>

												<div className="flex items-center gap-2">
													{(campaign.status === "sent" ||
														campaign.status === "sending") && (
														<Button
															size="sm"
															variant="outline"
															onClick={() =>
																syncAnalyticsMutation.mutate(campaign.id)
															}
															disabled={syncAnalyticsMutation.isPending}
															className="border-border text-muted-foreground"
															data-testid={`button-sync-${campaign.id}`}
														>
															<RefreshCw className="mr-2 h-4 w-4" />
															Sync
														</Button>
													)}
												</div>
											</div>

											{campaign.sentCount > 0 && (
												<div className="mt-4 grid grid-cols-4 gap-4 pt-4 border-t border-border">
													<div className="text-center">
														<Send className="h-4 w-4 mx-auto mb-1 text-muted-foreground" />
														<p className="text-lg font-semibold text-foreground">
															{campaign.sentCount}
														</p>
														<p className="text-xs text-muted-foreground">
															Sent
														</p>
													</div>
													<div className="text-center">
														<CheckCircle className="h-4 w-4 mx-auto mb-1 text-emerald-400" />
														<p className="text-lg font-semibold text-foreground">
															{campaign.deliveredCount}
															<span className="text-xs text-muted-foreground ml-1">
																(
																{campaign.sentCount > 0
																	? (
																			(campaign.deliveredCount /
																				campaign.sentCount) *
																			100
																		).toFixed(1)
																	: 0}
																%)
															</span>
														</p>
														<p className="text-xs text-muted-foreground">
															Delivered
														</p>
													</div>
													<div className="text-center">
														<Eye className="h-4 w-4 mx-auto mb-1 text-blue-400" />
														<p className="text-lg font-semibold text-foreground">
															{campaign.readCount}
															<span className="text-xs text-muted-foreground ml-1">
																(
																{campaign.deliveredCount > 0
																	? (
																			(campaign.readCount /
																				campaign.deliveredCount) *
																			100
																		).toFixed(1)
																	: 0}
																%)
															</span>
														</p>
														<p className="text-xs text-muted-foreground">
															Read
														</p>
													</div>
													<div className="text-center">
														<XCircle className="h-4 w-4 mx-auto mb-1 text-red-400" />
														<p className="text-lg font-semibold text-foreground">
															{campaign.failedCount}
															<span className="text-xs text-muted-foreground ml-1">
																(
																{campaign.sentCount > 0
																	? (
																			(campaign.failedCount /
																				campaign.sentCount) *
																			100
																		).toFixed(1)
																	: 0}
																%)
															</span>
														</p>
														<p className="text-xs text-muted-foreground">
															Failed
														</p>
													</div>
												</div>
											)}
										</div>
									))}
								</div>
							)}
						</CardContent>
					</Card>
				</TabsContent>

				{/* 🎨 Co-Branded Poster Studio (AssetPlus / NJ Wealth Style) */}
				<TabsContent value="posters" className="space-y-6">
					<Card className="bg-card border-border">
						<CardHeader>
							<div className="flex items-center justify-between flex-wrap gap-4">
								<div>
									<CardTitle className="text-xl flex items-center gap-2">
										<Sparkles className="h-5 w-5 text-amber-400" />
										Co-Branded Social & WhatsApp Poster Studio
									</CardTitle>
									<CardDescription>
										Curated, compliance-reviewed financial cards co-branded with your Name, Phone, and Lead Magnet link for instant sharing.
									</CardDescription>
								</div>
								<div className="flex items-center gap-2">
									<Button
										size="sm"
										variant="outline"
										onClick={copyLeadMagnet}
										className="border-emerald-500/40 text-emerald-500 hover:bg-emerald-500/10"
									>
										{copiedLeadMagnetLink ? (
											<>
												<Check className="h-3.5 w-3.5 mr-1" />
												Copied X-Ray Link
											</>
										) : (
											<>
												<Copy className="h-3.5 w-3.5 mr-1" />
												Copy Lead Magnet Link
											</>
										)}
									</Button>
								</div>
							</div>
						</CardHeader>
						<CardContent className="space-y-6">
							{/* Category Filters */}
							<div className="flex items-center gap-1.5 flex-wrap">
								{["all", "Wealth Creation", "Market Outlook", "Advisory Diagnostic", "Tax Strategy", "Fixed Income", "HNI Wealth"].map(
									(cat) => (
										<Button
											key={cat}
											size="sm"
											variant={selectedPosterCategory === cat ? "default" : "outline"}
											onClick={() => setSelectedPosterCategory(cat)}
											className={`text-xs h-7 ${
												selectedPosterCategory === cat
													? "bg-emerald-600 text-white"
													: "border-border text-muted-foreground"
											}`}
										>
											{cat === "all" ? "All Creatives" : cat}
										</Button>
									),
								)}
							</div>

							{/* Poster Cards Grid */}
							<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
								{posterTemplates
									.filter(
										(p) =>
											selectedPosterCategory === "all" ||
											p.category === selectedPosterCategory,
									)
									.map((poster) => (
										<div
											key={poster.id}
											className="rounded-xl border border-border bg-gradient-to-b from-card to-muted/20 p-5 flex flex-col justify-between shadow-sm hover:shadow-md transition-all space-y-4"
										>
											<div className="space-y-3">
												{/* Category & Title */}
												<div className="flex items-center justify-between">
													<Badge
														variant="outline"
														className={`text-xs font-semibold ${poster.tagColor}`}
													>
														{poster.category}
													</Badge>
													<span className="text-[10px] text-muted-foreground uppercase tracking-wider">
														SEBI Compliant
													</span>
												</div>
												<div>
													<h4 className="font-bold text-foreground text-base leading-snug">
														{poster.title}
													</h4>
													<p className="text-xs text-muted-foreground mt-0.5">
														{poster.subtitle}
													</p>
												</div>

												{/* Big Stat Box */}
												<div className="p-3 rounded-lg bg-background/80 border border-border text-center space-y-0.5">
													<div className="text-2xl font-black text-emerald-400">
														{poster.highlightStat}
													</div>
													<div className="text-[11px] text-muted-foreground">
														{poster.statSub}
													</div>
												</div>

												{/* Key Bullet Points */}
												<div className="space-y-1.5 text-xs text-muted-foreground pt-1">
													{poster.keyPoints.map((point, idx) => (
														<div key={idx} className="flex items-start gap-1.5">
															<span className="text-emerald-500 font-bold">•</span>
															<span>{point}</span>
														</div>
													))}
												</div>
											</div>

											{/* Co-Branded Footer Stamp */}
											<div className="pt-3 border-t border-border space-y-3">
												<div className="flex items-center justify-between text-xs bg-muted/40 p-2 rounded-lg border border-border">
													<div className="flex items-center gap-2">
														<div className="h-7 w-7 rounded-full bg-emerald-600/20 text-emerald-500 font-bold flex items-center justify-center text-xs">
															{partnerInitials}
														</div>
														<div className="text-left">
															<div className="font-semibold text-foreground leading-tight">
																{partnerName}
															</div>
															<div className="text-[10px] text-muted-foreground">
																{partnerPhone || "Advisory Partner"}
															</div>
														</div>
													</div>
													<Badge variant="outline" className="text-[10px] py-0 border-emerald-500/30 text-emerald-500">
														Partner ID
													</Badge>
												</div>

												{/* Action Buttons */}
												<div className="grid grid-cols-2 gap-2">
													<Button
														size="sm"
														className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs flex items-center justify-center gap-1.5"
														onClick={() => {
															const shareUrl = `https://api.whatsapp.com/send?text=${encodeURIComponent(
																poster.caption,
															)}`;
															window.open(shareUrl, "_blank");
														}}
													>
														<Share2 className="h-3.5 w-3.5" />
														<span>WhatsApp</span>
													</Button>

													<Button
														size="sm"
														variant="outline"
														className="border-border text-xs flex items-center justify-center gap-1.5"
														onClick={() =>
															copyPosterCaption(poster.caption, poster.id)
														}
													>
														{copiedPosterId === poster.id ? (
															<>
																<Check className="h-3.5 w-3.5 text-emerald-400" />
																<span>Copied</span>
															</>
														) : (
															<>
																<Copy className="h-3.5 w-3.5" />
																<span>Copy Text</span>
															</>
														)}
													</Button>
												</div>
											</div>
										</div>
									))}
							</div>
						</CardContent>
					</Card>
				</TabsContent>

				{/* 🔬 Portfolio X-Ray Lead Magnet (Dezerv / INDmoney Style) */}
				<TabsContent value="xray-magnet" className="space-y-6">
					{/* Lead Magnet Overview Card */}
					<Card className="bg-gradient-to-r from-emerald-950/40 via-card to-card border-emerald-500/30">
						<CardHeader>
							<div className="flex items-center justify-between flex-wrap gap-4">
								<div className="space-y-1">
									<div className="flex items-center gap-2">
										<Badge className="bg-emerald-600 text-white font-semibold">
											High-Conversion Lead Magnet
										</Badge>
										<Badge variant="outline" className="border-emerald-500/40 text-emerald-500">
											Dezerv & INDmoney Playbook
										</Badge>
									</div>
									<CardTitle className="text-2xl font-bold">
										Portfolio X-Ray & Fee Drag Lead Magnet
									</CardTitle>
									<CardDescription className="max-w-2xl">
										Share your personal diagnostic link. When prospects run an audit of their mutual funds and demat holdings, their contact details and asset profile automatically land in your Kanban pipeline.
									</CardDescription>
								</div>
								<Button
									size="lg"
									className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold flex items-center gap-2 shadow-md"
									onClick={() => window.open(leadMagnetUrl, "_blank")}
								>
									<ExternalLink className="h-4 w-4" />
									Preview Your Funnel Page
								</Button>
							</div>
						</CardHeader>
						<CardContent className="space-y-4">
							{/* Link Box */}
							<div className="p-3 rounded-lg bg-background border border-border flex items-center justify-between gap-3 flex-wrap">
								<div className="flex items-center gap-2 text-xs text-muted-foreground flex-1 min-w-[240px] truncate font-mono">
									<Target className="h-4 w-4 text-emerald-500 shrink-0" />
									<span className="text-foreground truncate">{leadMagnetUrl}</span>
								</div>
								<div className="flex items-center gap-2">
									<Button
										size="sm"
										variant="outline"
										onClick={copyLeadMagnet}
										className="border-border text-xs"
									>
										{copiedLeadMagnetLink ? (
											<>
												<Check className="h-3.5 w-3.5 mr-1 text-emerald-400" />
												Copied
											</>
										) : (
											<>
												<Copy className="h-3.5 w-3.5 mr-1" />
												Copy Link
											</>
										)}
									</Button>
									<Button
										size="sm"
										className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs flex items-center gap-1.5"
										onClick={() => {
											const text = encodeURIComponent(
												`Hi! Are you paying hidden distributor commissions on your mutual funds without knowing it?\n\nTake this free 60-second Portfolio X-Ray to check your fee leakage, asset allocation, and risk score:\n👉 ${leadMagnetUrl}\n\n— ${partnerName}`,
											);
											window.open(`https://api.whatsapp.com/send?text=${text}`, "_blank");
										}}
									>
										<Share2 className="h-3.5 w-3.5" />
										Share on WhatsApp
									</Button>
								</div>
							</div>

							{/* Aggregate Stats */}
							<div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2">
								<div className="p-4 rounded-xl bg-card border border-border text-center">
									<div className="text-xs text-muted-foreground font-medium">Leads Captured via X-Ray</div>
									<div className="text-3xl font-extrabold text-foreground mt-1">
										{xrayLeads.length}
									</div>
									<div className="text-[11px] text-emerald-500 mt-0.5">High Intent Prospects</div>
								</div>

								<div className="p-4 rounded-xl bg-card border border-border text-center">
									<div className="text-xs text-muted-foreground font-medium">Total Assets Audited</div>
									<div className="text-3xl font-extrabold text-emerald-500 mt-1">
										{totalXRayTracked >= 10000000
											? `₹${(totalXRayTracked / 10000000).toFixed(2)} Cr`
											: `₹${(totalXRayTracked / 100000).toFixed(1)} Lakhs`}
									</div>
									<div className="text-[11px] text-muted-foreground mt-0.5">Potential AUM Pipeline</div>
								</div>

								<div className="p-4 rounded-xl bg-card border border-border text-center">
									<div className="text-xs text-muted-foreground font-medium">Avg Lead Score</div>
									<div className="text-3xl font-extrabold text-blue-400 mt-1">
										{xrayLeads.length > 0
											? Math.round(
													xrayLeads.reduce(
														(acc: number, l: any) => acc + (l.score || 70),
														0,
													) / xrayLeads.length,
												)
											: 75}
										<span className="text-sm text-muted-foreground font-normal"> / 100</span>
									</div>
									<div className="text-[11px] text-muted-foreground mt-0.5">Automated Risk Scoring</div>
								</div>
							</div>
						</CardContent>
					</Card>

					{/* Captured X-Ray Leads Table */}
					<Card className="bg-card border-border">
						<CardHeader>
							<CardTitle className="text-base font-semibold flex items-center gap-2">
								<Users className="h-4 w-4 text-emerald-500" />
								Recent X-Ray Inbound Prospects ({xrayLeads.length})
							</CardTitle>
							<CardDescription>
								Prospects who completed your Portfolio Health Check and are awaiting follow-up
							</CardDescription>
						</CardHeader>
						<CardContent>
							{xrayLeads.length === 0 ? (
								<div className="text-center py-10 space-y-3">
									<Target className="h-10 w-10 text-muted-foreground mx-auto opacity-50" />
									<h4 className="font-semibold text-foreground">No Inbound X-Ray Leads Yet</h4>
									<p className="text-xs text-muted-foreground max-w-sm mx-auto">
										Share your personalized X-Ray link on WhatsApp or social media to start generating qualified leads into your pipeline.
									</p>
									<Button
										size="sm"
										onClick={copyLeadMagnet}
										className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs"
									>
										Copy Funnel Link
									</Button>
								</div>
							) : (
								<div className="space-y-3">
									{xrayLeads.map((lead: any) => (
										<div
											key={lead.id}
											className="p-4 rounded-lg border border-border bg-muted/20 flex items-center justify-between gap-4 flex-wrap"
										>
											<div className="space-y-1">
												<div className="flex items-center gap-2">
													<span className="font-bold text-foreground">{lead.name}</span>
													<Badge variant="outline" className="text-xs border-emerald-500/40 text-emerald-500">
														Score: {lead.score || 75}
													</Badge>
												</div>
												<p className="text-xs text-muted-foreground">
													{lead.phone} {lead.email && `• ${lead.email}`}
												</p>
												{lead.notes && (
													<p className="text-xs text-muted-foreground italic font-mono bg-background/50 px-2 py-0.5 rounded border border-border inline-block">
														{lead.notes}
													</p>
												)}
											</div>
											<div className="flex items-center gap-2">
												<Button
													size="sm"
													variant="outline"
													className="border-emerald-500/40 text-emerald-500 text-xs"
													onClick={() => {
														const cleanPhone = lead.phone?.replace(/\D/g, "");
														const text = encodeURIComponent(
															`Hi ${lead.name}, thank you for checking your Portfolio X-Ray on FintekPro. I reviewed your diagnostic summary and would love to share a few actionable optimization steps. When are you free for a 10-minute call?`,
														);
														window.open(`https://wa.me/${cleanPhone}?text=${text}`, "_blank");
													}}
												>
													<Share2 className="h-3.5 w-3.5 mr-1" />
													WhatsApp Lead
												</Button>
												<Button
													size="sm"
													className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs"
													onClick={() => {
														window.open(`/agent/meetings`, "_blank");
													}}
												>
													<Calendar className="h-3.5 w-3.5 mr-1" />
													Schedule Call
												</Button>
											</div>
										</div>
									))}
								</div>
							)}
						</CardContent>
					</Card>
				</TabsContent>

				{/* ⚡ Market Event Flash Broadcasts (Motilal Oswal & Sanctum Playbook) */}
				<TabsContent value="flash-broadcasts" className="space-y-6">
					<Card className="bg-card border-border">
						<CardHeader>
							<CardTitle className="text-xl flex items-center gap-2">
								<Zap className="h-5 w-5 text-purple-400" />
								Event-Driven Flash Broadcasts
							</CardTitle>
							<CardDescription>
								Compliance-approved, 1-click broadcast messages triggered by market events (Nifty corrections, RBI policy announcements, Budget tax changes) to reassure clients and capture opportunistic lumpsums.
							</CardDescription>
						</CardHeader>
						<CardContent className="space-y-4">
							<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
								{/* Trigger 1 */}
								<div className="p-4 rounded-xl border border-border bg-muted/20 space-y-3">
									<div className="flex items-center justify-between">
										<Badge variant="outline" className="border-blue-500/40 text-blue-400 text-xs">
											Market Dip Alert
										</Badge>
										<span className="text-xs text-muted-foreground">Trigger: Nifty -2.5%</span>
									</div>
									<h4 className="font-bold text-foreground text-sm">
										Nifty Pullback: Why Systematic Compounding Beats Timing
									</h4>
									<p className="text-xs text-muted-foreground">
										Reassures nervous investors during market drawdowns and reminds them that historically every 5%+ correction generated strong 3-year alpha.
									</p>
									<Button
										size="sm"
										className="w-full bg-blue-600 hover:bg-blue-700 text-white text-xs flex items-center justify-center gap-1.5"
										onClick={() => {
											const msg = `📉 Market Dip Reassurance: Notice the recent market correction?\n\nHistorically, equity corrections are a natural part of India's long-term compounding story. Disciplined investors who stay invested and use dips to top-up historically outperform those who try to time the market.\n\nNeed a personalized review of your portfolio? Connect with us:\n👉 ${leadMagnetUrl}\n\n— ${partnerName}`;
											window.open(`https://api.whatsapp.com/send?text=${encodeURIComponent(msg)}`, "_blank");
										}}
									>
										<Share2 className="h-3.5 w-3.5" />
										1-Click WhatsApp Broadcast
									</Button>
								</div>

								{/* Trigger 2 */}
								<div className="p-4 rounded-xl border border-border bg-muted/20 space-y-3">
									<div className="flex items-center justify-between">
										<Badge variant="outline" className="border-emerald-500/40 text-emerald-400 text-xs">
											RBI Policy Flash
										</Badge>
										<span className="text-xs text-muted-foreground">Trigger: Rate Pause</span>
									</div>
									<h4 className="font-bold text-foreground text-sm">
										RBI Repo Rate Update: Lock In High-Yield Senior Debt
									</h4>
									<p className="text-xs text-muted-foreground">
										Alerts conservative and moderate clients to lock in high coupon rates on AA/AAA rated corporate bonds before potential rate cuts.
									</p>
									<Button
										size="sm"
										className="w-full bg-emerald-600 hover:bg-emerald-700 text-white text-xs flex items-center justify-center gap-1.5"
										onClick={() => {
											const msg = `🏛️ RBI Monetary Policy Update: With interest rates at peak cycle, high-yield senior secured bonds (9.5% - 11.2%) offer exceptional yield lock-in before rate cuts begin.\n\nExplore curated fixed income instruments for your portfolio:\n👉 ${leadMagnetUrl}\n\n— ${partnerName}`;
											window.open(`https://api.whatsapp.com/send?text=${encodeURIComponent(msg)}`, "_blank");
										}}
									>
										<Share2 className="h-3.5 w-3.5" />
										1-Click WhatsApp Broadcast
									</Button>
								</div>

								{/* Trigger 3 */}
								<div className="p-4 rounded-xl border border-border bg-muted/20 space-y-3">
									<div className="flex items-center justify-between">
										<Badge variant="outline" className="border-amber-500/40 text-amber-400 text-xs">
											Tax Season Alert
										</Badge>
										<span className="text-xs text-muted-foreground">Trigger: Year-End</span>
									</div>
									<h4 className="font-bold text-foreground text-sm">
										LTCG 12.5% Tax-Loss Harvesting Before March 31
									</h4>
									<p className="text-xs text-muted-foreground">
										Encourages investors to claim their annual ₹1.25 Lakh tax-free equity gains exemption and offset capital gains.
									</p>
									<Button
										size="sm"
										className="w-full bg-amber-600 hover:bg-amber-700 text-white text-xs flex items-center justify-center gap-1.5"
										onClick={() => {
											const msg = `⚖️ FY Year-End Tax Alert: Have you utilized your ₹1.25 Lakh annual tax-free LTCG exemption under the new tax rules?\n\nRun an instant tax-loss harvesting audit on your portfolio before March 31:\n👉 ${leadMagnetUrl}\n\n— ${partnerName}`;
											window.open(`https://api.whatsapp.com/send?text=${encodeURIComponent(msg)}`, "_blank");
										}}
									>
										<Share2 className="h-3.5 w-3.5" />
										1-Click WhatsApp Broadcast
									</Button>
								</div>

								{/* Trigger 4 */}
								<div className="p-4 rounded-xl border border-border bg-muted/20 space-y-3">
									<div className="flex items-center justify-between">
										<Badge variant="outline" className="border-purple-500/40 text-purple-400 text-xs">
											Quarterly Audit
										</Badge>
										<span className="text-xs text-muted-foreground">Trigger: 6-Month Review</span>
									</div>
									<h4 className="font-bold text-foreground text-sm">
										Portfolio Drift & Rebalancing Checkup
									</h4>
									<p className="text-xs text-muted-foreground">
										Reminds clients to review equity-debt allocation and rebalance away from overheated market sectors.
									</p>
									<Button
										size="sm"
										className="w-full bg-purple-600 hover:bg-purple-700 text-white text-xs flex items-center justify-center gap-1.5"
										onClick={() => {
											const msg = `🔄 Semi-Annual Portfolio Health Check: Has market rally drifted your equity exposure too high?\n\nRebalancing every 6 months protects compounding profits from deep drawdowns. Audit your asset allocation now:\n👉 ${leadMagnetUrl}\n\n— ${partnerName}`;
											window.open(`https://api.whatsapp.com/send?text=${encodeURIComponent(msg)}`, "_blank");
										}}
									>
										<Share2 className="h-3.5 w-3.5" />
										1-Click WhatsApp Broadcast
									</Button>
								</div>
							</div>
						</CardContent>
					</Card>
				</TabsContent>
			</Tabs>
		</div>
	);
}
