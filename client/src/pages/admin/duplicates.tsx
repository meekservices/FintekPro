import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Users, AlertTriangle, Mail, Phone, Info, Calendar, Shield, User } from "lucide-react";
import { format } from "date-fns";
import { LoadingState } from "@/components/LoadingState";
import { EmptyState } from "@/components/EmptyState";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";

interface DuplicateUser {
  id: string;
  userId: string;
  email: string;
  mobile: string;
  firstName: string;
  middleName: string | null;
  lastName: string;
  createdAt: string;
  role: string;
  isActive: boolean;
}

interface EmailDuplicate {
  email: string;
  count: number;
  users: DuplicateUser[];
}

interface MobileDuplicate {
  mobile: string;
  count: number;
  users: DuplicateUser[];
}

interface DuplicatesData {
  duplicateEmails: EmailDuplicate[];
  duplicateMobiles: MobileDuplicate[];
  summary: {
    totalDuplicateEmails: number;
    totalDuplicateMobiles: number;
    totalAffectedAccounts: number;
  };
}

export default function DuplicatesPage() {
  const { data, isLoading, error } = useQuery<{ success: boolean; data: DuplicatesData }>({
    queryKey: ["/api/admin/duplicates"],
  });

  const duplicatesData = data?.data;

  const getFullName = (user: DuplicateUser) => {
    const parts = [user.firstName, user.middleName, user.lastName].filter(Boolean);
    return parts.join(" ") || "—";
  };

  const formatDate = (dateStr: string) => {
    try {
      return format(new Date(dateStr), 'dd MMM yyyy');
    } catch {
      return "—";
    }
  };

  if (isLoading) {
    return (
      <div className="p-6">
        <LoadingState variant="card" count={3} />
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6">
        <Alert variant="destructive" className="bg-red-50 dark:bg-red-950/50 border-red-300 dark:border-red-800">
          <AlertTriangle className="h-5 w-5 text-red-600 dark:text-red-400" />
          <AlertDescription className="text-red-800 dark:text-red-200 text-base font-medium ml-2">
            Failed to load duplicate accounts. Please try again.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  const hasNoDuplicates = 
    (!duplicatesData?.duplicateEmails || duplicatesData.duplicateEmails.length === 0) &&
    (!duplicatesData?.duplicateMobiles || duplicatesData.duplicateMobiles.length === 0);

  return (
    <div className="p-6 space-y-8 max-w-7xl mx-auto" data-testid="page-admin-duplicates">
      {/* Header */}
      <div className="bg-gradient-to-r from-red-500/10 via-orange-500/10 to-yellow-500/10 dark:from-red-500/20 dark:via-orange-500/20 dark:to-yellow-500/20 rounded-xl p-6 border border-red-200/50 dark:border-red-800/50">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-red-100 dark:bg-red-900/50 rounded-lg">
            <Users className="h-8 w-8 text-red-600 dark:text-red-400" />
          </div>
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-gray-900 dark:text-white" data-testid="heading-page-title">
              Duplicate Accounts Detection
            </h1>
            <p className="text-gray-600 dark:text-gray-300 mt-1 text-base">
              Identify and manage duplicate user registrations in the system
            </p>
          </div>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 md:gap-6">
        <Card className="bg-gradient-to-br from-red-50 to-white dark:from-red-950/30 dark:to-gray-900 border-red-200 dark:border-red-800/50 shadow-lg">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
            <CardTitle className="text-sm font-semibold text-red-700 dark:text-red-300 uppercase tracking-wide">
              Duplicate Emails
            </CardTitle>
            <div className="p-2 bg-red-100 dark:bg-red-900/50 rounded-full">
              <Mail className="h-5 w-5 text-red-600 dark:text-red-400" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-4xl font-bold text-red-700 dark:text-red-300" data-testid="count-duplicate-emails">
              {duplicatesData?.summary.totalDuplicateEmails || 0}
            </div>
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-2">Unique emails with duplicates</p>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-orange-50 to-white dark:from-orange-950/30 dark:to-gray-900 border-orange-200 dark:border-orange-800/50 shadow-lg">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
            <CardTitle className="text-sm font-semibold text-orange-700 dark:text-orange-300 uppercase tracking-wide">
              Duplicate Mobiles
            </CardTitle>
            <div className="p-2 bg-orange-100 dark:bg-orange-900/50 rounded-full">
              <Phone className="h-5 w-5 text-orange-600 dark:text-orange-400" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-4xl font-bold text-orange-700 dark:text-orange-300" data-testid="count-duplicate-mobiles">
              {duplicatesData?.summary.totalDuplicateMobiles || 0}
            </div>
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-2">Unique mobiles with duplicates</p>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-purple-50 to-white dark:from-purple-950/30 dark:to-gray-900 border-purple-200 dark:border-purple-800/50 shadow-lg">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
            <CardTitle className="text-sm font-semibold text-purple-700 dark:text-purple-300 uppercase tracking-wide">
              Affected Accounts
            </CardTitle>
            <div className="p-2 bg-purple-100 dark:bg-purple-900/50 rounded-full">
              <Users className="h-5 w-5 text-purple-600 dark:text-purple-400" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-4xl font-bold text-purple-700 dark:text-purple-300" data-testid="count-affected-accounts">
              {duplicatesData?.summary.totalAffectedAccounts || 0}
            </div>
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-2">Accounts involved in duplicates</p>
          </CardContent>
        </Card>
      </div>

      {hasNoDuplicates ? (
        <Card className="bg-gradient-to-br from-green-50 to-white dark:from-green-950/30 dark:to-gray-900 border-green-200 dark:border-green-800/50">
          <CardContent className="py-16">
            <EmptyState
              icon={Shield}
              title="No Duplicate Accounts Found"
              description="All user accounts have unique email addresses and mobile numbers. The system is clean!"
            />
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Email Duplicates */}
          {duplicatesData?.duplicateEmails && duplicatesData.duplicateEmails.length > 0 && (
            <Card className="shadow-lg border-2 border-red-100 dark:border-red-900/50">
              <CardHeader className="bg-red-50/50 dark:bg-red-950/30 border-b border-red-100 dark:border-red-900/50">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-red-100 dark:bg-red-900/50 rounded-lg">
                    <Mail className="h-6 w-6 text-red-600 dark:text-red-400" />
                  </div>
                  <div>
                    <CardTitle className="text-xl text-gray-900 dark:text-white">
                      Duplicate Email Addresses
                    </CardTitle>
                    <CardDescription className="text-base text-gray-600 dark:text-gray-400">
                      {duplicatesData.duplicateEmails.length} email{duplicatesData.duplicateEmails.length !== 1 ? 's' : ''} registered multiple times
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="p-4 md:p-6">
                <div className="space-y-6">
                  {duplicatesData.duplicateEmails.map((duplicate, idx) => (
                    <div 
                      key={duplicate.email} 
                      className="bg-white dark:bg-gray-800/50 border-2 border-red-100 dark:border-red-900/30 rounded-xl overflow-hidden shadow-sm"
                    >
                      <div className="bg-red-50 dark:bg-red-950/50 px-4 py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-red-100 dark:border-red-900/30">
                        <div className="flex items-center gap-2">
                          <Mail className="h-4 w-4 text-red-500 dark:text-red-400" />
                          <span className="text-sm font-medium text-gray-500 dark:text-gray-400">Email:</span>
                          <span className="text-base font-bold text-gray-900 dark:text-white break-all" data-testid={`duplicate-email-${idx}`}>
                            {duplicate.email}
                          </span>
                        </div>
                        <Badge className="bg-red-600 hover:bg-red-700 text-white text-sm px-3 py-1 w-fit">
                          {duplicate.count} accounts
                        </Badge>
                      </div>
                      
                      <ScrollArea className="max-h-[400px]">
                        <div className="p-4 space-y-3">
                          {duplicate.users.map((user, userIdx) => (
                            <div 
                              key={user.id}
                              className="bg-gray-50 dark:bg-gray-900/50 rounded-lg p-4 border border-gray-200 dark:border-gray-700"
                              data-testid={`email-duplicate-row-${idx}-${userIdx}`}
                            >
                              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                                <div className="flex items-start gap-2">
                                  <User className="h-4 w-4 text-gray-400 mt-0.5 flex-shrink-0" />
                                  <div>
                                    <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Name</p>
                                    <p className="text-sm font-semibold text-gray-900 dark:text-white">
                                      {getFullName(user)}
                                    </p>
                                  </div>
                                </div>
                                
                                <div className="flex items-start gap-2">
                                  <Shield className="h-4 w-4 text-gray-400 mt-0.5 flex-shrink-0" />
                                  <div>
                                    <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">User ID</p>
                                    <p className="text-sm font-mono text-gray-700 dark:text-gray-300 break-all">
                                      {user.userId}
                                    </p>
                                  </div>
                                </div>
                                
                                <div className="flex items-start gap-2">
                                  <Phone className="h-4 w-4 text-gray-400 mt-0.5 flex-shrink-0" />
                                  <div>
                                    <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Mobile</p>
                                    <p className="text-sm text-gray-700 dark:text-gray-300">
                                      {user.mobile || "—"}
                                    </p>
                                  </div>
                                </div>
                                
                                <div className="flex items-start gap-2">
                                  <Calendar className="h-4 w-4 text-gray-400 mt-0.5 flex-shrink-0" />
                                  <div>
                                    <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Created</p>
                                    <p className="text-sm text-gray-700 dark:text-gray-300">
                                      {formatDate(user.createdAt)}
                                    </p>
                                  </div>
                                </div>
                                
                                <div className="flex items-center gap-3">
                                  <Badge variant="outline" className="text-xs bg-gray-100 dark:bg-gray-800 border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300">
                                    {user.role}
                                  </Badge>
                                  <Badge 
                                    className={user.isActive 
                                      ? "bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-300 border-green-300 dark:border-green-700" 
                                      : "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400 border-gray-300 dark:border-gray-600"
                                    }
                                  >
                                    {user.isActive ? "Active" : "Inactive"}
                                  </Badge>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </ScrollArea>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          <Separator className="my-4" />

          {/* Mobile Duplicates */}
          {duplicatesData?.duplicateMobiles && duplicatesData.duplicateMobiles.length > 0 && (
            <Card className="shadow-lg border-2 border-orange-100 dark:border-orange-900/50">
              <CardHeader className="bg-orange-50/50 dark:bg-orange-950/30 border-b border-orange-100 dark:border-orange-900/50">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-orange-100 dark:bg-orange-900/50 rounded-lg">
                    <Phone className="h-6 w-6 text-orange-600 dark:text-orange-400" />
                  </div>
                  <div>
                    <CardTitle className="text-xl text-gray-900 dark:text-white">
                      Duplicate Mobile Numbers
                    </CardTitle>
                    <CardDescription className="text-base text-gray-600 dark:text-gray-400">
                      {duplicatesData.duplicateMobiles.length} mobile number{duplicatesData.duplicateMobiles.length !== 1 ? 's' : ''} registered multiple times
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="p-4 md:p-6">
                <div className="space-y-6">
                  {duplicatesData.duplicateMobiles.map((duplicate, idx) => (
                    <div 
                      key={duplicate.mobile} 
                      className="bg-white dark:bg-gray-800/50 border-2 border-orange-100 dark:border-orange-900/30 rounded-xl overflow-hidden shadow-sm"
                    >
                      <div className="bg-orange-50 dark:bg-orange-950/50 px-4 py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-orange-100 dark:border-orange-900/30">
                        <div className="flex items-center gap-2">
                          <Phone className="h-4 w-4 text-orange-500 dark:text-orange-400" />
                          <span className="text-sm font-medium text-gray-500 dark:text-gray-400">Mobile:</span>
                          <span className="text-base font-bold text-gray-900 dark:text-white" data-testid={`duplicate-mobile-${idx}`}>
                            {duplicate.mobile}
                          </span>
                        </div>
                        <Badge className="bg-orange-600 hover:bg-orange-700 text-white text-sm px-3 py-1 w-fit">
                          {duplicate.count} accounts
                        </Badge>
                      </div>
                      
                      <ScrollArea className="max-h-[400px]">
                        <div className="p-4 space-y-3">
                          {duplicate.users.map((user, userIdx) => (
                            <div 
                              key={user.id}
                              className="bg-gray-50 dark:bg-gray-900/50 rounded-lg p-4 border border-gray-200 dark:border-gray-700"
                              data-testid={`mobile-duplicate-row-${idx}-${userIdx}`}
                            >
                              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                                <div className="flex items-start gap-2">
                                  <User className="h-4 w-4 text-gray-400 mt-0.5 flex-shrink-0" />
                                  <div>
                                    <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Name</p>
                                    <p className="text-sm font-semibold text-gray-900 dark:text-white">
                                      {getFullName(user)}
                                    </p>
                                  </div>
                                </div>
                                
                                <div className="flex items-start gap-2">
                                  <Shield className="h-4 w-4 text-gray-400 mt-0.5 flex-shrink-0" />
                                  <div>
                                    <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">User ID</p>
                                    <p className="text-sm font-mono text-gray-700 dark:text-gray-300 break-all">
                                      {user.userId}
                                    </p>
                                  </div>
                                </div>
                                
                                <div className="flex items-start gap-2">
                                  <Mail className="h-4 w-4 text-gray-400 mt-0.5 flex-shrink-0" />
                                  <div>
                                    <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Email</p>
                                    <p className="text-sm text-gray-700 dark:text-gray-300 break-all">
                                      {user.email || "—"}
                                    </p>
                                  </div>
                                </div>
                                
                                <div className="flex items-start gap-2">
                                  <Calendar className="h-4 w-4 text-gray-400 mt-0.5 flex-shrink-0" />
                                  <div>
                                    <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Created</p>
                                    <p className="text-sm text-gray-700 dark:text-gray-300">
                                      {formatDate(user.createdAt)}
                                    </p>
                                  </div>
                                </div>
                                
                                <div className="flex items-center gap-3">
                                  <Badge variant="outline" className="text-xs bg-gray-100 dark:bg-gray-800 border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300">
                                    {user.role}
                                  </Badge>
                                  <Badge 
                                    className={user.isActive 
                                      ? "bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-300 border-green-300 dark:border-green-700" 
                                      : "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400 border-gray-300 dark:border-gray-600"
                                    }
                                  >
                                    {user.isActive ? "Active" : "Inactive"}
                                  </Badge>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </ScrollArea>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Info Alert */}
          <Alert className="bg-blue-50 dark:bg-blue-950/50 border-2 border-blue-200 dark:border-blue-800 shadow-sm">
            <Info className="h-5 w-5 text-blue-600 dark:text-blue-400" />
            <AlertDescription className="text-blue-800 dark:text-blue-200 text-base ml-2">
              <span className="font-semibold">To resolve duplicates:</span> Use the Database pane → "My Data" → Toggle "Edit" → Find and remove the unwanted records. 
              Keep the oldest account (earliest created date) to preserve data integrity.
            </AlertDescription>
          </Alert>
        </>
      )}
    </div>
  );
}
