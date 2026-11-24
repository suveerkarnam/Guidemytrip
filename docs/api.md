# API

The REST API is versioned under `/api/v1`. Phase 1 exposes `GET /api/v1/health`, returning service status and an ISO timestamp without secrets. Future modules should keep validation at the route boundary and return stable error codes.

## Authentication endpoints

All state-changing auth endpoints require the `gt_csrf` cookie and matching `X-CSRF-Token` header. Auth state is carried in HttpOnly cookies; long-lived refresh tokens are never returned in JSON or stored in browser localStorage.

| Method | Endpoint | Purpose |
| --- | --- | --- |
| GET | `/api/v1/auth/csrf` | Issue a CSRF token cookie |
| POST | `/api/v1/auth/otp/request` | Validate an E.164 phone and send a rate-limited OTP |
| POST | `/api/v1/auth/otp/verify` | Consume an OTP and create a tourist session |
| POST | `/api/v1/auth/password/signup` | Create a tourist account with a scrypt password hash |
| POST | `/api/v1/auth/password/login` | Login an active account, including guides/admins |
| POST | `/api/v1/auth/google` | Verify a Google ID token server-side and sign in/create a tourist |
| POST | `/api/v1/auth/google/link` | Link a verified Google identity to the authenticated user |
| POST | `/api/v1/auth/refresh` | Rotate the refresh token and issue a new access cookie |
| POST | `/api/v1/auth/logout` | Revoke the refresh session and clear cookies |
| GET | `/api/v1/auth/me` | Return the authenticated user and roles |

Google sign-in never links solely from a frontend email value. A verified token subject is the identity key; an existing email match returns `GOOGLE_ACCOUNT_LINK_REQUIRED` until the user explicitly authenticates and links the provider.
