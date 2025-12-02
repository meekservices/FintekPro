import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsTrigger } from "@/components/ui/tabs";
import { ScrollableTabsList } from "@/components/ScrollableTabsList";
import { 
  Key, Check, X, AlertCircle, Settings, RefreshCw, Loader2, 
  ExternalLink, Play, Zap, Shield, Cloud, Database, 
  MessageSquare, BarChart, CreditCard, Bot, Mail, Phone
} from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";

interface ServiceConfig {
  id: string;
  name: string;
  description: string;
  category: string;
  envVars: string[];
  environmentVar: string | null;
  status: 'configured' | 'missing';
  environment: 'sandbox' | 'production';
  testEndpoint: string;
  docs: string | null;
}

interface ApiConfigData {
  services: ServiceConfig[];
  categories: Record<string, { name: string; services: ServiceConfig[] }>;
  summary: {
    total: number;
    configured: number;
    missing: number;
    sandbox: number;
    production: number;
  };
  lastChecked: string;
}

interface TestResult {
  success: boolean;
  message: string;
  details?: any;
  latency?: number;
}

const categoryIcons: Record<string, any> = {
  payments: CreditCard,
  verification: Shield,
  ai: Bot,
  communication: MessageSquare,
  marketing: Mail,
  'market-data': BarChart,
  data: Database
};

