import { db } from "../db";
import { users } from "@shared/schema";
import { sql, or, and, ne, isNotNull } from "drizzle-orm";

// Levenshtein distance for fuzzy string matching
function levenshteinDistance(str1: string, str2: string): number {
  const s1 = str1.toLowerCase().trim();
  const s2 = str2.toLowerCase().trim();
  
  const matrix: number[][] = [];
  
  for (let i = 0; i <= s2.length; i++) {
    matrix[i] = [i];
  }
  
  for (let j = 0; j <= s1.length; j++) {
    matrix[0][j] = j;
  }
  
  for (let i = 1; i <= s2.length; i++) {
    for (let j = 1; j <= s1.length; j++) {
      if (s2.charAt(i - 1) === s1.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j] + 1
        );
      }
    }
  }
  
  return matrix[s2.length][s1.length];
}

// Calculate similarity percentage (0-100)
function calculateSimilarity(str1: string, str2: string): number {
  if (!str1 || !str2) return 0;
  
  const distance = levenshteinDistance(str1, str2);
  const maxLength = Math.max(str1.length, str2.length);
  
  if (maxLength === 0) return 100;
  
  return ((maxLength - distance) / maxLength) * 100;
}

// Check if two names are similar
function areNamesSimilar(firstName1: string | null, lastName1: string | null, 
                         firstName2: string | null, lastName2: string | null): {
  similar: boolean;
  similarity: number;
} {
  const fullName1 = `${firstName1 || ''} ${lastName1 || ''}`.trim();
  const fullName2 = `${firstName2 || ''} ${lastName2 || ''}`.trim();
  
  if (!fullName1 || !fullName2) {
    return { similar: false, similarity: 0 };
  }
  
  const similarity = calculateSimilarity(fullName1, fullName2);
  
  return {
    similar: similarity >= 80, // 80% similarity threshold
    similarity: Math.round(similarity)
  };
}

export type DuplicateRiskLevel = 'high' | 'medium' | 'low';

export interface DuplicateUser {
  id: string;
  userId: string;
  email: string | null;
  mobile: string | null;
  firstName: string | null;
  lastName: string | null;
  panNumber: string | null;
  createdAt: Date | null;
}

export interface DuplicateMatch {
  user1: DuplicateUser;
  user2: DuplicateUser;
  riskLevel: DuplicateRiskLevel;
  riskScore: number;
  reasons: string[];
  nameSimilarity: number;
  autoMergeRecommended: boolean;
  // Boolean flags for easy filtering
  panNumberMatch: boolean;
  emailMatch: boolean;
  mobileMatch: boolean;
}

export class DuplicateDetectionService {
  
  /**
   * Check if a user with given details might be a duplicate
   */
  async checkForDuplicates(params: {
    email?: string;
    mobile?: string;
    panNumber?: string;
    firstName?: string;
    lastName?: string;
    excludeUserId?: string;
  }): Promise<DuplicateMatch[]> {
    const { email, mobile, panNumber, firstName, lastName, excludeUserId } = params;
    
    // Build conditions for potential duplicates
    const conditions = [];
    
    if (panNumber) {
      conditions.push(sql`${users.panNumber} = ${panNumber}`);
    }
    
    if (email) {
      conditions.push(sql`${users.email} = ${email}`);
    }
    
    if (mobile) {
      conditions.push(sql`${users.mobile} = ${mobile}`);
    }
    
    if (conditions.length === 0) {
      return [];
    }
    
    // Find potential duplicates
    const baseCondition = or(...conditions);
    const whereClause = excludeUserId 
      ? and(baseCondition, ne(users.id, excludeUserId))
      : baseCondition;
    
    const query = db
      .select({
        id: users.id,
        userId: users.userId,
        email: users.email,
        mobile: users.mobile,
        firstName: users.firstName,
        lastName: users.lastName,
        panNumber: users.panNumber,
        createdAt: users.createdAt,
      })
      .from(users)
      .where(whereClause);
    
    const potentialDuplicates = await query;
    
    if (potentialDuplicates.length === 0) {
      return [];
    }
    
    // Analyze each potential duplicate
    const matches: DuplicateMatch[] = [];
    const currentUser: DuplicateUser = {
      id: excludeUserId || '',
      userId: '',
      email: email || null,
      mobile: mobile || null,
      firstName: firstName || null,
      lastName: lastName || null,
      panNumber: panNumber || null,
      createdAt: null,
    };
    
    for (const duplicate of potentialDuplicates) {
      const analysis = this.analyzeDuplicate(currentUser, duplicate);
      matches.push(analysis);
    }
    
    // Sort by risk score (highest first)
    return matches.sort((a, b) => b.riskScore - a.riskScore);
  }
  
