import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsTrigger } from "@/components/ui/tabs";
import { ScrollableTabsList } from "@/components/ScrollableTabsList";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import { 
  Receipt,
  Download,
  Filter,
  Calendar,
  IndianRupee,
  TrendingUp,
  Building2,
  Coins,
  FileText,
  Landmark,
  Package,
  CreditCard,
  Wallet,
  ArrowLeft,
  CheckCircle,
  Clock,
  XCircle,
  AlertCircle,
  RefreshCw,
  Search,
  FileDown
} from "lucide-react";
import { Link } from "wouter";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import type { UnifiedOrder } from "@shared/schema";

type TransactionSource = 'all' | 'fintekpro' | 'cashfree' | 'phonepe';
type TransactionStatus = 'all' | 'completed' | 'pending' | 'failed' | 'processing';
type ProductFilter = 'all' | 'mutual_fund' | 'bond' | 'ncd' | 'ipo' | 'unlisted' | 'store';

interface TransactionFilters {
  source: TransactionSource;
  status: TransactionStatus;
  product: ProductFilter;
  dateFrom: string;
  dateTo: string;
  searchQuery: string;
}

interface NormalizedTransaction {
  id: string;
  source: 'fintekpro' | 'cashfree' | 'phonepe';
  orderNumber: string;
  productType: string;
  productName: string;
  amount: number;
  currency: string;
  status: string;
  paymentMethod?: string;
  createdAt: string;
  completedAt?: string;
  metadata?: Record<string, any>;
}

const productLabels: Record<ProductFilter, string> = {
  all: 'All Products',
  mutual_fund: 'Mutual Funds',
  bond: 'Bonds',
  ncd: 'NCDs',
  ipo: 'IPOs',
  unlisted: 'Unlisted Shares',
  store: 'Store Products'
};

const sourceLabels: Record<TransactionSource, string> = {
  all: 'All Sources',
  fintekpro: 'FintekPro Orders',
  cashfree: 'Cashfree Payments',
  phonepe: 'PhonePe Payments'
};

const statusLabels: Record<TransactionStatus, string> = {
  all: 'All Statuses',
  completed: 'Completed',
  pending: 'Pending',
  failed: 'Failed',
  processing: 'Processing'
};

const getProductIcon = (product: string) => {
  switch (product) {
    case 'mutual_fund': return <Coins className="w-4 h-4" />;
    case 'bond': return <FileText className="w-4 h-4" />;
    case 'ncd': return <Landmark className="w-4 h-4" />;
    case 'ipo': return <TrendingUp className="w-4 h-4" />;
    case 'unlisted': return <Building2 className="w-4 h-4" />;
    case 'store': return <Package className="w-4 h-4" />;
    default: return <Receipt className="w-4 h-4" />;
  }
};

const getSourceIcon = (source: string) => {
  switch (source) {
    case 'fintekpro': return <Receipt className="w-4 h-4" />;
    case 'cashfree': return <CreditCard className="w-4 h-4" />;
    case 'phonepe': return <Wallet className="w-4 h-4" />;
    default: return <Receipt className="w-4 h-4" />;
  }
};

const getSourceColor = (source: string) => {
  switch (source) {
    case 'fintekpro': return 'bg-blue-100 text-blue-700 border-blue-200';
    case 'cashfree': return 'bg-purple-100 text-purple-700 border-purple-200';
    case 'phonepe': return 'bg-green-100 text-green-700 border-green-200';
    default: return 'bg-muted text-muted-foreground border-border';
  }
};

const getStatusColor = (status: string) => {
  const normalizedStatus = status?.toLowerCase() || '';
  if (normalizedStatus.includes('complet') || normalizedStatus.includes('success') || normalizedStatus === 'paid') {
    return 'bg-green-100 text-green-700 border-green-200';
  }
  if (normalizedStatus.includes('pend') || normalizedStatus.includes('process') || normalizedStatus === 'initiated') {
    return 'bg-yellow-100 text-yellow-700 border-yellow-200';
  }
  if (normalizedStatus.includes('fail') || normalizedStatus.includes('cancel') || normalizedStatus === 'rejected') {
    return 'bg-red-100 text-red-700 border-red-200';
  }
  return 'bg-muted text-muted-foreground border-border';
};

