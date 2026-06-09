/**
 * MFCentral API Service
 *
 * MFCentral is India's unified mutual fund platform by CAMS + KFintech (AMFI-backed).
 * This service handles:
 *  - CAS Summary Request (PAN-level holdings across all AMCs)
 *  - CAS Detail Request (transaction-level data)
 *  - OTP validation flow
 *
 * Auth: AES-256-CBC encryption + RS256 digital signature
 * Docs: https://uatservices.mfcentral.com/api/client/V1/
 */

import crypto from "crypto";
import axios from "axios";

const MFCENTRAL_UAT_BASE = "https://uatservices.mfcentral.com/api/client/V1";
const MFCENTRAL_PROD_BASE = "https://services.mfcentral.com/api/client/V1";
const IV = Buffer.from("globalaesvectors", "utf8");

export interface MFCentralConfig {
	clientId: string;
	clientSecret: string;
	userName: string;
	password: string;
	encKey: string;
	privateKey?: string;
	isProduction?: boolean;
}

export interface CASHolding {
	folioNumber: string;
	isin?: string;
	schemeName: string;
	amcName: string;
	rtaAgent: string;
	units: number;
	nav: number;
	marketValue: number;
	investedValue: number;
	gainLoss: number;
	gainLossPercent: number;
	sipFlag: boolean;
	sipAmount?: number;
	sipFrequency?: string;
	sipNextDate?: string;
	sipEndDate?: string;
}

export interface CASInvestor {
	pan: string;
	name: string;
	email?: string;
	mobile?: string;
	folios: CASHolding[];
	totalMarketValue: number;
	totalInvestedValue: number;
}

export interface MFCentralCASResponse {
	investor: CASInvestor;
	requestId: string;
	status: "success" | "pending" | "otp_pending";
}

class MFCentralService {
	private config: MFCentralConfig | null = null;
	private baseUrl: string = MFCENTRAL_UAT_BASE;
	private accessToken: string | null = null;
	private tokenExpiry: number = 0;

	constructor() {
		const clientId = process.env.MFCENTRAL_CLIENT_ID;
		const clientSecret = process.env.MFCENTRAL_CLIENT_SECRET;
		const userName = process.env.MFCENTRAL_USERNAME;
		const password = process.env.MFCENTRAL_PASSWORD;
		const encKey = process.env.MFCENTRAL_ENC_KEY;

		if (clientId && clientSecret && userName && password && encKey) {
			this.config = { clientId, clientSecret, userName, password, encKey };
			const isProd = process.env.MFCENTRAL_ENV === "production";
			this.baseUrl = isProd ? MFCENTRAL_PROD_BASE : MFCENTRAL_UAT_BASE;
			console.log(
				`✅ MFCentral Service initialized (${isProd ? "PRODUCTION" : "UAT"} mode)`,
			);
		} else {
			console.log(
				"⚠️  [MFCentral] Credentials not configured — running in stub mode. Set MFCENTRAL_CLIENT_ID, MFCENTRAL_CLIENT_SECRET, MFCENTRAL_USERNAME, MFCENTRAL_PASSWORD, MFCENTRAL_ENC_KEY to enable.",
			);
		}
	}

	get isConfigured(): boolean {
		return this.config !== null;
	}

	/** AES-256-CBC encrypt with SHA-256 derived key */
	private encrypt(plainText: string): string {
		if (!this.config) throw new Error("MFCentral not configured");
		const keyBytes = crypto
			.createHash("sha256")
			.update(this.config.encKey)
			.digest();
		const cipher = crypto.createCipheriv("aes-256-cbc", keyBytes, IV);
		const encrypted = Buffer.concat([
			cipher.update(plainText, "utf8"),
			cipher.final(),
		]);
		return encrypted.toString("base64");
	}

	/** AES-256-CBC decrypt with SHA-256 derived key */
	private decrypt(cipherText: string): string {
		if (!this.config) throw new Error("MFCentral not configured");
		const keyBytes = crypto
			.createHash("sha256")
			.update(this.config.encKey)
			.digest();
		const decipher = crypto.createDecipheriv("aes-256-cbc", keyBytes, IV);
		const decoded = Buffer.from(cipherText, "base64");
		const decrypted = Buffer.concat([
			decipher.update(decoded),
			decipher.final(),
		]);
		return decrypted.toString("utf8");
	}

	/** Get OAuth access token (cached, auto-refreshed) */
	private async getAccessToken(): Promise<string> {
		if (!this.config) throw new Error("MFCentral not configured");
		if (this.accessToken && Date.now() < this.tokenExpiry) {
			return this.accessToken;
		}

		const params = new URLSearchParams({
			grant_type: "password",
			client_id: this.config.clientId,
			client_secret: this.config.clientSecret,
			username: this.config.userName,
			password: this.config.password,
		});

		const resp = await axios.post(
			`${this.baseUrl}/gettoken`,
			params.toString(),
			{ headers: { "Content-Type": "application/x-www-form-urlencoded" } },
		);

		this.accessToken = resp.data.access_token;
		this.tokenExpiry = Date.now() + (resp.data.expires_in - 60) * 1000;
		return this.accessToken!;
	}

