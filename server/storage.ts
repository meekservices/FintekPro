import session from "express-session";
import connectPg from "connect-pg-simple";
import { pool } from "./db";
import { users, type User, type InsertUser, type UserSession, type UpdateUser, type KYCStatus, type InsertKYCStatus, type Prospect, type InsertProspect, type AgentApplication, type InsertAgentApplication, type AgentProfile, type InsertAgentProfile, type Lead, type InsertLead, type SupportTicket, type InsertSupportTicket, type Commission, type InsertCommission, type Portfolio, type InsertPortfolio, type AdvisoryService, type InsertAdvisoryService, type InvestmentPicks, type InsertInvestmentPicks, type Transaction, type InsertTransaction, type FamilyMember, type InsertFamilyMember, type FamilyAsset, type InsertFamilyAsset, type FamilyLiability, type InsertFamilyLiability, type FamilyBudget, type InsertFamilyBudget, type AlertHistory, type InsertAlertHistory, type Goal, type InsertGoal, type InsurancePolicy, type InsertInsurancePolicy, type ItrFiling, type InsertItrFiling, type Bond, type InsertBond, type UnlistedCompany, type InsertUnlistedCompany, type MarketScreener, type InsertMarketScreener, type Document, type InsertDocument, type McaCompany, type InsertMcaCompany, type TaxSession, type InsertTaxSession, type TaxDataSource, type InsertTaxDataSource, type ValidationIssue, type InsertValidationIssue, type FilingRecord, type InsertFilingRecord, type AiOptimizationSuggestion, type InsertAiOptimizationSuggestion, type FundExtended, type FundSearchParams, type FundListResponse, type Provenance, type MultiSourceStatus, type SourceStatus } from "@shared/schema";
import { eq, or, and, sql, desc, ilike } from "drizzle-orm";
import { db } from "./db";
import { logger } from "./logger";

const PostgresSessionStore = connectPg(session);

// Lazy initialization of session store to prevent connection attempts during module import
let _sessionStore: any = null;

export const getSessionStore = () => {
  if (!_sessionStore) {
    _sessionStore = new PostgresSessionStore({
      pool,
      tableName: "session",
      createTableIfMissing: true,
    });
  }
  return _sessionStore;
};

