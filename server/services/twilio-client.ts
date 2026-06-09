import twilio from "twilio";
import { fetchWithTimeout } from "../utils/fetch-with-timeout";

let cachedClient: any = null;
let cachedPhoneNumber: string | null = null;

async function getCredentialsFromReplitConnector() {
	const hostname = process.env.REPLIT_CONNECTORS_HOSTNAME;
	const xReplitToken = process.env.REPL_IDENTITY
		? "repl " + process.env.REPL_IDENTITY
		: process.env.WEB_REPL_RENEWAL
			? "depl " + process.env.WEB_REPL_RENEWAL
			: null;

	if (!hostname || !xReplitToken) return null;

	try {
		const data = await fetchWithTimeout(
			"https://" +
				hostname +
				"/api/v2/connection?include_secrets=true&connector_names=twilio",
			{
				headers: {
					Accept: "application/json",
					X_REPLIT_TOKEN: xReplitToken,
				},
				timeoutMs: 10_000,
			},
		).then((res) => res.json());

		const settings = data.items?.[0]?.settings;
		if (!settings?.account_sid) return null;

		return {
			accountSid: settings.account_sid,
			apiKey: settings.api_key,
			apiKeySecret: settings.api_key_secret,
			phoneNumber: settings.phone_number,
		};
	} catch {
		return null;
	}
}

function getCredentialsFromEnv() {
	const accountSid = process.env.TWILIO_ACCOUNT_SID;
	const authToken = process.env.TWILIO_AUTH_TOKEN;
	const phoneNumber = process.env.TWILIO_PHONE_NUMBER;

	if (!accountSid || !authToken) return null;

	return {
		accountSid,
		apiKey: accountSid,
		apiKeySecret: authToken,
		phoneNumber: phoneNumber || "",
	};
}

async function getCredentials() {
	const replit = await getCredentialsFromReplitConnector();
	if (replit) return replit;

	const env = getCredentialsFromEnv();
	if (env) return env;

	throw new Error(
		"Twilio not configured: set TWILIO_ACCOUNT_SID + TWILIO_AUTH_TOKEN or use the Replit connector",
	);
}

export async function getTwilioClient() {
	if (cachedClient) return cachedClient;

	const { accountSid, apiKey, apiKeySecret } = await getCredentials();

	if (apiKey && apiKey !== accountSid && apiKeySecret) {
		cachedClient = twilio(apiKey, apiKeySecret, { accountSid });
	} else {
		cachedClient = twilio(accountSid, apiKeySecret);
	}

	console.log(
		"✅ Twilio client initialized via " +
			(process.env.REPLIT_CONNECTORS_HOSTNAME
				? "Replit connector"
				: "env credentials"),
	);
	return cachedClient;
}

export async function getTwilioFromPhoneNumber() {
	if (cachedPhoneNumber) return cachedPhoneNumber;
	const { phoneNumber } = await getCredentials();
	cachedPhoneNumber = phoneNumber;
	return phoneNumber;
}

export async function isTwilioConfigured(): Promise<boolean> {
	try {
		await getCredentials();
		return true;
	} catch {
		return false;
	}
}
