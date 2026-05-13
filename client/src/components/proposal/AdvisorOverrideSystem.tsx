import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { 
  Pencil, 
  AlertTriangle, 
  CheckCircle2, 
  User, 
  Shield as LucideShield,
  Clock,
  MessageSquare,
  Undo2,
  Save,
  XCircle
} from "lucide-react";

interface RecommendationOverride {
  originalAction: string;
  originalAmount: number;
  newAction?: string;
  newAmount?: number;
  overrideReason: string;
  overrideCategory: 'client_preference' | 'market_outlook' | 'risk_adjustment' | 'tax_optimization' | 'other';
  overriddenBy: string;
  overriddenAt: string;
}

interface Recommendation {
  id?: string;
  productName: string;
  action: string;
  changeAmount?: number;
  suggestedAmount?: number;
  category?: string;
  riskLevel?: string;
  isOverridden?: boolean;
  override?: RecommendationOverride;
}

interface AdvisorOverrideSystemProps {
  recommendation: Recommendation;
  proposalId: string;
  agentName: string;
  onOverrideComplete?: (updatedRecommendation: Recommendation) => void;
  readOnly?: boolean;
}

const OVERRIDE_CATEGORIES = [
  { value: 'client_preference', label: 'Client Preference', description: 'Client specifically requested this change' },
  { value: 'market_outlook', label: 'Market Outlook', description: 'Based on current market conditions' },
  { value: 'risk_adjustment', label: 'Risk Adjustment', description: 'To better match client risk profile' },
  { value: 'tax_optimization', label: 'Tax Optimization', description: 'For tax efficiency benefits' },
  { value: 'other', label: 'Other', description: 'Other professional judgment' }
];

