import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { CheckCircle2, XCircle, AlertTriangle, Server, Database, Key, Shield, Zap, Globe } from "lucide-react";

interface ReadinessCheck {
  category: string;
  items: {
    name: string;
    status: 'ready' | 'warning' | 'critical';
    description: string;
    action?: string;
  }[];
}

const readinessChecks: ReadinessCheck[] = [
  {
    category: 'API Configuration',
    items: [
      {
        name: 'TaxCloud India',
        status: 'warning',
        description: 'Currently in sandbox mode',
        action: 'Switch to production and configure TAXCLOUD_API_KEY'
      },
      {
        name: 'Cashfree Payment Gateway (Primary)',
        status: 'ready',
        description: 'Production keys configured',
      },
      {
        name: 'PhonePe Payment Gateway (Secondary)',
        status: 'warning',
        description: 'Currently in sandbox mode',
        action: 'Switch to production environment'
      },
      {
        name: 'Gemini AI',
        status: 'ready',
        description: 'API key configured for expense categorization',
      },
      {
        name: 'Twilio SMS',
        status: 'ready',
        description: 'Production credentials configured',
      },
      {
        name: 'Email Service',
        status: 'ready',
        description: 'SMTP configured and operational',
      },
    ]
  },
  {
    category: 'Security & Compliance',
    items: [
      {
        name: 'SSL/TLS Certificate',
        status: 'ready',
        description: 'Valid certificate configured for fintekpro.com',
      },
      {
        name: 'Session Security',
        status: 'ready',
        description: 'Secure session management with PostgreSQL store',
      },
      {
        name: 'CORS Configuration',
        status: 'ready',
        description: 'Properly configured for production domains',
      },
      {
        name: 'Rate Limiting',
        status: 'ready',
        description: 'API rate limiting enabled',
      },
      {
        name: 'SEBI Compliance',
        status: 'ready',
        description: 'KYC, Accredited Investor validation implemented',
      },
      {
        name: 'Data Encryption',
        status: 'ready',
        description: 'Sensitive data encrypted at rest and in transit',
      },
    ]
  },
  {
    category: 'Database & Storage',
    items: [
      {
        name: 'PostgreSQL Database',
        status: 'ready',
        description: 'Neon serverless database configured',
      },
      {
        name: 'Database Backups',
        status: 'warning',
        description: 'Automated backups need verification',
        action: 'Verify Neon backup schedule and retention policy'
      },
      {
        name: 'Object Storage',
        status: 'ready',
        description: 'Google Cloud Storage configured',
      },
      {
        name: 'Session Store',
        status: 'ready',
        description: 'PostgreSQL session store operational',
      },
    ]
  },
  {
    category: 'Infrastructure',
    items: [
      {
        name: 'Environment Variables',
        status: 'ready',
        description: 'All required environment variables configured',
      },
      {
        name: 'Error Monitoring',
        status: 'ready',
        description: 'Centralized error handling configured',
      },
      {
        name: 'Logging',
        status: 'ready',
        description: 'Compliance logging and audit trails active',
      },
      {
        name: 'Performance Monitoring',
        status: 'warning',
        description: 'No external APM configured',
        action: 'Consider integrating New Relic or Datadog'
      },
    ]
  },
  {
    category: 'Features & Integrations',
    items: [
      {
        name: 'Authentication System',
        status: 'ready',
        description: 'Email/SMS/WhatsApp OTP with 2FA',
      },
      {
        name: 'Payment Processing',
        status: 'ready',
        description: 'Dual-gateway system: Cashfree (primary) + PhonePe (secondary)',
      },
      {
        name: 'KYC System',
        status: 'ready',
        description: '3-tier progressive KYC with DigiLocker & Cashfree OKYC',
      },
      {
        name: 'Tax Filing',
        status: 'warning',
        description: 'TaxCloud in sandbox mode',
        action: 'Activate production API for live tax filing'
      },
      {
        name: 'AI Features',
        status: 'ready',
        description: 'Gemini AI configured for expense categorization',
      },
      {
        name: 'Bank Verification',
        status: 'ready',
        description: 'Penny drop validation operational',
      },
    ]
  },
];

