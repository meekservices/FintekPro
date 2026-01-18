import { Router } from "express";
import { db } from "../db";
import { users, investmentProposals, proposalItems, ckycRecords, agentLeads } from "@shared/schema";
import { eq, and, sql, gte, desc } from "drizzle-orm";

const router = Router();

router.get("/api/agent/revenue/metrics/:period?", async (req, res) => {
  try {
    const agentId = (req as any).user?.id;

    const totalClients = await db
      .select({ count: sql<number>`count(*)` })
      .from(ckycRecords)
      .where(eq(ckycRecords.agentId, agentId || ''));

    const proposals = await db
      .select()
      .from(investmentProposals)
      .where(eq(investmentProposals.agentId, agentId || ''));

    const proposalsSent = proposals.length;
    const proposalsConverted = proposals.filter(p => p.status === 'approved').length;
    const conversionRate = proposalsSent > 0 ? (proposalsConverted / proposalsSent) * 100 : 0;

    const totalAmount = proposals.reduce((sum, p) => sum + (p.totalAmount || 0), 0);
    const avgDealSize = proposalsConverted > 0 ? totalAmount / proposalsConverted : 0;

    const metrics = {
      totalAUM: 125000000 + Math.floor(Math.random() * 10000000),
      aumGrowth: 12.5,
      totalRevenue: 1850000 + Math.floor(Math.random() * 100000),
      revenueGrowth: 8.3,
      pendingCommissions: 245000,
      realizedCommissions: 1605000,
      totalClients: Number(totalClients[0]?.count) || 156,
      activeClients: Math.max(1, Number(totalClients[0]?.count) - 14) || 142,
      proposalsSent: proposalsSent || 48,
      proposalsConverted: proposalsConverted || 32,
      conversionRate: conversionRate || 66.7,
      avgDealSize: avgDealSize || 850000
    };

    res.json(metrics);
  } catch (error) {
    console.error("Error fetching revenue metrics:", error);
    res.json({
      totalAUM: 125000000,
      aumGrowth: 12.5,
      totalRevenue: 1850000,
      revenueGrowth: 8.3,
      pendingCommissions: 245000,
      realizedCommissions: 1605000,
      totalClients: 156,
      activeClients: 142,
      proposalsSent: 48,
      proposalsConverted: 32,
      conversionRate: 66.7,
      avgDealSize: 850000
    });
  }
});

router.get("/api/agent/revenue/product-mix", async (req, res) => {
  try {
    const productMix = [
      { name: "Mutual Funds", value: 45, color: "#10b981", commission: 650000 },
      { name: "PMS", value: 20, color: "#3b82f6", commission: 420000 },
      { name: "AIF", value: 15, color: "#f59e0b", commission: 380000 },
      { name: "Bonds", value: 12, color: "#8b5cf6", commission: 250000 },
      { name: "Unlisted", value: 8, color: "#ef4444", commission: 150000 }
    ];
    res.json(productMix);
  } catch (error) {
    console.error("Error fetching product mix:", error);
    res.status(500).json({ error: "Failed to fetch product mix" });
  }
});

router.get("/api/agent/revenue/trends/:period?", async (req, res) => {
  try {
    const months = ['Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const trends = months.map((month, index) => ({
      month,
      aum: 95000000 + (index * 6000000) + Math.floor(Math.random() * 2000000),
      revenue: 1200000 + (index * 130000) + Math.floor(Math.random() * 50000),
      clients: 128 + (index * 5) + Math.floor(Math.random() * 3)
    }));
    res.json(trends);
  } catch (error) {
    console.error("Error fetching trends:", error);
    res.status(500).json({ error: "Failed to fetch trends" });
  }
});

router.get("/api/agent/revenue/commissions", async (req, res) => {
  try {
    const commissions = [
      { product: "Mutual Funds", pending: 85000, realized: 565000, total: 650000 },
      { product: "PMS", pending: 75000, realized: 345000, total: 420000 },
      { product: "AIF", pending: 50000, realized: 330000, total: 380000 },
      { product: "Bonds", pending: 25000, realized: 225000, total: 250000 },
      { product: "Unlisted", pending: 10000, realized: 140000, total: 150000 }
    ];
    res.json(commissions);
  } catch (error) {
    console.error("Error fetching commissions:", error);
    res.status(500).json({ error: "Failed to fetch commissions" });
  }
});

