import { useState, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { Slider } from "@/components/ui/slider";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import {
  Users,
  UserPlus,
  Briefcase,
  IndianRupee,
  TrendingUp,
  Target,
  Calendar,
  Search,
  Filter,
  Settings,
  Star,
  Award,
  FileText,
  CheckCircle,
  Clock,
  AlertCircle,
  Eye,
  Edit,
  Trash2,
  RefreshCw,
  Building2,
  Percent,
  Scale
} from "lucide-react";
import { format } from "date-fns";

interface CAProfile {
  id: string;
  name: string;
  email: string;
  mobile: string;
  firmName?: string;
  caNumber: string;
  specializations: string[];
  status: 'active' | 'inactive' | 'pending';
  joinDate: string;
  revenueShare: number;
  casesAssigned: number;
  casesCompleted: number;
  totalRevenue: number;
  rating: number;
  reviewCount: number;
  lastActiveDate: string;
}

interface TaxCase {
  id: string;
  clientName: string;
  caseType: string;
  assignedCAId: string | null;
  assignedCAName: string | null;
  status: 'unassigned' | 'assigned' | 'in_progress' | 'pending_review' | 'completed';
  priority: 'high' | 'medium' | 'low';
  dueDate: string;
  amount: number;
  createdAt: string;
}

const formatCurrency = (amount: number) => {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0
  }).format(amount);
};


