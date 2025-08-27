import { sql } from "drizzle-orm";
import { pgTable, text, varchar, decimal, timestamp, jsonb, boolean, index, integer, date } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Session storage table for Replit Auth
export const sessions = pgTable(
  "sessions",
  {
    sid: varchar("sid").primaryKey(),
    sess: jsonb("sess").notNull(),
    expire: timestamp("expire").notNull(),
  },
  (table) => [index("IDX_session_expire").on(table.expire)],
);

// User storage table with mobile/email authentication
export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  email: varchar("email").unique(),
  mobile: varchar("mobile").unique(),
  password: text("password").notNull(),
  firstName: varchar("first_name"),
  middleName: varchar("middle_name"),
  lastName: varchar("last_name"),
  profileImageUrl: varchar("profile_image_url"),
  isEmailVerified: boolean("is_email_verified").default(false),
  isMobileVerified: boolean("is_mobile_verified").default(false),
  // Profile/KYC Information
  panNumber: varchar("pan_number"),
  aadharNumber: varchar("aadhar_number"),
  dateOfBirth: varchar("date_of_birth"),
  address: text("address"),
  city: varchar("city"),
  state: varchar("state"),
  pincode: varchar("pincode"),
  occupation: varchar("occupation"),
  annualIncome: varchar("annual_income"),
  investmentExperience: varchar("investment_experience"),
  riskTolerance: varchar("risk_tolerance"),
  // Admin and system fields
  role: varchar("role").default("user"), // 'user', 'admin', 'super_admin'
  isActive: boolean("is_active").default(true),
  lastLoginAt: timestamp("last_login_at"),
  loginCount: integer("login_count").default(0),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// OTP verification table
export const otpVerifications = pgTable("otp_verifications", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  identifier: varchar("identifier").notNull(), // email or mobile
  otp: varchar("otp", { length: 6 }).notNull(),
  type: varchar("type").notNull(), // 'email' or 'mobile'
  expiresAt: timestamp("expires_at").notNull(),
  verified: boolean("verified").default(false),
  createdAt: timestamp("created_at").defaultNow(),
});

export const portfolios = pgTable("portfolios", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id).notNull(),
  name: text("name").notNull(),
  totalValue: decimal("total_value", { precision: 15, scale: 2 }),
  cash: decimal("cash", { precision: 15, scale: 2 }).default("0"),
  isDefault: boolean("is_default").default(false),
  createdAt: timestamp("created_at").defaultNow(),
});

export const portfolioHoldings = pgTable("portfolio_holdings", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  portfolioId: varchar("portfolio_id").references(() => portfolios.id).notNull(),
  symbol: text("symbol").notNull(),
  quantity: decimal("quantity", { precision: 15, scale: 4 }).notNull(),
  avgPrice: decimal("avg_price", { precision: 15, scale: 4 }).notNull(),
  assetType: text("asset_type").notNull(), // 'equity', 'bond', 'mf', 'gold', 'alternative'
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const watchlists = pgTable("watchlists", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id).notNull(),
  name: text("name").notNull(),
  symbols: text("symbols").array(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const marketData = pgTable("market_data", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  symbol: text("symbol").notNull().unique(),
  price: decimal("price", { precision: 15, scale: 4 }),
  change: decimal("change", { precision: 15, scale: 4 }),
  changePercent: decimal("change_percent", { precision: 8, scale: 4 }),
  volume: decimal("volume", { precision: 20, scale: 0 }),
  marketCap: decimal("market_cap", { precision: 20, scale: 0 }),
  data: jsonb("data"), // Additional market data from Finnhub
  lastUpdated: timestamp("last_updated").defaultNow(),
});

export const assetAllocation = pgTable("asset_allocation", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  portfolioId: varchar("portfolio_id").references(() => portfolios.id).notNull(),
  assetType: text("asset_type").notNull(),
  targetPercentage: decimal("target_percentage", { precision: 5, scale: 2 }),
  currentPercentage: decimal("current_percentage", { precision: 5, scale: 2 }),
  targetValue: decimal("target_value", { precision: 15, scale: 2 }),
  currentValue: decimal("current_value", { precision: 15, scale: 2 }),
  rebalanceAmount: decimal("rebalance_amount", { precision: 15, scale: 2 }),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// User Activity Tracking
export const userActivities = pgTable("user_activities", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id),
  action: varchar("action").notNull(), // 'login', 'portfolio_view', 'trade', 'api_call', etc.
  resource: varchar("resource"), // what was accessed/modified
  details: jsonb("details"), // additional activity data
  ipAddress: varchar("ip_address"),
  userAgent: varchar("user_agent"),
  createdAt: timestamp("created_at").defaultNow(),
});

