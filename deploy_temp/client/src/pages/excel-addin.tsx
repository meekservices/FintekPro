import { useState, useEffect, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsTrigger } from "@/components/ui/tabs";
import { ScrollableTabsList } from "@/components/ScrollableTabsList";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  TrendingUp,
  TrendingDown,
  RefreshCw,
  Copy,
  Download,
  ChevronDown,
  Activity,
  Clock,
  AlertCircle,
  FileSpreadsheet,
  Info,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface OptionRow {
  strike: number;
  call_ltp: number | null;
  call_oi: number | null;
  call_iv: number | null;
  call_change: number | null;
  call_volume: number | null;
  call_bid: number | null;
  call_ask: number | null;
  put_ltp: number | null;
  put_oi: number | null;
  put_iv: number | null;
  put_change: number | null;
  put_volume: number | null;
  put_bid: number | null;
  put_ask: number | null;
}

interface ChainResponse {
  symbol: string;
  expiry: string | null;
  underlyingValue: number;
  timestamp: string;
  rows: OptionRow[];
}

interface SymbolsResponse {
  symbols: string[];
  lotSizes: Record<string, number>;
}

const fmt = (v: number | null, decimals = 2) =>
  v == null ? "—" : v.toLocaleString("en-IN", { minimumFractionDigits: decimals, maximumFractionDigits: decimals });

const fmtOI = (v: number | null) =>
  v == null ? "—" : v >= 1_00_000 ? `${(v / 1_00_000).toFixed(1)}L` : v.toLocaleString("en-IN");

const isOfficeAvailable = () => typeof window !== "undefined" && typeof (window as any).Office !== "undefined";

async function insertToExcel(data: (string | number | null)[][], headerRow: string[]) {
  if (!isOfficeAvailable()) {
    throw new Error("Excel API not available — open this page inside Excel as a task pane");
  }
  const Office = (window as any).Office;
  await Office.onReady();
  return new Promise<void>((resolve, reject) => {
    Office.context.document.bindings.addFromSelectionAsync(
      Office.BindingType.Matrix,
      { id: "optionChain" },
      (result: any) => {
        if (result.status === Office.AsyncResultStatus.Failed) {
          reject(new Error(result.error.message));
        } else {
          const binding = result.value;
          const matrix = [headerRow, ...data.map(row => row.map(v => v ?? ""))];
          binding.setDataAsync(matrix, (r: any) => {
            if (r.status === Office.AsyncResultStatus.Failed) {
              reject(new Error(r.error.message));
            } else {
              resolve();
            }
          });
        }
      }
    );
  });
}

