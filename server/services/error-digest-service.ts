import { errorTrackingService } from "./error-tracking-service";
import { emailService } from "../email-service";
import { aiService } from "./ai-service";
import { db } from "../db";
import { users } from "../../shared/schema";
import { eq, sql } from "drizzle-orm";

interface ErrorDigest {
  period: string;
  totalErrors: number;
  criticalErrors: number;
  newErrors: number;
  resolvedErrors: number;
  topModules: Array<{ module: string; count: number }>;
  topErrorCodes: Array<{ code: string; count: number }>;
  aiSummary: string;
  aiRecommendations: string[];
  trendAnalysis: string;
}

class ErrorDigestService {
  private isRunning = false;

  async generateDailyDigest(): Promise<ErrorDigest | null> {
    try {
      const now = new Date();
      const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);

      const result = await errorTrackingService.getErrors({
        dateFrom: yesterday,
        dateTo: now,
        limit: 500,
        offset: 0,
      });

      const errors = result.errors;
      
      if (errors.length === 0) {
        return null;
      }

      const criticalErrors = errors.filter(e => e.severity === 'critical' || e.severity === 'error');
      const newErrors = errors.filter(e => new Date(e.createdAt) >= yesterday);
      const resolvedErrors = errors.filter(e => e.status === 'resolved');

      const moduleCount: Record<string, number> = {};
      const errorCodeCount: Record<string, number> = {};
      
      errors.forEach(err => {
        moduleCount[err.module] = (moduleCount[err.module] || 0) + 1;
        errorCodeCount[err.errorCode] = (errorCodeCount[err.errorCode] || 0) + 1;
      });

      const topModules = Object.entries(moduleCount)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([module, count]) => ({ module, count }));

