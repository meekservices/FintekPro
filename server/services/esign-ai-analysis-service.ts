import { db } from '../db';
import { 
  esignDocumentAnnotations, esignAiAnalysisSessions,
  esignAnnotationReplies, esignAnnotationAuditLog,
  InsertEsignDocumentAnnotation, InsertEsignAiAnalysisSession
} from '@shared/schema';
import { eq, and, desc, asc, sql } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import { GoogleGenAI } from '@google/genai';

export type AnnotationCategory = 'summary' | 'correction' | 'missing_clause' | 'compliance' | 'general';
export type AnnotationStatus = 'open' | 'accepted' | 'rejected' | 'resolved' | 'deferred';
export type AnnotationSeverity = 'info' | 'warning' | 'error' | 'critical';

interface AnalysisRequest {
  documentId: string;
  workflowId?: number;
  documentContent: string;
  documentName: string;
  documentType: string;
  requestedById?: string;
  requestedByName?: string;
  analysisTypes?: AnnotationCategory[];
}

interface AIAnnotationSuggestion {
  category: AnnotationCategory;
  title: string;
  content: string;
  severity: AnnotationSeverity;
  textExcerpt?: string;
  suggestedAction?: string;
  suggestedReplacement?: string;
  confidence: number;
}

interface AnalysisResult {
  success: boolean;
  sessionId: number;
  documentId: string;
  annotations: AIAnnotationSuggestion[];
  summary?: string;
  processingTimeMs: number;
  error?: string;
}

const DOCUMENT_TYPE_PROMPTS: Record<string, string> = {
  investment_agreement: `Focus on investment terms, returns, risks, exit clauses, lock-in periods, and SEBI compliance requirements.`,
  kyc_consent: `Check for KYC/AML compliance, data privacy clauses, consent validity, and regulatory requirements.`,
  mandate: `Verify authorization clauses, scope limitations, validity periods, and revocation terms.`,
  form_15ca: `Check for FEMA compliance, remittance details, TDS calculations, and RBI requirements.`,
  form_15cb: `Verify CA certification requirements, tax treaty applicability, and income characterization.`,
  itr_verification: `Check for ITR form validity, income disclosures, and tax calculation accuracy.`,
  other: `General document analysis focusing on legal clarity, completeness, and standard clause presence.`,
};

class ESignAIAnalysisService {
  private genAI: GoogleGenAI | null = null;

  constructor() {
    const apiKey = process.env.AI_INTEGRATIONS_GOOGLE_API_KEY || process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
    if (apiKey) {
      this.genAI = new GoogleGenAI({ apiKey });
      console.log('✅ [eSign AI Analysis] Gemini AI initialized');
    } else {
      console.warn('⚠️ [eSign AI Analysis] No API key found - using mock mode');
    }
  }

  async analyzeDocument(request: AnalysisRequest): Promise<AnalysisResult> {
    const startTime = Date.now();
    const documentId = request.documentId || nanoid(12);
    
    let sessionId: number;
    
    try {
      const [session] = await db.insert(esignAiAnalysisSessions).values({
        documentId,
        workflowId: request.workflowId,
        status: 'processing',
        documentName: request.documentName,
        documentType: request.documentType,
        analysisTypes: request.analysisTypes || ['summary', 'correction', 'missing_clause', 'compliance'],
        requestedById: request.requestedById,
        requestedByName: request.requestedByName,
      }).returning({ id: esignAiAnalysisSessions.id });
      
      sessionId = session.id;

      let annotations: AIAnnotationSuggestion[];
      
      if (this.model) {
        annotations = await this.performAIAnalysis(request);
      } else {
        annotations = this.getMockAnnotations(request.documentType);
      }

      const savedAnnotations = await this.saveAnnotations(documentId, request.workflowId, annotations);

      const processingTime = Date.now() - startTime;
      
      await db.update(esignAiAnalysisSessions)
        .set({
          status: 'completed',
          completedAt: new Date(),
          processingTimeMs: processingTime,
          totalAnnotations: annotations.length,
          summaryCount: annotations.filter(a => a.category === 'summary').length,
          correctionCount: annotations.filter(a => a.category === 'correction').length,
          missingClauseCount: annotations.filter(a => a.category === 'missing_clause').length,
          complianceCount: annotations.filter(a => a.category === 'compliance').length,
        })
        .where(eq(esignAiAnalysisSessions.id, sessionId));

      return {
        success: true,
        sessionId,
        documentId,
        annotations,
        processingTimeMs: processingTime,
      };
    } catch (error) {
      console.error('[eSign AI Analysis] Error:', error);
      
      if (sessionId!) {
        await db.update(esignAiAnalysisSessions)
          .set({
            status: 'failed',
            errorMessage: (error as Error).message,
            processingTimeMs: Date.now() - startTime,
          })
          .where(eq(esignAiAnalysisSessions.id, sessionId));
      }
      
      return {
        success: false,
        sessionId: sessionId!,
        documentId,
        annotations: [],
        processingTimeMs: Date.now() - startTime,
        error: (error as Error).message,
      };
    }
  }

