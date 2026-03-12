import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { 
  BookOpen, 
  TrendingUp, 
  FileCheck, 
  Lightbulb, 
  Shield, 
  Clock,
  ArrowRight,
  AlertTriangle,
  ChevronRight,
  BarChart3,
  RefreshCw,
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { format } from "date-fns";

interface DashboardStats {
  hasTodaysBrief: boolean;
  todaysBrief: {
    id: string;
    date: string;
    region: string;
    marketSnapshot: string;
    whatChanged: string;
    keyRisks?: string;
    publishedAt?: string;
  } | null;
  productCardsCount: number;
  explanationTemplatesCount: number;
  certificationsCount: number;
  assetInsightsCount: number;
}

interface Disclaimer {
  id: string;
  content: string;
  shortContent?: string;
  version: number;
}

export default function AgentKnowledgeHub() {
  const { data: stats, isLoading: statsLoading } = useQuery<DashboardStats>({
    queryKey: ["/api/knowledge-hub/dashboard"],
  });

  const { data: disclaimer } = useQuery<Disclaimer>({
    queryKey: ["/api/knowledge-hub/disclaimers/active/general"],
  });

  const quickLinks = [
    {
      title: "Today's Market Brief",
      description: "AI-generated daily market intelligence",
      icon: TrendingUp,
      href: "/agent/knowledge-hub/market-brief",
      color: "text-blue-500",
      bgColor: "bg-blue-500/10",
    },
    {
      title: "Product Knowledge Cards",
      description: "Comprehensive product information",
      icon: FileCheck,
      href: "/agent/knowledge-hub/products",
      color: "text-emerald-500",
      bgColor: "bg-emerald-500/10",
    },
    {
      title: "Client Explanations",
      description: "Ready-to-use explanation templates",
      icon: Lightbulb,
      href: "/agent/knowledge-hub/explanations",
      color: "text-amber-500",
      bgColor: "bg-amber-500/10",
    },
    {
      title: "My Certifications",
      description: "Track your certifications",
      icon: Shield,
      href: "/agent/knowledge-hub/certifications",
      color: "text-purple-500",
      bgColor: "bg-purple-500/10",
    },
  ];

  const assetClasses = [
    { name: "Mutual Funds", icon: "📊" },
    { name: "Stocks", icon: "📈" },
    { name: "Bonds & NCDs", icon: "🏛️" },
    { name: "Global ETFs", icon: "🌍" },
    { name: "AIF/PMS", icon: "💎" },
  ];

  if (statsLoading) {
    return (
      <div className="p-6 space-y-6">
        <Skeleton className="h-10 w-64 bg-card" />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-32 bg-card" />
          ))}
        </div>
        <Skeleton className="h-64 bg-card" />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <BookOpen className="h-7 w-7 text-emerald-500" />
            Agent Knowledge Hub
          </h1>
          <p className="text-muted-foreground mt-1">
            Market intelligence, product knowledge, and client communication tools
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="border-emerald-500/50 text-emerald-400">
            <Clock className="h-3 w-3 mr-1" />
            Updated {format(new Date(), "MMM d, HH:mm")}
          </Badge>
        </div>
      </div>

      {disclaimer && (
        <Alert className="bg-amber-500/10 border-amber-500/30">
          <AlertTriangle className="h-4 w-4 text-amber-500" />
          <AlertTitle className="text-amber-400">Disclaimer</AlertTitle>
          <AlertDescription className="text-amber-200/80 text-sm">
            {disclaimer.shortContent || disclaimer.content}
          </AlertDescription>
        </Alert>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {quickLinks.map((link) => (
          <Link key={link.href} href={link.href}>
            <Card className="bg-background border-border hover:border-border transition-colors cursor-pointer h-full" data-testid={`card-${link.title.toLowerCase().replace(/\s+/g, '-')}`}>
              <CardContent className="p-4">
                <div className={`w-10 h-10 rounded-lg ${link.bgColor} flex items-center justify-center mb-3`}>
                  <link.icon className={`h-5 w-5 ${link.color}`} />
                </div>
                <h3 className="font-semibold text-foreground mb-1">{link.title}</h3>
                <p className="text-sm text-muted-foreground">{link.description}</p>
                <div className="flex items-center mt-3 text-sm text-emerald-400">
                  <span>View</span>
                  <ChevronRight className="h-4 w-4 ml-1" />
                </div>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>

      {stats?.hasTodaysBrief && stats.todaysBrief && (
        <Card className="bg-background border-border">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-foreground flex items-center gap-2">
                <TrendingUp className="h-5 w-5 text-blue-500" />
                Today's Market Brief
              </CardTitle>
              <Badge className="bg-blue-500/20 text-blue-400 border-0">
                {stats.todaysBrief.region.toUpperCase()}
              </Badge>
            </div>
            <CardDescription className="text-muted-foreground">
              {format(new Date(stats.todaysBrief.date), "EEEE, MMMM d, yyyy")}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div>
                <h4 className="text-sm font-medium text-muted-foreground mb-2">Market Snapshot</h4>
                <p className="text-muted-foreground text-sm line-clamp-3">
                  {stats.todaysBrief.marketSnapshot}
                </p>
              </div>
              <div>
                <h4 className="text-sm font-medium text-muted-foreground mb-2">What Changed</h4>
                <p className="text-muted-foreground text-sm line-clamp-2">
                  {stats.todaysBrief.whatChanged}
                </p>
              </div>
              {stats.todaysBrief.keyRisks && (
                <div className="p-3 bg-red-500/10 rounded-lg border border-red-500/20">
                  <h4 className="text-sm font-medium text-red-400 mb-1">Key Risks</h4>
                  <p className="text-muted-foreground text-sm">{stats.todaysBrief.keyRisks}</p>
                </div>
              )}
              <Link href="/agent/knowledge-hub/market-brief">
                <Button variant="outline" className="w-full border-border hover:bg-card">
                  Read Full Brief
                  <ArrowRight className="h-4 w-4 ml-2" />
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      )}

      {!stats?.hasTodaysBrief && (
        <Card className="bg-background border-border">
          <CardContent className="p-6 text-center">
            <RefreshCw className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
            <h3 className="text-lg font-medium text-foreground mb-2">Market Brief Not Available</h3>
            <p className="text-muted-foreground text-sm mb-4">
              Today's market brief hasn't been published yet. Check back later.
            </p>
            <Link href="/agent/knowledge-hub/market-brief">
              <Button variant="outline" className="border-border">
                View Previous Briefs
              </Button>
            </Link>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="bg-background border-border">
          <CardHeader>
            <CardTitle className="text-foreground flex items-center gap-2">
              <BarChart3 className="h-5 w-5 text-emerald-500" />
              Asset Class Insights
            </CardTitle>
            <CardDescription className="text-muted-foreground">
              Explore insights by asset class
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {assetClasses.map((asset) => (
                <Link key={asset.name} href={`/agent/knowledge-hub/products?assetClass=${encodeURIComponent(asset.name.toLowerCase().replace(/\s+/g, '_'))}`}>
                  <div className="flex items-center justify-between p-3 rounded-lg bg-card/50 hover:bg-card cursor-pointer transition-colors" data-testid={`asset-${asset.name.toLowerCase().replace(/\s+/g, '-')}`}>
                    <div className="flex items-center gap-3">
                      <span className="text-xl">{asset.icon}</span>
                      <span className="text-foreground font-medium">{asset.name}</span>
                    </div>
                    <ChevronRight className="h-4 w-4 text-muted-foreground" />
                  </div>
                </Link>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card className="bg-background border-border">
          <CardHeader>
            <CardTitle className="text-foreground flex items-center gap-2">
              <Shield className="h-5 w-5 text-purple-500" />
              Your Knowledge Stats
            </CardTitle>
            <CardDescription className="text-muted-foreground">
              Track your learning progress
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4">
              <div className="p-4 rounded-lg bg-card/50 text-center">
                <p className="text-3xl font-bold text-foreground">{stats?.productCardsCount || 0}</p>
                <p className="text-sm text-muted-foreground">Product Cards</p>
              </div>
              <div className="p-4 rounded-lg bg-card/50 text-center">
                <p className="text-3xl font-bold text-foreground">{stats?.explanationTemplatesCount || 0}</p>
                <p className="text-sm text-muted-foreground">Templates</p>
              </div>
              <div className="p-4 rounded-lg bg-card/50 text-center">
                <p className="text-3xl font-bold text-foreground">{stats?.certificationsCount || 0}</p>
                <p className="text-sm text-muted-foreground">Certifications</p>
              </div>
              <div className="p-4 rounded-lg bg-card/50 text-center">
                <p className="text-3xl font-bold text-foreground">{stats?.assetInsightsCount || 0}</p>
                <p className="text-sm text-muted-foreground">Insights</p>
              </div>
            </div>
            <div className="mt-4 pt-4 border-t border-border">
              <Link href="/agent/knowledge-hub/certifications">
                <Button variant="outline" className="w-full border-border hover:bg-card">
                  Manage Certifications
                  <ArrowRight className="h-4 w-4 ml-2" />
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>

      {disclaimer && (
        <div className="text-xs text-muted-foreground text-center p-4 border-t border-border">
          <p>{disclaimer.content}</p>
          <p className="mt-1">Disclaimer Version: v{disclaimer.version}</p>
        </div>
      )}
    </div>
  );
}
