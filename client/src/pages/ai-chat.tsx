import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Loader2, Send, Bot, User, AlertCircle, CheckCircle, XCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
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

interface Message {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  createdAt: string;
  functionCall?: any;
  functionResponse?: any;
}

interface ChatSession {
  id: string;
  title: string;
  lastMessageAt: string;
  messageCount: number;
}

interface PendingAction {
  id: string;
  functionName: string;
  actionParams: any;
  status: string;
}

export default function AIChat() {
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [confirmAction, setConfirmAction] = useState<PendingAction | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();

  // Start a new session
  const startSessionMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("/api/chat/sessions", {
        method: "POST",
        body: { sessionType: 'general' },
      });
      return response;
    },
    onSuccess: (data: any) => {
      setCurrentSessionId(data.session.id);
      setMessages(data.messages || []);
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to start chat session",
        variant: "destructive",
      });
    },
  });

  // Get pending actions
  const { data: pendingActions } = useQuery<PendingAction[]>({
    queryKey: ['/api/chat/actions/pending'],
    enabled: !!currentSessionId,
  });

  // Send message
  const sendMessageMutation = useMutation({
    mutationFn: async (message: string) => {
      const response = await apiRequest(`/api/chat/sessions/${currentSessionId}/messages`, {
        method: "POST",
        body: { message },
      });
      return response;
    },
    onSuccess: (data: any) => {
      setMessages(prev => [...prev, data]);
      
      // Check if there are pending actions
      queryClient.invalidateQueries({ queryKey: ['/api/chat/actions/pending'] });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to send message",
        variant: "destructive",
      });
    },
  });

  // Confirm action
  const confirmActionMutation = useMutation({
    mutationFn: async ({ actionId, confirmed }: { actionId: string; confirmed: boolean }) => {
      const response = await apiRequest(`/api/chat/actions/${actionId}/confirm`, {
        method: "POST",
        body: { confirmed },
      });
      return response;
    },
    onSuccess: (data: any) => {
      setMessages(prev => [...prev, data]);
      setConfirmAction(null);
      queryClient.invalidateQueries({ queryKey: ['/api/chat/actions/pending'] });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to confirm action",
        variant: "destructive",
      });
    },
  });

  // Start session on mount
  useEffect(() => {
    if (!currentSessionId) {
      startSessionMutation.mutate();
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
    if (pendingActions && pendingActions.length > 0 && !confirmAction) {
      setConfirmAction(pendingActions[0]);
    }
  }, [pendingActions]);

  const handleSend = () => {
    if (!input.trim() || !currentSessionId) return;

    const userMessage: Message = {
      id: `temp-${Date.now()}`,
      role: 'user',
      content: input,
      createdAt: new Date().toISOString(),
    };

    setMessages(prev => [...prev, userMessage]);
    sendMessageMutation.mutate(input);
    setInput("");
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const formatActionParams = (params: any) => {
    return Object.entries(params).map(([key, value]) => (
      <div key={key} className="flex justify-between py-1">
        <span className="font-medium capitalize">{key.replace(/([A-Z])/g, ' $1').trim()}:</span>
        <span>{JSON.stringify(value)}</span>
      </div>
    ));
  };

  if (!currentSessionId) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="container mx-auto max-w-4xl h-screen flex flex-col p-4">
      {/* Header */}
      <div className="mb-4">
        <h1 className="text-3xl font-bold" data-testid="text-chat-title">AI Financial Advisor</h1>
        <p className="text-muted-foreground">Ask me anything about your portfolio, investments, or financial planning</p>
      </div>

      {/* Messages */}
      <Card className="flex-1 mb-4 overflow-hidden">
        <ScrollArea className="h-full p-4" ref={scrollRef as any}>
          <div className="space-y-4">
            {messages.map((message, index) => (
              <div
                key={message.id || index}
                className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
                data-testid={`message-${message.role}-${index}`}
              >
                <div
                  className={`flex gap-3 max-w-[80%] ${
                    message.role === 'user' ? 'flex-row-reverse' : 'flex-row'
                  }`}
                >
                  {/* Avatar */}
                  <div
                    className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${
                      message.role === 'user'
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-secondary text-secondary-foreground'
                    }`}
                  >
                    {message.role === 'user' ? <User className="h-4 w-4" /> : <Bot className="h-4 w-4" />}
                  </div>

                  {/* Message Content */}
                  <div
                    className={`rounded-lg p-3 ${
                      message.role === 'user'
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-secondary text-secondary-foreground'
                    }`}
                  >
                    <p className="whitespace-pre-wrap break-words">{message.content}</p>
                    
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
              <div className="flex justify-start">
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
        </ScrollArea>
      </Card>

      {/* Input */}
      <div className="flex gap-2">
        <Input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyPress={handleKeyPress}
          placeholder="Type your message..."
          disabled={sendMessageMutation.isPending}
          className="flex-1"
          data-testid="input-chat-message"
        />
        <Button
          onClick={handleSend}
          disabled={!input.trim() || sendMessageMutation.isPending}
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
        <AlertDialog open={!!confirmAction} onOpenChange={() => setConfirmAction(null)}>
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
                    <p className="font-semibold mb-2">{confirmAction.functionName}</p>
                    <div className="text-sm space-y-1">
                      {formatActionParams(confirmAction.actionParams)}
                    </div>
                  </div>

                  <p className="text-sm text-muted-foreground">
                    This action will be executed once you confirm. Please ensure all details are correct.
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
