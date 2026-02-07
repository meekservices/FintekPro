import { useState, useCallback, useMemo } from 'react';
import { Checkbox } from '@/components/ui/checkbox';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { ChevronDown, X, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Skeleton } from '@/components/ui/skeleton';

export interface BulkAction<T> {
  id: string;
  label: string;
  icon?: React.ReactNode;
  variant?: 'default' | 'destructive' | 'outline';
  requiresConfirmation?: boolean;
  confirmTitle?: string;
  confirmDescription?: string;
  onExecute: (items: T[]) => Promise<void>;
}

export interface Column<T> {
  id: string;
  header: string;
  cell: (item: T) => React.ReactNode;
  className?: string;
}

interface BulkSelectTableProps<T extends { id: string | number }> {
  data: T[];
  columns: Column<T>[];
  bulkActions: BulkAction<T>[];
  getRowId?: (item: T) => string | number;
  isLoading?: boolean;
  emptyMessage?: string;
  className?: string;
}

export function BulkSelectTable<T extends { id: string | number }>({
  data,
  columns,
  bulkActions,
  getRowId = (item) => item.id,
  isLoading = false,
  emptyMessage = 'No items found',
  className,
}: BulkSelectTableProps<T>) {
  const [selectedIds, setSelectedIds] = useState<Set<string | number>>(new Set());
  const [pendingAction, setPendingAction] = useState<BulkAction<T> | null>(null);
  const [isExecuting, setIsExecuting] = useState(false);

  const allSelected = useMemo(() => {
    return data.length > 0 && data.every((item) => selectedIds.has(getRowId(item)));
  }, [data, selectedIds, getRowId]);

  const someSelected = useMemo(() => {
    return data.some((item) => selectedIds.has(getRowId(item))) && !allSelected;
  }, [data, selectedIds, allSelected, getRowId]);

  const selectedItems = useMemo(() => {
    return data.filter((item) => selectedIds.has(getRowId(item)));
  }, [data, selectedIds, getRowId]);

  const toggleSelectAll = useCallback(() => {
    if (allSelected) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(data.map((item) => getRowId(item))));
    }
  }, [allSelected, data, getRowId]);

  const toggleSelect = useCallback((id: string | number) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  const clearSelection = useCallback(() => {
    setSelectedIds(new Set());
  }, []);

  const handleAction = useCallback(async (action: BulkAction<T>) => {
    if (action.requiresConfirmation) {
      setPendingAction(action);
    } else {
      await executeAction(action);
    }
  }, [selectedItems]);

  const executeAction = async (action: BulkAction<T>) => {
    setIsExecuting(true);
    try {
      await action.onExecute(selectedItems);
      clearSelection();
    } finally {
      setIsExecuting(false);
      setPendingAction(null);
    }
  };

  const confirmAction = async () => {
    if (pendingAction) {
      await executeAction(pendingAction);
    }
  };

  return (
    <div className={cn('relative', className)}>
      {selectedIds.size > 0 && (
        <div 
          className="sticky top-0 z-10 flex items-center justify-between gap-4 px-4 py-3 mb-4 bg-primary text-primary-foreground rounded-lg shadow-lg animate-in slide-in-from-top-2"
          data-testid="bulk-action-toolbar"
        >
          <div className="flex items-center gap-3">
            <Badge variant="secondary" className="bg-card/20 text-foreground">
              {selectedIds.size} selected
            </Badge>
            <Button
              variant="ghost"
              size="sm"
              onClick={clearSelection}
              className="text-foreground hover:bg-card/20"
              data-testid="button-clear-selection"
            >
              <X className="h-4 w-4 mr-1" />
              Clear
            </Button>
          </div>
          
          <div className="flex items-center gap-2">
            {bulkActions.slice(0, 2).map((action) => (
              <Button
                key={action.id}
                variant={action.variant === 'destructive' ? 'destructive' : 'secondary'}
                size="sm"
                onClick={() => handleAction(action)}
                disabled={isExecuting}
                data-testid={`button-bulk-${action.id}`}
              >
                {isExecuting ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  action.icon && <span className="mr-2">{action.icon}</span>
                )}
                {action.label}
              </Button>
            ))}
            
            {bulkActions.length > 2 && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="secondary" size="sm" data-testid="button-more-actions">
                    More
                    <ChevronDown className="h-4 w-4 ml-1" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  {bulkActions.slice(2).map((action, index) => (
                    <DropdownMenuItem
                      key={action.id}
                      onClick={() => handleAction(action)}
                      className={action.variant === 'destructive' ? 'text-destructive' : ''}
                      data-testid={`menu-bulk-${action.id}`}
                    >
                      {action.icon && <span className="mr-2">{action.icon}</span>}
                      {action.label}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>
        </div>
      )}

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-12">
                <Checkbox
                  checked={allSelected}
                  ref={(ref) => {
                    if (ref) {
                      (ref as any).indeterminate = someSelected;
                    }
                  }}
                  onCheckedChange={toggleSelectAll}
                  aria-label="Select all"
                  data-testid="checkbox-select-all"
                />
              </TableHead>
              {columns.map((column) => (
                <TableHead key={column.id} className={column.className}>
                  {column.header}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              Array.from({ length: 5 }, (_, i) => (
                <TableRow key={`skeleton-${i}`} data-testid={`skeleton-row-${i}`}>
                  <TableCell className="w-12">
                    <Skeleton className="h-4 w-4" />
                  </TableCell>
                  {columns.map((column) => (
                    <TableCell key={column.id} className={column.className}>
                      <Skeleton className="h-4 w-full max-w-[150px]" />
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : data.length === 0 ? (
              <TableRow>
                <TableCell colSpan={columns.length + 1} className="h-24 text-center text-muted-foreground">
                  {emptyMessage}
                </TableCell>
              </TableRow>
            ) : (
              data.map((item) => {
                const rowId = getRowId(item);
                const isSelected = selectedIds.has(rowId);
                return (
                  <TableRow 
                    key={rowId} 
                    className={cn(isSelected && 'bg-muted/50')}
                    data-testid={`row-${rowId}`}
                  >
                    <TableCell>
                      <Checkbox
                        checked={isSelected}
                        onCheckedChange={() => toggleSelect(rowId)}
                        aria-label={`Select row ${rowId}`}
                        data-testid={`checkbox-row-${rowId}`}
                      />
                    </TableCell>
                    {columns.map((column) => (
                      <TableCell key={column.id} className={column.className}>
                        {column.cell(item)}
                      </TableCell>
                    ))}
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>

      <AlertDialog open={!!pendingAction} onOpenChange={() => setPendingAction(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {pendingAction?.confirmTitle || `Confirm ${pendingAction?.label}`}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {pendingAction?.confirmDescription || 
                `Are you sure you want to ${pendingAction?.label.toLowerCase()} ${selectedIds.size} selected item(s)? This action cannot be undone.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isExecuting}>Cancel</AlertDialogCancel>
            <AlertDialogAction 
              onClick={confirmAction}
              disabled={isExecuting}
              className={pendingAction?.variant === 'destructive' ? 'bg-destructive text-destructive-foreground hover:bg-destructive/90' : ''}
              data-testid="button-confirm-action"
            >
              {isExecuting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Processing...
                </>
              ) : (
                pendingAction?.label
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

export function useBulkSelection<T extends { id: string | number }>(
  data: T[],
  getRowId: (item: T) => string | number = (item) => item.id
) {
  const [selectedIds, setSelectedIds] = useState<Set<string | number>>(new Set());

  const selectedItems = useMemo(() => {
    return data.filter((item) => selectedIds.has(getRowId(item)));
  }, [data, selectedIds, getRowId]);

  const isAllSelected = useMemo(() => {
    return data.length > 0 && data.every((item) => selectedIds.has(getRowId(item)));
  }, [data, selectedIds, getRowId]);

  const isSomeSelected = useMemo(() => {
    return data.some((item) => selectedIds.has(getRowId(item))) && !isAllSelected;
  }, [data, selectedIds, isAllSelected, getRowId]);

  const toggle = useCallback((id: string | number) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  const toggleAll = useCallback(() => {
    if (isAllSelected) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(data.map((item) => getRowId(item))));
    }
  }, [isAllSelected, data, getRowId]);

  const clear = useCallback(() => {
    setSelectedIds(new Set());
  }, []);

  const isSelected = useCallback((id: string | number) => {
    return selectedIds.has(id);
  }, [selectedIds]);

  return {
    selectedIds,
    selectedItems,
    selectedCount: selectedIds.size,
    isAllSelected,
    isSomeSelected,
    toggle,
    toggleAll,
    clear,
    isSelected,
  };
}
