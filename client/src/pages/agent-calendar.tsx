import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { format, startOfMonth, endOfMonth, startOfWeek, endOfWeek, addDays, addMonths, subMonths, isSameDay, isSameMonth, isToday, parseISO, addHours, isBefore, isAfter } from "date-fns";
import { Link } from "wouter";
import {
  Plus,
  Calendar as CalendarIcon,
  Clock,
  User,
  MapPin,
  Video,
  Phone,
  FileText,
  ChevronLeft,
  ChevronRight,
  Bell,
  AlertCircle,
  CheckCircle,
  Loader2,
  ExternalLink,
  ListTodo,
  Trash2,
  Edit,
  X
} from "lucide-react";

interface Appointment {
  id: string;
  title: string;
  description?: string;
  type: 'meeting' | 'call' | 'review' | 'demo';
  clientId?: string;
  clientName?: string;
  location: 'virtual' | 'office' | 'client_site';
  locationDetails?: string;
  date: string;
  startTime: string;
  endTime: string;
  duration: number;
  reminder: '15min' | '30min' | '1hr' | '1day' | 'none';
  status: 'scheduled' | 'completed' | 'cancelled' | 'no_show';
  notes?: string;
  createdAt: string;
}

interface Client {
  id: string;
  name: string;
  email?: string;
}

const APPOINTMENT_TYPE_CONFIG = {
  meeting: { label: 'Meeting', icon: User, color: 'bg-emerald-500', textColor: 'text-emerald-400', bgLight: 'bg-emerald-500/20' },
  call: { label: 'Call', icon: Phone, color: 'bg-blue-500', textColor: 'text-blue-400', bgLight: 'bg-blue-500/20' },
  review: { label: 'Review', icon: FileText, color: 'bg-purple-500', textColor: 'text-purple-400', bgLight: 'bg-purple-500/20' },
  demo: { label: 'Demo', icon: Video, color: 'bg-amber-500', textColor: 'text-amber-400', bgLight: 'bg-amber-500/20' },
};

const LOCATION_CONFIG = {
  virtual: { label: 'Virtual', icon: Video },
  office: { label: 'Office', icon: MapPin },
  client_site: { label: 'Client Site', icon: MapPin },
};

const REMINDER_OPTIONS = [
  { value: 'none', label: 'No reminder' },
  { value: '15min', label: '15 minutes before' },
  { value: '30min', label: '30 minutes before' },
  { value: '1hr', label: '1 hour before' },
  { value: '1day', label: '1 day before' },
];

const DURATION_OPTIONS = [
  { value: 15, label: '15 minutes' },
  { value: 30, label: '30 minutes' },
  { value: 45, label: '45 minutes' },
  { value: 60, label: '1 hour' },
  { value: 90, label: '1.5 hours' },
  { value: 120, label: '2 hours' },
];

const defaultAppointments: Appointment[] = [
  { id: '1', title: 'Portfolio Review', description: 'Q4 portfolio review and rebalancing discussion', type: 'review', clientId: '1', clientName: 'Rajesh Sharma', location: 'virtual', locationDetails: 'Google Meet', date: format(new Date(), 'yyyy-MM-dd'), startTime: '10:00', endTime: '11:00', duration: 60, reminder: '30min', status: 'scheduled', createdAt: '2024-12-01' },
  { id: '2', title: 'SIP Discussion', description: 'New SIP recommendations', type: 'call', clientId: '2', clientName: 'Priya Patel', location: 'virtual', date: format(new Date(), 'yyyy-MM-dd'), startTime: '14:00', endTime: '14:30', duration: 30, reminder: '15min', status: 'scheduled', createdAt: '2024-12-10' },
  { id: '3', title: 'Product Demo', description: 'Demonstrate new investment platform features', type: 'demo', clientId: '3', clientName: 'Amit Kumar', location: 'office', date: format(addDays(new Date(), 1), 'yyyy-MM-dd'), startTime: '11:00', endTime: '12:00', duration: 60, reminder: '1hr', status: 'scheduled', createdAt: '2024-12-12' },
  { id: '4', title: 'Tax Planning Meeting', description: 'Year-end tax planning strategies', type: 'meeting', clientId: '1', clientName: 'Rajesh Sharma', location: 'client_site', locationDetails: 'Client office - Bandra', date: format(addDays(new Date(), 2), 'yyyy-MM-dd'), startTime: '15:00', endTime: '16:30', duration: 90, reminder: '1day', status: 'scheduled', createdAt: '2024-12-15' },
  { id: '5', title: 'Initial Consultation', description: 'First meeting with new prospect', type: 'meeting', clientId: '5', clientName: 'Vikram Singh', location: 'office', date: format(addDays(new Date(), 3), 'yyyy-MM-dd'), startTime: '09:30', endTime: '10:30', duration: 60, reminder: '30min', status: 'scheduled', createdAt: '2024-12-18' },
  { id: '6', title: 'Follow-up Call', description: 'Follow up on proposal sent last week', type: 'call', clientId: '4', clientName: 'Sunita Reddy', location: 'virtual', date: format(subMonths(new Date(), 0), 'yyyy-MM-dd').slice(0, 8) + '15', startTime: '16:00', endTime: '16:30', duration: 30, reminder: '15min', status: 'completed', createdAt: '2024-12-10' },
];

