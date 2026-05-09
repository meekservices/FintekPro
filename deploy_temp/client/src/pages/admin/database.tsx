import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Database, Table2, HardDrive, Search, ChevronLeft, ChevronRight, Eye, RefreshCw, Layers } from 'lucide-react';
import { LoadingState } from '@/components/LoadingState';

interface TableInfo {
  tableName: string;
  rowCount: number;
  sizeBytes: number;
  sizeFormatted: string;
}

interface DbStats {
  databaseSize: string;
  tableCount: number;
  activeConnections: number;
}

interface ColumnInfo {
  name: string;
  type: string;
  nullable: boolean;
  defaultValue: string | null;
}

export default function AdminDatabase() {
  const [selectedTable, setSelectedTable] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [page, setPage] = useState(1);
  const [tableSearch, setTableSearch] = useState('');

  const { data: statsData, isLoading: statsLoading, refetch: refetchStats } = useQuery<{ success: boolean; stats: DbStats }>({
    queryKey: ['/api/admin/database/stats']
  });

  const { data: tablesData, isLoading: tablesLoading, refetch: refetchTables } = useQuery<{ success: boolean; tables: TableInfo[] }>({
    queryKey: ['/api/admin/database/tables']
  });

  const { data: columnsData } = useQuery<{ success: boolean; columns: ColumnInfo[] }>({
    queryKey: ['/api/admin/database/tables', selectedTable, 'columns'],
    queryFn: async () => {
      if (!selectedTable) return { success: true, columns: [] };
      const res = await fetch(`/api/admin/database/tables/${selectedTable}/columns`);
      return res.json();
    },
    enabled: !!selectedTable
  });

  const { data: tableData, isLoading: dataLoading, refetch: refetchData } = useQuery<{
    success: boolean;
    data: any[];
    pagination: { page: number; limit: number; totalRows: number; totalPages: number };
  }>({
    queryKey: ['/api/admin/database/tables', selectedTable, 'data', page, searchTerm],
    queryFn: async () => {
      if (!selectedTable) return { success: true, data: [], pagination: { page: 1, limit: 50, totalRows: 0, totalPages: 0 } };
      const params = new URLSearchParams({ page: String(page), limit: '50' });
      if (searchTerm) params.append('search', searchTerm);
      const res = await fetch(`/api/admin/database/tables/${selectedTable}/data?${params}`);
      return res.json();
    },
    enabled: !!selectedTable
  });

  const stats = statsData?.stats;
  const tables = tablesData?.tables || [];
  const columns = columnsData?.columns || [];
  const rows = tableData?.data || [];
  const pagination = tableData?.pagination;

  const filteredTables = tables.filter(t => 
    t.tableName.toLowerCase().includes(tableSearch.toLowerCase())
  );

  const handleRefresh = () => {
    refetchStats();
    refetchTables();
    if (selectedTable) refetchData();
  };

  if (statsLoading || tablesLoading) {
    return <LoadingState variant="stats" />;
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Database Management</h1>
          <p className="text-muted-foreground">View and browse database tables</p>
        </div>
        <Button variant="outline" onClick={handleRefresh}>
          <RefreshCw className="mr-2 h-4 w-4" />
          Refresh
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Database Size</CardTitle>
            <HardDrive className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.databaseSize || 'N/A'}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Total Tables</CardTitle>
            <Layers className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.tableCount || 0}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Active Connections</CardTitle>
            <Database className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.activeConnections || 0}</div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Table2 className="h-5 w-5" />
              Tables
            </CardTitle>
            <div className="relative">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search tables..."
                value={tableSearch}
                onChange={(e) => setTableSearch(e.target.value)}
                className="pl-8"
              />
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <ScrollArea className="h-[500px]">
              <div className="space-y-1 p-2">
                {filteredTables.map((table) => (
                  <button
                    key={table.tableName}
                    onClick={() => {
                      setSelectedTable(table.tableName);
                      setPage(1);
                      setSearchTerm('');
                    }}
                    className={`w-full text-left px-3 py-2 rounded-md transition-colors ${
                      selectedTable === table.tableName
                        ? 'bg-primary text-primary-foreground'
                        : 'hover:bg-muted'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-sm truncate">{table.tableName}</span>
                      <div className="flex items-center gap-2">
                        <Badge variant="secondary" className="text-xs">
                          {table.rowCount.toLocaleString()}
                        </Badge>
                        <span className="text-xs text-muted-foreground">{table.sizeFormatted}</span>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Eye className="h-5 w-5" />
                  {selectedTable ? `Table: ${selectedTable}` : 'Select a Table'}
                </CardTitle>
                {selectedTable && pagination && (
                  <CardDescription>
                    {pagination.totalRows.toLocaleString()} rows total
                  </CardDescription>
                )}
              </div>
              {selectedTable && (
                <div className="flex items-center gap-2">
                  <div className="relative">
                    <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Search..."
                      value={searchTerm}
                      onChange={(e) => {
                        setSearchTerm(e.target.value);
                        setPage(1);
                      }}
                      className="pl-8 w-[200px]"
                    />
                  </div>
                </div>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {!selectedTable ? (
              <div className="text-center py-20 text-muted-foreground">
                <Database className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>Select a table from the list to view its data</p>
              </div>
            ) : dataLoading ? (
              <LoadingState variant="table" />
            ) : (
              <>
                <div className="overflow-x-auto max-h-[400px] overflow-y-auto border rounded-md">
                  <Table>
                    <TableHeader className="sticky top-0 bg-background z-10">
                      <TableRow>
                        {columns.map((col) => (
                          <TableHead key={col.name} className="font-mono text-xs whitespace-nowrap min-w-[120px]">
                            {col.name}
                            <span className="block text-[10px] text-muted-foreground">{col.type}</span>
                          </TableHead>
                        ))}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {rows.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={columns.length || 1} className="text-center py-8 text-muted-foreground">
                            No data found
                          </TableCell>
                        </TableRow>
                      ) : (
                        rows.map((row, i) => (
                          <TableRow key={i}>
                            {columns.map((col) => (
                              <TableCell key={col.name} className="font-mono text-xs whitespace-nowrap max-w-[250px] truncate">
                                {formatCellValue(row[col.name])}
                              </TableCell>
                            ))}
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </div>

                {pagination && pagination.totalPages > 1 && (
                  <div className="flex items-center justify-between mt-4">
                    <div className="text-sm text-muted-foreground">
                      Page {pagination.page} of {pagination.totalPages}
                    </div>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setPage(p => Math.max(1, p - 1))}
                        disabled={page <= 1}
                      >
                        <ChevronLeft className="h-4 w-4" />
                        Previous
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setPage(p => Math.min(pagination.totalPages, p + 1))}
                        disabled={page >= pagination.totalPages}
                      >
                        Next
                        <ChevronRight className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                )}
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function formatCellValue(value: any): string {
  if (value === null || value === undefined) return '—';
  if (typeof value === 'boolean') return value ? 'true' : 'false';
  if (typeof value === 'object') {
    try {
      return JSON.stringify(value).substring(0, 50) + (JSON.stringify(value).length > 50 ? '...' : '');
    } catch {
      return '[Object]';
    }
  }
  const str = String(value);
  return str.length > 50 ? str.substring(0, 50) + '...' : str;
}
