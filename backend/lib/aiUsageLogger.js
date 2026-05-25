/**
 * AI Usage Logger & Token Budget Manager
 * 
 * Tracks LLM API usage per user, logs token consumption, and enforces budgets.
 * Prevents cost escalation and abuse through per-user token limits.
 */

const fs = require("fs");
const path = require("path");

// Storage: In-memory for hackathon (use Firestore/DB in production)
const tokenBudgets = new Map(); // key: userId, value: { daily_tokens, last_reset_date }

const AI_LOGGING_CONFIG = {
  LOG_DIR: path.join(__dirname, "logs"),
  LOG_FILE: path.join(__dirname, "logs", "ai-usage.log"),
  DAILY_TOKEN_LIMIT: 50000,         // 50k tokens per user per day
  PER_REQUEST_MAX_TOKENS: 140,       // Max output tokens per request (set in LLM call)
  BURST_LIMIT_WINDOW_MS: 60 * 1000, // 1 minute window for burst detection
  BURST_LIMIT_TOKENS: 5000,          // Max tokens in 1 minute
};

/**
 * Initialize AI logging directory
 */
function initializeAiLogging() {
  if (!fs.existsSync(AI_LOGGING_CONFIG.LOG_DIR)) {
    fs.mkdirSync(AI_LOGGING_CONFIG.LOG_DIR, { recursive: true });
  }
}

/**
 * Log AI API request (tokens, user, question, response)
 * 
 * @param {string} userId - User ID (from auth or x-user-id header)
 * @param {number} inputTokens - Input token count
 * @param {number} outputTokens - Output token count
 * @param {number} questionLength - Character count of question
 * @param {number} answerLength - Character count of answer
 * @param {string} status - Request status (success, rate_limited, error)
 * @param {object} metadata - Additional context
 */
function logAiUsage({
  userId,
  inputTokens = 0,
  outputTokens = 0,
  questionLength = 0,
  answerLength = 0,
  status = "success",
  model = "gemini-1.5-flash",
  metadata = {},
}) {
  const timestamp = new Date().toISOString();
  const totalTokens = inputTokens + outputTokens;

  const logEntry = {
    timestamp,
    userId: userId || "anonymous",
    inputTokens,
    outputTokens,
    totalTokens,
    questionLength,
    answerLength,
    status,
    model,
    costUsd: calculateTokenCost(inputTokens, outputTokens),
    metadata: JSON.stringify(metadata),
  };

  // Write to log file
  const logLine = JSON.stringify(logEntry) + "\n";
  try {
    fs.appendFileSync(AI_LOGGING_CONFIG.LOG_FILE, logLine);
  } catch (err) {
    console.warn("Failed to write AI usage log:", err.message);
  }

  // Update in-memory budget
  updateTokenBudget(userId, totalTokens);

  return logEntry;
}

/**
 * Calculate USD cost of tokens (Gemini 1.5 Flash pricing)
 * Input: $0.075 per 1M tokens
 * Output: $0.30 per 1M tokens
 */
function calculateTokenCost(inputTokens, outputTokens) {
  const inputCost = (inputTokens / 1_000_000) * 0.075;
  const outputCost = (outputTokens / 1_000_000) * 0.30;
  return +(inputCost + outputCost).toFixed(6);
}

/**
 * Get or create user's daily token budget tracker
 */
function getOrCreateTokenBudget(userId) {
  if (!tokenBudgets.has(userId)) {
    tokenBudgets.set(userId, {
      daily_tokens: 0,
      last_reset_date: new Date().toDateString(),
      requests_today: 0,
      burst_window_tokens: 0,
      burst_window_start: Date.now(),
    });
  }

  return tokenBudgets.get(userId);
}

/**
 * Update user's token usage for the day
 */
