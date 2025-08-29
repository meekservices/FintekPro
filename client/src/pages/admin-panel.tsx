import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { AlertTriangle, Users, Activity, TrendingUp, MessageSquare, Settings, Search, Filter, Shield, FileText, Building2, Plus, Edit3, Trash2, Server, Brain, Zap, Lock, Receipt, CheckCircle, Calendar, Download, Loader2, DollarSign, Clock, Eye, Edit, Send, UserPlus, MoreVertical, ShieldCheck, ShieldAlert, Bot, Monitor, BarChart, Globe, Mail, Target, TrendingDown, Share2, Megaphone, MousePointer, Users2, BarChart3, PieChart, LineChart, Phone } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { RiskProfileViewer } from "@/components/risk-profiling/risk-profile-viewer";
import { RiskAssessmentForm } from "@/components/risk-profiling/risk-assessment-form";

// API Status Panel Component
function ApiStatusPanel() {
  const { data: apiStatus, isLoading, error } = useQuery({
    queryKey: ['/api/admin/api-status'],
    refetchInterval: 30000, // Refresh every 30 seconds
  });

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'healthy':
        return 'text-green-600 bg-green-50';
      case 'degraded':
        return 'text-yellow-600 bg-yellow-50';
      case 'unhealthy':
      case 'error':
        return 'text-red-600 bg-red-50';
      default:
        return 'text-gray-600 bg-gray-50';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'healthy':
        return '🟢';
      case 'degraded':
        return '🟡';
      case 'unhealthy':
      case 'error':
        return '🔴';
      default:
        return '⚪';
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (error) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Server className="w-5 h-5" />
            API Status Monitor
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-red-600">
            <AlertTriangle className="w-8 h-8 mx-auto mb-2" />
            Failed to fetch API status
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Overall Health Summary */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Server className="w-5 h-5" />
            System Health Overview
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="text-center">
              <div className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${getStatusColor(apiStatus?.overall?.status || 'unknown')}`}>
                {getStatusIcon(apiStatus?.overall?.status || 'unknown')} {apiStatus?.overall?.status || 'Unknown'}
              </div>
              <p className="text-sm text-muted-foreground mt-1">Overall Status</p>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold">{apiStatus?.overall?.healthScore || 0}%</div>
              <p className="text-sm text-muted-foreground">Health Score</p>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-green-600">{apiStatus?.overall?.healthyEndpoints || 0}</div>
              <p className="text-sm text-muted-foreground">Healthy APIs</p>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold">{apiStatus?.overall?.totalEndpoints || 0}</div>
              <p className="text-sm text-muted-foreground">Total APIs</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* API Endpoints by Category */}
      {apiStatus?.categories && Object.entries(apiStatus.categories).map(([category, endpoints]: [string, any]) => (
        <Card key={category}>
          <CardHeader>
            <CardTitle>{category}</CardTitle>
            <CardDescription>
              {(endpoints as any[]).filter(ep => ep.status === 'healthy').length} of {(endpoints as any[]).length} services operational
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {(endpoints as any[]).map((endpoint: any, index: number) => (
                <div key={index} className="flex items-center justify-between p-3 border rounded-lg">
                  <div className="flex items-center gap-3">
                    <div className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(endpoint.status)}`}>
                      {getStatusIcon(endpoint.status)} {endpoint.status}
                    </div>
                    <div>
                      <div className="font-medium">{endpoint.name}</div>
                      <div className="text-sm text-muted-foreground">{endpoint.message}</div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-medium">{endpoint.responseTime}ms</div>
                    <div className="text-xs text-muted-foreground">
                      {new Date(endpoint.lastChecked).toLocaleTimeString()}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      ))}

      {/* Last Updated */}
      <Card>
        <CardContent className="pt-6">
          <div className="text-center text-sm text-muted-foreground">
            Last updated: {apiStatus?.overall?.lastUpdated ? new Date(apiStatus.overall.lastUpdated).toLocaleString() : 'Never'}
            <br />
            <span className="text-xs">Auto-refreshes every 30 seconds</span>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// AI Analysis Panel Component for Super Admins
