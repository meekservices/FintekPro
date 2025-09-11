import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { 
  Users, 
  UserPlus, 
  Building2, 
  CreditCard, 
  TrendingUp, 
  FileText, 
  Settings, 
  Shield, 
  Eye, 
  Edit3, 
  Trash2, 
  Plus,
  Search,
  Download,
  Upload,
  BarChart3,
  DollarSign,
  Clock,
  CheckCircle2,
  AlertTriangle,
  Info
} from "lucide-react";

export default function AgentPortal() {
  const { toast } = useToast();
  
  // State management
  const [activeTab, setActiveTab] = useState("dashboard");
  const [showAddPartnerDialog, setShowAddPartnerDialog] = useState(false);
  const [showAddClientDialog, setShowAddClientDialog] = useState(false);
  const [selectedPartner, setSelectedPartner] = useState<any>(null);
  const [selectedClient, setSelectedClient] = useState<any>(null);
  const [searchTerm, setSearchTerm] = useState("");
  
  // Form states
  const [partnerForm, setPartnerForm] = useState({
    companyName: "",
    contactEmail: "",
    contactPhone: "",
    address: "",
    website: "",
    partnerType: "product_provider",
    businessLicense: "",
    taxId: "",
    euinNumber: "",
    arnCode: "",
    hasEuinArn: false
  });
  
  const [clientForm, setClientForm] = useState({
    firstName: "",
    lastName: "",
    email: "",
    mobile: "",
    panNumber: "",
    assignedAgent: "",
    masterAgentEuin: ""
  });

  // Fetch agent profile and data
  const { data: agentProfile } = useQuery({
    queryKey: ['/api/agent/profile'],
    refetchInterval: 60000,
  });

  // Fetch agent's partners
  const { data: partnersData = [], isLoading: partnersLoading } = useQuery({
    queryKey: ['/api/agent/partners'],
    refetchInterval: 60000,
  });

  // Fetch agent's clients
  const { data: clientsData = [], isLoading: clientsLoading } = useQuery({
    queryKey: ['/api/agent/clients', { searchTerm }],
    refetchInterval: 60000,
  });

  // Fetch agent statistics
  const { data: agentStats = {} } = useQuery({
    queryKey: ['/api/agent/stats'],
    refetchInterval: 30000,
  });

  // Partner management mutations
  const addPartnerMutation = useMutation({
    mutationFn: async (partnerData: any) => {
      const response = await apiRequest('POST', '/api/agent/partners', partnerData);
      return response.json();
    },
    onSuccess: () => {
      toast({ title: "Success", description: "Partner added successfully" });
      setShowAddPartnerDialog(false);
      setPartnerForm({
        companyName: "",
        contactEmail: "",
        contactPhone: "",
        address: "",
        website: "",
        partnerType: "product_provider",
        businessLicense: "",
        taxId: "",
        euinNumber: "",
        arnCode: "",
        hasEuinArn: false
      });
      queryClient.invalidateQueries({ queryKey: ['/api/agent/partners'] });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message || "Failed to add partner", variant: "destructive" });
    }
  });

  // Client management mutations
  const addClientMutation = useMutation({
    mutationFn: async (clientData: any) => {
      const response = await apiRequest('POST', '/api/agent/clients', clientData);
      return response.json();
    },
    onSuccess: () => {
      toast({ title: "Success", description: "Client added successfully" });
      setShowAddClientDialog(false);
      setClientForm({
        firstName: "",
        lastName: "",
        email: "",
        mobile: "",
        panNumber: "",
        assignedAgent: "",
        masterAgentEuin: ""
      });
      queryClient.invalidateQueries({ queryKey: ['/api/agent/clients'] });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message || "Failed to add client", variant: "destructive" });
    }
  });

  const handleAddPartner = () => {
    // If partner doesn't have EUIN/ARN, use master agent EUIN
    const partnerData = {
      ...partnerForm,
      masterAgentEuin: !partnerForm.hasEuinArn ? agentProfile?.euinNumber : null
    };
    addPartnerMutation.mutate(partnerData);
  };

  const handleAddClient = () => {
    // If no specific agent assigned, use master agent EUIN
    const clientData = {
      ...clientForm,
      masterAgentEuin: !clientForm.assignedAgent ? agentProfile?.euinNumber : null
    };
    addClientMutation.mutate(clientData);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 dark:from-slate-950 dark:via-blue-950 dark:to-indigo-950" data-testid="agent-portal">
      <div className="container mx-auto p-6">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 dark:text-white" data-testid="title-agent-portal">
                Agent Portal
              </h1>
              <p className="text-gray-600 dark:text-gray-300 mt-1">
                Welcome back, {agentProfile?.fullName || 'Agent'}
              </p>
              {agentProfile?.euinNumber && (
                <div className="flex items-center gap-4 mt-2">
                  <Badge className="bg-blue-100 text-blue-800">
                    EUIN: {agentProfile.euinNumber}
                  </Badge>
                  {agentProfile.arnCode && (
                    <Badge className="bg-green-100 text-green-800">
                      ARN: {agentProfile.arnCode}
                    </Badge>
                  )}
                </div>
              )}
            </div>
            <div className="text-right">
              <p className="text-sm text-gray-500">agent.fintekpro.com</p>
              <p className="text-xs text-gray-400">Agent ID: {agentProfile?.employeeId}</p>
            </div>
          </div>
        </div>

        {/* Main Content */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="dashboard" data-testid="tab-dashboard">
              <BarChart3 className="w-4 h-4 mr-2" />
              Dashboard
            </TabsTrigger>
            <TabsTrigger value="partners" data-testid="tab-partners">
              <Building2 className="w-4 h-4 mr-2" />
              Partners
            </TabsTrigger>
            <TabsTrigger value="clients" data-testid="tab-clients">
              <Users className="w-4 h-4 mr-2" />
              Clients
            </TabsTrigger>
            <TabsTrigger value="reports" data-testid="tab-reports">
              <FileText className="w-4 h-4 mr-2" />
              Reports
            </TabsTrigger>
          </TabsList>

          {/* Dashboard Tab */}
          <TabsContent value="dashboard" className="space-y-6">
            {/* Stats Cards */}
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
              <Card data-testid="card-total-partners">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Total Partners</CardTitle>
                  <Building2 className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold" data-testid="text-total-partners">
                    {agentStats.totalPartners || 0}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {agentStats.activePartners || 0} active
                  </p>
                </CardContent>
              </Card>

              <Card data-testid="card-total-clients">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Total Clients</CardTitle>
                  <Users className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold" data-testid="text-total-clients">
                    {agentStats.totalClients || 0}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {agentStats.activeClients || 0} active
                  </p>
                </CardContent>
              </Card>

              <Card data-testid="card-monthly-commissions">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Monthly Commissions</CardTitle>
                  <DollarSign className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold" data-testid="text-monthly-commissions">
                    ₹{agentStats.monthlyCommissions || '0'}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    +{agentStats.commissionGrowth || 0}% from last month
                  </p>
                </CardContent>
              </Card>

              <Card data-testid="card-pending-tasks">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Pending Tasks</CardTitle>
                  <Clock className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold" data-testid="text-pending-tasks">
                    {agentStats.pendingTasks || 0}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {agentStats.urgentTasks || 0} urgent
                  </p>
                </CardContent>
              </Card>
            </div>

            {/* Recent Activity */}
            <Card data-testid="card-recent-activity">
              <CardHeader>
                <CardTitle>Recent Activity</CardTitle>
                <CardDescription>Your latest actions and updates</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {agentStats.recentActivity?.map((activity: any, index: number) => (
                    <div key={index} className="flex items-center gap-3 p-3 rounded-lg bg-gray-50 dark:bg-gray-800">
                      <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                      <div className="flex-1">
                        <p className="text-sm font-medium">{activity.description}</p>
                        <p className="text-xs text-muted-foreground">{activity.timestamp}</p>
                      </div>
                    </div>
                  )) || (
                    <p className="text-sm text-muted-foreground">No recent activity</p>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Partners Tab */}
          <TabsContent value="partners" className="space-y-6">
            <Card data-testid="card-partners-management">
              <CardHeader>
                <div className="flex justify-between items-center">
                  <div>
                    <CardTitle>Partners Management</CardTitle>
                    <CardDescription>Add and manage partners with or without EUIN/ARN numbers</CardDescription>
                  </div>
                  <Button onClick={() => setShowAddPartnerDialog(true)} data-testid="button-add-partner">
                    <Plus className="w-4 h-4 mr-2" />
                    Add Partner
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Company</TableHead>
                      <TableHead>Contact</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>EUIN/ARN Status</TableHead>
                      <TableHead>Master Agent</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {partnersData.map((partner: any, index: number) => (
                      <TableRow key={partner.id} data-testid={`partner-row-${index + 1}`}>
                        <TableCell>
                          <div>
                            <div className="font-medium">{partner.companyName}</div>
                            <div className="text-sm text-muted-foreground">{partner.website}</div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div>
                            <div className="text-sm">{partner.contactEmail}</div>
                            <div className="text-xs text-muted-foreground">{partner.contactPhone}</div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge>{partner.partnerType.replace('_', ' ')}</Badge>
                        </TableCell>
                        <TableCell>
                          {partner.euinNumber ? (
                            <div>
                              <Badge className="bg-green-100 text-green-800">
                                EUIN: {partner.euinNumber}
                              </Badge>
                              {partner.arnCode && (
                                <Badge className="bg-blue-100 text-blue-800 mt-1">
                                  ARN: {partner.arnCode}
                                </Badge>
                              )}
                            </div>
                          ) : (
                            <Badge className="bg-yellow-100 text-yellow-800">
                              No EUIN/ARN
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          {partner.masterAgentEuin ? (
                            <Badge className="bg-purple-100 text-purple-800">
                              {partner.masterAgentEuin}
                            </Badge>
                          ) : (
                            <span className="text-sm text-muted-foreground">N/A</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="flex space-x-1">
                            <Button variant="outline" size="sm">
                              <Eye className="w-4 h-4" />
                            </Button>
                            <Button variant="outline" size="sm">
                              <Edit3 className="w-4 h-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Clients Tab */}
          <TabsContent value="clients" className="space-y-6">
            <Card data-testid="card-clients-management">
              <CardHeader>
                <div className="flex justify-between items-center">
                  <div>
                    <CardTitle>Clients Management</CardTitle>
                    <CardDescription>Manage client relationships and EUIN assignments</CardDescription>
                  </div>
                  <Button onClick={() => setShowAddClientDialog(true)} data-testid="button-add-client">
                    <UserPlus className="w-4 h-4 mr-2" />
                    Add Client
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="mb-4">
                  <div className="flex items-center space-x-2">
                    <Search className="w-4 h-4 text-muted-foreground" />
                    <Input
                      placeholder="Search clients..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="max-w-sm"
                    />
                  </div>
                </div>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Client</TableHead>
                      <TableHead>PAN Number</TableHead>
                      <TableHead>Assigned Agent</TableHead>
                      <TableHead>EUIN Assignment</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {clientsData.map((client: any, index: number) => (
                      <TableRow key={client.id} data-testid={`client-row-${index + 1}`}>
                        <TableCell>
                          <div>
                            <div className="font-medium">{client.firstName} {client.lastName}</div>
                            <div className="text-sm text-muted-foreground">{client.email}</div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <code className="text-xs bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded">
                            {client.panNumber}
                          </code>
                        </TableCell>
                        <TableCell>
                          {client.assignedAgent ? (
                            <Badge className="bg-blue-100 text-blue-800">
                              {client.assignedAgent}
                            </Badge>
                          ) : (
                            <span className="text-sm text-muted-foreground">Unassigned</span>
                          )}
                        </TableCell>
                        <TableCell>
                          {client.euinNumber ? (
                            <Badge className="bg-green-100 text-green-800">
                              {client.euinNumber}
                            </Badge>
                          ) : client.masterAgentEuin ? (
                            <Badge className="bg-purple-100 text-purple-800">
                              Master: {client.masterAgentEuin}
                            </Badge>
                          ) : (
                            <Badge className="bg-red-100 text-red-800">
                              No EUIN
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          <Badge className={client.isActive ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"}>
                            {client.isActive ? "Active" : "Inactive"}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex space-x-1">
                            <Button variant="outline" size="sm">
                              <Eye className="w-4 h-4" />
                            </Button>
                            <Button variant="outline" size="sm">
                              <Edit3 className="w-4 h-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Reports Tab */}
          <TabsContent value="reports" className="space-y-6">
            <Card data-testid="card-reports">
              <CardHeader>
                <CardTitle>Reports & Analytics</CardTitle>
                <CardDescription>Download reports and view analytics</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid gap-4 md:grid-cols-2">
                  <Button variant="outline" className="h-20 flex-col">
                    <Download className="w-6 h-6 mb-2" />
                    Partner Report
                  </Button>
                  <Button variant="outline" className="h-20 flex-col">
                    <Download className="w-6 h-6 mb-2" />
                    Client Report
                  </Button>
                  <Button variant="outline" className="h-20 flex-col">
                    <Download className="w-6 h-6 mb-2" />
                    Commission Report
                  </Button>
                  <Button variant="outline" className="h-20 flex-col">
                    <Download className="w-6 h-6 mb-2" />
                    Activity Report
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Add Partner Dialog */}
        <Dialog open={showAddPartnerDialog} onOpenChange={setShowAddPartnerDialog}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Add New Partner</DialogTitle>
              <DialogDescription>Add a new partner with or without EUIN/ARN numbers</DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="companyName">Company Name</Label>
                  <Input
                    id="companyName"
                    value={partnerForm.companyName}
                    onChange={(e) => setPartnerForm({ ...partnerForm, companyName: e.target.value })}
                    placeholder="Enter company name"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="contactEmail">Contact Email</Label>
                  <Input
                    id="contactEmail"
                    type="email"
                    value={partnerForm.contactEmail}
                    onChange={(e) => setPartnerForm({ ...partnerForm, contactEmail: e.target.value })}
                    placeholder="contact@company.com"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="contactPhone">Contact Phone</Label>
                  <Input
                    id="contactPhone"
                    value={partnerForm.contactPhone}
                    onChange={(e) => setPartnerForm({ ...partnerForm, contactPhone: e.target.value })}
                    placeholder="+91 9876543210"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="partnerType">Partner Type</Label>
                  <Select value={partnerForm.partnerType} onValueChange={(value) => setPartnerForm({ ...partnerForm, partnerType: value })}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="product_provider">Product Provider</SelectItem>
                      <SelectItem value="service_provider">Service Provider</SelectItem>
                      <SelectItem value="both">Both</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="address">Address</Label>
                <Textarea
                  id="address"
                  value={partnerForm.address}
                  onChange={(e) => setPartnerForm({ ...partnerForm, address: e.target.value })}
                  placeholder="Enter complete address"
                />
              </div>

              <div className="flex items-center space-x-2">
                <Switch
                  checked={partnerForm.hasEuinArn}
                  onCheckedChange={(checked) => setPartnerForm({ ...partnerForm, hasEuinArn: checked })}
                />
                <Label>Partner has EUIN/ARN Number</Label>
              </div>

              {partnerForm.hasEuinArn && (
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="euinNumber">EUIN Number</Label>
                    <Input
                      id="euinNumber"
                      value={partnerForm.euinNumber}
                      onChange={(e) => setPartnerForm({ ...partnerForm, euinNumber: e.target.value })}
                      placeholder="Enter EUIN number"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="arnCode">ARN Code</Label>
                    <Input
                      id="arnCode"
                      value={partnerForm.arnCode}
                      onChange={(e) => setPartnerForm({ ...partnerForm, arnCode: e.target.value })}
                      placeholder="Enter ARN code"
                    />
                  </div>
                </div>
              )}

              {!partnerForm.hasEuinArn && (
                <div className="p-4 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg">
                  <div className="flex items-center gap-2">
                    <Info className="w-4 h-4 text-yellow-600" />
                    <p className="text-sm text-yellow-800 dark:text-yellow-200">
                      This partner will be mapped under your master EUIN: <strong>{agentProfile?.euinNumber}</strong>
                    </p>
                  </div>
                </div>
              )}
            </div>
            <div className="flex justify-end space-x-2">
              <Button variant="outline" onClick={() => setShowAddPartnerDialog(false)}>
                Cancel
              </Button>
              <Button onClick={handleAddPartner} disabled={addPartnerMutation.isPending}>
                {addPartnerMutation.isPending ? "Adding..." : "Add Partner"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        {/* Add Client Dialog */}
        <Dialog open={showAddClientDialog} onOpenChange={setShowAddClientDialog}>
          <DialogContent className="max-w-xl">
            <DialogHeader>
              <DialogTitle>Add New Client</DialogTitle>
              <DialogDescription>Add a new client and assign EUIN mapping</DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="firstName">First Name</Label>
                  <Input
                    id="firstName"
                    value={clientForm.firstName}
                    onChange={(e) => setClientForm({ ...clientForm, firstName: e.target.value })}
                    placeholder="Enter first name"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="lastName">Last Name</Label>
                  <Input
                    id="lastName"
                    value={clientForm.lastName}
                    onChange={(e) => setClientForm({ ...clientForm, lastName: e.target.value })}
                    placeholder="Enter last name"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    value={clientForm.email}
                    onChange={(e) => setClientForm({ ...clientForm, email: e.target.value })}
                    placeholder="client@example.com"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="mobile">Mobile</Label>
                  <Input
                    id="mobile"
                    value={clientForm.mobile}
                    onChange={(e) => setClientForm({ ...clientForm, mobile: e.target.value })}
                    placeholder="+91 9876543210"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="panNumber">PAN Number</Label>
                <Input
                  id="panNumber"
                  value={clientForm.panNumber}
                  onChange={(e) => setClientForm({ ...clientForm, panNumber: e.target.value })}
                  placeholder="ABCDE1234F"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="assignedAgent">Assigned Agent (Optional)</Label>
                <Input
                  id="assignedAgent"
                  value={clientForm.assignedAgent}
                  onChange={(e) => setClientForm({ ...clientForm, assignedAgent: e.target.value })}
                  placeholder="Leave empty to use master agent"
                />
              </div>

              {!clientForm.assignedAgent && (
                <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                  <div className="flex items-center gap-2">
                    <Info className="w-4 h-4 text-blue-600" />
                    <p className="text-sm text-blue-800 dark:text-blue-200">
                      This client will be assigned to your master EUIN: <strong>{agentProfile?.euinNumber}</strong>
                    </p>
                  </div>
                </div>
              )}
            </div>
            <div className="flex justify-end space-x-2">
              <Button variant="outline" onClick={() => setShowAddClientDialog(false)}>
                Cancel
              </Button>
              <Button onClick={handleAddClient} disabled={addClientMutation.isPending}>
                {addClientMutation.isPending ? "Adding..." : "Add Client"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}