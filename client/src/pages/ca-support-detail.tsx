import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useParams, useLocation } from "wouter";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import {
  ArrowLeft,
  CheckCircle2,
  Circle,
  Clock,
  AlertCircle,
  FileText,
  MessageCircle,
  User,
  Calendar,
  Timer,
  Paperclip,
  Send,
  Plus,
  Edit,
  Trash2,
  MoreVertical,
  Play,
  Pause,
  XCircle,
  History,
  Briefcase,
  Phone,
  Mail,
  Building,
  ChevronRight
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface SupportStep {
  id: number;
  templateId: number;
  title: string;
  description: string | null;
  stepNumber: number;
  isRequired: boolean;
  expectedDuration: number;
  status: string;
  completedAt: string | null;
  completedBy: number | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

interface SupportComment {
  id: number;
  stepId: number;
  userId: number;
  comment: string;
  isInternal: boolean;
  attachmentUrl: string | null;
  createdAt: string;
}

interface SupportTemplate {
  id: number;
  title: string;
  description: string | null;
  category: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

interface SupportTicket {
  id: number;
  ticketNumber: string;
  subject: string;
  description: string;
  category: string;
  priority: string;
  status: string;
  clientName: string;
  clientEmail: string;
  clientPhone: string;
  assignedAgentId: number | null;
  templateId: number | null;
  createdAt: string;
  updatedAt: string;
}

export default function CASupportDetail() {
  const { id } = useParams<{ id: string }>();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [newComment, setNewComment] = useState("");
  const [selectedStep, setSelectedStep] = useState<SupportStep | null>(null);
  const [isAddStepOpen, setIsAddStepOpen] = useState(false);
  const [activeTab, setActiveTab] = useState("workflow");

  const [newStep, setNewStep] = useState({
    title: "",
    description: "",
    isRequired: true,
    expectedDuration: 30
  });

  const { data: ticket, isLoading: ticketLoading } = useQuery<SupportTicket>({
    queryKey: ["/api/support/tickets", id],
    enabled: !!id
  });

  const { data: template } = useQuery<SupportTemplate>({
    queryKey: ["/api/support/templates", ticket?.templateId],
    enabled: !!ticket?.templateId
  });

  const { data: steps = [], isLoading: stepsLoading } = useQuery<SupportStep[]>({
    queryKey: ["/api/support/tickets", id, "steps"],
    enabled: !!id
  });

  const { data: comments = [] } = useQuery<SupportComment[]>({
    queryKey: ["/api/support/steps", selectedStep?.id, "comments"],
    enabled: !!selectedStep?.id
  });

  const updateStepMutation = useMutation({
    mutationFn: async ({ stepId, status, notes }: { stepId: number; status: string; notes?: string }) => {
      const res = await apiRequest(`/api/support/steps/${stepId}`, {
        method: "PATCH",
        body: JSON.stringify({ status, notes, completedAt: status === 'completed' ? new Date().toISOString() : null })
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/support/tickets", id, "steps"] });
      toast({ title: "Step updated successfully" });
    },
    onError: () => {
      toast({ title: "Failed to update step", variant: "destructive" });
    }
  });

  const addCommentMutation = useMutation({
    mutationFn: async ({ stepId, comment, isInternal }: { stepId: number; comment: string; isInternal: boolean }) => {
      const res = await apiRequest(`/api/support/steps/${stepId}/comments`, {
        method: "POST",
        body: JSON.stringify({ comment, isInternal, userId: 1 })
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/support/steps", selectedStep?.id, "comments"] });
      setNewComment("");
      toast({ title: "Comment added" });
    }
  });

  const addStepMutation = useMutation({
    mutationFn: async (stepData: { templateId: number; title: string; description: string; stepNumber: number; isRequired: boolean; expectedDuration: number }) => {
      const res = await apiRequest("/api/support/steps", {
        method: "POST",
        body: JSON.stringify(stepData)
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/support/tickets", id, "steps"] });
      setIsAddStepOpen(false);
      setNewStep({ title: "", description: "", isRequired: true, expectedDuration: 30 });
      toast({ title: "Step added successfully" });
    }
  });

  const updateTicketMutation = useMutation({
    mutationFn: async ({ status }: { status: string }) => {
      const res = await apiRequest(`/api/support/tickets/${id}`, {
        method: "PATCH",
        body: JSON.stringify({ status })
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/support/tickets", id] });
      toast({ title: "Ticket status updated" });
    }
  });

  const completedSteps = steps.filter((s) => s.status === "completed").length;
  const progressPercentage = steps.length > 0 ? (completedSteps / steps.length) * 100 : 0;

  const getStatusColor = (status: string) => {
    switch (status) {
      case "completed":
        return "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400";
      case "in_progress":
        return "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400";
      case "blocked":
        return "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400";
      default:
        return "bg-muted text-foreground";
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "completed":
        return <CheckCircle2 className="h-5 w-5 text-green-600" />;
      case "in_progress":
        return <Play className="h-5 w-5 text-blue-600" />;
      case "blocked":
        return <XCircle className="h-5 w-5 text-red-600" />;
      default:
        return <Circle className="h-5 w-5 text-muted-foreground" />;
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case "urgent":
        return "bg-red-500 text-white";
      case "high":
        return "bg-orange-500 text-white";
      case "medium":
        return "bg-yellow-500 text-white";
      default:
        return "bg-muted text-foreground";
    }
  };

  if (ticketLoading) {
    return (
      <div className="container mx-auto p-6">
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
        </div>
      </div>
    );
  }

  if (!ticket) {
    return (
      <div className="container mx-auto p-6">
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <AlertCircle className="h-12 w-12 text-red-500 mb-4" />
            <h2 className="text-xl font-semibold mb-2">Ticket Not Found</h2>
            <p className="text-muted-foreground mb-4">The support ticket you're looking for doesn't exist.</p>
            <Button onClick={() => setLocation("/partner/ca-support")} data-testid="button-back-to-dashboard">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Dashboard
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-muted">
      <div className="container mx-auto p-6">
        <div className="flex items-center gap-4 mb-6">
          <Button variant="ghost" onClick={() => setLocation("/partner/ca-support")} data-testid="button-back">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Button>
          <div className="flex-1">
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold text-foreground">{ticket.subject}</h1>
              <Badge className={getPriorityColor(ticket.priority)}>{ticket.priority}</Badge>
              <Badge className={getStatusColor(ticket.status)}>{ticket.status}</Badge>
            </div>
            <p className="text-muted-foreground">
              {ticket.ticketNumber} • Created {new Date(ticket.createdAt).toLocaleDateString()}
            </p>
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" data-testid="button-ticket-actions">
                <MoreVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {ticket.status !== "resolved" && (
                <DropdownMenuItem onClick={() => updateTicketMutation.mutate({ status: "resolved" })}>
                  <CheckCircle2 className="h-4 w-4 mr-2" />
                  Mark as Resolved
                </DropdownMenuItem>
              )}
              {ticket.status === "open" && (
                <DropdownMenuItem onClick={() => updateTicketMutation.mutate({ status: "in_progress" })}>
                  <Play className="h-4 w-4 mr-2" />
                  Start Working
                </DropdownMenuItem>
              )}
              {ticket.status === "in_progress" && (
                <DropdownMenuItem onClick={() => updateTicketMutation.mutate({ status: "on_hold" })}>
                  <Pause className="h-4 w-4 mr-2" />
                  Put on Hold
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-lg">Workflow Progress</CardTitle>
                    <CardDescription>
                      {completedSteps} of {steps.length} steps completed
                    </CardDescription>
                  </div>
                  <Dialog open={isAddStepOpen} onOpenChange={setIsAddStepOpen}>
                    <DialogTrigger asChild>
                      <Button variant="outline" size="sm" data-testid="button-add-step">
                        <Plus className="h-4 w-4 mr-2" />
                        Add Step
                      </Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>Add New Step</DialogTitle>
                        <DialogDescription>Add a custom step to this workflow</DialogDescription>
                      </DialogHeader>
                      <div className="space-y-4 py-4">
                        <div>
                          <Label>Step Title</Label>
                          <Input
                            value={newStep.title}
                            onChange={(e) => setNewStep({ ...newStep, title: e.target.value })}
                            placeholder="e.g., Verify Income Documents"
                            data-testid="input-step-title"
                          />
                        </div>
                        <div>
                          <Label>Description</Label>
                          <Textarea
                            value={newStep.description}
                            onChange={(e) => setNewStep({ ...newStep, description: e.target.value })}
                            placeholder="Detailed instructions for this step..."
                            data-testid="input-step-description"
                          />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <Label>Expected Duration (minutes)</Label>
                            <Input
                              type="number"
                              value={newStep.expectedDuration}
                              onChange={(e) => setNewStep({ ...newStep, expectedDuration: parseInt(e.target.value) || 30 })}
                              data-testid="input-step-duration"
                            />
                          </div>
                          <div className="flex items-center gap-2 pt-6">
                            <Checkbox
                              id="isRequired"
                              checked={newStep.isRequired}
                              onCheckedChange={(checked) => setNewStep({ ...newStep, isRequired: !!checked })}
                            />
                            <Label htmlFor="isRequired">Required Step</Label>
                          </div>
                        </div>
                      </div>
                      <DialogFooter>
                        <Button variant="outline" onClick={() => setIsAddStepOpen(false)}>Cancel</Button>
                        <Button
                          onClick={() => {
                            if (ticket?.templateId) {
                              addStepMutation.mutate({
                                templateId: ticket.templateId,
                                title: newStep.title,
                                description: newStep.description,
                                stepNumber: steps.length + 1,
                                isRequired: newStep.isRequired,
                                expectedDuration: newStep.expectedDuration
                              });
                            }
                          }}
                          disabled={!newStep.title}
                          data-testid="button-confirm-add-step"
                        >
                          Add Step
                        </Button>
                      </DialogFooter>
                    </DialogContent>
                  </Dialog>
                </div>
                <Progress value={progressPercentage} className="mt-4" />
              </CardHeader>
              <CardContent>
                <Tabs value={activeTab} onValueChange={setActiveTab}>
                  <TabsList className="grid w-full grid-cols-3 mb-4">
                    <TabsTrigger value="workflow" data-testid="tab-workflow">
                      <FileText className="h-4 w-4 mr-2" />
                      Workflow
                    </TabsTrigger>
                    <TabsTrigger value="details" data-testid="tab-details">
                      <Briefcase className="h-4 w-4 mr-2" />
                      Details
                    </TabsTrigger>
                    <TabsTrigger value="history" data-testid="tab-history">
                      <History className="h-4 w-4 mr-2" />
                      History
                    </TabsTrigger>
                  </TabsList>

                  <TabsContent value="workflow" className="mt-0">
                    {stepsLoading ? (
                      <div className="flex justify-center py-8">
                        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary" />
                      </div>
                    ) : steps.length === 0 ? (
                      <div className="text-center py-8 text-muted-foreground">
                        <FileText className="h-12 w-12 mx-auto mb-3 text-muted-foreground" />
                        <p>No workflow steps defined yet.</p>
                        <p className="text-sm">Add steps to create a structured workflow.</p>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {steps.sort((a, b) => a.stepNumber - b.stepNumber).map((step, index) => (
                          <div
                            key={step.id}
                            className={`border rounded-lg p-4 cursor-pointer transition-all hover:border-primary ${
                              selectedStep?.id === step.id ? "border-primary bg-primary/5" : ""
                            }`}
                            onClick={() => setSelectedStep(step)}
                            data-testid={`step-card-${step.id}`}
                          >
                            <div className="flex items-start gap-4">
                              <div className="flex-shrink-0 mt-1">
                                {getStatusIcon(step.status)}
                              </div>
                              <div className="flex-1">
                                <div className="flex items-center justify-between">
                                  <div className="flex items-center gap-2">
                                    <span className="font-medium text-foreground">
                                      {step.stepNumber}. {step.title}
                                    </span>
                                    {step.isRequired && (
                                      <Badge variant="outline" className="text-xs">Required</Badge>
                                    )}
                                  </div>
                                  <Badge className={getStatusColor(step.status)}>{step.status}</Badge>
                                </div>
                                {step.description && (
                                  <p className="text-sm text-muted-foreground mt-1">{step.description}</p>
                                )}
                                <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
                                  <span className="flex items-center gap-1">
                                    <Timer className="h-3 w-3" />
                                    {step.expectedDuration} min
                                  </span>
                                  {step.completedAt && (
                                    <span className="flex items-center gap-1">
                                      <Calendar className="h-3 w-3" />
                                      Completed {new Date(step.completedAt).toLocaleDateString()}
                                    </span>
                                  )}
                                </div>
                              </div>
                              <ChevronRight className="h-5 w-5 text-muted-foreground" />
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </TabsContent>

                  <TabsContent value="details" className="mt-0">
                    <div className="space-y-4">
                      <div>
                        <Label className="text-sm text-muted-foreground">Description</Label>
                        <p className="text-foreground mt-1">{ticket.description}</p>
                      </div>
                      <Separator />
                      <div>
                        <Label className="text-sm text-muted-foreground">Category</Label>
                        <p className="text-foreground mt-1">{ticket.category}</p>
                      </div>
                      {template && (
                        <>
                          <Separator />
                          <div>
                            <Label className="text-sm text-muted-foreground">Template Applied</Label>
                            <p className="text-foreground mt-1">{template.title}</p>
                            <p className="text-sm text-muted-foreground">{template.description}</p>
                          </div>
                        </>
                      )}
                    </div>
                  </TabsContent>

                  <TabsContent value="history" className="mt-0">
                    <div className="space-y-4">
                      <div className="flex items-center gap-3 text-sm">
                        <div className="h-8 w-8 rounded-full bg-green-100 flex items-center justify-center">
                          <CheckCircle2 className="h-4 w-4 text-green-600" />
                        </div>
                        <div>
                          <p className="font-medium">Ticket created</p>
                          <p className="text-muted-foreground">{new Date(ticket.createdAt).toLocaleString()}</p>
                        </div>
                      </div>
                      {ticket.status !== "open" && (
                        <div className="flex items-center gap-3 text-sm">
                          <div className="h-8 w-8 rounded-full bg-blue-100 flex items-center justify-center">
                            <Play className="h-4 w-4 text-blue-600" />
                          </div>
                          <div>
                            <p className="font-medium">Work started</p>
                            <p className="text-muted-foreground">Status changed to {ticket.status}</p>
                          </div>
                        </div>
                      )}
                      {steps.filter(s => s.completedAt).map((step) => (
                        <div key={step.id} className="flex items-center gap-3 text-sm">
                          <div className="h-8 w-8 rounded-full bg-green-100 flex items-center justify-center">
                            <CheckCircle2 className="h-4 w-4 text-green-600" />
                          </div>
                          <div>
                            <p className="font-medium">Completed: {step.title}</p>
                            <p className="text-muted-foreground">{step.completedAt && new Date(step.completedAt).toLocaleString()}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </TabsContent>
                </Tabs>
              </CardContent>
            </Card>

            {selectedStep && (
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="text-lg">{selectedStep.title}</CardTitle>
                      <CardDescription>Step {selectedStep.stepNumber} of {steps.length}</CardDescription>
                    </div>
                    <div className="flex gap-2">
                      {selectedStep.status !== "completed" && (
                        <Button
                          size="sm"
                          onClick={() => updateStepMutation.mutate({ stepId: selectedStep.id, status: "completed" })}
                          data-testid="button-complete-step"
                        >
                          <CheckCircle2 className="h-4 w-4 mr-2" />
                          Complete Step
                        </Button>
                      )}
                      {selectedStep.status === "pending" && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => updateStepMutation.mutate({ stepId: selectedStep.id, status: "in_progress" })}
                          data-testid="button-start-step"
                        >
                          <Play className="h-4 w-4 mr-2" />
                          Start
                        </Button>
                      )}
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  {selectedStep.description && (
                    <div>
                      <Label className="text-sm text-muted-foreground">Instructions</Label>
                      <p className="mt-1 text-foreground">{selectedStep.description}</p>
                    </div>
                  )}

                  <Separator />

                  <div>
                    <Label className="text-sm text-muted-foreground mb-2 block">Comments</Label>
                    <ScrollArea className="h-48 border rounded-md p-3">
                      {comments.length === 0 ? (
                        <p className="text-center text-muted-foreground py-4">No comments yet</p>
                      ) : (
                        <div className="space-y-3">
                          {comments.map((comment) => (
                            <div key={comment.id} className={`p-3 rounded-lg ${comment.isInternal ? "bg-yellow-50 dark:bg-yellow-900/20" : "bg-muted"}`}>
                              <div className="flex items-center gap-2 mb-1">
                                <User className="h-3 w-3 text-muted-foreground" />
                                <span className="text-xs text-muted-foreground">
                                  {new Date(comment.createdAt).toLocaleString()}
                                </span>
                                {comment.isInternal && (
                                  <Badge variant="outline" className="text-xs">Internal</Badge>
                                )}
                              </div>
                              <p className="text-sm">{comment.comment}</p>
                            </div>
                          ))}
                        </div>
                      )}
                    </ScrollArea>
                    <div className="flex gap-2 mt-3">
                      <Textarea
                        value={newComment}
                        onChange={(e) => setNewComment(e.target.value)}
                        placeholder="Add a comment..."
                        className="flex-1"
                        data-testid="input-comment"
                      />
                      <Button
                        onClick={() => addCommentMutation.mutate({ stepId: selectedStep.id, comment: newComment, isInternal: false })}
                        disabled={!newComment.trim()}
                        data-testid="button-send-comment"
                      >
                        <Send className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>

          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <User className="h-5 w-5" />
                  Client Information
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                    <User className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <p className="font-medium text-foreground">{ticket.clientName}</p>
                    <p className="text-sm text-muted-foreground">Client</p>
                  </div>
                </div>
                <Separator />
                <div className="space-y-3">
                  <div className="flex items-center gap-2 text-sm">
                    <Mail className="h-4 w-4 text-muted-foreground" />
                    <span>{ticket.clientEmail}</span>
                  </div>
                  {ticket.clientPhone && (
                    <div className="flex items-center gap-2 text-sm">
                      <Phone className="h-4 w-4 text-muted-foreground" />
                      <span>{ticket.clientPhone}</span>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Clock className="h-5 w-5" />
                  Timeline
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Created</span>
                  <span className="font-medium">{new Date(ticket.createdAt).toLocaleDateString()}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Last Updated</span>
                  <span className="font-medium">{new Date(ticket.updatedAt).toLocaleDateString()}</span>
                </div>
                <Separator />
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Est. Completion</span>
                  <span className="font-medium">
                    {steps.reduce((acc, s) => acc + s.expectedDuration, 0)} min
                  </span>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Quick Actions</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <Button variant="outline" className="w-full justify-start" data-testid="button-send-update">
                  <MessageCircle className="h-4 w-4 mr-2" />
                  Send Client Update
                </Button>
                <Button variant="outline" className="w-full justify-start" data-testid="button-request-docs">
                  <Paperclip className="h-4 w-4 mr-2" />
                  Request Documents
                </Button>
                <Button variant="outline" className="w-full justify-start" data-testid="button-schedule-call">
                  <Phone className="h-4 w-4 mr-2" />
                  Schedule Call
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