	/** Build signed encrypted request envelope */
	private buildRequestEnvelope(payload: object): {
		signature: string;
		request: string;
	} {
		const json = JSON.stringify(payload);
		const encrypted = this.encrypt(json);

		let signature = "stub-sig";
		if (this.config?.privateKey) {
			const sign = crypto.createSign("SHA256");
			sign.update(encrypted);
			signature = sign.sign(this.config.privateKey, "base64");
		}

		return { signature, request: encrypted };
	}

	/**
	 * Initiate CAS request — sends OTP to investor's registered mobile/email.
	 * Returns a requestId used for OTP verification.
	 */
	async initiateCASRequest(
		pan: string,
		mobile: string,
		mode: "mobile" | "email" = "mobile",
	): Promise<{ requestId: string; message: string }> {
		if (!this.isConfigured) {
			return {
				requestId: `stub-${Date.now()}`,
				message: "OTP sent (stub mode)",
			};
		}

		const token = await this.getAccessToken();
		const payload = { pan: pan.toUpperCase(), consent: "Y", mode, mobile };
		const envelope = this.buildRequestEnvelope(payload);

		const resp = await axios.post(
			`${this.baseUrl}/submitcassummaryrequest`,
			envelope,
			{
				headers: {
					Authorization: `Bearer ${token}`,
					ClientId: this.config!.clientId,
					"Content-Type": "application/json",
				},
			},
		);

		const decrypted = this.decrypt(resp.data.response);
		const result = JSON.parse(decrypted);
		return {
			requestId: result.requestId || result.req_id,
			message: result.message || "OTP sent",
		};
	}

	/**
	 * Validate OTP and fetch CAS summary data.
	 */
	async validateOTPAndFetchCAS(
		requestId: string,
		otp: string,
	): Promise<MFCentralCASResponse | null> {
		if (!this.isConfigured) {
			return null;
		}

		const token = await this.getAccessToken();
		const payload = { requestId, otp };
		const envelope = this.buildRequestEnvelope(payload);

		const resp = await axios.post(`${this.baseUrl}/validateotp`, envelope, {
			headers: {
				Authorization: `Bearer ${token}`,
				ClientId: this.config!.clientId,
				"Content-Type": "application/json",
			},
		});

		const decrypted = this.decrypt(resp.data.response);
		const result = JSON.parse(decrypted);

		if (result.status !== "success") return null;

		return this.parseCASResponse(result);
	}

	/**
	 * Parse MFCentral CAS API response into typed CASInvestor.
	 */
	private parseCASResponse(raw: any): MFCentralCASResponse {
		const folios: CASHolding[] = (raw.folios || raw.holdings || []).map(
			(f: any) => {
				const sip = f.sipDetails || {};
				return {
					folioNumber: f.folioNo || f.folio_no || "",
					isin: f.isin || undefined,
					schemeName: f.schemeName || f.scheme_name || "",
					amcName: f.amcName || f.amc_name || "",
					rtaAgent: f.rtaAgent || f.rta || "",
					units: Number.parseFloat(f.units || "0"),
					nav: Number.parseFloat(f.nav || "0"),
					marketValue: Number.parseFloat(
						f.currentValue || f.market_value || "0",
					),
					investedValue: Number.parseFloat(
						f.investedValue || f.invested_value || "0",
					),
					gainLoss: Number.parseFloat(f.gainLoss || f.gain_loss || "0"),
					gainLossPercent: Number.parseFloat(
						f.gainLossPercent || f.gain_loss_pct || "0",
					),
					sipFlag: !!(sip.sipAmount || f.sipFlag),
					sipAmount: sip.sipAmount
						? Number.parseFloat(sip.sipAmount)
						: undefined,
					sipFrequency: sip.frequency || undefined,
					sipNextDate: sip.nextInstallmentDate || undefined,
					sipEndDate: sip.endDate || undefined,
				};
			},
		);

		const investor: CASInvestor = {
			pan: raw.pan || "",
			name: raw.investorName || raw.investor_name || "",
			email: raw.email || undefined,
			mobile: raw.mobile || undefined,
			folios,
			totalMarketValue: folios.reduce((s, h) => s + h.marketValue, 0),
			totalInvestedValue: folios.reduce((s, h) => s + h.investedValue, 0),
		};

		return { investor, requestId: raw.requestId || "", status: "success" };
	}
}

export const mfCentralService = new MFCentralService();
