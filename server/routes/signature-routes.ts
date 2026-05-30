import { Router } from 'express';
import { z } from 'zod';
import { db } from '../db';
import { userSignatures, insertUserSignatureSchema } from '@shared/schema';
import { eq, and, desc } from 'drizzle-orm';
import { isAuthenticated } from '../auth-setup';

const router = Router();

router.get('/api/user/signatures', isAuthenticated, async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    const signatures = await db
      .select()
      .from(userSignatures)
      .where(eq(userSignatures.userId, userId))
      .orderBy(desc(userSignatures.createdAt));

    res.json({ success: true, signatures });
  } catch (error) {
    console.error('[Signatures] Error fetching signatures:', error);
    res.status(500).json({ error: 'Failed to fetch signatures' });
  }
});

router.get('/api/user/signatures/default', isAuthenticated, async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    const [defaultSignature] = await db
      .select()
      .from(userSignatures)
      .where(and(
        eq(userSignatures.userId, userId),
        eq(userSignatures.isDefault, true)
      ))
      .limit(1);

    res.json({ success: true, signature: defaultSignature || null });
  } catch (error) {
    console.error('[Signatures] Error fetching default signature:', error);
    res.status(500).json({ error: 'Failed to fetch default signature' });
  }
});

router.post('/api/user/signatures', isAuthenticated, async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    const createSchema = insertUserSignatureSchema.extend({
      name: z.string().min(1).max(100),
      signatureType: z.enum(['upload', 'draw', 'type']),
      signatureDataUrl: z.string().min(1),
      setAsDefault: z.boolean().optional(),
    });

    const validated = createSchema.parse(req.body);
    const { setAsDefault, ...signatureData } = validated;

    if (setAsDefault) {
      await db
        .update(userSignatures)
        .set({ isDefault: false })
        .where(eq(userSignatures.userId, userId));
    }

    const [newSignature] = await db
      .insert(userSignatures)
      .values({
        ...signatureData,
        userId,
        isDefault: setAsDefault || false,
      })
      .returning();

    res.json({ success: true, signature: newSignature });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Invalid signature data', details: error.issues });
    }
    console.error('[Signatures] Error creating signature:', error);
    res.status(500).json({ error: 'Failed to create signature' });
  }
});

router.patch('/api/user/signatures/:id', isAuthenticated, async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    const { id } = req.params;

    const [existing] = await db
      .select()
      .from(userSignatures)
      .where(and(
        eq(userSignatures.id, id),
        eq(userSignatures.userId, userId)
      ))
      .limit(1);

    if (!existing) {
      return res.status(404).json({ error: 'Signature not found' });
    }

    const updateSchema = z.object({
      name: z.string().min(1).max(100).optional(),
      isDefault: z.boolean().optional(),
    });

    const validated = updateSchema.parse(req.body);

    if (validated.isDefault) {
      await db
        .update(userSignatures)
        .set({ isDefault: false })
        .where(eq(userSignatures.userId, userId));
    }

    const [updated] = await db
      .update(userSignatures)
      .set({
        ...validated,
        updatedAt: new Date(),
      })
      .where(eq(userSignatures.id, id))
      .returning();

    res.json({ success: true, signature: updated });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Invalid update data', details: error.issues });
    }
    console.error('[Signatures] Error updating signature:', error);
    res.status(500).json({ error: 'Failed to update signature' });
  }
});

router.delete('/api/user/signatures/:id', isAuthenticated, async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    const { id } = req.params;

    const [existing] = await db
      .select()
      .from(userSignatures)
      .where(and(
        eq(userSignatures.id, id),
        eq(userSignatures.userId, userId)
      ))
      .limit(1);

    if (!existing) {
      return res.status(404).json({ error: 'Signature not found' });
    }

    await db
      .delete(userSignatures)
      .where(eq(userSignatures.id, id));

    res.json({ success: true, message: 'Signature deleted' });
  } catch (error) {
    console.error('[Signatures] Error deleting signature:', error);
    res.status(500).json({ error: 'Failed to delete signature' });
  }
});

router.post('/api/user/signatures/:id/set-default', isAuthenticated, async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    const { id } = req.params;

    const [existing] = await db
      .select()
      .from(userSignatures)
      .where(and(
        eq(userSignatures.id, id),
        eq(userSignatures.userId, userId)
      ))
      .limit(1);

    if (!existing) {
      return res.status(404).json({ error: 'Signature not found' });
    }

    await db
      .update(userSignatures)
      .set({ isDefault: false })
      .where(eq(userSignatures.userId, userId));

    await db
      .update(userSignatures)
      .set({ isDefault: true, updatedAt: new Date() })
      .where(eq(userSignatures.id, id));

    res.json({ success: true, message: 'Default signature updated' });
  } catch (error) {
    console.error('[Signatures] Error setting default signature:', error);
    res.status(500).json({ error: 'Failed to set default signature' });
  }
});

export default router;
