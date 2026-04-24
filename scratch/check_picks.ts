import { db } from "../server/db";
import { dailyPicks } from "../shared/schema";
import { sql, eq } from "drizzle-orm";

async function checkPicks() {
  try {
    const counts = await db.select({ 
      count: sql<number>`count(*)`,
      category: dailyPicks.category 
    }).from(dailyPicks).groupBy(dailyPicks.category);
    
    console.log("Pick counts by category:");
    counts.forEach(c => console.log(`${c.category}: ${c.count}`));
    
    const today = new Date().toISOString().split('T')[0];
    const todayCount = await db.select({ count: sql<number>`count(*)` })
      .from(dailyPicks).where(eq(dailyPicks.recoDate, today));
    
    console.log(`Picks for today (${today}): ${todayCount[0]?.count || 0}`);
    
    process.exit(0);
  } catch (err) {
    console.error("Error checking picks:", err);
    process.exit(1);
  }
}

checkPicks();
