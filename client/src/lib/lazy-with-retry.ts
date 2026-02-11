import { lazy, ComponentType } from 'react';

interface LazyComponentLoader {
  (): Promise<{ default: ComponentType<any> }>;
}

export function lazyWithRetry(loader: LazyComponentLoader) {
  return lazy(async () => {
    try {
      return await loader();
    } catch (error) {
      if (import.meta.env.DEV) {
        console.error('Failed to load chunk, retrying...', error);
      }
      
      // Check if this is a chunk load error
      const errorMessage = error instanceof Error ? error.message : String(error);
      const isChunkLoadError = errorMessage.includes('Failed to fetch') || 
                               errorMessage.includes('dynamically imported') ||
                               errorMessage.includes('loading chunk');
      
      if (isChunkLoadError) {
        // Clear the module cache and reload the page
        if (import.meta.env.DEV) {
          console.warn('Chunk load error detected. Clearing cache and reloading...');
        }
        
        // Clear service worker cache if available
        if ('caches' in window) {
          caches.keys().then(cacheNames => {
            cacheNames.forEach(cacheName => {
              caches.delete(cacheName);
            });
          });
        }
        
        // Reload the page to get fresh chunks
        window.location.reload();
      }
      
      // Re-throw for other types of errors to be handled by Error Boundary
      throw error;
    }
  });
}
