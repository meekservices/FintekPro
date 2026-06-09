/**
 * Thin compatibility shim — delegates to the canonical python-client.ts.
 * Kept so data-lake-cron.ts and any other historic callers don't need refactoring.
 * New code should import callPython directly from '../clients/python-client'.
 */
import { callPython } from "../clients/python-client";

export async function callPythonService(
	endpoint: string,
	method: "GET" | "POST" = "POST",
	data?: any,
) {
	const result = await callPython(endpoint, method, data);
	if (result === null) {
		throw new Error(
			`[PythonService] Call returned null (circuit open or service unavailable): ${method} ${endpoint}`,
		);
	}
	return result;
}
