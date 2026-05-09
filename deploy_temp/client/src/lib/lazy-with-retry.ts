import { lazy, ComponentType } from 'react';

interface LazyComponentLoader {
  (): Promise<{ default: ComponentType<any> }>;
}

function RefreshingPlaceholder() {
  return null;
}

export function lazyWithRetry(loader: LazyComponentLoader) {
  return lazy(async () => {
    try {
      return await loader();
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      const isChunkLoadError = errorMessage.includes('Failed to fetch') ||
                               errorMessage.includes('dynamically imported') ||
                               errorMessage.includes('loading chunk') ||
                               errorMessage.includes('Importing a module script failed');

      if (isChunkLoadError) {
        const reloadKey = 'chunk-reload-' + window.location.pathname;
        if (!sessionStorage.getItem(reloadKey)) {
          sessionStorage.setItem(reloadKey, '1');
          // MUST await cache deletion before reload — otherwise the SW still has stale
          // chunks when the new page loads, causing a second failure that the guard blocks.
          if ('caches' in window) {
            try {
              const cacheNames = await caches.keys();
              await Promise.all(cacheNames.map(name => caches.delete(name)));
            } catch (_) {}
          }
          window.location.reload();
          return { default: RefreshingPlaceholder };
        }
      }

      throw error;
    }
  });
}
