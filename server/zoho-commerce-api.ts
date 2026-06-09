import fetch from "node-fetch";
import FormData from "form-data";
import qs from "qs";

interface ZohoCommerceConfig {
	clientId: string;
	clientSecret: string;
	redirectUri: string;
	baseUrl: string; // e.g., 'https://commerce.zoho.com' or 'https://commerce.zoho.eu'
	scope: string[];
}

interface ZohoTokenResponse {
	access_token: string;
	refresh_token?: string;
	expires_in: number;
	token_type: string;
	scope: string;
}

interface ZohoProduct {
	id?: string;
	name: string;
	description?: string;
	price: number;
	compare_price?: number;
	sku?: string;
	weight?: number;
	weight_unit?: string;
	track_quantity?: boolean;
	quantity?: number;
	category_id?: string;
	brand?: string;
	tags?: string[];
	images?: ZohoProductImage[];
	variants?: ZohoProductVariant[];
	seo_title?: string;
	seo_description?: string;
	status?: "active" | "inactive" | "draft";
}

interface ZohoProductImage {
	id?: string;
	src: string;
	alt?: string;
	position?: number;
}

interface ZohoProductVariant {
	id?: string;
	sku?: string;
	price: number;
	compare_price?: number;
	quantity?: number;
	weight?: number;
	option1?: string;
	option2?: string;
	option3?: string;
}

interface ZohoOrder {
	id?: string;
	order_number?: string;
	customer_id?: string;
	customer_email?: string;
	billing_address?: ZohoAddress;
	shipping_address?: ZohoAddress;
	line_items?: ZohoLineItem[];
	subtotal?: number;
	total_tax?: number;
	total_price?: number;
	currency?: string;
	order_status?: string;
	payment_status?: string;
	fulfillment_status?: string;
	created_date?: string;
	updated_date?: string;
	notes?: string;
}

interface ZohoAddress {
	first_name?: string;
	last_name?: string;
	company?: string;
	address1?: string;
	address2?: string;
	city?: string;
	province?: string;
	zip?: string;
	country?: string;
	phone?: string;
}

interface ZohoLineItem {
	product_id?: string;
	variant_id?: string;
	title?: string;
	quantity: number;
	price: number;
	total?: number;
	sku?: string;
}

interface ZohoCategory {
	id?: string;
	name: string;
	description?: string;
	parent_id?: string;
	sort_order?: number;
	is_active?: boolean;
	seo_title?: string;
	seo_description?: string;
	image?: ZohoProductImage;
}

export class ZohoCommerceAPI {
	private config: ZohoCommerceConfig;
	private accessToken?: string;
	private refreshToken?: string;
	private tokenExpiry?: number;

	constructor(config: ZohoCommerceConfig) {
		this.config = config;
	}

	/**
	 * Step 1: Get authorization URL for OAuth flow
	 */
	getAuthorizationUrl(state?: string): string {
		const params = new URLSearchParams({
			response_type: "code",
			client_id: this.config.clientId,
			scope: this.config.scope.join(" "),
			redirect_uri: this.config.redirectUri,
			access_type: "offline",
			...(state && { state }),
		});

		return `https://accounts.zoho.com/oauth/v2/auth?${params.toString()}`;
	}

	/**
	 * Step 2: Exchange authorization code for access token
	 */
	async exchangeCodeForToken(code: string): Promise<ZohoTokenResponse> {
		const formData = new FormData();
		formData.append("grant_type", "authorization_code");
		formData.append("code", code);
		formData.append("client_id", this.config.clientId);
		formData.append("client_secret", this.config.clientSecret);
		formData.append("redirect_uri", this.config.redirectUri);

		const response = await fetch("https://accounts.zoho.com/oauth/v2/token", {
			method: "POST",
			body: formData,
		});

		if (!response.ok) {
			throw new Error(`Token exchange failed: ${response.statusText}`);
		}

		const tokenData = (await response.json()) as ZohoTokenResponse;

		this.accessToken = tokenData.access_token;
		this.refreshToken = tokenData.refresh_token;
		this.tokenExpiry = Date.now() + tokenData.expires_in * 1000;

		return tokenData;
	}

