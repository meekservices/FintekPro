/**
 * Truthscreen Aadhaar Verification Service
 *
 * Provides Aadhaar verification, PAN-Aadhaar linkage check, and eKYC via Truthscreen API.
 * Uses AES-256-CBC encryption for secure payload transmission.
 *
 * Documentation: https://www.truthscreen.com
 */

import axios from "axios";
import CryptoJS from "crypto-js";

interface TruthscreenOTPResponse {
	success: boolean;
	message: string;
	refId?: string;
	status?: string;
	maskedAadhaar?: string;
	transactionId?: string;
}

interface TruthscreenVerificationResponse {
	success: boolean;
	message: string;
	verified: boolean;
	data?: {
		aadhaarNumber: string;
		name: string;
		dob: string;
		gender: string;
		fatherName?: string;
		address: {
			house: string;
			street: string;
			landmark: string;
			locality: string;
			city: string;
			state: string;
			pincode: string;
			country: string;
		};
		mobile?: string;
		email?: string;
		photoBase64?: string;
	};
}

interface TruthscreenValidationResponse {
	success: boolean;
	message: string;
	valid: boolean;
	maskedAadhaar?: string;
}

interface TruthscreenPanAadhaarResponse {
	success: boolean;
	message: string;
	linked: boolean;
	linkStatus?: "LINKED" | "NOT_LINKED" | "DEACTIVATED" | "PENDING";
	pan?: string;
	aadhaarLastFour?: string;
	linkDate?: string;
}

interface KRARecord {
	kra: string;
	dateOfUpload: string;
	status: string;
	statusDescription: string;
	statusDate: string;
	dateOfModification: string;
	modifyStatus: string;
	modifyHoldReasons: string;
}

interface TruthscreenCKYCStatusResponse {
	success: boolean;
	message: string;
	pan: string;
	ckycApplicationDate?: string;
	ckycApplicationStatus?: string;
	ckycNumber?: string;
	kraStatus: {
		statusDate?: string;
		kycFlag: string;
		digilockerKyc: boolean;
		eSignFlag: string;
		ipvFlag: string;
		ipvStatus: string;
	};
	kraRecords: KRARecord[];
	isKycValidated: boolean;
	validatedKra?: string;
}

export class TruthscreenAadhaarService {
	private static readonly BASE_URL = "https://www.truthscreen.com";
	private static readonly PAN_AADHAAR_ENDPOINT =
		"/v1/apicall/employment/pan_aadhaar_linking";
	private static readonly NID_ENDPOINT = "/v1/apicall/nid/idsearch";
	private static readonly CKYC_ENDPOINT = "/Ckyc/api/ckyc-status";

	private static getCredentials() {
		return {
			username: process.env.TRUTHSCREEN_USERNAME || "",
			password: process.env.TRUTHSCREEN_PASSWORD || "",
		};
	}

	private static isConfigured(): boolean {
		const { username, password } = TruthscreenAadhaarService.getCredentials();
		return !!(username && password);
	}

	/**
	 * Encrypt payload using AES-256-CBC
	 * Format: base64(ciphertext):base64(iv)
	 */
	private static encrypt(payload: object): string {
		const { password } = TruthscreenAadhaarService.getCredentials();
		const jsonString = JSON.stringify(payload);

		const key = CryptoJS.enc.Utf8.parse(
			password.padEnd(32, "0").substring(0, 32),
		);
		const iv = CryptoJS.lib.WordArray.random(16);

		const encrypted = CryptoJS.AES.encrypt(jsonString, key, {
			iv: iv,
			mode: CryptoJS.mode.CBC,
			padding: CryptoJS.pad.Pkcs7,
		});

		const ciphertextBase64 = encrypted.ciphertext.toString(CryptoJS.enc.Base64);
		const ivBase64 = iv.toString(CryptoJS.enc.Base64);

		return `${ciphertextBase64}:${ivBase64}`;
	}