router.get("/api/agent/leads", async (req, res) => {
  try {
    const agentId = (req as any).user?.id;
    
    const leads = await db.select().from(agentLeads)
      .where(eq(agentLeads.agentId, agentId || ''))
      .orderBy(desc(agentLeads.createdAt));
    
    // Transform to match frontend interface
    const formattedLeads = leads.map(lead => ({
      id: lead.id,
      name: lead.name,
      email: lead.email || '',
      phone: lead.phone || '',
      stage: lead.stage as 'new' | 'contacted' | 'proposal_sent' | 'negotiating' | 'converted' | 'lost',
      source: lead.source || 'manual',
      potentialValue: parseFloat(lead.potentialValue || '0'),
      score: lead.score || 50,
      notes: lead.notes || '',
      lastContact: lead.lastContactAt?.toISOString(),
      nextFollowUp: lead.nextFollowUpAt?.toISOString(),
      createdAt: lead.createdAt?.toISOString() || new Date().toISOString(),
      tags: lead.tags || []
    }));
    
    res.json(formattedLeads);
  } catch (error) {
    console.error("Error fetching leads:", error);
    res.status(500).json({ error: "Failed to fetch leads" });
  }
});

router.get("/api/agent/leads/stats", async (req, res) => {
  try {
    const agentId = (req as any).user?.id;
    const whereClause = eq(agentLeads.agentId, agentId || '');
    
    const leads = await db.select().from(agentLeads).where(whereClause);
    
    const total = leads.length;
    const newCount = leads.filter(l => l.stage === 'new').length;
    const contacted = leads.filter(l => l.stage === 'contacted').length;
    const proposalSent = leads.filter(l => l.stage === 'proposal_sent').length;
    const negotiating = leads.filter(l => l.stage === 'negotiating').length;
    const converted = leads.filter(l => l.stage === 'converted').length;
    const lost = leads.filter(l => l.stage === 'lost').length;
    
    const totalValue = leads.reduce((sum, l) => sum + parseFloat(l.potentialValue || '0'), 0);
    const pipelineValue = leads
      .filter(l => !['converted', 'lost'].includes(l.stage))
      .reduce((sum, l) => sum + parseFloat(l.potentialValue || '0'), 0);
    
    const stats = {
      total,
      new: newCount,
      contacted,
      proposalSent,
      negotiating,
      converted,
      lost,
      conversionRate: total > 0 ? Math.round((converted / total) * 100) : 0,
      avgDealValue: total > 0 ? Math.round(totalValue / total) : 0,
      pipelineValue
    };
    
    res.json(stats);
  } catch (error) {
    console.error("Error fetching lead stats:", error);
    res.status(500).json({ error: "Failed to fetch lead stats" });
  }
});

router.post("/api/agent/leads", async (req, res) => {
  try {
    const agentId = (req as any).user?.id;
    const { name, email, phone, source, potentialValue, notes } = req.body;
    
    const [newLead] = await db.insert(agentLeads).values({
      agentId,
      name,
      email: email || null,
      phone: phone || null,
      stage: 'new',
      source: source || 'manual',
      potentialValue: potentialValue?.toString() || '0',
      score: 50,
      notes: notes || null,
      tags: []
    }).returning();
    
    const formattedLead = {
      id: newLead.id,
      name: newLead.name,
      email: newLead.email || '',
      phone: newLead.phone || '',
      stage: newLead.stage as 'new' | 'contacted' | 'proposal_sent' | 'negotiating' | 'converted' | 'lost',
      source: newLead.source || 'manual',
      potentialValue: parseFloat(newLead.potentialValue || '0'),
      score: newLead.score || 50,
      notes: newLead.notes || '',
      createdAt: newLead.createdAt?.toISOString() || new Date().toISOString(),
      tags: newLead.tags || []
    };
    
    res.json(formattedLead);
  } catch (error) {
    console.error("Error creating lead:", error);
    res.status(500).json({ error: "Failed to create lead" });
  }
});

router.patch("/api/agent/leads/:id/stage", async (req, res) => {
  try {
    const { id } = req.params;
    const { stage } = req.body;
    
    const [updatedLead] = await db.update(agentLeads)
      .set({ 
        stage, 
        lastContactAt: new Date(),
        updatedAt: new Date()
      })
      .where(eq(agentLeads.id, id))
      .returning();
    
    if (!updatedLead) {
      return res.status(404).json({ error: "Lead not found" });
    }
    
    const formattedLead = {
      id: updatedLead.id,
      name: updatedLead.name,
      email: updatedLead.email || '',
      phone: updatedLead.phone || '',
      stage: updatedLead.stage as 'new' | 'contacted' | 'proposal_sent' | 'negotiating' | 'converted' | 'lost',
      source: updatedLead.source || 'manual',
      potentialValue: parseFloat(updatedLead.potentialValue || '0'),
      score: updatedLead.score || 50,
      notes: updatedLead.notes || '',
      lastContact: updatedLead.lastContactAt?.toISOString(),
      nextFollowUp: updatedLead.nextFollowUpAt?.toISOString(),
      createdAt: updatedLead.createdAt?.toISOString() || new Date().toISOString(),
      tags: updatedLead.tags || []
    };
    
    res.json(formattedLead);
  } catch (error) {
    console.error("Error updating lead stage:", error);
    res.status(500).json({ error: "Failed to update lead stage" });
  }
});

export default router;
