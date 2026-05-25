# Security Features Applied — HydroSentinal

Date: May 25, 2026

This document summarizes the security hardening and LLM-safety measures implemented across the HydroSentinal project and points to the implementation files.

## Summary of Applied Measures

- Credentials & secrets
  - `.env` consolidated for public client keys; secrets must be configured in hosting platform environment variables.
  - `.gitignore` excludes `.env`, `.env.local`, and `backend/serviceAccountKey.json`.
  - See: [\.env](.env), [.gitignore](.gitignore), [PRE_DEPLOY_SECURITY_GATE.md](PRE_DEPLOY_SECURITY_GATE.md)

- Production logging & builds
  - `vite.config.ts` configured to drop `console.*` in production builds (minifier `drop_console`).
  - Backend logging: structured error responses via `backend/lib/safeError.js`; console logs guarded by `NODE_ENV`.
  - See: [vite.config.ts](vite.config.ts), [backend/server.js](backend/server.js), [backend/lib/safeError.js](backend/lib/safeError.js)

- HTTP / Transport
  - HTTPS enforced by platform (Vercel) and HSTS enabled in `backend/server.js` for production.
  - Helmet used with strict CSP and other security headers.
  - See: [backend/server.js](backend/server.js), [vercel.json](vercel.json)

- CORS
  - Whitelist-driven CORS via `CORS_ALLOWED_ORIGINS` env var; no wildcard origin in production.
  - See: [backend/server.js](backend/server.js)

- Rate limiting
  - Per-category rate limits implemented for auth, general, AI, and uploads.
  - AI endpoints use a user-scoped limiter (header `x-user-id` or IP).
  - See: [backend/server.js](backend/server.js)

- File upload validation
  - `multer` configuration with allowed MIME types and size limits; uploads saved to `backend/uploads`.
  - See: [backend/server.js](backend/server.js)

- Database safety
  - Local SQLite (`better-sqlite3`) for readings; no public DB credentials in repo.
  - Firestore usage requires secure rules (recommendations in pre-deploy guide).
  - See: [backend/db.js](backend/db.js), [PRE_DEPLOY_SECURITY_GATE.md](PRE_DEPLOY_SECURITY_GATE.md)

- Error handling
  - Generic client-facing error messages; full stack/traces logged server-side only.
  - Sentry optional integration enabled only when `SENTRY_DSN` present.
  - See: [backend/lib/safeError.js](backend/lib/safeError.js), [backend/server.js](backend/server.js)

- LLM / AI Safety
  - All LLM calls routed through server-side edge function: [supabase/functions/ask/index.ts](supabase/functions/ask/index.ts)
  - API key never exposed to client; `GEMINI_API_KEY` read server-side only.
  - Input validation (Zod) and sanitization applied (max 500 chars).
  - Output limits: `generationConfig.maxOutputTokens = 140`; response post-processed to remove markdown, enforce persona and SAFE/NOT SAFE policy and 60-word cap.
  - Rate limiting for LLM: 10 requests/min per user.
  - Frontend calls `[src/components/ChatPanel.tsx](src/components/ChatPanel.tsx)` use `supabase.functions.invoke('ask', ...)` (no keys in client).
  - See: [supabase/functions/ask/index.ts](supabase/functions/ask/index.ts), [src/components/ChatPanel.tsx](src/components/ChatPanel.tsx), [LLM_SECURITY_IMPLEMENTATION.md](LLM_SECURITY_IMPLEMENTATION.md)

- AI usage logging & token budgets
  - `backend/lib/aiUsageLogger.js` added to log token consumption and track per-user daily budgets (in-memory; production should use persistent DB).
  - `/api/ai/log-usage` endpoint added to `backend/server.js` to accept usage logs.
  - See: [backend/lib/aiUsageLogger.js](backend/lib/aiUsageLogger.js), [backend/server.js](backend/server.js)

## How to verify locally (quick checks)

1. Build production frontend and ensure no console logs in DevTools:

```powershell
npm run build
npm run preview
``` 

2. Test LLM edge function (without GEMINI_API_KEY) — should return a sanitized fallback:

```powershell
curl -X POST "http://localhost:54321/functions/v1/ask" -H "Content-Type: application/json" -d '{"question":"Is this water safe to drink?"}'
```

3. Test rate limiting on AI endpoints by sending 11 requests within 60 seconds; 11th should return 429.

4. Verify CORS allowed origins header on backend responses:

```powershell
curl -I http://localhost:4000/health
# Check `X-Allowed-Origins` header
```

## Recommended next steps (production hardening)

- Deploy Firestore security rules in Firebase Console and test with the rules simulator.
- Replace `aiUsageLogger` in-memory store with persistent storage (Firestore/Redis) for production budgets and alerts.
- Add monitoring dashboard for AI token usage and alerts.
- Ensure hosting project environment variables (Vercel/GCP) contain secrets: `GEMINI_API_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `SENTRY_DSN` (optional), `CORS_ALLOWED_ORIGINS`.

---

If you want, I can also:
- Add an automated test script that runs the LLM policy tests and rate-limit checks.
- Wire `aiUsageLogger` to Firestore and enable per-user budget enforcement.