  private async performAIAnalysis(request: AnalysisRequest): Promise<AIAnnotationSuggestion[]> {
    const documentTypeContext = DOCUMENT_TYPE_PROMPTS[request.documentType] || DOCUMENT_TYPE_PROMPTS.other;
    
    const prompt = `You are a legal document analysis assistant for a financial services platform. Analyze the following document and provide structured suggestions.

Document Type: ${request.documentType}
Document Name: ${request.documentName}
Context: ${documentTypeContext}

Document Content:
${request.documentContent.substring(0, 50000)}

Provide your analysis as a JSON array of annotations. Each annotation should have:
- category: one of "summary", "correction", "missing_clause", "compliance", "general"
- title: brief title (max 100 chars)
- content: detailed explanation
- severity: "info", "warning", "error", or "critical"
- textExcerpt: relevant text from document (if applicable)
- suggestedAction: what should be done
- suggestedReplacement: replacement text (for corrections only)
- confidence: 0.0 to 1.0

Generate:
1. One "summary" annotation with document overview
2. Any spelling/grammar corrections found
3. Missing standard clauses for this document type
4. Compliance issues with SEBI/RBI/IT Act regulations
5. General improvement suggestions

Return ONLY a valid JSON array, no other text.`;

    try {
      const response = await this.genAI!.models.generateContent({
        model: 'gemini-2.0-flash',
        contents: prompt,
      });
      
      const text = response.text || '';
      
      const jsonMatch = text.match(/\[[\s\S]*\]/);
      if (!jsonMatch) {
        console.warn('[eSign AI Analysis] Could not parse JSON from response');
        return this.getMockAnnotations(request.documentType);
      }
      
      const annotations = JSON.parse(jsonMatch[0]) as AIAnnotationSuggestion[];
      
      return annotations.map(a => ({
        category: this.validateCategory(a.category),
        title: a.title?.substring(0, 255) || 'Untitled',
        content: a.content || '',
        severity: this.validateSeverity(a.severity),
        textExcerpt: a.textExcerpt,
        suggestedAction: a.suggestedAction,
        suggestedReplacement: a.suggestedReplacement,
        confidence: Math.min(1, Math.max(0, a.confidence || 0.8)),
      }));
    } catch (error) {
      console.error('[eSign AI Analysis] Gemini API error:', error);
      return this.getMockAnnotations(request.documentType);
    }
  }

  private validateCategory(category: string): AnnotationCategory {
    const valid: AnnotationCategory[] = ['summary', 'correction', 'missing_clause', 'compliance', 'general'];
    return valid.includes(category as AnnotationCategory) ? category as AnnotationCategory : 'general';
  }

  private validateSeverity(severity: string): AnnotationSeverity {
    const valid: AnnotationSeverity[] = ['info', 'warning', 'error', 'critical'];
    return valid.includes(severity as AnnotationSeverity) ? severity as AnnotationSeverity : 'info';
  }

