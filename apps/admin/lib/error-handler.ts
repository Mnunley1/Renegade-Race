import { toast } from "sonner"

export type ErrorType =
  | "authentication"
  | "authorization"
  | "validation"
  | "network"
  | "not_found"
  | "duplicate"
  | "file_upload"
  | "payment"
  | "generic"

interface ErrorHandlerOptions {
  fallbackMessage?: string
  showToast?: boolean
  logError?: boolean
}

/**
 * Extracts user-friendly error message from various error types
 */
export function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    const message = error.message.toLowerCase()

    // Authentication errors
    if (message.includes("not authenticated") || message.includes("authentication")) {
      return "Please sign in to continue"
    }

    // Authorization errors
    if (
      message.includes("not authorized") ||
      message.includes("permission") ||
      message.includes("forbidden")
    ) {
      return "You don't have permission to perform this action"
    }

    // Validation errors
    if (message.includes("required") || message.includes("invalid")) {
      return error.message // Show validation message as-is
    }

    // Duplicate/Already exists errors
    if (
      message.includes("already exists") ||
      message.includes("already created") ||
      message.includes("already submitted")
    ) {
      return "This item already exists. Please check and try again."
    }

    // Not found errors
    if (message.includes("not found") || message.includes("does not exist")) {
      return "The requested item could not be found"
    }

    // File upload errors
    if (message.includes("too large") || message.includes("file size")) {
      return "File is too large. Please use a smaller file."
    }
    if (message.includes("invalid file") || message.includes("file type")) {
      return "Invalid file type. Please check the file format."
    }

    // Network errors
    if (message.includes("network") || message.includes("fetch") || message.includes("timeout")) {
      return "Network error. Please check your connection and try again."
    }

    // Payment errors
    if (message.includes("payment") || message.includes("stripe") || message.includes("card")) {
      return "Payment processing error. Please check your payment method and try again."
    }

    // Return original message if it's user-friendly, otherwise generic
    return error.message.length < 100 ? error.message : "An unexpected error occurred"
  }

  return "An unexpected error occurred"
}

/**
 * Determines error type from error message
 */
export function getErrorType(error: unknown): ErrorType {
  if (error instanceof Error) {
    const message = error.message.toLowerCase()

    if (message.includes("not authenticated") || message.includes("authentication")) {
      return "authentication"
    }
    if (
      message.includes("not authorized") ||
      message.includes("permission") ||
      message.includes("forbidden")
    ) {
      return "authorization"
    }
    if (message.includes("already exists") || message.includes("already created")) {
      return "duplicate"
    }
    if (message.includes("not found")) {
      return "not_found"
    }
    if (message.includes("too large") || message.includes("file")) {
      return "file_upload"
    }
    if (message.includes("network") || message.includes("fetch")) {
      return "network"
    }
    if (message.includes("payment") || message.includes("stripe")) {
      return "payment"
    }
  }

  return "generic"
}

/**
 * Handles errors with user-friendly messages and optional logging
 */
export function handleError(error: unknown, options: ErrorHandlerOptions = {}): string {
  const {
    fallbackMessage = "Something went wrong. Please try again.",
    showToast = true,
    logError = true,
  } = options

  // Log error for debugging
  if (logError) {
    console.error("Error:", error)
  }

  // Get user-friendly message
  const userMessage = getErrorMessage(error) || fallbackMessage

  // Show toast notification
  if (showToast) {
    toast.error(userMessage)
  }

  return userMessage
}

/**
 * Handles errors with custom context-specific messages
 */
export function handleErrorWithContext(
  error: unknown,
  context: {
    action: string
    entity?: string
    customMessages?: Partial<Record<ErrorType, string>>
  }
): string {
  const errorType = getErrorType(error)
  const customMessage = context.customMessages?.[errorType]

  if (customMessage) {
    toast.error(customMessage)
    return customMessage
  }

  // Default context-aware messages
  const defaultMessages: Partial<Record<ErrorType, string>> = {
    authentication: `Please sign in to ${context.action}`,
    authorization: `You don't have permission to ${context.action}`,
    not_found: `${context.entity || "Item"} not found`,
    duplicate: `This ${context.entity || "item"} already exists`,
    network: `Failed to ${context.action}. Please check your connection.`,
    generic: `Failed to ${context.action}. Please try again.`,
  }

  const message =
    customMessage || defaultMessages[errorType] || `Failed to ${context.action}. Please try again.`
  toast.error(message)

  return message
}