      const topErrorCodes = Object.entries(errorCodeCount)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([code, count]) => ({ code, count }));

      let aiSummary = "Error analysis unavailable";
      let aiRecommendations: string[] = [];
      let trendAnalysis = "Trend analysis unavailable";

      try {
        const errorSummaryText = errors.slice(0, 20).map(e => 
          `[${e.severity}] ${e.errorCode}: ${e.message?.substring(0, 100)}`
        ).join('\n');

        const aiPrompt = `Analyze these production errors from the last 24 hours and provide:
1. A brief summary (2-3 sentences)
2. Top 3 actionable recommendations
3. Trend analysis (is the situation improving or worsening?)

Errors:
${errorSummaryText}

Total: ${errors.length} errors, ${criticalErrors.length} critical, ${resolvedErrors.length} resolved`;

        const aiResponse = await aiService.chat([{ role: 'user', content: aiPrompt }]);
        const aiText = aiResponse?.content;
        
        if (aiText) {
          const lines = aiText.split('\n').filter(l => l.trim());
          aiSummary = lines.slice(0, 3).join(' ').trim();
          
          aiRecommendations = lines
            .filter(l => l.match(/^\d+\.|^-|^•/))
            .slice(0, 5)
            .map(l => l.replace(/^\d+\.\s*|-\s*|•\s*/g, '').trim());
          
          const trendMatch = aiText.match(/trend[^.]*\./i);
          if (trendMatch) {
            trendAnalysis = trendMatch[0];
          }
        }
      } catch (aiError) {
        console.error('[ErrorDigest] AI analysis failed:', aiError);
      }

      return {
        period: `${yesterday.toISOString().split('T')[0]} to ${now.toISOString().split('T')[0]}`,
        totalErrors: errors.length,
        criticalErrors: criticalErrors.length,
        newErrors: newErrors.length,
        resolvedErrors: resolvedErrors.length,
        topModules,
        topErrorCodes,
        aiSummary,
        aiRecommendations,
        trendAnalysis
      };
    } catch (error) {
      console.error('[ErrorDigest] Failed to generate digest:', error);
      return null;
    }
  }

  async sendDigestEmail(digest: ErrorDigest): Promise<boolean> {
    try {
      const adminUsers = await db.select()
        .from(users)
        .where(and(
          eq(users.role, 'admin'),
          eq(users.isActive, true)
        ))
        .limit(10);

      if (adminUsers.length === 0) {
        console.log('[ErrorDigest] No admin users found to send digest');
        return false;
      }

      const htmlContent = `
<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: linear-gradient(135deg, #1e3a5f 0%, #2d5a87 100%); color: white; padding: 20px; border-radius: 8px 8px 0 0; }
    .content { background: #f9fafb; padding: 20px; border: 1px solid #e5e7eb; }
    .metric { display: inline-block; text-align: center; padding: 15px; margin: 5px; background: white; border-radius: 8px; min-width: 80px; }
    .metric-value { font-size: 24px; font-weight: bold; color: #1e3a5f; }
    .metric-label { font-size: 12px; color: #6b7280; }
    .critical { color: #dc2626; }
    .section { margin: 20px 0; padding: 15px; background: white; border-radius: 8px; }
    .section-title { font-weight: bold; color: #1e3a5f; margin-bottom: 10px; }
    ul { margin: 0; padding-left: 20px; }
    li { margin: 5px 0; }
    .footer { text-align: center; padding: 15px; color: #6b7280; font-size: 12px; }
    .btn { display: inline-block; padding: 10px 20px; background: #1e3a5f; color: white; text-decoration: none; border-radius: 5px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1 style="margin:0;">🔍 FintekPro Error Digest</h1>
      <p style="margin:5px 0 0 0; opacity:0.9;">${digest.period}</p>
    </div>
    <div class="content">
      <div style="text-align: center; margin-bottom: 20px;">
        <div class="metric">
          <div class="metric-value">${digest.totalErrors}</div>
          <div class="metric-label">Total Errors</div>
        </div>
        <div class="metric">
          <div class="metric-value critical">${digest.criticalErrors}</div>
          <div class="metric-label">Critical</div>
        </div>
        <div class="metric">
          <div class="metric-value" style="color: #16a34a;">${digest.resolvedErrors}</div>
          <div class="metric-label">Resolved</div>
        </div>
      </div>

      <div class="section">
        <div class="section-title">🤖 AI Analysis</div>
        <p>${digest.aiSummary}</p>
        <p><em>${digest.trendAnalysis}</em></p>
      </div>

      ${digest.aiRecommendations.length > 0 ? `
      <div class="section">
        <div class="section-title">💡 Recommendations</div>
        <ul>
          ${digest.aiRecommendations.map(r => `<li>${r}</li>`).join('')}
        </ul>
      </div>
      ` : ''}

      <div class="section">
        <div class="section-title">📊 Top Error Modules</div>
        <ul>
          ${digest.topModules.map(m => `<li><strong>${m.module}</strong>: ${m.count} errors</li>`).join('')}
        </ul>
      </div>

      <div class="section">
        <div class="section-title">🏷️ Top Error Codes</div>
        <ul>
          ${digest.topErrorCodes.map(c => `<li><code>${c.code}</code>: ${c.count} occurrences</li>`).join('')}
        </ul>
      </div>

      <div style="text-align: center; margin-top: 20px;">
        <a href="${process.env.REPLIT_DOMAINS ? `https://${process.env.REPLIT_DOMAINS.split(',')[0]}` : ''}/admin/error-command-center" class="btn">
          View Error Command Center
        </a>
      </div>
    </div>
    <div class="footer">
      <p>This is an automated digest from FintekPro Error Tracking System</p>
      <p>Generated at ${new Date().toISOString()}</p>
    </div>
  </div>
</body>
</html>`;

      for (const admin of adminUsers) {
        if (admin.email) {
          await emailService.sendEmail({
            to: admin.email,
            subject: `🔍 FintekPro Error Digest: ${digest.criticalErrors} critical, ${digest.totalErrors} total errors`,
            html: htmlContent
          });
        }
      }

      console.log(`[ErrorDigest] Sent digest to ${adminUsers.length} admin(s)`);
      return true;
    } catch (error) {
      console.error('[ErrorDigest] Failed to send digest email:', error);
      return false;
    }
  }

  async sendCriticalAlert(error: any): Promise<void> {
    try {
      if (error.severity !== 'critical' && error.severity !== 'error') return;

      const adminUsers = await db.select()
        .from(users)
        .where(sql`${users.roles} @> ARRAY['admin']::varchar[] AND ${users.isActive} = true`)
        .limit(5);

      let aiAnalysis = "AI analysis unavailable";
      try {
        const analysisResult = await aiService.chat([{
          role: 'user',
          content: `Briefly analyze this critical production error and suggest a fix (2-3 sentences):\nError: ${error.errorCode}\nMessage: ${error.message}\nModule: ${error.module}\nStack: ${error.stackTrace?.substring(0, 500)}`
        }]);
        if (analysisResult?.content) aiAnalysis = analysisResult.content;
      } catch (e) {
        console.error('[ErrorDigest] AI analysis for critical alert failed:', e);
      }

      const htmlContent = `
<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: Arial, sans-serif; }
    .alert { background: #fef2f2; border: 2px solid #dc2626; border-radius: 8px; padding: 20px; max-width: 600px; margin: 0 auto; }
    .header { color: #dc2626; font-size: 18px; font-weight: bold; margin-bottom: 15px; }
    .detail { margin: 10px 0; }
    .label { font-weight: bold; color: #4b5563; }
    .code { background: #f3f4f6; padding: 10px; border-radius: 4px; font-family: monospace; font-size: 12px; overflow-x: auto; }
    .ai-box { background: #eff6ff; border: 1px solid #3b82f6; border-radius: 4px; padding: 10px; margin-top: 15px; }
  </style>
</head>
<body>
  <div class="alert">
    <div class="header">🚨 CRITICAL ERROR ALERT</div>
    <div class="detail"><span class="label">Error Code:</span> ${error.errorCode}</div>
    <div class="detail"><span class="label">Module:</span> ${error.module}</div>
    <div class="detail"><span class="label">Message:</span> ${error.message}</div>
    <div class="detail"><span class="label">Time:</span> ${new Date().toISOString()}</div>
    ${error.transactionId ? `<div class="detail"><span class="label">Transaction:</span> ${error.transactionId}</div>` : ''}
    <div class="ai-box">
      <strong>🤖 AI Analysis:</strong><br/>
      ${aiAnalysis}
    </div>
    <div style="margin-top: 15px; text-align: center;">
      <a href="${process.env.REPLIT_DOMAINS ? `https://${process.env.REPLIT_DOMAINS.split(',')[0]}` : ''}/admin/error-command-center" 
         style="display: inline-block; padding: 10px 20px; background: #dc2626; color: white; text-decoration: none; border-radius: 5px;">
        View in Error Command Center
      </a>
    </div>
  </div>
</body>
</html>`;

      for (const admin of adminUsers) {
        if (admin.email) {
          await emailService.sendEmail({
            to: admin.email,
            subject: `🚨 CRITICAL: ${error.errorCode} in ${error.module}`,
            html: htmlContent
          });
        }
      }

      console.log(`[ErrorDigest] Sent critical alert for ${error.errorCode} to ${adminUsers.length} admin(s)`);
    } catch (err) {
      console.error('[ErrorDigest] Failed to send critical alert:', err);
    }
  }

  async runDailyDigest(): Promise<void> {
    if (this.isRunning) {
      console.log('[ErrorDigest] Digest already running, skipping');
      return;
    }

    this.isRunning = true;
    console.log('[ErrorDigest] Starting daily error digest...');

    try {
      const digest = await this.generateDailyDigest();
      
      if (digest && digest.totalErrors > 0) {
        await this.sendDigestEmail(digest);
        console.log('[ErrorDigest] Daily digest completed successfully');
      } else {
        console.log('[ErrorDigest] No errors to report in the last 24 hours');
      }
    } catch (error) {
      console.error('[ErrorDigest] Daily digest failed:', error);
    } finally {
      this.isRunning = false;
    }
  }
}

export const errorDigestService = new ErrorDigestService();
