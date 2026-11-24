# Implementation plan

1. **Phase 1 — Foundation:** workspace, web/API shells, shared contracts, documentation, local PostgreSQL/Redis, health endpoint.
2. **Phase 2 — Identity:** users, roles, secure sessions, Google OAuth adapter, authorization middleware.
3. **Phase 3 — Catalog:** destinations, guides, packages, search, guide profiles, media and moderation boundaries.
4. **Phase 4 — Availability and booking:** guide schedules, holds, transactional booking, conflict prevention, lifecycle state machine.
5. **Phase 5 — Payments:** Razorpay adapter, server-side pricing, idempotency, webhooks, refunds and reconciliation.
6. **Phase 6 — Notifications and operations:** event delivery, audit trails, admin workflows and observability.
7. **Phase 7 — Hardening:** integration/E2E tests, performance, accessibility, deployment automation and security review.

Each phase must update implementation status and run build, typecheck, lint, and relevant tests.
