import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsTrigger } from "@/components/ui/tabs";
import { ScrollableTabsList } from "@/components/ScrollableTabsList";
import { Skeleton } from "@/components/ui/skeleton";
import { 
  AlertTriangle, 
  FileText, 
  Upload, 
  Clock, 
  CheckCircle, 
  XCircle,
  Search,
  Filter,
  Plus,
  Eye,
  MessageSquare,
  Users,
  Calendar,
  ChevronRight,
  AlertCircle,
  FileWarning,
  Scale,
  Inbox
} from "lucide-react";

interface TaxNotice {
  id: string;
  noticeType: string;
  section: string;
  assessmentYear: string;
  issueDate: string;
  dueDate: string;
  status: "pending" | "responded" | "closed" | "escalated";
  priority: "high" | "medium" | "low";
  assignedTo?: string;
  description: string;
}


const NOTICE_TYPES = [
  { type: "143(1)", name: "Intimation", description: "Processing of return with adjustments", severity: "low" },
  { type: "142(1)", name: "Inquiry", description: "Request for information/documents", severity: "medium" },
  { type: "143(2)", name: "Scrutiny", description: "Detailed examination of return", severity: "high" },
  { type: "148", name: "Reassessment", description: "Income escaped assessment", severity: "critical" },
  { type: "156", name: "Demand Notice", description: "Tax demand by department", severity: "high" },
  { type: "245", name: "Set Off", description: "Adjustment of refund against demand", severity: "medium" }
];

