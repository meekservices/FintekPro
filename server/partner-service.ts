import { randomUUID } from "crypto";
import { storage } from "./storage";
import {
	type Partner,
	type Product,
	type SupportTicket,
	type TicketMessage,
	type ProductApplication,
	type InsertPartner,
	type InsertProduct,
	type InsertSupportTicket,
	type InsertTicketMessage,
} from "@shared/schema";

export interface PartnerStats {
	totalProducts: number;
	activeProducts: number;
	totalTickets: number;
	openTickets: number;
	applications: number;
	pendingApplications: number;
	revenue: number;
	commission: number;
}

export interface ProductMetrics {
	views: number;
	applications: number;
	approvals: number;
	conversionRate: number;
	revenue: number;
}

class PartnerService {
	private partners: Map<string, Partner> = new Map();
	private partnersByEmail: Map<string, Partner> = new Map();
	private products: Map<string, Product> = new Map();
	private supportTickets: Map<string, SupportTicket> = new Map();
	private ticketMessages: Map<string, TicketMessage[]> = new Map();
	private productApplications: Map<string, ProductApplication> = new Map();
	private ticketCounter = 1000;

	constructor() {
		this.initializeDemoData();
	}

	private initializeDemoData() {
		// Create demo partner
		const demoPartner: Partner = {
			id: "central-test-user",
			companyName: "FinTech Solutions Ltd",
			contactEmail: process.env.SUPPORT_EMAIL || "support@fintekpro.com",
			contactPhone: "+91-9876543210",
			address: "123 Business Park, Mumbai, Maharashtra",
			website: "https://fintech-solutions.com",
			password: "partner123",
			isActive: true,
			isVerified: true,
			partnerType: "both",
			permissions: {
				canManageProducts: true,
				canViewAnalytics: true,
				canHandleSupport: true,
				canAccessReports: true,
			},
			businessLicense: "MH-BL-2024-001",
			taxId: "27AABCD1234E1Z5",
			commissionRate: "2.50",
			createdAt: new Date(),
			updatedAt: new Date(),
		} as any;

		this.partners.set(demoPartner.id, demoPartner);
		this.partnersByEmail.set(demoPartner.contactEmail, demoPartner);

		// Create demo products
		const demoProducts: any[] = [
			{
				id: "product-mf-001",
				partnerId: "central-test-user",
				name: "Growth Plus Mutual Fund",
				description:
					"A diversified equity fund focusing on high-growth companies",
				category: "mutual_fund",
				subCategory: "large_cap",
				basePrice: null,
				interestRate: null,
				features: {
					expenseRatio: 1.2,
					aum: "15000 crores",
					riskLevel: "moderate",
					minInvestment: 500,
					sipAvailable: true,
				},
				eligibilityCriteria: {
					minAge: 18,
					maxAge: 65,
					minIncome: 25000,
					documents: ["PAN", "KYC", "Bank Statement"],
				},
				documents: ["Application Form", "KYC Documents", "Bank Proof"],
				status: "active",
				isPublic: true,
				priority: 1,
				slug: "growth-plus-mutual-fund",
				tags: ["equity", "growth", "sip"],
				imageUrl: "/assets/products/mutual-fund-growth.jpg",
				createdAt: new Date(),
				updatedAt: new Date(),
			},
			{
				id: "product-loan-001",
				partnerId: "central-test-user",
				name: "Quick Personal Loan",
				description: "Instant personal loans with minimal documentation",
				category: "loan",
				subCategory: "personal",
				basePrice: null,
				interestRate: "12.50",
				features: {
					maxAmount: 500000,
					tenure: "12-60 months",
					processingFee: "1.5%",
					prepayment: "allowed after 6 months",
					disbursal: "within 24 hours",
				},
				eligibilityCriteria: {
					minAge: 21,
					maxAge: 60,
					minIncome: 30000,
					employmentType: ["salaried", "self_employed"],
					documents: ["Salary Slips", "Bank Statement", "ID Proof"],
				},
				documents: ["Application Form", "Income Proof", "ID & Address Proof"],
				status: "active",
				isPublic: true,
				priority: 2,
				slug: "quick-personal-loan",
				tags: ["loan", "personal", "instant"],
				imageUrl: "/assets/products/personal-loan.jpg",
				createdAt: new Date(),
				updatedAt: new Date(),
			},
		];

		(demoProducts as any[]).forEach((product) => {
			this.products.set(product.id, product);
		});

		// Create demo support tickets
		const demoTickets: SupportTicket[] = [
			{
				id: "ticket-001",
				ticketNumber: "TKT-001001",
				userId: "central-test-user",
				clientName: "John Doe",
				clientEmail: "john.doe@email.com",
				clientPhone: "+91-9876543210",
				subject: "Mutual Fund Investment Query",
				description:
					"I want to know about the minimum investment amount for Growth Plus fund",
				category: "product_inquiry",
				priority: "medium",
				status: "open",
				assignedTo: "central-test-user",
				assignedBy: null,
				resolution: null,
				resolvedAt: null,
				source: "web",
				attachments: [],
				tags: ["mutual_fund", "investment"],
				createdAt: new Date(),
				updatedAt: new Date(),
			},
			{
				id: "ticket-002",
				ticketNumber: "TKT-001002",
				userId: "central-test-user",
				clientName: "Jane Smith",
				clientEmail: "jane.smith@email.com",
				clientPhone: "+91-9876543211",
				subject: "Loan Application Status",
				description:
					"My loan application is pending for review for 5 days. Please provide update.",
				category: "billing",
				priority: "high",
				status: "in_progress",
				assignedTo: "central-test-user",
				assignedBy: null,
				resolution: null,
				resolvedAt: null,
				source: "web",
				attachments: [],
				tags: ["loan", "application", "status"],
				createdAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000), // 2 days ago
				updatedAt: new Date(),
			},
		];

