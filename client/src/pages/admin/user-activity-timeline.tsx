import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { 
  Activity, 
  User, 
  Search, 
  RefreshCw,
  LogIn,
  FileText,
  CreditCard,
  Shield,
  Eye,
  Edit,
  Clock,
  Filter,
  ChevronDown,
  ChevronRight
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { formatDistanceToNow, format } from "date-fns";

interface ActivityEvent {
  id: string;
  userId: number;
  userName: string;
  userEmail: string;
  eventType: string;
  eventCategory: string;
  description: string;
  metadata?: Record<string, any>;
  ipAddress?: string;
  userAgent?: string;
  timestamp: string;
}

interface ActivityTimelineData {
  events: ActivityEvent[];
  totalCount: number;
  users: { id: number; name: string; email: string }[];
}

const eventTypeColors: Record<string, string> = {
  login: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300',
  logout: 'bg-muted text-foreground',
  kyc: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-300',
  transaction: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-300',
  profile: 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-300',
  document: 'bg-cyan-100 text-cyan-800 dark:bg-cyan-900 dark:text-cyan-300',
  security: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300',
};

const eventTypeIcons: Record<string, any> = {
  login: LogIn,
  logout: LogIn,
  kyc: Shield,
  transaction: CreditCard,
  profile: Edit,
  document: FileText,
  security: Shield,
  view: Eye,
};

export default function UserActivityTimeline() {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedUser, setSelectedUser] = useState<string>("all");
  const [eventFilter, setEventFilter] = useState<string>("all");
  const [expandedEvents, setExpandedEvents] = useState<Set<string>>(new Set());

  const { data, isLoading, refetch, isFetching } = useQuery<ActivityTimelineData>({
    queryKey: ["/api/admin/user-activity", selectedUser, eventFilter],
  });

  const toggleEvent = (eventId: string) => {
    const newExpanded = new Set(expandedEvents);
    if (newExpanded.has(eventId)) {
      newExpanded.delete(eventId);
    } else {
      newExpanded.add(eventId);
    }
    setExpandedEvents(newExpanded);
  };

  const filteredEvents = (data?.events || []).filter(event => {
    if (!searchTerm) return true;
    return (
      event.userName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      event.userEmail.toLowerCase().includes(searchTerm.toLowerCase()) ||
      event.description.toLowerCase().includes(searchTerm.toLowerCase())
    );
  });

  if (isLoading) {
    return (
      <div className="p-6 space-y-6">
        <Skeleton className="h-8 w-64" />
        <div className="space-y-4">
          {[...Array(5)].map((_, i) => (
            <Skeleton key={i} className="h-24" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">User Activity Timeline</h1>
          <p className="text-sm text-muted-foreground">
            Track user journeys and activity across the platform
          </p>
        </div>
        <Button 
          onClick={() => refetch()} 
          disabled={isFetching}
          variant="outline"
          data-testid="button-refresh"
        >
          <RefreshCw className={`w-4 h-4 mr-2 ${isFetching ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Total Events</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-blue-600" data-testid="text-total-events">
              {data?.totalCount || 0}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Active Users</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-emerald-600">
              {data?.users?.length || 0}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Logins Today</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-purple-600">
              {filteredEvents.filter(e => e.eventType === 'login').length}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Transactions</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-orange-600">
              {filteredEvents.filter(e => e.eventType === 'transaction').length}
            </p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Activity Feed</CardTitle>
              <CardDescription>Real-time user activity across the platform</CardDescription>
            </div>
            <div className="flex items-center gap-3">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Search activities..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-9 w-[200px]"
                  data-testid="input-search"
                />
              </div>
              <Select value={eventFilter} onValueChange={setEventFilter}>
                <SelectTrigger className="w-[140px]" data-testid="select-event-filter">
                  <Filter className="w-4 h-4 mr-2" />
                  <SelectValue placeholder="Filter" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Events</SelectItem>
                  <SelectItem value="login">Logins</SelectItem>
                  <SelectItem value="transaction">Transactions</SelectItem>
                  <SelectItem value="kyc">KYC</SelectItem>
                  <SelectItem value="security">Security</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="relative">
            <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-muted" />
            
            <div className="space-y-4">
              {filteredEvents.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Activity className="w-12 h-12 mx-auto mb-3 opacity-50" />
                  <p>No activity events found</p>
                </div>
              ) : (
                filteredEvents.map((event) => {
                  const IconComponent = eventTypeIcons[event.eventType] || Activity;
                  const isExpanded = expandedEvents.has(event.id);
                  
                  return (
                    <div 
                      key={event.id} 
                      className="relative pl-10"
                      data-testid={`activity-event-${event.id}`}
                    >
                      <div className={`absolute left-2 w-5 h-5 rounded-full flex items-center justify-center ${eventTypeColors[event.eventType] || 'bg-muted'}`}>
                        <IconComponent className="w-3 h-3" />
                      </div>
                      
                      <div 
                        className="p-4 border rounded-lg bg-card cursor-pointer hover:bg-muted"
                        onClick={() => toggleEvent(event.id)}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div className="flex items-center gap-2">
                              {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                              <User className="w-4 h-4 text-muted-foreground" />
                              <span className="font-medium">{event.userName}</span>
                            </div>
                            <Badge className={eventTypeColors[event.eventType] || 'bg-muted'}>
                              {event.eventType}
                            </Badge>
                          </div>
                          <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            <Clock className="w-4 h-4" />
                            {formatDistanceToNow(new Date(event.timestamp), { addSuffix: true })}
                          </div>
                        </div>
                        
                        <p className="mt-2 text-sm text-muted-foreground">{event.description}</p>
                        
                        {isExpanded && (
                          <div className="mt-4 pt-4 border-t space-y-2 text-sm">
                            <div className="grid grid-cols-2 gap-4">
                              <div>
                                <span className="text-muted-foreground">Email:</span>
                                <span className="ml-2">{event.userEmail}</span>
                              </div>
                              <div>
                                <span className="text-muted-foreground">Category:</span>
                                <span className="ml-2">{event.eventCategory}</span>
                              </div>
                              {event.ipAddress && (
                                <div>
                                  <span className="text-muted-foreground">IP Address:</span>
                                  <span className="ml-2">{event.ipAddress}</span>
                                </div>
                              )}
                              <div>
                                <span className="text-muted-foreground">Timestamp:</span>
                                <span className="ml-2">{format(new Date(event.timestamp), 'PPpp')}</span>
                              </div>
                            </div>
                            {event.metadata && Object.keys(event.metadata).length > 0 && (
                              <div className="mt-2 p-2 bg-muted rounded">
                                <span className="text-muted-foreground">Metadata:</span>
                                <pre className="mt-1 text-xs overflow-auto">
                                  {JSON.stringify(event.metadata, null, 2)}
                                </pre>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
