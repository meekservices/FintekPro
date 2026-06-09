/**
 * DSC Token Bridge
 *
 * Client-side bridge for Digital Signature Certificate (DSC) token operations
 * Handles token detection, certificate reading, PIN entry, and signing
 *
 * Note: In production, this would integrate with actual DSC middleware like:
 * - eMudhra emSign
 * - Sify TokenSign
 * - (n)Code DSC Signer
 *
 * Currently implements a mock mode for development/testing
 */

export interface DSCCertificateInfo {
	serialNumber: string;
	subject: {
		commonName: string;
		organization?: string;
		organizationalUnit?: string;
		country?: string;
		state?: string;
		locality?: string;
		email?: string;
	};
	issuer: {
		commonName: string;
		organization?: string;
		country?: string;
	};
	validFrom: Date;
	validTo: Date;
	certificateClass: "Class1" | "Class2" | "Class3";
	certificateType: "Signing" | "Encryption" | "Both";
	keyUsage: string[];
	fingerprint: {
		sha256: string;
		sha1: string;
	};
	publicKey: string;
}

export interface DSCTokenInfo {
	connected: boolean;
	deviceName: string;
	manufacturer: string;
	serialNumber: string;
	certificates: DSCCertificateInfo[];
}

export interface DSCSignResult {
	success: boolean;
	signature?: string;
	signatureAlgorithm?:
		| "SHA256withRSA"
		| "SHA384withRSA"
		| "SHA512withRSA"
		| "SHA256withECDSA";
	signedAt?: Date;
	error?: string;
}

export type DSCTokenStatus =
	| "not_detected"
	| "connected"
	| "pin_required"
	| "authenticated"
	| "error";

class DSCBridge {
	private status: DSCTokenStatus = "not_detected";
	private tokenInfo: DSCTokenInfo | null = null;
	private selectedCertificate: DSCCertificateInfo | null = null;
	private websocket: WebSocket | null = null;
	private middlewarePort: number = 23452;
	private isMockMode: boolean = true;

	private listeners: Map<string, Set<Function>> = new Map();

	constructor() {
		this.checkMiddleware();
	}

	private async checkMiddleware(): Promise<void> {
		try {
			const response = await fetch(
				`http://localhost:${this.middlewarePort}/status`,
				{
					method: "GET",
					signal: AbortSignal.timeout(2000),
				},
			);

			if (response.ok) {
				this.isMockMode = false;
				this.connectWebSocket();
			}
		} catch {
			console.log("[DSC Bridge] Middleware not detected, using mock mode");
			this.isMockMode = true;
		}
	}

	private connectWebSocket(): void {
		if (this.isMockMode) return;

		try {
			this.websocket = new WebSocket(
				`ws://localhost:${this.middlewarePort}/dsc`,
			);

			this.websocket.onopen = () => {
				console.log("[DSC Bridge] Connected to DSC middleware");
				this.sendCommand("detect_token");
			};

			this.websocket.onmessage = (event) => {
				this.handleMiddlewareMessage(JSON.parse(event.data));
			};

			this.websocket.onerror = (error) => {
				console.error("[DSC Bridge] WebSocket error:", error);
				this.status = "error";
				this.emit("status_change", this.status);
			};

			this.websocket.onclose = () => {
				console.log("[DSC Bridge] WebSocket closed");
				this.status = "not_detected";
				this.emit("status_change", this.status);
			};
		} catch (error) {
			console.error("[DSC Bridge] Failed to connect to middleware:", error);
		}
	}

	private handleMiddlewareMessage(message: any): void {
		switch (message.type) {
			case "token_detected":
				this.tokenInfo = message.data;
				this.status = "connected";
				this.emit("token_detected", this.tokenInfo);
				this.emit("status_change", this.status);
				break;

			case "token_removed":
				this.tokenInfo = null;
				this.selectedCertificate = null;
				this.status = "not_detected";
				this.emit("token_removed");
				this.emit("status_change", this.status);
				break;

			case "pin_required":
				this.status = "pin_required";
				this.emit("pin_required");
				this.emit("status_change", this.status);
				break;

			case "authenticated":
				this.status = "authenticated";
				this.emit("authenticated");
				this.emit("status_change", this.status);
				break;

			case "certificates":
				if (this.tokenInfo) {
					this.tokenInfo.certificates = message.data;
					this.emit("certificates_loaded", message.data);
				}
				break;

			case "signature_complete":
				this.emit("signature_complete", message.data);
				break;

			case "error":
				this.emit("error", message.error);
				break;
		}
	}

	private sendCommand(command: string, data?: any): void {
		if (this.websocket && this.websocket.readyState === WebSocket.OPEN) {
			this.websocket.send(JSON.stringify({ command, data }));
		}
	}

	on(event: string, callback: Function): void {
		if (!this.listeners.has(event)) {
			this.listeners.set(event, new Set());
		}
		this.listeners.get(event)!.add(callback);
	}

	off(event: string, callback: Function): void {
		this.listeners.get(event)?.delete(callback);
	}

	private emit(event: string, data?: any): void {
		this.listeners.get(event)?.forEach((callback) => callback(data));
	}

	getStatus(): DSCTokenStatus {
		return this.status;
	}

	getTokenInfo(): DSCTokenInfo | null {
		return this.tokenInfo;
	}

	getSelectedCertificate(): DSCCertificateInfo | null {
		return this.selectedCertificate;
	}

	isInMockMode(): boolean {
		return this.isMockMode;
	}

