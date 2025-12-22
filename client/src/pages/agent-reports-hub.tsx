import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";
import type { LucideIcon } from "lucide-react";
import {
  FileText,
  Download,
  Calendar,
  User,
  TrendingUp,
  PieChart,
  BarChart3,
  IndianRupee,
  Search,
  Filter,
  RefreshCw,
  Send,
  Eye,
  FileDown,
  Clock,
  CheckCircle,
  Loader2,
  Share2,
  Briefcase,
  Target,
  ArrowUpRight,
  Mail,
  Plus
} from "lucide-react";

interface ReportTemplate {
  id: string;
  name: string;
  description: string;
  category: 'portfolio' | 'performance' | 'tax' | 'compliance' | 'summary';
  icon: LucideIcon;
  fields: string[];
}

interface GeneratedReport {
  id: string;
  name: string;
  template: string;
  clientName: string;
  clientId: string;
  generatedAt: string;
  period: string;
  status: 'ready' | 'generating' | 'sent';
  size: string;
}

const REPORT_TEMPLATES: ReportTemplate[] = [
  {
    id: 'portfolio_summary',
    name: 'Portfolio Summary',
    description: 'Complete overview of client portfolio with holdings, allocation, and performance',
    category: 'portfolio',
    icon: Briefcase,
    fields: ['holdings', 'allocation', 'performance', 'transactions']
  },
  {
    id: 'performance_analysis',
    name: 'Performance Analysis',
    description: 'Detailed returns analysis with XIRR, CAGR, and benchmark comparison',
    category: 'performance',
    icon: TrendingUp,
    fields: ['returns', 'xirr', 'cagr', 'benchmark']
  },
  {
    id: 'tax_report',
    name: 'Capital Gains Report',
    description: 'Tax-ready report with realized gains, LTCG/STCG breakdown',
    category: 'tax',
    icon: FileText,
    fields: ['realized_gains', 'ltcg', 'stcg', 'tax_liability']
  },
  {
    id: 'goal_tracker',
    name: 'Financial Goals Tracker',
    description: 'Progress report on all financial goals with projections',
    category: 'summary',
    icon: Target,
    fields: ['goals', 'progress', 'projections', 'recommendations']
  },
  {
    id: 'kyc_compliance',
    name: 'KYC & Compliance Report',
    description: 'Compliance status, document verification, and regulatory summary',
    category: 'compliance',
    icon: CheckCircle,
    fields: ['kyc_status', 'documents', 'risk_profile', 'suitability']
  },
  {
    id: 'quarterly_review',
    name: 'Quarterly Review',
    description: 'Comprehensive quarterly performance and market outlook',
    category: 'summary',
    icon: BarChart3,
    fields: ['performance', 'market_outlook', 'rebalancing', 'recommendations']
  }
];

const GENERATED_REPORTS: GeneratedReport[] = [
  { id: '1', name: 'Portfolio Summary - Q4 2024', template: 'portfolio_summary', clientName: 'Rajesh Sharma', clientId: '1', generatedAt: '2024-12-20', period: 'Q4 2024', status: 'ready', size: '2.4 MB' },
  { id: '2', name: 'Performance Analysis - FY 2024', template: 'performance_analysis', clientName: 'Rajesh Sharma', clientId: '1', generatedAt: '2024-12-18', period: 'FY 2024', status: 'sent', size: '1.8 MB' },
  { id: '3', name: 'Capital Gains Report - FY 2024', template: 'tax_report', clientName: 'Priya Patel', clientId: '2', generatedAt: '2024-12-15', period: 'FY 2024', status: 'ready', size: '890 KB' },
  { id: '4', name: 'Portfolio Summary - Q4 2024', template: 'portfolio_summary', clientName: 'Amit Kumar', clientId: '3', generatedAt: '2024-12-12', period: 'Q4 2024', status: 'sent', size: '3.1 MB' },
  { id: '5', name: 'Quarterly Review - Q3 2024', template: 'quarterly_review', clientName: 'Sunita Reddy', clientId: '4', generatedAt: '2024-10-05', period: 'Q3 2024', status: 'sent', size: '2.2 MB' }
];

const CLIENTS = [
  { id: '1', name: 'Rajesh Sharma' },
  { id: '2', name: 'Priya Patel' },
  { id: '3', name: 'Amit Kumar' },
  { id: '4', name: 'Sunita Reddy' },
  { id: '5', name: 'Vikram Singh' }
];