  /**
   * Find all duplicate pairs in the database using SQL-based approach
   */
  async findAllDuplicates(): Promise<DuplicateMatch[]> {
    // Use SQL to find duplicates efficiently - find users sharing email, mobile, or PAN
    const duplicatePairs = await db.execute<{
      id1: string;
      userId1: string;
      email1: string | null;
      mobile1: string | null;
      firstName1: string | null;
      lastName1: string | null;
      panNumber1: string | null;
      createdAt1: string | null;
      id2: string;
      userId2: string;
      email2: string | null;
      mobile2: string | null;
      firstName2: string | null;
      lastName2: string | null;
      panNumber2: string | null;
      createdAt2: string | null;
      matchType: string;
    }>(sql`
      WITH duplicate_candidates AS (
        -- Find users sharing email
        SELECT 
          u1.id as id1, u1.user_id as userId1, u1.email as email1, u1.mobile as mobile1,
          u1.first_name as firstName1, u1.last_name as lastName1, u1.pan_number as panNumber1,
          u1.created_at as createdAt1,
          u2.id as id2, u2.user_id as userId2, u2.email as email2, u2.mobile as mobile2,
          u2.first_name as firstName2, u2.last_name as lastName2, u2.pan_number as panNumber2,
          u2.created_at as createdAt2,
          'email' as matchType
        FROM users u1
        INNER JOIN users u2 ON u1.email = u2.email AND u1.id < u2.id
        WHERE u1.email IS NOT NULL
        
        UNION ALL
        
        -- Find users sharing mobile
        SELECT 
          u1.id, u1.user_id, u1.email, u1.mobile,
          u1.first_name, u1.last_name, u1.pan_number, u1.created_at,
          u2.id, u2.user_id, u2.email, u2.mobile,
          u2.first_name, u2.last_name, u2.pan_number, u2.created_at,
          'mobile' as matchType
        FROM users u1
        INNER JOIN users u2 ON u1.mobile = u2.mobile AND u1.id < u2.id
        WHERE u1.mobile IS NOT NULL
        
        UNION ALL
        
        -- Find users sharing PAN (highest risk!)
        SELECT 
          u1.id, u1.user_id, u1.email, u1.mobile,
          u1.first_name, u1.last_name, u1.pan_number, u1.created_at,
          u2.id, u2.user_id, u2.email, u2.mobile,
          u2.first_name, u2.last_name, u2.pan_number, u2.created_at,
          'pan' as matchType
        FROM users u1
        INNER JOIN users u2 ON u1.pan_number = u2.pan_number AND u1.id < u2.id
        WHERE u1.pan_number IS NOT NULL
      )
      SELECT DISTINCT ON (id1, id2)
        id1, userId1, email1, mobile1, firstName1, lastName1, panNumber1, createdAt1,
        id2, userId2, email2, mobile2, firstName2, lastName2, panNumber2, createdAt2,
        matchType
      FROM duplicate_candidates
      ORDER BY id1, id2
    `);
    
    // Analyze each duplicate pair
    const matches: DuplicateMatch[] = duplicatePairs.rows.map(row => {
      const user1: DuplicateUser = {
        id: row.id1,
        userId: row.userId1,
        email: row.email1,
        mobile: row.mobile1,
        firstName: row.firstName1,
        lastName: row.lastName1,
        panNumber: row.panNumber1,
        createdAt: row.createdAt1 ? new Date(row.createdAt1) : null,
      };
      
      const user2: DuplicateUser = {
        id: row.id2,
        userId: row.userId2,
        email: row.email2,
        mobile: row.mobile2,
        firstName: row.firstName2,
        lastName: row.lastName2,
        panNumber: row.panNumber2,
        createdAt: row.createdAt2 ? new Date(row.createdAt2) : null,
      };
      
      return this.analyzeDuplicate(user1, user2);
    });
    
    // Sort by risk score (highest first)
    return matches.sort((a, b) => b.riskScore - a.riskScore);
  }
  
