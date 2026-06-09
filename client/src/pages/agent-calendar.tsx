import { useState, useMemo } from "react";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import {
	format,
	startOfMonth,
	endOfMonth,
	startOfWeek,
	endOfWeek,
	addDays,
	addMonths,
	subMonths,
	isSameDay,
	isSameMonth,
	isToday,
	parseISO,
	addMinutes,
	isBefore,
	isAfter,
} from "date-fns";
import { Link } from "wouter";
import {
	Plus,
	Calendar as CalendarIcon,
	Clock,
	User,
	MapPin,
	Video,
	Phone,
	FileText,
	ChevronLeft,
	ChevronRight,
	Bell,
	AlertCircle,
	CheckCircle,
	Loader2,
	ExternalLink,
	ListTodo,
	Trash2,
	Edit,
	X,
	Download,
	Mail,
	MessageSquare,
	Building,
} from "lucide-react";

interface Appointment {
	id: string;
	title: string;
	description?: string;
	meetingType: "call" | "video_call" | "in_person" | "office_visit";
	clientId?: string;
	clientName?: string;
	clientEmail?: string;
	clientPhone?: string;
	location?: string;
	locationDetails?: string;
	date: string;
	startTime: string;
	endTime: string;
	duration: number;
	reminder: "none" | "15min" | "30min" | "1hr";
	reminderSent?: boolean;
	status: "scheduled" | "completed" | "cancelled" | "no_show";
	notes?: string;
	agenda?: string;
	createdAt: string;
	completedAt?: string;
}

interface Client {
	id: string;
	email: string;
	firstName?: string;
	lastName?: string;
	mobile?: string;
}

const MEETING_TYPE_CONFIG: Record<
	string,
	{
		label: string;
		icon: any;
		color: string;
		textColor: string;
		bgLight: string;
	}
> = {
	call: {
		label: "Call",
		icon: Phone,
		color: "bg-blue-500",
		textColor: "text-blue-400",
		bgLight: "bg-blue-500/20",
	},
	video_call: {
		label: "Video Call",
		icon: Video,
		color: "bg-purple-500",
		textColor: "text-purple-400",
		bgLight: "bg-purple-500/20",
	},
	in_person: {
		label: "In-Person",
		icon: User,
		color: "bg-emerald-500",
		textColor: "text-emerald-400",
		bgLight: "bg-emerald-500/20",
	},
	office_visit: {
		label: "Office Visit",
		icon: Building,
		color: "bg-amber-500",
		textColor: "text-amber-400",
		bgLight: "bg-amber-500/20",
	},
};

const DEFAULT_MEETING_CONFIG = {
	label: "Meeting",
	icon: CalendarIcon,
	color: "bg-muted",
	textColor: "text-muted-foreground",
	bgLight: "bg-muted/20",
};

const getMeetingConfig = (meetingType?: string) =>
	(meetingType && MEETING_TYPE_CONFIG[meetingType]) || DEFAULT_MEETING_CONFIG;

const REMINDER_OPTIONS = [
	{ value: "none", label: "No reminder" },
	{ value: "15min", label: "15 minutes before" },
	{ value: "30min", label: "30 minutes before" },
	{ value: "1hr", label: "1 hour before" },
];

const DURATION_OPTIONS = [
	{ value: 15, label: "15 minutes" },
	{ value: 30, label: "30 minutes" },
	{ value: 45, label: "45 minutes" },
	{ value: 60, label: "1 hour" },
];

const TIME_SLOTS = Array.from({ length: 10 }, (_, i) => {
	const hour = i + 9;
	return { hour, label: format(new Date().setHours(hour, 0), "h:mm a") };
});

function generateICSFile(appointment: Appointment): string {
	const startDate = parseISO(`${appointment.date}T${appointment.startTime}:00`);
	const endDate = parseISO(`${appointment.date}T${appointment.endTime}:00`);

	const formatICSDate = (date: Date) => {
		return format(date, "yyyyMMdd'T'HHmmss");
	};

	const icsContent = `BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//FintekPro//Agent Calendar//EN
BEGIN:VEVENT
UID:${appointment.id}@fintekpro.com
DTSTAMP:${formatICSDate(new Date())}
DTSTART:${formatICSDate(startDate)}
DTEND:${formatICSDate(endDate)}
SUMMARY:${appointment.title}
DESCRIPTION:${appointment.description || ""}${appointment.agenda ? "\\nAgenda: " + appointment.agenda : ""}
LOCATION:${appointment.locationDetails || getMeetingConfig(appointment.meetingType).label}
END:VEVENT
END:VCALENDAR`;

	return icsContent;
}

