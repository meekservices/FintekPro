/**
 * String Utilities for Alpaca Compliance
 * 
 * Alpaca's Broker API requires ASCII (32-126) for core identity data.
 */

/**
 * Normalizes a string to ASCII by:
 * 1. Decomposing Unicode (NFD) to separate base characters from accents.
 * 2. Removing non-spacing marks (accents).
 * 3. Removing any remaining non-ASCII characters.
 * 4. Trimming whitespace.
 */
export function toAlpacaAscii(str: string): string {
  if (!str) return '';
  
  // 1. Normalize to NFD (Canonical Decomposition)
  // This turns 'é' into 'e' + '́'
  const normalized = str.normalize('NFD');
  
  // 2. Remove non-spacing marks (U+0300 to U+036F)
  // and keep only ASCII 32-126
  let result = '';
  for (let i = 0; i < normalized.length; i++) {
    const code = normalized.charCodeAt(i);
    // ASCII range 32-126
    if (code >= 32 && code <= 126) {
      result += normalized[i];
    }
  }
  
  return result.trim();
}

/**
 * Specifically cleans alphanumeric strings like Tax IDs or Postal Codes.
 */
export function cleanAlphanumeric(str: string): string {
  if (!str) return '';
  return str.replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
}
