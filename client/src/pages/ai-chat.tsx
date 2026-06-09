import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
	Loader2,
	Send,
	Bot,
	User,
	AlertCircle,
	CheckCircle,
	XCircle,
	Settings,
	MessageSquare,
	History,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import {
	Sheet,
	SheetContent,
	SheetDescription,
	SheetHeader,
	SheetTitle,
	SheetTrigger,
} from "@/components/ui/sheet";
import {
	AlertDialog,
	AlertDialogAction,
	AlertDialogCancel,
	AlertDialogContent,
	AlertDialogDescription,
	AlertDialogFooter,
	AlertDialogHeader,
	AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
	Popover,
	PopoverContent,
	PopoverTrigger,
} from "@/components/ui/popover";
import { formatDistanceToNow } from "date-fns";

interface Message {
	id: string;
	role: "user" | "assistant" | "system";
	content: string;
	createdAt: string;
	functionCall?: any;
	functionResponse?: any;
}

interface ChatSession {
	id: string;
	title: string;
	sessionType: string;
	lastMessageAt: string;
	messageCount: number;
	isActive: boolean;
}

interface PendingAction {
	id: string;
	functionName: string;
	actionParams: any;
	status: string;
}

type SessionType =
	| "general"
	| "portfolio_analysis"
	| "tax_advice"
	| "transaction";
type AIProvider = "openai" | "gemini";
type AIModel = "gpt-4o" | "gpt-4o-mini" | "gpt-4.1" | "gemini-2.0-flash-exp";

