import { Router, Request, Response } from "express";
import { db } from "../db";
import { investmentProposals, investmentProposalItems, unifiedCartItems, users } from "@shared/schema";
import { eq, and, or, desc, sql } from "drizzle-orm";
import { nanoid } from "nanoid";

const router = Router();

type ProposalSourceType = 'ai_rebalancing' | 'ai_retirement' | 'ai_goals' | 'agent' | 'self' | 'ai' | 'hybrid';

interface UnifiedProposalItem {
  id: string;
  proposalId: string;
  productType: string;
  productId?: string;
  productName: string;
  isin?: string;
  actionType?: 'BUY' | 'SELL' | 'SWITCH' | 'HOLD';
  amount: number;
  units?: number;
  rationale?: string;
  status: string;
}

interface UnifiedProposal {
  id: string;
  clientId: string;
  clientName?: string;
  agentId?: string;
  agentName?: string;
  title: string;
  description?: string;
  proposalSource: ProposalSourceType;
  aiSubSource?: 'rebalancing' | 'retirement' | 'goals';
  status: string;
  totalAmount: number;
  validUntil?: string;
  createdAt: string;
  updatedAt?: string;
  items: UnifiedProposalItem[];
  approvedItemsCount?: number;
  rejectedItemsCount?: number;
  addedToCart?: boolean;
}

function mapProposalSource(source: string, aiSubType?: string): ProposalSourceType {
  if (source === 'ai' && aiSubType) {
    switch (aiSubType) {
      case 'rebalancing': return 'ai_rebalancing';
      case 'retirement': return 'ai_retirement';
      case 'goals': return 'ai_goals';
      default: return 'ai_rebalancing';
    }
  }
  switch (source) {
    case 'ai': return 'ai_rebalancing';
    case 'agent': return 'agent';
    case 'client': return 'self';
    case 'self': return 'self';
    case 'hybrid': return 'agent';
    default: return 'agent';
  }
}

router.get("/", async (req: Request, res: Response) => {
  try {
    const user = req.user as any;
    if (!user) {
      return res.status(401).json({ error: "Authentication required" });
    }

    const proposals = await db
      .select({
        id: investmentProposals.id,
        clientId: investmentProposals.clientId,
        agentId: investmentProposals.agentId,
        title: investmentProposals.title,
        description: investmentProposals.description,
        proposalSource: investmentProposals.proposalSource,
        aiSubType: investmentProposals.aiSubType,
        status: investmentProposals.status,
        totalInvestmentAmount: investmentProposals.totalInvestmentAmount,
        validUntil: investmentProposals.validUntil,
        createdAt: investmentProposals.createdAt,
        updatedAt: investmentProposals.updatedAt,
        addedToCartAt: investmentProposals.addedToCartAt,
      })
      .from(investmentProposals)
      .where(eq(investmentProposals.clientId, user.id))
      .orderBy(desc(investmentProposals.createdAt));

    const result: UnifiedProposal[] = [];

    for (const proposal of proposals) {
      const items = await db
        .select({
          id: investmentProposalItems.id,
          proposalId: investmentProposalItems.proposalId,
          productType: investmentProposalItems.productType,
          productId: investmentProposalItems.productId,
          productName: investmentProposalItems.productName,
          isin: investmentProposalItems.isin,
          actionType: investmentProposalItems.actionType,
          amount: investmentProposalItems.amount,
          units: investmentProposalItems.units,
          rationale: investmentProposalItems.rationale,
          status: investmentProposalItems.status,
        })
        .from(investmentProposalItems)
        .where(eq(investmentProposalItems.proposalId, proposal.id));

      const mappedSource = mapProposalSource(proposal.proposalSource || 'agent', proposal.aiSubType || undefined);
      
      const approvedCount = items.filter((i: any) => i.status === 'approved').length;
      const rejectedCount = items.filter((i: any) => i.status === 'rejected').length;

      result.push({
        id: proposal.id,
        clientId: proposal.clientId || '',
        agentId: proposal.agentId || undefined,
        title: proposal.title || 'Untitled Proposal',
        description: proposal.description || undefined,
        proposalSource: mappedSource,
        aiSubSource: proposal.aiSubType as 'rebalancing' | 'retirement' | 'goals' | undefined,
        status: proposal.status || 'draft',
        totalAmount: Number(proposal.totalInvestmentAmount) || 0,
        validUntil: proposal.validUntil?.toISOString() || undefined,
        createdAt: proposal.createdAt?.toISOString() || new Date().toISOString(),
        updatedAt: proposal.updatedAt?.toISOString() || undefined,
        items: items.map((item: any) => ({
          id: item.id,
          proposalId: item.proposalId,
          productType: item.productType || 'mutual_fund',
          productId: item.productId || undefined,
          productName: item.productName || 'Unknown Product',
          isin: item.isin || undefined,
          actionType: item.actionType as 'BUY' | 'SELL' | 'SWITCH' | 'HOLD' | undefined,
          amount: Number(item.amount) || 0,
          units: item.units ? Number(item.units) : undefined,
          rationale: item.rationale || undefined,
          status: item.status || 'pending',
        })),
        approvedItemsCount: approvedCount,
        rejectedItemsCount: rejectedCount,
        addedToCart: !!proposal.addedToCartAt,
      });
    }

    res.json(result);
  } catch (error) {
    console.error("[Unified Proposals] Error fetching proposals:", error);
    res.status(500).json({ error: "Failed to fetch proposals" });
  }
});

