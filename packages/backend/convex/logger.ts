/**
 * Centralized logging utility for Convex backend functions
 *
 * Note: Convex runs in a V8 runtime where packages like Sentry don't work.
 * Instead, use structured logging that can be picked up by Convex's log viewer
 * or sent to an external service via HTTP actions if needed.
 */

export type LogLevel = "debug" | "info" | "warn" | "error"

interface LogEntry {
  level: LogLevel
  message: string
  context?: string
  timestamp: string
  error?: {
    name: string
    message: string
    stack?: string
  }
  metadata?: Record<string, unknown>
}

/**
 * Creates a structured log entry
 */
function createLogEntry(
  level: LogLevel,
  message: string,
  options?: {
    context?: string
    error?: unknown
    metadata?: Record<string, unknown>
  }
): LogEntry {
  const entry: LogEntry = {
    level,
    message,
    timestamp: new Date().toISOString(),
  }

  if (options?.context) {
    entry.context = options.context
  }

  if (options?.error) {
    if (options.error instanceof Error) {
      entry.error = {
        name: options.error.name,
        message: options.error.message,
        stack: options.error.stack,
      }
    } else {
      entry.error = {
        name: "UnknownError",
        message: String(options.error),
      }
    }
  }

  if (options?.metadata) {
    entry.metadata = options.metadata
  }

  return entry
}

/**
 * Logs a debug message
 */
export function logDebug(message: string, metadata?: Record<string, unknown>): void {
  const entry = createLogEntry("debug", message, { metadata })
  console.debug(JSON.stringify(entry))
}

/**
 * Logs an info message
 */
export function logInfo(message: string, metadata?: Record<string, unknown>): void {
  const entry = createLogEntry("info", message, { metadata })
  console.info(JSON.stringify(entry))
}

/**
 * Logs a warning message
 */
export function logWarn(message: string, metadata?: Record<string, unknown>): void {
  const entry = createLogEntry("warn", message, { metadata })
  console.warn(JSON.stringify(entry))
}

/**
 * Logs an error with optional context
 * Compatible with existing code that uses logError(error, context)
 */
export function logError(
  error: unknown,
  context?: string,
  metadata?: Record<string, unknown>
): void {
  const errorMessage = error instanceof Error ? error.message : String(error)
  const logMessage = context ? `${context}: ${errorMessage}` : errorMessage

  const entry = createLogEntry("error", logMessage, { context, error, metadata })

  // Log structured entry for log aggregation
  console.error(JSON.stringify(entry))
}

/**
 * Creates a correlation ID for tracing requests across functions
 */
export function createCorrelationId(): string {
  return `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`
}

/**
 * Logs a function invocation start with correlation ID
 */
export function logFunctionStart(
  functionName: string,
  correlationId: string,
  metadata?: Record<string, unknown>
): void {
  logInfo(`Function started: ${functionName}`, {
    correlationId,
    functionName,
    ...metadata,
  })
}

/**
 * Logs a function invocation end with duration
 */
export function logFunctionEnd(
  functionName: string,
  correlationId: string,
  startTime: number,
  metadata?: Record<string, unknown>
): void {
  const duration = Date.now() - startTime
  logInfo(`Function completed: ${functionName}`, {
    correlationId,
    functionName,
    durationMs: duration,
    ...metadata,
  })
}
