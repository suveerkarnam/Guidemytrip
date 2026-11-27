# Implementation status

## Completed

- Homepage card and carousel refinement: featured banners rotate every 3 seconds when unpaused; destination cards highlight on hover and link across their full area; package cards link across their full area with an unwrapped action label; guide ratings display one decimal in the homepage/list and booking selection.
- Phase 1 foundation scaffold created on `feature/initial-implementation`.
- Phase 2 premium tourism design system and data-driven homepage implemented.
- Phase 3 PostgreSQL/Prisma schema, initial migration, and development seed implemented.
- Phase 4 password authentication implemented for mobile/email identifiers, bcrypt password hashes, Google identity verification, secure sessions, cookies, password reset, and authorization middleware. OTP is no longer exposed by the application.
- Phase 5 booking engine implemented with a data-driven wizard, destination/package APIs, guide discovery, ordered language preferences, server-side pricing, expiring holds, and pending-payment booking creation.
- Phase 6 Razorpay payment lifecycle implemented with backend orders, Checkout integration, signature verification, idempotent webhooks, confirmation, retries, cancellation policy handling, and refund tracking.
- Phase 7 tourist, guide, and admin dashboards implemented with server-enforced ownership/roles, booking details, cancellation/review workflows, guide availability, admin metrics, guide/package/booking/review/contact operations, and moderation fields.
- Booking integrity includes PostgreSQL GiST exclusion constraints for confirmed guide date ranges and unreleased holds.
- Destination, package, guide, testimonial, trust, FAQ, and guide recruitment sections added.
- Responsive navigation, carousel, route pages, authentication shells, and resilient image fallbacks added.
- Homepage/navigation refinement completed: authenticated users land on the homepage, navbar state is auth-driven with accessible profile/bookings/logout menus, profile route added, and hero/background contrast and layering improved.
- npm workspaces for web, API, shared, and config packages.
- Baseline React/Vite frontend and Express API.
- `GET /api/v1/health` endpoint.
- Prisma PostgreSQL boundary and Docker Compose for PostgreSQL/Redis.
- Architecture and implementation-plan documentation.

## Pending

- Production SMTP provider configuration, scheduled travel reminders, observability, and final hardening.

## Verification

