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

## Booking endpoints

Catalog reads are public. Holds and booking creation require authentication and the CSRF cookie/header pair. Prices are calculated again on the server for every hold and booking request.

| Method | Endpoint | Purpose |
| --- | --- | --- |
| GET | `/api/v1/destinations` | List active destinations |
| GET | `/api/v1/destinations/:slug` | Read a destination and its published packages |
| GET | `/api/v1/destinations/:slug/packages` | List published packages for a destination |
| GET | `/api/v1/languages` | List active booking languages |
| GET | `/api/v1/guides/available` | Find eligible guides for destination, package, dates, group size, and ordered languages |
| POST | `/api/v1/booking-holds` | Validate availability and reserve a guide/package/date window for ten minutes |
| POST | `/api/v1/booking-holds/:id/release` | Release an unused hold |
| POST | `/api/v1/bookings` | Create a pending-payment booking from a valid hold |
| GET | `/api/v1/bookings/mine` | List the authenticated tourist's bookings |

Guide ranking uses a configurable score: ordered language matches are weighted first (the first preference receives the highest weight), followed by rating, experience, and availability. The API filters for approved, verified, active guides with matching destinations, capacity, available windows, and no conflicting confirmed bookings or active holds.

Booking holds and booking creation use a PostgreSQL transaction plus a guide/date advisory transaction lock. PostgreSQL GiST exclusion constraints remain the final protection against overlapping confirmed bookings and unreleased holds.

## Payment endpoints

Razorpay order creation, verification, and refunds are server-side. The frontend only receives a public checkout key and a provider order ID. Payment webhooks use the raw request bytes and `x-razorpay-signature`; duplicate provider events are ignored using `PaymentEvent.providerEventId`.

| Method | Endpoint | Purpose |
| --- | --- | --- |
| POST | `/api/v1/payments/orders` | Recalculate a pending booking amount and create/reuse a Razorpay order |
| POST | `/api/v1/payments/verify` | Verify order/payment/signature and confirm the booking |
| POST | `/api/v1/payments/webhook` | Validate and process Razorpay payment/refund events |
| POST | `/api/v1/payments/bookings/:bookingId/cancel` | Apply the cancellation policy and create a tracked refund |

The booking hold remains active while payment is pending. A valid payment releases the hold and confirms the booking. A payment arriving after hold expiration moves the booking to cancelled and creates a full refund reconciliation record rather than confirming an unavailable guide.

## Dashboard endpoints

Dashboard APIs enforce ownership or `ADMIN`/`GUIDE` roles on the backend. Frontend route guards are only a user-experience layer.

| Method | Endpoint | Access |
| --- | --- | --- |
| GET | `/api/v1/dashboard/tourist/bookings?tab=upcoming\|past\|cancelled` | Authenticated tourist's own bookings |
| GET | `/api/v1/dashboard/tourist/bookings/:id` | Authenticated owner only |
| POST | `/api/v1/dashboard/tourist/bookings/:id/reviews` | Completed booking owner |
| GET | `/api/v1/dashboard/guide` | Guide role, own profile/bookings |
| PATCH | `/api/v1/dashboard/guide/profile` | Guide role, own permitted fields |
| POST | `/api/v1/dashboard/guide/availability` | Guide role, conflict-checked dates |
| GET | `/api/v1/dashboard/admin/metrics` | Admin role |
| GET/POST/PATCH | `/api/v1/dashboard/admin/guides` | Admin role, auditable status controls |
| GET/POST/PATCH | `/api/v1/dashboard/admin/destinations` | Admin role, database-managed catalog |
| GET/POST/PATCH | `/api/v1/dashboard/admin/packages` | Admin role |
| GET | `/api/v1/dashboard/admin/bookings` | Admin role, search/filter support |
| GET/PATCH | `/api/v1/dashboard/admin/reviews` | Admin role, moderation status only |
| GET/PATCH | `/api/v1/dashboard/admin/contacts` | Admin role |

## Notifications and public content

| Method | Endpoint | Purpose |
| --- | --- | --- |
| GET | `/api/v1/notifications` | List the authenticated user's recent notifications |
| GET | `/api/v1/reviews/public` | Return approved reviews only |
| POST | `/api/v1/contact` | Validate and persist a public contact request |

Notification delivery is persisted before dispatch. Failed deliveries retain attempt counts and error details for retry; the development email adapter is a mock provider and production provider credentials belong in environment configuration.
