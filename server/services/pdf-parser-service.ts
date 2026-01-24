import { PDFParse } from 'pdf-parse';

export interface PDFParseResult {
  text: string;
  pageCount?: number;
  info?: Record<string, any>;
  metadata?: Record<string, any>;
}

export interface PDFParseOptions {
  maxPages?: number;
  maxFileSize?: number; // in bytes
}

export interface SafeParseResult {
  success: boolean;
  result?: PDFParseResult;
  error?: string;
  errorCode?: 'INVALID_INPUT' | 'FILE_TOO_LARGE' | 'PARSE_ERROR' | 'EMPTY_CONTENT' | 'UNKNOWN';
}

const DEFAULT_MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB

class PDFParserService {
  private static instance: PDFParserService;

  private constructor() {
    console.log('✅ PDF Parser Service initialized');
  }

  static getInstance(): PDFParserService {
    if (!PDFParserService.instance) {
      PDFParserService.instance = new PDFParserService();
    }
    return PDFParserService.instance;
  }

  /**
   * Extract text from a PDF buffer or base64 string
   * Throws an error if parsing fails
   */
  async extractText(input: Buffer | string, options: PDFParseOptions = {}): Promise<PDFParseResult> {
    const { maxFileSize = DEFAULT_MAX_FILE_SIZE } = options;

    // Convert base64 string to buffer if needed
    let buffer: Buffer;
    if (typeof input === 'string') {
      try {
        buffer = Buffer.from(input, 'base64');
      } catch (err) {
        throw new Error('Invalid base64 input');
      }
    } else {
      buffer = input;
    }

    // Validate buffer
    if (!buffer || buffer.length === 0) {
      throw new Error('Empty or invalid PDF input');
    }

    // Check file size
    if (buffer.length > maxFileSize) {
      throw new Error(`PDF file size (${(buffer.length / 1024 / 1024).toFixed(2)}MB) exceeds maximum allowed (${(maxFileSize / 1024 / 1024).toFixed(2)}MB)`);
    }

    // Validate PDF header
    const header = buffer.slice(0, 5).toString();
    if (header !== '%PDF-') {
      throw new Error('Invalid PDF file: missing PDF header');
    }

    let parser: PDFParse | null = null;

    try {
      parser = new PDFParse({ data: buffer });
      const result = await parser.getText();

      const parseResult: PDFParseResult = {
        text: result.text || '',
        pageCount: result.numpages,
        info: result.info,
        metadata: result.metadata
      };

      // Validate we got some content
      if (!parseResult.text || parseResult.text.trim().length === 0) {
        console.warn('[PDFParser] Warning: PDF parsed but contains no extractable text');
      }

      return parseResult;
    } finally {
      // Always clean up parser to prevent memory leaks
      if (parser) {
        try {
          await parser.destroy();
        } catch (destroyError) {
          console.warn('[PDFParser] Warning: Failed to destroy parser instance', destroyError);
        }
      }
    }
  }

  /**
   * Safe version of extractText that never throws
   * Returns a result object with success flag and error details
   */
  async extractTextSafe(input: Buffer | string, options: PDFParseOptions = {}): Promise<SafeParseResult> {
    try {
      // Validate input exists
      if (!input) {
        return {
          success: false,
          error: 'No input provided',
          errorCode: 'INVALID_INPUT'
        };
      }

      // Check for base64 string validity
      if (typeof input === 'string' && input.length === 0) {
        return {
          success: false,
          error: 'Empty base64 string provided',
          errorCode: 'INVALID_INPUT'
        };
      }

      const result = await this.extractText(input, options);

      if (!result.text || result.text.trim().length === 0) {
        return {
          success: true,
          result,
          error: 'PDF parsed but contains no extractable text',
          errorCode: 'EMPTY_CONTENT'
        };
      }

      return {
        success: true,
        result
      };
    } catch (error: any) {
      const errorMessage = error?.message || 'Unknown parsing error';
      
      let errorCode: SafeParseResult['errorCode'] = 'UNKNOWN';
      
      if (errorMessage.includes('Invalid') || errorMessage.includes('Empty')) {
        errorCode = 'INVALID_INPUT';
      } else if (errorMessage.includes('exceeds maximum')) {
        errorCode = 'FILE_TOO_LARGE';
      } else {
        errorCode = 'PARSE_ERROR';
      }

      console.error('[PDFParser] Parse error:', errorMessage);

      return {
        success: false,
        error: errorMessage,
        errorCode
      };
    }
  }

  /**
   * Check if a buffer appears to be a valid PDF
   */
  isValidPDF(input: Buffer | string): boolean {
    try {
      let buffer: Buffer;
      if (typeof input === 'string') {
        buffer = Buffer.from(input, 'base64');
      } else {
        buffer = input;
      }

      if (!buffer || buffer.length < 5) {
        return false;
      }

      const header = buffer.slice(0, 5).toString();
      return header === '%PDF-';
    } catch {
      return false;
    }
  }

  /**
   * Get estimated file size from input
   */
  getFileSize(input: Buffer | string): number {
    if (typeof input === 'string') {
      // Estimate size from base64 (base64 is ~4/3 larger than binary)
      return Math.floor(input.length * 0.75);
    }
    return input.length;
  }
}

export const pdfParserService = PDFParserService.getInstance();
