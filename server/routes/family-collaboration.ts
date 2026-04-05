/**
 * Family Collaboration Routes
 * P3 — Extracted from routes.ts to reduce file size
 */

import type { Express } from 'express';
import { storage } from '../storage';
import { complianceMonitor } from '../compliance-monitor';
import {
  insertFamilyGroupSchema,
  insertFamilyMemberSchema,
  insertFamilyGoalSchema,
  insertFamilyGoalContributionSchema,
  insertFamilyDiscussionSchema,
  insertFamilyBudgetSchema,
} from '@shared/schema';
import { z } from 'zod';

function requireAuth(req: any, res: any, next: any) {
  if (!req.user) return res.status(401).json({ message: 'Authentication required' });
  next();
}

async function verifyFamilyMembership(req: any, res: any, next: any) {
  try {
    const { familyId, id } = req.params;
    const targetId = familyId || id;
    if (!req.user?.id) return res.status(401).json({ message: 'Authentication required' });
    const membership = await storage.checkFamilyMembership(targetId, req.user.id);
    if (!membership) return res.status(403).json({ message: 'Not a member of this family group' });
    req.familyMember = membership;
    next();
  } catch (error) {
    console.error('Error verifying family membership:', error);
    res.status(500).json({ message: 'Failed to verify family membership' });
  }
}

