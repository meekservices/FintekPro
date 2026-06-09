// @ts-nocheck
import mammoth from "mammoth";
import { createHash } from "crypto";
import {
	ObjectStorageService,
	objectStorageClient,
	parseObjectPath,
} from "../objectStorage";

const objectStorageService = new ObjectStorageService();

export interface DocumentUploadResult {
	originalUrl: string;
	displayUrl: string;
	documentHash: string;
	originalFormat: string;
	convertedFormat: string;
	htmlContent?: string;
}

export interface UploadOptions {
	workflowId?: string;
	proposalId?: string;
	userId: string;
	fileName: string;
}

class DocumentUploadService {
	private readonly MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
	private readonly ALLOWED_TYPES = [".docx", ".doc", ".pdf"];

	async validateFile(
		buffer: Buffer,
		fileName: string,
	): Promise<{ valid: boolean; error?: string }> {
		if (buffer.length > this.MAX_FILE_SIZE) {
			return {
				valid: false,
				error: `File size exceeds maximum allowed (10MB)`,
			};
		}

		const ext = this.getFileExtension(fileName).toLowerCase();
		if (!this.ALLOWED_TYPES.includes(ext)) {
			return {
				valid: false,
				error: `File type not allowed. Allowed: ${this.ALLOWED_TYPES.join(", ")}`,
			};
		}

		if (ext === ".docx") {
			const isValid = this.isValidDocx(buffer);
			if (!isValid) {
				return { valid: false, error: "Invalid DOCX file format" };
			}
		}

		if (ext === ".doc") {
			const isValid = this.isValidDoc(buffer);
			if (!isValid) {
				return { valid: false, error: "Invalid DOC file format" };
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
		return (
			signature[0] === 0x50 &&
			signature[1] === 0x4b &&
			signature[2] === 0x03 &&
			signature[3] === 0x04
		);
	}

	private isValidDoc(buffer: Buffer): boolean {
		const signature = buffer.slice(0, 4);
		return (
			signature[0] === 0xd0 &&
			signature[1] === 0xcf &&
			signature[2] === 0x11 &&
			signature[3] === 0xe0
		);
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

	private async uploadToStorage(
		path: string,
		buffer: Buffer,
		contentType?: string,
		customMeta?: Record<string, string>,
	): Promise<void> {
		const { bucketName, objectName } = parseObjectPath(path);
		const bucket = objectStorageClient.bucket(bucketName);
		const file = bucket.file(objectName);
		await file.save(buffer, {
			metadata: {
				contentType: contentType || "application/octet-stream",
				// S7: Retention metadata — SEBI 7-year document retention policy
				metadata: {
					retentionPolicy: "sebi_7yr",
					uploadedAt: new Date().toISOString(),
					...customMeta,
				},
			},
		});
	}

	private async downloadFromStorage(path: string): Promise<Buffer> {
		const { bucketName, objectName } = parseObjectPath(path);
		const bucket = objectStorageClient.bucket(bucketName);
		const file = bucket.file(objectName);
		const [contents] = await file.download();
		return contents;
	}

	private getPrivateDir(): string {
		try {
			return objectStorageService.getPrivateObjectDir();
		} catch {
			return process.env.PRIVATE_OBJECT_DIR || "";
		}
	}

	async uploadDocument(
		buffer: Buffer,
		options: UploadOptions,
	): Promise<DocumentUploadResult> {
		const ext = this.getFileExtension(options.fileName).toLowerCase();
		const timestamp = Date.now();
		const baseName = options.fileName.replace(/\.[^/.]+$/, "");
		const sanitizedName = baseName.replace(/[^a-zA-Z0-9-_]/g, "_");

		const documentHash = this.generateHash(buffer);
		const privateDir = this.getPrivateDir();

		if (!privateDir) {
			throw new Error(
				"Object storage not configured. Please set up object storage first.",
			);
		}

		const originalPath = `${privateDir}/documents/${options.proposalId || "general"}/${timestamp}_${sanitizedName}${ext}`;

		let contentType = "application/octet-stream";
		if (ext === ".pdf") {
			contentType = "application/pdf";
		} else if (ext === ".docx") {
			contentType =
				"application/vnd.openxmlformats-officedocument.wordprocessingml.document";
		} else if (ext === ".doc") {
			contentType = "application/msword";
		}

		await this.uploadToStorage(originalPath, buffer, contentType, {
			documentHash,
			uploadedByUserId: options.userId,
			proposalId: options.proposalId || "general",
			retentionExpiresAt: new Date(
				Date.now() + 7 * 365 * 24 * 60 * 60 * 1000,
			).toISOString(),
		});

		let displayUrl = originalPath;
		let convertedFormat = ext.replace(".", "");
		let htmlContent: string | undefined;

		if (ext === ".docx") {
			try {
				const result = await mammoth.convertToHtml({ buffer });
				htmlContent = result.value;

				const htmlPath = `${privateDir}/documents/${options.proposalId || "general"}/${timestamp}_${sanitizedName}.html`;
				const htmlBuffer = this.generateStyledHtml(
					htmlContent,
					options.fileName,
				);
				await this.uploadToStorage(htmlPath, htmlBuffer, "text/html", {
					documentHash,
					parentDocument: originalPath,
				});
				displayUrl = htmlPath;
				convertedFormat = "html";
			} catch (conversionError) {
				console.error("DOCX conversion error:", conversionError);
				throw conversionError;
			}
		}

		if (ext === ".doc") {
			console.log(
				"[DocumentUpload] .doc file uploaded - no HTML conversion available for legacy format",
			);
		}

		return {
			originalUrl: originalPath,
			displayUrl,
			documentHash,
			originalFormat: ext.replace(".", ""),
			convertedFormat,
			htmlContent,
		};
	}

	private generateStyledHtml(html: string, title: string): Buffer {
		const fullHtml = `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>${title}</title>
  <style>
    body {
      font-family: 'Times New Roman', serif;
      font-size: 12pt;
      line-height: 1.6;
      margin: 40px auto;
      max-width: 800px;
      padding: 20px;
      color: #333;
      background: #fff;
    }
    h1 { font-size: 20pt; margin-bottom: 16pt; color: #1a1a1a; }
    h2 { font-size: 16pt; margin-bottom: 12pt; color: #2a2a2a; }
    h3 { font-size: 14pt; margin-bottom: 10pt; color: #3a3a3a; }
    p { margin-bottom: 12pt; text-align: justify; }
    table { border-collapse: collapse; width: 100%; margin: 16pt 0; }
    td, th { border: 1px solid #ddd; padding: 8pt; text-align: left; }
    th { background: #f5f5f5; font-weight: bold; }
    ul, ol { margin-bottom: 12pt; padding-left: 24pt; }
    li { margin-bottom: 6pt; }
    .signature-block {
      margin-top: 40px;
      padding: 20px;
      border-top: 2px solid #333;
    }
    @media print {
      body { margin: 0; padding: 0; }
    }
  </style>
</head>
<body>
${html}
</body>
</html>`;

		return Buffer.from(fullHtml, "utf-8");
	}

	async getDocumentUrl(path: string): Promise<string> {
		try {
			const buffer = await this.downloadFromStorage(path);

			const base64 = buffer.toString("base64");
			const ext = this.getFileExtension(path).toLowerCase();
			const mimeType =
				ext === ".pdf"
					? "application/pdf"
					: ext === ".docx"
						? "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
						: ext === ".html"
							? "text/html"
							: "application/octet-stream";

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

	async extractDocxContent(
		buffer: Buffer,
	): Promise<{ html: string; text: string; messages: string[] }> {
		const htmlResult = await mammoth.convertToHtml({ buffer });
		const textResult = await mammoth.extractRawText({ buffer });

		return {
			html: htmlResult.value,
			text: textResult.value,
			messages: [...htmlResult.messages, ...textResult.messages].map(
				(m) => m.message,
			),
		};
	}
}

export const documentUploadService = new DocumentUploadService();