export default function ExcelAddinPage() {
  const { toast } = useToast();
  const [symbol, setSymbol] = useState("NIFTY");
  const [expiry, setExpiry] = useState<string>("");
  const [tab, setTab] = useState("chain");
  const [strikeFilter, setStrikeFilter] = useState("");
  const [insertMode, setInsertMode] = useState(false);
  const inExcel = isOfficeAvailable();

  const { data: symbolsData } = useQuery<SymbolsResponse>({
    queryKey: ["/api/excel/symbols"],
  });

  const { data: expiryData } = useQuery<{ expiryDates: string[] }>({
    queryKey: ["/api/excel/expiry", symbol],
    enabled: !!symbol,
  });

  useEffect(() => {
    if (expiryData?.expiryDates?.length) {
      setExpiry(expiryData.expiryDates[0]);
    }
  }, [expiryData]);

  const {
    data: chainData,
    isLoading,
    refetch,
    dataUpdatedAt,
  } = useQuery<ChainResponse>({
    queryKey: ["/api/excel/chain", symbol, expiry],
    queryFn: () =>
      fetch(`/api/excel/chain/${symbol}${expiry ? `?expiry=${expiry}` : ""}`).then(r => r.json()),
    enabled: !!symbol,
    refetchInterval: 60_000,
  });

  const spot = chainData?.underlyingValue;
  const lotSize = symbolsData?.lotSizes?.[symbol] ?? 1;
  const lastUpdated = dataUpdatedAt ? new Date(dataUpdatedAt).toLocaleTimeString("en-IN") : null;

  const rows = chainData?.rows ?? [];
  const nearStrikes = strikeFilter
    ? rows.filter(r => String(r.strike).includes(strikeFilter))
    : spot
    ? rows.filter(r => Math.abs(r.strike - spot) / spot < 0.03)
    : rows;

  const displayRows = strikeFilter ? nearStrikes : (nearStrikes.length > 0 ? nearStrikes : rows.slice(0, 20));

  const handleInsertChain = async () => {
    try {
      const headers = [
        "CALL LTP", "CALL OI", "CALL IV%", "CALL CHNG",
        "STRIKE",
        "PUT LTP", "PUT OI", "PUT IV%", "PUT CHNG",
      ];
      const data = displayRows.map(r => [
        r.call_ltp, fmtOI(r.call_oi), r.call_iv, r.call_change,
        r.strike,
        r.put_ltp, fmtOI(r.put_oi), r.put_iv, r.put_change,
      ]);
      await insertToExcel(data, headers);
      toast({ title: "Inserted to Excel", description: `${displayRows.length} rows written to selected range` });
    } catch (e: any) {
      toast({ title: "Insert failed", description: e.message, variant: "destructive" });
    }
  };

  const copyFormula = (formula: string) => {
    navigator.clipboard.writeText(formula);
    toast({ title: "Formula copied", description: formula });
  };

  const SAMPLE_FORMULAS = [
    {
      name: "Spot price",
      formula: `=FINTEKPRO.SPOT("${symbol}")`,
      desc: "Live underlying price",
    },
    {
      name: "Call LTP",
      formula: `=FINTEKPRO.OC("${symbol}","CE",${spot ? Math.round(spot / 100) * 100 : 24000},"${expiry || expiryData?.expiryDates?.[0] || "YYYY-MM-DD"}","LTP")`,
      desc: "Last traded price for a call",
    },
    {
      name: "Put OI",
      formula: `=FINTEKPRO.OC("${symbol}","PE",${spot ? Math.round(spot / 100) * 100 : 24000},"${expiry || expiryData?.expiryDates?.[0] || "YYYY-MM-DD"}","OI")`,
      desc: "Open interest for a put",
    },
    {
      name: "IV",
      formula: `=FINTEKPRO.OC("${symbol}","CE",${spot ? Math.round(spot / 100) * 100 : 24000},"${expiry || expiryData?.expiryDates?.[0] || "YYYY-MM-DD"}","IV")`,
      desc: "Implied volatility (decimal)",
    },
    {
      name: "Expiry 1",
      formula: `=FINTEKPRO.EXPIRY("${symbol}",1)`,
      desc: "Nearest expiry date",
    },
    {
      name: "Full chain (array)",
      formula: `=FINTEKPRO.CHAIN("${symbol}","${expiry || expiryData?.expiryDates?.[0] || "YYYY-MM-DD"}")`,
      desc: "Spills entire chain as dynamic array",
    },
  ];

  return (
    <div className="min-h-screen bg-background text-foreground" style={{ fontFamily: "system-ui, sans-serif" }}>
      {/* Header */}
      <div className="bg-blue-700 text-white px-3 py-2 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <FileSpreadsheet className="h-4 w-4" />
          <span className="font-semibold text-sm">FintekPro Options</span>
          {inExcel && (
            <Badge variant="secondary" className="text-xs bg-blue-600 text-white border-0 px-1.5">
              Excel
            </Badge>
          )}
        </div>
        <Button
          variant="ghost"
          size="sm"
          className="text-white hover:bg-blue-600 h-6 w-6 p-0"
          onClick={() => refetch()}
        >
          <RefreshCw className="h-3.5 w-3.5" />
        </Button>
      </div>

      {/* Controls */}
      <div className="px-3 py-2 border-b bg-muted/30 space-y-2">
        <div className="flex gap-2">
          <Select value={symbol} onValueChange={setSymbol}>
            <SelectTrigger className="h-7 text-xs flex-1">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {(symbolsData?.symbols ?? ["NIFTY", "BANKNIFTY", "FINNIFTY", "RELIANCE", "TCS", "INFY", "HDFCBANK"]).map(s => (
                <SelectItem key={s} value={s} className="text-xs">{s}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={expiry} onValueChange={setExpiry}>
            <SelectTrigger className="h-7 text-xs flex-1">
              <SelectValue placeholder="Expiry" />
            </SelectTrigger>
            <SelectContent>
              {(expiryData?.expiryDates ?? []).map(d => (
                <SelectItem key={d} value={d} className="text-xs">{d}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {spot != null && (
          <div className="flex items-center justify-between text-xs">
            <div className="flex items-center gap-1.5">
              <Activity className="h-3 w-3 text-muted-foreground" />
              <span className="font-medium">
                {symbol}: ₹{spot.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
              <span className="text-muted-foreground">· Lot {lotSize}</span>
            </div>
            {lastUpdated && (
              <span className="text-muted-foreground flex items-center gap-1">
                <Clock className="h-3 w-3" />{lastUpdated}
              </span>
            )}
          </div>
        )}
      </div>

      <Tabs value={tab} onValueChange={setTab} className="flex-1">
        <ScrollableTabsList className="px-3 pt-2 h-8 bg-transparent border-b rounded-none gap-1">
          <TabsTrigger value="chain" className="text-xs h-7 px-3">Chain</TabsTrigger>
          <TabsTrigger value="formulas" className="text-xs h-7 px-3">Formulas</TabsTrigger>
          <TabsTrigger value="install" className="text-xs h-7 px-3">Install</TabsTrigger>
        </ScrollableTabsList>

        {/* ── Option Chain tab ── */}
        <TabsContent value="chain" className="m-0 p-0">
          <div className="px-3 py-1.5 flex items-center gap-2 border-b">
            <Input
              placeholder="Filter strike…"
              className="h-6 text-xs flex-1"
              value={strikeFilter}
              onChange={e => setStrikeFilter(e.target.value)}
            />
            {inExcel && (
              <Button
                size="sm"
                className="h-6 text-xs px-2 bg-green-600 hover:bg-green-700"
                onClick={handleInsertChain}
              >
                <Download className="h-3 w-3 mr-1" />
                Insert
              </Button>
            )}
          </div>

          {isLoading ? (
            <div className="flex items-center justify-center py-8 text-muted-foreground text-xs">
              <RefreshCw className="h-4 w-4 animate-spin mr-2" /> Loading chain…
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="text-[10px]">
                    <TableHead className="text-right pr-1 w-16 text-blue-600">LTP</TableHead>
                    <TableHead className="text-right pr-1 w-12 text-blue-600">OI</TableHead>
                    <TableHead className="text-right pr-1 w-12 text-blue-600">IV%</TableHead>
                    <TableHead className="text-center font-semibold w-20 bg-muted">STRIKE</TableHead>
                    <TableHead className="text-left pl-1 w-12 text-orange-600">IV%</TableHead>
                    <TableHead className="text-left pl-1 w-12 text-orange-600">OI</TableHead>
                    <TableHead className="text-left pl-1 w-16 text-orange-600">LTP</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {displayRows.map(row => {
                    const atm = spot != null && Math.abs(row.strike - spot) < 50;
                    const itcCall = spot != null && row.strike < spot;
                    const itcPut = spot != null && row.strike > spot;
                    return (
                      <TableRow
                        key={row.strike}
                        className={`text-[11px] h-7 ${atm ? "bg-yellow-50 dark:bg-yellow-950/30 font-semibold" : ""}`}
                      >
                        {/* CALL side */}
                        <TableCell className={`text-right pr-1 font-mono ${itcCall ? "bg-blue-50 dark:bg-blue-950/20" : ""}`}>
                          {row.call_change != null && (
                            <span className={row.call_change >= 0 ? "text-green-600" : "text-red-600"}>
                              {row.call_change >= 0 ? "▲" : "▼"}
                            </span>
                          )}{" "}
                          {fmt(row.call_ltp)}
                        </TableCell>
                        <TableCell className={`text-right pr-1 font-mono text-muted-foreground text-[10px] ${itcCall ? "bg-blue-50 dark:bg-blue-950/20" : ""}`}>
                          {fmtOI(row.call_oi)}
                        </TableCell>
                        <TableCell className={`text-right pr-1 font-mono text-[10px] ${itcCall ? "bg-blue-50 dark:bg-blue-950/20" : ""}`}>
                          {row.call_iv != null ? `${row.call_iv.toFixed(1)}%` : "—"}
                        </TableCell>

                        {/* Strike */}
                        <TableCell className="text-center font-bold text-[11px] bg-muted border-x">
                          {row.strike.toLocaleString("en-IN")}
                        </TableCell>

                        {/* PUT side */}
                        <TableCell className={`text-left pl-1 font-mono text-[10px] ${itcPut ? "bg-orange-50 dark:bg-orange-950/20" : ""}`}>
                          {row.put_iv != null ? `${row.put_iv.toFixed(1)}%` : "—"}
                        </TableCell>
                        <TableCell className={`text-left pl-1 font-mono text-muted-foreground text-[10px] ${itcPut ? "bg-orange-50 dark:bg-orange-950/20" : ""}`}>
                          {fmtOI(row.put_oi)}
                        </TableCell>
                        <TableCell className={`text-left pl-1 font-mono ${itcPut ? "bg-orange-50 dark:bg-orange-950/20" : ""}`}>
                          {row.put_change != null && (
                            <span className={row.put_change >= 0 ? "text-green-600" : "text-red-600"}>
                              {row.put_change >= 0 ? "▲" : "▼"}
                            </span>
                          )}{" "}
                          {fmt(row.put_ltp)}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}

          <div className="px-3 py-1.5 text-[10px] text-muted-foreground border-t flex justify-between">
            <span>CALL <span className="text-blue-600">■</span> &nbsp; ATM <span className="text-yellow-500">■</span> &nbsp; PUT <span className="text-orange-600">■</span></span>
            <span>{displayRows.length} strikes · NSE</span>
          </div>
        </TabsContent>

        {/* ── Formulas tab ── */}
        <TabsContent value="formulas" className="m-0 p-3 space-y-2">
          <p className="text-xs text-muted-foreground mb-2">
            Copy these formulas into any Excel cell. Requires the add-in to be installed.
          </p>
          {SAMPLE_FORMULAS.map(f => (
            <div key={f.name} className="border rounded-md p-2 bg-muted/30">
              <div className="flex items-start justify-between gap-1">
                <div className="flex-1 min-w-0">
                  <p className="text-[11px] font-semibold text-foreground">{f.name}</p>
                  <p className="text-[10px] text-muted-foreground">{f.desc}</p>
                  <code className="text-[10px] text-blue-600 dark:text-blue-400 font-mono block truncate mt-0.5">
                    {f.formula}
                  </code>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 w-6 p-0 shrink-0"
                  onClick={() => copyFormula(f.formula)}
                >
                  <Copy className="h-3 w-3" />
                </Button>
              </div>
            </div>
          ))}

          <div className="border rounded-md p-2 bg-blue-50 dark:bg-blue-950/30 mt-3">
            <p className="text-[11px] font-semibold text-blue-700 dark:text-blue-300 flex items-center gap-1">
              <Info className="h-3 w-3" /> Available fields for OC()
            </p>
            <div className="grid grid-cols-2 gap-x-3 mt-1">
              {["LTP", "OI", "IV", "CHANGE", "CHANGE_PCT", "VOLUME", "BID", "ASK", "GREEKS"].map(f => (
                <code key={f} className="text-[10px] text-muted-foreground font-mono">"{f}"</code>
              ))}
            </div>
          </div>
        </TabsContent>

        {/* ── Install tab ── */}
        <TabsContent value="install" className="m-0 p-3 space-y-3">
          <div className="border rounded-md p-3 space-y-2">
            <h3 className="text-xs font-semibold flex items-center gap-1.5">
              <FileSpreadsheet className="h-3.5 w-3.5" /> Install in Excel
            </h3>
            <p className="text-[11px] text-muted-foreground">
              Download the manifest and sideload it into Excel to use custom formulas.
            </p>
            <a
              href="/api/excel/manifest"
              download="fintekpro-addin-manifest.xml"
              className="block"
            >
              <Button size="sm" className="w-full h-7 text-xs">
                <Download className="h-3 w-3 mr-1.5" />
                Download Manifest (XML)
              </Button>
            </a>
          </div>

          <div className="border rounded-md p-3 space-y-1.5 text-[11px]">
            <p className="font-semibold">Sideloading steps (Excel Desktop)</p>
            <ol className="list-decimal list-inside space-y-1 text-muted-foreground">
              <li>Download the manifest XML above</li>
              <li>Open Excel → File → Options → Trust Center → Trust Center Settings</li>
              <li>Go to <strong>Trusted Add-in Catalogs</strong></li>
              <li>Add catalog URL: <code className="text-blue-600 font-mono">{window.location.origin}</code></li>
              <li>Restart Excel and go to Insert → My Add-ins → FintekPro Options</li>
            </ol>
          </div>

          <div className="border rounded-md p-3 space-y-1.5 text-[11px]">
            <p className="font-semibold">Excel Online</p>
            <ol className="list-decimal list-inside space-y-1 text-muted-foreground">
              <li>Open your workbook at office.com</li>
              <li>Insert → Add-ins → Upload My Add-in</li>
              <li>Upload the downloaded manifest XML</li>
            </ol>
          </div>

          <div className="border rounded-md p-2 bg-muted/30 text-[10px] text-muted-foreground">
            <span className="font-medium">Task pane URL:</span>{" "}
            <code className="font-mono text-blue-600">{window.location.origin}/excel-addin</code>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
