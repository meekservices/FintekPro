import { db } from "./server/db";
import { activityInsightsService } from "./server/services/activity-insights-service";

async function run() {
  console.log("Fetching metrics...");
  const metrics = await activityInsightsService.getActivityMetrics();
  console.log("Metrics:", JSON.stringify(metrics, null, 2));
  
  console.log("\nGenerating AI insights...");
  const insights = await activityInsightsService.generateAIInsights(metrics);
  console.log("Insights:", JSON.stringify(insights, null, 2));
  
  process.exit(0);
}
run().catch(console.error);
