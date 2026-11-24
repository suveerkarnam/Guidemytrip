# Security Notes

GuideMyTrip uses password authentication for mobile-number or email sign-in. Passwords are stored as bcrypt hashes with a work factor of 12; raw passwords are never logged or returned.

Authentication state uses short-lived access cookies and rotating, hashed refresh-token sessions. Cookies are HttpOnly, Secure in production, SameSite=Lax, and protected by the CSRF cookie/header pair for mutations. Logout revokes the refresh session, and password reset revokes all active sessions for the account.

Signup normalizes E.164-like phone numbers and lowercase email addresses. Database unique constraints handle duplicate mobile/email registrations, while the API returns generic credential errors to reduce account enumeration. Login and reset endpoints are rate limited.

Forgot-password requests return the same message whether or not an account exists. Reset tokens are cryptographically random, stored only as SHA-256 digests, expire after the configured period, and are consumed atomically. Local development uses a mock email provider; production should use the configured SMTP adapter.

Google identity verification remains server-side and links only from a verified provider subject. Roles and ownership continue to be enforced by backend middleware.

The historical `OtpVerification` table and related notification enum value remain in the database migration history for non-destructive compatibility. OTP is no longer exposed by routes, frontend navigation, services, providers, or configuration. Removing historical objects requires a separately authorized cleanup migration.

Do not log passwords, reset tokens, access/refresh tokens, payment secrets, or sensitive personal/payment data. Production requires non-default JWT secrets, HTTPS, a real email provider, and secret-manager configuration.