function updateTokenBudget(userId, tokens) {
  const budget = getOrCreateTokenBudget(userId);
  const today = new Date().toDateString();

  // Reset daily counter if date changed
  if (budget.last_reset_date !== today) {
    budget.daily_tokens = 0;
    budget.requests_today = 0;
    budget.last_reset_date = today;
  }

  budget.daily_tokens += tokens;
  budget.requests_today += 1;

  // Track burst window
  const now = Date.now();
  const windowAge = now - budget.burst_window_start;

  if (windowAge > AI_LOGGING_CONFIG.BURST_LIMIT_WINDOW_MS) {
    // New window
    budget.burst_window_tokens = tokens;
    budget.burst_window_start = now;
  } else {
    // Add to current window
    budget.burst_window_tokens += tokens;
  }
}

/**
 * Check if user has exceeded daily token budget
 * Returns { allowed: boolean, reason?: string, tokens_remaining?: number }
 */
function checkDailyBudget(userId) {
  const budget = getOrCreateTokenBudget(userId);
  const remaining = AI_LOGGING_CONFIG.DAILY_TOKEN_LIMIT - budget.daily_tokens;

  if (budget.daily_tokens >= AI_LOGGING_CONFIG.DAILY_TOKEN_LIMIT) {
    return {
      allowed: false,
      reason: `Daily token budget exceeded (${budget.daily_tokens}/${AI_LOGGING_CONFIG.DAILY_TOKEN_LIMIT})`,
      tokens_remaining: 0,
      reset_time: new Date(Date.parse(budget.last_reset_date) + 24 * 60 * 60 * 1000).toISOString(),
    };
  }

  return { allowed: true, tokens_remaining: remaining };
}

/**
 * Check if user is in burst mode (too many tokens in 1 minute)
 */
function checkBurstLimit(userId) {
  const budget = getOrCreateTokenBudget(userId);
  const now = Date.now();
  const windowAge = now - budget.burst_window_start;

  // If window has expired, allow
  if (windowAge > AI_LOGGING_CONFIG.BURST_LIMIT_WINDOW_MS) {
    return { allowed: true };
  }

  if (budget.burst_window_tokens >= AI_LOGGING_CONFIG.BURST_LIMIT_TOKENS) {
    return {
      allowed: false,
      reason: `Burst limit exceeded (${budget.burst_window_tokens}/${AI_LOGGING_CONFIG.BURST_LIMIT_TOKENS} in 1 min)`,
      retry_after_seconds: Math.ceil((AI_LOGGING_CONFIG.BURST_LIMIT_WINDOW_MS - windowAge) / 1000),
    };
  }

  return { allowed: true };
}

/**
 * Get user's AI usage statistics
 */
function getUserAiStats(userId) {
  const budget = getOrCreateTokenBudget(userId);
  const today = new Date().toDateString();
  const isToday = budget.last_reset_date === today;

  return {
    user_id: userId,
    date: today,
    daily_tokens_used: isToday ? budget.daily_tokens : 0,
    daily_tokens_limit: AI_LOGGING_CONFIG.DAILY_TOKEN_LIMIT,
    daily_percent_used: Math.round((budget.daily_tokens / AI_LOGGING_CONFIG.DAILY_TOKEN_LIMIT) * 100),
    requests_today: isToday ? budget.requests_today : 0,
    estimated_daily_cost_usd: +(budget.daily_tokens * 0.000000225).toFixed(4), // avg token cost
  };
}

/**
 * Get aggregate AI usage across all users
 */
function getAggregateAiStats() {
  let totalTokens = 0;
  let totalRequests = 0;
  let totalUsers = 0;

  for (const budget of tokenBudgets.values()) {
    totalTokens += budget.daily_tokens;
    totalRequests += budget.requests_today;
    totalUsers += 1;
  }

  return {
    timestamp: new Date().toISOString(),
    total_users: totalUsers,
    total_requests_today: totalRequests,
    total_tokens_today: totalTokens,
    average_tokens_per_request: totalRequests > 0 ? Math.round(totalTokens / totalRequests) : 0,
    estimated_cost_usd: +(totalTokens * 0.000000225).toFixed(4),
  };
}

module.exports = {
  initializeAiLogging,
  logAiUsage,
  getOrCreateTokenBudget,
  checkDailyBudget,
  checkBurstLimit,
  getUserAiStats,
  getAggregateAiStats,
  AI_LOGGING_CONFIG,
};
