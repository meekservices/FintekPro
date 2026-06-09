import "dotenv/config";

import { runStartupSchemaRepairs } from "./schema-repairs";

async function main() {
	console.log("Starting FintekPro schema repair job...");
	await runStartupSchemaRepairs();
	console.log("FintekPro schema repair job complete.");
}

main().catch((error) => {
	console.error("FintekPro schema repair job failed:", error);
	process.exitCode = 1;
});
