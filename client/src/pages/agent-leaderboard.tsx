import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/hooks/useAuth";
import {
  Trophy,
  Medal,
  Crown,
  TrendingUp,
  Users,
  IndianRupee,
  Target,
  Flame,
  Star,
  Zap,
  Award,
  ArrowUp,
  ArrowDown,
  Minus,
  Sparkles,
  BadgeCheck,
  Briefcase
} from "lucide-react";

interface AgentLeaderboardEntry {
  id: string;
  name: string;
  avatar?: string;
  rank: number;
  previousRank: number;
  totalAUM: number;
  commissionMTD: number;
  commissionYTD: number;
  activeClients: number;
  dealsClosedThisMonth: number;
  leadConversionRate: number;
  streak: number;
  achievements: string[];
}

interface LeaderboardData {
  agents: AgentLeaderboardEntry[];
  currentUserRank?: AgentLeaderboardEntry;
  totalAgents: number;
}

const achievementIcons: Record<string, { icon: typeof Trophy; color: string; label: string }> = {
  top_closer: { icon: Target, color: "text-red-400", label: "Top Closer" },
  client_magnet: { icon: Users, color: "text-blue-400", label: "Client Magnet" },
  revenue_king: { icon: Crown, color: "text-yellow-400", label: "Revenue King" },
  rising_star: { icon: Star, color: "text-purple-400", label: "Rising Star" },
  deal_machine: { icon: Zap, color: "text-orange-400", label: "Deal Machine" },
  consistent_performer: { icon: BadgeCheck, color: "text-emerald-400", label: "Consistent Performer" },
};


