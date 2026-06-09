import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
	DialogHeader,
	DialogTitle,
	DialogTrigger,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/hooks/useAuth";
import {
	Plus,
	Clock,
	CheckCircle2,
	AlertTriangle,
	Calendar,
	User,
	Phone,
	Mail,
	Video,
	FileText,
	Flag,
	ChevronRight,
	CalendarDays,
	ListTodo,
	Timer,
} from "lucide-react";
import {
	format,
	isToday,
	isTomorrow,
	isPast,
	addDays,
	startOfDay,
	endOfDay,
	isWithinInterval,
} from "date-fns";

interface Task {
	id: string;
	title: string;
	description: string;
	clientId: string;
	agentId: string;
	type: string;
	priority: string;
	status: string;
	dueDate: string;
	reminderDate: string;
	createdAt: string;
	completedAt: string | null;
}

const taskTypeIcons: Record<string, any> = {
	call: Phone,
	email: Mail,
	meeting: Video,
	follow_up: Clock,
	document: FileText,
	other: ListTodo,
};

const priorityColors: Record<string, string> = {
	low: "bg-muted",
	medium: "bg-blue-500",
	high: "bg-orange-500",
	urgent: "bg-red-500",
};

export default function AgentCrmTasks() {
	const { toast } = useToast();
	const { user } = useAuth();
	const queryClient = useQueryClient();

	const [newTaskOpen, setNewTaskOpen] = useState(false);
	const [selectedTab, setSelectedTab] = useState("today");
	const [newTask, setNewTask] = useState({
		title: "",
		description: "",
		clientId: "",
		type: "follow_up",
		priority: "medium",
		dueDate: format(new Date(), "yyyy-MM-dd"),
		reminderDate: "",
	});

	const { data: tasks = [], isLoading } = useQuery<Task[]>({
		queryKey: ["/api/crm/tasks", { agentId: user?.id }],
		enabled: !!user?.id,
	});

	const { data: clients } = useQuery<any[]>({
		queryKey: ["/api/users"],
	});

	const createTaskMutation = useMutation({
		mutationFn: (data: any) =>
			apiRequest("/api/crm/tasks", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify(data),
			}),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ["/api/crm/tasks"] });
			setNewTaskOpen(false);
			setNewTask({
				title: "",
				description: "",
				clientId: "",
				type: "follow_up",
				priority: "medium",
				dueDate: format(new Date(), "yyyy-MM-dd"),
				reminderDate: "",
			});
			toast({ title: "Task created" });
		},
	});

	const updateTaskMutation = useMutation({
		mutationFn: ({ id, ...data }: { id: string; status?: string }) =>
			apiRequest(`/api/crm/tasks/${id}`, {
				method: "PATCH",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify(data),
			}),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ["/api/crm/tasks"] });
			toast({ title: "Task updated" });
		},
	});

	const handleCreateTask = () => {
		if (!user?.id || !newTask.title) return;
		createTaskMutation.mutate({
			agentId: user.id,
			...newTask,
		});
	};

	const handleToggleComplete = (task: Task) => {
		const newStatus = task.status === "completed" ? "pending" : "completed";
		updateTaskMutation.mutate({ id: task.id, status: newStatus });
	};

	const today = new Date();
	const tomorrow = addDays(today, 1);
	const nextWeek = addDays(today, 7);

	const filterTasks = (filter: string) => {
		return tasks.filter((task) => {
			if (task.status === "completed") return filter === "completed";
			if (!task.dueDate) return filter === "all";

			const dueDate = new Date(task.dueDate);

			switch (filter) {
				case "today":
					return isToday(dueDate);
				case "tomorrow":
					return isTomorrow(dueDate);
				case "week":
					return isWithinInterval(dueDate, {
						start: startOfDay(today),
						end: endOfDay(nextWeek),
					});
				case "overdue":
					return isPast(dueDate) && !isToday(dueDate);
				case "all":
					return task.status !== "completed";
				default:
					return true;
			}
		});
	};

	const todayTasks = filterTasks("today");
	const tomorrowTasks = filterTasks("tomorrow");
	const overdueTasks = filterTasks("overdue");
	const weekTasks = filterTasks("week");
	const completedTasks = filterTasks("completed");

	const TaskCard = ({ task }: { task: Task }) => {
		const TypeIcon = taskTypeIcons[task.type] || ListTodo;
		const isOverdue =
			task.dueDate &&
			isPast(new Date(task.dueDate)) &&
			task.status !== "completed";

		return (
			<div
				className={`p-3 rounded-lg border bg-card ${isOverdue ? "border-red-500/50" : ""} transition-colors`}
				data-testid={`card-task-${task.id}`}
			>
				<div className="flex items-start gap-3">
					<Checkbox
						checked={task.status === "completed"}
						onCheckedChange={() => handleToggleComplete(task)}
						className="mt-0.5"
						data-testid={`checkbox-task-${task.id}`}
					/>
					<div className="flex-1 min-w-0">
						<div className="flex items-center gap-2">
							<TypeIcon className="h-4 w-4 text-muted-foreground" />
							<span
								className={`font-medium text-sm ${task.status === "completed" ? "line-through text-muted-foreground" : ""}`}
							>
								{task.title}
							</span>
							{isOverdue && (
								<Badge variant="destructive" className="text-xs">
									Overdue
								</Badge>
							)}
						</div>
						{task.description && (
							<p className="text-xs text-muted-foreground mt-1 line-clamp-2">
								{task.description}
							</p>
						)}
						<div className="flex items-center gap-3 mt-2">
							{task.dueDate && (
								<span
									className={`text-xs flex items-center gap-1 ${isOverdue ? "text-red-400" : "text-muted-foreground"}`}
								>
									<Calendar className="h-3 w-3" />
									{format(new Date(task.dueDate), "MMM d, h:mm a")}
								</span>
							)}
							<Badge variant="outline" className="text-xs capitalize">
								{task.type.replace(/_/g, " ")}
							</Badge>
							<div
								className={`h-2 w-2 rounded-full ${priorityColors[task.priority]}`}
								title={task.priority}
							/>
						</div>
					</div>
				</div>
			</div>
		);
	};

	if (isLoading) {
		return (
			<div className="flex items-center justify-center h-64">
				<div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-emerald-500" />
			</div>
		);
	}

	return (
		<div className="space-y-6">
			<div className="flex items-center justify-between">
				<div>
					<h1
						className="text-2xl font-bold flex items-center gap-2"
						data-testid="text-tasks-title"
					>
						<CheckCircle2 className="h-6 w-6 text-emerald-500" />
						Tasks & Reminders
					</h1>
					<p className="text-sm text-muted-foreground">
						Manage your follow-ups and activities
					</p>
				</div>

				<div className="flex items-center gap-4">
					<div className="flex gap-2 text-sm">
						{overdueTasks.length > 0 && (
							<Badge variant="destructive" className="gap-1">
								<AlertTriangle className="h-3 w-3" />
								{overdueTasks.length} overdue
							</Badge>
						)}
						<Badge variant="outline" className="gap-1">
							<Clock className="h-3 w-3" />
							{todayTasks.length} today
						</Badge>
					</div>

					<Dialog open={newTaskOpen} onOpenChange={setNewTaskOpen}>
						<DialogTrigger asChild>
							<Button
								className="bg-emerald-600 hover:bg-emerald-700"
								data-testid="button-new-task"
							>
								<Plus className="h-4 w-4 mr-2" />
								New Task
							</Button>
						</DialogTrigger>
						<DialogContent>
							<DialogHeader>
								<DialogTitle>Create New Task</DialogTitle>
							</DialogHeader>
							<div className="space-y-4 py-4">
								<div>
									<Label>Task Title</Label>
									<Input
										value={newTask.title}
										onChange={(e) =>
											setNewTask({ ...newTask, title: e.target.value })
										}
										placeholder="e.g., Follow up on MF discussion"
										data-testid="input-task-title"
									/>
								</div>
								<div>
									<Label>Description (Optional)</Label>
									<Textarea
										value={newTask.description}
										onChange={(e) =>
											setNewTask({ ...newTask, description: e.target.value })
										}
										placeholder="Add notes..."
										rows={2}
									/>
								</div>
								<div>
									<Label>Related Client (Optional)</Label>
									<Select
										value={newTask.clientId}
										onValueChange={(v) =>
											setNewTask({ ...newTask, clientId: v })
										}
									>
										<SelectTrigger>
											<SelectValue placeholder="Select client..." />
										</SelectTrigger>
										<SelectContent>
											<SelectItem value="">None</SelectItem>
											{clients?.slice(0, 50).map((client: any) => (
												<SelectItem key={client.id} value={client.id}>
													{client.firstName} {client.lastName}
												</SelectItem>
											))}
										</SelectContent>
									</Select>
								</div>
								<div className="grid grid-cols-2 gap-4">
									<div>
										<Label>Type</Label>
										<Select
											value={newTask.type}
											onValueChange={(v) => setNewTask({ ...newTask, type: v })}
										>
											<SelectTrigger>
												<SelectValue />
											</SelectTrigger>
											<SelectContent>
												<SelectItem value="call">Call</SelectItem>
												<SelectItem value="email">Email</SelectItem>
												<SelectItem value="meeting">Meeting</SelectItem>
												<SelectItem value="follow_up">Follow Up</SelectItem>
												<SelectItem value="document">Document</SelectItem>
												<SelectItem value="other">Other</SelectItem>
											</SelectContent>
										</Select>
									</div>
									<div>
										<Label>Priority</Label>
										<Select
											value={newTask.priority}
											onValueChange={(v) =>
												setNewTask({ ...newTask, priority: v })
											}
										>
											<SelectTrigger>
												<SelectValue />
											</SelectTrigger>
											<SelectContent>
												<SelectItem value="low">Low</SelectItem>
												<SelectItem value="medium">Medium</SelectItem>
												<SelectItem value="high">High</SelectItem>
												<SelectItem value="urgent">Urgent</SelectItem>
											</SelectContent>
										</Select>
									</div>
								</div>
								<div className="grid grid-cols-2 gap-4">
									<div>
										<Label>Due Date</Label>
										<Input
											type="datetime-local"
											value={newTask.dueDate}
											onChange={(e) =>
												setNewTask({ ...newTask, dueDate: e.target.value })
											}
										/>
									</div>
									<div>
										<Label>Reminder (Optional)</Label>
										<Input
											type="datetime-local"
											value={newTask.reminderDate}
											onChange={(e) =>
												setNewTask({ ...newTask, reminderDate: e.target.value })
											}
										/>
									</div>
								</div>
								<Button
									className="w-full bg-emerald-600 hover:bg-emerald-700"
									onClick={handleCreateTask}
									disabled={createTaskMutation.isPending || !newTask.title}
									data-testid="button-save-task"
								>
									{createTaskMutation.isPending ? "Creating..." : "Create Task"}
								</Button>
							</div>
						</DialogContent>
					</Dialog>
				</div>
			</div>

			<div className="grid grid-cols-4 gap-4">
				<Card className="bg-gradient-to-br from-red-500/10 to-red-500/5 border-red-500/20">
					<CardContent className="pt-4">
						<div className="flex items-center gap-3">
							<div className="p-2 rounded-lg bg-red-500/20">
								<AlertTriangle className="h-5 w-5 text-red-400" />
							</div>
							<div>
								<p className="text-2xl font-bold text-red-400">
									{overdueTasks.length}
								</p>
								<p className="text-xs text-muted-foreground">Overdue</p>
							</div>
						</div>
					</CardContent>
				</Card>
				<Card className="bg-gradient-to-br from-emerald-500/10 to-emerald-500/5 border-emerald-500/20">
					<CardContent className="pt-4">
						<div className="flex items-center gap-3">
							<div className="p-2 rounded-lg bg-emerald-500/20">
								<CalendarDays className="h-5 w-5 text-emerald-400" />
							</div>
							<div>
								<p className="text-2xl font-bold text-emerald-400">
									{todayTasks.length}
								</p>
								<p className="text-xs text-muted-foreground">Due Today</p>
							</div>
						</div>
					</CardContent>
				</Card>
				<Card className="bg-gradient-to-br from-blue-500/10 to-blue-500/5 border-blue-500/20">
					<CardContent className="pt-4">
						<div className="flex items-center gap-3">
							<div className="p-2 rounded-lg bg-blue-500/20">
								<Timer className="h-5 w-5 text-blue-400" />
							</div>
							<div>
								<p className="text-2xl font-bold text-blue-400">
									{tomorrowTasks.length}
								</p>
								<p className="text-xs text-muted-foreground">Tomorrow</p>
							</div>
						</div>
					</CardContent>
				</Card>
				<Card className="bg-gradient-to-br from-purple-500/10 to-purple-500/5 border-purple-500/20">
					<CardContent className="pt-4">
						<div className="flex items-center gap-3">
							<div className="p-2 rounded-lg bg-purple-500/20">
								<CheckCircle2 className="h-5 w-5 text-purple-400" />
							</div>
							<div>
								<p className="text-2xl font-bold text-purple-400">
									{completedTasks.length}
								</p>
								<p className="text-xs text-muted-foreground">Completed</p>
							</div>
						</div>
					</CardContent>
				</Card>
			</div>

			<Card>
				<CardHeader className="pb-2">
					<Tabs value={selectedTab} onValueChange={setSelectedTab}>
						<TabsList>
							<TabsTrigger value="today" className="gap-1">
								Today
								{todayTasks.length > 0 && (
									<Badge variant="secondary" className="ml-1">
										{todayTasks.length}
									</Badge>
								)}
							</TabsTrigger>
							<TabsTrigger value="tomorrow">Tomorrow</TabsTrigger>
							<TabsTrigger value="week">This Week</TabsTrigger>
							<TabsTrigger value="overdue" className="gap-1">
								Overdue
								{overdueTasks.length > 0 && (
									<Badge variant="destructive" className="ml-1">
										{overdueTasks.length}
									</Badge>
								)}
							</TabsTrigger>
							<TabsTrigger value="completed">Completed</TabsTrigger>
						</TabsList>
					</Tabs>
				</CardHeader>
				<CardContent>
					<ScrollArea className="h-[400px]">
						{selectedTab === "today" && (
							<div className="space-y-2">
								{todayTasks.length === 0 ? (
									<div className="text-center py-8 text-muted-foreground">
										<CheckCircle2 className="h-12 w-12 mx-auto mb-2 opacity-30" />
										<p>No tasks due today</p>
									</div>
								) : (
									todayTasks.map((task) => (
										<TaskCard key={task.id} task={task} />
									))
								)}
							</div>
						)}
						{selectedTab === "tomorrow" && (
							<div className="space-y-2">
								{tomorrowTasks.length === 0 ? (
									<div className="text-center py-8 text-muted-foreground">
										<Calendar className="h-12 w-12 mx-auto mb-2 opacity-30" />
										<p>No tasks due tomorrow</p>
									</div>
								) : (
									tomorrowTasks.map((task) => (
										<TaskCard key={task.id} task={task} />
									))
								)}
							</div>
						)}
						{selectedTab === "week" && (
							<div className="space-y-2">
								{weekTasks.length === 0 ? (
									<div className="text-center py-8 text-muted-foreground">
										<CalendarDays className="h-12 w-12 mx-auto mb-2 opacity-30" />
										<p>No tasks this week</p>
									</div>
								) : (
									weekTasks.map((task) => (
										<TaskCard key={task.id} task={task} />
									))
								)}
							</div>
						)}
						{selectedTab === "overdue" && (
							<div className="space-y-2">
								{overdueTasks.length === 0 ? (
									<div className="text-center py-8 text-muted-foreground">
										<CheckCircle2 className="h-12 w-12 mx-auto mb-2 opacity-30" />
										<p>No overdue tasks - great job!</p>
									</div>
								) : (
									overdueTasks.map((task) => (
										<TaskCard key={task.id} task={task} />
									))
								)}
							</div>
						)}
						{selectedTab === "completed" && (
							<div className="space-y-2">
								{completedTasks.length === 0 ? (
									<div className="text-center py-8 text-muted-foreground">
										<ListTodo className="h-12 w-12 mx-auto mb-2 opacity-30" />
										<p>No completed tasks yet</p>
									</div>
								) : (
									completedTasks.map((task) => (
										<TaskCard key={task.id} task={task} />
									))
								)}
							</div>
						)}
					</ScrollArea>
				</CardContent>
			</Card>
		</div>
	);
}