	/**
	 * Decrypt response using AES-256-CBC
	 * Expected format: base64(ciphertext):base64(iv)
	 */
	private static decrypt(encryptedData: string): any {
		const { password } = TruthscreenAadhaarService.getCredentials();

		const [ciphertextBase64, ivBase64] = encryptedData.split(":");
		if (!ciphertextBase64 || !ivBase64) {
			throw new Error("Invalid encrypted data format");
		}

		const key = CryptoJS.enc.Utf8.parse(
			password.padEnd(32, "0").substring(0, 32),
		);
		const iv = CryptoJS.enc.Base64.parse(ivBase64);
		const ciphertext = CryptoJS.enc.Base64.parse(ciphertextBase64);

		const cipherParams = CryptoJS.lib.CipherParams.create({
			ciphertext: ciphertext,
		});

		const decrypted = CryptoJS.AES.decrypt(cipherParams, key, {
			iv: iv,
			mode: CryptoJS.mode.CBC,
			padding: CryptoJS.pad.Pkcs7,
		});

		const decryptedString = decrypted.toString(CryptoJS.enc.Utf8);
		return JSON.parse(decryptedString);
	}

	private static getHeaders() {
		const { username } = TruthscreenAadhaarService.getCredentials();
		return {
			"Content-Type": "application/json",
			username: username,
		};
	}

	/**
	 * Quick Aadhaar validation (format and checksum)
	 */
	static async validateAadhaar(
		aadhaarNumber: string,
	): Promise<TruthscreenValidationResponse> {
		try {
			if (!/^\d{12}$/.test(aadhaarNumber)) {
				return {
					success: false,
					message: "Invalid Aadhaar number format. Must be 12 digits.",
					valid: false,
				};
			}

			if (!TruthscreenAadhaarService.isConfigured()) {
				console.log("[Truthscreen] Mock mode: validateAadhaar");
				return TruthscreenAadhaarService.mockValidateAadhaar(aadhaarNumber);
			}

			const payload = {
				docType: "AADHAAR_VALIDATE",
				aadhaarNumber: aadhaarNumber,
			};

			const encryptedPayload = TruthscreenAadhaarService.encrypt(payload);

			const response = await axios.post(
				`${TruthscreenAadhaarService.BASE_URL}${TruthscreenAadhaarService.NID_ENDPOINT}`,
				{ requestData: encryptedPayload },
				{ headers: TruthscreenAadhaarService.getHeaders(), timeout: 30000 },
			);

			const decryptedResponse = TruthscreenAadhaarService.decrypt(
				response.data.responseData,
			);
			const maskedAadhaar = `XXXX XXXX ${aadhaarNumber.slice(-4)}`;

			if (decryptedResponse.status === "SUCCESS" || decryptedResponse.valid) {
				return {
					success: true,
					message: "Aadhaar number is valid",
					valid: true,
					maskedAadhaar,
				};
			}

			return {
				success: false,
				message: decryptedResponse.message || "Aadhaar validation failed",
				valid: false,
			};
		} catch (error: any) {
			console.error("[Truthscreen] Aadhaar validation error:", error.message);
			return {
				success: false,
				message: "Failed to validate Aadhaar. Please try again.",
				valid: false,
			};
		}
	}

	/**
	 * Check PAN-Aadhaar linkage status
	 * Uses docType: 544 for PAN-Aadhaar linking endpoint
	 */
	static async checkPanAadhaarLinkage(
		pan: string,
		aadhaar: string,
	): Promise<TruthscreenPanAadhaarResponse> {
		try {
			if (!/^[A-Z]{5}[0-9]{4}[A-Z]{1}$/.test(pan)) {
				return {
					success: false,
					message: "Invalid PAN format",
					linked: false,
				};
			}

			if (!/^\d{12}$/.test(aadhaar)) {
				return {
					success: false,
					message: "Invalid Aadhaar number format",
					linked: false,
				};
			}

			if (!TruthscreenAadhaarService.isConfigured()) {
				console.log("[Truthscreen] Mock mode: checkPanAadhaarLinkage");
				return TruthscreenAadhaarService.mockCheckPanAadhaarLinkage(
					pan,
					aadhaar,
				);
			}

			const payload = {
				docType: 544,
				panNumber: pan.toUpperCase(),
				aadhaarNumber: aadhaar,
			};

			const encryptedPayload = TruthscreenAadhaarService.encrypt(payload);

			const response = await axios.post(
				`${TruthscreenAadhaarService.BASE_URL}${TruthscreenAadhaarService.PAN_AADHAAR_ENDPOINT}`,
				{ requestData: encryptedPayload },
				{ headers: TruthscreenAadhaarService.getHeaders(), timeout: 30000 },
			);

			const decryptedResponse = TruthscreenAadhaarService.decrypt(
				response.data.responseData,
			);

			const linkStatus =
				decryptedResponse.linkStatus || decryptedResponse.status;
			const isLinked =
				linkStatus === "LINKED" || decryptedResponse.linked === true;

			return {
				success: true,
				message: isLinked
					? "PAN and Aadhaar are linked"
					: "PAN and Aadhaar are not linked",
				linked: isLinked,
				linkStatus: linkStatus,
				pan: pan.toUpperCase(),
				aadhaarLastFour: aadhaar.slice(-4),
				linkDate: decryptedResponse.linkDate || undefined,
			};
		} catch (error: any) {
			console.error(
				"[Truthscreen] PAN-Aadhaar linkage check error:",
				error.message,
			);

			if (error.response?.data) {
				try {
					const decryptedError = TruthscreenAadhaarService.decrypt(
						error.response.data.responseData,
					);
					return {
						success: false,
						message:
							decryptedError.message || "Failed to check PAN-Aadhaar linkage",
						linked: false,
					};
				} catch {
					// Decryption failed, use generic error
				}
			}

			return {
				success: false,
				message: "Failed to check PAN-Aadhaar linkage. Please try again.",
				linked: false,
			};
		}
	}

