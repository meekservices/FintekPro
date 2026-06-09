/**
 * CAS Parser Test Runner Script
 * Run with: npx tsx server/tests/run-cas-tests.ts
 */

import {
	testDateParsing,
	runAllCASRegressionTests,
} from "./cas-parser-regression-test";

async function main() {
	console.log("=".repeat(60));
	console.log("CAS Parser Regression Test Suite");
	console.log("=".repeat(60));

	console.log("\n1. Running date parsing tests...");
	const dateResults = testDateParsing();
	console.log(
		`   Date parsing: ${dateResults.passed ? "✅ PASSED" : "❌ FAILED"}`,
	);
	if (!dateResults.passed) {
		console.log(
			"   Failed tests:",
			dateResults.results.filter((r) => !r.passed).map((r) => r.name),
		);
	}

	console.log(
		"\n2. Running full regression suite (golden fixtures + format variance)...",
	);
	const fullResults = await runAllCASRegressionTests();
	console.log(
		`   Golden fixtures: ${fullResults.goldenFixtures.passed}/${fullResults.goldenFixtures.total} passed`,
	);
	console.log(
		`   Format variance: ${fullResults.formatVariance.passed}/${fullResults.formatVariance.total} passed`,
	);

	console.log("\n" + "=".repeat(60));
	console.log(
		`OVERALL: ${fullResults.passed ? "✅ ALL TESTS PASSED" : "❌ SOME TESTS FAILED"}`,
	);
	console.log("=".repeat(60));

	process.exit(fullResults.passed ? 0 : 1);
}

main().catch((error) => {
	console.error("Test runner error:", error);
	process.exit(1);
});
