import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Key, Check, X, AlertCircle, Settings } from "lucide-react";
import { useState } from "react";

interface ServiceConfig {
  name: string;
  description: string;
  environment: 'sandbox' | 'production';
  status: 'configured' | 'missing' | 'error';
  envVars: string[];
}

const services: ServiceConfig[] = [
  {
    name: 'TaxCloud India',
    description: 'ITR filing and tax services',
    environment: 'sandbox',
    status: 'configured',
    envVars: ['TAXCLOUD_API_KEY', 'TAXCLOUD_ENVIRONMENT']
  },
  {
    name: 'Cashfree',
    description: 'Payment gateway (primary)',
    environment: 'production',
    status: 'configured',
    envVars: ['CASHFREE_APP_ID', 'CASHFREE_SECRET_KEY']
  },
  {
    name: 'PhonePe',
    description: 'Payment gateway (tertiary)',
    environment: 'sandbox',
    status: 'configured',
    envVars: ['PHONEPE_MERCHANT_ID', 'PHONEPE_SALT_KEY']
  },
  {
    name: 'Stripe',
    description: 'Payment gateway (secondary)',
    environment: 'production',
    status: 'missing',
    envVars: ['STRIPE_SECRET_KEY', 'STRIPE_WEBHOOK_SECRET']
  },
  {
    name: 'Gemini AI',
    description: 'AI expense categorization',
    environment: 'production',
    status: 'missing',
    envVars: ['GEMINI_API_KEY']
  },
  {
    name: 'Twilio',
    description: 'SMS OTP delivery',
    environment: 'production',
    status: 'configured',
    envVars: ['TWILIO_ACCOUNT_SID', 'TWILIO_AUTH_TOKEN']
  },
  {
    name: 'Email Service',
    description: 'SMTP email delivery',
    environment: 'production',
    status: 'configured',
    envVars: ['EMAIL_USER', 'EMAIL_PASS']
  },
  {
    name: 'Sandbox API',
    description: 'Bank account verification',
    environment: 'sandbox',
    status: 'configured',
    envVars: ['SANDBOX_API_KEY', 'SANDBOX_API_SECRET']
  },
];

export default function APIConfiguration() {
  const [selectedService, setSelectedService] = useState<ServiceConfig | null>(null);

  const handleAskSecrets = (service: ServiceConfig) => {
    // This would trigger the ask_secrets tool via backend
    alert(`Configure ${service.name} secrets:\n\n${service.envVars.join('\n')}`);
  };

  const getStatusIcon = (status: ServiceConfig['status']) => {
    switch (status) {
      case 'configured':
        return <Check className="h-4 w-4 text-green-400" />;
      case 'missing':
        return <X className="h-4 w-4 text-red-400" />;
      case 'error':
        return <AlertCircle className="h-4 w-4 text-yellow-400" />;
    }
  };

  const getStatusBadge = (status: ServiceConfig['status']) => {
    const variants = {
      configured: 'bg-green-500/20 text-green-400 border-green-500/50',
      missing: 'bg-red-500/20 text-red-400 border-red-500/50',
      error: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/50'
    };
    
    return (
      <Badge className={variants[status]}>
        {status}
      </Badge>
    );
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-white">API Configuration</h1>
        <p className="text-gray-400 mt-1">Manage API keys and service environments</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {services.map((service) => (
          <Card key={service.name} className="bg-gray-900 border-gray-800">
            <CardHeader>
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-blue-500/20 rounded-lg">
                    <Key className="h-5 w-5 text-blue-400" />
                  </div>
                  <div>
                    <CardTitle className="text-white">{service.name}</CardTitle>
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
                <Badge 
                  className={service.environment === 'production' 
                    ? 'bg-purple-500/20 text-purple-400 border-purple-500/50'
                    : 'bg-blue-500/20 text-blue-400 border-blue-500/50'
                  }
                >
                  {service.environment}
                </Badge>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-400">Status</span>
                {getStatusBadge(service.status)}
              </div>

              <div className="space-y-2">
                <span className="text-sm text-gray-400">Required Keys</span>
                <div className="space-y-1">
                  {service.envVars.map((envVar) => (
                    <div key={envVar} className="text-xs text-gray-500 font-mono">
                      {envVar}
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex gap-2 pt-2">
                <Button 
                  size="sm" 
                  variant="outline"
                  className="flex-1 border-gray-700 text-gray-300 hover:bg-gray-800"
                  onClick={() => handleAskSecrets(service)}
                  disabled={service.status === 'configured'}
                >
                  <Settings className="h-4 w-4 mr-2" />
                  Configure
                </Button>
                {service.environment === 'sandbox' && (
                  <Button 
                    size="sm" 
                    className="flex-1 bg-purple-600 hover:bg-purple-700"
                  >
                    Switch to Production
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
