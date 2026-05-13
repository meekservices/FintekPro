import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { 
  Leaf, 
  Users, 
  LucideShield as LucideShield, 
  TrendingUp, 
  Info,
  Award,
  AlertTriangle
} from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

interface ESGScores {
  environmental: number;
  social: number;
  governance: number;
  overall: number;
}

interface HoldingESG {
  symbol: string;
  name: string;
  allocation: number;
  scores: ESGScores;
  controversies: number;
  rating: 'AAA' | 'AA' | 'A' | 'BBB' | 'BB' | 'B' | 'CCC';
}

interface ESGScoreWidgetProps {
  portfolioId?: string;
}

const mockHoldingsESG: HoldingESG[] = [
  { 
    symbol: 'HDFCBANK', 
    name: 'HDFC Bank', 
    allocation: 20, 
    scores: { environmental: 65, social: 78, governance: 85, overall: 76 },
    controversies: 0,
    rating: 'AA'
  },
  { 
    symbol: 'INFY', 
    name: 'Infosys', 
    allocation: 18, 
    scores: { environmental: 82, social: 88, governance: 90, overall: 87 },
    controversies: 0,
    rating: 'AAA'
  },
  { 
    symbol: 'RELIANCE', 
    name: 'Reliance Industries', 
    allocation: 15, 
    scores: { environmental: 45, social: 60, governance: 72, overall: 59 },
    controversies: 2,
    rating: 'BBB'
  },
  { 
    symbol: 'TCS', 
    name: 'TCS', 
    allocation: 14, 
    scores: { environmental: 78, social: 85, governance: 88, overall: 84 },
    controversies: 0,
    rating: 'AAA'
  },
  { 
    symbol: 'TATAMOTORS', 
    name: 'Tata Motors', 
    allocation: 10, 
    scores: { environmental: 55, social: 70, governance: 75, overall: 67 },
    controversies: 1,
    rating: 'A'
  }
];

