import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Progress } from "@/components/ui/progress";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Eye, Edit2, AlertTriangle, TrendingUp, Calendar, IndianRupee } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";

interface RiskProfile {
  id: string;
  clientId: string;
  riskTolerance: string;
  investmentHorizon: string;
  investmentExperience: string;
  incomeStability: string;
  liquidityNeeds: string;
  age: number;
  dependents: number;
  monthlyIncome: string;
  monthlyExpenses: string;
  existingAssets: string;
  existingLiabilities: string;
  questionnaire: Record<string, string>;
  riskScore: number;
  assessedBy: string;
  assessmentDate: Date;
  reviewDate: Date;
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}

interface User {
  id: string;
  email: string;
  username: string;
  firstName?: string;
  lastName?: string;
}

const getRiskLevel = (score: number) => {
  if (score <= 30) return { level: "Conservative", color: "bg-green-500", textColor: "text-green-700 dark:text-green-300" };
  if (score <= 50) return { level: "Moderate", color: "bg-yellow-500", textColor: "text-yellow-700 dark:text-yellow-300" };
  if (score <= 70) return { level: "Balanced", color: "bg-blue-500", textColor: "text-blue-700 dark:text-blue-300" };
  if (score <= 85) return { level: "Growth", color: "bg-orange-500", textColor: "text-orange-700 dark:text-orange-300" };
  return { level: "Aggressive", color: "bg-red-500", textColor: "text-red-700 dark:text-red-300" };
};

const formatCurrency = (amount: string) => {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    minimumFractionDigits: 0,
  }).format(parseFloat(amount));
};

