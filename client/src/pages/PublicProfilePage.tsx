import { useParams, Link } from 'wouter';
import { useQuery } from '@tanstack/react-query';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { TrendingUp, Users, Award, Shield as LucideShield, UserCircle, ArrowUpRight } from 'lucide-react';

export default function PublicProfilePage() {
  const { code } = useParams<{ code: string }>();

  const { data: profileData, isLoading, error } = useQuery<any>({
    queryKey: [`/api/alpaca/social/profile/${code}`],
  });

  if (isLoading) {
    return (
      <div className="container max-w-4xl py-12 space-y-6">
        <Skeleton className="h-48 w-full rounded-xl" />
        <div className="grid md:grid-cols-3 gap-4">
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-32 w-full" />
        </div>
      </div>
    );
  }

  if (error || !profileData?.success) {
    return (
      <div className="container max-w-4xl py-24 text-center">
        <UserCircle className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
        <h1 className="text-2xl font-bold">Profile Not Found</h1>
        <p className="text-muted-foreground mt-2">
          This profile might be private or the link has expired.
        </p>
        <Button className="mt-6" asChild>
          <Link href="/">Return to Home</Link>
        </Button>
      </div>
    );
  }

  const profile = profileData.data;

  return (
    <div className="min-h-screen bg-background pt-12 pb-24">
      <div className="container max-w-4xl px-4">
        {/* Header / Hero */}
        <Card className="mb-8 border-none bg-gradient-to-br from-primary/10 via-primary/5 to-background shadow-lg overflow-hidden">
          <CardHeader className="flex flex-row items-center gap-6 pb-8">
            <div className="h-24 w-24 rounded-full bg-primary/20 flex items-center justify-center text-primary text-3xl font-bold border-4 border-background">
              {profile.firstName[0]}
              {profile.lastName?.[0]}
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                <h1 className="text-3xl font-bold">{profile.firstName} {profile.lastName}</h1>
                <Badge variant="secondary" className="bg-primary/10 text-primary border-primary/20">
                  <LucideShield className="h-3 w-3 mr-1" /> Verified
                </Badge>
              </div>
              <p className="text-muted-foreground">Joined {new Date(profile.createdAt).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}</p>
            </div>
          </CardHeader>
          <CardContent className="border-t border-primary/10 pt-6">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="text-center">
                <p className="text-xs text-muted-foreground uppercase font-semibold">Risk Level</p>
                <p className="text-lg font-bold">Moderate</p>
              </div>
              <div className="text-center">
                <p className="text-xs text-muted-foreground uppercase font-semibold">Badges</p>
                <p className="text-lg font-bold">12</p>
              </div>
              <div className="text-center">
                <p className="text-xs text-muted-foreground uppercase font-semibold">Growth</p>
                <p className="text-lg font-bold text-green-500">+14.2%</p>
              </div>
              <div className="text-center">
                <p className="text-xs text-muted-foreground uppercase font-semibold">Community</p>
                <p className="text-lg font-bold">84</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="grid md:grid-cols-3 gap-6">
          {/* Main Content */}
          <div className="md:col-span-2 space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <TrendingUp className="h-5 w-5 text-green-500" />
                  Investment Highlights
                </CardTitle>
                <CardDescription>Visualizing performance without exposing private values.</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="h-48 bg-muted rounded-lg flex items-center justify-center border border-dashed">
                  <p className="text-sm text-muted-foreground italic text-center px-8">
                    "I believe in long-term wealth creation through diversified US equities and automated SIPs."
                  </p>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Award className="h-5 w-5 text-yellow-500" />
                  Recent Achievements
                </CardTitle>
              </CardHeader>
              <CardContent className="flex flex-wrap gap-3">
                <Badge variant="outline" className="py-1 px-3 gap-2">🌱 First Deposit</Badge>
                <Badge variant="outline" className="py-1 px-3 gap-2">🇺🇸 Global Explorer</Badge>
                <Badge variant="outline" className="py-1 px-3 gap-2">💹 Dividend Seeker</Badge>
                <Badge variant="outline" className="py-1 px-3 gap-2">💎 HODL Expert</Badge>
              </CardContent>
            </Card>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            <Card className="bg-primary text-primary-foreground border-none">
              <CardHeader>
                <CardTitle className="text-lg">Join {profile.firstName}</CardTitle>
                <CardDescription className="text-primary-foreground/80">
                  Start your own investment journey and get a reward.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <Button variant="secondary" className="w-full font-bold" asChild>
                  <Link href={`/register?ref=${code}`}>
                    Get Started <ArrowUpRight className="h-4 w-4 ml-2" />
                  </Link>
                </Button>
                <div className="text-[10px] text-center opacity-60">
                  Referral Bonus T&C Apply
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-sm flex items-center gap-2">
                  <Users className="h-4 w-4" />
                  Referral Network
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex -space-x-2 overflow-hidden mb-4">
                  {[1,2,3,4,5].map(i => (
                    <div key={i} className="inline-block h-8 w-8 rounded-full ring-2 ring-background bg-muted flex items-center justify-center text-[10px] font-bold">
                      {String.fromCharCode(64 + i)}
                    </div>
                  ))}
                  <div className="inline-block h-8 w-8 rounded-full ring-2 ring-background bg-primary/20 text-primary flex items-center justify-center text-[10px] font-bold">
                    +79
                  </div>
                </div>
                <p className="text-xs text-muted-foreground">
                  Join 84 others who started investing via this network.
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
