import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  Users, 
  Phone, 
  MapPin, 
  Search, 
  Plus,
  Calendar,
  Clock,
  CheckCircle2,
  AlertCircle,
  Navigation,
  MessageSquare,
  FileText,
  ChevronRight,
  Briefcase,
  Target,
  TrendingUp
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { Link } from "wouter";

interface ClientVisit {
  id: string;
  clientName: string;
  clientPhone: string;
  address: string;
  purpose: 'kyc' | 'review' | 'onboarding' | 'follow_up';
  status: 'scheduled' | 'in_progress' | 'completed' | 'cancelled';
  scheduledTime: string;
  priority: 'high' | 'medium' | 'low';
}

const mockVisits: ClientVisit[] = [
  { id: '1', clientName: 'Rajesh Kumar', clientPhone: '+91 98765 43210', address: '42 Park Street, Kolkata', purpose: 'kyc', status: 'scheduled', scheduledTime: '10:00 AM', priority: 'high' },
  { id: '2', clientName: 'Priya Sharma', clientPhone: '+91 87654 32109', address: '15 MG Road, Bangalore', purpose: 'review', status: 'scheduled', scheduledTime: '11:30 AM', priority: 'medium' },
  { id: '3', clientName: 'Amit Patel', clientPhone: '+91 76543 21098', address: '88 Ring Road, Ahmedabad', purpose: 'onboarding', status: 'in_progress', scheduledTime: '2:00 PM', priority: 'high' },
  { id: '4', clientName: 'Sunita Reddy', clientPhone: '+91 65432 10987', address: '23 Jubilee Hills, Hyderabad', purpose: 'follow_up', status: 'completed', scheduledTime: '4:00 PM', priority: 'low' },
];

const mockStats = {
  todayVisits: 4,
  completedToday: 1,
  pendingKYC: 8,
  monthlyTarget: 25,
  achieved: 18
};

