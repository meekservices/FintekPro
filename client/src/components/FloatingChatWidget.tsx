import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { MessageCircle, X, Minimize2, Send, Loader2, Bot, User } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";

interface Message {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  createdAt: string;
}

export function FloatingChatWidget() {
  const [isOpen, setIsOpen] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const scrollRef = useRef<HTMLDivElement>(null);
  const { user } = useAuth();
  const { toast } = useToast();

  // Note: We don't fetch session history here to avoid infinite re-render loops
  // Messages are managed purely through local state:
  // - Initial messages come from startSessionMutation
  // - New messages are added optimistically (user) and via mutation response (assistant)

  // Start a new session
  const startSessionMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("/api/chat/sessions", {
        method: "POST",
        body: JSON.stringify({ sessionType: 'general' }),
      });
      return response;
    },
    onSuccess: (data: any) => {
      setCurrentSessionId(data.id);
      setMessages([]);
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to start chat session. Please try again.",
        variant: "destructive",
      });
    },
  });

  // Send message
  const sendMessageMutation = useMutation({
    mutationFn: async (message: string) => {
      const response = await apiRequest(`/api/chat/sessions/${currentSessionId}/messages`, {
        method: "POST",
        body: JSON.stringify({ content: message }),
      });
      return response;
    },
    onSuccess: (response: any) => {
      // The API returns { userMessage, aiMessage, session }
      // The user message was already optimistically added to state
      if (response.aiMessage) {
        setMessages(prev => [...prev, response.aiMessage]);
      }
    },
    onError: () => {
      // Remove the optimistic user message on error
      setMessages(prev => prev.slice(0, -1));
      toast({
        title: "Error",
        description: "Failed to send message. Please try again.",
        variant: "destructive",
      });
    },
  });

  // Auto-scroll to bottom
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  // Start session when widget is opened for the first time
  useEffect(() => {
    if (isOpen && !currentSessionId && user) {
      startSessionMutation.mutate();
    }
  }, [isOpen, currentSessionId, user]);

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

  // Don't show widget if user is not logged in
  if (!user) {
    return null;
  }

  return (
    <>
      {/* Floating Button */}
      {!isOpen && (
        <Button
          onClick={() => setIsOpen(true)}
          className="fixed bottom-6 right-6 h-14 w-14 rounded-full shadow-lg z-50"
          size="icon"
          data-testid="button-open-chat"
        >
          <MessageCircle className="h-6 w-6" />
        </Button>
      )}

      {/* Chat Widget */}
      {isOpen && (
        <Card
          className={`fixed bottom-6 right-6 shadow-2xl z-50 transition-all ${
            isMinimized ? 'w-80 h-14' : 'w-96 h-[600px]'
          }`}
          data-testid="card-chat-widget"
        >
          {/* Header */}
          <CardHeader className="flex flex-row items-center justify-between p-4 border-b">
            <CardTitle className="text-lg flex items-center gap-2">
              <Bot className="h-5 w-5" />
              AI Financial Advisor
            </CardTitle>
            <div className="flex gap-1">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setIsMinimized(!isMinimized)}
                className="h-8 w-8"
                data-testid="button-minimize-chat"
              >
                <Minimize2 className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => {
                  setIsOpen(false);
                  setIsMinimized(false);
                }}
                className="h-8 w-8"
                data-testid="button-close-chat"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </CardHeader>

          {/* Messages - Only show when not minimized */}
          {!isMinimized && (
            <CardContent className="flex flex-col p-0 h-[calc(100%-120px)]">
              <ScrollArea className="flex-1 p-4" ref={scrollRef as any}>
                <div className="space-y-4">
                  {messages.map((message, index) => (
                    <div
                      key={message.id || index}
                      className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
                      data-testid={`message-${message.role}-${index}`}
                    >
                      <div
                        className={`flex gap-2 max-w-[85%] ${
                          message.role === 'user' ? 'flex-row-reverse' : 'flex-row'
                        }`}
                      >
                        {/* Avatar */}
                        <div
                          className={`flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center ${
                            message.role === 'user'
                              ? 'bg-primary text-primary-foreground'
                              : 'bg-secondary text-secondary-foreground'
                          }`}
                        >
                          {message.role === 'user' ? <User className="h-3 w-3" /> : <Bot className="h-3 w-3" />}
                        </div>

                        {/* Message Content */}
                        <div
                          className={`rounded-lg p-3 text-sm ${
                            message.role === 'user'
                              ? 'bg-primary text-primary-foreground'
                              : 'bg-secondary text-secondary-foreground'
                          }`}
                        >
                          <p className="whitespace-pre-wrap break-words">{message.content}</p>
                        </div>
                      </div>
                    </div>
                  ))}

                  {sendMessageMutation.isPending && (
                    <div className="flex justify-start">
                      <div className="flex gap-2 max-w-[85%]">
                        <div className="flex-shrink-0 w-7 h-7 rounded-full bg-secondary flex items-center justify-center">
                          <Bot className="h-3 w-3" />
                        </div>
                        <div className="rounded-lg p-3 bg-secondary">
                          <Loader2 className="h-4 w-4 animate-spin" />
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </ScrollArea>

              {/* Input */}
              <div className="p-4 border-t">
                <div className="flex gap-2">
                  <Input
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyPress={handleKeyPress}
                    placeholder={!currentSessionId ? "Initializing chat..." : "Ask me anything..."}
                    disabled={!currentSessionId || sendMessageMutation.isPending || startSessionMutation.isPending}
                    className="flex-1"
                    data-testid="input-chat-message-widget"
                  />
                  <Button
                    onClick={handleSend}
                    disabled={!currentSessionId || !input.trim() || sendMessageMutation.isPending || startSessionMutation.isPending}
                    size="icon"
                    data-testid="button-send-message-widget"
                  >
                    {(sendMessageMutation.isPending || startSessionMutation.isPending) ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Send className="h-4 w-4" />
                    )}
                  </Button>
                </div>
              </div>
            </CardContent>
          )}
        </Card>
      )}
    </>
  );
}
