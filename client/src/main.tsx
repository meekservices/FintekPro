import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";
import { SessionProvider } from "@/contexts/session-context";
import { SessionExpiredDialog } from "@/components/ui/session-expired-dialog";
import { APP_VERSION } from "@shared/version";

const SW_VERSION = APP_VERSION;
// In dev: use 'dev' so the SW URL never changes → no banner on every refresh.
// In prod: use APP_VERSION so the banner only fires when a new version is actually deployed.
// (BUILD_TIMESTAMP = new Date() runs at runtime in the browser, so it changes every page load — do NOT use it here.)
const SW_BUILD = import.meta.env.DEV ? 'dev' : APP_VERSION;

// Vite chunk loading error handler for stale cached chunks after deployments
window.addEventListener('vite:preloadError', () => {
  const key = 'preload-err-reload';
  if (!sessionStorage.getItem(key)) {
    sessionStorage.setItem(key, '1');
    window.location.reload();
  }
});

// Global error handlers to prevent unhandled promise rejections
window.addEventListener('unhandledrejection', (event) => {
  console.error('Unhandled promise rejection:', event.reason);
  // Prevent default browser handling
  event.preventDefault();
});

// Enhanced error handler for dynamic import failures
window.addEventListener('error', (event) => {
  if (event.message && event.message.includes('Failed to fetch dynamically imported module') ||
      event.message && event.message.includes('Importing a module script failed')) {
    console.warn('[PWA] Stale chunk detected, reloading...');
    const reloadKey = 'chunk-reload-' + window.location.pathname;
    if (!sessionStorage.getItem(reloadKey)) {
      sessionStorage.setItem(reloadKey, '1');
      window.location.reload();
    }
  } else {
    console.error('Global error:', event.error);
  }
});

// Register Service Worker for PWA functionality
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register(`/sw.js?v=${SW_VERSION}&b=${SW_BUILD}`)
      .then((registration) => {
        console.log('[PWA] Service Worker registered:', registration.scope);
        
        // Store registration globally for refresh functionality
        (window as any).__swRegistration = registration;
        
        // Listen for updates
        registration.addEventListener('updatefound', () => {
          const newWorker = registration.installing;
          if (newWorker) {
            newWorker.addEventListener('statechange', () => {
              if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                console.log('[PWA] New content available, refresh to update');
                // Dispatch custom event for UI notification
                window.dispatchEvent(new CustomEvent('appUpdateAvailable', {
                  detail: { registration, newWorker }
                }));
              }
            });
          }
        });
        
        // Check for waiting worker on page load (update was found previously)
        if (registration.waiting) {
          console.log('[PWA] Update waiting from previous session');
          window.dispatchEvent(new CustomEvent('appUpdateAvailable', {
            detail: { registration, newWorker: registration.waiting }
          }));
        }
      })
      .catch((error) => {
        console.error('[PWA] Service Worker registration failed:', error);
      });
    
    // Listen for sync messages from service worker
    navigator.serviceWorker.addEventListener('message', (event) => {
      if (event.data && event.data.type === 'SYNC_DRAFTS') {
        window.dispatchEvent(new CustomEvent('syncDrafts'));
      }
      if (event.data && event.data.type === 'SYNC_ACTIONS') {
        window.dispatchEvent(new CustomEvent('syncActions'));
      }
    });
    
    // Listen for controller change (new SW activated) and reload.
    // Guard: don't reload if the page just loaded (prevents double-reload on first visit).
    const pageReadyAt = Date.now();
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (Date.now() - pageReadyAt > 4000) {
        console.log('[PWA] New service worker activated, reloading...');
        window.location.reload();
      }
    });
  });
}

createRoot(document.getElementById("root")!).render(
  <SessionProvider>
    <App />
    <SessionExpiredDialog />
  </SessionProvider>
);
