import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsTrigger } from "@/components/ui/tabs";
import { ScrollableTabsList } from "@/components/ScrollableTabsList";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { 
  Building2, 
  Search, 
  ShieldCheck, 
  History, 
  Database, 
  Link as LinkIcon,
  Activity,
  Calendar,
  Layers,
  CheckCircle2,
  AlertCircle
} from "lucide-react";
import { useState } from "react";

export default function InstitutionalData() {
  const [searchQuery, setSearchQuery] = useState("");

  const { data: corporateActions, isLoading: actionsLoading } = useQuery<any[]>({
    queryKey: ["/api/institutional/corporate-actions"],
  });

  const { data: creditRatings, isLoading: ratingsLoading } = useQuery<any[]>({
    queryKey: ["/api/institutional/credit-ratings"],
  });

  const { data: securityMaster, isLoading: masterLoading } = useQuery<any[]>({
    queryKey: ["/api/institutional/security-master", searchQuery],
    queryFn: async () => {
      const url = searchQuery.length >= 2 
        ? `/api/institutional/security-master?q=${encodeURIComponent(searchQuery)}`
        : "/api/institutional/security-master";
      const res = await fetch(url);
      if (!res.ok) throw new Error("Failed to fetch security master");
      return res.json();
    }
  });

  const { data: symbolMapping, isLoading: mappingLoading } = useQuery<any[]>({
    queryKey: ["/api/institutional/symbol-mapping"],
  });

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Institutional Data Layer</h1>
          <p className="text-muted-foreground">
            Corporate actions, credit ratings, security master, and cross-provider symbol mappings.
          </p>
        </div>
      </div>

      <Tabs defaultValue="actions" className="space-y-4">
        <ScrollableTabsList>
          <TabsTrigger value="actions">
            <Calendar className="h-4 w-4 mr-2" />
            Corporate Actions
          </TabsTrigger>
          <TabsTrigger value="ratings">
            <ShieldCheck className="h-4 w-4 mr-2" />
            Credit Ratings
          </TabsTrigger>
          <TabsTrigger value="master">
            <Database className="h-4 w-4 mr-2" />
            Security Master
          </TabsTrigger>
          <TabsTrigger value="mapping">
            <LinkIcon className="h-4 w-4 mr-2" />
            Symbol Mapping
          </TabsTrigger>
        </ScrollableTabsList>

        <TabsContent value="actions" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Corporate Actions</CardTitle>
              <CardDescription>
                Dividends, splits, bonus, and other corporate events.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {actionsLoading ? (
                <div className="space-y-2">
                  {[...Array(5)].map((_, i) => (
                    <Skeleton key={i} className="h-12 w-full" />
                  ))}
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>ISIN</TableHead>
                      <TableHead>Symbol</TableHead>
                      <TableHead>Action Type</TableHead>
                      <TableHead>Ex-Date</TableHead>
                      <TableHead>Details</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {corporateActions?.map((action) => (
                      <TableRow key={action.id}>
                        <TableCell className="font-medium">{action.isin}</TableCell>
                        <TableCell>{action.symbol || "-"}</TableCell>
                        <TableCell>
                          <Badge variant="outline">{action.actionType}</Badge>
                        </TableCell>
                        <TableCell>{new Date(action.exDate).toLocaleDateString()}</TableCell>
                        <TableCell className="max-w-xs truncate">
                          {action.purpose || action.ratio || action.dividendAmount || "-"}
                        </TableCell>
                        <TableCell>
                          {action.isAppliedToGoldenPrices ? (
                            <Badge className="bg-green-100 text-green-800 border-green-200">
                              <CheckCircle2 className="h-3 w-3 mr-1" /> Applied
                            </Badge>
                          ) : (
                            <Badge variant="secondary">
                              <Activity className="h-3 w-3 mr-1" /> Pending
                            </Badge>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                    {corporateActions?.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                          No corporate actions found.
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="ratings" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Credit Ratings</CardTitle>
              <CardDescription>
                Full history of rating changes per ISIN.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {ratingsLoading ? (
                <div className="space-y-2">
                  {[...Array(5)].map((_, i) => (
                    <Skeleton key={i} className="h-12 w-full" />
                  ))}
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>ISIN</TableHead>
                      <TableHead>Instrument</TableHead>
                      <TableHead>Agency</TableHead>
                      <TableHead>Rating</TableHead>
                      <TableHead>Outlook</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead>Action</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {creditRatings?.map((rating) => (
                      <TableRow key={rating.id}>
                        <TableCell className="font-medium">{rating.isin}</TableCell>
                        <TableCell>{rating.instrumentName || "-"}</TableCell>
                        <TableCell>{rating.agency}</TableCell>
                        <TableCell>
                          <Badge variant="secondary" className="font-bold">{rating.rating}</Badge>
                        </TableCell>
                        <TableCell>{rating.ratingOutlook || "-"}</TableCell>
                        <TableCell>{new Date(rating.ratingDate).toLocaleDateString()}</TableCell>
                        <TableCell>{rating.ratingAction || "Assigned"}</TableCell>
                      </TableRow>
                    ))}
                    {creditRatings?.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                          No credit ratings found.
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="master" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Security Master</CardTitle>
                  <CardDescription>
                    Searchable repository of all tradeable instruments.
                  </CardDescription>
                </div>
                <div className="relative w-72">
                  <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    type="search"
                    placeholder="Search ISIN, Symbol or Name..."
                    className="pl-8"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                  />
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {masterLoading ? (
                <div className="space-y-2">
                  {[...Array(5)].map((_, i) => (
                    <Skeleton key={i} className="h-12 w-full" />
                  ))}
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>ISIN</TableHead>
                      <TableHead>Name</TableHead>
                      <TableHead>Asset Class</TableHead>
                      <TableHead>Symbol</TableHead>
                      <TableHead>Exchange</TableHead>
                      <TableHead>Sector</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {securityMaster?.map((security) => (
                      <TableRow key={security.isin}>
                        <TableCell className="font-medium font-mono">{security.isin}</TableCell>
                        <TableCell className="max-w-xs truncate">{security.instrument_name}</TableCell>
                        <TableCell>
                          <Badge variant="outline" className="capitalize">
                            {security.asset_class?.replace('_', ' ')}
                          </Badge>
                        </TableCell>
                        <TableCell>{security.symbol || "-"}</TableCell>
                        <TableCell>{security.exchange}</TableCell>
                        <TableCell>{security.sector || "-"}</TableCell>
                      </TableRow>
                    ))}
                    {securityMaster?.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                          No securities found.
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="mapping" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Symbol Mapping</CardTitle>
              <CardDescription>
                Cross-reference for NSE, BSE, ISIN, and other provider identifiers.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {mappingLoading ? (
                <div className="space-y-2">
                  {[...Array(5)].map((_, i) => (
                    <Skeleton key={i} className="h-12 w-full" />
                  ))}
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>ISIN</TableHead>
                      <TableHead>Provider</TableHead>
                      <TableHead>Provider Symbol</TableHead>
                      <TableHead>Name (Provider Source)</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {symbolMapping?.map((map) => (
                      <TableRow key={map.id}>
                        <TableCell className="font-medium font-mono">{map.isin}</TableCell>
                        <TableCell>
                          <Badge variant="secondary">{map.provider}</Badge>
                        </TableCell>
                        <TableCell className="font-mono">{map.providerSymbol}</TableCell>
                        <TableCell>{map.providerName || "-"}</TableCell>
                        <TableCell>
                          {map.isActive ? (
                            <Badge className="bg-blue-100 text-blue-800 border-blue-200">Active</Badge>
                          ) : (
                            <Badge variant="destructive">Inactive</Badge>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                    {symbolMapping?.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                          No symbol mappings found.
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
