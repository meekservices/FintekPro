
import "dotenv/config";
import { pickOfTheDayService } from "../server/services/pick-of-the-day-service";
import { db, testConnection } from "../server/db";

async function verify() {
  console.log("🔍 Verifying Pick of the Day Service...");
  
  const connected = await testConnection();
  if (!connected) {
    console.error("❌ Database connection failed. Ensure Cloud SQL Proxy is running.");
    process.exit(1);
  }
  console.log("✅ Database connected.");

  try {
    console.log("Fetching today's picks...");
    const picks = await pickOfTheDayService.getTodaysPicks();
    console.log(`✅ Found ${picks.length} picks for today.`);
    if (picks.length > 0) {
      console.table(picks.map(p => ({
        symbol: p.symbol,
        category: p.category,
        recoDate: p.recoDate,
        score: p.recoScore
      })));
    }

    console.log("Fetching performance stats...");
    const stats = await pickOfTheDayService.getPerformanceStats();
    console.log("✅ Performance stats retrieved:");
    console.log(JSON.stringify(stats, null, 2));

    console.log("Fetching pick history...");
    const history = await pickOfTheDayService.getPickHistory(5);
    console.log(`✅ Retrieved history (${history.length} items).`);

  } catch (error) {
    console.error("❌ Verification failed:", error);
  } finally {
    process.exit(0);
  }
}

verify();