router.get("/:id", async (req: Request, res: Response) => {
  try {
    const user = req.user as any;
    if (!user) {
      return res.status(401).json({ error: "Authentication required" });
    }

    const { id } = req.params;

    const [proposal] = await db
      .select()
      .from(investmentProposals)
      .where(and(
        eq(investmentProposals.id, id),
        eq(investmentProposals.clientId, user.id)
      ));

    if (!proposal) {
      return res.status(404).json({ error: "Proposal not found" });
    }

    const items = await db
      .select()
      .from(investmentProposalItems)
      .where(eq(investmentProposalItems.proposalId, id));

    const mappedSource = mapProposalSource(proposal.proposalSource || 'agent', proposal.aiSubType || undefined);

    res.json({
      ...proposal,
      proposalSource: mappedSource,
      items,
    });
  } catch (error) {
    console.error("[Unified Proposals] Error fetching proposal:", error);
    res.status(500).json({ error: "Failed to fetch proposal" });
  }
});

router.put("/:id/accept", async (req: Request, res: Response) => {
  try {
    const user = req.user as any;
    if (!user) {
      return res.status(401).json({ error: "Authentication required" });
    }

    const { id } = req.params;

    const [proposal] = await db
      .select()
      .from(investmentProposals)
      .where(and(
        eq(investmentProposals.id, id),
        eq(investmentProposals.clientId, user.id)
      ));

    if (!proposal) {
      return res.status(404).json({ error: "Proposal not found" });
    }

    await db
      .update(investmentProposals)
      .set({
        status: 'accepted',
        clientApprovedAt: new Date(),
        updatedAt: new Date(),
      } as any)
      .where(eq(investmentProposals.id, id));

    await db
      .update(investmentProposalItems)
      .set({ status: 'approved' })
      .where(eq(investmentProposalItems.proposalId, id));

    res.json({ success: true, message: "Proposal accepted" });
  } catch (error) {
    console.error("[Unified Proposals] Error accepting proposal:", error);
    res.status(500).json({ error: "Failed to accept proposal" });
  }
});

router.put("/:id/reject", async (req: Request, res: Response) => {
  try {
    const user = req.user as any;
    if (!user) {
      return res.status(401).json({ error: "Authentication required" });
    }

    const { id } = req.params;

    const [proposal] = await db
      .select()
      .from(investmentProposals)
      .where(and(
        eq(investmentProposals.id, id),
        eq(investmentProposals.clientId, user.id)
      ));

    if (!proposal) {
      return res.status(404).json({ error: "Proposal not found" });
    }

    await db
      .update(investmentProposals)
      .set({
        status: 'rejected',
        updatedAt: new Date(),
      })
      .where(eq(investmentProposals.id, id));

    await db
      .update(investmentProposalItems)
      .set({ status: 'rejected' })
      .where(eq(investmentProposalItems.proposalId, id));

    res.json({ success: true, message: "Proposal rejected" });
  } catch (error) {
    console.error("[Unified Proposals] Error rejecting proposal:", error);
    res.status(500).json({ error: "Failed to reject proposal" });
  }
});

