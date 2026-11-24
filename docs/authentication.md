# Authentication

GuideMyTrip authenticates tourists, guides, and admins with a password associated with a normalized mobile number and optional normalized email address. New accounts always receive the `TOURIST` role; guide/admin roles are assigned only through existing administrative workflows.

## API flow

1. `POST /api/v1/auth/signup` validates full name, E.164-like mobile number, optional email, password, and confirmation. It creates a bcrypt password hash and an HttpOnly session.
2. `POST /api/v1/auth/login` accepts `identifier` and `password`. The identifier is interpreted as email when it contains `@`, otherwise as a mobile number. Invalid credentials use one generic response.
3. `POST /api/v1/auth/forgot-password` accepts an email and always returns the same user-facing message. Existing accounts receive a single-use link through the configured email provider.
4. `POST /api/v1/auth/reset-password` validates the hashed token, expiry, password policy, and confirmation, then changes the password and revokes active sessions.

State-changing endpoints require the CSRF cookie/header pair. Access and refresh credentials remain in HttpOnly cookies; refresh tokens are rotated and stored only as hashes.

## Protected navigation and logout

The authenticated header exposes only `My Bookings` and `Log out`; `My Bookings` reuses the protected `/account` tourist dashboard. The dashboard API derives ownership from the authenticated session (`request.auth.id`) and never accepts a tourist ID from the browser.

Logout revokes the refresh-token session server-side, clears the auth cookies, clears frontend query and booking-draft state, and replaces the current history entry with the public homepage. A protected API `401` also clears the central auth state immediately. Auth state is revalidated on visibility changes and BFCache `pageshow` events before protected content is rendered. A non-sensitive logout signal synchronizes other tabs; those tabs clear local auth state and return home. API responses are marked `Cache-Control: no-store`.

If the logout request cannot reach the API, the UI still clears local sensitive state and returns home, but displays a warning that server invalidation could not be confirmed.

## Local testing

Use `EMAIL_PROVIDER=mock`. Password-reset delivery is captured by the in-process mock provider in automated tests; no email is sent. Use `EMAIL_PROVIDER=smtp` and the SMTP variables in `.env` for real local delivery. Never commit `.env` or provider credentials.

The old OTP database table remains only as historical, non-destructively preserved data. No OTP authentication route, provider, environment setting, or active frontend route remains.
