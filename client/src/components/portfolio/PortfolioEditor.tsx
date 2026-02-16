import { useState, useCallback, useMemo, useEffect, useRef } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import { Textarea } from "@/components/ui/textarea";
import {
  Plus,
  Trash2,
  Search,
  AlertCircle,
  CheckCircle,
  TrendingUp,
  TrendingDown,
  RefreshCw,
  Save,
  Upload,
  X,
  Loader2,
  FileSpreadsheet,
  Undo2,
  Redo2,
  Clock,
  Lightbulb,
  ArrowRight,
  ArrowLeft,
  FileCheck,
  Sparkles
} from "lucide-react";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface Instrument {
  id: string;
  isin: string;
  symbol: string | null;
  name: string;
  shortName: string | null;
  assetClass: string;
  subType: string | null;
  category: string | null;
  issuer: string | null;
  lastPrice: string | null;
  currency: string;
  riskLevel: string | null;
  priceUpdatedAt: string | null;
}

interface HoldingRow {
  id: string;
  isin: string;
  instrumentId: string | null;
  securityName: string;
  assetClass: string;
  category: string | null;
  issuer: string | null;
  quantity: number;
  buyPrice: number;
  buyDate: string;
  folioNumber: string;
  currentPrice: number;
  currentValue: number;
  unrealizedGainLoss: number;
  unrealizedGainLossPercent: number;
  notes: string;
  isNew?: boolean;
  errors?: string[];
}

interface PortfolioEditorProps {
  proposalId?: string;
  onSave?: (holdings: HoldingRow[], summary: PortfolioSummary) => void;
  initialHoldings?: HoldingRow[];
  readOnly?: boolean;
}

interface PortfolioSummary {
  totalInvestment: number;
  totalCurrentValue: number;
  totalGainLoss: number;
  totalGainLossPercent: number;
  holdingsCount: number;
  assetAllocation: Record<string, { value: number; percent: number }>;
}

const ASSET_CLASSES = [
  { value: "mutual_fund", label: "Mutual Funds", color: "bg-blue-500" },
  { value: "equity", label: "Listed Stocks", color: "bg-green-500" },
  { value: "bond", label: "Bonds", color: "bg-amber-500" },
  { value: "mld", label: "MLDs", color: "bg-orange-500" },
  { value: "etf", label: "ETFs", color: "bg-purple-500" },
  { value: "unlisted", label: "Unlisted Equity", color: "bg-red-500" },
  { value: "pms", label: "PMS", color: "bg-teal-500" },
  { value: "aif", label: "AIF", color: "bg-indigo-500" },
  { value: "other", label: "Other Assets", color: "bg-muted" },
];

const WORKFLOW_STEPS = [
  { id: 1, name: "Enter Portfolio", description: "Add or import your holdings", icon: FileSpreadsheet },
  { id: 2, name: "Validate", description: "Check for errors and issues", icon: FileCheck },
  { id: 3, name: "Review Insights", description: "AI-powered portfolio analysis", icon: Lightbulb },
  { id: 4, name: "Generate Proposal", description: "Create investment proposal", icon: Sparkles },
];

const ZERODHA_CSV_HEADERS = ["tradingsymbol", "isin", "quantity", "average_price", "last_price", "pnl"];
const UPSTOX_CSV_HEADERS = ["symbol", "isin", "quantity", "buy_avg", "ltp", "p&l"];

