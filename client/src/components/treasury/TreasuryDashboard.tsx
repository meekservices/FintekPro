import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { 
  ArrowUpRight, 
  ArrowDownLeft, 
  Wallet, 
  Building2, 
  TrendingUp, 
  AlertCircle,
  RefreshCcw,
  Plus,
  ArrowRight
} from "lucide-react";
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer, 
  AreaChart, 
  Area,
  Cell,
  PieChart,
  Pie
} from "recharts";

const data = [
  { name: 'Mon', inflow: 4000, outflow: 2400 },
  { name: 'Tue', inflow: 3000, outflow: 1398 },
  { name: 'Wed', inflow: 2000, outflow: 9800 },
  { name: 'Thu', inflow: 2780, outflow: 3908 },
  { name: 'Fri', inflow: 1890, outflow: 4800 },
  { name: 'Sat', inflow: 2390, outflow: 3800 },
  { name: 'Sun', inflow: 3490, outflow: 4300 },
];

const allocationData = [
  { name: 'HDFC Bank', value: 4500000, color: '#1e40af' },
  { name: 'ICICI Bank', value: 3200000, color: '#ea580c' },
  { name: 'Kotak Bank', value: 2800000, color: '#dc2626' },
  { name: 'Cashfree', value: 1500000, color: '#2563eb' },
];