const getStatusIcon = (status: string) => {
  const normalizedStatus = status?.toLowerCase() || '';
  if (normalizedStatus.includes('complet') || normalizedStatus.includes('success') || normalizedStatus === 'paid') {
    return <CheckCircle className="w-4 h-4 text-green-600" />;
  }
  if (normalizedStatus.includes('pend') || normalizedStatus.includes('process') || normalizedStatus === 'initiated') {
    return <Clock className="w-4 h-4 text-yellow-600" />;
  }
  if (normalizedStatus.includes('fail') || normalizedStatus.includes('cancel') || normalizedStatus === 'rejected') {
    return <XCircle className="w-4 h-4 text-red-600" />;
  }
  return <AlertCircle className="w-4 h-4 text-muted-foreground" />;
};

const normalizeStatus = (status: string): TransactionStatus => {
  const s = status?.toLowerCase() || '';
  if (s.includes('complet') || s.includes('success') || s === 'paid') return 'completed';
  if (s.includes('pend') || s === 'initiated') return 'pending';
  if (s.includes('fail') || s.includes('cancel') || s === 'rejected') return 'failed';
  if (s.includes('process')) return 'processing';
  return 'pending';
};

function TransactionCard({ transaction }: { transaction: NormalizedTransaction }) {
  return (
    <div 
      className="p-4 border rounded-lg hover:shadow-md transition-shadow bg-card"
      data-testid={`transaction-card-${transaction.id}`}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-2 flex-wrap">
            {getProductIcon(transaction.productType)}
            <h3 className="font-semibold" data-testid={`text-transaction-name-${transaction.id}`}>
              {transaction.productName || transaction.orderNumber}
            </h3>
            <Badge 
              variant="outline" 
              className={getSourceColor(transaction.source)}
              data-testid={`badge-source-${transaction.id}`}
            >
              {getSourceIcon(transaction.source)}
              <span className="ml-1">{transaction.source === 'fintekpro' ? 'FintekPro' : transaction.source === 'cashfree' ? 'Cashfree' : 'PhonePe'}</span>
            </Badge>
            <Badge 
              variant="outline" 
              className={getStatusColor(transaction.status)}
              data-testid={`badge-status-${transaction.id}`}
            >
              {getStatusIcon(transaction.status)}
              <span className="ml-1 capitalize">{transaction.status}</span>
            </Badge>
          </div>
          
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div>
              <p className="text-muted-foreground">Order #</p>
              <p className="font-medium">{transaction.orderNumber}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Product Type</p>
              <p className="font-medium capitalize">{productLabels[transaction.productType as ProductFilter] || transaction.productType?.replace(/_/g, ' ')}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Amount</p>
              <p className="font-bold text-finance-blue">
                {transaction.currency === 'INR' ? '₹' : transaction.currency}{Number(transaction.amount).toLocaleString()}
              </p>
            </div>
            <div>
              <p className="text-muted-foreground">Date</p>
              <p className="font-medium">
                {new Date(transaction.createdAt).toLocaleDateString('en-IN', {
                  day: '2-digit',
                  month: 'short',
                  year: 'numeric'
                })}
              </p>
            </div>
          </div>

          {transaction.paymentMethod && (
            <div className="mt-2 text-sm text-muted-foreground">
              Payment: <span className="font-medium">{transaction.paymentMethod}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function TransactionSkeleton() {
  return (
    <div className="p-4 border rounded-lg bg-card">
      <div className="flex items-center gap-2 mb-3">
        <Skeleton className="w-4 h-4" />
        <Skeleton className="h-5 w-40" />
        <Skeleton className="h-5 w-20" />
        <Skeleton className="h-5 w-20" />
      </div>
      <div className="grid grid-cols-4 gap-4">
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-full" />
      </div>
    </div>
  );
}

export default function TransactionReports() {
  const [filters, setFilters] = useState<TransactionFilters>({
    source: 'all',
    status: 'all',
    product: 'all',
    dateFrom: '',
    dateTo: '',
    searchQuery: ''
  });

  const [activeTab, setActiveTab] = useState<string>('all');

  const { data: unifiedOrders = [], isLoading: ordersLoading, refetch: refetchOrders } = useQuery<UnifiedOrder[]>({
    queryKey: ['/api/unified-orders'],
  });

  const { data: cashfreeTransactions = [], isLoading: cashfreeLoading, refetch: refetchCashfree } = useQuery<any[]>({
    queryKey: ['/api/cashfree/transactions'],
  });

  const { data: phonePeTransactions = [], isLoading: phonePeLoading, refetch: refetchPhonePe } = useQuery<any[]>({
    queryKey: ['/api/phonepe/transactions'],
  });

  const isLoading = ordersLoading || cashfreeLoading || phonePeLoading;

  const normalizedTransactions: NormalizedTransaction[] = useMemo(() => {
    const transactions: NormalizedTransaction[] = [];

    unifiedOrders.forEach(order => {
      transactions.push({
        id: order.id,
        source: 'fintekpro',
        orderNumber: order.orderNumber,
        productType: order.productType,
        productName: order.productName,
        amount: Number(order.amount),
        currency: order.currency || 'INR',
        status: order.status || 'pending',
        paymentMethod: order.paymentGateway || undefined,
        createdAt: order.createdAt?.toString() || new Date().toISOString(),
        completedAt: order.completedAt?.toString(),
        metadata: order.metadata as Record<string, any>
      });
    });

    cashfreeTransactions.forEach(tx => {
      transactions.push({
        id: tx.id,
        source: 'cashfree',
        orderNumber: tx.orderId || tx.cashfreeOrderId,
        productType: tx.purpose || 'payment',
        productName: tx.description || 'Cashfree Payment',
        amount: Number(tx.amount),
        currency: tx.currency || 'INR',
        status: tx.status || 'pending',
        paymentMethod: tx.paymentMethod,
        createdAt: tx.createdAt?.toString() || new Date().toISOString(),
        completedAt: tx.completedAt?.toString(),
        metadata: tx
      });
    });

    phonePeTransactions.forEach(tx => {
      transactions.push({
        id: tx.id,
        source: 'phonepe',
        orderNumber: tx.merchantTransactionId || tx.transactionId,
        productType: tx.purpose || 'payment',
        productName: tx.description || 'PhonePe Payment',
        amount: Number(tx.amount),
        currency: tx.currency || 'INR',
        status: tx.status || 'pending',
        paymentMethod: tx.paymentMethod,
        createdAt: tx.createdAt?.toString() || new Date().toISOString(),
        completedAt: tx.completedAt?.toString(),
        metadata: tx
      });
    });

    return transactions.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, [unifiedOrders, cashfreeTransactions, phonePeTransactions]);

  const filteredTransactions = useMemo(() => {
    return normalizedTransactions.filter(tx => {
      if (filters.source !== 'all' && tx.source !== filters.source) return false;
      if (filters.status !== 'all' && normalizeStatus(tx.status) !== filters.status) return false;
      if (filters.product !== 'all' && tx.productType !== filters.product) return false;
      if (activeTab !== 'all' && tx.source !== activeTab) return false;
      
      if (filters.dateFrom) {
        const fromDate = new Date(filters.dateFrom);
        if (new Date(tx.createdAt) < fromDate) return false;
      }
      if (filters.dateTo) {
        const toDate = new Date(filters.dateTo);
        toDate.setHours(23, 59, 59, 999);
        if (new Date(tx.createdAt) > toDate) return false;
      }

      if (filters.searchQuery) {
        const query = filters.searchQuery.toLowerCase();
        if (!tx.orderNumber.toLowerCase().includes(query) && 
            !tx.productName.toLowerCase().includes(query)) {
          return false;
        }
      }

      return true;
    });
  }, [normalizedTransactions, filters, activeTab]);

  const stats = useMemo(() => {
    const total = filteredTransactions.length;
    const completed = filteredTransactions.filter(tx => normalizeStatus(tx.status) === 'completed').length;
    const pending = filteredTransactions.filter(tx => normalizeStatus(tx.status) === 'pending' || normalizeStatus(tx.status) === 'processing').length;
    const totalAmount = filteredTransactions.reduce((sum, tx) => sum + tx.amount, 0);
    const completedAmount = filteredTransactions
      .filter(tx => normalizeStatus(tx.status) === 'completed')
      .reduce((sum, tx) => sum + tx.amount, 0);
    
    return { total, completed, pending, totalAmount, completedAmount };
  }, [filteredTransactions]);

  const sourceStats = {
    all: normalizedTransactions.length,
    fintekpro: normalizedTransactions.filter(tx => tx.source === 'fintekpro').length,
    cashfree: normalizedTransactions.filter(tx => tx.source === 'cashfree').length,
    phonepe: normalizedTransactions.filter(tx => tx.source === 'phonepe').length
  };

  const handleRefresh = () => {
    refetchOrders();
    refetchCashfree();
    refetchPhonePe();
  };

  const handleExportCSV = () => {
    const csvData = filteredTransactions.map(tx => ({
      'Order Number': tx.orderNumber,
      'Source': tx.source,
      'Product Type': tx.productType,
      'Product Name': tx.productName,
      'Amount': tx.amount,
      'Currency': tx.currency,
      'Status': tx.status,
      'Payment Method': tx.paymentMethod || '',
      'Date': new Date(tx.createdAt).toLocaleDateString('en-IN')
    }));

    const headers = Object.keys(csvData[0] || {}).join(',');
    const rows = csvData.map(row => Object.values(row).map(v => `"${v}"`).join(',')).join('\n');
    const csv = `${headers}\n${rows}`;
    
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `transactions_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  const handleExportPDF = () => {
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    
    doc.setFontSize(20);
    doc.setTextColor(59, 130, 246);
    doc.text('FintekPro', 14, 20);
    
    doc.setFontSize(16);
    doc.setTextColor(0, 0, 0);
    doc.text('Transaction Report', 14, 30);
    
    doc.setFontSize(10);
    doc.setTextColor(100, 100, 100);
    doc.text(`Generated on: ${new Date().toLocaleDateString('en-IN', { 
      day: '2-digit', 
      month: 'long', 
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })}`, 14, 38);

    doc.setDrawColor(200, 200, 200);
    doc.line(14, 42, pageWidth - 14, 42);

    doc.setFontSize(11);
    doc.setTextColor(0, 0, 0);
    doc.text('Summary', 14, 52);
    
    doc.setFontSize(9);
    doc.setTextColor(60, 60, 60);
    const summaryY = 60;
    doc.text(`Total Transactions: ${stats.total}`, 14, summaryY);
    doc.text(`Completed: ${stats.completed}`, 70, summaryY);
    doc.text(`Pending: ${stats.pending}`, 120, summaryY);
    doc.text(`Total Value: ₹${stats.completedAmount.toLocaleString('en-IN')}`, 14, summaryY + 7);

    const tableData = filteredTransactions.map(tx => [
      tx.orderNumber,
      tx.source === 'fintekpro' ? 'FintekPro' : tx.source === 'cashfree' ? 'Cashfree' : 'PhonePe',
      productLabels[tx.productType as ProductFilter] || tx.productType?.replace(/_/g, ' '),
      tx.productName.length > 25 ? tx.productName.substring(0, 25) + '...' : tx.productName,
      `₹${Number(tx.amount).toLocaleString('en-IN')}`,
      tx.status,
      new Date(tx.createdAt).toLocaleDateString('en-IN')
    ]);

    autoTable(doc, {
      startY: 75,
      head: [['Order #', 'Source', 'Product Type', 'Product Name', 'Amount', 'Status', 'Date']],
      body: tableData,
      theme: 'striped',
      headStyles: { 
        fillColor: [59, 130, 246],
        textColor: 255,
        fontStyle: 'bold',
        fontSize: 8
      },
      bodyStyles: {
        fontSize: 8,
        textColor: [50, 50, 50]
      },
      alternateRowStyles: {
        fillColor: [245, 247, 250]
      },
      columnStyles: {
        0: { cellWidth: 28 },
        1: { cellWidth: 22 },
        2: { cellWidth: 28 },
        3: { cellWidth: 35 },
        4: { cellWidth: 25, halign: 'right' },
        5: { cellWidth: 22 },
        6: { cellWidth: 22 }
      },
      margin: { left: 14, right: 14 },
      didDrawPage: (data) => {
        const pageCount = doc.getNumberOfPages();
        doc.setFontSize(8);
        doc.setTextColor(150, 150, 150);
        doc.text(
          `Page ${data.pageNumber} of ${pageCount}`,
          pageWidth / 2,
          doc.internal.pageSize.getHeight() - 10,
          { align: 'center' }
        );
      }
    });

    doc.save(`transactions_${new Date().toISOString().split('T')[0]}.pdf`);
  };

  const clearFilters = () => {
    setFilters({
      source: 'all',
      status: 'all',
      product: 'all',
      dateFrom: '',
      dateTo: '',
      searchQuery: ''
    });
  };

  const hasActiveFilters = filters.source !== 'all' || filters.status !== 'all' || 
    filters.product !== 'all' || filters.dateFrom || filters.dateTo || filters.searchQuery;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8" data-testid="transaction-reports-page">
      <div className="mb-6">
        <Link href="/reports">
          <Button variant="ghost" className="mb-4" data-testid="button-back-to-reports">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Reports Hub
          </Button>
        </Link>
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <h1 className="text-3xl font-bold text-foreground mb-2">Transaction Reports</h1>
            <p className="text-muted-foreground">View all your FintekPro orders and payment transactions</p>
          </div>
          <div className="flex items-center gap-2">
            <Button 
              variant="outline" 
              onClick={handleRefresh}
              disabled={isLoading}
              data-testid="button-refresh"
            >
              <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
            <Button 
              variant="outline"
              onClick={handleExportCSV}
              disabled={filteredTransactions.length === 0}
              data-testid="button-export-csv"
            >
              <Download className="h-4 w-4 mr-2" />
              CSV
            </Button>
            <Button 
              onClick={handleExportPDF}
              disabled={filteredTransactions.length === 0}
              data-testid="button-export-pdf"
            >
              <FileDown className="h-4 w-4 mr-2" />
              PDF
            </Button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <Card data-testid="stat-total-transactions">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-100 rounded-lg">
                <Receipt className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.total}</p>
                <p className="text-sm text-muted-foreground">Total Transactions</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card data-testid="stat-completed">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-green-100 rounded-lg">
                <CheckCircle className="w-5 h-5 text-green-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.completed}</p>
                <p className="text-sm text-muted-foreground">Completed</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card data-testid="stat-pending">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-yellow-100 rounded-lg">
                <Clock className="w-5 h-5 text-yellow-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.pending}</p>
                <p className="text-sm text-muted-foreground">Pending</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card data-testid="stat-total-amount">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-purple-100 rounded-lg">
                <IndianRupee className="w-5 h-5 text-purple-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">₹{stats.completedAmount.toLocaleString()}</p>
                <p className="text-sm text-muted-foreground">Completed Value</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="mb-6">
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg flex items-center gap-2">
              <Filter className="w-5 h-5" />
              Filters
            </CardTitle>
            {hasActiveFilters && (
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={clearFilters}
                data-testid="button-clear-filters"
              >
                Clear All
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-4">
            <div>
              <Label className="text-xs text-muted-foreground mb-1">Search</Label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Order # or product..."
                  value={filters.searchQuery}
                  onChange={(e) => setFilters(prev => ({ ...prev, searchQuery: e.target.value }))}
                  className="pl-9"
                  data-testid="input-search"
                />
              </div>
            </div>
            <div>
              <Label className="text-xs text-muted-foreground mb-1">Status</Label>
              <Select 
                value={filters.status} 
                onValueChange={(v) => setFilters(prev => ({ ...prev, status: v as TransactionStatus }))}
              >
                <SelectTrigger data-testid="select-status-filter">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(statusLabels).map(([key, label]) => (
                    <SelectItem key={key} value={key}>{label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs text-muted-foreground mb-1">Product</Label>
              <Select 
                value={filters.product} 
                onValueChange={(v) => setFilters(prev => ({ ...prev, product: v as ProductFilter }))}
              >
                <SelectTrigger data-testid="select-product-filter">
                  <SelectValue placeholder="Product" />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(productLabels).map(([key, label]) => (
                    <SelectItem key={key} value={key}>{label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs text-muted-foreground mb-1">From Date</Label>
              <div className="relative">
                <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  type="date"
                  value={filters.dateFrom}
                  onChange={(e) => setFilters(prev => ({ ...prev, dateFrom: e.target.value }))}
                  className="pl-9"
                  data-testid="input-date-from"
                />
              </div>
            </div>
            <div>
              <Label className="text-xs text-muted-foreground mb-1">To Date</Label>
              <div className="relative">
                <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  type="date"
                  value={filters.dateTo}
                  onChange={(e) => setFilters(prev => ({ ...prev, dateTo: e.target.value }))}
                  className="pl-9"
                  data-testid="input-date-to"
                />
              </div>
            </div>
            <div className="flex items-end">
              <div className="text-sm text-muted-foreground">
                Showing <span className="font-semibold text-foreground">{filteredTransactions.length}</span> of {normalizedTransactions.length}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <ScrollableTabsList className="w-full">
          <TabsTrigger value="all" className="flex items-center gap-2" data-testid="tab-all">
            <Receipt className="w-4 h-4" />
            All ({sourceStats.all})
          </TabsTrigger>
          <TabsTrigger value="fintekpro" className="flex items-center gap-2" data-testid="tab-fintekpro">
            <Receipt className="w-4 h-4" />
            FintekPro ({sourceStats.fintekpro})
          </TabsTrigger>
          <TabsTrigger value="cashfree" className="flex items-center gap-2" data-testid="tab-cashfree">
            <CreditCard className="w-4 h-4" />
            Cashfree ({sourceStats.cashfree})
          </TabsTrigger>
          <TabsTrigger value="phonepe" className="flex items-center gap-2" data-testid="tab-phonepe">
            <Wallet className="w-4 h-4" />
            PhonePe ({sourceStats.phonepe})
          </TabsTrigger>
        </ScrollableTabsList>

        <TabsContent value={activeTab} className="space-y-4">
          {isLoading ? (
            <div className="space-y-4">
              {[1, 2, 3].map((i) => (
                <TransactionSkeleton key={i} />
              ))}
            </div>
          ) : filteredTransactions.length === 0 ? (
            <Card>
              <CardContent className="text-center py-12">
                <Receipt className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
                <h2 className="text-xl font-semibold text-foreground mb-2">No transactions found</h2>
                <p className="text-muted-foreground mb-6">
                  {hasActiveFilters 
                    ? 'Try adjusting your filters to see more transactions' 
                    : 'Complete some purchases to see your transaction history here'}
                </p>
                {hasActiveFilters && (
                  <Button variant="outline" onClick={clearFilters} data-testid="button-clear-empty-filters">
                    Clear Filters
                  </Button>
                )}
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-4">
              {filteredTransactions.map((transaction) => (
                <TransactionCard key={`${transaction.source}-${transaction.id}`} transaction={transaction} />
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
