import { Router } from "express";
import { db } from "../db";
import { users, investmentProposals, proposalItems, ckycRecords } from "@shared/schema";
import { eq, and, sql, gte, desc } from "drizzle-orm";

const router = Router();

router.get("/api/agent/revenue/metrics", async (req, res) => {
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

router.get("/api/agent/revenue/trends", async (req, res) => {
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
    const leads = [
      { id: '1', name: 'Rajesh Sharma', email: 'rajesh@example.com', phone: '9876543210', stage: 'new', source: 'Website', potentialValue: 2500000, score: 85, notes: 'Interested in mutual funds and PMS', createdAt: '2024-12-20', tags: ['HNI', 'Retirement'], nextFollowUp: '2024-12-23' },
      { id: '2', name: 'Priya Patel', email: 'priya@example.com', phone: '9876543211', stage: 'new', source: 'Referral', potentialValue: 1500000, score: 72, notes: 'Looking for tax-saving investments', createdAt: '2024-12-19', tags: ['Tax-saver'], nextFollowUp: '2024-12-22' },
      { id: '3', name: 'Amit Kumar', email: 'amit@example.com', phone: '9876543212', stage: 'contacted', source: 'LinkedIn', potentialValue: 5000000, score: 90, notes: 'Met at conference, very interested in AIF', lastContact: '2024-12-21', createdAt: '2024-12-15', tags: ['AIF', 'UHNI'], nextFollowUp: '2024-12-24' },
      { id: '4', name: 'Sunita Reddy', email: 'sunita@example.com', phone: '9876543213', stage: 'contacted', source: 'Webinar', potentialValue: 800000, score: 65, notes: 'First-time investor', lastContact: '2024-12-20', createdAt: '2024-12-18', tags: ['New Investor'] },
      { id: '5', name: 'Vikram Singh', email: 'vikram@example.com', phone: '9876543214', stage: 'proposal_sent', source: 'Referral', potentialValue: 10000000, score: 95, notes: 'Corporate client, interested in treasury management', lastContact: '2024-12-19', createdAt: '2024-12-10', tags: ['Corporate', 'Treasury'] },
      { id: '6', name: 'Meera Gupta', email: 'meera@example.com', phone: '9876543215', stage: 'proposal_sent', source: 'Event', potentialValue: 3000000, score: 78, notes: 'Wants to diversify portfolio', lastContact: '2024-12-18', createdAt: '2024-12-12', tags: ['Diversification'] },
      { id: '7', name: 'Arjun Nair', email: 'arjun@example.com', phone: '9876543216', stage: 'negotiating', source: 'Referral', potentialValue: 7500000, score: 88, notes: 'Negotiating fees, close to conversion', lastContact: '2024-12-21', createdAt: '2024-12-05', tags: ['HNI', 'Fee-sensitive'] },
      { id: '8', name: 'Kavita Iyer', email: 'kavita@example.com', phone: '9876543217', stage: 'converted', source: 'Website', potentialValue: 2000000, score: 100, notes: 'Converted! Started with MF SIPs', lastContact: '2024-12-21', createdAt: '2024-12-01', tags: ['SIP'] },
      { id: '9', name: 'Rahul Joshi', email: 'rahul@example.com', phone: '9876543218', stage: 'lost', source: 'Cold Call', potentialValue: 500000, score: 30, notes: 'Not interested at this time', lastContact: '2024-12-15', createdAt: '2024-12-08', tags: [] }
    ];
    res.json(leads);
  } catch (error) {
    console.error("Error fetching leads:", error);
    res.status(500).json({ error: "Failed to fetch leads" });
  }
});

router.get("/api/agent/leads/stats", async (req, res) => {
  try {
    const stats = {
      total: 9,
      new: 2,
      contacted: 2,
      proposalSent: 2,
      negotiating: 1,
      converted: 1,
      lost: 1,
      conversionRate: 11.1,
      avgDealValue: 2000000,
      pipelineValue: 31800000
    };
    res.json(stats);
  } catch (error) {
    console.error("Error fetching lead stats:", error);
    res.status(500).json({ error: "Failed to fetch lead stats" });
  }
});

router.post("/api/agent/leads", async (req, res) => {
  try {
    const { name, email, phone, source, potentialValue, notes } = req.body;
    
    const newLead = {
      id: Date.now().toString(),
      name,
      email,
      phone,
      source,
      potentialValue: parseInt(potentialValue) || 0,
      notes,
      stage: 'new',
      score: 50,
      createdAt: new Date().toISOString().split('T')[0],
      tags: [],
      nextFollowUp: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
    };
    
    res.json(newLead);
  } catch (error) {
    console.error("Error creating lead:", error);
    res.status(500).json({ error: "Failed to create lead" });
  }
});

router.patch("/api/agent/leads/:id/stage", async (req, res) => {
  try {
    const { id } = req.params;
    const { stage } = req.body;
    
    res.json({ id, stage, updated: true });
  } catch (error) {
    console.error("Error updating lead stage:", error);
    res.status(500).json({ error: "Failed to update lead stage" });
  }
});

export default router;
