/**
 * Input sanitization utilities for preventing XSS attacks.
 *
 * These functions escape HTML special characters in user-provided content
 * before storing in the database.
 */

/**
 * HTML entity map for escaping special characters
 */
const HTML_ENTITIES: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#x27;',
  '/': '&#x2F;',
  '`': '&#x60;',
  '=': '&#x3D;',
}

/**
 * Escape HTML special characters to prevent XSS attacks.
 *
 * @param input - The string to sanitize
 * @returns The sanitized string with HTML entities escaped
 */
export function escapeHtml(input: string): string {
  if (typeof input !== 'string') {
    return ''
  }
  return input.replace(/[&<>"'`=/]/g, (char) => HTML_ENTITIES[char] || char)
}

/**
 * Sanitize user-provided text content.
 * - Escapes HTML special characters
 * - Trims whitespace
 * - Limits length (optional)
 *
 * @param input - The string to sanitize
 * @param maxLength - Optional maximum length (default: no limit)
 * @returns The sanitized string
 */
export function sanitizeText(input: string, maxLength?: number): string {
  if (typeof input !== 'string') {
    return ''
  }

  let sanitized = escapeHtml(input.trim())

  if (maxLength && sanitized.length > maxLength) {
    sanitized = sanitized.slice(0, maxLength)
  }

  return sanitized
}

/**
 * Sanitize a message (for chat/messaging features).
 * More permissive than general text - allows longer content.
 *
 * @param input - The message content to sanitize
 * @returns The sanitized message
 */
export function sanitizeMessage(input: string): string {
  return sanitizeText(input, 10000) // 10k character limit for messages
}

/**
 * Sanitize a review or response text.
 *
 * @param input - The review text to sanitize
 * @returns The sanitized review text
 */
export function sanitizeReview(input: string): string {
  return sanitizeText(input, 5000) // 5k character limit for reviews
}

/**
 * Sanitize a short text field (like names, titles, etc.)
 *
 * @param input - The short text to sanitize
 * @returns The sanitized text
 */
export function sanitizeShortText(input: string): string {
  return sanitizeText(input, 500) // 500 character limit for short text
}