export function RiskProfileViewer() {
  const { toast } = useToast();
  const [selectedUserId, setSelectedUserId] = useState<string>("");
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editingNotes, setEditingNotes] = useState("");
  const [editingReviewDate, setEditingReviewDate] = useState("");

  // Fetch all users
  const { data: users = [], isLoading: usersLoading } = useQuery({
    queryKey: ["/api/admin/users"],
  });

  // Fetch risk profiles
  const { data: riskProfiles = [], isLoading: profilesLoading } = useQuery({
    queryKey: ["/api/risk-profiles"],
  });

  // Get risk profile for selected user
  const selectedProfile = riskProfiles.find(
    (profile: RiskProfile) => profile.userId === selectedUserId
  );

  const selectedUser = users.find((user: User) => user.id === selectedUserId);

  // Update risk profile mutation
  const updateProfileMutation = useMutation({
    mutationFn: async (data: { notes: string; reviewDate: string }) => {
      if (!selectedProfile) throw new Error("No profile selected");
      const response = await apiRequest("PUT", `/api/risk-profiles/${selectedProfile.id}`, data);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/risk-profiles"] });
      setEditDialogOpen(false);
      toast({
        title: "Risk profile updated",
        description: "The risk profile has been successfully updated.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Update failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleEditProfile = () => {
    if (!selectedProfile) return;
    setEditingNotes(selectedProfile.notes || "");
    setEditingReviewDate(
      new Date(selectedProfile.reviewDate).toISOString().split("T")[0]
    );
    setEditDialogOpen(true);
  };

  const handleSaveProfile = () => {
    updateProfileMutation.mutate({
      notes: editingNotes,
      reviewDate: editingReviewDate,
    });
  };

  if (usersLoading || profilesLoading) {
    return (
      <Card data-testid="risk-profile-loading">
        <CardContent className="flex items-center justify-center py-8">
          <div className="text-center">
            <div className="animate-spin h-8 w-8 border-b-2 border-primary mx-auto"></div>
            <p className="mt-4">Loading risk profiles...</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6" data-testid="risk-profile-viewer">
      {/* User Selection */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Eye className="h-5 w-5" />
            Customer Risk Profile Viewer
          </CardTitle>
          <CardDescription>
            Select a customer to view their investment risk assessment and profile
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div>
              <Label htmlFor="user-select">Select Customer</Label>
              <Select value={selectedUserId} onValueChange={setSelectedUserId} data-testid="select-customer">
                <SelectTrigger>
                  <SelectValue placeholder="Choose a customer to view their risk profile" />
                </SelectTrigger>
                <SelectContent>
                  {users.map((user: User) => (
                    <SelectItem key={user.id} value={user.id}>
                      {user.firstName && user.lastName
                        ? `${user.firstName} ${user.lastName} (${user.email})`
                        : `${user.username || user.email}`}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Risk Profile Display */}
      {selectedUserId && selectedProfile && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Risk Overview */}
          <Card className="lg:col-span-2">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Risk Assessment Overview</CardTitle>
                  <CardDescription>
                    Customer: {selectedUser?.firstName && selectedUser?.lastName
                      ? `${selectedUser.firstName} ${selectedUser.lastName}`
                      : selectedUser?.username || selectedUser?.email}
                  </CardDescription>
                </div>
                <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
                  <DialogTrigger asChild>
                    <Button variant="outline" size="sm" onClick={handleEditProfile} data-testid="button-edit-profile">
                      <Edit2 className="h-4 w-4 mr-2" />
                      Edit Profile
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Update Risk Profile</DialogTitle>
                      <DialogDescription>
                        Update notes and review date for this customer's risk profile
                      </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4">
                      <div>
                        <Label htmlFor="notes">Notes</Label>
                        <Textarea
                          id="notes"
                          value={editingNotes}
                          onChange={(e) => setEditingNotes(e.target.value)}
                          placeholder="Add any additional notes about this customer's risk profile..."
                          data-testid="textarea-notes"
                        />
                      </div>
                      <div>
                        <Label htmlFor="reviewDate">Next Review Date</Label>
                        <Input
                          id="reviewDate"
                          type="date"
                          value={editingReviewDate}
                          onChange={(e) => setEditingReviewDate(e.target.value)}
                          data-testid="input-review-date"
                        />
                      </div>
                    </div>
                    <DialogFooter>
                      <Button
                        onClick={handleSaveProfile}
                        disabled={updateProfileMutation.isPending}
                        data-testid="button-save-profile"
                      >
                        {updateProfileMutation.isPending ? "Saving..." : "Save Changes"}
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Risk Score */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Overall Risk Score</span>
                  <div className="flex items-center gap-2">
                    <Badge
                      variant="outline"
                      className={`${getRiskLevel(selectedProfile.riskScore).color} text-foreground`}
                      data-testid="badge-risk-level"
                    >
                      {getRiskLevel(selectedProfile.riskScore).level}
                    </Badge>
                    <span className="text-2xl font-bold" data-testid="text-risk-score">
                      {selectedProfile.riskScore}/100
                    </span>
                  </div>
                </div>
                <Progress value={selectedProfile.riskScore} className="h-3" />
              </div>

              <Separator />

              {/* Risk Characteristics */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Risk Tolerance</span>
                    <Badge variant="secondary" data-testid="badge-risk-tolerance">
                      {selectedProfile.riskTolerance}
                    </Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Investment Horizon</span>
                    <Badge variant="secondary" data-testid="badge-investment-horizon">
                      {selectedProfile.investmentHorizon}
                    </Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Experience Level</span>
                    <Badge variant="secondary" data-testid="badge-experience-level">
                      {selectedProfile.investmentExperience}
                    </Badge>
                  </div>
                </div>
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Income Stability</span>
                    <Badge variant="secondary" data-testid="badge-income-stability">
                      {selectedProfile.incomeStability}
                    </Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Liquidity Needs</span>
                    <Badge variant="secondary" data-testid="badge-liquidity-needs">
                      {selectedProfile.liquidityNeeds}
                    </Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Age</span>
                    <span className="font-medium" data-testid="text-age">{selectedProfile.age} years</span>
                  </div>
                </div>
              </div>

              <Separator />

              {/* Financial Information */}
              <div className="space-y-4">
                <h3 className="text-lg font-semibold flex items-center gap-2">
                  <IndianRupee className="h-5 w-5" />
                  Financial Information
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <span className="text-sm text-muted-foreground">Monthly Income</span>
                    <p className="text-lg font-semibold text-green-600" data-testid="text-monthly-income">
                      {formatCurrency(selectedProfile.monthlyIncome)}
                    </p>
                  </div>
                  <div className="space-y-2">
                    <span className="text-sm text-muted-foreground">Monthly Expenses</span>
                    <p className="text-lg font-semibold text-red-600" data-testid="text-monthly-expenses">
                      {formatCurrency(selectedProfile.monthlyExpenses)}
                    </p>
                  </div>
                  <div className="space-y-2">
                    <span className="text-sm text-muted-foreground">Existing Assets</span>
                    <p className="text-lg font-semibold text-blue-600" data-testid="text-existing-assets">
                      {formatCurrency(selectedProfile.existingAssets)}
                    </p>
                  </div>
                  <div className="space-y-2">
                    <span className="text-sm text-muted-foreground">Liabilities</span>
                    <p className="text-lg font-semibold text-orange-600" data-testid="text-existing-liabilities">
                      {formatCurrency(selectedProfile.existingLiabilities)}
                    </p>
                  </div>
                </div>
                <div className="space-y-2">
                  <span className="text-sm text-muted-foreground">Net Worth</span>
                  <p className="text-xl font-bold text-primary" data-testid="text-net-worth">
                    {formatCurrency(
                      (parseFloat(selectedProfile.existingAssets) - parseFloat(selectedProfile.existingLiabilities)).toString()
                    )}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Assessment Details */}
          <div className="space-y-6">
            {/* Assessment Metadata */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Calendar className="h-5 w-5" />
                  Assessment Details
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <span className="text-sm text-muted-foreground">Assessed By</span>
                  <p className="font-medium" data-testid="text-assessed-by">{selectedProfile.assessedBy}</p>
                </div>
                <div>
                  <span className="text-sm text-muted-foreground">Assessment Date</span>
                  <p className="font-medium" data-testid="text-assessment-date">
                    {new Date(selectedProfile.assessmentDate).toLocaleDateString()}
                  </p>
                </div>
                <div>
                  <span className="text-sm text-muted-foreground">Next Review</span>
                  <div className="flex items-center gap-2">
                    <p className="font-medium" data-testid="text-review-date">
                      {new Date(selectedProfile.reviewDate).toLocaleDateString()}
                    </p>
                    {new Date(selectedProfile.reviewDate) <= new Date() && (
                      <Badge variant="destructive" data-testid="badge-review-overdue">
                        <AlertTriangle className="h-3 w-3 mr-1" />
                        Review Due
                      </Badge>
                    )}
                  </div>
                </div>
                <div>
                  <span className="text-sm text-muted-foreground">Dependents</span>
                  <p className="font-medium" data-testid="text-dependents">{selectedProfile.dependents}</p>
                </div>
              </CardContent>
            </Card>

            {/* Notes */}
            <Card>
              <CardHeader>
                <CardTitle>Assessment Notes</CardTitle>
              </CardHeader>
              <CardContent>
                {selectedProfile.notes ? (
                  <p className="text-sm" data-testid="text-notes">{selectedProfile.notes}</p>
                ) : (
                  <p className="text-sm text-muted-foreground" data-testid="text-no-notes">No additional notes available.</p>
                )}
              </CardContent>
            </Card>

            {/* Risk Recommendations */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <TrendingUp className="h-5 w-5" />
                  Recommendations
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2 text-sm">
                  {selectedProfile.riskScore <= 30 && (
                    <div className="p-3 bg-green-50 dark:bg-green-950/30 rounded-lg border border-green-200 dark:border-green-800">
                      <p className="font-medium text-green-800 dark:text-green-200">Conservative Investor</p>
                      <p className="text-green-600">Recommend low-risk investments like fixed deposits, government bonds, and conservative mutual funds.</p>
                    </div>
                  )}
                  {selectedProfile.riskScore > 30 && selectedProfile.riskScore <= 50 && (
                    <div className="p-3 bg-yellow-50 dark:bg-yellow-950/30 rounded-lg border border-yellow-200 dark:border-yellow-800">
                      <p className="font-medium text-yellow-800 dark:text-yellow-200">Moderate Investor</p>
                      <p className="text-yellow-600">Suitable for balanced portfolios with mix of debt and equity investments.</p>
                    </div>
                  )}
                  {selectedProfile.riskScore > 50 && selectedProfile.riskScore <= 70 && (
                    <div className="p-3 bg-blue-50 dark:bg-blue-950/30 rounded-lg border border-blue-200 dark:border-blue-800">
                      <p className="font-medium text-blue-800 dark:text-blue-200">Balanced Investor</p>
                      <p className="text-blue-600">Can consider diversified equity funds and balanced asset allocation.</p>
                    </div>
                  )}
                  {selectedProfile.riskScore > 70 && selectedProfile.riskScore <= 85 && (
                    <div className="p-3 bg-orange-50 dark:bg-orange-950/30 rounded-lg border border-orange-200 dark:border-orange-800">
                      <p className="font-medium text-orange-800 dark:text-orange-200">Growth Investor</p>
                      <p className="text-orange-600">Suitable for growth-oriented equity funds and higher-risk investments.</p>
                    </div>
                  )}
                  {selectedProfile.riskScore > 85 && (
                    <div className="p-3 bg-red-50 dark:bg-red-950/30 rounded-lg border border-red-200 dark:border-red-800">
                      <p className="font-medium text-red-800 dark:text-red-200">Aggressive Investor</p>
                      <p className="text-red-600">Can handle high-risk, high-reward investments like small-cap funds and sectoral investments.</p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      )}

      {/* No Profile Selected */}
      {selectedUserId && !selectedProfile && (
        <Card>
          <CardContent className="flex items-center justify-center py-8">
            <div className="text-center">
              <AlertTriangle className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-semibold mb-2">No Risk Profile Found</h3>
              <p className="text-muted-foreground">
                The selected customer does not have a risk assessment profile yet.
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* No User Selected */}
      {!selectedUserId && (
        <Card>
          <CardContent className="flex items-center justify-center py-8">
            <div className="text-center">
              <Eye className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-semibold mb-2">Select a Customer</h3>
              <p className="text-muted-foreground">
                Choose a customer from the dropdown above to view their risk profile and assessment details.
              </p>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}