// Admin Panel Settings
export const adminSettings = pgTable("admin_settings", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  key: varchar("key").notNull().unique(),
  value: jsonb("value"),
  description: text("description"),
  updatedBy: varchar("updated_by").references(() => users.id),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// User Notifications/Guidance
export const userNotifications = pgTable("user_notifications", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id),
  type: varchar("type").notNull(), // 'info', 'warning', 'guidance', 'alert'
  title: varchar("title").notNull(),
  message: text("message").notNull(),
  actionUrl: varchar("action_url"), // where to navigate when clicked
  isRead: boolean("is_read").default(false),
  priority: varchar("priority").default("medium"), // 'low', 'medium', 'high', 'critical'
  expiresAt: timestamp("expires_at"),
  createdBy: varchar("created_by").references(() => users.id), // admin who created it
  createdAt: timestamp("created_at").defaultNow(),
});

export const mutualFunds = pgTable("mutual_funds", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  schemeCode: text("scheme_code").notNull().unique(),
  schemeName: text("scheme_name").notNull(),
  category: text("category"),
  fundHouse: text("fund_house"),
  nav: decimal("nav", { precision: 10, scale: 4 }),
  change: decimal("change", { precision: 10, scale: 4 }),
  changePercent: decimal("change_percent", { precision: 8, scale: 4 }),
  expenseRatio: decimal("expense_ratio", { precision: 5, scale: 2 }),
  aum: decimal("aum", { precision: 15, scale: 2 }),
  riskLevel: text("risk_level"),
  returns1y: decimal("returns_1y", { precision: 8, scale: 4 }),
  returns3y: decimal("returns_3y", { precision: 8, scale: 4 }),
  returns5y: decimal("returns_5y", { precision: 8, scale: 4 }),
  lastUpdated: timestamp("last_updated").defaultNow(),
});

export const insertUserSchema = createInsertSchema(users).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertPortfolioSchema = createInsertSchema(portfolios).omit({
  id: true,
  createdAt: true,
});

export const insertPortfolioHoldingSchema = createInsertSchema(portfolioHoldings).omit({
  id: true,
  updatedAt: true,
});

export const insertWatchlistSchema = createInsertSchema(watchlists).omit({
  id: true,
  createdAt: true,
});

export const insertAssetAllocationSchema = createInsertSchema(assetAllocation).omit({
  id: true,
  updatedAt: true,
});

export const insertMutualFundSchema = createInsertSchema(mutualFunds).omit({
  id: true,
  lastUpdated: true,
});

export const insertOtpVerificationSchema = createInsertSchema(otpVerifications).omit({
  id: true,
  createdAt: true,
});

export type InsertUser = z.infer<typeof insertUserSchema>;
export type UpsertUser = typeof users.$inferInsert;
export type User = typeof users.$inferSelect;

// User Activity schemas
export const insertUserActivitySchema = createInsertSchema(userActivities, {
  createdAt: true,
});
export type InsertUserActivity = z.infer<typeof insertUserActivitySchema>;
export type UserActivity = typeof userActivities.$inferSelect;

// Admin Settings schemas
export const insertAdminSettingSchema = createInsertSchema(adminSettings, {
  updatedAt: true,
});
export type InsertAdminSetting = z.infer<typeof insertAdminSettingSchema>;
export type AdminSetting = typeof adminSettings.$inferSelect;