	async detectToken(): Promise<DSCTokenInfo | null> {
		if (this.isMockMode) {
			await new Promise((resolve) => setTimeout(resolve, 500));

			const mockToken: DSCTokenInfo = {
				connected: true,
				deviceName: "Mock DSC Token",
				manufacturer: "eMudhra",
				serialNumber: "MOCK-TOKEN-001",
				certificates: [
					{
						serialNumber: "MOCK-CERT-CLASS3-001",
						subject: {
							commonName: "Test User",
							organization: "Test Organization",
							organizationalUnit: "IT Department",
							country: "IN",
							state: "Karnataka",
							locality: "Bangalore",
							email: "test@example.com",
						},
						issuer: {
							commonName: "eMudhra CA",
							organization: "eMudhra Limited",
							country: "IN",
						},
						validFrom: new Date(Date.now() - 180 * 24 * 60 * 60 * 1000),
						validTo: new Date(Date.now() + 180 * 24 * 60 * 60 * 1000),
						certificateClass: "Class3",
						certificateType: "Signing",
						keyUsage: ["digitalSignature", "nonRepudiation"],
						fingerprint: {
							sha256: "a".repeat(64),
							sha1: "b".repeat(40),
						},
						publicKey: "MOCK_PUBLIC_KEY_BASE64",
					},
				],
			};

			this.tokenInfo = mockToken;
			this.status = "connected";
			this.emit("token_detected", mockToken);
			this.emit("status_change", this.status);

			return mockToken;
		}

		return new Promise((resolve) => {
			this.sendCommand("detect_token");

			const handler = (info: DSCTokenInfo) => {
				this.off("token_detected", handler);
				resolve(info);
			};

			this.on("token_detected", handler);

			setTimeout(() => {
				this.off("token_detected", handler);
				resolve(null);
			}, 5000);
		});
	}

	async enterPin(pin: string): Promise<boolean> {
		if (pin.length < 4 || pin.length > 8) {
			this.emit("error", "PIN must be 4-8 characters");
			return false;
		}

		if (this.isMockMode) {
			await new Promise((resolve) => setTimeout(resolve, 800));

			if (pin === "1234" || pin.length >= 4) {
				this.status = "authenticated";
				this.emit("authenticated");
				this.emit("status_change", this.status);
				return true;
			}
			this.emit("error", "Invalid PIN");
			return false;
		}

		return new Promise((resolve) => {
			this.sendCommand("enter_pin", { pin });

			const authHandler = () => {
				this.off("authenticated", authHandler);
				this.off("error", errorHandler);
				resolve(true);
			};

			const errorHandler = (error: string) => {
				this.off("authenticated", authHandler);
				this.off("error", errorHandler);
				resolve(false);
			};

			this.on("authenticated", authHandler);
			this.on("error", errorHandler);
		});
	}

	selectCertificate(certificate: DSCCertificateInfo): void {
		this.selectedCertificate = certificate;
		this.emit("certificate_selected", certificate);
	}

	async signData(
		dataToSign: string,
		algorithm:
			| "SHA256withRSA"
			| "SHA384withRSA"
			| "SHA512withRSA"
			| "SHA256withECDSA" = "SHA256withRSA",
	): Promise<DSCSignResult> {
		if (!this.selectedCertificate) {
			return { success: false, error: "No certificate selected" };
		}

		if (this.status !== "authenticated") {
			return {
				success: false,
				error: "Token not authenticated. Please enter PIN.",
			};
		}

		if (this.isMockMode) {
			await new Promise((resolve) => setTimeout(resolve, 1000));

			const mockSignature = btoa(
				`MOCK_SIGNATURE_${dataToSign.substring(0, 10)}_${this.selectedCertificate.serialNumber}_${Date.now()}`,
			);

			return {
				success: true,
				signature: mockSignature,
				signatureAlgorithm: algorithm,
				signedAt: new Date(),
			};
		}

		return new Promise((resolve) => {
			this.sendCommand("sign", {
				data: dataToSign,
				algorithm,
				certificateSerial: this.selectedCertificate!.serialNumber,
			});

			const signatureHandler = (result: DSCSignResult) => {
				this.off("signature_complete", signatureHandler);
				this.off("error", errorHandler);
				resolve(result);
			};

			const errorHandler = (error: string) => {
				this.off("signature_complete", signatureHandler);
				this.off("error", errorHandler);
				resolve({ success: false, error });
			};

			this.on("signature_complete", signatureHandler);
			this.on("error", errorHandler);

			setTimeout(() => {
				this.off("signature_complete", signatureHandler);
				this.off("error", errorHandler);
				resolve({ success: false, error: "Signing timeout" });
			}, 30000);
		});
	}

	disconnect(): void {
		if (this.websocket) {
			this.websocket.close();
			this.websocket = null;
		}
		this.tokenInfo = null;
		this.selectedCertificate = null;
		this.status = "not_detected";
		this.emit("status_change", this.status);
	}

	getCertificateDisplayInfo(cert: DSCCertificateInfo): {
		name: string;
		organization: string;
		issuer: string;
		validUntil: string;
		daysRemaining: number;
		classLabel: string;
		isExpired: boolean;
		isExpiringSoon: boolean;
	} {
		const now = new Date();
		const validTo = new Date(cert.validTo);
		const daysRemaining = Math.floor(
			(validTo.getTime() - now.getTime()) / (1000 * 60 * 60 * 24),
		);
		const isExpired = daysRemaining < 0;
		const isExpiringSoon = daysRemaining >= 0 && daysRemaining < 30;

		return {
			name: cert.subject.commonName,
			organization: cert.subject.organization || "N/A",
			issuer: cert.issuer.commonName,
			validUntil: validTo.toLocaleDateString("en-IN", {
				day: "2-digit",
				month: "short",
				year: "numeric",
			}),
			daysRemaining,
			classLabel: cert.certificateClass.replace("Class", "Class "),
			isExpired,
			isExpiringSoon,
		};
	}
}

export const dscBridge = new DSCBridge();
export default dscBridge;
