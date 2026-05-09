import { useEffect, useRef, useCallback, useState } from 'react';
import { draftStorage, Draft, DraftMetadata, DraftStatus } from '@/lib/draft-storage';
import { useNetworkState } from '@/hooks/use-network-state';
import { useToast } from '@/hooks/use-toast';

interface UseDraftAutoSaveOptions {
  draftId: string;
  module: string;
  formType: string;
  userId: string;
  role: 'client' | 'agent' | 'admin' | 'partner';
  autoSaveInterval?: number;
  onRestored?: (data: Record<string, any>) => void;
}

export function useDraftAutoSave<T extends Record<string, any>>(
  options: UseDraftAutoSaveOptions
) {
  const { draftId, module, formType, userId, role, autoSaveInterval = 5000, onRestored } = options;
  const { isOffline, isSlow } = useNetworkState();
  const { toast } = useToast();
  
  const dataRef = useRef<T | null>(null);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [syncStatus, setSyncStatus] = useState<DraftStatus>('synced');
  const [hasDraft, setHasDraft] = useState(false);
  const [isRestoring, setIsRestoring] = useState(false);

  const checkForExistingDraft = useCallback(async () => {
    try {
      const draft = await draftStorage.getDraft(draftId);
      if (draft && draft.syncStatus === 'pending') {
        setHasDraft(true);
        return draft;
      }
    } catch (error) {
      console.error('[DraftAutoSave] Error checking for draft:', error);
    }
    return null;
  }, [draftId]);

  const restoreDraft = useCallback(async () => {
    setIsRestoring(true);
    try {
      const draft = await draftStorage.getDraft(draftId);
      if (draft) {
        onRestored?.(draft.data);
        toast({
          title: 'Draft restored',
          description: 'Your previous work has been restored.',
        });
        setHasDraft(false);
        return draft.data as T;
      }
    } catch (error) {
      console.error('[DraftAutoSave] Error restoring draft:', error);
      toast({
        title: 'Restore failed',
        description: 'Could not restore your draft.',
        variant: 'destructive',
      });
    } finally {
      setIsRestoring(false);
    }
    return null;
  }, [draftId, onRestored, toast]);

  const discardDraft = useCallback(async () => {
    try {
      await draftStorage.deleteDraft(draftId);
      setHasDraft(false);
      toast({
        title: 'Draft discarded',
        description: 'Your draft has been removed.',
      });
    } catch (error) {
      console.error('[DraftAutoSave] Error discarding draft:', error);
    }
  }, [draftId, toast]);

  const saveDraft = useCallback(async (data: T) => {
    dataRef.current = data;
    
    try {
      setSyncStatus('pending');
      await draftStorage.saveDraft(draftId, data, {
        userId,
        role,
        module,
        formType,
      });
      setLastSaved(new Date());
      
      if (isOffline) {
        setSyncStatus('pending');
      } else {
        setSyncStatus('synced');
      }
    } catch (error) {
      console.error('[DraftAutoSave] Save failed:', error);
      setSyncStatus('failed');
    }
  }, [draftId, userId, role, module, formType, isOffline]);

  const markAsSynced = useCallback(async () => {
    try {
      await draftStorage.updateDraftStatus(draftId, 'synced');
      setSyncStatus('synced');
    } catch (error) {
      console.error('[DraftAutoSave] Error marking as synced:', error);
    }
  }, [draftId]);

  const deleteDraft = useCallback(async () => {
    try {
      await draftStorage.deleteDraft(draftId);
      setLastSaved(null);
      setSyncStatus('synced');
      setHasDraft(false);
    } catch (error) {
      console.error('[DraftAutoSave] Error deleting draft:', error);
    }
  }, [draftId]);

  useEffect(() => {
    checkForExistingDraft();
  }, [checkForExistingDraft]);

  useEffect(() => {
    if (!autoSaveInterval || autoSaveInterval <= 0) return;

    const interval = setInterval(() => {
      if (dataRef.current) {
        saveDraft(dataRef.current);
      }
    }, autoSaveInterval);

    return () => clearInterval(interval);
  }, [autoSaveInterval, saveDraft]);

  useEffect(() => {
    const handleSyncDrafts = async () => {
      if (!isOffline && syncStatus === 'pending') {
        await markAsSynced();
      }
    };

    window.addEventListener('syncDrafts', handleSyncDrafts);
    return () => window.removeEventListener('syncDrafts', handleSyncDrafts);
  }, [isOffline, syncStatus, markAsSynced]);

  const updateData = useCallback((data: T) => {
    dataRef.current = data;
  }, []);

  return {
    saveDraft,
    updateData,
    markAsSynced,
    deleteDraft,
    restoreDraft,
    discardDraft,
    lastSaved,
    syncStatus,
    hasDraft,
    isRestoring,
    isOffline,
    isSlow,
  };
}

export function usePendingDrafts(userId: string) {
  const [pendingDrafts, setPendingDrafts] = useState<Draft[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const refreshPendingDrafts = useCallback(async () => {
    setIsLoading(true);
    try {
      const drafts = await draftStorage.getPendingDrafts(userId);
      setPendingDrafts(drafts);
    } catch (error) {
      console.error('[PendingDrafts] Error fetching drafts:', error);
    } finally {
      setIsLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    refreshPendingDrafts();
  }, [refreshPendingDrafts]);

  return {
    pendingDrafts,
    isLoading,
    refreshPendingDrafts,
  };
}
