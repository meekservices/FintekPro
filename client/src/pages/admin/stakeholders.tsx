import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { 
  Users, 
  Building2, 
  Headphones, 
  Package, 
  Search, 
  Filter,
  Download,
  Plus,
  MoreVertical,
  TrendingUp,
  TrendingDown,
  Mail,
  Phone,
  MapPin,
  Check,
  X,
  RefreshCw
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";

type StakeholderType = "clients" | "partners" | "agents" | "suppliers";

interface User {
  id: string;
  userId: string;
  fullName: string;
  email: string;
  mobile: string | null;
  roles: string[];
  status: string;
  kycStatus?: string;
  createdAt: string;
}

interface Partner {
  id: string;
  companyName: string;
  contactEmail: string;
  contactPhone: string | null;
  partnerType: string;
  status: string;
  revenueShare: string | null;
  createdAt: string;
}

interface Agent {
  id: string;
  fullName: string;
  email: string;
  phone: string | null;
  employeeId: string | null;
  status: string;
  activeClients: number;
  totalRevenue: string;
  createdAt: string;
}

interface Supplier {
  id: string;
  name: string;
  email: string | null;
  contactPerson: string | null;
  phone: string | null;
  category: string;
  status: string;
  createdAt: string;
}

export default function StakeholdersPage() {
  const [activeTab, setActiveTab] = useState<StakeholderType>("clients");
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [currentPage, setCurrentPage] = useState(1);
  const pageLimit = 20;
  const { toast } = useToast();

  // Fetch stakeholders based on active tab
  const { data: clientsData, isLoading: loadingClients, refetch: refetchClients } = useQuery<any>({
    queryKey: ["/api/admin/users", { search: searchQuery, status: statusFilter === "all" ? undefined : statusFilter, page: currentPage, limit: pageLimit }],
    enabled: activeTab === "clients",
  });

  const { data: partnersData, isLoading: loadingPartners, refetch: refetchPartners } = useQuery<any>({
    queryKey: ["/api/admin/partners", { search: searchQuery, status: statusFilter === "all" ? undefined : statusFilter, page: currentPage, limit: pageLimit }],
    enabled: activeTab === "partners",
  });

  const { data: agentsData, isLoading: loadingAgents, refetch: refetchAgents } = useQuery<any>({
    queryKey: ["/api/admin/agents", { search: searchQuery, status: statusFilter === "all" ? undefined : statusFilter, page: currentPage, limit: pageLimit }],
    enabled: activeTab === "agents",
  });

  const { data: suppliersData, isLoading: loadingSuppiers, refetch: refetchSuppliers } = useQuery<any>({
    queryKey: ["/api/admin/suppliers", { search: searchQuery, status: statusFilter === "all" ? undefined : statusFilter, page: currentPage, limit: pageLimit }],
    enabled: activeTab === "suppliers",
  });

  // Get current data based on active tab
  const getCurrentData = () => {
    switch (activeTab) {
      case "clients": return clientsData;
      case "partners": return partnersData;
      case "agents": return agentsData;
      case "suppliers": return suppliersData;
      default: return null;
    }
  };

  const getCurrentLoading = () => {
    switch (activeTab) {
      case "clients": return loadingClients;
      case "partners": return loadingPartners;
      case "agents": return loadingAgents;
      case "suppliers": return loadingSuppiers;
      default: return false;
    }
  };

  const handleRefresh = () => {
    switch (activeTab) {
      case "clients": refetchClients(); break;
      case "partners": refetchPartners(); break;
      case "agents": refetchAgents(); break;
      case "suppliers": refetchSuppliers(); break;
    }
    toast({
      title: "Refreshed",
      description: "Stakeholder data has been refreshed",
    });
  };

  const handleStatusToggle = async (id: string, type: StakeholderType, currentStatus: string) => {
    try {
      const newStatus = currentStatus === "active" ? "inactive" : "active";
      const endpoint = type === "clients" ? `/api/admin/users/${id}/status` :
                      type === "partners" ? `/api/admin/partners/${id}/status` :
                      type === "agents" ? `/api/admin/agents/${id}/status` :
                      `/api/admin/suppliers/${id}/status`;

      await apiRequest("PATCH", endpoint, { body: { status: newStatus } });

      toast({
        title: "Status Updated",
        description: `Stakeholder ${newStatus === "active" ? "activated" : "deactivated"} successfully`,
      });

      handleRefresh();
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to update status",
        variant: "destructive",
      });
    }
  };

  const currentData = getCurrentData();
  const isLoading = getCurrentLoading();
  const items = currentData?.data || [];
  const totalCount = currentData?.total || 0;
  const totalPages = Math.ceil(totalCount / pageLimit);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">
          Stakeholder Management
        </h1>
        <p className="text-gray-500 dark:text-gray-400 mt-2">
          Manage clients, partners, agents, and suppliers across your platform
        </p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <Card data-testid="card-clients-summary">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-gray-600 dark:text-gray-400">
              Total Clients
            </CardTitle>
            <Users className="h-4 w-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-gray-900 dark:text-gray-100">
              {clientsData?.total || 0}
            </div>
            <p className="text-xs text-green-600 flex items-center mt-1">
              <TrendingUp className="h-3 w-3 mr-1" />
              12% from last month
            </p>
          </CardContent>
        </Card>

        <Card data-testid="card-partners-summary">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-gray-600 dark:text-gray-400">
              Total Partners
            </CardTitle>
            <Building2 className="h-4 w-4 text-purple-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-gray-900 dark:text-gray-100">
              {partnersData?.total || 0}
            </div>
            <p className="text-xs text-green-600 flex items-center mt-1">
              <TrendingUp className="h-3 w-3 mr-1" />
              8% from last month
            </p>
          </CardContent>
        </Card>

        <Card data-testid="card-agents-summary">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-gray-600 dark:text-gray-400">
              Total Agents
            </CardTitle>
            <Headphones className="h-4 w-4 text-orange-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-gray-900 dark:text-gray-100">
              {agentsData?.total || 0}
            </div>
            <p className="text-xs text-red-600 flex items-center mt-1">
              <TrendingDown className="h-3 w-3 mr-1" />
              3% from last month
            </p>
          </CardContent>
        </Card>

        <Card data-testid="card-suppliers-summary">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-gray-600 dark:text-gray-400">
              Total Suppliers
            </CardTitle>
            <Package className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-gray-900 dark:text-gray-100">
              {suppliersData?.total || 0}
            </div>
            <p className="text-xs text-green-600 flex items-center mt-1">
              <TrendingUp className="h-3 w-3 mr-1" />
              5% from last month
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Filters and Actions */}
      <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
        <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto">
          <div className="relative flex-1 sm:w-80">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input
              placeholder="Search by name, email, or ID..."
              className="pl-10"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              data-testid="input-search-stakeholder"
            />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-full sm:w-[180px]" data-testid="select-status-filter">
              <Filter className="h-4 w-4 mr-2" />
              <SelectValue placeholder="Filter by status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="inactive">Inactive</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="flex gap-2 w-full sm:w-auto">
          <Button variant="outline" onClick={handleRefresh} data-testid="button-refresh">
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
          <Button variant="outline" data-testid="button-export">
            <Download className="h-4 w-4 mr-2" />
            Export
          </Button>
          <Button data-testid="button-add-stakeholder">
            <Plus className="h-4 w-4 mr-2" />
            Add New
          </Button>
        </div>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={(v) => {
        setActiveTab(v as StakeholderType);
        setCurrentPage(1);
        setSearchQuery("");
        setStatusFilter("all");
      }}>
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="clients" data-testid="tab-clients">
            <Users className="h-4 w-4 mr-2" />
            Clients
          </TabsTrigger>
          <TabsTrigger value="partners" data-testid="tab-partners">
            <Building2 className="h-4 w-4 mr-2" />
            Partners
          </TabsTrigger>
          <TabsTrigger value="agents" data-testid="tab-agents">
            <Headphones className="h-4 w-4 mr-2" />
            Agents
          </TabsTrigger>
          <TabsTrigger value="suppliers" data-testid="tab-suppliers">
            <Package className="h-4 w-4 mr-2" />
            Suppliers
          </TabsTrigger>
        </TabsList>

        {/* Clients Tab */}
        <TabsContent value="clients" className="mt-6">
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>User ID</TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead>Contact</TableHead>
                    <TableHead>Roles</TableHead>
                    <TableHead>KYC Status</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoading ? (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center py-8 text-gray-500">
                        Loading...
                      </TableCell>
                    </TableRow>
                  ) : items.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center py-8 text-gray-500">
                        No clients found
                      </TableCell>
                    </TableRow>
                  ) : (
                    items.map((user: User) => (
                      <TableRow key={user.id} data-testid={`row-client-${user.id}`}>
                        <TableCell className="font-mono text-sm">{user.userId}</TableCell>
                        <TableCell className="font-medium">{user.fullName}</TableCell>
                        <TableCell>
                          <div className="space-y-1 text-sm">
                            <div className="flex items-center text-gray-600 dark:text-gray-400">
                              <Mail className="h-3 w-3 mr-2" />
                              {user.email}
                            </div>
                            {user.mobile && (
                              <div className="flex items-center text-gray-600 dark:text-gray-400">
                                <Phone className="h-3 w-3 mr-2" />
                                {user.mobile}
                              </div>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-wrap gap-1">
                            {user.roles.map((role) => (
                              <Badge key={role} variant="secondary" className="text-xs">
                                {role}
                              </Badge>
                            ))}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge 
                            variant={user.kycStatus === "approved" ? "default" : "secondary"}
                            className={
                              user.kycStatus === "approved" ? "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100" :
                              user.kycStatus === "pending" ? "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-100" :
                              "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-100"
                            }
                          >
                            {user.kycStatus || "Not Started"}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge variant={user.status === "active" ? "default" : "secondary"}>
                            {user.status}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="sm" data-testid={`button-actions-client-${user.id}`}>
                                <MoreVertical className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuLabel>Actions</DropdownMenuLabel>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem>View Details</DropdownMenuItem>
                              <DropdownMenuItem>Edit Profile</DropdownMenuItem>
                              <DropdownMenuItem 
                                onClick={() => handleStatusToggle(user.id, "clients", user.status)}
                              >
                                {user.status === "active" ? "Deactivate" : "Activate"}
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem className="text-red-600">Delete</DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Partners Tab */}
        <TabsContent value="partners" className="mt-6">
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Company Name</TableHead>
                    <TableHead>Contact</TableHead>
                    <TableHead>Partner Type</TableHead>
                    <TableHead>Revenue Share</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoading ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-8 text-gray-500">
                        Loading...
                      </TableCell>
                    </TableRow>
                  ) : items.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-8 text-gray-500">
                        No partners found
                      </TableCell>
                    </TableRow>
                  ) : (
                    items.map((partner: Partner) => (
                      <TableRow key={partner.id} data-testid={`row-partner-${partner.id}`}>
                        <TableCell className="font-medium">{partner.companyName}</TableCell>
                        <TableCell>
                          <div className="space-y-1 text-sm">
                            <div className="flex items-center text-gray-600 dark:text-gray-400">
                              <Mail className="h-3 w-3 mr-2" />
                              {partner.contactEmail}
                            </div>
                            {partner.contactPhone && (
                              <div className="flex items-center text-gray-600 dark:text-gray-400">
                                <Phone className="h-3 w-3 mr-2" />
                                {partner.contactPhone}
                              </div>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">{partner.partnerType}</Badge>
                        </TableCell>
                        <TableCell>{partner.revenueShare || "N/A"}%</TableCell>
                        <TableCell>
                          <Badge variant={partner.status === "active" ? "default" : "secondary"}>
                            {partner.status}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="sm" data-testid={`button-actions-partner-${partner.id}`}>
                                <MoreVertical className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuLabel>Actions</DropdownMenuLabel>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem>View Details</DropdownMenuItem>
                              <DropdownMenuItem>Edit Partner</DropdownMenuItem>
                              <DropdownMenuItem 
                                onClick={() => handleStatusToggle(partner.id, "partners", partner.status)}
                              >
                                {partner.status === "active" ? "Deactivate" : "Activate"}
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem className="text-red-600">Delete</DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Agents Tab */}
        <TabsContent value="agents" className="mt-6">
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Contact</TableHead>
                    <TableHead>Employee ID</TableHead>
                    <TableHead>Active Clients</TableHead>
                    <TableHead>Revenue</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoading ? (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center py-8 text-gray-500">
                        Loading...
                      </TableCell>
                    </TableRow>
                  ) : items.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center py-8 text-gray-500">
                        No agents found
                      </TableCell>
                    </TableRow>
                  ) : (
                    items.map((agent: Agent) => (
                      <TableRow key={agent.id} data-testid={`row-agent-${agent.id}`}>
                        <TableCell className="font-medium">{agent.fullName}</TableCell>
                        <TableCell>
                          <div className="space-y-1 text-sm">
                            <div className="flex items-center text-gray-600 dark:text-gray-400">
                              <Mail className="h-3 w-3 mr-2" />
                              {agent.email}
                            </div>
                            {agent.phone && (
                              <div className="flex items-center text-gray-600 dark:text-gray-400">
                                <Phone className="h-3 w-3 mr-2" />
                                {agent.phone}
                              </div>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <span className="font-mono text-sm">{agent.employeeId || "N/A"}</span>
                        </TableCell>
                        <TableCell>
                          <Badge variant="secondary">{agent.activeClients || 0}</Badge>
                        </TableCell>
                        <TableCell className="font-medium">₹{agent.totalRevenue || "0.00"}</TableCell>
                        <TableCell>
                          <Badge variant={agent.status === "active" ? "default" : "secondary"}>
                            {agent.status}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="sm" data-testid={`button-actions-agent-${agent.id}`}>
                                <MoreVertical className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuLabel>Actions</DropdownMenuLabel>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem>View Details</DropdownMenuItem>
                              <DropdownMenuItem>Edit Agent</DropdownMenuItem>
                              <DropdownMenuItem>Assign Clients</DropdownMenuItem>
                              <DropdownMenuItem 
                                onClick={() => handleStatusToggle(agent.id, "agents", agent.status)}
                              >
                                {agent.status === "active" ? "Deactivate" : "Activate"}
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem className="text-red-600">Delete</DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Suppliers Tab */}
        <TabsContent value="suppliers" className="mt-6">
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Contact Person</TableHead>
                    <TableHead>Contact Info</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoading ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-8 text-gray-500">
                        Loading...
                      </TableCell>
                    </TableRow>
                  ) : items.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-8 text-gray-500">
                        No suppliers found
                      </TableCell>
                    </TableRow>
                  ) : (
                    items.map((supplier: Supplier) => (
                      <TableRow key={supplier.id} data-testid={`row-supplier-${supplier.id}`}>
                        <TableCell className="font-medium">{supplier.name}</TableCell>
                        <TableCell>{supplier.contactPerson || "N/A"}</TableCell>
                        <TableCell>
                          <div className="space-y-1 text-sm">
                            {supplier.email && (
                              <div className="flex items-center text-gray-600 dark:text-gray-400">
                                <Mail className="h-3 w-3 mr-2" />
                                {supplier.email}
                              </div>
                            )}
                            {supplier.phone && (
                              <div className="flex items-center text-gray-600 dark:text-gray-400">
                                <Phone className="h-3 w-3 mr-2" />
                                {supplier.phone}
                              </div>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">{supplier.category}</Badge>
                        </TableCell>
                        <TableCell>
                          <Badge variant={supplier.status === "active" ? "default" : "secondary"}>
                            {supplier.status}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="sm" data-testid={`button-actions-supplier-${supplier.id}`}>
                                <MoreVertical className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuLabel>Actions</DropdownMenuLabel>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem>View Details</DropdownMenuItem>
                              <DropdownMenuItem>Edit Supplier</DropdownMenuItem>
                              <DropdownMenuItem>View Products</DropdownMenuItem>
                              <DropdownMenuItem 
                                onClick={() => handleStatusToggle(supplier.id, "suppliers", supplier.status)}
                              >
                                {supplier.status === "active" ? "Deactivate" : "Activate"}
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem className="text-red-600">Delete</DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Showing page {currentPage} of {totalPages} ({totalCount} total)
          </p>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              data-testid="button-prev-page"
            >
              Previous
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
              data-testid="button-next-page"
            >
              Next
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