export default function AgentFieldView() {
  const { user, isAuthenticated } = useAuth();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTab, setSelectedTab] = useState('today');

  const getPurposeColor = (purpose: string) => {
    switch (purpose) {
      case 'kyc': return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200';
      case 'review': return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200';
      case 'onboarding': return 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200';
      case 'follow_up': return 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200';
      default: return 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200';
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high': return 'text-red-600 dark:text-red-400';
      case 'medium': return 'text-yellow-600 dark:text-yellow-400';
      default: return 'text-gray-600 dark:text-gray-400';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed': return <CheckCircle2 className="h-5 w-5 text-green-600 dark:text-green-400" />;
      case 'in_progress': return <Clock className="h-5 w-5 text-blue-600 dark:text-blue-400 animate-pulse" />;
      case 'cancelled': return <AlertCircle className="h-5 w-5 text-red-600 dark:text-red-400" />;
      default: return <Calendar className="h-5 w-5 text-gray-600 dark:text-gray-400" />;
    }
  };

  if (!isAuthenticated) {
    return (
      <div className="max-w-md mx-auto py-12 px-4">
        <Card className="text-center">
          <CardContent className="pt-6">
            <Briefcase className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
            <h2 className="text-xl font-semibold mb-2">Agent Login Required</h2>
            <p className="text-muted-foreground mb-4">Please log in to access the field agent view.</p>
            <Link href="/auth">
              <Button data-testid="agent-login-btn" className="w-full">Login</Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 pb-20" data-testid="agent-field-view-page">
      <div className="sticky top-0 z-10 bg-white dark:bg-gray-800 border-b p-4">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h1 className="text-xl font-bold">Field Agent</h1>
            <p className="text-sm text-muted-foreground">Today's Schedule</p>
          </div>
          <Badge variant="outline" className="text-lg px-3 py-1">
            {mockStats.completedToday}/{mockStats.todayVisits}
          </Badge>
        </div>
        
        <div className="relative">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search clients..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
            data-testid="search-clients-input"
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 p-4">
        <Card className="bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-950 dark:to-blue-900">
          <CardContent className="pt-4 pb-3">
            <div className="flex items-center gap-2">
              <Target className="h-5 w-5 text-blue-600" />
              <div>
                <p className="text-xs text-muted-foreground">Monthly Target</p>
                <p className="text-lg font-bold">{mockStats.achieved}/{mockStats.monthlyTarget}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-orange-50 to-orange-100 dark:from-orange-950 dark:to-orange-900">
          <CardContent className="pt-4 pb-3">
            <div className="flex items-center gap-2">
              <FileText className="h-5 w-5 text-orange-600" />
              <div>
                <p className="text-xs text-muted-foreground">Pending KYC</p>
                <p className="text-lg font-bold">{mockStats.pendingKYC}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs value={selectedTab} onValueChange={setSelectedTab} className="px-4">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="today" data-testid="today-tab">Today</TabsTrigger>
          <TabsTrigger value="upcoming" data-testid="upcoming-tab">Upcoming</TabsTrigger>
          <TabsTrigger value="completed" data-testid="completed-tab">Done</TabsTrigger>
        </TabsList>

        <TabsContent value="today" className="mt-4 space-y-3">
          {mockVisits.filter(v => v.status !== 'completed').map((visit) => (
            <Card 
              key={visit.id} 
              className="touch-manipulation active:scale-[0.98] transition-transform"
              data-testid={`visit-card-${visit.id}`}
            >
              <CardContent className="p-4">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-3">
                    {getStatusIcon(visit.status)}
                    <div>
                      <p className="font-semibold">{visit.clientName}</p>
                      <p className="text-sm text-muted-foreground">{visit.scheduledTime}</p>
                    </div>
                  </div>
                  <Badge className={getPurposeColor(visit.purpose)}>
                    {(visit.purpose || 'general').toUpperCase()}
                  </Badge>
                </div>
                
                <div className="space-y-2 mb-4">
                  <div className="flex items-center gap-2 text-sm">
                    <MapPin className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                    <span className="truncate">{visit.address}</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <Phone className="h-4 w-4 text-muted-foreground" />
                    <span>{visit.clientPhone}</span>
                  </div>
                </div>

                <div className="flex gap-2">
                  <Button 
                    variant="outline" 
                    size="sm" 
                    className="flex-1 h-12"
                    data-testid={`call-client-${visit.id}`}
                  >
                    <Phone className="h-4 w-4 mr-2" />
                    Call
                  </Button>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    className="flex-1 h-12"
                    data-testid={`navigate-${visit.id}`}
                  >
                    <Navigation className="h-4 w-4 mr-2" />
                    Navigate
                  </Button>
                  <Button 
                    size="sm" 
                    className="flex-1 h-12"
                    data-testid={`start-visit-${visit.id}`}
                  >
                    {visit.status === 'in_progress' ? 'Continue' : 'Start'}
                    <ChevronRight className="h-4 w-4 ml-1" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </TabsContent>

        <TabsContent value="upcoming" className="mt-4">
          <Card className="text-center py-8">
            <CardContent>
              <Calendar className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
              <p className="text-muted-foreground">No upcoming visits scheduled</p>
              <Button className="mt-4" data-testid="schedule-visit-btn">
                <Plus className="h-4 w-4 mr-2" />
                Schedule Visit
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="completed" className="mt-4 space-y-3">
          {mockVisits.filter(v => v.status === 'completed').map((visit) => (
            <Card key={visit.id} className="opacity-75" data-testid={`completed-visit-${visit.id}`}>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <CheckCircle2 className="h-5 w-5 text-green-600" />
                    <div>
                      <p className="font-semibold">{visit.clientName}</p>
                      <p className="text-sm text-muted-foreground">{visit.scheduledTime} - Completed</p>
                    </div>
                  </div>
                  <Badge className={getPurposeColor(visit.purpose)}>
                    {(visit.purpose || 'general').toUpperCase()}
                  </Badge>
                </div>
              </CardContent>
            </Card>
          ))}
        </TabsContent>
      </Tabs>

      <div className="fixed bottom-0 left-0 right-0 bg-white dark:bg-gray-800 border-t p-3 flex justify-around">
        <Button variant="ghost" size="sm" className="flex-col h-auto py-2" data-testid="nav-schedule">
          <Calendar className="h-5 w-5 mb-1" />
          <span className="text-xs">Schedule</span>
        </Button>
        <Button variant="ghost" size="sm" className="flex-col h-auto py-2" data-testid="nav-clients">
          <Users className="h-5 w-5 mb-1" />
          <span className="text-xs">Clients</span>
        </Button>
        <Button size="sm" className="flex-col h-auto py-2 px-6" data-testid="nav-add-client">
          <Plus className="h-5 w-5 mb-1" />
          <span className="text-xs">Add</span>
        </Button>
        <Button variant="ghost" size="sm" className="flex-col h-auto py-2" data-testid="nav-messages">
          <MessageSquare className="h-5 w-5 mb-1" />
          <span className="text-xs">Messages</span>
        </Button>
        <Button variant="ghost" size="sm" className="flex-col h-auto py-2" data-testid="nav-reports">
          <TrendingUp className="h-5 w-5 mb-1" />
          <span className="text-xs">Reports</span>
        </Button>
      </div>
    </div>
  );
}
