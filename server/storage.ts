import { users, type User, type InsertUser, type Portfolio, type DailyPick, type InvestmentProposal, type UserVerification, type UserTrustedDevice, type AuditLog, type UserNotification, type AIServiceMetric, type AIPromptVersion, type AIPromptRegistry, type AgentClient, type UserSecurityQuestion, type UserLoginHistory, type UserDocument, type UserDocumentVerification, type UserDocumentVault, type UserBankDetail, type CashfreeOrder, type CashfreeRefund, type UserAddress, type UserNominee, type UserKycProfile, type UserKycStatus, type UserRegulatoryCompliance, type UserRiskProfile, type UserInvestmentGoal, type UserInvestmentPreference, type UserTaxProfile, type UserInsuranceProfile, type UserAssetAllocation, type UserPortfolioTransaction, type UserPortfolioHolding, type UserPortfolioPerformance, type UserPortfolioSnapshot, type UserPortfolioHistory, type UserPortfolioDrift, type UserPortfolioOptimization, type UserPortfolioAnalysis, type UserPortfolioRebalancing, type UserPortfolioRecommendation, type UserPortfolioStrategy, type UserPortfolioInsight, type UserPortfolioBenchmark, type UserPortfolioRiskMetric, type UserPortfolioReturnMetric, type UserPortfolioValuation, type UserPortfolioCostBasis, type UserPortfolioTaxLot, type UserPortfolioCorporateAction, type UserPortfolioOrder, type UserPortfolioTrade, type UserPortfolioExecution, type UserPortfolioSettlement, type UserPortfolioCustody, type UserPortfolioReporting, type UserPortfolioStatement, type UserPortfolioDocument, type UserPortfolioLink, type UserPortfolioAccess, type UserPortfolioPermission, type UserPortfolioSetting, type UserPortfolioNotification, type UserPortfolioAlert, type UserPortfolioLimit, type UserPortfolioConstraint, type UserPortfolioObjective, type UserPortfolioConstraintSet, type UserPortfolioObjectiveSet, type UserPortfolioOptimizationResult, type UserPortfolioOptimizationProblem, type UserPortfolioOptimizationTarget, type UserPortfolioOptimizationConstraint, type UserPortfolioOptimizationObjective, type UserPortfolioOptimizationVariable, type UserPortfolioOptimizationParameter, type UserPortfolioOptimizationMetadata, type UserPortfolioOptimizationStatus, type UserPortfolioOptimizationType, type UserPortfolioOptimizationScope, type UserPortfolioOptimizationMethod, type UserPortfolioOptimizationEngine, type UserPortfolioOptimizationEngineType, type UserPortfolioOptimizationEngineVersion, type UserPortfolioOptimizationEngineStatus, type UserPortfolioOptimizationEngineMetadata, type UserPortfolioOptimizationEngineConfig, type UserPortfolioOptimizationEngineResult, type UserPortfolioOptimizationEngineError, type UserPortfolioOptimizationEngineWarning, type UserPortfolioOptimizationEngineInfo, type UserPortfolioOptimizationEngineMetric, type UserPortfolioOptimizationEngineLog, type UserPortfolioOptimizationEngineHistory, type UserPortfolioOptimizationEngineTrace, type UserPortfolioOptimizationEngineDebug, type UserPortfolioOptimizationEngineProfile, type UserPortfolioOptimizationEngineState, type UserPortfolioOptimizationEngineContext, type UserPortfolioOptimizationEngineEnvironment, type UserPortfolioOptimizationEngineResources, type UserPortfolioOptimizationEngineSession, type UserPortfolioOptimizationEngineJob, type UserPortfolioOptimizationEngineTask, type UserPortfolioOptimizationEngineStep, type UserPortfolioOptimizationEngineProcess, type UserPortfolioOptimizationEngineThread, type UserPortfolioOptimizationEngineMemory, type UserPortfolioOptimizationEngineCpu, type UserPortfolioOptimizationEngineDisk, type UserPortfolioOptimizationEngineNetwork, type UserPortfolioOptimizationEngineLatency, type UserPortfolioOptimizationEngineThroughput, type UserPortfolioOptimizationEngineCapacity, type UserPortfolioOptimizationEngineUtilization, type UserPortfolioOptimizationEngineEfficiency, type UserPortfolioOptimizationEnginePerformance, type UserPortfolioOptimizationEngineQuality, type UserPortfolioOptimizationEngineReliability, type UserPortfolioOptimizationEngineAvailability, type UserPortfolioOptimizationEngineSecurity, type UserPortfolioOptimizationEngineCompliance, type UserPortfolioOptimizationEngineAudit, type UserPortfolioOptimizationEngineGovernance, type UserPortfolioOptimizationEngineOwnership, type UserPortfolioOptimizationEngineLifecycle, type UserPortfolioOptimizationEngineVersioning, type UserPortfolioOptimizationEngineDocumentation, type UserPortfolioOptimizationEngineSupport, type UserPortfolioOptimizationEngineMaintenance, type UserPortfolioOptimizationEngineEvolution, type UserPortfolioOptimizationEngineLegacy, type UserPortfolioOptimizationEngineFuture, type UserPortfolioOptimizationEngineInnovation, type UserPortfolioOptimizationEngineTransformation, type UserPortfolioOptimizationEngineDigitalization, type UserPortfolioOptimizationEngineAutomation, type UserPortfolioOptimizationEngineIntelligence, type UserPortfolioOptimizationEnginePersonalization, type UserPortfolioOptimizationEngineContextualization, type UserPortfolioOptimizationEngineInteroperability, type UserPortfolioOptimizationEngineScalability, type UserPortfolioOptimizationEngineElasticity, type UserPortfolioOptimizationEngineResilience, type UserPortfolioOptimizationEngineObservability, type UserPortfolioOptimizationEngineManageability, type UserPortfolioOptimizationEngineUsability, type UserPortfolioOptimizationEngineAccessibility, type UserPortfolioOptimizationEngineInclusivity, type UserPortfolioOptimizationEngineDiversity, type UserPortfolioOptimizationEngineSustainability, type UserPortfolioOptimizationEngineResponsibility, type UserPortfolioOptimizationEngineEthics, type UserPortfolioOptimizationEngineTrust, type UserPortfolioOptimizationEngineSafety, type UserPortfolioOptimizationEnginePrivacy, type UserPortfolioOptimizationEngineIntegrity, type UserPortfolioOptimizationEngineAccuracy, type UserPortfolioOptimizationEngineCompleteness, type UserPortfolioOptimizationEngineTimeliness, type UserPortfolioOptimizationEngineRelevance, type UserPortfolioOptimizationEngineGranularity, type UserPortfolioOptimizationEngineConsistency, type UserPortfolioOptimizationEngineValidity, type UserPortfolioOptimizationEngineNormalization, type UserPortfolioOptimizationEngineStandardization, type UserPortfolioOptimizationEngineHarmonization, type UserPortfolioOptimizationEngineEnrichment, type UserPortfolioOptimizationEngineAugmentation, type UserPortfolioOptimizationEngineInsights, type UserPortfolioOptimizationEngineAnalytics, type UserPortfolioOptimizationEngineDiscovery, type UserPortfolioOptimizationEngineVisualization, type UserPortfolioOptimizationEngineCommunication, type UserPortfolioOptimizationEngineCollaboration, type UserPortfolioOptimizationEngineDecisionMaking, type UserPortfolioOptimizationEngineProblemSolving, type UserPortfolioOptimizationEngineOptimization, type UserPortfolioOptimizationEngineLearning, type UserPortfolioOptimizationEngineReasoning, type UserPortfolioOptimizationEngineCreativity, type UserPortfolioOptimizationEngineEmpathy, type UserPortfolioOptimizationEngineSelfAwareness, type UserPortfolioOptimizationEngineSocialAwareness, type UserPortfolioOptimizationEngineRelationshipManagement, type UserPortfolioOptimizationEngineSelfManagement, type UserPortfolioOptimizationEngineResponsibleDecisionMaking } from "@shared/schema";
import session from "express-session";
import PostgresSessionStore from "connect-pg-simple";
import { pool } from "./db";

