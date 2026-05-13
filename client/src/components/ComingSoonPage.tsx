import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Clock, Bell, ArrowLeft, Sparkles, Shield as LucideShield, TrendingUp, Building2 } from "lucide-react";
import { Link } from "wouter";

interface ComingSoonPageProps {
  categoryName: string;
  message?: string;
  expectedLaunchDate?: string;
  features?: string[];
  onNotifyMe?: () => void;
}

export function ComingSoonPage({ 
  categoryName, 
  message, 
  expectedLaunchDate,
  features = [],
  onNotifyMe
}: ComingSoonPageProps) {
  const defaultMessage = `${categoryName} marketplace is currently under development. We're building a secure, compliant, and feature-rich platform for you.`;
  
  const defaultFeatures = [
    "SEBI/RBI Compliant Trading",
    "Real-time Market Data",
    "Secure Transactions",
    "Expert Advisory Support"
  ];
  
  const displayFeatures = features.length > 0 ? features : defaultFeatures;
  
  return (
    <div className="min-h-screen bg-gradient-to-br from-background to-muted p-6">
      <div className="max-w-3xl mx-auto space-y-6">
        <div className="flex items-center gap-4">
          <Link href="/store">
            <Button variant="ghost" size="sm" data-testid="link-back-store">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Store
            </Button>
          </Link>
        </div>
        
        <Card className="border-0 shadow-xl bg-card/80/80 backdrop-blur-sm" data-testid="card-coming-soon">
          <CardHeader className="text-center pb-4">
            <div className="mx-auto w-20 h-20 bg-gradient-to-br from-finance-blue/20 to-finance-blue/5 rounded-full flex items-center justify-center mb-4">
              <Clock className="h-10 w-10 text-finance-blue animate-pulse" />
            </div>
            <CardTitle className="text-3xl font-bold text-foreground">
              {categoryName}
            </CardTitle>
            <Badge variant="outline" className="mx-auto text-orange-600 border-orange-300 bg-orange-50 dark:bg-orange-900/20 mt-2">
              <Sparkles className="h-3 w-3 mr-1" />
              Coming Soon
            </Badge>
            <CardDescription className="text-lg mt-4 max-w-md mx-auto">
              {message || defaultMessage}
            </CardDescription>
          </CardHeader>
          
          <CardContent className="space-y-8">
            {expectedLaunchDate && (
              <div className="text-center p-4 bg-finance-blue/5 rounded-xl border border-finance-blue/20">
                <p className="text-sm text-muted-foreground mb-1">Expected Launch</p>
                <p className="text-xl font-bold text-finance-blue">{expectedLaunchDate}</p>
              </div>
            )}
            
            <div className="space-y-4">
              <h3 className="font-semibold text-foreground text-center">
                What to Expect
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {displayFeatures.map((feature, index) => (
                  <div
                    key={index}
                    className="flex items-center gap-3 p-3 bg-muted rounded-lg"
                    data-testid={`feature-item-${index}`}
                  >
                    {index === 0 && <LucideShield className="h-5 w-5 text-green-600" />}
                    {index === 1 && <TrendingUp className="h-5 w-5 text-blue-600" />}
                    {index === 2 && <Building2 className="h-5 w-5 text-purple-600" />}
                    {index >= 3 && <Sparkles className="h-5 w-5 text-orange-600" />}
                    <span className="text-sm font-medium text-muted-foreground">
                      {feature}
                    </span>
                  </div>
                ))}
              </div>
            </div>
            
            {onNotifyMe && (
              <div className="text-center pt-4">
                <Button
                  onClick={onNotifyMe}
                  className="bg-finance-blue hover:bg-finance-blue/90"
                  data-testid="button-notify-me"
                >
                  <Bell className="h-4 w-4 mr-2" />
                  Notify Me When Available
                </Button>
                <p className="text-xs text-muted-foreground mt-2">
                  We'll send you an email when this category is available
                </p>
              </div>
            )}
            
            <div className="text-center text-sm text-muted-foreground pt-4 border-t border-border">
              <p>Have questions? Contact our support team for more information.</p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

export default ComingSoonPage;