// User Notifications schemas
export const insertUserNotificationSchema = createInsertSchema(userNotifications, {
  createdAt: true,
});
export type InsertUserNotification = z.infer<typeof insertUserNotificationSchema>;
export type UserNotification = typeof userNotifications.$inferSelect;
export type OtpVerification = typeof otpVerifications.$inferSelect;
export type InsertOtpVerification = z.infer<typeof insertOtpVerificationSchema>;
export type InsertPortfolio = z.infer<typeof insertPortfolioSchema>;
export type Portfolio = typeof portfolios.$inferSelect;
export type InsertPortfolioHolding = z.infer<typeof insertPortfolioHoldingSchema>;
export type PortfolioHolding = typeof portfolioHoldings.$inferSelect;
export type InsertWatchlist = z.infer<typeof insertWatchlistSchema>;
export type Watchlist = typeof watchlists.$inferSelect;
export type MarketData = typeof marketData.$inferSelect;
export type AssetAllocation = typeof assetAllocation.$inferSelect;
export type InsertAssetAllocation = z.infer<typeof insertAssetAllocationSchema>;
export type MutualFund = typeof mutualFunds.$inferSelect;
export type InsertMutualFund = z.infer<typeof insertMutualFundSchema>;

// Learning Modules and Lessons
export const learningModules = pgTable("learning_modules", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  title: text("title").notNull(),
  description: text("description"),
  difficulty: varchar("difficulty").notNull(), // 'beginner', 'intermediate', 'advanced'
  category: varchar("category").notNull(), // 'basics', 'trading', 'risk-management', 'market-analysis'
  orderIndex: integer("order_index").notNull().default(0),
  estimatedMinutes: integer("estimated_minutes").default(30),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
});

export const learningLessons = pgTable("learning_lessons", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  moduleId: varchar("module_id").references(() => learningModules.id).notNull(),
  title: text("title").notNull(),
  content: text("content").notNull(),
  contentType: varchar("content_type").notNull(), // 'text', 'video', 'interactive'
  orderIndex: integer("order_index").notNull().default(0),
  estimatedMinutes: integer("estimated_minutes").default(10),
  pointsReward: integer("points_reward").default(50),
  createdAt: timestamp("created_at").defaultNow(),
});

export const learningQuizzes = pgTable("learning_quizzes", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  lessonId: varchar("lesson_id").references(() => learningLessons.id).notNull(),
  question: text("question").notNull(),
  options: text("options").array().notNull(),
  correctAnswer: integer("correct_answer").notNull(),
  explanation: text("explanation"),
  pointsReward: integer("points_reward").default(25),
  createdAt: timestamp("created_at").defaultNow(),
});

// User Progress and Achievements
export const userProgress = pgTable("user_progress", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id).notNull(),
  moduleId: varchar("module_id").references(() => learningModules.id),
  lessonId: varchar("lesson_id").references(() => learningLessons.id),
  status: varchar("status").notNull(), // 'not_started', 'in_progress', 'completed'
  score: integer("score").default(0),
  completedAt: timestamp("completed_at"),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const userAchievements = pgTable("user_achievements", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id).notNull(),
  achievementType: varchar("achievement_type").notNull(), // 'module_complete', 'streak', 'score', 'badge'
  achievementKey: varchar("achievement_key").notNull(),
  title: text("title").notNull(),
  description: text("description"),
  iconUrl: text("icon_url"),
  pointsEarned: integer("points_earned").default(0),
  earnedAt: timestamp("earned_at").defaultNow(),
});

export const userStats = pgTable("user_stats", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id).notNull().unique(),
  totalPoints: integer("total_points").default(0),
  currentStreak: integer("current_streak").default(0),
  maxStreak: integer("max_streak").default(0),
  modulesCompleted: integer("modules_completed").default(0),
  lessonsCompleted: integer("lessons_completed").default(0),
  quizzesCompleted: integer("quizzes_completed").default(0),
  averageScore: decimal("average_score", { precision: 5, scale: 2 }).default("0"),
  lastActivityAt: timestamp("last_activity_at"),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Learning system schemas and types
