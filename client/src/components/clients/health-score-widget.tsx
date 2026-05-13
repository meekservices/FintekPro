import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { 
  Heart, 
  TrendingUp, 
  TrendingDown, 
  AlertTriangle,
  CheckCircle2,
  Info,
  Shield as LucideShield,
  PieChart,
  Activity,
  Clock
} from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

interface HealthFactor {
  name: string;
  score: number;
  weight: number;
  status: 'excellent' | 'good' | 'warning' | 'critical';
  description: string;
}

interface ClientHealthScoreProps {
  clientId?: string;
  clientName?: string;
}

const mockHealthFactors: HealthFactor[] = [
  { name: 'Portfolio Diversity', score: 85, weight: 0.2, status: 'excellent', description: 'Good asset allocation across sectors' },
  { name: 'Investment Regularity', score: 72, weight: 0.15, status: 'good', description: 'Consistent SIP contributions' },
  { name: 'KYC Status', score: 100, weight: 0.15, status: 'excellent', description: 'All KYC documents verified' },
  { name: 'Goal Progress', score: 58, weight: 0.2, status: 'warning', description: 'Below target for retirement goal' },
  { name: 'Risk Alignment', score: 90, weight: 0.15, status: 'excellent', description: 'Portfolio matches risk profile' },
  { name: 'Engagement Level', score: 45, weight: 0.15, status: 'critical', description: 'No login in 30+ days' },
];

export function ClientHealthScore({ clientId, clientName = 'Client' }: ClientHealthScoreProps) {
  const overallScore = useMemo(() => {
    return Math.round(
      mockHealthFactors.reduce((sum, factor) => sum + factor.score * factor.weight, 0)
    );
  }, []);

  const getScoreColor = (score: number) => {
    if (score >= 80) return 'text-green-600 dark:text-green-400';
    if (score >= 60) return 'text-yellow-600 dark:text-yellow-400';
    if (score >= 40) return 'text-orange-600 dark:text-orange-400';
    return 'text-red-600 dark:text-red-400';
  };

  const getScoreBackground = (score: number) => {
    if (score >= 80) return 'bg-green-500';
    if (score >= 60) return 'bg-yellow-500';
    if (score >= 40) return 'bg-orange-500';
    return 'bg-red-500';
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'excellent': return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200';
      case 'good': return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200';
      case 'warning': return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200';
      case 'critical': return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200';
      default: return 'bg-muted text-foreground';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'excellent': return <CheckCircle2 className="h-4 w-4 text-green-600" />;
      case 'good': return <TrendingUp className="h-4 w-4 text-blue-600" />;
      case 'warning': return <AlertTriangle className="h-4 w-4 text-yellow-600" />;
      case 'critical': return <TrendingDown className="h-4 w-4 text-red-600" />;
      default: return null;
    }
  };

  const getOverallStatus = (score: number) => {
    if (score >= 80) return { label: 'Excellent', color: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' };
    if (score >= 60) return { label: 'Good', color: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200' };
    if (score >= 40) return { label: 'Needs Attention', color: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200' };
    return { label: 'Critical', color: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200' };
  };

  const status = getOverallStatus(overallScore);
  const criticalFactors = mockHealthFactors.filter(f => f.status === 'critical' || f.status === 'warning');

  return (
    <Card data-testid="client-health-score-widget">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-pink-100 dark:bg-pink-900 rounded-full">
              <Heart className="h-5 w-5 text-pink-600 dark:text-pink-400" />
            </div>
            <div>
              <CardTitle className="text-lg">Health Score</CardTitle>
              <CardDescription>{clientName}'s financial wellness</CardDescription>
            </div>
          </div>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger>
                <Info className="h-4 w-4 text-muted-foreground" />
              </TooltipTrigger>
              <TooltipContent className="max-w-xs">
                <p>Health Score measures overall client engagement, portfolio health, and goal progress. Higher scores indicate better financial wellness.</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-center gap-6 py-4">
          <div className="relative">
            <svg className="w-24 h-24 transform -rotate-90">
              <circle
                cx="48"
                cy="48"
                r="40"
                stroke="currentColor"
                strokeWidth="8"
                fill="none"
                className="text-muted-foreground"
              />
              <circle
                cx="48"
                cy="48"
                r="40"
                stroke="currentColor"
                strokeWidth="8"
                fill="none"
                strokeDasharray={`${(overallScore / 100) * 251.2} 251.2`}
                className={getScoreColor(overallScore)}
              />
            </svg>
            <div className="absolute inset-0 flex items-center justify-center">
              <span className={`text-2xl font-bold ${getScoreColor(overallScore)}`}>
                {overallScore}
              </span>
            </div>
          </div>
          <div className="text-center">
            <Badge className={`text-lg px-3 py-1 ${status.color}`}>
              {status.label}
            </Badge>
            <p className="text-sm text-muted-foreground mt-2">Overall Score</p>
          </div>
        </div>

        {criticalFactors.length > 0 && (
          <div className="p-3 bg-orange-50 dark:bg-orange-950 rounded-lg border border-orange-200 dark:border-orange-800">
            <p className="text-sm font-medium text-orange-800 dark:text-orange-200 flex items-center gap-2">
              <AlertTriangle className="h-4 w-4" />
              {criticalFactors.length} factor(s) need attention
            </p>
            <ul className="mt-2 space-y-1">
              {criticalFactors.map((factor, idx) => (
                <li key={idx} className="text-sm text-orange-700 dark:text-orange-300">
                  • {factor.name}: {factor.description}
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="space-y-3">
          {mockHealthFactors.map((factor, idx) => (
            <div key={idx} className="space-y-1">
              <div className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-2">
                  {getStatusIcon(factor.status)}
                  <span className="font-medium">{factor.name}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className={getScoreColor(factor.score)}>{factor.score}</span>
                  <Badge variant="outline" className={getStatusColor(factor.status)}>
                    {factor.status}
                  </Badge>
                </div>
              </div>
              <Progress 
                value={factor.score} 
                className="h-1.5"
              />
            </div>
          ))}
        </div>

        <div className="pt-2 border-t text-center">
          <p className="text-xs text-muted-foreground flex items-center justify-center gap-1">
            <Clock className="h-3 w-3" />
            Last updated: Today at 10:30 AM
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
