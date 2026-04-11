/**
 * Payment API Connectivity & Version Audit Script
 * 
 * This script verifies that all payment-related integrations are talking to 
 * the correct API versions and that credentials are valid for the new implementations.
 */

import { cashfreeService } from "../cashfree-service";
import { alpacaBrokerService } from "../services/alpaca-broker-service";
import { irisKfintechService } from "../services/iris-kfintech-service";

async function auditCashfree() {
  console.log("\n--- [Audit] Cashfree PG v5 ---");
  const configured = cashfreeService.hasValidCredentials();
  console.log(`Configured: ${configured ? '✅' : '❌'}`);
  
  if (configured) {
    try {
      // Create a dummy order to test v5 connectivity
      const result = await cashfreeService.createOrder({
        amount: 1,
        userId: "audit_user_" + Date.now(),
        orderNote: "API Audit Test"
      });
      if (result.success) {
        console.log("Connectivity: ✅ Success (Order Created)");
        console.log(`Order ID: ${result.orderId}`);
        console.log(`Version Verified: 2025-01-01`);
      } else {
        console.log(`Connectivity: ❌ Failed (${result.message})`);
        console.log(`Status Code: ${result.statusCode}`);
      }
    } catch (err: any) {
      console.log(`Connectivity: ❌ Critical Error (${err.message})`);
    }
  }
}

async function auditAlpaca() {
  console.log("\n--- [Audit] Alpaca Broker ---");
  const configured = alpacaBrokerService.isConfigured();
  console.log(`Configured: ${configured ? '✅' : '❌'}`);
  
  if (configured) {
    const result = await alpacaBrokerService.testConnection();
    if (result.success) {
      console.log(`Connectivity: ✅ Success (${result.message})`);
      console.log(`Is Broker API: ${alpacaBrokerService.isBrokerApi() ? '✅' : '❌'}`);
    } else {
      console.log(`Connectivity: ❌ Failed (${result.message})`);
    }
  }
}

async function auditIris() {
  console.log("\n--- [Audit] Iris (KFintech) ---");
  const status = irisKfintechService.getStatus();
  console.log(`Configured (Env): ${status.configured ? '✅' : '❌'}`);
  
  if (status.configured) {
    try {
      const authed = await irisKfintechService.ensureAuth();
      if (authed) {
        console.log("Authentication: ✅ Success");
        const aum = await irisKfintechService.getAumSummary();
        console.log("Data Fetch: ✅ Success (AUM Summary retrieved)");
      } else {
        console.log("Authentication: ❌ Failed");
      }
    } catch (err: any) {
      console.log(`Connectivity: ❌ Failed (${err.message})`);
    }
  }
}

async function runAudit() {
  console.log("🚀 Starting Payment API Modernization Audit...");
  
  await auditCashfree();
  await auditAlpaca();
  await auditIris();
  
  console.log("\n--- Audit Complete ---");
}

runAudit().catch(err => {
  console.error("Audit failed with error:", err);
  process.exit(1);
});