export function registerFamilyCollaborationRoutes(app: Express): void {
  // ── Family Group Management ────────────────────────────────────────────────

  app.post('/api/families', requireAuth, async (req, res) => {
    try {
      const validatedData = insertFamilyGroupSchema.parse({ ...req.body, createdBy: req.user!.id });
      const familyGroup = await storage.createFamilyGroup(validatedData);
      await storage.inviteFamilyMember({ familyId: familyGroup.id, userId: req.user!.id, role: 'admin', status: 'active' });
      await storage.logFamilyActivity({ familyId: familyGroup.id, userId: req.user!.id, activityType: 'family_created', description: `Family group "${familyGroup.name}" was created` });
      complianceMonitor.logEvent({ userId: req.user!.id, eventType: 'family_collaboration', action: 'create_family_group', resource: familyGroup.id, outcome: 'success', riskLevel: 'low' });
      res.status(201).json(familyGroup);
    } catch (error) {
      console.error('Error creating family group:', error);
      if (error instanceof z.ZodError) return res.status(400).json({ message: 'Validation failed', errors: error.errors });
      res.status(500).json({ message: 'Failed to create family group' });
    }
  });

  app.get('/api/families', requireAuth, async (req, res) => {
    try {
      const families = await storage.getUserFamilies(req.user!.id);
      complianceMonitor.logEvent({ userId: req.user!.id, eventType: 'data_access', action: 'list_user_families', outcome: 'success', riskLevel: 'low' });
      res.json(families);
    } catch (error) {
      console.error('Error fetching user families:', error);
      res.status(500).json({ message: 'Failed to fetch families' });
    }
  });

  app.get('/api/families/:id', requireAuth, verifyFamilyMembership, async (req, res) => {
    try {
      const familyGroup = await storage.getFamilyGroup(req.params.id);
      if (!familyGroup) return res.status(404).json({ message: 'Family group not found' });
      complianceMonitor.logEvent({ userId: req.user!.id, eventType: 'data_access', action: 'view_family_details', resource: req.params.id, outcome: 'success', riskLevel: 'low' });
      res.json(familyGroup);
    } catch (error) {
      console.error('Error fetching family details:', error);
      res.status(500).json({ message: 'Failed to fetch family details' });
    }
  });

  app.patch('/api/families/:id', requireAuth, verifyFamilyMembership, async (req, res) => {
    try {
      if (req.familyMember.role !== 'admin') return res.status(403).json({ message: 'Only admins can update family group' });
      const updates = insertFamilyGroupSchema.partial().parse(req.body);
      const updatedFamily = await storage.updateFamilyGroup(req.params.id, updates);
      await storage.logFamilyActivity({ familyId: req.params.id, userId: req.user!.id, activityType: 'family_updated', description: 'Family group details were updated' });
      complianceMonitor.logEvent({ userId: req.user!.id, eventType: 'family_collaboration', action: 'update_family_group', resource: req.params.id, outcome: 'success', riskLevel: 'low' });
      res.json(updatedFamily);
    } catch (error) {
      console.error('Error updating family group:', error);
      if (error instanceof z.ZodError) return res.status(400).json({ message: 'Validation failed', errors: error.errors });
      res.status(500).json({ message: 'Failed to update family group' });
    }
  });

  // ── Family Members ─────────────────────────────────────────────────────────

  app.post('/api/families/:familyId/members', requireAuth, verifyFamilyMembership, async (req, res) => {
    try {
      if (req.familyMember.role !== 'admin') return res.status(403).json({ message: 'Only admins can invite members' });
      const validatedData = insertFamilyMemberSchema.parse({ ...req.body, familyId: req.params.familyId, status: 'pending' });
      const member = await storage.inviteFamilyMember(validatedData);
      await storage.logFamilyActivity({ familyId: req.params.familyId, userId: req.user!.id, activityType: 'member_invited', description: `User was invited to the family` });
      complianceMonitor.logEvent({ userId: req.user!.id, eventType: 'family_collaboration', action: 'invite_family_member', resource: req.params.familyId, outcome: 'success', riskLevel: 'medium' });
      res.status(201).json(member);
    } catch (error) {
      console.error('Error inviting family member:', error);
      if (error instanceof z.ZodError) return res.status(400).json({ message: 'Validation failed', errors: error.errors });
      res.status(500).json({ message: 'Failed to invite member' });
    }
  });

  app.get('/api/families/:familyId/members', requireAuth, verifyFamilyMembership, async (req, res) => {
    try {
      const members = await storage.getFamilyMembers(req.params.familyId);
      complianceMonitor.logEvent({ userId: req.user!.id, eventType: 'data_access', action: 'list_family_members', resource: req.params.familyId, outcome: 'success', riskLevel: 'low' });
      res.json(members);
    } catch (error) {
      console.error('Error fetching family members:', error);
      res.status(500).json({ message: 'Failed to fetch family members' });
    }
  });

  app.post('/api/families/:familyId/members/:memberId/accept', requireAuth, async (req, res) => {
    try {
      const { familyId, memberId } = req.params;
      const member = await storage.acceptFamilyInvitation(memberId, req.user!.id);
      await storage.logFamilyActivity({ familyId, userId: req.user!.id, activityType: 'member_joined', description: 'User accepted invitation and joined the family' });
      complianceMonitor.logEvent({ userId: req.user!.id, eventType: 'family_collaboration', action: 'accept_family_invitation', resource: familyId, outcome: 'success', riskLevel: 'low' });
      res.json(member);
    } catch (error) {
      console.error('Error accepting invitation:', error);
      res.status(500).json({ message: 'Failed to accept invitation' });
    }
  });

  app.patch('/api/families/:familyId/members/:memberId/role', requireAuth, verifyFamilyMembership, async (req, res) => {
    try {
      const { familyId, memberId } = req.params;
      const { role } = req.body;
      if (req.familyMember.role !== 'admin') return res.status(403).json({ message: 'Only admins can update member roles' });
      if (!['admin', 'member', 'viewer'].includes(role)) return res.status(400).json({ message: 'Invalid role. Must be admin, member, or viewer' });
      const updatedMember = await storage.updateMemberRole(memberId, role);
      await storage.logFamilyActivity({ familyId, userId: req.user!.id, activityType: 'member_role_updated', description: `Member role was updated to ${role}` });
      complianceMonitor.logEvent({ userId: req.user!.id, eventType: 'family_collaboration', action: 'update_member_role', resource: familyId, outcome: 'success', riskLevel: 'medium' });
      res.json(updatedMember);
    } catch (error) {
      console.error('Error updating member role:', error);
      res.status(500).json({ message: 'Failed to update member role' });
    }
  });

  app.delete('/api/families/:familyId/members/:memberId', requireAuth, verifyFamilyMembership, async (req, res) => {
    try {
      const { familyId, memberId } = req.params;
      if (req.familyMember.role !== 'admin') return res.status(403).json({ message: 'Only admins can remove members' });
      await storage.removeFamilyMember(memberId);
      await storage.logFamilyActivity({ familyId, userId: req.user!.id, activityType: 'member_removed', description: 'A member was removed from the family' });
      complianceMonitor.logEvent({ userId: req.user!.id, eventType: 'family_collaboration', action: 'remove_family_member', resource: familyId, outcome: 'success', riskLevel: 'medium' });
      res.json({ success: true, message: 'Member removed successfully' });
    } catch (error) {
      console.error('Error removing family member:', error);
      res.status(500).json({ message: 'Failed to remove member' });
    }
  });

  // ── Family Goals ───────────────────────────────────────────────────────────

  app.post('/api/families/:familyId/goals', requireAuth, verifyFamilyMembership, async (req, res) => {
    try {
      if (req.familyMember.role === 'viewer') return res.status(403).json({ message: 'Viewers cannot create goals' });
      const validatedData = insertFamilyGoalSchema.parse({ ...req.body, familyId: req.params.familyId, createdBy: req.user!.id });
      const goal = await storage.createFamilyGoal(validatedData);
      await storage.logFamilyActivity({ familyId: req.params.familyId, userId: req.user!.id, activityType: 'goal_created', description: `New goal "${goal.name}" was created` });
      complianceMonitor.logEvent({ userId: req.user!.id, eventType: 'family_collaboration', action: 'create_family_goal', resource: req.params.familyId, outcome: 'success', riskLevel: 'low' });
      res.status(201).json(goal);
    } catch (error) {
      console.error('Error creating family goal:', error);
      if (error instanceof z.ZodError) return res.status(400).json({ message: 'Validation failed', errors: error.errors });
      res.status(500).json({ message: 'Failed to create goal' });
    }
  });

  app.get('/api/families/:familyId/goals', requireAuth, verifyFamilyMembership, async (req, res) => {
    try {
      const goals = await storage.getFamilyGoals(req.params.familyId);
      complianceMonitor.logEvent({ userId: req.user!.id, eventType: 'data_access', action: 'list_family_goals', resource: req.params.familyId, outcome: 'success', riskLevel: 'low' });
      res.json(goals);
    } catch (error) {
      console.error('Error fetching family goals:', error);
      res.status(500).json({ message: 'Failed to fetch goals' });
    }
  });

  app.post('/api/families/:familyId/goals/:goalId/contribute', requireAuth, verifyFamilyMembership, async (req, res) => {
    try {
      if (req.familyMember.role === 'viewer') return res.status(403).json({ message: 'Viewers cannot contribute to goals' });
      const validatedData = insertFamilyGoalContributionSchema.parse({ ...req.body, goalId: req.params.goalId, userId: req.user!.id });
      const contribution = await storage.addGoalContribution(validatedData);
      await storage.logFamilyActivity({ familyId: req.params.familyId, userId: req.user!.id, activityType: 'goal_contribution', description: `Contributed ₹${validatedData.amount} to a goal` });
      complianceMonitor.logEvent({ userId: req.user!.id, eventType: 'family_collaboration', action: 'add_goal_contribution', resource: req.params.familyId, outcome: 'success', riskLevel: 'low' });
      res.status(201).json(contribution);
    } catch (error) {
      console.error('Error adding goal contribution:', error);
      if (error instanceof z.ZodError) return res.status(400).json({ message: 'Validation failed', errors: error.errors });
      res.status(500).json({ message: 'Failed to add contribution' });
    }
  });

  app.get('/api/families/:familyId/goals/:goalId/contributions', requireAuth, verifyFamilyMembership, async (req, res) => {
    try {
      const contributions = await storage.getGoalContributions(req.params.goalId);
      complianceMonitor.logEvent({ userId: req.user!.id, eventType: 'data_access', action: 'list_goal_contributions', resource: req.params.goalId, outcome: 'success', riskLevel: 'low' });
      res.json(contributions);
    } catch (error) {
      console.error('Error fetching goal contributions:', error);
      res.status(500).json({ message: 'Failed to fetch contributions' });
    }
  });

  // ── Family Dashboard & Activity ────────────────────────────────────────────

  app.get('/api/families/:familyId/dashboard', requireAuth, verifyFamilyMembership, async (req, res) => {
    try {
      const dashboardData = await storage.getFamilyDashboardData(req.params.familyId);
      complianceMonitor.logEvent({ userId: req.user!.id, eventType: 'data_access', action: 'view_family_dashboard', resource: req.params.familyId, outcome: 'success', riskLevel: 'low' });
      res.json(dashboardData);
    } catch (error) {
      console.error('Error fetching family dashboard:', error);
      res.status(500).json({ message: 'Failed to fetch dashboard data' });
    }
  });

  app.get('/api/families/:familyId/activity', requireAuth, verifyFamilyMembership, async (req, res) => {
    try {
      const { limit } = req.query;
      const activities = await storage.getFamilyActivities(req.params.familyId, limit ? parseInt(limit as string) : undefined);
      complianceMonitor.logEvent({ userId: req.user!.id, eventType: 'data_access', action: 'view_family_activity', resource: req.params.familyId, outcome: 'success', riskLevel: 'low' });
      res.json(activities);
    } catch (error) {
      console.error('Error fetching family activity:', error);
      res.status(500).json({ message: 'Failed to fetch activity log' });
    }
  });

  // ── Family Discussions ─────────────────────────────────────────────────────

  app.post('/api/families/:familyId/discussions', requireAuth, verifyFamilyMembership, async (req, res) => {
    try {
      if (req.familyMember.role === 'viewer') return res.status(403).json({ message: 'Viewers cannot create discussions' });
      const validatedData = insertFamilyDiscussionSchema.parse({ ...req.body, familyId: req.params.familyId, authorId: req.user!.id });
      const discussion = await storage.createDiscussion(validatedData);
      await storage.logFamilyActivity({ familyId: req.params.familyId, userId: req.user!.id, activityType: 'discussion_created', description: `Started a new discussion: "${discussion.title}"` });
      complianceMonitor.logEvent({ userId: req.user!.id, eventType: 'family_collaboration', action: 'create_family_discussion', resource: req.params.familyId, outcome: 'success', riskLevel: 'low' });
      res.status(201).json(discussion);
    } catch (error) {
      console.error('Error creating discussion:', error);
      if (error instanceof z.ZodError) return res.status(400).json({ message: 'Validation failed', errors: error.errors });
      res.status(500).json({ message: 'Failed to create discussion' });
    }
  });

  app.get('/api/families/:familyId/discussions', requireAuth, verifyFamilyMembership, async (req, res) => {
    try {
      const discussions = await storage.getFamilyDiscussions(req.params.familyId);
      complianceMonitor.logEvent({ userId: req.user!.id, eventType: 'data_access', action: 'list_family_discussions', resource: req.params.familyId, outcome: 'success', riskLevel: 'low' });
      res.json(discussions);
    } catch (error) {
      console.error('Error fetching family discussions:', error);
      res.status(500).json({ message: 'Failed to fetch discussions' });
    }
  });

  // ── Family Budgets ─────────────────────────────────────────────────────────

  app.post('/api/families/:familyId/budgets', requireAuth, verifyFamilyMembership, async (req, res) => {
    try {
      if (req.familyMember.role !== 'admin') return res.status(403).json({ message: 'Only admins can create budgets' });
      const validatedData = insertFamilyBudgetSchema.parse({ ...req.body, familyId: req.params.familyId, createdBy: req.user!.id });
      const budget = await storage.createFamilyBudget(validatedData);
      await storage.logFamilyActivity({ familyId: req.params.familyId, userId: req.user!.id, activityType: 'budget_created', description: `Created budget for "${budget.category}"` });
      complianceMonitor.logEvent({ userId: req.user!.id, eventType: 'family_collaboration', action: 'create_family_budget', resource: req.params.familyId, outcome: 'success', riskLevel: 'low' });
      res.status(201).json(budget);
    } catch (error) {
      console.error('Error creating budget:', error);
      if (error instanceof z.ZodError) return res.status(400).json({ message: 'Validation failed', errors: error.errors });
      res.status(500).json({ message: 'Failed to create budget' });
    }
  });

  app.get('/api/families/:familyId/budgets', requireAuth, verifyFamilyMembership, async (req, res) => {
    try {
      const budgets = await storage.getFamilyBudgets(req.params.familyId);
      complianceMonitor.logEvent({ userId: req.user!.id, eventType: 'data_access', action: 'list_family_budgets', resource: req.params.familyId, outcome: 'success', riskLevel: 'low' });
      res.json(budgets);
    } catch (error) {
      console.error('Error fetching family budgets:', error);
      res.status(500).json({ message: 'Failed to fetch budgets' });
    }
  });
}
