import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ScrollableTabsList } from "@/components/ScrollableTabsList";
import { HeartPulse, Search, MessageCircle, ExternalLink, RefreshCw, IndianRupee, TrendingUp, AlertCircle, CheckCircle2 } from "lucide-react";
import { format } from "date-fns";

interface SipItem {
  id: string;
  clientId: string;
  clientName: string;
  clientPhone: string | null;
  fundName: string;
  isin: string | null;
  folio: string | null;
  sipAmount: number;
  frequency: string;
  status: "active" | "expiring" | "lapsed" | "paused";
  lastDebitDate: string | null;
  nextDebitDate: string | null;
  marketValue: number;
}

interface SipHealthData {
  summary: {
    totalActive: number;
    expiringIn30d: number;
    lapsed: number;
    totalMonthlySipAmount: number;
  };
  items: SipItem[];
}

const STATUS_CONFIG = {
  active: { label: "Active", color: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200" },
  expiring: { label: "Expiring Soon", color: "bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200" },
  lapsed: { label: "Lapsed", color: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200" },
  paused: { label: "Paused", color: "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200" },
};

function formatCurrency(n: number) {
  if (n >= 10000000) return `₹${(n / 10000000).toFixed(1)}Cr`;
  if (n >= 100000) return `₹${(n / 100000).toFixed(1)}L`;
  if (n >= 1000) return `₹${(n / 1000).toFixed(0)}K`;
  return `₹${n.toFixed(0)}`;
}

function buildWhatsAppMessage(item: SipItem) {
  const msg = `Hi ${item.clientName.split(" ")[0]}, your SIP of ${formatCurrency(item.sipAmount)}/month in ${item.fundName} ${item.status === "lapsed" ? "has lapsed" : "is expiring soon"}. Please renew to continue your investment journey. Contact me for assistance.`;
  const phone = item.clientPhone?.replace(/\D/g, "") || "";
  return `https://wa.me/${phone.startsWith("91") ? phone : "91" + phone}?text=${encodeURIComponent(msg)}`;
}

export default function AgentSipHealth() {
  const [search, setSearch] = useState("");
  const [activeTab, setActiveTab] = useState("all");

  const { data, isLoading, refetch, isFetching } = useQuery<SipHealthData>({
    queryKey: ["/api/agent/sip-health"],
    refetchInterval: false,
  });

  const items = data?.items || [];
  const summary = data?.summary || { totalActive: 0, expiringIn30d: 0, lapsed: 0, totalMonthlySipAmount: 0 };

  const filtered = items.filter((item) => {
    const matchSearch =
      !search ||
      item.clientName.toLowerCase().includes(search.toLowerCase()) ||
      item.fundName.toLowerCase().includes(search.toLowerCase());
    const matchTab = activeTab === "all" || item.status === activeTab || (activeTab === "expiring" && item.status === "expiring");
    return matchSearch && matchTab;
  });

  return (
    <div className="container max-w-7xl mx-auto p-4 sm:p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <HeartPulse className="h-6 w-6 text-primary" />
            SIP Health Monitor
          </h1>
          <p className="text-sm text-muted-foreground mt-1">Track SIP status across all your clients</p>
        </div>
        <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isFetching} className="gap-2">
          <RefreshCw className={`h-4 w-4 ${isFetching ? "animate-spin" : ""}`} /> Refresh
        </Button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">Active SIPs</p>
                <p className="text-2xl font-bold text-green-600">{summary.totalActive}</p>
              </div>
              <CheckCircle2 className="h-8 w-8 text-green-500 opacity-60" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">Expiring in 30d</p>
                <p className="text-2xl font-bold text-amber-600">{summary.expiringIn30d}</p>
              </div>
              <AlertCircle className="h-8 w-8 text-amber-500 opacity-60" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">Lapsed SIPs</p>
                <p className="text-2xl font-bold text-red-600">{summary.lapsed}</p>
              </div>
              <AlertCircle className="h-8 w-8 text-red-500 opacity-60" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">Monthly SIP Volume</p>
                <p className="text-2xl font-bold">{formatCurrency(summary.totalMonthlySipAmount)}</p>
              </div>
              <IndianRupee className="h-8 w-8 text-primary opacity-60" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Search */}
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          className="pl-9"
          placeholder="Search client or fund..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <ScrollableTabsList className="w-full">
          <TabsTrigger value="all">All ({items.length})</TabsTrigger>
          <TabsTrigger value="lapsed" className="text-red-600">Lapsed ({summary.lapsed})</TabsTrigger>
          <TabsTrigger value="expiring" className="text-amber-600">Expiring ({summary.expiringIn30d})</TabsTrigger>
          <TabsTrigger value="active">Active ({summary.totalActive})</TabsTrigger>
        </ScrollableTabsList>

        <TabsContent value={activeTab} className="mt-4">
          {isLoading ? (
            <div className="text-center py-12 text-muted-foreground">Loading SIP data...</div>
          ) : filtered.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <HeartPulse className="h-12 w-12 mx-auto text-muted-foreground mb-3" />
                <p className="text-muted-foreground">
                  {items.length === 0
                    ? "No SIP data found. Clients need to link their portfolios."
                    : "No SIPs match your current filter."}
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="rounded-lg border overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Client</TableHead>
                    <TableHead>Fund</TableHead>
                    <TableHead className="text-right">SIP Amount</TableHead>
                    <TableHead>Frequency</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Last Debit</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((item) => (
                    <TableRow key={item.id} className={item.status === "lapsed" ? "bg-red-50/50 dark:bg-red-950/20" : item.status === "expiring" ? "bg-amber-50/50 dark:bg-amber-950/20" : ""}>
                      <TableCell className="font-medium">{item.clientName}</TableCell>
                      <TableCell className="max-w-[200px]">
                        <div className="text-sm truncate">{item.fundName}</div>
                        {item.folio && <div className="text-xs text-muted-foreground">Folio: {item.folio}</div>}
                      </TableCell>
                      <TableCell className="text-right font-medium">
                        {item.sipAmount > 0 ? formatCurrency(item.sipAmount) : "—"}
                      </TableCell>
                      <TableCell className="text-sm capitalize">{item.frequency}</TableCell>
                      <TableCell>
                        <Badge className={`text-xs ${STATUS_CONFIG[item.status]?.color}`}>
                          {STATUS_CONFIG[item.status]?.label}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {item.lastDebitDate ? format(new Date(item.lastDebitDate), "dd MMM yy") : "—"}
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          {item.clientPhone && (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 px-2 gap-1 text-green-600"
                              onClick={() => window.open(buildWhatsAppMessage(item), "_blank")}
                            >
                              <MessageCircle className="h-3 w-3" /> WhatsApp
                            </Button>
                          )}
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 px-2 gap-1"
                            onClick={() => window.open(`/agent/crm/clients/${item.clientId}`, "_blank")}
                          >
                            <ExternalLink className="h-3 w-3" /> Profile
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
