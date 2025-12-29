import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";

// Global error handlers to prevent unhandled promise rejections
window.addEventListener('unhandledrejection', (event) => {
  console.error('Unhandled promise rejection:', event.reason);
  // Prevent default browser handling
  event.preventDefault();
});

window.addEventListener('error', (event) => {
  console.error('Global error:', event.error);
});

// Register Service Worker for PWA functionality
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js')
      .then((registration) => {
        console.log('[PWA] Service Worker registered:', registration.scope);
        
        // Listen for updates
        registration.addEventListener('updatefound', () => {
          const newWorker = registration.installing;
          if (newWorker) {
            newWorker.addEventListener('statechange', () => {
              if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                console.log('[PWA] New content available, refresh to update');
              }
            });
          }
        });
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
  });
}

createRoot(document.getElementById("root")!).render(<App />);
