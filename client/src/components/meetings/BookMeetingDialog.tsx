import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
	DialogFooter,
} from "@/components/ui/dialog";
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
import { Calendar } from "@/components/ui/calendar";
import {
	Popover,
	PopoverContent,
	PopoverTrigger,
} from "@/components/ui/popover";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { format, addDays, setHours, setMinutes } from "date-fns";
import {
	CalendarIcon,
	Clock,
	Video,
	Loader2,
	CheckCircle2,
	Copy,
	ExternalLink,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface BookMeetingDialogProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	agentId?: string;
	agentName?: string;
	clientId?: string;
	clientName?: string;
	isAgentView?: boolean;
}

const TIME_SLOTS = [
	"09:00",
	"09:30",
	"10:00",
	"10:30",
	"11:00",
	"11:30",
	"12:00",
	"12:30",
	"14:00",
	"14:30",
	"15:00",
	"15:30",
	"16:00",
	"16:30",
	"17:00",
	"17:30",
	"18:00",
];

const DURATIONS = [
	{ value: "15", label: "15 minutes" },
	{ value: "30", label: "30 minutes" },
	{ value: "45", label: "45 minutes" },
	{ value: "60", label: "1 hour" },
];

export function BookMeetingDialog({
	open,
	onOpenChange,
	agentId,
	agentName,
	clientId,
	clientName,
	isAgentView = false,
}: BookMeetingDialogProps) {
	const { toast } = useToast();
	const [selectedDate, setSelectedDate] = useState<Date | undefined>(
		addDays(new Date(), 1),
	);
	const [selectedTime, setSelectedTime] = useState<string>("10:00");
	const [duration, setDuration] = useState<string>("30");
	const [topic, setTopic] = useState("");
	const [description, setDescription] = useState("");
	const [selectedAgent, setSelectedAgent] = useState<string>(agentId || "");
	const [selectedClient, setSelectedClient] = useState<string>(clientId || "");
	const [bookingSuccess, setBookingSuccess] = useState(false);
	const [bookingData, setBookingData] = useState<any>(null);

	const { data: agentsData, isLoading: agentsLoading } = useQuery<{
		agents: any[];
	}>({
		queryKey: ["/api/meetings/available-agents"],
		enabled: !agentId && open && !isAgentView,
	});

	const { data: clientsData, isLoading: clientsLoading } = useQuery<{
		clients: any[];
	}>({
		queryKey: ["/api/meetings/agent-clients"],
		enabled: !clientId && open && isAgentView,
	});

	const agents = agentsData?.agents || [];
	const clients = clientsData?.clients || [];

	const bookMeetingMutation = useMutation({
		mutationFn: async (data: any) => {
			const endpoint = isAgentView
				? "/api/meetings/schedule"
				: "/api/meetings/book";
			return apiRequest(endpoint, {
				method: "POST",
				body: JSON.stringify(data),
			});
		},
		onSuccess: (data) => {
			setBookingSuccess(true);
			setBookingData(data.meeting || data.booking);
			queryClient.invalidateQueries({ queryKey: ["/api/meetings"] });
			queryClient.invalidateQueries({
				queryKey: ["/api/meetings/my-bookings"],
			});
			queryClient.invalidateQueries({
				queryKey: ["/api/meetings/agent-bookings"],
			});
			queryClient.invalidateQueries({ queryKey: ["/api/meetings/upcoming"] });
		},
		onError: (error: any) => {
			toast({
				title: "Booking Failed",
				description: error.message || "Failed to book meeting",
				variant: "destructive",
			});
		},
	});

	const handleSubmit = () => {
		if (!selectedDate || !selectedTime || !topic) {
			toast({
				title: "Missing Information",
				description: "Please fill in all required fields",
				variant: "destructive",
			});
			return;
		}

		if (isAgentView) {
			const targetClient = clientId || selectedClient;
			if (!targetClient) {
				toast({
					title: "Select Client",
					description: "Please select a client to meet with",
					variant: "destructive",
				});
				return;
			}

			const [hours, minutes] = selectedTime.split(":").map(Number);
			const scheduledAt = setMinutes(setHours(selectedDate, hours), minutes);

			bookMeetingMutation.mutate({
				clientId: targetClient,
				topic,
				description,
				scheduledAt: scheduledAt.toISOString(),
				duration: Number.parseInt(duration),
				timezone: "Asia/Kolkata",
			});
		} else {
			const targetAgent = agentId || selectedAgent;
			if (!targetAgent) {
				toast({
					title: "Select Agent",
					description: "Please select an agent to meet with",
					variant: "destructive",
				});
				return;
			}

			const [hours, minutes] = selectedTime.split(":").map(Number);
			const scheduledAt = setMinutes(setHours(selectedDate, hours), minutes);

			bookMeetingMutation.mutate({
				agentId: targetAgent,
				topic,
				description,
				scheduledAt: scheduledAt.toISOString(),
				duration: Number.parseInt(duration),
				timezone: "Asia/Kolkata",
			});
		}
	};

	const handleClose = () => {
		setBookingSuccess(false);
		setBookingData(null);
		setTopic("");
		setDescription("");
		setSelectedDate(addDays(new Date(), 1));
		setSelectedTime("10:00");
		setDuration("30");
		onOpenChange(false);
	};

	const copyToClipboard = (text: string) => {
		navigator.clipboard.writeText(text);
		toast({ title: "Link copied to clipboard!" });
	};

	if (bookingSuccess && bookingData) {
		return (
			<Dialog open={open} onOpenChange={handleClose}>
				<DialogContent
					className="sm:max-w-md"
					data-testid="meeting-success-dialog"
				>
					<DialogHeader>
						<DialogTitle className="flex items-center gap-2 text-green-600">
							<CheckCircle2 className="w-6 h-6" />
							Meeting Scheduled!
						</DialogTitle>
						<DialogDescription>
							Your meeting has been scheduled successfully.
						</DialogDescription>
					</DialogHeader>

					<div className="space-y-4 py-4">
						<div className="bg-muted rounded-lg p-4 space-y-3">
							<div className="flex items-center gap-2">
								<Video className="w-4 h-4 text-primary" />
								<span className="font-medium">{bookingData.topic}</span>
							</div>
							<div className="flex items-center gap-2 text-sm text-muted-foreground">
								<CalendarIcon className="w-4 h-4" />
								<span>
									{format(
										new Date(bookingData.scheduledAt),
										"EEEE, MMMM d, yyyy",
									)}
								</span>
							</div>
							<div className="flex items-center gap-2 text-sm text-muted-foreground">
								<Clock className="w-4 h-4" />
								<span>
									{format(new Date(bookingData.scheduledAt), "h:mm a")} (
									{bookingData.duration} min)
								</span>
							</div>
							<div className="text-sm">
								<span className="text-muted-foreground">
									{isAgentView ? "Client: " : "With: "}
								</span>
								<span className="font-medium">
									{isAgentView ? bookingData.clientName : bookingData.agentName}
								</span>
							</div>
						</div>

						{(bookingData.joinLink || bookingData.startLink) && (
							<div className="space-y-2">
								<Label>Meeting Link</Label>
								<div className="flex gap-2">
									<Input
										value={
											isAgentView ? bookingData.startLink : bookingData.joinLink
										}
										readOnly
										className="text-xs"
										data-testid="input-meeting-link"
									/>
									<Button
										variant="outline"
										size="icon"
										onClick={() =>
											copyToClipboard(
												isAgentView
													? bookingData.startLink
													: bookingData.joinLink,
											)
										}
										data-testid="btn-copy-link"
									>
										<Copy className="h-4 w-4" />
									</Button>
									<Button
										variant="outline"
										size="icon"
										onClick={() =>
											window.open(
												isAgentView
													? bookingData.startLink
													: bookingData.joinLink,
												"_blank",
											)
										}
										data-testid="btn-open-link"
									>
										<ExternalLink className="h-4 w-4" />
									</Button>
								</div>
							</div>
						)}

						<div className="flex gap-2 pt-2">
							<Button
								variant="outline"
								size="sm"
								className="flex-1"
								onClick={() =>
									window.open(
										`/api/meetings/${bookingData.id}/calendar.ics`,
										"_blank",
									)
								}
								data-testid="btn-add-calendar"
							>
								<CalendarIcon className="w-4 h-4 mr-2" />
								Add to Calendar
							</Button>
						</div>
					</div>

					<DialogFooter>
						<Button onClick={handleClose} data-testid="btn-done">
							Done
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>
		);
	}

	return (
		<Dialog open={open} onOpenChange={handleClose}>
			<DialogContent className="sm:max-w-lg" data-testid="book-meeting-dialog">
				<DialogHeader>
					<DialogTitle className="flex items-center gap-2">
						<Video className="w-5 h-5 text-primary" />
						{isAgentView ? "Schedule Meeting with Client" : "Book a Meeting"}
					</DialogTitle>
					<DialogDescription>
						{isAgentView
							? clientName
								? `Schedule a video meeting with ${clientName}`
								: "Schedule a video meeting with your client"
							: agentName
								? `Schedule a video meeting with ${agentName}`
								: "Schedule a video meeting with your financial advisor"}
					</DialogDescription>
				</DialogHeader>

				<div className="space-y-4 py-4">
					{isAgentView && !clientId && (
						<div className="space-y-2">
							<Label htmlFor="client">Select Client *</Label>
							{clientsLoading ? (
								<div className="flex items-center gap-2 text-sm text-muted-foreground">
									<Loader2 className="w-4 h-4 animate-spin" />
									Loading clients...
								</div>
							) : (
								<Select
									value={selectedClient}
									onValueChange={setSelectedClient}
								>
									<SelectTrigger data-testid="select-client">
										<SelectValue placeholder="Choose a client" />
									</SelectTrigger>
									<SelectContent>
										{clients.map((client) => (
											<SelectItem key={client.id} value={client.id}>
												{client.fullName || client.email}
											</SelectItem>
										))}
									</SelectContent>
								</Select>
							)}
						</div>
					)}

					{!isAgentView && !agentId && (
						<div className="space-y-2">
							<Label htmlFor="agent">Select Agent *</Label>
							{agentsLoading ? (
								<div className="flex items-center gap-2 text-sm text-muted-foreground">
									<Loader2 className="w-4 h-4 animate-spin" />
									Loading agents...
								</div>
							) : (
								<Select value={selectedAgent} onValueChange={setSelectedAgent}>
									<SelectTrigger data-testid="select-agent">
										<SelectValue placeholder="Choose an agent" />
									</SelectTrigger>
									<SelectContent>
										{agents.map((agent) => (
											<SelectItem key={agent.id} value={agent.id}>
												{agent.fullName || agent.email}
											</SelectItem>
										))}
									</SelectContent>
								</Select>
							)}
						</div>
					)}

					<div className="space-y-2">
						<Label htmlFor="topic">Meeting Topic *</Label>
						<Input
							id="topic"
							placeholder="e.g., Portfolio Review, Investment Planning"
							value={topic}
							onChange={(e) => setTopic(e.target.value)}
							data-testid="input-topic"
						/>
					</div>

					<div className="grid grid-cols-2 gap-4">
						<div className="space-y-2">
							<Label>Date *</Label>
							<Popover>
								<PopoverTrigger asChild>
									<Button
										variant="outline"
										className={cn(
											"w-full justify-start text-left font-normal",
											!selectedDate && "text-muted-foreground",
										)}
										data-testid="btn-select-date"
									>
										<CalendarIcon className="mr-2 h-4 w-4" />
										{selectedDate
											? format(selectedDate, "MMM d, yyyy")
											: "Pick a date"}
									</Button>
								</PopoverTrigger>
								<PopoverContent className="w-auto p-0" align="start">
									<Calendar
										mode="single"
										selected={selectedDate}
										onSelect={setSelectedDate}
										disabled={(date) =>
											date < new Date() || date < addDays(new Date(), 0)
										}
										initialFocus
									/>
								</PopoverContent>
							</Popover>
						</div>

						<div className="space-y-2">
							<Label>Time *</Label>
							<Select value={selectedTime} onValueChange={setSelectedTime}>
								<SelectTrigger data-testid="select-time">
									<SelectValue placeholder="Select time" />
								</SelectTrigger>
								<SelectContent>
									{TIME_SLOTS.map((time) => (
										<SelectItem key={time} value={time}>
											{time}
										</SelectItem>
									))}
								</SelectContent>
							</Select>
						</div>
					</div>

					<div className="space-y-2">
						<Label>Duration</Label>
						<Select value={duration} onValueChange={setDuration}>
							<SelectTrigger data-testid="select-duration">
								<SelectValue />
							</SelectTrigger>
							<SelectContent>
								{DURATIONS.map((d) => (
									<SelectItem key={d.value} value={d.value}>
										{d.label}
									</SelectItem>
								))}
							</SelectContent>
						</Select>
					</div>

					<div className="space-y-2">
						<Label htmlFor="description">Additional Notes (Optional)</Label>
						<Textarea
							id="description"
							placeholder="Any specific topics you'd like to discuss..."
							value={description}
							onChange={(e) => setDescription(e.target.value)}
							rows={3}
							data-testid="input-description"
						/>
					</div>
				</div>

				<DialogFooter>
					<Button
						variant="outline"
						onClick={handleClose}
						data-testid="btn-cancel"
					>
						Cancel
					</Button>
					<Button
						onClick={handleSubmit}
						disabled={bookMeetingMutation.isPending}
						data-testid="btn-book-meeting"
					>
						{bookMeetingMutation.isPending && (
							<Loader2 className="w-4 h-4 mr-2 animate-spin" />
						)}
						{isAgentView ? "Schedule Meeting" : "Book Meeting"}
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}

export default BookMeetingDialog;