- Homepage card and carousel refinement: `npm.cmd run typecheck:web`, `npm.cmd run lint:web`, `npm.cmd run test:web` (4 passing tests), and `npm.cmd run build:web` passed. Server-rendered card tests emit React Router `useLayoutEffect` warnings; Vite emits existing dependency-level `use client` warnings.
- `npm install` completed and generated `package-lock.json`.
- `npm run typecheck` passed.
- `npm run build` passed for shared, web, and API workspaces.
- `npm run lint` passed for shared, config, web, and API workspaces.
- `npm run test` passed: shared, web, and API suites; API booking pricing/ranking tests and existing auth tests pass.
- `GET /api/v1/health` returned HTTP 200 with a safe status payload.
- Docker Compose validation was not run because Docker is not installed in the environment.
- `npm audit` reports 11 dependency findings (3 moderate, 6 high, 2 critical); these are recorded for dependency hardening.
- Phase 2 frontend verification: `npm run typecheck`, `npm run build`, `npm run lint`, and `npm run test` all pass. Vite reports informational warnings for dependency-level `use client` directives during bundling.
- Password-auth verification: Prisma validation/client generation, Supabase migration deploy, typecheck, build, lint, and all 18 workspace tests pass. Tests cover bcrypt hashing, mobile/email login, signup normalization, reset-token hashing, and session invalidation paths.
- Phase 3 `prisma validate`, Prisma Client generation, API build, API typecheck, and migration diff checks passed.
- Migration deploy and seed were attempted against localhost PostgreSQL; deploy could not complete and seed rejected the configured demo credentials. Docker is unavailable in this environment, so no database state was changed.
- Phase 5 verification: Prisma Client generation, typecheck, build, lint, and all workspace tests pass. Live booking smoke tests remain pending until demo data is authorized and seeded.
- Supabase verification: both checked-in migrations deployed successfully and `prisma migrate status` reports the database schema is up to date. The remote development seed was not run because it would persist demo data and credentials were not explicitly authorized for that mutation.
- Phase 6 verification: Razorpay SDK installation, TypeScript checks, lint, tests, and production builds pass. Live Razorpay checkout/webhook verification requires test credentials and a configured webhook endpoint.
- Phase 7 verification: Prisma validation/client generation, typecheck, lint, tests, and production builds pass. Dashboard unit tests cover tourist ownership, review eligibility, and guide availability conflicts.
- Phase 8 notification provider abstraction, persisted delivery attempts/retries, approved public reviews, contact persistence, configurable public policy pages, footer links, and public support routes implemented.
- Phase 8 verification: notification, contact, review, typecheck, lint, test, and build checks pass. Email is intentionally a mock provider until production provider credentials are configured.
- Phase 9 security, booking-integrity, logging, rate-limit, dependency, and performance audit completed; payment capture locking and sensitive-log redaction fixes applied.
- Phase 9 verification: Prisma validation, typecheck, lint, 18 tests, production build, offline dependency audit, and diff checks pass. Online npm audit could not reach the registry; Docker and Playwright are unavailable/not installed.
- Homepage/navigation verification: typecheck, build, lint, tests, and diff checks pass; local `/auth/me` smoke check returns 401 when unauthenticated and the frontend route returns HTTP 200.
- Profile/bookings/logout hardening: authenticated profile menu contains only My Bookings and Log out; the existing `/account` dashboard remains protected and user-scoped; logout revokes the server session, clears local/query state, replaces history, revalidates on BFCache/visibility restoration, and synchronizes other tabs.
- Booking CTA integration: removed the homepage search panel and added a Book Guide CTA wired to the existing `/book` multi-step wizard. Booking drafts survive sign-in and are hydrated before persistence can overwrite them.
- Payment handoff refinement: enlarged and styled the Book Guide CTA; the review step now creates the server-side hold and pending booking in one guarded action before opening Razorpay Checkout, with retry support if payment preparation fails.
- Razorpay handoff hardening: incomplete restored booking state now shows an actionable error instead of silently returning, and Razorpay script loading has a timeout and explicit checkout error handling.
- Booking payload validation fix: the booking schemas now normalize `languageIds` from either comma-separated query strings or ordered JSON arrays, covering guide discovery, hold creation, and booking creation consistently.
- Razorpay provider isolation: payment idempotency keys are now scoped by provider, preventing stale `order_mock_*` records from being reused after switching to Razorpay Test Mode; Razorpay mode rejects mock order IDs defensively.
- Runtime configuration fix: API environment loading now consistently reads the repository-level `.env`, avoiding an `apps/api/.env` mock-provider override; startup logs the active non-secret payment provider.
- Hero layout refinement: reduced the homepage hero height, doubled the Book Guide CTA scale, and removed the slide counter and divider line while retaining the destination indicators.
- Destination asset refinement: added the repository-served Hampi banner at `apps/web/public/images/destinations/hampi.jpg` and updated the shared destination catalog to use it.
- Destination asset refinement: added the repository-served Mysuru/Mysore banner at `apps/web/public/images/destinations/mysuru.jpg` and updated the shared destination catalog to use it.
- Destination asset refinement: added the repository-served Varanasi banner at `apps/web/public/images/destinations/varanasi.jpg` and updated the shared destination catalog to use it.
- Dashboard navigation refinement: removed the redundant Sign out button from My Bookings; the site header provides the existing logout control.
- Admin guide CRUD: added protected create, read, update, and soft-delete guide operations, including profile fields, language/destination assignments, approval controls, audit logging, and an admin dashboard editor.
- Admin guide form refinement: full name, phone, language, and destination selections are mandatory; numeric guide fields have explanatory help text; profile image URLs were replaced with size/type-validated image upload and preview support.
- Admin dashboard usability: experience years is explicitly required, the duplicate dashboard sign-out control was removed in favor of the profile menu logout, and guides, packages, bookings, reviews, and contacts now each expose category-specific filters.
- Admin navigation refinement: added an admin-only Platform Operations link to desktop and mobile navigation so administrators can always return to `/admin` from other pages.
- Booking authentication continuity: guide discovery now runs on both the Guide and Review steps, allowing the persisted guide selection to be rehydrated after a sign-in redirect without changing the existing booking draft fields or payment flow.

## Decisions

- Use npm workspaces because the repository had no existing application or workspace configuration.
- Keep Prisma schema domain-free in Phase 1; booking models arrive with the booking phase.
- Use configuration-driven destination content and clearly labeled demo content until catalog APIs exist.
- Use remote Unsplash URLs with branded fallbacks for the Phase 2 demo; replace with licensed local assets before production.
- Treat `config/destinations.json` as seed input only once catalog APIs are available; PostgreSQL is the future source of truth.
- Keep Google OAuth client credentials and production auth secrets in environment configuration; no credentials are seeded or committed.
- Preserve ordered language preferences with `BookingLanguage.sortOrder`; bind each hold to its selected package so a hold cannot be reused for a different package.
- Use a ten-minute server-side hold, advisory transaction locking, and PostgreSQL exclusion constraints to handle concurrent guide booking requests.