const PostgresStore = PostgresSessionStore(session);

export interface IStorage {
  sessionStore: session.Store;
  getUser(id: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  getUserByMobile(mobile: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  updateUser(id: string, user: Partial<User>): Promise<User>;
  deleteUser(id: string): Promise<void>;
  listUsers(): Promise<User[]>;
  // ... many other methods
}

export class DatabaseStorage implements IStorage {
  public readonly sessionStore: session.Store;

  constructor() {
    this.sessionStore = new PostgresStore({
      pool,
      tableName: "session",
      createTableIfMissing: true,
    });
    console.log("[SessionStore] Using PostgresSessionStore for multi-instance persistence");
  }

  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.username, username));
    return user;
  }

  async getUserByMobile(mobile: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.mobile, mobile));
    return user;
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const [user] = await db.insert(users).values(insertUser).returning();
    return user;
  }

  async updateUser(id: string, user: Partial<User>): Promise<User> {
    const [updatedUser] = await db.update(users).set(user).where(eq(users.id, id)).returning();
    return updatedUser;
  }

  async deleteUser(id: string): Promise<void> {
    await db.delete(users).where(eq(users.id, id));
  }

  async listUsers(): Promise<User[]> {
    return db.select().from(users);
  }
  // ... implementation of other methods
}

export const storage = new DatabaseStorage();
