import mammoth from "mammoth";
import { createHash } from "crypto";
import { ObjectStorageService, objectStorageClient } from "../objectStorage";

const objectStorageService = new ObjectStorageService();

export interface DocumentUploadResult {
  originalUrl: string;
  pdfUrl: string;
  documentHash: string;
  originalFormat: string;
  htmlContent?: string;
}

export interface UploadOptions {
  workflowId?: string;
  proposalId?: string;
  userId: string;
  fileName: string;
}

class DocumentUploadService {
  private readonly PRIVATE_DIR = process.env.PRIVATE_OBJECT_DIR || ".private";
  private readonly MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
  private readonly ALLOWED_TYPES = [".docx", ".doc", ".pdf"];

  async validateFile(buffer: Buffer, fileName: string): Promise<{ valid: boolean; error?: string }> {
    if (buffer.length > this.MAX_FILE_SIZE) {
      return { valid: false, error: `File size exceeds maximum allowed (10MB)` };
    }

    const ext = this.getFileExtension(fileName).toLowerCase();
    if (!this.ALLOWED_TYPES.includes(ext)) {
      return { valid: false, error: `File type not allowed. Allowed: ${this.ALLOWED_TYPES.join(", ")}` };
    }

    if (ext === ".docx") {
      const isValidDocx = this.isValidDocx(buffer);
      if (!isValidDocx) {
        return { valid: false, error: "Invalid DOCX file format" };
      }
    }

    if (ext === ".pdf") {
      const isValidPdf = this.isValidPdf(buffer);
      if (!isValidPdf) {
        return { valid: false, error: "Invalid PDF file format" };
      }
    }

    return { valid: true };
  }

  private isValidDocx(buffer: Buffer): boolean {
    const signature = buffer.slice(0, 4);
    return signature[0] === 0x50 && signature[1] === 0x4b && signature[2] === 0x03 && signature[3] === 0x04;
  }

  private isValidPdf(buffer: Buffer): boolean {
    const signature = buffer.slice(0, 5).toString();
    return signature === "%PDF-";
  }

  private getFileExtension(fileName: string): string {
    const lastDot = fileName.lastIndexOf(".");
    return lastDot >= 0 ? fileName.substring(lastDot) : "";
  }

  private generateHash(buffer: Buffer): string {
    return createHash("sha256").update(buffer).digest("hex");
  }

  private parseObjectPath(path: string): { bucketName: string; objectName: string } {
    let normalizedPath = path;
    if (!normalizedPath.startsWith("/")) {
      normalizedPath = `/${normalizedPath}`;
    }
    const pathParts = normalizedPath.split("/");
    if (pathParts.length < 3) {
      throw new Error("Invalid path: must contain at least a bucket name");
    }
    return {
      bucketName: pathParts[1],
      objectName: pathParts.slice(2).join("/"),
    };
  }

  private async uploadToStorage(path: string, buffer: Buffer): Promise<void> {
    const { bucketName, objectName } = this.parseObjectPath(path);
    const bucket = objectStorageClient.bucket(bucketName);
    const file = bucket.file(objectName);
    await file.save(buffer);
  }

  private async downloadFromStorage(path: string): Promise<Buffer> {
    const { bucketName, objectName } = this.parseObjectPath(path);
    const bucket = objectStorageClient.bucket(bucketName);
    const file = bucket.file(objectName);
    const [contents] = await file.download();
    return contents;
  }

  async uploadDocument(buffer: Buffer, options: UploadOptions): Promise<DocumentUploadResult> {
    const ext = this.getFileExtension(options.fileName).toLowerCase();
    const timestamp = Date.now();
    const baseName = options.fileName.replace(/\.[^/.]+$/, "");
    const sanitizedName = baseName.replace(/[^a-zA-Z0-9-_]/g, "_");
    
    const documentHash = this.generateHash(buffer);
    const privateDir = objectStorageService.getPrivateObjectDir();
    
    const originalPath = `${privateDir}/documents/${options.proposalId || "general"}/${timestamp}_${sanitizedName}${ext}`;
    
    await this.uploadToStorage(originalPath, buffer);
    
    let pdfUrl = originalPath;
    let htmlContent: string | undefined;
    
    if (ext === ".docx") {
      const result = await mammoth.convertToHtml({ buffer });
      htmlContent = result.value;
      
      const pdfPath = `${privateDir}/documents/${options.proposalId || "general"}/${timestamp}_${sanitizedName}.html`;
      const htmlBuffer = await this.generatePdfFromHtml(htmlContent, options.fileName);
      await this.uploadToStorage(pdfPath, htmlBuffer);
      pdfUrl = pdfPath;
    }
    
    return {
      originalUrl: originalPath,
      pdfUrl,
      documentHash,
      originalFormat: ext.replace(".", ""),
      htmlContent,
    };
  }

  private async generatePdfFromHtml(html: string, title: string): Promise<Buffer> {
    const fullHtml = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <title>${title}</title>
        <style>
          body {
            font-family: 'Times New Roman', serif;
            font-size: 12pt;
            line-height: 1.5;
            margin: 72pt;
            color: #000;
          }
          h1 { font-size: 18pt; margin-bottom: 12pt; }
          h2 { font-size: 16pt; margin-bottom: 10pt; }
          h3 { font-size: 14pt; margin-bottom: 8pt; }
          p { margin-bottom: 12pt; text-align: justify; }
          table { border-collapse: collapse; width: 100%; margin: 12pt 0; }
          td, th { border: 1px solid #000; padding: 6pt; }
          ul, ol { margin-bottom: 12pt; padding-left: 24pt; }
          li { margin-bottom: 6pt; }
        </style>
      </head>
      <body>
        ${html}
      </body>
      </html>
    `;
    
    return Buffer.from(fullHtml, "utf-8");
  }

  async getDocumentUrl(path: string): Promise<string> {
    try {
      const buffer = await this.downloadFromStorage(path);
      
      const base64 = buffer.toString("base64");
      const ext = this.getFileExtension(path).toLowerCase();
      const mimeType = ext === ".pdf" ? "application/pdf" : 
                       ext === ".docx" ? "application/vnd.openxmlformats-officedocument.wordprocessingml.document" :
                       ext === ".html" ? "text/html" :
                       "application/octet-stream";
      
      return `data:${mimeType};base64,${base64}`;
    } catch (error) {
      console.error("Error fetching document:", error);
      throw new Error("Failed to fetch document");
    }
  }

  async downloadDocument(path: string): Promise<Buffer> {
    return this.downloadFromStorage(path);
  }

  async deleteDocument(path: string): Promise<void> {
    try {
      const { bucketName, objectName } = this.parseObjectPath(path);
      const bucket = objectStorageClient.bucket(bucketName);
      const file = bucket.file(objectName);
      await file.delete();
    } catch (error) {
      console.error("Error deleting document:", error);
    }
  }

  async extractDocxContent(buffer: Buffer): Promise<{ html: string; text: string; messages: string[] }> {
    const htmlResult = await mammoth.convertToHtml({ buffer });
    const textResult = await mammoth.extractRawText({ buffer });
    
    return {
      html: htmlResult.value,
      text: textResult.value,
      messages: [...htmlResult.messages, ...textResult.messages].map(m => m.message),
    };
  }
}

export const documentUploadService = new DocumentUploadService();