export default function APIConfiguration() {
  const { toast } = useToast();
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [testingService, setTestingService] = useState<string | null>(null);
  const [testResults, setTestResults] = useState<Record<string, TestResult>>({});
  const [switchingEnv, setSwitchingEnv] = useState<string | null>(null);
  const [showEnvDialog, setShowEnvDialog] = useState(false);
  const [envDialogService, setEnvDialogService] = useState<ServiceConfig | null>(null);

  const { data: configData, isLoading, error, refetch } = useQuery<{ success: boolean; data: ApiConfigData }>({
    queryKey: ['/api/admin/api-config'],
    refetchInterval: 30000,
  });

  const testConnectionMutation = useMutation({
    mutationFn: async (serviceId: string) => {
      const response = await apiRequest(`/api/admin/api-config/test/${serviceId}`, {
        method: 'POST'
      });
      return response;
    },
    onSuccess: (data: any, serviceId) => {
      setTestResults(prev => ({
        ...prev,
        [serviceId]: data.data
      }));
      
      if (data.data.success) {
        toast({
          title: "Connection Successful",
          description: `${data.data.message} (${data.data.latency}ms)`,
        });
      } else {
        toast({
          title: "Connection Failed",
          description: data.data.message,
          variant: "destructive"
        });
      }
    },
    onError: (error: any, serviceId) => {
      setTestResults(prev => ({
        ...prev,
        [serviceId]: { success: false, message: error.message }
      }));
      toast({
        title: "Test Failed",
        description: error.message,
        variant: "destructive"
      });
    },
    onSettled: () => {
      setTestingService(null);
    }
  });

  const switchEnvironmentMutation = useMutation({
    mutationFn: async ({ serviceId, environment }: { serviceId: string; environment: string }) => {
      return await apiRequest(`/api/admin/api-config/environment/${serviceId}`, {
        method: 'POST',
        body: JSON.stringify({ environment }),
        headers: { 'Content-Type': 'application/json' }
      });
    },
    onSuccess: (data: any) => {
      toast({
        title: "Environment Switched",
        description: data.message,
      });
      queryClient.invalidateQueries({ queryKey: ['/api/admin/api-config'] });
    },
    onError: (error: any) => {
      toast({
        title: "Switch Failed",
        description: error.message,
        variant: "destructive"
      });
    },
    onSettled: () => {
      setSwitchingEnv(null);
      setShowEnvDialog(false);
      setEnvDialogService(null);
    }
  });

  const handleTestConnection = (serviceId: string) => {
    setTestingService(serviceId);
    testConnectionMutation.mutate(serviceId);
  };

  const handleSwitchEnvironment = (service: ServiceConfig) => {
    setEnvDialogService(service);
    setShowEnvDialog(true);
  };

  const confirmSwitchEnvironment = () => {
    if (!envDialogService) return;
    
    const newEnv = envDialogService.environment === 'sandbox' ? 'production' : 'sandbox';
    setSwitchingEnv(envDialogService.id);
    switchEnvironmentMutation.mutate({ 
      serviceId: envDialogService.id, 
      environment: newEnv 
    });
  };

  const getStatusIcon = (status: ServiceConfig['status']) => {
    switch (status) {
      case 'configured':
        return <Check className="h-4 w-4 text-green-500" />;
      case 'missing':
        return <X className="h-4 w-4 text-red-500" />;
    }
  };

  const getStatusBadge = (status: ServiceConfig['status']) => {
    const variants = {
      configured: 'bg-green-500/20 text-green-500 border-green-500/50',
      missing: 'bg-red-500/20 text-red-500 border-red-500/50'
    };
    
    return (
      <Badge variant="outline" className={variants[status]}>
        {status === 'configured' ? 'Configured' : 'Missing'}
      </Badge>
    );
  };

  const getEnvironmentBadge = (env: string) => {
    return (
      <Badge 
        variant="outline"
        className={env === 'production' 
          ? 'bg-purple-500/20 text-purple-500 border-purple-500/50'
          : 'bg-blue-500/20 text-blue-500 border-blue-500/50'
        }
      >
        {env}
      </Badge>
    );
  };

  const getCategoryIcon = (category: string) => {
    const Icon = categoryIcons[category] || Cloud;
    return <Icon className="h-5 w-5" />;
  };

  const filteredServices = configData?.data?.services?.filter(service => 
    selectedCategory === 'all' || service.category === selectedCategory
  ) || [];

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div>
          <Skeleton className="h-9 w-64 bg-gray-800" />
          <Skeleton className="h-5 w-96 mt-2 bg-gray-800" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map(i => (
            <Skeleton key={i} className="h-24 bg-gray-800" />
          ))}
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {[1, 2, 3, 4, 5, 6].map(i => (
            <Skeleton key={i} className="h-64 bg-gray-800" />
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-64">
        <Card className="bg-gray-900 border-gray-800 p-6">
          <div className="flex items-center gap-3 text-red-500">
            <AlertCircle className="h-6 w-6" />
            <span>Failed to load API configuration</span>
          </div>
          <Button onClick={() => refetch()} className="mt-4" variant="outline">
            <RefreshCw className="h-4 w-4 mr-2" />
            Retry
          </Button>
        </Card>
      </div>
    );
  }

  const summary = configData?.data?.summary;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white">API Configuration</h1>
          <p className="text-gray-400 mt-1">
            Manage API keys and service environments • Last updated: {
              configData?.data?.lastChecked 
                ? new Date(configData.data.lastChecked).toLocaleTimeString()
                : 'N/A'
            }
          </p>
        </div>
        <Button 
          variant="outline" 
          onClick={() => refetch()}
          className="border-gray-700 text-gray-300 hover:bg-gray-800"
        >
          <RefreshCw className="h-4 w-4 mr-2" />
          Refresh
        </Button>
      </div>

      {summary && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <Card className="bg-gray-900 border-gray-800">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-blue-500/20 rounded-lg">
                  <Cloud className="h-5 w-5 text-blue-400" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-white">{summary.total}</p>
                  <p className="text-xs text-gray-400">Total Services</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gray-900 border-gray-800">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-green-500/20 rounded-lg">
                  <Check className="h-5 w-5 text-green-400" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-green-400">{summary.configured}</p>
                  <p className="text-xs text-gray-400">Configured</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gray-900 border-gray-800">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-red-500/20 rounded-lg">
                  <X className="h-5 w-5 text-red-400" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-red-400">{summary.missing}</p>
                  <p className="text-xs text-gray-400">Missing</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gray-900 border-gray-800">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-blue-500/20 rounded-lg">
                  <Zap className="h-5 w-5 text-blue-400" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-blue-400">{summary.sandbox}</p>
                  <p className="text-xs text-gray-400">Sandbox</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gray-900 border-gray-800">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-purple-500/20 rounded-lg">
                  <Shield className="h-5 w-5 text-purple-400" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-purple-400">{summary.production}</p>
                  <p className="text-xs text-gray-400">Production</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {summary && (
        <div className="flex items-center gap-2">
          <span className="text-sm text-gray-400">Health:</span>
          <Progress 
            value={(summary.configured / summary.total) * 100} 
            className="flex-1 h-2"
          />
          <span className="text-sm text-gray-400">
            {Math.round((summary.configured / summary.total) * 100)}%
          </span>
        </div>
      )}

      <Tabs value={selectedCategory} onValueChange={setSelectedCategory}>
        <ScrollableTabsList className="bg-gray-900 border-gray-800">
          <TabsTrigger value="all" className="data-[state=active]:bg-gray-800">
            All Services
          </TabsTrigger>
          <TabsTrigger value="payments" className="data-[state=active]:bg-gray-800">
            <CreditCard className="h-4 w-4 mr-2" />
            Payments
          </TabsTrigger>
          <TabsTrigger value="verification" className="data-[state=active]:bg-gray-800">
            <Shield className="h-4 w-4 mr-2" />
            Verification
          </TabsTrigger>
          <TabsTrigger value="ai" className="data-[state=active]:bg-gray-800">
            <Bot className="h-4 w-4 mr-2" />
            AI
          </TabsTrigger>
          <TabsTrigger value="communication" className="data-[state=active]:bg-gray-800">
            <MessageSquare className="h-4 w-4 mr-2" />
            Communication
          </TabsTrigger>
          <TabsTrigger value="marketing" className="data-[state=active]:bg-gray-800">
            <Mail className="h-4 w-4 mr-2" />
            Marketing
          </TabsTrigger>
          <TabsTrigger value="market-data" className="data-[state=active]:bg-gray-800">
            <BarChart className="h-4 w-4 mr-2" />
            Market Data
          </TabsTrigger>
          <TabsTrigger value="data" className="data-[state=active]:bg-gray-800">
            <Database className="h-4 w-4 mr-2" />
            Data
          </TabsTrigger>
        </ScrollableTabsList>

        <TabsContent value={selectedCategory} className="mt-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {filteredServices.map((service) => (
              <Card key={service.id} className="bg-gray-900 border-gray-800">
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div className={`p-2 rounded-lg ${
                        service.status === 'configured' 
                          ? 'bg-green-500/20' 
                          : 'bg-red-500/20'
                      }`}>
                        {getCategoryIcon(service.category)}
                      </div>
                      <div>
                        <CardTitle className="text-white flex items-center gap-2">
                          {service.name}
                          {testResults[service.id] && (
                            testResults[service.id].success 
                              ? <Check className="h-4 w-4 text-green-500" />
                              : <AlertCircle className="h-4 w-4 text-yellow-500" />
                          )}
                        </CardTitle>
                        <CardDescription className="text-gray-400">
                          {service.description}
                        </CardDescription>
                      </div>
                    </div>
                    {getStatusIcon(service.status)}
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-400">Environment</span>
                    {getEnvironmentBadge(service.environment)}
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-400">Status</span>
                    {getStatusBadge(service.status)}
                  </div>

                  {testResults[service.id] && (
                    <div className="p-3 rounded-lg bg-gray-800 border border-gray-700">
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-gray-400">Last Test</span>
                        {testResults[service.id].latency && (
                          <span className="text-xs text-gray-500">
                            {testResults[service.id].latency}ms
                          </span>
                        )}
                      </div>
                      <p className={`text-sm mt-1 ${
                        testResults[service.id].success ? 'text-green-400' : 'text-yellow-400'
                      }`}>
                        {testResults[service.id].message}
                      </p>
                    </div>
                  )}

                  <div className="space-y-2">
                    <span className="text-sm text-gray-400">Required Keys</span>
                    <div className="flex flex-wrap gap-1">
                      {service.envVars.map((envVar) => (
                        <Badge 
                          key={envVar} 
                          variant="outline" 
                          className="text-xs font-mono bg-gray-800 text-gray-400 border-gray-700"
                        >
                          {envVar}
                        </Badge>
                      ))}
                    </div>
                  </div>

                  <div className="flex gap-2 pt-2">
                    <Button 
                      size="sm" 
                      variant="outline"
                      className="flex-1 border-gray-700 text-gray-300 hover:bg-gray-800"
                      onClick={() => handleTestConnection(service.id)}
                      disabled={testingService === service.id || service.status === 'missing'}
                    >
                      {testingService === service.id ? (
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      ) : (
                        <Play className="h-4 w-4 mr-2" />
                      )}
                      Test
                    </Button>
                    
                    {service.environmentVar && (
                      <Button 
                        size="sm" 
                        className={`flex-1 ${
                          service.environment === 'sandbox'
                            ? 'bg-purple-600 hover:bg-purple-700'
                            : 'bg-blue-600 hover:bg-blue-700'
                        }`}
                        onClick={() => handleSwitchEnvironment(service)}
                        disabled={switchingEnv === service.id || service.status === 'missing'}
                      >
                        {switchingEnv === service.id ? (
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        ) : (
                          <Settings className="h-4 w-4 mr-2" />
                        )}
                        {service.environment === 'sandbox' ? 'Go Live' : 'Use Sandbox'}
                      </Button>
                    )}

                    {service.docs && (
                      <Button 
                        size="sm" 
                        variant="ghost"
                        className="text-gray-400 hover:text-white"
                        onClick={() => window.open(service.docs!, '_blank')}
                      >
                        <ExternalLink className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {filteredServices.length === 0 && (
            <Card className="bg-gray-900 border-gray-800">
              <CardContent className="p-12 text-center">
                <Cloud className="h-12 w-12 text-gray-600 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-400">No services in this category</h3>
                <p className="text-gray-500 mt-1">Select a different category to view services</p>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>

      <Dialog open={showEnvDialog} onOpenChange={setShowEnvDialog}>
        <DialogContent className="bg-gray-900 border-gray-800">
          <DialogHeader>
            <DialogTitle className="text-white">
              Switch to {envDialogService?.environment === 'sandbox' ? 'Production' : 'Sandbox'}?
            </DialogTitle>
            <DialogDescription className="text-gray-400">
              {envDialogService?.environment === 'sandbox' ? (
                <>
                  <strong className="text-yellow-500">Warning:</strong> Switching to production mode will 
                  use real API credentials and may incur charges. Ensure your production 
                  credentials are properly configured.
                </>
              ) : (
                <>
                  Switching to sandbox mode will use test credentials. This is safe for 
                  development and testing purposes.
                </>
              )}
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <div className="flex items-center justify-between p-3 bg-gray-800 rounded-lg">
              <span className="text-gray-400">Service</span>
              <span className="text-white font-medium">{envDialogService?.name}</span>
            </div>
            <div className="flex items-center justify-between p-3 bg-gray-800 rounded-lg mt-2">
              <span className="text-gray-400">Current Environment</span>
              {envDialogService && getEnvironmentBadge(envDialogService.environment)}
            </div>
            <div className="flex items-center justify-between p-3 bg-gray-800 rounded-lg mt-2">
              <span className="text-gray-400">New Environment</span>
              {getEnvironmentBadge(envDialogService?.environment === 'sandbox' ? 'production' : 'sandbox')}
            </div>
          </div>
          <DialogFooter>
            <Button 
              variant="outline" 
              onClick={() => setShowEnvDialog(false)}
              className="border-gray-700"
            >
              Cancel
            </Button>
            <Button 
              onClick={confirmSwitchEnvironment}
              className={envDialogService?.environment === 'sandbox' 
                ? 'bg-purple-600 hover:bg-purple-700' 
                : 'bg-blue-600 hover:bg-blue-700'
              }
              disabled={switchEnvironmentMutation.isPending}
            >
              {switchEnvironmentMutation.isPending ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : null}
              Confirm Switch
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
