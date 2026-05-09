import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { 
  Mail, 
  Calendar, 
  TrendingUp, 
  Eye, 
  Download,
  Clock,
  ArrowRight
} from "lucide-react";

export function MarketNewsletter() {
  const [email, setEmail] = useState("");
  const [isSubscribed, setIsSubscribed] = useState(false);

  const handleSubscribe = () => {
    if (email) {
      setIsSubscribed(true);
      setEmail("");
    }
  };

  const newsletters = [
    {
      id: 1,
      title: "Weekly Wrap: Markets Rally on Strong Q3 Results",
      date: "January 15, 2025",
      preview: "Sensex crosses 77K milestone as IT and banking sectors lead the charge. Key highlights include...",
      readTime: "2 min read",
      type: "weekly",
      status: "latest"
    },
    {
      id: 2,
      title: "Money Order: Budget 2025 Expectations & Market Impact",
      date: "January 8, 2025", 
      preview: "What to expect from Budget 2025 and how it might affect your investments...",
      readTime: "3 min read",
      type: "special",
      status: "popular"
    },
    {
      id: 3,
      title: "Weekly Market Digest: New Year, New Opportunities",
      date: "January 1, 2025",
      preview: "A look ahead at 2025 market trends and investment themes to watch...",
      readTime: "2 min read",
      type: "weekly",
      status: "archived"
    }
  ];

  return (
    <div className="space-y-6">
      {/* Newsletter Subscription */}
      <Card data-testid="card-newsletter-subscription">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Mail className="w-5 h-5 text-primary" />
            Money Order Newsletter
          </CardTitle>
          <p className="text-muted-foreground">
            Catch up on the entire week's news in two minutes. Read our newsletter.
          </p>
        </CardHeader>
        <CardContent>
          {!isSubscribed ? (
            <div className="flex gap-3">
              <Input
                type="email"
                placeholder="Enter your email address"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="flex-1"
                data-testid="input-newsletter-email"
              />
              <Button 
                onClick={handleSubscribe}
                data-testid="button-subscribe-newsletter"
              >
                Subscribe Now
              </Button>
            </div>
          ) : (
            <div className="text-center py-4">
              <div className="w-16 h-16 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center mx-auto mb-3">
                <Mail className="w-8 h-8 text-green-600" />
              </div>
              <h3 className="font-semibold text-lg mb-2">Successfully Subscribed!</h3>
              <p className="text-muted-foreground">
                You'll receive our weekly market updates every Monday morning.
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Newsletter Archive */}
      <Card data-testid="card-newsletter-archive">
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span className="flex items-center gap-2">
              <Calendar className="w-5 h-5 text-primary" />
              Newsletter Archive
            </span>
            <Badge variant="outline">
              {newsletters.length} editions
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {newsletters.map((newsletter) => (
              <div
                key={newsletter.id}
                className="border rounded-lg p-4 hover:bg-accent/50 transition-colors cursor-pointer"
                data-testid={`newsletter-item-${newsletter.id}`}
              >
                <div className="flex items-start justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <Badge 
                      variant={newsletter.type === 'weekly' ? 'default' : 'secondary'}
                      className="text-xs"
                    >
                      {newsletter.type === 'weekly' ? 'Weekly' : 'Special'}
                    </Badge>
                    {newsletter.status === 'latest' && (
                      <Badge className="bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-200 text-xs">
                        Latest
                      </Badge>
                    )}
                    {newsletter.status === 'popular' && (
                      <Badge className="bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-200 text-xs">
                        Popular
                      </Badge>
                    )}
                  </div>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Clock className="w-3 h-3" />
                    {newsletter.readTime}
                  </div>
                </div>
                
                <h3 className="font-semibold text-lg mb-2 hover:text-primary transition-colors">
                  {newsletter.title}
                </h3>
                
                <p className="text-muted-foreground mb-3 line-clamp-2">
                  {newsletter.preview}
                </p>
                
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1 text-sm text-muted-foreground">
                    <Calendar className="w-3 h-3" />
                    {newsletter.date}
                  </div>
                  
                  <div className="flex gap-2">
                    <Button 
                      size="sm" 
                      variant="outline"
                      data-testid={`button-view-newsletter-${newsletter.id}`}
                    >
                      <Eye className="w-3 h-3 mr-1" />
                      Read
                    </Button>
                    <Button 
                      size="sm" 
                      variant="outline"
                      data-testid={`button-download-newsletter-${newsletter.id}`}
                    >
                      <Download className="w-3 h-3 mr-1" />
                      PDF
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
          
          <div className="flex justify-center mt-6">
            <Button variant="outline" data-testid="button-load-more-newsletters">
              Load More Newsletters
              <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Newsletter Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card data-testid="card-newsletter-stats-1">
          <CardContent className="p-4 text-center">
            <TrendingUp className="w-8 h-8 mx-auto mb-2 text-blue-600" />
            <div className="font-bold text-2xl">25K+</div>
            <div className="text-sm text-muted-foreground">Subscribers</div>
          </CardContent>
        </Card>
        
        <Card data-testid="card-newsletter-stats-2">
          <CardContent className="p-4 text-center">
            <Mail className="w-8 h-8 mx-auto mb-2 text-green-600" />
            <div className="font-bold text-2xl">156</div>
            <div className="text-sm text-muted-foreground">Editions Published</div>
          </CardContent>
        </Card>
        
        <Card data-testid="card-newsletter-stats-3">
          <CardContent className="p-4 text-center">
            <Eye className="w-8 h-8 mx-auto mb-2 text-purple-600" />
            <div className="font-bold text-2xl">89%</div>
            <div className="text-sm text-muted-foreground">Open Rate</div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}