export default function PartnerCAManagement() {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState("cas");
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [showOnboardDialog, setShowOnboardDialog] = useState(false);
  const [showAssignDialog, setShowAssignDialog] = useState(false);
  const [showRevenueDialog, setShowRevenueDialog] = useState(false);
  const [selectedCA, setSelectedCA] = useState<CAProfile | null>(null);
  const [selectedCase, setSelectedCase] = useState<TaxCase | null>(null);
  const [revenueShare, setRevenueShare] = useState(60);
  const [newCA, setNewCA] = useState({
    name: '',
    email: '',
    mobile: '',
    firmName: '',
    caNumber: '',
    specializations: [] as string[]
  });

  const { data: casData, isLoading: isLoadingCAs } = useQuery<CAProfile[]>({
    queryKey: ['/api/partner/cas'],
  });

  const { data: casesData, isLoading: isLoadingCases } = useQuery<TaxCase[]>({
    queryKey: ['/api/partner/tax-cases'],
  });

  const cas = casData || [];
  const cases = casesData || [];
  const isLoading = isLoadingCAs || isLoadingCases;

  const aggregateMetrics = useMemo(() => {
    const activeCAs = cas.filter(ca => ca.status === 'active').length;
    const totalRevenue = cas.reduce((sum, ca) => sum + ca.totalRevenue, 0);
    const casesCompleted = cas.reduce((sum, ca) => sum + ca.casesCompleted, 0);
    const pendingCases = cases.filter(c => c.status === 'unassigned').length;
    const ratedCAs = cas.filter(ca => ca.rating > 0);
    const avgRating = ratedCAs.length > 0 ? ratedCAs.reduce((sum, ca) => sum + ca.rating, 0) / ratedCAs.length : 0;
    
    return {
      activeCAs,
      totalCAs: cas.length,
      totalRevenue,
      casesCompleted,
      pendingCases,
      avgRating: avgRating.toFixed(1)
    };
  }, [cas, cases]);

  const filteredCAs = useMemo(() => {
    return cas.filter(ca => {
      const matchesSearch = ca.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                           ca.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
                           ca.caNumber.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesStatus = statusFilter === "all" || ca.status === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [cas, searchQuery, statusFilter]);

  const unassignedCases = cases.filter(c => c.status === 'unassigned');

  const handleOnboardCA = () => {
    if (!newCA.name || !newCA.email || !newCA.caNumber) {
      toast({ title: "Error", description: "Please fill all required fields", variant: "destructive" });
      return;
    }
    toast({ title: "CA Onboarded", description: `${newCA.name} has been invited to join the platform` });
    setShowOnboardDialog(false);
    setNewCA({ name: '', email: '', mobile: '', firmName: '', caNumber: '', specializations: [] });
  };

  const handleAssignCase = (caId: string) => {
    if (!selectedCase) return;
    toast({ title: "Case Assigned", description: `Case assigned to CA successfully` });
    setShowAssignDialog(false);
  };

  const handleUpdateRevenueShare = () => {
    if (!selectedCA) return;
    toast({ title: "Revenue Share Updated", description: `${selectedCA.name}'s revenue share updated to ${revenueShare}%` });
    setShowRevenueDialog(false);
  };

  const getStatusBadge = (status: string) => {
    const colors: Record<string, string> = {
      active: 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300',
      inactive: 'bg-muted text-muted-foreground',
      pending: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300',
      unassigned: 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300',
      assigned: 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300',
      in_progress: 'bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300',
      pending_review: 'bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-300',
      completed: 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300'
    };
    return colors[status] || colors.pending;
  };

  return (
    <div className="container mx-auto p-6 max-w-7xl">
      <div className="mb-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-gradient-to-r from-emerald-600 to-teal-600">
              <Briefcase className="w-6 h-6 text-foreground" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-foreground">CA Management</h1>
              <p className="text-muted-foreground">Onboard CAs, assign cases, and manage revenue sharing</p>
            </div>
          </div>
          <Button onClick={() => setShowOnboardDialog(true)} className="bg-gradient-to-r from-emerald-600 to-teal-600" data-testid="button-onboard-ca">
            <UserPlus className="w-4 h-4 mr-2" /> Onboard New CA
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 mb-6">
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">Active CAs</p>
                <p className="text-xl font-bold">{aggregateMetrics.activeCAs}/{aggregateMetrics.totalCAs}</p>
              </div>
              <Users className="w-8 h-8 text-emerald-400" />
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">Total Revenue</p>
                <p className="text-xl font-bold text-green-600">{formatCurrency(aggregateMetrics.totalRevenue)}</p>
              </div>
              <IndianRupee className="w-8 h-8 text-green-400" />
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">Cases Completed</p>
                <p className="text-xl font-bold">{aggregateMetrics.casesCompleted}</p>
              </div>
              <CheckCircle className="w-8 h-8 text-blue-400" />
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">Pending Assignment</p>
                <p className="text-xl font-bold text-amber-600">{aggregateMetrics.pendingCases}</p>
              </div>
              <Clock className="w-8 h-8 text-amber-400" />
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">Avg Rating</p>
                <p className="text-xl font-bold flex items-center gap-1">
                  {aggregateMetrics.avgRating} <Star className="w-4 h-4 text-yellow-500 fill-yellow-500" />
                </p>
              </div>
              <Award className="w-8 h-8 text-yellow-400" />
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="mb-4">
          <TabsTrigger value="cas" className="flex items-center gap-2" data-testid="tab-cas">
            <Users className="w-4 h-4" /> CAs
          </TabsTrigger>
          <TabsTrigger value="cases" className="flex items-center gap-2" data-testid="tab-cases">
            <FileText className="w-4 h-4" /> Case Assignment
            {unassignedCases.length > 0 && (
              <Badge variant="destructive" className="ml-1">{unassignedCases.length}</Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="performance" className="flex items-center gap-2" data-testid="tab-performance">
            <TrendingUp className="w-4 h-4" /> Performance
          </TabsTrigger>
          <TabsTrigger value="revenue" className="flex items-center gap-2" data-testid="tab-revenue">
            <Percent className="w-4 h-4" /> Revenue Sharing
          </TabsTrigger>
        </TabsList>

        <TabsContent value="cas">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Chartered Accountants</CardTitle>
                  <CardDescription>Manage your network of CAs</CardDescription>
                </div>
                <div className="flex gap-2">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input 
                      placeholder="Search CAs..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pl-9 w-[200px]"
                      data-testid="input-search-cas"
                    />
                  </div>
                  <Select value={statusFilter} onValueChange={setStatusFilter}>
                    <SelectTrigger className="w-[130px]" data-testid="select-status-filter">
                      <Filter className="w-4 h-4 mr-2" />
                      <SelectValue placeholder="Status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Status</SelectItem>
                      <SelectItem value="active">Active</SelectItem>
                      <SelectItem value="pending">Pending</SelectItem>
                      <SelectItem value="inactive">Inactive</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>CA Details</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Specializations</TableHead>
                    <TableHead className="text-right">Cases</TableHead>
                    <TableHead className="text-right">Revenue</TableHead>
                    <TableHead className="text-right">Rating</TableHead>
                    <TableHead className="text-right">Rev Share</TableHead>
                    <TableHead></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredCAs.map((ca) => (
                    <TableRow key={ca.id} data-testid={`ca-row-${ca.id}`}>
                      <TableCell>
                        <div>
                          <p className="font-medium">{ca.name}</p>
                          <p className="text-xs text-muted-foreground">{ca.firmName || ca.caNumber}</p>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge className={getStatusBadge(ca.status)}>{ca.status}</Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1 flex-wrap">
                          {ca.specializations.slice(0, 2).map((spec, i) => (
                            <Badge key={i} variant="outline" className="text-xs">{spec}</Badge>
                          ))}
                          {ca.specializations.length > 2 && (
                            <Badge variant="outline" className="text-xs">+{ca.specializations.length - 2}</Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <span className="text-green-600">{ca.casesCompleted}</span>/{ca.casesAssigned}
                      </TableCell>
                      <TableCell className="text-right font-medium">
                        {formatCurrency(ca.totalRevenue)}
                      </TableCell>
                      <TableCell className="text-right">
                        {ca.rating > 0 ? (
                          <div className="flex items-center justify-end gap-1">
                            <span className="font-medium">{ca.rating}</span>
                            <Star className="w-3 h-3 text-yellow-500 fill-yellow-500" />
                            <span className="text-xs text-muted-foreground">({ca.reviewCount})</span>
                          </div>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right font-medium text-blue-600">
                        {ca.revenueShare}%
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setSelectedCA(ca);
                            setRevenueShare(ca.revenueShare);
                            setShowRevenueDialog(true);
                          }}
                          data-testid={`button-settings-${ca.id}`}
                        >
                          <Settings className="w-4 h-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="cases">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="w-5 h-5" />
                Case Assignment
              </CardTitle>
              <CardDescription>Assign pending cases to available CAs</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Client</TableHead>
                    <TableHead>Case Type</TableHead>
                    <TableHead>Priority</TableHead>
                    <TableHead>Due Date</TableHead>
                    <TableHead className="text-right">Value</TableHead>
                    <TableHead>Assigned To</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {cases.map((taxCase) => (
                    <TableRow key={taxCase.id} data-testid={`case-row-${taxCase.id}`}>
                      <TableCell className="font-medium">{taxCase.clientName}</TableCell>
                      <TableCell>{taxCase.caseType}</TableCell>
                      <TableCell>
                        <Badge className={
                          taxCase.priority === 'high' ? 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300' :
                          taxCase.priority === 'medium' ? 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300' :
                          'bg-muted text-muted-foreground'
                        }>
                          {taxCase.priority}
                        </Badge>
                      </TableCell>
                      <TableCell>{format(new Date(taxCase.dueDate), 'dd MMM yyyy')}</TableCell>
                      <TableCell className="text-right font-medium">{formatCurrency(taxCase.amount)}</TableCell>
                      <TableCell>
                        {taxCase.assignedCAName || (
                          <span className="text-amber-600 italic">Unassigned</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge className={getStatusBadge(taxCase.status)}>
                          {taxCase.status.replace('_', ' ')}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {taxCase.status === 'unassigned' && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              setSelectedCase(taxCase);
                              setShowAssignDialog(true);
                            }}
                            data-testid={`button-assign-${taxCase.id}`}
                          >
                            Assign
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="performance">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-green-600" />
                CA Performance Rankings
              </CardTitle>
              <CardDescription>Track performance metrics and identify top performers</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {cas
                  .filter(ca => ca.status === 'active')
                  .sort((a, b) => b.totalRevenue - a.totalRevenue)
                  .map((ca, index) => (
                    <div key={ca.id} className="p-4 border rounded-lg" data-testid={`perf-row-${ca.id}`}>
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-3">
                          <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold ${
                            index === 0 ? 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300' :
                            index === 1 ? 'bg-muted text-muted-foreground' :
                            index === 2 ? 'bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300' :
                            'bg-muted text-muted-foreground'
                          }`}>
                            {index + 1}
                          </div>
                          <div>
                            <p className="font-medium">{ca.name}</p>
                            <p className="text-sm text-muted-foreground">{ca.firmName || ca.caNumber}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-6">
                          <div className="text-center">
                            <p className="text-sm text-muted-foreground">Revenue</p>
                            <p className="font-bold text-green-600">{formatCurrency(ca.totalRevenue)}</p>
                          </div>
                          <div className="text-center">
                            <p className="text-sm text-muted-foreground">Completion Rate</p>
                            <p className="font-bold">{ca.casesAssigned > 0 ? Math.round((ca.casesCompleted / ca.casesAssigned) * 100) : 0}%</p>
                          </div>
                          <div className="text-center">
                            <p className="text-sm text-muted-foreground">Rating</p>
                            <p className="font-bold flex items-center gap-1">
                              {ca.rating || '-'} <Star className="w-4 h-4 text-yellow-500 fill-yellow-500" />
                            </p>
                          </div>
                        </div>
                      </div>
                      <div className="grid grid-cols-3 gap-4">
                        <div>
                          <p className="text-xs text-muted-foreground mb-1">Cases Progress</p>
                          <Progress value={ca.casesAssigned > 0 ? (ca.casesCompleted / ca.casesAssigned) * 100 : 0} className="h-2" />
                        </div>
                        <div className="flex gap-1 flex-wrap">
                          {ca.specializations.map((spec, i) => (
                            <Badge key={i} variant="outline" className="text-xs">{spec}</Badge>
                          ))}
                        </div>
                        <div className="text-right">
                          <span className="text-xs text-muted-foreground">Last active: {format(new Date(ca.lastActiveDate), 'dd MMM')}</span>
                        </div>
                      </div>
                    </div>
                  ))
                }
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="revenue">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Scale className="w-5 h-5" />
                Revenue Sharing Configuration
              </CardTitle>
              <CardDescription>Configure commission splits with each CA</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {cas.filter(ca => ca.status === 'active').map((ca) => (
                  <div key={ca.id} className="flex items-center justify-between p-4 border rounded-lg" data-testid={`rev-row-${ca.id}`}>
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 rounded-full bg-gradient-to-r from-emerald-500 to-teal-500 flex items-center justify-center text-foreground font-bold">
                        {ca.name.split(' ').slice(1, 3).map(n => n[0]).join('')}
                      </div>
                      <div>
                        <p className="font-medium">{ca.name}</p>
                        <p className="text-sm text-muted-foreground">{ca.casesCompleted} cases completed</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-8">
                      <div className="text-center">
                        <p className="text-sm text-muted-foreground">CA Gets</p>
                        <p className="text-xl font-bold text-blue-600">{ca.revenueShare}%</p>
                      </div>
                      <div className="text-center">
                        <p className="text-sm text-muted-foreground">You Get</p>
                        <p className="text-xl font-bold text-green-600">{100 - ca.revenueShare}%</p>
                      </div>
                      <div className="text-center">
                        <p className="text-sm text-muted-foreground">Your Earnings</p>
                        <p className="font-bold">{formatCurrency(ca.totalRevenue * (100 - ca.revenueShare) / 100)}</p>
                      </div>
                      <Button
                        variant="outline"
                        onClick={() => {
                          setSelectedCA(ca);
                          setRevenueShare(ca.revenueShare);
                          setShowRevenueDialog(true);
                        }}
                        data-testid={`button-edit-rev-${ca.id}`}
                      >
                        <Edit className="w-4 h-4 mr-2" /> Edit
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <Dialog open={showOnboardDialog} onOpenChange={setShowOnboardDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Onboard New CA</DialogTitle>
            <DialogDescription>Invite a Chartered Accountant to join your network</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>CA Name *</Label>
                <Input 
                  placeholder="CA Full Name"
                  value={newCA.name}
                  onChange={(e) => setNewCA({...newCA, name: e.target.value})}
                  data-testid="input-ca-name"
                />
              </div>
              <div className="space-y-2">
                <Label>CA Number *</Label>
                <Input 
                  placeholder="CA-123456"
                  value={newCA.caNumber}
                  onChange={(e) => setNewCA({...newCA, caNumber: e.target.value})}
                  data-testid="input-ca-number"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Email *</Label>
                <Input 
                  type="email"
                  placeholder="ca@email.com"
                  value={newCA.email}
                  onChange={(e) => setNewCA({...newCA, email: e.target.value})}
                  data-testid="input-ca-email"
                />
              </div>
              <div className="space-y-2">
                <Label>Mobile</Label>
                <Input 
                  placeholder="+91 98765 43210"
                  value={newCA.mobile}
                  onChange={(e) => setNewCA({...newCA, mobile: e.target.value})}
                  data-testid="input-ca-mobile"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Firm Name</Label>
              <Input 
                placeholder="Firm name (optional)"
                value={newCA.firmName}
                onChange={(e) => setNewCA({...newCA, firmName: e.target.value})}
                data-testid="input-firm-name"
              />
            </div>
            <div className="space-y-2">
              <Label>Initial Revenue Share</Label>
              <div className="flex items-center gap-4">
                <Slider
                  value={[revenueShare]}
                  onValueChange={(v) => setRevenueShare(v[0])}
                  min={50}
                  max={80}
                  step={5}
                  className="flex-1"
                />
                <span className="font-bold text-blue-600 w-16">{revenueShare}%</span>
              </div>
              <p className="text-xs text-muted-foreground">CA will receive {revenueShare}% of case value, you get {100 - revenueShare}%</p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowOnboardDialog(false)}>Cancel</Button>
            <Button onClick={handleOnboardCA} data-testid="button-confirm-onboard">Send Invitation</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showAssignDialog} onOpenChange={setShowAssignDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Assign Case</DialogTitle>
            <DialogDescription>Select a CA to handle this case</DialogDescription>
          </DialogHeader>
          {selectedCase && (
            <div className="py-4">
              <div className="p-4 bg-muted rounded-lg mb-4">
                <p className="font-medium">{selectedCase.clientName}</p>
                <p className="text-sm text-muted-foreground">{selectedCase.caseType} - {formatCurrency(selectedCase.amount)}</p>
                <p className="text-sm text-muted-foreground">Due: {format(new Date(selectedCase.dueDate), 'dd MMM yyyy')}</p>
              </div>
              <div className="space-y-2">
                {cas.filter(ca => ca.status === 'active').map((ca) => (
                  <div 
                    key={ca.id}
                    className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted cursor-pointer"
                    onClick={() => handleAssignCase(ca.id)}
                    data-testid={`assign-option-${ca.id}`}
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-emerald-100 dark:bg-emerald-900 flex items-center justify-center font-medium text-emerald-700">
                        {ca.name.split(' ').slice(1, 3).map(n => n[0]).join('')}
                      </div>
                      <div>
                        <p className="font-medium">{ca.name}</p>
                        <p className="text-xs text-muted-foreground">{ca.casesAssigned - ca.casesCompleted} active cases</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="flex items-center gap-1 text-sm">
                        <Star className="w-3 h-3 text-yellow-500 fill-yellow-500" />
                        {ca.rating || '-'}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAssignDialog(false)}>Cancel</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showRevenueDialog} onOpenChange={setShowRevenueDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Configure Revenue Share</DialogTitle>
            <DialogDescription>Adjust commission split for {selectedCA?.name}</DialogDescription>
          </DialogHeader>
          {selectedCA && (
            <div className="py-4 space-y-6">
              <div className="p-4 bg-muted rounded-lg">
                <p className="font-medium">{selectedCA.name}</p>
                <p className="text-sm text-muted-foreground">{selectedCA.firmName || selectedCA.caNumber}</p>
                <p className="text-sm text-muted-foreground">Total Revenue: {formatCurrency(selectedCA.totalRevenue)}</p>
              </div>
              
              <div className="space-y-4">
                <Label>Revenue Share Split</Label>
                <Slider
                  value={[revenueShare]}
                  onValueChange={(v) => setRevenueShare(v[0])}
                  min={50}
                  max={80}
                  step={5}
                />
                <div className="flex justify-between text-sm">
                  <span>50%</span>
                  <span className="font-bold text-lg">{revenueShare}% to CA</span>
                  <span>80%</span>
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg text-center">
                  <p className="text-sm text-muted-foreground">CA Receives</p>
                  <p className="text-2xl font-bold text-blue-600">{revenueShare}%</p>
                  <p className="text-sm text-muted-foreground">{formatCurrency(selectedCA.totalRevenue * revenueShare / 100)}</p>
                </div>
                <div className="p-4 bg-green-50 dark:bg-green-900/20 rounded-lg text-center">
                  <p className="text-sm text-muted-foreground">You Receive</p>
                  <p className="text-2xl font-bold text-green-600">{100 - revenueShare}%</p>
                  <p className="text-sm text-muted-foreground">{formatCurrency(selectedCA.totalRevenue * (100 - revenueShare) / 100)}</p>
                </div>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowRevenueDialog(false)}>Cancel</Button>
            <Button onClick={handleUpdateRevenueShare} data-testid="button-save-revenue">Save Changes</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