	/**
	 * Generate OTP for Aadhaar eKYC verification
	 * OTP is sent to the mobile number linked with Aadhaar
	 */
	static async generateOTP(
		aadhaarNumber: string,
	): Promise<TruthscreenOTPResponse> {
		try {
			if (!/^\d{12}$/.test(aadhaarNumber)) {
				return {
					success: false,
					message: "Invalid Aadhaar number format. Must be 12 digits.",
				};
			}

			if (!TruthscreenAadhaarService.isConfigured()) {
				console.log("[Truthscreen] Mock mode: generateOTP");
				return TruthscreenAadhaarService.mockGenerateOTP(aadhaarNumber);
			}

			const payload = {
				docType: "AADHAAR_OTP",
				aadhaarNumber: aadhaarNumber,
				consent: "Y",
				consentText: "I hereby authorize eKYC verification",
			};

			const encryptedPayload = TruthscreenAadhaarService.encrypt(payload);

			const response = await axios.post(
				`${TruthscreenAadhaarService.BASE_URL}${TruthscreenAadhaarService.NID_ENDPOINT}`,
				{ requestData: encryptedPayload },
				{ headers: TruthscreenAadhaarService.getHeaders(), timeout: 30000 },
			);

			const decryptedResponse = TruthscreenAadhaarService.decrypt(
				response.data.responseData,
			);

			if (decryptedResponse.status === "SUCCESS" || decryptedResponse.refId) {
				const maskedAadhaar = `XXXX XXXX ${aadhaarNumber.slice(-4)}`;

				return {
					success: true,
					message: `OTP sent successfully to mobile linked with Aadhaar ending ${aadhaarNumber.slice(-4)}`,
					refId: decryptedResponse.refId || decryptedResponse.transactionId,
					status: "OTP_SENT",
					maskedAadhaar,
					transactionId: decryptedResponse.transactionId,
				};
			}

			return {
				success: false,
				message: decryptedResponse.message || "Failed to send OTP",
			};
		} catch (error: any) {
			console.error("[Truthscreen] OTP generation error:", error.message);

			if (error.response?.data) {
				try {
					const decryptedError = TruthscreenAadhaarService.decrypt(
						error.response.data.responseData,
					);
					return {
						success: false,
						message: decryptedError.message || "Failed to generate OTP",
					};
				} catch {
					// Decryption failed
				}
			}

			return {
				success: false,
				message: "Failed to generate OTP. Please try again.",
			};
		}
	}