export default function TaxNoticesPage() {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedTab, setSelectedTab] = useState("all");

  // Fetch real tax notices from API
  const { data: noticesData, isLoading } = useQuery<{ notices: TaxNotice[] }>({
    queryKey: ["/api/tax/notices"],
  });

  const notices = noticesData?.notices || [];

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "pending": return <Badge className="bg-yellow-100 text-yellow-700">Pending</Badge>;
      case "responded": return <Badge className="bg-blue-100 text-blue-700">Responded</Badge>;
      case "closed": return <Badge className="bg-green-100 text-green-700">Closed</Badge>;
      case "escalated": return <Badge className="bg-red-100 text-red-700">Escalated</Badge>;
      default: return <Badge variant="secondary">{status}</Badge>;
    }
  };

  const getPriorityBadge = (priority: string) => {
    switch (priority) {
      case "high": return <Badge className="bg-red-100 text-red-700">High</Badge>;
      case "medium": return <Badge className="bg-yellow-100 text-yellow-700">Medium</Badge>;
      case "low": return <Badge className="bg-green-100 text-green-700">Low</Badge>;
      default: return null;
    }
  };

  const filteredNotices = notices.filter(notice => {
    const matchesSearch = notice.noticeType.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         notice.section.includes(searchTerm) ||
                         notice.assessmentYear.includes(searchTerm);
    const matchesTab = selectedTab === "all" || notice.status === selectedTab;
    return matchesSearch && matchesTab;
  });

  if (isLoading) {
    return (
      <div className="container mx-auto p-6 space-y-6">
        <Skeleton className="h-10 w-64" />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map(i => (
            <Skeleton key={i} className="h-24 w-full" />
          ))}
        </div>
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-3">
            <FileWarning className="h-8 w-8 text-orange-500" />
            Tax Notices & Responses
          </h1>
          <p className="text-muted-foreground">Manage and respond to income tax notices</p>
        </div>
        <Button className="gap-2" data-testid="button-upload-notice">
          <Upload className="h-4 w-4" /> Upload Notice
        </Button>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="bg-yellow-50 dark:bg-yellow-950" data-testid="stat-pending">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Pending</p>
                <p className="text-2xl font-bold text-yellow-700">{notices.filter(n => n.status === "pending").length}</p>
              </div>
              <Clock className="h-8 w-8 text-yellow-500" />
            </div>
          </CardContent>
        </Card>
        <Card className="bg-blue-50 dark:bg-blue-950" data-testid="stat-responded">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Responded</p>
                <p className="text-2xl font-bold text-blue-700">{notices.filter(n => n.status === "responded").length}</p>
              </div>
              <MessageSquare className="h-8 w-8 text-blue-500" />
            </div>
          </CardContent>
        </Card>
        <Card className="bg-green-50 dark:bg-green-950" data-testid="stat-closed">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Closed</p>
                <p className="text-2xl font-bold text-green-700">{notices.filter(n => n.status === "closed").length}</p>
              </div>
              <CheckCircle className="h-8 w-8 text-green-500" />
            </div>
          </CardContent>
        </Card>
        <Card className="bg-red-50 dark:bg-red-950" data-testid="stat-escalated">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Escalated</p>
                <p className="text-2xl font-bold text-red-700">{notices.filter(n => n.status === "escalated").length}</p>
              </div>
              <AlertTriangle className="h-8 w-8 text-red-500" />
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs value={selectedTab} onValueChange={setSelectedTab} className="space-y-4">
        <div className="flex items-center justify-between">
          <ScrollableTabsList>
            <TabsTrigger value="all" data-testid="tab-all-notices">All Notices</TabsTrigger>
            <TabsTrigger value="pending" data-testid="tab-pending-notices">Pending</TabsTrigger>
            <TabsTrigger value="responded" data-testid="tab-responded-notices">Responded</TabsTrigger>
            <TabsTrigger value="closed" data-testid="tab-closed-notices">Closed</TabsTrigger>
          </ScrollableTabsList>
          <div className="flex items-center gap-2">
            <div className="relative">
              <Search className="h-4 w-4 absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground" />
              <Input 
                placeholder="Search notices..." 
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9 w-64"
                data-testid="input-search-notices"
              />
            </div>
            <Button variant="outline" size="icon" data-testid="button-filter">
              <Filter className="h-4 w-4" />
            </Button>
          </div>
        </div>

        <TabsContent value={selectedTab} className="space-y-4">
          {/* Notice List */}
          <div className="space-y-3">
            {filteredNotices.map((notice) => (
              <Card key={notice.id} className="hover:shadow-md transition-shadow" data-testid={`notice-${notice.id}`}>
                <CardContent className="py-4">
                  <div className="flex items-start justify-between">
                    <div className="flex items-start gap-4">
                      <div className={`p-3 rounded-lg ${
                        notice.priority === "high" ? "bg-red-100 text-red-600" :
                        notice.priority === "medium" ? "bg-yellow-100 text-yellow-600" :
                        "bg-green-100 text-green-600"
                      }`}>
                        <Scale className="h-6 w-6" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <h4 className="font-semibold">{notice.noticeType}</h4>
                          {getPriorityBadge(notice.priority)}
                        </div>
                        <p className="text-sm text-muted-foreground">{notice.description}</p>
                        <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <Calendar className="h-3 w-3" /> AY {notice.assessmentYear}
                          </span>
                          <span>Issued: {notice.issueDate}</span>
                          <span className={notice.status === "pending" ? "text-red-500 font-medium" : ""}>
                            Due: {notice.dueDate}
                          </span>
                          {notice.assignedTo && (
                            <span className="flex items-center gap-1 text-purple-600">
                              <Users className="h-3 w-3" /> {notice.assignedTo}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-2">
                      {getStatusBadge(notice.status)}
                      <div className="flex gap-2 mt-2">
                        <Button size="sm" variant="outline" data-testid={`button-view-${notice.id}`}>
                          <Eye className="h-3 w-3 mr-1" /> View
                        </Button>
                        {notice.status === "pending" && (
                          <Button size="sm" data-testid={`button-respond-${notice.id}`}>
                            Respond <ChevronRight className="h-3 w-3 ml-1" />
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}

            {filteredNotices.length === 0 && (
              <Card className="py-12">
                <CardContent className="text-center">
                  <CheckCircle className="h-12 w-12 mx-auto text-green-500 mb-4" />
                  <h3 className="font-semibold text-lg">No notices found</h3>
                  <p className="text-muted-foreground">You're all caught up!</p>
                </CardContent>
              </Card>
            )}
          </div>
        </TabsContent>
      </Tabs>

      {/* Notice Types Reference */}
      <Card data-testid="card-notice-types">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertCircle className="h-5 w-5" />
            Understanding Tax Notices
          </CardTitle>
          <CardDescription>Quick reference for common income tax notices</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {NOTICE_TYPES.map((notice) => (
              <div key={notice.type} className="p-4 border rounded-lg" data-testid={`notice-type-${notice.type}`}>
                <div className="flex items-center justify-between mb-2">
                  <Badge variant="outline">Section {notice.type}</Badge>
                  <Badge className={
                    notice.severity === "critical" ? "bg-red-600 text-white" :
                    notice.severity === "high" ? "bg-red-100 text-red-700" :
                    notice.severity === "medium" ? "bg-yellow-100 text-yellow-700" :
                    "bg-green-100 text-green-700"
                  }>
                    {notice.severity}
                  </Badge>
                </div>
                <h4 className="font-semibold">{notice.name}</h4>
                <p className="text-sm text-muted-foreground">{notice.description}</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Help Card */}
      <Card className="bg-purple-50 dark:bg-purple-950 border-purple-200">
        <CardContent className="py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Users className="h-8 w-8 text-purple-600" />
              <div>
                <p className="font-medium">Need Expert Help?</p>
                <p className="text-sm text-muted-foreground">Get a CA to handle your tax notice</p>
              </div>
            </div>
            <Button className="bg-purple-600 hover:bg-purple-700" data-testid="button-hire-expert">
              Hire Expert
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
