/**
 * IP-based geolocation utility
 * Uses ipapi.co free service to detect user's country
 */

interface GeolocationResponse {
	country_code: string;
	country_name: string;
}

/**
 * Detect user's country based on their IP address
 * Returns ISO 3166-1 alpha-2 country code (e.g., "IN", "US", "GB")
 */
export async function detectCountryFromIP(): Promise<string | null> {
	try {
		const response = await fetch("https://ipapi.co/json/", {
			method: "GET",
			headers: {
				Accept: "application/json",
			},
		});

		if (!response.ok) {
			console.warn("IP geolocation request failed:", response.statusText);
			return null;
		}

		const data: GeolocationResponse = await response.json();
		return data.country_code || null;
	} catch (error) {
		console.warn("Failed to detect country from IP:", error);
		return null;
	}
}

/**
 * Get country calling code from country ISO code
 */
export function getCallingCodeFromCountry(countryCode: string): string {
	const countryToCallingCode: Record<string, string> = {
		IN: "+91", // India
		US: "+1", // United States
		CA: "+1", // Canada
		GB: "+44", // United Kingdom
		AU: "+61", // Australia
		NZ: "+64", // New Zealand
		SG: "+65", // Singapore
		AE: "+971", // United Arab Emirates
		SA: "+966", // Saudi Arabia
		ZA: "+27", // South Africa
		DE: "+49", // Germany
		FR: "+33", // France
		IT: "+39", // Italy
		ES: "+34", // Spain
		BR: "+55", // Brazil
		MX: "+52", // Mexico
		AR: "+54", // Argentina
		JP: "+81", // Japan
		CN: "+86", // China
		KR: "+82", // South Korea
		MY: "+60", // Malaysia
		TH: "+66", // Thailand
		ID: "+62", // Indonesia
		PH: "+63", // Philippines
		VN: "+84", // Vietnam
		PK: "+92", // Pakistan
		BD: "+880", // Bangladesh
		LK: "+94", // Sri Lanka
		NP: "+977", // Nepal
	};

	return countryToCallingCode[countryCode] || "+91"; // Default to India
}