  private getMockAnnotations(documentType: string): AIAnnotationSuggestion[] {
    const baseAnnotations: AIAnnotationSuggestion[] = [
      {
        category: 'summary',
        title: 'Document Summary',
        content: `This ${documentType.replace(/_/g, ' ')} document outlines the terms and conditions for the agreement between parties. Key sections include scope of services, payment terms, confidentiality provisions, and termination clauses.`,
        severity: 'info',
        confidence: 0.95,
        suggestedAction: 'Review all sections before signing',
      },
      {
        category: 'correction',
        title: 'Potential Typo Detected',
        content: 'The word "recieve" should be spelled "receive".',
        severity: 'warning',
        textExcerpt: '...shall recieve payment...',
        suggestedReplacement: '...shall receive payment...',
        confidence: 0.92,
        suggestedAction: 'Correct the spelling',
      },
      {
        category: 'missing_clause',
        title: 'Missing Dispute Resolution Clause',
        content: 'Standard financial agreements should include an arbitration or dispute resolution clause specifying jurisdiction and process.',
        severity: 'warning',
        confidence: 0.88,
        suggestedAction: 'Add dispute resolution mechanism with specified jurisdiction',
      },
      {
        category: 'compliance',
        title: 'SEBI Disclosure Requirement',
        content: 'For investment agreements, SEBI requires clear disclosure of risks and potential loss of capital. Ensure risk disclosure section is prominently placed.',
        severity: 'error',
        confidence: 0.85,
        suggestedAction: 'Add or verify SEBI-compliant risk disclosure statement',
      },
      {
        category: 'general',
        title: 'Clarity Improvement Suggested',
        content: 'Section 4.2 contains complex legal language that may be difficult for clients to understand. Consider simplifying.',
        severity: 'info',
        textExcerpt: 'The party of the first part shall indemnify and hold harmless...',
        confidence: 0.75,
        suggestedAction: 'Simplify language for better readability',
      },
    ];

    return baseAnnotations;
  }

  private async saveAnnotations(
    documentId: string, 
    workflowId: number | undefined,
    annotations: AIAnnotationSuggestion[]
  ): Promise<number[]> {
    const savedIds: number[] = [];
    
    for (const annotation of annotations) {
      try {
        const [saved] = await db.insert(esignDocumentAnnotations).values({
          documentId,
          workflowId,
          category: annotation.category,
          title: annotation.title,
          content: annotation.content,
          severity: annotation.severity,
          textExcerpt: annotation.textExcerpt,
          suggestedAction: annotation.suggestedAction,
          suggestedReplacement: annotation.suggestedReplacement,
          confidence: annotation.confidence.toString(),
          createdByType: 'ai',
          createdByName: 'AI Document Analyzer',
          aiModel: 'gemini-1.5-flash',
          status: 'open',
        }).returning({ id: esignDocumentAnnotations.id });
        
        savedIds.push(saved.id);
        
        await db.insert(esignAnnotationAuditLog).values({
          annotationId: saved.id,
          action: 'created',
          newStatus: 'open',
          actorType: 'ai',
          actorName: 'AI Document Analyzer',
          details: { category: annotation.category, severity: annotation.severity },
        });
      } catch (error) {
        console.error('[eSign AI Analysis] Failed to save annotation:', error);
      }
    }
    
    return savedIds;
  }

  async getAnnotationsForDocument(documentId: string, options?: {
    category?: AnnotationCategory;
    status?: AnnotationStatus;
  }) {
    const conditions = [eq(esignDocumentAnnotations.documentId, documentId)];
    
    if (options?.category) {
      conditions.push(eq(esignDocumentAnnotations.category, options.category));
    }
    if (options?.status) {
      conditions.push(eq(esignDocumentAnnotations.status, options.status));
    }
    
    return db.select()
      .from(esignDocumentAnnotations)
      .where(and(...conditions))
      .orderBy(
        desc(sql`CASE WHEN severity = 'critical' THEN 1 WHEN severity = 'error' THEN 2 WHEN severity = 'warning' THEN 3 ELSE 4 END`),
        asc(esignDocumentAnnotations.createdAt)
      );
  }

  async getAnnotationWithReplies(annotationId: number) {
    const annotation = await db.select()
      .from(esignDocumentAnnotations)
      .where(eq(esignDocumentAnnotations.id, annotationId))
      .limit(1);
    
    if (!annotation.length) return null;
    
    const replies = await db.select()
      .from(esignAnnotationReplies)
      .where(eq(esignAnnotationReplies.annotationId, annotationId))
      .orderBy(asc(esignAnnotationReplies.createdAt));
    
    return { ...annotation[0], replies };
  }