export const insertLearningModuleSchema = createInsertSchema(learningModules).omit({
  id: true,
  createdAt: true,
});

export const insertLearningLessonSchema = createInsertSchema(learningLessons).omit({
  id: true,
  createdAt: true,
});

export const insertLearningQuizSchema = createInsertSchema(learningQuizzes).omit({
  id: true,
  createdAt: true,
});

export const insertUserProgressSchema = createInsertSchema(userProgress).omit({
  id: true,
  updatedAt: true,
});

export const insertUserAchievementSchema = createInsertSchema(userAchievements).omit({
  id: true,
  earnedAt: true,
});

export const insertUserStatsSchema = createInsertSchema(userStats).omit({
  id: true,
  updatedAt: true,
});

// Export types for learning system
export type LearningModule = typeof learningModules.$inferSelect;
export type InsertLearningModule = z.infer<typeof insertLearningModuleSchema>;
export type LearningLesson = typeof learningLessons.$inferSelect;
export type InsertLearningLesson = z.infer<typeof insertLearningLessonSchema>;
export type LearningQuiz = typeof learningQuizzes.$inferSelect;
export type InsertLearningQuiz = z.infer<typeof insertLearningQuizSchema>;
export type UserProgress = typeof userProgress.$inferSelect;
export type InsertUserProgress = z.infer<typeof insertUserProgressSchema>;
export type UserAchievement = typeof userAchievements.$inferSelect;
export type InsertUserAchievement = z.infer<typeof insertUserAchievementSchema>;
export type UserStats = typeof userStats.$inferSelect;
export type InsertUserStats = z.infer<typeof insertUserStatsSchema>;

// User Profile table for API integration data
export const userProfiles = pgTable("user_profiles", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id).notNull().unique(),
  // Personal Information
  fullName: varchar("full_name", { length: 255 }),
  email: varchar("email", { length: 255 }),
  phone: varchar("phone", { length: 20 }),
  dateOfBirth: date("date_of_birth"),
  // Investment Profile
  riskTolerance: varchar("risk_tolerance", { length: 20 }), // conservative, moderate, aggressive
  investmentExperience: varchar("investment_experience", { length: 20 }), // beginner, intermediate, experienced
  annualIncome: decimal("annual_income", { precision: 12, scale: 2 }),
  investmentGoals: text("investment_goals").array(),
  investmentHorizon: varchar("investment_horizon", { length: 20 }), // short, medium, long
  // API Integration Data
  panNumber: varchar("pan_number", { length: 10 }),
  dematerializedAccounts: jsonb("demat_accounts"), // Array of demat account details
  mutualFundDistributor: varchar("mf_distributor_code", { length: 50 }),
  bankDetails: jsonb("bank_details"), // Primary bank account details
  // Platform Preferences
  preferredCurrency: varchar("preferred_currency", { length: 10 }).default("INR"),
  notificationPreferences: jsonb("notification_preferences"),
  // Timestamps
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull()
});

// Market Stories table for AI-generated content
export const marketStories = pgTable("market_stories", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  title: varchar("title", { length: 255 }).notNull(),
  content: text("content").notNull(),
  summary: text("summary").notNull(),
  sentiment: varchar("sentiment", { length: 20 }).notNull(),
  confidence: decimal("confidence", { precision: 3, scale: 2 }).notNull(),
  keyPoints: text("key_points").array().default([]),
  marketData: jsonb("market_data"),
  generatedAt: timestamp("generated_at").defaultNow(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertUserProfileSchema = createInsertSchema(userProfiles).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertMarketStorySchema = createInsertSchema(marketStories).omit({
  id: true,
  generatedAt: true,
  createdAt: true,
});

export type UserProfile = typeof userProfiles.$inferSelect;
export type InsertUserProfile = z.infer<typeof insertUserProfileSchema>;
export type MarketStory = typeof marketStories.$inferSelect;
export type InsertMarketStory = z.infer<typeof insertMarketStorySchema>;
