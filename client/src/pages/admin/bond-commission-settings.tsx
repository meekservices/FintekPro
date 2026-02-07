import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { ArrowLeft, Settings, IndianRupee, Percent, Save, Edit2, RefreshCw, TrendingUp, Shield, Building2, Landmark, Coins, Calculator } from "lucide-react";
import { Link } from "wouter";

interface BondCommissionConfig {
  id: string;
  bondType: string;
  bondTypeLabel: string;
  brokerageBps: string;
  brokerageMinAmount: string;
  brokerageMaxAmount: string;
  platformFeeType: string;
  platformFeeFixed: string;
  platformFeePercent: string;
  transactionChargeBps: string;
  stampDutyBps: string;
  sebiTurnoverFeeBps: string;
  gstRate: string;
  isActive: boolean;
  updatedAt: string;
}

const bondTypeIcons: Record<string, any> = {
  g_sec: Landmark,
  corporate: Building2,
  ncd: TrendingUp,
  tax_free: Shield,
  sgb: Coins,
  sdl: Landmark,
  t_bill: IndianRupee,
  infrastructure: Building2,
};

const bondTypeColors: Record<string, string> = {
  g_sec: "bg-blue-100 text-blue-800 border-blue-300",
  corporate: "bg-purple-100 text-purple-800 border-purple-300",
  ncd: "bg-orange-100 text-orange-800 border-orange-300",
  tax_free: "bg-green-100 text-green-800 border-green-300",
  sgb: "bg-yellow-100 text-yellow-800 border-yellow-300",
  sdl: "bg-cyan-100 text-cyan-800 border-cyan-300",
  t_bill: "bg-muted text-foreground border-border",
  infrastructure: "bg-indigo-100 text-indigo-800 border-indigo-300",
};

