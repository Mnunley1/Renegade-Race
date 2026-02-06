/**
 * Structured Error System for Convex Backend
 *
 * This module provides standardized error codes and a helper function
 * to throw structured errors that the frontend can parse and handle.
 *
 * Error format: "ERROR_CODE: Human-readable message"
 *
 * Example usage:
 * ```ts
 * import { throwError, ErrorCode } from "./errors"
 *
 * if (!user) {
 *   throwError(ErrorCode.NOT_FOUND, "User not found", { userId })
 * }
 * ```
 */

/**
 * Standard error codes used throughout the backend.
 *
 * These codes allow the frontend to:
 * - Show appropriate UI messages
 * - Redirect users (e.g., AUTH_REQUIRED -> login)
 * - Display specific error states
 */
export const ErrorCode = {
  // ============================================================================
  // Authentication & Authorization
  // ============================================================================
  AUTH_REQUIRED: "AUTH_REQUIRED",
  FORBIDDEN: "FORBIDDEN",
  ADMIN_REQUIRED: "ADMIN_REQUIRED",
  ACCOUNT_BANNED: "ACCOUNT_BANNED",

  // ============================================================================
  // Resource Errors
  // ============================================================================
  NOT_FOUND: "NOT_FOUND",
  ALREADY_EXISTS: "ALREADY_EXISTS",
  CONFLICT: "CONFLICT",

  // ============================================================================
  // Validation Errors
  // ============================================================================
  INVALID_INPUT: "INVALID_INPUT",
  INVALID_DATE_RANGE: "INVALID_DATE_RANGE",
  INVALID_AMOUNT: "INVALID_AMOUNT",
  PRICE_CHANGED: "PRICE_CHANGED",

  // ============================================================================
  // Business Logic Errors
  // ============================================================================
  DATES_UNAVAILABLE: "DATES_UNAVAILABLE",
  DATES_CONFLICT: "DATES_CONFLICT",
  CANNOT_BOOK_OWN_VEHICLE: "CANNOT_BOOK_OWN_VEHICLE",
  USER_BLOCKED: "USER_BLOCKED",
  INVALID_STATUS: "INVALID_STATUS",

  // ============================================================================
  // Payment & Stripe Errors
  // ============================================================================
  PAYMENT_FAILED: "PAYMENT_FAILED",
  PAYMENT_REQUIRED: "PAYMENT_REQUIRED",
  STRIPE_ERROR: "STRIPE_ERROR",
  STRIPE_ACCOUNT_INCOMPLETE: "STRIPE_ACCOUNT_INCOMPLETE",
  STRIPE_ACCOUNT_DISABLED: "STRIPE_ACCOUNT_DISABLED",
  REFUND_FAILED: "REFUND_FAILED",
  INVALID_REFUND_AMOUNT: "INVALID_REFUND_AMOUNT",

  // ============================================================================
  // Rate Limiting
  // ============================================================================
  RATE_LIMITED: "RATE_LIMITED",

  // ============================================================================
  // System Errors
  // ============================================================================
  INTERNAL_ERROR: "INTERNAL_ERROR",
} as const

export type ErrorCodeType = (typeof ErrorCode)[keyof typeof ErrorCode]

/**
 * Optional details object for additional error context.
 * This is logged but not necessarily shown to end users.
 */
export interface ErrorDetails {
  [key: string]: any
}

/**
 * Throw a structured error with a specific error code.
 *
 * The error message format is: "ERROR_CODE: message"
 * This allows the frontend to parse the code and handle it appropriately.
 *
 * @param code - The error code from ErrorCode enum
 * @param message - Human-readable error message (optional, defaults to code)
 * @param details - Additional context (optional, for logging/debugging)
 *
 * @example
 * ```ts
 * throwError(ErrorCode.NOT_FOUND, "Vehicle not found", { vehicleId })
 * ```
 */
export function throwError(
  code: ErrorCodeType,
  message?: string,
  details?: ErrorDetails
): never {
  const errorMessage = message ? `${code}: ${message}` : code

  // If details are provided, we could log them (but Convex doesn't persist logs easily)
  // For now, just throw the structured error message
  if (details && Object.keys(details).length > 0) {
    // In a production system, you might want to log details to an external service
    // For now, we'll include them in the error for debugging
    console.error(`Error ${code}:`, message, details)
  }

  throw new Error(errorMessage)
}

/**
 * Parse an error code from an error message.
 *
 * Utility function for the frontend to extract the error code
 * from a Convex error message.
 *
 * @param errorMessage - The error message string
 * @returns The error code if found, or null
 *
 * @example
 * ```ts
 * const code = parseErrorCode("AUTH_REQUIRED: Not authenticated")
 * // Returns "AUTH_REQUIRED"
 * ```
 */
export function parseErrorCode(errorMessage: string): ErrorCodeType | null {
  if (!errorMessage) return null

  // Check if message starts with any known error code
  for (const code of Object.values(ErrorCode)) {
    if (errorMessage.startsWith(`${code}:`)) {
      return code as ErrorCodeType
    }
    // Also check if the entire message is just the code
    if (errorMessage === code) {
      return code as ErrorCodeType
    }
  }

  return null
}

/**
 * Check if an error message contains a specific error code.
 *
 * @param errorMessage - The error message string
 * @param code - The error code to check for
 * @returns True if the error contains the specified code
 */
export function hasErrorCode(errorMessage: string, code: ErrorCodeType): boolean {
  return parseErrorCode(errorMessage) === code
}