const defaultClients: Client[] = [
  { id: '1', name: 'Rajesh Sharma', email: 'rajesh@email.com' },
  { id: '2', name: 'Priya Patel', email: 'priya@email.com' },
  { id: '3', name: 'Amit Kumar', email: 'amit@email.com' },
  { id: '4', name: 'Sunita Reddy', email: 'sunita@email.com' },
  { id: '5', name: 'Vikram Singh', email: 'vikram@email.com' },
  { id: '6', name: 'Meera Gupta', email: 'meera@email.com' },
];

export default function AgentCalendar() {
  const { toast } = useToast();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [viewMode, setViewMode] = useState<'month' | 'week' | 'day'>('month');
  const [selectedAppointment, setSelectedAppointment] = useState<Appointment | null>(null);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [showDetailDialog, setShowDetailDialog] = useState(false);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);

  const [newAppointment, setNewAppointment] = useState({
    title: '',
    description: '',
    type: 'meeting' as Appointment['type'],
    clientId: '',
    location: 'virtual' as Appointment['location'],
    locationDetails: '',
    date: format(new Date(), 'yyyy-MM-dd'),
    startTime: '10:00',
    duration: 60,
    reminder: '30min' as Appointment['reminder'],
  });

  const { data: appointmentsData } = useQuery<{ appointments: Appointment[] }>({
    queryKey: ['/api/agent/appointments'],
  });

  const { data: clientsData } = useQuery<{ clients: Client[] }>({
    queryKey: ['/api/agent/clients'],
  });

  const appointments = appointmentsData?.appointments || defaultAppointments;
  const clients = clientsData?.clients || defaultClients;

  const todayAppointments = useMemo(() => {
    return appointments.filter(apt => isSameDay(parseISO(apt.date), new Date()) && apt.status === 'scheduled');
  }, [appointments]);

  const weekAppointments = useMemo(() => {
    const today = new Date();
    const weekEnd = addDays(today, 7);
    return appointments.filter(apt => {
      const aptDate = parseISO(apt.date);
      return isAfter(aptDate, today) && isBefore(aptDate, weekEnd) && apt.status === 'scheduled';
    });
  }, [appointments]);

  const overdueFollowups = useMemo(() => {
    const today = new Date();
    return appointments.filter(apt => {
      const aptDate = parseISO(apt.date);
      return isBefore(aptDate, today) && apt.status === 'scheduled';
    });
  }, [appointments]);

  const getDaysInMonth = () => {
    const start = startOfWeek(startOfMonth(currentDate));
    const end = endOfWeek(endOfMonth(currentDate));
    const days: Date[] = [];
    let day = start;
    while (day <= end) {
      days.push(day);
      day = addDays(day, 1);
    }
    return days;
  };

  const getDaysInWeek = () => {
    const start = startOfWeek(currentDate);
    const days: Date[] = [];
    for (let i = 0; i < 7; i++) {
      days.push(addDays(start, i));
    }
    return days;
  };

  const getAppointmentsForDate = (date: Date) => {
    return appointments.filter(apt => isSameDay(parseISO(apt.date), date));
  };

  const navigatePrev = () => {
    if (viewMode === 'month') setCurrentDate(subMonths(currentDate, 1));
    else if (viewMode === 'week') setCurrentDate(addDays(currentDate, -7));
    else setCurrentDate(addDays(currentDate, -1));
  };

  const navigateNext = () => {
    if (viewMode === 'month') setCurrentDate(addMonths(currentDate, 1));
    else if (viewMode === 'week') setCurrentDate(addDays(currentDate, 7));
    else setCurrentDate(addDays(currentDate, 1));
  };

  const handleDateClick = (date: Date) => {
    setSelectedDate(date);
    setNewAppointment(prev => ({ ...prev, date: format(date, 'yyyy-MM-dd') }));
    setShowAddDialog(true);
  };

  const handleAppointmentClick = (apt: Appointment, e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedAppointment(apt);
    setShowDetailDialog(true);
  };

  const handleCreateAppointment = () => {
    const client = clients.find(c => c.id === newAppointment.clientId);
    const endTime = format(addHours(parseISO(`2024-01-01T${newAppointment.startTime}`), newAppointment.duration / 60), 'HH:mm');
    
    toast({
      title: "Appointment Created",
      description: `${newAppointment.title} scheduled for ${format(parseISO(newAppointment.date), 'MMM d, yyyy')}`,
    });
    
    setShowAddDialog(false);
    setNewAppointment({
      title: '',
      description: '',
      type: 'meeting',
      clientId: '',
      location: 'virtual',
      locationDetails: '',
      date: format(new Date(), 'yyyy-MM-dd'),
      startTime: '10:00',
      duration: 60,
      reminder: '30min',
    });
  };

  const handleCreateFollowUpTask = () => {
    if (!selectedAppointment) return;
    toast({
      title: "Follow-up Task Created",
      description: `Task created for ${selectedAppointment.clientName || 'client'}`,
    });
    setShowDetailDialog(false);
  };

  const renderMonthView = () => {
    const days = getDaysInMonth();
    const weekDays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

    return (
      <div className="bg-slate-900 rounded-lg border border-slate-700 overflow-hidden">
        <div className="grid grid-cols-7 border-b border-slate-700">
          {weekDays.map(day => (
            <div key={day} className="p-3 text-center text-sm font-medium text-slate-400 bg-slate-800/50">
              {day}
            </div>
          ))}
        </div>
        <div className="grid grid-cols-7">
          {days.map((day, idx) => {
            const dayAppointments = getAppointmentsForDate(day);
            const isCurrentMonth = isSameMonth(day, currentDate);
            const isCurrentDay = isToday(day);

            return (
              <div
                key={idx}
                onClick={() => handleDateClick(day)}
                className={`min-h-[100px] p-2 border-b border-r border-slate-700 cursor-pointer transition-colors hover:bg-slate-800/50 ${
                  !isCurrentMonth ? 'bg-slate-900/50' : ''
                } ${isCurrentDay ? 'bg-emerald-500/10' : ''}`}
                data-testid={`calendar-day-${format(day, 'yyyy-MM-dd')}`}
              >
                <div className={`text-sm font-medium mb-1 ${
                  isCurrentDay ? 'text-emerald-400' : isCurrentMonth ? 'text-white' : 'text-slate-600'
                }`}>
                  {format(day, 'd')}
                </div>
                <div className="space-y-1">
                  {dayAppointments.slice(0, 3).map(apt => {
                    const config = APPOINTMENT_TYPE_CONFIG[apt.type];
                    return (
                      <div
                        key={apt.id}
                        onClick={(e) => handleAppointmentClick(apt, e)}
                        className={`text-xs p-1 rounded truncate ${config.bgLight} ${config.textColor} cursor-pointer hover:opacity-80`}
                        data-testid={`appointment-${apt.id}`}
                      >
                        {apt.startTime} {apt.title}
                      </div>
                    );
                  })}
                  {dayAppointments.length > 3 && (
                    <div className="text-xs text-slate-500">+{dayAppointments.length - 3} more</div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  const renderWeekView = () => {
    const days = getDaysInWeek();
    const hours = Array.from({ length: 12 }, (_, i) => i + 8);

    return (
      <div className="bg-slate-900 rounded-lg border border-slate-700 overflow-hidden">
        <div className="grid grid-cols-8 border-b border-slate-700">
          <div className="p-3 text-center text-sm font-medium text-slate-400 bg-slate-800/50">Time</div>
          {days.map(day => (
            <div key={day.toString()} className={`p-3 text-center text-sm font-medium bg-slate-800/50 ${
              isToday(day) ? 'text-emerald-400' : 'text-slate-400'
            }`}>
              <div>{format(day, 'EEE')}</div>
              <div className="text-lg">{format(day, 'd')}</div>
            </div>
          ))}
        </div>
        <div className="max-h-[500px] overflow-y-auto">
          {hours.map(hour => (
            <div key={hour} className="grid grid-cols-8 border-b border-slate-700">
              <div className="p-2 text-xs text-slate-500 bg-slate-800/30">
                {format(new Date().setHours(hour, 0), 'h:mm a')}
              </div>
              {days.map(day => {
                const dayAppointments = getAppointmentsForDate(day).filter(
                  apt => parseInt(apt.startTime.split(':')[0]) === hour
                );
                return (
                  <div
                    key={day.toString()}
                    onClick={() => handleDateClick(day)}
                    className="p-1 border-l border-slate-700 min-h-[50px] hover:bg-slate-800/30 cursor-pointer"
                  >
                    {dayAppointments.map(apt => {
                      const config = APPOINTMENT_TYPE_CONFIG[apt.type];
                      return (
                        <div
                          key={apt.id}
                          onClick={(e) => handleAppointmentClick(apt, e)}
                          className={`text-xs p-1 rounded mb-1 ${config.bgLight} ${config.textColor} cursor-pointer`}
                        >
                          {apt.title}
                        </div>
                      );
                    })}
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>
    );
  };

  const renderDayView = () => {
    const hours = Array.from({ length: 14 }, (_, i) => i + 7);
    const dayAppointments = getAppointmentsForDate(currentDate);

    return (
      <div className="bg-slate-900 rounded-lg border border-slate-700 overflow-hidden">
        <div className="p-4 border-b border-slate-700 bg-slate-800/50">
          <h3 className={`text-lg font-semibold ${isToday(currentDate) ? 'text-emerald-400' : 'text-white'}`}>
            {format(currentDate, 'EEEE, MMMM d, yyyy')}
          </h3>
          <p className="text-sm text-slate-400">{dayAppointments.length} appointments</p>
        </div>
        <div className="max-h-[500px] overflow-y-auto">
          {hours.map(hour => {
            const hourAppointments = dayAppointments.filter(
              apt => parseInt(apt.startTime.split(':')[0]) === hour
            );
            return (
              <div key={hour} className="flex border-b border-slate-700">
                <div className="w-20 p-3 text-sm text-slate-500 bg-slate-800/30 flex-shrink-0">
                  {format(new Date().setHours(hour, 0), 'h:mm a')}
                </div>
                <div
                  onClick={() => handleDateClick(currentDate)}
                  className="flex-1 p-2 hover:bg-slate-800/30 cursor-pointer min-h-[60px]"
                >
                  {hourAppointments.map(apt => {
                    const config = APPOINTMENT_TYPE_CONFIG[apt.type];
                    const Icon = config.icon;
                    return (
                      <div
                        key={apt.id}
                        onClick={(e) => handleAppointmentClick(apt, e)}
                        className={`p-3 rounded-lg mb-2 ${config.bgLight} border-l-4 ${config.color.replace('bg-', 'border-')} cursor-pointer`}
                      >
                        <div className="flex items-center gap-2">
                          <Icon className={`h-4 w-4 ${config.textColor}`} />
                          <span className={`font-medium ${config.textColor}`}>{apt.title}</span>
                          <Badge variant="outline" className="ml-auto text-xs">
                            {apt.startTime} - {apt.endTime}
                          </Badge>
                        </div>
                        {apt.clientName && (
                          <div className="flex items-center gap-2 mt-1 text-sm text-slate-400">
                            <User className="h-3 w-3" />
                            {apt.clientName}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-slate-950 p-6">
      <div className="max-w-7xl mx-auto">
        <div className="flex flex-col lg:flex-row gap-6">
          <div className="flex-1 space-y-6">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
              <div>
                <h1 className="text-2xl font-bold text-white flex items-center gap-2">
                  <CalendarIcon className="h-7 w-7 text-emerald-500" />
                  Calendar
                </h1>
                <p className="text-slate-400 mt-1">Manage appointments and schedule client meetings</p>
              </div>
              <div className="flex items-center gap-3">
                <Tabs value={viewMode} onValueChange={(v) => setViewMode(v as typeof viewMode)}>
                  <TabsList className="bg-slate-800 border-slate-700">
                    <TabsTrigger value="month" className="data-[state=active]:bg-emerald-600" data-testid="button-view-month">Month</TabsTrigger>
                    <TabsTrigger value="week" className="data-[state=active]:bg-emerald-600" data-testid="button-view-week">Week</TabsTrigger>
                    <TabsTrigger value="day" className="data-[state=active]:bg-emerald-600" data-testid="button-view-day">Day</TabsTrigger>
                  </TabsList>
                </Tabs>
                <Button className="bg-emerald-600 hover:bg-emerald-700" onClick={() => setShowAddDialog(true)} data-testid="button-add-appointment">
                  <Plus className="h-4 w-4 mr-2" />
                  New Appointment
                </Button>
              </div>
            </div>

            <div className="flex items-center justify-between">
              <Button variant="outline" size="icon" onClick={navigatePrev} className="border-slate-700" data-testid="button-nav-prev">
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <h2 className="text-xl font-semibold text-white">
                {viewMode === 'month' && format(currentDate, 'MMMM yyyy')}
                {viewMode === 'week' && `Week of ${format(startOfWeek(currentDate), 'MMM d, yyyy')}`}
                {viewMode === 'day' && format(currentDate, 'MMMM d, yyyy')}
              </h2>
              <Button variant="outline" size="icon" onClick={navigateNext} className="border-slate-700" data-testid="button-nav-next">
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>

            {viewMode === 'month' && renderMonthView()}
            {viewMode === 'week' && renderWeekView()}
            {viewMode === 'day' && renderDayView()}

            <div className="flex gap-4 flex-wrap">
              {Object.entries(APPOINTMENT_TYPE_CONFIG).map(([key, config]) => (
                <div key={key} className="flex items-center gap-2">
                  <div className={`w-3 h-3 rounded ${config.color}`} />
                  <span className="text-sm text-slate-400">{config.label}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="w-full lg:w-80 space-y-4">
            <Card className="bg-slate-900 border-slate-700">
              <CardHeader className="pb-3">
                <CardTitle className="text-white flex items-center gap-2">
                  <Clock className="h-5 w-5 text-emerald-500" />
                  Today's Schedule
                </CardTitle>
                <CardDescription className="text-slate-400">
                  {todayAppointments.length} appointment{todayAppointments.length !== 1 ? 's' : ''} today
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-48">
                  {todayAppointments.length === 0 ? (
                    <p className="text-slate-500 text-sm text-center py-4">No appointments today</p>
                  ) : (
                    <div className="space-y-3">
                      {todayAppointments.map(apt => {
                        const config = APPOINTMENT_TYPE_CONFIG[apt.type];
                        const Icon = config.icon;
                        return (
                          <div
                            key={apt.id}
                            onClick={(e) => handleAppointmentClick(apt, e)}
                            className="p-3 rounded-lg bg-slate-800/50 hover:bg-slate-800 cursor-pointer transition-colors"
                            data-testid={`sidebar-appointment-${apt.id}`}
                          >
                            <div className="flex items-center gap-2 mb-1">
                              <Icon className={`h-4 w-4 ${config.textColor}`} />
                              <span className="font-medium text-white text-sm">{apt.title}</span>
                            </div>
                            <div className="text-xs text-slate-400 flex items-center gap-2">
                              <Clock className="h-3 w-3" />
                              {apt.startTime} - {apt.endTime}
                            </div>
                            {apt.clientName && (
                              <div className="text-xs text-slate-500 mt-1">{apt.clientName}</div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </ScrollArea>
              </CardContent>
            </Card>

            <Card className="bg-slate-900 border-slate-700">
              <CardHeader className="pb-3">
                <CardTitle className="text-white flex items-center gap-2">
                  <CalendarIcon className="h-5 w-5 text-blue-500" />
                  Upcoming This Week
                </CardTitle>
                <CardDescription className="text-slate-400">
                  {weekAppointments.length} upcoming
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-48">
                  {weekAppointments.length === 0 ? (
                    <p className="text-slate-500 text-sm text-center py-4">No upcoming appointments</p>
                  ) : (
                    <div className="space-y-3">
                      {weekAppointments.slice(0, 5).map(apt => {
                        const config = APPOINTMENT_TYPE_CONFIG[apt.type];
                        return (
                          <div
                            key={apt.id}
                            onClick={(e) => handleAppointmentClick(apt, e)}
                            className="p-3 rounded-lg bg-slate-800/50 hover:bg-slate-800 cursor-pointer transition-colors"
                          >
                            <div className="flex items-center justify-between mb-1">
                              <span className="font-medium text-white text-sm">{apt.title}</span>
                              <Badge className={`text-xs ${config.bgLight} ${config.textColor} border-0`}>
                                {config.label}
                              </Badge>
                            </div>
                            <div className="text-xs text-slate-400">
                              {format(parseISO(apt.date), 'EEE, MMM d')} at {apt.startTime}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </ScrollArea>
              </CardContent>
            </Card>

            {overdueFollowups.length > 0 && (
              <Card className="bg-slate-900 border-red-500/30">
                <CardHeader className="pb-3">
                  <CardTitle className="text-white flex items-center gap-2">
                    <AlertCircle className="h-5 w-5 text-red-500" />
                    Overdue Follow-ups
                  </CardTitle>
                  <CardDescription className="text-red-400">
                    {overdueFollowups.length} need attention
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <ScrollArea className="h-32">
                    <div className="space-y-3">
                      {overdueFollowups.map(apt => (
                        <div
                          key={apt.id}
                          onClick={(e) => handleAppointmentClick(apt, e)}
                          className="p-3 rounded-lg bg-red-500/10 hover:bg-red-500/20 cursor-pointer transition-colors"
                        >
                          <div className="font-medium text-white text-sm">{apt.title}</div>
                          <div className="text-xs text-red-400">
                            Was scheduled for {format(parseISO(apt.date), 'MMM d')}
                          </div>
                          {apt.clientName && (
                            <div className="text-xs text-slate-500 mt-1">{apt.clientName}</div>
                          )}
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </div>

      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent className="bg-slate-900 border-slate-700 text-white max-w-lg">
          <DialogHeader>
            <DialogTitle>Schedule Appointment</DialogTitle>
            <DialogDescription className="text-slate-400">
              Create a new appointment with a client
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 mt-4">
            <div>
              <Label htmlFor="apt-title" className="text-slate-300">Title *</Label>
              <Input
                id="apt-title"
                value={newAppointment.title}
                onChange={(e) => setNewAppointment({ ...newAppointment, title: e.target.value })}
                className="mt-1 bg-slate-800 border-slate-700"
                placeholder="Appointment title"
                data-testid="input-appointment-title"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="text-slate-300">Client</Label>
                <Select value={newAppointment.clientId} onValueChange={(value) => setNewAppointment({ ...newAppointment, clientId: value })}>
                  <SelectTrigger className="mt-1 bg-slate-800 border-slate-700" data-testid="select-client">
                    <SelectValue placeholder="Select client" />
                  </SelectTrigger>
                  <SelectContent className="bg-slate-800 border-slate-700">
                    {clients.map(client => (
                      <SelectItem key={client.id} value={client.id}>{client.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-slate-300">Type *</Label>
                <Select value={newAppointment.type} onValueChange={(value) => setNewAppointment({ ...newAppointment, type: value as Appointment['type'] })}>
                  <SelectTrigger className="mt-1 bg-slate-800 border-slate-700" data-testid="select-type">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-slate-800 border-slate-700">
                    <SelectItem value="meeting">Meeting</SelectItem>
                    <SelectItem value="call">Call</SelectItem>
                    <SelectItem value="review">Review</SelectItem>
                    <SelectItem value="demo">Demo</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="text-slate-300">Location</Label>
                <Select value={newAppointment.location} onValueChange={(value) => setNewAppointment({ ...newAppointment, location: value as Appointment['location'] })}>
                  <SelectTrigger className="mt-1 bg-slate-800 border-slate-700" data-testid="select-location">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-slate-800 border-slate-700">
                    <SelectItem value="virtual">Virtual</SelectItem>
                    <SelectItem value="office">Office</SelectItem>
                    <SelectItem value="client_site">Client Site</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="apt-location-details" className="text-slate-300">Location Details</Label>
                <Input
                  id="apt-location-details"
                  value={newAppointment.locationDetails}
                  onChange={(e) => setNewAppointment({ ...newAppointment, locationDetails: e.target.value })}
                  className="mt-1 bg-slate-800 border-slate-700"
                  placeholder="e.g., Google Meet link"
                />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div>
                <Label htmlFor="apt-date" className="text-slate-300">Date *</Label>
                <Input
                  id="apt-date"
                  type="date"
                  value={newAppointment.date}
                  onChange={(e) => setNewAppointment({ ...newAppointment, date: e.target.value })}
                  className="mt-1 bg-slate-800 border-slate-700"
                  data-testid="input-date"
                />
              </div>
              <div>
                <Label htmlFor="apt-time" className="text-slate-300">Time *</Label>
                <Input
                  id="apt-time"
                  type="time"
                  value={newAppointment.startTime}
                  onChange={(e) => setNewAppointment({ ...newAppointment, startTime: e.target.value })}
                  className="mt-1 bg-slate-800 border-slate-700"
                  data-testid="input-time"
                />
              </div>
              <div>
                <Label className="text-slate-300">Duration</Label>
                <Select value={newAppointment.duration.toString()} onValueChange={(value) => setNewAppointment({ ...newAppointment, duration: parseInt(value) })}>
                  <SelectTrigger className="mt-1 bg-slate-800 border-slate-700" data-testid="select-duration">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-slate-800 border-slate-700">
                    {DURATION_OPTIONS.map(opt => (
                      <SelectItem key={opt.value} value={opt.value.toString()}>{opt.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div>
              <Label className="text-slate-300">Reminder</Label>
              <Select value={newAppointment.reminder} onValueChange={(value) => setNewAppointment({ ...newAppointment, reminder: value as Appointment['reminder'] })}>
                <SelectTrigger className="mt-1 bg-slate-800 border-slate-700" data-testid="select-reminder">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-slate-800 border-slate-700">
                  {REMINDER_OPTIONS.map(opt => (
                    <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="apt-description" className="text-slate-300">Description</Label>
              <Textarea
                id="apt-description"
                value={newAppointment.description}
                onChange={(e) => setNewAppointment({ ...newAppointment, description: e.target.value })}
                className="mt-1 bg-slate-800 border-slate-700"
                placeholder="Appointment details..."
                rows={3}
              />
            </div>

            <div className="flex justify-end gap-3 pt-4">
              <Button variant="outline" onClick={() => setShowAddDialog(false)} className="border-slate-600">
                Cancel
              </Button>
              <Button 
                className="bg-emerald-600 hover:bg-emerald-700" 
                onClick={handleCreateAppointment}
                disabled={!newAppointment.title || !newAppointment.date || !newAppointment.startTime}
                data-testid="button-create-appointment"
              >
                Schedule Appointment
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={showDetailDialog} onOpenChange={setShowDetailDialog}>
        <DialogContent className="bg-slate-900 border-slate-700 text-white max-w-lg">
          {selectedAppointment && (
            <>
              <DialogHeader>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    {(() => {
                      const config = APPOINTMENT_TYPE_CONFIG[selectedAppointment.type];
                      const Icon = config.icon;
                      return (
                        <div className={`p-2 rounded-lg ${config.bgLight}`}>
                          <Icon className={`h-5 w-5 ${config.textColor}`} />
                        </div>
                      );
                    })()}
                    <div>
                      <DialogTitle>{selectedAppointment.title}</DialogTitle>
                      <Badge className={`mt-1 ${APPOINTMENT_TYPE_CONFIG[selectedAppointment.type].bgLight} ${APPOINTMENT_TYPE_CONFIG[selectedAppointment.type].textColor} border-0`}>
                        {APPOINTMENT_TYPE_CONFIG[selectedAppointment.type].label}
                      </Badge>
                    </div>
                  </div>
                </div>
              </DialogHeader>

              <div className="space-y-4 mt-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="flex items-center gap-2 text-slate-300">
                    <CalendarIcon className="h-4 w-4 text-slate-500" />
                    <span>{format(parseISO(selectedAppointment.date), 'EEEE, MMMM d, yyyy')}</span>
                  </div>
                  <div className="flex items-center gap-2 text-slate-300">
                    <Clock className="h-4 w-4 text-slate-500" />
                    <span>{selectedAppointment.startTime} - {selectedAppointment.endTime}</span>
                  </div>
                </div>

                {selectedAppointment.clientName && (
                  <div className="flex items-center justify-between p-3 rounded-lg bg-slate-800/50">
                    <div className="flex items-center gap-2">
                      <User className="h-4 w-4 text-slate-500" />
                      <span className="text-white">{selectedAppointment.clientName}</span>
                    </div>
                    {selectedAppointment.clientId && (
                      <Link href={`/crm/clients/${selectedAppointment.clientId}`}>
                        <Button variant="ghost" size="sm" className="text-emerald-400 hover:text-emerald-300">
                          <ExternalLink className="h-4 w-4 mr-1" />
                          View Profile
                        </Button>
                      </Link>
                    )}
                  </div>
                )}

                <div className="flex items-center gap-2 text-slate-300">
                  {LOCATION_CONFIG[selectedAppointment.location].icon === Video ? (
                    <Video className="h-4 w-4 text-slate-500" />
                  ) : (
                    <MapPin className="h-4 w-4 text-slate-500" />
                  )}
                  <span>{LOCATION_CONFIG[selectedAppointment.location].label}</span>
                  {selectedAppointment.locationDetails && (
                    <span className="text-slate-500">• {selectedAppointment.locationDetails}</span>
                  )}
                </div>

                {selectedAppointment.description && (
                  <div className="p-3 rounded-lg bg-slate-800/50">
                    <p className="text-sm text-slate-300">{selectedAppointment.description}</p>
                  </div>
                )}

                {selectedAppointment.reminder !== 'none' && (
                  <div className="flex items-center gap-2 text-slate-400 text-sm">
                    <Bell className="h-4 w-4" />
                    <span>Reminder: {REMINDER_OPTIONS.find(r => r.value === selectedAppointment.reminder)?.label}</span>
                  </div>
                )}

                <div className="flex justify-between gap-3 pt-4 border-t border-slate-700">
                  <Button
                    variant="outline"
                    className="border-slate-600 text-slate-300"
                    onClick={handleCreateFollowUpTask}
                    data-testid="button-create-followup-task"
                  >
                    <ListTodo className="h-4 w-4 mr-2" />
                    Create Follow-up Task
                  </Button>
                  <div className="flex gap-2">
                    <Button variant="outline" className="border-slate-600" data-testid="button-edit-appointment">
                      <Edit className="h-4 w-4 mr-2" />
                      Edit
                    </Button>
                    <Button variant="outline" className="border-red-500/30 text-red-400 hover:bg-red-500/10" data-testid="button-cancel-appointment">
                      <X className="h-4 w-4 mr-2" />
                      Cancel
                    </Button>
                  </div>
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