import { TreasuryCopilotUI } from './TreasuryCopilotUI';
import { useQuery } from "@tanstack/react-query";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export function TreasuryDashboard() {
  const [isSyncing, setIsSyncing] = useState(false);
  const entityId = "demo-entity"; // In production, this would come from context

  const { data: positionData, isLoading: isLoadingPosition } = useQuery({
    queryKey: [`/api/treasury/entities/${entityId}/consolidated-position`],
  });

  const { data: forecastData, isLoading: isLoadingForecast } = useQuery({
    queryKey: [`/api/treasury/entities/${entityId}/forecast`], // We'll need to add this route or similar
    enabled: !!positionData,
  });

  const handleSync = () => {
    setIsSyncing(true);
    setTimeout(() => setIsSyncing(false), 2000);
  };

  const consolidatedCash = positionData?.success ? positionData.data.totalBalance : 124500000;
  const inflow = 4280000;
  const outflow = 1825000;

  return (
    <div className="p-6 space-y-6 bg-slate-50/50 dark:bg-slate-950/50 min-h-screen">
      {/* Header Section */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900 dark:text-slate-100">Treasury Cockpit</h1>
          <p className="text-slate-500 dark:text-slate-400">Real-time liquidity & corporate cash management</p>
        </div>
        <div className="flex items-center gap-3">
          <Button 
            variant="outline" 
            size="sm" 
            onClick={handleSync}
            disabled={isSyncing}
            className="bg-white dark:bg-slate-900 shadow-sm"
          >
            <RefreshCcw className={`w-4 h-4 mr-2 ${isSyncing ? 'animate-spin' : ''}`} />
            Sync All Banks
          </Button>
          <Button size="sm" className="bg-indigo-600 hover:bg-indigo-700 text-white shadow-md transition-all active:scale-95">
            <Plus className="w-4 h-4 mr-2" />
            New Payout
          </Button>
        </div>
      </div>

      <Tabs defaultValue="overview" className="space-y-6">
        <TabsList className="bg-white dark:bg-slate-900 border shadow-sm p-1">
          <TabsTrigger value="overview" className="px-6">Overview</TabsTrigger>
          <TabsTrigger value="liquidity" className="px-6">Liquidity Forecast</TabsTrigger>
          <TabsTrigger value="banks" className="px-6">Bank Accounts</TabsTrigger>
          <TabsTrigger value="payouts" className="px-6">Payout History</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6 mt-0">


      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="border-none shadow-sm bg-gradient-to-br from-indigo-500 to-indigo-600 text-white">
          <CardContent className="pt-6">
            <div className="flex justify-between items-start">
              <div>
                <p className="text-indigo-100 text-sm font-medium">Consolidated Cash</p>
                <h3 className="text-2xl font-bold mt-1">₹12.45 Cr</h3>
                <p className="text-indigo-100 text-xs mt-1 flex items-center">
                  <TrendingUp className="w-3 h-3 mr-1" />
                  +4.2% from last week
                </p>
              </div>
              <div className="p-2 bg-indigo-400/30 rounded-lg">
                <Wallet className="w-5 h-5" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-none shadow-sm bg-white dark:bg-slate-900">
          <CardContent className="pt-6">
            <div className="flex justify-between items-start">
              <div>
                <p className="text-slate-500 dark:text-slate-400 text-sm font-medium">Daily Inflow</p>
                <h3 className="text-2xl font-bold mt-1 text-emerald-600 dark:text-emerald-400">₹42.80 L</h3>
                <p className="text-slate-400 text-xs mt-1">Across 128 transactions</p>
              </div>
              <div className="p-2 bg-emerald-100 dark:bg-emerald-900/30 rounded-lg">
                <ArrowUpRight className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-none shadow-sm bg-white dark:bg-slate-900">
          <CardContent className="pt-6">
            <div className="flex justify-between items-start">
              <div>
                <p className="text-slate-500 dark:text-slate-400 text-sm font-medium">Daily Outflow</p>
                <h3 className="text-2xl font-bold mt-1 text-rose-600 dark:text-rose-400">₹18.25 L</h3>
                <p className="text-slate-400 text-xs mt-1">94.2% payout success rate</p>
              </div>
              <div className="p-2 bg-rose-100 dark:bg-rose-900/30 rounded-lg">
                <ArrowDownLeft className="w-5 h-5 text-rose-600 dark:text-rose-400" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-none shadow-sm bg-white dark:bg-slate-900">
          <CardContent className="pt-6">
            <div className="flex justify-between items-start">
              <div>
                <p className="text-slate-500 dark:text-slate-400 text-sm font-medium">FX Exposure</p>
                <h3 className="text-2xl font-bold mt-1">$450.2k</h3>
                <p className="text-amber-500 text-xs mt-1 flex items-center">
                  <AlertCircle className="w-3 h-3 mr-1" />
                  Hedge coverage: 65%
                </p>
              </div>
              <div className="p-2 bg-amber-100 dark:bg-amber-900/30 rounded-lg">
                <TrendingUp className="w-5 h-5 text-amber-600 dark:text-amber-400" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Cash Flow Chart */}
        <Card className="lg:col-span-2 border-none shadow-sm bg-white dark:bg-slate-900">
          <CardHeader>
            <CardTitle className="text-lg">Liquidity Forecast</CardTitle>
            <CardDescription>7-day projected cash movement</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[300px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={data}>
                  <defs>
                    <linearGradient id="colorInflow" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10b981" stopOpacity={0.1}/>
                      <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                    </linearGradient>
                    <linearGradient id="colorOutflow" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#f43f5e" stopOpacity={0.1}/>
                      <stop offset="95%" stopColor="#f43f5e" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                  <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: '#94a3b8', fontSize: 12}} />
                  <YAxis axisLine={false} tickLine={false} tick={{fill: '#94a3b8', fontSize: 12}} />
                  <Tooltip 
                    contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                  />
                  <Area type="monotone" dataKey="inflow" stroke="#10b981" strokeWidth={2} fillOpacity={1} fill="url(#colorInflow)" />
                  <Area type="monotone" dataKey="outflow" stroke="#f43f5e" strokeWidth={2} fillOpacity={1} fill="url(#colorOutflow)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Bank Allocation */}
        <Card className="border-none shadow-sm bg-white dark:bg-slate-900">
          <CardHeader>
            <CardTitle className="text-lg">Bank Allocation</CardTitle>
            <CardDescription>Consolidated balance distribution</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[250px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={allocationData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={80}
                    paddingAngle={5}
                    dataKey="value"
                  >
                    {allocationData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="mt-4 space-y-2">
              {allocationData.map((bank) => (
                <div key={bank.name} className="flex justify-between items-center text-sm">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full" style={{backgroundColor: bank.color}} />
                    <span className="text-slate-600 dark:text-slate-300">{bank.name}</span>
                  </div>
                  <span className="font-semibold text-slate-900 dark:text-slate-100">
                    ₹{(bank.value / 100000).toFixed(1)}L
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Recent Payouts Table */}
      <Card className="border-none shadow-sm bg-white dark:bg-slate-900">
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-lg">Recent Treasury Payouts</CardTitle>
            <CardDescription>Monitor your corporate disbursements</CardDescription>
          </div>
          <Button variant="ghost" size="sm" className="text-indigo-600">
            View All <ArrowRight className="w-4 h-4 ml-1" />
          </Button>
        </CardHeader>
        <CardContent>
          <div className="relative w-full overflow-auto">
            <table className="w-full text-sm text-left">
              <thead>
                <tr className="border-b dark:border-slate-800 text-slate-500 dark:text-slate-400">
                  <th className="pb-3 font-medium">Beneficiary</th>
                  <th className="pb-3 font-medium">Bank / Method</th>
                  <th className="pb-3 font-medium">Amount</th>
                  <th className="pb-3 font-medium">Status</th>
                  <th className="pb-3 font-medium">Date</th>
                </tr>
              </thead>
              <tbody className="divide-y dark:divide-slate-800">
                {[
                  { name: 'Cloud Services Inc', method: 'Cashfree', amount: '₹4.50 L', status: 'Success', date: 'Today' },
                  { name: 'Stellar Logistics', method: 'HDFC NEFT', amount: '₹12.80 L', status: 'Processing', date: 'Today' },
                  { name: 'Global Rent Co', method: 'ICICI IMPS', amount: '₹8.25 L', status: 'Success', date: 'Yesterday' },
                  { name: 'Payroll Batch #42', method: 'Bulk Payout', amount: '₹85.40 L', status: 'Success', date: '2 days ago' },
                ].map((item, i) => (
                  <tr key={i} className="group hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                    <td className="py-4 font-medium text-slate-900 dark:text-slate-100">{item.name}</td>
                    <td className="py-4 text-slate-500 dark:text-slate-400">
                      <div className="flex items-center gap-2">
                        <Building2 className="w-4 h-4" />
                        {item.method}
                      </div>
                    </td>
                    <td className="py-4 font-semibold text-slate-900 dark:text-slate-100">{item.amount}</td>
                    <td className="py-4">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                        item.status === 'Success' 
                          ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' 
                          : 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'
                      }`}>
                        {item.status}
                      </span>
                    </td>
                    <td className="py-4 text-slate-400">{item.date}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

        </TabsContent>

        <TabsContent value="liquidity" className="mt-0">
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
            <Card className="lg:col-span-3 border-none shadow-sm bg-white dark:bg-slate-900">
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle>AI-Driven Cash Forecast</CardTitle>
                  <CardDescription>30-day liquidity projection based on historical patterns</CardDescription>
                </div>
                <Badge variant="outline" className="bg-indigo-50 text-indigo-700 border-indigo-200">
                  <Bot className="w-3 h-3 mr-1" />
                  AI Powered
                </Badge>
              </CardHeader>
              <CardContent>
                <div className="h-[400px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={data}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} />
                      <XAxis dataKey="name" />
                      <YAxis />
                      <Tooltip />
                      <Area type="monotone" dataKey="inflow" stroke="#10b981" fill="#10b981" fillOpacity={0.1} />
                      <Area type="monotone" dataKey="outflow" stroke="#f43f5e" fill="#f43f5e" fillOpacity={0.1} />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            <div className="space-y-6">
              <Card className="border-none shadow-sm bg-indigo-600 text-white">
                <CardHeader>
                  <CardTitle className="text-sm font-medium flex items-center gap-2">
                    <Bot className="w-4 h-4" />
                    Copilot Insight
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-xs text-indigo-100 leading-relaxed">
                    "Based on upcoming tax outflows and historical vendor payment cycles, 
                    we expect a ₹1.2 Cr liquidity dip on Wednesday. 
                    I recommend sweeping ₹80L from your Kotak account to HDFC to maintain the buffer."
                  </p>
                  <Button variant="outline" size="sm" className="w-full mt-4 bg-white/10 border-white/20 text-white hover:bg-white/20">
                    Execute Sweep
                  </Button>
                </CardContent>
              </Card>

              <Card className="border-none shadow-sm bg-white dark:bg-slate-900">
                <CardHeader>
                  <CardTitle className="text-sm font-medium">Risk Analysis</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-amber-100 rounded-full">
                      <AlertCircle className="w-4 h-4 text-amber-600" />
                    </div>
                    <div>
                      <p className="text-xs font-semibold">Projected Shortfall</p>
                      <p className="text-[10px] text-slate-500">Day 12: -₹4.5L estimated</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-emerald-100 rounded-full">
                      <TrendingUp className="w-4 h-4 text-emerald-600" />
                    </div>
                    <div>
                      <p className="text-xs font-semibold">Idle Cash Yield</p>
                      <p className="text-[10px] text-slate-500">+₹1.2k potential gain/day</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="banks">
          {/* Bank Management Content */}
        </TabsContent>

        <TabsContent value="payouts">
          {/* Payout History Content */}
        </TabsContent>
      </Tabs>

      <TreasuryCopilotUI />
    </div>
  );
}