  /**
   * Analyze if two users are duplicates and calculate risk score
   */
  private analyzeDuplicate(user1: DuplicateUser, user2: DuplicateUser): DuplicateMatch {
    const reasons: string[] = [];
    let riskScore = 0;
    
    // Check PAN number (highest risk - should be unique)
    if (user1.panNumber && user2.panNumber && user1.panNumber === user2.panNumber) {
      reasons.push('Identical PAN number');
      riskScore += 50; // Critical indicator
    }
    
    // Check email
    if (user1.email && user2.email && user1.email === user2.email) {
      reasons.push('Identical email address');
      riskScore += 20;
    }
    
    // Check mobile
    if (user1.mobile && user2.mobile && user1.mobile === user2.mobile) {
      reasons.push('Identical mobile number');
      riskScore += 20;
    }
    
    // Check name similarity
    const nameSimilarity = areNamesSimilar(
      user1.firstName, user1.lastName,
      user2.firstName, user2.lastName
    );
    
    if (nameSimilarity.similar) {
      reasons.push(`Similar names (${nameSimilarity.similarity}% match)`);
      riskScore += nameSimilarity.similarity / 5; // Max 20 points
    }
    
    // Determine risk level
    let riskLevel: DuplicateRiskLevel;
    let autoMergeRecommended = false;
    
    if (riskScore >= 70) {
      riskLevel = 'high';
      // Same PAN + similar name + same contact = very likely duplicate
      if (user1.panNumber === user2.panNumber && nameSimilarity.similar) {
        autoMergeRecommended = true;
      }
    } else if (riskScore >= 40) {
      riskLevel = 'medium';
    } else {
      riskLevel = 'low';
    }
    
    return {
      user1,
      user2,
      riskLevel,
      riskScore: Math.round(riskScore),
      reasons,
      nameSimilarity: nameSimilarity.similarity,
      autoMergeRecommended,
      // Boolean flags for easy filtering
      panNumberMatch: !!(user1.panNumber && user2.panNumber && user1.panNumber === user2.panNumber),
      emailMatch: !!(user1.email && user2.email && user1.email === user2.email),
      mobileMatch: !!(user1.mobile && user2.mobile && user1.mobile === user2.mobile),
    };
  }
  
  /**
   * Get duplicate statistics
   */
  async getDuplicateStats(): Promise<{
    totalDuplicates: number;
    highRisk: number;
    mediumRisk: number;
    lowRisk: number;
    autoMergeRecommended: number;
  }> {
    const duplicates = await this.findAllDuplicates();
    
    return {
      totalDuplicates: duplicates.length,
      highRisk: duplicates.filter(d => d.riskLevel === 'high').length,
      mediumRisk: duplicates.filter(d => d.riskLevel === 'medium').length,
      lowRisk: duplicates.filter(d => d.riskLevel === 'low').length,
      autoMergeRecommended: duplicates.filter(d => d.autoMergeRecommended).length,
    };
  }
}

export const duplicateDetectionService = new DuplicateDetectionService();
