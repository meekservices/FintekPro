import "dotenv/config";
import { runProductionBootstrap } from "./server/production-bootstrap";

async function main() {
  console.log("🚀 Starting Production Bootstrap...");
  try {
    await runProductionBootstrap();
    console.log("✅ Production Bootstrap completed successfully!");
  } catch (error) {
    console.error("❌ Bootstrap failed:", error);
    process.exit(1);
  }
}

main();