	/**
	 * Step 3: Refresh access token using refresh token
	 */
	async refreshAccessToken(): Promise<ZohoTokenResponse> {
		if (!this.refreshToken) {
			throw new Error("No refresh token available");
		}

		const formData = new FormData();
		formData.append("grant_type", "refresh_token");
		formData.append("refresh_token", this.refreshToken);
		formData.append("client_id", this.config.clientId);
		formData.append("client_secret", this.config.clientSecret);

		const response = await fetch("https://accounts.zoho.com/oauth/v2/token", {
			method: "POST",
			body: formData,
		});

		if (!response.ok) {
			throw new Error(`Token refresh failed: ${response.statusText}`);
		}

		const tokenData = (await response.json()) as ZohoTokenResponse;

		this.accessToken = tokenData.access_token;
		this.tokenExpiry = Date.now() + tokenData.expires_in * 1000;

		return tokenData;
	}

	/**
	 * Ensure we have a valid access token
	 */
	private async ensureValidToken(): Promise<void> {
		if (
			!this.accessToken ||
			(this.tokenExpiry && Date.now() >= this.tokenExpiry)
		) {
			if (this.refreshToken) {
				await this.refreshAccessToken();
			} else {
				throw new Error("No valid access token and no refresh token available");
			}
		}
	}

	/**
	 * Make authenticated API request
	 */
	private async makeRequest(endpoint: string, options: any = {}): Promise<any> {
		await this.ensureValidToken();

		const url = `${this.config.baseUrl}/api/v1${endpoint}`;
		const headers = {
			Authorization: `Zoho-oauthtoken ${this.accessToken}`,
			"Content-Type": "application/json",
			Accept: "application/json",
			...options.headers,
		};

		const response = await fetch(url, {
			...options,
			headers,
		});

		if (!response.ok) {
			const errorText = await response.text();
			throw new Error(
				`Zoho Commerce API error: ${response.status} - ${errorText}`,
			);
		}

		return response.json();
	}

	// =====================
	// PRODUCT MANAGEMENT
	// =====================

	/**
	 * Get all products with pagination
	 */
	async getProducts(page = 1, limit = 50, filters?: any): Promise<any> {
		const queryParams = new URLSearchParams({
			page: page.toString(),
			limit: limit.toString(),
			...filters,
		});

		return this.makeRequest(`/products?${queryParams}`);
	}

	/**
	 * Get product by ID
	 */
	async getProduct(productId: string): Promise<any> {
		return this.makeRequest(`/products/${productId}`);
	}

	/**
	 * Create a new product
	 */
	async createProduct(product: ZohoProduct): Promise<any> {
		return this.makeRequest("/products", {
			method: "POST",
			body: JSON.stringify(product),
		});
	}

	/**
	 * Update existing product
	 */
	async updateProduct(
		productId: string,
		updates: Partial<ZohoProduct>,
	): Promise<any> {
		return this.makeRequest(`/products/${productId}`, {
			method: "PUT",
			body: JSON.stringify(updates),
		});
	}

	/**
	 * Delete product
	 */
	async deleteProduct(productId: string): Promise<any> {
		return this.makeRequest(`/products/${productId}`, {
			method: "DELETE",
		});
	}

	/**
	 * Bulk delete products
	 */
	async deleteProducts(productIds: string[]): Promise<any> {
		return this.makeRequest("/products/bulk-delete", {
			method: "POST",
			body: JSON.stringify({ product_ids: productIds }),
		});
	}

	// =====================
	// CATEGORY MANAGEMENT
	// =====================

	/**
	 * Get all categories
	 */
	async getCategories(): Promise<any> {
		return this.makeRequest("/categories");
	}

