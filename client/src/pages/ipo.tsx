import { Header } from "@/components/layout/header";
import { Footer } from "@/components/layout/footer";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Calendar, TrendingUp, Clock, DollarSign, Building2, FileText, ExternalLink, Bell, BookOpen, Newspaper } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import type { IpoCompany, IpoNews } from "@shared/schema";

export default function IPO() {
  const { data: upcomingIpos = [], isLoading: upcomingLoading } = useQuery({
    queryKey: ['/api/ipos', 'upcoming'],
    queryFn: () => fetch('/api/ipos?status=upcoming').then(res => res.json()),
  });

  const { data: ongoingIpos = [], isLoading: ongoingLoading } = useQuery({
    queryKey: ['/api/ipos', 'ongoing'],
    queryFn: () => fetch('/api/ipos?status=ongoing').then(res => res.json()),
  });

  const { data: listedIpos = [], isLoading: listedLoading } = useQuery({
    queryKey: ['/api/ipos', 'listed'],
    queryFn: () => fetch('/api/ipos?status=listed').then(res => res.json()),
  });

  const { data: ipoNews = [], isLoading: newsLoading } = useQuery({
    queryKey: ['/api/ipo-news'],
    queryFn: () => fetch('/api/ipo-news').then(res => res.json()),
  });

  const formatCurrency = (amount: number | null | undefined) => {
    if (!amount) return 'Not Issued';
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    }).format(amount);
  };

  const formatDate = (date: string | null | undefined) => {
    if (!date) return 'Not Issued';
    return format(new Date(date), 'dd MMM yyyy');
  };

  const formatReturn = (returnPercent: number | null | undefined) => {
    if (returnPercent === null || returnPercent === undefined) return 'N/A';
    const isPositive = returnPercent >= 0;
    return (
      <span className={isPositive ? 'text-green-600' : 'text-red-600'}>
        {isPositive ? '+' : ''}{returnPercent.toFixed(2)}%
      </span>
    );
  };

  const renderIpoCard = (ipo: IpoCompany, showPerformance = false) => (
    <Card key={ipo.id} className="hover:shadow-md transition-shadow" data-testid={`ipo-card-${ipo.id}`}>
      <CardHeader>
        <div className="flex justify-between items-start">
          <div className="flex items-start space-x-3">
            {ipo.logoUrl && (
              <img 
                src={ipo.logoUrl} 
                alt={ipo.companyName}
                className="w-12 h-12 rounded-lg object-cover"
                data-testid="ipo-logo"
              />
            )}
            <div>
              <CardTitle className="text-lg" data-testid="ipo-company-name">{ipo.companyName}</CardTitle>
              <p className="text-sm text-gray-600" data-testid="ipo-sector">{ipo.sector}</p>
            </div>
          </div>
          <Badge 
            variant={ipo.status === 'ongoing' ? 'default' : ipo.status === 'listed' ? 'secondary' : 'outline'}
            data-testid="ipo-status-badge"
          >
            {ipo.status === 'upcoming' ? 'Upcoming' : ipo.status === 'ongoing' ? 'Live' : 'Listed'}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <p className="text-gray-600">Price Band</p>
            <p className="font-semibold" data-testid="ipo-price-band">
              {ipo.priceBandMin && ipo.priceBandMax 
                ? `${formatCurrency(Number(ipo.priceBandMin))} - ${formatCurrency(Number(ipo.priceBandMax))}`
                : 'Not Issued'
              }
            </p>
          </div>
          <div>
            <p className="text-gray-600">Issue Size</p>
            <p className="font-semibold" data-testid="ipo-issue-size">
              {ipo.issueSize ? `₹${Number(ipo.issueSize).toLocaleString()} Cr` : 'Not Issued'}
            </p>
          </div>
          <div>
            <p className="text-gray-600">{showPerformance ? 'Listing Date' : 'Open Date'}</p>
            <p className="font-semibold" data-testid="ipo-open-date">
              {showPerformance ? formatDate(ipo.listingDate) : formatDate(ipo.openDate)}
            </p>
          </div>
          <div>
            <p className="text-gray-600">{showPerformance ? 'Issue Type' : 'Close Date'}</p>
            <p className="font-semibold" data-testid="ipo-close-date">
              {showPerformance ? (ipo.issueType || 'Book Built') : formatDate(ipo.closeDate)}
            </p>
          </div>
          {showPerformance && (
            <>
              <div>
                <p className="text-gray-600">Listing Gain</p>
                <p className="font-semibold" data-testid="ipo-listing-gain">
                  {formatReturn(Number(ipo.listingGainPercent))}
                </p>
              </div>
              <div>
                <p className="text-gray-600">Current Return</p>
                <p className="font-semibold" data-testid="ipo-current-return">
                  {formatReturn(Number(ipo.currentReturnPercent))}
                </p>
              </div>
            </>
          )}
        </div>
        <div className="flex gap-2">
          {ipo.rhpUrl && (
            <Button variant="outline" size="sm" className="flex-1" asChild data-testid="ipo-rhp-link">
              <a href={ipo.rhpUrl} target="_blank" rel="noopener noreferrer">
                <FileText className="h-4 w-4 mr-2" />
                RHP
                <ExternalLink className="h-3 w-3 ml-1" />
              </a>
            </Button>
          )}
          {ipo.drhpUrl && (
            <Button variant="outline" size="sm" className="flex-1" asChild data-testid="ipo-drhp-link">
              <a href={ipo.drhpUrl} target="_blank" rel="noopener noreferrer">
                <FileText className="h-4 w-4 mr-2" />
                DRHP
                <ExternalLink className="h-3 w-3 ml-1" />
              </a>
            </Button>
          )}
          {ipo.status === 'upcoming' && (
            <Button size="sm" className="flex-1 bg-finance-blue hover:bg-blue-700" data-testid="ipo-set-reminder">
              <Bell className="h-4 w-4 mr-2" />
              Set Reminder
            </Button>
          )}
          {ipo.status === 'ongoing' && (
            <Button size="sm" className="flex-1 bg-green-600 hover:bg-green-700" data-testid="ipo-apply">
              Apply Now
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );

  return (
    <div className="min-h-screen bg-finance-light" data-testid="ipo-page">
      <Header />
      
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 pt-24">
        
        {/* Page Header */}
        <div className="mb-8" data-testid="ipo-header">
          <h1 className="text-3xl font-bold text-gray-900 mb-4">IPO Center</h1>
          <p className="text-gray-600 text-lg">
            Apply for upcoming IPOs and track your applications
          </p>
        </div>

        <Tabs defaultValue="upcoming" className="space-y-8">
          <TabsList className="grid w-full grid-cols-5">
            <TabsTrigger value="upcoming" data-testid="tab-upcoming">Upcoming IPOs</TabsTrigger>
            <TabsTrigger value="ongoing" data-testid="tab-ongoing">Ongoing</TabsTrigger>
            <TabsTrigger value="listed" data-testid="tab-listed">Recently Listed</TabsTrigger>
            <TabsTrigger value="sme" data-testid="tab-sme">SME IPOs</TabsTrigger>
            <TabsTrigger value="applications" data-testid="tab-applications">My Applications</TabsTrigger>
          </TabsList>

          <TabsContent value="upcoming" className="space-y-6" data-testid="upcoming-ipos">
            {upcomingLoading ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {[...Array(6)].map((_, i) => (
                  <Card key={i} className="animate-pulse">
                    <CardContent className="p-6">
                      <div className="h-4 bg-gray-200 rounded mb-2"></div>
                      <div className="h-3 bg-gray-200 rounded mb-4 w-2/3"></div>
                      <div className="space-y-2">
                        <div className="h-3 bg-gray-200 rounded"></div>
                        <div className="h-3 bg-gray-200 rounded w-3/4"></div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : upcomingIpos.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {upcomingIpos.map((ipo: IpoCompany) => renderIpoCard(ipo))}
              </div>
            ) : (
              <Card className="border-dashed border-2 border-gray-300">
                <CardContent className="flex flex-col items-center justify-center py-12">
                  <Building2 className="h-12 w-12 text-gray-400 mb-4" />
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">No Upcoming IPOs</h3>
                  <p className="text-gray-500 text-center">
                    IPO data will be displayed here when available from authorized sources
                  </p>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="ongoing" className="space-y-6" data-testid="ongoing-ipos">
            {ongoingLoading ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {[...Array(3)].map((_, i) => (
                  <Card key={i} className="animate-pulse">
                    <CardContent className="p-6">
                      <div className="h-4 bg-gray-200 rounded mb-2"></div>
                      <div className="h-3 bg-gray-200 rounded mb-4 w-2/3"></div>
                      <div className="space-y-2">
                        <div className="h-3 bg-gray-200 rounded"></div>
                        <div className="h-3 bg-gray-200 rounded w-3/4"></div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : ongoingIpos.length > 0 ? (
              <div className="space-y-6">
                <div className="bg-green-50 border border-green-200 rounded-lg p-4" data-testid="live-ipo-notice">
                  <div className="flex items-center space-x-2">
                    <Clock className="h-5 w-5 text-green-600" />
                    <h3 className="font-semibold text-green-800">Live IPO Applications</h3>
                  </div>
                  <p className="text-green-700 text-sm mt-1">
                    These IPOs are currently accepting applications. Apply before the closing date.
                  </p>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {ongoingIpos.map((ipo: IpoCompany) => renderIpoCard(ipo))}
                </div>
              </div>
            ) : (
              <Card className="border-dashed border-2 border-gray-300">
                <CardContent className="flex flex-col items-center justify-center py-12">
                  <Clock className="h-12 w-12 text-gray-400 mb-4" />
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">No Ongoing IPOs</h3>
                  <p className="text-gray-500 text-center">
                    Currently open IPO applications will be displayed here
                  </p>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="listed" className="space-y-6" data-testid="listed-ipos">
            {listedLoading ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {[...Array(6)].map((_, i) => (
                  <Card key={i} className="animate-pulse">
                    <CardContent className="p-6">
                      <div className="h-4 bg-gray-200 rounded mb-2"></div>
                      <div className="h-3 bg-gray-200 rounded mb-4 w-2/3"></div>
                      <div className="space-y-2">
                        <div className="h-3 bg-gray-200 rounded"></div>
                        <div className="h-3 bg-gray-200 rounded w-3/4"></div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : listedIpos.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {listedIpos.map((ipo: IpoCompany) => renderIpoCard(ipo, true))}
              </div>
            ) : (
              <Card className="border-dashed border-2 border-gray-300">
                <CardContent className="flex flex-col items-center justify-center py-12">
                  <TrendingUp className="h-12 w-12 text-gray-400 mb-4" />
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">No Recent Listings</h3>
                  <p className="text-gray-500 text-center">
                    Recently listed IPO performance will be shown here
                  </p>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="sme" className="space-y-6" data-testid="sme-ipos">
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6" data-testid="sme-info">
              <div className="flex items-center space-x-2">
                <Building2 className="h-5 w-5 text-blue-600" />
                <h3 className="font-semibold text-blue-800">SME IPO Platform</h3>
              </div>
              <p className="text-blue-700 text-sm mt-1">
                Small and Medium Enterprises (SME) IPOs offer investment opportunities in emerging companies with growth potential.
              </p>
            </div>
            <Card className="border-dashed border-2 border-gray-300">
              <CardContent className="flex flex-col items-center justify-center py-12">
                <Building2 className="h-12 w-12 text-gray-400 mb-4" />
                <h3 className="text-lg font-semibold text-gray-900 mb-2">SME IPOs Coming Soon</h3>
                <p className="text-gray-500 text-center">
                  SME IPO listings will be displayed here when available
                </p>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="applications" className="space-y-6" data-testid="my-applications">
            <Card className="border-dashed border-2 border-gray-300">
              <CardContent className="flex flex-col items-center justify-center py-12">
                <FileText className="h-12 w-12 text-gray-400 mb-4" />
                <h3 className="text-lg font-semibold text-gray-900 mb-2">No Applications</h3>
                <p className="text-gray-500 text-center mb-4">
                  Your IPO applications and status will appear here
                </p>
                <Button variant="outline">Apply for an IPO</Button>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* IPO Analysis and News Section */}
        <section className="mt-12 space-y-8" data-testid="ipo-analysis-section">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            
            {/* IPO Analysis */}
            <div>
              <h2 className="text-2xl font-bold text-gray-900 mb-6 flex items-center">
                <BookOpen className="h-6 w-6 mr-2 text-finance-blue" />
                IPO Analysis & Review
              </h2>
              <Card className="hover:shadow-md transition-shadow">
                <CardContent className="p-6">
                  <div className="flex items-start space-x-4">
                    <div className="w-20 h-14 bg-gradient-to-r from-blue-500 to-purple-600 rounded-lg flex items-center justify-center">
                      <BookOpen className="h-8 w-8 text-white" />
                    </div>
                    <div className="flex-1">
                      <h3 className="font-bold text-gray-900 mb-2">Comprehensive IPO Analysis</h3>
                      <p className="text-gray-600 text-sm mb-3">
                        Get detailed analysis including financials, SWOT, business model and investment recommendations for upcoming IPOs.
                      </p>
                      <Button size="sm" className="bg-finance-blue hover:bg-blue-700" data-testid="view-analysis">
                        View IPO Analysis
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* IPO News */}
            <div>
              <h2 className="text-2xl font-bold text-gray-900 mb-6 flex items-center">
                <Newspaper className="h-6 w-6 mr-2 text-finance-blue" />
                Latest IPO News
              </h2>
              <div className="space-y-3">
                {newsLoading ? (
                  [...Array(4)].map((_, i) => (
                    <div key={i} className="animate-pulse p-3 border rounded-lg">
                      <div className="h-4 bg-gray-200 rounded mb-2"></div>
                      <div className="h-3 bg-gray-200 rounded w-1/4"></div>
                    </div>
                  ))
                ) : ipoNews.length > 0 ? (
                  ipoNews.slice(0, 5).map((news: IpoNews) => (
                    <Card key={news.id} className="hover:shadow-sm transition-shadow" data-testid={`news-${news.id}`}>
                      <CardContent className="p-4">
                        <h4 className="font-medium text-gray-900 mb-1 line-clamp-2">{news.title}</h4>
                        <p className="text-xs text-gray-500">{formatDate(news.publishedAt)}</p>
                      </CardContent>
                    </Card>
                  ))
                ) : (
                  <Card className="border-dashed border-2 border-gray-300">
                    <CardContent className="text-center py-8">
                      <Newspaper className="h-8 w-8 text-gray-400 mx-auto mb-2" />
                      <p className="text-gray-500 text-sm">IPO news will appear here</p>
                    </CardContent>
                  </Card>
                )}
              </div>
            </div>
          </div>
        </section>

        {/* Demat Account CTA Section */}
        <section className="mt-12" data-testid="demat-cta-section">
          <Card className="bg-gradient-to-r from-green-50 to-blue-50 border-green-200">
            <CardContent className="p-8 text-center">
              <div className="max-w-2xl mx-auto">
                <h2 className="text-2xl font-bold text-gray-900 mb-4">Ready to Apply for IPOs?</h2>
                <p className="text-gray-600 mb-6">
                  Open your Demat account now to apply for your favorite IPOs. Get access to detailed analysis, 
                  application tracking, and expert recommendations.
                </p>
                <div className="flex flex-col sm:flex-row gap-4 justify-center">
                  <Button size="lg" className="bg-green-600 hover:bg-green-700" data-testid="open-demat-account">
                    <DollarSign className="h-5 w-5 mr-2" />
                    Open Demat Account
                  </Button>
                  <Button variant="outline" size="lg" data-testid="learn-about-ipos">
                    <BookOpen className="h-5 w-5 mr-2" />
                    Learn About IPOs
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </section>

        {/* How to Apply Section */}
        <section className="mt-12" data-testid="ipo-info-section">
          <h2 className="text-2xl font-bold text-gray-900 mb-6">How to Apply for IPOs</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            
            <Card>
              <CardContent className="p-6">
                <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center mb-4">
                  <Calendar className="h-6 w-6 text-finance-blue" />
                </div>
                <h3 className="font-bold text-gray-900 mb-2">Check IPO Calendar</h3>
                <p className="text-gray-600 text-sm">
                  Stay updated with upcoming IPO dates and subscription periods
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-6">
                <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center mb-4">
                  <DollarSign className="h-6 w-6 text-finance-green" />
                </div>
                <h3 className="font-bold text-gray-900 mb-2">Apply Online</h3>
                <p className="text-gray-600 text-sm">
                  Quick and easy online application process with instant confirmation
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-6">
                <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center mb-4">
                  <TrendingUp className="h-6 w-6 text-purple-600" />
                </div>
                <h3 className="font-bold text-gray-900 mb-2">Track Status</h3>
                <p className="text-gray-600 text-sm">
                  Monitor your application status and allotment details
                </p>
              </CardContent>
            </Card>

          </div>
        </section>

      </main>

      <Footer />
    </div>
  );
}