export default function AIChat() {
	const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
	const [input, setInput] = useState("");
	const [messages, setMessages] = useState<Message[]>([]);
	const [confirmAction, setConfirmAction] = useState<PendingAction | null>(
		null,
	);
	const [sessionType, setSessionType] = useState<SessionType>("general");
	const [provider, setProvider] = useState<AIProvider>("openai");
	const [model, setModel] = useState<AIModel>("gpt-4o");
	const scrollRef = useRef<HTMLDivElement>(null);
	const { toast } = useToast();

	// Get user's chat sessions
	const { data: sessionsData } = useQuery<{
		success: boolean;
		sessions: ChatSession[];
	}>({
		queryKey: ["/api/chat/sessions"],
	});

	// Start a new session
	const startSessionMutation = useMutation({
		mutationFn: async (type: SessionType) => {
			const response = await apiRequest("POST", "/api/chat/sessions", {
				body: { sessionType: type },
			});
			return response;
		},
		onSuccess: (data: any) => {
			if (data.success && data.session) {
				setCurrentSessionId(data.session.id);
				setMessages([]);
				queryClient.invalidateQueries({ queryKey: ["/api/chat/sessions"] });
				toast({
					title: "Session Started",
					description: `New ${sessionType.replace("_", " ")} session created`,
				});
			}
		},
		onError: () => {
			toast({
				title: "Error",
				description: "Failed to start chat session",
				variant: "destructive",
			});
		},
	});

	// Load session messages
	const { data: sessionMessages, isLoading: loadingMessages } = useQuery<{
		success: boolean;
		messages: Message[];
	}>({
		queryKey: ["/api/chat/sessions", currentSessionId, "messages"],
		enabled: !!currentSessionId,
	});

	// Update messages when session messages load
	useEffect(() => {
		if (sessionMessages?.success && sessionMessages.messages) {
			setMessages(sessionMessages.messages);
		}
	}, [sessionMessages]);

	// Get pending actions
	const { data: pendingActionsData } = useQuery<PendingAction[]>({
		queryKey: ["/api/chat/actions/pending"],
		enabled: !!currentSessionId,
	});

	// Send message
	const sendMessageMutation = useMutation({
		mutationFn: async ({
			message,
			providerParam,
			modelParam,
		}: { message: string; providerParam: AIProvider; modelParam: AIModel }) => {
			const response = await apiRequest(
				"POST",
				`/api/chat/sessions/${currentSessionId}/messages`,
				{
					body: {
						content: message,
						provider: providerParam,
						model: modelParam,
					},
				},
			);
			return response;
		},
		onSuccess: (data: any) => {
			if (data.success) {
				// Add both user and AI messages to the display
				if (data.userMessage) {
					setMessages((prev) => [...prev, data.userMessage]);
				}
				if (data.aiMessage) {
					setMessages((prev) => [...prev, data.aiMessage]);
				}

				// Check if there are pending actions
				queryClient.invalidateQueries({
					queryKey: ["/api/chat/actions/pending"],
				});
				queryClient.invalidateQueries({ queryKey: ["/api/chat/sessions"] });
			}
		},
		onError: (error: any) => {
			toast({
				title: "Error",
				description: error.message || "Failed to send message",
				variant: "destructive",
			});
		},
	});

	// Confirm action
	const confirmActionMutation = useMutation({
		mutationFn: async ({
			actionId,
			confirmed,
		}: { actionId: string; confirmed: boolean }) => {
			const response = await apiRequest(
				"POST",
				`/api/chat/actions/${actionId}/confirm`,
				{
					body: { confirmed },
				},
			);
			return response;
		},
		onSuccess: (data: any) => {
			setMessages((prev) => [...prev, data]);
			setConfirmAction(null);
			queryClient.invalidateQueries({
				queryKey: ["/api/chat/actions/pending"],
			});
		},
		onError: () => {
			toast({
				title: "Error",
				description: "Failed to confirm action",
				variant: "destructive",
			});
		},
	});

	// Start session on mount or when session type changes
	useEffect(() => {
		if (!currentSessionId) {
			startSessionMutation.mutate(sessionType);
		}
	}, []);

	// Auto-scroll to bottom
	useEffect(() => {
		if (scrollRef.current) {
			scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
		}
	}, [messages]);

	// Check for pending actions and show confirmation dialog
	useEffect(() => {
		if (pendingActionsData && pendingActionsData.length > 0 && !confirmAction) {
			setConfirmAction(pendingActionsData[0]);
		}
	}, [pendingActionsData]);

	// Update model when provider changes
	useEffect(() => {
		if (provider === "openai") {
			setModel("gpt-4o");
		} else if (provider === "gemini") {
			setModel("gemini-2.0-flash-exp");
		}
	}, [provider]);

	const handleSend = () => {
		if (!input.trim() || !currentSessionId) return;

		const userMessage: Message = {
			id: `temp-${Date.now()}`,
			role: "user",
			content: input,
			createdAt: new Date().toISOString(),
		};

		setMessages((prev) => [...prev, userMessage]);
		sendMessageMutation.mutate({
			message: input,
			providerParam: provider,
			modelParam: model,
		});
		setInput("");
	};

	const handleKeyPress = (e: React.KeyboardEvent) => {
		if (e.key === "Enter" && !e.shiftKey) {
			e.preventDefault();
			handleSend();
		}
	};

	const handleNewSession = (type: SessionType) => {
		setSessionType(type);
		setCurrentSessionId(null);
		setMessages([]);
		startSessionMutation.mutate(type);
	};

	const handleLoadSession = (session: ChatSession) => {
		setCurrentSessionId(session.id);
		setSessionType(session.sessionType as SessionType);
		setMessages([]);
	};

	const formatActionParams = (params: any) => {
		return Object.entries(params).map(([key, value]) => (
			<div key={key} className="flex justify-between py-1">
				<span className="font-medium capitalize">
					{key.replace(/([A-Z])/g, " $1").trim()}:
				</span>
				<span>{JSON.stringify(value)}</span>
			</div>
		));
	};

	const getSessionTypeLabel = (type: string) => {
		const labels: Record<string, string> = {
			general: "General",
			portfolio_analysis: "Portfolio Analysis",
			tax_advice: "Tax Advice",
			transaction: "Transaction",
		};
		return labels[type] || type;
	};

	if (!currentSessionId && startSessionMutation.isPending) {
		return (
			<div className="flex items-center justify-center min-h-screen">
				<div className="text-center space-y-4">
					<Loader2 className="h-8 w-8 animate-spin mx-auto" />
					<p className="text-muted-foreground">Starting chat session...</p>
				</div>
			</div>
		);
	}

	return (
		<div className="container mx-auto max-w-6xl h-screen flex flex-col p-4">
			{/* Header */}
			<div className="mb-4 space-y-4">
				<div className="flex items-center justify-between">
					<div>
						<h1 className="text-3xl font-bold" data-testid="text-chat-title">
							AI Financial Advisor
						</h1>
						<p className="text-muted-foreground">
							Ask me anything about your portfolio, investments, or financial
							planning
						</p>
					</div>

					<div className="flex items-center gap-2">
						{/* Session History */}
						<Sheet>
							<SheetTrigger asChild>
								<Button
									variant="outline"
									size="icon"
									data-testid="button-session-history"
								>
									<History className="h-4 w-4" />
								</Button>
							</SheetTrigger>
							<SheetContent>
								<SheetHeader>
									<SheetTitle>Chat History</SheetTitle>
									<SheetDescription>
										View and resume previous conversations
									</SheetDescription>
								</SheetHeader>
								<ScrollArea className="h-[calc(100vh-200px)] mt-4">
									<div className="space-y-2">
										{sessionsData?.sessions?.map((session) => (
											<Card
												key={session.id}
												className={`p-3 cursor-pointer hover:bg-accent transition-colors ${
													session.id === currentSessionId
														? "border-primary"
														: ""
												}`}
												onClick={() => handleLoadSession(session)}
												data-testid={`session-card-${session.id}`}
											>
												<div className="flex items-start justify-between gap-2">
													<div className="flex-1 min-w-0">
														<p className="font-medium text-sm truncate">
															{session.title}
														</p>
														<p className="text-xs text-muted-foreground">
															{getSessionTypeLabel(session.sessionType)}
														</p>
														<p className="text-xs text-muted-foreground mt-1">
															{session.messageCount} messages •{" "}
															{session.lastMessageAt
																? formatDistanceToNow(
																		new Date(session.lastMessageAt),
																		{ addSuffix: true },
																	)
																: "New"}
														</p>
													</div>
													<MessageSquare className="h-4 w-4 text-muted-foreground flex-shrink-0" />
												</div>
											</Card>
										))}
										{(!sessionsData?.sessions ||
											sessionsData.sessions.length === 0) && (
											<p className="text-sm text-muted-foreground text-center py-8">
												No previous conversations
											</p>
										)}
									</div>
								</ScrollArea>
							</SheetContent>
						</Sheet>

						{/* Settings */}
						<Popover>
							<PopoverTrigger asChild>
								<Button
									variant="outline"
									size="icon"
									data-testid="button-settings"
								>
									<Settings className="h-4 w-4" />
								</Button>
							</PopoverTrigger>
							<PopoverContent className="w-80">
								<div className="space-y-4">
									<h4 className="font-medium text-sm">AI Settings</h4>

									<div className="space-y-2">
										<label className="text-sm font-medium">Provider</label>
										<Select
											value={provider}
											onValueChange={(v) => setProvider(v as AIProvider)}
										>
											<SelectTrigger data-testid="select-provider">
												<SelectValue />
											</SelectTrigger>
											<SelectContent>
												<SelectItem value="openai">OpenAI (ChatGPT)</SelectItem>
												<SelectItem value="gemini">Google Gemini</SelectItem>
											</SelectContent>
										</Select>
									</div>

									<div className="space-y-2">
										<label className="text-sm font-medium">Model</label>
										<Select
											value={model}
											onValueChange={(v) => setModel(v as AIModel)}
										>
											<SelectTrigger data-testid="select-model">
												<SelectValue />
											</SelectTrigger>
											<SelectContent>
												{provider === "openai" ? (
													<>
														<SelectItem value="gpt-4o">
															GPT-5 (Recommended)
														</SelectItem>
														<SelectItem value="gpt-4o-mini">
															GPT-5 Mini
														</SelectItem>
														<SelectItem value="gpt-4.1">GPT-4.1</SelectItem>
													</>
												) : (
													<SelectItem value="gemini-2.0-flash-exp">
														Gemini 2.0 Flash
													</SelectItem>
												)}
											</SelectContent>
										</Select>
									</div>

									<div className="pt-2 border-t text-xs text-muted-foreground">
										<p>Current session: {getSessionTypeLabel(sessionType)}</p>
									</div>
								</div>
							</PopoverContent>
						</Popover>
					</div>
				</div>

				{/* Session Type Tabs */}
				<Tabs
					value={sessionType}
					onValueChange={(v) => handleNewSession(v as SessionType)}
				>
					<TabsList
						className="grid w-full grid-cols-4"
						data-testid="tabs-session-type"
					>
						<TabsTrigger value="general" data-testid="tab-general">
							General
						</TabsTrigger>
						<TabsTrigger value="portfolio_analysis" data-testid="tab-portfolio">
							Portfolio Analysis
						</TabsTrigger>
						<TabsTrigger value="tax_advice" data-testid="tab-tax">
							Tax Advice
						</TabsTrigger>
						<TabsTrigger value="transaction" data-testid="tab-transaction">
							Transaction
						</TabsTrigger>
					</TabsList>
				</Tabs>
			</div>

			{/* Messages */}
			<Card className="flex-1 mb-4 overflow-hidden">
				<ScrollArea className="h-full p-4" ref={scrollRef as any}>
					{loadingMessages ? (
						<div className="flex items-center justify-center h-full">
							<div className="text-center space-y-2">
								<Loader2 className="h-6 w-6 animate-spin mx-auto" />
								<p className="text-sm text-muted-foreground">
									Loading messages...
								</p>
							</div>
						</div>
					) : (
						<div className="space-y-4">
							{messages.length === 0 && (
								<div className="text-center py-12">
									<Bot className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
									<p className="text-muted-foreground">
										Start a conversation! Ask me anything about investments,
										portfolio analysis, tax planning, or financial transactions.
									</p>
								</div>
							)}

							{messages.map((message, index) => (
								<div
									key={message.id || index}
									className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}
									data-testid={`message-${message.role}-${index}`}
								>
									<div
										className={`flex gap-3 max-w-[80%] ${
											message.role === "user" ? "flex-row-reverse" : "flex-row"
										}`}
									>
										{/* Avatar */}
										<div
											className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${
												message.role === "user"
													? "bg-primary text-primary-foreground"
													: "bg-secondary text-secondary-foreground"
											}`}
										>
											{message.role === "user" ? (
												<User className="h-4 w-4" />
											) : (
												<Bot className="h-4 w-4" />
											)}
										</div>

										{/* Message Content */}
										<div
											className={`rounded-lg p-3 ${
												message.role === "user"
													? "bg-primary text-primary-foreground"
													: "bg-secondary text-secondary-foreground"
											}`}
										>
											<p className="whitespace-pre-wrap break-words">
												{message.content}
											</p>

											{message.functionResponse && (
												<div className="mt-2 text-xs opacity-80 border-t pt-2">
													<pre className="overflow-x-auto">
														{JSON.stringify(message.functionResponse, null, 2)}
													</pre>
												</div>
											)}
										</div>
									</div>
								</div>
							))}

							{sendMessageMutation.isPending && (
								<div
									className="flex justify-start"
									data-testid="loading-message"
								>
									<div className="flex gap-3 max-w-[80%]">
										<div className="flex-shrink-0 w-8 h-8 rounded-full bg-secondary flex items-center justify-center">
											<Bot className="h-4 w-4" />
										</div>
										<div className="rounded-lg p-3 bg-secondary">
											<Loader2 className="h-4 w-4 animate-spin" />
										</div>
									</div>
								</div>
							)}
						</div>
					)}
				</ScrollArea>
			</Card>

			{/* Input */}
			<div className="flex gap-2">
				<Input
					value={input}
					onChange={(e) => setInput(e.target.value)}
					onKeyPress={handleKeyPress}
					placeholder="Type your message..."
					disabled={sendMessageMutation.isPending || !currentSessionId}
					className="flex-1"
					data-testid="input-chat-message"
				/>
				<Button
					onClick={handleSend}
					disabled={
						!input.trim() || sendMessageMutation.isPending || !currentSessionId
					}
					data-testid="button-send-message"
				>
					{sendMessageMutation.isPending ? (
						<Loader2 className="h-4 w-4 animate-spin" />
					) : (
						<Send className="h-4 w-4" />
					)}
				</Button>
			</div>

			{/* Confirmation Dialog */}
			{confirmAction && (
				<AlertDialog
					open={!!confirmAction}
					onOpenChange={() => setConfirmAction(null)}
				>
					<AlertDialogContent data-testid="dialog-confirm-action">
						<AlertDialogHeader>
							<AlertDialogTitle className="flex items-center gap-2">
								<AlertCircle className="h-5 w-5 text-amber-500" />
								Confirm Action
							</AlertDialogTitle>
							<AlertDialogDescription>
								<div className="space-y-3">
									<p>Please review and confirm the following action:</p>

									<div className="bg-muted rounded-lg p-3">
										<p className="font-semibold mb-2">
											{confirmAction.functionName}
										</p>
										<div className="text-sm space-y-1">
											{formatActionParams(confirmAction.actionParams)}
										</div>
									</div>

									<p className="text-sm text-muted-foreground">
										This action will be executed once you confirm. Please ensure
										all details are correct.
									</p>
								</div>
							</AlertDialogDescription>
						</AlertDialogHeader>
						<AlertDialogFooter>
							<AlertDialogCancel
								onClick={() => {
									confirmActionMutation.mutate({
										actionId: confirmAction.id,
										confirmed: false,
									});
								}}
								data-testid="button-cancel-action"
							>
								<XCircle className="h-4 w-4 mr-2" />
								Cancel
							</AlertDialogCancel>
							<AlertDialogAction
								onClick={() => {
									confirmActionMutation.mutate({
										actionId: confirmAction.id,
										confirmed: true,
									});
								}}
								data-testid="button-confirm-action"
							>
								<CheckCircle className="h-4 w-4 mr-2" />
								Confirm
							</AlertDialogAction>
						</AlertDialogFooter>
					</AlertDialogContent>
				</AlertDialog>
			)}
		</div>
	);
}