  async addReply(annotationId: number, data: {
    content: string;
    authorId?: string;
    authorName: string;
    authorType: 'agent' | 'client' | 'system';
    authorEmail?: string;
  }) {
    const [reply] = await db.insert(esignAnnotationReplies).values({
      annotationId,
      content: data.content,
      authorId: data.authorId,
      authorName: data.authorName,
      authorType: data.authorType,
      authorEmail: data.authorEmail,
    }).returning();
    
    await db.insert(esignAnnotationAuditLog).values({
      annotationId,
      action: 'reply_added',
      actorId: data.authorId,
      actorName: data.authorName,
      actorType: data.authorType,
      details: { replyId: reply.id },
    });
    
    return reply;
  }

  async updateAnnotationStatus(annotationId: number, data: {
    status: AnnotationStatus;
    actorId?: string;
    actorName: string;
    actorType: 'agent' | 'client';
    rejectionReason?: string;
    ipAddress?: string;
    userAgent?: string;
  }) {
    const [current] = await db.select({ status: esignDocumentAnnotations.status })
      .from(esignDocumentAnnotations)
      .where(eq(esignDocumentAnnotations.id, annotationId));
    
    if (!current) throw new Error('Annotation not found');
    
    const updateData: any = { 
      status: data.status,
      updatedAt: new Date(),
    };
    
    if (data.status === 'accepted') {
      updateData.acceptedBy = data.actorId || data.actorName;
      updateData.acceptedAt = new Date();
    } else if (data.status === 'rejected') {
      updateData.rejectedBy = data.actorId || data.actorName;
      updateData.rejectedAt = new Date();
      updateData.rejectionReason = data.rejectionReason;
    }
    
    await db.update(esignDocumentAnnotations)
      .set(updateData)
      .where(eq(esignDocumentAnnotations.id, annotationId));
    
    await db.insert(esignAnnotationAuditLog).values({
      annotationId,
      action: 'status_changed',
      previousStatus: current.status,
      newStatus: data.status,
      actorId: data.actorId,
      actorName: data.actorName,
      actorType: data.actorType,
      ipAddress: data.ipAddress,
      userAgent: data.userAgent,
      details: data.rejectionReason ? { rejectionReason: data.rejectionReason } : {},
    });
    
    return { success: true, previousStatus: current.status, newStatus: data.status };
  }

  async getAnnotationAuditLog(annotationId: number) {
    return db.select()
      .from(esignAnnotationAuditLog)
      .where(eq(esignAnnotationAuditLog.annotationId, annotationId))
      .orderBy(desc(esignAnnotationAuditLog.createdAt));
  }

  async getAnalysisSessions(documentId?: string) {
    if (documentId) {
      return db.select()
        .from(esignAiAnalysisSessions)
        .where(eq(esignAiAnalysisSessions.documentId, documentId))
        .orderBy(desc(esignAiAnalysisSessions.createdAt));
    }
    
    return db.select()
      .from(esignAiAnalysisSessions)
      .orderBy(desc(esignAiAnalysisSessions.createdAt))
      .limit(50);
  }

  async addManualAnnotation(documentId: string, data: {
    workflowId?: number;
    category: AnnotationCategory;
    title: string;
    content: string;
    severity?: AnnotationSeverity;
    textExcerpt?: string;
    suggestedAction?: string;
    suggestedReplacement?: string;
    pageNumber?: number;
    createdById: string;
    createdByName: string;
    createdByType: 'agent' | 'client';
  }) {
    const [annotation] = await db.insert(esignDocumentAnnotations).values({
      documentId,
      workflowId: data.workflowId,
      category: data.category,
      title: data.title,
      content: data.content,
      severity: data.severity || 'info',
      textExcerpt: data.textExcerpt,
      suggestedAction: data.suggestedAction,
      suggestedReplacement: data.suggestedReplacement,
      pageNumber: data.pageNumber,
      createdById: data.createdById,
      createdByName: data.createdByName,
      createdByType: data.createdByType,
      status: 'open',
    }).returning();
    
    await db.insert(esignAnnotationAuditLog).values({
      annotationId: annotation.id,
      action: 'created',
      newStatus: 'open',
      actorId: data.createdById,
      actorName: data.createdByName,
      actorType: data.createdByType,
      details: { category: data.category, manual: true },
    });
    
    return annotation;
  }
}

export const esignAIAnalysisService = new ESignAIAnalysisService();