	/**
	 * Verify OTP and retrieve Aadhaar holder details
	 */
	static async verifyOTP(
		refId: string,
		otp: string,
	): Promise<TruthscreenVerificationResponse> {
		try {
			if (!refId || !otp) {
				return {
					success: false,
					message: "Reference ID and OTP are required",
					verified: false,
				};
			}

			if (!/^\d{6}$/.test(otp)) {
				return {
					success: false,
					message: "Invalid OTP format. Must be 6 digits.",
					verified: false,
				};
			}

			if (!TruthscreenAadhaarService.isConfigured()) {
				console.log("[Truthscreen] Mock mode: verifyOTP");
				return TruthscreenAadhaarService.mockVerifyOTP(refId, otp);
			}

			const payload = {
				docType: "AADHAAR_VERIFY",
				refId: refId,
				otp: otp,
			};

			const encryptedPayload = TruthscreenAadhaarService.encrypt(payload);

			const response = await axios.post(
				`${TruthscreenAadhaarService.BASE_URL}${TruthscreenAadhaarService.NID_ENDPOINT}`,
				{ requestData: encryptedPayload },
				{ headers: TruthscreenAadhaarService.getHeaders(), timeout: 30000 },
			);

			const decryptedResponse = TruthscreenAadhaarService.decrypt(
				response.data.responseData,
			);

			if (decryptedResponse.status === "SUCCESS" && decryptedResponse.data) {
				const aadhaarData = decryptedResponse.data;

				return {
					success: true,
					message: "Aadhaar verified successfully",
					verified: true,
					data: {
						aadhaarNumber: aadhaarData.aadhaarNumber || aadhaarData.uid || "",
						name: aadhaarData.name || aadhaarData.fullName || "",
						dob: aadhaarData.dob || aadhaarData.dateOfBirth || "",
						gender: aadhaarData.gender || "",
						fatherName: aadhaarData.fatherName || aadhaarData.careOf || "",
						address: {
							house: aadhaarData.house || aadhaarData.building || "",
							street: aadhaarData.street || aadhaarData.streetName || "",
							landmark: aadhaarData.landmark || "",
							locality: aadhaarData.locality || aadhaarData.vtcName || "",
							city: aadhaarData.district || aadhaarData.city || "",
							state: aadhaarData.state || "",
							pincode: aadhaarData.pincode || aadhaarData.zip || "",
							country: aadhaarData.country || "India",
						},
						mobile: aadhaarData.mobile || aadhaarData.mobileNumber || "",
						email: aadhaarData.email || "",
						photoBase64: aadhaarData.photo || aadhaarData.profileImage || "",
					},
				};
			}

			return {
				success: false,
				message: decryptedResponse.message || "OTP verification failed",
				verified: false,
			};
		} catch (error: any) {
			console.error("[Truthscreen] OTP verification error:", error.message);

			if (error.response?.data) {
				try {
					const decryptedError = TruthscreenAadhaarService.decrypt(
						error.response.data.responseData,
					);

					if (decryptedError.message?.toLowerCase().includes("otp")) {
						return {
							success: false,
							message: "Invalid OTP. Please check and try again.",
							verified: false,
						};
					}

					if (decryptedError.message?.toLowerCase().includes("expired")) {
						return {
							success: false,
							message: "OTP has expired. Please request a new OTP.",
							verified: false,
						};
					}

					return {
						success: false,
						message: decryptedError.message || "OTP verification failed",
						verified: false,
					};
				} catch {
					// Decryption failed
				}
			}

			return {
				success: false,
				message: "Failed to verify OTP. Please try again.",
				verified: false,
			};
		}
	}

	// Mock methods for development/testing when credentials not configured

	private static mockValidateAadhaar(
		aadhaarNumber: string,
	): TruthscreenValidationResponse {
		const maskedAadhaar = `XXXX XXXX ${aadhaarNumber.slice(-4)}`;

		if (aadhaarNumber.startsWith("000")) {
			return {
				success: false,
				message: "Invalid Aadhaar number",
				valid: false,
			};
		}

		return {
			success: true,
			message: "Aadhaar number is valid (mock)",
			valid: true,
			maskedAadhaar,
		};
	}

	private static mockCheckPanAadhaarLinkage(
		pan: string,
		aadhaar: string,
	): TruthscreenPanAadhaarResponse {
		if (pan.startsWith("ZZZZZ")) {
			return {
				success: true,
				message: "PAN and Aadhaar are not linked (mock)",
				linked: false,
				linkStatus: "NOT_LINKED",
				pan: pan.toUpperCase(),
				aadhaarLastFour: aadhaar.slice(-4),
			};
		}

		return {
			success: true,
			message: "PAN and Aadhaar are linked (mock)",
			linked: true,
			linkStatus: "LINKED",
			pan: pan.toUpperCase(),
			aadhaarLastFour: aadhaar.slice(-4),
			linkDate: new Date().toISOString().split("T")[0],
		};
	}

