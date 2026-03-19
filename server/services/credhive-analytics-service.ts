/**
 * Credhive Analytics Service
 *
 * Re-exports the analytics service (formerly probe42-analytics-service)
 * under the Credhive brand name.
 */

export {
  getProbe42AnalyticsService as getCredhiveAnalyticsService,
  Probe42AnalyticsService as CredhiveAnalyticsService,
} from './probe42-analytics-service';
