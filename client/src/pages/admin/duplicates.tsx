import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Users, AlertTriangle, Mail, Phone } from "lucide-react";
import { format } from "date-fns";
import { LoadingState } from "@/components/LoadingState";
import { EmptyState } from "@/components/EmptyState";

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
    return parts.join(" ");
  };

  if (isLoading) {
    return <LoadingState variant="card" count={3} />;
  }

  if (error) {
    return (
      <Alert variant="destructive" className="bg-red-900/20 border-red-900">
        <AlertTriangle className="h-4 w-4" />
        <AlertDescription className="text-red-400">
          Failed to load duplicate accounts. Please try again.
        </AlertDescription>
      </Alert>
    );
  }

  const hasNoDuplicates = 
    (!duplicatesData?.duplicateEmails || duplicatesData.duplicateEmails.length === 0) &&
    (!duplicatesData?.duplicateMobiles || duplicatesData.duplicateMobiles.length === 0);

  return (
    <div className="space-y-6" data-testid="page-admin-duplicates">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-white" data-testid="heading-page-title">
          Duplicate Accounts Detection
        </h1>
        <p className="text-gray-400 mt-1">
          Identify and manage duplicate user registrations
        </p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="bg-gray-900 border-gray-800">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-gray-400">
              Duplicate Emails
            </CardTitle>
            <Mail className="h-4 w-4 text-red-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-white" data-testid="count-duplicate-emails">
              {duplicatesData?.summary.totalDuplicateEmails || 0}
            </div>
            <p className="text-xs text-gray-400 mt-1">Unique emails with duplicates</p>
          </CardContent>
        </Card>

        <Card className="bg-gray-900 border-gray-800">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-gray-400">
              Duplicate Mobiles
            </CardTitle>
            <Phone className="h-4 w-4 text-orange-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-white" data-testid="count-duplicate-mobiles">
              {duplicatesData?.summary.totalDuplicateMobiles || 0}
            </div>
            <p className="text-xs text-gray-400 mt-1">Unique mobiles with duplicates</p>
          </CardContent>
        </Card>

        <Card className="bg-gray-900 border-gray-800">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-gray-400">
              Total Affected Accounts
            </CardTitle>
            <Users className="h-4 w-4 text-purple-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-white" data-testid="count-affected-accounts">
              {duplicatesData?.summary.totalAffectedAccounts || 0}
            </div>
            <p className="text-xs text-gray-400 mt-1">Accounts involved in duplicates</p>
          </CardContent>
        </Card>
      </div>

      {hasNoDuplicates ? (
        <EmptyState
          icon={Users}
          title="No Duplicate Accounts Found"
          description="All user accounts have unique email addresses and mobile numbers. The system is clean!"
        />
      ) : (
        <>
          {/* Email Duplicates */}
          {duplicatesData?.duplicateEmails && duplicatesData.duplicateEmails.length > 0 && (
            <Card className="bg-gray-900 border-gray-800">
              <CardHeader>
                <CardTitle className="text-white flex items-center gap-2">
                  <Mail className="h-5 w-5 text-red-400" />
                  Duplicate Email Addresses
                </CardTitle>
                <CardDescription className="text-gray-400">
                  {duplicatesData.duplicateEmails.length} email{duplicatesData.duplicateEmails.length !== 1 ? 's' : ''} registered multiple times
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-6">
                  {duplicatesData.duplicateEmails.map((duplicate, idx) => (
                    <div key={duplicate.email} className="border border-gray-800 rounded-lg p-4">
                      <div className="flex items-center justify-between mb-4">
                        <div>
                          <p className="text-sm font-medium text-gray-400">Email Address</p>
                          <p className="text-white font-semibold" data-testid={`duplicate-email-${idx}`}>
                            {duplicate.email}
                          </p>
                        </div>
                        <Badge variant="destructive" className="bg-red-900/50 text-red-300">
                          {duplicate.count} accounts
                        </Badge>
                      </div>
                      
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="border-b border-gray-800">
                              <th className="text-left py-2 px-2 text-gray-400 font-medium">User ID</th>
                              <th className="text-left py-2 px-2 text-gray-400 font-medium">Name</th>
                              <th className="text-left py-2 px-2 text-gray-400 font-medium">Mobile</th>
                              <th className="text-left py-2 px-2 text-gray-400 font-medium">Role</th>
                              <th className="text-left py-2 px-2 text-gray-400 font-medium">Created</th>
                              <th className="text-left py-2 px-2 text-gray-400 font-medium">Status</th>
                            </tr>
                          </thead>
                          <tbody>
                            {duplicate.users.map((user, userIdx) => (
                              <tr 
                                key={user.id} 
                                className="border-b border-gray-800 last:border-0"
                                data-testid={`email-duplicate-row-${idx}-${userIdx}`}
                              >
                                <td className="py-3 px-2 text-white font-mono text-xs">
                                  {user.userId}
                                </td>
                                <td className="py-3 px-2 text-white">
                                  {getFullName(user)}
                                </td>
                                <td className="py-3 px-2 text-gray-300">
                                  {user.mobile}
                                </td>
                                <td className="py-3 px-2">
                                  <Badge variant="outline" className="text-xs">
                                    {user.role}
                                  </Badge>
                                </td>
                                <td className="py-3 px-2 text-gray-400">
                                  {format(new Date(user.createdAt), 'MMM dd, yyyy')}
                                </td>
                                <td className="py-3 px-2">
                                  <Badge 
                                    variant={user.isActive ? "default" : "secondary"}
                                    className={user.isActive ? "bg-green-900/50 text-green-300" : "bg-gray-800 text-gray-400"}
                                  >
                                    {user.isActive ? "Active" : "Inactive"}
                                  </Badge>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Mobile Duplicates */}
          {duplicatesData?.duplicateMobiles && duplicatesData.duplicateMobiles.length > 0 && (
            <Card className="bg-gray-900 border-gray-800">
              <CardHeader>
                <CardTitle className="text-white flex items-center gap-2">
                  <Phone className="h-5 w-5 text-orange-400" />
                  Duplicate Mobile Numbers
                </CardTitle>
                <CardDescription className="text-gray-400">
                  {duplicatesData.duplicateMobiles.length} mobile number{duplicatesData.duplicateMobiles.length !== 1 ? 's' : ''} registered multiple times
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-6">
                  {duplicatesData.duplicateMobiles.map((duplicate, idx) => (
                    <div key={duplicate.mobile} className="border border-gray-800 rounded-lg p-4">
                      <div className="flex items-center justify-between mb-4">
                        <div>
                          <p className="text-sm font-medium text-gray-400">Mobile Number</p>
                          <p className="text-white font-semibold" data-testid={`duplicate-mobile-${idx}`}>
                            {duplicate.mobile}
                          </p>
                        </div>
                        <Badge variant="destructive" className="bg-orange-900/50 text-orange-300">
                          {duplicate.count} accounts
                        </Badge>
                      </div>
                      
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="border-b border-gray-800">
                              <th className="text-left py-2 px-2 text-gray-400 font-medium">User ID</th>
                              <th className="text-left py-2 px-2 text-gray-400 font-medium">Name</th>
                              <th className="text-left py-2 px-2 text-gray-400 font-medium">Email</th>
                              <th className="text-left py-2 px-2 text-gray-400 font-medium">Role</th>
                              <th className="text-left py-2 px-2 text-gray-400 font-medium">Created</th>
                              <th className="text-left py-2 px-2 text-gray-400 font-medium">Status</th>
                            </tr>
                          </thead>
                          <tbody>
                            {duplicate.users.map((user, userIdx) => (
                              <tr 
                                key={user.id} 
                                className="border-b border-gray-800 last:border-0"
                                data-testid={`mobile-duplicate-row-${idx}-${userIdx}`}
                              >
                                <td className="py-3 px-2 text-white font-mono text-xs">
                                  {user.userId}
                                </td>
                                <td className="py-3 px-2 text-white">
                                  {getFullName(user)}
                                </td>
                                <td className="py-3 px-2 text-gray-300">
                                  {user.email}
                                </td>
                                <td className="py-3 px-2">
                                  <Badge variant="outline" className="text-xs">
                                    {user.role}
                                  </Badge>
                                </td>
                                <td className="py-3 px-2 text-gray-400">
                                  {format(new Date(user.createdAt), 'MMM dd, yyyy')}
                                </td>
                                <td className="py-3 px-2">
                                  <Badge 
                                    variant={user.isActive ? "default" : "secondary"}
                                    className={user.isActive ? "bg-green-900/50 text-green-300" : "bg-gray-800 text-gray-400"}
                                  >
                                    {user.isActive ? "Active" : "Inactive"}
                                  </Badge>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Info Alert */}
          <Alert className="bg-blue-900/20 border-blue-900">
            <AlertTriangle className="h-4 w-4 text-blue-400" />
            <AlertDescription className="text-blue-300">
              To delete duplicate accounts, use the Database pane → "My Data" → Toggle "Edit" → Find and remove the unwanted records. 
              Keep the oldest account (earliest created date) to preserve data integrity.
            </AlertDescription>
          </Alert>
        </>
      )}
    </div>
  );
}
