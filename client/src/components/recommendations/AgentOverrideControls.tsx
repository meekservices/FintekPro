import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Settings, Shield as LucideShield, Lock, Percent, ChevronDown, ChevronUp, Clock, User, AlertTriangle, Plus } from "lucide-react";

interface AgentOverride {
  overrideId: string;
  agentId: string;
  clientId: string;
  overrideType: "mode_downgrade" | "asset_class_lock" | "allocation_cap";
  value: any;
  reason: string;
  timestamp: string;
}

interface AgentOverrideControlsProps {
  clientId: string;
  onOverrideApplied?: () => void;
  className?: string;
}

export function AgentOverrideControls({
  clientId,
  onOverrideApplied,
  className = "",
}: AgentOverrideControlsProps) {
  const { toast } = useToast();
  const [isOpen, setIsOpen] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [overrideType, setOverrideType] = useState<string>("");
  const [overrideValue, setOverrideValue] = useState<string>("");
  const [overrideReason, setOverrideReason] = useState<string>("");

  const { data: overridesData, isLoading } = useQuery<{
    success: boolean;
    clientId: string;
    overrides: AgentOverride[];
    count: number;
  }>({
    queryKey: ["/api/recommendations/overrides", clientId],
    queryFn: async () => {
      const response = await fetch(`/api/recommendations/overrides/${clientId}`, {
        credentials: "include",
      });
      if (!response.ok) {
        if (response.status === 401) return { success: true, clientId, overrides: [], count: 0 };
        throw new Error("Failed to fetch overrides");
      }
      return response.json();
    },
  });

  const createOverrideMutation = useMutation({
    mutationFn: async (data: { overrideType: string; value: any; reason: string }) => {
      const response = await apiRequest("POST", "/api/recommendations/override", {
        clientId,
        ...data,
      });
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Override Applied",
        description: "The override has been recorded and will apply to future recommendations.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/recommendations/overrides", clientId] });
      setDialogOpen(false);
      resetForm();
      onOverrideApplied?.();
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to Apply Override",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const resetForm = () => {
    setOverrideType("");
    setOverrideValue("");
    setOverrideReason("");
  };

  const handleSubmit = () => {
    if (!overrideType || !overrideReason || overrideReason.length < 10) {
      toast({
        title: "Validation Error",
        description: "Please select an override type and provide a reason (min 10 characters).",
        variant: "destructive",
      });
      return;
    }

    let value: any = overrideValue;
    if (overrideType === "allocation_cap") {
      value = parseFloat(overrideValue);
      if (isNaN(value) || value < 0 || value > 100) {
        toast({
          title: "Invalid Value",
          description: "Allocation cap must be between 0 and 100.",
          variant: "destructive",
        });
        return;
      }
    } else if (overrideType === "asset_class_lock") {
      value = overrideValue.split(",").map((s) => s.trim().toUpperCase());
    }

    createOverrideMutation.mutate({
      overrideType,
      value,
      reason: overrideReason,
    });
  };

  const getOverrideIcon = (type: string) => {
    switch (type) {
      case "mode_downgrade":
        return <LucideShield className="h-4 w-4 text-blue-500" />;
      case "asset_class_lock":
        return <Lock className="h-4 w-4 text-orange-500" />;
      case "allocation_cap":
        return <Percent className="h-4 w-4 text-green-500" />;
      default:
        return <Settings className="h-4 w-4" />;
    }
  };

  const formatOverrideType = (type: string) => {
    return type.replace(/_/g, " ").replace(/\b\w/g, (l) => l.toUpperCase());
  };

  const formatValue = (type: string, value: any) => {
    if (type === "allocation_cap") return `${value}%`;
    if (type === "asset_class_lock") return Array.isArray(value) ? value.join(", ") : value;
    return String(value);
  };

  return (
    <Card className={className}>
      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        <CardHeader className="pb-2">
          <CollapsibleTrigger asChild>
            <div className="flex items-center justify-between cursor-pointer" data-testid="override-controls-header">
              <div className="flex items-center gap-2">
                <Settings className="h-5 w-5" />
                <CardTitle className="text-lg">Agent Overrides</CardTitle>
                {overridesData?.count && overridesData.count > 0 && (
                  <Badge variant="secondary">{overridesData.count} active</Badge>
                )}
              </div>
              {isOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </div>
          </CollapsibleTrigger>
          <CardDescription>
            Apply manual controls to recommendations for this client
          </CardDescription>
        </CardHeader>
        
        <CollapsibleContent>
          <CardContent className="space-y-4">
            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
              <DialogTrigger asChild>
                <Button variant="outline" className="w-full" data-testid="button-add-override">
                  <Plus className="h-4 w-4 mr-2" />
                  Add Override
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Add Agent Override</DialogTitle>
                  <DialogDescription>
                    Override the default recommendation behavior for this client.
                    All overrides are logged for compliance purposes.
                  </DialogDescription>
                </DialogHeader>

                <div className="space-y-4 py-4">
                  <div className="space-y-2">
                    <Label htmlFor="overrideType">Override Type</Label>
                    <Select value={overrideType} onValueChange={setOverrideType}>
                      <SelectTrigger data-testid="select-override-type">
                        <SelectValue placeholder="Select override type" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="mode_downgrade">
                          <div className="flex items-center gap-2">
                            <LucideShield className="h-4 w-4 text-blue-500" />
                            Mode Downgrade
                          </div>
                        </SelectItem>
                        <SelectItem value="asset_class_lock">
                          <div className="flex items-center gap-2">
                            <Lock className="h-4 w-4 text-orange-500" />
                            Asset Class Lock
                          </div>
                        </SelectItem>
                        <SelectItem value="allocation_cap">
                          <div className="flex items-center gap-2">
                            <Percent className="h-4 w-4 text-green-500" />
                            Allocation Cap
                          </div>
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {overrideType === "mode_downgrade" && (
                    <div className="space-y-2">
                      <Label htmlFor="modeValue">Target Mode</Label>
                      <Select value={overrideValue} onValueChange={setOverrideValue}>
                        <SelectTrigger data-testid="select-mode-value">
                          <SelectValue placeholder="Select target mode" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="conservative">Conservative</SelectItem>
                          <SelectItem value="balanced">Balanced</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  )}

                  {overrideType === "asset_class_lock" && (
                    <div className="space-y-2">
                      <Label htmlFor="assetClasses">Asset Classes to Lock</Label>
                      <Input
                        id="assetClasses"
                        placeholder="e.g., STOCK, MF, BOND (comma-separated)"
                        value={overrideValue}
                        onChange={(e) => setOverrideValue(e.target.value)}
                        data-testid="input-asset-classes"
                      />
                      <p className="text-xs text-muted-foreground">
                        These asset classes will be excluded from recommendations
                      </p>
                    </div>
                  )}

                  {overrideType === "allocation_cap" && (
                    <div className="space-y-2">
                      <Label htmlFor="allocationCap">Maximum Allocation (%)</Label>
                      <Input
                        id="allocationCap"
                        type="number"
                        min="0"
                        max="100"
                        placeholder="e.g., 30"
                        value={overrideValue}
                        onChange={(e) => setOverrideValue(e.target.value)}
                        data-testid="input-allocation-cap"
                      />
                      <p className="text-xs text-muted-foreground">
                        Maximum allocation per product type
                      </p>
                    </div>
                  )}

                  <div className="space-y-2">
                    <Label htmlFor="reason">Reason for Override</Label>
                    <Textarea
                      id="reason"
                      placeholder="Explain why this override is being applied (min 10 characters)..."
                      value={overrideReason}
                      onChange={(e) => setOverrideReason(e.target.value)}
                      className="min-h-[100px]"
                      data-testid="input-override-reason"
                    />
                    <p className="text-xs text-muted-foreground">
                      This reason will be recorded in the compliance audit log
                    </p>
                  </div>
                </div>

                <DialogFooter>
                  <Button variant="outline" onClick={() => setDialogOpen(false)} data-testid="button-cancel-override">
                    Cancel
                  </Button>
                  <Button
                    onClick={handleSubmit}
                    disabled={createOverrideMutation.isPending}
                    data-testid="button-submit-override"
                  >
                    {createOverrideMutation.isPending ? "Applying..." : "Apply Override"}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>

            {isLoading ? (
              <div className="animate-pulse space-y-2">
                {[1, 2].map((i) => (
                  <div key={i} className="h-16 bg-muted rounded"></div>
                ))}
              </div>
            ) : overridesData?.overrides && overridesData.overrides.length > 0 ? (
              <div className="space-y-2">
                <Label className="text-sm font-medium">Active Overrides</Label>
                {overridesData.overrides.map((override) => (
                  <div
                    key={override.overrideId}
                    className="p-3 border rounded-lg space-y-2"
                    data-testid={`override-item-${override.overrideId}`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        {getOverrideIcon(override.overrideType)}
                        <span className="font-medium text-sm">
                          {formatOverrideType(override.overrideType)}
                        </span>
                      </div>
                      <Badge variant="outline">
                        {formatValue(override.overrideType, override.value)}
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground">{override.reason}</p>
                    <div className="flex items-center gap-4 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {new Date(override.timestamp).toLocaleString()}
                      </span>
                      <span className="flex items-center gap-1">
                        <User className="h-3 w-3" />
                        Agent: {override.agentId}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-4">
                No active overrides for this client
              </p>
            )}

            <Alert className="bg-amber-50 border-amber-200 dark:bg-amber-950/20 dark:border-amber-800">
              <AlertTriangle className="h-4 w-4 text-amber-600" />
              <AlertDescription className="text-amber-800 dark:text-amber-200 text-sm">
                All overrides are immutably logged for compliance and audit purposes.
                Overrides cannot be deleted once applied.
              </AlertDescription>
            </Alert>
          </CardContent>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
}
