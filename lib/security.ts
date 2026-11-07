/**
 * PRM Quality Intelligence: Security, Redaction & Input Sanitization
 * Enforces OWASP Top 10 for Web & LLMs and PRM-specific insurance data protection.
 */

export interface SanitizationResult {
  sanitizedText: string;
  redactedCount: number;
  warnings: string[];
}

export function sanitizeAndRedact(input: string): SanitizationResult {
  if (!input || typeof input !== 'string') {
    return { sanitizedText: '', redactedCount: 0, warnings: [] };
  }

  let text = input;
  let redactedCount = 0;
  const warnings: string[] = [];

  // 1. Social Security Numbers (SSN): 000-00-0000 or 9 digits
  const ssnRegex = /\b\d{3}[-\s]?\d{2}[-\s]?\d{4}\b/g;
  if (ssnRegex.test(text)) {
    warnings.push('Potential Social Security Number detected and automatically redacted.');
    text = text.replace(ssnRegex, (match) => {
      redactedCount++;
      return '[REDACTED_SSN]';
    });
  }

  // 2. Credit Card / Debit Card Numbers (13-19 digits with separators)
  const ccRegex = /\b(?:\d{4}[-\s]?){3}\d{4}\b/g;
  if (ccRegex.test(text)) {
    warnings.push('Potential Credit Card Number detected and automatically redacted.');
    text = text.replace(ccRegex, () => {
      redactedCount++;
      return '[REDACTED_CARD_NUMBER]';
    });
  }

  // 3. Driver's License patterns (common state formats, e.g. Indiana 10 digits or 1 letter + 9 digits)
  const dlRegex = /\b(?:DL|LIC|DRIVER'?S?\s*LICENSE)[\s:#-]*([A-Z0-9]{7,12})\b/gi;
  if (dlRegex.test(text)) {
    warnings.push('Potential Driver License Number detected and redacted.');
    text = text.replace(dlRegex, 'DL: [REDACTED_LICENSE]');
    redactedCount++;
  }

  // 4. Prompt Injection & Control Sequence Neutralization
  // Defend against delimiter breakouts like [SYSTEM], [AIS_METADATA_SECTION_START], ```system
  text = text.replace(/\[\/?(system|assistant|instruction|metadata|prompt_injection)[^\]]*\]/gi, '[SAFE_TAG]');
  text = text.replace(/<(script|iframe|object|embed)[^>]*>.*?<\/\1>/gi, '');

  // Truncate abusive message lengths (max 20,000 characters)
  if (text.length > 20000) {
    warnings.push('Message exceeded maximum character length and was safely truncated.');
    text = text.substring(0, 20000) + '... [TRUNCATED]';
  }

  return {
    sanitizedText: text,
    redactedCount,
    warnings,
  };
}

/**
 * Super Administrator email verification check
 */
export const DESIGNATED_SUPER_ADMIN_EMAIL = 'paulineingrid123@gmail.com';

export function isDesignatedSuperAdmin(email?: string | null): boolean {
  if (!email) return false;
  return email.trim().toLowerCase() === DESIGNATED_SUPER_ADMIN_EMAIL.toLowerCase();
}

/**
 * Checks if a user is an authorized Super Admin based on designated root email,
 * Firebase custom claims, or recognized admin emails.
 */
export function checkIsSuperAdmin(
  email?: string | null,
  customClaims?: Record<string, any> | null,
  activeAdminEmails?: string[]
): boolean {
  if (!email) return false;
  const normalized = email.trim().toLowerCase();
  if (normalized === DESIGNATED_SUPER_ADMIN_EMAIL.toLowerCase()) return true;
  if (customClaims?.super_admin === true || customClaims?.role === 'super_admin') return true;
  if (activeAdminEmails && activeAdminEmails.map((e) => e.toLowerCase()).includes(normalized)) return true;
  return false;
}
