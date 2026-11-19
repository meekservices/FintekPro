import { useState } from "react";
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
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
	DialogTrigger,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import {
	Video,
	Plus,
	Calendar,
	Clock,
	ExternalLink,
	Loader2,
	CheckCircle2,
	XCircle,
	Users,
	Copy,
	Check,
	Target,
	Crown,
	Mail,
} from "lucide-react";

interface MeetingBooking {
	id: string;
	agentId: string;
	clientId: string;
	topic: string;
	description?: string;
	scheduledAt: string;
	duration: number;
	status: string;
	meetingId?: string;
	joinLink?: string;
	startLink?: string;
	clientName?: string;
	clientEmail?: string;
	attendeeType?: "client" | "lead" | "prospect" | "guest";
	clientNotes?: string;
	agentNotes?: string;
	createdAt: string;
}

interface MeetingAttendee {
	id: string;
	leadId?: string;
	prospectId?: string;
	fullName: string;
	email: string;
	attendeeType: "client" | "lead" | "prospect" | "guest";
	tier?: string;
	stage?: string;
}

export default function AgentMeetings() {
	const { toast } = useToast();
	const [meetingDialog, setMeetingDialog] = useState(false);
	const [attendeeType, setAttendeeType] = useState<"client" | "lead" | "prospect" | "guest">("client");
	const [meetingClientId, setMeetingClientId] = useState("");
	const [meetingLeadId, setMeetingLeadId] = useState("");
	const [meetingProspectId, setMeetingProspectId] = useState("");
	const [guestName, setGuestName] = useState("");
	const [guestEmail, setGuestEmail] = useState("");
	const [meetingTopic, setMeetingTopic] = useState("");
	const [meetingDescription, setMeetingDescription] = useState("");
	const [meetingDate, setMeetingDate] = useState("");
	const [meetingTime, setMeetingTime] = useState("");
	const [meetingDuration, setMeetingDuration] = useState(30);
	const [copiedMeetingId, setCopiedMeetingId] = useState<string | null>(null);

	const { data: meetingsData, isLoading: meetingsLoading } = useQuery<{
		bookings: MeetingBooking[];
	}>({
		queryKey: ["/api/meetings/agent-bookings"],
		queryFn: async () => {
			const response = await apiRequest("/api/meetings/agent-bookings");
			return response;
		},
	});

	const { data: meetingClientsData } = useQuery<{
		clients?: MeetingAttendee[];
		leads?: MeetingAttendee[];
		prospects?: MeetingAttendee[];
		allAttendees?: MeetingAttendee[];
	}>({
		queryKey: ["/api/meetings/agent-clients"],
		queryFn: async () => {
			const response = await apiRequest("/api/meetings/agent-clients");
			return response;
		},
	});

	const { data: pendingRequestsData } = useQuery<{
		requests: MeetingBooking[];
	}>({
		queryKey: ["/api/meetings/pending-requests"],
		queryFn: async () => {
			const response = await apiRequest("/api/meetings/pending-requests");
			return response;
		},
	});

	const scheduleMeetingMutation = useMutation({
		mutationFn: async (data: {
			attendeeType: "client" | "lead" | "prospect" | "guest";
			clientId?: string;
			leadId?: string;
			prospectId?: string;
			guestName?: string;
			guestEmail?: string;
			topic: string;
			description?: string;
			scheduledAt: string;
			duration: number;
		}) => {
			const response = await apiRequest("/api/meetings/agent-book", {
				method: "POST",
				body: JSON.stringify(data),
				headers: { "Content-Type": "application/json" },
			});
			return response;
		},
		onSuccess: () => {
			toast({
				title: "Success",
				description: "Meeting scheduled successfully",
			});
			queryClient.invalidateQueries({
				queryKey: ["/api/meetings/agent-bookings"],
			});
			setMeetingDialog(false);
			resetMeetingForm();
		},
		onError: (error: Error) => {
			toast({
				title: "Error",
				description: error.message,
				variant: "destructive",
			});
		},
	});

	const approveMeetingMutation = useMutation({
		mutationFn: async ({
			id,
			scheduledAt,
			agentNotes,
		}: { id: string; scheduledAt?: string; agentNotes?: string }) => {
			const response = await apiRequest(`/api/meetings/${id}/approve`, {
				method: "POST",
				body: JSON.stringify({ scheduledAt, agentNotes }),
				headers: { "Content-Type": "application/json" },
			});
			return response;
		},
		onSuccess: () => {
			toast({
				title: "Success",
				description: "Meeting request approved and scheduled",
			});
			queryClient.invalidateQueries({
				queryKey: ["/api/meetings/pending-requests"],
			});
			queryClient.invalidateQueries({
				queryKey: ["/api/meetings/agent-bookings"],
			});
		},
		onError: (error: Error) => {
			toast({
				title: "Error",
				description: error.message,
				variant: "destructive",
			});
		},
	});

	const declineMeetingMutation = useMutation({
		mutationFn: async ({ id, reason }: { id: string; reason?: string }) => {
			const response = await apiRequest(`/api/meetings/${id}/decline`, {
				method: "POST",
				body: JSON.stringify({ reason }),
				headers: { "Content-Type": "application/json" },
			});
			return response;
		},
		onSuccess: () => {
			toast({
				title: "Request Declined",
				description: "The meeting request has been declined",
			});
			queryClient.invalidateQueries({
				queryKey: ["/api/meetings/pending-requests"],
			});
		},
		onError: (error: Error) => {
			toast({
				title: "Error",
				description: error.message,
				variant: "destructive",
			});
		},
	});

	const cancelMeetingMutation = useMutation({
		mutationFn: async (id: string) => {
			const response = await apiRequest(`/api/meetings/${id}/cancel`, {
				method: "POST",
				headers: { "Content-Type": "application/json" },
			});
			return response;
		},
		onSuccess: () => {
			toast({
				title: "Meeting Cancelled",
				description: "The meeting has been cancelled",
			});
			queryClient.invalidateQueries({
				queryKey: ["/api/meetings/agent-bookings"],
			});
		},
		onError: (error: Error) => {
			toast({
				title: "Error",
				description: error.message,
				variant: "destructive",
			});
		},
	});

	const resetMeetingForm = () => {
		setAttendeeType("client");
		setMeetingClientId("");
		setMeetingLeadId("");
		setMeetingProspectId("");
		setGuestName("");
		setGuestEmail("");
		setMeetingTopic("");
		setMeetingDescription("");
		setMeetingDate("");
		setMeetingTime("");
		setMeetingDuration(30);
	};

	const handleScheduleMeeting = () => {
		if (attendeeType === "client" && !meetingClientId) {
			toast({
				title: "Client Required",
				description: "Please select a registered client to meet with",
				variant: "destructive",
			});
			return;
		}
		if (attendeeType === "lead" && !meetingLeadId) {
			toast({
				title: "Lead Required",
				description: "Please select a pipeline lead to meet with",
				variant: "destructive",
			});
			return;
		}
		if (attendeeType === "prospect" && !meetingProspectId) {
			toast({
				title: "Prospect Required",
				description: "Please select an HNI prospect to meet with",
				variant: "destructive",
			});
			return;
		}
		if (attendeeType === "guest" && (!guestName.trim() || !guestEmail.trim())) {
			toast({
				title: "Guest Details Required",
				description: "Please enter guest name and valid email address",
				variant: "destructive",
			});
			return;
		}
		if (!meetingTopic || !meetingDate || !meetingTime) {
			toast({
				title: "Missing Fields",
				description: "Please fill in meeting topic, date, and time",
				variant: "destructive",
			});
			return;
		}

		const scheduledAt = new Date(`${meetingDate}T${meetingTime}`).toISOString();
		scheduleMeetingMutation.mutate({
			attendeeType,
			clientId: attendeeType === "client" ? meetingClientId : undefined,
			leadId: attendeeType === "lead" ? meetingLeadId : undefined,
			prospectId: attendeeType === "prospect" ? meetingProspectId : undefined,
			guestName: attendeeType === "guest" ? guestName.trim() : undefined,
			guestEmail: attendeeType === "guest" ? guestEmail.trim() : undefined,
			topic: meetingTopic,
			description: meetingDescription || undefined,
			scheduledAt,
			duration: meetingDuration,
		});
	};

	const copyJoinLink = (link: string, id: string) => {
		navigator.clipboard.writeText(link);
		setCopiedMeetingId(id);
		toast({
			title: "Link Copied!",
			description: "Meeting join link copied to clipboard. Share via WhatsApp or Email.",
		});
		setTimeout(() => setCopiedMeetingId(null), 2500);
	};

	const renderAttendeeBadge = (type?: string, tier?: string) => {
		switch (type) {
			case "lead":
				return (
					<Badge variant="outline" className="bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300 border-blue-300 text-xs flex items-center gap-1">
						<Target className="h-3 w-3" />
						Lead {tier ? `• ${tier}` : ""}
					</Badge>
				);
			case "prospect":
				return (
					<Badge variant="outline" className="bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300 border-amber-300 text-xs flex items-center gap-1">
						<Crown className="h-3 w-3" />
						Prospect {tier ? `• ${tier}` : ""}
					</Badge>
				);
			case "guest":
				return (
					<Badge variant="outline" className="bg-purple-50 text-purple-700 dark:bg-purple-950/40 dark:text-purple-300 border-purple-300 text-xs flex items-center gap-1">
						<Mail className="h-3 w-3" />
						Guest
					</Badge>
				);
			default:
				return (
					<Badge variant="outline" className="bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 border-emerald-300 text-xs flex items-center gap-1">
						<Users className="h-3 w-3" />
						Client
					</Badge>
				);
		}
	};

	const upcomingMeetings =
		meetingsData?.bookings?.filter(
			(m) => new Date(m.scheduledAt) >= new Date() && m.status === "confirmed",
		) || [];

	const pastMeetings =
		meetingsData?.bookings?.filter(
			(m) => new Date(m.scheduledAt) < new Date() || m.status !== "confirmed",
		) || [];

	return (
		<div className="container mx-auto py-6 space-y-6">
			<div className="flex items-center justify-between">
				<div>
					<h1 className="text-2xl font-bold flex items-center gap-2">
						<Video className="h-6 w-6 text-blue-600" />
						Meetings & Video Hub
					</h1>
					<p className="text-muted-foreground">
						Connect with clients, leads, prospects, and guests via Google Meet & Video Hub
					</p>
				</div>
				<Dialog open={meetingDialog} onOpenChange={setMeetingDialog}>
					<DialogTrigger asChild>
						<Button
							className="flex items-center gap-2"
							data-testid="button-schedule-meeting"
						>
							<Plus size={16} />
							Schedule Meeting
						</Button>
					</DialogTrigger>
					<DialogContent className="max-w-md">
						<DialogHeader>
							<DialogTitle>Schedule New Meeting</DialogTitle>
							<DialogDescription>
								Book a video call with a client, pipeline lead, HNI prospect, or external guest
							</DialogDescription>
						</DialogHeader>
						<div className="space-y-4 py-4">
							{/* Attendee Type Switcher */}
							<div className="space-y-1.5">
								<Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
									Select Attendee Type
								</Label>
								<div className="grid grid-cols-4 gap-1 p-1 bg-muted rounded-lg text-xs font-medium">
									<button
										type="button"
										onClick={() => setAttendeeType("client")}
										className={`py-1.5 px-2 rounded-md flex items-center justify-center gap-1 transition-all ${
											attendeeType === "client"
												? "bg-background text-foreground shadow-sm font-semibold"
												: "text-muted-foreground hover:text-foreground"
										}`}
									>
										<Users className="h-3.5 w-3.5 text-emerald-600" />
										<span>Client</span>
									</button>
									<button
										type="button"
										onClick={() => setAttendeeType("lead")}
										className={`py-1.5 px-2 rounded-md flex items-center justify-center gap-1 transition-all ${
											attendeeType === "lead"
												? "bg-background text-foreground shadow-sm font-semibold"
												: "text-muted-foreground hover:text-foreground"
										}`}
									>
										<Target className="h-3.5 w-3.5 text-blue-600" />
										<span>Lead</span>
									</button>
									<button
										type="button"
										onClick={() => setAttendeeType("prospect")}
										className={`py-1.5 px-2 rounded-md flex items-center justify-center gap-1 transition-all ${
											attendeeType === "prospect"
												? "bg-background text-foreground shadow-sm font-semibold"
												: "text-muted-foreground hover:text-foreground"
										}`}
									>
										<Crown className="h-3.5 w-3.5 text-amber-600" />
										<span>Prospect</span>
									</button>
									<button
										type="button"
										onClick={() => setAttendeeType("guest")}
										className={`py-1.5 px-2 rounded-md flex items-center justify-center gap-1 transition-all ${
											attendeeType === "guest"
												? "bg-background text-foreground shadow-sm font-semibold"
												: "text-muted-foreground hover:text-foreground"
										}`}
									>
										<Mail className="h-3.5 w-3.5 text-purple-600" />
										<span>Guest</span>
									</button>
								</div>
							</div>

							{/* Dynamic Attendee Selector */}
							{attendeeType === "client" && (
								<div className="space-y-2">
									<Label htmlFor="meeting-client">Select Registered Client *</Label>
									<Select
										value={meetingClientId}
										onValueChange={setMeetingClientId}
									>
										<SelectTrigger
											id="meeting-client"
											data-testid="select-meeting-client"
										>
											<SelectValue placeholder="Choose a registered client" />
										</SelectTrigger>
										<SelectContent>
											{meetingClientsData?.clients && meetingClientsData.clients.length > 0 ? (
												meetingClientsData.clients.map((client) => (
													<SelectItem key={client.id} value={client.id}>
														{client.fullName} ({client.email})
													</SelectItem>
												))
											) : (
												<SelectItem value="none" disabled>
													No registered clients found
												</SelectItem>
											)}
										</SelectContent>
									</Select>
								</div>
							)}

							{attendeeType === "lead" && (
								<div className="space-y-2">
									<Label htmlFor="meeting-lead">Select Pipeline Lead *</Label>
									<Select
										value={meetingLeadId}
										onValueChange={setMeetingLeadId}
									>
										<SelectTrigger
											id="meeting-lead"
											data-testid="select-meeting-lead"
										>
											<SelectValue placeholder="Choose a lead from pipeline" />
										</SelectTrigger>
										<SelectContent>
											{meetingClientsData?.leads && meetingClientsData.leads.length > 0 ? (
												meetingClientsData.leads.map((lead) => (
													<SelectItem key={lead.leadId || lead.id} value={lead.leadId || lead.id}>
														{lead.fullName} {lead.stage ? `[${lead.stage}]` : ""} {lead.email ? `(${lead.email})` : ""}
													</SelectItem>
												))
											) : (
												<SelectItem value="none" disabled>
													No leads found in pipeline
												</SelectItem>
											)}
										</SelectContent>
									</Select>
								</div>
							)}

							{attendeeType === "prospect" && (
								<div className="space-y-2">
									<Label htmlFor="meeting-prospect">Select HNI Prospect *</Label>
									<Select
										value={meetingProspectId}
										onValueChange={setMeetingProspectId}
									>
										<SelectTrigger
											id="meeting-prospect"
											data-testid="select-meeting-prospect"
										>
											<SelectValue placeholder="Choose an HNI prospect" />
										</SelectTrigger>
										<SelectContent>
											{meetingClientsData?.prospects && meetingClientsData.prospects.length > 0 ? (
												meetingClientsData.prospects.map((p) => (
													<SelectItem key={p.prospectId || p.id} value={p.prospectId || p.id}>
														{p.fullName} {p.tier ? `(${p.tier})` : ""}
													</SelectItem>
												))
											) : (
												<SelectItem value="none" disabled>
													No HNI prospects found
												</SelectItem>
											)}
										</SelectContent>
									</Select>
								</div>
							)}

							{attendeeType === "guest" && (
								<div className="grid grid-cols-2 gap-3">
									<div className="space-y-1.5">
										<Label htmlFor="guest-name">Guest Name *</Label>
										<Input
											id="guest-name"
											placeholder="Full Name"
											value={guestName}
											onChange={(e) => setGuestName(e.target.value)}
											data-testid="input-guest-name"
										/>
									</div>
									<div className="space-y-1.5">
										<Label htmlFor="guest-email">Guest Email *</Label>
										<Input
											id="guest-email"
											type="email"
											placeholder="guest@example.com"
											value={guestEmail}
											onChange={(e) => setGuestEmail(e.target.value)}
											data-testid="input-guest-email"
										/>
									</div>
								</div>
							)}

							<div className="space-y-2">
								<Label htmlFor="meeting-topic">Topic *</Label>
								<Input
									id="meeting-topic"
									placeholder="e.g., Portfolio Review, Investment Discussion"
									value={meetingTopic}
									onChange={(e) => setMeetingTopic(e.target.value)}
									data-testid="input-meeting-topic"
								/>
							</div>
							<div className="space-y-2">
								<Label htmlFor="meeting-description">Description</Label>
								<Textarea
									id="meeting-description"
									placeholder="Meeting agenda or notes..."
									value={meetingDescription}
									onChange={(e) => setMeetingDescription(e.target.value)}
									data-testid="input-meeting-description"
								/>
							</div>
							<div className="grid grid-cols-2 gap-4">
								<div className="space-y-2">
									<Label htmlFor="meeting-date">Date *</Label>
									<Input
										id="meeting-date"
										type="date"
										value={meetingDate}
										onChange={(e) => setMeetingDate(e.target.value)}
										min={new Date().toISOString().split("T")[0]}
										data-testid="input-meeting-date"
									/>
								</div>
								<div className="space-y-2">
									<Label htmlFor="meeting-time">Time *</Label>
									<Input
										id="meeting-time"
										type="time"
										value={meetingTime}
										onChange={(e) => setMeetingTime(e.target.value)}
										data-testid="input-meeting-time"
									/>
								</div>
							</div>
							<div className="space-y-2">
								<Label htmlFor="meeting-duration">Duration (minutes)</Label>
								<Select
									value={meetingDuration.toString()}
									onValueChange={(v) => setMeetingDuration(Number.parseInt(v))}
								>
									<SelectTrigger
										id="meeting-duration"
										data-testid="select-meeting-duration"
									>
										<SelectValue />
									</SelectTrigger>
									<SelectContent>
										<SelectItem value="15">15 minutes</SelectItem>
										<SelectItem value="30">30 minutes</SelectItem>
										<SelectItem value="45">45 minutes</SelectItem>
										<SelectItem value="60">1 hour</SelectItem>
										<SelectItem value="90">1.5 hours</SelectItem>
										<SelectItem value="120">2 hours</SelectItem>
									</SelectContent>
								</Select>
							</div>
							<Button
								className="w-full"
								onClick={handleScheduleMeeting}
								disabled={scheduleMeetingMutation.isPending}
								data-testid="button-confirm-schedule"
							>
								{scheduleMeetingMutation.isPending ? (
									<>
										<Loader2 className="mr-2 h-4 w-4 animate-spin" />
										Scheduling...
									</>
								) : (
									<>
										<Video className="mr-2 h-4 w-4" />
										Schedule Meeting
									</>
								)}
							</Button>
						</div>
					</DialogContent>
				</Dialog>
			</div>

			<div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
				<div className="lg:col-span-2 space-y-6">
					{pendingRequestsData?.requests &&
						pendingRequestsData.requests.length > 0 && (
							<Card>
								<CardHeader>
									<CardTitle className="text-orange-700 dark:text-orange-300 flex items-center gap-2">
										<Clock className="h-5 w-5" />
										Pending Requests ({pendingRequestsData.requests.length})
									</CardTitle>
									<CardDescription>
										Meeting requests awaiting your approval
									</CardDescription>
								</CardHeader>
								<CardContent className="space-y-3">
									{pendingRequestsData.requests.map((request) => (
										<div
											key={request.id}
											className="border-2 border-orange-200 rounded-lg p-4 bg-orange-50 dark:bg-orange-950"
											data-testid={`request-card-${request.id}`}
										>
											<div className="flex items-start justify-between">
												<div className="space-y-1 flex-1">
													<h4 className="font-medium">{request.topic}</h4>
													<p className="text-sm text-muted-foreground">
														From: {request.clientName || "Client"}{" "}
														{request.clientEmail && `(${request.clientEmail})`}
													</p>
													<div className="flex items-center gap-4 text-sm text-muted-foreground">
														<span className="flex items-center gap-1">
															<Calendar className="h-3 w-3" />
															{new Date(
																request.scheduledAt,
															).toLocaleDateString()}
														</span>
														<span className="flex items-center gap-1">
															<Clock className="h-3 w-3" />
															{new Date(request.scheduledAt).toLocaleTimeString(
																[],
																{ hour: "2-digit", minute: "2-digit" },
															)}
														</span>
														<span>{request.duration} min</span>
													</div>
													{request.clientNotes && (
														<p className="text-sm text-muted-foreground mt-2 italic">
															Notes: {request.clientNotes}
														</p>
													)}
												</div>
												<div className="flex items-center gap-2 ml-4">
													<Button
														size="sm"
														variant="default"
														className="bg-green-600 hover:bg-green-700"
														onClick={() =>
															approveMeetingMutation.mutate({ id: request.id })
														}
														disabled={approveMeetingMutation.isPending}
														data-testid={`button-approve-${request.id}`}
													>
														{approveMeetingMutation.isPending ? (
															<Loader2 className="h-3 w-3 animate-spin" />
														) : (
															<>
																<CheckCircle2 className="mr-1 h-3 w-3" />
																Approve
															</>
														)}
													</Button>
													<Button
														size="sm"
														variant="outline"
														className="text-red-600 hover:bg-red-50 dark:bg-red-950/30"
														onClick={() =>
															declineMeetingMutation.mutate({ id: request.id })
														}
														disabled={declineMeetingMutation.isPending}
														data-testid={`button-decline-${request.id}`}
													>
														<XCircle className="mr-1 h-3 w-3" />
														Decline
													</Button>
												</div>
											</div>
										</div>
									))}
								</CardContent>
							</Card>
						)}

					<Card>
						<CardHeader>
							<CardTitle className="text-green-700 dark:text-green-300 flex items-center gap-2">
								<Calendar className="h-5 w-5" />
								Upcoming Meetings
							</CardTitle>
							<CardDescription>
								Scheduled video calls with clients, leads, prospects, and guests
							</CardDescription>
						</CardHeader>
						<CardContent>
							{meetingsLoading ? (
								<div className="flex items-center justify-center py-8">
									<Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
								</div>
							) : upcomingMeetings.length > 0 ? (
								<div className="space-y-3">
									{upcomingMeetings.map((meeting) => (
										<div
											key={meeting.id}
											className="border rounded-lg p-4 bg-green-50 dark:bg-green-950"
											data-testid={`meeting-card-${meeting.id}`}
										>
											<div className="flex items-start justify-between gap-4">
												<div className="space-y-1.5 flex-1">
													<div className="flex items-center gap-2 flex-wrap">
														<h4 className="font-semibold">{meeting.topic}</h4>
														{renderAttendeeBadge(meeting.attendeeType)}
													</div>
													<p className="text-sm text-muted-foreground">
														Attendee: <span className="font-medium text-foreground">{meeting.clientName || "Unknown"}</span>
														{meeting.clientEmail && (
															<span className="text-xs text-muted-foreground ml-1">({meeting.clientEmail})</span>
														)}
													</p>
													<div className="flex items-center gap-4 text-sm text-muted-foreground">
														<span className="flex items-center gap-1">
															<Calendar className="h-3.5 w-3.5" />
															{new Date(
																meeting.scheduledAt,
															).toLocaleDateString()}
														</span>
														<span className="flex items-center gap-1">
															<Clock className="h-3.5 w-3.5" />
															{new Date(meeting.scheduledAt).toLocaleTimeString(
																[],
																{ hour: "2-digit", minute: "2-digit" },
															)}
														</span>
														<span>{meeting.duration} min</span>
													</div>
												</div>
												<div className="flex items-center gap-2">
													{(meeting.joinLink || meeting.startLink) && (
														<Button
															size="sm"
															variant="outline"
															onClick={() =>
																copyJoinLink(
																	meeting.joinLink || meeting.startLink || "",
																	meeting.id,
																)
															}
															data-testid={`button-copy-link-${meeting.id}`}
															className="flex items-center gap-1"
														>
															{copiedMeetingId === meeting.id ? (
																<>
																	<Check className="h-3.5 w-3.5 text-green-600" />
																	<span className="text-xs">Copied</span>
																</>
															) : (
																<>
																	<Copy className="h-3.5 w-3.5" />
																	<span className="text-xs">Copy Link</span>
																</>
															)}
														</Button>
													)}
													{meeting.startLink && (
														<Button
															size="sm"
															variant="default"
															onClick={() =>
																window.open(meeting.startLink, "_blank")
															}
															data-testid={`button-start-meeting-${meeting.id}`}
														>
															<ExternalLink className="mr-1 h-3.5 w-3.5" />
															Start
														</Button>
													)}
													<Button
														size="sm"
														variant="outline"
														className="text-red-600 hover:bg-red-50 dark:bg-red-950/30"
														onClick={() =>
															cancelMeetingMutation.mutate(meeting.id)
														}
														disabled={cancelMeetingMutation.isPending}
														data-testid={`button-cancel-meeting-${meeting.id}`}
													>
														<XCircle className="mr-1 h-3.5 w-3.5" />
														Cancel
													</Button>
												</div>
											</div>
										</div>
									))}
								</div>
							) : (
								<div className="text-center py-12">
									<Video className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
									<h3 className="text-lg font-medium mb-2">
										No Upcoming Meetings
									</h3>
									<p className="text-muted-foreground mb-4">
										Schedule a video meeting with a client, lead, prospect, or guest via Google Meet & Video Hub
									</p>
									<Button
										onClick={() => setMeetingDialog(true)}
										data-testid="button-schedule-first-meeting"
									>
										<Plus className="mr-2 h-4 w-4" />
										Schedule Meeting
									</Button>
								</div>
							)}
						</CardContent>
					</Card>

					{pastMeetings.length > 0 && (
						<Card>
							<CardHeader>
								<CardTitle className="text-muted-foreground flex items-center gap-2">
									<Clock className="h-5 w-5" />
									Past Meetings
								</CardTitle>
							</CardHeader>
							<CardContent>
								<div className="space-y-2">
									{pastMeetings.slice(0, 10).map((meeting) => (
										<div
											key={meeting.id}
											className="border rounded-lg p-3 bg-muted opacity-75"
										>
											<div className="flex items-center justify-between">
												<div className="space-y-0.5">
													<div className="flex items-center gap-2">
														<h4 className="font-medium text-sm">
															{meeting.topic}
														</h4>
														{renderAttendeeBadge(meeting.attendeeType)}
													</div>
													<p className="text-xs text-muted-foreground">
														{meeting.clientName} •{" "}
														{new Date(meeting.scheduledAt).toLocaleDateString()}
													</p>
												</div>
												<Badge
													variant={
														meeting.status === "cancelled"
															? "destructive"
															: "secondary"
													}
												>
													{meeting.status}
												</Badge>
											</div>
										</div>
									))}
								</div>
							</CardContent>
						</Card>
					)}
				</div>

				<div className="space-y-6">
					<Card>
						<CardHeader>
							<CardTitle className="text-sm font-semibold">Meeting Statistics</CardTitle>
						</CardHeader>
						<CardContent>
							<div className="space-y-3">
								<div className="flex items-center justify-between">
									<span className="text-sm text-muted-foreground flex items-center gap-2">
										<Calendar className="h-4 w-4 text-emerald-600" />
										Upcoming
									</span>
									<Badge variant="secondary">{upcomingMeetings.length}</Badge>
								</div>
								<div className="flex items-center justify-between">
									<span className="text-sm text-muted-foreground flex items-center gap-2">
										<Clock className="h-4 w-4 text-orange-600" />
										Pending Requests
									</span>
									<Badge variant="outline" className="text-orange-600">
										{pendingRequestsData?.requests?.length || 0}
									</Badge>
								</div>
								<div className="flex items-center justify-between">
									<span className="text-sm text-muted-foreground flex items-center gap-2">
										<CheckCircle2 className="h-4 w-4 text-blue-600" />
										Completed
									</span>
									<Badge variant="outline">
										{meetingsData?.bookings?.filter(
											(m) => m.status === "completed",
										).length || 0}
									</Badge>
								</div>
								<div className="flex items-center justify-between">
									<span className="text-sm text-muted-foreground flex items-center gap-2">
										<Users className="h-4 w-4 text-purple-600" />
										Total Contacts
									</span>
									<Badge variant="outline">
										{meetingClientsData?.allAttendees?.length ||
											(meetingClientsData?.clients?.length || 0) +
												(meetingClientsData?.leads?.length || 0) +
												(meetingClientsData?.prospects?.length || 0)}
									</Badge>
								</div>
							</div>
						</CardContent>
					</Card>

					<Card>
						<CardHeader>
							<CardTitle className="text-sm font-semibold">Quick Tips</CardTitle>
						</CardHeader>
						<CardContent className="text-sm text-muted-foreground space-y-2">
							<p>• Connect with Clients, Leads, HNI Prospects, or External Guests</p>
							<p>• Instant video meeting links via Google Meet & Video Hub</p>
							<p>• 1-click Copy Link to invite guests on WhatsApp or Email</p>
							<p>• Lead meetings automatically sync to Kanban activity timeline</p>
						</CardContent>
					</Card>
				</div>
			</div>
		</div>
	);
}
