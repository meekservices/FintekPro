import { db } from "../db";
import { partners } from "@shared/schema";
import { sql, isNull, isNotNull } from "drizzle-orm";

interface IntegrityIssue {
  type: "CYCLE" | "ORPHAN" | "DEPTH_VIOLATION";
  partnerId: string;
  details: string;
  severity: "HIGH" | "MEDIUM" | "LOW";
}

export async function detectCycles(): Promise<IntegrityIssue[]> {
  const issues: IntegrityIssue[] = [];
  try {
    const result = await db.execute(sql`
      WITH RECURSIVE cycle_check AS (
        SELECT id, parent_partner_id, ARRAY[id] as path, false as is_cycle
        FROM partners
        WHERE parent_partner_id IS NOT NULL
        
        UNION ALL
        
        SELECT p.id, p.parent_partner_id, cc.path || p.id,
               p.id = ANY(cc.path) as is_cycle
        FROM partners p
        INNER JOIN cycle_check cc ON cc.parent_partner_id = p.id
        WHERE NOT cc.is_cycle AND array_length(cc.path, 1) < 20
      )
      SELECT DISTINCT path[1] as partner_id
      FROM cycle_check
      WHERE is_cycle = true
    `);
    const rows = (result as any).rows || result;
    if (rows) {
      for (const row of rows) {
        issues.push({
          type: "CYCLE",
          partnerId: row.partner_id,
          details: `Circular reference detected in partner hierarchy`,
          severity: "HIGH",
        });
      }
    }
  } catch (error) {
    console.error("[HierarchyValidator] Error detecting cycles:", error);
  }
  return issues;
}

export async function detectOrphans(): Promise<IntegrityIssue[]> {
  const issues: IntegrityIssue[] = [];
  try {
    const result = await db.execute(sql`
      SELECT p.id, p.company_name, p.parent_partner_id
      FROM partners p
      WHERE p.parent_partner_id IS NOT NULL
        AND NOT EXISTS (
          SELECT 1 FROM partners parent WHERE parent.id = p.parent_partner_id
        )
    `);
    const rows = (result as any).rows || result;
    if (rows) {
      for (const row of rows) {
        issues.push({
          type: "ORPHAN",
          partnerId: row.id,
          details: `Partner "${row.company_name}" references non-existent parent: ${row.parent_partner_id}`,
          severity: "MEDIUM",
        });
      }
    }
  } catch (error) {
    console.error("[HierarchyValidator] Error detecting orphans:", error);
  }
  return issues;
}

export async function detectDepthViolations(): Promise<IntegrityIssue[]> {
  const issues: IntegrityIssue[] = [];
  try {
    const result = await db.execute(sql`
      WITH RECURSIVE depth_check AS (
        SELECT id, company_name, parent_partner_id, max_depth, 1 as depth
        FROM partners
        WHERE parent_partner_id IS NULL
        
        UNION ALL
        
        SELECT p.id, p.company_name, p.parent_partner_id, p.max_depth, dc.depth + 1
        FROM partners p
        INNER JOIN depth_check dc ON p.parent_partner_id = dc.id
        WHERE dc.depth < 20
      )
      SELECT id, company_name, depth, COALESCE(max_depth, 5) as max_depth
      FROM depth_check
      WHERE depth > COALESCE(max_depth, 5)
    `);
    const rows = (result as any).rows || result;
    if (rows) {
      for (const row of rows) {
        issues.push({
          type: "DEPTH_VIOLATION",
          partnerId: row.id,
          details: `Partner "${row.company_name}" at depth ${row.depth} exceeds max depth ${row.max_depth}`,
          severity: "LOW",
        });
      }
    }
  } catch (error) {
    console.error("[HierarchyValidator] Error detecting depth violations:", error);
  }
  return issues;
}

export async function runFullIntegrityCheck(): Promise<{
  issues: IntegrityIssue[];
  summary: { cycles: number; orphans: number; depthViolations: number; total: number };
}> {
  const [cycles, orphans, depthViolations] = await Promise.all([
    detectCycles(),
    detectOrphans(),
    detectDepthViolations(),
  ]);

  const issues = [...cycles, ...orphans, ...depthViolations];
  return {
    issues,
    summary: {
      cycles: cycles.length,
      orphans: orphans.length,
      depthViolations: depthViolations.length,
      total: issues.length,
    },
  };
}