export default function BondCommissionSettings() {
  const { toast } = useToast();
  const [editingConfig, setEditingConfig] = useState<BondCommissionConfig | null>(null);
  const [formData, setFormData] = useState<Partial<BondCommissionConfig>>({});

  const { data: configs, isLoading } = useQuery<BondCommissionConfig[]>({
    queryKey: ["/api/admin/bond-commission-config"],
  });

  const updateMutation = useMutation({
    mutationFn: (data: { id: string; updates: Partial<BondCommissionConfig> }) =>
      apiRequest(`/api/admin/bond-commission-config/${data.id}`, {
        method: "PUT",
        body: JSON.stringify(data.updates),
      }),
    onSuccess: () => {
      toast({
        title: "Configuration Updated",
        description: "Bond commission settings have been saved successfully.",
      });
      setEditingConfig(null);
      queryClient.invalidateQueries({ queryKey: ["/api/admin/bond-commission-config"] });
    },
    onError: (error: any) => {
      toast({
        variant: "destructive",
        title: "Update Failed",
        description: error.message || "Failed to update commission settings.",
      });
    },
  });

  const toggleActiveMutation = useMutation({
    mutationFn: (data: { id: string; isActive: boolean }) =>
      apiRequest(`/api/admin/bond-commission-config/${data.id}`, {
        method: "PUT",
        body: JSON.stringify({ isActive: data.isActive }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/bond-commission-config"] });
      toast({
        title: "Status Updated",
        description: "Bond type status has been updated.",
      });
    },
  });

  const handleEdit = (config: BondCommissionConfig) => {
    setEditingConfig(config);
    setFormData({
      brokerageBps: config.brokerageBps,
      brokerageMinAmount: config.brokerageMinAmount,
      brokerageMaxAmount: config.brokerageMaxAmount,
      platformFeeType: config.platformFeeType,
      platformFeeFixed: config.platformFeeFixed,
      platformFeePercent: config.platformFeePercent,
      transactionChargeBps: config.transactionChargeBps,
      stampDutyBps: config.stampDutyBps,
      sebiTurnoverFeeBps: config.sebiTurnoverFeeBps,
      gstRate: config.gstRate,
    });
  };

  const handleSave = () => {
    if (!editingConfig) return;
    updateMutation.mutate({
      id: editingConfig.id,
      updates: formData,
    });
  };

  const calculateSampleFees = (config: BondCommissionConfig, amount: number = 100000) => {
    const brokerage = Math.min(
      Math.max(
        (amount * parseFloat(config.brokerageBps || "0")) / 10000,
        parseFloat(config.brokerageMinAmount || "0")
      ),
      parseFloat(config.brokerageMaxAmount || "0")
    );
    
    const platformFee = config.platformFeeType === "fixed" 
      ? parseFloat(config.platformFeeFixed || "0")
      : (amount * parseFloat(config.platformFeePercent || "0")) / 100;
    
    const transactionCharge = (amount * parseFloat(config.transactionChargeBps || "0")) / 10000;
    const stampDuty = (amount * parseFloat(config.stampDutyBps || "0")) / 10000;
    const sebiFee = (amount * parseFloat(config.sebiTurnoverFeeBps || "0")) / 10000;
    
    const subtotal = brokerage + platformFee + transactionCharge;
    const gst = (subtotal * parseFloat(config.gstRate || "0")) / 100;
    
    return {
      brokerage: brokerage.toFixed(2),
      platformFee: platformFee.toFixed(2),
      transactionCharge: transactionCharge.toFixed(2),
      stampDuty: stampDuty.toFixed(2),
      sebiFee: sebiFee.toFixed(4),
      gst: gst.toFixed(2),
      total: (brokerage + platformFee + transactionCharge + stampDuty + sebiFee + gst).toFixed(2),
    };
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6" data-testid="bond-commission-settings">
      <div className="flex items-center gap-4">
        <Link href="/admin">
          <Button variant="ghost" size="icon" data-testid="back-button">
            <ArrowLeft className="h-5 w-5" />
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-foreground">Bond Commission Settings</h1>
          <p className="text-muted-foreground">Configure brokerage and platform fees for each bond type</p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            Commission Configuration
          </CardTitle>
          <CardDescription>
            Set brokerage rates (in basis points), platform fees, and regulatory charges for each bond category.
            1 basis point = 0.01%
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Bond Type</TableHead>
                <TableHead className="text-right">Brokerage (bps)</TableHead>
                <TableHead className="text-right">Min/Max (₹)</TableHead>
                <TableHead className="text-right">Platform Fee</TableHead>
                <TableHead className="text-right">GST %</TableHead>
                <TableHead className="text-center">Status</TableHead>
                <TableHead className="text-right">Sample Fees (₹1L)</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(configs || []).map((config) => {
                const IconComponent = bondTypeIcons[config.bondType] || IndianRupee;
                const colorClass = bondTypeColors[config.bondType] || "bg-muted text-foreground";
                const sampleFees = calculateSampleFees(config);
                
                return (
                  <TableRow key={config.id} data-testid={`config-row-${config.bondType}`}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <div className={`p-2 rounded-lg ${colorClass}`}>
                          <IconComponent className="h-4 w-4" />
                        </div>
                        <div>
                          <p className="font-medium">{config.bondTypeLabel}</p>
                          <Badge variant="outline" className="text-xs">{config.bondType}</Badge>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="text-right font-mono">
                      {parseFloat(config.brokerageBps).toFixed(2)} bps
                    </TableCell>
                    <TableCell className="text-right text-sm">
                      ₹{parseFloat(config.brokerageMinAmount).toFixed(0)} - ₹{parseFloat(config.brokerageMaxAmount).toFixed(0)}
                    </TableCell>
                    <TableCell className="text-right">
                      {config.platformFeeType === "fixed" ? (
                        <span>₹{parseFloat(config.platformFeeFixed).toFixed(0)}</span>
                      ) : (
                        <span>{parseFloat(config.platformFeePercent).toFixed(2)}%</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right font-mono">
                      {parseFloat(config.gstRate).toFixed(0)}%
                    </TableCell>
                    <TableCell className="text-center">
                      <Switch
                        checked={config.isActive}
                        onCheckedChange={(checked) =>
                          toggleActiveMutation.mutate({ id: config.id, isActive: checked })
                        }
                        data-testid={`toggle-${config.bondType}`}
                      />
                    </TableCell>
                    <TableCell className="text-right">
                      <span className="font-semibold text-finance-green">₹{sampleFees.total}</span>
                    </TableCell>
                    <TableCell>
                      <Dialog>
                        <DialogTrigger asChild>
                          <Button 
                            variant="ghost" 
                            size="icon"
                            onClick={() => handleEdit(config)}
                            data-testid={`edit-${config.bondType}`}
                          >
                            <Edit2 className="h-4 w-4" />
                          </Button>
                        </DialogTrigger>
                        <DialogContent className="max-w-2xl">
                          <DialogHeader>
                            <DialogTitle className="flex items-center gap-2">
                              <IconComponent className="h-5 w-5" />
                              Edit {config.bondTypeLabel} Commission
                            </DialogTitle>
                            <DialogDescription>
                              Configure brokerage and fee settings for {config.bondTypeLabel}
                            </DialogDescription>
                          </DialogHeader>

                          <div className="grid gap-6 py-4">
                            <div className="grid grid-cols-3 gap-4">
                              <div className="space-y-2">
                                <Label>Brokerage (basis points)</Label>
                                <div className="relative">
                                  <Input
                                    type="number"
                                    step="0.01"
                                    value={formData.brokerageBps || ""}
                                    onChange={(e) => setFormData({ ...formData, brokerageBps: e.target.value })}
                                    data-testid="input-brokerage-bps"
                                  />
                                  <span className="absolute right-3 top-2 text-sm text-muted-foreground">bps</span>
                                </div>
                                <p className="text-xs text-muted-foreground">
                                  = {((parseFloat(formData.brokerageBps || "0")) / 100).toFixed(4)}%
                                </p>
                              </div>
                              <div className="space-y-2">
                                <Label>Minimum Brokerage (₹)</Label>
                                <Input
                                  type="number"
                                  value={formData.brokerageMinAmount || ""}
                                  onChange={(e) => setFormData({ ...formData, brokerageMinAmount: e.target.value })}
                                  data-testid="input-brokerage-min"
                                />
                              </div>
                              <div className="space-y-2">
                                <Label>Maximum Brokerage (₹)</Label>
                                <Input
                                  type="number"
                                  value={formData.brokerageMaxAmount || ""}
                                  onChange={(e) => setFormData({ ...formData, brokerageMaxAmount: e.target.value })}
                                  data-testid="input-brokerage-max"
                                />
                              </div>
                            </div>

                            <Separator />

                            <div className="grid grid-cols-3 gap-4">
                              <div className="space-y-2">
                                <Label>Platform Fee Type</Label>
                                <Select
                                  value={formData.platformFeeType || "fixed"}
                                  onValueChange={(value) => setFormData({ ...formData, platformFeeType: value })}
                                >
                                  <SelectTrigger data-testid="select-fee-type">
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="fixed">Fixed Amount</SelectItem>
                                    <SelectItem value="percentage">Percentage</SelectItem>
                                  </SelectContent>
                                </Select>
                              </div>
                              <div className="space-y-2">
                                <Label>Fixed Fee (₹)</Label>
                                <Input
                                  type="number"
                                  value={formData.platformFeeFixed || ""}
                                  onChange={(e) => setFormData({ ...formData, platformFeeFixed: e.target.value })}
                                  disabled={formData.platformFeeType === "percentage"}
                                  data-testid="input-platform-fixed"
                                />
                              </div>
                              <div className="space-y-2">
                                <Label>Percentage Fee (%)</Label>
                                <Input
                                  type="number"
                                  step="0.01"
                                  value={formData.platformFeePercent || ""}
                                  onChange={(e) => setFormData({ ...formData, platformFeePercent: e.target.value })}
                                  disabled={formData.platformFeeType === "fixed"}
                                  data-testid="input-platform-percent"
                                />
                              </div>
                            </div>

                            <Separator />

                            <div className="grid grid-cols-4 gap-4">
                              <div className="space-y-2">
                                <Label>Transaction Charge (bps)</Label>
                                <Input
                                  type="number"
                                  step="0.01"
                                  value={formData.transactionChargeBps || ""}
                                  onChange={(e) => setFormData({ ...formData, transactionChargeBps: e.target.value })}
                                  data-testid="input-transaction-bps"
                                />
                              </div>
                              <div className="space-y-2">
                                <Label>Stamp Duty (bps)</Label>
                                <Input
                                  type="number"
                                  step="0.01"
                                  value={formData.stampDutyBps || ""}
                                  onChange={(e) => setFormData({ ...formData, stampDutyBps: e.target.value })}
                                  data-testid="input-stamp-bps"
                                />
                              </div>
                              <div className="space-y-2">
                                <Label>SEBI Fee (bps)</Label>
                                <Input
                                  type="number"
                                  step="0.0001"
                                  value={formData.sebiTurnoverFeeBps || ""}
                                  onChange={(e) => setFormData({ ...formData, sebiTurnoverFeeBps: e.target.value })}
                                  data-testid="input-sebi-bps"
                                />
                              </div>
                              <div className="space-y-2">
                                <Label>GST Rate (%)</Label>
                                <Input
                                  type="number"
                                  value={formData.gstRate || ""}
                                  onChange={(e) => setFormData({ ...formData, gstRate: e.target.value })}
                                  data-testid="input-gst"
                                />
                              </div>
                            </div>

                            <Card className="bg-muted">
                              <CardHeader className="py-3">
                                <CardTitle className="text-sm flex items-center gap-2">
                                  <Calculator className="h-4 w-4" />
                                  Sample Fee Calculation (₹1,00,000 order)
                                </CardTitle>
                              </CardHeader>
                              <CardContent className="py-2">
                                <div className="grid grid-cols-2 gap-2 text-sm">
                                  <div className="flex justify-between">
                                    <span>Brokerage:</span>
                                    <span className="font-mono">₹{calculateSampleFees({ ...config, ...formData } as BondCommissionConfig).brokerage}</span>
                                  </div>
                                  <div className="flex justify-between">
                                    <span>Platform Fee:</span>
                                    <span className="font-mono">₹{calculateSampleFees({ ...config, ...formData } as BondCommissionConfig).platformFee}</span>
                                  </div>
                                  <div className="flex justify-between">
                                    <span>Transaction Charge:</span>
                                    <span className="font-mono">₹{calculateSampleFees({ ...config, ...formData } as BondCommissionConfig).transactionCharge}</span>
                                  </div>
                                  <div className="flex justify-between">
                                    <span>Stamp Duty:</span>
                                    <span className="font-mono">₹{calculateSampleFees({ ...config, ...formData } as BondCommissionConfig).stampDuty}</span>
                                  </div>
                                  <div className="flex justify-between">
                                    <span>GST:</span>
                                    <span className="font-mono">₹{calculateSampleFees({ ...config, ...formData } as BondCommissionConfig).gst}</span>
                                  </div>
                                  <div className="flex justify-between font-semibold text-finance-green">
                                    <span>Total Fees:</span>
                                    <span className="font-mono">₹{calculateSampleFees({ ...config, ...formData } as BondCommissionConfig).total}</span>
                                  </div>
                                </div>
                              </CardContent>
                            </Card>
                          </div>

                          <DialogFooter>
                            <Button
                              onClick={handleSave}
                              disabled={updateMutation.isPending}
                              data-testid="save-config"
                            >
                              <Save className="h-4 w-4 mr-2" />
                              {updateMutation.isPending ? "Saving..." : "Save Changes"}
                            </Button>
                          </DialogFooter>
                        </DialogContent>
                      </Dialog>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calculator className="h-5 w-5" />
            Fee Calculator Preview
          </CardTitle>
          <CardDescription>
            See how fees will appear to customers in order dialogs
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {(configs || []).filter(c => c.isActive).slice(0, 4).map((config) => {
              const fees = calculateSampleFees(config, 50000);
              return (
                <Card key={config.id} className="border-dashed">
                  <CardHeader className="py-3">
                    <CardTitle className="text-sm">{config.bondTypeLabel}</CardTitle>
                    <CardDescription className="text-xs">₹50,000 order</CardDescription>
                  </CardHeader>
                  <CardContent className="py-2 space-y-1 text-xs">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Brokerage</span>
                      <span>₹{fees.brokerage}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Platform Fee</span>
                      <span>₹{fees.platformFee}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Charges + GST</span>
                      <span>₹{(parseFloat(fees.transactionCharge) + parseFloat(fees.gst)).toFixed(2)}</span>
                    </div>
                    <Separator className="my-1" />
                    <div className="flex justify-between font-semibold">
                      <span>Total</span>
                      <span className="text-finance-green">₹{fees.total}</span>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