router.post("/:id/add-to-cart", async (req: Request, res: Response) => {
  try {
    const user = req.user as any;
    if (!user) {
      return res.status(401).json({ error: "Authentication required" });
    }

    const { id } = req.params;
    const { orderType = 'LUMPSUM' } = req.body;

    const [proposal] = await db
      .select()
      .from(investmentProposals)
      .where(and(
        eq(investmentProposals.id, id),
        eq(investmentProposals.clientId, user.id)
      ));

    if (!proposal) {
      return res.status(404).json({ error: "Proposal not found" });
    }

    if (proposal.status !== 'accepted') {
      return res.status(400).json({ error: "Proposal must be accepted before adding to cart" });
    }

    const items = await db
      .select()
      .from(investmentProposalItems)
      .where(and(
        eq(investmentProposalItems.proposalId, id),
        eq(investmentProposalItems.status, 'approved')
      ));

    if (items.length === 0) {
      return res.status(400).json({ error: "No approved items to add to cart" });
    }

    for (const item of items) {
      const cartItemId = nanoid();
      await db.insert(unifiedCartItems).values({
        id: cartItemId,
        userId: user.id,
        productCategory: item.productType || 'mutual_fund',
        source: proposal.proposalSource === 'ai' ? 'ai' : proposal.proposalSource === 'agent' ? 'agent' : 'client',
        sourceProposalId: id,
        amount: String(item.amount || 0),
        quantity: 1,
        displayName: item.productName || 'Investment Item',
        metadata: {
          proposalItemId: item.id,
          orderType: orderType,
          productId: item.productId,
          isin: item.isin,
        },
      } as any);
    }

    await db
      .update(investmentProposals)
      .set({
        addedToCartAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(investmentProposals.id, id));

    res.json({ success: true, message: "Items added to cart", itemsAdded: items.length });
  } catch (error) {
    console.error("[Unified Proposals] Error adding to cart:", error);
    res.status(500).json({ error: "Failed to add to cart" });
  }
});

router.get("/by-category/:category", async (req: Request, res: Response) => {
  try {
    const user = req.user as any;
    if (!user) {
      return res.status(401).json({ error: "Authentication required" });
    }

    const { category } = req.params;

    const proposals = await db
      .select({
        id: investmentProposals.id,
        clientId: investmentProposals.clientId,
        title: investmentProposals.title,
        proposalSource: investmentProposals.proposalSource,
        aiSubType: investmentProposals.aiSubType,
        status: investmentProposals.status,
        createdAt: investmentProposals.createdAt,
        addedToCartAt: investmentProposals.addedToCartAt,
      })
      .from(investmentProposals)
      .where(eq(investmentProposals.clientId, user.id))
      .orderBy(desc(investmentProposals.createdAt));

    const result = [];

    for (const proposal of proposals) {
      const items = await db
        .select()
        .from(investmentProposalItems)
        .where(and(
          eq(investmentProposalItems.proposalId, proposal.id),
          eq(investmentProposalItems.productType, category)
        ));

      if (items.length > 0) {
        const mappedSource = mapProposalSource(proposal.proposalSource || 'agent', proposal.aiSubType || undefined);
        
        result.push({
          id: proposal.id,
          title: proposal.title,
          proposalSource: mappedSource,
          status: proposal.status,
          createdAt: proposal.createdAt?.toISOString(),
          addedToCart: !!proposal.addedToCartAt,
          items: items.map((item: any) => ({
            id: item.id,
            productType: item.productType,
            productName: item.productName,
            amount: Number(item.amount) || 0,
            actionType: item.actionType,
            status: item.status,
          })),
          categoryTotal: items.reduce((sum: any, item: any) => sum + (Number(item.amount) || 0), 0),
        });
      }
    }

    res.json(result);
  } catch (error) {
    console.error("[Unified Proposals] Error fetching category proposals:", error);
    res.status(500).json({ error: "Failed to fetch category proposals" });
  }
});

export default router;
