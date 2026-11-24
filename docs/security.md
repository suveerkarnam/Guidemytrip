# Security

The baseline enables Helmet, restricted CORS, JSON request limits, rate limiting, compression, structured request logging, and centralized safe error responses. Secrets belong in environment variables and must never be committed. Authentication, authorization, payment verification, webhook validation, audit logs, and PII controls are required before production.

## Phase 4 authentication controls

- Mobile numbers are normalized to E.164-like format, OTPs are HMAC-hashed, expire after a configurable window, are capped by attempts, and have a resend cooldown plus endpoint rate limit. OTP values are never returned or logged.
- The mock SMS provider is selected only for non-production development and stores delivery data only in process memory for tests. Production configuration rejects the mock provider and default development secrets.
- Access tokens are short-lived signed JWTs in HttpOnly cookies. Refresh tokens are opaque, hashed in `Session`, rotated on every refresh, revoked on logout, and rejected on reuse/expiry.
- Auth mutations require a double-submit CSRF token. Cookies use `Secure` in production and `SameSite=Lax`.
- Google identity tokens are verified by the backend with Google’s OAuth client; verified provider subjects are unique, and email matches alone never auto-link accounts.
- `requireAuth`, `requireRoles`, and `requireOwnership` middleware provide server-side authorization boundaries. Frontend guards are convenience only.