export function AdvisorOverrideSystem({
  recommendation,
  proposalId,
  agentName,
  onOverrideComplete,
  readOnly = false
}: AdvisorOverrideSystemProps) {
  const { toast } = useToast();
  const [showOverrideDialog, setShowOverrideDialog] = useState(false);
  const [overrideData, setOverrideData] = useState({
    newAction: recommendation.action,
    newAmount: recommendation.changeAmount ?? recommendation.suggestedAmount ?? 0,
    reason: '',
    category: 'client_preference' as const
  });

  const overrideMutation = useMutation({
    mutationFn: async (data: typeof overrideData) => {
      return await apiRequest(`/api/agent-wizard/proposals/${proposalId}/override-recommendation`, {
        method: 'POST',
        body: JSON.stringify({
          recommendationId: recommendation.id || recommendation.productName,
          productName: recommendation.productName,
          originalAction: recommendation.action,
          originalAmount: recommendation.changeAmount ?? recommendation.suggestedAmount ?? 0,
          newAction: data.newAction,
          newAmount: data.newAmount,
          overrideReason: data.reason,
          overrideCategory: data.category,
          overriddenBy: agentName
        })
      });
    },
    onSuccess: (data) => {
      toast({
        title: "Override Applied",
        description: "Recommendation has been modified with advisor notes.",
      });
      setShowOverrideDialog(false);
      if (onOverrideComplete && data.recommendation) {
        onOverrideComplete(data.recommendation);
      }
      queryClient.invalidateQueries({ queryKey: ['/api/agent-wizard/proposals', proposalId] });
    },
    onError: (error: any) => {
      toast({
        title: "Override Failed",
        description: error.message || "Could not apply override",
        variant: "destructive"
      });
    }
  });

  const revertMutation = useMutation({
    mutationFn: async () => {
      return await apiRequest(`/api/agent-wizard/proposals/${proposalId}/revert-override`, {
        method: 'POST',
        body: JSON.stringify({
          recommendationId: recommendation.id || recommendation.productName,
          productName: recommendation.productName
        })
      });
    },
    onSuccess: (data) => {
      toast({
        title: "Override Reverted",
        description: "Recommendation restored to original.",
      });
      if (onOverrideComplete && data.recommendation) {
        onOverrideComplete(data.recommendation);
      }
      queryClient.invalidateQueries({ queryKey: ['/api/agent-wizard/proposals', proposalId] });
    },
    onError: (error: any) => {
      toast({
        title: "Revert Failed",
        description: error.message || "Could not revert override",
        variant: "destructive"
      });
    }
  });

  const amount = recommendation.changeAmount ?? recommendation.suggestedAmount ?? 0;

  if (recommendation.isOverridden && recommendation.override) {
    return (
      <div className="relative">
        <Badge 
          className="absolute -top-2 -right-2 z-10 bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-900/30 dark:text-amber-400 dark:border-amber-700"
        >
          <User className="h-3 w-3 mr-1" />
          Advisor Modified
        </Badge>
        
        <Card className="border-amber-200 dark:border-amber-800 bg-amber-50/50 dark:bg-amber-900/10">
          <CardContent className="pt-4 pb-3">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="font-medium">{recommendation.productName}</span>
                  <Badge variant={recommendation.action === 'BUY' ? 'default' : 'destructive'} className="text-xs">
                    {recommendation.override.newAction || recommendation.action}
                  </Badge>
                </div>
                <span className="font-semibold text-green-600">
                  ₹{(recommendation.override.newAmount ?? amount).toLocaleString('en-IN')}
                </span>
              </div>
              
              <div className="text-xs text-muted-foreground bg-card/50/50 rounded p-2 space-y-1">
                <div className="flex items-center gap-1">
                  <MessageSquare className="h-3 w-3" />
                  <span className="font-medium">Override Reason:</span>
                </div>
                <p>{recommendation.override.overrideReason}</p>
                <div className="flex items-center gap-3 pt-1 border-t border-amber-200 dark:border-amber-800/50">
                  <span className="flex items-center gap-1">
                    <User className="h-3 w-3" />
                    {recommendation.override.overriddenBy}
                  </span>
                  <span className="flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    {new Date(recommendation.override.overriddenAt).toLocaleDateString()}
                  </span>
                </div>
              </div>
              
              {!readOnly && (
                <div className="flex gap-2 pt-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setShowOverrideDialog(true)}
                    className="text-xs h-7"
                  >
                    <Pencil className="h-3 w-3 mr-1" />
                    Edit Override
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => revertMutation.mutate()}
                    disabled={revertMutation.isPending}
                    className="text-xs h-7 text-amber-600 hover:text-amber-700 dark:text-amber-300"
                  >
                    <Undo2 className="h-3 w-3 mr-1" />
                    Revert
                  </Button>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        <OverrideDialog />
      </div>
    );
  }

  function OverrideDialog() {
    return (
      <Dialog open={showOverrideDialog} onOpenChange={setShowOverrideDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Pencil className="h-5 w-5" />
              Override Recommendation
            </DialogTitle>
            <DialogDescription>
              Modify this recommendation with your professional judgment. All overrides are tracked for compliance.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="bg-muted/50 rounded-lg p-3 space-y-1">
              <p className="text-sm font-medium">{recommendation.productName}</p>
              <p className="text-xs text-muted-foreground">
                Original: {recommendation.action} ₹{amount.toLocaleString('en-IN')}
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Action</Label>
                <Select
                  value={overrideData.newAction}
                  onValueChange={(value) => setOverrideData(prev => ({ ...prev, newAction: value }))}
                >
                  <SelectTrigger className="h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="BUY">BUY</SelectItem>
                    <SelectItem value="SELL">SELL</SelectItem>
                    <SelectItem value="HOLD">HOLD</SelectItem>
                    <SelectItem value="SIP">SIP</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Amount (₹)</Label>
                <Input
                  type="number"
                  value={overrideData.newAmount}
                  onChange={(e) => setOverrideData(prev => ({ ...prev, newAmount: parseFloat(e.target.value) || 0 }))}
                  className="h-9"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">Override Category</Label>
              <Select
                value={overrideData.category}
                onValueChange={(value: any) => setOverrideData(prev => ({ ...prev, category: value }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {OVERRIDE_CATEGORIES.map(cat => (
                    <SelectItem key={cat.value} value={cat.value}>
                      <div>
                        <span className="font-medium">{cat.label}</span>
                        <span className="text-xs text-muted-foreground ml-2">{cat.description}</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">Reason for Override *</Label>
              <Textarea
                value={overrideData.reason}
                onChange={(e) => setOverrideData(prev => ({ ...prev, reason: e.target.value }))}
                placeholder="Explain why you're modifying this recommendation..."
                className="min-h-[80px] text-sm"
              />
              <p className="text-xs text-muted-foreground">
                This will be visible on the proposal and stored for compliance records.
              </p>
            </div>

            <div className="flex items-start gap-2 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-3">
              <AlertTriangle className="h-4 w-4 text-amber-600 mt-0.5 flex-shrink-0" />
              <p className="text-xs text-amber-800 dark:text-amber-300">
                Overrides are tracked for regulatory compliance. The proposal will show "Advisor Modified" badge.
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowOverrideDialog(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => overrideMutation.mutate(overrideData)}
              disabled={!overrideData.reason.trim() || overrideMutation.isPending}
            >
              {overrideMutation.isPending ? (
                <>
                  <span className="animate-spin mr-2">⏳</span>
                  Applying...
                </>
              ) : (
                <>
                  <Save className="h-4 w-4 mr-1" />
                  Apply Override
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }

  if (readOnly) {
    return null;
  }

  return (
    <>
      <Button
        variant="ghost"
        size="sm"
        onClick={() => setShowOverrideDialog(true)}
        className="text-xs h-7 opacity-0 group-hover:opacity-100 transition-opacity"
      >
        <Pencil className="h-3 w-3 mr-1" />
        Override
      </Button>
      <OverrideDialog />
    </>
  );
}

export function AdvisorModifiedBadge({ override }: { override?: RecommendationOverride }) {
  if (!override) return null;
  
  return (
    <Badge 
      className="bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-900/30 dark:text-amber-400 dark:border-amber-700 text-[10px]"
      title={`Modified by ${override.overriddenBy}: ${override.overrideReason}`}
    >
      <User className="h-2.5 w-2.5 mr-0.5" />
      Advisor Modified
    </Badge>
  );
}
