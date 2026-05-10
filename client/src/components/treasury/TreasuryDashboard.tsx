import React, { useState } from 'react';
import { 
  Building2, Wallet, TrendingUp, ArrowUpRight, ArrowDownRight, 
  History, Calendar, Filter, Download, Plus, Search,
  AlertCircle, ChevronRight, BarChart3, ShieldCheck, 
  RefreshCcw, Bot, MessageSquare, ArrowRight, Layers
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { 
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, 
  ResponsiveContainer, BarChart, Bar, Cell, PieChart, Pie
} from 'recharts';
import { TreasuryCopilotUI } from "./TreasuryCopilotUI";

const data = [
  { name: '01 May', inflow: 4000, outflow: 2400, balance: 2400 },
  { name: '05 May', inflow: 3000, outflow: 1398, balance: 4002 },
  { name: '10 May', inflow: 2000, outflow: 9800, balance: -3798 },
  { name: '15 May', inflow: 2780, outflow: 3908, balance: -4926 },
  { name: '20 May', inflow: 1890, outflow: 4800, balance: -7836 },
  { name: '25 May', inflow: 2390, outflow: 3800, balance: -9246 },
  { name: '30 May', inflow: 3490, outflow: 4300, balance: -10056 },
];

const bankAccounts = [
  { name: 'HDFC Bank', account: 'XXXX4829', balance: '₹42.50 L', status: 'Active', color: '#1e40af' },
  { name: 'ICICI Bank', account: 'XXXX1102', balance: '₹12.80 L', status: 'Active', color: '#ea580c' },
  { name: 'Kotak Mahindra', account: 'XXXX9931', balance: '₹8.25 L', status: 'Active', color: '#dc2626' },
];

export function TreasuryDashboard() {
  const [activeTab, setActiveTab] = useState("overview");

  return (
    <div className="p-6 space-y-8 bg-slate-50/50 dark:bg-slate-950 min-h-screen">
      {/* Header Section */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900 dark:text-white flex items-center gap-3">
            <Building2 className="w-8 h-8 text-indigo-600" />
            Treasury Operating System
          </h1>
          <p className="text-slate-500 dark:text-slate-400 mt-1">
            Real-time corporate liquidity & AI-native cash management
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Button variant="outline" className="gap-2">
            <Download className="w-4 h-4" /> Export Report
          </Button>
          <Button className="bg-indigo-600 hover:bg-indigo-700 gap-2">
            <Plus className="w-4 h-4" /> Add Entity
          </Button>
        </div>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Total Treasury Balance', value: '₹63.55 L', trend: '+12.5%', icon: Wallet, color: 'indigo' },
          { label: 'Avg Daily Inflow', value: '₹4.20 L', trend: '+5.2%', icon: ArrowUpRight, color: 'emerald' },
          { label: 'Avg Daily Outflow', value: '₹3.85 L', trend: '-2.1%', icon: ArrowDownRight, color: 'rose' },
          { label: 'Net Liquidity Pose', value: '₹22.10 L', trend: 'Healthy', icon: ShieldCheck, color: 'blue' },
        ].map((stat, i) => (
          <Card key={i} className="border-none shadow-sm bg-white dark:bg-slate-900 overflow-hidden relative">
            <div className={`absolute top-0 left-0 w-1 h-full bg-${stat.color}-500`} />
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-slate-500 dark:text-slate-400">{stat.label}</CardTitle>
              <stat.icon className={`w-4 h-4 text-${stat.color}-500`} />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-slate-900 dark:text-white">{stat.value}</div>
              <p className={`text-xs mt-1 ${stat.trend.startsWith('+') ? 'text-emerald-500' : 'text-slate-400'}`}>
                {stat.trend} from last month
              </p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="bg-white dark:bg-slate-900 p-1 border dark:border-slate-800">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="liquidity">Liquidity Analysis</TabsTrigger>
          <TabsTrigger value="banks">Entities & Accounts</TabsTrigger>
          <TabsTrigger value="payouts">Payout Operations</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6 mt-0">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Primary Cash Flow Chart */}
            <Card className="lg:col-span-2 border-none shadow-sm bg-white dark:bg-slate-900">
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle>Global Cash Position</CardTitle>
                  <CardDescription>Consolidated real-time view across all connected entities</CardDescription>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="secondary" className="bg-slate-100 dark:bg-slate-800">Real-time</Badge>
                  <Button variant="ghost" size="icon" className="h-8 w-8">
                    <RefreshCcw className="h-4 w-4 text-slate-400" />
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="h-[300px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={data}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                      <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fontSize: 12, fill: '#64748b'}} />
                      <YAxis axisLine={false} tickLine={false} tick={{fontSize: 12, fill: '#64748b'}} />
                      <Tooltip 
                        contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                        cursor={{fill: '#f1f5f9'}}
                      />
                      <Bar dataKey="inflow" fill="#6366f1" radius={[4, 4, 0, 0]} barSize={24} />
                      <Bar dataKey="outflow" fill="#94a3b8" radius={[4, 4, 0, 0]} barSize={24} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            {/* Bank Distribution */}
            <Card className="border-none shadow-sm bg-white dark:bg-slate-900">
              <CardHeader>
                <CardTitle>Treasury Distribution</CardTitle>
                <CardDescription>Allocation across banking partners</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="h-[240px] w-full relative">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={[
                          { name: 'HDFC', value: 42.5, color: '#1e40af' },
                          { name: 'ICICI', value: 12.8, color: '#ea580c' },
                          { name: 'Kotak', value: 8.25, color: '#dc2626' },
                        ]}
                        innerRadius={60}
                        outerRadius={80}
                        paddingAngle={5}
                        dataKey="value"
                      >
                        {[
                          { name: 'HDFC', value: 42.5, color: '#1e40af' },
                          { name: 'ICICI', value: 12.8, color: '#ea580c' },
                          { name: 'Kotak', value: 8.25, color: '#dc2626' },
                        ].map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                    <span className="text-2xl font-bold">₹63.5L</span>
                    <span className="text-[10px] text-slate-400 uppercase tracking-wider">Total</span>
                  </div>
                </div>
                <div className="space-y-2 mt-4">
                  {[
                    { name: 'HDFC Bank', value: 4250000, color: '#1e40af' },
                    { name: 'ICICI Bank', value: 1280000, color: '#ea580c' },
                    { name: 'Kotak Mahindra', value: 825000, color: '#dc2626' },
                  ].map((bank) => (
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
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {bankAccounts.map((account) => (
              <Card key={account.account} className="border-none shadow-sm bg-white dark:bg-slate-900">
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg flex items-center justify-center text-white" style={{backgroundColor: account.color}}>
                      <Building2 className="w-6 h-6" />
                    </div>
                    <div>
                      <CardTitle className="text-sm font-bold">{account.name}</CardTitle>
                      <CardDescription className="text-[10px]">{account.account}</CardDescription>
                    </div>
                  </div>
                  <Badge variant="outline" className="text-emerald-500 border-emerald-200">
                    {account.status}
                  </Badge>
                </CardHeader>
                <CardContent className="pt-4">
                  <div className="text-xl font-bold">{account.balance}</div>
                  <div className="flex items-center justify-between mt-4">
                    <Button variant="ghost" size="sm" className="h-8 text-xs">Manage</Button>
                    <Button variant="ghost" size="sm" className="h-8 text-xs gap-1">
                      <RefreshCcw className="w-3 h-3" /> Sync
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
            <Card className="border-dashed border-2 flex flex-col items-center justify-center p-6 bg-slate-50/50 dark:bg-slate-900/50 cursor-pointer hover:bg-slate-100 transition-colors">
              <Plus className="w-8 h-8 text-slate-400 mb-2" />
              <p className="text-sm font-medium text-slate-600">Link New Bank Account</p>
              <p className="text-[10px] text-slate-400">Support for 50+ Indian Banks</p>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="payouts">
          <Card className="border-none shadow-sm">
            <CardHeader>
              <CardTitle>Bulk Payout Operations</CardTitle>
              <CardDescription>Initiate and track high-volume corporate disbursements</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-4 mb-6">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <Input placeholder="Search by batch ID, beneficiary or status..." className="pl-10" />
                </div>
                <Button variant="outline" className="gap-2">
                  <Filter className="w-4 h-4" /> Filters
                </Badge>
                <Button className="bg-indigo-600 gap-2">
                  <Layers className="w-4 h-4" /> New Batch
                </Button>
              </div>
              {/* Table logic same as overview for now */}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <TreasuryCopilotUI />
    </div>
  );
}
