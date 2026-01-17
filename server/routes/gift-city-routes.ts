import { Router, Request, Response } from "express";
import { db } from "../db";
import { giftCityProducts, insertGiftCityProductSchema } from "@shared/schema";
import { eq, ilike, or, and, desc, sql } from "drizzle-orm";

const router = Router();

router.get("/admin", async (req: Request, res: Response) => {
  try {
    const products = await db
      .select()
      .from(giftCityProducts)
      .orderBy(desc(giftCityProducts.createdAt));
    
    res.json({ products });
  } catch (error) {
    console.error("Error fetching Gift City products:", error);
    res.status(500).json({ error: "Failed to fetch products" });
  }
});

router.get("/", async (req: Request, res: Response) => {
  try {
    const { category, search } = req.query;
    
    let conditions = [eq(giftCityProducts.isPublished, true)];
    
    if (category && category !== "all") {
      conditions.push(eq(giftCityProducts.category, category as string));
    }
    
    if (search) {
      conditions.push(
        or(
          ilike(giftCityProducts.name, `%${search}%`),
          ilike(giftCityProducts.provider, `%${search}%`),
          ilike(giftCityProducts.category, `%${search}%`)
        ) as any
      );
    }
    
    const products = await db
      .select()
      .from(giftCityProducts)
      .where(and(...conditions))
      .orderBy(desc(giftCityProducts.createdAt));
    
    res.json({ products });
  } catch (error) {
    console.error("Error fetching Gift City products:", error);
    res.status(500).json({ error: "Failed to fetch products" });
  }
});

router.post("/admin", async (req: Request, res: Response) => {
  try {
    const validation = insertGiftCityProductSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({ error: validation.error.errors });
    }

    const [product] = await db
      .insert(giftCityProducts)
      .values(validation.data)
      .returning();

    res.status(201).json({ product });
  } catch (error) {
    console.error("Error creating Gift City product:", error);
    res.status(500).json({ error: "Failed to create product" });
  }
});

router.put("/admin/:id", async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const updateData = { ...req.body, updatedAt: new Date() };
    delete updateData.id;
    delete updateData.createdAt;

    const [product] = await db
      .update(giftCityProducts)
      .set(updateData)
      .where(eq(giftCityProducts.id, id))
      .returning();

    if (!product) {
      return res.status(404).json({ error: "Product not found" });
    }

    res.json({ product });
  } catch (error) {
    console.error("Error updating Gift City product:", error);
    res.status(500).json({ error: "Failed to update product" });
  }
});

router.patch("/admin/:id", async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const updateData = { ...req.body, updatedAt: new Date() };

    const [product] = await db
      .update(giftCityProducts)
      .set(updateData)
      .where(eq(giftCityProducts.id, id))
      .returning();

    if (!product) {
      return res.status(404).json({ error: "Product not found" });
    }

    res.json({ product });
  } catch (error) {
    console.error("Error updating Gift City product:", error);
    res.status(500).json({ error: "Failed to update product" });
  }
});

router.delete("/admin/:id", async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const [product] = await db
      .delete(giftCityProducts)
      .where(eq(giftCityProducts.id, id))
      .returning();

    if (!product) {
      return res.status(404).json({ error: "Product not found" });
    }

    res.json({ success: true });
  } catch (error) {
    console.error("Error deleting Gift City product:", error);
    res.status(500).json({ error: "Failed to delete product" });
  }
});

router.get("/categories", async (req: Request, res: Response) => {
  try {
    const result = await db
      .selectDistinct({ category: giftCityProducts.category })
      .from(giftCityProducts)
      .where(eq(giftCityProducts.isPublished, true));

    res.json({ categories: result.map(r => r.category) });
  } catch (error) {
    console.error("Error fetching categories:", error);
    res.status(500).json({ error: "Failed to fetch categories" });
  }
});

export default router;
