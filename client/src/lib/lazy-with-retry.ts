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
        if ('caches' in window) {
          caches.keys().then(cacheNames => {
            cacheNames.forEach(cacheName => caches.delete(cacheName));
          });
        }

        const reloadKey = 'chunk-reload-' + window.location.pathname;
        if (!sessionStorage.getItem(reloadKey)) {
          sessionStorage.setItem(reloadKey, '1');
          window.location.reload();
          return { default: RefreshingPlaceholder };
        }
      }

      throw error;
    }
  });
}