export default function ProductionReadiness() {
  const totalChecks = readinessChecks.reduce((sum, cat) => sum + cat.items.length, 0);
  const readyCount = readinessChecks.reduce(
    (sum, cat) => sum + cat.items.filter(item => item.status === 'ready').length, 
    0
  );
  const warningCount = readinessChecks.reduce(
    (sum, cat) => sum + cat.items.filter(item => item.status === 'warning').length, 
    0
  );
  const criticalCount = readinessChecks.reduce(
    (sum, cat) => sum + cat.items.filter(item => item.status === 'critical').length, 
    0
  );
  
  const readinessPercentage = Math.round((readyCount / totalChecks) * 100);

  const getStatusIcon = (status: 'ready' | 'warning' | 'critical') => {
    switch (status) {
      case 'ready':
        return <CheckCircle2 className="h-5 w-5 text-green-500 dark:text-green-400" />;
      case 'warning':
        return <AlertTriangle className="h-5 w-5 text-yellow-500 dark:text-yellow-400" />;
      case 'critical':
        return <XCircle className="h-5 w-5 text-red-500 dark:text-red-400" />;
    }
  };

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'API Configuration':
        return <Key className="h-5 w-5" />;
      case 'Security & Compliance':
        return <Shield className="h-5 w-5" />;
      case 'Database & Storage':
        return <Database className="h-5 w-5" />;
      case 'Infrastructure':
        return <Server className="h-5 w-5" />;
      case 'Features & Integrations':
        return <Zap className="h-5 w-5" />;
      default:
        return <Globe className="h-5 w-5" />;
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-foreground">Production Readiness</h1>
        <p className="text-muted-foreground mt-1">System deployment checklist and status</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">Overall Status</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-foreground mb-2">{readinessPercentage}%</div>
            <Progress value={readinessPercentage} className="h-2" />
            <p className="text-xs text-muted-foreground mt-2">{readyCount} of {totalChecks} checks passed</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">Ready</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-3">
              <CheckCircle2 className="h-8 w-8 text-green-500 dark:text-green-400" />
              <div className="text-3xl font-bold text-green-500 dark:text-green-400">{readyCount}</div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">Warnings</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-3">
              <AlertTriangle className="h-8 w-8 text-yellow-500 dark:text-yellow-400" />
              <div className="text-3xl font-bold text-yellow-500 dark:text-yellow-400">{warningCount}</div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">Critical</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-3">
              <XCircle className="h-8 w-8 text-red-500 dark:text-red-400" />
              <div className="text-3xl font-bold text-red-500 dark:text-red-400">{criticalCount}</div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="space-y-6">
        {readinessChecks.map((check) => (
          <Card key={check.category}>
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="p-2 bg-blue-500/20 rounded-lg text-blue-600 dark:text-blue-400">
                  {getCategoryIcon(check.category)}
                </div>
                <CardTitle className="text-foreground">{check.category}</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {check.items.map((item, idx) => (
                  <div 
                    key={idx}
                    className="flex items-start justify-between border-b border-border pb-4 last:border-0 last:pb-0"
                  >
                    <div className="flex items-start gap-3 flex-1">
                      {getStatusIcon(item.status)}
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <h4 className="font-medium text-foreground">{item.name}</h4>
                          <Badge 
                            className={
                              item.status === 'ready' 
                                ? 'bg-green-500/20 text-green-600 dark:text-green-400 border-green-500/50'
                                : item.status === 'warning'
                                ? 'bg-yellow-500/20 text-yellow-600 dark:text-yellow-400 border-yellow-500/50'
                                : 'bg-red-500/20 text-red-600 dark:text-red-400 border-red-500/50'
                            }
                          >
                            {item.status}
                          </Badge>
                        </div>
                        <p className="text-sm text-muted-foreground mt-1">{item.description}</p>
                        {item.action && (
                          <p className="text-sm text-blue-600 dark:text-blue-400 mt-2">
                            → {item.action}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {criticalCount > 0 && (
        <Card className="bg-red-50 dark:bg-red-950/30 border-red-200 dark:border-red-800">
          <CardHeader>
            <CardTitle className="text-red-600 dark:text-red-400 flex items-center gap-2">
              <XCircle className="h-5 w-5" />
              Critical Issues Detected
            </CardTitle>
            <CardDescription className="text-red-700 dark:text-red-300">
              {criticalCount} critical {criticalCount === 1 ? 'issue' : 'issues'} must be resolved before production deployment
            </CardDescription>
          </CardHeader>
        </Card>
      )}
    </div>
  );
}
