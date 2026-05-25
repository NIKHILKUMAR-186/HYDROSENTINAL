# HydroSentinal — Security Guide

Date: May 25, 2026

This guide documents the security features applied to the HydroSentinal project and points to the implementation files.

## 1. Secrets and Environment Variables
- Keep secrets out of the repo; public client keys (VITE_*) in `.env` only.
- Platform secrets must be set in hosting environment variables (Vercel/GCP).
- Files:
  - [.env](.env)
  - [.gitignore](.gitignore)
  - [PRE_DEPLOY_SECURITY_GATE.md](PRE_DEPLOY_SECURITY_GATE.md)

## 2. Rate Limiting
- Per-category rate limits for `auth`, `general`, `ai`, and `upload` requests.
- AI requests scoped by `x-user-id` header (or IP).
- Files:
  - [backend/server.js](backend/server.js)

## 3. Input Validation and Sanitization
- Zod schema for LLM ask endpoint; general sanitizeText utility to remove HTML/control chars.
- Max lengths enforced (questions ≤ 500 chars).
- Files:
  - [supabase/functions/ask/index.ts](supabase/functions/ask/index.ts)
  - [backend/server.js](backend/server.js)

## 4. Authentication and Authorization
- Admin-only endpoints require Firebase ID token verification and role check.
- Files:
  - [backend/server.js](backend/server.js)
  - [src/contexts/AuthContext.tsx](src/contexts/AuthContext.tsx)

## 5. SQL and Database Security
- Local reads stored in SQLite (`better-sqlite3`) — not network-accessible by default.
- Firestore usage requires secure rules; pre-deploy guide includes recommendations.
- No raw SQL concatenation; DB access uses safe queries.
- Files:
  - [backend/db.js](backend/db.js)
  - [PRE_DEPLOY_SECURITY_GATE.md](PRE_DEPLOY_SECURITY_GATE.md)

## 6. CORS Configuration
- Whitelist-driven CORS via `CORS_ALLOWED_ORIGINS` env var.
- No wildcard (`*`) in production; development allows localhost origins.
- Files:
  - [backend/server.js](backend/server.js)

## 7. HTTP Security Headers
- Helmet applied with strict CSP, HSTS (production), frameguard, noSniff, and referrer policy.
- Files:
  - [backend/server.js](backend/server.js)

## 8. File Upload Security
- `multer` configured with allowed MIME types, extensions, and per-category max sizes.
- Uploads saved under `backend/uploads` with safe filenames.
- Files:
  - [backend/server.js](backend/server.js)

## 9. Error Handling and Logging
- Generic client-facing error messages; full stack traces logged server-side only.
- Structured error logs stored via `backend/lib/safeError.js`.
- Sentry integration optional and gated by `SENTRY_DSN`.
- Files:
  - [backend/lib/safeError.js](backend/lib/safeError.js)
  - [backend/server.js](backend/server.js)

## 10. Dependency Security
- `npm audit` run; high/critical fixable vulnerabilities addressed.
- Lockfiles pinned: `package-lock.json` in root and backend packages.
- Files:
  - [package-lock.json](package-lock.json)
  - [backend/package-lock.json](backend/package-lock.json)
  - [audit-root.json](audit-root.json)

## 11. XSS Prevention
- No `dangerouslySetInnerHTML` for user content; React JSX auto-escapes strings.
- LLM and other outputs sanitized before rendering; HTML removed from user-supplied input.
- Files:
  - [src/components/ChatPanel.tsx](src/components/ChatPanel.tsx)
  - [supabase/functions/ask/index.ts](supabase/functions/ask/index.ts)
  - [src/components/ui/chart.tsx](src/components/ui/chart.tsx)

## 12. Deployment Checklist
Before production deploy (recommended):
- Set hosting environment variables: `GEMINI_API_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `SENTRY_DSN` (optional), `CORS_ALLOWED_ORIGINS`, `NODE_ENV=production`.
- Apply Firestore security rules in Firebase Console and test with the rules simulator.
- Run a production build and verify no `console.*` output: `npm run build` + `npm run preview`.
- Verify HTTPS and HSTS on hosting platform.
- Files:
  - [PRE_DEPLOY_SECURITY_GATE.md](PRE_DEPLOY_SECURITY_GATE.md)
  - [vite.config.ts](vite.config.ts)
  - [vercel.json](vercel.json)

## 13. AI and LLM-Specific Rules
- All LLM calls go through server-side edge function; `GEMINI_API_KEY` is never exposed to client.
- Input validation and sanitization (Zod + sanitizeText) applied before composing prompts.
- Generation parameters: `temperature = 0`, `maxOutputTokens = 140`.
- Output sanitized (persona lock, markdown stripping) and truncated (60 words max).
- Rate limiting: 10 requests/min per user.
- Optional token logging and budgets via `backend/lib/aiUsageLogger.js` and `/api/ai/log-usage`.
- Files:
  - [supabase/functions/ask/index.ts](supabase/functions/ask/index.ts)
  - [LLM_SECURITY_IMPLEMENTATION.md](LLM_SECURITY_IMPLEMENTATION.md)
  - [backend/lib/aiUsageLogger.js](backend/lib/aiUsageLogger.js)
  - [backend/server.js](backend/server.js)

---

If you'd like, I can also:
- Add automated tests for the LLM safety rules and rate limits.
- Wire `aiUsageLogger` to Firestore or Redis for persistent token budgets.

