import cron from 'node-cron';
import { callPythonService } from '../services/python-service-caller';
import { isProductionEnvironment } from '../utils/enrichment-guard';

export function initializeDataLakeCron() {
  if (!isProductionEnvironment()) {
    console.log('⏭️ [DataLake Cron] Skipped (development mode)');
    return;
  }

  // 6:30 PM IST daily: POST /api/data-lake/store-bhavcopy
  // IST is UTC+5:30. 6:30 PM IST is 1:00 PM UTC.
  cron.schedule('0 13 * * *', async () => {
    console.log('[CRON] Starting daily NSE bhavcopy archival...');
    try {
      const result = await callPythonService('/api/data-lake/store-bhavcopy', 'POST');
      console.log('[CRON] NSE bhavcopy archival completed:', result);
    } catch (error: any) {
      console.error('[CRON] NSE bhavcopy archival failed:', error.message);
    }
  });

  // 7:00 PM IST daily: POST /api/data-lake/store-amfi-nav
  // 7:00 PM IST is 1:30 PM UTC.
  cron.schedule('30 13 * * *', async () => {
    console.log('[CRON] Starting daily AMFI NAV archival...');
    try {
      const result = await callPythonService('/api/data-lake/store-amfi-nav', 'POST');
      console.log('[CRON] AMFI NAV archival completed:', result);
    } catch (error: any) {
      console.error('[CRON] AMFI NAV archival failed:', error.message);
    }
  });

  console.log('📊 [DataLake Cron] Daily archival scheduled (6:30 PM & 7:00 PM IST)');
}