function AIAnalysisPanel() {
  const { toast } = useToast();
  const [analysisType, setAnalysisType] = useState('error_analysis');
  const [timeRange, setTimeRange] = useState('24h');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisResult, setAnalysisResult] = useState<any>(null);

  const performAnalysis = async () => {
    setIsAnalyzing(true);
    try {
      const response = await apiRequest('POST', '/api/admin/ai-analysis', {
        analysisType,
        timeRange
      });
      const result = await response.json();
      setAnalysisResult(result);
      toast({
        title: "AI Analysis Complete",
        description: `${analysisType.replace('_', ' ')} analysis completed successfully.`,
      });
    } catch (error) {
      toast({
        title: "Analysis Failed",
        description: "Failed to perform AI analysis. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsAnalyzing(false);
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority?.toLowerCase()) {
      case 'critical': return 'text-red-600 bg-red-50';
      case 'high': return 'text-orange-600 bg-orange-50';
      case 'medium': return 'text-yellow-600 bg-yellow-50';
      case 'low': return 'text-blue-600 bg-blue-50';
      default: return 'text-gray-600 bg-gray-50';
    }
  };

  return (
    <div className="space-y-6">
      {/* AI Analysis Controls */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Brain className="w-5 h-5" />
            Gemini AI System Analysis
          </CardTitle>
          <CardDescription>
            Use AI to analyze system errors, performance, and security for actionable insights
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
            <div>
              <Label>Analysis Type</Label>
              <Select value={analysisType} onValueChange={setAnalysisType}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="error_analysis">Error Analysis</SelectItem>
                  <SelectItem value="performance_analysis">Performance Analysis</SelectItem>
                  <SelectItem value="security_analysis">Security Analysis</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Time Range</Label>
              <Select value={timeRange} onValueChange={setTimeRange}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1h">Last Hour</SelectItem>
                  <SelectItem value="24h">Last 24 Hours</SelectItem>
                  <SelectItem value="7d">Last 7 Days</SelectItem>
                  <SelectItem value="30d">Last 30 Days</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-end">
              <Button 
                onClick={performAnalysis} 
                disabled={isAnalyzing}
                className="w-full"
              >
                {isAnalyzing ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                    Analyzing...
                  </>
                ) : (
                  <>
                    <Zap className="w-4 h-4 mr-2" />
                    Run Analysis
                  </>
                )}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Analysis Results */}
      {analysisResult && (
        <div className="space-y-4">
          {/* Summary Card */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Brain className="w-5 h-5" />
                Analysis Summary
                <div className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${getPriorityColor(analysisResult.analysis?.priority)}`}>
                  {analysisResult.analysis?.priority} Priority
                </div>
              </CardTitle>
              <CardDescription>
                Analysis completed on {new Date(analysisResult.timestamp).toLocaleString()}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div>
                  <h4 className="font-medium mb-2">Executive Summary</h4>
                  <p className="text-muted-foreground">{analysisResult.analysis?.summary}</p>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-4 bg-muted rounded-lg">
                  <div className="text-center">
                    <div className="text-2xl font-bold">{analysisResult.dataPoints?.errorsAnalyzed || 0}</div>
                    <p className="text-sm text-muted-foreground">Errors Analyzed</p>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold">{analysisResult.dataPoints?.apisChecked || 0}</div>
                    <p className="text-sm text-muted-foreground">APIs Checked</p>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold">{analysisResult.dataPoints?.timeframe}</div>
                    <p className="text-sm text-muted-foreground">Time Range</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Recommendations */}
          <Card>
            <CardHeader>
              <CardTitle>AI Recommendations</CardTitle>
              <CardDescription>Actionable insights and suggestions</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {analysisResult.analysis?.recommendations?.map((rec: string, index: number) => (
                  <div key={index} className="flex items-start gap-3 p-3 border rounded-lg">
                    <div className="w-6 h-6 rounded-full bg-blue-100 text-blue-600 text-xs font-bold flex items-center justify-center mt-0.5">
                      {index + 1}
                    </div>
                    <div className="flex-1">
                      <p className="text-sm">{rec}</p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Detailed Analysis */}
          {analysisResult.analysis?.detailedAnalysis && (
            <Card>
              <CardHeader>
                <CardTitle>Detailed Analysis</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {analysisResult.analysis.detailedAnalysis.errorPatterns && (
                    <div>
                      <h4 className="font-medium mb-2">Error Patterns</h4>
                      <div className="flex flex-wrap gap-2">
                        {analysisResult.analysis.detailedAnalysis.errorPatterns.map((pattern: string, index: number) => (
                          <span key={index} className="px-2 py-1 bg-red-50 text-red-700 rounded-md text-xs">
                            {pattern}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                  
                  {analysisResult.analysis.detailedAnalysis.performanceMetrics && (
                    <div>
                      <h4 className="font-medium mb-2">Performance Metrics</h4>
                      <div className="grid grid-cols-2 gap-4 text-sm">
                        <div>
                          <span className="text-muted-foreground">Avg Response Time:</span>
                          <span className="ml-2 font-medium">{analysisResult.analysis.detailedAnalysis.performanceMetrics.avgResponseTime}</span>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Success Rate:</span>
                          <span className="ml-2 font-medium">{analysisResult.analysis.detailedAnalysis.performanceMetrics.successRate}</span>
                        </div>
                      </div>
                    </div>
                  )}
                  
                  {analysisResult.analysis.detailedAnalysis.securityStatus && (
                    <div>
                      <h4 className="font-medium mb-2">Security Status</h4>
                      <div className="p-3 bg-green-50 text-green-800 rounded-lg">
                        <Lock className="w-4 h-4 inline mr-2" />
                        {analysisResult.analysis.detailedAnalysis.securityStatus}
                      </div>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* Warning for Super Admin Only */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center gap-2 text-sm text-amber-600">
            <AlertTriangle className="w-4 h-4" />
            This AI analysis feature is only available to Super Administrators and uses sensitive system data.
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// Replit Agent Panel Component for Post-Deployment Management
function ReplitAgentPanel() {
  const { toast } = useToast();
  const [deploymentStatus, setDeploymentStatus] = useState('checking');
  const [agentMetrics, setAgentMetrics] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedTab, setSelectedTab] = useState('overview');

  // Agent capabilities data based on Replit documentation
  const agentCapabilities = {
    development: [
      'Create full-stack applications from natural language descriptions',
      'Add advanced features and complex API integrations',
      'Design and modify database structures with Drizzle ORM',
      'Streamline environment setup and dependency management',
      'Integrate with external services (OpenAI, Stripe, SendGrid, etc.)',
      'Set up authentication systems (Replit Auth, Firebase Auth)',
      'Configure object storage for file management',
      'Implement real-time features with WebSockets'
    ],
    deployment: [
      'Suggest deployment configurations and optimizations',
      'Create comprehensive project checkpoints for rollback',
      'Monitor deployment health and performance metrics',
      'Track resource utilization (CPU, memory, disk)',
      'View real-time logs and error tracking',
      'Access analytics (page views, user engagement)',
      'Manage environment variables and secrets',
      'Handle TLS certificates and custom domains'
    ],
    integrations: [
      'AI Services: OpenAI, Anthropic, xAI for intelligent features',
      'Payment Processing: Stripe for secure transactions',
      'Communication: Slack, Twilio, SendGrid for notifications',
      'Authentication: Replit Auth, Firebase Auth, custom solutions',
      'Storage: Object Storage, Database with PostgreSQL',
      'Analytics: Google Analytics integration and tracking',
      'External APIs: Google Calendar, Drive, Sheets integration',
      'Social: Twitter, Facebook, LinkedIn API connections'
    ],
    automation: [
      'Automatic checkpoint creation during development',
      'Continuous health monitoring and alerting',
      'Performance optimization suggestions',
      'Security vulnerability scanning',
      'Dependency updates and maintenance',
      'Error pattern analysis and recommendations',
      'Resource scaling based on usage patterns',
      'Backup and disaster recovery automation'
    ]
  };

  // Mock deployment and agent data - in real implementation, this would fetch from Replit APIs
  const mockDeploymentData = {
    status: 'active',
    url: 'https://fintekpro.replit.app',
    uptime: '99.9%',
    lastDeployed: '2024-01-15 14:30:00',
    version: '1.2.3',
    buildTime: '2m 45s',
    analytics: {
      pageViews: 15420,
      uniqueVisitors: 3280,
      avgResponseTime: '145ms',
      errorRate: '0.02%'
    },
    resources: {
      cpuUsage: '12%',
      memoryUsage: '340MB',
      diskUsage: '1.2GB'
    },
    integrations: {
      active: 8,
      configured: ['Database', 'Object Storage', 'Replit Auth', 'OpenAI', 'Stripe', 'Finnhub API', 'Google Analytics', 'SendGrid'],
      health: 'excellent'
    },
    checkpoints: {
      total: 47,
      lastCreated: '2024-01-15 14:25:00',
      automated: 42,
      manual: 5
    }
  };

  const handleAgentAction = async (action: string) => {
    setIsLoading(true);
    try {
      // Simulate agent actions
      await new Promise(resolve => setTimeout(resolve, 2000));
      toast({
        title: `Agent Action: ${action}`,
        description: `Successfully executed ${action.toLowerCase()}`,
      });
    } catch (error) {
      toast({
        title: "Agent Action Failed",
        description: "Failed to execute agent action",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Replit Agent Overview */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bot className="h-6 w-6 text-blue-600" />
            Replit Agent Capabilities Dashboard
          </CardTitle>
          <CardDescription>
            Comprehensive overview of AI-powered development, deployment, and management capabilities
          </CardDescription>
        </CardHeader>
      </Card>

      {/* Deployment Status Overview */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Deployment Status</CardTitle>
            <Globe className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">Active</div>
            <p className="text-xs text-muted-foreground">
              Uptime: {mockDeploymentData.uptime}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Integrations</CardTitle>
            <Zap className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{mockDeploymentData.integrations.active}</div>
            <p className="text-xs text-muted-foreground">
              {mockDeploymentData.integrations.health} health
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Checkpoints</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{mockDeploymentData.checkpoints.total}</div>
            <p className="text-xs text-muted-foreground">
              {mockDeploymentData.checkpoints.automated} automated
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Page Views</CardTitle>
            <BarChart className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{mockDeploymentData.analytics.pageViews.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">
              +12% from last week
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Agent Capabilities Tabs */}
      <Tabs value={selectedTab} onValueChange={setSelectedTab}>
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="development">Development</TabsTrigger>
          <TabsTrigger value="deployment">Deployment</TabsTrigger>
          <TabsTrigger value="integrations">Integrations</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Brain className="h-5 w-5" />
                  AI-Powered Development
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground mb-4">
                  Agent automatically creates full-stack applications from natural language descriptions with advanced features and integrations.
                </p>
                <div className="flex flex-wrap gap-2">
                  <Badge variant="secondary">Full-Stack Creation</Badge>
                  <Badge variant="secondary">API Integrations</Badge>
                  <Badge variant="secondary">Database Design</Badge>
                  <Badge variant="secondary">Authentication</Badge>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Monitor className="h-5 w-5" />
                  Post-Deployment Management
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground mb-4">
                  Comprehensive monitoring, analytics, and management tools for deployed applications with automated optimization.
                </p>
                <div className="flex flex-wrap gap-2">
                  <Badge variant="secondary">Health Monitoring</Badge>
                  <Badge variant="secondary">Performance Analytics</Badge>
                  <Badge variant="secondary">Resource Tracking</Badge>
                  <Badge variant="secondary">Error Analysis</Badge>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="development" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Development Capabilities</CardTitle>
              <CardDescription>
                Comprehensive AI-powered development features for rapid application creation
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-3">
                {agentCapabilities.development.map((capability, index) => (
                  <div key={index} className="flex items-center gap-3 p-3 border rounded-lg">
                    <CheckCircle className="h-5 w-5 text-green-600 flex-shrink-0" />
                    <span className="text-sm">{capability}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="deployment" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Deployment & Management</CardTitle>
              <CardDescription>
                Advanced deployment monitoring and post-deployment management capabilities
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-3">
                {agentCapabilities.deployment.map((capability, index) => (
                  <div key={index} className="flex items-center gap-3 p-3 border rounded-lg">
                    <CheckCircle className="h-5 w-5 text-blue-600 flex-shrink-0" />
                    <span className="text-sm">{capability}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Current Deployment Metrics</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="text-center p-4 border rounded-lg">
                  <div className="text-2xl font-bold text-green-600">{mockDeploymentData.analytics.avgResponseTime}</div>
                  <p className="text-sm text-muted-foreground">Avg Response Time</p>
                </div>
                <div className="text-center p-4 border rounded-lg">
                  <div className="text-2xl font-bold text-blue-600">{mockDeploymentData.resources.cpuUsage}</div>
                  <p className="text-sm text-muted-foreground">CPU Usage</p>
                </div>
                <div className="text-center p-4 border rounded-lg">
                  <div className="text-2xl font-bold text-purple-600">{mockDeploymentData.resources.memoryUsage}</div>
                  <p className="text-sm text-muted-foreground">Memory Usage</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="integrations" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Available Integrations</CardTitle>
              <CardDescription>
                External services and APIs that Agent can automatically integrate
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-3">
                {agentCapabilities.integrations.map((capability, index) => (
                  <div key={index} className="flex items-center gap-3 p-3 border rounded-lg">
                    <CheckCircle className="h-5 w-5 text-purple-600 flex-shrink-0" />
                    <span className="text-sm">{capability}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Currently Active Integrations</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {mockDeploymentData.integrations.configured.map((integration, index) => (
                  <div key={index} className="flex items-center gap-2 p-3 border rounded-lg">
                    <div className="w-2 h-2 rounded-full bg-green-500"></div>
                    <span className="text-sm font-medium">{integration}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Agent Actions */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bot className="h-5 w-5" />
            Agent Actions
          </CardTitle>
          <CardDescription>
            Manage your deployment and monitor website performance through AI-powered agent actions
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <Button
              onClick={() => handleAgentAction('Health Check')}
              disabled={isLoading}
              variant="outline"
              className="h-auto p-4 justify-start"
            >
              <div className="flex flex-col items-start">
                <div className="flex items-center gap-2 mb-1">
                  <Monitor className="h-4 w-4" />
                  <span className="font-medium">Health Check</span>
                </div>
                <span className="text-xs text-muted-foreground">
                  Run system diagnostics
                </span>
              </div>
            </Button>

            <Button
              onClick={() => handleAgentAction('Performance Analysis')}
              disabled={isLoading}
              variant="outline"
              className="h-auto p-4 justify-start"
            >
              <div className="flex flex-col items-start">
                <div className="flex items-center gap-2 mb-1">
                  <BarChart className="h-4 w-4" />
                  <span className="font-medium">Performance Analysis</span>
                </div>
                <span className="text-xs text-muted-foreground">
                  Analyze app performance
                </span>
              </div>
            </Button>

            <Button
              onClick={() => handleAgentAction('Security Scan')}
              disabled={isLoading}
              variant="outline"
              className="h-auto p-4 justify-start"
            >
              <div className="flex flex-col items-start">
                <div className="flex items-center gap-2 mb-1">
                  <Shield className="h-4 w-4" />
                  <span className="font-medium">Security Scan</span>
                </div>
                <span className="text-xs text-muted-foreground">
                  Check for vulnerabilities
                </span>
              </div>
            </Button>

            <Button
              onClick={() => handleAgentAction('Backup Creation')}
              disabled={isLoading}
              variant="outline"
              className="h-auto p-4 justify-start"
            >
              <div className="flex flex-col items-start">
                <div className="flex items-center gap-2 mb-1">
                  <Download className="h-4 w-4" />
                  <span className="font-medium">Create Backup</span>
                </div>
                <span className="text-xs text-muted-foreground">
                  Backup current state
                </span>
              </div>
            </Button>

            <Button
              onClick={() => handleAgentAction('Log Analysis')}
              disabled={isLoading}
              variant="outline"
              className="h-auto p-4 justify-start"
            >
              <div className="flex flex-col items-start">
                <div className="flex items-center gap-2 mb-1">
                  <Eye className="h-4 w-4" />
                  <span className="font-medium">Analyze Logs</span>
                </div>
                <span className="text-xs text-muted-foreground">
                  Review system logs
                </span>
              </div>
            </Button>

            <Button
              onClick={() => handleAgentAction('Resource Optimization')}
              disabled={isLoading}
              variant="outline"
              className="h-auto p-4 justify-start"
            >
              <div className="flex flex-col items-start">
                <div className="flex items-center gap-2 mb-1">
                  <Zap className="h-4 w-4" />
                  <span className="font-medium">Optimize Resources</span>
                </div>
                <span className="text-xs text-muted-foreground">
                  Improve efficiency
                </span>
              </div>
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Deployment Information */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Deployment Info</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex justify-between">
              <span className="text-muted-foreground">URL:</span>
              <a 
                href={mockDeploymentData.url} 
                target="_blank" 
                rel="noopener noreferrer"
                className="text-blue-600 hover:underline"
              >
                {mockDeploymentData.url}
              </a>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Version:</span>
              <Badge variant="secondary">{mockDeploymentData.version}</Badge>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Last Deployed:</span>
              <span>{mockDeploymentData.lastDeployed}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Build Time:</span>
              <span>{mockDeploymentData.buildTime}</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Resource Usage</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex justify-between">
              <span className="text-muted-foreground">CPU Usage:</span>
              <span className="text-green-600">{mockDeploymentData.resources.cpuUsage}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Memory Usage:</span>
              <span className="text-blue-600">{mockDeploymentData.resources.memoryUsage}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Disk Usage:</span>
              <span className="text-orange-600">{mockDeploymentData.resources.diskUsage}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Unique Visitors:</span>
              <span>{mockDeploymentData.analytics.uniqueVisitors.toLocaleString()}</span>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

// Marketing Tools Panel Component for Campaign Management and Analytics
function MarketingToolsPanel() {
  const { toast } = useToast();
  const [activeView, setActiveView] = useState('overview');
  const [isCreatingCampaign, setIsCreatingCampaign] = useState(false);
  const [campaigns, setCampaigns] = useState([
    {
      id: 'campaign-1',
      name: 'Q1 Investment Drive',
      type: 'email',
      status: 'active',
      reach: 15420,
      clicks: 2340,
      conversions: 156,
      budget: 25000,
      spent: 18750,
      startDate: '2024-01-15',
      endDate: '2024-03-31'
    },
    {
      id: 'campaign-2',
      name: 'Mutual Fund Awareness',
      type: 'social',
      status: 'paused',
      reach: 8900,
      clicks: 890,
      conversions: 45,
      budget: 15000,
      spent: 7200,
      startDate: '2024-01-20',
      endDate: '2024-02-20'
    }
  ]);

  const [leads, setLeads] = useState([
    {
      id: 'lead-1',
      name: 'Rajesh Kumar',
      email: 'rajesh@email.com',
      phone: '+91-9876543210',
      source: 'Website Form',
      interest: 'Mutual Funds',
      status: 'hot',
      score: 85,
      createdAt: '2024-01-20'
    },
    {
      id: 'lead-2',
      name: 'Priya Sharma',
      email: 'priya.s@email.com',
      phone: '+91-8765432109',
      source: 'Social Media',
      interest: 'Portfolio Management',
      status: 'warm',
      score: 72,
      createdAt: '2024-01-18'
    }
  ]);

  const marketingMetrics = {
    totalLeads: leads.length,
    hotLeads: leads.filter(l => l.status === 'hot').length,
    conversionRate: 12.8,
    costPerLead: 245,
    totalCampaigns: campaigns.length,
    activeCampaigns: campaigns.filter(c => c.status === 'active').length,
    totalSpend: campaigns.reduce((sum, c) => sum + c.spent, 0),
    totalReach: campaigns.reduce((sum, c) => sum + c.reach, 0)
  };

  const handleCreateCampaign = () => {
    setIsCreatingCampaign(true);
    // Simulate campaign creation
    setTimeout(() => {
      toast({
        title: "Campaign Created",
        description: "Your marketing campaign has been created successfully",
      });
      setIsCreatingCampaign(false);
    }, 2000);
  };

  const handleLeadAction = (leadId: string, action: string) => {
    toast({
      title: `Lead ${action}`,
      description: `Successfully ${action.toLowerCase()} lead`,
    });
  };

  return (
    <div className="space-y-6">
      {/* Marketing Overview */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Leads</CardTitle>
            <Users2 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{marketingMetrics.totalLeads}</div>
            <p className="text-xs text-muted-foreground">
              {marketingMetrics.hotLeads} hot leads
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Campaigns</CardTitle>
            <Target className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{marketingMetrics.activeCampaigns}</div>
            <p className="text-xs text-muted-foreground">
              {marketingMetrics.totalCampaigns} total campaigns
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Conversion Rate</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{marketingMetrics.conversionRate}%</div>
            <p className="text-xs text-muted-foreground">
              ₹{marketingMetrics.costPerLead} cost per lead
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Reach</CardTitle>
            <BarChart3 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{marketingMetrics.totalReach.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">
              ₹{marketingMetrics.totalSpend.toLocaleString()} total spend
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Marketing Tools Navigation */}
      <div className="flex flex-wrap gap-2">
        <Button
          variant={activeView === 'overview' ? 'default' : 'outline'}
          onClick={() => setActiveView('overview')}
          size="sm"
        >
          <BarChart className="w-4 h-4 mr-2" />
          Overview
        </Button>
        <Button
          variant={activeView === 'campaigns' ? 'default' : 'outline'}
          onClick={() => setActiveView('campaigns')}
          size="sm"
        >
          <Target className="w-4 h-4 mr-2" />
          Campaigns
        </Button>
        <Button
          variant={activeView === 'leads' ? 'default' : 'outline'}
          onClick={() => setActiveView('leads')}
          size="sm"
        >
          <Users2 className="w-4 h-4 mr-2" />
          Leads
        </Button>
        <Button
          variant={activeView === 'email' ? 'default' : 'outline'}
          onClick={() => setActiveView('email')}
          size="sm"
        >
          <Mail className="w-4 h-4 mr-2" />
          Email Marketing
        </Button>
        <Button
          variant={activeView === 'social' ? 'default' : 'outline'}
          onClick={() => setActiveView('social')}
          size="sm"
        >
          <Share2 className="w-4 h-4 mr-2" />
          Social Media
        </Button>
        <Button
          variant={activeView === 'whatsapp' ? 'default' : 'outline'}
          onClick={() => setActiveView('whatsapp')}
          size="sm"
        >
          <Phone className="w-4 h-4 mr-2" />
          WhatsApp Marketing
        </Button>
      </div>

      {/* Campaign Management */}
      {activeView === 'campaigns' && (
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <h3 className="text-lg font-semibold">Campaign Management</h3>
            <Button onClick={handleCreateCampaign} disabled={isCreatingCampaign}>
              <Plus className="w-4 h-4 mr-2" />
              {isCreatingCampaign ? 'Creating...' : 'New Campaign'}
            </Button>
          </div>

          <div className="grid gap-4">
            {campaigns.map((campaign) => (
              <Card key={campaign.id}>
                <CardHeader>
                  <div className="flex justify-between items-start">
                    <div>
                      <CardTitle className="text-base">{campaign.name}</CardTitle>
                      <CardDescription>
                        {campaign.type.toUpperCase()} • {campaign.startDate} to {campaign.endDate}
                      </CardDescription>
                    </div>
                    <Badge variant={campaign.status === 'active' ? 'default' : 'secondary'}>
                      {campaign.status}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div>
                      <p className="text-sm text-muted-foreground">Reach</p>
                      <p className="text-lg font-semibold">{campaign.reach.toLocaleString()}</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Clicks</p>
                      <p className="text-lg font-semibold">{campaign.clicks.toLocaleString()}</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Conversions</p>
                      <p className="text-lg font-semibold">{campaign.conversions}</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Budget Usage</p>
                      <p className="text-lg font-semibold">
                        ₹{campaign.spent.toLocaleString()} / ₹{campaign.budget.toLocaleString()}
                      </p>
                    </div>
                  </div>
                  <div className="flex gap-2 mt-4">
                    <Button size="sm" variant="outline">
                      <Edit className="w-4 h-4 mr-2" />
                      Edit
                    </Button>
                    <Button size="sm" variant="outline">
                      <BarChart className="w-4 h-4 mr-2" />
                      Analytics
                    </Button>
                    <Button size="sm" variant="outline">
                      {campaign.status === 'active' ? 'Pause' : 'Resume'}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* Lead Management */}
      {activeView === 'leads' && (
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <h3 className="text-lg font-semibold">Lead Management</h3>
            <Button>
              <UserPlus className="w-4 h-4 mr-2" />
              Import Leads
            </Button>
          </div>

          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Contact</TableHead>
                    <TableHead>Source</TableHead>
                    <TableHead>Interest</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Score</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {leads.map((lead) => (
                    <TableRow key={lead.id}>
                      <TableCell className="font-medium">{lead.name}</TableCell>
                      <TableCell>
                        <div className="text-sm">
                          <div>{lead.email}</div>
                          <div className="text-muted-foreground">{lead.phone}</div>
                        </div>
                      </TableCell>
                      <TableCell>{lead.source}</TableCell>
                      <TableCell>{lead.interest}</TableCell>
                      <TableCell>
                        <Badge variant={
                          lead.status === 'hot' ? 'destructive' : 
                          lead.status === 'warm' ? 'default' : 'secondary'
                        }>
                          {lead.status}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <div className="text-sm font-medium">{lead.score}</div>
                          <div className="w-16 bg-muted rounded-full h-2">
                            <div 
                              className="bg-primary h-2 rounded-full" 
                              style={{ width: `${lead.score}%` }}
                            />
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          <Button size="sm" variant="outline" onClick={() => handleLeadAction(lead.id, 'Contact')}>
                            <Phone className="w-4 h-4" />
                          </Button>
                          <Button size="sm" variant="outline" onClick={() => handleLeadAction(lead.id, 'Email')}>
                            <Mail className="w-4 h-4" />
                          </Button>
                          <Button size="sm" variant="outline" onClick={() => handleLeadAction(lead.id, 'Edit')}>
                            <Edit className="w-4 h-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Email Marketing */}
      {activeView === 'email' && (
        <div className="space-y-4">
          <h3 className="text-lg font-semibold">Email Marketing</h3>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Email Campaign Builder</CardTitle>
                <CardDescription>Create and send targeted email campaigns</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>Campaign Name</Label>
                  <Input placeholder="Enter campaign name" />
                </div>
                <div className="space-y-2">
                  <Label>Target Audience</Label>
                  <Select>
                    <SelectTrigger>
                      <SelectValue placeholder="Select audience" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Clients</SelectItem>
                      <SelectItem value="new">New Clients</SelectItem>
                      <SelectItem value="active">Active Investors</SelectItem>
                      <SelectItem value="inactive">Inactive Clients</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Email Template</Label>
                  <Select>
                    <SelectTrigger>
                      <SelectValue placeholder="Choose template" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="newsletter">Newsletter</SelectItem>
                      <SelectItem value="promotion">Promotion</SelectItem>
                      <SelectItem value="welcome">Welcome Series</SelectItem>
                      <SelectItem value="educational">Educational Content</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <Button className="w-full">
                  <Send className="w-4 h-4 mr-2" />
                  Create Campaign
                </Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Email Analytics</CardTitle>
                <CardDescription>Track email campaign performance</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Open Rate</span>
                    <span className="font-medium">24.5%</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Click Rate</span>
                    <span className="font-medium">8.2%</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Bounce Rate</span>
                    <span className="font-medium">2.1%</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Unsubscribe Rate</span>
                    <span className="font-medium">0.8%</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Total Sent</span>
                    <span className="font-medium">12,450</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      )}

      {/* Social Media Marketing */}
      {activeView === 'social' && (
        <div className="space-y-4">
          <h3 className="text-lg font-semibold">Social Media Marketing</h3>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Share2 className="w-4 h-4" />
                  Facebook
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span className="text-sm">Followers</span>
                    <span className="font-medium">8,420</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm">Engagement</span>
                    <span className="font-medium">6.8%</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm">Reach</span>
                    <span className="font-medium">45,200</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Share2 className="w-4 h-4" />
                  LinkedIn
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span className="text-sm">Connections</span>
                    <span className="font-medium">12,680</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm">Engagement</span>
                    <span className="font-medium">12.4%</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm">Impressions</span>
                    <span className="font-medium">89,300</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Share2 className="w-4 h-4" />
                  Twitter
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span className="text-sm">Followers</span>
                    <span className="font-medium">5,240</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm">Engagement</span>
                    <span className="font-medium">4.2%</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm">Impressions</span>
                    <span className="font-medium">32,100</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Social Media Scheduler</CardTitle>
              <CardDescription>Schedule posts across all platforms</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Textarea placeholder="What's on your mind? Share investment tips, market insights, or educational content..." />
              <div className="flex gap-2">
                <Button size="sm" variant="outline">📷 Add Image</Button>
                <Button size="sm" variant="outline">📊 Add Chart</Button>
                <Button size="sm" variant="outline">🔗 Add Link</Button>
              </div>
              <div className="flex justify-between items-center">
                <div className="flex gap-2">
                  <Badge variant="secondary">Facebook</Badge>
                  <Badge variant="secondary">LinkedIn</Badge>
                  <Badge variant="outline">Twitter</Badge>
                </div>
                <div className="flex gap-2">
                  <Button size="sm" variant="outline">Schedule</Button>
                  <Button size="sm">Post Now</Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* WhatsApp Marketing */}
      {activeView === 'whatsapp' && (
        <div className="space-y-6">
          <div className="flex justify-between items-center">
            <h3 className="text-lg font-semibold">WhatsApp Marketing Center</h3>
            <Button onClick={() => toast({ title: "WhatsApp Connected", description: "Your WhatsApp Business API is active and ready" })}>
              <Phone className="w-4 h-4 mr-2" />
              Connect WhatsApp Business
            </Button>
          </div>

          {/* WhatsApp Overview Stats */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Messages Sent</CardTitle>
                <Phone className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">2,847</div>
                <p className="text-xs text-muted-foreground">+12% from last month</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Read Rate</CardTitle>
                <Eye className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">89.2%</div>
                <p className="text-xs text-muted-foreground">Industry leading</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Response Rate</CardTitle>
                <MessageSquare className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">34.7%</div>
                <p className="text-xs text-muted-foreground">+5.2% increase</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Active Contacts</CardTitle>
                <Users className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">1,234</div>
                <p className="text-xs text-muted-foreground">Opted-in contacts</p>
              </CardContent>
            </Card>
          </div>

          {/* WhatsApp Campaign Tools */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Send className="w-5 h-5" />
                  Broadcast Campaign
                </CardTitle>
                <CardDescription>Send marketing messages to segmented audiences</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>Campaign Type</Label>
                  <Select defaultValue="portfolio-update">
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="portfolio-update">Portfolio Updates</SelectItem>
                      <SelectItem value="market-alerts">Market Alerts</SelectItem>
                      <SelectItem value="educational">Educational Content</SelectItem>
                      <SelectItem value="promotional">Promotional Offers</SelectItem>
                      <SelectItem value="onboarding">New User Onboarding</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Target Audience</Label>
                  <Select defaultValue="active-traders">
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all-users">All Users</SelectItem>
                      <SelectItem value="new-users">New Users (Last 30 days)</SelectItem>
                      <SelectItem value="active-traders">Active Traders</SelectItem>
                      <SelectItem value="long-term-investors">Long-term Investors</SelectItem>
                      <SelectItem value="inactive-users">Inactive Users</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Message Template</Label>
                  <Textarea 
                    placeholder="🏦 *Market Update from FintekPro*

Hi {{name}}, your portfolio has gained {{gain}}% today! 

📊 Top performers:
• {{stock1}}: +{{percent1}}%
• {{stock2}}: +{{percent2}}%

💡 AI Recommendation: {{recommendation}}

Login to view detailed analysis: {{app_link}}"
                    className="min-h-[150px]"
                  />
                </div>

                <div className="flex gap-2">
                  <Button className="flex-1" onClick={() => toast({ title: "Preview Ready", description: "WhatsApp message preview generated" })}>
                    <Eye className="w-4 h-4 mr-2" />
                    Preview
                  </Button>
                  <Button variant="outline" className="flex-1" onClick={() => toast({ title: "Campaign Scheduled", description: "WhatsApp broadcast will be sent to 1,234 contacts" })}>
                    <Send className="w-4 h-4 mr-2" />
                    Send Now
                  </Button>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Bot className="w-5 h-5" />
                  AI-Powered Automation
                </CardTitle>
                <CardDescription>Automated WhatsApp marketing sequences</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-3">
                  <div className="flex items-center justify-between p-3 border rounded-lg">
                    <div>
                      <p className="font-medium">Welcome Sequence</p>
                      <p className="text-sm text-muted-foreground">3-message onboarding flow</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="secondary">Active</Badge>
                      <Button size="sm" variant="outline">Edit</Button>
                    </div>
                  </div>

                  <div className="flex items-center justify-between p-3 border rounded-lg">
                    <div>
                      <p className="font-medium">Market Alert Automation</p>
                      <p className="text-sm text-muted-foreground">Triggered by significant movements</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="secondary">Active</Badge>
                      <Button size="sm" variant="outline">Edit</Button>
                    </div>
                  </div>

                  <div className="flex items-center justify-between p-3 border rounded-lg">
                    <div>
                      <p className="font-medium">Portfolio Performance</p>
                      <p className="text-sm text-muted-foreground">Weekly summary messages</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline">Paused</Badge>
                      <Button size="sm" variant="outline">Edit</Button>
                    </div>
                  </div>

                  <div className="flex items-center justify-between p-3 border rounded-lg">
                    <div>
                      <p className="font-medium">Re-engagement Campaign</p>
                      <p className="text-sm text-muted-foreground">For inactive users (30+ days)</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="secondary">Active</Badge>
                      <Button size="sm" variant="outline">Edit</Button>
                    </div>
                  </div>
                </div>

                <Button className="w-full" onClick={() => toast({ title: "New Automation", description: "Create a new WhatsApp automation sequence" })}>
                  <Plus className="w-4 h-4 mr-2" />
                  Create New Automation
                </Button>
              </CardContent>
            </Card>
          </div>

          {/* WhatsApp Analytics & Templates */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Message Templates</CardTitle>
                <CardDescription>Pre-approved WhatsApp Business templates</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="p-3 border rounded-lg">
                    <div className="flex justify-between items-start mb-2">
                      <p className="font-medium">Portfolio Alert</p>
                      <Badge variant="secondary">Approved</Badge>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      🚨 Your portfolio {{action}} by {{percentage}}% today. Check the details...
                    </p>
                    <div className="flex gap-2 mt-2">
                      <Button size="sm" variant="outline">Edit</Button>
                      <Button size="sm" variant="outline">Use Template</Button>
                    </div>
                  </div>

                  <div className="p-3 border rounded-lg">
                    <div className="flex justify-between items-start mb-2">
                      <p className="font-medium">Market Insight</p>
                      <Badge variant="secondary">Approved</Badge>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      📊 Market Update: {{market_summary}}. AI recommends: {{recommendation}}
                    </p>
                    <div className="flex gap-2 mt-2">
                      <Button size="sm" variant="outline">Edit</Button>
                      <Button size="sm" variant="outline">Use Template</Button>
                    </div>
                  </div>

                  <div className="p-3 border rounded-lg">
                    <div className="flex justify-between items-start mb-2">
                      <p className="font-medium">Educational Tip</p>
                      <Badge variant="secondary">Approved</Badge>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      💡 Investment Tip: {{educational_content}}. Learn more in the app.
                    </p>
                    <div className="flex gap-2 mt-2">
                      <Button size="sm" variant="outline">Edit</Button>
                      <Button size="sm" variant="outline">Use Template</Button>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Recent Campaign Performance</CardTitle>
                <CardDescription>Last 7 days WhatsApp campaign metrics</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex justify-between items-center p-3 border rounded-lg">
                    <div>
                      <p className="font-medium">Market Alert Campaign</p>
                      <p className="text-sm text-muted-foreground">Sent 2 days ago</p>
                    </div>
                    <div className="text-right">
                      <p className="font-medium">89.2% read</p>
                      <p className="text-sm text-muted-foreground">1,234 sent</p>
                    </div>
                  </div>

                  <div className="flex justify-between items-center p-3 border rounded-lg">
                    <div>
                      <p className="font-medium">Portfolio Summary</p>
                      <p className="text-sm text-muted-foreground">Sent 5 days ago</p>
                    </div>
                    <div className="text-right">
                      <p className="font-medium">76.8% read</p>
                      <p className="text-sm text-muted-foreground">987 sent</p>
                    </div>
                  </div>

                  <div className="flex justify-between items-center p-3 border rounded-lg">
                    <div>
                      <p className="font-medium">Educational Content</p>
                      <p className="text-sm text-muted-foreground">Sent 7 days ago</p>
                    </div>
                    <div className="text-right">
                      <p className="font-medium">92.1% read</p>
                      <p className="text-sm text-muted-foreground">1,456 sent</p>
                    </div>
                  </div>
                </div>

                <div className="pt-4 border-t">
                  <div className="grid grid-cols-2 gap-4 text-center">
                    <div>
                      <p className="text-2xl font-bold text-green-600">86.4%</p>
                      <p className="text-sm text-muted-foreground">Avg. Read Rate</p>
                    </div>
                    <div>
                      <p className="text-2xl font-bold text-blue-600">28.7%</p>
                      <p className="text-sm text-muted-foreground">Click-through Rate</p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* WhatsApp Capabilities Summary */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Zap className="w-5 h-5" />
                WhatsApp Marketing Capabilities
              </CardTitle>
              <CardDescription>
                Comprehensive WhatsApp Business API integration for automated marketing
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <h4 className="font-medium flex items-center gap-2">
                    <Send className="w-4 h-4" />
                    Automated Campaigns
                  </h4>
                  <ul className="text-sm text-muted-foreground space-y-1">
                    <li>• AI-powered portfolio updates</li>
                    <li>• Market alert notifications</li>
                    <li>• Educational content delivery</li>
                    <li>• User onboarding sequences</li>
                    <li>• Re-engagement campaigns</li>
                  </ul>
                </div>

                <div className="space-y-2">
                  <h4 className="font-medium flex items-center gap-2">
                    <Target className="w-4 h-4" />
                    Smart Targeting
                  </h4>
                  <ul className="text-sm text-muted-foreground space-y-1">
                    <li>• User segmentation by activity</li>
                    <li>• Investment behavior analysis</li>
                    <li>• Portfolio performance targeting</li>
                    <li>• Risk profile based messaging</li>
                    <li>• Personalized recommendations</li>
                  </ul>
                </div>

                <div className="space-y-2">
                  <h4 className="font-medium flex items-center gap-2">
                    <BarChart className="w-4 h-4" />
                    Analytics & Tracking
                  </h4>
                  <ul className="text-sm text-muted-foreground space-y-1">
                    <li>• Real-time delivery status</li>
                    <li>• Read receipt tracking</li>
                    <li>• Click-through rate analysis</li>
                    <li>• Conversion tracking</li>
                    <li>• ROI measurement</li>
                  </ul>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Overview Dashboard */}
      {activeView === 'overview' && (
        <div className="space-y-4">
          <h3 className="text-lg font-semibold">Marketing Dashboard</h3>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Campaign Performance</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {campaigns.slice(0, 3).map((campaign) => (
                    <div key={campaign.id} className="flex justify-between items-center p-3 border rounded">
                      <div>
                        <p className="font-medium">{campaign.name}</p>
                        <p className="text-sm text-muted-foreground">
                          {campaign.conversions} conversions • {((campaign.clicks / campaign.reach) * 100).toFixed(1)}% CTR
                        </p>
                      </div>
                      <Badge variant={campaign.status === 'active' ? 'default' : 'secondary'}>
                        {campaign.status}
                      </Badge>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Top Lead Sources</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <span>Website Forms</span>
                    <span className="font-medium">45%</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span>Social Media</span>
                    <span className="font-medium">28%</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span>Email Campaigns</span>
                    <span className="font-medium">18%</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span>Referrals</span>
                    <span className="font-medium">9%</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      )}
    </div>
  );
}

interface ClientStats {
  totalClients: number;
  activeClients: number;
  newClientsToday: number;
  totalLogins: number;
  avgSessionTime: number;
}

interface ActivityMetrics {
  pageViews: number;
  apiCalls: number;
  trades: number;
  portfolioViews: number;
  topActions: Array<{ action: string; count: number }>;
}

interface PlatformInsights {
  clientGrowth: Array<{ date: string; count: number }>;
  popularFeatures: Array<{ feature: string; usage: number }>;
  clientEngagement: {
    dailyActiveClients: number;
    weeklyActiveClients: number;
    monthlyActiveClients: number;
  };
  systemHealth: {
    uptime: string;
    errorRate: number;
    responseTime: number;
  };
}

interface Client {
  id: string;
  email: string;
  mobile: string;
  firstName: string;
  lastName: string;
  role: string;
  isActive: boolean;
  loginCount: number;
  lastLoginAt: string | null;
  createdAt: string;
}

interface ClientActivity {
  id: string;
  userId: string;
  action: string;
  resource: string;
  details: any;
  ipAddress: string;
  userAgent: string;
  createdAt: string;
}

export default function AdminPanel() {
  const { toast } = useToast();
  
  // Get current user to check if super admin
  const { data: currentUser } = useQuery({
    queryKey: ['/api/user'],
    retry: false,
  });
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [guidanceDialog, setGuidanceDialog] = useState(false);
  const [guidanceForm, setGuidanceForm] = useState({
    title: "",
    message: "",
    type: "guidance",
    priority: "medium",
    actionUrl: ""
  });
  const [createClientDialog, setCreateClientDialog] = useState(false);
  const [editClientDialog, setEditClientDialog] = useState(false);
  const [deleteClientDialog, setDeleteClientDialog] = useState(false);
  const [clientToDelete, setClientToDelete] = useState<Client | null>(null);
  const [clientForm, setClientForm] = useState({
    firstName: "",
    lastName: "",
    email: "",
    mobile: "",
    role: "user",
    isActive: true
  });

  // Fetch dashboard data
  const { data: dashboardData, isLoading: dashboardLoading } = useQuery({
    queryKey: ["/api/admin/dashboard"],
    refetchInterval: 30000, // Refresh every 30 seconds
  });

  // Fetch clients with filtering
  const { data: clientsData, isLoading: clientsLoading } = useQuery({
    queryKey: ["/api/admin/users", { searchTerm, role: roleFilter, isActive: statusFilter }],
    queryFn: () => {
      const params = new URLSearchParams();
      if (searchTerm) params.append('searchTerm', searchTerm);
      if (roleFilter !== 'all') params.append('role', roleFilter);
      if (statusFilter !== 'all') params.append('isActive', statusFilter);
      
      return fetch(`/api/admin/users?${params}`).then(res => res.json());
    }
  });

  // Fetch platform insights
  const { data: insights } = useQuery({
    queryKey: ["/api/admin/insights"],
    refetchInterval: 60000, // Refresh every minute
  });

  // Fetch recent activities
  const { data: activities } = useQuery({
    queryKey: ["/api/admin/activities"],
    refetchInterval: 10000, // Refresh every 10 seconds
  });

  // Update client role mutation
  const updateRoleMutation = useMutation({
    mutationFn: async ({ clientId, role }: { clientId: string; role: string }) => {
      const response = await apiRequest("PATCH", `/api/admin/users/${clientId}/role`, { role });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
      toast({
        title: "Success",
        description: "Client role updated successfully",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Update client status mutation
  const updateStatusMutation = useMutation({
    mutationFn: async ({ clientId, isActive }: { clientId: string; isActive: boolean }) => {
      const response = await apiRequest("PATCH", `/api/admin/users/${clientId}/status`, { isActive });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
      toast({
        title: "Success",
        description: "Client status updated successfully",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Send guidance mutation
  const sendGuidanceMutation = useMutation({
    mutationFn: async ({ clientId, guidance }: { clientId: string; guidance: any }) => {
      const response = await apiRequest("POST", `/api/admin/users/${clientId}/guidance`, guidance);
      return response.json();
    },
    onSuccess: () => {
      setGuidanceDialog(false);
      setGuidanceForm({
        title: "",
        message: "",
        type: "guidance",
        priority: "medium",
        actionUrl: ""
      });
      toast({
        title: "Success",
        description: "Guidance sent successfully",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Create client mutation
  const createClientMutation = useMutation({
    mutationFn: async (clientData: any) => {
      const response = await apiRequest("POST", "/api/admin/users", clientData);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
      setCreateClientDialog(false);
      setClientForm({
        firstName: "",
        lastName: "",
        email: "",
        mobile: "",
        role: "user",
        isActive: true
      });
      toast({
        title: "Success",
        description: "Client created successfully",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Update client mutation
  const updateClientMutation = useMutation({
    mutationFn: async ({ clientId, clientData }: { clientId: string; clientData: any }) => {
      const response = await apiRequest("PATCH", `/api/admin/users/${clientId}`, clientData);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
      setEditClientDialog(false);
      setSelectedClient(null);
      toast({
        title: "Success",
        description: "Client updated successfully",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Delete client mutation
  const deleteClientMutation = useMutation({
    mutationFn: async (clientId: string) => {
      const response = await apiRequest("DELETE", `/api/admin/users/${clientId}`);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
      setDeleteClientDialog(false);
      setClientToDelete(null);
      toast({
        title: "Success",
        description: "Client deleted successfully",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  if (dashboardLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
      </div>
    );
  }

  const { clientStats, activityMetrics, platformInsights: dashboardInsights } = (dashboardData as any) || {
    clientStats: { totalClients: 0, activeClients: 0, newClientsToday: 0, totalLogins: 0, avgSessionTime: 0 },
    activityMetrics: { pageViews: 0, apiCalls: 0, trades: 0, portfolioViews: 0, topActions: [] },
    platformInsights: { systemHealth: { uptime: "0h 0m", errorRate: 0, responseTime: 0 } }
  };

  return (
    <div className="container mx-auto p-6 space-y-6" data-testid="admin-panel">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold" data-testid="text-admin-title">Admin Panel</h1>
          <p className="text-muted-foreground" data-testid="text-admin-subtitle">
            Monitor and manage platform activity
          </p>
        </div>
        <Badge variant="secondary" data-testid="badge-admin-status">Admin Access</Badge>
      </div>

      <Tabs defaultValue="dashboard" className="space-y-6">
        <TabsList className={`grid w-full ${currentUser?.role === 'super_admin' ? 'grid-cols-12' : 'grid-cols-11'}`}>
          <TabsTrigger value="dashboard" data-testid="tab-dashboard">
            <TrendingUp className="w-4 h-4 mr-2" />
            Dashboard
          </TabsTrigger>
          <TabsTrigger value="clients" data-testid="tab-clients">
            <Users className="w-4 h-4 mr-2" />
            Clients
          </TabsTrigger>
          <TabsTrigger value="activity" data-testid="tab-activity">
            <Activity className="w-4 h-4 mr-2" />
            Activity
          </TabsTrigger>
          <TabsTrigger value="api-status" data-testid="tab-api-status">
            <Server className="w-4 h-4 mr-2" />
            API Status
          </TabsTrigger>
          <TabsTrigger value="insights" data-testid="tab-insights">
            <Settings className="w-4 h-4 mr-2" />
            Insights
          </TabsTrigger>
          <TabsTrigger value="risk-profiling" data-testid="tab-risk-profiling">
            <Shield className="w-4 h-4 mr-2" />
            Risk Profiles
          </TabsTrigger>
          <TabsTrigger value="reports" data-testid="tab-reports">
            <FileText className="w-4 h-4 mr-2" />
            Reports
          </TabsTrigger>
          <TabsTrigger value="guidance" data-testid="tab-guidance">
            <MessageSquare className="w-4 h-4 mr-2" />
            Guidance
          </TabsTrigger>
          <TabsTrigger value="partners" data-testid="tab-partners">
            <Building2 className="w-4 h-4 mr-2" />
            Partners
          </TabsTrigger>
          <TabsTrigger value="agents" data-testid="tab-agents">
            <Users className="w-4 h-4 mr-2" />
            Care Agents
          </TabsTrigger>
          <TabsTrigger value="replit-agent" data-testid="tab-replit-agent">
            <Bot className="w-4 h-4 mr-2" />
            Replit Agent
          </TabsTrigger>
          <TabsTrigger value="marketing" data-testid="tab-marketing">
            <Megaphone className="w-4 h-4 mr-2" />
            Marketing
          </TabsTrigger>
          {currentUser?.role === 'super_admin' && (
            <TabsTrigger value="ai-analysis" data-testid="tab-ai-analysis">
              <Brain className="w-4 h-4 mr-2" />
              AI Analysis
            </TabsTrigger>
          )}
        </TabsList>

        {/* Dashboard Tab */}
        <TabsContent value="dashboard" className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card data-testid="card-total-users">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Clients</CardTitle>
                <Users className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold" data-testid="text-total-clients">
                  {clientStats?.totalClients || 0}
                </div>
                <p className="text-xs text-muted-foreground">
                  +{clientStats?.newClientsToday || 0} new today
                </p>
              </CardContent>
            </Card>

            <Card data-testid="card-active-users">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Active Clients</CardTitle>
                <Activity className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold" data-testid="text-active-clients">
                  {clientStats?.activeClients || 0}
                </div>
                <p className="text-xs text-muted-foreground">
                  Last 7 days
                </p>
              </CardContent>
            </Card>

            <Card data-testid="card-total-logins">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Logins</CardTitle>
                <TrendingUp className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold" data-testid="text-total-logins">
                  {clientStats?.totalLogins || 0}
                </div>
                <p className="text-xs text-muted-foreground">
                  All time
                </p>
              </CardContent>
            </Card>

            <Card data-testid="card-avg-session">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Avg Session</CardTitle>
                <Settings className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold" data-testid="text-avg-session">
                  {clientStats?.avgSessionTime || 0}m
                </div>
                <p className="text-xs text-muted-foreground">
                  Average duration
                </p>
              </CardContent>
            </Card>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card data-testid="card-activity-metrics">
              <CardHeader>
                <CardTitle>Activity Metrics</CardTitle>
                <CardDescription>Last 24 hours</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex justify-between">
                  <span>Page Views</span>
                  <span className="font-bold" data-testid="text-page-views">
                    {activityMetrics?.pageViews || 0}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>API Calls</span>
                  <span className="font-bold" data-testid="text-api-calls">
                    {activityMetrics?.apiCalls || 0}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>Portfolio Views</span>
                  <span className="font-bold" data-testid="text-portfolio-views">
                    {activityMetrics?.portfolioViews || 0}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>Trades</span>
                  <span className="font-bold" data-testid="text-trades">
                    {activityMetrics?.trades || 0}
                  </span>
                </div>
              </CardContent>
            </Card>

            <Card data-testid="card-system-health">
              <CardHeader>
                <CardTitle>System Health</CardTitle>
                <CardDescription>Current status</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex justify-between">
                  <span>Uptime</span>
                  <span className="font-bold" data-testid="text-uptime">
                    {dashboardInsights?.systemHealth?.uptime || "0h 0m"}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>Error Rate</span>
                  <span className="font-bold" data-testid="text-error-rate">
                    {dashboardInsights?.systemHealth?.errorRate || 0}%
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>Response Time</span>
                  <span className="font-bold" data-testid="text-response-time">
                    {dashboardInsights?.systemHealth?.responseTime || 0}ms
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>Status</span>
                  <Badge variant="secondary" className="bg-green-100 text-green-800" data-testid="badge-system-status">
                    Healthy
                  </Badge>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Users Tab */}
        <TabsContent value="clients" className="space-y-6">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-4">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search clients..."
                className="pl-10"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                data-testid="input-search-clients"
              />
            </div>
            <Select value={roleFilter} onValueChange={setRoleFilter}>
              <SelectTrigger className="w-40" data-testid="select-role-filter">
                <SelectValue placeholder="Filter by role" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Roles</SelectItem>
                <SelectItem value="user">Client</SelectItem>
                <SelectItem value="admin">Admin</SelectItem>
                <SelectItem value="super_admin">Super Admin</SelectItem>
              </SelectContent>
            </Select>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-40" data-testid="select-status-filter">
                <SelectValue placeholder="Filter by status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="true">Active</SelectItem>
                <SelectItem value="false">Inactive</SelectItem>
              </SelectContent>
            </Select>
            </div>
            
            {/* Add Client Button */}
            <Dialog open={createClientDialog} onOpenChange={setCreateClientDialog}>
              <DialogTrigger asChild>
                <Button className="bg-blue-600 hover:bg-blue-700" data-testid="button-add-client">
                  <Plus className="w-4 h-4 mr-2" />
                  Add Client
                </Button>
              </DialogTrigger>
            </Dialog>
          </div>

          <Card data-testid="card-users-table">
            <CardHeader>
              <CardTitle>Clients Management</CardTitle>
              <CardDescription>
                Manage client roles and status
              </CardDescription>
            </CardHeader>
            <CardContent>
              {clientsLoading ? (
                <div className="flex justify-center p-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Client</TableHead>
                      <TableHead>Role</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Last Login</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {clientsData?.users?.map((client: Client) => (
                      <TableRow key={client.id} data-testid={`row-client-${client.id}`}>
                        <TableCell>
                          <div>
                            <div className="font-medium" data-testid={`text-clientname-${client.id}`}>
                              {client.firstName} {client.lastName}
                            </div>
                            <div className="text-sm text-muted-foreground" data-testid={`text-email-${client.id}`}>
                              {client.email}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Select
                            value={client.role}
                            onValueChange={(role) => updateRoleMutation.mutate({ clientId: client.id, role })}
                            data-testid={`select-role-${client.id}`}
                          >
                            <SelectTrigger className="w-32">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="user">Client</SelectItem>
                              <SelectItem value="admin">Admin</SelectItem>
                              <SelectItem value="super_admin">Super Admin</SelectItem>
                            </SelectContent>
                          </Select>
                        </TableCell>
                        <TableCell>
                          <Badge variant={client.isActive ? "secondary" : "destructive"} data-testid={`badge-status-${client.id}`}>
                            {client.isActive ? "Active" : "Inactive"}
                          </Badge>
                        </TableCell>
                        <TableCell data-testid={`text-last-login-${client.id}`}>
                          {client.lastLoginAt 
                            ? format(new Date(client.lastLoginAt), "MMM d, yyyy")
                            : "Never"
                          }
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-2">
                            <Button
                              size="sm"
                              variant={client.isActive ? "destructive" : "secondary"}
                              onClick={() => updateStatusMutation.mutate({ 
                                clientId: client.id, 
                                isActive: !client.isActive 
                              })}
                              data-testid={`button-toggle-status-${client.id}`}
                            >
                              {client.isActive ? "Deactivate" : "Activate"}
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => {
                                setSelectedClient(client);
                                setClientForm({
                                  firstName: client.firstName,
                                  lastName: client.lastName,
                                  email: client.email,
                                  mobile: client.mobile,
                                  role: client.role,
                                  isActive: client.isActive
                                });
                                setEditClientDialog(true);
                              }}
                              data-testid={`button-edit-client-${client.id}`}
                            >
                              <Edit3 className="w-4 h-4" />
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => {
                                setSelectedClient(client);
                                setGuidanceDialog(true);
                              }}
                              data-testid={`button-send-guidance-${client.id}`}
                            >
                              <MessageSquare className="w-4 h-4" />
                            </Button>
                            <Button
                              size="sm"
                              variant="destructive"
                              onClick={() => {
                                setClientToDelete(client);
                                setDeleteClientDialog(true);
                              }}
                              data-testid={`button-delete-client-${client.id}`}
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Activity Tab */}
        <TabsContent value="activity" className="space-y-6">
          <Card data-testid="card-recent-activities">
            <CardHeader>
              <CardTitle>Recent Activities</CardTitle>
              <CardDescription>Live activity feed from all users</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {((activities as any) || []).slice(0, 20).map((activity: ClientActivity, index: number) => (
                  <div key={activity.id || index} className="flex items-start gap-3 p-3 border rounded-lg" data-testid={`activity-${index}`}>
                    <Activity className="w-4 h-4 mt-1 text-muted-foreground" />
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-medium" data-testid={`text-activity-action-${index}`}>
                          {activity.action?.replace(/_/g, ' ').toUpperCase()}
                        </span>
                        {activity.resource && (
                          <Badge variant="outline" data-testid={`badge-activity-resource-${index}`}>
                            {activity.resource}
                          </Badge>
                        )}
                      </div>
                      <div className="text-sm text-muted-foreground" data-testid={`text-activity-details-${index}`}>
                        User: {activity.userId} • {format(new Date(activity.createdAt), "MMM d, HH:mm")}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* API Status Tab */}
        <TabsContent value="api-status" className="space-y-6">
          <ApiStatusPanel />
        </TabsContent>

        {/* Insights Tab */}
        <TabsContent value="insights" className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <Card data-testid="card-user-engagement">
              <CardHeader>
                <CardTitle>User Engagement</CardTitle>
                <CardDescription>Active users breakdown</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex justify-between">
                  <span>Daily Active</span>
                  <span className="font-bold" data-testid="text-daily-active">
                    {(insights as any)?.userEngagement?.dailyActiveUsers || 0}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>Weekly Active</span>
                  <span className="font-bold" data-testid="text-weekly-active">
                    {(insights as any)?.userEngagement?.weeklyActiveUsers || 0}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>Monthly Active</span>
                  <span className="font-bold" data-testid="text-monthly-active">
                    {(insights as any)?.userEngagement?.monthlyActiveUsers || 0}
                  </span>
                </div>
              </CardContent>
            </Card>

            <Card data-testid="card-popular-features">
              <CardHeader>
                <CardTitle>Popular Features</CardTitle>
                <CardDescription>Most used features</CardDescription>
              </CardHeader>
              <CardContent className="space-y-2">
                {((insights as any)?.popularFeatures || []).slice(0, 5).map((feature: any, index: number) => (
                  <div key={index} className="flex justify-between" data-testid={`popular-feature-${index}`}>
                    <span className="text-sm">{feature.feature}</span>
                    <span className="font-bold">{feature.usage}</span>
                  </div>
                ))}
              </CardContent>
            </Card>

            <Card data-testid="card-user-growth">
              <CardHeader>
                <CardTitle>User Growth</CardTitle>
                <CardDescription>Last 7 days</CardDescription>
              </CardHeader>
              <CardContent className="space-y-2">
                {((insights as any)?.userGrowth || []).slice(-7).map((growth: any, index: number) => (
                  <div key={index} className="flex justify-between" data-testid={`user-growth-${index}`}>
                    <span className="text-sm">{format(new Date(growth.date), "MMM d")}</span>
                    <span className="font-bold">+{growth.count}</span>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Guidance Tab */}
        <TabsContent value="guidance" className="space-y-6">
          <Card data-testid="card-guidance-tools">
            <CardHeader>
              <CardTitle>User Guidance Tools</CardTitle>
              <CardDescription>
                Send personalized guidance and notifications to users
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground">
                Select a user from the Users tab to send personalized guidance messages.
                Messages can include tips, alerts, or actionable recommendations.
              </p>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Risk Profiling Tab */}
        <TabsContent value="risk-profiling" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Risk Profile Viewer */}
            <div className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Shield className="h-5 w-5" />
                    Customer Risk Profiles
                  </CardTitle>
                  <CardDescription>
                    View and manage customer investment risk assessments
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <RiskProfileViewer />
                </CardContent>
              </Card>
            </div>

            {/* Risk Assessment Form */}
            <div className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Activity className="h-5 w-5" />
                    New Risk Assessment
                  </CardTitle>
                  <CardDescription>
                    Conduct risk assessment for new or existing customers
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <RiskAssessmentForm />
                </CardContent>
              </Card>
            </div>
          </div>
        </TabsContent>

        {/* Reports Tab */}
        <TabsContent value="reports" className="space-y-6">
          <Tabs defaultValue="capital-gains" className="w-full">
            <TabsList>
              <TabsTrigger value="capital-gains">Capital Gains Reports</TabsTrigger>
              <TabsTrigger value="transaction-reports">Transaction Reports</TabsTrigger>
            </TabsList>
            
            <TabsContent value="capital-gains">
              <CapitalGainsReportViewer />
            </TabsContent>
            
            <TabsContent value="transaction-reports">
              <TransactionReportViewer />
            </TabsContent>
          </Tabs>
        </TabsContent>

        {/* Partners Tab */}
        <TabsContent value="partners" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Partner Statistics */}
            <Card data-testid="card-partner-stats">
              <CardHeader>
                <CardTitle>Partner Overview</CardTitle>
                <CardDescription>Vendor partner statistics</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex justify-between">
                  <span>Total Partners</span>
                  <Badge className="bg-blue-100 text-blue-800" data-testid="badge-total-partners">125</Badge>
                </div>
                <div className="flex justify-between">
                  <span>Active Partners</span>
                  <Badge className="bg-green-100 text-green-800" data-testid="badge-active-partners">98</Badge>
                </div>
                <div className="flex justify-between">
                  <span>Pending Approval</span>
                  <Badge className="bg-yellow-100 text-yellow-800" data-testid="badge-pending-partners">12</Badge>
                </div>
                <div className="flex justify-between">
                  <span>Suspended</span>
                  <Badge className="bg-red-100 text-red-800" data-testid="badge-suspended-partners">15</Badge>
                </div>
              </CardContent>
            </Card>

            {/* Partner Actions */}
            <Card data-testid="card-partner-actions">
              <CardHeader>
                <CardTitle>Quick Actions</CardTitle>
                <CardDescription>Manage partner operations</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <Button className="w-full" data-testid="button-invite-partner">
                  <Building2 className="w-4 h-4 mr-2" />
                  Invite New Partner
                </Button>
                <Button variant="outline" className="w-full" data-testid="button-bulk-approve">
                  <Shield className="w-4 h-4 mr-2" />
                  Bulk Approve
                </Button>
                <Button variant="outline" className="w-full" data-testid="button-export-partners">
                  <FileText className="w-4 h-4 mr-2" />
                  Export Partner List
                </Button>
              </CardContent>
            </Card>

            {/* Recent Partner Activity */}
            <Card data-testid="card-partner-activity">
              <CardHeader>
                <CardTitle>Recent Activity</CardTitle>
                <CardDescription>Latest partner actions</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="flex items-center gap-3 p-2 border rounded" data-testid="partner-activity-0">
                    <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                    <div className="flex-1">
                      <div className="text-sm font-medium">TechCorp Solutions</div>
                      <div className="text-xs text-muted-foreground">Status changed to Active</div>
                    </div>
                    <div className="text-xs text-muted-foreground">2 hours ago</div>
                  </div>
                  <div className="flex items-center gap-3 p-2 border rounded" data-testid="partner-activity-1">
                    <div className="w-2 h-2 bg-yellow-500 rounded-full"></div>
                    <div className="flex-1">
                      <div className="text-sm font-medium">FinServe Partners</div>
                      <div className="text-xs text-muted-foreground">Submitted application</div>
                    </div>
                    <div className="text-xs text-muted-foreground">1 day ago</div>
                  </div>
                  <div className="flex items-center gap-3 p-2 border rounded" data-testid="partner-activity-2">
                    <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                    <div className="flex-1">
                      <div className="text-sm font-medium">Global Investments</div>
                      <div className="text-xs text-muted-foreground">Updated profile</div>
                    </div>
                    <div className="text-xs text-muted-foreground">3 days ago</div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Partner Management Table */}
          <Card data-testid="card-partner-management">
            <CardHeader>
              <CardTitle>Partner Management</CardTitle>
              <CardDescription>Manage all vendor partners</CardDescription>
            </CardHeader>
            <CardContent>
              {/* Search and Filters */}
              <div className="flex gap-4 mb-6">
                <div className="flex-1">
                  <Input
                    placeholder="Search partners..."
                    className="w-full"
                    data-testid="input-search-partners"
                  />
                </div>
                <Select defaultValue="all">
                  <SelectTrigger className="w-48" data-testid="select-partner-status">
                    <SelectValue placeholder="Filter by status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Partners</SelectItem>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="pending">Pending Approval</SelectItem>
                    <SelectItem value="suspended">Suspended</SelectItem>
                    <SelectItem value="inactive">Inactive</SelectItem>
                  </SelectContent>
                </Select>
                <Select defaultValue="all">
                  <SelectTrigger className="w-48" data-testid="select-partner-type">
                    <SelectValue placeholder="Filter by type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Types</SelectItem>
                    <SelectItem value="broker">Broker</SelectItem>
                    <SelectItem value="advisor">Financial Advisor</SelectItem>
                    <SelectItem value="fintech">FinTech</SelectItem>
                    <SelectItem value="bank">Bank</SelectItem>
                    <SelectItem value="other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Partners Table */}
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Partner Name</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Joined Date</TableHead>
                    <TableHead>Revenue Share</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  <TableRow data-testid="partner-row-1">
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center text-white text-sm font-bold">
                          TC
                        </div>
                        <div>
                          <div className="font-medium" data-testid="text-partner-name-1">TechCorp Solutions</div>
                          <div className="text-sm text-muted-foreground">contact@techcorp.com</div>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" data-testid="badge-partner-type-1">FinTech</Badge>
                    </TableCell>
                    <TableCell>
                      <Badge className="bg-green-100 text-green-800" data-testid="badge-partner-status-1">Active</Badge>
                    </TableCell>
                    <TableCell data-testid="text-partner-joined-1">Dec 15, 2024</TableCell>
                    <TableCell data-testid="text-partner-revenue-1">15%</TableCell>
                    <TableCell>
                      <div className="flex gap-2">
                        <Button variant="outline" size="sm" data-testid="button-view-partner-1">
                          View
                        </Button>
                        <Button variant="outline" size="sm" data-testid="button-edit-partner-1">
                          Edit
                        </Button>
                        <Button variant="destructive" size="sm" data-testid="button-suspend-partner-1">
                          Suspend
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                  <TableRow data-testid="partner-row-2">
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 bg-purple-500 rounded-full flex items-center justify-center text-white text-sm font-bold">
                          FS
                        </div>
                        <div>
                          <div className="font-medium" data-testid="text-partner-name-2">FinServe Partners</div>
                          <div className="text-sm text-muted-foreground">admin@finserve.com</div>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" data-testid="badge-partner-type-2">Advisor</Badge>
                    </TableCell>
                    <TableCell>
                      <Badge className="bg-yellow-100 text-yellow-800" data-testid="badge-partner-status-2">Pending</Badge>
                    </TableCell>
                    <TableCell data-testid="text-partner-joined-2">Jan 8, 2025</TableCell>
                    <TableCell data-testid="text-partner-revenue-2">12%</TableCell>
                    <TableCell>
                      <div className="flex gap-2">
                        <Button variant="outline" size="sm" data-testid="button-view-partner-2">
                          View
                        </Button>
                        <Button size="sm" data-testid="button-approve-partner-2">
                          Approve
                        </Button>
                        <Button variant="destructive" size="sm" data-testid="button-reject-partner-2">
                          Reject
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                  <TableRow data-testid="partner-row-3">
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 bg-green-500 rounded-full flex items-center justify-center text-white text-sm font-bold">
                          GI
                        </div>
                        <div>
                          <div className="font-medium" data-testid="text-partner-name-3">Global Investments</div>
                          <div className="text-sm text-muted-foreground">info@globalinvest.com</div>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" data-testid="badge-partner-type-3">Broker</Badge>
                    </TableCell>
                    <TableCell>
                      <Badge className="bg-green-100 text-green-800" data-testid="badge-partner-status-3">Active</Badge>
                    </TableCell>
                    <TableCell data-testid="text-partner-joined-3">Nov 22, 2024</TableCell>
                    <TableCell data-testid="text-partner-revenue-3">18%</TableCell>
                    <TableCell>
                      <div className="flex gap-2">
                        <Button variant="outline" size="sm" data-testid="button-view-partner-3">
                          View
                        </Button>
                        <Button variant="outline" size="sm" data-testid="button-edit-partner-3">
                          Edit
                        </Button>
                        <Button variant="destructive" size="sm" data-testid="button-suspend-partner-3">
                          Suspend
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                  <TableRow data-testid="partner-row-4">
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 bg-red-500 rounded-full flex items-center justify-center text-white text-sm font-bold">
                          WM
                        </div>
                        <div>
                          <div className="font-medium" data-testid="text-partner-name-4">Wealth Management Co</div>
                          <div className="text-sm text-muted-foreground">contact@wealthmgmt.com</div>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" data-testid="badge-partner-type-4">Bank</Badge>
                    </TableCell>
                    <TableCell>
                      <Badge className="bg-red-100 text-red-800" data-testid="badge-partner-status-4">Suspended</Badge>
                    </TableCell>
                    <TableCell data-testid="text-partner-joined-4">Oct 5, 2024</TableCell>
                    <TableCell data-testid="text-partner-revenue-4">20%</TableCell>
                    <TableCell>
                      <div className="flex gap-2">
                        <Button variant="outline" size="sm" data-testid="button-view-partner-4">
                          View
                        </Button>
                        <Button size="sm" data-testid="button-reactivate-partner-4">
                          Reactivate
                        </Button>
                        <Button variant="destructive" size="sm" data-testid="button-terminate-partner-4">
                          Terminate
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Customer Care Agents Tab */}
        <TabsContent value="agents" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Agent Statistics */}
            <Card data-testid="card-agent-stats">
              <CardHeader>
                <CardTitle>Agent Overview</CardTitle>
                <CardDescription>Customer care agent statistics</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex justify-between">
                  <span>Total Agents</span>
                  <Badge className="bg-blue-100 text-blue-800" data-testid="badge-total-agents">15</Badge>
                </div>
                <div className="flex justify-between">
                  <span>Active Agents</span>
                  <Badge className="bg-green-100 text-green-800" data-testid="badge-active-agents">12</Badge>
                </div>
                <div className="flex justify-between">
                  <span>On Leave</span>
                  <Badge className="bg-yellow-100 text-yellow-800" data-testid="badge-leave-agents">3</Badge>
                </div>
                <div className="flex justify-between">
                  <span>Avg Resolution Time</span>
                  <Badge className="bg-purple-100 text-purple-800" data-testid="badge-avg-resolution">2.5h</Badge>
                </div>
              </CardContent>
            </Card>

            {/* Quick Actions */}
            <Card data-testid="card-agent-actions">
              <CardHeader>
                <CardTitle>Quick Actions</CardTitle>
                <CardDescription>Manage agents efficiently</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <Button className="w-full" data-testid="button-add-agent">
                  <Users className="w-4 h-4 mr-2" />
                  Add New Agent
                </Button>
                <Button variant="outline" className="w-full" data-testid="button-bulk-assign">
                  <Building2 className="w-4 h-4 mr-2" />
                  Bulk Partner Assignment
                </Button>
                <Button variant="outline" className="w-full" data-testid="button-performance-report">
                  <FileText className="w-4 h-4 mr-2" />
                  Performance Report
                </Button>
              </CardContent>
            </Card>

            {/* Recent Performance */}
            <Card data-testid="card-agent-performance">
              <CardHeader>
                <CardTitle>Top Performers</CardTitle>
                <CardDescription>This month's best agents</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex justify-between items-center">
                  <div>
                    <div className="font-medium">Sarah Johnson</div>
                    <div className="text-sm text-muted-foreground">125 tickets resolved</div>
                  </div>
                  <Badge className="bg-green-100 text-green-800">4.8★</Badge>
                </div>
                <div className="flex justify-between items-center">
                  <div>
                    <div className="font-medium">Mike Chen</div>
                    <div className="text-sm text-muted-foreground">98 tickets resolved</div>
                  </div>
                  <Badge className="bg-green-100 text-green-800">4.7★</Badge>
                </div>
                <div className="flex justify-between items-center">
                  <div>
                    <div className="font-medium">Lisa Rodriguez</div>
                    <div className="text-sm text-muted-foreground">87 tickets resolved</div>
                  </div>
                  <Badge className="bg-green-100 text-green-800">4.6★</Badge>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Agents Management Table */}
          <Card data-testid="card-agents-table">
            <CardHeader>
              <CardTitle>Customer Care Agents</CardTitle>
              <CardDescription>Manage support agents and their partner assignments</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Agent</TableHead>
                    <TableHead>Employee ID</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Partners Assigned</TableHead>
                    <TableHead>Current Tickets</TableHead>
                    <TableHead>Specializations</TableHead>
                    <TableHead>Performance</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  <TableRow data-testid="agent-row-1">
                    <TableCell>
                      <div>
                        <div className="font-medium">Sarah Johnson</div>
                        <div className="text-sm text-muted-foreground">sarah.johnson@fintekpro.com</div>
                        <div className="text-xs text-muted-foreground">+1 (555) 0123</div>
                      </div>
                    </TableCell>
                    <TableCell data-testid="text-employee-id-1">EMP001</TableCell>
                    <TableCell>
                      <Badge className="bg-green-100 text-green-800" data-testid="badge-status-1">Active</Badge>
                    </TableCell>
                    <TableCell>
                      <div className="space-y-1">
                        <Badge variant="outline">TechCorp Solutions</Badge>
                        <Badge variant="outline">InvestPro Partners</Badge>
                        <Badge variant="outline">WealthMax Inc</Badge>
                      </div>
                    </TableCell>
                    <TableCell data-testid="text-tickets-1">8/50</TableCell>
                    <TableCell>
                      <div className="space-y-1">
                        <Badge className="bg-blue-100 text-blue-800">Technical</Badge>
                        <Badge className="bg-purple-100 text-purple-800">Billing</Badge>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="text-sm">
                        <div>Rating: <span className="font-medium">4.8★</span></div>
                        <div>Avg. Resolution: <span className="font-medium">2.1h</span></div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex space-x-2">
                        <Button variant="outline" size="sm" data-testid="button-manage-partners-1">
                          Manage Partners
                        </Button>
                        <Button variant="outline" size="sm" data-testid="button-view-performance-1">
                          Performance
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                  <TableRow data-testid="agent-row-2">
                    <TableCell>
                      <div>
                        <div className="font-medium">Mike Chen</div>
                        <div className="text-sm text-muted-foreground">mike.chen@fintekpro.com</div>
                        <div className="text-xs text-muted-foreground">+1 (555) 0124</div>
                      </div>
                    </TableCell>
                    <TableCell data-testid="text-employee-id-2">EMP002</TableCell>
                    <TableCell>
                      <Badge className="bg-green-100 text-green-800" data-testid="badge-status-2">Active</Badge>
                    </TableCell>
                    <TableCell>
                      <div className="space-y-1">
                        <Badge variant="outline">FinanceFirst LLC</Badge>
                        <Badge variant="outline">Capital Advisors</Badge>
                      </div>
                    </TableCell>
                    <TableCell data-testid="text-tickets-2">12/50</TableCell>
                    <TableCell>
                      <div className="space-y-1">
                        <Badge className="bg-green-100 text-green-800">Product Inquiry</Badge>
                        <Badge className="bg-orange-100 text-orange-800">Complaints</Badge>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="text-sm">
                        <div>Rating: <span className="font-medium">4.7★</span></div>
                        <div>Avg. Resolution: <span className="font-medium">2.8h</span></div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex space-x-2">
                        <Button variant="outline" size="sm" data-testid="button-manage-partners-2">
                          Manage Partners
                        </Button>
                        <Button variant="outline" size="sm" data-testid="button-view-performance-2">
                          Performance
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                  <TableRow data-testid="agent-row-3">
                    <TableCell>
                      <div>
                        <div className="font-medium">Lisa Rodriguez</div>
                        <div className="text-sm text-muted-foreground">lisa.rodriguez@fintekpro.com</div>
                        <div className="text-xs text-muted-foreground">+1 (555) 0125</div>
                      </div>
                    </TableCell>
                    <TableCell data-testid="text-employee-id-3">EMP003</TableCell>
                    <TableCell>
                      <Badge className="bg-yellow-100 text-yellow-800" data-testid="badge-status-3">On Leave</Badge>
                    </TableCell>
                    <TableCell>
                      <div className="space-y-1">
                        <Badge variant="outline">SmartInvest Group</Badge>
                        <Badge variant="outline">GlobalFunds Co</Badge>
                        <Badge variant="outline">RetireEasy Partners</Badge>
                      </div>
                    </TableCell>
                    <TableCell data-testid="text-tickets-3">0/50</TableCell>
                    <TableCell>
                      <div className="space-y-1">
                        <Badge className="bg-red-100 text-red-800">Technical</Badge>
                        <Badge className="bg-blue-100 text-blue-800">Product Inquiry</Badge>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="text-sm">
                        <div>Rating: <span className="font-medium">4.6★</span></div>
                        <div>Avg. Resolution: <span className="font-medium">3.2h</span></div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex space-x-2">
                        <Button variant="outline" size="sm" disabled data-testid="button-manage-partners-3">
                          Manage Partners
                        </Button>
                        <Button variant="outline" size="sm" data-testid="button-view-performance-3">
                          Performance
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Marketing Tools Tab */}
        <TabsContent value="marketing" className="space-y-6">
          <MarketingToolsPanel />
        </TabsContent>

        {/* Replit Agent Tab */}
        <TabsContent value="replit-agent" className="space-y-6">
          <ReplitAgentPanel />
        </TabsContent>

        {/* AI Analysis Tab - Super Admin Only */}
        {currentUser?.role === 'super_admin' && (
          <TabsContent value="ai-analysis" className="space-y-6">
            <AIAnalysisPanel />
          </TabsContent>
        )}
      </Tabs>

      {/* Guidance Dialog */}
      <Dialog open={guidanceDialog} onOpenChange={setGuidanceDialog}>
        <DialogContent data-testid="dialog-send-guidance">
          <DialogHeader>
            <DialogTitle>Send Guidance</DialogTitle>
            <DialogDescription>
              Send personalized guidance to {selectedClient?.firstName} {selectedClient?.lastName}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="title">Title</Label>
              <Input
                id="title"
                value={guidanceForm.title}
                onChange={(e) => setGuidanceForm({ ...guidanceForm, title: e.target.value })}
                placeholder="Enter guidance title"
                data-testid="input-guidance-title"
              />
            </div>
            <div>
              <Label htmlFor="message">Message</Label>
              <Textarea
                id="message"
                value={guidanceForm.message}
                onChange={(e) => setGuidanceForm({ ...guidanceForm, message: e.target.value })}
                placeholder="Enter your guidance message"
                rows={4}
                data-testid="textarea-guidance-message"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="type">Type</Label>
                <Select
                  value={guidanceForm.type}
                  onValueChange={(value) => setGuidanceForm({ ...guidanceForm, type: value })}
                >
                  <SelectTrigger data-testid="select-guidance-type">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="info">Info</SelectItem>
                    <SelectItem value="guidance">Guidance</SelectItem>
                    <SelectItem value="warning">Warning</SelectItem>
                    <SelectItem value="alert">Alert</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="priority">Priority</Label>
                <Select
                  value={guidanceForm.priority}
                  onValueChange={(value) => setGuidanceForm({ ...guidanceForm, priority: value })}
                >
                  <SelectTrigger data-testid="select-guidance-priority">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low">Low</SelectItem>
                    <SelectItem value="medium">Medium</SelectItem>
                    <SelectItem value="high">High</SelectItem>
                    <SelectItem value="critical">Critical</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label htmlFor="actionUrl">Action URL (Optional)</Label>
              <Input
                id="actionUrl"
                value={guidanceForm.actionUrl}
                onChange={(e) => setGuidanceForm({ ...guidanceForm, actionUrl: e.target.value })}
                placeholder="https://example.com/action"
                data-testid="input-guidance-url"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setGuidanceDialog(false)} data-testid="button-cancel-guidance">
              Cancel
            </Button>
            <Button
              onClick={() => {
                if (selectedClient && guidanceForm.title && guidanceForm.message) {
                  sendGuidanceMutation.mutate({
                    clientId: selectedClient.id,
                    guidance: guidanceForm
                  });
                }
              }}
              disabled={!guidanceForm.title || !guidanceForm.message || sendGuidanceMutation.isPending}
              data-testid="button-send-guidance"
            >
              {sendGuidanceMutation.isPending ? "Sending..." : "Send Guidance"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Create Client Dialog */}
      <Dialog open={createClientDialog} onOpenChange={setCreateClientDialog}>
        <DialogContent data-testid="dialog-create-client">
        <DialogHeader>
          <DialogTitle>Add New Client</DialogTitle>
          <DialogDescription>
            Create a new client account with basic information
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="firstName">First Name</Label>
              <Input
                id="firstName"
                value={clientForm.firstName}
                onChange={(e) => setClientForm({ ...clientForm, firstName: e.target.value })}
                placeholder="John"
                data-testid="input-first-name"
              />
            </div>
            <div>
              <Label htmlFor="lastName">Last Name</Label>
              <Input
                id="lastName"
                value={clientForm.lastName}
                onChange={(e) => setClientForm({ ...clientForm, lastName: e.target.value })}
                placeholder="Doe"
                data-testid="input-last-name"
              />
            </div>
          </div>
          <div>
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              value={clientForm.email}
              onChange={(e) => setClientForm({ ...clientForm, email: e.target.value })}
              placeholder="john.doe@example.com"
              data-testid="input-email"
            />
          </div>
          <div>
            <Label htmlFor="mobile">Mobile Number</Label>
            <Input
              id="mobile"
              value={clientForm.mobile}
              onChange={(e) => setClientForm({ ...clientForm, mobile: e.target.value })}
              placeholder="+1 (555) 123-4567"
              data-testid="input-mobile"
            />
          </div>
          <div>
            <Label htmlFor="role">Role</Label>
            <Select value={clientForm.role} onValueChange={(value) => setClientForm({ ...clientForm, role: value })}>
              <SelectTrigger data-testid="select-role">
                <SelectValue placeholder="Select a role" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="user">Client</SelectItem>
                <SelectItem value="admin">Admin</SelectItem>
                <SelectItem value="super_admin">Super Admin</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center space-x-2">
            <input
              type="checkbox"
              id="isActive"
              checked={clientForm.isActive}
              onChange={(e) => setClientForm({ ...clientForm, isActive: e.target.checked })}
              data-testid="checkbox-active"
            />
            <Label htmlFor="isActive">Active Account</Label>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setCreateClientDialog(false)} data-testid="button-cancel-create">
            Cancel
          </Button>
          <Button
            onClick={() => {
              if (clientForm.firstName && clientForm.lastName && clientForm.email) {
                createClientMutation.mutate(clientForm);
              }
            }}
            disabled={!clientForm.firstName || !clientForm.lastName || !clientForm.email || createClientMutation.isPending}
            data-testid="button-create-client"
          >
            {createClientMutation.isPending ? "Creating..." : "Create Client"}
          </Button>
        </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Client Dialog */}
      <Dialog open={editClientDialog} onOpenChange={setEditClientDialog}>
        <DialogContent data-testid="dialog-edit-client">
          <DialogHeader>
            <DialogTitle>Edit Client</DialogTitle>
            <DialogDescription>
              Update client information for {selectedClient?.firstName} {selectedClient?.lastName}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="editFirstName">First Name</Label>
                <Input
                  id="editFirstName"
                  value={clientForm.firstName}
                  onChange={(e) => setClientForm({ ...clientForm, firstName: e.target.value })}
                  placeholder="John"
                  data-testid="input-edit-first-name"
                />
              </div>
              <div>
                <Label htmlFor="editLastName">Last Name</Label>
                <Input
                  id="editLastName"
                  value={clientForm.lastName}
                  onChange={(e) => setClientForm({ ...clientForm, lastName: e.target.value })}
                  placeholder="Doe"
                  data-testid="input-edit-last-name"
                />
              </div>
            </div>
            <div>
              <Label htmlFor="editEmail">Email</Label>
              <Input
                id="editEmail"
                type="email"
                value={clientForm.email}
                onChange={(e) => setClientForm({ ...clientForm, email: e.target.value })}
                placeholder="john.doe@example.com"
                data-testid="input-edit-email"
              />
            </div>
            <div>
              <Label htmlFor="editMobile">Mobile Number</Label>
              <Input
                id="editMobile"
                value={clientForm.mobile}
                onChange={(e) => setClientForm({ ...clientForm, mobile: e.target.value })}
                placeholder="+1 (555) 123-4567"
                data-testid="input-edit-mobile"
              />
            </div>
            <div>
              <Label htmlFor="editRole">Role</Label>
              <Select value={clientForm.role} onValueChange={(value) => setClientForm({ ...clientForm, role: value })}>
                <SelectTrigger data-testid="select-edit-role">
                  <SelectValue placeholder="Select a role" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="user">Client</SelectItem>
                  <SelectItem value="admin">Admin</SelectItem>
                  <SelectItem value="super_admin">Super Admin</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center space-x-2">
              <input
                type="checkbox"
                id="editIsActive"
                checked={clientForm.isActive}
                onChange={(e) => setClientForm({ ...clientForm, isActive: e.target.checked })}
                data-testid="checkbox-edit-active"
              />
              <Label htmlFor="editIsActive">Active Account</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditClientDialog(false)} data-testid="button-cancel-edit">
              Cancel
            </Button>
            <Button
              onClick={() => {
                if (selectedClient && clientForm.firstName && clientForm.lastName && clientForm.email) {
                  updateClientMutation.mutate({
                    clientId: selectedClient.id,
                    clientData: clientForm
                  });
                }
              }}
              disabled={!clientForm.firstName || !clientForm.lastName || !clientForm.email || updateClientMutation.isPending}
              data-testid="button-update-client"
            >
              {updateClientMutation.isPending ? "Updating..." : "Update Client"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Client Dialog */}
      <Dialog open={deleteClientDialog} onOpenChange={setDeleteClientDialog}>
        <DialogContent data-testid="dialog-delete-client">
          <DialogHeader>
            <DialogTitle>Delete Client</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete {clientToDelete?.firstName} {clientToDelete?.lastName}? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <div className="p-4 bg-red-50 border border-red-200 rounded-md">
            <div className="flex items-center">
              <AlertTriangle className="h-5 w-5 text-red-500 mr-2" />
              <span className="text-sm font-medium text-red-800">Warning: This will permanently delete the client account</span>
            </div>
            <div className="mt-2 text-sm text-red-700">
              • All client data will be permanently removed
              • Portfolio and transaction history will be lost
              • This action cannot be undone
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteClientDialog(false)} data-testid="button-cancel-delete">
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                if (clientToDelete) {
                  deleteClientMutation.mutate(clientToDelete.id);
                }
              }}
              disabled={deleteClientMutation.isPending}
              data-testid="button-confirm-delete"
            >
              {deleteClientMutation.isPending ? "Deleting..." : "Delete Client"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

    </div>
  );
}

// Capital Gains Report Viewer Component
function CapitalGainsReportViewer() {
  const [selectedFinancialYear, setSelectedFinancialYear] = useState('2023-24');
  const [selectedSource, setSelectedSource] = useState('all');
  const [exportFormat, setExportFormat] = useState<'csv' | 'excel' | 'json'>('csv');
  const [isExporting, setIsExporting] = useState(false);
  
  const { toast } = useToast();

  const { data: reportStats } = useQuery({
    queryKey: ['/api/admin/reports/stats'],
    queryFn: async () => {
      const response = await fetch('/api/admin/reports/stats');
      const result = await response.json();
      return result.data;
    }
  });

  const handleExportReports = async () => {
    setIsExporting(true);
    try {
      const queryParams = new URLSearchParams({
        format: exportFormat,
        ...(selectedFinancialYear !== 'all' && { financialYear: selectedFinancialYear }),
        ...(selectedSource !== 'all' && { source: selectedSource })
      });

      const response = await fetch(`/api/admin/capital-gains-reports/export?${queryParams}`);
      
      if (!response.ok) {
        throw new Error('Export failed');
      }

      // Get the filename from the response headers
      const contentDisposition = response.headers.get('Content-Disposition');
      const filename = contentDisposition 
        ? contentDisposition.split('filename=')[1]?.replace(/"/g, '')
        : `capital-gains-export.${exportFormat === 'excel' ? 'xlsx' : exportFormat}`;

      // Create download link
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      a.click();
      window.URL.revokeObjectURL(url);

      toast({
        title: "Export Successful",
        description: `Capital gains reports exported as ${exportFormat.toUpperCase()}`,
      });

    } catch (error) {
      toast({
        title: "Export Failed",
        description: "Failed to export capital gains reports. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Statistics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total Reports</p>
                <p className="text-2xl font-bold">{reportStats?.capitalGainsReports?.total || 0}</p>
              </div>
              <Receipt className="h-8 w-8 text-blue-500" />
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Completed</p>
                <p className="text-2xl font-bold text-green-600">{reportStats?.capitalGainsReports?.completed || 0}</p>
              </div>
              <CheckCircle className="h-8 w-8 text-green-500" />
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">This Month</p>
                <p className="text-2xl font-bold">{reportStats?.capitalGainsReports?.thisMonth || 0}</p>
              </div>
              <Calendar className="h-8 w-8 text-orange-500" />
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Failed</p>
                <p className="text-2xl font-bold text-red-600">{reportStats?.capitalGainsReports?.failed || 0}</p>
              </div>
              <AlertTriangle className="h-8 w-8 text-red-500" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Export Controls */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Download className="h-5 w-5" />
            Export Capital Gains Reports
          </CardTitle>
          <CardDescription>
            Export all capital gains reports with filtering options
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label>Financial Year</Label>
              <Select value={selectedFinancialYear} onValueChange={setSelectedFinancialYear}>
                <SelectTrigger data-testid="select-admin-financial-year">
                  <SelectValue placeholder="Select financial year" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Years</SelectItem>
                  <SelectItem value="2023-24">2023-24</SelectItem>
                  <SelectItem value="2022-23">2022-23</SelectItem>
                  <SelectItem value="2021-22">2021-22</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Data Source</Label>
              <Select value={selectedSource} onValueChange={setSelectedSource}>
                <SelectTrigger data-testid="select-admin-source">
                  <SelectValue placeholder="Select source" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Sources</SelectItem>
                  <SelectItem value="nsdl">NSDL</SelectItem>
                  <SelectItem value="cdsl">CDSL</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Export Format</Label>
              <Select value={exportFormat} onValueChange={(value: 'csv' | 'excel' | 'json') => setExportFormat(value)}>
                <SelectTrigger data-testid="select-admin-export-format">
                  <SelectValue placeholder="Select format" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="csv">CSV</SelectItem>
                  <SelectItem value="excel">Excel</SelectItem>
                  <SelectItem value="json">JSON</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <Button
            onClick={handleExportReports}
            disabled={isExporting}
            className="w-full"
            data-testid="button-export-capital-gains"
          >
            {isExporting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {isExporting ? 'Exporting...' : `Export as ${exportFormat.toUpperCase()}`}
          </Button>
        </CardContent>
      </Card>

      {/* Recent Reports Table Preview */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Capital Gains Reports</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-muted-foreground">
            <Receipt className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>Recent reports will be displayed here</p>
            <p className="text-sm">Use the export function to download complete data</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// Transaction Report Viewer Component
function TransactionReportViewer() {
  const [selectedFinancialYear, setSelectedFinancialYear] = useState('2023-24');
  const [selectedSource, setSelectedSource] = useState('all');
  const [selectedAssetType, setSelectedAssetType] = useState('all');
  const [exportFormat, setExportFormat] = useState<'csv' | 'excel' | 'json'>('csv');
  const [isExporting, setIsExporting] = useState(false);
  
  const { toast } = useToast();

  const { data: reportStats } = useQuery({
    queryKey: ['/api/admin/reports/stats'],
    queryFn: async () => {
      const response = await fetch('/api/admin/reports/stats');
      const result = await response.json();
      return result.data;
    }
  });

  const handleExportReports = async () => {
    setIsExporting(true);
    try {
      const queryParams = new URLSearchParams({
        format: exportFormat,
        ...(selectedFinancialYear !== 'all' && { financialYear: selectedFinancialYear }),
        ...(selectedSource !== 'all' && { source: selectedSource }),
        ...(selectedAssetType !== 'all' && { assetType: selectedAssetType })
      });

      const response = await fetch(`/api/admin/transaction-reports/export?${queryParams}`);
      
      if (!response.ok) {
        throw new Error('Export failed');
      }

      // Get the filename from the response headers
      const contentDisposition = response.headers.get('Content-Disposition');
      const filename = contentDisposition 
        ? contentDisposition.split('filename=')[1]?.replace(/"/g, '')
        : `transaction-reports-export.${exportFormat === 'excel' ? 'xlsx' : exportFormat}`;

      // Create download link
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      a.click();
      window.URL.revokeObjectURL(url);

      toast({
        title: "Export Successful",
        description: `Transaction reports exported as ${exportFormat.toUpperCase()}`,
      });

    } catch (error) {
      toast({
        title: "Export Failed",
        description: "Failed to export transaction reports. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Statistics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total Reports</p>
                <p className="text-2xl font-bold">{reportStats?.transactionReports?.total || 0}</p>
              </div>
              <FileText className="h-8 w-8 text-blue-500" />
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Completed</p>
                <p className="text-2xl font-bold text-green-600">{reportStats?.transactionReports?.completed || 0}</p>
              </div>
              <CheckCircle className="h-8 w-8 text-green-500" />
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">This Month</p>
                <p className="text-2xl font-bold">{reportStats?.transactionReports?.thisMonth || 0}</p>
              </div>
              <Calendar className="h-8 w-8 text-orange-500" />
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Failed</p>
                <p className="text-2xl font-bold text-red-600">{reportStats?.transactionReports?.failed || 0}</p>
              </div>
              <AlertTriangle className="h-8 w-8 text-red-500" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Export Controls */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Download className="h-5 w-5" />
            Export Transaction Reports
          </CardTitle>
          <CardDescription>
            Export all transaction reports with comprehensive filtering options
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="space-y-2">
              <Label>Financial Year</Label>
              <Select value={selectedFinancialYear} onValueChange={setSelectedFinancialYear}>
                <SelectTrigger data-testid="select-admin-transaction-year">
                  <SelectValue placeholder="Select financial year" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Years</SelectItem>
                  <SelectItem value="2023-24">2023-24</SelectItem>
                  <SelectItem value="2022-23">2022-23</SelectItem>
                  <SelectItem value="2021-22">2021-22</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Data Source</Label>
              <Select value={selectedSource} onValueChange={setSelectedSource}>
                <SelectTrigger data-testid="select-admin-transaction-source">
                  <SelectValue placeholder="Select source" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Sources</SelectItem>
                  <SelectItem value="mf_central">MF Central</SelectItem>
                  <SelectItem value="cams">CAMS</SelectItem>
                  <SelectItem value="kfintech">KFintech</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Asset Type</Label>
              <Select value={selectedAssetType} onValueChange={setSelectedAssetType}>
                <SelectTrigger data-testid="select-admin-asset-type">
                  <SelectValue placeholder="Select asset type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  <SelectItem value="mutual_funds">Mutual Funds</SelectItem>
                  <SelectItem value="equities">Equities</SelectItem>
                  <SelectItem value="bonds">Bonds</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Export Format</Label>
              <Select value={exportFormat} onValueChange={(value: 'csv' | 'excel' | 'json') => setExportFormat(value)}>
                <SelectTrigger data-testid="select-admin-transaction-format">
                  <SelectValue placeholder="Select format" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="csv">CSV</SelectItem>
                  <SelectItem value="excel">Excel</SelectItem>
                  <SelectItem value="json">JSON</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <Button
            onClick={handleExportReports}
            disabled={isExporting}
            className="w-full"
            data-testid="button-export-transaction-reports"
          >
            {isExporting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {isExporting ? 'Exporting...' : `Export as ${exportFormat.toUpperCase()}`}
          </Button>
        </CardContent>
      </Card>

      {/* Recent Reports Table Preview */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Transaction Reports</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-muted-foreground">
            <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>Recent transaction reports will be displayed here</p>
            <p className="text-sm">Use the export function to download complete data</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}