	private static mockGenerateOTP(
		aadhaarNumber: string,
	): TruthscreenOTPResponse {
		const maskedAadhaar = `XXXX XXXX ${aadhaarNumber.slice(-4)}`;
		const mockRefId = `TS${Date.now()}${Math.random().toString(36).substring(2, 8).toUpperCase()}`;

		return {
			success: true,
			message: `OTP sent successfully (mock mode - use 123456 to verify)`,
			refId: mockRefId,
			status: "OTP_SENT",
			maskedAadhaar,
			transactionId: mockRefId,
		};
	}

	private static mockVerifyOTP(
		refId: string,
		otp: string,
	): TruthscreenVerificationResponse {
		if (otp !== "123456") {
			return {
				success: false,
				message: "Invalid OTP (mock mode - use 123456)",
				verified: false,
			};
		}

		return {
			success: true,
			message: "Aadhaar verified successfully (mock)",
			verified: true,
			data: {
				aadhaarNumber: "************1234",
				name: "Mock Aadhaar Holder",
				dob: "01-01-1990",
				gender: "M",
				fatherName: "Mock Father",
				address: {
					house: "123",
					street: "Mock Street",
					landmark: "Near Mock Plaza",
					locality: "Mock Locality",
					city: "Mumbai",
					state: "Maharashtra",
					pincode: "400001",
					country: "India",
				},
				mobile: "9876543210",
				email: "mock@example.com",
				photoBase64: "",
			},
		};
	}

	/**
	 * Check CKYC/KRA Status for a PAN
	 * Returns KYC validation status from all KRAs (CVL, NDML, Karvy, etc.)
	 */
	static async checkCKYCStatus(
		pan: string,
	): Promise<TruthscreenCKYCStatusResponse> {
		try {
			if (!/^[A-Z]{5}[0-9]{4}[A-Z]{1}$/.test(pan.toUpperCase())) {
				return {
					success: false,
					message: "Invalid PAN format",
					pan: pan.toUpperCase(),
					kraStatus: {
						kycFlag: "",
						digilockerKyc: false,
						eSignFlag: "",
						ipvFlag: "",
						ipvStatus: "",
					},
					kraRecords: [],
					isKycValidated: false,
				};
			}

			if (!TruthscreenAadhaarService.isConfigured()) {
				console.log("[Truthscreen] Mock mode: checkCKYCStatus");
				return TruthscreenAadhaarService.mockCheckCKYCStatus(pan);
			}

			const payload = {
				docType: "CKYC_STATUS",
				panNumber: pan.toUpperCase(),
			};

			const encryptedPayload = TruthscreenAadhaarService.encrypt(payload);

			const response = await axios.post(
				`${TruthscreenAadhaarService.BASE_URL}${TruthscreenAadhaarService.CKYC_ENDPOINT}`,
				{ requestData: encryptedPayload },
				{ headers: TruthscreenAadhaarService.getHeaders(), timeout: 30000 },
			);

			const decryptedResponse = TruthscreenAadhaarService.decrypt(
				response.data.responseData,
			);

			const kraRecords: KRARecord[] = (decryptedResponse.kraRecords || []).map(
				(record: any) => ({
					kra: record.kra || record.kraName || "",
					dateOfUpload: record.dateOfUpload || record.uploadDate || "",
					status: record.status || "",
					statusDescription:
						record.statusDescription || record.statusDesc || "",
					statusDate: record.statusDate || "",
					dateOfModification:
						record.dateOfModification || record.modificationDate || "",
					modifyStatus: record.modifyStatus || "",
					modifyHoldReasons:
						record.modifyHoldReasons || record.holdReasons || "",
				}),
			);

			const validatedRecord = kraRecords.find(
				(r) =>
					r.statusDescription?.toUpperCase().includes("VALIDATED") ||
					r.modifyStatus?.toUpperCase().includes("VALIDATED"),
			);

			const isKycValidated =
				!!validatedRecord ||
				decryptedResponse.kycFlag === "VALIDATED" ||
				decryptedResponse.status === "KYC_VALIDATED";

			return {
				success: true,
				message: isKycValidated ? "KYC is validated" : "KYC status retrieved",
				pan: pan.toUpperCase(),
				ckycApplicationDate:
					decryptedResponse.ckycApplicationDate ||
					decryptedResponse.applicationDate,
				ckycApplicationStatus:
					decryptedResponse.ckycApplicationStatus ||
					decryptedResponse.applicationStatus,
				ckycNumber: decryptedResponse.ckycNumber || decryptedResponse.cKYCId,
				kraStatus: {
					statusDate:
						decryptedResponse.statusDate || decryptedResponse.kraStatusDate,
					kycFlag: decryptedResponse.kycFlag || "",
					digilockerKyc:
						decryptedResponse.digilockerKyc === true ||
						decryptedResponse.digilockerKyc === "Y",
					eSignFlag: decryptedResponse.eSignFlag || "",
					ipvFlag: decryptedResponse.ipvFlag || "",
					ipvStatus: decryptedResponse.ipvStatus || "",
				},
				kraRecords,
				isKycValidated,
				validatedKra: validatedRecord?.kra,
			};
		} catch (error: any) {
			console.error("[Truthscreen] CKYC status check error:", error.message);

			if (error.response?.data) {
				try {
					const decryptedError = TruthscreenAadhaarService.decrypt(
						error.response.data.responseData,
					);
					return {
						success: false,
						message: decryptedError.message || "Failed to check CKYC status",
						pan: pan.toUpperCase(),
						kraStatus: {
							kycFlag: "",
							digilockerKyc: false,
							eSignFlag: "",
							ipvFlag: "",
							ipvStatus: "",
						},
						kraRecords: [],
						isKycValidated: false,
					};
				} catch {
					// Decryption failed
				}
			}

			return {
				success: false,
				message: "Failed to check CKYC status. Please try again.",
				pan: pan.toUpperCase(),
				kraStatus: {
					kycFlag: "",
					digilockerKyc: false,
					eSignFlag: "",
					ipvFlag: "",
					ipvStatus: "",
				},
				kraRecords: [],
				isKycValidated: false,
			};
		}
	}

