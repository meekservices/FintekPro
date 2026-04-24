import { pickOfTheDayService } from "../server/services/pick-of-the-day-service";

async function verify() {
  console.log("Fetching performance stats...");
  try {
    const stats = await pickOfTheDayService.getPerformanceStats();
    console.log("Stats Response Structure:", JSON.stringify(stats, null, 2));
    
    const requiredKeys = ["totalPicks", "livePicks", "targetHits", "stoplossHits", "hitRate", "avgReturn"];
    const missing = requiredKeys.filter(k => !(k in stats));
    
    if (missing.length > 0) {
      console.error("❌ Missing keys:", missing);
    } else {
      console.log("✅ All required keys present.");
    }
    
    const types = Object.entries(stats).map(([k, v]) => `${k}: ${typeof v}`);
    console.log("Types:", types);
    
    const nonNumbers = Object.entries(stats).filter(([k, v]) => typeof v !== 'number');
    if (nonNumbers.length > 0) {
      console.error("❌ Some values are not numbers:", nonNumbers);
    } else {
      console.log("✅ All numeric stats are numbers.");
    }
  } catch (err) {
    console.error("❌ Verification failed:", err);
  }
}

verify();