export default function AgentLeaderboard() {
  const { user } = useAuth();
  const [period, setPeriod] = useState("month");

  const { data: leaderboardData, isLoading } = useQuery<LeaderboardData>({
    queryKey: [`/api/agent/leaderboard?period=${period}`],
  });

  const agents = leaderboardData?.agents || [];
  const totalAgents = leaderboardData?.totalAgents || 0;
  
  const currentUserRank = leaderboardData?.currentUserRank;

  const formatCurrency = (value: number) => {
    if (value >= 10000000) {
      return `₹${(value / 10000000).toFixed(2)} Cr`;
    } else if (value >= 100000) {
      return `₹${(value / 100000).toFixed(2)} L`;
    } else if (value >= 1000) {
      return `₹${(value / 1000).toFixed(1)} K`;
    }
    return `₹${value.toFixed(0)}`;
  };

  const getRankBadge = (rank: number) => {
    if (rank === 1) {
      return (
        <div className="flex items-center justify-center w-10 h-10 rounded-full bg-gradient-to-br from-yellow-400 to-amber-600 shadow-lg shadow-yellow-500/30">
          <Crown className="h-5 w-5 text-foreground" />
        </div>
      );
    }
    if (rank === 2) {
      return (
        <div className="flex items-center justify-center w-10 h-10 rounded-full bg-gradient-to-br from-slate-300 to-slate-500 shadow-lg shadow-slate-400/30">
          <Medal className="h-5 w-5 text-foreground" />
        </div>
      );
    }
    if (rank === 3) {
      return (
        <div className="flex items-center justify-center w-10 h-10 rounded-full bg-gradient-to-br from-amber-600 to-orange-800 shadow-lg shadow-orange-500/30">
          <Award className="h-5 w-5 text-foreground" />
        </div>
      );
    }
    return (
      <div className="flex items-center justify-center w-10 h-10 rounded-full bg-muted text-muted-foreground font-bold text-lg">
        {rank}
      </div>
    );
  };

  const getRankChange = (current: number, previous: number) => {
    const diff = previous - current;
    if (diff > 0) {
      return (
        <div className="flex items-center text-emerald-400 text-xs">
          <ArrowUp className="h-3 w-3" />
          <span>{diff}</span>
        </div>
      );
    }
    if (diff < 0) {
      return (
        <div className="flex items-center text-red-400 text-xs">
          <ArrowDown className="h-3 w-3" />
          <span>{Math.abs(diff)}</span>
        </div>
      );
    }
    return (
      <div className="flex items-center text-muted-foreground text-xs">
        <Minus className="h-3 w-3" />
      </div>
    );
  };

  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-emerald-500"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h1 className="text-2xl font-bold text-foreground flex items-center gap-2" data-testid="text-leaderboard-title">
              <Trophy className="h-7 w-7 text-yellow-500" />
              Agent Leaderboard
            </h1>
            <p className="text-muted-foreground mt-1">Compete, achieve, and climb the ranks</p>
          </div>
          <Select value={period} onValueChange={setPeriod}>
            <SelectTrigger className="w-40 bg-card border-border text-foreground" data-testid="select-period">
              <SelectValue placeholder="Select period" />
            </SelectTrigger>
            <SelectContent className="bg-card border-border">
              <SelectItem value="week">This Week</SelectItem>
              <SelectItem value="month">This Month</SelectItem>
              <SelectItem value="quarter">This Quarter</SelectItem>
              <SelectItem value="year">This Year</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {currentUserRank && (
          <Card className="bg-gradient-to-r from-emerald-900/50 via-emerald-800/30 to-teal-900/50 border-emerald-700/50" data-testid="card-my-rank">
            <CardHeader className="pb-2">
              <CardTitle className="text-lg text-emerald-300 flex items-center gap-2">
                <Sparkles className="h-5 w-5" />
                My Rank
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col md:flex-row items-start md:items-center gap-6">
                <div className="flex items-center gap-4">
                  <div className="relative">
                    <div className="flex items-center justify-center w-16 h-16 rounded-full bg-emerald-600 text-white text-2xl font-bold">
                      #{currentUserRank.rank}
                    </div>
                    {getRankChange(currentUserRank.rank, currentUserRank.previousRank)}
                  </div>
                  <div>
                    <p className="text-xl font-bold text-foreground" data-testid="text-my-name">{currentUserRank.name}</p>
                    <p className="text-muted-foreground text-sm">Rank {currentUserRank.rank} of {totalAgents} agents</p>
                  </div>
                </div>

                <div className="flex-1 grid grid-cols-2 md:grid-cols-5 gap-4">
                  <div className="text-center">
                    <p className="text-muted-foreground text-xs">AUM</p>
                    <p className="text-foreground font-semibold" data-testid="text-my-aum">{formatCurrency(currentUserRank.totalAUM)}</p>
                  </div>
                  <div className="text-center">
                    <p className="text-muted-foreground text-xs">Commission MTD</p>
                    <p className="text-foreground font-semibold" data-testid="text-my-commission-mtd">{formatCurrency(currentUserRank.commissionMTD)}</p>
                  </div>
                  <div className="text-center">
                    <p className="text-muted-foreground text-xs">Active Clients</p>
                    <p className="text-foreground font-semibold" data-testid="text-my-clients">{currentUserRank.activeClients}</p>
                  </div>
                  <div className="text-center">
                    <p className="text-muted-foreground text-xs">Deals This Month</p>
                    <p className="text-foreground font-semibold" data-testid="text-my-deals">{currentUserRank.dealsClosedThisMonth}</p>
                  </div>
                  <div className="text-center">
                    <p className="text-muted-foreground text-xs">Conversion Rate</p>
                    <p className="text-foreground font-semibold" data-testid="text-my-conversion">{currentUserRank.leadConversionRate}%</p>
                  </div>
                </div>

                {currentUserRank.streak > 0 && (
                  <div className="flex items-center gap-2 bg-orange-500/20 px-3 py-2 rounded-lg">
                    <Flame className="h-5 w-5 text-orange-400" />
                    <span className="text-orange-300 font-semibold">{currentUserRank.streak} week streak</span>
                  </div>
                )}

                <div className="flex gap-2">
                  {currentUserRank.achievements.map((achievement) => {
                    const config = achievementIcons[achievement];
                    if (!config) return null;
                    const Icon = config.icon;
                    return (
                      <div
                        key={achievement}
                        className="p-2 bg-card rounded-lg"
                        title={config.label}
                      >
                        <Icon className={`h-5 w-5 ${config.color}`} />
                      </div>
                    );
                  })}
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {agents.length === 0 && !currentUserRank && (
          <Card className="bg-background border-border">
            <CardContent className="py-12 text-center">
              <Trophy className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold text-foreground mb-2">No Leaderboard Data</h3>
              <p className="text-muted-foreground">Start closing deals to appear on the leaderboard!</p>
            </CardContent>
          </Card>
        )}

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {agents.slice(0, 3).map((agent, index) => (
            <Card
              key={agent.id}
              className={`relative overflow-hidden ${
                index === 0
                  ? "bg-gradient-to-br from-yellow-900/30 to-amber-800/20 border-yellow-700/50"
                  : index === 1
                  ? "bg-gradient-to-br from-slate-700/30 to-slate-600/20 border-border/50"
                  : "bg-gradient-to-br from-orange-900/30 to-amber-900/20 border-orange-700/50"
              }`}
              data-testid={`card-top-agent-${index + 1}`}
            >
              <div className="absolute top-3 right-3">
                {getRankBadge(agent.rank)}
              </div>
              <CardContent className="pt-6">
                <div className="flex flex-col items-center text-center">
                  <Avatar className="h-20 w-20 border-4 border-border mb-3">
                    <AvatarImage src={agent.avatar} />
                    <AvatarFallback className="bg-muted text-foreground text-xl">
                      {getInitials(agent.name)}
                    </AvatarFallback>
                  </Avatar>
                  <h3 className="text-lg font-bold text-foreground" data-testid={`text-agent-name-${agent.rank}`}>{agent.name}</h3>
                  <div className="flex items-center gap-1 mt-1">
                    {getRankChange(agent.rank, agent.previousRank)}
                  </div>
                  
                  <div className="w-full mt-4 space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">AUM</span>
                      <span className="text-foreground font-medium">{formatCurrency(agent.totalAUM)}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Commission YTD</span>
                      <span className="text-emerald-400 font-medium">{formatCurrency(agent.commissionYTD)}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Conversion</span>
                      <span className="text-foreground font-medium">{agent.leadConversionRate}%</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 mt-4">
                    {agent.streak > 0 && (
                      <Badge className="bg-orange-500/20 text-orange-300 hover:bg-orange-500/30">
                        <Flame className="h-3 w-3 mr-1" />
                        {agent.streak}w
                      </Badge>
                    )}
                    {agent.achievements.slice(0, 2).map((achievement) => {
                      const config = achievementIcons[achievement];
                      if (!config) return null;
                      const Icon = config.icon;
                      return (
                        <Badge
                          key={achievement}
                          className="bg-muted hover:bg-muted"
                          title={config.label}
                        >
                          <Icon className={`h-3 w-3 ${config.color}`} />
                        </Badge>
                      );
                    })}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        <Card className="bg-background/50 border-border">
          <CardHeader>
            <CardTitle className="text-lg text-foreground flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-emerald-500" />
              Full Rankings
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left py-3 px-4 text-muted-foreground text-sm font-medium">Rank</th>
                    <th className="text-left py-3 px-4 text-muted-foreground text-sm font-medium">Agent</th>
                    <th className="text-right py-3 px-4 text-muted-foreground text-sm font-medium">AUM</th>
                    <th className="text-right py-3 px-4 text-muted-foreground text-sm font-medium">Commission MTD</th>
                    <th className="text-right py-3 px-4 text-muted-foreground text-sm font-medium">Commission YTD</th>
                    <th className="text-right py-3 px-4 text-muted-foreground text-sm font-medium">Clients</th>
                    <th className="text-right py-3 px-4 text-muted-foreground text-sm font-medium">Deals</th>
                    <th className="text-right py-3 px-4 text-muted-foreground text-sm font-medium">Conversion</th>
                    <th className="text-center py-3 px-4 text-muted-foreground text-sm font-medium">Streak</th>
                    <th className="text-center py-3 px-4 text-muted-foreground text-sm font-medium">Achievements</th>
                  </tr>
                </thead>
                <tbody>
                  {agents.map((agent) => (
                    <tr
                      key={agent.id}
                      className="border-b border-border hover:bg-card/50 transition-colors"
                      data-testid={`row-agent-${agent.id}`}
                    >
                      <td className="py-4 px-4">
                        <div className="flex items-center gap-2">
                          {getRankBadge(agent.rank)}
                          {getRankChange(agent.rank, agent.previousRank)}
                        </div>
                      </td>
                      <td className="py-4 px-4">
                        <div className="flex items-center gap-3">
                          <Avatar className="h-8 w-8">
                            <AvatarImage src={agent.avatar} />
                            <AvatarFallback className="bg-muted text-foreground text-xs">
                              {getInitials(agent.name)}
                            </AvatarFallback>
                          </Avatar>
                          <span className="text-foreground font-medium">{agent.name}</span>
                        </div>
                      </td>
                      <td className="py-4 px-4 text-right">
                        <span className="text-foreground">{formatCurrency(agent.totalAUM)}</span>
                      </td>
                      <td className="py-4 px-4 text-right">
                        <span className="text-emerald-400">{formatCurrency(agent.commissionMTD)}</span>
                      </td>
                      <td className="py-4 px-4 text-right">
                        <span className="text-emerald-400">{formatCurrency(agent.commissionYTD)}</span>
                      </td>
                      <td className="py-4 px-4 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Users className="h-4 w-4 text-muted-foreground" />
                          <span className="text-foreground">{agent.activeClients}</span>
                        </div>
                      </td>
                      <td className="py-4 px-4 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Briefcase className="h-4 w-4 text-muted-foreground" />
                          <span className="text-foreground">{agent.dealsClosedThisMonth}</span>
                        </div>
                      </td>
                      <td className="py-4 px-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Progress
                            value={agent.leadConversionRate}
                            className="w-16 h-2"
                          />
                          <span className="text-foreground text-sm">{agent.leadConversionRate}%</span>
                        </div>
                      </td>
                      <td className="py-4 px-4 text-center">
                        {agent.streak > 0 ? (
                          <Badge className="bg-orange-500/20 text-orange-300">
                            <Flame className="h-3 w-3 mr-1" />
                            {agent.streak}w
                          </Badge>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </td>
                      <td className="py-4 px-4">
                        <div className="flex items-center justify-center gap-1">
                          {agent.achievements.length > 0 ? (
                            agent.achievements.slice(0, 3).map((achievement) => {
                              const config = achievementIcons[achievement];
                              if (!config) return null;
                              const Icon = config.icon;
                              return (
                                <div
                                  key={achievement}
                                  className="p-1.5 bg-card rounded"
                                  title={config.label}
                                >
                                  <Icon className={`h-4 w-4 ${config.color}`} />
                                </div>
                              );
                            })
                          ) : (
                            <span className="text-muted-foreground">-</span>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        <div className="grid grid-cols-2 md:grid-cols-6 gap-4">
          {Object.entries(achievementIcons).map(([key, config]) => {
            const Icon = config.icon;
            return (
              <Card key={key} className="bg-background/50 border-border">
                <CardContent className="pt-4 text-center">
                  <div className={`inline-flex p-3 rounded-lg bg-card mb-2`}>
                    <Icon className={`h-6 w-6 ${config.color}`} />
                  </div>
                  <p className="text-sm text-foreground font-medium">{config.label}</p>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>
    </div>
  );
}
