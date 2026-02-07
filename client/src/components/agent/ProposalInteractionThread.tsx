import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { format } from "date-fns";
import {
  MessageSquare,
  Send,
  User,
  Briefcase,
  RefreshCw,
  Edit,
  CheckCircle2,
  Clock,
  AlertCircle
} from "lucide-react";

interface Interaction {
  id: string;
  proposalId: string;
  type: string;
  senderType: 'client' | 'agent';
  content: string;
  revisionDetails?: {
    originalValue?: any;
    newValue?: any;
    field?: string;
    reason?: string;
  };
  isRead: boolean;
  readAt?: string;
  createdAt: string;
}

interface ProposalInteractionThreadProps {
  proposalId: string;
  prospectName: string;
  agentName?: string;
}

const INTERACTION_TYPE_BADGES: Record<string, { label: string; color: string; icon: any }> = {
  question: { label: "Question", color: "bg-blue-100 text-blue-700", icon: MessageSquare },
  answer: { label: "Answer", color: "bg-green-100 text-green-700", icon: CheckCircle2 },
  revision_request: { label: "Revision Request", color: "bg-amber-100 text-amber-700", icon: Edit },
  revision_completed: { label: "Revised", color: "bg-purple-100 text-purple-700", icon: RefreshCw },
  approval: { label: "Approved", color: "bg-green-100 text-green-700", icon: CheckCircle2 },
  rejection: { label: "Rejected", color: "bg-red-100 text-red-700", icon: AlertCircle },
};

export function ProposalInteractionThread({
  proposalId,
  prospectName,
  agentName = "Agent",
}: ProposalInteractionThreadProps) {
  const { toast } = useToast();
  const [newMessage, setNewMessage] = useState("");
  const [messageType, setMessageType] = useState<'answer' | 'revision_completed'>('answer');

  const { data: interactions, isLoading } = useQuery<Interaction[]>({
    queryKey: ['/api/agent/proposals', proposalId, 'interactions'],
    enabled: !!proposalId,
  });

  const addInteractionMutation = useMutation({
    mutationFn: async (data: { type: string; content: string; senderType: string }) => {
      return await apiRequest(`/api/agent/proposals/${proposalId}/interactions`, {
        method: "POST",
        body: JSON.stringify(data),
        headers: { "Content-Type": "application/json" },
      });
    },
    onSuccess: () => {
      toast({ title: "Response Sent", description: "Your response has been added to the thread" });
      queryClient.invalidateQueries({ queryKey: ['/api/agent/proposals', proposalId, 'interactions'] });
      setNewMessage("");
    },
    onError: (error: any) => {
      toast({ title: "Failed to Send", description: error.message, variant: "destructive" });
    },
  });

  const handleSend = () => {
    if (!newMessage.trim()) return;
    addInteractionMutation.mutate({
      type: messageType,
      content: newMessage,
      senderType: 'agent',
    });
  };

  const unreadCount = interactions?.filter(i => !i.isRead && i.senderType === 'client').length || 0;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <MessageSquare className="h-5 w-5" />
              Interaction Thread
              {unreadCount > 0 && (
                <Badge variant="destructive" className="ml-2">{unreadCount} new</Badge>
              )}
            </CardTitle>
            <CardDescription>
              Communication history with {prospectName}
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : interactions && interactions.length > 0 ? (
          <div className="space-y-4 max-h-[400px] overflow-y-auto">
            {interactions.map((interaction) => {
              const typeInfo = INTERACTION_TYPE_BADGES[interaction.type] || INTERACTION_TYPE_BADGES.question;
              const TypeIcon = typeInfo.icon;
              const isAgent = interaction.senderType === 'agent';
              
              return (
                <div
                  key={interaction.id}
                  className={`flex gap-3 ${isAgent ? 'flex-row-reverse' : ''}`}
                >
                  <Avatar className="h-8 w-8">
                    <AvatarFallback className={isAgent ? 'bg-primary text-primary-foreground' : 'bg-muted'}>
                      {isAgent ? <Briefcase className="h-4 w-4" /> : <User className="h-4 w-4" />}
                    </AvatarFallback>
                  </Avatar>
                  <div className={`flex-1 max-w-[80%] ${isAgent ? 'text-right' : ''}`}>
                    <div className={`inline-block p-3 rounded-lg ${
                      isAgent 
                        ? 'bg-primary text-primary-foreground' 
                        : 'bg-muted'
                    }`}>
                      <div className="flex items-center gap-2 mb-1">
                        <Badge className={`${typeInfo.color} text-xs`}>
                          <TypeIcon className="h-3 w-3 mr-1" />
                          {typeInfo.label}
                        </Badge>
                        {!interaction.isRead && !isAgent && (
                          <Badge variant="outline" className="text-xs">Unread</Badge>
                        )}
                      </div>
                      <p className="text-sm">{interaction.content}</p>
                      {interaction.revisionDetails && (
                        <div className="mt-2 p-2 bg-card/10 rounded text-xs">
                          <p>Field: {interaction.revisionDetails.field}</p>
                          {interaction.revisionDetails.reason && (
                            <p>Reason: {interaction.revisionDetails.reason}</p>
                          )}
                        </div>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      {isAgent ? agentName : prospectName} • {format(new Date(interaction.createdAt), 'MMM d, h:mm a')}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="text-center py-8 text-muted-foreground">
            <MessageSquare className="h-12 w-12 mx-auto mb-2 opacity-30" />
            <p>No interactions yet</p>
            <p className="text-sm">Client questions and your responses will appear here</p>
          </div>
        )}

        <Separator />

        <div className="space-y-3">
          <div className="flex gap-2">
            <Button
              variant={messageType === 'answer' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setMessageType('answer')}
            >
              <CheckCircle2 className="h-4 w-4 mr-1" />
              Answer
            </Button>
            <Button
              variant={messageType === 'revision_completed' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setMessageType('revision_completed')}
            >
              <RefreshCw className="h-4 w-4 mr-1" />
              Revision Update
            </Button>
          </div>
          <div className="flex gap-2">
            <Textarea
              placeholder="Type your response..."
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              className="min-h-[80px]"
              data-testid="input-interaction-message"
            />
          </div>
          <div className="flex justify-end">
            <Button
              onClick={handleSend}
              disabled={!newMessage.trim() || addInteractionMutation.isPending}
              data-testid="btn-send-interaction"
            >
              <Send className="h-4 w-4 mr-2" />
              {addInteractionMutation.isPending ? 'Sending...' : 'Send Response'}
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