		demoTickets.forEach((ticket) => {
			this.supportTickets.set(ticket.id, ticket);
			this.ticketMessages.set(ticket.id, []);
		});
	}

	// Partner Authentication
	async authenticatePartner(
		email: string,
		password: string,
	): Promise<Partner | null> {
		const partner = this.partnersByEmail.get(email);
		if (!partner || partner.password !== password || !partner.isActive) {
			return null;
		}
		return partner;
	}

	async getPartner(id: string): Promise<Partner | undefined> {
		return this.partners.get(id);
	}

	async createPartner(partnerData: InsertPartner): Promise<Partner> {
		const id = randomUUID() as string;
		const partner: Partner = {
			...partnerData,
			id,
			createdAt: new Date(),
			updatedAt: new Date(),
		} as Partner;

		this.partners.set(id, partner);
		this.partnersByEmail.set(partner.contactEmail, partner);
		return partner;
	}

	async updatePartner(
		id: string,
		updates: Partial<Partner>,
	): Promise<Partner | undefined> {
		const partner = this.partners.get(id);
		if (partner) {
			const updatedPartner = { ...partner, ...updates, updatedAt: new Date() };
			this.partners.set(id, updatedPartner);

			// Update email lookup if changed
			if (
				updates.contactEmail &&
				updates.contactEmail !== partner.contactEmail
			) {
				this.partnersByEmail.delete(partner.contactEmail);
				this.partnersByEmail.set(updates.contactEmail, updatedPartner);
			}

			return updatedPartner;
		}
		return undefined;
	}

	// Product Management
	async getProductsByPartner(partnerId: string): Promise<Product[]> {
		return Array.from(this.products.values()).filter(
			(product) => product.partnerId === partnerId,
		);
	}

	async getProduct(id: string): Promise<Product | undefined> {
		return this.products.get(id);
	}

	async createProduct(productData: InsertProduct): Promise<Product> {
		const id = randomUUID() as string;
		const product: Product = {
			...productData,
			id,
			createdAt: new Date(),
			updatedAt: new Date(),
		} as Product;

		this.products.set(id, product);
		return product;
	}

	async updateProduct(
		id: string,
		updates: Partial<Product>,
	): Promise<Product | undefined> {
		const product = this.products.get(id);
		if (product) {
			const updatedProduct = { ...product, ...updates, updatedAt: new Date() };
			this.products.set(id, updatedProduct);
			return updatedProduct;
		}
		return undefined;
	}

	async deleteProduct(id: string): Promise<boolean> {
		return this.products.delete(id);
	}

	// Support Ticket Management
	async getTicketsByPartner(partnerId: string): Promise<SupportTicket[]> {
		return Array.from(this.supportTickets.values()).filter(
			(ticket) => ticket.assignedTo === partnerId,
		);
	}

	async getTicket(id: string): Promise<SupportTicket | undefined> {
		return this.supportTickets.get(id);
	}

	async createSupportTicket(
		ticketData: InsertSupportTicket,
	): Promise<SupportTicket> {
		const id = randomUUID();
		const ticketNumber = `TKT-${String(this.ticketCounter++).padStart(6, "0")}`;

		const ticket: SupportTicket = {
			...ticketData,
			id,
			ticketNumber,
			createdAt: new Date(),
			updatedAt: new Date(),
		} as any;

		this.supportTickets.set(id, ticket);
		this.ticketMessages.set(id, []);
		return ticket;
	}

	async updateTicket(
		id: string,
		updates: Partial<SupportTicket>,
	): Promise<SupportTicket | undefined> {
		const ticket = this.supportTickets.get(id);
		if (ticket) {
			const updatedTicket = { ...ticket, ...updates, updatedAt: new Date() };
			this.supportTickets.set(id, updatedTicket);
			return updatedTicket;
		}
		return undefined;
	}

	// Ticket Messages
	async getTicketMessages(ticketId: string): Promise<TicketMessage[]> {
		return this.ticketMessages.get(ticketId) || [];
	}

	async addTicketMessage(
		messageData: InsertTicketMessage,
	): Promise<TicketMessage> {
		const id = randomUUID();
		const message: TicketMessage = {
			...messageData,
			id,
			createdAt: new Date(),
		} as any;

		const messages = this.ticketMessages.get(messageData.ticketId) || [];
		messages.push(message);
		this.ticketMessages.set(messageData.ticketId, messages);

		return message;
	}

	// Analytics and Stats
	async getPartnerStats(partnerId: string): Promise<PartnerStats> {
		const products = await this.getProductsByPartner(partnerId);
		const tickets = await this.getTicketsByPartner(partnerId);

		return {
			totalProducts: products.length,
			activeProducts: products.filter((p) => p.status === "active").length,
			totalTickets: tickets.length,
			openTickets: tickets.filter(
				(t) => t.status === "open" || t.status === "in_progress",
			).length,
			applications: 0, // Would count from productApplications
			pendingApplications: 0, // Would count pending applications
			revenue: 125000, // Simulated revenue
			commission: 3125, // Simulated commission (2.5%)
		};
	}

	async getProductMetrics(productId: string): Promise<ProductMetrics> {
		// Simulated metrics - in real app would come from analytics
		return {
			views: 1250,
			applications: 89,
			approvals: 67,
			conversionRate: 75.3,
			revenue: 85000,
		};
	}

	// Public product catalog
	async getPublicProducts(): Promise<Product[]> {
		return Array.from(this.products.values()).filter(
			(product) => product.isPublic && product.status === "active",
		);
	}

	async getProductsByCategory(category: string): Promise<Product[]> {
		return Array.from(this.products.values()).filter(
			(product) =>
				product.category === category &&
				product.isPublic &&
				product.status === "active",
		);
	}

	async searchProducts(query: string): Promise<Product[]> {
		const searchTerm = query.toLowerCase();
		return Array.from(this.products.values()).filter(
			(product) =>
				product.isPublic &&
				product.status === "active" &&
				(product.name.toLowerCase().includes(searchTerm) ||
					product.description?.toLowerCase().includes(searchTerm) ||
					(product as any).tags?.some((tag: string) =>
						tag.toLowerCase().includes(searchTerm),
					)),
		);
	}
}

export const partnerService = new PartnerService();