	private static mockCheckCKYCStatus(
		pan: string,
	): TruthscreenCKYCStatusResponse {
		if (pan.toUpperCase().startsWith("ZZZZZ")) {
			return {
				success: true,
				message: "No KYC records found (mock)",
				pan: pan.toUpperCase(),
				kraStatus: {
					kycFlag: "NOT_FOUND",
					digilockerKyc: false,
					eSignFlag: "",
					ipvFlag: "",
					ipvStatus: "",
				},
				kraRecords: [],
				isKycValidated: false,
			};
		}

		return {
			success: true,
			message: "KYC is validated (mock)",
			pan: pan.toUpperCase(),
			ckycApplicationDate: "08-10-2012",
			ckycApplicationStatus: "SUBMITTED",
			ckycNumber: "CKYC123456789012",
			kraStatus: {
				statusDate: new Date().toISOString().split("T")[0],
				kycFlag: "DIGILOCKER KYC",
				digilockerKyc: true,
				eSignFlag: "COMPLETED",
				ipvFlag: "IPV DONE",
				ipvStatus: "IPV DONE",
			},
			kraRecords: [
				{
					kra: "CVL KRA",
					dateOfUpload: "08-10-2012 09:55:34",
					status: "VALIDATED",
					statusDescription: "KYC VALIDATED WITH CVL KRA",
					statusDate: new Date()
						.toISOString()
						.replace("T", " ")
						.substring(0, 19),
					dateOfModification: new Date()
						.toISOString()
						.replace("T", " ")
						.substring(0, 19),
					modifyStatus: "KYC VALIDATED WITH CVL KRA",
					modifyHoldReasons: "",
				},
			],
			isKycValidated: true,
			validatedKra: "CVL KRA",
		};
	}

	/**
	 * Check if Truthscreen credentials are configured
	 */
	static credentialsConfigured(): boolean {
		return TruthscreenAadhaarService.isConfigured();
	}
}

export type {
	TruthscreenOTPResponse,
	TruthscreenVerificationResponse,
	TruthscreenValidationResponse,
	TruthscreenPanAadhaarResponse,
	TruthscreenCKYCStatusResponse,
	KRARecord,
};
