import { Header } from "@/components/layout/header";
import { Footer } from "@/components/layout/footer";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Calendar, TrendingUp, Clock, DollarSign, Building2, FileText } from "lucide-react";

export default function IPO() {
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
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="upcoming" data-testid="tab-upcoming">Upcoming IPOs</TabsTrigger>
            <TabsTrigger value="ongoing" data-testid="tab-ongoing">Ongoing</TabsTrigger>
            <TabsTrigger value="listed" data-testid="tab-listed">Recently Listed</TabsTrigger>
            <TabsTrigger value="applications" data-testid="tab-applications">My Applications</TabsTrigger>
          </TabsList>

          <TabsContent value="upcoming" className="space-y-6" data-testid="upcoming-ipos">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {/* This would be populated with real IPO data */}
              <Card className="hover:shadow-md transition-shadow" data-testid="ipo-card-upcoming">
                <CardHeader>
                  <div className="flex justify-between items-start">
                    <div>
                      <CardTitle className="text-lg">Company Name</CardTitle>
                      <p className="text-sm text-gray-600">Industry Sector</p>
                    </div>
                    <Badge variant="secondary">Upcoming</Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <p className="text-gray-600">Price Band</p>
                      <p className="font-semibold">₹000 - ₹000</p>
                    </div>
                    <div>
                      <p className="text-gray-600">Issue Size</p>
                      <p className="font-semibold">₹0,000 Cr</p>
                    </div>
                    <div>
                      <p className="text-gray-600">Open Date</p>
                      <p className="font-semibold">TBA</p>
                    </div>
                    <div>
                      <p className="text-gray-600">Close Date</p>
                      <p className="font-semibold">TBA</p>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" className="flex-1">
                      <FileText className="h-4 w-4 mr-2" />
                      Prospectus
                    </Button>
                    <Button size="sm" className="flex-1 bg-finance-blue hover:bg-blue-700">
                      Set Reminder
                    </Button>
                  </div>
                </CardContent>
              </Card>

              {/* Empty state for demonstration */}
              <Card className="col-span-full border-dashed border-2 border-gray-300">
                <CardContent className="flex flex-col items-center justify-center py-12">
                  <Building2 className="h-12 w-12 text-gray-400 mb-4" />
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">No Upcoming IPOs</h3>
                  <p className="text-gray-500 text-center">
                    IPO data will be displayed here when available from authorized sources
                  </p>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="ongoing" className="space-y-6" data-testid="ongoing-ipos">
            <Card className="border-dashed border-2 border-gray-300">
              <CardContent className="flex flex-col items-center justify-center py-12">
                <Clock className="h-12 w-12 text-gray-400 mb-4" />
                <h3 className="text-lg font-semibold text-gray-900 mb-2">No Ongoing IPOs</h3>
                <p className="text-gray-500 text-center">
                  Currently open IPO applications will be displayed here
                </p>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="listed" className="space-y-6" data-testid="listed-ipos">
            <Card className="border-dashed border-2 border-gray-300">
              <CardContent className="flex flex-col items-center justify-center py-12">
                <TrendingUp className="h-12 w-12 text-gray-400 mb-4" />
                <h3 className="text-lg font-semibold text-gray-900 mb-2">No Recent Listings</h3>
                <p className="text-gray-500 text-center">
                  Recently listed IPO performance will be shown here
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

        {/* IPO Information Section */}
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
