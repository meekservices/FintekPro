export const APP_VERSION = "2.5.8";
export const BUILD_TIMESTAMP = new Date().toISOString();
export const VERSION_CHECK_INTERVAL = 5 * 60 * 1000; // 5 minutes

export const getVersionDetails = () => ({
  version: APP_VERSION,
  timestamp: BUILD_TIMESTAMP,
  environment: process.env.NODE_ENV || 'development'
});