	/**
	 * Get category by ID
	 */
	async getCategory(categoryId: string): Promise<any> {
		return this.makeRequest(`/categories/${categoryId}`);
	}

	/**
	 * Create a new category
	 */
	async createCategory(category: ZohoCategory): Promise<any> {
		return this.makeRequest("/categories", {
			method: "POST",
			body: JSON.stringify(category),
		});
	}

	/**
	 * Update existing category
	 */
	async updateCategory(
		categoryId: string,
		updates: Partial<ZohoCategory>,
	): Promise<any> {
		return this.makeRequest(`/categories/${categoryId}`, {
			method: "PUT",
			body: JSON.stringify(updates),
		});
	}

	/**
	 * Delete category
	 */
	async deleteCategory(categoryId: string): Promise<any> {
		return this.makeRequest(`/categories/${categoryId}`, {
			method: "DELETE",
		});
	}

	// =====================
	// ORDER MANAGEMENT
	// =====================

	/**
	 * Get all orders with pagination and filters
	 */
	async getOrders(page = 1, limit = 50, filters?: any): Promise<any> {
		const queryParams = new URLSearchParams({
			page: page.toString(),
			limit: limit.toString(),
			...filters,
		});

		return this.makeRequest(`/orders?${queryParams}`);
	}

	/**
	 * Get order by ID
	 */
	async getOrder(orderId: string): Promise<any> {
		return this.makeRequest(`/orders/${orderId}`);
	}

	/**
	 * Update order status
	 */
	async updateOrderStatus(orderId: string, status: string): Promise<any> {
		return this.makeRequest(`/orders/${orderId}/status`, {
			method: "PUT",
			body: JSON.stringify({ status }),
		});
	}

	/**
	 * Add comments to order
	 */
	async addOrderComment(orderId: string, comment: string): Promise<any> {
		return this.makeRequest(`/orders/${orderId}/comments`, {
			method: "POST",
			body: JSON.stringify({ comment }),
		});
	}

	// =====================
	// INVENTORY MANAGEMENT
	// =====================

	/**
	 * Update product inventory/stock
	 */
	async updateInventory(
		productId: string,
		variantId: string,
		quantity: number,
	): Promise<any> {
		return this.makeRequest(
			`/products/${productId}/variants/${variantId}/inventory`,
			{
				method: "PUT",
				body: JSON.stringify({ quantity }),
			},
		);
	}

	/**
	 * Bulk update inventory
	 */
	async bulkUpdateInventory(
		updates: Array<{ productId: string; variantId: string; quantity: number }>,
	): Promise<any> {
		return this.makeRequest("/inventory/bulk-update", {
			method: "POST",
			body: JSON.stringify({ updates }),
		});
	}

	// =====================
	// PAYMENT MANAGEMENT
	// =====================

	/**
	 * Get payment details for order
	 */
	async getOrderPayments(orderId: string): Promise<any> {
		return this.makeRequest(`/orders/${orderId}/payments`);
	}

	/**
	 * Mark order as paid
	 */
	async markOrderAsPaid(orderId: string, paymentDetails: any): Promise<any> {
		return this.makeRequest(`/orders/${orderId}/payments`, {
			method: "POST",
			body: JSON.stringify(paymentDetails),
		});
	}

	/**
	 * Process refund
	 */
	async processRefund(
		orderId: string,
		refundAmount: number,
		reason?: string,
	): Promise<any> {
		return this.makeRequest(`/orders/${orderId}/refunds`, {
			method: "POST",
			body: JSON.stringify({
				amount: refundAmount,
				reason: reason || "Refund requested",
			}),
		});
	}

	// =====================
	// COUPON MANAGEMENT
	// =====================

	/**
	 * Get all coupons
	 */
	async getCoupons(): Promise<any> {
		return this.makeRequest("/coupons");
	}