function parseCSV(text: string): { headers: string[]; rows: string[][] } {
  const lines = text.trim().split("\n");
  if (lines.length < 2) return { headers: [], rows: [] };
  
  const headers = lines[0].toLowerCase().split(",").map(h => h.trim().replace(/"/g, ""));
  const rows = lines.slice(1).map(line => {
    const values: string[] = [];
    let current = "";
    let inQuotes = false;
    
    for (const char of line) {
      if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === "," && !inQuotes) {
        values.push(current.trim());
        current = "";
      } else {
        current += char;
      }
    }
    values.push(current.trim());
    return values;
  });
  
  return { headers, rows };
}

function detectBrokerFormat(headers: string[]): "zerodha" | "upstox" | "generic" | null {
  const normalizedHeaders = headers.map(h => h.toLowerCase().trim());
  
  if (normalizedHeaders.includes("tradingsymbol") && normalizedHeaders.includes("isin")) {
    return "zerodha";
  }
  if (normalizedHeaders.includes("symbol") && normalizedHeaders.includes("isin")) {
    return "upstox";
  }
  if (normalizedHeaders.includes("isin")) {
    return "generic";
  }
  return null;
}

function mapCSVRowToHolding(
  row: string[],
  headers: string[],
  format: "zerodha" | "upstox" | "generic"
): Partial<HoldingRow> | null {
  const getField = (name: string): string => {
    const idx = headers.findIndex(h => h.toLowerCase().includes(name.toLowerCase()));
    return idx >= 0 ? row[idx]?.replace(/"/g, "") || "" : "";
  };
  
  let isin = "";
  let symbol = "";
  let quantity = 0;
  let buyPrice = 0;
  let currentPrice = 0;
  
  if (format === "zerodha") {
    isin = getField("isin");
    symbol = getField("tradingsymbol");
    quantity = parseFloat(getField("quantity")) || 0;
    buyPrice = parseFloat(getField("average_price")) || 0;
    currentPrice = parseFloat(getField("last_price")) || buyPrice;
  } else if (format === "upstox") {
    isin = getField("isin");
    symbol = getField("symbol");
    quantity = parseFloat(getField("quantity")) || 0;
    buyPrice = parseFloat(getField("buy_avg")) || 0;
    currentPrice = parseFloat(getField("ltp")) || buyPrice;
  } else {
    isin = getField("isin");
    symbol = getField("symbol") || getField("name");
    quantity = parseFloat(getField("quantity") || getField("qty")) || 0;
    buyPrice = parseFloat(getField("buy_price") || getField("avg_price") || getField("price")) || 0;
    currentPrice = parseFloat(getField("current_price") || getField("ltp")) || buyPrice;
  }
  
  if (!isin || quantity <= 0) return null;
  
  return {
    isin: isin.toUpperCase(),
    securityName: symbol,
    quantity,
    buyPrice,
    currentPrice,
    assetClass: "equity",
  };
}

function generateRowId(): string {
  return `row_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}

function formatPercent(value: number): string {
  return `${value >= 0 ? "+" : ""}${value.toFixed(2)}%`;
}

export function PortfolioEditor({
  proposalId,
  onSave,
  initialHoldings = [],
  readOnly = false,
}: PortfolioEditorProps) {
  const { toast } = useToast();
  const [holdings, setHoldings] = useState<HoldingRow[]>(
    initialHoldings.length > 0 ? initialHoldings : []
  );
  const [activeTab, setActiveTab] = useState("all");
  const [searchOpen, setSearchOpen] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  
  // Workflow Step State
  const [currentStep, setCurrentStep] = useState(1);
  const [isValidated, setIsValidated] = useState(false);
  
  // CSV Import State
  const [showImportModal, setShowImportModal] = useState(false);
  const [csvText, setCsvText] = useState("");
  const [importPreview, setImportPreview] = useState<Partial<HoldingRow>[]>([]);
  const [importFormat, setImportFormat] = useState<string | null>(null);
  const [isImporting, setIsImporting] = useState(false);
  
  // Draft/Autosave State
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [isDirty, setIsDirty] = useState(false);
  const autosaveTimerRef = useRef<NodeJS.Timeout | null>(null);
  const DRAFT_KEY = `portfolio_draft_${proposalId || "new"}`;
  
  // Undo/Redo State
  const [history, setHistory] = useState<HoldingRow[][]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const isUndoRedoAction = useRef(false);
  
  // AI Insights State
  const [aiInsights, setAiInsights] = useState<string | null>(null);
  const [isLoadingInsights, setIsLoadingInsights] = useState(false);

  // Load draft from localStorage on mount
  useEffect(() => {
    if (initialHoldings.length === 0) {
      const savedDraft = localStorage.getItem(DRAFT_KEY);
      if (savedDraft) {
        try {
          const parsed = JSON.parse(savedDraft);
          if (parsed.holdings && parsed.holdings.length > 0) {
            setHoldings(parsed.holdings);
            setLastSaved(new Date(parsed.timestamp));
            toast({
              title: "Draft restored",
              description: `Restored ${parsed.holdings.length} holdings from previous session`,
            });
          }
        } catch (e) {
          console.error("Failed to restore draft:", e);
        }
      }
    }
  }, []);

  // Autosave to localStorage every 5 seconds when dirty
  useEffect(() => {
    if (isDirty && holdings.length > 0) {
      if (autosaveTimerRef.current) {
        clearTimeout(autosaveTimerRef.current);
      }
      autosaveTimerRef.current = setTimeout(() => {
        const draft = {
          holdings,
          timestamp: new Date().toISOString(),
        };
        localStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
        setLastSaved(new Date());
        setIsDirty(false);
      }, 5000);
    }
    return () => {
      if (autosaveTimerRef.current) {
        clearTimeout(autosaveTimerRef.current);
      }
    };
  }, [holdings, isDirty, DRAFT_KEY]);

  // Track history for undo/redo using functional updates to avoid stale closures
  useEffect(() => {
    if (isUndoRedoAction.current) {
      isUndoRedoAction.current = false;
      return;
    }
    
    if (holdings.length > 0) {
      setHistory(prev => {
        const newHistory = [...prev.slice(0, historyIndex + 1), holdings];
        if (newHistory.length > 50) newHistory.shift();
        return newHistory;
      });
      setHistoryIndex(prev => {
        const currentHist = history.slice(0, prev + 1);
        return Math.min(currentHist.length, 49);
      });
      setIsDirty(true);
      setIsValidated(false);
    }
  }, [holdings]);

  // Update historyIndex when history changes
  useEffect(() => {
    if (history.length > 0 && !isUndoRedoAction.current) {
      setHistoryIndex(history.length - 1);
    }
  }, [history.length]);

  // Undo handler
  const handleUndo = useCallback(() => {
    setHistory(currentHistory => {
      setHistoryIndex(currentIndex => {
        if (currentIndex > 0) {
          isUndoRedoAction.current = true;
          const newIndex = currentIndex - 1;
          setHoldings(currentHistory[newIndex]);
          setIsDirty(true);
          return newIndex;
        }
        return currentIndex;
      });
      return currentHistory;
    });
  }, []);

  // Redo handler
  const handleRedo = useCallback(() => {
    setHistory(currentHistory => {
      setHistoryIndex(currentIndex => {
        if (currentIndex < currentHistory.length - 1) {
          isUndoRedoAction.current = true;
          const newIndex = currentIndex + 1;
          setHoldings(currentHistory[newIndex]);
          setIsDirty(true);
          return newIndex;
        }
        return currentIndex;
      });
      return currentHistory;
    });
  }, []);

  // Keyboard shortcuts for undo/redo
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "z" && !e.shiftKey) {
        e.preventDefault();
        handleUndo();
      }
      if ((e.ctrlKey || e.metaKey) && (e.key === "y" || (e.key === "z" && e.shiftKey))) {
        e.preventDefault();
        handleRedo();
      }
    };
    
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleUndo, handleRedo]);

  // Preview CSV import
  const handleCSVPreview = useCallback(() => {
    if (!csvText.trim()) return;
    
    const { headers, rows } = parseCSV(csvText);
    const format = detectBrokerFormat(headers);
    
    if (!format) {
      toast({
        title: "Invalid CSV format",
        description: "CSV must contain an ISIN column. Supported formats: Zerodha, Upstox, or generic with ISIN column.",
        variant: "destructive",
      });
      return;
    }
    
    setImportFormat(format);
    const parsed = rows
      .map(row => mapCSVRowToHolding(row, headers, format))
      .filter((h): h is Partial<HoldingRow> => h !== null);
    
    setImportPreview(parsed);
    
    if (parsed.length === 0) {
      toast({
        title: "No valid holdings found",
        description: "Check that your CSV has valid ISIN codes and quantity values.",
        variant: "destructive",
      });
    }
  }, [csvText, toast]);

  // Import holdings from CSV
  const handleImportConfirm = useCallback(async () => {
    if (importPreview.length === 0) return;
    
    setIsImporting(true);
    
    try {
      const newHoldings: HoldingRow[] = [];
      
      for (const partial of importPreview) {
        if (!partial.isin) continue;
        
        let instrument: Instrument | null = null;
        try {
          const res = await fetch(`/api/instruments/search?q=${encodeURIComponent(partial.isin)}&limit=1`);
          const data = await res.json();
          instrument = data.instruments?.[0] || null;
        } catch (e) {
          console.error("Failed to fetch instrument:", partial.isin);
        }
        
        const currentPrice = instrument?.lastPrice
          ? parseFloat(instrument.lastPrice)
          : partial.currentPrice || partial.buyPrice || 0;
        
        const investmentValue = (partial.quantity || 0) * (partial.buyPrice || 0);
        const currentValue = (partial.quantity || 0) * currentPrice;
        
        newHoldings.push({
          id: generateRowId(),
          isin: partial.isin,
          instrumentId: instrument?.id || null,
          securityName: instrument?.name || partial.securityName || partial.isin,
          assetClass: instrument?.assetClass || partial.assetClass || "equity",
          category: instrument?.category || null,
          issuer: instrument?.issuer || null,
          quantity: partial.quantity || 0,
          buyPrice: partial.buyPrice || 0,
          buyDate: new Date().toISOString().split("T")[0],
          folioNumber: "",
          currentPrice,
          currentValue,
          unrealizedGainLoss: currentValue - investmentValue,
          unrealizedGainLossPercent: investmentValue > 0
            ? ((currentValue - investmentValue) / investmentValue) * 100
            : 0,
          notes: "",
        });
      }
      
      setHoldings([...holdings, ...newHoldings]);
      setShowImportModal(false);
      setCsvText("");
      setImportPreview([]);
      setImportFormat(null);
      
      toast({
        title: "Import successful",
        description: `Imported ${newHoldings.length} holdings from CSV`,
      });
    } catch (error: any) {
      toast({
        title: "Import failed",
        description: error.message || "Failed to import holdings",
        variant: "destructive",
      });
    } finally {
      setIsImporting(false);
    }
  }, [importPreview, holdings, toast]);

  // Calculate portfolio summary (moved before fetchAIInsights to avoid initialization error)
  const summary = useMemo<PortfolioSummary>(() => {
    const totalInvestment = holdings.reduce(
      (sum, h) => sum + h.quantity * h.buyPrice,
      0
    );
    const totalCurrentValue = holdings.reduce(
      (sum, h) => sum + h.currentValue,
      0
    );
    const totalGainLoss = totalCurrentValue - totalInvestment;
    const totalGainLossPercent =
      totalInvestment > 0 ? (totalGainLoss / totalInvestment) * 100 : 0;

    const assetAllocation: Record<string, { value: number; percent: number }> = {};
    holdings.forEach((h) => {
      const assetClass = h.assetClass || "other";
      if (!assetAllocation[assetClass]) {
        assetAllocation[assetClass] = { value: 0, percent: 0 };
      }
      assetAllocation[assetClass].value += h.currentValue;
    });

    Object.keys(assetAllocation).forEach((key) => {
      assetAllocation[key].percent =
        totalCurrentValue > 0
          ? (assetAllocation[key].value / totalCurrentValue) * 100
          : 0;
    });

    return {
      totalInvestment,
      totalCurrentValue,
      totalGainLoss,
      totalGainLossPercent,
      holdingsCount: holdings.length,
      assetAllocation,
    };
  }, [holdings]);

  // Fetch AI insights
  const fetchAIInsights = useCallback(async () => {
    if (holdings.length === 0) {
      toast({
        title: "No holdings",
        description: "Add some holdings first to get AI insights",
        variant: "destructive",
      });
      return;
    }
    
    setIsLoadingInsights(true);
    setCurrentStep(3);
    
    try {
      const portfolioData = holdings.map(h => ({
        name: h.securityName,
        assetClass: h.assetClass,
        value: h.currentValue,
        quantity: h.quantity,
        gainLossPercent: h.unrealizedGainLossPercent,
      }));
      
      const res = await apiRequest("/api/ai/portfolio-insights", {
        method: "POST",
        body: JSON.stringify({
          holdings: portfolioData,
          totalValue: summary.totalCurrentValue,
          assetAllocation: summary.assetAllocation,
        }),
      });
      
      setAiInsights(res.insights || "Unable to generate insights at this time.");
    } catch (error: any) {
      setAiInsights("Failed to load AI insights. Please try again later.");
      toast({
        title: "Insights unavailable",
        description: error.message || "Could not load AI insights",
        variant: "destructive",
      });
    } finally {
      setIsLoadingInsights(false);
    }
  }, [holdings, summary, toast]);

  // Clear draft
  const clearDraft = useCallback(() => {
    localStorage.removeItem(DRAFT_KEY);
    setLastSaved(null);
    toast({
      title: "Draft cleared",
      description: "Autosaved draft has been removed",
    });
  }, [DRAFT_KEY, toast]);

  // Instrument search query
  const { data: searchResults, isLoading: isSearching } = useQuery({
    queryKey: ["/api/instruments/search", searchQuery],
    queryFn: async () => {
      if (searchQuery.length < 2) return { instruments: [] };
      const res = await fetch(`/api/instruments/search?q=${encodeURIComponent(searchQuery)}&limit=15`);
      return res.json();
    },
    enabled: searchQuery.length >= 2,
    staleTime: 30000,
  });

  // Add new row
  const addRow = useCallback(() => {
    const newRow: HoldingRow = {
      id: generateRowId(),
      isin: "",
      instrumentId: null,
      securityName: "",
      assetClass: "mutual_fund",
      category: null,
      issuer: null,
      quantity: 0,
      buyPrice: 0,
      buyDate: new Date().toISOString().split("T")[0],
      folioNumber: "",
      currentPrice: 0,
      currentValue: 0,
      unrealizedGainLoss: 0,
      unrealizedGainLossPercent: 0,
      notes: "",
      isNew: true,
    };
    setHoldings([...holdings, newRow]);
  }, [holdings]);

  // Delete row
  const deleteRow = useCallback((rowId: string) => {
    setHoldings((prev) => prev.filter((h) => h.id !== rowId));
  }, []);

  // Update row field
  const updateRow = useCallback(
    (rowId: string, field: keyof HoldingRow, value: any) => {
      setHoldings((prev) =>
        prev.map((h) => {
          if (h.id !== rowId) return h;

          const updated = { ...h, [field]: value };

          // Recalculate values when quantity or price changes
          if (field === "quantity" || field === "buyPrice" || field === "currentPrice") {
            const qty = field === "quantity" ? Number(value) : updated.quantity;
            const buyPx = field === "buyPrice" ? Number(value) : updated.buyPrice;
            const curPx = field === "currentPrice" ? Number(value) : updated.currentPrice;

            updated.quantity = qty;
            updated.buyPrice = buyPx;
            updated.currentPrice = curPx || buyPx;
            updated.currentValue = qty * (curPx || buyPx);
            const investmentValue = qty * buyPx;
            updated.unrealizedGainLoss = updated.currentValue - investmentValue;
            updated.unrealizedGainLossPercent =
              investmentValue > 0
                ? ((updated.currentValue - investmentValue) / investmentValue) * 100
                : 0;
          }

          return updated;
        })
      );
    },
    []
  );

  // Select instrument from search
  const selectInstrument = useCallback(
    (rowId: string, instrument: Instrument) => {
      setHoldings((prev) =>
        prev.map((h) => {
          if (h.id !== rowId) return h;

          const currentPrice = instrument.lastPrice
            ? parseFloat(instrument.lastPrice)
            : 0;

          return {
            ...h,
            isin: instrument.isin,
            instrumentId: instrument.id,
            securityName: instrument.name,
            assetClass: instrument.assetClass,
            category: instrument.category,
            issuer: instrument.issuer,
            currentPrice,
            currentValue: h.quantity * currentPrice,
            isNew: false,
          };
        })
      );
      setSearchOpen(null);
      setSearchQuery("");
    },
    []
  );

  // Validate holdings
  const validateHoldings = useCallback((): string[] => {
    const errors: string[] = [];
    const isinSet = new Set<string>();
    const nameSet = new Set<string>();

    holdings.forEach((h, i) => {
      const rowNum = i + 1;

      if (!h.isin) {
        errors.push(`Row ${rowNum}: ISIN/identifier is required`);
      } else {
        const normalizedIsin = h.isin.toUpperCase();
        if (isinSet.has(normalizedIsin)) {
          errors.push(`Row ${rowNum}: Duplicate ISIN ${normalizedIsin}`);
        }
        isinSet.add(normalizedIsin);
      }

      if (!h.securityName) {
        errors.push(`Row ${rowNum}: Security name is required`);
      } else {
        const normalizedName = h.securityName.toLowerCase().trim();
        if (nameSet.has(normalizedName)) {
          errors.push(`Row ${rowNum}: Duplicate security "${h.securityName}"`);
        }
        nameSet.add(normalizedName);
      }

      if (!h.quantity || h.quantity <= 0) {
        errors.push(`Row ${rowNum}: Quantity must be greater than 0`);
      }

      if (!h.buyPrice || h.buyPrice <= 0) {
        errors.push(`Row ${rowNum}: Buy price must be greater than 0`);
      }

      if (h.buyDate && new Date(h.buyDate) > new Date()) {
        errors.push(`Row ${rowNum}: Buy date cannot be in the future`);
      }

      // Asset-class specific validations
      if (h.assetClass === "pms" && h.currentValue < 5000000) {
        errors.push(`Row ${rowNum}: PMS typically requires minimum ₹50 Lakhs investment`);
      }

      if (h.assetClass === "aif" && h.currentValue < 10000000) {
        errors.push(`Row ${rowNum}: AIF typically requires minimum ₹1 Crore investment`);
      }
    });

    setValidationErrors(errors);
    
    if (errors.length === 0 && holdings.length > 0) {
      setIsValidated(true);
      setCurrentStep(2);
      toast({
        title: "Validation passed",
        description: `All ${holdings.length} holdings are valid`,
      });
    } else if (errors.length > 0) {
      setIsValidated(false);
    }
    
    return errors;
  }, [holdings, toast]);

  // Save holdings
  const handleSave = useCallback(async () => {
    const errors = validateHoldings();
    if (errors.length > 0) {
      toast({
        title: "Validation errors",
        description: `Please fix ${errors.length} error(s) before saving`,
        variant: "destructive",
      });
      return;
    }

    setIsSaving(true);

    try {
      if (proposalId) {
        await apiRequest(`/api/proposals/${proposalId}/holdings`, {
          method: "POST",
          body: JSON.stringify({ holdings }),
        });
        queryClient.invalidateQueries({ queryKey: ["/api/proposals", proposalId, "holdings"] });
      }

      if (onSave) {
        onSave(holdings, summary);
      }
      
      // Clear draft after successful save
      localStorage.removeItem(DRAFT_KEY);
      setLastSaved(null);
      
      // Advance to step 4 (Generate Proposal) after saving
      setCurrentStep(4);

      toast({
        title: "Portfolio saved",
        description: `${holdings.length} holdings saved successfully. Ready to generate proposal.`,
      });
    } catch (error: any) {
      toast({
        title: "Save failed",
        description: error.message || "Failed to save portfolio",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  }, [holdings, summary, proposalId, onSave, validateHoldings, toast, DRAFT_KEY]);

  // Filter holdings by asset class
  const filteredHoldings = useMemo(() => {
    if (activeTab === "all") return holdings;
    return holdings.filter((h) => h.assetClass === activeTab);
  }, [holdings, activeTab]);

  // Get asset class label
  const getAssetClassLabel = (value: string): string => {
    return ASSET_CLASSES.find((ac) => ac.value === value)?.label || value;
  };

  return (
    <div className="space-y-6">
      {/* Progress Steps */}
      <Card className="border-none shadow-sm bg-gradient-to-r from-slate-50 to-blue-50 dark:from-background dark:to-blue-950">
        <CardContent className="py-4">
          <div className="flex items-center justify-between">
            {WORKFLOW_STEPS.map((step, index) => {
              const isActive = currentStep === step.id;
              const isCompleted = currentStep > step.id;
              const StepIcon = step.icon;
              
              return (
                <div key={step.id} className="flex items-center">
                  <div className="flex flex-col items-center">
                    <button
                      onClick={() => {
                        if (step.id <= currentStep || (step.id === 3 && isValidated)) {
                          if (step.id === 3 && !aiInsights) {
                            fetchAIInsights();
                          } else {
                            setCurrentStep(step.id);
                          }
                        }
                      }}
                      disabled={step.id > currentStep + 1 || (step.id === 3 && !isValidated)}
                      className={`w-12 h-12 rounded-full flex items-center justify-center transition-all ${
                        isCompleted
                          ? "bg-green-500 text-white"
                          : isActive
                          ? "bg-indigo-600 text-white ring-4 ring-indigo-200"
                          : step.id <= currentStep + 1
                          ? "bg-muted text-muted-foreground hover:bg-muted"
                          : "bg-muted text-muted-foreground cursor-not-allowed"
                      }`}
                      data-testid={`step-${step.id}`}
                    >
                      {isCompleted ? (
                        <CheckCircle className="w-6 h-6" />
                      ) : (
                        <StepIcon className="w-5 h-5" />
                      )}
                    </button>
                    <span className={`text-xs mt-2 font-medium ${isActive ? "text-indigo-600" : "text-muted-foreground"}`}>
                      {step.name}
                    </span>
                    <span className="text-[10px] text-muted-foreground hidden sm:block">{step.description}</span>
                  </div>
                  {index < WORKFLOW_STEPS.length - 1 && (
                    <div className={`h-0.5 w-16 mx-2 hidden sm:block ${
                      currentStep > step.id ? "bg-green-500" : "bg-muted"
                    }`} />
                  )}
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Main Editor */}
        <div className="lg:col-span-3 space-y-4">
          {/* Toolbar */}
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-2 flex-wrap">
              <Button
                onClick={addRow}
                disabled={readOnly}
                className="bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-700 hover:to-blue-700"
                data-testid="button-add-holding"
              >
                <Plus className="w-4 h-4 mr-2" />
                Add Holding
              </Button>
              
              <Dialog open={showImportModal} onOpenChange={setShowImportModal}>
                <DialogTrigger asChild>
                  <Button variant="outline" disabled={readOnly} data-testid="button-import-csv">
                    <Upload className="w-4 h-4 mr-2" />
                    Import CSV
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-2xl">
                  <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                      <FileSpreadsheet className="w-5 h-5" />
                      Import Portfolio from CSV
                    </DialogTitle>
                    <DialogDescription>
                      Paste your broker's holdings CSV data. Supports Zerodha, Upstox, or any CSV with ISIN column.
                    </DialogDescription>
                  </DialogHeader>
                  
                  <div className="space-y-4">
                    <div>
                      <Label>Paste CSV data</Label>
                      <Textarea
                        value={csvText}
                        onChange={(e) => {
                          setCsvText(e.target.value);
                          setImportPreview([]);
                          setImportFormat(null);
                        }}
                        placeholder="tradingsymbol,isin,quantity,average_price,last_price&#10;RELIANCE,INE002A01018,10,2500,2600&#10;TCS,INE467B01029,5,3500,3700"
                        className="font-mono text-xs h-32"
                        data-testid="textarea-csv-import"
                      />
                    </div>
                    
                    <Button onClick={handleCSVPreview} disabled={!csvText.trim()} variant="secondary" data-testid="button-preview-csv">
                      Preview Import
                    </Button>
                    
                    {importFormat && (
                      <div className="flex items-center gap-2">
                        <Badge variant="outline">{importFormat.toUpperCase()} format detected</Badge>
                      </div>
                    )}
                    
                    {importPreview.length > 0 && (
                      <div className="border rounded-lg overflow-hidden">
                        <div className="bg-muted px-3 py-2 text-sm font-medium">
                          Preview: {importPreview.length} holdings found
                        </div>
                        <div className="max-h-48 overflow-y-auto">
                          <Table>
                            <TableHeader>
                              <TableRow>
                                <TableHead>ISIN</TableHead>
                                <TableHead>Symbol</TableHead>
                                <TableHead className="text-right">Qty</TableHead>
                                <TableHead className="text-right">Buy Price</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {importPreview.slice(0, 10).map((h, i) => (
                                <TableRow key={i}>
                                  <TableCell className="font-mono text-xs">{h.isin}</TableCell>
                                  <TableCell>{h.securityName}</TableCell>
                                  <TableCell className="text-right">{h.quantity}</TableCell>
                                  <TableCell className="text-right">{formatCurrency(h.buyPrice || 0)}</TableCell>
                                </TableRow>
                              ))}
                              {importPreview.length > 10 && (
                                <TableRow>
                                  <TableCell colSpan={4} className="text-center text-muted-foreground">
                                    ...and {importPreview.length - 10} more
                                  </TableCell>
                                </TableRow>
                              )}
                            </TableBody>
                          </Table>
                        </div>
                      </div>
                    )}
                    
                    <div className="flex justify-end gap-2">
                      <Button variant="outline" onClick={() => setShowImportModal(false)}>
                        Cancel
                      </Button>
                      <Button
                        onClick={handleImportConfirm}
                        disabled={importPreview.length === 0 || isImporting}
                        data-testid="button-confirm-import"
                      >
                        {isImporting ? (
                          <>
                            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                            Importing...
                          </>
                        ) : (
                          <>
                            <CheckCircle className="w-4 h-4 mr-2" />
                            Import {importPreview.length} Holdings
                          </>
                        )}
                      </Button>
                    </div>
                  </div>
                </DialogContent>
              </Dialog>

              <div className="flex items-center gap-1 border rounded-md">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={handleUndo}
                  disabled={historyIndex <= 0}
                  className="h-9 w-9"
                  title="Undo (Ctrl+Z)"
                  data-testid="button-undo"
                >
                  <Undo2 className="w-4 h-4" />
                </Button>
                <Separator orientation="vertical" className="h-6" />
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={handleRedo}
                  disabled={historyIndex >= history.length - 1}
                  className="h-9 w-9"
                  title="Redo (Ctrl+Y)"
                  data-testid="button-redo"
                >
                  <Redo2 className="w-4 h-4" />
                </Button>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {lastSaved && (
                <div className="text-xs text-muted-foreground flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  Draft saved {lastSaved.toLocaleTimeString()}
                </div>
              )}
              <Button
                variant="outline"
                onClick={() => validateHoldings()}
                disabled={holdings.length === 0}
                data-testid="button-validate"
              >
                <CheckCircle className="w-4 h-4 mr-2" />
                Validate
              </Button>
              <Button
                onClick={handleSave}
                disabled={readOnly || holdings.length === 0 || isSaving}
                className="bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700"
                data-testid="button-save-portfolio"
              >
                {isSaving ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <Save className="w-4 h-4 mr-2" />
                )}
                Save Portfolio
              </Button>
            </div>
          </div>

          {/* Validation Errors */}
          {validationErrors.length > 0 && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                <div className="font-medium mb-1">
                  {validationErrors.length} validation error(s) found:
                </div>
                <ul className="list-disc list-inside text-sm max-h-32 overflow-y-auto">
                  {validationErrors.map((error, i) => (
                    <li key={i}>{error}</li>
                  ))}
                </ul>
              </AlertDescription>
            </Alert>
          )}

          {/* AI Insights Panel - Step 3 */}
          {currentStep >= 3 && (
            <Card className="border-l-4 border-l-purple-500 bg-gradient-to-r from-purple-50 to-indigo-50 dark:from-purple-950 dark:to-indigo-950">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Lightbulb className="w-5 h-5 text-purple-600" />
                  AI Portfolio Insights
                </CardTitle>
                <CardDescription>
                  Smart analysis of your portfolio composition and performance
                </CardDescription>
              </CardHeader>
              <CardContent>
                {isLoadingInsights ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="w-8 h-8 animate-spin text-purple-600" />
                    <span className="ml-3 text-muted-foreground">Analyzing your portfolio...</span>
                  </div>
                ) : aiInsights ? (
                  <div className="prose prose-sm dark:prose-invert max-w-none">
                    {aiInsights.split('\n').map((line, i) => {
                      if (line.startsWith('## ')) {
                        return <h2 key={i} className="text-lg font-bold mt-2 mb-3 text-purple-800 dark:text-purple-300">{line.replace('## ', '')}</h2>;
                      }
                      if (line.startsWith('### ')) {
                        return <h3 key={i} className="text-md font-semibold mt-4 mb-2 text-indigo-700 dark:text-indigo-400">{line.replace('### ', '')}</h3>;
                      }
                      if (line.startsWith('**') && line.includes(':**')) {
                        const [label, ...rest] = line.split(':**');
                        return (
                          <p key={i} className="my-2">
                            <strong className="text-amber-600 dark:text-amber-400">{label.replace('**', '')}:</strong>
                            {rest.join(':**').replace(/\*\*/g, '')}
                          </p>
                        );
                      }
                      if (line.match(/^\d+\./)) {
                        return <li key={i} className="ml-4 my-1">{line.replace(/^\d+\.\s*/, '')}</li>;
                      }
                      if (line.trim()) {
                        return <p key={i} className="my-2 text-foreground">{line}</p>;
                      }
                      return null;
                    })}
                  </div>
                ) : (
                  <div className="text-center py-6">
                    <p className="text-muted-foreground mb-4">
                      Ready to generate AI insights for your portfolio
                    </p>
                    <Button
                      onClick={fetchAIInsights}
                      disabled={holdings.length === 0 || !isValidated}
                      className="bg-purple-600 hover:bg-purple-700"
                      data-testid="button-generate-insights"
                    >
                      <Sparkles className="w-4 h-4 mr-2" />
                      Generate Insights
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Asset Class Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="w-full justify-start overflow-x-auto">
            <TabsTrigger value="all" data-testid="tab-all">
              All ({holdings.length})
            </TabsTrigger>
            {ASSET_CLASSES.map((ac) => {
              const count = holdings.filter((h) => h.assetClass === ac.value).length;
              if (count === 0 && activeTab !== ac.value) return null;
              return (
                <TabsTrigger key={ac.value} value={ac.value} data-testid={`tab-${ac.value}`}>
                  {ac.label} ({count})
                </TabsTrigger>
              );
            })}
          </TabsList>

          <TabsContent value={activeTab} className="mt-4">
            {/* Holdings Table */}
            <Card>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader className="sticky top-0 bg-card z-10">
                      <TableRow>
                        <TableHead className="min-w-[200px]">ISIN / Security</TableHead>
                        <TableHead className="min-w-[120px]">Type</TableHead>
                        <TableHead className="min-w-[100px] text-right">Quantity</TableHead>
                        <TableHead className="min-w-[120px] text-right">Buy Price</TableHead>
                        <TableHead className="min-w-[120px]">Buy Date</TableHead>
                        <TableHead className="min-w-[100px]">Folio No.</TableHead>
                        <TableHead className="min-w-[120px] text-right">Current Price</TableHead>
                        <TableHead className="min-w-[140px] text-right">Current Value</TableHead>
                        <TableHead className="min-w-[120px] text-right">Gain/Loss</TableHead>
                        <TableHead className="w-[60px]"></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredHoldings.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={10} className="text-center py-12 text-muted-foreground">
                            No holdings added yet. Click "Add Holding" to start.
                          </TableCell>
                        </TableRow>
                      ) : (
                        filteredHoldings.map((holding) => (
                          <TableRow key={holding.id} data-testid={`row-holding-${holding.id}`}>
                            {/* ISIN / Security */}
                            <TableCell>
                              <Popover
                                open={searchOpen === holding.id}
                                onOpenChange={(open) =>
                                  setSearchOpen(open ? holding.id : null)
                                }
                              >
                                <PopoverTrigger asChild>
                                  <div className="cursor-pointer">
                                    {holding.isin ? (
                                      <div>
                                        <div className="font-mono text-xs text-muted-foreground flex items-center gap-1">
                                          {holding.isin.startsWith("MAN") ? (
                                            <>
                                              <Badge variant="secondary" className="text-xs px-1 py-0">Manual</Badge>
                                              <span className="text-[10px]">{holding.isin}</span>
                                            </>
                                          ) : (
                                            holding.isin
                                          )}
                                        </div>
                                        <div className="text-sm font-medium truncate max-w-[200px]">
                                          {holding.securityName}
                                        </div>
                                      </div>
                                    ) : (
                                      <div className="flex items-center gap-2 text-muted-foreground">
                                        <Search className="w-4 h-4" />
                                        <span>Search or enter manually...</span>
                                      </div>
                                    )}
                                  </div>
                                </PopoverTrigger>
                                <PopoverContent className="w-[400px] p-0" align="start">
                                  <Command>
                                    <CommandInput
                                      placeholder="Search by ISIN, name, or symbol..."
                                      value={searchQuery}
                                      onValueChange={setSearchQuery}
                                      data-testid="input-isin-search"
                                    />
                                    <CommandList>
                                      {isSearching && (
                                        <div className="py-6 text-center text-sm text-muted-foreground">
                                          <Loader2 className="w-4 h-4 animate-spin inline mr-2" />
                                          Searching...
                                        </div>
                                      )}
                                      {!isSearching && searchQuery.length >= 2 && searchResults?.instruments?.length === 0 && (
                                        <CommandEmpty>
                                          <div className="py-2 px-3 space-y-3">
                                            <p className="text-sm text-muted-foreground text-center">
                                              No instruments found for "{searchQuery}"
                                            </p>
                                            <div className="text-xs text-muted-foreground text-center">
                                              Add manually for stocks, PMS, AIF, MLDs not in database
                                            </div>
                                            <div className="space-y-2">
                                              <Input
                                                placeholder="Enter ISIN (optional, e.g. INE123A45678)"
                                                className="h-8 text-xs"
                                                id={`manual-isin-${holding.id}`}
                                                data-testid="input-manual-isin"
                                              />
                                              <Button
                                                variant="outline"
                                                size="sm"
                                                onClick={() => {
                                                  const isinInput = document.getElementById(`manual-isin-${holding.id}`) as HTMLInputElement;
                                                  const userIsin = isinInput?.value?.trim().toUpperCase();
                                                  const generatedId = `MAN${Math.random().toString(36).substr(2, 9).toUpperCase()}`.substring(0, 12);
                                                  updateRow(holding.id, "securityName", searchQuery);
                                                  updateRow(holding.id, "isin", userIsin || generatedId);
                                                  setSearchOpen(null);
                                                  setSearchQuery("");
                                                }}
                                                className="w-full"
                                                data-testid="btn-manual-entry"
                                              >
                                                <Plus className="w-4 h-4 mr-2" />
                                                Add "{searchQuery}" manually
                                              </Button>
                                            </div>
                                          </div>
                                        </CommandEmpty>
                                      )}
                                      {searchResults?.instruments?.length > 0 && (
                                        <CommandGroup heading="Instruments">
                                          {searchResults.instruments.map((inst: Instrument) => (
                                            <CommandItem
                                              key={inst.id}
                                              value={inst.isin}
                                              onSelect={() =>
                                                selectInstrument(holding.id, inst)
                                              }
                                              className="cursor-pointer"
                                              data-testid={`item-instrument-${inst.isin}`}
                                            >
                                              <div className="flex flex-col w-full">
                                                <div className="flex items-center justify-between">
                                                  <span className="font-mono text-xs">
                                                    {inst.isin}
                                                  </span>
                                                  <Badge variant="outline" className="text-xs">
                                                    {getAssetClassLabel(inst.assetClass)}
                                                  </Badge>
                                                </div>
                                                <div className="text-sm font-medium truncate">
                                                  {inst.name}
                                                </div>
                                                <div className="flex items-center justify-between text-xs text-muted-foreground">
                                                  <span>{inst.issuer || inst.category}</span>
                                                  {inst.lastPrice && (
                                                    <span className="font-medium">
                                                      ₹{parseFloat(inst.lastPrice).toLocaleString()}
                                                    </span>
                                                  )}
                                                </div>
                                              </div>
                                            </CommandItem>
                                          ))}
                                        </CommandGroup>
                                      )}
                                    </CommandList>
                                  </Command>
                                </PopoverContent>
                              </Popover>
                            </TableCell>

                            {/* Type */}
                            <TableCell>
                              <Select
                                value={holding.assetClass}
                                onValueChange={(v) => updateRow(holding.id, "assetClass", v)}
                                disabled={readOnly}
                              >
                                <SelectTrigger className="h-8 text-xs" data-testid={`select-asset-class-${holding.id}`}>
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  {ASSET_CLASSES.map((ac) => (
                                    <SelectItem key={ac.value} value={ac.value}>
                                      {ac.label}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </TableCell>

                            {/* Quantity */}
                            <TableCell className="text-right">
                              <Input
                                type="number"
                                value={holding.quantity || ""}
                                onChange={(e) =>
                                  updateRow(holding.id, "quantity", e.target.value)
                                }
                                className="h-8 text-right w-24"
                                placeholder="0"
                                disabled={readOnly}
                                data-testid={`input-quantity-${holding.id}`}
                              />
                            </TableCell>

                            {/* Buy Price */}
                            <TableCell className="text-right">
                              <Input
                                type="number"
                                value={holding.buyPrice || ""}
                                onChange={(e) =>
                                  updateRow(holding.id, "buyPrice", e.target.value)
                                }
                                className="h-8 text-right w-28"
                                placeholder="0.00"
                                disabled={readOnly}
                                data-testid={`input-buy-price-${holding.id}`}
                              />
                            </TableCell>

                            {/* Buy Date */}
                            <TableCell>
                              <Input
                                type="date"
                                value={holding.buyDate || ""}
                                onChange={(e) =>
                                  updateRow(holding.id, "buyDate", e.target.value)
                                }
                                className="h-8 w-32"
                                disabled={readOnly}
                                data-testid={`input-buy-date-${holding.id}`}
                              />
                            </TableCell>

                            {/* Folio Number */}
                            <TableCell>
                              <Input
                                type="text"
                                value={holding.folioNumber || ""}
                                onChange={(e) =>
                                  updateRow(holding.id, "folioNumber", e.target.value)
                                }
                                className="h-8 w-24"
                                placeholder="Folio"
                                disabled={readOnly}
                                data-testid={`input-folio-${holding.id}`}
                              />
                            </TableCell>

                            {/* Current Price */}
                            <TableCell className="text-right">
                              <Input
                                type="number"
                                value={holding.currentPrice || ""}
                                onChange={(e) =>
                                  updateRow(holding.id, "currentPrice", e.target.value)
                                }
                                className="h-8 text-right w-28"
                                placeholder="0.00"
                                disabled={readOnly}
                                data-testid={`input-current-price-${holding.id}`}
                              />
                            </TableCell>

                            {/* Current Value */}
                            <TableCell className="text-right font-medium">
                              {formatCurrency(holding.currentValue)}
                            </TableCell>

                            {/* Gain/Loss */}
                            <TableCell className="text-right">
                              <div
                                className={`flex items-center justify-end gap-1 ${
                                  holding.unrealizedGainLoss >= 0
                                    ? "text-green-600"
                                    : "text-red-600"
                                }`}
                              >
                                {holding.unrealizedGainLoss >= 0 ? (
                                  <TrendingUp className="w-3 h-3" />
                                ) : (
                                  <TrendingDown className="w-3 h-3" />
                                )}
                                <span className="text-xs">
                                  {formatPercent(holding.unrealizedGainLossPercent)}
                                </span>
                              </div>
                            </TableCell>

                            {/* Actions */}
                            <TableCell>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => deleteRow(holding.id)}
                                disabled={readOnly}
                                className="h-8 w-8 text-red-500 hover:text-red-700 dark:text-red-300 hover:bg-red-50 dark:bg-red-950/30"
                                data-testid={`button-delete-${holding.id}`}
                              >
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      {/* Summary Sidebar */}
      <div className="space-y-4">
        <Card className="sticky top-4">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">Portfolio Summary</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Total Holdings */}
            <div className="flex justify-between items-center">
              <span className="text-sm text-muted-foreground">Holdings</span>
              <span className="font-medium">{summary.holdingsCount}</span>
            </div>

            <Separator />

            {/* Total Investment */}
            <div className="flex justify-between items-center">
              <span className="text-sm text-muted-foreground">Total Investment</span>
              <span className="font-medium">{formatCurrency(summary.totalInvestment)}</span>
            </div>

            {/* Current Value */}
            <div className="flex justify-between items-center">
              <span className="text-sm text-muted-foreground">Current Value</span>
              <span className="font-semibold text-lg">
                {formatCurrency(summary.totalCurrentValue)}
              </span>
            </div>

            {/* Gain/Loss */}
            <div className="flex justify-between items-center">
              <span className="text-sm text-muted-foreground">Unrealized P&L</span>
              <div
                className={`flex items-center gap-1 font-medium ${
                  summary.totalGainLoss >= 0 ? "text-green-600" : "text-red-600"
                }`}
              >
                {summary.totalGainLoss >= 0 ? (
                  <TrendingUp className="w-4 h-4" />
                ) : (
                  <TrendingDown className="w-4 h-4" />
                )}
                <div className="text-right">
                  <div>{formatCurrency(Math.abs(summary.totalGainLoss))}</div>
                  <div className="text-xs">
                    {formatPercent(summary.totalGainLossPercent)}
                  </div>
                </div>
              </div>
            </div>

            <Separator />

            {/* Asset Allocation */}
            <div>
              <div className="text-sm font-medium mb-3">Asset Allocation</div>
              <div className="space-y-2">
                {Object.entries(summary.assetAllocation).map(([key, data]) => {
                  const assetClass = ASSET_CLASSES.find((ac) => ac.value === key);
                  return (
                    <div key={key} className="space-y-1">
                      <div className="flex justify-between text-xs">
                        <span>{assetClass?.label || key}</span>
                        <span>{data.percent.toFixed(1)}%</span>
                      </div>
                      <div className="h-2 bg-muted rounded-full overflow-hidden">
                        <div
                          className={`h-full ${assetClass?.color || "bg-muted"}`}
                          style={{ width: `${data.percent}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
    </div>
  );
}

export default PortfolioEditor;