export default function AgentReportsHub() {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState("templates");
  const [searchQuery, setSearchQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [showGenerateDialog, setShowGenerateDialog] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<ReportTemplate | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  
  const [reportConfig, setReportConfig] = useState({
    clientId: '',
    period: 'q4_2024',
    includeCharts: true,
    includeRecommendations: true
  });

  const filteredTemplates = REPORT_TEMPLATES.filter(template => {
    const matchesSearch = template.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      template.description.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = categoryFilter === 'all' || template.category === categoryFilter;
    return matchesSearch && matchesCategory;
  });

  const filteredReports = GENERATED_REPORTS.filter(report =>
    report.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    report.clientName.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const formatDate = (dateStr: string) => 
    new Date(dateStr).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });

  const handleGenerateReport = async () => {
    if (!selectedTemplate || !reportConfig.clientId) {
      toast({ title: "Please select a client", variant: "destructive" });
      return;
    }
    
    setIsGenerating(true);
    
    setTimeout(() => {
      setIsGenerating(false);
      setShowGenerateDialog(false);
      toast({
        title: "Report Generated",
        description: `${selectedTemplate.name} for ${CLIENTS.find(c => c.id === reportConfig.clientId)?.name} is ready for download`
      });
    }, 2000);
  };

  const handleDownloadReport = (report: GeneratedReport) => {
    toast({
      title: "Downloading Report",
      description: `${report.name} (${report.size})`
    });
  };

  const handleEmailReport = (report: GeneratedReport) => {
    toast({
      title: "Report Sent",
      description: `${report.name} sent to ${report.clientName}`
    });
  };

  const getCategoryColor = (category: string) => {
    switch (category) {
      case 'portfolio': return 'bg-blue-500/20 text-blue-400';
      case 'performance': return 'bg-emerald-500/20 text-emerald-400';
      case 'tax': return 'bg-amber-500/20 text-amber-400';
      case 'compliance': return 'bg-indigo-500/20 text-indigo-400';
      case 'summary': return 'bg-purple-500/20 text-purple-400';
      default: return 'bg-slate-500/20 text-slate-400';
    }
  };

  const getStatusConfig = (status: string) => {
    switch (status) {
      case 'ready': return { color: 'bg-emerald-500/20 text-emerald-400', label: 'Ready', icon: Download };
      case 'generating': return { color: 'bg-blue-500/20 text-blue-400', label: 'Generating', icon: Loader2 };
      case 'sent': return { color: 'bg-purple-500/20 text-purple-400', label: 'Sent', icon: Mail };
      default: return { color: 'bg-slate-500/20 text-slate-400', label: status, icon: FileText };
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h1 className="text-2xl font-bold text-white flex items-center gap-2">
              <FileText className="h-7 w-7 text-emerald-500" />
              Reports Hub
            </h1>
            <p className="text-slate-400 mt-1">Generate and share client reports</p>
          </div>
          <div className="flex items-center gap-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <Input
                placeholder="Search reports..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 w-64 bg-slate-800 border-slate-700 text-white"
                data-testid="input-search-reports"
              />
            </div>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card className="bg-slate-800/50 border-slate-700">
            <CardContent className="p-4">
              <div className="flex justify-between items-start">
                <div>
                  <p className="text-slate-400 text-sm">Templates</p>
                  <p className="text-2xl font-bold text-white">{REPORT_TEMPLATES.length}</p>
                </div>
                <div className="p-2 bg-blue-500/20 rounded-lg">
                  <FileText className="h-5 w-5 text-blue-400" />
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="bg-slate-800/50 border-slate-700">
            <CardContent className="p-4">
              <div className="flex justify-between items-start">
                <div>
                  <p className="text-slate-400 text-sm">Generated This Month</p>
                  <p className="text-2xl font-bold text-white">{GENERATED_REPORTS.length}</p>
                </div>
                <div className="p-2 bg-emerald-500/20 rounded-lg">
                  <FileDown className="h-5 w-5 text-emerald-400" />
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="bg-slate-800/50 border-slate-700">
            <CardContent className="p-4">
              <div className="flex justify-between items-start">
                <div>
                  <p className="text-slate-400 text-sm">Sent to Clients</p>
                  <p className="text-2xl font-bold text-white">{GENERATED_REPORTS.filter(r => r.status === 'sent').length}</p>
                </div>
                <div className="p-2 bg-purple-500/20 rounded-lg">
                  <Send className="h-5 w-5 text-purple-400" />
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="bg-slate-800/50 border-slate-700">
            <CardContent className="p-4">
              <div className="flex justify-between items-start">
                <div>
                  <p className="text-slate-400 text-sm">Ready to Send</p>
                  <p className="text-2xl font-bold text-white">{GENERATED_REPORTS.filter(r => r.status === 'ready').length}</p>
                </div>
                <div className="p-2 bg-amber-500/20 rounded-lg">
                  <Clock className="h-5 w-5 text-amber-400" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Main Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
          <TabsList className="bg-slate-800 border-slate-700">
            <TabsTrigger value="templates" className="data-[state=active]:bg-emerald-600">Report Templates</TabsTrigger>
            <TabsTrigger value="generated" className="data-[state=active]:bg-emerald-600">Generated Reports</TabsTrigger>
          </TabsList>

          {/* Templates Tab */}
          <TabsContent value="templates" className="space-y-4">
            <div className="flex justify-between items-center">
              <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                <SelectTrigger className="w-48 bg-slate-800 border-slate-700">
                  <Filter className="h-4 w-4 mr-2 text-slate-400" />
                  <SelectValue placeholder="Category" />
                </SelectTrigger>
                <SelectContent className="bg-slate-800 border-slate-700">
                  <SelectItem value="all">All Categories</SelectItem>
                  <SelectItem value="portfolio">Portfolio</SelectItem>
                  <SelectItem value="performance">Performance</SelectItem>
                  <SelectItem value="tax">Tax</SelectItem>
                  <SelectItem value="compliance">Compliance</SelectItem>
                  <SelectItem value="summary">Summary</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredTemplates.map((template) => {
                const Icon = template.icon;
                return (
                  <Card key={template.id} className="bg-slate-800/50 border-slate-700 hover:border-emerald-500/50 transition-colors cursor-pointer" data-testid={`template-${template.id}`}>
                    <CardHeader className="pb-2">
                      <div className="flex items-start justify-between">
                        <div className={`p-3 rounded-lg ${getCategoryColor(template.category)}`}>
                          <Icon className="h-6 w-6" />
                        </div>
                        <Badge className={getCategoryColor(template.category)}>
                          {template.category.charAt(0).toUpperCase() + template.category.slice(1)}
                        </Badge>
                      </div>
                      <CardTitle className="text-white text-lg mt-3">{template.name}</CardTitle>
                      <CardDescription className="text-slate-400">{template.description}</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="flex flex-wrap gap-1 mb-4">
                        {template.fields.map((field) => (
                          <Badge key={field} variant="outline" className="text-xs border-slate-600 text-slate-400">
                            {field.replace('_', ' ')}
                          </Badge>
                        ))}
                      </div>
                      <Button 
                        className="w-full bg-emerald-600 hover:bg-emerald-700"
                        onClick={() => {
                          setSelectedTemplate(template);
                          setShowGenerateDialog(true);
                        }}
                        data-testid={`button-generate-${template.id}`}
                      >
                        <Plus className="h-4 w-4 mr-2" />
                        Generate Report
                      </Button>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </TabsContent>

          {/* Generated Reports Tab */}
          <TabsContent value="generated" className="space-y-4">
            <Card className="bg-slate-800/50 border-slate-700">
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-slate-700">
                        <th className="text-left p-4 text-slate-400 text-sm font-medium">Report</th>
                        <th className="text-left p-4 text-slate-400 text-sm font-medium">Client</th>
                        <th className="text-left p-4 text-slate-400 text-sm font-medium">Period</th>
                        <th className="text-left p-4 text-slate-400 text-sm font-medium">Generated</th>
                        <th className="text-left p-4 text-slate-400 text-sm font-medium">Status</th>
                        <th className="text-left p-4 text-slate-400 text-sm font-medium">Size</th>
                        <th className="text-right p-4 text-slate-400 text-sm font-medium">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredReports.map((report) => {
                        const statusConfig = getStatusConfig(report.status);
                        const StatusIcon = statusConfig.icon;
                        return (
                          <tr key={report.id} className="border-b border-slate-700/50 hover:bg-slate-900/50" data-testid={`report-row-${report.id}`}>
                            <td className="p-4">
                              <div className="flex items-center gap-3">
                                <div className="p-2 bg-slate-700 rounded-lg">
                                  <FileText className="h-4 w-4 text-slate-400" />
                                </div>
                                <span className="text-white font-medium">{report.name}</span>
                              </div>
                            </td>
                            <td className="p-4">
                              <span className="text-slate-300">{report.clientName}</span>
                            </td>
                            <td className="p-4">
                              <span className="text-slate-300">{report.period}</span>
                            </td>
                            <td className="p-4">
                              <span className="text-slate-400">{formatDate(report.generatedAt)}</span>
                            </td>
                            <td className="p-4">
                              <Badge className={`${statusConfig.color} flex items-center gap-1 w-fit`}>
                                <StatusIcon className={`h-3 w-3 ${report.status === 'generating' ? 'animate-spin' : ''}`} />
                                {statusConfig.label}
                              </Badge>
                            </td>
                            <td className="p-4">
                              <span className="text-slate-400">{report.size}</span>
                            </td>
                            <td className="p-4">
                              <div className="flex items-center justify-end gap-2">
                                <Button 
                                  size="sm" 
                                  variant="ghost" 
                                  className="text-slate-400 hover:text-white"
                                  onClick={() => handleDownloadReport(report)}
                                  data-testid={`button-download-${report.id}`}
                                >
                                  <Download className="h-4 w-4" />
                                </Button>
                                <Button 
                                  size="sm" 
                                  variant="ghost" 
                                  className="text-slate-400 hover:text-white"
                                  data-testid={`button-preview-${report.id}`}
                                >
                                  <Eye className="h-4 w-4" />
                                </Button>
                                {report.status === 'ready' && (
                                  <Button 
                                    size="sm" 
                                    variant="ghost" 
                                    className="text-slate-400 hover:text-emerald-400"
                                    onClick={() => handleEmailReport(report)}
                                    data-testid={`button-email-${report.id}`}
                                  >
                                    <Send className="h-4 w-4" />
                                  </Button>
                                )}
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Generate Report Dialog */}
        <Dialog open={showGenerateDialog} onOpenChange={setShowGenerateDialog}>
          <DialogContent className="bg-slate-900 border-slate-700 text-white max-w-lg">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                {selectedTemplate && (
                  <>
                    <selectedTemplate.icon className="h-5 w-5 text-emerald-400" />
                    Generate {selectedTemplate.name}
                  </>
                )}
              </DialogTitle>
              <DialogDescription className="text-slate-400">
                Configure report settings and select client
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 mt-4">
              <div>
                <Label className="text-slate-300">Client *</Label>
                <Select value={reportConfig.clientId} onValueChange={(value) => setReportConfig({ ...reportConfig, clientId: value })}>
                  <SelectTrigger className="mt-1 bg-slate-800 border-slate-700" data-testid="select-report-client">
                    <SelectValue placeholder="Select client" />
                  </SelectTrigger>
                  <SelectContent className="bg-slate-800 border-slate-700">
                    {CLIENTS.map((client) => (
                      <SelectItem key={client.id} value={client.id}>{client.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-slate-300">Report Period</Label>
                <Select value={reportConfig.period} onValueChange={(value) => setReportConfig({ ...reportConfig, period: value })}>
                  <SelectTrigger className="mt-1 bg-slate-800 border-slate-700">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-slate-800 border-slate-700">
                    <SelectItem value="q4_2024">Q4 2024 (Oct-Dec)</SelectItem>
                    <SelectItem value="q3_2024">Q3 2024 (Jul-Sep)</SelectItem>
                    <SelectItem value="h2_2024">H2 2024 (Jul-Dec)</SelectItem>
                    <SelectItem value="fy_2024">FY 2024 (Apr 24 - Mar 25)</SelectItem>
                    <SelectItem value="fy_2023">FY 2023 (Apr 23 - Mar 24)</SelectItem>
                    <SelectItem value="ytd">Year to Date</SelectItem>
                    <SelectItem value="all_time">All Time</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {selectedTemplate && (
                <div className="p-3 bg-slate-800 rounded-lg">
                  <p className="text-slate-400 text-sm mb-2">Report Sections</p>
                  <div className="flex flex-wrap gap-2">
                    {selectedTemplate.fields.map((field) => (
                      <Badge key={field} className="bg-emerald-500/20 text-emerald-400">
                        {field.replace('_', ' ')}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
              <div className="flex justify-end gap-3 pt-4">
                <Button variant="outline" onClick={() => setShowGenerateDialog(false)} className="border-slate-600">
                  Cancel
                </Button>
                <Button 
                  onClick={handleGenerateReport}
                  disabled={isGenerating || !reportConfig.clientId}
                  className="bg-emerald-600 hover:bg-emerald-700"
                  data-testid="button-confirm-generate"
                >
                  {isGenerating ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Generating...
                    </>
                  ) : (
                    <>
                      <FileDown className="h-4 w-4 mr-2" />
                      Generate Report
                    </>
                  )}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