	/**
	 * Create coupon
	 */
	async createCoupon(coupon: any): Promise<any> {
		return this.makeRequest("/coupons", {
			method: "POST",
			body: JSON.stringify(coupon),
		});
	}

	/**
	 * Update coupon
	 */
	async updateCoupon(couponId: string, updates: any): Promise<any> {
		return this.makeRequest(`/coupons/${couponId}`, {
			method: "PUT",
			body: JSON.stringify(updates),
		});
	}

	/**
	 * Delete coupon
	 */
	async deleteCoupon(couponId: string): Promise<any> {
		return this.makeRequest(`/coupons/${couponId}`, {
			method: "DELETE",
		});
	}

	// =====================
	// WEBHOOK MANAGEMENT
	// =====================

	/**
	 * Create webhook
	 */
	async createWebhook(webhookData: any): Promise<any> {
		return this.makeRequest("/webhooks", {
			method: "POST",
			body: JSON.stringify(webhookData),
		});
	}

	/**
	 * Get all webhooks
	 */
	async getWebhooks(): Promise<any> {
		return this.makeRequest("/webhooks");
	}

	// =====================
	// CUSTOMER MANAGEMENT
	// =====================

	/**
	 * Get all customers
	 */
	async getCustomers(page = 1, limit = 50): Promise<any> {
		const queryParams = new URLSearchParams({
			page: page.toString(),
			limit: limit.toString(),
		});

		return this.makeRequest(`/customers?${queryParams}`);
	}

	/**
	 * Get customer by ID
	 */
	async getCustomer(customerId: string): Promise<any> {
		return this.makeRequest(`/customers/${customerId}`);
	}

	/**
	 * Get customer orders
	 */
	async getCustomerOrders(customerId: string): Promise<any> {
		return this.makeRequest(`/customers/${customerId}/orders`);
	}

	// =====================
	// STORE MANAGEMENT
	// =====================

	/**
	 * Get store information
	 */
	async getStoreInfo(): Promise<any> {
		return this.makeRequest("/store");
	}

	/**
	 * Update store settings
	 */
	async updateStoreSettings(settings: any): Promise<any> {
		return this.makeRequest("/store", {
			method: "PUT",
			body: JSON.stringify(settings),
		});
	}

	// =====================
	// ANALYTICS & REPORTS
	// =====================

	/**
	 * Get sales analytics
	 */
	async getSalesAnalytics(startDate: string, endDate: string): Promise<any> {
		const queryParams = new URLSearchParams({
			start_date: startDate,
			end_date: endDate,
		});

		return this.makeRequest(`/analytics/sales?${queryParams}`);
	}

	/**
	 * Get product performance
	 */
	async getProductAnalytics(productId?: string): Promise<any> {
		const endpoint = productId
			? `/analytics/products/${productId}`
			: "/analytics/products";
		return this.makeRequest(endpoint);
	}

	// =====================
	// UTILITY METHODS
	// =====================

	/**
	 * Set tokens manually (for existing integrations)
	 */
	setTokens(
		accessToken: string,
		refreshToken?: string,
		expiresIn?: number,
	): void {
		this.accessToken = accessToken;
		if (refreshToken) this.refreshToken = refreshToken;
		if (expiresIn) this.tokenExpiry = Date.now() + expiresIn * 1000;
	}

	/**
	 * Get current tokens (for storage)
	 */
	getTokens(): {
		accessToken?: string;
		refreshToken?: string;
		tokenExpiry?: number;
	} {
		return {
			accessToken: this.accessToken,
			refreshToken: this.refreshToken,
			tokenExpiry: this.tokenExpiry,
		};
	}

	/**
	 * Test API connection
	 */
	async testConnection(): Promise<boolean> {
		try {
			await this.getStoreInfo();
			return true;
		} catch (error) {
			return false;
		}
	}
}

// Export configuration interface for use in other files
export type { ZohoCommerceConfig, ZohoProduct, ZohoOrder, ZohoCategory };
