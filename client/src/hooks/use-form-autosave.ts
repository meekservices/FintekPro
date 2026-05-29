import { useEffect, useState, useCallback } from "react";
import { UseFormReturn, FieldValues } from "react-hook-form";

interface UseFormAutosaveOptions<T extends FieldValues> {
  form: UseFormReturn<T>;
  storageKey: string;
  debounceMs?: number;
  excludeFields?: (keyof T)[];
}

interface AutosaveState {
  lastSaved: Date | null;
  hasDraft: boolean;
  isRestored: boolean;
}

export function useFormAutosave<T extends FieldValues>({
  form,
  storageKey,
  debounceMs = 1000,
  excludeFields = [],
}: UseFormAutosaveOptions<T>) {
  const [state, setState] = useState<AutosaveState>({
    lastSaved: null,
    hasDraft: false,
    isRestored: false,
  });
  const [showRestorePrompt, setShowRestorePrompt] = useState(false);

  const checkForDraft = useCallback(() => {
    try {
      const saved = localStorage.getItem(storageKey);
      if (saved) {
        const { data, timestamp } = JSON.parse(saved);
        const savedTime = new Date(timestamp);
        const now = new Date();
        const hoursSinceSave = (now.getTime() - savedTime.getTime()) / (1000 * 60 * 60);
        
        if (hoursSinceSave < 24 && data && Object.keys(data).length > 0) {
          const hasNonEmptyValues = Object.values(data).some(
            (v) => v !== "" && v !== null && v !== undefined
          );
          if (hasNonEmptyValues) {
            setState((prev) => ({ ...prev, hasDraft: true }));
            setShowRestorePrompt(true);
            return true;
          }
        } else {
          localStorage.removeItem(storageKey);
        }
      }
    } catch (error) {
      console.error("Error checking for draft:", error);
    }
    return false;
  }, [storageKey]);

  const restoreDraft = useCallback(() => {
    try {
      const saved = localStorage.getItem(storageKey);
      if (saved) {
        const { data } = JSON.parse(saved);
        if (data) {
          Object.keys(data).forEach((key) => {
            if (!excludeFields.includes(key as keyof T)) {
              form.setValue(key as any, data[key], { shouldValidate: false });
            }
          });
          setState((prev) => ({ ...prev, isRestored: true, hasDraft: false }));
          setShowRestorePrompt(false);
        }
      }
    } catch (error) {
      console.error("Error restoring draft:", error);
    }
  }, [form, storageKey, excludeFields]);

  const discardDraft = useCallback(() => {
    localStorage.removeItem(storageKey);
    setState((prev) => ({ ...prev, hasDraft: false }));
    setShowRestorePrompt(false);
  }, [storageKey]);

  const clearDraft = useCallback(() => {
    localStorage.removeItem(storageKey);
    setState({ lastSaved: null, hasDraft: false, isRestored: false });
  }, [storageKey]);

  useEffect(() => {
    checkForDraft();
  }, [checkForDraft]);

  useEffect(() => {
    const subscription = form.watch((data) => {
      const timeoutId = setTimeout(() => {
        try {
          const dataToSave: Record<string, any> = {};
          Object.keys(data).forEach((key) => {
            if (!excludeFields.includes(key as keyof T)) {
              dataToSave[key] = data[key];
            }
          });
          
          const hasNonEmptyValues = Object.values(dataToSave).some(
            (v) => v !== "" && v !== null && v !== undefined
          );
          
          if (hasNonEmptyValues) {
            localStorage.setItem(
              storageKey,
              JSON.stringify({
                data: dataToSave,
                timestamp: new Date().toISOString(),
              })
            );
            setState((prev) => ({ ...prev, lastSaved: new Date() }));
          }
        } catch (error) {
          console.error("Error saving draft:", error);
        }
      }, debounceMs);

      return () => clearTimeout(timeoutId);
    });

    return () => subscription.unsubscribe();
  }, [form, storageKey, debounceMs, excludeFields]);

  const formatLastSaved = useCallback(() => {
    if (!state.lastSaved) return null;
    const now = new Date();
    const diff = now.getTime() - state.lastSaved.getTime();
    const seconds = Math.floor(diff / 1000);
    
    if (seconds < 5) return "Just now";
    if (seconds < 60) return `${seconds}s ago`;
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m ago`;
    return state.lastSaved.toLocaleTimeString();
  }, [state.lastSaved]);

  return {
    ...state,
    showRestorePrompt,
    restoreDraft,
    discardDraft,
    clearDraft,
    formatLastSaved,
  };
}