export function ESGScoreWidget({ portfolioId }: ESGScoreWidgetProps) {
  const portfolioESG = useMemo(() => {
    const totalAllocation = mockHoldingsESG.reduce((sum, h) => sum + h.allocation, 0);
    const weightedScores = mockHoldingsESG.reduce((acc, holding) => {
      const weight = holding.allocation / totalAllocation;
      return {
        environmental: acc.environmental + holding.scores.environmental * weight,
        social: acc.social + holding.scores.social * weight,
        governance: acc.governance + holding.scores.governance * weight,
        overall: acc.overall + holding.scores.overall * weight
      };
    }, { environmental: 0, social: 0, governance: 0, overall: 0 });
    
    return {
      scores: weightedScores,
      totalControversies: mockHoldingsESG.reduce((sum, h) => sum + h.controversies, 0)
    };
  }, []);

  const getScoreColor = (score: number) => {
    if (score >= 80) return 'text-green-600 dark:text-green-400';
    if (score >= 60) return 'text-yellow-600 dark:text-yellow-400';
    return 'text-red-600 dark:text-red-400';
  };

  const getScoreBackground = (score: number) => {
    if (score >= 80) return 'bg-green-500';
    if (score >= 60) return 'bg-yellow-500';
    return 'bg-red-500';
  };

  const getRatingColor = (rating: string) => {
    switch (rating) {
      case 'AAA':
      case 'AA':
        return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200';
      case 'A':
      case 'BBB':
        return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200';
      default:
        return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200';
    }
  };

  const getOverallRating = (score: number): string => {
    if (score >= 85) return 'AAA';
    if (score >= 75) return 'AA';
    if (score >= 65) return 'A';
    if (score >= 55) return 'BBB';
    if (score >= 45) return 'BB';
    if (score >= 35) return 'B';
    return 'CCC';
  };

  return (
    <Card data-testid="esg-score-widget">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-green-100 dark:bg-green-900 rounded-full">
              <Leaf className="h-5 w-5 text-green-600 dark:text-green-400" />
            </div>
            <div>
              <CardTitle className="text-lg">ESG Score</CardTitle>
              <CardDescription>Sustainability & governance rating</CardDescription>
            </div>
          </div>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger>
                <Info className="h-4 w-4 text-muted-foreground" />
              </TooltipTrigger>
              <TooltipContent className="max-w-xs">
                <p>ESG scores measure Environmental, Social, and Governance factors. Higher scores indicate more sustainable and responsible investments.</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-center gap-6 py-4">
          <div className="text-center">
            <div className={`text-4xl font-bold ${getScoreColor(portfolioESG.scores.overall)}`}>
              {Math.round(portfolioESG.scores.overall)}
            </div>
            <p className="text-sm text-muted-foreground">Overall Score</p>
          </div>
          <div className="flex flex-col items-center">
            <Badge className={`text-lg px-3 py-1 ${getRatingColor(getOverallRating(portfolioESG.scores.overall))}`}>
              {getOverallRating(portfolioESG.scores.overall)}
            </Badge>
            <p className="text-xs text-muted-foreground mt-1">Rating</p>
          </div>
        </div>

        <div className="space-y-3">
          <div className="flex items-center gap-3">
            <div className="p-1.5 bg-green-100 dark:bg-green-900 rounded">
              <Leaf className="h-4 w-4 text-green-600 dark:text-green-400" />
            </div>
            <div className="flex-1">
              <div className="flex items-center justify-between mb-1">
                <span className="text-sm font-medium">Environmental</span>
                <span className={`text-sm font-bold ${getScoreColor(portfolioESG.scores.environmental)}`}>
                  {Math.round(portfolioESG.scores.environmental)}
                </span>
              </div>
              <Progress 
                value={portfolioESG.scores.environmental} 
                className="h-2"
              />
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="p-1.5 bg-blue-100 dark:bg-blue-900 rounded">
              <Users className="h-4 w-4 text-blue-600 dark:text-blue-400" />
            </div>
            <div className="flex-1">
              <div className="flex items-center justify-between mb-1">
                <span className="text-sm font-medium">Social</span>
                <span className={`text-sm font-bold ${getScoreColor(portfolioESG.scores.social)}`}>
                  {Math.round(portfolioESG.scores.social)}
                </span>
              </div>
              <Progress 
                value={portfolioESG.scores.social} 
                className="h-2"
              />
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="p-1.5 bg-purple-100 dark:bg-purple-900 rounded">
              <LucideShield className="h-4 w-4 text-purple-600 dark:text-purple-400" />
            </div>
            <div className="flex-1">
              <div className="flex items-center justify-between mb-1">
                <span className="text-sm font-medium">Governance</span>
                <span className={`text-sm font-bold ${getScoreColor(portfolioESG.scores.governance)}`}>
                  {Math.round(portfolioESG.scores.governance)}
                </span>
              </div>
              <Progress 
                value={portfolioESG.scores.governance} 
                className="h-2"
              />
            </div>
          </div>
        </div>

        {portfolioESG.totalControversies > 0 && (
          <div className="flex items-center gap-2 p-3 bg-orange-50 dark:bg-orange-950 rounded-lg">
            <AlertTriangle className="h-4 w-4 text-orange-600" />
            <span className="text-sm text-orange-700 dark:text-orange-300">
              {portfolioESG.totalControversies} holding(s) have ESG controversies
            </span>
          </div>
        )}

        <div className="pt-2 border-t">
          <p className="text-sm font-medium mb-2">Top ESG Holdings</p>
          <div className="space-y-2">
            {mockHoldingsESG
              .sort((a, b) => b.scores.overall - a.scores.overall)
              .slice(0, 3)
              .map(holding => (
                <div key={holding.symbol} className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2">
                    <Award className={`h-4 w-4 ${getScoreColor(holding.scores.overall)}`} />
                    <span>{holding.symbol}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={getScoreColor(holding.scores.overall)}>
                      {holding.scores.overall}
                    </span>
                    <Badge variant="outline" className={getRatingColor(holding.rating)}>
                      {holding.rating}
                    </Badge>
                  </div>
                </div>
              ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