function downloadICS(appointment: Appointment) {
	const icsContent = generateICSFile(appointment);
	const blob = new Blob([icsContent], { type: "text/calendar;charset=utf-8" });
	const url = URL.createObjectURL(blob);
	const link = document.createElement("a");
	link.href = url;
	link.download = `${appointment.title.replace(/\s+/g, "_")}.ics`;
	document.body.appendChild(link);
	link.click();
	document.body.removeChild(link);
	URL.revokeObjectURL(url);
}

export default function AgentCalendar() {
	const { toast } = useToast();
	const queryClient = useQueryClient();
	const [currentDate, setCurrentDate] = useState(new Date());
	const [viewMode, setViewMode] = useState<"month" | "week">("month");
	const [selectedAppointment, setSelectedAppointment] =
		useState<Appointment | null>(null);
	const [showAddDialog, setShowAddDialog] = useState(false);
	const [showDetailDialog, setShowDetailDialog] = useState(false);
	const [editMode, setEditMode] = useState(false);

	const [newAppointment, setNewAppointment] = useState({
		title: "",
		description: "",
		meetingType: "video_call" as Appointment["meetingType"],
		clientId: "",
		location: "",
		locationDetails: "",
		date: format(new Date(), "yyyy-MM-dd"),
		startTime: "10:00",
		duration: 30,
		reminder: "30min" as Appointment["reminder"],
		agenda: "",
		notes: "",
	});

	const { data: appointmentsData, isLoading: appointmentsLoading } = useQuery<{
		appointments: Appointment[];
	}>({
		queryKey: ["/api/agent/appointments"],
	});

	const { data: clientsData } = useQuery<{ clients: Client[] }>({
		queryKey: ["/api/agent/clients"],
	});

	const appointments = appointmentsData?.appointments || [];
	const clients = clientsData?.clients || [];

	const createMutation = useMutation({
		mutationFn: (data: any) =>
			apiRequest("/api/agent/appointments", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify(data),
			}),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ["/api/agent/appointments"] });
			setShowAddDialog(false);
			resetForm();
			toast({
				title: "Appointment scheduled",
				description: "The appointment has been created successfully.",
			});
		},
		onError: () => {
			toast({ title: "Failed to create appointment", variant: "destructive" });
		},
	});

	const updateMutation = useMutation({
		mutationFn: ({ id, data }: { id: string; data: any }) =>
			apiRequest(`/api/agent/appointments/${id}`, {
				method: "PATCH",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify(data),
			}),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ["/api/agent/appointments"] });
			setShowDetailDialog(false);
			setEditMode(false);
			toast({ title: "Appointment updated" });
		},
		onError: () => {
			toast({ title: "Failed to update appointment", variant: "destructive" });
		},
	});

	const deleteMutation = useMutation({
		mutationFn: (id: string) =>
			apiRequest(`/api/agent/appointments/${id}`, { method: "DELETE" }),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ["/api/agent/appointments"] });
			setShowDetailDialog(false);
			toast({ title: "Appointment cancelled" });
		},
		onError: () => {
			toast({ title: "Failed to cancel appointment", variant: "destructive" });
		},
	});

	const sendReminderMutation = useMutation({
		mutationFn: ({ id, method }: { id: string; method: string }) =>
			apiRequest(`/api/agent/appointments/${id}/send-reminder`, {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ method }),
			}),
		onSuccess: (_, variables) => {
			queryClient.invalidateQueries({ queryKey: ["/api/agent/appointments"] });
			toast({ title: `Reminder sent via ${variables.method}` });
		},
		onError: () => {
			toast({ title: "Failed to send reminder", variant: "destructive" });
		},
	});

	const resetForm = () => {
		setNewAppointment({
			title: "",
			description: "",
			meetingType: "video_call",
			clientId: "",
			location: "",
			locationDetails: "",
			date: format(new Date(), "yyyy-MM-dd"),
			startTime: "10:00",
			duration: 30,
			reminder: "30min",
			agenda: "",
			notes: "",
		});
	};

	const todayAppointments = useMemo(() => {
		return appointments.filter(
			(apt) =>
				isSameDay(parseISO(apt.date), new Date()) && apt.status === "scheduled",
		);
	}, [appointments]);

	const upcomingAppointments = useMemo(() => {
		const today = new Date();
		return appointments
			.filter((apt) => {
				const aptDate = parseISO(apt.date);
				return isAfter(aptDate, today) && apt.status === "scheduled";
			})
			.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
	}, [appointments]);

	const getDaysInMonth = () => {
		const start = startOfWeek(startOfMonth(currentDate));
		const end = endOfWeek(endOfMonth(currentDate));
		const days: Date[] = [];
		let day = start;
		while (day <= end) {
			days.push(day);
			day = addDays(day, 1);
		}
		return days;
	};

	const getDaysInWeek = () => {
		const start = startOfWeek(currentDate);
		const days: Date[] = [];
		for (let i = 0; i < 7; i++) {
			days.push(addDays(start, i));
		}
		return days;
	};

	const getAppointmentsForDate = (date: Date) => {
		return appointments.filter(
			(apt) =>
				isSameDay(parseISO(apt.date), date) && apt.status !== "cancelled",
		);
	};

	const navigatePrev = () => {
		if (viewMode === "month") setCurrentDate(subMonths(currentDate, 1));
		else setCurrentDate(addDays(currentDate, -7));
	};

	const navigateNext = () => {
		if (viewMode === "month") setCurrentDate(addMonths(currentDate, 1));
		else setCurrentDate(addDays(currentDate, 7));
	};

	const handleDateClick = (date: Date) => {
		setNewAppointment((prev) => ({
			...prev,
			date: format(date, "yyyy-MM-dd"),
		}));
		setShowAddDialog(true);
	};

	const handleAppointmentClick = (apt: Appointment, e: React.MouseEvent) => {
		e.stopPropagation();
		setSelectedAppointment(apt);
		setShowDetailDialog(true);
	};

	const calculateEndTime = (startTime: string, duration: number) => {
		const [hours, minutes] = startTime.split(":").map(Number);
		const startDate = new Date();
		startDate.setHours(hours, minutes, 0, 0);
		const endDate = addMinutes(startDate, duration);
		return format(endDate, "HH:mm");
	};

	const handleCreateAppointment = () => {
		const client = clients.find((c) => c.id === newAppointment.clientId);
		const endTime = calculateEndTime(
			newAppointment.startTime,
			newAppointment.duration,
		);

		createMutation.mutate({
			title: newAppointment.title,
			description: newAppointment.description,
			meetingType: newAppointment.meetingType,
			date: newAppointment.date,
			startTime: newAppointment.startTime,
			endTime,
			duration: newAppointment.duration,
			location: newAppointment.location,
			locationDetails: newAppointment.locationDetails,
			reminder: newAppointment.reminder,
			agenda: newAppointment.agenda,
			notes: newAppointment.notes,
			clientId: newAppointment.clientId || null,
			clientName: client
				? `${client.firstName || ""} ${client.lastName || ""}`.trim() ||
					client.email
				: null,
			clientEmail: client?.email || null,
			clientPhone: client?.mobile || null,
		});
	};

	const handleMarkComplete = () => {
		if (!selectedAppointment) return;
		updateMutation.mutate({
			id: selectedAppointment.id,
			data: { status: "completed" },
		});
	};

	const handleCancelAppointment = () => {
		if (!selectedAppointment) return;
		deleteMutation.mutate(selectedAppointment.id);
	};

	const handleDownloadICS = () => {
		if (!selectedAppointment) return;
		downloadICS(selectedAppointment);
		toast({
			title: "Calendar file downloaded",
			description: "Open the .ics file to add to your calendar",
		});
	};

	const handleSendReminder = (method: "email" | "sms") => {
		if (!selectedAppointment) return;
		sendReminderMutation.mutate({ id: selectedAppointment.id, method });
	};

	const renderMonthView = () => {
		const days = getDaysInMonth();
		const weekDays = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

		return (
			<div className="bg-background rounded-lg border border-border overflow-hidden">
				<div className="grid grid-cols-7 border-b border-border">
					{weekDays.map((day) => (
						<div
							key={day}
							className="p-3 text-center text-sm font-medium text-muted-foreground bg-card/50"
						>
							{day}
						</div>
					))}
				</div>
				<div className="grid grid-cols-7">
					{days.map((day, idx) => {
						const dayAppointments = getAppointmentsForDate(day);
						const isCurrentMonth = isSameMonth(day, currentDate);
						const isCurrentDay = isToday(day);

						return (
							<div
								key={idx}
								onClick={() => handleDateClick(day)}
								className={`min-h-[100px] p-2 border-b border-r border-border cursor-pointer transition-colors hover:bg-card/50 ${
									!isCurrentMonth ? "bg-background/50" : ""
								} ${isCurrentDay ? "bg-emerald-500/10" : ""}`}
								data-testid={`calendar-day-${format(day, "yyyy-MM-dd")}`}
							>
								<div
									className={`text-sm font-medium mb-1 ${
										isCurrentDay
											? "text-emerald-400"
											: isCurrentMonth
												? "text-foreground"
												: "text-muted-foreground"
									}`}
								>
									{format(day, "d")}
								</div>
								<div className="space-y-1">
									{dayAppointments.slice(0, 3).map((apt) => {
										const config = getMeetingConfig(apt.meetingType);
										return (
											<div
												key={apt.id}
												onClick={(e) => handleAppointmentClick(apt, e)}
												className={`text-xs p-1 rounded truncate ${config.bgLight} ${config.textColor} cursor-pointer hover:opacity-80`}
												data-testid={`appointment-${apt.id}`}
											>
												{apt.startTime} {apt.title}
											</div>
										);
									})}
									{dayAppointments.length > 3 && (
										<div className="text-xs text-muted-foreground">
											+{dayAppointments.length - 3} more
										</div>
									)}
								</div>
							</div>
						);
					})}
				</div>
			</div>
		);
	};

	const renderWeekView = () => {
		const days = getDaysInWeek();

		return (
			<div className="bg-background rounded-lg border border-border overflow-hidden">
				<div className="grid grid-cols-8 border-b border-border">
					<div className="p-3 text-center text-sm font-medium text-muted-foreground bg-card/50">
						Time
					</div>
					{days.map((day) => (
						<div
							key={day.toString()}
							className={`p-3 text-center text-sm font-medium bg-card/50 ${
								isToday(day) ? "text-emerald-400" : "text-muted-foreground"
							}`}
						>
							<div>{format(day, "EEE")}</div>
							<div className="text-lg">{format(day, "d")}</div>
						</div>
					))}
				</div>
				<div className="max-h-[500px] overflow-y-auto">
					{TIME_SLOTS.map(({ hour, label }) => (
						<div key={hour} className="grid grid-cols-8 border-b border-border">
							<div className="p-2 text-xs text-muted-foreground bg-card/30">
								{label}
							</div>
							{days.map((day) => {
								const dayAppointments = getAppointmentsForDate(day).filter(
									(apt) =>
										Number.parseInt(apt.startTime.split(":")[0]) === hour,
								);
								return (
									<div
										key={day.toString()}
										onClick={() => handleDateClick(day)}
										className="p-1 border-l border-border min-h-[50px] hover:bg-card/30 cursor-pointer"
									>
										{dayAppointments.map((apt) => {
											const config = getMeetingConfig(apt.meetingType);
											return (
												<div
													key={apt.id}
													onClick={(e) => handleAppointmentClick(apt, e)}
													className={`text-xs p-1 rounded mb-1 ${config.bgLight} ${config.textColor} cursor-pointer`}
												>
													{apt.title}
												</div>
											);
										})}
									</div>
								);
							})}
						</div>
					))}
				</div>
			</div>
		);
	};

	return (
		<div className="min-h-screen bg-background p-6">
			<div className="max-w-7xl mx-auto">
				<div className="flex flex-col lg:flex-row gap-6">
					<div className="flex-1 space-y-6">
						<div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
							<div>
								<h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
									<CalendarIcon className="h-7 w-7 text-emerald-500" />
									Calendar & Appointments
								</h1>
								<p className="text-muted-foreground mt-1">
									Schedule and manage client meetings
								</p>
							</div>
							<div className="flex items-center gap-3">
								<Tabs
									value={viewMode}
									onValueChange={(v) => setViewMode(v as typeof viewMode)}
								>
									<TabsList className="bg-card border-border">
										<TabsTrigger
											value="month"
											className="data-[state=active]:bg-emerald-600"
											data-testid="button-view-month"
										>
											Month
										</TabsTrigger>
										<TabsTrigger
											value="week"
											className="data-[state=active]:bg-emerald-600"
											data-testid="button-view-week"
										>
											Week
										</TabsTrigger>
									</TabsList>
								</Tabs>
								<Button
									className="bg-emerald-600 hover:bg-emerald-700"
									onClick={() => setShowAddDialog(true)}
									data-testid="button-add-appointment"
								>
									<Plus className="h-4 w-4 mr-2" />
									New Appointment
								</Button>
							</div>
						</div>

						<div className="flex items-center justify-between">
							<Button
								variant="outline"
								size="icon"
								onClick={navigatePrev}
								className="border-border"
								data-testid="button-nav-prev"
							>
								<ChevronLeft className="h-4 w-4" />
							</Button>
							<h2 className="text-xl font-semibold text-foreground">
								{viewMode === "month" && format(currentDate, "MMMM yyyy")}
								{viewMode === "week" &&
									`Week of ${format(startOfWeek(currentDate), "MMM d, yyyy")}`}
							</h2>
							<Button
								variant="outline"
								size="icon"
								onClick={navigateNext}
								className="border-border"
								data-testid="button-nav-next"
							>
								<ChevronRight className="h-4 w-4" />
							</Button>
						</div>

						{appointmentsLoading ? (
							<div className="flex items-center justify-center h-64">
								<Loader2 className="h-8 w-8 animate-spin text-emerald-500" />
							</div>
						) : (
							<>
								{viewMode === "month" && renderMonthView()}
								{viewMode === "week" && renderWeekView()}
							</>
						)}

						<div className="flex gap-4 flex-wrap">
							{Object.entries(MEETING_TYPE_CONFIG).map(([key, config]) => (
								<div key={key} className="flex items-center gap-2">
									<div className={`w-3 h-3 rounded ${config.color}`} />
									<span className="text-sm text-muted-foreground">
										{config.label}
									</span>
								</div>
							))}
						</div>
					</div>

					<div className="w-full lg:w-80 space-y-4">
						<Card className="bg-background border-border">
							<CardHeader className="pb-3">
								<CardTitle className="text-foreground flex items-center gap-2">
									<Clock className="h-5 w-5 text-emerald-500" />
									Today's Schedule
								</CardTitle>
								<CardDescription className="text-muted-foreground">
									{todayAppointments.length} appointment
									{todayAppointments.length !== 1 ? "s" : ""} today
								</CardDescription>
							</CardHeader>
							<CardContent>
								<ScrollArea className="h-48">
									{todayAppointments.length === 0 ? (
										<p className="text-muted-foreground text-sm text-center py-4">
											No appointments today
										</p>
									) : (
										<div className="space-y-3">
											{todayAppointments.map((apt) => {
												const config = getMeetingConfig(apt.meetingType);
												const Icon = config.icon;
												return (
													<div
														key={apt.id}
														onClick={(e) => handleAppointmentClick(apt, e)}
														className="p-3 rounded-lg bg-card/50 hover:bg-card cursor-pointer transition-colors"
														data-testid={`sidebar-today-${apt.id}`}
													>
														<div className="flex items-center gap-2 mb-1">
															<Icon className={`h-4 w-4 ${config.textColor}`} />
															<span className="font-medium text-foreground text-sm">
																{apt.title}
															</span>
														</div>
														<div className="text-xs text-muted-foreground flex items-center gap-2">
															<Clock className="h-3 w-3" />
															{apt.startTime} - {apt.endTime}
														</div>
														{apt.clientName && (
															<div className="text-xs text-muted-foreground mt-1">
																{apt.clientName}
															</div>
														)}
													</div>
												);
											})}
										</div>
									)}
								</ScrollArea>
							</CardContent>
						</Card>

						<Card className="bg-background border-border">
							<CardHeader className="pb-3">
								<CardTitle className="text-foreground flex items-center gap-2">
									<CalendarIcon className="h-5 w-5 text-blue-500" />
									Upcoming Appointments
								</CardTitle>
								<CardDescription className="text-muted-foreground">
									{upcomingAppointments.length} upcoming
								</CardDescription>
							</CardHeader>
							<CardContent>
								<ScrollArea className="h-64">
									{upcomingAppointments.length === 0 ? (
										<p className="text-muted-foreground text-sm text-center py-4">
											No upcoming appointments
										</p>
									) : (
										<div className="space-y-3">
											{upcomingAppointments.slice(0, 8).map((apt) => {
												const config = getMeetingConfig(apt.meetingType);
												return (
													<div
														key={apt.id}
														onClick={(e) => handleAppointmentClick(apt, e)}
														className="p-3 rounded-lg bg-card/50 hover:bg-card cursor-pointer transition-colors"
														data-testid={`sidebar-upcoming-${apt.id}`}
													>
														<div className="flex items-center justify-between mb-1">
															<span className="font-medium text-foreground text-sm">
																{apt.title}
															</span>
															<Badge
																className={`text-xs ${config.bgLight} ${config.textColor} border-0`}
															>
																{config.label}
															</Badge>
														</div>
														<div className="text-xs text-muted-foreground">
															{format(parseISO(apt.date), "EEE, MMM d")} at{" "}
															{apt.startTime}
														</div>
														{apt.clientName && (
															<div className="text-xs text-muted-foreground mt-1">
																{apt.clientName}
															</div>
														)}
													</div>
												);
											})}
										</div>
									)}
								</ScrollArea>
							</CardContent>
						</Card>
					</div>
				</div>
			</div>

			<Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
				<DialogContent className="bg-background border-border text-foreground max-w-lg max-h-[90vh] overflow-y-auto">
					<DialogHeader>
						<DialogTitle>Schedule Appointment</DialogTitle>
						<DialogDescription className="text-muted-foreground">
							Create a new appointment with a client
						</DialogDescription>
					</DialogHeader>
					<div className="space-y-4 mt-4">
						<div>
							<Label htmlFor="apt-title" className="text-muted-foreground">
								Subject/Title *
							</Label>
							<Input
								id="apt-title"
								value={newAppointment.title}
								onChange={(e) =>
									setNewAppointment({
										...newAppointment,
										title: e.target.value,
									})
								}
								className="mt-1 bg-card border-border"
								placeholder="e.g., Portfolio Review, Tax Planning"
								data-testid="input-appointment-title"
							/>
						</div>

						<div className="grid grid-cols-2 gap-4">
							<div>
								<Label className="text-muted-foreground">Client</Label>
								<Select
									value={newAppointment.clientId}
									onValueChange={(value) =>
										setNewAppointment({ ...newAppointment, clientId: value })
									}
								>
									<SelectTrigger
										className="mt-1 bg-card border-border"
										data-testid="select-client"
									>
										<SelectValue placeholder="Select client" />
									</SelectTrigger>
									<SelectContent className="bg-card border-border">
										{clients.map((client) => (
											<SelectItem key={client.id} value={client.id}>
												{client.firstName && client.lastName
													? `${client.firstName} ${client.lastName}`
													: client.email}
											</SelectItem>
										))}
									</SelectContent>
								</Select>
							</div>
							<div>
								<Label className="text-muted-foreground">Meeting Type *</Label>
								<Select
									value={newAppointment.meetingType}
									onValueChange={(value) =>
										setNewAppointment({
											...newAppointment,
											meetingType: value as Appointment["meetingType"],
										})
									}
								>
									<SelectTrigger
										className="mt-1 bg-card border-border"
										data-testid="select-meeting-type"
									>
										<SelectValue />
									</SelectTrigger>
									<SelectContent className="bg-card border-border">
										<SelectItem value="call">Call</SelectItem>
										<SelectItem value="video_call">Video Call</SelectItem>
										<SelectItem value="in_person">In-Person</SelectItem>
										<SelectItem value="office_visit">Office Visit</SelectItem>
									</SelectContent>
								</Select>
							</div>
						</div>

						<div className="grid grid-cols-3 gap-4">
							<div>
								<Label htmlFor="apt-date" className="text-muted-foreground">
									Date *
								</Label>
								<Input
									id="apt-date"
									type="date"
									value={newAppointment.date}
									onChange={(e) =>
										setNewAppointment({
											...newAppointment,
											date: e.target.value,
										})
									}
									className="mt-1 bg-card border-border"
									data-testid="input-date"
								/>
							</div>
							<div>
								<Label htmlFor="apt-time" className="text-muted-foreground">
									Time *
								</Label>
								<Select
									value={newAppointment.startTime}
									onValueChange={(value) =>
										setNewAppointment({ ...newAppointment, startTime: value })
									}
								>
									<SelectTrigger
										className="mt-1 bg-card border-border"
										data-testid="select-time"
									>
										<SelectValue />
									</SelectTrigger>
									<SelectContent className="bg-card border-border">
										{TIME_SLOTS.map(({ hour }) => (
											<SelectItem
												key={hour}
												value={`${hour.toString().padStart(2, "0")}:00`}
											>
												{format(new Date().setHours(hour, 0), "h:mm a")}
											</SelectItem>
										))}
										{TIME_SLOTS.map(({ hour }) => (
											<SelectItem
												key={`${hour}-30`}
												value={`${hour.toString().padStart(2, "0")}:30`}
											>
												{format(new Date().setHours(hour, 30), "h:mm a")}
											</SelectItem>
										))}
									</SelectContent>
								</Select>
							</div>
							<div>
								<Label className="text-muted-foreground">Duration *</Label>
								<Select
									value={newAppointment.duration.toString()}
									onValueChange={(value) =>
										setNewAppointment({
											...newAppointment,
											duration: Number.parseInt(value),
										})
									}
								>
									<SelectTrigger
										className="mt-1 bg-card border-border"
										data-testid="select-duration"
									>
										<SelectValue />
									</SelectTrigger>
									<SelectContent className="bg-card border-border">
										{DURATION_OPTIONS.map((opt) => (
											<SelectItem key={opt.value} value={opt.value.toString()}>
												{opt.label}
											</SelectItem>
										))}
									</SelectContent>
								</Select>
							</div>
						</div>

						<div>
							<Label htmlFor="apt-location" className="text-muted-foreground">
								Location Details
							</Label>
							<Input
								id="apt-location"
								value={newAppointment.locationDetails}
								onChange={(e) =>
									setNewAppointment({
										...newAppointment,
										locationDetails: e.target.value,
									})
								}
								className="mt-1 bg-card border-border"
								placeholder="e.g., Google Meet link, Office address"
							/>
						</div>

						<div>
							<Label className="text-muted-foreground">Reminder</Label>
							<Select
								value={newAppointment.reminder}
								onValueChange={(value) =>
									setNewAppointment({
										...newAppointment,
										reminder: value as Appointment["reminder"],
									})
								}
							>
								<SelectTrigger
									className="mt-1 bg-card border-border"
									data-testid="select-reminder"
								>
									<SelectValue />
								</SelectTrigger>
								<SelectContent className="bg-card border-border">
									{REMINDER_OPTIONS.map((opt) => (
										<SelectItem key={opt.value} value={opt.value}>
											{opt.label}
										</SelectItem>
									))}
								</SelectContent>
							</Select>
						</div>

						<div>
							<Label htmlFor="apt-agenda" className="text-muted-foreground">
								Agenda
							</Label>
							<Textarea
								id="apt-agenda"
								value={newAppointment.agenda}
								onChange={(e) =>
									setNewAppointment({
										...newAppointment,
										agenda: e.target.value,
									})
								}
								className="mt-1 bg-card border-border"
								placeholder="Meeting agenda points..."
								rows={2}
							/>
						</div>

						<div>
							<Label htmlFor="apt-notes" className="text-muted-foreground">
								Notes
							</Label>
							<Textarea
								id="apt-notes"
								value={newAppointment.notes}
								onChange={(e) =>
									setNewAppointment({
										...newAppointment,
										notes: e.target.value,
									})
								}
								className="mt-1 bg-card border-border"
								placeholder="Additional notes..."
								rows={2}
							/>
						</div>

						<div className="flex justify-end gap-3 pt-4">
							<Button
								variant="outline"
								onClick={() => setShowAddDialog(false)}
								className="border-border"
							>
								Cancel
							</Button>
							<Button
								className="bg-emerald-600 hover:bg-emerald-700"
								onClick={handleCreateAppointment}
								disabled={
									!newAppointment.title ||
									!newAppointment.date ||
									!newAppointment.startTime ||
									createMutation.isPending
								}
								data-testid="button-create-appointment"
							>
								{createMutation.isPending && (
									<Loader2 className="h-4 w-4 mr-2 animate-spin" />
								)}
								Schedule Appointment
							</Button>
						</div>
					</div>
				</DialogContent>
			</Dialog>

			<Dialog open={showDetailDialog} onOpenChange={setShowDetailDialog}>
				<DialogContent className="bg-background border-border text-foreground max-w-lg">
					{selectedAppointment && (
						<>
							<DialogHeader>
								<div className="flex items-center justify-between">
									<div className="flex items-center gap-3">
										{(() => {
											const config = getMeetingConfig(
												selectedAppointment.meetingType,
											);
											const Icon = config.icon;
											return (
												<div className={`p-2 rounded-lg ${config.bgLight}`}>
													<Icon className={`h-5 w-5 ${config.textColor}`} />
												</div>
											);
										})()}
										<div>
											<DialogTitle>{selectedAppointment.title}</DialogTitle>
											<div className="flex items-center gap-2 mt-1">
												<Badge
													className={`${getMeetingConfig(selectedAppointment.meetingType).bgLight} ${getMeetingConfig(selectedAppointment.meetingType).textColor} border-0`}
												>
													{
														getMeetingConfig(selectedAppointment.meetingType)
															.label
													}
												</Badge>
												{selectedAppointment.status === "completed" && (
													<Badge className="bg-green-500/20 text-green-400 border-0">
														Completed
													</Badge>
												)}
												{selectedAppointment.status === "cancelled" && (
													<Badge className="bg-red-500/20 text-red-400 border-0">
														Cancelled
													</Badge>
												)}
											</div>
										</div>
									</div>
								</div>
							</DialogHeader>

							<div className="space-y-4 mt-4">
								<div className="grid grid-cols-2 gap-4">
									<div className="flex items-center gap-2 text-muted-foreground">
										<CalendarIcon className="h-4 w-4 text-muted-foreground" />
										<span>
											{format(
												parseISO(selectedAppointment.date),
												"EEEE, MMMM d, yyyy",
											)}
										</span>
									</div>
									<div className="flex items-center gap-2 text-muted-foreground">
										<Clock className="h-4 w-4 text-muted-foreground" />
										<span>
											{selectedAppointment.startTime} -{" "}
											{selectedAppointment.endTime}
										</span>
									</div>
								</div>

								{selectedAppointment.clientName && (
									<div className="flex items-center justify-between p-3 rounded-lg bg-card/50">
										<div className="flex items-center gap-2">
											<User className="h-4 w-4 text-muted-foreground" />
											<div>
												<span className="text-foreground">
													{selectedAppointment.clientName}
												</span>
												{selectedAppointment.clientEmail && (
													<p className="text-xs text-muted-foreground">
														{selectedAppointment.clientEmail}
													</p>
												)}
											</div>
										</div>
										{selectedAppointment.clientId && (
											<Link
												href={`/crm/clients/${selectedAppointment.clientId}`}
											>
												<Button
													variant="ghost"
													size="sm"
													className="text-emerald-400 hover:text-emerald-300"
												>
													<ExternalLink className="h-4 w-4 mr-1" />
													View Profile
												</Button>
											</Link>
										)}
									</div>
								)}

								{selectedAppointment.locationDetails && (
									<div className="flex items-center gap-2 text-muted-foreground">
										<MapPin className="h-4 w-4 text-muted-foreground" />
										<span>{selectedAppointment.locationDetails}</span>
									</div>
								)}

								{selectedAppointment.agenda && (
									<div className="p-3 rounded-lg bg-card/50">
										<p className="text-xs text-muted-foreground mb-1">Agenda</p>
										<p className="text-sm text-muted-foreground">
											{selectedAppointment.agenda}
										</p>
									</div>
								)}

								{selectedAppointment.notes && (
									<div className="p-3 rounded-lg bg-card/50">
										<p className="text-xs text-muted-foreground mb-1">Notes</p>
										<p className="text-sm text-muted-foreground">
											{selectedAppointment.notes}
										</p>
									</div>
								)}

								{selectedAppointment.reminder !== "none" && (
									<div className="flex items-center gap-2 text-muted-foreground text-sm">
										<Bell className="h-4 w-4" />
										<span>
											Reminder:{" "}
											{
												REMINDER_OPTIONS.find(
													(r) => r.value === selectedAppointment.reminder,
												)?.label
											}
										</span>
										{selectedAppointment.reminderSent && (
											<Badge
												variant="outline"
												className="text-xs border-green-500/30 text-green-400"
											>
												Sent
											</Badge>
										)}
									</div>
								)}

								{selectedAppointment.status === "scheduled" && (
									<>
										<div className="flex gap-2 pt-2 border-t border-border">
											<Button
												variant="outline"
												size="sm"
												className="flex-1 border-border"
												onClick={handleDownloadICS}
												data-testid="button-download-ics"
											>
												<Download className="h-4 w-4 mr-2" />
												Add to Calendar
											</Button>
											<Button
												variant="outline"
												size="sm"
												className="border-border"
												onClick={() => handleSendReminder("email")}
												disabled={sendReminderMutation.isPending}
												data-testid="button-send-email-reminder"
											>
												<Mail className="h-4 w-4 mr-1" />
												Email
											</Button>
											<Button
												variant="outline"
												size="sm"
												className="border-border"
												onClick={() => handleSendReminder("sms")}
												disabled={sendReminderMutation.isPending}
												data-testid="button-send-sms-reminder"
											>
												<MessageSquare className="h-4 w-4 mr-1" />
												SMS
											</Button>
										</div>

										<div className="flex justify-between gap-3 pt-2 border-t border-border">
											<Button
												className="bg-emerald-600 hover:bg-emerald-700"
												onClick={handleMarkComplete}
												disabled={updateMutation.isPending}
												data-testid="button-mark-complete"
											>
												<CheckCircle className="h-4 w-4 mr-2" />
												Mark Complete
											</Button>
											<div className="flex gap-2">
												<Button
													variant="outline"
													className="border-red-500/30 text-red-400 hover:bg-red-500/10"
													onClick={handleCancelAppointment}
													disabled={deleteMutation.isPending}
													data-testid="button-cancel-appointment"
												>
													<X className="h-4 w-4 mr-2" />
													Cancel
												</Button>
											</div>
										</div>
									</>
								)}
							</div>
						</>
					)}
				</DialogContent>
			</Dialog>
		</div>
	);
}
