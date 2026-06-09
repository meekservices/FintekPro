#!/usr/bin/env tsx
/**
 * Cashfree Webhook Test CLI
 * Usage: npx tsx server/test-webhook.ts [orderId]
 */

import { webhookTester } from "./webhook-test-utility";

async function main() {
	const orderId = process.argv[2] || `test_order_${Date.now()}`;

	console.log("\n🧪 Cashfree Webhook Test Utility");
	console.log("═".repeat(60));
	console.log(`📦 Test Order ID: ${orderId}`);
	console.log("═".repeat(60));

	// Run the full test suite
	await webhookTester.runTestSuite(orderId);

	console.log("\n✨ All tests completed!");
	console.log("\n💡 Next steps:");
	console.log("   1. Check server logs above for webhook responses");
	console.log("   2. Verify transaction status in database");
	console.log("   3. Check if payment-execution bridge was triggered\n");

	process.exit(0);
}

main().catch((error) => {
	console.error("\n❌ Test failed:", error);
	process.exit(1);
});
