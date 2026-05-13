import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Shield as LucideShield, AlertTriangle, CheckCircle, User, Activity } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/hooks/useAuth";
import { LoadingState } from "@/components/LoadingState";

interface AMLScreeningData {
  firstName: string;
  lastName: string;
  dateOfBirth: string;
  nationality: string;
  countryOfResidence: string;
  passportNumber: string;
}

interface AMLAlert {
  id: string;
  userId: string;
  alertType: string;
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  status: string;
  description: string;
  createdAt: string;
}

export default function AMLMonitoring() {
  const [screeningData, setScreeningData] = useState<AMLScreeningData>({
    firstName: "",
    lastName: "",
    dateOfBirth: "",
    nationality: "",
    countryOfResidence: "",
    passportNumber: ""
  });
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const userId = user?.id || '';

  // Fetch AML alerts
  const { data: alerts, isLoading: alertsLoading } = useQuery({
    queryKey: ["/api/aml/alerts", userId],
    enabled: !!userId,
  });

  // AML screening mutation
  const screeningMutation = useMutation({
    mutationFn: (data: AMLScreeningData) => 
      apiRequest("/api/aml/screen", "POST", { body: data }),
    onSuccess: () => {
      toast({
        title: "AML Screening Completed",
        description: "Customer screening has been completed successfully.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/aml/alerts", userId] });
      setScreeningData({
        firstName: "",
        lastName: "",
        dateOfBirth: "",
        nationality: "",
        countryOfResidence: "",
        passportNumber: ""
      });
    },
    onError: () => {
      toast({
        title: "Screening Failed",
        description: "Failed to complete AML screening. Please try again.",
        variant: "destructive",
      });
    },
  });

  const handleScreening = (e: React.FormEvent) => {
    e.preventDefault();
    screeningMutation.mutate(screeningData);
  };

  const getRiskBadgeColor = (riskLevel: string) => {
    switch (riskLevel) {
      case 'low': return 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-200';
      case 'medium': return 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-200';
      case 'high': return 'bg-orange-100 dark:bg-orange-900/30 text-orange-800 dark:text-orange-200';
      case 'critical': return 'bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-200';
      default: return 'bg-muted text-foreground';
    }
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center gap-3 mb-6">
        <LucideShield className="h-8 w-8 text-blue-600" />
        <div>
          <h1 className="text-3xl font-bold">AML Monitoring & Compliance</h1>
          <p className="text-muted-foreground">Anti-Money Laundering screening and monitoring dashboard</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Customer Screening Form */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <User className="h-5 w-5" />
              Customer Screening
            </CardTitle>
            <CardDescription>
              Screen customers against global sanctions, PEP, and watchlists
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleScreening} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="firstName">First Name</Label>
                  <Input
                    id="firstName"
                    value={screeningData.firstName}
                    onChange={(e) => setScreeningData(prev => ({ ...prev, firstName: e.target.value }))}
                    placeholder="Enter first name"
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="lastName">Last Name</Label>
                  <Input
                    id="lastName"
                    value={screeningData.lastName}
                    onChange={(e) => setScreeningData(prev => ({ ...prev, lastName: e.target.value }))}
                    placeholder="Enter last name"
                    required
                  />
                </div>
              </div>
              
              <div>
                <Label htmlFor="dateOfBirth">Date of Birth</Label>
                <Input
                  id="dateOfBirth"
                  type="date"
                  value={screeningData.dateOfBirth}
                  onChange={(e) => setScreeningData(prev => ({ ...prev, dateOfBirth: e.target.value }))}
                  required
                />
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="nationality">Nationality</Label>
                  <Input
                    id="nationality"
                    value={screeningData.nationality}
                    onChange={(e) => setScreeningData(prev => ({ ...prev, nationality: e.target.value }))}
                    placeholder="e.g., US, UK, IN"
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="countryOfResidence">Country of Residence</Label>
                  <Input
                    id="countryOfResidence"
                    value={screeningData.countryOfResidence}
                    onChange={(e) => setScreeningData(prev => ({ ...prev, countryOfResidence: e.target.value }))}
                    placeholder="e.g., US, UK, IN"
                    required
                  />
                </div>
              </div>
              
              <div>
                <Label htmlFor="passportNumber">Passport Number (Optional)</Label>
                <Input
                  id="passportNumber"
                  value={screeningData.passportNumber}
                  onChange={(e) => setScreeningData(prev => ({ ...prev, passportNumber: e.target.value }))}
                  placeholder="Enter passport number"
                />
              </div>
              
              <Button 
                type="submit" 
                className="w-full"
                disabled={screeningMutation.isPending}
                data-testid="button-screen-customer"
              >
                {screeningMutation.isPending ? "Screening..." : "Run AML Screening"}
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* AML Alerts */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Activity className="h-5 w-5" />
              Recent AML Alerts
            </CardTitle>
            <CardDescription>
              Latest compliance alerts and risk indicators
            </CardDescription>
          </CardHeader>
          <CardContent>
            {alertsLoading ? (
              <LoadingState variant="list" count={3} />
            ) : alerts && Array.isArray(alerts) && alerts.length > 0 ? (
              <div className="space-y-3 max-h-80 overflow-y-auto">
                {Array.isArray(alerts) ? alerts.map((alert: AMLAlert) => (
                  <div key={alert.id} className="border rounded-lg p-4 space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <AlertTriangle className="h-4 w-4 text-orange-500" />
                        <span className="font-medium">{alert.alertType}</span>
                      </div>
                      <Badge className={getRiskBadgeColor(alert.riskLevel)}>
                        {(alert.riskLevel || 'unknown').toUpperCase()}
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground">{alert.description}</p>
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <span>Status: {alert.status}</span>
                      <span>{new Date(alert.createdAt).toLocaleDateString()}</span>
                    </div>
                  </div>
                )) : null}
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                <CheckCircle className="h-12 w-12 mx-auto mb-4 text-green-500" />
                <p>No AML alerts found</p>
                <p className="text-sm">All customers are compliant</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* AML Service Health Status */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <LucideShield className="h-5 w-5" />
            AML Service Status
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="text-center p-4 bg-green-50 dark:bg-green-950/30 rounded-lg">
              <CheckCircle className="h-8 w-8 mx-auto mb-2 text-green-500" />
              <p className="font-medium">Sanction Scanner</p>
              <p className="text-sm text-green-600">Operational</p>
            </div>
            <div className="text-center p-4 bg-green-50 dark:bg-green-950/30 rounded-lg">
              <CheckCircle className="h-8 w-8 mx-auto mb-2 text-green-500" />
              <p className="font-medium">ComplyCube</p>
              <p className="text-sm text-green-600">Operational</p>
            </div>
            <div className="text-center p-4 bg-green-50 dark:bg-green-950/30 rounded-lg">
              <CheckCircle className="h-8 w-8 mx-auto mb-2 text-green-500" />
              <p className="font-medium">Sumsub</p>
              <p className="text-sm text-green-600">Operational</p>
            </div>
            <div className="text-center p-4 bg-green-50 dark:bg-green-950/30 rounded-lg">
              <CheckCircle className="h-8 w-8 mx-auto mb-2 text-green-500" />
              <p className="font-medium">Database</p>
              <p className="text-sm text-green-600">Operational</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}