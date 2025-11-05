/**
 * PII Sanitization Utilities
 * Ensures sensitive personal data is redacted from logs and error messages
 * for regulatory compliance (RBI/SEBI/DPDPA requirements)
 */

/**
 * Sanitize error messages to prevent PII leakage in logs
 * Redacts: PAN numbers, Aadhaar numbers, emails, phone numbers
 */
export function sanitizeErrorMessage(message: string): string {
  if (!message) return message;
  
  let sanitized = message;
  
  // Redact PAN numbers (10 alphanumeric: ABCDE1234F → ABC****34F)
  sanitized = sanitized.replace(
    /\b[A-Z]{3}[ABCFGHLJPT][A-Z]\d{4}[A-Z]\b/g,
    (match) => `${match.substring(0, 3)}****${match.substring(7)}`
  );
  
  // Redact Aadhaar numbers (12 digits: 123456789012 → ****56789012)
  sanitized = sanitized.replace(
    /\b\d{12}\b/g,
    (match) => `****${match.substring(8)}`
  );
  
  // Redact email addresses (user@example.com → u***@example.com)
  sanitized = sanitized.replace(
    /\b[\w\.-]+@[\w\.-]+\.\w+\b/g,
    (match) => {
      const [local, domain] = match.split('@');
      return `${local[0]}***@${domain}`;
    }
  );
  
  // Redact phone numbers (10 digits: 9876543210 → ****543210)
  sanitized = sanitized.replace(
    /\b\d{10}\b/g,
    (match) => `****${match.substring(6)}`
  );
  
  return sanitized;
}

/**
 * Sanitize an entire error object for logging
 * Ensures message, stack trace, and any custom properties are PII-free
 */
export function sanitizeError(error: any): any {
  if (!error) return error;
  
  const sanitized: any = {
    name: error.name,
    message: sanitizeErrorMessage(error.message || ''),
    code: error.code
  };
  
  // Sanitize stack trace
  if (error.stack) {
    sanitized.stack = sanitizeErrorMessage(error.stack);
  }
  
  // Sanitize any additional properties
  for (const key in error) {
    if (typeof error[key] === 'string' && !['name', 'message', 'stack', 'code'].includes(key)) {
      sanitized[key] = sanitizeErrorMessage(error[key]);
    }
  }
  
  return sanitized;
}

/**
 * Redact PAN number for display purposes
 * Example: ABCDE1234F → ABC****34F
 */
export function redactPAN(pan: string): string {
  if (!pan || pan.length !== 10) return '***';
  return `${pan.substring(0, 3)}****${pan.substring(7)}`;
}

/**
 * Redact Aadhaar number for display purposes
 * Example: 123456789012 → ****56789012
 */
export function redactAadhaar(aadhaar: string): string {
  if (!aadhaar || aadhaar.length !== 12) return '***';
  return `****${aadhaar.substring(8)}`;
}

/**
 * Redact mobile number for display purposes
 * Example: 9876543210 → ****543210
 */
export function redactMobile(mobile: string): string {
  if (!mobile || mobile.length !== 10) return '***';
  return `****${mobile.substring(6)}`;
}

/**
 * Redact email for display purposes
 * Example: user@example.com → u***@example.com
 */
export function redactEmail(email: string): string {
  if (!email || !email.includes('@')) return '***';
  const [local, domain] = email.split('@');
  return `${local[0]}***@${domain}`;
}
