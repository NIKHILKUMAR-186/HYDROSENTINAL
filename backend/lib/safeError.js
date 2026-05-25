const fs = require("fs");
const path = require("path");

function safeErrorResponse(res, statusCode, publicMessage = "Internal server error", err = null, context = {}) {
  const timestamp = new Date().toISOString();

  // Build a sanitized log entry
  const logEntry = {
    timestamp,
    statusCode: Number(statusCode) || 500,
    publicMessage,
    context: context || {},
  };

  if (err instanceof Error) {
    logEntry.errorMessage = err.message;
    logEntry.errorStack = err.stack;
  } else if (err) {
    try {
      logEntry.errorMessage = typeof err === "string" ? err : JSON.stringify(err);
    } catch {
      logEntry.errorMessage = String(err);
    }
  }

  try {
    // Write structured log to a file for later ingestion by log processors
    const logsDir = path.join(__dirname, "..", "logs");
    if (!fs.existsSync(logsDir)) {
      fs.mkdirSync(logsDir, { recursive: true });
    }
    const logPath = path.join(logsDir, "errors.log");
    fs.appendFileSync(logPath, JSON.stringify(logEntry) + "\n");
  } catch (fileErr) {
    // Fall back to console logging if file write fails
    try {
      console.error("[safeError][fileWriteFailed]", fileErr);
    } catch {}
  }

  try {
    // Also log to console (server-side) with full stack when available
    const ctx = context && Object.keys(context).length ? ` context=${JSON.stringify(context)}` : "";
    if (err && err.stack) {
      console.error(`[safeError] ${publicMessage}${ctx}:`, err.stack);
    } else if (err && err.message) {
      console.error(`[safeError] ${publicMessage}${ctx}:`, err.message);
    } else if (err) {
      console.error(`[safeError] ${publicMessage}${ctx}:`, err);
    } else {
      console.error(`[safeError] ${publicMessage}${ctx}`);
    }
  } catch (loggingError) {
    console.error("[safeError] Failed to log error:", loggingError);
  }

  // Forward to Sentry if configured. Keep this optional and fail-safe.
  try {
    if (process.env.SENTRY_DSN) {
      try {
        const Sentry = require('@sentry/node');
        if (Sentry && typeof Sentry.captureException === 'function' && err) {
          Sentry.captureException(err, { extra: logEntry });
        }
      } catch (sentryErr) {
        // Do not allow Sentry failures to affect response flow
        console.warn('[safeError] Sentry capture failed:', sentryErr && sentryErr.message ? sentryErr.message : sentryErr);
      }
    }
  } catch (ignore) {}

  try {
    // Only send a minimal, non-sensitive message to clients
    return res.status(statusCode).json({ success: false, message: publicMessage });
  } catch (sendError) {
    // If sending the response fails, at least log it and end the request
    console.error("[safeError] Failed to send error response:", sendError);
    try {
      res.statusCode = statusCode;
      res.end(publicMessage);
    } catch (e) {
      // swallow
    }
  }
}

module.exports = { safeErrorResponse };
