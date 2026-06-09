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
	Send,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface RequestMeetingDialogProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	preselectedAgentId?: string;
	preselectedAgentName?: string;
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

export function RequestMeetingDialog({
	open,
	onOpenChange,
	preselectedAgentId,
	preselectedAgentName,
}: RequestMeetingDialogProps) {
	const { toast } = useToast();
	const [selectedDate, setSelectedDate] = useState<Date | undefined>(
		addDays(new Date(), 1),
	);
	const [selectedTime, setSelectedTime] = useState<string>("10:00");
	const [duration, setDuration] = useState<string>("30");
	const [topic, setTopic] = useState("");
	const [description, setDescription] = useState("");
	const [clientNotes, setClientNotes] = useState("");
	const [selectedAgent, setSelectedAgent] = useState<string>(
		preselectedAgentId || "",
	);
	const [requestSuccess, setRequestSuccess] = useState(false);
	const [requestData, setRequestData] = useState<any>(null);

	const { data: agentsData, isLoading: agentsLoading } = useQuery<{
		agents: any[];
	}>({
		queryKey: ["/api/meetings/available-agents"],
		enabled: !preselectedAgentId && open,
	});

	const agents = agentsData?.agents || [];

	const requestMeetingMutation = useMutation({
		mutationFn: async (data: any) => {
			return apiRequest("/api/meetings/request", {
				method: "POST",
				body: JSON.stringify(data),
			});
		},
		onSuccess: (data) => {
			setRequestSuccess(true);
			setRequestData(data.request);
			queryClient.invalidateQueries({
				queryKey: ["/api/meetings/my-bookings"],
			});
		},
		onError: (error: any) => {
			toast({
				title: "Request Failed",
				description: error.message || "Failed to submit meeting request",
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

		const [hours, minutes] = selectedTime.split(":").map(Number);
		const preferredDate = setMinutes(setHours(selectedDate, hours), minutes);

		requestMeetingMutation.mutate({
			agentId: preselectedAgentId || selectedAgent || undefined,
			topic,
			description,
			preferredDate: preferredDate.toISOString(),
			preferredTime: selectedTime,
			duration: Number.parseInt(duration),
			clientNotes,
		});
	};

	const handleClose = () => {
		setRequestSuccess(false);
		setRequestData(null);
		setTopic("");
		setDescription("");
		setClientNotes("");
		setSelectedDate(addDays(new Date(), 1));
		setSelectedTime("10:00");
		setDuration("30");
		onOpenChange(false);
	};

	if (requestSuccess && requestData) {
		return (
			<Dialog open={open} onOpenChange={handleClose}>
				<DialogContent className="sm:max-w-md">
					<DialogHeader>
						<DialogTitle className="flex items-center gap-2 text-green-600">
							<CheckCircle2 className="w-6 h-6" />
							Request Submitted!
						</DialogTitle>
						<DialogDescription>
							Your meeting request has been sent for approval.
						</DialogDescription>
					</DialogHeader>

					<div className="space-y-4 py-4">
						<div className="bg-muted rounded-lg p-4 space-y-3">
							<div className="flex items-center gap-2">
								<Video className="w-4 h-4 text-primary" />
								<span className="font-medium">{requestData.topic}</span>
							</div>
							<div className="flex items-center gap-2 text-sm text-muted-foreground">
								<CalendarIcon className="w-4 h-4" />
								<span>
									Preferred:{" "}
									{format(
										new Date(requestData.scheduledAt),
										"EEEE, MMMM d, yyyy",
									)}
								</span>
							</div>
							<div className="flex items-center gap-2 text-sm text-muted-foreground">
								<Clock className="w-4 h-4" />
								<span>
									{format(new Date(requestData.scheduledAt), "h:mm a")} (
									{requestData.duration} min)
								</span>
							</div>
							{requestData.agentName && (
								<div className="text-sm">
									<span className="text-muted-foreground">Assigned to: </span>
									<span className="font-medium">{requestData.agentName}</span>
								</div>
							)}
						</div>

						<div className="bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 rounded-lg p-3">
							<p className="text-sm text-blue-800 dark:text-blue-200">
								An agent will review your request and confirm the meeting.
								You'll receive an email and SMS notification once it's approved
								with the meeting link.
							</p>
						</div>
					</div>

					<DialogFooter>
						<Button onClick={handleClose} data-testid="button-done">
							Done
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>
		);
	}

	return (
		<Dialog open={open} onOpenChange={handleClose}>
			<DialogContent className="sm:max-w-lg">
				<DialogHeader>
					<DialogTitle className="flex items-center gap-2">
						<Send className="w-5 h-5 text-primary" />
						Request a Meeting
					</DialogTitle>
					<DialogDescription>
						{preselectedAgentName
							? `Request a video meeting with ${preselectedAgentName}`
							: "Submit a meeting request and an agent will confirm your preferred time"}
					</DialogDescription>
				</DialogHeader>

				<div className="space-y-4 py-4">
					{!preselectedAgentId && (
						<div className="space-y-2">
							<Label htmlFor="agent">Select Agent (Optional)</Label>
							{agentsLoading ? (
								<div className="flex items-center gap-2 text-sm text-muted-foreground">
									<Loader2 className="w-4 h-4 animate-spin" />
									Loading agents...
								</div>
							) : (
								<Select value={selectedAgent} onValueChange={setSelectedAgent}>
									<SelectTrigger data-testid="select-agent">
										<SelectValue placeholder="Any available agent" />
									</SelectTrigger>
									<SelectContent>
										<SelectItem value="">Any available agent</SelectItem>
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
							value={topic}
							onChange={(e) => setTopic(e.target.value)}
							placeholder="e.g., Portfolio Review, Investment Consultation"
							data-testid="input-topic"
						/>
					</div>

					<div className="space-y-2">
						<Label htmlFor="description">Description</Label>
						<Textarea
							id="description"
							value={description}
							onChange={(e) => setDescription(e.target.value)}
							placeholder="Brief description of what you'd like to discuss"
							rows={2}
							data-testid="input-description"
						/>
					</div>

					<div className="grid grid-cols-2 gap-4">
						<div className="space-y-2">
							<Label>Preferred Date *</Label>
							<Popover>
								<PopoverTrigger asChild>
									<Button
										variant="outline"
										className={cn(
											"w-full justify-start text-left font-normal",
											!selectedDate && "text-muted-foreground",
										)}
										data-testid="button-date"
									>
										<CalendarIcon className="mr-2 h-4 w-4" />
										{selectedDate
											? format(selectedDate, "MMM d, yyyy")
											: "Select date"}
									</Button>
								</PopoverTrigger>
								<PopoverContent className="w-auto p-0" align="start">
									<Calendar
										mode="single"
										selected={selectedDate}
										onSelect={setSelectedDate}
										disabled={(date) => date < new Date()}
										initialFocus
									/>
								</PopoverContent>
							</Popover>
						</div>

						<div className="space-y-2">
							<Label>Preferred Time *</Label>
							<Select value={selectedTime} onValueChange={setSelectedTime}>
								<SelectTrigger data-testid="select-time">
									<SelectValue />
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
						<Label htmlFor="notes">Additional Notes</Label>
						<Textarea
							id="notes"
							value={clientNotes}
							onChange={(e) => setClientNotes(e.target.value)}
							placeholder="Any specific requirements or questions"
							rows={2}
							data-testid="input-notes"
						/>
					</div>
				</div>

				<DialogFooter>
					<Button variant="outline" onClick={handleClose}>
						Cancel
					</Button>
					<Button
						onClick={handleSubmit}
						disabled={requestMeetingMutation.isPending}
						data-testid="button-submit-request"
					>
						{requestMeetingMutation.isPending ? (
							<>
								<Loader2 className="mr-2 h-4 w-4 animate-spin" />
								Submitting...
							</>
						) : (
							<>
								<Send className="mr-2 h-4 w-4" />
								Submit Request
							</>
						)}
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
