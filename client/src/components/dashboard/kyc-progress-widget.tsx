import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Link } from "wouter";
import { 
  Shield, 
  CheckCircle2, 
  AlertCircle, 
  ArrowRight,
  User,
  FileText,
  CreditCard,
  Building2,
  Camera
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useQuery } from "@tanstack/react-query";

interface KYCStep {
  id: string;
  name: string;
  icon: any;
  completed: boolean;
}

export function KYCProgressWidget() {
  const { user, isAuthenticated } = useAuth();
  
  const { data: kycStatus } = useQuery({
    queryKey: ['/api/kyc/status'],
    enabled: isAuthenticated,
  });

  if (!isAuthenticated) {
    return (
      <Card className="border-0 shadow-lg bg-gradient-to-br from-indigo-50 to-blue-50 dark:from-indigo-950 dark:to-blue-950" data-testid="kyc-progress-widget">
        <CardContent className="pt-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-indigo-100 dark:bg-indigo-900 rounded-full">
                <Shield className="h-6 w-6 text-indigo-600 dark:text-indigo-400" />
              </div>
              <div>
                <h3 className="font-semibold text-lg">Complete Your KYC</h3>
                <p className="text-sm text-muted-foreground">Verify your identity to unlock all features</p>
              </div>
            </div>
            <Link href="/auth">
              <Button className="bg-indigo-600 hover:bg-indigo-700" data-testid="kyc-get-started-btn">
                Get Started
                <ArrowRight className="h-4 w-4 ml-2" />
              </Button>
            </Link>
          </div>
        </CardContent>
      </Card>
    );
  }

  const kycLevel = (user as any)?.kycLevel || 'basic';
  const kycStatusValue = (user as any)?.kycStatus || 'pending';
  
  const steps: KYCStep[] = [
    { id: 'personal', name: 'Personal Info', icon: User, completed: !!user?.firstName },
    { id: 'pan', name: 'PAN Verification', icon: CreditCard, completed: !!user?.panNumber },
    { id: 'address', name: 'Address Proof', icon: Building2, completed: !!user?.address },
    { id: 'documents', name: 'Documents', icon: FileText, completed: kycStatusValue === 'verified' || kycStatusValue === 'approved' },
    { id: 'selfie', name: 'Photo Verification', icon: Camera, completed: kycLevel === 'enhanced' || kycLevel === 'accredited' },
  ];

  const completedSteps = steps.filter(s => s.completed).length;
  const progress = (completedSteps / steps.length) * 100;

  const getStatusBadge = () => {
    if (kycStatusValue === 'verified' || kycStatusValue === 'approved') {
      return <Badge className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">Verified</Badge>;
    }
    if (kycStatusValue === 'pending') {
      return <Badge className="bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200">In Progress</Badge>;
    }
    if (kycStatusValue === 'rejected') {
      return <Badge className="bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200">Action Required</Badge>;
    }
    return <Badge className="bg-muted text-foreground">Not Started</Badge>;
  };

  const getLevelBadge = () => {
    const levels: Record<string, { label: string; color: string }> = {
      'basic': { label: 'Basic KYC', color: 'bg-muted text-foreground' },
      'enhanced': { label: 'Enhanced KYC', color: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200' },
      'accredited': { label: 'Accredited Investor', color: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200' },
    };
    const level = levels[kycLevel] || levels.basic;
    return <Badge className={level.color}>{level.label}</Badge>;
  };

  return (
    <Card className="border-0 shadow-lg bg-gradient-to-br from-background to-muted" data-testid="kyc-progress-widget">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Shield className="h-5 w-5 text-indigo-600" />
            KYC Progress
          </CardTitle>
          <div className="flex gap-2">
            {getLevelBadge()}
            {getStatusBadge()}
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Completion</span>
            <span className="font-medium">{Math.round(progress)}%</span>
          </div>
          <Progress value={progress} className="h-2" />
        </div>

        <div className="flex flex-wrap gap-2">
          {steps.map((step) => (
            <div
              key={step.id}
              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-full text-xs font-medium transition-colors ${
                step.completed 
                  ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' 
                  : 'bg-muted text-muted-foreground'
              }`}
              data-testid={`kyc-step-${step.id}`}
            >
              {step.completed ? (
                <CheckCircle2 className="h-3.5 w-3.5" />
              ) : (
                <step.icon className="h-3.5 w-3.5" />
              )}
              {step.name}
            </div>
          ))}
        </div>

        {progress < 100 && (
          <Link href="/kyc-dashboard">
            <Button className="w-full bg-indigo-600 hover:bg-indigo-700" data-testid="kyc-continue-btn">
              Continue KYC
              <ArrowRight className="h-4 w-4 ml-2" />
            </Button>
          </Link>
        )}

        {progress === 100 && kycLevel !== 'accredited' && (
          <div className="space-y-2">
            <Link href="/video-kyc">
              <Button className="w-full bg-purple-600 hover:bg-purple-700" data-testid="kyc-video-btn">
                <Camera className="h-4 w-4 mr-2" />
                Complete Video KYC
                <ArrowRight className="h-4 w-4 ml-2" />
              </Button>
            </Link>
            <Link href="/kyc-dashboard">
              <Button variant="outline" className="w-full" data-testid="kyc-upgrade-btn">
                Upgrade to {kycLevel === 'basic' ? 'Enhanced' : 'Accredited'} KYC
                <ArrowRight className="h-4 w-4 ml-2" />
              </Button>
            </Link>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