export interface IStorage {
  // Existing User/Auth methods
  getUser(id: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  updateUser(id: string, updates: UpdateUser): Promise<User>;

  // KYC
  getKYCStatus(userId: string): Promise<KYCStatus | undefined>;
  upsertKYCStatus(status: InsertKYCStatus): Promise<KYCStatus>;

  // Prospects
  getProspect(id: string): Promise<Prospect | undefined>;
  getProspectsByAgent(agentId: string): Promise<Prospect[]>;
  createProspect(prospect: InsertProspect): Promise<Prospect>;
  updateProspect(id: string, updates: Partial<Prospect>): Promise<Prospect>;

  // Agent Applications
  getAgentApplication(userId: string): Promise<AgentApplication | undefined>;
  createAgentApplication(app: InsertAgentApplication): Promise<AgentApplication>;
  updateAgentApplication(id: string, updates: Partial<AgentApplication>): Promise<AgentApplication>;

  // Portfolio
  getPortfolios(userId: string): Promise<Portfolio[]>;
  createPortfolio(portfolio: InsertPortfolio): Promise<Portfolio>;

  // Transactions
  getTransactions(userId: string): Promise<Transaction[]>;
  createTransaction(tx: InsertTransaction): Promise<Transaction>;

  // Commissions
  getCommissions(agentId: string): Promise<Commission[]>;
  createCommission(comm: InsertCommission): Promise<Commission>;

  // Leads
  getLeads(agentId: string): Promise<Lead[]>;
  createLead(lead: InsertLead): Promise<Lead>;

  // SGB/Bonds
  getBonds(): Promise<Bond[]>;
  getBond(id: string): Promise<Bond | undefined>;

  // Unlisted
  getUnlistedCompanies(): Promise<UnlistedCompany[]>;
  getUnlistedCompany(id: string): Promise<UnlistedCompany | undefined>;

  // ... (many more methods)
}

export class DatabaseStorage implements IStorage {
  // User operations
  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.username, username));
    return user;
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.email, email));
    return user;
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const [user] = await db.insert(users).values(insertUser).returning();
    return user;
  }

  async updateUser(id: string, updates: UpdateUser): Promise<User> {
    const [user] = await db.update(users).set(updates).where(eq(users.id, id)).returning();
    if (!user) throw new Error("User not found");
    return user;
  }

  // KYC operations
  async getKYCStatus(userId: string): Promise<KYCStatus | undefined> {
    const [status] = await db.select().from(kycStatus).where(eq(kycStatus.userId, userId));
    return status;
  }

  async upsertKYCStatus(status: InsertKYCStatus): Promise<KYCStatus> {
    const [existing] = await db.select().from(kycStatus).where(eq(kycStatus.userId, status.userId));
    if (existing) {
      const [updated] = await db.update(kycStatus).set(status).where(eq(kycStatus.userId, status.userId)).returning();
      return updated;
    }
    const [inserted] = await db.insert(kycStatus).values(status).returning();
    return inserted;
  }

  // Prospect operations
  async getProspect(id: string): Promise<Prospect | undefined> {
    const [prospect] = await db.select().from(prospects).where(eq(prospects.id, id));
    return prospect;
  }

  async getProspectsByAgent(agentId: string): Promise<Prospect[]> {
    return await db.select().from(prospects).where(eq(prospects.createdByAgentId, agentId));
  }

  async createProspect(prospect: InsertProspect): Promise<Prospect> {
    const [newProspect] = await db.insert(prospects).values(prospect).returning();
    return newProspect;
  }

  async updateProspect(id: string, updates: Partial<Prospect>): Promise<Prospect> {
    const [updated] = await db.update(prospects).set(updates).where(eq(prospects.id, id)).returning();
    if (!updated) throw new Error("Prospect not found");
    return updated;
  }

  // Agent Application operations
  async getAgentApplication(userId: string): Promise<AgentApplication | undefined> {
    const [app] = await db.select().from(agentApplications).where(eq(agentApplications.userId, userId));
    return app;
  }

  async createAgentApplication(app: InsertAgentApplication): Promise<AgentApplication> {
    const [newApp] = await db.insert(agentApplications).values(app).returning();
    return newApp;
  }

  async updateAgentApplication(id: string, updates: Partial<AgentApplication>): Promise<AgentApplication> {
    const [updated] = await db.update(agentApplications).set(updates).where(eq(agentApplications.id, id)).returning();
    if (!updated) throw new Error("Application not found");
    return updated;
  }

  // Portfolio operations
  async getPortfolios(userId: string): Promise<Portfolio[]> {
    return await db.select().from(portfolios).where(eq(portfolios.userId, userId));
  }

  async createPortfolio(portfolio: InsertPortfolio): Promise<Portfolio> {
    const [newPortfolio] = await db.insert(portfolios).values(portfolio).returning();
    return newPortfolio;
  }

  // Transaction operations
  async getTransactions(userId: string): Promise<Transaction[]> {
    return await db.select().from(transactions).where(eq(transactions.userId, userId));
  }

  async createTransaction(tx: InsertTransaction): Promise<Transaction> {
    const [newTx] = await db.insert(transactions).values(tx).returning();
    return newTx;
  }

  // Commission operations
  async getCommissions(agentId: string): Promise<Commission[]> {
    return await db.select().from(commissions).where(eq(commissions.agentId, agentId));
  }

  async createCommission(comm: InsertCommission): Promise<Commission> {
    const [newComm] = await db.insert(commissions).values(comm).returning();
    return newComm;
  }

  // Lead operations
  async getLeads(agentId: string): Promise<Lead[]> {
    return await db.select().from(leads).where(eq(leads.agentId, agentId));
  }

  async createLead(lead: InsertLead): Promise<Lead> {
    const [newLead] = await db.insert(leads).values(lead).returning();
    return newLead;
  }

  // Bond operations
  async getBonds(): Promise<Bond[]> {
    return await db.select().from(bonds);
  }

  async getBond(id: string): Promise<Bond | undefined> {
    const [bond] = await db.select().from(bonds).where(eq(bonds.id, id));
    return bond;
  }

  // Unlisted operations
  async getUnlistedCompanies(): Promise<UnlistedCompany[]> {
    return await db.select().from(unlistedCompanies);
  }

  async getUnlistedCompany(id: string): Promise<UnlistedCompany | undefined> {
    const [company] = await db.select().from(unlistedCompanies).where(eq(unlistedCompanies.id, id));
    return company;
  }

  // Support Ticket operations
  async getSupportTickets(userId: string): Promise<SupportTicket[]> {
    return await db.select().from(supportTickets).where(eq(supportTickets.userId, userId));
  }

  async createSupportTicket(ticket: InsertSupportTicket): Promise<SupportTicket> {
    const [newTicket] = await db.insert(supportTickets).values(ticket).returning();
    return newTicket;
  }

  // Advisory methods
  async getAdvisoryServices(): Promise<AdvisoryService[]> {
    return await db.select().from(advisoryServices);
  }

  async getInvestmentPicks(): Promise<InvestmentPicks[]> {
    return await db.select().from(investmentPicks);
  }

  // Family methods
  async getFamilyMembers(userId: string): Promise<FamilyMember[]> {
    return await db.select().from(familyMembers).where(eq(familyMembers.userId, userId));
  }

  async getFamilyAssets(userId: string): Promise<FamilyAsset[]> {
    return await db.select().from(familyAssets).where(eq(familyAssets.userId, userId));
  }

  async getFamilyLiabilities(userId: string): Promise<FamilyLiability[]> {
    return await db.select().from(familyLiabilities).where(eq(familyLiabilities.userId, userId));
  }

  async getFamilyBudgets(userId: string): Promise<FamilyBudget[]> {
    return await db.select().from(familyBudgets).where(eq(familyBudgets.userId, userId));
  }

  // Goal methods
  async getGoals(userId: string): Promise<Goal[]> {
    return await db.select().from(goals).where(eq(goals.userId, userId));
  }

  async createGoal(goal: InsertGoal): Promise<Goal> {
    const [newGoal] = await db.insert(goals).values(goal).returning();
    return newGoal;
  }

  // Insurance methods
  async getInsurancePolicies(userId: string): Promise<InsurancePolicy[]> {
    return await db.select().from(insurancePolicies).where(eq(insurancePolicies.userId, userId));
  }

  // ITR methods
  async getItrFilings(userId: string): Promise<ItrFiling[]> {
    return await db.select().from(itrFilings).where(eq(itrFilings.userId, userId));
  }

  // Market Screener methods
  async getMarketScreeners(): Promise<MarketScreener[]> {
    return await db.select().from(marketScreeners);
  }

  // Document methods
  async getDocuments(userId: string): Promise<Document[]> {
    return await db.select().from(documents).where(eq(documents.userId, userId));
  }

  // MCA methods
  async getMcaCompany(cin: string): Promise<McaCompany | undefined> {
    const [company] = await db.select().from(mcaCompanies).where(eq(mcaCompanies.cin, cin));
    return company;
  }

  // Implementation for missing methods (placeholders for now to maintain interface)
  async getLoanApplication(id: string): Promise<any | undefined> {
    throw new Error("Method not implemented: getLoanApplication");
  }

  async getUserLoans(userId: string): Promise<any[]> {
    throw new Error("Method not implemented: getUserLoans");
  }

  async updateLoanStatus(id: string, updates: any): Promise<any | undefined> {
    throw new Error("Method not implemented: updateLoanStatus");
  }

  async getCollateralValuation(loanId: string): Promise<any | undefined> {
    throw new Error("Method not implemented: getCollateralValuation");
  }

  async listFunds(params?: FundSearchParams): Promise<FundListResponse> {
    throw new Error("Method not implemented: listFunds");
  }

  async getFund(schemeCode: string): Promise<FundExtended | undefined> {
    throw new Error("Method not implemented: getFund");
  }

  async searchFunds(query: string): Promise<FundExtended[]> {
    throw new Error("Method not implemented: searchFunds");
  }

  async upsertFund(fund: FundExtended): Promise<FundExtended> {
    throw new Error("Method not implemented: upsertFund");
  }

  async getPopularFunds(): Promise<FundExtended[]> {
    throw new Error("Method not implemented: getPopularFunds");
  }

  async getProvenance(schemeCode: string): Promise<Provenance | undefined> {
    throw new Error("Method not implemented: getProvenance");
  }

  async markStale(schemeCodes: string[]): Promise<void> {
    throw new Error("Method not implemented: markStale");
  }

  async refreshFundCache(): Promise<void> {
    throw new Error("Method not implemented: refreshFundCache");
  }

  async getFundsCacheStats(): Promise<{ totalCount: number; staleCount: number; lastUpdated: Date }> {
    throw new Error("Method not implemented: getFundsCacheStats");
  }

  async getSourcesStatus(): Promise<MultiSourceStatus> {
    throw new Error("Method not implemented: getSourcesStatus");
  }

  async updateSourceStatus(status: SourceStatus): Promise<void> {
    throw new Error("Method not implemented: updateSourceStatus");
  }

  async createTaxSession(session: InsertTaxSession): Promise<TaxSession> {
    throw new Error("Method not implemented: createTaxSession");
  }

  async getTaxSessions(userId: string): Promise<TaxSession[]> {
    throw new Error("Method not implemented: getTaxSessions");
  }

  async getTaxSession(id: string): Promise<TaxSession | undefined> {
    throw new Error("Method not implemented: getTaxSession");
  }

  async getTaxSessionByPanAndYear(userId: string, panNumber: string, assessmentYear: string): Promise<TaxSession | undefined> {
    throw new Error("Method not implemented: getTaxSessionByPanAndYear");
  }

  async updateTaxSession(id: string, updates: Partial<TaxSession>): Promise<TaxSession | undefined> {
    throw new Error("Method not implemented: updateTaxSession");
  }

  async deleteTaxSession(id: string): Promise<boolean> {
    throw new Error("Method not implemented: deleteTaxSession");
  }

  async updateTaxSessionStatus(id: string, status: string, currentStep?: number): Promise<TaxSession | undefined> {
    throw new Error("Method not implemented: updateTaxSessionStatus");
  }

  async getTaxDataSources(sessionId: string): Promise<TaxDataSource[]> {
    throw new Error("Method not implemented: getTaxDataSources");
  }

  async getTaxDataSource(id: string): Promise<TaxDataSource | undefined> {
    throw new Error("Method not implemented: getTaxDataSource");
  }

  async createTaxDataSource(dataSource: InsertTaxDataSource): Promise<TaxDataSource> {
    throw new Error("Method not implemented: createTaxDataSource");
  }

  async updateTaxDataSource(id: string, updates: Partial<TaxDataSource>): Promise<TaxDataSource | undefined> {
    throw new Error("Method not implemented: updateTaxDataSource");
  }

  async deleteTaxDataSource(id: string): Promise<boolean> {
    throw new Error("Method not implemented: deleteTaxDataSource");
  }

  async updateDataSourceStatus(id: string, status: string, recordsCount?: number, lastSync?: Date): Promise<TaxDataSource | undefined> {
    throw new Error("Method not implemented: updateDataSourceStatus");
  }

  async getValidationIssues(sessionId: string, severity?: string): Promise<ValidationIssue[]> {
    throw new Error("Method not implemented: getValidationIssues");
  }

  async getValidationIssue(id: string): Promise<ValidationIssue | undefined> {
    throw new Error("Method not implemented: getValidationIssue");
  }

  async createValidationIssue(issue: InsertValidationIssue): Promise<ValidationIssue> {
    throw new Error("Method not implemented: createValidationIssue");
  }

  async updateValidationIssue(id: string, updates: Partial<ValidationIssue>): Promise<ValidationIssue | undefined> {
    throw new Error("Method not implemented: updateValidationIssue");
  }

  async deleteValidationIssue(id: string): Promise<boolean> {
    throw new Error("Method not implemented: deleteValidationIssue");
  }

  async resolveValidationIssue(id: string, resolvedBy: string): Promise<ValidationIssue | undefined> {
    throw new Error("Method not implemented: resolveValidationIssue");
  }

  async getValidationIssuesBySection(sessionId: string, section: string): Promise<ValidationIssue[]> {
    throw new Error("Method not implemented: getValidationIssuesBySection");
  }

  async getFilingRecords(sessionId: string): Promise<FilingRecord[]> {
    throw new Error("Method not implemented: getFilingRecords");
  }

  async getFilingRecord(id: string): Promise<FilingRecord | undefined> {
    throw new Error("Method not implemented: getFilingRecord");
  }

  async getFilingRecordByAckNumber(acknowledgmentNumber: string): Promise<FilingRecord | undefined> {
    throw new Error("Method not implemented: getFilingRecordByAckNumber");
  }

  async createFilingRecord(record: InsertFilingRecord): Promise<FilingRecord> {
    throw new Error("Method not implemented: createFilingRecord");
  }

  async updateFilingRecord(id: string, updates: Partial<FilingRecord>): Promise<FilingRecord | undefined> {
    throw new Error("Method not implemented: updateFilingRecord");
  }

  async updateFilingStatus(id: string, status: string, verificationDate?: Date): Promise<FilingRecord | undefined> {
    throw new Error("Method not implemented: updateFilingStatus");
  }

  async getAiOptimizationSuggestions(sessionId: string, category?: string): Promise<AiOptimizationSuggestion[]> {
    throw new Error("Method not implemented: getAiOptimizationSuggestions");
  }

  async getAiOptimizationSuggestion(id: string): Promise<AiOptimizationSuggestion | undefined> {
    throw new Error("Method not implemented: getAiOptimizationSuggestion");
  }

  async createAiOptimizationSuggestion(suggestion: InsertAiOptimizationSuggestion): Promise<AiOptimizationSuggestion> {
    throw new Error("Method not implemented: createAiOptimizationSuggestion");
  }

  async updateAiOptimizationSuggestion(id: string, updates: Partial<AiOptimizationSuggestion>): Promise<AiOptimizationSuggestion | undefined> {
    throw new Error("Method not implemented: updateAiOptimizationSuggestion");
  }

  async respondToSuggestion(id: string, status: string, userResponse?: string): Promise<AiOptimizationSuggestion | undefined> {
    throw new Error("Method not implemented: respondToSuggestion");
  }

  async getPendingSuggestions(sessionId: string): Promise<AiOptimizationSuggestion[]> {
    throw new Error("Method not implemented: getPendingSuggestions");
  }

  async updateBudgetSpendById(budgetId: string, amount: number): Promise<FamilyBudget> {
    throw new Error("Method not implemented: updateBudgetSpendById");
  }

  async markAlertAsRead(historyId: string): Promise<AlertHistory | undefined> {
    throw new Error("Method not implemented: markAlertAsRead");
  }

  async updateBudgetSpendByUser(userId: string, category: string, amount: number): Promise<void> {
    throw new Error("Method not implemented: updateBudgetSpendByUser");
  }
}

// Use DatabaseStorage instead of MemStorage
export const storage = new DatabaseStorage();
